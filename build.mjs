import { copyFileSync } from 'node:fs';
for (const file of ['buffer1.txt', 'image.txt']) copyFileSync(file, `dist/${file}`);
console.log('Shader sources synced to dist.');
