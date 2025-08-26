// backgroundService.js - Сервіс фонового оновлення даних

import { getState, updateState, subscribe } from './state.js';

/**
 * Интервал обновления в миллисекундах (15 минут)
 */
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 минут

/**
 * ID интервала для возможности остановки
 */
let updateIntervalId = null;

/**
 * Флаг активности сервиса
 */
let isServiceActive = false;

/**
 * Последнее время обновления
 */
let lastUpdateTime = null;

/**
 * Проверка готовности HTML элементов дашборда
 */
function checkDashboardElementsReady() {
    const dashboardLoading = document.getElementById('dashboard-loading');
    const overallStats = document.getElementById('overall-stats');
    const departmentsSection = document.getElementById('departments-section');
    const managersSection = document.getElementById('managers-section');
    
    const allElementsExist = dashboardLoading && overallStats && departmentsSection && managersSection;
    
    if (!allElementsExist) {
        console.log('🔍 Статус елементів дашборда:', {
            'dashboard-loading': !!dashboardLoading,
            'overall-stats': !!overallStats,
            'departments-section': !!departmentsSection,
            'managers-section': !!managersSection
        });
    }
    
    return allElementsExist;
}

/**
 * Функция фонового обновления данных
 */
async function updateDashboardInBackground() {
    try {
        console.log('🔄 Фонове оновлення даних дашборду...');
        
        const startTime = Date.now();
        
        // Получаем текущее состояние
        const currentState = getState();
        
        // Обновляем данные API
        const freshData = await fetchSalesData();
        if (freshData && freshData.length > 0) {
            updateState({
                apiSalesCache: freshData,
                lastUpdate: new Date().toISOString()
            });
            
            // Синхронизируем с глобальным объектом для совместимости
            // if (window.planFactData) {
            //     window.planFactData.salesData = freshData;
            // }
            
            console.log(`✅ Фонове оновлення завершено: ${freshData.length} записів завантажено`);
        } else {
            console.warn('⚠️ Фонове оновлення: не вдалося отримати нові дані');
        }
        
        // Пересчитываем метрики дашборда если он активен
        if (currentState.currentTab === 'dashboard') {
            await recalculateDashboardMetrics();
        }
        
        lastUpdateTime = Date.now();
        const duration = Date.now() - startTime;
        console.log(`⏱️ Фонове оновлення виконано за ${duration}ms`);
        
    } catch (error) {
        console.error('❌ Помилка фонового оновлення:', error);
    }
}

/**
 * Загрузка данных продаж из API
 */
async function fetchSalesData() {
    try {
        console.log('📡 Завантаження свіжих даних з API...');
        
        const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('API повернув невалідні дані (не масив)');
        }
        
        console.log(`📊 Завантажено ${data.length} свіжих записів`);
        return data;
        
    } catch (error) {
        console.error('❌ Помилка завантаження даних з API:', error);
        return null;
    }
}

/**
 * Пересчет метрик дашборда
 */
async function recalculateDashboardMetrics() {
    try {
        console.log('📊 Перерахунок метрик дашборду...');
        
        const currentState = getState();
        const { currentFilters } = currentState;
        
        // Получаем правильный формат месяца
        let month = currentFilters.month;
        if (!month) {
            month = new Date().toISOString().slice(0, 7); // YYYY-MM
        }
        
        console.log('🔍 Фільтри з фонового сервісу:', { 
            month, 
            departmentId: currentFilters.departmentId, 
            managerId: currentFilters.managerId 
        });
        
        // Импортируем функции дашборда
        const { getActivePlansForDashboard, loadSalesFactsForPlans, calculateFocusTasksFacts } = await import('./dashboard.js');
        
        // Получаем активные планы
        const plans = await getActivePlansForDashboard(
            month,
            currentFilters.departmentId,
            currentFilters.managerId
        );
        
        // Загружаем факты продаж
        const salesFacts = await loadSalesFactsForPlans(plans);
        
        // Рассчитываем фокусные задачи
        const focusFacts = await calculateFocusTasksFacts(plans);
        
        // Объединяем данные для отображения
        const { combinePlanData } = await import('./dashboard.js');
        const dashboardData = combinePlanData(plans, salesFacts, focusFacts);
        
        // Обновляем состояние с новыми данными
        updateState({
            dashboardData: {
                plans,
                salesFacts,
                focusFacts,
                lastCalculated: new Date().toISOString()
            }
        });
        
        // Рендерим данные в UI если мы на вкладке дашборда
        const currentTab = getState().currentTab;
        if (currentTab === 'dashboard') {
            // Проверяем готовность HTML элементов дашборда
            if (checkDashboardElementsReady()) {
                console.log('🎨 Рендеринг даних з фонового сервісу...');
                const { renderDashboardData } = await import('./dashboard.js');
                await renderDashboardData(
                    dashboardData, 
                    currentFilters.month,
                    currentFilters.departmentId,
                    currentFilters.managerId
                );
                console.log('✅ Дані відрендерено з фонового сервісу');
            } else {
                console.log('⏳ Вкладка дашборда ще не відрендерена, дані збережено в стані');
                
                // Добавляем более длительную задержку и пробуем еще раз
                setTimeout(async () => {
                    if (checkDashboardElementsReady()) {
                        console.log('🎨 Повторна спроба рендерингу даних з фонового сервісу...');
                        const { renderDashboardData } = await import('./dashboard.js');
                        await renderDashboardData(
                            dashboardData, 
                            currentFilters.month,
                            currentFilters.departmentId,
                            currentFilters.managerId
                        );
                        console.log('✅ Дані відрендерено з фонового сервісу (повторна спроба)');
                    } else {
                        console.log('⚠️ Елементи дашборда все ще не готові після повторної спроби');
                    }
                }, 3000); // Увеличиваем задержку до 3 секунд
            }
        }
        
        console.log('✅ Метрики дашборду перераховано');
        
    } catch (error) {
        console.error('❌ Помилка перерахунку метрик:', error);
    }
}

