// salesAssistant.js
// Полная интеграция двух вкладок: Помічник и Сигналізація

import * as firebase from './firebase.js';
import { initDashboardPage } from './dashboard.js';
import { initFocusPage } from './focus.js';
import { loadClientManagerDirectory } from './main.js';
import { initDepartmentDashboard } from './departmentDashboard.js';
import { initSmartDayModule } from './smartDay.js';
import { initDebtsModule } from './debts.js';
import { initPlanFactModule } from './planFact.js';

export function initSalesAssistantPage(container) {
    container.innerHTML = `
        <div class="flex gap-2 mb-4 flex-wrap">
            <button id="assistantTabBtn" class="btn btn-primary">Помічник</button>
            <button id="signalizationTabBtn" class="btn btn-secondary">Сигналізація</button>
            <button id="dashboardTabBtn" class="btn btn-secondary">Головний дашборд</button>
            <button id="departmentDashboardTabBtn" class="btn btn-secondary">Дашборд по відділах</button>
            <button id="focusTabBtn" class="btn btn-secondary">Фокус</button>
            <button id="smartDayTabBtn" class="btn btn-secondary">Створи мій день</button>
            <button id="debtsTabBtn" class="btn btn-secondary">Дебіторка</button>
            <button id="planFactTabBtn" class="btn btn-secondary">План-Факт</button>
        </div>
        <div id="salesAssistantMain"></div>
        <div id="alerts-root" class="hidden"></div>
        <div id="dashboard-root" class="hidden"></div>
        <div id="department-dashboard-root" class="hidden"></div>
        <div id="focus-root" class="hidden"></div>
        <div id="smartday-root" class="hidden"></div>
        <div id="debts-root" class="hidden"></div>
        <div id="planfact-root" class="hidden"></div>
    `;

    const assistantTabBtn = container.querySelector('#assistantTabBtn');
    const signalizationTabBtn = container.querySelector('#signalizationTabBtn');
    const dashboardTabBtn = container.querySelector('#dashboardTabBtn');
    const departmentDashboardTabBtn = container.querySelector('#departmentDashboardTabBtn');
    const focusTabBtn = container.querySelector('#focusTabBtn');
    const smartDayTabBtn = container.querySelector('#smartDayTabBtn');
    const debtsTabBtn = container.querySelector('#debtsTabBtn');
    const planFactTabBtn = container.querySelector('#planFactTabBtn');
    
    const mainBlock = container.querySelector('#salesAssistantMain');
    const alertsRoot = container.querySelector('#alerts-root');
    const dashboardRoot = container.querySelector('#dashboard-root');
    const departmentDashboardRoot = container.querySelector('#department-dashboard-root');
    const focusRoot = container.querySelector('#focus-root');
    const smartDayRoot = container.querySelector('#smartday-root');
    const debtsRoot = container.querySelector('#debts-root');
    const planFactRoot = container.querySelector('#planfact-root');
    
    let alertsInited = false;
    let dashboardInited = false;
    let departmentDashboardInited = false;
    let focusInited = false;
    let smartDayInited = false;
    let debtsInited = false;
    let planFactInited = false;

    function setActiveTab(activeBtn) {
        const allBtns = [assistantTabBtn, signalizationTabBtn, dashboardTabBtn, departmentDashboardTabBtn, focusTabBtn, smartDayTabBtn, debtsTabBtn, planFactTabBtn];
        allBtns.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });
        activeBtn.classList.add('btn-primary');
        activeBtn.classList.remove('btn-secondary');

        mainBlock.classList.add('hidden');
        alertsRoot.classList.add('hidden');
        dashboardRoot.classList.add('hidden');
        departmentDashboardRoot.classList.add('hidden');
        focusRoot.classList.add('hidden');
        smartDayRoot.classList.add('hidden');
        debtsRoot.classList.add('hidden');
        planFactRoot.classList.add('hidden');
    }

    function showAssistantTab() {
        setActiveTab(assistantTabBtn);
        mainBlock.classList.remove('hidden');
        renderSalesAssistantMain(mainBlock);
    }
    function showSignalizationTab() {
        setActiveTab(signalizationTabBtn);
        alertsRoot.classList.remove('hidden');
        if (!alertsInited && window.initAlertsModule) {
            window.initAlertsModule(alertsRoot);
            alertsInited = true;
        }
    }
    function showDashboardTab() {
        setActiveTab(dashboardTabBtn);
        dashboardRoot.classList.remove('hidden');
        if (!dashboardInited) {
            initDashboardPage(dashboardRoot);
            dashboardInited = true;
        }
    }
    function showDepartmentDashboardTab() {
        setActiveTab(departmentDashboardTabBtn);
        departmentDashboardRoot.classList.remove('hidden');
        if (!departmentDashboardInited) {
            initDepartmentDashboard(departmentDashboardRoot);
            departmentDashboardInited = true;
        }
    }
    function showFocusTab() {
        setActiveTab(focusTabBtn);
        focusRoot.classList.remove('hidden');
        if (!focusInited) {
            initFocusPage(focusRoot);
            focusInited = true;
        }
    }
    function showSmartDayTab() {
        setActiveTab(smartDayTabBtn);
        smartDayRoot.classList.remove('hidden');
        if (!smartDayInited && window.initSmartDayModule) {
            initSmartDayModule(smartDayRoot);
            smartDayInited = true;
        }
    }
    function showDebtsTab() {
        setActiveTab(debtsTabBtn);
        debtsRoot.classList.remove('hidden');
        if (!debtsInited) {
            initDebtsModule(debtsRoot);
            debtsInited = true;
        }
    }
    function showPlanFactTab() {
        setActiveTab(planFactTabBtn);
        planFactRoot.classList.remove('hidden');
        if (!planFactInited) {
            initPlanFactModule(planFactRoot);
            planFactInited = true;
        }
    }

    assistantTabBtn.onclick = showAssistantTab;
    signalizationTabBtn.onclick = showSignalizationTab;
    dashboardTabBtn.onclick = showDashboardTab;
    departmentDashboardTabBtn.onclick = showDepartmentDashboardTab;
    focusTabBtn.onclick = showFocusTab;
    smartDayTabBtn.onclick = showSmartDayTab;
    debtsTabBtn.onclick = showDebtsTab;
    planFactTabBtn.onclick = showPlanFactTab;
    showAssistantTab(); // По умолчанию
}

