export const RI_BOUNDS = [[-71.9073, 41.0958], [-71.0886, 42.0188]];
export const RI_MAX_BOUNDS = [[-72.01, 40.99], [-70.99, 42.12]];

export const HHI_COLORS = {
  diverse: '#67a9cf',
  mid: '#f7f7f7',
  segregated: '#d73027',
  nodata: '#dcdcdc'
};

export const VARIABLES = [
  {
    id: 'race_hhi',
    label: 'Racial HHI',
    field: 'race_hhi',
    zeroIsNoData: true,
    gradient: ['#67a9cf', '#d1e5f0', '#f7f7f7', '#fdae61', '#f46d43', '#d73027'],
    stops: [2000, 4000, 5874, 7500, 8500, 10000],
    min: 2000,
    max: 10000,
    fmt: (v) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })),
    unit: '0–10,000'
  },
  {
    id: 'log_race_h',
    label: 'log(Race HHI)',
    field: 'log_race_h',
    zeroIsNoData: true,
    gradient: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
    stops: [0, 2.5, 5, 7.5, 10],
    min: 0,
    max: 10,
    fmt: (v) => (v == null ? '—' : Number(v).toFixed(2)),
    unit: 'natural log'
  },
  {
    id: 'total_pop',
    label: 'Total Population',
    field: 'total_pop',
    zeroIsNoData: true,
    gradient: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b'],
    stops: [0, 5, 25, 75, 200],
    min: 0,
    max: 200,
    fmt: (v) => (v == null ? '—' : Number(v).toLocaleString()),
    unit: 'residents'
  },
  {
    id: 'HOUSING20',
    label: 'Housing Units',
    field: 'HOUSING20',
    zeroIsNoData: true,
    gradient: ['#fff7ec', '#fee8c8', '#fdbb84', '#e34a33', '#7f0000'],
    stops: [0, 5, 15, 40, 100],
    min: 0,
    max: 100,
    fmt: (v) => (v == null ? '—' : Number(v).toLocaleString()),
    unit: 'units'
  }
];

export function fillExpression(varId) {
  const v = VARIABLES.find((x) => x.id === varId);
  const pairs = v.stops.flatMap((s, i) => [s, v.gradient[i]]);
  if (v.zeroIsNoData) {
    return [
      'case',
      ['==', ['coalesce', ['get', v.field], 0], 0], '#dcdcdc',
      ['interpolate', ['linear'], ['get', v.field], ...pairs, v.stops[v.stops.length - 1] * 2, v.gradient[v.gradient.length - 1]]
    ];
  }
  return ['interpolate', ['linear'], ['get', v.field], ...pairs];
}

export function varInfo(varId) {
  return VARIABLES.find((x) => x.id === varId);
}

export const GROUPS = {
  'HHI & Segregation': ['rank_pct', 'race_hhi', 'log_race_h'],
  'Population & Housing': ['total_pop', 'POP20', 'HOUSING20', 'log_pop'],
  'Identifiers': ['GEOID20', 'GEOIDFQ20', 'geo_id', 'geo_id_str', 'STATEFP20', 'COUNTYFP20', 'TRACTCE20', 'BLOCKCE20', 'MTFCC20', 'FUNCSTAT20'],
  'Names & Geography': ['NAME20', 'name', 'name1', 'name2', 'name3', 'county_nam', 'state_name', 'block', 'block_grou', 'block_3', 'block_no', 'census_tra', 'tract32', 'UR20', 'UACE20'],
  'Area & Centroid': ['ALAND20', 'AWATER20', 'INTPTLAT20', 'INTPTLON20', 'lat', 'lon'],
  'Source': ['year', 'v74', 'v76']
};

export const FIELD_META = {
  rank_pct: { label: 'Segregation percentile', fmt: (v) => (v == null ? '—' : v + '%') },
  race_hhi: { label: 'Racial HHI', fmt: (v) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })) },
  log_race_h: { label: 'log(race_hhi)', fmt: (v) => (v == null ? '—' : Number(v).toFixed(3)) },
  total_pop: { label: 'Total population', fmt: fmtInt },
  POP20: { label: 'POP20 (census)', fmt: fmtInt },
  HOUSING20: { label: 'Housing units', fmt: fmtInt },
  log_pop: { label: 'log(population)', fmt: (v) => (v == null ? '—' : Number(v).toFixed(3)) },
  GEOID20: { label: 'GEOID20', fmt: (v) => v },
  GEOIDFQ20: { label: 'GEOIDFQ20', fmt: (v) => v },
  geo_id: { label: 'geo_id', fmt: fmtInt },
  geo_id_str: { label: 'geo_id_str', fmt: (v) => v },
  STATEFP20: { label: 'State FIPS', fmt: (v) => v },
  COUNTYFP20: { label: 'County FIPS', fmt: (v) => v },
  TRACTCE20: { label: 'Tract code', fmt: (v) => v },
  BLOCKCE20: { label: 'Block code', fmt: (v) => v },
  MTFCC20: { label: 'MTFCC', fmt: (v) => v },
  FUNCSTAT20: { label: 'FUNCSTAT', fmt: (v) => v },
  NAME20: { label: 'Census name', fmt: (v) => v },
  name: { label: 'Full name', fmt: (v) => v },
  name1: { label: 'Block name', fmt: (v) => v },
  name2: { label: 'Block group', fmt: (v) => v },
  name3: { label: 'Tract name', fmt: (v) => v },
  county_nam: { label: 'County', fmt: (v) => v },
  state_name: { label: 'State', fmt: (v) => v },
  block: { label: 'Block', fmt: (v) => v },
  block_grou: { label: 'Block group #', fmt: (v) => v },
  block_3: { label: 'block_3', fmt: (v) => v },
  block_no: { label: 'Block #', fmt: fmtInt },
  census_tra: { label: 'Tract #', fmt: fmtInt },
  tract32: { label: 'tract32', fmt: fmtInt },
  ALAND20: { label: 'Land area (m²)', fmt: fmtInt },
  AWATER20: { label: 'Water area (m²)', fmt: fmtInt },
  INTPTLAT20: { label: 'Centroid latitude', fmt: (v) => v },
  INTPTLON20: { label: 'Centroid longitude', fmt: (v) => v },
  lat: { label: 'lat', fmt: (v) => (v == null ? '—' : v.toFixed(6)) },
  lon: { label: 'lon', fmt: (v) => (v == null ? '—' : v.toFixed(6)) },
  UR20: { label: 'Urban / rural', fmt: (v) => (v == null ? '—' : (v === 'R' ? 'Rural' : v === 'U' ? 'Urban' : v)) },
  UACE20: { label: 'Urban area code', fmt: (v) => (v == null ? '—' : v) },
  year: { label: 'Census year', fmt: fmtInt },
  v74: { label: 'v74', fmt: (v) => (v == null ? '—' : v) },
  v76: { label: 'v76', fmt: (v) => (v == null ? '—' : v) }
};

export function fmtInt(v) {
  return v == null || v === '' ? '—' : Number(v).toLocaleString();
}

/* --- tiny event bus + shared state --- */
const listeners = new Map();
export function on(ev, fn) {
  if (!listeners.has(ev)) listeners.set(ev, new Set());
  listeners.get(ev).add(fn);
  return () => listeners.get(ev).delete(fn);
}
export function emit(ev, data) {
  const set = listeners.get(ev);
  if (set) for (const fn of set) fn(data);
}

export const state = {
  map: null,
  variable: 'race_hhi',
  selection: null, // { kind: 'block'|'county'|'tract', key, ... }
  data: null
};
