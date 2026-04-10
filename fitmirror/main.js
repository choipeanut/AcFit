import { initCamera, switchCamera } from './camera.js';
import { initFaceMesh } from './mediapipe-init.js';
import { drawHat } from './fitting/hat.js';
import { drawEarrings } from './fitting/earring.js';

// ── 상태 ──────────────────────────────────────────────
const state = {
  selectedItems: {
    hat: null,      // { meta, image }
    earring: null,  // { meta, image }
    necklace: null, // Phase 2
  },
  activeCategory: 'earring',
  hatSizeCm: 58,
  lastFaceDetectedAt: 0,
  isRunning: false,
};

// ── DOM ───────────────────────────────────────────────
const videoEl       = document.getElementById('input-video');
const canvasEl      = document.getElementById('output-canvas');
const ctx           = canvasEl.getContext('2d');
const loadingEl     = document.getElementById('loading-overlay');
const errorEl       = document.getElementById('error-overlay');
const errorMsgEl    = document.getElementById('error-message');
const retryBtn      = document.getElementById('retry-btn');
const faceHintEl    = document.getElementById('face-hint');
const toastEl       = document.getElementById('toast');
const captureBtn    = document.getElementById('capture-btn');
const switchCamBtn  = document.getElementById('switch-camera-btn');
const saveBtn       = document.getElementById('save-btn');
const itemsGrid     = document.getElementById('items-grid');
const hatControls   = document.getElementById('hat-controls');
const hatSizeInput  = document.getElementById('hat-size-input');
const hatSizeSlider = document.getElementById('hat-size-slider');
const tabBtns       = document.querySelectorAll('.tab-btn');

// ── 초기화 ────────────────────────────────────────────
async function init() {
  try {
    await initCamera(videoEl);
  } catch (err) {
    showError(cameraErrorMessage(err));
    return;
  }

  // 캔버스 크기를 비디오 해상도에 맞춤
  videoEl.addEventListener('loadedmetadata', () => {
    canvasEl.width  = videoEl.videoWidth  || 1280;
    canvasEl.height = videoEl.videoHeight || 720;
  });

  const faceMesh = initFaceMesh(onFaceResults);

  // 아이템 목록 로드
  try {
    const res = await fetch('./data/items.json');
    const items = await res.json();
    preloadImages(items);
    renderItemGrid(items[state.activeCategory] ?? []);
  } catch {
    showToast('아이템 데이터를 불러올 수 없습니다');
  }

  setupUI();
  state.isRunning = true;
  hideLoading();
  renderLoop(faceMesh);
}

// ── 렌더 루프 ─────────────────────────────────────────
async function renderLoop(faceMesh) {
  if (!state.isRunning) return;

  if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    await faceMesh.send({ image: videoEl });
  }

  requestAnimationFrame(() => renderLoop(faceMesh));
}

// ── Face Mesh 결과 처리 ───────────────────────────────
function onFaceResults(results) {
  const w = canvasEl.width;
  const h = canvasEl.height;
  if (!w || !h) return;

  // 캔버스 클리어
  ctx.clearRect(0, 0, w, h);

  // 비디오 미러 렌더 (ctx.scale로 처리 — CSS transform 없음)
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-w, 0);
  ctx.drawImage(results.image, 0, 0, w, h);
  ctx.restore();

  if (results.multiFaceLandmarks?.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    state.lastFaceDetectedAt = Date.now();
    faceHintEl.classList.add('hidden');

    if (state.selectedItems.hat) {
      drawHat(ctx, landmarks, state.selectedItems.hat.image,
              state.hatSizeCm, w, h);
    }

    if (state.selectedItems.earring) {
      drawEarrings(ctx, landmarks, state.selectedItems.earring.image, w, h);
    }

  } else {
    const elapsed = Date.now() - state.lastFaceDetectedAt;
    if (state.lastFaceDetectedAt > 0 && elapsed > 1000) {
      faceHintEl.classList.remove('hidden');
    }
  }

  // 저조도 경고
  checkBrightness(w, h);
}

// ── 아이템 이미지 사전 로딩 ───────────────────────────
const imageCache = {};

function preloadImages(allItems) {
  Object.values(allItems).flat().forEach((meta) => {
    const img = new Image();
    img.src = meta.asset;
    imageCache[meta.id] = img;
  });
}

function getImage(id) {
  return imageCache[id] ?? null;
}

// ── UI 렌더 ───────────────────────────────────────────
let _allItems = {};

function renderItemGrid(items) {
  itemsGrid.innerHTML = '';
  items.forEach((meta) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = meta.id;

    const img = document.createElement('img');
    img.src = meta.thumbnail;
    img.alt = meta.name;

    const label = document.createElement('span');
    label.textContent = meta.name;

    card.append(img, label);
    card.addEventListener('click', () => selectItem(meta));
    itemsGrid.appendChild(card);
  });
}

