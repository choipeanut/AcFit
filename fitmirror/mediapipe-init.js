/**
 * MediaPipe Face Mesh + Pose 초기화
 * - Face Mesh: 항상 활성
 * - Pose: 목걸이 탭 선택 시 lazy 활성화
 * - CDN 로딩 실패 시 fallback URL 재시도
 */

window.currentLandmarks = { face: null, pose: null };

let faceMesh = null;
let pose = null;
let mpCamera = null;
let poseEnabled = false;

// CDN 우선순위 목록
const CDN_URLS = {
  faceMesh: [
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
    'https://unpkg.com/@mediapipe/face_mesh',
  ],
  pose: [
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
    'https://unpkg.com/@mediapipe/pose',
  ],
};

function makeLocator(urls) {
  let idx = 0;
  return (file) => `${urls[idx]}/${file}`;
}

async function tryInit(Constructor, options, onResults, cdnUrls) {
  for (let i = 0; i < cdnUrls.length; i++) {
    try {
      const inst = new Constructor({ locateFile: (f) => `${cdnUrls[i]}/${f}` });
      inst.setOptions(options);
      inst.onResults(onResults);
      await inst.initialize();
      return inst;
    } catch (err) {
      console.warn(`CDN 실패 (${cdnUrls[i]}):`, err);
      if (i === cdnUrls.length - 1) throw err;
    }
  }
}

async function initFaceMesh() {
  faceMesh = await tryInit(
    FaceMesh,
    {
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    },
    (results) => {
      window.currentLandmarks.face =
        results.multiFaceLandmarks?.length > 0
          ? results.multiFaceLandmarks[0]
          : null;
    },
    CDN_URLS.faceMesh
  );
}

export async function enablePose() {
  if (poseEnabled) return;
  poseEnabled = true;
  pose = await tryInit(
    Pose,
    {
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    },
    (results) => {
      window.currentLandmarks.pose = results.poseLandmarks ?? null;
    },
    CDN_URLS.pose
  );
}

export function disablePose() {
  poseEnabled = false;
  window.currentLandmarks.pose = null;
}

export async function startMediaPipeLoop(videoEl, onFrameProcessed) {
  await initFaceMesh();

  mpCamera = new Camera(videoEl, {
    onFrame: async () => {
      try {
        await faceMesh.send({ image: videoEl });
        if (poseEnabled && pose) await pose.send({ image: videoEl });
      } catch { /* 프레임 처리 오류 무시 */ }
      onFrameProcessed();
    },
    width: 1280,
    height: 720,
  });

  await mpCamera.start();
}

export function stopMediaPipeLoop() {
  mpCamera?.stop();
  mpCamera = null;
}
