import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

const DEFAULT_SETTINGS = {
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

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function cleanLabel(value: unknown, fallback: string) {
  const label = typeof value === 'string' ? value.trim() : '';
  return label && label.length <= 40 ? label : fallback;
}

function sanitize(input: any) {
  const labels = input?.labels || {};
  const clean: any = {
    version: 1,
    updatedAt: new Date().toISOString(),
    labels: {
      tierA: cleanLabel(labels.tierA, DEFAULT_SETTINGS.labels.tierA),
      tierB: cleanLabel(labels.tierB, DEFAULT_SETTINGS.labels.tierB),
      tierFilter: cleanLabel(labels.tierFilter, DEFAULT_SETTINGS.labels.tierFilter),
      importSpecialist: cleanLabel(labels.importSpecialist, DEFAULT_SETTINGS.labels.importSpecialist),
      hybridSpecialist: cleanLabel(labels.hybridSpecialist, DEFAULT_SETTINGS.labels.hybridSpecialist)
    },
    storeOverrides: {}
  };
  const entries = Object.entries(input?.storeOverrides || {});
  if (entries.length > 500) throw new Error('店家設定筆數超過上限');
  for (const [id, value] of entries) {
    if (!/^\d{1,12}$/.test(id) || !value || typeof value !== 'object') continue;
    const source: any = value; const override: any = {};
    if (['tierA','tierB','none'].includes(source.tier)) override.tier = source.tier;
    if (typeof source.hybridSpecialist === 'boolean') override.hybridSpecialist = source.hybridSpecialist;
    if (typeof source.importSpecialist === 'boolean') override.importSpecialist = source.importSpecialist;
    if (Object.keys(override).length) clean.storeOverrides[id] = override;
  }
  return clean;
}

export default async (request: Request) => {
  const store = getStore({ name: 'sum-site-settings', consistency: 'strong' });
  if (request.method === 'GET') {
    const saved = await store.get('current', { type: 'json' });
    return json(saved || DEFAULT_SETTINGS);
  }
  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
  const expected = Netlify.env.get('ADMIN_TOKEN');
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected) return json({ error: '後台尚未設定管理密碼' }, 503);
  if (!provided || provided !== expected) return json({ error: '管理密碼錯誤' }, 401);
  try {
    const clean = sanitize(await request.json());
    await store.setJSON('current', clean);
    return json(clean);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '設定格式錯誤' }, 400);
  }
};

export const config: Config = { path: '/api/settings', method: ['GET', 'PUT'] };
