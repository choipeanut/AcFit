/**
 * 목걸이 피팅 렌더링 (Phase 2: 베지어 커브 워프)
 *
 * 알고리즘:
 * 1. Pose: LEFT_SHOULDER, RIGHT_SHOULDER 좌표 취득
 * 2. 목 중심 = 어깨 중점에서 위로 오프셋
 * 3. 베지어 커브로 목걸이 이미지를 곡선에 맞게 분할 렌더
 *    - 제어점: 왼쪽 끝 → 목 중심(위로 볼록) → 오른쪽 끝
 *    - 이미지를 N개 슬라이스로 분할 후 각 위치에 회전 적용
 * 4. 어깨 너비 기준 목걸이 스케일 자동 조정
 * 5. 펜던트 위치 = 커브 중앙 (t=0.5)
 */

import { POSE_LANDMARKS, toPixel } from '../utils/landmark.js';
import { computeNeckAnchor } from '../utils/transform.js';
import { applyFilterIntensity, resetFilter } from '../utils/blend.js';

const NECKLACE_WIDTH_RATIO = 0.85;  // 어깨 너비 대비 목걸이 렌더 너비
const CURVE_SLICES = 32;            // 커브를 몇 개 슬라이스로 분할할지

/**
 * 큐베지어 커브 위의 점 계산 (이차 베지어)
 * t: 0~1
 */
function quadBezier(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/**
 * 베지어 커브의 접선 벡터 (회전 계산용)
 */
function quadBezierTangent(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

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

  const left  = toPixel(poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER],  canvasW, canvasH);
  const right = toPixel(poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER], canvasW, canvasH);
  if (!left || !right) return;

  const { x: neckX, y: neckY, shoulderWidth } = computeNeckAnchor(poseLandmarks, canvasW, canvasH, 0.3);

  const renderW = shoulderWidth * NECKLACE_WIDTH_RATIO;
  const imgW = necklaceImage.naturalWidth  || 300;
  const imgH = necklaceImage.naturalHeight || 80;

  // 베지어 제어점:
  //   P0 = 왼쪽 어깨 쪽 끝
  //   P1 = 목 중심 (살짝 위, 곡선 볼록점)
  //   P2 = 오른쪽 어깨 쪽 끝
  const p0 = { x: neckX - renderW / 2, y: left.y  * 0.5 + neckY * 0.5 };
  const p2 = { x: neckX + renderW / 2, y: right.y * 0.5 + neckY * 0.5 };
  const p1 = { x: neckX, y: neckY - shoulderWidth * 0.05 }; // 살짝 위로 볼록

  // 슬라이스 너비 (이미지 분할)
  const sliceW = imgW / CURVE_SLICES;
  // 렌더 슬라이스 높이 (이미지 비율 유지)
  const renderSliceW = renderW / CURVE_SLICES;
  const renderH = renderSliceW * (imgH / sliceW);

  ctx.save();
  applyFilterIntensity(ctx, filterIntensity);

  for (let i = 0; i < CURVE_SLICES; i++) {
    const t0 = i / CURVE_SLICES;
    const t1 = (i + 1) / CURVE_SLICES;
    const tMid = (t0 + t1) / 2;

    const pos = quadBezier(p0, p1, p2, tMid);
    const tan = quadBezierTangent(p0, p1, p2, tMid);
    const angle = Math.atan2(tan.y, tan.x);

    // 이미지 소스 슬라이스
    const sx = Math.floor(i * sliceW);
    const sw = Math.ceil(sliceW) + 1; // 1px 여유

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.drawImage(
      necklaceImage,
      sx, 0, sw, imgH,               // 소스: 이미지 슬라이스
      -renderSliceW / 2,              // 목적지: 중앙 정렬
      -renderH / 2,
      renderSliceW + 0.5,             // 0.5px 오버랩으로 이음새 제거
      renderH
    );
    ctx.restore();
  }

  resetFilter(ctx);
  ctx.restore();
}
