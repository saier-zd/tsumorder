const DATA_URL = '/data/stores.json';
const PAGE_SIZE = 12;
const $ = (id) => document.getElementById(id);
const state = { stores: [], filtered: [], visible: PAGE_SIZE };
const collator = new Intl.Collator('zh-Hant');

function escapeText(value = '') { return String(value).trim(); }
function reviewLabel(store) { return store.reviewCount === null ? '尚無評論資料' : `${store.reviewCount.toLocaleString('zh-TW')} 則評論`; }
function officialUrl(path) { return `https://www.sum.com.tw/repair/${path}`; }

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
  state.filtered.sort((a,b) => sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount : sort === 'reviews' ? (b.reviewCount ?? -1) - (a.reviewCount ?? -1) : sort === 'area' ? collator.compare(`${a.area}${a.zone}${a.name}`, `${b.area}${b.zone}${b.name}`) : Number(b.badge === '金鑽') - Number(a.badge === '金鑽') || Number(b.importSpecialist) - Number(a.importSpecialist) || (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? -1) - (a.reviewCount ?? -1));
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
  const map = card.querySelector('.map-button'); map.href = store.mapUrl;
  const book = card.querySelector('.book-button'); book.href = officialUrl(`order.php?country=${encodeURIComponent(store.area)}&store=${encodeURIComponent(store.id)}`);
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
init();
