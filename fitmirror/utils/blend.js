/**
 * 캔버스 블렌딩 헬퍼
 * Phase 1: globalAlpha 기반 필터 강도 조절
 * Phase 3: WebGL 셰이더 블렌딩 확장 예정
 */

/**
 * 캔버스에 필터 강도(0~100)를 globalAlpha로 반영
 * 아이템 렌더 직전에 호출하여 투명도 적용
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} intensity - 0(투명) ~ 100(불투명)
 */
export function applyFilterIntensity(ctx, intensity) {
  ctx.globalAlpha = Math.max(0, Math.min(1, intensity / 100));
}

/**
 * globalAlpha를 기본값(1)으로 복원
 */
export function resetFilter(ctx) {
  ctx.globalAlpha = 1.0;
}

/**
 * 복합 연산 모드 설정
 * @param {CanvasRenderingContext2D} ctx
 * @param {'source-over'|'multiply'|'screen'} mode
 */
export function setBlendMode(ctx, mode) {
  ctx.globalCompositeOperation = mode;
}

/**
 * 복합 연산 모드를 기본값으로 복원
 */
export function resetBlendMode(ctx) {
  ctx.globalCompositeOperation = 'source-over';
}
