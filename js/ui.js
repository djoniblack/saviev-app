// js/ui.js

// === ГЛОБАЛЬНІ ЗМІННІ МОДУЛЯ ===

// Змінна для зберігання посилань на DOM-елементи.
// Вона буде заповнена функцією initializeDOMElements().
export let elements = {};

// Стек для відстеження відкритих модальних вікон.
let openedModalsStack = [];

// Змінні для зберігання екземплярів графіків Chart.js
let salaryDynamicsChartInstance = null;
let salesDynamicsChartInstance = null;

// Глобальні об'єкти для статусів відпусток, доступні для всього модуля UI
const statusClasses = {
    pending: 'bg-yellow-500/20 border-yellow-500',
    approved: 'bg-green-500/20 border-green-500',
    denied: 'bg-red-500/20 border-red-500',
};
const statusTexts = {
    pending: 'Очікує',
    approved: 'Погоджено',
    denied: 'Відхилено',
};

// === НОВЕ: Список всіх можливих дозволів ===
export const ALL_POSSIBLE_PERMISSIONS = [
    // Табель
    { id: 'timesheet_view', label: 'Перегляд табеля (основна сторінка)' },
    { id: 'timesheet_edit_cells', label: 'Редагування комірок табеля' },
    { id: 'timesheet_archive_employees', label: 'Архівування/розархівування співробітників у табелі' },
    { id: 'timesheet_fill_schedule', label: 'Заповнення табеля за графіком відділу' },
    { id: 'timesheet_clear_month', label: 'Очищення даних табеля за місяць' },
    { id: 'timesheet_change_norm', label: 'Зміна норми робочих днів (глобально/за графіком)' },
    { id: 'timesheet_export', label: 'Експорт табеля в Excel' },

    // Масовий розрахунок ЗП
    { id: 'massSalary_view_page', label: 'Доступ до сторінки "Масовий розрахунок"' },
    { id: 'massSalary_generate_table', label: 'Формування таблиці масового розрахунку' },
    { id: 'massSalary_calculate_all', label: 'Запуск розрахунку "Розрахувати все"' },
    { id: 'massSalary_save_snapshot', label: 'Збереження знімку масового розрахунку' },
    { id: 'massSalary_export_excel', label: 'Експорт масового розрахунку в Excel' },

    // KPI (Одиночний розрахунок ЗП)
    { id: 'kpiIndividual_view_page', label: 'Доступ до сторінки "KPI (Одиночний)"' },
    { id: 'kpiIndividual_load_actuals', label: 'Завантаження збережених KPI даних співробітника' },
    { id: 'kpiIndividual_calculate', label: 'Розрахунок індивідуальної ЗП по KPI' },
    { id: 'kpiIndividual_save_actuals', label: 'Збереження фактичних даних KPI співробітника' },

    // Звіти
    { id: 'reports_view_page', label: 'Доступ до сторінки "Звіти"' },
    { id: 'reports_view_dynamics', label: 'Перегляд звіту "Динаміка по місяцях"' },

    // Відпустки
    { id: 'vacations_view_page', label: 'Доступ до сторінки "Відпустки"' },
    { id: 'vacations_create_own', label: 'Створення власних заявок на відпустку' },
    { id: 'vacations_create_for_department', label: 'Створення заявок для співробітників свого відділу' },
    { id: 'vacations_view_all', label: 'Перегляд всіх заявок в компанії' },
    { id: 'vacations_view_department', label: 'Перегляд заявок свого відділу' },
    { id: 'vacations_manage_requests', label: 'Керування запитами на відпустку (погодження/відхилення)' },

    // Компетенції
    { id: 'competencies_view_page', label: 'Доступ до сторінки "Компетенції"' },
    { id: 'competencies_assess_employees', label: 'Проведення оцінки компетенцій співробітників' },
    { id: 'competencies_view_reports', label: 'Перегляд звітів по компетенціям' },
    { id: 'competencies_manage_models', label: 'Керування моделями компетенцій (створення, редагування, видалення)' },
    { id: 'competencies_view_own_assessment', label: 'Перегляд власної оцінки компетенцій' },

    // Налаштування - Персонал
    { id: 'settings_employees_manage', label: 'Керування співробітниками (перегляд, додавання, редагування, видалення)' },
    { id: 'settings_departments_manage', label: 'Керування відділами' },
    { id: 'settings_schedules_manage', label: 'Керування графіками роботи' },
    { id: 'settings_positions_manage', label: 'Керування посадами' },

    // Налаштування - Адміністрування
    { id: 'settings_users_access_manage', label: 'Керування доступом користувачів до компанії' },
    { id: 'settings_roles_manage', label: 'Керування ролями доступу (створення, редагування, видалення ролей)' },
    { id: 'settings_kpi_constructor_manage', label: 'Керування конструктором KPI (шаблони ЗП)' },
    
    // Загальні налаштування компанії (майбутнє)
    // { id: 'settings_company_edit', label: 'Редагування основних даних компанії' }
    { id: 'orgchart_view_page', label: 'Доступ до сторінки "Оргструктура"' }, // Новое право для оргструктуры
    // --- Додавання продажів ---
    { id: 'sales_manage', label: 'Додавання та редагування продажів (Звіти)' },
    { id: 'sales_assistant_page', label: 'Доступ до сторінки "Помічник продажу"' }, // Додано сторінку помічника продажу
    { id: 'focus_view', label: 'Перегляд модуля Фокус' },
    { id: 'focus_create', label: 'Створення фокусних задач' },
    { id: 'focus_edit', label: 'Редагування фокусних задач' },
    { id: 'focus_manage', label: 'Повне керування фокусними задачами' },
    // --- Доступ до модуля "Створи мій день" ---
    { id: 'smartday_access', label: 'Доступ до модуля "Створи мій день"' },
    
    // --- Дебіторська заборгованість ---
    { id: 'debts_view_page', label: 'Доступ до модуля "Дебіторка"' },
    { id: 'debts_view_all_clients', label: 'Перегляд всіх заборгованостей компанії' },
    { id: 'debts_view_manager_clients', label: 'Перегляд заборгованостей власних клієнтів' },
    { id: 'debts_view_department_clients', label: 'Перегляд заборгованостей свого відділу' },
    { id: 'debts_add_comments', label: 'Додавання коментарів по заборгованостях' },
    { id: 'debts_edit_comments', label: 'Редагування коментарів по заборгованостях' },
    { id: 'debts_delete_comments', label: 'Видалення коментарів по заборгованостях' },
    { id: 'debts_add_forecasts', label: 'Створення прогнозів оплат' },
    { id: 'debts_edit_forecasts', label: 'Редагування прогнозів оплат' },
    { id: 'debts_delete_forecasts', label: 'Видалення прогнозів оплат' },
    { id: 'debts_export_data', label: 'Експорт звіту дебіторки в Excel/CSV' },
    
    // --- План-Факт ---
    { id: 'planfact_view_page', label: 'Доступ до модуля "План-Факт"' },
    { id: 'planfact_create_plans', label: 'Створення планів' },
    { id: 'planfact_edit_own_plans', label: 'Редагування власних планів' },
    { id: 'planfact_edit_all_plans', label: 'Редагування всіх планів компанії' },
    { id: 'planfact_delete_own_plans', label: 'Видалення власних планів' },
    { id: 'planfact_delete_all_plans', label: 'Видалення всіх планів компанії' },
    { id: 'planfact_view_dashboard', label: 'Перегляд дашборду та аналітики' },
    { id: 'planfact_create_targets', label: 'Створення цілей та KPI в планах' },
    { id: 'planfact_edit_targets', label: 'Редагування цілей та KPI в планах' },
];


// === ОСНОВНІ ФУНКЦІЇ ІНІЦІАЛІЗАЦІЇ ТА КЕРУВАННЯ UI ===

/**
 * Ініціалізує посилання на всі необхідні DOM-елементи.
 * Ця функція повинна бути викликана в main.js після події DOMContentLoaded.
 */
