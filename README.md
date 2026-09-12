# Cloud train scene

Run `npm run dev`, then open http://127.0.0.1:5173. No dependencies are required.

- The scene is exactly 200vh: an empty introduction from 0–100vh and a full-width shader canvas from 100–200vh.
- Edit the original `buffer1.txt` and `image.txt` files; the local server reads them directly. Run `npm run build` to copy them into `dist` for static hosting.
- Buffer pass: `iChannel0` is a fresh 1024×1024 random RGBA noise texture generated once per page load; `iChannel1` is the previous buffer frame, using two alternating render targets.
- Image pass: `iChannel0` is the current buffer output. Straight alpha fades from transparent at document 100vh to opaque at 200vh using smoothstep; the ivory page background shows through without a dark vignette. Cloud contours also use soft alpha compositing.
- Animation plays while the landscape is visible and pauses offscreen or in a hidden tab. Resizing clears feedback without regenerating noise.
- Requires WebGL 2. The page displays a message if shader loading or graphics initialization fails.

Validation: JavaScript syntax and static asset integrity checks. Browser rendering has not been visually tested.

Theme: #FFF4CC #FFEDE1 #F7CDB8 #E9A8A0 #C7A07E #F6DFA3 #E7C58F #D0A68B. Text and train details use darker sand/clay shades for contrast.
