const SVG = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function elSize(el, w, h) {
  const cw = el.clientWidth || 300;
  const ch = el.clientHeight || 100;
  return { w: w || cw, h: h || ch };
}

export function renderHistogram(el, values, marker, opts = {}) {
  el.innerHTML = '';
  const valid = values.filter((v) => v != null && isFinite(v));
  const { w, h } = elSize(el, opts.w, opts.h);
  if (!valid.length) {
    el.textContent = 'No data';
    return;
  }
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%' });
  el.appendChild(svg);
  const bins = opts.bins || 22;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min || 1;
  const counts = new Array(bins).fill(0);
  for (const v of valid) {
    const i = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
    counts[i]++;
  }
  const maxCount = Math.max(...counts);
  const pad = 4;
  const bw = (w - pad * 2) / bins;
  const bh = h - pad * 2;
  const base = h - pad;

  for (let i = 0; i < bins; i++) {
    const ch = (counts[i] / maxCount) * bh;
    svg.appendChild(svgEl('rect', {
      x: pad + i * bw + 0.5,
      y: base - ch,
      width: Math.max(1, bw - 1),
      height: ch,
      rx: 1,
      fill: opts.color || '#2b6cb0',
      opacity: counts[i] ? 0.85 : 0.06
    }));
  }

  if (marker != null && marker >= min && marker <= max) {
    const x = pad + ((marker - min) / span) * (w - pad * 2);
    svg.appendChild(svgEl('line', { x1: x, y1: pad, x2: x, y2: base, stroke: '#c53030', 'stroke-width': 1.5 }));
    svg.appendChild(svgEl('circle', { cx: x, cy: pad + 3, r: 2.5, fill: '#c53030' }));
  }
}

export function renderBars(el, items, opts = {}) {
  el.innerHTML = '';
  const { w, h } = elSize(el, opts.w, opts.h);
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%' });
  el.appendChild(svg);
  const padL = 6;
  const rowH = Math.max(18, Math.min(26, (h - 8) / items.length));
  const maxVal = Math.max(...items.map((i) => i.value || 0), 1);
  const labelW = opts.labelW || 110;

  items.forEach((it, idx) => {
    const y = 6 + idx * rowH;
    svg.appendChild(svgEl('text', {
      x: padL, y: y + rowH * 0.62,
      'font-size': 11, fill: it.highlight ? '#1a202c' : '#4a5568',
      'font-weight': it.highlight ? 700 : 400
    })).textContent = it.label;

    const bw = ((it.value || 0) / maxVal) * (w - labelW - 46);
    svg.appendChild(svgEl('rect', {
      x: padL + labelW, y,
      width: Math.max(1, bw),
      height: rowH - 6,
      rx: 2,
      fill: it.highlight ? (it.color || '#c53030') : (it.color || '#90cdf4')
    }));

    svg.appendChild(svgEl('text', {
      x: padL + labelW + bw + 5, y: y + rowH * 0.62,
      'font-size': 11, fill: '#2d3748'
    })).textContent = (opts.fmt || defaultFmt)(it.value);
  });
}

function defaultFmt(v) {
  return v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
}
