/**
 * MediaPipe 랜드마크 인덱스 상수 및 유틸 함수
 */

// Face Mesh 주요 랜드마크 인덱스
export const LANDMARKS = {
  // 모자
  FOREHEAD_TOP: 10,       // 이마 최상단
  LEFT_TEMPLE: 234,       // 왼쪽 관자놀이
  RIGHT_TEMPLE: 454,      // 오른쪽 관자놀이

  // 귀걸이
  LEFT_EARLOBE: 234,      // 왼쪽 귓불 (관자놀이 인접)
  RIGHT_EARLOBE: 454,     // 오른쪽 귓불
  LEFT_EAR_TOP: 127,      // 왼쪽 귀 상단
  RIGHT_EAR_TOP: 356,     // 오른쪽 귀 상단

  // 목걸이 기준
  CHIN: 152,              // 턱 끝
  NECK_CENTER: 0,         // 코 아래 (Pose와 함께 사용)

  // 추가 기준점
  NOSE_TIP: 4,            // 코끝
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
};

// Pose 랜드마크 인덱스
export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

/**
 * MediaPipe 정규화 좌표(0~1)를 캔버스 픽셀 좌표로 변환
 */
export function toPixel(landmark, canvasWidth, canvasHeight) {
  return {
    x: landmark.x * canvasWidth,
    y: landmark.y * canvasHeight,
    z: landmark.z ?? 0,
  };
}

/**
 * 두 픽셀 좌표 간 유클리드 거리
 */
export function distance(lm1, lm2) {
  const dx = lm1.x - lm2.x;
  const dy = lm1.y - lm2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 두 점 사이 각도 (라디안) - roll 계산에 사용
 * lm1 → lm2 방향의 atan2
 */
export function angle(lm1, lm2) {
  return Math.atan2(lm2.y - lm1.y, lm2.x - lm1.x);
}

/**
 * 얼굴 좌우 회전(yaw) 추정
 * 왼쪽/오른쪽 관자놀이의 z 차이로 판단
 * 반환: -1(왼쪽 방향) ~ 0(정면) ~ 1(오른쪽 방향)
 */
export function estimateYaw(faceLandmarks) {
  const leftTemple = faceLandmarks[LANDMARKS.LEFT_TEMPLE];
  const rightTemple = faceLandmarks[LANDMARKS.RIGHT_TEMPLE];
  if (!leftTemple || !rightTemple) return 0;

  // z 값이 클수록 카메라에서 멀리 있음 (MediaPipe 기준)
  const zDiff = leftTemple.z - rightTemple.z;
  // 정규화 (대략 -0.1 ~ 0.1 범위를 -1 ~ 1로)
  return Math.max(-1, Math.min(1, zDiff * 10));
}

/**
 * 평균 픽셀 밝기 계산 (어두운 환경 감지용)
 * ImageData를 받아 0~255 범위 평균값 반환
 */
export function computeAverageBrightness(imageData) {
  const data = imageData.data;
  let sum = 0;
  const step = 4 * 10; // 매 10픽셀마다 샘플링
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    // luminance = 0.299R + 0.587G + 0.114B
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count++;
  }
  return count > 0 ? sum / count : 0;
}
