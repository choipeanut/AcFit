import { POSE_LANDMARKS, toPixelMirrored } from '../utils/landmark.js';
import { drawWithAlpha } from '../utils/blend.js';

// 목걸이 이미지에서 체인 라인이 위치한 Y 비율 (이미지 상단 기준)
// 에셋이 이 비율로 설계됨 — 이 지점이 베지어 곡선과 정렬됨
const CHAIN_Y_FRAC = 0.08;

/**
 * 2차 베지어 곡선 위의 점 계산
 * P0 → CP(제어점) → P2
 */
function qBezier(p0, cp, p2, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p2.y,
  };
}

/**
 * 목걸이 렌더링 — 슬라이스 기반 베지어 커브 워프
 *
 * 알고리즘:
 * 1. Pose LEFT_SHOULDER / RIGHT_SHOULDER 로 어깨 픽셀 좌표 취득 (미러 반전)
 * 2. 목 위치로 상향 오프셋 적용
 * 3. 2차 베지어 제어점 = 어깨 중점 위 (위로 볼록 곡선)
 * 4. 곡선을 SLICES 등분 → 각 구간에 목걸이 이미지 수직 슬라이스 매핑
 * 5. 체인 Y 비율로 이미지를 수직 정렬 (체인 라인 ↔ 베지어 곡선 일치)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} poseLandmarks - MediaPipe Pose 랜드마크 배열
 * @param {HTMLImageElement} necklaceImage
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawNecklace(ctx, poseLandmarks, necklaceImage, canvasW, canvasH) {
  if (!poseLandmarks) return;

  // 어깨 좌표 (미러 반전 적용)
  let ptA = toPixelMirrored(poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER],  canvasW, canvasH);
  let ptB = toPixelMirrored(poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER], canvasW, canvasH);

  // 화면 기준 좌→우 정렬 (미러 때문에 LEFT가 스크린 오른쪽에 올 수 있음)
  if (ptA.x > ptB.x) [ptA, ptB] = [ptB, ptA];

  const shoulderWidth = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);

  // 목 위치로 상향 이동 (어깨 → 쇄골/목 기준)
  const upShift = shoulderWidth * 0.22;
  const inShift = shoulderWidth * 0.08; // 어깨 끝에서 안쪽으로
  ptA = { x: ptA.x + inShift, y: ptA.y - upShift };
  ptB = { x: ptB.x - inShift, y: ptB.y - upShift };

  const midX = (ptA.x + ptB.x) / 2;
  const midY = (ptA.y + ptB.y) / 2;

  // 제어점: 중점 위 (위로 볼록 — 목걸이가 목 주위에 걸린 자연스러운 형태)
  const cp = {
    x: midX,
    y: midY - shoulderWidth * 0.12,
  };

  const imgW = necklaceImage.naturalWidth  || 300;
  const imgH = necklaceImage.naturalHeight || 55;

  // 렌더 높이 = 어깨 너비의 35% (체인 + 펜던트 공간 확보)
  const renderH = shoulderWidth * 0.35;

  const SLICES = 60;

  drawWithAlpha(ctx, 0.92, () => {
    for (let i = 0; i < SLICES; i++) {
      const t0 = i       / SLICES;
      const t1 = (i + 1) / SLICES;

      const p0 = qBezier(ptA, cp, ptB, t0);
      const p1 = qBezier(ptA, cp, ptB, t1);

      // 이 구간의 각도와 픽셀 길이
      const segAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const segLen   = Math.hypot(p1.x - p0.x, p1.y - p0.y) + 0.5; // 슬라이스 간 틈 방지

      // 소스 이미지에서 해당 슬라이스 위치
      const srcX = (imgW / SLICES) * i;
      const srcW = imgW / SLICES + 1;

      // 체인 라인이 곡선 위에 정확히 오도록 수직 오프셋 적용
      const chainOffset = CHAIN_Y_FRAC * renderH;

      ctx.save();
      ctx.translate(p0.x, p0.y);
      ctx.rotate(segAngle);
      ctx.drawImage(
        necklaceImage,
        srcX, 0,        srcW, imgH,          // 소스 슬라이스
        0, -chainOffset, segLen, renderH,     // 목적지 (체인 Y → 곡선 정렬)
      );
      ctx.restore();
    }
  });
}
