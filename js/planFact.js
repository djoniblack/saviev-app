// planFact.js - Модуль план-факт
import * as firebase from './firebase.js';

let plansData = [];
let salesData = [];
let managersData = [];
let currentActiveTab = 'overview';

// Демо данные планов
const DEMO_PLANS_DATA = [
    {
        id: "plan-001",
        managerId: "mgr-001",
        managerName: "Іванов Іван",
        department: "Відділ продажу",
        planName: "План продажу на грудень 2024",
        period: "2024-12",
        type: "mixed", // revenue, quantity, mixed
        status: "active",
        targets: [
            {
                id: "target-001",
                name: "Загальна виручка",
                type: "revenue",
                target: 500000,
                current: 320000,
                products: [], // Все товары
                deadline: "2024-12-31"
            },
            {
                id: "target-002", 
                name: "Продажі стаканів",
                type: "quantity",
                target: 1000,
                current: 650,
                products: ["Стакан 360мл", "Стакан 500мл"],
                deadline: "2024-12-31"
            },
            {
                id: "target-003",
                name: "Нові клієнти",
                type: "quantity",
                target: 20,
                current: 12,
                products: [],
                deadline: "2024-12-31"
            }
        ],
        createdAt: "2024-12-01",
        createdBy: "user-001"
    },
    {
        id: "plan-002",
        managerId: "mgr-002", 
        managerName: "Петров Петро",
        department: "Відділ продажу",
        planName: "План на січень 2025",
        period: "2025-01",
        type: "revenue",
        status: "active",
        targets: [
            {
                id: "target-004",
                name: "Виручка від оптових клієнтів",
                type: "revenue",
                target: 300000,
                current: 45000,
                products: [],
                deadline: "2025-01-31"
            }
        ],
        createdAt: "2024-12-15",
        createdBy: "user-002"
    },
    {
        id: "plan-003",
        managerId: "mgr-003", 
        managerName: "Сидоров Сидор",
        department: "Оптовий відділ",
        planName: "Квартальний план Q1 2025",
        period: "2025-Q1",
        type: "mixed",
        status: "draft",
        targets: [
            {
                id: "target-005",
                name: "Оптовий оборот",
                type: "revenue",
                target: 1500000,
                current: 0,
                products: [],
                deadline: "2025-03-31"
            },
            {
                id: "target-006",
                name: "Кількість угод",
                type: "quantity",
                target: 150,
                current: 0,
                products: [],
                deadline: "2025-03-31"
            }
        ],
        createdAt: "2024-12-20",
        createdBy: "user-003"
    }
];

// Демо данные продаж для план-факт
const DEMO_SALES_DATA = [
    { date: "2024-12-01", managerId: "mgr-001", manager: "Іванов Іван", product: "Стакан 360мл", quantity: 50, revenue: 15000 },
    { date: "2024-12-02", managerId: "mgr-001", manager: "Іванов Іван", product: "Стакан 500мл", quantity: 30, revenue: 12000 },
    { date: "2024-12-03", managerId: "mgr-001", manager: "Іванов Іван", product: "Кришка", quantity: 100, revenue: 8000 },
    { date: "2024-12-05", managerId: "mgr-001", manager: "Іванов Іван", product: "Стакан 360мл", quantity: 75, revenue: 22500 },
    { date: "2024-12-10", managerId: "mgr-001", manager: "Іванов Іван", product: "Інший товар", quantity: 20, revenue: 45000 },
    { date: "2024-12-15", managerId: "mgr-001", manager: "Іванов Іван", product: "Стакан 500мл", quantity: 45, revenue: 18000 },
    { date: "2025-01-02", managerId: "mgr-002", manager: "Петров Петро", product: "Товар А", quantity: 10, revenue: 25000 },
    { date: "2025-01-05", managerId: "mgr-002", manager: "Петров Петро", product: "Товар Б", quantity: 15, revenue: 20000 }
];

/**
 * Главная функция инициализации модуля план-факт
 */
