// alerts.js (lightweight, без классов оформления)

let masterData = [];
let clientLinks = {};
let currentSignal = 'revenue-drop';
let currentManager = '';
let currentPeriod = 3;
let currentSearch = '';
let revenueChart, freqChart, avgCheckChart;
let isAlertsInitialized = false; // --- NEW: Прапор ініціалізації ---

// === NEW: Головна функція ініціалізації ===
window.initAlertsModule = function(container) {
  if (isAlertsInitialized) return; // Запобігаємо повторній ініціалізації
  console.log('initAlertsModule called', container);
  if (!container) return;
  
  container.innerHTML = `
    <div class="bg-gray-800 rounded-xl shadow-lg p-6">
      <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-white">Сигналізація</h1>
          <p class="mt-2 text-gray-400">Повідомлення про критичні події та сигнали по клієнтах.</p>
        </div>
      </div>
      <div id="alerts-filters-container" class="mb-4"></div>
      <div id="alerts-tabs-container" class="mb-4"></div>
      <div id="alerts-content-container" class="mb-4"></div>
      <div id="chart-container" class="mb-4"></div>
    </div>
  `;

  const get = (id) => container.querySelector(`#${id}`);

  async function loadData() {
    console.log('alerts.js: loadData called');
    const [dataRes, dataJulyRes, refRes] = await Promise.all([
      fetch('модуль помічник продажу/data.json'),
      fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
      fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url')
    ]);
    const data = await dataRes.json();
    const dataJuly = await dataJulyRes.json();
    masterData = data.concat(dataJuly);
    const refData = await refRes.json();
    clientLinks = Object.fromEntries(refData.map(item => [item['Клиент.Код'], item['посилання']]));
    console.log('alerts.js: masterData loaded', masterData.length);
    renderFilters();
    renderTabs();
    renderSignals();
  }

  function renderFilters() {
    const managers = [...new Set(masterData.map(item => item['Основной менеджер']))].filter(Boolean).sort();
    const filtersDiv = get('alerts-filters-container');
    if (!filtersDiv) return;
    filtersDiv.innerHTML = `
      <label class="mr-4">Менеджер:
        <select id="manager-filter" class="dark-input bg-gray-900 text-gray-200">
          <option value="">Всі</option>
          ${managers.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </label>
      <label class="mr-4">Період:
        <select id="period-filter" class="dark-input bg-gray-900 text-gray-200">
          <option value="3">Останні 3 міс</option>
          <option value="6">Останні 6 міс</option>
          <option value="12">Останній рік</option>
        </select>
      </label>
      <label class="mr-4">Пошук:
        <input id="search-input" type="text" class="dark-input bg-gray-900 text-gray-200" placeholder="Пошук клієнта..." value="${currentSearch}">
      </label>
      <button id="export-btn" class="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Експорт CSV</button>
    `;
    get('manager-filter').onchange = e => { currentManager = e.target.value; renderSignals(); };
    get('period-filter').onchange = e => { currentPeriod = +e.target.value; renderSignals(); };
    get('search-input').oninput = e => { currentSearch = e.target.value; renderSignals(); };
    get('export-btn').onclick = exportCSV;
  }

  function renderTabs() {
    const tabsDiv = get('alerts-tabs-container');
    if (!tabsDiv) return;
    const tabs = [
      {id: 'revenue-drop', label: 'Спад виручки'},
      {id: 'frequency-drop', label: 'Частота'},
      {id: 'avgcheck-drop', label: 'Середній чек'},
      {id: 'missed-forecast', label: 'Прогноз'},
      {id: 'product-drop', label: 'Товари'}
    ];
    tabsDiv.innerHTML = tabs.map(tab =>
      `<button data-signal-id="${tab.id}" class="signal-tab-btn px-3 py-2 rounded mr-2 ${currentSignal===tab.id?'bg-indigo-600 text-white':'bg-gray-700 text-gray-200 hover:bg-gray-600'}">${tab.label}</button>`
    ).join('');
    
    container.querySelectorAll('.signal-tab-btn').forEach(btn => {
        btn.onclick = () => setSignal(btn.dataset.signalId);
    });
  }

  function setSignal(signal) {
    currentSignal = signal;
    renderTabs();
    renderSignals();
  }

  function renderSignals() {
    if (currentSignal === 'revenue-drop') {
      renderRevenueDrop();
    } else if (currentSignal === 'frequency-drop') {
      renderFrequencyDrop();
    } else if (currentSignal === 'avgcheck-drop') {
      renderAvgCheckDrop();
    } else if (currentSignal === 'missed-forecast') {
      renderMissedForecast();
    } else if (currentSignal === 'product-drop') {
      renderProductDrop();
    }
  }

  function filterClients(list) {
    if (currentSearch) {
      return list.filter(c => c.name.toLowerCase().includes(currentSearch.toLowerCase()));
    }
    return list;
  }

  function renderRevenueDrop() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const prevPeriodMs = periodMs;
    const clients = {};
    masterData.forEach(sale => {
      if (currentManager && sale['Основной менеджер'] !== currentManager) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
      if (!clients[code]) clients[code] = { name: sale['Клиент'], code, now: 0, prev: 0, link: clientLinks[code] };
      if (now - date <= periodMs) clients[code].now += revenue;
      else if (now - date <= periodMs + prevPeriodMs) clients[code].prev += revenue;
    });
    let alerts = Object.values(clients)
      .filter(c => c.prev > 0 && c.now < c.prev * 0.7)
      .sort((a, b) => (a.now/a.prev) - (b.now/b.prev));
    alerts = filterClients(alerts);
    renderTable(alerts, ['Клієнт','Виручка (період)','Було (до)','Зміна','CRM','Детальніше'], c => [
      (c.now < c.prev*0.5
        ? `<span title='Критичне падіння' style='vertical-align:middle; margin-right:4px;'>
            <svg width='18' height='18' viewBox='0 0 20 20' fill='red' style='display:inline'><polygon points='10,2 2,18 18,18'/></svg>
          </span>`
        : `<span title='Менш критичне' style='vertical-align:middle; margin-right:4px;'>
            <svg width='18' height='18' viewBox='0 0 20 20' fill='#FFD600' style='display:inline'><polygon points='10,2 2,18 18,18'/></svg>
          </span>`)
      + `<span class='text-gray-200'>${c.name}</span>`,
      c.now.toFixed(2),
      c.prev.toFixed(2),
      ((c.now-c.prev)/c.prev*100).toFixed(1)+'%',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => '');
  }

  function renderFrequencyDrop() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const prevPeriodMs = periodMs;
    const clients = {};
    masterData.forEach(sale => {
      if (currentManager && sale['Основной менеджер'] !== currentManager) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      if (!clients[code]) clients[code] = { name: sale['Клиент'], code, now: [], prev: [], link: clientLinks[code], manager: sale['Основной менеджер'] };
      if (now - date <= periodMs) clients[code].now.push(date);
      else if (now - date <= periodMs + prevPeriodMs) clients[code].prev.push(date);
    });
    // Розрахунок середнього інтервалу
    function avgInterval(dates) {
      if (dates.length < 2) return null;
      // Учитываем только уникальные дни
      const uniqueDays = Array.from(new Set(dates.map(d => d.toISOString().slice(0, 10)))).map(s => new Date(s)).sort((a, b) => a - b);
      if (uniqueDays.length < 2) return null;
      let sum = 0;
      for (let i = 1; i < uniqueDays.length; ++i) sum += (uniqueDays[i] - uniqueDays[i - 1]);
      return sum / (uniqueDays.length - 1);
    }
    let alerts = Object.values(clients).map(c => {
      const nowInt = avgInterval(c.now);
      const prevInt = avgInterval(c.prev);
      return { ...c, nowInt, prevInt };
    }).filter(c => c.prevInt && c.nowInt && c.nowInt > c.prevInt*2);
    alerts = filterClients(alerts).sort((a,b)=>b.nowInt/b.prevInt - a.nowInt/a.prevInt);
    renderTable(alerts, ['Клієнт','Інтервал (днів, зараз)','Було (днів)','Зміна','CRM','Детальніше'], c => [
      c.name,
      c.nowInt ? (c.nowInt / (1000 * 60 * 60 * 24)).toFixed(1) : '-',
      c.prevInt ? (c.prevInt / (1000 * 60 * 60 * 24)).toFixed(1) : '-',
      c.prevInt ? (((c.nowInt - c.prevInt) / c.prevInt) * 100).toFixed(1) + '%' : '-',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => c.nowInt > c.prevInt*3 ? 'bg-red-900' : 'bg-yellow-900');

    // --- Chart.js графік ---
    const chartDiv = get('chart-container');
    if (chartDiv && alerts.length > 0) {
      chartDiv.innerHTML = '<canvas id="freqChart" height="120"></canvas>';
      const ctx = get('freqChart').getContext('2d');
      const top = alerts.slice(0, 10);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Зростання інтервалу (днів)',
            data: top.map(c=>c.nowInt-c.prevInt),
            backgroundColor: 'rgba(255,99,132,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  function renderAvgCheckDrop() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const prevPeriodMs = periodMs;
    const clients = {};
    masterData.forEach(sale => {
      if (currentManager && sale['Основной менеджер'] !== currentManager) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
      if (!clients[code]) clients[code] = { name: sale['Клиент'], code, now: [], prev: [], link: clientLinks[code], manager: sale['Основной менеджер'] };
      if (now - date <= periodMs) clients[code].now.push(revenue);
      else if (now - date <= periodMs + prevPeriodMs) clients[code].prev.push(revenue);
    });
    function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
    let alerts = Object.values(clients).map(c => {
      const nowAvg = avg(c.now);
      const prevAvg = avg(c.prev);
      return { ...c, nowAvg, prevAvg };
    }).filter(c => c.prevAvg && c.nowAvg && c.nowAvg < c.prevAvg*0.8);
    alerts = filterClients(alerts).sort((a,b)=>a.nowAvg/a.prevAvg - b.nowAvg/b.prevAvg);
    renderTable(alerts, ['Клієнт','Середній чек (зараз)','Було','Зміна','CRM','Детальніше'], c => [
      c.name,
      c.nowAvg ? c.nowAvg.toFixed(2) : '-',
      c.prevAvg ? c.prevAvg.toFixed(2) : '-',
      c.prevAvg ? ((c.nowAvg-c.prevAvg)/c.prevAvg*100).toFixed(1)+'%' : '-',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => c.nowAvg < c.prevAvg*0.6 ? 'bg-red-900' : 'bg-yellow-900');

    // --- Chart.js графік ---
    const chartDiv = get('chart-container');
    if (chartDiv && alerts.length > 0) {
      chartDiv.innerHTML = '<canvas id="avgCheckChart" height="120"></canvas>';
      const ctx = get('avgCheckChart').getContext('2d');
      const top = alerts.slice(0, 10);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Падіння середнього чека',
            data: top.map(c=>c.prevAvg-c.nowAvg),
            backgroundColor: 'rgba(54,162,235,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  function renderMissedForecast() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const clients = {};
    masterData.forEach(sale => {
      if (currentManager && sale['Основной менеджер'] !== currentManager) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      if (!clients[code]) clients[code] = { name: sale['Клиент'], code, dates: [], link: clientLinks[code], manager: sale['Основной менеджер'] };
      if (now - date <= periodMs*2) clients[code].dates.push(date);
    });
    function avgInterval(dates) {
      if (dates.length < 2) return null;
      // Учитываем только уникальные дни
      const uniqueDays = Array.from(new Set(dates.map(d => d.toISOString().slice(0, 10)))).map(s => new Date(s)).sort((a, b) => a - b);
      if (uniqueDays.length < 2) return null;
      let sum = 0;
      for (let i = 1; i < uniqueDays.length; ++i) sum += (uniqueDays[i] - uniqueDays[i - 1]);
      return sum / (uniqueDays.length - 1);
    }
    let alerts = Object.values(clients).map(c => {
      if (c.dates.length < 2) return null;
      c.dates.sort((a,b)=>a-b);
      const last = c.dates[c.dates.length-1];
      const interval = avgInterval(c.dates);
      const forecast = new Date(last.getTime() + interval);
      const hasOrderAfter = c.dates.some(d => d > forecast);
      return (!hasOrderAfter && forecast < now) ? {
        ...c,
        forecast,
        last,
        avgIntervalDays: interval / (1000 * 60 * 60 * 24)
      } : null;
    }).filter(Boolean);
    alerts = filterClients(alerts).sort((a,b)=>b.forecast-a.forecast);
    renderTable(alerts, ['Клієнт','Прогнозована дата','Остання покупка','Середній інтервал (днів)','CRM','Детальніше'], c => [
      c.name,
      c.forecast ? c.forecast.toLocaleDateString('uk-UA') : '-',
      c.last ? c.last.toLocaleDateString('uk-UA') : '-',
      c.avgIntervalDays ? c.avgIntervalDays.toFixed(1) : '-',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => c.forecast && c.forecast < now ? 'bg-red-900' : 'bg-yellow-900');

    // --- Chart.js графік ---
    const chartDiv = get('chart-container');
    if (chartDiv && alerts.length > 0) {
      chartDiv.innerHTML = '<canvas id="forecastChart" height="120"></canvas>';
      const ctx = get('forecastChart').getContext('2d');
      const top = alerts.slice(0, 10);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Днів прострочення',
            data: top.map(c=>Math.round((now-c.forecast)/86400000)),
            backgroundColor: 'rgba(255,205,86,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  let productDropPage = 1;
  const PRODUCT_DROP_PAGE_SIZE = 20;

  function renderProductDrop() {
    const now = new Date();
    const monthAgo = new Date(now.getTime());
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const clients = {};
    masterData.forEach(sale => {
      if (currentManager && sale['Основной менеджер'] !== currentManager) return;
      const code = sale['Клиент.Код'];
      const product = sale['Номенклатура'];
      const date = new Date(sale['Дата']);
      if (!clients[code]) clients[code] = { name: sale['Клиент'], code, lostProducts: [], link: clientLinks[code], manager: sale['Основной менеджер'], lastDates: {} };
      if (!clients[code].lastDates[product] || clients[code].lastDates[product] < date) {
        clients[code].lastDates[product] = date;
      }
    });
    // Формуємо масив: [{name, lostProducts: [{product, lastDate}], ...}]
    let clientList = Object.values(clients).map(c => {
      const lost = Object.entries(c.lastDates)
        .filter(([_, lastDate]) => lastDate < monthAgo)
        .map(([product, lastDate]) => ({ product, lastDate }));
      return { ...c, lostProducts: lost };
    }).filter(c => c.lostProducts.length > 0);
    clientList = filterClients(clientList).sort((a,b)=>b.lostProducts.length - a.lostProducts.length);

    // Пагінація
    const totalPages = Math.ceil(clientList.length / PRODUCT_DROP_PAGE_SIZE) || 1;
    if (productDropPage > totalPages) productDropPage = totalPages;
    const pageClients = clientList.slice((productDropPage-1)*PRODUCT_DROP_PAGE_SIZE, productDropPage*PRODUCT_DROP_PAGE_SIZE);

    // Таблиця
    const content = get('alerts-content-container');
    if (!content) return;
    content.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-bold">Клієнти, які перестали купувати товари</h2>
        <span class="text-xs text-gray-400">${clientList.length} клієнтів</span>
      </div>
      <table class="min-w-full text-sm mb-4"><thead><tr>
        <th class="px-2 py-1">Клієнт</th><th class="px-2 py-1">Кількість втрачених товарів</th><th class="px-2 py-1">CRM</th><th class="px-2 py-1">Детальніше</th><th class="px-2 py-1">Товари</th>
      </tr></thead><tbody>
        ${pageClients.map((c, idx) => {
          const safeCode = c.code || c.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
          const rowId = `prodrow_${safeCode}`;
          return `
          <tr class="bg-yellow-900">
            <td class="px-2 py-1 align-top font-bold">${c.name}</td>
            <td class="px-2 py-1 text-center align-top">${c.lostProducts.length}</td>
            <td class="px-2 py-1 align-top">${c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : ''}</td>
            <td class="px-2 py-1 align-top"><button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button></td>
            <td class="px-2 py-1 align-top">
              <button class="px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 flex items-center gap-1" onclick="window.toggleLostProductsRow('${rowId}')"><span id='icon_${rowId}'>▼</span> Показати</button>
            </td>
          </tr>
          <tr id="${rowId}" class="hidden">
            <td colspan="5" class="bg-gray-800 text-gray-100 px-4 py-3 rounded-b-xl">
              <div class="font-semibold mb-2">Втрачено товари:</div>
              <ul class="space-y-1">
                ${c.lostProducts.map(lp => `<li>${lp.product}</li>`).join('')}
              </ul>
            </td>
          </tr>`;
        }).join('')}
      </tbody></table>
      <div class="flex justify-between items-center mb-2">
        <button ${productDropPage===1?'disabled':''} onclick="window.productDropPrevPage()" class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Назад</button>
        <span class="text-xs">Сторінка ${productDropPage} з ${totalPages}</span>
        <button ${productDropPage===totalPages?'disabled':''} onclick="window.productDropNextPage()" class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Вперед</button>
      </div>
    `;
    window.toggleLostProductsRow = function(id) {
      const row = get(id);
      if (!row) return;
      row.classList.toggle('hidden');
      const icon = get('icon_' + id);
      if (icon) icon.textContent = row.classList.contains('hidden') ? '▼' : '▲';
    };
    window.productDropPrevPage = function() {
      if (productDropPage > 1) { productDropPage--; renderProductDrop(); }
    };
    window.productDropNextPage = function() {
      if (productDropPage < totalPages) { productDropPage++; renderProductDrop(); }
    };

    // --- Chart.js графік ---
    const chartDiv = get('chart-container');
    if (chartDiv && clientList.length > 0) {
      const top = clientList.slice(0, 10);
      chartDiv.innerHTML = '<canvas id="prodDropChart" height="120"></canvas>';
      const ctx = get('prodDropChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Втрачені товари',
            data: top.map(c=>c.lostProducts.length),
            backgroundColor: 'rgba(255,99,132,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  function renderTable(list, headers, rowFn, rowClassFn) {
    const content = get('alerts-content-container');
    if (!content) return;
    content.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-bold">${getSignalTitle()}</h2>
        <span class="text-xs text-gray-400">${list.length} клієнтів</span>
      </div>
      <table class="min-w-full text-sm mb-4"><thead><tr>
        ${headers.map(h=>`<th class="px-2 py-1">${h}</th>`).join('')}
      </tr></thead><tbody>
        ${list.map(c => `<tr class="${rowClassFn(c)}">${rowFn(c).map(cell => `<td class="px-2 py-1">${cell}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
    `;
  }

  function getSignalTitle() {
    switch(currentSignal) {
      case 'revenue-drop': return 'Клієнти зі спадом виручки >30%';
      case 'frequency-drop': return 'Клієнти з падінням частоти замовлень';
      case 'avgcheck-drop': return 'Клієнти зі зменшенням середнього чека';
      case 'missed-forecast': return 'Клієнти, які не замовили у прогнозовану дату';
      case 'product-drop': return 'Клієнти, які перестали купувати товари';
      default: return '';
    }
  }

  function exportCSV() {
    const content = get('alerts-content-container');
    if (!content) return;
    const table = content.querySelector('table');
    if (!table) return;
    let csv = '';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('th,td');
      csv += Array.from(cells).map(cell => '"'+cell.innerText.replace(/"/g,'""')+'"').join(',') + '\n';
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alerts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // --- Завантаження даних ---
  loadData(); 
  isAlertsInitialized = true;
};

// --- Модалка деталізації по клієнту ---
// Залишаємо глобально доступною, бо вона може викликатись з різних місць
window.showClientDetail = function(clientCode) {
    console.log('showClientDetail called for code:', clientCode);
    const oldModal = document.getElementById('client-detail-modal');
    if (oldModal) oldModal.remove();

    const sales = masterData.filter(s => s['Клиент.Код'] === clientCode);
    if (!sales.length) {
        console.log('No sales found for client code:', clientCode);
        return;
    }
  
    const monthMap = {};
    sales.forEach(sale => {
        const date = new Date(sale['Дата']);
        const ym = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
        if (!monthMap[ym]) monthMap[ym] = 0;
        monthMap[ym] += revenue;
    });
    const sortedMonths = Object.keys(monthMap).sort((a, b) => new Date(a + '-01') - new Date(b + '-01'));

    const dates = sales.map(s=>new Date(s['Дата'])).sort((a,b)=>a-b);
    let freqArr = [];
    for (let i=1; i<dates.length; ++i) freqArr.push((dates[i]-dates[i-1])/86400000);

    const avgCheckArr = {};
    sales.forEach(sale => {
        const date = new Date(sale['Дата']);
        const ym = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
        if (!avgCheckArr[ym]) avgCheckArr[ym] = [];
        avgCheckArr[ym].push(revenue);
    });
    const avgCheckByMonth = Object.fromEntries(Object.entries(avgCheckArr).map(([m, arr]) => [m, arr.reduce((a,b)=>a+b,0)/arr.length]));
    const sortedAvgCheck = sortedMonths.map(m => avgCheckByMonth[m] || null);

    const salesByDate = {};
    sales.forEach(sale => {
        const date = sale['Дата'];
        if (!salesByDate[date]) salesByDate[date] = [];
        salesByDate[date].push(sale);
    });
    const lastDates = Object.keys(salesByDate).sort((a,b)=>new Date(b)-new Date(a)).slice(0,10);

    let modal = document.createElement('div');
    modal.id = 'client-detail-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60'; // Increased z-index
    modal.innerHTML = `
    <div class="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-4xl relative max-h-[95vh] flex flex-col overflow-y-auto animate-fade-in">
      <button id="close-client-detail" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
      <h3 class="text-2xl font-bold text-white mb-6">Деталізація: <span class="text-indigo-400">${sales[0] ? sales[0]['Клиент'] : ''}</span></h3>
      <div class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Динаміка виручки по місяцях</h4>
          <canvas id="clientRevenueChart" height="100"></canvas>
        </div>
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Динаміка частоти покупок</h4>
          <canvas id="clientFreqChart" height="80"></canvas>
        </div>
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Динаміка середнього чека</h4>
          <canvas id="clientAvgCheckChart" height="80"></canvas>
        </div>
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Останні замовлення</h4>
          <div class="max-h-[200px] overflow-y-auto">
            <table class="min-w-full text-xs bg-gray-800 rounded-lg overflow-hidden"><thead><tr class="bg-gray-700 text-gray-300"><th class="px-3 py-2">Дата</th><th class="px-3 py-2">Сума</th><th class="px-3 py-2">Товари</th></tr></thead><tbody>
              ${lastDates.map(date => {
                const orders = salesByDate[date];
                const total = orders.reduce((sum, s) => sum + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
                const safeId = 'order_' + date.replace(/[^\d]/g, '');
                return `<tr><td class="px-3 py-2 text-gray-200">${date}</td><td class="px-3 py-2 text-green-400">${total.toFixed(2)}</td><td class="px-3 py-2"><button class='px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600' onclick="window.toggleOrderDetail('${safeId}')">Показати</button><div id='${safeId}' class='hidden mt-2 text-xs bg-gray-900 rounded p-3'><ul class='list-disc list-inside space-y-1'>${orders.map(s=>`<li>${s['Номенклатура']} <span class='text-gray-400'>(${typeof s['Выручка'] === 'string' ? s['Выручка'] : (s['Выручка']||0)})</span></li>`).join('')}</ul></div></td></tr>`;
              }).join('')}
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  window.toggleOrderDetail = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden');
  };
  const close = () => modal.remove();
  document.getElementById('close-client-detail').onclick = close;
  modal.onclick = (e) => {
      if (e.target === modal) close();
  }
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });
  // Графіки
  setTimeout(()=>{
    const revenueCanvas = document.getElementById('clientRevenueChart');
    const freqCanvas = document.getElementById('clientFreqChart');
    const avgCheckCanvas = document.getElementById('clientAvgCheckChart');
    if (revenueChart) revenueChart.destroy();
    if (freqChart) freqChart.destroy();
    if (avgCheckChart) avgCheckChart.destroy();
    if (revenueCanvas) {
      revenueChart = new Chart(revenueCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [{label:'Виручка',data:sortedMonths.map(m=>monthMap[m]),borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.2)',fill:true}]
        },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
    }
    if (freqCanvas) {
      freqChart = new Chart(freqCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: freqArr.map((_,i)=>i+1),
          datasets: [{label:'Інтервал (днів)',data:freqArr,borderColor:'#fbbf24',backgroundColor:'rgba(251,191,36,0.2)',fill:true}]
        },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
    }
    if (avgCheckCanvas) {
      avgCheckChart = new Chart(avgCheckCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [{label:'Середній чек',data:sortedAvgCheck,borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.2)',fill:true}]
        },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
    }
  }, 100);
} 