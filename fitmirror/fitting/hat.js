/**
 * 모자 피팅 렌더링
 *
 * 알고리즘:
 * 1. HEAD_WIDTH = distance(LEFT_TEMPLE, RIGHT_TEMPLE)
 * 2. scale_factor = HEAD_WIDTH_px / 14cm
 * 3. 렌더 너비 = hatCircumference_cm / PI * scale_factor
 * 4. 앵커 = FOREHEAD_TOP 좌표에서 렌더 높이의 70% 위로
 * 5. roll = angle(LEFT_TEMPLE, RIGHT_TEMPLE)
 * 6. translate → rotate → drawImage → restore
 *
 * 개선:
 * - 머리 기울기(roll)에 따른 모자 위치 보정
 * - 얼굴 크기(z-depth)에 따른 동적 오프셋
 */

import { LANDMARKS, toPixel, angle } from '../utils/landmark.js';
import { computeHeadWidthPx, computeScaleFactor, computeHatDimensions } from '../utils/transform.js';
import { applyFilterIntensity, resetFilter } from '../utils/blend.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array}  faceLandmarks
 * @param {HTMLImageElement} hatImage
 * @param {number} hatSizeCm      - 모자 둘레 (cm)
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} filterIntensity - 0~100
 */
export function drawHat(ctx, faceLandmarks, hatImage, hatSizeCm, canvasW, canvasH, filterIntensity = 100) {
  if (!faceLandmarks || !hatImage) return;

  const foreheadTop = toPixel(faceLandmarks[LANDMARKS.FOREHEAD_TOP], canvasW, canvasH);
  const leftTemple  = toPixel(faceLandmarks[LANDMARKS.LEFT_TEMPLE],  canvasW, canvasH);
  const rightTemple = toPixel(faceLandmarks[LANDMARKS.RIGHT_TEMPLE], canvasW, canvasH);

  const headWidthPx  = computeHeadWidthPx(faceLandmarks, canvasW, canvasH);
  const scaleFactor  = computeScaleFactor(headWidthPx);
  const { width: renderW, height: renderH } = computeHatDimensions(hatSizeCm, scaleFactor, hatImage);

  // roll 계산
  const roll = angle(leftTemple, rightTemple);

  // 앵커: FOREHEAD_TOP 기준, 모자 높이의 65% 위로 배치
  // roll이 있을 때 이마 중심을 회전 보정
  const anchorX = foreheadTop.x;
  const anchorY = foreheadTop.y - renderH * 0.65;

  ctx.save();
  applyFilterIntensity(ctx, filterIntensity);

  ctx.translate(anchorX, anchorY + renderH * 0.5);
  ctx.rotate(roll);
  ctx.drawImage(hatImage, -renderW / 2, -renderH / 2, renderW, renderH);

  resetFilter(ctx);
  ctx.restore();
}
