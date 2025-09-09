(() => {
  'use strict';

  const state = {
    valvulas: [],
    map: new Map(),
    imagesIndex: null,
    lastActivator: null,
  };

  function getState() { return state; }

  function setValvulas(list) {
    state.valvulas = Array.isArray(list) ? list : [];
    state.map = new Map();
    for (const v of state.valvulas) {
      if (!v || v.id == null) continue;
      state.map.set(String(v.id), v);
      if (v.ref) state.map.set(String(v.ref), v);
    }
  }

  function setImagesIndex(idx) { state.imagesIndex = idx || null; }
  function setLastActivator(el) { state.lastActivator = el || null; }

  // Pure find by code using provided map
  function findValveIdPure(map, code) {
    if (!code) return null;
    const raw = String(code).trim();
    let extracted = null;
    try {
      let m = raw.match(/^valve:\s*([^\s?#/]+)$/i);
      if (m && m[1]) extracted = m[1];
      if (!extracted) { m = raw.match(/^valve:\/\/([^\s?#/]+)$/i); if (m && m[1]) extracted = m[1]; }
      if (!extracted) { m = raw.match(/\/valve\/([A-Za-z0-9_-]+)/i); if (m && m[1]) extracted = m[1]; }
      if (!extracted) { m = raw.match(/[?&]id=([A-Za-z0-9_-]+)/i); if (m && m[1]) extracted = m[1]; }
    } catch(_) {}
    const candidates = [];
    if (extracted) candidates.push(extracted);
    candidates.push(raw);
    for (const cand of candidates) {
      const c1 = cand;
      const c2 = String(cand).toLowerCase();
      const c3 = c2.replace(/[^a-z0-9_-]+/g, '-');
      if (map.has(c1)) return c1;
      if (map.has(c2)) return c2;
      if (map.has(c3)) return c3;
    }
    const lower = String(extracted || raw).toLowerCase();
    for (const [id, v] of map.entries()) {
      if (String((v && v.nombre) || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  window.Store = { getState, setValvulas, setImagesIndex, setLastActivator, findValveIdPure };
})();
