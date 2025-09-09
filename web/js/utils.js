(() => {
  'use strict';

  function sanitize(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&#39;');
  }

  function normalizeCardPhotoUrl(url) {
    let out = String(url || '');
    out = out.replace(/(card-photos\/)images\//i, '$1');
    out = out.replace(/\\+/g, '/');
    return out;
  }

  function tituloFromFilename(base) {
    const pretty = String(base)
      .replace(/[_-]+/g, ' ')
      .replace(/\b(valvula)\b/i, 'Válvula')
      .trim();
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }

  function placeholderImage() {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = 'Imagen no disponible';
    return ph;
  }

  function addActivationHandlers(el, handler) {
    el.addEventListener('click', handler);
    el.addEventListener('pointerup', (e) => { if (e.pointerType) { handler(); } });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  }

  window.Utils = { sanitize, normalizeCardPhotoUrl, tituloFromFilename, placeholderImage, addActivationHandlers };
})();
