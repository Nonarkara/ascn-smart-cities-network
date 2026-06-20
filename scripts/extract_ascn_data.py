#!/usr/bin/env python3
"""Extract lightweight ASCN analytics data from official public PDFs.

Raw PDFs are intentionally kept outside git under .tmp/ascn-sources. The output
JSON is small enough to commit and keeps source URLs for traceability.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / ".tmp" / "ascn-sources"
OUT = ROOT / "data" / "ascn-v2-data.json"

FOCUS_AREAS = [
    "Civic & Social",
    "Health & Well-Being",
    "Safety & Security",
    "Quality Environment",
    "Built Infrastructure",
    "Industry & Innovation",
]

COUNTRIES = [
    "Brunei Darussalam",
    "Cambodia",
    "Indonesia",
    "Lao PDR",
    "Malaysia",
    "Myanmar",
    "Philippines",
    "Singapore",
    "Thailand",
    "Viet Nam",
    "Timor-Leste",
]

REPORTS = [
    {
        "year": 2022,
        "as_of": "2022-09-21",
        "file": "ascn-me-2022.pdf",
        "title": "ASCN Monitoring and Evaluation Report 2022",
        "url": "https://asean.org/wp-content/uploads/2022/10/2022-ASCN-ME-Report-Final_21Sep2022-for-public.pdf",
        "total_projects": 77,
        "status": {"ongoing": 58, "completed": 2, "planning": 17},
        "status_note": "Counts estimated from report percentages: 75.32% ongoing, 22.08% planning, 2.94% completed.",
        "focus_share": {
            "Civic & Social": 29,
            "Health & Well-Being": 6,
            "Safety & Security": 13,
            "Quality Environment": 22,
            "Built Infrastructure": 25,
            "Industry & Innovation": 5,
        },
        "network_highlights": [
            "Project portfolio expanded from 65 projects in 2021 to 77 projects in 2022.",
            "ASEAN Smart City Planning Guidebook was developed with support from MLIT Japan.",
            "ASEAN Smart City Investment Toolkit preparation was identified as a network-level milestone.",
        ],
    },
    {
        "year": 2023,
        "as_of": "2023-08-14",
        "file": "ascn-me-2023.pdf",
        "title": "ASCN Monitoring and Evaluation Report 2023",
        "url": "https://asean.org/wp-content/uploads/2023/09/2023-ASCN-ME-Report-Final_14Aug2023-for-public.pdf",
        "total_projects": 86,
        "status": {"ongoing": 67, "completed": 2, "planning": 17},
        "status_note": "Counts estimated from report percentages: 77.9% ongoing, 19.8% planning, 2.3% completed.",
        "focus_share": {
            "Civic & Social": 30,
            "Health & Well-Being": 6,
            "Safety & Security": 12,
            "Quality Environment": 21,
            "Built Infrastructure": 23,
            "Industry & Innovation": 8,
        },
        "network_highlights": [
            "ASCN projects reached 86 across the network.",
            "The ASEAN Smart City Investment Toolkit commenced development.",
            "ASCN convened a February-June discussion series across the six focus areas.",
        ],
    },
    {
        "year": 2024,
        "as_of": "2024-09-25",
        "file": "ascn-me-2024.pdf",
        "title": "ASCN Monitoring and Evaluation Report 2024",
        "url": "https://asean.org/wp-content/uploads/2024/10/2024-ASCN-ME-Report-Final_25Sep2024-for-public.pdf",
        "total_projects": 108,
        "status": {"ongoing": 81, "completed": 11, "planning": 16},
        "status_note": "Counts stated directly in the report text.",
        "focus_share": {
            "Civic & Social": 27,
            "Health & Well-Being": 6,
            "Safety & Security": 11,
            "Quality Environment": 18,
            "Built Infrastructure": 26,
            "Industry & Innovation": 12,
        },
        "network_highlights": [
            "Membership expanded from 26 pilot cities to 31 cities in 2024.",
            "ASCN continued the Smart City Financing Toolkit and sustainable urbanisation work.",
            "ASEAN Smart City Professional Program activities advanced.",
        ],
    },
    {
        "year": 2025,
        "as_of": "2025-09-30",
        "file": "ascn-me-2025.pdf",
        "title": "ASCN Monitoring and Evaluation Report 2025",
        "url": "https://asean.org/wp-content/uploads/2025/11/2025-ASCN-ME-Report-Final_30Sep2025-for-public.pdf",
        "total_projects": 134,
        "status": {"ongoing": 108, "completed": 18, "planning": 8},
        "status_note": "Counts stated directly in the report text.",
        "focus_share": {
            "Civic & Social": 25,
            "Health & Well-Being": 6,
            "Safety & Security": 14,
            "Quality Environment": 18,
            "Built Infrastructure": 25,
            "Industry & Innovation": 12,
        },
        "network_highlights": [
            "ASCN launched the ASEAN Smart City Financing Toolkit.",
            "ASCN convened ASUF 2025, Urban Planning for City Leaders, and capacity-building programmes.",
            "Malaysia led development and adoption of the ASEAN Smart City Action Plan 2026-2035.",
        ],
    },
]

BASE_SOURCES = [
    {
        "title": "ASEAN Smart Cities Network official page",
        "kind": "web",
        "year": 2026,
        "url": "https://asean.org/our-communities/asean-smart-cities-network/",
        "note": "Current official roster and network overview.",
    },
    {
        "title": "ASEAN Smart Cities Framework",
        "kind": "pdf",
        "year": 2018,
        "url": "https://asean.org/wp-content/uploads/2019/02/ASCN-ASEAN-Smart-Cities-Framework.pdf",
        "note": "Non-binding framework endorsed by ASCN on 8 July 2018.",
    },
    {
        "title": "ASCN Contact List",
        "kind": "pdf",
        "year": 2026,
        "url": "https://asean.org/wp-content/uploads/2026/05/ASCN-Contact-List-as-of-30-April-2026.pdf",
        "note": "National Representatives and Chief Smart City Officers, as of 30 April 2026.",
    },
]


def compact(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def first_number(cells: list[str]) -> int | None:
    for cell in cells:
        match = re.search(r"\d+", cell)
        if match:
            return int(match.group(0))
    return None


def find_country(cells: list[str]) -> str:
    joined = " ".join(cells)
    for country in COUNTRIES:
        if country in joined:
            return country
    return ""


def find_focus(cells: list[str]) -> str:
    joined = " ".join(cells)
    for focus in FOCUS_AREAS:
        if focus in joined:
            return focus
    return ""


def extract_project_rows(report: dict) -> list[dict]:
    path = SOURCE_DIR / report["file"]
    rows: list[dict] = []
    if not path.exists():
        return rows

    current_country = ""
    current_status = "ongoing/planning"
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if page_number > 10 and "List of ASCN Smart City Projects that are Ongoing and under Planning" in text:
                current_status = "ongoing/planning"
            if page_number > 10 and "List of Completed ASCN Smart City Projects" in text:
                current_status = "completed"
            if "List of ASCN" not in text and "No. Country City Project Focus Area" not in text:
                continue
            for table in page.extract_tables() or []:
                for raw in table:
                    cells = [compact(cell) for cell in raw if compact(cell)]
                    if not cells or any(cell == "No." for cell in cells):
                        continue
                    no = first_number(cells[:3])
                    focus = find_focus(cells)
                    if not no or not focus:
                        continue
                    country = find_country(cells) or current_country
                    if country:
                        current_country = country

                    city = ""
                    project = ""
                    if len(raw) >= 14:
                        country = find_country([compact(x) for x in raw[3:6]]) or country
                        city = compact(raw[7])
                        project = compact(raw[10])
                    if not city or not project:
                        joined = " ".join(cells)
                        for marker in [focus, country]:
                            if marker:
                                joined = joined.replace(marker, " ")
                        joined = re.sub(r"^\d+\.?\s*", "", joined).strip()
                        parts = joined.split("  ")
                        if len(parts) >= 2:
                            city, project = compact(parts[0]), compact(" ".join(parts[1:]))

                    if not city or not project:
                        continue
                    rows.append(
                        {
                            "report_year": report["year"],
                            "status": current_status,
                            "number": no,
                            "country": country,
                            "city": city,
                            "project": project,
                            "focus_area": focus,
                            "source_page": page_number,
                        }
                    )
    return rows


def summarize_projects(projects: list[dict], year: int) -> dict:
    rows = [p for p in projects if p["report_year"] == year]
    by_country = Counter(p["country"] or "Unspecified" for p in rows)
    by_city = Counter(p["city"] for p in rows)
    by_focus = Counter(p["focus_area"] for p in rows)
    return {
        "row_count": len(rows),
        "by_country": dict(sorted(by_country.items())),
        "by_focus": dict(sorted(by_focus.items())),
        "top_cities": [
            {"city": city, "projects": count}
            for city, count in by_city.most_common(12)
        ],
    }


def build() -> dict:
    projects: list[dict] = []
    for report in REPORTS:
        projects.extend(extract_project_rows(report))

    cities_by_year = {
        2018: 26,
        2023: 29,
        2024: 31,
        2025: 35,
        2026: 38,
    }
    country_count = {
        2018: 10,
        2026: 11,
    }
    latest = next(report for report in REPORTS if report["year"] == 2025)
    deltas = []
    for prev, curr in zip(REPORTS, REPORTS[1:]):
        deltas.append(
            {
                "from": prev["year"],
                "to": curr["year"],
                "project_delta": curr["total_projects"] - prev["total_projects"],
                "ongoing_delta": curr["status"]["ongoing"] - prev["status"]["ongoing"],
                "completed_delta": curr["status"]["completed"] - prev["status"]["completed"],
            }
        )

    focus_trends = defaultdict(dict)
    for report in REPORTS:
        for focus, value in report["focus_share"].items():
            focus_trends[focus][str(report["year"])] = value

    return {
        "metadata": {
            "title": "ASEAN Smart Cities Network V2 Analytics Dataset",
            "generated_from": "Official ASCN public reports downloaded into .tmp/ascn-sources",
            "generated_at": "2026-06-20",
            "raw_pdfs_committed": False,
            "notes": [
                "Rows extracted from PDF appendices may require manual cleanup where source tables wrap across lines.",
                "2022 and 2023 implementation counts are rounded estimates derived from published percentages.",
                "Personal contact-list details are not exposed in this public JSON; only document metadata is cited.",
            ],
        },
        "network": {
            "established": "2018-04-28",
            "framework_adopted": "2018-11-13",
            "founding_cities": 26,
            "latest_cities": 38,
            "latest_projects": latest["total_projects"],
            "latest_country_count": 11,
            "cities_by_year": cities_by_year,
            "country_count_by_year": country_count,
            "chairship": {
                "current_transition": "Malaysia 2025 to Philippines 2026",
                "next_focus": "ASCAP 2026-2035 implementation and local-government integration",
            },
        },
        "reports": REPORTS,
        "derived": {
            "project_deltas": deltas,
            "focus_trends": dict(sorted(focus_trends.items())),
            "appendix_summaries": {
                str(report["year"]): summarize_projects(projects, report["year"])
                for report in REPORTS
            },
        },
        "projects": projects,
        "sources": BASE_SOURCES
        + [
            {
                "title": report["title"],
                "kind": "pdf",
                "year": report["year"],
                "url": report["url"],
                "note": report["status_note"],
            }
            for report in REPORTS
        ],
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(), indent=2, ensure_ascii=True) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
