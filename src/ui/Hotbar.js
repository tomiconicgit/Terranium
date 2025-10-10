import { PARTS } from '../tools/Builder.js';

export function initUI(builder){
  const hotbar = document.getElementById('hotbar');
  const palette = document.getElementById('palette');
  const grid = document.getElementById('paletteGrid');
  const btnBlocks = document.getElementById('blocksBtn');
  const btnCopy = document.getElementById('copyBtn');

  // Build palette tiles
  grid.innerHTML = '';
  PARTS.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'tile';
    el.title = p.label;
    el.innerHTML = `<div class="swatch" style="background:${hex(p.color)}"></div>`;
    el.onclick = ()=>{ select(p.id); palette.style.display='none'; };
    grid.appendChild(el);
  });

  // Hotbar = first 10 parts (or repeat if fewer)
  const barParts = Array.from({length:10}, (_,i)=> PARTS[i % PARTS.length]);
  hotbar.innerHTML = '';
  barParts.forEach((p,i)=>{
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.id = p.id;
    slot.innerHTML = `<div class="swatch" style="background:${hex(p.color)}"></div>`;
    slot.onclick = ()=>select(p.id);
    hotbar.appendChild(slot);
  });

  function updateHighlight(id){
    [...hotbar.children].forEach(el=> el.classList.toggle('active', el.dataset.id===id));
  }

  function select(id){
    builder.setActive(id);
    updateHighlight(id);
  }

  // default
  select(barParts[0].id);

  btnBlocks.onclick = ()=> palette.style.display = (palette.style.display==='block'?'none':'block');

  btnCopy.onclick = ()=>{
    const data = builder.exportJSON();
    const modal = document.createElement('div');
    modal.className='modal'; modal.style.display='block'; modal.style.width='480px';
    modal.innerHTML = `<h3>Placed items JSON</h3>
      <div style="padding:10px">
        <textarea style="width:100%;height:40vh">${data}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn" style="position:static" id="copyNow">Copy to Clipboard</button>
          <button class="btn" style="position:static" id="closeNow">Close</button>
        </div>
      </div>`;
    document.getElementById('hud').appendChild(modal);
    modal.querySelector('#copyNow').onclick = async ()=>{ try{ await navigator.clipboard.writeText(data);}catch{} };
    modal.querySelector('#closeNow').onclick = ()=> modal.remove();
  };

  // API back to main/builder
  function selectByOffset(delta){
    const ids = barParts.map(p=>p.id);
    const cur = ids.indexOf(builder.getActive());
    const next = ( (cur>=0?cur:0) + delta + ids.length ) % ids.length;
    select(ids[next]);
  }

  return { select, selectByOffset, updateHighlight };
}

function hex(c){ return '#'+('000000'+c.toString(16)).slice(-6); }