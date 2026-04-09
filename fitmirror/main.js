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
    hat:      null,   // { image, sizeCm, id }
    earring:  null,   // { image, id }
    necklace: null,   // { image, id }
  },
  activeCategory:        'earring',
  filterIntensity:       50,
  hatSizeCm:             58,
  lastFaceDetectedAt:    null,
  faceWarningShown:      false,
  lightnessWarningShown: false,
  gallery:               [],       // { dataURL }[] 최대 10개
  galleryVisible:        false,
  compareMode:           false,    // true = 아이템 없이 원본만 표시
  faceGuideHidden:       false,
};

// ─── FPS ────────────────────────────────────────────────
const fps = { frames: 0, last: performance.now(), current: 0 };

// ─── DOM ────────────────────────────────────────────────
const videoEl         = document.getElementById('input-video');
const canvas          = document.getElementById('output-canvas');
const ctx             = canvas.getContext('2d', { willReadFrequently: true });
const loadingScreen   = document.getElementById('loading-screen');
const loadingText     = document.getElementById('loading-text');
const errorScreen     = document.getElementById('error-screen');
const appEl           = document.getElementById('app');
const itemGrid        = document.getElementById('item-grid');
const hatControls     = document.getElementById('hat-controls');
const hatSizeSlider   = document.getElementById('hat-size-slider');
const hatSizeValue    = document.getElementById('hat-size-value');
const filterSlider    = document.getElementById('filter-slider');
const filterValue     = document.getElementById('filter-value');
const toast           = document.getElementById('toast');
const drawerToggle    = document.getElementById('drawer-toggle');
const sidePanel       = document.querySelector('.side-panel');
const fpsDisplay      = document.getElementById('fps-display');
const activeIndicator = document.getElementById('active-indicator');
const faceStatus      = document.getElementById('face-status');
const faceStatusText  = faceStatus?.querySelector('.face-status-text');
const galleryBar      = document.getElementById('gallery-bar');
const galleryStrip    = document.getElementById('gallery-strip');
const shortcutsModal  = document.getElementById('shortcuts-modal');
const compareBtn      = document.getElementById('compare-btn');
const faceGuideEl     = document.getElementById('face-guide');
const canvasWrapper   = document.querySelector('.canvas-wrapper');

let toastTimer    = null;
let itemsData     = null;
let frameCount    = 0;

// ─── 토스트 ─────────────────────────────────────────────
function showToast(msg, type = '', duration = 3000) {
  toast.textContent = msg;
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── 얼굴 감지 인디케이터 ───────────────────────────────
function updateFaceStatus(detected) {
  if (!faceStatus || !faceStatusText) return;
  faceStatus.className = detected ? 'face-status detected' : 'face-status lost';
  faceStatusText.textContent = detected ? '얼굴 감지됨' : '얼굴 없음';

  // 얼굴이 처음 감지되면 가이드 오버레이 숨기기
  if (detected && !state.faceGuideHidden) {
    state.faceGuideHidden = true;
    if (faceGuideEl) faceGuideEl.style.display = 'none';
  }
}

// ─── 착용 중 표시 ───────────────────────────────────────
function updateActiveIndicator() {
  const active = Object.entries(state.selectedItems)
    .filter(([, v]) => v !== null)
    .map(([k]) => ({ hat: '모자', earring: '귀걸이', necklace: '목걸이' }[k]));

  if (activeIndicator) {
    activeIndicator.textContent = active.length ? `착용 중: ${active.join(' + ')}` : '';
    activeIndicator.classList.toggle('hidden', active.length === 0);
  }
}

// ─── 아이템 그리드 렌더 ─────────────────────────────────
function renderItemGrid(category) {
  if (!itemsData) return;
  const key   = category === 'hat' ? 'hats' : category === 'earring' ? 'earrings' : 'necklaces';
  const items = itemsData[key] || [];
  itemGrid.innerHTML = '';

  items.forEach(item => {
    const card     = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = item.id;

    const selected = state.selectedItems[category];
    if (selected?.id === item.id) card.classList.add('selected');

    const img     = document.createElement('img');
    img.src       = item.thumbnail;
    img.alt       = item.name;
    img.loading   = 'lazy';
    img.onerror   = () => { img.src = makePlaceholderDataURL(item.id); };

    const name    = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;

    if (selected?.id === item.id) {
      const badge     = document.createElement('div');
      badge.className = 'selected-badge';
      badge.textContent = '✓ 착용';
      card.appendChild(badge);
    }

    card.appendChild(img);
    card.appendChild(name);
    card.addEventListener('click', () => selectItem(category, item));
    itemGrid.appendChild(card);
  });
}

// ─── 아이템 선택 ────────────────────────────────────────
async function selectItem(category, itemMeta) {
  if (state.selectedItems[category]?.id === itemMeta.id) {
    state.selectedItems[category] = null;
    if (category === 'necklace') disablePose();
    renderItemGrid(category);
    updateActiveIndicator();
    return;
  }

  const card = itemGrid.querySelector(`[data-id="${itemMeta.id}"]`);
  if (card) card.classList.add('loading');

  const img = await loadImage(itemMeta.asset);
  state.selectedItems[category] = {
    image:  img,
    id:     itemMeta.id,
    sizeCm: itemMeta.default_size_cm ?? state.hatSizeCm,
  };

  if (category === 'necklace') {
    loadingText.textContent = 'Pose 모델 로딩 중...';
    loadingScreen.style.opacity = '0.6';
    loadingScreen.classList.remove('hidden');
    await enablePose();
    loadingScreen.classList.add('hidden');
  }

  renderItemGrid(category);
  updateActiveIndicator();
}

// ─── 이미지 로드 ───────────────────────────────────────
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => {
      const ph = new Image();
      ph.src    = makePlaceholderDataURL(src);
      ph.onload = () => resolve(ph);
    };
    img.src = src;
  });
}

