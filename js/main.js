// js/main.js
window.state = window.state || {};
// --- Імпорти ---
import * as firebase from './firebase.js'; // Імпортуємо всі функції Firebase
import * as ui from './ui.js';           // Імпортуємо всі функції UI
import * as auth from './auth.js';
// import { initCompetenciesModule, updateCompetenciesData } from './competencies.js'; // ВІДКЛЮЧЕНО: Модуль компетенцій
import { openAddSalesModal, closeAddSalesModal, renderSalesEmployeesTable, getSalesDataFromModal } from './ui.js';
import { renderDepartmentReport } from './reports.js';
import { setupUniversalTabs } from './ui.js';
import { initSalesAssistantPage } from './salesAssistant.js';
import { initFocusPage } from './focus.js';

// --- Глобальний стан програми ---
const state = {
    currentUserId: null,
    currentCompanyId: null,
    currentCompanyName: '',
    currentDate: new Date(), // Поточна дата для місяця табеля
    allEmployees: [],        // Кеш усіх співробітників
    departments: [],         // Кеш усіх відділів
    positions: [],           // Кеш усіх посад
    schedules: [],           // Кеш усіх графіків роботи
    kpiSettingsCache: {},    // Кеш для налаштувань KPI (шаблонів)
    massSalarySnapshots: {}, // Кеш для знімків масового розрахунку { monthKey-deptId: data }
    availableRoles: [],      // Кеш доступних ролей для керування доступом
    currentUserPermissions: {}, // Дозволи поточного користувача
    vacationRequests: [],    // Кеш заявок на відпустку
    editingVacationRequestId: null, // ID заявки, що редагується
    pendingVacationRequestsCount: 0, // Кількість очікуючих заявок на відпустку для сповіщень
    currentEmployeeData: null, // Дані поточного користувача ЯК співробітника
    lastPageId: null,        // Остання відкрита сторінка для відновлення стану

    globalWorkNorm: 21,
    normType: 'global',      // Тип норми: 'global' або 'schedule'

    editingEmployeeId: null,
    editingDepartmentId: null,
    editingPositionId: null,
    editingRoleId: null,

    currentCellEditor: { employeeId: null, day: null },
    planStatuses: { 'П': 'План', 'В': 'Вихідний' },
    factStatuses: { 'Р': 'Працював', 'Л': 'Лікарняний', 'В': 'Відпустка' },
    // Note: 'В' for vacation is also a factStatus, but here it means 'Вихідний' for plan.

    kpiCurrentDate: new Date(),
    salaryKpiCurrentDate: new Date(),
    currentSelectedSalaryEmployeeId: null,
    massSalaryCurrentDate: new Date(),
    reportSelectedDepartment: 'all', // Для фільтра на сторінці звітів

    unsubscribers: [], // Масив для зберігання функцій відписки від слухачів Firestore
    initialLoadCompleted: false, // Прапор для відстеження первинного завантаження даних

    salesSnapshots: {} // Кеш для зберігання знімків продажів
};

// Синхронізуємо window.state з локальним state
window.state = state;

// =================================================================================
// --- ЛОГІКА АУТЕНТИФІКАЦІЇ ---
// =================================================================================

function handleUserLogin(uid) {
    console.log("Користувач увійшов:", uid);
    state.currentUserId = uid;
    window.state = state; // Синхронізуємо window.state
    // --- АВТОЛОГІН у компанію та вкладку ---
    const savedState = localStorage.getItem('savievAppState');
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        if (parsedState.currentCompanyId) {
            selectCompany(parsedState.currentCompanyId, parsedState.currentCompanyName).then(async () => {
                await setupFirestoreListeners();
                if (parsedState.lastPageId) {
                    showPageWithNavUpdate(parsedState.lastPageId);
                } else {
                    showPageWithNavUpdate('appPage');
                }
                hideGlobalLoader();
            });
            return; // Не показувати вибір компанії
        }
    }
    // Якщо нема збереженого companyId — показати вибір компанії
    ui.showPage('setupPage', state.currentUserPermissions);
    ui.showAuthForm(false);
    ui.showCompanySelection(true);
    loadUserCompanies();
    hideGlobalLoader();
}

function handleUserLogout() {
    console.log("Користувач вийшов.");
    state.currentUserId = null;
    state.currentCompanyId = null;
    state.currentCompanyName = '';
    state.currentUserPermissions = {};
    state.unsubscribers.forEach(unsub => unsub());
    saveAppState(); // Зберігаємо пустий стан при виході
    state.unsubscribers = [];
    window.state = state; // Синхронізуємо window.state
    
    const currentPage = document.querySelector('.page-transition.active');
    if (currentPage && currentPage.id === 'setupPage') {
        ui.showAuthForm(true);
        ui.showCompanySelection(false);
        ui.elements.companyListUl.innerHTML = '';
        ui.elements.companySetupSteps.classList.add('hidden');
        ui.elements.createCompanyForm.classList.add('hidden');
        ui.elements.existingCompaniesSection.classList.remove('hidden');

    } else if (currentPage && currentPage.id !== 'landingPage' && currentPage.id !== 'setupPage') {
        ui.showPage('landingPage', state.currentUserPermissions); 
        ui.showAuthForm(true);
        ui.showCompanySelection(false);
    } else {
         ui.showPage('landingPage', state.currentUserPermissions);
         ui.showAuthForm(true); 
         ui.showCompanySelection(false);
    }
}

// =================================================================================
// --- КЕРУВАННЯ КОМПАНІЄЮ ---
// =================================================================================

async function loadUserCompanies() {
    if (!state.currentUserId) return;
    ui.showLoading(true);
    const companiesMap = new Map(); 

    try {
        console.log('Запит компаній для UID:', state.currentUserId);
        
        // ЄДИНИЙ ПРАВИЛЬНИЙ ЗАПИТ:
        // Використовуємо collectionGroup для пошуку всіх записів 'members',
        // де поле 'userId' відповідає поточному користувачу.
        // Цей запит безпечний і працює з вашими правилами.
        const memberQuery = firebase.query(
            firebase.collectionGroup(firebase.db, 'members'),
            firebase.where("userId", "==", state.currentUserId)
        );
        
        const memberDocsSnapshot = await firebase.getDocs(memberQuery);

        // Тепер, для кожного знайденого запису 'members', ми завантажуємо повний
        // документ відповідної компанії.
        for (const memberDoc of memberDocsSnapshot.docs) {
            const companyId = memberDoc.ref.parent.parent.id; // Отримуємо ID компанії
            if (companyId && !companiesMap.has(companyId)) { 
                const companyRef = firebase.doc(firebase.db, "companies", companyId);
                const companySnap = await firebase.getDoc(companyRef);
                if (companySnap.exists()) {
                    // Визначаємо, чи є користувач власником, на основі даних з компанії
                    const isOwner = companySnap.data().ownerId === state.currentUserId;
                    companiesMap.set(companyId, { id: companySnap.id, ...companySnap.data(), isOwner: isOwner });
                }
            }
        }
        
        const companiesArray = Array.from(companiesMap.values());
        ui.renderCompanyList(companiesArray, selectCompany);

    } catch (e) {
        console.error("Помилка завантаження компаній: ", e);
        ui.showToast("Помилка завантаження компаній. Перевірте консоль.", 'error');
    } finally {
        ui.showLoading(false);
    }
}


async function selectCompany(id, name) {
    state.currentCompanyId = id;
    state.currentCompanyName = name;
    window.state = state; // Синхронізуємо window.state
    ui.showCompanySetupSteps(name);
    saveAppState(); // Зберігаємо обрану компанію
    await loadCurrentUserPermissions();
    await loadCurrentEmployeeData(); // Завантажуємо дані співробітника
}

async function createCompany() {
    const name = ui.elements.newCompanyName.value.trim();
    const sphere = ui.elements.newCompanySphere.value.trim();
    if (!name) return ui.showToast("Назва компанії обов'язкова.", 'warning');
    if (!state.currentUserId) return ui.showToast("Помилка: не вдалося визначити користувача.", 'error');

    ui.showLoading(true);
    try {
        const batch = firebase.writeBatch(firebase.db);
        const newCompanyRef = firebase.doc(firebase.collection(firebase.db, "companies"));
        batch.set(newCompanyRef, {
            name,
            sphere,
            createdAt: new Date(),
            ownerId: state.currentUserId
        });
        
        // Додаємо власника до підколекції members з усіма правами
        const ownerPermissions = {};
        ui.ALL_POSSIBLE_PERMISSIONS.forEach(p => ownerPermissions[p.id] = true);

        const memberRef = firebase.doc(firebase.db, "companies", newCompanyRef.id, "members", state.currentUserId);
        batch.set(memberRef, {
            email: firebase.auth.currentUser.email,
            role: "owner", 
            roleId: null, 
            addedAt: new Date(),
            userId: state.currentUserId,
            permissions: ownerPermissions // Власник отримує всі права
        });
        await batch.commit();
        ui.showToast(`Компанія "${name}" створена!`, 'success');
        await selectCompany(newCompanyRef.id, name); 
        await setupFirestoreListeners();
        showPageWithNavUpdate('appPage');
    } catch (error) {
        console.error("Помилка створення компанії:", error);
        if (error.code === 'permission-denied' || error.message.includes('permission-denied') || error.message.includes('insufficient permissions')) {
             ui.showToast("Недостатньо прав для створення компанії. Перевірте правила безпеки Firestore.", 'error', 7000);
        } else {
            ui.showToast("Не вдалося створити компанію.", 'error');
        }
    } finally {
        ui.showLoading(false);
    }
}

// =================================================================================
// --- ДОЗВОЛИ ---
// =================================================================================
async function loadCurrentUserPermissions() {
    if (!state.currentUserId || !state.currentCompanyId) {
        state.currentUserPermissions = {};
        console.log("Дозволи скинуто: немає userId або companyId");
        return;
    }
    ui.showLoading(true);
    try {
        const memberRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", state.currentUserId);
        const memberSnap = await firebase.getDoc(memberRef);

        if (memberSnap.exists()) {
            const memberData = memberSnap.data();
            // Починаємо з дозволів
            state.currentUserPermissions = memberData.permissions || {};
            // Додаємо інші важливі властивості
            state.currentUserPermissions.employeeId = memberData.employeeId;
            state.currentUserPermissions.roleId = memberData.roleId;

            if (memberData.role === 'owner') {
                state.currentUserPermissions.isOwner = true;
                // Власник автоматично має всі дозволи
                ui.ALL_POSSIBLE_PERMISSIONS.forEach(p => state.currentUserPermissions[p.id] = true);
            }
        } else {
            // Користувач не є членом цієї компанії (або документ ще не створено)
            state.currentUserPermissions = {};
            // ui.showToast("Вас не знайдено у списку учасників цієї компанії.", "warning");
        }
    } catch (error) {
        console.error("Помилка завантаження дозволів користувача:", error);
        state.currentUserPermissions = {};
        ui.showToast("Помилка завантаження дозволів.", "error");
    } finally {
        ui.showLoading(false);
    }
    window.state = state; // Синхронізуємо window.state
    console.log("Дозволи користувача завантажено:", state.currentUserPermissions);
}

// --- ЗБЕРЕЖЕННЯ/ВІДНОВЛЕННЯ СТАНУ ДОДАТКУ ---
function saveAppState() {
    const appState = {
        currentCompanyId: state.currentCompanyId,
        currentCompanyName: state.currentCompanyName,
        currentDate: state.currentDate.toISOString(), // Зберігаємо дату як ISO рядок
        lastPageId: state.lastPageId
    };
    try {
        localStorage.setItem('savievAppState', JSON.stringify(appState));
        console.log("Стан додатку збережено:", appState);
    } catch (e) {
        console.error("Помилка збереження стану в localStorage:", e);
    }
}

function loadAppState() {
    try {
        const savedState = localStorage.getItem('savievAppState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            state.currentCompanyId = parsedState.currentCompanyId;
            state.currentCompanyName = parsedState.currentCompanyName;
            state.currentDate = parsedState.currentDate ? new Date(parsedState.currentDate) : new Date();
            state.lastPageId = parsedState.lastPageId;
            window.state = state; // Синхронізуємо window.state
            console.log("Стан додатку відновлено:", parsedState);
            return true;
        }
    } catch (e) {
        console.error("Помилка відновлення стану з localStorage:", e);
        localStorage.removeItem('savievAppState'); // Очистити пошкоджений стан
    }
    return false;
}

async function loadCurrentEmployeeData() {
    if (!state.currentUserId || !state.currentCompanyId || !state.currentUserPermissions) {
        state.currentEmployeeData = null;
        return;
    }
    // Отримуємо employeeId з документа 'member', який ми вже завантажили в state.currentUserPermissions
    const employeeId = state.currentUserPermissions.employeeId;

    if (employeeId) {
        state.currentEmployeeData = state.allEmployees.find(emp => emp.id === employeeId) || null;
    } else {
        state.currentEmployeeData = null;
    }
    window.state = state; // Синхронізуємо window.state
    console.log("Дані поточного співробітника:", state.currentEmployeeData);
}

/**
 * Оновлює лічильник сповіщень та рендерить список заявок на відпустку.
 * Фільтрує заявки відповідно до дозволів поточного користувача.
 */
function updateVacationNotifications() {
    const pendingRequests = state.vacationRequests.filter(req => req.status === 'pending');
    const relevantRequestsSet = new Set();

    // Менеджери та власники бачать заявки, які вони можуть погоджувати
    if (hasPermission('vacations_view_all')) {
        pendingRequests.forEach(req => relevantRequestsSet.add(req));
    } else if (hasPermission('vacations_view_department') && state.currentEmployeeData?.id) {
        // Фильтрация по departmentId
        const managedDepartmentIds = state.departments
            .filter(d => d.managerId === state.currentEmployeeData.id)
            .map(d => d.id);
        pendingRequests.forEach(req => {
            if (managedDepartmentIds.includes(req.departmentId)) {
                relevantRequestsSet.add(req);
            }
        });
    }

    // Кожен користувач повинен бачити свої власні заявки, що очікують на розгляд
    if (hasPermission('vacations_create_own')) {
        pendingRequests.forEach(req => {
            if (req.submittedById === state.currentUserId) {
                relevantRequestsSet.add(req);
            }
        });
    }

    const relevantPendingRequests = Array.from(relevantRequestsSet);
    state.pendingVacationRequestsCount = relevantPendingRequests.length;
    ui.updateNotificationBell(state.pendingVacationRequestsCount);
    ui.renderNotifications(relevantPendingRequests, handleNotificationClick);
}

export function hasPermission(permissionKey) {
    if (state.currentUserPermissions.isOwner) return true; 
    return state.currentUserPermissions[permissionKey] === true;
}

// Делаем функцию доступной глобально для использования в модулях
window.hasPermission = hasPermission;


// =================================================================================
// --- СЛУХАЧІ FIRESTORE ТА ЗАВАНТАЖЕННЯ ДАНИХ ---
// =================================================================================

