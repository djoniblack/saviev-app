// calendarReports.js - Модуль отчетов для календаря менеджера

import { logger } from './logger.js';
import * as firebase from './firebase.js';

/**
 * Класс для работы с отчетами календаря
 */
class CalendarReports {
    constructor() {
        this.isInitialized = false;
        this.container = null;
        this.elements = {};
        this.currentPeriod = {
            start: null,
            end: null
        };
        this.workloadNorms = {};
        this.reportData = null;
        
        // Данные для фильтров
        this.departmentsData = [];
        this.employeesData = [];
        
        // Состояние фильтров
        this.selectedDepartment = '';
        this.selectedManager = '';
        this.selectedStatus = '';
    }

    /**
     * Инициализация модуля отчетов
     */
    async init(container) {
        if (this.isInitialized) {
            logger.info('📊 Отчеты уже инициализированы');
            return;
        }

        this.container = container;
        logger.info('📊 Инициализация модуля отчетов календаря');

        try {
            // Проверяем права доступа
            if (!this._checkPermissions()) {
                this._renderAccessDenied();
                return;
            }

            // Создаем HTML структуру
            this._createHTMLStructure();
            
            // Кэшируем элементы
            this._cacheElements();
            
            // Инициализируем обработчики событий
            this._initEventListeners();
            
            // Загружаем данные
            await this._loadData();
            
            this.isInitialized = true;
            logger.info('✅ Модуль отчетов инициализирован');
            
        } catch (error) {
            logger.error('❌ Ошибка инициализации модуля отчетов:', error);
            this._renderError('Ошибка инициализации модуля отчетов');
        }
    }

    /**
     * Проверка прав доступа
     */
    _checkPermissions() {
        const userPermissions = window.state?.currentUserPermissions || {};
        const hasPermission = userPermissions['manager_calendar_view_reports'] || 
                            userPermissions['manager_calendar_view_page'] ||
                            window.state?.currentUserRole === 'owner';
        
        logger.info('🔍 Проверка прав доступа к отчетам:');
        logger.info('📊 Права пользователя:', userPermissions);
        logger.info('👤 Роль пользователя:', window.state?.currentUserRole);
        logger.info('✅ Есть права на отчеты:', hasPermission);
        
        return hasPermission;
    }

