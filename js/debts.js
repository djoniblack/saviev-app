// debts.js - Модуль дебиторской задолженности
import * as firebase from './firebase.js';

let debtsData = [];
let managersData = [];
let departmentsData = [];
let clientCommentsData = [];
let paymentForecastsData = [];
let clientLinksData = {}; // Ссылки на клиентов в CRM

// === АВТООБНОВЛЕНИЕ ===
let autoUpdateInterval = null;
let lastUpdateTime = null;
let lastDataHash = null;
let isAutoUpdateEnabled = true;
let isUpdateInProgress = false;
const AUTO_UPDATE_INTERVAL = 15 * 60 * 1000; // 15 минут

/**
 * Вычисляет хеш массива данных для определения изменений
 */
function calculateDataHash(data) {
    if (!Array.isArray(data)) return '';
    const dataString = JSON.stringify(data.map(d => ({
        clientCode: d["Клиент.Код"] || d["Главный контрагент.Код"],
        debt: d["Долг"],
        manager: d["Менеджер"]
    })).sort((a, b) => a.clientCode.localeCompare(b.clientCode)));
    
    // Простая хеш-функция
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Конвертируем в 32-битное число
    }
    return hash.toString();
}

/**
 * Запуск автообновления
 */
function startAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
    
    console.log('🔄 Автообновление запущено (интервал: 15 мин)');
    updateAutoUpdateStatus('Автообновление активно', 'text-green-400');
    
    autoUpdateInterval = setInterval(async () => {
        if (isAutoUpdateEnabled && !isUpdateInProgress) {
            await checkForUpdates();
        }
    }, AUTO_UPDATE_INTERVAL);
}

/**
 * Остановка автообновления
 */
function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
    }
    console.log('⏸️ Автообновление остановлено');
    updateAutoUpdateStatus('Автообновление отключено', 'text-gray-400');
}

/**
 * Проверка наличия обновлений
 */
async function checkForUpdates() {
    if (isUpdateInProgress) return;
    
    isUpdateInProgress = true;
    updateAutoUpdateStatus('Проверка обновлений...', 'text-blue-400');
    
    try {
        console.log('🔍 Проверка обновлений данных...');
        
        // Загружаем только данные с API (без Firebase)
        const response = await fetch('https://fastapi.lookfort.com/company.debt');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const newApiData = await response.json();
        const newDataHash = calculateDataHash(newApiData);
        
        console.log('📊 Сравнение данных:', {
            'старый хеш': lastDataHash,
            'новый хеш': newDataHash,
            'есть изменения': lastDataHash !== newDataHash
        });
        
        if (lastDataHash !== newDataHash) {
            console.log('🆕 Обнаружены новые данные! Обновление...');
            
            // Показываем уведомление
            showUpdateNotification('Обнаружены новые данные! Обновление...');
            
            // Сохраняем исходные данные
            window.originalDebtsData = newApiData;
            
            // Обновляем данные
            debtsData = transformApiDataToInternalFormat(newApiData);
            calculateOverdueDebts();
            
            // Обновляем интерфейс
            applyFilters();
            
            // Обновляем хеш и время
            lastDataHash = newDataHash;
            lastUpdateTime = new Date();
            
            console.log('✅ Данные успешно обновлены');
            showUpdateNotification('Данные обновлены!', 'success');
            updateAutoUpdateStatus(`Обновлено: ${lastUpdateTime.toLocaleTimeString()}`, 'text-green-400');
        } else {
            console.log('📄 Данные не изменились');
            updateAutoUpdateStatus(`Проверено: ${new Date().toLocaleTimeString()}`, 'text-gray-400');
        }
        
    } catch (error) {
        console.error('❌ Ошибка при проверке обновлений:', error);
        updateAutoUpdateStatus('Ошибка обновления', 'text-red-400');
    } finally {
        isUpdateInProgress = false;
    }
}

/**
 * Показать уведомление об обновлении
 */
function showUpdateNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-600' : 
        type === 'error' ? 'bg-red-600' : 'bg-blue-600'
    } text-white`;
    
    notification.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="text-sm font-medium">${message}</div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    class="text-white hover:text-gray-200 ml-2">✕</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически убираем через 3 секунды
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

/**
 * Обновить статус автообновления в интерфейсе
 */
function updateAutoUpdateStatus(text, colorClass) {
    const statusElement = document.getElementById('auto-update-status');
    if (statusElement) {
        statusElement.textContent = text;
        statusElement.className = `text-xs ${colorClass}`;
    }
}

/**
 * Переключение автообновления
 */
window.toggleAutoUpdate = function() {
    isAutoUpdateEnabled = !isAutoUpdateEnabled;
    
    const button = document.getElementById('auto-update-toggle');
    const menuButton = document.getElementById('auto-update-toggle-menu');
    const icon = document.getElementById('auto-update-icon');
    
    if (isAutoUpdateEnabled) {
        // Обновляем основную кнопку (если есть)
        if (button) {
            button.className = 'px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm';
            button.innerHTML = '🔄 Авто';
        }
        
        // Обновляем кнопку в меню
        if (menuButton) {
            menuButton.className = 'w-full flex items-center gap-3 px-3 py-2 text-white rounded bg-green-600 hover:bg-green-700 transition-colors text-left';
            menuButton.innerHTML = `
                <span class="text-lg">🔄</span>
                <div>
                    <div class="font-medium">Авто оновлення <span class="text-xs bg-green-400 text-green-900 px-1 rounded">ВКЛ</span></div>
                    <div class="text-xs text-green-200">Автоматичне оновлення активне</div>
                </div>
            `;
        }
        
        if (!autoUpdateInterval) startAutoUpdate();
        updateAutoUpdateStatus('Автообновление включено', 'text-green-400');
    } else {
        // Обновляем основную кнопку (если есть)
        if (button) {
            button.className = 'px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm';
            button.innerHTML = '⏸️ Авто';
        }
        
        // Обновляем кнопку в меню
        if (menuButton) {
            menuButton.className = 'w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-green-600 transition-colors text-left';
            menuButton.innerHTML = `
                <span class="text-lg">⏸️</span>
                <div>
                    <div class="font-medium">Авто оновлення <span class="text-xs bg-gray-500 text-gray-200 px-1 rounded">ВИКЛ</span></div>
                    <div class="text-xs text-gray-400">Переключити режим</div>
                </div>
            `;
        }
        
        updateAutoUpdateStatus('Автообновление отключено', 'text-gray-400');
    }
    
    console.log('🔄 Автообновление:', isAutoUpdateEnabled ? 'включено' : 'отключено');
};

/**
 * Принудительное обновление
 */
window.forceUpdate = function() {
    if (!isUpdateInProgress) {
        checkForUpdates();
    }
};

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
                <!-- Бургер меню -->
                <div class="relative">
                    <!-- Бургер кнопка -->
                    <button id="debts-burger-btn" onclick="toggleDebtsBurgerMenu()" 
                            class="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors">
                        <div class="flex flex-col gap-1">
                            <div class="w-5 h-0.5 bg-white transition-all duration-300" id="burger-line-1"></div>
                            <div class="w-5 h-0.5 bg-white transition-all duration-300" id="burger-line-2"></div>
                            <div class="w-5 h-0.5 bg-white transition-all duration-300" id="burger-line-3"></div>
                        </div>
                        <span class="text-sm font-medium">Дії</span>
                        <svg class="w-4 h-4 transition-transform duration-300" id="burger-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                    
                    <!-- Выпадающее меню -->
                    <div id="debts-burger-menu" class="absolute right-0 top-full mt-2 w-64 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-50 hidden">
                        <div class="p-2">
                            <div class="mb-2">
                                <div class="text-xs text-gray-400 px-3 py-1 font-medium uppercase tracking-wide">Управління даними</div>
                            </div>
                            
                    ${window.hasPermission('debts_export') ? `
                                <button onclick="exportDebtsToExcel(); toggleDebtsBurgerMenu();" 
                                        class="w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-green-600 transition-colors text-left">
                                    <span class="text-lg">📊</span>
                                    <div>
                                        <div class="font-medium">Експорт Excel</div>
                                        <div class="text-xs text-gray-400">Завантажити звіт</div>
                                    </div>
                        </button>
                    ` : ''}
                            
                            <button onclick="refreshDebtsData(); toggleDebtsBurgerMenu();" 
                                    class="w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-blue-600 transition-colors text-left">
                                <span class="text-lg">🔄</span>
                                <div>
                                    <div class="font-medium">Оновити</div>
                                    <div class="text-xs text-gray-400">Перезавантажити дані</div>
                                </div>
                    </button>
                            
                            <div class="border-t border-gray-600 my-2"></div>
                            <div class="mb-2">
                                <div class="text-xs text-gray-400 px-3 py-1 font-medium uppercase tracking-wide">Автоматизація</div>
                            </div>
                            
                            <button id="auto-update-toggle-menu" onclick="toggleAutoUpdate()" 
                                    class="w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-green-600 transition-colors text-left">
                                <span class="text-lg">🔄</span>
                                <div>
                                    <div class="font-medium">Авто оновлення</div>
                                    <div class="text-xs text-gray-400">Переключити режим</div>
                                </div>
                            </button>
                            
                            <button onclick="forceUpdate()" 
                                    class="w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-orange-600 transition-colors text-left">
                                <span class="text-lg">⚡</span>
                                <div>
                                    <div class="font-medium">Зараз</div>
                                    <div class="text-xs text-gray-400">Примусове оновлення</div>
                                </div>
                            </button>
                            
                            <div class="border-t border-gray-600 my-2"></div>
                            <div class="mb-2">
                                <div class="text-xs text-gray-400 px-3 py-1 font-medium uppercase tracking-wide">Діагностика</div>
                            </div>
                            
                            <button onclick="reinitializeDebtsFilters()" 
                                    class="w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-yellow-600 transition-colors text-left">
                                <span class="text-lg">🔧</span>
                                <div>
                                    <div class="font-medium">Фікс</div>
                                    <div class="text-xs text-gray-400">Виправити фільтри</div>
                                </div>
                            </button>
                            
                            <button onclick="debugDebtsPermissions()" 
                                    class="w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-purple-600 transition-colors text-left">
                                <span class="text-lg">🔍</span>
                                <div>
                                    <div class="font-medium">Права</div>
                                    <div class="text-xs text-gray-400">Перевірити доступ</div>
                                </div>
                            </button>
                            
                            <button onclick="debugDebtsData()" 
                                    class="w-full flex items-center gap-3 px-3 py-2 text-white rounded hover:bg-indigo-600 transition-colors text-left">
                                <span class="text-lg">📊</span>
                                <div>
                                    <div class="font-medium">Дані</div>
                                    <div class="text-xs text-gray-400">Перевірити завантаження</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="mt-2">
                    <div id="auto-update-status" class="text-xs text-gray-400">Автообновление инициализируется...</div>
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
    
    console.log('🔄 transformApiDataToInternalFormat:', apiData.length, 'записів від API');
    let processedCount = 0;
    let skippedCount = 0;
    
    // Группируем данные по клиентам
    const clientsMap = new Map();
    
    apiData.forEach(item => {
        const clientCode = item["Клиент.Код"] || item["Главный контрагент.Код"];
        const clientName = item["Клиент"] || item["Главный контрагент"];
        const managerNameFromAPI = item["Менеджер"];
        const debt = parseFloat(item["Долг"]) || 0;
        const contract = item["Договор"] || "Основний договір";
        
        if (!clientCode || debt === 0 || clientName === 'undefined' || !clientName) {
            skippedCount++;
            return; // Пропускаем записи без кода клиента, долга или некорректные данные
        }
        
        // ВАЖНО: Ищем менеджера в Firebase данных, а не используем из API
        const managerFromFirebase = findManagerInFirebaseData(managerNameFromAPI);
        
        // Если менеджер не найден в Firebase, пропускаем эту запись
        if (!managerFromFirebase && managersData.length > 0) {
            console.log(`⚠️ Менеджер "${managerNameFromAPI}" не знайдений у Firebase, пропускаємо клієнта ${clientName}`);
            skippedCount++;
            return;
        }
        
        processedCount++;
        
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
    console.log('- Оброблено записів:', processedCount);
    console.log('- Пропущено записів:', skippedCount);
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
 * Рассчитывает просроченный долг для каждого клиента
 * Логика: если есть прогнозная дата и сегодня > прогноза - долг просрочен
 * Если прогноза нет - используем стандартный срок 30 дней от создания счета
 */
function calculateOverdueDebts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Обнуляем время для корректного сравнения дат
    
    debtsData.forEach(client => {
        let overdueAmount = 0;
        let currentAmount = 0;
        let maxDaysOverdue = 0;
        
        // Ищем прогноз оплаты для клиента
        const forecast = paymentForecastsData.find(f => f.clientCode === client.clientCode);
        
        if (forecast && forecast.forecastDate) {
            // Если есть прогноз - используем его
            const forecastDate = new Date(forecast.forecastDate);
            forecastDate.setHours(0, 0, 0, 0);
            
            if (today > forecastDate) {
                // Прогноз просрочен - весь долг считаем просроченным
                overdueAmount = client.totalDebt;
                currentAmount = 0;
                
                // Рассчитываем дни просрочки
                const timeDiff = today.getTime() - forecastDate.getTime();
                maxDaysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            } else {
                // Прогноз еще не наступил - долг текущий
                overdueAmount = 0;
                currentAmount = client.totalDebt;
                maxDaysOverdue = 0;
            }
        } else {
            // Если прогноза нет - используем стандартную логику
            // Анализируем каждый счет/договор
            client.invoices?.forEach(invoice => {
                const dueDate = new Date(invoice.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                
                if (today > dueDate) {
                    // Счет просрочен
                    overdueAmount += invoice.amount;
                    
                    // Рассчитываем дни просрочки для этого счета
                    const timeDiff = today.getTime() - dueDate.getTime();
                    const daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                    maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
                } else {
                    // Счет текущий
                    currentAmount += invoice.amount;
                }
            });
            
            // Если нет счетов, считаем весь долг текущим
            if (!client.invoices || client.invoices.length === 0) {
                currentAmount = client.totalDebt;
                overdueAmount = 0;
                maxDaysOverdue = 0;
            }
        }
        
        // Обновляем данные клиента
        client.overdueDebt = overdueAmount;
        client.currentDebt = currentAmount;
        client.daysOverdue = maxDaysOverdue;
        
        // Обновляем статус счетов
        if (client.invoices) {
            client.invoices.forEach(invoice => {
                const dueDate = new Date(invoice.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                
                if (forecast && forecast.forecastDate) {
                    // Если есть прогноз - используем его для всех счетов
                    const forecastDate = new Date(forecast.forecastDate);
                    forecastDate.setHours(0, 0, 0, 0);
                    invoice.status = today > forecastDate ? 'overdue' : 'current';
                } else {
                    // Иначе используем дату счета
                    invoice.status = today > dueDate ? 'overdue' : 'current';
                }
            });
        }
    });
    
    console.log('🧮 Розрахунок простроченого боргу завершено:', {
        'клієнтів з прогнозами': paymentForecastsData.length,
        'клієнтів з простроченим боргом': debtsData.filter(d => d.overdueDebt > 0).length,
        'загалом клієнтів': debtsData.length
    });
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
                }),
            
            // Загружаем ссылки на клиентов в CRM
            fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url')
                .then(response => {
                    console.log('🔗 API посилання клієнтів статус:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('🔗 API посилання отримано:', Array.isArray(data) ? `${data.length} записів` : typeof data);
                    if (Array.isArray(data) && data.length > 0) {
                        console.log('🔗 Приклад запису посилання:', data[0]);
                        // Создаем объект {код_клиента: ссылка}
                        const linksMap = {};
                        data.forEach(item => {
                            if (item['Клиент.Код'] && item['посилання']) {
                                linksMap[item['Клиент.Код']] = item['посилання'];
                            }
                        });
                        return linksMap;
                    }
                    return {};
                })
                .catch(error => {
                    console.error('❌ Помилка завантаження посилань клієнтів:', error);
                    return {}; // Возвращаем пустой объект при ошибке
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
        const apiClientLinks = results[1];
        
        // Сохраняем ссылки на клиентов
        clientLinksData = apiClientLinks;
        console.log('🔗 Збережено посилань на клієнтів:', Object.keys(clientLinksData).length);
        
        if (companyId && results.length > 2) {
            const [, , employeesSnap, departmentsSnap, commentsSnap, forecastsSnap] = results;
            
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
        
        // Сохраняем исходные данные API для функции showDebtDetails
        window.originalDebtsData = apiDebtsData;
        console.log('💾 Збережено originalDebtsData:', apiDebtsData.length, 'записів');
        
        // Преобразуем данные API в нужный формат
        debtsData = transformApiDataToInternalFormat(apiDebtsData);
        
        // ВАЖНО: Рассчитываем просроченный долг после загрузки прогнозов
        calculateOverdueDebts();
        
        // Инициализируем автообновление
        lastDataHash = calculateDataHash(apiDebtsData);
        lastUpdateTime = new Date();
        
        console.log('Завантажено записів дебіторки:', debtsData.length);
        console.log('Приклад даних:', debtsData[0]);
        console.log('✅ Завантажено дані з API');
        console.log('📊 Ініціалізовано хеш даних:', lastDataHash);
        
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
            
            // Запускаем автообновление после инициализации интерфейса
            if (isAutoUpdateEnabled) {
                startAutoUpdate();
            }
            updateAutoUpdateStatus(`Останнє оновлення: ${lastUpdateTime.toLocaleTimeString()}`, 'text-green-400');
        }, 100);
        renderDebtsSummary(debtsData);
        renderDebtsGroupedByManager();
        
        // Добавляем обработчик очистки при закрытии страницы
        window.addEventListener('beforeunload', () => {
            cleanupDebtsModule();
        });
        
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
    console.log('🎯 =================== FILTER CHANGE START ===================');
    console.log(`🎯 Спрацював фільтр: ${event.target.id}, значення: "${event.target.value}"`);
    
    // Получаем ссылки на оставшиеся фильтры
    const departmentFilterEl = document.getElementById('debts-department-filter');
    const managerFilterEl = document.getElementById('debts-manager-filter');
    
    console.log('📋 Стан фільтрів до обробки:', {
        department: departmentFilterEl?.value || 'не знайдено',
        manager: managerFilterEl?.value || 'не знайдено',
        'department options': departmentFilterEl?.options.length || 0,
        'manager options': managerFilterEl?.options.length || 0
    });
    
    // Если изменился фильтр отделов, нужно обновить список менеджеров
    if (event.target.id === 'debts-department-filter') {
        console.log('🏢 Змінився відділ - оновлюємо список менеджерів...');
        
        // Сначала сбрасываем выбор менеджера
        if (managerFilterEl) {
            managerFilterEl.value = '';
            console.log('🔄 Скинули вибір менеджера перед оновленням списку');
        }
        
        updateManagersFilter(); // Эта функция обновит список менеджеров
        
        console.log('📋 Стан після оновлення менеджерів:', {
            'manager options': managerFilterEl?.options.length || 0,
            'manager value': managerFilterEl?.value || 'порожньо'
        });
    }
    
    // Небольшая задержка чтобы убедиться что DOM обновился
    setTimeout(() => {
    // Собираем АКТУАЛЬНЫЕ значения ПОСЛЕ всех манипуляций
    const currentFilters = {
            department: departmentFilterEl?.value || '',
            manager: managerFilterEl?.value || ''
    };
    
        console.log('🔄 Застосовуємо фільтри з актуальними значеннями:', currentFilters);
    applyFilters(currentFilters);
        console.log('🎯 =================== FILTER CHANGE END ===================');
    }, 50);
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
    console.log('🔄 updateManagersFilter викликано');
    
    const departmentFilter = document.getElementById('debts-department-filter');
    const managerFilter = document.getElementById('debts-manager-filter');
    
    if (!departmentFilter || !managerFilter) {
        console.error('❌ Не знайдено елементи фільтрів');
        return;
    }
    
    const selectedDepartment = departmentFilter.value;
    const currentManager = managerFilter.value;
    
    console.log('📊 Поточні значення:', {
        selectedDepartment,
        currentManager,
        'departmentsData.length': departmentsData.length,
        'managersData.length': managersData.length,
        'debtsData.length': debtsData.length
    });
    
    let managerOptions = '';
    let filteredManagers = [];
    
    if (departmentsData.length > 0 && managersData.length > 0) {
        console.log('✅ Використовуємо Firebase дані для оновлення менеджерів');
        
        // Используем данные из Firebase
        if (selectedDepartment) {
            filteredManagers = managersData.filter(manager => {
                // Проверяем разные возможные поля для связи с отделом
                const match1 = manager.departmentId === selectedDepartment;
                const match2 = manager.department === selectedDepartment;
                const match3 = manager.department && manager.department.id === selectedDepartment;
                
                return match1 || match2 || match3;
            });
            console.log(`🔍 Знайдено ${filteredManagers.length} менеджерів для відділу ${selectedDepartment}`);
        } else {
            filteredManagers = [...managersData];
            console.log('📋 Показуємо всіх менеджерів');
        }
        
        managerOptions = filteredManagers.map(manager => 
            `<option value="${manager.id}">${manager.name}</option>`
        ).join('');
        
        // Сбрасываем выбор менеджера если он не входит в новый отдел
        if (currentManager && !filteredManagers.find(m => m.id === currentManager)) {
            console.log('🔄 Скидаємо вибір менеджера (не належить новому відділу)');
            managerFilter.value = '';
        }
    } else {
        console.log('⚠️ Використовуємо Fallback дані з долгів');
        
        // Fallback: фільтруем менеджеров по отделу из данных долгов
        let managersInDepartment = [];
        if (selectedDepartment) {
            managersInDepartment = [...new Set(debtsData.filter(d => d.department === selectedDepartment).map(d => d.manager))];
            console.log(`🔍 Знайдено ${managersInDepartment.length} менеджерів для відділу ${selectedDepartment} з даних долгів`);
        } else {
            managersInDepartment = [...new Set(debtsData.map(d => d.manager))];
            console.log('📋 Показуємо всіх менеджерів з даних долгів');
        }
        
        managerOptions = managersInDepartment.filter(Boolean).map(manager => 
            `<option value="${manager}">${manager}</option>`
        ).join('');
        
        // Сбрасываем выбор менеджера если он не входит в новый отдел
        if (currentManager && !managersInDepartment.includes(currentManager)) {
            console.log('🔄 Скидаємо вибір менеджера (Fallback)');
            managerFilter.value = '';
        }
    }
    
    // Обновляем HTML фильтра менеджеров
    const newHTML = `
        <option value="">Всі менеджери</option>
        ${managerOptions}
    `;
    
    console.log('🔄 Оновлюємо HTML фільтра менеджерів, опцій:', managerOptions.split('</option>').length - 1);
    managerFilter.innerHTML = newHTML;
    
    console.log('✅ updateManagersFilter завершено');
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
    
    // Разделяем клиентов на категории
    const debtClients = data.filter(d => d.totalDebt > 0); // Должники
    const overpayClients = data.filter(d => d.totalDebt < 0); // Переплаты
    const zeroClients = data.filter(d => d.totalDebt === 0); // Нулевые (не показываем)
    
    // Расчеты для должников
    const totalDebt = debtClients.reduce((sum, d) => sum + d.totalDebt, 0);
    const overdueDebt = debtClients.reduce((sum, d) => sum + d.overdueDebt, 0);
    const currentDebt = debtClients.reduce((sum, d) => sum + d.currentDebt, 0);
    const debtClientsCount = debtClients.length;
    const overdueClientsCount = debtClients.filter(d => d.overdueDebt > 0).length;
    
    // Расчеты для переплат
    const totalOverpay = Math.abs(overpayClients.reduce((sum, d) => sum + d.totalDebt, 0));
    const overpayClientsCount = overpayClients.length;
    
    // Средняя просрочка только для должников
    const avgDaysOverdue = debtClients.filter(d => d.daysOverdue > 0).reduce((sum, d) => sum + d.daysOverdue, 0) / 
                          (debtClients.filter(d => d.daysOverdue > 0).length || 1);
    
    summaryContainer.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <!-- Блок долгів -->
            <div class="md:col-span-2 bg-gradient-to-r from-red-600 to-red-700 rounded-lg p-4">
                <h3 class="text-lg font-bold text-white mb-2">🔴 Заборгованості</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-2xl font-bold text-white">${debtClientsCount}</div>
                        <div class="text-sm text-red-200">Клієнтів-боржників</div>
            </div>
                    <div>
                <div class="text-2xl font-bold text-white">${formatCurrency(totalDebt)}</div>
                        <div class="text-sm text-red-200">Загальний борг</div>
            </div>
                </div>
            </div>
            
            <!-- Блок переплат -->
            <div class="md:col-span-2 bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4">
                <h3 class="text-lg font-bold text-white mb-2">🟢 Переплати</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-2xl font-bold text-white">${overpayClientsCount}</div>
                        <div class="text-sm text-green-200">Клієнтів з переплатою</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-white">${formatCurrency(totalOverpay)}</div>
                        <div class="text-sm text-green-200">Сума переплат</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <!-- Детали по долгам -->
            <div class="bg-red-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${formatCurrency(overdueDebt)}</div>
                <div class="text-sm text-red-200">Прострочений борг</div>
            </div>
            <div class="bg-blue-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${formatCurrency(currentDebt)}</div>
                <div class="text-sm text-blue-200">Поточний борг</div>
            </div>
            <div class="bg-orange-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${overdueClientsCount}</div>
                <div class="text-sm text-orange-200">Прострочені клієнти</div>
            </div>
            <div class="bg-purple-600 rounded-lg p-4">
                <div class="text-2xl font-bold text-white">${Math.round(avgDaysOverdue)}</div>
                <div class="text-sm text-purple-200">Середня прострочка</div>
            </div>
        </div>
        
        ${zeroClients.length > 0 ? `
            <div class="mt-4 p-3 bg-gray-700 rounded-lg">
                <div class="text-sm text-gray-400">
                    📊 Клієнтів з нульовим балансом: <span class="font-bold text-white">${zeroClients.length}</span> (не враховуються в розрахунках)
                </div>
            </div>
        ` : ''}
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
                                    ${hasComment?.isOldDebt ? '<div class="text-xs text-orange-400">🕰️ Стара заборгованість</div>' : ''}
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
                                    <div class="flex gap-2 justify-center">
                                    <button onclick="showDebtDetails('${debt.clientCode}')" 
                                            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                        Деталі
                                    </button>
                                        ${clientLinksData[debt.clientCode] ? `
                                            <a href="${clientLinksData[debt.clientCode]}" target="_blank" 
                                               class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm no-underline">
                                                CRM
                                            </a>
                                        ` : `
                                            <span class="px-3 py-1 bg-gray-500 text-gray-300 rounded text-sm cursor-not-allowed">
                                                CRM
                                            </span>
                                        `}
                                    </div>
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
    
    // Добавляем стили для плавных анимаций
    if (!document.getElementById('debts-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'debts-animation-styles';
        style.textContent = `
            .manager-card-hover:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1) !important;
            }
            .manager-arrow {
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            .manager-content {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            .animate-fade-in {
                opacity: 0;
                animation: fadeIn 0.6s ease-out forwards;
            }
            @keyframes fadeIn {
                from { 
                    opacity: 0; 
                    transform: translateY(30px) scale(0.95); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                }
            }
            .stats-card {
                transition: all 0.2s ease-in-out !important;
            }
            .stats-card:hover {
                transform: scale(1.05) !important;
            }
            
            /* Бургер-меню анимации */
            @keyframes fadeInDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes fadeOutUp {
                from {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                }
            }
            
            /* Бургер-кнопка стили */
            #debts-burger-btn {
                position: relative;
                overflow: hidden;
            }
            
            #debts-burger-btn:hover {
                background-color: rgb(55, 65, 81) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
            
            #debts-burger-btn:hover #burger-line-1,
            #debts-burger-btn:hover #burger-line-2,
            #debts-burger-btn:hover #burger-line-3 {
                background-color: rgb(99, 102, 241) !important;
            }
            
            /* Бургер-меню стили */
            #debts-burger-menu {
                backdrop-filter: blur(12px);
                background: rgba(55, 65, 81, 0.98) !important;
                border: 1px solid rgba(79, 70, 229, 0.3) !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
            }
            
            #debts-burger-menu button {
                transition: all 0.2s ease-in-out !important;
            }
            
            #debts-burger-menu button:hover {
                background-color: rgba(99, 102, 241, 0.15) !important;
                transform: translateX(4px) !important;
                border-left: 3px solid rgb(99, 102, 241) !important;
            }
            
            /* Секционные разделители */
            #debts-burger-menu .border-t {
                border-image: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent) 1 !important;
            }
        `;
        document.head.appendChild(style);
    }
    if (!contentContainer) {
        console.error('❌ debts-content-container не знайдений!');
        return;
    }
    
    // Убираем клиентов с нулевым долгом из отображения
    const filteredData = data.filter(debt => debt.totalDebt !== 0);
    
    // Группируем данные по менеджерам
    const groupedByManager = {};
    filteredData.forEach(debt => {
        const managerName = debt.manager || 'Не вказано';
        if (!groupedByManager[managerName]) {
            groupedByManager[managerName] = {
                manager: managerName,
                department: debt.department || 'Не вказано',
                debtClients: [], // Клиенты с долгом (+)
                overpayClients: [], // Клиенты с переплатой (-)
                totalDebt: 0,
                totalOverpay: 0,
                overdueDebt: 0,
                debtClientsCount: 0,
                overpayClientsCount: 0
            };
        }
        
        if (debt.totalDebt > 0) {
            // Клиент с долгом
            groupedByManager[managerName].debtClients.push(debt);
            groupedByManager[managerName].totalDebt += debt.totalDebt;
        groupedByManager[managerName].overdueDebt += debt.overdueDebt || 0;
            groupedByManager[managerName].debtClientsCount++;
        } else if (debt.totalDebt < 0) {
            // Клиент с переплатой
            groupedByManager[managerName].overpayClients.push(debt);
            groupedByManager[managerName].totalOverpay += Math.abs(debt.totalDebt);
            groupedByManager[managerName].overpayClientsCount++;
        }
    });
    
    // Сортируем менеджеров по общей задолженности (только долги)
    const sortedManagers = Object.values(groupedByManager).sort((a, b) => b.totalDebt - a.totalDebt);
    
    contentContainer.innerHTML = `
        <div class="space-y-8">
            ${sortedManagers.length === 0 ? `
                <div class="text-center py-16">
                    <svg class="w-24 h-24 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <h3 class="text-xl font-medium text-gray-400 mb-2">Немає даних для відображення</h3>
                    <p class="text-gray-500">Спробуйте змінити фільтри або оновити дані</p>
                </div>
            ` : ''}
            
            ${sortedManagers.length > 0 ? `
                <!-- Подсказка для пользователей -->
                <div class="bg-gradient-to-r from-blue-800 to-indigo-800 rounded-xl p-4 border border-blue-600 shadow-lg">
                    <div class="flex items-center gap-3">
                        <div class="flex-shrink-0">
                            <svg class="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="flex-1">
                            <h4 class="text-white font-semibold mb-1">💡 Як користуватися</h4>
                            <p class="text-blue-200 text-sm">
                                <strong>Клікніть на карточку менеджера</strong> щоб розгорнути список його клієнтів з деборгованостями. 
                                Використовуйте кнопку <span class="bg-blue-600 px-2 py-1 rounded text-xs">Деталі</span> для перегляду повної інформації по клієнту.
                            </p>
                        </div>
                        <div class="flex-shrink-0">
                            <div class="text-blue-300 animate-bounce">
                                👆
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}
            ${sortedManagers.map((managerGroup, index) => {
                // Создаем уникальный ID для каждого менеджера используя индекс
                const uniqueId = `manager_${index}_${(managerGroup.manager || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}`;
                const totalClients = managerGroup.debtClientsCount + managerGroup.overpayClientsCount;
                
                return `
                <!-- Группа менеджера ${index + 1} из ${sortedManagers.length} -->
                <div class="relative">
                    ${index > 0 ? `
                    <!-- Разделительная линия между менеджерами -->
                    <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 flex items-center w-full">
                        <div class="flex-1 border-t-2 border-dashed border-gray-600"></div>
                        <div class="px-4">
                            <div class="bg-gray-700 px-3 py-1 rounded-full text-xs text-gray-400 border border-gray-600">
                                Менеджер ${index + 1}
                            </div>
                        </div>
                        <div class="flex-1 border-t-2 border-dashed border-gray-600"></div>
                    </div>
                    ` : ''}
                    
                    <div class="bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-600 overflow-hidden manager-card-hover animate-fade-in" style="animation-delay: ${index * 0.1}s;">
                    <!-- Заголовок менеджера с улучшенным дизайном -->
                    <div class="bg-gradient-to-r from-gray-700 to-gray-800 p-5 cursor-pointer select-none transition-all duration-200 hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg" onclick="toggleManagerGroup('${uniqueId}')">
                        <div class="flex justify-between items-center">
                            <!-- Левая часть - информация о менеджере -->
                            <div class="flex items-center gap-4">
                                <div class="flex-shrink-0">
                                    <div class="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h3 class="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                        ${managerGroup.manager}
                                        <span class="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                                            👆 Натисніть для розгортання
                                        </span>
                                    </h3>
                                    <p class="text-sm text-gray-300 flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                                        </svg>
                                        ${managerGroup.department}
                                    </p>
                                </div>
                            </div>
                            
                            <!-- Центральная часть - статистика -->
                            <div class="flex items-center gap-8">
                                <div class="text-center bg-gray-600 bg-opacity-50 px-4 py-2 rounded-lg stats-card">
                                    <div class="text-2xl font-bold text-white">${totalClients}</div>
                                    <div class="text-xs text-gray-300">👥 Всього клієнтів</div>
                                </div>
                                ${managerGroup.debtClientsCount > 0 ? `
                                <div class="text-center bg-red-600 bg-opacity-30 px-4 py-2 rounded-lg border border-red-500 stats-card">
                                    <div class="text-xl font-bold text-red-300">${formatCurrency(managerGroup.totalDebt)}</div>
                                    <div class="text-xs text-red-200">🔴 Борг (${managerGroup.debtClientsCount})</div>
                                </div>
                                ` : ''}
                                ${managerGroup.overpayClientsCount > 0 ? `
                                <div class="text-center bg-green-600 bg-opacity-30 px-4 py-2 rounded-lg border border-green-500 stats-card">
                                    <div class="text-xl font-bold text-green-300">${formatCurrency(managerGroup.totalOverpay)}</div>
                                    <div class="text-xs text-green-200">🟢 Переплата (${managerGroup.overpayClientsCount})</div>
                                </div>
                                ` : ''}
                                ${managerGroup.overdueDebt > 0 ? `
                                <div class="text-center bg-orange-600 bg-opacity-30 px-4 py-2 rounded-lg border border-orange-500 stats-card">
                                    <div class="text-xl font-bold text-orange-300">${formatCurrency(managerGroup.overdueDebt)}</div>
                                    <div class="text-xs text-orange-200">⚠️ Прострочено</div>
                                </div>
                                ` : ''}
                            </div>
                            
                            <!-- Правая часть - стрелка раскрытия -->
                            <div class="flex items-center gap-3">
                                <div class="text-sm text-gray-300 text-center">
                                    <div class="font-medium">Деталі</div>
                                    <div class="text-xs">клієнтів</div>
                        </div>
                                <div class="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-indigo-500">
                                    <svg class="w-6 h-6 text-white manager-arrow" id="arrow_${uniqueId}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                    </div>
                            </div>
                        </div>
                    </div>
                    <div class="hidden manager-content" id="${uniqueId}">
                        ${managerGroup.debtClientsCount > 0 ? `
                        <!-- Секция долгов -->
                        <div class="bg-red-900 bg-opacity-20 border-t border-red-600">
                            <div class="p-3 bg-red-800">
                                <h4 class="font-bold text-white">🔴 Заборгованості (${managerGroup.debtClientsCount} клієнтів)</h4>
                            </div>
                            <div class="overflow-x-auto">
                        <table class="w-full">
                                    <thead class="bg-red-700">
                                        <tr>
                                            <th class="px-4 py-2 text-left text-white">Клієнт</th>
                                            <th class="px-4 py-2 text-right text-white">Загальний борг</th>
                                            <th class="px-4 py-2 text-right text-white">Прострочений</th>
                                            <th class="px-4 py-2 text-center text-white">Днів</th>
                                            <th class="px-4 py-2 text-center text-white">Прогноз</th>
                                            <th class="px-4 py-2 text-center text-white">Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                        ${managerGroup.debtClients.sort((a, b) => b.totalDebt - a.totalDebt).map(debt => {
                                    const hasComment = clientCommentsData.find(c => c.clientCode === debt.clientCode);
                                    const hasForecast = paymentForecastsData.find(f => f.clientCode === debt.clientCode);
                                    return `
                                                <tr class="border-b border-red-600 hover:bg-red-800 hover:bg-opacity-30">
                                            <td class="px-4 py-3 text-white">
                                                <div class="font-medium">${debt.clientName}</div>
                                                <div class="text-sm text-gray-400">${debt.clientCode}</div>
                                                ${hasComment ? '<div class="text-xs text-blue-400">💬 Є коментар</div>' : ''}
                                                        ${hasComment?.isOldDebt ? '<div class="text-xs text-orange-400">🕰️ Стара заборгованість</div>' : ''}
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
                                            <td class="px-4 py-3 text-center">
                                                ${hasForecast ? 
                                                    '<div class="text-xs text-green-400">📅 Є прогноз</div>' : 
                                                    '<div class="text-xs text-gray-500">Без прогнозу</div>'
                                                }
                                            </td>
                                            <td class="px-4 py-3 text-center">
                                                        <div class="flex gap-2 justify-center">
                                                <button onclick="showDebtDetails('${debt.clientCode}')" 
                                                        class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                                    Деталі
                                                </button>
                                                            ${clientLinksData[debt.clientCode] ? `
                                                                <a href="${clientLinksData[debt.clientCode]}" target="_blank" 
                                                                   class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm no-underline">
                                                                    CRM
                                                                </a>
                                                            ` : `
                                                                <span class="px-3 py-1 bg-gray-500 text-gray-300 rounded text-sm cursor-not-allowed">
                                                                    CRM
                                                                </span>
                                                            `}
                                                        </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                        ` : ''}
                        
                        ${managerGroup.overpayClientsCount > 0 ? `
                        <!-- Секция переплат -->
                        <div class="bg-green-900 bg-opacity-20 ${managerGroup.debtClientsCount > 0 ? 'border-t border-green-600' : ''}">
                            <div class="p-3 bg-green-800">
                                <h4 class="font-bold text-white">🟢 Переплати (${managerGroup.overpayClientsCount} клієнтів)</h4>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead class="bg-green-700">
                                        <tr>
                                            <th class="px-4 py-2 text-left text-white">Клієнт</th>
                                            <th class="px-4 py-2 text-right text-white">Сума переплати</th>
                                            <th class="px-4 py-2 text-center text-white">Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${managerGroup.overpayClients.sort((a, b) => a.totalDebt - b.totalDebt).map(debt => {
                                            const hasComment = clientCommentsData.find(c => c.clientCode === debt.clientCode);
                                            return `
                                                <tr class="border-b border-green-600 hover:bg-green-800 hover:bg-opacity-30">
                                                    <td class="px-4 py-3 text-white">
                                                        <div class="font-medium">${debt.clientName}</div>
                                                        <div class="text-sm text-gray-400">${debt.clientCode}</div>
                                                        ${hasComment ? '<div class="text-xs text-blue-400">💬 Є коментар</div>' : ''}
                                                        ${hasComment?.isOldDebt ? '<div class="text-xs text-orange-400">🕰️ Стара заборгованість</div>' : ''}
                                                    </td>
                                                    <td class="px-4 py-3 text-right">
                                                        <span class="font-medium text-green-400">${formatCurrency(Math.abs(debt.totalDebt))}</span>
                                                    </td>
                                                    <td class="px-4 py-3 text-center">
                                                        <div class="flex gap-2 justify-center">
                                                            <button onclick="showDebtDetails('${debt.clientCode}')" 
                                                                    class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                                                Деталі
                                                            </button>
                                                            ${clientLinksData[debt.clientCode] ? `
                                                                <a href="${clientLinksData[debt.clientCode]}" target="_blank" 
                                                                   class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm no-underline">
                                                                    CRM
                                                                </a>
                                                            ` : `
                                                                <span class="px-3 py-1 bg-gray-500 text-gray-300 rounded text-sm cursor-not-allowed">
                                                                    CRM
                                                                </span>
                                                            `}
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    </div> <!-- Закрываем div.relative -->
                </div>
                `;
            }).join('')}
        </div>
    `;
    
    console.log('🎨 =================== RENDER DEBTS END ===================');
}

/**
 * Переключение видимости группы клиентов менеджера
 */
window.toggleManagerGroup = function(uniqueId) {
    console.log('🔄 toggleManagerGroup викликано для:', uniqueId);
    const clientsDiv = document.getElementById(uniqueId);
    const arrow = document.getElementById(`arrow_${uniqueId}`);
    const managerHeader = arrow?.closest('.bg-gradient-to-r');
    
    console.log('Elements found:', { clientsDiv: !!clientsDiv, arrow: !!arrow, header: !!managerHeader });
    
    if (clientsDiv && arrow) {
        if (clientsDiv.classList.contains('hidden')) {
            // Раскрываем
            clientsDiv.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
            
            // Добавляем класс активного состояния к заголовку
            if (managerHeader) {
                managerHeader.classList.add('from-indigo-800', 'to-purple-800');
                managerHeader.classList.remove('from-gray-700', 'to-gray-800');
            }
            
            // Анимация появления содержимого
            clientsDiv.style.opacity = '0';
            clientsDiv.style.transform = 'translateY(-10px)';
            
            requestAnimationFrame(() => {
                clientsDiv.style.transition = 'all 0.3s ease-out';
                clientsDiv.style.opacity = '1';
                clientsDiv.style.transform = 'translateY(0)';
            });
            
            console.log('✅ Список клієнтів розкрито');
        } else {
            // Скрываем
            clientsDiv.style.transition = 'all 0.2s ease-in';
            clientsDiv.style.opacity = '0';
            clientsDiv.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
            clientsDiv.classList.add('hidden');
                clientsDiv.style.opacity = '';
                clientsDiv.style.transform = '';
                clientsDiv.style.transition = '';
            }, 200);
            
            arrow.style.transform = 'rotate(0deg)';
            
            // Возвращаем обычное состояние заголовка
            if (managerHeader) {
                managerHeader.classList.remove('from-indigo-800', 'to-purple-800');
                managerHeader.classList.add('from-gray-700', 'to-gray-800');
            }
            
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
    console.log('📋 showDebtDetails викликано для клієнта:', clientCode);
    
    // Диагностика данных
    console.log('🔍 Діагностика даних:');
    console.log('- debtsData.length:', debtsData.length);
    console.log('- Перші 3 записи debtsData:', debtsData.slice(0, 3));
    console.log('- Коди клієнтів в debtsData:', debtsData.map(d => d.clientCode).slice(0, 10));
    console.log('- Шукаємо код:', clientCode);
    
    // Пытаемся найти клиента в разных источниках
    let debt = debtsData.find(d => d.clientCode === clientCode);
    
    // Если не найден в основных данных, пытаемся найти в исходных данных API
    if (!debt && window.originalDebtsData) {
        console.log('🔄 Пошук в originalDebtsData...');
        debt = window.originalDebtsData.find(d => d['Клиент.Код'] === clientCode);
        if (debt) {
            console.log('✅ Знайдено в originalDebtsData, конвертуємо...');
            // Конвертируем в нужный формат
            debt = {
                clientCode: debt['Клиент.Код'],
                clientName: debt['Клиент'],
                manager: debt['Менеджер'],
                department: debt['Відділ'] || 'Не вказано',
                totalDebt: debt['Загальна заборгованість'] || 0,
                overdueDebt: debt['Прострочена заборгованість'] || 0,
                currentDebt: debt['Поточна заборгованість'] || 0,
                daysOverdue: debt['Днів прострочки'] || 0,
                lastPayment: debt['Остання оплата'] || '',
                invoices: debt['Рахунки'] || []
            };
        }
    }
    
    if (!debt) {
        console.error('❌ Клієнт не знайдений ні в debtsData, ні в originalDebtsData:', clientCode);
        alert('Клієнт не знайдений. Можливо, дані застаріли. Спробуйте оновити сторінку.');
        return;
    }
    
    console.log('✅ Клієнт знайдений:', debt);
    
    const existingComment = clientCommentsData.find(c => c.clientCode === clientCode);
    const existingForecast = paymentForecastsData.find(f => f.clientCode === clientCode);
    
    console.log('🔍 Пошук існуючих даних:');
    console.log('- existingComment:', existingComment);
    console.log('- existingForecast:', existingForecast);
    console.log('- paymentForecastsData.length:', paymentForecastsData.length);
    console.log('- paymentForecastsData:', paymentForecastsData);
    
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
                ${window.hasPermission('debts_add_comments') ? `
                    <div>
                        <h3 class="text-lg font-bold text-white mb-3">Коментар менеджера</h3>
                        <textarea id="manager-comment-${clientCode}" 
                                  class="w-full h-24 bg-gray-700 text-white rounded border border-gray-600 p-3"
                                  placeholder="Додайте коментар про стан оплати...">${existingComment?.comment || ''}</textarea>
                        
                        <!-- Чекбокс стара заборгованість -->
                        <div class="mt-3 flex items-center">
                            <input type="checkbox" id="old-debt-${clientCode}" 
                                   class="mr-2 w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                                   ${existingComment?.isOldDebt ? 'checked' : ''}>
                            <label for="old-debt-${clientCode}" class="text-white text-sm">
                                🕰️ Стара заборгованість
                            </label>
                        </div>
                        
                        ${existingComment ? `<div class="text-xs text-gray-400 mt-1">Оновлено: ${new Date(existingComment.updatedAt?.seconds * 1000).toLocaleDateString()}</div>` : ''}
                    </div>
                ` : existingComment ? `
                    <div>
                        <h3 class="text-lg font-bold text-white mb-3">Коментар менеджера</h3>
                        <div class="w-full h-24 bg-gray-600 text-gray-300 rounded border border-gray-500 p-3 overflow-y-auto">
                            ${existingComment.comment || 'Немає коментаря'}
                        </div>
                        
                        <!-- Відображення стара заборгованість (тільки для читання) -->
                        <div class="mt-3 flex items-center">
                            <div class="mr-2 w-4 h-4 ${existingComment?.isOldDebt ? 'bg-orange-600' : 'bg-gray-600'} border border-gray-500 rounded flex items-center justify-center">
                                ${existingComment?.isOldDebt ? '<span class="text-white text-xs">✓</span>' : ''}
                            </div>
                            <span class="text-gray-300 text-sm">
                                🕰️ Стара заборгованість ${existingComment?.isOldDebt ? '(так)' : '(ні)'}
                            </span>
                        </div>
                        
                        <div class="text-xs text-gray-400 mt-1">Оновлено: ${new Date(existingComment.updatedAt?.seconds * 1000).toLocaleDateString()}</div>
                    </div>
                ` : ''}
                ${window.hasPermission('debts_add_forecasts') ? `
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
                ${window.hasPermission('debts_add_comments') || window.hasPermission('debts_add_forecasts') ? `
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
 * Функция диагностики прав пользователя (для отладки)
 */
window.debugDebtsPermissions = function() {
    console.log('🔍 === ДІАГНОСТИКА ПРАВ ДЕБІТОРКИ ===');
    console.log('User ID:', window.state?.currentUserId);
    console.log('Company ID:', window.state?.currentCompanyId);
    console.log('hasPermission function exists:', !!window.hasPermission);
    
    if (window.hasPermission) {
        const permissions = [
            'debts_view_page',
            'debts_add_comments', 
            'debts_add_forecasts',
            'debts_view_all_clients',
            'debts_view_manager_clients',
            'debts_export_data'
        ];
        
        permissions.forEach(perm => {
            console.log(`- ${perm}:`, window.hasPermission(perm));
        });
    } else {
        console.error('❌ Функція hasPermission не існує!');
    }
    
    console.log('Current user permissions object:', window.state?.currentUserPermissions);
    console.log('=== КІНЕЦЬ ДІАГНОСТИКИ ===');
};

/**
 * Функция диагностики данных дебиторки
 */
window.debugDebtsData = function() {
    console.log('🔍 === ДІАГНОСТИКА ДАНИХ ДЕБІТОРКИ ===');
    console.log('debtsData.length:', debtsData.length);
    console.log('originalDebtsData.length:', window.originalDebtsData ? window.originalDebtsData.length : 'не завантажено');
    console.log('clientLinksData keys:', Object.keys(clientLinksData).length);
    
    if (debtsData.length > 0) {
        console.log('Перші 3 записи debtsData:', debtsData.slice(0, 3));
    }
    
    if (window.originalDebtsData && window.originalDebtsData.length > 0) {
        console.log('Перші 3 записи originalDebtsData:', window.originalDebtsData.slice(0, 3));
    }
    
    console.log('=== КІНЕЦЬ ДІАГНОСТИКИ ДАНИХ ===');
};

/**
 * Переключение состояния бургер-меню дебиторки
 */
window.toggleDebtsBurgerMenu = function() {
    const menu = document.getElementById('debts-burger-menu');
    const arrow = document.getElementById('burger-arrow');
    const line1 = document.getElementById('burger-line-1');
    const line2 = document.getElementById('burger-line-2');
    const line3 = document.getElementById('burger-line-3');
    
    if (!menu) return;
    
    const isHidden = menu.classList.contains('hidden');
    
    if (isHidden) {
        // Открываем меню
        menu.classList.remove('hidden');
        menu.style.animation = 'fadeInDown 0.3s ease-out forwards';
        
        // Анимация стрелки
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        
        // Анимация бургер-линий в X
        if (line1) {
            line1.style.transform = 'rotate(45deg) translate(2px, 2px)';
        }
        if (line2) {
            line2.style.opacity = '0';
        }
        if (line3) {
            line3.style.transform = 'rotate(-45deg) translate(2px, -2px)';
        }
        
        console.log('🍔 Бургер-меню відкрито');
    } else {
        // Закрываем меню
        menu.style.animation = 'fadeOutUp 0.3s ease-in forwards';
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
        
        // Анимация стрелки
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        
        // Возвращаем бургер-линии
        if (line1) {
            line1.style.transform = 'rotate(0deg) translate(0, 0)';
        }
        if (line2) {
            line2.style.opacity = '1';
        }
        if (line3) {
            line3.style.transform = 'rotate(0deg) translate(0, 0)';
        }
        
        console.log('🍔 Бургер-меню закрито');
    }
};

// Закрытие меню при клике вне его
document.addEventListener('click', function(event) {
    const menu = document.getElementById('debts-burger-menu');
    const button = document.getElementById('debts-burger-btn');
    
    if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
        if (!menu.classList.contains('hidden')) {
            toggleDebtsBurgerMenu();
        }
    }
});

// Закрытие меню клавишей Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const menu = document.getElementById('debts-burger-menu');
        if (menu && !menu.classList.contains('hidden')) {
            toggleDebtsBurgerMenu();
        }
    }
});

/**
 * Сохранить комментарий по дебиторке
 */
window.saveDebtComment = async function(clientCode) {
    console.log('🔍 saveDebtComment викликано для клієнта:', clientCode);
    
    // Логируем права пользователя
    const hasCommentsPermission = window.hasPermission && window.hasPermission('debts_add_comments');
    const hasForecastsPermission = window.hasPermission && window.hasPermission('debts_add_forecasts');
    
    console.log('📋 Права користувача:');
    console.log('- debts_add_comments:', hasCommentsPermission);
    console.log('- debts_add_forecasts:', hasForecastsPermission);
    console.log('- window.hasPermission function exists:', !!window.hasPermission);
    
    // Проверяем права доступа (используем правильные названия разрешений)
    if (!window.hasPermission || (!hasCommentsPermission && !hasForecastsPermission)) {
        console.error('❌ Збереження скасовано: немає прав');
        alert('У вас немає прав для збереження даних');
        return;
    }
    
    console.log('✅ Права перевірено, продовжуємо збереження');
    
    const comment = document.getElementById(`manager-comment-${clientCode}`)?.value || '';
    const forecastDate = document.getElementById(`payment-forecast-${clientCode}`)?.value || '';
    const forecastAmount = document.getElementById(`payment-amount-${clientCode}`)?.value || '';
    const isOldDebt = document.getElementById(`old-debt-${clientCode}`)?.checked || false;
    
    try {
        const companyId = window.state?.currentCompanyId;
        const userId = window.state?.currentUserId;
        
        if (!companyId) {
            alert('Помилка: Компанія не визначена');
            return;
        }
        
        // Сохраняем комментарий и/или флаг старой задолженности (если есть права)
        if (window.hasPermission('debts_add_comments')) {
            console.log('💬 Збереження коментаря та флагу старої заборгованості...');
            console.log('- Коментар:', comment.trim());
            console.log('- Стара заборгованість:', isOldDebt);
            
            const commentData = {
                clientCode,
                comment: comment.trim(),
                isOldDebt: isOldDebt,
                updatedAt: firebase.serverTimestamp(),
                updatedBy: userId
            };
            
            await firebase.setDoc(
                firebase.doc(firebase.db, `companies/${companyId}/debtComments`, clientCode),
                commentData,
                { merge: true }
            );
            
            console.log('✅ Коментар збережено в Firebase');
            
            // Обновляем локальные данные комментариев
            const existingCommentIndex = clientCommentsData.findIndex(c => c.clientCode === clientCode);
            const newCommentData = {
                clientCode,
                comment: comment.trim(),
                isOldDebt: isOldDebt,
                updatedAt: new Date(),
                updatedBy: userId
            };
            
            if (existingCommentIndex >= 0) {
                clientCommentsData[existingCommentIndex] = newCommentData;
                console.log('📝 Локальні дані коментарів оновлено (існуючий запис)');
            } else {
                clientCommentsData.push(newCommentData);
                console.log('📝 Локальні дані коментарів оновлено (новий запис)');
            }
        } else {
            console.log('⚠️ Пропуск збереження коментаря: немає права debts_add_comments');
        }
        
        // Сохраняем прогноз оплаты (если есть права и заполнена хотя бы дата)
        if (forecastDate && window.hasPermission('debts_add_forecasts')) {
            console.log('📅 Збереження прогнозу оплати...');
            console.log('- Дата прогнозу:', forecastDate);
            console.log('- Сума прогнозу:', forecastAmount || 'не вказано');
            
            const forecastData = {
                clientCode,
                forecastDate,
                forecastAmount: forecastAmount ? parseFloat(forecastAmount) : null,
                createdAt: firebase.serverTimestamp(),
                createdBy: userId
            };
            
            await firebase.setDoc(
                firebase.doc(firebase.db, `companies/${companyId}/paymentForecasts`, clientCode),
                forecastData,
                { merge: true }
            );
            
            console.log('✅ Прогноз збережено в Firebase');
            
            // Обновляем локальные данные прогнозов
            const existingForecastIndex = paymentForecastsData.findIndex(f => f.clientCode === clientCode);
            const newForecastData = {
                clientCode,
                forecastDate,
                forecastAmount: forecastAmount ? parseFloat(forecastAmount) : null,
                createdAt: { seconds: Math.floor(Date.now() / 1000) }, // Имитируем Firebase Timestamp
                createdBy: userId
            };
            
            if (existingForecastIndex >= 0) {
                paymentForecastsData[existingForecastIndex] = newForecastData;
                console.log('📝 Локальні дані прогнозів оновлено (існуючий запис)');
            } else {
                paymentForecastsData.push(newForecastData);
                console.log('📝 Локальні дані прогнозів оновлено (новий запис)');
            }
            
            // Пересчитываем просроченный долг
            calculateOverdueDebts();
        } else {
            console.log('⚠️ Пропуск збереження прогнозу:');
            console.log('- forecastDate:', forecastDate);
            console.log('- forecastAmount:', forecastAmount || 'не вказано');
            console.log('- hasPermission(debts_add_forecasts):', window.hasPermission('debts_add_forecasts'));
        }
        
        // Обновляем отображение в любом случае (комментарии/прогнозы могли измениться)
        applyFilters();
        
        console.log('🎉 Збереження завершено успішно!');
        alert('Дані збережено!');
        document.querySelector('.fixed').remove();
        
    } catch (error) {
        console.error('❌ Помилка збереження:', error);
        console.error('Stack trace:', error.stack);
        alert('Помилка збереження даних: ' + error.message);
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
window.refreshDebtsData = async function() {
    console.log('🔄 Принудительное обновление данных...');
    
    // Останавливаем автообновление на время ручного обновления
    const wasAutoUpdateEnabled = isAutoUpdateEnabled;
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
    }
    
    try {
        updateAutoUpdateStatus('Обновление данных...', 'text-blue-400');
        
        // Полная перезагрузка данных
        await loadDebtsData();
        
        console.log('✅ Принудительное обновление завершено');
        
        // Восстанавливаем автообновление если оно было включено
        if (wasAutoUpdateEnabled) {
            setTimeout(() => {
                startAutoUpdate();
            }, 1000);
        }
        
    } catch (error) {
        console.error('❌ Ошибка принудительного обновления:', error);
        updateAutoUpdateStatus('Ошибка обновления', 'text-red-400');
        
        // Все равно восстанавливаем автообновление
        if (wasAutoUpdateEnabled) {
            setTimeout(() => {
                startAutoUpdate();
            }, 2000);
        }
    }
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

/**
 * Остановка автообновления и очистка ресурсов
 * Вызывается при выходе из модуля дебиторки
 */
export function cleanupDebtsModule() {
    console.log('🧹 Очистка модуля дебиторки...');
    stopAutoUpdate();
    
    // Сбрасываем переменные
    debtsData = [];
    managersData = [];
    departmentsData = [];
    clientCommentsData = [];
    paymentForecastsData = [];
    lastDataHash = null;
    lastUpdateTime = null;
    isUpdateInProgress = false;
    
    console.log('✅ Модуль дебиторки очищен');
}

/**
 * Принудительная переинициализация фильтров (для отладки и восстановления)
 */
window.reinitializeDebtsFilters = function() {
    console.log('🔄 =================== ПРИНУДИТЕЛЬНАЯ РЕИНИЦИАЛИЗАЦИЯ ===================');
    
    try {
        // 1. Переrenderим фильтры
        console.log('1️⃣ Перерендеринг фільтрів...');
        renderDebtsFilters();
        
        // 2. Ждем небольшую задержку
        setTimeout(() => {
            // 3. Переустанавливаем обработчики
            console.log('2️⃣ Переустановка обробників...');
            setupDebtsEventHandlers();
            
            // 4. Проверяем что все работает
            setTimeout(() => {
                console.log('3️⃣ Перевірка стану фільтрів...');
                const departmentFilterEl = document.getElementById('debts-department-filter');
                const managerFilterEl = document.getElementById('debts-manager-filter');
                
                console.log('📊 Фінальний стан:', {
                    'department найдено': !!departmentFilterEl,
                    'manager найдено': !!managerFilterEl,
                    'department options': departmentFilterEl?.options.length || 0,
                    'manager options': managerFilterEl?.options.length || 0
                });
                
                if (departmentFilterEl && managerFilterEl) {
                    console.log('✅ Фільтри успішно переініціалізовано!');
                } else {
                    console.error('❌ Помилка переініціалізації фільтрів');
                }
                
                console.log('🔄 =================== РЕИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===================');
            }, 100);
        }, 100);
        
    } catch (error) {
        console.error('❌ Помилка при переініціалізації фільтрів:', error);
    }
};

/**
 * Отладочная функция для проверки состояния фильтров
 */
window.debugFiltersState = function() {
    console.log('🔍 =================== DEBUG FILTERS STATE ===================');
    
    const departmentFilterEl = document.getElementById('debts-department-filter');
    const managerFilterEl = document.getElementById('debts-manager-filter');
    
    console.log('📊 Елементи DOM:', {
        'department filter існує': !!departmentFilterEl,
        'manager filter існує': !!managerFilterEl
    });
    
    if (departmentFilterEl) {
        console.log('🏢 Department Filter:', {
            'value': departmentFilterEl.value,
            'options count': departmentFilterEl.options.length,
            'options': Array.from(departmentFilterEl.options).map(opt => ({value: opt.value, text: opt.text}))
        });
    }
    
    if (managerFilterEl) {
        console.log('👤 Manager Filter:', {
            'value': managerFilterEl.value,
            'options count': managerFilterEl.options.length,
            'options': Array.from(managerFilterEl.options).map(opt => ({value: opt.value, text: opt.text}))
        });
    }
    
    console.log('📊 Дані для фільтрів:', {
        'departmentsData.length': departmentsData.length,
        'managersData.length': managersData.length,
        'debtsData.length': debtsData.length
    });
    
    if (departmentsData.length > 0) {
        console.log('🏢 Departments:', departmentsData.map(d => ({id: d.id, name: d.name})));
    }
    
    if (managersData.length > 0) {
        console.log('👤 Managers:', managersData.map(m => ({id: m.id, name: m.name, departmentId: m.departmentId})));
    }
    
    console.log('🔍 =================== DEBUG END ===================');
};