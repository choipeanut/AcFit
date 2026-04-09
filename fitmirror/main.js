/**
 * FitMirror — 메인 앱 진입점
 * 상태 관리, 렌더 루프, UI 이벤트 핸들링
 */

import { initCamera, switchCamera } from './camera.js';
import { startMediaPipeLoop, enablePose, disablePose } from './mediapipe-init.js';
import { drawHat } from './fitting/hat.js';
import { drawEarrings } from './fitting/earring.js';
import { drawNecklace } from './fitting/necklace.js';
import { computeAverageBrightness } from './utils/landmark.js';

// ─── 상태 ───────────────────────────────────────────────
const state = {
  selectedItems: {
    hat: null,      // { image: HTMLImageElement, sizeCm: number, id: string }
    earring: null,  // { image: HTMLImageElement, id: string }
    necklace: null, // { image: HTMLImageElement, id: string }
  },
  activeCategory: 'earring',
  filterIntensity: 50,
  hatSizeCm: 58,
  lastFaceDetectedAt: null,
  faceWarningShown: false,
  lightnessWarningShown: false,
};

// ─── DOM ────────────────────────────────────────────────
const videoEl       = document.getElementById('input-video');
const canvas        = document.getElementById('output-canvas');
const ctx           = canvas.getContext('2d');
const loadingScreen = document.getElementById('loading-screen');
const loadingText   = document.getElementById('loading-text');
const errorScreen   = document.getElementById('error-screen');
const appEl         = document.getElementById('app');
const itemGrid      = document.getElementById('item-grid');
const hatControls   = document.getElementById('hat-controls');
const hatSizeSlider = document.getElementById('hat-size-slider');
const hatSizeValue  = document.getElementById('hat-size-value');
const filterSlider  = document.getElementById('filter-slider');
const filterValue   = document.getElementById('filter-value');
const toast         = document.getElementById('toast');
const drawerToggle  = document.getElementById('drawer-toggle');
const sidePanel     = document.querySelector('.side-panel');

let toastTimer = null;
let itemsData = null;
let frameCount = 0;

// ─── 토스트 헬퍼 ────────────────────────────────────────
function showToast(message, type = '', duration = 3000) {
  toast.textContent = message;
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── 아이템 그리드 렌더 ─────────────────────────────────
function renderItemGrid(category) {
  if (!itemsData) return;

  const key = category === 'hat' ? 'hats'
            : category === 'earring' ? 'earrings'
            : 'necklaces';

  const items = itemsData[key] || [];
  itemGrid.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = item.id;

    const selected = state.selectedItems[category];
    if (selected && selected.id === item.id) {
      card.classList.add('selected');
    }

    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.alt = item.name;
    img.loading = 'lazy';
    img.onerror = () => { img.src = makePlaceholderDataURL(item.id); };

    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;

    card.appendChild(img);
    card.appendChild(name);
    card.addEventListener('click', () => selectItem(category, item));
    itemGrid.appendChild(card);
  });
}

// ─── 아이템 선택 ────────────────────────────────────────
async function selectItem(category, itemMeta) {
  // 이미 선택된 경우 해제
  if (state.selectedItems[category]?.id === itemMeta.id) {
    state.selectedItems[category] = null;
    renderItemGrid(category);
    return;
  }

  // 이미지 preload
  const img = await loadImage(itemMeta.asset);
  state.selectedItems[category] = {
    image: img,
    id: itemMeta.id,
    sizeCm: itemMeta.default_size_cm ?? state.hatSizeCm,
  };

  // 목걸이 탭: Pose 활성화
  if (category === 'necklace') {
    loadingText.textContent = 'Pose 모델 로딩 중...';
    await enablePose();
  }

  renderItemGrid(category);
}

// ─── 이미지 로드 헬퍼 ───────────────────────────────────
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      // 에셋 없을 때 placeholder
      const placeholder = new Image();
      placeholder.src = makePlaceholderDataURL(src);
      placeholder.onload = () => resolve(placeholder);
    };
    img.src = src;
  });
}

// ─── Placeholder PNG (DataURL) ──────────────────────────
function makePlaceholderDataURL(seed = '') {
  const offscreen = document.createElement('canvas');
  offscreen.width = 100;
  offscreen.height = 100;
  const c = offscreen.getContext('2d');

  // seed 기반 색상
  const hue = [...seed].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  c.fillStyle = `hsla(${hue}, 60%, 55%, 0.85)`;
  c.beginPath();
  c.roundRect(5, 5, 90, 90, 12);
  c.fill();

  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.font = 'bold 32px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('✦', 50, 50);

  return offscreen.toDataURL('image/png');
}

