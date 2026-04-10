/**
 * FitMirror — main.js (Phase 3)
 *
 * 렌더링 파이프라인:
 *   videoOffscreen   (OffscreenCanvas 2D) — 미러 영상 프레임
 *   accessoryOffscreen (OffscreenCanvas 2D) — 귀걸이·목걸이 (투명 배경)
 *   outputCanvas     (WebGL)              — AccessoryBlender 셰이더 합성 결과
 *   threeCanvas      (Three.js WebGL)     — 3D 모자 overlay
 */

import { initCamera, switchCamera } from './camera.js';
import { initFaceMesh, initPose }   from './mediapipe-init.js';
import { drawHat }                  from './fitting/hat.js';
import { drawEarrings }             from './fitting/earring.js';
import { drawNecklace }             from './fitting/necklace.js';
import { AccessoryBlender }         from './utils/blend-shader.js';
import { ThreeJsHatRenderer }       from './utils/threejs-hat.js';

// ── 상태 ──────────────────────────────────────────────
const state = {
  selectedItems: {
    hat:      null,  // { meta, image }
    earring:  null,  // { meta, image }
    necklace: null,  // { meta, image }
  },
  activeCategory: 'earring',
  hatSizeCm:  58,
  lastFaceDetectedAt: 0,
  isRunning:  false,
};

// Pose — 목걸이 탭 최초 선택 시 lazy 초기화
let poseModel           = null;
let latestPoseLandmarks = null;

// 렌더링 파이프라인 객체 (init 후 설정)
let videoOffscreen     = null;   // OffscreenCanvas or Canvas
let accessoryOffscreen = null;
let videoCtx2d         = null;   // videoOffscreen 2D context
let accCtx2d           = null;   // accessoryOffscreen 2D context
let blendShader        = null;   // AccessoryBlender (WebGL)
let threeHatRenderer   = null;   // ThreeJsHatRenderer

// ── DOM ───────────────────────────────────────────────
const videoEl       = document.getElementById('input-video');
const outputCanvas  = document.getElementById('output-canvas');   // WebGL
const threeCanvas   = document.getElementById('threejs-canvas');  // Three.js overlay
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
  // 카메라 초기화
  try {
    await initCamera(videoEl);
  } catch (err) {
    showError(cameraErrorMessage(err));
    return;
  }

  // 비디오 메타데이터 대기
  if (!videoEl.videoWidth) {
    await new Promise((res) => videoEl.addEventListener('loadedmetadata', res, { once: true }));
  }

  const W = videoEl.videoWidth  || 1280;
  const H = videoEl.videoHeight || 720;

  // 모바일: 해상도 캡 (성능 최적화)
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const logicalW = isMobile ? Math.min(W, 720) : W;
  const logicalH = isMobile ? Math.round(H * (logicalW / W)) : H;

  outputCanvas.width  = logicalW;
  outputCanvas.height = logicalH;
  threeCanvas.width   = logicalW;
  threeCanvas.height  = logicalH;

  // OffscreenCanvas 생성 (지원 안 하면 일반 canvas로 폴백)
  videoOffscreen     = makeOffscreen(logicalW, logicalH);
  accessoryOffscreen = makeOffscreen(logicalW, logicalH);
  videoCtx2d  = videoOffscreen.getContext('2d');
  accCtx2d    = accessoryOffscreen.getContext('2d');

  // WebGL 블렌드 셰이더
  try {
    blendShader = new AccessoryBlender(outputCanvas);
  } catch (e) {
    console.warn('WebGL 블렌딩 불가, 폴백 사용:', e.message);
    // 폴백: 일반 Canvas 2D로 outputCanvas를 사용
  }

  // Three.js 3D 모자 렌더러
  if (window.THREE) {
    try {
      threeHatRenderer = new ThreeJsHatRenderer(threeCanvas, logicalW, logicalH);
    } catch (e) {
      console.warn('Three.js 초기화 실패:', e.message);
    }
  }

  // Face Mesh 초기화
  const faceMesh = initFaceMesh(onFaceResults);

  // 아이템 데이터 로드
  try {
    const res = await fetch('./data/items.json');
    _allItems = await res.json();
    preloadImages(_allItems);
    renderItemGrid(_allItems[state.activeCategory] ?? []);
  } catch {
    showToast('아이템 데이터를 불러올 수 없습니다');
  }

  // PWA Service Worker 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  setupUI();
  state.isRunning = true;
  hideLoading();
  renderLoop(faceMesh, logicalW, logicalH);
}

