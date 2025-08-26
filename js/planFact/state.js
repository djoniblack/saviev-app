// state.js - Централізований модуль управління станом

/**
 * Приватное состояние приложения
 */
let state = {
    // Основные данные
    planFactData: {
        plans: [],
        planTemplates: [],
        focusTypes: [],
        goals: [],
        employees: [],
        departments: [],
        massAssignmentHistory: []
    },
    
    // Кэш API данных
    apiSalesCache: [],
    
    // UI состояние
    currentTab: 'dashboard',
    currentFilters: {
        month: new Date().toISOString().slice(0, 7),
        departmentId: '',
        managerId: ''
    },
    
    // Состояние загрузки
    isLoading: false,
    lastUpdate: null,
    
    // Механизм блокировки для предотвращения гонки состояний
    operationLock: null,
    pendingOperations: new Set()
};

/**
 * Подписчики на изменения состояния
 */
const subscribers = new Set();

/**
 * Получить текущее состояние
 */
export function getState() {
    return { ...state };
}

/**
 * Проверить, можно ли выполнить операцию
 */
export function canPerformOperation(operationId) {
    if (state.operationLock && state.operationLock !== operationId) {
        console.log(`⚠️ Операція ${operationId} заблокована, виконується ${state.operationLock}`);
        return false;
    }
    return true;
}

/**
 * Заблокировать выполнение других операций
 */
export function lockOperation(operationId) {
    if (state.operationLock && state.operationLock !== operationId) {
        console.log(`⚠️ Неможливо заблокувати операцію ${operationId}, виконується ${state.operationLock}`);
        return false;
    }
    
    state.operationLock = operationId;
    state.pendingOperations.add(operationId);
    console.log(`🔒 Операція ${operationId} заблокована`);
    return true;
}

/**
 * Разблокировать выполнение операций
 */
export function unlockOperation(operationId) {
    if (state.operationLock === operationId) {
        state.operationLock = null;
        state.pendingOperations.delete(operationId);
        console.log(`🔓 Операція ${operationId} розблокована`);
    }
}

/**
 * Обновить состояние
 */
export function updateState(newState) {
    const oldState = JSON.parse(JSON.stringify(state)); // Делаем глубокую копию для истории

    // "Умное" слияние
    for (const key in newState) {
        if (newState.hasOwnProperty(key)) {
            // Если ключ - это объект (но не массив), сливаем его свойства
            if (typeof newState[key] === 'object' && newState[key] !== null && !Array.isArray(newState[key]) && state[key]) {
                state[key] = { ...state[key], ...newState[key] };
            } else {
                // Иначе просто заменяем значение (для простых типов или массивов)
                state[key] = newState[key];
            }
        }
    }
    
    // Уведомляем подписчиков
    subscribers.forEach(callback => {
        try {
            callback(state, oldState);
        } catch (error) {
            console.error('❌ Помилка в підписнику стану:', error);
        }
    });
}

/**
 * Подписаться на изменения состояния
 */
export function subscribe(callback) {
    subscribers.add(callback);
    
    // Возвращаем функцию для отписки
    return () => {
        subscribers.delete(callback);
    };
}

/**
 * Получить конкретную часть состояния
 */
export function getStateSlice(sliceName) {
    return state[sliceName];
}

/**
 * Обновить конкретную часть состояния
 */
export function updateStateSlice(sliceName, newData) {
    updateState({
        [sliceName]: { ...state[sliceName], ...newData }
    });
}

/**
 * Добавить элемент в массив состояния
 */
export function addToStateArray(arrayName, item) {
    const currentArray = state[arrayName] || [];
    updateState({
        [arrayName]: [...currentArray, item]
    });
}

/**
 * Обновить элемент в массиве состояния
 */
export function updateStateArrayItem(arrayName, itemId, updates) {
    const currentArray = state[arrayName] || [];
    const updatedArray = currentArray.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
    );
    
    updateState({
        [arrayName]: updatedArray
    });
}

/**
 * Удалить элемент из массива состояния
 */
export function removeFromStateArray(arrayName, itemId) {
    const currentArray = state[arrayName] || [];
    const filteredArray = currentArray.filter(item => item.id !== itemId);
    
    updateState({
        [arrayName]: filteredArray
    });
}

/**
 * Установить фильтры
 */
export function setFilters(filters) {
    updateState({
        currentFilters: { ...state.currentFilters, ...filters }
    });
}

/**
 * Установить текущую вкладку
 */
export function setCurrentTab(tabName) {
    updateState({
        currentTab: tabName
    });
}

/**
 * Установить состояние загрузки
 */
export function setLoading(isLoading) {
    updateState({
        isLoading
    });
}

/**
 * Обновить кэш API данных
 */
export function updateApiCache(data) {
    updateState({
        apiSalesCache: data,
        lastUpdate: new Date().toISOString()
    });
}

/**
 * Очистить кэш API данных
 */
export function clearApiCache() {
    updateState({
        apiSalesCache: [],
        lastUpdate: null
    });
}

/**
 * Получить статистику состояния
 */
export function getStateStats() {
    return {
        plansCount: state.planFactData.plans.length,
        templatesCount: state.planFactData.planTemplates.length,
        focusTypesCount: state.planFactData.focusTypes.length,
        employeesCount: state.planFactData.employees.length,
        departmentsCount: state.planFactData.departments.length,
        apiCacheSize: state.apiSalesCache.length,
        subscribersCount: subscribers.size,
        lastUpdate: state.lastUpdate
    };
}

/**
 * Экспорт для глобального доступа (для совместимости)
 */
if (typeof window !== 'undefined') {
    window.planFactState = {
        getState,
        updateState,
        subscribe,
        getStateSlice,
        updateStateSlice,
        addToStateArray,
        updateStateArrayItem,
        removeFromStateArray,
        setFilters,
        setCurrentTab,
        setLoading,
        updateApiCache,
        clearApiCache,
        getStateStats
    };
} 