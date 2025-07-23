// plan-fact.js - Модуль план-факт
import * as firebase from '../js/firebase.js';

let plansData = [];
let salesData = [];
let managersData = [];
let isPlanFactInitialized = false;

// Демо данные планов
const DEMO_PLANS_DATA = [
    {
        id: "plan-001",
        managerId: "mgr-001",
        managerName: "Іванов Іван",
        department: "Відділ продажу",
        planName: "План продажу на грудень 2024",
        period: "2024-12",
        type: "revenue", // revenue, quantity, mixed
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
        type: "mixed",
        status: "active",
        targets: [
            {
                id: "target-003",
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
    }
];

// Демо данные продаж для план-факт
const DEMO_SALES_DATA = [
    { date: "2024-12-01", manager: "Іванов Іван", product: "Стакан 360мл", quantity: 50, revenue: 15000 },
    { date: "2024-12-02", manager: "Іванов Іван", product: "Стакан 500мл", quantity: 30, revenue: 12000 },
    { date: "2024-12-03", manager: "Іванов Іван", product: "Кришка", quantity: 100, revenue: 8000 },
    { date: "2024-12-05", manager: "Іванов Іван", product: "Стакан 360мл", quantity: 75, revenue: 22500 },
    { date: "2024-12-10", manager: "Іванов Іван", product: "Інший товар", quantity: 20, revenue: 45000 },
    { date: "2025-01-02", manager: "Петров Петро", product: "Товар А", quantity: 10, revenue: 25000 },
    { date: "2025-01-05", manager: "Петров Петро", product: "Товар Б", quantity: 15, revenue: 20000 }
];

/**
 * Главная функция инициализации модуля план-факт
 */
window.initPlanFactModule = function(container) {
    if (isPlanFactInitialized) return;
    console.log('initPlanFactModule called', container);
    if (!container) return;
    
    container.innerHTML = `
        <div class="bg-gray-800 rounded-xl shadow-lg p-6">
            <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-3xl md:text-4xl font-bold text-white">План-Факт</h1>
                    <p class="mt-2 text-gray-400">Планування та контроль виконання цілей</p>
                </div>
                <button onclick="showCreatePlanModal()" 
                        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    + Створити план
                </button>
            </div>
            <div id="planfact-tabs" class="mb-4"></div>
            <div id="planfact-content" class="mb-4"></div>
        </div>
    `;

    loadPlanFactData();
    isPlanFactInitialized = true;
};

/**
 * Загрузка данных план-факт
 */
async function loadPlanFactData() {
    try {
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
        
        renderPlanFactTabs();
        renderPlansOverview();
        
    } catch (error) {
        console.error('Помилка завантаження план-факт:', error);
    }
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
                    class="tab-button px-4 py-2 rounded-md text-sm font-medium transition-colors active">
                Огляд планів
            </button>
            <button onclick="switchPlanFactTab('dashboard')" 
                    id="tab-dashboard"
                    class="tab-button px-4 py-2 rounded-md text-sm font-medium transition-colors">
                Дашборд виконання
            </button>
        </div>
    `;
}

/**
 * Переключение вкладок
 */
window.switchPlanFactTab = function(tab) {
    // Обновляем активную вкладку
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'bg-white', 'text-gray-900');
        btn.classList.add('text-gray-300', 'hover:text-white');
    });
    
    const activeTab = document.getElementById(`tab-${tab}`);
    activeTab.classList.add('active', 'bg-white', 'text-gray-900');
    activeTab.classList.remove('text-gray-300', 'hover:text-white');
    
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
    
    contentContainer.innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-blue-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${plansData.length}</div>
                    <div class="text-sm text-blue-200">Активних планів</div>
                </div>
                <div class="bg-green-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${getCompletedTargetsCount()}</div>
                    <div class="text-sm text-green-200">Виконаних цілей</div>
                </div>
                <div class="bg-yellow-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${getAvgCompletion()}%</div>
                    <div class="text-sm text-yellow-200">Середнє виконання</div>
                </div>
                <div class="bg-purple-600 rounded-lg p-4">
                    <div class="text-2xl font-bold text-white">${formatCurrency(getTotalPlanRevenue())}</div>
                    <div class="text-sm text-purple-200">Загальний план</div>
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
                                        <div class="text-sm text-gray-400">${plan.type}</div>
                                    </td>
                                    <td class="px-4 py-3 text-gray-200">${plan.managerName}</td>
                                    <td class="px-4 py-3 text-center text-gray-200">${plan.period}</td>
                                    <td class="px-4 py-3 text-center text-gray-200">${plan.targets.length}</td>
                                    <td class="px-4 py-3 text-center">
                                        <div class="w-full bg-gray-600 rounded-full h-2">
                                            <div class="bg-green-500 h-2 rounded-full" style="width: ${completion}%"></div>
                                        </div>
                                        <span class="text-sm text-gray-300">${completion}%</span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <span class="px-2 py-1 rounded-full text-xs ${plan.status === 'active' ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}">
                                            ${plan.status === 'active' ? 'Активний' : 'Завершений'}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <button onclick="showPlanDetails('${plan.id}')" 
                                                class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm mr-2">
                                            Деталі
                                        </button>
                                        <button onclick="editPlan('${plan.id}')" 
                                                class="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm">
                                            Редагувати
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
}

/**
 * Рендеринг дашборда выполнения
 */
function renderPlansDashboard() {
    const contentContainer = document.getElementById('planfact-content');
    if (!contentContainer) return;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const activePlans = plansData.filter(plan => plan.period === currentMonth && plan.status === 'active');
    
    contentContainer.innerHTML = `
        <div class="space-y-6">
            <div class="bg-gray-700 rounded-lg p-4">
                <h2 class="text-xl font-bold text-white mb-4">Дашборд виконання - ${currentMonth}</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${activePlans.map(plan => {
                        const completion = calculatePlanCompletion(plan);
                        const forecast = calculateMonthEndForecast(plan);
                        return `
                            <div class="bg-gray-800 rounded-lg p-4">
                                <h3 class="font-bold text-white mb-2">${plan.managerName}</h3>
                                <div class="text-sm text-gray-400 mb-2">${plan.planName}</div>
                                
                                ${plan.targets.map(target => {
                                    const targetCompletion = (target.current / target.target) * 100;
                                    const targetForecast = calculateTargetForecast(target, plan.period);
                                    return `
                                        <div class="mb-3 p-3 bg-gray-700 rounded">
                                            <div class="flex justify-between items-center mb-1">
                                                <span class="text-sm text-white">${target.name}</span>
                                                <span class="text-xs text-gray-400">${target.type}</span>
                                            </div>
                                            <div class="w-full bg-gray-600 rounded-full h-2 mb-1">
                                                <div class="bg-blue-500 h-2 rounded-full" style="width: ${Math.min(targetCompletion, 100)}%"></div>
                                            </div>
                                            <div class="flex justify-between text-xs text-gray-300">
                                                <span>${target.current} / ${target.target}</span>
                                                <span>${targetCompletion.toFixed(1)}%</span>
                                            </div>
                                            <div class="mt-2 text-xs">
                                                <span class="text-gray-400">Прогноз на кінець місяця:</span>
                                                <span class="text-${targetForecast >= target.target ? 'green' : 'red'}-400 font-medium">
                                                    ${targetForecast}
                                                </span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Показать модальное окно создания плана
 */
window.showCreatePlanModal = function() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                            ${managersData.map(mgr => `<option value="${mgr.id}">${mgr.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                
                <div>
                    <h3 class="text-lg font-bold text-white mb-2">Цілі плану</h3>
                    <div id="plan-targets" class="space-y-2">
                        <div class="target-item bg-gray-700 p-3 rounded border">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input type="text" placeholder="Назва цілі" class="target-name bg-gray-600 text-white rounded border border-gray-500 p-2">
                                <select class="target-type bg-gray-600 text-white rounded border border-gray-500 p-2">
                                    <option value="revenue">Виручка</option>
                                    <option value="quantity">Кількість</option>
                                </select>
                                <input type="number" placeholder="Цільове значення" class="target-value bg-gray-600 text-white rounded border border-gray-500 p-2">
                            </div>
                            <textarea placeholder="Товари (по одному на рядок)" class="target-products w-full mt-2 bg-gray-600 text-white rounded border border-gray-500 p-2" rows="2"></textarea>
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
};

/**
 * Добавить цель к плану
 */
window.addPlanTarget = function() {
    const targetsContainer = document.getElementById('plan-targets');
    const targetItem = document.createElement('div');
    targetItem.className = 'target-item bg-gray-700 p-3 rounded border';
    targetItem.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="text" placeholder="Назва цілі" class="target-name bg-gray-600 text-white rounded border border-gray-500 p-2">
            <select class="target-type bg-gray-600 text-white rounded border border-gray-500 p-2">
                <option value="revenue">Виручка</option>
                <option value="quantity">Кількість</option>
            </select>
            <input type="number" placeholder="Цільове значення" class="target-value bg-gray-600 text-white rounded border border-gray-500 p-2">
        </div>
        <textarea placeholder="Товари (по одному на рядок)" class="target-products w-full mt-2 bg-gray-600 text-white rounded border border-gray-500 p-2" rows="2"></textarea>
        <button type="button" onclick="this.closest('.target-item').remove()" class="mt-2 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
            Видалити
        </button>
    `;
    targetsContainer.appendChild(targetItem);
};

/**
 * Сохранить план
 */
function savePlan() {
    const formData = {
        planName: document.getElementById('plan-name').value,
        managerId: document.getElementById('plan-manager').value,
        period: document.getElementById('plan-period').value,
        type: document.getElementById('plan-type').value
    };
    
    const targets = Array.from(document.querySelectorAll('.target-item')).map(item => ({
        name: item.querySelector('.target-name').value,
        type: item.querySelector('.target-type').value,
        target: parseFloat(item.querySelector('.target-value').value),
        products: item.querySelector('.target-products').value.split('\n').filter(p => p.trim()),
        current: 0
    }));
    
    // Здесь будет сохранение в Firebase
    console.log('Збереження плану:', { ...formData, targets });
    
    alert('План створено!');
    document.querySelector('.fixed').remove();
    loadPlanFactData();
}

// Вспомогательные функции
function calculatePlanCompletion(plan) {
    if (!plan.targets.length) return 0;
    const avgCompletion = plan.targets.reduce((sum, target) => {
        return sum + Math.min((target.current / target.target) * 100, 100);
    }, 0) / plan.targets.length;
    return Math.round(avgCompletion);
}

function calculateMonthEndForecast(plan) {
    // Простое прогнозирование на основе текущего темпа
    const daysInMonth = new Date(2024, 11, 0).getDate(); // Декабрь
    const currentDay = new Date().getDate();
    const progressRatio = currentDay / daysInMonth;
    
    return plan.targets.map(target => {
        if (progressRatio === 0) return target.current;
        const dailyRate = target.current / currentDay;
        return Math.round(dailyRate * daysInMonth);
    });
}

function calculateTargetForecast(target, period) {
    const daysInMonth = new Date(2024, 11, 0).getDate();
    const currentDay = new Date().getDate();
    if (currentDay === 0) return target.current;
    const dailyRate = target.current / currentDay;
    return Math.round(dailyRate * daysInMonth);
}

function getCompletedTargetsCount() {
    return plansData.reduce((count, plan) => {
        return count + plan.targets.filter(target => target.current >= target.target).length;
    }, 0);
}

function getAvgCompletion() {
    if (!plansData.length) return 0;
    const totalCompletion = plansData.reduce((sum, plan) => sum + calculatePlanCompletion(plan), 0);
    return Math.round(totalCompletion / plansData.length);
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

// Заглушки для функций
window.showPlanDetails = function(planId) {
    console.log('Показати деталі плану:', planId);
};

window.editPlan = function(planId) {
    console.log('Редагувати план:', planId);
};