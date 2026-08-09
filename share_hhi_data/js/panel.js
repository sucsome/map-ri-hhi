import { state, emit, varInfo, FIELD_META, GROUPS, HHI_COLORS, fmtInt } from './config.js';
import { renderHistogram, renderBars } from './charts.js';

let current = null;
let hhiCache = null;

function rowProps(row) {
  const d = state.data;
  const o = {};
  for (let i = 0; i < d.cols.length; i++) o[d.cols[i]] = row[i];
  return o;
}

function blockByGeoid(geoid) {
  const d = state.data;
  if (!d._byId) {
    d._byId = new Map();
    for (const row of d.blocks) d._byId.set(row[d.cols.indexOf('GEOID20')], row);
  }
  return d._byId.get(geoid);
}

function statewideHhi() {
  const d = state.data;
  if (!hhiCache) {
    const col = d.cols.indexOf('race_hhi');
    hhiCache = [];
    for (const row of d.blocks) {
      const h = row[col];
      if (h > 0) hhiCache.push(h);
    }
  }
  return hhiCache;
}

function el(id) {
  return document.getElementById(id);
}

export function isOpen() {
  return current !== null;
}

export function openPanel() {
  el('panel').classList.add('open');
  document.body.classList.add('panel-open');
}

export function closePanel() {
  current = null;
  el('panel').classList.remove('open');
  document.body.classList.remove('panel-open');
  emit('selection', null);
}

export function selectBlock(geoid) {
  const row = blockByGeoid(geoid);
  if (!row) return;
  current = { kind: 'block', key: geoid, geoid };
  openPanel();
  renderBlock(rowProps(row));
  emit('selection', current);
}

export function selectGroup(kind, key) {
  const d = state.data;
  const list = kind === 'county' ? d.counties : d.tracts;
  const g = list.find((x) => x.key === key);
  if (!g) return;
  current = { kind, key, geoid: null };
  openPanel();
  renderGroup(g, kind);
  emit('selection', current);
}

