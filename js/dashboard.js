// dashboard.js — модульная версия для интеграции в приложение

export async function initDashboardPage(container) {
  // Очистить контейнер
  container.innerHTML = `
    <div class="w-full max-w-7xl flex flex-col gap-8 py-8 mx-auto">
      <h1 class="text-3xl font-bold mb-4 text-white">Головний дашборд</h1>
      <div id="dashboard-tabs" class="flex gap-2 mb-6">
        <button class="dashboard-tab-btn btn btn-primary" data-tab="main">Загальні метрики</button>
        <button class="dashboard-tab-btn btn btn-secondary" data-tab="lost">Втрачено клієнтів</button>
        <button class="dashboard-tab-btn btn btn-secondary" data-tab="inactive">Неактивні клієнти</button>
        <button class="dashboard-tab-btn btn btn-secondary" data-tab="dynamics">Динаміка продаж</button>
        <button class="dashboard-tab-btn btn btn-secondary" data-tab="quality">Якість бази</button>
      </div>
      <div id="dashboard-filters" class="mb-6 bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4 flex flex-wrap gap-4"></div>
      <div id="dashboard-tab-main" class="dashboard-tab-section">
        <div id="kpi-cards" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4">
            <h2 class="text-lg font-bold mb-2">Продажі по менеджерах</h2>
            <canvas id="salesByManagerChart" height="180"></canvas>
          </div>
          <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4">
            <h2 class="text-lg font-bold mb-2">Клієнти по менеджерах</h2>
            <canvas id="clientsByManagerChart" height="180"></canvas>
          </div>
        </div>
        <div id="top-managers-section"></div>
      </div>
      <div id="dashboard-tab-lost" class="dashboard-tab-section hidden">
        <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4 mb-6">
          <h2 class="text-lg font-bold mb-2">Втрачено клієнтів по менеджерах/відділах</h2>
          <div id="lostClientsTable"></div>
        </div>
        <!-- Здесь можно добавить расширенные метрики и графики по потерянным клиентам -->
      </div>
      <div id="dashboard-tab-inactive" class="dashboard-tab-section hidden">
        <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4 mb-6">
          <h2 class="text-lg font-bold mb-2">Неактивні клієнти по менеджерах/відділах</h2>
          <div id="inactiveClientsTable"></div>
        </div>
        <!-- Здесь можно добавить расширенные метрики и графики по неактивным клиентам -->
      </div>
      <div id="dashboard-tab-dynamics" class="dashboard-tab-section hidden">
        <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4 mb-6">
          <h2 class="text-lg font-bold mb-2">Динаміка продаж</h2>
          <!-- Здесь будут графики и таблицы динамики -->
          <div id="dynamics-placeholder" class="text-gray-400">(Динаміка продаж — в розробці)</div>
        </div>
      </div>
      <div id="dashboard-tab-quality" class="dashboard-tab-section hidden">
        <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4 mb-6">
          <h2 class="text-lg font-bold mb-2">Якість бази</h2>
          <!-- Здесь будут метрики по якості бази -->
          <div id="quality-placeholder" class="text-gray-400">(Якість бази — в розробці)</div>
        </div>
      </div>
    </div>
  `;
  // Переключение вкладок
  const tabBtns = container.querySelectorAll('.dashboard-tab-btn');
  const tabSections = container.querySelectorAll('.dashboard-tab-section');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('btn-primary'));
      tabBtns.forEach(b => b.classList.add('btn-secondary'));
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
      tabSections.forEach(sec => sec.classList.add('hidden'));
      const tab = btn.getAttribute('data-tab');
      const section = container.querySelector(`#dashboard-tab-${tab}`);
      if (section) section.classList.remove('hidden');
    };
  });
  // Инициализация фильтров и рендера
  await loadDashboardData(); // Чекаємо завантаження даних
  renderDashboardFilters();
  rerenderDashboard();
}

// По умолчанию — текущий месяц
const now = new Date();
const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
const defaultTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
let periodFrom = defaultFrom;
let periodTo = defaultTo;

let allEmployees = [];
let departments = [];

// Подключаем сотрудников и отделы из window.state, если есть
function syncEmployeesAndDepartments() {
  if (window.state) {
    allEmployees = window.state.allEmployees || [];
    departments = window.state.departments || [];
  }
}

