// debts.js - Модуль дебиторской задолженности
import * as firebase from './firebase.js';

let debtsData = [];
let managersData = [];
let departmentsData = [];
let clientCommentsData = [];
let paymentForecastsData = [];

// Демо данные для дебиторки
const DEMO_DEBTS_DATA = [
    {
        clientCode: "00-00007283",
        clientName: "ТОВ Альфа Трейд",
        manager: "Іванов Іван",
        department: "Відділ продажу",
        totalDebt: 125000,
        overdueDebt: 85000,
        currentDebt: 40000,
        lastPayment: "2024-11-15",
        daysOverdue: 45,
        invoices: [
            { number: "INV-2024-001", date: "2024-10-01", amount: 50000, dueDate: "2024-10-31", status: "overdue" },
            { number: "INV-2024-002", date: "2024-11-01", amount: 35000, dueDate: "2024-11-30", status: "overdue" },
            { number: "INV-2024-003", date: "2024-12-01", amount: 40000, dueDate: "2024-12-31", status: "current" }
        ]
    },
    {
        clientCode: "00-00026426",
        clientName: "ФОП Петренко О.В.",
        manager: "Петров Петро",
        department: "Відділ продажу",
        totalDebt: 75000,
        overdueDebt: 0,
        currentDebt: 75000,
        lastPayment: "2024-12-01",
        daysOverdue: 0,
        invoices: [
            { number: "INV-2024-004", date: "2024-12-05", amount: 75000, dueDate: "2025-01-05", status: "current" }
        ]
    },
    {
        clientCode: "00-00010339",
        clientName: "ТОВ Бета Логістик",
        manager: "Сидоров Сидор",
        department: "Оптовий відділ",
        totalDebt: 200000,
        overdueDebt: 150000,
        currentDebt: 50000,
        lastPayment: "2024-10-20",
        daysOverdue: 60,
        invoices: [
            { number: "INV-2024-005", date: "2024-09-15", amount: 100000, dueDate: "2024-10-15", status: "overdue" },
            { number: "INV-2024-006", date: "2024-10-01", amount: 50000, dueDate: "2024-11-01", status: "overdue" },
            { number: "INV-2024-007", date: "2024-12-10", amount: 50000, dueDate: "2025-01-10", status: "current" }
        ]
    },
    {
        clientCode: "00-00008914",
        clientName: "ПП Гамма Дистрибуція",
        manager: "Коваленко Анна",
        department: "Оптовий відділ",
        totalDebt: 95000,
        overdueDebt: 30000,
        currentDebt: 65000,
        lastPayment: "2024-11-20",
        daysOverdue: 25,
        invoices: [
            { number: "INV-2024-008", date: "2024-11-01", amount: 30000, dueDate: "2024-12-01", status: "overdue" },
            { number: "INV-2024-009", date: "2024-12-10", amount: 65000, dueDate: "2025-01-10", status: "current" }
        ]
    },
    {
        clientCode: "00-00015627",
        clientName: "ТОВ Дельта Плюс",
        manager: "Мельник Олег",
        department: "Роздрібний відділ",
        totalDebt: 45000,
        overdueDebt: 45000,
        currentDebt: 0,
        lastPayment: "2024-09-30",
        daysOverdue: 75,
        invoices: [
            { number: "INV-2024-010", date: "2024-09-15", amount: 45000, dueDate: "2024-10-15", status: "overdue" }
        ]
    }
];

/**
 * Главная функция инициализации модуля дебиторки
 */