function selectItem(meta) {
  const cat = state.activeCategory;

  // 같은 아이템 재클릭 시 선택 해제
  if (state.selectedItems[cat]?.meta.id === meta.id) {
    state.selectedItems[cat] = null;
    document.querySelectorAll('.item-card').forEach((c) => c.classList.remove('active'));
    return;
  }

  state.selectedItems[cat] = { meta, image: getImage(meta.id) };

  document.querySelectorAll('.item-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.id === meta.id);
  });

  // 모자 선택 시 기본 크기 설정
  if (cat === 'hat' && meta.default_size_cm) {
    state.hatSizeCm = meta.default_size_cm;
    hatSizeInput.value  = state.hatSizeCm;
    hatSizeSlider.value = state.hatSizeCm;
  }
}

// ── UI 이벤트 설정 ────────────────────────────────────
function setupUI() {
  // 탭 전환
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
      hatControls.classList.toggle('hidden', state.activeCategory !== 'hat');
      renderItemGrid(_allItems[state.activeCategory] ?? []);
    });
  });

  // 모자 크기 — number input
  hatSizeInput.addEventListener('input', () => {
    state.hatSizeCm = parseFloat(hatSizeInput.value) || 58;
    hatSizeSlider.value = state.hatSizeCm;
  });

  // 모자 크기 — slider
  hatSizeSlider.addEventListener('input', () => {
    state.hatSizeCm = parseFloat(hatSizeSlider.value);
    hatSizeInput.value = state.hatSizeCm;
  });

  // 캡처 버튼
  captureBtn.addEventListener('click', captureImage);
  saveBtn.addEventListener('click', captureImage);

  // 카메라 전환
  switchCamBtn.addEventListener('click', async () => {
    try {
      await switchCamera(videoEl);
    } catch {
      showToast('카메라 전환에 실패했습니다');
    }
  });

  // 재시도
  retryBtn.addEventListener('click', () => {
    errorEl.classList.add('hidden');
    init();
  });

  // 초기 카테고리에 맞게 hat controls 숨김
  hatControls.classList.add('hidden');
}

// ── 아이템 목록 로드 후 UI 갱신 (preload와 연동) ─────
async function loadItemsAndRender() {
  try {
    const res = await fetch('./data/items.json');
    _allItems = await res.json();
    preloadImages(_allItems);
    renderItemGrid(_allItems[state.activeCategory] ?? []);
  } catch {
    showToast('아이템 데이터를 불러올 수 없습니다');
  }
}

// ── 캡처 & 저장 ───────────────────────────────────────
function captureImage() {
  const dataURL = canvasEl.toDataURL('image/png');

  // Web Share API 지원 시 공유 옵션 제공
  if (navigator.canShare) {
    canvasEl.toBlob((blob) => {
      const file = new File([blob], 'fitmirror_capture.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'FitMirror 피팅 결과',
        }).catch(() => downloadDataURL(dataURL));
        return;
      }
      downloadDataURL(dataURL);
    });
  } else {
    downloadDataURL(dataURL);
  }
}

function downloadDataURL(dataURL) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = `fitmirror_${Date.now()}.png`;
  a.click();
  showToast('이미지가 저장되었습니다');
}

// ── 저조도 감지 ───────────────────────────────────────
let _lastBrightnessCheck = 0;

function checkBrightness(w, h) {
  const now = Date.now();
  if (now - _lastBrightnessCheck < 3000) return;
  _lastBrightnessCheck = now;

  const sample = ctx.getImageData(0, 0, w, h);
  const data = sample.data;
  let sum = 0;
  const step = 200; // 픽셀 샘플링 간격 (성능)
  let count = 0;

  for (let i = 0; i < data.length; i += 4 * step) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    count++;
  }

  if (count > 0 && sum / count < 50) {
    showToast('조명이 어둡습니다. 밝은 곳에서 사용하세요');
  }
}

// ── 유틸리티 ──────────────────────────────────────────
function hideLoading() {
  loadingEl.classList.add('hidden');
}

function showError(msg) {
  loadingEl.classList.add('hidden');
  errorMsgEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

let _toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  toastEl.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
    setTimeout(() => toastEl.classList.add('hidden'), 300);
  }, 2500);
}

function cameraErrorMessage(err) {
  if (err.name === 'NotAllowedError') {
    return '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
  }
  if (err.name === 'NotFoundError') {
    return '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
  }
  return `카메라 오류: ${err.message}`;
}

// ── 진입점 ────────────────────────────────────────────
(async () => {
  try {
    const res = await fetch('./data/items.json');
    _allItems = await res.json();
    preloadImages(_allItems);
    renderItemGrid(_allItems[state.activeCategory] ?? []);
  } catch {
    // 아이템 없이도 카메라는 동작
  }

  await init();
})();
