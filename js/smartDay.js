// smartDay.js — Модуль "Створи мій день"
import * as firebase from './firebase.js';
// --- Імпортую getFocusNotes/setFocusNote з focus.js ---
import { getFocusNotes, setFocusNote } from './focus.js';

export const SMARTDAY_PERMISSION = 'smartday_access';

// --- Завантаження співробітників з Firestore ---
async function loadEmployees(companyId) {
  const employeesRef = firebase.collection(firebase.db, 'companies', companyId, 'employees');
  const snapshot = await firebase.getDocs(employeesRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(emp => emp.active !== false);
}

// --- Завантаження members (користувачів) з Firestore ---
async function loadMembers(companyId) {
  const membersRef = firebase.collection(firebase.db, 'companies', companyId, 'members');
  const snapshot = await firebase.getDocs(membersRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Завантаження всіх продажів (як у focus.js) ---
async function getAllSalesData() {
  if (window._smartDaySalesCache) return window._smartDaySalesCache;
  const [dataRes, dataJulyRes] = await Promise.all([
    fetch('модуль помічник продажу/data.json'),
    fetch('https://fastapi.lookfort.com/nomenclature.analysis')
  ]);
  const data = await dataRes.json();
  const dataJuly = await dataJulyRes.json();
  window._smartDaySalesCache = data.concat(dataJuly);
  return window._smartDaySalesCache;
}

// --- Завантаження фокусних задач ---
async function loadFocusTasks(companyId) {
  const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks');
  const snapshot = await firebase.getDocs(tasksRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Генерація задач для менеджера ---
async function generateSmartDayTasks(managerId, employees, sales, focusTasks) {
  // 1. Знаходимо менеджера
  const manager = employees.find(e => e.id === managerId);
  if (!manager) return [];
  // 2. Всі клієнти менеджера
  const clients = {};
  sales.forEach(s => {
    if ((s['Основной менеджер'] || s['Менеджер']) === manager.name && s['Клиент.Код']) {
      if (!clients[s['Клиент.Код']]) {
        clients[s['Клиент.Код']] = {
          code: s['Клиент.Код'],
          name: s['Клиент'],
          link: '#', // можна додати реальні посилання, якщо є
          lastSale: new Date(s['Дата']),
          sales: [s],
        };
      } else {
        clients[s['Клиент.Код']].sales.push(s);
        // Оновлюємо дату останньої покупки
        if (new Date(s['Дата']) > clients[s['Клиент.Код']].lastSale) {
          clients[s['Клиент.Код']].lastSale = new Date(s['Дата']);
        }
      }
    }
  });
  // 3. Задачі: дзвінок, якщо не було покупки 30+ днів; пропозиція; фокус
  const today = new Date();
  const tasks = [];
  Object.values(clients).forEach(client => {
    // Дзвінок, якщо не було покупки 30+ днів
    const daysSinceLast = Math.floor((today - client.lastSale) / (1000*60*60*24));
    if (daysSinceLast >= 30) {
      tasks.push({
        id: `call-${client.code}`,
        type: 'call',
        client: { code: client.code, name: client.name, link: client.link },
        description: `Подзвонити клієнту, не було покупки ${daysSinceLast} днів`,
        dueDate: today.toISOString().slice(0,10),
        priority: 'high',
        done: false
      });
    }
    // Пропозиція: якщо є продажі по певній групі (можна розширити)
    // ... (можна додати додаткову логіку)
  });
  // 4. Фокусні задачі для цього менеджера
  focusTasks.forEach(task => {
    if (!task.clientsSnapshot) return;
    task.clientsSnapshot.forEach(c => {
      if (c.manager === manager.name) {
        tasks.push({
          id: `focus-${task.id}-${c.code}`,
          type: 'focus',
          client: { code: c.code, name: c.name, link: c.link || '#' },
          description: `Виконати фокусну задачу: ${task.title}`,
          dueDate: task.periodTo || '',
          priority: 'medium',
          done: false
        });
      }
    });
  });
  // TODO: Додати інші типи задач (пропозиції, upsell, тощо)
  return tasks;
}

async function loadDepartmentsAndManagers() {
  const companyId = window.state?.currentCompanyId;
  if (!companyId) throw new Error('Компанія не вибрана!');
  const employees = await loadEmployees(companyId);
  // --- Формуємо список унікальних відділів як об'єктів {id, name} ---
  const depMap = {};
  employees.forEach(emp => {
    if (emp.department) {
      if (typeof emp.department === 'object' && emp.department.id && emp.department.name) {
        depMap[emp.department.id] = emp.department.name;
      } else if (typeof emp.department === 'string') {
        if (emp.departmentName) {
          depMap[emp.department] = emp.departmentName;
        } else {
          depMap[emp.department] = emp.department;
        }
      }
    }
  });
  const departments = Object.entries(depMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  // --- Менеджери ---
  const managers = employees.filter(emp => !emp.role || emp.role.toLowerCase().includes('менедж'));
  return { departments, managers, employees };
}

// --- Групування клієнтів по пріоритету ---
function groupClientsByPriority(clients) {
  const groups = { high: [], medium: [], low: [] };
  clients.forEach(c => {
    if (c.priority === 'high') groups.high.push(c);
    else if (c.priority === 'medium') groups.medium.push(c);
    else groups.low.push(c);
  });
  return groups;
}

// --- Рендеринг чекліста клієнтів з групуванням і зведенням (оновлено для фокуса) ---
function renderClientChecklist(taskGroup, notes = {}, onChange = null) {
  const grouped = groupClientsByPriority(taskGroup.clients);
  const summary = [
    { key: 'high', label: 'Високий', color: 'red-400' },
    { key: 'medium', label: 'Середній', color: 'yellow-400' },
    { key: 'low', label: 'Низький', color: 'green-400' }
  ];
  let html = `<div class='mb-2 flex gap-4 text-sm'>`;
  summary.forEach(s => {
    html += `<div><span class='font-semibold text-${s.color}'>${s.label}:</span> ${grouped[s.key].length} <button type='button' class='ml-1 px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-100 toggle-prio' data-prio='${s.key}'>Показати</button></div>`;
  });
  html += `</div>`;
  summary.forEach(s => {
    html += `<div class='client-prio-list' data-prio='${s.key}' style='display:none;'>`;
    if (!grouped[s.key].length) {
      html += `<div class='text-gray-500 italic mb-2'>Немає клієнтів з цим пріоритетом</div>`;
    } else {
      html += `<ul class='space-y-2'>`;
      grouped[s.key].forEach(client => {
        const n = notes[client.code] || {};
        // --- Для "Подзвонити" ---
        if (taskGroup.id === 'call') {
          html += `
            <li class='bg-gray-800 rounded-lg p-3 flex flex-col gap-2'>
              <div class='flex items-center gap-4'>
                <input type='checkbox' ${n.done ? 'checked' : ''} data-clientid='${client.code}' class='client-done'>
                <div class='flex-1'>
                  <div class='font-semibold'>${client.name} <a href='${client.link}' class='text-blue-400 underline ml-2' target='_blank'>[посилання]</a></div>
                  <div class='text-xs text-gray-400'>Остання покупка: ${client.lastSale ? new Date(client.lastSale).toLocaleDateString('uk-UA') : '—'} | Сума: <span class='text-green-400'>${client.lastSum?.toFixed(2) || '—'}</span></div>
                  <div class='text-xs text-gray-400'>Середній чек: <span class='text-yellow-300'>${client.avgCheck?.toFixed(2) || '—'}</span> | Загальна сума: <span class='text-blue-300'>${client.totalSum?.toFixed(2) || '—'}</span></div>
                  <div class='text-xs text-gray-500'>Сфера: ${client.sphere || ''}</div>
                </div>
                <div class='text-xs px-2 py-1 rounded bg-gray-700 text-${s.color} font-bold'>${s.label}</div>
              </div>
            </li>
          `;
        } else {
          // --- Для фокуса та інших задач ---
          html += `
            <li class='bg-gray-800 rounded-lg p-3 flex flex-col gap-2'>
              <div class='flex items-center gap-4'>
                <input type='checkbox' ${n.done ? 'checked' : ''} data-clientid='${client.code}' class='client-done'>
                <div class='flex-1'>
                  <div class='font-semibold'>${client.name} <a href='${client.link}' class='text-blue-400 underline ml-2' target='_blank'>[посилання]</a></div>
                  <div class='text-xs text-gray-400'>Остання покупка: ${client.lastSale ? new Date(client.lastSale).toLocaleDateString('uk-UA') : '—'}</div>
                  <div class='text-xs text-gray-500'>Сфера: ${client.sphere || ''}</div>
                </div>
                <div class='text-xs px-2 py-1 rounded bg-gray-700 text-${s.color} font-bold'>${s.label}</div>
              </div>
              <div class='flex flex-wrap gap-4 items-center mt-2'>
                <label class='text-xs text-gray-300'>Дата комунікації: <input type='date' class='focus-commdate bg-gray-900 text-gray-200 rounded px-2 py-1' data-clientid='${client.code}' value='${n.commDate || ''}'></label>
                <label class='text-xs text-gray-300'>Пропозиція: <input type='checkbox' class='focus-done' data-clientid='${client.code}' ${n.done ? 'checked' : ''}></label>
                <label class='text-xs text-gray-300'>Коментар: <input type='text' class='focus-comment bg-gray-900 text-gray-200 rounded px-2 py-1' data-clientid='${client.code}' value='${n.comment || ''}' style='width:180px;'></label>
              </div>
            </li>
          `;
        }
      });
      html += `</ul>`;
    }
    html += `</div>`;
  });
  return html;
}

// --- Рендеринг задач-груп (оновлено для передачі notes та onChange) ---
function renderTaskGroups(taskGroups, notesByTask = {}) {
  if (!taskGroups.length) return `<div class='text-gray-400'>Задач на сьогодні немає 🎉</div>`;
  return `<div class='space-y-8'>${taskGroups.map(group => `
    <div class='bg-gray-900 rounded-xl p-5 shadow-lg'>
      <div class='text-xl font-bold mb-2'>${group.title}</div>
      ${renderClientChecklist(group, notesByTask[group.id] || {})}
    </div>
  `).join('')}</div>`;
}

// --- Визначення пріоритету для клієнта фокуса за параметрами ---
function getFocusClientPriority(client) {
  if (Array.isArray(client.params)) {
    if (client.params.includes('param1')) return 'high';
    if (client.params.includes('param2')) return 'medium';
    if (client.params.includes('param3')) return 'low';
  }
  return 'medium'; // дефолт
}

// --- Допоміжна функція: отримати клієнтів для крос-продажу по групі ---
function getCrossSellClients(sales, groupName, daysThreshold = 60) {
  // 1. Всі клієнти
  const clientsByCode = {};
  sales.forEach(s => {
    const code = s['Клиент.Код'];
    if (!code) return;
    if (!clientsByCode[code]) {
      clientsByCode[code] = {
        code,
        name: s['Клиент'],
        link: '#',
        lastSale: new Date(s['Дата']),
        sphere: s['Сфера деятельности'] || '',
        groups: new Set(),
        allSales: [],
      };
    }
    clientsByCode[code].allSales.push(s);
    if (new Date(s['Дата']) > clientsByCode[code].lastSale) {
      clientsByCode[code].lastSale = new Date(s['Дата']);
    }
    if (s['Категорія 2']) {
      clientsByCode[code].groups.add(s['Категорія 2']);
    }
  });
  // 2. Всі клієнти, які купували цю групу
  const buyers = Object.values(clientsByCode).filter(c => c.groups.has(groupName));
  // 3. Клієнти, які не купували цю групу, але купують інші (крос-продаж)
  const nonBuyers = Object.values(clientsByCode).filter(c => !c.groups.has(groupName));
  // 4. Клієнти, які купували раніше, але давно не купували цю групу
  const now = new Date();
  const lapsed = buyers.filter(c => {
    // Знаходимо останню покупку саме цієї групи
    const lastGroupSale = c.allSales.filter(s => s['Категорія 2'] === groupName).map(s => new Date(s['Дата'])).sort((a,b)=>b-a)[0];
    if (!lastGroupSale) return false;
    const days = Math.floor((now - lastGroupSale) / (1000*60*60*24));
    return days >= daysThreshold;
  });
  // 5. Формуємо масив для задачі
  const crossSellClients = [
    ...nonBuyers.map(c => ({ ...c, priority: 'medium', reason: 'Ще не купував цю групу' })),
    ...lapsed.map(c => ({ ...c, priority: 'high', reason: `Давно не купував (${groupName})` }))
  ];
  return crossSellClients;
}

// --- Завантаження мапи посилань на клієнтів ---
async function loadClientLinks() {
  if (window._smartDayClientLinks) return window._smartDayClientLinks;
  const res = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
  const arr = await res.json();
  const links = {};
  arr.forEach(c => { links[c['Клиент.Код']] = c['посилання']; });
  window._smartDayClientLinks = links;
  return links;
}

// --- Допоміжна функція: розрахунок прогнозу покупки для клієнта ---
function getPurchaseForecast(client) {
  const sales = client.allSales || [];
  if (sales.length < 2) return null;
  // Всі дати покупок, відсортовані
  const dates = sales.map(s => new Date(s['Дата'])).sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
  }
  if (!intervals.length) return null;
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const lastDate = dates[dates.length - 1];
  const forecastDate = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
  return { forecastDate, avgInterval, lastDate };
}

// --- Оновлена генерація задач-груп ---
async function generateSmartDayTaskGroups(managerId, employees, sales, focusTasks, clientLinks) {
  const manager = employees.find(e => e.id === managerId);
  if (!manager) return [];
  // --- Подзвонити ---
  const today = new Date();
  const callClients = [];
  const clientsMap = {};
  sales.forEach(s => {
    if ((s['Основной менеджер'] || s['Менеджер']) === manager.name && s['Клиент.Код']) {
      if (!clientsMap[s['Клиент.Код']]) {
        clientsMap[s['Клиент.Код']] = {
          code: s['Клиент.Код'],
          name: s['Клиент'],
          link: clientLinks[s['Клиент.Код']] || '#',
          lastSale: new Date(s['Дата']),
          sphere: s['Сфера деятельности'] || '',
          done: false,
          allSales: [],
        };
      }
      clientsMap[s['Клиент.Код']].allSales.push(s);
      if (new Date(s['Дата']) > clientsMap[s['Клиент.Код']].lastSale) {
        clientsMap[s['Клиент.Код']].lastSale = new Date(s['Дата']);
      }
    }
  });
  let callClientsArr = Object.values(clientsMap).filter(client => {
    const daysSinceLast = Math.floor((today - client.lastSale) / (1000*60*60*24));
    return daysSinceLast >= 30;
  });
  callClientsArr = enrichCallClients(callClientsArr);
  // --- Прогноз покупки ---
  const forecastClients = Object.values(clientsMap).map(client => {
    const forecast = getPurchaseForecast(client);
    if (!forecast) return null;
    const { forecastDate, avgInterval, lastDate } = forecast;
    const forecastDateStr = forecastDate.toLocaleDateString('uk-UA');
    const lastDateStr = lastDate.toLocaleDateString('uk-UA');
    let priority = '';
    let status = '';
    if (forecastDate.toDateString() === today.toDateString()) {
      priority = 'high';
      status = 'сьогодні';
    } else if (forecastDate < today) {
      priority = 'medium';
      status = 'прострочено';
    } else {
      return null; // не показуємо майбутні
    }
    return {
      ...client,
      forecastDate,
      forecastDateStr,
      avgInterval,
      lastDateStr,
      priority,
      status
    };
  }).filter(Boolean);
  const forecastGroup = forecastClients.length ? [{
    id: 'forecast',
    title: 'Зателефонувати по прогнозу',
    clients: forecastClients
  }] : [];
  // --- Фокус ---
  const focusGroups = focusTasks.map(task => {
    const clients = (task.clientsSnapshot || []).filter(c => c.manager === manager.name).map(c => ({
      code: c.code,
      name: c.name,
      link: clientLinks[c.code] || '#',
      lastSale: c.lastDate || '',
      sphere: c.sphere || '',
      priority: getFocusClientPriority(c),
      done: false
    }));
    return {
      id: `focus-${task.id}`,
      title: `Фокус: ${task.title}`,
      clients
    };
  });
  // --- Крос-продаж (приклад для групи "Папір") ---
  const crossSellClients = getCrossSellClients(sales.filter(s => (s['Основной менеджер'] || s['Менеджер']) === manager.name), 'Папір');
  const crossSellGroup = crossSellClients.length ? [{
    id: 'cross-sell-paper',
    title: 'Запропонувати групу "Папір" (крос-продаж)',
    clients: crossSellClients.map(c => ({ ...c, link: clientLinks[c.code] || '#' }))
  }] : [];
  // --- Повертаємо масив задач-груп ---
  const groups = [];
  if (callClientsArr.length) groups.push({ id: 'call', title: 'Подзвонити клієнтам', clients: callClientsArr });
  groups.push(...forecastGroup);
  groups.push(...focusGroups);
  groups.push(...crossSellGroup);
  return groups;
}

// --- Додаю розрахунок середнього чека, суми останнього продажу, загальної суми ---
function enrichCallClients(clients) {
  const today = new Date();
  return clients.map(c => {
    const sales = c.allSales || [];
    const lastSaleDate = c.lastSale;
    const lastSale = sales.filter(s => new Date(s['Дата']).getTime() === lastSaleDate.getTime());
    const lastSum = lastSale.reduce((sum, s) => sum + (parseFloat((s['Выручка']||'0').toString().replace(/\s/g,'').replace(',','.'))||0), 0);
    const totalSum = sales.reduce((sum, s) => sum + (parseFloat((s['Выручка']||'0').toString().replace(/\s/g,'').replace(',','.'))||0), 0);
    const avgCheck = sales.length ? (totalSum / sales.length) : 0;
    const daysSinceLast = Math.floor((today - lastSaleDate) / (1000*60*60*24));
    let priority = 'low';
    if (daysSinceLast >= 90) priority = 'high';
    else if (daysSinceLast >= 60) priority = 'medium';
    return {
      ...c,
      lastSum,
      totalSum,
      avgCheck,
      priority
    };
  });
}

export async function initSmartDayModule(container) {
  if (window.state && window.state.currentUserPermissions && !window.state.currentUserPermissions[SMARTDAY_PERMISSION]) {
    container.innerHTML = `<div class='bg-red-900 text-white rounded-lg p-6 text-center text-lg'>У вас немає доступу до модуля \"Створи мій день\"</div>`;
    return;
  }
  container.innerHTML = `<div class=\"p-6\"><h1 class=\"text-3xl font-bold mb-6\">Створи мій день</h1><div id=\"smartday-filters\" class=\"mb-6\"></div><div id=\"smartday-tasks\"></div></div>`;
  const filtersDiv = container.querySelector('#smartday-filters');
  const tasksDiv = container.querySelector('#smartday-tasks');

  // Завантажуємо відділи, менеджерів, співробітників
  const { departments, managers, employees } = await loadDepartmentsAndManagers();

  // --- Авто-селект для поточного користувача ---
  let autoSelectedDepartment = '';
  let autoSelectedManager = '';
  let userAccess = { role: '', employeeId: '', departmentId: '' };
  const companyId = window.state?.currentCompanyId;
  let currentUserId = window.state?.currentUserId;
  let members = [];
  if (companyId && currentUserId) {
    members = await loadMembers(companyId);
    const currentMember = members.find(m => m.userId === currentUserId || m.email === window.state?.currentUserEmail);
    if (currentMember) {
      userAccess.employeeId = currentMember.employeeId;
      userAccess.role = (currentMember.role || '').toLowerCase();
      // Знаходимо departmentId для менеджера
      const emp = employees.find(e => e.id === currentMember.employeeId);
      if (emp && emp.department) {
        if (typeof emp.department === 'object' && emp.department.id) {
          userAccess.departmentId = emp.department.id;
        } else if (typeof emp.department === 'string') {
          userAccess.departmentId = emp.department;
        }
      }
    }
  }
  // --- Визначаємо авто-селект ---
  if (userAccess.role.includes('менедж')) {
    autoSelectedManager = userAccess.employeeId;
    autoSelectedDepartment = userAccess.departmentId || '';
  } else if (userAccess.role.includes('керівник')) {
    autoSelectedDepartment = userAccess.departmentId || '';
  }
  // Якщо лише один відділ — вибираємо його
  if (!autoSelectedDepartment && departments.length === 1) {
    autoSelectedDepartment = departments[0].id;
  }

  filtersDiv.innerHTML = `
    <label class='mr-4'>Відділ:
      <select id='smartday-department' class='dark-input bg-gray-900 text-gray-200'>
        <option value=''>Всі</option>
        ${departments.map(dep => `<option value='${dep.id}'>${dep.name}</option>`).join('')}
      </select>
    </label>
    <label class='mr-4'>Менеджер:
      <select id='smartday-manager' class='dark-input bg-gray-900 text-gray-200' disabled>
        <option value=''>Оберіть менеджера...</option>
      </select>
    </label>
  `;
  const depSelect = filtersDiv.querySelector('#smartday-department');
  const manSelect = filtersDiv.querySelector('#smartday-manager');

  // --- Встановлюємо авто-селект значення ---
  if (autoSelectedDepartment) {
    depSelect.value = autoSelectedDepartment;
    depSelect.dispatchEvent(new Event('change'));
  }
  depSelect.onchange = async () => {
    const depId = depSelect.value;
    const filteredManagers = depId ? managers.filter(m => {
      if (!m.department) return false;
      if (typeof m.department === 'object' && m.department.id) {
        return m.department.id === depId;
      } else if (typeof m.department === 'string') {
        return m.department === depId;
      }
      return false;
    }) : managers;
    manSelect.innerHTML = `<option value=''>Оберіть менеджера...</option>` + filteredManagers.map(m => `<option value='${m.id}'>${m.name}</option>`).join('');
    manSelect.disabled = false;
    tasksDiv.innerHTML = '';
    // Якщо авто-селект менеджера (наприклад, для менеджера)
    if (autoSelectedManager && filteredManagers.some(m => m.id === autoSelectedManager)) {
      manSelect.value = autoSelectedManager;
      manSelect.dispatchEvent(new Event('change'));
      autoSelectedManager = '';
    }
  };
  // Якщо авто-селект менеджера без вибору відділу
  if (autoSelectedManager && managers.some(m => m.id === autoSelectedManager)) {
    manSelect.innerHTML = `<option value=''>Оберіть менеджера...</option>` + managers.map(m => `<option value='${m.id}'>${m.name}</option>`).join('');
    manSelect.disabled = false;
    manSelect.value = autoSelectedManager;
    manSelect.dispatchEvent(new Event('change'));
    autoSelectedManager = '';
  }
  manSelect.onchange = async () => {
    const managerId = manSelect.value;
    if (!managerId) {
      tasksDiv.innerHTML = '';
      return;
    }
    tasksDiv.innerHTML = `<div class='text-gray-400'>Генерація задач для менеджера...</div>`;
    const [sales, focusTasks, clientLinks] = await Promise.all([
      getAllSalesData(),
      loadFocusTasks(companyId),
      loadClientLinks()
    ]);
    const taskGroups = await generateSmartDayTaskGroups(managerId, employees, sales, focusTasks, clientLinks);
    // --- Підвантажуємо нотатки для фокусних задач ---
    const notesByTask = {};
    for (const group of taskGroups) {
      if (group.id.startsWith('focus-')) {
        const taskId = group.id.replace('focus-', '');
        notesByTask[group.id] = await getFocusNotes(taskId);
      }
    }
    tasksDiv.innerHTML = renderTaskGroups(taskGroups, notesByTask);
    // --- Обробка чекбоксів, дат, коментарів для фокуса ---
    for (const group of taskGroups) {
      if (group.id.startsWith('focus-')) {
        const taskId = group.id.replace('focus-', '');
        group.clients.forEach(client => {
          const code = client.code;
          // Пропозиція (done)
          tasksDiv.querySelectorAll(`.focus-done[data-clientid='${code}']`).forEach(cb => {
            cb.addEventListener('change', async e => {
              const li = cb.closest('li');
              const commDate = li.querySelector('.focus-commdate')?.value || '';
              const comment = li.querySelector('.focus-comment')?.value || '';
              await setFocusNote(taskId, code, { done: cb.checked, commDate, comment });
              li.classList.toggle('opacity-50', cb.checked);
            });
          });
          // Дата комунікації
          tasksDiv.querySelectorAll(`.focus-commdate[data-clientid='${code}']`).forEach(input => {
            input.addEventListener('change', async e => {
              const li = input.closest('li');
              const done = li.querySelector('.focus-done')?.checked || false;
              const comment = li.querySelector('.focus-comment')?.value || '';
              await setFocusNote(taskId, code, { done, commDate: input.value, comment });
            });
          });
          // Коментар
          tasksDiv.querySelectorAll(`.focus-comment[data-clientid='${code}']`).forEach(input => {
            input.addEventListener('change', async e => {
              const li = input.closest('li');
              const done = li.querySelector('.focus-done')?.checked || false;
              const commDate = li.querySelector('.focus-commdate')?.value || '';
              await setFocusNote(taskId, code, { done, commDate, comment: input.value });
            });
          });
        });
      }
    }
    // --- Обробка розгортання по пріоритету ---
    tasksDiv.querySelectorAll('.toggle-prio').forEach(btn => {
      btn.addEventListener('click', e => {
        const prio = btn.dataset.prio;
        const list = btn.closest('.bg-gray-900').querySelector(`.client-prio-list[data-prio='${prio}']`);
        if (list) {
          list.style.display = list.style.display === 'none' ? '' : 'none';
          btn.textContent = list.style.display === 'none' ? 'Показати' : 'Сховати';
        }
      });
    });
  };
}

if (typeof window !== 'undefined') {
  window.initSmartDayModule = initSmartDayModule;
} 