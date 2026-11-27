# Mandate report — the ASCN observatory

**Dr Non Arkaraprasertkul's standing mandate:** audit this codebase against
the ideal plan of what the ASCN system can be; work towards that goal on
what already exists; kill AI design slop and spatial hallucination
site-wide; decide what the backend needs; do it by slow probing rather than
shortcuts.

This report is the account of that work: what was found, what was repaired,
what the backend needs, and what is still at risk.

The ideal plan is not a wish list. It is the system the ASCN concept note
and the Smart Cities Framework describe — a monitoring instrument for the
network, built on published evidence, readable in the reader's own language,
and honest about the limits of what it can see — delivered through the
laws in `DESIGN-MSH.md` and `DESIGN-ANTI-SLOP.md`.

---

## 1. What the ideal asks for, and where the codebase stood

| the ideal | the code before this work | now |
|---|---|---|
| An instrument that reports what changed in the network, and says what it cannot see | built, and honest | unchanged, and now measured in every mode |
| Published evidence as the ground of every claim | enforced by an allowlist and a fingerprint | unchanged |
| Three languages, because the network reads in three | English wearing a three-language dictionary | **true, and proved** |
| A reading measure that means the same thing in every script | a Latin character ceiling | **an em ceiling, derived from the design's own tokens** |
| Geometry that serves reading, in every mode | measured in one mode | **measured in four** |
| Every box holds its content | assumed | **measured and enforced, 180 measurements a release** |

---

## 2. Findings and repairs

### 2.1 The gate was running one mode and calling it four

`scripts/check-release.mjs` listed its checks with a mode patch —
`{ ASCN_COMPOSITION_LANG: 'th' }` — and called `check(name, command, args)`
without the patch, then destructured three elements from a four-element
list. Every "Thai", "Chinese" and "light" check ran in the default mode.

The 26 November release recorded *"composition 0 failures in English, Thai,
Chinese and light"*. It had run English four times. The translation round
was therefore never reviewed in the languages it shipped in.

**Repair:** the patch is passed through, and the four sweeps are four
sweeps. The first honest Thai sweep then found a hole the English sweep
could not see.

### 2.2 The translation broke boxes that were sized for English

A fixed-width track holds text, and the width of text is a property of the
language. The trilingual round introduced this class of defect site-wide and
nothing was measuring it. Measured, in full:

| element | content | needed | had | effect |
|---|---|---|---|---|
| density caption (Thai) | `2 โครงการ · 14.0M` | 99.5px | 81px | **pushed the document 3px sideways** |
| "no projection" (English) | — | 47px | 39px | ran past the table's own edge |
| country list (all) | `Singapore, UK, Australia, …` | 334px | 138px | **ran 196px under the bar** |
| investment figure | `6,700,000,000` | 98px | 91px | overran its column |
| "undisclosed" | — | 68px | 65px | overran its column |
| "2022" on a phone | — | 31px | 26px | overran its column |
| "No coverage" on a phone | — | 42px | 26px | overran its column |
| ASCAP coverage card, phone | — | — | — | bar left 39px wide, count orphaned |

**Repair:** every one is fixed, and the value column is now sized per group
to what that group holds — 4rem for a number, 8rem for a dollar figure,
8.5rem for the caption. A column wider than its content is space with no
job: the bar runs out and the number waits alone across the gap. That gap
was caught by the Thai composition sweep as a 104px × 320px interior hole.

### 2.3 The churn funnel was painting a label into a 14px slot

"Dropped after 2022" is 1.2% of the bar — 14px — and its label was 35px
wide, so it spilled over its neighbours and printed `DROP / AFT` across the
boundary between two segments. A proportional segment cannot be widened
without lying about the proportion.

**Repair:** the bar carries the proportion; a key below carries the counts
and the names. The four colours are declared once and read by both the bar
and the key, so they cannot drift apart. The key is two columns of two,
because four items do not divide into three.

### 2.4 Two links shared one translation key

The showcase's video link and the innovation view's video link both carried
`audit.open-video`. The selector matched two elements and the browser test
that asserts the innovation link's target could not resolve.

**Repair:** the showcase link has its own key. The same text, two different
files, two different keys.

### 2.5 The dictionary's own words

