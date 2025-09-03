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

  function sanitize(text){
    return (window.Utils && typeof window.Utils.sanitize === 'function') ? window.Utils.sanitize(text) : String(text||'');
  }
  function placeholderImage(){
    return (window.Utils && typeof window.Utils.placeholderImage === 'function') ? window.Utils.placeholderImage() : document.createElement('div');
  }
  function addActivationHandlers(el, handler) {
    if (window.Utils && typeof window.Utils.addActivationHandlers === 'function') {
      return window.Utils.addActivationHandlers(el, handler);
    }
    el.addEventListener('click', handler);
  }

  function setSelectedRef(ref, name){
    selectedRef = ref ? String(ref) : null;
    selectedName = name ? String(name) : null;
    const info = document.getElementById(SEL.selectedInfo);
    if (info){
      info.textContent = selectedRef ? `Entrenando referencia: ${selectedName || selectedRef}` : 'Entrenando referencia: —';
    }
  }
  function getSelectedRef(){ return selectedRef; }

  function currentCatalog(){
    const st = (window.Store && typeof window.Store.getState === 'function') ? window.Store.getState() : null;
    return st && Array.isArray(st.valvulas) ? st.valvulas : [];
  }

  function applyBank(list){
    if (window.Filters && typeof window.Filters.applyBank === 'function'){
      return window.Filters.applyBank(list);
    }
    return list;
  }

  function renderResults(list){
    const grid = document.getElementById(SEL.results);
    const countEl = document.getElementById(SEL.count);
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = applyBank(Array.isArray(list) ? list : []);
    if (countEl) countEl.textContent = filtered.length ? `${filtered.length} resultados` : '';

    if (!filtered.length){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Sin resultados';
      grid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const v of filtered){
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

  function runSearch(){
    const input = document.getElementById(SEL.search);
    const q = String((input && input.value) || '').trim().toLowerCase();
    let list = currentCatalog();
    if (q){
      list = list.filter(v => {
        const ref = String(v.ref || v.id || '').toLowerCase();
        const nom = String(v.nombre || '').toLowerCase();
        const serie = String(v.numero_serie || v.serie || '').toLowerCase();
        return ref.includes(q) || nom.includes(q) || (serie && serie.includes(q));
      });
    }
    renderResults(list);
  }

  function setup(){
    const panel = document.getElementById(SEL.panel);
    if (!panel) return;

    const input = document.getElementById(SEL.search);
    const btnClear = document.getElementById(SEL.clear);

    let timer = null;
    const debounce = (fn) => { clearTimeout(timer); timer = setTimeout(fn, 140); };

    if (input){
      input.addEventListener('input', () => debounce(runSearch));
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; runSearch(); input.blur(); } });
    }
    if (btnClear){ btnClear.addEventListener('click', () => { if (input) { input.value=''; input.focus(); } runSearch(); }); }

    // Suscribirse a cambios del filtro de bancos
    if (window.Filters && typeof window.Filters.onChange === 'function'){
      window.Filters.onChange(() => runSearch());
    }

    // Primera render
    runSearch();
  }

  document.addEventListener('DOMContentLoaded', setup, { once: true });

  window.AITrain = { setSelectedRef, getSelectedRef };
})();
