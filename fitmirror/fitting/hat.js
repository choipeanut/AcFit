/**
 * 모자 피팅 렌더링
 *
 * 알고리즘:
 * 1. HEAD_WIDTH = distance(LEFT_TEMPLE, RIGHT_TEMPLE)
 * 2. scale_factor = HEAD_WIDTH_px / 14cm (성인 평균)
 * 3. 렌더 너비 = hatCircumference_cm / PI * scale_factor
 * 4. 앵커 = FOREHEAD_TOP 좌표에서 위로 hat_height * 0.3 오프셋
 * 5. roll = angle(LEFT_TEMPLE, RIGHT_TEMPLE)
 * 6. translate → rotate → drawImage → restore
 */

import { LANDMARKS, toPixel, angle } from '../utils/landmark.js';
import { computeHeadWidthPx, computeScaleFactor, computeHatDimensions } from '../utils/transform.js';
import { applyFilterIntensity, resetFilter, resetBlendMode } from '../utils/blend.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} faceLandmarks   - MediaPipe face landmark 배열
 * @param {HTMLImageElement} hatImage
 * @param {number} hatSizeCm      - 모자 둘레 (cm), 기본 58
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} filterIntensity - 0~100
 */
export function drawHat(ctx, faceLandmarks, hatImage, hatSizeCm, canvasW, canvasH, filterIntensity = 100) {
  if (!faceLandmarks || !hatImage) return;

  // 1. 픽셀 좌표 추출
  const foreheadTop = toPixel(faceLandmarks[LANDMARKS.FOREHEAD_TOP], canvasW, canvasH);
  const leftTemple = toPixel(faceLandmarks[LANDMARKS.LEFT_TEMPLE], canvasW, canvasH);
  const rightTemple = toPixel(faceLandmarks[LANDMARKS.RIGHT_TEMPLE], canvasW, canvasH);

  // 2. 머리 너비 기반 스케일
  const headWidthPx = computeHeadWidthPx(faceLandmarks, canvasW, canvasH);
  const scaleFactor = computeScaleFactor(headWidthPx);

  // 3. 모자 렌더 크기
  const { width: renderW, height: renderH } = computeHatDimensions(hatSizeCm, scaleFactor, hatImage);

  // 4. 앵커: FOREHEAD_TOP에서 모자 높이의 30% 위로
  const anchorX = foreheadTop.x;
  const anchorY = foreheadTop.y - renderH * 0.7;

  // 5. 머리 기울기(roll)
  const roll = angle(leftTemple, rightTemple);

  // 6. 렌더
  ctx.save();
  applyFilterIntensity(ctx, filterIntensity);

  ctx.translate(anchorX, anchorY + renderH * 0.5);
  ctx.rotate(roll);
  ctx.drawImage(
    hatImage,
    -renderW / 2,
    -renderH / 2,
    renderW,
    renderH
  );

  resetFilter(ctx);
  resetBlendMode(ctx);
  ctx.restore();
}