export function initPlanFactModule(container) {
    console.log('initPlanFactModule called', container);
    if (!container) return;
    
    // Проверяем права доступа
    if (!window.hasPermission('planfact_view_page')) {
        container.innerHTML = `
            <div class="bg-red-900 rounded-xl shadow-lg p-6 text-center">
                <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
                <p class="text-red-200">У вас немає прав для перегляду модуля План-Факт.</p>
                <p class="text-red-300 text-sm mt-2">Зверніться до адміністратора для надання доступу.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="bg-gray-800 rounded-xl shadow-lg p-6">
            <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-3xl md:text-4xl font-bold text-white">План-Факт</h1>
                    <p class="mt-2 text-gray-400">Планування та контроль виконання цілей</p>
                </div>
                <div class="flex gap-2">
                    ${window.hasPermission('planfact_create_plans') ? `
                        <button onclick="showCreatePlanModal()" 
                                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            + Створити план
                        </button>
                    ` : ''}
                    <button onclick="refreshPlanFactData()" 
                            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        🔄 Оновити
                    </button>
                </div>
            </div>
            <div id="planfact-tabs" class="mb-4"></div>
            <div id="planfact-content" class="mb-4"></div>
        </div>
    `;

    loadPlanFactData();
}

/**
 * Загрузка данных план-факт
 */
async function loadPlanFactData() {
    try {
        showLoadingState();
        
        // Демо данные
        plansData = DEMO_PLANS_DATA;
        salesData = DEMO_SALES_DATA;
        
        // Загрузка менеджеров из Firebase
        const companyId = window.state?.currentCompanyId;
        if (companyId) {
            const employeesSnap = await firebase.getDocs(
                firebase.collection(firebase.db, `companies/${companyId}/employees`)
            );
            managersData = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        hideLoadingState();
        renderPlanFactTabs();
        
        // Показываем активную вкладку
        if (currentActiveTab === 'overview') {
            renderPlansOverview();
        } else {
            renderPlansDashboard();
        }
        
    } catch (error) {
        console.error('Помилка завантаження план-факт:', error);
        showErrorState('Помилка завантаження даних');
    }
}

/**
 * Показать состояние загрузки
 */
function showLoadingState() {
    const contentContainer = document.getElementById('planfact-content');
    if (!contentContainer) return;
    
    contentContainer.innerHTML = `
        <div class="text-center p-8">
            <div class="loader mx-auto mb-4"></div>
            <p class="text-gray-300">Завантаження даних план-факт...</p>
        </div>
    `;
}

/**
 * Скрыть состояние загрузки
 */
function hideLoadingState() {
    // Состояние будет перезаписано в render функциях
}

/**
 * Показать состояние ошибки
 */
function showErrorState(message) {
    const contentContainer = document.getElementById('planfact-content');
    if (!contentContainer) return;
    
    contentContainer.innerHTML = `
        <div class="text-center p-8 bg-red-900 rounded-lg">
            <p class="text-red-200 text-lg">${message}</p>
            <button onclick="loadPlanFactData()" 
                    class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Спробувати знову
            </button>
        </div>
    `;
}

/**
 * Рендеринг вкладок
 */
function renderPlanFactTabs() {
    const tabsContainer = document.getElementById('planfact-tabs');
    if (!tabsContainer) return;
    
    tabsContainer.innerHTML = `
        <div class="flex space-x-1 bg-gray-700 rounded-lg p-1">
            <button onclick="switchPlanFactTab('overview')" 
                    id="tab-overview"
                    class="tab-button px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentActiveTab === 'overview' ? 'bg-white text-gray-900' : 'text-gray-300 hover:text-white'}">
                Огляд планів
            </button>
            <button onclick="switchPlanFactTab('dashboard')" 
                    id="tab-dashboard"
                    class="tab-button px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentActiveTab === 'dashboard' ? 'bg-white text-gray-900' : 'text-gray-300 hover:text-white'}">
                Дашборд виконання
            </button>
        </div>
    `;
}

/**
 * Переключение вкладок
 */
window.switchPlanFactTab = function(tab) {
    currentActiveTab = tab;
    
    // Обновляем активную вкладку
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('bg-white', 'text-gray-900');
        btn.classList.add('text-gray-300', 'hover:text-white');
    });
    
    const activeTab = document.getElementById(`tab-${tab}`);
    if (activeTab) {
        activeTab.classList.add('bg-white', 'text-gray-900');
        activeTab.classList.remove('text-gray-300', 'hover:text-white');
    }
    
    // Отображаем контент вкладки
    switch(tab) {
        case 'overview':
            renderPlansOverview();
            break;
        case 'dashboard':
            renderPlansDashboard();
            break;
    }
};

