# Overview video showcase

Register: Civic, on the existing white ASCN surface.

Design read: the videos make flood intelligence tangible through a field demonstration, a city operations desk, and a map-based analysis session.

Reference: the YouTube watch page's large player and compact video selector. The player is the dominant element; the ASCN 2026 record is a short band beneath it. Use the existing Source Sans 3 typography, square edges, and neutral colours, with amber for the selected video. A 3px selection marker carries state; 1px rules separate content.

Invariant: all three complete videos remain available, with one selected player and no automatic playback. Leaving Overview pauses playback. The full ASCN 9 record and the existing analytics remain available.

The Desktop originals remain untouched. `npm run prepare:showcase` creates smaller H.264/AAC copies and posters in `media/showcase/`. `npm test` checks selection, playback, navigation, and phone layouts.

# Regional news

Register: Index, on the existing white ASCN surface. Design read: a dated headline ledger for city officers who scan several countries and policy areas in one visit. Reference: Reuters' chronological news index, with a dominant headline list and a narrow coverage/source column. Use 2px section rules, 1px story separators, three text sizes, and no floating section cards.

The overview video showcase, full ASCN 2026 record, city maps, analytics, and library stay available. News links retain publisher attribution; no article bodies or publisher images are republished. Country/topic tags are inferred from feed metadata. Saved reading lists, unavailable feeds, unknown dates, and last-check times remain visible.

The news endpoint fetches only the fixed registry in `lib/news-sources.mjs`, without credentials or caller-provided URLs. It caches nonempty results, rejects XML entity declarations, and caps response sizes. Local fonts and Leaflet remove external dependencies from app startup.

# ASCN Evidence Review

Register: Index. Design read: a public review ledger that places claims beside their limits and the official project register. Reference: the UK National Audit Office's report summaries and evidence tables. The review finding is the dominant first element; charts use zero-based neutral bars, and source-ledger records carry square-edged amber interpretation markers. Section rules are 2px; record separators are 1px.

Invariant: news volume never changes official project status, implies city failure, or establishes causation by ASCN. Reviewed claims in `data/ascn-news-archive.json` and unreviewed indexed leads in `data/ascn-news-discovery.json` remain separate. Membership announcements are not city-delivery evidence. Unknown dates stay unknown; event keys prevent duplicate coverage being counted as independent events. Outcome classification requires comparison evidence.

The existing News tab retains regional feeds under `#news/regional`. ASCN review, archive and discovery have deep links. City profiles link to filtered evidence; exact project names and city aliases connect claims to the latest official appendix without changing that dataset. No floating cards or new landing page.


# Underground review, October 2026

Register: Index with a dark reading ground. Design read: an independent evidence
ledger whose provenance and uncertainty remain as visible as its findings.
Reference: Braun ET66 for the charcoal/ivory/amber hierarchy; the UK National
Audit Office evidence tables for the ledger rhythm. Existing maps, charts,
video controls, fourteen navigation sections, and curated content remain.

Palette intent: distinguish this independent review from the agency-facing site.
Relationship: warm ivory against charcoal, with amber pointing and a bounded
mineral-green opening field. Chord: charcoal #191d1c, ivory #eeeae0, amber
#f59e0b, mineral #283d37. This is Wada-inspired, not a source-verified plate.
Roles/budget: neutral carrier ~85%, opening field ~10%, amber controls ~5%;
real status colours remain separate. The opening field holds the introduction;
tables and evidence stay on neutral grounds. Rules: 2px sections, 1px records.
Verify text contrast, phone/tablet/desktop fit, keyboard focus, all existing maps
and videos, and the ledger's failed-data state.

Implementation scope: complete the inherited correspondence ledger in app.js,
index.html, lib/correspondence.mjs, extraction/classification scripts and tests;
exclude all non-reviewed JSON from publication in scripts/site-assets.mjs;
apply palette tokens and targeted surface overrides in styles.css. Validate,
build, exercise browser routes, commit, push, deploy and verify the live build.
Invariant: only the reviewed publication allowlist enters dist; a keyword match
is a candidate for review, never proof of accepted funding or completed travel.
Counts describe subject-grouped threads in one mailbox, not unique events or
network-wide totals. Raw messages remain local and are never build assets.