    /**
     * Создание HTML структуры
     */
    _createHTMLStructure() {
        this.container.innerHTML = `
            <div class="calendar-reports-module bg-gray-800 rounded-xl shadow-lg p-6">
                <!-- Заголовок -->
                <div class="reports-header flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-white">📊 Отчеты календаря</h2>
                    <div class="reports-controls flex items-center gap-4">
                        <div class="period-selector">
                            <label class="text-sm text-gray-300 mr-2">Период:</label>
                            <select id="reportPeriod" class="px-3 py-1 bg-gray-700 text-white rounded text-sm">
                                <option value="current_month">Текущий месяц</option>
                                <option value="last_month">Прошлый месяц</option>
                                <option value="current_quarter">Текущий квартал</option>
                                <option value="custom">Произвольный период</option>
                            </select>
                        </div>
                        <button id="generateReport" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Сгенерировать отчет
                        </button>
                        <button id="openNormsSettings" class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700" title="Настройки норм нагрузки">
                            ⚙️
                        </button>
                    </div>
                </div>

                <!-- Фильтры отчетов -->
                <div class="reports-filters bg-gray-700 rounded-lg p-4 mb-6">
                    <h3 class="text-lg font-semibold text-white mb-4">🔍 Фильтры отчетов</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Відділ</label>
                            <select id="reportDepartmentFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                                <option value="">Всі відділи</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Менеджер</label>
                            <select id="reportManagerFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                                <option value="">Всі менеджери</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Статус задач</label>
                            <select id="reportStatusFilter" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white">
                                <option value="">Всі статуси</option>
                                <option value="new">Нові</option>
                                <option value="active">Активні</option>
                                <option value="rescheduled">Перенесені</option>
                                <option value="completed">Закриті</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Настройки норм нагрузки (скрыто в иконке настроек) -->
                <div id="normsSettingsModal" class="fixed inset-0 z-50 hidden bg-black bg-opacity-50 flex items-center justify-center">
                    <div class="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-white">⚙️ Настройки норм нагрузки</h3>
                            <button id="closeNormsSettings" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div id="normsContainer" class="space-y-4 mb-4">
                            <!-- Нормы будут загружены динамически -->
                        </div>
                        <button id="addNorm" class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            + Добавить норму
                        </button>
                    </div>
                </div>

                <!-- Отчеты -->
                <div class="reports-content">
                    <!-- Динамика по дням -->
                    <div class="report-section bg-gray-700 rounded-lg p-4 mb-6">
                        <h3 class="text-lg font-semibold text-white mb-4">📈 Динамика нагрузки по дням</h3>
                        <div id="dailyDynamicsChart" class="h-64 bg-gray-600 rounded flex items-center justify-center">
                            <p class="text-gray-400">График будет загружен после генерации отчета</p>
                        </div>
                    </div>

                    <!-- Динамика по месяцам -->
                    <div class="report-section bg-gray-700 rounded-lg p-4 mb-6">
                        <h3 class="text-lg font-semibold text-white mb-4">📊 Динамика нагрузки по месяцам</h3>
                        <div id="monthlyDynamicsChart" class="h-64 bg-gray-600 rounded flex items-center justify-center">
                            <p class="text-gray-400">График будет загружен после генерации отчета</p>
                        </div>
                    </div>

                    <!-- Анализ норм нагрузки -->
                    <div class="report-section bg-gray-700 rounded-lg p-4 mb-6">
                        <h3 class="text-lg font-semibold text-white mb-4">⚖️ Анализ норм нагрузки</h3>
                        <div id="workloadAnalysis" class="space-y-4">
                            <!-- Анализ будет загружен после генерации отчета -->
                        </div>
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
            reportPeriod: this.container.querySelector('#reportPeriod'),
            generateReport: this.container.querySelector('#generateReport'),
            normsContainer: this.container.querySelector('#normsContainer'),
            addNorm: this.container.querySelector('#addNorm'),
            dailyDynamicsChart: this.container.querySelector('#dailyDynamicsChart'),
            monthlyDynamicsChart: this.container.querySelector('#monthlyDynamicsChart'),
            workloadAnalysis: this.container.querySelector('#workloadAnalysis'),
            
            // Фильтры отчетов
            reportDepartmentFilter: this.container.querySelector('#reportDepartmentFilter'),
            reportManagerFilter: this.container.querySelector('#reportManagerFilter'),
            reportStatusFilter: this.container.querySelector('#reportStatusFilter'),
            
            // Настройки норм
            openNormsSettings: this.container.querySelector('#openNormsSettings'),
            normsSettingsModal: this.container.querySelector('#normsSettingsModal'),
            closeNormsSettings: this.container.querySelector('#closeNormsSettings')
        };
    }

    /**
     * Инициализация обработчиков событий
     */
    _initEventListeners() {
        if (this.elements.generateReport) {
            this.elements.generateReport.addEventListener('click', () => {
                this._generateReport();
            });
        }

        if (this.elements.addNorm) {
            this.elements.addNorm.addEventListener('click', () => {
                this._showAddNormModal();
            });
        }

        if (this.elements.reportPeriod) {
            this.elements.reportPeriod.addEventListener('change', () => {
                this._updatePeriod();
            });
        }

        // Фильтры отчетов
        if (this.elements.reportDepartmentFilter) {
            this.elements.reportDepartmentFilter.addEventListener('change', (e) => {
                this.selectedDepartment = e.target.value;
                this._updateReportFilters();
            });
        }

        if (this.elements.reportManagerFilter) {
            this.elements.reportManagerFilter.addEventListener('change', (e) => {
                this.selectedManager = e.target.value;
                this._updateReportFilters();
            });
        }

        if (this.elements.reportStatusFilter) {
            this.elements.reportStatusFilter.addEventListener('change', (e) => {
                this.selectedStatus = e.target.value;
                this._updateReportFilters();
            });
        }

        // Настройки норм нагрузки
        if (this.elements.openNormsSettings) {
            this.elements.openNormsSettings.addEventListener('click', () => {
                this.elements.normsSettingsModal.classList.remove('hidden');
            });
        }

        if (this.elements.closeNormsSettings) {
            this.elements.closeNormsSettings.addEventListener('click', () => {
                this.elements.normsSettingsModal.classList.add('hidden');
            });
        }

        // Закрытие модального окна по клику вне его
        if (this.elements.normsSettingsModal) {
            this.elements.normsSettingsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.normsSettingsModal) {
                    this.elements.normsSettingsModal.classList.add('hidden');
                }
            });
        }
    }

    /**
     * Загрузка данных
     */
    async _loadData() {
        try {
            logger.info('📊 Загрузка данных для отчетов...');
            
            // Загружаем нормы нагрузки
            await this._loadWorkloadNorms();
            
            // Загружаем данные для фильтров
            await this._loadFilterData();
            
            // Устанавливаем текущий период
            this._setCurrentPeriod();
            
            // Генерируем первый отчет
            await this._generateReport();
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных отчетов:', error);
        }
    }

    /**
     * Загрузка данных для фильтров
     */
    async _loadFilterData() {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) {
                logger.error('❌ ID компании не найден');
                return;
            }

            // Загружаем отделы
            const departmentsRef = firebase.collection(firebase.db, 'companies', companyId, 'departments');
            const departmentsSnapshot = await firebase.getDocs(departmentsRef);
            
            const departments = [];
            departmentsSnapshot.forEach(doc => {
                departments.push({
                    id: doc.id,
                    name: doc.data().name
                });
            });

            // Загружаем сотрудников
            const employeesRef = firebase.collection(firebase.db, 'companies', companyId, 'employees');
            const employeesSnapshot = await firebase.getDocs(employeesRef);
            
            const employees = [];
            employeesSnapshot.forEach(doc => {
                const data = doc.data();
                employees.push({
                    id: doc.id,
                    name: data.name,
                    department: data.department
                });
            });

            // Сохраняем данные
            this.departmentsData = departments;
            this.employeesData = employees;

            // Обновляем фильтры
            this._updateFilterOptions();
            
            logger.info(`📊 Загружено ${departments.length} отделов и ${employees.length} сотрудников для фильтров`);
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных для фильтров:', error);
        }
    }

    /**
     * Обновление опций фильтров
     */
    _updateFilterOptions() {
        // Обновляем фильтр отделов
        if (this.elements.reportDepartmentFilter) {
            const currentValue = this.elements.reportDepartmentFilter.value;
            this.elements.reportDepartmentFilter.innerHTML = '<option value="">Всі відділи</option>';
            
            this.departmentsData.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = dept.name;
                this.elements.reportDepartmentFilter.appendChild(option);
            });
            
            this.elements.reportDepartmentFilter.value = currentValue;
        }

        // Обновляем фильтр менеджеров
        if (this.elements.reportManagerFilter) {
            const currentValue = this.elements.reportManagerFilter.value;
            this.elements.reportManagerFilter.innerHTML = '<option value="">Всі менеджери</option>';
            
            this.employeesData.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = emp.name;
                this.elements.reportManagerFilter.appendChild(option);
            });
            
            this.elements.reportManagerFilter.value = currentValue;
        }
    }

    /**
     * Обновление фильтров отчетов
     */
    _updateReportFilters() {
        // Перегенерируем отчет с новыми фильтрами
        this._generateReport();
    }

    /**
     * Загрузка норм нагрузки
     */
    async _loadWorkloadNorms() {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) {
                logger.error('❌ ID компании не найден');
                return;
            }

            const normsRef = firebase.collection(firebase.db, 'companies', companyId, 'workloadNorms');
            const normsSnapshot = await firebase.getDocs(normsRef);
            
            this.workloadNorms = {};
            normsSnapshot.forEach(doc => {
                this.workloadNorms[doc.id] = doc.data();
            });

            logger.info(`📊 Загружено ${Object.keys(this.workloadNorms).length} норм нагрузки`);
            this._renderWorkloadNorms();
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки норм нагрузки:', error);
        }
    }

    /**
     * Рендеринг норм нагрузки
     */
    _renderWorkloadNorms() {
        if (!this.elements.normsContainer) return;

        const normsHTML = Object.entries(this.workloadNorms).map(([positionId, norm]) => `
            <div class="norm-item bg-gray-600 rounded p-3 flex items-center justify-between">
                <div class="norm-info">
                    <div class="text-white font-medium">${norm.positionName || 'Неизвестная должность'}</div>
                    <div class="text-gray-300 text-sm">ID: ${positionId}</div>
                </div>
                <div class="norm-values flex items-center gap-4">
                    <div class="norm-input">
                        <label class="text-xs text-gray-300">Дневная норма:</label>
                        <input type="number" value="${norm.dailyNorm || 0}" 
                               class="w-16 px-2 py-1 bg-gray-500 text-white rounded text-sm"
                               data-position-id="${positionId}" data-field="dailyNorm">
                    </div>
                    <div class="norm-input">
                        <label class="text-xs text-gray-300">Месячная норма:</label>
                        <input type="number" value="${norm.monthlyNorm || 0}" 
                               class="w-20 px-2 py-1 bg-gray-500 text-white rounded text-sm"
                               data-position-id="${positionId}" data-field="monthlyNorm">
                    </div>
                    <button class="save-norm px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                            data-position-id="${positionId}">
                        💾
                    </button>
                </div>
            </div>
        `).join('');

        this.elements.normsContainer.innerHTML = normsHTML || '<p class="text-gray-400">Нормы не настроены</p>';
        
        // Добавляем обработчики для сохранения
        this.elements.normsContainer.querySelectorAll('.save-norm').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const positionId = e.target.dataset.positionId;
                this._saveWorkloadNorm(positionId);
            });
        });
    }

    /**
     * Сохранение нормы нагрузки
     */
    async _saveWorkloadNorm(positionId) {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) return;

            const normInputs = this.elements.normsContainer.querySelectorAll(`[data-position-id="${positionId}"]`);
            const normData = {};
            
            normInputs.forEach(input => {
                const field = input.dataset.field;
                normData[field] = parseInt(input.value) || 0;
            });

            // Получаем название должности
            const positionsRef = firebase.collection(firebase.db, 'companies', companyId, 'positions');
            const positionDoc = await firebase.getDoc(firebase.doc(positionsRef, positionId));
            
            if (positionDoc.exists()) {
                normData.positionName = positionDoc.data().name;
            }

            normData.updatedAt = firebase.serverTimestamp();
            normData.updatedBy = window.state?.currentUserId;

            const normRef = firebase.doc(firebase.db, 'companies', companyId, 'workloadNorms', positionId);
            await firebase.setDoc(normRef, normData);

            logger.info(`✅ Норма нагрузки сохранена для должности: ${positionId}`);
            
            // Обновляем локальные данные
            this.workloadNorms[positionId] = normData;
            
        } catch (error) {
            logger.error('❌ Ошибка сохранения нормы нагрузки:', error);
        }
    }

    /**
     * Установка текущего периода
     */
    _setCurrentPeriod() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        this.currentPeriod = {
            start: startOfMonth,
            end: endOfMonth
        };
    }

    /**
     * Обновление периода
     */
    _updatePeriod() {
        const period = this.elements.reportPeriod.value;
        const now = new Date();
        
        switch (period) {
            case 'current_month':
                this.currentPeriod = {
                    start: new Date(now.getFullYear(), now.getMonth(), 1),
                    end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                };
                break;
            case 'last_month':
                this.currentPeriod = {
                    start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    end: new Date(now.getFullYear(), now.getMonth(), 0)
                };
                break;
            case 'current_quarter':
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
                this.currentPeriod = { start: quarterStart, end: quarterEnd };
                break;
        }
    }

    /**
     * Генерация отчета
     */
    async _generateReport() {
        try {
            logger.info('📊 Генерация отчета...');
            
            // Обновляем период
            this._updatePeriod();
            
            // Загружаем данные календаря
            const calendarData = await this._loadCalendarData();
            logger.info(`📊 Загружено ${calendarData.length} задач для отчета`);
            
            if (calendarData.length === 0) {
                logger.warn('⚠️ Нет данных для генерации отчета');
                this._renderEmptyReport();
                return;
            }
            
            // Генерируем отчеты
            logger.info('📊 Расчет динамики по дням...');
            const dailyDynamics = this._calculateDailyDynamics(calendarData);
            logger.info(`📊 Рассчитана динамика для ${dailyDynamics.length} дней`);
            
            logger.info('📊 Расчет динамики по месяцам...');
            const monthlyDynamics = this._calculateMonthlyDynamics(calendarData);
            logger.info(`📊 Рассчитана динамика для ${monthlyDynamics.length} месяцев`);
            
            logger.info('📊 Расчет анализа норм нагрузки...');
            const workloadAnalysis = await this._calculateWorkloadAnalysis(calendarData);
            logger.info(`📊 Рассчитан анализ для ${Object.keys(workloadAnalysis.positions).length} должностей`);
            
            // Отображаем результаты
            this._renderDailyDynamics(dailyDynamics);
            this._renderMonthlyDynamics(monthlyDynamics);
            this._renderWorkloadAnalysis(workloadAnalysis);
            
            logger.info('✅ Отчет сгенерирован');
            
        } catch (error) {
            logger.error('❌ Ошибка генерации отчета:', error);
            this._renderError('Ошибка генерации отчета: ' + error.message);
        }
    }

    /**
     * Загрузка данных календаря
     * Источник данных: коллекция managerCalendarTasks в Firebase
     * Эти данные синхронизируются из API и содержат все задачи календаря
     */
    async _loadCalendarData() {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) return [];

            const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'managerCalendarTasks');
            const tasksSnapshot = await firebase.getDocs(tasksRef);
            
            const tasks = [];
            tasksSnapshot.forEach(doc => {
                const data = doc.data();
                tasks.push({
                    ...data,
                    taskId: doc.id
                });
            });

            // Применяем фильтры
            const filteredTasks = this._applyFilters(tasks);
            logger.info(`📊 Загружено ${tasks.length} задач, после фильтрации: ${filteredTasks.length}`);
            return filteredTasks;
            
        } catch (error) {
            logger.error('❌ Ошибка загрузки данных календаря:', error);
            return [];
        }
    }

    /**
     * Применение фильтров к данным
     */
    _applyFilters(tasks) {
        let filteredTasks = [...tasks];

        // Фильтр по отделу
        if (this.selectedDepartment) {
            filteredTasks = filteredTasks.filter(task => {
                const employee = this.employeesData.find(emp => emp.id === task.managerId);
                return employee && employee.department === this.selectedDepartment;
            });
        }

        // Фильтр по менеджеру
        if (this.selectedManager) {
            filteredTasks = filteredTasks.filter(task => task.managerId === this.selectedManager);
        }

        // Фильтр по статусу
        if (this.selectedStatus) {
            filteredTasks = filteredTasks.filter(task => task.status === this.selectedStatus);
        }

        return filteredTasks;
    }

    /**
     * Расчет динамики по дням
     */
    _calculateDailyDynamics(calendarData) {
        const dailyStats = {};
        
        calendarData.forEach(task => {
            if (!task.originalDate) {
                logger.warn('⚠️ Задача без даты:', task);
                return;
            }
            
            const taskDate = new Date(task.originalDate);
            if (isNaN(taskDate.getTime())) {
                logger.warn('⚠️ Некорректная дата задачи:', task.originalDate);
                return;
            }
            
            const dateKey = taskDate.toISOString().split('T')[0];
            
            if (!dailyStats[dateKey]) {
                dailyStats[dateKey] = {
                    date: dateKey,
                    total: 0,
                    new: 0,
                    rescheduled: 0,
                    completed: 0,
                    active: 0
                };
            }
            
            dailyStats[dateKey].total++;
            
            switch (task.status) {
                case 'new':
                    dailyStats[dateKey].new++;
                    break;
                case 'rescheduled':
                    dailyStats[dateKey].rescheduled++;
                    break;
                case 'completed':
                    dailyStats[dateKey].completed++;
                    break;
                default:
                    dailyStats[dateKey].active++;
            }
        });

        const result = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
        logger.info(`📊 Рассчитана динамика для ${result.length} дней`);
        return result;
    }

    /**
     * Расчет динамики по месяцам
     */
    _calculateMonthlyDynamics(calendarData) {
        const monthlyStats = {};
        
        calendarData.forEach(task => {
            if (!task.originalDate) {
                return;
            }
            
            const taskDate = new Date(task.originalDate);
            if (isNaN(taskDate.getTime())) {
                return;
            }
            
            const monthKey = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = {
                    month: monthKey,
                    total: 0,
                    average: 0
                };
            }
            
            monthlyStats[monthKey].total++;
        });

        // Рассчитываем среднее
        Object.values(monthlyStats).forEach(stat => {
            const daysInMonth = new Date(stat.month + '-01').getMonth() === 1 ? 28 : 31;
            stat.average = Math.round(stat.total / daysInMonth * 10) / 10;
        });

        const result = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));
        logger.info(`📊 Рассчитана динамика для ${result.length} месяцев`);
        return result;
    }

    /**
     * Расчет анализа норм нагрузки
     */
    async _calculateWorkloadAnalysis(calendarData) {
        const analysis = {
            positions: {},
            overall: {
                totalTasks: calendarData.length,
                averageDaily: 0,
                averageMonthly: 0
            }
        };

        // Группируем по должностям (асинхронно)
        for (const task of calendarData) {
            const positionId = task.managerId ? await this._getManagerPosition(task.managerId) : null;
            if (!positionId) continue;

            if (!analysis.positions[positionId]) {
                analysis.positions[positionId] = {
                    positionId,
                    positionName: this.workloadNorms[positionId]?.positionName || 'Неизвестная должность',
                    totalTasks: 0,
                    dailyAverage: 0,
                    monthlyAverage: 0,
                    norm: this.workloadNorms[positionId] || null,
                    comparison: null
                };
            }

            analysis.positions[positionId].totalTasks++;
        }

        // Рассчитываем средние и сравнения
        Object.values(analysis.positions).forEach(position => {
            const daysInPeriod = Math.ceil((this.currentPeriod.end - this.currentPeriod.start) / (1000 * 60 * 60 * 24));
            position.dailyAverage = Math.round(position.totalTasks / daysInPeriod * 10) / 10;
            position.monthlyAverage = Math.round(position.dailyAverage * 30);

            if (position.norm) {
                position.comparison = {
                    daily: {
                        norm: position.norm.dailyNorm,
                        actual: position.dailyAverage,
                        difference: position.dailyAverage - position.norm.dailyNorm,
                        percentage: Math.round(((position.dailyAverage - position.norm.dailyNorm) / position.norm.dailyNorm) * 100)
                    },
                    monthly: {
                        norm: position.norm.monthlyNorm,
                        actual: position.monthlyAverage,
                        difference: position.monthlyAverage - position.norm.monthlyNorm,
                        percentage: Math.round(((position.monthlyAverage - position.norm.monthlyNorm) / position.norm.monthlyNorm) * 100)
                    }
                };
            }
        });

        // Общие показатели
        const daysInPeriod = Math.ceil((this.currentPeriod.end - this.currentPeriod.start) / (1000 * 60 * 60 * 24));
        analysis.overall.averageDaily = Math.round(analysis.overall.totalTasks / daysInPeriod * 10) / 10;
        analysis.overall.averageMonthly = Math.round(analysis.overall.averageDaily * 30);

        return analysis;
    }

    /**
     * Получение должности менеджера
     */
    async _getManagerPosition(managerId) {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId || !managerId) return null;

            // Получаем данные сотрудника
            const employeeRef = firebase.doc(firebase.db, 'companies', companyId, 'employees', managerId);
            const employeeDoc = await firebase.getDoc(employeeRef);
            
            if (employeeDoc.exists()) {
                const employeeData = employeeDoc.data();
                return employeeData.positionId || null;
            }
            
            return null;
            
        } catch (error) {
            logger.error('❌ Ошибка получения должности менеджера:', error);
            return null;
        }
    }

    /**
     * Рендеринг динамики по дням
     */
    _renderDailyDynamics(dailyStats) {
        if (!this.elements.dailyDynamicsChart) return;

        // Простая визуализация в виде таблицы
        const tableHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-300">
                    <thead class="text-xs uppercase bg-gray-600">
                        <tr>
                            <th class="px-4 py-2">Дата</th>
                            <th class="px-4 py-2">Всего</th>
                            <th class="px-4 py-2">Новых</th>
                            <th class="px-4 py-2">Перенесенных</th>
                            <th class="px-4 py-2">Закрытых</th>
                            <th class="px-4 py-2">Активных</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dailyStats.map(day => `
                            <tr class="border-b border-gray-600">
                                <td class="px-4 py-2">${new Date(day.date).toLocaleDateString('uk-UA')}</td>
                                <td class="px-4 py-2">${day.total}</td>
                                <td class="px-4 py-2 text-green-400">${day.new}</td>
                                <td class="px-4 py-2 text-yellow-400">${day.rescheduled}</td>
                                <td class="px-4 py-2 text-red-400">${day.completed}</td>
                                <td class="px-4 py-2 text-blue-400">${day.active}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.elements.dailyDynamicsChart.innerHTML = tableHTML;
    }

