// dashboard.js - Дашборд виконання планів з груповкою по відділах

// Імпортуємо функції з центрального хранилища стану
import { getState, updateState, setLoading, canPerformOperation, lockOperation, unlockOperation } from './state.js';

/**
 * Расчет прогноза на месяц на основе рабочих дней
 */
function calculateMonthForecast(currentFact, monthPlan) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    const currentDay = now.getDate();
    
    // Защита от некорректных данных
    if (typeof currentFact !== 'number' || isNaN(currentFact)) {
        currentFact = 0;
    }
    if (typeof monthPlan !== 'number' || isNaN(monthPlan)) {
        monthPlan = 0;
    }
    
    // Получаем общее количество дней в месяце
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Считаем рабочие дни (пн-пт) в месяце
    const workingDaysInMonth = getWorkingDaysInMonth(currentYear, currentMonth);
    
    // Считаем рабочие дни, которые уже прошли
    const workingDaysElapsed = getWorkingDaysElapsed(currentYear, currentMonth, currentDay);
    
    // Считаем оставшиеся рабочие дни
    const workingDaysRemaining = workingDaysInMonth - workingDaysElapsed;
    
    // Средний доход в день за прошедшие рабочие дни
    const avgDailyRevenue = workingDaysElapsed > 0 ? currentFact / workingDaysElapsed : 0;
    
    // Прогнозируемая общая сумма на конец месяца
    const projectedTotal = workingDaysElapsed > 0 ? 
        currentFact + (avgDailyRevenue * workingDaysRemaining) : 
        0;
    
    // Сколько нужно зарабатывать в день, чтобы достичь плана
    const remainingPlan = monthPlan - currentFact;
    const dailyRequired = workingDaysRemaining > 0 ? remainingPlan / workingDaysRemaining : 0;
    
    // Прогнозируемый процент выполнения плана
    const forecastPercent = monthPlan > 0 ? (projectedTotal / monthPlan * 100) : 0;
    
    return {
        projectedTotal: Math.max(projectedTotal, 0),
        forecastPercent: Math.max(forecastPercent, 0),
        dailyRequired: Math.max(dailyRequired, 0),
        avgDailyRevenue: avgDailyRevenue,
        workingDaysInMonth: workingDaysInMonth,
        workingDaysElapsed: workingDaysElapsed,
        workingDaysRemaining: workingDaysRemaining,
        daysElapsed: currentDay,
        daysInMonth: daysInMonth
    };
}

/**
 * Получить количество рабочих дней (пн-пт) в месяце
 */
function getWorkingDaysInMonth(year, month) {
    let workingDays = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay(); // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
        
        // Пн-Пт = 1-5
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            workingDays++;
        }
    }
    
    return workingDays;
}

/**
 * Получить количество рабочих дней, которые уже прошли в месяце
 */
function getWorkingDaysElapsed(year, month, currentDay) {
    let workingDaysElapsed = 0;
    
    for (let day = 1; day < currentDay; day++) { // < currentDay, не включая сегодня
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        
        // Пн-Пт = 1-5
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            workingDaysElapsed++;
        }
    }
    
    return workingDaysElapsed;
}

/**
 * Рендеринг дашборда з новою логікою
 */
export async function renderDashboardTab(container = null) {
    console.log('🎨 Рендеринг вкладки дашборда...');
    
    // Если контейнер не передан, ищем его
    if (!container) {
        container = document.getElementById('plan-fact-content');
        if (!container) {
            container = document.getElementById('plan-fact-container');
        }
        if (!container) {
            container = document.querySelector('[data-tab="dashboard"]');
        }
        if (!container) {
            container = document.querySelector('.dashboard-tab');
        }
        if (!container) {
            container = document.querySelector('[class*="dashboard"]');
        }
    }
    
    if (!container) {
        console.error('❌ Контейнер План-Факт не знайдено');
        console.log('🔍 Доступні контейнери:', {
            'plan-fact-content': !!document.getElementById('plan-fact-content'),
            'plan-fact-container': !!document.getElementById('plan-fact-container'),
            'data-tab=dashboard': !!document.querySelector('[data-tab="dashboard"]'),
            'class*="dashboard"': !!document.querySelector('[class*="dashboard"]')
        });
        return;
    }
    
    console.log('✅ Контейнер знайдено:', container.id || container.className);
    
    // Рендерим HTML дашборда
    container.innerHTML = `
        <div class="dashboard-tab">
            <div id="dashboard-loading" class="loading-container">
                <div class="loading-spinner"></div>
                <p>Завантаження даних...</p>
            </div>
            
            <div id="overall-stats" class="overall-stats" style="display: none;">
                <!-- Общая статистика будет здесь -->
            </div>
            
            <div id="departments-section" class="departments-section" style="display: none;">
                <!-- Результаты по отделам будут здесь -->
            </div>
            
            <div id="managers-section" class="managers-section" style="display: none;">
                <!-- Результаты по менеджерам будут здесь -->
            </div>
        </div>
    `;
    
    // Проверяем что элементы созданы
    const dashboardLoading = document.getElementById('dashboard-loading');
    const overallStats = document.getElementById('overall-stats');
    const departmentsSection = document.getElementById('departments-section');
    const managersSection = document.getElementById('managers-section');
    
    if (!dashboardLoading || !overallStats || !departmentsSection || !managersSection) {
        console.error('❌ Не всі елементи дашборда створені');
        return;
    }
    
    console.log('✅ Всі елементи дашборда створені');
    
    try {
        // Показываем анимацию загрузки
        console.log('⏳ Показуємо анимацію завантаження...');
        
        // Проверяем, есть ли уже сохраненные данные в состоянии
        const currentState = getState();
        let hasData = false;
        
        if (currentState.dashboardData && currentState.dashboardData.plans) {
            console.log('📊 Знайдено попередньо завантажені дані');
            hasData = true;
        }
        
        // Если данных нет, загружаем их блокирующим способом
        if (!hasData) {
            console.log('📊 Дані відсутні, завантажуємо блокуючим способом...');
            
            try {
                const { forceUpdate } = await import('./backgroundService.js');
                await forceUpdate();
                console.log('✅ Дані завантажено успішно');
            } catch (error) {
                console.error('❌ Помилка завантаження даних:', error);
                // Показываем ошибку пользователю
                container.innerHTML = `
                    <div class="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
                        <div class="text-red-400 text-6xl mb-4">⚠️</div>
                        <h2 class="text-xl font-bold text-red-400 mb-2">Помилка завантаження даних</h2>
                        <p class="text-sm text-gray-400 mb-6">${error.message}</p>
                        <button onclick="location.reload()" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            🔄 Спробувати ще раз
                        </button>
                    </div>
                `;
                return;
            }
        }
        
        // Инициализируем дашборд с загруженными данными
        await initializeDashboard();
        
        // Проверяем обновленное состояние после загрузки
        const updatedState = getState();
        if (updatedState.dashboardData && updatedState.dashboardData.plans) {
            console.log('📊 Відображаємо завантажені дані...');
            const { combinePlanData, renderDashboardData } = await import('./dashboard.js');
            const dashboardData = combinePlanData(
                updatedState.dashboardData.plans,
                updatedState.dashboardData.salesFacts,
                updatedState.dashboardData.focusFacts
            );
            await renderDashboardData(
                dashboardData,
                updatedState.currentFilters.month,
                updatedState.currentFilters.departmentId,
                updatedState.currentFilters.managerId
            );
            console.log('✅ Дані відображено успішно');
        }
        
        console.log('✅ Дашборд ініціалізовано');
        
    } catch (error) {
        console.error('❌ Помилка ініціалізації дашборда:', error);
        // Показываем ошибку пользователю
        container.innerHTML = `
            <div class="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
                <div class="text-red-400 text-6xl mb-4">⚠️</div>
                <h2 class="text-xl font-bold text-red-400 mb-2">Помилка ініціалізації</h2>
                <p class="text-sm text-gray-400 mb-6">${error.message}</p>
                <button onclick="location.reload()" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    🔄 Спробувати ще раз
                </button>
            </div>
        `;
    }
}

/**
 * Инициализация дашборда
 */
async function initializeDashboard() {
    const operationId = 'initializeDashboard';
    console.log('🚀 Ініціалізація дашборда...');
    
    try {
        // Проверяем, можно ли выполнить операцию
        if (!canPerformOperation(operationId)) {
            console.log('⚠️ Ініціалізація дашборда заблокована, чекаємо завершення іншої операції...');
            return;
        }
        
        // Блокируем выполнение других операций
        if (!lockOperation(operationId)) {
            console.log('⚠️ Неможливо заблокувати ініціалізацію дашборда');
            return;
        }
        
        // Проверяем состояние загрузки
        const currentState = getState();
        if (currentState.isLoading) {
            console.log('⚠️ Дашборд вже завантажується, пропускаємо повторну ініціалізацію');
            unlockOperation(operationId);
            return;
        }
        
        // Устанавливаем состояние загрузки
        setLoading(true);
        
        // Обновляем список менеджеров
        updateManagersForDashboard();
        
        // Предзагружаем данные продаж для улучшения производительности
        console.log('📊 Предзавантаження даних продажів...');
        await preloadSalesData();
        
        // Проверяем что данные загружены
        const stateAfterPreload = getState();
        console.log('📊 Дані після предзавантаження:', {
            apiSalesCacheLength: stateAfterPreload.apiSalesCache?.length || 0,
            planFactData: !!stateAfterPreload.planFactData
        });
        
        // Загружаем данные дашборда
        console.log('📊 Завантаження даних дашборда...');
        await updateDashboardData();
        
        // Проверяем финальное состояние
        const finalState = getState();
        console.log('📊 Фінальний стан після ініціалізації:', {
            isLoading: finalState.isLoading,
            plansCount: finalState.planFactData?.plans?.length || 0,
            employeesCount: finalState.planFactData?.employees?.length || 0
        });
        
        console.log('✅ Дашборд ініціалізовано');
    
    } catch (error) {
        console.error('❌ Помилка ініціалізації дашборда:', error);
        setLoading(false);
        hideLoadingState();
        showErrorState('Помилка ініціалізації дашборда');
    } finally {
        // Разблокируем операцию
        unlockOperation(operationId);
    }
}

/**
 * Предзагрузка данных продаж
 */