async function setupFirestoreListeners() {
    if (!state.currentCompanyId) {
        console.warn("Компанія не вибрана. Неможливо налаштувати слухачі.");
        return;
    }

    state.unsubscribers.forEach(unsub => unsub());
    state.unsubscribers = [];
    state.initialLoadCompleted = false;
    ui.showLoading(true);

    return new Promise((resolve) => {
        let loadedCollectionsCount = 0;
        const totalCollectionsToLoad = 8; // Збільшили на 1 для відпусток

        const checkInitialLoadComplete = () => {
            loadedCollectionsCount++;
            if (loadedCollectionsCount >= totalCollectionsToLoad && !state.initialLoadCompleted) {
                state.initialLoadCompleted = true;
                ui.showLoading(false);
                console.log("Початкове завантаження даних завершено для компанії:", state.currentCompanyName);
                loadMainConfig().then(() => {
                    renderApp();
                    resolve();
                });
            }
        };
        
        async function loadMainConfig() {
            const configRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "config", "main");
            try {
                const docSnap = await firebase.getDoc(configRef);
                if (docSnap.exists()) {
                    const configData = docSnap.data();
                    state.globalWorkNorm = configData.workNorm !== undefined ? configData.workNorm : 21;
                    state.normType = configData.normType || 'global';
                    ui.elements.workNormInput.value = state.globalWorkNorm;
                    updateNormTypeUI(); 
                } else {
                    state.globalWorkNorm = 21;
                    state.normType = 'global';
                    ui.elements.workNormInput.value = state.globalWorkNorm;
                    updateNormTypeUI();
                }
            } catch (error) {
                console.error("Помилка завантаження основної конфігурації:", error);
                state.globalWorkNorm = 21;
                state.normType = 'global';
                ui.elements.workNormInput.value = state.globalWorkNorm;
                updateNormTypeUI();
            }
            window.state = state; // Синхронізуємо window.state
        }


        const collectionsToListen = {
            'employees': (snapshot) => { 
                state.allEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
                window.state = state; // Синхронізуємо window.state
                if (state.initialLoadCompleted) {
                    // updateCompetenciesData(state.departments, state.allEmployees, state.positions, state.currentCompanyId, state.currentUserId); // ВІДКЛЮЧЕНО
                    renderApp(); // ДОДАНО: тепер співробітники зʼявляються одразу
                }
            },
            'departments': (snapshot) => {
                state.departments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                window.state = state; // Синхронізуємо window.state
                if (state.initialLoadCompleted) {
                    if (state.currentUserId && state.currentCompanyId) loadCurrentEmployeeData(); // Re-evaluate current employee data if departments change (e.g. manager changes)
                    // updateCompetenciesData(state.departments, state.allEmployees, state.positions, state.currentCompanyId, state.currentUserId); // ВІДКЛЮЧЕНО
                }
            },
            'positions': (snapshot) => { 
                state.positions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
                window.state = state; // Синхронізуємо window.state
                if (state.initialLoadCompleted) { /* updateCompetenciesData(state.departments, state.allEmployees, state.positions, state.currentCompanyId, state.currentUserId); */ } // ВІДКЛЮЧЕНО
            },
            'schedules': (snapshot) => { 
                state.schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
                window.state = state; // Синхронізуємо window.state
            },
            'roles': (snapshot) => { 
                state.availableRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
                window.state = state; // Синхронізуємо window.state
            }
        };

        Object.keys(collectionsToListen).forEach(colName => {
            const colRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, colName);
            const unsubscribe = firebase.onSnapshot(colRef, snapshot => {
                collectionsToListen[colName](snapshot);
                if (!state.initialLoadCompleted) {
                    checkInitialLoadComplete();
                    if (colName === 'employees') loadCurrentEmployeeData(); // Ensure current employee data is set after initial employees load
                } else {
                    renderApp();
                }
            }, (error) => {
                console.error(`Помилка прослуховування ${colName}:`, error);
                if (!state.initialLoadCompleted) checkInitialLoadComplete(); 
                ui.showLoading(false);
            });
            state.unsubscribers.push(unsubscribe);
        });

        const kpiSettingsColRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "kpiSettings");
        const unsubKpi = firebase.onSnapshot(kpiSettingsColRef, (snapshot) => {
            state.kpiSettingsCache = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!state.kpiSettingsCache[data.positionId]) {
                    state.kpiSettingsCache[data.positionId] = {};
                }
                const monthKey = `${data.year}${String(data.month).padStart(2, '0')}`;
                state.kpiSettingsCache[data.positionId][monthKey] = data;
            });
            window.state = state; // Синхронізуємо window.state
            if (!state.initialLoadCompleted) checkInitialLoadComplete();
             else { renderApp(); } 
        }, (error) => {
            console.error("Помилка прослуховування налаштувань KPI:", error);
            if (!state.initialLoadCompleted) checkInitialLoadComplete();
        });
        state.unsubscribers.push(unsubKpi);

        const massSalarySnapshotsColRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "massSalarySnapshots");
        const unsubMassSalary = firebase.onSnapshot(massSalarySnapshotsColRef, (snapshot) => {
            state.massSalarySnapshots = {}; 
            snapshot.docs.forEach(doc => {
                state.massSalarySnapshots[doc.id] = doc.data(); 
            });
            window.state = state; // Синхронізуємо window.state
            if (!state.initialLoadCompleted) {
                checkInitialLoadComplete();
            } else {
                const currentPage = document.querySelector('.page-transition.active');
                if (currentPage && currentPage.id === 'reportsPage') {
                    loadAndRenderMonthlyDynamicsReport();
                }
            }
        }, (error) => {
            console.error("Помилка прослуховування знімків масового розрахунку:", error);
            if (!state.initialLoadCompleted) checkInitialLoadComplete();
        });
        state.unsubscribers.push(unsubMassSalary);

        // НОВИЙ СЛУХАЧ для заявок на відпустку
        const vacationRequestsColRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "vacationRequests");
        const unsubVacations = firebase.onSnapshot(vacationRequestsColRef, (snapshot) => {
            state.vacationRequests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Конвертуємо Timestamps в Date
                startDate: doc.data().startDate.toDate(),
                endDate: doc.data().endDate.toDate(),
                submittedAt: doc.data().submittedAt.toDate(),
            }));
            window.state = state; // Синхронізуємо window.state
            if (!state.initialLoadCompleted) {
                checkInitialLoadComplete();
            } else if (document.querySelector('.page-transition.active')?.id === 'vacationsPage') renderVacationsPage();
            // Оновлюємо сповіщення при будь-якій зміні заявок
            updateVacationNotifications();
        });
        state.unsubscribers.push(unsubVacations);

        // --- Слухач sales ---
        const salesColRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "sales");
        const unsubSales = firebase.onSnapshot(salesColRef, (snapshot) => {
            state.salesSnapshots = {};
            snapshot.docs.forEach(doc => {
                state.salesSnapshots[doc.id] = doc.data();
            });
            window.state = state;
            if (state.initialLoadCompleted) {
                const currentPage = document.querySelector('.page-transition.active');
                if (currentPage && currentPage.id === 'reportsPage') {
                    loadAndRenderMonthlyDynamicsReport();
                }
            }
        }, (error) => {
            console.error("Помилка прослуховування продажів:", error);
            if (!state.initialLoadCompleted) checkInitialLoadComplete();
        });
        state.unsubscribers.push(unsubSales);
    });
}

async function updateMainConfig(key, value) {
    if (!state.currentCompanyId) return;
    if (!hasPermission('timesheet_change_norm') && (key === 'workNorm' || key === 'normType')) {
        ui.showToast("У вас немає дозволу змінювати налаштування норми.", "error");
        if (key === 'workNorm') ui.elements.workNormInput.value = state.globalWorkNorm;
        if (key === 'normType') updateNormTypeUI(); 
        return;
    }

    const configRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "config", "main");
    try {
        await firebase.setDoc(configRef, { [key]: value }, { merge: true });
        console.log(`Конфігурацію оновлено: ${key} = ${value}`);
    } catch (error) {
        console.error(`Помилка оновлення конфігурації ${key}:`, error);
    }
}

// Helper to check if a date is a working day based on a schedule
function isWorkingDay(date, schedule) {
    const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
    const dayOfWeekNormalized = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 (Monday-Sunday)

    if (!schedule || !schedule.workDays || schedule.workDays.length === 0) {
        // Default to standard 5-day work week if no specific schedule
        return dayOfWeekNormalized >= 1 && dayOfWeekNormalized <= 5; // Monday (1) to Friday (5)
    }
    return schedule.workDays.includes(dayOfWeekNormalized);
}



// =================================================================================
// --- ОСНОВНА ФУНКЦІЯ РЕНДЕРИНГУ ---
// =================================================================================

