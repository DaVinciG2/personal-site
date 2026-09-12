import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

import { resolve, sep, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const files = {
  '/activities/jakobson-model.svg': ['dist/activities/jakobson-model.svg', 'image/svg+xml'],
  '/activities/memorify-testing.png': ['dist/activities/memorify-testing.png', 'image/png'],
  '/activities/vn-website.png': ['dist/activities/vn-website.png', 'image/png'],
  '/activities/vn-recruitment.jpg': ['dist/activities/vn-recruitment.jpg', 'image/jpeg'],
  '/activities/alive-renewal-translation.png': ['dist/activities/alive-renewal-translation.png', 'image/png'],
  '/activities/memorify-development.png': ['dist/activities/memorify-development.png', 'image/png'],
  '/activities/priming-paper.pdf': ['dist/activities/priming-paper.pdf', 'application/pdf'],
  '/activities/chinese-writing-guide.md': ['dist/activities/chinese-writing-guide.md', 'text/markdown'],
  '/photo-albums.js': ['dist/photo-albums.js', 'text/javascript'],
  '/': ['dist/index.html', 'text/html'],
  '/index.html': ['dist/index.html', 'text/html'],
  '/album-camera.png': ['dist/album-camera.png', 'image/png'],
  '/sun.png': ['dist/sun.png', 'image/png'],
  '/style.css': ['dist/style.css', 'text/css'],
  '/tapes.js': ['dist/tapes.js', 'text/javascript'],
  '/tapes.css': ['dist/tapes.css', 'text/css'],
  '/scene.js': ['dist/scene.js', 'text/javascript'],
  '/buffer1.txt': ['buffer1.txt', 'text/plain'],
  '/image.txt': ['image.txt', 'text/plain'],
};
const imageTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const photoRoot = fileURLToPath(new URL('./dist/photogallery/', import.meta.url));
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let file = files[pathname];
  if (!file && pathname.startsWith('/photogallery/')) {
    let decoded;
    try { decoded = decodeURIComponent(pathname.slice('/photogallery/'.length)); }
    catch { response.writeHead(400).end('Invalid path'); return; }
    const target = resolve(photoRoot, decoded);
    const mime = imageTypes[extname(target).slice(1).toLowerCase()];
    if (target.startsWith(resolve(photoRoot) + sep) && mime && !decoded.includes('\0')) {
      file = [target, mime];
    }
  }
  if (!file) { response.writeHead(404).end('Not found'); return; }
  try {
    const content = await readFile(isAbsolute(file[0]) ? file[0] : new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(content);
  } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Could not read file'); }
}).listen(Number(process.env.PORT) || 5173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + (Number(process.env.PORT) || 5173)));
