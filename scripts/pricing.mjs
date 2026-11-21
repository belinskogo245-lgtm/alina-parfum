// Цены Алины от исходного оптового каталога поставщика.
export const ceil10 = x => Math.ceil((x - 1e-8) / 10) * 10;
export const roundRub = x => Math.round(x);

const fixedByVolume = new Map([
  [22, [900, 650]],
  [25, [750, 500]],
  [35, [850, 590]],
  [40, [1000, 700]],
  [58, [660, 540]],
  [62, [900, 600]],
]);
const fullSizeCategories = new Set([
  'селектив / наборы', 'селектив и ниша', 'селектив премиум',
  'оригинальный парфюм ad', 'ад', 'евро', 'арабская парфюмерия',
]);

export function prices({usd, rate, category='', volume=0, name=''}) {
  const base = Number(usd) * Number(rate);
  if (!(base > 0)) throw new Error('Неверная исходная цена или курс');

  const cat = String(category).trim().toLowerCase();
  const title = String(name).toLowerCase();
  const isDiffuser = /диффузор|деффузор|diffuser/.test(cat+' '+title);
  let fixed = fixedByVolume.get(volume);
  if (cat === 'дезодоранты') fixed = [550, 480];
  if (cat.startsWith('лосьоны')) fixed = [400, 320];
  if (cat === 'арабские духи 30 мл') fixed = [900, 600];
  if (cat === 'тестеры 15,5 / 12 / 10 мл') fixed = [490, 290];
  if (cat === 'акция 62 мл') fixed = [900, 600];
  if (fixed && !isDiffuser) {
    const [retail, wholesale] = fixed;
    return {retail, wholesale};
  }

  // У части полноразмерной парфюмерии объём не заполнен в исходном прайсе.
  const fullSizeWithoutVolume = volume === 0 && fullSizeCategories.has(cat);
  const retailMultiplier = volume === 50 || volume === 100 || fullSizeWithoutVolume ? 2 : 2.5;
  const largeBottle = volume >= 50 || fullSizeWithoutVolume;
  return {
    retail: ceil10(base * retailMultiplier),
    wholesale: isDiffuser ? 700 : ceil10(base * (largeBottle ? 1.2 : 1.3)),
  };
}
