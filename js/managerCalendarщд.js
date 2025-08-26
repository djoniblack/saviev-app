// managerCalendar.js - Модуль календаря менеджера
import * as firebase from './firebase.js';

// === НАСТРОЙКИ ОТЛАДКИ ===
const DEBUG_MODE = window.location.hostname === 'localhost' || window.location.search.includes('debug=true');
const LOG_LEVEL = DEBUG_MODE ? 'verbose' : 'error'; // verbose, info, warn, error

// Функции логирования с учетом уровня
const logger = {
    verbose: (...args) => DEBUG_MODE && LOG_LEVEL === 'verbose' && console.log(...args),
    info: (...args) => ['verbose', 'info'].includes(LOG_LEVEL) && console.log(...args),
    warn: (...args) => ['verbose', 'info', 'warn'].includes(LOG_LEVEL) && console.warn(...args),
    error: (...args) => console.error(...args)
};

// Глобальные переменные для календаря менеджера
let calendarData = [];
let managersData = [];
let departmentsData = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDepartment = '';
let selectedManager = '';
let isCalendarInited = false;

// === АВТООБНОВЛЕНИЕ ===
let autoUpdateInterval = null;
let lastUpdateTime = null;
let lastDataHash = null;
let isAutoUpdateEnabled = true;
let isUpdateInProgress = false;
const AUTO_UPDATE_INTERVAL = 15 * 60 * 1000; // 15 минут

// Добавляем защиту от множественных запусков
let isAutoUpdateInitialized = false;

// === ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ ЗАДАЧ ===
let newTasks = new Map();        // Новые задачи
let rescheduledTasks = new Map(); // Перенесенные задачи
let taskHistory = new Map();      // История изменений задач

// Добавляем константы для retry логики
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 секунд
const API_TIMEOUT = 30000; // 30 секунд

/**
 * Вычисление хеша данных для сравнения
 */
function calculateDataHash(data) {
    const hash = JSON.stringify(data.map(item => ({
        id: item.ID,
        date: item.Дата,
        manager: item.Менеджер
    })).sort((a, b) => a.id.localeCompare(b.id)));
    
    logger.verbose('🔍 Обчислено хеш даних:', hash.length, 'символів');
    return hash;
}

/**
 * Запуск автообновления
 */
function startAutoUpdate() {
    // Улучшенная проверка на уже запущенное автообновление
    if (autoUpdateInterval) {
        logger.verbose('🔄 Автооновлення вже запущено, пропускаємо');
        return;
    }
    
    // Дополнительная защита от множественного запуска
    if (isAutoUpdateInitialized) {
        logger.verbose('🔄 Автооновлення вже ініціалізовано');
        return;
    }
    
    logger.verbose('🔄 Запуск автооновлення...');
    
    // Используем константу вместо хардкода
    autoUpdateInterval = setInterval(checkForUpdates, AUTO_UPDATE_INTERVAL);
    isAutoUpdateInitialized = true;
    lastUpdateTime = new Date();
    
    updateAutoUpdateStatus('Автооновлення увімкнено', 'text-green-600');
    logger.info(`✅ Автооновлення запущено (інтервал: ${AUTO_UPDATE_INTERVAL / 1000 / 60} хв)`);
}

/**
 * Остановка автообновления
 */
function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        isAutoUpdateInitialized = false;
        lastUpdateTime = null;
        updateAutoUpdateStatus('Автооновлення вимкнено', 'text-red-600');
        logger.info('🛑 Автооновлення зупинено');
    }
}

/**
 * Выполнение API запроса с retry логикой
 */
