let _stream = null;
let _facingMode = 'user';

/**
 * 웹캠 스트림을 초기화하고 videoEl에 연결
 * @param {HTMLVideoElement} videoEl
 * @param {string} facingMode - 'user' | 'environment'
 * @returns {Promise<MediaStream>}
 */
export async function initCamera(videoEl, facingMode = 'user') {
  _facingMode = facingMode;

  const constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode,
    },
    audio: false,
  };

  _stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = _stream;

  await new Promise((resolve, reject) => {
    videoEl.onloadedmetadata = resolve;
    videoEl.onerror = reject;
  });

  await videoEl.play();
  return _stream;
}

/**
 * 전/후면 카메라 전환
 * @param {HTMLVideoElement} videoEl
 */
export async function switchCamera(videoEl) {
  if (_stream) {
    _stream.getTracks().forEach((t) => t.stop());
  }
  _facingMode = _facingMode === 'user' ? 'environment' : 'user';
  return initCamera(videoEl, _facingMode);
}

export function getCurrentFacingMode() {
  return _facingMode;
}
