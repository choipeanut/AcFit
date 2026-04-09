/**
 * 웹캠 스트림 초기화 및 카메라 전환
 */

let currentStream = null;
let currentFacingMode = 'user'; // 'user' = 전면, 'environment' = 후면

/**
 * 웹캠 초기화
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<MediaStream>}
 */
export async function initCamera(videoEl) {
  // 기존 스트림 정리
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
    },
    audio: false,
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      // fallback: 해상도 제약 해제
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: false,
      });
    } else {
      throw err;
    }
  }

  videoEl.srcObject = currentStream;
  await new Promise(resolve => {
    videoEl.onloadedmetadata = () => resolve();
  });

  return currentStream;
}

/**
 * 전/후면 카메라 전환
 * @param {HTMLVideoElement} videoEl
 */
export async function switchCamera(videoEl) {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  return initCamera(videoEl);
}

/**
 * 카메라 권한 상태 확인
 * @returns {Promise<'granted'|'denied'|'prompt'>}
 */
export async function checkCameraPermission() {
  try {
    const result = await navigator.permissions.query({ name: 'camera' });
    return result.state;
  } catch {
    return 'prompt';
  }
}

/**
 * 현재 facingMode 반환
 */
export function getCurrentFacingMode() {
  return currentFacingMode;
}
