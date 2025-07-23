// debts.js - Модуль дебиторской задолженности
import * as firebase from '../js/firebase.js';

let debtsData = [];
let managersData = [];
let departmentsData = [];
let isDebtsInitialized = false;

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
    }
];

/**
 * Главная функция инициализации модуля дебиторки
 */
window.initDebtsModule = function(container) {
    if (isDebtsInitialized) return;
    console.log('initDebtsModule called', container);
    if (!container) return;
    
    container.innerHTML = `
        <div class="bg-gray-800 rounded-xl shadow-lg p-6">
            <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-3xl md:text-4xl font-bold text-white">Дебіторська заборгованість</h1>
                    <p class="mt-2 text-gray-400">Управління заборгованостями клієнтів</p>
                </div>
            </div>
            <div id="debts-filters-container" class="mb-4"></div>
            <div id="debts-summary-container" class="mb-4"></div>
            <div id="debts-content-container" class="mb-4"></div>
        </div>
    `;

    loadDebtsData();
    isDebtsInitialized = true;
};

/**
 * Загрузка данных дебиторки
 */
async function loadDebtsData() {
    try {
        // Пока используем демо данные
        // В будущем здесь будет: const response = await fetch('API_URL_FOR_DEBTS');
        debtsData = DEMO_DEBTS_DATA;
        
        // Загружаем менеджеров и отделы из Firebase
        const companyId = window.state?.currentCompanyId;
        if (companyId) {
            const [employeesSnap, departmentsSnap] = await Promise.all([
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/employees`)),
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/departments`))
            ]);
            
            managersData = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            departmentsData = departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        renderDebtsFilters();
        renderDebtsSummary();
        renderDebtsTable();
        
    } catch (error) {
        console.error('Помилка завантаження дебіторки:', error);
    }
}

/**
 * Рендеринг фильтров
 */
function renderDebtsFilters() {
    const filtersContainer = document.getElementById('debts-filters-container');
    if (!filtersContainer) return;
    
    const managers = [...new Set(debtsData.map(d => d.manager))];
    const departments = [...new Set(debtsData.map(d => d.department))];
    
    filtersContainer.innerHTML = `
        <div class="bg-gray-700 rounded-lg p-4 flex flex-wrap gap-4">
            <div>
                <label class="block text-sm font-medium mb-1 text-gray-200">Менеджер:</label>
                <select id="manager-filter" class="dark-input bg-gray-600 text-gray-200">
                    <option value="">Всі менеджери</option>
                    ${managers.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium mb-1 text-gray-200">Відділ:</label>
                <select id="department-filter" class="dark-input bg-gray-600 text-gray-200">
                    <option value="">Всі відділи</option>
                    ${departments.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium mb-1 text-gray-200">Тип заборгованості:</label>
                <select id="debt-type-filter" class="dark-input bg-gray-600 text-gray-200">
                    <option value="">Всі</option>
                    <option value="overdue">Прострочена</option>
                    <option value="current">Поточна</option>
                </select>
            </div>
        </div>
    `;
    
    // Обработчики фильтров
    document.getElementById('manager-filter').onchange = applyFilters;
    document.getElementById('department-filter').onchange = applyFilters;
    document.getElementById('debt-type-filter').onchange = applyFilters;
}

/**
 * Применение фильтров
 */
