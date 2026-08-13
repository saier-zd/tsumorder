import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'https://www.sum.com.tw/repair/api/storelist.php?e_area=%E7%B8%A3%E5%B8%82&e_zone=&ctype=&brands=&compname=&benz=';
const inputPath = process.argv[2];
const raw = inputPath ? JSON.parse(await readFile(inputPath, 'utf8')) : await fetch(SOURCE).then(async response => { if (!response.ok) throw new Error(`SUM API ${response.status}`); return response.json(); });
const value = text => String(text ?? '').trim();
const numberOrNull = input => value(input) === '' || Number.isNaN(Number(input)) ? null : Number(input);
const keyFor = item => `${value(item.sum_id)}|${value(item.comp_place_id)}`;
const unique = new Map();

for (const item of raw.data ?? []) {
  const key = keyFor(item);
  if (!unique.has(key)) unique.set(key, item);
}

const stores = [...unique.values()].map(item => ({
  id: value(item.idserial), code: value(item.sum_id), name: value(item.e_name),
  area: value(item.e_area).replace(/^台北市$/, '臺北市'), zone: value(item.e_zone), address: value(item.e_addr),
  contact: value(item.e_boss), phone: value(item.e_tel), mobile: value(item.e_mobile),
  businessHours: value(item.bus_time), experience: value(item.experience),
  badge: ['金鑽','金質'].includes(value(item.mark_flag)) ? value(item.mark_flag) : '',
  importSpecialist: value(item.benz_flag) === 'Y',
  rating: numberOrNull(item.rating), reviewCount: numberOrNull(item.user_ratings_total), placeId: value(item.comp_place_id),
  mapUrl: value(item.google_map) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.e_area}${item.e_zone}${item.e_addr}`)}`,
  coordinates: numberOrNull(item.gps_x) !== null && numberOrNull(item.gps_y) !== null ? [numberOrNull(item.gps_x), numberOrNull(item.gps_y)] : null,
  hours: Array.from({length:7}, (_,index) => { const day = index + 1; return [value(item[`ContactTime_${day}_1`]), value(item[`ContactTime_${day}_2`]), value(item[`ContactTime_${day}_3`])].filter(Boolean); })
})).sort((a,b) => a.area.localeCompare(b.area, 'zh-Hant') || a.zone.localeCompare(b.zone, 'zh-Hant') || a.name.localeCompare(b.name, 'zh-Hant'));

const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const output = { updatedAt: today, source: SOURCE, rawCount: raw.data?.length ?? 0, duplicateCount: (raw.data?.length ?? 0) - stores.length, stores };
await mkdir('data', { recursive:true }); await writeFile('data/stores.json', `${JSON.stringify(output)}\n`);
console.log(`Wrote ${stores.length} unique stores (${output.duplicateCount} duplicate removed) to data/stores.json`);
