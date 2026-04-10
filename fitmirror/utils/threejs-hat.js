/* global THREE */
/**
 * Three.js 3D 모자 렌더러
 *
 * 아키텍처:
 *   - 별도 overlay canvas에 transparent WebGL 렌더링
 *   - OrthographicCamera를 canvas 픽셀 좌표에 1:1 매핑
 *   - Face Mesh 랜드마크에서 위치/회전/스케일 추출
 *
 * 좌표계 변환:
 *   canvas (x, y) → Three.js world (x - W/2, H/2 - y, 0)
 */

import { LANDMARKS, toPixelMirrored, distance } from './landmark.js';
import { getHeadRoll, getFaceYaw } from './transform.js';

export class ThreeJsHatRenderer {
  /**
   * @param {HTMLCanvasElement} overlayCanvas - 투명 배경 overlay canvas
   * @param {number} logicalW - 논리 해상도 너비 (Face Mesh 기준)
   * @param {number} logicalH - 논리 해상도 높이
   */
  constructor(overlayCanvas, logicalW, logicalH) {
    if (!window.THREE) throw new Error('Three.js가 로드되지 않았습니다');
    const THREE = window.THREE;

    this._W = logicalW;
    this._H = logicalH;

    this._renderer = new THREE.WebGLRenderer({
      canvas: overlayCanvas,
      alpha: true,        // 투명 배경 (비디오 레이어가 보임)
      antialias: true,
    });
    this._renderer.setSize(logicalW, logicalH);
    this._renderer.setClearColor(0x000000, 0);

    // OrthographicCamera: canvas 픽셀 좌표 = Three.js world 좌표
    this._camera = new THREE.OrthographicCamera(
      -logicalW / 2,  logicalW / 2,
       logicalH / 2, -logicalH / 2,
      1, 2000,
    );
    this._camera.position.z = 1000;

    this._scene = new THREE.Scene();
    this._setupLights();
    this._hatGroup = this._buildHat();
    this._scene.add(this._hatGroup);
  }

  // ── 씬 설정 ──────────────────────────────────────

  _setupLights() {
    const THREE = window.THREE;

    // 앰비언트: 전체 기본 밝기
    this._scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // 주광: 왼쪽 위에서 비추는 주 조명
    const main = new THREE.DirectionalLight(0xffffff, 0.9);
    main.position.set(-2, 3, 4);
    this._scene.add(main);

    // 보조광: 오른쪽 아래 fill light
    const fill = new THREE.DirectionalLight(0x8899ff, 0.3);
    fill.position.set(2, -1, 2);
    this._scene.add(fill);

    // 림라이트: 뒤에서 윤곽 강조
    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(0, 0, -3);
    this._scene.add(rim);
  }

  /**
   * 절차적 모자 지오메트리 생성
   * 크라운 (원기둥) + 브림 (납작 원반)
   * 단위 크기: 브림 지름 = 1.1 world unit
   */
  _buildHat() {
    const THREE  = window.THREE;
    const group  = new THREE.Group();

    const mat = new THREE.MeshPhongMaterial({
      color:     new THREE.Color(0x1a1a1a),
      shininess: 50,
      specular:  new THREE.Color(0x404040),
    });

    // 크라운 (위쪽이 약간 좁아지는 원통)
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.65, 32),
      mat,
    );
    crown.position.y = 0.345;  // 브림 위에 얹힘
    group.add(crown);

    // 크라운 상단 평면
    const top = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 32),
      mat,
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.68;
    group.add(top);

    // 브림 (납작 원반)
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.055, 48),
      mat,
    );
    brim.position.y = 0;  // 그룹 원점 = 브림 중심
    group.add(brim);

    return group;
  }

  // ── 매 프레임 렌더 ───────────────────────────────

  /**
   * @param {Array} faceLandmarks - Face Mesh 랜드마크
   * @param {number} canvasW     - 논리 캔버스 너비 (landmarks 기준)
   * @param {number} canvasH     - 논리 캔버스 높이
   */
  render(faceLandmarks, canvasW, canvasH) {
    if (!faceLandmarks) { this.clear(); return; }

    // 이마 앵커 (미러 좌표)
    const fhLm  = faceLandmarks[LANDMARKS.FOREHEAD_TOP];
    const anchor = toPixelMirrored(fhLm, canvasW, canvasH);

    // 머리 너비 (관자놀이 간격) → 모자 스케일
    const headW = distance(
      faceLandmarks[LANDMARKS.LEFT_TEMPLE],
      faceLandmarks[LANDMARKS.RIGHT_TEMPLE],
      canvasW, canvasH,
    );

    // 브림 지름 = 1.1 unit → 스케일 = headW / 1.1
    const hatScale   = headW / 1.1;
    const crownH     = 0.65 * hatScale;

    // 2D hat과 동일한 Y 앵커: 이마 상단에서 위로 crownH*0.3 오프셋이 브림 중심
    const anchorY_display = anchor.y - crownH * 0.3;

    // canvas 픽셀 → Three.js world 좌표
    const worldX = anchor.x          - canvasW / 2;
    const worldY = canvasH / 2 - anchorY_display;

    this._hatGroup.position.set(worldX, worldY, 0);
    this._hatGroup.scale.set(hatScale, hatScale, hatScale);

    // 회전: roll(Z축), yaw(Y축)
    const roll = getHeadRoll(faceLandmarks, canvasW, canvasH);
    const yaw  = getFaceYaw(faceLandmarks);

    // Three.js Y-up: canvas 시계방향 roll → z 음수 (좌표계 반전)
    this._hatGroup.rotation.z = -roll;
    // yaw: 원시값(z 차이)을 라디안으로 스케일
    this._hatGroup.rotation.y = yaw * 4;

    this._renderer.render(this._scene, this._camera);
  }

  clear() {
    this._renderer.clear();
  }

  /** 캔버스 크기 변경 시 호출 */
  resize(logicalW, logicalH) {
    const THREE = window.THREE;
    this._W = logicalW;
    this._H = logicalH;
    this._renderer.setSize(logicalW, logicalH);
    this._camera.left   = -logicalW / 2;
    this._camera.right  =  logicalW / 2;
    this._camera.top    =  logicalH / 2;
    this._camera.bottom = -logicalH / 2;
    this._camera.updateProjectionMatrix();
  }
}