function applyFilters() {
    const managerFilter = document.getElementById('manager-filter').value;
    const departmentFilter = document.getElementById('department-filter').value;
    const debtTypeFilter = document.getElementById('debt-type-filter').value;
    
    let filteredData = debtsData;
    
    if (managerFilter) {
        filteredData = filteredData.filter(d => d.manager === managerFilter);
    }
    
    if (departmentFilter) {
        filteredData = filteredData.filter(d => d.department === departmentFilter);
    }
    
    if (debtTypeFilter === 'overdue') {
        filteredData = filteredData.filter(d => d.overdueDebt > 0);
    } else if (debtTypeFilter === 'current') {
        filteredData = filteredData.filter(d => d.currentDebt > 0 && d.overdueDebt === 0);
    }
    
    renderDebtsSummary(filteredData);
    renderDebtsTable(filteredData);
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
    
    summaryContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                        <th class="px-4 py-3 text-center text-white">Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(debt => `
                        <tr class="border-b border-gray-600 hover:bg-gray-600">
                            <td class="px-4 py-3 text-white">
                                <div class="font-medium">${debt.clientName}</div>
                                <div class="text-sm text-gray-400">${debt.clientCode}</div>
                            </td>
                            <td class="px-4 py-3 text-gray-200">${debt.manager}</td>
                            <td class="px-4 py-3 text-right">
                                <span class="font-medium text-white">${formatCurrency(debt.totalDebt)}</span>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <span class="font-medium ${debt.overdueDebt > 0 ? 'text-red-400' : 'text-green-400'}">
                                    ${formatCurrency(debt.overdueDebt)}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-1 rounded-full text-xs ${debt.daysOverdue > 0 ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}">
                                    ${debt.daysOverdue || 0}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center text-gray-200">${debt.lastPayment}</td>
                            <td class="px-4 py-3 text-center">
                                <button onclick="showDebtDetails('${debt.clientCode}')" 
                                        class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                    Деталі
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Показать детали задолженности клиента
 */
window.showDebtDetails = function(clientCode) {
    const debt = debtsData.find(d => d.clientCode === clientCode);
    if (!debt) return;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Деталі заборгованості: ${debt.clientName}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
            </div>
            
            <div class="mb-6">
                <h3 class="text-lg font-bold text-white mb-3">Рахунки</h3>
                <table class="w-full bg-gray-700 rounded-lg overflow-hidden">
                    <thead class="bg-gray-600">
                        <tr>
                            <th class="px-4 py-2 text-left text-white">№ Рахунку</th>
                            <th class="px-4 py-2 text-center text-white">Дата</th>
                            <th class="px-4 py-2 text-right text-white">Сума</th>
                            <th class="px-4 py-2 text-center text-white">Термін оплати</th>
                            <th class="px-4 py-2 text-center text-white">Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${debt.invoices.map(invoice => `
                            <tr class="border-b border-gray-600">
                                <td class="px-4 py-2 text-white">${invoice.number}</td>
                                <td class="px-4 py-2 text-center text-gray-200">${invoice.date}</td>
                                <td class="px-4 py-2 text-right text-white">${formatCurrency(invoice.amount)}</td>
                                <td class="px-4 py-2 text-center text-gray-200">${invoice.dueDate}</td>
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
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Коментар менеджера</h3>
                    <textarea id="manager-comment-${clientCode}" 
                              class="w-full h-24 bg-gray-700 text-white rounded border border-gray-600 p-3"
                              placeholder="Додайте коментар про стан оплати..."></textarea>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Прогноз оплати</h3>
                    <input type="date" id="payment-forecast-${clientCode}" 
                           class="w-full bg-gray-700 text-white rounded border border-gray-600 p-3 mb-2">
                    <input type="number" id="payment-amount-${clientCode}" 
                           class="w-full bg-gray-700 text-white rounded border border-gray-600 p-3"
                           placeholder="Сума очікуваної оплати">
                </div>
            </div>
            
            <div class="flex justify-end gap-4 mt-6">
                <button onclick="this.closest('.fixed').remove()" 
                        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    Закрити
                </button>
                <button onclick="saveDebtComment('${clientCode}')" 
                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Зберегти
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

/**
 * Сохранить комментарий по дебиторке
 */
window.saveDebtComment = function(clientCode) {
    const comment = document.getElementById(`manager-comment-${clientCode}`).value;
    const forecastDate = document.getElementById(`payment-forecast-${clientCode}`).value;
    const forecastAmount = document.getElementById(`payment-amount-${clientCode}`).value;
    
    // Здесь будет сохранение в Firebase
    console.log('Збереження коментаря:', {
        clientCode,
        comment,
        forecastDate,
        forecastAmount,
        timestamp: new Date()
    });
    
    alert('Коментар збережено!');
    document.querySelector('.fixed').remove();
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