export function initializeDOMElements() {
    Object.assign(elements, {
        // Основні контейнери сторінок
        pages: {
            landingPage: document.getElementById('landingPage'),
            setupPage: document.getElementById('setupPage'),
            appPage: document.getElementById('appPage'),
            salaryPage: document.getElementById('salaryPage'),
            massSalaryPage: document.getElementById('massSalaryPage'),
            reportsPage: document.getElementById('reportsPage'), 
            vacationsPage: document.getElementById('vacationsPage'), // Додано сторінку відпусток
            competenciesPage: document.getElementById('competenciesPage'), // Додано сторінку компетенцій
            orgchartPage: document.getElementById('orgchartPage'), // Додано сторінку оргструктуры
            salesAssistantPage: document.getElementById('salesAssistantPage'), // Додано сторінку помічника продажу
        },
        appContainer: document.getElementById('appContainer'),
        navButtons: document.querySelectorAll('.nav-btn'),
        pageContainer: document.getElementById('page-container'),

        loadingOverlay: document.getElementById('loading'),
        toastContainer: document.getElementById('toast-container'), // Контейнер для тостів
        
        // Авторизація та вхід
        authContainer: document.getElementById('authContainer'),
        authError: document.getElementById('authError'),
        authEmail: document.getElementById('authEmail'),
        authPassword: document.getElementById('authPassword'),
        loginBtn: document.getElementById('loginBtn'), 
        registerBtn: document.getElementById('registerBtn'), 
        startAppBtn: document.getElementById('startAppBtn'),
        
        // Керування компанією та вихід (з новою структурою)
        logoutBtn: document.getElementById('logoutBtn'),
        logoutBtnFromSetup: document.getElementById('logoutBtnFromSetup'),
        companySelectionContainer: document.getElementById('companySelectionContainer'),
        companyListUl: document.getElementById('companyList'),
        existingCompaniesSection: document.getElementById('existingCompaniesSection'),
        createCompanyForm: document.getElementById('createCompanyForm'),
        newCompanyName: document.getElementById('newCompanyName'),
        newCompanySphere: document.getElementById('newCompanySphere'),
        companySetupSteps: document.getElementById('companySetupSteps'),
        selectedCompanyName: document.getElementById('selectedCompanyName'),
        currentCompanyNameDisplay: document.getElementById('currentCompanyNameDisplay'),
        showCreateCompanyFormBtn: document.getElementById('showCreateCompanyFormBtn'), 
        cancelCreateCompanyBtn: document.getElementById('cancelCreateCompanyBtn'), 
        createCompanyBtn: document.getElementById('createCompanyBtn'), 
        goToAppBtn: document.getElementById('goToAppBtn'),
        changeCompanyBtn: document.getElementById('changeCompanyBtn'),

        // Табель
        tableHead: document.querySelector('#timesheetTable thead'),
        tableBody: document.querySelector('#timesheetTable tbody'),
        currentMonthDisplay: document.getElementById('currentMonthDisplay'),
        departmentFilter: document.getElementById('departmentFilter'),
        employeeFilter: document.getElementById('employeeFilter'),
        employeeDatalist: document.getElementById('employeeDatalist'),
        showArchived: document.getElementById('showArchived'),
        workNormInput: document.getElementById('workNorm'),
        normTypeToggle: document.getElementById('normTypeToggle'),
        globalNormContainer: document.getElementById('globalNormContainer'),
        normTypeTextGlobal: document.getElementById('normTypeTextGlobal'),
        normTypeTextSchedule: document.getElementById('normTypeTextSchedule'),
        prevMonth: document.getElementById('prevMonth'), 
        nextMonth: document.getElementById('nextMonth'), 
        clearMonthData: document.getElementById('clearMonthData'), 
        openExportModalBtn: document.getElementById('openExportModalBtn'), 
        settingsMenuBtn: document.getElementById('settingsMenuBtn'), 
        resetFilters: document.getElementById('resetFilters'), 
        
        // Масовий розрахунок ЗП
        massSalaryPrevMonth: document.getElementById('massSalaryPrevMonth'),
        massSalaryCurrentMonth: document.getElementById('massSalaryCurrentMonth'),
        massSalaryNextMonth: document.getElementById('massSalaryNextMonth'),
        massSalaryDepartmentFilter: document.getElementById('massSalaryDepartmentFilter'),
        generateMassSalaryTableBtn: document.getElementById('generateMassSalaryTableBtn'),
        massSalaryTableContainer: document.getElementById('massSalaryTableContainer'),
        massSalaryFooterActions: document.getElementById('massSalaryFooterActions'),
        calculateAllSalariesBtn: document.getElementById('calculateAllSalariesBtn'),
        exportAllSalariesBtn: document.getElementById('exportAllSalariesBtn'),
        saveMassSalaryBtn: document.getElementById('saveMassSalaryBtn'),

        // Модальні вікна - Редактор співробітника та аватари
        employeeEditorModal: document.getElementById('employeeEditorModal'),
        employeeEditorTitle: document.getElementById('employeeEditorTitle'),
        newEmployeeName: document.getElementById('newEmployeeName'),
        newEmployeeDeptSelect: document.getElementById('newEmployeeDeptSelect'),
        newEmployeePositionSelect: document.getElementById('newEmployeePositionSelect'),
        saveEmployeeBtn: document.getElementById('saveEmployeeBtn'), 
        openAddEmployeeModalBtn: document.getElementById('openAddEmployeeModalBtn'), 
        employeeAvatarPreview: document.getElementById('employeeAvatarPreview'),
        avatarUploadInput: document.getElementById('avatarUpload'),
        uploadAvatarBtn: document.getElementById('uploadAvatarBtn'),

        // Модальні вікна - Менеджери
        employeeManagerModal: document.getElementById('employeeManagerModal'),
        employeesGrid: document.getElementById('employeesGrid'),
        departmentManagerModal: document.getElementById('departmentManagerModal'),
        departmentsGrid: document.getElementById('departmentsGrid'),
        positionManagerModal: document.getElementById('positionManagerModal'),
        positionsGrid: document.getElementById('positionsGrid'),
        scheduleManagerModal: document.getElementById('scheduleManagerModal'),
        schedulesGrid: document.getElementById('schedulesGrid'),
        rolesManagerModal: document.getElementById('rolesManagerModal'),
        rolesList: document.getElementById('rolesList'),
        userAccessModal: document.getElementById('userAccessModal'),
        userList: document.getElementById('userList'),
        settingsWindow: {
            modal: document.getElementById('settingsWindowModal'),
            content: document.getElementById('settingsWindowContent'),
            // Кнопки всередині SettingsWindow для керування дозволами
            btnManageEmployees: document.querySelector('[data-modal-target="employeeManagerModal"]'),
            btnManageDepartments: document.querySelector('[data-modal-target="departmentManagerModal"]'),
            btnManageSchedules: document.querySelector('[data-modal-target="scheduleManagerModal"]'),
            btnManagePositions: document.querySelector('[data-modal-target="positionManagerModal"]'),
            btnManageUserAccess: document.querySelector('[data-modal-target="userAccessModal"]'),
            btnManageRoles: document.querySelector('[data-modal-target="rolesManagerModal"]'),
            btnManageKpiConstructor: document.querySelector('[data-modal-target="kpiManagerModal"]'),
        },
        closeSettingsWindowButton: document.getElementById('closeSettingsWindowButton'),
        
        // Модальні вікна - Редактори (продовження)
        departmentEditorModal: document.getElementById('departmentEditorModal'),
        departmentEditorTitle: document.getElementById('departmentEditorTitle'),
        editDepartmentName: document.getElementById('editDepartmentName'),
        departmentScheduleSelect: document.getElementById('departmentScheduleSelect'),
        departmentManagerSelect: document.getElementById('departmentManagerSelect'), // Додано
        saveDepartmentBtn: document.getElementById('saveDepartmentBtn'), 
        openAddDepartmentModalBtn: document.getElementById('openAddDepartmentModalBtn'),
        positionEditorModal: document.getElementById('positionEditorModal'),
        positionEditorTitle: document.getElementById('positionEditorTitle'),
        editPositionName: document.getElementById('editPositionName'),
        savePositionBtn: document.getElementById('savePositionBtn'), 
        openAddPositionModalBtn: document.getElementById('openAddPositionModalBtn'), 
        cellEditorModal: document.getElementById('cellEditorModal'),
        cellEditorTitle: document.getElementById('cellEditorTitle'),
        planStatusButtons: document.getElementById('planStatusButtons'),
        factStatusButtons: document.getElementById('factStatusButtons'),
        clearCellDataBtn: document.getElementById('clearCellDataBtn'), 
        scheduleName: document.getElementById('scheduleName'),
        weekdaysContainer: document.getElementById('weekdays'),
        saveScheduleBtn: document.getElementById('saveScheduleBtn'), 

        // Модальні вікна - Доступ та ролі
        addUserBtn: document.getElementById('addUserBtn'),
        newUserEmail: document.getElementById('newUserEmail'),
        newUserPassword: document.getElementById('newUserPassword'),
        linkEmployeeSelect: document.getElementById('linkEmployeeSelect'), // Додано
        newUserRole: document.getElementById('newUserRole'),
        addUserError: document.getElementById('addUserError'),
        addNewRoleBtn: document.getElementById('addNewRoleBtn'),
        roleEditor: document.getElementById('roleEditor'),
        editingRoleName: document.getElementById('editingRoleName'),
        roleNameInput: document.getElementById('roleNameInput'),
        permissionsList: document.getElementById('permissionsList'),
        saveRoleBtn: document.getElementById('saveRoleBtn'),
        deleteRoleBtn: document.getElementById('deleteRoleBtn'),
        
        // Модальні вікна - Експорт
        exportModal: document.getElementById('exportModal'),
        dateFrom: document.getElementById('dateFrom'),
        dateTo: document.getElementById('dateTo'),
        exportDepartmentFilter: document.getElementById('exportDepartmentFilter'),
        exportEmployeeFilter: document.getElementById('exportEmployeeFilter'),
        generateExportBtn: document.getElementById('generateExportBtn'), 
        
        // Модальні вікна - Конструктор KPI
        kpiManagerModal: document.getElementById('kpiManagerModal'),
        kpiPositionSelect: document.getElementById('kpiPositionSelect'),
        kpiCurrentMonthDisplay: document.getElementById('kpiCurrentMonth'),
        kpiSettingsContainer: document.getElementById('kpiSettingsContainer'),
        kpiBaseSalary: document.getElementById('kpiBaseSalary'),
        kpiPremiumBase: document.getElementById('kpiPremiumBase'),
        kpiFocus0: document.getElementById('kpiFocus0'),
        kpiFocus1: document.getElementById('kpiFocus1'),
        kpiFocus2: document.getElementById('kpiFocus2'),
        kpiTaxes: document.getElementById('kpiTaxes'),
        kpiCategoriesContainer: document.getElementById('kpiCategoriesContainer'),
        kpiWeightSumDisplay: document.getElementById('kpiWeightSum'),
        bonusesContainer: document.getElementById('bonusesContainer'),
        addKpiCategoryBtn: document.getElementById('addKpiCategoryBtn'), 
        addBonusBtn: document.getElementById('addBonusBtn'), 
        saveKpiSettingsBtn: document.getElementById('saveKpiSettingsBtn'), 
        copyKpiBtn: document.getElementById('copyKpiBtn'), 
        kpiPrevMonth: document.getElementById('kpiPrevMonth'), 
        kpiNextMonth: document.getElementById('kpiNextMonth'), 

        // Сторінка розрахунку ЗП (одиночна)
        kpiEmployeeSelectSalary: document.getElementById('kpiEmployeeSelectSalary'),
        kpiCurrentMonthSalaryDisplay: document.getElementById('kpiCurrentMonthSalary'),
        kpiSalaryDetails: document.getElementById('kpiSalaryDetails'),
        kpiSalaryBaseSalary: document.getElementById('kpiSalaryBaseSalary'),
        kpiSalaryPremiumBase: document.getElementById('kpiSalaryPremiumBase'),
        kpiSalaryCategoriesContainer: document.getElementById('kpiSalaryCategoriesContainer'),
        kpiSalaryFocusTasksContainer: document.getElementById('kpiSalaryFocusTasksContainer'),
        kpiSalaryFocusTasks: document.getElementById('kpiSalaryFocusTasks'),
        kpiSalaryBonusesContainer: document.getElementById('kpiSalaryBonusesContainer'),
        kpiSalaryTaxes: document.getElementById('kpiSalaryTaxes'),
        calculatedTotalSalary: document.getElementById('calculatedTotalSalary'),
        loadKpiActualsBtn: document.getElementById('loadKpiActualsBtn'),
        calculateSalaryBtn: document.getElementById('calculateSalaryBtn'), 
        saveKpiActualsBtn: document.getElementById('saveKpiActualsBtn'), 
        kpiPrevMonthSalary: document.getElementById('kpiPrevMonthSalary'), 
        kpiNextMonthSalary: document.getElementById('kpiNextMonthSalary'),
        
        // Сторінка Звітів
        reportDepartmentFilter: document.getElementById('reportDepartmentFilter'),
        reportTabMonthlyDynamics: document.getElementById('reportTabMonthlyDynamics'),
        reportTabPanelMonthlyDynamics: document.getElementById('reportTabPanelMonthlyDynamics'),
        salaryDynamicsChartCtx: document.getElementById('salaryDynamicsChart')?.getContext('2d'),
        createVacationRequestBtn: document.getElementById('createVacationRequestBtn'), // Додано кнопку створення запиту на відпустку
        salesDynamicsChartCtx: document.getElementById('salesDynamicsChart')?.getContext('2d'),
        detailsTableBody: document.getElementById('details-table-body'),

        // Сповіщення
        notificationsBellBtn: document.getElementById('notificationsBellBtn'),
        notificationIndicator: document.getElementById('notificationIndicator'),
        notificationsDropdown: document.getElementById('notificationsDropdown'),
        notificationsListContainer: document.getElementById('notificationsListContainer'),

        // Модальні вікна - Підтвердження
        confirmationModal: document.getElementById('confirmationModal'),
        confirmationMessage: document.getElementById('confirmationMessage'),
        myVacationRequestsList: document.getElementById('myVacationRequestsList'),
        manageVacationRequestsList: document.getElementById('manageVacationRequestsList'),
        vacationTabMyRequests: document.getElementById('vacationTabMyRequests'),
        vacationTabManageRequests: document.getElementById('vacationTabManageRequests'),
        confirmYesBtn: document.getElementById('confirmYesBtn'),
        confirmNoBtn: document.getElementById('confirmNoBtn'),
        // Нові елементи для копіювання прав власника
        copyPermissionsUserSelect: document.getElementById('copyPermissionsUserSelect'),
        copyOwnerPermissionsBtn: document.getElementById('copyOwnerPermissionsBtn'),
        copyPermissionsStatus: document.getElementById('copyPermissionsStatus'),
        selectedUserPermissionsInfo: document.getElementById('selectedUserPermissionsInfo'),
        selectedUserPermissionsList: document.getElementById('selectedUserPermissionsList'),
        copyPermissionsRoleSelect: document.getElementById('copyPermissionsRoleSelect'),
        copyOwnerPermissionsBtn: document.getElementById('copyOwnerPermissionsBtn'),
        copyPermissionsStatus: document.getElementById('copyPermissionsStatus'),
        selectedRolePermissionsInfo: document.getElementById('selectedRolePermissionsInfo'),
        selectedRolePermissionsList: document.getElementById('selectedRolePermissionsList'),
    });

    // Додаємо модальні вікна для відпусток
    Object.assign(elements, {
        // Модальне вікно для створення/перегляду заявки на відпустку
        vacationRequestModal: document.getElementById('vacationRequestModal'),
        vacationRequestModalTitle: document.getElementById('vacationRequestModalTitle'),
        vacReqEmployeeSelectContainer: document.getElementById('vacReqEmployeeSelectContainer'),
        vacReqEmployeeSelectForManager: document.getElementById('vacReqEmployeeSelectForManager'),
        vacReqEmployeeName: document.getElementById('vacReqEmployeeName'),
        vacReqDepartmentName: document.getElementById('vacReqDepartmentName'),
        vacReqStartDate: document.getElementById('vacReqStartDate'),
        vacReqEndDate: document.getElementById('vacReqEndDate'),
        vacReqComment: document.getElementById('vacReqComment'),
        vacReqStatusInfo: document.getElementById('vacReqStatusInfo'),
        vacReqStatusText: document.getElementById('vacReqStatusText'),
        vacReqDecisionCommentInfo: document.getElementById('vacReqDecisionCommentInfo'),
        vacReqDecisionCommentText: document.getElementById('vacReqDecisionCommentText'),
        vacationRequestModalActions: document.getElementById('vacationRequestModalActions'),
        submitVacationRequestBtn: document.getElementById('submitVacationRequestBtn'),
        approveVacationRequestBtn: document.getElementById('approveVacationRequestBtn'),
        denyVacationRequestBtn: document.getElementById('denyVacationRequestBtn'),

        // Модальне вікно попередження про конфлікт відпусток
        vacationConflictModal: document.getElementById('vacationConflictModal'),
        vacationConflictMessage: document.getElementById('vacationConflictMessage'),
        approveAnywayConflictBtn: document.getElementById('approveAnywayConflictBtn'),
        cancelConflictBtn: document.getElementById('cancelConflictBtn'),
    });
}

/** Показує певну сторінку програми та приховує інші з анімацією. */
export function showPage(pageId, permissions = {}) {
    const isAppPage = ['appPage', 'salaryPage', 'massSalaryPage', 'reportsPage', 'vacationsPage', 'competenciesPage', 'orgchartPage', 'salesAssistantPage'].includes(pageId); // Добавлено salesAssistantPage

    elements.appContainer.classList.toggle('hidden', !isAppPage);
    
    // Приховуємо всі сторінки спочатку
    Object.values(elements.pages).forEach(page => {
        if (page) { // Перевірка, що елемент існує
            page.classList.add('hidden');
            page.classList.remove('active'); // Також видаляємо активний клас
        }
    });

    // Обработка страниц landing та setup окремо, оскільки вони не є частиною appContainer
    if (pageId === 'landingPage') {
        elements.pages.landingPage.classList.remove('hidden');
        elements.pages.landingPage.classList.add('active');
    } else if (pageId === 'setupPage') {
        elements.pages.setupPage.classList.remove('hidden');
        elements.pages.setupPage.classList.add('active');
    }
    
    // --- NEW LOGIC START ---

    let targetPageId = pageId;
    let finalPageToShow = null;

    // 1. Визначити цільову сторінку та перевірити дозволи
    if (isAppPage) {
        const permissionMap = {
            appPage: 'timesheet_view',
            salaryPage: 'kpiIndividual_view_page',
            massSalaryPage: 'massSalary_view_page',
            reportsPage: 'reports_view_page',
            vacationsPage: 'vacations_view_page',
            competenciesPage: 'competencies_view_page',
            orgchartPage: 'orgchart_view_page',
            salesAssistantPage: 'sales_manage',
            focusPage: 'focus_view' // Додано focusPage
        };
        const permissionKey = permissionMap[targetPageId];
        const hasAccess = permissionKey ? permissions[permissionKey] === true : true;

        if (hasAccess) {
            finalPageToShow = targetPageId;
        } else {
            // 2. Якщо доступу немає, знайти першу доступну сторінку
            const firstAvailableNav = Array.from(elements.navButtons).find(btn => !btn.classList.contains('hidden'));
            if (firstAvailableNav) {
                finalPageToShow = firstAvailableNav.dataset.target;
            }
        }
    } else {
        finalPageToShow = targetPageId;
    }

    // 3. Застосувати зміни до UI
    elements.navButtons.forEach(btn => {
        const target = btn.dataset.target;
        let hasNavPermission = false;
        // (ця логіка повторюється, але це безпечно)
        const permissionMap = {
            appPage: 'timesheet_view',
            salaryPage: 'kpiIndividual_view_page',
            massSalaryPage: 'massSalary_view_page',
            reportsPage: 'reports_view_page',
            vacationsPage: 'vacations_view_page',
            competenciesPage: 'competencies_view_page',
            orgchartPage: 'orgchart_view_page',
            salesAssistantPage: 'sales_manage',
            focusPage: 'focus_view' // Додано focusPage
        };
        const permissionKey = permissionMap[target];
        hasNavPermission = permissionKey ? permissions[permissionKey] === true : true;
        
        btn.classList.toggle('hidden', !hasNavPermission);
        if (hasNavPermission && target === finalPageToShow) {
             btn.classList.add('bg-indigo-600', 'text-white');
             btn.classList.remove('bg-gray-700', 'text-gray-300');
        } else if (hasNavPermission) {
            btn.classList.remove('bg-indigo-600', 'text-white');
            btn.classList.add('bg-gray-700', 'text-gray-300');
        }
    });

    if (isAppPage) {
        if (finalPageToShow && elements.pages[finalPageToShow]) {
            elements.pages[finalPageToShow].classList.remove('hidden');
            elements.pages[finalPageToShow].classList.add('active');
        } else {
            elements.appContainer.innerHTML = '<p class="text-center text-xl text-gray-400 p-10">У вас немає доступу до жодного розділу.</p>';
        }
    }
    // --- NEW LOGIC END ---

    // --- NEW: Керований виклик ініціалізації модуля ---
    const moduleInitializers = {
        reportsPage: 'initDashboardPage',
        competenciesPage: 'initCompetenciesModule',
        salesAssistantPage: 'initSalesAssistantPage', // <--- Додаємо "Помічник продажу"
    };

    if (finalPageToShow && moduleInitializers[finalPageToShow]) {
        const initializerName = moduleInitializers[finalPageToShow];
        const finalPageToShowElement = document.getElementById(finalPageToShow); // --- NEW: Знаходимо елемент ---
        // Перевіряємо, чи існує функція в глобальному об'єкті window
        if (typeof window[initializerName] === 'function' && finalPageToShowElement) { // --- NEW: Додаємо перевірку елемента ---
            console.log(`Виклик ініціалізатора для сторінки ${finalPageToShow}: ${initializerName}`);
            window[initializerName](finalPageToShowElement); // --- NEW: Передаємо елемент як аргумент ---
        }
    }
    // --- NEW LOGIC END ---
}


