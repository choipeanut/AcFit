/**
 * WebGL 기반 악세사리 블렌딩 셰이더
 *
 * 파이프라인:
 *   videoCanvas (OffscreenCanvas 2D) — 미러 영상
 *   accessoryCanvas (OffscreenCanvas 2D) — 투명 배경 위 악세사리
 *   → outputCanvas (WebGL) — 블렌딩 합성 결과
 *
 * 셰이더 블렌딩 전략:
 *   - 어두운 악세사리(모자): Multiply — 피부 질감 위 자연스러운 그림자/깊이
 *   - 밝은 악세사리(금속 귀걸이/목걸이): Screen — 광택 있는 금속 느낌
 *   - 중간 밝기: 두 모드를 luminance 기반으로 보간
 */

const VERT_SRC = /* glsl */ `
  attribute vec2 a_position;
  varying   vec2 v_uv;
  void main() {
    v_uv        = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG_SRC = /* glsl */ `
  precision mediump float;

  uniform sampler2D u_video;
  uniform sampler2D u_accessory;

  varying vec2 v_uv;

  void main() {
    // Canvas는 Y 아래 방향, WebGL은 Y 위 방향 → 플립
    vec2 uv  = vec2(v_uv.x, 1.0 - v_uv.y);

    vec4 bg  = texture2D(u_video,     uv);
    vec4 acc = texture2D(u_accessory, uv);

    // 악세사리가 없는 픽셀은 배경 그대로
    if (acc.a < 0.01) {
      gl_FragColor = bg;
      return;
    }

    // 악세사리 명도 (0=어둠, 1=밝음)
    float lum = dot(acc.rgb, vec3(0.299, 0.587, 0.114));

    // Multiply 블렌드: bg * acc — 어두운 악세사리에 피부 질감/그림자 표현
    vec3 multiply = bg.rgb * acc.rgb;

    // Screen 블렌드: 1-(1-bg)(1-acc) — 밝은 금속성 악세사리에 광택 표현
    vec3 screen   = 1.0 - (1.0 - bg.rgb) * (1.0 - acc.rgb);

    // 명도 기반 보간: 어두운 악세사리=multiply, 밝은 악세사리=screen
    vec3 blended = mix(multiply, screen, smoothstep(0.25, 0.75, lum));

    // 최종 합성: 악세사리 alpha만큼 블렌딩 적용
    vec3 result  = mix(bg.rgb, blended, acc.a);

    gl_FragColor = vec4(result, 1.0);
  }
`;

export class AccessoryBlender {
  /**
   * @param {HTMLCanvasElement} outputCanvas - WebGL 컨텍스트를 얻을 캔버스 (visible)
   */
  constructor(outputCanvas) {
    const gl = outputCanvas.getContext('webgl')
            ?? outputCanvas.getContext('experimental-webgl');

    if (!gl) throw new Error('WebGL을 지원하지 않는 브라우저입니다');

    this._gl     = gl;
    this._canvas = outputCanvas;
    this._prog   = this._buildProgram();

    this._setupGeometry();
    this._videoTex = this._makeTexture();
    this._accTex   = this._makeTexture();
  }

  // ── WebGL 초기화 헬퍼 ─────────────────────────────

  _compileShader(type, src) {
    const gl  = this._gl;
    const sh  = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
    }
    return sh;
  }

  _buildProgram() {
    const gl   = this._gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, this._compileShader(gl.VERTEX_SHADER,   VERT_SRC));
    gl.attachShader(prog, this._compileShader(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    return prog;
  }

  _setupGeometry() {
    const gl = this._gl;
    // 화면 전체를 덮는 두 삼각형 (Clip Space)
    const verts = new Float32Array([-1, -1,  1, -1, -1,  1,
                                    -1,  1,  1, -1,  1,  1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    gl.useProgram(this._prog);
    const loc = gl.getAttribLocation(this._prog, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  _makeTexture() {
    const gl  = this._gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  // ── 매 프레임 호출 ────────────────────────────────

  /**
   * @param {OffscreenCanvas|HTMLCanvasElement} videoCanvas
   * @param {OffscreenCanvas|HTMLCanvasElement} accessoryCanvas
   */
  render(videoCanvas, accessoryCanvas) {
    const gl   = this._gl;
    const prog = this._prog;

    gl.viewport(0, 0, this._canvas.width, this._canvas.height);
    gl.useProgram(prog);

    // 비디오 텍스처 업로드 (unit 0)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._videoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoCanvas);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_video'), 0);

    // 악세사리 텍스처 업로드 (unit 1)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._accTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, accessoryCanvas);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_accessory'), 1);

    // 풀스크린 쿼드 드로우
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