async function makeApiRequestWithRetry(url, maxAttempts = MAX_RETRY_ATTEMPTS) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            logger.verbose(`🌐 Спроба ${attempt}/${maxAttempts}: ${url}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            logger.info(`✅ Успішний запит ${url}, отримано ${data.length} записів`);
            return data;
            
        } catch (error) {
            logger.warn(`⚠️ Спроба ${attempt} невдала для ${url}:`, error.message);
            
            if (attempt === maxAttempts) {
                logger.error(`❌ Всі ${maxAttempts} спроб невдалі для ${url}`);
                throw error;
            }
            
            if (error.name === 'AbortError') {
                logger.warn(`⏱️ Тайм-аут запиту ${url}`);
            }
            
            // Ждем перед следующей попыткой
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        }
    }
}

/**
 * Проверка наличия обновлений
 */
async function checkForUpdates() {
    // Защита от множественных одновременных запросов
    if (isUpdateInProgress) {
        logger.verbose('🔄 Оновлення вже виконується, пропускаємо');
        return;
    }
    
    isUpdateInProgress = true;
    
    try {
        logger.verbose('🔄 Перевірка оновлень...');
        updateAutoUpdateStatus('Перевіряємо оновлення...', 'text-yellow-600');
        
        const apiData = await makeApiRequestWithRetry('https://fastapi.lookfort.com/nomenclature.analysis?mode=dela');
        logger.info('📊 Отримано даних з API для перевірки:', apiData.length);
        
        // Загружаем существующие данные из Firebase для сравнения
        const existingTasks = await loadTasksFromFirebase();
        
        // Находим только новые и измененные задачи
        const { newTasks, rescheduledTasks, unchangedTasks } = findChangedTasks(apiData, existingTasks);
        
        if (newTasks.length > 0 || rescheduledTasks.length > 0) {
            logger.verbose('🔄 Знайдено оновлення, зберігаємо зміни...');
            updateAutoUpdateStatus('Зберігаємо зміни...', 'text-blue-600');
            
            await saveOnlyChanges(newTasks, rescheduledTasks);
            
            // Загружаем обновленные данные из Firebase
            calendarData = await loadTasksFromFirebase();
            
            // Обновляем аналитику
            await updateTaskAnalytics();
            
            // Перерисовываем календар
            renderCalendar();
            
            logger.info('✅ Оновлення завершено');
            showUpdateNotification(`Оновлено: ${newTasks.length} нових, ${rescheduledTasks.length} перенесених завдань`);
            updateAutoUpdateStatus(`Останнє оновлення: ${new Date().toLocaleTimeString('uk-UA')}`, 'text-green-600');
        } else {
            logger.info('✅ Оновлень не знайдено');
            updateAutoUpdateStatus(`Перевірено: ${new Date().toLocaleTimeString('uk-UA')} - змін немає`, 'text-gray-600');
        }
        
        lastUpdateTime = new Date();
        
    } catch (error) {
        logger.error('❌ Помилка перевірки оновлень:', error);
        
        let errorMessage = 'Помилка перевірки оновлень';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Помилка мережі - перевірте з\'єднання';
        } else if (error.name === 'AbortError') {
            errorMessage = 'Тайм-аут запиту - сервер не відповідає';
        } else if (error.message.includes('HTTP')) {
            errorMessage = `Помилка сервера: ${error.message}`;
        }
        
        updateAutoUpdateStatus(errorMessage, 'text-red-600');
        showUpdateNotification(errorMessage, 'error');
    } finally {
        isUpdateInProgress = false;
    }
}

/**
 * Показ уведомления об обновлении
 */
function showUpdateNotification(message, type = 'info') {
    logger.info('📢 Показ уведомлення:', message, type);
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'info' ? 'bg-blue-500 text-white' :
        type === 'success' ? 'bg-green-500 text-white' :
        'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Функция updateAutoUpdateStatus перенесена ниже в оптимизированном виде

/**
 * Трансформация данных API в внутренний формат
 */
function transformApiDataToInternalFormat(apiData) {
    logger.verbose('🔄 Трансформація API даних...');
    logger.info('📊 Вхідні дані:', apiData.length);
    
    const transformedData = apiData.map(item => ({
        ID: item.ID || item.id || Math.random().toString(36).substr(2, 9),
        Дата: item.Дата, // Зберігаємо оригінальне поле
        'Дата изменения': item['Дата изменения'] || item.Дата, // Додаємо нове поле
        Дело: item.Дело || '',
        Менеджер: item.Менеджер || '',
        'Клиент.Название': item['Клиент.Название'] || '',
        'Клиент.Код': item['Клиент.Код'] || '',
        'Клиент.Ссылка': item['Клиент.Ссылка'] || '', // Додаємо нове поле
        departmentName: findManagerDepartment(item.Менеджер),
        status: 'active' // По умолчанию все задачи активные
    }));
    
    logger.info('✅ Трансформація завершена:', transformedData.length);
    
    // Логуємо приклади трансформованих даних
    if (transformedData.length > 0) {
        logger.verbose('📋 Приклади трансформованих даних:', transformedData.slice(0, 3).map(t => ({ 
            ID: t.ID, 
            Менеджер: t.Менеджер, 
            Дата: t.Дата,
            'Клиент.Ссылка': t['Клиент.Ссылка'] ? 'Є' : 'Немає'
        })));
    }
    
    return transformedData;
}

/**
 * Поиск отдела менеджера
 */
function findManagerDepartment(managerName) {
    if (!managerName) {
        logger.warn('⚠️ Ім\'я менеджера не вказано');
        return '';
    }
    
    const manager = managersData.find(m => 
        m.name.toLowerCase().includes(managerName.toLowerCase()) ||
        managerName.toLowerCase().includes(m.name.toLowerCase())
    );
    
    if (manager && manager.department) {
        const department = departmentsData.find(d => d.id === manager.department);
        if (department) {
            logger.info(`🏢 Знайдено відділ менеджера ${managerName}: ${department.name}`);
            return department.name;
        }
    }
    
    logger.warn(`⚠️ Відділ менеджера не знайдено: ${managerName}`);
    return '';
}

/**
 * Сохранение задачи в Firebase
 */
async function saveTaskToFirebase(taskData) {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            logger.error('❌ ID компанії не знайдено');
            return false;
        }

        // Проверяем права доступа
        const userPermissions = window.state?.currentUserPermissions || {};
        const hasPermission = userPermissions['manager_calendar_manage_tasks'] || 
                            userPermissions['manager_calendar_view_all_tasks'] || 
                            userPermissions['manager_calendar_view_page'] ||
                            window.state?.isOwner;

        if (!hasPermission) {
            logger.warn('⚠️ Немає прав для збереження завдань календаря');
            return false;
        }

        const taskId = taskData.ID;
        const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'managerCalendarTasks', taskId);
        
        // Получаем существующую задачу для сравнения
        const existingTask = await firebase.getDoc(taskRef);
        
        const taskDoc = {
            taskId: taskId, // Сохраняем ID как taskId для сравнения
            managerId: findManagerIdByName(taskData.Менеджер),
            managerName: taskData.Менеджер,
            departmentId: findDepartmentIdByName(findManagerDepartment(taskData.Менеджер)),
            departmentName: findManagerDepartment(taskData.Менеджер),
            clientName: taskData['Клиент.Название'],
            clientCode: taskData['Клиент.Код'],
            clientLink: taskData['Клиент.Ссылка'], // Додаємо нове поле
            taskDescription: taskData.Дело,
            scheduledDate: taskData.Дата, // Зберігаємо оригінальне поле
            modifiedDate: taskData['Дата изменения'], // Додаємо нове поле
            originalDate: existingTask.exists() ? existingTask.data().originalDate : taskData.Дата,
            status: determineTaskStatus(existingTask, taskData),
            lastUpdated: firebase.serverTimestamp(),
            companyId: companyId
        };

        await firebase.setDoc(taskRef, taskDoc, { merge: true });
        
        // Отслеживаем изменения
        trackTaskChanges(existingTask, taskDoc);
        
        logger.info(`✅ Збережено завдання: ${taskId} - ${taskData.Менеджер}`);
        return true;
    } catch (error) {
        logger.error('❌ Помилка збереження завдання в Firebase:', error);
        return false;
    }
}

/**
 * Определение статуса задачи
 */
function determineTaskStatus(existingTask, newTaskData) {
    if (!existingTask.exists()) {
        logger.info(`🆕 Нова завдання: ${newTaskData.ID}`);
        return 'new';
    }
    
    const existingDate = new Date(existingTask.data().scheduledDate);
    const newDate = new Date(newTaskData.Дата);
    
    // Сравниваем даты с точностью до минуты
    const existingTime = existingDate.getTime();
    const newTime = newDate.getTime();
    
    if (Math.abs(existingTime - newTime) > 60000) { // Разница больше 1 минуты
        logger.info(`🔄 Перенесена завдання: ${newTaskData.ID} з ${existingDate.toISOString()} на ${newDate.toISOString()}`);
        return 'rescheduled';
    }
    
    return existingTask.data().status || 'active';
}

/**
 * Отслеживание изменений задач
 */
function trackTaskChanges(existingTask, newTaskDoc) {
    const taskId = newTaskDoc.taskId;
    
    if (!existingTask.exists()) {
        // Новая задача
        newTasks.set(taskId, {
            taskId: taskId,
            managerName: newTaskDoc.managerName,
            clientName: newTaskDoc.clientName,
            clientLink: newTaskDoc.clientLink, // Додаємо посилання на CRM
            taskDescription: newTaskDoc.taskDescription,
            scheduledDate: newTaskDoc.scheduledDate,
            addedAt: new Date()
        });
        logger.info(`📝 Додано до нових завдань: ${taskId}`);
    } else {
        const existingDate = new Date(existingTask.data().scheduledDate);
        const newDate = new Date(newTaskDoc.scheduledDate);
        
        // Сравниваем даты с точностью до минуты
        const existingTime = existingDate.getTime();
        const newTime = newDate.getTime();
        
        if (Math.abs(existingTime - newTime) > 60000) { // Разница больше 1 минуты
            // Перенесенная задача
            rescheduledTasks.set(taskId, {
                taskId: taskId,
                managerName: newTaskDoc.managerName,
                clientName: newTaskDoc.clientName,
                clientLink: newTaskDoc.clientLink, // Додаємо посилання на CRM
                taskDescription: newTaskDoc.taskDescription,
                oldDate: existingDate.toISOString(),
                newDate: newTaskDoc.scheduledDate,
                rescheduledAt: new Date()
            });
            logger.info(`📝 Додано до перенесених завдань: ${taskId}`);
        }
    }
}

/**
 * Загрузка задач из Firebase
 */
async function loadTasksFromFirebase() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            logger.error('❌ ID компанії не знайдено');
            return [];
        }

        logger.info('📥 Завантаження завдань з Firebase...');
        logger.info('🏢 Company ID:', companyId);

        // Используем подколлекцию в компании
        const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'managerCalendarTasks');
        const tasksSnapshot = await firebase.getDocs(tasksRef);

        const tasks = [];
        tasksSnapshot.forEach(doc => {
            const data = doc.data();
            tasks.push({
                ID: data.taskId, // Используем taskId как ID для сравнения
                Дата: data.scheduledDate, // Зберігаємо оригінальне поле
                'Дата изменения': data.modifiedDate || data.scheduledDate, // Додаємо нове поле
                Дело: data.taskDescription,
                Менеджер: data.managerName,
                'Клиент.Название': data.clientName,
                'Клиент.Код': data.clientCode,
                'Клиент.Ссылка': data.clientLink || '', // Додаємо нове поле
                departmentName: data.departmentName,
                status: data.status
            });
        });

        logger.info(`📥 Завантажено ${tasks.length} завдань з Firebase`);
        
        // Логуємо приклади завантажених завдань
        if (tasks.length > 0) {
            logger.verbose('📋 Приклади завантажених завдань:', tasks.slice(0, 3).map(t => ({ ID: t.ID, Менеджер: t.Менеджер, Дата: t.Дата })));
        }
        
        return tasks;
    } catch (error) {
        logger.error('❌ Помилка завантаження завдань з Firebase:', error);
        return [];
    }
}

// Функция updateTaskAnalytics перенесена ниже в оптимизированном виде

/**
 * Обновление отображения аналитики с защитой от дублирования
 */
function updateAnalyticsDisplay(analytics) {
    let analyticsContainer = document.getElementById('calendarAnalytics');
    
    // Если контейнер не существует, создаем его один раз
    if (!analyticsContainer) {
        const calendarContainer = document.getElementById('calendarContainer');
        if (!calendarContainer) {
            logger.warn('⚠️ Основний контейнер календаря не знайдено');
            return;
        }
        
        // Создаем контейнер аналитики
        analyticsContainer = document.createElement('div');
        analyticsContainer.id = 'calendarAnalytics';
        analyticsContainer.className = 'mb-6';
        
        // Вставляем в начало календарного контейнера
        calendarContainer.insertBefore(analyticsContainer, calendarContainer.firstChild);
        
        logger.verbose('📊 Створено контейнер аналітики календаря');
    }

    // Обновляем содержимое (только если есть изменения)
    const newContent = generateAnalyticsContent(analytics);
    if (analyticsContainer.innerHTML !== newContent) {
        analyticsContainer.innerHTML = newContent;
        logger.verbose('📊 Аналітика календаря оновлена');
    }
}

/**
 * Генерация контента аналитики
 */
function generateAnalyticsContent(analytics) {
    return `
        <div class="bg-gray-700 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>Аналітика завдань</span>
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-blue-100 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-blue-600">${analytics.totalTasks || 0}</div>
                    <div class="text-sm text-gray-600">Всього завдань</div>
                </div>
                <div class="bg-green-100 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-green-600">${analytics.newTasks || 0}</div>
                    <div class="text-sm text-gray-600">Нових завдань</div>
                </div>
                <div class="bg-yellow-100 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-yellow-600">${analytics.rescheduledTasks || 0}</div>
                    <div class="text-sm text-gray-600">Перенесених</div>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-purple-600">${analytics.completedTasks || 0}</div>
                    <div class="text-sm text-gray-600">Виконаних</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Инициализация статистических элементов с проверкой дублирования
 */
const calendarUIElements = new Set();

function initCalendarUIElement(elementId, creationFunction) {
    if (calendarUIElements.has(elementId)) {
        logger.verbose(`🔄 Елемент ${elementId} вже ініціалізовано`);
        return document.getElementById(elementId);
    }
    
    try {
        const element = creationFunction();
        if (element) {
            calendarUIElements.add(elementId);
            logger.verbose(`✅ Ініціалізовано елемент: ${elementId}`);
        }
        return element;
    } catch (error) {
        logger.error(`❌ Помилка ініціалізації елемента ${elementId}:`, error);
        return null;
    }
}

/**
 * Очистка всех UI элементов календаря
 */
function clearCalendarUIElements() {
    calendarUIElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.remove();
            logger.verbose(`🗑️ Видалено елемент: ${elementId}`);
        }
    });
    calendarUIElements.clear();
    logger.info('🧹 Очищено всі UI елементи календаря');
}

/**
 * Оптимизированное обновление аналитики задач с защитой от дублирования
 */
async function updateTaskAnalytics() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            logger.warn('⚠️ CompanyId не знайдено для аналітики');
            return;
        }

        // Проверяем, не выполняется ли уже обновление аналитики
        if (updateTaskAnalytics.isRunning) {
            logger.verbose('⏳ Оновлення аналітики вже виконується');
            return;
        }
        
        updateTaskAnalytics.isRunning = true;

        // Используем подколлекцию в компании
        const analyticsRef = firebase.doc(firebase.db, 'companies', companyId, 'managerCalendarAnalytics', 'summary');
        
        const analytics = {
            totalTasks: calendarData.length,
            newTasks: newTasks.size,
            rescheduledTasks: rescheduledTasks.size,
            completedTasks: calendarData.filter(task => task.status === 'completed').length,
            lastUpdated: firebase.serverTimestamp(),
            companyId: companyId
        };

        await firebase.setDoc(analyticsRef, analytics, { merge: true });
        
        logger.info('📊 Аналітика оновлена:', analytics);
        
        // Обновляем интерфейс
        updateAnalyticsDisplay(analytics);
        
    } catch (error) {
        logger.error('❌ Помилка оновлення аналітики:', error);
    } finally {
        updateTaskAnalytics.isRunning = false;
    }
}

/**
 * Поиск ID менеджера по имени
 */
function findManagerIdByName(managerName) {
    const manager = managersData.find(m => 
        m.name.toLowerCase().includes(managerName.toLowerCase()) ||
        managerName.toLowerCase().includes(m.name.toLowerCase())
    );
    
    if (manager) {
        logger.info(`👤 Знайдено менеджера: ${managerName} -> ${manager.id}`);
        return manager.id;
    }
    
    logger.warn(`⚠️ Менеджер не знайдено: ${managerName}`);
    return null;
}

/**
 * Поиск ID отдела по названию
 */
function findDepartmentIdByName(departmentName) {
    const department = departmentsData.find(d => 
        d.name.toLowerCase().includes(departmentName.toLowerCase()) ||
        departmentName.toLowerCase().includes(d.name.toLowerCase())
    );
    
    if (department) {
        logger.info(`🏢 Знайдено відділ: ${departmentName} -> ${department.id}`);
        return department.id;
    }
    
    logger.warn(`⚠️ Відділ не знайдено: ${departmentName}`);
    return null;
}

/**
 * Загрузка данных календаря
 */