/** Показує або приховує оверлей завантаження. */
export function showLoading(show) {
    if (!elements.loadingOverlay) return;
    elements.loadingOverlay.classList.toggle('hidden', !show);
}

/** Відкриває модальне вікно. */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (openedModalsStack.length > 0) {
            const topModalId = openedModalsStack[openedModalsStack.length - 1];
            const topModal = document.getElementById(topModalId);
            if (topModal && modalId !== 'confirmationModal' && modalId !== 'loading') {
                topModal.classList.add('hidden');
            }
        }
        // === NEW: Анімація ===
        if (modalId !== 'settingsWindowModal') {
            modal.classList.remove('hidden', 'opacity-0');
            modal.classList.add('opacity-100');
            const content = modal.querySelector('.modal-content-flip');
            if (content) {
                requestAnimationFrame(() => content.classList.add('show'));
            }
        } else {
            modal.classList.remove('hidden');
        }
        if (!openedModalsStack.includes(modalId)) {
            openedModalsStack.push(modalId);
        }
    }
}

/** Закриває модальне вікно. */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // === NEW: Анімація ===
        if (modalId !== 'settingsWindowModal') {
            const content = modal.querySelector('.modal-content-flip');
            if (content) {
                content.classList.remove('show');
            }
            modal.classList.remove('opacity-100');
            modal.classList.add('opacity-0');
            modal.addEventListener('transitionend', function handler(e) {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.removeEventListener('transitionend', handler);
                }
            }, { once: true });
        } else {
            modal.classList.add('hidden');
        }
        openedModalsStack = openedModalsStack.filter(id => id !== modalId);
        if (openedModalsStack.length > 0) {
            const prevModalId = openedModalsStack[openedModalsStack.length - 1];
            const prevModal = document.getElementById(prevModalId);
            if (prevModal && prevModal.classList.contains('hidden')) {
                prevModal.classList.remove('hidden');
            }
        }
    }
}


/** Відкриває анімоване вікно налаштувань. */
export function openSettingsWindow(permissions = {}) {
    const { modal, content } = elements.settingsWindow;
    if (!modal || !content) return;
    setElementEnabled(elements.settingsWindow.btnManageEmployees, permissions.settings_employees_manage);
    setElementEnabled(elements.settingsWindow.btnManageDepartments, permissions.settings_departments_manage);
    setElementEnabled(elements.settingsWindow.btnManageSchedules, permissions.settings_schedules_manage);
    setElementEnabled(elements.settingsWindow.btnManagePositions, permissions.settings_positions_manage);
    setElementEnabled(elements.settingsWindow.btnManageUserAccess, permissions.settings_users_access_manage);
    setElementEnabled(elements.settingsWindow.btnManageRoles, permissions.settings_roles_manage);
    setElementEnabled(elements.settingsWindow.btnManageKpiConstructor, permissions.settings_kpi_constructor_manage);
    const hasAnySettingAccess = Object.values(permissions).some(pVal => 
        typeof pVal === 'boolean' && pVal === true && 
        (
            permissions.settings_employees_manage ||
            permissions.settings_departments_manage ||
            permissions.settings_schedules_manage ||
            permissions.settings_positions_manage ||
            permissions.settings_users_access_manage ||
            permissions.settings_roles_manage ||
            permissions.settings_kpi_constructor_manage
        )
    );
    if (!hasAnySettingAccess && !permissions.isOwner) {
        showToast("У вас немає дозволів для доступу до налаштувань.", "warning");
        return;
    }
    // === NEW: set transform-origin to the button position ===
    try {
        const btn = elements.settingsMenuBtn;
        if (btn && content) {
            const btnRect = btn.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();
            // Вираховуємо відносно viewport, де кнопка відносно модального
            const originX = btnRect.left + btnRect.width / 2 - contentRect.left;
            const originY = btnRect.top + btnRect.height / 2 - contentRect.top;
            content.style.transformOrigin = `${originX}px ${originY}px`;
        }
    } catch (e) { /* ignore */ }
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        content.classList.add('visible');
    });
    if (!openedModalsStack.includes('settingsWindowModal')) {
        openedModalsStack.push('settingsWindowModal');
    }
}

/** Закриває анімоване вікно налаштувань. */
export function closeSettingsWindow() {
    const { modal, content } = elements.settingsWindow;
    if (!modal || !content || modal.classList.contains('hidden')) return;
    content.classList.remove('visible');
    openedModalsStack = openedModalsStack.filter(id => id !== 'settingsWindowModal');
    setTimeout(() => {
        modal.classList.add('hidden');
        if (openedModalsStack.length > 0) {
            const prevModalId = openedModalsStack[openedModalsStack.length - 1];
            const prevModal = document.getElementById(prevModalId);
            if (prevModal && prevModal.classList.contains('hidden')) {
                prevModal.classList.remove('hidden');
            }
        }
    }, 300);
}

/**
 * Відображає анімоване toast-повідомлення.
 * @param {string} message - Текст повідомлення.
 * @param {'success'|'error'|'info'|'warning'} [type='success'] - Тип повідомлення, що впливає на колір.
 * @param {number} [duration=7000] - Тривалість показу в мілісекундах.
 */
let toastIdCounter = 0;
export function showToast(message, type = 'success', duration = 5000) {
    const container = elements.toastContainer;
    if (!container) return;
    const toast = document.createElement('div');
    const toastId = `toast-${++toastIdCounter}`;
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.dataset.toastId = toastId;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 500);
    }, duration);
}

/** Відображає діалогове вікно підтвердження для користувача. */
export function showConfirmation(message, isInfo = false) {
    if (isInfo) {
        showToast(message, 'info'); 
        return Promise.resolve(true); 
    }
    return new Promise((resolve) => {
        if (!elements.confirmationModal || !elements.confirmYesBtn || !elements.confirmNoBtn) {
            console.error("Confirmation modal elements are not found in the DOM!");
            alert(message); 
            resolve(false);
            return;
        }
        elements.confirmationMessage.textContent = message;
        const newYesBtn = elements.confirmYesBtn.cloneNode(true);
        const newNoBtn = elements.confirmNoBtn.cloneNode(true);
        elements.confirmYesBtn.parentNode.replaceChild(newYesBtn, elements.confirmYesBtn);
        elements.confirmNoBtn.parentNode.replaceChild(newNoBtn, elements.confirmNoBtn);
        elements.confirmYesBtn = newYesBtn;
        elements.confirmNoBtn = newNoBtn;
        elements.confirmNoBtn.style.display = 'block';
        elements.confirmYesBtn.textContent = 'Так';
        const close = (value) => {
            closeModal('confirmationModal');
            resolve(value);
        };
        newYesBtn.onclick = () => close(true);
        newNoBtn.onclick = () => close(false);
        openModal('confirmationModal');
        // elements.confirmationModal.dataset.level = "3"; // z-index керується класами Tailwind
    });
}

// === Керування UI на сторінці автентифікації та вибору компанії ===
export function showAuthError(message) { elements.authError.textContent = message; }
export function showAuthForm(show) { elements.authContainer.classList.toggle('hidden', !show); }
export function showCompanySelection(show) { elements.companySelectionContainer.classList.toggle('hidden', !show); }
export function showCompanySetupSteps(companyName) {
    elements.selectedCompanyName.textContent = companyName;
    elements.currentCompanyNameDisplay.textContent = companyName;
    elements.companySetupSteps.classList.remove('hidden');
    elements.existingCompaniesSection.classList.add('hidden');
    elements.createCompanyForm.classList.add('hidden');
}
export function showCreateCompanyForm(show) {
    elements.existingCompaniesSection.classList.toggle('hidden', show);
    elements.createCompanyForm.classList.toggle('hidden', !show);
    elements.newCompanyName.value = '';
    elements.newCompanySphere.value = '';
}

/**
 * Оновлює індикатор сповіщень (червона крапка на дзвіночку).
 * @param {number} count - Кількість нових сповіщень.
 */
export function updateNotificationBell(count) {
    if (elements.notificationIndicator) {
        if (count > 0) {
            elements.notificationIndicator.classList.remove('hidden');
            // Якщо потрібно відображати число, можна додати:
            // elements.notificationIndicator.textContent = count;
        } else {
            elements.notificationIndicator.classList.add('hidden');
        }
    }
}

/**
 * Рендерить список сповіщень у випадаючому меню.
 * @param {Array<Object>} requests - Масив об'єктів заявок на відпустку.
 * @param {function(string)} onNotificationClick - Колбек, що викликається при кліку на сповіщення, передає ID заявки.
 */
export function renderNotifications(requests, onNotificationClick) {
    if (!elements.notificationsListContainer) return;

    elements.notificationsListContainer.innerHTML = '';
    if (requests.length === 0) {
        elements.notificationsListContainer.innerHTML = '<p class="text-gray-400 text-center py-4">Немає нових сповіщень.</p>';
        return;
    }

    requests.forEach(req => {
        const notificationItem = document.createElement('div');
        notificationItem.className = 'p-3 border-b border-gray-600 last:border-b-0 hover:bg-gray-600 cursor-pointer';
        notificationItem.innerHTML = `
            <p class="text-sm font-medium text-white">Заявка на відпустку від ${req.employeeName}</p>
            <p class="text-xs text-gray-400">${req.startDate.toLocaleDateString()} - ${req.endDate.toLocaleDateString()}</p>
            <p class="text-xs text-gray-500 mt-1">Статус: <span class="capitalize text-yellow-300">${req.status}</span></p>
        `;
        notificationItem.addEventListener('click', () => onNotificationClick(req.id));
        elements.notificationsListContainer.appendChild(notificationItem);
    });
}

