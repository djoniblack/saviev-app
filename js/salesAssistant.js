// salesAssistant.js
// Полная интеграция двух вкладок: Помічник и Сигналізація

import * as firebase from './firebase.js';
import { initDashboardPage } from './dashboard.js';
import { initFocusPage } from './focus.js';
import { initFocus2Module } from './salesAssistant/focus2/index.js';
import { loadClientManagerDirectory } from './main.js';
import { initDepartmentDashboard } from './departmentDashboard.js';
import { initSmartDayModule } from './smartDay.js';
import { initDebtsModule, cleanupDebtsModule } from './debts.js';
import { initPlanFactModule } from './planFact.js';
import { initManagerCalendarModule, cleanupManagerCalendarModule } from './managerCalendar.js';
import { initWorkloadModule, cleanupWorkloadModule } from './workload.js';
import { initCommercialProposalModule } from './salesAssistant/commercialProposal/index.js';

export function initSalesAssistantPage(container) {
    if (!container) {
        console.error('Container is null in initSalesAssistantPage');
        return;
    }
    
    // Проверяем, готов ли DOM
    if (document.readyState !== 'complete') {
        console.log('DOM not ready, waiting...');
        document.addEventListener('DOMContentLoaded', () => {
            initSalesAssistantPage(container);
        });
        return;
    }
    container.innerHTML = `
        <div class="modern-tabs-container mb-2">
            <div class="modern-tabs-wrapper">
                <button id="assistantTabBtn" class="modern-tab-btn active" data-tab="assistant">
                    <i class="fas fa-chart-line tab-icon"></i>
                    <span class="tab-text">Помічник</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="signalizationTabBtn" class="modern-tab-btn" data-tab="signalization">
                    <i class="fas fa-bell tab-icon"></i>
                    <span class="tab-text">Сигналізація</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="departmentDashboardTabBtn" class="modern-tab-btn" data-tab="department">
                    <i class="fas fa-building tab-icon"></i>
                    <span class="tab-text">Дашборд по відділах</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="focusTabBtn" class="modern-tab-btn" data-tab="focus">
                    <i class="fas fa-bullseye tab-icon"></i>
                    <span class="tab-text">Фокус 2.0</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="smartDayTabBtn" class="modern-tab-btn" data-tab="smart-day">
                    <i class="fas fa-calendar-day tab-icon"></i>
                    <span class="tab-text">Створи мій день</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="debtsTabBtn" class="modern-tab-btn" data-tab="debts">
                    <i class="fas fa-money-bill-wave tab-icon"></i>
                    <span class="tab-text">Дебіторка</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="planFactTabBtn" class="modern-tab-btn" data-tab="plan-fact">
                    <i class="fas fa-chart-bar tab-icon"></i>
                    <span class="tab-text">План-Факт</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="managerCalendarTabBtn" class="modern-tab-btn" data-tab="calendar">
                    <i class="fas fa-calendar-alt tab-icon"></i>
                    <span class="tab-text">Календар менеджера</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="workloadTabBtn" class="modern-tab-btn" data-tab="workload">
                    <i class="fas fa-tachometer-alt tab-icon"></i>
                    <span class="tab-text">Навантаження</span>
                    <div class="tab-indicator"></div>
                </button>
                <button id="commercialProposalTabBtn" class="modern-tab-btn" data-tab="commercial-proposal">
                    <i class="fas fa-file-contract tab-icon"></i>
                    <span class="tab-text">Комерційна пропозиція</span>
                    <div class="tab-indicator"></div>
                </button>
            </div>
        </div>
        <div id="salesAssistantMain"></div>
        <div id="alerts-root" class="hidden"></div>
        <div id="department-dashboard-root" class="hidden"></div>
        <div id="focus-root" class="hidden"></div>
        <div id="smartday-root" class="hidden"></div>
        <div id="debts-root" class="hidden"></div>
        <div id="planfact-root" class="hidden"></div>
        <div id="manager-calendar-root" class="hidden"></div>
        <div id="workload-root" class="hidden"></div>
        <div id="commercial-proposal-root" class="hidden"></div>
    `;

    const assistantTabBtn = container.querySelector('#assistantTabBtn');
    const signalizationTabBtn = container.querySelector('#signalizationTabBtn');
    const departmentDashboardTabBtn = container.querySelector('#departmentDashboardTabBtn');
    const focusTabBtn = container.querySelector('#focusTabBtn');
    const smartDayTabBtn = container.querySelector('#smartDayTabBtn');
    const debtsTabBtn = container.querySelector('#debtsTabBtn');
    const planFactTabBtn = container.querySelector('#planFactTabBtn');
    const managerCalendarTabBtn = container.querySelector('#managerCalendarTabBtn');
    const workloadTabBtn = container.querySelector('#workloadTabBtn');
    
    const mainBlock = container.querySelector('#salesAssistantMain');
    const alertsRoot = container.querySelector('#alerts-root');
    const departmentDashboardRoot = container.querySelector('#department-dashboard-root');
    const focusRoot = container.querySelector('#focus-root');
    const smartDayRoot = container.querySelector('#smartday-root');
    const debtsRoot = container.querySelector('#debts-root');
    const planFactRoot = container.querySelector('#planfact-root');
    const managerCalendarRoot = container.querySelector('#manager-calendar-root');
    const workloadRoot = container.querySelector('#workload-root');
    
    let alertsInited = false;
    let departmentDashboardInited = false;
    let focusInited = false;
    let smartDayInited = false;
    let debtsInited = false;
    let planFactInited = false;
    let managerCalendarInited = false;
    let workloadInited = false;
    let commercialProposalInited = false;

    function setActiveTab(activeBtn) {
        // Очищаем модуль дебиторки при переключении на другие вкладки
        if (debtsInited && activeBtn !== debtsTabBtn) {
            cleanupDebtsModule();
            console.log('🧹 Модуль дебиторки очищен при переключении вкладки');
        }
        
        // УБРАНО: Очистка модуля календаря - теперь он сохраняет состояние
        // if (managerCalendarInited && activeBtn !== managerCalendarTabBtn) {
        //     cleanupManagerCalendarModule();
        //     console.log('🧹 Модуль календаря очищен при переключении вкладки');
        // }
        
        // Очищаем модуль навантаження при переключении на другие вкладки
        if (workloadInited && activeBtn !== workloadTabBtn) {
            cleanupWorkloadModule();
            console.log('🧹 Модуль навантаження очищен при переключении вкладки');
        }
        
        // Видаляємо активний клас з усіх кнопок
        const allBtns = [assistantTabBtn, signalizationTabBtn, departmentDashboardTabBtn, focusTabBtn, smartDayTabBtn, debtsTabBtn, planFactTabBtn, managerCalendarTabBtn, workloadTabBtn, commercialProposalTabBtn];
        allBtns.forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Додаємо активний клас до обраної кнопки
        activeBtn.classList.add('active');
        
        // Додаємо анімацію для активної кнопки
        activeBtn.style.animation = 'none';
        activeBtn.offsetHeight; // Trigger reflow
        activeBtn.style.animation = 'tabSlideIn 0.3s ease-out';

        mainBlock.classList.add('hidden');
        alertsRoot.classList.add('hidden');
        departmentDashboardRoot.classList.add('hidden');
        focusRoot.classList.add('hidden');
        smartDayRoot.classList.add('hidden');
        debtsRoot.classList.add('hidden');
        planFactRoot.classList.add('hidden');
        managerCalendarRoot.classList.add('hidden');
        workloadRoot.classList.add('hidden');
    }

    function showAssistantTab() {
        setActiveTab(assistantTabBtn);
        mainBlock.classList.remove('hidden');
        
        // Проверяем, выбрана ли компания
        if (!window.state?.currentCompanyId) {
            mainBlock.innerHTML = `
                <div class="w-full min-h-screen pb-6">
                    <header class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 class="text-3xl md:text-4xl font-bold">Помічник продажу</h1>
                            <p class="mt-2">Аналіз та рекомендації по продажах.</p>
                        </div>
                    </header>
                    
                    <div class="text-center p-8">
                        <div class="text-yellow-500 mb-4">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                        </div>
                        <p class="text-lg font-medium text-gray-200 mb-2">Компанія не вибрана</p>
                        <p class="text-sm text-gray-400">Будь ласка, спочатку виберіть компанію для роботи з помічником продажу</p>
                    </div>
                </div>
            `;
            return;
        }
        
        renderSalesAssistantMain(mainBlock);
    }
    async function showSignalizationTab() {
        console.log('📊 Відкриття вкладки сигналізації');
        setActiveTab(signalizationTabBtn);
        alertsRoot.classList.remove('hidden');
        if (!alertsInited) {
            try {
                // Динамічно завантажуємо модуль сигналізації
                console.log('📦 Завантаження модуля сигналізації...');
                const signalizationModule = await import('./signalization.js?v=1754480168835');
                console.log('✅ Модуль сигналізації завантажено');
                
                // Ініціалізуємо модуль
                await signalizationModule.initSignalizationModule(alertsRoot);
                alertsInited = true;
            } catch (error) {
                console.error('❌ Помилка завантаження модуля сигналізації:', error);
                // Fallback до старого модуля якщо новий не завантажений
                if (window.initAlertsModule) {
                    console.log('⚠️ Використовуємо старий модуль як fallback');
                    window.initAlertsModule(alertsRoot);
                } else {
                    alertsRoot.innerHTML = '<div class="text-red-500 p-4">Помилка завантаження модуля сигналізації</div>';
                }
                alertsInited = true;
            }
        }
    }

    function showDepartmentDashboardTab() {
        setActiveTab(departmentDashboardTabBtn);
        departmentDashboardRoot.classList.remove('hidden');
        if (!departmentDashboardInited) {
            initDepartmentDashboard(departmentDashboardRoot);
            departmentDashboardInited = true;
        }
    }
    async function showFocusTab() {
        setActiveTab(focusTabBtn);
        focusRoot.classList.remove('hidden');
        if (!focusInited) {
            try {
                await initFocus2Module(focusRoot);
                focusInited = true;
            } catch (error) {
                console.error('❌ Ошибка инициализации Фокус 2.0:', error);
            }
        }
    }
    function showSmartDayTab() {
        setActiveTab(smartDayTabBtn);
        smartDayRoot.classList.remove('hidden');
        if (!smartDayInited && window.initSmartDayModule) {
            initSmartDayModule(smartDayRoot);
            smartDayInited = true;
        }
    }
    function showDebtsTab() {
        setActiveTab(debtsTabBtn);
        debtsRoot.classList.remove('hidden');
        if (!debtsInited) {
            initDebtsModule(debtsRoot);
            debtsInited = true;
        }
    }
    function showPlanFactTab() {
        setActiveTab(planFactTabBtn);
        planFactRoot.classList.remove('hidden');
        if (!planFactInited) {
            initPlanFactModule(planFactRoot);
            planFactInited = true;
        }
    }
    
    function showManagerCalendarTab() {
        setActiveTab(managerCalendarTabBtn);
        managerCalendarRoot.classList.remove('hidden');
        
        // Инициализируем календарь только при первом запуске
        if (!managerCalendarInited) {
            initManagerCalendarModule(managerCalendarRoot);
            managerCalendarInited = true;
        } else {
            // Если календарь уже инициализирован, просто восстанавливаем его
            if (window.managerCalendarInstance && window.managerCalendarInstance.isFrozen) {
                window.managerCalendarInstance.init(managerCalendarRoot);
            }
        }
    }

    async function showWorkloadTab() {
        console.log('📊 Відкриття вкладки навантаження');
        setActiveTab(workloadTabBtn);
        workloadRoot.classList.remove('hidden');
        if (!workloadInited) {
            try {
                // Динамічно завантажуємо модуль навантаження
                const workloadModule = await import('./workload.js?v=1754480168835');
                await workloadModule.initWorkloadModule(workloadRoot);
                workloadInited = true;
                console.log('✅ Модуль навантаження инициализирован');
            } catch (error) {
                console.error('❌ Ошибка инициализации модуля навантаження:', error);
            }
        }
    }

    function showCommercialProposalTab() {
        console.log('📋 Відкриття вкладки комерційної пропозиції');
        setActiveTab(commercialProposalTabBtn);
        const commercialProposalRoot = container.querySelector('#commercial-proposal-root');
        commercialProposalRoot.classList.remove('hidden');
        
        if (!commercialProposalInited) {
            try {
                initCommercialProposalModule(commercialProposalRoot);
                commercialProposalInited = true;
                console.log('✅ Модуль комерційної пропозиції успішно ініціалізовано');
            } catch (error) {
                console.error('❌ Помилка ініціалізації модуля комерційної пропозиції:', error);
                commercialProposalRoot.innerHTML = `
                    <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                        <h2 class="text-2xl font-bold text-white mb-4">Помилка завантаження</h2>
                        <p class="text-gray-300">Не вдалося завантажити модуль комерційної пропозиції</p>
                    </div>
                `;
            }
        }
    }

            assistantTabBtn.onclick = showAssistantTab;
        signalizationTabBtn.onclick = showSignalizationTab;
        departmentDashboardTabBtn.onclick = showDepartmentDashboardTab;
        focusTabBtn.onclick = showFocusTab;
        smartDayTabBtn.onclick = showSmartDayTab;
        debtsTabBtn.onclick = showDebtsTab;
        planFactTabBtn.onclick = showPlanFactTab;
        managerCalendarTabBtn.onclick = showManagerCalendarTab;
        workloadTabBtn.onclick = showWorkloadTab;
        commercialProposalTabBtn.onclick = showCommercialProposalTab;
    showAssistantTab(); // По умолчанию
}

