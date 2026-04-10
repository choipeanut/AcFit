/* global FaceMesh */

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';

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
