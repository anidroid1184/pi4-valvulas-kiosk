(() => {
  'use strict';

  function setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = !!hidden;
  }

  function stopAllCameras() {
    try { window.CameraQR && typeof window.CameraQR.close === 'function' && window.CameraQR.close(); } catch (_) {}
    try { window.CameraDemo && typeof window.CameraDemo.stopAICamera === 'function' && window.CameraDemo.stopAICamera(); } catch (_) {}
    try { window.AITrainCam && typeof window.AITrainCam.stopAITrainCamera === 'function' && window.AITrainCam.stopAITrainCamera(); } catch (_) {}
  }

  const Router = {
    current: null,
    navigate(target) {
      this.current = target;
      // Default: hide all panels first
      setHidden('cameraPanel', true);
      setHidden('aiPanel', true);
      setHidden('aiTrainPanel', true);
      setHidden('uploadPanel', true);
      // Images visible by default except specific modes
      setHidden('imagesPanel', false);

      switch (target) {
        case 'images': {
          stopAllCameras();
          // images only, aiTrain hidden
          setHidden('aiTrainPanel', true);
          break;
        }
        case 'qr': {
          // Focus on QR: show camera panel, hide others, images optional -> hide to reduce clutter
          setHidden('imagesPanel', true);
          setHidden('cameraPanel', false);
          stopAllCameras();
          try { window.CameraQR && typeof window.CameraQR.open === 'function' && window.CameraQR.open(); } catch (_) {}
          break;
        }
        case 'ai': {
          setHidden('imagesPanel', true);
          setHidden('aiPanel', false);
          stopAllCameras();
          try { window.CameraDemo && typeof window.CameraDemo.startAICamera === 'function' && window.CameraDemo.startAICamera(); } catch (_) {}
          break;
        }
        case 'aitrain': {
          // Training wants images + aiTrain panel together
          setHidden('imagesPanel', false);
          setHidden('aiTrainPanel', false);
          // stop QR/AI, start cv2 preview
          try { window.CameraQR && typeof window.CameraQR.close === 'function' && window.CameraQR.close(); } catch (_) {}
          try { window.CameraDemo && typeof window.CameraDemo.stopAICamera === 'function' && window.CameraDemo.stopAICamera(); } catch (_) {}
          try { window.AITrainCam && typeof window.AITrainCam.startAITrainCamera === 'function' && window.AITrainCam.startAITrainCamera(); } catch (_) {}
          break;
        }
        case 'upload': {
          // Solo mostrar el panel de carga (sin grid/cards)
          setHidden('imagesPanel', true);
          setHidden('uploadPanel', false);
          stopAllCameras();
          break;
        }
        default: {
          // fallback
          stopAllCameras();
          break;
        }
      }
    }
  };

  window.Router = Router;
})();