export async function loadCalendarData() {
    try {
        logger.info('📅 Завантаження даних календаря...');
        
        // Сначала загружаем данные из Firebase (наш кэш)
        const existingTasks = await loadTasksFromFirebase();
        logger.info('📥 Існуючі дані з Firebase:', existingTasks.length);

        // Затем запрашиваем свежие данные с API
        const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=dela');
        if (!response.ok) {
            logger.error('❌ Помилка завантаження з API:', response.status);
            // Если API недоступен, используем данные из Firebase
            calendarData = existingTasks;
            logger.info('📥 Використовуємо дані з Firebase як fallback:', calendarData.length);
            await updateTaskAnalytics(); // Обновляем аналитику на основе кэша
            return calendarData; // Возвращаем то, что есть
        }
        
        const apiData = await response.json();
        logger.info('📅 Отримано даних з API:', apiData.length);
        
        // Находим только новые и измененные задачи
        const { newTasks, rescheduledTasks } = findChangedTasks(apiData, existingTasks);
        logger.info(`📊 Аналіз змін: ${newTasks.length} нових, ${rescheduledTasks.length} перенесених`);
        
        // Сохраняем только изменения
        if (newTasks.length > 0 || rescheduledTasks.length > 0) {
            logger.info('💾 Зберігаємо зміни в Firebase...');
            await saveOnlyChanges(newTasks, rescheduledTasks);
            
            // Загружаем обновленные данные из Firebase, чтобы получить единый источник правды
            calendarData = await loadTasksFromFirebase();
            logger.info('📥 Завантажено оновлені дані з Firebase:', calendarData.length);
        } else {
            // Если изменений нет, используем существующие данные
            logger.info('🔄 Змін не знайдено, використовуємо кеш');
            calendarData = existingTasks;
        }

        // Обновляем аналитику
        await updateTaskAnalytics();
        
        logger.info('✅ Завантаження календаря завершено');
        logger.info('📊 Фінальні дані календаря:', calendarData.length);
        
        // Возвращаем финальный массив данных
        return calendarData;
        
    } catch (error) {
        logger.error('❌ Помилка завантаження даних календаря:', error);
        // В случае ошибки пытаемся вернуть хотя бы кэшированные данные
        calendarData = await loadTasksFromFirebase();
        return calendarData; // Возвращаем кэш или пустой массив
    }
}

/**
 * Находит новые и измененные задачи
 */
function findChangedTasks(apiData, existingTasks) {
    const newTasks = [];
    const rescheduledTasks = [];
    const unchangedTasks = [];
    
    logger.verbose(`🔍 Порівняння: ${apiData.length} API завдань з ${existingTasks.length} Firebase завданнями`);
    
    for (const apiTask of apiData) {
        // Ищем существующую задачу по ID
        const existingTask = existingTasks.find(task => task.ID === apiTask.ID);
        
        if (!existingTask) {
            // Новая задача
            newTasks.push(apiTask);
        } else {
            // Порівнюємо дати з точністю до хвилини
            const existingDate = new Date(existingTask.Дата);
            const newDate = new Date(apiTask.Дата);
            const existingTime = existingDate.getTime();
            const newTime = newDate.getTime();
            
            if (Math.abs(existingTime - newTime) > 60000) { // Різниця більше 1 хвилини
                // Перенесенная задача
                rescheduledTasks.push({
                    old: existingTask,
                    new: apiTask
                });
            } else {
                // Без изменений
                unchangedTasks.push(apiTask);
            }
        }
    }
    
    logger.info(`📊 Результат аналізу: ${newTasks.length} нових, ${rescheduledTasks.length} перенесених, ${unchangedTasks.length} без змін`);
    
    // Логуємо приклади нових завдань
    if (newTasks.length > 0) {
        logger.verbose('🆕 Приклади нових завдань:', newTasks.slice(0, 3).map(t => ({ ID: t.ID, Менеджер: t.Менеджер, Дата: t.Дата })));
    }
    
    // Логуємо приклади перенесених завдань
    if (rescheduledTasks.length > 0) {
        logger.verbose('🔄 Приклади перенесених завдань:', rescheduledTasks.slice(0, 3).map(t => ({ ID: t.new.ID, Менеджер: t.new.Менеджер, oldDate: t.old.Дата, newDate: t.new.Дата })));
    }
    
    return { newTasks, rescheduledTasks, unchangedTasks };
}

/**
 * Сохраняет только изменения в Firebase
 */
async function saveOnlyChanges(newTasks, rescheduledTasks) {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            logger.error('❌ ID компанії не знайдено');
            return;
        }
        
        let savedCount = 0;
        const totalChanges = newTasks.length + rescheduledTasks.length;
        
        if (totalChanges === 0) {
            logger.info('📝 Змін для збереження не знайдено');
            return;
        }
        
        logger.info(`📝 Зберігаємо ${totalChanges} змін...`);
        logger.info(`🆕 Нових завдань: ${newTasks.length}`);
        logger.info(`🔄 Перенесених завдань: ${rescheduledTasks.length}`);
        
        // Сохраняем новые задачи
        for (const task of newTasks) {
            try {
                const success = await saveTaskToFirebase(task);
                if (success) {
                    savedCount++;
                }
            } catch (error) {
                logger.error('❌ Помилка збереження нової задачі:', task.ID, error);
            }
        }
        
        // Обновляем перенесенные задачи
        for (const { new: task } of rescheduledTasks) {
            try {
                const success = await saveTaskToFirebase(task);
                if (success) {
                    savedCount++;
                }
            } catch (error) {
                logger.error('❌ Помилка оновлення перенесеної задачі:', task.ID, error);
            }
        }
        
        logger.info(`✅ Збережено ${savedCount}/${totalChanges} змін`);
        
    } catch (error) {
        logger.error('❌ Помилка збереження змін:', error);
    }
}

/**
 * Инициализация модуля календаря
 */
export function initManagerCalendarModule(container) {
    if (isCalendarInited) {
        logger.verbose('📅 Модуль календаря уже инициализирован');
        return;
    }
    
    // Проверяем права доступа
    const currentUserPermissions = window.state?.currentUserPermissions || {};
    if (!currentUserPermissions['manager_calendar_view_page']) {
        logger.warn('⚠️ Немає прав доступу до календаря менеджера');
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <div class="text-center py-8">
                    <div class="text-red-500 text-6xl mb-4">🚫</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Доступ заборонено</h2>
                    <p class="text-gray-600">У вас немає прав для перегляду календаря менеджера.</p>
                    <p class="text-sm text-gray-500 mt-2">Зверніться до адміністратора для отримання доступу.</p>
                </div>
            </div>
        `;
        return;
    }
    
    logger.info('🚀 Инициализация модуля календаря менеджера...');
    
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Календар менеджера</h2>
                <div class="flex items-center gap-4">
                    <button id="calendar-auto-update-toggle" class="btn btn-sm btn-secondary">
                        Автообновление
                    </button>
                </div>
            </div>
            
            <!-- Вкладки -->
            <div class="mb-6">
                <div class="border-b border-gray-200">
                    <nav class="-mb-px flex space-x-8">
                        <button id="calendar-tab-btn" class="border-b-2 border-blue-500 py-2 px-1 text-sm font-medium text-blue-600">
                            📅 Календар
                        </button>
                        <button id="reports-tab-btn" class="border-b-2 border-transparent py-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                            📊 Звіти
                        </button>
                    </nav>
                </div>
            </div>
            
            <!-- Контент вкладки календаря -->
            <div id="calendar-tab-content">
                <!-- Фильтры -->
                <div id="calendar-filters" class="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Відділ</label>
                        <select id="calendar-department-filter" class="w-full p-2 border border-gray-300 rounded-lg">
                            <option value="">Всі відділи</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Менеджер</label>
                        <select id="calendar-manager-filter" class="w-full p-2 border border-gray-300 rounded-lg">
                            <option value="">Всі менеджери</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Період</label>
                        <div class="flex gap-2">
                            <button id="calendar-prev-month" class="btn btn-sm btn-secondary">‹</button>
                            <span id="calendar-current-month" class="flex-1 text-center py-2 font-medium">
                                ${getMonthName(currentMonth)} ${currentYear}
                            </span>
                            <button id="calendar-next-month" class="btn btn-sm btn-secondary">›</button>
                        </div>
                    </div>
                </div>
                
                <!-- Аналитика -->
                <div id="calendarAnalytics" class="mb-6">
                    <!-- Статистика -->
                    <div class="bg-gray-50 p-4 rounded-lg mb-4">
                        <h3 class="text-lg font-semibold mb-4">📊 Статистика завдань</h3>
                        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div class="bg-blue-100 p-3 rounded-lg text-center">
                                <div class="text-2xl font-bold text-blue-600" id="total-tasks">0</div>
                                <div class="text-sm text-blue-600">Всього завдань</div>
                            </div>
                            <div class="bg-green-100 p-3 rounded-lg text-center">
                                <div class="text-2xl font-bold text-green-600" id="new-tasks">0</div>
                                <div class="text-sm text-green-600">Нових завдань</div>
                            </div>
                            <div class="bg-yellow-100 p-3 rounded-lg text-center">
                                <div class="text-2xl font-bold text-yellow-600" id="rescheduled-tasks">0</div>
                                <div class="text-sm text-yellow-600">Перенесених</div>
                            </div>
                            <div class="bg-purple-100 p-3 rounded-lg text-center">
                                <div class="text-2xl font-bold text-purple-600" id="active-managers">0</div>
                                <div class="text-sm text-purple-600">Активних менеджерів</div>
                            </div>
                            <div class="bg-indigo-100 p-3 rounded-lg text-center">
                                <div class="text-2xl font-bold text-indigo-600" id="total-clients">0</div>
                                <div class="text-sm text-indigo-600">Клієнтів</div>
                            </div>
                        </div>
                    </div>
                    <!-- Аналитика будет загружена динамически -->
                </div>
                
                <!-- Календар -->
                <div id="calendar-container" class="mb-6">
                    <div class="text-center py-8">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p class="mt-4 text-gray-600">Завантаження календаря...</p>
                    </div>
                </div>
            </div>
            
            <!-- Контент вкладки звітов -->
            <div id="reports-tab-content" class="hidden">
                <div class="space-y-6">
                    <!-- Статистика -->
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="text-lg font-semibold mb-4">📊 Статистика завдань</h3>
                        <div id="reports-stats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <!-- Статистика будет загружена динамически -->
                        </div>
                    </div>
                    
                    <!-- Новые задачи -->
                    <div class="bg-white border rounded-lg">
                        <div class="p-4 border-b">
                            <h3 class="text-lg font-semibold text-green-600">🆕 Нові завдання</h3>
                        </div>
                        <div id="new-tasks-list" class="p-4">
                            <!-- Список новых задач -->
                        </div>
                    </div>
                    
                    <!-- Перенесенные задачи -->
                    <div class="bg-white border rounded-lg">
                        <div class="p-4 border-b">
                            <h3 class="text-lg font-semibold text-yellow-600">🔄 Перенесені завдання</h3>
                        </div>
                        <div id="rescheduled-tasks-list" class="p-4">
                            <!-- Список перенесенных задач -->
                        </div>
                    </div>
                    
                    <!-- Действия -->
                    <div class="flex gap-2">
                        <button id="clear-task-history" class="btn btn-sm btn-secondary">
                            🗑️ Очистити історію
                        </button>
                        <button id="export-reports" class="btn btn-sm btn-primary">
                            📤 Експорт звіту
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Модальное окно детализации будет создаваться динамически -->
    `;
    
    setupCalendarEventHandlers(container);
    loadInitialData();
    
    // Проверяем, что элементы статистики отрендерены
    setTimeout(() => {
        const analyticsContainer = document.getElementById('calendarAnalytics');
        if (analyticsContainer) {
            const elements = ['total-tasks', 'active-managers', 'total-clients', 'new-tasks', 'rescheduled-tasks'];
            elements.forEach(id => {
                const element = analyticsContainer.querySelector(`#${id}`);
                logger.info(`🔍 Елемент ${id} після ініціалізації:`, element ? 'знайдено' : 'не знайдено');
            });
        }
    }, 100);
    
    isCalendarInited = true;
    logger.info('✅ Модуль календаря инициализирован');
}

/**
 * Настройка обработчиков событий
 */
function setupCalendarEventHandlers(container) {
    const departmentFilter = container.querySelector('#calendar-department-filter');
    const managerFilter = container.querySelector('#calendar-manager-filter');
    const prevMonthBtn = container.querySelector('#calendar-prev-month');
    const nextMonthBtn = container.querySelector('#calendar-next-month');
    const autoUpdateToggle = container.querySelector('#calendar-auto-update-toggle');
    
    // Вкладки
    const calendarTabBtn = container.querySelector('#calendar-tab-btn');
    const reportsTabBtn = container.querySelector('#reports-tab-btn');
    const calendarTabContent = container.querySelector('#calendar-tab-content');
    const reportsTabContent = container.querySelector('#reports-tab-content');
    
    // Переключение вкладок
    calendarTabBtn.addEventListener('click', () => {
        calendarTabBtn.classList.add('border-blue-500', 'text-blue-600');
        calendarTabBtn.classList.remove('border-transparent', 'text-gray-500');
        reportsTabBtn.classList.remove('border-blue-500', 'text-blue-600');
        reportsTabBtn.classList.add('border-transparent', 'text-gray-500');
        
        calendarTabContent.classList.remove('hidden');
        reportsTabContent.classList.add('hidden');
    });
    
    reportsTabBtn.addEventListener('click', () => {
        reportsTabBtn.classList.add('border-blue-500', 'text-blue-600');
        reportsTabBtn.classList.remove('border-transparent', 'text-gray-500');
        calendarTabBtn.classList.remove('border-blue-500', 'text-blue-600');
        calendarTabBtn.classList.add('border-transparent', 'text-gray-500');
        
        reportsTabContent.classList.remove('hidden');
        calendarTabContent.classList.add('hidden');
        
        // Загружаем отчеты при переключении
        renderReportsTab();
    });
    
    // Фильтры
    departmentFilter.addEventListener('change', () => {
        selectedDepartment = departmentFilter.value;
        updateManagerFilter();
        renderCalendar();
    });
    
    managerFilter.addEventListener('change', () => {
        selectedManager = managerFilter.value;
        renderCalendar();
    });
    
    // Навигация по месяцам
    prevMonthBtn.addEventListener('click', () => {
        if (currentMonth === 0) {
            currentMonth = 11;
            currentYear--;
        } else {
            currentMonth--;
        }
        updateMonthDisplay();
        renderCalendar();
    });
    
    nextMonthBtn.addEventListener('click', () => {
        if (currentMonth === 11) {
            currentMonth = 0;
            currentYear++;
        } else {
            currentMonth++;
        }
        updateMonthDisplay();
        renderCalendar();
    });
    
    // Автообновление
    autoUpdateToggle.addEventListener('click', () => {
        isAutoUpdateEnabled = !isAutoUpdateEnabled;
        if (isAutoUpdateEnabled) {
            startAutoUpdate();
            autoUpdateToggle.textContent = 'Автооновлення';
            autoUpdateToggle.classList.remove('btn-danger');
            autoUpdateToggle.classList.add('btn-secondary');
        } else {
            stopAutoUpdate();
            autoUpdateToggle.textContent = 'Увімкнути';
            autoUpdateToggle.classList.remove('btn-secondary');
            autoUpdateToggle.classList.add('btn-danger');
        }
    });
    
    // Закрытие модального окна (только если элемент существует)
    const modalElement = container.querySelector('#calendar-detail-modal');
    if (modalElement) {
        modalElement.addEventListener('click', (e) => {
            if (e.target.id === 'calendar-detail-modal') {
                e.target.classList.add('hidden');
            }
        });
    }
    
    // Закрытие по кнопке X (только если элемент существует)
    const closeButton = container.querySelector('#detail-modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            const modal = container.querySelector('#calendar-detail-modal');
            if (modal) {
                modal.classList.add('hidden');
            }
        });
    }
    
    // Обработчики для отчетов
    const clearHistoryBtn = container.querySelector('#clear-task-history');
    const exportReportsBtn = container.querySelector('#export-reports');
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearTaskHistory);
    }
    
    if (exportReportsBtn) {
        exportReportsBtn.addEventListener('click', exportReports);
    }
}