function renderApp() {
    if (!state.initialLoadCompleted || !state.currentCompanyId) return;

    const departmentFilterValue = ui.elements.departmentFilter.value;
    const employeeFilterValue = ui.elements.employeeFilter.value.toLowerCase();
    const showArchived = ui.elements.showArchived.checked;
    const currentMonthYearKey = `${state.currentDate.getFullYear()}${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

    // Завжди фільтруємо від state.allEmployees
    const filteredEmployees = state.allEmployees.filter(emp => {
        const deptMatch = !departmentFilterValue || emp.department === departmentFilterValue;
        const nameMatch = !employeeFilterValue || emp.name.toLowerCase().includes(employeeFilterValue);
        const archivedMatch = showArchived || !emp.archivedInMonths?.[currentMonthYearKey];
        return deptMatch && nameMatch && archivedMatch;
    });

    ui.renderHeader(state.currentDate);

    const employeesWithCounts = filteredEmployees.map(emp => {
        const norm = getNormForEmployee(emp, state.currentDate);
        const timesheetForMonth = emp.timesheet?.[currentMonthYearKey] || {};
        const daysInMonth = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0).getDate();

        let vacationDays = 0;
        let sickDays = 0;
        let workedDays = 0;

        // Исправлено: поиск отдела по id
        const department = state.departments.find(d => d.id === emp.department);
        const schedule = department ? state.schedules.find(s => s.id === department.scheduleId) : null;

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), i);
            const dayData = timesheetForMonth[String(i).padStart(2, '0')] || {};
            const factStatus = dayData.fact || '';

            if (isWorkingDay(date, schedule)) {
                if (factStatus === 'В') { // Vacation
                    vacationDays++;
                } else if (factStatus === 'Л') { // Sick leave
                    sickDays++;
                } else if (factStatus === 'Р') { // Worked
                    workedDays++;
                }
            }
        }

        return {
            ...emp,
            norm: norm,
            vacationDays: vacationDays,
            sickDays: sickDays,
            workedDays: workedDays
        };
    });

    ui.renderBody(employeesWithCounts, state.departments, state.positions, state.currentDate, { onCellClick, onToggleArchive, onFillSchedule }, state.currentUserPermissions);

    ui.renderDepartmentDropdowns(state.departments);
    ui.renderEmployeeDatalist(state.allEmployees);
    ui.renderPositionDropdowns(state.positions);
    ui.renderDepartmentScheduleDropdown(state.schedules, ui.elements.departmentScheduleSelect?.value);

    ui.renderEmployeeManagerList(state.allEmployees, state.departments, state.positions, { onEdit: onEditEmployee, onDelete: onDeleteEmployee }, state.currentDate, state.currentUserPermissions);
    ui.renderDepartmentManagerList(state.departments, state.schedules, state.allEmployees, { onEdit: onEditDepartment, onDelete: onDeleteDepartment }, state.currentUserPermissions);
    ui.renderPositionManagerList(state.positions, { onEdit: onEditPosition, onDelete: onDeletePosition }, state.currentUserPermissions);
    ui.renderSchedulesList(state.schedules, { onDelete: onDeleteSchedule }, state.currentUserPermissions);
    updateNormTypeUI(); 

    ui.setElementEnabled(ui.elements.openExportModalBtn, hasPermission('timesheet_export'));
    ui.setElementEnabled(ui.elements.clearMonthData, hasPermission('timesheet_clear_month'));
    ui.setElementEnabled(ui.elements.workNormInput, hasPermission('timesheet_change_norm'));
    ui.setElementEnabled(ui.elements.normTypeToggle, hasPermission('timesheet_change_norm'));
}

function updateNormTypeUI() {
    if (!ui.elements.normTypeToggle) return;
    const isSchedule = state.normType === 'schedule';
    ui.elements.normTypeToggle.checked = isSchedule;
    ui.elements.globalNormContainer.classList.toggle('hidden', isSchedule);
    ui.elements.normTypeTextGlobal.classList.toggle('text-white', !isSchedule);
    ui.elements.normTypeTextGlobal.classList.toggle('text-gray-400', isSchedule);
    ui.elements.normTypeTextSchedule.classList.toggle('text-white', isSchedule);
    ui.elements.normTypeTextSchedule.classList.toggle('text-gray-400', !isSchedule);
}

// =================================================================================
// --- ДОПОМІЖНІ ФУНКЦІЇ (РОЗРАХУНКИ) ---
// =================================================================================

function calculateWorkDaysForMonth(year, month, workDays) {
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        if (workDays.includes(date.getDay() === 0 ? 7 : date.getDay())) count++;
    }
    return count;
}

function calculateWorkDaysForPeriod(startDate, endDate, workDays) {
    let count = 0;
    const curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
        if (workDays.includes(curDate.getDay() === 0 ? 7 : curDate.getDay())) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}

function getNormForEmployee(employee, forDate, startDate = null, endDate = null) {
    if (state.normType === 'global') return state.globalWorkNorm;
    // Исправлено: поиск отдела по id
    const department = state.departments.find(d => d.id === employee.department);
    if (department?.scheduleId) {
        const schedule = state.schedules.find(s => s.id === department.scheduleId);
        if (schedule && schedule.workDays) { 
            if (startDate && endDate) return calculateWorkDaysForPeriod(startDate, endDate, schedule.workDays);
            return calculateWorkDaysForMonth(forDate.getFullYear(), forDate.getMonth(), schedule.workDays);
        }
    }
    return state.globalWorkNorm; 
}

// =================================================================================
// --- ОБРОБНИКИ ПОДІЙ (HANDLERS) ---
// =================================================================================

// --- Табель ---
async function onCellClick(employee, day) {
    if (!hasPermission('timesheet_edit_cells')) {
        ui.showToast("У вас немає дозволу редагувати табель.", "warning");
        return;
    }
    state.currentCellEditor = { employeeId: employee.id, day };
    ui.openModal('cellEditorModal');
    const modal = document.getElementById('cellEditorModal');
    const loader = modal.querySelector('.cell-editor-loader');
    const content = modal.querySelector('.cell-editor-content');
    if(loader) loader.style.display = '';
    if(content) content.style.display = 'none';
    const employeeDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employee.id);
    const currentMonthYearKey = `${state.currentDate.getFullYear()}${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    let planStatus = '', factStatus = '';
    try {
        const docSnap = await firebase.getDoc(employeeDocRef);
        if (docSnap.exists()) {
            const timesheetData = docSnap.data().timesheet || {};
            const dayData = timesheetData[currentMonthYearKey]?.[day] || {};
            planStatus = dayData.plan || '';
            factStatus = dayData.fact || '';
        }
    } catch (error) {
        console.error("Помилка отримання даних клітинки:", error);
        ui.showToast("Помилка завантаження даних клітинки.", 'error');
    } finally {
        if(loader) loader.style.display = 'none';
        if(content) content.style.display = '';
    }
    ui.renderCellEditorButtons(employee.name, day, planStatus, factStatus, state.planStatuses, state.factStatuses, updateCellData);
}
async function updateCellData(type, status) {
    const { employeeId, day } = state.currentCellEditor;
    if (!employeeId || !day) return;
     if (!hasPermission('timesheet_edit_cells')) return; 
    ui.showLoading(true);
    const employeeDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employeeId);
    const currentMonthYearKey = `${state.currentDate.getFullYear()}${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const updatePath = `timesheet.${currentMonthYearKey}.${day}.${type}`;
    try {
        await firebase.updateDoc(employeeDocRef, { [updatePath]: status });
        ui.closeModal('cellEditorModal');
    } catch (error) {
        console.error("Помилка оновлення даних клітинки:", error);
        ui.showToast("Помилка оновлення даних табеля.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function clearCellData() {
    if (!hasPermission('timesheet_edit_cells')) return;
    const { employeeId, day } = state.currentCellEditor;
    if (!employeeId || !day || !await ui.showConfirmation("Ви впевнені, що хочете очистити дані для цього дня?")) {
        return;
    }
    ui.showLoading(true);
    const employeeDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employeeId);
    const currentMonthYearKey = `${state.currentDate.getFullYear()}${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const updatePath = `timesheet.${currentMonthYearKey}.${day}`;
    try {
        await firebase.updateDoc(employeeDocRef, { [updatePath]: firebase.deleteField() });
        ui.closeModal('cellEditorModal');
    } catch (error) {
        console.error("Помилка очищення даних клітинки:", error);
        ui.showToast("Помилка очищення даних табеля.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onToggleArchive(employeeId, employeeName, isCurrentlyArchived) {
    if (!hasPermission('timesheet_archive_employees')) {
        ui.showToast("У вас немає дозволу на архівування.", "warning");
        return;
    }
    const message = isCurrentlyArchived
        ? `Розархівувати співробітника "${employeeName}" за цей місяць?`
        : `Архівувати співробітника "${employeeName}" за цей місяць? Він буде прихований з табеля.`;
    if (!await ui.showConfirmation(message)) return;
    ui.showLoading(true);
    const employeeDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employeeId);
    const currentMonthYearKey = `${state.currentDate.getFullYear()}${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const updatePath = `archivedInMonths.${currentMonthYearKey}`;
    try {
        const updateData = isCurrentlyArchived ? { [updatePath]: firebase.deleteField() } : { [updatePath]: true };
        await firebase.updateDoc(employeeDocRef, updateData);
    } catch (error) {
        console.error("Помилка перемикання статусу архівування:", error);
        ui.showToast("Помилка зміни статусу архівування.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onFillSchedule(employee) {
    if (!hasPermission('timesheet_fill_schedule')) {
        ui.showToast("У вас немає дозволу заповнювати табель за графіком.", "warning");
        return;
    }
    // Виправлено: пошук відділу по id
    const department = state.departments.find(d => d.id === employee.department);
    const schedule = department ? state.schedules.find(s => s.id === department.scheduleId) : null;
    if (!schedule || !schedule.workDays || schedule.workDays.length === 0) {
        ui.showToast(`Для відділу "${department?.name || 'Без відділу'}" не налаштовано дійсний графік роботи.`, 'warning');
        return;
    }
    if (!await ui.showConfirmation(`Заповнити табель для ${employee.name} згідно з графіком "${schedule.name}"? Існуючі дані за цей місяць будуть перезаписані.`)) {
        return;
    }
    ui.showLoading(true);
    const employeeDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employee.id);
    const currentMonthYearKey = `${state.currentDate.getFullYear()}${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const daysInMonth = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0).getDate();
    const timesheetUpdates = {};
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), i);
        const dayOfWeek = date.getDay(); 
        const status = schedule.workDays.includes(dayOfWeek === 0 ? 7 : dayOfWeek) ? 'П' : 'В';
        timesheetUpdates[String(i).padStart(2, '0')] = { plan: status, fact: '' };
    }
    try {
        await firebase.updateDoc(employeeDocRef, { [`timesheet.${currentMonthYearKey}`]: timesheetUpdates });
        ui.showToast(`Табель для ${employee.name} заповнено!`, 'success');
    } catch (error) {
        console.error("Помилка заповнення графіка:", error);
        ui.showToast("Помилка заповнення табеля.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onClearMonthData() {
    if (!hasPermission('timesheet_clear_month')) {
        ui.showToast("У вас немає дозволу очищати табель.", "warning");
        return;
    }
    if (!await ui.showConfirmation(`Ви впевнені, що хочете очистити ВЕСЬ табель за ${state.currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })} для всіх видимих співробітників? Ця дія незворотня.`)) {
        return;
    }
    ui.showLoading(true);
    const currentMonthYearKey = `${state.currentDate.getFullYear()}${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const batch = firebase.writeBatch(firebase.db);
    const filteredEmployees = state.allEmployees.filter(emp => {
        const deptMatch = !ui.elements.departmentFilter.value || emp.department === ui.elements.departmentFilter.value;
        const nameMatch = !ui.elements.employeeFilter.value || emp.name.toLowerCase().includes(ui.elements.employeeFilter.value.toLowerCase());
        const isArchivedForMonth = emp.archivedInMonths && emp.archivedInMonths[currentMonthYearKey];
        const archivedMatch = ui.elements.showArchived.checked || !isArchivedForMonth;
        return deptMatch && nameMatch && archivedMatch;
    });
    if (filteredEmployees.length === 0) {
        ui.showToast("Немає співробітників, що відповідають фільтрам, для очищення даних.", 'info');
        ui.showLoading(false);
        return;
    }
    filteredEmployees.forEach(employee => {
        const employeeDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employee.id);
        batch.update(employeeDocRef, { [`timesheet.${currentMonthYearKey}`]: firebase.deleteField() });
    });
    try {
        await batch.commit();
        ui.showToast("Табель за місяць очищено!", 'success');
    } catch (error) {
        console.error("Помилка очищення даних за місяць:", error);
        ui.showToast("Помилка очищення табеля за місяць.", 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- Експорт ---
async function generateExcelExport() {
    if (!hasPermission('timesheet_export')) {
        ui.showToast("У вас немає дозволу на експорт.", "warning");
        return;
    }
    const startDate = ui.elements.dateFrom.value ? new Date(ui.elements.dateFrom.value) : null;
    const endDate = ui.elements.dateTo.value ? new Date(ui.elements.dateTo.value) : null;
    if (!startDate || !endDate || startDate > endDate) {
        ui.showToast("Будь ласка, оберіть коректний період для експорту.", 'warning');
        return;
    }
    ui.showLoading(true);
    ui.closeModal('exportModal');
    try {
        const exportData = [];
        const headerRow = ['ПІБ', 'Відділ', 'Посада'];
        const allDatesInPeriod = [];
        let tempDate = new Date(startDate);
        while (tempDate <= endDate) {
            const dateKey = `${tempDate.getDate().toString().padStart(2, '0')}.${(tempDate.getMonth() + 1).toString().padStart(2, '0')}.${tempDate.getFullYear()}`;
            headerRow.push(`${dateKey} (План)`, `${dateKey} (Факт)`);
            allDatesInPeriod.push(new Date(tempDate));
            tempDate.setDate(tempDate.getDate() + 1);
        }
        headerRow.push('Разом (Факт)', 'Норма днів');
        exportData.push(headerRow);
        const filteredEmployees = state.allEmployees.filter(emp => {
            const deptMatch = !ui.elements.exportDepartmentFilter.value || emp.department === ui.elements.exportDepartmentFilter.value;
            const employeeMatch = !ui.elements.exportEmployeeFilter.value || emp.id === ui.elements.exportEmployeeFilter.value;
            return deptMatch && employeeMatch;
        }).sort((a,b) => a.name.localeCompare(b.name, 'uk'));
        for (const employee of filteredEmployees) {
            const row = [
                employee.name,
                employee.department || 'Без відділу',
                state.positions.find(p => p.id === employee.positionId)?.name || 'Без посади'
            ];
            let totalFactDays = 0;
            for (const date of allDatesInPeriod) {
                const monthYearKey = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                const dayKey = date.getDate().toString().padStart(2, '0');
                const dayData = (employee.timesheet?.[monthYearKey]?.[dayKey]) || {};
                const planStatus = dayData.plan || '';
                const factStatus = dayData.fact || '';
                row.push(planStatus, factStatus);
                if (factStatus === 'Р') totalFactDays++;
            }
            const norm = getNormForEmployee(employee, startDate, startDate, endDate);
            row.push(totalFactDays, norm);
            exportData.push(row);
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Табель");
        XLSX.writeFile(wb, `Табель_SAVIEV_dev_${startDate.toLocaleDateString('uk-UA')}_${endDate.toLocaleDateString('uk-UA')}.xlsx`);
        ui.showToast("Звіт успішно експортовано в Excel!", 'success');
    } catch (error) {
        console.error("Помилка при генерації Excel:", error);
        ui.showToast("Помилка при експорті звіту в Excel.", 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- Керування персоналом (Співробітники, Відділи, Посади, Графіки) ---
function onAddEmployee() {
    if (!hasPermission('settings_employees_manage')) return;
    state.editingEmployeeId = null;    
    ui.updateEmployeeEditorUI(null);
    ui.openModal('employeeEditorModal');
}
function onEditEmployee(employee) {
    if (!hasPermission('settings_employees_manage')) return;
    state.editingEmployeeId = employee.id;
    ui.updateEmployeeEditorUI(employee);
    ui.openModal('employeeEditorModal');
}
async function onSaveEmployee() {
    if (!hasPermission('settings_employees_manage')) return;
    const name = ui.elements.newEmployeeName.value.trim();
    const department = ui.elements.newEmployeeDeptSelect.value;
    const positionId = ui.elements.newEmployeePositionSelect.value;
    const avatarFile = ui.elements.avatarUploadInput.files[0];

    // Додаємо departmentName
    const departmentObj = state.departments.find(d => d.id === department);
    const departmentName = departmentObj ? departmentObj.name : '';

    if (!name || !department || !positionId) {
        ui.showToast("Будь ласка, заповніть усі поля для співробітника.", 'warning');
        return;
    }
    ui.showLoading(true);

    const dataToSave = { name, department, departmentName, positionId };
    let employeeDocRef;
    let employeeIdForStoragePath = state.editingEmployeeId;

    try {
        if (state.editingEmployeeId) { 
            employeeDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", state.editingEmployeeId);
            const existingEmployee = state.allEmployees.find(emp => emp.id === state.editingEmployeeId);

            if (avatarFile) {
                if (existingEmployee && existingEmployee.avatarUrl) {
                    const oldAvatarPath = `companies/${state.currentCompanyId}/employee_avatars/${state.editingEmployeeId}_avatar`;
                    try {
                        const oldStorageFileRef = firebase.storageRef(firebase.storage, oldAvatarPath);
                        await firebase.deleteObject(oldStorageFileRef);
                    } catch (deleteError) {
                        if (deleteError.code !== 'storage/object-not-found') {
                            console.warn("Не вдалося видалити старий аватар:", deleteError);
                        }
                    }
                }
                const newAvatarPath = `companies/${state.currentCompanyId}/employee_avatars/${state.editingEmployeeId}_avatar`;
                const newStorageFileRef = firebase.storageRef(firebase.storage, newAvatarPath);
                const uploadTask = firebase.uploadBytesResumable(newStorageFileRef, avatarFile);
                await uploadTask;
                dataToSave.avatarUrl = await firebase.getDownloadURL(newStorageFileRef);
            } else if (existingEmployee && existingEmployee.avatarUrl) {
                dataToSave.avatarUrl = existingEmployee.avatarUrl;
            } else {
                 dataToSave.avatarUrl = firebase.deleteField();
            }
            await firebase.updateDoc(employeeDocRef, dataToSave);
        } else { 
            employeeDocRef = firebase.doc(firebase.collection(firebase.db, "companies", state.currentCompanyId, "employees"));
            employeeIdForStoragePath = employeeDocRef.id; 
            dataToSave.timesheet = {};
            dataToSave.archivedInMonths = {};

            if (avatarFile) {
                const avatarPath = `companies/${state.currentCompanyId}/employee_avatars/${employeeIdForStoragePath}_avatar`;
                const storageFileRef = firebase.storageRef(firebase.storage, avatarPath);
                const uploadTask = firebase.uploadBytesResumable(storageFileRef, avatarFile);
                await uploadTask;
                dataToSave.avatarUrl = await firebase.getDownloadURL(storageFileRef);
            }
            await firebase.setDoc(employeeDocRef, dataToSave);
        }
        ui.showToast(`Співробітника ${state.editingEmployeeId ? 'оновлено' : 'додано'}!`, 'success');
        ui.closeModal('employeeEditorModal');
        ui.elements.avatarUploadInput.value = ''; 
        ui.elements.employeeAvatarPreview.src = 'https://via.placeholder.com/96'; 
        // --- Скидаю фільтри після додавання співробітника ---
        if (ui.elements.departmentFilter) ui.elements.departmentFilter.value = '';
        if (ui.elements.employeeFilter) ui.elements.employeeFilter.value = '';
        renderApp();
    } catch (e) {
        console.error("Помилка збереження співробітника:", e);
        ui.showToast("Помилка збереження співробітника. " + e.message, 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onDeleteEmployee(employee) {
    if (!hasPermission('settings_employees_manage')) return;
    if (!await ui.showConfirmation(`Видалити співробітника "${employee.name}"? Усі дані табеля та KPI будуть видалені.`)) return;
    ui.showLoading(true);
    try {
        if (employee.avatarUrl) {
            try {
                const avatarPath = `companies/${state.currentCompanyId}/employee_avatars/${employee.id}_avatar`;
                const storageFileRef = firebase.storageRef(firebase.storage, avatarPath);
                await firebase.deleteObject(storageFileRef);
            } catch (storageError) {
                console.warn("Не вдалося видалити аватар зі Storage:", storageError.code, storageError.message);
                 if (storageError.code !== 'storage/object-not-found') {
                    ui.showToast("Попередження: не вдалося видалити файл аватара зі сховища.", 'warning');
                 }
            }
        }
        await firebase.deleteDoc(firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employee.id));
        ui.showToast(`Співробітника "${employee.name}" видалено.`, 'success');
    } catch (e) {
        console.error("Помилка видалення співробітника:", e);
        ui.showToast("Помилка видалення співробітника.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
function onAddDepartment() {
    if (!hasPermission('settings_departments_manage')) return;
    state.editingDepartmentId = null;
    ui.updateDepartmentEditorUI(null, state.allEmployees);
    ui.renderDepartmentScheduleDropdown(state.schedules, '');
    ui.openModal('departmentEditorModal');
}
function onEditDepartment(department) {
    if (!hasPermission('settings_departments_manage')) return;
    state.editingDepartmentId = department.id;
    ui.updateDepartmentEditorUI(department, state.allEmployees);
    ui.renderDepartmentScheduleDropdown(state.schedules, department.scheduleId || '');
    ui.openModal('departmentEditorModal');
}
async function onSaveDepartment() {
    if (!hasPermission('settings_departments_manage')) return;
    const name = ui.elements.editDepartmentName.value.trim();
    const managerId = ui.elements.departmentManagerSelect.value || null;
    const scheduleId = ui.elements.departmentScheduleSelect.value || null;
    if (!name) {
        ui.showToast("Будь ласка, введіть назву відділу.", 'warning');
        return;
    }
    if (state.departments.some(d => d.name === name && d.id !== state.editingDepartmentId)) {
        ui.showToast("Відділ з такою назвою вже існує.", 'warning');
        return;
    }
    ui.showLoading(true);
    const collectionRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "departments");
    const data = { name, managerId, scheduleId };
    try {
        if (state.editingDepartmentId) {
            await firebase.updateDoc(firebase.doc(collectionRef, state.editingDepartmentId), data);
        } else {
            await firebase.addDoc(collectionRef, data);
        }
        ui.showToast(`Відділ ${state.editingDepartmentId ? 'оновлено' : 'додано'}!`, 'success');
        ui.closeModal('departmentEditorModal');
    } catch (e) {
        console.error(e);
        ui.showToast("Помилка збереження відділу.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onDeleteDepartment(department) {
    if (!hasPermission('settings_departments_manage')) return;
    // Исправлено: проверка по id
    if (state.allEmployees.some(emp => emp.department === department.id)) {
        return ui.showToast("Не можна видалити відділ, поки в ньому є співробітники. Спочатку переведіть або видаліть їх.", 'warning');
    }
    if (!await ui.showConfirmation(`Видалити відділ "${department.name}"? Це не видалить співробітників, але їх відділ стане "Без відділу".`)) return;
    ui.showLoading(true);
    try {
        await firebase.deleteDoc(firebase.doc(firebase.db, "companies", state.currentCompanyId, "departments", department.id));
        ui.showToast(`Відділ "${department.name}" видалено.`, 'success');
    } catch (e) {
        console.error(e);
        ui.showToast("Помилка видалення відділу.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
function onAddPosition() {
    if (!hasPermission('settings_positions_manage')) return;
    state.editingPositionId = null;
    ui.updatePositionEditorUI();
    ui.openModal('positionEditorModal');
}
function onEditPosition(position) {
    if (!hasPermission('settings_positions_manage')) return;
    state.editingPositionId = position.id;
    ui.updatePositionEditorUI(position);
    ui.openModal('positionEditorModal');
}
async function onSavePosition() {
    if (!hasPermission('settings_positions_manage')) return;
    const name = ui.elements.editPositionName.value.trim();
    if (!name) {
        ui.showToast("Будь ласка, введіть назву посади.", 'warning');
        return;
    }
    if (state.positions.some(p => p.name === name && p.id !== state.editingPositionId)) {
        ui.showToast("Посада з такою назвою вже існує.", 'warning');
        return;
    }
    ui.showLoading(true);
    const collectionRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "positions");
    const data = { name };
    try {
        if (state.editingPositionId) {
            await firebase.updateDoc(firebase.doc(collectionRef, state.editingPositionId), data);
        } else {
            await firebase.addDoc(collectionRef, data);
        }
        ui.showToast(`Посаду ${state.editingPositionId ? 'оновлено' : 'додано'}!`, 'success');
        ui.closeModal('positionEditorModal');
    } catch (e) {
        console.error(e);
        ui.showToast("Помилка збереження посади.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onDeletePosition(position) {
    if (!hasPermission('settings_positions_manage')) return;
    if (state.allEmployees.some(emp => emp.positionId === position.id)) {
        return ui.showToast("Не можна видалити посаду, поки на ній є співробітники. Спочатку переведіть або видаліть їх.", 'warning');
    }
    if (!await ui.showConfirmation(`Видалити посаду "${position.name}"?`)) return;
    ui.showLoading(true);
    try {
        await firebase.deleteDoc(firebase.doc(firebase.db, "companies", state.currentCompanyId, "positions", position.id));
         ui.showToast(`Посаду "${position.name}" видалено.`, 'success');
    } catch (e) {
        console.error(e);
        ui.showToast("Помилка видалення посади.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
function setupScheduleManager() {
    if (!hasPermission('settings_schedules_manage')) return;
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    ui.elements.weekdaysContainer.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'px-3 py-1 border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 data-[selected=true]:bg-indigo-600 data-[selected=true]:text-white data-[selected=true]:border-indigo-600 transition-colors';
        btn.textContent = daysOfWeek[i];
        btn.dataset.day = (i + 1).toString();
        btn.dataset.selected = 'false';
        btn.onclick = () => {
            btn.dataset.selected = btn.dataset.selected === 'true' ? 'false' : 'true';
        };
        ui.elements.weekdaysContainer.appendChild(btn);
    }
    ui.renderSchedulesList(state.schedules, { onDelete: onDeleteSchedule }, state.currentUserPermissions);
    ui.elements.scheduleName.value = '';
}
async function onSaveSchedule() {
    if (!hasPermission('settings_schedules_manage')) return;
    const name = ui.elements.scheduleName.value.trim();
    if (!name) {
        ui.showToast("Будь ласка, введіть назву графіка.", 'warning');
        return;
    }
    const selectedDays = Array.from(ui.elements.weekdaysContainer.querySelectorAll('button[data-selected="true"]')).map(btn => parseInt(btn.dataset.day, 10));
    if (selectedDays.length === 0) {
        ui.showToast("Будь ласка, оберіть хоча б один робочий день.", 'warning');
        return;
    }
    ui.showLoading(true);
    try {
        await firebase.addDoc(firebase.collection(firebase.db, "companies", state.currentCompanyId, "schedules"), { name, workDays: selectedDays });
        ui.showToast(`Графік "${name}" збережено!`, 'success');
        setupScheduleManager();
    } catch (error) {
        console.error("Помилка збереження графіка:", error);
        ui.showToast("Помилка збереження графіка.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onDeleteSchedule(schedule) {
    if (!hasPermission('settings_schedules_manage')) return;
    const departmentsUsingSchedule = state.departments.filter(dept => dept.scheduleId === schedule.id);
    if (departmentsUsingSchedule.length > 0) {
        return ui.showToast(`Не можна видалити графік "${schedule.name}", оскільки його використовують відділи: ${departmentsUsingSchedule.map(d => d.name).join(', ')}.`, 'warning');
    }
    if (!await ui.showConfirmation(`Видалити графік "${schedule.name}"?`)) return;
    ui.showLoading(true);
    try {
        await firebase.deleteDoc(firebase.doc(firebase.db, "companies", state.currentCompanyId, "schedules", schedule.id));
        ui.showToast(`Графік "${schedule.name}" видалено.`, 'success');
    } catch (e) {
        console.error(e);
        ui.showToast("Помилка видалення графіка.", 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- Керування доступом (Користувачі та Ролі) ---
async function setupUserAccessManager() {
    if (!hasPermission('settings_users_access_manage')) {
        ui.showToast("У вас немає дозволу на керування доступом користувачів.", "warning");
        ui.elements.userList.innerHTML = '<p class="text-gray-400">Доступ обмежено.</p>';
        ui.setElementEnabled(ui.elements.addUserBtn, false);
        return;
    }
    ui.setElementEnabled(ui.elements.addUserBtn, true);
    ui.showLoading(true);
    try {
        const membersRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "members");
        const snapshot = await firebase.getDocs(membersRef);
        const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Зберігаємо members в state для використання в інших функціях
        state.members = members;
        ui.renderUserList(members, state.allEmployees, state.currentUserId, state.availableRoles, {
            onChangeRole: changeUserRole,
            onRemoveUser: removeUserFromCompany,
            onLinkEmployee: linkEmployeeToMember,
            onChangeEmail: onChangeEmail,
            onResetPassword: onResetPassword
        }, state.currentUserPermissions);
        ui.renderUnlinkedEmployeesSelect(state.allEmployees, members, 'linkEmployeeSelect');
        ui.renderNewUserRoleSelect(state.availableRoles, 'newUserRole');
        ui.renderCopyPermissionsRoleSelect(state.availableRoles);
        // Очищаємо інформацію про права ролі при відкритті модального вікна
        ui.elements.selectedRolePermissionsInfo?.classList.add('hidden');
        ui.elements.copyPermissionsRoleSelect.value = '';
        ui.elements.copyOwnerPermissionsBtn.disabled = true;
    } catch(e) {
        console.error("Помилка завантаження користувачів:", e);
        ui.showToast("Не вдалося завантажити список користувачів.", 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- Скидання пароля користувача ---
async function onResetPassword(email) {
    if (!hasPermission('settings_users_access_manage')) return;
    if (!email) return ui.showToast('Email не вказано.', 'error');
    if (!await ui.showConfirmation(`Надіслати email для скидання пароля на ${email}?`)) return;
    ui.showLoading(true);
    try {
        await firebase.sendPasswordResetEmail(firebase.auth, email);
        ui.showToast('Лист для скидання пароля надіслано!', 'success');
    } catch (e) {
        console.error('Помилка скидання пароля:', e);
        ui.showToast('Не вдалося надіслати лист для скидання пароля.', 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- Зміна email користувача ---
async function onChangeEmail(userId, newEmail) {
    if (!hasPermission('settings_users_access_manage')) return;
    if (!newEmail) return ui.showToast('Email не може бути порожнім.', 'error');
    if (!await ui.showConfirmation(`Змінити email користувача на ${newEmail}?`)) return;
    ui.showLoading(true);
    try {
        // Оновлюємо email у Firestore (members)
        const memberRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", userId);
        await firebase.updateDoc(memberRef, { email: newEmail });
        ui.showToast('Email користувача оновлено у Firestore. Для зміни email у Firebase Auth користувач має змінити його самостійно через профіль або звернутися до підтримки.', 'info');
        await setupUserAccessManager();
    } catch (e) {
        console.error('Помилка зміни email:', e);
        ui.showToast('Не вдалося оновити email.', 'error');
    } finally {
        ui.showLoading(false);
    }
}

async function changeUserRole(userId, newRoleId) {
    if (!hasPermission('settings_users_access_manage')) {
        ui.showToast("У вас немає дозволу змінювати ролі.", "warning");
        return;
    }
    if (!await ui.showConfirmation(`Змінити роль для цього користувача?`)) return;
    
    ui.showLoading(true);
    try {
        const memberRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", userId);
        let newPermissions = {};
        let newRoleName = null;
        if (newRoleId) {
            const roleRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "roles", newRoleId);
            const roleSnap = await firebase.getDoc(roleRef);
            if (roleSnap.exists()) {
                newPermissions = roleSnap.data().permissions || {};
                newRoleName = roleSnap.data().name || null;
            } else {
                throw new Error("Обрана роль не знайдена.");
            }
        }
        
        await firebase.updateDoc(memberRef, {
            roleId: newRoleId || null,
            role: newRoleName,
            permissions: newPermissions
        });
        ui.showToast("Роль та дозволи користувача оновлено.", 'success');
        await setupUserAccessManager(); // Перезавантажуємо список для відображення змін
        // Якщо змінено роль поточного користувача, оновити його дозволи
        if (userId === state.currentUserId) {
            await loadCurrentUserPermissions();
        }

    } catch (e) {
        console.error("Помилка зміни ролі:", e);
        ui.showToast(`Помилка зміни ролі: ${e.message}`, 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function removeUserFromCompany(userId, userEmail) {
    if (!hasPermission('settings_users_access_manage')) return;
    if (!await ui.showConfirmation(`Ви впевнені, що хочете видалити користувача ${userEmail} з компанії?`)) return;
    ui.showLoading(true);
    try {
        const memberRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", userId);
        await firebase.deleteDoc(memberRef);
        ui.showToast("Користувача видалено з компанії.", 'success');
        setupUserAccessManager(); 
    } catch(e) {
        console.error("Помилка видалення користувача:", e);
         ui.showToast("Помилка видалення користувача.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function addUser() {
    if (!hasPermission('settings_users_access_manage')) {
        ui.elements.addUserError.textContent = 'У вас немає дозволу додавати користувачів.';
        return;
    }
    const email = ui.elements.newUserEmail.value.trim().toLowerCase();
    const password = ui.elements.newUserPassword.value;
    const roleId = ui.elements.newUserRole.value;
    const employeeId = ui.elements.linkEmployeeSelect.value || null;
    const errorEl = ui.elements.addUserError;
    errorEl.textContent = '';

    if (!email || !password || !roleId) {
        errorEl.textContent = 'Заповніть email, пароль та оберіть роль.';
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Пароль має містити щонайменше 6 символів.';
        return;
    }
    ui.showLoading(true);
    const adminOriginalEmail = firebase.auth.currentUser?.email;

    try {
        // 1. Прочитати документ ролі, щоб отримати об'єкт permissions
        const roleRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "roles", roleId);
        const roleSnap = await firebase.getDoc(roleRef);
        if (!roleSnap.exists()) {
            throw new Error("Обрана роль не знайдена. Неможливо призначити права.");
        }
        const permissionsToCopy = roleSnap.data().permissions || {};

        // 2. Створити користувача в Firebase Authentication
        const newUserCredential = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
        const newUserId = newUserCredential.user.uid;

        // 3. Створити запис для користувача в Firestore /members з правами
        const memberRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", newUserId);
        await firebase.setDoc(memberRef, {
            email: email,
            roleId: roleId,
            role: roleSnap.data().name || null, // Додаю назву ролі
            permissions: permissionsToCopy, // Ось ключовий момент - копіюємо права
            employeeId: employeeId, // Прив'язуємо до співробітника
            addedAt: new Date(),
            addedBy: adminOriginalEmail,
            userId: newUserId
        });

        ui.showToast(`Користувача ${email} створено з відповідними правами. Передайте йому пароль.`, 'success');
        ui.elements.newUserEmail.value = '';
        ui.elements.newUserPassword.value = '';
        ui.elements.linkEmployeeSelect.value = '';
        ui.elements.newUserRole.value = '';
        errorEl.textContent = '';
        await setupUserAccessManager(); // Оновити список користувачів
    } catch (error) {
        console.error("Помилка додавання користувача:", error);
        if (error.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'Цей email вже використовується.';
        } else if (error.code === 'auth/weak-password') {
            errorEl.textContent = 'Пароль занадто слабкий.';
        } else {
            errorEl.textContent = `Не вдалося додати користувача: ${error.message}`;
        }
    } finally {
        ui.showLoading(false);
        // Відновлення сесії адміністратора, якщо Firebase Auth змінив поточного користувача
        if (firebase.auth.currentUser && firebase.auth.currentUser.email !== adminOriginalEmail && adminOriginalEmail) {
             try {
                // Спроба вийти з системи нового користувача і увійти знову як адмін
                // Це складна частина, оскільки createUserWithEmailAndPassword автоматично логінить нового користувача
                // Потрібно перелогінитися назад. Це може потребувати збереження креданлів адміна або спеціальної логіки.
                // Для простоти, зараз просто показуємо попередження.
                console.warn("Поточний користувач змінився після створення нового. Потрібно перелогінитися адміном.");
                ui.showToast(`Ви були тимчасово перелогінені. Можливо, знадобиться оновити сторінку або перелогінитись як ${adminOriginalEmail}.`, 'warning', 7000);

             } catch (reauthError) {
                console.error("Помилка відновлення сесії адміністратора:", reauthError);
             }
        }
    }
}

async function linkEmployeeToMember(memberId, employeeId) {
    if (!hasPermission('settings_users_access_manage')) {
        ui.showToast("У вас немає дозволу прив'язувати співробітників до користувачів.", "warning");
        return;
    }
    ui.showLoading(true);
    try {
        const memberRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", memberId);
        await firebase.updateDoc(memberRef, { employeeId: employeeId });
        ui.showToast("Співробітника успішно прив'язано!", "success");
        await setupUserAccessManager(); // Re-render the list to update dropdowns
        // If the current user's employeeId was changed, update currentEmployeeData
        if (memberId === state.currentUserId) {
            await loadCurrentEmployeeData();
        }
    } catch (error) {
        console.error("Помилка прив'язки співробітника:", error);
        ui.showToast("Не вдалося прив'язати співробітника.", "error");
    } finally {
        ui.showLoading(false);
    }
}

async function copyOwnerPermissions() {
    if (!hasPermission('settings_users_access_manage')) {
        ui.showToast("У вас немає дозволу керувати правами користувачів.", "warning");
        return;
    }
    
    const selectedRoleId = ui.elements.copyPermissionsRoleSelect.value;
    if (!selectedRoleId) {
        ui.showToast("Оберіть роль для копіювання прав.", "warning");
        return;
    }
    
    const selectedRole = state.availableRoles?.find(r => r.id === selectedRoleId);
    if (!selectedRole) {
        ui.showToast("Обрана роль не знайдена.", "error");
        return;
    }
    
    if (!await ui.showConfirmation(`Ви впевнені, що хочете скопіювати права ролі '${selectedRole.name}' для власника? Це замінить поточні права власника на права цієї ролі.`)) {
        return;
    }
    
    ui.showLoading(true);
    ui.elements.copyPermissionsStatus.textContent = "Копіювання прав...";
    
    try {
        // Знаходимо власника в списку користувачів
        const owner = state.members?.find(m => m.role === 'owner');
        if (!owner) {
            throw new Error("Власник не знайдений в компанії.");
        }
        
        // Копіюємо права обраної ролі
        const permissionsToCopy = selectedRole.permissions || {};
        permissionsToCopy.isOwner = true;
        
        const ownerRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", owner.id);
        await firebase.updateDoc(ownerRef, { 
            permissions: permissionsToCopy,
            roleId: selectedRole.id, // Копіюємо роль
            role: 'owner' // Залишаємо роль власника
        });
        
        ui.showToast(`Права ролі '${selectedRole.name}' скопійовано для власника!`, 'success');
        ui.elements.copyPermissionsStatus.textContent = "Права успішно скопійовано!";
        ui.elements.copyPermissionsRoleSelect.value = "";
        
        // Оновлюємо список користувачів
        await setupUserAccessManager();
        
        // Якщо поточний користувач є власником, оновлюємо його дозволи
        if (owner.id === state.currentUserId) {
            await loadCurrentUserPermissions();
        }
        
    } catch (error) {
        console.error("Помилка копіювання прав:", error);
        ui.showToast(`Помилка копіювання прав: ${error.message}`, 'error');
        ui.elements.copyPermissionsStatus.textContent = "Помилка копіювання прав";
    } finally {
        ui.showLoading(false);
        // Очищаємо статус через 3 секунди
        setTimeout(() => {
            ui.elements.copyPermissionsStatus.textContent = "";
        }, 3000);
    }
}

async function openRolesManager() {
    if (!hasPermission('settings_roles_manage')) {
        ui.showToast("У вас немає дозволу на керування ролями.", "warning");
        elements.rolesList.innerHTML = '<p class="text-sm text-gray-400">Доступ обмежено.</p>';
        ui.setElementEnabled(elements.addNewRoleBtn, false);
        elements.roleEditor.classList.add('hidden');
        return;
    }
    ui.showLoading(true);
    try {
        ui.renderRolesList(state.availableRoles, selectRoleToEdit, state.currentUserPermissions);
        ui.elements.roleEditor.classList.add('hidden'); 
    } catch (e) {
        console.error("Помилка завантаження ролей:", e);
        ui.showToast("Помилка завантаження ролей.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
function selectRoleToEdit(roleId) {
    if (!hasPermission('settings_roles_manage')) return;
    state.editingRoleId = roleId;
    const role = state.availableRoles.find(r => r.id === roleId);
    if (role) {
        ui.renderRoleEditor(role, state.currentUserPermissions);
    }
}
async function onSaveRole() {
    if (!state.editingRoleId || !hasPermission('settings_roles_manage')) return;
    const newName = ui.elements.roleNameInput.value.trim();
    if (!newName) {
        ui.showToast("Назва ролі не може бути порожньою.", 'warning');
        return;
    }
    if (newName.toLowerCase() === 'owner') {
        ui.showToast("Назву ролі 'owner' зарезервовано.", 'warning');
        return;
    }
    const permissions = ui.getPermissionsFromUI();
    const roleData = { name: newName, permissions };
    ui.showLoading(true);
    try {
        const roleRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "roles", state.editingRoleId);
        await firebase.updateDoc(roleRef, roleData);
        ui.showToast("Роль успішно оновлено.", 'success');
        
        // Оновити права для всіх користувачів з цією роллю
        const membersQuery = firebase.query(
            firebase.collection(firebase.db, "companies", state.currentCompanyId, "members"),
            firebase.where("roleId", "==", state.editingRoleId)
        );
        const membersSnapshot = await firebase.getDocs(membersQuery);
        const batch = firebase.writeBatch(firebase.db);
        membersSnapshot.forEach(memberDoc => {
            batch.update(memberDoc.ref, { permissions: permissions });
        });
        await batch.commit();
        ui.showToast("Права для користувачів з цією роллю також оновлено.", 'info');

        await openRolesManager(); 
        // Якщо редагована роль стосується поточного користувача, оновити його права
        const currentUserMemberDoc = await firebase.getDoc(firebase.doc(firebase.db, "companies", state.currentCompanyId, "members", state.currentUserId));
        if (currentUserMemberDoc.exists() && currentUserMemberDoc.data().roleId === state.editingRoleId) {
            await loadCurrentUserPermissions();
        }

    } catch(e) {
        console.error("Помилка збереження ролі:", e);
        ui.showToast("Помилка збереження ролі.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onAddNewRole() {
    if (!hasPermission('settings_roles_manage')) return;
    const roleName = prompt("Введіть назву нової ролі:", "Нова роль");
    if (!roleName || roleName.trim() === '') return;
    if (roleName.toLowerCase() === 'owner') {
         ui.showToast("Назву ролі 'owner' зарезервовано.", 'warning');
        return;
    }
    ui.showLoading(true);
    try {
        const rolesRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "roles");
        if (state.availableRoles.some(role => role.name.toLowerCase() === roleName.trim().toLowerCase())) {
            ui.showToast(`Роль з назвою "${roleName.trim()}" вже існує.`, 'warning');
            ui.showLoading(false);
            return;
        }
        // Створюємо нову роль з порожніми правами за замовчуванням
        const defaultPermissions = {};
        ui.ALL_POSSIBLE_PERMISSIONS.forEach(p => defaultPermissions[p.id] = false);

        await firebase.addDoc(rolesRef, { name: roleName.trim(), permissions: defaultPermissions }); 
        ui.showToast("Нову роль створено.", 'success');
        await openRolesManager(); 
    } catch(e) {
        console.error("Помилка створення ролі:", e);
        ui.showToast("Помилка створення ролі.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function onDeleteRole() {
    if (!state.editingRoleId || !hasPermission('settings_roles_manage')) return;
    const roleToDelete = state.availableRoles.find(r => r.id === state.editingRoleId);
    if (roleToDelete && roleToDelete.name.toLowerCase() === 'owner') {
        ui.showToast("Роль 'Owner' не може бути видалена.", 'error');
        return;
    }
    const membersUsingRole = await firebase.getDocs(firebase.query(
        firebase.collection(firebase.db, "companies", state.currentCompanyId, "members"),
        firebase.where("roleId", "==", state.editingRoleId)
    ));
    if (!membersUsingRole.empty) {
        ui.showToast(`Неможливо видалити роль "${roleToDelete.name}", оскільки вона призначена користувачам. Спочатку змініть їх ролі.`, 'warning', 5000);
        return;
    }
    if (!await ui.showConfirmation(`Ви впевнені, що хочете видалити роль "${roleToDelete.name}"? Це неможливо буде скасувати.`)) return;
    ui.showLoading(true);
    try {
        const roleRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "roles", state.editingRoleId);
        await firebase.deleteDoc(roleRef);
        ui.showToast("Роль видалено.", 'success');
        state.editingRoleId = null;
        await openRolesManager(); 
    } catch (e) {
        console.error("Помилка видалення ролі:", e);
        ui.showToast("Помилка видалення ролі.", 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- KPI Конструктор ---
function openKpiConstructorWrapper() { 
    openKpiConstructor();
}
function openKpiConstructor() {
    if (!hasPermission('settings_kpi_constructor_manage')) {
        ui.showToast("У вас немає дозволу налаштовувати KPI.", "warning");
        ui.closeModal('kpiManagerModal'); 
        return;
    }
    state.kpiCurrentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
    ui.renderPositionDropdowns(state.positions);
    if (state.positions.length > 0 && !ui.elements.kpiPositionSelect.value) {
        ui.elements.kpiPositionSelect.value = state.positions[0].id;
    }
    handleKpiPositionChange();
    ui.updateKpiConstructorUI(state.kpiCurrentDate.getFullYear(), state.kpiCurrentDate.getMonth(), null, state.currentUserPermissions); 
}
function handleKpiPositionChange() {
    loadKpiSettings(ui.elements.kpiPositionSelect.value, state.kpiCurrentDate.getFullYear(), state.kpiCurrentDate.getMonth());
}
async function loadKpiSettings(positionId, year, month) {
    state.kpiCurrentDate = new Date(year, month);
    ui.elements.kpiSettingsContainer.classList.add('hidden');
    if (!positionId) {
        ui.updateKpiConstructorUI(year, month, null, state.currentUserPermissions); 
        return;
    }
    const monthKey = `${year}${(month + 1).toString().padStart(2, '0')}`;
    const settings = state.kpiSettingsCache[positionId]?.[monthKey];
    ui.updateKpiConstructorUI(year, month, settings, state.currentUserPermissions);
}
async function saveKpiSettings() {
    if (!hasPermission('settings_kpi_constructor_manage')) return;
    const positionId = ui.elements.kpiPositionSelect.value;
    if (!positionId) {
        ui.showToast("Будь ласка, оберіть посаду.", 'warning');
        return;
    }
    const monthKey = `${state.kpiCurrentDate.getFullYear()}${(state.kpiCurrentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const kpiId = `${positionId}-${monthKey}`;
    const categories = Array.from(ui.elements.kpiCategoriesContainer.querySelectorAll('.flex.items-center')).map(div => {
        const idInput = div.querySelector('.kpi-category-id');
        const nameInput = div.querySelector('.kpi-category-name');
        const weightInput = div.querySelector('.kpi-category-weight');
        return {
            id: idInput ? idInput.value : '',
            name: nameInput ? nameInput.value.trim() : '',
            weight: weightInput ? parseFloat(weightInput.value) || 0 : 0,
        };
    });
    const bonuses = Array.from(ui.elements.bonusesContainer.querySelectorAll('.grid.items-center')).map(div => {
        const idInput = div.querySelector('.kpi-bonus-id');
        const nameInput = div.querySelector('.kpi-bonus-name');
        const typeSelect = div.querySelector('.kpi-bonus-type');
        const valueInput = div.querySelector('.kpi-bonus-value');
        return {
            id: idInput ? idInput.value : '',
            name: nameInput ? nameInput.value.trim() : '',
            type: typeSelect ? typeSelect.value : 'fixed',
            value: valueInput ? parseFloat(valueInput.value) || 0 : 0
        };
    });
    if (categories.length > 0 && categories.reduce((sum, cat) => sum + cat.weight, 0) !== 100) {
        ui.showToast("Сума ваг KPI повинна дорівнювати 100%.", 'warning');
        return;
    }
    const kpiData = {
        positionId,
        year: state.kpiCurrentDate.getFullYear(),
        month: state.kpiCurrentDate.getMonth() + 1, 
        baseSalary: parseFloat(ui.elements.kpiBaseSalary.value) || 0,
        premiumBase: parseFloat(ui.elements.kpiPremiumBase.value) || 0,
        taxes: parseFloat(ui.elements.kpiTaxes.value) || 0,
        focusCoefficients: {
            '0': parseFloat(ui.elements.kpiFocus0.value) || 0,
            '1': parseFloat(ui.elements.kpiFocus1.value) || 0,
            '2': parseFloat(ui.elements.kpiFocus2.value) || 0
        },
        categories,
        bonuses 
    };
    ui.showLoading(true);
    try {
        await firebase.setDoc(firebase.doc(firebase.db, "companies", state.currentCompanyId, "kpiSettings", kpiId), kpiData);
        ui.showToast("Налаштування KPI збережено!", 'success');
    } catch (error) {
        console.error("Помилка збереження налаштувань KPI:", error);
        ui.showToast("Помилка збереження налаштувань KPI.", 'error');
    } finally {
        ui.showLoading(false);
    }
}
async function copyKpiSettings() {
    if (!hasPermission('settings_kpi_constructor_manage')) return;
    const positionId = ui.elements.kpiPositionSelect.value;
    if (!positionId) {
        ui.showToast("Будь ласка, оберіть посаду.", 'warning');
        return;
    }
    const prevDate = new Date(state.kpiCurrentDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthKey = `${prevDate.getFullYear()}${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const prevSettings = state.kpiSettingsCache[positionId]?.[prevMonthKey];
    if (!prevSettings) {
        ui.showToast(`Немає налаштувань KPI для копіювання за ${prevDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}.`, 'info');
        return;
    }
    if (!await ui.showConfirmation(`Скопіювати налаштування KPI з ${prevDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}? Існуючі налаштування за поточний місяць буде перезаписано.`)) {
        return;
    }
    const newBonuses = prevSettings.bonuses.map(b => ({
        name: b.name,
        type: b.type || 'fixed', 
        value: b.value !== undefined ? b.value : (b.amount || 0) 
    }));
    const newSettings = { 
        ...prevSettings, 
        year: state.kpiCurrentDate.getFullYear(), 
        month: state.kpiCurrentDate.getMonth() + 1,
        bonuses: newBonuses 
    };
    const currentKpiId = `${positionId}-${state.kpiCurrentDate.getFullYear()}${(state.kpiCurrentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    ui.showLoading(true);
    try {
        await firebase.setDoc(firebase.doc(firebase.db, "companies", state.currentCompanyId, "kpiSettings", currentKpiId), newSettings);
        ui.showToast("Налаштування KPI успішно скопійовано!", 'success');
        loadKpiSettings(positionId, state.kpiCurrentDate.getFullYear(), state.kpiCurrentDate.getMonth());
    } catch (error) {
        console.error("Помилка копіювання налаштувань KPI:", error);
        ui.showToast("Помилка копіювання налаштувань KPI.", 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- Сторінка розрахунку ЗП (KPI) ---
function renderSalaryPage() {
    ui.elements.kpiCurrentMonthSalaryDisplay.textContent = state.salaryKpiCurrentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    ui.renderEmployeeSelect(ui.elements.kpiEmployeeSelectSalary, state.allEmployees, '', state.currentSelectedSalaryEmployeeId);
    handleSalaryEmployeeChange(); 
    ui.updateSalaryPageUI(state.salaryKpiCurrentDate.getFullYear(), state.salaryKpiCurrentDate.getMonth(), null, null, state.currentUserPermissions);
}
function handleSalaryEmployeeChange() {
    state.currentSelectedSalaryEmployeeId = ui.elements.kpiEmployeeSelectSalary.value;
    const employee = state.allEmployees.find(emp => emp.id === state.currentSelectedSalaryEmployeeId);
    if (employee) {
        loadKpiSettingsForSalaryCalculation(employee.positionId, state.salaryKpiCurrentDate.getFullYear(), state.salaryKpiCurrentDate.getMonth());
    } else {
        ui.elements.kpiSalaryDetails.classList.add('hidden');
        ui.setCalculatedSalary(0);
        ui.updateSalaryPageUI(state.salaryKpiCurrentDate.getFullYear(), state.salaryKpiCurrentDate.getMonth(), null, null, state.currentUserPermissions);
    }
}
async function loadKpiSettingsForSalaryCalculation(positionId, year, month) {
    if (!hasPermission('kpiIndividual_view_page')) { 
         ui.elements.kpiSalaryDetails.classList.add('hidden');
         ui.updateSalaryPageUI(year, month, null, null, state.currentUserPermissions); 
        return;
    }
    ui.elements.kpiSalaryDetails.classList.add('hidden');
    ui.setCalculatedSalary(0);
    ui.elements.loadKpiActualsBtn.disabled = !hasPermission('kpiIndividual_load_actuals');

    if (!positionId || !state.currentSelectedSalaryEmployeeId) {
        ui.updateSalaryPageUI(year, month, null, null, state.currentUserPermissions);
        return;
    }
    const monthKey = `${year}${(month + 1).toString().padStart(2, '0')}`;
    const kpiTemplateSettings = state.kpiSettingsCache[positionId]?.[monthKey];
    if (!kpiTemplateSettings) {
        ui.showToast(`Немає налаштувань KPI (шаблону) для цієї посади за обраний місяць.`, 'warning');
        ui.elements.loadKpiActualsBtn.textContent = 'Налаштування KPI відсутні';
        ui.elements.loadKpiActualsBtn.disabled = true;
        ui.updateSalaryPageUI(year, month, null, null, state.currentUserPermissions); 
        return;
    } else {
        ui.elements.loadKpiActualsBtn.textContent = 'Завантажити збережені KPI дані';
         ui.elements.loadKpiActualsBtn.disabled = !hasPermission('kpiIndividual_load_actuals');
    }
    
    ui.showLoading(true);
    let kpiActualsData = null;
    if (hasPermission('kpiIndividual_load_actuals')) { 
        try {
            const kpiActualsDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", state.currentSelectedSalaryEmployeeId, "kpiActuals", monthKey);
            const docSnap = await firebase.getDoc(kpiActualsDocRef);
            if (docSnap.exists()) {
                kpiActualsData = docSnap.data();
            }
        } catch (error) {
            console.error("Помилка завантаження фактичних даних KPI:", error);
        }
    }
    ui.showLoading(false);
    ui.updateSalaryPageUI(year, month, kpiTemplateSettings, kpiActualsData, state.currentUserPermissions);
}
function calculateSalary() {
    if (!hasPermission('kpiIndividual_calculate')) {
        ui.showToast("У вас немає дозволу на розрахунок ЗП.", "warning");
        return;
    }
    const employeeId = state.currentSelectedSalaryEmployeeId;
    if (!employeeId) return ui.showToast("Будь ласка, оберіть співробітника.", 'warning');
    const employee = state.allEmployees.find(emp => emp.id === employeeId);
    const monthKey = `${state.salaryKpiCurrentDate.getFullYear()}${(state.salaryKpiCurrentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const kpiTemplate = state.kpiSettingsCache[employee.positionId]?.[monthKey];
    if (!kpiTemplate) return ui.showToast("Налаштування KPI для цієї посади відсутні.", 'warning');
    
    const { baseSalary, premiumBase, focusCoefficients } = kpiTemplate;
    const uiData = ui.getKpiActualsFromUI();
    const taxes = uiData.taxes;
    const { kpiCategories, focusTasksCount, bonusesActual } = uiData;

    let totalWeightedAchievement = kpiCategories.reduce((sum, cat) => {
        const achievement = cat.planAmount > 0 ? (cat.factAmount / cat.planAmount) : (cat.factAmount > 0 ? 1 : 0);
        return sum + (achievement * (cat.weight / 100));
    }, 0);
    
    let kpiPremium = premiumBase * totalWeightedAchievement;
    let focusCoefficient = focusCoefficients[String(Math.min(focusTasksCount, 2))] || 1; 
    
    let totalBonusesCalculated = bonusesActual.reduce((sum, bonus) => {
        if (bonus.type === 'fixed') {
            return sum + (bonus.inputValue * bonus.templateValue); 
        } else if (bonus.type === 'percentage') {
            // Припускаємо, що відсоток береться від (baseSalary + kpiPremium) * focusCoefficient
            // Або, якщо inputValue - це база для відсотка, то:
            return sum + (bonus.inputValue * (bonus.templateValue / 100)); 
        }
        return sum;
    }, 0);
    
    let totalSalary = (baseSalary + kpiPremium) * focusCoefficient + totalBonusesCalculated - taxes;
    ui.setCalculatedSalary(totalSalary);
    ui.showToast("Розрахунок ЗП виконано!", 'success');
}
async function saveKpiActuals() {
    if (!hasPermission('kpiIndividual_save_actuals')) {
        ui.showToast("У вас немає дозволу зберігати дані KPI.", "warning");
        return;
    }
    const employeeId = state.currentSelectedSalaryEmployeeId;
    if (!employeeId) return ui.showToast("Будь ласка, оберіть співробітника.", 'warning');
    const employee = state.allEmployees.find(emp => emp.id === employeeId);
    const monthKey = `${state.salaryKpiCurrentDate.getFullYear()}${(state.salaryKpiCurrentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!state.kpiSettingsCache[employee.positionId]?.[monthKey]) {
        return ui.showToast("Шаблон KPI для збереження не знайдено.", 'warning');
    }
    
    const kpiActualsDataFromUI = ui.getKpiActualsFromUI(); 
    const calculatedBonuses = kpiActualsDataFromUI.bonusesActual.map(bonus => {
        let calculatedAmount = 0;
        if (bonus.type === 'fixed') {
            calculatedAmount = bonus.inputValue * bonus.templateValue;
        } else if (bonus.type === 'percentage') {
             calculatedAmount = bonus.inputValue * (bonus.templateValue / 100);
        }
        return { ...bonus, calculatedAmount }; 
    });
    const kpiActualsData = {
        employeeId,
        monthKey,
        kpiCategories: kpiActualsDataFromUI.kpiCategories,
        focusTasksCount: kpiActualsDataFromUI.focusTasksCount,
        bonusesActual: calculatedBonuses, 
        taxes: kpiActualsDataFromUI.taxes,
        calculatedTotalSalary: parseFloat(ui.elements.calculatedTotalSalary.textContent) || 0,
        lastSaved: new Date()
    };
    ui.showLoading(true);
    try {
        const kpiActualsDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", employeeId, "kpiActuals", monthKey);
        await firebase.setDoc(kpiActualsDocRef, kpiActualsData);
        ui.showToast("Дані KPI успішно збережено!", 'success');
    } catch (error) {
        console.error("Помилка збереження фактичних даних KPI:", error);
        ui.showToast("Помилка збереження даних KPI.", 'error');
    } finally {
        ui.showLoading(false);
    }
}

// --- Сторінка масового розрахунку ЗП ---
function initMassSalaryPage() {
    ui.elements.massSalaryCurrentMonth.textContent = state.massSalaryCurrentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    const select = ui.elements.massSalaryDepartmentFilter;
    select.innerHTML = '<option value="">Всі відділи</option>';
    // Исправлено: value = dept.id
    state.departments.sort((a, b) => a.name.localeCompare(b.name, 'uk')).forEach(dept => {
        select.innerHTML += `<option value="${dept.id}">${dept.name}</option>`;
    });
    ui.elements.massSalaryTableContainer.innerHTML = '';
    ui.elements.massSalaryFooterActions.classList.add('hidden');
    ui.setElementEnabled(ui.elements.generateMassSalaryTableBtn, hasPermission('massSalary_generate_table'));
    ui.setElementEnabled(ui.elements.calculateAllSalariesBtn, hasPermission('massSalary_calculate_all'));
    ui.setElementEnabled(ui.elements.saveMassSalaryBtn, hasPermission('massSalary_save_snapshot'));
    ui.setElementEnabled(ui.elements.exportAllSalariesBtn, hasPermission('massSalary_export_excel'));
}
async function generateMassSalaryView() {
    if (!hasPermission('massSalary_generate_table')) {
        ui.showToast("У вас немає дозволу формувати таблицю.", "warning");
        return;
    }
    if (!state.initialLoadCompleted) {
        ui.showToast("Дані ще завантажуються. Будь ласка, зачекайте кілька секунд і спробуйте знову.", 'info');
        return;
    }
    ui.showLoading(true);
    const departmentNameFilter = ui.elements.massSalaryDepartmentFilter.value;
    const year = state.massSalaryCurrentDate.getFullYear();
    const month = state.massSalaryCurrentDate.getMonth() + 1;
    const monthKey = `${year}${String(month).padStart(2, '0')}`;
    const snapshotId = `${monthKey}-${departmentNameFilter || 'all'}`; 
    let snapshotData = state.massSalarySnapshots[snapshotId] || null; 
    
    // Завжди фільтруємо від state.allEmployees
    const filteredEmployees = state.allEmployees.filter(emp => 
        !emp.archivedInMonths?.[monthKey] && (!departmentNameFilter || emp.department === departmentNameFilter)
    );
    const employeesByPosition = filteredEmployees.reduce((acc, emp) => {
        const posId = emp.positionId || 'no_position';
        if (!acc[posId]) acc[posId] = [];
        acc[posId].push(emp);
        return acc;
    }, {});
    const viewDataPromises = Object.keys(employeesByPosition).map(async (positionId) => {
        const position = state.positions.find(p => p.id === positionId);
        if (!position || !state.kpiSettingsCache[positionId]?.[monthKey]) return null;
        const kpiTemplate = state.kpiSettingsCache[positionId][monthKey];
        return { positionName: position.name, kpiTemplate, employees: employeesByPosition[positionId] };
    });
    const viewData = (await Promise.all(viewDataPromises)).filter(Boolean); 
    ui.renderMassSalaryTable(viewData, snapshotData, state.currentUserPermissions); 
    if (viewData.length > 0) {
        ui.elements.massSalaryFooterActions.classList.remove('hidden');
    } else {
        ui.elements.massSalaryTableContainer.innerHTML = '<p class="text-center text-gray-400 py-8">Немає даних для відображення (перевірте наявність шаблонів KPI для посад).</p>';
        ui.elements.massSalaryFooterActions.classList.add('hidden');
    }
    ui.showLoading(false);
}
function calculateAllSalaries() {
    if (!hasPermission('massSalary_calculate_all')) {
        ui.showToast("У вас немає дозволу на розрахунок.", "warning");
        return;
    }
    const allTables = document.querySelectorAll('#massSalaryTableContainer table');
    if (allTables.length === 0) return;
    ui.showLoading(true);
    allTables.forEach(table => {
        const positionId = table.dataset.positionId;
        const currentCalcDate = state.massSalaryCurrentDate;
        const monthKey = `${currentCalcDate.getFullYear()}${(currentCalcDate.getMonth() + 1).toString().padStart(2, '0')}`;
        const kpiTemplate = state.kpiSettingsCache[positionId]?.[monthKey];
        if (!kpiTemplate) return;
        const employeeRows = table.querySelectorAll('tbody tr');
        employeeRows.forEach(row => {
            const employeeId = row.dataset.employeeId;
            const emp = state.allEmployees.find(e => e.id === employeeId);
            if (!emp) return;
            const { baseSalary, premiumBase, focusCoefficients, taxes: templateTaxes, bonuses: templateBonuses } = kpiTemplate;
            const taxes = (emp.actuals?.taxes ?? templateTaxes) || 0;
            const kpiCategories = kpiTemplate.categories.map(cat => {
                const planInput = row.querySelector(`input[data-kpi-id="${cat.id}"][data-type="plan"]`);
                const factInput = row.querySelector(`input[data-kpi-id="${cat.id}"][data-type="fact"]`);
                return {
                    name: cat.name,
                    planAmount: parseFloat(planInput?.value) || 0,
                    factAmount: parseFloat(factInput?.value) || 0,
                    weight: cat.weight,
                };
            });
            const calculatedBonuses = templateBonuses.map(bonusTmpl => {
                const bonusInput = row.querySelector(`input[data-bonus-id="${bonusTmpl.id}"]`);
                const inputValue = parseFloat(bonusInput?.value) || 0;
                let calculated = 0;
                if (bonusTmpl.type === 'fixed') {
                    calculated = inputValue * bonusTmpl.value;
                } else if (bonusTmpl.type === 'percentage') {
                    calculated = inputValue * (bonusTmpl.value / 100);
                }
                return {
                    name: bonusTmpl.name,
                    type: bonusTmpl.type,
                    templateValue: bonusTmpl.value,
                    inputValue,
                    calculated
                };
            });
            const calculatedBonusesTotal = calculatedBonuses.reduce((sum, b) => sum + b.calculated, 0);
            const focusTasksCount = parseFloat(row.querySelector('input[data-type="focus"]')?.value) || 0;
            // --- Додаємо врахування custom-bonus та custom-penalty ---
            const customBonus = parseFloat(row.nextElementSibling?.querySelector('input[data-type="custom-bonus"]')?.value) || 0;
            const customPenalty = parseFloat(row.nextElementSibling?.querySelector('input[data-type="custom-penalty"]')?.value) || 0;
            // ---
            const totalWeightedAchievement = kpiCategories.reduce((sum, cat) => {
                const achievement = cat.planAmount > 0 ? (cat.factAmount / cat.planAmount) : (cat.factAmount > 0 ? 1 : 0);
                return sum + (achievement * (cat.weight / 100));
            }, 0);
            const kpiPremium = premiumBase * totalWeightedAchievement;
            const focusCoefficient = focusCoefficients[String(Math.min(focusTasksCount, 2))] || 1;
            const normForMonth = getNormForEmployee(emp, currentCalcDate);
            const timesheetForMonth = emp.timesheet?.[monthKey] || {};
            const actualDaysWorked = Object.values(timesheetForMonth).filter(day => day.fact === 'Р').length;
            const baseFact = normForMonth > 0 ? (baseSalary / normForMonth) * actualDaysWorked : 0;
            const premiumFact = normForMonth > 0 ? ((kpiPremium * focusCoefficient + calculatedBonusesTotal + customBonus - customPenalty) / normForMonth) * actualDaysWorked : 0;
            const finalSalary = baseFact + premiumFact - taxes;
            // --- ЛОГИ ---
            console.log(`Расчёт для сотрудника: ${emp.name}`);
            console.log({ baseSalary, premiumBase, focusCoefficients, taxes, templateBonuses });
            console.log('KPI категории:', kpiCategories);
            console.log('Бонусы:', calculatedBonuses);
            console.log('Фокусные задачи:', focusTasksCount, 'Коэффициент:', focusCoefficient);
            console.log('Выполнение KPI:', totalWeightedAchievement);
            console.log('kpiPremium:', kpiPremium);
            console.log('customBonus:', customBonus, 'customPenalty:', customPenalty);
            console.log('normForMonth:', normForMonth, 'actualDaysWorked:', actualDaysWorked);
            console.log('baseFact:', baseFact, 'premiumFact:', premiumFact, 'finalSalary:', finalSalary);
            // --- Расшифровка для UI ---
            if (!window.massSalaryBreakdownByEmployeeId) window.massSalaryBreakdownByEmployeeId = {};
            window.massSalaryBreakdownByEmployeeId[employeeId] = {
                name: emp.name,
                baseSalary,
                premiumBase,
                taxes,
                kpiCategories,
                calculatedBonuses,
                focusTasksCount,
                focusCoefficient,
                totalWeightedAchievement,
                kpiPremium,
                normForMonth,
                actualDaysWorked,
                baseFact,
                premiumFact,
                customBonus,
                customPenalty,
                finalSalary
            };
            const baseCell = row.querySelector('[data-result="base"]');
            const premiumCell = row.querySelector('[data-result="premium"]');
            const totalCell = row.querySelector('[data-result="total"]');
            if (baseCell) baseCell.textContent = baseFact.toFixed(2);
            if (premiumCell) premiumCell.textContent = premiumFact.toFixed(2);
            if (totalCell) ui.animateCount(totalCell, finalSalary);
        });
    });
    ui.showLoading(false);
    ui.showToast("Розрахунок для всіх співробітників завершено!", 'success');
}
async function saveMassSalarySnapshot() {
    if (!hasPermission('massSalary_save_snapshot')) {
        ui.showToast("У вас немає дозволу зберігати розрахунок.", "warning");
        return;
    }
    const departmentName = ui.elements.massSalaryDepartmentFilter.value || 'all';
    const year = state.massSalaryCurrentDate.getFullYear();
    const month = state.massSalaryCurrentDate.getMonth() + 1;
    const snapshotId = `${year}${String(month).padStart(2, '0')}-${departmentName}`;
    ui.showLoading(true);
    const snapshotData = { createdAt: new Date(), employees: [] };
    const allTables = document.querySelectorAll('#massSalaryTableContainer table');
    allTables.forEach(table => {
        const employeeRows = table.querySelectorAll('tbody tr');
        employeeRows.forEach(row => {
            const employeeId = row.dataset.employeeId;
            const employeeData = { employeeId, inputs: {}, results: {} };
            // --- KPI ---
            const table = row.closest('table');
            const positionId = table.dataset.positionId;
            const monthKey = `${state.massSalaryCurrentDate.getFullYear()}${(state.massSalaryCurrentDate.getMonth() + 1).toString().padStart(2, '0')}`;
            const kpiTemplate = state.kpiSettingsCache[positionId]?.[monthKey];
            if (kpiTemplate) {
                kpiTemplate.categories.forEach(cat => {
                    if (!employeeData.inputs[cat.id]) employeeData.inputs[cat.id] = {};
                    const planInput = row.querySelector(`input[data-kpi-id="${cat.id}"][data-type="plan"]`);
                    const factInput = row.querySelector(`input[data-kpi-id="${cat.id}"][data-type="fact"]`);
                    employeeData.inputs[cat.id].plan = planInput ? planInput.value : '';
                    employeeData.inputs[cat.id].fact = factInput ? factInput.value : '';
                });
                kpiTemplate.bonuses.forEach(bonus => {
                    const bonusInput = row.querySelector(`input[data-bonus-id="${bonus.id}"]`);
                    employeeData.inputs[bonus.id] = bonusInput ? bonusInput.value : '';
                });
            }
            // --- Фокус ---
            const focusInput = row.querySelector('input[data-type="focus"]');
            employeeData.inputs.focus = focusInput ? focusInput.value : '';
            // --- Додаю customBonus/customPenalty ---
            const customBonusInput = row.nextElementSibling?.querySelector('input[data-type="custom-bonus"]');
            const customPenaltyInput = row.nextElementSibling?.querySelector('input[data-type="custom-penalty"]');
            employeeData.inputs.customBonus = customBonusInput ? customBonusInput.value : '';
            employeeData.inputs.customPenalty = customPenaltyInput ? customPenaltyInput.value : '';
            // --- Результаты ---
            row.querySelectorAll('td.result-cell').forEach(cell => {
                employeeData.results[cell.dataset.result] = cell.textContent;
            });
            snapshotData.employees.push(employeeData);
        });
    });
    console.log('Сохраняемый snapshotData:', snapshotData);
    try {
        const snapshotRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "massSalarySnapshots", snapshotId);
        await firebase.setDoc(snapshotRef, snapshotData);
        // --- Дублирование в kpiActuals каждого сотрудника ---
        for (const emp of snapshotData.employees) {
            const kpiActualsData = {
                employeeId: emp.employeeId,
                monthKey: `${year}${String(month).padStart(2, '0')}`,
                // Преобразуем inputs в массив kpiCategories и bonusesActual для совместимости с индивидуальным расчетом
                kpiCategories: Object.entries(emp.inputs)
                    .filter(([key, val]) => typeof val === 'object' && val.plan !== undefined && val.fact !== undefined)
                    .map(([id, val]) => ({ id, planAmount: parseFloat(val.plan) || 0, factAmount: parseFloat(val.fact) || 0 })),
                focusTasksCount: parseFloat(emp.inputs.focus) || 0,
                bonusesActual: [
                    ...Object.entries(emp.inputs)
                        .filter(([key, val]) => typeof val === 'string' && key !== 'focus' && key !== 'customBonus' && key !== 'customPenalty')
                        .map(([id, value]) => ({ id, inputValue: parseFloat(value) || 0 })),
                    // Додаю customBonus/customPenalty як окремі бонуси
                    { id: 'customBonus', inputValue: parseFloat(emp.inputs.customBonus) || 0 },
                    { id: 'customPenalty', inputValue: parseFloat(emp.inputs.customPenalty) || 0 }
                ],
                taxes: parseFloat(emp.inputs.taxes) || 0,
                results: emp.results,
                lastSaved: new Date()
            };
            const kpiActualsDocRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", emp.employeeId, "kpiActuals", `${year}${String(month).padStart(2, '0')}`);
            await firebase.setDoc(kpiActualsDocRef, kpiActualsData);
        }
        ui.showToast("Розрахунок успішно збережено!", 'success');
    } catch (error) {
        console.error("Помилка збереження знімку розрахунку:", error);
        ui.showToast("Помилка збереження знімку.", 'error');
    } finally {
        ui.showLoading(false);
        ui.attachPremiumDetailsHandlers && ui.attachPremiumDetailsHandlers();
    }
}
function exportAllSalaries() {
    if (!hasPermission('massSalary_export_excel')) {
        ui.showToast("У вас немає дозволу на експорт.", "warning");
        return;
    }
    const allTables = document.querySelectorAll('#massSalaryTableContainer table');
    if (allTables.length === 0) {
        ui.showToast("Немає даних для експорту.", 'info');
        return;
    }
    const wb = XLSX.utils.book_new();
    allTables.forEach(table => {
        const positionName = table.closest('.mb-8').querySelector('h3').textContent.replace('Посада: ', '');
        const sheetData = [];
        const headerRows = table.querySelectorAll('thead tr');
        headerRows.forEach(headerRow => {
            const rowData = [];
            headerRow.querySelectorAll('th').forEach(th => {
                rowData.push(th.textContent);
            });
            sheetData.push(rowData);
        });
        const dataRows = table.querySelectorAll('tbody tr');
        dataRows.forEach(dataRow => {
            const rowData = [];
            rowData.push(dataRow.querySelector('td')?.textContent || ''); 
            dataRow.querySelectorAll('input.mass-kpi-input').forEach(input => {
                rowData.push(input.value);
            });
            dataRow.querySelectorAll('td.result-cell').forEach(cell => {
                 rowData.push(cell.textContent);
            });
            sheetData.push(rowData);
        });
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, positionName.substring(0, 31)); 
    });
    XLSX.writeFile(wb, `Mass_Salary_${state.massSalaryCurrentDate.toLocaleString('uk-UA', {month:'short', year:'numeric'})}.xlsx`);
    ui.showToast("Масовий розрахунок ЗП експортовано!", 'success');
}

// --- Сторінка Звітів ---
function loadAndRenderMonthlyDynamicsReport() {
    if (!hasPermission('reports_view_dynamics')) {
        ui.showToast("У вас немає дозволу переглядати цей звіт.", "warning");
        if (ui.elements.detailsTableBody) ui.elements.detailsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Доступ до звіту обмежено.</td></tr>';
        if (ui.salaryDynamicsChartInstance) ui.salaryDynamicsChartInstance.destroy();
        if (ui.salesDynamicsChartInstance) ui.salesDynamicsChartInstance.destroy();
        return;
    }
    if (!state.initialLoadCompleted) {
        ui.showToast("Дані ще завантажуються...", 'info');
        return;
    }
    const selectedDepartmentId = ui.elements.reportDepartmentFilter.value;
    state.reportSelectedDepartment = selectedDepartmentId;
    const selectedDepartmentName = selectedDepartmentId === 'all' ? 'all' : state.departments.find(d => d.id === selectedDepartmentId)?.name;
    const reportDataArray = [];
    for (let i = 5; i >= 0; i--) { 
        const date = new Date();
        date.setDate(1); 
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; 
        const monthKey = `${year}${String(month).padStart(2, '0')}`;
        const monthName = date.toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
        let totalSalaryForMonth = 0;
        Object.entries(state.massSalarySnapshots).forEach(([snapshotId, snapshot]) => {
            const [snapMonthKey] = snapshotId.split('-');
            if (snapMonthKey === monthKey) {
                snapshot.employees.forEach(empData => {
                    const emp = state.allEmployees.find(e => e.id === empData.employeeId);
                    if (
                        selectedDepartmentId === 'all' ||
                        (emp && emp.department === selectedDepartmentId)
                    ) {
                        totalSalaryForMonth += parseFloat(empData.results.total?.replace(/\s/g, '').replace(',', '.')) || 0;
                    }
                });
            }
        });
        // --- Підрахунок реальних продажів ---
        let totalSalesForMonth = 0;
        const salesDoc = state.salesSnapshots?.[monthKey];
        if (salesDoc && Array.isArray(salesDoc.sales)) {
          if (selectedDepartmentName === 'all') {
            totalSalesForMonth = salesDoc.sales.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
          } else {
            // Знайти співробітників цього відділу
            const dept = state.departments.find(d => d.name === selectedDepartmentName);
            if (dept) {
              const deptEmployeeIds = state.allEmployees.filter(e => e.department === dept.id).map(e => e.id);
              totalSalesForMonth = salesDoc.sales.filter(s => deptEmployeeIds.includes(s.employeeId)).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
            }
          }
        }
        reportDataArray.push({
            monthName: monthName,
            totalSalary: totalSalaryForMonth,
            totalSales: totalSalesForMonth 
        });
    }
    ui.renderMonthlyDynamicsReport(reportDataArray);
}

// --- ЛОГІКА ВІДПУСТОК ---

function renderVacationsPage() {
    if (!hasPermission('vacations_view_page')) {
        ui.showToast("У вас немає доступу до цього розділу.", "warning");
        return;
    }
    const myRequests = state.vacationRequests.filter(req => req.submittedById === state.currentUserId);
    let managedRequests = [];
    if (hasPermission('vacations_view_all')) {
        managedRequests = state.vacationRequests.filter(req => req.status === 'pending');
    } else if (hasPermission('vacations_view_department')) {
        if (state.currentEmployeeData?.id) {
            // Фильтрация по departmentId
            const managedDepartmentIds = state.departments
                .filter(d => d.managerId === state.currentEmployeeData.id)
                .map(d => d.id);
            managedRequests = state.vacationRequests.filter(req => managedDepartmentIds.includes(req.departmentId) && req.status === 'pending');
        }
    }
    ui.renderVacationsPageUI(myRequests, managedRequests, state.currentUserPermissions, {
        onCreate: openCreateVacationModal,
        onView: openViewVacationModal,
        onApprove: approveVacationRequest,
        onDeny: denyVacationRequest,
        onCancel: cancelVacationRequest
    });
}

function openCreateVacationModal() {
    if (!hasPermission('vacations_create_own')) {
        ui.showToast("У вас немає дозволу створювати заявки.", "warning");
        return;
    }
    state.editingVacationRequestId = null;
    const currentUserEmployee = state.currentEmployeeData;
    if (!currentUserEmployee) {
        ui.showToast("Не вдалося ідентифікувати вас як співробітника.", "error");
        return;
    }
    ui.setupVacationRequestModal('create', null, currentUserEmployee, state.currentUserPermissions, {
        onApprove: approveVacationRequest,
        onDeny: denyVacationRequest,
        onCancel: cancelVacationRequest
    });
    ui.openModal('vacationRequestModal');
}

function openViewVacationModal(requestId) {
    const request = state.vacationRequests.find(r => r.id === requestId);
    if (!request) return;
    const employee = state.allEmployees.find(e => e.id === request.employeeId);
    ui.setupVacationRequestModal('view', request, employee, state.currentUserPermissions, {
        onApprove: approveVacationRequest,
        onDeny: denyVacationRequest,
        onCancel: cancelVacationRequest
    });
    ui.openModal('vacationRequestModal');
}

function handleNotificationClick(requestId) {
    ui.toggleNotificationsDropdown(); // Закриваємо випадаюче меню сповіщень
    openViewVacationModal(requestId); // Відкриваємо модальне вікно перегляду заявки
}

async function handleVacationRequestSubmit() {
    const startDateValue = ui.elements.vacReqStartDate.value;
    const endDateValue = ui.elements.vacReqEndDate.value;
    const comment = ui.elements.vacReqComment.value.trim();

    if (!startDateValue || !endDateValue) {
        ui.showToast("Будь ласка, оберіть дату початку та закінчення відпустки.", "warning");
        return;
    }

    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);

    if (endDate < startDate) {
        ui.showToast("Дата закінчення не може бути раніше дати початку.", "warning");
        return;
    }

    const employeeData = state.currentEmployeeData;
    if (!employeeData) {
        ui.showToast("Помилка ідентифікації співробітника. Неможливо відправити запит.", "error");
        return;
    }

    const formData = {
        employeeId: employeeData.id,
        employeeName: employeeData.name,
        departmentId: state.departments.find(d => d.name === employeeData.department)?.id || null,
        departmentName: employeeData.department,
        startDate: startDate,
        endDate: endDate,
        comment: comment
    };

    await submitVacationRequest(formData);
}

async function submitVacationRequest(requestData) {
    ui.showLoading(true);
    try {
        const collectionRef = firebase.collection(firebase.db, "companies", state.currentCompanyId, "vacationRequests");
        await firebase.addDoc(collectionRef, {
            ...requestData,
            status: 'pending',
            submittedAt: new Date(),
            submittedById: state.currentUserId,
            submittedByName: requestData.employeeName,
            decisionById: null,
            decisionByName: null,
            decisionAt: null,
            decisionComment: ''
        });
        ui.showToast("Заявку на відпустку успішно відправлено!", "success");
        ui.closeModal('vacationRequestModal');
    } catch (error) {
        console.error("Помилка відправки заявки:", error);
        ui.showToast("Не вдалося відправити заявку.", "error");
    } finally {
        ui.showLoading(false);
    }
}

async function automateTimesheetForVacation(vacationRequest) {
    ui.showLoading(true);
    try {
        const employeeRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "employees", vacationRequest.employeeId);
        const employeeSnap = await firebase.getDoc(employeeRef);

        if (!employeeSnap.exists()) {
            ui.showToast(`Співробітника ${vacationRequest.employeeName} не знайдено для оновлення табеля.`, "error");
            return;
        }

        const batch = firebase.writeBatch(firebase.db);
        const currentTimesheet = employeeSnap.data().timesheet || {};

        let currentDate = new Date(vacationRequest.startDate);
        const endDate = new Date(vacationRequest.endDate);

        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            const day = currentDate.getDate().toString().padStart(2, '0');
            const monthYearKey = `${year}${month}`;

            // Оновлюємо timesheet.{YYYYMM}.{DD}
            const updatePath = `timesheet.${monthYearKey}.${day}`;
            batch.update(employeeRef, {
                [updatePath]: { plan: 'В', fact: 'В' } // 'В' для відпустки
            });

            currentDate.setDate(currentDate.getDate() + 1); // Переходимо до наступного дня
        }

        await batch.commit();
        ui.showToast(`Табель для ${vacationRequest.employeeName} оновлено згідно з відпусткою.`, "success");
    } catch (error) {
        console.error("Помилка автоматичного оновлення табеля для відпустки:", error);
        ui.showToast("Помилка оновлення табеля для відпустки.", "error");
    } finally {
        ui.showLoading(false);
    }
}

async function approveVacationRequest(requestId) {
    if (!hasPermission('vacations_manage_requests')) {
        ui.showToast("У вас немає дозволу погоджувати заявки на відпустку.", "warning");
        return;
    }
    const request = state.vacationRequests.find(r => r.id === requestId);
    if (!request) return;
    // Проверка: только руководитель отдела сотрудника или vacations_view_all
    let isManager = false;
    if (hasPermission('vacations_view_all')) {
        isManager = true;
    } else if (hasPermission('vacations_view_department') && state.currentEmployeeData?.id) {
        const managedDepartmentIds = state.departments
            .filter(d => d.managerId === state.currentEmployeeData.id)
            .map(d => d.id);
        if (managedDepartmentIds.includes(request.departmentId)) {
            isManager = true;
        }
    }
    if (!isManager) {
        ui.showToast("Тільки керівник відділу співробітника може погодити цю заявку.", "warning");
        return;
    }
    if (!await ui.showConfirmation(`Погодити заявку на відпустку для ${request.employeeName} з ${request.startDate.toLocaleDateString()} по ${request.endDate.toLocaleDateString()}?`)) {
        return;
    }
    ui.showLoading(true);
    try {
        const requestRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "vacationRequests", requestId);
        await firebase.updateDoc(requestRef, {
            status: 'approved',
            decisionById: state.currentUserId,
            decisionByName: firebase.auth.currentUser.email, // Або ім'я користувача
            decisionAt: new Date(),
            decisionComment: '' // Очищаємо коментар рішення при погодженні
        });
        ui.showToast("Заявку успішно погоджено!", "success");
        ui.closeModal('vacationRequestModal');
        await automateTimesheetForVacation(request); // Оновлюємо табель
    } catch (error) {
        console.error("Помилка погодження заявки:", error);
        ui.showToast("Не вдалося погодити заявку.", "error");
    } finally {
        ui.showLoading(false);
    }
}

async function denyVacationRequest(requestId) {
    if (!hasPermission('vacations_manage_requests')) {
        ui.showToast("У вас немає дозволу відхиляти заявки на відпустку.", "warning");
        return;
    }
    const request = state.vacationRequests.find(r => r.id === requestId);
    if (!request) return;
    // Проверка: только руководитель отдела сотрудника или vacations_view_all
    let isManager = false;
    if (hasPermission('vacations_view_all')) {
        isManager = true;
    } else if (hasPermission('vacations_view_department') && state.currentEmployeeData?.id) {
        const managedDepartmentIds = state.departments
            .filter(d => d.managerId === state.currentEmployeeData.id)
            .map(d => d.id);
        if (managedDepartmentIds.includes(request.departmentId)) {
            isManager = true;
        }
    }
    if (!isManager) {
        ui.showToast("Тільки керівник відділу співробітника може відхилити цю заявку.", "warning");
        return;
    }
    // Новый способ: кастомное модальное окно для комментария
    const comment = await ui.showVacationDenyCommentModal();
    if (!comment) {
        ui.showToast("Відхилення скасовано.", "info");
        return;
    }
    ui.showLoading(true);
    try {
        const requestRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "vacationRequests", requestId);
        await firebase.updateDoc(requestRef, {
            status: 'denied',
            decisionById: state.currentUserId,
            decisionByName: firebase.auth.currentUser.email, // Або ім'я користувача
            decisionAt: new Date(),
            decisionComment: comment
        });
        ui.showToast("Заявку успішно відхилено!", "success");
        ui.closeModal('vacationRequestModal');
    } catch (error) {
        console.error("Помилка відхилення заявки:", error);
        ui.showToast("Не вдалося відхилити заявку.", "error");
    } finally {
        ui.showLoading(false);
    }
}

async function cancelVacationRequest(requestId) {
    const request = state.vacationRequests.find(r => r.id === requestId);
    if (!request) return;

    if (request.submittedById !== state.currentUserId || request.status !== 'pending') {
        ui.showToast("Ви можете скасувати лише власні заявки, які ще очікують на розгляд.", "warning");
        return;
    }

    if (!await ui.showConfirmation(`Скасувати вашу заявку на відпустку з ${request.startDate.toLocaleDateString()} по ${request.endDate.toLocaleDateString()}?`)) {
        return;
    }

    ui.showLoading(true);
    try {
        const requestRef = firebase.doc(firebase.db, "companies", state.currentCompanyId, "vacationRequests", requestId);
        await firebase.deleteDoc(requestRef);
        ui.showToast("Заявку успішно скасовано!", "success");
        ui.closeModal('vacationRequestModal');
    } catch (error) {
        console.error("Помилка скасування заявки:", error);
        ui.showToast("Не вдалося скасувати заявку.", "error");
    } finally {
        ui.showLoading(false);
    }
}

// --- Навігація та показ сторінок ---
function showPageWithNavUpdate(pageId) {
    console.log('[showPageWithNavUpdate] pageId:', pageId);
    ui.showPage(pageId, state.currentUserPermissions); 
    state.lastPageId = pageId; // Запам'ятовуємо останню відкриту сторінку
    if (pageId === 'appPage' && hasPermission('timesheet_view')) {
        renderApp(); 
    } else if (pageId === 'salaryPage' && hasPermission('kpiIndividual_view_page')) {
        renderSalaryPage();
    } else if (pageId === 'massSalaryPage' && hasPermission('massSalary_view_page')) {
        initMassSalaryPage();
    } else if (pageId === 'reportsPage' && hasPermission('reports_view_page')) {
        ui.renderReportDepartmentFilter(state.departments, state.reportSelectedDepartment);
        loadAndRenderMonthlyDynamicsReport();
        setupUniversalTabs('.report-tab', '.report-tab-panel', 'active-tab', 'active', id => id.replace(/^reportTab/, 'reportTabPanel'));
    } else if (pageId === 'vacationsPage' && hasPermission('vacations_view_page')) {
        renderVacationsPage();
    } else if (pageId === 'competenciesPage' && hasPermission('competencies_view_page')) {
        // ВІДКЛЮЧЕНО: Ініціалізація сторінки компетенцій
        // updateCompetenciesData(state.departments, state.allEmployees, state.positions, state.currentCompanyId, state.currentUserId);
        console.log('Competencies page DISABLED - module has been deactivated');
    } else if (pageId === 'salesAssistantPage' && hasPermission('sales_manage')) {
        const container = document.getElementById('salesAssistantPage');
        initSalesAssistantPage(container);
        console.log('Sales Assistant page initialized');
    } else if (!state.currentCompanyId) { 
        ui.showPage('setupPage', state.currentUserPermissions);
    } else if (pageId !== 'setupPage' && pageId !== 'landingPage') {
        // Якщо запитана сторінка недоступна, спробувати перейти на першу доступну
        const firstAvailablePage = ['appPage', 'massSalaryPage', 'salaryPage', 'reportsPage', 'vacationsPage', 'competenciesPage'].find(p => {
            if (p === 'appPage') return hasPermission('timesheet_view');
            if (p === 'massSalaryPage') return hasPermission('massSalary_view_page');
            if (p === 'salaryPage') return hasPermission('kpiIndividual_view_page');
            if (p === 'reportsPage') return hasPermission('reports_view_page');
            if (p === 'vacationsPage') return hasPermission('vacations_view_page'); // Додано дозвіл для відпусток
            if (p === 'competenciesPage') return hasPermission('competencies_view_page'); // Додано дозвіл для компетенцій
            return false;
        });

        if (firstAvailablePage && pageId !== firstAvailablePage) {
            // Якщо запитана сторінка не є першою доступною, і вона недоступна, перенаправляємо
             if ((pageId === 'appPage' && !hasPermission('timesheet_view')) ||
                (pageId === 'massSalaryPage' && !hasPermission('massSalary_view_page')) ||
                (pageId === 'salaryPage' && !hasPermission('kpiIndividual_view_page')) ||
                (pageId === 'reportsPage' && !hasPermission('reports_view_page')) ||
                (pageId === 'vacationsPage' && !hasPermission('vacations_view_page')) ||
                (pageId === 'competenciesPage' && !hasPermission('competencies_view_page'))) {
                
                showPageWithNavUpdate(firstAvailablePage); // Рекурсивний виклик для переходу
                return;
            }
        } else if (!firstAvailablePage) {
             console.log("No accessible pages for current user.");
             // Можна показати повідомлення про відсутність доступу до будь-якого розділу
             if (ui.elements.appContainer) { // Перевірка існування appContainer
                ui.elements.appContainer.innerHTML = '<p class="text-center text-xl text-gray-400 p-10">У вас немає доступу до жодного розділу.</p>';
                ui.elements.appContainer.classList.remove('hidden');
                // Приховуємо інші сторінки, якщо вони були активні
                Object.values(ui.elements.pages).forEach(pageEl => {
                    if (pageEl && pageEl.id !== 'appContainer' && pageEl.classList) { // Додаткова перевірка pageEl.classList
                        pageEl.classList.add('hidden');
                        pageEl.classList.remove('active');
                    }
                });
             }
        }
    }
}


// --- ІНІЦІАЛІЗАЦІЯ ОБРОБНИКІВ ПОДІЙ ---
function initEventListeners() {
    ui.elements.startAppBtn?.addEventListener('click', () => showPageWithNavUpdate('setupPage'));
    ui.elements.createCompanyBtn?.addEventListener('click', createCompany);
    ui.elements.showCreateCompanyFormBtn?.addEventListener('click', () => ui.showCreateCompanyForm(true));
    ui.elements.cancelCreateCompanyBtn?.addEventListener('click', () => ui.showCreateCompanyForm(false));
    ui.elements.goToAppBtn?.addEventListener('click', async () => {
        if (!state.currentCompanyId) {
            ui.showToast("Будь ласка, спочатку оберіть або створіть компанію.", "warning");
            return;
        }
        ui.showLoading(true);
        await setupFirestoreListeners();
        showPageWithNavUpdate('appPage'); 
        ui.showLoading(false);
    });
    ui.elements.logoutBtnFromSetup?.addEventListener('click', () => firebase.signOut(firebase.auth));
    ui.elements.logoutBtn?.addEventListener('click', () => firebase.signOut(firebase.auth));
    ui.elements.changeCompanyBtn?.addEventListener('click', () => {
        if (state.currentUserId) {
            localStorage.removeItem('savievAppState'); // Clear saved state to force company selection
            ui.showToast("Спочатку оберіть або створіть компанію.", "warning");
            return;
        }
        ui.showToast("Спочатку оберіть або створіть компанію.", "warning");
    });

    ui.elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('[nav-btn] Клик по nav-btn:', btn.dataset.target);
            showPageWithNavUpdate(btn.dataset.target);
            if (btn.dataset.target === 'orgchartPage' && typeof initOrgChartTab === 'function') {
                console.log('[nav-btn] Вызываю initOrgChartTab после showPageWithNavUpdate');
                initOrgChartTab();
            }
        });
    });

    ui.elements.prevMonth?.addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); renderApp(); });
    ui.elements.nextMonth?.addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); renderApp(); });
    ui.elements.departmentFilter?.addEventListener('change', renderApp);
    ui.elements.employeeFilter?.addEventListener('input', renderApp);
    ui.elements.showArchived?.addEventListener('change', renderApp);
    ui.elements.workNormInput?.addEventListener('change', (e) => { state.globalWorkNorm = parseInt(e.target.value, 10); updateMainConfig('workNorm', state.globalWorkNorm); renderApp(); });
    ui.elements.normTypeToggle?.addEventListener('change', (e) => { state.normType = e.target.checked ? 'schedule' : 'global'; updateMainConfig('normType', state.normType); updateNormTypeUI(); renderApp(); });
    ui.elements.clearMonthData?.addEventListener('click', onClearMonthData);
    ui.elements.resetFilters?.addEventListener('click', () => { ui.elements.departmentFilter.value = ''; ui.elements.employeeFilter.value = ''; ui.elements.showArchived.checked = false; renderApp(); });
    ui.elements.openExportModalBtn?.addEventListener('click', () => { if(hasPermission('timesheet_export')) { ui.setExportDates(new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1), new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0)); ui.renderEmployeeSelect(ui.elements.exportEmployeeFilter, state.allEmployees, ui.elements.exportDepartmentFilter.value); ui.openModal('exportModal'); }});
    ui.elements.exportDepartmentFilter?.addEventListener('change', () => ui.renderEmployeeSelect(ui.elements.exportEmployeeFilter, state.allEmployees, ui.elements.exportDepartmentFilter.value));
    ui.elements.generateExportBtn?.addEventListener('click', generateExcelExport);
    ui.elements.clearCellDataBtn?.addEventListener('click', clearCellData);

    ui.elements.saveEmployeeBtn?.addEventListener('click', onSaveEmployee);
    ui.elements.openAddEmployeeModalBtn?.addEventListener('click', onAddEmployee);
    ui.elements.avatarUploadInput?.addEventListener('change', ui.previewAvatar);
    ui.elements.uploadAvatarBtn?.addEventListener('click', () => ui.elements.avatarUploadInput.click());
    ui.elements.saveDepartmentBtn?.addEventListener('click', onSaveDepartment);
    ui.elements.openAddDepartmentModalBtn?.addEventListener('click', onAddDepartment);
    ui.elements.savePositionBtn?.addEventListener('click', onSavePosition);
    ui.elements.openAddPositionModalBtn?.addEventListener('click', onAddPosition);
    ui.elements.saveScheduleBtn?.addEventListener('click', onSaveSchedule);

    ui.elements.addUserBtn?.addEventListener('click', addUser);
    ui.elements.copyOwnerPermissionsBtn?.addEventListener('click', copyOwnerPermissions);
    ui.elements.copyPermissionsUserSelect?.addEventListener('change', () => {
        const selectedUserId = ui.elements.copyPermissionsUserSelect.value;
        ui.elements.copyOwnerPermissionsBtn.disabled = !selectedUserId;
        
        // Показуємо права обраного користувача
        if (selectedUserId) {
            const selectedUser = state.members?.find(m => m.id === selectedUserId);
            if (selectedUser) {
                ui.renderSelectedUserPermissions(selectedUser, state.availableRoles);
            }
        } else {
            // Приховуємо інформацію про права, якщо користувач не обраний
            ui.elements.selectedUserPermissionsInfo?.classList.add('hidden');
        }
    });
    ui.elements.addNewRoleBtn?.addEventListener('click', onAddNewRole);
    ui.elements.saveRoleBtn?.addEventListener('click', onSaveRole);
    ui.elements.deleteRoleBtn?.addEventListener('click', onDeleteRole);

    ui.elements.kpiPositionSelect?.addEventListener('change', handleKpiPositionChange);
    ui.elements.kpiPrevMonth?.addEventListener('click', () => { state.kpiCurrentDate.setMonth(state.kpiCurrentDate.getMonth() - 1); loadKpiSettings(ui.elements.kpiPositionSelect.value, state.kpiCurrentDate.getFullYear(), state.kpiCurrentDate.getMonth()); });
    ui.elements.kpiNextMonth?.addEventListener('click', () => { state.kpiCurrentDate.setMonth(state.kpiCurrentDate.getMonth() + 1); loadKpiSettings(ui.elements.kpiPositionSelect.value, state.kpiCurrentDate.getFullYear(), state.kpiCurrentDate.getMonth()); });
    ui.elements.addKpiCategoryBtn?.addEventListener('click', () => ui.addKpiCategory(hasPermission('settings_kpi_constructor_manage')));
    ui.elements.addBonusBtn?.addEventListener('click', () => ui.addBonus(hasPermission('settings_kpi_constructor_manage')));
    ui.elements.saveKpiSettingsBtn?.addEventListener('click', saveKpiSettings);
    ui.elements.copyKpiBtn?.addEventListener('click', copyKpiSettings);
    
    ui.elements.kpiEmployeeSelectSalary?.addEventListener('change', handleSalaryEmployeeChange);
    ui.elements.kpiPrevMonthSalary?.addEventListener('click', () => { state.salaryKpiCurrentDate.setMonth(state.salaryKpiCurrentDate.getMonth() - 1); renderSalaryPage(); });
    ui.elements.kpiNextMonthSalary?.addEventListener('click', () => { state.salaryKpiCurrentDate.setMonth(state.salaryKpiCurrentDate.getMonth() + 1); renderSalaryPage(); });
    ui.elements.loadKpiActualsBtn?.addEventListener('click', () => loadKpiSettingsForSalaryCalculation(state.allEmployees.find(e => e.id === state.currentSelectedSalaryEmployeeId)?.positionId, state.salaryKpiCurrentDate.getFullYear(), state.salaryKpiCurrentDate.getMonth()));
    ui.elements.calculateSalaryBtn?.addEventListener('click', calculateSalary);
    ui.elements.saveKpiActualsBtn?.addEventListener('click', saveKpiActuals);

    ui.elements.massSalaryPrevMonth?.addEventListener('click', () => { state.massSalaryCurrentDate.setMonth(state.massSalaryCurrentDate.getMonth() - 1); initMassSalaryPage(); });
    ui.elements.massSalaryNextMonth?.addEventListener('click', () => { state.massSalaryCurrentDate.setMonth(state.massSalaryCurrentDate.getMonth() + 1); initMassSalaryPage(); });
    ui.elements.massSalaryDepartmentFilter?.addEventListener('change', () => { ui.elements.massSalaryTableContainer.innerHTML = ''; ui.elements.massSalaryFooterActions.classList.add('hidden'); }); 
    ui.elements.generateMassSalaryTableBtn?.addEventListener('click', generateMassSalaryView);
    ui.elements.calculateAllSalariesBtn?.addEventListener('click', calculateAllSalaries);
    ui.elements.exportAllSalariesBtn?.addEventListener('click', exportAllSalaries);
    ui.elements.saveMassSalaryBtn?.addEventListener('click', saveMassSalarySnapshot);

    ui.elements.reportDepartmentFilter?.addEventListener('change', loadAndRenderMonthlyDynamicsReport);

    // Обробники для модуля відпусток
    ui.elements.createVacationRequestBtn?.addEventListener('click', openCreateVacationModal);
    ui.elements.submitVacationRequestBtn?.addEventListener('click', handleVacationRequestSubmit);

    // Обробники для сповіщень
    ui.elements.notificationsBellBtn?.addEventListener('click', ui.toggleNotificationsDropdown);
    // Закриваємо випадаюче меню при кліку поза ним
    document.addEventListener('click', (event) => { if (ui.elements.notificationsDropdown && !ui.elements.notificationsDropdown.contains(event.target) && !ui.elements.notificationsBellBtn.contains(event.target)) { ui.elements.notificationsDropdown.classList.add('hidden'); } });

    ui.elements.settingsMenuBtn?.addEventListener('click', () => {
        if (!state.initialLoadCompleted) {
            ui.showToast("Дані ще завантажуються. Спробуйте через кілька секунд.", "info");
            return;
        }
        ui.openSettingsWindow(state.currentUserPermissions);
    }); 
    window.addEventListener('beforeunload', saveAppState); // Зберігаємо стан перед закриттям/оновленням сторінки

    document.querySelectorAll('[data-modal-target]').forEach(button => {
        button.addEventListener('click', () => {
            const targetModalId = button.dataset.modalTarget;
            const initFuncStr = button.dataset.initFunc;
            
            if (targetModalId === 'employeeManagerModal' && !hasPermission('settings_employees_manage')) return ui.showToast("Немає доступу.", "warning");
            if (targetModalId === 'departmentManagerModal' && !hasPermission('settings_departments_manage')) return ui.showToast("Немає доступу.", "warning");
            if (targetModalId === 'scheduleManagerModal' && !hasPermission('settings_schedules_manage')) return ui.showToast("Немає доступу.", "warning");
            if (targetModalId === 'positionManagerModal' && !hasPermission('settings_positions_manage')) return ui.showToast("Немає доступу.", "warning");
            if (targetModalId === 'userAccessModal' && !hasPermission('settings_users_access_manage')) return ui.showToast("Немає доступу.", "warning");
            if (targetModalId === 'rolesManagerModal' && !hasPermission('settings_roles_manage')) return ui.showToast("Немає доступу.", "warning");
            if (targetModalId === 'kpiManagerModal' && !hasPermission('settings_kpi_constructor_manage')) return ui.showToast("Немає доступу.", "warning");


            if (initFuncStr) {
                const initFunc = window[initFuncStr] || eval(initFuncStr); 
                if (typeof initFunc === 'function') {
                    initFunc(); 
                } else {
                    console.warn(`Init function '${initFuncStr}' not found or not a function.`);
                }
            }
            ui.openModal(targetModalId);
        });
    });

    ui.elements.copyPermissionsRoleSelect?.addEventListener('change', () => {
        const selectedRoleId = ui.elements.copyPermissionsRoleSelect.value;
        ui.elements.copyOwnerPermissionsBtn.disabled = !selectedRoleId;
        
        // Показуємо права обраної ролі
        if (selectedRoleId) {
            const selectedRole = state.availableRoles?.find(r => r.id === selectedRoleId);
            if (selectedRole) {
                ui.renderSelectedRolePermissions(selectedRole, ui.ALL_POSSIBLE_PERMISSIONS);
            }
        } else {
            // Приховуємо інформацію про права, якщо роль не обрана
            ui.elements.selectedRolePermissionsInfo?.classList.add('hidden');
        }
    });
}
window.setupScheduleManager = setupScheduleManager; 
window.setupUserAccessManager = setupUserAccessManager;
window.onAddDepartment = onAddDepartment; // Додаємо, щоб можна було викликати з HTML
window.openRolesManager = openRolesManager;


