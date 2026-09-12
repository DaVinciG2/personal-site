# Cloud train scene

Run `npm run dev`, then open http://127.0.0.1:5173. No runtime dependencies are required.

- The scene is exactly 200vh: an empty introduction from 0–100vh and a full-width shader canvas from 100–200vh.
- Edit the original `buffer1.txt` and `image.txt` files; the local server reads them directly. Run `npm run build` to copy them into `dist` for static hosting.
- Buffer pass: `iChannel0` is a fresh 1024×1024 random RGBA noise texture generated once per page load; `iChannel1` is the previous buffer frame, using two alternating render targets.
- Image pass: `iChannel0` is the current buffer output. Straight alpha fades from transparent at document 100vh to opaque at 200vh using smoothstep; the ivory page background shows through without a dark vignette. Cloud contours also use soft alpha compositing.
- Animation plays while the landscape is visible and pauses offscreen or in a hidden tab. Resizing clears feedback without regenerating noise.
- Requires WebGL 2. The page displays a message if shader loading or graphics initialization fails.

Validation: JavaScript syntax and build checks. Scene two was checked in headless Edge at desktop, tablet, mobile, and landscape sizes (down to 320 x 568), including carousel selection, pointer tilt, touch swipe, insertion cancellation, accordion content, backdrop/Escape dismissal, focus restoration, reduced motion, and scene routing.

Theme: #FFF4CC #FFEDE1 #F7CDB8 #E9A8A0 #C7A07E #F6DFA3 #E7C58F #D0A68B. Text and train details use darker sand/clay shades for contrast.

Scene two (`#scene2`) is a 100vh / 100dvh cassette archive, styled with the same warm palette as scene one.
- Select a cassette by clicking a side card, using Left/Right keys, scrolling up/down over the cassette area, or swiping on touch devices. Wheel and trackpad gestures switch one tape at a time using the existing animation. Click the selected cassette to insert it into the recorder and unfold its story.
- Click outside the story, use the eject button, or press Escape to return. Story chapters can be expanded individually.
- Edit the three tape titles, subtitles, and chapter content in `dist/tapes.js`; visual styling is in `dist/tapes.css`. The photo album displays photographs grouped by the folders in `photogallery`. Click a photo to open the original in a new tab. Add photos to a location folder and run `npm run build` (also runs before `npm run dev`) to refresh the manifest and copy photos into `dist` for static hosting.
- The original rounded glass cassettes use CSS depth, layered shells, and pointer tilt. Reduced-motion preferences skip movement. The archive eyebrow, timeline controls, arrows, lower cassette captions and edition text have been removed.
- Set the `PORT` environment variable to use a different local preview port.

Cassette switching follows the supplied CSS Cards reference: previous/current/next positions exchange over 800ms with ease timing, 25-degree side rotation, 1.2/0.9 center/side scales and explicit overlap ordering. Each cassette retains its original glass artwork and six physical CSS surfaces. Transparent perspective containers do not intercept card clicks. Actual mouse selections in both directions, mobile edge clicks, interrupted switching, insertion and dismissal were verified in Edge.

Explicit cassette selection always uses its 800ms transition, including environments reporting prefers-reduced-motion. Hover and story effects retain their reduced-motion handling. Intermediate animation positions were verified in both preference modes.

The device is a cassette-reading archive printer: tape input on the front, a read/print status display, and a top paper outlet. Story expansion and retraction are anchored to the paper outlet. The former brand label and audio speakers were removed.

Printing now has an explicit one-second paper-feed stage between tape insertion and story expansion. User-triggered insertion, paper rise and unfolding retain visible durations in reduced-motion environments. The rising paper was measured across intermediate frames in both preference modes; Escape during printing cancels the sequence.

The printed story uses a vertical expanding-strip accordion inspired by the supplied video. One chapter expands while its siblings compress; hover, click, focus and Up/Down keys select a chapter. The content area scrolls within its expanded strip on small screens. Intermediate flex animation heights, exclusive expansion and dismissal were verified in Edge, including reduced-motion settings.
Scene two includes a framed cloud window behind the archive. It reuses buffer1.txt and image.txt with CLOUDS_ONLY enabled, omitting the train, smoke, and bridge. The window initializes on first view and pauses rendering while hidden; its resolution is capped separately from scene one.
