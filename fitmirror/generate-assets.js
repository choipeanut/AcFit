/**
 * Placeholder SVG 에셋 생성 스크립트
 * node generate-assets.js
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;

// ── SVG 생성 함수들 ──────────────────────────────────────

function hat(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${lighten(color)}"/>
      <stop offset="100%" stop-color="${color}"/>
    </radialGradient>
  </defs>
  <!-- 챙 -->
  <ellipse cx="100" cy="115" rx="88" ry="16" fill="${darken(color)}" opacity="0.9"/>
  <!-- 몸통 -->
  <path d="M40 115 Q30 60 100 45 Q170 60 160 115 Z" fill="url(#g)"/>
  <!-- 하이라이트 -->
  <ellipse cx="80" cy="72" rx="22" ry="10" fill="white" opacity="0.12" transform="rotate(-20,80,72)"/>
  <text x="100" y="135" font-family="sans-serif" font-size="14" font-weight="bold"
        fill="white" text-anchor="middle" opacity="0.9">${label}</text>
</svg>`;
}

function cap(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${lighten(color)}"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <!-- 챙 -->
  <path d="M30 105 Q100 120 175 100 L165 110 Q100 130 30 115 Z" fill="${darken(color)}"/>
  <!-- 모자 몸통 -->
  <path d="M45 105 Q40 55 100 40 Q160 55 155 105 Z" fill="url(#g)"/>
  <!-- 버튼 -->
  <circle cx="100" cy="44" r="6" fill="${darken(color)}"/>
  <!-- 심 -->
  <path d="M100 50 L100 105" stroke="${darken(color)}" stroke-width="2" opacity="0.4"/>
  <text x="100" y="130" font-family="sans-serif" font-size="13" font-weight="bold"
        fill="white" text-anchor="middle" opacity="0.9">${label}</text>
</svg>`;
}

function bucket(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
  <defs>
    <linearGradient id="g" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="${lighten(color)}"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <!-- 넓은 챙 -->
  <ellipse cx="100" cy="110" rx="90" ry="18" fill="${darken(color)}" opacity="0.85"/>
  <!-- 몸통 (버킷 형태) -->
  <path d="M55 108 Q50 55 100 42 Q150 55 145 108 Z" fill="url(#g)"/>
  <text x="100" y="138" font-family="sans-serif" font-size="13" font-weight="bold"
        fill="${color === '#e8e8e8' ? '#555' : 'white'}" text-anchor="middle" opacity="0.9">${label}</text>
</svg>`;
}

function goldDrop(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 120">
  <defs>
    <radialGradient id="g" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#ffe08a"/>
      <stop offset="100%" stop-color="${color}"/>
    </radialGradient>
  </defs>
  <!-- 연결 고리 -->
  <circle cx="30" cy="12" r="8" fill="none" stroke="${color}" stroke-width="3"/>
  <!-- 드롭 -->
  <ellipse cx="30" cy="78" rx="18" ry="32" fill="url(#g)"/>
  <!-- 하이라이트 -->
  <ellipse cx="22" cy="62" rx="5" ry="9" fill="white" opacity="0.3" transform="rotate(-15,22,62)"/>
</svg>`;
}

function silverHoop(color, label) {
  // evenodd fill-rule로 중앙 구멍을 투명하게 만듦
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <defs>
    <radialGradient id="g" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="white"/>
      <stop offset="60%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${darken(color)}"/>
    </radialGradient>
  </defs>
  <!-- evenodd: 바깥 원 - 안쪽 원 = 링 모양, 안쪽은 완전 투명 -->
  <path fill-rule="evenodd"
    d="M40,6 A34,34 0 1 1 39.999,6 Z M40,18 A22,22 0 1 0 40.001,18 Z"
    fill="url(#g)" opacity="0.95"/>
  <!-- 하이라이트 -->
  <path d="M15 30 Q22 12 40 10 Q58 12 65 30" fill="none" stroke="white"
        stroke-width="3" opacity="0.35" stroke-linecap="round"/>
</svg>`;
}

function pearlStud(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
  <defs>
    <radialGradient id="g" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="white"/>
      <stop offset="50%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${darken(color)}"/>
    </radialGradient>
  </defs>
  <circle cx="30" cy="30" r="26" fill="url(#g)"/>
  <!-- 광택 -->
  <ellipse cx="20" cy="18" rx="7" ry="5" fill="white" opacity="0.5" transform="rotate(-30,20,18)"/>
  <circle cx="24" cy="16" r="2" fill="white" opacity="0.7"/>
</svg>`;
}

function pendantSilver(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <!-- 체인 -->
  <path d="M15 35 Q150 65 285 35" fill="none" stroke="${color}" stroke-width="5"
        stroke-linecap="round" opacity="0.9"/>
  <!-- 체인 하이라이트 -->
  <path d="M15 33 Q150 63 285 33" fill="none" stroke="white" stroke-width="1.5"
        stroke-linecap="round" opacity="0.4"/>
  <!-- 펜던트 -->
  <polygon cx="150" cy="68" points="150,52 160,70 140,70" fill="${darken(color)}"/>
  <ellipse cx="150" cy="68" rx="14" ry="14" fill="url(#g)"/>
  <ellipse cx="145" cy="63" rx="4" ry="3" fill="white" opacity="0.4"/>
</svg>`;
}

function goldChain(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffe08a"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <!-- 체인 링크 반복 -->
  ${Array.from({length: 12}, (_, i) => {
    const x = 18 + i * 22;
    const y = 30 + Math.sin(i * 0.5) * 5;
    return `<ellipse cx="${x}" cy="${y}" rx="9" ry="5" fill="none" stroke="url(#g)" stroke-width="3.5" transform="rotate(${i%2===0?0:90},${x},${y})"/>`;
  }).join('\n  ')}
  <!-- 하이라이트 -->
  <path d="M15 25 Q150 18 285 25" fill="none" stroke="#ffe08a" stroke-width="1.5"
        opacity="0.5" stroke-linecap="round"/>
</svg>`;
}

// ── 색상 헬퍼 ───────────────────────────────────────────
function lighten(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, ((n>>16)&0xff) + 60);
  const g = Math.min(255, ((n>>8)&0xff)  + 60);
  const b = Math.min(255, (n&0xff) + 60);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function darken(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, ((n>>16)&0xff) - 40);
  const g = Math.max(0, ((n>>8)&0xff)  - 40);
  const b = Math.max(0, (n&0xff) - 40);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── 추가 형태 함수들 ─────────────────────────────────────

function cowboy(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${lighten(color)}"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <!-- 넓은 챙 (카우보이) -->
  <path d="M5 90 Q60 110 120 105 Q180 110 235 90 L220 100 Q160 120 120 115 Q80 120 20 100 Z" fill="${darken(color)}"/>
  <!-- 몸통 -->
  <path d="M70 100 Q65 45 120 30 Q175 45 170 100 Z" fill="url(#g)"/>
  <!-- 크라운 밴드 -->
  <path d="M70 82 Q120 88 170 82" fill="none" stroke="${darken(color)}" stroke-width="4" stroke-linecap="round"/>
  <text x="120" y="118" font-family="sans-serif" font-size="12" font-weight="bold"
        fill="white" text-anchor="middle" opacity="0.9">${label}</text>
</svg>`;
}

function tophat(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${lighten(color)}"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <!-- 챙 -->
  <ellipse cx="80" cy="155" rx="72" ry="14" fill="${darken(color)}"/>
  <!-- 몸통 (높은 실린더) -->
  <rect x="42" y="50" width="76" height="105" rx="4" fill="url(#g)"/>
  <!-- 윗면 -->
  <ellipse cx="80" cy="50" rx="38" ry="8" fill="${lighten(color)}"/>
  <!-- 밴드 -->
  <rect x="42" y="135" width="76" height="10" fill="${darken(color)}"/>
  <!-- 하이라이트 -->
  <rect x="50" y="58" width="12" height="88" rx="6" fill="white" opacity="0.1"/>
  <text x="80" y="185" font-family="sans-serif" font-size="11" font-weight="bold"
        fill="white" text-anchor="middle" opacity="0.9">${label}</text>
</svg>`;
}

function rubyDrop(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 120">
  <defs>
    <radialGradient id="g" cx="35%" cy="28%" r="65%">
      <stop offset="0%" stop-color="#ff8a8a"/>
      <stop offset="100%" stop-color="${color}"/>
    </radialGradient>
  </defs>
  <circle cx="30" cy="12" r="8" fill="none" stroke="${color}" stroke-width="3"/>
  <ellipse cx="30" cy="78" rx="18" ry="32" fill="url(#g)"/>
  <ellipse cx="22" cy="60" rx="5" ry="10" fill="white" opacity="0.35" transform="rotate(-20,22,60)"/>
  <ellipse cx="24" cy="56" rx="2" ry="3" fill="white" opacity="0.6"/>
</svg>`;
}

function goldHoop(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <defs>
    <radialGradient id="g" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffe08a"/>
      <stop offset="60%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${darken(color)}"/>
    </radialGradient>
  </defs>
  <path fill-rule="evenodd"
    d="M40,6 A34,34 0 1 1 39.999,6 Z M40,18 A22,22 0 1 0 40.001,18 Z"
    fill="url(#g)" opacity="0.95"/>
  <path d="M15 30 Q22 12 40 10 Q58 12 65 30" fill="none" stroke="#ffe08a"
        stroke-width="3" opacity="0.4" stroke-linecap="round"/>
</svg>`;
}

function diamondStud(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
  <defs>
    <radialGradient id="g" cx="35%" cy="28%" r="65%">
      <stop offset="0%" stop-color="white"/>
      <stop offset="40%" stop-color="#d4f1ff"/>
      <stop offset="100%" stop-color="${color}"/>
    </radialGradient>
  </defs>
  <!-- 다이아몬드 형태 -->
  <polygon points="30,4 54,22 30,56 6,22" fill="url(#g)" opacity="0.95"/>
  <!-- 패싯 라인 -->
  <line x1="30" y1="4" x2="30" y2="56" stroke="white" stroke-width="0.8" opacity="0.4"/>
  <line x1="6" y1="22" x2="54" y2="22" stroke="white" stroke-width="0.8" opacity="0.4"/>
  <!-- 하이라이트 -->
  <polygon points="30,4 42,22 30,22 18,22" fill="white" opacity="0.3"/>
</svg>`;
}

function chokerNecklace(color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 50">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${lighten(color)}"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <!-- 초커 띠 -->
  <path d="M20 22 Q150 32 280 22 Q280 28 150 38 Q20 28 20 22 Z" fill="url(#g)" opacity="0.9"/>
  <!-- 버클/장식 -->
  <rect x="136" y="18" width="28" height="14" rx="4" fill="${darken(color)}"/>
  <rect x="140" y="21" width="20" height="8" rx="3" fill="${lighten(color)}" opacity="0.6"/>
</svg>`;
}

function pearlNecklace(color, label) {
  const pearls = Array.from({length: 16}, (_, i) => {
    const t = i / 15;
    const x = 20 + t * 260;
    const y = 25 + Math.sin(t * Math.PI) * 15;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"
      fill="radial-gradient(circle at 35% 30%, white, ${color})"
      stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
    <ellipse cx="${(x-2).toFixed(1)}" cy="${(y-2).toFixed(1)}" rx="2.5" ry="2" fill="white" opacity="0.5"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 55">
  <defs>
    <radialGradient id="pg" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="white"/>
      <stop offset="60%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${darken(color)}"/>
    </radialGradient>
  </defs>
  ${Array.from({length: 16}, (_, i) => {
    const t = i / 15;
    const x = 20 + t * 260;
    const y = 25 + Math.sin(t * Math.PI) * 15;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="url(#pg)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
    <ellipse cx="${(x-2.5).toFixed(1)}" cy="${(y-2.5).toFixed(1)}" rx="2.5" ry="2" fill="white" opacity="0.5"/>`;
  }).join('')}
</svg>`;
}

// ── 에셋 정의 ────────────────────────────────────────────
const ASSETS = [
  // 모자
  { file: 'assets/hats/beret_black.png',       svg: () => hat('#2c2c2c', '베레모') },
  { file: 'assets/hats/beret_black_thumb.png', svg: () => hat('#2c2c2c', '베레모') },
  { file: 'assets/hats/cap_navy.png',           svg: () => cap('#1a2a4a', '캡모자') },
  { file: 'assets/hats/cap_navy_thumb.png',     svg: () => cap('#1a2a4a', '캡모자') },
  { file: 'assets/hats/bucket_white.png',       svg: () => bucket('#c8c8c8', '버킷햇') },
  { file: 'assets/hats/bucket_white_thumb.png', svg: () => bucket('#c8c8c8', '버킷햇') },
  { file: 'assets/hats/cowboy_brown.png',       svg: () => cowboy('#7a4a28', '카우보이') },
  { file: 'assets/hats/cowboy_brown_thumb.png', svg: () => cowboy('#7a4a28', '카우보이') },
  { file: 'assets/hats/tophat_black.png',       svg: () => tophat('#1c1c1c', '탑햇') },
  { file: 'assets/hats/tophat_black_thumb.png', svg: () => tophat('#1c1c1c', '탑햇') },

  // 귀걸이
  { file: 'assets/earrings/gold_drop.png',         svg: () => goldDrop('#c9a84c', '') },
  { file: 'assets/earrings/gold_drop_thumb.png',   svg: () => goldDrop('#c9a84c', '') },
  { file: 'assets/earrings/silver_hoop.png',        svg: () => silverHoop('#c0c0c0', '') },
  { file: 'assets/earrings/silver_hoop_thumb.png',  svg: () => silverHoop('#c0c0c0', '') },
  { file: 'assets/earrings/pearl_stud.png',         svg: () => pearlStud('#f5f0e8', '') },
  { file: 'assets/earrings/pearl_stud_thumb.png',   svg: () => pearlStud('#f5f0e8', '') },
  { file: 'assets/earrings/ruby_drop.png',          svg: () => rubyDrop('#c0203a', '') },
  { file: 'assets/earrings/ruby_drop_thumb.png',    svg: () => rubyDrop('#c0203a', '') },
  { file: 'assets/earrings/gold_hoop.png',          svg: () => goldHoop('#c9a84c', '') },
  { file: 'assets/earrings/gold_hoop_thumb.png',    svg: () => goldHoop('#c9a84c', '') },
  { file: 'assets/earrings/diamond_stud.png',       svg: () => diamondStud('#a0d8ef', '') },
  { file: 'assets/earrings/diamond_stud_thumb.png', svg: () => diamondStud('#a0d8ef', '') },

  // 목걸이
  { file: 'assets/necklaces/pendant_silver.png',        svg: () => pendantSilver('#a0a0b8', '') },
  { file: 'assets/necklaces/pendant_silver_thumb.png',  svg: () => pendantSilver('#a0a0b8', '') },
  { file: 'assets/necklaces/gold_chain.png',            svg: () => goldChain('#c9a84c', '') },
  { file: 'assets/necklaces/gold_chain_thumb.png',      svg: () => goldChain('#c9a84c', '') },
  { file: 'assets/necklaces/choker_black.png',          svg: () => chokerNecklace('#2a2a2a', '') },
  { file: 'assets/necklaces/choker_black_thumb.png',    svg: () => chokerNecklace('#2a2a2a', '') },
  { file: 'assets/necklaces/pearl_necklace.png',        svg: () => pearlNecklace('#f5f0e8', '') },
  { file: 'assets/necklaces/pearl_necklace_thumb.png',  svg: () => pearlNecklace('#f5f0e8', '') },
];

// ── 생성 ─────────────────────────────────────────────────
let count = 0;
for (const asset of ASSETS) {
  const filePath = path.join(BASE, asset.file);
  // SVG 확장자로도 저장 (PNG 경로에 SVG 내용 저장 — 브라우저는 둘 다 읽음)
  const svgPath = filePath.replace('.png', '.svg');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const svgContent = asset.svg();
  fs.writeFileSync(svgPath, svgContent, 'utf8');
  count++;
}
console.log(`SVG 에셋 ${count}개 생성 완료.`);
