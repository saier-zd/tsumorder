import { writeFile } from 'node:fs/promises';

const sourceUrl = 'https://gist.githubusercontent.com/memochou1993/aa9b6b1185221f88a03109f10d32e5e2/raw';
const excluded = new Set(['宜蘭縣|釣魚臺列嶼', '高雄市|東沙群島', '高雄市|南沙群島']);
const cityOrder = ['基隆市','臺北市','新北市','桃園市','新竹縣','新竹市','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義縣','嘉義市','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Unable to download district centers: ${response.status}`);
const source = (await response.json()).台灣;

const cities = cityOrder.map(city => ({
  name: city,
  districts: Object.entries(source[city] || {})
    .filter(([district]) => !excluded.has(`${city}|${district}`))
    .map(([name, value]) => ({
      name,
      postalCode: String(value.postalCode || ''),
      coordinates: [Number(value.latitude), Number(value.longitude)]
    }))
}));

const count = cities.reduce((total, city) => total + city.districts.length, 0);
if (count !== 368) throw new Error(`Expected 368 districts, got ${count}`);

const payload = {
  updatedAt: new Date().toISOString().slice(0, 10),
  count,
  source: '內政部國土測繪中心鄉鎮市區界線資料衍生中心點',
  sourceUrl: 'https://data.gov.tw/dataset/7441',
  cities
};

await writeFile('data/districts.json', `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Updated ${count} administrative districts.`);
