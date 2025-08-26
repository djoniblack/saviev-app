// goals.js - Підмодуль тижневих цілей (спринтів)
import * as firebase from '../firebase.js';
import { getState, updateState } from './state.js';

/**
 * Завантаження цілей
 */
function loadGoals() {
    console.log('🎯 Завантаження цілей...');
    
    const goalsList = document.getElementById('goalsList');
    if (!goalsList) {
        console.error('❌ Контейнер списку цілей не знайдено');
        return;
    }
    
    // Отримуємо відфільтровані цілі
    const filteredGoals = getFilteredGoals();
    
    // Оновлюємо список
    goalsList.innerHTML = renderGoalsList(filteredGoals);
    
    console.log(`✅ Завантажено ${filteredGoals.length} цілей`);
}

/**
 * Отримання відфільтрованих цілей
 */
function getFilteredGoals() {
    const weekFilter = document.getElementById('goalsWeek')?.value || getCurrentWeek();
    const managerFilter = document.getElementById('goalsManager')?.value || '';
    const statusFilter = document.getElementById('goalsStatus')?.value || '';
    
    return getState().planFactData?.goals?.filter(goal => {
        if (goal.weekKey !== weekFilter) return false;
        if (managerFilter && goal.managerId !== managerFilter) return false;
        if (statusFilter && goal.status !== statusFilter) return false;
        return true;
    }) || [];
}

/**
 * Рендеринг списку цілей
 */
