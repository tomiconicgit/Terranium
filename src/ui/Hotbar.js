// Hotbar.js — 10 slots with thumbnail preview + label + selected highlight

export class Hotbar {
  constructor(rootEl) {
    this.root = rootEl;
    this.slots = [];
    this.index = 0;

    // Asset catalog definition is provided by Builder (so Hotbar stays dumb UI).
    // Here we only render what we get.
  }

  setCatalog(list) {
    this.root.innerHTML = '';
    this.slots = [];
    list.slice(0,10).forEach((asset, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const th = document.createElement('div');
      th.className = 'thumb';
      th.style.background = asset.preview;
      th.textContent = asset.previewText || '';
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
    this.index = (i+this.slots.length) % this.slots.length;
    this.slots.forEach((s, j) => s.classList.toggle('selected', j === this.index));
  }

  selectNext() { this.select(this.index + 1); }
  selectPrev() { this.select(this.index - 1); }
}