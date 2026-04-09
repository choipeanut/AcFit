# FitMirror — Claude Code Technical Spec (CLAUDE.md)

## Project Overview

웹캠 기반 실시간 가상 악세사리 피팅 서비스.  
MediaPipe Face Mesh + Pose를 이용해 얼굴/신체 랜드마크를 추출하고,
Three.js Canvas 2D로 아이템(모자/귀걸이/목걸이)을 실시간 합성한다.

**Tech Stack**
- Frontend: Vanilla HTML + CSS + JS (단일 파일 or Vite 번들)
- Vision: MediaPipe Face Mesh, MediaPipe Pose (CDN)
- Rendering: Canvas 2D API (Three.js는 Phase 2에서 도입)
- 아이템 에셋: PNG with alpha channel

---

## Directory Structure

```
fitmirror/
├── index.html
├── style.css
├── main.js                  # 앱 진입점, 상태 관리
├── camera.js                # 웹캠 스트림 초기화
├── mediapipe-init.js        # Face Mesh + Pose 초기화
├── fitting/
│   ├── hat.js               # 모자 렌더링 로직
│   ├── earring.js           # 귀걸이 렌더링 로직
│   └── necklace.js          # 목걸이 렌더링 로직
├── utils/
│   ├── landmark.js          # 랜드마크 유틸 함수
│   ├── transform.js         # 좌표 변환, 스케일 계산
│   └── blend.js             # 캔버스 블렌딩 헬퍼
├── assets/
│   ├── hats/                # 모자 PNG (alpha)
│   ├── earrings/            # 귀걸이 PNG (alpha)
│   └── necklaces/           # 목걸이 PNG (alpha)
└── data/
    └── items.json           # 아이템 메타데이터
```

---

## Core Implementation

### 1. 카메라 초기화 (`camera.js`)

```js
// 요구사항:
// - getUserMedia로 웹캠 스트림 취득
// - video 엘리먼트에 srcObject 연결
// - 해상도: 1280x720 요청 (fallback: 640x480)
// - 전/후면 카메라 전환 지원 (facingMode 토글)
// - 카메라 권한 거부 시 에러 UI 표시

export async function initCamera(videoEl) { ... }
export async function switchCamera() { ... }
```

### 2. MediaPipe 초기화 (`mediapipe-init.js`)

```js
// Face Mesh 설정:
// - maxNumFaces: 1
// - refineLandmarks: true  ← 귀 랜드마크 정확도 향상에 필수
// - minDetectionConfidence: 0.7
// - minTrackingConfidence: 0.7

// Pose 설정:
// - modelComplexity: 1
// - smoothLandmarks: true
// - minDetectionConfidence: 0.7

// 두 모델의 onResults 콜백을 통합해서
// window.currentLandmarks = { face, pose } 에 저장
// requestAnimationFrame 루프로 매 프레임 처리
```

### 3. 랜드마크 유틸 (`utils/landmark.js`)

사용할 주요 Face Mesh 랜드마크 인덱스:

```js
export const LANDMARKS = {
  // 모자
  FOREHEAD_TOP: 10,        // 이마 최상단
  LEFT_TEMPLE: 234,        // 왼쪽 관자놀이
  RIGHT_TEMPLE: 454,       // 오른쪽 관자놀이

  // 귀걸이
  LEFT_EARLOBE: 234,       // 왼쪽 귓불
  RIGHT_EARLOBE: 454,      // 오른쪽 귓불
  LEFT_EAR_TOP: 127,
  RIGHT_EAR_TOP: 356,

  // 목걸이 기준
  CHIN: 152,               // 턱 끝
  NECK_CENTER: 0,          // 코 아래 (Pose와 함께 사용)
}

// Pose 랜드마크 인덱스
export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  NOSE: 0,
}

// 랜드마크 좌표를 캔버스 픽셀 좌표로 변환
// MediaPipe 좌표계는 0~1 정규화값
export function toPixel(landmark, canvasWidth, canvasHeight) {
  return {
    x: landmark.x * canvasWidth,
    y: landmark.y * canvasHeight,
    z: landmark.z,  // depth hint
  }
}

// 두 랜드마크 사이 픽셀 거리
export function distance(lm1, lm2) { ... }

// 두 점 사이 각도 (roll 계산용)
export function angle(lm1, lm2) { ... }
```

### 4. 모자 피팅 (`fitting/hat.js`)

