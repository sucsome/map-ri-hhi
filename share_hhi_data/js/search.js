import { state, emit } from './config.js';
import { fmtInt } from './config.js';

const input = () => document.getElementById('search-input');
const dropdown = () => document.getElementById('search-suggestions');

let entries = null;
let activeIdx = -1;
let currentResults = [];

function buildEntries() {
  if (entries) return entries;
  const d = state.data;
  const col = (name) => d.cols.indexOf(name);
  const cName = col('NAME20'), cGeoid = col('GEOID20'), cName3 = col('name3'), cCounty = col('county_nam'),
    cName2 = col('name2'), cLon = col('lon'), cLat = col('lat');
  entries = [];

  for (const row of d.blocks) {
    const label = row[cName] || row[cName3] || row[cGeoid];
    const sub = `${row[cName3] || ''} · ${row[cCounty] || ''}`.replace(/^ · | · $/g, '');
    entries.push({
      kind: 'block',
      key: row[cGeoid],
      label,
      sub,
      text: `${label} ${row[cGeoid]} ${row[cName2] || ''} ${row[cName3] || ''} ${row[cCounty] || ''}`.toLowerCase(),
      lon: row[cLon],
      lat: row[cLat],
      score: 0
    });
  }

  for (const t of d.tracts) {
    entries.push({
      kind: 'tract',
      key: t.key,
      label: t.label,
      sub: `${t.label} · ${fmtInt(t.blockCount)} blocks`,
      text: `${t.label} ${t.key} ${t.id}`.toLowerCase(),
      bounds: t.bounds
    });
  }

  for (const c of d.counties) {
    entries.push({
      kind: 'county',
      key: c.key,
      label: c.label,
      sub: `${fmtInt(c.blockCount)} blocks · ${fmtInt(c.pop)} residents`,
      text: c.label.toLowerCase(),
      bounds: c.bounds
    });
  }
  return entries;
}

function search(q) {
  if (!q) return [];
  const all = buildEntries();
  const tokens = q.trim().toLowerCase().split(/\s+/);
  const out = [];
  for (const e of all) {
    let ok = true;
    for (const t of tokens) {
      if (!e.text.includes(t)) { ok = false; break; }
    }
    if (!ok) continue;
    e.score = 0;
    const label = e.label.toLowerCase();
    if (label.startsWith(q.toLowerCase())) e.score += 200;
    if (e.text.startsWith(q.toLowerCase())) e.score += 100;
    if (tokens.some((t) => e.label.toLowerCase().includes(t) || e.kind === 'county')) e.score += 10;
    if (e.kind === 'block' && /^\d/.test(q) && e.text.includes(q)) e.score += 5;
    out.push(e);
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 8);
}

function render(results) {
  const dd = dropdown();
  activeIdx = -1;
  if (!results.length) {
    dd.innerHTML = '<div class="s-item muted">No matches</div>';
    dd.classList.add('open');
    return;
  }
  dd.innerHTML = '';
  results.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 's-item' + (i === activeIdx ? ' active' : '');
    item.dataset.idx = i;
    const tag = document.createElement('span');
    tag.className = 's-tag';
    tag.textContent = r.kind === 'block' ? 'BLOCK' : r.kind === 'tract' ? 'TRACT' : 'COUNTY';
    const main = document.createElement('div');
    main.className = 's-main';
    const l = document.createElement('div');
    l.className = 's-label';
    l.textContent = r.label;
    const s = document.createElement('div');
    s.className = 's-sub';
    s.textContent = r.sub;
    main.appendChild(l);
    main.appendChild(s);
    item.appendChild(tag);
    item.appendChild(main);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pick(r);
    });
    dd.appendChild(item);
  });
  dd.classList.add('open');
}

function pick(r) {
  input().value = '';
  close();
  if (r.kind === 'block') {
    emit('search-select', { kind: 'block', key: r.key, lon: r.lon, lat: r.lat });
  } else {
    emit('search-select', { kind: r.kind, key: r.key });
  }
}

function close() {
  dropdown().classList.remove('open');
}

function move(dir) {
  const items = [...dropdown().querySelectorAll('.s-item')];
  if (!items.length) return;
  activeIdx = (activeIdx + dir + items.length) % items.length;
  items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
}

export function initSearch() {
  const inp = input();
  inp.addEventListener('input', () => {
    const q = inp.value;
    if (!q.trim()) { close(); return; }
    if (!state.data) {
      dropdown().innerHTML = '<div class="s-item muted">Loading block index…</div>';
      dropdown().classList.add('open');
      return;
    }
    render(search(q));
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    if (e.key === 'Enter') {
      const items = [...dropdown().querySelectorAll('.s-item')];
      if (items.length && activeIdx >= 0) items[activeIdx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      else if (items.length && state.data) {
        const results = search(inp.value);
        if (results.length) pick(results[0]);
      }
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search')) close();
  });
}
