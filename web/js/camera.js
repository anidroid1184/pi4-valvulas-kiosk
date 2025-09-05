(() => {
  'use strict';

  // Backend base URL aligned with CORS-allowed origin
  const BACKEND = 'http://127.0.0.1:8000';

  // QR scanner (html5-qrcode)
  let qr = null;
  let qrActive = false;
  let qrStarting = false;

  // AI Recognize via backend cv2 (MJPEG stream)
  let mediaStream = null; // legacy
  let aiStream = null;    // legacy
  let aiStarting = false;
  // AI Train camera stream and loop
  let aiTrainStream = null;
  let aiTrainRunning = false;
  let aiTrainAbort = false;

  function setStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg || '';
  }

  async function loadCvDevices() {
    try {
      const selAI = document.getElementById('aiDevice');
      const selTrain = document.getElementById('aiTrainDevice');
      if (!selAI && !selTrain) return;
      // Clear existing
      const applyOptions = (sel) => {
        if (!sel) return;
        while (sel.firstChild) sel.removeChild(sel.firstChild);
      };
      applyOptions(selAI);
      applyOptions(selTrain);
      let devices = [];
      try {
        const r = await fetch(`${BACKEND}/cv/devices`);
        if (r.ok) {
          const data = await r.json();
          devices = (data && Array.isArray(data.devices)) ? data.devices : [];
        }
      } catch (_) { /* offline? fallback below */ }
      if (!devices.length) {
        devices = [{ index: 0, name: 'Device 0' }];
      }
      const fill = (sel) => {
        if (!sel) return;
        for (const d of devices) {
          const opt = document.createElement('option');
          opt.value = String(d.index);
          opt.textContent = `${d.name}`;
          sel.appendChild(opt);
        }
        sel.value = String(devices[0].index);
      };
      fill(selAI);
      fill(selTrain);
    } catch (err) {
      console.warn('No se pudieron cargar dispositivos cv2', err);
    }
  }

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
      const img = document.getElementById('aiMJPEG');
      const btnStart = document.getElementById('btnAIStart');
      const btnStop = document.getElementById('btnAIStop');
      const btnCap = document.getElementById('btnAICapture');
      const selAI = document.getElementById('aiDevice');
      const idx = Number(selAI && selAI.value ? selAI.value : 0) || 0;
      // Exclusión: cerrar QR si estuviera activo
      try { window.CameraQR && typeof window.CameraQR.close === 'function' && window.CameraQR.close(); } catch (_) { }
      setStatus('Iniciando cámara cv2…');
      try { await fetch(`${BACKEND}/cv/start?index=${encodeURIComponent(idx)}`, { method: 'POST' }); } catch (_) { /* offline? */ }
      if (img) {
        const onLoad = () => setStatus('Cámara AI (cv2) lista');
        const onError = async () => {
          try { await fetch(`${BACKEND}/cv/start?index=${encodeURIComponent(idx)}`, { method: 'POST' }); } catch (_) { }
          const base = `${BACKEND}/cv/stream`;
          img.src = base + (base.includes('?') ? '&' : '?') + 't=' + Date.now();
        };
        try { img.removeEventListener('load', onLoad); img.removeEventListener('error', onError); } catch (_) { }
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
        if (!img.src) { img.src = `${BACKEND}/cv/stream?t=` + Date.now(); }
      }
      if (btnStart) btnStart.hidden = true;
      if (btnStop) btnStop.hidden = false;
      if (btnCap) btnCap.disabled = false;
    } catch (err) {
      console.error(err);
      setStatus('No fue posible iniciar la cámara AI (cv2)');
    } finally {
      aiStarting = false;
    }
  }

  function stopAICamera() {
    try {
      const img = document.getElementById('aiMJPEG');
      const btnStart = document.getElementById('btnAIStart');
      const btnStop = document.getElementById('btnAIStop');
      const btnCap = document.getElementById('btnAICapture');
      try { fetch(`${BACKEND}/cv/stop`, { method: 'POST' }); } catch (_) { }
      if (img) { img.src = ''; }
      if (btnStart) btnStart.hidden = false;
      if (btnStop) btnStop.hidden = true;
      if (btnCap) btnCap.disabled = true;
    } catch (_) {/* noop */ }
  }

  async function captureAndRecognize() {
    try {
      const result = document.getElementById('aiResult');
      const btnAICapture = document.getElementById('btnAICapture');
      if (result) { result.textContent = 'Procesando…'; }
      if (btnAICapture) { btnAICapture.disabled = true; }

      // Obtener snapshot desde backend cv2
      const snap = await fetch(`${BACKEND}/cv/snapshot`, { method: 'GET', cache: 'no-store' });
      if (!snap.ok) { setStatus('No hay frame disponible (cv2)'); if (btnAICapture) btnAICapture.disabled = false; return; }
      const blob = await snap.blob();

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
    // Cargar dispositivos al iniciar
    loadCvDevices();
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });

  // Expose for manual testing if needed
  window.CameraQR = { open: openCamera, close: closeCamera, isActive: () => qrActive };
  window.CameraDemo = { openCamera, closeCamera, startAICamera, stopAICamera, captureAndRecognize };

  // ---- AI Train implementation ----
  let aiTrainStatusTimer = null; // polling status
  async function startAITrainCamera() {
    try {
      const img = document.getElementById('aiTrainMJPEG');
      const btnStart = document.getElementById('btnAiTrainStart');
      const btnStop = document.getElementById('btnAiTrainStop');
      const btnCap = document.getElementById('btnAiTrainCapture');
      const selTrain = document.getElementById('aiTrainDevice');
      const idx = Number(selTrain && selTrain.value ? selTrain.value : 0) || 0;
      setStatus('Iniciando vista previa cv2…');
      // Abrir cámara cv2 (sin entrenar) antes de fijar el stream
      try { await fetch(`${BACKEND}/cv/start?index=${encodeURIComponent(idx)}`, { method: 'POST' }); } catch (_) {/* offline? */ }
      // Stream MJPEG con handlers de robustez
      if (img) {
        const loadOk = () => { setStatus('Cámara cv2 lista'); };
        const loadErr = async () => {
          // Reintentar: aseguremos cámara abierta y recargar con cache-busting
          try { await fetch(`${BACKEND}/cv/start?index=${encodeURIComponent(idx)}`, { method: 'POST' }); } catch (_) { }
          const base = `${BACKEND}/cv/stream`;
          img.src = base + (base.includes('?') ? '&' : '?') + 't=' + Date.now();
        };
        try { img.removeEventListener('load', loadOk); img.removeEventListener('error', loadErr); } catch (_) { }
        img.addEventListener('load', loadOk, { once: false });
        img.addEventListener('error', loadErr, { once: false });
        if (!img.src) { img.src = `${BACKEND}/cv/stream?t=` + Date.now(); }
      }
      if (btnStart) btnStart.hidden = true;
      if (btnStop) btnStop.hidden = false;
      if (btnCap) btnCap.disabled = false;
      // status será actualizado por onload
    } catch (err) {
      console.error(err);
      setStatus('No fue posible iniciar la cámara cv2');
    }
  }

  async function stopAITrainCamera() {
    try {
      const btnStart = document.getElementById('btnAiTrainStart');
      const btnStop = document.getElementById('btnAiTrainStop');
      const btnCap = document.getElementById('btnAiTrainCapture');
      const img = document.getElementById('aiTrainMJPEG');
      if (aiTrainStatusTimer) { clearInterval(aiTrainStatusTimer); aiTrainStatusTimer = null; }
      try { await fetch(`${BACKEND}/cv/stop`, { method: 'POST' }); } catch (_) { }
      // cerrar stream visual
      if (img) { img.src = ''; }
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
    const selTrain = document.getElementById('aiTrainDevice');
    const idx = Number(selTrain && selTrain.value ? selTrain.value : 0) || 0;
    if (btnCap) btnCap.disabled = true;
    if (btnStop) btnStop.disabled = false;
    // iniciar entrenamiento en backend cv2
    try {
      const r = await fetch(`${BACKEND}/cv/start?train=1&ref=${encodeURIComponent(String(ref))}&index=${encodeURIComponent(idx)}`, { method: 'POST' });
      if (!r.ok) { setStatus('No se pudo iniciar entrenamiento'); if (btnCap) btnCap.disabled = false; return; }
    } catch (err) { console.error(err); setStatus('Error de red iniciando entrenamiento'); if (btnCap) btnCap.disabled = false; return; }

    const t0 = Date.now();
    // notificar inicio
    try { window.dispatchEvent(new CustomEvent('AI_TRAIN_PROGRESS', { detail: { sent: 0, total: 60, failed: 0, elapsed: 0, running: true } })); } catch (_) { }

    // polling estado
    if (aiTrainStatusTimer) { clearInterval(aiTrainStatusTimer); }
    aiTrainStatusTimer = setInterval(async () => {
      try {
        const rs = await fetch(`${BACKEND}/cv/status`);
        if (!rs.ok) return;
        const st = await rs.json();
        const elapsed = Math.round((Date.now() - t0) / 1000);
        const sent = Number(st.sent || 0);
        const total = Number(st.total || 60);
        const failed = Number(st.failed || 0);
        const running = !!st.training;
        // emitir progreso para sidebar
        try { window.dispatchEvent(new CustomEvent('AI_TRAIN_PROGRESS', { detail: { sent, total, failed, elapsed, running } })); } catch (_) { }
        if (timerEl) {
          const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const ss = String(elapsed % 60).padStart(2, '0');
          timerEl.textContent = `${sent}/${total} subidas • ${mm}:${ss}`;
        }
        if (!running || sent + failed >= total) {
          clearInterval(aiTrainStatusTimer); aiTrainStatusTimer = null;
          // reindexar
          try { await fetch(`${BACKEND}/train/finalize`, { method: 'POST' }); } catch (_) { }
          setStatus(`Entrenamiento completado: ${sent}/${total} imágenes subidas${failed ? `, ${failed} fallidas` : ''}. Índice actualizado.`);
          if (btnCap) btnCap.disabled = false;
          if (timerEl) timerEl.textContent = '';
        }
      } catch (_) { /* noop */ }
    }, 500);
  }

  // expose for debugging
  window.AITrainCam = { startAITrainCamera, stopAITrainCamera, startAITrainingCapture };
})();
