// js/departmentDashboard.js
// Модуль для рендеринга дашборда по отделам

import * as firebase from './firebase.js';
import { loadClientManagerDirectory } from './main.js';

// --- Глобальные переменные модуля ---
let masterData = [];
let clientManagerDirectory = {};
let allEmployees = [];
let departments = [];
let nomenclatureCategories = {};
let focusTasks = [];
let clientLinks = {};

/**
 * Функция валидации и отладки данных
 */
function validateAndDebugData() {
    console.log('=== ВАЛІДАЦІЯ ДАНИХ ===');
    console.log('Записи продаж:', masterData.length);
    console.log('Співробітники:', allEmployees.length);
    console.log('Відділи:', departments.length);
    console.log('Довідник менеджерів клієнтів:', Object.keys(clientManagerDirectory).length);
    console.log('Категорії номенклатури:', Object.keys(nomenclatureCategories).length);
    console.log('Фокусні задачі:', focusTasks.length);
    
    // Анализ структуры данных продаж
    if (masterData.length > 0) {
        console.log('Приклад записи продаж:', masterData[0]);
        console.log('Поля в записах продаж:', Object.keys(masterData[0]));
        
        // Анализ дат продаж
        const julyDate = new Date('2025-07-01');
        const beforeJuly = masterData.filter(sale => {
            const saleDate = new Date(sale['Дата']);
            return saleDate < julyDate;
        }).length;
        const fromJuly = masterData.filter(sale => {
            const saleDate = new Date(sale['Дата']);
            return saleDate >= julyDate;
        }).length;
        
        console.log('Розподіл продаж по датах:');
        console.log('  - До липня 2025:', beforeJuly);
        console.log('  - З липня 2025:', fromJuly);
        
        // Показываем диапазон дат
        const dates = masterData.map(sale => new Date(sale['Дата'])).filter(date => !isNaN(date));
        if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            console.log('Діапазон дат продаж:', minDate.toLocaleDateString('uk-UA'), '-', maxDate.toLocaleDateString('uk-UA'));
        }
    }
    
    // Анализ справочника менеджеров
    if (Object.keys(clientManagerDirectory).length > 0) {
        const firstEntry = Object.entries(clientManagerDirectory)[0];
        console.log('Приклад запису довідника:', firstEntry);
    }
    
    // Анализ сотрудников
    if (allEmployees.length > 0) {
        console.log('Приклад співробітника:', allEmployees[0]);
        console.log('Співробітники з відділами:', allEmployees.filter(emp => emp.department).length);
    }
    
    // Анализ фокусных задач
    if (focusTasks.length > 0) {
        console.log('Приклад фокусної задачі:', focusTasks[0]);
        console.log('Завершені фокусні задачі:', focusTasks.filter(task => 
            task.status === 'completed' || task.status === 'завершено'
        ).length);
    }
    
    console.log('=== КІНЕЦЬ ВАЛІДАЦІЇ ===');
}

/**
 * Главная функция инициализации дашборда по отделам
 * @param {HTMLElement} container - DOM-элемент для вставки дашборда
 */
export async function initDepartmentDashboard(container) {
    container.innerHTML = `
        <div class="bg-gray-900 text-gray-200 font-sans p-4 md:p-8">
            <header class="mb-8">
                <h1 class="text-4xl font-bold text-white">Дашборд по відділах</h1>
                <p class="text-lg text-gray-400">Ключові показники ефективності менеджерів</p>
                <p id="period-info" class="text-sm text-gray-500 mt-2"></p>
            </header>
            <div id="department-dashboard-filters" class="mb-6 bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-4 flex flex-wrap gap-4"></div>
            <main id="department-dashboard-content">
                <div class="text-center p-6">
                    <div class="loader mx-auto"></div>
                    <p class="text-lg mt-4 font-medium">Завантаження даних для звіту...</p>
                </div>
            </main>
        </div>
    `;
    try {
        await loadDataForReport();
        renderDepartmentFilter(container.querySelector('#department-dashboard-filters'));
        
        // Используем текущий месяц по умолчанию
        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        await renderReport(container.querySelector('#department-dashboard-content'), '', currentPeriod);
    } catch (error) {
        console.error("Помилка при побудові дашборда по відділах:", error);
        container.querySelector('#department-dashboard-content').innerHTML = 
            `<p class="text-red-400 text-center">Не вдалося завантажити дані для звіту. Деталі в консолі.</p>`;
    }
}