export function toggleNotificationsDropdown() {
    if (elements.notificationsDropdown) {
        elements.notificationsDropdown.classList.toggle('hidden');
    }
}
// === ФУНКЦІЇ РЕНДЕРИНГУ КОНКРЕТНИХ КОМПОНЕНТІВ ===
export function renderCompanyList(companies, onSelectCompany) {
    elements.companyListUl.innerHTML = '';
    if (companies.length === 0) {
        showCreateCompanyForm(true);
        elements.companyListUl.innerHTML = '<li class="text-gray-400">Ще не створено жодної компанії.</li>';
    } else {
        showCreateCompanyForm(false);
        companies.forEach(company => {
            const li = document.createElement('li');
            li.className = "flex justify-between items-center p-2 bg-gray-700 rounded-md";
            li.innerHTML = `<span class="text-gray-200">${company.name}</span> <button class="select-company-btn px-3 py-1 bg-indigo-500 text-white text-sm rounded-md hover:bg-indigo-600">Обрати</button>`;
            li.querySelector('.select-company-btn').onclick = () => onSelectCompany(company.id, company.name);
            elements.companyListUl.appendChild(li);
        });
    }
}
export function renderUserList(members, allEmployees, currentUserId, availableRoles, handlers, currentUserPermissions = {}) {
    elements.userList.innerHTML = '';
    if (members.length === 0) {
        elements.userList.innerHTML = `<p class="text-gray-400">Інших користувачів ще не додано.</p>`;
        return;
    }
    const canChangeRole = currentUserPermissions.settings_users_access_manage === true || currentUserPermissions.isOwner === true;
    const canRemoveUser = currentUserPermissions.settings_users_access_manage === true || currentUserPermissions.isOwner === true;
    const employeeMap = new Map(allEmployees.map(e => [e.id, e.name]));
    const linkedEmployeeIds = new Set(members.map(m => m.employeeId).filter(Boolean));
    const table = document.createElement('table');
    table.className = 'w-full text-sm';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr class="bg-gray-800">
        <th class="p-2 text-left">Email</th>
        <th class="p-2 text-left">Роль</th>
        <th class="p-2 text-left">Співробітник</th>
        <th class="p-2 text-center">Дії</th>
    </tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    members.sort((a, b) => a.email.localeCompare(b.email)).forEach(member => {
        const isOwner = member.role === 'owner';
        const isCurrentUser = member.id === currentUserId;
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-700 hover:bg-gray-800';
        // Email
        const tdEmail = document.createElement('td');
        tdEmail.className = 'p-2';
        tdEmail.textContent = member.email;
        tr.appendChild(tdEmail);
        // Роль
        const tdRole = document.createElement('td');
        tdRole.className = 'p-2';
        if (isOwner) {
            tdRole.innerHTML = '<span class="text-yellow-400 font-semibold">Власник</span>';
        } else {
            const select = document.createElement('select');
            select.className = 'dark-input p-1 text-xs';
            select.disabled = !canChangeRole || isCurrentUser;
            let optionsHtml = '';
            availableRoles.forEach(role => {
                if (role.name.toLowerCase() === 'owner') return;
                const selected = member.roleId === role.id ? 'selected' : '';
                optionsHtml += `<option value="${role.id}" ${selected}>${role.name}</option>`;
            });
            if (!member.roleId) {
                optionsHtml = `<option value="" selected>Без ролі</option>` + optionsHtml;
            }
            select.innerHTML = optionsHtml;
            select.addEventListener('change', (e) => handlers.onChangeRole(member.id, e.target.value));
            tdRole.appendChild(select);
        }
        tr.appendChild(tdRole);
        // Співробітник
        const tdEmp = document.createElement('td');
        tdEmp.className = 'p-2';
        if (canChangeRole) {
            const select = document.createElement('select');
            select.className = 'dark-input p-1 text-xs';
            const unlinkedAndCurrentEmployee = allEmployees.filter(emp => !linkedEmployeeIds.has(emp.id) || emp.id === member.employeeId);
            unlinkedAndCurrentEmployee.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
            let optionsHtml = '<option value="">Не прив\'язувати</option>';
            unlinkedAndCurrentEmployee.forEach(emp => {
                const selected = emp.id === member.employeeId ? 'selected' : '';
                optionsHtml += `<option value="${emp.id}" ${selected}>${emp.name}</option>`;
            });
            select.innerHTML = optionsHtml;
            select.addEventListener('change', (e) => handlers.onLinkEmployee(member.id, e.target.value || null));
            tdEmp.appendChild(select);
        } else {
            tdEmp.textContent = member.employeeId ? (employeeMap.get(member.employeeId) || '') : '';
        }
        tr.appendChild(tdEmp);
        // Дії
        const tdActions = document.createElement('td');
        tdActions.className = 'p-2 text-center';
        if (!isCurrentUser && !isOwner && canRemoveUser) {
            // Видалити
            const delBtn = document.createElement('button');
            delBtn.className = 'icon-btn text-red-500';
            delBtn.title = 'Видалити користувача';
            delBtn.innerHTML = '🗑️';
            delBtn.onclick = () => handlers.onRemoveUser(member.id, member.email);
            tdActions.appendChild(delBtn);
            // Змінити email
            const emailBtn = document.createElement('button');
            emailBtn.className = 'icon-btn text-blue-400 ml-2';
            emailBtn.title = 'Змінити email';
            emailBtn.innerHTML = '✉️';
            emailBtn.onclick = () => handlers.onChangeEmail(member.id, member.email);
            tdActions.appendChild(emailBtn);
            // Скинути пароль
            const pwdBtn = document.createElement('button');
            pwdBtn.className = 'icon-btn text-green-400 ml-2';
            pwdBtn.title = 'Скинути пароль';
            pwdBtn.innerHTML = '🔑';
            pwdBtn.onclick = () => handlers.onResetPassword(member.email);
            tdActions.appendChild(pwdBtn);
        }
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    elements.userList.appendChild(table);
}

/** Рендерить заголовок таблиці табелю (дні місяця). */
export function renderHeader(currentDate) {
    elements.currentMonthDisplay.textContent = currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th class="header-action py-3 px-2 text-xs font-medium text-gray-300 uppercase tracking-wider rounded-tl-lg">Дії</th>
        <th class="header-name py-3 px-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ПІБ / Відділ</th>
    `;
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayName = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dayOfWeek];
        const th = document.createElement('th');
        th.className = `py-3 px-1 text-xs font-medium text-gray-300 uppercase tracking-wider ${isWeekend ? 'weekend-day' : ''}`;
        th.textContent = `${i} ${dayName}`;
        headerRow.appendChild(th);
    }
    headerRow.innerHTML += `
        <th class="py-3 px-2 text-xs font-medium text-gray-300 uppercase tracking-wider">Відпустка (роб.)</th>
        <th class="py-3 px-2 text-xs font-medium text-gray-300 uppercase tracking-wider">Лікарняний (роб.)</th>
        <th class="py-3 px-2 text-xs font-medium text-gray-300 uppercase tracking-wider">Відпрац. (факт)</th>
        <th class="py-3 px-2 text-xs font-medium text-gray-300 uppercase tracking-wider rounded-tr-lg">Норма</th>
    `;
    elements.tableHead.innerHTML = '';
    elements.tableHead.appendChild(headerRow);
}

/** Рендерить тіло таблиці табелю. */
export function renderBody(employees, departments, positions, currentDate, handlers, permissions = {}) {
    elements.tableBody.innerHTML = '';
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const currentMonthYearKey = `${currentDate.getFullYear()}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const departmentMap = new Map(departments.map(d => [d.id, d])); // Для швидкого пошуку відділу

    if (employees.length === 0) {
        elements.tableBody.innerHTML = `<tr><td colspan="${daysInMonth + 4}" class="p-4 text-center text-gray-400">Немає співробітників, що відповідають фільтрам, або створіть нових.</td></tr>`;
        return;
    }
    // === Групування по відділу ===
    const grouped = {};
    employees.forEach(emp => {
        const deptId = emp.department || 'no_department';
        if (!grouped[deptId]) grouped[deptId] = [];
        grouped[deptId].push(emp);
    });
    Object.entries(grouped).forEach(([deptId, emps]) => {
        const dept = departmentMap.get(deptId);
        const deptName = dept ? dept.name : 'Без відділу';
        const deptRow = document.createElement('tr');
        deptRow.className = 'department-row';
        const deptCell = document.createElement('td');
        deptCell.colSpan = daysInMonth + 4;
        deptCell.textContent = `Відділ: ${deptName}`;
        deptCell.style.background = '#232b3a';
        deptCell.style.color = '#bcbcbc';
        deptCell.style.fontWeight = 'bold';
        deptCell.style.textAlign = 'left';
        deptCell.style.fontSize = '1.1em';
        deptCell.style.letterSpacing = '0.5px';
        deptRow.appendChild(deptCell);
        elements.tableBody.appendChild(deptRow);
        // === Сортування: керівник перший, решта по алфавіту ===
        let sortedEmps = emps;
        if (dept && dept.managerId) {
            sortedEmps = [...emps];
            sortedEmps.sort((a, b) => {
                if (a.id === dept.managerId) return -1;
                if (b.id === dept.managerId) return 1;
                return a.name.localeCompare(b.name, 'uk');
            });
        } else {
            sortedEmps = emps.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk'));
        }
        sortedEmps.forEach(employee => {
            const tr = document.createElement('tr');
            if (dept && dept.managerId && employee.id === dept.managerId) {
                tr.classList.add('manager-row');
            }
            const isArchived = employee.archivedInMonths && employee.archivedInMonths[currentMonthYearKey];
            if (isArchived) tr.classList.add('archived-row');
            // Додаю action cell першою колонкою
            const department = departments.find(d => d.id === employee.department);
            const position = positions.find(p => p.id === employee.positionId);
            const actionCell = createActionCell(employee, isArchived, handlers, permissions, department);
            tr.appendChild(actionCell);
            const nameCell = createCell(`<div>${employee.name}</div><div class="text-xs text-gray-500">${department ? department.name : 'Без відділу'} / ${position ? position.name : 'Без посади'}</div>`, 'name-cell text-left');
            tr.appendChild(nameCell);
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
                const dayKey = i.toString().padStart(2, '0');
                const dayData = (employee.timesheet && employee.timesheet[currentMonthYearKey] && employee.timesheet[currentMonthYearKey][dayKey]) || {};
                const planStatus = dayData.plan || '';
                const factStatus = dayData.fact || '';
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const cell = createCell(`<div class="plan">${planStatus}</div><div class="fact-${getStatusClass(factStatus)}">${factStatus}</div>`, `day-cell ${isWeekend ? 'weekend' : ''}`);
                if (permissions.timesheet_edit_cells) {
                    cell.addEventListener('click', () => handlers.onCellClick(employee, dayKey));
                } else {
                    cell.style.cursor = 'not-allowed';
                }
                tr.appendChild(cell);
            }
            // Add new columns for vacation and sick days
            const vacationDaysCell = createCell(employee.vacationDays, 'font-semibold text-white');
            tr.appendChild(vacationDaysCell);
            const sickDaysCell = createCell(employee.sickDays, 'font-semibold text-white');
            tr.appendChild(sickDaysCell);
            const factTotalCell = createCell(employee.workedDays, 'font-semibold text-white');
            tr.appendChild(factTotalCell);
            const norm = employee.norm;
            const normCell = createCell(norm, 'font-semibold text-white');
            tr.appendChild(normCell);
            elements.tableBody.appendChild(tr);
        });
    });
}


function getStatusClass(status) {
    if (status === 'Р') return 'work';
    if (status === 'Л') return 'sick';
    if (status === 'В') return 'vacation';
    return '';
}
export function renderDepartmentDropdowns(departments) {
    const deptSelects = [ elements.newEmployeeDeptSelect, elements.departmentFilter, elements.exportDepartmentFilter ];
    deptSelects.forEach(select => {
        if (!select) return; 
        const currentVal = select.value;
        select.innerHTML = select.id === 'departmentFilter' || select.id === 'exportDepartmentFilter'
            ? '<option value="">Всі відділи</option>'
            : '<option value="">-- Оберіть відділ --</option>';
        departments.sort((a, b) => a.name.localeCompare(b.name, 'uk')).forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            select.appendChild(option);
        });
        select.value = currentVal;
    });
}
export function renderEmployeeSelectForManager(employees, selectElement, selectedManagerId) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Без керівника --</option>';
    employees.sort((a, b) => a.name.localeCompare(b.name, 'uk')).forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.name;
        selectElement.appendChild(option);
    });
    selectElement.value = selectedManagerId || '';
}
export function renderPositionDropdowns(positions) {
    const posSelects = [ elements.newEmployeePositionSelect, elements.kpiPositionSelect ];
    posSelects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Оберіть посаду --</option>';
        positions.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(pos => {
            const option = document.createElement('option');
            option.value = pos.id;
            option.textContent = pos.name;
            select.appendChild(option);
        });
        select.value = currentVal;
    });
}
export function renderEmployeeDatalist(employees) {
    elements.employeeDatalist.innerHTML = '';
    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.name;
        elements.employeeDatalist.appendChild(option);
    });
}
export function renderEmployeeSelect(selectElement, employees, departmentId = '', selectedEmployeeId = '') {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">Всі співробітники</option>';
    const employeesToDisplay = departmentId === ''
        ? employees
        : employees.filter(emp => emp.department === departmentId);
    employeesToDisplay.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.name;
        selectElement.appendChild(option);
    });
    selectElement.value = selectedEmployeeId;
}
export function renderEmployeeManagerList(employees, departments, positions, handlers, currentDate, permissions = {}, selectedDeptId = '', allEmployees = null) {
    if (!allEmployees) allEmployees = employees; // зберігаємо повний список

    renderEmployeeManagerFilter(departments, (deptId) => {
        if (deptId) {
            const filtered = allEmployees.filter(emp => emp.department === deptId);
            renderEmployeeManagerList(filtered, departments, positions, handlers, currentDate, permissions, deptId, allEmployees);
        } else {
            renderEmployeeManagerList(allEmployees, departments, positions, handlers, currentDate, permissions, '', allEmployees);
        }
    }, selectedDeptId);
    elements.employeesGrid.innerHTML = '';
    const sortedEmployees = [...employees].sort((a,b) => a.name.localeCompare(b.name, 'uk'));
    if (sortedEmployees.length === 0) {
        elements.employeesGrid.innerHTML = '<p class="text-gray-400 text-center col-span-full">Співробітники відсутні.</p>';
        return;
    }
    const departmentMap = new Map(departments.map(d => [d.id, d]));
    const employeeMap = new Map(employees.map(e => [e.id, e.name]));
    const currentMonthYearKey = `${currentDate.getFullYear()}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    sortedEmployees.forEach(emp => {
        const position = positions.find(p => p.id === emp.positionId);
        const timesheetForMonth = emp.timesheet?.[currentMonthYearKey] || {};
        const daysWorked = Object.values(timesheetForMonth).filter(day => day.fact === 'Р').length;
        const department = departmentMap.get(emp.department);
        const managerName = department?.managerId ? employeeMap.get(department.managerId) : null;
        const card = createEmployeeFlipCard(emp, position, managerName, handlers, daysWorked, permissions.settings_employees_manage);
        elements.employeesGrid.appendChild(card);
    });
    setElementEnabled(elements.openAddEmployeeModalBtn, permissions.settings_employees_manage);
}
export function renderDepartmentManagerList(departments, schedules, allEmployees, handlers, permissions = {}) {
    elements.departmentsGrid.innerHTML = '';
    if (departments.length === 0) {
        elements.departmentsGrid.innerHTML = '<p class="text-gray-400 text-center col-span-full">Відділи відсутні.</p>';
        return;
    }
    const employeeMap = new Map(allEmployees.map(e => [e.id, e.name]));
    departments.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(dept => {
        const schedule = schedules.find(s => s.id === dept.scheduleId);
        const managerName = dept.managerId ? employeeMap.get(dept.managerId) : 'Немає';
        const subtitle = `Графік: ${schedule ? schedule.name : 'Без графіка'}<br>Керівник: ${managerName}`;
        const card = createBasicManagerCard(
            dept.name,
            subtitle,
            () => handlers.onEdit(dept),
            () => handlers.onDelete(dept),
            permissions.settings_departments_manage 
        );
        elements.departmentsGrid.appendChild(card);
    });
    setElementEnabled(elements.openAddDepartmentModalBtn, permissions.settings_departments_manage);
}
export function renderPositionManagerList(positions, handlers, permissions = {}) {
    elements.positionsGrid.innerHTML = '';
    if (positions.length === 0) {
        elements.positionsGrid.innerHTML = '<p class="text-gray-400 text-center col-span-full">Посади відсутні.</p>';
        return;
    }
    positions.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(pos => {
        const card = createBasicManagerCard(
            pos.name, '', () => handlers.onEdit(pos), () => handlers.onDelete(pos),
            permissions.settings_positions_manage
        );
        elements.positionsGrid.appendChild(card);
    });
     setElementEnabled(elements.openAddPositionModalBtn, permissions.settings_positions_manage);
}
export function renderSchedulesList(schedules, handlers, permissions = {}) {
    elements.schedulesGrid.innerHTML = '';
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    if (schedules.length === 0) {
        elements.schedulesGrid.innerHTML = '<p class="text-gray-400 text-center col-span-full">Графіки відсутні.</p>';
        return;
    }
    schedules.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(s => {
        const card = document.createElement('div');
        card.className = 'manager-card'; 
        const workDaysStr = s.workDays.sort((a,b) => a-b).map(d => daysOfWeek[d - 1]).join(', ');
        card.innerHTML = `
            <div>
                <h4 class="font-semibold text-white">${s.name}</h4>
                <p class="text-sm text-gray-400">Робочі дні: ${workDaysStr}</p>
            </div>
            <div class="manager-card-actions">
                <button type="button" class="action-btn delete" data-id="${s.id}" title="Видалити графік" ${permissions.settings_schedules_manage ? '' : 'disabled'}>&times;</button>
            </div>
        `;
        if (permissions.settings_schedules_manage) {
            card.querySelector('.delete').onclick = (event) => { event.stopPropagation(); handlers.onDelete(s); };
        }
        elements.schedulesGrid.appendChild(card);
    });
}
export function renderDepartmentScheduleDropdown(schedules, selectedScheduleId = '') {
    const select = elements.departmentScheduleSelect;
    if (!select) return;
    select.innerHTML = '<option value="">Без графіка</option>';
    schedules.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
    select.value = selectedScheduleId;
}
export function updateEmployeeEditorUI(employee = null) {
    elements.employeeEditorTitle.textContent = employee ? 'Редагувати співробітника' : 'Новий співробітник';
    elements.newEmployeeName.value = employee?.name || '';
    elements.newEmployeeDeptSelect.value = employee?.department || '';
    elements.newEmployeePositionSelect.value = employee?.positionId || '';
    elements.employeeAvatarPreview.src = employee?.avatarUrl || 'https://placehold.co/80x80/1f2937/ffffff?text=AV'; 
    elements.avatarUploadInput.value = ''; 
}
export function previewAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { elements.employeeAvatarPreview.src = e.target.result; }
        reader.readAsDataURL(file);
    }
}
export function updateDepartmentEditorUI(department = null, allEmployees = []) {
    elements.departmentEditorTitle.textContent = department ? 'Редагувати відділ' : 'Новий відділ';
    elements.editDepartmentName.value = department?.name || '';
    elements.departmentScheduleSelect.value = department?.scheduleId || '';
    renderEmployeeSelectForManager(allEmployees, elements.departmentManagerSelect, department?.managerId);
}
export function updatePositionEditorUI(position = null) {
    elements.positionEditorTitle.textContent = position ? 'Редагувати посаду' : 'Нова посада';
    elements.editPositionName.value = position?.name || '';
}
export function renderCellEditorButtons(employeeName, day, currentPlanStatus, currentFactStatus, planStatuses, factStatuses, updateCellDataHandler) {
    elements.cellEditorTitle.textContent = `Редагувати день ${parseInt(day, 10)} для ${employeeName}`;
    elements.planStatusButtons.innerHTML = '';
    Object.entries(planStatuses).forEach(([key, value]) => {
        const button = document.createElement('button');
        button.type = 'button'; 
        button.className = `status-btn ${currentPlanStatus === key ? 'selected bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`;
        button.textContent = value;
        button.onclick = () => updateCellDataHandler('plan', key);
        elements.planStatusButtons.appendChild(button);
    });
    elements.factStatusButtons.innerHTML = '';
    Object.entries(factStatuses).forEach(([key, value]) => {
        const button = document.createElement('button');
        button.type = 'button'; 
        button.className = `status-btn ${currentFactStatus === key ? 'selected bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`;
        button.textContent = value;
        button.onclick = () => updateCellDataHandler('fact', key);
        elements.factStatusButtons.appendChild(button);
    });
}
export function setExportDates(startDate, endDate) {
    elements.dateFrom.valueAsDate = startDate;
    elements.dateTo.valueAsDate = endDate;
}
export function updateKpiConstructorUI(year, month, settings, permissions = {}) {
    elements.kpiCurrentMonthDisplay.textContent = new Date(year, month).toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    elements.kpiSettingsContainer.classList.remove('hidden');
    
    const canEditKpi = permissions.settings_kpi_constructor_manage === true;
    
    elements.kpiBaseSalary.value = settings?.baseSalary || '';
    elements.kpiBaseSalary.disabled = !canEditKpi;
    elements.kpiPremiumBase.value = settings?.premiumBase || '';
    elements.kpiPremiumBase.disabled = !canEditKpi;
    elements.kpiFocus0.value = settings?.focusCoefficients?.['0'] || '';
    elements.kpiFocus0.disabled = !canEditKpi;
    elements.kpiFocus1.value = settings?.focusCoefficients?.['1'] || '';
    elements.kpiFocus1.disabled = !canEditKpi;
    elements.kpiFocus2.value = settings?.focusCoefficients?.['2'] || '';
    elements.kpiFocus2.disabled = !canEditKpi;
    elements.kpiTaxes.value = settings?.taxes || '';
    elements.kpiTaxes.disabled = !canEditKpi;

    renderKpiCategories(settings?.categories || [], canEditKpi);
    renderBonuses(settings?.bonuses || [], canEditKpi); 
    calculateKpiWeightSum();

    setElementEnabled(elements.addKpiCategoryBtn, canEditKpi);
    setElementEnabled(elements.addBonusBtn, canEditKpi);
    setElementEnabled(elements.saveKpiSettingsBtn, canEditKpi);
    setElementEnabled(elements.copyKpiBtn, canEditKpi);
}
export function renderKpiCategories(categories, canEdit = false) {
    elements.kpiCategoriesContainer.innerHTML = '<h5 class="font-medium mt-4">Вага KPI, % <span id="kpiWeightSum" class="ml-2 font-normal text-sm"></span></h5>';
    categories.forEach((cat) => { 
        if (!cat.id) cat.id = generateUniqueId();
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 mb-2';
        div.innerHTML = `
            <input type="hidden" class="kpi-category-id" value="${cat.id}">
            <input type="text" class="kpi-input flex-grow kpi-category-name" placeholder="Назва категорії" value="${cat.name || ''}" ${canEdit ? '' : 'disabled'}>
            <input type="number" class="kpi-input w-1/5 kpi-category-weight" placeholder="Вага" value="${cat.weight || ''}" step="0.1" ${canEdit ? '' : 'disabled'}>
            <button type="button" class="delete-item-btn text-red-500" ${canEdit ? '' : 'disabled'}>&times;</button>
        `;
        if (canEdit) {
            div.querySelector('.delete-item-btn').onclick = (e) => { e.target.closest('div').remove(); calculateKpiWeightSum(); }; 
            div.querySelector('.kpi-category-weight').addEventListener('input', calculateKpiWeightSum); 
        }
        elements.kpiCategoriesContainer.appendChild(div);
    });
}
export function calculateKpiWeightSum() {
    const weights = Array.from(elements.kpiCategoriesContainer.querySelectorAll('.kpi-category-weight'))
                               .map(input => parseFloat(input.value) || 0);
    const sum = weights.reduce((acc, current) => acc + current, 0);
    if (!elements.kpiWeightSumDisplay) { // Додано перевірку
        elements.kpiWeightSumDisplay = document.getElementById('kpiWeightSum');
    }
    if (elements.kpiWeightSumDisplay) { // Перевірка ще раз, після спроби отримати елемент
      elements.kpiWeightSumDisplay.textContent = `(Сума: ${sum.toFixed(1)}%)`;
      if (sum !== 100 && weights.length > 0) {
          elements.kpiWeightSumDisplay.classList.add('text-red-400');
          elements.kpiWeightSumDisplay.classList.remove('text-green-400');
      } else {
          elements.kpiWeightSumDisplay.classList.remove('text-red-400');
          elements.kpiWeightSumDisplay.classList.add('text-green-400');
      }
    }
}
export function renderBonuses(bonuses, canEdit = false) {
    elements.bonusesContainer.innerHTML = '<h4 class="font-semibold">Додаткові бонуси</h4>';
    bonuses.forEach((bonus) => {
        if (!bonus.id) bonus.id = generateUniqueId();
        const div = document.createElement('div');
        div.className = 'grid grid-cols-12 gap-2 items-center mb-2'; 
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'kpi-input col-span-5 kpi-bonus-name';
        nameInput.placeholder = 'Назва бонусу';
        nameInput.value = bonus.name || '';
        nameInput.disabled = !canEdit;

        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.className = 'kpi-bonus-id';
        idInput.value = bonus.id;

        const typeSelect = document.createElement('select');
        typeSelect.className = 'kpi-input col-span-3 kpi-bonus-type';
        typeSelect.innerHTML = `
            <option value="fixed" ${bonus.type === 'fixed' ? 'selected' : ''}>Фіксований</option>
            <option value="percentage" ${bonus.type === 'percentage' ? 'selected' : ''}>Відсотковий</option>
        `;
        typeSelect.disabled = !canEdit;

        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.className = 'kpi-input col-span-3 kpi-bonus-value'; 
        valueInput.step = bonus.type === 'percentage' ? '0.01' : '1';
        valueInput.value = bonus.value || '';
        valueInput.disabled = !canEdit;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-item-btn text-red-500 col-span-1';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.disabled = !canEdit;
        if (canEdit) {
            deleteBtn.onclick = (e) => e.target.closest('.grid').remove();
        }
        div.appendChild(idInput);
        div.appendChild(nameInput);
        div.appendChild(typeSelect);
        div.appendChild(valueInput);
        div.appendChild(deleteBtn);
        elements.bonusesContainer.appendChild(div);
    });
}
// --- Вспомогательная функция генерации уникального ID ---
function generateUniqueId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).substr(2, 9);
}
// --- Модификация addKpiCategory ---
export function addKpiCategory(canEdit = false) {
    if (!canEdit) return;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 mb-2';
    const kpiId = generateUniqueId();
    div.innerHTML = `
        <input type="hidden" class="kpi-category-id" value="${kpiId}">
        <input type="text" class="kpi-input flex-grow kpi-category-name" placeholder="Назва категорії">
        <input type="number" class="kpi-input w-1/5 kpi-category-weight" placeholder="Вага" step="0.1">
        <button type="button" class="delete-item-btn text-red-500">&times;</button>
    `;
    div.querySelector('.delete-item-btn').onclick = (e) => { e.target.closest('div').remove(); calculateKpiWeightSum(); };
    div.querySelector('.kpi-category-weight').addEventListener('input', calculateKpiWeightSum);
    elements.kpiCategoriesContainer.appendChild(div);
    calculateKpiWeightSum();
}
// --- Модификация addBonus ---
export function addBonus(canEdit = false) {
    if (!canEdit) return;
    const div = document.createElement('div');
    div.className = 'grid grid-cols-12 gap-2 items-center mb-2';
    const bonusId = generateUniqueId();
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'kpi-input col-span-5 kpi-bonus-name';
    nameInput.placeholder = 'Назва бонусу';
    const idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.className = 'kpi-bonus-id';
    idInput.value = bonusId;
    const typeSelect = document.createElement('select');
    typeSelect.className = 'kpi-input col-span-3 kpi-bonus-type';
    typeSelect.innerHTML = `
        <option value="fixed" selected>Фіксований</option>
        <option value="percentage">Відсотковий</option>
    `;
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.className = 'kpi-input col-span-3 kpi-bonus-value'; 
    valueInput.step = '1'; 
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-item-btn text-red-500 col-span-1';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => e.target.closest('.grid').remove();
    const updateValueInput = () => {
        if (typeSelect.value === 'fixed') {
            valueInput.placeholder = 'Сума за од.';
            valueInput.step = '1';
        } else {
            valueInput.placeholder = 'Відсоток (%)';
            valueInput.step = '0.01';
        }
    };
    typeSelect.addEventListener('change', updateValueInput);
    updateValueInput();
    div.appendChild(idInput);
    div.appendChild(nameInput);
    div.appendChild(typeSelect);
    div.appendChild(valueInput);
    div.appendChild(deleteBtn);
    elements.bonusesContainer.appendChild(div);
}
export function updateSalaryPageUI(year, month, kpiTemplateSettings, kpiActualsData, permissions = {}) {
    elements.kpiCurrentMonthSalaryDisplay.textContent = new Date(year, month).toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    elements.kpiSalaryDetails.classList.remove('hidden');
    elements.calculatedTotalSalary.textContent = '0.00'; 

    const canLoad = permissions.kpiIndividual_load_actuals === true;
    const canCalculate = permissions.kpiIndividual_calculate === true;
    const canSave = permissions.kpiIndividual_save_actuals === true;

    setElementEnabled(elements.loadKpiActualsBtn, canLoad);
    setElementEnabled(elements.calculateSalaryBtn, canCalculate);
    setElementEnabled(elements.saveKpiActualsBtn, canSave);

    if (!kpiTemplateSettings) {
        elements.kpiSalaryDetails.classList.add('hidden');
        elements.loadKpiActualsBtn.textContent = 'Налаштування KPI відсутні';
        elements.loadKpiActualsBtn.disabled = true;
        return;
    } else {
        elements.loadKpiActualsBtn.textContent = 'Завантажити збережені KPI дані';
         elements.loadKpiActualsBtn.disabled = !canLoad;
    }

    const isEditable = canCalculate || canSave; // Якщо може розраховувати або зберігати, поля мають бути доступні

    elements.kpiSalaryBaseSalary.value = kpiTemplateSettings.baseSalary || 0;
    elements.kpiSalaryPremiumBase.value = kpiTemplateSettings.premiumBase || 0;
    elements.kpiSalaryTaxes.value = kpiActualsData?.taxes || kpiTemplateSettings.taxes || 0;
    elements.kpiSalaryTaxes.disabled = !isEditable;
    elements.kpiSalaryFocusTasks.value = kpiActualsData?.focusTasksCount || '';
    elements.kpiSalaryFocusTasks.disabled = !isEditable;

    elements.kpiSalaryCategoriesContainer.innerHTML = '<h5 class="font-semibold mt-4">Виконання KPI</h5>';
    kpiTemplateSettings.categories.forEach((cat) => {
        if (!cat.id) cat.id = generateUniqueId();
        const actualCategoryData = kpiActualsData?.kpiCategories?.find(ac => ac.id === cat.id || ac.name === cat.name);
        const planAmount = actualCategoryData?.planAmount || 0;
        const factAmount = actualCategoryData?.factAmount || 0;
        const div = document.createElement('div');
        div.className = 'flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2 bg-gray-700 p-2 rounded-md';
        div.innerHTML = `
            <label class="block text-sm w-full sm:w-1/3 text-gray-300 text-left">${cat.name} (Вага: ${cat.weight}%)</label>
            <div class="flex flex-grow w-full sm:w-auto items-center gap-2">
                <input type="number" class="kpi-input w-1/2 kpi-salary-category-plan-input" placeholder="План" data-kpi-id="${cat.id}" data-weight="${cat.weight || 0}" value="${planAmount}" step="1" ${isEditable ? '' : 'disabled'}>
                <span class="text-sm text-gray-400">План</span>
            </div>
            <div class="flex flex-grow w-full sm:w-auto items-center gap-2">
                <input type="number" class="kpi-input w-1/2 kpi-salary-category-fact-input" placeholder="Факт" data-kpi-id="${cat.id}" value="${factAmount}" step="1" ${isEditable ? '' : 'disabled'}>
                <span class="text-sm text-gray-400">Факт</span>
            </div>
        `;
        elements.kpiSalaryCategoriesContainer.appendChild(div);
    });
    elements.kpiSalaryBonusesContainer.innerHTML = '<h5 class="font-semibold mt-4">Додаткові бонуси</h5>';
    if (kpiTemplateSettings.bonuses.length === 0) {
        elements.kpiSalaryBonusesContainer.innerHTML += '<p class="text-sm text-gray-400">Бонуси не налаштовані.</p>';
    } else {
        kpiTemplateSettings.bonuses.forEach((bonusTemplate) => {
            if (!bonusTemplate.id) bonusTemplate.id = generateUniqueId();
            const actualBonusData = kpiActualsData?.bonusesActual?.find(ab => ab.id === bonusTemplate.id || ab.name === bonusTemplate.name);
            const actualInputValue = actualBonusData?.inputValue || (bonusTemplate.type === 'fixed' ? 1 : ''); 
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 mb-2';
            const labelText = bonusTemplate.type === 'fixed' 
                ? `${bonusTemplate.name} (Фікс. ${bonusTemplate.value} грн/од.)`
                : `${bonusTemplate.name} (${bonusTemplate.value}%)`;
            const inputPlaceholder = bonusTemplate.type === 'fixed' ? 'Кількість' : 'База для %';
            div.innerHTML = `
                <label class="block text-sm w-3/5 text-gray-300 text-left">${labelText}</label>
                <input type="number" class="kpi-input flex-grow kpi-salary-bonus-input" 
                       placeholder="${inputPlaceholder}" 
                       data-bonus-id="${bonusTemplate.id}" 
                       data-bonus-type="${bonusTemplate.type}"
                       data-bonus-template-value="${bonusTemplate.value}"
                       value="${actualInputValue}" step="${bonusTemplate.type === 'percentage' ? '0.01' : '1'}" ${isEditable ? '' : 'disabled'}>
            `;
            elements.kpiSalaryBonusesContainer.appendChild(div);
        });
    }
}
export function getKpiActualsFromUI() {
    const kpiCategoriesActuals = Array.from(elements.kpiSalaryCategoriesContainer.querySelectorAll('.kpi-salary-category-plan-input')).map((planInput, index) => {
        const factInput = elements.kpiSalaryCategoriesContainer.querySelectorAll('.kpi-salary-category-fact-input')[index];
        return {
            id: planInput.dataset.kpiId,
            planAmount: parseFloat(planInput.value) || 0,
            factAmount: parseFloat(factInput.value) || 0,
            weight: parseFloat(planInput.dataset.weight) || 0
        };
    });
    const bonusesActuals = Array.from(elements.kpiSalaryBonusesContainer.querySelectorAll('.kpi-salary-bonus-input')).map(input => {
        return {
            id: input.dataset.bonusId,
            type: input.dataset.bonusType, 
            templateValue: parseFloat(input.dataset.bonusTemplateValue) || 0, 
            inputValue: parseFloat(input.value) || 0 
        };
    });
    const focusTasksCount = parseFloat(elements.kpiSalaryFocusTasks.value) || 0;
    const taxes = parseFloat(elements.kpiSalaryTaxes.value) || 0;
    return { kpiCategories: kpiCategoriesActuals, focusTasksCount: focusTasksCount, bonusesActual: bonusesActuals, taxes: taxes };
}
export function setCalculatedSalary(amount) { elements.calculatedTotalSalary.textContent = amount.toFixed(2); }
export function animateCount(element, endValue) {
    const duration = 1000; 
    const startValue = parseFloat(element.textContent.replace(/\s/g, '')) || 0;
    let startTime = null;
    function animationStep(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (endValue - startValue) * easedProgress;
        element.textContent = currentValue.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (progress < 1) { requestAnimationFrame(animationStep); }
    }
    requestAnimationFrame(animationStep);
}
function createCell(content, className = '') {
    const td = document.createElement('td');
    td.className = `p-1 ${className}`;
    if (typeof content === 'string') { td.innerHTML = content; } 
    else if (content instanceof Node) { td.appendChild(content); } 
    else { td.textContent = String(content); }
    return td;
}
export function renderMassSalaryTable(viewData, snapshotData = null, permissions = {}) {
    const container = elements.massSalaryTableContainer;
    container.innerHTML = '';

    const canEditInputs = permissions.massSalary_generate_table === true || permissions.massSalary_calculate_all === true || permissions.massSalary_save_snapshot === true;

    viewData.forEach(({ positionName, kpiTemplate, employees }) => {
        const positionWrapper = document.createElement('div');
        positionWrapper.className = 'mb-8';
        positionWrapper.innerHTML = `<h3 class="text-xl font-bold text-white mb-3">Посада: ${positionName}</h3>`;
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        const table = document.createElement('table');
        table.className = 'w-full text-sm text-left';
        table.dataset.positionId = kpiTemplate.positionId;
        const thead = document.createElement('thead');
        const headerRow1 = document.createElement('tr');
        const headerRow2 = document.createElement('tr');
        const employeeTh = document.createElement('th');
        employeeTh.rowSpan = 2;
        employeeTh.className = 'header-name py-2 px-2';
        employeeTh.textContent = 'Співробітник';
        headerRow1.appendChild(employeeTh);
        // --- KPI групи ---
        kpiTemplate.categories.forEach((cat, idx) => {
            const kpiGroupTh = document.createElement('th');
            kpiGroupTh.colSpan = 2;
            kpiGroupTh.className = 'kpi-group text-center py-2 px-2 border-l border-r border-gray-700';
            kpiGroupTh.textContent = cat.name;
            headerRow1.appendChild(kpiGroupTh);
            // Підзаголовки
            const planTh = document.createElement('th');
            planTh.className = 'kpi-sub text-center py-2 px-2';
            planTh.textContent = 'План';
            headerRow2.appendChild(planTh);
            const factTh = document.createElement('th');
            factTh.className = 'kpi-sub text-center py-2 px-2';
            factTh.textContent = 'Факт';
            headerRow2.appendChild(factTh);
        });
        // --- Бонуси групи ---
        if (kpiTemplate.bonuses.length > 0) {
            kpiTemplate.bonuses.forEach((bonus, idx) => {
                const bonusGroupTh = document.createElement('th');
                bonusGroupTh.rowSpan = 1;
                bonusGroupTh.colSpan = 1;
                bonusGroupTh.className = 'bonus-group text-center py-2 px-2 border-l border-r border-gray-700';
                bonusGroupTh.textContent = bonus.name;
                headerRow1.appendChild(bonusGroupTh);
                // Підзаголовок
                const bonusSubTh = document.createElement('th');
                bonusSubTh.className = 'bonus-sub text-center py-2 px-2';
                bonusSubTh.textContent = bonus.type === 'fixed' ? 'К-сть' : 'База %';
                headerRow2.appendChild(bonusSubTh);
            });
        }
        // --- Фокусні задачі --- (переносим после бонусов)
        const focusSuperTh = document.createElement('th');
        focusSuperTh.rowSpan = 2;
        focusSuperTh.className = 'kpi-group text-center py-2 px-2 border-l border-r border-gray-700';
        focusSuperTh.textContent = 'Фокусні задачі';
        headerRow1.appendChild(focusSuperTh);
        // --- Розрахунок ---
        const calcSuperTh = document.createElement('th');
        calcSuperTh.colSpan = 3;
        calcSuperTh.rowSpan = 1;
        calcSuperTh.className = 'calc-group text-center py-2 px-2 border-l border-r border-gray-700';
        calcSuperTh.textContent = 'Розрахунок';
        headerRow1.appendChild(calcSuperTh);
        // Підзаголовки для розрахунку
        ['Ставка', 'Премія', 'Сума'].forEach(label => {
            const th = document.createElement('th');
            th.className = 'calc-sub text-center py-2 px-2';
            th.textContent = label;
            headerRow2.appendChild(th);
        });
        thead.appendChild(headerRow1);
        thead.appendChild(headerRow2);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        employees.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(emp => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-700/50';
            row.dataset.employeeId = emp.id;
            const savedEmpData = snapshotData?.employees.find(e => e.employeeId === emp.id);
            row.innerHTML = `<td class="py-2 px-2 font-medium text-white flex items-center gap-2">${emp.name}
                <button class="toggle-bonus-row bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-green-600" title="Додати премію/депремію" tabindex="-1">+</button>
            </td>`;
            kpiTemplate.categories.forEach((cat, index) => {
                const planValue = savedEmpData?.inputs[cat.id]?.plan ?? '';
                const factValue = savedEmpData?.inputs[cat.id]?.fact ?? '';
                const planClass = index === 0 ? 'mass-salary-group-border-left' : '';
                row.innerHTML += `<td class="${planClass}"><input type="number" class="mass-kpi-input" data-kpi-id="${cat.id}" data-type="plan" placeholder="План" value="${planValue}" ${canEditInputs ? '' : 'disabled'}></td><td><input type="number" class="mass-kpi-input" data-kpi-id="${cat.id}" data-type="fact" placeholder="Факт" value="${factValue}" ${canEditInputs ? '' : 'disabled'}></td>`;
            });
            kpiTemplate.bonuses.forEach((bonusTemplate, index) => {
                const savedBonusValue = savedEmpData?.inputs[bonusTemplate.id] ?? '';
                const placeholderText = bonusTemplate.type === 'fixed' ? 'К-сть' : 'База %';
                const bonusClass = index === 0 ? 'mass-salary-group-border-left' : '';
                row.innerHTML += `<td class="${bonusClass}"><input type="number" class="mass-kpi-input" data-bonus-id="${bonusTemplate.id}" data-bonus-type="${bonusTemplate.type}" data-bonus-template-value="${bonusTemplate.value}" placeholder="${placeholderText}" value="${savedBonusValue}" ${canEditInputs ? '' : 'disabled'}></td>`;
            });
            // --- Фокусні задачі --- (после бонусов)
            const focusTasksValue = savedEmpData?.inputs.focus ?? '';
            row.innerHTML += `<td class="mass-salary-group-border-left"><input type="number" class="mass-kpi-input" data-type="focus" placeholder="К-сть" value="${focusTasksValue}" ${canEditInputs ? '' : 'disabled'}></td>`;
            const baseSalaryValue = savedEmpData?.results.base ?? kpiTemplate.baseSalary ?? 0;
            const premiumValue = savedEmpData?.results.premium ?? '0.00';
            const totalValue = savedEmpData?.results.total ?? '0.00';
            row.innerHTML += `<td class="py-2 px-2 text-center result-cell" data-result="base">${baseSalaryValue}</td><td class="py-2 px-2 text-center result-cell" data-result="premium">${premiumValue} <button class="show-premium-details" title="Деталі" data-employee-id="${emp.id}">ℹ️</button></td><td class="py-2 px-2 text-center result-cell font-bold text-green-400" data-result="total">${totalValue}</td>`;
            tbody.appendChild(row);

            // --- Додаємо прихований підрядок для премії/депремії ---
            const bonusRow = document.createElement('tr');
            bonusRow.className = 'bonus-row hidden';
            bonusRow.dataset.employeeId = emp.id;
            bonusRow.innerHTML = `<td colspan="${2 * kpiTemplate.categories.length + kpiTemplate.bonuses.length + 5}" class="bg-gray-800 px-4 py-2">
                <div class="flex flex-wrap gap-4 items-center">
                    <label class="flex items-center gap-2 text-sm">Премія: <input type="number" class="mass-kpi-input mass-bonus-input" data-type="custom-bonus" placeholder="0.00" value="${savedEmpData?.inputs?.customBonus ?? ''}" ${canEditInputs ? '' : 'disabled'}></label>
                    <label class="flex items-center gap-2 text-sm">Депремія: <input type="number" class="mass-kpi-input mass-bonus-input" data-type="custom-penalty" placeholder="0.00" value="${savedEmpData?.inputs?.customPenalty ?? ''}" ${canEditInputs ? '' : 'disabled'}></label>
                    <span class="text-xs text-gray-400">(Премія додається, депремія віднімається із суми)</span>
                </div>
            </td>`;
            tbody.appendChild(bonusRow);
        });

        // --- Додаємо обробник для кнопки '+' ---
        tbody.querySelectorAll('.toggle-bonus-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = btn.closest('tr');
                const empId = tr.dataset.employeeId;
                const bonusRow = tbody.querySelector(`.bonus-row[data-employee-id="${empId}"]`);
                if (bonusRow) {
                    bonusRow.classList.toggle('hidden');
                }
            });
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);
        positionWrapper.appendChild(tableContainer);
        container.appendChild(positionWrapper);
    });
    // --- Модалка для расшифровки ---
    if (!document.getElementById('premiumBreakdownModal')) {
        const modal = document.createElement('div');
        modal.id = 'premiumBreakdownModal';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.zIndex = '9999';
        modal.innerHTML = `<div style="background:#232b3a;color:#fff;max-width:480px;margin:10vh auto;padding:2em 1.5em 1.5em 1.5em;border-radius:12px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.25);border:1px solid #374151;">
            <button id="closePremiumBreakdownModal" style="position:absolute;top:0.5em;right:0.5em;font-size:2em;background:none;border:none;color:#aaa;cursor:pointer;">&times;</button>
            <div id="premiumBreakdownContent"></div>
        </div>`;
        document.body.appendChild(modal);
        document.getElementById('closePremiumBreakdownModal').onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
    container.querySelectorAll('.show-premium-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const employeeId = btn.dataset.employeeId;
            const breakdown = window.massSalaryBreakdownByEmployeeId?.[employeeId];
            const content = document.getElementById('premiumBreakdownContent');
            if (!breakdown) {
                content.innerHTML = '<div>Деталі не знайдено.</div>';
            } else {
                content.innerHTML = `
                <h3 style="font-size:1.2em;margin-bottom:0.5em;">Деталі розрахунку для <b>${breakdown.name}</b></h3>
                <div><b>Ставка:</b> ${breakdown.baseSalary}</div>
                <div><b>База для премії:</b> ${breakdown.premiumBase}</div>
                <div><b>Виконання KPI:</b> ${(breakdown.totalWeightedAchievement*100).toFixed(1)}%</div>
                <div><b>KPI премія:</b> ${breakdown.kpiPremium.toFixed(2)}</div>
                <div><b>Коеф. фокусних задач:</b> ${breakdown.focusCoefficient}</div>
                <div><b>Бонуси:</b><ul style='margin:0 0 0 1em;padding:0;'>${breakdown.calculatedBonuses.map(b=>`<li>${b.name}: ${b.calculated.toFixed(2)}</li>`).join('')}</ul></div>
                <div><b>Норма днів:</b> ${breakdown.normForMonth}, <b>Відпрацьовано:</b> ${breakdown.actualDaysWorked}</div>
                <div><b>Ставка (факт):</b> ${breakdown.baseFact.toFixed(2)}</div>
                <div><b>Премія (факт):</b> ${breakdown.premiumFact.toFixed(2)}</div>
                <div><b>Податки:</b> ${breakdown.taxes}</div>
                <div style='margin-top:0.5em;'><b>Сума до виплати:</b> <span style='color:#4ade80;font-weight:bold;'>${breakdown.finalSalary.toFixed(2)}</span></div>
                <hr style='margin:0.7em 0;'>
                <div style='font-size:0.95em;color:#aaa;'>Формула: <br>Ставка (факт) + Премія (факт) - Податки</div>
                `;
            }
            document.getElementById('premiumBreakdownModal').style.display = 'block';
        });
    });
}
function createActionCell(employee, isArchived, handlers, permissions = {}, department) {
    const actionCell = document.createElement('td');
    actionCell.className = 'action-cell p-2'; 

    if (permissions.timesheet_fill_schedule) {
        const fillBtn = createActionBtn('fill', `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`, () => handlers.onFillSchedule(employee));
        fillBtn.title = "Заповнити табель за місяць згідно графіку відділу";
        if (!department?.scheduleId) { // Перевірка наявності scheduleId у відділу
            fillBtn.disabled = true;
            fillBtn.title = "Для відділу не призначено графік";
        }
        actionCell.appendChild(fillBtn);
    }

    if (permissions.timesheet_archive_employees) {
        const archiveBtn = createActionBtn(isArchived ? 'restore' : 'archive', isArchived ? '&#x21BA;' : '&#x2716;', () => handlers.onToggleArchive(employee.id, employee.name, isArchived));
        archiveBtn.title = isArchived ? "Розархівувати" : "Архівувати";
        actionCell.appendChild(archiveBtn);
    }
    
    if (actionCell.children.length === 0 && (permissions.timesheet_fill_schedule === undefined || permissions.timesheet_archive_employees === undefined)) {
        // Якщо дозволи ще не завантажені, показуємо заглушку або нічого
    } else if (actionCell.children.length === 0) {
        actionCell.innerHTML = `<span class="text-xs text-gray-500">-</span>`;
    }

    return actionCell;
}
function createActionBtn(type, html, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button'; 
    btn.className = `action-btn ${type}`; 
    btn.innerHTML = html;
    btn.onclick = onClick;
    return btn;
}
function createEmployeeFlipCard(employee, position, managerName, handlers, daysWorked, canManageEmployees = false) {
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'flip-card';
    const cardInner = document.createElement('div');
    cardInner.className = 'flip-card-inner';
    const cardFront = document.createElement('div');
    cardFront.className = 'flip-card-front';
    const avatarSrc = employee.avatarUrl || 'https://placehold.co/80x80/1f2937/ffffff?text=AV'; 
    cardFront.innerHTML = `<img src="${avatarSrc}" alt="Avatar" class="w-20 h-20 rounded-full mb-4 object-cover border-2 border-gray-600"><h3 class="text-xl font-bold">${employee.name}</h3><p class="text-gray-400 text-sm mt-1">Наведіть для деталей</p>`;
    
    const cardBack = document.createElement('div');
    cardBack.className = 'flip-card-back';
    let actionsHtml = '';
    if (canManageEmployees) {
        actionsHtml = `<div class="flip-card-back-actions flex gap-3 mt-4"><button type="button" class="action-btn edit-btn" title="Редагувати">✎</button><button type="button" class="action-btn delete-btn" title="Видалити">×</button></div>`;
    }

    cardBack.innerHTML = `<h3 class="text-xl font-bold">${position?.name || 'Без посади'}</h3>
                          <p class="mt-2 text-sm">Відділ: ${employee.departmentName || 'Не вказано'}</p>
                          <p class="text-sm">Керівник: <span class="font-semibold">${managerName || 'Немає'}</span></p>
                          <p class="text-sm">Відпрацьовано днів (факт): <span class="font-bold">${daysWorked}</span></p>
                          ${actionsHtml}`;
    
    if (canManageEmployees) {
        cardBack.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); handlers.onEdit(employee); };
        cardBack.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); handlers.onDelete(employee); };
    }
    
    cardInner.appendChild(cardFront);
    cardInner.appendChild(cardBack);
    cardWrapper.appendChild(cardInner);
    return cardWrapper;
}
function createBasicManagerCard(title, subtitle, onEditHandler, onDeleteHandler, canManage = false) {
    const card = document.createElement('div');
    card.className = 'manager-card'; 
    let subtitleHtml = '';
    if (subtitle) { subtitleHtml = `<p class="text-sm text-gray-400">${subtitle}</p>`; }
    
    let actionsHtml = '';
    if (canManage) {
        actionsHtml = `<div class="manager-card-actions"><button type="button" class="action-btn edit" title="Редагувати">✎</button><button type="button" class="action-btn delete" title="Видалити">&times;</button></div>`;
    }

    card.innerHTML = `<div><h4 class="font-semibold text-white">${title}</h4>${subtitleHtml}</div>${actionsHtml}`;
    
    if (canManage) {
        card.querySelector('.edit').onclick = (event) => { event.stopPropagation(); onEditHandler(); };
        card.querySelector('.delete').onclick = (event) => { event.stopPropagation(); onDeleteHandler(); };
        card.style.cursor = 'default'; // Якщо є кнопки, сама картка не клікабельна для редагування
    } else {
        card.style.cursor = 'default';
    }
    return card;
}