// Добавляем фильтр по отделу
let currentDepartment = '';
let currentManager = '';

async function loadDashboardData() {
  const [dataRes, dataJulyRes, refRes] = await Promise.all([
    fetch('модуль помічник продажу/data.json'),
    fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
    fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url')
  ]);
  const data = await dataRes.json();
  const dataJuly = await dataJulyRes.json();
  masterData = data.concat(dataJuly);
  const refData = await refRes.json();
  clientLinks = Object.fromEntries(refData.map(item => [item['Клієнт.Код'], item['посилання']]));
  // Ці рядки тепер будуть викликатися в initDashboardPage, щоб уникнути race condition
  // renderDashboardFilters();
  // rerenderDashboard();
}

// Видаляємо автоматичний виклик, щоб керувати ним ззовні
// document.addEventListener('DOMContentLoaded', loadDashboardData);

let departmentFilterInterval = null;

function renderDashboardFilters() {
  syncEmployeesAndDepartments();
  const managers = [...new Set(masterData.map(item => item['Основной менеджер']))].filter(Boolean).sort();
  const filtersDiv = document.getElementById('dashboard-filters');
  // Фильтры: отдел, менеджер, период (от/до), быстрые кнопки
  filtersDiv.innerHTML = `
    <div class="flex flex-wrap gap-4 items-end">
      <div>
        <label class="block text-sm font-medium mb-1">Відділ:</label>
        <select id="dashboard-department-filter" class="dark-input">
          <option value="">Всі</option>
          ${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Менеджер:</label>
        <select id="dashboard-manager-filter" class="dark-input">
          <option value="">Всі</option>
          ${managers.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Період від:</label>
        <input type="date" id="period-from" class="dark-input" value="${periodFrom.toISOString().slice(0,10)}">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">до:</label>
        <input type="date" id="period-to" class="dark-input" value="${periodTo.toISOString().slice(0,10)}">
      </div>
      <div class="flex gap-2 mb-2">
        <button id="quick-month" class="btn btn-secondary">Місяць</button>
        <button id="quick-quarter" class="btn btn-secondary">Квартал</button>
        <button id="quick-year" class="btn btn-secondary">Рік</button>
      </div>
    </div>
  `;
  // Восстанавливаем выбранного менеджера после рендера
  const managerSelect = document.getElementById('dashboard-manager-filter');
  if (currentManager) managerSelect.value = currentManager;
  managerSelect.onchange = e => { currentManager = e.target.value; rerenderDashboard(); };
  const departmentSelect = document.getElementById('dashboard-department-filter');
  if (currentDepartment) departmentSelect.value = currentDepartment;
  departmentSelect.onchange = e => { currentDepartment = e.target.value; rerenderDashboard(); };
  document.getElementById('period-from').onchange = e => { periodFrom = new Date(e.target.value); rerenderDashboard(); };
  document.getElementById('period-to').onchange = e => { periodTo = new Date(e.target.value); rerenderDashboard(); };
  document.getElementById('quick-month').onclick = () => {
    const now = new Date();
    periodFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    periodTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    renderDashboardFilters(); rerenderDashboard();
  };
  document.getElementById('quick-quarter').onclick = () => {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    periodFrom = quarterStart;
    periodTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    renderDashboardFilters(); rerenderDashboard();
  };
  document.getElementById('quick-year').onclick = () => {
    const now = new Date();
    periodFrom = new Date(now.getFullYear(), 0, 1);
    periodTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    renderDashboardFilters(); rerenderDashboard();
  };
  // Если отделов нет — запускаем автообновление фильтра
  if (!departments.length && !departmentFilterInterval) {
    departmentFilterInterval = setInterval(() => {
      syncEmployeesAndDepartments();
      if (departments.length) {
        clearInterval(departmentFilterInterval);
        departmentFilterInterval = null;
        renderDashboardFilters();
      }
    }, 2000);
  }
}

function rerenderDashboard() {
  renderKpiCards();
  renderSalesByManagerChart();
  renderClientsByManagerChart();
  renderTopManagersSection();
  renderLostClientsTable();
  renderInactiveClientsTable();
}

// Сравнение ФИО без учёта порядка слов, регистра и лишних пробелов
function namesMatch(a, b) {
  if (!a || !b) return false;
  const setA = new Set(a.trim().toLowerCase().split(/\s+/));
  const setB = new Set(b.trim().toLowerCase().split(/\s+/));
  if (setA.size !== setB.size) return false;
  for (const word of setA) {
    if (!setB.has(word)) return false;
  }
  return true;
}

