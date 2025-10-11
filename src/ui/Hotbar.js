// Hotbar.js — thumbnails + labels + selected highlight
export class Hotbar {
  constructor(rootEl) {
    this.root  = rootEl;
    this.slots = [];
    this.index = 0;
  }
  setCatalog(list){
    this.root.innerHTML = '';
    this.slots = [];
    list.slice(0,10).forEach((a, i)=>{
      const slot = document.createElement('div');
      slot.className = 'slot';

      const th = document.createElement('div');
      th.className = 'thumb';
      th.style.background = swatch(a);

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = a.name;

      slot.appendChild(th); slot.appendChild(label);
      this.root.appendChild(slot);
      slot.addEventListener('click', () => this.select(i));
      this.slots.push(slot);
    });
    this.select(0);
  }
  select(i){
    if (!this.slots.length) return;
    this.index = (i + this.slots.length) % this.slots.length;
    this.slots.forEach((s, j) => s.classList.toggle('selected', j === this.index));
  }
  selectNext(){ this.select(this.index + 1); }
  selectPrev(){ this.select(this.index - 1); }
}

function swatch(a){
  // slightly “tech” look per part kind
  const c = a.preview || '#8aa';
  const g = (hi, lo)=>`linear-gradient(135deg, ${hi}, ${lo})`;
  switch (a.kind){
    case 'wall': return g(shade(c,10), shade(c,-12));
    case 'flat': return g(shade(c,14), shade(c,-10));
    default:     return c;
  }
}
function shade(hex, amt){
  try{
    const n=parseInt(hex.slice(1),16); let r=n>>16&255,g=n>>8&255,b=n&255;
    r=Math.max(0,Math.min(255,r+Math.round(2.55*amt)));
    g=Math.max(0,Math.min(255,g+Math.round(2.55*amt)));
    b=Math.max(0,Math.min(255,b+Math.round(2.55*amt)));
    return `#${(r<<16|g<<8|b).toString(16).padStart(6,'0')}`;
  }catch{ return hex; }
}