```js
/**
 * 모자 렌더링 알고리즘:
 *
 * 1. HEAD_WIDTH = distance(LEFT_TEMPLE, RIGHT_TEMPLE) 픽셀값 측정
 * 2. 실제 머리 너비 추정값 = 14cm (성인 평균) — 사용자 입력으로 보정 가능
 * 3. scale_factor = HEAD_WIDTH_px / HEAD_WIDTH_cm
 * 4. 모자 렌더 너비 = inputHatCircumference_cm / Math.PI * scale_factor
 *    (둘레 → 지름 → 픽셀 변환)
 * 5. 모자 중심 앵커 = FOREHEAD_TOP 좌표에서 위로 hat_height * 0.3 오프셋
 * 6. 머리 기울기(roll) = angle(LEFT_TEMPLE, RIGHT_TEMPLE)
 * 7. ctx.save() → ctx.translate(anchor) → ctx.rotate(roll) → ctx.drawImage → ctx.restore()
 */

export function drawHat(ctx, faceLandmarks, hatImage, hatSizeCm, canvasW, canvasH) { ... }
```

### 5. 귀걸이 피팅 (`fitting/earring.js`)

```js
/**
 * 귀걸이 렌더링 알고리즘:
 *
 * 1. 앵커 = LEFT_EARLOBE / RIGHT_EARLOBE 픽셀 좌표
 * 2. 귀걸이 이미지 상단 중앙을 앵커에 일치시킴
 * 3. 크기: 귀 높이(EAR_TOP ~ EARLOBE 거리) 기준으로 비례 스케일
 * 4. 얼굴이 옆으로 돌아가면 (yaw 추정):
 *    - |LEFT_TEMPLE.z - RIGHT_TEMPLE.z| > threshold 이면 한쪽 귀 가림 처리
 *    - 가려진 귀의 귀걸이 opacity를 0으로 (또는 서서히 fade)
 * 5. 머리 roll에 따라 동일하게 rotate 적용
 */

export function drawEarrings(ctx, faceLandmarks, earringImage, canvasW, canvasH) { ... }
```

### 6. 목걸이 피팅 (`fitting/necklace.js`)

```js
/**
 * 목걸이 렌더링 알고리즘:
 *
 * 1. Pose에서 LEFT_SHOULDER, RIGHT_SHOULDER 좌표 취득
 * 2. 목 중심 = (LEFT_SHOULDER + RIGHT_SHOULDER) / 2에서 위로 오프셋
 * 3. 목걸이를 단순 이미지로 붙이지 않고 베지어 커브로 변형:
 *    - 제어점: 왼쪽 어깨 → 목 중심(위로 볼록) → 오른쪽 어깨
 *    - ctx.bezierCurveTo로 경로 생성 후 목걸이 이미지를 경로에 맞게 워프
 * 4. 어깨 너비 기준으로 목걸이 스케일 자동 조정
 * 5. globalCompositeOperation = 'multiply' 로 피부 위 자연스럽게 합성
 *    (금속 느낌일 경우 'source-over' + 낮은 opacity로 대안)
 *
 * NOTE: 베지어 워프가 복잡하면 Phase 1에서는 단순 이미지 오버레이로 시작하고
 * Phase 2에서 커브 변형 추가
 */

export function drawNecklace(ctx, poseLandmarks, necklaceImage, canvasW, canvasH) { ... }
```

### 7. 메인 렌더 루프 (`main.js`)

```js
// 매 프레임 실행 순서:
// 1. video 프레임을 offscreen canvas에 그림 (미러 반전: scaleX(-1))
// 2. Face Mesh / Pose 모델에 프레임 전달
// 3. onResults 콜백에서:
//    a. face landmarks → hat, earring 렌더
//    b. pose landmarks → necklace 렌더
// 4. 최종 canvas를 화면에 표시
// 5. requestAnimationFrame으로 반복

// 상태 관리:
const state = {
  selectedItems: {
    hat: null,        // { image, sizeCm }
    earring: null,    // { image }
    necklace: null,   // { image }
  },
  activeCategory: 'earring',
  cameraFacing: 'user',
}
```

---

## UI 구성 (`index.html` + `style.css`)

