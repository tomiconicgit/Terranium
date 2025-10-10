// Hotbar.js — simple UI, thumbnails + labels, selected highlight
export class Hotbar {
  constructor(rootEl) {
    this.root = rootEl;
    this.slots = [];
    this.index = 0;
  }

  setCatalog(list) {
    this.root.innerHTML = '';
    this.slots = [];
    list.slice(0,10).forEach((asset, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';

      const th = document.createElement('div');
      th.className = 'thumb';
      th.style.background = swatch(asset);
      if (asset.kind === 'pipe') { th.style.background = 'transparent'; th.style.border = `4px solid ${asset.preview||'#caa555'}`; th.style.borderRadius='50%'; }

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = asset.name;

      slot.appendChild(th);
      slot.appendChild(label);
      this.root.appendChild(slot);
      this.slots.push(slot);
    });
    this.select(0);
  }

  select(i) {
    if (!this.slots.length) return;
    this.index = (i + this.slots.length) % this.slots.length;
    this.slots.forEach((s, j) => s.classList.toggle('selected', j === this.index));
  }
  selectNext(){ this.select(this.index + 1); }
  selectPrev(){ this.select(this.index - 1); }
}

function swatch(a) {
  const c = a.preview || '#8aa';
  if (a.kind === 'block')  return `linear-gradient(135deg, ${shade(c,14)}, ${shade(c,-10)})`;
  if (a.kind === 'slab')   return `linear-gradient(180deg, ${shade(c,10)}, ${shade(c,-12)})`;
  if (a.kind === 'window') return 'rgba(100,160,220,0.45)';
  return c;
}
function shade(hex, amt) {
  try {
    const n = parseInt(hex.slice(1), 16);
    let r = (n>>16)&255, g=(n>>8)&255, b=n&255;
    r = clamp(r + Math.round(2.55*amt), 0, 255);
    g = clamp(g + Math.round(2.55*amt), 0, 255);
    b = clamp(b + Math.round(2.55*amt), 0, 255);
    return `#${(r<<16|g<<8|b).toString(16).padStart(6,'0')}`;
  } catch { return hex; }
}
function clamp(x,a,b){ return Math.min(b, Math.max(a,x)); }