export function renderReportDepartmentFilter(departments, selectedValue = 'all') {
    if (!elements.reportDepartmentFilter) return;
    elements.reportDepartmentFilter.innerHTML = '<option value="all">Всі відділи</option>';
    departments.sort((a,b) => a.name.localeCompare(b.name, 'uk')).forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id; 
        option.textContent = dept.name;
        elements.reportDepartmentFilter.appendChild(option);
    });
    elements.reportDepartmentFilter.value = selectedValue;
}
export function renderMonthlyDynamicsReport(reportDataArray) {
    if (!elements.salaryDynamicsChartCtx || !elements.salesDynamicsChartCtx || !elements.detailsTableBody) {
        console.warn("Елементи для звіту 'Динаміка по місяцях' не знайдені.");
        return;
    }
    const formatCurrency = (value) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }).format(value);
    elements.detailsTableBody.innerHTML = reportDataArray.map(d => {
        const ratio = d.totalSales > 0 ? (d.totalSalary / d.totalSales) : 0;
        return `<tr class="hover:bg-gray-600/50"><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">${d.monthName}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">${formatCurrency(d.totalSalary)}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">${formatCurrency(d.totalSales)}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-bold ${ratio > 0.2 ? 'text-yellow-400' : 'text-green-400'} text-right">${(ratio * 100).toFixed(1)}%</td></tr>`;
    }).join('');
    Chart.defaults.color = '#d1d5db'; 
    const commonChartOptions = {
        responsive: true, maintainAspectRatio: false,
        scales: { 
            y: { beginAtZero: true, ticks: { callback: value => value / 1000 + ' тис.', color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.5)', borderColor: '#4b5563' } },
            x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.5)' } }
        },
        plugins: { legend: { display: false, labels: { color: '#d1d5db' } }, tooltip: { backgroundColor: 'rgba(31, 41, 55, 0.9)', titleColor: '#e5e7eb', bodyColor: '#d1d5db', callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } } },
        animation: { duration: 1000, easing: 'easeOutQuart' }
    };
    if (salaryDynamicsChartInstance) salaryDynamicsChartInstance.destroy();
    salaryDynamicsChartInstance = new Chart(elements.salaryDynamicsChartCtx, {
        type: 'line',
        data: { labels: reportDataArray.map(d => d.monthName), datasets: [{ label: 'ФОП', data: reportDataArray.map(d => d.totalSalary), borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.2)', fill: true, tension: 0.4 }] },
        options: commonChartOptions
    });
    if (salesDynamicsChartInstance) salesDynamicsChartInstance.destroy();
    salesDynamicsChartInstance = new Chart(elements.salesDynamicsChartCtx, {
        type: 'line',
        data: { labels: reportDataArray.map(d => d.monthName), datasets: [{ label: 'Продажі (демо)', data: reportDataArray.map(d => d.totalSales), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.2)', fill: true, tension: 0.4 }] },
        options: commonChartOptions
    });
}

// === ФУНКЦІЇ ДЛЯ МОДУЛЯ ВІДПУСТОК ===

export function renderVacationsPageUI(myRequests, managedRequests, permissions, handlers) {
    const myRequestsList = elements.myVacationRequestsList;
    const manageRequestsList = elements.manageVacationRequestsList;
    
    // Вкладка "Керування" видима, якщо є відповідні права
    const canManage = permissions.vacations_view_all || permissions.vacations_view_department;
    elements.vacationTabManageRequests.classList.toggle('hidden', !canManage);

    myRequestsList.innerHTML = '';
    if (myRequests.length > 0) {
        myRequests.forEach(req => {
            myRequestsList.appendChild(createVacationRequestCard(req, 'self', handlers));
        });
    } else {
        myRequestsList.innerHTML = '<p class="text-gray-400">У вас ще немає заявок на відпустку.</p>';
    }

    manageRequestsList.innerHTML = '';
    if (canManage) {
        if (managedRequests.length > 0) {
            managedRequests.forEach(req => {
                manageRequestsList.appendChild(createVacationRequestCard(req, 'manage', handlers));
            });
        } else {
            manageRequestsList.innerHTML = '<p class="text-gray-400">Немає запитів, що потребують розгляду.</p>';
        }
    }

    // Ініціалізація табів
    initReportTabs(); // Можна використовувати ту ж функцію для табів
}

function createVacationRequestCard(request, viewType, handlers) {
    const card = document.createElement('div');

    card.className = `p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${statusClasses[request.status] || 'bg-gray-700'}`;
    
    const formatDate = (date) => date.toLocaleDateString('uk-UA');

    let infoHtml = `
        <div>
            <p class="font-bold text-white">${request.employeeName}</p>
            <p class="text-sm text-gray-300">${formatDate(request.startDate)} - ${formatDate(request.endDate)}</p>
            <p class="text-xs text-gray-400 mt-1">Відділ: ${request.departmentName}</p>
        </div>
        <div class="text-sm font-semibold text-center">${statusTexts[request.status]}</div>
    `;

    let actionsHtml = '<div class="flex gap-2">';
    if (viewType === 'manage' && request.status === 'pending') {
        actionsHtml += `<button class="action-btn-sm approve" data-id="${request.id}">Погодити</button>`;
        actionsHtml += `<button class="action-btn-sm deny" data-id="${request.id}">Відхилити</button>`;
    }
    if (viewType === 'self' && request.status === 'pending') {
        actionsHtml += `<button class="action-btn-sm cancel" data-id="${request.id}">Скасувати</button>`;
    }
    actionsHtml += '</div>';

    card.innerHTML = infoHtml + actionsHtml;

    card.querySelector('.approve')?.addEventListener('click', () => handlers.onApprove(request.id));
    card.querySelector('.deny')?.addEventListener('click', () => handlers.onDeny(request.id));
    card.querySelector('.cancel')?.addEventListener('click', () => handlers.onCancel(request.id));

    return card;
}

export function setupVacationRequestModal(mode, requestData, employeeData, permissions, handlers = {}) {
    const modal = elements.vacationRequestModal;
    modal.querySelector('#vacationRequestModalTitle').textContent = mode === 'create' ? 'Створити запит на відпустку' : 'Перегляд заявки';

    // Встановлюємо поля readonly для режиму перегляду
    const isViewMode = mode === 'view';
    modal.querySelector('#vacReqEmployeeName').readOnly = isViewMode;
    modal.querySelector('#vacReqDepartmentName').readOnly = isViewMode;
    modal.querySelector('#vacReqStartDate').readOnly = isViewMode;
    modal.querySelector('#vacReqEndDate').readOnly = isViewMode;
    modal.querySelector('#vacReqComment').readOnly = isViewMode;

    // Получаем название отдела по ID
    let departmentDisplay = '';
    if (employeeData?.department) {
        const deptObj = window.state?.departments?.find(d => d.id === employeeData.department || d.name === employeeData.department);
        departmentDisplay = deptObj ? deptObj.name : employeeData.department;
    } else if (requestData?.departmentId) {
        const deptObj = window.state?.departments?.find(d => d.id === requestData.departmentId);
        departmentDisplay = deptObj ? deptObj.name : requestData.departmentId;
    } else if (requestData?.departmentName) {
        departmentDisplay = requestData.departmentName;
    }

    // Заповнення полів
    modal.querySelector('#vacReqEmployeeName').value = employeeData?.name || '';
    modal.querySelector('#vacReqDepartmentName').value = departmentDisplay || '';
    modal.querySelector('#vacReqStartDate').valueAsDate = requestData?.startDate || new Date();
    modal.querySelector('#vacReqEndDate').valueAsDate = requestData?.endDate || new Date();
    modal.querySelector('#vacReqComment').value = requestData?.comment || '';
    modal.querySelector('#vacReqStatusText').textContent = requestData?.status ? statusTexts[requestData.status] : '';
    modal.querySelector('#vacReqDecisionCommentText').textContent = requestData?.decisionComment || 'Немає';

    // Керування кнопками
    const submitBtn = modal.querySelector('#submitVacationRequestBtn');
    const approveBtn = modal.querySelector('#approveVacationRequestBtn');
    const denyBtn = modal.querySelector('#denyVacationRequestBtn');

    submitBtn.classList.toggle('hidden', mode !== 'create');
    approveBtn.classList.toggle('hidden', !(mode === 'view' && requestData?.status === 'pending' && permissions.vacations_manage_requests));
    denyBtn.classList.toggle('hidden', !(mode === 'view' && requestData?.status === 'pending' && permissions.vacations_manage_requests));

    // Навешиваем обработчики напрямую через handlers
    if (approveBtn) {
        approveBtn.onclick = null;
        if (mode === 'view' && requestData?.status === 'pending' && permissions.vacations_manage_requests && typeof handlers.onApprove === 'function') {
            approveBtn.onclick = () => handlers.onApprove(requestData.id);
        }
    }
    if (denyBtn) {
        denyBtn.onclick = null;
        if (mode === 'view' && requestData?.status === 'pending' && permissions.vacations_manage_requests && typeof handlers.onDeny === 'function') {
            denyBtn.onclick = () => handlers.onDeny(requestData.id);
        }
    }

    // Відображення інформації про статус та коментар рішення
    modal.querySelector('#vacReqStatusInfo').classList.toggle('hidden', !isViewMode);
    modal.querySelector('#vacReqDecisionCommentInfo').classList.toggle('hidden', !isViewMode || !requestData?.decisionComment);
}


// Функції для керування ролями
export function renderRolesList(roles, onSelectRole, permissions = {}) {
    elements.rolesList.innerHTML = '';
    if (!permissions.settings_roles_manage) {
        elements.rolesList.innerHTML = '<p class="text-sm text-gray-400">У вас немає дозволу на перегляд ролей.</p>';
        setElementEnabled(elements.addNewRoleBtn, false);
        return;
    }
    setElementEnabled(elements.addNewRoleBtn, true);

    if (roles.length === 0) {
        elements.rolesList.innerHTML = '<p class="text-sm text-gray-400">Ролі не створено.</p>';
        return;
    }
    roles.forEach(role => {
        const div = document.createElement('div');
        div.className = 'p-2 hover:bg-gray-700 rounded-md cursor-pointer text-white';
        div.textContent = role.name;
        div.onclick = () => onSelectRole(role.id);
        elements.rolesList.appendChild(div);
    });
}

export function renderRoleEditor(role, permissions = {}) {
    if (!permissions.settings_roles_manage) {
        elements.roleEditor.classList.add('hidden');
        return;
    }
    elements.roleEditor.classList.remove('hidden');
    elements.editingRoleName.textContent = role.name;
    elements.roleNameInput.value = role.name;
    elements.roleNameInput.disabled = !permissions.settings_roles_manage;

    elements.permissionsList.innerHTML = '';
    ALL_POSSIBLE_PERMISSIONS.forEach(permDef => {
        const permDiv = document.createElement('div');
        permDiv.className = 'flex items-center justify-between py-1';
        const label = document.createElement('label');
        label.htmlFor = `perm_${permDef.id}`;
        label.textContent = permDef.label;
        label.className = 'text-sm text-gray-300';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `perm_${permDef.id}`;
        checkbox.className = 'h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500';
        checkbox.checked = role.permissions?.[permDef.id] === true;
        checkbox.disabled = !permissions.settings_roles_manage;
        
        permDiv.appendChild(label);
        permDiv.appendChild(checkbox);
        elements.permissionsList.appendChild(permDiv);
    });
    setElementEnabled(elements.saveRoleBtn, permissions.settings_roles_manage);
    setElementEnabled(elements.deleteRoleBtn, permissions.settings_roles_manage && role.name !== 'Owner' && role.name !== 'Admin'); // Заборона видалення базових ролей
}

export function getPermissionsFromUI() {
    const permissions = {};
    ALL_POSSIBLE_PERMISSIONS.forEach(permDef => {
        const checkbox = document.getElementById(`perm_${permDef.id}`);
        if (checkbox) { // Перевірка існування чекбоксу
            permissions[permDef.id] = checkbox.checked;
        }
    });
    return permissions;
}

export function renderNewUserRoleSelect(availableRoles, selectElementId = 'newUserRole') {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = ''; // Очистити попередні опції
    availableRoles.forEach(role => {
        if (role.name.toLowerCase() === 'owner') return; // Власника не можна призначити через запрошення/додавання
        const option = document.createElement('option');
        option.value = role.id; // Зберігаємо ID ролі
        option.textContent = role.name;
        select.appendChild(option);
    });
    if (select.options.length === 0) {
        select.innerHTML = '<option value="">Немає доступних ролей</option>';
        select.disabled = true;
    } else {
        select.disabled = false;
    }
}

export function renderUnlinkedEmployeesSelect(allEmployees, members, selectElementId = 'linkEmployeeSelect') {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) return;
    
    const linkedEmployeeIds = new Set(members.map(m => m.employeeId).filter(Boolean));
    const unlinkedEmployees = allEmployees.filter(emp => !linkedEmployeeIds.has(emp.id));
    
    selectElement.innerHTML = '<option value="">Не прив\'язувати</option>';
    unlinkedEmployees.sort((a, b) => a.name.localeCompare(b.name, 'uk')).forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.name;
        selectElement.appendChild(option);
    });
}

