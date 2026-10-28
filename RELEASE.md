# Release the observatory

Use the same path for a data update and an interface change:

```sh
npm run check:release
npm run deploy
```

`check:release` audits dependencies and validates design, datasets, units and the finished public artifact,
then starts a fresh local Pages preview. It runs the browser suite, strict spatial
audit, visual captures and complete reading-path captures in sequence against that build. A failed step stops
the release. `deploy` runs this gate again after refreshing discovery, uploads
only on success, then verifies exact live bytes and no-store 404 responses for
private paths. CI runs the same pre-upload checks.

The browser suite includes an intercepted dataset with 220 additional projects,
long prose and an unbroken title token. It verifies complete table rows, matching
filtered CSV, contained horizontal scrolling, repeated language changes, delayed
report loading and keyboard access to a short-height contents rail. These
fixtures stay local to tests; they never become public data.

Decision-geometry tests also cover filtered News question counts 0–6, responsive
neighbors, localized route names, and compact News/Innovation task regions.
Negative controls restore each old oversized layout locally and must fail the
same budget. Filtered spatial captures must show the selected city and expected
question count; hidden or failed selections cannot count as evidence.

Review the local evidence before a visual release:

- `artifacts/release/checks.json`: completed automated steps and failures.
- `artifacts/sh/release/`: all 19 routes at 360, 390, 1024, 1440, 1920 and 2103px,
  with chrome, first-screen task, geometry and preservation measurements.
- `artifacts/release/reading-sweep/`: overlapping real scroll frames for every route
  at 1440×900, 1024×768 and 390×844. The capture waits for populated report data;
  a failed/incomplete run cannot mark `status.json` complete. Review the lower
  bodies and onward bands as well as the first screens.
- `artifacts/release/views/`: 19 routes at 1440, 1024 and 390px, plus three expanded source records, with geographic
  tiles loaded on both maps. News captures exercise the saved-data fallback;
  separate browser tests exercise live refresh and outages.

A numerical pass is evidence for its assertions, not visual approval. Apply all
seven rules in DESIGN-ANTI-SLOP.md and the reading/action test in DESIGN-MSH.md.
Record every hit, fix it, re-capture, and have an independent reviewer inspect
the actual screenshots. Keep screenshots local. Confirm live map selection,
project filters/export, source records and navigation after upload.

## When data changes

Check the public source and its cut-off first. Keep official totals, searchable
appendix rows, announcements, delivered outputs and measured outcomes distinct.
Update dated editorial copy and all affected translations with a new cycle;
rendered headline and series-row tests reject stale claims beside new data.
Review extraction artifacts against the source instead of guessing missing text.

New public datasets and runtime modules require explicit publication allowlisting.
Changes to the public archive fingerprint or reviewed asset manifest require
recorded source review. Raw research, mail, internal drafts and redacted snippets
stay local. Do not weaken a gate, add a raw directory to the build or rewrite Git
history to make an update pass.

## Current limits

Thai and Chinese authored translations remain incomplete; the footer states that
limit. `npm run audit:graphics` reports that broader editorial debt separately;
`check:release` does not certify translation completeness or native-speaker review.
Source-issued names and titles retain their published wording.

The contents rail scrolls on shorter screens to preserve fifteen 44px links.
It has a visible scrollbar and keyboard scrolling. Maps rely on OpenStreetMap
availability; the release audit fails if geographic tiles do not become ready.