Six entries had a corrupt English arm — one of them a published paper's
title that had been given a Thai rendering, which is the exact defect the
October audit had already restored once. Four groups of entries disagreed
with one another about the same English sentence. `rec.cofinancing` was not
a key at all, so the page painted the literal key string.

**Repair:** all repaired, the orphans deleted, and the audit now fails on a
disagreeing group, on a non-Latin English arm, and on an ambiguity.

---

## 3. The gates this work added or repaired

| gate | what it now measures | falsifier |
|---|---|---|
| `audit-i18n.mjs` | every route, in Thai and Chinese, for platform prose left standing in the reader's language | `tests/i18n-audit.spec.mjs` — 7 tests |
| `audit-measure.mjs` | the reading measure in Latin, Thai and Chinese, against an em ceiling derived from the design's tokens | `tests/reading-measure.spec.mjs` — 5 tests, including a wide Thai line and a wide Chinese line that are legal in characters and illegal in width |
| `audit-overflow.mjs` | every view, in three languages, at three widths: content that does not fit the box that holds it, and SVG text cropped by its own viewBox | `tests/overflow.spec.mjs` — 5 tests |
| `audit-composition.mjs` | four modes, four sweeps, now genuinely four | `tests/composition.spec.mjs` |
| `audit-cost.mjs` | every view's cost in screens against a cap that may only be lowered | `tests/cost.spec.mjs` |

The overflow gate is the new one, and it is the direct answer to the class
of defect the translation created. Its exceptions live in
`scripts/overflow-baseline.json`, each with a reason; the gate fails when an
offender is not recorded, when a recorded offender has **grown**, when one
**no longer happens**, and when one has **no reason**.

---

## 4. What the backend needs

The site's backend is two Cloudflare Pages functions. It is nearly right,
and it has one real gap.

### 4.1 The gap: `/api/news` has no snapshot fallback

`/api/ascn-news` was repaired earlier: when the discovery index refuses
Cloudflare's edge, the endpoint answers with the published snapshot, marks
itself `saved`, and gives the reason each feed gave. A bare 503 with no body
told the reader nothing and lost the list.

`/api/news` — the regional feed list — still has the old behaviour: if every
publisher feed fails, it answers **503 with an empty body** and the reader
loses the list entirely. The same defect, in the other endpoint, one round
later.

**What it needs:** the regional endpoint should carry a published snapshot of
the same shape and serve it when the edge cannot reach the publishers, with
the same `mode` field and the same per-source reasons. The machinery exists
in `scripts/refresh-news.mjs` and in the ASCN endpoint; it needs to be
applied to the regional one.

### 4.2 The refresh of the discovery snapshot is manual

`data/ascn-news-discovery.json` is refreshed by a script run from the
owner's machine and committed. It will go stale, and nothing measures how
stale it is.

**Two honest options, in order of cost:**
1. **A scheduled job** (GitHub Actions on a timer, or a Cloudflare Cron
   Trigger) that runs the same refresh and commits the result. The
   repository already has the script; the schedule is the missing piece.
2. **A source that answers the edge.** Google News refuses Cloudflare's
   address by IP reputation and will keep refusing it — a better-formed
   request does not change the publisher's policy toward the edge. GDELT
   and the publisher's own feeds do answer. This is the only way to make
   the discovery list genuinely live at the edge rather than honestly saved.

Until one of those is done, the endpoint's current behaviour is the correct
one: the published snapshot is the list of record, the live check is a
bonus, and the reader is told which they are looking at.

### 4.3 What the backend does *not* need

- **Search.** "Find in the observatory" runs against the shipped datasets in
  the browser. That is the right shape for this corpus and costs nothing.
  A search index becomes worth its cost when the archive grows past what a
  reader can hold, and not before.
- **The correspondence ledger.** It is private by design and must never
  leave the machine. No backend should ever be given it.
- **Analytics, accounts, a database.** The site is a static instrument
  reading published documents. A database would add surface and remove the
  property that makes it trustworthy: the build is the record.

---

## 5. The release this work produced

**Commit `4edfc87`** on `main`, deployed to
`https://2e898f71.ascn-smart-cities-network.pages.dev`, canonical
`https://ascn-smart-cities-network.pages.dev`, custom domain
`https://ascn.nonarkara.org`.

### The gate, in full

