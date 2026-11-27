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

### 2.4 Two more gates were measuring one language

The composition gate was repaired, but the **spatial** gate and the **cost**
gate still measured the site in English only — and the translation round had
made that matter.

**The spatial gate had never seen a non-Latin page.** Its first honest
Chinese sweep found six findings, all of them the same one: *"1 block(s)
stretched inside a closed band"* in the Essay view, at every viewport. The
block was `P.label` — "来源与延伸阅读" — in a **385px** box with **91px** of
ink: **4.23 times**, against a ceiling of 3.27. The English label is a
third longer and came in at 2.5 times, so the English sweep never saw it.

The defect was not in the Chinese text. It was that a **label** was capped
at the reading measure — the measure caps the running line of *prose*, and
an eyebrow label has no line to run. Two places in the site already said so
with `width: fit-content`; the house style was right and only the general
rule was wrong. A label now takes the width of its own words, up to the
measure.

**The cost of a page was a fact about English.** Measured, Thai against
English: **6 views cost more in Thai** — `overview` by 0.09 screens,
`partners`, `cities` and `news/archive` by 0.03 — and 6 cost less. So a
cap that only ever held in English was a cap about English. The cap belongs
to the view, not to one script of it: the gate now measures every view in
English, Thai and Chinese and holds the cap against the **worst** of the
three. No cap was raised — English was already the worst for the views that
were close — and the "only lower it" rule still bites, because an
improvement is banked only when **every** language is under the cap.

### 2.5 Two links shared one translation key

The showcase's video link and the innovation view's video link both carried
`audit.open-video`. The selector matched two elements and the browser test
that asserts the innovation link's target could not resolve.

**Repair:** the showcase link has its own key. The same text, two different
files, two different keys.

### 2.6 The dictionary's own words

Six entries had a corrupt English arm — one of them a published paper's
title that had been given a Thai rendering, which is the exact defect the
October audit had already restored once. Four groups of entries disagreed
with one another about the same English sentence. `rec.cofinancing` was not
a key at all, so the page painted the literal key string.

**Repair:** all repaired, the orphans deleted, and the audit now fails on a
disagreeing group, on a non-Latin English arm, and on an ambiguity.

### 2.7 Round three — what the independent review found, and what it cost

The review of round 2 was read in full and each finding was answered with a
repair or a reason. Seven of them were real.

