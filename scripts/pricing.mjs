// Розничные цены «Алина Парфюм».
// Правило А (согласовано): прогрессивная наценка к закупочной стоимости по частям розничной суммы заказа:
//   первые 50 000 ₽ розницы — +30%, 50–100 тыс. — +20%, 100–150 тыс. — +15%, свыше — +10%.
// Кусочно-линейная непрерывная функция → нет скачка при пересечении порога.
// Правило Б (2,5 × опт ниже порога) НЕ включено — ждёт решения владельца.

export const BANDS = [ // [верх розничной части, ₽, множитель]
  [50000, 1.30],
  [100000, 1.20],
  [150000, 1.15],
  [Infinity, 1.10],
];

export const ceil10 = (x) => Math.ceil(Math.round(x * 100) / 100 / 10) * 10;

// закупочная стоимость (₽) → розничная сумма (₽), без округления
export function retailFromCost(cost) {
  let retail = 0, prevTop = 0, left = cost;
  for (const [top, k] of BANDS) {
    const bandCost = (top - prevTop) / k; // сколько закупки «помещается» в эту розничную часть
    const c = Math.min(left, bandCost);
    retail += c * k; left -= c; prevTop = top;
    if (left <= 0) break;
  }
  return retail;
}

// розничная сумма (₽) → закупочная стоимость (₽): обратное преобразование
export function costFromRetail(retail) {
  let cost = 0, prevTop = 0;
  for (const [top, k] of BANDS) {
    const part = Math.min(retail, top) - prevTop;
    if (part <= 0) break;
    cost += part / k; prevTop = top;
  }
  return cost;
}

// цена одного флакона на витрине: (опт $ × курс) × 1,3, вверх до 10 ₽
export const unitRetail = (usd, rate) => ceil10(usd * rate * BANDS[0][1]);