// ─── SVG Placeholder ────────────────────────────────────
function makePlaceholderDataURL(seed = '') {
  const hue = [...seed].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="12" fill="hsl(${hue},50%,40%)" opacity="0.85"/>
    <text x="50" y="58" font-family="sans-serif" font-size="36"
          text-anchor="middle" fill="white" opacity="0.9">✦</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ─── FPS ────────────────────────────────────────────────
function updateFPS() {
  fps.frames++;
  const now     = performance.now();
  const elapsed = now - fps.last;
  if (elapsed >= 1000) {
    fps.current = Math.round((fps.frames * 1000) / elapsed);
    fps.frames  = 0;
    fps.last    = now;
    if (fpsDisplay) fpsDisplay.textContent = `${fps.current} fps`;
  }
}

// ─── 렌더 루프 ──────────────────────────────────────────
function renderFrame() {
  const landmarks = window.currentLandmarks;

  if (videoEl.videoWidth && canvas.width !== videoEl.videoWidth) {
    canvas.width  = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
  }
  if (!canvas.width) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  // 비교 모드: 원본만 표시 (아이템 렌더 생략)
  if (!state.compareMode) {
    // 어두운 환경 감지 (매 90프레임)
    if (frameCount % 90 === 0) {
      try {
        const brightness = computeAverageBrightness(
          ctx.getImageData(0, 0, canvas.width, canvas.height)
        );
        if (brightness < 50 && !state.lightnessWarningShown) {
          state.lightnessWarningShown = true;
          showToast('💡 조명이 어둡습니다. 밝은 곳에서 사용해주세요.', 'warning', 4000);
        } else if (brightness >= 50) {
          state.lightnessWarningShown = false;
        }
      } catch { /* cross-origin 무시 */ }
    }

    const W = canvas.width, H = canvas.height;

    if (landmarks.face) {
      if (state.selectedItems.hat) {
        drawHat(ctx, landmarks.face, state.selectedItems.hat.image,
                state.selectedItems.hat.sizeCm, W, H, state.filterIntensity);
      }
      if (state.selectedItems.earring) {
        drawEarrings(ctx, landmarks.face, state.selectedItems.earring.image,
                     W, H, state.filterIntensity);
      }
    }

    if (landmarks.pose && state.selectedItems.necklace) {
      drawNecklace(ctx, landmarks.pose, state.selectedItems.necklace.image,
                   W, H, state.filterIntensity);
    }
  }

  // 비교 모드 오버레이 텍스트
  if (state.compareMode) {
    ctx.save();
    ctx.fillStyle  = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, 36);
    ctx.fillStyle  = 'white';
    ctx.font       = 'bold 14px sans-serif';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👁  비교 모드 — 아이템 숨김 중  (B키로 해제)', canvas.width / 2, 18);
    ctx.restore();
  }

  // 얼굴 감지 상태 업데이트
  const faceDetected = !!landmarks.face;
  updateFaceStatus(faceDetected);

  if (faceDetected) {
    state.lastFaceDetectedAt = Date.now();
    state.faceWarningShown   = false;
  } else if (state.lastFaceDetectedAt && !state.faceWarningShown) {
    if (Date.now() - state.lastFaceDetectedAt > 1000) {
      state.faceWarningShown = true;
      showToast('얼굴을 화면 중앙에 맞춰주세요', '', 2000);
    }
  }

  updateFPS();
  frameCount++;
}

