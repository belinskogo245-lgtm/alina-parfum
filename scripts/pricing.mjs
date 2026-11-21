// Партнёрский магазин: цены от исходного оптового каталога поставщика.
// Все расчёты выполняются при каждой автоматической синхронизации каталога.
export const ceil10 = x => Math.ceil((x - 1e-8) / 10) * 10;
export const roundRub = x => Math.round(x);
export function prices({usd, rate, category='', volume=0, name=''}) {
  const base = Number(usd) * Number(rate); // цена поставщика в рублях
  if (!(base > 0)) throw new Error('Неверная исходная цена или курс');
  const cat = String(category).toLowerCase();
  const title = String(name).toLowerCase();
  // В оптовом каталоге мини-флаконы этой серии обозначены как 15,5 мл.
  const smallBottle = [15, 15.5, 25, 35].includes(volume);
  const retail = smallBottle ? ceil10(base * 1.3 + 100) : ceil10(base * 2.5);

  const fixedWholesale = (
    /диффузор|деффузор|diffuser/.test(cat+' '+title) ? 700 :
    volume === 15 ? 290 :
    volume === 22 && /масл|oil/.test(cat+' '+title) ? 600 :
    volume === 25 ? 500 :
    volume === 35 ? 560 :
    volume === 40 && /тестер|tester/.test(cat+' '+title) ? 590 : null
  );
  const premium100 = volume === 100 && /евро|селектив|ниша|\bad\b|оригинальный парфюм ad|а\+д|\bад\b/i.test(category);
  const wholesale = fixedWholesale ?? (ceil10(base * 1.3) + (premium100 ? 100 : 0));
  return {wholesale, retail};
}