function setTab(tab) {
  el('tab-attrs').classList.toggle('active', tab === 'attrs');
  el('tab-compare').classList.toggle('active', tab === 'compare');
  document.querySelectorAll('#panel-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
}

function hhiChip(hhi) {
  if (hhi == null || hhi <= 0) return `<span class="chip nodata">No population</span>`;
  const low = 2000, high = 10000;
  const t = Math.max(0, Math.min(1, (hhi - low) / (high - low)));
  const color = mixColor('#67a9cf', '#d73027', t);
  return `<span class="chip" style="background:${color}">HHI ${hhi.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>`;
}

function mixColor(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  const ch = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}
function hex(c) {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
}

function renderBlock(p) {
  el('panel-title').textContent = p.NAME20 || p.name1 || 'Census Block';
  el('panel-sub').textContent = `${p.name3 || ''} · ${p.county_nam || ''}`.replace(/^ · | · $/g, '') || p.GEOID20;
  el('panel-copy').style.display = 'inline-flex';

  const attrs = el('tab-attrs');
  attrs.innerHTML = '';

  const hero = document.createElement('div');
  hero.className = 'hero';
  const hhi = p.race_hhi;
  hero.innerHTML = `
    <div class="hero-num">${hhi > 0 ? hhi.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}</div>
    <div class="hero-lbl">Race HHI (0–10,000)</div>
    ${hhiChip(hhi)}
    <div class="hero-rank">${p.rank_pct != null ? `More segregated than <b>${p.rank_pct}%</b> of populated blocks` : 'No population data'}</div>`;
  attrs.appendChild(hero);

  for (const [section, fields] of Object.entries(GROUPS)) {
    const s = document.createElement('section');
    s.className = 'attr-section';
    const h = document.createElement('h5');
    h.textContent = section;
    s.appendChild(h);
    const table = document.createElement('table');
    for (const f of fields) {
      const meta = FIELD_META[f] || { label: f, fmt: (v) => (v == null ? '—' : v) };
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = meta.label;
      const td2 = document.createElement('td');
      td2.textContent = meta.fmt(p[f]);
      if (p[f] == null || p[f] === '') td2.classList.add('na');
      tr.appendChild(td1);
      tr.appendChild(td2);
      table.appendChild(tr);
    }
    s.appendChild(table);
    attrs.appendChild(s);
  }

  const cmp = el('tab-compare');
  cmp.innerHTML = '';
  const cmpHeader = document.createElement('h5');
  cmpHeader.textContent = 'Context vs state';
  cmp.appendChild(cmpHeader);

  const histLbl = document.createElement('div');
  histLbl.className = 'chart-lbl';
  histLbl.textContent = 'This block in the statewide HHI distribution';
  cmp.appendChild(histLbl);
  const hist = document.createElement('div');
  hist.className = 'chart hist';
  hist.style.height = '90px';
  cmp.appendChild(hist);
  renderHistogram(hist, statewideHhi(), hhi > 0 ? hhi : null);

  const barLbl = document.createElement('div');
  barLbl.className = 'chart-lbl';
  barLbl.textContent = 'Average segregation (pop-weighted HHI)';
  cmp.appendChild(barLbl);
  const bars = document.createElement('div');
  bars.className = 'chart bars';
  bars.style.height = '90px';
  cmp.appendChild(bars);

  const county = state.data.counties.find((c) => c.key === p.county_nam);
  const items = [
    { label: 'This block', value: hhi, color: '#c53030', highlight: true },
    { label: p.county_nam || 'County', value: county && county.hhiWeighted, color: '#2b6cb0' },
    { label: 'Rhode Island', value: state.data.state.hhiWeighted, color: '#90cdf4' }
  ];
  renderBars(bars, items);

  setTab('attrs');
}

function renderGroup(g, kind) {
  el('panel-title').textContent = g.label;
  el('panel-sub').textContent =
    kind === 'county' ? `County · ${fmtInt(g.blockCount)} blocks · ${fmtInt(g.pop)} residents` : `Census tract · ${fmtInt(g.blockCount)} blocks · ${fmtInt(g.pop)} residents`;
  el('panel-copy').style.display = 'none';

  const attrs = el('tab-attrs');
  attrs.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.innerHTML = `
    <div class="hero-num">${g.hhiWeighted != null ? g.hhiWeighted.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}</div>
    <div class="hero-lbl">Population-weighted HHI</div>
    ${hhiChip(g.hhiWeighted)}
    <div class="hero-rank">${fmtInt(g.pop)} residents across ${fmtInt(g.blockCount)} census blocks</div>`;
  attrs.appendChild(hero);

  const s = document.createElement('section');
  s.className = 'attr-section';
  const h = document.createElement('h5');
  h.textContent = 'Summary';
  s.appendChild(h);
  const table = document.createElement('table');
  for (const [lbl, val] of [
    ['Blocks', fmtInt(g.blockCount)],
    ['Population', fmtInt(g.pop)],
    ['Weighted HHI', g.hhiWeighted != null ? g.hhiWeighted.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'],
    ['Least segregated block', linkTo(g.minGeoid, g.minHhi)],
    ['Most segregated block', linkTo(g.maxGeoid, g.maxHhi)]
  ]) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = lbl;
    const td2 = document.createElement('td');
    td2.innerHTML = val;
    tr.appendChild(td1);
    tr.appendChild(td2);
    table.appendChild(tr);
  }
  s.appendChild(table);
  attrs.appendChild(s);

  const cmp = el('tab-compare');
  cmp.innerHTML = '';
  const cmpHeader = document.createElement('h5');
  cmpHeader.textContent = 'Distribution within this area';
  cmp.appendChild(cmpHeader);

  const vals = blocksInGroup(g, kind);
  const hist = document.createElement('div');
  hist.className = 'chart hist';
  hist.style.height = '90px';
  cmp.appendChild(hist);
  renderHistogram(hist, vals, g.hhiWeighted, { color: '#2b6cb0' });

  const vsState = document.createElement('div');
  vsState.className = 'chart-lbl';
  vsState.textContent = 'Weighted HHI: this area vs state';
  cmp.appendChild(vsState);
  const bars = document.createElement('div');
  bars.className = 'chart bars';
  bars.style.height = '70px';
  cmp.appendChild(bars);
  renderBars(bars, [
    { label: g.label, value: g.hhiWeighted, color: '#2b6cb0', highlight: true },
    { label: 'Rhode Island', value: state.data.state.hhiWeighted, color: '#90cdf4' }
  ]);

  setTab('attrs');
}

function linkTo(geoid, hhi) {
  if (!geoid) return '—';
  const id = hhi == null ? geoid : hhi.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `<a href="#" class="geoid-link" data-geoid="${geoid}">${id}</a>`;
}

function blocksInGroup(g, kind) {
  const d = state.data;
  const colCounty = d.cols.indexOf('county_nam');
  const colCnty = d.cols.indexOf('COUNTYFP20');
  const colTract = d.cols.indexOf('TRACTCE20');
  const colHhi = d.cols.indexOf('race_hhi');
  const out = [];
  for (const row of d.blocks) {
    let inGroup;
    if (kind === 'county') {
      inGroup = row[colCounty] === g.key || row[colCnty] === g.id;
    } else {
      const [ccounty, ctract] = String(g.key).split('/');
      inGroup = row[colCnty] === ccounty && row[colTract] === ctract;
    }
    if (inGroup) {
      const h = row[colHhi];
      if (h > 0) out.push(h);
    }
  }
  return out;
}

export function copyGeoid() {
  if (!current || current.kind !== 'block') return;
  navigator.clipboard?.writeText(current.geoid).then(() => {
    const btn = el('panel-copy');
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = 'Copy GEOID'), 1200);
  });
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-geoid]');
  if (t) {
    e.preventDefault();
    selectBlock(t.dataset.geoid);
  }
});

export function initPanel() {
  el('panel-close').addEventListener('click', closePanel);
  el('panel-copy').addEventListener('click', copyGeoid);
  document.querySelectorAll('#panel-tabs button').forEach((b) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });
}