// ─── 캡처 ───────────────────────────────────────────────
function captureAndSave() {
  // 비교 모드 일시 해제 후 캡처
  const wasCompare = state.compareMode;
  if (wasCompare) state.compareMode = false;
  renderFrame(); // 한 프레임 즉시 렌더

  const dataURL = canvas.toDataURL('image/png');
  addToGallery(dataURL);
  if (wasCompare) state.compareMode = true;

  if (navigator.share && navigator.canShare) {
    canvas.toBlob(async blob => {
      const file = new File([blob], 'fitmirror.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'FitMirror 피팅 결과' }); return; }
        catch { /* 취소 */ }
      }
      downloadDataURL(dataURL);
    }, 'image/png');
  } else {
    downloadDataURL(dataURL);
  }
}

function downloadDataURL(dataURL) {
  const a      = document.createElement('a');
  a.download   = `fitmirror_${Date.now()}.png`;
  a.href       = dataURL;
  a.click();
  showToast('📸 캡처 저장 완료!');
}

// ─── 갤러리 ─────────────────────────────────────────────
function addToGallery(dataURL) {
  state.gallery.unshift({ dataURL });
  if (state.gallery.length > 10) state.gallery.pop();
  renderGallery();
  if (!state.galleryVisible) toggleGallery(true);
}

function renderGallery() {
  if (!galleryStrip) return;
  galleryStrip.innerHTML = '';
  state.gallery.forEach(({ dataURL }) => {
    const img       = document.createElement('img');
    img.src         = dataURL;
    img.className   = 'gallery-thumb';
    img.title       = '클릭하여 다운로드';
    img.addEventListener('click', () => downloadDataURL(dataURL));
    galleryStrip.appendChild(img);
  });
}

function toggleGallery(forceOpen) {
  state.galleryVisible = forceOpen !== undefined ? forceOpen : !state.galleryVisible;
  galleryBar?.classList.toggle('hidden', !state.galleryVisible);
}

// ─── 비교 모드 ───────────────────────────────────────────
function toggleCompareMode() {
  state.compareMode = !state.compareMode;
  if (compareBtn) {
    compareBtn.classList.toggle('active', state.compareMode);
    compareBtn.setAttribute('aria-pressed', String(state.compareMode));
    compareBtn.title = state.compareMode ? '비교 모드 ON (B키로 해제)' : '비교 모드 (B)';
  }
}

// ─── 터치 스와이프 (모바일 drawer) ──────────────────────
function bindTouchSwipe() {
  let startY = 0;
  sidePanel?.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
  }, { passive: true });

  sidePanel?.addEventListener('touchmove', e => {
    const deltaY = e.touches[0].clientY - startY;
    // 아래로 80px 이상 스와이프 → drawer 닫기
    if (deltaY > 80 && sidePanel.classList.contains('open')) {
      sidePanel.classList.remove('open');
      drawerToggle.textContent = '☰ 아이템 선택';
    }
  }, { passive: true });
}

// ─── 탭 전환 ────────────────────────────────────────────
function switchToTab(category) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.category === category)
  );
  state.activeCategory = category;
  hatControls.classList.toggle('hidden', category !== 'hat');
  if (category !== 'necklace' && !state.selectedItems.necklace) disablePose();
  renderItemGrid(category);
}

function clearAllItems() {
  state.selectedItems.hat     = null;
  state.selectedItems.earring = null;
  state.selectedItems.necklace = null;
  disablePose();
  renderItemGrid(state.activeCategory);
  updateActiveIndicator();
  showToast('전체 선택 해제');
}

