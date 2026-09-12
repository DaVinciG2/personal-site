import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = {
  '/': ['dist/index.html', 'text/html'],
  '/index.html': ['dist/index.html', 'text/html'],
  '/sun.png': ['dist/sun.png', 'image/png'],
  '/style.css': ['dist/style.css', 'text/css'],
  '/scene.js': ['dist/scene.js', 'text/javascript'],
  '/buffer1.txt': ['buffer1.txt', 'text/plain'],
  '/image.txt': ['image.txt', 'text/plain'],
};
createServer(async (request, response) => {
  const file = files[new URL(request.url, 'http://localhost').pathname];
  if (!file) { response.writeHead(404).end('Not found'); return; }
  try {
    const content = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(content);
  } catch { response.writeHead(500).end('Could not read file'); }
}).listen(5173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:5173'));