export function renderCopyPermissionsUserSelect(members, currentUserId) {
    const selectElement = elements.copyPermissionsUserSelect;
    if (!selectElement) return;
    
    // Фільтруємо користувачів, виключаючи власників (оскільки ми копіюємо права ДЛЯ власника)
    const eligibleUsers = members.filter(member => 
        member.role !== 'owner'
    );
    
    selectElement.innerHTML = '<option value="">-- Оберіть користувача --</option>';
    eligibleUsers.sort((a, b) => a.email.localeCompare(b.email)).forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.email;
        selectElement.appendChild(option);
    });
    
    // Оновлюємо стан кнопки
    elements.copyOwnerPermissionsBtn.disabled = eligibleUsers.length === 0;
}

export function renderSelectedUserPermissions(selectedUser, allPossiblePermissions) {
    const infoContainer = elements.selectedUserPermissionsInfo;
    const permissionsList = elements.selectedUserPermissionsList;
    
    if (!selectedUser || !infoContainer || !permissionsList) return;
    
    const userPermissions = selectedUser.permissions || {};
    const userRole = selectedUser.roleId ? 
        (allPossiblePermissions.find(r => r.id === selectedUser.roleId)?.name || 'Невідома роль') : 
        'Без ролі';
    
    // Показуємо інформацію про користувача
    infoContainer.classList.remove('hidden');
    
    // Формуємо список активних прав
    let permissionsHtml = `<div class="mb-2"><strong>Роль:</strong> ${userRole}</div>`;
    permissionsHtml += '<div><strong>Активні права:</strong></div>';
    
    const activePermissions = [];
    const inactivePermissions = [];
    
    allPossiblePermissions.forEach(perm => {
        if (userPermissions[perm.id]) {
            activePermissions.push(perm.label);
        } else {
            inactivePermissions.push(perm.label);
        }
    });
    
    if (activePermissions.length > 0) {
        permissionsHtml += '<div class="text-green-400 mt-1">';
        activePermissions.forEach(perm => {
            permissionsHtml += `• ${perm}<br>`;
        });
        permissionsHtml += '</div>';
    } else {
        permissionsHtml += '<div class="text-gray-500 mt-1">Немає активних прав</div>';
    }
    
    if (inactivePermissions.length > 0) {
        permissionsHtml += '<div class="text-gray-600 mt-2"><strong>Неактивні права:</strong></div>';
        permissionsHtml += '<div class="text-gray-500">';
        inactivePermissions.slice(0, 5).forEach(perm => { // Показуємо тільки перші 5
            permissionsHtml += `• ${perm}<br>`;
        });
        if (inactivePermissions.length > 5) {
            permissionsHtml += `... та ще ${inactivePermissions.length - 5} прав`;
        }
        permissionsHtml += '</div>';
    }
    
    permissionsList.innerHTML = permissionsHtml;
}