// ─── 키보드 단축키 ───────────────────────────────────────
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // 모달 열린 경우 Esc만 처리
    if (!shortcutsModal?.classList.contains('hidden')) {
      if (e.key === 'Escape') shortcutsModal.classList.add('hidden');
      return;
    }

    switch (e.key) {
      case 's': case 'S': captureAndSave(); break;
      case 'c': case 'C':
        switchCamera(videoEl).catch(() => showToast('카메라 전환 실패')); break;
      case '1': switchToTab('hat');      break;
      case '2': switchToTab('earring');  break;
      case '3': switchToTab('necklace'); break;
      case 'b': case 'B': toggleCompareMode(); break;
      case 'g': case 'G': toggleGallery(); break;
      case '?': shortcutsModal?.classList.remove('hidden'); break;
      case ' ':
        e.preventDefault();
        state.selectedItems[state.activeCategory] = null;
        if (state.activeCategory === 'necklace') disablePose();
        renderItemGrid(state.activeCategory);
        updateActiveIndicator();
        break;
      case 'Escape': clearAllItems(); break;
    }
  });
}

// ─── UI 이벤트 ──────────────────────────────────────────
function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchToTab(btn.dataset.category))
  );

  hatSizeSlider.addEventListener('input', () => {
    state.hatSizeCm = parseFloat(hatSizeSlider.value);
    hatSizeValue.textContent = hatSizeSlider.value;
    if (state.selectedItems.hat) state.selectedItems.hat.sizeCm = state.hatSizeCm;
  });

  filterSlider.addEventListener('input', () => {
    state.filterIntensity = parseInt(filterSlider.value);
    filterValue.textContent = filterSlider.value;
  });

  document.getElementById('capture-btn').addEventListener('click', captureAndSave);
  document.getElementById('capture-btn-footer').addEventListener('click', captureAndSave);

  document.getElementById('switch-camera-btn').addEventListener('click', async () => {
    try { await switchCamera(videoEl); }
    catch { showToast('카메라 전환에 실패했습니다.'); }
  });

  compareBtn?.addEventListener('click', toggleCompareMode);

  document.getElementById('deselect-btn').addEventListener('click', () => {
    state.selectedItems[state.activeCategory] = null;
    if (state.activeCategory === 'necklace') disablePose();
    renderItemGrid(state.activeCategory);
    updateActiveIndicator();
  });

  document.getElementById('clear-all-btn').addEventListener('click', clearAllItems);

  document.getElementById('gallery-close-btn')?.addEventListener('click', () => toggleGallery(false));

  document.getElementById('shortcuts-btn')?.addEventListener('click', () =>
    shortcutsModal?.classList.remove('hidden')
  );
  document.getElementById('modal-close-btn')?.addEventListener('click', () =>
    shortcutsModal?.classList.add('hidden')
  );
  shortcutsModal?.addEventListener('click', e => {
    if (e.target === shortcutsModal) shortcutsModal.classList.add('hidden');
  });

  drawerToggle.addEventListener('click', () => {
    sidePanel.classList.toggle('open');
    drawerToggle.textContent = sidePanel.classList.contains('open') ? '✕ 닫기' : '☰ 아이템 선택';
  });

  document.getElementById('retry-btn').addEventListener('click', () => location.reload());

  bindKeyboardShortcuts();
  bindTouchSwipe();
}

// ─── 앱 초기화 ──────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('./data/items.json');
    itemsData = await res.json();
  } catch {
    showToast('아이템 데이터 로딩 실패');
    itemsData = { hats: [], earrings: [], necklaces: [] };
  }

  try {
    loadingText.textContent = '카메라 초기화 중...';
    await initCamera(videoEl);
  } catch {
    loadingScreen.classList.add('hidden');
    errorScreen.classList.remove('hidden');
    return;
  }

  try {
    loadingText.textContent = 'AI 모델 로딩 중...';
    await startMediaPipeLoop(videoEl, renderFrame);
  } catch (err) {
    console.error('MediaPipe 초기화 실패:', err);
    showToast('AI 모델 로딩 실패. 기본 모드로 실행합니다.', 'warning', 5000);
    function basicLoop() { renderFrame(); requestAnimationFrame(basicLoop); }
    requestAnimationFrame(basicLoop);
  }

  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    if (window.innerWidth <= 768) drawerToggle.classList.remove('hidden');
  }, 400);

  bindEvents();
  renderItemGrid('earring');
}

init().catch(console.error);
