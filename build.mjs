import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
for (const file of ['buffer1.txt', 'image.txt']) copyFileSync(file, `dist/${file}`);
const albums = [];
for (const folder of readdirSync('photogallery', { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!folder.isDirectory()) continue;
  const photos = readdirSync(join('photogallery', folder.name), { withFileTypes: true }).filter(file => file.isFile() && /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)).map(file => file.name).sort();
  if (!photos.length) continue;
  mkdirSync(join('dist/photogallery', folder.name), { recursive: true });
  for (const photo of photos) copyFileSync(join('photogallery', folder.name, photo), join('dist/photogallery', folder.name, photo));
  albums.push({ place: folder.name, photos: photos.map(photo => './photogallery/' + encodeURIComponent(folder.name) + '/' + encodeURIComponent(photo)) });
}
writeFileSync('dist/photo-albums.js', 'export const photoAlbums = ' + JSON.stringify(albums, null, 2) + ';\n');
console.log('Synced ' + albums.reduce((total, album) => total + album.photos.length, 0) + ' photos in ' + albums.length + ' albums.');