// --- Додаю функцію для завантаження співробітників ---
async function loadEmployees(companyId) {
    try {
        // Проверяем разрешения пользователя
        const currentState = window.state;
        console.log('🔍 Проверка разрешений для доступа к сотрудникам:', {
            isOwner: currentState?.currentUserPermissions?.isOwner,
            settings_employees_manage: currentState?.currentUserPermissions?.settings_employees_manage,
            timesheet_view: currentState?.currentUserPermissions?.timesheet_view,
            sales_manage: currentState?.currentUserPermissions?.sales_manage,
            allPermissions: currentState?.currentUserPermissions
        });
        
        const hasAccess = currentState?.currentUserPermissions?.isOwner || 
                         currentState?.currentUserPermissions?.settings_employees_manage ||
                         currentState?.currentUserPermissions?.timesheet_view ||
                         currentState?.currentUserPermissions?.sales_manage;
        
        if (!hasAccess) {
            console.warn('⚠️ У пользователя нет разрешений для доступа к сотрудникам');
            return [];
        }
        
        // Если пользователь не привязан к сотруднику, но имеет права sales_manage,
        // то даем ему доступ к сотрудникам
        if (!currentState?.currentUserId && currentState?.currentUserPermissions?.sales_manage) {
            console.log('✅ Пользователь не привязан к сотруднику, но имеет права sales_manage - даем доступ');
        }
        
        try {
            const employeesRef = firebase.collection(firebase.db, 'companies', companyId, 'employees');
            const snapshot = await firebase.getDocs(employeesRef);
            const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(emp => emp.active !== false);
            
            // Если нет сотрудников, но у пользователя есть права sales_manage, создаем демо-данные
            if (employees.length === 0 && currentState?.currentUserPermissions?.sales_manage) {
                console.log('📋 Создаем демо-данные сотрудников для пользователя с правами sales_manage');
                return [
                    {
                        id: 'demo-manager-1',
                        name: 'Демо Менеджер 1',
                        department: { id: 'demo-dept-1', name: 'Відділ продажів' },
                        role: 'менеджер',
                        active: true
                    },
                    {
                        id: 'demo-manager-2', 
                        name: 'Демо Менеджер 2',
                        department: { id: 'demo-dept-1', name: 'Відділ продажів' },
                        role: 'менеджер',
                        active: true
                    }
                ];
            }
            
            return employees;
        } catch (firestoreError) {
            console.error('❌ Ошибка Firestore при загрузке сотрудников:', firestoreError);
            
            // Если ошибка связана с правами доступа, но у пользователя есть sales_manage,
            // создаем демо-данные
            if (firestoreError.code === 'permission-denied' && currentState?.currentUserPermissions?.sales_manage) {
                console.log('📋 Создаем демо-данные сотрудников из-за ошибки прав доступа');
                return [
                    {
                        id: 'demo-manager-1',
                        name: 'Демо Менеджер 1',
                        department: { id: 'demo-dept-1', name: 'Відділ продажів' },
                        role: 'менеджер',
                        active: true
                    },
                    {
                        id: 'demo-manager-2', 
                        name: 'Демо Менеджер 2',
                        department: { id: 'demo-dept-1', name: 'Відділ продажів' },
                        role: 'менеджер',
                        active: true
                    }
                ];
            }
            
            throw firestoreError; // Перебрасываем ошибку дальше
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки сотрудников:', error);
        
        // Если ошибка связана с правами доступа, но у пользователя есть sales_manage
        const currentState = window.state;
        if (error.code === 'permission-denied' && currentState?.currentUserPermissions?.sales_manage) {
            console.warn('⚠️ Ошибка доступа к сотрудникам, но у пользователя есть права sales_manage');
            console.warn('⚠️ Возможно, нужно обновить правила Firestore или привязать пользователя к сотруднику');
            
            // Возвращаем демо-данные вместо пустого массива
            console.log('📋 Возвращаем демо-данные сотрудников из-за ошибки прав доступа');
            return [
                {
                    id: 'demo-manager-1',
                    name: 'Демо Менеджер 1',
                    department: { id: 'demo-dept-1', name: 'Відділ продажів' },
                    role: 'менеджер',
                    active: true
                },
                {
                    id: 'demo-manager-2', 
                    name: 'Демо Менеджер 2',
                    department: { id: 'demo-dept-1', name: 'Відділ продажів' },
                    role: 'менеджер',
                    active: true
                }
            ];
        }
        
        return [];
    }
}

function renderSalesAssistantMain(mainBlock) {
    mainBlock.innerHTML = `
        <div class="w-full min-h-screen pb-6">
            <header class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-3xl md:text-4xl font-bold">Помічник продажу</h1>
                    <p class="mt-2">Аналіз та рекомендації по продажах.</p>
                </div>
            </header>
            
            <!-- Індикатор завантаження -->
            <div id="sales-loading-container" class="text-center p-8">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <div>
                    <p id="sales-loading-message" class="text-lg font-medium text-gray-200 mb-2">Завантаження данных...</p>
                    <div class="bg-gray-700 rounded-full h-2 max-w-md mx-auto mb-2">
                        <div id="sales-progress-bar" class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p id="sales-loading-step" class="text-sm text-gray-400">Ініціалізація...</p>
                </div>
            </div>
            
            <!-- Основний контент (спочатку прихований) -->
            <div id="sales-main-content" class="hidden">
                <div id="analysis-section" class="p-4 mb-4">
                    <h2 class="text-xl font-bold mb-4">Оберіть відділ, менеджера та клієнта для аналізу</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                        <div>
                            <label for="sales-department-filter" class="block text-sm font-medium mb-1">Відділ</label>
                            <select id="sales-department-filter" class="dark-input"></select>
                        </div>
                        <div>
                            <label for="sales-manager-filter" class="block text-sm font-medium mb-1">Менеджер</label>
                            <select id="sales-manager-filter" class="dark-input"></select>
                        </div>
                        <div>
                            <label for="sales-client-search" class="block text-sm font-medium mb-1">Пошук клієнта</label>
                            <input type="text" id="sales-client-search" class="dark-input" placeholder="Почніть вводити ім'я..." disabled>
                        </div>
                        <div>
                            <label for="sales-client-filter" class="block text-sm font-medium mb-1">Клієнт</label>
                            <select id="sales-client-filter" class="dark-input" disabled></select>
                        </div>
                    </div>
                </div>
                <div id="results-section" class="hidden">
                    <div id="client-kpi" class="mb-4"></div>
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
                        <div>
                            <h3 class="text-lg font-bold mb-4">💡 Рекомендації по сфері (<span id="client-sphere-name"></span>)</h3>
                            <ul id="segment-recs" class="list-disc list-inside space-y-2"></ul>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold mb-4">🚀 Хіти продаж в цій сфері для Вас</h3>
                            <ul id="top-sales-recs" class="list-disc list-inside space-y-2"></ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- Додаю нові змінні для співробітників ---
    let masterData = [];
    let clientLinks = {};
    let uniqueClientsByManager = {};
    let employees = [];
    let employeesById = {};
    let managers = [];
    let departments = [];
    let userAccess = {
        userId: null,
        employeeId: null,
        employee: null,
        role: null,
        departmentId: null,
        isAdmin: false
    };
    let allMembers = [];

    // Функции управления UI загрузки
    function updateSalesLoadingProgress(percent, message, step) {
        const progressBar = mainBlock.querySelector('#sales-progress-bar');
        const loadingMessage = mainBlock.querySelector('#sales-loading-message');
        const loadingStep = mainBlock.querySelector('#sales-loading-step');
        
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingStep) loadingStep.textContent = step;
    }
    
    function showSalesMainContent() {
        const loadingContainer = mainBlock.querySelector('#sales-loading-container');
        const mainContent = mainBlock.querySelector('#sales-main-content');
        
        if (loadingContainer) loadingContainer.classList.add('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
    }
    
    function showSalesError(errorMessage) {
        const loadingContainer = mainBlock.querySelector('#sales-loading-container');
        if (loadingContainer) {
            loadingContainer.innerHTML = `
                <div class="text-center p-8">
                    <div class="text-red-500 text-6xl mb-4">⚠️</div>
                    <p class="text-lg font-medium text-red-400 mb-2">Помилка завантаження</p>
                    <p class="text-sm text-gray-400">${errorMessage}</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                        Спробувати ще раз
                    </button>
                </div>
            `;
        }
    }

    const analysisSection = mainBlock.querySelector('#analysis-section');
    const departmentFilter = mainBlock.querySelector('#sales-department-filter');
    const managerFilter = mainBlock.querySelector('#sales-manager-filter');
    const clientSearch = mainBlock.querySelector('#sales-client-search');
    const clientFilter = mainBlock.querySelector('#sales-client-filter');
    const resultsSection = mainBlock.querySelector('#results-section');
    const segmentRecsList = mainBlock.querySelector('#segment-recs');
    const topSalesRecsList = mainBlock.querySelector('#top-sales-recs');
    const clientKpiContainer = mainBlock.querySelector('#client-kpi');
    const clientSphereName = mainBlock.querySelector('#client-sphere-name');

    async function loadAndProcessData() {
        try {
            updateSalesLoadingProgress(5, 'Ініціалізація...', 'Перевірка компанії та користувача');
            
            const companyId = window.state?.currentCompanyId;
            if (!companyId) throw new Error('Компанія не вибрана!');
            
            updateSalesLoadingProgress(10, 'Завантаження користувачів...', 'Отримання інформації про користувача');
            
            // --- Витягуємо userId з window.state або firebase.auth.currentUser.uid ---
            let userId = window.state?.currentUserId;
            if (!userId && firebase.auth && firebase.auth.currentUser) {
                userId = firebase.auth.currentUser.uid;
            }
            userAccess.userId = userId;
            
            updateSalesLoadingProgress(15, 'Завантаження користувачів...', 'Завантаження членів компанії');
            
            // --- Завантажуємо members (користувачі) ---
            const membersRef = firebase.collection(firebase.db, 'companies', companyId, 'members');
            const membersSnap = await firebase.getDocs(membersRef);
            allMembers = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            updateSalesLoadingProgress(25, 'Визначення ролей...', 'Аналіз прав доступу користувача');
            
            // --- Знаходимо поточного користувача у members ---
            const currentMember = allMembers.find(m => m.userId === userId || m.email === window.state?.currentUserEmail);
            if (currentMember && currentMember.employeeId) {
                userAccess.employeeId = currentMember.employeeId;
            }
            // --- Визначаємо роль користувача ---
            if (currentMember) {
                if (currentMember.role) {
                    userAccess.role = currentMember.role.toLowerCase();
                } else if (currentMember.roleId && window.state?.availableRoles) {
                    const roleObj = window.state.availableRoles.find(r => r.id === currentMember.roleId);
                    userAccess.role = (roleObj?.name || '').toLowerCase();
                } else {
                    userAccess.role = '';
                }
            }
            
            // Проверяем, привязан ли пользователь к сотруднику
            if (!userAccess.employeeId) {
                console.log('⚠️ Пользователь не привязан к сотруднику');
                // Если пользователь не привязан к сотруднику, но имеет права sales_manage,
                // то даем ему доступ как администратору
                const currentState = window.state;
                if (currentState?.currentUserPermissions?.sales_manage) {
                    userAccess.isAdmin = true;
                    console.log('✅ Пользователь получил права администратора для модуля продаж');
                }
            }
            
            updateSalesLoadingProgress(35, 'Завантаження даних продажу...', 'Підключення до серверів даних');
            
            const [dataRes, dataJulyRes, refRes, employeesList] = await Promise.all([
                fetch('модуль помічник продажу/data.json'),
                fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
                fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url'),
                loadEmployees(companyId)
            ]);
            
            updateSalesLoadingProgress(60, 'Обробка даних...', 'Парсинг даних продажу та клієнтів');
            
            const data = await dataRes.json();
            const dataJuly = await dataJulyRes.json();
            masterData = data.concat(dataJuly);
            const refData = await refRes.json();
            clientLinks = Object.fromEntries(refData.map(item => [item['Клиент.Код'], item['посилання']]));
            
            updateSalesLoadingProgress(75, 'Обробка співробітників...', 'Завантаження співробітників та відділів');
            
            employees = employeesList;
            
            // Проверяем, есть ли сотрудники
            if (employees.length === 0) {
                console.warn('⚠️ Нет сотрудников для отображения');
                
                // Проверяем, привязан ли пользователь к сотруднику
                const currentState = window.state;
                if (!currentState?.currentUserPermissions?.employeeId) {
                    showSalesError('Для работы с модулем "Помічник продажу" необходимо привязать пользователя к сотруднику или предоставить права администратора. Обратитесь к администратору.');
                } else {
                    showSalesError('Для работы с модулем "Помічник продажу" необходимы разрешения на просмотр сотрудников. Обратитесь к администратору.');
                }
                return;
            }
            
            employees.forEach(emp => {
                employeesById[emp.id] = emp;
            });
            managers = employees.filter(emp => !emp.role || emp.role.toLowerCase().includes('менедж'));
            
            updateSalesLoadingProgress(85, 'Створення структури відділів...', 'Формування списку відділів');
            
            // --- Формуємо список унікальних відділів як об'єктів {id, name} ---
            const depMap = {};
            employees.forEach(emp => {
                if (emp.department) {
                    if (typeof emp.department === 'object' && emp.department.id && emp.department.name) {
                        depMap[emp.department.id] = emp.department.name;
                    } else if (typeof emp.department === 'string') {
                        if (emp.departmentName) {
                            depMap[emp.department] = emp.departmentName;
                        } else {
                            depMap[emp.department] = emp.department;
                        }
                    }
                }
            });
            departments = Object.entries(depMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
            
            // Если нет отделов, но есть демо-сотрудники, создаем демо-отдел
            if (departments.length === 0 && employees.some(emp => emp.id.startsWith('demo-'))) {
                console.log('📋 Создаем демо-отдел для демо-сотрудников');
                departments = [{ id: 'demo-dept-1', name: 'Відділ продажів' }];
            }
            // --- Визначаємо доступи користувача ---
            if (userAccess.employeeId && employeesById[userAccess.employeeId]) {
                userAccess.employee = employeesById[userAccess.employeeId];
                console.log('👤 Загружен объект сотрудника:', userAccess.employee);
                
                // Визначаємо isAdmin (можна розширити список ролей)
                userAccess.isAdmin = userAccess.role.includes('адмін') || userAccess.role.includes('owner') || userAccess.role.includes('власник');
                
                // --- Додаю визначення departmentId для менеджера ---
                if (!userAccess.departmentId && userAccess.employee && userAccess.employee.department) {
                    if (typeof userAccess.employee.department === 'object' && userAccess.employee.department.id) {
                        userAccess.departmentId = userAccess.employee.department.id;
                    } else if (typeof userAccess.employee.department === 'string') {
                        userAccess.departmentId = userAccess.employee.department;
                    }
                }
                console.log('🏢 Определен отдел сотрудника:', userAccess.departmentId);
            } else {
                console.warn('⚠️ Сотрудник не найден в списке:', {
                    employeeId: userAccess.employeeId,
                    availableEmployees: Object.keys(employeesById)
                });
            }
            
            updateSalesLoadingProgress(95, 'Підготовка інтерфейсу...', 'Створення фільтрів та форм');
            
            populateDepartmentFilter();
            populateManagerFilter();
            
            updateSalesLoadingProgress(100, 'Готово!', 'Помічник продажу успішно завантажено');

            // --- Додаю підтримку автоматичного вибору клієнта ---
            if (window.state && window.state.preselectClientCode) {
                const clientCode = window.state.preselectClientCode;
                const clientSales = masterData.filter(item => item['Клиент.Код'] == clientCode);
                if (clientSales.length) {
                    const managerName = clientSales[0]['Основной менеджер'];
                    const manager = managers.find(m => m.name === managerName);
                    if (manager) {
                        // Виставляємо фільтри
                        departmentFilter.value = manager.department?.id || manager.department || '';
                        departmentFilter.dispatchEvent(new Event('change'));
                        setTimeout(() => {
                            managerFilter.value = manager.id;
                            managerFilter.dispatchEvent(new Event('change'));
                            setTimeout(() => {
                                clientFilter.value = clientCode;
                                clientFilter.dispatchEvent(new Event('change'));
                            }, 200);
                        }, 200);
                    }
                }
                delete window.state.preselectClientCode;
            }
            
            // Задержка чтобы пользователь увидел 100%
            setTimeout(() => {
                showSalesMainContent();
            }, 500);
            
        } catch (error) {
            console.error('❌ Помилка завантаження в помічнику продажу:', error);
            showSalesError(error.message || 'Невідома помилка');
        }
    }

    // --- НОВА функція для фільтра відділів ---
    function populateDepartmentFilter() {
        departmentFilter.innerHTML = '<option value="">Всі відділи</option>';
        let visibleDepartments = departments;
        // --- Контроль доступу: якщо менеджер або керівник, тільки свій відділ ---
        if (!userAccess.isAdmin && userAccess.departmentId) {
            if (userAccess.role && (userAccess.role.includes('менедж') || userAccess.role.includes('керівник'))) {
                visibleDepartments = departments.filter(dep => dep.id === userAccess.departmentId);
            }
        }
        visibleDepartments.forEach(dep => {
            const option = new Option(dep.name, dep.id);
            departmentFilter.add(option);
        });
        departmentFilter.disabled = false;
        // Якщо доступний лише один відділ — вибираємо його автоматично
        if (visibleDepartments.length === 1) {
            departmentFilter.value = visibleDepartments[0].id;
        }
    }

    // --- Оновлена функція для фільтра менеджерів ---
    function populateManagerFilter() {
        const selectedDepartmentId = departmentFilter.value;
        managerFilter.innerHTML = '<option value="">Оберіть менеджера...</option>';
        let filteredManagers = managers;
        // --- Додаю логування для діагностики ---
        console.log('[populateManagerFilter] userAccess:', userAccess);
        console.log('[populateManagerFilter] managers:', managers);
        // --- Контроль доступу: якщо менеджер — тільки він, якщо керівник — всі з відділу, якщо адмін — всі ---
        if (!userAccess.isAdmin && userAccess.employeeId) {
            if (userAccess.role && userAccess.role.includes('менедж')) {
                // Тільки сам користувач
                filteredManagers = managers.filter(emp => emp.id === userAccess.employeeId);
                console.log('[populateManagerFilter] Менеджер бачить тільки себе:', filteredManagers);
                
                // Если менеджер не найден в списке (возможно, это демо-данные), показываем всех
                if (filteredManagers.length === 0) {
                    console.log('[populateManagerFilter] Менеджер не найден в списке, показываем всех');
                    filteredManagers = managers;
                }
            } else if (userAccess.role && userAccess.role.includes('керівник')) {
                // Всі з його відділу
                filteredManagers = managers.filter(emp => {
                    if (!emp.department) return false;
                    if (typeof emp.department === 'object' && emp.department.id) {
                        return emp.department.id === userAccess.departmentId;
                    } else if (typeof emp.department === 'string') {
                        return emp.department === userAccess.departmentId;
                    }
                    return false;
                });
                console.log('[populateManagerFilter] Керівник бачить менеджерів відділу:', filteredManagers);
            } else {
                // fallback: всі
                console.log('[populateManagerFilter] Інша роль, всі менеджери');
            }
        } else if (selectedDepartmentId) {
            filteredManagers = managers.filter(emp => {
                if (!emp.department) return false;
                if (typeof emp.department === 'object' && emp.department.id) {
                    return emp.department.id === selectedDepartmentId;
                } else if (typeof emp.department === 'string') {
                    return emp.department === selectedDepartmentId;
                }
                return false;
            });
            console.log('[populateManagerFilter] Фільтр по відділу:', filteredManagers);
        } else {
            // Если пользователь не привязан к сотруднику, но имеет права sales_manage, показываем всех
            console.log('[populateManagerFilter] Пользователь не привязан к сотруднику, показываем всех менеджеров');
            filteredManagers = managers;
        }
        filteredManagers.forEach(emp => {
            const option = new Option(emp.name, emp.id);
            managerFilter.add(option);
        });
        managerFilter.disabled = false;
        clientSearch.disabled = true;
        clientFilter.disabled = true;
        clientFilter.innerHTML = '<option value="">Оберіть клієнта...</option>';
        // Якщо вибраний менеджер не входить у цей відділ — скидаємо вибір
        if (managerFilter.value && !filteredManagers.some(emp => emp.id === managerFilter.value)) {
            managerFilter.value = '';
        }
    }

    // --- Оновлена функція для фільтра клієнтів по співробітнику ---
    async function populateClientFilter(selectedManagerId, searchTerm = '') {
        const emp = employeesById[selectedManagerId];
        if (!emp) return;
        // --- Завантажуємо справочник ---
        const clientManagerDirectory = await loadClientManagerDirectory();
        // --- Фільтруємо клієнтів по справочнику та менеджеру ---
        const clients = Object.entries(clientManagerDirectory)
            .filter(([code, info]) => info.manager && emp.name && info.manager.trim() === emp.name.trim())
            .map(([code, info]) => ({
                name: info.name || code, // Берем название из справочника
                code,
                sphere: masterData.find(item => item['Клиент.Код'] === code)?.['Сфера деятельности'] || '',
                hasSales: masterData.some(item => item['Клиент.Код'] === code) // Проверяем есть ли продажи
            }));
        uniqueClientsByManager[selectedManagerId] = Array.from(new Map(clients.map(c => [c.code, c])).values()).sort((a, b) => a.name.localeCompare(b.name));
        const filteredClients = uniqueClientsByManager[selectedManagerId].filter(client =>
            client.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        clientFilter.innerHTML = '<option value="">Оберіть клієнта...</option>';
        filteredClients.forEach(client => {
            const optionText = `${client.name} (${client.sphere || 'Сфера не вказана'})`;
            const option = new Option(optionText, client.code);
            clientFilter.add(option);
        });
        clientFilter.disabled = false;
        clientSearch.disabled = false;
    }

    // --- Додаю обробник для departmentFilter ---
    departmentFilter.onchange = () => {
        populateManagerFilter();
        // Скидаємо вибір менеджера і клієнта
        managerFilter.value = '';
        clientFilter.value = '';
        clientSearch.value = '';
        clientSearch.disabled = true;
        clientFilter.disabled = true;
        resultsSection.classList.add('hidden');
    };

    function displayResults(segmentRecs, topSalesRecs, clientSales) {
        // --- KPI, прогноз, сегмент, динамика, все кнопки, модалки ---
        if (!clientKpiContainer || !segmentRecsList || !topSalesRecsList) return;
        const totalRevenue = clientSales.reduce((sum, s) => {
            const revenue = typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0);
            return sum + (revenue || 0);
        }, 0);
        const clientInfo = clientSales[0];
        const clientLink = clientLinks[clientInfo['Клиент.Код']];
        // Анализ по товарам
        const productStats = {};
        let allDates = [];
        clientSales.forEach(sale => {
            const product = sale['Номенклатура'];
            const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
            const date = new Date(sale['Дата']);
            allDates.push(date);
            if (!productStats[product]) productStats[product] = { sum: 0, count: 0, lastDate: date };
            productStats[product].sum += revenue;
            productStats[product].count += 1;
            if (date > productStats[product].lastDate) productStats[product].lastDate = date;
        });
        const productList = Object.entries(productStats)
            .map(([name, stat]) => ({ name, sum: stat.sum, count: stat.count, lastDate: stat.lastDate, share: stat.sum / totalRevenue }))
            .sort((a, b) => b.sum - a.sum);
        const avgCheck = clientSales.length > 0 ? totalRevenue / clientSales.length : 0;
        const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
        const monthAgo = new Date(maxDate); monthAgo.setMonth(monthAgo.getMonth() - 1);
        const stoppedProducts = productList.filter(p => p.lastDate < monthAgo);
        // Прогноз
        let forecastDate = '', forecastSum = avgCheck, avgIntervalDays = null;
        if (allDates.length > 1) {
            const uniqueDays = Array.from(new Set(allDates.map(d => d.toISOString().slice(0, 10)))).map(s => new Date(s)).sort((a, b) => a - b);
            if (uniqueDays.length > 1) {
                let sum = 0;
                for (let i = 1; i < uniqueDays.length; ++i) sum += (uniqueDays[i] - uniqueDays[i - 1]);
                avgIntervalDays = sum / (uniqueDays.length - 1) / (1000 * 60 * 60 * 24);
                const lastPurchase = uniqueDays[uniqueDays.length - 1];
                const nextDate = new Date(lastPurchase.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000);
                forecastDate = nextDate.toLocaleDateString('uk-UA');
            } else {
                const lastPurchase = uniqueDays[0];
                const nextDate = new Date(lastPurchase.getTime() + 30 * 24 * 60 * 60 * 1000);
                forecastDate = nextDate.toLocaleDateString('uk-UA');
                avgIntervalDays = 30;
            }
        } else if (allDates.length === 1) {
            const lastPurchase = allDates[0];
            const nextDate = new Date(lastPurchase.getTime() + 30 * 24 * 60 * 60 * 1000);
            forecastDate = nextDate.toLocaleDateString('uk-UA');
            avgIntervalDays = 30;
        }
        // Сегмент
        let segment = 'Новий';
        if (clientSales.length > 10 && totalRevenue > 100000) segment = 'VIP';
        else if (clientSales.length > 5 && totalRevenue > 30000) segment = 'Активний';
        else if (stoppedProducts.length > 0) segment = 'Знижується активність';
        if (stoppedProducts.length === productList.length && productList.length > 0) segment = 'Потенційно втрачається';
        // KPI-блок, прогноз, сегмент, кнопки
        const forecastDateObj = forecastDate ? new Date(forecastDate.split('.').reverse().join('-')) : null;
        const isForecastOverdue = forecastDateObj && forecastDateObj < new Date();
        // Календар динамики
        let calendarMap = {}, calendarSumMap = {};
        const daysByMonth = {};
        clientSales.forEach(sale => {
            const date = new Date(sale['Дата']);
            const ym = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
            const day = sale['Дата'].slice(0, 10);
            if (!calendarMap[ym]) calendarMap[ym] = 0;
            if (!calendarSumMap[ym]) calendarSumMap[ym] = 0;
            if (!daysByMonth[ym]) daysByMonth[ym] = new Set();
            daysByMonth[ym].add(day);
            const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
            calendarSumMap[ym] += revenue;
        });
        // Після збору — рахуємо унікальні дні
        Object.keys(daysByMonth).forEach(ym => {
            calendarMap[ym] = daysByMonth[ym].size;
        });
        let monthsSorted = Object.keys(calendarMap).sort();
        let prevCount = null, prevSum = null;
        let calendarTable = `<table class="min-w-full text-sm text-left"><thead><tr><th class="px-2 py-1">Місяць</th><th class="px-2 py-1">Кількість</th><th class="px-2 py-1">Динаміка</th><th class="px-2 py-1">Сума</th><th class="px-2 py-1">Динаміка</th></tr></thead><tbody>`;
        monthsSorted.forEach(m => {
            let trendCount = '-', trendSum = '-';
            if (prevCount !== null) {
                if (calendarMap[m] > prevCount) trendCount = '<span style="color:green">▲</span>';
                else if (calendarMap[m] < prevCount) trendCount = '<span style="color:red">▼</span>';
                else trendCount = '<span style="color:gray">●</span>';
            }
            if (prevSum !== null) {
                if (calendarSumMap[m] > prevSum) trendSum = '<span style="color:green">▲</span>';
                else if (calendarSumMap[m] < prevSum) trendSum = '<span style="color:red">▼</span>';
                else trendSum = '<span style="color:gray">●</span>';
            }
            calendarTable += `<tr><td class="px-2 py-1">${m}</td><td class="px-2 py-1">${calendarMap[m]}</td><td class="px-2 py-1">${trendCount}</td><td class="px-2 py-1">${calendarSumMap[m].toFixed(2)}</td><td class="px-2 py-1">${trendSum}</td></tr>`;
            prevCount = calendarMap[m]; prevSum = calendarSumMap[m];
        });
        calendarTable += '</tbody></table>';
        // Кнопки и модалки
        let buttonsRow = `<div class="mt-6 flex flex-wrap gap-4 justify-center items-center">`;
        if (clientLink) buttonsRow += `<a href="${clientLink}" target="_blank" class="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Перейти в CRM</a>`;
        buttonsRow += `<button id="show-missedModal" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition">Упущені продажі</button>`;
        buttonsRow += `<button id="show-similarModal" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Що беруть схожі клієнти</button>`;
        buttonsRow += `<button id="show-togetherModal" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition">Товари, які купують разом</button>`;
        buttonsRow += `<button id="show-calendarModal" class="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition">Календар покупок</button>`;
        // --- НОВА КНОПКА ---
        buttonsRow += `<button id="show-groupCoverageModal" class="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition">Покриття груп товарів</button>`;
        buttonsRow += `</div>`;
        // --- Модалки (адаптированы под scoped, без window) ---
        // Упущені продажі
        const missedModalId = 'missedModal';
        let missedProductsTable = `<div class="overflow-x-auto"><table class="min-w-full text-sm text-left"><thead><tr><th class="px-2 py-1">Товар</th><th class="px-2 py-1">Остання покупка</th><th class="px-2 py-1">Сума</th></tr></thead><tbody>`;
        missedProductsTable += stoppedProducts.map(p => `<tr><td class="px-2 py-1">${p.name}</td><td class="px-2 py-1">${p.lastDate.toLocaleDateString('uk-UA')}</td><td class="px-2 py-1">${p.sum.toFixed(2)}</td></tr>`).join('') + '</tbody></table></div>';
        let missedModalHtml = `<div id="${missedModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-xl w-full p-6 relative max-h-[60vh] flex flex-col"><button id="close-${missedModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4 text-red-400">Товари, які клієнт перестав брати (немає продажів за останній місяць)</h3><div class="overflow-y-auto" style="max-height: 40vh;">${missedProductsTable}</div></div></div>`;
        // Схожі клієнти
        const similarModalId = 'similarModal';
        const clientProductsSet = new Set(clientSales.map(item => item['Номенклатура']));
        const clientSphere = clientInfo['Сфера деятельности'];
        const sphereClients = masterData.filter(item => item['Сфера деятельности'] === clientSphere && item['Клиент.Код'] !== clientInfo['Клиент.Код']);
        const clientsByCode = {};
        sphereClients.forEach(item => {
            if (!clientsByCode[item['Клиент.Код']]) clientsByCode[item['Клиент.Код']] = new Set();
            clientsByCode[item['Клиент.Код']].add(item['Номенклатура']);
        });
        let similarClients = [];
        for (let code in clientsByCode) {
            const theirSet = clientsByCode[code];
            const intersection = new Set([...theirSet].filter(x => clientProductsSet.has(x)));
            if (intersection.size >= Math.max(1, Math.floor(clientProductsSet.size * 0.5))) {
                similarClients.push({ code, products: theirSet });
            }
        }
        let similarProducts = new Set();
        similarClients.forEach(cl => { cl.products.forEach(p => { if (!clientProductsSet.has(p)) similarProducts.add(p); }); });
        const similarProductsArr = [...similarProducts];
        const top10 = similarProductsArr.slice(0, 10);
        const top20 = similarProductsArr.slice(0, 20);
        const top50 = similarProductsArr.slice(0, 50);
        let similarModalHtml = `<div id="${similarModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-xl w-full p-6 relative max-h-[70vh] flex flex-col"><button id="close-${similarModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Що беруть схожі клієнти</h3><div class="mb-2 text-sm text-gray-400">Показані товари, які купують клієнти з тієї ж сфери, у яких співпадає хоча б 50% товарів з цим клієнтом, а цей клієнт їх не купував.</div><div><button type='button' class='font-bold text-blue-400 underline mb-1' onclick="this.nextElementSibling.classList.toggle('hidden')">Топ-10</button><div class='' style=''><ul class="list-disc list-inside text-gray-200">${top10.length > 0 ? top10.map(p => `<li>${p}</li>`).join('') : '<li>Немає таких товарів.</li>'}</ul></div><button type='button' class='font-bold text-blue-400 underline mb-1 mt-2' onclick="this.nextElementSibling.classList.toggle('hidden')">Топ-20</button><div class='hidden'><ul class="list-disc list-inside text-gray-200">${top20.length > 10 ? top20.slice(10).map(p => `<li>${p}</li>`).join('') : '<li>Немає таких товарів.</li>'}</ul></div><button type='button' class='font-bold text-blue-400 underline mb-1 mt-2' onclick="this.nextElementSibling.classList.toggle('hidden')">Топ-50</button><div class='hidden'><ul class="list-disc list-inside text-gray-200">${top50.length > 20 ? top50.slice(20).map(p => `<li>${p}</li>`).join('') : '<li>Немає таких товарів.</li>'}</ul></div></div></div></div>`;
        // Товари разом
        const togetherModalId = 'togetherModal';
        const salesByClientDate = {};
        masterData.forEach(sale => {
            const key = sale['Клиент.Код'] + '|' + sale['Дата'];
            if (!salesByClientDate[key]) salesByClientDate[key] = [];
            salesByClientDate[key].push(sale['Номенклатура']);
        });
        let togetherHtml = '', idx = 0;
        clientProductsSet.forEach(product => {
            const togetherCount = {};
            for (const key in salesByClientDate) {
                if (key.startsWith(clientInfo['Клиент.Код'] + '|')) continue;
                const products = salesByClientDate[key];
                if (products.includes(product)) {
                    products.forEach(p => { if (p !== product && !clientProductsSet.has(p)) togetherCount[p] = (togetherCount[p] || 0) + 1; });
                }
            }
            const togetherSorted = Object.entries(togetherCount).sort((a, b) => b[1] - a[1]);
            if (togetherSorted.length > 0) {
                idx++;
                const accId = `acc-together-${idx}`;
                togetherHtml += `<div class='mb-2'><button type='button' class='w-full text-left font-bold text-gray-200 bg-gray-800 rounded px-2 py-1 focus:outline-none' onclick="const el=this.parentNode.querySelector('div'); el.classList.toggle('hidden');">${product}</button><div class='hidden pl-4 pt-1'>${togetherSorted.map(([p, n]) => `${p} <span class='text-xs text-gray-400'>(${n})</span>`).join('<br>')}</div></div>`;
            }
        });
        let togetherExplanation = `<div class='mb-2 text-sm text-gray-400'>Для кожного вашого товару показані інші товари, які найчастіше купують разом із ним інші клієнти, але ви ще не купували.</div>`;
        let togetherModalHtml = `<div id="${togetherModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-xl w-full p-6 relative max-h-[60vh] flex flex-col"><button id="close-${togetherModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Товари, які купують разом</h3>${togetherExplanation}<div class="overflow-y-auto" style="max-height: 40vh;">${togetherHtml || '<div>Немає даних.</div>'}</div></div></div>`;
        // Календар
        const calendarModalId = 'calendarModal';
        let calendarModalHtml = `<div id="${calendarModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-6 relative"><button id="close-${calendarModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Календар покупок</h3><div class="overflow-y-auto" style="max-height: 40vh;">${calendarTable}</div></div></div>`;
        // --- Додаю модалку для "Покриття груп товарів" ---
        const groupCoverageModalId = 'groupCoverageModal';
        let groupCoverageModalHtml = `<div id="${groupCoverageModalId}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden"><div class="bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full p-6 relative max-h-[80vh] flex flex-col"><button id="close-${groupCoverageModalId}" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button><h3 class="text-lg font-bold mb-4">Покриття груп товарів (категорія 2)</h3><div id="group-coverage-content" class="text-gray-200">Аналітика по групах буде тут...</div></div></div>`;
        // Вставляем модалки в конец mainBlock
        let modalsContainer = mainBlock.querySelector('#modals-container');
        if (!modalsContainer) {
            modalsContainer = document.createElement('div');
            modalsContainer.id = 'modals-container';
            mainBlock.appendChild(modalsContainer);
        }
        modalsContainer.innerHTML = missedModalHtml + similarModalHtml + togetherModalHtml + calendarModalHtml + groupCoverageModalHtml;
        // Обработчики открытия/закрытия модалок
        setTimeout(() => {
            const modals = [missedModalId, similarModalId, togetherModalId, calendarModalId, groupCoverageModalId];
            modals.forEach(id => {
                const modal = mainBlock.querySelector(`#${id}`);
                const showBtn = mainBlock.querySelector(`#show-${id}`);
                const closeBtn = mainBlock.querySelector(`#close-${id}`);
                if (showBtn && modal) showBtn.onclick = () => { 
                    modal.classList.remove('hidden');
                    // --- Додаю логіку для наповнення модалки "Покриття груп товарів" ---
                    if (id === groupCoverageModalId) {
                        const contentDiv = modal.querySelector('#group-coverage-content');
                        contentDiv.innerHTML = '<div class="text-gray-400">Завантаження аналітики...</div>';
                        (async () => {
                            try {
                                // 1. Завантажити категоризацію товарів
                                const resp = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category');
                                const nomenclatureData = await resp.json();
                                // 2. Зібрати всі "Номенклатури" клієнта
                                const clientNomenclatures = new Set(clientSales.map(s => s['Номенклатура']));
                                // 3. Визначити сферу клієнта
                                const clientSphere = clientSales[0]?.['Сфера деятельности'] || clientSales[0]?.['Сфера'] || '';
                                // 4. Всі "Номенклатури" у цій сфері
                                const sphereNomenclatures = new Set(masterData.filter(s => (s['Сфера деятельности']||s['Сфера']) === clientSphere).map(s => s['Номенклатура']));
                                // 5. Мапа: номенклатура -> категорія 2
                                const nomenToGroup = {};
                                nomenclatureData.forEach(item => {
                                    if (item['Номенклатура'] && item['Категория 2']) nomenToGroup[item['Номенклатура']] = item['Категория 2'];
                                });
                                // 6. Всі групи у сфері
                                const allGroups = Array.from(sphereNomenclatures).map(n => nomenToGroup[n]).filter(Boolean);
                                const uniqueAllGroups = Array.from(new Set(allGroups)).sort();
                                // 7. Групи, які купує клієнт
                                const clientGroups = Array.from(clientNomenclatures).map(n => nomenToGroup[n]).filter(Boolean);
                                const uniqueClientGroups = Array.from(new Set(clientGroups)).sort();
                                // 8. Групи, які не купує
                                const notBoughtGroups = uniqueAllGroups.filter(g => !uniqueClientGroups.includes(g));
                                // 9. % покриття
                                const coveragePercent = uniqueAllGroups.length ? Math.round(uniqueClientGroups.length / uniqueAllGroups.length * 100) : 0;
                                // 10. Вивід у модалку
                                contentDiv.innerHTML = `
                                    <div class='mb-4'>
                                        <b>Клієнт:</b> ${clientInfo['Клиент'] || ''}<br>
                                        <b>Сфера діяльності:</b> ${clientSphere}<br>
                                        <b>Всього груп у сфері:</b> ${uniqueAllGroups.length}<br>
                                        <b>Груп купує:</b> ${uniqueClientGroups.length}<br>
                                        <b>Груп не купує:</b> ${notBoughtGroups.length}<br>
                                        <b>Покриття:</b> <span class='text-pink-400 font-bold'>${coveragePercent}%</span>
                                    </div>
                                    <div class='mb-2'><b>Групи, які купує:</b> <span class='text-green-400'>${uniqueClientGroups.join(', ') || '—'}</span></div>
                                    <div class='mb-4'><b>Групи, які не купує:</b> <span class='text-red-400'>${notBoughtGroups.join(', ') || '—'}</span></div>
                                    <button id='show-group-details-btn' class='px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 mb-4'>Показати деталі по групах</button>
                                `;
                                // --- Додаю окрему модалку для таблиці ---
                                let groupDetailsModal = document.getElementById('groupDetailsModal');
                                if (!groupDetailsModal) {
                                    groupDetailsModal = document.createElement('div');
                                    groupDetailsModal.id = 'groupDetailsModal';
                                    groupDetailsModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 hidden';
                                    groupDetailsModal.innerHTML = `
                                        <div class="bg-gray-900 rounded-lg shadow-lg max-w-3xl w-full p-6 relative max-h-[90vh] flex flex-col">
                                            <button id="close-groupDetailsModal" class="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-2xl">&times;</button>
                                            <h3 class="text-lg font-bold mb-4">Детальна таблиця по групах</h3>
                                            <div class='overflow-x-auto' style='max-height:65vh;overflow-y:auto;'>
                                                <table class='min-w-max text-xs text-left border border-gray-700'><thead><tr><th class='px-2 py-1 border-b border-gray-700'>Група</th><th class='px-2 py-1 border-b border-gray-700'>Купує?</th></tr></thead><tbody>
                                                    ${uniqueAllGroups.map(g => `<tr><td class='px-2 py-1 border-b border-gray-800'>${g}</td><td class='px-2 py-1 border-b border-gray-800'>${uniqueClientGroups.includes(g) ? '<span class="text-green-400">Так</span>' : '<span class="text-red-400">Ні</span>'}</td></tr>`).join('')}
                                                </tbody></table>
                                            </div>
                                        </div>
                                    `;
                                    document.body.appendChild(groupDetailsModal);
                                }
                                // --- Обробник кнопки ---
                                const showDetailsBtn = contentDiv.querySelector('#show-group-details-btn');
                                if (showDetailsBtn) {
                                    showDetailsBtn.onclick = () => {
                                        groupDetailsModal.classList.remove('hidden');
                                    };
                                }
                                // --- Закриття модалки ---
                                const closeDetailsBtn = groupDetailsModal.querySelector('#close-groupDetailsModal');
                                if (closeDetailsBtn) {
                                    closeDetailsBtn.onclick = () => {
                                        groupDetailsModal.classList.add('hidden');
                                    };
                                }
                                groupDetailsModal.onclick = (e) => { if (e.target === groupDetailsModal) groupDetailsModal.classList.add('hidden'); };
                            } catch (e) {
                                contentDiv.innerHTML = `<div class='text-red-400'>Помилка аналітики: ${e.message}</div>`;
                            }
                        })();
                    }
                };
                if (closeBtn && modal) closeBtn.onclick = () => { modal.classList.add('hidden'); };
                if (modal) modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            });
        }, 0);
        // KPI-блок
        clientKpiContainer.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-white">${clientInfo['Клиент']} <span class="text-lg font-normal text-gray-400">(${clientInfo['Сфера деятельности'] || clientInfo['Клиент.Сфера деятельность'] || ''})</span></h2>
                <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 text-center">
                    <div><p class="text-sm text-gray-400">Загальна виручка</p><p class="text-2xl font-bold text-green-400">${totalRevenue.toFixed(2)}</p>
                        <div class="text-xs text-gray-400 mt-1 ${isForecastOverdue ? 'bg-red-900 rounded px-2 py-1' : ''}">Прогноз: коли купить <b>${forecastDate}</b>, сума <b>${forecastSum.toFixed(2)}</b> <span class='text-gray-500'>(середній інтервал: ${avgIntervalDays ? avgIntervalDays.toFixed(1) : '-'} днів)</span></div>
                    </div>
                    <div><p class="text-sm text-gray-400">Кількість покупок</p><p class="text-2xl font-bold text-white">${new Set(clientSales.map(s => s['Дата'].slice(0, 10))).size}</p></div>
                    <div><p class="text-sm text-gray-400">Унікальних товарів</p><p class="text-2xl font-bold text-white">${productList.length}</p></div>
                    <div><p class="text-sm text-gray-400">Середній чек</p><p class="text-2xl font-bold text-blue-400">${avgCheck.toFixed(2)}</p></div>
                </div>
                <div class="mt-4 text-center"><span class="inline-block px-3 py-1 rounded bg-gray-900 text-gray-300 text-sm">Сегмент: <b>${segment}</b></span></div>
                ${buttonsRow}
                <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8" id="client-charts-block">
                  <div><canvas id="clientRevenueChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">Динаміка виручки по місяцях</div></div>
                  <div><canvas id="clientAvgCheckChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">Динаміка середнього чека</div></div>
                  <div><canvas id="clientCountChart" height="120"></canvas><div class="text-center text-xs text-gray-400 mt-2">Кількість покупок по місяцях</div></div>
                </div>
            </div>
            <!-- Модалки будут добавлены динамически -->
        `;
        // --- График истории сегмента ---
        (async () => {
          const companyId = window.state?.currentCompanyId;
          const clientCode = clientInfo['Клиент.Код'];
          if (!companyId || !clientCode) return;
          const segmentHistory = await loadClientSegmentHistory(companyId, clientCode);
          const months = Object.keys(segmentHistory).sort();
          if (months.length > 0) {
            // Маппинг сегментов в числа для графика
            const segmentMap = {
              'Новий': 1,
              'Втрачений новий': 1,
              'Знижується активність': 2,
              'Втрачений активний': 2,
              'Втрачений лояльний': 2,
              'Потенційно втрачається': 3,
              'Лояльний': 3,
              'Втрачений чемпіон': 3,
              'Чемпіон': 4,
              'Активний': 4,
              'VIP': 5,
              'Втрачений VIP': 4
            };
            const data = months.map(m => segmentMap[segmentHistory[m].segment] || 0);
            const labels = months;
            // Вставляем canvas
            let chartBlock = document.createElement('div');
            chartBlock.className = 'mt-8';
            chartBlock.innerHTML = `<div class='mb-2 text-gray-300 text-sm'>Динаміка сегмента клієнта</div><canvas id='segmentHistoryChart' height='80'></canvas>`;
            // --- Додаю кнопку для таблиці ---
            const tableBtn = document.createElement('button');
            tableBtn.textContent = 'Динаміка сегментів (таблиця)';
            tableBtn.className = 'ml-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm';
            chartBlock.appendChild(tableBtn);
            // --- Таблиця (спочатку прихована) ---
            const tableBlock = document.createElement('div');
            tableBlock.className = 'mt-4 hidden';
            chartBlock.appendChild(tableBlock);
            tableBtn.onclick = () => {
              if (tableBlock.classList.contains('hidden')) {
                // Побудова таблиці
                let html = `<div class='overflow-x-auto'><table class='min-w-max text-xs text-left border border-gray-700'><thead><tr><th class='px-2 py-1 border-b border-gray-700'>Місяць</th><th class='px-2 py-1 border-b border-gray-700'>Сфера</th><th class='px-2 py-1 border-b border-gray-700'>Сегмент</th><th class='px-2 py-1 border-b border-gray-700'>Recency</th><th class='px-2 py-1 border-b border-gray-700'>Frequency</th><th class='px-2 py-1 border-b border-gray-700'>Monetary</th></tr></thead><tbody>`;
                months.forEach(m => {
                  const seg = segmentHistory[m];
                  html += `<tr><td class='px-2 py-1 border-b border-gray-800'>${m}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.sphere || ''}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.segment}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.rfm?.recencyDays ?? ''}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.rfm?.frequency ?? ''}</td><td class='px-2 py-1 border-b border-gray-800'>${seg.rfm?.monetary ?? ''}</td></tr>`;
                });
                html += '</tbody></table></div>';
                tableBlock.innerHTML = html;
                tableBlock.classList.remove('hidden');
                tableBtn.textContent = 'Сховати таблицю';
              } else {
                tableBlock.classList.add('hidden');
                tableBtn.textContent = 'Динаміка сегментів (таблиця)';
              }
            };
            clientKpiContainer.appendChild(chartBlock);
            setTimeout(() => {
              new Chart(document.getElementById('segmentHistoryChart').getContext('2d'), {
                type: 'line',
                data: {
                  labels,
                  datasets: [{
                    label: 'Сегмент',
                    data,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167,139,250,0.2)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 4,
                    pointBackgroundColor: '#a78bfa'
                  }]
                },
                options: {
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: ctx => {
                          const val = ctx.raw;
                          return Object.keys(segmentMap).find(k => segmentMap[k] === val) || val;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      min: 1, max: 5, stepSize: 1,
                      ticks: {
                        callback: v => Object.keys(segmentMap).find(k => segmentMap[k] === v) || v,
                        color: '#a1a1aa'
                      }
                    },
                    x: { ticks: { color: '#a1a1aa' } }
                  }
                }
              });
            }, 0);
          }
        })();
        // Рендерим графики Chart.js
        setTimeout(() => {
            // Данные по месяцам
            const months = monthsSorted;
            const revenueData = months.map(m => calendarSumMap[m] || 0);
            const countData = months.map(m => calendarMap[m] || 0);
            const avgCheckData = months.map((m, i) => countData[i] ? revenueData[i]/countData[i] : 0);
            // График выручки
            new Chart(document.getElementById('clientRevenueChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{label:'Виручка',data:revenueData,borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.2)',fill:true}]
                },
                options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
            });
            // График среднего чека
            new Chart(document.getElementById('clientAvgCheckChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{label:'Середній чек',data:avgCheckData,borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.2)',fill:true}]
                },
                options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
            });
            // График количества покупок
            new Chart(document.getElementById('clientCountChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{label:'Кількість покупок',data:countData,backgroundColor:'rgba(251,191,36,0.7)'}]
                },
                options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
            });
        }, 0);
        // Рекомендации и топы
        segmentRecsList.innerHTML = segmentRecs.length > 0 ? segmentRecs.map(item => `<li>${item}</li>`).join('') : '<li>Немає рекомендацій.</li>';
        topSalesRecsList.innerHTML = topSalesRecs.length > 0 ? topSalesRecs.map(item => `<li>${item}</li>`).join('') : '<li>Немає рекомендацій.</li>';
        // ... (сюда добавить динамическое создание и обработку модалок, как в modules.js, но через mainBlock) ...
    }

    // Функция для отображения пустого дашборда клиентов без продаж
    function displayEmptyResults(clientCode, clientInfo) {
        if (!clientKpiContainer || !segmentRecsList || !topSalesRecsList) return;
        
        const clientLink = clientInfo.link;
        const clientName = clientInfo.name || clientCode;
        const sphereName = 'Невідома';
        
        // Заполняем название сферы
        if (clientSphereName) {
            clientSphereName.textContent = sphereName;
        }
        
        // KPI-блок для клиента без продаж
        clientKpiContainer.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-white">
                    ${clientLink ? `<a href="${clientLink}" target="_blank" class="text-blue-400 hover:text-blue-300">${clientName}</a>` : clientName} 
                    <span class="text-lg font-normal text-gray-400">(Клієнт без продаж)</span>
                </h2>
                <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 text-center">
                    <div><p class="text-sm text-gray-400">Загальна виручка</p><p class="text-2xl font-bold text-gray-500">0.00</p>
                        <div class="text-xs text-gray-400 mt-1">Продаж поки немає</div>
                    </div>
                    <div><p class="text-sm text-gray-400">Кількість покупок</p><p class="text-2xl font-bold text-gray-500">0</p></div>
                    <div><p class="text-sm text-gray-400">Унікальних товарів</p><p class="text-2xl font-bold text-gray-500">0</p></div>
                    <div><p class="text-sm text-gray-400">Середній чек</p><p class="text-2xl font-bold text-gray-500">0.00</p></div>
                </div>
                <div class="mt-4 text-center">
                    <span class="inline-block px-3 py-1 rounded bg-yellow-900 text-yellow-300 text-sm">
                        Сегмент: <b>Потенційний клієнт</b>
                    </span>
                </div>
                <div class="mt-6 text-center">
                    <div class="bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg p-4">
                        <h3 class="text-lg font-bold text-blue-300 mb-2">💡 Рекомендації</h3>
                        <p class="text-blue-200">Клієнт є у вашій базі, але поки не робив покупок.</p>
                        <p class="text-blue-200 mt-1">Рекомендуємо зв'язатися з клієнтом та запропонувати наші товари.</p>
                        ${clientLink ? `
                            <div class="mt-3">
                                <a href="${clientLink}" target="_blank" 
                                   class="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                    📋 Відкрити картку клієнта
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Рекомендации и топы для клиентов без продаж
        segmentRecsList.innerHTML = `
            <li>🎯 Зв'яжіться з клієнтом та дізнайтеся про його потреби</li>
            <li>📋 Запропонуйте найпопулярніші товари нашої компанії</li>
            <li>💬 Проведіть презентацію асортименту</li>
            <li>🎁 Розгляньте можливість спеціальної пропозиції для першої покупки</li>
        `;
        
        topSalesRecsList.innerHTML = `
            <li>📞 Телефонний дзвінок для знайомства</li>
            <li>📧 Відправка каталогу продукції</li>
            <li>🤝 Особиста зустріч з клієнтом</li>
            <li>💼 Презентація топових товарів компанії</li>
        `;
    }

    async function runAnalysis(selectedClientCode) {
        if (!selectedClientCode) {
            resultsSection.classList.add('hidden');
            return;
        }
        const clientSales = masterData.filter(item => item['Клиент.Код'] == selectedClientCode);
        
        // Если нет продаж - показываем пустой дашборд с информацией о клиенте
        if (clientSales.length === 0) {
            // Получаем информацию о клиенте из справочника
            const clientManagerDirectory = await loadClientManagerDirectory();
            const clientInfo = clientManagerDirectory[selectedClientCode];
            
            if (clientInfo) {
                // Показываем пустой дашборд с информацией что продаж нет
                displayEmptyResults(selectedClientCode, clientInfo);
                resultsSection.classList.remove('hidden');
            } else {
                alert('Клієнт не знайдений у справочнику.');
            }
            return;
        }
        
        const clientSphere = clientSales[0]['Сфера деятельности'];
        clientSphereName.textContent = clientSphere;
        const clientProducts = new Set(clientSales.map(item => item['Номенклатура']));
        const sphereData = masterData.filter(item => item['Сфера деятельности'] === clientSphere);
        const segmentProducts = new Set(sphereData
            .filter(item => item['Клиент.Код'] != selectedClientCode)
            .map(item => item['Номенклатура'])
        );
        const segmentRecommendations = [...segmentProducts].filter(product => !clientProducts.has(product));
        const productSalesInSphere = sphereData.reduce((acc, sale) => {
            const product = sale['Номенклатура'];
            acc[product] = (acc[product] || 0) + 1;
            return acc;
        }, {});
        const topProductsInSphere = Object.entries(productSalesInSphere)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([product]) => product);
        const topSalesRecommendations = topProductsInSphere.filter(product => !clientProducts.has(product));
        displayResults(segmentRecommendations, topSalesRecommendations, clientSales);
        resultsSection.classList.remove('hidden');
    }

    managerFilter.onchange = e => {
        const manager = e.target.value;
        if (!manager) {
            clientFilter.innerHTML = '<option value="">Оберіть клієнта...</option>';
            clientFilter.disabled = true;
            clientSearch.disabled = true;
            resultsSection.classList.add('hidden');
            return;
        }
        populateClientFilter(manager, clientSearch.value);
        resultsSection.classList.add('hidden');
    };
    // --- Автокомплит для поиска клиента ---
    // Добавляем контейнер для выпадающего списка
    let autocompleteList = document.createElement('div');
    autocompleteList.id = 'sales-client-autocomplete-list';
    autocompleteList.style.position = 'absolute';
    autocompleteList.style.zIndex = '100';
    autocompleteList.style.background = '#1f2937'; // bg-gray-800
    autocompleteList.style.color = '#fff';
    autocompleteList.style.width = '100%';
    autocompleteList.style.maxHeight = '220px';
    autocompleteList.style.overflowY = 'auto';
    autocompleteList.style.borderRadius = '0 0 0.5rem 0.5rem';
    autocompleteList.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    autocompleteList.style.display = 'none';
    clientSearch.parentNode.style.position = 'relative';
    clientSearch.parentNode.appendChild(autocompleteList);

    let filteredClientsCache = [];
    let autocompleteIndex = -1;

    function showAutocompleteList(clients) {
        autocompleteList.innerHTML = '';
        if (!clients.length) {
            autocompleteList.innerHTML = '<div class="px-4 py-2 text-gray-400">Нічого не знайдено</div>';
            autocompleteList.style.display = 'block';
            return;
        }
        clients.forEach((client, idx) => {
            const item = document.createElement('div');
            item.className = 'px-4 py-2 cursor-pointer hover:bg-indigo-700';
            item.textContent = `${client.name} (${client.sphere || 'Сфера не вказана'})`;
            item.dataset.code = client.code;
            if (idx === autocompleteIndex) item.classList.add('bg-indigo-800');
            item.onclick = async () => {
                clientFilter.value = client.code;
                await runAnalysis(client.code);
                autocompleteList.style.display = 'none';
            };
            autocompleteList.appendChild(item);
        });
        autocompleteList.style.display = 'block';
    }

    clientSearch.oninput = async e => {
        const manager = managerFilter.value;
        if (!manager) return;
        populateClientFilter(manager, clientSearch.value);
        // Для автокомплита:
        if (!uniqueClientsByManager[manager]) return;
        filteredClientsCache = uniqueClientsByManager[manager].filter(client =>
            client.name.toLowerCase().includes(clientSearch.value.toLowerCase())
        );
        autocompleteIndex = -1;
        showAutocompleteList(filteredClientsCache);
        // Автовыбор, если остался только один клиент
        if (filteredClientsCache.length === 1) {
            clientFilter.value = filteredClientsCache[0].code;
            await runAnalysis(filteredClientsCache[0].code);
            autocompleteList.style.display = 'none';
        }
    };
    // Навигация по списку клиентов стрелками и Enter
    clientSearch.addEventListener('keydown', async e => {
        if (autocompleteList.style.display !== 'block' || !filteredClientsCache.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            autocompleteIndex = (autocompleteIndex + 1) % filteredClientsCache.length;
            showAutocompleteList(filteredClientsCache);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            autocompleteIndex = (autocompleteIndex - 1 + filteredClientsCache.length) % filteredClientsCache.length;
            showAutocompleteList(filteredClientsCache);
        } else if (e.key === 'Enter') {
            if (autocompleteIndex >= 0 && autocompleteIndex < filteredClientsCache.length) {
                clientFilter.value = filteredClientsCache[autocompleteIndex].code;
                await runAnalysis(filteredClientsCache[autocompleteIndex].code);
                autocompleteList.style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            autocompleteList.style.display = 'none';
        }
    });
    // Скрывать список при потере фокуса
    clientSearch.addEventListener('blur', () => {
        setTimeout(() => autocompleteList.style.display = 'none', 150);
    });
    clientFilter.onchange = async e => {
        const clientCode = e.target.value;
        await runAnalysis(clientCode);
    };

    // Проверяем, выбрана ли компания перед загрузкой данных
    if (window.state?.currentCompanyId) {
        loadAndProcessData();
    } else {
        // Показываем сообщение о необходимости выбора компании
        const loadingContainer = mainBlock.querySelector('#sales-loading-container');
        if (loadingContainer) {
            loadingContainer.innerHTML = `
                <div class="text-center p-8">
                    <div class="text-yellow-500 mb-4">
                        <i class="fas fa-exclamation-triangle text-2xl"></i>
                    </div>
                    <p class="text-lg font-medium text-gray-200 mb-2">Компанія не вибрана</p>
                    <p class="text-sm text-gray-400">Будь ласка, спочатку виберіть компанію для роботи з помічником продажу</p>
                </div>
            `;
        }
        
        // Добавляем слушатель для перезагрузки данных, когда компания будет выбрана
        const checkCompanyInterval = setInterval(() => {
            if (window.state?.currentCompanyId) {
                clearInterval(checkCompanyInterval);
                loadAndProcessData();
            }
        }, 1000);
        
        // Очищаем интервал через 30 секунд, чтобы не тратить ресурсы
        setTimeout(() => {
            clearInterval(checkCompanyInterval);
        }, 30000);
    }
}