// Приведение ФИО к нормализованному виду (без учёта порядка слов)
function normalizeName(name) {
  return name
    ? name.trim().toLowerCase().split(/\s+/).sort().join(' ')
    : '';
}

// Индекс для быстрого поиска сотрудника по ФИО
let employeeNameMap = null;
function buildEmployeeNameMap() {
  employeeNameMap = {};
  for (const emp of allEmployees) {
    const key = normalizeName(emp.name);
    employeeNameMap[key] = emp;
  }
}

function getFilteredData() {
  // Фильтрация по отделу, менеджеру, периоду
  if (!employeeNameMap) buildEmployeeNameMap();
  const filtered = masterData.filter(sale => {
    if (currentDepartment) {
      const emp = employeeNameMap[normalizeName(sale['Основной менеджер'])];
      if (!emp) return false;
      if (emp.department !== currentDepartment) return false;
    }
    if (currentManager && normalizeName(sale['Основной менеджер']) !== normalizeName(currentManager)) return false;
    const date = new Date(sale['Дата']);
    return date >= periodFrom && date <= periodTo;
  });
  return filtered;
}

// Експортуємо функцію для глобального використання
window.initDashboardPage = initDashboardPage;

function renderKpiCards() {
  const data = getFilteredData();
  // Строим объект клиентов, как в alerts.js
  const clients = {};
  let totalSales = 0;
  data.forEach(sale => {
    const code = sale['Клієнт.Код'] || sale['Клиент.Код'] || sale['Клиент'] || '';
    if (!code) return;
    const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
    if (!clients[code]) clients[code] = { name: sale['Клієнт'] || sale['Клиент'], code, sum: 0 };
    clients[code].sum += revenue;
    totalSales += revenue;
  });
  const totalClients = Object.keys(clients).length;
  const avgCheck = data.length ? (totalSales / data.length) : 0;
  // Новые клиенты — те, у кого первая продажа в периоде
  let newClients = 0;
  Object.values(clients).forEach(client => {
    // Найти все продажи этого клиента
    const sales = data.filter(s => (s['Клієнт.Код'] || s['Клиент.Код'] || s['Клиент'] || '') === client.code);
    const firstSaleDate = sales.length ? new Date(Math.min(...sales.map(s => new Date(s['Дата'])))) : null;
    if (firstSaleDate && firstSaleDate >= periodFrom) newClients++;
  });
  document.getElementById('kpi-cards').innerHTML = `
    <div class="bg-gray-800 rounded-xl p-6 flex flex-col items-center shadow-lg">
      <div class="text-3xl font-bold text-indigo-400">${totalSales.toLocaleString('uk-UA', {maximumFractionDigits:2})}</div>
      <div class="text-gray-400 mt-2">Сума продаж</div>
    </div>
    <div class="bg-gray-800 rounded-xl p-6 flex flex-col items-center shadow-lg">
      <div class="text-3xl font-bold text-green-400">${totalClients}</div>
      <div class="text-gray-400 mt-2">Клієнтів</div>
    </div>
    <div class="bg-gray-800 rounded-xl p-6 flex flex-col items-center shadow-lg">
      <div class="text-3xl font-bold text-blue-400">${avgCheck.toLocaleString('uk-UA', {maximumFractionDigits:2})}</div>
      <div class="text-gray-400 mt-2">Середній чек</div>
    </div>
    <div class="bg-gray-800 rounded-xl p-6 flex flex-col items-center shadow-lg">
      <div class="text-3xl font-bold text-yellow-400">${newClients}</div>
      <div class="text-gray-400 mt-2">Нових клієнтів</div>
    </div>
  `;
}

function renderSalesByManagerChart() {
  const data = getFilteredData();
  const salesByManager = {};
  data.forEach(sale => {
    const m = sale['Основной менеджер'] || 'Без менеджера';
    const revenue = parseFloat((sale['Выручка']+'').replace(/\s/g,'').replace(',','.')) || 0;
    salesByManager[m] = (salesByManager[m] || 0) + revenue;
  });
  const ctx = document.getElementById('salesByManagerChart').getContext('2d');
  if (window.salesByManagerChartObj) window.salesByManagerChartObj.destroy();
  window.salesByManagerChartObj = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(salesByManager),
      datasets: [{
        label: 'Сума продаж',
        data: Object.values(salesByManager),
        backgroundColor: 'rgba(99,102,241,0.7)'
      }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:false}},
      scales: {
        y: { beginAtZero: true, ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } },
        x: { ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } }
      }
    }
  });
}

