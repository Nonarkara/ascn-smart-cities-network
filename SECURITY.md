# Security And News Operations

This is a public reading and analytics site. There are no logins, payments, private data stores, model calls, or API keys in the application. News retrieval is a read-only Pages Function.

## Protections

- HTML escaping and URL scheme checks are shared in `lib/security.mjs`. Native map tooltips also escape dataset text.
- CSV exports quote values and neutralize spreadsheet formula prefixes; numeric coordinates remain numeric.
- Critical dataset shapes and numeric ranges are checked both during validation and before browser rendering.
- Pages headers enforce CSP, framing denial, MIME sniffing protection, a referrer policy, HSTS, and device-permission restrictions. A matching HTML CSP protects the static mirror. Inline styles remain allowed for existing charts and Leaflet; inline scripts and eval are disallowed.
- Fonts and Leaflet are local. The Leaflet assets are checked against the official pinned release hashes during each build.
- The build copies reviewed asset categories, excludes hidden files and local notes, refuses symlinks and oversized assets, and does not publish the Functions source or security notes.
- CI uses pinned action revisions, read-only repository permissions, no persisted checkout credentials, dependency auditing, unit tests, and browser tests.
- Miniflare's Sharp dependency is pinned to patched 0.35.5 through an override. Check the local runtime and image APIs before changing this override; the site does not use image-processing bindings.

## Regional News

The registry in `lib/news-sources.mjs` lists public RSS feeds and their publisher documentation. The endpoint accepts GET/HEAD only and no query parameters, so callers cannot request arbitrary upstream URLs. Each request is bounded by a timeout and response size limit. XML DOCTYPE/ENTITY declarations are rejected before parsing with the unchanged, licensed fast-xml-parser 5.8.0 standalone bundle.

Headlines retain publication dates and source links. Countries and topics are inferred from feed metadata; the feed is not a complete record of regional development. Partner content/opinion labels are retained when supplied in metadata. Article bodies and publisher images are not republished.

Nonempty responses are cached for 15 minutes at the edge; empty failures are not cached. The browser keeps the last valid collection and falls back to `data/news-snapshot.json`. Saved results, unavailable publishers, last-check dates, and missing publication dates are visible. The XML parser is vendored for reproducible builds; preserve its MIT license and review upstream advisories when updating it.

Refresh the shipped fallback with `npm run refresh:news`. A failed refresh preserves the previous snapshot. Confirm every newly added publisher's RSS endpoint and usage terms before adding it. The current registry links to each publisher's feed documentation; availability can differ between local and Worker egress.

## ASCN Evidence and Discovery

`functions/api/ascn-news.js` uses two fixed, public Google News RSS searches. It does not accept user-selected URLs, follow redirects, fetch article bodies, or call a paid service. The shared feed reader rejects XML entities and oversized responses. Historical matches bypass the regional feed's rolling 180-day window but remain unreviewed leads. Index dates and partial feed failures are labelled.

The reviewed archive is an editorial input, not generated from headline sentiment or volume. Its runtime and build validators check provenance, dates, city membership, metric types and project links. Discovery cannot alter official M&E status. CSV exports use the existing formula-neutralization helper. Source text remains untrusted and is escaped before display.

`npm run refresh:ascn-news` preserves historical discoveries and refuses an empty refresh or an archive over 10,000 leads. Runtime refresh merges saved and live leads in memory; it does not silently write public evidence. New claims require a source review and a committed archive record.

## Checks

Run `npm run check`, `npm audit --audit-level=high`, and `npm test`. To exercise a deployed site, set `ASCN_TEST_URL` to its URL. The browser suite covers the news filters, saved/live states, unsafe links, CSV exports, XML boundaries, maps, existing routes, and complete video playback.

Run `gitleaks git . --redact --no-banner --log-opts='--all'` to scan history. Never attach unredacted scanner output. The initial scan found no secrets in 50 commits; this is evidence from one scan, not a guarantee about future commits.

Report a suspected issue privately to the repository owner; do not include credentials, personal data, or exploitable payloads in public issues.