async function preloadSalesData() {
    try {
    
        
        const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const salesData = await response.json();
        
        if (!Array.isArray(salesData)) {
            throw new Error('API повернув невалідні дані (не масив)');
        }
        
        // Проверяем структуру данных
        if (salesData.length > 0) {
            const firstRecord = salesData[0];
            
            // Проверяем наличие необходимых полей
            const requiredFields = ["Основной менеджер", "Дата", "Номенклатура", "Выручка"];
            const missingFields = requiredFields.filter(field => !(field in firstRecord));
            
            if (missingFields.length > 0) {
                console.warn(`⚠️ Відсутні обов'язкові поля в API:`, missingFields);
            }
        }
        
        // Сохраняем в кэш
        updateState({ apiSalesCache: salesData });
        
        const state = getState();
        if (!state.planFactData) {
            updateState({ planFactData: {} });
        }
        
        // Сохраняем также в planFactData для совместимости
        updateState({ 
            planFactData: { 
                ...state.planFactData, 
                salesData: salesData 
            } 
        });
        

        
        return salesData;
        
    } catch (error) {
        console.error('❌ Помилка предзавантаження даних продажів:', error);
        console.warn('⚠️ Працюємо без попередньо завантажених даних з API');
        
        // Очищаем кэш при ошибке
        updateState({ apiSalesCache: [] });
        
        const state = getState();
        if (!state.planFactData) {
            updateState({ planFactData: {} });
        }
        updateState({ 
            planFactData: { 
                ...state.planFactData, 
                salesData: [] 
            } 
        });
        
        // Не блокируем инициализацию если предзагрузка не удалась
        return [];
    }
}

/**
 * Обновление данных дашборда
 */
window.updateDashboardData = async function() {
    const operationId = 'updateDashboardData';
    console.log('🔄 Оновлення даних дашборда...');
    
    try {
        // Проверяем, можно ли выполнить операцию
        if (!canPerformOperation(operationId)) {
            console.log('⚠️ Оновлення даних дашборда заблоковано, чекаємо завершення іншої операції...');
            return;
        }
        
        // Блокируем выполнение других операций
        if (!lockOperation(operationId)) {
            console.log('⚠️ Неможливо заблокувати оновлення даних дашборда');
            return;
        }
        
        // Проверяем текущее состояние
        const currentState = getState();
        console.log('📊 Поточний стан перед оновленням:', {
            isLoading: currentState.isLoading,
            plansCount: currentState.planFactData?.plans?.length || 0,
            apiSalesCacheLength: currentState.apiSalesCache?.length || 0
        });
        
        // Показываем загрузку
        showLoadingState();
        setLoading(true);
        
        // Проверяем и загружаем данные API если необходимо
        if (!currentState.apiSalesCache || currentState.apiSalesCache.length === 0) {
            console.log('🔄 Кеш API порожній, завантажуємо дані...');
            await preloadSalesData();
        } else {
            console.log(`📊 Використовуємо кеш API з ${currentState.apiSalesCache.length} записами`);
        }
        
        // Получаем фильтры
        const month = document.getElementById('dashboardMonth')?.value;
        const departmentId = document.getElementById('dashboardDepartment')?.value;
        const managerId = document.getElementById('dashboardManager')?.value;
        
        console.log('🔍 Фільтри:', { month, departmentId, managerId });
        
        // Загружаем планы
        const plans = await getActivePlansForDashboard(month, departmentId, managerId);
        console.log(`📋 Знайдено ${plans.length} активних планів`);
        
        // Загружаем факты продаж
        const salesFacts = await loadSalesFactsForPlans(plans);
        console.log(`💰 Завантажено факти продажів для ${salesFacts.length} планів`);
        
        // Рассчитываем фокусные задачи
        const focusFacts = await calculateFocusTasksFacts(plans);
        console.log(`🎯 Розраховано фокусні задачі для ${focusFacts.length} планів`);
        
        // Объединяем данные
        const dashboardData = combinePlanData(plans, salesFacts, focusFacts);
        console.log(`📊 Об'єднано дані для ${dashboardData.length} планів`);
        console.log('📋 Приклад об\'єднаних даних:', dashboardData[0]);
        
        // Рендерим дашборд и ЖДЕМ завершения
        console.log('🎨 Початок рендерингу дашборда...');
        
        // Рендерим общую статистику
        await renderOverallStats(dashboardData);
        console.log('✅ Загальна статистика відрендерена');
        
        // Рендерим результаты по отделам
        await renderDepartmentsResults(groupDataByDepartments(dashboardData));
        console.log('✅ Результати по відділах відрендерені');
        
        // Рендерим результаты по менеджерам
        console.log('👥 Рендеринг результатів по менеджерах...');
        await renderManagersResults(dashboardData, groupDataByDepartments(dashboardData));
        console.log('✅ Результати по менеджерах відрендерені');
        
        console.log('✅ Дані дашборда відрендерено');
        
        // Скрываем состояние загрузки только ПОСЛЕ полного отображения данных
        setLoading(false);
        hideLoadingState();
        
        // Проверяем финальное состояние
        const finalState = getState();
        console.log('📊 Фінальний стан після оновлення:', {
            isLoading: finalState.isLoading,
            dashboardDataLength: dashboardData.length
        });
        
        console.log('✅ Дані дашборда оновлено та відображено');
        
    } catch (error) {
        console.error('❌ Помилка оновлення даних дашборда:', error);
        setLoading(false);
        hideLoadingState();
        showErrorState('Помилка завантаження даних дашборда');
    } finally {
        // Разблокируем операцию
        unlockOperation(operationId);
    }
};

/**
 * Получение активных планов для дашборда
 */
async function getActivePlansForDashboard(month, departmentId, managerId) {
    // Преобразуем формат месяца из YYYY-MM в YYYYMM
    const monthKey = month ? month.replace('-', '') : new Date().toISOString().slice(0, 7).replace('-', '');
    
    console.log(`🔍 Загружаємо активні плани для місяця: ${month} (ключ: ${monthKey})`);
    
    const state = getState();
    const allPlans = state.planFactData?.plans || [];
    console.log(`📋 Всього планів в системі: ${allPlans.length}`);
    
    const validPlans = [];
    
    for (let i = 0; i < allPlans.length; i++) {
        const plan = allPlans[i];
        
        // Проверяем подходит ли план
        if (plan.status === 'active' && plan.monthKey === monthKey) {
            // Обогащаем план данными сотрудника и отдела
            const enrichedPlan = await enrichPlanWithEmployeeData(plan);
            
            if (enrichedPlan) {
                validPlans.push(enrichedPlan);
            }
        }
    }
    
    console.log(`📋 Знайдено ${validPlans.length} підходящих планів після фільтрації`);
    
    return validPlans;
}

/**
 * Предварительная группировка продаж по менеджерам для оптимизации
 */
function groupSalesByManagers(salesData) {
    console.log('🚀 Групування продажів по менеджерах для оптимізації...');
    
    const groupedSales = {};
    
    salesData.forEach(sale => {
        const managerName = sale["Основной менеджер"] || sale.manager_name || sale.employee_name;
        if (!managerName) return;
        
        if (!groupedSales[managerName]) {
            groupedSales[managerName] = [];
        }
        groupedSales[managerName].push(sale);
    });
    
    console.log(`✅ Згруповано продажі для ${Object.keys(groupedSales).length} менеджерів`);
    
    return groupedSales;
}

/**
 * Загрузка фактов продаж для планов согласно номенклатуре шаблона (ОПТИМИЗИРОВАНА ВЕРСИЯ)
 */
async function loadSalesFactsForPlans(plans) {
    console.log(`💰 Загружаємо факти продажів для ${plans.length} планів (оптимізована версія)...`);
    
    if (plans.length === 0) {
        console.log('⚠️ Немає планів для завантаження фактів');
        return [];
    }
    
    try {
        // Проверяем предзагруженные данные
        const state = getState();
        let salesData = state.apiSalesCache || [];
    
    if (!salesData || salesData.length === 0) {
        console.log('🔄 Предзавантажені дані відсутні, завантажуємо з API...');
            salesData = await fetchSalesDataForPeriod();
            console.log(`📊 Завантажено ${salesData.length} записів з API`);
    } else {
            console.log(`📊 Використовуємо кеш API з ${salesData.length} записами`);
    }
    
        // Группируем продажи по менеджерам для оптимизации
    const groupedSales = groupSalesByManagers(salesData);
    
        // Рассчитываем факты для каждого плана
        const salesFacts = [];
        
        for (let i = 0; i < plans.length; i++) {
            const plan = plans[i];
            console.log(`💼 Обробляємо план для ${plan.employeeName} (${plan.employeeId})`);
            console.log(`📊 Структура плану:`, {
                id: plan.id,
                employeeName: plan.employeeName,
                salesPlan: plan.salesPlan,
                templateId: plan.templateId
            });
            
            console.log(`🔍 ПОЧАТОК ОБРОБКИ ПЛАНУ #${i + 1} з ${plans.length}`);
            
            try {
            // Получаем шаблон плана
                let template = state.planFactData?.templates?.find(t => t.id === plan.templateId);
                
                // Если не найден в templates, ищем в planTemplates
            if (!template) {
                    template = state.planFactData?.planTemplates?.find(t => t.id === plan.templateId);
                }
                
                // Проверяем настройки номенклатуры в шаблоне
                const nomenclatureFilter = template?.nomenclatureFilter;
                
                // Рассчитываем факты продаж
                const salesFact = calculateSalesFactFromGroupedData(
                    groupedSales[plan.employeeName] || [],
                    plan,
                    nomenclatureFilter
                );
                
                // Получаем правильное значение плана
                const planValue = typeof plan.salesPlan === 'object' ? 
                    (plan.salesPlan?.revenue?.plan || plan.salesPlan?.plan || 0) : 
                    (plan.salesPlan || 0);
                
                salesFacts.push({
                    planId: plan.id,
                    employeeId: plan.employeeId,
                    fact: salesFact.fact,
                    plan: planValue,
                    progress: salesFact.progress,
                    nomenclatureFilter: nomenclatureFilter
                });
                
                console.log(`✅ Факт для ${plan.employeeName}: ${salesFact.fact} грн (план: ${planValue} грн)`);
            
        } catch (error) {
            console.error(`❌ Помилка обробки плану ${plan.id}:`, error);
        }
    }
    
    console.log(`✅ Завершено обробку фактів продажів для ${salesFacts.length} планів`);
    return salesFacts;
        
    } catch (error) {
        console.error('❌ Помилка завантаження фактів продажів:', error);
        return [];
    }
}

/**
 * Расчет факта продаж из сгруппированных данных
 */
