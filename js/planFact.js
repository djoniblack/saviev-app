// planFact.js - Головний модуль План-Факт з інтеграцією нових сервісів

import * as firebase from './firebase.js';
import { renderDashboardTab } from './planFact/dashboard.js';
import { renderConstructorTab } from './planFact/constructor.js';
import { renderFocusManagerTab } from './planFact/focusManager.js';
import { renderMassAssignmentTab } from './planFact/massAssignment.js';
import { renderGoalsTab } from './planFact/goals.js';

// Імпортуємо нові модулі
import { 
    getState, 
    updateState, 
    subscribe, 
    setCurrentTab, 
    setLoading,
    updateApiCache,
    clearApiCache,
    canPerformOperation,
    lockOperation,
    unlockOperation
} from './planFact/state.js';

import { 
    startBackgroundService, 
    stopBackgroundService, 
    getServiceStatus,
    setupStateSubscription 
} from './planFact/backgroundService.js';

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
// Удаляем глобальные переменные - теперь используем state.js
// let planFactData = { ... };
// window.planFactData = planFactData;

let planFactInited = false;

// === ГЛОБАЛЬНІ ФУНКЦІЇ ===
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
};

/**
 * Показ уведомлений (toast)
 */
function showToast(message, type = 'info') {
    // Проверяем что мы не в бесконечной рекурсии
    if (showToast._isProcessing) {
        console.warn('⚠️ Предотвращена рекурсия в showToast');
        return;
    }
    
    // Устанавливаем флаг обработки
    showToast._isProcessing = true;
    
    try {
        // Если существует глобальная функция toast из другого модуля, используем её
        if (typeof window.showGlobalToast === 'function') {
            window.showGlobalToast(message, type);
            return;
        }
        
        // Иначе создаем простое уведомление
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-[1000] px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300 ${
            type === 'success' ? 'bg-green-600' :
            type === 'error' ? 'bg-red-600' :
            type === 'warning' ? 'bg-yellow-600' :
            'bg-blue-600'
        }`;
        toast.textContent = message;
        toast.style.transform = 'translateX(100%)';
        
        document.body.appendChild(toast);
        
        // Анимация появления
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
        
    } catch (error) {
        console.error('❌ Помилка відображення toast:', error);
    } finally {
        // Снимаем флаг обработки
        showToast._isProcessing = false;
    }
}

// Экспортируем функцию showToast БЕЗ проверки на существование
if (!window.showToast) {
    window.showToast = showToast;
}

/**
 * Глобальная функция закрытия модальных окон
 */
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Добавляем анимацию закрытия
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
        }, 200);
    }
};

console.log('📋 Модуль План-Факт завантажено');

// === ГЛОБАЛЬНА ФУНКЦІЯ ЗАВАНТАЖЕННЯ ДЕМО ДАНИХ ===
window.loadDemoData = function() {
    if (confirm('Завантажити демо дані для тестування модуля План-Факт? Ці дані будуть використані тільки для ознайомлення з функціоналом.')) {
        console.log('🧪 Завантаження демо даних...');
        
        // Завантажуємо демо дані
        const demoData = {
            planTemplates: getTestPlanTemplates(),
            focusTypes: getTestFocusTypes(),
            goals: getTestGoals(),
            departments: [
                { id: 'dept-1', name: 'КАВ\'ЯРНЯ' },
                { id: 'dept-2', name: 'ЗАКЛАДИ' },
                { id: 'dept-3', name: 'РОЗДРІБНІ ПРОДАЖІ' },
                { id: 'dept-4', name: 'КОРПОРАТИВНІ КЛІЄНТИ' }
            ],
            employees: [
                { id: 'emp-1', name: 'Ангеліна Мудрицька', departmentId: 'dept-1' },
                { id: 'emp-2', name: 'Олексій Петренко', departmentId: 'dept-2' },
                { id: 'emp-3', name: 'Марія Коваленко', departmentId: 'dept-3' },
                { id: 'emp-4', name: 'Дмитро Сидоренко', departmentId: 'dept-4' }
            ]
        };
        
        // Оновлюємо стан
        updateState({
            planFactData: {
                ...demoData
            }
        });
        
        // Оновлюємо інтерфейс
        const state = getState();
        const currentTab = state.currentTab || 'dashboard';
        
        if (currentTab === 'constructor') {
            renderConstructorTab();
        } else if (currentTab === 'focus-manager') {
            renderFocusManagerTab();
        } else if (currentTab === 'goals') {
            renderGoalsTab();
        } else if (currentTab === 'dashboard') {
            renderDashboardTab();
        }
        
        showToast('🧪 Демо дані завантажено успішно!', 'success');
        console.log('✅ Демо дані завантажено');
    }
};

// === ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ===
/**
 * Ініціалізація модуля План-Факт з новою архітектурою
 */
export async function initPlanFactModule(container) {
    console.log('🚀 Ініціалізація модуля План-Факт з новою архітектурою...');
    
    // Проверяем, что модуль еще не инициализирован
    if (planFactInited) {
        console.log('⚠️ Модуль План-Факт вже ініціалізовано, пропускаємо повторну ініціалізацію');
        return;
    }
    
    // Показуємо анимацию загрузки сразу
    showLoadingAnimation(container);
    
    try {
        // Встановлюємо стан завантаження
        setLoading(true);
        
        // Завантажуємо початкові дані з прогресс-баром
        await loadInitialDataWithProgress(container);
        
        // Рендеримо інтерфейс
        renderMainInterface(container);
        
        // Налаштовуємо обробники подій
        setupEventHandlers();
        
        // Запускаємо фонове оновлення
        startBackgroundService();
        
        // Налаштовуємо підписку на зміни стану
        setupStateSubscription();
        
        // Встановлюємо початкову вкладку
        setCurrentTab('dashboard');
        
        // Показуємо першу вкладку (дашборд) при ініціалізації
        setTimeout(async () => {
            try {
                console.log('🎨 Показуємо першу вкладку (дашборд)...');
                await switchTab('dashboard');
            } catch (error) {
                console.error('❌ Помилка показу першої вкладки:', error);
            }
        }, 100);
        
        // НЕ загружаем данные дашборда здесь - они будут загружены при первом входе
        // await loadDashboardData(); // УБИРАЕМ ЭТУ СТРОКУ
        
        setLoading(false);
        
        // Отмечаем модуль как инициализированный
        planFactInited = true;
        
        console.log('✅ Модуль План-Факт успішно ініціалізовано (без попереднього завантаження даних)');
        
        // Принудительно запускаем первое обновление данных с задержкой
        setTimeout(async () => {
            try {
                console.log('🚀 Запуск першого оновлення даних...');
                const { forceUpdate } = await import('./planFact/backgroundService.js');
                await forceUpdate();
                console.log('✅ Перше оновлення даних завершено');
            } catch (error) {
                console.error('❌ Помилка першого оновлення даних:', error);
            }
        }, 2000); // Увеличиваем задержку до 2 секунд для полной готовности HTML элементов
        
    } catch (error) {
        console.error('❌ Помилка ініціалізації модуля План-Факт:', error);
        setLoading(false);
        showErrorState(container, error.message);
        throw error;
    }
}

/**
 * Показ анимации загрузки с прогресс-баром
 */
function showLoadingAnimation(container) {
    container.innerHTML = `
        <div class="bg-gray-900 min-h-screen flex items-center justify-center">
            <div class="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                <!-- Логотип и заголовок -->
                <div class="text-center mb-8">
                    <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
                    <h2 class="text-2xl font-bold text-white mb-2">📊 План-Факт</h2>
                    <p class="text-gray-400">Ініціалізація модуля...</p>
                </div>
                
                <!-- Прогресс-бар -->
                <div class="mb-6">
                    <div class="flex justify-between text-sm text-gray-400 mb-2">
                        <span id="loading-step">Підготовка...</span>
                        <span id="loading-progress">0%</span>
                    </div>
                    <div class="bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div id="loading-bar" class="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out" style="width: 0%"></div>
                    </div>
                </div>
                
                <!-- Детальная информация -->
                <div class="text-center">
                    <p id="loading-details" class="text-sm text-gray-400">Завантаження конфігурації...</p>
                </div>
                
                <!-- Анимация точек -->
                <div class="flex justify-center mt-4">
                    <div class="flex space-x-1">
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Обновление прогресса загрузки
 */
function updateLoadingProgress(step, progress, details) {
    const stepElement = document.getElementById('loading-step');
    const progressElement = document.getElementById('loading-progress');
    const barElement = document.getElementById('loading-bar');
    const detailsElement = document.getElementById('loading-details');
    
    if (stepElement) stepElement.textContent = step;
    if (progressElement) progressElement.textContent = `${progress}%`;
    if (barElement) barElement.style.width = `${progress}%`;
    if (detailsElement) detailsElement.textContent = details;
}

/**
 * Завантаження початкових даних з прогресс-баром
 */
async function loadInitialDataWithProgress(container) {
    console.log('📊 Завантаження початкових даних з прогресс-баром...');
    
    const steps = [
        { name: 'Підготовка системи', progress: 10, details: 'Ініціалізація модулів...' },
        { name: 'Завантаження шаблонів', progress: 25, details: 'Отримання шаблонів планів...' },
        { name: 'Завантаження фокусів', progress: 40, details: 'Отримання типів фокусів...' },
        { name: 'Завантаження цілей', progress: 55, details: 'Отримання тижневих цілей...' },
        { name: 'Завантаження планів', progress: 70, details: 'Отримання активних планів...' },
        { name: 'Завантаження співробітників', progress: 85, details: 'Отримання списку співробітників...' },
        { name: 'Завершення', progress: 100, details: 'Фіналізація даних...' }
    ];
    
    try {
        // Шаг 1: Подготовка системы
        updateLoadingProgress(steps[0].name, steps[0].progress, steps[0].details);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Шаг 2: Загрузка шаблонов
        updateLoadingProgress(steps[1].name, steps[1].progress, steps[1].details);
        const planTemplates = await loadPlanTemplatesFromFirebase();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Шаг 3: Загрузка фокусов
        updateLoadingProgress(steps[2].name, steps[2].progress, steps[2].details);
        const focusTypes = await loadFocusTypes();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Шаг 4: Загрузка целей
        updateLoadingProgress(steps[3].name, steps[3].progress, steps[3].details);
        const goals = await loadGoalsFromFirebase();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Шаг 5: Загрузка планов
        updateLoadingProgress(steps[4].name, steps[4].progress, steps[4].details);
        const { plans, massAssignmentHistory } = await loadPlansFromStorage();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Шаг 6: Загрузка сотрудников
        updateLoadingProgress(steps[5].name, steps[5].progress, steps[5].details);
        const employees = await loadEmployees();
        const departments = await loadDepartments();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Шаг 7: Завершение
        updateLoadingProgress(steps[6].name, steps[6].progress, steps[6].details);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Оновлюємо стан з завантаженими даними
        updateState({
            planFactData: {
                planTemplates,
                focusTypes,
                goals,
                plans,
                employees,
                departments,
                massAssignmentHistory
            }
        });
        
        console.log('✅ Початкові дані завантажено з прогресс-баром');
        
    } catch (error) {
        console.error('❌ Помилка завантаження початкових даних:', error);
        throw error;
    }
}

/**
 * Рендеринг головного інтерфейсу
 */
function renderMainInterface(container) {
    console.log('🎨 Рендеринг головного інтерфейсу...');
    
    // Создаем временный контейнер для нового интерфейса
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = `
        <div class="bg-gray-900 min-h-screen">
            <!-- Заголовок -->
            <div class="bg-gray-800 border-b border-gray-700">
                <div class="px-6 py-4">
                    <div class="flex justify-between items-center">
                        <h1 class="text-2xl font-bold text-white">📊 План-Факт</h1>
                        <div class="flex items-center space-x-4">
                            <div class="text-sm text-gray-400">
                                <span id="last-update-info">Останнє оновлення: -</span>
                            </div>
                            <button id="background-service-toggle" 
                                    class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-red-600">
                                🔄 Автооновлення
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Навігація -->
            <div class="bg-gray-800 border-b border-gray-700">
                <div class="px-6 py-2">
                    <nav class="flex space-x-8">
                        <button data-tab="dashboard" class="tab-button active px-3 py-2 text-sm font-medium text-white border-b-2 border-blue-500">
                            📊 Дашборд
                        </button>
                        <button data-tab="constructor" class="tab-button px-3 py-2 text-sm font-medium text-gray-300 hover:text-white border-b-2 border-transparent">
                            🏗️ Конструктор планів
                        </button>
                        <button data-tab="focus-manager" class="tab-button px-3 py-2 text-sm font-medium text-gray-300 hover:text-white border-b-2 border-transparent">
                            🎯 Управління фокусами
                        </button>
                        <button data-tab="mass-assignment" class="tab-button px-3 py-2 text-sm font-medium text-gray-300 hover:text-white border-b-2 border-transparent">
                            👥 Масове призначення
                        </button>
                        <button data-tab="goals" class="tab-button px-3 py-2 text-sm font-medium text-gray-300 hover:text-white border-b-2 border-transparent">
                            🎯 Цілі
                        </button>
                    </nav>
                </div>
            </div>
            
            <!-- Контент с персистентными контейнерами -->
            <div id="plan-fact-content" class="p-6">
                <!-- Контейнер для дашборда -->
                <div id="dashboard-content-wrapper" class="tab-content" style="display: none;">
                    <!-- Контент дашборда будет здесь -->
                </div>
                
                <!-- Контейнер для конструктора -->
                <div id="constructor-content-wrapper" class="tab-content" style="display: none;">
                    <!-- Контент конструктора будет здесь -->
                </div>
                
                <!-- Контейнер для управления фокусами -->
                <div id="focus-manager-content-wrapper" class="tab-content" style="display: none;">
                    <!-- Контент управления фокусами будет здесь -->
                </div>
                
                <!-- Контейнер для массового назначения -->
                <div id="mass-assignment-content-wrapper" class="tab-content" style="display: none;">
                    <!-- Контент массового назначения будет здесь -->
                </div>
                
                <!-- Контейнер для целей -->
                <div id="goals-content-wrapper" class="tab-content" style="display: none;">
                    <!-- Контент целей будет здесь -->
                </div>
            </div>
        </div>
    `;
    
    // Плавно заменяем содержимое контейнера
    fadeTransition(container, tempContainer.firstElementChild);
    
    // Оновлюємо інформацію про останнє оновлення
    updateLastUpdateInfo();
}

/**
 * Плавный переход между интерфейсами
 */
function fadeTransition(container, newContent) {
    // Добавляем новый контент с прозрачностью 0
    newContent.style.opacity = '0';
    newContent.style.transition = 'opacity 0.5s ease-in-out';
    container.appendChild(newContent);
    
    // Плавно показываем новый контент
    setTimeout(() => {
        newContent.style.opacity = '1';
    }, 50);
    
    // Удаляем старый контент после завершения анимации
    setTimeout(() => {
        const oldContent = container.querySelector('.bg-gray-900.min-h-screen:not(:last-child)');
        if (oldContent) {
            oldContent.remove();
        }
    }, 550);
}

/**
 * Налаштування обробників подій
 */
function setupEventHandlers() {
    console.log('🔧 Налаштування обробників подій...');
    
    // Обробники вкладок
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Обробник перемикача фонового сервісу
    const toggleButton = document.getElementById('background-service-toggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleBackgroundService);
    }
    
    // Оновлюємо статус кнопки
    updateBackgroundServiceButton();
}

/**
 * Переключення вкладок
 */
async function switchTab(tabName) {
    const operationId = `switchTab_${tabName}`;
    console.log(`🔄 Переключення на вкладку: ${tabName}`);
    
    try {
        // Проверяем, можно ли выполнить операцию
        if (!canPerformOperation(operationId)) {
            console.log(`⚠️ Переключення на вкладку ${tabName} заблоковано, чекаємо завершення іншої операції...`);
            return;
        }
        
        // Блокируем выполнение других операций
        if (!lockOperation(operationId)) {
            console.log(`⚠️ Неможливо заблокувати переключення на вкладку ${tabName}`);
            return;
        }
        
        // Проверяем текущее состояние
        const currentState = getState();
        if (currentState.isLoading) {
            console.log('⚠️ Модуль вже завантажується, чекаємо завершення...');
            unlockOperation(operationId);
            return;
        }
        
        setLoading(true);
        setCurrentTab(tabName);
        
        // Оновлюємо активну вкладку в UI
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active', 'text-white', 'border-blue-500');
            button.classList.add('text-gray-300', 'border-transparent');
        });
        
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active', 'text-white', 'border-blue-500');
            activeButton.classList.remove('text-gray-300', 'border-transparent');
        }
        
        // Получаем контейнер для активной вкладки
        const contentWrapper = document.getElementById(`${tabName}-content-wrapper`);
        if (!contentWrapper) {
            console.error(`❌ Контейнер для вкладки ${tabName} не знайдено`);
            setLoading(false);
            unlockOperation(operationId);
            return;
        }
        
        // Скрываем все контейнеры вкладок
        document.querySelectorAll('.tab-content').forEach(wrapper => {
            wrapper.style.display = 'none';
        });
        
        // Проверяем, был ли контент уже загружен
        const isLoaded = contentWrapper.getAttribute('data-loaded') === 'true';
        
        if (!isLoaded) {
            console.log(`📦 Контент вкладки ${tabName} ще не завантажений, завантажуємо...`);
            
            // Показуємо анимацию загрузки
            contentWrapper.innerHTML = `
                <div class="flex items-center justify-center py-12">
                    <div class="text-center">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-4"></div>
                        <p class="text-lg font-medium text-gray-200 mb-2">Завантаження ${getTabDisplayName(tabName)}...</p>
                        <div class="flex justify-center space-x-1">
                            <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                            <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                            <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                        </div>
                    </div>
                </div>
            `;
            
            // Показываем контейнер
            contentWrapper.style.display = 'block';
            
            // Загружаем контент вкладки
            try {
                switch (tabName) {
                    case 'dashboard':
                        await renderDashboardTab(contentWrapper);
                        break;
                    case 'constructor':
                        await renderConstructorTab(contentWrapper);
                        break;
                    case 'focus-manager':
                        await renderFocusManagerTab(contentWrapper);
                        break;
                    case 'mass-assignment':
                        await renderMassAssignmentTab(contentWrapper);
                        break;
                    case 'goals':
                        await renderGoalsTab(contentWrapper);
                        break;
                    default:
                        console.warn(`⚠️ Невідома вкладка: ${tabName}`);
                }
                
                // Отмечаем контент как загруженный
                contentWrapper.setAttribute('data-loaded', 'true');
                console.log(`✅ Контент вкладки ${tabName} завантажено успішно`);
                
            } catch (error) {
                console.error(`❌ Помилка завантаження контенту вкладки ${tabName}:`, error);
                contentWrapper.innerHTML = `
                    <div class="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
                        <div class="text-red-400 text-6xl mb-4">⚠️</div>
                        <h2 class="text-xl font-bold text-red-400 mb-2">Помилка завантаження</h2>
                        <p class="text-sm text-gray-400 mb-6">${error.message}</p>
                        <button onclick="switchTab('${tabName}')" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            🔄 Спробувати ще раз
                        </button>
                    </div>
                `;
            }
        } else {
            console.log(`✅ Контент вкладки ${tabName} вже завантажений, показуємо...`);
            // Просто показываем уже загруженный контент
            contentWrapper.style.display = 'block';
        }
        
        setLoading(false);
        
        console.log(`✅ Вкладка ${tabName} успішно переключена`);
        
    } catch (error) {
        console.error(`❌ Помилка переключення вкладки ${tabName}:`, error);
        setLoading(false);
    } finally {
        // Разблокируем операцию
        unlockOperation(operationId);
    }
}