// --- Додаю функцію для завантаження співробітників ---
async function loadEmployees(companyId) {
    const employeesRef = firebase.collection(firebase.db, 'companies', companyId, 'employees');
    const snapshot = await firebase.getDocs(employeesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(emp => emp.active !== false);
}

function renderSalesAssistantMain(mainBlock) {
    mainBlock.innerHTML = `
        <div class="max-w-7xl mx-auto min-h-screen pb-10">
            <header class="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-3xl md:text-4xl font-bold">Помічник продажу</h1>
                    <p class="mt-2">Аналіз та рекомендації по продажах.</p>
                </div>
            </header>
            <div id="status-container" class="text-center p-6">
                <div id="loader" class="loader mx-auto"></div>
                <p id="status-message" class="text-lg mt-4 font-medium">Завантаження даних...</p>
            </div>
            <div id="analysis-section" class="p-6 mb-8 hidden">
                <h2 class="text-xl font-bold mb-4">Оберіть відділ, менеджера та клієнта для аналізу</h2>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label for="department-filter" class="block text-sm font-medium mb-1">Відділ</label>
                        <select id="department-filter" class="dark-input"></select>
                    </div>
                    <div>
                        <label for="manager-filter" class="block text-sm font-medium mb-1">Менеджер</label>
                        <select id="manager-filter" class="dark-input"></select>
                    </div>
                    <div>
                        <label for="client-search" class="block text-sm font-medium mb-1">Пошук клієнта</label>
                        <input type="text" id="client-search" class="dark-input" placeholder="Почніть вводити ім'я..." disabled>
                    </div>
                    <div>
                        <label for="client-filter" class="block text-sm font-medium mb-1">Клієнт</label>
                        <select id="client-filter" class="dark-input" disabled></select>
                    </div>
                </div>
            </div>
            <div id="results-section" class="hidden">
                <div id="client-kpi" class="mb-8"></div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h3 class="text-lg font-bold mb-4">💡 Рекомендації по сфері (<span id="client-sphere-name"></span>)</h3>
                        <ul id="segment-recs" class="list-disc list-inside space-y-2"></ul>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold mb-4">🚀 Хіти продаж в цій сфері для Вас</h3>
                        <ul id="top-sales-recs" class="list-disc list-inside space-y-2"></ul>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- Додаю нові змінні для співробітників ---
    let masterData = [];
    let clientLinks = {};
    let uniqueClientsByManager = {};
    let employees = [];
    let employeesById = {};
    let managers = [];
    let departments = [];
    let userAccess = {
        userId: null,
        employeeId: null,
        employee: null,
        role: null,
        departmentId: null,
        isAdmin: false
    };
    let allMembers = [];

    const statusContainer = mainBlock.querySelector('#status-container');
    const loader = mainBlock.querySelector('#loader');
    const statusMessage = mainBlock.querySelector('#status-message');
    const analysisSection = mainBlock.querySelector('#analysis-section');
    const departmentFilter = mainBlock.querySelector('#department-filter');
    const managerFilter = mainBlock.querySelector('#manager-filter');
    const clientSearch = mainBlock.querySelector('#client-search');
    const clientFilter = mainBlock.querySelector('#client-filter');
    const resultsSection = mainBlock.querySelector('#results-section');
    const segmentRecsList = mainBlock.querySelector('#segment-recs');
    const topSalesRecsList = mainBlock.querySelector('#top-sales-recs');
    const clientKpiContainer = mainBlock.querySelector('#client-kpi');
    const clientSphereName = mainBlock.querySelector('#client-sphere-name');

    async function loadAndProcessData() {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) throw new Error('Компанія не вибрана!');
            // --- Витягуємо userId з window.state або firebase.auth.currentUser.uid ---
            let userId = window.state?.currentUserId;
            if (!userId && firebase.auth && firebase.auth.currentUser) {
                userId = firebase.auth.currentUser.uid;
            }
            userAccess.userId = userId;
            // --- Завантажуємо members (користувачі) ---
            const membersRef = firebase.collection(firebase.db, 'companies', companyId, 'members');
            const membersSnap = await firebase.getDocs(membersRef);
            allMembers = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // --- Знаходимо поточного користувача у members ---
            const currentMember = allMembers.find(m => m.userId === userId || m.email === window.state?.currentUserEmail);
            if (currentMember && currentMember.employeeId) {
                userAccess.employeeId = currentMember.employeeId;
            }
            // --- Визначаємо роль користувача ---
            if (currentMember) {
                if (currentMember.role) {
                    userAccess.role = currentMember.role.toLowerCase();
                } else if (currentMember.roleId && window.state?.availableRoles) {
                    const roleObj = window.state.availableRoles.find(r => r.id === currentMember.roleId);
                    userAccess.role = (roleObj?.name || '').toLowerCase();
                } else {
                    userAccess.role = '';
                }
            }
            const [dataRes, dataJulyRes, refRes, employeesList] = await Promise.all([
                fetch('модуль помічник продажу/data.json'),
                fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
                fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url'),
                loadEmployees(companyId)
            ]);
            const data = await dataRes.json();
            const dataJuly = await dataJulyRes.json();
            masterData = data.concat(dataJuly);
            const refData = await refRes.json();
            clientLinks = Object.fromEntries(refData.map(item => [item['Клиент.Код'], item['посилання']]));
            employees = employeesList;
            employees.forEach(emp => {
                employeesById[emp.id] = emp;
            });
            managers = employees.filter(emp => !emp.role || emp.role.toLowerCase().includes('менедж'));
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
            departments = Object.entries(depMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
            // --- Визначаємо доступи користувача ---
            if (userAccess.employeeId && employeesById[userAccess.employeeId]) {
                userAccess.employee = employeesById[userAccess.employeeId];
                // Визначаємо isAdmin (можна розширити список ролей)
                userAccess.isAdmin = userAccess.role.includes('адмін') || userAccess.role.includes('owner') || userAccess.role.includes('власник');
                // --- Додаю визначення departmentId для менеджера ---
                if (!userAccess.departmentId && userAccess.employee && userAccess.employee.department) {
                    if (typeof userAccess.employee.department === 'object' && userAccess.employee.department.id) {
                        userAccess.departmentId = userAccess.employee.department.id;
                    } else if (typeof userAccess.employee.department === 'string') {
                        userAccess.departmentId = userAccess.employee.department;
                    }
                }
            }
            statusContainer.classList.add('hidden');
            // Проверяем, что мы не на странице debts и не в режиме debts
            const currentPage = document.querySelector('.page.active')?.id;
            const isDebtsContext = currentPage === 'debts-page' || 
                                 document.querySelector('#debts-filters-container') !== null ||
                                 window.location.hash.includes('debts');
            
            console.log('[salesAssistant] Проверка контекста:', { currentPage, isDebtsContext });
            
            if (!isDebtsContext) {
                populateDepartmentFilter();
                populateManagerFilter();
            } else {
                console.log('[salesAssistant] Пропускаем populateManagerFilter - обнаружен debts контекст');
            }
            analysisSection.classList.remove('hidden');

            // --- Додаю підтримку автоматичного вибору клієнта ---
            if (window.state && window.state.preselectClientCode) {
                const clientCode = window.state.preselectClientCode;
                const clientSales = masterData.filter(item => item['Клиент.Код'] == clientCode);
                if (clientSales.length) {
                    const managerName = clientSales[0]['Основной менеджер'];
                    const manager = managers.find(m => m.name === managerName);
                    if (manager) {
                        // Виставляємо фільтри
                        departmentFilter.value = manager.department?.id || manager.department || '';
                        departmentFilter.dispatchEvent(new Event('change'));
                        setTimeout(() => {
                            managerFilter.value = manager.id;
                            managerFilter.dispatchEvent(new Event('change'));
                            setTimeout(() => {
                                clientFilter.value = clientCode;
                                clientFilter.dispatchEvent(new Event('change'));
                            }, 200);
                        }, 200);
                    }
                }
                delete window.state.preselectClientCode;
            }
        } catch (error) {
            statusMessage.style.color = 'red';
            statusMessage.textContent = `Помилка: ${error.message}`;
            loader.classList.add('hidden');
        }
    }

    // --- НОВА функція для фільтра відділів ---
    function populateDepartmentFilter() {
        departmentFilter.innerHTML = '<option value="">Всі відділи</option>';
        let visibleDepartments = departments;
        // --- Контроль доступу: якщо менеджер або керівник, тільки свій відділ ---
        if (!userAccess.isAdmin && userAccess.departmentId) {
            if (userAccess.role && (userAccess.role.includes('менедж') || userAccess.role.includes('керівник'))) {
                visibleDepartments = departments.filter(dep => dep.id === userAccess.departmentId);
            }
        }
        visibleDepartments.forEach(dep => {
            const option = new Option(dep.name, dep.id);
            departmentFilter.add(option);
        });
        departmentFilter.disabled = false;
        // Якщо доступний лише один відділ — вибираємо його автоматично
        if (visibleDepartments.length === 1) {
            departmentFilter.value = visibleDepartments[0].id;
        }
    }

    // --- Оновлена функція для фільтра менеджерів ---
    function populateManagerFilter() {
        const selectedDepartmentId = departmentFilter.value;
        managerFilter.innerHTML = '<option value="">Оберіть менеджера...</option>';
        let filteredManagers = managers;
        // --- Додаю логування для діагностики ---
        console.log('[populateManagerFilter] userAccess:', userAccess);
        console.log('[populateManagerFilter] managers:', managers);
        // --- Контроль доступу: якщо менеджер — тільки він, якщо керівник — всі з відділу, якщо адмін — всі ---
        if (!userAccess.isAdmin && userAccess.employeeId) {
            if (userAccess.role && userAccess.role.includes('менедж')) {
                // Тільки сам користувач
                filteredManagers = managers.filter(emp => emp.id === userAccess.employeeId);
                console.log('[populateManagerFilter] Менеджер бачить тільки себе:', filteredManagers);
            } else if (userAccess.role && userAccess.role.includes('керівник')) {
                // Всі з його відділу
                filteredManagers = managers.filter(emp => {
                    if (!emp.department) return false;
                    if (typeof emp.department === 'object' && emp.department.id) {
                        return emp.department.id === userAccess.departmentId;
                    } else if (typeof emp.department === 'string') {
                        return emp.department === userAccess.departmentId;
                    }
                    return false;
                });
                console.log('[populateManagerFilter] Керівник бачить менеджерів відділу:', filteredManagers);
            } else {
                // fallback: всі
                console.log('[populateManagerFilter] Інша роль, всі менеджери');
            }
        } else if (selectedDepartmentId) {
            filteredManagers = managers.filter(emp => {
                if (!emp.department) return false;
                if (typeof emp.department === 'object' && emp.department.id) {
                    return emp.department.id === selectedDepartmentId;
                } else if (typeof emp.department === 'string') {
                    return emp.department === selectedDepartmentId;
                }
                return false;
            });
            console.log('[populateManagerFilter] Фільтр по відділу:', filteredManagers);
        }
        filteredManagers.forEach(emp => {
            const option = new Option(emp.name, emp.id);
            managerFilter.add(option);
        });
        managerFilter.disabled = false;
        clientSearch.disabled = true;
        clientFilter.disabled = true;
        clientFilter.innerHTML = '<option value="">Оберіть клієнта...</option>';
        // Якщо вибраний менеджер не входить у цей відділ — скидаємо вибір
        if (managerFilter.value && !filteredManagers.some(emp => emp.id === managerFilter.value)) {
            managerFilter.value = '';
        }
    }

    // --- Оновлена функція для фільтра клієнтів по співробітнику ---
    async function populateClientFilter(selectedManagerId, searchTerm = '') {
        const emp = employeesById[selectedManagerId];
        if (!emp) return;
        // --- Завантажуємо справочник ---
        const clientManagerDirectory = await loadClientManagerDirectory();
        // --- Фільтруємо клієнтів по справочнику та менеджеру ---
        const clients = Object.entries(clientManagerDirectory)
            .filter(([code, info]) => info.manager && emp.name && info.manager.trim() === emp.name.trim())
            .map(([code, info]) => ({
                name: masterData.find(item => item['Клиент.Код'] === code)?.['Клиент'] || code,
                code,
                sphere: masterData.find(item => item['Клиент.Код'] === code)?.['Сфера деятельности'] || '',
            }));
        uniqueClientsByManager[selectedManagerId] = Array.from(new Map(clients.map(c => [c.code, c])).values()).sort((a, b) => a.name.localeCompare(b.name));
        const filteredClients = uniqueClientsByManager[selectedManagerId].filter(client =>
            client.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        clientFilter.innerHTML = '<option value="">Оберіть клієнта...</option>';
        filteredClients.forEach(client => {
            const optionText = `${client.name} (${client.sphere || 'Сфера не вказана'})`;
            const option = new Option(optionText, client.code);
            clientFilter.add(option);
        });
        clientFilter.disabled = false;
        clientSearch.disabled = false;
    }

    // --- Додаю обробник для departmentFilter ---
    departmentFilter.onchange = () => {
        // Проверяем, что мы не на странице debts и не в режиме debts
        const currentPage = document.querySelector('.page.active')?.id;
        const isDebtsContext = currentPage === 'debts-page' || 
                             document.querySelector('#debts-filters-container') !== null ||
                             window.location.hash.includes('debts');
        
        console.log('[salesAssistant] departmentFilter.onchange проверка:', { currentPage, isDebtsContext });
        
        if (!isDebtsContext) {
            populateManagerFilter();
        } else {
            console.log('[salesAssistant] Пропускаем populateManagerFilter при смене отдела - debts контекст');
        }
        // Скидаємо вибір менеджера і клієнта
        managerFilter.value = '';
        clientFilter.value = '';
        clientSearch.value = '';
        clientSearch.disabled = true;
        clientFilter.disabled = true;
        resultsSection.classList.add('hidden');
    };

    function displayResults(segmentRecs, topSalesRecs, clientSales) {
        // --- KPI, прогноз, сегмент, динамика, все кнопки, модалки ---
        if (!clientKpiContainer || !segmentRecsList || !topSalesRecsList) return;
        const totalRevenue = clientSales.reduce((sum, s) => {
            const revenue = typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0);
            return sum + (revenue || 0);
        }, 0);
        const clientInfo = clientSales[0];
        const clientLink = clientLinks[clientInfo['Клиент.Код']];
        // Анализ по товарам
        const productStats = {};
        let allDates = [];
        clientSales.forEach(sale => {
            const product = sale['Номенклатура'];
            const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
            const date = new Date(sale['Дата']);
            allDates.push(date);
            if (!productStats[product]) productStats[product] = { sum: 0, count: 0, lastDate: date };
            productStats[product].sum += revenue;
            productStats[product].count += 1;
            if (date > productStats[product].lastDate) productStats[product].lastDate = date;
        });
        const productList = Object.entries(productStats)
            .map(([name, stat]) => ({ name, sum: stat.sum, count: stat.count, lastDate: stat.lastDate, share: stat.sum / totalRevenue }))
            .sort((a, b) => b.sum - a.sum);
        const avgCheck = clientSales.length > 0 ? totalRevenue / clientSales.length : 0;
        const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
        const monthAgo = new Date(maxDate); monthAgo.setMonth(monthAgo.getMonth() - 1);
        const stoppedProducts = productList.filter(p => p.lastDate < monthAgo);
        // Прогноз
        let forecastDate = '', forecastSum = avgCheck, avgIntervalDays = null;
        if (allDates.length > 1) {
            const uniqueDays = Array.from(new Set(allDates.map(d => d.toISOString().slice(0, 10)))).map(s => new Date(s)).sort((a, b) => a - b);
            if (uniqueDays.length > 1) {
                let sum = 0;
                for (let i = 1; i < uniqueDays.length; ++i) sum += (uniqueDays[i] - uniqueDays[i - 1]);
                avgIntervalDays = sum / (uniqueDays.length - 1) / (1000 * 60 * 60 * 24);
                const lastPurchase = uniqueDays[uniqueDays.length - 1];
                const nextDate = new Date(lastPurchase.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000);
                forecastDate = nextDate.toLocaleDateString('uk-UA');
            } else {
                const lastPurchase = uniqueDays[0];
                const nextDate = new Date(lastPurchase.getTime() + 30 * 24 * 60 * 60 * 1000);
                forecastDate = nextDate.toLocaleDateString('uk-UA');
                avgIntervalDays = 30;
            }
        } else if (allDates.length === 1) {
            const lastPurchase = allDates[0];
            const nextDate = new Date(lastPurchase.getTime() + 30 * 24 * 60 * 60 * 1000);
            forecastDate = nextDate.toLocaleDateString('uk-UA');
            avgIntervalDays = 30;
        }
        // Сегмент
        let segment = 'Новий';
        if (clientSales.length > 10 && totalRevenue > 100000) segment = 'VIP';
        else if (clientSales.length > 5 && totalRevenue > 30000) segment = 'Активний';
        else if (stoppedProducts.length > 0) segment = 'Знижується активність';
        if (stoppedProducts.length === productList.length && productList.length > 0) segment = 'Потенційно втрачається';
        // KPI-блок, прогноз, сегмент, кнопки
        const forecastDateObj = forecastDate ? new Date(forecastDate.split('.').reverse().join('-')) : null;
        const isForecastOverdue = forecastDateObj && forecastDateObj < new Date();
        // Календар динамики
        let calendarMap = {}, calendarSumMap = {};
        const daysByMonth = {};
        clientSales.forEach(sale => {
            const date = new Date(sale['Дата']);
            const ym = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
            const day = sale['Дата'].slice(0, 10);
            if (!calendarMap[ym]) calendarMap[ym] = 0;
            if (!calendarSumMap[ym]) calendarSumMap[ym] = 0;
            if (!daysByMonth[ym]) daysByMonth[ym] = new Set();
            daysByMonth[ym].add(day);
            const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
            calendarSumMap[ym] += revenue;
        });
        // Після збору — рахуємо унікальні дні
        Object.keys(daysByMonth).forEach(ym => {
            calendarMap[ym] = daysByMonth[ym].size;
        });
        let monthsSorted = Object.keys(calendarMap).sort();
        let prevCount = null, prevSum = null;
        let calendarTable = `<table class="min-w-full text-sm text-left"><thead><tr><th class="px-2 py-1">Місяць</th><th class="px-2 py-1">Кількість</th><th class="px-2 py-1">Динаміка</th><th class="px-2 py-1">Сума</th><th class="px-2 py-1">Динаміка</th></tr></thead><tbody>`;
        monthsSorted.forEach(m => {
            let trendCount = '-', trendSum = '-';
            if (prevCount !== null) {
                if (calendarMap[m] > prevCount) trendCount = '<span style="color:green">▲</span>';
                else if (calendarMap[m] < prevCount) trendCount = '<span style="color:red">▼</span>';
                else trendCount = '<span style="color:gray">●</span>';
            }
            if (prevSum !== null) {
                if (calendarSumMap[m] > prevSum) trendSum = '<span style="color:green">▲</span>';
                else if (calendarSumMap[m] < prevSum) trendSum = '<span style="color:red">▼</span>';
                else trendSum = '<span style="color:gray">●</span>';
            }
            calendarTable += `<tr><td class="px-2 py-1">${m}</td><td class="px-2 py-1">${calendarMap[m]}</td><td class="px-2 py-1">${trendCount}</td><td class="px-2 py-1">${calendarSumMap[m].toFixed(2)}</td><td class="px-2 py-1">${trendSum}</td></tr>`;
            prevCount = calendarMap[m]; prevSum = calendarSumMap[m];
        });
        calendarTable += '</tbody></table>';
        // Кнопки и модалки
        let buttonsRow = `<div class="mt-6 flex flex-wrap gap-4 justify-center items-center">`;
        if (clientLink) buttonsRow += `<a href="${clientLink}" target="_blank" class="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Перейти в CRM</a>`;
        buttonsRow += `<button id="show-missedModal" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition">Упущені продажі</button>`;
        buttonsRow += `<button id="show-similarModal" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Що беруть схожі клієнти</button>`;
        buttonsRow += `<button id="show-togetherModal" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition">Товари, які купують разом</button>`;
        buttonsRow += `<button id="show-calendarModal" class="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition">Календар покупок</button>`;
        // --- НОВА КНОПКА ---
        buttonsRow += `<button id="show-groupCoverageModal" class="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition">Покриття груп товарів</button>`;
        buttonsRow += `</div>`;
        // --- Модалки (адаптированы под scoped, без window) ---
        // Упущені продажі
        const missedModalId = 'missedModal';
        let missedProductsTable = `<div class="overflow-x-auto"><table class="min-w-full text-sm text-left"><thead><tr><th class="px-2 py-1">Товар</th><th class="px-2 py-1">Остання покупка</th><th class="px-2 py-1">Сума</th></tr></thead><tbody>`;
        missedProductsTable += stoppedProducts.map(p => `<tr><td class="px-2 py-1">${p.name}</td><td class="px-2 py-1">${p.lastDate.toLocaleDateString('uk-UA')}</td><td class="px-2 py-1">${p.sum.toFixed(2)}</td></tr>`).join('') + '</tbody></table></div>';
        let missedModalHtml = `<div id="${missedModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-xl w-full p-6 relative max-h-[60vh] flex flex-col"><button id="close-${missedModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4 text-red-400">Товари, які клієнт перестав брати (немає продажів за останній місяць)</h3><div class="overflow-y-auto" style="max-height: 40vh;">${missedProductsTable}</div></div></div>`;
        // Схожі клієнти
        const similarModalId = 'similarModal';
        const clientProductsSet = new Set(clientSales.map(item => item['Номенклатура']));
        const clientSphere = clientInfo['Сфера деятельности'];
        const sphereClients = masterData.filter(item => item['Сфера деятельности'] === clientSphere && item['Клиент.Код'] !== clientInfo['Клиент.Код']);
        const clientsByCode = {};
        sphereClients.forEach(item => {
            if (!clientsByCode[item['Клиент.Код']]) clientsByCode[item['Клиент.Код']] = new Set();
            clientsByCode[item['Клиент.Код']].add(item['Номенклатура']);
        });
        let similarClients = [];
        for (let code in clientsByCode) {
            const theirSet = clientsByCode[code];
            const intersection = new Set([...theirSet].filter(x => clientProductsSet.has(x)));
            if (intersection.size >= Math.max(1, Math.floor(clientProductsSet.size * 0.5))) {
                similarClients.push({ code, products: theirSet });
            }
        }
        let similarProducts = new Set();
        similarClients.forEach(cl => { cl.products.forEach(p => { if (!clientProductsSet.has(p)) similarProducts.add(p); }); });
        const similarProductsArr = [...similarProducts];
        const top10 = similarProductsArr.slice(0, 10);
        const top20 = similarProductsArr.slice(0, 20);
        const top50 = similarProductsArr.slice(0, 50);
        let similarModalHtml = `<div id="${similarModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-xl w-full p-6 relative max-h-[70vh] flex flex-col"><button id="close-${similarModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Що беруть схожі клієнти</h3><div class="mb-2 text-sm text-gray-400">Показані товари, які купують клієнти з тієї ж сфери, у яких співпадає хоча б 50% товарів з цим клієнтом, а цей клієнт їх не купував.</div><div><button type='button' class='font-bold text-blue-400 underline mb-1' onclick="this.nextElementSibling.classList.toggle('hidden')">Топ-10</button><div class='' style=''><ul class="list-disc list-inside text-gray-200">${top10.length > 0 ? top10.map(p => `<li>${p}</li>`).join('') : '<li>Немає таких товарів.</li>'}</ul></div><button type='button' class='font-bold text-blue-400 underline mb-1 mt-2' onclick="this.nextElementSibling.classList.toggle('hidden')">Топ-20</button><div class='hidden'><ul class="list-disc list-inside text-gray-200">${top20.length > 10 ? top20.slice(10).map(p => `<li>${p}</li>`).join('') : '<li>Немає таких товарів.</li>'}</ul></div><button type='button' class='font-bold text-blue-400 underline mb-1 mt-2' onclick="this.nextElementSibling.classList.toggle('hidden')">Топ-50</button><div class='hidden'><ul class="list-disc list-inside text-gray-200">${top50.length > 20 ? top50.slice(20).map(p => `<li>${p}</li>`).join('') : '<li>Немає таких товарів.</li>'}</ul></div></div></div></div>`;
        // Товари разом
        const togetherModalId = 'togetherModal';
        const salesByClientDate = {};
        masterData.forEach(sale => {
            const key = sale['Клиент.Код'] + '|' + sale['Дата'];
            if (!salesByClientDate[key]) salesByClientDate[key] = [];
            salesByClientDate[key].push(sale['Номенклатура']);
        });
        let togetherHtml = '', idx = 0;
        clientProductsSet.forEach(product => {
            const togetherCount = {};
            for (const key in salesByClientDate) {
                if (key.startsWith(clientInfo['Клиент.Код'] + '|')) continue;
                const products = salesByClientDate[key];
                if (products.includes(product)) {
                    products.forEach(p => { if (p !== product && !clientProductsSet.has(p)) togetherCount[p] = (togetherCount[p] || 0) + 1; });
                }
            }
            const togetherSorted = Object.entries(togetherCount).sort((a, b) => b[1] - a[1]);
            if (togetherSorted.length > 0) {
                idx++;
                const accId = `acc-together-${idx}`;
                togetherHtml += `<div class='mb-2'><button type='button' class='w-full text-left font-bold text-gray-200 bg-gray-800 rounded px-2 py-1 focus:outline-none' onclick="const el=this.parentNode.querySelector('div'); el.classList.toggle('hidden');">${product}</button><div class='hidden pl-4 pt-1'>${togetherSorted.map(([p, n]) => `${p} <span class='text-xs text-gray-400'>(${n})</span>`).join('<br>')}</div></div>`;
            }
        });
        let togetherExplanation = `<div class='mb-2 text-sm text-gray-400'>Для кожного вашого товару показані інші товари, які найчастіше купують разом із ним інші клієнти, але ви ще не купували.</div>`;
        let togetherModalHtml = `<div id="${togetherModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-xl w-full p-6 relative max-h-[60vh] flex flex-col"><button id="close-${togetherModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Товари, які купують разом</h3>${togetherExplanation}<div class="overflow-y-auto" style="max-height: 40vh;">${togetherHtml || '<div>Немає даних.</div>'}</div></div></div>`;
        // Календар
        const calendarModalId = 'calendarModal';
        let calendarModalHtml = `<div id="${calendarModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-6 relative"><button id="close-${calendarModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Календар покупок</h3><div class="overflow-y-auto" style="max-height: 40vh;">${calendarTable}</div></div></div>`;
        // --- Додаю модалку для "Покриття груп товарів" ---
        const groupCoverageModalId = 'groupCoverageModal';
        let groupCoverageModalHtml = `<div id="${groupCoverageModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full p-6 relative max-h-[80vh] flex flex-col"><button id="close-${groupCoverageModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Покриття груп товарів (категорія 2)</h3><div id="group-coverage-content" class="text-gray-200">Аналітика по групах буде тут...</div></div></div>`;
        // Вставляем модалки в конец mainBlock
        let modalsContainer = mainBlock.querySelector('#modals-container');
        if (!modalsContainer) {
            modalsContainer = document.createElement('div');
            modalsContainer.id = 'modals-container';
            mainBlock.appendChild(modalsContainer);
        }
        modalsContainer.innerHTML = missedModalHtml + similarModalHtml + togetherModalHtml + calendarModalHtml + groupCoverageModalHtml;
        // Обработчики открытия/закрытия модалок
        setTimeout(() => {
            const modals = [missedModalId, similarModalId, togetherModalId, calendarModalId, groupCoverageModalId];
            modals.forEach(id => {
                const modal = mainBlock.querySelector(`#${id}`);
                const showBtn = mainBlock.querySelector(`#show-${id}`);
                const closeBtn = mainBlock.querySelector(`#close-${id}`);
                if (showBtn && modal) showBtn.onclick = () => { 
                    modal.classList.remove('hidden');
                    // --- Додаю логіку для наповнення модалки "Покриття груп товарів" ---
                    if (id === groupCoverageModalId) {
                        const contentDiv = modal.querySelector('#group-coverage-content');
                        contentDiv.innerHTML = '<div class="text-gray-400">Завантаження аналітики...</div>';
                        (async () => {
                            try {
                                // 1. Завантажити категоризацію товарів
                                const resp = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category');
                                const nomenclatureData = await resp.json();
                                // 2. Зібрати всі "Номенклатури" клієнта
                                const clientNomenclatures = new Set(clientSales.map(s => s['Номенклатура']));
                                // 3. Визначити сферу клієнта
                                const clientSphere = clientSales[0]?.['Сфера деятельности'] || clientSales[0]?.['Сфера'] || '';
                                // 4. Всі "Номенклатури" у цій сфері
                                const sphereNomenclatures = new Set(masterData.filter(s => (s['Сфера деятельности']||s['Сфера']) === clientSphere).map(s => s['Номенклатура']));
                                // 5. Мапа: номенклатура -> категорія 2
                                const nomenToGroup = {};
                                nomenclatureData.forEach(item => {
                                    if (item['Номенклатура'] && item['Категория 2']) nomenToGroup[item['Номенклатура']] = item['Категория 2'];
                                });
                                // 6. Всі групи у сфері
                                const allGroups = Array.from(sphereNomenclatures).map(n => nomenToGroup[n]).filter(Boolean);
                                const uniqueAllGroups = Array.from(new Set(allGroups)).sort();
                                // 7. Групи, які купує клієнт
                                const clientGroups = Array.from(clientNomenclatures).map(n => nomenToGroup[n]).filter(Boolean);
                                const uniqueClientGroups = Array.from(new Set(clientGroups)).sort();
                                // 8. Групи, які не купує
                                const notBoughtGroups = uniqueAllGroups.filter(g => !uniqueClientGroups.includes(g));
                                // 9. % покриття
                                const coveragePercent = uniqueAllGroups.length ? Math.round(uniqueClientGroups.length / uniqueAllGroups.length * 100) : 0;
                                // 10. Вивід у модалку
                                contentDiv.innerHTML = `
                                    <div class='mb-4'>
                                        <b>Клієнт:</b> ${clientInfo['Клиент'] || ''}<br>
                                        <b>Сфера діяльності:</b> ${clientSphere}<br>
                                        <b>Всього груп у сфері:</b> ${uniqueAllGroups.length}<br>
                                        <b>Груп купує:</b> ${uniqueClientGroups.length}<br>
                                        <b>Груп не купує:</b> ${notBoughtGroups.length}<br>
                                        <b>Покриття:</b> <span class='text-pink-400 font-bold'>${coveragePercent}%</span>
                                    </div>
                                    <div class='mb-2'><b>Групи, які купує:</b> <span class='text-green-400'>${uniqueClientGroups.join(', ') || '—'}</span></div>
                                    <div class='mb-4'><b>Групи, які не купує:</b> <span class='text-red-400'>${notBoughtGroups.join(', ') || '—'}</span></div>
                                    <button id='show-group-details-btn' class='px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 mb-4'>Показати деталі по групах</button>
                                `;
                                // --- Додаю окрему модалку для таблиці ---
                                let groupDetailsModal = document.getElementById('groupDetailsModal');
                                if (!groupDetailsModal) {
                                    groupDetailsModal = document.createElement('div');
                                    groupDetailsModal.id = 'groupDetailsModal';
                                    groupDetailsModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden';
                                    groupDetailsModal.innerHTML = `
                                        <div class="bg-gray-900 rounded-lg shadow-lg max-w-3xl w-full p-6 relative max-h-[90vh] flex flex-col">
                                            <button id="close-groupDetailsModal" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button>
                                            <h3 class="text-lg font-bold mb-4">Детальна таблиця по групах</h3>
                                            <div class='overflow-x-auto' style='max-height:65vh;overflow-y:auto;'>
                                                <table class='min-w-max text-xs text-left border border-gray-700'><thead><tr><th class='px-2 py-1 border-b border-gray-700'>Група</th><th class='px-2 py-1 border-b border-gray-700'>Купує?</th></tr></thead><tbody>
                                                    ${uniqueAllGroups.map(g => `<tr><td class='px-2 py-1 border-b border-gray-800'>${g}</td><td class='px-2 py-1 border-b border-gray-800'>${uniqueClientGroups.includes(g) ? '<span class="text-green-400">Так</span>' : '<span class="text-red-400">Ні</span>'}</td></tr>`).join('')}
                                                </tbody></table>
                                            </div>
                                        </div>
                                    `;
                                    document.body.appendChild(groupDetailsModal);
                                }
                                // --- Обробник кнопки ---
                                const showDetailsBtn = contentDiv.querySelector('#show-group-details-btn');
                                if (showDetailsBtn) {
                                    showDetailsBtn.onclick = () => {
                                        groupDetailsModal.classList.remove('hidden');
                                    };
                                }
                                // --- Закриття модалки ---
                                const closeDetailsBtn = groupDetailsModal.querySelector('#close-groupDetailsModal');
                                if (closeDetailsBtn) {
                                    closeDetailsBtn.onclick = () => {
                                        groupDetailsModal.classList.add('hidden');
                                    };
                                }
                                groupDetailsModal.onclick = (e) => { if (e.target === groupDetailsModal) groupDetailsModal.classList.add('hidden'); };
                            } catch (e) {
                                contentDiv.innerHTML = `<div class='text-red-400'>Помилка аналітики: ${e.message}</div>`;
                            }
                        })();
                    }
                };
                if (closeBtn && modal) closeBtn.onclick = () => { modal.classList.add('hidden'); };
                if (modal) modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            });
        }, 0);
        // KPI-блок
        clientKpiContainer.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-white">${clientInfo['Клиент']} <span class="text-lg font-normal text-gray-400">(${clientInfo['Сфера деятельности'] || clientInfo['Клиент.Сфера деятельность'] || ''})</span></h2>
                <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div><p class="text-sm text-gray-400">Загальна виручка</p><p class="text-2xl font-bold text-green-400">${totalRevenue.toFixed(2)}</p>
                        <div class="text-xs text-gray-400 mt-1 ${isForecastOverdue ? 'bg-red-900 rounded px-2 py-1' : ''}">Прогноз: коли купить <b>${forecastDate}</b>, сума <b>${forecastSum.toFixed(2)}</b> <span class='text-gray-500'>(середній інтервал: ${avgIntervalDays ? avgIntervalDays.toFixed(1) : '-'} днів)</span></div>
                    </div>
                    <div><p class="text-sm text-gray-400">Кількість покупок</p><p class="text-2xl font-bold text-white">${new Set(clientSales.map(s => s['Дата'].slice(0, 10))).size}</p></div>
                    <div><p class="text-sm text-gray-400">Унікальних товарів</p><p class="text-2xl font-bold text-white">${productList.length}</p></div>
                    <div><p class="text-sm text-gray-400">Середній чек</p><p class="text-2xl font-bold text-blue-400">${avgCheck.toFixed(2)}</p></div>
                </div>
                <div class="mt-4 text-center"><span class="inline-block px-3 py-1 rounded bg-gray-900 text-gray-300 text-sm">Сегмент: <b>${segment}</b></span></div>
                ${buttonsRow}
                <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8" id="client-charts-block">
                  <div><canvas id="clientRevenueChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">Динаміка виручки по місяцях</div></div>
                  <div><canvas id="clientAvgCheckChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">Динаміка середнього чека</div></div>
                  <div><canvas id="clientCountChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">Кількість покупок по місяцях</div></div>
                </div>
            </div>
            <!-- Модалки будут добавлены динамически -->
        `;
        // --- График истории сегмента ---
        (async () => {
          const companyId = window.state?.currentCompanyId;
          const clientCode = clientInfo['Клиент.Код'];
          if (!companyId || !clientCode) return;
          const segmentHistory = await loadClientSegmentHistory(companyId, clientCode);
          const months = Object.keys(segmentHistory).sort();
          if (months.length > 0) {
            // Маппинг сегментов в числа для графика
            const segmentMap = {
              'Новий': 1,
              'Втрачений новий': 1,
              'Знижується активність': 2,
              'Втрачений активний': 2,
              'Втрачений лояльний': 2,
              'Потенційно втрачається': 3,
              'Лояльний': 3,
              'Втрачений чемпіон': 3,
              'Чемпіон': 4,
              'Активний': 4,
              'VIP': 5,
              'Втрачений VIP': 4
            };
            const data = months.map(m => segmentMap[segmentHistory[m].segment] || 0);
            const labels = months;
            // Вставляем canvas
            let chartBlock = document.createElement('div');
            chartBlock.className = 'mt-8';
            chartBlock.innerHTML = `<div class='mb-2 text-gray-300 text-sm'>Динаміка сегмента клієнта</div><canvas id='segmentHistoryChart' height='80'></canvas>`;
            // --- Додаю кнопку для таблиці ---
            const tableBtn = document.createElement('button');
            tableBtn.textContent = 'Динаміка сегментів (таблиця)';
            tableBtn.className = 'ml-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm';
            chartBlock.appendChild(tableBtn);
            // --- Таблиця (спочатку прихована) ---
            const tableBlock = document.createElement('div');
            tableBlock.className = 'mt-4 hidden';
            chartBlock.appendChild(tableBlock);
            tableBtn.onclick = () => {
              if (tableBlock.classList.contains('hidden')) {
                // Побудова таблиці
                let html = `<div class='overflow-x-auto'><table class='min-w-max text-xs text-left border border-gray-700'><thead><tr><th class='px-2 py-1 border-b border-gray-700'>Місяць</th><th class='px-2 py-1 border-b border-gray-700'>Сфера</th><th class='px-2 py-1 border-b border-gray-700'>Сегмент</th><th class='px-2 py-1 border-b border-gray-700'>Recency</th><th class='px-2 py-1 border-b border-gray-700'>Frequency</th><th class='px-2 py-1 border-b border-gray-700'>Monetary</th></tr></thead><tbody>`;
                months.forEach(m => {
                  const seg = segmentHistory[m];
                  html += `<tr><td class='px-2 py-1 border-b border-gray-800'>${m}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.sphere || ''}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.segment}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.rfm?.recencyDays ?? ''}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.rfm?.frequency ?? ''}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.rfm?.monetary ?? ''}</td></tr>`;
                });
                html += '</tbody></table></div>';
                tableBlock.innerHTML = html;
                tableBlock.classList.remove('hidden');
                tableBtn.textContent = 'Сховати таблицю';
              } else {
                tableBlock.classList.add('hidden');
                tableBtn.textContent = 'Динаміка сегментів (таблиця)';
              }
            };
            clientKpiContainer.appendChild(chartBlock);
            setTimeout(() => {
              new Chart(document.getElementById('segmentHistoryChart').getContext('2d'), {
                type: 'line',
                data: {
                  labels,
                  datasets: [{
                    label: 'Сегмент',
                    data,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167,139,250,0.2)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 4,
                    pointBackgroundColor: '#a78bfa'
                  }]
                },
                options: {
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: ctx => {
                          const val = ctx.raw;
                          return Object.keys(segmentMap).find(k => segmentMap[k] === val) || val;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      min: 1, max: 5, stepSize: 1,
                      ticks: {
                        callback: v => Object.keys(segmentMap).find(k => segmentMap[k] === v) || v,
                        color: '#a1a1aa'
                      }
                    },
                    x: { ticks: { color: '#a1a1aa' } }
                  }
                }
              });
            }, 0);
          }
        })();
        // Рендерим графики Chart.js
        setTimeout(() => {
            // Данные по месяцам
            const months = monthsSorted;
            const revenueData = months.map(m => calendarSumMap[m] || 0);
            const countData = months.map(m => calendarMap[m] || 0);
            const avgCheckData = months.map((m, i) => countData[i] ? revenueData[i]/countData[i] : 0);
            // График выручки
            new Chart(document.getElementById('clientRevenueChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{label:'Виручка',data:revenueData,borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.2)',fill:true}]
                },
                options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
            });
            // График среднего чека
            new Chart(document.getElementById('clientAvgCheckChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{label:'Середній чек',data:avgCheckData,borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.2)',fill:true}]
                },
                options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
            });
            // График количества покупок
            new Chart(document.getElementById('clientCountChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{label:'Кількість покупок',data:countData,backgroundColor:'rgba(251,191,36,0.7)'}]
                },
                options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
            });
        }, 0);
        // Рекомендации и топы
        segmentRecsList.innerHTML = segmentRecs.length > 0 ? segmentRecs.map(item => `<li>${item}</li>`).join('') : '<li>Немає рекомендацій.</li>';
        topSalesRecsList.innerHTML = topSalesRecs.length > 0 ? topSalesRecs.map(item => `<li>${item}</li>`).join('') : '<li>Немає рекомендацій.</li>';
        // ... (сюда добавить динамическое создание и обработку модалок, как в modules.js, но через mainBlock) ...
    }

    function runAnalysis(selectedClientCode) {
        if (!selectedClientCode) {
            resultsSection.classList.add('hidden');
            return;
        }
        const clientSales = masterData.filter(item => item['Клиент.Код'] == selectedClientCode);
        if (clientSales.length === 0) {
            alert('Не знайдено даних про продажі для цього клієнта.');
            return;
        }
        const clientSphere = clientSales[0]['Сфера деятельности'];
        clientSphereName.textContent = clientSphere;
        const clientProducts = new Set(clientSales.map(item => item['Номенклатура']));
        const sphereData = masterData.filter(item => item['Сфера деятельности'] === clientSphere);
        const segmentProducts = new Set(sphereData
            .filter(item => item['Клиент.Код'] != selectedClientCode)
            .map(item => item['Номенклатура'])
        );
        const segmentRecommendations = [...segmentProducts].filter(product => !clientProducts.has(product));
        const productSalesInSphere = sphereData.reduce((acc, sale) => {
            const product = sale['Номенклатура'];
            acc[product] = (acc[product] || 0) + 1;
            return acc;
        }, {});
        const topProductsInSphere = Object.entries(productSalesInSphere)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([product]) => product);
        const topSalesRecommendations = topProductsInSphere.filter(product => !clientProducts.has(product));
        displayResults(segmentRecommendations, topSalesRecommendations, clientSales);
        resultsSection.classList.remove('hidden');
    }

    managerFilter.onchange = e => {
        const manager = e.target.value;
        if (!manager) {
            clientFilter.innerHTML = '<option value="">Оберіть клієнта...</option>';
            clientFilter.disabled = true;
            clientSearch.disabled = true;
            resultsSection.classList.add('hidden');
            return;
        }
        populateClientFilter(manager, clientSearch.value);
        resultsSection.classList.add('hidden');
    };
    // --- Автокомплит для поиска клиента ---
    // Добавляем контейнер для выпадающего списка
    let autocompleteList = document.createElement('div');
    autocompleteList.id = 'client-autocomplete-list';
    autocompleteList.style.position = 'absolute';
    autocompleteList.style.zIndex = '100';
    autocompleteList.style.background = '#1f2937'; // bg-gray-800
    autocompleteList.style.color = '#fff';
    autocompleteList.style.width = '100%';
    autocompleteList.style.maxHeight = '220px';
    autocompleteList.style.overflowY = 'auto';
    autocompleteList.style.borderRadius = '0 0 0.5rem 0.5rem';
    autocompleteList.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    autocompleteList.style.display = 'none';
    clientSearch.parentNode.style.position = 'relative';
    clientSearch.parentNode.appendChild(autocompleteList);

    let filteredClientsCache = [];
    let autocompleteIndex = -1;

    function showAutocompleteList(clients) {
        autocompleteList.innerHTML = '';
        if (!clients.length) {
            autocompleteList.innerHTML = '<div class="px-4 py-2 text-gray-400">Нічого не знайдено</div>';
            autocompleteList.style.display = 'block';
            return;
        }
        clients.forEach((client, idx) => {
            const item = document.createElement('div');
            item.className = 'px-4 py-2 cursor-pointer hover:bg-indigo-700';
            item.textContent = `${client.name} (${client.sphere || 'Сфера не вказана'})`;
            item.dataset.code = client.code;
            if (idx === autocompleteIndex) item.classList.add('bg-indigo-800');
            item.onclick = () => {
                clientFilter.value = client.code;
                runAnalysis(client.code);
                autocompleteList.style.display = 'none';
            };
            autocompleteList.appendChild(item);
        });
        autocompleteList.style.display = 'block';
    }

    clientSearch.oninput = e => {
        const manager = managerFilter.value;
        if (!manager) return;
        populateClientFilter(manager, clientSearch.value);
        // Для автокомплита:
        if (!uniqueClientsByManager[manager]) return;
        filteredClientsCache = uniqueClientsByManager[manager].filter(client =>
            client.name.toLowerCase().includes(clientSearch.value.toLowerCase())
        );
        autocompleteIndex = -1;
        showAutocompleteList(filteredClientsCache);
        // Автовыбор, если остался только один клиент
        if (filteredClientsCache.length === 1) {
            clientFilter.value = filteredClientsCache[0].code;
            runAnalysis(filteredClientsCache[0].code);
            autocompleteList.style.display = 'none';
        }
    };
    // Навигация по списку клиентов стрелками и Enter
    clientSearch.addEventListener('keydown', e => {
        if (autocompleteList.style.display !== 'block' || !filteredClientsCache.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            autocompleteIndex = (autocompleteIndex + 1) % filteredClientsCache.length;
            showAutocompleteList(filteredClientsCache);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            autocompleteIndex = (autocompleteIndex - 1 + filteredClientsCache.length) % filteredClientsCache.length;
            showAutocompleteList(filteredClientsCache);
        } else if (e.key === 'Enter') {
            if (autocompleteIndex >= 0 && autocompleteIndex < filteredClientsCache.length) {
                clientFilter.value = filteredClientsCache[autocompleteIndex].code;
                runAnalysis(filteredClientsCache[autocompleteIndex].code);
                autocompleteList.style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            autocompleteList.style.display = 'none';
        }
    });
    // Скрывать список при потере фокуса
    clientSearch.addEventListener('blur', () => {
        setTimeout(() => autocompleteList.style.display = 'none', 150);
    });
    clientFilter.onchange = e => {
        const clientCode = e.target.value;
        runAnalysis(clientCode);
    };

    loadAndProcessData();
}

// === RFM-анализ и расчет сегментов ===
// --- Оновлена логіка сегментації (як у Node.js-скрипті) ---
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
        const frequency = allSales.length;
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
// === Сохранение сегментов в Firestore ===
async function saveSegmentsToFirestore(segments, companyId) {
  if (!window.state || !window.state.currentCompanyId) {
    alert('Компания не выбрана!');
    return;
  }
  const perms = window.state.currentUserPermissions || {};
  if (!perms.sales_manage && !perms.isOwner) {
    alert('Недостаточно прав для расчёта сегментов!');
    return;
  }
  try {
    for (const [clientCode, months] of Object.entries(segments)) {
      await firebase.setDoc(
        firebase.doc(firebase.db, 'companies', companyId, 'clientSegments', clientCode),
        { months },
        { merge: true }
      );
    }
  } catch (error) {
    console.error('Ошибка сохранения сегментов:', error);
    alert('Ошибка сохранения сегментов: ' + (error.message || error));
    throw error;
  }
}

// === Загрузка истории сегментов из Firestore ===
async function loadClientSegmentHistory(companyId, clientCode) {
  try {
    const docRef = firebase.doc(firebase.db, 'companies', companyId, 'clientSegments', clientCode);
    const docSnap = await firebase.getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().months || {};
    }
  } catch (e) {
    console.error('Ошибка загрузки истории сегмента:', e);
  }
  return {};
} 

// Додаю глобальний доступ для alerts.js
if (typeof window !== 'undefined') {
  window.initSalesAssistantPage = initSalesAssistantPage;

  // --- Обробник для кнопки перерахунку сегментів ---
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('recalculateSegmentBtn');
    const container = document.getElementById('recalculateSegmentContainer');
    const loader = document.getElementById('recalculateSegmentLoader');
    if (!btn || !loader || !container) return;

    // Показати кнопку тільки для адмінів/власників
    // Це потрібно буде перевіряти після завантаження state
    setTimeout(() => {
        const perms = window.state?.currentUserPermissions || {};
        if (perms.isOwner || perms.sales_manage) {
            container.classList.remove('hidden');
        }
    }, 2000); // Затримка, щоб дочекатися завантаження прав

    let isLoading = false;
    btn.onclick = async () => {
      if (isLoading) return;
      isLoading = true;
      loader.classList.remove('hidden');
      btn.disabled = true;

      try {
        const [dataRes, dataJulyRes] = await Promise.all([
          fetch('модуль помічник продажу/data.json'),
          fetch('https://fastapi.lookfort.com/nomenclature.analysis')
        ]);
        const data = await dataRes.json();
        const dataJuly = await dataJulyRes.json();
        const masterData = data.concat(dataJuly);
        const segments = calculateRfmSegments(masterData);
        const companyId = window.state?.currentCompanyId;

        if (companyId) {
          await saveSegmentsToFirestore(segments, companyId);
          loader.classList.add('hidden'); // Ховаємо лоадер
          btn.textContent = 'Готово!'; // Тільки текст
        }
        
      } catch (e) {
        loader.classList.add('hidden'); // Ховаємо лоадер
        btn.textContent = 'Помилка!'; // Тільки текст
        alert('Помилка перерахунку: ' + (e.message || e));
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Перерахувати сегменти'; // Повертаємо текст
          btn.appendChild(loader); // Повертаємо лоадер
          isLoading = false;
        }, 2000);
      }
    };
  });
} 