// Собирает catalog.json для витрины из действующего каталога поставщика (только чтение).
// В результат попадают только розничные цены в рублях — оптовые цены и курс не сохраняются.
// Запуск: node scripts/build-catalog.mjs [файл.json]  (без аргумента — загрузка с сервера поставщика)
import { readFile, writeFile } from 'node:fs/promises';
import { unitRetail } from './pricing.mjs';

const API = 'https://script.google.com/macros/s/AKfycbysDIVdkJbYzcfpMO5a8AwE7MOqRdKMN803f0lgjVwKPvRE-rcHGzESyYckJ2-pvYXnhg/exec?action=catalog';
const DESC = 'https://belinskogo245-lgtm.github.io/shop/desc.json';

// вкладки поставщика, которые не показываем покупателям
const HIDE = ['Оригинальный парфюм AD'];
// названия категорий для покупателя (акционные формулировки поставщика не переносим)
const CAT_NAME = {
  'Акция 62 мл': 'Флаконы 62 мл',
  'Акция тестеры −50%': 'Тестеры 40–67 мл',
  'Narcotique Rose 50 мл −50%': 'Narcotique Rose 50 мл',
  'Narcotique Rose 100 мл — акция': 'Narcotique Rose 100 мл',
  'Тестеры 15,5 / 12 / 10 мл': 'Мини 10–15 мл',
  'Тестер 100 мл Турция': 'Тестеры 100 мл',
  'АД': 'Люкс-копии 1:1',
  'Евро': 'Парфюм 100 мл',
};

const inStock = (v) => { const t = String(v ?? '').trim().toLowerCase(); return !!t && !['нет', '0', 'false', 'no', '-', 'нет в наличии'].includes(t); };
const ml = (...src) => { for (const s of src) { const m = String(s || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(ml|мл)?/i); if (m && (m[2] || /^\s*\d/.test(String(s)))) { const v = +m[1]; if (v >= 5 && v <= 300) return v; } } return 0; };
const volBucket = (v) => !v ? 'другое' : v <= 15.5 ? 'до 15 мл' : v <= 40 ? '22–40 мл' : v <= 67 ? '50–67 мл' : v <= 125 ? '75–125 мл' : 'от 150 мл';
const clean = (s) => String(s).replace(/\((НОВИНКА|крафт)\)/gi, '').replace(/\s{2,}/g, ' ').trim();

async function getJson(url) { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error(url + ' → ' + r.status); return r.json(); }

const src = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : await getJson(API);
if (!src.ok || !Array.isArray(src.items) || !(src.rate > 0)) throw new Error('каталог поставщика недоступен или без курса');
let desc = {}; try { desc = process.argv[3] ? JSON.parse(await readFile(process.argv[3], 'utf8')) : await getJson(DESC); } catch { }

const items = [];
for (const r of src.items) {
  const [id, cat, name, vol, usd, stock, photo, d] = r;
  if (!name || !(+usd > 0) || HIDE.includes(cat)) continue;
  const imgs = String(photo || '').split(/[,\s]+/).filter((u) => /^https:\/\//.test(u));
  const v = ml(vol, name, cat);
  items.push({
    id: String(id),
    c: CAT_NAME[cat] || cat,
    n: clean(name),
    v: String(vol || '').replace(/\s+/g, ' ').trim() || (v ? v + ' мл' : ''),
    vb: volBucket(v),
    p: unitRetail(+usd, +src.rate), // ₽ за флакон
    s: inStock(stock) ? 1 : 0,
    i: imgs.slice(0, 4),
    d: String(d || desc[id] || '').trim().slice(0, 600),
    new: /новинка/i.test(name) ? 1 : 0,
  });
}
if (items.length < 100) throw new Error('слишком мало товаров: ' + items.length);
const out = { updated: new Date().toISOString(), count: items.length, items };
await writeFile(new URL('../catalog.json', import.meta.url), JSON.stringify(out));
console.log('catalog.json:', items.length, 'товаров,', items.filter((x) => x.s).length, 'в наличии');
