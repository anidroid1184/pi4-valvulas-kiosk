(() => {
  'use strict';

  const SEL = {
    panel: 'aiTrainPanel',
    search: 'aiTrainSearch',
    clear: 'btnAiTrainClear',
    count: 'aiTrainSearchCount',
    results: 'aiTrainResults',
    selectedInfo: 'aiTrainSelectedInfo'
  };

  let selectedRef = null;
  let selectedName = null;

  function sanitize(text) {
    return (window.Utils && typeof window.Utils.sanitize === 'function') ? window.Utils.sanitize(text) : String(text || '');
  }

  // Botón flotante para volver al inicio (flecha hacia arriba)
  function createScrollUpFab(panel) {
    try {
      const id = 'aiTrainScrollUpFab';
      let fab = document.getElementById(id);
      if (!fab) {
        fab = document.createElement('button');
        fab.id = id;
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Ir al inicio de la página');
        Object.assign(fab.style, {
          position: 'fixed',
          right: '18px',
          bottom: '78px', // por encima del botón de bajar
          width: '52px',
          height: '52px',
          borderRadius: '26px',
          border: 'none',
          background: '#0ea5e9',
          color: '#fff',
          boxShadow: '0 6px 18px rgba(2,132,199,0.45)',
          cursor: 'pointer',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '9999'
        });
        fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 21a1 1 0 0 1-1-1V7.41L6.7 11.7a1 1 0 1 1-1.4-1.42l6-6a1 1 0 0 1 1.4 0l6 6a1 1 0 1 1-1.4 1.42L13 7.41V20a1 1 0 0 1-1 1z"/></svg>';
        fab.addEventListener('click', () => {
          try {
            if (typeof window.scrollTo === 'function') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              window.scroll(0, 0);
            }
          } catch (_) { /* noop */ }
        });
        document.body.appendChild(fab);
      }

      const updateVisibility = () => {
        try {
          const visible = panel && !panel.hidden;
          fab.style.display = visible ? 'flex' : 'none';
        } catch (_) { /* noop */ }
      };
      updateVisibility();

      try {
        const obs = new MutationObserver(() => updateVisibility());
        obs.observe(panel, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
      } catch (_) { /* noop */ }

      window.addEventListener('hashchange', updateVisibility);
      window.addEventListener('resize', updateVisibility);
    } catch (_) { /* noop */ }
  }
  function placeholderImage() {
    return (window.Utils && typeof window.Utils.placeholderImage === 'function') ? window.Utils.placeholderImage() : document.createElement('div');
  }
  function addActivationHandlers(el, handler) {
    if (window.Utils && typeof window.Utils.addActivationHandlers === 'function') {
      return window.Utils.addActivationHandlers(el, handler);
    }
    el.addEventListener('click', handler);
  }

  function setSelectedRef(ref, name) {
    selectedRef = ref ? String(ref) : null;
    selectedName = name ? String(name) : null;
    const info = document.getElementById(SEL.selectedInfo);
    if (info) {
      info.textContent = selectedRef ? `Entrenando referencia: ${selectedName || selectedRef}` : 'Entrenando referencia: —';
    }
  }
  function getSelectedRef() { return selectedRef; }

  function currentCatalog() {
    const st = (window.Store && typeof window.Store.getState === 'function') ? window.Store.getState() : null;
    return st && Array.isArray(st.valvulas) ? st.valvulas : [];
  }

  function applyBank(list) {
    if (window.Filters && typeof window.Filters.applyBank === 'function') {
      return window.Filters.applyBank(list);
    }
    return list;
  }

  // Crea un botón flotante (FAB) con flecha hacia abajo para desplazar al final
  function createScrollDownFab(panel) {
    try {
      const id = 'aiTrainScrollDownFab';
      let fab = document.getElementById(id);
      if (!fab) {
        fab = document.createElement('button');
        fab.id = id;
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Ir al final de la página');
        // Estilos inline para no depender de CSS externo
        Object.assign(fab.style, {
          position: 'fixed',
          right: '18px',
          bottom: '18px',
          width: '52px',
          height: '52px',
          borderRadius: '26px',
          border: 'none',
          background: '#0ea5e9', // tailwind sky-500
          color: '#fff',
          boxShadow: '0 6px 18px rgba(2,132,199,0.45)',
          cursor: 'pointer',
          display: 'none', // control por visibilidad del panel
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '9999'
        });
        // Ícono flecha hacia abajo (SVG)
        fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v12.59l4.3-4.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6A1 1 0 1 1 6.7 12.3L11 16.6V4a1 1 0 0 1 1-1z"/></svg>';
        fab.addEventListener('click', () => {
          try {
            const h = Math.max(
              document.documentElement ? document.documentElement.scrollHeight : 0,
              document.body ? document.body.scrollHeight : 0
            );
            if (typeof window.scrollTo === 'function') {
              window.scrollTo({ top: h, behavior: 'smooth' });
            } else {
              window.scroll(0, h);
            }
          } catch (_) { /* noop */ }
        });
        document.body.appendChild(fab);
      }

      // Controlar visibilidad según el panel
      const updateVisibility = () => {
        try {
          const visible = panel && !panel.hidden;
          fab.style.display = visible ? 'flex' : 'none';
        } catch (_) { /* noop */ }
      };
      updateVisibility();

      // Observar cambios de atributo hidden en el panel
      try {
        const obs = new MutationObserver(() => updateVisibility());
        obs.observe(panel, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
      } catch (_) { /* noop */ }

      // También actualizar en navegación por Router, si existe
      window.addEventListener('hashchange', updateVisibility);
      window.addEventListener('resize', updateVisibility);
      document.addEventListener('scroll', () => { /* mantenerlo visible, no ocultar por scroll */ }, { passive: true });
    } catch (_) { /* noop */ }
  }

  function renderResults(list) {
    const grid = document.getElementById(SEL.results);
    const countEl = document.getElementById(SEL.count);
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = applyBank(Array.isArray(list) ? list : []);
    if (countEl) countEl.textContent = filtered.length ? `${filtered.length} resultados` : '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Sin resultados';
      grid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const v of filtered) {
      const card = document.createElement('div');
      card.className = 'card card--sm';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Seleccionar ${sanitize(v.nombre || v.id)} para entrenamiento`);

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = (v.imagen || '') + (v.imagen ? ('?t=' + Date.now()) : '');
      img.alt = `${sanitize(v.nombre || v.id)} (portada)`;
      img.addEventListener('error', () => { img.replaceWith(placeholderImage()); }, { passive: true });

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = v.nombre || v.id;

      card.append(img, title);
      addActivationHandlers(card, () => setSelectedRef(v.ref || v.id, v.nombre || v.ref));
      frag.appendChild(card);
    }
    grid.appendChild(frag);
  }

  function runSearch() {
    const input = document.getElementById(SEL.search);
    const q = String((input && input.value) || '').trim().toLowerCase();
    let list = currentCatalog();
    if (q) {
      list = list.filter(v => {
        const ref = String(v.ref || v.id || '').toLowerCase();
        const nom = String(v.nombre || '').toLowerCase();
        const serie = String(v.numero_serie || v.serie || '').toLowerCase();
        return ref.includes(q) || nom.includes(q) || (serie && serie.includes(q));
      });
    }
    renderResults(list);
  }

  function setup() {
    const panel = document.getElementById(SEL.panel);
    if (!panel) return;

    const input = document.getElementById(SEL.search);
    const btnClear = document.getElementById(SEL.clear);

    let timer = null;
    const debounce = (fn) => { clearTimeout(timer); timer = setTimeout(fn, 140); };

    if (input) {
      input.addEventListener('input', () => debounce(runSearch));
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; runSearch(); input.blur(); } });
    }
    if (btnClear) { btnClear.addEventListener('click', () => { if (input) { input.value = ''; input.focus(); } runSearch(); }); }

    // Suscribirse a cambios del filtro de bancos
    if (window.Filters && typeof window.Filters.onChange === 'function') {
      window.Filters.onChange(() => runSearch());
    }

    // Primera render
    runSearch();

    // Crear FAB (botón flotante) para desplazar al final de la página
    createScrollDownFab(panel);
    // Crear FAB para volver al inicio
    createScrollUpFab(panel);
  }

  document.addEventListener('DOMContentLoaded', setup, { once: true });

  window.AITrain = { setSelectedRef, getSelectedRef };
})();
