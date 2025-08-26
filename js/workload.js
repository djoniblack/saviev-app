// workload.js - Модуль анализа навантаження менеджерів
import * as firebase from './firebase.js';

// === НАСТРОЙКИ ОТЛАДКИ ===
const WORKLOAD_DEBUG_MODE = window.location.hostname === 'localhost' || 
                           window.location.search.includes('debug=true') ||
                           localStorage.getItem('workloadDebugMode') === 'true';

const WORKLOAD_LOG_LEVEL = WORKLOAD_DEBUG_MODE ? 'verbose' : 'error';

const logger = {
    verbose: (...args) => WORKLOAD_DEBUG_MODE && WORKLOAD_LOG_LEVEL === 'verbose' && console.log('[WORKLOAD VERBOSE]', ...args),
    info: (...args) => ['verbose', 'info'].includes(WORKLOAD_LOG_LEVEL) && console.log('[WORKLOAD INFO]', ...args),
    warn: (...args) => ['verbose', 'info', 'warn'].includes(WORKLOAD_LOG_LEVEL) && console.warn('[WORKLOAD WARN]', ...args),
    error: (...args) => console.error('[WORKLOAD ERROR]', ...args)
};

// Функция для включения/выключения отладки
window.toggleWorkloadDebug = function() {
    const newMode = !WORKLOAD_DEBUG_MODE;
    localStorage.setItem('workloadDebugMode', newMode.toString());
    logger.info(`Режим отладки workload ${newMode ? 'включен' : 'выключен'}. Перезагрузите страницу.`);
};

/**
 * Класс для управления модулем навантаження менеджерів
 */
class WorkloadModule {
    constructor() {
        // === СОСТОЯНИЕ МОДУЛЯ ===
        this.isInitialized = false;
        this.isFrozen = false;
        this.container = null;
        this.elements = {};
        
        // === ДАННЫЕ ===
        this.workloadData = [];
        this.managersData = [];
        this.departmentsData = [];
        this.salesData = [];
        this.clientsData = [];
        this.tasksData = [];
        this.clientLinks = {};
        
        // === ФИЛЬТРЫ ===
        // Устанавливаем период по умолчанию на текущий месяц
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
        
        this.filters = {
            department: '',
            manager: '',
            period: 'current_month', // Изменено с '3' на 'current_month'
            dateFrom: firstDayOfMonth.toISOString().split('T')[0], // YYYY-MM-DD
            dateTo: lastDayOfMonth.toISOString().split('T')[0], // YYYY-MM-DD
            status: '',
            search: ''
        };
        
        // === КЭШИ ===
        this.renderCache = new Map();
        this.eventListeners = new Map();
        
        // === АВТООБНОВЛЕНИЕ ===
        this.autoUpdateInterval = null;
        this.lastUpdateTime = null;
        this.isAutoUpdateEnabled = true;
        this.isUpdateInProgress = false;
        this.AUTO_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 минут
    }
    
    /**
     * Главная функция инициализации модуля
     */
    async init(container) {
        logger.info('📊 Инициализация модуля навантаження...');
        
        // Если модуль был заморожен, восстанавливаем его
        if (this.isFrozen && this.isInitialized) {
            logger.info('🔄 Восстановление модуля из замороженного состояния');
            this.isFrozen = false;
            this.container = container;
            this._createHTMLStructure();
            this._cacheElements();
            this._initEventListeners();
            this._renderWorkload();
            if (this.isAutoUpdateEnabled) {
                this._startAutoUpdate();
            }
            logger.info('✅ Модуль восстановлен из кэша');
            return;
        }
        
        // Предотвращаем повторную инициализацию
        if (this.isInitialized) {
            logger.warn('⚠️ Модуль навантаження уже инициализирован');
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
            
            // Создаем HTML структуру
            this._createHTMLStructure();
            
            // Кэшируем DOM элементы
            this._cacheElements();
            
            // Инициализируем обработчики событий
            this._initEventListeners();
            
            // Загружаем данные
            await this._loadData();
            
            // Рассчитываем метрики
            this._calculateMetrics();
            
            // Рендерим начальное состояние
            this._renderWorkload();
            
            // Запускаем автообновление
            if (this.isAutoUpdateEnabled) {
                this._startAutoUpdate();
            }
            
            this.isInitialized = true;
            logger.info('✅ Модуль навантаження успешно инициализирован');
            
        } catch (error) {
            logger.error('❌ Ошибка инициализации модуля навантаження:', error);
            this._renderError('Не удалось загрузить модуль навантаження');
        }
    }
    
