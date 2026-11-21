// Партнёрский магазин: цены от исходного оптового каталога поставщика.
// Все расчёты выполняются при каждой автоматической синхронизации каталога.
export const ceil10 = x => Math.ceil((x - 1e-8) / 10) * 10;
export const roundRub = x => Math.round(x);
export function prices({usd, rate, category='', volume=0, name=''}) {
  const base = Number(usd) * Number(rate); // цена поставщика в рублях
  if (!(base > 0)) throw new Error('Неверная исходная цена или курс');
  const cat = String(category).toLowerCase();
  const title = String(name).toLowerCase();
  const fixed = (
    /диффузор|деффузор|diffuser/.test(cat+' '+title) ? [700,950] :
    volume === 15 ? [290,450] :
    volume === 22 && /масл|oil/.test(cat+' '+title) ? [600,900] :
    volume === 25 ? [500,750] :
    volume === 35 ? [560,850] :
    volume === 40 && /тестер|tester/.test(cat+' '+title) ? [590,900] : null
  );
  const selectiveSetsRetail = cat === 'селектив / наборы' ? ceil10(base * 2.5) : null;
  if (fixed) return {wholesale:fixed[0], retail:selectiveSetsRetail ?? fixed[1]};
  const premium100 = volume === 100 && /евро|селектив|ниша|\bad\b|оригинальный парфюм ad|а\+д|\bад\b/i.test(category);
  if (premium100) return {wholesale:ceil10(base*1.3)+100, retail:ceil10(base*2.5)};
  // Для прочих позиций остаётся прежняя наценка 30%,
  // пока отдельные цены для опта и розницы не согласованы.
  return {wholesale:ceil10(base*1.3),retail:selectiveSetsRetail ?? ceil10(base*1.3)};
}
