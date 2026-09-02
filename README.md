<p align="center">
  <img src="docs/hero-banner.png" alt="Studio illustration: young ASEAN professionals gathered around a circular table, with Southeast Asian cities linked as a network. The glowing map on the table is artwork, not a screenshot of this site." width="100%">
</p>

<p align="center"><em>The banner is a civic-studio illustration. The glowing table HUD is artwork only — not the product interface, not live data, and not an official ASCN console.</em></p>

# ASCN Smart Cities Network

An independent civic workbench that turns **public ASEAN Smart Cities Network (ASCN)** reports into a reviewable map, project table, and source library.

**Live:** [ascn.nonarkara.org](https://ascn.nonarkara.org) · **Source:** this repository · **License:** [MIT](LICENSE)

This is not the official ASCN website. The network’s own pages and PDFs live on [asean.org](https://asean.org/our-communities/asean-smart-cities-network/). A separate agency-facing site, treated as V1 and not modified from this path, is [ascn.depa.or.th](https://ascn.depa.or.th).

---

## What this is

ASCN was established at the 32nd ASEAN Summit in Singapore on 28 April 2018. Member cities file Smart City Action Plans and the network publishes annual monitoring and evaluation (M&E) reports. Those reports are public PDFs. They are not a public dashboard.

This repository is that missing public layer:

- a static site that asks, with the published record, how the network is performing
- a committed JSON dataset extracted from official M&E appendices (2022–2025)
- city profiles, focus-area shares, implementation status, and a searchable project table
- a source library that points back at ASEAN pages and PDFs
- methodology notes so a reviewer can see freshness, wrapped-table artifacts, and row-level gaps

The latest committed cycle in `data/` reports **38 cities**, **11 countries**, and **134 projects** (108 ongoing, 18 completed, 8 planning). The 9th annual meeting (20 July 2026) recorded further membership changes that are **not yet** in that city count; the workbench still follows the last published M&E cycle.

It is a small stack on purpose: `index.html`, `app.js`, `styles.css`, JSON under `data/`, and a Python extractor. No application server. No user accounts. No keys in the repo.

---

## Philosophy

Smart-city programmes fail in the same quiet way: the slide is public, the spreadsheet is not, and nobody can check a claim without a PDF and a ruler.

This project takes the opposite bet.

1. **Public documents should be public data.** If ASEAN published the report, a city officer, journalist, student, or neighbouring mayor should be able to filter it without retyping the appendix.
2. **Counts are not the same as evidence.** The M&E headline total is the official portfolio size. Appendix rows are the auditable list this site can search. When they disagree, the gap stays visible. Nothing is silently “fixed.”
3. **The region is not a captive market.** The stance on the site is the same as the 2021 essay that still frames the work: read the market, respect local behaviour, and let each city choose what actually serves its people — rather than importing a template because it is prestigious.
4. **Illustration is not instrumentation.** A painted HUD is a picture of collaboration. The workbench is HTML, JSON, and citations. Mixing those up is how civic tools start pretending to be command centres.

Fork it for another network, another year, another country. Keep the receipts.

---

## Ethical use

**This repository is not an official ASCN, ASEAN Secretariat, or ASEAN member-government product.** Nothing in this README, the live site, or the illustration should be read as an ASEAN publication, an official score, or a government endorsement — unless a document *in this repo* says so in plain language. No such designation is present.

What *is* documented:

| This project | Not this project |
| --- | --- |
| Independent civic analytics on **public** ASCN/ASEAN documents | An official ASCN portal, roster, or M&E system |
| Built and published by **Non Arkaraprasertkul** | A product of the ASEAN Secretariat |
| Live V2 at `ascn.nonarkara.org` | The agency-facing V1 site at `ascn.depa.or.th` |
| Committed JSON, scripts, and a static UI | A classified, partner-only, or contact-list dump |

The author’s biography (DEPA / Smart City Thailand; ASCN staff contact since 2019) is context for *who built it*. It does not convert the repo into a government system.

**Use it for:** reading the public record, teaching, journalism, city-to-city learning, and forking a transparent method.

**Do not use it as:** an official ranking, a procurement score, a substitute for a city’s own filing, or a source of personal contact details. The extractor’s metadata states that personal contact-list details are **not** exposed in the public JSON; only document metadata is cited. Do not add them.

**No secrets belong here.** There is no `.env.example` because the static site does not need API keys, tokens, or passwords to run. Keep Cloudflare, Wrangler, or other deploy credentials in your own environment. Do not commit `.env` files. Do not paste keys into issues or the README.

Source PDFs and ASEAN marks appear as citations and public identity, not as a claim of ownership.

---

## How it works

```
Public ASEAN PDFs          (downloaded locally, gitignored)
        │
        ▼
scripts/extract_ascn_data.py
        │
        ▼
data/*.json                (committed, reviewable)
        │
        ▼
index.html + app.js        (static workbench)
        │
        ▼
npm run build  →  dist/    (deployable snapshot)
```

**Extraction.** Official M&E PDFs and framework documents are downloaded into `.tmp/ascn-sources/` (gitignored). `scripts/extract_ascn_data.py` writes `data/ascn-v2-data.json`. URLs for those public files are listed in the extractor — not copied into this README as a mirror.

**What git tracks.** The static app, the extractor, the validator, and the derived JSON. Raw PDFs stay out of the repository.

**What the UI reads.** `app.js` loads the committed JSON (reports, project rows, city profiles, knowledge layer, library). It renders KPIs, a Southeast Asia map, filters, CSV export, and source links. Wrapped appendix rows from PDF extraction are called out in `metadata.notes` and by `npm run validate`; they are data-quality signals, not silent corrections.

**Build.** `scripts/build-static.mjs` copies only deployable assets into `dist/`. There is no bundler and no framework build.

**Host.** Production is Cloudflare Pages from `dist/`, custom domain `ascn.nonarkara.org`. Wrangler project name: `ascn-smart-cities-network`.

---

## How to run / fork

You need Node.js (for npm scripts and Wrangler) and, only if you re-extract PDFs, Python 3 with `pdfplumber`.

```bash
git clone https://github.com/Nonarkara/ascn-smart-cities-network.git
cd ascn-smart-cities-network
npm install
npm run check
npm run dev
```

`npm run check` validates the committed JSON and builds `dist/`. `npm run dev` serves that snapshot with Wrangler Pages (`npx wrangler pages dev dist`). Open the URL Wrangler prints (typically `http://127.0.0.1:8788`).

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run validate` | Schema and consistency checks on `data/` |
| `npm run build` | Copy deployable files to `dist/` |
| `npm run extract:data` | Rebuild `data/ascn-v2-data.json` from local PDFs |
| `npm run deploy` | Build and publish `dist/` to Cloudflare Pages |

**Re-extracting (optional).** Place the public source PDFs in `.tmp/ascn-sources/` using the filenames in `scripts/extract_ascn_data.py`, then:

```bash
python3 -m pip install pdfplumber
python3 scripts/extract_ascn_data.py
npm run validate
```

**Forking.** Copy the repo, keep the license notice, point the data layer at whatever public reports you have the right to use, and replace the illustration if it no longer describes your project. You do not need this author’s Cloudflare account. You do not need secrets from this repository — there are none to copy.

**Deploying your own Pages project** (only if you already have a Cloudflare login):

```bash
npx wrangler pages project create ascn-smart-cities-network --production-branch main
npm run deploy
```

Attach a custom domain in the Cloudflare dashboard if you want one. Do not put account IDs, API tokens, or wrangler secrets in git.

---

## License

Copyright (c) 2026 Non Arkaraprasertkul.

This independent project is released under the MIT License. See [LICENSE](LICENSE).

ASEAN, ASCN, and member-state names, documents, and marks remain with their respective owners. Their appearance here is citation and commentary, not a license grant and not an official product claim.