| check | result |
|---|---|
| Dependency security | pass |
| Design, data, unit and public artifact checks | 77 unit tests pass, 0 fail, 1 skip |
| Browser flows and incoming-data regressions | 121 pass, 0 fail |
| Spatial geometry and map readiness | 0 findings |
| Composition bands — English | 0 failures |
| Composition bands — **Thai** | 0 failures |
| Composition bands — **Chinese** | 0 failures |
| Composition bands — **light theme** | 0 failures |
| Graphics and rendered reading measure | 129/129 |
| Translation — Thai | 0 defects |
| Translation — Chinese | 0 defects |
| Reading measure — Latin / Thai / Chinese | 0 failures |
| **Content overflow, every language, every width** | 180 measurements, every box holds its content |
| Page cost in screens | 40 measurements, every view within its cap, **no cap raised** |
| All-view visual captures | 638 reading-path frames captured |
| Complete reading-path captures | captured |
| Publication live guard | 24 public files, 13 private routes refused |

### The live bytes, verified on both domains

Eight named files — `index.html`, `styles.css`, `app.js`, `ascn-news.js`,
`news.js`, `archive.js`, `lib/i18n.mjs`, `showcase.js` — and **34 referenced
assets and data files**, hashed and compared against the committed tree:
**byte-identical on both the canonical host and the custom domain**, 0
missing, 0 differing.

### The live flows, exercised as a reader would

114 checks per domain — 19 routes × 3 languages × 2 widths (1440 and 390) —
against the deployed site:

- **0** views pushed the document sideways;
- **0** views showed a raw dictionary key, checked against all **1,554**
  keys read from the live `lib/i18n.mjs`;
- **0** page errors.

Both domains: **LIVE FLOWS PASS**.

---

## 6. Residual risk


Stated plainly, with the evidence.

### 5.1 The two unreproduced claims

A previous reviewer asserted an **"archive hole"** and a **"77-character
line"**. Neither has been reproduced, in the rounds that followed or in
this one.

- **77-character line.** The reading-measure sweep reports the widest line
  at **27.13em** in Latin, **26.81em** in Thai and **25.59em** in Chinese,
  against a **31.54em** em ceiling and a **75-character** ceiling for
  Latin. No 77-character line was found in any view, in any language, at
  any width. The sweep now also fails when its count and the text it
  measured disagree, so the number it reports is the number it can prove.
- **Archive hole.** The archive table measures **351px of content in a
  351px box** at 390px, with no sideways push and no clipped text. The
  header row the overflow instrument flags is the visually-hidden row the
  phone layout uses, with each cell repeating its own label; the instrument
  now skips a hidden subtree for that reason.

These are recorded as **unresolved, not as dismissed**. If either is
reproduced with a selector, a viewport, a language and a measurement, it
becomes a defect that round.

### 5.2 The modes that are still only swept by one instrument

The composition, overflow and measure gates sweep Thai, Chinese and light.
The **spatial** gate (`audit-sh.mjs`) and the **graphics** gate
(`verify-graphics.mjs`) still run in one mode each. Thai and Chinese are
different geometry, and no English-only sweep will ever find the hole that
a Thai line opens. The spatial and graphics gates should follow the
composition gate into the other modes.

### 5.3 The layout is measured; it is not yet independently reviewed in those modes

Stage 1 of the independent review covered the Overview view at 1440 in
English and found the band that the trilingual round's own numbers
describe. Stage 2 — the other views, the other viewports, Thai, Chinese
and light, against the live site — is the outstanding independent check.
Until it is done, the measurements above are the author's own.

### 5.4 The discovery list is saved, and says so

`/api/ascn-news` serves the published snapshot with `mode: "saved"` and
the reason each feed gave. That is honest, and it is still not a live list.
The reader is told; the list is not live.

### 5.5 The archive fingerprint guards the evidence, not the interface

New datasets and new runtime modules need explicit publication
allowlisting, and the fingerprint guards the evidence archive. A change to
the *interface* that adds a runtime module has to be allowlisted by hand.
That is a deliberate cost — the house rule is that raw research never enters
the build — but it is a place where a future contributor can be silently
wrong.

### 5.6 Historical Git cleanup still needs the owner's approval

The private material in this repository's history is a separate retention
risk from anything in the published build. Safety work does not authorise a
rewrite or a force-push, and none has been done.
