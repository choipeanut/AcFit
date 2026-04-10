import { LANDMARKS, distance, angle } from './landmark.js';

// 성인 평균 관자놀이 간 너비 (cm) — 픽셀↔cm 스케일 추정 기준값
const HEAD_WIDTH_CM = 14;

/**
 * 머리 기울기(roll) 각도 반환 (라디안)
 * 원본 좌표계 기준이므로 미러 캔버스에서도 동일하게 사용
 */
export function getHeadRoll(faceLandmarks, w, h) {
  return angle(
    faceLandmarks[LANDMARKS.LEFT_TEMPLE],
    faceLandmarks[LANDMARKS.RIGHT_TEMPLE],
    w, h,
  );
}

/**
 * 관자놀이 간 픽셀 너비
 */
export function getHeadWidth(faceLandmarks, w, h) {
  return distance(
    faceLandmarks[LANDMARKS.LEFT_TEMPLE],
    faceLandmarks[LANDMARKS.RIGHT_TEMPLE],
    w, h,
  );
}

/**
 * 픽셀/cm 스케일 팩터
 * HEAD_WIDTH_CM(14cm)이 현재 머리 픽셀 너비에 해당한다고 가정
 */
export function getScaleFactor(faceLandmarks, w, h) {
  return getHeadWidth(faceLandmarks, w, h) / HEAD_WIDTH_CM;
}

/**
 * 얼굴 좌우 회전(yaw) 추정
 * @returns {number} 양수 = 오른쪽으로 돌아감, 음수 = 왼쪽
 */
export function getFaceYaw(faceLandmarks) {
  const lz = faceLandmarks[LANDMARKS.LEFT_TEMPLE].z;
  const rz = faceLandmarks[LANDMARKS.RIGHT_TEMPLE].z;
  return lz - rz;
}
