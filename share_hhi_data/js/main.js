import { state, on, emit, VARIABLES, fillExpression, RI_BOUNDS, RI_MAX_BOUNDS } from './config.js';
import { renderLegend } from './legend.js';
import { initSearch } from './search.js';
import { initPanel, selectBlock, selectGroup, closePanel } from './panel.js';
import { parse as parsePermalink, write as writePermalink } from './permalink.js';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const ARCHIVE = 'ri_data_v2.pmtiles';
const RAW_BASE = 'https://raw.githubusercontent.com/sucsome/map-ri-hhi/main/share_hhi_data';

function isPmtiles(bytes) {
  if (bytes.byteLength < 16) return false;
  const d = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < 7; i++) s += String.fromCharCode(d[i]);
  return s === 'PMTiles';
}

async function loadPmtiles() {
  let bytes = await (await fetch(ARCHIVE)).arrayBuffer();
  if (!isPmtiles(bytes)) {
    bytes = await (await fetch(`${RAW_BASE}/${ARCHIVE}`)).arrayBuffer();
  }
  const arr = new Uint8Array(bytes);
  const source = {
    getKey: () => ARCHIVE,
    getBytes: (offset, length) => Promise.resolve({ data: arr.slice(offset, offset + length).buffer })
  };
  window.__pmtiles = new pmtiles.PMTiles(source);
  protocol.add(window.__pmtiles);
}

async function fetchData(rel) {
  try {
    const r = await fetch(rel);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    const r = await fetch(`${RAW_BASE}/${rel}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} (fallback)`);
    return await r.json();
  }
}

let hoveredGid = null;

function selectedFilter(geoid) {
  return ['==', ['get', 'GEOID20'], geoid || ''];
}

function buildStyle() {
  return {
    version: 8,
    sources: {
      ri: { type: 'vector', url: 'pmtiles://ri_data_v2.pmtiles' },
      'ri-outline': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ece9e2' } },
      {
        id: 'ri-choropleth', type: 'fill', source: 'ri', 'source-layer': 'ri_data',
        paint: { 'fill-color': fillExpression(state.variable) }
      },
      {
        id: 'ri-selected', type: 'line', source: 'ri', 'source-layer': 'ri_data',
        filter: selectedFilter(''),
        paint: { 'line-color': '#7f1d1d', 'line-width': 2.5 }
      },
      {
        id: 'ri-hover', type: 'fill', source: 'ri', 'source-layer': 'ri_data',
        filter: selectedFilter(''),
        paint: { 'fill-color': 'rgba(0, 0, 0, 0.22)' }
      },
      {
        id: 'ri-outlines', type: 'line', source: 'ri', 'source-layer': 'ri_data',
        paint: {
          'line-color': '#ffffff',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.35, 12, 0.15, 13, 0],
          'line-width': 0.5
        }
      },
      {
        id: 'ri-boundary', type: 'line', source: 'ri-outline',
        paint: { 'line-color': '#4a4a4a', 'line-width': 1.2, 'line-opacity': 0.75 }
      }
    ]
  };
}

function initMap() {
  const map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(),
    maxBounds: RI_MAX_BOUNDS
  });
  state.map = map;
  window.__map = map;
  map.fitBounds(RI_BOUNDS, { padding: 8, duration: 0 });

  fetchData('ri_outline.geojson')
    .then((gj) => map.getSource('ri-outline').setData(gj))
    .catch((err) => toast('Failed to load state outline', err));

  map.on('click', 'ri-choropleth', (e) => {
    const gid = e.features[0].properties.GEOID20;
    selectBlock(gid);
  });

  map.on('mousemove', 'ri-choropleth', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    const gid = e.features[0].properties.GEOID20;
    if (gid && gid !== hoveredGid) {
      hoveredGid = gid;
      map.setFilter('ri-hover', selectedFilter(gid));
    }
  });

  map.on('mouseleave', 'ri-choropleth', () => {
    map.getCanvas().style.cursor = '';
    hoveredGid = null;
    map.setFilter('ri-hover', selectedFilter(''));
  });

  map.on('moveend', () => writePermalink());

  return map;
}

function setVariable(id) {
  state.variable = id;
  state.map.setPaintProperty('ri-choropleth', 'fill-color', fillExpression(id));
  renderLegend(id);
  emit('var', id);
  writePermalink();
}

function applySelection(sel) {
  state.selection = sel;
  if (sel && sel.kind === 'block') {
    state.map.setFilter('ri-selected', selectedFilter(sel.geoid));
  } else {
    state.map.setFilter('ri-selected', selectedFilter(''));
  }
  writePermalink();
}

function flyGroup(kind, key) {
  const d = state.data;
  const list = kind === 'county' ? d.counties : d.tracts;
  const g = list.find((x) => x.key === key);
  if (g) state.map.fitBounds(g.bounds, { padding: 60, duration: 1000 });
}

async function loadData() {
  state.data = await fetchData('data/block_props.json');
  document.getElementById('search-input').disabled = false;
  document.getElementById('search-input').placeholder = 'Search block, tract, county, or GEOID…';
}

function applyPermalink(p) {
  if (!p) return;
  state.map.jumpTo({ center: [p.lon, p.lat], zoom: p.zoom });
  setVariable(VARIABLES.some((v) => v.id === p.variable) ? p.variable : 'race_hhi');
  if (p.selection) {
    if (p.selection.kind === 'block') selectBlock(p.selection.geoid);
    else {
      flyGroup(p.selection.kind, p.selection.key);
      selectGroup(p.selection.kind, p.selection.key);
    }
  }
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement?.id !== 'search-input') closePanel();
});

document.getElementById('variable').addEventListener('change', (e) => setVariable(e.target.value));

const aboutBtn = document.getElementById('about-btn');
const aboutModal = document.getElementById('about-modal');
aboutBtn.addEventListener('click', () => aboutModal.showModal());
document.getElementById('about-close').addEventListener('click', () => aboutModal.close());
aboutModal.addEventListener('click', (e) => {
  if (e.target === aboutModal) aboutModal.close();
});

on('search-select', (r) => {
  if (r.kind === 'block') {
    state.map.flyTo({ center: [r.lon, r.lat], zoom: 14, duration: 900 });
    selectBlock(r.key);
  } else {
    flyGroup(r.kind, r.key);
    selectGroup(r.kind, r.key);
  }
});

on('selection', (sel) => applySelection(sel));
on('var', () => writePermalink());

async function boot() {
  initPanel();
  initSearch();
  await loadPmtiles();
  const map = initMap();
  map.on('load', () => {
    renderLegend(state.variable);
  });

  const selectEl = document.getElementById('variable');
  for (const v of VARIABLES) {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.label;
    selectEl.appendChild(opt);
  }
  selectEl.value = state.variable;

  try {
    await loadData();
  } catch (err) {
    toast('Failed to load block index — search & details limited to map features');
    console.error(err);
  }
  applyPermalink(parsePermalink());
}

boot();