/**
 * Загрузка начальных данных
 */
async function loadInitialData() {
    try {
        showLoadingAnimation();
        updateLoadingProgress(1, 4, 'Завантаження співробітників...');
        
        const { managers, departments } = await loadEmployeesAndDepartments();
        managersData = managers;
        departmentsData = departments;
        
        logger.info('👥 Завантажено співробітників:', managers.length);
        logger.info('🏢 Завантажено відділів:', departments.length);
        
        updateLoadingProgress(2, 4, 'Завантаження даних календаря...');
        
        // Ждем получения актуальных данных календаря
        const loadedCalendarData = await loadCalendarData();
        
        // Проверяем, что данные действительно загружены
        if (loadedCalendarData && loadedCalendarData.length > 0) {
            logger.info('🎨 Дані готові, рендеримо інтерфейс...');
            updateLoadingProgress(3, 4, 'Рендеринг фільтрів та календаря...');
            
            // Теперь вызываем рендеринг, будучи уверенными, что `calendarData` заполнена
            renderFilters(); 
            renderCalendar();
            
            // Проверяем, что элементы статистики отрендерены после renderCalendar
            setTimeout(() => {
                const analyticsContainer = document.getElementById('calendarAnalytics');
                if (analyticsContainer) {
                    const elements = ['total-tasks', 'active-managers', 'total-clients', 'new-tasks', 'rescheduled-tasks'];
                    elements.forEach(id => {
                        const element = analyticsContainer.querySelector(`#${id}`);
                        logger.info(`🔍 Елемент ${id} після renderCalendar:`, element ? 'знайдено' : 'не знайдено');
                    });
                }
            }, 100);
            
            logger.info('🔄 Запускаємо автооновлення...');
            startAutoUpdate();
            
            updateLoadingProgress(4, 4, 'Завершення...');
            
            setTimeout(() => {
                hideLoadingAnimation();
                showNotification('Календар успішно завантажено!', 'success');
            }, 500);

        } else {
            logger.error('❌ Помилка: дані календаря не завантажено або вони порожні');
            hideLoadingAnimation();
            showCalendarError('Не вдалося завантажити дані для календаря. Спробуйте оновити сторінку.');
        }
        
    } catch (error) {
        logger.error('❌ Ошибка загрузки начальных данных:', error);
        hideLoadingAnimation();
        showCalendarError('Помилка ініціалізації модуля.');
    }
}

/**
 * Загрузка сотрудников и отделов
 */
async function loadEmployeesAndDepartments() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
            logger.error('❌ ID компанії не знайдено');
            return { managers: [], departments: [] };
        }
        
        logger.info('👥 Завантаження співробітників та відділів...');
        logger.info('🏢 Company ID:', companyId);

        // Используем данные из window.state как в основном приложении
        const allEmployees = window.state?.allEmployees || [];
        const departments = window.state?.departments || [];
        
        logger.info('👥 Всі співробітники:', allEmployees.length);
        logger.info('🏢 Всі відділи:', departments.length);

        // Фильтруем менеджеров по критериям (как в сигнализации)
        const managers = allEmployees.filter(emp => {
            if (emp.role === 'manager') return true;
            if (emp.position) {
                const position = emp.position.toLowerCase();
                return position.includes('менеджер') || 
                       position.includes('manager') || 
                       position.includes('sales') ||
                       position.includes('продаж');
            }
            return false;
        });
        
        logger.info('👤 Відфільтровані менеджери:', managers.length);

        // Если не нашли менеджеров по критериям, используем всех сотрудников
        if (managers.length === 0) {
            logger.warn('🔍 Менеджери не знайдені за критеріями, використовуємо всіх співробітників');
            return {
                managers: allEmployees,
                departments: departments
            };
        }
        
        logger.info('✅ Завантаження співробітників завершено');
        return { managers, departments };
        
    } catch (error) {
        logger.error('❌ Ошибка загрузки сотрудников и отделов:', error);
        return { managers: [], departments: [] };
    }
}

/**
 * Рендеринг фильтров
 */
function renderFilters() {
    const departmentFilter = document.getElementById('calendar-department-filter');
    const managerFilter = document.getElementById('calendar-manager-filter');
    
    logger.info('🎨 Рендеринг фільтрів...');
    
    if (!departmentFilter || !managerFilter) {
        logger.error('❌ Фільтри не знайдено');
        return;
    }
    
    // Отделы
    departmentFilter.innerHTML = '<option value="">Всі відділи</option>';
    departmentsData.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        departmentFilter.appendChild(option);
    });
    
    // --- ВАЖНЫЕ ДОБАВЛЕНИЯ ---
    // Принудительно сбрасываем состояние фильтров перед первой отрисовкой
    departmentFilter.value = '';
    selectedDepartment = ''; 
    logger.info('🔩 Стан фільтра відділу примусово скинуто.');
    // -------------------------

    // Менеджеры (теперь вызовется с гарантированно правильным selectedDepartment)
    updateManagerFilter();
    
    logger.info('✅ Фільтри відрендерено');
}

/**
 * Обновление фильтра менеджеров
 */
