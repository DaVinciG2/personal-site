import { photoAlbums } from './photo-albums.js';
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function renderPhotoAlbums() {
  return '<div class="photo-albums">' + photoAlbums.map(album =>
    '<section class="photo-location"><h3>' + escapeHtml(album.place) + '<span>' + album.photos.length + ' photos</span></h3><div class="album-sheet">' +
    album.photos.map((photo, index) => '<figure><a class="album-art album-photo" href="' + escapeHtml(photo) + '" target="_blank" rel="noopener" aria-label="' + escapeHtml(album.place) + ' photo ' + (index + 1) + ', open original in a new tab"><img src="' + escapeHtml(photo) + '" alt="' + escapeHtml(album.place) + ' — photo ' + (index + 1) + '" loading="lazy" decoding="async"></a><figcaption>' + escapeHtml(album.place) + ' / ' + String(index + 1).padStart(2, '0') + '</figcaption></figure>').join('') +
    '</div></section>').join('') + '</div>';
}

function renderActivityMedia(notes, position = 'end') {
  return (notes?.media || []).filter(item => (item.position ?? 'end') === position).map(item => `<figure class="activity-figure"><a href="${escapeHtml(item.src)}" target="_blank" rel="noopener" aria-label="Open full-size image: ${escapeHtml(item.alt)}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"></a><figcaption>${escapeHtml(item.caption)}</figcaption></figure>`).join('');
}
function renderActivityLinks(notes, position = 'end') {
  const links = (notes.links || []).filter(link => (link.position ?? 'end') === position).map(link => `<a class="story-link activity-resource" href="${escapeHtml(link.href)}" ${link.download ? 'download' : 'target="_blank" rel="noopener"'}>${escapeHtml(link.label)}</a>`).join('');
  return links ? `<div class="activity-resources">${links}</div>` : '';
}
function renderActivityNotes(notes) {
  if (!notes) return '';
  return `<div class="activity-notes"><p class="activity-meta">${escapeHtml(notes.meta)}</p>${renderActivityLinks(notes, 'start')}${notes.paragraphs.map((paragraph, index) => `<p>${escapeHtml(paragraph)}</p>${renderActivityLinks(notes, index)}${renderActivityMedia(notes, index)}`).join('')}${renderActivityLinks(notes)}${renderActivityMedia(notes)}<aside class="activity-question"><span>A QUESTION I KEEP EXPLORING</span><p>${escapeHtml(notes.question)}</p></aside></div>`;
}