function calculateSalesFactFromGroupedData(managerSales, plan, nomenclatureFilter) {
        if (!managerSales || managerSales.length === 0) {
        return { fact: 0, plan: plan.salesPlan || 0, progress: 0 };
        }
        
    // Фильтруем продажи по месяцу
    const monthKey = plan.monthKey;
    const monthYear = monthKey.substring(0, 4);
        const month = monthKey.substring(4, 6);
        
    const filteredSales = managerSales.filter(sale => {
        const saleDate = new Date(sale['Дата']);
        const saleMonth = saleDate.getFullYear().toString() + 
                         (saleDate.getMonth() + 1).toString().padStart(2, '0');
        return saleMonth === monthKey;
    });
    
    if (filteredSales.length === 0) {
        return { fact: 0, plan: plan.salesPlan || 0, progress: 0 };
    }
    
    // Применяем фильтр номенклатуры если есть
    let finalSales = filteredSales;
        if (nomenclatureFilter && nomenclatureFilter.items && nomenclatureFilter.items.length > 0) {
        finalSales = filterDataByNomenclature(filteredSales, [], nomenclatureFilter);
    }
    
    if (finalSales.length === 0) {
        console.log('⚠️ Немає продажів після застосування фільтрів');
        return { fact: 0, plan: plan.salesPlan || 0, progress: 0 };
    }
    
    // Рассчитываем общую выручку
    const totalRevenue = finalSales.reduce((sum, sale) => {
        // Пробуем разные варианты названий поля выручки
        const revenue = parseFloat(sale['Сума']) || 
                       parseFloat(sale['Выручка']) || 
                       parseFloat(sale['revenue']) || 
                       parseFloat(sale['total']) || 
                       parseFloat(sale['amount']) || 
                       parseFloat(sale['sum']) || 0;
        
            return sum + revenue;
        }, 0);
        
    console.log(`💡 Приклади знайдених записів:`, finalSales.slice(0, 3));
        console.log(`💰 Розрахована виручка: ${totalRevenue} грн`);
    
    const planValue = plan.salesPlan || 0;
    const progress = planValue > 0 ? (totalRevenue / planValue * 100) : 0;
    
    return {
        fact: totalRevenue,
        plan: planValue,
        progress: progress
    };
}

/**
 * Расчет фактов фокусных задач
 */
async function calculateFocusTasksFacts(plans) {
    const focusFacts = [];
    
    for (const plan of plans) {
        const planFocusFacts = [];
        
        if (plan.focusTasks && plan.focusTasks.length > 0) {
            for (const focusTask of plan.focusTasks) {
                try {
                    // Получаем тип фокусной задачи
                    const state = getState();
                    const focusType = state.planFactData?.focusTypes?.find(ft => ft.id === focusTask.focusTypeId);
                    if (!focusType) {
                        console.warn(`⚠️ Тип фокусної задачі не знайдено: ${focusTask.focusTypeId}`);
                        continue;
                    }
                    
                    console.log(`�� Обробляємо фокусну задачу: ${focusType.name}, метод: ${focusType.calculationMethod}`);
                    
                    let fact = 0;
                    
                    // Проверяем метод расчета
                    const calculationMethod = focusType.calculationMethod || 'manual';
                    
                    if (calculationMethod === 'manual') {
                        // Ручной ввод - берем из сохраненного значения или 0
                        fact = focusTask.fact || 0;
                        console.log(`✋ Ручний ввід: ${fact}`);
                    } else {
                        // Автоматический расчет по формуле с API
                        console.log(`🤖 Автоматичний розрахунок за методом: ${calculationMethod}`);
                        fact = await calculateFocusTaskFactFromAPI(plan.employeeId, plan.monthKey, focusType);
                    }
                    
                    planFocusFacts.push({
                        focusTypeId: focusTask.focusTypeId,
                        focusTypeName: focusType.name,
                        calculationMethod: calculationMethod,
                        plan: focusTask.plan || 0,
                        fact: fact
                    });
                    
                } catch (error) {
                    console.error(`❌ Помилка розрахунку фокусної задачі ${focusTask.focusTypeId}:`, error);
                }
            }
        }
        
        focusFacts.push({
            planId: plan.id,
            employeeId: plan.employeeId,
            focusTasks: planFocusFacts
        });
    }
    
    return focusFacts;
}

// === ЭКСПОРТЫ ДЛЯ BACKGROUNDSERVICE ===
export { 
    getActivePlansForDashboard, 
    loadSalesFactsForPlans, 
    calculateFocusTasksFacts,
    renderDashboardData,
    combinePlanData
};

/**
 * Полная очистка данных План-Факт для перестройки
 */
window.clearAllPlanFactData = async function() {
    if (!window.hasPermission?.('planfact_delete_all_plans')) {
        alert('У вас немає прав для видалення всіх даних План-Факт');
        return;
    }
    
    const confirmation = prompt('⚠️ УВАГА! Це видалить ВСІ дані План-Факт!\n\nВведіть "ВИДАЛИТИ ВСЕ" для підтвердження:');
    if (confirmation !== 'ВИДАЛИТИ ВСЕ') {
        alert('Операцію скасовано');
        return;
    }
    
    try {
        console.log('🗑️ Початок повної очистки даних План-Факт...');
        
        const companyId = window.state.currentCompanyId;
        const batch = firebase.writeBatch(firebase.db);
        
        // Счетчики для отчета
        let deletedCounts = {
            plans: 0,
            templates: 0,
            focusTypes: 0,
            goals: 0
        };
        
        const state = getState();
        
        // 1. Удаляем все планы
        if (state.planFactData?.plans) {
            for (const plan of state.planFactData.plans) {
                const planRef = firebase.doc(firebase.db, 'companies', companyId, 'plans', plan.id);
                batch.delete(planRef);
                deletedCounts.plans++;
            }
        }
        
        // 2. Удаляем все шаблоны планов
        if (state.planFactData?.templates) {
            for (const template of state.planFactData.templates) {
                const templateRef = firebase.doc(firebase.db, 'companies', companyId, 'planTemplates', template.id);
                batch.delete(templateRef);
                deletedCounts.templates++;
            }
        }
        
        // 3. Удаляем все типы фокусных задач
        if (state.planFactData?.focusTypes) {
            for (const focusType of state.planFactData.focusTypes) {
                const focusRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTypes', focusType.id);
                batch.delete(focusRef);
                deletedCounts.focusTypes++;
            }
        }
        
        // 4. Удаляем все недельные цели
        if (state.planFactData?.goals) {
            for (const goal of state.planFactData.goals) {
                const goalRef = firebase.doc(firebase.db, 'companies', companyId, 'weeklyGoals', goal.id);
                batch.delete(goalRef);
                deletedCounts.goals++;
            }
        }
        
        // Выполняем batch-операцию
        await batch.commit();
        
        // Очищаем локальные данные
        updateState({
            planFactData: {
                plans: [],
                templates: [],
                focusTypes: [],
                goals: [],
                employees: state.planFactData?.employees || [],
                departments: state.planFactData?.departments || []
            }
        });
        
        // Очищаем состояние
        const { updateState, clearApiCache } = await import('./state.js');
        clearApiCache();
        updateState({
            currentTab: 'constructor',
            isLoading: false
        });
        
        // Перезагружаем интерфейс
        const currentTab = document.querySelector('.plan-fact-tab.active')?.dataset?.tab || 'constructor';
        if (currentTab === 'constructor') {
            const { renderConstructorTab } = await import('./constructor.js');
            renderConstructorTab();
        } else if (currentTab === 'dashboard') {
            renderDashboardTab();
        }
        
        console.log('✅ Повна очистка завершена:', deletedCounts);
        alert(`✅ Успішно видалено:
• Планів: ${deletedCounts.plans}
• Шаблонів: ${deletedCounts.templates}  
• Типів фокусів: ${deletedCounts.focusTypes}
• Цілей: ${deletedCounts.goals}

Тепер можна створювати нову структуру з нуля!`);
        
    } catch (error) {
        console.error('❌ Помилка очистки даних:', error);
        alert(`❌ Помилка очистки даних: ${error.message}`);
    }
};

/**
 * Расчет факта фокусной задачи с API
 */
async function calculateFocusTaskFactFromAPI(employeeId, monthKey, focusType) {
    try {
        console.log(`🎯 Розрахунок фокусної задачі ${focusType.name} для співробітника ${employeeId}`);
        
        // Поскольку у нас нет отдельного API для фокусных задач, используем fallback расчет
        return calculateFocusTaskFallback(employeeId, monthKey, focusType);
        
    } catch (error) {
        console.error('❌ Помилка розрахунку фокусної задачі з API:', error);
        
        // Fallback - простой расчет на основе имеющихся данных
        return calculateFocusTaskFallback(employeeId, monthKey, focusType);
    }
}

/**
 * Fallback расчет фокусной задачи
 */
