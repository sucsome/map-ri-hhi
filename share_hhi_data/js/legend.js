import { VARIABLES, varInfo } from './config.js';

export function renderLegend(varId) {
  const v = varInfo(varId);
  const box = document.getElementById('legend');
  box.innerHTML = '';

  const title = document.createElement('h4');
  title.textContent = `${v.label} · ${v.unit}`;
  box.appendChild(title);

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.style.background = `linear-gradient(to right, ${v.gradient.join(', ')})`;
  box.appendChild(bar);

  const labels = document.createElement('div');
  labels.className = 'labels';
  const lo = document.createElement('span');
  lo.textContent = v.fmt(v.min);
  const hi = document.createElement('span');
  hi.textContent = v.fmt(v.max);
  labels.appendChild(lo);
  labels.appendChild(hi);
  box.appendChild(labels);

  if (v.zeroIsNoData) {
    const nodata = document.createElement('div');
    nodata.className = 'nodata';
    nodata.innerHTML = '<span class="swatch"></span>No population / no data';
    box.appendChild(nodata);
  }
}
