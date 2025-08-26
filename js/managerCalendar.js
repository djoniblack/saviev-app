// managerCalendar-new.js - Новая архитектура модуля календаря менеджера
import * as firebase from './firebase.js';

// === НАСТРОЙКИ ОТЛАДКИ ===
const DEBUG_MODE = true; // ВРЕМЕННО ПРИНУДИТЕЛЬНО ВКЛЮЧАЕМ ДЛЯ ДИАГНОСТИКИ
const LOG_LEVEL = 'verbose'; // ВРЕМЕННО ПРИНУДИТЕЛЬНО ВКЛЮЧАЕМ ПОДРОБНЫЕ ЛОГИ

const logger = {
    verbose: (...args) => console.log('[CALENDAR]', ...args), // Убираем условия
    info: (...args) => console.log('[CALENDAR]', ...args), // Убираем условия
    warn: (...args) => console.warn('[CALENDAR]', ...args), // Убираем условия
    error: (...args) => console.error('[CALENDAR]', ...args),
    isDebugMode: () => true // Всегда true для диагностики
};

/**
 * Класс для управления модулем календаря менеджера
 * Инкапсулирует все DOM-операции и состояние модуля
 */
class ManagerCalendar {
    constructor() {
        // === СОСТОЯНИЕ МОДУЛЯ ===
        this.isInitialized = false;
        this.isFrozen = false; // Новый режим "заморозки"
        this.container = null;
        this.elements = {}; // Кэш DOM элементов
        
        // === ДАННЫЕ ===
        this.calendarData = [];
        this.managersData = [];
        this.departmentsData = [];
        this.clientLinks = {}; // Справочник CRM ссылок {код_клиента: ссылка}
        this.clientLinksByName = {}; // Справочник CRM ссылок {имя_клиента: ссылка}
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.selectedDepartment = '';
        this.selectedManager = '';
        
        // === АВТООБНОВЛЕНИЕ ===
        this.autoUpdateInterval = null;
        this.lastUpdateTime = null;
        this.isAutoUpdateEnabled = true;
        this.isUpdateInProgress = false;
        this.AUTO_UPDATE_INTERVAL = 15 * 60 * 1000; // 15 минут
        
        // === КЭШИ ===
        this.renderCache = new Map();
        this.eventListeners = new Map();
        
        // === ОТЧЕТЫ ===
        this.reportsInitialized = false;
    }
    
    /**
     * Главная функция инициализации модуля
     */
    async init(container) {
        logger.info('📅 Инициализация календаря менеджера...');
        
        // Если календарь был заморожен, просто восстанавливаем его
        if (this.isFrozen && this.isInitialized) {
            logger.info('🔄 Восстановление календаря из замороженного состояния');
            this.isFrozen = false;
            this.container = container;
            this._createHTMLStructure();
            this._cacheElements();
            this._initEventListeners();
            this._renderCalendar(); // Используем уже загруженные данные
            if (this.isAutoUpdateEnabled) {
                this._startAutoUpdate();
            }
            logger.info('✅ Календарь восстановлен из кэша');
        return;
    }
    
        // Предотвращаем повторную инициализацию
        if (this.isInitialized) {
            logger.warn('⚠️ Модуль календаря уже инициализирован');
            return;
        }
        
        if (!container) {
            logger.error('❌ Контейнер не предоставлен');
            return;
        }
        
        try {
            // Сохраняем ссылку на контейнер
            this.container = container;

        // Проверяем права доступа
            if (!this._checkPermissions()) {
                this._renderAccessDenied();
                return;
            }
            
            // Создаем HTML структуру один раз
            this._createHTMLStructure();
            
            // Кэшируем DOM элементы
            this._cacheElements();
            
            // Инициализируем обработчики событий
            this._initEventListeners();
            
            // Загружаем данные
            await this._loadData();
            
            // Рендерим начальное состояние
            this._renderCalendar();
            
            // Запускаем автообновление
            if (this.isAutoUpdateEnabled) {
                this._startAutoUpdate();
            }
            
            this.isInitialized = true;
            logger.info('✅ Календарь менеджера успешно инициализирован');
            
        } catch (error) {
            logger.error('❌ Ошибка инициализации календаря:', error);
            this._renderError('Не удалось загрузить календарь менеджера');
        }
    }
    
    /**
     * "Мягкая" очистка - заморозка модуля с сохранением данных
     */
    freeze() {
        logger.info('❄️ Заморозка календаря менеджера (сохранение состояния)...');
        
        if (!this.isInitialized) {
            logger.warn('⚠️ Модуль не был инициализирован');
            return;
        }
        
        try {
            // Останавливаем автообновление
            this._stopAutoUpdate();
            
            // Очищаем слушатели событий (но не данные!)
            this._removeAllEventListeners();
            
            // Очищаем только контейнер
            if (this.container) {
                this.container.innerHTML = '';
                this.container = null;
            }
            
            // Очищаем только элементы DOM (данные остаются!)
            this.elements = {};
            
            this.isFrozen = true;
            logger.info('❄️ Календарь заморожен (данные сохранены)');
        
    } catch (error) {
            logger.error('❌ Ошибка заморозки календаря:', error);
    }
}

    /**
     * Переключение вкладок
     */
    _switchTab(tabName) {
        // Обновляем стили вкладок
        const allTabs = this.container.querySelectorAll('.calendar-tab');
        allTabs.forEach(tab => {
            tab.classList.remove('text-white', 'border-blue-500', 'bg-blue-600', 'bg-opacity-20');
            tab.classList.add('text-gray-300', 'border-transparent');
        });
        
        // Показываем/скрываем контент
        if (tabName === 'calendar') {
            this.elements.calendarTab.classList.remove('text-gray-300', 'border-transparent');
            this.elements.calendarTab.classList.add('text-white', 'border-blue-500', 'bg-blue-600', 'bg-opacity-20');
            
            this.elements.content.classList.remove('hidden');
            this.elements.reportsContent.classList.add('hidden');
            
            // Показываем фильтры календаря
            const filtersContainer = this.container.querySelector('.calendar-filters');
            if (filtersContainer) {
                filtersContainer.classList.remove('hidden');
            }
            
            // Инициализируем отчеты при первом переходе
            if (!this.reportsInitialized) {
                this._initReports();
            }
        } else if (tabName === 'reports') {
            this.elements.reportsTab.classList.remove('text-gray-300', 'border-transparent');
            this.elements.reportsTab.classList.add('text-white', 'border-blue-500', 'bg-blue-600', 'bg-opacity-20');
            
            this.elements.content.classList.add('hidden');
            this.elements.reportsContent.classList.remove('hidden');
            
            // Скрываем фильтры календаря
            const filtersContainer = this.container.querySelector('.calendar-filters');
            if (filtersContainer) {
                filtersContainer.classList.add('hidden');
            }
            
            // Инициализируем отчеты при первом переходе
            if (!this.reportsInitialized) {
                this._initReports();
            }
        }
        
        logger.info(`📊 Переключение на вкладку: ${tabName}`);
    }
    
    /**
     * Инициализация отчетов
     */
    async _initReports() {
        try {
            // Импортируем модуль отчетов
            const { initCalendarReportsModule } = await import('./calendarReports.js');
            
            // Инициализируем отчеты
            await initCalendarReportsModule(this.elements.reportsContent);
            
            this.reportsInitialized = true;
            logger.info('✅ Модуль отчетов инициализирован');
            
        } catch (error) {
            logger.error('❌ Ошибка инициализации отчетов:', error);
        }
    }
    
