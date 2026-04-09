/**
 * MediaPipe Face Mesh + Pose 초기화
 * Face Mesh는 항상 활성, Pose는 목걸이 탭 선택 시에만 lazy 활성화
 */

// 전역 랜드마크 저장소
window.currentLandmarks = { face: null, pose: null };

let faceMesh = null;
let pose = null;
let mpCamera = null;
let poseEnabled = false;

const CDN_FALLBACK = {
  faceMesh: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
  pose: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
};

/**
 * Face Mesh 초기화
 */
async function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) => `${CDN_FALLBACK.faceMesh}/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  faceMesh.onResults((results) => {
    window.currentLandmarks.face =
      results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0
        ? results.multiFaceLandmarks[0]
        : null;
  });

  await faceMesh.initialize();
}

/**
 * Pose 초기화 (lazy — 목걸이 탭 선택 시 호출)
 */
export async function enablePose() {
  if (poseEnabled) return;
  poseEnabled = true;

  pose = new Pose({
    locateFile: (file) => `${CDN_FALLBACK.pose}/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  pose.onResults((results) => {
    window.currentLandmarks.pose =
      results.poseLandmarks ?? null;
  });

  await pose.initialize();
}

/**
 * Pose 비활성화 (목걸이 탭 해제 시 성능 절약)
 */
export function disablePose() {
  poseEnabled = false;
  window.currentLandmarks.pose = null;
}

/**
 * MediaPipe Camera 루프 시작
 * @param {HTMLVideoElement} videoEl
 * @param {function} onFrameProcessed - 매 프레임 처리 후 콜백
 */
export async function startMediaPipeLoop(videoEl, onFrameProcessed) {
  await initFaceMesh();

  mpCamera = new Camera(videoEl, {
    onFrame: async () => {
      await faceMesh.send({ image: videoEl });

      if (poseEnabled && pose) {
        await pose.send({ image: videoEl });
      }

      onFrameProcessed();
    },
    width: 1280,
    height: 720,
  });

  await mpCamera.start();
}

/**
 * MediaPipe 루프 중지
 */
export function stopMediaPipeLoop() {
  if (mpCamera) {
    mpCamera.stop();
    mpCamera = null;
  }
}
