/**
 * Face Mesh 랜드마크 인덱스 및 유틸리티 함수
 *
 * 좌표계 주의:
 *   MediaPipe 랜드마크는 원본(비미러) 영상 기준 정규화 값 [0~1]
 *   toPixelMirrored()를 사용해야 미러 캔버스 렌더링과 좌표가 일치함
 */

export const LANDMARKS = {
  // 모자
  FOREHEAD_TOP: 10,
  LEFT_TEMPLE: 127,   // 관자놀이 (왼쪽)
  RIGHT_TEMPLE: 356,  // 관자놀이 (오른쪽)

  // 귀걸이
  LEFT_EARLOBE: 234,   // 귓불 (왼쪽)
  RIGHT_EARLOBE: 454,  // 귓불 (오른쪽)
  LEFT_EAR_TOP: 127,   // 귀 상단 (관자놀이와 동일 인덱스 — 귀 높이 추정용)
  RIGHT_EAR_TOP: 356,

  // 목걸이 기준
  CHIN: 152,
  // 목 중심은 Face Mesh로 직접 추정 불가 → POSE_LANDMARKS의 어깨 중점으로 계산
};

export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  NOSE: 0,
};

/**
 * 정규화 좌표 → 원본 픽셀 좌표 (미러 없음)
 */
export function toPixel(lm, w, h) {
  return { x: lm.x * w, y: lm.y * h, z: lm.z };
}

/**
 * 정규화 좌표 → 미러 캔버스 픽셀 좌표 (x축 반전)
 */
export function toPixelMirrored(lm, w, h) {
  return { x: (1 - lm.x) * w, y: lm.y * h, z: lm.z };
}

/**
 * 두 랜드마크 사이 픽셀 거리
 */
export function distance(lm1, lm2, w, h) {
  const dx = (lm1.x - lm2.x) * w;
  const dy = (lm1.y - lm2.y) * h;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 두 랜드마크 사이 각도 (라디안)
 * 원본 좌표계 기준 — 미러 렌더링에서도 같은 roll 값 사용 가능
 */
export function angle(lm1, lm2, w, h) {
  const p1 = toPixel(lm1, w, h);
  const p2 = toPixel(lm2, w, h);
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}