function calculateFocusTaskFallback(employeeId, monthKey, focusType) {
    try {
        console.log(`🔄 Fallback розрахунок для ${focusType.name}, метод: ${focusType.calculationMethod}`);
        
        // Получаем имя сотрудника
        const state = getState();
        const employee = state.planFactData?.employees?.find(emp => emp.id === employeeId);
        const employeeName = employee?.name;
        
        if (!employeeName) {
            console.warn(`⚠️ Ім'я співробітника не знайдено для fallback: ${employeeId}`);
            return 0;
        }
        
        const year = monthKey.substring(0, 4);
        const month = monthKey.substring(4, 6);
        
        // Ищем данные продаж для расчета
        let salesData = state.planFactData?.salesData || [];
        
        // Если данных нет, пробуем использовать данные из API если они были загружены
        if (salesData.length === 0 && state.apiSalesCache) {
            salesData = state.apiSalesCache;
        }
        
        // Фильтруем данные по менеджеру и месяцу
        const employeeSales = salesData.filter(sale => {
            // Проверяем менеджера
            const saleManager = sale["Основной менеджер"] || sale.manager_name || sale.employee_name;
            if (saleManager !== employeeName) {
                return false;
            }
            
            // Проверяем дату
            const saleDate = sale["Дата"] || sale.date;
            if (saleDate) {
                const date = new Date(saleDate);
                const saleYear = date.getFullYear().toString();
                const saleMonth = (date.getMonth() + 1).toString().padStart(2, '0');
                
                if (saleYear !== year || saleMonth !== month) {
                    return false;
                }
            }
            
            return true;
        });
        
        console.log(`📊 Знайдено ${employeeSales.length} записів продажів для fallback розрахунку`);
        
        const calculationMethod = focusType.calculationMethod || 'manual';
        
        switch (calculationMethod) {
            case 'clients_count':
            case 'клиенты_количество':
                // Количество уникальных клиентов
                const uniqueClients = new Set();
                employeeSales.forEach(sale => {
                    const clientCode = sale["Клиент.Код"] || sale.client_code || sale.client_id;
                    const clientName = sale["Клиент"] || sale.client_name;
                    
                    if (clientCode) {
                        uniqueClients.add(clientCode);
                    } else if (clientName) {
                        uniqueClients.add(clientName);
                    }
                });
                
                console.log(`👥 Унікальних клієнтів: ${uniqueClients.size}`);
                return uniqueClients.size;
                
            case 'orders_count':
            case 'заказы_количество':
                // Количество заказов (записей продаж)
                console.log(`📋 Кількість замовлень: ${employeeSales.length}`);
                return employeeSales.length;
                
            case 'average_check':
            case 'средний_чек':
                // Средний чек
                if (employeeSales.length === 0) {
                    console.log(`💰 Середній чек: 0 (немає замовлень)`);
                    return 0;
                }
                
                const totalRevenue = employeeSales.reduce((sum, sale) => {
                    const revenue = parseFloat(sale["Выручка"]) || parseFloat(sale.revenue) || parseFloat(sale.total) || 0;
                    return sum + revenue;
                }, 0);
                
                const averageCheck = totalRevenue / employeeSales.length;
                console.log(`💰 Середній чек: ${averageCheck.toFixed(2)} грн`);
                return Math.round(averageCheck);
                
            case 'total_revenue':
            case 'общая_выручка':
                // Общая выручка
                const revenue = employeeSales.reduce((sum, sale) => {
                    const saleRevenue = parseFloat(sale["Выручка"]) || parseFloat(sale.revenue) || parseFloat(sale.total) || 0;
                    return sum + saleRevenue;
                }, 0);
                
                console.log(`💰 Загальна виручка: ${revenue} грн`);
                return revenue;
                
            case 'unique_products':
            case 'уникальные_товары':
                // Количество уникальных товаров
                const uniqueProducts = new Set();
                employeeSales.forEach(sale => {
                    const productName = sale["Номенклатура"] || sale.product_name || sale.nomenclature;
                    if (productName) {
                        uniqueProducts.add(productName);
                    }
                });
                
                console.log(`📦 Унікальних товарів: ${uniqueProducts.size}`);
                return uniqueProducts.size;
                
            case 'manual':
            default:
                // Ручной ввод или неизвестный метод
                console.log(`✋ Ручний ввід або невідомий метод: ${calculationMethod}`);
                return 0;
        }
    } catch (error) {
        console.error('❌ Помилка fallback розрахунку фокусної задачі:', error);
        return 0;
    }
}

/**
 * Объединение данных планов, фактов продаж и фокусных задач
 */
function combinePlanData(plans, salesFacts, focusFacts) {
    return plans.map(plan => {
        const salesFact = salesFacts.find(sf => sf.planId === plan.id) || { fact: 0, plan: 0 };
        const focusFact = focusFacts.find(ff => ff.planId === plan.id) || { focusTasks: [] };
        
        return {
            ...plan,
            // Сохраняем данные для отображения в карточках менеджеров
            monthPlan: plan.revenuePlan || plan.monthPlan || salesFact.plan || 0,
            monthFact: salesFact.fact || 0,
            // Сохраняем также для совместимости
            salesFact: salesFact.fact,
            salesPlan: salesFact.plan,
            salesProgress: salesFact.plan > 0 ? (salesFact.fact / salesFact.plan * 100) : 0,
            focusTasksData: focusFact.focusTasks
        };
    });
}

/**
 * Рендеринг данных дашборда
 */
async function renderDashboardData(dashboardData, month, departmentId, managerId) {
    console.log('🎨 Рендеринг даних дашборда...');
    console.log('📊 Вхідні дані:', {
        dashboardDataLength: dashboardData?.length || 0,
        month,
        departmentId,
        managerId
    });
    
    try {
        // Проверяем что данные есть
        if (!dashboardData || dashboardData.length === 0) {
            console.warn('⚠️ Немає даних для рендерингу дашборда');
            return;
        }
        
        console.log(`📊 Рендеримо ${dashboardData.length} планів`);
        console.log('📋 Приклад даних:', dashboardData[0]);
    
    // Группируем данные по отделам
    const departmentGroups = groupDataByDepartments(dashboardData);
        console.log('🏢 Групи відділів:', Object.keys(departmentGroups));
        
        // Проверяем HTML элементы
            const loadingElement = document.getElementById('dashboard-loading');
            const overallStats = document.getElementById('overall-stats');
            const departmentsSection = document.getElementById('departments-section');
            const managersSection = document.getElementById('managers-section');
            
        console.log('🔍 HTML елементи:', {
            loadingElement: !!loadingElement,
            overallStats: !!overallStats,
            departmentsSection: !!departmentsSection,
            managersSection: !!managersSection
        });
        
        // Рендерим общую статистику
        console.log('📊 Рендеринг загальної статистики...');
        renderOverallStats(dashboardData);
        
        // Рендерим результаты по отделам
        console.log('🏢 Рендеринг результатів по відділах...');
        renderDepartmentsResults(departmentGroups);
        
        // Рендерим результаты по менеджерам
        console.log('👥 Рендеринг результатів по менеджерах...');
        renderManagersResults(dashboardData, departmentGroups);
        
        console.log('✅ Дані дашборда відрендерено');
        
        // Скрываем анимацию загрузки после завершения рендеринга
            if (loadingElement) {
                loadingElement.style.display = 'none';
            console.log('✅ Анимація завантаження скрита');
        } else {
            console.warn('⚠️ Елемент завантаження не знайдено');
            }
            
        // Показываем контент
            if (overallStats) {
                overallStats.style.display = 'grid';
            console.log('✅ Загальна статистика показана');
        } else {
            console.warn('⚠️ Елемент загальної статистики не знайдено');
            }
            
            if (departmentsSection) {
                departmentsSection.style.display = 'block';
            console.log('✅ Секція відділів показана');
        } else {
            console.warn('⚠️ Секція відділів не знайдена');
            }
            
            if (managersSection) {
                managersSection.style.display = 'block';
            console.log('✅ Секція менеджерів показана');
        } else {
            console.warn('⚠️ Секція менеджерів не знайдена');
        }
        
        console.log('✅ Контент дашборда показано');
        
        // Обновляем состояние
        const currentState = getState();
        updateState({
            lastUpdate: new Date(),
            currentFilters: {
                month: month || currentState.currentFilters.month,
                departmentId: departmentId || currentState.currentFilters.departmentId,
                managerId: managerId || currentState.currentFilters.managerId
            }
        });
        
        console.log('✅ Стан оновлено');
        
    } catch (error) {
        console.error('❌ Помилка рендерингу даних дашборда:', error);
        throw error;
    }
}

/**
 * Группировка данных по отделам
 */
function groupDataByDepartments(dashboardData) {
    const groups = {};
    
    dashboardData.forEach(plan => {
        const deptId = plan.departmentId;
        if (!groups[deptId]) {
            groups[deptId] = {
                department: plan.department,
                plans: [],
                totalSalesPlan: 0,
                totalSalesFact: 0,
                managersCount: 0
            };
        }
        
        groups[deptId].plans.push(plan);
        groups[deptId].totalSalesPlan += plan.salesPlan || 0;
        groups[deptId].totalSalesFact += plan.salesFact || 0;
    });
    
    // Подсчитываем количество менеджеров в каждом отделе
    Object.keys(groups).forEach(deptId => {
        groups[deptId].managersCount = new Set(groups[deptId].plans.map(p => p.employeeId)).size;
        groups[deptId].progressPercent = groups[deptId].totalSalesPlan > 0 ? 
            (groups[deptId].totalSalesFact / groups[deptId].totalSalesPlan * 100) : 0;
    });
    
    return groups;
}

/**
 * Показ состояния загрузки
 */
function showLoadingState() {
    console.log('🔄 Показ стану завантаження дашборду...');
    
    // Не показываем дублирующую анимацию, так как она уже есть в renderDashboardTab
    // Просто логируем состояние
    console.log('📊 Анимація завантаження вже відображається');
}

/**
 * Скрытие состояния загрузки
 */
function hideLoadingState() {
    console.log('🔄 Завершення анимації завантаження дашборду...');
    
    // Очищаем контейнеры загрузки
    const containers = ['overall-stats', 'departments-results', 'managers-results'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container && container.innerHTML.includes('animate-spin')) {
            container.innerHTML = '';
        }
    });
    
    // Импортируем функцию управления состоянием и завершаем загрузку
    import('./state.js').then(({ setLoading }) => {
        setLoading(false);
        console.log('✅ Анимація завантаження дашборду завершена');
    }).catch(error => {
        console.warn('⚠️ Не вдалося імпортувати setLoading:', error);
        // Альтернативный способ завершения загрузки
        if (window.planFactState && window.planFactState.setLoading) {
            window.planFactState.setLoading(false);
        }
    });
}

/**
 * Показ состояния ошибки
 */
