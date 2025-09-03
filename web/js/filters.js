(() => {
  'use strict';

  const listeners = new Set();
  const activeBanks = new Set(); // values: 'A'|'B'|'C'|'D'

  function emit() {
    for (const fn of Array.from(listeners)) {
      try { fn(new Set(activeBanks)); } catch (_) {}
    }
  }

  function getActiveBanks() { return new Set(activeBanks); }
  function onChange(fn) { if (typeof fn === 'function') listeners.add(fn); }
  function offChange(fn) { listeners.delete(fn); }

  function toggle(bank) {
    const k = String(bank || '').trim().toUpperCase();
    if (!k || !'ABCD'.includes(k)) return;
    if (activeBanks.has(k)) activeBanks.delete(k); else activeBanks.add(k);
    emit();
  }
  function clear() { if (activeBanks.size) { activeBanks.clear(); emit(); } }

  function applyBank(valvulas) {
    const list = Array.isArray(valvulas) ? valvulas : [];
    if (!activeBanks.size) return list;
    return list.filter(v => {
      let ubicaciones = [];
      if (Array.isArray(v && v.ubicacion)) {
        ubicaciones = v.ubicacion;
      } else if (v && typeof v.ubicacion === 'string') {
        ubicaciones = v.ubicacion.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      }
      return ubicaciones.some(ub => ub && activeBanks.has(String(ub).charAt(0).toUpperCase()));
    });
  }

  window.Filters = { getActiveBanks, onChange, offChange, toggle, clear, applyBank };
})();
