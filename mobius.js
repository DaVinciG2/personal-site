import './spectral-background.js';
const section = document.querySelector('.scene-three');
const canvas = section.querySelector('.mobius-canvas');
const errorLabel = section.querySelector('.mobius-error');
let active = false, renderer, frame = 0, position = 0, target = 0, previous = 0, velocity = 0;
const pendingMoves = [];
const INPUT_DELAY_MS = 120;
const ribbonWords = 'Music · Baseball · Gaming · ';
let hoverLetter = -1, pointerPosition = null, pickAt = null;
function wordRange(index) {
  const topic=topicAt(index);
  return topic==='Music' ? [0,5] : topic==='Baseball' ? [8,16] : topic==='Gaming' ? [19,25] : [-2,-1];
}
function topicAt(index) {
  if (index >= 0 && index < 5) return 'Music';
  if (index >= 8 && index < 16) return 'Baseball';
  if (index >= 19 && index < 25) return 'Gaming';
  return null;
}

function createRenderer() {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!gl) throw new Error('This ribbon needs WebGL 2. Please enable hardware acceleration and reload.');
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vertex = shader(gl.VERTEX_SHADER, `#version 300 es
    precision highp float;
    in vec2 param;
    uniform float turn;
    uniform float aspect;
    out vec2 uv;
    out vec3 world;
    const float PI = 3.14159265359;
    void main() {
      float u = param.x * 2.0 * PI;
      float v = param.y * 0.27;
      // A lifted figure eight: its two crossings occupy different depths.
      vec3 center = vec3(1.65*sin(u), .72*sin(2.0*u), .42*cos(u));
      vec3 tangent = normalize(vec3(1.65*cos(u), 1.44*cos(2.0*u), -.42*sin(u)));
      vec3 side = normalize(vec3(-tangent.y, tangent.x, 0.0));
      vec3 normal = normalize(cross(tangent, side));
      // Keep the infinity silhouette while the ribbon rolls around its path.
      // One half twist still joins the opposite edges at the closed seam.
      float twist = u*.5 + .35*sin(turn*.3);
      vec3 p = center + v*(cos(twist)*side + sin(twist)*normal);
      world = p;
      float depth = 5.8 - p.z;
      float scale = min(2.9, aspect*2.35);
      gl_Position = vec4(p.x*scale/aspect, p.y*scale, (depth-2.0)*1.3- depth, depth);
      uv = vec2(param.x, (param.y+1.0)*.5);
    }`);
  const fragment = shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    uniform sampler2D lettering;
    uniform float flow;
    uniform bool picking;
    uniform vec2 highlight;
    in vec2 uv;
    in vec3 world;
    out vec4 color;
    void main() {
      vec3 normal = normalize(cross(dFdx(world), dFdy(world)));
      float light = .70 + .30*abs(dot(normal, normalize(vec3(-.3,.8,1.5))));
      // A second lap follows the reverse side of the same continuous surface.
      float route = uv.x + (gl_FrontFacing ? 0.0 : 1.0) - flow;
      vec2 textUV = vec2(route*3.0, gl_FrontFacing ? uv.y : 1.0-uv.y);
      float cell = fract(textUV.x);
      const float inverseZoom = .88;
      float wordCenter = (highlight.x+highlight.y)*.5;
      // Expand the destination area together with the word. Periodic distance
      // also preserves the first/last glyph when a word crosses the texture seam.
      float wordOffset = fract(cell-wordCenter+.5)-.5;
      float expandedHalfWidth = (highlight.y-highlight.x)*.5/inverseZoom;
      float hovered = step(0.0, highlight.x)*step(abs(wordOffset), expandedHalfWidth);
      vec2 sampleUV = textUV;
      if (hovered > .5) {
        sampleUV.x = wordCenter + wordOffset*inverseZoom;
        sampleUV.y = mix(.5, textUV.y, inverseZoom);
      }
      float ink = texture(lettering, sampleUV).a;
      // Hit testing follows the expanded word, including its newly visible edges.
      if (picking) { color=vec4(fract(sampleUV.x), sampleUV.y, ink > .15 ? 1.0 : 0.0, 1.0); return; }
      vec3 paper = mix(vec3(.94,.71,.53), vec3(1.0,.88,.69), light);
      vec3 textColor = mix(vec3(.29,.18,.13), vec3(.72,.25,.12), hovered);

      float edge = step(.982, abs(uv.y*2.0-1.0));
      color = vec4(mix(paper*light, textColor, max(ink,edge*.32)), 1.0);
    }`);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const vertices = [];
  const segments = 384, across = 12;
  for (let i=0; i<segments; i++) for (let j=0; j<across; j++) {
    const a=i/segments, b=(i+1)/segments, c=j/across*2-1, d=(j+1)/across*2-1;
    vertices.push(a,c,b,c,a,d, a,d,b,c,b,d);
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, 'param');
  gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 4096; textureCanvas.height = 256;
  const ctx = textureCanvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.font = '600 158px Georgia, serif'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const cellWidth = textureCanvas.width/ribbonWords.length;
  [...ribbonWords].forEach((letter,i) => ctx.fillText(letter, (i+.5)*cellWidth, 137, cellWidth*.92));
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, 'lettering'), 0);
  const turn = gl.getUniformLocation(program, 'turn');
  const aspect = gl.getUniformLocation(program, 'aspect');
  const flow = gl.getUniformLocation(program, 'flow');
  const picking = gl.getUniformLocation(program, 'picking');
  const highlight = gl.getUniformLocation(program, 'highlight');
  const pickBuffer=gl.createFramebuffer(), pickTexture=gl.createTexture(), pickDepth=gl.createRenderbuffer();
  let pickWidth=0, pickHeight=0;
  const pixel=new Uint8Array(4);
  gl.bindTexture(gl.TEXTURE_2D,pickTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.clearColor(0,0,0,0);
  return value => {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(bounds.width*ratio)), h = Math.max(1, Math.round(bounds.height*ratio));
    if (canvas.width !== w || canvas.height !== h) { canvas.width=w; canvas.height=h; }
    if (pickWidth!==w || pickHeight!==h) {
      pickWidth=w; pickHeight=h;
      gl.bindTexture(gl.TEXTURE_2D,pickTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindRenderbuffer(gl.RENDERBUFFER,pickDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
      gl.bindFramebuffer(gl.FRAMEBUFFER,pickBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,pickTexture,0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,pickDepth);
      gl.bindTexture(gl.TEXTURE_2D,texture);
    }
    gl.viewport(0,0,w,h);
    gl.uniform1f(turn, value); gl.uniform1f(flow, value*.12); gl.uniform1f(aspect, w/h);
    pickAt = (clientX, clientY) => {
      const x=Math.floor((clientX-bounds.left)/bounds.width*w);
      const y=Math.floor((bounds.bottom-clientY)/bounds.height*h);
      if (x<0 || x>=w || y<0 || y>=h) return -1;
      gl.bindFramebuffer(gl.FRAMEBUFFER,pickBuffer);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x,y,1,1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1i(picking,1);
      gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);
      gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.uniform1i(picking,0);
      const index=Math.min(ribbonWords.length-1,Math.floor(pixel[0]/255*ribbonWords.length));
      return pixel[3]>128 && pixel[1]/255 > .12 && pixel[1]/255 < .88 && topicAt(index) ? index : -1;
    };
    hoverLetter=pointerPosition ? pickAt(...pointerPosition) : -1;
    canvas.style.cursor=hoverLetter>=0 ? 'pointer' : 'grab';
    canvas.dataset.hoverLetter=hoverLetter>=0 ? ribbonWords[hoverLetter] : '';
    canvas.dataset.hoverTopic=topicAt(hoverLetter) || '';
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1i(picking,0);
    const range=wordRange(hoverLetter);
    gl.uniform2f(highlight,hoverLetter>=0 ? range[0]/ribbonWords.length : -2,hoverLetter>=0 ? range[1]/ribbonWords.length : -1);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length/2);
    canvas.dataset.position = value.toFixed(4);
  };
}
function render(now) {
  frame = 0;
  if (!active || document.hidden || !renderer) return;
  // Replay input after a short, fixed delay rather than debouncing a gesture.
  // Continuous scrolling therefore keeps moving; reversal follows the same delay.
  while (pendingMoves.length && pendingMoves[0].at <= now) {
    target += pendingMoves.shift().distance;
  }
  const dt = previous ? Math.min(now-previous, 64) : 16;
  previous = now;
  // Exact critically damped spring: gentle acceleration and a long, smooth stop.
  // Use elapsed time so trackpads and different refresh rates feel the same.
  {
    const seconds=dt/1000, frequency=4.5;
    const offset=position-target;
    const impulse=velocity+frequency*offset;
    const decay=Math.exp(-frequency*seconds);
    position=target+(offset+impulse*seconds)*decay;
    velocity=(velocity-frequency*impulse*seconds)*decay;
    if (Math.abs(target-position)<.0001 && Math.abs(velocity)<.001) { position=target; velocity=0; }
  }
  renderer(position);
  if (position!==target || pendingMoves.length) frame=requestAnimationFrame(render);
}
function schedule() {
  if (active && !document.hidden && !frame) { previous=0; frame=requestAnimationFrame(render); }
}
export function syncMobius(visible) {
  active=visible;
  if (!visible) { closeInterest(true); pointerPosition=null; cancelAnimationFrame(frame); frame=0; pendingMoves.length=0; target=position; velocity=0; return; }
  if (!renderer) {
    try { renderer=createRenderer(); }
    catch(error) { errorLabel.textContent=error.message; errorLabel.hidden=false; return; }
  }
  schedule();
}
function move(distance) {
  pendingMoves.push({ at: performance.now() + INPUT_DELAY_MS, distance: distance*.0035 });
  schedule();
}
section.addEventListener('wheel', event => {
  if (!active || document.querySelector('dialog[open]') || event.ctrlKey || event.target.closest('button')) return;
  event.preventDefault();
  const unit=event.deltaMode===1 ? 16 : event.deltaMode===2 ? innerHeight : 1;
  move(Math.max(-600,Math.min(600,(event.deltaY || event.deltaX)*unit)));
}, { passive:false });
let pointer=null, lastY=0, pressX=0, pressY=0, dragged=false;
canvas.addEventListener('pointerdown', event => {
  if(event.button!==0)return;
  pointer=event.pointerId; lastY=pressY=event.clientY; pressX=event.clientX; dragged=false;
  canvas.setPointerCapture(pointer);
});
canvas.addEventListener('pointermove', event => {
  pointerPosition=[event.clientX,event.clientY]; schedule();
  if(event.pointerId!==pointer)return;
  if(Math.hypot(event.clientX-pressX,event.clientY-pressY)>7)dragged=true;
  if(dragged)move((lastY-event.clientY)*2);
  lastY=event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if(event.pointerId!==pointer)return;
  if(!dragged) { const letter=pickAt?.(event.clientX,event.clientY) ?? -1; if(topicAt(letter))openInterest(topicAt(letter),event.clientX,event.clientY); }
  pointer=null;
});
for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null;});
canvas.addEventListener('pointerleave',()=>{pointerPosition=null;schedule();});
section.addEventListener('keydown', event => {
  if (event.target.closest('button') || interestDialog.open) return;
  const distance={ArrowDown:100,ArrowRight:100,ArrowUp:-100,ArrowLeft:-100,PageDown:350,PageUp:-350,' ':250}[event.key];
  if(distance===undefined || event.altKey || event.ctrlKey || event.metaKey)return;
  event.preventDefault();move(distance);
});
new ResizeObserver(schedule).observe(canvas);
document.addEventListener('visibilitychange', () => { cancelAnimationFrame(frame);frame=0;schedule(); });
canvas.addEventListener('webglcontextlost', event => { event.preventDefault();cancelAnimationFrame(frame);frame=0;renderer=null;errorLabel.textContent='The ribbon is waiting for the graphics connection to recover.';errorLabel.hidden=false; });
canvas.addEventListener('webglcontextrestored', () => {errorLabel.hidden=true; if(active)syncMobius(true);});

// An independent interest panel; only the expand/return motion echoes Scene 2.
const interests = {
  Music: { number:'01', subtitle:'Sound, rhythm & feeling.', symbol:'♫', note:'Tracks, albums, and moments worth listening to again.' },
  Baseball: { number:'02', subtitle:'Every pitch tells a story.', symbol:'⚾', note:'The game, the field, and everything between the innings.' },
  Gaming: { number:'03', subtitle:'Another world awaits.', symbol:'✧', note:'Worlds to explore, stories to follow, and new ways to play.' }
};
const interestDialog=document.createElement('dialog');
interestDialog.className='interest-dialog';
interestDialog.setAttribute('aria-labelledby','interest-title');
interestDialog.innerHTML=`<article class="interest-card"><button class="interest-close" type="button" aria-label="Close interest">×</button><p class="interest-index"></p><div class="interest-symbol" aria-hidden="true"></div><h2 id="interest-title"></h2><p class="interest-subtitle"></p><p class="interest-description"></p></article>`;
document.body.append(interestDialog);
const interestCard=interestDialog.querySelector('.interest-card');
let interestAnimation=null, interestClosing=false, interestOrigin=[0,0], interestOverflow='', interestFocus=null;
function originTransform() {
  const box=interestCard.getBoundingClientRect();
  return `translate(${interestOrigin[0]-box.left-box.width/2}px,${interestOrigin[1]-box.top-box.height/2}px) scale(.06)`;
}
async function openInterest(topic,x,y) {
  if(interestDialog.open || !active)return;
  const content=interests[topic];
  interestOrigin=[x,y]; interestFocus=document.activeElement;
  pendingMoves.length=0; target=position; velocity=0;
  pointerPosition=null; schedule();
  interestDialog.dataset.topic=topic.toLowerCase();
  interestDialog.querySelector('.interest-index').textContent=`INTEREST / ${content.number}`;
  interestDialog.querySelector('.interest-symbol').textContent=content.symbol;
  interestDialog.querySelector('h2').textContent=topic;
  interestDialog.querySelector('.interest-subtitle').textContent=content.subtitle;
  interestDialog.querySelector('.interest-description').textContent=content.note;
  const gaming=topic==='Gaming', music=topic==='Music', baseball=topic==='Baseball';
  baseballArticle.hidden=!baseball;
  musicArticle.hidden=!music;
  if(music||baseball||gaming) {
    // A resource that failed during a preview restart must not stay broken on reopen.
    for(const image of (music ? musicArticle : baseball ? baseballArticle : gamingArticle).querySelectorAll('img')) {
      if(image.complete && image.naturalWidth===0) {
        const retryURL=new URL(image.src);retryURL.searchParams.set('retry',Date.now());image.src=retryURL.href;
      }
    }
  }
  interestDialog.classList.toggle('interest-essay',gaming||music||baseball);
  gamingArticle.hidden=!gaming;
  interestDialog.querySelector('.interest-symbol').hidden=gaming||music||baseball;
  interestDialog.querySelector('.interest-description').hidden=gaming||music||baseball;
  if(baseball)interestDialog.querySelector('.interest-subtitle').textContent='What stays with me after the game.';
  if(music)interestDialog.querySelector('.interest-subtitle').textContent='An old friend I am still getting to know.';
  if(gaming)interestDialog.querySelector('.interest-subtitle').textContent='The worlds that stay with me.';
  interestOverflow=document.body.style.overflow; document.body.style.overflow='hidden';
  interestDialog.showModal();
  interestCard.scrollTop=0;
  interestAnimation=interestCard.animate([
    {transform:originTransform(),opacity:.2,borderRadius:'80px'},
    {transform:'translate(0,0) scale(1)',opacity:1,borderRadius:'32px'}
  ],{duration:850,easing:'cubic-bezier(.22,.75,.2,1)',fill:'both'});
  const animation=interestAnimation;
  try{await animation.finished;}catch{}
  if(interestAnimation===animation){animation.cancel();interestAnimation=null;}
}
async function closeInterest(immediate=false) {
  if(!interestDialog.open)return;
  if(interestClosing && !immediate)return;
  interestClosing=true;
  const from=getComputedStyle(interestCard).transform;
  interestAnimation?.cancel();interestAnimation=null;
  if(!immediate){
    interestAnimation=interestCard.animate([{transform:from,opacity:1},{transform:originTransform(),opacity:0}],{duration:480,easing:'cubic-bezier(.5,0,.3,1)',fill:'both'});
    try{await interestAnimation.finished;}catch{}
  }
  interestDialog.close(); interestAnimation?.cancel();interestAnimation=null;
  document.body.style.overflow=interestOverflow;
  interestClosing=false;
  if(!immediate && active)(interestFocus?.isConnected ? interestFocus : canvas).focus({preventScroll:true});
}
interestDialog.querySelector('.interest-close').addEventListener('click',()=>closeInterest());
interestDialog.addEventListener('cancel',event=>{event.preventDefault();closeInterest();});
interestDialog.addEventListener('click',event=>{if(event.target===interestDialog)closeInterest();});
const accessibleTopics=document.createElement('div');
accessibleTopics.className='interest-access';
accessibleTopics.setAttribute('aria-label','Open an interest');
for(const topic of Object.keys(interests)){
  const button=document.createElement('button');button.type='button';button.textContent=topic;
  button.setAttribute('aria-haspopup','dialog');
  button.addEventListener('click',()=>{const b=canvas.getBoundingClientRect();openInterest(topic,b.left+b.width/2,b.top+b.height/2);});
  accessibleTopics.append(button);
}
section.append(accessibleTopics);
canvas.setAttribute('aria-label','An infinity ribbon with Music, Baseball and Gaming. Click a word to open its interest. Scroll or drag to move the ribbon.');
section.querySelector('.mobius-hint').innerHTML='<span aria-hidden="true">↕</span> Scroll to turn the ribbon <span class="hint-divider" aria-hidden="true">·</span> Click a word to explore';

// Personal narrative: images sit beside the memories they belong to.
const gamingArticle=document.createElement('div');
gamingArticle.className='gaming-narrative';gamingArticle.hidden=true;
gamingArticle.innerHTML=`
  <p class="gaming-lead">I rarely remember games as a sequence of objectives.</p>
  <p>What stays with me is usually something less precise: the music of a town I spent hours wandering through, the feeling of returning to a familiar place after a long journey, or the strange emptiness that comes after finishing a story and realizing that a world I had quietly lived in for weeks is now over.</p>
  <p>That is probably why I am drawn to roleplaying games. I like worlds that take their time — worlds that allow places, characters, and relationships to become familiar before asking me to leave them.</p>
  <section class="gaming-memory" aria-label="Estelle, my favorite game character">
    <figure class="gaming-portrait">
      <img src="./gaming/estelle.jpg" alt="Estelle from Trails in the Sky, smiling with her eyes closed as she holds a large beetle." width="473" height="352" decoding="async">
      <figcaption>Estelle · Trails in the Sky</figcaption>
    </figure>
    <div><p>Estelle, from <cite>Trails in the Sky</cite>, is my favorite game character and someone I want to be a little more like. Her cheerfulness, innocence, strength, and kindness move me. They are also qualities I wish I had more of myself. Some characters stay with me because of what happens to them; Estelle stays with me because of who she is.</p>
    </div>
  </section>
  <p>I remember a different feeling from my first time playing <cite>Tales of Berseria</cite>. I had just finished the prologue. Standing there with Velvet, facing the despair that lay ahead, I felt as though I was facing it alongside her.</p>
  <figure class="gaming-landscape">
    <img src="./gaming/berseria.jpg" alt="A scene from my Tales of Berseria playthrough: a character faces ruined arches beneath an enormous red moon." width="1440" height="810" loading="lazy" decoding="async">
    <figcaption>Just after the prologue, on my first playthrough of Tales of Berseria. A moment I still remember.</figcaption>
  </figure>
  <p>A screenshot can preserve what a place looked like. What I remember is how it felt to be there, before I knew what would happen next.</p>
  <div class="gaming-divider" aria-hidden="true">✦</div>
  <h3 class="gaming-section-heading">When thought becomes rhythm.</h3>
  <p>Action games give me something almost opposite. There, thought gradually disappears. Timing, movement, sound, and reaction collapse into a single rhythm, until playing becomes less like making decisions and more like entering a state of flow.</p>
  <p>Of course, that rhythm does not always arrive. While running my personal account, I livestreamed <cite>Ninja Gaiden Sigma</cite>. Its awkward controls frustrated me so much that, at times, I felt I was fighting the controls as much as the enemies. That is part of my memory of it, too.</p>
  <figure class="gaming-landscape gaming-stream">
    <img src="./gaming/ninja-gaiden-sigma.png" alt="A frame from my Ninja Gaiden Sigma livestream, with Ryu airborne beside skeletal archers in a stone chamber." width="2159" height="1230" loading="lazy" decoding="async">
    <figcaption>From my Ninja Gaiden Sigma livestream. The less graceful side of chasing flow.</figcaption>
  </figure>
  <div class="gaming-ending"><p>I like both experiences.</p><p>Sometimes I want to understand a world.<br>Sometimes I simply want to disappear into one.</p></div>