export function initDebtsModule(container) {
    console.log('initDebtsModule called', container);
    if (!container) return;
    
    // Проверяем права доступа
    if (!window.hasPermission('debts_view_page')) {
        container.innerHTML = `
            <div class="bg-red-900 rounded-xl shadow-lg p-6 text-center">
                <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
                <p class="text-red-200">У вас немає прав для перегляду дебіторської заборгованості.</p>
                <p class="text-red-300 text-sm mt-2">Зверніться до адміністратора для надання доступу.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="bg-gray-800 rounded-xl shadow-lg p-6">
            <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-3xl md:text-4xl font-bold text-white">Дебіторська заборгованість</h1>
                    <p class="mt-2 text-gray-400">Управління заборгованостями клієнтів</p>
                </div>
                <div class="flex gap-2">
                    ${window.hasPermission('debts_export') ? `
                        <button onclick="exportDebtsToExcel()" 
                                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            📊 Експорт Excel
                        </button>
                    ` : ''}
                    <button onclick="refreshDebtsData()" 
                            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        🔄 Оновити
                    </button>
                </div>
            </div>
            <div id="debts-filters-container" class="mb-4"></div>
            <div id="debts-summary-container" class="mb-4"></div>
            <div id="debts-content-container" class="mb-4"></div>
        </div>
    `;

    loadDebtsData();
}

/**
 * Преобразование данных API в внутренний формат
 */
function transformApiDataToInternalFormat(apiData) {
    if (!Array.isArray(apiData)) {
        console.error('API вернуло не массив:', apiData);
        return [];
    }
    
    // Группируем данные по клиентам
    const clientsMap = new Map();
    
    apiData.forEach(item => {
        const clientCode = item["Клиент.Код"] || item["Главный контрагент.Код"];
        const clientName = item["Клиент"] || item["Главный контрагент"];
        const manager = item["Менеджер"];
        const debt = parseFloat(item["Долг"]) || 0;
        const contract = item["Договор"] || "Основний договір";
        
        if (!clientCode || debt === 0) return; // Пропускаем записи без кода клиента или долга
        
        if (!clientsMap.has(clientCode)) {
            clientsMap.set(clientCode, {
                clientCode: clientCode || '',
                clientName: clientName || 'Невизначений клієнт',
                manager: manager || 'Невизначений менеджер',
                department: getManagerDepartment(manager) || 'Невизначений відділ',
                totalDebt: 0,
                overdueDebt: 0,
                currentDebt: 0,
                lastPayment: "",
                daysOverdue: 0,
                contracts: []
            });
        }
        
        const client = clientsMap.get(clientCode);
        client.totalDebt += debt;
        
        // Простая логика: считаем весь долг текущим (можно доработать)
        client.currentDebt += debt;
        
        // Добавляем информацию о договоре
        client.contracts.push({
            name: contract,
            debt: debt,
            manager: manager
        });
    });
    
    // Преобразуем Map в массив
    return Array.from(clientsMap.values()).map(client => ({
        ...client,
        // Создаем имитацию счетов для совместимости
        invoices: client.contracts.map((contract, index) => ({
            number: `${contract.name}-${index + 1}`,
            date: new Date().toISOString().split('T')[0],
            amount: contract.debt,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 дней
            status: "current",
            contract: contract.name
        }))
    }));
}

/**
 * Получение отдела менеджера
 */
function getManagerDepartment(managerName) {
    if (!managerName) return "Невизначений відділ";
    
    // Ищем в загруженных данных менеджеров
    const manager = managersData.find(mgr => 
        mgr.name === managerName || 
        mgr.fullName === managerName ||
        (mgr.firstName && mgr.lastName && `${mgr.firstName} ${mgr.lastName}` === managerName)
    );
    
    if (manager && manager.department) {
        // Если есть ID отдела, ищем название отдела
        const department = departmentsData.find(dept => dept.id === manager.department);
        return department ? department.name : manager.department;
    }
    
    // Простая логика по умолчанию на основе имени менеджера
    const lowerName = managerName.toLowerCase();
    if (lowerName.includes('оптов') || lowerName.includes('wholesale')) {
        return "Оптовий відділ";
    } else if (lowerName.includes('роздрібн') || lowerName.includes('retail')) {
        return "Роздрібний відділ";
    } else {
        return "Відділ продажу";
    }
}

/**
 * Загрузка данных дебиторки
 */
export async function loadDebtsData() {
    try {
        // Показываем индикатор загрузки
        showLoadingState();
        
        // Загружаем данные параллельно
        const companyId = window.state?.currentCompanyId;
        
        const promises = [
            // Загружаем данные дебиторки с API
            fetch('https://fastapi.lookfort.com/company.debt')
                .then(response => {
                    console.log('API відповідь статус:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('API данні отримано:', Array.isArray(data) ? `${data.length} записів` : typeof data);
                    console.log('Приклад API запису:', data[0]);
                    return data;
                })
                .catch(error => {
                    console.error('❌ Помилка завантаження з API дебіторки:', error);
                    console.warn('⚠️ Використовуються демо дані як fallback');
                    
                    // Показываем уведомление пользователю
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('Не вдалося завантажити дані з сервера. Показано демо дані.', 'warning');
                    }
                    
                    // Возвращаем демо данные в формате API
                    return DEMO_DEBTS_DATA.map(item => ({
                        "Главный контрагент": item.clientName,
                        "Главный контрагент.Код": item.clientCode,
                        "Договор": "Основний договір",
                        "Долг": item.totalDebt,
                        "Клиент": item.clientName,
                        "Клиент.Код": item.clientCode,
                        "Менеджер": item.manager
                    }));
                })
        ];
        
        // Загружаем данные из Firebase если есть компания
        if (companyId) {
            promises.push(
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/employees`)),
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/departments`)),
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/debtComments`)),
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/paymentForecasts`))
            );
        }
        
        const results = await Promise.all(promises);
        const apiDebtsData = results[0];
        
        if (companyId && results.length > 1) {
            const [, employeesSnap, departmentsSnap, commentsSnap, forecastsSnap] = results;
            
            // Загружаем всех сотрудников и фильтруем менеджеров
            const allEmployees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Сначала пытаемся найти менеджеров по должности/роли
            managersData = allEmployees.filter(emp => {
                if (emp.role === 'manager') return true;
                if (emp.position) {
                    const position = emp.position.toLowerCase();
                    return position.includes('менеджер') || 
                           position.includes('manager') || 
                           position.includes('sales') ||
                           position.includes('продаж');
                }
                return false;
            });
            
            // Если не нашли менеджеров по критериям, используем всех сотрудников
            if (managersData.length === 0) {
                console.warn('🔍 Менеджери не знайдені за критеріями, використовуємо всіх співробітників');
                managersData = allEmployees;
            }
            
            departmentsData = departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            clientCommentsData = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            paymentForecastsData = forecastsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            console.log('📊 Завантажено з Firebase:');
            console.log('- Співробітників:', allEmployees.length);
            console.log('- Менеджерів:', managersData.length);
            console.log('- Відділів:', departmentsData.length);
            console.log('Менеджери:', managersData.map(m => `${m.name} (${m.departmentId})`));
            console.log('Відділи:', departmentsData.map(d => `${d.name} (${d.id})`));
        }
        
        // Преобразуем данные API в нужный формат
        debtsData = transformApiDataToInternalFormat(apiDebtsData);
        
        // Проверяем, используются ли демо данные
        const isUsingDemoData = apiDebtsData === DEMO_DEBTS_DATA || 
                               (Array.isArray(apiDebtsData) && apiDebtsData.length > 0 && 
                                apiDebtsData[0]["Главный контрагент"] === "ТОВ Альфа Трейд");
        
        console.log('Завантажено записів дебіторки:', debtsData.length);
        console.log('Приклад даних:', debtsData[0]);
        
        if (isUsingDemoData) {
            console.warn('🔄 Увага: Відображаються демонстраційні дані');
        } else {
            console.log('✅ Завантажено реальні дані з API');
        }
        
        hideLoadingState();
        renderDebtsFilters();
        renderDebtsSummary(debtsData, isUsingDemoData);
        renderDebtsGroupedByManager();
        
    } catch (error) {
        console.error('Помилка завантаження дебіторки:', error);
        showErrorState('Помилка завантаження даних');
    }
}