function showErrorState(message) {
    const containers = ['overall-stats', 'departments-results', 'managers-results'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-400">
                    <div class="text-4xl mb-4">⚠️</div>
                    <p>${message}</p>
                    <button onclick="updateDashboardData()" 
                            class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                        Спробувати знову
                    </button>
                </div>
            `;
        }
    });
}

/**
 * Обновление списка менеджеров для фильтра
 */
function updateManagersForDashboard() {
    const departmentSelect = document.getElementById('dashboardDepartment');
    const managerSelect = document.getElementById('dashboardManager');
    
    if (!departmentSelect || !managerSelect) return;
    
    const selectedDepartmentId = departmentSelect.value;
    
    const state = getState();
    // Фильтруем сотрудников по выбранному отделу
    let employees = state.planFactData?.employees || [];
    if (selectedDepartmentId) {
        employees = employees.filter(emp => 
            emp.departmentId === selectedDepartmentId ||
            emp.department === selectedDepartmentId ||
            (emp.department && emp.department.id === selectedDepartmentId)
        );
    }
    
    // Обновляем список менеджеров
    managerSelect.innerHTML = '<option value="">Всі менеджери</option>' +
        employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
}

// Обработчик изменения отдела
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'dashboardDepartment') {
        updateManagersForDashboard();
    }
});

/**
 * Глобальные функции для доступа из HTML
 */
window.refreshDashboardData = function() {
    console.log('🔄 Ручне оновлення дашборда з очищенням кешу...');
    
    // Очищаем кэш API для принудительной перезагрузки
    updateState({ apiSalesCache: [] });
    const state = getState();
    if (state.planFactData) {
        updateState({ 
            planFactData: { 
                ...state.planFactData, 
                salesData: [] 
            } 
        });
    }
    
    console.log('🧹 Кеш API очищено, виконуємо перезавантаження...');
    updateDashboardData();
};

window.updateDashboard = function() {
    console.log('🔄 Оновлення дашборда через фільтри...');
    updateDashboardData();
};

window.exportDashboardData = function() {
    // TODO: Реализовать экспорт данных
    console.log('📊 Експорт даних дашборда...');
    alert('Експорт даних буде реалізовано в наступній версії');
};

window.toggleManagersView = function() {
    // TODO: Реализовать переключение вида
    console.log('🔄 Перемикання виду дашборда...');
    alert('Перемикання виду буде реалізовано в наступній версії');
};

/**
 * Проверка совместимости номенклатуры
 */
window.checkNomenclatureCompatibility = function() {
    console.log('🔍 Перевірка сумісності номенклатури...');
    
    const state = getState();
    const plans = state.planFactData?.plans || [];
    const salesData = state.apiSalesCache || [];
    
    if (salesData.length === 0) {
        console.warn('❌ Немає даних продажів для аналізу');
        return;
    }
    
    plans.forEach(plan => {
        console.log(`\n📊 Аналіз плану: ${plan.employeeName}`);
        
        const template = state.planFactData?.planTemplates?.find(t => t.id === plan.templateId);
        if (!template) {
            console.log(`❌ Шаблон не знайдено`);
            return;
        }
        
        console.log(`📋 Шаблон: ${template.name}`);
        
        // Получаем продажи менеджера
        const managerSales = salesData.filter(sale => {
            const saleManager = sale["Основной менеджер"] || sale.manager_name || sale.employee_name;
            return saleManager === plan.employeeName;
        });
        
        console.log(`👤 Продажі менеджера: ${managerSales.length} записів`);
        
        // Уникальная номенклатура в продажах менеджера
        const uniqueNomenclature = [...new Set(managerSales.map(sale => 
            sale["Номенклатура"] || sale.nomenclature || sale.product_name
        ))].filter(name => name);
        
        console.log(`📦 Унікальна номенклатура в продажах (перші 10):`, uniqueNomenclature.slice(0, 10));
        
        // Проверяем номенклатуру в шаблоне
        if (template.nomenclatureFilters && template.nomenclatureFilters.items) {
            console.log(`🎯 Номенклатура в шаблоні (${template.nomenclatureFilters.items.length} позицій):`, 
                template.nomenclatureFilters.items.slice(0, 10));
            
            // Проверяем совпадения
            const matches = uniqueNomenclature.filter(nom => 
                template.nomenclatureFilters.items.some(filterItem => 
                    nom.toLowerCase().includes(filterItem.toLowerCase())
                )
            );
            
            console.log(`✅ Збіги номенклатури: ${matches.length} з ${uniqueNomenclature.length}`);
            if (matches.length > 0) {
                console.log(`📋 Приклади збігів:`, matches.slice(0, 5));
            }
            
            if (matches.length === 0) {
                console.warn(`⚠️ НЕМАЄ ЗБІГІВ! Номенклатура в продажах не відповідає фільтрам шаблону`);
            }
        } else {
            console.log(`ℹ️ Номенклатура в шаблоні не налаштована`);
        }
    });
};

/**
 * Детальная диагностика планов
 */
window.checkPlansDetails = function() {
    console.log('🔍 Детальна перевірка планів...');
    
    const state = getState();
    const plans = state.planFactData?.plans || [];
    console.log(`📋 Загальна кількість планів: ${plans.length}`);
    
    plans.forEach((plan, index) => {
        console.log(`\n📊 ПЛАН #${index + 1}:`);
        console.log(`👤 Співробітник: ${plan.employeeName}`);
        console.log(`🆔 ID плану: ${plan.id}`);
        console.log(`📅 Місяць: ${plan.monthKey}`);
        console.log(`🎯 ID шаблону: ${plan.templateId}`);
        console.log(`💰 План продажів:`, plan.salesPlan);
        console.log(`📈 Статус: ${plan.status}`);
        
        // Проверяем шаблон
        const template = state.planFactData?.planTemplates?.find(t => t.id === plan.templateId);
        if (template) {
            console.log(`✅ Шаблон знайдено: ${template.name}`);
            console.log(`📦 Номенклатура в шаблоні:`, template.nomenclatureFilters);
        } else {
            console.log(`❌ Шаблон НЕ знайдено!`);
        }
        
        // Проверяем есть ли менеджер в API
        if (state.apiSalesCache && state.apiSalesCache.length > 0) {
            const managerInAPI = state.apiSalesCache.some(sale => 
                sale["Основной менеджер"] === plan.employeeName
            );
            console.log(`🔍 Менеджер в API: ${managerInAPI ? '✅ Знайдено' : '❌ НЕ знайдено'}`);
        }
    });
    
    console.log('\n📋 Доступні шаблони планів:');
    (state.planFactData?.planTemplates || []).forEach(template => {
        console.log(`  🎯 ${template.id}: ${template.name}`);
    });
};

/**
 * Тестовая функция для проверки расчета фактов
 */
window.testFactCalculation = function() {
    console.log('🧪 Тестування розрахунку фактів продажів...');
    
    const state = getState();
    
    // Проверяем кэш API
    console.log('📊 Кеш API:', {
        hasCache: !!state.apiSalesCache,
        cacheSize: state.apiSalesCache?.length || 0
    });
    
    // Проверяем планы
    const plans = state.planFactData?.plans || [];
    console.log('📋 Доступні плани:', {
        plansCount: plans.length,
        activePlans: plans.filter(p => p.status === 'active').length
    });
    
    if (plans.length > 0) {
        const firstPlan = plans[0];
        console.log('💡 Приклад плану:', {
            id: firstPlan.id,
            employeeName: firstPlan.employeeName,
            monthKey: firstPlan.monthKey,
            salesPlan: firstPlan.salesPlan,
            templateId: firstPlan.templateId
        });
        
        // Проверяем шаблон
        const template = state.planFactData?.planTemplates?.find(t => t.id === firstPlan.templateId);
        if (template) {
            console.log('📋 Шаблон плану:', {
                name: template.name,
                nomenclatureFilters: template.nomenclatureFilters
            });
        } else {
            console.warn('⚠️ Шаблон не знайдено для плану');
        }
    }
    
    // Проверяем менеджеров в API данных
    if (state.apiSalesCache && state.apiSalesCache.length > 0) {
        const uniqueManagers = [...new Set(state.apiSalesCache.map(sale => 
            sale["Основной менеджер"]
        ))].filter(name => name);
        
        console.log('👥 Менеджери в API (перші 10):', uniqueManagers.slice(0, 10));
        
        if (plans.length > 0) {
            const planEmployeeNames = plans.map(p => p.employeeName).filter(name => name);
            console.log('👤 Імена співробітників в планах:', planEmployeeNames);
            
            // Проверяем совпадения
            const matches = planEmployeeNames.filter(name => uniqueManagers.includes(name));
            console.log('✅ Збіги імен:', matches);
            
            const noMatches = planEmployeeNames.filter(name => !uniqueManagers.includes(name));
            if (noMatches.length > 0) {
                console.warn('⚠️ Імена без збігів:', noMatches);
            }
        }
    }
};

/**
 * Рендеринг общей статистики
 */