    /**
     * Рендеринг динамики по месяцам
     */
    _renderMonthlyDynamics(monthlyStats) {
        if (!this.elements.monthlyDynamicsChart) return;

        const tableHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-300">
                    <thead class="text-xs uppercase bg-gray-600">
                        <tr>
                            <th class="px-4 py-2">Месяц</th>
                            <th class="px-4 py-2">Всего дел</th>
                            <th class="px-4 py-2">Среднее в день</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlyStats.map(month => `
                            <tr class="border-b border-gray-600">
                                <td class="px-4 py-2">${new Date(month.month + '-01').toLocaleDateString('uk-UA', { year: 'numeric', month: 'long' })}</td>
                                <td class="px-4 py-2">${month.total}</td>
                                <td class="px-4 py-2">${month.average}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.elements.monthlyDynamicsChart.innerHTML = tableHTML;
    }

    /**
     * Рендеринг анализа норм нагрузки
     */
    _renderWorkloadAnalysis(analysis) {
        if (!this.elements.workloadAnalysis) return;

        const analysisHTML = `
            <div class="space-y-4">
                <div class="bg-gray-600 rounded p-4">
                    <h4 class="text-white font-medium mb-2">📊 Общие показатели</h4>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <div class="text-gray-300">Всего дел:</div>
                            <div class="text-white font-medium">${analysis.overall.totalTasks}</div>
                        </div>
                        <div>
                            <div class="text-gray-300">Среднее в день:</div>
                            <div class="text-white font-medium">${analysis.overall.averageDaily}</div>
                        </div>
                        <div>
                            <div class="text-gray-300">Среднее в месяц:</div>
                            <div class="text-white font-medium">${analysis.overall.averageMonthly}</div>
                        </div>
                    </div>
                </div>
                
                ${Object.values(analysis.positions).map(position => `
                    <div class="bg-gray-600 rounded p-4">
                        <h4 class="text-white font-medium mb-2">👤 ${position.positionName}</h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div class="text-gray-300">Всего дел:</div>
                                <div class="text-white font-medium">${position.totalTasks}</div>
                            </div>
                            <div>
                                <div class="text-gray-300">Среднее в день:</div>
                                <div class="text-white font-medium">${position.dailyAverage}</div>
                            </div>
                            ${position.comparison ? `
                                <div class="col-span-2">
                                    <div class="text-gray-300 mb-1">Сравнение с нормой:</div>
                                    <div class="text-sm">
                                        <div class="flex justify-between">
                                            <span>Норма:</span>
                                            <span class="${position.comparison.daily.difference >= 0 ? 'text-green-400' : 'text-red-400'}">
                                                ${position.comparison.daily.norm} дел/день
                                            </span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span>Факт:</span>
                                            <span class="${position.comparison.daily.difference >= 0 ? 'text-green-400' : 'text-red-400'}">
                                                ${position.comparison.daily.actual} дел/день
                                            </span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span>Разница:</span>
                                            <span class="${position.comparison.daily.difference >= 0 ? 'text-green-400' : 'text-red-400'}">
                                                ${position.comparison.daily.difference > 0 ? '+' : ''}${position.comparison.daily.difference} (${position.comparison.daily.percentage}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <div class="col-span-2 text-yellow-400 text-sm">
                                    ⚠️ Норма не настроена для этой должности
                                </div>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        this.elements.workloadAnalysis.innerHTML = analysisHTML;
    }

    /**
     * Показ модального окна добавления нормы
     */
    _showAddNormModal() {
        try {
            // Создаем модальное окно
            const modalHTML = `
                <div id="addNormModal" class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                    <div class="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-bold text-white">➕ Добавить норму нагрузки</h3>
                            <button id="closeAddNormModal" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        
                        <form id="addNormForm" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Должность</label>
                                <select id="newNormPosition" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white" required>
                                    <option value="">Выберите должность</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Дневная норма (дел)</label>
                                <input type="number" id="newNormDaily" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white" min="1" required>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Месячная норма (дел)</label>
                                <input type="number" id="newNormMonthly" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white" min="1" required>
                            </div>
                            
                            <div class="flex justify-end gap-3 pt-4">
                                <button type="button" id="cancelAddNorm" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                                    Отмена
                                </button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                    Добавить
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            // Добавляем модальное окно в DOM
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Загружаем должности
            this._loadPositionsForModal();

            // Добавляем обработчики
            this._setupAddNormModalHandlers();

        } catch (error) {
            logger.error('❌ Ошибка создания модального окна:', error);
        }
    }

    /**
     * Загрузка должностей для модального окна
     */
    async _loadPositionsForModal() {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) return;

            const positionsRef = firebase.collection(firebase.db, 'companies', companyId, 'positions');
            const positionsSnapshot = await firebase.getDocs(positionsRef);
            
            const positionSelect = document.getElementById('newNormPosition');
            if (!positionSelect) return;

            positionsSnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.data().name;
                positionSelect.appendChild(option);
            });

        } catch (error) {
            logger.error('❌ Ошибка загрузки должностей:', error);
        }
    }

    /**
     * Настройка обработчиков модального окна
     */
    _setupAddNormModalHandlers() {
        const modal = document.getElementById('addNormModal');
        const closeBtn = document.getElementById('closeAddNormModal');
        const cancelBtn = document.getElementById('cancelAddNorm');
        const form = document.getElementById('addNormForm');

        const closeModal = () => {
            if (modal) {
                modal.remove();
            }
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const positionId = document.getElementById('newNormPosition').value;
                const dailyNorm = parseInt(document.getElementById('newNormDaily').value);
                const monthlyNorm = parseInt(document.getElementById('newNormMonthly').value);

                if (!positionId || !dailyNorm || !monthlyNorm) {
                    alert('Пожалуйста, заполните все поля');
                    return;
                }

                try {
                    await this._saveNewWorkloadNorm(positionId, dailyNorm, monthlyNorm);
                    closeModal();
                } catch (error) {
                    logger.error('❌ Ошибка сохранения новой нормы:', error);
                    alert('Ошибка сохранения нормы');
                }
            });
        }
    }

    /**
     * Сохранение новой нормы нагрузки
     */
    async _saveNewWorkloadNorm(positionId, dailyNorm, monthlyNorm) {
        try {
            const companyId = window.state?.currentCompanyId;
            if (!companyId) {
                logger.error('❌ ID компании не найден');
                throw new Error('ID компании не найден');
            }

            logger.info('🔍 Проверка прав доступа для сохранения нормы...');
            logger.info('📊 Права пользователя:', window.state?.currentUserPermissions);
            logger.info('👤 Роль пользователя:', window.state?.currentUserRole);

            // Проверяем права доступа
            const userPermissions = window.state?.currentUserPermissions || {};
            const hasPermission = userPermissions['manager_calendar_manage_workload_norms'] || 
                                userPermissions['manager_calendar_view_page'] ||
                                window.state?.currentUserRole === 'owner';
            
            logger.info('✅ Права на управление нормами:', hasPermission);
            
            if (!hasPermission) {
                logger.error('❌ Нет прав для управления нормами нагрузки');
                throw new Error('Нет прав для управления нормами нагрузки');
            }

            // Получаем название должности
            const positionsRef = firebase.collection(firebase.db, 'companies', companyId, 'positions');
            const positionDoc = await firebase.getDoc(firebase.doc(firebase.db, 'companies', companyId, 'positions', positionId));
            
            const normData = {
                positionId: positionId,
                dailyNorm: parseInt(dailyNorm),
                monthlyNorm: parseInt(monthlyNorm),
                updatedAt: firebase.serverTimestamp(),
                updatedBy: window.state?.currentUserId
            };

            if (positionDoc.exists()) {
                normData.positionName = positionDoc.data().name;
            }

            logger.info('💾 Сохранение нормы в Firebase...');
            logger.info('📊 Данные для сохранения:', normData);
            
            const normRef = firebase.doc(firebase.db, 'companies', companyId, 'workloadNorms', positionId);
            await firebase.setDoc(normRef, normData);

            logger.info('✅ Норма успешно сохранена в Firebase');

            // Обновляем локальные данные
            this.workloadNorms[positionId] = normData;
            
            // Обновляем отображение
            this._renderWorkloadNorms();

            logger.info(`✅ Новая норма нагрузки сохранена для должности: ${positionId}`);
            
        } catch (error) {
            logger.error('❌ Ошибка сохранения новой нормы нагрузки:', error);
            logger.error('❌ Детали ошибки:', {
                companyId,
                positionId,
                dailyNorm,
                monthlyNorm,
                errorMessage: error.message,
                errorCode: error.code
            });
            throw error;
        }
    }

    /**
     * Рендеринг ошибки доступа
     */
    _renderAccessDenied() {
        this.container.innerHTML = `
            <div class="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
                <h3 class="text-lg font-semibold mb-2">🚫 Доступ запрещен</h3>
                <p>У вас нет прав для просмотра отчетов календаря.</p>
            </div>
        `;
    }

    /**
     * Рендеринг пустого отчета
     */
    _renderEmptyReport() {
        if (!this.elements.dailyDynamicsChart) return;
        
        const emptyHTML = `
            <div class="text-center text-gray-400">
                <div class="text-2xl mb-2">📊</div>
                <div>Нет данных для отображения</div>
                <div class="text-sm mt-2">Попробуйте изменить фильтры или период</div>
            </div>
        `;
        
        this.elements.dailyDynamicsChart.innerHTML = emptyHTML;
        this.elements.monthlyDynamicsChart.innerHTML = emptyHTML;
        this.elements.workloadAnalysis.innerHTML = emptyHTML;
    }

    /**
     * Рендеринг ошибки
     */
    _renderError(message) {
        this.container.innerHTML = `
            <div class="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
                <h3 class="text-lg font-semibold mb-2">❌ Ошибка</h3>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Очистка модуля
     */
    cleanup() {
        this.isInitialized = false;
        this.container = null;
        this.elements = {};
        this.workloadNorms = {};
        this.reportData = null;
        logger.info('🧹 Модуль отчетов очищен');
    }
}

// Глобальные функции для интеграции
let calendarReportsInstance = null;

/**
 * Инициализация модуля отчетов
 */
window.initCalendarReportsModule = async function(container) {
    logger.info('🚀 Инициализация модуля отчетов календаря');
    
    if (!calendarReportsInstance) {
        calendarReportsInstance = new CalendarReports();
    }
    
    await calendarReportsInstance.init(container);
};

/**
 * Очистка модуля отчетов
 */
window.cleanupCalendarReportsModule = function() {
    logger.info('🧹 Очистка модуля отчетов календаря');
    
    if (calendarReportsInstance) {
        calendarReportsInstance.cleanup();
        calendarReportsInstance = null;
    }
};

// Экспорт для использования как ES модуль
export { CalendarReports };
export const initCalendarReportsModule = window.initCalendarReportsModule;
export const cleanupCalendarReportsModule = window.cleanupCalendarReportsModule; 