// Допоміжна функція для ввімкнення/вимкнення елементів
export function setElementEnabled(element, isEnabled) {
    if (element) {
        element.disabled = !isEnabled;
        element.classList.toggle('opacity-50', !isEnabled);
        element.classList.toggle('cursor-not-allowed', !isEnabled);
        if (!isEnabled && element.title) {
            // Можна додати кастомний tooltip або просто залишити стандартну поведінку
        }
    }
}


document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-close-btn') || e.target.classList.contains('cancel-btn')) {
        let modal = e.target.closest('.modal-overlay');
        if (modal) {
            if (modal.id === 'settingsWindowModal') { closeSettingsWindow(); } 
            else { closeModal(modal.id); }
        }
    }
    // Закриття модального вікна при кліку на оверлей, тільки якщо це сам оверлей, а не його вміст
    if (e.target.classList.contains('modal-overlay') && e.target === e.currentTarget && !e.target.classList.contains('hidden')) {
        if (e.target.id === 'settingsWindowModal') { closeSettingsWindow(); } 
        else { closeModal(e.target.id); }
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openedModalsStack.length > 0) {
        const topModalId = openedModalsStack[openedModalsStack.length - 1];
        if (topModalId === 'settingsWindowModal') { closeSettingsWindow(); } 
        else { closeModal(topModalId); }
    }
});

