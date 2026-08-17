import { distanceLabel, fillCityOptions, fillDistrictOptions, filterWithDistrictFallback, loadSiteData, setDistances } from './shared.js';

const PAGE_SIZE = 12;
const $ = id => document.getElementById(id);
const state = { stores: [], districts: null, settings: null, filtered: [], visible: PAGE_SIZE, userLocation: null, recommendationMode: 'direct' };
const collator = new Intl.Collator('zh-Hant');

function track(event, params={}) { window.dataLayer=window.dataLayer||[]; window.dataLayer.push({event,...params}); if(typeof window.gtag==='function') window.gtag('event',event,params); }
function reviewLabel(store) { return store.reviewCount === null ? '尚無評論資料' : `${store.reviewCount.toLocaleString('zh-TW')} 則評論`; }
function makeBadge(text, className = '') { const el = document.createElement('span'); el.className = `badge ${className}`; el.textContent = text; return el; }

function fillZones() { fillDistrictOptions($('zone'), $('area').value, state.districts, state.stores); }

function applyLabels() {
  const labels = state.settings.labels;
  $('importOnlyLabel').textContent = labels.importSpecialist;
  $('hybridOnlyLabel').textContent = labels.hybridSpecialist;
  $('tierOnlyLabel').textContent = labels.tierFilter;
  $('importStatLabel').textContent = labels.importSpecialist;
  $('hybridStatLabel').textContent = labels.hybridSpecialist;
  $('heroImportLabel').textContent = `✓ ${labels.importSpecialist}`;
  $('trustBadgeCopy').textContent = `「${labels.tierFilter}」、「${labels.importSpecialist}」及「${labels.hybridSpecialist}」均依 SUM 管理設定呈現；Google 星等與評論數會隨時間變動，請以點開後的 Google 商家頁面為準。`;
}