const archive = document.querySelector('.scene-two');
const tapes = [
{
  "title": "cognition",
  "subtitle": "Questions about the mind",
  "side": "01",
  "kind": "thought",
  "caption": "Exploring how we communicate, think, and find meaning.",
  "chapters": [
    [
      "01 / COMMUNICATION",
      "Where My Questions Began",
      "My research on communication challenges among older adults was my first real step into scientific research and cognitive science.",
      {
        "meta": "Independent research · Communication & aging",
        "paragraphs": [
          "I interviewed more than 40 adults aged 55–75 about communication challenges. My paper, Designing an AI Language Assistance System for Elderly Users to Overcome Communication Challenges, proposes AILATO: an AI language-assistance framework informed by the Jakobson model.",
          "The framework organizes support around Context, Message, Channel, and Code. It connects problems of shared context, message clarity, communication channels, and vocabulary with possible forms of assistance.",
          "This was my first real step into scientific research and cognitive science: listening to people’s experiences, organizing the problem, and proposing a response. AILATO is a proposed system, with questions about accessibility, dialect recognition, and real-world use still to address."
        ],
        "question": "What does it take for people to understand one another?",
        "links": [
          {
            "href": "https://doi.org/10.56028/aetr.15.1.1038.2025",
            "label": "Read the published paper · DOI ↗",
            "position": "start"
          },
          {
            "href": "https://commons.princeton.edu/eng266-s25/wp-content/uploads/sites/433/2025/04/Jakobson-Linguistics-and-Poetics.pdf",
            "label": "Model source · Jakobson (1960) · PDF ↗"
          }
        ],
        "media": [
          {
            "src": "./activities/jakobson-model.svg",
            "alt": "Jakobson’s six communication factors: addresser, message, addressee, context, contact, and code. AILATO draws on four factors, adapting contact as its channel module.",
            "caption": "Adapted from Roman Jakobson, Linguistics and Poetics (1960). Gold highlights the factors informing AILATO; the Channel label belongs to my adaptation. Click to enlarge.",
            "position": 0
          }
        ]
      }
    ],
    [
      "02 / PSYCHOLOGY",
      "Beyond Intuition",
      "At the University of Chicago’s Fundamentals of Psychology pre-college program, I explored how questions about the mind can be approached through evidence.",
      {
        "meta": "University of Chicago · Psychology pre-college",
        "paragraphs": [
          "Our project, The Effects of Visual and Verbal Priming on the Interpretation of Ambiguous Images, asked whether a brief picture or word cue changes what people first see in the duck–rabbit illusion. I contributed to survey design and response analysis in our four-person group.",
          "The online PsyToolkit experiment involved 51 participants aged 16–49, assigned to an image-prime, word-prime, or control condition. Duck-first responses were 17/18 (94.4%) with the image prime, 13/16 (81.2%) with the word prime, and 14/17 (82.4%) in the control group.",
          "The image-prime group showed a descriptive increase, while the word-prime group was close to control. This pattern calls for caution: prime durations differed, the duck interpretation was already common without priming, and online viewing conditions were not tightly controlled. A self-report awareness check also could not establish unconscious processing conclusively.",
          "The next step proposed in the paper is a more controlled study with matched presentation durations and stronger awareness measures. For me, the project connects curiosity about perception with the need to examine what a method can actually tell us."
        ],
        "question": "How can we distinguish a change in perception from the effects of our experimental design?",
        "links": [
          {
            "href": "./activities/priming-paper.pdf",
            "label": "Read the priming paper · PDF ↗"
          }
        ]
      }
    ],
    [
      "03 / LANGUAGE & STORIES",
      "How Stories Become Meaning",
      "Visual Novel Horizon brings my interest in language and storytelling into a community built around a shared enthusiasm.",
      {
        "meta": "Visual Novel Horizon · Founder & president",
        "paragraphs": [
          "I founded Visual Novel Horizon, a student circle exploring visual novels through weekly sessions and localization. Our work included a year-long localization effort, more than 50 blog posts uploaded to our club’s website, and a community of over 10 highly active members. At the recruitment fair, we demonstrated the results of a year of club localization work.",
          "While localizing and reworking Alive Renewal, I faced a small but persistent question: should we retain the many ellipses that break up the Japanese dialogue, or remove them to make the Chinese text more direct?",
          "After considering how ellipses function in both languages and gathering members’ opinions, I decided to follow the original punctuation wherever it did not obstruct understanding. I felt the difference in usage was not large enough to justify removing those pauses by default.",
          "This decision made the relationship between language and interpretation concrete for me. Translating the words also meant deciding how much of the original pacing to carry across—and discussing that decision with other readers."
        ],
        "question": "How does a story become meaningful to someone in another language?",
        "media": [
          {
            "src": "./activities/vn-website.png",
            "alt": "Visual Novel Horizon club website with blog posts",
            "caption": "Our club website: a home for blog posts and visual-novel discussions.",
            "position": "top"
          },
          {
            "src": "./activities/vn-recruitment.jpg",
            "alt": "Visual Novel Horizon recruitment table displaying localized games on laptops",
            "caption": "Sharing a year of localization work at the club recruitment fair.",
            "position": 0
          },
          {
            "src": "./activities/alive-renewal-translation.png",
            "alt": "Alive Renewal Japanese and Chinese dialogue side by side, retaining ellipses",
            "caption": "Alive Renewal: comparing the Japanese dialogue and our Chinese translation."
          }
        ]
      }
    ]
  ]
},
{
  "title": "application",
  "subtitle": "Understanding put into practice",
  "side": "02",
  "kind": "work",
  "caption": "Building tools, supporting learners, and refining experiences.",
  "chapters": [
    [
      "01 / MEMORY & DESIGN",
      "Designing for Memory",
      "Memorify is my SAT vocabulary-learning tool, built with .NET MAUI to turn memory principles into a practical study experience.",
      {
        "meta": "Memorify · Developer & interface designer",
        "paragraphs": [
          "Users can create, merge, and import their own vocabulary lists. Each word can be personalized with example sentences, images, and mnemonic associations, so studying can connect with material that means something to the individual learner.",
          "The review schedule uses an index informed by the Ebbinghaus forgetting curve and the learner’s accuracy and response times for that word on the day. This index helps prioritize review rather than treating every word as equally familiar.",
          "The testing-phase home screen brings together learning counts, vocabulary lists, and shortcuts for studying, importing, and merging lists. The earlier development screenshot below shows a word’s learning status and editable example sentences. The project also incorporates spaced practice, active recall, and progress analytics to support more informed study decisions.",
          "Memorify connects my interest in memory with interface design: giving learners both a review structure and the freedom to build their own associations."
        ],
        "question": "How can a learning tool help people understand their own progress?",
        "media": [
          {
            "src": "./activities/memorify-testing.png",
            "alt": "Memorify testing-phase home screen labeled VocabAssist, with vocabulary statistics, list management and study actions",
            "caption": "Memorify in testing: the home dashboard, shown with the VocabAssist interface label, brings together vocabulary statistics, lists, and study actions.",
            "position": "top"
          },
          {
            "src": "./activities/memorify-development.png",
            "alt": "Memorify development interface showing a vocabulary entry, learning status and editable example sentences",
            "caption": "Memorify during development: a personalized vocabulary entry and example-sentence editor."
          }
        ]
      }
    ],
    [
      "02 / TEACHING & LEARNING",
      "Helping Others Learn",
      "Teaching gives me a direct way to explore how an explanation or an activity can support someone else’s learning.",
      {
        "meta": "Peer tutoring · Computer Science, Chinese Writing & Maths",
        "paragraphs": [
          "I adapt my teaching approach to the subject. For IGCSE and AS Computer Science programming questions, I work through concrete examples with students, using specific problems to explain the reasoning involved.",
          "For IGCSE Chinese writing, I drew on my experience in a Chinese public junior secondary school to compile and share a Markdown guide. It covers identifying a central idea, outlining, paragraph structure, descriptive detail, sentence variety, and revision.",
          "The guide presents structure as a tool for expression. For example, it contrasts simply saying that a character is nervous with describing clenched hands and trembling legs—helping students turn a general statement into observable detail.",
          "My peer tutoring spans Computer Science, Chinese writing, and Maths, including mentoring five younger students in programming. Across subjects, I try to choose a form of support that fits what the learner is trying to do."
        ],
        "question": "How can I adapt an explanation to the learner in front of me?",
        "links": [
          {
            "href": "./activities/chinese-writing-guide.md",
            "label": "Download my Chinese writing guide · Markdown",
            "download": true,
            "position": 1
          }
        ]
      }
    ],
    [
      "03 / INTERACTION & FEEDBACK",
      "Refining the Experience",
      "During an indie-game optimization internship, I contributed to improving user experience and balance through repeated playtesting.",
      {
        "meta": "Game optimization internship · Lead game optimizer",
        "paragraphs": [
          "My work included recording bugs and giving feedback on game mechanics and narrative flow. Repeated playtesting provided a practical setting for noticing points of friction and communicating possible improvements.",
          "This work connects with the storytelling interests I explore in Visual Novel Horizon. Here, the focus turns to interaction: how the experience unfolds as someone plays, and how feedback can inform its refinement."
        ],
        "question": "How can careful observation help make an interactive experience clearer?"
      }
    ]
  ]
},
  { title: 'my photo album', subtitle: 'Small things, kept forever', side: '03', kind: 'memory', caption: 'Some moments deserve to be kept.', chapters: [
    ['01 / COLLECT', 'Hold on to the little things.', 'For me, photography is about making small moments extraordinary, rather than waiting for extraordinary moments.'],
    ['02 / CONTACT SHEET', 'Postcards from this little world.', 'Photographs from journeys near and far. Click a photograph to open the original.'],
    ['03 / TO BE CONTINUED', 'More memories to come.', 'There is always room for another moment. Life’s journey stretches on, its end still out of sight, yet the breeze and moonlight along the way offer an endless source of wonder.'] ] }
];
archive.innerHTML = `
  <div class="archive-window" aria-hidden="true"><div class="archive-window-view"><canvas class="archive-window-canvas"></canvas><span class="window-mullion window-mullion-vertical"></span><span class="window-mullion window-mullion-horizontal"></span></div><span class="archive-window-sill"></span></div>
  <div class="archive-haze" aria-hidden="true"></div>
  <header class="archive-heading"><h1 tabindex="-1">A few things <em>worth keeping.</em></h1><p>Thoughts, experiments, and little pieces of life.</p></header>
  <div class="tape-carousel" role="region" aria-roledescription="carousel" aria-label="Personal archive tapes" tabindex="0"><div class="tape-rail"></div></div>
  <div class="deck-area"><p class="tape-instruction">Click a tape to unfold its story</p>
    <div class="recorder archive-printer" role="img" aria-label="Retro cassette reader and paper printer">
      <div class="printer-top"><div class="paper-output"><span class="printer-proof"><i></i><i></i><i></i></span></div><span class="output-label">PAPER OUTPUT</span></div>
      <div class="printer-front"><div class="printer-reader"><div class="reader-caption"><span>CASSETTE IN</span><span>↓</span></div><div class="tape-slot"><span class="slot-line"></span><span class="slot-label">INSERT A MEMORY</span></div><div class="reader-guides"><i></i><i></i></div></div><div class="printer-controls"><div class="printer-display"><span class="display-page">▤</span><span class="deck-status">READY</span></div><div class="printer-lights"><span class="deck-light"></span><span>READ / PRINT</span></div><div class="printer-key" aria-hidden="true">↥</div></div></div>
      <div class="printer-base"><span class="printer-vents"></span><span>TAPE → PAPER</span><span class="printer-vents"></span></div>
    </div></div>
  <footer class="archive-footer"><p class="archive-caption" aria-live="polite"></p></footer>
  <dialog class="tape-dialog" aria-labelledby="tape-story-title"><article class="tape-story"><button class="story-close" aria-label="Eject tape and return to archive" type="button">↙ <span>eject tape</span></button><div class="story-folds"></div></article></dialog>`;
