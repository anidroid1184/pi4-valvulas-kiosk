(() => {
  'use strict';

  // QR scanner (html5-qrcode)
  let qr = null;
  let qrActive = false;

  // AI camera stream (getUserMedia)
  let mediaStream = null;
  let aiStream = null;

  function setStatus(msg){
    const el = document.getElementById('status');
    if(el) el.textContent = msg || '';
  }

  // html5-qrcode callbacks
  function onScanSuccess(decodedText){
    const text = String(decodedText || '').trim();
    const resolver = (window.ValvulasApp && typeof window.ValvulasApp.findValveId === 'function') ? window.ValvulasApp.findValveId : (x=>x);
    const id = resolver(text) || text;
    if(window.ValvulasApp && typeof window.ValvulasApp.onValveSelect === 'function'){
      window.ValvulasApp.onValveSelect(id);
    }
    setStatus(`Código detectado: ${text} → id: ${id}`);
    // Ir a la pestaña de Inicio/Imágenes para ver la información
    try{ showImagesTab(); }catch(_){}
    // Opcional: detener para evitar lecturas repetidas
    // if(qrActive) { closeCamera(); }
  }
  function onScanError(_err){ /* silencioso para no saturar UI */ }

  async function openCamera(){
    try{
      const panel = document.getElementById('cameraPanel');
      const btnOpen = document.getElementById('btnAbrirCam');
      const btnClose = document.getElementById('btnCerrarCam');
      if(qrActive) return;
      if(!qr){ qr = new Html5Qrcode('qr-reader'); }
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 320, height: 320 } },
        onScanSuccess,
        onScanError
      );
      qrActive = true;
      if(panel) panel.hidden = false;
      if(btnOpen) btnOpen.hidden = true;
      if(btnClose) btnClose.hidden = false;
      setStatus('Cámara abierta (vista previa)');
    }catch(err){
      console.error(err);
      setStatus('No fue posible acceder a la cámara');
    }
  }

  async function closeCamera(){
    try{
      const panel = document.getElementById('cameraPanel');
      const btnOpen = document.getElementById('btnAbrirCam');
      const btnClose = document.getElementById('btnCerrarCam');

      if(qrActive && qr){
        try{ await qr.stop(); }catch(_){/* noop */}
        try{ await qr.clear(); }catch(_){/* noop */}
      }
      qrActive = false;

      if(panel) panel.hidden = true;
      if(btnOpen) btnOpen.hidden = false;
      if(btnClose) btnClose.hidden = true;
      setStatus('');
    }catch(_){ setStatus(''); }
  }

  function showImagesTab(){
    const images = document.getElementById('imagesPanel');
    const camera = document.getElementById('cameraPanel');
    const ai = document.getElementById('aiPanel');
    if(camera && !camera.hidden){ closeCamera(); }
    if(ai && !ai.hidden){ stopAICamera(); }
    if(images) images.hidden = false;
    if(camera) camera.hidden = true;
    if(ai) ai.hidden = true;
  }

  function showCameraTab(){
    const images = document.getElementById('imagesPanel');
    const camera = document.getElementById('cameraPanel');
    const ai = document.getElementById('aiPanel');
    if(images) images.hidden = true;
    if(camera) camera.hidden = false;
    if(ai) ai.hidden = true;
    // abrir cámara automáticamente al cambiar de pestaña
    openCamera();
  }

  function showAITab(){
    const images = document.getElementById('imagesPanel');
    const camera = document.getElementById('cameraPanel');
    const ai = document.getElementById('aiPanel');
    if(images) images.hidden = true;
    if(camera){ camera.hidden = true; if(!camera.hidden){ closeCamera(); } }
    if(ai) ai.hidden = false;
    startAICamera();
  }

  // Conservado por compatibilidad pero no se usa con html5-qrcode
  async function scanCodeFromPreview(){
    try{
      const video = document.getElementById('cameraVideo');
      const guide = document.getElementById('qrGuideText');
      if(!video || !video.videoWidth){
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
      if(guide) guide.textContent = 'Procesando…';
      const form = new FormData();
      form.append('image', blob, 'frame.jpg');

      let data = null;
      try{
        const r = await fetch('http://localhost:8000/scan_code', { method:'POST', body: form });
        if(r.ok){
          data = await r.json();
        }else{
          const msg = await r.text();
          setStatus(`Error al escanear: ${msg || r.status}`);
          if(guide) guide.textContent = 'Coloca el QR o código de barras dentro del marco';
          return;
        }
      }catch(err){
        console.error(err);
        setStatus('No se pudo conectar con el servicio de códigos (http://localhost:8000)');
        if(guide) guide.textContent = 'Coloca el QR o código de barras dentro del marco';
        return;
      }

      const codes = (data && Array.isArray(data.codes)) ? data.codes : [];
      if(!codes.length){
        setStatus('No se detectaron códigos');
        if(guide) guide.textContent = 'Intenta acercarte y mantener el código plano';
        return;
      }

      // Resolver a un ID válido del catálogo y abrir detalle
      const text = String(codes[0].data || '').trim();
      if(window.ValvulasApp && typeof window.ValvulasApp.onValveSelect === 'function'){
        const resolver = typeof window.ValvulasApp.findValveId === 'function' ? window.ValvulasApp.findValveId : (x=>x);
        const id = resolver(text) || text;
        window.ValvulasApp.onValveSelect(id);
        setStatus(`Código detectado: ${text} → id: ${id}`);
        if(guide) guide.textContent = 'Código detectado';
        return;
      }

      setStatus(`Código detectado: ${text}, pero no se pudo abrir el detalle automáticamente`);
      if(guide) guide.textContent = 'Código detectado';
    }catch(err){
      console.error(err);
      setStatus('Error al procesar el escaneo');
    }
  }

  async function startAICamera(){
    try{
      if(aiStream) return;
      const video = document.getElementById('aiVideo');
      const btnStart = document.getElementById('btnAIStart');
      const btnStop = document.getElementById('btnAIStop');
      const btnCap = document.getElementById('btnAICapture');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
      aiStream = stream;
      if(video) video.srcObject = stream;
      if(btnStart) btnStart.hidden = true;
      if(btnStop) btnStop.hidden = false;
      if(btnCap) btnCap.disabled = false;
      setStatus('Cámara AI lista');
    }catch(err){
      console.error(err);
      setStatus('No fue posible acceder a la cámara (AI)');
    }
  }

  function stopAICamera(){
    try{
      const video = document.getElementById('aiVideo');
      const btnStart = document.getElementById('btnAIStart');
      const btnStop = document.getElementById('btnAIStop');
      const btnCap = document.getElementById('btnAICapture');
      if(aiStream){
        for(const t of aiStream.getTracks()) t.stop();
        aiStream = null;
      }
      if(video) video.srcObject = null;
      if(btnStart) btnStart.hidden = false;
      if(btnStop) btnStop.hidden = true;
      if(btnCap) btnCap.disabled = true;
    }catch(_){/* noop */}
  }

  async function captureAndRecognize(){
    try{
      const video = document.getElementById('aiVideo');
      const canvas = document.getElementById('aiCanvas');
      const result = document.getElementById('aiResult');
      const btnAICapture = document.getElementById('btnAICapture');
      if(!video || !canvas){ return; }
      // Pintar frame actual a canvas
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      if(result){ result.textContent = 'Procesando…'; }
      if(btnAICapture){ btnAICapture.disabled = true; }

      // Enviar a la API local
      const form = new FormData();
      form.append('image', blob, 'frame.jpg');

      let data = null;
      try{
        const r = await fetch('http://localhost:8000/recognize', { method:'POST', body: form });
        if(r.ok){
          data = await r.json();
          // Actualizar guía de AI según confianza
          updateAIGuideText(typeof data.confidence === 'number' ? data.confidence : 0);
          renderAIResult(data);
        } else if(r.status === 404){
          updateAIGuideText(0);
          renderAIResult(null);
        } else {
          const msg = await r.text();
          setStatus(`Error del servidor: ${msg || r.status}`);
        }
      }catch(netErr){
        console.error(netErr);
        setStatus('No se pudo conectar con el servicio de reconocimiento (http://localhost:8000)');
      } finally {
        if(btnAICapture){ btnAICapture.disabled = false; }
      }
    }catch(err){
      console.error(err);
      setStatus('Error al capturar o reconocer');
    }
  }

  function updateAIGuideText(conf){
    const guide = document.getElementById('aiGuideText');
    if(!guide) return;
    const c = Math.max(0, Math.min(1, Number(conf) || 0));
    if(c >= 0.6){
      guide.textContent = 'Mantén el encuadre. Calidad buena.';
    } else if(c >= 0.35){
      guide.textContent = 'Ajusta ligeramente el encuadre y enfoque.';
    } else {
      guide.textContent = 'Acércate y alinea la válvula dentro del marco.';
    }
  }

  function renderAIResult(data){
    const box = document.getElementById('aiResult');
    if(!box) return;
    box.innerHTML = '';
    if(!data){
      box.textContent = 'Sin coincidencias';
      return;
    }
    const title = document.createElement('div');
    title.className = 'badge ok';
    title.textContent = `Coincidencia: ${data.name || data.valve_id} (conf: ${Math.round((data.confidence||0)*100)}%)`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn';
    btn.textContent = 'Ver información';
    btn.addEventListener('click', () => {
      if(window.ValvulasApp && typeof window.ValvulasApp.onValveSelect === 'function'){
        window.ValvulasApp.onValveSelect(data.valve_id);
      }
    });

    box.append(title, btn);
  }

  function init(){
    const btnOpen = document.getElementById('btnAbrirCam');
    const btnClose = document.getElementById('btnCerrarCam');
    const btnTabImages = document.getElementById('btnTabImages');
    const btnTabQR = document.getElementById('btnTabQR');
    const btnTabCamera = document.getElementById('btnTabCamera');
    const btnTabAI = document.getElementById('btnTabAI');
    const btnAIStart = document.getElementById('btnAIStart');
    const btnAIStop = document.getElementById('btnAIStop');
    const btnAICapture = document.getElementById('btnAICapture');
    if(btnOpen) btnOpen.addEventListener('click', openCamera);
    if(btnClose) btnClose.addEventListener('click', closeCamera);
    if(btnTabImages) btnTabImages.addEventListener('click', showImagesTab);
    if(btnTabQR) btnTabQR.addEventListener('click', showCameraTab);
    if(btnTabCamera) btnTabCamera.addEventListener('click', showCameraTab);
    if(btnTabAI) btnTabAI.addEventListener('click', showAITab);
    if(btnAIStart) btnAIStart.addEventListener('click', startAICamera);
    if(btnAIStop) btnAIStop.addEventListener('click', stopAICamera);
    if(btnAICapture) btnAICapture.addEventListener('click', captureAndRecognize);
  }

  document.addEventListener('DOMContentLoaded', init, { once:true });

  // Expose for manual testing if needed
  window.CameraQR = { open: openCamera, close: closeCamera, isActive: () => qrActive };
  window.CameraDemo = { openCamera, closeCamera, showImagesTab, showCameraTab, showAITab, startAICamera, stopAICamera, captureAndRecognize };
})();
