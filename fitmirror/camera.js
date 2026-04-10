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

  // 먼저 ideal 제약으로 시도, 실패 시 최소 제약으로 폴백
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode,
      },
      audio: false,
    });
  } catch {
    // facingMode 제약이 실패하면 기본 video:true로 재시도
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }

  _stream = stream;
  videoEl.srcObject = stream;

  // loadedmetadata가 이미 발생했으면 대기 없이 통과
  if (!videoEl.videoWidth) {
    await new Promise((resolve) => {
      videoEl.addEventListener('loadedmetadata', resolve, { once: true });
    });
  }

  // autoplay 속성으로 이미 재생 중일 수 있으므로 AbortError 무시
  try { await videoEl.play(); } catch { /* autoplay already running or interrupted — OK */ }

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