/**
 * Получение отображаемого имени вкладки
 */
function getTabDisplayName(tabName) {
    const tabNames = {
        'dashboard': '📊 Дашборд',
        'constructor': '🏗️ Конструктор планів',
        'focus-manager': '🎯 Управління фокусами',
        'mass-assignment': '👥 Масове призначення',
        'goals': '🎯 Цілі'
    };
    
    return tabNames[tabName] || tabName;
}

/**
 * Показ анимации загрузки для вкладки
 */
function showTabLoadingAnimation(container, tabName) {
    const tabNames = {
        'dashboard': '📊 Дашборд',
        'constructor': '🏗️ Конструктор планів',
        'focus-manager': '🎯 Управління фокусами',
        'mass-assignment': '👥 Масове призначення',
        'goals': '🎯 Цілі'
    };
    
    const tabNameDisplay = tabNames[tabName] || tabName;
    
    container.innerHTML = `
        <div class="flex items-center justify-center py-12">
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mb-4"></div>
                <p class="text-lg font-medium text-gray-200 mb-2">Завантаження ${tabNameDisplay}...</p>
                <div class="flex justify-center space-x-1">
                    <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                    <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                    <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Завантаження даних дашборду
 */
async function loadDashboardData() {
    console.log('📊 Завантаження даних дашборду...');
    
    try {
        // Показуємо анимацию завантаження для дашборду
        const contentContainer = document.getElementById('plan-fact-content');
        if (contentContainer) {
            showTabLoadingAnimation(contentContainer, 'dashboard');
        }
        
        // Викликаємо оновлення дашборду і чекаємо завершення
        if (typeof window.updateDashboardData === 'function') {
            await window.updateDashboardData();
        } else {
            // Якщо функція не існує, чекаємо трохи для імітації завантаження
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('✅ Дані дашборду завантажено');
        
    } catch (error) {
        console.error('❌ Помилка завантаження даних дашборду:', error);
        throw error;
    }
}

/**
 * Перемикач фонового сервісу
 */
function toggleBackgroundService() {
    const status = getServiceStatus();
    
    if (status.isActive) {
        stopBackgroundService();
    } else {
        startBackgroundService();
    }
    
    updateBackgroundServiceButton();
}

/**
 * Оновлення кнопки фонового сервісу
 */
function updateBackgroundServiceButton() {
    const button = document.getElementById('background-service-toggle');
    if (!button) return;
    
    const status = getServiceStatus();
    
    if (status.isActive) {
        button.textContent = '🛑 Зупинити автооновлення';
        button.classList.remove('bg-green-600', 'hover:bg-red-600');
        button.classList.add('bg-red-600', 'hover:bg-green-600');
    } else {
        button.textContent = '🔄 Автооновлення';
        button.classList.remove('bg-red-600', 'hover:bg-green-600');
        button.classList.add('bg-green-600', 'hover:bg-red-600');
    }
}

/**
 * Оновлення інформації про останнє оновлення
 */
function updateLastUpdateInfo() {
    const infoElement = document.getElementById('last-update-info');
    if (!infoElement) return;
    
    const status = getServiceStatus();
    
    if (status.lastUpdate) {
        const lastUpdate = new Date(status.lastUpdate);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastUpdate) / 1000 / 60);
        
        infoElement.textContent = `Останнє оновлення: ${diffMinutes} хв тому`;
    } else {
        infoElement.textContent = 'Останнє оновлення: -';
    }
}

// === ЗАВАНТАЖЕННЯ ДАНИХ ===

/**
 * Завантаження шаблонів планів з Firebase
 */
async function loadPlanTemplatesFromFirebase() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            console.warn('⚠️ ID компанії не знайдено, завантажуємо з localStorage');
            
            // Загружаем из localStorage
            try {
                const savedData = localStorage.getItem('planFactData');
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    const planTemplates = parsedData.planTemplates || [];
                    console.log(`📋 Завантажено ${planTemplates.length} шаблонів з localStorage`);
                    
                    return planTemplates;
                } else {
                    return [];
                }
            } catch (storageError) {
                console.error('❌ Помилка завантаження з localStorage:', storageError);
                return [];
            }
            
            // Показуємо повідомлення користувачу
            if (window.showToast) {
                showToast('💡 Для роботи з планами потрібно налаштувати компанію', 'info');
            }
            return [];
        }
        
        console.log('🔥 Завантаження шаблонів планів з Firebase...');
        
        const templatesRef = firebase.collection(firebase.db, 'companies', companyId, 'planTemplates');
        const snapshot = await firebase.getDocs(templatesRef);
        
        const planTemplates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`📋 Завантажено ${planTemplates.length} шаблонів планів з Firebase`);
        
        return planTemplates;
        
    } catch (error) {
        console.error('❌ Помилка завантаження шаблонів планів:', error);
        return [];
    }
}

/**
 * Завантаження типів фокусних задач
 */
async function loadFocusTypes() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            console.warn('⚠️ ID компанії не знайдено, завантажуємо типи фокусів з localStorage');
            
            // Загружаем из localStorage
            try {
                const savedData = localStorage.getItem('planFactData');
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    const focusTypes = parsedData.focusTypes || [];
                    console.log(`🎯 Завантажено ${focusTypes.length} типів фокусів з localStorage`);
                    
                                        return focusTypes;
                } else {
                    return [];
                }
            } catch (storageError) {
                console.error('❌ Помилка завантаження типів фокусів з localStorage:', storageError);
                return [];
            }
            return [];
        }
        
        console.log('🎯 Завантаження типів фокусних задач...');
        
        const focusTypesRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTypes');
        const snapshot = await firebase.getDocs(focusTypesRef);
        
        const focusTypes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`🎯 Завантажено ${focusTypes.length} типів фокусних задач`);
        
        return focusTypes;
        
    } catch (error) {
        console.error('❌ Помилка завантаження типів фокусів:', error);
        return [];
    }
}

// Экспортируем функцию для использования в других модулях
window.loadFocusTypesFromFirebase = loadFocusTypes;

/**
 * Завантаження цілей з Firebase
 */
async function loadGoalsFromFirebase() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            console.warn('⚠️ ID компанії не знайдено, завантажуємо цілі з localStorage');
            
            // Загружаем из localStorage
            try {
                const savedData = localStorage.getItem('planFactData');
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    const goals = parsedData.goals || [];
                    console.log(`🎯 Завантажено ${goals.length} цілей з localStorage`);
                    
                    return goals;
                } else {
                    return [];
                }
            } catch (storageError) {
                console.error('❌ Помилка завантаження цілей з localStorage:', storageError);
                return [];
            }
            return [];
        }
        
        console.log('🎯 Завантаження цілей з Firebase...');
        
        const goalsRef = firebase.collection(firebase.db, 'companies', companyId, 'weeklyGoals');
        const snapshot = await firebase.getDocs(goalsRef);
        
        const goals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`🎯 Завантажено ${goals.length} цілей з Firebase`);
        
        return goals;
        
    } catch (error) {
        console.error('❌ Помилка завантаження цілей:', error);
        return [];
    }
}

/**
 * Завантаження планів з Firebase або localStorage
 */
async function loadPlansFromStorage() {
    try {
        const companyId = window.state?.currentCompanyId;
        
        if (!companyId) {
            console.warn('⚠️ ID компанії не знайдено, завантажуємо плани з localStorage');
            
            // Загружаем из localStorage
            try {
                const savedData = localStorage.getItem('planFactData');
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    const plans = parsedData.plans || [];
                    const massAssignmentHistory = parsedData.massAssignmentHistory || [];
                    console.log(`📋 Завантажено ${plans.length} планів з localStorage`);
                    console.log(`📋 Завантажено ${massAssignmentHistory.length} записів історії з localStorage`);
                    
                    return { plans, massAssignmentHistory };
                } else {
                    return { plans: [], massAssignmentHistory: [] };
                }
            } catch (storageError) {
                console.error('❌ Помилка завантаження планів з localStorage:', storageError);
                return { plans: [], massAssignmentHistory: [] };
            }
            return { plans: [], massAssignmentHistory: [] };
        }
        
        console.log('📋 Завантаження планів з Firebase...');
        
        const plansRef = firebase.collection(firebase.db, 'companies', companyId, 'plans');
        const snapshot = await firebase.getDocs(plansRef);
        
        const plans = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`📋 Завантажено ${plans.length} планів з Firebase`);
        
        // TODO: Загрузка истории из Firebase при наличии
        const massAssignmentHistory = [];
        
        return { plans, massAssignmentHistory };
        
    } catch (error) {
        console.error('❌ Помилка завантаження планів:', error);
        return { plans: [], massAssignmentHistory: [] };
    }
}

/**
 * Завантаження співробітників та відділів
 */
async function loadEmployees() {
    try {
        // Використовуємо дані з window.state
        const employees = window.state?.allEmployees || [];
        console.log(`👥 Завантажено ${employees.length} співробітників`);
        
        return employees;
    } catch (error) {
        console.error('❌ Помилка завантаження співробітників:', error);
        return [];
    }
}

/**
 * Завантаження відділів
 */
async function loadDepartments() {
    try {
        // Використовуємо дані з window.state
        const departments = window.state?.departments || [];
        console.log(`🏢 Завантажено ${departments.length} відділів`);
        
        return departments;
    } catch (error) {
        console.error('❌ Помилка завантаження відділів:', error);
        return [];
    }
}

// === ТЕСТОВІ ДАНІ ===
function getTestPlanTemplates() {
    return [
        {
            id: 'template-1',
            name: 'Шаблон для кав\'ярні',
            departmentId: 'dept-1',
            departmentName: 'КАВ\'ЯРНЯ',
            monthKey: '202508',
            revenuePlan: 2629453,
            status: 'active',
            createdAt: new Date(),
            createdBy: 'demo-user',
            
            // Фокусні задачі
            focusTasks: [
                {
                    focusTypeId: 'focus-1',
                    focusTypeName: 'Комерційні пропозиції',
                    focusType: 'quantity',
                    focusUnit: 'шт'
                },
                {
                    focusTypeId: 'focus-2',
                    focusTypeName: 'Ефективні дзвінки',
                    focusType: 'quantity',
                    focusUnit: 'шт'
                },
                {
                    focusTypeId: 'focus-3',
                    focusTypeName: 'Середній чек',
                    focusType: 'revenue',
                    focusUnit: 'грн'
                }
            ]
        },
        {
            id: 'template-2',
            name: 'Шаблон для закладів',
            departmentId: 'dept-2',
            departmentName: 'ЗАКЛАДИ',
            monthKey: '202508',
            revenuePlan: 1500000,
            status: 'draft',
            createdAt: new Date(),
            createdBy: 'demo-user',
            
            // Фокусні задачі
            focusTasks: [
                {
                    focusTypeId: 'focus-1',
                    focusTypeName: 'Комерційні пропозиції',
                    focusType: 'quantity',
                    focusUnit: 'шт'
                },
                {
                    focusTypeId: 'focus-4',
                    focusTypeName: 'Нові клієнти',
                    focusType: 'quantity',
                    focusUnit: 'шт'
                }
            ]
        }
    ];
}

function getTestGoals() {
    return [
        {
            id: 'goal-1',
            name: 'Комерційні пропозиції тиждень 1',
            weekKey: '2025-W01',
            type: 'commercial_proposals',
            target: 50,
            progress: 35,
            description: 'Створити комерційні пропозиції для нових клієнтів',
            managerId: 'emp-1',
            managerName: 'Ангеліна Мудрицька',
            status: 'active',
            clients: ['client-1', 'client-2'],
            createdAt: new Date().toISOString(),
            createdBy: 'demo-user'
        }
    ];
}

function getTestFocusTypes() {
    return [
        {
            id: 'focus-1',
            name: 'Комерційні пропозиції',
            type: 'quantity',
            description: 'Кількість створених комерційних пропозицій',
            unit: 'шт',
            category: 'sales'
        },
        {
            id: 'focus-2',
            name: 'Ефективні дзвінки',
            type: 'quantity',
            description: 'Кількість проведених ефективних дзвінків',
            unit: 'шт',
            category: 'communication'
        },
        {
            id: 'focus-3',
            name: 'Середній чек',
            type: 'revenue',
            description: 'Середній чек за замовлення',
            unit: 'грн',
            category: 'financial'
        },
        {
            id: 'focus-4',
            name: 'Зразки товарів',
            type: 'quantity',
            description: 'Кількість відправлених зразків',
            unit: 'шт',
            category: 'sales'
        }
    ];
}