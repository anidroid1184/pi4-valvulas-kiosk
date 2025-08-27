/*
  Sistema de Identificación de Válvulas - Landing demo (sin frameworks)
  Reglas clave:
  - No se inyecta HTML desde datos: siempre se escapan cadenas
  - Accesible: roles ARIA, foco, teclado (Enter/Space abre, Esc cierra)
*/

(() => {
  'use strict';

  // Config
  const IMAGE_FOLDER = 'STATIC/IMG/'; // legacy fallback only
  const IMAGE_LIST_JSON = IMAGE_FOLDER + 'index.json'; // supports mapping {ref:[files...]}
  const METADATA_JSON = 'valvulas.json'; // opcional en raíz de landing
  const BACKEND = 'http://localhost:8000';

  // Estado
  let state = {
    valvulas: [],
    map: new Map(),
    lastActivator: null,
    imagesIndex: null // { ref: [files...] }
  };

  // Precalentamiento
  const PREFETCH_PER_REF = 3;   // cuántas imágenes del carrusel preparar
  const HIGH_PRIORITY_FIRST = 12; // cuántas portadas priorizar en la grilla

  // Utils
  function sanitize(text) {
    return String(text)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // Pre-carga de imágenes del carrusel para una referencia
  function warmupRef(ref){
    if(!state.imagesIndex || !state.imagesIndex[ref]) return;
    const files = state.imagesIndex[ref].slice(0, PREFETCH_PER_REF);
    for(const f of files){
      const url = IMAGE_FOLDER + ref + '/' + f;
      const im = new Image();
      try{ im.fetchPriority = 'low'; }catch(_){}
      im.decoding = 'async';
      im.src = url;
    }
  }

  // Construye un carrusel básico con controles y swipe
  function buildCarousel(urls, id){
    const root = document.createElement('div');
    root.className = 'carousel';

    const track = document.createElement('div');
    track.className = 'carousel-track';
    root.appendChild(track);

    urls.forEach((u, idx) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      const img = document.createElement('img');
      img.src = u;
      img.alt = `Imagen ${idx+1}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      slide.appendChild(img);
      track.appendChild(slide);
    });

    let current = 0;

    function update(){
      const offset = -current * 100;
      track.style.transform = `translateX(${offset}%)`;
      // update dots
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    const prev = document.createElement('button');
    prev.className = 'carousel-btn prev';
    prev.type = 'button';
    prev.textContent = '‹';
    prev.addEventListener('click', () => { current = (current - 1 + urls.length) % urls.length; update(); });
    const next = document.createElement('button');
    next.className = 'carousel-btn next';
    next.type = 'button';
    next.textContent = '›';
    next.addEventListener('click', () => { current = (current + 1) % urls.length; update(); });

    root.append(prev, next);

    // dots
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'carousel-dots';
    const dots = urls.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'carousel-dot';
      b.addEventListener('click', () => { current = i; update(); });
      dotsWrap.appendChild(b);
      return b;
    });
    root.appendChild(dotsWrap);

    // swipe
    let startX = null;
    root.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive:true });
    root.addEventListener('touchend', (e) => {
      if(startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if(Math.abs(dx) > 40){
        if(dx < 0) current = (current + 1) % urls.length; else current = (current - 1 + urls.length) % urls.length;
        update();
      }
      startX = null;
    }, { passive:true });

    update();
    return root;
  }

  // --- Cámara: delegar en CameraQR (html5-qrcode) ---
  async function openCamera(){
    if(window.CameraQR && typeof window.CameraQR.open === 'function'){
      return window.CameraQR.open();
    }
  }

  async function closeCamera(){
    try{
      if(window.CameraQR && typeof window.CameraQR.close === 'function'){
        await window.CameraQR.close();
      }
      setStatus('');
    }catch(_){ setStatus(''); }
  }

  // (Simulación de QR eliminada)

  // --- Navbar: listeners ---
  function setupNavbar(){
    // Desplegable
    const navToggle = document.getElementById('btnNavToggle');
    const navItems = document.getElementById('navItems');
    if(navToggle && navItems){
      navToggle.addEventListener('click', () => {
        const expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
      });
      // Cerrar al seleccionar una opción en móviles
      navItems.addEventListener('click', (e) => {
        const target = e.target;
        if(target && target.matches && target.matches('button.nav-btn')){
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const btnOpen = document.getElementById('btnAbrirCam');
    const btnClose = document.getElementById('btnCerrarCam');

    if(btnOpen){ btnOpen.addEventListener('click', openCamera); }
    if(btnClose){ btnClose.addEventListener('click', closeCamera); }

    // Tabs principales: Imágenes, Lector QR (usa cameraPanel), Modelo AI
    const tabImages = document.getElementById('btnTabImages');
    const tabQR = document.getElementById('btnTabQR');
    const tabAI = document.getElementById('btnTabAI');
    const imagesPanel = document.getElementById('imagesPanel');
    const cameraPanel = document.getElementById('cameraPanel');
    const aiPanel = document.getElementById('aiPanel');

    function setActive(tab){
      for(const el of [tabImages, tabQR, tabAI]){
        if(!el) continue;
        const active = el === tab;
        el.classList.toggle('active', active);
        if(active){ el.setAttribute('aria-current', 'page'); }
        else { el.removeAttribute('aria-current'); }
      }
    }

    function showPanels(target){
      // Hide all
      if(imagesPanel) imagesPanel.hidden = true;
      if(cameraPanel) {
        // Si abandonamos la cámara, cerrarla para liberar recursos
        if(!cameraPanel.hidden && target !== 'qr'){
          closeCamera();
        }
        cameraPanel.hidden = true;
      }
      if(aiPanel) aiPanel.hidden = true;

      // Show target
      if(target === 'images' && imagesPanel) imagesPanel.hidden = false;
      if(target === 'qr' && cameraPanel) cameraPanel.hidden = false;
      if(target === 'ai' && aiPanel) aiPanel.hidden = false;
    }

    if(tabImages){ tabImages.addEventListener('click', () => { setActive(tabImages); showPanels('images'); }); }
    if(tabQR){ tabQR.addEventListener('click', () => { setActive(tabQR); showPanels('qr'); }); }
    if(tabAI){ tabAI.addEventListener('click', () => { setActive(tabAI); showPanels('ai'); }); }

    // Estado inicial: Imágenes activas
    if(tabImages){ setActive(tabImages); }
    showPanels('images');
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

  // Descubrimiento de imágenes: preferir backend /images_index; si no, usar STATIC/IMG/index.json
  // Estructuras soportadas:
  // - Backend: { items: [{ id, image, count }] }
  // - Mapping: { "<ref>": ["img1.jpg", ...] }
  // - Legacy: { images: ["file1.jpg", ...] }
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

    // 2) STATIC/IMG/index.json (mapping o legacy)
    try{
      const res = await fetch(IMAGE_LIST_JSON, { cache:'no-store' });
      if(res.ok){
        const data = await res.json();
        // Nuevo formato mapeado por referencia: { ref: [files...] }
        if(data && !Array.isArray(data)){
          state.imagesIndex = data; // guardar para carrusel
          const refs = Object.keys(data).sort();
          return refs.map(ref => {
            const files = Array.isArray(data[ref]) ? data[ref] : [];
            const cover = files.length ? files[0] : null;
            const imagen = cover ? (IMAGE_FOLDER + ref + '/' + cover) : (IMAGE_FOLDER + 'placeholder.png');
            // nombre debe ser exactamente la referencia (nombre de carpeta)
            return { id: ref, ref, imagen, nombre: ref };
          });
        }
        // Formato legacy
        if(data && Array.isArray(data.images) && data.images.length){
          return data.images.filter(x => typeof x === 'string').map(file => ({ id: file.replace(/\.[^.]+$/, ''), imagen: IMAGE_FOLDER + file, nombre: tituloFromFilename(file) }));
        }
      }
    }catch(_){/* ignorar */}

    // Fallback: lista mínima para demo. Sustituye por tus archivos reales.
    return ['valvula1.png','valvula2.png','valvula3.png'];
  }

  // Construye datos ficticios para cada imagen (sin prefijos de aviso)
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
        tipo: 'Tipo no especificado',
        ubicacion: 'Ubicación no especificada',
        estado: 'Estado no especificado',
        ultima_revision: 'Sin registro',
        notas: 'Ficha generada automáticamente para demostración.',
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
      setStatus('No se encontraron válvulas en STATIC/IMG.');
      return;
    }

    const frag = document.createDocumentFragment();

    let idx = 0;
    for(const v of valvulas){
      state.map.set(v.id, v);

      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-label', `Abrir detalles de ${sanitize(v.nombre)}`);
      card.dataset.id = v.id;
      if(v.ref){ card.dataset.ref = v.ref; }

      const img = document.createElement('img');
      // Carga ansiosa de portadas
      img.loading = 'eager';
      if(idx < HIGH_PRIORITY_FIRST){ try{ img.fetchPriority = 'high'; }catch(_){} }
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
      subtitle.textContent = 'Toca para ver detalles';

      card.append(img, title, subtitle);
      addActivationHandlers(card, () => onValveSelect(v.id));

      // Precalentar imágenes del carrusel al pasar el mouse o enfocar
      if(v.ref){
        const warm = () => warmupRef(v.ref);
        card.addEventListener('mouseenter', warm, { once:true, passive:true });
        card.addEventListener('focus', warm, { once:true, passive:true });
      }

      frag.appendChild(card);
      idx++;
    }

    grid.appendChild(frag);
  }

  function placeholderImage(){
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = 'Imagen no disponible';
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
    if(!v.ref) v.ref = id; // asumir referencia = id
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

    title.textContent = sanitize(info.nombre || 'Válvula');

    // Reset body
    body.innerHTML = '';

    // Carrusel (hasta 3 imágenes) si tenemos índice y referencia
    const ref = info.ref || info.id;
    if(state.imagesIndex && ref && state.imagesIndex[ref]){
      const files = state.imagesIndex[ref].slice(0, 3);
      const urls = files.map(f => IMAGE_FOLDER + ref + '/' + f);
      const carousel = buildCarousel(urls, `${ref}-carousel`);
      body.appendChild(carousel);
    } else if(info.imagen){
      // Fallback: solo portada
      const img = document.createElement('img');
      img.src = info.imagen;
      img.alt = title.textContent + ' - portada';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      body.appendChild(img);
    }

    // Construir contenido seguro (badges)
    const parts = [];
    if(info.notas){ parts.push(sanitize(String(info.notas))); }
    if(info.estado){ parts.push(`Estado: ${sanitize(info.estado.replace(/^\[No verificado\]\s*/i,''))}`); }
    if(info.ubicacion){ parts.push(`Ubicación: ${sanitize(info.ubicacion.replace(/^\[No verificado\]\s*/i,''))}`); }
    if(info.ultima_revision){ parts.push(`Última revisión: ${sanitize(String(info.ultima_revision).replace(/^\[No verificado\]\s*/i,''))}`); }
    if(typeof info.presion_operacion_bar === 'number'){
      parts.push(`Presión operación: ${sanitize(info.presion_operacion_bar)} bar`);
    }
    if(typeof info.caudal_l_min === 'number'){
      parts.push(`Caudal: ${sanitize(info.caudal_l_min)} L/min`);
    }

    // Render como texto, sin innerHTML
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
    setStatus('Cargando…');

    const [meta, images] = await Promise.all([
      loadMetadata(),
      discoverImagesFromFolder()
    ]);

    let catalog = [];
    // Regla del cliente: si existe índice estático (mapping), SIEMPRE usarlo.
    if(state.imagesIndex){
      catalog = Array.isArray(images) ? images : buildFallbackValveData(images || []);
    } else if(meta && meta.length){
      // Si no hay mapping, usar metadata si está disponible
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
    openCamera, closeCamera
  };

  document.addEventListener('DOMContentLoaded', initApp, { once:true });
})();