function renderOverallStats(dashboardData) {
    const container = document.getElementById('overall-stats');
    if (!container) return;
    
    // Подсчитываем общую статистику
    const totalPlans = dashboardData.length;
    const totalSalesPlan = dashboardData.reduce((sum, plan) => sum + (plan.salesPlan || 0), 0);
    const totalSalesFact = dashboardData.reduce((sum, plan) => sum + (plan.salesFact || 0), 0);
    const overallProgress = totalSalesPlan > 0 ? (totalSalesFact / totalSalesPlan * 100) : 0;
    
    // Подсчитываем выполненные фокусные задачи
    let totalFocusTasks = 0;
    let completedFocusTasks = 0;
    
    dashboardData.forEach(plan => {
        if (plan.focusTasksData) {
            plan.focusTasksData.forEach(task => {
                totalFocusTasks++;
                if (task.fact >= task.plan) {
                    completedFocusTasks++;
                }
            });
        }
    });
    
    const focusProgress = totalFocusTasks > 0 ? (completedFocusTasks / totalFocusTasks * 100) : 0;
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
                <h4 class="text-sm font-medium text-blue-100 mb-2">Загальна кількість планів</h4>
                <p class="text-3xl font-bold">${totalPlans}</p>
                <p class="text-xs text-blue-200 mt-1">активних планів</p>
            </div>
            
            <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-white">
                <h4 class="text-sm font-medium text-green-100 mb-2">План продажів</h4>
                <p class="text-3xl font-bold">${formatCurrency(totalSalesPlan)}</p>
                <p class="text-xs text-green-200 mt-1">загальний план</p>
            </div>
            
            <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-white">
                <h4 class="text-sm font-medium text-purple-100 mb-2">Факт продажів</h4>
                <p class="text-3xl font-bold">${formatCurrency(totalSalesFact)}</p>
                <p class="text-xs text-purple-200 mt-1">${overallProgress.toFixed(1)}% виконання</p>
            </div>
            
            ${(() => {
                const overallForecast = calculateMonthForecast(totalSalesFact, totalSalesPlan);
                return `
                    <div class="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg p-6 text-white">
                        <h4 class="text-sm font-medium text-indigo-100 mb-2">Прогноз місяця</h4>
                        <p class="text-3xl font-bold">${formatCurrency(overallForecast.projectedTotal)}</p>
                        <p class="text-xs text-indigo-200 mt-1">${overallForecast.forecastPercent.toFixed(1)}% від плану</p>
                    </div>
                    
                    <div class="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
                        <h4 class="text-sm font-medium text-teal-100 mb-2">Потрібно щодня</h4>
                        <p class="text-3xl font-bold">${formatCurrency(overallForecast.dailyRequired)}</p>
                        <p class="text-xs text-teal-200 mt-1">${overallForecast.workingDaysRemaining} роб. днів</p>
                    </div>
                `;
            })()}
            
            <div class="bg-gradient-to-r from-orange-600 to-orange-700 rounded-lg p-6 text-white">
                <h4 class="text-sm font-medium text-orange-100 mb-2">Фокусні задачі</h4>
                <p class="text-3xl font-bold">${completedFocusTasks}/${totalFocusTasks}</p>
                <p class="text-xs text-orange-200 mt-1">${focusProgress.toFixed(1)}% виконано</p>
            </div>
        </div>
    `;
}

/**
 * Рендеринг результатов по отделам
 */
function renderDepartmentsResults(departmentGroups) {
    console.log('🏢 Початок рендерингу результатів по відділах...');
    
    // Проверяем существование секции отделов
    let departmentsSection = document.getElementById('departments-section');
    
    // Если секция не существует, создаем её
    if (!departmentsSection) {
        console.log('🔧 Секція відділів не знайдена, створюємо...');
        
        // Ищем контейнер дашборда
        const dashboardContainer = document.querySelector('.dashboard-tab') || 
                                 document.getElementById('plan-fact-content') ||
                                 document.querySelector('[class*="dashboard"]');
        
        if (dashboardContainer) {
            // Создаем секцию отделов
            const newDepartmentsSection = document.createElement('div');
            newDepartmentsSection.id = 'departments-section';
            newDepartmentsSection.className = 'departments-section';
            newDepartmentsSection.style.display = 'none';
            
            // Добавляем в контейнер дашборда
            dashboardContainer.appendChild(newDepartmentsSection);
            departmentsSection = newDepartmentsSection;
            
            console.log('✅ Секція відділів створена');
        } else {
            console.error('❌ Не вдалося знайти контейнер дашборда для створення секції відділів');
            return;
        }
    }
    
    // Создаем HTML структуру для секции отделов
    departmentsSection.innerHTML = `
        <div class="bg-gray-800 rounded-xl">
            <div class="px-6 py-4 border-b border-gray-700">
                <h3 class="text-xl font-bold text-white">🏢 Результати виконання по відділах</h3>
            </div>
            <div id="departments-results" class="p-6">
                <!-- Результаты по отделам будут здесь -->
            </div>
        </div>
    `;
    
    // Получаем обновленный элемент departments-results
    const container = document.getElementById('departments-results');
    if (!container) {
        console.error('❌ Елемент departments-results не знайдено після створення');
        return;
    }
    
    const departments = Object.values(departmentGroups);
    
    if (departments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <div class="text-4xl mb-4">🏢</div>
                <p class="text-lg">Немає даних по відділах</p>
                <p class="text-sm">Перевірте фільтри або створіть плани</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            ${departments.map(dept => `
                <div class="bg-gray-700 rounded-lg p-6 border border-gray-600 hover:bg-gray-600 transition-colors">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h4 class="text-xl font-bold text-white">${dept.department.name}</h4>
                            <p class="text-sm text-gray-400">${dept.managersCount} менеджерів • ${dept.plans.length} планів</p>
                        </div>
                        <div class="text-right">
                            <span class="px-3 py-1 rounded-full text-sm font-medium ${
                                dept.progressPercent >= 100 ? 'bg-green-600 text-white' :
                                dept.progressPercent >= 80 ? 'bg-yellow-600 text-white' :
                                'bg-red-600 text-white'
                            }">
                                ${dept.progressPercent.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    
                    <!-- Прогресс бар -->
                    <div class="mb-4">
                        <div class="flex justify-between text-sm text-gray-400 mb-1">
                            <span>Прогрес виконання</span>
                            <span>${formatCurrency(dept.totalSalesFact)} / ${formatCurrency(dept.totalSalesPlan)}</span>
                        </div>
                        <div class="w-full bg-gray-600 rounded-full h-3">
                            <div class="h-3 rounded-full transition-all duration-300 ${
                                dept.progressPercent >= 100 ? 'bg-green-500' :
                                dept.progressPercent >= 80 ? 'bg-yellow-500' :
                                'bg-red-500'
                            }" style="width: ${Math.min(dept.progressPercent, 100)}%"></div>
                        </div>
                    </div>
                    
                    <!-- Статистика -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="text-center p-3 bg-gray-600 rounded">
                            <div class="text-lg font-bold text-green-400">${formatCurrency(dept.totalSalesPlan)}</div>
                            <div class="text-xs text-gray-400">План</div>
                        </div>
                        <div class="text-center p-3 bg-gray-600 rounded">
                            <div class="text-lg font-bold text-blue-400">${formatCurrency(dept.totalSalesFact)}</div>
                            <div class="text-xs text-gray-400">Факт</div>
                        </div>
                    </div>
                    
                    <!-- Кнопка деталей -->
                    <button onclick="showDepartmentDetails('${dept.department.id}')" 
                            class="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                        👥 Детальніше по менеджерах
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    console.log('✅ Результати по відділах відрендерено');
}

/**
 * Рендеринг результатов по менеджерам
 */
function renderManagersResults(dashboardData, departmentGroups) {
    console.log('👥 Початок рендерингу карток менеджерів...');
    
    // Проверяем существование секции менеджеров
    let managersSection = document.getElementById('managers-section');
    
    // Если секция не существует, создаем её
    if (!managersSection) {
        console.log('🔧 Секція менеджерів не знайдена, створюємо...');
        
        // Ищем контейнер дашборда
        const dashboardContainer = document.querySelector('.dashboard-tab') || 
                                 document.getElementById('plan-fact-content') ||
                                 document.querySelector('[class*="dashboard"]');
        
        if (dashboardContainer) {
            // Создаем секцию менеджеров
            const newManagersSection = document.createElement('div');
            newManagersSection.id = 'managers-section';
            newManagersSection.className = 'managers-section';
            newManagersSection.style.display = 'none';
            
            // Добавляем в контейнер дашборда
            dashboardContainer.appendChild(newManagersSection);
            managersSection = newManagersSection;
            
            console.log('✅ Секція менеджерів створена');
        } else {
            console.error('❌ Не вдалося знайти контейнер дашборда для створення секції менеджерів');
            return;
        }
    }
    
    // Создаем HTML структуру для секции менеджеров
    managersSection.innerHTML = `
        <div class="bg-gray-800 rounded-xl">
            <div class="px-6 py-4 border-b border-gray-700">
                <h3 class="text-xl font-bold text-white">👥 Результати виконання по менеджерах</h3>
            </div>
            <div id="managers-results" class="p-6">
                <!-- Результаты по менеджерам будут здесь -->
            </div>
        </div>
    `;
    
    // Получаем обновленный элемент managers-results
    const updatedManagersResults = document.getElementById('managers-results');
    if (!updatedManagersResults) {
        console.error('❌ Елемент managers-results не знайдено після створення');
        return;
    }
    
    console.log(`📊 Дані для рендерингу: ${dashboardData.length} планів`);
    
    if (!dashboardData || dashboardData.length === 0) {
        console.warn('⚠️ Немає даних для відображення карток менеджерів');
        updatedManagersResults.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>Немає даних для відображення</p>
            </div>
        `;
        return;
    }
    
    // Группируем данные по отделам для отображения
    const managersByDepartment = {};
    
    dashboardData.forEach(plan => {
        console.log(`🔍 План менеджера ${plan.employeeName}:`, {
            monthPlan: plan.monthPlan,
            monthFact: plan.monthFact,
            salesPlan: plan.salesPlan,
            salesFact: plan.salesFact,
            revenuePlan: plan.revenuePlan
        });
        
        const departmentName = plan.departmentName || 'Без відділу';
        if (!managersByDepartment[departmentName]) {
            managersByDepartment[departmentName] = [];
        }
        managersByDepartment[departmentName].push(plan);
    });
    
    console.log('🏢 Групи менеджерів по відділах:', Object.keys(managersByDepartment));
    
    // Рендерим данные по отделам
    let managersHTML = '';
    
    Object.entries(managersByDepartment).forEach(([departmentName, plans]) => {
        console.log(`🏢 Рендеримо відділ "${departmentName}" з ${plans.length} менеджерами`);
        
        managersHTML += `
            <div class="mb-6">
                <h4 class="text-lg font-semibold text-white mb-4">${departmentName}</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        `;
        
        plans.forEach(plan => {
            const progressPercent = plan.monthPlan > 0 ? (plan.monthFact / plan.monthPlan * 100) : 0;
            const progressColor = progressPercent >= 100 ? 'bg-green-500' : 
                                progressPercent >= 80 ? 'bg-yellow-500' : 'bg-red-500';
            
            console.log(`👤 Рендеримо картку менеджера ${plan.employeeName}: план=${plan.monthPlan}, факт=${plan.monthFact}, прогрес=${progressPercent.toFixed(1)}%`);
            
            managersHTML += `
                <div class="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h5 class="font-medium text-white">${plan.employeeName}</h5>
                            <p class="text-sm text-gray-400">${plan.departmentName || 'Без відділу'}</p>
                        </div>
                        <span class="text-xs text-gray-400">${plan.monthKey}</span>
                    </div>
                    
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-400">План:</span>
                            <span class="text-white">${formatCurrency(plan.monthPlan)}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-400">Факт:</span>
                            <span class="text-white">${formatCurrency(plan.monthFact)}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-400">Прогрес:</span>
                            <span class="text-white font-medium">${progressPercent.toFixed(1)}%</span>
                        </div>
                    </div>
                    
                    <!-- Прогресс-бар -->
                    <div class="mt-3">
                        <div class="bg-gray-600 rounded-full h-2">
                            <div class="${progressColor} h-2 rounded-full transition-all duration-300" 
                                 style="width: ${Math.min(progressPercent, 100)}%"></div>
                        </div>
                    </div>
                    
                    <!-- Фокусные задачи -->
                    ${plan.focusTasks && plan.focusTasks.length > 0 ? `
                        <div class="mt-4 pt-3 border-t border-gray-600">
                            <h6 class="text-xs font-medium text-gray-400 mb-2">Фокусні задачі:</h6>
                            <div class="space-y-1">
                                ${plan.focusTasks.map(task => `
                                    <div class="flex justify-between text-xs">
                                        <span class="text-gray-400">${task.focusTypeName}:</span>
                                        <span class="text-white">${task.fact || 0} / ${task.plan || 0} ${task.focusUnit}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        managersHTML += `
                </div>
            </div>
        `;
    });
    
    // Вставляем HTML
    updatedManagersResults.innerHTML = managersHTML;
    
    console.log('✅ Картки менеджерів відрендерено');
}

/**
 * Показ деталей отдела
 */
window.showDepartmentDetails = function(departmentId) {
    // Устанавливаем фильтр по отделу и обновляем
    const departmentSelect = document.getElementById('dashboardDepartment');
    if (departmentSelect) {
        departmentSelect.value = departmentId;
        updateManagersForDashboard();
        updateDashboardData();
    }
};

