#!/usr/bin/env python3
"""
Classify ASCN correspondence into countable evidence.

Input : data/ascn-email-evidence.json  (from extract_ascn_emails.py)
Output: data/ascn-correspondence.json

Group messages by normalised subject and index cost-related keywords. The
fundedTravel field is retained for schema compatibility; it is an unreviewed
candidate flag. A hotel or airfare mention does not establish an offer, an
accepted subsidy, or completed travel. Subject groups are not unique events.
The source is one official's mailbox and is never a network-wide total.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ── Thread normalisation ─────────────────────────────────────────────────────
REPLY_PREFIX = re.compile(
    r"^\s*(?:re|fw|fwd|ตอบกลับ|回复|轉寄|forward)\s*(?:\[\d+\])?\s*[:：]\s*",
    re.IGNORECASE,
)
# Re: chains repeat; strip until stable.
CHAIN_MARK = re.compile(r"\[(?:[^\]]*?)\]\s*$", re.IGNORECASE)


def normalise_subject(subject: str) -> str:
    text = subject or ""
    for _ in range(8):
        before = text
        text = REPLY_PREFIX.sub("", text)
        # "[ASCN] Foo" -> "Foo" is handled below; here only strip reply marks.
        if text == before:
            break
    text = re.sub(r"\s+", " ", text).strip(" -–—:;,")
    return text.lower()


def strip_tags(subject: str) -> str:
    """Remove leading list tags like [ASCN] / [ASCN Phuket] for grouping."""
    return re.sub(r"^\s*(?:\[[^\]]{1,40}\]\s*)+", "", subject or "").strip()


# ── Evidence patterns ────────────────────────────────────────────────────────
# Broad cost-related keywords for candidate retrieval. Source review is
# required before describing any match as a funding offer.
COST_PATTERNS = [
    ("airfare", r"\bair\s?fare\b|\bair\s?ticket\b|\breturn\s+economy\b|\bflights?\s+(?:are|will be|shall be)\s+cover"),
    ("accommodation", r"\baccommodation\b|\bhotel\b|\b(?:stay|lodging)\s+(?:is|will be|shall be)\s+(?:cover|provided|arranged)"),
    ("per_diem", r"\bper\s?diem\b|\bdaily\s+allowance\b|\bmeal[s]?\s+(?:and|are)\s+(?:provided|covered)"),
    ("local_transport", r"\bland\s+transportation\b|\bfield\s+trip\b|\bground\s+transport"),
    ("fee_waived", r"\b(?:registration|participation)\s+fee\s+(?:is\s+|will\s+be\s+)?(?:waived|covered|free)\b|\bfree\s+of\s+charge\b|\bat\s+no\s+cost\b"),
    ("fully_funded", r"\bfully[- ]funded\b|\bfunded\s+by\b|\bsponsored\s+by\b|\bunder\s+the\s+auspices\s+of\b"),
]

# A concrete amount attached to a cost head. Captured verbatim, never parsed.
# Requires an explicit currency token OR a magnitude of at least 50, because a
# bare integer followed by "each"/"per person" is almost always a list ordinal
# or a page number rather than a funding cap.
MONEY_RE = re.compile(
    r"(?:(?P<cur>US\$|USD|SGD|EUR|JPY|THB|RM|MYR|₱|PHP)\s*)?"
    r"(?P<amt>\d{1,3}(?:,\d{3})*(?:\.\d+)?)"
    r"(?:\s*(?P<unit>USD|US\$|SGD|EUR|JPY|dollars?))?"
    r"[^.]{0,60}?\b(?:per\s+(?:person|participant|delegation|pax|head|delegates?)|/\s*person|each)\b",
    re.IGNORECASE,
)

FUNDER_HINTS = [
    ("Norway", r"\bNorway\b|\bNorwegian\b|\bASEAN-Norway\b"),
    ("Japan (MLIT)", r"\bMLIT\b|Ministry of Land, Infrastructure|\bJICA\b|\bSmartJAMP\b|\bASEAN-Japan\b"),
    ("Malaysia", r"\bPLANMalaysia\b|\bMalaysia\b"),
    ("Korea", r"\bKorea\b|\bKIND\b|\bASPP\b|\bMOLIT\b"),
    ("Australia", r"\bAustralia\b|\bAus4ASEAN\b|\bAASCTF\b"),
    ("European Union", r"\bEuropean Union\b|\bEU\b.*\b(?:Smart Green|SGAC)"),
    ("ADB", r"\bADB\b|Asian Development Bank"),
    ("UN / UN-Habitat", r"\bUN-Habitat\b|\bUnited Nations\b|\bUNCRD\b|\bUNESCAP\b"),
    ("APEC", r"\bAPEC\b"),
    ("Hong Kong", r"\bHong Kong\b|\bAHKFTA\b"),
    ("New Zealand", r"\bNew Zealand\b"),
    ("Singapore", r"\bSingapore\b"),
]

EVENT_KINDS = [
    ("annual_meeting", r"annual\s+(?:smart\s+cities\s+)?(?:network\s+)?meeting|\bASCN\s*\d+\b"),
    ("high_level_meeting", r"high[- ]level\s+meeting|\bHLM\b"),
    ("forum", r"\bforum\b|\bASUF\b|sustainable\s+urbanisation\s+forum"),
    ("workshop", r"\bworkshop\b|\bexpert\s+talk\b|\bsocialisation\b|\bconference\b|\bsummit\b"),
    ("expo", r"\bexpo\b|\bshowcase\b|\bexhibition\b"),
]

TRAINING_PATTERNS = [
    ("scholarship", r"\bscholarship\b|\bmaster'?s\b|\bdegree\b|\bfee\s+waiver\b"),
    ("short_term_training", r"short[- ]term\s+training|\btraining\s+programme?\b|\bASPP\b"),
    ("capacity_building", r"capacity\s+building|\bASUS\b|city\s+leaders?\s+training|\bTA\b.*\bprogramme"),
]

MONITORING_PATTERNS = [
    ("me_report", r"monitoring\s*(?:&|and)\s*evaluation|\bM&E\b|\bME\s+Report\b"),
    ("data_request", r"\bKPI\b|\brequest\s+for\s+data\b|\bquestionnaire\b|\bdata\s+submission\b|report\s+form"),
]

AGREEMENT_PATTERNS = [
    ("mou", r"\bMoU\b|memorandum\s+of\s+understanding|\bMOU\b"),
    ("endorsement", r"seek\s+endorsement|\bendorsement\b|\bsignature\b|\bsign(ed|atory)\b"),
    ("joint_statement", r"joint\s+statement|leaders'? statement|chair'?s?\s+statement|communi"),
]

# Origin attribution. Who SENT the mail is a precise signal; who is MENTIONED
# inside it is not, because a single newsletter names every partner. Every
# count in the presentation uses this field, never the in-text funder list.
ORIGIN_DOMAINS = [
    ("ASEAN Secretariat", ("asean.org",)),
    ("Thailand (depa / MDES)", ("depa.or.th", "mfa.go.th", "md.go.th", "dopa.go.th")),
    ("Japan (MLIT / JICA / MURC / UNCRD)", ("mlit.go.jp", "jica.go.jp", "murc.jp", "uncrd.or.jp", "mLit.go.jp")),
    ("Malaysia (PLANMalaysia / KPKT)", ("planmalaysia.gov.my", "kpkt.gov.my", "mybis.gov.my")),
    ("South Korea (KIND / SNU / MOLIT)", ("kindkorea.or.kr", "snu.ac.kr", "molit.go.kr", "keiti.re.kr")),
    ("New Zealand (MFAT)", ("mfat.govt.nz",)),
    ("Philippines (DILG)", ("dilg.gov.ph",)),
    ("Singapore", ("smu.edu.sg", "mnd.gov.sg", "smartnation.gov.sg")),
    ("United Nations", ("un.org", "unhabitat.org", "unescap.org")),
    ("Hong Kong", ("ahkfta.org",)),
    ("Norway", ("norway.no", "norad.no")),
    ("Australia", ("dfat.gov.au", "aid.gov.au")),
    ("European Union", ("ec.europa.eu", "europa.eu")),
    ("Japan (other)", ("japan.go.jp", "mofa.go.jp")),
    ("Vietnam", ("mard.gov.vn", "mic.gov.vn")),
    ("Indonesia", ("bpkpm.go.id", "kemenpu.go.id")),
    ("India", ("gov.in",)),
    ("LinkedIn / newsletter relays", ("linkedin.com",)),
    ("GitHub notifications", ("github.com",)),
    ("File transfer relays", ("wetransfer.com", "google.com", "yahoo.com", "gmail.com", "hotmail.com")),
]

# ── Redaction ────────────────────────────────────────────────────────────────
# This platform carries a PDPA commitment in its footer. The evidence value of
# correspondence is organisational: who sent it, when, what was offered, and the
# exact wording. It does not require the names or addresses of the individuals
# who happened to be copied. Personal identifiers are therefore stripped from
# everything that leaves this script, and the raw file stays gitignored.
NAME_IN_SUBJECT = re.compile(
    r"\[(?:[^\]]*?)(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)?\s*"
    r"(?!ASCN|Smart|K-City|AIF|APEC|ASUF|AGMF|DSA|SCSNA)[A-Z][a-z]+\s+[A-Z][a-z]+[^\]]*\]"
)
HONORIFIC = re.compile(r"\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+)?)")
THAI_NAME = re.compile(r"(?:คุณ|ดร\.?|น\.)\s*[ก-ฮ][ก-ฮะ-ู]*\s*[ก-ฮ][ก-ฮะ-ู]*")
# "<Given> san" is a Thai surname written capitalised-lowercase and slips past
# the two-capitalised-words rule entirely.
THAI_SURNAME = re.compile(r"\b[A-Z][a-z]{2,}\s+(?:san|sri|daeng|chai|wat|kaew|moo)\b")
EMAIL_IN_TEXT = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")


def redact(text):
    """Remove personal identifiers while preserving institutional meaning."""
    if not text:
        return text
    out = EMAIL_IN_TEXT.sub("[address withheld]", text)
    out = HONORIFIC.sub("[name withheld]", out)
    out = THAI_NAME.sub("[name withheld]", out)
    out = THAI_SURNAME.sub("[name withheld]", out)
    out = NAME_IN_SUBJECT.sub("", out)
    return re.sub(r"\s+", " ", out).strip()


def compile_rules(pairs):
    return [(name, re.compile(pat, re.IGNORECASE)) for name, pat in pairs]


COST_RULES = compile_rules(COST_PATTERNS)
MONEY_RULE = re.compile(MONEY_RE.pattern, re.IGNORECASE)
FUNDER_RULES = compile_rules(FUNDER_HINTS)
EVENT_RULES = compile_rules(EVENT_KINDS)
TRAINING_RULES = compile_rules(TRAINING_PATTERNS)
MONITORING_RULES = compile_rules(MONITORING_PATTERNS)
AGREEMENT_RULES = compile_rules(AGREEMENT_PATTERNS)


def match_all(rules, text):
    return [name for name, rx in rules if rx.search(text)]


def detect_funders(text):
    return [name for name, rx in FUNDER_RULES if rx.search(text)]


RELAY_ORIGINS = {"File transfer relays", "GitHub notifications", "LinkedIn / newsletter relays", "Other / personal"}


def detect_origin(domains):
    """
    Map sender domains to a partner.

    Forwarded threads begin at the recipient's own mail relay, so a relay or
    notification domain must not win attribution. Prefer the first genuine
    institution; fall back to whatever is present rather than guessing.
    """
    matched = []
    for domain in domains:
        d = (domain or "").lower()
        for name, patterns in ORIGIN_DOMAINS:
            if any(d == p or d.endswith("." + p) for p in patterns):
                matched.append(name)
                break
    for name in matched:
        if name not in RELAY_ORIGINS:
            return name
    return matched[0] if matched else "Other / personal"


def detect_money(text):
    """
    Capture verbatim per-person / per-delegation caps.

    A match needs an explicit currency token, or a magnitude of at least 50.
    Without that guard the pattern fires on list ordinals ("2 ... each") and
    inflates the headline count, which is the one number this dataset must not
    get wrong.
    """
    hits = []
    for m in MONEY_RULE.finditer(text):
        amt_raw = (m.group("amt") or "").replace(",", "")
        if not amt_raw:
            continue
        try:
            amt = float(amt_raw)
        except ValueError:
            continue
        cur = (m.group("cur") or m.group("unit") or "").strip()
        if not cur and amt < 50:
            continue
        label = f"{cur}{amt_raw}" if cur else f"{amt_raw} (unit unstated)"
        hits.append(label)
    seen, out = set(), []
    for h in hits:
        if h not in seen:
            seen.add(h)
            out.append(h)
    return out[:4]


def window(text, needle_re, width=170):
    m = re.search(needle_re, text, re.IGNORECASE | re.S)
    if not m:
        return None
    start = max(0, m.start() - width // 2)
    return " ".join(text[start : m.end() + width // 2].split())


def classify(record):
    text = f"{record.get('subject','')}\n{record.get('body','')}"
    costs = match_all(COST_RULES, text)
    money = detect_money(text)
    funders = detect_funders(text)
    kinds = []

    ev = match_all(EVENT_RULES, text)
    tr = match_all(TRAINING_RULES, text)
    mo = match_all(MONITORING_RULES, text)
    ag = match_all(AGREEMENT_RULES, text)

    if ev:
        kinds.append("event")
    if tr:
        kinds.append("training")
    if mo:
        kinds.append("monitoring")
    if ag:
        kinds.append("agreement")
    if costs or money:
        kinds.append("funded_travel")

    return {
        "costs": costs,
        "money": money,
        "funders": funders,
        "eventKinds": ev,
        "trainingKinds": tr,
        "monitoringKinds": mo,
        "agreementKinds": ag,
        "kinds": kinds,
        "fundedTravel": bool(costs),
        "fundingQuote": window(text, r"per\s+diem|daily\s+allowance|air\s?fare|air\s?ticket|free\s+of\s+charge|at\s+no\s+cost|fully[- ]funded|flights?\s+(?:are|will be|shall be)\s+cover|cover(?:ed)?\s+the\s+(?:flights|costs)|cover\s+accommodation"),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: classify_ascn_emails.py data/ascn-email-evidence.json", file=sys.stderr)
        return 1
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("data/ascn-correspondence.json")

    data = json.loads(src.read_text(encoding="utf-8"))
    records = data["records"]

    # Group replies into threads keyed by the normalised subject.
    threads: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        threads[normalise_subject(r.get("subject", ""))].append(r)

    thread_rows = []
    for key, msgs in threads.items():
        msgs.sort(key=lambda m: m.get("date") or "")
        head = msgs[0]
        classified = [classify(m) for m in msgs]

        # Merge evidence across the thread: an offer in one reply and the reply
        # that answers it are one event, not two.
        costs, money, funders, ev, tr, mo, ag = [], [], [], [], [], [], []
        for c in classified:
            costs += c["costs"]
            money += c["money"]
            funders += c["funders"]
            ev += c["eventKinds"]
            tr += c["trainingKinds"]
            mo += c["monitoringKinds"]
            ag += c["agreementKinds"]
        dedupe = lambda xs: list(dict.fromkeys(xs))  # noqa: E731
        costs, funders = dedupe(costs), dedupe(funders)
        money = dedupe(money) if costs else []
        ev, tr, mo, ag = dedupe(ev), dedupe(tr), dedupe(mo), dedupe(ag)

        kinds = []
        if ev:
            kinds.append("event")
        if tr:
            kinds.append("training")
        if mo:
            kinds.append("monitoring")
        if ag:
            kinds.append("agreement")
        if costs:
            kinds.append("funded_travel")
        if not kinds:
            # No category matched. Recorded explicitly rather than dropped, so
            # classifier coverage is a visible number instead of a hidden gap.
            kinds.append("other")

        senders = dedupe([m["from"] for m in msgs if m.get("from")])
        sender_domains = dedupe(
            [re.search(r"@([\w.-]+)", s).group(1).lower() for s in senders if re.search(r"@([\w.-]+)", s)]
        )

        thread_rows.append({
            "threadKey": hashlib.sha256(key.encode("utf-8")).hexdigest()[:16],
            "subject": redact(head.get("subject", "")),
            "subjectClean": redact(strip_tags(head.get("subject", ""))),
            "date": head.get("date"),
            "dateLast": msgs[-1].get("date"),
            "messages": len(msgs),
            "senderDomains": sender_domains[:8],
            "origin": detect_origin(sender_domains),

            "kinds": kinds,
            "fundedTravel": bool(costs),
            "costHeads": costs,
            "fundingAmounts": money,
            "funders": funders,
            "eventKinds": ev,
            "trainingKinds": tr,
            "monitoringKinds": mo,
            "agreementKinds": ag,
            "attachmentCount": len(dedupe([a for m in msgs for a in (m.get("attachments") or [])])),
            "messageFiles": len(msgs),
            "fundingQuote": redact(next((c["fundingQuote"] for c in classified if c["fundingQuote"]), None) or "") or None,
        })

    thread_rows.sort(key=lambda t: (t.get("date") or "", t["subject"]))

    travel_threads = [t for t in thread_rows if t["fundedTravel"]]
    by_year = Counter(t["date"][:4] for t in thread_rows if t.get("date"))
    kind_counts = Counter(k for t in thread_rows for k in t["kinds"])
    funder_counts = Counter(f for t in thread_rows for f in t["funders"])
    host_counts = Counter(d for t in thread_rows for d in t["senderDomains"])
    origin_counts = Counter(t["origin"] for t in thread_rows)
    travel_origin = Counter(t["origin"] for t in travel_threads)
    travel_by_year = Counter(t["date"][:4] for t in travel_threads if t.get("date"))

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": {
            "unit": "A thread groups messages with the same normalised subject. Replies are collapsed; distinct events may share a subject and one event may use several subjects.",
            "fundedTravel": "Automated candidate flag: a thread contains a cost-related keyword such as airfare, hotel or per diem. These matches require source review; they do not establish a funding offer, acceptance, expenditure or completed travel.",
            "fundingAmounts": "Captured verbatim where a per-person or per-delegation "
                              "figure is stated. Never inferred, converted or rounded.",
            "limitation": "This is one member-state official's received mailbox. It is a "
                          "witness record of what was offered to that official. It cannot "
                          "establish what was offered to other officials, and must not be "
                          "presented as a network-wide total.",
        },
        "totals": {
            "emails": len(records),
            "threads": len(thread_rows),
            "threadsByKind": dict(sorted(kind_counts.items(), key=lambda kv: -kv[1])),
            "unclassifiedThreads": kind_counts.get("other", 0),
            "threadsByYear": dict(sorted(by_year.items())),
            "fundedTravelThreads": len(travel_threads),
            "fundedTravelByYear": dict(sorted(travel_by_year.items())),
            "fundersMentioned": dict(funder_counts.most_common()),
            "originatingDomains": dict(host_counts.most_common(20)),
            "originByPartner": dict(origin_counts.most_common()),
            "fundedTravelByOrigin": dict(travel_origin.most_common()),
            "correspondenceSpan": [
                next((t["date"] for t in thread_rows if t.get("date")), None),
                next((t["date"] for t in reversed(thread_rows) if t.get("date")), None),
            ],
        },
        "threads": thread_rows,
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    t = payload["totals"]
    print(f"classified {t['emails']} emails -> {t['threads']} threads -> {out}")
    print(f"  kinds            : {t['threadsByKind']}")
    print(f"  cost candidates  : {t['fundedTravelThreads']} threads  {t['fundedTravelByYear']}")
    print(f"  funders mentioned: {t['fundersMentioned']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
