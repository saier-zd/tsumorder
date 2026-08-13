const DATA_URL = '/data/stores.json';
const $ = id => document.getElementById(id);
const state = { step: 1, stores: [], filtered: [], service: '', store: null, date: '', time: '', visibleStores: 3, userLocation: null, storePreset: false };
const cityOrder = ['基隆市','臺北市','新北市','桃園市','新竹縣','新竹市','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義縣','嘉義市','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
const titles = ['今天想處理什麼？','選擇方便的服務據點','選擇希望到店的時間','留下聯絡資料'];
const form = $('bookingForm');

function track(event, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, booking_step: state.step, ...params });
  if (typeof window.gtag === 'function') window.gtag('event', event, params);
}

function setStep(next) {
  state.step = Math.max(1, Math.min(4, next));
  document.querySelectorAll('.form-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === state.step));
  document.querySelectorAll('.stepper li').forEach((el, index) => { el.classList.toggle('active', index + 1 <= state.step); el.classList.toggle('done', index + 1 < state.step); });
  $('stepCounter').textContent = `步驟 ${state.step}／4`; $('bookingTitle').textContent = titles[state.step - 1];
  $('backButton').textContent = state.step === 1 ? '返回據點查詢' : '上一步';
  $('nextButton').textContent = state.step === 4 ? '送出預約' : state.step === 1 && state.storePreset && state.store ? '下一步：選時間' : state.step === 1 ? '下一步：選據點' : state.step === 2 ? '下一步：選時間' : '下一步：留資料';
  updateNext(); track('booking_step_view', { step_name: ['service','store','datetime','contact'][state.step - 1] });
  window.scrollTo({ top: document.querySelector('.booking-layout').offsetTop - 88, behavior: 'smooth' });
}

function updateSummary() {
  $('summaryService').textContent = state.service || '尚未選擇';
  $('summaryStore').textContent = state.store ? state.store.name : '尚未選擇';
  $('summaryTime').textContent = state.date && state.time ? `${state.date} ${state.time}` : '尚未選擇';
  $('serviceValue').value = state.service; $('storeIdValue').value = state.store?.id || ''; $('storeCodeValue').value = state.store?.code || ''; $('storeNameValue').value = state.store?.name || ''; $('dateValue').value = state.date; $('timeValue').value = state.time;
}

function updateNext() {
  const valid = state.step === 1 ? !!state.service : state.step === 2 ? !!state.store : state.step === 3 ? !!state.date && !!state.time : true;
  $('nextButton').disabled = !valid;
}

function fillAreas() {
  [...new Set(state.stores.map(s => s.area))].sort((a,b) => cityOrder.indexOf(a) - cityOrder.indexOf(b)).forEach(area => $('bookingArea').add(new Option(area, area)));
}

function fillZones() {
  const area = $('bookingArea').value; const zone = $('bookingZone'); zone.innerHTML = '<option value="">全部行政區</option>';
  [...new Set(state.stores.filter(s => s.area === area).map(s => s.zone))].sort().forEach(value => zone.add(new Option(value, value))); zone.disabled = !area;
}

function toRadians(value) { return value * Math.PI / 180; }
const cityCenters = {'基隆市':[25.13,121.74],'臺北市':[25.04,121.56],'新北市':[25.02,121.47],'桃園市':[24.99,121.30],'新竹縣':[24.83,121.01],'新竹市':[24.81,120.97],'苗栗縣':[24.56,120.82],'臺中市':[24.15,120.68],'彰化縣':[24.07,120.54],'南投縣':[23.96,120.97],'雲林縣':[23.71,120.43],'嘉義縣':[23.45,120.33],'嘉義市':[23.48,120.45],'臺南市':[23.00,120.23],'高雄市':[22.63,120.31],'屏東縣':[22.55,120.55],'宜蘭縣':[24.68,121.75],'花蓮縣':[23.99,121.60],'臺東縣':[22.76,121.15],'澎湖縣':[23.57,119.58],'金門縣':[24.45,118.38],'連江縣':[26.16,119.95]};
function validCoordinates(store) {
  if (!Array.isArray(store.coordinates) || store.coordinates.length !== 2) return false;
  const [lat, lon] = store.coordinates.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 21.7 || lat > 26.5 || lon < 118 || lon > 122.5) return false;
  const center = cityCenters[store.area]; return !center || distanceKm(center[0], center[1], lat, lon) < 145;
}
function distanceKm(lat1, lon1, lat2, lon2) {
  const earth = 6371; const dLat = toRadians(lat2 - lat1); const dLon = toRadians(lon2 - lon1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function calculateDistances() {
  if (!state.userLocation) return;
  state.stores.forEach(store => {
    store.distance = validCoordinates(store) ? distanceKm(state.userLocation.latitude, state.userLocation.longitude, Number(store.coordinates[0]), Number(store.coordinates[1])) : null;
  });
}

function filterStores() {
  const area = $('bookingArea').value; const zone = $('bookingZone').value; const keyword = $('bookingKeyword').value.trim().toLowerCase();
  state.filtered = state.stores.filter(s => (!area || s.area === area) && (!zone || s.zone === zone) && (!keyword || `${s.name}${s.code}${s.area}${s.zone}${s.address}`.toLowerCase().includes(keyword)));
  state.filtered.sort((a,b) => state.userLocation ? (a.distance ?? Infinity) - (b.distance ?? Infinity) || (b.rating ?? -1) - (a.rating ?? -1) : Number(b.badge === '金鑽') - Number(a.badge === '金鑽') || (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? -1) - (a.reviewCount ?? -1));
  state.visibleStores = 3; renderStores();
}

function renderStores() {
  const list = $('bookingStoreList'); list.replaceChildren(...state.filtered.slice(0, state.visibleStores).map(store => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `booking-store${state.store?.id === store.id ? ' selected' : ''}`;
    const tags = [store.badge, store.importSpecialist ? '進口車專修' : ''].filter(Boolean);
    const distance = store.distance === null || store.distance === undefined ? '' : `<em class="distance">距離約 ${store.distance < 10 ? store.distance.toFixed(1) : Math.round(store.distance)} km</em>`;
    button.innerHTML = `<div><h3>${store.name}</h3>${distance}<p>${store.area}${store.zone}${store.address}<br>${store.businessHours || '營業時間請電話洽詢'}</p><div class="mini-badges">${tags.map(tag => `<span>${tag}</span>`).join('')}</div></div><div class="store-score"><b>${store.rating === null ? '—' : `★ ${store.rating.toFixed(1)}`}</b><small>${store.reviewCount === null ? '尚無評論資料' : `${store.reviewCount.toLocaleString('zh-TW')} 則`}</small></div>`;
    button.addEventListener('click', () => selectStore(store)); return button;
  }));
  if (!state.filtered.length) list.innerHTML = '<p class="availability-note">沒有符合條件的據點，請調整地區或搜尋文字。</p>';
  $('showMoreStores').hidden = state.visibleStores >= state.filtered.length;
}

function selectStore(store) {
  state.store = store; state.storePreset = false; state.date = ''; state.time = ''; renderStores(); renderDates(); updateSummary(); updateNext();
  track('booking_store_select', { store_id: store.id, store_name: store.name });
}

function nextDates() {
  const dates = []; const cursor = new Date(); cursor.setHours(12,0,0,0);
  for (let offset = 1; dates.length < 8 && offset <= 16; offset++) { const date = new Date(cursor); date.setDate(cursor.getDate() + offset); if (date.getDay() !== 0) dates.push(date); }
  return dates;
}

function dateLabel(date) { return `${date.getMonth()+1}/${date.getDate()}`; }
function dateValue(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function weekday(date) { return ['日','一','二','三','四','五','六'][date.getDay()]; }

function renderDates() {
  if (!state.store) return;
  const distance = state.store.distance === null || state.store.distance === undefined ? '' : `・距離約 ${state.store.distance < 10 ? state.store.distance.toFixed(1) : Math.round(state.store.distance)} km`;
  $('selectedStoreBanner').innerHTML = `<div><b>${state.store.name}</b><span>${state.store.area}${state.store.zone}${state.store.address}${distance}</span></div><button id="changeStore" type="button">更換據點</button>`;
  $('changeStore').addEventListener('click', () => { state.storePreset = false; setStep(2); });
  $('dateOptions').replaceChildren(...nextDates().map(date => {
    const value = dateValue(date); const button = document.createElement('button'); button.type = 'button'; button.className = state.date === value ? 'selected' : ''; button.innerHTML = `<span>${dateLabel(date)}</span><small>週${weekday(date)}</small>`;
    button.addEventListener('click', () => { state.date = value; state.time = ''; renderDates(); updateSummary(); updateNext(); }); return button;
  }));
  const slots = ['上午 09:00–12:00','下午 13:00–17:00','傍晚 17:00–19:00'];
  $('timeOptions').replaceChildren(...slots.map(slot => { const button = document.createElement('button'); button.type = 'button'; button.textContent = slot; button.disabled = !state.date; button.className = state.time === slot ? 'selected' : ''; button.addEventListener('click', () => { state.time = slot; renderDates(); updateSummary(); updateNext(); }); return button; }));
}

function requestLocation() {
  const button = $('useLocation'); const status = $('locationStatus');
  if (!navigator.geolocation) { status.textContent = '此瀏覽器不支援定位，請改用縣市或行政區搜尋。'; track('booking_location_unavailable'); return; }
  button.disabled = true; button.classList.add('loading'); status.textContent = '正在取得你的位置…'; track('booking_location_request');
  navigator.geolocation.getCurrentPosition(position => {
    state.userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude }; state.store = null; state.storePreset = false; state.date = ''; state.time = ''; calculateDistances();
    $('bookingArea').value = ''; fillZones(); $('bookingKeyword').value = ''; filterStores();
    button.classList.remove('loading'); button.classList.add('located'); button.querySelector('strong').textContent = '已使用目前位置'; status.textContent = '已依距離重新排序，實際行車距離請以導航為準。'; button.disabled = false;
    updateSummary(); updateNext(); track('booking_location_success', { accuracy: Math.round(position.coords.accuracy || 0) });
  }, error => {
    button.disabled = false; button.classList.remove('loading'); status.textContent = error.code === 1 ? '你尚未允許定位，可繼續使用縣市或行政區搜尋。' : '目前無法取得位置，請改用地區搜尋。';
    track('booking_location_error', { error_code: error.code });
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function validateContact() {
  const name = form.elements.name; const phone = form.elements.phone; const consent = form.elements.privacy_consent;
  if (!name.value.trim()) return showError('請輸入姓名。', name);
  if (!/^09\d{8}$/.test(phone.value.replace(/[\s-]/g,''))) return showError('請輸入正確的 10 碼手機號碼。', phone);
  phone.value = phone.value.replace(/[\s-]/g,'');
  if (!consent.checked) return showError('請勾選個人資料使用同意。', consent);
  $('formError').textContent = ''; return true;
}

function showError(message, field) { $('formError').textContent = message; field.focus(); return false; }

async function submitBooking() {
  if (!validateContact()) return;
  $('nextButton').disabled = true; $('nextButton').textContent = '送出中…'; track('quick_reserve_submit', { service: state.service, store_id: state.store.id, store_name: state.store.name });
  try {
    const response = await fetch('/order.html', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(new FormData(form)).toString() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    form.hidden = true; document.querySelector('.progress-wrap').hidden = true; $('bookingSuccess').hidden = false; $('successStore').textContent = state.store.name; $('successSummary').textContent = `${state.service}｜${state.date} ${state.time}`;
    track('booking_success', { service: state.service, store_id: state.store.id, store_name: state.store.name }); window.scrollTo({ top: document.querySelector('.booking-card').offsetTop - 88, behavior:'smooth' });
  } catch (error) { $('formError').textContent = '目前暫時無法送出，請稍後再試，或撥 0800-523-168 由客服協助。'; $('nextButton').disabled = false; $('nextButton').textContent = '重新送出'; console.error(error); }
}

function bindEvents() {
  $('serviceOptions').addEventListener('click', event => { const button = event.target.closest('[data-service]'); if (!button) return; state.service = button.dataset.service; document.querySelectorAll('[data-service]').forEach(el => el.classList.toggle('selected', el === button)); updateSummary(); updateNext(); track('booking_service_select', { service: state.service }); });
  const clearHiddenStore = () => { if (state.store && !state.filtered.some(store => store.id === state.store.id)) { state.store = null; state.storePreset = false; state.date = ''; state.time = ''; renderStores(); updateSummary(); updateNext(); } };
  $('bookingArea').addEventListener('change', () => { fillZones(); filterStores(); clearHiddenStore(); }); $('bookingZone').addEventListener('change', () => { filterStores(); clearHiddenStore(); }); $('bookingKeyword').addEventListener('input', () => { filterStores(); clearHiddenStore(); });
  $('useLocation').addEventListener('click', requestLocation);
  $('showMoreStores').addEventListener('click', () => { state.visibleStores += 6; renderStores(); });
  $('backButton').addEventListener('click', () => state.step === 1 ? location.assign('/') : state.step === 3 && state.storePreset ? setStep(1) : setStep(state.step - 1));
  $('nextButton').addEventListener('click', () => { if (state.step === 1 && state.storePreset && state.store) setStep(3); else if (state.step < 4) setStep(state.step + 1); else submitBooking(); });
  form.addEventListener('submit', event => { event.preventDefault(); submitBooking(); });
}

async function init() {
  const params = new URLSearchParams(location.search); $('sourceValue').value = params.get('from') || document.referrer || 'direct';
  try { const response = await fetch(DATA_URL); if (!response.ok) throw new Error(`HTTP ${response.status}`); const payload = await response.json(); state.stores = payload.stores; state.filtered = [...state.stores]; fillAreas();
    const storeId = params.get('store'); const selected = storeId ? state.stores.find(store => store.id === storeId) : null;
    if (selected) { $('bookingArea').value = selected.area; fillZones(); $('bookingZone').value = selected.zone; state.store = selected; state.storePreset = true; filterStores(); $('storeHint').textContent = `已從據點查詢帶入「${selected.name}」，你也可以改選其他店家。`; }
    else filterStores(); renderDates(); updateSummary(); bindEvents(); setStep(1); track('booking_start', { source: $('sourceValue').value });
  } catch (error) { document.querySelector('.booking-card').innerHTML = '<div class="booking-success"><h2>據點資料暫時無法載入</h2><p>請稍後再試，或撥 0800-523-168 由客服協助預約。</p><a href="/">返回據點查詢</a></div>'; console.error(error); }
}

init();