// --- ІНІЦІАЛІЗАЦІЯ ДОДАТКУ ---
function init() {
    ui.initializeDOMElements(); // Ініціалізуємо посилання на DOM-елементи
    auth.initAuthListener(handleUserLogin, handleUserLogout); // Ініціалізуємо слухача авторизації
    initEventListeners(); // Ініціалізуємо всі інші обробники подій
    // initCompetenciesModule(); // ВІДКЛЮЧЕНО: Ініціалізуємо модуль компетенцій

    let stateRestored = loadAppState(); // Спробувати відновити стан

    // Перевіряємо, чи є вже активний користувач (наприклад, після перезавантаження)
    // Ця логіка тепер інтегрована з відновленням стану
    // onAuthStateChanged (в auth.js) викличе handleUserLogin або handleUserLogout
}

// === ІНІЦІАЛІЗАЦІЯ ДОДАТКУ ===
document.addEventListener('DOMContentLoaded', () => {
    showGlobalLoader();
    ui.initializeDOMElements(); // Ініціалізуємо посилання на DOM-елементи
    auth.initAuthListener(handleUserLogin, handleUserLogout); // Ініціалізуємо слухача авторизації
    initEventListeners(); // Ініціалізуємо всі інші обробники подій
    // initCompetenciesModule(); // ВІДКЛЮЧЕНО: Ініціалізуємо модуль компетенцій

    let stateRestored = loadAppState(); // Спробувати відновити стан

    if (!firebase.auth.currentUser) {
        ui.showPage('landingPage');
        ui.showAuthForm(true);
        hideGlobalLoader();
    }
    setupSalesModalHandlers();
});
// Додаємо функції, які викликаються з HTML, в глобальний window
window.openKpiConstructorWrapper = () => { // Для кнопки Налаштувань
    openKpiConstructor();
    ui.openModal('kpiManagerModal');
};