// === RFM-анализ и расчет сегментов ===
// --- Оновлена логіка сегментації (як у Node.js-скрипті) ---
function calculateRfmSegments(masterData) {
  // 1. Групуємо всі продажі по клієнту та сфері
  const byClientSphere = {};
  masterData.forEach(sale => {
    const code = sale['Клиент.Код'];
    const sphere = sale['Сфера діяльності'] || sale['Сфера деятельности'] || 'Інше';
    const date = new Date(sale['Дата']);
    if (!byClientSphere[code]) byClientSphere[code] = {};
    if (!byClientSphere[code][sphere]) byClientSphere[code][sphere] = [];
    byClientSphere[code][sphere].push({ ...sale, _date: date });
  });

  // 2. Для кожної сфери — збираємо масив клієнтів з ≥2 покупками для розрахунку топів
  const sphereStats = {};
  Object.entries(byClientSphere).forEach(([code, spheres]) => {
    Object.entries(spheres).forEach(([sphere, sales]) => {
      if (!sphereStats[sphere]) sphereStats[sphere] = [];
      if (sales.length >= 2) {
        const totalSum = sales.reduce((sum, s) => sum + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
        sphereStats[sphere].push({ code, frequency: sales.length, monetary: totalSum });
      }
    });
  });
  // 3. Для кожної сфери — визначаємо пороги топ-10% (VIP), 10-30% (Чемпіон)
  const sphereThresholds = {};
  Object.entries(sphereStats).forEach(([sphere, arr]) => {
    if (!arr.length) return;
    // Сортуємо за frequency та monetary
    const byF = [...arr].sort((a, b) => b.frequency - a.frequency);
    const byM = [...arr].sort((a, b) => b.monetary - a.monetary);
    const n = arr.length;
    const vipCount = Math.max(1, Math.floor(n * 0.1));
    const champCount = Math.max(1, Math.floor(n * 0.2));
    sphereThresholds[sphere] = {
      vipF: byF[vipCount - 1]?.frequency || 0,
      vipM: byM[vipCount - 1]?.monetary || 0,
      champF: byF[vipCount + champCount - 1]?.frequency || 0,
      champM: byM[vipCount + champCount - 1]?.monetary || 0,
    };
  });

  // 4. Формуємо сегменти по місяцях (історія)
  const segments = {};
  Object.entries(byClientSphere).forEach(([code, spheres]) => {
    segments[code] = {};
    Object.entries(spheres).forEach(([sphere, sales]) => {
      // Групуємо продажі по місяцях
      const byMonth = {};
      sales.forEach(sale => {
        const ym = sale._date.getFullYear() + '-' + String(sale._date.getMonth() + 1).padStart(2, '0');
        if (!byMonth[ym]) byMonth[ym] = [];
        byMonth[ym].push(sale);
      });
      // Для кожного місяця — визначаємо сегмент
      Object.entries(byMonth).forEach(([ym, monthSales]) => {
        // Всі продажі клієнта у цій сфері ДО і включно цього місяця
        const now = new Date(ym + '-15');
        const allSales = sales.filter(s => s._date <= now);
        const lastSale = allSales.reduce((max, s) => (!max || s._date > max._date) ? s : max, null);
        const firstSale = allSales.reduce((min, s) => (!min || s._date < min._date) ? s : min, null);
        const recencyDays = lastSale ? Math.floor((now - lastSale._date) / (1000*60*60*24)) : null;
        const frequency = allSales.length;
        const monetary = allSales.reduce((sum, s) => sum + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
        let segment = 'Новий';
        // 1. Новий/Втрачений новий
        if (frequency === 1) {
          const daysSince = lastSale ? Math.floor((now - lastSale._date) / (1000*60*60*24)) : null;
          if (daysSince !== null && daysSince < 31) segment = 'Новий';
          else segment = 'Втрачений новий';
        } else if (frequency >= 2) {
          // 2. VIP/Чемпіон/Лояльний/Втрачений ...
          const th = sphereThresholds[sphere] || {};
          const isVip = (frequency >= (th.vipF || Infinity)) || (monetary >= (th.vipM || Infinity));
          const isChamp = !isVip && ((frequency >= (th.champF || Infinity)) || (monetary >= (th.champM || Infinity)));
          const isLost = recencyDays !== null && recencyDays >= 61; // 2 місяці
          if (isVip) segment = isLost ? 'Втрачений VIP' : 'VIP';
          else if (isChamp) segment = isLost ? 'Втрачений чемпіон' : 'Чемпіон';
          else segment = isLost ? 'Втрачений лояльний' : 'Лояльний';
        }
        segments[code][ym] = { segment, rfm: { recencyDays, frequency, monetary }, sphere };
      });
    });
  });
  return segments;
}
// === Сохранение сегментов в Firestore ===
async function saveSegmentsToFirestore(segments, companyId) {
  if (!window.state || !window.state.currentCompanyId) {
    alert('Компания не выбрана!');
    return;
  }
  const perms = window.state.currentUserPermissions || {};
  if (!perms.sales_manage && !perms.isOwner) {
    alert('Недостаточно прав для расчёта сегментов!');
    return;
  }
  try {
    for (const [clientCode, months] of Object.entries(segments)) {
      await firebase.setDoc(
        firebase.doc(firebase.db, 'companies', companyId, 'clientSegments', clientCode),
        { months },
        { merge: true }
      );
    }
  } catch (error) {
    console.error('Ошибка сохранения сегментов:', error);
    alert('Ошибка сохранения сегментов: ' + (error.message || error));
    throw error;
  }
}

// === Загрузка истории сегментов из Firestore ===
async function loadClientSegmentHistory(companyId, clientCode) {
  try {
    const docRef = firebase.doc(firebase.db, 'companies', companyId, 'clientSegments', clientCode);
    const docSnap = await firebase.getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().months || {};
    }
  } catch (e) {
    console.error('Ошибка загрузки истории сегмента:', e);
  }
  return {};
} 

// Додаю глобальний доступ для alerts.js
if (typeof window !== 'undefined') {
  window.initSalesAssistantPage = initSalesAssistantPage;

  // --- Обробник для кнопки перерахунку сегментів ---
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('recalculateSegmentBtn');
    const container = document.getElementById('recalculateSegmentContainer');
    const loader = document.getElementById('recalculateSegmentLoader');
    if (!btn || !loader || !container) return;

    // Показати кнопку тільки для адмінів/власників
    // Це потрібно буде перевіряти після завантаження state
    setTimeout(() => {
        const perms = window.state?.currentUserPermissions || {};
        if (perms.isOwner || perms.sales_manage) {
            container.classList.remove('hidden');
        }
    }, 2000); // Затримка, щоб дочекатися завантаження прав

    let isLoading = false;
    btn.onclick = async () => {
      if (isLoading) return;
      isLoading = true;
      loader.classList.remove('hidden');
      btn.disabled = true;

      try {
        const [dataRes, dataJulyRes] = await Promise.all([
          fetch('модуль помічник продажу/data.json'),
          fetch('https://fastapi.lookfort.com/nomenclature.analysis')
        ]);
        const data = await dataRes.json();
        const dataJuly = await dataJulyRes.json();
        const masterData = data.concat(dataJuly);
        const segments = calculateRfmSegments(masterData);
        const companyId = window.state?.currentCompanyId;

        if (companyId) {
          await saveSegmentsToFirestore(segments, companyId);
          loader.classList.add('hidden'); // Ховаємо лоадер
          btn.textContent = 'Готово!'; // Тільки текст
        }
        
      } catch (e) {
        loader.classList.add('hidden'); // Ховаємо лоадер
        btn.textContent = 'Помилка!'; // Тільки текст
        alert('Помилка перерахунку: ' + (e.message || e));
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Перерахувати сегменти'; // Повертаємо текст
          btn.appendChild(loader); // Повертаємо лоадер
          isLoading = false;
        }, 2000);
      }
    };
  });
} 