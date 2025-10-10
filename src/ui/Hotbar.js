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
    el.innerHTML = `<div class="swatch" style="background:${toHex(p.color)}"></div>`;
    el.onclick = ()=>{ select(p.id); palette.style.display='none'; };
    grid.appendChild(el);
  });

  // Hotbar (10 slots). Fill first N with parts.
  for (let i=0;i<10;i++){
    const slot = document.createElement('div'); slot.className='slot'; slot.dataset.index=i;
    const part = PARTS[i] ?? PARTS[0];
    slot.innerHTML = `<div class="swatch" style="background:${toHex(part.color)}"></div>`;
    slot.onclick = ()=>select(part.id);
    hotbar.appendChild(slot);
  }
  hotbar.firstChild.classList.add('active');
  builder.setActive(PARTS[0].id);

  function select(id){
    builder.setActive(id);
    // mark matching swatch active (first one)
    const color = toHex(PARTS.find(p=>p.id===id).color);
    [...hotbar.children].forEach(s=>s.classList.remove('active'));
    let chosen = [...hotbar.children].find(s=>s.querySelector('.swatch').style.background === color);
    if(!chosen){ chosen = hotbar.children[0]; }
    chosen.classList.add('active');
  }

  btnBlocks.onclick = ()=>{
    palette.style.display = (palette.style.display==='block' ? 'none':'block');
  };

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
    modal.querySelector('#copyNow').onclick = async ()=>{
      try{ await navigator.clipboard.writeText(data);}catch{}
    };
    modal.querySelector('#closeNow').onclick = ()=> modal.remove();
  };
}

function toHex(c){
  return '#'+('000000'+c.toString(16)).slice(-6);
}