function makeOffscreen(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ── 렌더 루프 ─────────────────────────────────────────
async function renderLoop(faceMesh, W, H) {
  if (!state.isRunning) return;

  if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const promises = [faceMesh.send({ image: videoEl })];

    // Pose: 목걸이 선택 시에만 병렬 처리
    if (state.selectedItems.necklace && poseModel) {
      promises.push(poseModel.send({ image: videoEl }));
    }

    await Promise.all(promises);
  }

  requestAnimationFrame(() => renderLoop(faceMesh, W, H));
}

// ── Face Mesh 결과 처리 ───────────────────────────────
function onFaceResults(results) {
  const W = outputCanvas.width;
  const H = outputCanvas.height;
  if (!W || !H || !videoOffscreen) return;

  // 1. 미러 영상을 videoOffscreen에 렌더
  videoCtx2d.clearRect(0, 0, W, H);
  videoCtx2d.save();
  videoCtx2d.scale(-1, 1);
  videoCtx2d.translate(-W, 0);
  videoCtx2d.drawImage(results.image, 0, 0, W, H);
  videoCtx2d.restore();

  // 2. 악세사리를 accessoryOffscreen에 렌더 (투명 배경)
  accCtx2d.clearRect(0, 0, W, H);

  let landmarks = null;
  if (results.multiFaceLandmarks?.length > 0) {
    landmarks = results.multiFaceLandmarks[0];
    state.lastFaceDetectedAt = Date.now();
    faceHintEl.classList.add('hidden');

    // 2D 모자: Three.js 3D 모자가 없을 때만 사용
    if (state.selectedItems.hat && !threeHatRenderer) {
      drawHat(accCtx2d, landmarks, state.selectedItems.hat.image,
              state.hatSizeCm, W, H);
    }

    if (state.selectedItems.earring) {
      drawEarrings(accCtx2d, landmarks, state.selectedItems.earring.image, W, H);
    }

    if (state.selectedItems.necklace && latestPoseLandmarks) {
      drawNecklace(accCtx2d, latestPoseLandmarks,
                   state.selectedItems.necklace.image, W, H);
    }
  } else {
    if (state.lastFaceDetectedAt > 0 &&
        Date.now() - state.lastFaceDetectedAt > 1000) {
      faceHintEl.classList.remove('hidden');
    }
  }

  // 3. WebGL 블렌드 셰이더: video + accessories → outputCanvas
  if (blendShader) {
    blendShader.render(videoOffscreen, accessoryOffscreen);
  } else {
    // 폴백: Canvas 2D 직접 합성
    _fallbackComposite(W, H);
  }

  // 4. Three.js 3D 모자 overlay
  if (threeHatRenderer) {
    if (state.selectedItems.hat && landmarks) {
      threeHatRenderer.render(landmarks, W, H);
    } else {
      threeHatRenderer.clear();
    }
  }

  // 5. 저조도 감지 (videoOffscreen에서)
  checkBrightness(W, H);
}

// WebGL 불가 시 폴백 — Canvas 2D 직접 합성
let _fallbackCtx = null;
function _fallbackComposite(W, H) {
  if (!_fallbackCtx) {
    _fallbackCtx = outputCanvas.getContext('2d');
  }
  if (!_fallbackCtx) return;
  _fallbackCtx.clearRect(0, 0, W, H);
  _fallbackCtx.drawImage(videoOffscreen, 0, 0);
  _fallbackCtx.drawImage(accessoryOffscreen, 0, 0);
}

// ── 아이템 이미지 사전 로딩 ───────────────────────────
const imageCache = {};
let _allItems    = {};

function preloadImages(allItems) {
  Object.values(allItems).flat().forEach((meta) => {
    const img = new Image();
    img.src = meta.asset;
    imageCache[meta.id] = img;
  });
}

function getImage(id) { return imageCache[id] ?? null; }

