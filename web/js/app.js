/*
  Sistema de Identificación de Válvulas - Landing demo (sin frameworks)
  Reglas clave:
  - No se inyecta HTML desde datos: siempre se escapan cadenas
  - Accesible: roles ARIA, foco, teclado (Enter/Space abre, Esc cierra)
*/

(() => {
  // Colores de bancos y clases para chips
  const BANK_COLORS = {
    A: '#F4D947',
    B: '#7FBEEB',
    C: '#E73636',
    D: '#50B95A'
  };
  let activeBanks = new Set();
  // Renderiza los botones de filtro por banco (delegando estado a Filters si está disponible)
  function renderBankFilters() {
    const container = document.getElementById('bankFilters');
    if (!container) return;
    // Asume que los chips ya existen en el HTML
    const chips = container.querySelectorAll('.bank-chip');
    chips.forEach(chip => {
      const bank = chip.textContent.trim();
      const current = (window.Filters && typeof window.Filters.getActiveBanks === 'function')
        ? window.Filters.getActiveBanks()
        : activeBanks;
      chip.classList.toggle('selected', current.has(bank));
      chip.setAttribute('aria-pressed', current.has(bank));
      chip.onclick = () => {
        if (window.Filters && typeof window.Filters.toggle === 'function') {
          window.Filters.toggle(bank);
          // Suscripción global se encargará de re-renderizar
          renderBankFilters();
        } else {
          if (activeBanks.has(bank)) {
            activeBanks.delete(bank);
          } else {
            activeBanks.add(bank);
          }

          // --- Símbolos ---
          async function loadSymbolsIndexOnce() {
            if (state.symbolsIndex !== null) return state.symbolsIndex;
            try {
              const res = await fetch('STATIC/IMG/simbology/index.json', { cache: 'no-store' });
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                  state.symbolsIndex = data; return data;
                }
                if (data && Array.isArray(data.files)) {
                  state.symbolsIndex = data.files; return data.files;
                }
              }
            } catch (_) { /* no index available */ }
            state.symbolsIndex = undefined; // mark tried
            return undefined;
          }

          async function findSymbolsForRef(ref) {
            const results = [];
            const cleanRef = String(ref || '').trim();
            if (!cleanRef) return results;
            const idx = await loadSymbolsIndexOnce();
            const base = 'STATIC/IMG/simbology/';
            if (Array.isArray(idx)) {
              const rx = new RegExp(cleanRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
              for (const name of idx) {
                if (typeof name === 'string' && rx.test(name)) {
                  results.push(base + name);
                }
              }
              return results;
            }
            // Fallback: try common filename patterns directly (will load lazily in <img>)
            const exts = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
            for (const ext of exts) {
              results.push(base + cleanRef + '.' + ext);
              results.push(base + cleanRef.toUpperCase() + '.' + ext);
              results.push(base + cleanRef.toLowerCase() + '.' + ext);
            }
            return results;
          }
          renderBankFilters();
          renderMenu(filterValvulasByBank(state.valvulas));
        }
      };
    });
  }

  // Filtra válvulas por bancos activos (fallback si no existe Filters)
  function filterValvulasByBank(valvulas) {
    if (!activeBanks.size) return valvulas;
    return valvulas.filter(v => {
      let ubicaciones = [];
      if (Array.isArray(v.ubicacion)) {
        ubicaciones = v.ubicacion;
      } else if (typeof v.ubicacion === 'string') {
        ubicaciones = v.ubicacion.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      }
      return ubicaciones.some(ub => ub && activeBanks.has(ub.charAt(0).toUpperCase()));
    });
  }
  'use strict';

  // Config
  const IMAGE_FOLDER = 'STATIC/IMG/card-photos/'; // carpeta para portadas por referencia
  const IMAGE_LIST_JSON = IMAGE_FOLDER + 'index.json'; // formato: { images: ["file1.jpg", ...] }
  const FORCE_LEGACY_STATIC = true; // forzar carga desde index.json de card-photos (con fallback a backend si vacío)
  const METADATA_JSON = 'valvulas.json'; // opcional en raíz de landing
  const BACKEND = 'http://127.0.0.1:8000';

  // Estado
  let state = {
    valvulas: [],
    map: new Map(),
    lastActivator: null,
    imagesIndex: null, // { ref: [files...] }
    symbolsIndex: null // [ filenames ] from STATIC/IMG/simbology/index.json
  };

  // Precalentamiento
  const PREFETCH_PER_REF = 3;   // cuántas imágenes del carrusel preparar
  const HIGH_PRIORITY_FIRST = 12; // cuántas portadas priorizar en la grilla

  // Utils (delegated to window.Utils)
  function sanitize(text) {
    return (window.Utils && typeof window.Utils.sanitize === 'function')
      ? window.Utils.sanitize(text)
      : String(text || '');
  }

  // Detecta el banco (A/B/C/D) desde un objeto válvula. Usa campo 'banco' si existe
  // o intenta inferirlo desde 'nombre', 'ubicacion', 'notas' o 'id/ref'.
  function getBank(v) {
    if (!v) return null;
    let raw = v.banco || v.bank || '';
    if (typeof raw === 'string' && raw.trim()) { raw = raw.trim().toUpperCase(); }
    const tryFields = [raw, v.nombre, v.ubicacion, v.notas, v.id, v.ref].filter(Boolean);
    for (const f of tryFields) {
      const s = String(f).toUpperCase();
      if (/BANC?O\s*A\b/.test(s) || /\bBANK\s*A\b/.test(s) || s === 'A') { return 'A'; }
      if (/BANC?O\s*B\b/.test(s) || /\bBANK\s*B\b/.test(s) || s === 'B') { return 'B'; }
      if (/BANC?O\s*C\b/.test(s) || /\bBANK\s*C\b/.test(s) || s === 'C') { return 'C'; }
      if (/BANC?O\s*D\b/.test(s) || /\bBANK\s*D\b/.test(s) || s === 'D') { return 'D'; }
    }
    return null;
  }

  // Normaliza URLs por si un índice antiguo incluye subcarpetas espurias como "images/"
  function normalizeCardPhotoUrl(url) {
    return (window.Utils && typeof window.Utils.normalizeCardPhotoUrl === 'function')
      ? window.Utils.normalizeCardPhotoUrl(url)
      : String(url || '');
  }

  // Pre-carga de imágenes del carrusel para una referencia
  function warmupRef(ref) {
    if (!state.imagesIndex || !state.imagesIndex[ref]) return;
    const files = state.imagesIndex[ref].slice(0, PREFETCH_PER_REF);
    for (const f of files) {
      const url = IMAGE_FOLDER + ref + '/' + f;
      const im = new Image();
      try { im.fetchPriority = 'low'; } catch (_) { }
      im.decoding = 'async';
      im.src = url;
    }
  }

  // Construye un carrusel básico con controles y swipe
  function buildCarousel(urls, id) {
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
      img.alt = `Imagen ${idx + 1}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      slide.appendChild(img);
      track.appendChild(slide);
    });

    let current = 0;

    function update() {
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
    root.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) current = (current + 1) % urls.length; else current = (current - 1 + urls.length) % urls.length;
        update();
      }
      startX = null;
    }, { passive: true });

    update();
    return root;
  }

  // --- Cámara: delegar en CameraQR (html5-qrcode) ---
  async function openCamera() {
    if (window.CameraQR && typeof window.CameraQR.open === 'function') {
      return window.CameraQR.open();
    }
  }

  async function closeCamera() {
    try {
      if (window.CameraQR && typeof window.CameraQR.close === 'function') {
        await window.CameraQR.close();
      }
      setStatus('');
    } catch (_) { setStatus(''); }
  }

  // (Simulación de QR eliminada)

  // --- Navbar: listeners ---
  function setupNavbar() {
    // Desplegable
    const navToggle = document.getElementById('btnNavToggle');
    const navItems = document.getElementById('navItems');
    if (navToggle && navItems) {
      navToggle.addEventListener('click', () => {
        const expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
      });
      navItems.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.matches && target.matches('button.nav-btn')) {
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const btnOpen = document.getElementById('btnAbrirCam');
    const btnClose = document.getElementById('btnCerrarCam');
    if (btnOpen) { btnOpen.addEventListener('click', openCamera); }
    if (btnClose) { btnClose.addEventListener('click', closeCamera); }

    // Tabs principales: Imágenes, Lector QR, Reconocer AI, Entrenar AI, Cargar Excel
    const tabImages = document.getElementById('btnTabImages');
    const tabQR = document.getElementById('btnTabQR');
    const tabAIRecognize = document.getElementById('btnTabAIRecognize');
    const tabAITrain = document.getElementById('btnTabAITrain');
    const tabUpload = document.getElementById('btnTabUpload');
    const imagesPanel = document.getElementById('imagesPanel');
    const cameraPanel = document.getElementById('cameraPanel');
    const aiPanel = document.getElementById('aiPanel');
    const aiTrainPanel = document.getElementById('aiTrainPanel');
    const uploadPanel = document.getElementById('uploadPanel');

    function setActive(tab) {
      for (const el of [tabImages, tabQR, tabAIRecognize, tabAITrain, tabUpload]) {
        if (!el) continue;
        const active = el === tab;
        el.classList.toggle('active', active);
        if (active) { el.setAttribute('aria-current', 'page'); }
        else { el.removeAttribute('aria-current'); }
      }
    }

    // Navegación centralizada vía Router
    const go = (target, tabEl) => {
      setActive(tabEl);
      try { window.Router && typeof window.Router.navigate === 'function' ? window.Router.navigate(target) : null; } catch (_) { }
    };

    if (tabImages) { tabImages.addEventListener('click', () => go('images', tabImages)); }
    if (tabQR) { tabQR.addEventListener('click', () => go('qr', tabQR)); }
    if (tabAIRecognize) { tabAIRecognize.addEventListener('click', () => go('ai', tabAIRecognize)); }
    if (tabAITrain) { tabAITrain.addEventListener('click', () => go('aitrain', tabAITrain)); }
    if (tabUpload) { tabUpload.addEventListener('click', () => go('upload', tabUpload)); }

    // Estado inicial: activar tab y navegar
    if (tabImages) { setActive(tabImages); }
    try { window.Router && window.Router.navigate('images'); } catch (_) { }
  }

  function setStatus(msg) {
    const el = document.getElementById('status');
    el.textContent = msg || '';
  }

  // --- Búsqueda en la pestaña Imágenes ---
  function setupSearch() {
    const input = document.getElementById('searchBox');
    const btnClear = document.getElementById('btnClearSearch');
    const countEl = document.getElementById('searchCount');

    if (!input) return;

    let timer = null;
    const debounce = (fn) => {
      clearTimeout(timer);
      timer = setTimeout(fn, 140);
    };

    function apply(q) {
      const query = String(q || '').trim().toLowerCase();
      let list = state.valvulas || [];
      if (query) {
        list = list.filter(v => {
          const ref = (v.ref || v.id || '').toLowerCase();
          const nom = (v.nombre || '').toLowerCase();
          return ref.includes(query) || nom.includes(query);
        });
      }
      renderMenu(list);
      if (countEl) { countEl.textContent = query ? `${list.length} resultados` : ''; }
    }

    input.addEventListener('input', () => debounce(() => apply(input.value)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; apply(''); input.blur(); } });
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        // Limpiar búsqueda de texto
        input.value = '';
        apply('');
        // Limpiar filtros de banco si existen
        try {
          if (window.Filters && typeof window.Filters.clear === 'function') {
            window.Filters.clear();
          } else {
            // Fallback local si no existe Filters global
            if (activeBanks && typeof activeBanks.clear === 'function') {
              activeBanks.clear();
            }
          }
        } catch (_) { /* noop */ }
        // Re-renderizar chips visuales
        try { renderBankFilters(); } catch (_) { }
        // Foco de vuelta al input para mejor UX
        input.focus();
      });
    }

    // Primera carga sin filtro
    apply('');
  }

  // Carga de metadatos desde valvulas.json (si existe)
  async function loadMetadata() {
    try {
      const res = await fetch(METADATA_JSON, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  // Descubrimiento de imágenes: preferir backend /images_index; si no, usar STATIC/IMG/index.json
  // Estructuras soportadas:
  // - Backend: { items: [{ id, image, count }] }
  // - Mapping: { "<ref>": ["img1.jpg", ...] }
  // - Legacy: { images: ["file1.jpg", ...] }
  async function discoverImagesFromFolder() {
    // Modo legado primero
    if (FORCE_LEGACY_STATIC) {
      try {
        const res = await fetch(IMAGE_LIST_JSON, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.images) && data.images.length) {
            const out = data.images
              .filter(x => typeof x === 'string')
              .map(raw => {
                const file = String(raw).trim().split('\\').pop().split('/').pop();
                const base = file.replace(/\.[^.]+$/, '');
                const url = normalizeCardPhotoUrl(IMAGE_FOLDER + file);
                return { id: base, ref: base, imagen: url, nombre: base };
              });
            try { console.log('[IMG] legacy ok. count=', out.length); } catch (_) { }
            return out;
          }
        }
      } catch (_) { /* continue to backend fallback */ }
      // Fallback a backend si vacío o error
      try {
        const r = await fetch(`${BACKEND}/images_index`, { cache: 'no-store' });
        if (!r.ok) return [];
        const data = await r.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const out = items.map(it => ({
          id: String(it.id),
          ref: String(it.id),
          // hacer URL absoluta al backend
          imagen: /^https?:\/\//.test(it.image) ? it.image : `${BACKEND}${it.image}`,
          nombre: String(it.id)
        }));
        try { console.log('[IMG] backend fallback ok. count=', out.length); } catch (_) { }
        return out;
      } catch (_) { return []; }
    }

    // Si se desactiva FORCE_LEGACY_STATIC, agregar aquí lógica extendida...
  }

  // Construye datos ficticios para cada imagen (sin prefijos de aviso)
  function buildFallbackValveData(imageList) {
    const usedIds = new Set();
    const out = [];

    for (const item of imageList) {
      const file = typeof item === 'string' ? item : (item.imagen || '');
      const base = typeof item === 'string' ? file.replace(/\.[^.]+$/, '') : (item.id || 'valvula');
      let id = base.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      // Evitar colisiones: sufijo incremental
      let suffix = 1;
      while (usedIds.has(id)) {
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

  function tituloFromFilename(base) {
    return (window.Utils && typeof window.Utils.tituloFromFilename === 'function')
      ? window.Utils.tituloFromFilename(base)
      : String(base || '');
  }

  // Render del menú en grid
  function renderMenu(valvulas) {
    const grid = document.getElementById('grid');
    if (!grid) {
      try { console.error('[RENDER] grid container not found'); } catch (_) { }
      setStatus('Error: contenedor de grilla no encontrado.');
      return;
    }
    grid.innerHTML = '';

    // Aplica filtro por banco (usar Filters si está disponible)
    const filtered = (window.Filters && typeof window.Filters.applyBank === 'function')
      ? window.Filters.applyBank(valvulas)
      : filterValvulasByBank(valvulas);
    try { console.debug('[RENDER] items in =', Array.isArray(valvulas) ? valvulas.length : 0, 'filtered =', filtered.length); } catch (_) { }

    if (!filtered || !filtered.length) {
      // Mensaje discreto dentro del grid, con pista según filtros de banco/ubicación
      const empty = document.createElement('div');
      empty.className = 'empty';
      let msg = 'Sin resultados';
      try {
        const hasBankFilters = (window.Filters && typeof window.Filters.getActiveBanks === 'function')
          ? (window.Filters.getActiveBanks().size > 0)
          : (activeBanks && activeBanks.size > 0);
        if (hasBankFilters) {
          msg = 'Sin resultados para los bancos seleccionados. Verifica las ubicaciones.';
        }
      } catch (_) { /* noop */ }
      empty.textContent = msg;
      grid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    let idx = 0;
    for (const v of filtered) {
      state.map.set(v.id, v);

      const card = document.createElement('div');
      // Horizontal card layout
      card.className = 'card card--h';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Abrir detalles de ${sanitize(v.nombre)}`);
      card.dataset.id = v.id;
      if (v.ref) { card.dataset.ref = v.ref; }

      // Left: image wrapper
      const media = document.createElement('div');
      media.className = 'card__media';
      const img = document.createElement('img');
      // Carga ansiosa de portadas, pero forzamos recarga si la imagen cambia
      img.loading = 'eager';
      img.src = v.imagen + '?t=' + Date.now(); // Forzar recarga si se reemplazó la imagen
      img.alt = `${sanitize(v.nombre)} (${v.id})`;
      img.addEventListener('error', () => { img.replaceWith(placeholderImage()); }, { passive: true });
      media.appendChild(img);

      // Right: content/info
      const content = document.createElement('div');
      content.className = 'card__content';

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = v.nombre;

      const meta = document.createElement('div');
      meta.className = 'card__meta';

      // helper para icono pequeño reutilizando sprite
      const ICON_SPRITE_SM = 'STATIC/IMG/icons.svg';
      function iconSm(id) {
        try {
          const svgNS = 'http://www.w3.org/2000/svg';
          const xlinkNS = 'http://www.w3.org/1999/xlink';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('class', 'icon');
          const use = document.createElementNS(svgNS, 'use');
          use.setAttribute('href', `${ICON_SPRITE_SM}#${id}`);
          try { use.setAttributeNS(xlinkNS, 'href', `${ICON_SPRITE_SM}#${id}`); } catch (_) { }
          svg.appendChild(use);
          return svg;
        } catch (_) { return null; }
      }

      // Sección 1: Cantidad
      const secQty = document.createElement('section');
      secQty.className = 'meta-section';
      const hQty = document.createElement('h4'); hQty.className = 'meta-title'; hQty.textContent = 'Cantidad';
      const iQty = iconSm('icon-list'); if (iQty) hQty.prepend(iQty);
      const qtyVal = document.createElement('div'); qtyVal.className = 'meta-val'; qtyVal.textContent = (v.cantidad != null && v.cantidad !== '') ? String(v.cantidad) : '—';
      secQty.append(hQty, qtyVal);

      // Sección 2: Ubicación (chips)
      const secLoc = document.createElement('section');
      secLoc.className = 'meta-section';
      const hLoc = document.createElement('h4'); hLoc.className = 'meta-title'; hLoc.textContent = 'Ubicación';
      const iLoc = iconSm('icon-guide'); if (iLoc) hLoc.prepend(iLoc);
      const locVal = document.createElement('div'); locVal.className = 'meta-val';
      // Render ubicación como chips coloreados, igual que en el sidebar
      const chipsWrap = document.createElement('div');
      chipsWrap.style.display = 'flex';
      chipsWrap.style.flexWrap = 'wrap';
      chipsWrap.style.gap = '6px';
      const parts = v.ubicacion ? String(v.ubicacion).split(/[\/|;,]+/).map(s => s.trim()).filter(Boolean) : [];
      if (parts.length === 0 && v.ubicacion) { parts.push(String(v.ubicacion)); }
      if (parts.length === 0) { chipsWrap.textContent = '—'; }
      for (const p of parts) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const s = String(p).toUpperCase();
        const first = s.charAt(0);
        if (first === 'A' || /BANC?O\s*A\b/.test(s) || /\bBANK\s*A\b/.test(s)) chip.classList.add('chip--bank', 'chip--bankA');
        else if (first === 'B' || /BANC?O\s*B\b/.test(s) || /\bBANK\s*B\b/.test(s)) chip.classList.add('chip--bank', 'chip--bankB');
        else if (first === 'C' || /BANC?O\s*C\b/.test(s) || /\bBANK\s*C\b/.test(s)) chip.classList.add('chip--bank', 'chip--bankC');
        else if (first === 'D' || /BANC?O\s*D\b/.test(s) || /\bBANK\s*D\b/.test(s)) chip.classList.add('chip--bank', 'chip--bankD');
        chip.textContent = p;
        chipsWrap.appendChild(chip);
      }
      locVal.appendChild(chipsWrap);
      secLoc.append(hLoc, locVal);

      // Sección 3: Número de serie
      const secSN = document.createElement('section');
      secSN.className = 'meta-section';
      const hSN = document.createElement('h4'); hSN.className = 'meta-title'; hSN.textContent = 'Número de serie';
      const iSN = iconSm('icon-file'); if (iSN) hSN.prepend(iSN);
      const snVal = document.createElement('div'); snVal.className = 'meta-val'; snVal.textContent = String(v.numero_serie || v.serie || '—');
      secSN.append(hSN, snVal);

      meta.append(secQty, secLoc, secSN);

      content.append(title, meta);

      card.append(media, content);
      // Al seleccionar una card: fija la referencia para entrenamiento y abre el detalle
      addActivationHandlers(card, () => {
        try {
          const ref = v.ref || v.id;
          if (ref && window.AITrain && typeof window.AITrain.setSelectedRef === 'function') {
            window.AITrain.setSelectedRef(String(ref), String(v.nombre || ref));
          }
        } catch (_) { /* noop */ }
        onValveSelect(v.id);
      });

      // Precalentar imágenes del carrusel al pasar el mouse o enfocar
      if (v.ref) {
        const warm = () => warmupRef(v.ref);
        card.addEventListener('mouseenter', warm, { once: true, passive: true });
        card.addEventListener('focus', warm, { once: true, passive: true });
      }

      frag.appendChild(card);
      idx++;
    }

    grid.appendChild(frag);
  }
  // Inicializar filtros al cargar y suscribirse a cambios globales
  window.addEventListener('DOMContentLoaded', () => {
    renderBankFilters();
    try {
      if (window.Filters && typeof window.Filters.onChange === 'function') {
        window.Filters.onChange(() => {
          // Re-renderizar grilla principal cuando cambie el filtro de bancos
          renderMenu(state.valvulas);
          // No tocar panel de Entrenar IA aquí: lo maneja su propio módulo
        });
      }
    } catch (_) { /* noop */ }

    // Configurar pista de desplazamiento horizontal para .layout en móviles
    try {
      const layout = document.querySelector('.layout');
      if (layout) {
        const updateHints = () => {
          const max = layout.scrollWidth - layout.clientWidth;
          if (max > 2) {
            layout.classList.toggle('has-left', layout.scrollLeft > 2);
            layout.classList.toggle('has-right', layout.scrollLeft < max - 2);
          } else {
            layout.classList.remove('has-left');
            layout.classList.remove('has-right');
          }
        };
        layout.addEventListener('scroll', updateHints, { passive: true });
        window.addEventListener('resize', updateHints);
        // primer cálculo
        updateHints();
      }
    } catch (_) { /* noop */ }
  });

  function placeholderImage() {
    return (window.Utils && typeof window.Utils.placeholderImage === 'function')
      ? window.Utils.placeholderImage()
      : document.createElement('div');
  }

  // Handlers de activación accesibles (click/touch/teclado)
  function addActivationHandlers(el, handler) {
    if (window.Utils && typeof window.Utils.addActivationHandlers === 'function') {
      return window.Utils.addActivationHandlers(el, handler);
    }
    el.addEventListener('click', handler);
  }

  async function onValveSelect(id) {
    state.lastActivator = document.activeElement;
    // Base: lo que haya en memoria o un fallback mínimo
    let base = state.map.get(id) || { id: String(id), nombre: String(id) };
    base.ref = base.ref || String(id);

    // Intentar obtener detalle real desde backend
    try {
      const detail = await fetchValveDetail(String(id));
      if (detail) {
        // Mantener la imagen portada previa si existe
        const merged = { ...base, ...detail, imagen: base.imagen || detail.simbolo || '' };
        renderSidebar(merged);
      } else {
        renderSidebar(base);
      }
    } catch (_) {
      renderSidebar(base);
    }

    try { closePanel(); } catch (_) { }
  }

  // Resolver de código escaneado a ID válido del catálogo
  function findValveId(code) {
    if (window.Store && typeof window.Store.findValveIdPure === 'function') {
      return window.Store.findValveIdPure(state.map, code);
    }
    return null;
  }

  function renderPanel(info) {
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
    if (state.imagesIndex && ref && state.imagesIndex[ref]) {
      const files = state.imagesIndex[ref].slice(0, 3);
      const urls = files.map(f => IMAGE_FOLDER + ref + '/' + f);
      const carousel = buildCarousel(urls, `${ref}-carousel`);
      body.appendChild(carousel);
    } else if (info.imagen) {
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
    if (info.notas) { parts.push(sanitize(String(info.notas))); }
    if (info.estado) { parts.push(`Estado: ${sanitize(info.estado.replace(/^\[No verificado\]\s*/i, ''))}`); }
    if (info.ubicacion) { parts.push(`Ubicación: ${sanitize(info.ubicacion.replace(/^\[No verificado\]\s*/i, ''))}`); }
    if (info.ultima_revision) { parts.push(`Última revisión: ${sanitize(String(info.ultima_revision).replace(/^\[No verificado\]\s*/i, ''))}`); }
    if (typeof info.presion_operacion_bar === 'number') {
      parts.push(`Presión operación: ${sanitize(info.presion_operacion_bar)} bar`);
    }
    if (typeof info.caudal_l_min === 'number') {
      parts.push(`Caudal: ${sanitize(info.caudal_l_min)} L/min`);
    }

    // Render como texto, sin innerHTML
    for (const p of parts) {
      const badge = document.createElement('div');
      badge.className = 'badge ok';
      badge.textContent = p;
      body.appendChild(badge);
    }

    function escHandler(e) { if (e.key === 'Escape') { closePanel(); } }
    function bgHandler() { closePanel(); }

    overlay.hidden = false;
    modal.hidden = false;
    document.addEventListener('keydown', escHandler);
    overlay.addEventListener('click', bgHandler, { once: true });

    closeBtn.onclick = () => closePanel();
    closeBtn.focus();

    // Guardar para limpieza
    modal._escHandler = escHandler;
  }

  function closePanel() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('modal');

    if (!modal.hidden) {
      document.removeEventListener('keydown', modal._escHandler);
    }

    overlay.hidden = true;
    modal.hidden = true;

    if (state.lastActivator && typeof state.lastActivator.focus === 'function') {
      state.lastActivator.focus();
    }
  }

  // --- Sidebar persistente (por ahora vacío) ---
  function renderSidebar(data) {
    const title = document.getElementById('sidebarTitle');
    const body = document.getElementById('sidebarBody');
    if (!title || !body) return;

    // Título: mostrar SIEMPRE el número de referencia arriba del todo (en negrilla la etiqueta)
    if (data) {
      const ref = String(data.ref || data.id || '').trim();
      if (ref) {
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

    if (!data) {
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
    function icon(id) {
      try {
        const svgNS = 'http://www.w3.org/2000/svg';
        const xlinkNS = 'http://www.w3.org/1999/xlink';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'icon lg');
        const use = document.createElementNS(svgNS, 'use');
        // Compatibilidad: setear href y xlink:href
        use.setAttribute('href', `${ICON_SPRITE}#${id}`);
        try { use.setAttributeNS(xlinkNS, 'href', `${ICON_SPRITE}#${id}`); } catch (_) { }
        svg.appendChild(use);
        return svg;
      } catch (_) { return null; }
    }

    // 1) Válvula (nombre)
    const secValve = document.createElement('section');
    secValve.className = 'valve-section';
    const secValveH = document.createElement('h3');
    secValveH.textContent = 'Válvula';
    const icValve = icon('icon-valve'); if (icValve) secValveH.prepend(icValve);
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
    const icGuide = icon('icon-guide'); if (icGuide) secGuideH.prepend(icGuide);
    const kv2 = document.createElement('dl'); kv2.className = 'kv';
    const dt2 = document.createElement('dt'); dt2.textContent = 'Guía';
    const dd2 = document.createElement('dd'); dd2.textContent = String(data.ref || data.id || '—');
    kv2.append(dt2, dd2);
    secGuide.append(secGuideH, kv2);

    // (Sección "Ficha" eliminada a petición del usuario)

    // 4) Símbolo(s)
    {
      const secSymbol = document.createElement('section');
      secSymbol.className = 'valve-section';
      const secSymbolH = document.createElement('h3'); secSymbolH.textContent = 'Símbolo';
      const icSym = icon('icon-symbol'); if (icSym) secSymbolH.prepend(icSym);
      const body = document.createElement('div');
      // fallback simple si la válvula trae una URL directa
      if (data.simbolo) {
        const img = document.createElement('img');
        img.className = 'valve-card__symbol';
        img.src = data.simbolo;
        img.alt = `${sanitize(data.nombre || data.id)} - símbolo`;
        img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error', () => { img.replaceWith(placeholderImage()); }, { passive: true });
        body.appendChild(img);
      }
      // búsqueda por referencia en carpeta estática de simbología
      const ref = data.ref || data.id || '';
      if (ref) {
        const grid = document.createElement('div');
        grid.className = 'symbol-grid';
        body.appendChild(grid);
        // async load
        findSymbolsForRef(ref).then(urls => {
          const seen = new Set();
          for (const u of urls) {
            if (!u || seen.has(u)) continue; seen.add(u);
            const img = document.createElement('img');
            img.loading = 'lazy'; img.decoding = 'async';
            img.alt = `${sanitize(ref)} símbolo`;
            img.src = u;
            img.addEventListener('error', () => { img.remove(); }, { passive: true });
            grid.appendChild(img);
          }
        }).catch(() => { });
      }
      if (body.childNodes.length > 0) {
        secSymbol.append(secSymbolH, body);
        wrap.appendChild(secSymbol);
      }
    }

    // 5) Ficha técnica (enlace si es URL)
    if (data.ficha_tecnica) {
      const secFT = document.createElement('section');
      secFT.className = 'valve-section';
      const secFTH = document.createElement('h3'); secFTH.textContent = 'Ficha técnica';
      const icFile = icon('icon-file'); if (icFile) secFTH.prepend(icFile);
      const p = document.createElement('p');
      const isUrl = /^https?:\/\//i.test(String(data.ficha_tecnica || ''));
      if (isUrl) {
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
    wrap.prepend(secGuide);
    wrap.prepend(secValve);

    // Ensamblar y render
    card.append(head, wrap);
    body.appendChild(card);

    // En pantallas pequeñas, hacer scroll al sidebar para que el usuario lo vea
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 1023px)').matches) {
        const el = document.getElementById('sidebar');
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Asegurar que el panel comience desde arriba
        if (el && typeof el.scrollTo === 'function') {
          el.scrollTo({ top: 0, behavior: 'auto' });
        } else if (el) {
          el.scrollTop = 0;
        }
      }
    } catch (_) { }
  }

  async function initApp() {

    setStatus('Cargando…');

    const [meta, images, valves] = await Promise.all([
      loadMetadata(),
      discoverImagesFromFolder(),
      fetchValvesFromBackend()
    ]);


    let catalog = [];
    // Construir catálogo combinando portadas (images) con metadatos reales de BD (valves)
    // Reglas:
    //  - Si hay images, se usan como base para portadas.
    //  - Si hay valves del backend, se fusionan campos (ubicacion, cantidad, etc.).
    //  - Si no hay images pero hay valves, se usa valves con simbolo como imagen si existe.
    //  - Meta local solo como último recurso.

    const mapValves = new Map();
    if (Array.isArray(valves)) {
      for (const v of valves) {
        // Indexar por múltiples llaves para asegurar merge correcto con portadas
        const keys = new Set();
        keys.add(String(v.id));
        if (v.valvula) keys.add(String(v.valvula));
        if (v.numero_serie) keys.add(String(v.numero_serie));
        if (v.ref) keys.add(String(v.ref));
        for (const k of keys) { mapValves.set(k, v); }
      }
    }

    if (Array.isArray(images) && images.length) {
      // Fusionar por id/ref
      const merged = images.map(it => {
        const key = String(it.ref || it.id || '').trim();
        const metaV = mapValves.get(key);
        if (metaV) {
          // Combinar, priorizando portada de images y enriqueciendo con ubicacion desde BD
          return {
            ...it,
            ...metaV,
            id: key,
            ref: key,
            imagen: it.imagen || metaV.simbolo || it.imagen,
            nombre: metaV.valvula || metaV.nombre || it.nombre || key
          };
        }
        return it;
      });
      catalog = merged;
    } else if (Array.isArray(valves) && valves.length) {
      // No hay images: usar valves del backend
      catalog = valves.map(v => {
        // Elegir una referencia visible estable: numero_serie o valvula, en su defecto id
        const refKey = String(v.numero_serie || v.valvula || v.id);
        return {
          ...v,
          id: refKey,
          ref: refKey,
          imagen: v.simbolo || v.imagen || ''
        };
      });
    } else if (meta && meta.length) {
      catalog = meta;
    } else {
      catalog = buildFallbackValveData(images || []);
    }


    state.valvulas = catalog;
    try { console.debug('[INIT] catalog size =', catalog.length); } catch (_) { }
    renderMenu(catalog);
    // Mostrar un estado breve con el total cargado
    setStatus(`Catálogo cargado: ${catalog.length} elementos`);
    setTimeout(() => setStatus(''), 1200);
    setupNavbar();
    setupSearch();
    // Inicializar sidebar vacío
    renderSidebar(null);

    // Setup upload handlers
    setupUploadExcel();

    // Escuchar progreso de entrenamiento (emitido por camera.js)
    window.addEventListener('AI_TRAIN_PROGRESS', (ev) => {
      try {
        const { sent = 0, total = 60, failed = 0, elapsed = 0, running = false } = ev.detail || {};
        const fill = document.getElementById('aiTrainProgressFill');
        const meta = document.getElementById('aiTrainProgressMeta');
        const pct = Math.max(0, Math.min(100, total ? Math.round((sent + failed) * 100 / total) : 0));
        if (fill) fill.style.width = pct + '%';
        if (meta) {
          const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const ss = String(elapsed % 60).padStart(2, '0');
          meta.textContent = `${sent}/${total} subidas${failed ? `, ${failed} fallidas` : ''} • ${mm}:${ss}` + (running ? '' : ' • listo');
        }
      } catch (_) { /* noop */ }
    });
  }

  // ---- AI Train selection helper ----
  (function initAITrainHelper() {
    const api = {
      _selectedRef: null,
      setSelectedRef(ref, name) {
        this._selectedRef = String(ref || '').trim() || null;
        const info = document.getElementById('aiTrainSelectedInfo');
        if (info) {
          info.textContent = this._selectedRef ? `Entrenando referencia: ${name || this._selectedRef}` : 'Entrenando referencia: —';
        }
        try { console.debug('[AITrain] selectedRef =', this._selectedRef); } catch (_) { }
      },
      getSelectedRef() { return this._selectedRef; }
    };
    window.AITrain = api;
  })();

  // --- Upload Excel ---
  function setupUploadExcel() {
    const btn = document.getElementById('btnUploadExcel');
    const input = document.getElementById('excelFile');
    const result = document.getElementById('uploadResult');
    if (!btn || !input) return;
    btn.addEventListener('click', async () => {
      result.textContent = '';
      const file = input.files && input.files[0];
      if (!file) { result.textContent = 'Selecciona un archivo Excel primero.'; return; }
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${BACKEND}/valves/upload_excel`, { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || 'Error al subir');
        }
        const data = await res.json();
        result.textContent = `Insertados: ${data.inserted}`;
        // Tras subir, refrescar catálogo desde backend
        const refreshed = await fetchValvesFromBackend();
        if (refreshed && refreshed.length) {
          state.valvulas = refreshed;
          renderMenu(state.valvulas);
        }
      } catch (e) {
        result.textContent = `Error: ${e.message || e}`;
      }
    });
  }

  async function fetchValvesFromBackend() {
    try {
      const res = await fetch(`${BACKEND}/valves`, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.items)) return null;
      // Adapt to front expected fields using new schema
      // Prefer 'simbolo' as display image path
      return data.items.map(r => ({
        id: String(r.id),
        // nombre mostrado prioriza la columna 'valvula' de la BD
        nombre: r.valvula || r.nombre,
        // conservar el campo original por si el sidebar lo requiere
        valvula: r.valvula,
        ubicacion: r.ubicacion,
        banco: r.banco || r.bank, // si el backend lo provee
        imagen: r.simbolo || '',
        // extras for sidebar/search if needed
        cantidad: r.cantidad,
        numero_serie: r.numero_serie || r.serie,
        ficha_tecnica: r.ficha_tecnica,
        simbolo: r.simbolo,
        // backward compat fields
        ref: String(r.id)
      }));
    } catch (_) { return null; }
  }

  async function fetchValveDetail(id) {
    try {
      const url = `${BACKEND}/valves/${encodeURIComponent(id)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
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
    } catch (_) { return null; }
  }

  // Exponer funciones principales para pruebas manuales en consola si se requiere
  window.ValvulasApp = {
    initApp, loadMetadata, discoverImagesFromFolder, buildFallbackValveData,
    renderMenu, onValveSelect, renderPanel, closePanel, sanitize, findValveId,
    openCamera, closeCamera, renderSidebar
  };

  document.addEventListener('DOMContentLoaded', initApp, { once: true });
})();
