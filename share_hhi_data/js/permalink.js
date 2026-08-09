import { state } from './config.js';

export function serialize() {
  const m = state.map;
  const c = m.getCenter();
  const lon = c.lng.toFixed(5);
  const lat = c.lat.toFixed(5);
  const z = m.getZoom().toFixed(1);
  const v = state.variable;
  let sel = '';
  if (state.selection) {
    const s = state.selection;
    if (s.kind === 'block') sel = 'b:' + s.geoid;
    else sel = (s.kind === 'county' ? 'c:' : 't:') + s.key;
  }
  return `#v/${lon}/${lat}/${z}/${v}/${encodeURIComponent(sel)}`;
}

export function write() {
  const next = serialize();
  if (location.hash !== next) history.replaceState(null, '', next);
}

export function parse() {
  const m = /^#v\/([\d.+-]+)\/([\d.+-]+)\/([\d.]+(?:\.[\d]+)?)\/([\w]+)\/(.*)$/.exec(location.hash);
  if (!m) return null;
  const selRaw = decodeURIComponent(m[5] || '');
  let selection = null;
  if (selRaw.startsWith('b:')) selection = { kind: 'block', geoid: selRaw.slice(2) };
  else if (selRaw.startsWith('c:')) selection = { kind: 'county', key: selRaw.slice(2) };
  else if (selRaw.startsWith('t:')) selection = { kind: 'tract', key: selRaw.slice(2) };
  return {
    lon: parseFloat(m[1]),
    lat: parseFloat(m[2]),
    zoom: parseFloat(m[3]),
    variable: m[4],
    selection
  };
}
