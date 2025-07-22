// Node.js скрипт для автоматического расчёта сегментов клиентов
// Запуск: node scripts/calcClientSegments.js

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// === RFM-анализ (оновлений під нову логіку) ===
function calculateRfmSegments(masterData) {
  // 1. Групуємо всі продажі по клієнту та сфері
  const byClientSphere = {};
  masterData.forEach(sale => {
    const code = sale['Клиент.Код'];
    const sphere = sale['Сфера діяльності'] || sale['Сфера деятельности'] || 'Інше';
    const date = new Date(sale['Дата']);
    if (!byClientSphere[code]) byClientSphere[code] = {};
    if (!byClientSphere[code][sphere]) byClientSphere[code][sphere] = [];
    byClientSphere[code][sphere].push({ ...sale, _date: date });
  });

  // 2. Для кожної сфери — збираємо масив клієнтів з ≥2 покупками для розрахунку топів
  const sphereStats = {};
  Object.entries(byClientSphere).forEach(([code, spheres]) => {
    Object.entries(spheres).forEach(([sphere, sales]) => {
      if (!sphereStats[sphere]) sphereStats[sphere] = [];
      if (sales.length >= 2) {
        const totalSum = sales.reduce((sum, s) => sum + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
        sphereStats[sphere].push({ code, frequency: sales.length, monetary: totalSum });
      }
    });
  });
  // 3. Для кожної сфери — визначаємо пороги топ-10% (VIP), 10-30% (Чемпіон)
  const sphereThresholds = {};
  Object.entries(sphereStats).forEach(([sphere, arr]) => {
    if (!arr.length) return;
    // Сортуємо за frequency та monetary
    const byF = [...arr].sort((a, b) => b.frequency - a.frequency);
    const byM = [...arr].sort((a, b) => b.monetary - a.monetary);
    const n = arr.length;
    const vipCount = Math.max(1, Math.floor(n * 0.1));
    const champCount = Math.max(1, Math.floor(n * 0.2));
    sphereThresholds[sphere] = {
      vipF: byF[vipCount - 1]?.frequency || 0,
      vipM: byM[vipCount - 1]?.monetary || 0,
      champF: byF[vipCount + champCount - 1]?.frequency || 0,
      champM: byM[vipCount + champCount - 1]?.monetary || 0,
    };
  });

  // 4. Формуємо сегменти по місяцях (історія)
  const segments = {};
  Object.entries(byClientSphere).forEach(([code, spheres]) => {
    segments[code] = {};
    Object.entries(spheres).forEach(([sphere, sales]) => {
      // Групуємо продажі по місяцях
      const byMonth = {};
      sales.forEach(sale => {
        const ym = sale._date.getFullYear() + '-' + String(sale._date.getMonth() + 1).padStart(2, '0');
        if (!byMonth[ym]) byMonth[ym] = [];
        byMonth[ym].push(sale);
      });
      // Для кожного місяця — визначаємо сегмент
      Object.entries(byMonth).forEach(([ym, monthSales]) => {
        // Всі продажі клієнта у цій сфері ДО і включно цього місяця
        const now = new Date(ym + '-15');
        const allSales = sales.filter(s => s._date <= now);
        const lastSale = allSales.reduce((max, s) => (!max || s._date > max._date) ? s : max, null);
        const firstSale = allSales.reduce((min, s) => (!min || s._date < min._date) ? s : min, null);
        const recencyDays = lastSale ? Math.floor((now - lastSale._date) / (1000*60*60*24)) : null;
        const uniqueDays = new Set(allSales.map(s => s._date.toISOString().slice(0, 10)));
        const frequency = uniqueDays.size;
        const monetary = allSales.reduce((sum, s) => sum + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
        let segment = 'Новий';
        // 1. Новий/Втрачений новий
        if (frequency === 1) {
          const daysSince = lastSale ? Math.floor((now - lastSale._date) / (1000*60*60*24)) : null;
          if (daysSince !== null && daysSince < 31) segment = 'Новий';
          else segment = 'Втрачений новий';
        } else if (frequency >= 2) {
          // 2. VIP/Чемпіон/Лояльний/Втрачений ...
          const th = sphereThresholds[sphere] || {};
          const isVip = (frequency >= (th.vipF || Infinity)) || (monetary >= (th.vipM || Infinity));
          const isChamp = !isVip && ((frequency >= (th.champF || Infinity)) || (monetary >= (th.champM || Infinity)));
          const isLost = recencyDays !== null && recencyDays >= 61; // 2 місяці
          if (isVip) segment = isLost ? 'Втрачений VIP' : 'VIP';
          else if (isChamp) segment = isLost ? 'Втрачений чемпіон' : 'Чемпіон';
          else segment = isLost ? 'Втрачений лояльний' : 'Лояльний';
        }
        segments[code][ym] = { segment, rfm: { recencyDays, frequency, monetary }, sphere };
      });
    });
  });
  return segments;
}

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error('Укажите companyId как аргумент: node calcClientSegments.js <companyId>');
    process.exit(1);
  }
  // 1. Загружаем все продажи
  const salesSnap = await db.collection(`companies/${companyId}/sales`).get();
  let masterData = [];
  salesSnap.forEach(doc => {
    const sales = doc.data().sales || [];
    masterData = masterData.concat(sales);
  });
  // 2. Считаем сегменты
  const segments = calculateRfmSegments(masterData);
  // 3. Обновляем только новые месяцы
  let updated = 0;
  for (const [clientCode, months] of Object.entries(segments)) {
    const segRef = db.doc(`companies/${companyId}/clientSegments/${clientCode}`);
    const segSnap = await segRef.get();
    const existing = segSnap.exists ? segSnap.data().months || {} : {};
    let changed = false;
    for (const ym in months) {
      if (!existing[ym]) {
        existing[ym] = months[ym];
        changed = true;
      }
    }
    if (changed) {
      await segRef.set({ months: existing }, { merge: true });
      updated++;
    }
  }
  console.log(`Сегменты рассчитаны и обновлены для ${updated} клиентов.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); }); 