`;
interestCard.append(gamingArticle);

const musicArticle=document.createElement('div');
musicArticle.className='music-narrative';musicArticle.hidden=true;
musicArticle.innerHTML=`
  <p class="music-lead">Music has been part of my life for longer than I have known how to love it.</p>
  <div class="music-memory">
    <figure class="music-photo">
      <img src="./music/first-violin.jpg?v=2" width="1279" height="1706" loading="eager" alt="Me in primary school, practicing the violin at home in a red and gray shirt." decoding="async">
      <figcaption>Primary school, when I was just beginning to learn the violin.</figcaption>
    </figure>
    <div>
      <p>When I first started learning the violin in primary school, I did not particularly like music — classical or modern. Some of the feelings it stirred were too intense for me; others were so understated that I could not make sense of them. I was too young to know what to do with either.</p>
      <p>I did not like practicing, either. It was repetitive, dull, and often felt like something to get through.</p>
    </div>
  </div>
  <p>That changed slowly. As I grew older and experienced more of life’s joys, disappointments, worries, and hopes, I began to hear things I had missed before. Music that once felt distant became familiar. Somewhere along the way, it became part of my everyday life.</p>
  <p>I am especially drawn to the emotional breadth of Romantic music. Rachmaninoff and Schubert are among the composers I return to most, alongside Ravel and Sibelius.</p>
  <div class="music-divider" aria-hidden="true">♪</div>
  <p>In middle school, under the pressure of important exams, I often listened to Rachmaninoff. The weight and sadness of his <cite>Piano Concerto No. 2</cite> resonated with what I was carrying. I could hear something of my own pressure in it.</p>
  <p>Variation XVIII of his <cite>Rhapsody on a Theme of Paganini</cite> opened up a different feeling: something expansive, like a wide sky beyond the exams. Listening to it, I could imagine the future waiting on the other side.</p>
  <div class="music-collection">
    <div>
      <p>My album collection includes Schubert’s <cite>“The Great”</cite> and <cite>“Unfinished”</cite> symphonies, Bach’s <cite>Cello Suites</cite>, and Pink Floyd’s <cite>The Dark Side of the Moon</cite>, among others.</p>
      <p>Beyond classical music, I often return to Camel, Pink Floyd, Red Hot Chili Peppers, and Oasis. They have become familiar company in their own ways.</p>
      <p>I do not limit what I listen to by genre. I try to find the parts that resonate with me — a melody, a sound, or a feeling that connects with something in my own life.</p>
    </div>
    <figure class="music-photo">
      <img src="./music/album-collection.jpg" width="1350" height="1800" alt="Part of my album collection: Pink Floyd’s The Dark Side of the Moon, Schubert symphonies, and Bach’s Cello Suites." loading="lazy" decoding="async">
      <figcaption>A small part of my album collection.</figcaption>
    </figure>
  </div>
  <div class="music-ending"><p>Music feels like a childhood friend who has grown up alongside me.</p><p>The pieces may be familiar, but I keep bringing a different life to them. Each time I return, there is something new to hear.</p></div>
