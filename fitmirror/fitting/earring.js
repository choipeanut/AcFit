/**
 * 귀걸이 피팅 렌더링
 *
 * 알고리즘:
 * 1. 앵커 = LEFT_EARLOBE / RIGHT_EARLOBE 픽셀 좌표
 * 2. 귀걸이 이미지 상단 중앙을 앵커에 맞춤
 * 3. 크기: 귀 높이(EAR_TOP ~ EARLOBE) 기준 비례 스케일
 * 4. yaw 추정으로 가려진 귀의 귀걸이 opacity 처리
 * 5. roll에 따라 동일하게 rotate 적용
 */

import { LANDMARKS, toPixel, angle, estimateYaw } from '../utils/landmark.js';
import { computeEarHeightPx } from '../utils/transform.js';
import { applyFilterIntensity, resetFilter } from '../utils/blend.js';

const EAR_HEIGHT_SCALE = 1.8; // 귀 높이 대비 귀걸이 렌더 높이 배율
const YAW_FADE_THRESHOLD = 0.4; // 이 이상이면 한쪽 귀걸이 fade 시작

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} faceLandmarks
 * @param {HTMLImageElement} earringImage
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} filterIntensity - 0~100
 */
export function drawEarrings(ctx, faceLandmarks, earringImage, canvasW, canvasH, filterIntensity = 100) {
  if (!faceLandmarks || !earringImage) return;

  const yaw = estimateYaw(faceLandmarks);
  const roll = angle(
    toPixel(faceLandmarks[LANDMARKS.LEFT_TEMPLE], canvasW, canvasH),
    toPixel(faceLandmarks[LANDMARKS.RIGHT_TEMPLE], canvasW, canvasH)
  );

  // 왼쪽 귀걸이
  const leftOpacity = computeEarOpacity(yaw, 'left');
  if (leftOpacity > 0) {
    drawSingleEarring(ctx, faceLandmarks, earringImage, 'left', canvasW, canvasH, roll, filterIntensity * leftOpacity);
  }

  // 오른쪽 귀걸이
  const rightOpacity = computeEarOpacity(yaw, 'right');
  if (rightOpacity > 0) {
    drawSingleEarring(ctx, faceLandmarks, earringImage, 'right', canvasW, canvasH, roll, filterIntensity * rightOpacity);
  }
}

/**
 * 단일 귀걸이 렌더
 */
function drawSingleEarring(ctx, faceLandmarks, earringImage, side, canvasW, canvasH, roll, effectiveIntensity) {
  const lobeKey = side === 'left' ? LANDMARKS.LEFT_EARLOBE : LANDMARKS.RIGHT_EARLOBE;
  const lobe = toPixel(faceLandmarks[lobeKey], canvasW, canvasH);

  // 귀 높이 기반 렌더 크기
  const earHeightPx = computeEarHeightPx(faceLandmarks, side, canvasW, canvasH);
  const renderH = earHeightPx * EAR_HEIGHT_SCALE;
  const aspectRatio = earringImage.naturalWidth / earringImage.naturalHeight || 0.5;
  const renderW = renderH * aspectRatio;

  ctx.save();
  applyFilterIntensity(ctx, effectiveIntensity);

  // 앵커: 귓불 위치에 귀걸이 상단 중앙을 맞춤
  ctx.translate(lobe.x, lobe.y);
  ctx.rotate(roll);
  ctx.drawImage(
    earringImage,
    -renderW / 2,  // 수평 중앙 정렬
    0,             // 상단이 귓불에 위치
    renderW,
    renderH
  );

  resetFilter(ctx);
  ctx.restore();
}

/**
 * yaw 기반 귀걸이 opacity 계산
 * yaw > 0 → 오른쪽으로 회전 (왼쪽 귀 가림)
 * yaw < 0 → 왼쪽으로 회전 (오른쪽 귀 가림)
 */
function computeEarOpacity(yaw, side) {
  const absYaw = Math.abs(yaw);
  if (absYaw < YAW_FADE_THRESHOLD) return 1;

  const fadeProgress = Math.min(1, (absYaw - YAW_FADE_THRESHOLD) / (1 - YAW_FADE_THRESHOLD));

  if (side === 'left' && yaw > 0) {
    // 오른쪽으로 돌았을 때 왼쪽 귀 가려짐
    return Math.max(0, 1 - fadeProgress);
  }
  if (side === 'right' && yaw < 0) {
    // 왼쪽으로 돌았을 때 오른쪽 귀 가려짐
    return Math.max(0, 1 - fadeProgress);
  }

  return 1;
}
