export const DATA_URL = '/data/stores.json';
export const DISTRICTS_URL = '/data/districts.json';
export const SETTINGS_URL = '/api/settings';
export const CITY_ORDER = ['基隆市','臺北市','新北市','桃園市','新竹縣','新竹市','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義縣','嘉義市','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
export const DEFAULT_SETTINGS = {
  version: 1,
  labels: {
    tierA: '金鑽',
    tierB: '金質',
    tierFilter: '金鑽／金質',
    importSpecialist: '進口車專修廠',
    hybridSpecialist: '油電車專修廠'
  },
  storeOverrides: {}
};

const cityCenters = {'基隆市':[25.13,121.74],'臺北市':[25.04,121.56],'新北市':[25.02,121.47],'桃園市':[24.99,121.30],'新竹縣':[24.83,121.01],'新竹市':[24.81,120.97],'苗栗縣':[24.56,120.82],'臺中市':[24.15,120.68],'彰化縣':[24.07,120.54],'南投縣':[23.96,120.97],'雲林縣':[23.71,120.43],'嘉義縣':[23.45,120.33],'嘉義市':[23.48,120.45],'臺南市':[23.00,120.23],'高雄市':[22.63,120.31],'屏東縣':[22.55,120.55],'宜蘭縣':[24.68,121.75],'花蓮縣':[23.99,121.60],'臺東縣':[22.76,121.15],'澎湖縣':[23.57,119.58],'金門縣':[24.45,118.38],'連江縣':[26.16,119.95]};

export function normalizeSettings(value = {}) {
  return {
    version: 1,
    labels: { ...DEFAULT_SETTINGS.labels, ...(value.labels || {}) },
    storeOverrides: value.storeOverrides && typeof value.storeOverrides === 'object' ? value.storeOverrides : {}
  };
}

export async function loadSiteData() {
  const [storesResponse, districtsResponse, settingsResult] = await Promise.all([
    fetch(DATA_URL),
    fetch(DISTRICTS_URL),
    fetch(SETTINGS_URL, { headers: { Accept: 'application/json' } }).catch(() => null)
  ]);
  if (!storesResponse.ok || !districtsResponse.ok) throw new Error('據點或行政區資料無法載入');
  const [storesPayload, districts] = await Promise.all([storesResponse.json(), districtsResponse.json()]);
  const settings = settingsResult?.ok ? normalizeSettings(await settingsResult.json()) : normalizeSettings();
  return { storesPayload, districts, settings, stores: storesPayload.stores.map(store => decorateStore(store, settings)) };
}

export function legacyTier(store) {
  if (store.badge === '金鑽') return 'tierA';
  if (store.badge === '金質') return 'tierB';
  return '';
}

export function decorateStore(store, settings) {
  const override = settings.storeOverrides[String(store.id)] || {};
  const inheritedTier = legacyTier(store);
  const tier = override.tier === 'none' ? '' : ['tierA','tierB'].includes(override.tier) ? override.tier : inheritedTier;
  const importSpecialist = typeof override.importSpecialist === 'boolean' ? override.importSpecialist : Boolean(store.importSpecialist);
  const hybridSpecialist = Boolean(override.hybridSpecialist);
  return {
    ...store,
    serviceMeta: {
      tier,
      tierLabel: tier ? settings.labels[tier] : '',
      importSpecialist,
      hybridSpecialist
    }
  };
}

export function getCityDistricts(districts, area) {
  return districts.cities.find(city => city.name === area)?.districts || [];
}

export function getDistrict(districts, area, zone) {
  return getCityDistricts(districts, area).find(district => district.name === zone) || null;
}

export function fillCityOptions(select, stores) {
  const counts = new Map();
  stores.forEach(store => counts.set(store.area, (counts.get(store.area) || 0) + 1));
  CITY_ORDER.forEach(area => select.add(new Option(`${area}（${counts.get(area) || 0}）`, area)));
}

export function fillDistrictOptions(select, area, districts, stores, firstLabel = '全部行政區') {
  select.innerHTML = `<option value="">${firstLabel}</option>`;
  if (!area) { select.disabled = true; return; }
  const counts = new Map();
  stores.filter(store => store.area === area).forEach(store => counts.set(store.zone, (counts.get(store.zone) || 0) + 1));
  const options = getCityDistricts(districts, area).map((district, index) => ({ ...district, count: counts.get(district.name) || 0, index }));
  options.sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || b.count - a.count || a.index - b.index);
  options.forEach(district => select.add(new Option(`${district.name}（${district.count}）`, district.name)));
  select.disabled = false;
}

function toRadians(value) { return value * Math.PI / 180; }
export function distanceKm(lat1, lon1, lat2, lon2) {
  const earth = 6371; const dLat = toRadians(lat2-lat1); const dLon = toRadians(lon2-lon1);
  const value = Math.sin(dLat/2)**2 + Math.cos(toRadians(lat1))*Math.cos(toRadians(lat2))*Math.sin(dLon/2)**2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1-value));
}

export function validCoordinates(store) {
  if (!Array.isArray(store.coordinates) || store.coordinates.length !== 2) return false;
  const [lat, lon] = store.coordinates.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 21.7 || lat > 26.5 || lon < 118 || lon > 122.5) return false;
  const center = cityCenters[store.area];
  return !center || distanceKm(center[0], center[1], lat, lon) < 145;
}

export function setDistances(stores, location, key = 'distance') {
  stores.forEach(store => {
    store[key] = location && validCoordinates(store)
      ? distanceKm(location.latitude, location.longitude, Number(store.coordinates[0]), Number(store.coordinates[1]))
      : null;
  });
}

export function filterWithDistrictFallback({ stores, districts, area, zone, keyword = '', minRating = 0, importOnly = false, hybridOnly = false, tierOnly = false, userLocation = null }) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase('zh-TW');
  const matchesOtherFilters = store => {
    const haystack = `${store.name} ${store.code} ${store.area}${store.zone}${store.address}`.toLocaleLowerCase('zh-TW');
    return (!normalizedKeyword || haystack.includes(normalizedKeyword))
      && (!minRating || (store.rating !== null && store.rating >= minRating))
      && (!importOnly || store.serviceMeta.importSpecialist)
      && (!hybridOnly || store.serviceMeta.hybridSpecialist)
      && (!tierOnly || store.serviceMeta.tier);
  };
  const base = stores.filter(matchesOtherFilters);
  const selectedDistrictCount = area && zone ? stores.filter(store => store.area === area && store.zone === zone).length : null;
  if (area && zone && selectedDistrictCount === 0) {
    const district = getDistrict(districts, area, zone);
    const origin = userLocation || (district ? { latitude: district.coordinates[0], longitude: district.coordinates[1] } : null);
    setDistances(base, origin, 'recommendationDistance');
    return {
      stores: base.sort((a,b) => (a.recommendationDistance ?? Infinity) - (b.recommendationDistance ?? Infinity) || (b.rating ?? -1) - (a.rating ?? -1)),
      mode: userLocation ? 'location-fallback' : 'district-fallback',
      district
    };
  }
  return {
    stores: base.filter(store => (!area || store.area === area) && (!zone || store.zone === zone)),
    mode: 'direct',
    district: null
  };
}

export function distanceLabel(store, fallbackMode = false) {
  const value = fallbackMode ? store.recommendationDistance : store.distance;
  if (value === null || value === undefined) return '';
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} km`;
}