/**
 * Показ деталей менеджера
 */
window.showManagerDetails = function(planId) {
    const state = getState();
    const plan = state.planFactData?.plans?.find(p => p.id === planId);
    if (!plan) {
        alert('План не знайдено');
        return;
    }
    
    console.log('📊 Открытие деталей для плана:', plan);
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'managerDetailsModal';
    
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">📊 Деталі виконання плану</h2>
                <button onclick="closeManagerDetailsModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <!-- Заголовок с информацией о менеджере -->
            <div class="bg-gray-700 rounded-lg p-4 mb-6">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-400">Менеджер:</span>
                        <div class="text-white font-medium">${plan.employeeName || plan.employeeId}</div>
                    </div>
                    <div>
                        <span class="text-gray-400">Відділ:</span>
                        <div class="text-white">${plan.departmentName || 'Не вказано'}</div>
                    </div>
                    <div>
                        <span class="text-gray-400">План:</span>
                        <div class="text-green-400 font-bold">${formatCurrency(plan.totalPlan || 0)}</div>
                    </div>
                    <div>
                        <span class="text-gray-400">Факт:</span>
                        <div class="text-blue-400 font-bold">${formatCurrency(plan.totalFact || 0)}</div>
                    </div>
                </div>
            </div>
            
            <!-- Контент будет загружен динамически -->
            <div id="managerDetailsContent">
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p class="text-gray-400 mt-2">Завантаження деталей...</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Загружаем детали асинхронно
    loadManagerDetailsContent(plan);
};

/**
 * Закрытие модального окна деталей менеджера
 */
window.closeManagerDetailsModal = function() {
    const modal = document.getElementById('managerDetailsModal');
    if (modal) {
        modal.remove();
    }
};

/**
 * Загрузка детального контента для менеджера
 */