    /**
     * Полная очистка модуля (используется только при действительно необходимой очистке)
     */
    cleanup() {
        logger.info('🧹 Полная очистка календаря менеджера...');
        
        if (!this.isInitialized && !this.isFrozen) {
            logger.warn('⚠️ Модуль не был инициализирован');
            return;
        }
        
        try {
            // Останавливаем автообновление
            this._stopAutoUpdate();
            
            // Очищаем все слушатели событий
            this._removeAllEventListeners();
            
            // Очищаем кэши
            this.renderCache.clear();
            
            // Сбрасываем данные
            this.calendarData = [];
            this.managersData = [];
            this.departmentsData = [];
            this.selectedDepartment = '';
            this.selectedManager = '';
            this.lastUpdateTime = null;
            this.isUpdateInProgress = false;
            
            // Полностью очищаем контейнер
            if (this.container) {
                this.container.innerHTML = '';
                this.container = null;
            }
            
            // Очищаем кэш элементов
            this.elements = {};
            
            this.isInitialized = false;
            this.isFrozen = false;
            logger.info('✅ Календарь менеджера полностью очищен');
        
    } catch (error) {
            logger.error('❌ Ошибка очистки календаря:', error);
    }
}

/**
     * Проверка прав доступа
     */
    _checkPermissions() {
        try {
            // Используем правильное название права из PERMISSIONS_GROUPS
            return window.hasPermission?.('manager_calendar_view_page') ?? true;
    } catch (error) {
            logger.error('❌ Ошибка проверки прав:', error);
            return true; // Fallback
    }
}

/**
     * Создание HTML структуры модуля один раз
     */
    _createHTMLStructure() {
        this.container.innerHTML = `
            <div class="manager-calendar-module bg-gray-800 rounded-xl shadow-lg p-6">
                <!-- Заголовок с вкладками -->
                <div class="calendar-header mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-2xl font-bold text-white">Календар менеджера</h2>
                        <div class="calendar-controls flex items-center gap-4">
                            <div id="autoUpdateStatus" class="text-sm text-gray-400">Завантаження...</div>
                            <button id="autoUpdateToggle" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                Автооновлення
                            </button>
                        </div>
                    </div>
                    
                    <!-- Вкладки -->
                    <div class="calendar-tabs flex border-b border-gray-600">
                        <button id="calendarTab" class="calendar-tab px-4 py-2 text-white border-b-2 border-blue-500 bg-blue-600 bg-opacity-20">
                            📅 Календар
                        </button>
                        <button id="reportsTab" class="calendar-tab px-4 py-2 text-gray-300 hover:text-white border-b-2 border-transparent hover:border-gray-500">
                            📊 Отчеты
                        </button>
                    </div>
                </div>
            
                <!-- Фильтры -->
                <div class="calendar-filters bg-gray-700 rounded-lg p-4 mb-6">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Відділ</label>
                            <select id="departmentFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                            <option value="">Всі відділи</option>
                        </select>
                    </div>
                    <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Менеджер</label>
                            <select id="managerFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                            <option value="">Всі менеджери</option>
                        </select>
                    </div>
                    <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Місяць</label>
                            <div class="flex items-center gap-2">
                                <button id="prevMonth" class="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-500">‹</button>
                                <span id="currentMonth" class="px-2 text-white min-w-[120px] text-center"></span>
                                <button id="nextMonth" class="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-500">›</button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Дії</label>
                            <button id="refreshData" class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                                Оновити
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Статистика (создается один раз) -->
                <div id="calendarAnalytics" class="calendar-analytics mb-6">
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-lg font-semibold text-white mb-4">📊 Статистика завдань</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-blue-100 p-3 rounded-lg text-center">
                                <div id="totalTasks" class="text-2xl font-bold text-blue-600">0</div>
                                <div class="text-sm text-gray-600">Всього завдань</div>
                            </div>
                            <div class="bg-green-100 p-3 rounded-lg text-center">
                                <div id="newTasks" class="text-2xl font-bold text-green-600">0</div>
                                <div class="text-sm text-gray-600">Нових завдань</div>
                            </div>
                            <div class="bg-yellow-100 p-3 rounded-lg text-center">
                                <div id="rescheduledTasks" class="text-2xl font-bold text-yellow-600">0</div>
                                <div class="text-sm text-gray-600">Перенесених</div>
                            </div>
                            <div class="bg-purple-100 p-3 rounded-lg text-center">
                                <div id="completedTasks" class="text-2xl font-bold text-purple-600">0</div>
                                <div class="text-sm text-gray-600">Закритих</div>
                            </div>
                            </div>
                        </div>
                </div>
                
                <!-- Календарь -->
                <div id="calendarContent" class="calendar-content bg-gray-700 rounded-lg p-4">
                    <div class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                        <p class="text-gray-200">Завантаження календаря...</p>
                </div>
            </div>
            
                <!-- Контейнер для отчетов -->
                <div id="reportsContent" class="reports-content hidden">
                    <!-- Отчеты будут загружены динамически -->
                </div>
                
                <!-- Модальное окно (часть структуры модуля) -->
                <div id="calendarModal" class="calendar-modal fixed inset-0 z-50 hidden bg-black bg-opacity-50 flex items-center justify-center">
                    <div class="modal-content bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 relative">
                        <button id="modalClose" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
                        <div id="modalHeader" class="mb-4">
                            <h3 class="text-xl font-bold text-white">Деталі завдання</h3>
                        </div>
                        <div id="modalBody" class="text-gray-200">
                            <!-- Содержимое модального окна -->
                    </div>
                        </div>
                        </div>
                    </div>
        `;
    }
    
    /**
     * Кэширование DOM элементов (только внутри контейнера)
     */
    _cacheElements() {
        this.elements = {
            // Вкладки
            calendarTab: this.container.querySelector('#calendarTab'),
            reportsTab: this.container.querySelector('#reportsTab'),
            reportsContent: this.container.querySelector('#reportsContent'),
            
            autoUpdateStatus: this.container.querySelector('#autoUpdateStatus'),
            autoUpdateToggle: this.container.querySelector('#autoUpdateToggle'),
            departmentFilter: this.container.querySelector('#departmentFilter'),
            managerFilter: this.container.querySelector('#managerFilter'),
            currentMonth: this.container.querySelector('#currentMonth'),
            prevMonth: this.container.querySelector('#prevMonth'),
            nextMonth: this.container.querySelector('#nextMonth'),
            refreshData: this.container.querySelector('#refreshData'),
            content: this.container.querySelector('#calendarContent'),
            
            // Статистика
            totalTasks: this.container.querySelector('#totalTasks'),
            newTasks: this.container.querySelector('#newTasks'),
            rescheduledTasks: this.container.querySelector('#rescheduledTasks'),
            completedTasks: this.container.querySelector('#completedTasks'),
            
            // Модальное окно
            modal: this.container.querySelector('#calendarModal'),
            modalClose: this.container.querySelector('#modalClose'),
            modalHeader: this.container.querySelector('#modalHeader'),
            modalBody: this.container.querySelector('#modalBody')
        };
        
        logger.verbose('📝 DOM элементы закэшированы');
    }
    