function renderClientsByManagerChart() {
  const data = getFilteredData();
  // Строим объект: менеджер -> Set(уникальных клиентов)
  const clientsByManager = {};
  data.forEach(sale => {
    const m = sale['Основной менеджер'] || 'Без менеджера';
    const code = sale['Клієнт.Код'] || sale['Клиент.Код'] || sale['Клиент'] || '';
    if (!code) return;
    if (!clientsByManager[m]) clientsByManager[m] = new Set();
    clientsByManager[m].add(code);
  });
  const ctx = document.getElementById('clientsByManagerChart').getContext('2d');
  if (window.clientsByManagerChartObj) window.clientsByManagerChartObj.destroy();
  window.clientsByManagerChartObj = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(clientsByManager),
      datasets: [{
        label: 'Кількість клієнтів',
        data: Object.values(clientsByManager).map(set => set.size),
        backgroundColor: 'rgba(16,185,129,0.7)'
      }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:false}},
      scales: {
        y: { beginAtZero: true, ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } },
        x: { ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } }
      }
    }
  });
}

const LOST_CLIENT_MONTHS = 3; // Сколько месяцев без покупок считать клиент потерянным

function renderLostClientsTable() {
  // Клиенты, у которых не было продаж в выбранном периоде, но были ранее
  const allClients = {};
  masterData.forEach(sale => {
    const code = sale['Клієнт.Код'] || sale['Клиент.Код'] || sale['Клиент'] || '';
    const name = sale['Клієнт'] || sale['Клиент'] || code;
    const manager = sale['Основной менеджер'] || '';
    const date = new Date(sale['Дата']);
    if (!allClients[code]) allClients[code] = [];
    allClients[code].push({ date, name, manager, sale });
  });
  // Потерянные: последняя продажа была более LOST_CLIENT_MONTHS назад относительно конца периода
  const lost = Object.entries(allClients)
    .map(([code, sales]) => {
      const sorted = sales.sort((a, b) => b.date - a.date);
      return { code, name: sorted[0].name, manager: sorted[0].manager, lastDate: sorted[0].date, sale: sorted[0].sale };
    })
    .filter(client => {
      const threshold = new Date(periodTo);
      threshold.setMonth(threshold.getMonth() - LOST_CLIENT_MONTHS);
      return client.lastDate < threshold;
    });
  // Получаем отдел и ссылку на CRM
  const lostRows = lost.map(client => {
    let emp = null;
    if (employeeNameMap && client.manager) {
      emp = Object.values(employeeNameMap).find(e => normalizeName(e.name) === normalizeName(client.manager));
    }
    const departmentName = emp && departments.find(d => d.id === emp.department)?.name || '';
    // Ссылка на CRM (как в сигнализации)
    const clientLink = clientLinks ? clientLinks[client.code] : null;
    return {
      ...client,
      departmentName,
      clientLink
    };
  });
  // Рендерим таблицу
  document.getElementById('lostClientsTable').innerHTML = `
    <table class="min-w-full text-sm text-left">
      <thead><tr>
        <th class="px-2 py-1">Клієнт</th>
        <th class="px-2 py-1">Менеджер</th>
        <th class="px-2 py-1">Відділ</th>
        <th class="px-2 py-1">Остання покупка</th>
        <th class="px-2 py-1">Сума</th>
      </tr></thead>
      <tbody>
        ${lostRows.slice(0, 50).map(row => `
          <tr>
            <td class="px-2 py-1">
              ${row.clientLink ? `<a href="${row.clientLink}" target="_blank" class="text-blue-400 underline">${row.name}</a>` : row.name}
            </td>
            <td class="px-2 py-1">${row.manager}</td>
            <td class="px-2 py-1">${row.departmentName}</td>
            <td class="px-2 py-1">${row.lastDate.toLocaleDateString('uk-UA')}</td>
            <td class="px-2 py-1">${row.sale['Выручка'] ? Number(row.sale['Выручка'].toString().replace(/\s/g,'').replace(',','.')).toLocaleString('uk-UA', {maximumFractionDigits:2}) : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderInactiveClientsTable() {
  // Клиенты, у которых не было продаж за последние 3 месяца до начала периода
  const allClients = {};
  masterData.forEach(sale => {
    const code = sale['Клієнт.Код'] || sale['Клиент.Код'] || sale['Клиент'] || '';
    const date = new Date(sale['Дата']);
    if (!allClients[code]) allClients[code] = [];
    allClients[code].push(date);
  });
  // Неактивные: последняя продажа до (periodFrom - 3 месяца)
  const inactiveThreshold = new Date(periodFrom);
  inactiveThreshold.setMonth(inactiveThreshold.getMonth() - 3);
  const inactive = Object.entries(allClients).filter(([code, dates]) => {
    const last = dates.sort((a,b)=>b-a)[0];
    return last < inactiveThreshold;
  });
  document.getElementById('inactiveClientsTable').innerHTML = `<table class="min-w-full text-sm text-left"><thead><tr><th class="px-2 py-1">Клієнт</th><th class="px-2 py-1">Остання покупка</th></tr></thead><tbody>
    ${inactive.slice(0,20).map(([code, dates]) => `<tr><td class="px-2 py-1">${code}</td><td class="px-2 py-1">${dates.sort((a,b)=>b-a)[0].toLocaleDateString('uk-UA')}</td></tr>`).join('')}
  </tbody></table>`;
}

function renderTopManagersSection() {
  const data = getFilteredData();
  // Сумма продаж по менеджерам
  const salesByManager = {};
  const clientsByManager = {};
  data.forEach(sale => {
    const m = sale['Основной менеджер'] || 'Без менеджера';
    const code = sale['Клієнт.Код'] || sale['Клиент.Код'] || sale['Клиент'] || '';
    const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
    salesByManager[m] = (salesByManager[m] || 0) + revenue;
    if (!clientsByManager[m]) clientsByManager[m] = new Set();
    if (code) clientsByManager[m].add(code);
  });
  // Топ-5 по продажам
  const topManagers = Object.entries(salesByManager)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  // Топ-5 аутсайдеров по клиентам
  const lowManagers = Object.entries(clientsByManager)
    .map(([m, set]) => [m, set.size])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5);
  // Вставляем секцию
  let section = document.getElementById('top-managers-section');
  if (!section) {
    section = document.createElement('div');
    section.id = 'top-managers-section';
    section.className = 'grid grid-cols-1 md:grid-cols-2 gap-8 mb-6';
    const container = document.querySelector('.w-full.max-w-7xl.flex.flex-col.gap-8.py-8');
    container.insertBefore(section, container.children[3]); // после KPI
  }
  section.innerHTML = `
    <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4">
      <h2 class="text-lg font-bold mb-2">Топ-5 менеджерів за продажами</h2>
      <canvas id="topManagersChart" height="180"></canvas>
    </div>
    <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4">
      <h2 class="text-lg font-bold mb-2">Топ-5 аутсайдерів за клієнтами</h2>
      <canvas id="lowManagersChart" height="180"></canvas>
    </div>
  `;
  // График топ-5
  const ctx1 = document.getElementById('topManagersChart').getContext('2d');
  if (window.topManagersChartObj) window.topManagersChartObj.destroy();
  window.topManagersChartObj = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: topManagers.map(([m]) => m),
      datasets: [{
        label: 'Сума продаж',
        data: topManagers.map(([_, v]) => v),
        backgroundColor: 'rgba(99,102,241,0.7)'
      }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:false}},
      scales: {
        y: { beginAtZero: true, ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } },
        x: { ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } }
      }
    }
  });
  // График аутсайдеров
  const ctx2 = document.getElementById('lowManagersChart').getContext('2d');
  if (window.lowManagersChartObj) window.lowManagersChartObj.destroy();
  window.lowManagersChartObj = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: lowManagers.map(([m]) => m),
      datasets: [{
        label: 'Кількість клієнтів',
        data: lowManagers.map(([_, v]) => v),
        backgroundColor: 'rgba(239,68,68,0.7)'
      }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:false}},
      scales: {
        y: { beginAtZero: true, ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } },
        x: { ticks: { color: '#e5e7eb' }, grid: { color: '#374151' } }
      }
    }
  });
} 