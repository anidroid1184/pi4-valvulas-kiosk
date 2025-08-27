/*
  Sistema de Identificación de Válvulas - Landing demo (sin frameworks)
  Reglas clave:
  - Toda info no confirmada inicia con "[No verificado]" en UI
  - No se inyecta HTML desde datos: siempre se escapan cadenas
  - Accesible: roles ARIA, foco, teclado (Enter/Space abre, Esc cierra)
*/

(() => {
  'use strict';

  // Config
  const IMAGE_FOLDER = 'STATIC/IMG/'; // legacy fallback only
  const IMAGE_LIST_JSON = IMAGE_FOLDER + 'index.json'; // legacy fallback only
  const METADATA_JSON = 'valvulas.json'; // opcional en raíz de landing
  const BACKEND = 'http://localhost:8000';

  // Estado
  let state = {
    valvulas: [],
    map: new Map(),
    lastActivator: null,
    mediaStream: null
  };

  // Utils
  function sanitize(text) {
    return String(text)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // --- Cámara: abrir/cerrar vista previa ---
  async function openCamera(){
    try{
      const panel = document.getElementById('cameraPanel');
      const video = document.getElementById('cameraVideo');
      const btnOpen = document.getElementById('btnAbrirCam');
      const btnClose = document.getElementById('btnCerrarCam');

      if(state.mediaStream){ return; }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
      state.mediaStream = stream;
      video.srcObject = stream;

      panel.hidden = false;
      btnOpen.hidden = true;
      btnClose.hidden = false;
      setStatus('[No verificado] Cámara abierta (vista previa)');
    }catch(err){
      console.error(err);
      setStatus('[No verificado] No fue posible acceder a la cámara');
    }
  }

  async function closeCamera(){
    try{
      const panel = document.getElementById('cameraPanel');
      const video = document.getElementById('cameraVideo');
      const btnOpen = document.getElementById('btnAbrirCam');
      const btnClose = document.getElementById('btnCerrarCam');

      if(state.mediaStream){
        for(const track of state.mediaStream.getTracks()){
          track.stop();
        }
        state.mediaStream = null;
      }
      if(video){ video.srcObject = null; }
      panel.hidden = true;
      btnOpen.hidden = false;
      btnClose.hidden = true;
      setStatus('');
    }catch(_){
      setStatus('');
    }
  }

  // --- Simulación de QR: abre detalle aleatorio ---
  function simulateQR(){
    if(!state.valvulas || !state.valvulas.length){
      setStatus('[No verificado] No hay válvulas para simular');
      return;
    }
    const idx = Math.floor(Math.random() * state.valvulas.length);
    const v = state.valvulas[idx];
    onValveSelect(v.id);
  }

  // --- Navbar: listeners ---
  function setupNavbar(){
    const btnQR = document.getElementById('btnSimularQR');
    const btnOpen = document.getElementById('btnAbrirCam');
    const btnClose = document.getElementById('btnCerrarCam');

    if(btnQR){ btnQR.addEventListener('click', simulateQR); }
    if(btnOpen){ btnOpen.addEventListener('click', openCamera); }
    if(btnClose){ btnClose.addEventListener('click', closeCamera); }
  }

  function setStatus(msg){
    const el = document.getElementById('status');
    el.textContent = msg || '';
  }

  // Carga de metadatos desde valvulas.json (si existe)
  async function loadMetadata(){
    try{
      const res = await fetch(METADATA_JSON, { cache:'no-store' });
      if(!res.ok) return null;
      const data = await res.json();
      if(!Array.isArray(data)) return null;
      return data;
    }catch(_){
      return null;
    }
  }

  // Descubrimiento de imágenes: preferir backend /images/index para evitar copias
  // Estructura esperada: { items: [{ id, image, count }] }
  async function discoverImagesFromFolder(){
    // 1) Backend index
    try{
      const res = await fetch(`${BACKEND}/images_index`, { cache:'no-store' });
      if(res.ok){
        const data = await res.json();
        if(data && Array.isArray(data.items) && data.items.length){
          // Convertir a lista de objetos válvula mínima
          return data.items.map(it => ({ id: it.id, imagen: `${BACKEND}${it.image}`, nombre: tituloFromFilename(it.id) }));
        }
      }
    }catch(_){/* ignorar */}

    // 2) Legacy STATIC/IMG/index.json
    try{
      const res = await fetch(IMAGE_LIST_JSON, { cache:'no-store' });
      if(res.ok){
        const data = await res.json();
        if(data && Array.isArray(data.images) && data.images.length){
          return data.images.filter(x => typeof x === 'string').map(file => ({ id: file.replace(/\.[^.]+$/, ''), imagen: IMAGE_FOLDER + file, nombre: tituloFromFilename(file) }));
        }
      }
    }catch(_){/* ignorar */}

    // Fallback: lista mínima para demo. Sustituye por tus archivos reales.
    return ['valvula1.png','valvula2.png','valvula3.png'];
  }

  // Construye datos ficticios para cada imagen (prefijo obligatorio [No verificado])
  function buildFallbackValveData(imageList){
    const usedIds = new Set();
    const out = [];

    for(const item of imageList){
      const file = typeof item === 'string' ? item : (item.imagen || '');
      const base = typeof item === 'string' ? file.replace(/\.[^.]+$/, '') : (item.id || 'valvula');
      let id = base.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
      // Evitar colisiones: sufijo incremental
      let suffix = 1;
      while(usedIds.has(id)){
        id = `${id}-${suffix++}`;
      }
      usedIds.add(id);

      const nombre = item && item.nombre ? item.nombre : tituloFromFilename(base);
      out.push({
        id,
        nombre,
        tipo: '[No verificado] Tipo no especificado',
        ubicacion: '[No verificado] Ubicación no especificada',
        estado: '[No verificado] Estado no especificado',
        ultima_revision: '[No verificado] Sin registro',
        notas: '[No verificado] Ficha generada automáticamente para demostración.',
        imagen: typeof item === 'string' ? (IMAGE_FOLDER + file) : item.imagen
      });
    }
    return out;
  }

  function tituloFromFilename(base){
    const pretty = base
      .replace(/[_-]+/g,' ')
      .replace(/\b(valvula)\b/i,'Válvula')
      .trim();
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }

  // Render del menú en grid
  function renderMenu(valvulas){
    const grid = document.getElementById('grid');
    grid.innerHTML = '';

    if(!valvulas || !valvulas.length){
      setStatus('[No verificado] No se encontraron válvulas en STATIC/IMG.');
      return;
    }

    const frag = document.createDocumentFragment();

    for(const v of valvulas){
      state.map.set(v.id, v);

      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-label', `Abrir detalles de ${sanitize(v.nombre)}`);
      card.dataset.id = v.id;

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = v.imagen;
      img.alt = `${sanitize(v.nombre)} (${v.id})`;
      img.addEventListener('error', () => {
        img.replaceWith(placeholderImage());
      }, { passive:true });

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = v.nombre;

      const subtitle = document.createElement('div');
      subtitle.className = 'subtitle';
      subtitle.textContent = '[No verificado] Toque para ver detalles';

      card.append(img, title, subtitle);
      addActivationHandlers(card, () => onValveSelect(v.id));

      frag.appendChild(card);
    }

    grid.appendChild(frag);
  }

  function placeholderImage(){
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = '[No verificado] Imagen no disponible';
    return ph;
  }

  // Handlers de activación accesibles (click/touch/teclado)
  function addActivationHandlers(el, handler){
    el.addEventListener('click', handler);
    el.addEventListener('pointerup', (e)=>{ if(e.pointerType){ handler(); } });
    el.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        handler();
      }
    });
  }

  function onValveSelect(id){
    state.lastActivator = document.activeElement;
    const v = state.map.get(id) || buildFallbackValveData([id + '.png'])[0];
    renderPanel(v);
  }

  // Resolver de código escaneado a ID válido del catálogo
  function findValveId(code){
    if(!code) return null;
    const raw = String(code);
    if(state.map.has(raw)) return raw;
    const lower = raw.toLowerCase();
    if(state.map.has(lower)) return lower;
    const sanitized = lower.replace(/[^a-z0-9_-]+/g,'-');
    if(state.map.has(sanitized)) return sanitized;
    // intento por nombre
    for(const [id, v] of state.map.entries()){
      if(String(v.nombre).toLowerCase() === lower){
        return id;
      }
    }
    return null;
  }

  function renderPanel(info){
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-desc');
    const closeBtn = document.getElementById('closeBtn');

    title.textContent = sanitize(info.nombre || '[No verificado] Válvula');

    // Construir contenido seguro
    const parts = [];
    if(info.notas){ parts.push(sanitize(String(info.notas))); }
    if(info.estado){ parts.push(`[No verificado] Estado: ${sanitize(info.estado.replace(/^\[No verificado\]\s*/i,''))}`); }
    if(info.ubicacion){ parts.push(`[No verificado] Ubicación: ${sanitize(info.ubicacion.replace(/^\[No verificado\]\s*/i,''))}`); }
    if(info.ultima_revision){ parts.push(`[No verificado] Última revisión: ${sanitize(String(info.ultima_revision).replace(/^\[No verificado\]\s*/i,''))}`); }
    if(typeof info.presion_operacion_bar === 'number'){
      parts.push(`[No verificado] Presión operación: ${sanitize(info.presion_operacion_bar)} bar`);
    }
    if(typeof info.caudal_l_min === 'number'){
      parts.push(`[No verificado] Caudal: ${sanitize(info.caudal_l_min)} L/min`);
    }

    // Render como texto, sin innerHTML
    body.innerHTML = '';
    for(const p of parts){
      const badge = document.createElement('div');
      badge.className = 'badge ok';
      badge.textContent = p;
      body.appendChild(badge);
    }

    function escHandler(e){ if(e.key === 'Escape'){ closePanel(); } }
    function bgHandler(){ closePanel(); }

    overlay.hidden = false;
    modal.hidden = false;
    document.addEventListener('keydown', escHandler);
    overlay.addEventListener('click', bgHandler, { once:true });

    closeBtn.onclick = () => closePanel();
    closeBtn.focus();

    // Guardar para limpieza
    modal._escHandler = escHandler;
  }

  function closePanel(){
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('modal');

    if(!modal.hidden){
      document.removeEventListener('keydown', modal._escHandler);
    }

    overlay.hidden = true;
    modal.hidden = true;

    if(state.lastActivator && typeof state.lastActivator.focus === 'function'){
      state.lastActivator.focus();
    }
  }

  async function initApp(){
    setStatus('[No verificado] Cargando…');

    const [meta, images] = await Promise.all([
      loadMetadata(),
      discoverImagesFromFolder()
    ]);

    let catalog = [];
    // Si hay metadata verificada, úsala. Si no, construimos catálogo con el backend index.
    if(meta && meta.length){
      catalog = meta;
    } else {
      catalog = buildFallbackValveData(images || []);
    }

    state.valvulas = catalog;
    renderMenu(catalog);
    setStatus('');
    setupNavbar();
  }

  // Exponer funciones principales para pruebas manuales en consola si se requiere
  window.ValvulasApp = {
    initApp, loadMetadata, discoverImagesFromFolder, buildFallbackValveData,
    renderMenu, onValveSelect, renderPanel, closePanel, sanitize, findValveId,
    openCamera, closeCamera, simulateQR
  };

  document.addEventListener('DOMContentLoaded', initApp, { once:true });
})();
