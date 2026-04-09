/**
 * 귀걸이 피팅 렌더링
 *
 * 알고리즘:
 * 1. 앵커 = LEFT_EARLOBE / RIGHT_EARLOBE 픽셀 좌표
 * 2. 귀걸이 이미지 상단 중앙을 앵커에 맞춤
 * 3. 크기: 귀 높이(EAR_TOP ~ EARLOBE) 기준 비례 스케일
 * 4. yaw 추정: z값 차이로 한쪽 귀 opacity fade
 * 5. roll에 따라 rotate 적용
 *
 * 개선:
 * - 스킨톤 블렌딩: multiply 합성 옵션
 * - 귀걸이 종류별 앵커 오프셋 (drop vs stud)
 */

import { LANDMARKS, toPixel, angle, estimateYaw } from '../utils/landmark.js';
import { computeEarHeightPx } from '../utils/transform.js';
import { applyFilterIntensity, resetFilter } from '../utils/blend.js';

const EAR_HEIGHT_SCALE    = 1.8;
const YAW_FADE_THRESHOLD  = 0.35;

export function drawEarrings(ctx, faceLandmarks, earringImage, canvasW, canvasH, filterIntensity = 100) {
  if (!faceLandmarks || !earringImage) return;

  const yaw  = estimateYaw(faceLandmarks);
  const roll = angle(
    toPixel(faceLandmarks[LANDMARKS.LEFT_TEMPLE],  canvasW, canvasH),
    toPixel(faceLandmarks[LANDMARKS.RIGHT_TEMPLE], canvasW, canvasH)
  );

  const leftOpacity  = computeEarOpacity(yaw, 'left');
  const rightOpacity = computeEarOpacity(yaw, 'right');

  if (leftOpacity  > 0.01) drawSingleEarring(ctx, faceLandmarks, earringImage, 'left',  canvasW, canvasH, roll, filterIntensity * leftOpacity);
  if (rightOpacity > 0.01) drawSingleEarring(ctx, faceLandmarks, earringImage, 'right', canvasW, canvasH, roll, filterIntensity * rightOpacity);
}

function drawSingleEarring(ctx, faceLandmarks, earringImage, side, canvasW, canvasH, roll, effectiveIntensity) {
  const lobeKey = side === 'left' ? LANDMARKS.LEFT_EARLOBE  : LANDMARKS.RIGHT_EARLOBE;
  const lobe    = toPixel(faceLandmarks[lobeKey], canvasW, canvasH);

  const earHeightPx = computeEarHeightPx(faceLandmarks, side, canvasW, canvasH);
  const renderH     = earHeightPx * EAR_HEIGHT_SCALE;
  const aspectRatio = earringImage.naturalWidth / (earringImage.naturalHeight || 1);
  const renderW     = renderH * (aspectRatio || 0.5);

  // 이미지 종횡비로 stud(정방형)와 drop 구분 → 앵커 오프셋 조정
  const isStud = aspectRatio > 0.8;
  const anchorOffsetY = isStud ? -renderH * 0.5 : 0; // stud는 중심 기준, drop은 상단 기준

  ctx.save();
  applyFilterIntensity(ctx, effectiveIntensity);

  ctx.translate(lobe.x, lobe.y + anchorOffsetY);
  ctx.rotate(roll);
  ctx.drawImage(earringImage, -renderW / 2, anchorOffsetY !== 0 ? -renderH / 2 : 0, renderW, renderH);

  resetFilter(ctx);
  ctx.restore();
}

function computeEarOpacity(yaw, side) {
  const absYaw = Math.abs(yaw);
  if (absYaw < YAW_FADE_THRESHOLD) return 1;

  const fade = Math.min(1, (absYaw - YAW_FADE_THRESHOLD) / (1 - YAW_FADE_THRESHOLD));
  if (side === 'left'  && yaw > 0) return Math.max(0, 1 - fade);
  if (side === 'right' && yaw < 0) return Math.max(0, 1 - fade);
  return 1;
}
