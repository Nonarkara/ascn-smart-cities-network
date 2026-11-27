#!/usr/bin/env python3
"""Rebuild the project register from the four committed M&E reports.

Why this exists
---------------
The register in `data/ascn-v2-data.json` was first extracted with pdfplumber
positional slicing (`raw[7]` for the city, `raw[10]` for the project). Two
classes of row defeated it, and both reached the published site:

* a row whose cells wrapped onto a second line was mis-sliced, so several
  numbered rows were MERGED into one field — the last published row of the
  projects table carried the project name "E-Payments Industry & Innovation
  17." in its CITY cell;
* a row whose city is also its country (every Singapore row) was read as a
  country cell, so the row was DROPPED — every Singapore row, and every row
  whose predecessor wrapped, went missing.

An independent review of the live release (stage 2, 2026-11-29) found the
merged rows; the dropped rows were 27 short of the reports' own totals.

This script reads the PRINTED table the way a reader reads it — a row starts
at its number and ends at its focus area — and rewrites the register from
those rows. It is idempotent: running it twice produces the same file.

Run:  python3 scripts/rebuild-ascn-projects.py [--check]
`--check` prints the diff summary and exits non-zero if the committed file
does not match what the reports say.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "ascn-v2-data.json"

# The four official reports, committed under docs/ with their issuing URL in
# the register's own `sources` block.
REPORTS = {
    2022: "docs/04_ASCN_ME_Report_2022.pdf",
    2023: "docs/05_ASCN_ME_Report_2023.pdf",
    2024: "docs/06_ASCN_ME_Report_2024.pdf",
    2025: "docs/07_ASCN_ME_Report_2025.pdf",
}

FOCUS_AREAS = [
    "Civic & Social",
    "Health & Well-Being",
    "Safety & Security",
    "Quality Environment",
    "Built Infrastructure",
    "Industry & Innovation",
]

COUNTRIES = [
    "Brunei Darussalam", "Cambodia", "Indonesia", "Lao PDR", "Malaysia",
    "Myanmar", "Philippines", "Singapore", "Thailand", "Viet Nam", "Timor-Leste",
]


def rows_from_page(text: str) -> list[dict]:
    """Split printed table text into rows that start at their number."""
    rows: list[dict] = []
    current: dict | None = None
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        match = re.match(r"^(\d{1,3})\.\s*(.*)$", line)
        if match:
            if current:
                rows.append(current)
            rest = match.group(2).strip()
            current = {"number": int(match.group(1)), "cells": [rest] if rest else [], "country_printed": bool(rest)}
            continue
        if current is not None:
            current["cells"].append(line)
    if current:
        rows.append(current)
    return rows


def parse_row(cells: list[str], country: str, country_printed: bool):
    """The last cell is the focus area; before it the city and the project.

    The printed table writes the country only on the FIRST row of each
    country, so the number's own line carries the country when the row opens
    a group. Reading "Singapore" as a country when it is really the CITY is
    what dropped every Singapore row from the first extraction.
    """
    focus = ""
    for area in FOCUS_AREAS:
        if cells and cells[-1].startswith(area):
            focus = area
            cells = cells[:-1]
            break
    if not focus:
        return None
    if country_printed and cells:
        head = cells[0]
        for name in COUNTRIES:
            if head.startswith(name):
                country = name
                cells = cells[1:]
                break
    if not cells:
        return None
    city = cells[0]
    project = " ".join(cells[1:]).strip()
    if not project:
        return None
    return country, city, project, focus


def read_report(year: int) -> list[dict]:
    """Every project row the report prints, in printed order."""
    path = ROOT / REPORTS[year]
    doc = fitz.open(path)
    country = ""
    kind = "ongoing/planning"
    seen: list[dict] = []
    for page_number, page in enumerate(doc, start=1):
        text = page.get_text()
        if "List of Completed ASCN Smart City Projects" in text:
            kind = "completed"
        elif "List of ASCN Smart City Projects" in text:
            kind = "ongoing/planning"
        if "Focus Area" not in text and not re.search(r"^\d{1,3}\.\s*$", text, re.M):
            continue
        for row in rows_from_page(text):
            parsed = parse_row(row["cells"], country, row["country_printed"])
            if not parsed:
                continue
            country = parsed[0]
            seen.append({
                "report_year": year,
                "status": kind,
                "number": row["number"],
                "country": parsed[0],
                "city": parsed[1],
                "project": parsed[2],
                "focus_area": parsed[3],
                "source_page": page_number,
            })
    return seen


def build_projects() -> list[dict]:
    """The register, ordered by year, then status, then the report's numbering."""
    projects: list[dict] = []
    for year in sorted(REPORTS):
        rows = read_report(year)
        ongoing = [row for row in rows if row["status"] == "ongoing/planning"]
        completed = [row for row in rows if row["status"] == "completed"]
        projects.extend(sorted(ongoing, key=lambda row: row["number"]))
        projects.extend(sorted(completed, key=lambda row: row["number"]))
    return projects