/**
 * Запуск сервиса фонового обновления
 */
export function startBackgroundService() {
    if (isServiceActive) {
        console.warn('⚠️ Фоновий сервіс вже активний');
        return;
    }
    
    console.log('🚀 Запуск фонового сервісу оновлення...');
    
    // Немедленное первое обновление
    updateDashboardInBackground();
    
    // Устанавливаем интервал
    updateIntervalId = setInterval(updateDashboardInBackground, UPDATE_INTERVAL);
    
    isServiceActive = true;
    lastUpdateTime = Date.now();
    
    console.log(`✅ Фоновий сервіс запущено (інтервал: ${UPDATE_INTERVAL / 1000 / 60} хвилин)`);
}

/**
 * Остановка сервиса фонового обновления
 */
export function stopBackgroundService() {
    if (!isServiceActive) {
        console.warn('⚠️ Фоновий сервіс не активний');
        return;
    }
    
    console.log('🛑 Зупинка фонового сервісу...');
    
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }
    
    isServiceActive = false;
    
    console.log('✅ Фоновий сервіс зупинено');
}

/**
 * Получить статус сервиса
 */
export function getServiceStatus() {
    return {
        isActive: isServiceActive,
        lastUpdate: lastUpdateTime,
        interval: UPDATE_INTERVAL,
        nextUpdate: lastUpdateTime ? lastUpdateTime + UPDATE_INTERVAL : null
    };
}

/**
 * Принудительное обновление данных
 */
export async function forceUpdate() {
    console.log('🔧 Примусове оновлення даних...');
    
    try {
        // Выполняем полное обновление данных
        await updateDashboardInBackground();
        
        // Проверяем что данные действительно загружены
        const currentState = getState();
        if (currentState.dashboardData && currentState.dashboardData.plans) {
            console.log('✅ Примусове оновлення завершено успішно');
            return true;
        } else {
            console.warn('⚠️ Дані не завантажені після примусового оновлення');
            return false;
        }
    } catch (error) {
        console.error('❌ Помилка примусового оновлення:', error);
        throw error;
    }
}

/**
 * Изменить интервал обновления
 */
export function setUpdateInterval(minutes) {
    const newInterval = minutes * 60 * 1000;
    
    console.log(`⏰ Зміна інтервалу оновлення: ${UPDATE_INTERVAL / 1000 / 60} → ${minutes} хвилин`);
    
    // Останавливаем текущий интервал
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
    }
    
    // Обновляем интервал
    UPDATE_INTERVAL = newInterval;
    
    // Запускаем новый интервал если сервис активен
    if (isServiceActive) {
        updateIntervalId = setInterval(updateDashboardInBackground, UPDATE_INTERVAL);
    }
}

/**
 * Подписка на изменения состояния для автоматического пересчета
 */
export function setupStateSubscription() {
    const unsubscribe = subscribe((newState, oldState) => {
        // Если изменились фильтры и активен дашборд - пересчитываем
        if (newState.currentTab === 'dashboard' && 
            JSON.stringify(newState.currentFilters) !== JSON.stringify(oldState.currentFilters)) {
            
            console.log('🔄 Фільтри змінилися, перераховуємо дашборд...');
            recalculateDashboardMetrics();
        }
    });
    
    return unsubscribe;
}

/**
 * Экспорт для глобального доступа
 */
if (typeof window !== 'undefined') {
    window.backgroundService = {
        start: startBackgroundService,
        stop: stopBackgroundService,
        getStatus: getServiceStatus,
        forceUpdate,
        setInterval: setUpdateInterval
    };
} 