    /**
     * Инициализация обработчиков событий
     */
    _initEventListeners() {
        // Вкладки
        this._addEventListener('calendarTab', 'click', () => this._switchTab('calendar'));
        this._addEventListener('reportsTab', 'click', () => this._switchTab('reports'));
        
        // Автообновление
        this._addEventListener('autoUpdateToggle', 'click', () => this._toggleAutoUpdate());
        
        // Фильтры
        this._addEventListener('departmentFilter', 'change', (e) => {
            const oldValue = this.selectedDepartment;
            this.selectedDepartment = e.target.value;
            
            if (logger.isDebugMode()) {
                console.log('🏢 Фильтр отделов изменен:', {
                    'старое значение': oldValue,
                    'новое значение': this.selectedDepartment,
                    'элемент UI': e.target.value
                });
            }
            
            this._renderCalendar();
        });
        
        this._addEventListener('managerFilter', 'change', (e) => {
            const oldValue = this.selectedManager;
            this.selectedManager = e.target.value;
            
            if (logger.isDebugMode()) {
                console.log('👤 Фильтр менеджеров изменен:', {
                    'старое значение': oldValue,
                    'новое значение': this.selectedManager,
                    'элемент UI': e.target.value
                });
            }
            
            this._renderCalendar();
        });
        
        // Навигация по месяцам
        this._addEventListener('prevMonth', 'click', () => this._changeMonth(-1));
        this._addEventListener('nextMonth', 'click', () => this._changeMonth(1));
        
        // Обновление данных
        this._addEventListener('refreshData', 'click', () => this._refreshData());
        
        // Модальное окно
        this._addEventListener('modalClose', 'click', () => this._hideModal());
        
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this._hideModal();
        });
        
        logger.verbose('🎧 Обработчики событий инициализированы');
    }
    
    /**
     * Добавление слушателя с отслеживанием
     */
    _addEventListener(elementId, event, handler, options) {
        const element = this.elements[elementId];
        if (!element) return;
        
        const key = `${elementId}-${event}`;
        
        // Удаляем предыдущий слушатель если есть
        if (this.eventListeners.has(key)) {
            const oldHandler = this.eventListeners.get(key);
            element.removeEventListener(event, oldHandler, options);
        }
        
        element.addEventListener(event, handler, options);
        this.eventListeners.set(key, handler);
    }
    
    /**
     * Удаление всех слушателей событий
     */
    _removeAllEventListeners() {
        this.eventListeners.forEach((handler, key) => {
            const [elementId, event] = key.split('-');
            const element = this.elements[elementId];
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.eventListeners.clear();
        logger.info('🧹 Все слушатели событий очищены');
    }
    
    /**
     * Обновление статистики (только textContent, не innerHTML)
     */
    _updateStatistics(stats) {
        if (this.elements.totalTasks) {
            this.elements.totalTasks.textContent = stats.totalTasks || 0;
        }
        if (this.elements.newTasks) {
            this.elements.newTasks.textContent = stats.newTasks || 0;
        }
        if (this.elements.rescheduledTasks) {
            this.elements.rescheduledTasks.textContent = stats.rescheduledTasks || 0;
        }
        if (this.elements.completedTasks) {
            this.elements.completedTasks.textContent = stats.completedTasks || 0;
        }
        
        logger.verbose('📊 Статистика обновлена');
    }
    
    /**
     * Обновление статуса автообновления (только textContent)
     */
    _updateAutoUpdateStatus(message, className = 'text-gray-400') {
        if (this.elements.autoUpdateStatus) {
            this.elements.autoUpdateStatus.textContent = message;
            this.elements.autoUpdateStatus.className = `text-sm ${className}`;
        }
    }
    
    /**
     * Показ модального окна (обновлено для полного контента)
     */
    _showModal(title, content) {
        if (this.elements.modal) {
            // Если передан полный контент (с собственной разметкой), используем его
            if (content.includes('<div class="bg-white')) {
                this.elements.modal.innerHTML = content;
            } else {
                // Иначе используем стандартную структуру
                this.elements.modalHeader.innerHTML = title ? `<h3 class="text-xl font-bold text-white">${title}</h3>` : '';
                this.elements.modalBody.innerHTML = content;
            }
            this.elements.modal.classList.remove('hidden');
    }
}

/**
     * Скрытие модального окна
     */
    _hideModal() {
        if (this.elements.modal) {
            this.elements.modal.classList.add('hidden');
        }
    }
    
    /**
     * Загрузка всех необходимых данных
     */
    async _loadData() {
        console.log('📊 === НАЧАЛО _loadData ===');
        logger.info('📊 Загрузка данных календаря...');
        
        try {
            // Показываем индикатор загрузки
            if (this.elements.calendarContent) {
                this.elements.calendarContent.innerHTML = '<div class="text-center py-8">Завантаження даних...</div>';
            }
            
            console.log('📊 Запускаем параллельную загрузку данных...');
            // Загружаем данные сотрудников и задач параллельно
            const [employeesData, tasksData] = await Promise.all([
                this._loadEmployeesAndDepartments(),
                this._loadCalendarData() // ИСПРАВЛЕНО: используем полную логику сравнения изменений
            ]);
            console.log('📊 Параллельная загрузка завершена');
            
            // Загружаем справочник клиентов (он сам сохраняет данные в this.clientLinks)
            console.log('🔗 Загружаем справочник CRM ссылок...');
            await this._loadClientLinks();
            console.log('🔗 Справочник CRM ссылок загружен');
            
            // Сохраняем загруженные данные в свойства класса
            console.log('💾 Сохраняем данные в свойства класса...');
            this.managersData = employeesData.managers || [];
            this.departmentsData = employeesData.departments || [];
            this.calendarData = tasksData || [];
            
            console.log(`✅ Данные сохранены: ${this.managersData.length} менеджеров, ${this.departmentsData.length} отделов, ${this.calendarData.length} задач`);
            
            // Обновляем фильтры только после загрузки новых данных
            console.log('🔧 Обновляем фильтры...');
            this._updateFilters();
            console.log('🔧 Фильтры обновлены');
            
            logger.info('✅ Все данные загружены и сохранены:', {
                'менеджеры': this.managersData.length,
                'отделы': this.departmentsData.length,
                'задачи календаря': this.calendarData.length,
                'CRM ссылки (коды)': Object.keys(this.clientLinks).length,
                'CRM ссылки (имена)': Object.keys(this.clientLinksByName).length
            });
            
            // Диагностическая информация для отладки
            if (logger.isDebugMode()) {
                console.log('🔍 ДИАГНОСТИКА ДАННЫХ:');
                console.log('📊 Менеджеры:', this.managersData);
                console.log('🏢 Отделы:', this.departmentsData);
                console.log('📅 Задачи календаря (первые 3):', this.calendarData.slice(0, 3));
                console.log('🔗 CRM ссылки по кодам (первые 3):', Object.entries(this.clientLinks).slice(0, 3));
                console.log('🔗 CRM ссылки по именам (первые 3):', Object.entries(this.clientLinksByName).slice(0, 3));
            }
            
    } catch (error) {
            logger.error('❌ Ошибка загрузки данных:', error);
            this._renderError('Не удалось загрузить календарь менеджера');
    }
}

/**
     * Загрузка данных календаря из API и Firebase
     */
    async _loadCalendarData() {
        try {
            logger.info('📅 Завантаження даних календаря...');
            
            // Сначала загружаем сотрудников и отделы
            const { managers, departments } = await this._loadEmployeesAndDepartments();
            this.managersData = managers;
            this.departmentsData = departments;
            
            const existingTasks = await this._loadTasksFromFirebase();
            logger.info('📥 Існуючі дані з Firebase:', existingTasks.length);
            
            const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=dela');
            if (!response.ok) {
                logger.error('❌ Помилка завантаження з API:', response.status);
                logger.info('📥 Використовуємо дані з Firebase як fallback:', existingTasks.length);
                return existingTasks;
            }
            
            const apiData = await response.json();
            logger.info('📅 Отримано даних з API:', apiData.length);
            
            const { newTasks, rescheduledTasks, unchangedTasks, completedTasks } = this._findChangedTasks(apiData, existingTasks);
            logger.info(`📊 Аналіз змін: ${newTasks.length} нових, ${rescheduledTasks.length} перенесених, ${completedTasks.length} закрытых`);
            
            if (newTasks.length > 0 || rescheduledTasks.length > 0 || completedTasks.length > 0) {
                logger.info('💾 Зберігаємо зміни в Firebase...');
                await this._saveOnlyChanges(newTasks, rescheduledTasks, completedTasks);
                const updatedData = await this._loadTasksFromFirebase();
                logger.info('📥 Завантажено оновлені дані з Firebase:', updatedData.length);
                
                // Обновляем фильтры и загружаем ссылки клиентов
                this._updateFilters();
                await this._loadClientLinks();
                
                return updatedData;
            } else {
                logger.info('🔄 Змін не знайдено, використовуємо кеш');
                
                // Обновляем фильтры и загружаем ссылки клиентов
                this._updateFilters();
                await this._loadClientLinks();
                
                return existingTasks;
            }
        } catch (error) {
            logger.error('❌ Помилка завантаження даних календаря:', error);
            return await this._loadTasksFromFirebase();
        }
    }

/**
 * Загрузка сотрудников и отделов
 */
    async _loadEmployeesAndDepartments() {
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

            // Фильтруем менеджеров по критериям
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
                
                if (allEmployees.length === 0) {
                    logger.warn('⚠️ Співробітники не знайдені, додаємо демо-дані');
                    // Добавляем демо-менеджеров
                    const demoManagers = [
                        { id: 'demo-mgr-1', name: 'Демо Менеджер', position: 'менеджер продажів', department: 'Відділ продажів' },
                        { id: 'demo-mgr-2', name: 'Іван Петренко', position: 'менеджер', department: 'Відділ розвитку' },
                        { id: 'demo-mgr-3', name: 'Марія Коваленко', position: 'старший менеджер', department: 'Відділ продажів' }
                    ];
                    
                    const demoDepartments = [
                        { id: 'demo-dept-1', name: 'Відділ продажів' },
                        { id: 'demo-dept-2', name: 'Відділ розвитку' }
                    ];
                    
                    logger.info(`🎭 Додано ${demoManagers.length} демо-менеджерів та ${demoDepartments.length} демо-відділів`);
                    
                    return {
                        managers: demoManagers,
                        departments: demoDepartments
                    };
                }
                
            return {
                managers: allEmployees,
                departments: departments
            };
        }
        
            return {
                managers: managers,
                departments: departments
            };
        
    } catch (error) {
            logger.error('❌ Помилка завантаження співробітників:', error);
        return { managers: [], departments: [] };
    }
}

