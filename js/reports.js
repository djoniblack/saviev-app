// --- МОДУЛЬ ЗВІТІВ ---

// Головна функція для рендеру звіту по відділу
export function renderDepartmentReport() {
  const container = document.getElementById('departmentReportContainer');
  if (!container) return;
  // --- Фільтри ---
  const allDepartments = window.state?.allDepartments || [];
  const allEmployees = window.state?.allEmployees || [];
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let selectedMonth = container.querySelector('input[type="month"]')?.value || defaultMonth;
  let selectedDeptId = container.querySelector('select')?.value || 'all';

  // --- Рендер фільтрів ---
  container.innerHTML = `
    <div class="flex gap-4 mb-4">
      <label class="flex flex-col text-sm text-gray-300">Місяць
        <input type="month" value="${selectedMonth}" class="dark-input p-2" id="departmentReportMonthFilter">
      </label>
      <label class="flex flex-col text-sm text-gray-300">Відділ
        <select id="departmentReportDeptFilter" class="dark-input p-2">
          <option value="all">Всі відділи</option>
          ${allDepartments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </label>
    </div>
    <div id="departmentReportStats"></div>
  `;
  container.querySelector('#departmentReportMonthFilter').value = selectedMonth;
  container.querySelector('#departmentReportDeptFilter').value = selectedDeptId;

  // --- Обробники фільтрів ---
  container.querySelector('#departmentReportMonthFilter').onchange = renderDepartmentReport;
  container.querySelector('#departmentReportDeptFilter').onchange = renderDepartmentReport;

  // --- Дані для звіту ---
  const monthKey = selectedMonth.replace('-', '');
  const deptId = selectedDeptId;
  // Фільтруємо співробітників
  const employees = deptId === 'all' ? allEmployees : allEmployees.filter(e => e.department === deptId);
  // Середня зарплата
  let totalSalary = 0, salaryCount = 0;
  Object.values(window.state?.massSalarySnapshots || {}).forEach(snapshot => {
    if (snapshot.monthKey === monthKey) {
      snapshot.employees.forEach(emp => {
        if (deptId === 'all' || emp.department === deptId) {
          const val = parseFloat(emp.results?.total?.replace(/\s/g, '').replace(',', '.')) || 0;
          totalSalary += val;
          salaryCount++;
        }
      });
    }
  });
  const avgSalary = salaryCount ? (totalSalary / salaryCount) : 0;
  // Сума продажів
  let totalSales = 0;
  const salesDoc = window.state?.salesSnapshots?.[monthKey];
  if (salesDoc && salesDoc.sales) {
    salesDoc.sales.forEach(s => {
      const emp = allEmployees.find(e => e.id === s.employeeId);
      if (emp && (deptId === 'all' || emp.department === deptId)) {
        totalSales += parseFloat(s.amount) || 0;
      }
    });
  }
  // Середній % виконання KPI
  let totalKpi = 0, kpiCount = 0;
  employees.forEach(emp => {
    const kpiDoc = window.state?.kpiActuals?.[emp.id]?.[monthKey];
    if (kpiDoc && kpiDoc.kpiCategories) {
      let totalWeighted = 0;
      kpiDoc.kpiCategories.forEach(cat => {
        const achievement = cat.planAmount > 0 ? (cat.factAmount / cat.planAmount) : (cat.factAmount > 0 ? 1 : 0);
        totalWeighted += achievement * (cat.weight / 100);
      });
      totalKpi += totalWeighted * 100;
      kpiCount++;
    }
  });
  const avgKpi = kpiCount ? (totalKpi / kpiCount) : 0;
  // Кількість співробітників
  const employeeCount = employees.length;
  // Плинність кадрів (нові/звільнені)
  let hired = 0, fired = 0;
  employees.forEach(emp => {
    if (emp.hireDate && emp.hireDate.startsWith(selectedMonth)) hired++;
    if (emp.fireDate && emp.fireDate.startsWith(selectedMonth)) fired++;
  });
  // --- Вивід метрик ---
  container.querySelector('#departmentReportStats').innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-gray-700 rounded p-4"><div class="text-gray-400 text-xs mb-1">Середня зарплата</div><div class="text-2xl font-bold">${avgSalary.toLocaleString('uk-UA', {maximumFractionDigits:0})} ₴</div></div>
      <div class="bg-gray-700 rounded p-4"><div class="text-gray-400 text-xs mb-1">Сума продажів</div><div class="text-2xl font-bold">${totalSales.toLocaleString('uk-UA', {maximumFractionDigits:0})} ₴</div></div>
      <div class="bg-gray-700 rounded p-4"><div class="text-gray-400 text-xs mb-1">Середній % KPI</div><div class="text-2xl font-bold">${avgKpi.toFixed(1)}%</div></div>
      <div class="bg-gray-700 rounded p-4"><div class="text-gray-400 text-xs mb-1">Кількість співробітників</div><div class="text-2xl font-bold">${employeeCount}</div></div>
      <div class="bg-gray-700 rounded p-4"><div class="text-gray-400 text-xs mb-1">Нові співробітники</div><div class="text-2xl font-bold">${hired}</div></div>
      <div class="bg-gray-700 rounded p-4"><div class="text-gray-400 text-xs mb-1">Звільнені</div><div class="text-2xl font-bold">${fired}</div></div>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm text-left mt-6 bg-gray-800 rounded-lg shadow">
        <thead class="bg-gray-700">
          <tr>
            <th class="px-4 py-2 text-gray-300">Співробітник</th>
            <th class="px-4 py-2 text-gray-300">Посада</th>
            <th class="px-4 py-2 text-gray-300">Зарплата</th>
            <th class="px-4 py-2 text-gray-300">KPI (%)</th>
          </tr>
        </thead>
        <tbody id="departmentReportEmployeesTbody"></tbody>
      </table>
    </div>
  `;
  // --- Рендерим строки сотрудников ---
  const tbody = container.querySelector('#departmentReportEmployeesTbody');
  employees.forEach(emp => {
    const position = window.state?.positions?.find(p => p.id === emp.positionId);
    // Зарплата
    let salary = 0;
    Object.values(window.state?.massSalarySnapshots || {}).forEach(snapshot => {
      if (snapshot.monthKey === monthKey) {
        const found = snapshot.employees.find(e => e.employeeId === emp.id);
        if (found) salary = parseFloat(found.results?.total?.replace(/\s/g, '').replace(',', '.')) || 0;
      }
    });
    // KPI
    let kpiPercent = '';
    const kpiDoc = window.state?.kpiActuals?.[emp.id]?.[monthKey];
    if (kpiDoc && kpiDoc.kpiCategories) {
      let totalWeighted = 0;
      kpiDoc.kpiCategories.forEach(cat => {
        const achievement = cat.planAmount > 0 ? (cat.factAmount / cat.planAmount) : (cat.factAmount > 0 ? 1 : 0);
        totalWeighted += achievement * (cat.weight / 100);
      });
      kpiPercent = (totalWeighted * 100).toFixed(1);
    }
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-indigo-900 cursor-pointer transition';
    tr.innerHTML = `
      <td class="px-4 py-2 text-white">${emp.name}</td>
      <td class="px-4 py-2 text-gray-300">${position?.name || ''}</td>
      <td class="px-4 py-2 text-green-400">${salary ? salary.toLocaleString('uk-UA', {maximumFractionDigits:0}) : ''}</td>
      <td class="px-4 py-2 text-blue-400">${kpiPercent}</td>
    `;
    tr.onclick = () => showEmployeeReportModal(emp, monthKey);
    tbody.appendChild(tr);
  });
  // --- Модалка для детального отчета ---
  if (!document.getElementById('employeeReportModal')) {
    const modal = document.createElement('div');
    modal.id = 'employeeReportModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 hidden';
    modal.innerHTML = `
      <div class="bg-gray-900 rounded-xl shadow-lg p-8 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
        <button id="closeEmployeeReportModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
        <div id="employeeReportModalContent"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#closeEmployeeReportModal').onclick = () => modal.classList.add('hidden');
  }
  // --- Функция показа модалки ---
  window.showEmployeeReportModal = function(emp, monthKey) {
    const modal = document.getElementById('employeeReportModal');
    const content = modal.querySelector('#employeeReportModalContent');
    // KPI, графики, история (можно использовать логику из salesAssistant.js)
    // --- KPI ---
    let kpiHtml = `<h2 class="text-2xl font-bold text-white mb-2">${emp.name}</h2>`;
    const position = window.state?.positions?.find(p => p.id === emp.positionId);
    kpiHtml += `<div class="text-gray-400 mb-4">${position?.name || ''}</div>`;
    // KPI детали
    const kpiDoc = window.state?.kpiActuals?.[emp.id]?.[monthKey];
    if (kpiDoc && kpiDoc.kpiCategories) {
      kpiHtml += `<div class="mb-4"><b>KPI:</b><ul class="list-disc list-inside">`;
      kpiDoc.kpiCategories.forEach(cat => {
        kpiHtml += `<li>${cat.name}: <span class="text-blue-400">${cat.factAmount}</span> / <span class="text-gray-300">${cat.planAmount}</span> (<span class="text-green-400">${cat.weight}%</span>)</li>`;
      });
      kpiHtml += `</ul></div>`;
    }
    // --- Графики (динамика по месяцам) ---
    // Собираем данные по месяцам для сотрудника
    const months = [];
    const kpiPercents = [];
    const salaryData = [];
    Object.values(window.state?.kpiActuals?.[emp.id] || {}).forEach((doc, idx) => {
      const key = Object.keys(window.state.kpiActuals[emp.id])[idx];
      months.push(key.slice(0,4)+'-'+key.slice(4));
      if (doc.kpiCategories) {
        let totalWeighted = 0;
        doc.kpiCategories.forEach(cat => {
          const achievement = cat.planAmount > 0 ? (cat.factAmount / cat.planAmount) : (cat.factAmount > 0 ? 1 : 0);
          totalWeighted += achievement * (cat.weight / 100);
        });
        kpiPercents.push((totalWeighted * 100).toFixed(1));
      } else {
        kpiPercents.push('');
      }
      // Зарплата
      let salary = 0;
      Object.values(window.state?.massSalarySnapshots || {}).forEach(snapshot => {
        if (snapshot.monthKey === key) {
          const found = snapshot.employees.find(e => e.employeeId === emp.id);
          if (found) salary = parseFloat(found.results?.total?.replace(/\s/g, '').replace(',', '.')) || 0;
        }
      });
      salaryData.push(salary);
    });
    kpiHtml += `<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
      <div><canvas id="empKpiChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">KPI % по місяцях</div></div>
      <div><canvas id="empSalaryChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">Зарплата по місяцях</div></div>
    </div>`;
    content.innerHTML = kpiHtml;
    setTimeout(() => {
      new Chart(document.getElementById('empKpiChart').getContext('2d'), {
        type: 'line',
        data: { labels: months, datasets: [{label:'KPI %',data:kpiPercents,borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.2)',fill:true}] },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
      new Chart(document.getElementById('empSalaryChart').getContext('2d'), {
        type: 'bar',
        data: { labels: months, datasets: [{label:'Зарплата',data:salaryData,backgroundColor:'rgba(34,197,94,0.7)'}] },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
    }, 0);
    modal.classList.remove('hidden');
  };
}

// --- Заглушки для майбутніх звітів ---
export function renderBonusesReport() {
  // TODO: реалізувати звіт по бонусах
}
export function renderComparisonReport() {
  // TODO: реалізувати порівняльний звіт
}

export function renderMonthlyDynamicsTest() {
  const panel = document.getElementById('reportTabPanelMonthlyDynamics');
  if (panel) {
    panel.insertAdjacentHTML('afterbegin', '<h1 style="color:#fff;font-size:2rem;">ТЕСТ</h1>');
  }
}

// Додати виклик setupUniversalTabs для звітів у відповідному місці
// Додати import { setupUniversalTabs } from './ui.js' якщо потрібно 