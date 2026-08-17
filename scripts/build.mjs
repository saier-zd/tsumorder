import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', {recursive:true,force:true}); await mkdir('dist');
for (const path of ['index.html','order.html','admin.html','styles.css','order.css','admin.css','app.js','order.js','admin.js','shared.js','data','assets']) await cp(path, `dist/${path}`, {recursive:true});
console.log('Built static site to dist/');
