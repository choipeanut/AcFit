/**
 * Placeholder PNG 에셋 생성 스크립트
 * Node.js 환경에서 실행: node generate-assets.js
 *
 * 실제 에셋이 없을 경우 색 채운 placeholder PNG를 생성
 * 브라우저는 에셋 로딩 실패 시 main.js의 makePlaceholderDataURL()로 fallback
 */

const { createCanvas } = (() => {
  try { return require('canvas'); } catch { return {}; }
})();

const fs = require('fs');
const path = require('path');

const ASSETS = [
  // 모자
  { file: 'assets/hats/beret_black.png',        label: '베레모', color: '#2c2c2c', shape: 'hat',     w: 200, h: 120 },
  { file: 'assets/hats/beret_black_thumb.png',   label: '베레모', color: '#2c2c2c', shape: 'hat',     w: 80,  h: 48  },
  { file: 'assets/hats/cap_navy.png',            label: '캡모자', color: '#1a2a4a', shape: 'cap',     w: 200, h: 120 },
  { file: 'assets/hats/cap_navy_thumb.png',      label: '캡모자', color: '#1a2a4a', shape: 'cap',     w: 80,  h: 48  },
  { file: 'assets/hats/bucket_white.png',        label: '버킷햇', color: '#e8e8e8', shape: 'bucket',  w: 200, h: 140 },
  { file: 'assets/hats/bucket_white_thumb.png',  label: '버킷햇', color: '#e8e8e8', shape: 'bucket',  w: 80,  h: 56  },

  // 귀걸이
  { file: 'assets/earrings/gold_drop.png',        label: '골드드롭', color: '#c9a84c', shape: 'drop',   w: 30, h: 70  },
  { file: 'assets/earrings/gold_drop_thumb.png',  label: '골드드롭', color: '#c9a84c', shape: 'drop',   w: 40, h: 80  },
  { file: 'assets/earrings/silver_hoop.png',       label: '실버후프', color: '#c0c0c0', shape: 'hoop',   w: 60, h: 60  },
  { file: 'assets/earrings/silver_hoop_thumb.png', label: '실버후프', color: '#c0c0c0', shape: 'hoop',   w: 80, h: 80  },
  { file: 'assets/earrings/pearl_stud.png',        label: '펄스터드', color: '#f5f0e8', shape: 'circle', w: 30, h: 30  },
  { file: 'assets/earrings/pearl_stud_thumb.png',  label: '펄스터드', color: '#f5f0e8', shape: 'circle', w: 60, h: 60  },

  // 목걸이
  { file: 'assets/necklaces/pendant_silver.png',        label: '펜던트', color: '#b0b0c8', shape: 'necklace', w: 300, h: 80 },
  { file: 'assets/necklaces/pendant_silver_thumb.png',  label: '펜던트', color: '#b0b0c8', shape: 'necklace', w: 80,  h: 40 },
  { file: 'assets/necklaces/gold_chain.png',            label: '골드체인', color: '#c9a84c', shape: 'necklace', w: 300, h: 60 },
  { file: 'assets/necklaces/gold_chain_thumb.png',      label: '골드체인', color: '#c9a84c', shape: 'necklace', w: 80,  h: 30 },
];

function drawPlaceholder(canvas, ctx, item) {
  const { w, h, color, label, shape } = item;
  ctx.clearRect(0, 0, w, h);

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;

  if (shape === 'circle' || shape === 'hoop') {
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2 - 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (shape === 'hoop') {
      ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2, true);
    }
    ctx.fill();
  } else if (shape === 'drop') {
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.65, w * 0.35, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.15, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'necklace') {
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.4);
    ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.95, h * 0.4);
    ctx.lineWidth = Math.max(4, h * 0.15);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
    ctx.lineCap = 'round';
    ctx.stroke();
    // 펜던트
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.85, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // hat / cap / bucket — 간단한 사다리꼴
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.9);
    ctx.lineTo(w * 0.9, h * 0.9);
    ctx.lineTo(w * 0.75, h * 0.3);
    ctx.lineTo(w * 0.25, h * 0.3);
    ctx.closePath();
    ctx.fill();
    // 챙
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.9, w * 0.45, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 레이블
  const fontSize = Math.max(8, Math.min(14, w / 6));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, w / 2, h - 2);
}

function generateWithCanvas() {
  const basePath = path.dirname(__filename);

  for (const item of ASSETS) {
    const filePath = path.join(basePath, item.file);

    // 디렉토리 확인
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 이미 파일 있으면 skip
    if (fs.existsSync(filePath)) continue;

    try {
      const canvas = createCanvas(item.w, item.h);
      const ctx = canvas.getContext('2d');
      drawPlaceholder(canvas, ctx, item);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(filePath, buffer);
      console.log(`생성: ${item.file}`);
    } catch (err) {
      console.warn(`건너뜀 (canvas 패키지 없음): ${item.file} — ${err.message}`);
    }
  }
}

function generateMinimalPNG(filePath) {
  // 1x1 투명 PNG (최소 유효 PNG)
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  fs.writeFileSync(filePath, minimalPNG);
}

function generateFallbackPNGs() {
  const basePath = path.dirname(__filename);
  let generated = 0;

  for (const item of ASSETS) {
    const filePath = path.join(basePath, item.file);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) {
      generateMinimalPNG(filePath);
      generated++;
    }
  }

  if (generated > 0) {
    console.log(`\n${generated}개의 최소 placeholder PNG 생성 완료.`);
    console.log('실제 에셋으로 교체하면 브라우저에서 자동 적용됩니다.\n');
  } else {
    console.log('모든 파일이 이미 존재합니다.');
  }
}

// canvas 패키지 시도, 없으면 최소 PNG fallback
if (createCanvas) {
  generateWithCanvas();
} else {
  console.log('canvas 패키지 없음 → 최소 PNG placeholder 생성');
  generateFallbackPNGs();
}