// ── UI 렌더 ───────────────────────────────────────────
function renderItemGrid(items) {
  const currentSelected = state.selectedItems[state.activeCategory];

  itemsGrid.innerHTML = '';
  items.forEach((meta) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    if (currentSelected?.meta.id === meta.id) card.classList.add('active');
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

  // 재클릭 시 선택 해제
  if (state.selectedItems[cat]?.meta.id === meta.id) {
    state.selectedItems[cat] = null;
    document.querySelectorAll('.item-card').forEach((c) => c.classList.remove('active'));
    return;
  }

  state.selectedItems[cat] = { meta, image: getImage(meta.id) };

  document.querySelectorAll('.item-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.id === meta.id);
  });

  if (cat === 'hat' && meta.default_size_cm) {
    state.hatSizeCm     = meta.default_size_cm;
    hatSizeInput.value  = state.hatSizeCm;
    hatSizeSlider.value = state.hatSizeCm;
  }
}

// ── UI 이벤트 ─────────────────────────────────────────
function setupUI() {
  // 탭 전환
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
      hatControls.classList.toggle('hidden', state.activeCategory !== 'hat');
      renderItemGrid(_allItems[state.activeCategory] ?? []);

      // 목걸이 탭 최초 선택 시 Pose lazy 초기화
      if (state.activeCategory === 'necklace' && !poseModel) {
        showToast('목걸이 모델 로딩 중…');
        poseModel = initPose((results) => {
          latestPoseLandmarks = results.poseLandmarks ?? null;
        });
      }
    });
  });

  // 모자 크기 제어
  hatSizeInput.addEventListener('input', () => {
    state.hatSizeCm     = parseFloat(hatSizeInput.value) || 58;
    hatSizeSlider.value = state.hatSizeCm;
  });
  hatSizeSlider.addEventListener('input', () => {
    state.hatSizeCm    = parseFloat(hatSizeSlider.value);
    hatSizeInput.value = state.hatSizeCm;
  });

  // 캡처
  captureBtn.addEventListener('click', captureImage);
  saveBtn.addEventListener('click',    captureImage);

  // 카메라 전환
  switchCamBtn.addEventListener('click', async () => {
    try { await switchCamera(videoEl); }
    catch { showToast('카메라 전환에 실패했습니다'); }
  });

  // 에러 재시도
  retryBtn.addEventListener('click', () => {
    errorEl.classList.add('hidden');
    init();
  });

  hatControls.classList.add('hidden');

  // 모바일 orientation 변경 시 캔버스 크기 재조정
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (threeHatRenderer) {
        threeHatRenderer.resize(outputCanvas.width, outputCanvas.height);
      }
    }, 300);
  });
}

// ── 캡처 & 저장 ───────────────────────────────────────
function captureImage() {
  // WebGL 캔버스 + Three.js overlay 합성 후 저장
  const W = outputCanvas.width;
  const H = outputCanvas.height;

  const composite = document.createElement('canvas');
  composite.width  = W;
  composite.height = H;
  const cctx = composite.getContext('2d');
  cctx.drawImage(outputCanvas,  0, 0, W, H);  // WebGL 블렌딩 결과
  cctx.drawImage(threeCanvas,   0, 0, W, H);  // Three.js 3D 모자 overlay

  const dataURL = composite.toDataURL('image/png');

  if (navigator.canShare) {
    composite.toBlob((blob) => {
      const file = new File([blob], 'fitmirror_capture.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'FitMirror 피팅 결과' })
          .catch(() => downloadDataURL(dataURL));
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
  a.href     = dataURL;
  a.download = `fitmirror_${Date.now()}.png`;
  a.click();
  showToast('이미지가 저장되었습니다');
}

// ── 저조도 감지 ───────────────────────────────────────
let _lastBrightnessCheck = 0;

function checkBrightness(W, H) {
  const now = Date.now();
  if (now - _lastBrightnessCheck < 3000) return;
  _lastBrightnessCheck = now;

  const data = videoCtx2d.getImageData(0, 0, W, H).data;
  let sum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4 * 200) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    count++;
  }
  if (count > 0 && sum / count < 50) {
    showToast('조명이 어둡습니다. 밝은 곳에서 사용하세요');
  }
}

// ── 유틸리티 ──────────────────────────────────────────
function hideLoading() { loadingEl.classList.add('hidden'); }

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
  // 아이템 조기 로드 (카메라 초기화 전)
  try {
    const res = await fetch('./data/items.json');
    _allItems = await res.json();
    preloadImages(_allItems);
    renderItemGrid(_allItems[state.activeCategory] ?? []);
  } catch { /* 아이템 없이도 카메라는 동작 */ }

  await init();
})();