/**
 * Загрузка задач из Firebase
 */
    async _loadTasksFromFirebase() {
    try {
        const companyId = window.state?.currentCompanyId;
        if (!companyId) {
                logger.error('❌ ID компанії не знайдено');
            return [];
        }

            logger.info('📥 Завантаження завдань з Firebase...');

        // Используем подколлекцию в компании
        const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'managerCalendarTasks');
        const tasksSnapshot = await firebase.getDocs(tasksRef);

        const tasks = [];
        tasksSnapshot.forEach(doc => {
            const data = doc.data();
            tasks.push({
                taskId: data.taskId, // ← ДОБАВЛЕНО: для правильного сравнения
                ID: data.taskId,
                Дата: data.originalDate, // ИСПРАВЛЕНО: используем originalDate
                'Дата изменения': data.modifiedDate || data.originalDate,
                Дело: data.taskDescription,
                Менеджер: data.managerName,
                'Клиент.Название': data.clientName,
                'Клиент.Код': data.clientCode,
                'Клиент.Ссылка': data.clientLink || '',
                departmentName: data.departmentName,
                status: data.status,
                originalDate: data.originalDate // ← ДОБАВЛЕНО: для правильного сравнения
            });
        });

            logger.info(`📥 Завантажено ${tasks.length} завдань з Firebase`);
            
            // Если нет данных в Firebase, добавляем демо-данные для тестирования
            if (tasks.length === 0) {
                logger.warn('⚠️ Firebase порожній, додаємо демо-дані для тестування');
                const currentDate = new Date();
                const demoTasks = [
                    {
                        taskId: 'demo-1',
                        ID: 'demo-1',
                        Дата: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).toISOString(),
                        'Дата изменения': new Date().toISOString(),
                        Дело: 'Демо: Дзвінок клієнту',
                        Менеджер: 'Демо Менеджер',
                        'Клиент.Название': 'Демо Клієнт ТОВ',
                        'Клиент.Код': 'DEMO-001',
                        'Клиент.Ссылка': 'https://bitrix.lookfort.com/crm/company/details/demo/',
                        departmentName: 'Відділ продажів',
                        status: 'new',
                        scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).toISOString()
                    },
                    {
                        taskId: 'demo-2',
                        ID: 'demo-2',
                        Дата: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1).toISOString(),
                        'Дата изменения': new Date().toISOString(),
                        Дело: 'Демо: Зустріч з клієнтом',
                        Менеджер: 'Іван Петренко',
                        'Клиент.Название': 'АТ "Прогрес"',
                        'Клиент.Код': 'DEMO-002',
                        'Клиент.Ссылка': '',
                        departmentName: 'Відділ розвитку',
                        status: 'rescheduled',
                        scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1).toISOString()
                    },
                    {
                        taskId: 'demo-3',
                        ID: 'demo-3',
                        Дата: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 2).toISOString(),
                        'Дата изменения': new Date().toISOString(),
                        Дело: 'Демо: Підготовка пропозиції',
                        Менеджер: 'Марія Коваленко',
                        'Клиент.Название': 'ФОП Демченко А.В.',
                        'Клиент.Код': 'DEMO-003',
                        'Клиент.Ссылка': 'https://bitrix.lookfort.com/crm/company/details/demo3/',
                        departmentName: 'Відділ продажів',
                        status: 'completed',
                        scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 2).toISOString()
                    }
                ];
                
                logger.info(`🎭 Додано ${demoTasks.length} демо-завдань`);
                return demoTasks;
        }
        
        return tasks;
                
    } catch (error) {
            logger.error('❌ Помилка завантаження завдань з Firebase:', error);
        return [];
    }
}