`;
interestCard.append(musicArticle);

const baseballArticle=document.createElement('div');
baseballArticle.className='baseball-narrative';baseballArticle.hidden=true;
baseballArticle.innerHTML=`
  <p class="baseball-lead">Of all the things baseball has left with me, one of the clearest is also one of the simplest: after a game, both teams take off their caps, bow to one another, and shake hands.</p>
  <div class="baseball-childhood">
    <figure><img src="./baseball/batting.jpg" width="960" height="1280" alt="Me as a child practicing my batting stance with a blue bat on a grass field." decoding="async"><figcaption>Learning to bat, as a child.</figcaption></figure>
    <figure><img src="./baseball/fielding.jpg" width="960" height="1280" alt="Me as a child practicing fielding with a blue glove on a grass field." decoding="async"><figcaption>Learning to field, one practice at a time.</figcaption></figure>
  </div>
  <p>These two photos were taken when I was learning baseball as a child. Back then, I was learning how to play; I did not yet understand how much the game would teach me about other people.</p>
  <p>Like most sports, baseball demands endurance, explosiveness, technique, and teamwork. What felt different to me, however, was that sportsmanship was not left as an abstract ideal. We practiced it after every game by taking off our caps, bowing to the other team, and shaking hands.</p>
  <p>I did not always understand that. When I was younger, I blamed teammates after losses and sometimes cursed the opponents who had beaten us. My coaches would correct me — firmly, but never cruelly. Their guidance came from a place of care.</p>
  <p>Over time, they taught me to imagine the game from someone else’s side: my teammate who had already tried his best, the opponent who wanted to win just as badly as I did, and the person beneath the uniform standing across from me.</p>
  <div class="baseball-reflection"><p>Competition does not have to erase empathy.</p></div>
  <p>Perhaps that is what baseball ultimately gave me. You can want desperately to win, play with everything you have, and still remove your cap at the end, look the other person in the eye, and offer your hand.</p>
  <div class="baseball-later">
    <figure><img src="./baseball/walking-home.jpg" width="1280" height="1707" alt="Walking home with friends after a high school baseball club session, along a red path beside trees and school buildings." decoding="async" loading="lazy"><figcaption>Years later: heading home with friends after a high school baseball club session.</figcaption></figure>
    <div><p>The last photo was taken years later, on my way home with friends after a high school baseball club session. It belongs to the quieter part of my memories of baseball: being together after the activity was over.</p>
    <p>Baseball, to me, became more than a sport. Somewhere along the way, its small rituals helped shape the kind of person I wanted to become — someone who values peace and kindness, tries to understand other people, and wants us to move forward together.</p></div>
  </div>
`;
interestCard.append(baseballArticle);
