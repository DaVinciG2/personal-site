// Warm, pointer-responsive spectral clouds for Scene 3.
const scene = document.querySelector('.scene-three');
const cloudCanvas = document.createElement('canvas');
cloudCanvas.className = 'spectral-background';
cloudCanvas.setAttribute('aria-hidden', 'true');
scene.prepend(cloudCanvas);
let visible = false, frame = 0, draw = null, last = 0, elapsed = 0;
const pointer = { x: .5, y: .5, targetX: .5, targetY: .5, strength: 0, targetStrength: 0 };
function initialize() {
  const gl = cloudCanvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
      gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
    }`);
  const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform vec3 mouse;
    out vec4 color;
    float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p) {
      vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
    }
    float fbm(vec2 p) {
      float sum=0.0, amplitude=.52;
      mat2 turn=mat2(.80,.60,-.60,.80);
      for(int i=0;i<5;i++){sum+=amplitude*noise(p);p=turn*p*2.03+4.7;amplitude*=.48;}
      return sum;
    }
    void main() {
      vec2 uv=gl_FragCoord.xy/resolution;
      float aspect=resolution.x/resolution.y;
      vec2 screen=(uv-.5)*vec2(aspect,1.0);
      vec2 delta=(uv-mouse.xy)*vec2(aspect,1.0);
      float influence=exp(-dot(delta,delta)*6.0)*mouse.z;
      vec2 eddy=vec2(-delta.y,delta.x)*influence*1.85;
      vec2 p=screen*3.2+eddy;
      // Deep amber air, lit by a warm furnace below the drifting steam.
      vec3 soot=vec3(.43,.335,.28);
      vec3 copper=vec3(.71,.49,.365);
      vec3 steam=vec3(1.0,.91,.77);
      vec3 base=mix(soot,copper,.34+.22*(1.0-uv.y));
      float glow=exp(-dot((uv-vec2(.72,.08))*vec2(1.3,1.0),(uv-vec2(.72,.08))*vec2(1.3,1.0))*4.0);
      base+=glow*vec3(.16,.095,.038);
      // Three differently advected banks create depth and rising, overlapping curls.
      for(int layer=0;layer<3;layer++) {
        float layerIndex=float(layer);
        vec2 drift=vec2((layerIndex-1.0)*.16,-.28-layerIndex*.13)*time;
        vec2 field=p*(.8+layerIndex*.28)+drift+vec2(layerIndex*7.8,layerIndex*3.1);
        vec2 warp=vec2(fbm(field*.69+vec2(time*.07,3.2)),fbm(field*.69+vec2(8.1,-time*.06)));
        vec2 folded=field+3.0*(warp-.5);
        float density=fbm(folded);
        float billow=smoothstep(.27,.72,density);
        float ridge=1.0-abs(density*2.0-1.0);
        float curl=pow(smoothstep(.60,.99,ridge),3.0);
        float wisps=fbm(folded*2.3+vec2(4.1,1.3));
        float illumination=smoothstep(.28,.72,fbm(folded+vec2(-.20,.27)));
        vec3 smoke=mix(vec3(.58,.46,.37),steam,illumination*.70+curl*.30);
        smoke=mix(smoke,vec3(1.0,.82,.61),glow*.22);
        float opacity=clamp(.17+billow*.52+curl*.19+(wisps-.5)*.20,0.0,.83);
        base=mix(base,smoke,opacity);
      }
      // Keep the center illuminated; the darker edges frame the room's smoky air.
      float centerLight=exp(-dot(screen*vec2(.95,1.15),screen*vec2(.95,1.15))*3.0);
      base=mix(base,vec3(1.0,.925,.825),centerLight*.32);
      float vignette=smoothstep(.25,1.05,length(screen*vec2(.7,1.0)));
      base*=1.0-vignette*.17;
      base+=influence*vec3(.055,.037,.018);
      // A quiet wash under the heading protects its contrast without flattening the room.
      float headingLight=exp(-pow((uv.y-.86)*8.0,2.0))*exp(-screen.x*screen.x*2.0);
      base=mix(base,vec3(.98,.89,.77),headingLight*.38);
      float grain=(hash(gl_FragCoord.xy)-.5)/255.0;
      color=vec4(base+grain,1.0);
    }`);
  const program=gl.createProgram();
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.bindVertexArray(gl.createVertexArray());
  const resolution=gl.getUniformLocation(program,'resolution'),time=gl.getUniformLocation(program,'time'),mouse=gl.getUniformLocation(program,'mouse');
  return seconds => {
    const bounds=scene.getBoundingClientRect();
    const scale=Math.min(1,1000/bounds.width,700/bounds.height);
    const width=Math.max(1,Math.round(bounds.width*scale)),height=Math.max(1,Math.round(bounds.height*scale));
    if(cloudCanvas.width!==width || cloudCanvas.height!==height){cloudCanvas.width=width;cloudCanvas.height=height;}
    gl.viewport(0,0,width,height);
    gl.uniform2f(resolution,width,height);gl.uniform1f(time,seconds*.42);
    gl.uniform3f(mouse,pointer.x,1-pointer.y,pointer.strength);
    gl.drawArrays(gl.TRIANGLES,0,3);
    cloudCanvas.dataset.ready='true';
  };
}
function render(now) {
  frame=0;
  if(!visible || document.hidden || !draw)return;
  if(last && now-last<32){frame=requestAnimationFrame(render);return;}
  const dt=last ? Math.min(now-last,80) : 33; last=now; elapsed+=dt/1000;
  const ease=1-Math.exp(-dt/260);
  pointer.x+=(pointer.targetX-pointer.x)*ease;pointer.y+=(pointer.targetY-pointer.y)*ease;
  pointer.strength+=(pointer.targetStrength-pointer.strength)*ease;
  draw(elapsed);
  frame=requestAnimationFrame(render);
}
function schedule() {
  cancelAnimationFrame(frame);frame=0;last=0;
  if(!visible || document.hidden)return;
  if(!draw){try{draw=initialize();}catch(error){console.warn('Scene 3 cloud background unavailable:',error);cloudCanvas.hidden=true;}}
  if(draw)frame=requestAnimationFrame(render);
}
scene.addEventListener('pointermove',event=>{
  const bounds=scene.getBoundingClientRect();
  pointer.targetX=(event.clientX-bounds.left)/bounds.width;pointer.targetY=(event.clientY-bounds.top)/bounds.height;pointer.targetStrength=1;
},{passive:true});
scene.addEventListener('pointerleave',()=>{pointer.targetStrength=0;});
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();}).observe(scene);
new ResizeObserver(()=>{if(visible)schedule();}).observe(scene);
document.addEventListener('visibilitychange',schedule);
cloudCanvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;draw=null;cloudCanvas.hidden=true;});
cloudCanvas.addEventListener('webglcontextrestored',()=>{cloudCanvas.hidden=false;schedule();});