/**
     * Фильтрация данных с учетом прав доступа
     * @param {boolean} includeMonthFilter - включать ли фильтрацию по текущему месяцу (для статистики)
     */
    _filterData(includeMonthFilter = false) {
        let filtered = this.calendarData;
        
        logger.info('🔍 Фільтрація даних...');
        logger.info('📊 Початкові дані:', filtered.length);
        logger.info('🎛️ Параметри фільтрів:', {
            'выбранный отдел': this.selectedDepartment,
            'выбранный менеджер': this.selectedManager,
            'включить фильтр месяца': includeMonthFilter,
            'текущий месяц': this.currentMonth,
            'текущий год': this.currentYear
        });
        
        // Проверяем права доступа
        const currentUserPermissions = window.state?.currentUserPermissions || {};
        const currentUserId = window.state?.currentUserId;
        const currentEmployee = window.state?.allEmployees?.find(emp => emp.id === currentUserId);
        
        logger.info('👤 Поточний користувач:', currentEmployee?.name);
        logger.info('🔐 Права користувача:', {
            'manager_calendar_view_all_tasks': currentUserPermissions['manager_calendar_view_all_tasks'],
            'manager_calendar_view_own_tasks': currentUserPermissions['manager_calendar_view_own_tasks'],
            'manager_calendar_view_department_tasks': currentUserPermissions['manager_calendar_view_department_tasks']
        });
        
        // Фильтрация по правам доступа
        const hasSpecificPermissions = currentUserPermissions['manager_calendar_view_own_tasks'] || 
                                     currentUserPermissions['manager_calendar_view_department_tasks'];
        
        if (hasSpecificPermissions && !currentUserPermissions['manager_calendar_view_all_tasks']) {
            if (currentUserPermissions['manager_calendar_view_own_tasks']) {
                // Показываем только свои задачи
                filtered = filtered.filter(item => 
                    item.Менеджер === currentEmployee?.name
                );
                logger.info('👤 Після фільтрації по власним завданням:', filtered.length);
            } else if (currentUserPermissions['manager_calendar_view_department_tasks']) {
                // Показываем только задачи своего отдела
                const userDepartment = currentEmployee?.department;
                if (userDepartment) {
                    filtered = filtered.filter(item => item.departmentName === userDepartment);
                }
                logger.info('🏢 Після фільтрації по відділу:', filtered.length);
            }
    } else {
            logger.info('🌐 Показуємо всі завдання (є права view_all_tasks або немає обмежень)');
        }
        
        // Фильтр по отделу
        if (this.selectedDepartment) {
            const departmentName = this.departmentsData.find(d => d.id === this.selectedDepartment)?.name;
            if (departmentName) {
                filtered = filtered.filter(item => item.departmentName === departmentName);
                logger.info('🏢 Після фільтрації по вибраному відділу:', filtered.length);
            }
        }
        
        // Фильтр по менеджеру
        if (this.selectedManager) {
            const managerName = this.managersData.find(m => m.id === this.selectedManager)?.name;
            if (managerName) {
                filtered = filtered.filter(item => item.Менеджер === managerName);
                logger.info('👤 Після фільтрації по менеджеру:', filtered.length);
            }
        }
        
        // Фильтр по месяцу (только для статистики)
        if (includeMonthFilter) {
            filtered = filtered.filter(item => {
                if (!item.Дата) return false;
                const taskDate = new Date(item.Дата);
                return taskDate.getMonth() === this.currentMonth && taskDate.getFullYear() === this.currentYear;
            });
            logger.info('📅 Після фільтрації по поточному місяцю:', filtered.length);
        }
        
        logger.info('📊 Фінальні дані для календаря:', filtered.length);
        return filtered;
    }
    
    /**
     * Поиск изменений между API данными и существующими в Firebase
     */
    _findChangedTasks(apiData, existingTasks) {
        const newTasks = [];
        const rescheduledTasks = [];
        const unchangedTasks = [];
        const completedTasks = []; // ДОБАВЛЕНО: для закрытых задач
        
        logger.verbose(`🔍 Порівняння: ${apiData.length} API завдань з ${existingTasks.length} Firebase завданнями`);
        
        // Создаем Set ID задач из API для быстрого поиска
        const apiTaskIds = new Set(apiData.map(task => task.ID));
        
        for (const apiTask of apiData) {
            // Ищем существующую задачу по ID
            const existingTask = existingTasks.find(task => task.taskId === apiTask.ID);
            
            if (!existingTask) {
                // Новая задача
                newTasks.push(apiTask);
            } else {
                // ИСПРАВЛЕНО: Сравниваем с originalDate
                const isDateChanged = !this._compareDates(existingTask.originalDate, apiTask.Дата);
                
                if (isDateChanged) {
                    // Перенесенная задача
                    rescheduledTasks.push({
                        old: existingTask,
                        new: apiTask
                    });
                    
                    logger.info(`🔄 ПЕРЕНЕСЕНА: ID=${apiTask.ID}, Старая дата=${existingTask.originalDate}, Новая дата=${apiTask.Дата}`);
                } else {
                    // Без изменений
                    unchangedTasks.push(apiTask);
                }
            }
        }
        
        // ДОБАВЛЕНО: Проверяем закрытые задачи (есть в Firebase, но нет в API)
        for (const existingTask of existingTasks) {
            if (!apiTaskIds.has(existingTask.taskId)) {
                completedTasks.push(existingTask);
            }
        }
        
        logger.info(`📊 Результат аналізу: ${newTasks.length} нових, ${rescheduledTasks.length} перенесених, ${unchangedTasks.length} без змін, ${completedTasks.length} закрытых`);
        
        return { newTasks, rescheduledTasks, unchangedTasks, completedTasks };
    }

/**
 * Сохраняет только изменения в Firebase
 */
    async _saveOnlyChanges(newTasks, rescheduledTasks, completedTasks) {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) {
                logger.error('❌ ID компанії не знайдено');
                return;
            }
            
            let savedCount = 0;
            const totalChanges = newTasks.length + rescheduledTasks.length + completedTasks.length;
            
            if (totalChanges === 0) {
                logger.info('📝 Змін для збереження не знайдено');
                return;
            }
            
            logger.info(`📝 Зберігаємо ${totalChanges} змін...`);
            logger.info(`🆕 Нових завдань: ${newTasks.length}`);
            logger.info(`🔄 Перенесених завдань: ${rescheduledTasks.length}`);
            logger.info(`✅ Закрытых завдань: ${completedTasks.length}`);
            
            // Сохраняем новые задачи
            for (const task of newTasks) {
                try {
                    const success = await this._saveTaskToFirebase(task);
                    if (success) {
                        savedCount++;
                    }
                } catch (error) {
                    logger.error('❌ Помилка збереження нової задачі:', task.ID, error);
                }
            }
            
            // Обновляем перенесенные задачи (УДАЛЯЕМ старую и СОЗДАЕМ новую)
            for (const { old: oldTask, new: newTask } of rescheduledTasks) {
                try {
                    // Удаляем старую задачу
                    const oldTaskRef = firebase.doc(firebase.db, 'companies', companyId, 'managerCalendarTasks', oldTask.taskId);
                    await firebase.deleteDoc(oldTaskRef);
                    logger.info(`🗑️ Удалена старая задача: ID=${oldTask.taskId}, Дата=${oldTask.originalDate}`);
                    
                    // Создаем новую задачу с новыми данными
                    const success = await this._saveTaskToFirebase(newTask);
                    if (success) {
                        savedCount++;
                        logger.info(`✅ Создана новая задача: ID=${newTask.ID}, Дата=${newTask.Дата}`);
                    }
                } catch (error) {
                    logger.error('❌ Помилка оновлення перенесеної задачі:', newTask.ID, error);
                }
            }
            
            // ДОБАВЛЕНО: Обрабатываем закрытые задачи
            for (const completedTask of completedTasks) {
                try {
                    const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'managerCalendarTasks', completedTask.taskId);
                    await firebase.updateDoc(taskRef, {
                        status: 'completed',
                        lastUpdated: firebase.serverTimestamp()
                    });
                    savedCount++;
                } catch (error) {
                    logger.error('❌ Помилка закрытия задачи:', completedTask.taskId, error);
                }
            }
            
            logger.info(`✅ Збережено ${savedCount}/${totalChanges} змін`);
            
        } catch (error) {
            logger.error('❌ Помилка збереження змін:', error);
        }
    }

/**
     * Сохранение задачи в Firebase
     */
    async _saveTaskToFirebase(taskData) {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) {
                logger.error('❌ ID компанії не знайдено');
                return false;
            }
            
            // Проверяем права доступа
            const userPermissions = window.state?.currentUserPermissions || {};
            const hasPermission = userPermissions['manager_calendar_manage_tasks'] || 
                                userPermissions['manager_calendar_view_page'] ||
                                window.state?.currentUserRole === 'owner';
            
            if (!hasPermission) {
                logger.error('❌ Немає прав для збереження завдань');
                return false;
            }
            
            const taskId = taskData.ID;
            const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'managerCalendarTasks', taskId);
            const existingTask = await firebase.getDoc(taskRef);
            
            const managerInfo = this._findManagerDepartment(taskData.Менеджер);
            
            const taskDoc = {
                taskId: taskId, // Сохраняем ID как taskId для сравнения
                managerId: managerInfo?.managerId || null,
                managerName: taskData.Менеджер,
                departmentId: managerInfo?.departmentId || null,
                departmentName: managerInfo?.departmentName || 'Неизвестный отдел',
                clientName: taskData['Клиент.Название'],
                clientCode: taskData['Клиент.Код'],
                clientLink: taskData['Клиент.Ссылка'],
                taskDescription: taskData.Дело,
                originalDate: taskData.Дата, // ИСПРАВЛЕНО: используем только originalDate
                modifiedDate: taskData['Дата изменения'],
                status: this._determineTaskStatus(existingTask, taskData),
                lastUpdated: firebase.serverTimestamp(),
                companyId: companyId
            };
            
            await firebase.setDoc(taskRef, taskDoc);
            return true;
            
        } catch (error) {
            logger.error('❌ Помилка збереження задачі в Firebase:', error);
            return false;
        }
    }

