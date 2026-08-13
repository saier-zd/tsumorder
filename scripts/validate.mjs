import { access, readFile } from 'node:fs/promises';
const payload = JSON.parse(await readFile('data/stores.json', 'utf8'));
const errors = [];
if (payload.stores.length < 200) errors.push(`Expected at least 200 stores, got ${payload.stores.length}`);
for (const store of payload.stores) {
  for (const key of ['id','code','name','area','zone','address','mapUrl']) if (!store[key]) errors.push(`${store.code || store.id}: missing ${key}`);
  if (store.rating !== null && (store.rating < 0 || store.rating > 5)) errors.push(`${store.code}: invalid rating ${store.rating}`);
  if (store.reviewCount !== null && store.reviewCount < 0) errors.push(`${store.code}: invalid review count`);
}
if (new Set(payload.stores.map(s => `${s.code}|${s.placeId}`)).size !== payload.stores.length) errors.push('Duplicate store key remains');
for (const file of ['index.html','styles.css','app.js','netlify.toml','assets/sum-baby.png','assets/sum-baby-wave.png']) await access(file);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Validated ${payload.stores.length} stores; ${payload.stores.filter(s=>s.rating!==null).length} rated; ${payload.stores.filter(s=>s.importSpecialist).length} import specialists.`);
