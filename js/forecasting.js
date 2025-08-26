// Модуль прогнозирования продаж
// Автор: AI Assistant
// Дата: 2024

// Импорт алгоритмов прогнозирования
import { ForecastingAlgorithms, SalesDataProcessor, ClientLifecycleForecasting } from './forecastingAlgorithms.js';

// Глобальные переменные
let forecastingData = {
    salesData: [],
    nomenclatureData: [],
    clientManagerDirectory: {}, // Справочник клиент-менеджер
    plans: {},
    forecasts: {},
    settings: {
        excludedNomenclature: [],
        forecastPeriods: ['month', 'quarter', 'half_year', 'year'],
        algorithms: ['trend', 'seasonal', 'neural', 'combined']
    }
};

// === NEW: Данные из Firebase ===
let managersData = [];
let departmentsData = [];
let userAccess = {
    userId: null,
    employeeId: null,
    employee: null,
    role: null,
    departmentId: null,
    isAdmin: false
};

// Флаг для відстеження стану завантаження
let isLoadingForecast = false;

// Основна функція ініціалізації модуля
export async function initForecastingModule(container) {
    console.log('🚀 Ініціалізація модуля прогнозування продажів...');
    console.log('Container:', container);
    
    if (!container) {
        console.error('❌ Container is null or undefined');
        return;
    }
    
    try {
        // Завантажуємо тільки основні дані (НЕ плани)
        console.log('📊 Починаємо завантаження даних...');
        await loadForecastingData();
        
        // Рендеримо інтерфейс
        console.log('🎨 Рендеримо інтерфейс...');
        renderForecastingInterface(container);
        
        // Ініціалізуємо обробники подій
        console.log('🔧 Ініціалізуємо обробники подій...');
        initForecastingEventHandlers();
        
        console.log('✅ Модуль прогнозування успішно ініціалізовано');
        
    } catch (error) {
        console.error('❌ Помилка ініціалізації модуля прогнозування:', error);
        container.innerHTML = `
            <div class="text-red-400 p-4">
                <h3 class="text-lg font-semibold mb-2">Помилка завантаження модуля прогнозування</h3>
                <p>${error.message}</p>
                <pre class="mt-2 text-xs">${error.stack}</pre>
            </div>
        `;
    }
}

// Загрузка данных для прогнозирования
async function loadForecastingData() {
    console.log('📊 Завантаження даних для прогнозування...');
    
    try {
        console.log('🔗 Починаємо завантаження даних з зовнішніх джерел...');
        
        // Ініціалізуємо userAccess з поточного стану
        userAccess = {
            userId: window.state?.currentUserId,
            employeeId: null,
            employee: null,
            role: null,
            departmentId: null,
            isAdmin: false
        };
        
        const companyId = window.state?.currentCompanyId;
        
        // Завантажуємо дані паралельно
        const promises = [
            fetch('модуль помічник продажу/data.json'),
            fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
            fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category'),
            fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url')
        ];
        
        // Завантажуємо дані з Firebase якщо є компанія
        if (companyId) {
            console.log('🔥 Завантажуємо дані з Firebase...');
            
            try {
                const firebaseModule = await import('./firebase.js');
                const { collection, getDocs } = firebaseModule;
                
                // Завантажуємо співробітників
                const employeesRef = collection(firebaseModule.db, 'companies', companyId, 'employees');
                const employeesSnapshot = await getDocs(employeesRef);
                managersData = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Завантажуємо відділи
                const departmentsRef = collection(firebaseModule.db, 'companies', companyId, 'departments');
                const departmentsSnapshot = await getDocs(departmentsRef);
                departmentsData = departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Завантажуємо користувачів
                const membersRef = collection(firebaseModule.db, 'companies', companyId, 'members');
                const membersSnapshot = await getDocs(membersRef);
                const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Визначаємо доступ користувача
                const currentUser = members.find(member => member.userId === userAccess.userId);
                if (currentUser) {
                    userAccess.employeeId = currentUser.employeeId;
                    userAccess.employee = managersData.find(emp => emp.id === currentUser.employeeId);
                    userAccess.role = currentUser.role || 'користувач';
                    userAccess.departmentId = userAccess.employee?.departmentId;
                    userAccess.isAdmin = userAccess.role && userAccess.role.includes('admin');
                } else {
                    userAccess.role = 'користувач';
                }
                
                console.log('👤 Дані користувача:', userAccess);
                console.log('👥 Менеджери:', managersData.length);
                console.log('🏢 Відділи:', departmentsData.length);
                
            } catch (firebaseError) {
                console.warn('⚠️ Помилка завантаження даних з Firebase:', firebaseError);
                userAccess.role = 'користувач';
            }
        } else {
            userAccess.role = 'користувач';
        }
        
        // Завантажуємо зовнішні дані
        const [dataResponse, nomenclatureResponse, categoryResponse, clientResponse] = await Promise.all(promises);
        
        if (dataResponse.ok) {
            const data = await dataResponse.json();
            forecastingData.salesData = data;
            console.log('📊 Завантажено дані продажів:', data.length, 'записів');
        }
        
        if (nomenclatureResponse.ok) {
            const nomenclature = await nomenclatureResponse.json();
            forecastingData.salesData = [...forecastingData.salesData, ...nomenclature];
            console.log('📊 Додано актуальні дані продажів:', nomenclature.length, 'записів');
        }
        
        if (categoryResponse.ok) {
            const categories = await categoryResponse.json();
            forecastingData.nomenclatureData = categories;
            console.log('📋 Завантажено номенклатуру:', categories.length, 'категорій');
        }
        
        if (clientResponse.ok) {
            const clients = await clientResponse.json();
            forecastingData.clientManagerDirectory = clients.reduce((acc, client) => {
                // Використовуємо поле "Менеджер" замість "Основной менеджер"
                acc[client['Клиент.Код']] = client['Менеджер'] || client['Основной менеджер'];
                return acc;
            }, {});
            console.log('👥 Завантажено довідник клієнт-менеджер:', Object.keys(forecastingData.clientManagerDirectory).length, 'записів');
        }
        
        // Завантажуємо налаштування з localStorage
        try {
            const savedSettings = localStorage.getItem('forecastingSettings');
            if (savedSettings) {
                forecastingData.settings = { ...forecastingData.settings, ...JSON.parse(savedSettings) };
                console.log('⚙️ Завантажено збережені налаштування:', forecastingData.settings);
            }
        } catch (error) {
            console.warn('⚠️ Помилка завантаження налаштувань:', error);
        }
        
        console.log('✅ Всі дані успішно завантажено');
        console.log('📊 Загальна кількість записів продажів:', forecastingData.salesData.length);
        
    } catch (error) {
        console.error('❌ Помилка завантаження даних:', error);
        throw new Error(`Не вдалося завантажити дані: ${error.message}`);
    }
}

// Завантаження планів (тільки при необхідності)
async function loadForecastingPlans() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            console.warn('⚠️ CompanyId не знайдено, пропускаємо завантаження планів');
            return;
        }
        
        const firebaseModule = await import('./firebase.js');
        const { collection, getDocs } = firebaseModule;
        
        const plansRef = collection(firebaseModule.db, 'companies', companyId, 'forecastingPlans');
        const snapshot = await getDocs(plansRef);
        
        forecastingData.plans = {};
        snapshot.docs.forEach(doc => {
            forecastingData.plans[doc.id] = doc.data();
        });
        
        console.log(`📋 Завантажено ${Object.keys(forecastingData.plans).length} планів`);
        renderPlansTab(); // Оновлюємо відображення планів після завантаження
        
    } catch (error) {
        console.warn('⚠️ Не вдалося завантажити плани з Firebase:', error);
    }
}