/**
 * Рендеринг календаря
 */
    _renderCalendar() {
        this._updateAutoUpdateStatus('Рендеринг календаря...', 'text-blue-600');
        logger.info('📅 Рендеринг календаря...');
        
        try {
            // НЕ обновляем фильтры здесь - только при загрузке данных!
            // this._updateFilters(); ← УБРАНО
            
            // Фильтруем данные для календарной сетки (без фильтра месяца)
            const filteredData = this._filterData(false);
            
            // Фильтруем данные для статистики (с фильтром месяца)
            const statisticsData = this._filterData(true);
            
            // Диагностика для отладки
            if (logger.isDebugMode()) {
                console.log('📊 СТАТИСТИКА ДАННЫХ:');
                console.log('📦 Всего данных в календаре:', this.calendarData.length);
                console.log('🔍 После фильтрации (для календаря):', filteredData.length);
                console.log('📈 После фильтрации (для статистики + месяц):', statisticsData.length);
                console.log('📈 Статистика по статусам:', {
                    'новые': statisticsData.filter(task => task.status === 'new' || !task.status).length,
                    'перенесенные': statisticsData.filter(task => task.status === 'rescheduled').length,
                    'завершенные': statisticsData.filter(task => task.status === 'completed').length
                });
            }
            
            // Обновляем статистику с данными отфильтрованными по месяцу
            this._updateStatistics({
                totalTasks: statisticsData.length, // ← Теперь только текущий месяц
                newTasks: statisticsData.filter(task => task.status === 'new' || !task.status).length,
                rescheduledTasks: statisticsData.filter(task => task.status === 'rescheduled').length,
                completedTasks: statisticsData.filter(task => task.status === 'completed').length
            });
            
            // Обновляем отображение месяца
            this._updateCurrentMonthDisplay();
            
            // Рендерим календарную сетку
            this._renderCalendarGrid(filteredData);
            
            this._updateAutoUpdateStatus('Календар готовий', 'text-green-600');
            logger.info('✅ Календар відрендерено');
            
        } catch (error) {
            logger.error('❌ Помилка рендерингу календаря:', error);
            this._updateAutoUpdateStatus('Помилка рендерингу', 'text-red-600');
        }
    }
    
    /**
     * Получение названия месяца
     */
    _getMonthName(monthIndex) {
        const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                          'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
        return monthNames[monthIndex];
    }
    
    /**
     * Получение цвета для статуса
     */
    _getStatusColor(status) {
        switch (status) {
            case 'completed': 
            case 'виконаний': 
                return 'bg-green-500 text-white';
            case 'new': 
            case 'новий': 
                return 'bg-blue-500 text-white';
            case 'rescheduled': 
            case 'перенесений': 
                return 'bg-yellow-500 text-black';
            case 'cancelled': 
            case 'скасований': 
                return 'bg-red-500 text-white';
            default: 
                return 'bg-gray-500 text-white';
        }
    }
    
    _startAutoUpdate() {
        if (!this.autoUpdateInterval) {
            this.autoUpdateInterval = setInterval(() => {
                this._checkForUpdates();
            }, this.AUTO_UPDATE_INTERVAL);
            this._updateAutoUpdateStatus('Автооновлення увімкнено', 'text-green-600');
        }
    }
    
    _stopAutoUpdate() {
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
            this.autoUpdateInterval = null;
            this._updateAutoUpdateStatus('Автооновлення вимкнено', 'text-red-600');
        }
    }
    
    _toggleAutoUpdate() {
        if (this.autoUpdateInterval) {
            this._stopAutoUpdate();
        } else {
            this._startAutoUpdate();
        }
    }
    
    _changeMonth(direction) {
        const oldMonth = this.currentMonth;
        const oldYear = this.currentYear;
        
        this.currentMonth += direction;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        
        if (logger.isDebugMode()) {
            const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                              'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
            console.log('📅 Зміна місяця:', {
                'от': `${monthNames[oldMonth]} ${oldYear}`,
                'к': `${monthNames[this.currentMonth]} ${this.currentYear}`,
                'направление': direction > 0 ? 'вперед' : 'назад'
            });
        }
        
        this._updateCurrentMonthDisplay();
        this._renderCalendar(); // ← Это пересчитает статистику для нового месяца
    }
    
    _updateCurrentMonthDisplay() {
        if (this.elements.currentMonth) {
            const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                              'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
            this.elements.currentMonth.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        }
    }
    
    _refreshData() {
        this._loadData().then(() => this._renderCalendar());
    }
    
    _checkForUpdates() {
        if (this.isUpdateInProgress) {
            logger.verbose('🔄 Обновление уже в процессе, пропускаем');
            return;
        }
        
        logger.verbose('🔄 Проверка обновлений календаря...');
        this.isUpdateInProgress = true;
        
        // Перезагружаем данные
        this._loadData()
            .then(() => {
                this._renderCalendar();
                this.lastUpdateTime = Date.now();
                this._updateAutoUpdateStatus('Автооновлення активне', 'text-green-600');
            })
            .catch(error => {
                logger.error('❌ Ошибка при автообновлении:', error);
                this._updateAutoUpdateStatus('Помилка автооновлення', 'text-red-600');
            })
            .finally(() => {
                this.isUpdateInProgress = false;
            });
    }
    
    _renderAccessDenied() {
        this.container.innerHTML = `
            <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
                <p class="text-red-200">У вас немає прав для перегляду календаря менеджера.</p>
            </div>
        `;
    }
    
    _renderError(message) {
        this.container.innerHTML = `
            <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                <h2 class="text-2xl font-bold text-white mb-4">Помилка</h2>
                <p class="text-red-200">${message}</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    Спробувати ще раз
                </button>
            </div>
        `;
    }

    /**
     * Обновление фильтров
     */
    _updateFilters() {
        // Обновляем опции для отделов
        if (this.elements.departmentFilter) {
            const currentDepartment = this.selectedDepartment; // Сохраняем текущий выбор
            this.elements.departmentFilter.innerHTML = '<option value="">Всі відділи</option>';
            this.departmentsData.forEach(dept => {
        const option = document.createElement('option');
                option.value = dept.id || dept.name; // Поддерживаем старый формат
                option.textContent = dept.name || dept;
                this.elements.departmentFilter.appendChild(option);
            });
            // Восстанавливаем выбранное значение
            if (currentDepartment) {
                this.elements.departmentFilter.value = currentDepartment;
            }
        }
        
        // Обновляем опции для менеджеров
        if (this.elements.managerFilter) {
            const currentManager = this.selectedManager; // Сохраняем текущий выбор
            this.elements.managerFilter.innerHTML = '<option value="">Всі менеджери</option>';
            this.managersData.forEach(manager => {
            const option = document.createElement('option');
                option.value = manager.id || manager.name; // Поддерживаем старый формат
                option.textContent = manager.name || manager;
                this.elements.managerFilter.appendChild(option);
            });
            // Восстанавливаем выбранное значение
            if (currentManager) {
                this.elements.managerFilter.value = currentManager;
            }
        }
        
        // Логируем для отладки
        if (logger.isDebugMode()) {
            console.log('🔄 Фильтры обновлены:', {
                'отделы': this.departmentsData.length,
                'менеджеры': this.managersData.length,
                'выбранный отдел': this.selectedDepartment,
                'выбранный менеджер': this.selectedManager
            });
        }
    }
    
    /**
     * Рендеринг календарной сетки (восстановлен настоящий календарь)
     */
    _renderCalendarGrid(data) {
        if (!this.elements.content) return;
        
        // Генерируем календарную сетку дней
        const days = this._generateCalendarDays();
        
        this.elements.content.innerHTML = `
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
            
                <!-- Календарная сетка -->
            <div class="grid grid-cols-7">
                    ${days.map(day => this._renderCalendarDay(day, data)).join('')}
            </div>
        </div>
    `;
    }
    
    /**
     * Генерация дней календаря (42 дня - 6 недель)
     */
    _generateCalendarDays() {
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDate = new Date(startDate);
    
    // Генерируем ровно 6 недель (42 дня) для стабильной сетки
    for (let i = 0; i < 42; i++) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
        logger.verbose('📅 Згенеровано днів календаря:', days.length);
    return days;
}

