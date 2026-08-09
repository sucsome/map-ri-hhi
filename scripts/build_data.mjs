import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'share_hhi_data');
const GEOJSON = join(DATA_DIR, 'ri_data.geojson');
const OUT = join(DATA_DIR, 'data', 'block_props.json');

const gj = JSON.parse(readFileSync(GEOJSON, 'utf8'));
const feats = gj.features;
const norm = (s) => (s == null ? '' : String(s).trim());

const blocks = feats.map((f, i) => {
  const p = f.properties;
  return {
    GEOID20: p.GEOID20,
    GEOIDFQ20: p.GEOIDFQ20,
    STATEFP20: p.STATEFP20,
    COUNTYFP20: p.COUNTYFP20,
    TRACTCE20: p.TRACTCE20,
    BLOCKCE20: p.BLOCKCE20,
    NAME20: p.NAME20,
    MTFCC20: p.MTFCC20,
    UR20: p.UR20,
    UACE20: p.UACE20,
    FUNCSTAT20: p.FUNCSTAT20,
    ALAND20: p.ALAND20,
    AWATER20: p.AWATER20,
    INTPTLAT20: p.INTPTLAT20,
    INTPTLON20: p.INTPTLON20,
    HOUSING20: p.HOUSING20,
    POP20: p.POP20,
    name: p.name,
    total_pop: p.total_pop,
    v74: p.v74,
    v76: p.v76,
    race_hhi: p.race_hhi,
    log_race_h: p.log_race_h,
    log_pop: p.log_pop,
    name1: p.name1,
    name2: p.name2,
    name3: p.name3,
    county_nam: p.county_nam,
    state_name: p.state_name,
    block: p.block,
    block_no: p.block_no,
    block_3: p.block_3,
    block_grou: p.block_grou,
    census_tra: p.census_tra,
    tract32: p.tract32,
    geo_id: p.geo_id,
    geo_id_str: p.geo_id_str,
    year: p.year,
    lat: round(parseFloat(p.INTPTLAT20) || 0, 6),
    lon: round(parseFloat(p.INTPTLON20) || 0, 6),
    rank_pct: null,
    _bbox: bboxOf(f.geometry),
  };
});

const populated = blocks
  .filter((b) => b.total_pop > 0 && b.race_hhi > 0)
  .sort((a, b) => a.race_hhi - b.race_hhi);
const n = populated.length;
let pi = 0;
for (let i = 0; i < n; i++) {
  while (pi < n && populated[pi].race_hhi < populated[i].race_hhi) pi++;
  populated[i].rank_pct = n ? Math.round((pi / n) * 1000) / 10 : null;
}

const countyMap = new Map();
const tractMap = new Map();
for (const b of blocks) {
  group(countyMap, norm(b.county_nam) || 'Unknown', norm(b.COUNTYFP20), b, b.county_nam);
  group(tractMap, norm(b.COUNTYFP20) + '/' + norm(b.TRACTCE20), norm(b.TRACTCE20), b, b.name3);
}

const stateMap = new Map();
group(stateMap, 'RI', 'RI', null, 'Rhode Island');
for (const b of blocks) group(stateMap, 'RI', 'RI', b, 'Rhode Island');
for (const g of [...stateMap.values(), ...countyMap.values(), ...tractMap.values()]) {
  g.hhiWeighted = g._hhiPopSum ? round(g._hhiWsum / g._hhiPopSum, 1) : null;
  delete g._hhiPopSum;
  delete g._hhiWsum;
}
const state = stateMap.get('RI');
state.key = 'state';
const counties = [...countyMap.values()].sort((a, b) => a.label.localeCompare(b.label));
const tracts = [...tractMap.values()].sort((a, b) => a.label.localeCompare(b.label));

const COLS = Object.keys(blocks[0]).filter((k) => k !== '_bbox');
const rows = blocks.map((b) => COLS.map((k) => b[k]));
for (const b of blocks) delete b._bbox;

const out = {
  version: 2,
  source: 'ri_data.geojson',
  generated: new Date().toISOString(),
  state,
  counties,
  tracts,
  cols: COLS,
  blocks: rows,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
const size = readFileSync(OUT).length / 1e6;
console.log(`wrote ${OUT}`);
console.log(`blocks: ${blocks.length} | counties: ${counties.length} | tracts: ${tracts.length}`);
console.log(`state pop: ${state.pop} | weighted HHI: ${state.hhiWeighted}`);
console.log(`size: ${size.toFixed(1)} MB`);

function group(map, key, id, b, label) {
  let g = map.get(key);
  if (!g) {
    g = {
      key, id, label: label == null ? key : label,
      blockCount: 0, pop: 0, hhiWeighted: null,
      minHhi: null, maxHhi: null, minGeoid: null, maxGeoid: null,
      bounds: null, _hhiPopSum: 0, _hhiWsum: 0,
    };
    map.set(key, g);
  }
  if (b === null) return g;
  const p = Number(b.total_pop) || 0;
  const h = Number(b.race_hhi) || 0;
  g.blockCount++;
  g.pop += p;
  if (h > 0 && p > 0) { g._hhiWsum += h * p; g._hhiPopSum += p; }
  if (!g.bounds) g.bounds = [...b._bbox];
  else {
    if (b._bbox[0] < g.bounds[0]) g.bounds[0] = b._bbox[0];
    if (b._bbox[1] < g.bounds[1]) g.bounds[1] = b._bbox[1];
    if (b._bbox[2] > g.bounds[2]) g.bounds[2] = b._bbox[2];
    if (b._bbox[3] > g.bounds[3]) g.bounds[3] = b._bbox[3];
  }
  if (h > 0) {
    if (g.minHhi == null || h < g.minHhi) { g.minHhi = h; g.minGeoid = b.GEOID20; }
    if (g.maxHhi == null || h > g.maxHhi) { g.maxHhi = h; g.maxGeoid = b.GEOID20; }
  }
  return g;
}

function bboxOf(geom) {
  if (!geom) return [-71.91, 41.09, -71.08, 42.02];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
      if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return [x0, y0, x1, y1];
}

function round(v, d) {
  if (v == null || !isFinite(v)) return v;
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}
