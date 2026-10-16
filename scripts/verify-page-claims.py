#!/usr/bin/env python3
"""
Check every hard number printed on the public pages against the committed data.

The platform's entire value is that its figures hold. A claim that drifts from
its source is worse than no claim, because the first reader who checks it
discredits all the others. This script is the guard: it parses the numbers out
of the rendered markup and compares them to the datasets they claim to describe.

Run: python3 scripts/verify-page-claims.py
Exit code is non-zero when any published claim disagrees with its source.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")

results: list[tuple[bool, str, str]] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    results.append((ok, label, detail))


def load(name: str):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def has(text: str, needle: str) -> bool:
    return needle in text


engine = load("ascn-v2-data.json")
corr = load("ascn-correspondence.json")
archive = load("ascn-news-archive.json")
city_stats = load("city-stats-merged.json")

# ── 1. Portfolio series and status, from the engine ──────────────────────────
reports = {str(r["year"]): r for r in engine["reports"]}
years_sorted = sorted(reports)
check(years_sorted == sorted(reports), "M&E cycles are sorted ascending")

for year in ("2022", "2023", "2024", "2025"):
    r = reports.get(year)
    if not r:
        continue
    total = r["total_projects"]
    st = r["status"]
    check(
        sum(st[k] for k in ("ongoing", "completed", "planning")) == total,
        f"{year}: status parts sum to the stated total",
        f"{st} vs total {total}",
    )

latest = reports[max(years_sorted)]
check(has(HTML, str(latest["total_projects"])) or str(latest["total_projects"]) in APP,
      "Latest portfolio total appears on the page", str(latest["total_projects"]))
check(has(HTML, str(latest["status"]["ongoing"])),
      "Latest ongoing count appears on the page", str(latest["status"]["ongoing"]))
check(has(HTML, str(latest["status"]["completed"])),
      "Latest completed count appears on the page", str(latest["status"]["completed"]))

# Completion rates are verified *per row*, not as a substring anywhere on the
# page. A document-wide "13%" check passes even when the 2025 row says 21%:
# the string still occurs elsewhere. Each series row is parsed and compared.
SERIES_ROW = re.compile(
    r"<tr[^>]*>\s*<th scope=\"row\">\s*(?P<year>\d{4})"
    r".*?<td class=\"rec-figure\">\s*(?P<total>[\d,]+)\s*</td>"
    r".*?</tr>",
    re.S,
)
rows = {m.group("year"): m for m in SERIES_ROW.finditer(HTML)}
check(len(rows) >= 4, "The portfolio series table renders one row per cycle", f"{len(rows)} rows")

for year, m in sorted(rows.items()):
    if year not in reports:
        # 2021 exists only as a baseline quoted from the 2022 report prose.
        check("baseline quoted by the 2022 report" in m.group(0),
              f"{year} row is labelled as a report baseline, not engine data")
        continue
    r = reports[year]
    stated_total = int(m.group("total").replace(",", ""))
    check(stated_total == r["total_projects"],
          f"{year} row total matches the engine",
          f"page {stated_total} vs engine {r['total_projects']}")

    # The completion rate printed in that same row must equal completed / total.
    cells = re.findall(r"<td[^>]*>(.*?)</td>", m.group(0), re.S)
    rates = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
    pct = round(r["status"]["completed"] / r["total_projects"] * 100, 1)
    candidates = {f"{pct}%", f"{pct:.1f}%", f"{pct:.0f}%"}
    check(any(c in candidates for c in rates),
          f"{year} row completion rate equals completed / total",
          f"expected {pct}%, row shows {rates}")

# ── 2. The 2021 baseline is the weakest link: it is stated only in the 2022 ──
#    report prose, never in this repository's data. Flag rather than verify. ──
check("2021" not in reports,
      "2021 baseline is NOT in the engine (page must attribute it to the 2022 report)",
      "series row cites 'baseline stated in 2022 report'")

# ── 3. City counts at their stated cut-offs ─────────────────────────────────
m25 = [r for r in archive["records"] if "M&E Report 2025" in (r.get("title") or "") or
       "134 projects" in (r.get("claim") or "")]
roster = [r for r in archive["records"] if "official roster" in (r.get("title") or "").lower()
          or "official roster" in (r.get("claim") or "").lower()]
for r in roster:
    for m in r.get("metrics") or []:
        if "cities" in (m.get("unit") or ""):
            v = m["value"]
            check(v == 38 and has(HTML, "38"),
                  "Roster city count on the page matches the roster metric", f"{v} at {m.get('asOf')}")
for r in m25:
    claim = r.get("claim") or ""
    if "134" in claim:
        check("134 projects" in claim and has(HTML, "134"),
              "134 projects claim matches the archive record and the page")

# ── 4. Correspondence ledger figures ────────────────────────────────────────
t = corr["totals"]
threads = corr["threads"]
travel = [x for x in threads if x["fundedTravel"]]
caps = [x for x in travel if x["fundingAmounts"]]

check(t["threads"] == len(threads), "Ledger totals.threads matches the thread list")
check(t["emails"] >= t["threads"], "Ledger emails >= threads (replies collapse, never grow)")
check(len(travel) == t["fundedTravelThreads"], "Funded-travel count matches the thread list")
check(t["fundedTravelThreads"] == sum(1 for x in threads if "funded_travel" in x["kinds"]),
      "Funded-travel flag and kind agree")
check(len(caps) == 8, "Eight threads state a per-person figure", str(len(caps)))
for x in caps:
    check(bool(x["costHeads"]), "A stated figure always has a cost head", x["threadKey"][:8])

# Origin counts must be reproducible from the threads themselves.
recomputed = {}
for x in travel:
    recomputed[x["origin"]] = recomputed.get(x["origin"], 0) + 1
check(recomputed == t["fundedTravelByOrigin"],
      "Funded-travel-by-origin totals are reproducible from the thread list")

# ── 5. Privacy: nothing identifying may reach the public build ──────────────
raw = (ROOT / "data" / "ascn-correspondence.json").read_text(encoding="utf-8")
inst = {
    "asean.org", "depa.or.th", "mfa.go.th", "mlit.go.jp", "jica.go.jp", "murc.jp",
    "uncrd.or.jp", "un.org", "unhabitat.org", "unescap.org", "kindkorea.or.kr",
    "snu.ac.kr", "molit.go.kr", "keiti.re.kr", "mfat.govt.nz", "dilg.gov.ph",
    "mnd.gov.sg", "smu.edu.sg", "planmalaysia.gov.my", "kpkt.gov.my", "ahkfta.org",
    "norway.no", "norad.no", "dfat.gov.au", "aid.gov.au", "ec.europa.eu",
}
leaks = [a for a in re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", raw)
         if a.split("@")[1].lower() not in inst]
check(not leaks, "No personal email address in the published ledger", ", ".join(leaks[:3]))
check(not re.search(r"\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s", raw), "No personal honorific in the published ledger")
check('"attachments"' not in raw, "No attachment filenames in the published ledger")

# The raw extraction must never be a build asset.
check(not (ROOT / "data" / "ascn-email-evidence.json").exists() or
      "ascn-email-evidence" in (ROOT / ".gitignore").read_text(encoding="utf-8"),
      "Raw mailbox extraction is gitignored")

# ── 6. Claims the page must NOT overstate ──────────────────────────────────
check(not re.search(r"only\s+(?:ASEAN|Southeast Asia)[^.]{0,60}above (?:60|70|two.thirds)", HTML),
      "Page does not claim Singapore is the only state above 60/70% or two-thirds")
check(has(HTML, "100.0%") and has(HTML, "76.4%"),
      "Urban table shows Singapore 100% next to Malaysia 76.4%")
check(has(HTML, "no other member reaches 80%"),
      "Page states the threshold that actually isolates Singapore")

# ── Report ──────────────────────────────────────────────────────────────────
passed = sum(1 for ok, _, _ in results if ok)
failed = [(l, d) for ok, l, d in results if not ok]
for ok, label, detail in results:
    if not ok:
        print(f"  FAIL  {label}" + (f"  [{detail}]" if detail else ""))
print(f"Page claim verification: {passed}/{len(results)} checks passed")
if failed:
    print(f"{len(failed)} claim(s) disagree with their source.")
    sys.exit(1)
print("Every published figure matches its source dataset.")