**F1 — the project register was dropping a country.** `scripts/extract_ascn_data.py`
sliced the appendix tables of the four M&E reports by position, so a row
whose cells wrapped was read as one merged row — and the country column is
printed only on the first row of a country group, so a row that began with
the city **Singapore** was read as a country and dropped. **378 rows became
405**: 27 rows recovered, 3 corrupt rows split into 10, six Viet Nam rows
(2025 #111–116) relabelled from Thailand, one truncated name restored. The
register is now rebuilt by `scripts/rebuild-ascn-projects.py` — committed,
re-runnable, with a `--check` mode — and `scripts/validate-data.mjs` fails
when a year's appendix rows do not equal the report's own total, and when a
row is merged or run-on.

One observation the independent review made on the rebuilt register: the
`number` field is **not unique within a year** (2025: 116 distinct numbers
over 134 rows), because each report carries two appendices — ongoing and
completed — and each restarts at 1. That is faithful to the source, not a
data error; a project is keyed by (year, **status**, number), and nothing in
the site keys it by number alone. It is recorded here so that a future
consumer does not.

**F1b — two published claims were false because of it.** "Vietnam: silent in
2025" became "Vietnam: the same six projects, four cycles running", and
"13 projects reported but not in the appendix" became "34 projects, three
countries, none completed", in all three languages.

**F7 — a deep link of the form `#/<route>` silently rendered the Overview.**
`app.js` parsed `location.hash.slice(1).split("/")`, so a leading slash
yielded an empty tab name and `setTab` replaced it with "overview". The
reviewer's own brief used that form. Fixed, and the sweep that takes its
route list from the navigation now lands where it says.

**F2 — the measure gate could not see a title or a metadata line.** The
sweep's selector had no `a` and no `td`, and it skipped any block shorter
than 120 characters — so a single-line 77-character label was invisible by
construction. The gate now measures every rendered line it can reach, and
the law is restated: **prose** ≤ 75 characters *and* ≤ 31.54em; **running
text** ≤ 410px physical; a **table cell** is bound by its column; **SVG**
text by its viewBox. The sweep went from **29 failures to 0** in English
and dark at 1440, 1024 and 390.

**F4 — six peer grids stranded their last card.** The counts are data —
eleven contact cards, eleven documents, sixty-two library entries — and
`auto-fill`/`auto-fit` pick the column count from the *width*, not the
count, which is where strands come from. The stylesheet now says how many
columns a grid may hold at a given field width; `app.js` settles the
division at runtime, where the counts are known, and the last item takes
the columns its row has left. `scripts/audit-grids.mjs` proves it in the
built site at every viewport: **0 rows end in an empty cell**. The gate
also caught a real hole on the way — the 5G matrix header labelled four of
its five columns.

**F5 — 21 controls were under 44px on the phone.** The house rule is 44px
for a control and the 24px AA bar for a reference link — a publisher's
name, an institution on a contact card — because 44px would space twenty
ministry names a third of a metre apart. Both rules are now *proved*, not
asserted: `scripts/audit-targets.mjs` measures every rendered control at
390px in four modes, and fails on a control under 44px or a reference link
under 24px. The controls were repaired: a 30px map button, a 20px "↗", a
33px download, a 15px language button, a 40px map toggle.

**F6 — five labels were cropped by their own box.** A city name, a country
name, a focus area and a table head. The overflow gate only ever looked at
boxes whose overflow was *visible* — boxes that were spilling out — so a box
that hides what does not fit was the one half of the defect it could not
see. The gate now measures **cropped** text as well, with the same
baseline and the same rule that an exception must carry a reason. The
labels were repaired: they wrap, or their column was given the room.

**F3 — the one-sided voids are still open.** The composition gate now
reports the class the reviewer found: a band that touches one field edge
while the opposite edge carries content. It reports **99** of them. The
archive's 857 × 245px head and the library's ledger were recomposed this
round; the remaining ones — history, framework, insights, partners,
record, the essay's end matter — are the owner's call, and the report says
so rather than hiding them behind a passing exit code.

### 2.8 The independent review of round 3, and what it cost

The build was reviewed by an independent reviewer with its own instruments —
not the project's gates, because the previous round proved that a gate can
be blind and still report green. The reviewer's own census counted **47,248
prose lines** and **51,736 running lines** over 270 route-loads, and
extracted the four source PDFs itself to count the appendix rows.

**Verified independently:** F1 (405 rows; 77 / 86 / 108 / 134 counted from
the PDFs themselves; 405 of 405 titles present verbatim; Viet Nam's six rows
read "111. Viet Nam Da Nang" in the source), F1b (both corrected claims
against the data), F2 (0 prose offenders, 0 over the house ceiling), F3 (the
857 × 245px region gone in every language and theme), F4 (0 peer grids
strand a cell), F5, F6 (0 real crops), F7 (96/96 deep links land).

**Three findings, and each one's answer:**

1. **The build failed the project's own touch-target gate.** The map's credit
   links measured **43.64px** — 0.36px under the floor — and `npm run deploy`
   runs that gate first, so the release could not have shipped. The credit
   links now have 46px of target (14px of text plus 16px of padding above and
   below, with the padding taken back out of the layout by a negative
   margin). The gate reports **0 failures in all four modes**.
2. **The archive head still carried a band the composition gate does not
   record**: 359 × 82px under the lede, with the title block running on
   beside it. The gate's own threshold says a band shorter than 150px is a
   gutter, so it was not reported — but the band was real, and this round
   had put it there. **Repaired:** the language switcher now sits with the
   statement it switches, under the lede, and the two columns of the head
   end within twenty pixels of each other.
3. **The target gate could not reach the reference links.** It skipped every
   link inside prose — right for an inline link, wrong for the house's
   reference class, which is held to the 24px AA bar *whether it sits in a
   sentence or in a card*. The archive's source names sat at 19px and no
   gate could see them. **Repaired:** a reference link is now measured even
   inside prose (the gate went from 24 reference links to 128), the archive's
   source links are named so the class can name them, and every reference
   link is held to 24 × 24.

The reviewer's verdict is **PARTIAL**, and the two things it leaves open are
the owner's: the voids in the six views (measured, confirmed empty by the
reviewer's own glyph count, not decided by it), and the archive band, which
this round has now repaired.

### 2.9 Round 3b — the phone library, and a gate that could not tell an outage from a bug

Two things were found after the round-3 review, and neither was a slop
problem. They were the law's own two working ends: a view that had grown
past the cap it was promised, and a gate that had no way to say whose
fault a failure was.

**The data view was over its own cost cap.** The library had become a grid
of sixty-two cards, and each card stacked its four parts down the page —
the badge on a row of its own, the title on the next, the takeaway on the
third, the links on the fourth. Every one of those rows is a row the card
did not need, and sixty-two times over the view cost **26.92 screens in
English, 27.12 in Thai and 24.41 in Chinese, against a cap of 24.4**.

Repaired on the phone only. The badge, the title and the links now share
one line — they are one group of facts about one source — and the takeaway
runs the width of the entry beneath them, because the takeaway is the
second paragraph of the entry, not a third row of the header. The padding
came down with them: a hairline already separates one entry from the next,
so the space above and below it was carrying that same message twice.
Measured: the mean entry is **212.7px tall instead of 255.8px**, the view is
**23.38 screens** in English, **23.23** in Thai and **20.32** in Chinese,
and the desktop view — where the ledger's sixty-two rows had become a
three-column grid — fell from 16.65 to **9.94 screens**.

Both caps were **lowered** to the measured cost, each with its reason
written in `scripts/cost-baseline.json`. No cap was raised.

**The release gate failed on a third party's bad afternoon.** The build's
own browser-flow test asked the map whether its tiles had drawn, and when
OpenStreetMap refused for a moment the answer was no — so the gate went
red on a release that had nothing wrong with it. The gate could not say
otherwise, because it had asked a yes/no question about the wrong subject:
it asked whether tiles had drawn, and an upstream outage and a broken map
look identical from inside.

So the instrument was rebuilt on the only evidence that settles the
question — **what the page itself received**, watched on the browser's own
request events, with the watcher attached before the map is created:

| what the page saw | verdict |
|---|---|
| a tile decoded and drew | pass |
| the site asked for a tile the server does not have (404, 410) | **the site is at fault** — the URL template is wrong; a release fails |
| the page carries tile images but no request ever left the browser | **the site is at fault** — its own policy blocked them; a release fails |
| the server refused (401/403/429), errored (5xx), or the request failed in the network | **an upstream outage** — the site must degrade as it promises: the notice appears, the markers stay, the reader can still choose a city. That is checked, and the outage is recorded rather than counted as a finding |

Both the spatial gate and the browser-flow test use it now. Every branch is
proved: **7 unit cases** for the decision and **4 browser cases** against
the real built site — a wrong URL fails the release, a refusal does not, a
blocked request does, a healthy basemap passes.

This is the gate law applied to the gates themselves. A gate that cannot
tell an upstream outage from its own failure teaches its readers to re-run
a red gate until it goes green, and a gate that is re-run until it goes
green is no gate at all.

---

## 3. The gates this work added or repaired

| gate | what it now measures | falsifier |
|---|---|---|
| `audit-i18n.mjs` | every route, in Thai and Chinese, for platform prose left standing in the reader's language | `tests/i18n-audit.spec.mjs` — 7 tests |
| `audit-measure.mjs` | the reading measure in Latin, Thai and Chinese, against an em ceiling derived from the design's tokens | `tests/reading-measure.spec.mjs` — 5 tests, including a wide Thai line and a wide Chinese line that are legal in characters and illegal in width |
| `audit-overflow.mjs` | every view, in three languages, at three widths: content that does not fit the box that holds it, and SVG text cropped by its own viewBox | `tests/overflow.spec.mjs` — 5 tests |
| `audit-composition.mjs` | four modes, four sweeps, now genuinely four | `tests/composition.spec.mjs` |
| `audit-cost.mjs` | every view's cost in screens against a cap that may only be lowered | `tests/cost.spec.mjs` |
| `audit-grids.mjs` | every peer grid in every view at 1440, 1024 and 390: a row that ends short of its grid's trailing edge, measured in cells rather than pixels | `tests/visual-audit.unit.mjs` — the judge, with a planted row |
| `audit-targets.mjs` | every rendered control at 390px in four modes: 44px for a control, 24px for a reference link | `tests/visual-audit.unit.mjs` — the judge, with a planted 30px button |
| `tile-health.mjs` | the basemap's health, from the tile requests the **page** made: the site being broken is told apart from the tile server refusing | `tests/tile-health.unit.mjs` — 7 cases for the decision; `tests/tile-health.spec.mjs` — 4 cases against the real built site |

Two of these are new in round three. The **grid gate** is the direct answer
to a law that had no instrument: a grid's column count must divide its item
count, or the last item takes the columns its row has left. The **target
gate** answers a rule the house had written down and never checked.

The overflow gate is the direct answer to the class
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

### 5.1 The two claims — reproduced, and repaired

This report previously said that a previous reviewer's **"archive hole"** and
**"77-character line"** could not be reproduced, and recorded them as
unresolved rather than dismissed. **That was wrong.** The independent review
of round 2 reproduced both, with measurements, and the reason the house
could not see them is now on the record:

- **77-character line — reproduced.** The reviewer's census counted
  **39,311 individually measured rendered lines** across nine language ×
  viewport sweeps and found **15 lines of exactly 77 characters**, in all
  three languages: `div.le-title` and `div.le-meta` in the library ledger,
  and `span.alum-title` on the contacts view. The house sweep could not see
  them because its selector had no `a` and no `td`, and because it skipped
  every block shorter than **120 characters** — which a single-line
  77-character label is by definition. The gate now measures every
  rendered line it can reach, the law is restated (prose ≤ 75 characters
  *and* ≤ 31.54em; running text ≤ 410px physical; a table cell is bound by
  its column; SVG text by its viewBox), and the offenders are repaired: the
  library ledger was rebuilt as a card grid with the measure applied. The
  sweep went from **29 failures to 0**.
- **Archive hole — reproduced.** An empty region of **857 × 245px** in the
  archive's first screen at 1440, in every language and theme, with running
  content beside it on 141 of 245 rows. The cause was structural, and it is
  why the house gate did not see it: the lede was a **359px measure column
  in a 1211px content box**. There was no column to run out — it was a
  measure column with 852px of nothing beside it, and the gate was looking
  for columns that ran out while a neighbour ran on. The archive head is
  now two columns, and the composition gate measures this class: a band
  that touches one field edge while the opposite edge carries content is
  reported as a **one-sided void**. The failure criteria were not loosened.

"Not reproduced" meant "not looked at". The instrument was blind, and the
honest statement was about the instrument, not about the site.

### 5.2 The graphics gate still runs its geometry in one mode

The composition, spatial, overflow, measure and translation gates all sweep
Thai, Chinese and light. The **graphics** gate (`verify-graphics.mjs`) checks
the language layer in all three — the `lang` attribute, raw keys, and that
switching language deletes no live content — but its *geometry* checks
(the longest heading line, the type audit) still run in the default mode.
The spatial gate now covers that ground, so this is a narrowing rather than
a gap; it is listed because the instrument that claims to check graphics
does not yet check them in every script.

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
