#!/usr/bin/env python3
"""Build a report-only Markdown job summary from Semgrep and Trivy SARIF.

Secret findings are recorded as file:line and rule id only. Matched values are
removed from the summary and from the SARIF files before they are uploaded.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN")
TOP_LIMIT = 20
SECRET_NOTE = "value omitted"

# Values that must never be copied into the summary or the uploaded SARIF.
VALUE_RE = re.compile(
    r"("
    r"AKIA[0-9A-Z]{16}"
    r"|ASIA[0-9A-Z]{16}"
    r"|-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"
    r"|ghp_[A-Za-z0-9]{20,}"
    r"|github_pat_[A-Za-z0-9_]{20,}"
    r"|xox[baprs]-[A-Za-z0-9-]{10,}"
    r"|sk_live_[A-Za-z0-9]{10,}"
    r")"
)
SECRET_RULE_RE = re.compile(
    r"(secret|private[-_]?key|private[-_]?key|credential|aws-access-key|github-pat)",
    re.IGNORECASE,
)
REDACTED_MESSAGE = (
    "Potential committed secret. The matched value was removed before upload."
)


def tool_name(path: Path, data: dict) -> str:
    driver = (((data.get("runs") or [{}])[0].get("tool") or {}).get("driver") or {})
    name = str(driver.get("name") or "")
    if "semgrep" in name.lower() or "semgrep" in path.name.lower():
        return "Semgrep"
    if "trivy" in name.lower() or "trivy" in path.name.lower():
        return "Trivy"
    return name or path.name


def rules_by_id(run: dict) -> dict:
    driver = ((run.get("tool") or {}).get("driver") or {})
    found = {}
    for rule in driver.get("rules") or []:
        rule_id = rule.get("id")
        if rule_id and rule_id not in found:
            found[rule_id] = rule
    return found


def tags_of(rule: dict) -> list[str]:
    raw = ((rule.get("properties") or {}).get("tags") or [])
    return [str(tag) for tag in raw]


def is_secret(result: dict, rule: dict) -> bool:
    rule_id = str(result.get("ruleId") or "")
    if SECRET_RULE_RE.search(rule_id):
        return True
    for tag in tags_of(rule):
        # "security" does not contain "secret".
        if "secret" in tag.lower():
            return True
    message = str(((result.get("message") or {}).get("text")) or "")
    if "\nMatch:" in message or message.startswith("Match:"):
        return True
    blob = json.dumps({"message": result.get("message"), "locations": result.get("locations")}, ensure_ascii=False)
    if VALUE_RE.search(blob):
        return True
    return False


def severity_of(result: dict, rule: dict) -> str:
    for tag in tags_of(rule):
        upper = tag.upper()
        if upper in SEVERITIES:
            return upper
    score = (rule.get("properties") or {}).get("security-severity")
    if score is not None and str(score) != "":
        try:
            value = float(score)
        except (TypeError, ValueError):
            value = None
        if value is not None:
            if value >= 9.0:
                return "CRITICAL"
            if value >= 7.0:
                return "HIGH"
            if value >= 4.0:
                return "MEDIUM"
            if value > 0:
                return "LOW"
            return "UNKNOWN"
    level = str(result.get("level") or (rule.get("defaultConfiguration") or {}).get("level") or "").lower()
    return {"error": "HIGH", "warning": "MEDIUM", "note": "LOW", "none": "UNKNOWN"}.get(level, "UNKNOWN")


def location_of(result: dict) -> str:
    locations = result.get("locations") or []
    if not locations:
        return "unknown"
    physical = (locations[0].get("physicalLocation") or {})
    artifact = physical.get("artifactLocation") or {}
    uri = str(artifact.get("uri") or "unknown").replace("\\", "/")
    if uri.startswith("file://"):
        uri = uri[7:]
    for prefix in ("/workspace/", "workspace/"):
        if uri.startswith(prefix):
            uri = uri[len(prefix):]
    # Trivy may emit an absolute path inside the runner checkout.
    marker = "/github/workspace/"
    if marker in uri:
        uri = uri.split(marker, 1)[1]
    line = (physical.get("region") or {}).get("startLine")
    if line:
        return f"{uri}:{line}"
    return uri


def one_line(text: str, limit: int = 180) -> str:
    collapsed = re.sub(r"\s+", " ", text).strip()
    if len(collapsed) > limit:
        return collapsed[: limit - 1] + "…"
    return collapsed


def markdown_cell(text: str) -> str:
    return one_line(text).replace("|", "\\|")


def redact_secret_result(result: dict) -> None:
    result["message"] = {"text": REDACTED_MESSAGE}
    result.pop("properties", None)
    for key in ("codeFlows", "stacks", "relatedLocations", "attachments", "graphs", "fixes"):
        result.pop(key, None)
    for location in result.get("locations") or []:
        physical = location.get("physicalLocation") or {}
        region = physical.get("region") or {}
        region.pop("snippet", None)
        if "region" in physical:
            physical["region"] = region


def redact_secret_rule(rule: dict) -> None:
    if not rule:
        return
    rule["fullDescription"] = {"text": REDACTED_MESSAGE}
    rule["help"] = {"text": REDACTED_MESSAGE, "markdown": REDACTED_MESSAGE}
    short = str(((rule.get("shortDescription") or {}).get("text")) or "")
    if VALUE_RE.search(short) or "Match:" in short:
        rule["shortDescription"] = {"text": "Secret rule"}
    properties = rule.get("properties") or {}
    kept = {}
    for key in ("tags", "precision", "security-severity"):
        if key in properties:
            kept[key] = properties[key]
    rule["properties"] = kept


def load_sarif(path: Path) -> tuple[dict | None, str | None]:
    if not path.is_file():
        return None, f"{path.name} was not produced."
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return None, f"{path.name} is not valid JSON ({exc})."
    if not isinstance(data, dict) or "runs" not in data:
        return None, f"{path.name} is not a SARIF document."
    return data, None


def collect(path: Path, data: dict) -> tuple[str, Counter, list[dict]]:
    name = tool_name(path, data)
    counts: Counter = Counter()
    findings = []
    for run in data.get("runs") or []:
        rules = rules_by_id(run)
        rule_list = ((run.get("tool") or {}).get("driver") or {}).get("rules") or []
        for result in run.get("results") or []:
            rule = rules.get(result.get("ruleId") or "")
            if rule is None and isinstance(result.get("ruleIndex"), int):
                index = result["ruleIndex"]
                if 0 <= index < len(rule_list):
                    rule = rule_list[index]
            rule = rule or {}
            secret = is_secret(result, rule)
            if secret:
                redact_secret_result(result)
                redact_secret_rule(rule)
            severity = severity_of(result, rule)
            counts[severity] += 1
            message = "" if secret else str(((result.get("message") or {}).get("text")) or "")
            findings.append(
                {
                    "tool": name,
                    "severity": severity,
                    "location": location_of(result),
                    "rule": str(result.get("ruleId") or "unknown"),
                    "secret": secret,
                    "notes": SECRET_NOTE if secret else one_line(message),
                }
            )
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return name, counts, findings


def render(rows: list[tuple[str, Counter, list[dict], str | None]]) -> str:
    names = [name for name, _, _, error in rows if error is None]
    # Stable column order for the two expected tools, then anything else.
    preferred = [name for name in ("Semgrep", "Trivy") if name in names]
    extra = [name for name in names if name not in preferred]
    columns = preferred + extra
    lines = [
        "## Security scan (report only)",
        "",
        "Findings are reported for review. This job stays green whether or not scanners report issues.",
        "",
        "### Counts by severity",
        "",
    ]
    if not columns:
        lines.append("No SARIF results were available.")
        lines.append("")
    else:
        header = "| Severity | " + " | ".join(columns) + " | Total |"
        rule = "| --- | " + " | ".join("---:" for _ in columns) + " | ---: |"
        lines.extend([header, rule])
        for severity in SEVERITIES:
            cells = []
            total = 0
            for name in columns:
                count = next(counts[severity] for tool, counts, _, error in rows if tool == name and error is None)
                cells.append(str(count))
                total += count
            lines.append("| " + " | ".join([severity, *cells, str(total)]) + " |")
        lines.append("")

    lines.extend(["### Critical and high findings", ""])
    ranked = []
    for _, _, findings, error in rows:
        if error:
            continue
        for finding in findings:
            if finding["severity"] in ("CRITICAL", "HIGH"):
                ranked.append(finding)
    rank = {"CRITICAL": 0, "HIGH": 1}
    ranked.sort(key=lambda item: (rank[item["severity"]], item["tool"], item["location"], item["rule"]))
    if not ranked:
        lines.append("No critical or high findings.")
        lines.append("")
    else:
        lines.extend(
            [
                "| Tool | Severity | Location | Rule | Notes |",
                "| --- | --- | --- | --- | --- |",
            ]
        )
        for finding in ranked[:TOP_LIMIT]:
            notes = SECRET_NOTE if finding["secret"] else finding["notes"]
            lines.append(
                "| "
                + " | ".join(
                    [
                        markdown_cell(finding["tool"]),
                        finding["severity"],
                        markdown_cell(finding["location"]),
                        markdown_cell(finding["rule"]),
                        markdown_cell(notes),
                    ]
                )
                + " |"
            )
        if len(ranked) > TOP_LIMIT:
            lines.append("")
            lines.append(f"{len(ranked) - TOP_LIMIT} more critical or high findings were omitted from this list.")
        lines.append("")

    lines.append(
        "Secret matches are listed as file:line and rule id only. Matched values are omitted from this summary and removed from the SARIF uploaded to code scanning."
    )
    lines.append("")
    problems = [f"{name}: {error}" for name, _, _, error in rows if error]
    if problems:
        lines.append("### Scan output")
        lines.append("")
        for problem in problems:
            lines.append(f"- {problem}")
        lines.append("")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    paths = [Path(arg) for arg in argv[1:]] or [Path("semgrep.sarif"), Path("trivy.sarif")]
    rows = []
    for path in paths:
        data, error = load_sarif(path)
        if error or data is None:
            rows.append((path.name, Counter(), [], error or "unreadable"))
            continue
        name, counts, findings = collect(path, data)
        rows.append((name, counts, findings, None))
    summary = render(rows)
    destination = os.environ.get("GITHUB_STEP_SUMMARY")
    if destination:
        with open(destination, "a", encoding="utf-8") as handle:
            handle.write(summary)
            if not summary.endswith("\n"):
                handle.write("\n")
    else:
        sys.stdout.write(summary)
    print(f"Wrote security summary for {len(paths)} report(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