```
┌─────────────────────────────────────────────┐
│  FitMirror                            [📸] [🔄] │  ← 헤더
├──────────────────────────┬──────────────────┤
│                          │  [모자] [귀걸이] [목걸이] │  ← 탭
│   <canvas id="output">   │                  │
│   (실시간 피팅 화면)      │  아이템 그리드   │
│   1280 x 720             │  (썸네일 클릭)   │
│                          │                  │
│                          │  ── 모자 선택 시 ──│
│                          │  둘레: [  58  ] cm│
│                          │  슬라이더 52~64  │
└──────────────────────────┴──────────────────┘
│  [캡처 저장]   [필터 강도: ━━●━━]            │  ← 하단
└─────────────────────────────────────────────┘
```

**CSS 요구사항:**
- `canvas` 엘리먼트는 `transform: scaleX(-1)` 적용 (거울 모드)
- 아이템 선택 시 썸네일에 highlight border
- 모바일 반응형: 패널을 하단 drawer로 전환 (`@media max-width: 768px`)
- 다크 테마 기본 적용

---

## items.json 구조

```json
{
  "hats": [
    {
      "id": "hat_001",
      "name": "베레모 블랙",
      "thumbnail": "./assets/hats/beret_black_thumb.png",
      "asset": "./assets/hats/beret_black.png",
      "default_size_cm": 58,
      "anchor": "top-center"
    }
  ],
  "earrings": [
    {
      "id": "earring_001",
      "name": "골드 드롭",
      "thumbnail": "./assets/earrings/gold_drop_thumb.png",
      "asset": "./assets/earrings/gold_drop.png",
      "anchor": "top-center"
    }
  ],
  "necklaces": [
    {
      "id": "necklace_001",
      "name": "펜던트 실버",
      "thumbnail": "./assets/necklaces/pendant_silver_thumb.png",
      "asset": "./assets/necklaces/pendant_silver.png"
    }
  ]
}
```

---

## 캡처 기능

```js
// 캡처 버튼 클릭 시:
// 1. canvas.toDataURL('image/png') 로 현재 프레임 추출
// 2. <a download="fitmirror_capture.png"> 엘리먼트 생성 후 click() 트리거
// 3. Web Share API 사용 가능한 경우 공유 옵션 제공
//    navigator.share({ files: [blob], title: 'FitMirror 피팅 결과' })
```

---

## 에러 처리 요구사항

| 상황 | 처리 방법 |
|------|-----------|
| 카메라 권한 거부 | 에러 화면 + 권한 허용 방법 안내 |
| 얼굴 미감지 (1초 이상) | 오버레이 토스트: "얼굴을 화면 중앙에 맞춰주세요" |
| 어두운 환경 감지 | 평균 픽셀 밝기 < 50 이면 조명 경고 |
| MediaPipe 로딩 실패 | CDN fallback URL 시도 후 에러 표시 |
| 모바일 후면 카메라 | facingMode: 'environment' 로 전환 지원 |

---

## 성능 요구사항

- 목표 FPS: 30fps (모바일), 60fps (데스크탑)
- MediaPipe 모델 로딩 완료 전 skeleton loader 표시
- 이미지 에셋 사전 로딩 (Image preload on page load)
- Face Mesh와 Pose를 같은 프레임에 동시 실행 시 성능 저하 가능
  → Pose는 목걸이 탭 선택 시에만 활성화하는 lazy 전략 사용

---

## 구현 Phase

### Phase 1 (MVP)
- [ ] 카메라 스트림 + 캔버스 렌더 루프
- [ ] MediaPipe Face Mesh 초기화
- [ ] 귀걸이 피팅 (랜드마크 앵커링)
- [ ] 모자 피팅 (고정 비율, 치수 입력 UI)
- [ ] 아이템 선택 패널 UI
- [ ] 캡처 저장

### Phase 2
- [ ] MediaPipe Pose 추가
- [ ] 목걸이 피팅 (베지어 커브 워프)
- [ ] 얼굴 yaw 감지 → 귀걸이 가림 처리
- [ ] 다중 아이템 동시 착용

### Phase 3
- [ ] WebGL 셰이더 블렌딩 (피부 자연 합성)
- [ ] Three.js 3D 아이템 렌더링
- [ ] 모바일 최적화 / PWA

---

## CDN Dependencies

```html
<!-- MediaPipe Face Mesh -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>

<!-- MediaPipe Pose (Phase 2) -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
```

---

## 개발 시작 명령

```bash
npm create vite@latest fitmirror -- --template vanilla
cd fitmirror
npm install
npm run dev
```

> assets/ 폴더에 테스트용 PNG(alpha 포함) 파일을 먼저 준비할 것.
> 실제 에셋 없이 테스트 시 colored rectangle placeholder를 사용해도 됨.