function sortStores(list) {
  const sort = $('sort').value; const fallback = state.recommendationMode !== 'direct';
  list.sort((a,b) => {
    if (fallback && (sort === 'recommended' || sort === 'distance')) return (a.recommendationDistance ?? Infinity) - (b.recommendationDistance ?? Infinity) || (b.rating ?? -1) - (a.rating ?? -1);
    if (sort === 'distance' && state.userLocation) return (a.distance ?? Infinity) - (b.distance ?? Infinity) || (b.rating ?? -1) - (a.rating ?? -1);
    if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
    if (sort === 'reviews') return (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
    if (sort === 'area') return collator.compare(`${a.area}${a.zone}${a.name}`, `${b.area}${b.zone}${b.name}`);
    return Number(b.serviceMeta.tier === 'tierA') - Number(a.serviceMeta.tier === 'tierA') || Number(b.serviceMeta.importSpecialist) - Number(a.serviceMeta.importSpecialist) || (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
  });
}

function filterStores() {
  const result = filterWithDistrictFallback({
    stores: state.stores, districts: state.districts, area: $('area').value, zone: $('zone').value,
    keyword: $('keyword').value, minRating: Number($('rating').value), importOnly: $('importOnly').checked,
    hybridOnly: $('hybridOnly').checked, tierOnly: $('tierOnly').checked, userLocation: state.userLocation
  });
  state.filtered = result.stores; state.recommendationMode = result.mode; sortStores(state.filtered); state.visible = PAGE_SIZE; render();
}

function createCard(store) {
  const card = $('storeCardTemplate').content.firstElementChild.cloneNode(true); const badges = card.querySelector('.badges');
  if (store.serviceMeta.tierLabel) badges.append(makeBadge(store.serviceMeta.tierLabel, 'gold'));
  if (store.serviceMeta.importSpecialist) badges.append(makeBadge(state.settings.labels.importSpecialist, 'import'));
  if (store.serviceMeta.hybridSpecialist) badges.append(makeBadge(state.settings.labels.hybridSpecialist, 'hybrid'));
  if (!badges.children.length) badges.append(makeBadge('SUM 聯盟保修'));
  card.querySelector('.store-code').textContent = store.code; card.querySelector('h3').textContent = store.name;
  const rating = card.querySelector('.rating-badge'); rating.href = store.placeId ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(store.placeId)}` : store.mapUrl;
  if (store.rating === null) { rating.classList.add('empty'); rating.querySelector('strong').textContent = '尚無評分'; rating.querySelector('span').textContent = ''; }
  else { rating.querySelector('strong').textContent = store.rating.toFixed(1); rating.querySelector('span').textContent = reviewLabel(store); }
  const address = card.querySelector('.address'); address.textContent = `${store.area}${store.zone}${store.address}`; address.href = store.mapUrl;
  card.querySelector('.hours').textContent = store.businessHours || '請電話洽詢';
  card.querySelector('.phone').textContent = store.phone || store.mobile || '請洽 SUM 客服';
  card.querySelector('.experience').textContent = store.experience || '提供 SUM 專業保養與維修服務。';
  const shownDistance = distanceLabel(store, state.recommendationMode !== 'direct');
  if (shownDistance) { const distance = document.createElement('p'); distance.className = 'card-distance'; distance.textContent = `${state.recommendationMode === 'district-fallback' ? '距離所選行政區中心約' : '距離目前位置約'} ${shownDistance}`; address.before(distance); }
  card.querySelector('.map-button').href = store.mapUrl; card.querySelector('.book-button').href = `/order?store=${encodeURIComponent(store.id)}&from=locator`;
  card.querySelector('.rating-date').textContent = store.rating === null ? 'SUM 官網尚未提供 Google 評價資料' : 'Google 評價資料更新：2026/08/13';
  card.querySelector('.share-button').addEventListener('click', () => shareStore(store)); return card;
}

function renderRecommendation() {
  const notice = $('recommendationNotice');
  if (state.recommendationMode === 'direct') { notice.hidden = true; return; }
  const area = $('area').value; const zone = $('zone').value; notice.hidden = false;
  notice.querySelector('strong').textContent = `${area}${zone}尚無據點，以下推薦鄰近店家`;
  if (state.recommendationMode === 'location-fallback') { notice.querySelector('span').textContent = '已依你的目前位置推薦最近的 SUM 據點。'; notice.querySelector('button').hidden = true; }
  else { notice.querySelector('span').textContent = '開啟定位會更精準'; notice.querySelector('button').hidden = false; }
}

function render() {
  $('resultCount').textContent = state.filtered.length.toLocaleString('zh-TW');
  $('storeGrid').replaceChildren(...state.filtered.slice(0, state.visible).map(createCard));
  $('emptyState').hidden = state.filtered.length !== 0; $('loadMore').hidden = state.visible >= state.filtered.length; renderRecommendation();
}

async function shareStore(store) {
  const text = `${store.name}｜${store.area}${store.zone}${store.address}`;
  try { if (navigator.share) await navigator.share({ title: store.name, text, url: store.mapUrl }); else { await navigator.clipboard.writeText(`${text}\n${store.mapUrl}`); showToast('據點資訊已複製'); } } catch (error) { if (error.name !== 'AbortError') showToast('目前無法分享，請稍後再試'); }
}

let toastTimer;
function showToast(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200); }
function finishReset() { state.userLocation = null; $('nearMe').classList.remove('located'); $('nearMe').querySelector('b').textContent = '使用目前位置'; $('nearbyStatus').textContent = '定位只會在你按下按鈕後啟用。'; $('sort').value = 'recommended'; fillZones(); filterStores(); }
function resetFilters() { $('filterForm').reset(); }

function requestLocation(preserveSelection = false) {
  const button = $('nearMe'); const status = $('nearbyStatus');
  if (!navigator.geolocation) { status.textContent = '此瀏覽器不支援定位，請改用地區搜尋。'; track('locator_location_unavailable'); return; }
  button.disabled = true; status.textContent = '正在取得你的位置…'; track('locator_location_request');
  navigator.geolocation.getCurrentPosition(position => {
    state.userLocation = {latitude:position.coords.latitude,longitude:position.coords.longitude}; setDistances(state.stores, state.userLocation);
    if (!preserveSelection) { $('area').value=''; fillZones(); $('keyword').value=''; }
    $('sort').value='distance'; filterStores(); button.disabled=false; button.classList.add('located'); button.querySelector('b').textContent='已使用目前位置'; status.textContent='已依距離重新排序，實際行車距離請以導航為準。';
    track('locator_location_success',{accuracy:Math.round(position.coords.accuracy||0)});
  }, error => { button.disabled=false; status.textContent = error.code===1 ? '你尚未允許定位，可繼續使用縣市或行政區搜尋。' : '目前無法取得位置，請改用地區搜尋。'; track('locator_location_error',{error_code:error.code}); }, {enableHighAccuracy:false,timeout:10000,maximumAge:300000});
}

async function init() {
  try {
    const { storesPayload, districts, settings, stores } = await loadSiteData(); state.stores = stores; state.districts = districts; state.settings = settings;
    applyLabels(); fillCityOptions($('area'), stores);
    $('storeTotal').textContent = stores.length.toLocaleString('zh-TW'); $('ratedTotal').textContent = stores.filter(store => store.rating !== null).length.toLocaleString('zh-TW');
    $('importTotal').textContent = stores.filter(store => store.serviceMeta.importSpecialist).length.toLocaleString('zh-TW'); $('hybridTotal').textContent = stores.filter(store => store.serviceMeta.hybridSpecialist).length.toLocaleString('zh-TW');
    document.querySelector('time').textContent = storesPayload.updatedAt.replaceAll('-', '/'); document.querySelector('time').dateTime = storesPayload.updatedAt; filterStores();
    const q = new URLSearchParams(location.search).get('q'); if (q) { $('keyword').value = q; filterStores(); }
  } catch (error) { $('storeGrid').innerHTML = `<p class="data-error">據點資料暫時無法載入，請前往 <a href="https://www.sum.com.tw/repair/StrongHoldSearch.html">SUM 官方據點查詢</a>。</p>`; console.error(error); }
}

$('filterForm').addEventListener('input', event => { if (event.target.id === 'area') fillZones(); filterStores(); });
$('filterForm').addEventListener('reset', () => setTimeout(finishReset));
$('sort').addEventListener('change', filterStores); $('loadMore').addEventListener('click', () => { state.visible += PAGE_SIZE; render(); });
$('emptyReset').addEventListener('click', resetFilters); $('nearMe').addEventListener('click', () => requestLocation(false)); $('recommendationLocation').addEventListener('click', () => requestLocation(true));
init();
