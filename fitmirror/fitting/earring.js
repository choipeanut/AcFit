import { LANDMARKS, toPixelMirrored, distance } from '../utils/landmark.js';
import { getHeadRoll, getFaceYaw } from '../utils/transform.js';
import { drawWithTransform, drawWithAlpha } from '../utils/blend.js';

const YAW_THRESHOLD = 0.08;  // 얼굴이 옆을 향할 때 귀걸이 가림 처리 임계값

/**
 * 귀걸이 렌더링
 *
 * 알고리즘:
 * 1. 귓불(234, 454) 좌표를 앵커로 사용
 * 2. 귀 높이(EAR_TOP→EARLOBE 거리)에 비례해 귀걸이 크기 결정
 * 3. 귀걸이 이미지 상단 중심을 귓불 앵커에 일치
 * 4. 머리 roll에 따라 회전 적용
 * 5. yaw 추정으로 옆모습 시 안 보이는 귀 귀걸이를 점진적으로 fade
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} faceLandmarks
 * @param {HTMLImageElement} earringImage
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawEarrings(ctx, faceLandmarks, earringImage, canvasW, canvasH) {
  const roll = getHeadRoll(faceLandmarks, canvasW, canvasH);
  const yaw = getFaceYaw(faceLandmarks);

  // 귀 높이 기준 스케일 계산 (왼쪽 귀 기준)
  const earHeight = distance(
    faceLandmarks[LANDMARKS.LEFT_EAR_TOP],
    faceLandmarks[LANDMARKS.LEFT_EARLOBE],
    canvasW, canvasH,
  );
  const earringAspect =
    earringImage.naturalHeight && earringImage.naturalWidth
      ? earringImage.naturalHeight / earringImage.naturalWidth
      : 2;
  const earringW = earHeight * 1.2;
  const earringH = earringW * earringAspect;

  // yaw에 따른 좌/우 귀걸이 opacity
  const leftAlpha = yaw > YAW_THRESHOLD ? Math.max(0, 1 - (yaw - YAW_THRESHOLD) / 0.1) : 1;
  const rightAlpha = yaw < -YAW_THRESHOLD ? Math.max(0, 1 - (-yaw - YAW_THRESHOLD) / 0.1) : 1;

  _drawSingleEarring(ctx, faceLandmarks[LANDMARKS.LEFT_EARLOBE], earringImage,
    earringW, earringH, roll, leftAlpha, canvasW, canvasH);

  _drawSingleEarring(ctx, faceLandmarks[LANDMARKS.RIGHT_EARLOBE], earringImage,
    earringW, earringH, roll, rightAlpha, canvasW, canvasH);
}

function _drawSingleEarring(ctx, lm, img, w, h, roll, alpha, canvasW, canvasH) {
  if (alpha <= 0) return;

  const anchor = toPixelMirrored(lm, canvasW, canvasH);

  drawWithAlpha(ctx, alpha, () => {
    drawWithTransform(ctx, anchor.x, anchor.y, roll, (c) => {
      // 귀걸이 이미지 상단 중심을 귓불 앵커에 일치
      c.drawImage(img, -w / 2, 0, w, h);
    });
  });
}
