// debts.js - Модуль дебиторской задолженности
import * as firebase from './firebase.js';

let debtsData = [];
let managersData = [];
let departmentsData = [];
let clientCommentsData = [];
let paymentForecastsData = [];



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
        const managerNameFromAPI = item["Менеджер"];
        const debt = parseFloat(item["Долг"]) || 0;
        const contract = item["Договор"] || "Основний договір";
        
        if (!clientCode || debt === 0 || clientName === 'undefined' || !clientName) return; // Пропускаем записи без кода клиента, долга или некорректные данные
        
        // ВАЖНО: Ищем менеджера в Firebase данных, а не используем из API
        const managerFromFirebase = findManagerInFirebaseData(managerNameFromAPI);
        
        // Если менеджер не найден в Firebase, пропускаем эту запись
        if (!managerFromFirebase && managersData.length > 0) {
            console.log(`⚠️ Менеджер "${managerNameFromAPI}" не знайдений у Firebase, пропускаємо клієнта ${clientName}`);
            return;
        }
        
        const finalManagerName = managerFromFirebase ? managerFromFirebase.name : (managerNameFromAPI || 'Невизначений менеджер');
        
        const finalDepartment = managerFromFirebase ? getManagerDepartmentFromFirebase(managerFromFirebase) : 'Невизначений відділ';
        
        if (!clientsMap.has(clientCode)) {
            clientsMap.set(clientCode, {
                clientCode: clientCode || '',
                clientName: clientName || 'Невизначений клієнт',
                manager: finalManagerName,
                department: finalDepartment,
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
            manager: finalManagerName
        });
    });
    
    // Преобразуем Map в массив
    const result = Array.from(clientsMap.values()).map(client => ({
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
    
    console.log('📋 Преобразование API данных:');
    console.log('- Записей в API:', apiData.length);
    console.log('- Менеджеров в Firebase:', managersData.length);
    console.log('- Итоговых клиентов:', result.length);
    console.log('- Уникальных менеджеров в результате:', [...new Set(result.map(c => c.manager))]);
    
    return result;
}

/**
 * Поиск менеджера в Firebase данных по имени из API
 */
function findManagerInFirebaseData(managerNameFromAPI) {
    if (!managerNameFromAPI || managersData.length === 0 || managerNameFromAPI === 'undefined') return null;
    
    // Ищем точное совпадение по имени
    let manager = managersData.find(mgr => 
        mgr.name === managerNameFromAPI || 
        mgr.fullName === managerNameFromAPI ||
        (mgr.firstName && mgr.lastName && `${mgr.firstName} ${mgr.lastName}` === managerNameFromAPI)
    );
    
    if (manager) return manager;
    
    // Если точное совпадение не найдено, ищем частичное (по фамилии)
    const nameParts = managerNameFromAPI.split(' ').filter(part => part.trim());
    if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        const firstName = nameParts[0];
        
        manager = managersData.find(mgr => 
            mgr.name && mgr.name.includes(lastName) ||
            mgr.lastName === lastName ||
            mgr.fullName && mgr.fullName.includes(lastName) ||
            (mgr.firstName === firstName && mgr.lastName === lastName)
        );
    }
    
    // Дополнительные попытки для специальных имен
    if (!manager) {
        // Убираем префиксы типа "Менеджер", "ФОП" и т.д.
        const cleanName = managerNameFromAPI
            .replace(/^Менеджер\s+/i, '')
            .replace(/\s+ФОП$/i, '')
            .replace(/\s+потенційні\s+клієнти/i, '')
            .trim();
            
        if (cleanName !== managerNameFromAPI) {
            manager = managersData.find(mgr => 
                mgr.name && mgr.name.includes(cleanName) ||
                mgr.fullName && mgr.fullName.includes(cleanName)
            );
        }
    }
    
    return manager;
}

/**
 * Получение отдела менеджера из Firebase данных
 */
function getManagerDepartmentFromFirebase(manager) {
    if (!manager) return 'Невизначений відділ';
    
    // Если у менеджера есть departmentId, ищем отдел по ID
    if (manager.departmentId && departmentsData.length > 0) {
        const department = departmentsData.find(dept => dept.id === manager.departmentId);
        if (department) return department.name;
    }
    
    // Если есть поле department (объект)
    if (manager.department && typeof manager.department === 'object' && manager.department.name) {
        return manager.department.name;
    }
    
    // Если есть поле department (строка)
    if (manager.department && typeof manager.department === 'string') {
        // Ищем отдел по ID
        const department = departmentsData.find(dept => dept.id === manager.department);
        return department ? department.name : manager.department;
    }
    
    return 'Невизначений відділ';
}

/**
 * Получение отдела менеджера (УСТАРЕЛО - используйте getManagerDepartmentFromFirebase)
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
                    
                    // Показываем уведомление пользователю
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('Не вдалося завантажити дані з сервера. Модуль недоступний.', 'error');
                    }
                    
                    // Возвращаем пустой массив
                    return [];
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
        
        console.log('Завантажено записів дебіторки:', debtsData.length);
        console.log('Приклад даних:', debtsData[0]);
        console.log('✅ Завантажено дані з API');
        
        hideLoadingState();
        
        // ВАЖНО: Рендерим фильтры и обработчики ПОСЛЕ обработки всех данных
        console.log('🔧 Ініціалізація інтерфейсу...');
        console.log('📊 Стан даних перед рендерингом фільтрів:');
        console.log('- managersData.length:', managersData.length);
        console.log('- departmentsData.length:', departmentsData.length);
        console.log('- debtsData.length:', debtsData.length);
        
        renderDebtsFilters();        // Рендерит HTML фильтров
        
        // Небольшая задержка чтобы убедиться что все DOM элементы созданы
        setTimeout(() => {
            setupDebtsEventHandlers();   // Назначает обработчики
            console.log('✅ Обробники подій налаштовані з затримкою');
        }, 100);
        renderDebtsSummary(debtsData);
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
        console.log('- Departments доступно:', departmentsData.length);
        console.log('- Managers доступно:', managersData.length);
        console.log('Departments:', departmentsData.map(d => ({ id: d.id, name: d.name })));
        console.log('Managers:', managersData.map(m => ({ id: m.id, name: m.name, departmentId: m.departmentId })));
        
        departmentOptions = departmentsData.map(dept => 
            `<option value="${dept.id}">${dept.name}</option>`
        ).join('');
        
        // Получаем менеджеров из Firebase, фильтруем по выбранному отделу
        const selectedDepartment = document.getElementById('debts-department-filter')?.value || '';
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
        // Fallback: используем данные из долгов или демо данные
        console.log('⚠️ Fallback: Firebase дані недоступні');
        console.log('debtsData.length:', debtsData.length);
        
        if (debtsData.length > 0) {
            // Используем обработанные данные долгов
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
            
            console.log('✅ Фільтри з оброблених даних долгів');
        } else {
            // Нет данных - пустые фильтры
            console.log('⚠️ Немає даних для фільтрів');
            departmentOptions = '';
            managerOptions = '';
        }
    }
    
    filtersContainer.innerHTML = `
        <div class="bg-gray-700 rounded-lg p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Відділ:</label>
                                            <select id="debts-department-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="">Всі відділи</option>
                        ${departmentOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Менеджер:</label>
                    <select id="debts-manager-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="">Всі менеджери</option>
                        ${managerOptions}
                    </select>
                </div>
            </div>
        </div>
    `;
    
    // ✂️ УДАЛЕНО: Обработчики событий теперь устанавливаются только в setupDebtsEventHandlers()
}

/**
 * Обработчик, который будет вызываться при любом изменении фильтров.
 */
function handleFilterChange(event) {
    console.log(`🎯 Спрацював фільтр: ${event.target.id}, значення: ${event.target.value}`);
    
    // Получаем ссылки на оставшиеся фильтры
    const departmentFilterEl = document.getElementById('debts-department-filter');
    const managerFilterEl = document.getElementById('debts-manager-filter');
    
    // Если изменился фильтр отделов, нужно обновить список менеджеров
    if (event.target.id === 'debts-department-filter') {
        console.log('🏢 Оновлюємо список менеджерів...');
        updateManagersFilter(); // Эта функция может изменить managerFilterEl.value
    }
    
    // Собираем АКТУАЛЬНЫЕ значения ПОСЛЕ всех манипуляций
    const currentFilters = {
        department: departmentFilterEl.value,
        manager: managerFilterEl.value
    };
    
    // Передаем актуальные значения в applyFilters
    console.log('🔄 Застосовуємо фільтри з актуальними значеннями...', currentFilters);
    applyFilters(currentFilters);
}

/**
 * Установка обработчиков событий для фильтров (единый центр).
 */
function setupDebtsEventHandlers() {
    console.log('🔧 Налаштування єдиного обробника подій...');
    
    const departmentFilterEl = document.getElementById('debts-department-filter');
    const managerFilterEl = document.getElementById('debts-manager-filter');
    
    console.log('📋 Найденные элементы фильтров:', {
        department: !!departmentFilterEl,
        manager: !!managerFilterEl
    });
    
    const filters = [departmentFilterEl, managerFilterEl];
    
    filters.forEach(element => {
        if (element) {
            console.log(`🔧 Настройка ${element.id}...`);
            // Удаляем предыдущий обработчик, чтобы избежать дублирования
            element.removeEventListener('change', handleFilterChange);
            // Добавляем новый
            element.addEventListener('change', handleFilterChange);
            console.log(`✅ ${element.id}: обработчик change установлен`);
        } else {
            console.error(`❌ Элемент фильтра не найден:`, element);
        }
    });
    
    console.log('✅ Обробники подій "change" встановлені.');
    
    // ✂️ ТЕСТОВЫЙ БЛОК УДАЛЕН: больше никаких автоматических вызовов фильтрации
}

/**
 * Обновление фильтра менеджеров при изменении отдела
 */
function updateManagersFilter() {
    const departmentFilter = document.getElementById('debts-department-filter');
    const managerFilter = document.getElementById('debts-manager-filter');
    
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
 * @param {object} filters - Объект с текущими значениями фильтров
 */
function applyFilters(filters = {}) {
    console.log('🔍 =================== applyFilters ПОЧАТОК ===================');
    console.log('🔍 applyFilters викликано з debts.js');
    
    // Проверяем элементы фильтров (для обратной совместимости)
    const managerFilterEl = document.getElementById('debts-manager-filter');
    const departmentFilterEl = document.getElementById('debts-department-filter');
    
    console.log('📋 Елементи фільтрів знайдені:', {
        manager: !!managerFilterEl,
        department: !!departmentFilterEl
    });
    
    if (!managerFilterEl || !departmentFilterEl) {
        console.error('❌ Не всі елементи фільтрів знайдені! Виходимо з applyFilters');
        return;
    }
    
    // Получаем значения из аргументов, а если их нет — из DOM (для обратной совместимости)
    const managerFilter = filters.manager ?? managerFilterEl.value;
    const departmentFilter = filters.department ?? departmentFilterEl.value;
    
    console.log('📊 Актуальні значення фільтрів:', {
        manager: managerFilter,
        department: departmentFilter
    });
    
    console.log('📊 Джерело значень:', filters.manager !== undefined ? 'з параметрів' : 'з DOM');
    
    console.log('📊 Дані для фільтрації:', {
        'debtsData.length': debtsData.length,
        'managersData.length': managersData.length,
        'departmentsData.length': departmentsData.length
    });
    
    if (debtsData.length === 0) {
        console.warn('⚠️ debtsData порожній! Нічого фільтрувати');
        return;
    }
    
    let filteredData = [...debtsData];
    
    if (departmentsData.length > 0 && managersData.length > 0) {
        console.log('✅ Використовуємо Firebase фільтрацію');
        console.log('🔄 ВИПРАВЛЕННЯ: Послідовна фільтрація (спочатку відділ, потім менеджер)');
        
        // 1. СПОЧАТКУ фільтруємо по відділу, якщо він обраний
        // Це звужує список потенційних менеджерів
        if (departmentFilter) {
            console.log('🔍 Застосовуємо фільтр відділу:', departmentFilter);
            const selectedDepartment = departmentsData.find(dept => dept.id === departmentFilter);
            console.log('🔍 Знайдений відділ:', selectedDepartment);
            
            if (selectedDepartment) {
                console.log('🔍 Шукаємо менеджерів відділу...');
                const departmentManagersNames = managersData
                    .filter(manager => {
                        // Проверяем разные возможные поля для связи с отделом
                        const match1 = manager.departmentId === departmentFilter;
                        const match2 = manager.department === departmentFilter;
                        const match3 = manager.department && manager.department.id === departmentFilter;
                        const matches = match1 || match2 || match3;
                        
                        if (matches) {
                            console.log(`🔍 Менеджер ${manager.name} належить відділу (${match1 ? 'departmentId' : match2 ? 'department' : 'department.id'})`);
                        }
                        
                        return matches;
                    })
                    .map(manager => manager.name);
                
                console.log('🔍 Менеджери відділу:', departmentManagersNames);
                const beforeCount = filteredData.length;
                filteredData = filteredData.filter(debt => departmentManagersNames.includes(debt.manager));
                console.log(`✅ Department filter: ${beforeCount} → ${filteredData.length} записів після фільтрації по відділу`);
            } else {
                console.error('❌ Відділ не знайдений за ID:', departmentFilter);
            }
        }
        
        // 2. ПОТІМ, якщо обраний конкретний менеджер, фільтруємо ЩЕ РАЗ
        // Цей фільтр буде застосований до даних, вже відфільтрованих по відділу (або до повного списку, якщо відділ не було обрано)
        if (managerFilter) {
            console.log('🔍 Застосовуємо фільтр менеджера:', managerFilter);
            const selectedManager = managersData.find(m => m.id === managerFilter);
            console.log('🔍 Знайдений менеджер:', selectedManager);
            console.log('🔍 Всі менеджери:', managersData.map(m => ({id: m.id, name: m.name})));
            
            if (selectedManager) {
                const beforeCount = filteredData.length;
                console.log('🔍 Фільтруємо по імені менеджера:', selectedManager.name);
                console.log('🔍 Приклад імен менеджерів в поточних даних:', [...new Set(filteredData.map(d => d.manager))]);
                
                filteredData = filteredData.filter(d => {
                    const matches = d.manager === selectedManager.name;
                    if (!matches && filteredData.length < 10) { // Логуємо тільки якщо даних небагато
                        console.log(`🔍 НЕ збігається: "${d.manager}" !== "${selectedManager.name}"`);
                    }
                    return matches;
                });
                console.log(`✅ Manager filter: ${beforeCount} → ${filteredData.length} записів після фільтрації по менеджеру`);
            } else {
                console.error('❌ Менеджер не знайдений за ID:', managerFilter);
            }
        }
    } else {
        // Fallback: используем данные из API долгов (прямое сравнение по названиям)
        console.log('⚠️ Використовуємо Fallback фільтрацію (послідовно: відділ → менеджер)');
        
        // 1. Сначала фильтруем по отделу
        if (departmentFilter) {
            const beforeCount = filteredData.length;
            filteredData = filteredData.filter(d => d.department === departmentFilter);
            console.log(`Fallback department filter: ${beforeCount} → ${filteredData.length} записів після фільтрації по відділу`);
        }
        
        // 2. Затем фильтруем по менеджеру (из уже отфильтрованных данных)
        if (managerFilter) {
            const beforeCount = filteredData.length;
            filteredData = filteredData.filter(d => d.manager === managerFilter);
            console.log(`Fallback manager filter: ${beforeCount} → ${filteredData.length} записів після фільтрації по менеджеру`);
        }
    }
    
    // Убрана фильтрация по типу долга и сортировка
    // Используется стандартная сортировка по убыванию общего долга
    filteredData.sort((a, b) => b.totalDebt - a.totalDebt);
    
    console.log('🎯 Фінальний результат фільтрації:', {
        'початкових записів': debtsData.length,
        'після фільтрації': filteredData.length,
        'фільтри': { managerFilter, departmentFilter }
    });
    
    renderDebtsSummary(filteredData);
    renderDebtsGroupedByManager(filteredData);
    
    console.log('🔍 =================== applyFilters КІНЕЦЬ ===================');
}

/**
 * Рендеринг сводки
 */
function renderDebtsSummary(data = debtsData) {
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
    console.log('🎨 =================== RENDER DEBTS START ===================');
    console.log('🎨 renderDebtsGroupedByManager викликано з даними:', {
        'data.length': data.length,
        'перші 3 записи': data.slice(0, 3),
        'унікальні менеджери': [...new Set(data.map(d => d.manager))]
    });
    
    const contentContainer = document.getElementById('debts-content-container');
    if (!contentContainer) {
        console.error('❌ debts-content-container не знайдений!');
        return;
    }
    
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
            ${sortedManagers.map((managerGroup, index) => {
                // Создаем уникальный ID для каждого менеджера используя индекс
                const uniqueId = `manager_${index}_${(managerGroup.manager || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}`;
                return `
                <div class="bg-gray-700 rounded-lg overflow-hidden">
                    <div class="bg-gray-800 p-4 cursor-pointer hover:bg-gray-750" onclick="toggleManagerGroup('${uniqueId}')">
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
                                    <span id="arrow-${uniqueId}">▼</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="clients-${uniqueId}" class="hidden">
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
                `;
            }).join('')}
        </div>
    `;
    
    console.log('🎨 Рендеринг завершено:', {
        'менеджерів відображено': Object.keys(groupedByManager).length,
        'загальна кількість клієнтів': data.length
    });
    console.log('🎨 =================== RENDER DEBTS END ===================');
}

/**
 * Переключение видимости группы клиентов менеджера
 */
window.toggleManagerGroup = function(uniqueId) {
    console.log('🔄 toggleManagerGroup викликано для:', uniqueId);
    const clientsDiv = document.getElementById(`clients-${uniqueId}`);
    const arrow = document.getElementById(`arrow-${uniqueId}`);
    
    console.log('Elements found:', { clientsDiv: !!clientsDiv, arrow: !!arrow });
    
    if (clientsDiv && arrow) {
        if (clientsDiv.classList.contains('hidden')) {
            clientsDiv.classList.remove('hidden');
            arrow.textContent = '▲';
            console.log('✅ Список клієнтів розкрито');
        } else {
            clientsDiv.classList.add('hidden');
            arrow.textContent = '▼';
            console.log('✅ Список клієнтів згорнуто');
        }
    } else {
        console.error('❌ Не знайдено елементи для', uniqueId);
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

// Глобальный доступ к функциям
window.loadDebtsData = loadDebtsData;
window.applyDebtsFilters = applyFilters;
window.setupDebtsEventHandlers = setupDebtsEventHandlers;

// Функция для тестирования фильтров из консоли
window.testDebtsFilters = function() {
    console.log('🧪 Тестирование фильтров дебиторки...');
    
    // Проверяем наличие элементов
    const elements = {
        department: document.getElementById('debts-department-filter'),
        manager: document.getElementById('debts-manager-filter')
    };
    
    console.log('📋 Элементы фильтров:', elements);
    
    // Проверяем значения
    Object.keys(elements).forEach(key => {
        const el = elements[key];
        if (el) {
            console.log(`📊 ${key}: value="${el.value}", options=${el.options.length}`);
        }
    });
    
    // Принудительно вызываем фильтрацию
    console.log('🔄 Принудительный вызов applyFilters...');
    applyFilters();
    
    // Переустанавливаем обработчики
    console.log('🔧 Переустановка обработчиков...');
    setupDebtsEventHandlers();
};

// Функция для ручного тестирования событий фильтров
window.testFilterEvents = function() {
    console.log('🧪 =================== ТЕСТ СОБЫТИЙ ФИЛЬТРОВ ===================');
    
    const managerFilter = document.getElementById('debts-manager-filter');
    const departmentFilter = document.getElementById('debts-department-filter');
    
    if (managerFilter) {
        console.log('🧪 Тестируем manager-filter change event...');
        console.log('🧪 Текущее значение:', managerFilter.value);
        
        const event = new Event('change', { bubbles: true, cancelable: true });
        managerFilter.dispatchEvent(event);
    }
    
    if (departmentFilter) {
        console.log('🧪 Тестируем department-filter change event...');
        console.log('🧪 Текущее значение:', departmentFilter.value);
        
        const event = new Event('change', { bubbles: true, cancelable: true });
        departmentFilter.dispatchEvent(event);
    }
    
    console.log('🧪 =================== ТЕСТ СОБЫТИЙ ЗАВЕРШЕН ===================');
};

// Функция для тестирования фильтрации с реальными значениями
window.testRealFiltering = function() {
    console.log('🧪 =================== ТЕСТ РЕАЛЬНОЙ ФИЛЬТРАЦИИ ===================');
    
    const departmentFilter = document.getElementById('debts-department-filter');
    const managerFilter = document.getElementById('debts-manager-filter');
    
    if (departmentFilter && departmentFilter.options.length > 1) {
        // Выбираем первый отдел (не "Всі відділи")
        departmentFilter.selectedIndex = 1;
        console.log('🧪 Устанавливаем отдел:', departmentFilter.value);
        
        const deptEvent = new Event('change', { bubbles: true });
        departmentFilter.dispatchEvent(deptEvent);
        
        // Ждем 500ms и выбираем менеджера
        setTimeout(() => {
            if (managerFilter && managerFilter.options.length > 1) {
                managerFilter.selectedIndex = 1;
                console.log('🧪 Устанавливаем менеджера:', managerFilter.value);
                
                const mgrEvent = new Event('change', { bubbles: true });
                managerFilter.dispatchEvent(mgrEvent);
            }
        }, 500);
    } else {
        console.error('❌ Фильтры не найдены или пусты');
    }
    
    console.log('🧪 =================== ТЕСТ ЗАПУЩЕН ===================');
};