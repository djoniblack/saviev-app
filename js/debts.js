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
    
    container.innerHTML = `
        <div class="bg-gray-800 rounded-xl shadow-lg p-6">
            <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-3xl md:text-4xl font-bold text-white">Дебіторська заборгованість</h1>
                    <p class="mt-2 text-gray-400">Управління заборгованостями клієнтів</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="exportDebtsToExcel()" 
                            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        📊 Експорт Excel
                    </button>
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
 * Загрузка данных дебиторки
 */
async function loadDebtsData() {
    try {
        // Показываем индикатор загрузки
        showLoadingState();
        
        // Пока используем демо данные
        // В будущем здесь будет: const response = await fetch('API_URL_FOR_DEBTS');
        debtsData = DEMO_DEBTS_DATA;
        
        // Загружаем менеджеров и отделы из Firebase
        const companyId = window.state?.currentCompanyId;
        if (companyId) {
            const [employeesSnap, departmentsSnap, commentsSnap, forecastsSnap] = await Promise.all([
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/employees`)),
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/departments`)),
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/debtComments`)),
                firebase.getDocs(firebase.collection(firebase.db, `companies/${companyId}/paymentForecasts`))
            ]);
            
            managersData = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            departmentsData = departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            clientCommentsData = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            paymentForecastsData = forecastsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        hideLoadingState();
        renderDebtsFilters();
        renderDebtsSummary();
        renderDebtsTable();
        
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
    
    const managers = [...new Set(debtsData.map(d => d.manager))];
    const departments = [...new Set(debtsData.map(d => d.department))];
    
    filtersContainer.innerHTML = `
        <div class="bg-gray-700 rounded-lg p-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Менеджер:</label>
                    <select id="manager-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="">Всі менеджери</option>
                        ${managers.map(m => `<option value="${m}">${m}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 text-gray-200">Відділ:</label>
                    <select id="department-filter" class="dark-input bg-gray-600 text-gray-200 w-full">
                        <option value="">Всі відділи</option>
                        ${departments.map(d => `<option value="${d}">${d}</option>`).join('')}
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
    document.getElementById('manager-filter').onchange = applyFilters;
    document.getElementById('department-filter').onchange = applyFilters;
    document.getElementById('debt-type-filter').onchange = applyFilters;
    document.getElementById('sort-filter').onchange = applyFilters;
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
                <h3 class="text-lg font-bold text-white mb-3">Рахунки</h3>
                <div class="bg-gray-700 rounded-lg overflow-hidden">
                    <table class="w-full">
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
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-lg font-bold text-white mb-3">Коментар менеджера</h3>
                    <textarea id="manager-comment-${clientCode}" 
                              class="w-full h-24 bg-gray-700 text-white rounded border border-gray-600 p-3"
                              placeholder="Додайте коментар про стан оплати...">${existingComment?.comment || ''}</textarea>
                    ${existingComment ? `<div class="text-xs text-gray-400 mt-1">Оновлено: ${new Date(existingComment.updatedAt?.seconds * 1000).toLocaleDateString()}</div>` : ''}
                </div>
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
window.saveDebtComment = async function(clientCode) {
    const comment = document.getElementById(`manager-comment-${clientCode}`).value;
    const forecastDate = document.getElementById(`payment-forecast-${clientCode}`).value;
    const forecastAmount = document.getElementById(`payment-amount-${clientCode}`).value;
    
    try {
        const companyId = window.state?.currentCompanyId;
        const userId = window.state?.currentUserId;
        
        if (!companyId) {
            alert('Помилка: Компанія не визначена');
            return;
        }
        
        // Сохраняем комментарий
        if (comment.trim()) {
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
        
        // Сохраняем прогноз оплаты
        if (forecastDate && forecastAmount) {
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
    alert('Функція експорту в Excel буде реалізована після підключення реальних даних');
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