/**
     * Рендеринг отдельного дня календаря
 */
    _renderCalendarDay(date, filteredData) {
        const isCurrentMonth = date.getMonth() === this.currentMonth;
        const isToday = date.toDateString() === new Date().toDateString();
        
        const dayData = filteredData.filter(item => {
            const itemDate = new Date(item.Дата);
            return itemDate.toDateString() === date.toDateString();
        });
        
        const taskCount = dayData.length;
        const uniqueManagers = new Set(dayData.map(item => item.Менеджер)).size;
        const uniqueClients = new Set(dayData.map(item => item['Клиент.Код'])).size;
        
        // Подсчитываем статусы задач
        const newTasksCount = dayData.filter(item => item.status === 'new').length;
        const rescheduledTasksCount = dayData.filter(item => item.status === 'rescheduled').length;
        const completedTasksCount = dayData.filter(item => item.status === 'completed').length;
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
            if (completedTasksCount > 0) {
                statusIndicator += `<div class="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" title="Закриті: ${completedTasksCount}"></div>`;
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
        
        return `
            <div class="${backgroundColor} p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors border-r border-b border-gray-200"
                 onclick="window.managerCalendarInstance?._showDayDetails('${date.toISOString()}', ${taskCount})">
                <div class="text-sm ${textColor} font-medium mb-1">
                    ${date.getDate()}
                </div>
                ${taskCount > 0 ? `
                    <div class="text-xs ${textColor}">
                        <div class="font-medium">${taskCount} справ</div>
                        ${newTasksCount > 0 ? `<div class="text-green-600">🆕 ${newTasksCount} нових</div>` : ''}
                        ${rescheduledTasksCount > 0 ? `<div class="text-yellow-600">🔄 ${rescheduledTasksCount} перенесених</div>` : ''}
                        ${completedTasksCount > 0 ? `<div class="text-red-600">✅ ${completedTasksCount} закритих</div>` : ''}
                        <div class="text-xs opacity-75">${uniqueManagers} менеджерів</div>
                        <div class="text-xs opacity-75">${uniqueClients} клієнтів</div>
                        ${statusIndicator ? `<div class="mt-1">${statusIndicator}</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

/**
     * Показ детализации дня (восстановлена полная функциональность)
 */
    _showDayDetails(dateString, taskCount) {
    if (taskCount === 0) return;
    
        logger.info('📅 Показ деталізації для:', dateString, 'завдань:', taskCount);
    
    const date = new Date(dateString);
        const dayData = this._filterData().filter(item => {
            const itemDate = new Date(item.Дата);
        return itemDate.toDateString() === date.toDateString();
    });
    
        logger.info('📊 Знайдено завдань для дня:', dayData.length);
    
    // Группировка по статусам задач
    const groupedByStatus = {
        new: [],
        rescheduled: [],
        completed: [],
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
                        ${this._renderTasksByManager(groupedByStatus.new)}
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
                        ${this._renderTasksByManager(groupedByStatus.rescheduled)}
                </details>
            </div>
        `;
    }
    
    // Затем закрытые задачи
    if (groupedByStatus.completed.length > 0) {
        contentHTML += `
            <div class="mb-6">
                <details class="group" open>
                    <summary class="text-lg font-bold text-red-700 mb-3 flex items-center cursor-pointer hover:text-red-600">
                        <span class="mr-2">✅</span> Закриті завдання (${groupedByStatus.completed.length})
                        <svg class="w-5 h-5 ml-auto transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </summary>
                        ${this._renderTasksByManager(groupedByStatus.completed)}
                </details>
            </div>
        `;
    }
    
    // И наконец активные задачи
    if (groupedByStatus.active.length > 0) {
        contentHTML += `
            <div class="mb-6">
                    <details class="group" ${groupedByStatus.new.length === 0 && groupedByStatus.rescheduled.length === 0 && groupedByStatus.completed.length === 0 ? 'open' : ''}>
                    <summary class="text-lg font-bold text-blue-700 mb-3 flex items-center cursor-pointer hover:text-blue-600">
                        <span class="mr-2">📋</span> Активні завдання (${groupedByStatus.active.length})
                        <svg class="w-5 h-5 ml-auto transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </summary>
                        ${this._renderTasksByManager(groupedByStatus.active)}
                </details>
            </div>
        `;
    }
    
        const modalContent = `
            <div class="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-bold text-gray-800">
                            📅 ${date.toLocaleDateString('uk-UA', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </h2>
                        <button onclick="window.managerCalendarInstance?._hideModal()" 
                                class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
                    <p class="text-gray-600 mt-1">Всього завдань: ${dayData.length}</p>
                </div>
                
                <div class="p-6">
                    ${contentHTML}
                </div>
        </div>
    `;
    
        this._showModal('', modalContent);
}

/**
 * Рендеринг задач по менеджерам
 */
    _renderTasksByManager(tasks) {
    // Группировка по менеджерам
    const groupedByManager = {};
    tasks.forEach(item => {
            const manager = item.Менеджер;
        if (!groupedByManager[manager]) {
            groupedByManager[manager] = [];
        }
        groupedByManager[manager].push(item);
    });
    
    // Сортируем задачи по времени
    Object.keys(groupedByManager).forEach(manager => {
        groupedByManager[manager].sort((a, b) => {
                const timeA = new Date(a.Дата).getTime();
                const timeB = new Date(b.Дата).getTime();
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
            } else if (task.status === 'completed') {
                statusClass = 'border-l-4 border-red-500';
                statusText = '✅ Завершена';
            }
            
            // Формируем ссылку на CRM из справочника клиентов
            const clientCode = task['Клиент.Код'];
            const clientName = task['Клиент.Название'];
            const crmLink = this._getClientCrmLink(clientCode, clientName);
            
            const crmButton = crmLink ? 
                `<a href="${crmLink}" target="_blank" 
                     class="inline-flex items-center px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors ml-2">
                     <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                </svg>
                     Відкрити в CRM
            </a>` : 
                 `<span class="inline-flex items-center px-3 py-1 bg-gray-300 text-gray-600 text-sm rounded-lg ml-2">
                     <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                         <path d="M18.364 5.636l-3.536 3.536m0 0L11.292 5.636m3.536 3.536L9.172 14.828"/>
                     </svg>
                     CRM не знайдено
                </span>`;
            
            managerHTML += `
                <div class="${statusClass} pl-3 py-2 bg-white rounded-lg shadow-sm">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="flex items-center mb-1">
                                <span class="text-sm font-medium text-gray-900">${taskTime}</span>
                                <span class="ml-2 text-xs px-2 py-1 rounded-full ${statusText.includes('Нова') ? 'bg-green-100 text-green-800' : statusText.includes('Перенесена') ? 'bg-yellow-100 text-yellow-800' : statusText.includes('Завершена') ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">${statusText}</span>
                                <span class="ml-2 text-xs text-gray-500">ID: ${task.ID}</span>
                            </div>
                            <div class="text-sm font-medium text-gray-800 mb-1">${task.Дело}</div>
                            <div class="text-sm text-gray-600">${task['Клиент.Название']} (${task['Клиент.Код']})</div>
                        </div>
                        <div class="ml-4">
                            ${crmButton}
                        </div>
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
     * Загрузка справочника клиентов для CRM ссылок
     */
    async _loadClientLinks() {
        logger.info('🔗 Загрузка справочника клиентов...');
        
        try {
            const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            logger.info('🔗 Справочник клиентов получен:', Array.isArray(data) ? `${data.length} записей` : typeof data);
            
            if (Array.isArray(data) && data.length > 0) {
                // Создаем карты поиска - и по коду, и по имени клиента
                this.clientLinks = {};
                this.clientLinksByName = {};
                
                data.forEach(item => {
                    const clientCode = item['Клиент.Код'];
                    const clientName = item['Клиент.Название'];
                    const clientLink = item['посилання'];
                    
                    if (clientLink) {
                        // Поиск по коду клиента
                        if (clientCode) {
                            this.clientLinks[clientCode] = clientLink;
                        }
                        
                        // Поиск по имени клиента (основной способ)
                        if (clientName) {
                            this.clientLinksByName[clientName] = clientLink;
                        }
                    }
                });
                
                logger.info(`✅ Загружено CRM ссылок: ${Object.keys(this.clientLinks).length} по кодам, ${Object.keys(this.clientLinksByName).length} по именам`);
                
                if (logger.isDebugMode()) {
                    console.log('🔗 Примеры ссылок по кодам:', Object.entries(this.clientLinks).slice(0, 3));
                    console.log('🔗 Примеры ссылок по именам:', Object.entries(this.clientLinksByName).slice(0, 3));
                }
        } else {
                logger.warn('⚠️ Справочник клиентов пуст или некорректен');
                this.clientLinks = {};
                this.clientLinksByName = {};
            }
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки справочника клиентов:', error);
            this.clientLinks = {};
            this.clientLinksByName = {};
        }
    }

/**
     * Получение CRM ссылки по имени или коду клиента
     */
    _getClientCrmLink(clientCode, clientName) {
        // Сначала ищем по имени клиента (основной способ)
        if (clientName && this.clientLinksByName[clientName]) {
            return this.clientLinksByName[clientName];
        }
        
        // Если не найдено по имени, ищем по коду
        if (clientCode && this.clientLinks[clientCode]) {
            return this.clientLinks[clientCode];
        }
        
        // Если ничего не найдено
        return null;
    }
    
    /**
     * Поиск отдела менеджера по имени
     */
    _findManagerDepartment(managerName) {
        if (!managerName) return null;
        
        // Ищем менеджера в данных
        const manager = this.managersData.find(mgr => 
            mgr.name === managerName || mgr.id === managerName
        );
        
        if (manager) {
            // Ищем отдел по ID отдела менеджера
            let departmentName = 'Неизвестный отдел';
            let departmentId = null;
            
            if (manager.department) {
                // Если у менеджера есть ID отдела, ищем отдел по этому ID
                const department = this.departmentsData.find(dept => 
                    dept.id === manager.department || dept.name === manager.department
                );
                
                if (department) {
                    departmentName = department.name;
                    departmentId = department.id;
                }
            }
            
            return {
                managerId: manager.id,
                managerName: manager.name,
                departmentName: departmentName,
                departmentId: departmentId
            };
        }
        
        // Если не нашли, возвращаем базовую информацию
        return {
            managerId: null,
            managerName: managerName,
            departmentName: 'Неизвестный отдел',
            departmentId: null
        };
    }
    
    /**
     * Поиск ID менеджера по имени
     */
    _findManagerIdByName(managerName) {
        if (!managerName) return null;
        
        const manager = this.managersData.find(mgr => 
            mgr.name === managerName || mgr.id === managerName
        );
        
        return manager ? manager.id : null;
    }
    
    /**
     * Поиск ID отдела по названию
     */
    _findDepartmentIdByName(departmentName) {
        if (!departmentName) return null;
        
        const department = this.departmentsData.find(dept => 
            dept.name === departmentName || dept.id === departmentName
        );
        
        return department ? department.id : null;
    }
    
    /**
     * Определение статуса задачи
     */
    _determineTaskStatus(existingTask, newTaskData) {
        if (!existingTask.exists()) {
            return 'new';
        }
        
        const existingData = existingTask.data();
        
        // ИСПРАВЛЕНО: Сравниваем с originalDate, а не с scheduledDate
        const isDateChanged = !this._compareDates(existingData.originalDate, newTaskData.Дата);
        
        if (isDateChanged) {
            return 'rescheduled';
        }
        
        return existingData.status || 'active';
    }

    /**
     * Нормализует дату для корректного сравнения (убирает проблемы с часовыми поясами)
     */
    _normalizeDate(dateString) {
        if (!dateString) return null;
        
        // Если дата уже в ISO формате (с T и Z), оставляем как есть
        if (dateString.includes('T') && dateString.includes('Z')) {
            return new Date(dateString);
        }
        
        // Если дата в формате "YYYY-MM-DD HH:mm:ss" (без T и Z)
        if (dateString.includes(' ') && !dateString.includes('T')) {
            // Преобразуем в локальное время
            const [datePart, timePart] = dateString.split(' ');
            const [year, month, day] = datePart.split('-');
            const [hour, minute, second] = timePart.split(':');
            
            // Создаем дату в локальном времени
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                          parseInt(hour), parseInt(minute), parseInt(second));
        }
        
        // Для других форматов используем стандартный парсер
        return new Date(dateString);
    }
    
    /**
     * Сравнивает две даты с учетом часовых поясов
     */
    _compareDates(date1, date2, toleranceMinutes = 1) {
        if (!date1 || !date2) return false;
        
        const normalized1 = this._normalizeDate(date1);
        const normalized2 = this._normalizeDate(date2);
        
        if (!normalized1 || !normalized2) return false;
        
        const diffMs = Math.abs(normalized1.getTime() - normalized2.getTime());
        const diffMinutes = diffMs / (1000 * 60);
        
        return diffMinutes <= toleranceMinutes;
    }
}

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ИНТЕГРАЦИИ ===

// Единственный экземпляр модуля
let managerCalendarInstance = null;

/**
 * Инициализация модуля календаря менеджера
 */
window.initManagerCalendarModule = async function(container) {
    logger.info('🚀 Инициализация модуля календаря менеджера');
    
    // Если экземпляр уже есть - используем логику восстановления
    if (managerCalendarInstance) {
        if (managerCalendarInstance.isFrozen) {
            logger.info('🔄 Восстановление календаря из замороженного состояния');
            await managerCalendarInstance.init(container); // Встроенная логика восстановления
        } else if (!managerCalendarInstance.isInitialized) {
            logger.info('🔄 Переинициализация существующего экземпляра');
            await managerCalendarInstance.init(container);
    } else {
            logger.info('✅ Календарь уже инициализирован');
        }
    } else {
        // Создаем экземпляр только если его нет
        logger.info('🆕 Создание нового экземпляра календаря');
        managerCalendarInstance = new ManagerCalendar();
        window.managerCalendarInstance = managerCalendarInstance;
        await managerCalendarInstance.init(container);
    }
};

/**
 * Очистка модуля календаря менеджера (теперь использует заморозку по умолчанию)
 */
window.cleanupManagerCalendarModule = function() {
    logger.info('❄️ Заморозка модуля календаря менеджера (сохранение состояния)');
    
    if (managerCalendarInstance) {
        managerCalendarInstance.freeze(); // Используем заморозку вместо полной очистки
    }
};

/**
 * Полная очистка модуля календаря менеджера (используется только при необходимости)
 */
window.destroyManagerCalendarModule = function() {
    logger.info('🧹 Полная очистка модуля календаря менеджера');
    
    if (managerCalendarInstance) {
        managerCalendarInstance.cleanup();
        managerCalendarInstance = null;
        window.managerCalendarInstance = null;
    }
};

// Экспорт для использования как ES модуль
export { ManagerCalendar };
export const initManagerCalendarModule = window.initManagerCalendarModule;
export const cleanupManagerCalendarModule = window.cleanupManagerCalendarModule;