async function loadManagerDetailsContent(plan) {
    try {
        console.log('📊 Загрузка деталей для плана:', plan.id);
        
        // Получаем продажи менеджера за текущий месяц
        const { getState } = await import('./state.js');
        const currentState = getState();
        const apiCache = currentState.apiSalesCache || [];
        
        // Фильтруем продажи по менеджеру
        const managerSales = apiCache.filter(sale => {
            const managerName = sale['Основной менеджер'] || sale['Менеджер'] || '';
            const planManagerName = plan.employeeName || '';
            
            // Учитываем разные форматы имен
            return managerName.toLowerCase().includes(planManagerName.toLowerCase()) ||
                   planManagerName.toLowerCase().includes(managerName.toLowerCase());
        });
        
        console.log(`📊 Найдено ${managerSales.length} продаж для менеджера ${plan.employeeName}`);
        
        // Группируем по клиентам
        const clientsMap = new Map();
        
        managerSales.forEach(sale => {
            const clientCode = sale['Клиент.Код'] || sale['Код клієнта'] || 'unknown';
            const clientName = sale['Клиент'] || sale['Клієнт'] || clientCode;
            const revenue = parseFloat(sale['Выручка'] || sale['Виручка'] || 0);
            const date = sale['Дата'] || sale['Дата'] || '';
            const nomenclature = sale['Номенклатура'] || sale['Номенклатура'] || '';
            const branding = sale['Брендирование'] || sale['Брендування'] || 'Нет';
            
            if (!clientsMap.has(clientCode)) {
                clientsMap.set(clientCode, {
                    code: clientCode,
                    name: clientName,
                    totalRevenue: 0,
                    salesCount: 0,
                    lastSaleDate: null,
                    sales: []
                });
            }
            
            const client = clientsMap.get(clientCode);
            client.totalRevenue += revenue;
            client.salesCount++;
            client.sales.push({
                date: date,
                revenue: revenue,
                nomenclature: nomenclature,
                branding: branding
            });
            
            // Обновляем дату последней продажи
            if (!client.lastSaleDate || new Date(date) > new Date(client.lastSaleDate)) {
                client.lastSaleDate = date;
            }
        });
        
        // Сортируем клиентов по сумме продаж (убывание)
        const sortedClients = Array.from(clientsMap.values())
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
        
        // Рендерим контент
        renderManagerDetailsContent(plan, sortedClients, managerSales.length);
        
    } catch (error) {
        console.error('❌ Помилка завантаження деталей менеджера:', error);
        
        const contentDiv = document.getElementById('managerDetailsContent');
        if (contentDiv) {
            contentDiv.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-400 text-xl mb-2">❌</div>
                    <p class="text-red-400">Помилка завантаження деталей</p>
                    <p class="text-gray-400 text-sm mt-1">${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * Рендеринг детального контента менеджера
 */
function renderManagerDetailsContent(plan, clients, totalSalesCount) {
    const contentDiv = document.getElementById('managerDetailsContent');
    if (!contentDiv) return;
    
    const totalRevenue = clients.reduce((sum, client) => sum + client.totalRevenue, 0);
    const averagePerClient = clients.length > 0 ? totalRevenue / clients.length : 0;
    
    contentDiv.innerHTML = `
        <!-- Статистика -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gray-700 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-blue-400">${clients.length}</div>
                <div class="text-sm text-gray-400">Клієнтів</div>
            </div>
            <div class="bg-gray-700 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-green-400">${totalSalesCount}</div>
                <div class="text-sm text-gray-400">Продажів</div>
            </div>
            <div class="bg-gray-700 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-yellow-400">${formatCurrency(totalRevenue)}</div>
                <div class="text-sm text-gray-400">Загальна сума</div>
            </div>
            <div class="bg-gray-700 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-purple-400">${formatCurrency(averagePerClient)}</div>
                <div class="text-sm text-gray-400">В середньому на клієнта</div>
            </div>
        </div>
        
        <!-- Таблица клиентов -->
        <div class="bg-gray-700 rounded-lg overflow-hidden">
            <div class="p-4 border-b border-gray-600">
                <h3 class="text-lg font-bold text-white">👥 Клієнти менеджера</h3>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-600">
                        <tr>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-300">Клієнт</th>
                            <th class="px-4 py-3 text-right text-sm font-medium text-gray-300">Сума продажів</th>
                            <th class="px-4 py-3 text-center text-sm font-medium text-gray-300">Кількість</th>
                            <th class="px-4 py-3 text-center text-sm font-medium text-gray-300">Остання продаж</th>
                            <th class="px-4 py-3 text-center text-sm font-medium text-gray-300">Дії</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-600">
                        ${clients.map((client, index) => `
                            <tr class="hover:bg-gray-600 transition-colors">
                                <td class="px-4 py-3">
                                    <div class="text-white font-medium">${client.name}</div>
                                    <div class="text-gray-400 text-xs">${client.code}</div>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <div class="text-green-400 font-bold">${formatCurrency(client.totalRevenue)}</div>
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <span class="px-2 py-1 bg-blue-600 text-white rounded text-xs">${client.salesCount}</span>
                                </td>
                                <td class="px-4 py-3 text-center text-gray-300 text-sm">
                                    ${client.lastSaleDate ? new Date(client.lastSaleDate).toLocaleDateString('uk-UA') : 'Немає'}
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <button onclick="showClientSalesDetails('${client.code}', '${plan.employeeName}')" 
                                            class="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors">
                                        Деталі
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${clients.length === 0 ? `
                    <div class="text-center py-8">
                        <div class="text-gray-400 text-lg mb-2">📭</div>
                        <p class="text-gray-400">Продажів не знайдено</p>
                        <p class="text-gray-500 text-sm mt-1">Можливо, дані ще не завантажені або немає продажів за цей період</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Показ деталей продаж конкретного клиента
 */
window.showClientSalesDetails = function(clientCode, managerName) {
    console.log(`📊 Показ деталей клиента: ${clientCode} для менеджера: ${managerName}`);
    
    // Получаем продажи клиента из глобального состояния
    // Используем прямое обращение к кешу из backgroundService
    const state = getState();
    const apiCache = state.planFactData?.salesData || [];
    
    // Фильтруем продажи по клиенту и менеджеру
    const clientSales = apiCache.filter(sale => {
        const saleClientCode = sale['Клиент.Код'] || sale['Код клієнта'] || '';
        const saleManagerName = sale['Основной менеджер'] || sale['Менеджер'] || '';
        
        return saleClientCode === clientCode && 
               (saleManagerName.toLowerCase().includes(managerName.toLowerCase()) ||
                managerName.toLowerCase().includes(saleManagerName.toLowerCase()));
    });
    
    if (clientSales.length === 0) {
        alert('Продажів для цього клієнта не знайдено');
        return;
    }
    
    // Создаем модальное окно для деталей клиента
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]';
    modal.id = 'clientDetailsModal';
    
    const clientName = clientSales[0]['Клиент'] || clientSales[0]['Клієнт'] || clientCode;
    const totalRevenue = clientSales.reduce((sum, sale) => sum + parseFloat(sale['Выручка'] || sale['Виручка'] || 0), 0);
    
    // Сортируем продажи по дате (новые первыми)
    clientSales.sort((a, b) => new Date(b['Дата'] || b['Дата']) - new Date(a['Дата'] || a['Дата']));
    
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-xl p-6 max-w-5xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold text-white">🏢 Деталі продажів клієнта</h2>
                <button onclick="closeClientDetailsModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <!-- Информация о клиенте -->
            <div class="bg-gray-700 rounded-lg p-4 mb-6">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <span class="text-gray-400 text-sm">Клієнт:</span>
                        <div class="text-white font-medium">${clientName}</div>
                        <div class="text-gray-400 text-xs">${clientCode}</div>
                    </div>
                    <div>
                        <span class="text-gray-400 text-sm">Менеджер:</span>
                        <div class="text-white">${managerName}</div>
                    </div>
                    <div>
                        <span class="text-gray-400 text-sm">Всього продажів:</span>
                        <div class="text-green-400 font-bold">${clientSales.length}</div>
                    </div>
                    <div>
                        <span class="text-gray-400 text-sm">Загальна сума:</span>
                        <div class="text-blue-400 font-bold">${formatCurrency(totalRevenue)}</div>
                    </div>
                </div>
            </div>
            
            <!-- Таблица продаж -->
            <div class="bg-gray-700 rounded-lg overflow-hidden">
                <div class="p-4 border-b border-gray-600">
                    <h3 class="text-lg font-bold text-white">📦 Історія продажів</h3>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-600">
                            <tr>
                                <th class="px-3 py-2 text-left text-gray-300">Дата</th>
                                <th class="px-3 py-2 text-left text-gray-300">Номенклатура</th>
                                <th class="px-3 py-2 text-center text-gray-300">Брендування</th>
                                <th class="px-3 py-2 text-right text-gray-300">Сума</th>
                                <th class="px-3 py-2 text-center text-gray-300">Сфера діяльності</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-600">
                            ${clientSales.map(sale => {
                                const date = sale['Дата'] || sale['Дата'] || '';
                                const nomenclature = sale['Номенклатура'] || sale['Номенклатура'] || 'Не вказано';
                                const branding = sale['Брендирование'] || sale['Брендування'] || 'Нет';
                                const revenue = parseFloat(sale['Выручка'] || sale['Виручка'] || 0);
                                const activity = sale['Сфера деятельности'] || sale['Сфера діяльності'] || 'Не вказано';
                                
                                return `
                                    <tr class="hover:bg-gray-600 transition-colors">
                                        <td class="px-3 py-2 text-gray-300">
                                            ${date ? new Date(date).toLocaleDateString('uk-UA') : 'Не вказано'}
                                        </td>
                                        <td class="px-3 py-2">
                                            <div class="text-white text-xs max-w-xs truncate" title="${nomenclature}">
                                                ${nomenclature}
                                            </div>
                                        </td>
                                        <td class="px-3 py-2 text-center">
                                            <span class="px-2 py-1 rounded text-xs ${branding === 'Да' || branding === 'Так' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}">
                                                ${branding}
                                            </span>
                                        </td>
                                        <td class="px-3 py-2 text-right">
                                            <span class="text-green-400 font-medium">${formatCurrency(revenue)}</span>
                                        </td>
                                        <td class="px-3 py-2 text-center text-gray-300 text-xs max-w-xs truncate" title="${activity}">
                                            ${activity}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Статистика по номенклатуре -->
            <div class="mt-6 bg-gray-700 rounded-lg p-4">
                <h4 class="text-md font-bold text-white mb-3">📊 Статистика по номенклатурі</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    ${(() => {
                        // Группируем по номенклатуре
                        const nomenclatureMap = new Map();
                        clientSales.forEach(sale => {
                            const nomenclature = sale['Номенклатура'] || sale['Номенклатура'] || 'Не вказано';
                            const revenue = parseFloat(sale['Выручка'] || sale['Виручка'] || 0);
                            
                            if (!nomenclatureMap.has(nomenclature)) {
                                nomenclatureMap.set(nomenclature, { count: 0, revenue: 0 });
                            }
                            
                            const item = nomenclatureMap.get(nomenclature);
                            item.count++;
                            item.revenue += revenue;
                        });
                        
                        // Сортируем по выручке
                        const sortedNomenclature = Array.from(nomenclatureMap.entries())
                            .sort((a, b) => b[1].revenue - a[1].revenue)
                            .slice(0, 10); // Топ 10
                        
                        return sortedNomenclature.map(([name, data]) => `
                            <div class="flex justify-between items-center py-2 border-b border-gray-600 last:border-b-0">
                                <div class="text-gray-300 truncate max-w-xs" title="${name}">${name}</div>
                                <div class="text-right">
                                    <div class="text-green-400 font-medium">${formatCurrency(data.revenue)}</div>
                                    <div class="text-gray-400 text-xs">${data.count} продажів</div>
                                </div>
                            </div>
                        `).join('');
                    })()}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

/**
 * Закрытие модального окна деталей клиента
 */
window.closeClientDetailsModal = function() {
    const modal = document.getElementById('clientDetailsModal');
    if (modal) {
        modal.remove();
    }
};

/**
 * Редактирование фактов плана менеджера
 */
window.editManagerPlan = function(planId) {
    const plan = window.planFactData?.plans?.find(p => p.id === planId);
    if (!plan) {
        alert('План не знайдено');
        return;
    }
    
    // TODO: Открыть модальное окно для редактирования фактов
    alert(`Редагування фактів для ${plan.employeeName || plan.employeeId} буде реалізовано в модальному вікні`);
};

/**
 * Форматирование валюты
 */
function formatCurrency(amount) {
    if (!amount && amount !== 0) return '0 ₴';
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Расчет фактов продаж из данных (СТАРАЯ ВЕРСИЯ - оставляем для совместимости)
 */
function calculateSalesFactFromData(salesData, plan, nomenclatureFilter) {
    // Просто вызываем новую оптимизированную версию
    console.warn('⚠️ Використовується застаріла функція calculateSalesFactFromData, переключіться на calculateSalesFactFromGroupedData');
    
    // Группируем данные для совместимости
    const groupedSales = groupSalesByManagers(salesData);
    const managerSales = groupedSales.get(plan.employeeName || plan.employee?.name) || [];
    
    return calculateSalesFactFromGroupedData(managerSales, plan, nomenclatureFilter);
}

/**
 * Отображение статуса фонового сервиса
 */
window.showBackgroundServiceStatus = function() {
    if (!window.backgroundService) {
        showToast('❌ Фоновий сервіс недоступний', 'error');
        return;
    }
    
    const status = window.backgroundService.getStatus();
    
    console.log('📊 Статус фонового сервісу:', status);
    
    let statusText = '';
    if (status.isActive) {
        const lastUpdate = status.lastUpdate ? new Date(status.lastUpdate) : null;
        const nextUpdate = status.nextUpdate ? new Date(status.nextUpdate) : null;
        
        statusText = `✅ Активний\n`;
        statusText += `🕐 Останнє оновлення: ${lastUpdate ? lastUpdate.toLocaleTimeString() : 'Невідомо'}\n`;
        statusText += `⏰ Наступне оновлення: ${nextUpdate ? nextUpdate.toLocaleTimeString() : 'Невідомо'}\n`;
        statusText += `⏱️ Інтервал: ${status.interval / 1000 / 60} хвилин`;
    } else {
        statusText = `❌ Неактивний\n`;
        statusText += `🔄 Запустіть сервіс для автоматичного оновлення`;
    }
    
    showToast(statusText, status.isActive ? 'success' : 'warning');
};

/**
 * Тестовая функция для проверки расчета фактов
 */
window.testFactCalculation = function() {
    console.log('🧪 Тестування розрахунку фактів продажів...');
    
    // Проверяем кэш API
    console.log('📊 Кеш API:', {
        hasCache: !!state.apiSalesCache,
        cacheSize: state.apiSalesCache?.length || 0
    });
    
    // Проверяем планы
    const plans = state.planFactData?.plans || [];
    console.log('📋 Доступні плани:', {
        plansCount: plans.length,
        activePlans: plans.filter(p => p.status === 'active').length
    });
    
    if (plans.length > 0) {
        const firstPlan = plans[0];
        console.log('💡 Приклад плану:', {
            id: firstPlan.id,
            employeeName: firstPlan.employeeName,
            monthKey: firstPlan.monthKey,
            salesPlan: firstPlan.salesPlan,
            templateId: firstPlan.templateId
        });
        
        // Проверяем шаблон
        const template = state.planFactData?.planTemplates?.find(t => t.id === firstPlan.templateId);
        if (template) {
            console.log('📋 Шаблон плану:', {
                name: template.name,
                nomenclatureFilters: template.nomenclatureFilters
            });
        } else {
            console.warn('⚠️ Шаблон не знайдено для плану');
        }
    }
    
    // Проверяем менеджеров в API данных
    if (state.apiSalesCache && state.apiSalesCache.length > 0) {
        const uniqueManagers = [...new Set(state.apiSalesCache.map(sale => 
            sale["Основной менеджер"]
        ))].filter(name => name);
        
        console.log('👥 Менеджери в API (перші 10):', uniqueManagers.slice(0, 10));
        
        if (plans.length > 0) {
            const planEmployeeNames = plans.map(p => p.employeeName).filter(name => name);
            console.log('👤 Імена співробітників в планах:', planEmployeeNames);
            
            // Проверяем совпадения
            const matches = planEmployeeNames.filter(name => uniqueManagers.includes(name));
            console.log('✅ Збіги імен:', matches);
            
            const noMatches = planEmployeeNames.filter(name => !uniqueManagers.includes(name));
            if (noMatches.length > 0) {
                console.warn('⚠️ Імена без збігів:', noMatches);
            }
        }
    }
};

/**
 * Обогащение плана данными сотрудника и отдела
 */
async function enrichPlanWithEmployeeData(plan) {
    const state = getState();
    
    // Находим сотрудника
    const employee = state.planFactData?.employees?.find(emp => emp.id === plan.employeeId);
    
    // Находим отдел
    let department = null;
    if (plan.departmentId) {
        department = state.planFactData?.departments?.find(dept => dept.id === plan.departmentId);
    }
    
    // Если отдел не найден через departmentId, пробуем через сотрудника
    if (!department && employee) {
        if (employee.departmentId) {
            department = state.planFactData?.departments?.find(dept => dept.id === employee.departmentId);
        } else if (employee.department) {
            if (typeof employee.department === 'object') {
                department = employee.department;
            } else {
                department = state.planFactData?.departments?.find(dept => 
                    dept.id === employee.department || dept.name === employee.department
                );
            }
        }
    }
    
    const enrichedPlan = {
        ...plan,
        employee: employee,
        department: department,
        employeeName: employee?.name || plan.employeeName || `Співробітник ${plan.employeeId}`,
        departmentName: department?.name || plan.departmentName || `Відділ ${plan.departmentId}`
    };
    
    if (!employee) {
        console.warn(`⚠️ Співробітник не знайдений для плану ${plan.id}, employeeId: ${plan.employeeId}`);
        return null; // Не возвращаем план без сотрудника
    }
    if (!department) {
        console.warn(`⚠️ Відділ не знайдений для плану ${plan.id}, departmentId: ${plan.departmentId}`);
    }
    
    return enrichedPlan;
}

/**
 * Фильтрация данных по номенклатуре
 */
function filterDataByNomenclature(salesData, nomenclatureData, filters) {
    if (!filters || !filters.items || filters.items.length === 0) {
        return salesData;
    }
    
    return salesData.filter(sale => {
        const nomenclatureCode = sale["Номенклатура.Код"];
        if (!nomenclatureCode) {
            return false;
        }
        
        const shouldInclude = filters.items.some(filterItem => {
            return nomenclatureCode === filterItem;
        });
        
        // Если тип фильтра "exclude" - инвертируем результат
        if (filters.filterType === 'exclude') {
            return !shouldInclude;
        } else {
            return shouldInclude;
        }
    });
}