// Ці функції вже додаються в initEventListeners, але якщо вони викликаються напряму з HTML
// без data-init-func, то їх потрібно експортувати або додати до window.
// Оскільки вони вже використовуються через data-init-func, цей блок можна було б прибрати,
// але для безпеки залишаємо, якщо є прямі виклики в HTML.
window.setupScheduleManager = setupScheduleManager;
window.setupUserAccessManager = setupUserAccessManager;
window.openRolesManager = openRolesManager;

console.log("main.js завантажено та виконано");

// window.updateCompetenciesData = updateCompetenciesData; // ВІДКЛЮЧЕНО

// ВІДКЛЮЧЕНО: Глобальна функція для тестування модуля компетенцій
/*
window.testCompetenciesModule = () => {
    console.log('Тестування модуля компетенцій...');
    console.log('Поточний стан:', {
        departments: state.departments?.length || 0,
        employees: state.allEmployees?.length || 0,
        positions: state.positions?.length || 0,
        companyId: state.currentCompanyId,
        userId: state.currentUserId
    });
    
    // updateCompetenciesData(state.departments, state.allEmployees, state.positions, state.currentCompanyId, state.currentUserId);
    
    // Перевіряємо чи існують елементи на сторінці компетенцій
    const competenciesPage = document.getElementById('competenciesPage');
    if (competenciesPage) {
        console.log('Сторінка компетенцій знайдена');
        competenciesPage.classList.remove('hidden');
        competenciesPage.classList.add('active');
        
        // Перевіряємо селектори
        const departmentSelector = document.getElementById('departmentSelector');
        const employeeSelector = document.getElementById('employeeSelector');
        
        console.log('Селектори:', {
            departmentSelector: !!departmentSelector,
            employeeSelector: !!employeeSelector
        });
        
        if (departmentSelector) {
            console.log('Відділи в селекторі:', departmentSelector.options.length);
        }
        
        if (employeeSelector) {
            console.log('Співробітники в селекторі:', employeeSelector.options.length);
        }
    } else {
        console.log('Сторінка компетенцій не знайдена');
    }
};
*/

