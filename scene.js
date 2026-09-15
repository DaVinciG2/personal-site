import './tapes.js';
import { syncMobius } from './mobius.js';
const status = document.querySelector('.status');

// Wait for GPU completion without blocking the main thread with gl.finish().
function waitForSceneGPU(gl) {
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) return Promise.reject(new Error('Could not prepare the cloud view.'));
  gl.flush();
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + 10000;
    function poll() {
      const state = gl.clientWaitSync(fence, 0, 0);
      if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) {
        gl.deleteSync(fence);
        resolve();
      } else if (state === gl.WAIT_FAILED || gl.isContextLost() || performance.now() > deadline) {
        gl.deleteSync(fence);
        reject(new Error('The cloud view could not finish its first frame.'));
      } else setTimeout(poll, 16);
    }
    poll();
  });
}

async function startScene(options = {}) {
  const cloudsOnly = !!options.cloudsOnly;
  const canvas = options.canvas || document.querySelector('.scene-landscape canvas');
  const surface = options.surface || document.querySelector('.scene-landscape');
  const handleError = cloudsOnly ? error => {
    canvas.dataset.ready = 'false';
    console.warn('Window cloud view unavailable:', error);
  } : showError;
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false });
  if (!gl) throw new Error('This landscape requires a browser with WebGL 2 support.');

  const sources = await Promise.all(['buffer1.txt', 'image.txt'].map(async (file) => {
    const response = await fetch(new URL(file, import.meta.url));
    if (!response.ok) throw new Error(`Could not load ${file}. Please reload to try again.`);
    return response.text();
  }));
  const vertex = `#version 300 es
  void main() {
    vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
  }`;
  const fragment = (source) => `#version 300 es
  precision highp float;
  uniform vec3 iResolution;
  uniform float iTime;
  uniform sampler2D iChannel0;
  uniform sampler2D iChannel1;
  out vec4 outputColor;
  ${source}
  void main() { mainImage(outputColor, gl_FragCoord.xy); }`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${log}`);
    }
    return shader;
  }

  function program(source) {
    const result = gl.createProgram();
    const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment(source))];
    shaders.forEach((shader) => gl.attachShader(result, shader));
    gl.linkProgram(result);
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
    return { program: result, uniforms: Object.fromEntries(['iResolution', 'iTime', 'iChannel0', 'iChannel1'].map((name) => [name, gl.getUniformLocation(result, name)])) };
  }

  const mode = cloudsOnly ? '#define CLOUDS_ONLY\n' : '';
  const bufferPass = program(mode + sources[0]);
  const imagePass = program(mode + sources[1]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // One new 1024² random texture per scene load. Never regenerate it per frame.
  const noiseSize = 1024;
  const noiseBytes = new Uint8Array(noiseSize * noiseSize * 4);
  for (let offset = 0; offset < noiseBytes.length; offset += 65536) {
    crypto.getRandomValues(noiseBytes.subarray(offset, offset + 65536));
  }
  const noiseTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, noiseSize, noiseSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseBytes);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  let targets = [];
  let readIndex = 0;
  function makeTarget(width, height) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Could not create the landscape render buffer.');
    gl.clearColor(1, 237 / 255, 225 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, framebuffer };
  }

  function resize() {
    const bounds = surface.getBoundingClientRect();
    // Bound GPU cost for this texture-heavy shader, retaining the viewport aspect ratio.
    const scale = cloudsOnly
      ? Math.min(devicePixelRatio || 1, 1, 1000 / bounds.width, 700 / bounds.height)
      : Math.min(devicePixelRatio || 1, 1.5, 1600 / bounds.width, 1000 / bounds.height);
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (canvas.width === width && canvas.height === height && targets.length) return;
    canvas.width = width;
    canvas.height = height;
    targets.forEach(({ texture, framebuffer }) => {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
    });
    targets = [makeTarget(width, height), makeTarget(width, height)];
    readIndex = 0;
  }

  function draw(pass, framebuffer, channel0, channel1, time) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(pass.program);
    gl.uniform3f(pass.uniforms.iResolution, canvas.width, canvas.height, 1);
    gl.uniform1f(pass.uniforms.iTime, time);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, channel0);
    gl.uniform1i(pass.uniforms.iChannel0, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, channel1);
    gl.uniform1i(pass.uniforms.iChannel1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let visible = false;
  let frame = 0;
  let elapsed = 0;
  let previousTime = null;
  let lost = false;
  let firstFrameSubmitted = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });

  function render(now) {
    frame = 0;
    if (lost) return;
    try {
      resize();
      if (previousTime !== null) elapsed += Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      const writeIndex = 1 - readIndex;
      draw(bufferPass, targets[writeIndex].framebuffer, noiseTexture, targets[readIndex].texture, elapsed);
      draw(imagePass, null, targets[writeIndex].texture, null, elapsed);
      readIndex = writeIndex;
      if (!cloudsOnly) status.hidden = true;
      if (!firstFrameSubmitted) {
        firstFrameSubmitted = true;
        waitForSceneGPU(gl).then(() => {
          canvas.dataset.ready = 'true';
          resolveReady();
        }, error => { rejectReady(error); handleError(error); });
      }
      if (visible && !document.hidden) frame = requestAnimationFrame(render);
    } catch (error) { rejectReady(error); handleError(error); }
  }
  function schedule() {
    cancelAnimationFrame(frame);
    previousTime = null;
    if (!lost && visible && !document.hidden) frame = requestAnimationFrame(render);
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio > 0; schedule(); }, { threshold: .001 }).observe(surface);
  new ResizeObserver(schedule).observe(surface);
  document.addEventListener('visibilitychange', schedule);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    const error = new Error('The graphics connection was interrupted. Reload to restore the landscape.');
    rejectReady(error);
    handleError(error);
  });
  return ready;
}

function showError(error) {
  console.error(error);
  status.textContent = error.message;
  status.hidden = false;
}
startScene().catch(showError);

// Allocate the second view only when its scene is first visited.
const windowView = document.querySelector('.archive-window-view');
const windowCanvas = windowView.querySelector('canvas');
let windowReady;
function prepareWindowView() {
  // Route changes and the visibility observer share one initialization.
  return windowReady ??= startScene({ canvas: windowCanvas, surface: windowView, cloudsOnly: true }).catch(error => {
    windowCanvas.dataset.ready = 'false';
    console.warn('Window cloud view unavailable:', error);
    // Retain the CSS window background and allow navigation after a GPU failure.
  });
}
const windowStart = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  windowStart.disconnect();
  prepareWindowView();
});
windowStart.observe(windowView);


// Independent movable canvases share one offscreen FBM renderer to avoid context limits.
class PartingClouds {
  constructor(layers) {
    this.layers = layers;
    this.interacted = false;
    this.renderCanvas = document.createElement('canvas');
    this.onFirstInteraction = event => {
      if (event.type === 'pointermove' && event.movementX === 0 && event.movementY === 0) return;
      this.interacted = true;
      for (const type of ['wheel', 'pointerdown', 'pointermove', 'keydown']) window.removeEventListener(type, this.onFirstInteraction);
      queueScrollScene();
    };
    for (const type of ['wheel', 'pointerdown', 'pointermove', 'keydown']) window.addEventListener(type, this.onFirstInteraction, { passive: true });
    let ambientIndex = 0;
    let coverIndex = 0;
    // Independent positions and varied sizes remove the previous row/column pattern.
    layers.forEach((layer, index) => {
      if (layer.dataset.coverCloud === 'true') {
        // Fixed baseline positions from the three browser annotations.
        const placement = [
          { x: 26, width: 24, y: -5, height: 22, seed: 90 },
          { x: 15, width: 33, y: 6, height: 24, seed: 91 },
          { x: 34, width: 43, y: 0, height: 22, seed: 92 }
        ][coverIndex++];
        layer.dataset.introCloud = 'false';
        layer.style.setProperty('--cloud-width', placement.width + '%');
        layer.style.setProperty('--cloud-x', placement.x + '%');
        layer.style.setProperty('--cloud-offset-y', placement.y + 'vh');
        layer.style.setProperty('--cloud-height', placement.height + 'vh');
        layer.style.setProperty('--cloud-duration', '1600ms');
        layer.querySelector('canvas').dataset.seed = String(placement.seed);
        return;
      }
      const intro = ambientIndex++ < 9;
      const height = 16 + Math.random() * 17;
      const top = intro ? 2 + Math.random() * (46 - height) : 52 + Math.random() * (76 - height);
      layer.dataset.introCloud = String(intro);
      layer.style.setProperty('--cloud-top', top + 'vh');
      layer.style.setProperty('--cloud-height', height + 'vh');
      layer.style.setProperty('--cloud-width', (21 + Math.random() * 23) + 'vw');
      layer.style.setProperty('--cloud-x', (-6 + Math.random() * 80) + '%');
      layer.style.setProperty('--cloud-duration', (1250 + Math.random() * 550) + 'ms');
      layer.querySelector('canvas').dataset.seed = String(Math.random() * 100);
    });
    this.banks = layers.flatMap(layer => [...layer.querySelectorAll('canvas')].map(canvas => ({
      canvas, layer, visible: false, departing: false, disposed: false, gpu: null, lost: false,
      floatPhase: Math.random() * Math.PI * 2, floatPeriod: 6500 + Math.random() * 5500,
      floatAmplitude: 2 + Math.random() * 4, breathAmplitude: .02 + Math.random() * .005
    })));
    this.frame = 0;
    this.lastDraw = -Infinity;
    this.closed = false;
    this.schedule = this.schedule.bind(this);
    this.tick = this.tick.bind(this);
    this.visibilityChanged = () => {
      if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; }
      else this.schedule();
    };
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const bank = this.banks.find(bank => bank.canvas === entry.target);
        if (bank) {
          bank.visible = entry.isIntersecting && entry.intersectionRatio > 0;
          if (bank.idleMotion) bank.visible ? bank.idleMotion.play() : bank.idleMotion.pause();
        }
      }
      this.schedule();
    }, { threshold: .001 });
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const bank = this.banks.find(bank => bank.canvas === entry.target);
        if (bank) bank.renderedWidth = null;
      }
      this.schedule();
    });
    this.banks.forEach(bank => {
      this.observer.observe(bank.canvas);
      this.resizeObserver.observe(bank.canvas);
      bank.onLost = event => {
        event.preventDefault();
        bank.lost = true;
        this.schedule();
      };
      bank.onRestored = () => { bank.lost = false; bank.gpu = null; this.schedule(); };
      bank.canvas.addEventListener('webglcontextlost', bank.onLost);
      bank.canvas.addEventListener('webglcontextrestored', bank.onRestored);
    });
    document.addEventListener('visibilitychange', this.visibilityChanged);
    window.addEventListener('resize', this.schedule);
    // Source is shared with the landscape: same palette, quintic noise and 0.7 FBM falloff.
    this.load();
  }
  async load() {
    try {
      const response = await fetch(new URL('buffer1.txt', import.meta.url));
      if (!response.ok) throw new Error('Could not load cloud FBM source.');
      const source = await response.text();
      const end = source.indexOf('float fbm2(');
      if (end < 0) throw new Error('Cloud FBM source is missing.');
      if (this.closed) return;
      this.source = source.slice(0, end);
      this.noise = new Uint8Array(1024 * 1024);
      for (let i = 0; i < this.noise.length; i += 65536) crypto.getRandomValues(this.noise.subarray(i, i + 65536));
      this.schedule();
    } catch (error) {
      console.error(error);
      this.failed = true;
      this.schedule();
    }
  }
  part(layer) {
    if (layer.classList.contains('is-parted')) return;
    // Draw the first frame before starting the transform; never slide an empty canvas.
    if (!this.source && !this.failed) return;
    for (const bank of this.banks.filter(bank => bank.layer === layer && !bank.disposed)) {
      if (!bank.renderedWidth && !bank.failed) {
        bank.pendingDeparture = true;
        this.schedule();
        return;
      }
      const restingTransform = getComputedStyle(bank.canvas).transform;
      bank.canvas.style.transform = restingTransform;
      bank.idleMotion?.cancel();
      bank.idleMotion = null;
      bank.departing = true;
      const bounds = bank.canvas.getBoundingClientRect();
      const distance = bank.canvas.classList.contains('cloud-left')
        ? -(bounds.right + 32)
        : document.documentElement.clientWidth - bounds.left + 32;
      const duration = parseFloat(getComputedStyle(layer).getPropertyValue('--cloud-duration')) || 1300;
      bank.motionFinished = false;
      bank.motion = bank.canvas.animate([
        { transform: restingTransform === 'none' ? 'translateY(0px) scale(1)' : restingTransform },
        { transform: 'translateX(' + distance + 'px) ' + (restingTransform === 'none' ? '' : restingTransform) }
      ], { duration, easing: 'cubic-bezier(.45,0,.15,1)', fill: 'forwards' });
      bank.motion.finished.then(() => {
        bank.motionFinished = true;
        this.schedule();
      }).catch(() => {});
    }
    layer.classList.add('is-parted');
    this.schedule();
  }
  createGPU(bank) {
    const gl = this.renderCanvas.getContext('webgl2', { preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: false, antialias: false, depth: false });
    if (!gl) throw new Error('Cloud canvas requires WebGL 2.');
    const gpu = this.gpu = { gl, shaders: [] };
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gpu.shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`);
    const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      uniform sampler2D iChannel0;
      uniform vec2 resolution;
      uniform float time;
      uniform float seed;
      out vec4 color;
      ${this.source}
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution;
        vec2 p = vec2(uv.x * resolution.x / resolution.y, uv.y) * 2.6;
        p += vec2(seed + time * .035, seed * .37);
        float n = fbm(p, 6);
        float detail = fbm(p * 1.8 + 13.0, 5);
        // A cluster of overlapping billows, distorted by the existing FBM.
        vec2 q = (uv - .5) * vec2(2.0, 2.3);
        float warp = (n - .5) * .26;
        float radius = min(length((q - vec2(-.32, -.04)) / vec2(.58, .64)),
                           length((q - vec2(.22, .06)) / vec2(.65, .54)));
        radius = min(radius, length((q - vec2(-.04, .23)) / vec2(.47, .63)));
        float silhouette = 1.0 - radius + warp;
        // Normalized distance to the irregular cloud edge, not animation progress.
        float edgeDistance = clamp(max(radius - warp, length(q) / 1.05), 0.0, 1.0);
        // Only a gentle 0-8% transparency rise inside; most fade occurs at 0.8-1.0.
        float transparency = .08 * edgeDistance * edgeDistance
                           + .92 * smoothstep(.8, 1.0, edgeDistance);
        float alpha = 1.0 - transparency;
        vec3 shade = mix(PEACH, BUTTER, smoothstep(.28, .65, n));
        shade = mix(shade, IVORY, smoothstep(.4, .72, detail) * .85);
        shade = mix(shade, CREAM, smoothstep(.015, .12, silhouette) * .2);
        color = vec4(shade, alpha * .94);
      }`);
    gpu.program = gl.createProgram();
    gl.attachShader(gpu.program, vertex);
    gl.attachShader(gpu.program, fragment);
    gl.linkProgram(gpu.program);
    if (!gl.getProgramParameter(gpu.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(gpu.program));
    gpu.shaders.forEach(shader => { gl.detachShader(gpu.program, shader); gl.deleteShader(shader); });
    gpu.shaders = [];
    gpu.vao = gl.createVertexArray();
    gl.bindVertexArray(gpu.vao);
    gpu.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1024, 1024, 0, gl.RED, gl.UNSIGNED_BYTE, this.noise);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gpu.uniforms = Object.fromEntries(['iChannel0', 'resolution', 'time', 'seed'].map(name => [name, gl.getUniformLocation(gpu.program, name)]));
    return gpu;
  }
  draw(bank, now) {
    if (bank.disposed || bank.lost || bank.failed || !this.source) return;
    try {
      const gpu = this.gpu || this.createGPU(bank);
      const { gl, uniforms } = gpu;
      const width = bank.canvas.clientWidth, height = bank.canvas.clientHeight;
      if (!width || !height) return;
      const scale = Math.min(devicePixelRatio || 1, 1, 420 / width, 220 / height);
      const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
      if (bank.renderedWidth === w && bank.renderedHeight === h) return;
      bank.canvas.width = w; bank.canvas.height = h;
      this.renderCanvas.width = w; this.renderCanvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.useProgram(gpu.program);
      gl.bindVertexArray(gpu.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
      gl.uniform1i(uniforms.iChannel0, 0);
      gl.uniform2f(uniforms.resolution, w, h);
      gl.uniform1f(uniforms.time, 0);
      gl.uniform1f(uniforms.seed, Number(bank.canvas.dataset.seed));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      bank.context = bank.context || bank.canvas.getContext('2d');
      bank.context.clearRect(0, 0, w, h);
      bank.context.drawImage(this.renderCanvas, 0, 0);
      bank.renderedWidth = w; bank.renderedHeight = h;
      if (!bank.idleMotion && !bank.departing) {
        const frames = Array.from({ length: 33 }, (_, i) => {
          const phase = i / 32 * Math.PI * 2 + bank.floatPhase;
          return { transform: 'translateY(' + Math.sin(phase) * bank.floatAmplitude + 'vh) scale(' + (1 + Math.sin(phase + bank.floatPhase) * bank.breathAmplitude) + ')', offset: i / 32 };
        });
        bank.idleMotion = bank.canvas.animate(frames, { duration: bank.floatPeriod, iterations: Infinity, easing: 'linear' });
      }
    } catch (error) { bank.failed = true; console.error(error); }
  }
  schedule() {
    if (!this.closed && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.tick);
  }
  tick(now) {
    this.frame = 0;
    if (this.closed || document.hidden) return;
    // Rasterize at most one visible cloud per frame; settled clouds need no JS loop.
    let rendered = false;
    for (const bank of this.banks) {
      if (bank.disposed) continue;
      if (bank.departing && bank.motionFinished) {
        const bounds = bank.canvas.getBoundingClientRect();
        if (bounds.width > 0 && (bounds.right <= 0 || bounds.left >= document.documentElement.clientWidth)) {
          this.dispose(bank);
          continue;
        }
      }
      if (!rendered && this.source && bank.visible && !bank.failed && !bank.renderedWidth) {
        this.draw(bank, now);
        rendered = true;
        queueScrollScene();
      }
    }
    if (this.banks.every(bank => bank.disposed)) { this.close(); return; }
    if (this.source && this.banks.some(bank => !bank.disposed && bank.visible && !bank.failed && !bank.renderedWidth)) this.schedule();
  }

  dispose(bank) {
    if (bank.disposed) return;
    bank.disposed = true;
    const { canvas, gpu } = bank;
    this.observer.unobserve(canvas);
    this.resizeObserver.unobserve(canvas);
    canvas.removeEventListener('webglcontextlost', bank.onLost);
    canvas.removeEventListener('webglcontextrestored', bank.onRestored);
    if (gpu) {
      const { gl } = gpu;
      gpu.shaders.forEach(shader => gl.deleteShader(shader));
      if (gpu.texture) gl.deleteTexture(gpu.texture);
      if (gpu.vao) gl.deleteVertexArray(gpu.vao);
      if (gpu.program) gl.deleteProgram(gpu.program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    bank.idleMotion?.cancel();
    bank.idleMotion = null;
    bank.motion?.cancel();
    bank.motion = null;
    canvas.width = canvas.height = 1;
    canvas.remove();
    bank.gpu = null;
    bank.context = null;
    bank.canvas = null;
  }
  close() {
    this.closed = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    window.removeEventListener('resize', this.schedule);
    if (this.gpu) {
      const { gl, texture, vao, program, shaders } = this.gpu;
      shaders.forEach(shader => gl.deleteShader(shader));
      if (texture) gl.deleteTexture(texture);
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      this.gpu = null;
    }
    this.renderCanvas.width = this.renderCanvas.height = 1;
    for (const type of ['wheel', 'pointerdown', 'pointermove', 'keydown']) window.removeEventListener(type, this.onFirstInteraction);
    this.noise = null;
    this.source = null;
  }
}

// Page interactions remain independent of WebGL availability.
const introQuote = document.querySelector('.quote-intro');
const introCopy = document.querySelector('.intro-copy');
const cloudLayers = [...document.querySelectorAll('.cloud-layer')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const partingClouds = new PartingClouds(cloudLayers);
const clamp01 = value => Math.max(0, Math.min(1, value));
let scrollFrame = 0;
function updateScrollScene() {
  scrollFrame = 0;
  const progress = window.scrollY / Math.max(1, window.innerHeight);
  introCopy.style.opacity = 1 - clamp01(progress / .65);
  // Trigger once per layer; Web Animations owns the time-based movement.
  // The stationary wrapper supplies the y anchor even while its banks move.
  const midpoint = window.innerHeight / 2;
  cloudLayers.forEach(layer => {
    if (layer.classList.contains('is-parted')) return;
    if (layer.dataset.introCloud === 'true') {
      if (partingClouds.interacted) partingClouds.part(layer);
      return;
    }
    const anchor = layer.dataset.coverCloud === 'true' ? layer.closest('.landscape-message') : layer;
    const bounds = anchor.getBoundingClientRect();
    if (bounds.height > 0 && bounds.top + bounds.height / 2 <= midpoint + 1) {
      partingClouds.part(layer);
    }
  });
}
function queueScrollScene() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollScene);
}
window.addEventListener('scroll', queueScrollScene, { passive: true });
window.addEventListener('resize', queueScrollScene);
updateScrollScene();

const aboutButton = document.querySelector('.about-button');
const aboutDialog = document.querySelector('.about-dialog');
const aboutCard = document.querySelector('.about-card');
let closingAbout = false;
let savedOverflow = '';
let aboutMotion = null;
function buttonToCardTransform() {
  const button = aboutButton.getBoundingClientRect();
  const card = aboutCard.getBoundingClientRect();
  return 'translate(' + (button.left - card.left) + 'px,' + (button.top - card.top) + 'px) scale(' + button.width / card.width + ',' + button.height / card.height + ')';
}
aboutButton.addEventListener('click', async () => {
  if (aboutDialog.open) return;
  savedOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  aboutDialog.showModal();
  const from = buttonToCardTransform();
  document.body.classList.add('about-open');
  aboutMotion = aboutCard.animate([
    { transform: from, borderRadius: '999px' },
    { transform: 'translate(0,0) scale(1)', borderRadius: '28px' }
  ], { duration: 650, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'both' });
  try { await aboutMotion.finished; } catch {}
  if (!closingAbout) { aboutMotion?.cancel(); aboutMotion = null; }
});
async function closeAbout() {
  if (closingAbout || !aboutDialog.open) return;
  closingAbout = true;
  const from = getComputedStyle(aboutCard).transform;
  aboutMotion?.cancel();
  const to = buttonToCardTransform();
  aboutMotion = aboutCard.animate([
    { transform: from === 'none' ? 'translate(0,0) scale(1)' : from, borderRadius: '28px' },
    { transform: to, borderRadius: '999px' }
  ], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  try { await aboutMotion.finished; } catch {}
  aboutDialog.close();
  aboutMotion?.cancel(); aboutMotion = null;
  document.body.classList.remove('about-open');
  document.body.style.overflow = savedOverflow;
  closingAbout = false;
  aboutButton.focus({ preventScroll: true });
}
document.querySelector('.close-about').addEventListener('click', closeAbout);
aboutDialog.addEventListener('click', event => { if (event.target === aboutDialog) closeAbout(); });
aboutDialog.addEventListener('cancel', event => { event.preventDefault(); closeAbout(); });

const firstScene = document.querySelector('.scene');
const secondScene = document.querySelector('.scene-two');
const thirdScene = document.querySelector('.scene-three');
const sceneNames = { scene1: 'The Landscape Within', scene2: 'The Carriage of Stories', scene3: 'The Engine Room' };
const pageSceneButtons = [];
firstScene.setAttribute('aria-label', sceneNames.scene1);
for (const [surface, previous, next] of [[secondScene, 'scene1', 'scene3'], [thirdScene, 'scene2', 'scene1']]) {
  const nav = document.createElement('nav');
  nav.className = 'page-scene-nav'; nav.setAttribute('aria-label', 'Continue the journey');
  for (const [destination, direction] of [[previous, 'previous'], [next, 'next']]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'page-scene-link theme-button';
    button.dataset.destination = destination;
    button.setAttribute('aria-label', (direction === 'previous' ? 'Previous: ' : 'Next: ') + sceneNames[destination]);
    button.innerHTML = '<span class="page-scene-arrow" aria-hidden="true">' + (direction === 'previous' ? '←' : '→') + '</span><span><small>' + (direction === 'previous' ? 'PREVIOUS' : next === 'scene1' ? 'BACK TO THE BEGINNING' : 'NEXT CHAPTER') + '</small>' + sceneNames[destination] + '</span>';
    button.addEventListener('click', () => navigateScene(destination)); nav.append(button); pageSceneButtons.push(button);
  }
  surface.append(nav);
  surface.setAttribute('aria-label', sceneNames[surface === firstScene ? 'scene1' : surface === secondScene ? 'scene2' : 'scene3']);
}

const nextButton = document.querySelector('.next-scene');
const transition = document.querySelector('.cloud-transition');
const sceneNav = document.querySelector('.scene-nav');
const sceneNavToggle = document.querySelector('.scene-nav-toggle');
const sceneNavPanel = document.querySelector('.scene-nav-panel');
const sceneChoices = [...sceneNavPanel.querySelectorAll('[data-scene]')];
function closeSceneNav(restoreFocus = false) {
  sceneNavPanel.hidden = true;
  sceneNavToggle.setAttribute('aria-expanded', 'false');
  if (restoreFocus) sceneNavToggle.focus();
}
sceneNavToggle.addEventListener('click', () => {
  const open = sceneNavPanel.hidden;
  sceneNavPanel.hidden = !open;
  sceneNavToggle.setAttribute('aria-expanded', String(open));
  if (open) sceneChoices[0].focus();
});
document.addEventListener('pointerdown', event => { if (!sceneNav.contains(event.target)) closeSceneNav(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sceneNavPanel.hidden) closeSceneNav(true); });
sceneChoices.forEach(button => button.addEventListener('click', () => navigateScene(button.dataset.scene)));
let navigating = false;
function applyRoute() {
  const isSceneTwo = location.hash === '#scene2';
  const isSceneThree = location.hash === '#scene3';
  firstScene.hidden = isSceneTwo || isSceneThree;
  thirdScene.hidden = !isSceneThree;
  syncMobius(isSceneThree);
  secondScene.hidden = !isSceneTwo;
  aboutButton.hidden = false;
  sceneChoices.forEach(button => {
    if (button.dataset.scene === (isSceneThree ? 'scene3' : isSceneTwo ? 'scene2' : 'scene1')) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  closeSceneNav();
  document.title = sceneNames[isSceneThree ? 'scene3' : isSceneTwo ? 'scene2' : 'scene1'] + ' — Zack Xu';
  if (isSceneThree) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    thirdScene.querySelector('h1').focus({ preventScroll: true });
  }
  if (isSceneTwo) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    secondScene.querySelector('h1').focus({ preventScroll: true });
  }
  if (!isSceneTwo && !isSceneThree && location.hash === '#scene1') {
    window.scrollTo({ top: 0, behavior: 'instant' });
    introQuote.focus({ preventScroll: true });
  }
  queueScrollScene();
}
window.addEventListener('hashchange', applyRoute);
applyRoute();
function paintTransitionClouds(canvas) {
  const width = window.innerWidth * 2.4, height = window.innerHeight * 1.4;
  const scale = Math.min(1, 2200 / width, 1100 / height);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const w = window.innerWidth;
  // An opaque cloud interior guarantees complete coverage before the route changes.
  const interior = ctx.createLinearGradient(0, 0, w, height);
  interior.addColorStop(0, '#FFEDE1'); interior.addColorStop(.5, '#F6DFA3'); interior.addColorStop(1, '#F7CDB8');
  ctx.fillStyle = interior; ctx.fillRect(0,0,w * 1.12,height);
  const palette = [['#F7CDB8','#E9A8A0'], ['#F6DFA3','#E7C58F'], ['#FFEDE1','#F7CDB8'], ['#FFF4CC','#F6DFA3']];
  // Four overlapping banks, each built from giant irregular billows.
  for (let layer = 0; layer < 4; layer++) {
    for (let i = 0; i < 6; i++) {
      const x = w * (1.53 - layer * .31 + Math.sin(i * 2.1 + layer) * .12);
      const y = height * (i / 5);
      const rx = w * (.48 + Math.sin(i + layer) * .06);
      const ry = height * (.24 + Math.cos(i * 1.7) * .03);
      const gradient = ctx.createRadialGradient(x-rx*.18,y-ry*.2,0,x,y,Math.max(rx,ry));
      gradient.addColorStop(0,palette[layer][0]); gradient.addColorStop(1,palette[layer][1]);
      ctx.fillStyle = gradient;
      ctx.shadowColor = palette[layer][0]; ctx.shadowBlur = 14 * scale;
      ctx.beginPath();
      for (let p=0;p<=120;p++) {
        const angle = p / 120 * Math.PI * 2;
        const ripple = 1 + .045*Math.sin(angle*7+i+layer) + .025*Math.sin(angle*13+layer*2);
        const px=x+Math.cos(angle)*rx*ripple, py=y+Math.sin(angle)*ry*ripple;
        if(p===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.closePath();ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  // Feather the trailing edge so the new scene emerges through mist.
  ctx.globalCompositeOperation = 'destination-in';
  const edge = ctx.createLinearGradient(0, 0, w * .16, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = edge; ctx.fillRect(0,0,width,height);
  ctx.globalCompositeOperation = 'source-over';
}
async function navigateScene(destination) {
  if (navigating || !['scene1', 'scene2', 'scene3'].includes(destination)) return;
  closeSceneNav();
  sceneNavToggle.disabled = true;
  navigating = true;
  nextButton.disabled = true;
  pageSceneButtons.forEach(button => button.disabled = true);
  const curtain = document.createElement('canvas');
  curtain.className = 'cloud-curtain';
  transition.append(curtain);
  const oldOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const resizeCurtain = () => paintTransitionClouds(curtain);
  let cover;
  let reveal;
  try {
    paintTransitionClouds(curtain);
    window.addEventListener('resize', resizeCurtain);
    transition.classList.add('active');
    cover = curtain.animate([
      { transform: 'translateX(-100%)', offset: 0, easing: 'cubic-bezier(.4,0,.2,1)' },
      { transform: 'translateX(-10%)', offset: .9 },
      { transform: 'translateX(-10%)', offset: 1 }
    ], { duration: 4400, fill: 'forwards' });
    await cover.finished;
    location.hash = destination;
    applyRoute();
    if (destination === 'scene2') await prepareWindowView();
    // Allow layout, carousel observers and the first GPU frame to reach the
    // compositor while the curtain still fully covers the new scene.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Keep the same cloud canvas above the new scene until its entrance completes.
    reveal = curtain.animate([
      { transform: 'translateX(-10%)', opacity: 1 },
      { transform: 'translateX(50%)', opacity: 1 }
    ], { duration: 2600, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    await reveal.finished;
  } finally {
    window.removeEventListener('resize', resizeCurtain);
    transition.classList.remove('active');
    cover?.cancel();
    reveal?.cancel();
    curtain.width = curtain.height = 1;
    curtain.remove();
    document.body.style.overflow = oldOverflow;
    navigating = false;
    nextButton.disabled = false;
    pageSceneButtons.forEach(button => button.disabled = false);
    sceneNavToggle.disabled = false;
  }
}
nextButton.addEventListener('click', () => navigateScene('scene2'));

// Smooth wheel scrolling for the document and reading panels. Scene-specific
// gestures consume their own wheel events before this bubbling listener runs.
{
  let scrolling = null, scrollFrame = 0;
  function stopSmoothScroll() {
    cancelAnimationFrame(scrollFrame); scrollFrame = 0; scrolling = null;
  }
  function scrollSurface(target) {
    for (let node = target instanceof Element ? target : target.parentElement; node && node !== document.body; node = node.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
    }
    if (document.querySelector('dialog[open]') || getComputedStyle(document.body).overflowY === 'hidden') return null;
    const root = document.scrollingElement;
    return root.scrollHeight > root.clientHeight + 1 ? root : null;
  }
  function animateScroll(now) {
    scrollFrame = 0;
    const state = scrolling;
    if (!state || !state.element.isConnected || !state.element.getClientRects().length || document.hidden) { stopSmoothScroll(); return; }
    const dt = Math.min((now - state.lastTime) / 1000, .05);
    state.lastTime = now;
    const max = Math.max(0, state.element.scrollHeight - state.element.clientHeight);
    state.target = Math.min(max, Math.max(0, state.target));
    const frequency = 12, offset = state.position - state.target;
    const impulse = state.velocity + frequency * offset, decay = Math.exp(-frequency * dt);
    state.position = state.target + (offset + impulse * dt) * decay;
    state.velocity = (state.velocity - frequency * impulse * dt) * decay;
    state.position = Math.min(max, Math.max(0, state.position));
    const settled = Math.abs(state.target - state.position) < .4 && Math.abs(state.velocity) < 3;
    if (settled) state.position = state.target;
    state.element.scrollTo({ top: state.position, behavior: 'instant' });
    if (settled) { scrolling = null; return; }
    scrollFrame = requestAnimationFrame(animateScroll);
  }
  window.addEventListener('wheel', event => {
    if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (event.target instanceof Element && event.target.closest('.tape-carousel, .mobius-canvas, .photo-viewer, input, textarea, select, [contenteditable="true"]')) return;
    const element = scrollSurface(event.target);
    if (!element) return;
    const max = element.scrollHeight - element.clientHeight;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
    const distance = event.deltaY * unit;
    const current = scrolling?.element === element ? scrolling.target : element.scrollTop;
    const target = Math.max(0, Math.min(max, current + distance));
    // Contain the reading panel at its limits; never move the page behind a dialog.
    if (target === current && !scrolling) {
      if (element !== document.scrollingElement) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (scrolling?.element !== element) {
      stopSmoothScroll();
      scrolling = { element, position: element.scrollTop, target, velocity: 0, lastTime: performance.now() };
    } else {
      // Reversing the wheel should respond now rather than unwind old input.
      if (Math.sign(distance) !== Math.sign(scrolling.target - scrolling.position)) {
        scrolling.target = Math.max(0, Math.min(max, scrolling.position + distance));
        scrolling.velocity = 0;
      } else scrolling.target = target;
    }
    if (!scrollFrame) scrollFrame = requestAnimationFrame(animateScroll);
  }, { passive: false });
  window.addEventListener('pointerdown', stopSmoothScroll, { passive: true });
  window.addEventListener('touchstart', stopSmoothScroll, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape','Tab'].includes(event.key)) stopSmoothScroll();
  });
  window.addEventListener('hashchange', stopSmoothScroll);
  document.addEventListener('close', stopSmoothScroll, true);
  document.addEventListener('visibilitychange', stopSmoothScroll);
}
