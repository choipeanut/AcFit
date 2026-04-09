/**
 * 좌표 변환 및 스케일 계산 유틸
 */
import { LANDMARKS, POSE_LANDMARKS, toPixel, distance } from './landmark.js';

// 성인 평균 관자놀이 간 너비 (cm)
const ADULT_HEAD_WIDTH_CM = 14;

/**
 * 관자놀이 간 픽셀 거리를 반환 (머리 너비 기준)
 */
export function computeHeadWidthPx(faceLandmarks, canvasW, canvasH) {
  const left = toPixel(faceLandmarks[LANDMARKS.LEFT_TEMPLE], canvasW, canvasH);
  const right = toPixel(faceLandmarks[LANDMARKS.RIGHT_TEMPLE], canvasW, canvasH);
  return distance(left, right);
}

/**
 * px/cm 스케일 팩터 계산
 * headWidthPx / ADULT_HEAD_WIDTH_CM
 */
export function computeScaleFactor(headWidthPx) {
  return headWidthPx / ADULT_HEAD_WIDTH_CM;
}

/**
 * 모자 렌더 크기 계산
 * @param {number} hatCircumferenceCm - 모자 둘레 (cm)
 * @param {number} scaleFactor        - px/cm 스케일 팩터
 * @param {HTMLImageElement} hatImage - 모자 이미지 (비율 유지)
 * @returns {{ width, height }}
 */
export function computeHatDimensions(hatCircumferenceCm, scaleFactor, hatImage) {
  // 둘레 → 지름 → 픽셀 너비
  const hatDiameterCm = hatCircumferenceCm / Math.PI;
  const renderWidth = hatDiameterCm * scaleFactor;

  // 이미지 종횡비 유지
  const aspectRatio = hatImage.naturalHeight / hatImage.naturalWidth || 1;
  const renderHeight = renderWidth * aspectRatio;

  return { width: renderWidth, height: renderHeight };
}

/**
 * 귀 높이 기반 귀걸이 렌더 스케일 계산
 * EAR_TOP ~ EARLOBE 픽셀 거리
 */
export function computeEarHeightPx(faceLandmarks, side, canvasW, canvasH) {
  const topKey = side === 'left' ? LANDMARKS.LEFT_EAR_TOP : LANDMARKS.RIGHT_EAR_TOP;
  const lobeKey = side === 'left' ? LANDMARKS.LEFT_EARLOBE : LANDMARKS.RIGHT_EARLOBE;

  const top = toPixel(faceLandmarks[topKey], canvasW, canvasH);
  const lobe = toPixel(faceLandmarks[lobeKey], canvasW, canvasH);
  return distance(top, lobe);
}

/**
 * Pose 어깨 중심점 (목걸이 앵커) 계산
 */
export function computeNeckAnchor(poseLandmarks, canvasW, canvasH, offsetRatio = 0.35) {
  const left = toPixel(poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER], canvasW, canvasH);
  const right = toPixel(poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER], canvasW, canvasH);

  const midX = (left.x + right.x) / 2;
  const midY = (left.y + right.y) / 2;

  const shoulderWidth = distance(left, right);
  // 어깨 중심에서 위로 오프셋 (어깨 너비의 offsetRatio만큼)
  const neckY = midY - shoulderWidth * offsetRatio;

  return { x: midX, y: neckY, shoulderWidth };
}
