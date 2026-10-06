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
