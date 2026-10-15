#!/usr/bin/env python3
"""
Extract ASCN correspondence into a structured, countable evidence base.

Source: a folder of .eml files exported from a mailbox. Output:
data/ascn-email-evidence.json

Why this exists: the M&E reports state what a network says about itself. The
correspondence shows what was actually sent, to whom, by whom, and with whose
funding implied. That is the only place travel, invitations and training
offers are visible as first-hand records rather than as absences.

Thai handling: the mailbox declares charset "windows-874", which Python does
not know. The correct codec name is "cp874" (TIS-620/Windows-874 are the same
byte mapping). A first pass that used the declared name literally lost 53 of
458 bodies. Every part is therefore decoded through an explicit fallback chain
rather than trusting the declared name.
"""

from __future__ import annotations

import argparse
import email
import email.policy
import html
import json
import re
import sys
from email.utils import parseaddr
from datetime import datetime, timezone
from pathlib import Path

# Declared charset -> a codec Python actually has. Ordered by reliability.
CHARSET_ALIASES = {
    "windows-874": "cp874",
    "windows-874 ": "cp874",
    "tis-620": "cp874",
    "iso-8859-11": "cp874",
    "unicode-1-1-utf-7": "utf-7",
}
FALLBACK_CODECS = ("utf-8", "cp874", "tis-620", "latin-1")

TAG_RE = re.compile(r"(?is)<(script|style)[^>]*>.*?</\1>")
BR_RE = re.compile(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</h[1-6]>")


def decode_bytes(raw: bytes, declared: str | None) -> tuple[str, str]:
    """Decode with the declared charset, then fall back. Returns (text, codec)."""
    candidates: list[str] = []
    if declared:
        key = declared.strip().strip('"').lower()
        candidates.append(CHARSET_ALIASES.get(key, key))
    candidates.extend(c for c in FALLBACK_CODECS if c not in candidates)

    for codec in candidates:
        try:
            return raw.decode(codec), codec
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace"), "utf-8/replace"


def repair_mojibake(text: str) -> str:
    """
    Recover a header that was decoded with the wrong single-byte codec.

    Symptom: Thai in the subject renders as Latin-1 noise containing U+FFFD,
    which means UTF-8 bytes were read as a legacy charset. Undo by re-encoding
    through the same legacy codec and decoding as UTF-8. Best effort only.
    """
    if "\ufffd" not in text:
        return text
    for codec in ("cp874", "latin-1", "cp1252"):
        try:
            repaired = text.encode(codec, errors="strict").decode("utf-8", errors="strict")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if "\ufffd" not in repaired:
            return repaired
    # Lossy round-trip: keeps whatever is already valid UTF-8, drops the rest.
    for codec in ("cp874", "latin-1"):
        try:
            repaired = text.encode(codec, errors="replace").decode("utf-8", errors="replace")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if repaired.count("\ufffd") < text.count("\ufffd"):
            return repaired
    return text


def strip_html(raw: str) -> str:
    text = TAG_RE.sub(" ", raw)
    text = BR_RE.sub("\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def collect_text(msg) -> tuple[str, list[str]]:
    """Gather readable body text across multipart messages."""
    plain_parts: list[str] = []
    html_parts: list[str] = []
    attachments: list[str] = []

    for part in msg.walk():
        if part.is_multipart():
            continue
        disposition = str(part.get("Content-Disposition") or "").lower()
        ctype = part.get_content_type()

        if "attachment" in disposition or (part.get_filename() and "inline" not in disposition):
            name = part.get_filename()
            if name:
                attachments.append(str(name))
            continue

        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        text, _ = decode_bytes(payload, part.get_content_charset())
        if ctype == "text/html":
            html_parts.append(text)
        elif ctype == "text/plain":
            plain_parts.append(text)
        elif part.get_filename():
            attachments.append(str(part.get_filename()))

    if plain_parts:
        body = "\n\n".join(plain_parts)
    elif html_parts:
        body = strip_html("\n".join(html_parts))
    else:
        body = ""
    return body.strip(), attachments


def parse_date(raw) -> str | None:
    if not raw:
        return None
    try:
        dt = email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError, IndexError):
        return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def split_addresses(raw) -> list[str]:
    if not raw:
        return []
    out = []
    for chunk in str(raw).split(","):
        name, addr = parseaddr(chunk)
        value = addr or name or chunk.strip()
        if value:
            out.append(value)
    return out


def clean_header(raw) -> str:
    if raw is None:
        return ""
    text = str(raw)
    try:
        text = str(email.header.make_header(email.header.decode_header(text)))
    except (UnicodeDecodeError, LookupError, ValueError):
        pass
    return repair_mojibake(text).replace("\t", " ").strip()


def extract_file(path: Path) -> dict:
    raw = path.read_bytes()
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    body, attachments = collect_text(msg)

    sender_name, sender_addr = parseaddr(clean_header(msg.get("From")))

    return {
        "file": path.name,
        "from": sender_addr or sender_name,
        "fromName": sender_name or "",
        "to": split_addresses(clean_header(msg.get("To"))),
        "cc": split_addresses(clean_header(msg.get("Cc"))),
        "date": parse_date(msg.get("Date")),
        "subject": clean_header(msg.get("Subject")),
        "attachments": attachments,
        "bodyChars": len(body),
        "body": body,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("source", type=Path, help="folder of .eml files")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("data/ascn-email-evidence.json"),
        help="output JSON path",
    )
    args = ap.parse_args()

    files = sorted(args.source.glob("*.eml"))
    if not files:
        print(f"error: no .eml files in {args.source}", file=sys.stderr)
        return 1

    records = [extract_file(p) for p in files]
    records.sort(key=lambda r: (r.get("date") or "", r["file"]))

    dated = [r for r in records if r.get("date")]
    years: dict[str, int] = {}
    for r in dated:
        years[r["date"][:4]] = years.get(r["date"][:4], 0) + 1

    payload = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "kind": "mailto-export",
            "scope": (
                "One ASCN participant's received correspondence. This is a primary "
                "record of what the network sends, invites and funds, as seen by a "
                "single member-state official. It is a witness record, not a census: "
                "it cannot show activity the recipient was not copied on."
            ),
            "count": len(records),
            "dateFrom": dated[0]["date"][:10] if dated else None,
            "dateTo": dated[-1]["date"][:10] if dated else None,
            "byYear": dict(sorted(years.items())),
            "totalAttachments": sum(len(r["attachments"]) for r in records),
        },
        "records": records,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    bodies = sum(1 for r in records if r["bodyChars"] > 0)
    print(f"extracted {len(records)} emails -> {args.out}")
    print(f"  with body text : {bodies}")
    print(f"  dated          : {len(dated)}")
    print(f"  attachments    : {payload['source']['totalAttachments']}")
    print(f"  span           : {payload['source']['dateFrom']} .. {payload['source']['dateTo']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