/**
 * Показать состояние загрузки
 */
function showLoadingState() {
    const contentContainer = document.getElementById('debts-content-container');
    if (!contentContainer) return;
    
    contentContainer.innerHTML = `
        <div class="text-center p-8">
            <div class="loader mx-auto mb-4"></div>
            <p class="text-gray-300">Завантаження даних дебіторки...</p>
        </div>
    `;
}

/**
 * Скрыть состояние загрузки
 */
function hideLoadingState() {
    // Состояние будет перезаписано в renderDebtsTable
}

/**
 * Показать состояние ошибки
 */
function showErrorState(message) {
    const contentContainer = document.getElementById('debts-content-container');
    if (!contentContainer) return;
    
    contentContainer.innerHTML = `
        <div class="text-center p-8 bg-red-900 rounded-lg">
            <p class="text-red-200 text-lg">${message}</p>
            <button onclick="loadDebtsData()" 
                    class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Спробувати знову
            </button>
        </div>
    `;
}

/**
 * Рендеринг фильтров
 */
function renderDebtsFilters() {
    const filtersContainer = document.getElementById('debts-filters-container');
    if (!filtersContainer) return;
    
    // Получаем отделы из Firebase или fallback из данных долгов
    let departmentOptions = '';
    let managerOptions = '';
    
    console.log('🔧 renderDebtsFilters викликано:');
    console.log('- departmentsData.length:', departmentsData.length);
    console.log('- managersData.length:', managersData.length);
    console.log('- debtsData.length:', debtsData.length);
    
    if (departmentsData.length > 0 && managersData.length > 0) {
        // Используем данные из Firebase
        console.log('✅ Використовуємо дані з Firebase');
        console.log('Departments:', departmentsData);
        console.log('Managers:', managersData);
        
        departmentOptions = departmentsData.map(dept => 
            `<option value="${dept.id}">${dept.name}</option>`
        ).join('');
        
        // Получаем менеджеров из Firebase, фильтруем по выбранному отделу
        const selectedDepartment = document.getElementById('department-filter')?.value || '';
        const filteredManagers = selectedDepartment 
            ? managersData.filter(manager => {
                // Проверяем разные возможные поля для связи с отделом
                return manager.departmentId === selectedDepartment ||
                       manager.department === selectedDepartment ||
                       (manager.department && manager.department.id === selectedDepartment);
              })
            : managersData;
        
        managerOptions = filteredManagers.map(manager => 
            `<option value="${manager.id}">${manager.name}</option>`
        ).join('');
        
        console.log('🔧 Фільтри: використовуються дані з Firebase');
    } else {
        // Fallback: используем данные из API долгов
        console.log('⚠️ Fallback: використовуємо дані з API долгів');
        console.log('debtsData:', debtsData);
        
        const uniqueDepartments = [...new Set(debtsData.map(d => d.department))].filter(Boolean);
        const uniqueManagers = [...new Set(debtsData.map(d => d.manager))].filter(Boolean);
        
        console.log('uniqueDepartments:', uniqueDepartments);
        console.log('uniqueManagers:', uniqueManagers);
        
        departmentOptions = uniqueDepartments.map(dept => 
            `<option value="${dept}">${dept}</option>`
        ).join('');
        
        managerOptions = uniqueManagers.map(manager => 
            `<option value="${manager}">${manager}</option>`
        ).join('');
        
        console.log('⚠️ Фільтри: використовуються дані з API долгів (fallback)');
    }
    
    filtersContainer.innerHTML = `
        <div class="bg-gray-700 rounded-lg p-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Відділ:</label>
                    <select id="department-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="">Всі відділи</option>
                        ${departmentOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Менеджер:</label>
                    <select id="manager-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="">Всі менеджери</option>
                        ${managerOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Тип заборгованості:</label>
                    <select id="debt-type-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="">Всі</option>
                        <option value="overdue">Прострочена</option>
                        <option value="current">Поточна</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Сортування:</label>
                    <select id="sort-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="debt-desc">Борг (зменшення)</option>
                        <option value="debt-asc">Борг (зростання)</option>
                        <option value="overdue-desc">Прострочка (зменшення)</option>
                        <option value="days-desc">Днів прострочки</option>
                        <option value="name-asc">Назва клієнта</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    // Обработчики фильтров
    document.getElementById('department-filter').onchange = () => {
        updateManagersFilter();
        applyFilters();
    };
    document.getElementById('manager-filter').onchange = applyFilters;
    document.getElementById('debt-type-filter').onchange = applyFilters;
    document.getElementById('sort-filter').onchange = applyFilters;
}

/**
 * Обновление фильтра менеджеров при изменении отдела
 */
function updateManagersFilter() {
    const departmentFilter = document.getElementById('department-filter');
    const managerFilter = document.getElementById('manager-filter');
    
    if (!departmentFilter || !managerFilter) return;
    
    const selectedDepartment = departmentFilter.value;
    const currentManager = managerFilter.value;
    
    let managerOptions = '';
    
    if (departmentsData.length > 0 && managersData.length > 0) {
        // Используем данные из Firebase
        const filteredManagers = selectedDepartment 
            ? managersData.filter(manager => {
                // Проверяем разные возможные поля для связи с отделом
                return manager.departmentId === selectedDepartment ||
                       manager.department === selectedDepartment ||
                       (manager.department && manager.department.id === selectedDepartment);
              })
            : managersData;
        
        managerOptions = filteredManagers.map(manager => 
            `<option value="${manager.id}">${manager.name}</option>`
        ).join('');
        
        // Сбрасываем выбор менеджера если он не входит в новый отдел
        if (currentManager && !filteredManagers.find(m => m.id === currentManager)) {
            managerFilter.value = '';
        }
    } else {
        // Fallback: фильтруем менеджеров по отделу из данных долгов
        const managersInDepartment = selectedDepartment 
            ? [...new Set(debtsData.filter(d => d.department === selectedDepartment).map(d => d.manager))]
            : [...new Set(debtsData.map(d => d.manager))];
        
        managerOptions = managersInDepartment.map(manager => 
            `<option value="${manager}">${manager}</option>`
        ).join('');
        
        // Сбрасываем выбор менеджера если он не входит в новый отдел
        if (currentManager && !managersInDepartment.includes(currentManager)) {
            managerFilter.value = '';
        }
    }
    
    managerFilter.innerHTML = `
        <option value="">Всі менеджери</option>
        ${managerOptions}
    `;
}

/**
 * Применение фильтров
 */
function applyFilters() {
    const managerFilter = document.getElementById('manager-filter').value;
    const departmentFilter = document.getElementById('department-filter').value;
    const debtTypeFilter = document.getElementById('debt-type-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;
    
    let filteredData = [...debtsData];
    
    if (departmentsData.length > 0 && managersData.length > 0) {
        // Используем данные из Firebase
        
        // Фильтрация по менеджеру (по ID)
        if (managerFilter) {
            const selectedManager = managersData.find(m => m.id === managerFilter);
            if (selectedManager) {
                filteredData = filteredData.filter(d => d.manager === selectedManager.name);
            }
        }
        
        // Фильтрация по отделу (по ID)
        if (departmentFilter) {
            const selectedDepartment = departmentsData.find(dept => dept.id === departmentFilter);
            if (selectedDepartment) {
                const departmentManagers = managersData
                    .filter(manager => {
                        // Проверяем разные возможные поля для связи с отделом
                        return manager.departmentId === departmentFilter ||
                               manager.department === departmentFilter ||
                               (manager.department && manager.department.id === departmentFilter);
                    })
                    .map(manager => manager.name);
                
                filteredData = filteredData.filter(d => departmentManagers.includes(d.manager));
            }
        }
    } else {
        // Fallback: используем данные из API долгов (прямое сравнение по названиям)
        
        if (managerFilter) {
            filteredData = filteredData.filter(d => d.manager === managerFilter);
        }
        
        if (departmentFilter) {
            filteredData = filteredData.filter(d => d.department === departmentFilter);
        }
    }
    
    if (debtTypeFilter === 'overdue') {
        filteredData = filteredData.filter(d => d.overdueDebt > 0);
    } else if (debtTypeFilter === 'current') {
        filteredData = filteredData.filter(d => d.currentDebt > 0 && d.overdueDebt === 0);
    }
    
    // Сортировка
    switch(sortFilter) {
        case 'debt-desc':
            filteredData.sort((a, b) => b.totalDebt - a.totalDebt);
            break;
        case 'debt-asc':
            filteredData.sort((a, b) => a.totalDebt - b.totalDebt);
            break;
        case 'overdue-desc':
            filteredData.sort((a, b) => b.overdueDebt - a.overdueDebt);
            break;
        case 'days-desc':
            filteredData.sort((a, b) => b.daysOverdue - a.daysOverdue);
            break;
        case 'name-asc':
            filteredData.sort((a, b) => a.clientName.localeCompare(b.clientName));
            break;
    }
    
    renderDebtsSummary(filteredData, false); // При фильтрации всегда используем уже загруженные данные
    renderDebtsGroupedByManager(filteredData);
}

/**
 * Рендеринг сводки
 */
function renderDebtsSummary(data = debtsData, isDemo = false) {
    const summaryContainer = document.getElementById('debts-summary-container');
    if (!summaryContainer) return;
    
    const totalDebt = data.reduce((sum, d) => sum + d.totalDebt, 0);
    const overdueDebt = data.reduce((sum, d) => sum + d.overdueDebt, 0);
    const currentDebt = data.reduce((sum, d) => sum + d.currentDebt, 0);
    const clientsCount = data.length;
    const overdueClientsCount = data.filter(d => d.overdueDebt > 0).length;
    const avgDaysOverdue = data.filter(d => d.daysOverdue > 0).reduce((sum, d) => sum + d.daysOverdue, 0) / 
                          (data.filter(d => d.daysOverdue > 0).length || 1);
    
    summaryContainer.innerHTML = `
        ${isDemo ? `
            <div class="bg-orange-900 border border-orange-600 rounded-lg p-3 mb-4 flex items-center gap-3">
                <div class="text-orange-400">⚠️</div>
                <div>
                    <div class="text-orange-200 font-medium">Демонстраційні дані</div>
                    <div class="text-orange-300 text-sm">Сервер недоступний. Показано тестові дані для демонстрації.</div>
                </div>
            </div>
        ` : ''}
        <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div class="bg-gray-700 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${clientsCount}</div>
                <div class="text-sm text-gray-400">Клієнтів з боргом</div>
            </div>
            <div class="bg-blue-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${formatCurrency(totalDebt)}</div>
                <div class="text-sm text-blue-200">Загальний борг</div>
            </div>
            <div class="bg-red-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${formatCurrency(overdueDebt)}</div>
                <div class="text-sm text-red-200">Прострочений борг</div>
            </div>
            <div class="bg-green-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${formatCurrency(currentDebt)}</div>
                <div class="text-sm text-green-200">Поточний борг</div>
            </div>
            <div class="bg-yellow-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${overdueClientsCount}</div>
                <div class="text-sm text-yellow-200">Прострочені клієнти</div>
            </div>
            <div class="bg-purple-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${Math.round(avgDaysOverdue)}</div>
                <div class="text-sm text-purple-200">Середня прострочка</div>
            </div>
        </div>
    `;
}

/**
 * Рендеринг таблицы дебиторки
 */
function renderDebtsTable(data = debtsData) {
    const contentContainer = document.getElementById('debts-content-container');
    if (!contentContainer) return;
    
    contentContainer.innerHTML = `
        <div class="bg-white dark:bg-gray-700 rounded-lg overflow-hidden">
            <table class="w-full">
                <thead class="bg-gray-800">
                    <tr>
                        <th class="px-4 py-3 text-left text-white">Клієнт</th>
                        <th class="px-4 py-3 text-left text-white">Менеджер</th>
                        <th class="px-4 py-3 text-right text-white">Загальний борг</th>
                        <th class="px-4 py-3 text-right text-white">Прострочений</th>
                        <th class="px-4 py-3 text-center text-white">Днів прострочки</th>
                        <th class="px-4 py-3 text-center text-white">Остання оплата</th>
                        <th class="px-4 py-3 text-center text-white">Статус</th>
                        <th class="px-4 py-3 text-center text-white">Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(debt => {
                        const hasComment = clientCommentsData.find(c => c.clientCode === debt.clientCode);
                        const hasForecast = paymentForecastsData.find(f => f.clientCode === debt.clientCode);
                        return `
                            <tr class="border-b border-gray-600 hover:bg-gray-600">
                                <td class="px-4 py-3 text-white">
                                    <div class="font-medium">${debt.clientName}</div>
                                    <div class="text-sm text-gray-400">${debt.clientCode}</div>
                                    ${hasComment ? '<div class="text-xs text-blue-400">💬 Є коментар</div>' : ''}
                                </td>
                                <td class="px-4 py-3 text-gray-200">
                                    <div>${debt.manager}</div>
                                    <div class="text-sm text-gray-400">${debt.department}</div>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <span class="font-medium text-white">${formatCurrency(debt.totalDebt)}</span>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <span class="font-medium ${debt.overdueDebt > 0 ? 'text-red-400' : 'text-green-400'}">
                                        ${formatCurrency(debt.overdueDebt)}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <span class="px-2 py-1 rounded-full text-xs ${
                                        debt.daysOverdue === 0 ? 'bg-green-600 text-white' :
                                        debt.daysOverdue <= 30 ? 'bg-yellow-600 text-white' :
                                        debt.daysOverdue <= 60 ? 'bg-orange-600 text-white' :
                                        'bg-red-600 text-white'
                                    }">
                                        ${debt.daysOverdue || 0}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-center text-gray-200">${debt.lastPayment}</td>
                                <td class="px-4 py-3 text-center">
                                    ${hasForecast ? 
                                        '<div class="text-xs text-green-400">📅 Є прогноз</div>' : 
                                        '<div class="text-xs text-gray-500">Без прогнозу</div>'
                                    }
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <button onclick="showDebtDetails('${debt.clientCode}')" 
                                            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                        Деталі
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Рендеринг дебиторки сгруппированной по менеджерам
 */
function renderDebtsGroupedByManager(data = debtsData) {
    const contentContainer = document.getElementById('debts-content-container');
    if (!contentContainer) return;
    
    // Группируем данные по менеджерам
    const groupedByManager = {};
    data.forEach(debt => {
        const managerName = debt.manager || 'Не вказано';
        if (!groupedByManager[managerName]) {
            groupedByManager[managerName] = {
                manager: managerName,
                department: debt.department || 'Не вказано',
                clients: [],
                totalDebt: 0,
                overdueDebt: 0,
                clientsCount: 0
            };
        }
        
        groupedByManager[managerName].clients.push(debt);
        groupedByManager[managerName].totalDebt += debt.totalDebt || 0;
        groupedByManager[managerName].overdueDebt += debt.overdueDebt || 0;
        groupedByManager[managerName].clientsCount++;
    });
    
    // Сортируем менеджеров по общей задолженности
    const sortedManagers = Object.values(groupedByManager).sort((a, b) => b.totalDebt - a.totalDebt);
    
    contentContainer.innerHTML = `
        <div class="space-y-6">
            ${sortedManagers.map(managerGroup => `
                <div class="bg-gray-700 rounded-lg overflow-hidden">
                    <div class="bg-gray-800 p-4 cursor-pointer hover:bg-gray-750" onclick="toggleManagerGroup('${(managerGroup.manager || 'unknown').replace(/'/g, '\\\'')}')">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-4">
                                <div>
                                    <h3 class="text-lg font-bold text-white">${managerGroup.manager}</h3>
                                    <p class="text-sm text-gray-400">${managerGroup.department}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-6">
                                <div class="text-center">
                                    <div class="text-lg font-bold text-white">${managerGroup.clientsCount}</div>
                                    <div class="text-xs text-gray-400">Клієнтів</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-lg font-bold text-white">${formatCurrency(managerGroup.totalDebt)}</div>
                                    <div class="text-xs text-gray-400">Загальний борг</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-lg font-bold ${managerGroup.overdueDebt > 0 ? 'text-red-400' : 'text-green-400'}">${formatCurrency(managerGroup.overdueDebt)}</div>
                                    <div class="text-xs text-gray-400">Прострочений</div>
                                </div>
                                <div class="text-white">
                                    <span id="arrow-${(managerGroup.manager || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}">▼</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="clients-${(managerGroup.manager || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}" class="hidden">
                        <table class="w-full">
                            <thead class="bg-gray-600">
                                <tr>
                                    <th class="px-4 py-3 text-left text-white">Клієнт</th>
                                    <th class="px-4 py-3 text-right text-white">Загальний борг</th>
                                    <th class="px-4 py-3 text-right text-white">Прострочений</th>
                                    <th class="px-4 py-3 text-center text-white">Днів прострочки</th>
                                    <th class="px-4 py-3 text-center text-white">Остання оплата</th>
                                    <th class="px-4 py-3 text-center text-white">Статус</th>
                                    <th class="px-4 py-3 text-center text-white">Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${managerGroup.clients.sort((a, b) => b.totalDebt - a.totalDebt).map(debt => {
                                    const hasComment = clientCommentsData.find(c => c.clientCode === debt.clientCode);
                                    const hasForecast = paymentForecastsData.find(f => f.clientCode === debt.clientCode);
                                    return `
                                        <tr class="border-b border-gray-600 hover:bg-gray-600">
                                            <td class="px-4 py-3 text-white">
                                                <div class="font-medium">${debt.clientName}</div>
                                                <div class="text-sm text-gray-400">${debt.clientCode}</div>
                                                ${hasComment ? '<div class="text-xs text-blue-400">💬 Є коментар</div>' : ''}
                                            </td>
                                            <td class="px-4 py-3 text-right">
                                                <span class="font-medium text-white">${formatCurrency(debt.totalDebt)}</span>
                                            </td>
                                            <td class="px-4 py-3 text-right">
                                                <span class="font-medium ${debt.overdueDebt > 0 ? 'text-red-400' : 'text-green-400'}">
                                                    ${formatCurrency(debt.overdueDebt)}
                                                </span>
                                            </td>
                                            <td class="px-4 py-3 text-center">
                                                <span class="px-2 py-1 rounded-full text-xs ${
                                                    debt.daysOverdue === 0 ? 'bg-green-600 text-white' :
                                                    debt.daysOverdue <= 30 ? 'bg-yellow-600 text-white' :
                                                    debt.daysOverdue <= 60 ? 'bg-orange-600 text-white' :
                                                    'bg-red-600 text-white'
                                                }">
                                                    ${debt.daysOverdue || 0}
                                                </span>
                                            </td>
                                            <td class="px-4 py-3 text-center text-gray-200">${debt.lastPayment}</td>
                                            <td class="px-4 py-3 text-center">
                                                ${hasForecast ? 
                                                    '<div class="text-xs text-green-400">📅 Є прогноз</div>' : 
                                                    '<div class="text-xs text-gray-500">Без прогнозу</div>'
                                                }
                                            </td>
                                            <td class="px-4 py-3 text-center">
                                                <button onclick="showDebtDetails('${debt.clientCode}')" 
                                                        class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                                    Деталі
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Переключение видимости группы клиентов менеджера
 */
window.toggleManagerGroup = function(managerName) {
    const managerId = (managerName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const clientsDiv = document.getElementById(`clients-${managerId}`);
    const arrow = document.getElementById(`arrow-${managerId}`);
    
    if (clientsDiv && arrow) {
        if (clientsDiv.classList.contains('hidden')) {
            clientsDiv.classList.remove('hidden');
            arrow.textContent = '▲';
        } else {
            clientsDiv.classList.add('hidden');
            arrow.textContent = '▼';
        }
    }
};

/**
 * Показать детали задолженности клиента
 */
window.showDebtDetails = function(clientCode) {
    const debt = debtsData.find(d => d.clientCode === clientCode);
    if (!debt) return;
    
    const existingComment = clientCommentsData.find(c => c.clientCode === clientCode);
    const existingForecast = paymentForecastsData.find(f => f.clientCode === clientCode);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Деталі заборгованості: ${debt.clientName}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-gray-700 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${formatCurrency(debt.totalDebt)}</div>
                    <div class="text-sm text-gray-400">Загальний борг</div>
                </div>
                <div class="bg-red-600 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${formatCurrency(debt.overdueDebt)}</div>
                    <div class="text-sm text-red-200">Прострочений</div>
                </div>
                <div class="bg-green-600 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${formatCurrency(debt.currentDebt)}</div>
                    <div class="text-sm text-green-200">Поточний</div>
                </div>
                <div class="bg-yellow-600 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${debt.daysOverdue}</div>
                    <div class="text-sm text-yellow-200">Днів прострочки</div>
                </div>
            </div>
            
            <div class="mb-6">
                <h3 class="text-lg font-bold text-white mb-3">Заборгованості по договорах</h3>
                <div class="bg-gray-700 rounded-lg overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-600">
                            <tr>
                                <th class="px-4 py-2 text-left text-white">Договір</th>
                                <th class="px-4 py-2 text-center text-white">Дата формування</th>
                                <th class="px-4 py-2 text-right text-white">Сума боргу</th>
                                <th class="px-4 py-2 text-center text-white">Менеджер</th>
                                <th class="px-4 py-2 text-center text-white">Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${debt.invoices.map(invoice => `
                                <tr class="border-b border-gray-600">
                                    <td class="px-4 py-2 text-white">
                                        <div class="font-medium">${invoice.contract || invoice.number}</div>
                                        ${invoice.contract !== invoice.number ? `<div class="text-xs text-gray-400">${invoice.number}</div>` : ''}
                                    </td>
                                    <td class="px-4 py-2 text-center text-gray-200">${invoice.date}</td>
                                    <td class="px-4 py-2 text-right text-white font-medium">${formatCurrency(invoice.amount)}</td>
                                    <td class="px-4 py-2 text-center text-gray-200">${debt.manager}</td>
                                    <td class="px-4 py-2 text-center">
                                        <span class="px-2 py-1 rounded-full text-xs ${
                                            invoice.status === 'overdue' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                                        }">
                                            ${invoice.status === 'overdue' ? 'Прострочено' : 'Поточний'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${window.hasPermission('debts_manage_comments') ? `
                    <div>
                        <h3 class="text-lg font-bold text-white mb-3">Коментар менеджера</h3>
                        <textarea id="manager-comment-${clientCode}" 
                                  class="w-full h-24 bg-gray-700 text-white rounded border border-gray-600 p-3"
                                  placeholder="Додайте коментар про стан оплати...">${existingComment?.comment || ''}</textarea>
                        ${existingComment ? `<div class="text-xs text-gray-400 mt-1">Оновлено: ${new Date(existingComment.updatedAt?.seconds * 1000).toLocaleDateString()}</div>` : ''}
                    </div>
                ` : existingComment ? `
                    <div>
                        <h3 class="text-lg font-bold text-white mb-3">Коментар менеджера</h3>
                        <div class="w-full h-24 bg-gray-600 text-gray-300 rounded border border-gray-500 p-3 overflow-y-auto">
                            ${existingComment.comment || 'Немає коментаря'}
                        </div>
                        <div class="text-xs text-gray-400 mt-1">Оновлено: ${new Date(existingComment.updatedAt?.seconds * 1000).toLocaleDateString()}</div>
                    </div>
                ` : ''}
                ${window.hasPermission('debts_manage_forecasts') ? `
                    <div>
                        <h3 class="text-lg font-bold text-white mb-3">Прогноз оплати</h3>
                        <input type="date" id="payment-forecast-${clientCode}" 
                               class="w-full bg-gray-700 text-white rounded border border-gray-600 p-3 mb-2"
                               value="${existingForecast?.forecastDate || ''}">
                        <input type="number" id="payment-amount-${clientCode}" 
                               class="w-full bg-gray-700 text-white rounded border border-gray-600 p-3"
                               placeholder="Сума очікуваної оплати"
                               value="${existingForecast?.forecastAmount || ''}">
                        ${existingForecast ? `<div class="text-xs text-gray-400 mt-1">Прогноз від: ${new Date(existingForecast.createdAt?.seconds * 1000).toLocaleDateString()}</div>` : ''}
                    </div>
                ` : existingForecast ? `
                    <div>
                        <h3 class="text-lg font-bold text-white mb-3">Прогноз оплати</h3>
                        <div class="w-full bg-gray-600 text-gray-300 rounded border border-gray-500 p-3 mb-2">
                            Дата: ${existingForecast.forecastDate || 'Не вказано'}
                        </div>
                        <div class="w-full bg-gray-600 text-gray-300 rounded border border-gray-500 p-3">
                            Сума: ${existingForecast.forecastAmount ? formatCurrency(existingForecast.forecastAmount) : 'Не вказано'}
                        </div>
                        <div class="text-xs text-gray-400 mt-1">Прогноз від: ${new Date(existingForecast.createdAt?.seconds * 1000).toLocaleDateString()}</div>
                    </div>
                ` : ''}
            </div>
            
            <div class="flex justify-end gap-4 mt-6">
                <button onclick="this.closest('.fixed').remove()" 
                        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    Закрити
                </button>
                ${window.hasPermission('debts_manage_comments') || window.hasPermission('debts_manage_forecasts') ? `
                    <button onclick="saveDebtComment('${clientCode}')" 
                            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Зберегти
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

/**
 * Сохранить комментарий по дебиторке
 */
window.saveDebtComment = async function(clientCode) {
    // Проверяем права доступа
    if (!window.hasPermission || (!window.hasPermission('debts_manage_comments') && !window.hasPermission('debts_manage_forecasts'))) {
        alert('У вас немає прав для збереження даних');
        return;
    }
    
    const comment = document.getElementById(`manager-comment-${clientCode}`)?.value || '';
    const forecastDate = document.getElementById(`payment-forecast-${clientCode}`)?.value || '';
    const forecastAmount = document.getElementById(`payment-amount-${clientCode}`)?.value || '';
    
    try {
        const companyId = window.state?.currentCompanyId;
        const userId = window.state?.currentUserId;
        
        if (!companyId) {
            alert('Помилка: Компанія не визначена');
            return;
        }
        
        // Сохраняем комментарий (если есть права)
        if (comment.trim() && window.hasPermission('debts_manage_comments')) {
            const commentData = {
                clientCode,
                comment: comment.trim(),
                updatedAt: firebase.serverTimestamp(),
                updatedBy: userId
            };
            
            await firebase.setDoc(
                firebase.doc(firebase.db, `companies/${companyId}/debtComments`, clientCode),
                commentData,
                { merge: true }
            );
        }
        
        // Сохраняем прогноз оплаты (если есть права)
        if (forecastDate && forecastAmount && window.hasPermission('debts_manage_forecasts')) {
            const forecastData = {
                clientCode,
                forecastDate,
                forecastAmount: parseFloat(forecastAmount),
                createdAt: firebase.serverTimestamp(),
                createdBy: userId
            };
            
            await firebase.setDoc(
                firebase.doc(firebase.db, `companies/${companyId}/paymentForecasts`, clientCode),
                forecastData,
                { merge: true }
            );
        }
        
        alert('Дані збережено!');
        document.querySelector('.fixed').remove();
        
        // Перезагружаем данные
        loadDebtsData();
        
    } catch (error) {
        console.error('Помилка збереження:', error);
        alert('Помилка збереження даних');
    }
};

/**
 * Экспорт в Excel
 */
window.exportDebtsToExcel = function() {
    // Проверяем права доступа
    if (!window.hasPermission || !window.hasPermission('debts_export')) {
        alert('У вас немає прав для експорту даних');
        return;
    }
    
    try {
        // Подготавливаем данные для экспорта
        const exportData = debtsData.map(debt => ({
            'Код клієнта': debt.clientCode,
            'Назва клієнта': debt.clientName,
            'Менеджер': debt.manager,
            'Відділ': debt.department,
            'Загальний борг': debt.totalDebt,
            'Прострочений борг': debt.overdueDebt,
            'Поточний борг': debt.currentDebt,
            'Днів прострочки': debt.daysOverdue,
            'Кількість договорів': debt.contracts?.length || debt.invoices?.length || 0
        }));
        
        // Создаем CSV контент
        const headers = Object.keys(exportData[0]);
        const csvContent = [
            headers.join(','),
            ...exportData.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Экранируем запятые и кавычки
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');
        
        // Создаем и скачиваем файл
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `debitorka_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Експорт завершено, записів:', exportData.length);
        
    } catch (error) {
        console.error('Помилка експорту:', error);
        alert('Помилка під час експорту даних');
    }
};

/**
 * Обновление данных
 */
window.refreshDebtsData = function() {
    loadDebtsData();
};

/**
 * Форматирование валюты
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Глобальный доступ к функции загрузки
window.loadDebtsData = loadDebtsData;