def summarize(projects: list[dict], year: int) -> dict:
    rows = [row for row in projects if row["report_year"] == year]
    by_country = Counter(row["country"] or "Unspecified" for row in rows)
    by_city = Counter(row["city"] for row in rows)
    by_focus = Counter(row["focus_area"] for row in rows)
    return {
        "row_count": len(rows),
        "by_country": dict(sorted(by_country.items())),
        "by_focus": dict(sorted(by_focus.items())),
        "top_cities": [
            {"city": city, "projects": count}
            for city, count in by_city.most_common(12)
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="report the difference and exit non-zero if the file is stale")
    args = parser.parse_args()

    projects = build_projects()
    document = json.loads(DATA.read_text())
    before = len(document["projects"])

    for year in sorted(REPORTS):
        rows = [row for row in projects if row["report_year"] == year]
        claimed = next(report["total_projects"] for report in document["reports"] if report["year"] == year)
        if len(rows) != claimed:
            print(f"{year}: the report prints {len(rows)} rows but the register claims {claimed}.", file=sys.stderr)
            return 1

    document["projects"] = projects
    document["derived"]["appendix_summaries"] = {
        str(report["year"]): summarize(projects, report["year"]) for report in document["reports"]
    }
    metadata = document["metadata"]
    metadata["generated_from"] = "Official ASCN public reports committed under docs/ and read by scripts/rebuild-ascn-projects.py"
    metadata["generated_at"] = "2026-11-29"
    metadata["notes"] = [
        "Every project row is read from the printed table of the report named in `sources`, one row per numbered project.",
        "2022 and 2023 implementation counts are rounded estimates derived from published percentages.",
        "Personal contact-list details are not exposed in this public JSON; only document metadata is cited.",
    ]
    metadata["source_review"] = {
        "reviewed": "2026-11-29",
        "method": "The four committed M&E reports were read again, row by row, against the register.",
        "found": [
            "Three rows had several numbered rows merged into one field, so a project name landed in the city column.",
            "Twenty-seven rows were missing: every Singapore row, and every row whose predecessor wrapped across a line.",
            "Six Viet Nam rows (2025, 111-116) were labelled Thailand.",
            "One project name had lost its last word (2025, 41).",
        ],
        "repaired": "The register was rebuilt from the reports; the row count now equals each report's own total.",
    }

    payload = json.dumps(document, indent=2, ensure_ascii=True) + "\n"
    if args.check:
        current = DATA.read_text()
        if current == payload:
            print(f"The register matches the reports ({before} rows).")
            return 0
        print(f"The register is stale: {before} rows committed, {len(projects)} rows in the reports.", file=sys.stderr)
        return 1

    DATA.write_text(payload)
    print(f"Wrote {DATA.relative_to(ROOT)}: {before} -> {len(projects)} project rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