/**
 * Рендеринг обзора планов
 */
function renderPlansOverview() {
    const contentContainer = document.getElementById('planfact-content');
    if (!contentContainer) return;
    
    const activePlans = plansData.filter(p => p.status === 'active');
    const draftPlans = plansData.filter(p => p.status === 'draft');
    const completedTargets = plansData.reduce((count, plan) => {
        return count + plan.targets.filter(target => target.current >= target.target).length;
    }, 0);
    const totalTargets = plansData.reduce((count, plan) => count + plan.targets.length, 0);
    
    contentContainer.innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div class="bg-blue-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${activePlans.length}</div>
                    <div class="text-sm text-blue-200">Активних планів</div>
                </div>
                <div class="bg-yellow-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${draftPlans.length}</div>
                    <div class="text-sm text-yellow-200">Чернеток</div>
                </div>
                <div class="bg-green-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${completedTargets}</div>
                    <div class="text-sm text-green-200">Виконаних цілей</div>
                </div>
                <div class="bg-purple-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${getAvgCompletion()}%</div>
                    <div class="text-sm text-purple-200">Середнє виконання</div>
                </div>
                <div class="bg-orange-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${formatCurrency(getTotalPlanRevenue())}</div>
                    <div class="text-sm text-orange-200">Загальний план</div>
                </div>
            </div>
            
            <div class="bg-gray-700 rounded-lg overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-800">
                        <tr>
                            <th class="px-4 py-3 text-left text-white">План</th>
                            <th class="px-4 py-3 text-left text-white">Менеджер</th>
                            <th class="px-4 py-3 text-center text-white">Період</th>
                            <th class="px-4 py-3 text-center text-white">Цілей</th>
                            <th class="px-4 py-3 text-center text-white">Виконання</th>
                            <th class="px-4 py-3 text-center text-white">Статус</th>
                            <th class="px-4 py-3 text-center text-white">Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${plansData.map(plan => {
                            const completion = calculatePlanCompletion(plan);
                            return `
                                <tr class="border-b border-gray-600 hover:bg-gray-600">
                                    <td class="px-4 py-3 text-white">
                                        <div class="font-medium">${plan.planName}</div>
                                        <div class="text-sm text-gray-400">${plan.type === 'revenue' ? 'Грошовий' : plan.type === 'quantity' ? 'Кількісний' : 'Змішаний'}</div>
                                    </td>
                                    <td class="px-4 py-3 text-gray-200">
                                        <div>${plan.managerName}</div>
                                        <div class="text-sm text-gray-400">${plan.department}</div>
                                    </td>
                                    <td class="px-4 py-3 text-center text-gray-200">${plan.period}</td>
                                    <td class="px-4 py-3 text-center text-gray-200">${plan.targets.length}</td>
                                    <td class="px-4 py-3 text-center">
                                        <div class="w-full bg-gray-600 rounded-full h-2 mb-1">
                                            <div class="bg-green-500 h-2 rounded-full" style="width: ${completion}%"></div>
                                        </div>
                                        <span class="text-sm text-gray-300">${completion}%</span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <span class="px-2 py-1 rounded-full text-xs ${
                                            plan.status === 'active' ? 'bg-green-600 text-white' : 
                                            plan.status === 'draft' ? 'bg-yellow-600 text-white' :
                                            'bg-gray-600 text-white'
                                        }">
                                            ${plan.status === 'active' ? 'Активний' : plan.status === 'draft' ? 'Чернетка' : 'Завершений'}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <button onclick="showPlanDetails('${plan.id}')" 
                                                class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm mr-1">
                                            Деталі
                                        </button>
                                        <button onclick="editPlan('${plan.id}')" 
                                                class="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm mr-1">
                                            Редагувати
                                        </button>
                                        ${plan.status === 'draft' ? 
                                            `<button onclick="activatePlan('${plan.id}')" 
                                                     class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                                                Активувати
                                            </button>` : ''
                                        }
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Рендеринг дашборда выполнения
 */
function renderPlansDashboard() {
    const contentContainer = document.getElementById('planfact-content');
    if (!contentContainer) return;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const activePlans = plansData.filter(plan => plan.status === 'active');
    
    contentContainer.innerHTML = `
        <div class="space-y-6">
            <div class="bg-gray-700 rounded-lg p-4">
                <h2 class="text-xl font-bold text-white mb-4">Дашборд виконання планів</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${activePlans.map(plan => {
                        const completion = calculatePlanCompletion(plan);
                        return `
                            <div class="bg-gray-800 rounded-lg p-4">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 class="font-bold text-white">${plan.managerName}</h3>
                                        <div class="text-sm text-gray-400">${plan.planName}</div>
                                        <div class="text-xs text-gray-500">${plan.period}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-lg font-bold text-white">${completion}%</div>
                                        <div class="text-xs text-gray-400">виконано</div>
                                    </div>
                                </div>
                                
                                ${plan.targets.map(target => {
                                    const targetCompletion = (target.current / target.target) * 100;
                                    const targetForecast = calculateTargetForecast(target, plan.period);
                                    const isOnTrack = targetForecast >= target.target;
                                    return `
                                        <div class="mb-3 p-3 bg-gray-700 rounded">
                                            <div class="flex justify-between items-center mb-1">
                                                <span class="text-sm text-white">${target.name}</span>
                                                <span class="text-xs px-2 py-1 rounded ${target.type === 'revenue' ? 'bg-green-600' : 'bg-blue-600'} text-white">
                                                    ${target.type === 'revenue' ? 'UAH' : 'шт'}
                                                </span>
                                            </div>
                                            <div class="w-full bg-gray-600 rounded-full h-2 mb-1">
                                                <div class="bg-blue-500 h-2 rounded-full" style="width: ${Math.min(targetCompletion, 100)}%"></div>
                                            </div>
                                            <div class="flex justify-between text-xs text-gray-300 mb-1">
                                                <span>${target.type === 'revenue' ? formatCurrency(target.current) : target.current} / ${target.type === 'revenue' ? formatCurrency(target.target) : target.target}</span>
                                                <span>${targetCompletion.toFixed(1)}%</span>
                                            </div>
                                            <div class="flex justify-between items-center text-xs">
                                                <span class="text-gray-400">Прогноз:</span>
                                                <span class="font-medium ${isOnTrack ? 'text-green-400' : 'text-red-400'}">
                                                    ${target.type === 'revenue' ? formatCurrency(targetForecast) : targetForecast}
                                                    ${isOnTrack ? '✓' : '⚠️'}
                                                </span>
                                            </div>
                                            ${target.products.length > 0 ? `
                                                <div class="mt-1 text-xs text-gray-500">
                                                    Товари: ${target.products.slice(0, 2).join(', ')}${target.products.length > 2 ? '...' : ''}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Графік прогресу -->
            <div class="bg-gray-700 rounded-lg p-4">
                <h3 class="text-lg font-bold text-white mb-4">Динаміка виконання планів</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${renderProgressCharts()}
                </div>
            </div>
        </div>
    `;
}

/**
 * Рендеринг графиков прогресса
 */
function renderProgressCharts() {
    const activeManagers = [...new Set(plansData.filter(p => p.status === 'active').map(p => p.managerName))];
    
    return activeManagers.map(manager => {
        const managerPlans = plansData.filter(p => p.managerName === manager && p.status === 'active');
        const avgCompletion = managerPlans.reduce((sum, plan) => sum + calculatePlanCompletion(plan), 0) / (managerPlans.length || 1);
        
        return `
            <div class="bg-gray-800 rounded-lg p-4">
                <h4 class="font-bold text-white mb-2">${manager}</h4>
                <div class="space-y-2">
                    ${managerPlans.map(plan => {
                        const completion = calculatePlanCompletion(plan);
                        return `
                            <div>
                                <div class="flex justify-between text-sm text-gray-300 mb-1">
                                    <span>${plan.planName}</span>
                                    <span>${completion}%</span>
                                </div>
                                <div class="w-full bg-gray-600 rounded-full h-1">
                                    <div class="bg-gradient-to-r from-blue-500 to-green-500 h-1 rounded-full" style="width: ${completion}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    <div class="mt-3 pt-2 border-t border-gray-600">
                        <div class="flex justify-between text-sm font-medium">
                            <span class="text-white">Середнє:</span>
                            <span class="text-white">${Math.round(avgCompletion)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Показать модальное окно создания плана
 */
window.showCreatePlanModal = function() {
    // Проверяем права доступа
    if (!window.hasPermission || !window.hasPermission('planfact_create_plans')) {
        alert('У вас немає прав для створення планів');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Створення нового плану</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <form id="create-plan-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Назва плану</label>
                        <input type="text" id="plan-name" class="w-full bg-gray-700 text-white rounded border border-gray-600 p-2" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Менеджер</label>
                        <select id="plan-manager" class="w-full bg-gray-700 text-white rounded border border-gray-600 p-2" required>
                            <option value="">Оберіть менеджера</option>
                            ${managersData.map(mgr => `<option value="${mgr.id}" data-name="${mgr.name}">${mgr.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Період</label>
                        <input type="month" id="plan-period" class="w-full bg-gray-700 text-white rounded border border-gray-600 p-2" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Тип плану</label>
                        <select id="plan-type" class="w-full bg-gray-700 text-white rounded border border-gray-600 p-2" required>
                            <option value="revenue">Грошовий</option>
                            <option value="quantity">Кількісний</option>
                            <option value="mixed">Змішаний</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Статус</label>
                        <select id="plan-status" class="w-full bg-gray-700 text-white rounded border border-gray-600 p-2">
                            <option value="draft">Чернетка</option>
                            <option value="active">Активний</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <h3 class="text-lg font-bold text-white mb-2">Цілі плану</h3>
                    <div id="plan-targets" class="space-y-3">
                        <div class="target-item bg-gray-700 p-4 rounded border">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <input type="text" placeholder="Назва цілі" class="target-name bg-gray-600 text-white rounded border border-gray-500 p-2">
                                <select class="target-type bg-gray-600 text-white rounded border border-gray-500 p-2">
                                    <option value="revenue">Виручка (UAH)</option>
                                    <option value="quantity">Кількість (шт)</option>
                                </select>
                                <input type="number" placeholder="Цільове значення" class="target-value bg-gray-600 text-white rounded border border-gray-500 p-2">
                            </div>
                            <textarea placeholder="Товари/категорії (по одному на рядок, залиште пустим для всіх товарів)" 
                                      class="target-products w-full bg-gray-600 text-white rounded border border-gray-500 p-2" 
                                      rows="2"></textarea>
                        </div>
                    </div>
                    <button type="button" onclick="addPlanTarget()" class="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                        + Додати ціль
                    </button>
                </div>
                
                <div class="flex justify-end gap-4 mt-6">
                    <button type="button" onclick="this.closest('.fixed').remove()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Скасувати
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Створити план
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчик формы
    document.getElementById('create-plan-form').onsubmit = function(e) {
        e.preventDefault();
        savePlan();
    };
    
    // Устанавливаем текущий месяц по умолчанию
    document.getElementById('plan-period').value = new Date().toISOString().slice(0, 7);
};

/**
 * Добавить цель к плану
 */
window.addPlanTarget = function() {
    const targetsContainer = document.getElementById('plan-targets');
    const targetItem = document.createElement('div');
    targetItem.className = 'target-item bg-gray-700 p-4 rounded border';
    targetItem.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input type="text" placeholder="Назва цілі" class="target-name bg-gray-600 text-white rounded border border-gray-500 p-2">
            <select class="target-type bg-gray-600 text-white rounded border border-gray-500 p-2">
                <option value="revenue">Виручка (UAH)</option>
                <option value="quantity">Кількість (шт)</option>
            </select>
            <input type="number" placeholder="Цільове значення" class="target-value bg-gray-600 text-white rounded border border-gray-500 p-2">
        </div>
        <textarea placeholder="Товари/категорії (по одному на рядок, залиште пустим для всіх товарів)" 
                  class="target-products w-full bg-gray-600 text-white rounded border border-gray-500 p-2 mb-2" 
                  rows="2"></textarea>
        <button type="button" onclick="this.closest('.target-item').remove()" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
            Видалити ціль
        </button>
    `;
    targetsContainer.appendChild(targetItem);
};

/**
 * Сохранить план
 */
async function savePlan() {
    try {
        const formData = {
            planName: document.getElementById('plan-name').value,
            managerId: document.getElementById('plan-manager').value,
            managerName: document.querySelector('#plan-manager option:checked')?.getAttribute('data-name') || '',
            period: document.getElementById('plan-period').value,
            type: document.getElementById('plan-type').value,
            status: document.getElementById('plan-status').value
        };
        
        const targets = Array.from(document.querySelectorAll('.target-item')).map((item, index) => ({
            id: `target-${Date.now()}-${index}`,
            name: item.querySelector('.target-name').value,
            type: item.querySelector('.target-type').value,
            target: parseFloat(item.querySelector('.target-value').value) || 0,
            products: item.querySelector('.target-products').value.split('\n').filter(p => p.trim()),
            current: 0,
            deadline: `${formData.period}-31`
        }));
        
        if (!formData.planName || !formData.managerId || targets.length === 0) {
            alert('Будь ласка, заповніть всі обов\'язкові поля та додайте хоча б одну ціль');
            return;
        }
        
        const newPlan = {
            id: `plan-${Date.now()}`,
            ...formData,
            targets,
            createdAt: new Date().toISOString(),
            createdBy: window.state?.currentUserId || 'demo-user'
        };
        
        // Добавляем план в данные (в будущем - сохранение в Firebase)
        plansData.push(newPlan);
        
        alert('План створено!');
        document.querySelector('.fixed').remove();
        
        // Обновляем отображение
        if (currentActiveTab === 'overview') {
            renderPlansOverview();
        } else {
            renderPlansDashboard();
        }
        
    } catch (error) {
        console.error('Помилка збереження плану:', error);
        alert('Помилка створення плану');
    }
}

/**
 * Показать детали плана
 */
window.showPlanDetails = function(planId) {
    const plan = plansData.find(p => p.id === planId);
    if (!plan) return;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Деталі плану: ${plan.planName}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-blue-600 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${plan.managerName}</div>
                    <div class="text-sm text-blue-200">Менеджер</div>
                </div>
                <div class="bg-green-600 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${plan.period}</div>
                    <div class="text-sm text-green-200">Період</div>
                </div>
                <div class="bg-purple-600 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${plan.targets.length}</div>
                    <div class="text-sm text-purple-200">Цілей</div>
                </div>
                <div class="bg-orange-600 rounded-lg p-4">
                    <div class="text-lg font-bold text-white">${calculatePlanCompletion(plan)}%</div>
                    <div class="text-sm text-orange-200">Виконано</div>
                </div>
            </div>
            
            <div class="space-y-4">
                <h3 class="text-lg font-bold text-white">Цілі плану</h3>
                ${plan.targets.map(target => {
                    const completion = (target.current / target.target) * 100;
                    const forecast = calculateTargetForecast(target, plan.period);
                    return `
                        <div class="bg-gray-700 rounded-lg p-4">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h4 class="font-bold text-white">${target.name}</h4>
                                    <div class="text-sm text-gray-400">${target.type === 'revenue' ? 'Грошова ціль' : 'Кількісна ціль'}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-lg font-bold text-white">${completion.toFixed(1)}%</div>
                                    <div class="text-sm text-gray-400">виконано</div>
                                </div>
                            </div>
                            
                            <div class="w-full bg-gray-600 rounded-full h-3 mb-3">
                                <div class="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full" style="width: ${Math.min(completion, 100)}%"></div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <div class="text-sm text-gray-400">Поточний результат</div>
                                    <div class="text-lg font-bold text-white">
                                        ${target.type === 'revenue' ? formatCurrency(target.current) : target.current}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-sm text-gray-400">Цільове значення</div>
                                    <div class="text-lg font-bold text-white">
                                        ${target.type === 'revenue' ? formatCurrency(target.target) : target.target}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-sm text-gray-400">Прогноз</div>
                                    <div class="text-lg font-bold ${forecast >= target.target ? 'text-green-400' : 'text-red-400'}">
                                        ${target.type === 'revenue' ? formatCurrency(forecast) : forecast}
                                    </div>
                                </div>
                            </div>
                            
                            ${target.products.length > 0 ? `
                                <div class="mt-3 pt-3 border-t border-gray-600">
                                    <div class="text-sm text-gray-400 mb-1">Товари/категорії:</div>
                                    <div class="text-sm text-gray-300">${target.products.join(', ')}</div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="flex justify-end gap-4 mt-6">
                <button onclick="this.closest('.fixed').remove()" 
                        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    Закрити
                </button>
                <button onclick="editPlan('${plan.id}'); this.closest('.fixed').remove();" 
                        class="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                    Редагувати
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

/**
 * Редактировать план
 */
window.editPlan = function(planId) {
    alert(`Функція редагування плану ${planId} буде реалізована в наступних версіях`);
};

/**
 * Активировать план
 */
window.activatePlan = function(planId) {
    const plan = plansData.find(p => p.id === planId);
    if (plan) {
        plan.status = 'active';
        renderPlansOverview();
        alert('План активовано!');
    }
};

/**
 * Обновление данных
 */
window.refreshPlanFactData = function() {
    loadPlanFactData();
};

// Вспомогательные функции
function calculatePlanCompletion(plan) {
    if (!plan.targets.length) return 0;
    const avgCompletion = plan.targets.reduce((sum, target) => {
        return sum + Math.min((target.current / target.target) * 100, 100);
    }, 0) / plan.targets.length;
    return Math.round(avgCompletion);
}

function calculateTargetForecast(target, period) {
    // Простое прогнозирование на основе текущего темпа
    const now = new Date();
    const [year, month] = period.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const currentDay = now.getDate();
    
    if (currentDay === 0) return target.current;
    const dailyRate = target.current / currentDay;
    return Math.round(dailyRate * daysInMonth);
}

function getAvgCompletion() {
    if (!plansData.length) return 0;
    const activePlans = plansData.filter(p => p.status === 'active');
    if (!activePlans.length) return 0;
    const totalCompletion = activePlans.reduce((sum, plan) => sum + calculatePlanCompletion(plan), 0);
    return Math.round(totalCompletion / activePlans.length);
}

function getTotalPlanRevenue() {
    return plansData.reduce((sum, plan) => {
        return sum + plan.targets.filter(t => t.type === 'revenue').reduce((s, t) => s + t.target, 0);
    }, 0);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}