// ─── 렌더 루프 ──────────────────────────────────────────
function renderFrame() {
  const landmarks = window.currentLandmarks;

  // 캔버스 크기를 video 해상도에 맞춤 (최초 1회 or 변경 시)
  if (videoEl.videoWidth && canvas.width !== videoEl.videoWidth) {
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
  }

  if (!canvas.width) return;

  // 1. video 프레임 그리기 (미러는 CSS transform으로 처리)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  // 2. 어두운 환경 감지 (매 60프레임마다)
  if (frameCount % 60 === 0) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const brightness = computeAverageBrightness(imageData);
    if (brightness < 50 && !state.lightnessWarningShown) {
      state.lightnessWarningShown = true;
      showToast('💡 조명이 어둡습니다. 밝은 곳에서 사용해주세요.', 'warning', 4000);
    } else if (brightness >= 50) {
      state.lightnessWarningShown = false;
    }
  }

  // 3. 얼굴 감지 여부 체크
  if (landmarks.face) {
    state.lastFaceDetectedAt = Date.now();
    state.faceWarningShown = false;
  } else {
    if (state.lastFaceDetectedAt && !state.faceWarningShown) {
      const elapsed = Date.now() - state.lastFaceDetectedAt;
      if (elapsed > 1000) {
        state.faceWarningShown = true;
        showToast('얼굴을 화면 중앙에 맞춰주세요', '', 2000);
      }
    }
  }

  const W = canvas.width;
  const H = canvas.height;

  // 4. 피팅 렌더
  if (landmarks.face) {
    // 모자
    if (state.selectedItems.hat) {
      drawHat(
        ctx,
        landmarks.face,
        state.selectedItems.hat.image,
        state.selectedItems.hat.sizeCm,
        W, H,
        state.filterIntensity
      );
    }

    // 귀걸이
    if (state.selectedItems.earring) {
      drawEarrings(
        ctx,
        landmarks.face,
        state.selectedItems.earring.image,
        W, H,
        state.filterIntensity
      );
    }
  }

  // 목걸이 (Pose)
  if (landmarks.pose && state.selectedItems.necklace) {
    drawNecklace(
      ctx,
      landmarks.pose,
      state.selectedItems.necklace.image,
      W, H,
      state.filterIntensity
    );
  }

  frameCount++;
}

// ─── 캡처 ───────────────────────────────────────────────
function captureAndSave() {
  const dataURL = canvas.toDataURL('image/png');

  // Web Share API 우선 시도
  if (navigator.share && navigator.canShare) {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'fitmirror_capture.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'FitMirror 피팅 결과',
          });
          return;
        } catch { /* 취소 시 fallback */ }
      }
      downloadDataURL(dataURL);
    }, 'image/png');
  } else {
    downloadDataURL(dataURL);
  }
}

function downloadDataURL(dataURL) {
  const a = document.createElement('a');
  a.download = `fitmirror_capture_${Date.now()}.png`;
  a.href = dataURL;
  a.click();
  showToast('📸 캡처가 저장되었습니다!');
}

// ─── UI 이벤트 ──────────────────────────────────────────
function bindEvents() {
  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.dataset.category;

      hatControls.classList.toggle('hidden', state.activeCategory !== 'hat');

      // 목걸이가 아닌 탭으로 이동 & 목걸이 미선택 시 Pose 비활성화
      if (state.activeCategory !== 'necklace' && !state.selectedItems.necklace) {
        disablePose();
      }

      renderItemGrid(state.activeCategory);
    });
  });

  // 모자 치수 슬라이더
  hatSizeSlider.addEventListener('input', () => {
    state.hatSizeCm = parseFloat(hatSizeSlider.value);
    hatSizeValue.textContent = hatSizeSlider.value;
    if (state.selectedItems.hat) {
      state.selectedItems.hat.sizeCm = state.hatSizeCm;
    }
  });

  // 필터 강도 슬라이더
  filterSlider.addEventListener('input', () => {
    state.filterIntensity = parseInt(filterSlider.value);
    filterValue.textContent = filterSlider.value;
  });

  // 캡처 버튼 (헤더 + 하단)
  document.getElementById('capture-btn').addEventListener('click', captureAndSave);
  document.getElementById('capture-btn-footer').addEventListener('click', captureAndSave);

  // 카메라 전환
  document.getElementById('switch-camera-btn').addEventListener('click', async () => {
    try {
      await switchCamera(videoEl);
    } catch {
      showToast('카메라 전환에 실패했습니다.');
    }
  });

  // 선택 해제
  document.getElementById('deselect-btn').addEventListener('click', () => {
    state.selectedItems[state.activeCategory] = null;
    if (state.activeCategory === 'necklace') disablePose();
    renderItemGrid(state.activeCategory);
  });

  // 모바일 drawer 토글
  drawerToggle.addEventListener('click', () => {
    sidePanel.classList.toggle('open');
    drawerToggle.textContent = sidePanel.classList.contains('open') ? '✕ 닫기' : '☰ 아이템 선택';
  });

  // 카메라 권한 재시도
  document.getElementById('retry-btn').addEventListener('click', () => location.reload());
}

// ─── 앱 초기화 ──────────────────────────────────────────
async function init() {
  // items.json 로드
  try {
    const res = await fetch('./data/items.json');
    itemsData = await res.json();
  } catch {
    showToast('아이템 데이터 로딩 실패');
    itemsData = { hats: [], earrings: [], necklaces: [] };
  }

  // 카메라 초기화
  try {
    loadingText.textContent = '카메라 초기화 중...';
    await initCamera(videoEl);
  } catch (err) {
    loadingScreen.classList.add('hidden');
    errorScreen.classList.remove('hidden');
    return;
  }

  // MediaPipe 초기화 및 렌더 루프 시작
  try {
    loadingText.textContent = 'AI 모델 로딩 중...';
    await startMediaPipeLoop(videoEl, renderFrame);
  } catch (err) {
    console.error('MediaPipe 초기화 실패:', err);
    // 기본 비디오 스트림만으로 fallback
    showToast('AI 모델 로딩 실패. 기본 모드로 실행합니다.', 'warning', 5000);
    function basicLoop() {
      renderFrame();
      requestAnimationFrame(basicLoop);
    }
    requestAnimationFrame(basicLoop);
  }

  // 앱 표시
  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    drawerToggle.classList.toggle('hidden', window.innerWidth > 768);
  }, 400);

  // 이벤트 바인딩
  bindEvents();

  // 초기 그리드 렌더 (귀걸이 탭)
  renderItemGrid('earring');

  // 모바일 감지
  if (window.innerWidth <= 768) {
    drawerToggle.classList.remove('hidden');
  }
}

// ─── 시작 ───────────────────────────────────────────────
init().catch(console.error);
