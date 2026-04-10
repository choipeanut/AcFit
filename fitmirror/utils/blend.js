/**
 * ctx.save/translate/rotate/drawImage/restore 패턴 래퍼
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x       - 변환 기준점 x
 * @param {number} y       - 변환 기준점 y
 * @param {number} roll    - 회전 각도 (라디안)
 * @param {Function} drawFn - (ctx) => void, translate/rotate 이후 실행
 */
export function drawWithTransform(ctx, x, y, roll, drawFn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(roll);
  drawFn(ctx);
  ctx.restore();
}

/**
 * globalAlpha를 일시적으로 변경해 반투명 렌더링
 */
export function drawWithAlpha(ctx, alpha, drawFn) {
  ctx.save();
  ctx.globalAlpha = alpha;
  drawFn(ctx);
  ctx.restore();
}