function updateManagerFilter() {
    const managerFilter = document.getElementById('calendar-manager-filter');
    if (!managerFilter) {
        logger.warn('⚠️ Фільтр менеджерів не знайдено');
        return;
    }
    
    logger.info('👤 Оновлення фільтра менеджерів...');
    logger.info('🏢 Вибраний відділ:', selectedDepartment);
    
    // Очищаем текущие опции
    managerFilter.innerHTML = '<option value="">Всі менеджери</option>';
    
    // Если выбрано "Все отделы" или ничего не выбрано, показываем всех менеджеров
    if (!selectedDepartment || selectedDepartment === '') {
        logger.info('👥 Показуємо всіх менеджерів');
        managersData.forEach(manager => {
            const option = document.createElement('option');
            option.value = manager.id;
            option.textContent = manager.name;
            managerFilter.appendChild(option);
        });
    } else {
        // Показываем только менеджеров выбранного отдела
        const departmentName = departmentsData.find(d => d.id === selectedDepartment)?.name;
        logger.info('🏢 Фільтруємо по відділу:', departmentName);
        
        const filteredManagers = managersData.filter(manager => {
            return manager.department === selectedDepartment || 
                   manager.departmentName === departmentName;
        });
        
        logger.info('👥 Знайдено менеджерів у відділі:', filteredManagers.length);
        
        filteredManagers.forEach(manager => {
            const option = document.createElement('option');
            option.value = manager.id;
            option.textContent = manager.name;
            managerFilter.appendChild(option);
        });
    }
    
    // Сбрасываем выбранного менеджера при смене отдела
    selectedManager = '';
    managerFilter.value = '';
    
    logger.info('✅ Фільтр менеджерів оновлено');
}

/**
 * Рендеринг календаря
 */
function renderCalendar() {
    logger.info('🎨 Рендеринг календаря...');
    
    const container = document.getElementById('calendar-container');
    if (!container) {
        logger.error('❌ Контейнер календаря не знайдено');
        return;
    }
    
    const filteredData = getFilteredData();
    logger.info('📊 Дані для рендерингу:', filteredData.length);
    
    if (filteredData.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">📅</div>
                <p class="text-gray-600 text-lg">Немає завдань для відображення</p>
                <p class="text-gray-500 text-sm mt-2">Спробуйте змінити фільтри або період</p>
            </div>
        `;
        
        // Обновляем статистику с задержкой
        setTimeout(() => {
            const analyticsContainer = document.getElementById('calendarAnalytics');
            logger.info('🔍 Перевіряємо контейнер calendarAnalytics (немає даних):', analyticsContainer);
            
            if (analyticsContainer) {
                logger.info('✅ Контейнер calendarAnalytics знайдено (немає даних)');
                updateStatistics(filteredData);
            } else {
                logger.warn('⚠️ Контейнер calendarAnalytics не знайдено, пропускаємо оновлення статистики');
            }
        }, 500);
        
        return;
    }
    
    const days = generateCalendarDays();
    const calendarHTML = `
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <!-- Заголовки дней недели -->
            <div class="grid grid-cols-7 bg-gray-50 border-b">
                <div class="p-3 text-center text-sm font-medium text-gray-500">Нед</div>
                <div class="p-3 text-center text-sm font-medium text-gray-500">Пон</div>
                <div class="p-3 text-center text-sm font-medium text-gray-500">Вів</div>
                <div class="p-3 text-center text-sm font-medium text-gray-500">Сер</div>
                <div class="p-3 text-center text-sm font-medium text-gray-500">Чет</div>
                <div class="p-3 text-center text-sm font-medium text-gray-500">П'ят</div>
                <div class="p-3 text-center text-sm font-medium text-gray-500">Суб</div>
            </div>
            
            <!-- Дни календаря -->
            <div class="grid grid-cols-7">
                ${days.map(date => renderCalendarDay(date, filteredData)).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = calendarHTML;
    
    // Обновляем статистику с использованием requestAnimationFrame для лучшей синхронизации с DOM
    requestAnimationFrame(() => {
        // Проверяем, что контейнер calendarAnalytics существует
        const analyticsContainer = document.getElementById('calendarAnalytics');
        logger.info('🔍 Перевіряємо контейнер calendarAnalytics:', analyticsContainer);
        
        if (analyticsContainer) {
            logger.info('✅ Контейнер calendarAnalytics знайдено');
            // Проверяем наличие элементов статистики
            const elements = ['total-tasks', 'active-managers', 'total-clients', 'new-tasks', 'rescheduled-tasks'];
            elements.forEach(id => {
                const element = analyticsContainer.querySelector(`#${id}`);
                logger.info(`🔍 Елемент ${id}:`, element ? 'знайдено' : 'не знайдено');
            });
            updateStatistics(filteredData);
        } else {
            logger.warn('⚠️ Контейнер calendarAnalytics не знайдено, пропускаємо оновлення статистики');
        }
    });
    
    logger.info('✅ Календар відрендерено');
}

/**
 * Получение отфильтрованных данных
 */
function getFilteredData() {
    let filtered = calendarData;
    
    logger.info('🔍 Фільтрація даних...');
    logger.info('📊 Початкові дані:', filtered.length);
    
    // Проверяем права доступа
    const currentUserPermissions = window.state?.currentUserPermissions || {};
    const currentUserId = window.state?.currentUserId;
    const currentEmployee = window.state?.allEmployees?.find(emp => emp.id === currentUserId);
    
    logger.info('👤 Поточний користувач:', currentEmployee?.name);
    logger.info('🔑 Права доступу:', Object.keys(currentUserPermissions).filter(key => key.includes('manager_calendar')));
    
    // Фильтрация по правам доступа - если нет специальных прав, показываем все
    const hasSpecificPermissions = currentUserPermissions['manager_calendar_view_own_tasks'] || 
                                 currentUserPermissions['manager_calendar_view_department_tasks'];
    
    if (hasSpecificPermissions && !currentUserPermissions['manager_calendar_view_all_tasks']) {
        if (currentUserPermissions['manager_calendar_view_own_tasks']) {
            // Показываем только свои задачи
            filtered = filtered.filter(item => 
                item.Менеджер.toLowerCase().includes(currentEmployee?.name?.toLowerCase() || '') // Використовуємо правильне поле
            );
            logger.info('👤 Після фільтрації по власних завданнях:', filtered.length);
        } else if (currentUserPermissions['manager_calendar_view_department_tasks']) {
            // Показываем задачи своего отдела
            const userDepartment = currentEmployee?.department;
            if (userDepartment) {
                filtered = filtered.filter(item => item.departmentName === userDepartment); // Використовуємо правильне поле
            }
            logger.info('🏢 Після фільтрації по відділу:', filtered.length);
        }
    } else {
        logger.info('✅ Маємо права на перегляд всіх завдань або немає спеціальних обмежень');
    }
    
    // Фильтр по отделу
    if (selectedDepartment) {
        const departmentName = departmentsData.find(d => d.id === selectedDepartment)?.name;
        if (departmentName) {
            filtered = filtered.filter(item => item.departmentName === departmentName); // Використовуємо правильне поле
            logger.info('🏢 Після фільтрації по вибраному відділу:', filtered.length);
        }
    }
    
    // Фильтр по менеджеру
    if (selectedManager) {
        const managerName = managersData.find(m => m.id === selectedManager)?.name;
        if (managerName) {
            filtered = filtered.filter(item => 
                item.Менеджер.toLowerCase().includes(managerName.toLowerCase()) // Використовуємо правильне поле
            );
            logger.info('👤 Після фільтрації по вибраному менеджеру:', filtered.length);
        }
    }
    
    logger.info('📊 Фінальні відфільтровані дані:', filtered.length);
    return filtered;
}

/**
 * Генерация дней календаря
 */
function generateCalendarDays() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDate = new Date(startDate);
    
    // Генерируем ровно 6 недель (42 дня) для стабильной сетки
    for (let i = 0; i < 42; i++) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    logger.info('📅 Згенеровано днів календаря:', days.length);
    logger.info('📅 Поточний місяць/рік:', currentMonth + 1, currentYear);
    
    return days;
}

/**
 * Рендеринг дня календаря
 */
function renderCalendarDay(date, filteredData) {
    const isCurrentMonth = date.getMonth() === currentMonth;
    const isToday = date.toDateString() === new Date().toDateString();
    
    const dayData = filteredData.filter(item => {
        const itemDate = new Date(item.Дата); // Використовуємо правильне поле
        return itemDate.toDateString() === date.toDateString();
    });
    
    const taskCount = dayData.length;
    const uniqueManagers = new Set(dayData.map(item => item.Менеджер)).size; // Використовуємо правильне поле
    const uniqueClients = new Set(dayData.map(item => item['Клиент.Код'])).size; // Використовуємо правильне поле
    
    // Подсчитываем статусы задач
    const newTasksCount = dayData.filter(item => item.status === 'new').length;
    const rescheduledTasksCount = dayData.filter(item => item.status === 'rescheduled').length;
    const activeTasksCount = dayData.filter(item => !item.status || item.status === 'active').length;
    
    let backgroundColor = 'bg-white';
    let textColor = 'text-gray-900';
    let statusIndicator = '';
    
    if (taskCount > 0) {
        if (taskCount >= 10) {
            backgroundColor = 'bg-red-100';
            textColor = 'text-red-800';
        } else if (taskCount >= 5) {
            backgroundColor = 'bg-yellow-100';
            textColor = 'text-yellow-800';
        } else {
            backgroundColor = 'bg-green-100';
            textColor = 'text-green-800';
        }
        
        // Добавляем индикаторы статуса
        if (newTasksCount > 0) {
            statusIndicator += `<div class="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" title="Нові: ${newTasksCount}"></div>`;
        }
        if (rescheduledTasksCount > 0) {
            statusIndicator += `<div class="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1" title="Перенесені: ${rescheduledTasksCount}"></div>`;
        }
    }
    
    if (!isCurrentMonth) {
        backgroundColor = 'bg-gray-50';
        textColor = 'text-gray-400';
    }
    
    if (isToday) {
        backgroundColor = 'bg-blue-100';
        textColor = 'text-blue-800';
    }
    
    // Логуємо тільки дні з завданнями
    if (taskCount > 0) {
        logger.info(`📅 ${date.toDateString()}: ${taskCount} завдань (${newTasksCount} нових, ${rescheduledTasksCount} перенесених), ${uniqueManagers} менеджерів, ${uniqueClients} клієнтів`);
    }
    
    return `
        <div class="${backgroundColor} p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors"
             onclick="showDayDetails('${date.toISOString()}', ${taskCount})">
            <div class="text-sm ${textColor} font-medium mb-1">
                ${date.getDate()}
            </div>
            ${taskCount > 0 ? `
                <div class="text-xs ${textColor}">
                    <div class="font-medium">${taskCount} справ</div>
                    ${newTasksCount > 0 ? `<div class="text-green-600">🆕 ${newTasksCount} нових</div>` : ''}
                    ${rescheduledTasksCount > 0 ? `<div class="text-yellow-600">🔄 ${rescheduledTasksCount} перенесених</div>` : ''}
                    <div class="text-xs opacity-75">${uniqueManagers} менеджерів</div>
                    <div class="text-xs opacity-75">${uniqueClients} клієнтів</div>
                    ${statusIndicator ? `<div class="mt-1">${statusIndicator}</div>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Показ детализации дня
 */
function showDayDetails(dateString, taskCount) {
    if (taskCount === 0) return;
    
    logger.info('📅 Показ деталізації для:', dateString, 'завдань:', taskCount);
    
    const date = new Date(dateString);
    const dayData = getFilteredData().filter(item => {
        const itemDate = new Date(item.Дата); // Використовуємо правильне поле
        return itemDate.toDateString() === date.toDateString();
    });
    
    logger.info('📊 Знайдено завдань для дня:', dayData.length);
    
    // Удаляем существующее модальное окно если есть
    const existingModal = document.querySelector('#calendar-detail-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Создаем модальное окно динамически
    const modal = document.createElement('div');
    modal.id = 'calendar-detail-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // Группировка по статусам задач
    const groupedByStatus = {
        new: [],
        rescheduled: [],
        active: []
    };
    
    dayData.forEach(item => {
        const status = item.status || 'active';
        if (groupedByStatus[status]) {
            groupedByStatus[status].push(item);
        } else {
            groupedByStatus.active.push(item);
        }
    });
    
    let contentHTML = '';
    
    // Сначала показываем новые задачи
    if (groupedByStatus.new.length > 0) {
        contentHTML += `
            <div class="mb-6">
                <details class="group" open>
                    <summary class="text-lg font-bold text-green-700 mb-3 flex items-center cursor-pointer hover:text-green-600">
                        <span class="mr-2">🆕</span> Нові завдання (${groupedByStatus.new.length})
                        <svg class="w-5 h-5 ml-auto transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </summary>
                    ${renderTasksByManager(groupedByStatus.new)}
                </details>
            </div>
        `;
    }
    
    // Затем перенесенные задачи
    if (groupedByStatus.rescheduled.length > 0) {
        contentHTML += `
            <div class="mb-6">
                <details class="group" open>
                    <summary class="text-lg font-bold text-yellow-700 mb-3 flex items-center cursor-pointer hover:text-yellow-600">
                        <span class="mr-2">🔄</span> Перенесені завдання (${groupedByStatus.rescheduled.length})
                        <svg class="w-5 h-5 ml-auto transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </summary>
                    ${renderTasksByManager(groupedByStatus.rescheduled)}
                </details>
            </div>
        `;
    }
    
    // Затем активные задачи
    if (groupedByStatus.active.length > 0) {
        contentHTML += `
            <div class="mb-6">
                <details class="group" open>
                    <summary class="text-lg font-bold text-blue-700 mb-3 flex items-center cursor-pointer hover:text-blue-600">
                        <span class="mr-2">✅</span> Активні завдання (${groupedByStatus.active.length})
                        <svg class="w-5 h-5 ml-auto transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </summary>
                    ${renderTasksByManager(groupedByStatus.active)}
                </details>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">Деталізація за ${date.toLocaleDateString('uk-UA')} (${taskCount} справ)</h3>
                <button onclick="this.closest('#calendar-detail-modal').remove()" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div>${contentHTML}</div>
        </div>
    `;
    
    // Добавляем обработчик закрытия по клику вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
    
    logger.info('✅ Деталізація відображена');
}

/**
 * Рендеринг задач по менеджерам
 */
function renderTasksByManager(tasks) {
    // Группировка по менеджерам
    const groupedByManager = {};
    tasks.forEach(item => {
        const manager = item.Менеджер; // Використовуємо правильне поле
        if (!groupedByManager[manager]) {
            groupedByManager[manager] = [];
        }
        groupedByManager[manager].push(item);
    });
    
    // Сортируем задачи по времени
    Object.keys(groupedByManager).forEach(manager => {
        groupedByManager[manager].sort((a, b) => {
            const timeA = new Date(a.Дата).getTime(); // Використовуємо правильне поле
            const timeB = new Date(b.Дата).getTime(); // Використовуємо правильне поле
            return timeA - timeB;
        });
    });
    
    let managerHTML = '';
    
    Object.keys(groupedByManager).forEach(manager => {
        const managerTasks = groupedByManager[manager];
        const uniqueClients = new Set(managerTasks.map(task => task['Клиент.Код'])).size;
        
        managerHTML += `
            <div class="mb-4 border-l-4 border-gray-300 pl-4">
                <details class="group">
                    <summary class="font-semibold text-gray-800 mb-2 flex items-center cursor-pointer hover:text-gray-600">
                        <span class="mr-2">👤</span> ${manager} (${managerTasks.length} завдань, ${uniqueClients} клієнтів)
                        <svg class="w-4 h-4 ml-auto transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </summary>
                    <div class="space-y-2 ml-4">
        `;
        
        managerTasks.forEach(task => {
            const taskTime = new Date(task.Дата).toLocaleTimeString('uk-UA', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Определяем статус задачи
            let statusClass = 'border-l-4 border-gray-300';
            let statusText = '✅ Активна';
            
            if (task.status === 'new') {
                statusClass = 'border-l-4 border-green-500';
                statusText = '🆕 Нова';
            } else if (task.status === 'rescheduled') {
                statusClass = 'border-l-4 border-yellow-500';
                statusText = '🔄 Перенесена';
            }
            
            // Формируем ссылку на CRM
            const crmLink = task['Клиент.Ссылка'] ? 
                `<a href="${task['Клиент.Ссылка']}" target="_blank" class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                    </svg>
                    CRM
                </a>` : 
                '';
            
            managerHTML += `
                <div class="${statusClass} pl-3 py-2 bg-gray-50 rounded">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="font-medium text-gray-800">${task.Дело}</div>
                            <div class="text-sm text-gray-600">${task['Клиент.Название']}</div>
                            <div class="text-xs text-gray-500">${statusText}</div>
                            ${crmLink ? `<div class="mt-1">${crmLink}</div>` : ''}
                        </div>
                        <div class="text-sm font-medium text-gray-700">${taskTime}</div>
                    </div>
                </div>
            `;
        });
        
        managerHTML += `
                    </div>
                </details>
            </div>
        `;
    });
    
    return managerHTML;
}

/**
 * Обновление статистики
 */
function updateStatistics(filteredData, retryCount = 0) {
    logger.info('📊 Оновлення статистики...');
    
    if (!filteredData || filteredData.length === 0) {
        logger.info('📊 Немає даних для статистики');
        return;
    }
    
    // Ограничиваем количество попыток
    if (retryCount > 10) {
        logger.error('❌ Досягнуто максимальну кількість спроб оновлення статистики');
        return;
    }
    
    // Подсчет статистики
    const totalTasks = filteredData.length;
    const activeManagers = new Set(filteredData.map(item => item.Менеджер)).size;
    const totalClients = new Set(filteredData.map(item => item['Клиент.Код'])).size;
    const newTasksCount = newTasks.size;
    const rescheduledTasksCount = rescheduledTasks.size;
    
    logger.info('📊 Розрахована статистика:', {
        totalTasks,
        activeManagers,
        totalClients,
        newTasksCount,
        rescheduledTasksCount
    });
    
    // Элементы для обновления
    const elements = {
        'total-tasks': totalTasks,
        'active-managers': activeManagers,
        'total-clients': totalClients,
        'new-tasks': newTasksCount,
        'rescheduled-tasks': rescheduledTasksCount
    };
    
    // Проверяем, что все элементы существуют в calendarAnalytics контейнере
    const analyticsContainer = document.getElementById('calendarAnalytics');
    if (!analyticsContainer) {
        logger.warn('⚠️ Контейнер calendarAnalytics не знайдено');
        return;
    }
    
    // Убеждаемся, что все элементы статистики существуют
    if (!ensureStatisticsElements()) {
        logger.warn('⚠️ Не удалось создать элементы статистики');
        if (retryCount < 10) {
            setTimeout(() => {
                updateStatistics(filteredData, retryCount + 1);
            }, 100);
        }
        return;
    }
    
    // Обновляем элементы с проверкой существования
    Object.keys(elements).forEach(id => {
        const element = analyticsContainer.querySelector(`#${id}`);
        if (element) {
            element.textContent = elements[id];
            logger.info(`✅ Оновлено ${id}: ${elements[id]}`);
        } else {
            logger.warn(`⚠️ Елемент статистики не знайдено: ${id}`);
        }
    });
    
    logger.info('✅ Статистика оновлена');
}