/**
 * Загрузка всех необходимых данных для отчета
 */
async function loadDataForReport() {
    const companyId = window.state?.currentCompanyId;
    if (!companyId) throw new Error("ID компанії не знайдено.");

    console.log('Завантаження даних для звіту...');

    try {
        // Загружаем данные продаж из двух источников:
        // 1. API - данные с июля 2025
        // 2. Файл data.json - данные до июля 2025
        const [apiDataRes, refRes] = await Promise.all([
            fetch('https://fastapi.lookfort.com/nomenclature.analysis'), // Данные с июля 2025
            fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url') // Справочник клиентов
        ]);

        // Проверяем статус ответов
        if (!apiDataRes.ok) {
            throw new Error(`Помилка завантаження даних продаж з API: ${apiDataRes.status}`);
        }
        if (!refRes.ok) {
            throw new Error(`Помилка завантаження довідника клієнтів: ${refRes.status}`);
        }

        const apiData = await apiDataRes.json(); // Данные с июля 2025
        const refData = await refRes.json();

        // Статические данные до июля 2025 из файла data.json
        let staticDataBeforeJuly = [];
        try {
            const staticDataRes = await fetch('модуль помічник продажу/data.json');
            if (staticDataRes.ok) {
                const allStaticData = await staticDataRes.json();
                
                // Фильтруем данные до июля 2025
                const julyDate = new Date('2025-07-01');
                staticDataBeforeJuly = allStaticData.filter(sale => {
                    const saleDate = new Date(sale['Дата']);
                    return saleDate < julyDate;
                });
                
                console.log('Завантажено записів продаж до липня 2025:', staticDataBeforeJuly.length);
            }
        } catch (error) {
            console.warn('Не вдалося завантажити статичні дані:', error);
            staticDataBeforeJuly = [];
        }

        // Данные с июля 2025 из API (фильтруем чтобы убедиться)
        const julyDate = new Date('2025-07-01');
        const dataFromJuly = apiData.filter(sale => {
            const saleDate = new Date(sale['Дата']);
            return saleDate >= julyDate;
        });
        
        console.log('Завантажено записів продаж з липня 2025 (API):', dataFromJuly.length);
        
        // Объединяем данные: до июля из файла + с июля из API
        masterData = staticDataBeforeJuly.concat(dataFromJuly);
        console.log('Загальна кількість записів продаж:', masterData.length);
        console.log('  - До липня 2025 (файл):', staticDataBeforeJuly.length);
        console.log('  - З липня 2025 (API):', dataFromJuly.length);

        // Создаем справочник ссылок на клиентов
        clientLinks = {};
        if (Array.isArray(refData)) {
            refData.forEach(item => {
                if (item['Клиент.Код'] && item['посилання']) {
                    clientLinks[item['Клиент.Код']] = item['посилання'];
                }
            });
        }
        console.log('Завантажено посилань на клієнтів:', Object.keys(clientLinks).length);

        // Параллельная загрузка остальных данных
        const [
            employeesSnap, 
            departmentsSnap, 
            nomenclatureRes, 
            focusTasksSnap
        ] = await Promise.all([
            firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/employees`)),
            firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/departments`)),
            fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category'),
            firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/focusTasks`))
        ]);

        // Обработка данных сотрудников и отделов
        allEmployees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        departments = departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Завантажено співробітників:', allEmployees.length);
        console.log('Завантажено відділів:', departments.length);

        // Обработка номенклатуры
        if (nomenclatureRes.ok) {
            const nomenclatureData = await nomenclatureRes.json();
            nomenclatureCategories = {};
            if (Array.isArray(nomenclatureData)) {
                nomenclatureData.forEach(item => {
                    if (item['Номенклатура'] && item['Категория 2']) {
                        nomenclatureCategories[item['Номенклатура']] = item['Категория 2'];
                    }
                });
            }
            console.log('Завантажено категорій номенклатури:', Object.keys(nomenclatureCategories).length);
        }

        // Обработка фокусных задач
        focusTasks = focusTasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Завантажено фокусних задач:', focusTasks.length);

        // Загружаем справочник менеджеров клиентов
        clientManagerDirectory = await loadClientManagerDirectory();
        console.log('Завантажено довідник менеджерів клієнтів:', Object.keys(clientManagerDirectory).length);

        // Валидация данных
        validateAndDebugData();

    } catch (error) {
        console.error('Помилка завантаження даних:', error);
        throw error;
    }
}

/**
 * Рендеринг фильтра по отделам и периоду
 * @param {HTMLElement} filterContainer - DOM-элемент для вставки фильтра
 */
function renderDepartmentFilter(filterContainer) {
    // Генерируем список месяцев для выбора (последние 12 месяцев)
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
        months.push({ value: monthYear, name: monthName });
    }

    // Текущий месяц по умолчанию
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let filterHtml = `
        <div>
            <label for="dept-dash-filter" class="block text-sm font-medium mb-1 text-gray-200">Фільтр по відділу:</label>
            <select id="dept-dash-filter" class="dark-input bg-gray-700 text-gray-200 border-gray-600">
                <option value="">Всі відділи</option>
                ${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
        </div>
        <div>
            <label for="period-filter" class="block text-sm font-medium mb-1 text-gray-200">Період аналізу:</label>
            <select id="period-filter" class="dark-input bg-gray-700 text-gray-200 border-gray-600">
                ${months.map(m => `<option value="${m.value}" ${m.value === currentMonth ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
        </div>
    `;
    filterContainer.innerHTML = filterHtml;

    const deptFilterSelect = filterContainer.querySelector('#dept-dash-filter');
    const periodFilterSelect = filterContainer.querySelector('#period-filter');
    
    const updateReport = () => {
        const selectedDeptId = deptFilterSelect.value;
        const selectedPeriod = periodFilterSelect.value;
        const contentContainer = document.getElementById('department-dashboard-content');
        renderReport(contentContainer, selectedDeptId, selectedPeriod);
    };

    deptFilterSelect.addEventListener('change', updateReport);
    periodFilterSelect.addEventListener('change', updateReport);
}

/**
 * Рендеринг всего отчета
 * @param {HTMLElement} contentContainer - DOM-элемент для вставки контента
 * @param {string} selectedDeptId - ID выбранного для фильтрации отдела
 * @param {string} selectedPeriod - Выбранный период в формате YYYY-MM
 */
async function renderReport(contentContainer, selectedDeptId = '', selectedPeriod = '') {
    // Если период не указан, используем текущий месяц
    if (!selectedPeriod) {
        const now = new Date();
        selectedPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    // Обновляем информацию о периоде в заголовке
    const periodInfo = document.getElementById('period-info');
    if (periodInfo) {
        const [year, month] = selectedPeriod.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
        periodInfo.textContent = `Період аналізу: ${monthName}`;
    }
    
    contentContainer.innerHTML = ''; 

    // 1. Группируем менеджеров по отделам
    const managersByDept = {};
    allEmployees.forEach(emp => {
        if (!emp.department) return;
        const deptId = emp.department;
        if (!managersByDept[deptId]) {
            const deptInfo = departments.find(d => d.id === deptId);
            managersByDept[deptId] = {
                name: deptInfo ? deptInfo.name : 'Без відділу',
                managersData: []
            };
        }
        managersByDept[deptId].managersData.push(emp);
    });

    // 2. Предварительный расчет для показателя "% покрытия групп"
    const sphereToGroupsMap = new Map();
    const clientToGroupsMap = new Map();
    const clientToSphereMap = new Map();

    masterData.forEach(sale => {
        const sphere = sale['Сфера деятельности'] || sale['Сфера діяльності'] || sale['Сфера'] || 'Інше';
        const product = sale['Номенклатура'];
        const clientCode = sale['Клиент.Код'] || sale['Клієнт.Код'];
        const group = nomenclatureCategories[product];

        if (group && product) {
            if (!sphereToGroupsMap.has(sphere)) {
                sphereToGroupsMap.set(sphere, new Set());
            }
            sphereToGroupsMap.get(sphere).add(group);

            if (clientCode) {
                if (!clientToGroupsMap.has(clientCode)) {
                    clientToGroupsMap.set(clientCode, new Set());
                }
                clientToGroupsMap.get(clientCode).add(group);
            }
        }
        
        if (clientCode && sphere && !clientToSphereMap.has(clientCode)) {
             clientToSphereMap.set(clientCode, sphere);
        }
    });

    console.log('Картографування сфер на групи:', sphereToGroupsMap.size);
    console.log('Картографування клієнтів на групи:', clientToGroupsMap.size);
    console.log('Картографування клієнтів на сфери:', clientToSphereMap.size);

    const calculationMaps = { sphereToGroupsMap, clientToGroupsMap, clientToSphereMap };

    // 3. Рассчитываем KPI для каждого менеджера
    for (const deptId in managersByDept) {
        for (const manager of managersByDept[deptId].managersData) {
            manager.kpi = calculateManagerKpi(manager, calculationMaps, selectedPeriod);
        }
    }
    
    // 4. Фильтруем и рендерим секции отделов
    let departmentsToRender = Object.entries(managersByDept);
    if (selectedDeptId) {
        departmentsToRender = departmentsToRender.filter(([deptId, _]) => deptId === selectedDeptId);
    }

    console.log('Відділи для відображення:', departmentsToRender.length);
    
    if (departmentsToRender.length === 0) {
        contentContainer.innerHTML = `<p class="text-gray-400 text-center">Немає даних для відображення по обраному відділу.</p>`;
        return;
    }

    // Добавляем общую статистику перед отделами
    const totalStats = departmentsToRender.reduce((acc, [_, deptData]) => {
        deptData.managersData.forEach(mgr => {
            acc.totalManagers++;
            acc.totalClients += mgr.kpi.totalClients;
            acc.totalRevenue += mgr.kpi.totalRevenue;
            acc.totalFocusAmount += mgr.kpi.focusTaskAmount;
        });
        return acc;
    }, { totalManagers: 0, totalClients: 0, totalRevenue: 0, totalFocusAmount: 0 });

    console.log('Загальна статистика:', totalStats);

    departmentsToRender
      .sort(([,a],[,b]) => a.name.localeCompare(b.name))
      .forEach(([_, deptData]) => {
        const departmentSection = renderDepartmentSection(deptData);
        contentContainer.appendChild(departmentSection);
    });
}

/**
 * Расчет KPI для одного менеджера
 * @param {object} manager - Объект менеджера
 * @param {object} calculationMaps - Карты для расчетов
 * @param {string} selectedPeriod - Период в формате YYYY-MM
 * @returns {object} - Объект с рассчитанными KPI
 */
function calculateManagerKpi(manager, calculationMaps, selectedPeriod) {
    const { sphereToGroupsMap, clientToGroupsMap, clientToSphereMap } = calculationMaps;
    
    // 1. Общее кол-во клиентов менеджера из справочника
    const managerClients = Object.entries(clientManagerDirectory)
        .filter(([_, info]) => {
            // Проверяем различные варианты указания менеджера
            if (info.manager && manager.name) {
                return info.manager.trim().toLowerCase() === manager.name.trim().toLowerCase();
            }
            return false;
        })
        .map(([code, _]) => code);
    
    const totalClients = managerClients.length;
    console.log(`Менеджер ${manager.name}: знайдено ${totalClients} клієнтів`);

    // 2. Продажи по клиентам менеджера за выбранный период
    const salesForManager = masterData.filter(sale => {
        const clientCode = sale['Клиент.Код'] || sale['Клієнт.Код'];
        if (!managerClients.includes(clientCode)) return false;
        
        // Фильтрация по периоду (все кроме количества клиентов)
        const saleDate = new Date(sale['Дата']);
        const [year, month] = selectedPeriod.split('-').map(Number);
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0); // Последний день месяца
        
        return saleDate >= periodStart && saleDate <= periodEnd;
    });

    console.log(`Менеджер ${manager.name}: знайдено ${salesForManager.length} записів продаж за ${selectedPeriod}`);

    // 3. Отгруженные клиенты, выручка и группировка чеков
    const shippedClientsSet = new Set();
    const checksMap = new Map(); // Ключ: "клиент_код+дата", значение: сумма чека
    let totalRevenue = 0;
    
    salesForManager.forEach(sale => {
        const clientCode = sale['Клиент.Код'] || sale['Клієнт.Код'];
        const saleDate = sale['Дата'];
        
        if (clientCode) {
            shippedClientsSet.add(clientCode);
        }
        
        // Парсим выручку (может быть строкой с пробелами и запятыми)
        let revenue = sale['Выручка'] || sale['Виручка'] || 0;
        if (typeof revenue === 'string') {
            revenue = parseFloat(revenue.replace(/\s/g, '').replace(',', '.')) || 0;
        }
        totalRevenue += revenue;
        
        // Группируем по чекам (клиент + дата)
        if (clientCode && saleDate) {
            const checkKey = `${clientCode}_${saleDate}`;
            if (!checksMap.has(checkKey)) {
                checksMap.set(checkKey, 0);
            }
            checksMap.set(checkKey, checksMap.get(checkKey) + revenue);
        }
    });

    const shippedClients = shippedClientsSet.size;
    const totalChecks = checksMap.size; // Количество уникальных чеков
    const shipmentPercentage = totalClients > 0 ? (shippedClients / totalClients) * 100 : 0;
    const avgCheck = totalChecks > 0 ? totalRevenue / totalChecks : 0; // Правильный расчет среднего чека
    const ltv = totalClients > 0 ? totalRevenue / totalClients : 0;

    // 4. Фокусные задачи за выбранный период
    const [year, month] = selectedPeriod.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    const managerFocusTasks = focusTasks.filter(task => {
        if (task.managerId !== manager.id) return false;
        if (task.status !== 'completed' && task.status !== 'завершено') return false;
        
        // Фильтрация по периоду
        const taskDate = new Date(task.completedDate || task.dateCompleted || task.date);
        return taskDate >= periodStart && taskDate <= periodEnd;
    });
    
    const focusTaskAmount = managerFocusTasks.reduce((sum, task) => {
        const taskSum = parseFloat(task.sum || task.amount || 0);
        return sum + (isNaN(taskSum) ? 0 : taskSum);
    }, 0);
    
    const focusClientsSet = new Set();
    managerFocusTasks.forEach(task => {
        if (task.clientId || task.clientCode) {
            focusClientsSet.add(task.clientId || task.clientCode);
        }
    });
    
    const focusClients = focusClientsSet.size;
    const focusBasePercentage = totalClients > 0 ? (focusClients / totalClients) * 100 : 0;
    
    // 5. Покрытие групп товаров
    let totalCoverageSum = 0;
    let clientsWithSphere = 0;
    
    managerClients.forEach(clientCode => {
        const sphere = clientToSphereMap.get(clientCode);
        if (sphere && sphereToGroupsMap.has(sphere)) {
            clientsWithSphere++;
            const sphereGroups = sphereToGroupsMap.get(sphere);
            const clientGroups = clientToGroupsMap.get(clientCode);

            if (sphereGroups && sphereGroups.size > 0 && clientGroups && clientGroups.size > 0) {
                const coverage = (clientGroups.size / sphereGroups.size) * 100;
                totalCoverageSum += coverage;
            }
        }
    });
    
    const productCoverage = clientsWithSphere > 0 ? totalCoverageSum / clientsWithSphere : 0;

    const result = {
        totalClients,
        shippedClients,
        shipmentPercentage,
        avgCheck,
        ltv,
        productCoverage,
        focusTaskAmount,
        focusClients,
        focusBasePercentage,
        totalRevenue,
        totalChecks // Добавляем для отладки
    };

    console.log(`KPI для ${manager.name}:`, {
        ...result,
        debug: {
            totalChecks,
            salesRecords: salesForManager.length,
            avgCheckCalculation: `${totalRevenue.toFixed(2)} / ${totalChecks} = ${avgCheck.toFixed(2)}`
        }
    });
    return result;
}


/**
 * Создает и возвращает HTML-элемент для секции отдела
 * @param {object} departmentData - Данные по отделу и менеджерам
 * @returns {HTMLElement}
 */
function renderDepartmentSection(departmentData) {
    const section = document.createElement('div');
    // --- Accordion state ---
    const accordionId = 'accordion-' + Math.random().toString(36).slice(2);
    let expanded = false;

    // Розрахунок сводних показників по відділу
    const summary = departmentData.managersData.reduce((acc, mgr) => {
        acc.totalClients += mgr.kpi.totalClients;
        acc.shippedClients += mgr.kpi.shippedClients;
        acc.totalRevenue += mgr.kpi.totalRevenue;
        acc.focusTaskAmount += mgr.kpi.focusTaskAmount;
        acc.totalChecks += mgr.kpi.totalChecks || 0; // Добавляем количество чеков
        return acc;
    }, { totalClients: 0, shippedClients: 0, totalRevenue: 0, focusTaskAmount: 0, totalChecks: 0 });

    const deptShipmentPercentage = summary.totalClients > 0 ? (summary.shippedClients / summary.totalClients) * 100 : 0;
    const deptAvgCheck = summary.totalChecks > 0 ? summary.totalRevenue / summary.totalChecks : 0; // Правильный расчет для отдела

    // --- HTML-структура ---
    section.innerHTML = `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm w-full mb-8">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">${departmentData.name}</h3>
          <button id="${accordionId}-toggle" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm">Показати/Сховати менеджерів</button>
        </div>
        <div class="p-6">
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
            ${createStatCardHTML('Всього клієнтів', summary.totalClients, 'users', 'blue')}
            ${createStatCardHTML('% відгрузки', `${deptShipmentPercentage.toFixed(2)}%`, 'percent', 'green')}
            ${createStatCardHTML('Середній чек', `${deptAvgCheck.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} грн`, 'shopping-cart', 'yellow')}
            ${createStatCardHTML('Сума продаж', `${summary.totalRevenue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} грн`, 'dollar-sign', 'indigo')}
            ${createStatCardHTML('Сума фокусної задачі', `${summary.focusTaskAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} грн`, 'target', 'red')}
          </div>
          <div class="w-full overflow-auto">
            <table class="w-full caption-bottom text-sm">
              <thead class="[&_tr]:border-b [&_tr]:border-gray-200 dark:[&_tr]:border-gray-700">
                <tr class="border-b border-gray-200 dark:border-gray-700 transition-colors bg-gray-50 dark:bg-gray-900/50">
                  <th class="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">Менеджер</th>
                  <th class="h-12 px-4 text-center align-middle font-medium text-gray-500 dark:text-gray-400">Клієнти (Всього/Відгр.)</th>
                  <th class="h-12 px-4 text-center align-middle font-medium text-gray-500 dark:text-gray-400">% Відгрузки</th>
                  <th class="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Сер. чек</th>
                  <th class="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">LTV</th>
                  <th class="h-12 px-4 text-center align-middle font-medium text-gray-500 dark:text-gray-400">% Покриття груп</th>
                  <th class="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Сума продаж</th>
                  <th class="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Сума фокусу</th>
                  <th class="h-12 px-4 text-center align-middle font-medium text-gray-500 dark:text-gray-400">К-сть клієнтів фокусу</th>
                  <th class="h-12 px-4 text-center align-middle font-medium text-gray-500 dark:text-gray-400">% фокусу від бази</th>
                </tr>
              </thead>
              <tbody id="${accordionId}-tbody" class="[&_tr:last-child]:border-0">
                ${departmentData.managersData.map(manager => createManagerRowHTML(manager)).join('')}
              </tbody>
              <tfoot>
                <tr class="font-bold bg-gray-100 dark:bg-gray-900/70">
                  <td class="p-4 align-middle">Підсумок</td>
                  <td class="p-4 align-middle text-center">${summary.totalClients} / ${summary.shippedClients}</td>
                  <td class="p-4 align-middle text-center">${deptShipmentPercentage.toFixed(2)}%</td>
                  <td class="p-4 align-middle text-right">${deptAvgCheck.toFixed(2)} грн</td>
                  <td class="p-4 align-middle text-right">—</td>
                  <td class="p-4 align-middle text-center">—</td>
                  <td class="p-4 align-middle text-right">${summary.totalRevenue.toFixed(2)} грн</td>
                  <td class="p-4 align-middle text-right">${summary.focusTaskAmount.toFixed(2)} грн</td>
                  <td class="p-4 align-middle text-center">—</td>
                  <td class="p-4 align-middle text-center">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
    // Accordion logic
    const toggleBtn = section.querySelector(`#${accordionId}-toggle`);
    const tbody = section.querySelector(`#${accordionId}-tbody`);
    if (toggleBtn && tbody) {
        expanded = true;
        toggleBtn.onclick = () => {
            expanded = !expanded;
            tbody.style.display = expanded ? '' : 'none';
        };
        // По умолчанию раскрыто
        tbody.style.display = '';
    }
    return section;
}

/**
 * Генерирует HTML для строки таблицы с данными менеджера
 * @param {object} manager - Объект менеджера с KPI
 * @returns {string} HTML-строка
 */
function createManagerRowHTML(manager) {
    const kpi = manager.kpi;
    const formatCurrency = (val) => {
        if (val === 0) return '0.00 грн';
        return `${val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} грн`;
    };
    const formatPercentage = (val) => {
        if (val === 0) return '0.00%';
        return `${val.toFixed(2)}%`;
    };

    // Определяем цвет прогресс-бара в зависимости от процента отгрузки
    const progressColor = kpi.shipmentPercentage >= 80 ? 'bg-green-600' : 
                         kpi.shipmentPercentage >= 50 ? 'bg-yellow-600' : 'bg-red-600';

    return `
        <tr class="border-b border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100/50 dark:hover:bg-gray-800/50">
            <td class="p-4 align-middle font-medium text-black">${manager.name || 'Без імені'}</td>
            <td class="p-4 align-middle text-center text-black">${kpi.totalClients} / ${kpi.shippedClients}</td>
            <td class="p-4 align-middle text-center">
                <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div class="${progressColor} h-2.5 rounded-full" style="width: ${Math.min(kpi.shipmentPercentage, 100)}%"></div>
                </div>
                <span class="text-xs text-black">${formatPercentage(kpi.shipmentPercentage)}</span>
            </td>
            <td class="p-4 align-middle text-right text-black">${formatCurrency(kpi.avgCheck)}</td>
            <td class="p-4 align-middle text-right text-black">${formatCurrency(kpi.ltv)}</td>
            <td class="p-4 align-middle text-center text-black">${formatPercentage(kpi.productCoverage)}</td>
            <td class="p-4 align-middle text-right text-black">${formatCurrency(kpi.totalRevenue)}</td>
            <td class="p-4 align-middle text-right font-semibold text-black">${formatCurrency(kpi.focusTaskAmount)}</td>
            <td class="p-4 align-middle text-center text-black">${kpi.focusClients}</td>
            <td class="p-4 align-middle text-center text-black">${formatPercentage(kpi.focusBasePercentage)}</td>
        </tr>
    `;
}

/**
 * Генерирует HTML для информационной карточки
 * @param {string} title - Заголовок
 * @param {string|number} value - Значение
 * @param {string} iconName - Название иконки (lucide)
 * @param {string} color - Цвет иконки
 * @returns {string} HTML-строка
 */
function createStatCardHTML(title, value, iconName, color) {
    const icons = {
        'users': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-${color}-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        'percent': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-${color}-500"><line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
        'shopping-cart': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-${color}-500"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
        'target': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-${color}-500"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        'dollar-sign': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-${color}-500"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`
    };

    return `
        <div class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-sm flex flex-col justify-between">
            <div class="p-6 pb-2 flex flex-row items-center justify-between space-y-0 border-none">
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">${title}</h3>
                ${icons[iconName] || ''}
            </div>
            <div class="p-6 pt-0">
                <div class="text-2xl font-bold text-gray-900 dark:text-white">${value}</div>
            </div>
        </div>
    `;
} 