const rail = archive.querySelector('.tape-rail');
for (const tape of tapes) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = `tape-card tape-${tape.kind}`;
  button.innerHTML = `<span class="cassette"><span class="cassette-back"></span><span class="cassette-edge edge-left" aria-hidden="true"></span><span class="cassette-edge edge-right" aria-hidden="true"></span><span class="cassette-edge edge-top" aria-hidden="true"></span><span class="cassette-edge edge-bottom" aria-hidden="true"></span><span class="cassette-face"><span class="tape-screw tl">+</span><span class="tape-screw tr">+</span><span class="tape-screw bl">+</span><span class="tape-screw br">+</span><span class="cassette-label"><span class="label-top"><span>CT / PERSONAL ARCHIVE</span><span>C–60</span></span><span class="tape-title">${tape.kind === 'memory' ? '<small>my</small> photo album' : tape.title}</span><span class="label-subtitle">${tape.subtitle}</span><span class="tape-window"><span class="reel"></span><span class="magnetic-tape"></span><span class="reel"></span></span><span class="label-bottom"><span>SIDE A</span><span>VOL. ${tape.side}</span><span>60 MIN</span></span></span><span class="cassette-foot"><i></i><i></i><i></i><i></i></span></span></span>`;
  rail.append(button);
}
const cards = [...rail.children];
const dialog = archive.querySelector('.tape-dialog'), story = archive.querySelector('.tape-story'), folds = archive.querySelector('.story-folds'), carousel = archive.querySelector('.tape-carousel');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let selected = 0, phase = 'idle', generation = 0, activeAnimations = [], overflowBefore = '';
// Adapted from the supplied CSS Cards: swap three positions with explicit overlap order.
let carouselMotions = [], carouselVersion = 0, carouselMoving = false;
function carouselSlot(index, active = selected) {
  const offset = (index - active + cards.length) % cards.length;
  return offset === 2 ? -1 : offset;
}
function carouselPose(slot) {
  const width = cards[0].offsetWidth || parseFloat(getComputedStyle(archive).getPropertyValue('--tape-width')) || 300;
  return `translate(-50%, -50%) translateX(${slot * width * 1.1}px) rotateY(${-slot * 25}deg) scale(${slot === 0 ? 1.2 : .9})`;
}
function settleCarousel() {
  ++carouselVersion;
  carouselMotions.forEach(motion => motion.cancel()); carouselMotions = []; carouselMoving = false;
  cards.forEach((card, i) => { card.style.transform = carouselPose(carouselSlot(i)); card.style.zIndex = i === selected ? '50' : '20'; });
}
function selectTape(index, focus = false) {
  if (phase !== 'idle') return;
  const next = (index + tapes.length) % tapes.length;
  const previous = selected;
  const initialized = !!cards[0].dataset.position;
  const origins = cards.map(card => getComputedStyle(card).transform);
  const version = ++carouselVersion;
  carouselMotions.forEach(motion => motion.cancel()); carouselMotions = [];
  selected = next;
  cards.forEach((card, i) => {
    const slot = carouselSlot(i);
    card.dataset.position = slot === 0 ? 'center' : slot === 1 ? 'right' : 'left';
    card.setAttribute('aria-pressed', String(i === selected));
    card.setAttribute('aria-label', `${tapes[i].title}: ${i === selected ? 'insert tape and open story' : 'select tape'}`);
    card.querySelector('.cassette').style.removeProperty('--rx'); card.querySelector('.cassette').style.removeProperty('--ry');
    const target = carouselPose(slot);
    card.style.transform = target;
    card.style.zIndex = slot === 0 ? '50' : '20';
    // Explicit card navigation retains its visible transition, including reduced-motion environments.
    if (!initialized || previous === next || archive.hidden) return;
    // Same overlap order as the supplied CSS Cards implementation.
    card.style.zIndex = i === previous ? '50' : i === selected ? '30' : '20';
    carouselMotions.push(card.animate([{ transform: origins[i] }, { transform: target }], {
      duration: 800, easing: 'ease'
    }));
  });
  carouselMoving = carouselMotions.length > 0;
  Promise.all(carouselMotions.map(motion => motion.finished.catch(() => {}))).then(() => {
    if (version === carouselVersion) { carouselMoving = false; carouselMotions = []; cards.forEach((card, i) => { card.style.zIndex = i === selected ? '50' : '20'; }); }
  });
  archive.querySelector('.archive-caption').textContent = tapes[selected].caption;
  if (focus) cards[selected].focus({ preventScroll: true });
}