/**
 * Обновление отображения месяца
 */
function updateMonthDisplay() {
    const monthDisplay = document.getElementById('calendar-current-month');
    if (monthDisplay) {
        monthDisplay.textContent = `${getMonthName(currentMonth)} ${currentYear}`;
        logger.info('📅 Місяць оновлено:', `${getMonthName(currentMonth)} ${currentYear}`);
    } else {
        logger.warn('⚠️ Елемент відображення місяця не знайдено');
    }
}

/**
 * Получение названия месяца
 */
function getMonthName(monthIndex) {
    const months = [
        'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
        'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
    ];
    return months[monthIndex] || 'Невідомий місяць';
}

/**
 * Показ ошибки
 */
function showCalendarError(message) {
    logger.error('❌ Помилка календаря:', message);
    
    const container = document.getElementById('calendar-container');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="text-red-500 text-6xl mb-4">⚠️</div>
                <p class="text-gray-600">${message}</p>
                <button onclick="location.reload()" class="btn btn-primary mt-4">
                    Спробувати знову
                </button>
            </div>
        `;
        logger.info('✅ Помилка відображена в календарі');
    } else {
        logger.error('❌ Контейнер календаря не знайдено для відображення помилки');
    }
}

/**
 * Очистка модуля
 */
export function cleanupManagerCalendarModule() {
    logger.info('🧹 Очистка модуля календаря...');
    
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        logger.info('🛑 Зупинено автооновлення');
    }
    
    // Очищаем данные
    calendarData = [];
    managersData = [];
    departmentsData = [];
    newTasks.clear();
    rescheduledTasks.clear();
    taskHistory.clear();
    
    // Сбрасываем состояние
    currentMonth = new Date().getMonth();
    currentYear = new Date().getFullYear();
    selectedDepartment = '';
    selectedManager = '';
    lastDataHash = null;
    isCalendarInited = false;
    
    logger.info('✅ Модуль календаря очищен');
}

/**
 * Рендеринг вкладки звітов
 */
function renderReportsTab() {
    logger.info('📊 Рендеринг вкладки звітів...');
    
    const statsContainer = document.getElementById('reports-stats');
    const newTasksContainer = document.getElementById('new-tasks-list');
    const rescheduledTasksContainer = document.getElementById('rescheduled-tasks-list');
    
    if (!statsContainer || !newTasksContainer || !rescheduledTasksContainer) {
        logger.error('❌ Контейнери звітів не знайдено');
        return;
    }
    
    // Статистика
    const totalTasks = calendarData.length;
    const newTasksCount = newTasks.size;
    const rescheduledTasksCount = rescheduledTasks.size;
    const completedTasks = calendarData.filter(task => task.status === 'completed').length;
    
    logger.info('📊 Статистика звітів:', { totalTasks, newTasksCount, rescheduledTasksCount, completedTasks });
    
    statsContainer.innerHTML = `
        <div class="bg-blue-100 p-4 rounded-lg">
            <div class="text-2xl font-bold text-blue-600">${totalTasks}</div>
            <div class="text-sm text-gray-600">Всього завдань</div>
        </div>
        <div class="bg-green-100 p-4 rounded-lg">
            <div class="text-2xl font-bold text-green-600">${newTasksCount}</div>
            <div class="text-sm text-gray-600">Нових завдань</div>
        </div>
        <div class="bg-yellow-100 p-4 rounded-lg">
            <div class="text-2xl font-bold text-yellow-600">${rescheduledTasksCount}</div>
            <div class="text-sm text-gray-600">Перенесених</div>
        </div>
        <div class="bg-purple-100 p-4 rounded-lg">
            <div class="text-2xl font-bold text-purple-600">${completedTasks}</div>
            <div class="text-sm text-gray-600">Виконаних</div>
        </div>
    `;
    
    logger.info('✅ Статистика звітів оновлена');
    
    // Список нових завдань
    if (newTasks.size > 0) {
        const newTasksList = Array.from(newTasks.values())
            .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
            .map(task => {
                const crmLink = task.clientLink ? 
                    `<a href="${task.clientLink}" target="_blank" class="text-blue-600 hover:text-blue-800 text-xs underline">CRM</a>` : 
                    '';
                
                return `
                    <div class="border-l-4 border-l-green-500 p-3 bg-green-50 rounded mb-2">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="font-medium text-green-800">${task.taskDescription}</div>
                                <div class="text-sm text-green-600">${task.managerName}</div>
                                <div class="text-xs text-green-500">${task.clientName}</div>
                                ${crmLink ? `<div class="mt-1">${crmLink}</div>` : ''}
                                <div class="text-xs text-gray-500 mt-1">
                                    Додано: ${new Date(task.addedAt).toLocaleString('uk-UA')}
                                </div>
                            </div>
                            <div class="text-xs text-green-600">
                                ${new Date(task.scheduledDate).toLocaleDateString('uk-UA')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        
        newTasksContainer.innerHTML = newTasksList;
        logger.info('✅ Список нових завдань оновлено');
    } else {
        newTasksContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">📭</div>
                <p>Нових завдань поки немає</p>
            </div>
        `;
        logger.info('📭 Нових завдань немає');
    }
    
    // Список перенесених завдань
    if (rescheduledTasks.size > 0) {
        const rescheduledTasksList = Array.from(rescheduledTasks.values())
            .sort((a, b) => new Date(b.rescheduledAt) - new Date(a.rescheduledAt))
            .map(task => {
                const crmLink = task.clientLink ? 
                    `<a href="${task.clientLink}" target="_blank" class="text-blue-600 hover:text-blue-800 text-xs underline">CRM</a>` : 
                    '';
                
                return `
                    <div class="border-l-4 border-l-yellow-500 p-3 bg-yellow-50 rounded mb-2">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="font-medium text-yellow-800">${task.taskDescription}</div>
                                <div class="text-sm text-yellow-600">${task.managerName}</div>
                                <div class="text-xs text-yellow-500">${task.clientName}</div>
                                ${crmLink ? `<div class="mt-1">${crmLink}</div>` : ''}
                                <div class="text-xs text-gray-500 mt-1">
                                    Перенесено: ${new Date(task.rescheduledAt).toLocaleString('uk-UA')}
                                </div>
                            </div>
                            <div class="text-xs text-yellow-600">
                                <div>Було: ${new Date(task.oldDate).toLocaleDateString('uk-UA')}</div>
                                <div>Стало: ${new Date(task.newDate).toLocaleDateString('uk-UA')}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        
        rescheduledTasksContainer.innerHTML = rescheduledTasksList;
        logger.info('✅ Список перенесених завдань оновлено');
    } else {
        rescheduledTasksContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">📭</div>
                <p>Перенесених завдань поки немає</p>
            </div>
        `;
        logger.info('📭 Перенесених завдань немає');
    }
    
    logger.info('✅ Вкладка звітів відрендерена');
}

/**
 * Очистка історії завдань
 */
function clearTaskHistory() {
    if (confirm('Ви впевнені, що хочете очистити історію завдань? Це дія не може бути скасована.')) {
        logger.info('🧹 Очистка історії завдань...');
        
        newTasks.clear();
        rescheduledTasks.clear();
        taskHistory.clear();
        
        logger.info('✅ Історія завдань очищена');
        
        // Обновляем аналитику
        updateTaskAnalytics();
        
        // Перерисовываем отчеты
        renderReportsTab();
        
        // Показываем уведомление
        showNotification('Історія завдань очищена', 'success');
    }
}

/**
 * Експорт звіту
 */
function exportReports() {
    try {
        logger.info('📊 Експорт звіту...');
        
        const reportData = {
            generatedAt: new Date().toISOString(),
            companyId: window.state?.currentCompanyId,
            statistics: {
                totalTasks: calendarData.length,
                newTasks: newTasks.size,
                rescheduledTasks: rescheduledTasks.size,
                completedTasks: calendarData.filter(task => task.status === 'completed').length
            },
            newTasks: Array.from(newTasks.values()),
            rescheduledTasks: Array.from(rescheduledTasks.values())
        };
        
        const dataStr = JSON.stringify(reportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `calendar-report-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        logger.info('✅ Звіт експортовано');
        showNotification('Звіт експортовано успішно', 'success');
        
    } catch (error) {
        logger.error('❌ Помилка експорту звіту:', error);
        showNotification('Помилка експорту звіту', 'error');
    }
}

