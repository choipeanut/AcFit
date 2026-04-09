/**
 * 목걸이 피팅 렌더링
 *
 * Phase 1: 단순 이미지 오버레이 (목 중심 앵커)
 * Phase 2: 베지어 커브 워프 추가 예정
 *
 * 알고리즘:
 * 1. Pose: LEFT_SHOULDER, RIGHT_SHOULDER 좌표 취득
 * 2. 목 중심 = 어깨 중점에서 위로 오프셋
 * 3. 어깨 너비 기준 목걸이 스케일 자동 조정
 * 4. globalCompositeOperation = 'source-over' + filterIntensity
 */

import { POSE_LANDMARKS, toPixel } from '../utils/landmark.js';
import { computeNeckAnchor } from '../utils/transform.js';
import { applyFilterIntensity, resetFilter } from '../utils/blend.js';

const NECKLACE_WIDTH_RATIO = 0.9; // 어깨 너비 대비 목걸이 렌더 너비

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} poseLandmarks   - MediaPipe pose landmark 배열
 * @param {HTMLImageElement} necklaceImage
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} filterIntensity - 0~100
 */
export function drawNecklace(ctx, poseLandmarks, necklaceImage, canvasW, canvasH, filterIntensity = 100) {
  if (!poseLandmarks || !necklaceImage) return;

  const left = toPixel(poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER], canvasW, canvasH);
  const right = toPixel(poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER], canvasW, canvasH);

  if (!left || !right) return;

  const { x: anchorX, y: anchorY, shoulderWidth } = computeNeckAnchor(poseLandmarks, canvasW, canvasH);

  // 렌더 크기
  const renderW = shoulderWidth * NECKLACE_WIDTH_RATIO;
  const aspectRatio = necklaceImage.naturalHeight / necklaceImage.naturalWidth || 0.4;
  const renderH = renderW * aspectRatio;

  ctx.save();
  applyFilterIntensity(ctx, filterIntensity);

  // 목 중심에 수평 중앙 정렬로 배치
  ctx.drawImage(
    necklaceImage,
    anchorX - renderW / 2,
    anchorY - renderH / 2,
    renderW,
    renderH
  );

  resetFilter(ctx);
  ctx.restore();
}
