import { DEFAULT_SETTINGS, loadSiteData, normalizeSettings } from './shared.js';

const $ = id => document.getElementById(id);
const state = { stores: [], settings: normalizeSettings(), visible: 60 };

function fieldValues() {
  return {
    tierA: $('tierA').value.trim(), tierB: $('tierB').value.trim(), tierFilter: $('tierFilter').value.trim(),
    importSpecialist: $('importLabel').value.trim(), hybridSpecialist: $('hybridLabel').value.trim()
  };
}

function fillFields() {
  const labels = state.settings.labels;
  $('tierA').value = labels.tierA; $('tierB').value = labels.tierB; $('tierFilter').value = labels.tierFilter;
  $('importLabel').value = labels.importSpecialist; $('hybridLabel').value = labels.hybridSpecialist;
}

function matchingStores() {
  const q = $('storeSearch').value.trim().toLocaleLowerCase('zh-TW');
  return state.stores.filter(store => !q || `${store.name} ${store.code} ${store.area}${store.zone}${store.address}`.toLocaleLowerCase('zh-TW').includes(q));
}

function renderRows() {
  const matches = matchingStores(); const labels = fieldValues();
  $('storeRows').replaceChildren(...matches.slice(0, state.visible).map(store => {
    const override = state.settings.storeOverrides[String(store.id)] || {};
    const tr = document.createElement('tr'); tr.dataset.storeId = String(store.id);
    const inherited = store.badge === '金鑽' ? 'tierA' : store.badge === '金質' ? 'tierB' : '';
    const selected = override.tier === 'none' ? 'none' : override.tier || 'inherit';
    tr.innerHTML = `<td><strong>${store.name}</strong><span>${store.code}</span></td><td>${store.area}${store.zone}</td><td><select class="tier-select"><option value="inherit">沿用原始資料${inherited ? `（${labels[inherited]}）` : '（無）'}</option><option value="tierA">${labels.tierA}</option><option value="tierB">${labels.tierB}</option><option value="none">不顯示</option></select></td><td><label class="switch"><input class="hybrid-check" type="checkbox" ${override.hybridSpecialist ? 'checked' : ''}><span></span><b>${override.hybridSpecialist ? '是' : '否'}</b></label></td>`;
    tr.querySelector('.tier-select').value = selected;
    tr.querySelector('.hybrid-check').addEventListener('change', event => { tr.querySelector('.switch b').textContent = event.target.checked ? '是' : '否'; });
    return tr;
  }));
  $('showAll').hidden = state.visible >= matches.length;
}

function collectSettings() {
  const settings = { version: 1, labels: fieldValues(), storeOverrides: { ...state.settings.storeOverrides } };
  document.querySelectorAll('#storeRows tr').forEach(row => {
    const id = row.dataset.storeId; const tier = row.querySelector('.tier-select').value; const hybridSpecialist = row.querySelector('.hybrid-check').checked;
    const current = { ...(settings.storeOverrides[id] || {}) };
    if (tier === 'inherit') delete current.tier; else current.tier = tier;
    if (hybridSpecialist) current.hybridSpecialist = true; else delete current.hybridSpecialist;
    if (Object.keys(current).length) settings.storeOverrides[id] = current; else delete settings.storeOverrides[id];
  });
  return settings;
}

async function save() {
  const token = $('adminToken').value; const status = $('saveStatus');
  if (!token) { status.textContent = '請先輸入管理密碼'; $('adminToken').focus(); return; }
  const settings = collectSettings(); const button = $('saveSettings'); button.disabled = true; status.textContent = '儲存中…';
  try {
    const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(settings) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    state.settings = normalizeSettings(body); fillFields(); renderRows(); status.textContent = '已同步，重新整理前台即可看到更新';
  } catch (error) { status.textContent = error.message || '儲存失敗，請稍後再試'; }
  finally { button.disabled = false; }
}

function exportSettings() {
  const blob = new Blob([`${JSON.stringify(collectSettings(), null, 2)}\n`], { type: 'application/json' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `sum-settings-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}

async function init() {
  try { const { stores, settings } = await loadSiteData(); state.stores = stores; state.settings = normalizeSettings(settings); fillFields(); renderRows(); }
  catch (error) { $('saveStatus').textContent = '資料載入失敗，請重新整理'; console.error(error); }
}

$('storeRows').addEventListener('change', () => { state.settings = normalizeSettings(collectSettings()); });
$('storeSearch').addEventListener('input', () => { state.settings = normalizeSettings(collectSettings()); state.visible = 60; renderRows(); });
document.querySelector('.label-grid').addEventListener('input', () => { state.settings = normalizeSettings(collectSettings()); renderRows(); });
$('showAll').addEventListener('click', () => { state.settings = normalizeSettings(collectSettings()); state.visible = Infinity; renderRows(); });
$('saveSettings').addEventListener('click', save); $('exportSettings').addEventListener('click', exportSettings);
init();
