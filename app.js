const DATA_URL = '/data/stores.json';
const PAGE_SIZE = 12;
const $ = (id) => document.getElementById(id);
const state = { stores: [], filtered: [], visible: PAGE_SIZE, userLocation: null };
const collator = new Intl.Collator('zh-Hant');
function track(event, params={}) { window.dataLayer=window.dataLayer||[]; window.dataLayer.push({event,...params}); if(typeof window.gtag==='function') window.gtag('event',event,params); }

function escapeText(value = '') { return String(value).trim(); }
function reviewLabel(store) { return store.reviewCount === null ? '尚無評論資料' : `${store.reviewCount.toLocaleString('zh-TW')} 則評論`; }
function toRadians(value) { return value * Math.PI / 180; }
const cityCenters = {'基隆市':[25.13,121.74],'臺北市':[25.04,121.56],'新北市':[25.02,121.47],'桃園市':[24.99,121.30],'新竹縣':[24.83,121.01],'新竹市':[24.81,120.97],'苗栗縣':[24.56,120.82],'臺中市':[24.15,120.68],'彰化縣':[24.07,120.54],'南投縣':[23.96,120.97],'雲林縣':[23.71,120.43],'嘉義縣':[23.45,120.33],'嘉義市':[23.48,120.45],'臺南市':[23.00,120.23],'高雄市':[22.63,120.31],'屏東縣':[22.55,120.55],'宜蘭縣':[24.68,121.75],'花蓮縣':[23.99,121.60],'臺東縣':[22.76,121.15],'澎湖縣':[23.57,119.58],'金門縣':[24.45,118.38],'連江縣':[26.16,119.95]};
function validCoordinates(store) { if (!Array.isArray(store.coordinates) || store.coordinates.length !== 2) return false; const [lat, lon] = store.coordinates.map(Number); if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 21.7 || lat > 26.5 || lon < 118 || lon > 122.5) return false; const center=cityCenters[store.area]; return !center || distanceKm(center[0],center[1],lat,lon)<145; }
function distanceKm(lat1, lon1, lat2, lon2) { const earth = 6371; const dLat = toRadians(lat2-lat1); const dLon = toRadians(lon2-lon1); const a = Math.sin(dLat/2)**2 + Math.cos(toRadians(lat1))*Math.cos(toRadians(lat2))*Math.sin(dLon/2)**2; return earth*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
function calculateDistances() { if (!state.userLocation) return; state.stores.forEach(store => { store.distance = validCoordinates(store) ? distanceKm(state.userLocation.latitude,state.userLocation.longitude,Number(store.coordinates[0]),Number(store.coordinates[1])) : null; }); }

function fillAreas() {
  const order = ['基隆市','臺北市','新北市','桃園市','新竹縣','新竹市','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義縣','嘉義市','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
  const counts = new Map(); state.stores.forEach(s => counts.set(s.area, (counts.get(s.area) || 0) + 1));
  [...counts.keys()].sort((a,b) => order.indexOf(a) - order.indexOf(b)).forEach(area => $('area').add(new Option(`${area}（${counts.get(area)}）`, area)));
}

function fillZones() {
  const area = $('area').value; const zone = $('zone'); zone.innerHTML = '<option value="">全部行政區</option>';
  const zones = [...new Set(state.stores.filter(s => s.area === area).map(s => s.zone))].sort(collator.compare);
  zones.forEach(value => zone.add(new Option(value, value))); zone.disabled = !area;
}

function filterStores() {
  const keyword = $('keyword').value.trim().toLocaleLowerCase('zh-TW');
  const minRating = Number($('rating').value); const area = $('area').value; const zone = $('zone').value;
  state.filtered = state.stores.filter(store => {
    const haystack = `${store.name} ${store.code} ${store.area}${store.zone}${store.address}`.toLocaleLowerCase('zh-TW');
    return (!keyword || haystack.includes(keyword)) && (!area || store.area === area) && (!zone || store.zone === zone) && (!minRating || (store.rating !== null && store.rating >= minRating)) && (!$('importOnly').checked || store.importSpecialist) && (!$('goldOnly').checked || store.badge);
  });
  const sort = $('sort').value;
  state.filtered.sort((a,b) => sort === 'distance' && state.userLocation ? (a.distance ?? Infinity) - (b.distance ?? Infinity) || (b.rating ?? -1) - (a.rating ?? -1) : sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount : sort === 'reviews' ? (b.reviewCount ?? -1) - (a.reviewCount ?? -1) : sort === 'area' ? collator.compare(`${a.area}${a.zone}${a.name}`, `${b.area}${b.zone}${b.name}`) : Number(b.badge === '金鑽') - Number(a.badge === '金鑽') || Number(b.importSpecialist) - Number(a.importSpecialist) || (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? -1) - (a.reviewCount ?? -1));
  state.visible = PAGE_SIZE; render();
}

function makeBadge(text, className = '') { const el = document.createElement('span'); el.className = `badge ${className}`; el.textContent = text; return el; }

function createCard(store) {
  const card = $('storeCardTemplate').content.firstElementChild.cloneNode(true);
  const badges = card.querySelector('.badges');
  if (store.badge) badges.append(makeBadge(store.badge, 'gold'));
  if (store.importSpecialist) badges.append(makeBadge('進口車專修廠', 'import'));
  if (!store.badge && !store.importSpecialist) badges.append(makeBadge('SUM 聯盟保修'));
  card.querySelector('.store-code').textContent = store.code;
  card.querySelector('h3').textContent = store.name;
  const rating = card.querySelector('.rating-badge'); rating.href = store.placeId ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(store.placeId)}` : store.mapUrl;
  if (store.rating === null) { rating.classList.add('empty'); rating.querySelector('strong').textContent = '尚無評分'; rating.querySelector('span').textContent = ''; }
  else { rating.querySelector('strong').textContent = store.rating.toFixed(1); rating.querySelector('span').textContent = reviewLabel(store); }
  const address = card.querySelector('.address'); address.textContent = `${store.area}${store.zone}${store.address}`; address.href = store.mapUrl;
  card.querySelector('.hours').textContent = store.businessHours || '請電話洽詢';
  const phone = card.querySelector('.phone'); phone.textContent = store.phone || store.mobile || '請洽 SUM 客服';
  const experience = card.querySelector('.experience'); experience.textContent = store.experience || '提供 SUM 專業保養與維修服務。';
  if (store.distance !== null && store.distance !== undefined) { const distance = document.createElement('p'); distance.className = 'card-distance'; distance.textContent = `距離目前位置約 ${store.distance < 10 ? store.distance.toFixed(1) : Math.round(store.distance)} km`; address.before(distance); }
  const map = card.querySelector('.map-button'); map.href = store.mapUrl;
  const book = card.querySelector('.book-button'); book.href = `/order?store=${encodeURIComponent(store.id)}&from=locator`;
  card.querySelector('.rating-date').textContent = store.rating === null ? 'SUM 官網尚未提供 Google 評價資料' : 'Google 評價資料更新：2026/08/13';
  card.querySelector('.share-button').addEventListener('click', () => shareStore(store));
  return card;
}

function render() {
  $('resultCount').textContent = state.filtered.length.toLocaleString('zh-TW');
  const grid = $('storeGrid'); grid.replaceChildren(...state.filtered.slice(0, state.visible).map(createCard));
  $('emptyState').hidden = state.filtered.length !== 0; $('loadMore').hidden = state.visible >= state.filtered.length;
}

async function shareStore(store) {
  const text = `${store.name}｜${store.area}${store.zone}${store.address}`; const url = store.mapUrl;
  try { if (navigator.share) await navigator.share({ title: store.name, text, url }); else { await navigator.clipboard.writeText(`${text}\n${url}`); showToast('據點資訊已複製'); } } catch (error) { if (error.name !== 'AbortError') showToast('目前無法分享，請稍後再試'); }
}
let toastTimer; function showToast(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200); }
function resetFilters() { $('filterForm').reset(); $('sort').value = 'recommended'; fillZones(); filterStores(); }
function requestLocation() {
  const button = $('nearMe'); const status = $('nearbyStatus');
  if (!navigator.geolocation) { status.textContent = '此瀏覽器不支援定位，請改用地區搜尋。'; track('locator_location_unavailable'); return; }
  button.disabled = true; status.textContent = '正在取得你的位置…'; track('locator_location_request');
  navigator.geolocation.getCurrentPosition(position => { state.userLocation = {latitude:position.coords.latitude,longitude:position.coords.longitude}; calculateDistances(); $('area').value=''; fillZones(); $('keyword').value=''; $('sort').value='distance'; filterStores(); button.disabled=false; button.classList.add('located'); button.querySelector('b').textContent='已使用目前位置'; status.textContent='已依距離重新排序，實際行車距離請以導航為準。'; track('locator_location_success',{accuracy:Math.round(position.coords.accuracy||0)}); }, error => { button.disabled=false; status.textContent = error.code===1 ? '你尚未允許定位，可繼續使用縣市或行政區搜尋。' : '目前無法取得位置，請改用地區搜尋。'; track('locator_location_error',{error_code:error.code}); }, {enableHighAccuracy:false,timeout:10000,maximumAge:300000});
}

async function init() {
  try {
    const response = await fetch(DATA_URL); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json(); state.stores = payload.stores;
    $('storeTotal').textContent = payload.stores.length.toLocaleString('zh-TW'); $('ratedTotal').textContent = payload.stores.filter(s => s.rating !== null).length.toLocaleString('zh-TW'); $('importTotal').textContent = payload.stores.filter(s => s.importSpecialist).length.toLocaleString('zh-TW');
    fillAreas(); state.filtered = [...state.stores]; filterStores();
    document.querySelector('time').textContent = payload.updatedAt.replaceAll('-', '/'); document.querySelector('time').dateTime = payload.updatedAt;
    const schema = { '@context':'https://schema.org', '@type':'WebSite', name:'SUM 保修據點搜尋', description:'搜尋全台 SUM 汽車保修據點、Google 評價與專業標章。', dateModified:payload.updatedAt, potentialAction:{'@type':'SearchAction',target:`${location.origin}/?q={search_term_string}`,'query-input':'required name=search_term_string'} };
    const script = document.createElement('script'); script.type = 'application/ld+json'; script.textContent = JSON.stringify(schema); document.head.append(script);
    const q = new URLSearchParams(location.search).get('q'); if (q) { $('keyword').value = q; filterStores(); }
  } catch (error) { $('storeGrid').innerHTML = `<p class="data-error">據點資料暫時無法載入，請前往 <a href="https://www.sum.com.tw/repair/StrongHoldSearch.html">SUM 官方據點查詢</a>。</p>`; console.error(error); }
}

$('filterForm').addEventListener('input', event => { if (event.target.id === 'area') fillZones(); filterStores(); });
$('filterForm').addEventListener('reset', () => setTimeout(() => { fillZones(); filterStores(); }));
$('sort').addEventListener('change', filterStores); $('loadMore').addEventListener('click', () => { state.visible += PAGE_SIZE; render(); }); $('emptyReset').addEventListener('click', resetFilters);
$('nearMe').addEventListener('click', requestLocation);
init();
