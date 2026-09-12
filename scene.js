const canvas = document.querySelector('.scene-landscape canvas');
const surface = document.querySelector('.scene-landscape');
const status = document.querySelector('.status');

async function startScene() {
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

  const bufferPass = program(sources[0]);
  const imagePass = program(sources[1]);
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
    const scale = Math.min(devicePixelRatio || 1, 1.5, 1600 / bounds.width, 1000 / bounds.height);
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
      status.hidden = true;
      if (visible && !document.hidden) frame = requestAnimationFrame(render);
    } catch (error) { showError(error); }
  }
  function schedule() {
    cancelAnimationFrame(frame);
    previousTime = null;
    if (!lost && visible && !document.hidden) frame = requestAnimationFrame(render);
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(surface);
  new ResizeObserver(schedule).observe(surface);
  document.addEventListener('visibilitychange', schedule);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    showError(new Error('The graphics connection was interrupted. Reload to restore the landscape.'));
  });
}

function showError(error) {
  console.error(error);
  status.textContent = error.message;
  status.hidden = false;
}
startScene().catch(showError);


// Each moving bank owns an independent WebGL canvas and GPU resources.
class PartingClouds {
  constructor(layers) {
    this.layers = layers;
    // Randomize once per visit, in loose vertical bands to preserve open space.
    layers.forEach((layer, index) => {
      layer.style.setProperty('--cloud-top', (index * 26 + 3 + Math.random() * 7) + 'vh');
      layer.style.setProperty('--cloud-height', (16 + Math.random() * 8) + 'vh');
      layer.style.setProperty('--cloud-width', (22 + Math.random() * 12) + 'vw');
      layer.style.setProperty('--cloud-x', (5 + Math.random() * 48) + '%');
      layer.style.setProperty('--cloud-duration', (1100 + Math.random() * 350) + 'ms');
      layer.querySelector('canvas').dataset.seed = String(Math.random() * 100);
    });
    this.banks = layers.flatMap(layer => [...layer.querySelectorAll('canvas')].map(canvas => ({
      canvas, layer, visible: false, departing: false, disposed: false, gpu: null, lost: false
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
        if (bank) bank.visible = entry.isIntersecting;
      }
      this.schedule();
    });
    this.resizeObserver = new ResizeObserver(this.schedule);
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
      this.draw(bank, performance.now());
      bank.departing = true;
      bank.canvas.getBoundingClientRect();
    }
    layer.classList.add('is-parted');
    this.schedule();
  }
  createGPU(bank) {
    const gl = bank.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false });
    if (!gl) throw new Error('Cloud canvas requires WebGL 2.');
    const gpu = bank.gpu = { gl, shaders: [] };
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
        // Irregular cloud contour with transparent upper/lower and side edges.
        float silhouette = .34 + (n - .5) * .65 - abs(uv.y - .48);
        float alpha = smoothstep(-.055, .08, silhouette);
        alpha *= smoothstep(0.0, .12, uv.x) * (1.0 - smoothstep(.86, 1.0, uv.x));
        alpha *= smoothstep(0.0, .08, uv.y) * (1.0 - smoothstep(.9, 1.0, uv.y));
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
      const gpu = bank.gpu || this.createGPU(bank);
      const { gl, uniforms } = gpu;
      const width = bank.canvas.clientWidth, height = bank.canvas.clientHeight;
      if (!width || !height) return;
      const scale = Math.min(devicePixelRatio || 1, 1, 720 / width, 360 / height);
      const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
      if (bank.canvas.width !== w || bank.canvas.height !== h) { bank.canvas.width = w; bank.canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.useProgram(gpu.program);
      gl.bindVertexArray(gpu.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
      gl.uniform1i(uniforms.iChannel0, 0);
      gl.uniform2f(uniforms.resolution, w, h);
      gl.uniform1f(uniforms.time, reducedMotion.matches ? 0 : now / 1000);
      gl.uniform1f(uniforms.seed, Number(bank.canvas.dataset.seed));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } catch (error) { bank.failed = true; console.error(error); }
  }
  schedule() {
    if (!this.closed && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.tick);
  }
  tick(now) {
    this.frame = 0;
    if (this.closed || document.hidden) return;
    // Loading can finish after the midpoint was crossed.
    queueScrollScene();
    const shouldDraw = now - this.lastDraw >= 1000 / 30;
    if (shouldDraw) this.lastDraw = now;
    for (const bank of this.banks) {
      if (bank.disposed) continue;
      if (bank.departing) {
        const bounds = bank.canvas.getBoundingClientRect();
        bank.movingInLayout = bounds.width > 0;
        // Horizontal bounds only: scrolling offscreen is not permission to unload.
        if (bounds.width > 0 && (bounds.right <= 0 || bounds.left >= document.documentElement.clientWidth)) {
          this.dispose(bank);
          continue;
        }
      }
      if (shouldDraw && bank.visible) this.draw(bank, now);
    }
    if (this.banks.every(bank => bank.disposed)) { this.close(); return; }
    if (this.banks.some(bank => !bank.disposed && ((bank.departing && bank.movingInLayout) || (bank.visible && !bank.failed && !bank.lost)))) this.schedule();
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
    canvas.width = canvas.height = 1;
    canvas.remove();
    bank.gpu = null;
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
    this.noise = null;
    this.source = null;
  }
}