// === Универсальное переключение вкладок ===
const tabIds = ['mainTab-assessment', 'mainTab-history', 'mainTab-reports', 'mainTab-settings'];
const panelIds = ['mainPanel-assessment', 'mainPanel-history', 'mainPanel-reports', 'mainPanel-settings'];

window.orgChartInitialized = false;

function hideAllPanels() {
  console.log('[main.js] hideAllPanels');
  panelIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      console.log(`[main.js] Скрываю панель: ${id}`);
      // Удаляю очистку mainPanel-orgchart
    }
  });
  document.querySelectorAll('.main-tab-panel').forEach(panel => {
    panel.style.display = 'none';
  });
}

function showPanel(idx) {
  const el = document.getElementById(panelIds[idx]);
  if (el) {
    el.style.display = '';
    console.log(`[main.js] Показываю панель: ${panelIds[idx]}`);
  }
}

tabIds.forEach((tabId, idx) => {
  const tab = document.getElementById(tabId);
  if (tab) {
    tab.onclick = () => {
      console.log(`[main.js] Клик по вкладке: ${tabId}`);
      tabIds.forEach((t, i) => {
        const tabEl = document.getElementById(t);
        if (tabEl) tabEl.classList.toggle('active', i === idx);
      });
      hideAllPanels();
      showPanel(idx);
      // Для отладки: всегда вызываем инициализацию оргструктуры при показе панели
      if (tabId === 'mainTab-orgchart') {
        console.log('[main.js] Принудительный вызов initOrgChartTab (отладка)');
        if (typeof initOrgChartTab === 'function') {
          initOrgChartTab();
        } else {
          console.warn('[main.js] initOrgChartTab не определена!');
        }
      }
    };
  }
});

