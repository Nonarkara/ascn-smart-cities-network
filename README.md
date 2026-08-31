# ASCN Smart Cities Network V2

ASCN V2 is a lightweight public analytics workbench for the ASEAN Smart Cities Network. It turns official ASCN public documents into a small, reviewable static dataset and renders the network's progress across cities, projects, focus areas, implementation status, and source evidence.

The live V2 target is `https://ascn.nonarkara.org`. V1 at `https://ascn.depa.or.th` is treated as a separate agency-facing approval site and should not be modified from this deployment path.

## What V2 Adds

- Year-by-year M&E trend layer for 2022, 2023, 2024, and 2025.
- Current network KPIs: 38 cities, 11 countries, 134 projects, 108 ongoing, 18 completed, 8 planning.
- Focus-area analytics across Civic & Social, Health & Well-Being, Safety & Security, Quality Environment, Built Infrastructure, and Industry & Innovation.
- Interactive Southeast Asia map with ASCN city cohort markers.
- Searchable and filterable project evidence table generated from official report appendices.
- CSV export and shareable filtered views for analysts and reviewers.
- Source library linking back to official ASEAN pages and PDFs.
- Methodology and limitations section so users can judge freshness, source reliability, and row-level caveats.
- Repeatable extraction pipeline that keeps raw PDFs out of the repository.

## Data Pipeline

Raw source PDFs are downloaded into `.tmp/ascn-sources/`, which is ignored by git. The extractor writes committed analytics data to:

```bash
data/ascn-v2-data.json
```

Run extraction after refreshing source PDFs:

```bash
python3 scripts/extract_ascn_data.py
```

The extracted appendix rows are useful for analytics but can contain wrapped-table artifacts from the source PDFs. The JSON marks this explicitly in `metadata.notes`.

## Local Development

This is a static site with no framework build step. A tiny build script copies only deployable assets into `dist/`.

```bash
npm install
npm run build
npm run dev
```

## Cloudflare Pages Deployment

The deploy script uses Wrangler Pages and deploys only `dist/`.

```bash
npm run deploy
```

If the Cloudflare Pages project has not been created yet:

```bash
npx wrangler pages project create ascn-smart-cities-network --production-branch main
```

Then connect the custom domain `ascn.nonarkara.org` in Cloudflare Pages.

## GitHub Description

Short repository description:

> ASCN V2 Progress Observatory: a lightweight analytics workbench for ASEAN Smart Cities Network reports, projects, focus areas, and source evidence.

Long repository description:

> This repository powers the V2 ASEAN Smart Cities Network Progress Observatory for `ascn.nonarkara.org`. It keeps the public site lightweight by extracting official ASCN M&E reports and framework documents into structured JSON, then rendering a compact dashboard for network growth, implementation status, focus-area distribution, city project load, and source traceability. Raw PDFs remain outside git; committed assets are the static app, extraction script, and reviewable data.

Suggested topics:

`asean`, `smart-cities`, `ascn`, `civic-tech`, `urban-data`, `data-visualization`, `cloudflare-pages`, `static-site`

## License

This independent project is released under the MIT License; see [LICENSE](LICENSE).
