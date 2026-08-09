# Rhode Island — Racial HHI by Census Block

An interactive map that shows how racially diverse (or segregated) every census block in
Rhode Island is, based on the 2020 Census. Click a block — or **search for any address, block,
tract, or county** — and a side panel opens with that place's full data record and comparisons
to the rest of the state.

It is a single-page web app (HTML + JavaScript) served by a tiny Node.js file server. All the
data is downloaded ahead of time and stored locally — no database, no accounts, no API keys,
no cost.

---

## Quick start (2 steps)

You need [Node.js](https://nodejs.org/) installed (any recent version, 18+).

```bash
npm start
```

Then open **http://localhost:8000** in a browser (Chrome, Safari, Edge, Firefox).

That's it. The map loads, and within a second or two the search box becomes active.

---

## What am I looking at?

### The data

- **Census blocks** are the smallest geographic unit the U.S. Census Bureau publishes. Rhode
  Island has **25,649** of them. In cities a block is roughly one city block; in rural areas it
  can be a large patch of land.
- **Racial HHI** (Herfindahl–Hirschman Index) measures how concentrated a block's population is
  across racial groups. It's scaled **0–10,000**:
  - **Low (≈ 1,000–2,500)** → the block's residents are spread across several racial groups
    (racially *diverse*), shown in **blue**.
  - **High (≈ 7,500–10,000)** → one racial group makes up nearly all residents
    (racially *segregated*), shown in **red**.
  - **Grey** → the block has **no population** (farmland, parks, industrial zones), so there is
    nothing to measure.
- The legend in the bottom-left corner always reflects the variable currently shown on the map.

### The controls

| Control | What it does |
|---|---|
| **Search box** (top, center) | Type a block name (e.g. `Block 2012`), a full 15-digit **GEOID**, a census tract (e.g. `128.03`), or a county (`Providence County`). Press Enter or click a suggestion. |
| **Variable dropdown** (top, right of search) | Switches the map colors between Racial HHI, log(HHI), Total Population, and Housing Units. |
| **About** (top, right) | Short explanation of the HHI and the map. |
| **Click a block** | Selects it, outlines it on the map, and opens the side panel. |
| **Compare tab** | Shows a histogram of HHI across the whole state (with your block marked) and bars comparing your block to its county and the state. |
| **× / Esc** | Closes the side panel. |

### The side panel

When a block, tract, or county is selected, the panel on the right shows:

- A **headline number** (Racial HHI) with a color chip and the block's *segregation percentile*
  ("More segregated than X% of populated blocks").
- **Attributes** — every field the census data has for that block, grouped into readable
  sections: identifiers (GEOIDs, FIPS codes), names and geography, population & housing,
  HHI/segregation, area, and source metadata. Every value is labeled in plain English.
- **Compare** — charts putting the selection in context.

---

## Project structure (what each file does)

```
economics/
├─ index.js                    The tiny web server (static files + video-style range requests
│                              needed to stream map tiles). Port 8000 by default.
├─ package.json                Defines the "npm start" command.
├─ scripts/
│  ├─ build_data.mjs           Data build script: reads the source geojson and generates
│  │                           data/block_props.json (the app's search + detail index).
│  └─ smoke.mjs                Automated browser test that verifies the whole app works.
├─ share_hhi_data/             Everything the website actually serves (the "site root").
│  ├─ index.html               The app shell: header, search, map, side panel.
│  ├─ css/app.css              All the styling.
│  ├─ js/
│  │  ├─ main.js               Boots the app: creates the map, wires up clicks and search.
│  │  ├─ config.js             Shared settings: the map variables, colors, field labels,
│  │  │                        formatting rules, and a tiny event system.
│  │  ├─ search.js             The autocomplete search (blocks, tracts, counties).
│  │  ├─ panel.js              The side panel: all attributes + compare view.
│  │  ├─ charts.js             Small hand-drawn SVG charts (histogram + bar comparison).
│  │  ├─ legend.js             The dynamic legend.
│  │  └─ permalink.js          Encodes the current view in the URL so it can be shared.
│  ├─ data/block_props.json    Generated index: every block's full record + precomputed
│  │                           statistics (percentiles, county/tract summaries). ~12 MB.
│  ├─ ri_data_v2.pmtiles         The map tiles (vector tiles, z0–z12) used to draw the map.
│  ├─ ri_data.geojson          The original census data (all blocks, all fields) — the
│  │                           source that the build script reads.
│  └─ ri_outline.geojson       A single thin outline of Rhode Island for the border.
```

## How the data pipeline works

1. **Source data** — `share_hhi_data/ri_data.geojson` is the raw 2020 Census block data for
   Rhode Island with all 38 attribute fields (population, housing, land area, GEOIDs, names,
   plus the computed Racial HHI).
2. **The build script** (`scripts/build_data.mjs`) reads that file once and produces
   `share_hhi_data/data/block_props.json`:
   - all fields for all **25,649 blocks** (stored in a compact columnar format to keep the file
     ~12 MB instead of ~25 MB),
   - a **segregation percentile** for every populated block (computed once, at build time),
   - **summary statistics for each county and census tract** (block count, population,
     population-weighted HHI, and the most / least segregated block in each).
3. **The app** fetches that one file at startup and uses it for search and for the side panel.
   The map itself is drawn from `ri_data_v2.pmtiles` (pre-built vector tiles).

To regenerate the index after changing the source data:

```bash
node scripts/build_data.mjs
```

## Testing

`scripts/smoke.mjs` drives a real (headless) Chrome browser against the running app and checks
the full user journey — search, fly-to, panel contents, tab switching, variable switching, and
URL sharing round-trip.

```bash
# with the server already running on :8000
node scripts/smoke.mjs
```

Expect: `23/23 checks passed`.

---

## Sharing with a collaborator (free)

Because this repo is **public** on GitHub, the simplest free options are:

1. **Share the repo link** — anyone can clone it and run `npm start`. No account needed to
   view, though they need GitHub (free) + Node.js to run it. They can also *fork* it and make
   their own version.
   `https://github.com/sucsome/map-ri-hhi`

2. **GitHub Pages — a live link, no install needed.** GitHub hosts the website for free at
   `https://sucsome.github.io/map-ri-hhi/`. The collaborator just opens the link in a browser.
   (The site files live in `share_hhi_data/`, so enabling Pages requires a one-time setup to
   serve that folder — see `#github-pages` below if you want it.)

### GitHub Pages (optional one-time setup)

The app is fully static and speaks plain HTTP range requests, so GitHub Pages can host it. Two
small changes make it work:

1. Create a `docs/` folder at the repo root (GitHub Pages can serve a `docs/` folder, but not
   an arbitrary subfolder like `share_hhi_data/`). Either move the site files there, or
   duplicate them with a redirect stub at the repo root.
2. In the repo on GitHub: **Settings → Pages → Deploy from a branch → main → /docs → Save.**

Then share `https://sucsome.github.io/map-ri-hhi/`. The 90 MB source geojson stays out of the
way (Pages only serves what's in `docs/`).

> A redirect stub approach: keep `index.html` at the repo root that simply does
> `<meta http-equiv="refresh" content="0; url=/map-ri-hhi/share_hhi_data/">`, and add
> `share_hhi_data/` to the deployed branch. This avoids duplicating files.

### Other free hosting (alternative to Pages)

- **Netlify / Cloudflare Pages / Vercel** — all have a free tier, drag-and-drop or git-based
  deploys, and would host this app unchanged. They require creating a (free) account.

---

## FAQ / troubleshooting

- **The map is blank grey.** Make sure you opened the site from the server (`http://localhost:8000`)
  and not by double-clicking the HTML file — the file server's range requests are required to
  stream the tiles.
- **Search says "Loading block index…" forever.** Check the browser console; the most likely
  cause is `data/block_props.json` not being reachable (wrong working directory when starting
  the server, or a path change).
- **Where did the numbers come from?** The block-level Racial HHI and the population/housing
  counts come from the 2020 Census (via the `ri_data.geojson` source file). All other fields are
  the census's own attributes preserved as-is.
- **Can I change the colors?** Yes — the color ramps, class breaks, and field labels are all
  defined in one place: `share_hhi_data/js/config.js`.

## Technical notes

- Built with **MapLibre GL JS v5** (map rendering), **PMTiles v3** (offline-capable tile
  container), and plain JavaScript ES modules — no build step, no bundler, no front-end
  dependencies beyond two CDN libraries.
- The URL encodes the full state (`#v/longitude/latitude/zoom/variable/selection`), so any view
  can be bookmarked or pasted into a chat message.
- Tiles were generated with [tippecanoe](https://github.com/felt/tippecanoe) (z0–z12, layer
  name `ri_data`) and verified to contain **all 25,649 GEOIDs** — 0 missing, 0 extra.

## License

Private research project. Data © U.S. Census Bureau (public domain); code and app © the
author(s). Reach out before redistributing.