/**
 * Показ уведомлення
 */
function showNotification(message, type = 'info') {
    logger.info('📢 Показ уведомлення:', message, type);
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'info' ? 'bg-blue-500 text-white' :
        type === 'success' ? 'bg-green-500 text-white' :
        'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * Показ анімації завантаження
 */
function showLoadingAnimation() {
    const container = document.getElementById('calendar-container');
    if (container) {
        logger.info('🎬 Показуємо анімацію завантаження');
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-flex items-center space-x-2">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <div class="animate-pulse text-gray-600">Завантаження календаря...</div>
                </div>
                <div class="mt-4 text-sm text-gray-500">
                    <div class="animate-pulse">Отримання даних з API...</div>
                </div>
            </div>
        `;
    } else {
        logger.error('❌ Контейнер календаря не знайдено для анімації завантаження');
    }
}

/**
 * Приховування анімації завантаження
 */
function hideLoadingAnimation() {
    const container = document.getElementById('calendar-container');
    if (container) {
        logger.info('🎬 Приховуємо анімацію завантаження');
        // Анимация скрывается автоматически при рендеринге календаря
    } else {
        logger.error('❌ Контейнер календаря не знайдено для приховування анімації');
    }
}

/**
 * Оновлення анімації завантаження з прогресом
 */
function updateLoadingProgress(step, total = 4, message = '') {
    const container = document.getElementById('calendar-container');
    if (container) {
        const progress = Math.round((step / total) * 100);
        const steps = [
            'Отримання даних з API...',
            'Збереження в Firebase...',
            'Завантаження з Firebase...',
            'Рендеринг календаря...'
        ];
        
        logger.info(`📊 Прогрес завантаження: ${progress}% - ${message || steps[step - 1] || 'Завершення...'}`);
        
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-flex items-center space-x-2">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <div class="animate-pulse text-gray-600">Завантаження календаря...</div>
                </div>
                <div class="mt-4 text-sm text-gray-500">
                    <div class="animate-pulse">${message || steps[step - 1] || 'Завершення...'}</div>
                </div>
                <div class="mt-2 w-64 bg-gray-200 rounded-full h-2 mx-auto">
                    <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                </div>
                <div class="mt-1 text-xs text-gray-400">${progress}%</div>
            </div>
        `;
    } else {
        logger.error('❌ Контейнер календаря не знайдено для оновлення прогресу');
    }
}

// Глобальные функции для доступа из HTML
window.showDayDetails = showDayDetails;
window.renderReportsTab = renderReportsTab;
window.clearTaskHistory = clearTaskHistory;
window.exportReports = exportReports;

/**
 * Создание элементов статистики если они не существуют
 */
function ensureStatisticsElements() {
    const analyticsContainer = document.getElementById('calendarAnalytics');
    if (!analyticsContainer) {
        logger.warn('⚠️ Контейнер calendarAnalytics не знайдено');
        return false;
    }
    
    const elements = ['total-tasks', 'active-managers', 'total-clients', 'new-tasks', 'rescheduled-tasks'];
    let allElementsExist = true;
    
    elements.forEach(id => {
        let element = analyticsContainer.querySelector(`#${id}`);
        if (!element) {
            logger.info(`🔧 Створюємо елемент ${id}`);
            // Создаем элемент если его нет
            const parent = analyticsContainer.querySelector('.grid');
            if (parent) {
                const newElement = document.createElement('div');
                newElement.className = 'bg-gray-100 p-3 rounded-lg text-center';
                newElement.innerHTML = `
                    <div class="text-2xl font-bold text-gray-600" id="${id}">0</div>
                    <div class="text-sm text-gray-600">${getElementLabel(id)}</div>
                `;
                parent.appendChild(newElement);
                element = newElement.querySelector(`#${id}`);
                logger.info(`✅ Елемент ${id} створено`);
            } else {
                allElementsExist = false;
            }
        }
    });
    
    return allElementsExist;
}

/**
 * Получение названия для элемента статистики
 */
function getElementLabel(id) {
    const labels = {
        'total-tasks': 'Всього завдань',
        'active-managers': 'Активних менеджерів',
        'total-clients': 'Клієнтів',
        'new-tasks': 'Нових завдань',
        'rescheduled-tasks': 'Перенесених'
    };
    return labels[id] || 'Невідомо';
}

/**
 * Проверка прав доступа с упрощенной логикой
 */
function checkUserPermissions() {
    try {
        // Упрощенная проверка прав доступа
        const hasCalendarAccess = window.hasPermission?.('managerCalendar_view_page') ?? true;
        const canEditTasks = window.hasPermission?.('managerCalendar_edit_tasks') ?? true;
        const canCreateTasks = window.hasPermission?.('managerCalendar_create_tasks') ?? true;
        
        logger.verbose('🔐 Права доступу до календаря:', {
            hasCalendarAccess,
            canEditTasks, 
            canCreateTasks
        });
        
        return {
            hasCalendarAccess,
            canEditTasks,
            canCreateTasks
        };
        
    } catch (error) {
        logger.error('❌ Помилка перевірки прав доступу:', error);
        // Fallback - даем базовые права при ошибке
        return {
            hasCalendarAccess: true,
            canEditTasks: false,
            canCreateTasks: false
        };
    }
}

/**
 * Очистка слушателей событий при выгрузке модуля
 */
const calendarEventListeners = new Map();

function addCalendarEventListener(element, event, handler, options) {
    if (!element) return;
    
    const key = `${element.id || 'unknown'}-${event}`;
    
    // Удаляем предыдущий слушатель если есть
    if (calendarEventListeners.has(key)) {
        const oldHandler = calendarEventListeners.get(key);
        element.removeEventListener(event, oldHandler, options);
    }
    
    // Добавляем новый слушатель
    element.addEventListener(event, handler, options);
    calendarEventListeners.set(key, handler);
    
    logger.verbose(`🎧 Додано слухач події: ${key}`);
}

function removeAllCalendarEventListeners() {
    calendarEventListeners.forEach((handler, key) => {
        const [elementId, event] = key.split('-');
        const element = document.getElementById(elementId);
        if (element) {
            element.removeEventListener(event, handler);
            logger.verbose(`🗑️ Видалено слухач події: ${key}`);
        }
    });
    calendarEventListeners.clear();
    logger.info('🧹 Очищено всі слухачі подій календаря');
}

/**
 * Оптимизированное обновление статуса автообновления
 */
function updateAutoUpdateStatus(message, className = 'text-gray-600') {
    const statusElement = document.getElementById('autoUpdateStatus');
    if (statusElement) {
        // Используем DocumentFragment для оптимизации DOM операций
        const fragment = document.createDocumentFragment();
        const textNode = document.createTextNode(message);
        
        statusElement.innerHTML = '';
        statusElement.className = `text-sm ${className}`;
        statusElement.appendChild(textNode);
        
        logger.verbose('📊 Статус автооновлення оновлено');
    }
}

/**
 * Оптимизированный рендеринг календаря с мемоизацией
 */
const calendarRenderCache = new Map();

function renderOptimizedCalendar() {
    try {
        const permissions = checkUserPermissions();
        if (!permissions.hasCalendarAccess) {
            renderAccessDeniedMessage();
            return;
        }
        
        // Создаем ключ кэша на основе данных
        const cacheKey = `calendar_${currentMonth}_${currentYear}_${selectedDepartment}_${selectedManager}`;
        const dataHash = calculateDataHash(calendarData);
        const fullCacheKey = `${cacheKey}_${dataHash}`;
        
        // Проверяем кэш
        if (calendarRenderCache.has(fullCacheKey)) {
            logger.verbose('📋 Використовуємо кешований календар');
            const cachedContent = calendarRenderCache.get(fullCacheKey);
            updateCalendarContainer(cachedContent);
            return;
        }
        
        // Очищаем старый кэш (оставляем только 3 последних)
        if (calendarRenderCache.size > 3) {
            const oldestKey = calendarRenderCache.keys().next().value;
            calendarRenderCache.delete(oldestKey);
        }
        
        // Генерируем новый контент
        const calendarContent = generateCalendarContent(permissions);
        
        // Сохраняем в кэш
        calendarRenderCache.set(fullCacheKey, calendarContent);
        
        // Обновляем DOM
        updateCalendarContainer(calendarContent);
        
        logger.info('📅 Календар відрендерено оптимізовано');
        
    } catch (error) {
        logger.error('❌ Помилка рендерингу календаря:', error);
        showCalendarError('Помилка завантаження календаря');
    }
}

function updateCalendarContainer(content) {
    const container = document.getElementById('calendarContainer');
    if (container) {
        // Используем DocumentFragment для оптимизации
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }
}

function generateCalendarContent(permissions) {
    // Фильтруем данные один раз
    const filteredData = filterCalendarData();
    
    return `
        <div class="calendar-wrapper">
            ${generateCalendarHeader()}
            ${generateCalendarFilters()}
            ${permissions.canCreateTasks ? generateCreateTaskButton() : ''}
            ${generateCalendarTable(filteredData)}
            ${generateCalendarFooter()}
        </div>
    `;
}

function generateCalendarHeader() {
    return `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold text-white">Календар менеджера</h2>
            <div class="flex items-center gap-4">
                <div id="autoUpdateStatus" class="text-sm text-gray-600">Статус автооновлення</div>
                <button onclick="toggleAutoUpdate()" 
                        class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                    Керування автооновленням
                </button>
            </div>
        </div>
    `;
}

function renderAccessDeniedMessage() {
    const container = document.getElementById('calendarContainer');
    if (container) {
        container.innerHTML = `
            <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
                <p class="text-red-200">У вас немає прав для перегляду календаря менеджера.</p>
                <p class="text-red-300 text-sm mt-2">Зверніться до адміністратора для надання доступу.</p>
            </div>
        `;
    }
}

// ... existing code ...

/**
 * Глобальная функция инициализации календаря менеджера
 */
window.initManagerCalendar = async function(container) {
    logger.info('📅 Ініціалізація календаря менеджера...');
    
    try {
        if (!container) {
            logger.error('❌ Контейнер календаря не знайдено');
            return;
        }
        
        // Очищаем предыдущие слушатели
        removeAllCalendarEventListeners();
        
        // Проверяем права доступа
        const permissions = checkUserPermissions();
        if (!permissions.hasCalendarAccess) {
            container.innerHTML = `
                <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                    <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
                    <p class="text-red-200">У вас немає прав для перегляду календаря менеджера.</p>
                </div>
            `;
            return;
        }
        
        // Инициализируем контейнер
        container.innerHTML = `
            <div id="calendarContainer" class="bg-gray-800 rounded-xl shadow-lg p-6">
                <div class="text-center p-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p class="text-gray-200">Завантаження календаря менеджера...</p>
                </div>
            </div>
        `;
        
        // Загружаем данные
        await loadCalendarData();
        
        // Рендерим календарь
        renderOptimizedCalendar();
        
        // Запускаем автообновление
        if (isAutoUpdateEnabled) {
            startAutoUpdate();
        }
        
        logger.info('✅ Календар менеджера успішно ініціалізовано');
        
    } catch (error) {
        logger.error('❌ Помилка ініціалізації календаря:', error);
        if (container) {
            container.innerHTML = `
                <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                    <h2 class="text-2xl font-bold text-white mb-4">Помилка завантаження</h2>
                    <p class="text-red-200">Не вдалося завантажити календар менеджера.</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                        Спробувати ще раз
                    </button>
                </div>
            `;
        }
    }
};

/**
 * Очистка ресурсов при выгрузке модуля
 */
window.cleanupManagerCalendar = function() {
    logger.info('🧹 Очистка ресурсів календаря менеджера...');
    
    // Останавливаем автообновление
    stopAutoUpdate();
    
    // Очищаем слушатели событий
    removeAllCalendarEventListeners();
    
    // Очищаем кэш
    calendarRenderCache.clear();
    
    // Сбрасываем глобальные переменные
    calendarData = [];
    managersData = [];
    departmentsData = [];
    selectedDepartment = '';
    selectedManager = '';
    
    logger.info('✅ Ресурси календаря очищено');
};

/**
 * Оптимизированная функция фильтрации данных календаря
 */
function filterCalendarData() {
    if (!calendarData || calendarData.length === 0) {
        return [];
    }
    
    return calendarData.filter(task => {
        // Фильтр по отделу
        if (selectedDepartment) {
            const taskDepartment = findDepartmentIdByName(task.Відділ || '');
            if (taskDepartment !== selectedDepartment) {
                return false;
            }
        }
        
        // Фильтр по менеджеру
        if (selectedManager) {
            const taskManager = findManagerIdByName(task.Менеджер || '');
            if (taskManager !== selectedManager) {
                return false;
            }
        }
        
        // Фильтр по месяцу и году
        const taskDate = new Date(task.Дата);
        if (taskDate.getMonth() !== currentMonth || taskDate.getFullYear() !== currentYear) {
            return false;
        }
        
        return true;
    });
}

/**
 * Улучшенная функция генерации содержимого календаря
 */
function generateCalendarTable(filteredData) {
    if (!filteredData || filteredData.length === 0) {
        return `
            <div class="text-center py-8">
                <div class="text-6xl mb-4">📅</div>
                <h3 class="text-xl font-semibold text-white mb-2">Немає завдань</h3>
                <p class="text-gray-400">У вибраному періоді та фільтрах немає завдань для відображення.</p>
            </div>
        `;
    }
    
    // Группируем задачи по дням
    const tasksByDate = {};
    filteredData.forEach(task => {
        const date = new Date(task.Дата).toDateString();
        if (!tasksByDate[date]) {
            tasksByDate[date] = [];
        }
        tasksByDate[date].push(task);
    });
    
    // Генерируем HTML для календарной таблицы
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let tableHTML = `
        <div class="calendar-table-wrapper">
            <div class="grid grid-cols-7 gap-2 mb-4">
                ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(day => 
                    `<div class="text-center font-semibold text-gray-300 p-2">${day}</div>`
                ).join('')}
            </div>
            <div class="grid grid-cols-7 gap-2">
    `;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateString = date.toDateString();
        const dayTasks = tasksByDate[dateString] || [];
        
        tableHTML += `
            <div class="calendar-day bg-gray-700 rounded p-2 min-h-[100px] ${dayTasks.length > 0 ? 'border-l-4 border-blue-500' : ''}">
                <div class="text-sm font-semibold text-white mb-1">${day}</div>
                ${dayTasks.slice(0, 3).map(task => `
                    <div class="text-xs bg-blue-600 text-white rounded px-2 py-1 mb-1 truncate" title="${task.Назва}">
                        ${task.Назва || 'Без назви'}
                    </div>
                `).join('')}
                ${dayTasks.length > 3 ? `<div class="text-xs text-gray-400">+${dayTasks.length - 3} ще</div>` : ''}
            </div>
        `;
    }
    
    tableHTML += `
            </div>
        </div>
    `;
    
    return tableHTML;
}

/**
 * Генерация кнопки создания задачи
 */
function generateCreateTaskButton() {
    return `
        <div class="mb-4">
            <button onclick="openCreateTaskModal()" 
                    class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2">
                <span>➕</span>
                <span>Створити завдання</span>
            </button>
        </div>
    `;
}

/**
 * Генерация футера календаря
 */
function generateCalendarFooter() {
    return `
        <div class="mt-6 text-center text-sm text-gray-400">
            <p>Останнє оновлення: ${new Date().toLocaleString('uk-UA')}</p>
        </div>
    `;
}

// ... existing code ...