import { LANDMARKS, toPixelMirrored } from '../utils/landmark.js';
import { getHeadRoll, getScaleFactor } from '../utils/transform.js';
import { drawWithTransform } from '../utils/blend.js';

/**
 * 모자 렌더링
 *
 * 알고리즘:
 * 1. 관자놀이(127, 356) 간 픽셀 거리로 px/cm 스케일 팩터 계산
 * 2. 모자 둘레(cm) → 지름(cm) = 둘레/π → 렌더 너비(px)
 * 3. 이마 최상단(10) 기준 위로 hat_height*0.3 오프셋이 이미지 중심 앵커
 * 4. 관자놀이 간 각도로 머리 기울기 반영
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} faceLandmarks - MediaPipe Face Mesh 랜드마크 배열
 * @param {HTMLImageElement} hatImage
 * @param {number} hatSizeCm - 모자 둘레 (cm)
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawHat(ctx, faceLandmarks, hatImage, hatSizeCm, canvasW, canvasH) {
  const scaleFactor = getScaleFactor(faceLandmarks, canvasW, canvasH);
  const hatDiameterCm = hatSizeCm / Math.PI;
  const hatRenderWidth = hatDiameterCm * scaleFactor;

  const aspectRatio =
    hatImage.naturalHeight && hatImage.naturalWidth
      ? hatImage.naturalHeight / hatImage.naturalWidth
      : 1;
  const hatRenderHeight = hatRenderWidth * aspectRatio;

  const foreheadTop = faceLandmarks[LANDMARKS.FOREHEAD_TOP];
  const anchor = toPixelMirrored(foreheadTop, canvasW, canvasH);
  anchor.y -= hatRenderHeight * 0.3;

  const roll = getHeadRoll(faceLandmarks, canvasW, canvasH);

  drawWithTransform(ctx, anchor.x, anchor.y, roll, (c) => {
    c.drawImage(
      hatImage,
      -hatRenderWidth / 2,
      -hatRenderHeight / 2,
      hatRenderWidth,
      hatRenderHeight,
    );
  });
}
