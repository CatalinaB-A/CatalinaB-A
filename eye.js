/* Ojo ilustrado en WebGL2: párpados, pestañeo, iris café y pupila reactiva. */
(function () {
  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uBlink;
uniform float uPupil;
uniform vec3 uSclera;
uniform vec3 uIris;
uniform vec3 uIrisDeep;
uniform vec3 uIrisLight;
uniform vec3 uLash;

out vec4 outColor;

float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (min(uRes.x, uRes.y) * 1.12);

  float ca = cos(0.055);
  float sa = sin(0.055);
  p = mat2(ca, -sa, sa, ca) * p;

  float w = 0.34;
  float n = clamp(p.x / w, -1.0, 1.0);
  float shape = max(1.0 - n * n, 0.0);
  float upperOpen = 0.134 * pow(shape, 0.60);
  float lowerOpen = -0.100 * pow(shape, 0.85);
  float b = smoothstep(0.0, 1.0, uBlink);
  float upper = mix(upperOpen, lowerOpen + 0.009, b);
  float lower = mix(lowerOpen, lowerOpen + 0.026, b * 0.45);

  float inset = min(min(upper - p.y, p.y - lower), (w - abs(p.x)) * 0.7);
  float inside = smoothstep(-0.0015, 0.0015, inset);

  float vign = smoothstep(0.04, 0.22, length(vec2(p.x * 0.85, p.y * 1.35)));
  vec3 sclera = mix(uSclera, uSclera * 0.9, vign);
  sclera = mix(sclera, vec3(0.80, 0.54, 0.55), smoothstep(w * 0.58, w, abs(p.x)) * 0.2);
  sclera *= 0.9 + 0.1 * smoothstep(0.0, 0.11, upper - p.y);

  vec2 ic = vec2(0.0, -0.004);
  float ir = 0.103;
  float di = length(p - ic);
  float ang = atan(p.y - ic.y, p.x - ic.x);
  float fiber = 0.5 + 0.5 * sin(ang * 92.0 + 3.0 * sin(ang * 11.0));
  float radial = smoothstep(ir * 0.2, ir, di);
  vec3 iris = mix(uIrisLight, uIrisDeep, radial * 0.85 + 0.15 * fiber);
  iris = mix(iris, uIris, 0.35);
  iris = mix(iris, uIrisDeep * 0.55, smoothstep(ir * 0.82, ir, di));
  float irisMask = smoothstep(ir, ir - 0.003, di) * inside;

  float pr = 0.037 * uPupil;
  float pupil = smoothstep(pr, pr - 0.0025, di) * inside;

  vec2 h1 = ic + vec2(-0.040, 0.049);
  vec2 h2 = ic + vec2(0.044, -0.031);
  float g1 = smoothstep(0.030, 0.0, length((p - h1) * vec2(1.0, 0.85)));
  float g2 = smoothstep(0.011, 0.0, length(p - h2));
  float glint = clamp(g1 * 0.95 + g2 * 0.7, 0.0, 1.0) * inside;

  vec3 col = sclera;
  col = mix(col, iris, irisMask);
  col = mix(col, uIrisDeep * 0.16, pupil);
  col = mix(col, vec3(1.0, 0.97, 0.93), glint);
  float alpha = inside;

  float lid = smoothstep(0.0060, 0.0016, abs(p.y - upper)) * smoothstep(1.0, 0.92, abs(n));
  col = mix(col, uLash, lid);
  alpha = max(alpha, lid);

  float water = smoothstep(0.0045, 0.0, abs(p.y - lower)) * inside * 0.5;
  col = mix(col, vec3(1.0, 0.91, 0.89), water);

  float lash = 0.0;
  for (int i = 0; i < 25; i++) {
    float fi = float(i) / 24.0;
    float x = mix(-w * 0.97, w * 0.97, fi);
    float sx = clamp(x / w, -1.0, 1.0);
    float sh = max(1.0 - sx * sx, 0.0);
    float byOpen = 0.134 * pow(sh, 0.60);
    float by = mix(byOpen, -0.100 * pow(sh, 0.85) + 0.009, b);
    float edge = smoothstep(0.02, 0.22, by);
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

  float lowLine = smoothstep(0.0035, 0.0008, abs(p.y - lower)) * smoothstep(1.0, 0.9, abs(n)) * 0.32;
  col = mix(col, uLash, lowLine);
  alpha = max(alpha, lowLine);

  vec2 shadowP = vec2(p.x * 0.72, (p.y + 0.15) * 3.0);
  float shadow = smoothstep(0.42, 0.0, length(shadowP)) * 0.16;
  col = mix(col, vec3(0.22, 0.09, 0.09), shadow);
  alpha = max(alpha, shadow * 0.7);

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
    probe.fillStyle = value;
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
      sclera: '#f7efeb',
      iris: '#7a4a26',
      irisDeep: '#38200f',
      irisLight: '#b9824c',
      lash: '#3a0f1e',
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
      uLash: parseColor(props.lash)
    };

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const pointer = { inside: false };
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
      const target = pointer.inside ? 1.34 : 1;
      pupil.value += (target - pupil.value) * 0.14;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(uniforms.uBlink, reduced ? 0 : blinkValue(now));
      gl.uniform1f(uniforms.uPupil, pupil.value);
      gl.uniform3fv(uniforms.uSclera, colors.uSclera);
      gl.uniform3fv(uniforms.uIris, colors.uIris);
      gl.uniform3fv(uniforms.uIrisDeep, colors.uIrisDeep);
      gl.uniform3fv(uniforms.uIrisLight, colors.uIrisLight);
      gl.uniform3fv(uniforms.uLash, colors.uLash);
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
      if (!reduced || blink.start >= 0 || Math.abs(pupil.value - (pointer.inside ? 1.34 : 1)) > 0.002) {
        raf = requestAnimationFrame(frame);
      }
    };

    const start = () => {
      if (!raf && visible && alive) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const onPointerMove = event => {
      const rect = canvas.getBoundingClientRect();
      const nx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ny = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      pointer.inside = nx * nx + ny * ny < 1.15;
      start();
    };

    const onBlink = () => {
      blink.start = performance.now();
      nextBlink = performance.now() + 2400 + Math.random() * 4200;
      start();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('click', onBlink);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    intersection.observe(container);

    resize();
    start();

    return {
      update(next) {
        Object.assign(props, next || {});
        colors.uSclera = parseColor(props.sclera);
        colors.uIris = parseColor(props.iris);
        colors.uIrisDeep = parseColor(props.irisDeep);
        colors.uIrisLight = parseColor(props.irisLight);
        colors.uLash = parseColor(props.lash);
        draw(performance.now());
        start();
      },
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        observer.disconnect();
        intersection.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('click', onBlink);
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