// Page interactions remain independent of WebGL availability.
const introQuote = document.querySelector('.quote-intro');
const landscapeQuote = document.querySelector('.quote-landscape');
const cloudLayers = [...document.querySelectorAll('.cloud-layer')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const partingClouds = new PartingClouds(cloudLayers);
const clamp01 = value => Math.max(0, Math.min(1, value));
let scrollFrame = 0;
function updateScrollScene() {
  scrollFrame = 0;
  const progress = window.scrollY / Math.max(1, window.innerHeight);
  introQuote.style.opacity = 1 - clamp01(progress / .65);
  landscapeQuote.style.opacity = 1 - clamp01((progress - .72) / .55);
  // Trigger once per layer; CSS owns the entire time-based movement.
  // The stationary wrapper supplies the y anchor even while its banks move.
  const midpoint = window.innerHeight / 2;
  cloudLayers.forEach(layer => {
    if (layer.classList.contains('is-parted')) return;
    const bounds = layer.getBoundingClientRect();
    if (bounds.height > 0 && bounds.top + bounds.height / 2 <= midpoint) {
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
aboutButton.addEventListener('click', () => {
  if (aboutDialog.open) return;
  savedOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  aboutDialog.showModal();
  aboutCard.animate([
    { transform: 'rotateY(-90deg) scale(.94)', opacity: 0 },
    { transform: 'rotateY(0) scale(1)', opacity: 1 }
  ], { duration: reducedMotion.matches ? 0 : 520, easing: 'cubic-bezier(.2,.7,.2,1)' });
});
async function closeAbout() {
  if (closingAbout || !aboutDialog.open) return;
  closingAbout = true;
  await aboutCard.animate([
    { transform: 'rotateY(0) scale(1)', opacity: 1 },
    { transform: 'rotateY(90deg) scale(.94)', opacity: 0 }
  ], { duration: reducedMotion.matches ? 0 : 360, easing: 'ease-in' }).finished;
  aboutDialog.close();
  document.body.style.overflow = savedOverflow;
  closingAbout = false;
  aboutButton.focus({ preventScroll: true });
}
document.querySelector('.close-about').addEventListener('click', closeAbout);
aboutDialog.addEventListener('click', event => { if (event.target === aboutDialog) closeAbout(); });
aboutDialog.addEventListener('cancel', event => { event.preventDefault(); closeAbout(); });

const firstScene = document.querySelector('.scene');
const secondScene = document.querySelector('.scene-two');
const nextButton = document.querySelector('.next-scene');
const transition = document.querySelector('.cloud-transition');
const curtain = document.querySelector('.cloud-curtain');
let navigating = false;
function applyRoute() {
  const isSceneTwo = location.hash === '#scene2';
  firstScene.hidden = isSceneTwo;
  secondScene.hidden = !isSceneTwo;
  aboutButton.hidden = isSceneTwo;
  document.title = isSceneTwo ? 'scene2 — Cloud Train' : 'Cloud Train';
  if (isSceneTwo) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    secondScene.querySelector('h1').focus({ preventScroll: true });
  }
  queueScrollScene();
}
window.addEventListener('hashchange', applyRoute);
applyRoute();
nextButton.addEventListener('click', async () => {
  if (navigating) return;
  navigating = true;
  nextButton.disabled = true;
  transition.classList.add('active');
  const duration = reducedMotion.matches ? 0 : 1600;
  let cover;
  try {
    // Complete the sweep AND its fully covered hold before changing the route.
    cover = curtain.animate([
      { transform: 'translateX(-110%)', offset: 0, easing: 'cubic-bezier(.45,0,.15,1)' },
      { transform: 'translateX(0)', offset: .82 },
      { transform: 'translateX(0)', offset: 1 }
    ], { duration, fill: 'forwards' });
    await cover.finished;
    location.hash = 'scene2';
    applyRoute();
    // The new page appears only after the complete transition has finished.
  } finally {
    transition.classList.remove('active');
    cover?.cancel();
    navigating = false;
    nextButton.disabled = false;
  }
});