function animate(element, keyframes, duration, delay = 0) {
  const animation = element.animate(keyframes, { duration, delay, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'both' });
  activeAnimations.push(animation); return animation.finished.catch(() => {});
}
function cancelAnimations() { activeAnimations.forEach(a => a.cancel()); activeAnimations = []; }
function fillStory() {
  const tape = tapes[selected]; story.dataset.kind = tape.kind;
  folds.innerHTML = `<section class="story-fold story-cover"><p class="archive-kicker">PERSONAL ARCHIVE / VOL. ${tape.side} / SIDE A</p><h2 id="tape-story-title" class="story-title">${tape.title}</h2><p>${tape.caption}</p><span class="story-stamp">PLAY<br>↗</span></section>` + tape.chapters.map(([label, title, text, notes], index) => `<section class="story-fold"><details ${index === 0 || tape.kind === 'memory' && index === 1 ? 'open' : ''}><summary><span class="chapter-label">${label}</span><span class="chapter-title">${title}</span><span class="chapter-toggle" aria-hidden="true">+</span></summary><div class="chapter-content">${renderActivityMedia(notes, 'top')}<p>${text}</p>${renderActivityNotes(notes)}${tape.kind === 'memory' && index === 1 ? renderPhotoAlbums() : ''}</div></details></section>`).join('');
  // The reference's expanding strips, transposed into a vertical paper accordion.
  const panels = [...folds.querySelectorAll('.story-fold:not(.story-cover)')];
  panels.forEach((panel, index) => {
    const heading = panel.querySelector('summary').innerHTML;
    const content = panel.querySelector('.chapter-content').innerHTML;
    panel.classList.add('story-panel');
    panel.dataset.chapter = String(index + 1);
    panel.innerHTML = `<span class="panel-art" aria-hidden="true">0${index + 1}</span><button class="chapter-heading" id="chapter-heading-${index}" aria-expanded="false" aria-controls="chapter-body-${index}" type="button">${heading}</button><div class="chapter-content" id="chapter-body-${index}" role="region" aria-labelledby="chapter-heading-${index}">${content}</div>`;
  });
  if (tape.kind === 'memory') {
    const introduction = panels[0].querySelector('.chapter-content');
    for (const text of ["I am drawn more to natural landscapes than to scenes of everyday life. An introvert at heart, I find in nature a window beyond the noise and demands of social life—a little room to breathe and simply be.","Anime, comics, games, and novels helped me find my way out of a difficult period. The beauty I find in nature has since helped me stay grounded, giving me something to return to when life feels heavy."]) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      introduction.append(paragraph);
    }
    const camera = document.createElement('img');
    camera.className = 'album-camera';
    camera.src = './album-camera.png';
    camera.alt = 'A vintage film camera in warm watercolor tones';
    camera.width = 1536;
    camera.height = 1024;
    camera.decoding = 'async';
    panels[0].querySelector('.chapter-content').append(camera);
    const reflection = document.createElement('div');
    reflection.className = 'album-reflection';
    reflection.innerHTML = `<figure class="album-literary-quote"><blockquote lang="zh-CN">惟江上之清风，与山间之明月，耳得之而为声，目遇之而成色，取之无禁，用之不竭。</blockquote><figcaption>— <span lang="zh-CN">苏轼《赤壁赋》</span> · Su Shi, <cite>First Ode to the Red Cliffs</cite></figcaption></figure><p>Su Shi reminds us that the river breeze and the moon between the mountains become sound to our ears and color to our eyes—beauty freely shared and never exhausted. For me, photography is a way of cherishing these small gifts along a journey whose destination remains out of sight.</p>`;
    panels[2].querySelector('.chapter-content').append(reflection);

  }
  function expandChapter(index) {
    panels.forEach((panel, i) => {
      const open = i === index;
      panel.classList.toggle('is-expanded', open);
      panel.querySelector('.chapter-heading').setAttribute('aria-expanded', String(open));
      const content = panel.querySelector('.chapter-content');
      content.inert = !open;
      content.setAttribute('aria-hidden', String(!open));
    });
  }
  panels.forEach((panel, index) => {
    const heading = panel.querySelector('.chapter-heading');
    heading.addEventListener('click', () => expandChapter(index));
    heading.addEventListener('focus', () => expandChapter(index));
    panel.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && phase === 'open') expandChapter(index);
    });
    heading.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % panels.length;
      else if (event.key === 'ArrowUp') next = (index + panels.length - 1) % panels.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = panels.length - 1;
      if (next !== undefined) { event.preventDefault(); panels[next].querySelector('.chapter-heading').focus(); }
    });
  });
  expandChapter(tape.kind === 'memory' ? 1 : 0);
}
async function playTape() {
  const intended = selected;
  if (carouselMoving) await Promise.all(carouselMotions.map(motion => motion.finished.catch(() => {})));
  if (intended !== selected || archive.hidden) return;
  if (phase !== 'idle') return;
  phase = 'inserting'; const current = ++generation; archive.dataset.playing = 'true';
  archive.querySelector('.deck-status').textContent = 'READING';
  const cassette = cards[selected].querySelector('.cassette');
  cassette.style.setProperty('--rx', '0deg'); cassette.style.setProperty('--ry', '0deg');
  const origin = cassette.getBoundingClientRect(), slot = archive.querySelector('.tape-slot').getBoundingClientRect();
  const dx = slot.left + slot.width / 2 - origin.left - origin.width / 2, dy = slot.top + slot.height / 2 - origin.top - origin.height / 2;
  await animate(cassette, [{ transform: 'rotateX(0) rotateY(0)' }, { transform: `translate(${dx}px,${dy - 26}px) scale(.54) rotateX(28deg)`, opacity: 1, offset: .7 }, { transform: `translate(${dx}px,${dy}px) scale(.46) rotateX(65deg)`, opacity: 0 }], 850);
  if (current !== generation) return;
  phase = 'printing';
  archive.querySelector('.deck-status').textContent = 'PRINTING';
  const paper = archive.querySelector('.printer-proof');
  const initialHeight = paper.getBoundingClientRect().height;
  await animate(paper, [
    { height: `${initialHeight}px`, transform: 'perspective(300px) rotateX(-18deg)' },
    { height: `${Math.min(155, innerHeight * .22)}px`, transform: 'perspective(300px) rotateX(0deg)' }
  ], 1000);
  if (current !== generation) return;
  const printedPaper = paper.getBoundingClientRect();
  phase = 'opening'; fillStory(); overflowBefore = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal();
  archive.querySelector('.deck-status').textContent = 'PRINTING';
  const output = archive.querySelector('.paper-output').getBoundingClientRect();
  const box = story.getBoundingClientRect(), fromX = output.left + output.width / 2 - box.left - box.width / 2, fromY = output.top - box.bottom;
  await Promise.all([animate(story, [{ transform: `translate(${fromX}px,${fromY}px) scale(${printedPaper.width / box.width},${printedPaper.height / box.height})`, opacity: 1 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], 900), ...[...folds.children].map((fold, i) => animate(fold, [{ transform: `rotateX(${i % 2 ? -88 : 88}deg)`, opacity: .15 }, { transform: 'rotateX(0deg)', opacity: 1 }], 680, 180 + i * 110))]);
  if (current === generation) phase = 'open';
}
async function ejectTape(immediate = false) {
  if (phase === 'idle' || phase === 'closing') return;
  ++generation; phase = 'closing';
  if (dialog.open && !immediate) {
    const slot = archive.querySelector('.paper-output').getBoundingClientRect(), box = story.getBoundingClientRect();
    await animate(story, [{ transform: getComputedStyle(story).transform, opacity: 1 }, { transform: `translate(${slot.left + slot.width / 2 - box.left - box.width / 2}px,${slot.top - box.bottom}px) scale(.18,.04)`, opacity: 0 }], 450);
  }
  if (dialog.open) { dialog.close(); document.body.style.overflow = overflowBefore; }
  cancelAnimations(); delete archive.dataset.playing; archive.querySelector('.deck-status').textContent = 'READY'; phase = 'idle';
  if (!immediate && !archive.hidden) cards[selected].focus({ preventScroll: true });
}
let touchStart = null, suppressClick = false;
cards.forEach((card, i) => {
  card.addEventListener('click', () => { if (suppressClick) return; i === selected ? playTape() : selectTape(i); });
  card.addEventListener('pointermove', event => {
    if (i !== selected || phase !== 'idle' || carouselMoving || motionPreference.matches || event.pointerType === 'touch') return;
    const b = card.getBoundingClientRect(), cassette = card.querySelector('.cassette');
    cassette.style.setProperty('--ry', `${(event.clientX - b.left - b.width / 2) / b.width * 22}deg`);
    cassette.style.setProperty('--rx', `${-(event.clientY - b.top - b.height / 2) / b.height * 18}deg`);
    cassette.style.setProperty('--shine-x', `${(event.clientX - b.left) / b.width * 100}%`);
  });
  card.addEventListener('pointerleave', () => { const c = card.querySelector('.cassette'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
});
// Treat a wheel/trackpad burst as one cassette selection.
let wheelDistance = 0, lastWheelTime = -Infinity, wheelConsumed = false;
carousel.addEventListener('wheel', event => {
  if (archive.hidden || phase !== 'idle' || dialog.open || event.ctrlKey) return;
  if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  const now = performance.now();
  if (now - lastWheelTime > 180) {
    wheelDistance = 0;
    wheelConsumed = false;
  }
  lastWheelTime = now;
  if (carouselMoving) {
    wheelDistance = 0;
    wheelConsumed = true;
    return;
  }
  if (wheelConsumed) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? carousel.clientHeight : 1;
  const distance = event.deltaY * unit;
  if (Math.sign(distance) !== Math.sign(wheelDistance)) wheelDistance = 0;
  wheelDistance += distance;
  if (Math.abs(wheelDistance) < 40) return;
  wheelConsumed = true;
  selectTape(selected + Math.sign(wheelDistance));
}, { passive: false });

carousel.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); selectTape(selected + (event.key === 'ArrowRight' ? 1 : -1), true); }
  if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectTape(event.key === 'Home' ? 0 : 2, true); }
});
carousel.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touchStart = { x: e.clientX, y: e.clientY }; });
carousel.addEventListener('pointerup', e => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y; touchStart = null;
  if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) { suppressClick = true; selectTape(selected + (dx < 0 ? 1 : -1)); setTimeout(() => { suppressClick = false; }, 350); }
});
carousel.addEventListener('pointercancel', () => { touchStart = null; });
archive.querySelector('.story-close').addEventListener('click', () => ejectTape());
dialog.addEventListener('click', e => { if (e.target === dialog) ejectTape(); });
dialog.addEventListener('cancel', e => { e.preventDefault(); ejectTape(); });
archive.addEventListener('click', e => { if (['inserting', 'printing'].includes(phase) && !e.target.closest('button')) ejectTape(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ['inserting', 'printing'].includes(phase)) ejectTape(); });
window.addEventListener('hashchange', () => { if (location.hash !== '#scene2') ejectTape(true); });
selectTape(0);

const carouselResize = new ResizeObserver(() => {
  if (!archive.hidden && phase === 'idle') settleCarousel();
});
carouselResize.observe(carousel);

window.addEventListener('hashchange', settleCarousel);
