import { access, readFile } from 'node:fs/promises';
import { decorateStore, filterWithDistrictFallback, normalizeSettings } from '../shared.js';
const payload = JSON.parse(await readFile('data/stores.json', 'utf8'));
const districts = JSON.parse(await readFile('data/districts.json', 'utf8'));
const errors = [];
if (payload.stores.length < 200) errors.push(`Expected at least 200 stores, got ${payload.stores.length}`);
for (const store of payload.stores) {
  for (const key of ['id','code','name','area','zone','address','mapUrl']) if (!store[key]) errors.push(`${store.code || store.id}: missing ${key}`);
  if (store.rating !== null && (store.rating < 0 || store.rating > 5)) errors.push(`${store.code}: invalid rating ${store.rating}`);
  if (store.reviewCount !== null && store.reviewCount < 0) errors.push(`${store.code}: invalid review count`);
}
if (new Set(payload.stores.map(s => `${s.code}|${s.placeId}`)).size !== payload.stores.length) errors.push('Duplicate store key remains');
if (districts.count !== 368 || districts.cities.length !== 22) errors.push(`Expected 368 districts in 22 cities, got ${districts.count} in ${districts.cities.length}`);
for (const store of payload.stores) if (!districts.cities.some(city => city.name === store.area && city.districts.some(district => district.name === store.zone))) errors.push(`${store.code}: district ${store.area}${store.zone} not found`);
const emptyDistrict = districts.cities.flatMap(city => city.districts.map(district => ({ area: city.name, zone: district.name }))).find(place => !payload.stores.some(store => store.area === place.area && store.zone === place.zone));
const decorated = payload.stores.map(store => decorateStore(store, normalizeSettings()));
const districtFallback = filterWithDistrictFallback({ stores: decorated, districts, ...emptyDistrict });
if (districtFallback.mode !== 'district-fallback' || !districtFallback.stores.length || districtFallback.stores[0].recommendationDistance === null) errors.push('Administrative district fallback failed');
const locationFallback = filterWithDistrictFallback({ stores: decorated, districts, ...emptyDistrict, userLocation: { latitude: 25.04, longitude: 121.56 } });
if (locationFallback.mode !== 'location-fallback' || !locationFallback.stores.length) errors.push('Location fallback failed');
const sample = decorateStore(payload.stores[0], normalizeSettings({ labels: { tierA: '優選' }, storeOverrides: { [payload.stores[0].id]: { tier: 'tierA', hybridSpecialist: true } } }));
if (sample.serviceMeta.tierLabel !== '優選' || !sample.serviceMeta.hybridSpecialist) errors.push('Dynamic store label override failed');
const settings = normalizeSettings();
const decoratedStores = payload.stores.map(store => decorateStore(store, settings));
const googleGood = filterWithDistrictFallback({ stores: decoratedStores, districts, minRating: 4 });
if (!googleGood.stores.length || googleGood.stores.some(store => Number(store.rating) < 4)) errors.push('Google rating checkbox filter failed');
const tierAStores = filterWithDistrictFallback({ stores: decoratedStores, districts, selectedTier: 'tierA' });
if (!tierAStores.stores.length || tierAStores.stores.some(store => store.serviceMeta.tier !== 'tierA')) errors.push('Tier dropdown filter failed');
const seededHybrid = decoratedStores.find(store => String(store.id) === '235');
if (!seededHybrid?.serviceMeta.hybridSpecialist) errors.push('Seeded hybrid specialist badge failed');
for (const file of ['index.html','order.html','admin.html','styles.css','order.css','admin.css','app.js','order.js','admin.js','shared.js','netlify.toml','netlify/functions/settings.mts','assets/sum-baby.png','assets/sum-baby-wave.png']) await access(file);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Validated ${payload.stores.length} stores and ${districts.count} districts; ${payload.stores.filter(s=>s.rating!==null).length} rated; ${payload.stores.filter(s=>s.importSpecialist).length} import specialists.`);