    /**
     * "Мягкая" очистка - заморозка модуля с сохранением данных
     */
    freeze() {
        logger.info('❄️ Заморозка модуля навантаження (сохранение состояния)...');
        
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
            logger.info('❄️ Модуль заморожен (данные сохранены)');
            
        } catch (error) {
            logger.error('❌ Ошибка заморозки модуля:', error);
        }
    }
    
    /**
     * Полная очистка модуля
     */
    cleanup() {
        logger.info('🧹 Полная очистка модуля навантаження...');
        
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
            this.workloadData = [];
            this.managersData = [];
            this.departmentsData = [];
            this.salesData = [];
            this.clientsData = [];
            this.tasksData = [];
            this.clientLinks = {};
            this.filters = {
                department: '',
                manager: '',
                period: '3',
                dateFrom: '',
                dateTo: '',
                status: '',
                search: ''
            };
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
            logger.info('✅ Модуль навантаження полностью очищен');
            
        } catch (error) {
            logger.error('❌ Ошибка очистки модуля:', error);
        }
    }
    
    /**
     * Функция валидации и отладки данных (как в departmentDashboard.js)
     */
    _validateAndDebugData() {
        logger.info('=== ВАЛІДАЦІЯ ДАНИХ ===');
        logger.info('Записи продаж:', this.salesData.length);
        logger.info('Співробітники:', this.managersData.length);
        logger.info('Відділи:', this.departmentsData.length);
        logger.info('Клієнти:', this.clientsData.length);
        logger.info('Задачі:', this.tasksData.length);
        
        // Анализ структуры данных продаж
        if (this.salesData.length > 0) {
            logger.info('Приклад записи продаж:', this.salesData[0]);
            logger.info('Поля в записах продаж:', Object.keys(this.salesData[0]));
            
            // Анализ дат продаж
            const julyDate = new Date('2025-07-01');
            const beforeJuly = this.salesData.filter(sale => {
                const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                return saleDate < julyDate;
            }).length;
            const fromJuly = this.salesData.filter(sale => {
                const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                return saleDate >= julyDate;
            }).length;
            
            logger.info('Розподіл продаж по датах:');
            logger.info('  - До липня 2025:', beforeJuly);
            logger.info('  - З липня 2025:', fromJuly);
            
            // Показываем диапазон дат
            const dates = this.salesData.map(sale => new Date(sale['Дата'] || sale['Date'] || '')).filter(date => !isNaN(date));
            if (dates.length > 0) {
                const minDate = new Date(Math.min(...dates));
                const maxDate = new Date(Math.max(...dates));
                logger.info('Діапазон дат продаж:', minDate.toLocaleDateString('uk-UA'), '-', maxDate.toLocaleDateString('uk-UA'));
            }
        }
        
        // Анализ сотрудников
        if (this.managersData.length > 0) {
            logger.info('Приклад співробітника:', this.managersData[0]);
            logger.info('Співробітники з відділами:', this.managersData.filter(emp => emp.department).length);
        }
        
        // Анализ задач
        if (this.tasksData.length > 0) {
            logger.info('Приклад задачі:', this.tasksData[0]);
            logger.info('Завершені задачі:', this.tasksData.filter(task => 
                task.status === 'completed' || task.status === 'завершено'
            ).length);
        }
        
        logger.info('=== КІНЕЦЬ ВАЛІДАЦІЇ ===');
    }
    
    /**
     * Проверка прав доступа
     */
    _checkPermissions() {
        try {
            return window.hasPermission?.('workload_view_page') ?? true;
        } catch (error) {
            logger.error('❌ Ошибка проверки прав:', error);
            return true; // Fallback
        }
    }
    
    /**
     * Создание HTML структуры модуля
     */
    _createHTMLStructure() {
        this.container.innerHTML = `
            <div class="workload-module bg-gray-800 rounded-xl shadow-lg p-6">
                <!-- Заголовок с вкладками -->
                <div class="workload-header mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-2xl font-bold text-white">Навантаження менеджерів</h2>
                        <div class="workload-controls flex items-center gap-4">
                            <div id="autoUpdateStatus" class="text-sm text-gray-400">Завантаження...</div>
                            <button id="autoUpdateToggle" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                Автооновлення
                            </button>
                        </div>
                    </div>
                    
                    <!-- Вкладки -->
                    <div class="workload-tabs flex border-b border-gray-600">
                        <button id="dashboardTab" class="workload-tab px-4 py-2 text-white border-b-2 border-blue-500 bg-blue-600 bg-opacity-20">
                            📊 Дашборд
                        </button>
                        <button id="tableTab" class="workload-tab px-4 py-2 text-gray-300 hover:text-white border-b-2 border-transparent hover:border-gray-500">
                            📋 Таблиця
                        </button>
                        <button id="analyticsTab" class="workload-tab px-4 py-2 text-gray-300 hover:text-white border-b-2 border-transparent hover:border-gray-500">
                            📈 Аналітика
                        </button>
                    </div>
                </div>
                
                <!-- Фильтры -->
                <div class="workload-filters bg-gray-700 rounded-lg p-4 mb-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                            <label class="block text-sm font-medium text-gray-300 mb-1">Період</label>
                            <select id="periodFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                                <option value="current_month" selected>Поточний місяць</option>
                                <option value="1">1 місяць</option>
                                <option value="3">3 місяці</option>
                                <option value="6">6 місяців</option>
                                <option value="12">12 місяців</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Дата з</label>
                            <input type="date" id="dateFromFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Дата по</label>
                            <input type="date" id="dateToFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Дії</label>
                            <button id="refreshData" class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                                Оновити
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Контент -->
                <div id="workloadContent" class="workload-content">
                    <div class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                        <p class="text-gray-200">Завантаження даних навантаження...</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Кэширование DOM элементов
     */
    _cacheElements() {
        this.elements = {
            // Вкладки
            dashboardTab: this.container.querySelector('#dashboardTab'),
            tableTab: this.container.querySelector('#tableTab'),
            analyticsTab: this.container.querySelector('#analyticsTab'),
            
            // Контролы
            autoUpdateStatus: this.container.querySelector('#autoUpdateStatus'),
            autoUpdateToggle: this.container.querySelector('#autoUpdateToggle'),
            refreshData: this.container.querySelector('#refreshData'),
            
            // Фильтры
            departmentFilter: this.container.querySelector('#departmentFilter'),
            managerFilter: this.container.querySelector('#managerFilter'),
            periodFilter: this.container.querySelector('#periodFilter'),
            dateFromFilter: this.container.querySelector('#dateFromFilter'),
            dateToFilter: this.container.querySelector('#dateToFilter'),
            
            // Контент
            content: this.container.querySelector('#workloadContent')
        };
        
        logger.verbose('📝 DOM элементы закэшированы');
    }
    
    /**
     * Инициализация обработчиков событий
     */
    _initEventListeners() {
        // Вкладки
        this._addEventListener('dashboardTab', 'click', () => this._switchTab('dashboard'));
        this._addEventListener('tableTab', 'click', () => this._switchTab('table'));
        this._addEventListener('analyticsTab', 'click', () => this._switchTab('analytics'));
        
        // Автообновление
        this._addEventListener('autoUpdateToggle', 'click', () => this._toggleAutoUpdate());
        this._addEventListener('refreshData', 'click', () => this._refreshData());
        
        // Фильтры
        this._addEventListener('departmentFilter', 'change', (e) => {
            this.filters.department = e.target.value;
            this._updateManagersFilter();
            this._applyFilters();
        });
        
        this._addEventListener('managerFilter', 'change', (e) => {
            this.filters.manager = e.target.value;
            this._applyFilters();
        });
        
        this._addEventListener('periodFilter', 'change', (e) => {
            this.filters.period = e.target.value;
            this._applyFilters();
        });
        
        this._addEventListener('dateFromFilter', 'change', (e) => {
            this.filters.dateFrom = e.target.value;
            this._applyFilters();
        });
        
        this._addEventListener('dateToFilter', 'change', (e) => {
            this.filters.dateTo = e.target.value;
            this._applyFilters();
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
     * Переключение вкладок
     */
    _switchTab(tabName) {
        // Обновляем стили вкладок
        const allTabs = this.container.querySelectorAll('.workload-tab');
        allTabs.forEach(tab => {
            tab.classList.remove('text-white', 'border-blue-500', 'bg-blue-600', 'bg-opacity-20');
            tab.classList.add('text-gray-300', 'border-transparent');
        });
        
        // Активируем нужную вкладку
        const activeTab = this.container.querySelector(`#${tabName}Tab`);
        if (activeTab) {
            activeTab.classList.remove('text-gray-300', 'border-transparent');
            activeTab.classList.add('text-white', 'border-blue-500', 'bg-blue-600', 'bg-opacity-20');
        }
        
        // Рендерим соответствующий контент
        switch(tabName) {
            case 'dashboard':
                this._renderDashboard();
                break;
            case 'table':
                this._renderTable();
                break;
            case 'analytics':
                this._renderAnalytics();
                break;
        }
        
        logger.info(`📊 Переключение на вкладку: ${tabName}`);
    }
    
    /**
     * Обновление статуса автообновления
     */
    _updateAutoUpdateStatus(message, className = 'text-gray-400') {
        if (this.elements.autoUpdateStatus) {
            this.elements.autoUpdateStatus.textContent = message;
            this.elements.autoUpdateStatus.className = `text-sm ${className}`;
        }
    }
    
    /**
     * Показ ошибки доступа
     */
    _renderAccessDenied() {
        this.container.innerHTML = `
            <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
                <p class="text-red-200">У вас немає прав для перегляду навантаження менеджерів.</p>
            </div>
        `;
    }
    
    /**
     * Показ ошибки
     */
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
    
    // === ЗАГЛУШКИ ДЛЯ СЛЕДУЮЩИХ ЭТАПОВ ===
    
    async _loadData() {
        logger.info('📊 Загрузка данных навантаження...');
        
        try {
            // Загружаем данные сотрудников и отделов
            const { managers, departments } = await this._loadEmployeesAndDepartments();
            this.managersData = managers;
            this.departmentsData = departments;
            
            // Загружаем данные продаж
            await this._loadSalesData();
            
            // Загружаем данные клиентов
            await this._loadClientsData();
            
            // Загружаем данные задач
            await this._loadTasksData();
            
            // Загружаем справочник ссылок на клиентов
            await this._loadClientLinks();
            
            // Заполняем фильтры
            this._populateFilters();
            
            logger.info('✅ Все данные загружены успешно');
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных:', error);
            throw error;
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

            // Фильтруем менеджеров по критериям (как в других модулях)
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
            
            return {
                managers: managers,
                departments: departments
            };
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки сотрудников и отделов:', error);
            return { managers: [], departments: [] };
        }
    }
    
    /**
     * Загрузка данных продаж
     */
    async _loadSalesData() {
        try {
            logger.info('📊 Завантаження даних продаж...');
            
            // Получаем данные из разных источников
            const [staticDataRes, apiDataRes, refDataRes] = await Promise.all([
                fetch('модуль помічник продажу/data.json'),
                fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
                fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url')
            ]);
            
            const staticData = await staticDataRes.json();
            const apiData = await apiDataRes.json();
            const refData = await refDataRes.json();
            
            // Объединяем данные продаж с учетом дат
            // Статические данные до 07.2025, API данные с 07.2025
            const cutoffDate = new Date('2025-07-01');
            
            const filteredStaticData = staticData.filter(sale => {
                const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                return saleDate < cutoffDate;
            });
            
            const filteredApiData = apiData.filter(sale => {
                const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                return saleDate >= cutoffDate;
            });
            
            this.salesData = [...filteredStaticData, ...filteredApiData];
            
            logger.info(`📊 Статичні дані (до 07.2025): ${filteredStaticData.length} записів`);
            logger.info(`📊 API дані (з 07.2025): ${filteredApiData.length} записів`);
            logger.info(`📊 Всього записів: ${this.salesData.length}`);
            
            // Создаем справочник ссылок на клиентов
            this.clientLinks = Object.fromEntries(
                refData.map(item => [item['Клиент.Код'], item['посилання']])
            );
            
            logger.info(`📊 Завантажено ${this.salesData.length} записів продаж`);
            logger.info(`🔗 Завантажено ${Object.keys(this.clientLinks).length} посилань на клієнтів`);
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных продаж:', error);
            this.salesData = [];
            this.clientLinks = {};
        }
    }
    
    /**
     * Загрузка данных клиентов
     */
    async _loadClientsData() {
        try {
            logger.info('👥 Завантаження даних клієнтів...');
            
            // ИСПРАВЛЕНИЕ: Загружаем ВСЕХ клиентов из справочника (как в departmentDashboard.js)
            const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
            const clientsFromAPI = await response.json();
            
            // Создаем справочник клиентов
            const clientManagerDirectory = {};
            clientsFromAPI.forEach(item => {
                const code = item['Клиент.Код'] || item['Клієнт.Код'];
                if (code) {
                    clientManagerDirectory[code] = {
                        manager: item['Менеджер'],
                        link: item['посилання'],
                        name: item['Клиент.Название'] || code
                    };
                }
            });
            
            logger.info(`👥 Завантажено справочник клієнт-менеджер: ${Object.keys(clientManagerDirectory).length} записів`);
            
            // Создаем полный список клиентов для каждого менеджера
            const clientsMap = new Map();
            
            // Добавляем ВСЕХ клиентов из справочника
            Object.entries(clientManagerDirectory).forEach(([clientCode, clientInfo]) => {
                clientsMap.set(clientCode, {
                    code: clientCode,
                    name: clientInfo.name,
                    manager: clientInfo.manager,
                    sphere: '', // Будет заполнено из данных продаж
                    link: clientInfo.link || '',
                    firstSale: null,
                    lastSale: null,
                    totalRevenue: 0,
                    salesCount: 0,
                    sales: [] // Будет заполнено из данных продаж
                });
            });
            
            // Теперь обогащаем данные продажами
            this.salesData.forEach(sale => {
                const clientCode = sale['Клієнт.Код'] || sale['Клиент.Код'] || sale['Клиент'] || '';
                const clientName = sale['Клієнт'] || sale['Клиент'] || clientCode;
                const manager = sale['Основной менеджер'] || sale['Менеджер'] || '';
                const sphere = sale['Сфера деятельности'] || '';
                const date = new Date(sale['Дата']);
                const revenue = parseFloat(sale['Выручка']?.toString().replace(/\s/g, '').replace(',', '.')) || 0;
                
                if (clientsMap.has(clientCode)) {
                    // Обновляем существующего клиента
                    const client = clientsMap.get(clientCode);
                    client.sphere = sphere || client.sphere;
                    client.lastSale = date > (client.lastSale || new Date(0)) ? date : client.lastSale;
                    client.firstSale = date < (client.firstSale || new Date(9999, 11, 31)) ? date : client.firstSale;
                    client.totalRevenue += revenue;
                    client.salesCount++;
                    client.sales.push(sale);
                } else {
                    // Добавляем нового клиента (если его нет в справочнике)
                    clientsMap.set(clientCode, {
                        code: clientCode,
                        name: clientName,
                        manager: manager,
                        sphere: sphere,
                        link: this.clientLinks[clientCode] || '',
                        firstSale: date,
                        lastSale: date,
                        totalRevenue: revenue,
                        salesCount: 1,
                        sales: [sale]
                    });
                }
            });
            
            this.clientsData = Array.from(clientsMap.values());
            
            logger.info(`👥 Завантажено ${this.clientsData.length} клієнтів (включаючи всіх з довідника)`);
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных клиентов:', error);
            this.clientsData = [];
        }
    }
    
    /**
     * Загрузка данных задач
     */
    async _loadTasksData() {
        try {
            logger.info('📋 Завантаження даних завдань...');
            
            const companyId = window.state?.currentCompanyId;
            if (!companyId) {
                logger.warn('⚠️ ID компанії не знайдено, пропускаємо завантаження завдань');
                this.tasksData = [];
                return;
            }
            
            // Загружаем задачи из Firebase
            const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'managerCalendarTasks');
            const tasksSnapshot = await firebase.getDocs(tasksRef);
            
            this.tasksData = [];
            tasksSnapshot.forEach(doc => {
                const data = doc.data();
                this.tasksData.push({
                    taskId: data.taskId,
                    ID: data.taskId,
                    Дата: data.originalDate,
                    'Дата изменения': data.modifiedDate || data.originalDate,
                    Дело: data.taskDescription,
                    Менеджер: data.managerName,
                    'Клиент.Название': data.clientName,
                    'Клиент.Код': data.clientCode,
                    'Клиент.Ссылка': data.clientLink || '',
                    departmentName: data.departmentName,
                    status: data.status || 'active',
                    originalDate: data.originalDate
                });
            });
            
            logger.info(`📋 Завантажено ${this.tasksData.length} завдань з Firebase`);
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных задач:', error);
            this.tasksData = [];
        }
    }
    
    /**
     * Загрузка справочника ссылок на клиентов
     */
    async _loadClientLinks() {
        try {
            // Справочник уже загружен в _loadSalesData()
            logger.info(`🔗 Справочник посилань на клієнтів готовий: ${Object.keys(this.clientLinks).length} записів`);
        } catch (error) {
            logger.error('❌ Ошибка загрузки справочника ссылок:', error);
            this.clientLinks = {};
        }
    }
    
    /**
     * Заполнение фильтров данными
     */
    _populateFilters() {
        try {
            // Заполняем фильтр отделов
            const departmentFilter = this.elements.departmentFilter;
            if (departmentFilter) {
                departmentFilter.innerHTML = '<option value="">Всі відділи</option>';
                this.departmentsData.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name;
                    departmentFilter.appendChild(option);
                });
            }
            
            // Заполняем фильтр менеджеров
            const managerFilter = this.elements.managerFilter;
            if (managerFilter) {
                managerFilter.innerHTML = '<option value="">Всі менеджери</option>';
                this.managersData.forEach(manager => {
                    const option = document.createElement('option');
                    option.value = manager.id;
                    option.textContent = manager.name;
                    managerFilter.appendChild(option);
                });
            }
            
            // Устанавливаем значения по умолчанию для дат
            const dateFromFilter = this.elements.dateFromFilter;
            const dateToFilter = this.elements.dateToFilter;
            const periodFilter = this.elements.periodFilter;
            
            if (dateFromFilter && dateToFilter && periodFilter) {
                dateFromFilter.value = this.filters.dateFrom;
                dateToFilter.value = this.filters.dateTo;
                periodFilter.value = this.filters.period;
            }
            
            logger.info('✅ Фільтри заповнені даними');
            
        } catch (error) {
            logger.error('❌ Ошибка заполнения фильтров:', error);
        }
    }
    
    /**
     * Обновление фильтра менеджеров при изменении отдела
     */
    _updateManagersFilter() {
        try {
            const departmentFilter = this.elements.departmentFilter;
            const managerFilter = this.elements.managerFilter;
            
            if (!departmentFilter || !managerFilter) return;
            
            const selectedDepartment = departmentFilter.value;
            
            // Очищаем текущий список менеджеров
            managerFilter.innerHTML = '<option value="">Всі менеджери</option>';
            
            // Фильтруем менеджеров по выбранному отделу
            const filteredManagers = selectedDepartment 
                ? this.managersData.filter(manager => manager.department === selectedDepartment)
                : this.managersData;
            
            // Добавляем отфильтрованных менеджеров
            filteredManagers.forEach(manager => {
                const option = document.createElement('option');
                option.value = manager.id;
                option.textContent = manager.name;
                managerFilter.appendChild(option);
            });
            
            // Сбрасываем выбранного менеджера
            managerFilter.value = '';
            this.filters.manager = '';
            
            logger.info(`🔄 Фільтр менеджерів оновлено: ${filteredManagers.length} менеджерів для відділу ${selectedDepartment || 'всі'}`);
            
        } catch (error) {
            logger.error('❌ Ошибка обновления фильтра менеджеров:', error);
        }
    }
    
    /**
     * Сортировка таблицы
     */
    _sortTable(field) {
        try {
            logger.info(`🔄 Сортування таблиці по полю: ${field}`);
            
            // Сортируем данные
            this.workloadData.sort((a, b) => b[field] - a[field]);
            
            // Перерисовываем таблицу
            this._renderTable();
            
        } catch (error) {
            logger.error('❌ Ошибка сортировки таблицы:', error);
        }
    }
    
    /**
     * Применение фильтров к данным
     */
    _applyFilters() {
        try {
            logger.info('🔍 Застосування фільтрів...');
            
            // Получаем отфильтрованные данные
            const filteredData = this._getFilteredData();
            
            // ИСПРАВЛЕНИЕ: Перерисовываем активную вкладку вместо общего отображения
            const activeTab = this.container.querySelector('.workload-tab.text-white');
            logger.verbose('🔍 Активная вкладка:', activeTab ? activeTab.id : 'не найдена');
            
            if (activeTab) {
                const tabName = activeTab.id.replace('Tab', '');
                logger.verbose('📊 Перерисовка вкладки:', tabName);
                
                switch(tabName) {
                    case 'dashboard':
                        this._renderDashboard();
                        break;
                    case 'table':
                        this._renderTable();
                        break;
                    case 'analytics':
                        this._renderAnalytics();
                        break;
                    default:
                        logger.warn('⚠️ Неизвестная вкладка:', tabName, 'показываем дашборд');
                        this._renderDashboard();
                }
            } else {
                // Если нет активной вкладки, показываем дашборд
                logger.warn('⚠️ Активная вкладка не найдена, показываем дашборд');
                this._renderDashboard();
            }
            
            logger.info(`✅ Фільтри застосовано, показано ${filteredData.length} записів`);
            
        } catch (error) {
            logger.error('❌ Ошибка применения фильтров:', error);
        }
    }
    
    /**
     * Получение отфильтрованных данных
     */
    _getFilteredData() {
        let filteredData = [...this.workloadData];
        
        logger.verbose('🔍 Начальная фильтрация:', {
            totalRecords: this.workloadData.length,
            filters: this.filters
        });
        
        // Фильтр по отделу
        if (this.filters.department) {
            filteredData = filteredData.filter(item => 
                item.departmentId === this.filters.department
            );
            logger.verbose(`🏢 Фильтр по отделу ${this.filters.department}: ${filteredData.length} записей`);
        }
        
        // Фильтр по менеджеру
        if (this.filters.manager) {
            filteredData = filteredData.filter(item => 
                item.managerId === this.filters.manager
            );
            logger.verbose(`👤 Фильтр по менеджеру ${this.filters.manager}: ${filteredData.length} записей`);
        }
        
        // Упрощенная логика фильтрации по периоду
        if (this.filters.period) {
            let fromDate = null;
            let toDate = null;
            
            if (this.filters.period === 'current_month') {
                // Для текущего месяца используем даты из фильтров
                if (this.filters.dateFrom && this.filters.dateTo) {
                    fromDate = new Date(this.filters.dateFrom);
                    toDate = new Date(this.filters.dateTo);
                }
            } else {
                // Для других периодов
                const months = parseInt(this.filters.period);
                fromDate = new Date();
                fromDate.setMonth(fromDate.getMonth() - months);
                toDate = new Date();
            }
            
            // Если есть даты для фильтрации, применяем фильтр
            if (fromDate && toDate) {
                const beforeFilter = filteredData.length;
                filteredData = filteredData.filter(item => {
                    // Проверяем, есть ли активность в периоде
                    const hasSalesActivity = item.salesList && item.salesList.some(sale => {
                        const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                        return saleDate >= fromDate && saleDate <= toDate;
                    });
                    
                    const hasTaskActivity = item.tasksList && item.tasksList.some(task => {
                        const taskDate = new Date(task.originalDate || task['Дата'] || '');
                        return taskDate >= fromDate && taskDate <= toDate;
                    });
                    
                    return hasSalesActivity || hasTaskActivity;
                });
                logger.verbose(`📅 Фильтр по периоду ${fromDate.toISOString().split('T')[0]} - ${toDate.toISOString().split('T')[0]}: ${beforeFilter} → ${filteredData.length} записей`);
            }
        }
        
        // Фильтр по датам (если не используется период)
        if (this.filters.period !== 'current_month') {
            if (this.filters.dateFrom) {
                const fromDate = new Date(this.filters.dateFrom);
                const beforeFilter = filteredData.length;
                filteredData = filteredData.filter(item => {
                    const hasSalesActivity = item.salesList && item.salesList.some(sale => {
                        const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                        return saleDate >= fromDate;
                    });
                    
                    const hasTaskActivity = item.tasksList && item.tasksList.some(task => {
                        const taskDate = new Date(task.originalDate || task['Дата'] || '');
                        return taskDate >= fromDate;
                    });
                    
                    return hasSalesActivity || hasTaskActivity;
                });
                logger.verbose(`📅 Фильтр с даты ${this.filters.dateFrom}: ${beforeFilter} → ${filteredData.length} записей`);
            }
            
            if (this.filters.dateTo) {
                const toDate = new Date(this.filters.dateTo);
                const beforeFilter = filteredData.length;
                filteredData = filteredData.filter(item => {
                    const hasSalesActivity = item.salesList && item.salesList.some(sale => {
                        const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                        return saleDate <= toDate;
                    });
                    
                    const hasTaskActivity = item.tasksList && item.tasksList.some(task => {
                        const taskDate = new Date(task.originalDate || task['Дата'] || '');
                        return taskDate <= toDate;
                    });
                    
                    return hasSalesActivity || hasTaskActivity;
                });
                logger.verbose(`📅 Фильтр до даты ${this.filters.dateTo}: ${beforeFilter} → ${filteredData.length} записей`);
            }
        }
        
        logger.verbose('✅ Финальный результат фильтрации:', {
            filteredRecords: filteredData.length,
            sampleData: filteredData.slice(0, 2).map(item => ({
                name: item.managerName,
                isDepartment: item.isDepartment,
                clients: item.totalClients,
                sales: item.salesList?.length || 0,
                tasks: item.tasksList?.length || 0
            }))
        });
        
        return filteredData;
    }
    
    /**
     * Обновление данных
     */
    async _refreshData() {
        try {
            logger.info('🔄 Оновлення даних навантаження...');
            
            // Показываем индикатор загрузки
            if (this.elements.content) {
                this.elements.content.innerHTML = `
                    <div class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                        <p class="text-gray-200">Оновлення даних...</p>
                    </div>
                `;
            }
            
            // Перезагружаем данные
            await this._loadData();
            
            // Пересчитываем метрики
            this._calculateMetrics();
            
            // Обновляем отображение
            this._renderWorkload();
            
            logger.info('✅ Дані оновлено успішно');
            
        } catch (error) {
            logger.error('❌ Ошибка обновления данных:', error);
            this._renderError('Помилка оновлення даних');
        }
    }
    
    _calculateMetrics() {
        logger.info('📈 Расчет метрик навантаження...');
        
        try {
            // Валидация данных (как в departmentDashboard.js)
            this._validateAndDebugData();
            
            // Получаем период фильтрации для корректного расчета метрик
            let filterFromDate = null;
            let filterToDate = null;
            
            if (this.filters.period === 'current_month' && this.filters.dateFrom && this.filters.dateTo) {
                filterFromDate = new Date(this.filters.dateFrom);
                filterToDate = new Date(this.filters.dateTo);
            } else if (this.filters.period && this.filters.period !== 'current_month') {
                const months = parseInt(this.filters.period);
                filterFromDate = new Date();
                filterFromDate.setMonth(filterFromDate.getMonth() - months);
                filterToDate = new Date();
            } else if (this.filters.dateFrom || this.filters.dateTo) {
                filterFromDate = this.filters.dateFrom ? new Date(this.filters.dateFrom) : null;
                filterToDate = this.filters.dateTo ? new Date(this.filters.dateTo) : null;
            }
            
            logger.info('📅 Период фильтрации:', {
                from: filterFromDate?.toISOString().split('T')[0],
                to: filterToDate?.toISOString().split('T')[0],
                period: this.filters.period
            });
            
            // Добавляем отладочную информацию о продажах в периоде
            if (filterFromDate && filterToDate) {
                const salesInPeriod = this.salesData.filter(sale => {
                    const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                    return saleDate >= filterFromDate && saleDate <= filterToDate;
                });
                logger.info(`📊 Продажи в периоде ${filterFromDate.toISOString().split('T')[0]} - ${filterToDate.toISOString().split('T')[0]}: ${salesInPeriod.length} записей`);
                
                // Показываем примеры продаж в периоде
                if (salesInPeriod.length > 0) {
                    logger.verbose('📋 Примеры продаж в периоде:', salesInPeriod.slice(0, 3).map(sale => ({
                        date: sale['Дата'] || sale['Date'],
                        client: sale['Клиент.Код'] || sale['Клієнт.Код'],
                        revenue: sale['Выручка'] || sale['Виручка'],
                        operation: sale['Тип операции'] || sale['Тип'] || sale['Операция']
                    })));
                }
            }
            
            // Группируем данные по отделам и менеджерам (как в departmentDashboard.js)
            const workloadByDepartment = {};
            
            // Инициализируем структуру для каждого отдела
            this.departmentsData.forEach(department => {
                workloadByDepartment[department.id] = {
                    departmentId: department.id,
                    departmentName: department.name,
                    managers: {},
                    totalClients: 0,
                    shippedClients: 0,
                    shippedPercentage: 0,
                    totalOrders: 0,
                    totalRevenue: 0,
                    averageCheck: 0,
                    tasksTotal: 0,
                    tasksCompleted: 0,
                    tasksRescheduled: 0,
                    tasksNew: 0,
                    averageProductCoverage: 0,
                    totalCalls: 0,
                    totalMinutesInLine: 0,
                    effectiveCalls: 0,
                    lastActivity: null,
                    clientList: [],
                    salesList: [],
                    tasksList: []
                };
            });
            
            // Инициализируем структуру для каждого менеджера
            this.managersData.forEach(manager => {
                const departmentId = manager.department;
                if (!workloadByDepartment[departmentId]) {
                    // Создаем отдел если его нет
                    workloadByDepartment[departmentId] = {
                        departmentId: departmentId,
                        departmentName: this.departmentsData.find(d => d.id === departmentId)?.name || 'Невідомий відділ',
                        managers: {},
                        totalClients: 0,
                        shippedClients: 0,
                        shippedPercentage: 0,
                        totalOrders: 0,
                        totalRevenue: 0,
                        averageCheck: 0,
                        tasksTotal: 0,
                        tasksCompleted: 0,
                        tasksRescheduled: 0,
                        tasksNew: 0,
                        averageProductCoverage: 0,
                        totalCalls: 0,
                        totalMinutesInLine: 0,
                        effectiveCalls: 0,
                        lastActivity: null,
                        clientList: [],
                        salesList: [],
                        tasksList: [],
                        
                        // === НОВІ МЕТРИКИ ДЛЯ ВІДДІЛІВ ===
                        
                        // Метрики активности и интенсивности
                        averageOrdersPerDay: 0,
                        averageClientsPerDay: 0,
                        workIntensity: 0,
                        activeDaysCount: 0,
                        efficiencyScore: 0,
                        
                        // Метрики развития клиентской базы
                        newClientsInPeriod: 0,
                        repeatOrdersClients: 0,
                        clientActivityRate: 0,
                        averageOrderInterval: 0,
                        
                        // Сравнительные метрики
                        revenueGrowth: 0,
                        clientsGrowth: 0,
                        ordersGrowth: 0,
                        previousPeriodComparison: {},
                        
                        // Метрики качества работы
                        taskCompletionRate: 0,
                        taskEfficiencyRate: 0,
                        averageTaskDuration: 0,
                        
                        // Временные метрики
                        orderFrequency: 0,
                        clientRetentionRate: 0,
                        seasonalActivity: {},
                        
                        // Рейтинговые метрики
                        revenueRank: 0,
                        clientsRank: 0,
                        efficiencyRank: 0,
                        overallRank: 0
                    };
                }
                
                workloadByDepartment[departmentId].managers[manager.id] = {
                    managerId: manager.id,
                    managerName: manager.name,
                    departmentId: departmentId,
                    departmentName: workloadByDepartment[departmentId].departmentName,
                    
                    // 1. Кількість клієнтів
                    totalClients: 0,
                    
                    // 2. Кількість відгружених клієнтів
                    shippedClients: 0,
                    
                    // 3. Відсоток відгружених
                    shippedPercentage: 0,
                    
                    // 4. Кількість замовлень
                    totalOrders: 0,
                    
                    // 5. Сума замовлень
                    totalRevenue: 0,
                    
                    // 6. Длина чека (середній чек)
                    averageCheck: 0,
                    
                    // 7. Кількість справ по статусах
                    tasksTotal: 0,
                    tasksCompleted: 0,
                    tasksRescheduled: 0,
                    tasksNew: 0,
                    
                    // 8. Середня покриття груп товарів
                    averageProductCoverage: 0,
                    
                    // 9. Кількість дзвінків (заглушка)
                    totalCalls: 0,
                    
                    // 10. Хвилини в лінії (заглушка)
                    totalMinutesInLine: 0,
                    
                    // 11. Кількість ефективних дзвінків (заглушка)
                    effectiveCalls: 0,
                    
                    // Дополнительные метрики
                    lastActivity: null,
                    clientList: [],
                    salesList: [],
                    tasksList: [],
                    
                    // === НОВІ МЕТРИКИ ===
                    
                    // Метрики активности и интенсивности
                    averageOrdersPerDay: 0,        // Среднее количество заказов в день
                    averageClientsPerDay: 0,       // Среднее количество клиентов в день
                    workIntensity: 0,              // Интенсивность работы (операции/день)
                    activeDaysCount: 0,            // Количество активных дней
                    efficiencyScore: 0,            // Общий показатель эффективности
                    
                    // Метрики развития клиентской базы
                    newClientsInPeriod: 0,         // Новые клиенты за период
                    repeatOrdersClients: 0,        // Клиенты с повторными заказами
                    clientActivityRate: 0,         // Процент активных клиентов
                    averageOrderInterval: 0,       // Средний интервал между заказами
                    
                    // Сравнительные метрики
                    revenueGrowth: 0,              // Рост выручки (%)
                    clientsGrowth: 0,              // Рост клиентов (%)
                    ordersGrowth: 0,               // Рост заказов (%)
                    previousPeriodComparison: {},   // Сравнение с предыдущим периодом
                    
                    // Метрики качества работы
                    taskCompletionRate: 0,         // Процент завершенных задач
                    taskEfficiencyRate: 0,         // Эффективность выполнения задач
                    averageTaskDuration: 0,        // Средняя продолжительность задачи
                    
                    // Временные метрики
                    orderFrequency: 0,             // Частота заказов (заказов/день)
                    clientRetentionRate: 0,        // Процент удержания клиентов
                    seasonalActivity: {},          // Сезонность активности
                    
                    // Рейтинговые метрики
                    revenueRank: 0,                // Рейтинг по выручке
                    clientsRank: 0,                // Рейтинг по клиентам
                    efficiencyRank: 0,             // Рейтинг по эффективности
                    overallRank: 0                 // Общий рейтинг
                };
            });
            
            // Функция для проверки продаж в периоде (вынесена на уровень класса)
            const getSalesInPeriod = (sales) => {
                try {
                    if (!sales || !Array.isArray(sales)) {
                        logger.warn('⚠️ getSalesInPeriod: sales не является массивом:', sales);
                        return [];
                    }
                    
                    if (!filterFromDate && !filterToDate) {
                        return sales; // Если нет фильтра, возвращаем все продажи
                    }
                    
                    return sales.filter(sale => {
                        try {
                            const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                            if (filterFromDate && saleDate < filterFromDate) return false;
                            if (filterToDate && saleDate > filterToDate) return false;
                            return true;
                        } catch (error) {
                            logger.warn('⚠️ getSalesInPeriod: ошибка обработки продажи:', sale, error);
                            return false;
                        }
                    });
                } catch (error) {
                    logger.error('❌ getSalesInPeriod: критическая ошибка:', error);
                    return [];
                }
            };
            
            // Обрабатываем данные клиентов
            this.clientsData.forEach(client => {
                const manager = this.managersData.find(m => 
                    m.name === client.manager || 
                    m.id === client.manager
                );
                
                if (manager && workloadByDepartment[manager.department]?.managers[manager.id]) {
                    const managerWorkload = workloadByDepartment[manager.department].managers[manager.id];
                    const departmentWorkload = workloadByDepartment[manager.department];
                    
                    // ИСПРАВЛЕНИЕ: Считаем ВСЕХ клиентов менеджера (как в departmentDashboard.js)
                    // независимо от того, есть ли у них продажи в периоде
                    managerWorkload.totalClients++;
                    departmentWorkload.totalClients++;
                    managerWorkload.clientList.push(client);
                    departmentWorkload.clientList.push(client);
                    
                    // Получаем продажи клиента в периоде
                    const clientSalesInPeriod = getSalesInPeriod(client.sales);
                    
                    // Проверяем, есть ли отгрузки у клиента В ПЕРИОДЕ
                    // ИСПРАВЛЕНИЕ: Поскольку в данных нет явных полей статуса отгрузки,
                    // считаем всех клиентов с продажами в периоде как "отгруженных"
                    const hasShipmentsInPeriod = clientSalesInPeriod.length > 0;
                    
                    if (hasShipmentsInPeriod) {
                        managerWorkload.shippedClients++;
                        departmentWorkload.shippedClients++;
                        
                        // Отладочная информация для первых нескольких отгруженных клиентов
                        if (managerWorkload.shippedClients <= 3) {
                            logger.verbose(`🚚 Отгруженный клиент ${client.code} (${client.name}) в периоде: ${clientSalesInPeriod.length} продаж`);
                        }
                    } else {
                        // Отладочная информация для клиентов без продаж в периоде
                        if (managerWorkload.totalClients <= 3) {
                            logger.verbose(`❌ Клиент ${client.code} (${client.name}) БЕЗ продаж в периоде`);
                        }
                    }
                    
                    // УЛУЧШЕННЫЙ РАСЧЕТ ЗАКАЗОВ (как в departmentDashboard.js)
                    // Группируем по чекам (клиент + дата) для правильного подсчета заказов
                    // Только если есть продажи в периоде
                    if (clientSalesInPeriod.length > 0) {
                        const checksMap = new Map(); // Ключ: "clientCode_date", значение: сумма чека
                        let clientTotalRevenue = 0;
                        
                        clientSalesInPeriod.forEach(sale => {
                            const clientCode = sale['Клиент.Код'] || sale['Клієнт.Код'] || client.code;
                            const saleDate = sale['Дата'] || sale['Date'] || '';
                            
                            if (clientCode && saleDate) {
                                const checkKey = `${clientCode}_${saleDate}`;
                                if (!checksMap.has(checkKey)) {
                                    checksMap.set(checkKey, 0);
                                }
                                
                                // Парсим выручку (может быть строкой с пробелами и запятыми)
                                let revenue = sale['Выручка'] || sale['Виручка'] || 0;
                                if (typeof revenue === 'string') {
                                    revenue = parseFloat(revenue.replace(/\s/g, '').replace(',', '.')) || 0;
                                }
                                
                                checksMap.set(checkKey, checksMap.get(checkKey) + revenue);
                                clientTotalRevenue += revenue;
                            }
                        });
                        
                        const uniqueOrders = checksMap.size; // Количество уникальных чеков
                        managerWorkload.totalOrders += uniqueOrders;
                        departmentWorkload.totalOrders += uniqueOrders;
                        managerWorkload.totalRevenue += clientTotalRevenue;
                        departmentWorkload.totalRevenue += clientTotalRevenue;
                        managerWorkload.salesList.push(...clientSalesInPeriod);
                        departmentWorkload.salesList.push(...clientSalesInPeriod);
                        
                        // Обновляем последнюю активность
                        if (!managerWorkload.lastActivity || client.lastSale > managerWorkload.lastActivity) {
                            managerWorkload.lastActivity = client.lastSale;
                        }
                        if (!departmentWorkload.lastActivity || client.lastSale > departmentWorkload.lastActivity) {
                            departmentWorkload.lastActivity = client.lastSale;
                        }
                    }
                }
            });
            
            // Обрабатываем данные задач
            this.tasksData.forEach(task => {
                const manager = this.managersData.find(m => 
                    m.name === task.Менеджер || 
                    m.id === task.Менеджер
                );
                
                if (manager && workloadByDepartment[manager.department]?.managers[manager.id]) {
                    const managerWorkload = workloadByDepartment[manager.department].managers[manager.id];
                    const departmentWorkload = workloadByDepartment[manager.department];
                    
                    // Увеличиваем количество задач
                    managerWorkload.tasksTotal++;
                    departmentWorkload.tasksTotal++;
                    managerWorkload.tasksList.push(task);
                    departmentWorkload.tasksList.push(task);
                    
                    // Подсчитываем по статусам
                    switch(task.status) {
                        case 'completed':
                            managerWorkload.tasksCompleted++;
                            departmentWorkload.tasksCompleted++;
                            break;
                        case 'rescheduled':
                            managerWorkload.tasksRescheduled++;
                            departmentWorkload.tasksRescheduled++;
                            break;
                        case 'new':
                            managerWorkload.tasksNew++;
                            departmentWorkload.tasksNew++;
                            break;
                        default:
                            managerWorkload.tasksNew++; // По умолчанию считаем новыми
                            departmentWorkload.tasksNew++;
                    }
                }
            });
            
            // Рассчитываем производные метрики для отделов и менеджеров
            Object.values(workloadByDepartment).forEach(department => {
                // Рассчитываем метрики для отдела
                if (department.totalClients > 0) {
                    department.shippedPercentage = (department.shippedClients / department.totalClients) * 100;
                }
                
                if (department.totalOrders > 0) {
                    // Длина чека = количество SKU в заказе (среднее количество номенклатур на заказ)
                    const totalSkus = department.salesList.length;
                    department.averageCheck = totalSkus / department.totalOrders;
                }
                
                if (department.salesList.length > 0) {
                    const productGroups = new Set();
                    department.salesList.forEach(sale => {
                        const product = sale['Номенклатура'] || sale['Товар'] || '';
                        if (product) {
                            const group = product.split(' ')[0]; // Первое слово как группа
                            productGroups.add(group);
                        }
                    });
                    department.averageProductCoverage = productGroups.size;
                }
                
                // === РОЗРАХУНОК НОВИХ МЕТРИК ДЛЯ ВІДДІЛУ ===
                
                // Метрики активности и интенсивности
                const periodDays = filterFromDate && filterToDate ? 
                    Math.ceil((filterToDate - filterFromDate) / (1000 * 60 * 60 * 24)) + 1 : 30;
                
                department.averageOrdersPerDay = periodDays > 0 ? department.totalOrders / periodDays : 0;
                department.averageClientsPerDay = periodDays > 0 ? department.totalClients / periodDays : 0;
                department.workIntensity = periodDays > 0 ? (department.totalOrders + department.tasksTotal) / periodDays : 0;
                
                // Подсчитываем активные дни для отдела
                const departmentActiveDays = new Set();
                department.salesList.forEach(sale => {
                    const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                    departmentActiveDays.add(saleDate.toISOString().split('T')[0]);
                });
                department.tasksList.forEach(task => {
                    const taskDate = new Date(task.originalDate || task['Дата'] || '');
                    departmentActiveDays.add(taskDate.toISOString().split('T')[0]);
                });
                department.activeDaysCount = departmentActiveDays.size;
                
                // Общий показатель эффективности отдела
                const departmentEfficiencyFactors = [
                    department.shippedPercentage / 100,
                    department.tasksCompleted / Math.max(department.tasksTotal, 1),
                    department.totalRevenue > 0 ? 1 : 0.5,
                    department.activeDaysCount / periodDays
                ];
                department.efficiencyScore = (departmentEfficiencyFactors.reduce((sum, factor) => sum + factor, 0) / departmentEfficiencyFactors.length) * 100;
                
                // Метрики развития клиентской базы для отдела
                const departmentNewClients = department.clientList.filter(client => {
                    const firstSale = client.firstSale;
                    return firstSale && filterFromDate && firstSale >= filterFromDate;
                });
                department.newClientsInPeriod = departmentNewClients.length;
                
                const departmentRepeatOrdersClients = department.clientList.filter(client => {
                    try {
                        const clientSalesInPeriod = getSalesInPeriod(client.sales || []);
                        return clientSalesInPeriod.length > 1;
                    } catch (error) {
                        logger.warn('⚠️ Ошибка при расчете departmentRepeatOrdersClients для клиента:', client.code, error);
                        return false;
                    }
                });
                department.repeatOrdersClients = departmentRepeatOrdersClients.length;
                
                department.clientActivityRate = department.totalClients > 0 ? 
                    (department.shippedClients / department.totalClients) * 100 : 0;
                
                // Метрики качества работы для отдела
                department.taskCompletionRate = department.tasksTotal > 0 ? 
                    (department.tasksCompleted / department.tasksTotal) * 100 : 0;
                
                department.taskEfficiencyRate = department.tasksTotal > 0 ? 
                    (department.tasksCompleted / (department.tasksCompleted + department.tasksRescheduled)) * 100 : 0;
                
                // Временные метрики для отдела
                department.orderFrequency = periodDays > 0 ? department.totalOrders / periodDays : 0;
                
                // Заглушки для будущих метрик отдела
                department.totalCalls = Math.floor(Math.random() * 200) + 100; // Демо данные
                department.totalMinutesInLine = Math.floor(Math.random() * 600) + 200; // Демо данные
                department.effectiveCalls = Math.floor(department.totalCalls * 0.7); // 70% эффективность
                
                // Рассчитываем метрики для каждого менеджера в отделе
                Object.values(department.managers).forEach(manager => {
                    if (manager.totalClients > 0) {
                        manager.shippedPercentage = (manager.shippedClients / manager.totalClients) * 100;
                    }
                    
                    if (manager.totalOrders > 0) {
                        // Длина чека = количество SKU в заказе (среднее количество номенклатур на заказ)
                        const totalSkus = manager.salesList.length;
                        manager.averageCheck = totalSkus / manager.totalOrders;
                    }
                    
                    if (manager.salesList.length > 0) {
                        const productGroups = new Set();
                        manager.salesList.forEach(sale => {
                            const product = sale['Номенклатура'] || sale['Товар'] || '';
                            if (product) {
                                const group = product.split(' ')[0]; // Первое слово как группа
                                productGroups.add(group);
                            }
                        });
                        manager.averageProductCoverage = productGroups.size;
                    }
                    
                    // === РОЗРАХУНОК НОВИХ МЕТРИК ДЛЯ МЕНЕДЖЕРА ===
                    
                    // Метрики активности и интенсивности
                    const periodDays = filterFromDate && filterToDate ? 
                        Math.ceil((filterToDate - filterFromDate) / (1000 * 60 * 60 * 24)) + 1 : 30;
                    
                    manager.averageOrdersPerDay = periodDays > 0 ? manager.totalOrders / periodDays : 0;
                    manager.averageClientsPerDay = periodDays > 0 ? manager.totalClients / periodDays : 0;
                    manager.workIntensity = periodDays > 0 ? (manager.totalOrders + manager.tasksTotal) / periodDays : 0;
                    
                    // Подсчитываем активные дни (дни с продажами или задачами)
                    const activeDays = new Set();
                    manager.salesList.forEach(sale => {
                        const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                        activeDays.add(saleDate.toISOString().split('T')[0]);
                    });
                    manager.tasksList.forEach(task => {
                        const taskDate = new Date(task.originalDate || task['Дата'] || '');
                        activeDays.add(taskDate.toISOString().split('T')[0]);
                    });
                    manager.activeDaysCount = activeDays.size;
                    
                    // Общий показатель эффективности
                    const efficiencyFactors = [
                        manager.shippedPercentage / 100,           // Процент отгруженных клиентов
                        manager.tasksCompleted / Math.max(manager.tasksTotal, 1), // Процент завершенных задач
                        manager.totalRevenue > 0 ? 1 : 0.5,       // Наличие выручки
                        manager.activeDaysCount / periodDays       // Активность по дням
                    ];
                    manager.efficiencyScore = (efficiencyFactors.reduce((sum, factor) => sum + factor, 0) / efficiencyFactors.length) * 100;
                    
                    // Метрики развития клиентской базы
                    const newClients = manager.clientList.filter(client => {
                        const firstSale = client.firstSale;
                        return firstSale && filterFromDate && firstSale >= filterFromDate;
                    });
                    manager.newClientsInPeriod = newClients.length;
                    
                    const repeatOrdersClients = manager.clientList.filter(client => {
                        try {
                            const clientSalesInPeriod = getSalesInPeriod(client.sales || []);
                            return clientSalesInPeriod.length > 1;
                        } catch (error) {
                            logger.warn('⚠️ Ошибка при расчете repeatOrdersClients для клиента:', client.code, error);
                            return false;
                        }
                    });
                    manager.repeatOrdersClients = repeatOrdersClients.length;
                    
                    manager.clientActivityRate = manager.totalClients > 0 ? 
                        (manager.shippedClients / manager.totalClients) * 100 : 0;
                    
                    // Средний интервал между заказами (для клиентов с несколькими заказами)
                    let totalIntervals = 0;
                    let intervalsCount = 0;
                    manager.clientList.forEach(client => {
                        try {
                            const clientSalesInPeriod = getSalesInPeriod(client.sales || []);
                            if (clientSalesInPeriod.length > 1) {
                                const sortedSales = clientSalesInPeriod.sort((a, b) => 
                                    new Date(a['Дата'] || a['Date']) - new Date(b['Дата'] || b['Date'])
                                );
                                for (let i = 1; i < sortedSales.length; i++) {
                                    const interval = new Date(sortedSales[i]['Дата'] || sortedSales[i]['Date']) - 
                                                   new Date(sortedSales[i-1]['Дата'] || sortedSales[i-1]['Date']);
                                    totalIntervals += interval;
                                    intervalsCount++;
                                }
                            }
                        } catch (error) {
                            logger.warn('⚠️ Ошибка при расчете averageOrderInterval для клиента:', client.code, error);
                        }
                    });
                    manager.averageOrderInterval = intervalsCount > 0 ? totalIntervals / intervalsCount / (1000 * 60 * 60 * 24) : 0;
                    
                    // Метрики качества работы
                    manager.taskCompletionRate = manager.tasksTotal > 0 ? 
                        (manager.tasksCompleted / manager.tasksTotal) * 100 : 0;
                    
                    manager.taskEfficiencyRate = manager.tasksTotal > 0 ? 
                        (manager.tasksCompleted / (manager.tasksCompleted + manager.tasksRescheduled)) * 100 : 0;
                    
                    // Временные метрики
                    manager.orderFrequency = periodDays > 0 ? manager.totalOrders / periodDays : 0;
                    
                    // Заглушки для будущих метрик менеджера
                    manager.totalCalls = Math.floor(Math.random() * 100) + 50; // Демо данные
                    manager.totalMinutesInLine = Math.floor(Math.random() * 300) + 100; // Демо данные
                    manager.effectiveCalls = Math.floor(manager.totalCalls * 0.7); // 70% эффективность
                });
            });
            
            // Преобразуем в массив для отображения с группировкой по отделам
            this.workloadData = [];
            
            Object.values(workloadByDepartment).forEach(department => {
                // Добавляем строку отдела (если есть данные)
                if (department.totalClients > 0 || department.tasksTotal > 0) {
                    this.workloadData.push({
                        ...department,
                        isDepartment: true,
                        managerName: department.departmentName,
                        managerId: department.departmentId
                    });
                }
                
                // Добавляем менеджеров отдела
                Object.values(department.managers).forEach(manager => {
                    if (manager.totalClients > 0 || manager.tasksTotal > 0) {
                        this.workloadData.push({
                            ...manager,
                            isDepartment: false
                        });
                    }
                });
            });
            
            // === РОЗРАХУНОК РЕЙТИНГІВ ===
            
            // Собираем всех менеджеров И отделов для расчета рейтингов
            const allManagers = [];
            const allDepartments = [];
            
            Object.values(workloadByDepartment).forEach(department => {
                // Добавляем отдел
                allDepartments.push(department);
                
                // Добавляем менеджеров отдела
                Object.values(department.managers).forEach(manager => {
                    allManagers.push(manager);
                });
            });
            
            // Рейтинги для менеджеров
            const revenueRanking = [...allManagers].sort((a, b) => b.totalRevenue - a.totalRevenue);
            const clientsRanking = [...allManagers].sort((a, b) => b.totalClients - a.totalClients);
            const efficiencyRanking = [...allManagers].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
            
            // Присваиваем рейтинги менеджерам
            revenueRanking.forEach((manager, index) => {
                manager.revenueRank = index + 1;
            });
            
            clientsRanking.forEach((manager, index) => {
                manager.clientsRank = index + 1;
            });
            
            efficiencyRanking.forEach((manager, index) => {
                manager.efficiencyRank = index + 1;
            });
            
            // Общий рейтинг для менеджеров
            allManagers.forEach(manager => {
                const avgRank = (manager.revenueRank + manager.clientsRank + manager.efficiencyRank) / 3;
                manager.overallRank = Math.round(avgRank);
            });
            
            // Рейтинги для отделов
            const departmentRevenueRanking = [...allDepartments].sort((a, b) => b.totalRevenue - a.totalRevenue);
            const departmentClientsRanking = [...allDepartments].sort((a, b) => b.totalClients - a.totalClients);
            const departmentEfficiencyRanking = [...allDepartments].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
            
            // Присваиваем рейтинги отделам
            departmentRevenueRanking.forEach((department, index) => {
                department.revenueRank = index + 1;
            });
            
            departmentClientsRanking.forEach((department, index) => {
                department.clientsRank = index + 1;
            });
            
            departmentEfficiencyRanking.forEach((department, index) => {
                department.efficiencyRank = index + 1;
            });
            
            // Общий рейтинг для отделов
            allDepartments.forEach(department => {
                const avgRank = (department.revenueRank + department.clientsRank + department.efficiencyRank) / 3;
                department.overallRank = Math.round(avgRank);
            });
            
            // Отладочная информация о рейтингах
            logger.verbose('🏆 Рейтинги менеджеров:', allManagers.slice(0, 3).map(m => ({
                name: m.managerName,
                revenueRank: m.revenueRank,
                clientsRank: m.clientsRank,
                efficiencyRank: m.efficiencyRank,
                overallRank: m.overallRank
            })));
            
            logger.verbose('🏆 Рейтинги отделов:', allDepartments.slice(0, 3).map(d => ({
                name: d.departmentName,
                revenueRank: d.revenueRank,
                clientsRank: d.clientsRank,
                efficiencyRank: d.efficiencyRank,
                overallRank: d.overallRank
            })));
            
            logger.info(`📈 Розраховано метрики для ${this.workloadData.length} записей (отделы + менеджеры)`);
            
            // Добавляем отладочную информацию о результатах
            if (this.workloadData.length > 0) {
                const sampleData = this.workloadData.slice(0, 3).map(item => ({
                    name: item.managerName,
                    isDepartment: item.isDepartment,
                    clients: item.totalClients,
                    shippedClients: item.shippedClients,
                    shippedPercentage: item.shippedPercentage,
                    orders: item.totalOrders,
                    revenue: item.totalRevenue,
                    salesCount: item.salesList?.length || 0,
                    tasksCount: item.tasksList?.length || 0
                }));
                
                logger.verbose('📊 Примеры рассчитанных метрик:', sampleData);
                
                // Проверяем общую статистику
                const totalClients = this.workloadData.reduce((sum, item) => sum + item.totalClients, 0);
                const totalShippedClients = this.workloadData.reduce((sum, item) => sum + item.shippedClients, 0);
                const totalOrders = this.workloadData.reduce((sum, item) => sum + item.totalOrders, 0);
                const totalRevenue = this.workloadData.reduce((sum, item) => sum + item.totalRevenue, 0);
                
                logger.info('📈 Общая статистика:', {
                    totalClients,
                    totalShippedClients,
                    totalOrders,
                    totalRevenue: totalRevenue.toLocaleString(),
                    shippedPercentage: totalClients > 0 ? ((totalShippedClients / totalClients) * 100).toFixed(1) + '%' : '0%'
                });
                
                // ДЕТАЛЬНАЯ ОТЛАДКА: Показываем примеры данных для понимания проблемы
                logger.verbose('🔍 ДЕТАЛЬНАЯ ОТЛАДКА - Примеры данных:');
                
                // Показываем первые несколько клиентов с их продажами
                this.clientsData.slice(0, 3).forEach((client, index) => {
                    const clientSalesInPeriod = client.sales.filter(sale => {
                        const saleDate = new Date(sale['Дата'] || sale['Date'] || '');
                        if (filterFromDate && saleDate < filterFromDate) return false;
                        if (filterToDate && saleDate > filterToDate) return false;
                        return true;
                    });
                    
                    logger.verbose(`👤 Клиент ${index + 1}: ${client.code} (${client.name})`, {
                        manager: client.manager,
                        totalSales: client.sales.length,
                        salesInPeriod: clientSalesInPeriod.length,
                        isShipped: clientSalesInPeriod.length > 0,
                        sampleSales: clientSalesInPeriod.slice(0, 2).map(sale => ({
                            date: sale['Дата'] || sale['Date'],
                            revenue: sale['Выручка'] || sale['Виручка'],
                            product: sale['Номенклатура'] || sale['Товар']
                        }))
                    });
                });
                
                // Показываем статистику по менеджерам
                Object.values(workloadByDepartment).forEach(department => {
                    logger.verbose(`🏢 Отдел ${department.departmentName}:`, {
                        totalClients: department.totalClients,
                        shippedClients: department.shippedClients,
                        shippedPercentage: department.shippedPercentage.toFixed(1) + '%',
                        managers: Object.keys(department.managers).length
                    });
                    
                    Object.values(department.managers).forEach(manager => {
                        logger.verbose(`👤 Менеджер ${manager.managerName}:`, {
                            totalClients: manager.totalClients,
                            shippedClients: manager.shippedClients,
                            shippedPercentage: manager.shippedPercentage.toFixed(1) + '%',
                            totalOrders: manager.totalOrders,
                            totalRevenue: manager.totalRevenue.toLocaleString()
                        });
                    });
                });
            }
            
        } catch (error) {
            logger.error('❌ Ошибка расчета метрик:', error);
            this.workloadData = [];
        }
    }
    
    /**
     * Рендеринг с данными
     */
    _renderWorkloadWithData(data) {
        if (this.elements.content) {
            this.elements.content.innerHTML = `
                <div class="text-center py-8">
                    <h3 class="text-xl font-bold text-white mb-4">📊 Дані навантаження</h3>
                    <p class="text-gray-400">Знайдено ${data.length} записів</p>
                    <div class="mt-4 text-sm text-gray-500">
                        <p>Менеджери: ${this.managersData.length}</p>
                        <p>Клієнти: ${this.clientsData.length}</p>
                        <p>Продажі: ${this.salesData.length}</p>
                        <p>Завдання: ${this.tasksData.length}</p>
                    </div>
                </div>
            `;
        }
    }
    
    _renderWorkload() {
        logger.info('📊 Рендеринг навантаження...');
        this._renderDashboard();
    }
    
    _renderDashboard() {
        if (this.elements.content) {
            // ИСПРАВЛЕНИЕ: Используем отфильтрованные данные для дашборда
            const filteredData = this._getFilteredData();
            
            if (filteredData.length === 0) {
                this.elements.content.innerHTML = `
                    <div class="text-center py-8">
                        <h3 class="text-xl font-bold text-white mb-4">📊 Дашборд навантаження</h3>
                        <p class="text-gray-400">Дані не знайдено або фільтри занадто обмежувальні</p>
                    </div>
                `;
                return;
            }
            
            // Сортируем по общей нагрузке (количество клиентов + задачи)
            const sortedData = [...filteredData].sort((a, b) => 
                (b.totalClients + b.tasksTotal) - (a.totalClients + a.tasksTotal)
            );
            
            // Группируем данные по отделам для правильного отображения
            const groupedData = [];
            const departmentGroups = {};
            
            sortedData.forEach(item => {
                if (item.isDepartment) {
                    // Это отдел
                    if (!departmentGroups[item.departmentId]) {
                        departmentGroups[item.departmentId] = {
                            department: item,
                            managers: []
                        };
                        groupedData.push(departmentGroups[item.departmentId]);
                    }
                } else {
                    // Это менеджер
                    if (!departmentGroups[item.departmentId]) {
                        departmentGroups[item.departmentId] = {
                            department: null,
                            managers: []
                        };
                        groupedData.push(departmentGroups[item.departmentId]);
                    }
                    departmentGroups[item.departmentId].managers.push(item);
                }
            });
            
            // Рассчитываем общие KPI
            const totalManagers = sortedData.filter(item => !item.isDepartment).length;
            const totalClients = sortedData.reduce((sum, m) => sum + m.totalClients, 0);
            const totalRevenue = sortedData.reduce((sum, m) => sum + m.totalRevenue, 0);
            const totalTasks = sortedData.reduce((sum, m) => sum + m.tasksTotal, 0);
            const avgEfficiency = sortedData.reduce((sum, m) => sum + m.efficiencyScore, 0) / Math.max(sortedData.length, 1);
            
            // Находим топ-3 менеджера
            const managersOnly = sortedData.filter(item => !item.isDepartment);
            const topByEfficiency = [...managersOnly].sort((a, b) => b.efficiencyScore - a.efficiencyScore).slice(0, 3);
            const topByRevenue = [...managersOnly].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 3);
            const topByNewClients = [...managersOnly].sort((a, b) => b.newClientsInPeriod - a.newClientsInPeriod).slice(0, 3);
            
            // Находим проблемные зоны
            const lowEfficiency = managersOnly.filter(m => m.efficiencyScore < 70);
            const highTaskLoad = managersOnly.filter(m => m.tasksTotal > 20);
            const lowActivity = managersOnly.filter(m => m.activeDaysCount < 10);
            
            this.elements.content.innerHTML = `
                <div class="workload-dashboard">
                    <!-- Debug button -->
                    <div class="flex justify-end mb-4">
                        <button class="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm" onclick="window.toggleWorkloadDebug(); window.workloadInstance._calculateMetrics();">
                            🔍 Debug Mode
                        </button>
                    </div>
                    
                    <!-- 🎯 КЛЮЧОВІ ПОКАЗНИКИ -->
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-white mb-4">🎯 КЛЮЧОВІ ПОКАЗНИКИ</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div class="bg-blue-600 rounded-lg p-4">
                                <h4 class="text-sm font-medium text-blue-100 mb-1">👥 Клієнти</h4>
                                <p class="text-2xl font-bold text-white">${totalClients}</p>
                                <p class="text-xs text-blue-200">Активних менеджерів: ${totalManagers}</p>
                            </div>
                            <div class="bg-green-600 rounded-lg p-4">
                                <h4 class="text-sm font-medium text-green-100 mb-1">💰 Виручка</h4>
                                <p class="text-2xl font-bold text-white">${(totalRevenue / 1000000).toFixed(1)}M ₴</p>
                                <p class="text-xs text-green-200">Середня: ${(totalRevenue / Math.max(totalManagers, 1)).toLocaleString()} ₴</p>
                            </div>
                            <div class="bg-yellow-600 rounded-lg p-4">
                                <h4 class="text-sm font-medium text-yellow-100 mb-1">📋 Завдання</h4>
                                <p class="text-2xl font-bold text-white">${totalTasks}</p>
                                <p class="text-xs text-yellow-200">Середня: ${(totalTasks / Math.max(totalManagers, 1)).toFixed(1)}</p>
                            </div>
                            <div class="bg-purple-600 rounded-lg p-4">
                                <h4 class="text-sm font-medium text-purple-100 mb-1">⚡ Ефективність</h4>
                                <p class="text-2xl font-bold text-white">${avgEfficiency.toFixed(1)}%</p>
                                <p class="text-xs text-purple-200">Загальний показник</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 🚨 АЛЕРТИ (Проблемні зони) -->
                    ${(lowEfficiency.length > 0 || highTaskLoad.length > 0 || lowActivity.length > 0) ? `
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-white mb-4">🚨 АЛЕРТИ (Проблемні зони)</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            ${lowEfficiency.length > 0 ? `
                            <div class="bg-red-600 rounded-lg p-4">
                                <h4 class="text-sm font-medium text-red-100 mb-2">⚠️ Низька ефективність</h4>
                                <div class="space-y-1">
                                    ${lowEfficiency.slice(0, 3).map(m => `
                                        <div class="flex justify-between text-sm">
                                            <span class="text-red-200">${m.managerName}</span>
                                            <span class="text-white font-bold">${m.efficiencyScore.toFixed(1)}%</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                            
                            ${highTaskLoad.length > 0 ? `
                            <div class="bg-orange-600 rounded-lg p-4">
                                <h4 class="text-sm font-medium text-orange-100 mb-2">📋 Високе навантаження</h4>
                                <div class="space-y-1">
                                    ${highTaskLoad.slice(0, 3).map(m => `
                                        <div class="flex justify-between text-sm">
                                            <span class="text-orange-200">${m.managerName}</span>
                                            <span class="text-white font-bold">${m.tasksTotal} завдань</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                            
                            ${lowActivity.length > 0 ? `
                            <div class="bg-yellow-600 rounded-lg p-4">
                                <h4 class="text-sm font-medium text-yellow-100 mb-2">😴 Низька активність</h4>
                                <div class="space-y-1">
                                    ${lowActivity.slice(0, 3).map(m => `
                                        <div class="flex justify-between text-sm">
                                            <span class="text-yellow-200">${m.managerName}</span>
                                            <span class="text-white font-bold">${m.activeDaysCount} днів</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- 🏆 ТОП-3 МЕНЕДЖЕРИ -->
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-white mb-4">🏆 ТОП-3 МЕНЕДЖЕРИ</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="bg-gray-700 rounded-lg p-4">
                                <h4 class="text-lg font-bold text-white mb-3">🥇 Топ по ефективності</h4>
                                ${topByEfficiency.map((manager, index) => `
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-gray-300">${index + 1}. ${manager.managerName}</span>
                                        <span class="text-white font-bold">${manager.efficiencyScore.toFixed(1)}%</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="bg-gray-700 rounded-lg p-4">
                                <h4 class="text-lg font-bold text-white mb-3">💰 Топ по виручці</h4>
                                ${topByRevenue.map((manager, index) => `
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-gray-300">${index + 1}. ${manager.managerName}</span>
                                        <span class="text-white font-bold">${(manager.totalRevenue / 1000).toFixed(0)}K ₴</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="bg-gray-700 rounded-lg p-4">
                                <h4 class="text-lg font-bold text-white mb-3">🆕 Топ по нових клієнтах</h4>
                                ${topByNewClients.map((manager, index) => `
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-gray-300">${index + 1}. ${manager.managerName}</span>
                                        <span class="text-white font-bold">${manager.newClientsInPeriod}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Таблица менеджеров с группировкой по отделам -->
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-xl font-bold text-white mb-4">📊 Навантаження по менеджерах</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left">
                                <thead class="text-xs text-gray-300 uppercase bg-gray-600">
                                    <tr>
                                        <th class="px-4 py-3">Менеджер</th>
                                        <th class="px-4 py-3">Відділ</th>
                                        <th class="px-4 py-3">Клієнти</th>
                                        <th class="px-4 py-3">Відгружено</th>
                                        <th class="px-4 py-3">%</th>
                                        <th class="px-4 py-3">Замовлення</th>
                                        <th class="px-4 py-3">Виручка</th>
                                        <th class="px-4 py-3">Ефективність</th>
                                        <th class="px-4 py-3">Нові клієнти</th>
                                        <th class="px-4 py-3">Активні дні</th>
                                        <th class="px-4 py-3">Рейтинг</th>
                                    </tr>
                                </thead>
                                <tbody class="text-gray-200">
                                    ${groupedData.map(group => {
                                        let rows = '';
                                        
                                        // Добавляем строку отдела (если есть)
                                        if (group.department) {
                                            rows += `
                                                <tr class="border-b border-gray-600 bg-gray-800 font-bold">
                                                    <td class="px-4 py-3 font-medium">
                                                        🏢 ${group.department.managerName}
                                                    </td>
                                                    <td class="px-4 py-3">${group.department.departmentName}</td>
                                                    <td class="px-4 py-3">${group.department.totalClients}</td>
                                                    <td class="px-4 py-3">${group.department.shippedClients}</td>
                                                    <td class="px-4 py-3">${group.department.shippedPercentage.toFixed(1)}%</td>
                                                    <td class="px-4 py-3">${group.department.totalOrders}</td>
                                                    <td class="px-4 py-3">${(group.department.totalRevenue / 1000).toFixed(0)}K ₴</td>
                                                    <td class="px-4 py-3">
                                                        <span class="font-bold ${group.department.efficiencyScore >= 80 ? 'text-green-400' : group.department.efficiencyScore >= 60 ? 'text-yellow-400' : 'text-red-400'}">
                                                            ${group.department.efficiencyScore.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td class="px-4 py-3">${group.department.newClientsInPeriod}</td>
                                                    <td class="px-4 py-3">${group.department.activeDaysCount}</td>
                                                    <td class="px-4 py-3">
                                                        <span class="font-bold text-blue-400">#${group.department.overallRank}</span>
                                                    </td>
                                                </tr>
                                            `;
                                        }
                                        
                                        // Добавляем менеджеров отдела
                                        group.managers.forEach(manager => {
                                            rows += `
                                                <tr class="border-b border-gray-600 hover:bg-gray-600">
                                                    <td class="px-4 py-3 font-medium pl-8">
                                                        👤 ${manager.managerName}
                                                    </td>
                                                    <td class="px-4 py-3">${manager.departmentName}</td>
                                                    <td class="px-4 py-3">${manager.totalClients}</td>
                                                    <td class="px-4 py-3">${manager.shippedClients}</td>
                                                    <td class="px-4 py-3">${manager.shippedPercentage.toFixed(1)}%</td>
                                                    <td class="px-4 py-3">${manager.totalOrders}</td>
                                                    <td class="px-4 py-3">${(manager.totalRevenue / 1000).toFixed(0)}K ₴</td>
                                                    <td class="px-4 py-3">
                                                        <span class="font-bold ${manager.efficiencyScore >= 80 ? 'text-green-400' : manager.efficiencyScore >= 60 ? 'text-yellow-400' : 'text-red-400'}">
                                                            ${manager.efficiencyScore.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td class="px-4 py-3">${manager.newClientsInPeriod}</td>
                                                    <td class="px-4 py-3">${manager.activeDaysCount}</td>
                                                    <td class="px-4 py-3">
                                                        <span class="font-bold text-blue-400">#${manager.overallRank}</span>
                                                    </td>
                                                </tr>
                                            `;
                                        });
                                        
                                        return rows;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    _renderTable() {
        if (this.elements.content) {
            // ИСПРАВЛЕНИЕ: Используем отфильтрованные данные для таблицы
            const filteredData = this._getFilteredData();
            
            logger.verbose('📋 Рендеринг таблицы:', {
                filteredDataLength: filteredData.length,
                sampleData: filteredData.slice(0, 2)
            });
            
            if (filteredData.length === 0) {
                logger.warn('⚠️ Нет данных для отображения в таблице');
                this.elements.content.innerHTML = `
                    <div class="text-center py-8">
                        <h3 class="text-xl font-bold text-white mb-4">📋 Таблиця навантаження</h3>
                        <p class="text-gray-400">Дані не знайдено або фільтри занадто обмежувальні</p>
                    </div>
                `;
                return;
            }
            
            this.elements.content.innerHTML = `
                <div class="workload-table">
                    <h3 class="text-xl font-bold text-white mb-4">📋 Детальна таблиця навантаження</h3>
                    
                                         <!-- Фильтры для таблицы -->
                     <div class="mb-4 flex gap-2">
                         <button class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm" onclick="window.workloadInstance._sortTable('totalClients')">
                             Сортувати по клієнтах
                         </button>
                         <button class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm" onclick="window.workloadInstance._sortTable('totalRevenue')">
                             Сортувати по виручці
                         </button>
                         <button class="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm" onclick="window.workloadInstance._sortTable('tasksTotal')">
                             Сортувати по завданнях
                         </button>
                         <button class="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm" onclick="window.toggleWorkloadDebug(); window.workloadInstance._calculateMetrics();">
                             🔍 Debug
                         </button>
                     </div>
                    
                    <!-- Детальная таблица -->
                    <div class="bg-gray-700 rounded-lg p-4">
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left">
                                <thead class="text-xs text-gray-300 uppercase bg-gray-600">
                                    <tr>
                                        <th class="px-4 py-3">Менеджер</th>
                                        <th class="px-4 py-3">Відділ</th>
                                        <th class="px-4 py-3">Клієнти</th>
                                        <th class="px-4 py-3">Відгружено</th>
                                        <th class="px-4 py-3">%</th>
                                        <th class="px-4 py-3">Замовлення</th>
                                        <th class="px-4 py-3">Виручка</th>
                                        <th class="px-4 py-3">Ефективність</th>
                                        <th class="px-4 py-3">Нові клієнти</th>
                                        <th class="px-4 py-3">Повторні</th>
                                        <th class="px-4 py-3">Активні дні</th>
                                        <th class="px-4 py-3">Завдання</th>
                                        <th class="px-4 py-3">Завершено</th>
                                        <th class="px-4 py-3">Ефективність завдань</th>
                                        <th class="px-4 py-3">Рейтинг</th>
                                        <th class="px-4 py-3">Зам/день</th>
                                        <th class="px-4 py-3">Клієнт/день</th>
                                    </tr>
                                </thead>
                                <tbody class="text-gray-200">
                                    ${filteredData.map(item => {
                                        const isDepartment = item.isDepartment;
                                        const rowClass = isDepartment 
                                            ? 'border-b border-gray-600 bg-gray-800 font-bold' 
                                            : 'border-b border-gray-600 hover:bg-gray-600';
                                        const indentClass = isDepartment ? '' : 'pl-8';
                                        
                                        return `
                                            <tr class="${rowClass}">
                                                <td class="px-4 py-3 font-medium ${indentClass}">
                                                    ${isDepartment ? '🏢 ' : '👤 '}${item.managerName}
                                                </td>
                                                <td class="px-4 py-3">${item.departmentName}</td>
                                                <td class="px-4 py-3">${item.totalClients}</td>
                                                <td class="px-4 py-3">${item.shippedClients}</td>
                                                <td class="px-4 py-3">${item.shippedPercentage.toFixed(1)}%</td>
                                                <td class="px-4 py-3">${item.totalOrders}</td>
                                                <td class="px-4 py-3">${(item.totalRevenue / 1000).toFixed(0)}K ₴</td>
                                                <td class="px-4 py-3">
                                                    <span class="font-bold ${item.efficiencyScore >= 80 ? 'text-green-400' : item.efficiencyScore >= 60 ? 'text-yellow-400' : 'text-red-400'}">
                                                        ${item.efficiencyScore.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td class="px-4 py-3">${item.newClientsInPeriod}</td>
                                                <td class="px-4 py-3">${item.repeatOrdersClients}</td>
                                                <td class="px-4 py-3">${item.activeDaysCount}</td>
                                                <td class="px-4 py-3">${item.tasksTotal}</td>
                                                <td class="px-4 py-3 text-green-400">${item.tasksCompleted}</td>
                                                <td class="px-4 py-3">
                                                    <span class="font-bold ${item.taskEfficiencyRate >= 80 ? 'text-green-400' : item.taskEfficiencyRate >= 60 ? 'text-yellow-400' : 'text-red-400'}">
                                                        ${item.taskEfficiencyRate.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td class="px-4 py-3">
                                                    <span class="font-bold text-blue-400">#${item.overallRank}</span>
                                                </td>
                                                <td class="px-4 py-3">${item.averageOrdersPerDay?.toFixed(1) || '0.0'}</td>
                                                <td class="px-4 py-3">${item.averageClientsPerDay?.toFixed(1) || '0.0'}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    _renderAnalytics() {
        if (this.elements.content) {
            // ИСПРАВЛЕНИЕ: Используем отфильтрованные данные для аналитики
            const filteredData = this._getFilteredData();
            
            if (filteredData.length === 0) {
                this.elements.content.innerHTML = `
                    <div class="text-center py-8">
                        <h3 class="text-xl font-bold text-white mb-4">📈 Аналітика навантаження</h3>
                        <p class="text-gray-400">Дані не знайдено або фільтри занадто обмежувальні</p>
                    </div>
                `;
                return;
            }
            
            // Рассчитываем аналитику
            const totalManagers = filteredData.length;
            const totalClients = filteredData.reduce((sum, m) => sum + m.totalClients, 0);
            const totalRevenue = filteredData.reduce((sum, m) => sum + m.totalRevenue, 0);
            const totalTasks = filteredData.reduce((sum, m) => sum + m.tasksTotal, 0);
            
            const avgClientsPerManager = totalClients / totalManagers;
            const avgRevenuePerManager = totalRevenue / totalManagers;
            const avgTasksPerManager = totalTasks / totalManagers;
            
            // Топ-3 менеджера по разным критериям
            const topByClients = [...filteredData].sort((a, b) => b.totalClients - a.totalClients).slice(0, 3);
            const topByRevenue = [...filteredData].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 3);
            const topByTasks = [...filteredData].sort((a, b) => b.tasksTotal - a.tasksTotal).slice(0, 3);
            
            this.elements.content.innerHTML = `
                <div class="workload-analytics">
                    <h3 class="text-xl font-bold text-white mb-4">📈 Аналітика навантаження</h3>
                    
                    <!-- Общая статистика -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div class="bg-blue-600 rounded-lg p-4">
                            <h4 class="text-sm font-medium text-blue-100 mb-1">Середнє клієнтів на менеджера</h4>
                            <p class="text-2xl font-bold text-white">${avgClientsPerManager.toFixed(1)}</p>
                        </div>
                        <div class="bg-green-600 rounded-lg p-4">
                            <h4 class="text-sm font-medium text-green-100 mb-1">Середня виручка на менеджера</h4>
                            <p class="text-2xl font-bold text-white">${avgRevenuePerManager.toLocaleString()} ₴</p>
                        </div>
                        <div class="bg-yellow-600 rounded-lg p-4">
                            <h4 class="text-sm font-medium text-yellow-100 mb-1">Середнє завдань на менеджера</h4>
                            <p class="text-2xl font-bold text-white">${avgTasksPerManager.toFixed(1)}</p>
                        </div>
                        <div class="bg-purple-600 rounded-lg p-4">
                            <h4 class="text-sm font-medium text-purple-100 mb-1">Загальна ефективність</h4>
                            <p class="text-2xl font-bold text-white">${((totalClients / (totalClients + totalTasks)) * 100).toFixed(1)}%</p>
                        </div>
                    </div>
                    
                    <!-- Топ менеджеры -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="bg-gray-700 rounded-lg p-4">
                            <h4 class="text-lg font-bold text-white mb-3">🥇 Топ по клієнтах</h4>
                            ${topByClients.map((manager, index) => `
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-gray-300">${index + 1}. ${manager.managerName}</span>
                                    <span class="text-white font-bold">${manager.totalClients}</span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="bg-gray-700 rounded-lg p-4">
                            <h4 class="text-lg font-bold text-white mb-3">💰 Топ по виручці</h4>
                            ${topByRevenue.map((manager, index) => `
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-gray-300">${index + 1}. ${manager.managerName}</span>
                                    <span class="text-white font-bold">${manager.totalRevenue.toLocaleString()} ₴</span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="bg-gray-700 rounded-lg p-4">
                            <h4 class="text-lg font-bold text-white mb-3">📋 Топ по завданнях</h4>
                            ${topByTasks.map((manager, index) => `
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-gray-300">${index + 1}. ${manager.managerName}</span>
                                    <span class="text-white font-bold">${manager.tasksTotal}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Графики (заглушки) -->
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h4 class="text-lg font-bold text-white mb-3">📊 Графіки навантаження</h4>
                        <div class="text-center py-8">
                            <p class="text-gray-400">Графіки будуть додані в наступних версіях</p>
                        </div>
                    </div>
                </div>
            `;
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
    
    _checkForUpdates() {
        if (this.isUpdateInProgress) {
            logger.verbose('🔄 Обновление уже в процессе, пропускаем');
            return;
        }
        
        logger.verbose('🔄 Проверка обновлений навантаження...');
        this.isUpdateInProgress = true;
        
        this._refreshData()
            .then(() => {
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
}

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ИНТЕГРАЦИИ ===

// Единственный экземпляр модуля
let workloadInstance = null;

/**
 * Инициализация модуля навантаження
 */
window.initWorkloadModule = async function(container) {
    logger.info('🚀 Инициализация модуля навантаження');
    
    // Если экземпляр уже есть - используем логику восстановления
    if (workloadInstance) {
        if (workloadInstance.isFrozen) {
            logger.info('🔄 Восстановление модуля из замороженного состояния');
            await workloadInstance.init(container);
        } else if (!workloadInstance.isInitialized) {
            logger.info('🔄 Переинициализация существующего экземпляра');
            await workloadInstance.init(container);
        } else {
            logger.info('✅ Модуль уже инициализирован');
        }
    } else {
        // Создаем экземпляр только если его нет
        logger.info('🆕 Создание нового экземпляра модуля навантаження');
        workloadInstance = new WorkloadModule();
        window.workloadInstance = workloadInstance;
        await workloadInstance.init(container);
    }
};

/**
 * Очистка модуля навантаження (использует заморозку по умолчанию)
 */
window.cleanupWorkloadModule = function() {
    logger.info('❄️ Заморозка модуля навантаження (сохранение состояния)');
    
    if (workloadInstance) {
        workloadInstance.freeze();
    }
};

/**
 * Полная очистка модуля навантаження (используется только при необходимости)
 */
window.destroyWorkloadModule = function() {
    logger.info('🧹 Полная очистка модуля навантаження');
    
    if (workloadInstance) {
        workloadInstance.cleanup();
        workloadInstance = null;
        window.workloadInstance = null;
    }
};

// Экспорт для использования как ES модуль
export { WorkloadModule };
export const initWorkloadModule = window.initWorkloadModule;
export const cleanupWorkloadModule = window.cleanupWorkloadModule; 