function renderGoalsList(goals = null) {
    // Если не переданы цели, получаем их из состояния
    if (!goals) {
        goals = getFilteredGoals();
    }
    
    if (goals.length === 0) {
        return `
            <div class="text-center py-8 text-gray-400">
                <p>Немає цілей для відображення</p>
                <p class="text-sm mt-2">Створіть першу тижневу ціль, натиснувши кнопку "Створити ціль"</p>
            </div>
        `;
    }
    
    return `
        <div class="space-y-4">
            ${goals.map(goal => `
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="text-lg font-bold text-white">${goal.name}</h4>
                            <p class="text-sm text-gray-400">${goal.managerName} • ${goal.type}</p>
                            <p class="text-xs text-gray-500">Тиждень: ${formatWeekKey(goal.weekKey)}</p>
                        </div>
                        <div class="text-right">
                            <span class="px-2 py-1 rounded-full text-xs ${getGoalStatusClass(goal.status)}">
                                ${getGoalStatusText(goal.status)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                            <div class="text-sm text-gray-400">Ціль</div>
                            <div class="text-white font-medium">${formatGoalTarget(goal)}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-400">Виконання</div>
                            <div class="text-white font-medium">${formatGoalProgress(goal)}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-400">Прогрес</div>
                            <div class="text-white font-medium">${calculateGoalProgress(goal)}%</div>
                        </div>
                    </div>
                    
                    ${goal.description ? `
                        <div class="mb-3">
                            <div class="text-sm text-gray-400">Опис</div>
                            <div class="text-white text-sm">${goal.description}</div>
                        </div>
                    ` : ''}
                    
                    <div class="flex gap-2">
                        <button onclick="showGoalDetails('${goal.id}')" 
                                class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            Деталі
                        </button>
                        <button onclick="editGoal('${goal.id}')" 
                                class="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm">
                            Редагувати
                        </button>
                        ${goal.status === 'active' ? 
                            `<button onclick="completeGoal('${goal.id}')" 
                                     class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                                Завершити
                            </button>` : ''
                        }
                        <button onclick="deleteGoal('${goal.id}')" 
                                class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                            Видалити
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Рендеринг вкладки целей
 */
export function renderGoalsTab(container = null) {
    // Если контейнер не передан, ищем его
    if (!container) {
        container = document.getElementById('plan-fact-content');
    }
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Заголовок та кнопки -->
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-white">Тижневі цілі</h2>
                <button onclick="showCreateGoalModal()" 
                        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    + Створити ціль
                </button>
            </div>
            
            <!-- Фільтри -->
            <div class="bg-gray-700 rounded-lg p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Тиждень</label>
                        <input type="week" id="goalsWeek" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" 
                               value="${getCurrentWeek()}" onchange="loadGoals()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Менеджер</label>
                        <select id="goalsManager" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadGoals()">
                            <option value="">Всі менеджери</option>
                            ${getState().planFactData?.employees?.map(emp => 
                                `<option value="${emp.id}">${emp.name}</option>`
                            ).join('') || ''}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Статус</label>
                        <select id="goalsStatus" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadGoals()">
                            <option value="">Всі статуси</option>
                            <option value="active">Активні</option>
                            <option value="completed">Завершені</option>
                            <option value="overdue">Прострочені</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Список цілей -->
            <div class="bg-gray-700 rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-600">
                    <h3 class="text-lg font-bold text-white">Цілі</h3>
                </div>
                <div id="goalsList" class="p-4">
                    ${renderGoalsList()}
                </div>
            </div>
        </div>
    `;
    
    loadGoals();
}

/**
 * Показ модального вікна створення цілі
 */
window.showCreateGoalModal = function() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Створення тижневої цілі</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <form id="create-goal-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Назва цілі *</label>
                        <input type="text" id="goal-name" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Тиждень *</label>
                        <input type="week" id="goal-week" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" required>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Тип цілі *</label>
                        <select id="goal-type" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" required>
                            <option value="">Оберіть тип цілі</option>
                            <option value="commercial_proposals">Комерційні пропозиції</option>
                            <option value="client_shipments">Відгрузки клієнтів</option>
                            <option value="calls">Дзвінки клієнтам</option>
                            <option value="meetings">Зустрічі</option>
                            <option value="revenue">Виручка</option>
                            <option value="custom">Інше</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Цільове значення *</label>
                        <input type="number" id="goal-target" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" min="0" required>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Опис</label>
                    <textarea id="goal-description" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" rows="3" 
                              placeholder="Детальний опис цілі..."></textarea>
                </div>
                
                <!-- Клієнти (якщо потрібно) -->
                <div id="goal-clients-section" class="hidden">
                    <label class="block text-sm font-medium text-gray-300 mb-1">Клієнти</label>
                    <div id="goal-clients" class="space-y-2 max-h-40 overflow-y-auto">
                        <!-- Клієнти будуть додані динамічно -->
                    </div>
                    <button type="button" onclick="addGoalClient()" class="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                        + Додати клієнта
                    </button>
                </div>
                
                <div class="flex justify-end gap-4">
                    <button type="button" onclick="this.closest('.fixed').remove()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Скасувати
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Створити ціль
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Встановлюємо поточний тиждень за замовчуванням
    document.getElementById('goal-week').value = getCurrentWeek();
    
    // Обробник зміни типу цілі
    document.getElementById('goal-type').addEventListener('change', toggleGoalClientsSection);
    
    // Обробник форми
    document.getElementById('create-goal-form').onsubmit = function(e) {
        e.preventDefault();
        saveNewGoal();
    };
};

/**
 * Перемикання секції клієнтів залежно від типу цілі
 */
window.toggleGoalClientsSection = function() {
    const goalType = document.getElementById('goal-type').value;
    const clientsSection = document.getElementById('goal-clients-section');
    
    if (goalType === 'commercial_proposals' || goalType === 'client_shipments') {
        clientsSection.classList.remove('hidden');
        loadGoalClients();
    } else {
        clientsSection.classList.add('hidden');
    }
};

/**
 * Завантаження клієнтів для цілі
 */
function loadGoalClients() {
    const clientsContainer = document.getElementById('goal-clients');
    if (!clientsContainer) return;
    
    const clients = getState().planFactData?.clientsData || [];
    
    if (clients.length === 0) {
        clientsContainer.innerHTML = '<p class="text-gray-400 text-sm">Клієнти не завантажені</p>';
        return;
    }
    
    clientsContainer.innerHTML = `
        <div class="space-y-2">
            ${clients.slice(0, 10).map(client => `
                <label class="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" value="${client['Клиент.Код']}" class="goal-client-checkbox rounded border-gray-400 text-blue-600 focus:ring-blue-500">
                    <span class="text-white text-sm">${client['Клиент.Название'] || client['Клиент']}</span>
                </label>
            `).join('')}
        </div>
    `;
}

/**
 * Додавання клієнта до цілі
 */
window.addGoalClient = function() {
    const clientsContainer = document.getElementById('goal-clients');
    if (!clientsContainer) return;
    
    const clientDiv = document.createElement('div');
    clientDiv.className = 'goal-client bg-gray-600 p-2 rounded border';
    clientDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <input type="text" placeholder="Назва клієнта" class="goal-client-name bg-gray-500 text-white rounded border border-gray-400 p-1 text-sm">
            <button type="button" onclick="removeGoalClient(this)" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs">
                Видалити
            </button>
        </div>
    `;
    clientsContainer.appendChild(clientDiv);
};

/**
 * Видалення клієнта з цілі
 */
window.removeGoalClient = function(button) {
    button.closest('.goal-client').remove();
};

/**
 * Збереження нової цілі
 */
async function saveNewGoal() {
    try {
        const formData = {
            name: document.getElementById('goal-name').value,
            weekKey: document.getElementById('goal-week').value,
            type: document.getElementById('goal-type').value,
            target: parseFloat(document.getElementById('goal-target').value) || 0,
            description: document.getElementById('goal-description').value,
            managerId: getState().state?.currentUserId || 'demo-user',
            managerName: getState().state?.currentUser?.displayName || 'Користувач',
            status: 'active',
            progress: 0,
            createdAt: new Date().toISOString(),
            createdBy: getState().state?.currentUserId || 'demo-user'
        };
        
        // Збираємо клієнтів
        const selectedClients = Array.from(document.querySelectorAll('.goal-client-checkbox:checked')).map(cb => cb.value);
        const customClients = Array.from(document.querySelectorAll('.goal-client-name')).map(input => input.value).filter(Boolean);
        
        formData.clients = [...selectedClients, ...customClients];
        
        // Валідація
        if (!formData.name || !formData.weekKey || !formData.type || !formData.target) {
            alert('Будь ласка, заповніть всі обов\'язкові поля');
            return;
        }
        
        // Створюємо нову ціль
        const newGoal = {
            id: `goal-${Date.now()}`,
            ...formData
        };
        
        // Додаємо до даних
        if (!getState().planFactData.goals) {
            getState().planFactData.goals = [];
        }
        getState().planFactData.goals.push(newGoal);
        
        // Зберігаємо в Firebase (якщо доступно)
        try {
            const companyId = getState().state?.currentCompanyId;
            if (companyId) {
                const goalRef = firebase.doc(firebase.db, 'companies', companyId, 'weeklyGoals', newGoal.id);
                await firebase.setDoc(goalRef, newGoal);
                console.log('✅ Ціль збережено в Firebase');
            }
        } catch (error) {
            console.error('❌ Помилка збереження в Firebase:', error);
        }
        
        alert('✅ Тижневу ціль створено успішно!');
        document.querySelector('.fixed').remove();
        
        // Оновлюємо відображення
        if (getState().planFactData?.currentTab === 'goals') {
            renderGoalsTab();
        }
        
    } catch (error) {
        console.error('❌ Помилка створення цілі:', error);
        alert('❌ Помилка створення цілі');
    }
}

// === ДОПОМІЖНІ ФУНКЦІЇ ===

/**
 * Отримання поточного тижня
 */
function getCurrentWeek() {
    const now = new Date();
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Отримання номера тижня
 */
function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Форматування тижня
 */
function formatWeekKey(weekKey) {
    const [year, week] = weekKey.split('-W');
    return `Тиждень ${week}, ${year}`;
}

/**
 * Форматування цілі
 */
function formatGoalTarget(goal) {
    switch (goal.type) {
        case 'commercial_proposals':
            return `${goal.target} пропозицій`;
        case 'client_shipments':
            return `${goal.target} відгрузок`;
        case 'calls':
            return `${goal.target} дзвінків`;
        case 'meetings':
            return `${goal.target} зустрічей`;
        case 'revenue':
            return formatCurrency(goal.target);
        default:
            return goal.target;
    }
}

/**
 * Форматування прогресу
 */
function formatGoalProgress(goal) {
    switch (goal.type) {
        case 'commercial_proposals':
            return `${goal.progress} пропозицій`;
        case 'client_shipments':
            return `${goal.progress} відгрузок`;
        case 'calls':
            return `${goal.progress} дзвінків`;
        case 'meetings':
            return `${goal.progress} зустрічей`;
        case 'revenue':
            return formatCurrency(goal.progress);
        default:
            return goal.progress;
    }
}

/**
 * Розрахунок прогресу цілі
 */
function calculateGoalProgress(goal) {
    if (goal.target <= 0) return 0;
    return Math.min(Math.round((goal.progress / goal.target) * 100), 100);
}

/**
 * Отримання класу статусу
 */
function getGoalStatusClass(status) {
    switch (status) {
        case 'active':
            return 'bg-green-600 text-white';
        case 'completed':
            return 'bg-blue-600 text-white';
        case 'overdue':
            return 'bg-red-600 text-white';
        default:
            return 'bg-gray-600 text-white';
    }
}

/**
 * Отримання тексту статусу
 */
function getGoalStatusText(status) {
    switch (status) {
        case 'active':
            return 'Активна';
        case 'completed':
            return 'Завершена';
        case 'overdue':
            return 'Прострочена';
        default:
            return 'Невідома';
    }
}

/**
 * Форматування валюти
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

/**
 * Отримання кількості цілей
 */
function getGoalsCount() {
    return getState().planFactData?.goals?.length || 0;
}

/**
 * Отримання кількості активних цілей
 */
function getActiveGoalsCount() {
    return getState().planFactData?.goals?.filter(g => g.status === 'active').length || 0;
}

/**
 * Отримання кількості завершених цілей
 */
function getCompletedGoalsCount() {
    return getState().planFactData?.goals?.filter(g => g.status === 'completed').length || 0;
}

/**
 * Отримання кількості протермінованих цілей
 */
function getOverdueGoalsCount() {
    return getState().planFactData?.goals?.filter(g => g.status === 'overdue').length || 0;
}

// === ГЛОБАЛЬНІ ФУНКЦІЇ ===

/**
 * Завантаження цілей для тижня
 */
window.loadGoalsForWeek = function() {
    const goalsList = document.getElementById('goalsList');
    if (goalsList) {
        goalsList.innerHTML = renderGoalsList();
    }
};

/**
 * Оновлення даних цілей
 */
window.refreshGoalsData = function() {
    console.log('🔄 Оновлення даних цілей...');
    renderGoalsTab();
}; 