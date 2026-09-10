const canvas = document.querySelector('canvas');
const surface = document.querySelector('.scene-landscape');
const status = document.querySelector('.status');

async function startScene() {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false });
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
    gl.clearColor(0, 0, 0, 1);
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
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function render(now) {
    frame = 0;
    if (lost) return;
    try {
      resize();
      if (previousTime !== null && !reducedMotion.matches) elapsed += Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      const writeIndex = 1 - readIndex;
      draw(bufferPass, targets[writeIndex].framebuffer, noiseTexture, targets[readIndex].texture, elapsed);
      draw(imagePass, null, targets[writeIndex].texture, null, elapsed);
      readIndex = writeIndex;
      status.hidden = true;
      if (visible && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(render);
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
  reducedMotion.addEventListener('change', schedule);
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
