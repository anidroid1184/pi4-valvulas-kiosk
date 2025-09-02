/*
  Sistema de Identificación de Válvulas - Landing demo (sin frameworks)
  Reglas clave:
  - No se inyecta HTML desde datos: siempre se escapan cadenas
  - Accesible: roles ARIA, foco, teclado (Enter/Space abre, Esc cierra)
*/

(() => {
  'use strict';

  // Config
  const IMAGE_FOLDER = 'STATIC/IMG/card-photos/'; // carpeta para portadas por referencia
  const IMAGE_LIST_JSON = IMAGE_FOLDER + 'index.json'; // formato: { images: ["file1.jpg", ...] }
  const BANKS_JSON = IMAGE_FOLDER + 'banks.json'; // opcional: { "152860": "A", ... } o [{id,banco,ubicacion}]
  const FORCE_LEGACY_STATIC = true; // forzar carga desde index.json de card-photos
  const METADATA_JSON = 'valvulas.json'; // opcional en raíz de landing
  const BACKEND = 'http://localhost:8000';

  // Estado
  let state = {
    valvulas: [],
    map: new Map(),
    lastActivator: null,
    imagesIndex: null, // { ref: [files...] }
    bankFilters: new Set(), // bancos activos (A/B/C/D)
    hasBankData: false // true si alguna válvula tiene banco detectable
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

<<<<<<< HEAD
  // Detecta el banco (A/B/C/D) desde un objeto válvula. Usa campo 'banco' si existe
  // o intenta inferirlo desde 'nombre', 'ubicacion', 'notas' o 'id/ref'.
  function getBank(v){
    if(!v) return null;
    let raw = v.banco || v.bank || '';
    if(typeof raw === 'string' && raw.trim()){ raw = raw.trim().toUpperCase(); }
    const tryFields = [raw, v.nombre, v.ubicacion, v.notas, v.id, v.ref].filter(Boolean);
    for(const f of tryFields){
      const s = String(f).toUpperCase();
      if(/BANC?O\s*A\b/.test(s) || /\bBANK\s*A\b/.test(s) || s === 'A'){ return 'A'; }
      if(/BANC?O\s*B\b/.test(s) || /\bBANK\s*B\b/.test(s) || s === 'B'){ return 'B'; }
      if(/BANC?O\s*C\b/.test(s) || /\bBANK\s*C\b/.test(s) || s === 'C'){ return 'C'; }
      if(/BANC?O\s*D\b/.test(s) || /\bBANK\s*D\b/.test(s) || s === 'D'){ return 'D'; }
    }
    return null;
  }

  // Devuelve un conjunto de bancos inferidos para una válvula
  function getValveBanks(v){
    const out = new Set();
    const b = getBank(v);
    if(b) out.add(b);
    const fields = [v?.ubicacion, v?.notas, v?.nombre].filter(Boolean);
    for(const f of fields){
      const s = String(f).toUpperCase();
      if(/\bA\b/.test(s) || /BANC?O\s*A\b/.test(s)) out.add('A');
      if(/\bB\b/.test(s) || /BANC?O\s*B\b/.test(s)) out.add('B');
      if(/\bC\b/.test(s) || /BANC?O\s*C\b/.test(s)) out.add('C');
      if(/\bD\b/.test(s) || /BANC?O\s*D\b/.test(s)) out.add('D');
    }
    return out;
  }

  function datasetHasBankData(list){
    try{
      const arr = Array.isArray(list) ? list : state.valvulas;
      for(const v of arr){ if(getValveBanks(v).size) return true; }
      return false;
    }catch(_){ return false; }
  }

  // Aplica filtros combinados: texto + bancos
  function applyFilters(query){
    const q = String(query || '').trim().toLowerCase();
    let list = state.valvulas || [];

    const canFilterByBank = state.hasBankData || datasetHasBankData(list);
    if(canFilterByBank && state.bankFilters && state.bankFilters.size){
      list = list.filter(v => {
        const vbanks = getValveBanks(v);
        for(const b of vbanks){ if(state.bankFilters.has(b)) return true; }
        return false;
      });
    }

    if(q){
      list = list.filter(v => {
        const ref = String(v.ref || v.id || '').toLowerCase();
        const nom = String(v.nombre || '').toLowerCase();
        const ubi = String(v.ubicacion || '').toLowerCase();
        return ref.includes(q) || nom.includes(q) || ubi.includes(q);
      });
    }

    const countEl = document.getElementById('searchCount');
    if(countEl){ countEl.textContent = (q || (state.bankFilters && state.bankFilters.size)) ? `${list.length} resultados` : ''; }
    renderMenu(list);
  }

=======
>>>>>>> parent of 180c12e (Colores de los botones adaptados)
  // Normaliza URLs por si un índice antiguo incluye subcarpetas espurias como "images/"
  function normalizeCardPhotoUrl(url){
    let out = String(url || '');
    // Quitar cualquier segmento '/images/' justo después de 'card-photos/'
    out = out.replace(/(card-photos\/)images\//i, '$1');
    // Colapsar separadores múltiples
    out = out.replace(/\\+/g,'/');
    return out;
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
    const tabAIRecognize = document.getElementById('btnTabAIRecognize');
    const tabAITrain = document.getElementById('btnTabAITrain');
    const tabUpload = document.getElementById('btnTabUpload');
    const imagesPanel = document.getElementById('imagesPanel');
    const cameraPanel = document.getElementById('cameraPanel');
    const aiPanel = document.getElementById('aiPanel'); // reconocer con IA
    const aiTrainPanel = document.getElementById('aiTrainPanel');
    const uploadPanel = document.getElementById('uploadPanel');

    function setActive(tab){
      for(const el of [tabImages, tabQR, tabAIRecognize, tabAITrain, tabUpload]){
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
      if(aiTrainPanel) aiTrainPanel.hidden = true;
      if(uploadPanel) uploadPanel.hidden = true;

      // Show target
      if(target === 'images' && imagesPanel) imagesPanel.hidden = false;
      if(target === 'qr' && cameraPanel) cameraPanel.hidden = false;
      if(target === 'ai-recognize' && aiPanel) aiPanel.hidden = false;
      if(target === 'ai-train' && aiTrainPanel) aiTrainPanel.hidden = false;
      if(target === 'upload' && uploadPanel) uploadPanel.hidden = false;
    }

    if(tabImages){ tabImages.addEventListener('click', () => { setActive(tabImages); showPanels('images'); }); }
    if(tabQR){ tabQR.addEventListener('click', () => { setActive(tabQR); showPanels('qr'); }); }
    if(tabAIRecognize){ tabAIRecognize.addEventListener('click', () => { setActive(tabAIRecognize); showPanels('ai-recognize'); }); }
    if(tabAITrain){ tabAITrain.addEventListener('click', () => { setActive(tabAITrain); showPanels('ai-train'); }); }
    if(tabUpload){ tabUpload.addEventListener('click', () => { setActive(tabUpload); showPanels('upload'); }); }

    // Estado inicial: Imágenes activas
    if(tabImages){ setActive(tabImages); }
    showPanels('images');
  }

  function setStatus(msg){
    const el = document.getElementById('status');
    el.textContent = msg || '';
  }

  // --- Búsqueda en la pestaña Imágenes ---
  function setupSearch(){
    const input = document.getElementById('searchBox');
    const btnClear = document.getElementById('btnClearSearch');
    const countEl = document.getElementById('searchCount');

    if(!input) return;

    let timer = null;
    const debounce = (fn) => {
      clearTimeout(timer);
      timer = setTimeout(fn, 140);
    };

    const apply = (q) => applyFilters(q);
    input.addEventListener('input', () => debounce(() => apply(input.value)));
    input.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ input.value=''; apply(''); input.blur(); } });
    if(btnClear){ btnClear.addEventListener('click', () => { input.value=''; apply(''); input.focus(); }); }

    // Primera carga sin filtro
    apply('');
  }

  // Chips para filtrar por banco A/B/C/D
  function setupBankFilters(){
    const wrap = document.getElementById('bankFilters');
    const input = document.getElementById('searchBox');
    if(!wrap) return;
    const banks = ['A','B','C','D'];
    for(const b of banks){
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip chip--bank chip--bank${b}`;
      chip.textContent = b;
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => {
        if(state.bankFilters.has(b)){
          state.bankFilters.delete(b);
          chip.classList.remove('is-active');
          chip.setAttribute('aria-pressed','false');
        } else {
          state.bankFilters.add(b);
          chip.classList.add('is-active');
          chip.setAttribute('aria-pressed','true');
        }
        applyFilters(input ? input.value : '');
      });
      wrap.appendChild(chip);
    }
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
    // Modo forzado: solo lee index.json legacy y construye URLs planas
    if(FORCE_LEGACY_STATIC){
      try{
        const res = await fetch(IMAGE_LIST_JSON, { cache:'no-store' });
        if(!res.ok) return [];
        const data = await res.json();
        if(!data || !Array.isArray(data.images)) return [];
        const out = data.images
          .filter(x => typeof x === 'string')
          .map(raw => {
            const file = String(raw).trim().split('\\').pop().split('/').pop();
            const base = file.replace(/\.[^.]+$/, '');
            const url = normalizeCardPhotoUrl(IMAGE_FOLDER + file);
            return { id: base, ref: base, imagen: url, nombre: base };
          });
        try{ console.log('[IMG] mode=legacy-forced sample=', out[0]?.imagen); }catch(_){ }
        return out;
      }catch(_){ return []; }
    }

    // Si se desactiva FORCE_LEGACY_STATIC, usar la lógica completa (backend/mapping)...
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
      // Mensaje discreto dentro del grid
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Sin resultados';
      grid.appendChild(empty);
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

  async function onValveSelect(id){
    state.lastActivator = document.activeElement;
    // Base: lo que haya en memoria o un fallback mínimo
    let base = state.map.get(id) || { id: String(id), nombre: String(id) };
    base.ref = base.ref || String(id);

    // Intentar obtener detalle real desde backend
    try{
      const detail = await fetchValveDetail(String(id));
      if(detail){
        // Mantener la imagen portada previa si existe
        const merged = { ...base, ...detail, imagen: base.imagen || detail.simbolo || '' };
        renderSidebar(merged);
      } else {
        renderSidebar(base);
      }
    }catch(_){
      renderSidebar(base);
    }

    try{ closePanel(); }catch(_){}
  }

  // Resolver de código escaneado a ID válido del catálogo
  function findValveId(code){
    if(!code) return null;
    const raw = String(code).trim();

    // 1) Intentar parsear prefijos/URLs conocidos conservando el ID
    //    Soporta: "VALVE:<id>", "valve://<id>", ".../valve/<id>", "...?id=<id>"
    let extracted = null;
    try{
      // VALVE:123 o valve:123
      let m = raw.match(/^valve:\s*([^\s?#/]+)$/i);
      if(m && m[1]) extracted = m[1];

      // valve://123
      if(!extracted){
        m = raw.match(/^valve:\/\/([^\s?#/]+)$/i);
        if(m && m[1]) extracted = m[1];
      }

      // URL con /valve/<id>
      if(!extracted){
        m = raw.match(/\/valve\/([A-Za-z0-9_-]+)/i);
        if(m && m[1]) extracted = m[1];
      }

      // URL/query con ?id=<id>
      if(!extracted){
        m = raw.match(/[?&]id=([A-Za-z0-9_-]+)/i);
        if(m && m[1]) extracted = m[1];
      }
    }catch(_){ /* noop */ }

    const candidates = [];
    if(extracted){
      candidates.push(extracted);
    }
    candidates.push(raw);

    // Para cada candidato, probar variantes: tal cual, lower y saneado
    for(const cand of candidates){
      const c1 = cand;
      const c2 = String(cand).toLowerCase();
      const c3 = c2.replace(/[^a-z0-9_-]+/g,'-');
      if(state.map.has(c1)) return c1;
      if(state.map.has(c2)) return c2;
      if(state.map.has(c3)) return c3;
    }

    // intento por nombre exacto (insensible a mayúsculas)
    const lower = String(extracted || raw).toLowerCase();
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

  // --- Sidebar persistente (por ahora vacío) ---
  function renderSidebar(data){
    const title = document.getElementById('sidebarTitle');
    const body = document.getElementById('sidebarBody');
    if(!title || !body) return;

    // Título: mostrar SIEMPRE el número de referencia arriba del todo (en negrilla la etiqueta)
    if(data){
      const ref = String(data.ref || data.id || '').trim();
      if(ref){
        // Render seguro sin innerHTML
        title.innerHTML = '';
        const strong = document.createElement('strong');
        strong.textContent = 'Número de referencia:';
        title.append(strong, document.createTextNode(' ' + sanitize(ref)));
      } else {
        title.textContent = 'Detalle';
      }
    } else {
      title.textContent = 'Detalle';
    }

    body.innerHTML = '';

    if(!data){
      const ph = document.createElement('div');
      ph.className = 'subtitle';
      ph.style.margin = '6px 0 8px';
      ph.textContent = 'Selecciona una válvula para ver la información aquí.';
      body.appendChild(ph);
      return;
    }

    // Tarjeta estructurada según orden: Válvula → Número de guía → Ficha → Símbolo → Ficha técnica
    const card = document.createElement('article');
    card.className = 'valve-card fade-in hover-float';

    // Header con título
    const head = document.createElement('header');
    head.className = 'valve-card__header';
    const h3 = document.createElement('h3');
    h3.className = 'valve-card__title';
    h3.textContent = String(data.valvula || data.nombre || data.id || 'Válvula');
    head.appendChild(h3);

    // Body con secciones
    const wrap = document.createElement('div');
    wrap.className = 'valve-card__body';

    // Helper para íconos SVG (sprite offline)
    const ICON_SPRITE = 'STATIC/IMG/icons.svg';
    function icon(id){
      try{
        const svgNS = 'http://www.w3.org/2000/svg';
        const xlinkNS = 'http://www.w3.org/1999/xlink';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class','icon lg');
        const use = document.createElementNS(svgNS, 'use');
        // Compatibilidad: setear href y xlink:href
        use.setAttribute('href', `${ICON_SPRITE}#${id}`);
        try{ use.setAttributeNS(xlinkNS, 'href', `${ICON_SPRITE}#${id}`); }catch(_){ }
        svg.appendChild(use);
        return svg;
      }catch(_){ return null; }
    }

    // 1) Válvula (nombre)
    const secValve = document.createElement('section');
    secValve.className = 'valve-section';
    const secValveH = document.createElement('h3');
    secValveH.textContent = 'Válvula';
    const icValve = icon('icon-valve'); if(icValve) secValveH.prepend(icValve);
    const kv1 = document.createElement('dl');
    kv1.className = 'kv';
    const dt1 = document.createElement('dt'); dt1.textContent = 'Nombre';
    const dd1 = document.createElement('dd'); dd1.textContent = String(data.valvula || data.nombre || data.id || 'No especificado');
    kv1.append(dt1, dd1);
    secValve.append(secValveH, kv1);

    // 2) Número de guía (usar ref o id)
    const secGuide = document.createElement('section');
    secGuide.className = 'valve-section';
    const secGuideH = document.createElement('h3');
    secGuideH.textContent = 'Número de guía';
    const icGuide = icon('icon-guide'); if(icGuide) secGuideH.prepend(icGuide);
    const kv2 = document.createElement('dl'); kv2.className = 'kv';
    const dt2 = document.createElement('dt'); dt2.textContent = 'Guía';
    const dd2 = document.createElement('dd'); dd2.textContent = String(data.ref || data.id || '—');
    kv2.append(dt2, dd2);
    secGuide.append(secGuideH, kv2);

    // 3) Ficha: mini especificación (Cantidad, Ubicación, # de serie)
    const secFicha = document.createElement('section');
    secFicha.className = 'valve-section';
    const secFichaH = document.createElement('h3'); secFichaH.textContent = 'Ficha';
    const icList = icon('icon-list'); if(icList) secFichaH.prepend(icList);
    const kv3 = document.createElement('dl'); kv3.className = 'kv';
    const addKV = (label, value) => {
      if(value == null || value === '') return;
      const dtx = document.createElement('dt'); dtx.textContent = label;
      const ddx = document.createElement('dd'); ddx.textContent = String(value);
      kv3.append(dtx, ddx);
    };
    addKV('Cantidad', data.cantidad);
    // Ubicaciones como chips (si hay múltiples separadas por coma o /)
    if(data.ubicacion){
      const dtu = document.createElement('dt'); dtu.textContent = 'Ubicación';
      const ddu = document.createElement('dd');
      const chipsWrap = document.createElement('div');
      chipsWrap.style.display = 'flex';
      chipsWrap.style.flexWrap = 'wrap';
      chipsWrap.style.gap = '6px';
      const parts = String(data.ubicacion).split(/[\/,|;]+/).map(s=>s.trim()).filter(Boolean);
      if(parts.length === 0){ parts.push(String(data.ubicacion)); }
      for(const p of parts){
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = p;
        chipsWrap.appendChild(chip);
      }
      ddu.appendChild(chipsWrap);
      kv3.append(dtu, ddu);
    }
    addKV('# de serie', data.numero_serie || data.serie);
    secFicha.append(secFichaH, kv3);

    // 4) Símbolo (imagen si existe)
    if(data.simbolo){
      const secSymbol = document.createElement('section');
      secSymbol.className = 'valve-section';
      const secSymbolH = document.createElement('h3'); secSymbolH.textContent = 'Símbolo';
      const icSym = icon('icon-symbol'); if(icSym) secSymbolH.prepend(icSym);
      const img = document.createElement('img');
      img.className = 'valve-card__symbol';
      img.src = data.simbolo;
      img.alt = `${sanitize(data.nombre || data.id)} - símbolo`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => { img.replaceWith(placeholderImage()); }, { passive:true });
      secSymbol.append(secSymbolH, img);
      wrap.appendChild(secSymbol);
    }

    // 5) Ficha técnica (enlace si es URL)
    if(data.ficha_tecnica){
      const secFT = document.createElement('section');
      secFT.className = 'valve-section';
      const secFTH = document.createElement('h3'); secFTH.textContent = 'Ficha técnica';
      const icFile = icon('icon-file'); if(icFile) secFTH.prepend(icFile);
      const p = document.createElement('p');
      const isUrl = /^https?:\/\//i.test(String(data.ficha_tecnica||''));
      if(isUrl){
        const a = document.createElement('a');
        a.href = String(data.ficha_tecnica);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'valve-card__link';
        a.textContent = String(data.ficha_tecnica);
        p.appendChild(a);
      } else {
        p.textContent = String(data.ficha_tecnica);
      }
      secFT.append(secFTH, p);
      wrap.appendChild(secFT);
    }

    // Añadir secciones en orden definido
    wrap.prepend(secFicha); // ya contiene ubicaciones y cantidad
    wrap.prepend(secGuide);
    wrap.prepend(secValve);

    // Ensamblar y render
    card.append(head, wrap);
    body.appendChild(card);

    // En pantallas pequeñas, hacer scroll al sidebar para que el usuario lo vea
    try{
      if(window.matchMedia && window.matchMedia('(max-width: 1023px)').matches){
        const el = document.getElementById('sidebar');
        if(el && typeof el.scrollIntoView === 'function'){
          el.scrollIntoView({ behavior:'smooth', block:'start' });
        }
      }
    }catch(_){ }
  }

  async function initApp(){
    setStatus('Cargando…');

    const [meta, images] = await Promise.all([
      loadMetadata(),
      discoverImagesFromFolder()
    ]);

    let catalog = [];
    // Prioridad: si hay imágenes desde card-photos, usarlas SIEMPRE
    if(Array.isArray(images) && images.length){
      catalog = images;
    } else if(state.imagesIndex){
      // (No aplicará en modo FORCE_LEGACY_STATIC=true, pero mantenemos por compatibilidad)
      catalog = Array.isArray(images) ? images : buildFallbackValveData(images || []);
    } else if(meta && meta.length){
      // Solo si no hay imágenes, usa la metadata demo
      catalog = meta;
    } else {
      catalog = buildFallbackValveData(images || []);
    }

    state.valvulas = catalog;
    state.hasBankData = datasetHasBankData(catalog);
    renderMenu(catalog);
    setStatus('');
    setupNavbar();
    setupSearch();
    setupBankFilters();
    // Inicializar sidebar vacío
    renderSidebar(null);

    // Setup upload handlers
    setupUploadExcel();

    // Cargar mapeo local de bancos si existe (no bloqueante)
    try{
      const bankMap = await loadBanksMapping();
      if(bankMap){
        let changed = false;
        state.valvulas = (state.valvulas || []).map(item => {
          const key = String(item.ref || item.id || '').trim();
          const m = bankMap.get(key);
          if(!m) return item;
          changed = true;
          return {
            ...item,
            banco: m.banco || m.bank || m.code || m.letter || m.value || item.banco,
            ubicacion: m.ubicacion ?? item.ubicacion
          };
        });
        if(changed){
          state.hasBankData = datasetHasBankData(state.valvulas);
          applyFilters(document.getElementById('searchBox')?.value || '');
        }
      }
    }catch(_){ /* opcional */ }

    // Enriquecer catálogo con metadatos del backend (banco/ubicación) sin tocar imagenes
    try{
      const backendItems = await fetchValvesFromBackend();
      if(Array.isArray(backendItems) && backendItems.length){
        const byId = new Map();
        const byRef = new Map();
        for(const r of backendItems){
          byId.set(String(r.id), r);
          if(r.ref) byRef.set(String(r.ref), r);
        }
        let changed = false;
        state.valvulas = (state.valvulas || []).map(item => {
          const id = String(item.ref || item.id);
          const b = byId.get(id) || byRef.get(id);
          if(!b) return item;
          // Mantener portada actual (item.imagen)
          const merged = {
            ...item,
            nombre: b.valvula || b.nombre || item.nombre,
            valvula: b.valvula || item.valvula,
            ubicacion: b.ubicacion ?? item.ubicacion,
            banco: b.banco || b.bank || item.banco,
            // mantener simbolo para sidebar si está disponible, pero no tocar imagen de la tarjeta
            simbolo: b.simbolo || item.simbolo,
            ref: String(b.ref || b.id || item.ref || item.id),
            id: String(b.id || item.id)
          };
          changed = true;
          return merged;
        });
        state.hasBankData = datasetHasBankData(state.valvulas);
        if(changed){
          const q = (document.getElementById('searchBox')?.value) || '';
          applyFilters(q);
          // no recrear chips; solo re-filtrar
        }
      }
    }catch(_){ /* opcional: silenciar si backend no está */ }
  }

  // Cargar banks.json si existe y devolver Map(id -> {banco, ubicacion})
  async function loadBanksMapping(){
    try{
      const res = await fetch(BANKS_JSON, { cache:'no-store' });
      if(!res.ok) return null;
      const data = await res.json();
      const map = new Map();
      if(Array.isArray(data)){
        for(const it of data){
          if(!it) continue;
          const id = String(it.ref || it.id || '').trim();
          if(!id) continue;
          map.set(id, { banco: it.banco || it.bank, ubicacion: it.ubicacion });
        }
      } else if(data && typeof data === 'object'){
        // objeto plano {"152860":"A", ...} o { map: { id: banco } }
        const obj = data.map && typeof data.map === 'object' ? data.map : data;
        for(const [k, v] of Object.entries(obj)){
          if(!k) continue;
          if(v && typeof v === 'object') map.set(String(k), { banco: v.banco || v.bank, ubicacion: v.ubicacion });
          else map.set(String(k), { banco: String(v).toUpperCase() });
        }
      }
      return map.size ? map : null;
    }catch(_){ return null; }
  }

  // --- Upload Excel ---
  function setupUploadExcel(){
    const btn = document.getElementById('btnUploadExcel');
    const input = document.getElementById('excelFile');
    const result = document.getElementById('uploadResult');
    if(!btn || !input) return;
    btn.addEventListener('click', async () => {
      result.textContent = '';
      const file = input.files && input.files[0];
      if(!file){ result.textContent = 'Selecciona un archivo Excel primero.'; return; }
      try{
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${BACKEND}/valves/upload_excel`, { method:'POST', body: fd });
        if(!res.ok){
          const err = await res.json().catch(()=>({detail: res.statusText}));
          throw new Error(err.detail || 'Error al subir');
        }
        const data = await res.json();
        result.textContent = `Insertados: ${data.inserted}`;
        // Tras subir, refrescar catálogo desde backend
        const refreshed = await fetchValvesFromBackend();
        if(refreshed && refreshed.length){
          state.valvulas = refreshed;
          renderMenu(state.valvulas);
        }
      }catch(e){
        result.textContent = `Error: ${e.message || e}`;
      }
    });
  }

  async function fetchValvesFromBackend(){
    try{
      const res = await fetch(`${BACKEND}/valves`, { cache:'no-store' });
      if(!res.ok) return null;
      const data = await res.json();
      if(!data || !Array.isArray(data.items)) return null;
      // Adapt to front expected fields using new schema
      // Prefer 'simbolo' as display image path
      return data.items.map(r => ({
        id: String(r.id),
        // nombre mostrado prioriza la columna 'valvula' de la BD
        nombre: r.valvula || r.nombre,
        // conservar el campo original por si el sidebar lo requiere
        valvula: r.valvula,
        ubicacion: r.ubicacion,
        imagen: r.simbolo || '',
        // extras for sidebar/search if needed
        cantidad: r.cantidad,
        numero_serie: r.numero_serie || r.serie,
        ficha_tecnica: r.ficha_tecnica,
        simbolo: r.simbolo,
        // backward compat fields
        ref: String(r.id)
      }));
    }catch(_){ return null; }
  }

  async function fetchValveDetail(id){
    try{
      const url = `${BACKEND}/valves/${encodeURIComponent(id)}`;
      const res = await fetch(url, { cache:'no-store' });
      if(!res.ok) return null;
      const r = await res.json();
      // Normalizar a shape usado en sidebar
      return {
        id: String(r.id),
        // usar la columna 'valvula' como nombre principal
        nombre: r.valvula || r.nombre,
        valvula: r.valvula,
        cantidad: r.cantidad,
        ubicacion: r.ubicacion,
        numero_serie: r.numero_serie || r.serie,
        ficha_tecnica: r.ficha_tecnica,
        simbolo: r.simbolo,
        ref: String(r.id)
      };
    }catch(_){ return null; }
  }

  // Exponer funciones principales para pruebas manuales en consola si se requiere
  window.ValvulasApp = {
    initApp, loadMetadata, discoverImagesFromFolder, buildFallbackValveData,
    renderMenu, onValveSelect, renderPanel, closePanel, sanitize, findValveId,
    openCamera, closeCamera, renderSidebar
  };

  document.addEventListener('DOMContentLoaded', initApp, { once:true });
})();