export function renderCopyPermissionsRoleSelect(availableRoles) {
    const selectElement = elements.copyPermissionsRoleSelect;
    if (!selectElement) return;
    
    // Фільтруємо ролі, виключаючи роль власника (якщо вона є)
    const eligibleRoles = availableRoles.filter(role => 
        role.name.toLowerCase() !== 'owner'
    );
    
    selectElement.innerHTML = '<option value="">-- Оберіть роль --</option>';
    eligibleRoles.sort((a, b) => a.name.localeCompare(b.name)).forEach(role => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.name;
        selectElement.appendChild(option);
    });
    
    // Оновлюємо стан кнопки
    elements.copyOwnerPermissionsBtn.disabled = eligibleRoles.length === 0;
}

export function renderSelectedRolePermissions(selectedRole, allPossiblePermissions) {
    const infoContainer = elements.selectedRolePermissionsInfo;
    const permissionsList = elements.selectedRolePermissionsList;
    
    if (!selectedRole || !infoContainer || !permissionsList) return;
    
    const rolePermissions = selectedRole.permissions || {};
    
    // Показуємо інформацію про роль
    infoContainer.classList.remove('hidden');
    
    // Формуємо список активних прав
    let permissionsHtml = `<div class=\"mb-2\"><strong>Роль:</strong> ${selectedRole.name}</div>`;
    permissionsHtml += '<div><strong>Активні права:</strong></div>';
    
    const activePermissions = [];
    const inactivePermissions = [];
    
    allPossiblePermissions.forEach(perm => {
        if (rolePermissions[perm.id]) {
            activePermissions.push(perm.label);
        } else {
            inactivePermissions.push(perm.label);
        }
    });
    
    if (activePermissions.length > 0) {
        permissionsHtml += '<div class=\"text-green-400 mt-1\">';
        activePermissions.forEach(perm => {
            permissionsHtml += `• ${perm}<br>`;
        });
        permissionsHtml += '</div>';
    } else {
        permissionsHtml += '<div class=\"text-gray-500 mt-1\">Немає активних прав</div>';
    }
    
    if (inactivePermissions.length > 0) {
        permissionsHtml += '<div class=\"text-gray-600 mt-2\"><strong>Неактивні права:</strong></div>';
        permissionsHtml += '<div class=\"text-gray-500\">';
        inactivePermissions.slice(0, 5).forEach(perm => { // Показуємо тільки перші 5
            permissionsHtml += `• ${perm}<br>`;
        });
        if (inactivePermissions.length > 5) {
            permissionsHtml += `... та ще ${inactivePermissions.length - 5} прав`;
        }
        permissionsHtml += '</div>';
    }
    
    permissionsList.innerHTML = permissionsHtml;
}

// Глобальные обработчики для модального окна отпуска
window.onApproveVacationRequest = (id) => {
    if (typeof window.state !== 'undefined' && window.state && window.state.currentUserPermissions?.vacations_manage_requests) {
        if (typeof window.approveVacationRequest === 'function') {
            window.approveVacationRequest(id);
        }
    }
};
window.onDenyVacationRequest = (id) => {
    if (typeof window.state !== 'undefined' && window.state && window.state.currentUserPermissions?.vacations_manage_requests) {
        if (typeof window.denyVacationRequest === 'function') {
            window.denyVacationRequest(id);
        }
    }
};

// Кастомное модальное окно для комментария при відхіленні заявки
export function showVacationDenyCommentModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('vacationDenyCommentModal');
        const input = document.getElementById('vacationDenyCommentInput');
        const okBtn = document.getElementById('vacationDenyCommentOkBtn');
        const cancelBtn = document.getElementById('vacationDenyCommentCancelBtn');
        input.value = '';
        modal.classList.remove('hidden');
        input.focus();

        function cleanup() {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeyDown);
        }
        function onOk() {
            const val = input.value.trim();
            if (!val) {
                input.classList.add('input-error');
                input.focus();
                return;
            }
            cleanup();
            modal.classList.add('hidden');
            resolve(val);
        }
        function onCancel() {
            cleanup();
            modal.classList.add('hidden');
            resolve(null);
        }
        function onKeyDown(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onOk();
            }
        }
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeyDown);
    });
}

// Додаю фільтр по відділу для керування співробітниками
export function renderEmployeeManagerFilter(departments, onChange, selectedDeptId = '') {
    let filterContainer = document.getElementById('employeeManagerFilterContainer');
    if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'employeeManagerFilterContainer';
        filterContainer.className = 'mb-4 flex gap-2 items-center';
        const grid = elements.employeesGrid;
        if (grid && grid.parentNode) {
            grid.parentNode.insertBefore(filterContainer, grid);
        }
    }
    filterContainer.innerHTML = '<label for="employeeManagerDeptFilter" class="mr-2">Відділ:</label>';
    const select = document.createElement('select');
    select.id = 'employeeManagerDeptFilter';
    select.className = 'dark-input p-1 rounded';
    select.innerHTML = '<option value="">Всі відділи</option>';
    departments.sort((a, b) => a.name.localeCompare(b.name, 'uk')).forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        select.appendChild(option);
    });
    select.value = selectedDeptId || '';
    select.addEventListener('change', e => onChange(e.target.value));
    filterContainer.appendChild(select);
}

export function attachPremiumDetailsHandlers() {
    const container = elements.massSalaryTableContainer;
    container.querySelectorAll('.show-premium-details').forEach(btn => {
        btn.onclick = (e) => {
            const employeeId = btn.dataset.employeeId;
            const breakdown = window.massSalaryBreakdownByEmployeeId?.[employeeId];
            const content = document.getElementById('premiumBreakdownContent');
            if (!breakdown) {
                content.innerHTML = '<div>Деталі не знайдено.</div>';
            } else {
                content.innerHTML = `
                <h3 style="font-size:1.2em;margin-bottom:0.5em;">Деталі розрахунку для <b>${breakdown.name}</b></h3>
                <div><b>Ставка:</b> ${breakdown.baseSalary}</div>
                <div><b>База для премії:</b> ${breakdown.premiumBase}</div>
                <div><b>Виконання KPI:</b> ${(breakdown.totalWeightedAchievement*100).toFixed(1)}%</div>
                <div><b>KPI премія:</b> ${breakdown.kpiPremium.toFixed(2)}</div>
                <div><b>Коеф. фокусних задач:</b> ${breakdown.focusCoefficient}</div>
                <div><b>Бонуси:</b><ul style='margin:0 0 0 1em;padding:0;'>${breakdown.calculatedBonuses.map(b=>`<li>${b.name}: ${b.calculated.toFixed(2)}</li>`).join('')}</ul></div>
                <div><b>Норма днів:</b> ${breakdown.normForMonth}, <b>Відпрацьовано:</b> ${breakdown.actualDaysWorked}</div>
                <div><b>Ставка (факт):</b> ${breakdown.baseFact.toFixed(2)}</div>
                <div><b>Премія (факт):</b> ${breakdown.premiumFact.toFixed(2)}</div>
                <div><b>Податки:</b> ${breakdown.taxes}</div>
                <div style='margin-top:0.5em;'><b>Сума до виплати:</b> <span style='color:#4ade80;font-weight:bold;'>${breakdown.finalSalary.toFixed(2)}</span></div>
                <hr style='margin:0.7em 0;'>
                <div style='font-size:0.95em;color:#aaa;'>Формула: <br>Ставка (факт) + Премія (факт) - Податки</div>
                `;
            }
            document.getElementById('premiumBreakdownModal').style.display = 'block';
        };
    });
}

export function openAddSalesModal(employees, salesData = []) {
  const modal = document.getElementById('addSalesModal');
  modal.classList.remove('hidden');
  renderSalesEmployeesTable(employees, salesData);
}
export function closeAddSalesModal() {
  const modal = document.getElementById('addSalesModal');
  modal.classList.add('hidden');
}
export function renderSalesEmployeesTable(employees, salesData = []) {
  const tbody = document.getElementById('salesEmployeesTableBody');
  tbody.innerHTML = '';
  employees.forEach(emp => {
    const saved = salesData.find(s => s.employeeId === emp.id);
    const value = saved ? saved.amount : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="py-2 px-2 text-white">${emp.name}</td><td class="py-2 px-2"><input type="number" class="sales-amount-input dark-input w-32" data-employee-id="${emp.id}" min="0" step="0.01" value="${value}"></td>`;
    tbody.appendChild(tr);
  });
}
export function getSalesDataFromModal() {
  const rows = document.querySelectorAll('#salesEmployeesTableBody tr');
  const data = [];
  rows.forEach(row => {
    const input = row.querySelector('.sales-amount-input');
    const employeeId = input.dataset.employeeId;
    const amount = parseFloat(input.value) || 0;
    data.push({ employeeId, amount });
  });
  return data;
}

export function setupReportTabs() {
  const tabButtons = [
    { btn: document.getElementById('reportTabMonthlyDynamics'), panel: document.getElementById('reportTabPanelMonthlyDynamics') },
    { btn: document.getElementById('reportTabDepartment'), panel: document.getElementById('reportTabPanelDepartment') },
    { btn: document.getElementById('reportTabBonuses'), panel: document.getElementById('reportTabPanelBonuses') },
    { btn: document.getElementById('reportTabComparison'), panel: document.getElementById('reportTabPanelComparison') },
  ];
  tabButtons.forEach(({ btn, panel }, idx) => {
    if (!btn || !panel) return;
    btn.onclick = () => {
      tabButtons.forEach(({ btn: b, panel: p }) => {
        b.classList.remove('active-tab');
        p.classList.remove('active');
      });
      btn.classList.add('active-tab');
      panel.classList.add('active');
    };
  });
}

/**
 * Універсальна функція для перемикання вкладок.
 * @param {string} tabSelector - CSS-селектор для всіх вкладок (наприклад, '.tab' або '.report-tab')
 * @param {string} panelSelector - CSS-селектор для всіх панелей (наприклад, '.tab-panel' або '.report-tab-panel')
 * @param {string} activeTabClass - Клас для активної вкладки (наприклад, 'active' або 'active-tab')
 * @param {string} activePanelClass - Клас для активної панелі (зазвичай 'active')
 * @param {function} [getPanelId] - (Необов'язково) Функція, яка повертає id панелі по id вкладки
 */
export function setupUniversalTabs(tabSelector, panelSelector, activeTabClass = 'active', activePanelClass = 'active', getPanelId) {
    const tabs = document.querySelectorAll(tabSelector);
    const panels = document.querySelectorAll(panelSelector);

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Зняти активність з усіх вкладок і панелей
            tabs.forEach(t => t.classList.remove(activeTabClass));
            panels.forEach(p => p.classList.remove(activePanelClass));

            // Додати активність до вибраної вкладки
            tab.classList.add(activeTabClass);

            // Визначити id панелі
            let panelId;
            if (getPanelId) {
                panelId = getPanelId(tab.id);
            } else {
                // За замовчуванням: tabId -> panelId (наприклад, tab-xxx -> panel-xxx)
                panelId = tab.id.replace(/^tab/, 'panel');
            }
            const panel = document.getElementById(panelId);
            if (panel) panel.classList.add(activePanelClass);
        });
    });
}