# Cloud train scene

Run `npm run dev`, then open http://127.0.0.1:5173. No dependencies are required.

- The scene is exactly 200vh: an empty introduction from 0–100vh and a full-width shader canvas from 100–200vh.
- Edit the original `buffer1.txt` and `image.txt` files; the local server reads them directly. Run `npm run build` to copy them into `dist` for static hosting.
- Buffer pass: `iChannel0` is a fresh 1024×1024 random RGBA noise texture generated once per page load; `iChannel1` is the previous buffer frame, using two alternating render targets.
- Image pass: `iChannel0` is the current buffer output. This preserves the supplied image shader's vignette.
- Animation plays while the landscape is visible and pauses offscreen or in a hidden tab. Resizing clears feedback without regenerating noise.
- Requires WebGL 2. The page displays a message if shader loading or graphics initialization fails.

Validation: JavaScript syntax and static asset integrity checks. Browser rendering has not been visually tested.