// === Инициализация вкладки оргструктуры ===
function initOrgChartTab() {
  console.log('[initOrgChartTab] Вызов initOrgChartTab');
  if (typeof initOrgChartModule === 'function') {
    const container = document.getElementById('org-chart-container');
    console.log('[initOrgChartTab] Вызов initOrgChartModule, контейнер:', container, 'container?.parentElement:', container?.parentElement);
    initOrgChartModule(container, {}, {});
  } else {
    const container = document.getElementById('org-chart-container');
    if (container) container.innerHTML = '<div style="color:red;">Модуль оргструктуры не найден</div>';
    console.warn('[initOrgChartTab] initOrgChartModule не определена!');
  }
}

// --- ДОДАТКОВА ЛОГІКА АВТОВХОДУ ТА ВІДНОВЛЕННЯ ВКЛАДКИ ---
function tryAutoSelectCompanyAndPage() {
    const savedState = localStorage.getItem('savievAppState');
    if (!savedState) return;
    const parsedState = JSON.parse(savedState);
    if (parsedState.currentCompanyId && firebase.auth.currentUser) {
        // Викликаємо вибір компанії і після завантаження — перехід на вкладку
        selectCompany(parsedState.currentCompanyId, parsedState.currentCompanyName).then(async () => {
            await setupFirestoreListeners();
            if (parsedState.lastPageId) {
                showPageWithNavUpdate(parsedState.lastPageId);
            } else {
                showPageWithNavUpdate('appPage');
            }
        });
    }
}

function showGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';
}
function hideGlobalLoader() {
    setTimeout(() => {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    }, 1000); // Мінімум 1 секунда для тесту
}

function setupSalesModalHandlers() {
  const openBtn = document.getElementById('openAddSalesModalBtn');
  const closeBtn = document.getElementById('closeAddSalesModal');
  const deptSelect = document.getElementById('salesDepartmentSelect');
  const monthInput = document.getElementById('salesMonthSelect');
  const saveBtn = document.getElementById('saveSalesBtn');

  if (!openBtn || !closeBtn || !deptSelect || !monthInput || !saveBtn) return;

  openBtn.onclick = async () => {
    // Заповнити селектор відділів
    deptSelect.innerHTML = '';
    state.departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept.id;
      opt.textContent = dept.name;
      deptSelect.appendChild(opt);
    });
    // Встановити поточний місяць
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Показати співробітників першого відділу
    const deptId = deptSelect.value;
    const employees = state.allEmployees.filter(e => e.department === deptId);
    const monthKey = monthInput.value.replace('-', '');
    const salesData = await loadSalesData(monthKey);
    openAddSalesModal(employees, salesData);
  };
  closeBtn.onclick = () => closeAddSalesModal();
  deptSelect.onchange = async () => {
    const deptId = deptSelect.value;
    const employees = state.allEmployees.filter(e => e.department === deptId);
    const monthKey = monthInput.value.replace('-', '');
    const salesData = await loadSalesData(monthKey);
    renderSalesEmployeesTable(employees, salesData);
  };
  monthInput.onchange = async () => {
    const deptId = deptSelect.value;
    const employees = state.allEmployees.filter(e => e.department === deptId);
    const monthKey = monthInput.value.replace('-', '');
    const salesData = await loadSalesData(monthKey);
    renderSalesEmployeesTable(employees, salesData);
  };
  saveBtn.onclick = async () => {
    const deptId = deptSelect.value;
    const month = monthInput.value;
    if (!month) return alert('Оберіть місяць!');
    const salesData = getSalesDataFromModal();
    await saveSalesData(month, salesData);
    closeAddSalesModal();
    alert('Продажі збережено!');
  };
}

async function saveSalesData(month, salesData) {
  if (!state.currentCompanyId) return;
  const monthKey = month.replace('-', '');
  const docRef = firebase.doc(firebase.db, 'companies', state.currentCompanyId, 'sales', monthKey);
  await firebase.setDoc(docRef, { month: monthKey, sales: salesData, updatedAt: new Date() });
}

async function loadSalesData(monthKey) {
  if (!state.currentCompanyId) return [];
  const docRef = firebase.doc(firebase.db, 'companies', state.currentCompanyId, 'sales', monthKey);
  const docSnap = await firebase.getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().sales || [];
  }
  return [];
}

function setupReportsPage() {
  setupUniversalTabs('.report-tab', '.report-tab-panel', 'active-tab', 'active', id => id.replace(/^reportTab/, 'reportTabPanel'));
  // ... інша ініціалізація звітів ...
}

// ... існуючий код ...
// Викликати setupReportsPage при завантаженні сторінки звітів
if (document.getElementById('reportsPage')) {
  setupReportsPage();
}
// ... існуючий код ...
// Видалити дублюючий виклик renderDepartmentReport при кліку на вкладку
// ... існуючий код ...

// === ИНИЦИАЛИЗАЦИЯ SALES ASSISTANT PAGE ===
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('salesAssistantPage');
  if (container && typeof initSalesAssistantPage === 'function') {
    initSalesAssistantPage(container);
  }
});

// --- Універсальна функція для завантаження справочника "код клієнта — менеджер" ---
export async function loadClientManagerDirectory() {
  if (window._clientManagerDirectory) return window._clientManagerDirectory;
  const res = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
  const arr = await res.json();
  // Формуємо об'єкт: { [код клієнта]: { manager, link } }
  const directory = {};
  arr.forEach(item => {
    const code = item['Клиент.Код'] || item['Клієнт.Код'];
    if (code) {
      directory[code] = {
        manager: item['Менеджер'],
        link: item['посилання']
      };
    }
  });
  window._clientManagerDirectory = directory;
  return directory;
}