// Рендер основного інтерфейсу
function renderForecastingInterface(container) {
    console.log('🎨 Починаємо рендеринг інтерфейсу прогнозування...');
    console.log('Container element:', container);
    
    const html = `
        <div class="forecasting-module">
            <!-- Заголовок модуля -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-white mb-2">📊 Прогнозування продажів</h2>
                <p class="text-gray-400">Створення планів та прогнозів продажів з використанням AI</p>
            </div>
            
            <!-- Панель управління -->
            <div class="bg-gray-800 rounded-lg p-4 mb-6">
                <div class="flex flex-wrap gap-4 items-end">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Період планування</label>
                        <select id="forecastingPeriod" class="dark-input">
                            <option value="month">Місяць</option>
                            <option value="quarter">Квартал</option>
                            <option value="half_year">Півріччя</option>
                            <option value="year">Рік</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Алгоритм прогнозування</label>
                        <select id="forecastingAlgorithm" class="dark-input">
                            <option value="trend">Трендовий аналіз</option>
                            <option value="seasonal">Сезонний аналіз</option>
                            <option value="neural">Нейронна мережа</option>
                            <option value="combined">Комбінований</option>
                            <option value="client-lifecycle">Життєвий цикл клієнта</option>
                        </select>
                    </div>
                    
                    <button id="generateForecastBtn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        🚀 Згенерувати прогноз
                    </button>
                    
                    <button id="createPlanBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        📋 Створити план
                    </button>
                </div>
            </div>
            
            <!-- Підсумкові показники -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div class="text-sm text-gray-400">Місячний прогноз</div>
                    <div id="monthlyForecastSum" class="text-xl font-bold text-white">-</div>
                </div>
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div class="text-sm text-gray-400">Квартальний прогноз</div>
                    <div id="quarterlyForecastSum" class="text-xl font-bold text-white">-</div>
                </div>
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div class="text-sm text-gray-400">Піврічний прогноз</div>
                    <div id="halfYearForecastSum" class="text-xl font-bold text-white">-</div>
                </div>
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div class="text-sm text-gray-400">Річний прогноз</div>
                    <div id="yearlyForecastSum" class="text-xl font-bold text-white">-</div>
                </div>
            </div>
            
            <!-- Вкладки модуля -->
            <div class="mb-6">
                <div class="flex border-b border-gray-700">
                    <button class="forecasting-tab active px-4 py-2 text-white border-b-2 border-blue-500" data-tab="plans">
                        📋 Плани
                    </button>
                    <button class="forecasting-tab px-4 py-2 text-gray-400 hover:text-white" data-tab="forecasts">
                        📊 Прогнози
                    </button>
                    <button class="forecasting-tab px-4 py-2 text-gray-400 hover:text-white" data-tab="analytics">
                        📈 Аналітика
                    </button>
                    <button class="forecasting-tab px-4 py-2 text-gray-400 hover:text-white" data-tab="settings">
                        ⚙️ Налаштування
                    </button>
                </div>
            </div>
            
            <!-- Контент вкладок -->
            <div id="forecastingContent">
                <div id="plansTab" class="forecasting-tab-content active">
                    <div class="text-center py-8">
                        <div class="text-gray-400 mb-4">Натисніть "Завантажити плани" для перегляду</div>
                        <button onclick="loadForecastingPlans()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            📋 Завантажити плани
                        </button>
                    </div>
                </div>
                
                <div id="forecastsTab" class="forecasting-tab-content hidden">
                    <div class="text-center py-8">
                        <div class="text-gray-400 mb-4">Згенеруйте прогноз для перегляду результатів</div>
                    </div>
                </div>
                
                <div id="analyticsTab" class="forecasting-tab-content hidden">
                    <div class="text-center py-8">
                        <div class="text-gray-400 mb-4">Аналітика буде доступна після генерації прогнозу</div>
                    </div>
                </div>
                
                <div id="settingsTab" class="forecasting-tab-content hidden">
                    <div class="text-center py-8">
                        <div class="text-gray-400 mb-4">Налаштування модуля прогнозування</div>
                    </div>
                </div>
            </div>
            
            <!-- Модальное окно загрузки -->
            <div id="forecastingLoadingModal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 hidden">
                <div class="bg-gray-800 rounded-lg p-8 shadow-xl text-center text-white w-full max-w-md mx-4">
                    <h3 id="loadingModalTitle" class="text-2xl font-bold mb-4">Генерація прогнозу...</h3>
                    <p id="loadingModalStatus" class="text-gray-400 mb-6">Будь ласка, зачекайте...</p>
                    <div class="w-full bg-gray-700 rounded-full h-4 mb-4 overflow-hidden">
                        <div id="loadingModalProgressBar" class="bg-blue-600 h-4 rounded-full transition-all duration-500" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    console.log('✅ Інтерфейс прогнозування відрендерено');
}

// Ініціалізація обробників подій
function initForecastingEventHandlers() {
    console.log('🔧 Ініціалізуємо обробники подій...');
    
    // Перемикання вкладок
    document.querySelectorAll('.forecasting-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            console.log('🔄 Перемикання на вкладку:', targetTab);
            switchForecastingTab(targetTab);
        });
    });
    
    // Генерація прогнозу
    const generateBtn = document.getElementById('generateForecastBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            console.log('🚀 Генерація прогнозу...');
            generateForecast();
        });
    }
    
    // Створення плану
    const createBtn = document.getElementById('createPlanBtn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            console.log('📋 Створення плану...');
            createForecastingPlan();
        });
    }
    
    console.log('✅ Обробники подій ініціалізовано');
}

// Перемикання вкладок
function switchForecastingTab(tabName) {
    console.log('🔄 Перемикання на вкладку:', tabName);
    
    // Прибираємо активний клас з усіх вкладок
    document.querySelectorAll('.forecasting-tab').forEach(tab => {
        tab.classList.remove('active', 'border-blue-500', 'text-white');
        tab.classList.add('text-gray-400');
    });
    
    // Приховуємо всі контенти
    document.querySelectorAll('.forecasting-tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('active');
    });
    
    // Активуємо потрібну вкладку
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active', 'border-blue-500', 'text-white');
        activeTab.classList.remove('text-gray-400');
    }
    
    // Показуємо потрібний контент
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.classList.add('active');
    }
    
    // Рендеримо контент вкладки якщо потрібно
    switch (tabName) {
        case 'plans':
            renderPlansTab();
            break;
        case 'forecasts':
            renderForecastsTab();
            break;
        case 'settings':
            renderSettingsTab();
            break;
        case 'analytics':
            // TODO: Implement analytics tab
            break;
    }
    
    console.log('✅ Вкладку перемикано:', tabName);
}

// Рендер вкладки планів
function renderPlansTab() {
    console.log('📋 Рендеримо вкладку планів...');
    
    const container = document.getElementById('plansTab');
    if (!container) {
        console.error('❌ Контейнер plansTab не знайдено!');
        return;
    }
    
    const plans = Object.values(forecastingData.plans);
    console.log('📊 Плани для відображення:', plans);
    
    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <h3 class="text-xl font-semibold text-white">Плани продажів</h3>
                <button onclick="createForecastingPlan()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    ➕ Створити новий план
                </button>
            </div>
            
            ${plans.length === 0 ? `
                <div class="text-center py-12">
                    <div class="text-gray-400 mb-4">Плани не знайдено</div>
                    <p class="text-gray-500">Створіть перший план для початку роботи</p>
                </div>
            ` : `
                <div class="grid gap-4">
                    ${plans.map(plan => `
                        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h4 class="text-lg font-semibold text-white">${plan.title || 'Без назви'}</h4>
                                    <p class="text-gray-400 text-sm">${plan.description || 'Без опису'}</p>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="editForecastingPlan('${plan.id}')" class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                        ✏️
                                    </button>
                                    <button onclick="deleteForecastingPlan('${plan.id}')" class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span class="text-gray-400">Період:</span>
                                    <div class="text-white">${plan.period || 'Не вказано'}</div>
                                </div>
                                <div>
                                    <span class="text-gray-400">Ціль:</span>
                                    <div class="text-white">${formatCurrency(plan.target || 0)}</div>
                                </div>
                                <div>
                                    <span class="text-gray-400">Факт:</span>
                                    <div class="text-white">${formatCurrency(plan.actual || 0)}</div>
                                </div>
                                <div>
                                    <span class="text-gray-400">Виконання:</span>
                                    <div class="text-white">${getCompletionPercentage(plan.target || 0, plan.actual || 0)}%</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

// Рендер вкладки прогнозів
function renderForecastsTab() {
    console.log('📊 Рендеримо вкладку прогнозів...');
    
    const container = document.getElementById('forecastsTab');
    if (!container) {
        console.error('❌ Контейнер forecastsTab не знайдено!');
        return;
    }
    
    if (!forecastingData.forecasts || !forecastingData.forecasts.data) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-gray-400 mb-4">Прогноз ще не згенеровано</div>
                <p class="text-gray-500">Натисніть "Згенерувати прогноз" для створення прогнозу</p>
            </div>
        `;
        return;
    }
    
    // Оновлюємо підсумкові показники
    updateForecastSummary();
    
    let content = '';
    
    // Якщо використовувався алгоритм життєвого циклу клієнтів
    if (forecastingData.forecasts.algorithm === 'client-lifecycle' && forecastingData.forecasts.details) {
        const details = forecastingData.forecasts.details;
        
        content = `
            <div class="space-y-6">
                <!-- Загальна статистика -->
                <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">📊 Загальна статистика</h3>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-400">${details.clientCount}</div>
                            <div class="text-sm text-gray-400">Клієнтів</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-400">${formatCurrency(details.totalForecast)}</div>
                            <div class="text-sm text-gray-400">Загальний прогноз</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-purple-400">${formatCurrency(details.averageForecastPerClient)}</div>
                            <div class="text-sm text-gray-400">Середній прогноз на клієнта</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-yellow-400">${formatCurrency(forecastingData.forecasts.data[0] || 0)}</div>
                            <div class="text-sm text-gray-400">Прогноз на наступний місяць</div>
                        </div>
                    </div>
                </div>
                
                <!-- Аналіз по життєвому циклу -->
                <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">👥 Аналіз по життєвому циклу клієнтів</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${renderLifecycleStats(details.clientForecasts)}
                    </div>
                </div>
                
                <!-- Топ клієнтів -->
                <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">🏆 Топ клієнтів за прогнозом</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-gray-700">
                                    <th class="text-left py-2 text-gray-300">Клієнт</th>
                                    <th class="text-right py-2 text-gray-300">Життєвий цикл</th>
                                    <th class="text-right py-2 text-gray-300">Середній чек</th>
                                    <th class="text-right py-2 text-gray-300">Прогноз на рік</th>
                                    <th class="text-right py-2 text-gray-300">Впевненість</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderTopClients(details.clientForecasts)}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Графік прогнозу -->
                <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">📈 Графік прогнозу по місяцях</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
                        ${forecastingData.forecasts.data.slice(0, 12).map((value, index) => {
                            const months = [
                                'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
                                'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
                            ];
                            
                            // Отримуємо налаштування початкового місяця
                            const settings = forecastingData.settings || {};
                            let startMonthIndex = 0;
                            let startYear = new Date().getFullYear();
                            
                            if (settings.forecastStartMonthYear) {
                                const [year, month] = settings.forecastStartMonthYear.split('-');
                                startYear = parseInt(year);
                                startMonthIndex = parseInt(month) - 1;
                            } else if (settings.forecastStartMonth !== undefined) {
                                // Якщо немає forecastStartMonthYear, використовуємо старі налаштування
                                startMonthIndex = settings.forecastStartMonth;
                                startYear = settings.forecastStartYear || new Date().getFullYear();
                            }
                            
                            const monthIndex = (startMonthIndex + index) % 12;
                            const year = startYear + Math.floor((startMonthIndex + index) / 12);
                            const monthName = months[monthIndex];
                            
                            return `
                                <div class="bg-gray-700 rounded p-3 text-center">
                                    <div class="text-xs text-gray-400 mb-1">${monthName} ${year}</div>
                                    <div class="text-sm font-bold text-blue-400">${formatCurrency(value || 0)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    } else {
        // Класичний відображення для інших алгоритмів
        content = `
            <div class="space-y-6">
                <!-- Графік прогнозу -->
                <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">📈 Графік прогнозу по місяцях</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
                        ${forecastingData.forecasts.data.slice(0, 12).map((value, index) => {
                            const months = [
                                'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
                                'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
                            ];
                            
                            // Отримуємо налаштування початкового місяця
                            const settings = forecastingData.settings || {};
                            let startMonthIndex = 0;
                            let startYear = new Date().getFullYear();
                            
                            if (settings.forecastStartMonthYear) {
                                const [year, month] = settings.forecastStartMonthYear.split('-');
                                startYear = parseInt(year);
                                startMonthIndex = parseInt(month) - 1;
                            } else if (settings.forecastStartMonth !== undefined) {
                                // Якщо немає forecastStartMonthYear, використовуємо старі налаштування
                                startMonthIndex = settings.forecastStartMonth;
                                startYear = settings.forecastStartYear || new Date().getFullYear();
                            }
                            
                            const monthIndex = (startMonthIndex + index) % 12;
                            const year = startYear + Math.floor((startMonthIndex + index) / 12);
                            const monthName = months[monthIndex];
                            
                            return `
                                <div class="bg-gray-700 rounded p-3 text-center">
                                    <div class="text-xs text-gray-400 mb-1">${monthName} ${year}</div>
                                    <div class="text-sm font-bold text-blue-400">${formatCurrency(value || 0)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Додаємо контейнер для ієрархічних прогнозів
    content += `
        <!-- Ієрархічні прогнози -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 class="text-lg font-semibold text-white mb-4">🏢 Прогнози по відділах та менеджерах</h3>
            <div id="hierarchicalForecasts" class="space-y-4">
                <!-- Тут будуть завантажені ієрархічні прогнози -->
            </div>
        </div>
    `;
    
    container.innerHTML = content;
    
    // Завантажуємо ієрархічні прогнози тільки якщо є прогноз
    if (forecastingData.forecasts && forecastingData.forecasts.data) {
        console.log('🏢 Завантажуємо ієрархічні прогнози...');
        
        // Використовуємо нову систему завантаження з прогресом
        setTimeout(() => {
            loadHierarchicalForecastsUpdated();
        }, 100);
    } else {
        console.log('⚠️ Прогноз не згенеровано, пропускаємо ієрархічні прогнози');
    }
}

// Оновлення підсумкових показників
function updateForecastSummary() {
    const monthlySum = calculateMonthlyForecast();
    const quarterlySum = calculateQuarterlyForecast();
    const halfYearSum = calculateHalfYearForecast();
    const yearlySum = monthlySum * 12; // Приблизний річний прогноз
    
    document.getElementById('monthlyForecastSum').textContent = formatCurrency(monthlySum);
    document.getElementById('quarterlyForecastSum').textContent = formatCurrency(quarterlySum);
    document.getElementById('halfYearForecastSum').textContent = formatCurrency(halfYearSum);
    document.getElementById('yearlyForecastSum').textContent = formatCurrency(yearlySum);
}

// Генерація прогнозу
async function generateForecast() {
    if (isLoadingForecast) {
        console.log('⏳ Прогноз вже генерується...');
        return;
    }

    console.log('🚀 Початок генерації прогнозу...');
    isLoadingForecast = true;

    showLoadingModal();
    updateLoadingModal(5, 'Ініціалізація...');

    try {
        await new Promise(resolve => setTimeout(resolve, 300));

        const algorithm = document.getElementById('forecastingAlgorithm')?.value || 'client-lifecycle';
        const periods = parseInt(forecastingData.settings?.forecastPeriods) || 12;
        const startDate = forecastingData.settings?.forecastStartDate;
        const endDate = forecastingData.settings?.forecastEndDate;

        updateLoadingModal(15, 'Фільтрація даних...');
        let filteredSalesData = forecastingData.salesData;
        if (startDate && endDate) {
            filteredSalesData = forecastingData.salesData.filter(item => {
                if (!item.Дата) return false;
                const itemDate = new Date(item.Дата);
                return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
            });
        }

        if (filteredSalesData.length < 3) {
            throw new Error('Недостатньо даних для прогнозування (мінімум 3 записи).');
        }

        updateLoadingModal(30, `Застосування алгоритму "${algorithm}"...`);
        await new Promise(resolve => setTimeout(resolve, 500));

        let forecast;
        let forecastDetails;

        if (algorithm === 'client-lifecycle') {
            // Створюємо налаштування життєвого циклу з UI
            const lifecycleSettings = {
                NEW_CLIENT_ORDERS: forecastingData.settings?.newClientOrders || 1,
                GROWING_CLIENT_MIN_ORDERS: forecastingData.settings?.growingClientMinOrders || 5,
                ACTIVE_CLIENT_MIN_ORDERS: forecastingData.settings?.activeClientMinOrders || 10,
                AT_RISK_MULTIPLIER: forecastingData.settings?.atRiskMultiplier || 3,
                ACTIVE_CLIENT_MULTIPLIER: forecastingData.settings?.activeClientMultiplier || 1.5,
                GROWING_CLIENT_MULTIPLIER: forecastingData.settings?.growingClientMultiplier || 2,
                FORECAST_REDUCTION_FOR_AT_RISK: (100 - (forecastingData.settings?.forecastReductionForAtRisk || 30)) / 100,
                MIN_CONFIDENCE_NEW: (forecastingData.settings?.minConfidenceNew || 30) / 100,
                MIN_CONFIDENCE_GROWING: (forecastingData.settings?.minConfidenceGrowing || 60) / 100,
                MIN_CONFIDENCE_ACTIVE: (forecastingData.settings?.minConfidenceActive || 80) / 100,
                MIN_CONFIDENCE_AT_RISK: (forecastingData.settings?.minConfidenceAtRisk || 40) / 100
            };
            
            forecastDetails = ClientLifecycleForecasting.forecastAllClients(filteredSalesData, periods, lifecycleSettings);
            const monthlyForecast = new Array(periods).fill(0);
            Object.values(forecastDetails.clientForecasts).forEach(clientForecast => {
                clientForecast.forecast.forEach((value, monthIndex) => {
                    if (monthIndex < monthlyForecast.length) {
                        monthlyForecast[monthIndex] += value;
                    }
                });
            });
            forecast = monthlyForecast;
        } else {
            const preparedData = SalesDataProcessor.prepareDataForForecasting(filteredSalesData, [], 'month');
            if (preparedData.length < 2) {
                throw new Error('Недостатньо агрегованих даних для прогнозування.');
            }
            switch (algorithm) {
                case 'trend': forecast = ForecastingAlgorithms.trendAnalysis(preparedData, periods); break;
                case 'seasonal': forecast = ForecastingAlgorithms.seasonalDecomposition(preparedData, 12, periods).forecast; break;
                case 'neural': forecast = ForecastingAlgorithms.neuralNetworkForecast(preparedData, periods); break;
                default: forecast = ForecastingAlgorithms.combinedForecast(preparedData, periods).combined; break;
            }
        }

        updateLoadingModal(80, 'Формування результатів...');
        const validatedForecast = forecast.map(value => Math.max(0, value || 0));

        forecastingData.forecasts = {
            algorithm, periods,
            data: validatedForecast,
            generatedAt: new Date().toISOString(),
            details: forecastDetails
        };

        console.log('✅ Прогноз згенеровано:', forecastingData.forecasts);

        updateLoadingModal(100, 'Прогноз успішно згенеровано!');

        setTimeout(() => {
            hideLoadingModal();
            updateForecastSummary();
            switchForecastingTab('forecasts');
        }, 1500);

    } catch (error) {
        console.error('❌ Помилка генерації прогнозу:', error);
        hideLoadingModal();
        showNotification('Помилка генерації прогнозу: ' + error.message, 'error');
    } finally {
        isLoadingForecast = false;
    }
}

function createForecastingPlan() {
    console.log('📋 Створення плану...');
    alert('Функція створення плану буде реалізована пізніше');
}

function editForecastingPlan(planId) {
    console.log('✏️ Редагування плану:', planId);
    alert('Функція редагування плану буде реалізована пізніше');
}

function deleteForecastingPlan(planId) {
    console.log('🗑️ Видалення плану:', planId);
    alert('Функція видалення плану буде реалізована пізніше');
}

function addExcludedNomenclature() {
    console.log('➕ Додавання виключеної номенклатури...');
    
    const select = document.getElementById('excludedNomenclatureSelect');
    const selectedValue = select?.value;
    
    if (!selectedValue) {
        showNotification('Виберіть номенклатуру для виключення', 'error');
        return;
    }
    
    // Ініціалізуємо масив якщо його немає
    if (!forecastingData.settings) {
        forecastingData.settings = {};
    }
    if (!forecastingData.settings.excludedNomenclature) {
        forecastingData.settings.excludedNomenclature = [];
    }
    
    // Перевіряємо чи вже не додано
    if (forecastingData.settings.excludedNomenclature.includes(selectedValue)) {
        showNotification('Ця номенклатура вже виключена', 'error');
        return;
    }
    
    // Додаємо до списку
    forecastingData.settings.excludedNomenclature.push(selectedValue);
    
    // Оновлюємо відображення
    renderSettingsTab();
    
    showNotification(`Номенклатура "${selectedValue}" додана до виключень`, 'success');
    console.log('✅ Додано виключення:', selectedValue);
}

function removeExcludedNomenclature(item) {
    console.log('➖ Видалення виключеної номенклатури:', item);
    
    if (!forecastingData.settings?.excludedNomenclature) {
        showNotification('Список виключень порожній', 'error');
        return;
    }
    
    const index = forecastingData.settings.excludedNomenclature.indexOf(item);
    if (index === -1) {
        showNotification('Номенклатура не знайдена в списку виключень', 'error');
        return;
    }
    
    // Видаляємо зі списку
    forecastingData.settings.excludedNomenclature.splice(index, 1);
    
    // Оновлюємо відображення
    renderSettingsTab();
    
    showNotification(`Номенклатура "${item}" видалена з виключень`, 'success');
    console.log('✅ Видалено виключення:', item);
}

function saveForecastingSettings() {
    console.log('💾 Зберігаємо налаштування прогнозування...');
    
    try {
        // Отримуємо значення з нового календаря
        const forecastStartMonthYear = document.getElementById('forecastStartMonthYear')?.value;
        
        // Збираємо всі налаштування з форми
        const settings = {
            forecastStartDate: document.getElementById('forecastStartDate')?.value,
            forecastEndDate: document.getElementById('forecastEndDate')?.value,
            forecastStartMonthYear: forecastStartMonthYear, // Зберігаємо напряму як YYYY-MM
            forecastPeriods: parseInt(document.getElementById('forecastPeriods')?.value || 12),
            forecastConfidence: parseInt(document.getElementById('forecastConfidence')?.value || 80),
            seasonLength: parseInt(document.getElementById('seasonLength')?.value || 12),
            seasonalAdjustment: document.getElementById('seasonalAdjustment')?.value || 'auto',
            minOrderValue: parseFloat(document.getElementById('minOrderValue')?.value || 0),
            minOrderCount: parseInt(document.getElementById('minOrderCount')?.value || 1),
            excludedNomenclature: forecastingData.settings?.excludedNomenclature || [],
            
            // Налаштування життєвого циклу клієнта
            newClientOrders: parseInt(document.getElementById('newClientOrders')?.value || 1),
            growingClientMinOrders: parseInt(document.getElementById('growingClientMinOrders')?.value || 5),
            activeClientMinOrders: parseInt(document.getElementById('activeClientMinOrders')?.value || 10),
            atRiskMultiplier: parseFloat(document.getElementById('atRiskMultiplier')?.value || 3),
            activeClientMultiplier: parseFloat(document.getElementById('activeClientMultiplier')?.value || 1.5),
            growingClientMultiplier: parseFloat(document.getElementById('growingClientMultiplier')?.value || 2),
            forecastReductionForAtRisk: parseInt(document.getElementById('forecastReductionForAtRisk')?.value || 30),
            minConfidenceNew: parseInt(document.getElementById('minConfidenceNew')?.value || 30),
            minConfidenceGrowing: parseInt(document.getElementById('minConfidenceGrowing')?.value || 60),
            minConfidenceActive: parseInt(document.getElementById('minConfidenceActive')?.value || 80),
            minConfidenceAtRisk: parseInt(document.getElementById('minConfidenceAtRisk')?.value || 40)
        };
        
        // Зберігаємо в глобальні дані
        forecastingData.settings = settings;
        
        // Зберігаємо в localStorage
        localStorage.setItem('forecastingSettings', JSON.stringify(settings));
        
        showNotification('Налаштування успішно збережено!', 'success');
        console.log('✅ Налаштування збережено:', settings);
        
        // Оновлюємо відображення поточного вибору
        updateForecastStartDisplay();
        
    } catch (error) {
        console.error('❌ Помилка збереження налаштувань:', error);
        showNotification('Помилка збереження налаштувань', 'error');
    }
}

function resetForecastingSettings() {
    console.log('🔄 Скидаємо налаштування прогнозування...');
    
    try {
        // Скидаємо налаштування до значень за замовчуванням
        const defaultSettings = {
            forecastStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            forecastEndDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
            forecastStartMonth: 0,
            forecastStartYear: new Date().getFullYear(),
            forecastPeriods: 12,
            forecastConfidence: 80,
            seasonLength: 12,
            seasonalAdjustment: 'auto',
            minOrderValue: 0,
            minOrderCount: 1,
            excludedNomenclature: [],
            
            // Налаштування життєвого циклу клієнта за замовчуванням
            newClientOrders: 1,
            growingClientMinOrders: 5,
            activeClientMinOrders: 10,
            atRiskMultiplier: 3,
            activeClientMultiplier: 1.5,
            growingClientMultiplier: 2,
            forecastReductionForAtRisk: 30,
            minConfidenceNew: 30,
            minConfidenceGrowing: 60,
            minConfidenceActive: 80,
            minConfidenceAtRisk: 40
        };
        
        // Оновлюємо глобальні дані
        forecastingData.settings = defaultSettings;
        
        // Видаляємо з localStorage
        localStorage.removeItem('forecastingSettings');
        
        // Перерендеруємо вкладку налаштувань
        renderSettingsTab();
        
        showNotification('Налаштування скинуто до значень за замовчуванням!', 'success');
        console.log('✅ Налаштування скинуто:', defaultSettings);
        
    } catch (error) {
        console.error('❌ Помилка скидання налаштувань:', error);
        showNotification('Помилка скидання налаштувань', 'error');
    }
}

function calculateMonthlyForecast() {
    try {
        if (!forecastingData.forecasts || !forecastingData.forecasts.data) {
            // Якщо прогноз ще не згенеровано, використовуємо середнє значення продажів
            const salesValues = forecastingData.salesData
                .filter(item => item.Выручка && !isNaN(parseFloat(item.Выручка)))
                .map(item => parseFloat(item.Выручка));
            
            if (salesValues.length === 0) return 0;
            
            const average = salesValues.reduce((sum, val) => sum + val, 0) / salesValues.length;
            return average;
        }
        
        // Отримуємо початковий місяць з налаштувань
        const startMonth = forecastingData.settings?.forecastStartMonth || 0;
        
        // Використовуємо згенерований прогноз для початкового місяця
        return forecastingData.forecasts.data[startMonth] || 0;
    } catch (error) {
        console.error('❌ Помилка розрахунку місячного прогнозу:', error);
        return 0;
    }
}

function calculateQuarterlyForecast() {
    try {
        if (!forecastingData.forecasts || !forecastingData.forecasts.data) {
            const salesValues = forecastingData.salesData
                .filter(item => item.Выручка && !isNaN(parseFloat(item.Выручка)))
                .map(item => parseFloat(item.Выручка));
            
            if (salesValues.length === 0) return 0;
            
            const average = salesValues.reduce((sum, val) => sum + val, 0) / salesValues.length;
            return average * 3; // Квартальний прогноз
        }
        
        // Використовуємо згенерований прогноз - сума перших 3 місяців
        const monthlyForecasts = forecastingData.forecasts.data.slice(0, 3);
        return monthlyForecasts.reduce((sum, val) => sum + (val || 0), 0);
    } catch (error) {
        console.error('❌ Помилка розрахунку квартального прогнозу:', error);
        return 0;
    }
}

function calculateHalfYearForecast() {
    try {
        if (!forecastingData.forecasts || !forecastingData.forecasts.data) {
            const salesValues = forecastingData.salesData
                .filter(item => item.Выручка && !isNaN(parseFloat(item.Выручка)))
                .map(item => parseFloat(item.Выручка));
            
            if (salesValues.length === 0) return 0;
            
            const average = salesValues.reduce((sum, val) => sum + val, 0) / salesValues.length;
            return average * 6; // Піврічний прогноз
        }
        
        // Використовуємо згенерований прогноз - сума перших 6 місяців
        const monthlyForecasts = forecastingData.forecasts.data.slice(0, 6);
        return monthlyForecasts.reduce((sum, val) => sum + (val || 0), 0);
    } catch (error) {
        console.error('❌ Помилка розрахунку піврічного прогнозу:', error);
        return 0;
    }
}

// Нова функція для форматування періоду планування
function formatPlanningPeriod(periodType, startMonth = 0) {
    const months = [
        'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
        'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
    ];
    
    // Отримуємо налаштування з глобальних даних
    const settings = forecastingData.settings || {};
    const forecastStartMonth = settings.forecastStartMonth || 0;
    const forecastStartYear = settings.forecastStartYear || new Date().getFullYear();
    
    // Визначаємо початковий місяць для прогнозу
    const startMonthIndex = forecastStartMonth % 12;
    const startYear = forecastStartYear;
    
    switch (periodType) {
        case 'month':
            return `${months[startMonthIndex]} ${startYear}`;
        case 'quarter':
            const quarter = Math.floor(startMonthIndex / 3) + 1;
            const quarterMonths = [];
            for (let i = 0; i < 3; i++) {
                const monthIndex = (startMonthIndex + i) % 12;
                const year = startYear + Math.floor((startMonthIndex + i) / 12);
                quarterMonths.push(`${months[monthIndex]} ${year}`);
            }
            return `${quarter} квартал ${startYear} (${quarterMonths.join(', ')})`;
        case 'half_year':
            const halfYearMonths = [];
            for (let i = 0; i < 6; i++) {
                const monthIndex = (startMonthIndex + i) % 12;
                const year = startYear + Math.floor((startMonthIndex + i) / 12);
                halfYearMonths.push(`${months[monthIndex]} ${year}`);
            }
            const halfYearNumber = Math.floor(startMonthIndex / 6) + 1;
            return `${halfYearNumber} півріччя ${startYear} (${halfYearMonths.join(', ')})`;
        case 'year':
            const yearMonths = [];
            for (let i = 0; i < 12; i++) {
                const monthIndex = (startMonthIndex + i) % 12;
                const year = startYear + Math.floor((startMonthIndex + i) / 12);
                yearMonths.push(`${months[monthIndex]} ${year}`);
            }
            return `${startYear} рік (${yearMonths.join(', ')})`;
        default:
            return `${months[startMonthIndex]} ${startYear}`;
    }
}

// Нова функція для отримання детального прогнозу по періодах
function getDetailedForecast(periodType) {
    if (!forecastingData.forecasts || !forecastingData.forecasts.data) {
        return null;
    }
    
    const forecastData = forecastingData.forecasts.data;
    const months = [
        'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
        'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
    ];
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    switch (periodType) {
        case 'month':
            return [{
                period: formatPlanningPeriod('month'),
                value: forecastData[0] || 0
            }];
        case 'quarter':
            return forecastData.slice(0, 3).map((value, index) => {
                const monthIndex = (currentMonth + index) % 12;
                const year = currentYear + Math.floor((currentMonth + index) / 12);
                return {
                    period: `${months[monthIndex]} ${year}`,
                    value: value || 0
                };
            });
        case 'half_year':
            return forecastData.slice(0, 6).map((value, index) => {
                const monthIndex = (currentMonth + index) % 12;
                const year = currentYear + Math.floor((currentMonth + index) / 12);
                return {
                    period: `${months[monthIndex]} ${year}`,
                    value: value || 0
                };
            });
        case 'year':
            return forecastData.slice(0, 12).map((value, index) => {
                const monthIndex = (currentMonth + index) % 12;
                const year = currentYear + Math.floor((currentMonth + index) / 12);
                return {
                    period: `${months[monthIndex]} ${year}`,
                    value: value || 0
                };
            });
        default:
            return [{
                period: formatPlanningPeriod('month'),
                value: forecastData[0] || 0
            }];
    }
}

// Стара функція видалена - використовується loadHierarchicalForecastsUpdated

// Функції для розгортання/згортання секцій
window.toggleDepartmentForecast = function(deptId) {
    const content = document.getElementById(`content-${deptId}`);
    const arrow = document.getElementById(`arrow-${deptId}`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
    } else {
        content.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
};

window.toggleManagerForecast = function(managerId) {
    const content = document.getElementById(`content-${managerId}`);
    const arrow = document.getElementById(`arrow-${managerId}`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
    } else {
        content.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
};

// Функція для показу модального вікна з клієнтами менеджера
window.showManagerClientsModal = function(managerName) {
    console.log('👥 Показуємо клієнтів менеджера:', managerName);
    
    // Знаходимо клієнтів менеджера
    const managerClients = Object.entries(forecastingData.clientManagerDirectory)
        .filter(([code, info]) => info && managerName && info.trim() === managerName.trim())
        .map(([code, info]) => {
            // Розраховуємо прогноз по клієнту
            const clientSales = forecastingData.salesData
                .filter(item => item['Клиент.Код'] === code && item.Выручка)
                .map(item => parseFloat(item.Выручка));
            
            let clientForecast = 0;
            if (clientSales.length > 0) {
                clientForecast = clientSales.reduce((sum, val) => sum + val, 0) / clientSales.length;
            }
            
            return {
                code,
                name: info,
                forecast: clientForecast,
                salesCount: clientSales.length
            };
        })
        .sort((a, b) => b.forecast - a.forecast); // Сортуємо за спаданням прогнозу
    
    // Створюємо модальне вікно
    const modalHtml = `
        <div id="managerClientsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-white">Клієнти менеджера: ${managerName}</h3>
                    <button onclick="closeManagerClientsModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <div class="mb-4 text-sm text-gray-400">
                    Всього клієнтів: ${managerClients.length}
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-700">
                                <th class="text-left py-2 text-gray-300">Код клієнта</th>
                                <th class="text-left py-2 text-gray-300">Назва клієнта</th>
                                <th class="text-right py-2 text-gray-300">Прогноз продажів</th>
                                <th class="text-right py-2 text-gray-300">Кількість продажів</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${managerClients.map(client => `
                                <tr class="border-b border-gray-700 hover:bg-gray-700">
                                    <td class="py-2 text-gray-200">${client.code}</td>
                                    <td class="py-2 text-gray-200">${client.name}</td>
                                    <td class="py-2 text-right text-green-400 font-semibold">${formatCurrency(client.forecast)}</td>
                                    <td class="py-2 text-right text-gray-400">${client.salesCount}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-4 text-right">
                    <button onclick="closeManagerClientsModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                        Закрити
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Додаємо модальне вікно до DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeManagerClientsModal = function() {
    const modal = document.getElementById('managerClientsModal');
    if (modal) {
        modal.remove();
    }
};

// Оновлена функція loadHierarchicalForecasts з кнопкою для модального вікна
function loadHierarchicalForecastsUpdated() {
    console.log('🏢 Завантаження ієрархічних прогнозів...');
    console.log('👤 UserAccess:', userAccess);
    console.log('👥 ManagersData:', managersData);
    console.log('🏢 DepartmentsData:', departmentsData);
    
    const container = document.getElementById('hierarchicalForecasts');
    if (!container) {
        console.error('❌ Контейнер hierarchicalForecasts не знайдено!');
        // Спробуємо ще раз через 200мс
        setTimeout(() => {
            const retryContainer = document.getElementById('hierarchicalForecasts');
            if (retryContainer) {
                console.log('✅ Контейнер знайдено при повторній спробі');
                loadHierarchicalForecastsUpdated();
            } else {
                console.error('❌ Контейнер все ще не знайдено після повторної спроби');
            }
        }, 200);
        return;
    }

    // Функції управління завантаженням
    function updateHierarchicalProgress(percent, message, step) {
        const progressBar = container.querySelector('#hierarchical-progress-bar');
        const loadingMessage = container.querySelector('#hierarchical-loading-message');
        const loadingStep = container.querySelector('#hierarchical-loading-step');
        
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingStep) loadingStep.textContent = step;
    }

    // Показуємо анімацію завантаження з прогресом
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <div>
                <p id="hierarchical-loading-message" class="text-lg font-medium text-gray-200 mb-2">Завантаження ієрархічних прогнозів...</p>
                <div class="bg-gray-700 rounded-full h-2 max-w-md mx-auto mb-2">
                    <div id="hierarchical-progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
                <p id="hierarchical-loading-step" class="text-sm text-gray-400">Ініціалізація...</p>
            </div>
        </div>
    `;

    // Використовуємо setTimeout для імітації процесу завантаження
    setTimeout(() => {
        updateHierarchicalProgress(20, 'Перевірка даних...', 'Завантаження менеджерів та відділів');
        
        setTimeout(() => {
            updateHierarchicalProgress(40, 'Обробка даних...', 'Фільтрація доступних відділів');
            
            setTimeout(() => {
                updateHierarchicalProgress(60, 'Розрахунок прогнозів...', 'Аналіз клієнтів по менеджерах');
                
                setTimeout(() => {
                    updateHierarchicalProgress(80, 'Формування результатів...', 'Створення ієрархічної структури');
                    
                    setTimeout(() => {
                        updateHierarchicalProgress(100, 'Завершення...', 'Фіналізація відображення');
                        
                        setTimeout(() => {
                            // Тепер виконуємо основну логіку
                            processHierarchicalForecasts();
                        }, 300);
                    }, 200);
                }, 300);
            }, 300);
        }, 300);
    }, 200);
}

// Винесена логіка обробки ієрархічних прогнозів
function processHierarchicalForecasts() {
    try {
        // Перевіряємо наявність даних
        if (!managersData || managersData.length === 0) {
            managersData = [
                { id: 'emp1', name: 'Іван Петренко', department: 'dept1' },
                { id: 'emp2', name: 'Марія Коваленко', department: 'dept1' },
                { id: 'emp3', name: 'Олександр Сидоренко', department: 'dept2' }
            ];
        }
        
        if (!departmentsData || departmentsData.length === 0) {
            departmentsData = [
                { id: 'dept1', name: 'Відділ продажів' },
                { id: 'dept2', name: 'Відділ маркетингу' }
            ];
        }
        
        if (!forecastingData.clientManagerDirectory) {
            forecastingData.clientManagerDirectory = {};
        }
        
        if (!forecastingData.salesData) {
            forecastingData.salesData = [];
        }
        
        if (!forecastingData.forecasts) {
            forecastingData.forecasts = { data: [] };
        }
        
        if (!forecastingData.settings) {
            forecastingData.settings = {};
        }
        
        // Фільтруємо відділи з Firebase даних
        let visibleDepartments = departmentsData;
        if (!userAccess.isAdmin && userAccess.departmentId) {
            if (userAccess.role && (userAccess.role.includes('менедж') || userAccess.role.includes('керівник'))) {
                visibleDepartments = departmentsData.filter(dep => dep.id === userAccess.departmentId);
            }
        }
        
        const container = document.getElementById('hierarchicalForecasts');
        if (!container) {
            console.error('❌ Контейнер hierarchicalForecasts не знайдено!');
            return;
        }
        
        if (visibleDepartments.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 mb-4">
                    <div class="text-yellow-400 text-sm">⚠️ Немає доступних відділів</div>
                    <div class="text-gray-500 text-xs">Перевірте налаштування Firebase</div>
                </div>
            `;
            return;
        }
        
        // Додаємо повідомлення про тестові дані, якщо вони використовуються
        let testDataMessage = '';
        if (managersData.length > 0 && managersData[0].id === 'emp1') {
            testDataMessage = `
                <div class="text-center py-4 mb-4">
                    <div class="text-yellow-400 text-sm">⚠️ Використовуються тестові дані</div>
                    <div class="text-gray-500 text-xs">Для відображення реальних даних налаштуйте Firebase</div>
                </div>
            `;
        }
        
        container.innerHTML = testDataMessage + visibleDepartments.map(dept => {
            // Знаходимо менеджерів цього відділу
            const departmentManagers = managersData.filter(emp => {
                if (!emp.department) {
                    return false;
                }
                if (typeof emp.department === 'object' && emp.department.id) {
                    return emp.department.id === dept.id;
                } else if (typeof emp.department === 'string') {
                    return emp.department === dept.id;
                }
                return false;
            });
            
            // Розраховуємо прогноз по відділу (СУМА всіх менеджерів)
            let departmentTotalForecast = 0;
            const managerForecasts = departmentManagers.map(manager => {
                // Знаходимо клієнтів менеджера
                const managerClients = Object.entries(forecastingData.clientManagerDirectory || {})
                    .filter(([code, info]) => {
                        if (!info || !manager.name) {
                            return false;
                        }
                        
                        // Покращена логіка зіставлення менеджерів
                        return matchManagerName(info.trim(), manager.name.trim());
                    })
                    .map(([code, info]) => code);
                
                // Якщо немає клієнтів, використовуємо тестові дані
                let finalManagerClients = managerClients;
                if (managerClients.length === 0) {
                    finalManagerClients = [
                        `CLIENT_${manager.id}_1`,
                        `CLIENT_${manager.id}_2`,
                        `CLIENT_${manager.id}_3`
                    ];
                }
                
                // Розраховуємо прогноз по менеджеру (СУМА всіх клієнтів)
                let managerTotalForecast = 0;
                const clientForecasts = finalManagerClients.map(clientCode => {
                    let clientForecast = 0;
                    
                    // Отримуємо історичні продажі клієнта
                    const clientSales = (forecastingData.salesData || [])
                        .filter(item => item['Клиент.Код'] === clientCode && item.Выручка)
                        .map(item => parseFloat(item.Выручка));
                    
                    if (clientSales.length > 0) {
                        // Використовуємо готові прогнози з загального прогнозу
                        if (forecastingData.forecasts && forecastingData.forecasts.algorithm === 'client-lifecycle') {
                            // Для алгоритму життєвого циклу використовуємо готові детальні прогнози
                            const clientForecastData = forecastingData.forecasts.details?.clientForecasts?.[clientCode];
                            if (clientForecastData && clientForecastData.forecast && clientForecastData.forecast.length > 0) {
                                // Використовуємо суму всіх місяців прогнозу
                                clientForecast = clientForecastData.forecast.reduce((sum, val) => sum + val, 0);
                            } else {
                                // Якщо немає детального прогнозу, прогноз дорівнює нулю
                                clientForecast = 0;
                            }
                        } else {
                            // Для інших алгоритмів розраховуємо долю клієнта в загальних продажах
                            const totalHistoricalSales = (forecastingData.salesData || [])
                                .filter(item => item.Выручка)
                                .reduce((sum, item) => sum + parseFloat(item.Выручка), 0);
                            
                            if (totalHistoricalSales > 0) {
                                const clientHistoricalSales = clientSales.reduce((sum, val) => sum + val, 0);
                                const clientShare = clientHistoricalSales / totalHistoricalSales;
                                
                                // Розподіляємо загальний прогноз пропорційно долі клієнта
                                const totalForecast = forecastingData.forecasts.data.reduce((sum, val) => sum + val, 0);
                                clientForecast = totalForecast * clientShare;
                            } else {
                                // Якщо немає історичних даних, прогноз дорівнює нулю
                                clientForecast = 0;
                            }
                        }
                    } else {
                        // Клієнт без історії продажів - прогноз дорівнює нулю
                        clientForecast = 0;
                    }
                    
                    managerTotalForecast += clientForecast;
                    return { clientCode, clientForecast };
                });
                
                departmentTotalForecast += managerTotalForecast;
                
                return {
                    manager,
                    managerTotalForecast,
                    clientForecasts,
                    clientCount: managerClients.length
                };
            });
            
            const safeDeptId = `dept-${dept.id}`.replace(/[^\w-]/g, '_');
            
            return `
                <div class="bg-gray-800 rounded-lg border border-gray-700">
                    <!-- Заголовок відділу -->
                    <div class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-750 transition-colors" 
                         onclick="toggleDepartmentForecast('${safeDeptId}')">
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-gray-400 transition-transform duration-200" id="arrow-${safeDeptId}" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                            </svg>
                            <h5 class="text-lg font-semibold text-white">${dept.name}</h5>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-bold text-blue-400">${formatCurrency(departmentTotalForecast)}</div>
                            <div class="text-sm text-gray-400">${departmentManagers.length} менеджерів</div>
                        </div>
                    </div>
                    
                    <!-- Деталі відділу (спочатку приховані) -->
                    <div id="content-${safeDeptId}" class="hidden px-4 pb-4">
                        <div class="space-y-4">
                            ${managerForecasts.map(({ manager, managerTotalForecast, clientForecasts, clientCount }) => {
                                const safeManagerId = `manager-${manager.id}`.replace(/[^\w-]/g, '_');
                                
                                return `
                                    <div class="bg-gray-700 rounded-lg border border-gray-600">
                                        <!-- Заголовок менеджера -->
                                        <div class="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-650 transition-colors" 
                                             onclick="toggleManagerForecast('${safeManagerId}')">
                                            <div class="flex items-center gap-3">
                                                <svg class="w-4 h-4 text-gray-400 transition-transform duration-200" id="arrow-${safeManagerId}" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                                                </svg>
                                                <span class="text-white font-medium">${manager.name}</span>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-lg font-bold text-purple-400">${formatCurrency(managerTotalForecast)}</div>
                                                <div class="text-sm text-gray-400">${clientCount} клієнтів</div>
                                            </div>
                                        </div>
                                        
                                        <!-- Деталі менеджера (спочатку приховані) -->
                                        <div id="content-${safeManagerId}" class="hidden px-3 pb-3">
                                            <div class="flex justify-between items-center mb-3">
                                                <span class="text-gray-400 text-sm">Топ клієнтів:</span>
                                                <button onclick="showManagerClientsModal('${manager.name}')" 
                                                        class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                                    👥 Всі клієнти (${clientCount})
                                                </button>
                                            </div>
                                            <div class="space-y-2">
                                                ${clientForecasts.slice(0, 10).map(({ clientCode, clientForecast }) => {
                                                    const clientName = forecastingData.clientManagerDirectory[clientCode]?.name || clientCode;
                                                    
                                                    return `
                                                        <div class="flex justify-between items-center p-2 bg-gray-600 rounded">
                                                            <span class="text-gray-200 text-sm">${clientName}</span>
                                                            <span class="text-green-400 font-semibold text-sm">${formatCurrency(clientForecast)}</span>
                                                        </div>
                                                    `;
                                                }).join('')}
                                                ${clientForecasts.length > 10 ? `
                                                    <div class="text-center py-2">
                                                        <span class="text-gray-400 text-sm">... та ще ${clientForecasts.length - 10} клієнтів</span>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Ієрархічні прогнози завантажено успішно
        
    } catch (error) {
        console.error('❌ Помилка завантаження ієрархічних прогнозів:', error);
        console.error('🔍 Деталі помилки:', error.stack);
    }
}

// Функції для перемикання відображення
function toggleDepartmentForecast(deptId) {
    const content = document.getElementById(`content-${deptId}`);
    const arrow = document.getElementById(`arrow-${deptId}`);
    
    if (content && arrow) {
        const isHidden = content.classList.contains('hidden');
        content.classList.toggle('hidden');
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    }
}

function toggleManagerForecast(managerId) {
    const content = document.getElementById(`content-${managerId}`);
    const arrow = document.getElementById(`arrow-${managerId}`);
    
    if (content && arrow) {
        const isHidden = content.classList.contains('hidden');
        content.classList.toggle('hidden');
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    }
}

function showManagerClientsModal(managerName) {
    // Проста модаль для відображення клієнтів менеджера
    alert(`Клієнти менеджера ${managerName}:\n\nЦя функція буде реалізована в наступному оновленні.`);
}



// Вспомогательные функции
function formatCurrency(amount) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 0
    }).format(amount || 0);
}

function getCompletionColor(plan, fact) {
    const percentage = getCompletionPercentage(plan, fact);
    if (percentage >= 100) return 'text-green-400';
    if (percentage >= 80) return 'text-yellow-400';
    return 'text-red-400';
}

function getCompletionPercentage(plan, fact) {
    if (!plan || plan === 0) return 0;
    return Math.round((fact || 0) / plan * 100);
}

// Заглушки для функцій
function initForecastingCharts() {
    console.log('📊 Ініціалізація графіків...');
}

function generateNomenclatureOptions() {
    console.log('📋 Генерація опцій номенклатури...');
    
    const select = document.getElementById('excludedNomenclatureSelect');
    if (!select) return;
    
    // Очищаємо поточні опції
    select.innerHTML = '<option value="">Виберіть номенклатуру для виключення</option>';
    
    // Отримуємо унікальні назви номенклатури з даних
    const nomenclatureSet = new Set();
    
    forecastingData.salesData.forEach(item => {
        if (item['Номенклатура'] && typeof item['Номенклатура'] === 'string') {
            nomenclatureSet.add(item['Номенклатура']);
        }
        if (item['Номенклатура.Наименование'] && typeof item['Номенклатура.Наименование'] === 'string') {
            nomenclatureSet.add(item['Номенклатура.Наименование']);
        }
    });
    
    // Додаємо опції до select
    const nomenclatureArray = Array.from(nomenclatureSet).sort();
    nomenclatureArray.forEach(nomenclature => {
        const option = document.createElement('option');
        option.value = nomenclature;
        option.textContent = nomenclature;
        select.appendChild(option);
    });
    
    console.log(`📋 Згенеровано ${nomenclatureArray.length} опцій номенклатури`);
}

function updateForecastStartDisplay() {
    const displayElement = document.getElementById('currentForecastStartDisplay');
    const monthYearInput = document.getElementById('forecastStartMonthYear');
    
    if (displayElement && monthYearInput && monthYearInput.value) {
        const [year, month] = monthYearInput.value.split('-');
        const targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const months = [
            'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
            'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
        ];
        displayElement.textContent = `${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
    }
}

function initSettingsHandlers() {
    console.log('⚙️ Ініціалізація обробників налаштувань...');
    
    // Додаємо обробник для календаря
    const forecastStartMonthYearInput = document.getElementById('forecastStartMonthYear');
    if (forecastStartMonthYearInput) {
        forecastStartMonthYearInput.addEventListener('change', () => {
            console.log('📅 Змінено початковий місяць/рік:', forecastStartMonthYearInput.value);
            updateForecastStartDisplay();
        });
    }
}

// Функція для показу повідомлень
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        'bg-blue-600 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Автоматично видаляємо через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Функции для управления модальным окном загрузки
function showLoadingModal() {
    const modal = document.getElementById('forecastingLoadingModal');
    if (modal) modal.classList.remove('hidden');
}

function hideLoadingModal() {
    const modal = document.getElementById('forecastingLoadingModal');
    if (modal) modal.classList.add('hidden');
}

function updateLoadingModal(progress, status) {
    const progressBar = document.getElementById('loadingModalProgressBar');
    const statusText = document.getElementById('loadingModalStatus');
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (statusText) statusText.textContent = status;
}

// Делаем функцию доступной глобально для использования в ui.js
window.initForecastingModule = initForecastingModule;

// Робимо всі функції глобально доступними
window.formatPlanningPeriod = formatPlanningPeriod;
window.getDetailedForecast = getDetailedForecast;
window.calculateMonthlyForecast = calculateMonthlyForecast;
window.calculateQuarterlyForecast = calculateQuarterlyForecast;
window.calculateHalfYearForecast = calculateHalfYearForecast;
window.generateForecast = generateForecast;
window.loadHierarchicalForecasts = loadHierarchicalForecastsUpdated;
window.renderForecastsTab = renderForecastsTab;
window.renderSettingsTab = renderSettingsTab;
window.renderPlansTab = renderPlansTab;
window.loadForecastingPlans = loadForecastingPlans;
window.createForecastingPlan = createForecastingPlan;
window.editForecastingPlan = editForecastingPlan;
window.deleteForecastingPlan = deleteForecastingPlan;
window.addExcludedNomenclature = addExcludedNomenclature;
window.removeExcludedNomenclature = removeExcludedNomenclature;
window.saveForecastingSettings = saveForecastingSettings;
window.resetForecastingSettings = resetForecastingSettings;
window.initForecastingCharts = initForecastingCharts;
window.generateNomenclatureOptions = generateNomenclatureOptions;
window.initSettingsHandlers = initSettingsHandlers;
window.formatCurrency = formatCurrency;
window.getCompletionColor = getCompletionColor;
window.getCompletionPercentage = getCompletionPercentage;

// Функція для покращеного зіставлення імен менеджерів
function matchManagerName(clientManagerName, firebaseManagerName) {
    if (!clientManagerName || !firebaseManagerName) {
        return false;
    }
    
    // Нормалізуємо імена (прибираємо зайві пробіли, приводимо до нижнього регістру)
    const normalizeName = (name) => {
        return name.toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[ії]/g, 'i') // Нормалізуємо українські літери
            .replace(/[є]/g, 'e')
            .replace(/[ї]/g, 'i');
    };
    
    const normalizedClient = normalizeName(clientManagerName);
    const normalizedFirebase = normalizeName(firebaseManagerName);
    
    // Точне зіставлення
    if (normalizedClient === normalizedFirebase) {
        return true;
    }
    
    // Часткове зіставлення (якщо одне ім'я містить інше)
    if (normalizedClient.includes(normalizedFirebase) || normalizedFirebase.includes(normalizedClient)) {
        return true;
    }
    
    // Зіставлення по прізвищу (останнє слово)
    const clientWords = normalizedClient.split(' ');
    const firebaseWords = normalizedFirebase.split(' ');
    
    if (clientWords.length > 0 && firebaseWords.length > 0) {
        const clientLastName = clientWords[clientWords.length - 1];
        const firebaseLastName = firebaseWords[firebaseWords.length - 1];
        
        if (clientLastName === firebaseLastName) {
            return true;
        }
    }
    
    return false;
}

// Функція для рендерингу статистики по життєвому циклу
function renderLifecycleStats(clientForecasts) {
    const lifecycleStats = {
        new: { count: 0, totalForecast: 0 },
        growing: { count: 0, totalForecast: 0 },
        active: { count: 0, totalForecast: 0 },
        'at-risk': { count: 0, totalForecast: 0 }
    };
    
    Object.values(clientForecasts).forEach(client => {
        const stage = client.lifecycleStage;
        if (lifecycleStats[stage]) {
            lifecycleStats[stage].count++;
            lifecycleStats[stage].totalForecast += client.forecast.reduce((sum, val) => sum + val, 0);
        }
    });
    
    const stageNames = {
        new: 'Нові клієнти',
        growing: 'Розвиваючіся',
        active: 'Активні',
        'at-risk': 'Група ризику'
    };
    
    const stageColors = {
        new: 'text-blue-400',
        growing: 'text-green-400',
        active: 'text-purple-400',
        'at-risk': 'text-red-400'
    };
    
    return Object.entries(lifecycleStats).map(([stage, stats]) => `
        <div class="text-center p-4 bg-gray-700 rounded-lg">
            <div class="text-2xl font-bold ${stageColors[stage]}">${stats.count}</div>
            <div class="text-sm text-gray-400 mb-2">${stageNames[stage]}</div>
            <div class="text-xs text-gray-500">${formatCurrency(stats.totalForecast)} прогноз</div>
        </div>
    `).join('');
}

// Функція для рендерингу топ клієнтів
function renderTopClients(clientForecasts) {
    const topClients = Object.entries(clientForecasts)
        .map(([code, client]) => ({
            code,
            ...client,
            yearlyForecast: client.forecast.reduce((sum, val) => sum + val, 0)
        }))
        .sort((a, b) => b.yearlyForecast - a.yearlyForecast)
        .slice(0, 10);
    
    const stageNames = {
        new: 'Новий',
        growing: 'Розвивається',
        active: 'Активний',
        'at-risk': 'Ризик'
    };
    
    const stageColors = {
        new: 'text-blue-400',
        growing: 'text-green-400',
        active: 'text-purple-400',
        'at-risk': 'text-red-400'
    };
    
    return topClients.map(client => `
        <tr class="border-b border-gray-700 hover:bg-gray-700">
            <td class="py-2 text-gray-200">${client.code}</td>
            <td class="py-2 text-right">
                <span class="${stageColors[client.lifecycleStage]}">${stageNames[client.lifecycleStage]}</span>
            </td>
            <td class="py-2 text-right text-gray-200">${formatCurrency(client.averageOrderValue)}</td>
            <td class="py-2 text-right text-green-400 font-semibold">${formatCurrency(client.yearlyForecast)}</td>
            <td class="py-2 text-right">
                <span class="text-sm ${client.confidence > 0.7 ? 'text-green-400' : client.confidence > 0.4 ? 'text-yellow-400' : 'text-red-400'}">
                    ${Math.round(client.confidence * 100)}%
                </span>
            </td>
        </tr>
    `).join('');
}

// Рендер вкладки налаштувань
function renderSettingsTab() {
    console.log('⚙️ Рендеримо вкладку налаштувань...');
    
    const container = document.getElementById('settingsTab');
    if (!container) {
        console.error('❌ Контейнер settingsTab не знайдено!');
        return;
    }
    
    // Отримуємо поточні налаштування
    const settings = forecastingData.settings || {};
    const currentDate = new Date();
    const defaultStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const defaultEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
    
    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <h3 class="text-xl font-semibold text-white">Налаштування прогнозування</h3>
                <div class="flex gap-2">
                    <button onclick="saveForecastingSettings()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        💾 Зберегти налаштування
                    </button>
                    <button onclick="resetForecastingSettings()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                        🔄 Скинути
                    </button>
                </div>
            </div>
            
                                 <!-- Період прогнозування -->
                     <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                         <h4 class="text-lg font-semibold text-white mb-4">📅 Період прогнозування</h4>
                         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                 <label class="block text-sm font-medium text-gray-300 mb-2">Дата початку аналізу</label>
                                 <input type="date" id="forecastStartDate" class="dark-input w-full"
                                        value="${settings.forecastStartDate || defaultStartDate}">
                             </div>
                             <div>
                                 <label class="block text-sm font-medium text-gray-300 mb-2">Дата кінця аналізу</label>
                                 <input type="date" id="forecastEndDate" class="dark-input w-full"
                                        value="${settings.forecastEndDate || defaultEndDate}">
                             </div>
                         </div>
                         <p class="text-sm text-gray-400 mt-2">Вкажіть період для аналізу даних та генерації прогнозу</p>
                     </div>
                     
                     <!-- Початковий місяць прогнозування -->
                     <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                         <h4 class="text-lg font-semibold text-white mb-4">🎯 Початковий місяць прогнозування</h4>
                         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                 <label class="block text-sm font-medium text-gray-300 mb-2">Початкова дата прогнозування</label>
                                 <input type="month" id="forecastStartMonthYear" class="dark-input w-full"
                                        value="${(() => {
                                            const settings = forecastingData.settings || {};
                                            const startMonth = settings.forecastStartMonth || 0;
                                            const startYear = settings.forecastStartYear || new Date().getFullYear();
                                            const currentDate = new Date();
                                            const targetDate = new Date(startYear, currentDate.getMonth() + startMonth, 1);
                                            return targetDate.toISOString().slice(0, 7);
                                        })()}">
                             </div>
                             <div>
                                 <label class="block text-sm font-medium text-gray-300 mb-2">Поточний вибір</label>
                                 <div class="text-sm text-gray-400 p-2 bg-gray-700 rounded">
                                     <span id="currentForecastStartDisplay">
                                         ${(() => {
                                             const settings = forecastingData.settings || {};
                                             const startMonth = settings.forecastStartMonth || 0;
                                             const startYear = settings.forecastStartYear || new Date().getFullYear();
                                             const currentDate = new Date();
                                             const targetDate = new Date(startYear, currentDate.getMonth() + startMonth, 1);
                                             const months = [
                                                 'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
                                                 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
                                             ];
                                             return `${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
                                         })()}
                                     </span>
                                 </div>
                             </div>
                         </div>
                         <p class="text-sm text-gray-400 mt-2">Виберіть місяць та рік для початку прогнозування</p>
                     </div>
            
            <!-- Налаштування алгоритмів -->
            <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 class="text-lg font-semibold text-white mb-4">🤖 Налаштування алгоритмів</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Кількість періодів прогнозу</label>
                        <input type="number" id="forecastPeriods" class="dark-input w-full" 
                               value="${settings.forecastPeriods || 12}" min="1" max="60">
                        <p class="text-xs text-gray-400 mt-1">Кількість місяців для прогнозування (1-60)</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Довіра до прогнозу (%)</label>
                        <input type="number" id="forecastConfidence" class="dark-input w-full" 
                               value="${settings.forecastConfidence || 80}" min="1" max="100">
                        <p class="text-xs text-gray-400 mt-1">Рівень довіри до результатів прогнозування</p>
                    </div>
                </div>
            </div>
            
            <!-- Виключення номенклатури -->
            <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 class="text-lg font-semibold text-white mb-4">🚫 Виключення номенклатури</h4>
                <div class="space-y-4">
                    <div class="flex gap-2">
                        <select id="excludedNomenclatureSelect" class="dark-input flex-1">
                            <option value="">Виберіть номенклатуру для виключення</option>
                        </select>
                        <button onclick="addExcludedNomenclature()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            ➕ Додати
                        </button>
                    </div>
                    <div id="excludedNomenclatureList" class="space-y-2">
                        ${(settings.excludedNomenclature || []).map(item => `
                            <div class="flex justify-between items-center bg-gray-700 rounded p-2">
                                <span class="text-gray-200">${item}</span>
                                <button onclick="removeExcludedNomenclature('${item}')" class="text-red-400 hover:text-red-300">
                                    🗑️
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Налаштування сезонності -->
            <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 class="text-lg font-semibold text-white mb-4">🌤️ Налаштування сезонності</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Довжина сезону (місяців)</label>
                        <input type="number" id="seasonLength" class="dark-input w-full" 
                               value="${settings.seasonLength || 12}" min="1" max="24">
                        <p class="text-xs text-gray-400 mt-1">Кількість місяців в сезонному циклі</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Врахування сезонності</label>
                        <select id="seasonalAdjustment" class="dark-input w-full">
                            <option value="auto" ${settings.seasonalAdjustment === 'auto' ? 'selected' : ''}>Автоматично</option>
                            <option value="manual" ${settings.seasonalAdjustment === 'manual' ? 'selected' : ''}>Ручне налаштування</option>
                            <option value="none" ${settings.seasonalAdjustment === 'none' ? 'selected' : ''}>Без сезонності</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Налаштування клієнтів -->
            <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 class="text-lg font-semibold text-white mb-4">👥 Налаштування клієнтів</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мінімальна сума замовлення</label>
                        <input type="number" id="minOrderValue" class="dark-input w-full" 
                               value="${settings.minOrderValue || 0}" min="0" step="0.01">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна сума для включення в аналіз</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мінімальна кількість замовлень</label>
                        <input type="number" id="minOrderCount" class="dark-input w-full" 
                               value="${settings.minOrderCount || 1}" min="1">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна кількість замовлень для аналізу клієнта</p>
                    </div>
                </div>
            </div>
            
            <!-- Налаштування життєвого циклу клієнта -->
            <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 class="text-lg font-semibold text-white mb-4">🔄 Налаштування життєвого циклу клієнта</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Кількість замовлень для нового клієнта</label>
                        <input type="number" id="newClientOrders" class="dark-input w-full" 
                               value="${settings.newClientOrders || 1}" min="1">
                        <p class="text-xs text-gray-400 mt-1">Кількість замовлень для визначення нового клієнта</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мін. замовлень для растучого клієнта</label>
                        <input type="number" id="growingClientMinOrders" class="dark-input w-full" 
                               value="${settings.growingClientMinOrders || 5}" min="1">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна кількість замовлень для растучого клієнта</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мін. замовлень для активного клієнта</label>
                        <input type="number" id="activeClientMinOrders" class="dark-input w-full" 
                               value="${settings.activeClientMinOrders || 10}" min="1">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна кількість замовлень для активного клієнта</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Множник для клієнта в групі ризику</label>
                        <input type="number" id="atRiskMultiplier" class="dark-input w-full" 
                               value="${settings.atRiskMultiplier || 3}" min="1" max="10" step="0.1">
                        <p class="text-xs text-gray-400 mt-1">Множник середнього інтервалу для визначення ризику</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Множник для активного клієнта</label>
                        <input type="number" id="activeClientMultiplier" class="dark-input w-full" 
                               value="${settings.activeClientMultiplier || 1.5}" min="1" max="5" step="0.1">
                        <p class="text-xs text-gray-400 mt-1">Множник середнього інтервалу для активного клієнта</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Множник для растучого клієнта</label>
                        <input type="number" id="growingClientMultiplier" class="dark-input w-full" 
                               value="${settings.growingClientMultiplier || 2}" min="1" max="5" step="0.1">
                        <p class="text-xs text-gray-400 mt-1">Множник середнього інтервалу для растучого клієнта</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Зниження прогнозу для ризикових клієнтів (%)</label>
                        <input type="number" id="forecastReductionForAtRisk" class="dark-input w-full" 
                               value="${settings.forecastReductionForAtRisk || 30}" min="0" max="100">
                        <p class="text-xs text-gray-400 mt-1">Відсоток зниження прогнозу для клієнтів в групі ризику</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мін. впевненість для нових клієнтів (%)</label>
                        <input type="number" id="minConfidenceNew" class="dark-input w-full" 
                               value="${settings.minConfidenceNew || 30}" min="0" max="100">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна впевненість прогнозу для нових клієнтів</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мін. впевненість для растучих клієнтів (%)</label>
                        <input type="number" id="minConfidenceGrowing" class="dark-input w-full" 
                               value="${settings.minConfidenceGrowing || 60}" min="0" max="100">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна впевненість прогнозу для растучих клієнтів</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мін. впевненість для активних клієнтів (%)</label>
                        <input type="number" id="minConfidenceActive" class="dark-input w-full" 
                               value="${settings.minConfidenceActive || 80}" min="0" max="100">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна впевненість прогнозу для активних клієнтів</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Мін. впевненість для ризикових клієнтів (%)</label>
                        <input type="number" id="minConfidenceAtRisk" class="dark-input w-full" 
                               value="${settings.minConfidenceAtRisk || 40}" min="0" max="100">
                        <p class="text-xs text-gray-400 mt-1">Мінімальна впевненість прогнозу для клієнтів в групі ризику</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Генеруємо опції для номенклатури
    generateNomenclatureOptions();
    
    // Ініціалізуємо обробники подій
    initSettingsHandlers();
    
    // Оновлюємо відображення поточного вибору
    updateForecastStartDisplay();
}