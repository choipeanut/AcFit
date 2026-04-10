/* global FaceMesh, Pose */

const MEDIAPIPE_CDN      = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';
const MEDIAPIPE_POSE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404';

/**
 * MediaPipe Face Mesh 초기화
 * @param {Function} onResults - 매 프레임 결과 콜백 (results) => void
 * @returns {FaceMesh}
 */
export function initFaceMesh(onResults) {
  const faceMesh = new window.FaceMesh({
    locateFile: (file) => `${MEDIAPIPE_CDN}/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,   // 귀 랜드마크 정확도 향상에 필수
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  faceMesh.onResults(onResults);

  return faceMesh;
}

/**
 * MediaPipe Pose 초기화 (목걸이 탭 선택 시 lazy 호출)
 * @param {Function} onResults - (results) => void
 * @returns {Pose}
 */
export function initPose(onResults) {
  const pose = new window.Pose({
    locateFile: (file) => `${MEDIAPIPE_POSE_CDN}/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  pose.onResults(onResults);

  return pose;
}
