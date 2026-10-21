/* Ojo 3D tipo fantoma anatómico (WebGL2): globo, iris café, párpados con piel. */
(function () {
  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uBlink;
uniform float uPupil;
uniform float uSize;
uniform float uFill;
uniform vec3 uSclera;
uniform vec3 uIris;
uniform vec3 uIrisDeep;
uniform vec3 uIrisLight;
uniform vec3 uLash;
uniform vec3 uSkin;
uniform vec3 uSkinDeep;
uniform vec2 uGaze;

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (min(uRes.x, uRes.y) * 1.12);

  float R = uSize;
  float r = length(p);
  float zz = R * R - r * r;
  float z = sqrt(max(zz, 0.0));
  vec3 n = vec3(p, z) / max(R, 1e-4);

  float w = R * 1.02;
  float nx = clamp(p.x / w, -1.0, 1.0);
  float shape = max(1.0 - nx * nx, 0.0);
  float upperOpen = R * 0.42 * pow(shape, 0.60);
  float lowerOpen = -R * 0.34 * pow(shape, 0.85);
  float b = smoothstep(0.0, 1.0, uBlink);
  float upper = mix(upperOpen, lowerOpen + R * 0.028, b);
  float lower = mix(lowerOpen, lowerOpen + R * 0.08, b * 0.45);
  float lidIn = smoothstep(-0.0015, 0.0015, min(upper - p.y, p.y - lower)) * smoothstep(0.0, 0.012, shape);

  // parche de piel de los párpados
  vec2 sp = vec2(p.x / (R * 1.38), (p.y - R * 0.10) / (R * 1.50));
  float skinMask = smoothstep(1.0, 0.32, length(sp));

  float up = p.y - upper;
  float down = lower - p.y;
  vec3 skin = uSkin;
  skin *= 0.90 + 0.18 * smoothstep(0.0, R * 0.55, up);
  skin *= 0.94 + 0.10 * smoothstep(0.0, R * 0.40, down);
  skin = mix(skin, uSkinDeep, smoothstep(R * 0.10, 0.0, up) * 0.22);
  skin = mix(skin, uSkinDeep, smoothstep(R * 0.14, 0.0, down) * 0.14);
  skin = mix(skin, uSkinDeep, smoothstep(R * 1.10, R * 0.55, up) * 0.10);

  float crease = smoothstep(0.0065, 0.0, abs(p.y - (upper + R * 0.26))) * smoothstep(1.0, 0.82, abs(nx)) * 0.22;
  skin = mix(skin, uSkinDeep, crease);
  float trough = smoothstep(0.020, 0.0, abs(p.y - (lower - R * 0.20))) * smoothstep(1.0, 0.80, abs(nx)) * 0.15;
  skin = mix(skin, uSkinDeep, trough);
  skin *= 0.985 + 0.03 * hash21(floor(p * 260.0));

  vec3 col = skin;
  float alpha = skinMask * (1.0 - lidIn) * uFill;

  if (zz > 0.0) {
    vec3 L = normalize(vec3(-0.45, 0.55, 0.72));
    float diff = max(dot(n, L), 0.0);
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);

    vec3 sclera = uSclera * (0.40 + 0.64 * diff);
    sclera += uSkin * fres * 0.35;
    sclera = mix(sclera, uSclera * 0.72, smoothstep(0.86, 1.0, r / R) * 0.45);

    vec3 gazeDir = normalize(vec3(uGaze, sqrt(max(1.0 - dot(uGaze, uGaze), 0.08))));
    vec3 tangentA = normalize(cross(gazeDir, vec3(0.0, 1.0, 0.0)));
    vec3 tangentB = cross(gazeDir, tangentA);
    vec2 local = vec2(dot(n, tangentA), dot(n, tangentB));
    float lang = atan(local.y, local.x);
    float az = acos(clamp(dot(n, gazeDir), -1.0, 1.0));

    float irisMask = smoothstep(0.56, 0.50, az);
    float a01 = fract(lang / 6.2831853);
    float fiberA = hash21(vec2(floor(a01 * 280.0), 11.0));
    float fiberB = hash21(vec2(floor(a01 * 70.0), 5.0));
    vec3 iris = mix(uIrisLight, uIris, smoothstep(0.10, 0.34, az));
    iris = mix(iris, uIrisDeep, smoothstep(0.36, 0.56, az) * 0.9);
    iris *= 0.70 + 0.52 * fiberA;
    iris *= 0.88 + 0.22 * fiberB;
    iris += uIrisLight * exp(-pow((az - 0.20) / 0.055, 2.0)) * 0.22;
    iris = mix(iris, uIrisDeep * 0.45, smoothstep(0.49, 0.56, az));
    iris *= 0.50 + 0.60 * diff;

    float pupilMask = smoothstep(0.23 * uPupil, 0.20 * uPupil, az);

    float g1 = smoothstep(0.030, 0.0, length((p - vec2(0.055, 0.020)) * vec2(1.0, 1.25)));
    float g2 = smoothstep(0.012, 0.0, length(p - vec2(0.020, -0.045)));
    float glint = clamp(g1 * 0.95 + g2 * 0.7, 0.0, 1.0);

    vec3 ball = sclera;
    ball = mix(ball, iris, irisMask);
    ball = mix(ball, uIrisDeep * 0.12, pupilMask);
    ball = mix(ball, vec3(1.0, 0.98, 0.95), glint);
    ball *= 0.8 + 0.2 * smoothstep(0.0, R * 0.5, upper - p.y);
    ball *= mix(0.55, 1.0, smoothstep(R, R * 0.72, r));

    float sphereAlpha = uFill * (0.84 + 0.16 * clamp(n.z, 0.0, 1.0));
    sphereAlpha *= smoothstep(R, R - 0.004, r);

    col = mix(col, ball, lidIn);
    alpha = max(alpha, sphereAlpha * lidIn);

    float lid = smoothstep(0.0058, 0.0016, abs(p.y - upper)) * smoothstep(1.0, 0.92, abs(nx));
    col = mix(col, uLash, lid);
    alpha = max(alpha, lid);

    float water = smoothstep(0.0045, 0.0, abs(p.y - lower)) * lidIn * 0.5;
    col = mix(col, vec3(1.0, 0.91, 0.89), water);

    float lash = 0.0;
    for (int i = 0; i < 33; i++) {
      float fi = float(i) / 32.0;
      float x = mix(-w * 0.97, w * 0.97, fi);
      float sx = clamp(x / w, -1.0, 1.0);
      float sh = max(1.0 - sx * sx, 0.0);
      float byOpen = R * 0.42 * pow(sh, 0.60);
      float by = mix(byOpen, -R * 0.34 * pow(sh, 0.85) + R * 0.028, b);
      float edge = smoothstep(0.02, R * 0.7, by);
      float alt = 0.72 + 0.28 * sin(float(i) * 12.9898);
      vec2 a = vec2(x, by);
      vec2 mid = a + normalize(vec2(sx * 1.4, 1.0)) * (0.016 + 0.020 * sh) * alt;
      vec2 tip = mid + normalize(vec2(sx * 0.5 + 0.15, 1.0)) * (0.022 + 0.020 * sh) * alt;
      float l = smoothstep(0.0040, 0.0012, seg(p, a, mid))
        + smoothstep(0.0026, 0.0008, seg(p, mid, tip)) * 0.8;
      lash += min(l, 1.0) * edge;
    }
    col = mix(col, uLash, clamp(lash, 0.0, 1.0));
    alpha = max(alpha, clamp(lash, 0.0, 1.0));

    float lowLine = smoothstep(0.0035, 0.0008, abs(p.y - lower)) * smoothstep(1.0, 0.9, abs(nx)) * 0.32;
    col = mix(col, uLash, lowLine);
    alpha = max(alpha, lowLine);
  }

  outColor = vec4(col * alpha, alpha);
}`;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };

  const parseColor = value => {
    const probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = '#000000';
    if (value) probe.fillStyle = value;
    const resolved = probe.fillStyle;
    if (resolved.startsWith('#')) {
      const n = parseInt(resolved.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    const parts = resolved.match(/[\d.]+/g) || [0, 0, 0];
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
  };

  function createEye(container, options) {
    const props = {
      size: 0.33,
      fill: 1,
      interactive: true,
      hoverStrength: 0.7,
      sclera: '#f7efeb',
      iris: '#7a4a26',
      irisDeep: '#38200f',
      irisLight: '#b9824c',
      lash: '#3a0f1e',
      skin: '#eac6b3',
      skinDeep: '#c08d78',
      ...(options || {})
    };

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      return { update() {}, destroy() {} };
    }

    const program = gl.createProgram();
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    const colors = {
      uSclera: parseColor(props.sclera),
      uIris: parseColor(props.iris),
      uIrisDeep: parseColor(props.irisDeep),
      uIrisLight: parseColor(props.irisLight),
      uLash: parseColor(props.lash),
      uSkin: parseColor(props.skin),
      uSkinDeep: parseColor(props.skinDeep)
    };

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const pointer = { inside: false };
    const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
    const pupil = { value: 1 };
    const blink = { start: -1, duration: 0.34 };
    let nextBlink = performance.now() + 1600 + Math.random() * 2600;
    let visible = true;
    let alive = true;
    let raf = 0;
    let last = performance.now();
    let width = 1;
    let height = 1;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw(performance.now());
    };

    const blinkValue = now => {
      if (blink.start < 0) return 0;
      const u = (now - blink.start) / 1000 / blink.duration;
      if (u >= 1) {
        blink.start = -1;
        return 0;
      }
      return u < 0.3 ? u / 0.3 : u < 0.44 ? 1 : 1 - (u - 0.44) / 0.56;
    };

    const draw = now => {
      const open = props.interactive ? 1 + 0.34 * clamp(props.hoverStrength, 0, 1) : 1;
      const target = pointer.inside ? open : 1;
      pupil.value += (target - pupil.value) * 0.14;
      gaze.x += (gaze.tx - gaze.x) * 0.12;
      gaze.y += (gaze.ty - gaze.y) * 0.12;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(uniforms.uTime, reduced ? 0 : now / 1000);
      gl.uniform1f(uniforms.uBlink, reduced ? 0 : blinkValue(now));
      gl.uniform1f(uniforms.uPupil, pupil.value);
      gl.uniform2f(uniforms.uGaze, gaze.x, gaze.y);
      gl.uniform1f(uniforms.uSize, props.size);
      gl.uniform1f(uniforms.uFill, props.fill);
      gl.uniform3fv(uniforms.uSclera, colors.uSclera);
      gl.uniform3fv(uniforms.uIris, colors.uIris);
      gl.uniform3fv(uniforms.uIrisDeep, colors.uIrisDeep);
      gl.uniform3fv(uniforms.uIrisLight, colors.uIrisLight);
      gl.uniform3fv(uniforms.uLash, colors.uLash);
      gl.uniform3fv(uniforms.uSkin, colors.uSkin);
      gl.uniform3fv(uniforms.uSkinDeep, colors.uSkinDeep);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = now => {
      raf = 0;
      if (!alive || !visible) return;
      last = now;
      if (!reduced && blink.start < 0 && now > nextBlink) {
        blink.start = now;
        nextBlink = now + 2400 + Math.random() * 4200;
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && visible && alive) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const onPointerMove = event => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const half = Math.min(rect.width, rect.height) / 2;
      const gx = (event.clientX - cx) / half;
      const gy = (cy - event.clientY) / half;
      const len = Math.hypot(gx, gy) || 1;
      const reach = Math.min(len, 1) * 0.24 / len;
      gaze.tx = gx * reach;
      gaze.ty = gy * reach;
      const nx = (event.clientX - cx) / (rect.width / 2);
      const ny = (event.clientY - cy) / (rect.height / 2);
      pointer.inside = nx * nx + ny * ny < 1.15;
      start();
    };

    const onBlink = () => {
      blink.start = performance.now();
      nextBlink = performance.now() + 2400 + Math.random() * 4200;
      start();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener("click", onBlink);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    intersection.observe(container);

    resize();

    return {
      update(next) {
        Object.assign(props, next || {});
        colors.uSclera = parseColor(props.sclera);
        colors.uIris = parseColor(props.iris);
        colors.uIrisDeep = parseColor(props.irisDeep);
        colors.uIrisLight = parseColor(props.irisLight);
        colors.uLash = parseColor(props.lash);
        colors.uSkin = parseColor(props.skin);
        colors.uSkinDeep = parseColor(props.skinDeep);
        draw(performance.now());
      },
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        observer.disconnect();
        intersection.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener("click", onBlink);
        gl.deleteProgram(program);
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  window.createEye = createEye;
})();
