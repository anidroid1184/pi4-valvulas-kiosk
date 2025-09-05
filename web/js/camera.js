(() => {
  'use strict';

  // Backend base URL aligned with CORS-allowed origin
  const BACKEND = 'http://127.0.0.1:8000';

  // QR scanner (html5-qrcode)
  let qr = null;
  let qrActive = false;
  let qrStarting = false;

  // AI Recognize via browser camera (getUserMedia)
  let aiUserMedia = null;
  let aiStarting = false;
  // AI Train via browser camera (getUserMedia)
  let aiTrainUserMedia = null;
  let aiTrainRunning = false;
  let aiTrainLoop = null;
  let aiTrainStartTs = 0;
  let aiTrainSent = 0;
  let aiTrainFailed = 0;
  let aiTrainTarget = 60; // imágenes objetivo

  function setStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg || '';
  }

  // No necesidad de selectores: el navegador muestra su selector nativo

  // html5-qrcode callbacks
  function onScanSuccess(decodedText) {
    const text = String(decodedText || '').trim();
    const resolver = (window.ValvulasApp && typeof window.ValvulasApp.findValveId === 'function') ? window.ValvulasApp.findValveId : (x => x);
    const id = resolver(text) || text;
    if (window.ValvulasApp && typeof window.ValvulasApp.onValveSelect === 'function') {
      window.ValvulasApp.onValveSelect(id);
    }
    setStatus(`Código detectado: ${text} → id: ${id}`);
    // Mantenerse en la pestaña actual (QR). El sidebar muestra la info.
    // Opcional: detener para evitar lecturas repetidas
    // if(qrActive) { closeCamera(); }
  }
  function onScanError(_err) { /* silencioso para no saturar UI */ }

  async function openCamera() {
    try {
      const panel = document.getElementById('cameraPanel');
      const btnOpen = document.getElementById('btnAbrirCam');
      const btnClose = document.getElementById('btnCerrarCam');
      if (qrActive || qrStarting) return;
      qrStarting = true;
      // Asegurar que el contenedor esté visible antes de iniciar html5-qrcode
      if (panel) panel.hidden = false;
      // Asegurar exclusión: detener cámara AI si estuviera activa
      try { window.CameraDemo && typeof window.CameraDemo.stopAICamera === 'function' && window.CameraDemo.stopAICamera(); } catch (_) { }
      // Verificar que la librería esté cargada
      if (typeof Html5Qrcode === 'undefined') {
        console.error('[QR] Html5Qrcode no está disponible');
        setStatus('Librería de QR no cargada');
        qrStarting = false;
        return;
      }
      if (!qr) { qr = new Html5Qrcode('qr-reader'); }
      try {
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 320, height: 320 } },
          onScanSuccess,
          onScanError
        );
      } catch (e) {
        // Algunos navegadores arrojan: "Cannot transition to a new state, already under transition"
        const msg = String(e && e.message || e);
        if (msg.toLowerCase().includes('already under transition')) {
          try { await qr.stop(); } catch (_) { }
          try { await qr.clear(); } catch (_) { }
          await new Promise(r => setTimeout(r, 150));
          await qr.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 320, height: 320 } },
            onScanSuccess,
            onScanError
          );
        } else {
          throw e;
        }
      }
      qrActive = true;
      if (btnOpen) btnOpen.hidden = true;
      if (btnClose) btnClose.hidden = false;
      setStatus('Lector QR activo');
    } catch (err) {
      console.error(err);
      const msg = (err && err.name === 'NotReadableError') ? 'El dispositivo está en uso por otra pestaña o aplicación' : 'No fue posible acceder a la cámara (QR)';
      setStatus(msg);
    }
    finally { qrStarting = false; }
  }

  async function closeCamera() {
    try {
      const panel = document.getElementById('cameraPanel');
      const btnOpen = document.getElementById('btnAbrirCam');
      const btnClose = document.getElementById('btnCerrarCam');

      if (qrActive && qr) {
        try { await qr.stop(); } catch (_) {/* noop */ }
        try { await qr.clear(); } catch (_) {/* noop */ }
      }
      qrActive = false;
      qrStarting = false;

      if (panel) panel.hidden = true;
      if (btnOpen) btnOpen.hidden = false;
      if (btnClose) btnClose.hidden = true;
      setStatus('');
    } catch (_) { setStatus(''); }
  }

  // Navegación de tabs delegada al Router (js/router.js)

  // Conservado por compatibilidad pero no se usa con html5-qrcode
  async function scanCodeFromPreview() {
    try {
      const video = document.getElementById('cameraVideo');
      const guide = document.getElementById('qrGuideText');
      if (!video || !video.videoWidth) {
        setStatus('Cámara no lista para escanear');
        return;
      }
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (guide) guide.textContent = 'Procesando…';
      const form = new FormData();
      form.append('image', blob, 'frame.jpg');

      let data = null;
      try {
        const r = await fetch(`${BACKEND}/scan_code`, { method: 'POST', body: form });
        if (r.ok) {
          data = await r.json();
        } else {
          const msg = await r.text();
          setStatus(`Error al escanear: ${msg || r.status}`);
          if (guide) guide.textContent = 'Coloca el QR o código de barras dentro del marco';
          return;
        }
      } catch (err) {
        console.error(err);
        setStatus(`No se pudo conectar con el servicio de códigos (${BACKEND})`);
        if (guide) guide.textContent = 'Coloca el QR o código de barras dentro del marco';
        return;
      }

      const codes = (data && Array.isArray(data.codes)) ? data.codes : [];
      if (!codes.length) {
        setStatus('No se detectaron códigos');
        if (guide) guide.textContent = 'Intenta acercarte y mantener el código plano';
        return;
      }

      // Resolver a un ID válido del catálogo y abrir detalle
      const text = String(codes[0].data || '').trim();
      if (window.ValvulasApp && typeof window.ValvulasApp.onValveSelect === 'function') {
        const resolver = typeof window.ValvulasApp.findValveId === 'function' ? window.ValvulasApp.findValveId : (x => x);
        const id = resolver(text) || text;
        window.ValvulasApp.onValveSelect(id);
        setStatus(`Código detectado: ${text} → id: ${id}`);
        if (guide) guide.textContent = 'Código detectado';
        return;
      }

      setStatus(`Código detectado: ${text}, pero no se pudo abrir el detalle automáticamente`);
      if (guide) guide.textContent = 'Código detectado';
    } catch (err) {
      console.error(err);
      setStatus('Error al procesar el escaneo');
    }
  }

  async function startAICamera() {
    try {
      if (aiStarting) return;
      aiStarting = true;
      const video = document.getElementById('aiVideo');
      const btnStart = document.getElementById('btnAIStart');
      const btnStop = document.getElementById('btnAIStop');
      const btnCap = document.getElementById('btnAICapture');
      // Exclusión: cerrar QR si estuviera activo
      try { window.CameraQR && typeof window.CameraQR.close === 'function' && window.CameraQR.close(); } catch (_) { }
      setStatus('Solicitando acceso a la cámara…');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      aiUserMedia = stream;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      if (btnStart) btnStart.hidden = true;
      if (btnStop) btnStop.hidden = false;
      if (btnCap) btnCap.disabled = false;
      setStatus('Cámara lista');
    } catch (err) {
      console.error(err);
      setStatus('No fue posible acceder a la cámara');
    } finally {
      aiStarting = false;
    }
  }

  function stopAICamera() {
    try {
      const video = document.getElementById('aiVideo');
      const btnStart = document.getElementById('btnAIStart');
      const btnStop = document.getElementById('btnAIStop');
      const btnCap = document.getElementById('btnAICapture');
      if (aiUserMedia) {
        try { aiUserMedia.getTracks().forEach(t => t.stop()); } catch (_) { }
        aiUserMedia = null;
      }
      if (video) { video.srcObject = null; }
      if (btnStart) btnStart.hidden = false;
      if (btnStop) btnStop.hidden = true;
      if (btnCap) btnCap.disabled = true;
      setStatus('');
    } catch (_) {/* noop */ }
  }

  async function captureAndRecognize() {
    try {
      const result = document.getElementById('aiResult');
      const btnAICapture = document.getElementById('btnAICapture');
      if (result) { result.textContent = 'Procesando…'; }
      if (btnAICapture) { btnAICapture.disabled = true; }

      // Obtener snapshot desde el <video> (navegador)
      const video = document.getElementById('aiVideo');
      if (!video || !video.videoWidth) { setStatus('Cámara no lista'); if (btnAICapture) btnAICapture.disabled = false; return; }
      const w = video.videoWidth, h = video.videoHeight;
      const canvas = document.getElementById('aiCanvas');
      if (!canvas) { setStatus('No hay canvas para captura'); if (btnAICapture) btnAICapture.disabled = false; return; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));

      // Enviar a la API local de reconocimiento
      const form = new FormData();
      form.append('image', blob, 'frame.jpg');

      try {
        const r = await fetch(`${BACKEND}/recognize`, { method: 'POST', body: form });
        if (r.ok) {
          const data = await r.json();
          updateAIGuideText(typeof data.confidence === 'number' ? data.confidence : 0);
          renderAIResult(data);
        } else if (r.status === 404) {
          updateAIGuideText(0);
          renderAIResult(null);
        } else {
          const msg = await r.text();
          setStatus(`Error del servidor: ${msg || r.status}`);
        }
      } catch (netErr) {
        console.error(netErr);
        setStatus(`No se pudo conectar con el servicio de reconocimiento (${BACKEND})`);
      } finally {
        if (btnAICapture) { btnAICapture.disabled = false; }
      }
    } catch (err) {
      console.error(err);
      setStatus('Error al capturar o reconocer');
    }
  }

  function updateAIGuideText(conf) {
    const guide = document.getElementById('aiGuideText');
    if (!guide) return;
    const c = Math.max(0, Math.min(1, Number(conf) || 0));
    if (c >= 0.6) {
      guide.textContent = 'Mantén el encuadre. Calidad buena.';
    } else if (c >= 0.35) {
      guide.textContent = 'Ajusta ligeramente el encuadre y enfoque.';
    } else {
      guide.textContent = 'Acércate y alinea la válvula dentro del marco.';
    }
  }

  function renderAIResult(data) {
    const box = document.getElementById('aiResult');
    if (!box) return;
    box.innerHTML = '';
    if (!data) {
      box.textContent = 'Sin coincidencias';
      return;
    }
    const title = document.createElement('div');
    title.className = 'badge ok';
    title.textContent = `Coincidencia: ${data.name || data.valve_id} (conf: ${Math.round((data.confidence || 0) * 100)}%)`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn';
    btn.textContent = 'Ver información';
    btn.addEventListener('click', () => {
      if (window.ValvulasApp && typeof window.ValvulasApp.onValveSelect === 'function') {
        window.ValvulasApp.onValveSelect(data.valve_id);
      }
    });

    box.append(title, btn);
  }

  function init() {
    const btnOpen = document.getElementById('btnAbrirCam');
    const btnClose = document.getElementById('btnCerrarCam');
    const btnAIStart = document.getElementById('btnAIStart');
    const btnAIStop = document.getElementById('btnAIStop');
    const btnAICapture = document.getElementById('btnAICapture');
    const btnAiTrainStart = document.getElementById('btnAiTrainStart');
    const btnAiTrainStop = document.getElementById('btnAiTrainStop');
    const btnAiTrainCapture = document.getElementById('btnAiTrainCapture');
    if (btnOpen) btnOpen.addEventListener('click', openCamera);
    if (btnClose) btnClose.addEventListener('click', closeCamera);
    if (btnAIStart) btnAIStart.addEventListener('click', startAICamera);
    if (btnAIStop) btnAIStop.addEventListener('click', stopAICamera);
    if (btnAICapture) btnAICapture.addEventListener('click', captureAndRecognize);

    if (btnAiTrainStart) {
      btnAiTrainStart.addEventListener('click', () => { console.log('[AITrain] Click start'); startAITrainCamera(); });
    } else { console.warn('[AITrain] btnAiTrainStart no encontrado'); }
    if (btnAiTrainStop) {
      btnAiTrainStop.addEventListener('click', () => { console.log('[AITrain] Click stop'); stopAITrainCamera(); });
    } else { console.warn('[AITrain] btnAiTrainStop no encontrado'); }
    if (btnAiTrainCapture) {
      btnAiTrainCapture.addEventListener('click', () => { console.log('[AITrain] Click capture'); startAITrainingCapture(); });
    } else { console.warn('[AITrain] btnAiTrainCapture no encontrado'); }
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });

  // Expose for manual testing if needed
  window.CameraQR = { open: openCamera, close: closeCamera, isActive: () => qrActive };
  window.CameraDemo = { openCamera, closeCamera, startAICamera, stopAICamera, captureAndRecognize };

  // ---- AI Train implementation ----
  let aiTrainStatusTimer = null; // legacy (no usado con getUserMedia)
  async function startAITrainCamera() {
    try {
      const video = document.getElementById('aiTrainVideo');
      const btnStart = document.getElementById('btnAiTrainStart');
      const btnStop = document.getElementById('btnAiTrainStop');
      const btnCap = document.getElementById('btnAiTrainCapture');
      setStatus('Solicitando acceso a la cámara…');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      aiTrainUserMedia = stream;
      if (video) {
        video.hidden = false;
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      if (btnStart) btnStart.hidden = true;
      if (btnStop) btnStop.hidden = false;
      if (btnCap) btnCap.disabled = false;
      setStatus('Cámara lista');
    } catch (err) {
      console.error(err);
      setStatus('No fue posible acceder a la cámara');
    }
  }

  async function stopAITrainCamera() {
    try {
      const btnStart = document.getElementById('btnAiTrainStart');
      const btnStop = document.getElementById('btnAiTrainStop');
      const btnCap = document.getElementById('btnAiTrainCapture');
      const video = document.getElementById('aiTrainVideo');
      if (aiTrainStatusTimer) { clearInterval(aiTrainStatusTimer); aiTrainStatusTimer = null; }
      if (aiTrainLoop) { clearInterval(aiTrainLoop); aiTrainLoop = null; }
      if (aiTrainUserMedia) {
        try { aiTrainUserMedia.getTracks().forEach(t => t.stop()); } catch (_) { }
        aiTrainUserMedia = null;
      }
      if (video) { video.srcObject = null; video.hidden = true; }
      if (btnStart) btnStart.hidden = false;
      if (btnStop) btnStop.hidden = true;
      if (btnCap) btnCap.disabled = true;
      setStatus('');
    } catch (_) {/* noop */ }
  }

  async function startAITrainingCapture() {
    const ref = (window.AITrain && typeof window.AITrain.getSelectedRef === 'function') ? window.AITrain.getSelectedRef() : null;
    if (!ref) { setStatus('Selecciona una referencia en la lista de arriba antes de capturar.'); return; }
    const btnCap = document.getElementById('btnAiTrainCapture');
    const btnStop = document.getElementById('btnAiTrainStop');
    const timerEl = document.getElementById('aiTrainTimer');
    if (btnCap) btnCap.disabled = true;
    if (btnStop) btnStop.disabled = false;
    const video = document.getElementById('aiTrainVideo');
    if (!video || !video.videoWidth) { setStatus('Cámara no lista'); if (btnCap) btnCap.disabled = false; return; }
    aiTrainRunning = true;
    aiTrainSent = 0; aiTrainFailed = 0; aiTrainTarget = 60; aiTrainStartTs = Date.now();
    const canvas = document.getElementById('aiTrainCanvas');
    const w = video.videoWidth, h = video.videoHeight;
    canvas.width = w; canvas.height = h;
    // notificar inicio
    try { window.dispatchEvent(new CustomEvent('AI_TRAIN_PROGRESS', { detail: { sent: 0, total: aiTrainTarget, failed: 0, elapsed: 0, running: true } })); } catch (_) { }
    if (aiTrainLoop) { clearInterval(aiTrainLoop); }
    aiTrainLoop = setInterval(async () => {
      if (!aiTrainRunning) return;
      const elapsed = Math.round((Date.now() - aiTrainStartTs) / 1000);
      if (elapsed >= 35 || (aiTrainSent + aiTrainFailed) >= aiTrainTarget) {
        clearInterval(aiTrainLoop); aiTrainLoop = null; aiTrainRunning = false;
        try { await fetch(`${BACKEND}/train/finalize`, { method: 'POST' }); } catch (_) { }
        setStatus(`Entrenamiento completado: ${aiTrainSent}/${aiTrainTarget} imágenes subidas${aiTrainFailed ? `, ${aiTrainFailed} fallidas` : ''}. Índice actualizado.`);
        if (btnCap) btnCap.disabled = false;
        if (timerEl) timerEl.textContent = '';
        return;
      }
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      const form = new FormData();
      form.append('ref', String(ref));
      form.append('image', blob, 'frame.jpg');
      try {
        const r = await fetch(`${BACKEND}/train/upload`, { method: 'POST', body: form });
        if (r.ok) { aiTrainSent += 1; }
        else { aiTrainFailed += 1; }
      } catch (_) { aiTrainFailed += 1; }
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${aiTrainSent}/${aiTrainTarget} subidas • ${mm}:${ss}`;
      try { window.dispatchEvent(new CustomEvent('AI_TRAIN_PROGRESS', { detail: { sent: aiTrainSent, total: aiTrainTarget, failed: aiTrainFailed, elapsed, running: aiTrainRunning } })); } catch (_) { }
    }, 500);
  }

  // expose for debugging
  window.AITrainCam = { startAITrainCamera, stopAITrainCamera, startAITrainingCapture };
})();
