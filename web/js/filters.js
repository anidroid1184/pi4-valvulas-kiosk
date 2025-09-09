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

  // Extrae posibles letras de banco (A/B/C/D) desde una cadena o arreglo de ubicaciones.
  function extractBanks(ubicacion) {
    const out = new Set();
    const pushIfBank = (tok) => {
      if (!tok) return;
      const s = String(tok).trim().toUpperCase();
      if (!s) return;
      // Coincidir frases tipo "Banco A" / "Bank B"
      if (/BANC?O\s*A\b/.test(s) || /\bBANK\s*A\b/.test(s)) { out.add('A'); return; }
      if (/BANC?O\s*B\b/.test(s) || /\bBANK\s*B\b/.test(s)) { out.add('B'); return; }
      if (/BANC?O\s*C\b/.test(s) || /\bBANK\s*C\b/.test(s)) { out.add('C'); return; }
      if (/BANC?O\s*D\b/.test(s) || /\bBANK\s*D\b/.test(s)) { out.add('D'); return; }
      // Si empieza por A/B/C/D, cuenta como banco
      const first = s.charAt(0);
      if (first === 'A' || first === 'B' || first === 'C' || first === 'D') {
        out.add(first);
      }
    };

    if (Array.isArray(ubicacion)) {
      for (const item of ubicacion) {
        if (typeof item === 'string') {
          // Separadores comunes: '/', '|', ';', ',', '.', '-', espacios múltiples
          const tokens = String(item).split(/[\/|;,\.\-]+/).flatMap(t => t.split(/\s+/)).map(s => s.trim()).filter(Boolean);
          for (const t of tokens) pushIfBank(t);
        } else if (item != null) {
          pushIfBank(item);
        }
      }
    } else if (typeof ubicacion === 'string') {
      const tokens = String(ubicacion).split(/[\/|;,\.\-]+/).flatMap(t => t.split(/\s+/)).map(s => s.trim()).filter(Boolean);
      for (const t of tokens) pushIfBank(t);
    } else if (ubicacion != null) {
      pushIfBank(ubicacion);
    }
    return out;
  }

  function applyBank(valvulas) {
    const list = Array.isArray(valvulas) ? valvulas : [];
    if (!activeBanks.size) return list;
    return list.filter(v => {
      const banks = extractBanks(v && v.ubicacion);
      if (!banks.size) return false;
      // intersect(banks, activeBanks)
      for (const b of banks) { if (activeBanks.has(b)) return true; }
      return false;
    });
  }

  window.Filters = { getActiveBanks, onChange, offChange, toggle, clear, applyBank };
})();
