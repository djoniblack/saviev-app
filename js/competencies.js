import * as firebase from './firebase.js';
import * as ui from './ui.js';

// Глобальні змінні для модуля компетенцій      
let radarChart, barChart, animationFrameId;
let currentCompetencyData = {};
let competenciesModels = [];    
let currentCompanyId = null;
let currentUserId = null;
let allEmployees = [];
let allDepartments = [];
let allPositions = [];

// Структура даних для оцінок компетенцій
let competencyAssessments = {};

// Стан ініціалізації модуля
let isModuleInitialized = false;
let isDataLoaded = false;

// Функції для переключення вкладок
export function switchCompetencyTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`panel-${tabId}`).classList.add('active');
    
    if (tabId === 'reports') {
        renderReportsTab();
    } else if (tabId === 'settings') {
        renderSettingsTab();
    }
}

// Ініціалізація модуля з реальними даними
export async function initCompetenciesModule() {
    // --- NEW: Запобігаємо повторній ініціалізації ---
    if (isModuleInitialized) {
        console.log('Модуль компетенцій вже ініціалізовано.');
        // Можливо, тут варто просто оновити дані, якщо це необхідно
        updateCompetenciesData();
        return;
    }
    console.log('Ініціалізація модуля компетенцій...');
    
    // Отримуємо поточну компанію та користувача з main.js
    currentCompanyId = window.state?.currentCompanyId;
    currentUserId = window.state?.currentUserId;
    
    if (!currentCompanyId) {
        console.log('Компанія не обрана для модуля компетенцій, очікуємо...');
        return;
    }

    // Перевіряємо чи завантажені основні дані
    if (allDepartments.length === 0 || allEmployees.length === 0 || allPositions.length === 0) {
        console.log('Основні дані ще не завантажені, очікуємо...');
        // Встановлюємо слухач для очікування завантаження даних
        waitForDataAndInit();
        return;
    }

    // Завантажуємо дані компетенцій
    await loadCompetenciesData();
    
    // Ініціалізуємо селектори
    populatePeriodSelector();
    populateDepartments();
    
    // Додаємо обробники подій
    setupEventListeners();
    
    // Рендеримо початкові вкладки
    renderSettingsTab();
    
    isModuleInitialized = true;
    isDataLoaded = true;
    console.log('Модуль компетенцій успішно ініціалізовано');
}

// Функція очікування завантаження даних
function waitForDataAndInit() {
    const checkData = () => {
        if (allDepartments.length > 0 && allEmployees.length > 0 && allPositions.length > 0) {
            console.log('Дані завантажені, ініціалізуємо модуль компетенцій...');
            initCompetenciesModule();
        } else {
            setTimeout(checkData, 500); // Перевіряємо кожні 500мс
        }
    };
    checkData();
}

// Функція оновлення даних модуля (викликається при зміні даних в main.js)
export function updateCompetenciesData(departments = null, employees = null, positions = null, companyId = null, userId = null) {
    console.log('Оновлення даних модуля компетенцій...', { departments, employees, positions, companyId, userId });
    
    // Оновлюємо локальні копії даних
    if (departments) allDepartments = departments;
    if (employees) allEmployees = employees;
    if (positions) allPositions = positions;
    if (companyId) currentCompanyId = companyId;
    if (userId) currentUserId = userId;
    
    // Якщо дані передані з main.js, використовуємо їх
    if (!departments && window.state?.departments) allDepartments = window.state.departments;
    if (!employees && window.state?.allEmployees) allEmployees = window.state.allEmployees;
    if (!positions && window.state?.positions) allPositions = window.state.positions;
    if (!companyId && window.state?.currentCompanyId) currentCompanyId = window.state.currentCompanyId;
    if (!userId && window.state?.currentUserId) currentUserId = window.state.currentUserId;
    
    console.log('Оновлені дані:', {
        departments: allDepartments.length,
        employees: allEmployees.length,
        positions: allPositions.length,
        companyId: currentCompanyId,
        userId: currentUserId
    });
    
    // Оновлюємо селектори
    populateDepartments();
    
    // Оновлюємо поточну сторінку якщо вона активна
    const competenciesPage = document.getElementById('competenciesPage');
    if (competenciesPage && !competenciesPage.classList.contains('hidden')) {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabId = activeTab.id.replace('tab-', '');
            if (tabId === 'reports') {
                renderReportsTab();
            } else if (tabId === 'settings') {
                renderSettingsTab();
            }
        }
        
        // Оновлюємо поточну оцінку якщо співробітник обраний
        const employeeSelector = document.getElementById('employeeSelector');
        if (employeeSelector && employeeSelector.value) {
            showAssessmentFor(employeeSelector.value);
        }
    }
}

// Завантаження даних компетенцій
async function loadCompetenciesData() {
    try {
        ui.showLoading(true);
        
        // Завантажуємо моделі компетенцій
        await loadCompetencyModels();
        
        // Завантажуємо оцінки
        await loadCompetencyAssessments();
        
        console.log('Дані компетенцій завантажено:', {
            models: competenciesModels.length,
            assessments: Object.keys(competencyAssessments).length
        });
        
    } catch (error) {
        console.error('Помилка завантаження даних компетенцій:', error);
        ui.showToast('Помилка завантаження даних компетенцій', 'error');
    } finally {
        ui.showLoading(false);
    }
}

// Завантаження моделей компетенцій
async function loadCompetencyModels() {
    try {
        const modelsRef = firebase.collection(firebase.db, "companies", currentCompanyId, "competencyModels");
        const snapshot = await firebase.getDocs(modelsRef);
        
        competenciesModels = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('ЗАВАНТАЖЕНО КОМПЕТЕНЦІЇ:', competenciesModels);
        
        // Якщо моделей немає, створюємо базові
        if (competenciesModels.length === 0) {
            await createDefaultCompetencyModels();
        }
        
    } catch (error) {
        console.error('Помилка завантаження моделей компетенцій:', error);
        // Створюємо базові моделі якщо не вдалося завантажити
        await createDefaultCompetencyModels();
    }
}

// Створення базових моделей компетенцій
async function createDefaultCompetencyModels() {
    const defaultModels = [
        {
            name: 'Лідерство',
            category: 'Управлінські',
            description: 'Здатність вести за собою команду, мотивувати та досягати поставлених цілей.',
            indicators: ['Бере на себе відповідальність за результат', 'Ефективно делегує завдання', 'Мотивує команду'],
            departmentIds: [], // Для всіх відділів
            createdBy: currentUserId,
            createdAt: new Date()
        },
        {
            name: 'Стратегічне мислення',
            category: 'Управлінські',
            description: 'Бачення загальної картини та довгострокове планування.',
            indicators: ['Аналізує ринок та конкурентів', 'Планує довгострокові цілі', 'Приймає стратегічні рішення'],
            departmentIds: [],
            createdBy: currentUserId,
            createdAt: new Date()
        },
        {
            name: 'Комунікація',
            category: 'Особистісні',
            description: 'Ефективна передача інформації та активне слухання.',
            indicators: ['Чітко висловлює думки', 'Активно слухає', 'Ефективно презентує ідеї'],
            departmentIds: [],
            createdBy: currentUserId,
            createdAt: new Date()
        },
        {
            name: 'Технічна експертиза',
            category: 'Професійні',
            description: 'Глибокі знання у своїй галузі.',
            indicators: ['Знає сучасні технології', 'Швидко навчається новому', 'Вирішує складні технічні задачі'],
            departmentIds: [],
            createdBy: currentUserId,
            createdAt: new Date()
        },
        {
            name: 'Тайм-менеджмент',
            category: 'Особистісні',
            description: 'Ефективне планування та використання часу.',
            indicators: ['Планує свій час', 'Дотримується дедлайнів', 'Пріоритизує завдання'],
            departmentIds: [],
            createdBy: currentUserId,
            createdAt: new Date()
        },
        {
            name: 'Робота в команді',
            category: 'Особистісні',
            description: 'Здатність ефективно працювати в команді.',
            indicators: ['Підтримує колег', 'Ділиться знаннями', 'Конструктивно вирішує конфлікти'],
            departmentIds: [],
            createdBy: currentUserId,
            createdAt: new Date()
        }
    ];

    try {
        const batch = firebase.writeBatch(firebase.db);
        const modelsRef = firebase.collection(firebase.db, "companies", currentCompanyId, "competencyModels");
        
        defaultModels.forEach(model => {
            const docRef = firebase.doc(modelsRef);
            batch.set(docRef, model);
        });
        
        await batch.commit();
        
        // Оновлюємо локальний масив
        competenciesModels = defaultModels.map((model, index) => ({
            id: `default_${index}`,
            ...model
        }));
        
        ui.showToast('Створено базові моделі компетенцій', 'success');
        
    } catch (error) {
        console.error('Помилка створення базових моделей:', error);
        ui.showToast('Помилка створення базових моделей', 'error');
    }
}

// Завантаження оцінок компетенцій
async function loadCompetencyAssessments() {
    try {
        const assessmentsRef = firebase.collection(firebase.db, "companies", currentCompanyId, "competencyAssessments");
        const snapshot = await firebase.getDocs(assessmentsRef);
        
        competencyAssessments = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const key = `${data.employeeId}_${data.period}`;
            competencyAssessments[key] = {
                id: doc.id,
                ...data
            };
        });
        
    } catch (error) {
        console.error('Помилка завантаження оцінок:', error);
        competencyAssessments = {};
    }
}

// Заповнення селектора періодів
function populatePeriodSelector() {
    const periodSelector = document.getElementById('periodSelector');
    if (!periodSelector) return;
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    periodSelector.innerHTML = '';
    
    // Генеруємо періоди за останні 2 роки
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
        for (let month = 0; month < 12; month++) {
            const date = new Date(year, month, 1);
            const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            const periodLabel = date.toLocaleDateString('uk-UA', { 
                year: 'numeric', 
                month: 'long' 
            });
            
            const option = document.createElement('option');
            option.value = periodKey;
            option.textContent = periodLabel;
            
            // Встановлюємо поточний місяць як обраний за замовчуванням
            if (year === currentYear && month === currentMonth) {
                option.selected = true;
            }
            
            periodSelector.appendChild(option);
        }
    }
}

// Функції для вкладки оцінки
export function populateDepartments() {
    console.log('Заповнення селекторів відділів:', {
        departments: allDepartments.length,
        employees: allEmployees.length,
        positions: allPositions.length
    });
    
    const departmentSelector = document.getElementById('departmentSelector');
    const reportDeptSelector = document.getElementById('reportDeptSelector');
    
    // Перевіряємо, чи існують селектори, перш ніж їх заповнювати
    if (departmentSelector) {
        const currentValue = departmentSelector.value;
        departmentSelector.innerHTML = '<option value="">-- Оберіть відділ --</option>';
        allDepartments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            departmentSelector.appendChild(option);
        });
        if (currentValue && allDepartments.find(d => d.id === currentValue)) {
            departmentSelector.value = currentValue;
        }
    } else {
        console.warn('Селектор departmentSelector не знайдено.');
    }

    if (reportDeptSelector) {
        const currentValue = reportDeptSelector.value;
        reportDeptSelector.innerHTML = '<option value="all">Всі відділи</option>';
        allDepartments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            reportDeptSelector.appendChild(option);
        });
        if (currentValue && (currentValue === 'all' || allDepartments.find(d => d.id === currentValue))) {
            reportDeptSelector.value = currentValue;
        }
    } else {
        console.warn('Селектор reportDeptSelector не знайдено.');
    }
    
    // Оновлюємо список співробітників якщо відділ вже обраний
    if (departmentSelector && departmentSelector.value) {
        populateEmployees(departmentSelector.value);
    }
}

export function populateEmployees(departmentId) {
    const employeeSelector = document.getElementById('employeeSelector');
    if (!employeeSelector) return;
    employeeSelector.innerHTML = '<option value="">-- Оберіть співробітника --</option>';
    // Гарантовано фільтруємо від allEmployees
    const filteredEmployees = departmentId
        ? allEmployees.filter(emp => emp.department === departmentId)
        : allEmployees;
    filteredEmployees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.name;
            employeeSelector.appendChild(option);
        });
    employeeSelector.disabled = filteredEmployees.length === 0;
}

export function showAssessmentFor(employeeId) {
    console.log('=== showAssessmentFor ===', employeeId);
    const assessmentContentEl = document.getElementById('assessmentContent');
    const placeholderEl = document.getElementById('placeholder');
    const periodSelector = document.getElementById('periodSelector');
    
    console.log('Показ оцінки для співробітника:', employeeId);
    
    if (!employeeId) {
        if (assessmentContentEl) assessmentContentEl.classList.remove('visible');
        if (placeholderEl) placeholderEl.style.display = 'block';
        return;
    }
    
    const period = periodSelector?.value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    if (placeholderEl) placeholderEl.style.display = 'none';
    if (assessmentContentEl) assessmentContentEl.classList.add('visible');
    
    const employee = allEmployees.find(e => e.id === employeeId);
    const position = allPositions.find(p => p.id === employee?.positionId);
    const department = allDepartments.find(d => d.id === employee?.department);
    
    if (!employee) {
        console.warn('Співробітник не знайдений:', employeeId);
        return;
    }
    
    console.log('Дані співробітника:', { employee, position, department });
    
    // Встановлюємо фото співробітника
    const photoEl = document.getElementById('employeePhoto');
    if (photoEl) {
        photoEl.src = employee.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name)}&background=4F46E5&color=fff&size=80`;
    }
    
    const nameEl = document.getElementById('employeeName');
    if (nameEl) nameEl.textContent = employee.name;
    
    const positionEl = document.getElementById('employeePosition');
    if (positionEl) positionEl.textContent = position?.name || 'Посада не вказана';
    
    const deptEl = document.getElementById('employeeDepartment');
    if (deptEl) deptEl.textContent = department?.name || employee.departmentName || 'Без відділу';
    
    // Завантажуємо або створюємо оцінки для цього співробітника
    loadOrCreateAssessment(employeeId, period);
}

// Завантаження або створення оцінки
async function loadOrCreateAssessment(employeeId, period) {
    const assessmentKey = `${employeeId}_${period}`;
    let assessment = competencyAssessments[assessmentKey];
    console.log('Завантаження/створення оцінки:', { assessmentKey, existingAssessment: !!assessment });
    if (!assessment) {
        // Створюємо нову оцінку з snapshot компетенцій
        assessment = {
            employeeId,
            period,
            scores: competenciesModels.map(model => ({
                competencyId: model.id,
                name: model.name,
                description: model.description || '',
                category: model.category || '',
                growthAssistantComment: model.growthAssistantComment || '',
                growthAssistantThreshold: model.growthAssistantThreshold ?? 4,
                score: 3 // Середня оцінка за замовчуванням
            })),
            overallComment: '',
            assessedBy: currentUserId,
            assessedAt: new Date()
        };
        console.log('Створена нова оцінка:', assessment);
        // Зберігаємо в Firebase
        try {
            const assessmentRef = firebase.collection(firebase.db, "companies", currentCompanyId, "competencyAssessments");
            const docRef = await firebase.addDoc(assessmentRef, assessment);
            assessment.id = docRef.id;
            competencyAssessments[assessmentKey] = assessment;
            console.log('Оцінка збережена в Firebase з ID:', docRef.id);
        } catch (error) {
            console.error('Помилка створення оцінки:', error);
            ui.showToast('Помилка створення оцінки', 'error');
            return;
        }
    }
    // --- БІЛЬШ НЕ СИНХРОНІЗУЄМО ДЛЯ ІСТОРІЇ ---
    // Рендеримо оцінки (завжди тільки ті, що у scores)
    renderCompetencyList(assessment.scores, assessmentKey, true);
    renderRadarChart(assessment.scores);
    // Встановлюємо загальний коментар
    const commentEl = document.getElementById('overallComment');
    if (commentEl) {
        commentEl.value = assessment.overallComment || '';
    }
}

function renderCompetencyList(scores, assessmentKey, isAssessmentSaved = false) {
    const listEl = document.getElementById('competencyList');
    if (!listEl) {
        console.warn('Елемент списку компетенцій не знайдено');
        return;
    }
    console.log('=== ПОЧАТОК renderCompetencyList ===');
    console.log('scores:', scores);
    console.log('assessmentKey:', assessmentKey);
    listEl.innerHTML = '';
    scores.forEach((comp, index) => {
        const div = document.createElement('div');
        div.className = 'py-2';
        // Кнопка тільки якщо оцінка збережена і бал <= порогу з snapshot
        const threshold = comp.growthAssistantThreshold ?? 4;
        const assistantButton = isAssessmentSaved && comp.score <= threshold ?
            `<button class="growth-assistant-btn text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors" data-competency-index="${index}">Допомогти зрости</button>` : '';
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <label class="font-semibold text-white">${comp.name}</label>
                <div class="flex items-center gap-4">
                    ${assistantButton}
                    <span id="score-label-${index}" class="text-lg font-bold text-indigo-400">${comp.score} / 5</span>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-gray-500">1</span>
                <input id="score-slider-${index}" type="range" min="1" max="5" value="${comp.score}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                <span class="text-gray-500">5</span>
            </div>
        `;
        listEl.appendChild(div);
        const slider = document.getElementById(`score-slider-${index}`);
        const label = document.getElementById(`score-label-${index}`);
        if (slider && label) {
        slider.addEventListener('input', (e) => {
            const newScore = parseInt(e.target.value);
            label.textContent = `${newScore} / 5`;
            comp.score = newScore;
                if (competencyAssessments[assessmentKey]) {
            competencyAssessments[assessmentKey].scores[index].score = newScore;
                }
            updateRadarChart();
        });
        }
    });
    console.log('=== КІНЕЦЬ renderCompetencyList ===');
}

function renderRadarChart(scores) {
    const ctx = document.getElementById('competencyRadarChart');
    if (!ctx) {
        console.warn('Canvas для радарної діаграми не знайдено');
        return;
    }
    
    console.log('Рендеринг радарної діаграми:', scores);
    
    const context = ctx.getContext('2d');
    
    if (radarChart) {
        cancelAnimationFrame(animationFrameId);
        radarChart.destroy();
    }
    
    const data = {
        labels: scores.map(c => c.name),
        datasets: [
            {
                label: `Оцінка`,
                data: scores.map(c => c.score),
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                borderColor: 'rgba(99, 102, 241, 1)',
                pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(99, 102, 241, 1)'
            },
            {
                label: 'Glow',
                data: scores.map(c => c.score),
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                pointBackgroundColor: 'rgba(99, 102, 241, 0.3)',
                pointBorderColor: 'rgba(99, 102, 241, 0.3)',
                pointHoverBackgroundColor: 'rgba(99, 102, 241, 0.3)',
                pointHoverBorderColor: 'rgba(99, 102, 241, 0.3)'
            }
        ]
    };
    
    radarChart = new Chart(context, {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 5,
                    min: 0,
                    ticks: {
                        stepSize: 1,
                        color: 'rgba(255, 255, 255, 0.7)',
                        backdropColor: 'transparent'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    pointLabels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            size: 12
                        }
                    },
                    angleLines: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            elements: {
                point: {
                    radius: 4,
                    hoverRadius: 6
                }
            }
        }
    });
    
    // Анімація світіння
    function animateGlow() {
        const glowDataset = radarChart.data.datasets[1];
        const time = Date.now() * 0.001;
        const glowIntensity = 0.1 + 0.05 * Math.sin(time * 2);
        
        glowDataset.backgroundColor = `rgba(79, 70, 229, ${glowIntensity})`;
        glowDataset.borderColor = `rgba(99, 102, 241, ${glowIntensity * 3})`;
        
        radarChart.update('none');
        animationFrameId = requestAnimationFrame(animateGlow);
    }
    
    animateGlow();
    
    console.log('Радарна діаграма відрендерена');
}

function updateRadarChart() {
    if (!radarChart) return;
    
    const employeeSelector = document.getElementById('employeeSelector');
    const periodSelector = document.getElementById('periodSelector');
    
    if (!employeeSelector?.value || !periodSelector?.value) return;
    
    const assessmentKey = `${employeeSelector.value}_${periodSelector.value}`;
    const assessment = competencyAssessments[assessmentKey];
    
    if (assessment) {
        radarChart.data.datasets[0].data = assessment.scores.map(s => s.score);
        radarChart.data.datasets[1].data = assessment.scores.map(s => s.score);
        radarChart.update('none');
    }
}

// Функції для вкладки налаштувань
function renderSettingsTab() {
    const listEl = document.getElementById('settingsCompetencyList');
    if (!listEl) {
        console.warn('Елемент списку налаштувань компетенцій не знайдено');
        return;
    }
    
    console.log('Рендеринг вкладки налаштувань компетенцій:', competenciesModels.length);
    
    listEl.innerHTML = '';
    competenciesModels.forEach(comp => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left p-3 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:bg-indigo-600 focus:text-white competency-item-btn';
        btn.textContent = comp.name;
        btn.dataset.id = comp.id;
        btn.onclick = () => populateSettingsForm(comp.id);
        listEl.appendChild(btn);
    });
    
    if (competenciesModels.length > 0) {
        populateSettingsForm(competenciesModels[0].id);
    } else {
        // Показуємо повідомлення якщо немає компетенцій
        listEl.innerHTML = '<p class="text-gray-400 text-center p-4">Немає компетенцій для налаштування</p>';
        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) {
            settingsForm.style.display = 'none';
        }
    }
    
    console.log('Вкладка налаштувань відрендерена');
}

function populateSettingsForm(id) {
    console.log('Заповнення форми налаштувань для компетенції:', id);
    
    // Очищаємо попередній вибір
    document.querySelectorAll('.competency-item-btn').forEach(b => b.classList.remove('bg-indigo-600'));
    const selectedBtn = document.querySelector(`.competency-item-btn[data-id="${id}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('bg-indigo-600');
    }
    
    const comp = competenciesModels.find(c => c.id === id);
    if (!comp) {
        console.warn('Компетенція не знайдена:', id);
        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) {
            settingsForm.style.display = 'none';
        }
        return;
    }
    
    const settingsForm = document.getElementById('settingsForm');
    const editingCompetencyName = document.getElementById('editingCompetencyName');
    const compName = document.getElementById('compName');
    const compCategory = document.getElementById('compCategory');
    const compDesc = document.getElementById('compDesc');
    const compGrowthComment = document.getElementById('compGrowthComment');
    const compGrowthThreshold = document.getElementById('compGrowthThreshold');
    
    if (settingsForm) settingsForm.style.display = 'block';
    if (editingCompetencyName) editingCompetencyName.textContent = comp.name;
    if (compName) compName.value = comp.name;
    if (compCategory) compCategory.value = comp.category;
    if (compDesc) compDesc.value = comp.description;
    if (compGrowthComment) compGrowthComment.value = comp.growthAssistantComment || '';
    if (compGrowthThreshold) compGrowthThreshold.value = comp.growthAssistantThreshold ?? 4;
    
    // Рендеримо індикатори
    const indicatorListEl = document.getElementById('indicatorList');
    if (indicatorListEl) {
    indicatorListEl.innerHTML = '';
    comp.indicators.forEach(ind => addIndicatorInput(ind));
    }
    
    // Рендеримо призначення відділам
    const deptAssignmentListEl = document.getElementById('departmentAssignmentList');
    if (deptAssignmentListEl) {
    deptAssignmentListEl.innerHTML = '';
    
    const allDiv = document.createElement('div');
    allDiv.className = 'flex items-center';
    allDiv.innerHTML = `
        <input id="selectAllDepts" type="checkbox" class="h-4 w-4 rounded border-gray-500 bg-gray-600 text-indigo-500 focus:ring-indigo-600">
        <label for="selectAllDepts" class="ml-3 block text-sm font-medium text-white">Призначити всім відділам</label>
    `;
    deptAssignmentListEl.appendChild(allDiv);
    
    allDepartments.forEach(dept => {
        const div = document.createElement('div');
        div.className = 'flex items-center';
        const isAssigned = comp.departmentIds.length === 0 || comp.departmentIds.includes(dept.id);
        div.innerHTML = `
            <input type="checkbox" class="dept-checkbox h-4 w-4 rounded border-gray-500 bg-gray-600 text-indigo-500 focus:ring-indigo-600" 
                   data-dept-id="${dept.id}" ${isAssigned ? 'checked' : ''}>
            <label class="ml-3 block text-sm font-medium text-white">${dept.name}</label>
        `;
        deptAssignmentListEl.appendChild(div);
    });
    
    // Обробник для "всі відділи"
    const selectAllCheckbox = document.getElementById('selectAllDepts');
    const deptCheckboxes = document.querySelectorAll('.dept-checkbox');
    
        if (selectAllCheckbox) {
    selectAllCheckbox.onchange = () => {
        deptCheckboxes.forEach(cb => {
            cb.checked = selectAllCheckbox.checked;
        });
    };
        }
    
    deptCheckboxes.forEach(cb => {
        cb.onchange = () => {
            const allChecked = Array.from(deptCheckboxes).every(c => c.checked);
                if (selectAllCheckbox) {
            selectAllCheckbox.checked = allChecked;
                }
        };
    });
    }
    
    console.log('Форма налаштувань заповнена для компетенції:', comp.name);
}

function addIndicatorInput(value = '') {
    const indicatorList = document.getElementById('indicatorList');
    if (!indicatorList) {
        console.warn('Елемент списку індикаторів не знайдено');
        return;
    }
    
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    div.innerHTML = `
        <input type="text" class="dark-input flex-grow" value="${value}" placeholder="Введіть поведінковий індикатор">
        <button class="text-red-500 hover:text-red-400 text-2xl leading-none" title="Видалити індикатор">&times;</button>
    `;
    
    const removeBtn = div.querySelector('button');
    if (removeBtn) {
        removeBtn.onclick = () => {
            div.remove();
            console.log('Індикатор видалено');
        };
    }
    
    indicatorList.appendChild(div);
    console.log('Додано індикатор:', value);
}

// Функції для вкладки звітів
function renderReportsTab() {
    console.log('Рендеринг вкладки звітів');
    populateReportDepartments();
    updateReportData();
    // Переключение табов отчёта
    const mainTabBtn = document.getElementById('reportTabMain');
    const compareTabBtn = document.getElementById('reportTabCompare');
    const mainPanel = document.getElementById('mainReportTabPanel');
    const comparePanel = document.getElementById('compareReportTabPanel');

    function switchReportTab(tab) {
        if (tab === 'main') {
            mainTabBtn.classList.add('active-tab');
            compareTabBtn.classList.remove('active-tab');
            mainPanel.classList.add('active');
            comparePanel.classList.remove('active');
        } else {
            mainTabBtn.classList.remove('active-tab');
            compareTabBtn.classList.add('active-tab');
            mainPanel.classList.remove('active');
            comparePanel.classList.add('active');
        }
    }
    mainTabBtn.onclick = () => switchReportTab('main');
    compareTabBtn.onclick = () => switchReportTab('compare');
    // По умолчанию показываем главный отчет
    switchReportTab('main');

    // === Обработчик кнопки сравнения ===
    const compareBtn = document.getElementById('reportCompareBtn');
    if (compareBtn) {
        compareBtn.onclick = function() {
            const period1 = document.getElementById('reportComparePeriod1').value;
            const period2 = document.getElementById('reportComparePeriod2').value;
            renderReportComparison(period1, period2);
        };
    }
}

function populateReportDepartments() {
    const reportDeptSelector = document.getElementById('reportDeptSelector');
    if (!reportDeptSelector) {
        console.warn('Селектор відділів для звітів не знайдено');
        return;
    }
    
    reportDeptSelector.innerHTML = '<option value="all">Всі відділи</option>';
    allDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        reportDeptSelector.appendChild(option);
    });
    
    console.log('Селектор відділів для звітів заповнено');
}

function updateReportData() {
    // Используем только элементы внутри mainReportTabPanel
    const mainPanel = document.getElementById('mainReportTabPanel');
    if (!mainPanel) return;
    const periodInput = mainPanel.querySelector('#reportPeriodSelector');
    const period = periodInput ? periodInput.value : '';
    const reportDeptSelector = mainPanel.querySelector('#reportDeptSelector');
    const departmentId = reportDeptSelector ? reportDeptSelector.value : 'all';

    // Получаем красивое название месяца для заголовков
    let periodLabel = '';
    if (period) {
        const [year, month] = period.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        periodLabel = date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long' });
    }

    // Обновляем заголовки и подписи только внутри mainPanel
    const avgScoreTitle = mainPanel.querySelector('.bg-gray-800 .text-4xl.font-bold');
    if (avgScoreTitle && periodLabel) {
        avgScoreTitle.parentElement.querySelector('h4').textContent = `Середня оцінка (${periodLabel})`;
    }
    const topCompTitle = mainPanel.querySelectorAll('.bg-gray-800 .text-3xl.font-bold.text-green-400');
    if (topCompTitle.length && periodLabel) {
        topCompTitle[0].parentElement.querySelector('h4').textContent = `Найсильніша компетенція`;
    }
    const lowCompTitle = mainPanel.querySelectorAll('.bg-gray-800 .text-3xl.font-bold.text-yellow-400');
    if (lowCompTitle.length && periodLabel) {
        lowCompTitle[0].parentElement.querySelector('h4').textContent = `Зона для розвитку`;
    }
    const barChartTitle = mainPanel.querySelector('#competencyBarChart')?.closest('.bg-gray-800')?.querySelector('h3');
    if (barChartTitle && periodLabel) {
        barChartTitle.textContent = `Середні оцінки по компетенціям (${periodLabel})`;
    }
    const empListTitle = mainPanel.querySelector('#reportEmployeeList')?.closest('.bg-gray-800')?.querySelector('h3');
    if (empListTitle && periodLabel) {
        empListTitle.textContent = `Оцінки співробітників (${periodLabel})`;
    }

    // Подробная отладка сотрудников и фильтра
    console.log('=== ОТЛАДКА ОТЧЕТА ПО КОМПЕТЕНЦИЯМ ===');
    console.log('Выбранный отдел (departmentId):', departmentId);
    console.log('Выбранный период:', period);
    allEmployees.forEach(e => {
        console.log(`EMPLOYEE: ${e.name} | id: ${e.id} | department: ${e.department} | departmentName: ${e.departmentName} | archivedInMonths:`, e.archivedInMonths);
    });

    // Фильтрация сотрудников по отделу
    const employeesToReport = departmentId === 'all'
        ? allEmployees.filter(e => !e.archivedInMonths || Object.keys(e.archivedInMonths).length === 0)
        : allEmployees.filter(e => e.department === departmentId && (!e.archivedInMonths || Object.keys(e.archivedInMonths).length === 0));
    console.log('Сотрудники, попавшие в фильтр:', employeesToReport.map(e => `${e.name} (${e.id})`));

    // Проверка наличия оценок по каждому сотруднику
    employeesToReport.forEach(emp => {
        const assessmentKey = `${emp.id}_${period}`;
        const assessment = competencyAssessments[assessmentKey];
        if (assessment) {
            console.log(`ОЦЕНКА НАЙДЕНА: ${emp.name} (${emp.id}) -> assessmentKey: ${assessmentKey}`);
        } else {
            console.warn(`ОЦЕНКА НЕ НАЙДЕНА: ${emp.name} (${emp.id}) -> assessmentKey: ${assessmentKey}`);
        }
    });

    // Далі фільтруємо оцінки по періоду
    console.log('Співробітники для звіту:', employeesToReport.length);
    
    if (competenciesModels.length === 0) {
        console.warn('Немає моделей компетенцій для звіту');
        return;
    }
    
    const labels = competenciesModels.map(c => c.name);
    const barData = labels.map(label => {
        let totalScore = 0, count = 0;
        employeesToReport.forEach(emp => {
            const assessmentKey = `${emp.id}_${period}`;
            const assessment = competencyAssessments[assessmentKey];
            if (assessment) {
                const comp = assessment.scores.find(s => s.name === label);
                if (comp) {
                    totalScore += comp.score;
                    count++;
                }
            }
        });
        return count > 0 ? (totalScore / count).toFixed(2) : 0;
    });
    
    console.log('Дані для графіка:', { labels, barData });
    
    // Оновлюємо графік
    if (barChart) barChart.destroy();
    
    const ctx = document.getElementById('competencyBarChart');
    if (ctx) {
        barChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Середня оцінка',
                    data: barData,
                    backgroundColor: 'rgba(79, 70, 229, 0.6)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 5,
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    },
                    y: { 
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    }
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'rgba(255, 255, 255, 1)',
                        bodyColor: 'rgba(255, 255, 255, 1)'
                    }
                }
            }
        });
    }
    
    // Оновлюємо список співробітників
    const reportEmployeeListEl = document.getElementById('reportEmployeeList');
    if (reportEmployeeListEl) {
        reportEmployeeListEl.innerHTML = '';
        employeesToReport.forEach(emp => {
            const assessmentKey = `${emp.id}_${period}`;
            const assessment = competencyAssessments[assessmentKey];
            if (!assessment) return;
            const avgScore = assessment.scores.reduce((sum, s) => sum + s.score, 0) / assessment.scores.length;
            const scoreColor = avgScore >= 4 ? 'text-green-400' : avgScore >= 3 ? 'text-yellow-400' : 'text-red-400';
            const position = allPositions.find(p => p.id === emp.positionId);
            const department = allDepartments.find(d => d.id === emp.department);
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-3 bg-gray-700/50 rounded-lg';
            div.innerHTML = `
                <div>
                    <p class="font-semibold text-white">${emp.name}</p>
                    <p class="text-sm text-gray-400">${position?.name || 'Посада не вказана'} / ${department?.name || emp.departmentName || 'Без відділу'}</p>
                </div>
                <span class="text-lg font-bold ${scoreColor}">${avgScore.toFixed(1)}</span>
            `;
            reportEmployeeListEl.appendChild(div);
        });
    }
    
    // Оновлюємо статистику
    const reportAvgScore = document.getElementById('reportAvgScore');
    const reportTopComp = document.getElementById('reportTopComp');
    const reportLowComp = document.getElementById('reportLowComp');
    
    if (reportAvgScore || reportTopComp || reportLowComp) {
        let totalAvgScore = 0;
        let totalCount = 0;
        const compScores = {};
        
        employeesToReport.forEach(emp => {
        const assessmentKey = `${emp.id}_${period}`;
        const assessment = competencyAssessments[assessmentKey];
        if (assessment) {
                const empAvg = assessment.scores.reduce((sum, s) => sum + s.score, 0) / assessment.scores.length;
                totalAvgScore += empAvg;
                totalCount++;
                
                assessment.scores.forEach(score => {
                    if (!compScores[score.name]) {
                        compScores[score.name] = { total: 0, count: 0 };
                    }
                    compScores[score.name].total += score.score;
                    compScores[score.name].count++;
                });
            }
        });
        
        const overallAvg = totalCount > 0 ? (totalAvgScore / totalCount).toFixed(1) : '0.0';
        const topComp = Object.entries(compScores)
            .map(([name, data]) => ({ name, avg: data.total / data.count }))
            .sort((a, b) => b.avg - a.avg)[0];
        const lowComp = Object.entries(compScores)
            .map(([name, data]) => ({ name, avg: data.total / data.count }))
            .sort((a, b) => a.avg - b.avg)[0];
        
        if (reportAvgScore) reportAvgScore.textContent = `${overallAvg} / 5`;
        if (reportTopComp) reportTopComp.textContent = topComp?.name || 'Немає даних';
        if (reportLowComp) reportLowComp.textContent = lowComp?.name || 'Немає даних';
    }
    
    console.log('Дані звіту оновлено');
}

function renderReportComparison(period1, period2) {
    // Используем только элементы внутри compareReportTabPanel
    const comparePanel = document.getElementById('compareReportTabPanel');
    if (!comparePanel) return;
    const resultDiv = comparePanel.querySelector('#reportCompareResult');
    if (!resultDiv) return;
    const chartContainer = comparePanel.querySelector('#reportCompareChartContainer');
    if (chartContainer) chartContainer.innerHTML = '';
    const employees = allEmployees;
    const compMap = {};
    employees.forEach(emp => {
        const a1 = competencyAssessments[`${emp.id}_${period1}`];
        const a2 = competencyAssessments[`${emp.id}_${period2}`];
        if (a1 && a2) {
            a1.scores.forEach((s, i) => {
                const name = s.name;
                if (!compMap[name]) compMap[name] = { p1: 0, p2: 0, count: 0 };
                compMap[name].p1 += s.score;
                compMap[name].p2 += a2.scores[i]?.score || 0;
                compMap[name].count++;
            });
        }
    });
    let html = '<table class="min-w-max text-sm mb-8"><tr><th class="px-2">Компетенція</th><th class="px-2">Період 1</th><th class="px-2">Період 2</th><th class="px-2">Δ</th></tr>';
    const labels = [];
    const data1 = [];
    const data2 = [];
    Object.entries(compMap).forEach(([name, data]) => {
        const avg1 = (data.p1 / data.count).toFixed(2);
        const avg2 = (data.p2 / data.count).toFixed(2);
        const delta = (avg2 - avg1).toFixed(2);
        html += `<tr><td class=\"px-2\">${name}</td><td class=\"px-2\">${avg1}</td><td class=\"px-2\">${avg2}</td><td class=\"px-2 font-bold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : ''}\">${delta}</td></tr>`;
        labels.push(name);
        data1.push(Number(avg1));
        data2.push(Number(avg2));
    });
    html += '</table>';
    resultDiv.innerHTML = html;

    // --- График сравнения ---
    if (chartContainer && labels.length > 0) {
        const canvas = document.createElement('canvas');
        canvas.id = 'reportCompareChart';
        chartContainer.appendChild(canvas);
        if (window.reportCompareChartInstance) {
            window.reportCompareChartInstance.destroy();
        }
        window.reportCompareChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Період 1',
                        data: data1,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Період 2',
                        data: data2,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#d1d5db', font: { size: 14 } } },
                    tooltip: {
                        backgroundColor: 'rgba(31, 41, 55, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#d1d5db',
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#d1d5db', font: { size: 13 } },
                        grid: { color: 'rgba(75, 85, 99, 0.3)' }
                    },
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: { color: '#d1d5db', stepSize: 1 },
                        grid: { color: 'rgba(75, 85, 99, 0.3)' }
                    }
                }
            }
        });
        chartContainer.style.height = '400px';
    }
}

// Функції для помічника зростання
function showGrowthAssistantByIndex(index) {
    const overlay = document.getElementById('growthAssistantOverlay');
    const modal = document.getElementById('growthAssistantModal');
    const title = document.getElementById('assistantTitle');
    const content = document.getElementById('assistantContent');
    // Знаходимо поточну оцінку
    const employeeSelector = document.getElementById('employeeSelector');
    const periodSelector = document.getElementById('periodSelector');
    const assessmentKey = `${employeeSelector.value}_${periodSelector.value}`;
    const assessment = competencyAssessments[assessmentKey];
    if (!assessment || !assessment.scores[index]) return;
    const comp = assessment.scores[index];
    title.textContent = comp.name || 'Помічник Зростання';
    if (comp.growthAssistantComment && comp.growthAssistantComment.trim()) {
        content.innerHTML = comp.growthAssistantComment.split('\n').map(line => `<div>• ${line}</div>`).join('');
    } else {
        content.innerHTML = getGrowthAdvice(comp.name).map(line => `<div>• ${line}</div>`).join('');
    }
    overlay.classList.remove('hidden');
    setTimeout(() => modal.focus(), 100);
}

function hideGrowthAssistant() {
    console.log('=== ПОЧАТОК hideGrowthAssistant ===');
    const overlay = document.getElementById('growthAssistantOverlay');
    console.log('Overlay знайдено:', !!overlay);
    if (overlay) {
        overlay.classList.add('hidden');
        console.log('Overlay приховано, класи:', overlay.className);
    }
    console.log('=== КІНЕЦЬ hideGrowthAssistant ===');
}

// --- Додаю делегування подій для кнопок ---
document.addEventListener('click', function(e) {
    console.log('=== КЛІК ПО ДОКУМЕНТУ ===');
    console.log('Клікнутий елемент:', e.target);
    console.log('Класи елемента:', e.target.className);
    console.log('ID елемента:', e.target.id);
    console.log('Data-атрибути:', e.target.dataset);
    
    // Відкрити модалку
    if (e.target.classList.contains('growth-assistant-btn')) {
        console.log('!!! ЗНАЙДЕНО КНОПКУ growth-assistant-btn !!!');
        const index = parseInt(e.target.dataset.competencyIndex);
        console.log('competencyIndex з data-атрибута:', index);
        showGrowthAssistantByIndex(index);
    }
    // Закрити по кнопці
    if (e.target.id === 'closeAssistantBtn') {
        console.log('!!! ЗНАЙДЕНО КНОПКУ closeAssistantBtn !!!');
        hideGrowthAssistant();
    }
    // Закрити по overlay (але не по кліку на саму модалку)
    if (e.target.id === 'growthAssistantOverlay') {
        console.log('!!! ЗНАЙДЕНО OVERLAY !!!');
        hideGrowthAssistant();
    }
});

// Закриття по Escape
window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        console.log('!!! НАТИСНУТО ESCAPE !!!');
        hideGrowthAssistant();
    }
});

function getGrowthAdvice(competencyName) {
    const adviceMap = {
        'Лідерство': [
            'Беріть на себе відповідальність за складні проекти',
            'Практикуйте делегування завдань членам команди',
            'Розвивайте навички мотивації та підтримки колег',
            'Вивчайте техніки ефективного управління конфліктами'
        ],
        'Стратегічне мислення': [
            'Аналізуйте ринкові тренди та конкурентне середовище',
            'Практикуйте довгострокове планування проектів',
            'Вивчайте кейси успішних стратегій у вашій галузі',
            'Розвивайте системне мислення та бачення загальної картини'
        ],
        'Комунікація': [
            'Практикуйте активне слухання в діалогах',
            'Розвивайте навички публічних виступів',
            'Вивчайте техніки ефективної презентації ідей',
            'Практикуйте конструктивну критику та відгуки'
        ],
        'Технічна експертиза': [
            'Регулярно вивчайте нові технології у вашій галузі',
            'Беріть участь у технічних конференціях та вебінарах',
            'Практикуйте вирішення складних технічних задач',
            'Діліться знаннями з колегами через менторство'
        ],
        'Тайм-менеджмент': [
            'Використовуйте техніки планування часу (Pomodoro, матриця Ейзенхауера)',
            'Встановлюйте пріоритети для завдань',
            'Навчіться говорити "ні" непріоритетним завданням',
            'Аналізуйте та оптимізуйте свої робочі процеси'
        ],
        'Робота в команді': [
            'Активно підтримуйте колег у їх проектах',
            'Діліться знаннями та досвідом з командою',
            'Практикуйте конструктивне вирішення конфліктів',
            'Беріть участь у командних заходах та активностях'
        ]
    };
    
    return adviceMap[competencyName] || [
        'Визначте конкретні цілі для розвитку цієї компетенції',
        'Знайдіть ментора або коуча для наставництва',
        'Практикуйте нові навички в безпечному середовищі',
        'Регулярно отримуйте зворотній зв\'язок від колег та керівника'
    ];
}

// Налаштування обробників подій
function setupEventListeners() {
    console.log('Налаштування обробників подій для модуля компетенцій...');
    
    const departmentSelector = document.getElementById('departmentSelector');
    const employeeSelector = document.getElementById('employeeSelector');
    const reportDeptSelector = document.getElementById('reportDeptSelector');
    const periodSelector = document.getElementById('periodSelector');
    const addIndicatorBtn = document.getElementById('addIndicatorBtn');
    const closeAssistantBtn = document.getElementById('closeAssistantBtn');
    const saveAssessmentBtn = document.getElementById('saveAssessmentBtn');
    const addNewCompetencyBtn = document.getElementById('addNewCompetencyBtn');
    const saveCompetencyBtn = document.getElementById('saveCompetencyBtn');
    const deleteCompetencyBtn = document.getElementById('deleteCompetencyBtn');
    
    console.log('Знайдені елементи:', {
        departmentSelector: !!departmentSelector,
        employeeSelector: !!employeeSelector,
        reportDeptSelector: !!reportDeptSelector,
        periodSelector: !!periodSelector,
        addIndicatorBtn: !!addIndicatorBtn,
        closeAssistantBtn: !!closeAssistantBtn,
        saveAssessmentBtn: !!saveAssessmentBtn,
        addNewCompetencyBtn: !!addNewCompetencyBtn,
        saveCompetencyBtn: !!saveCompetencyBtn,
        deleteCompetencyBtn: !!deleteCompetencyBtn
    });
    
    if (departmentSelector) {
        departmentSelector.addEventListener('change', (e) => {
            console.log('Зміна відділу:', e.target.value);
            populateEmployees(e.target.value);
            showAssessmentFor(null);
        });
    }
    
    if (employeeSelector) {
        employeeSelector.addEventListener('change', (e) => {
            console.log('Зміна співробітника:', e.target.value);
            showAssessmentFor(e.target.value);
        });
    }
    
    if (reportDeptSelector) {
        reportDeptSelector.addEventListener('change', (e) => {
            console.log('Зміна відділу для звіту:', e.target.value);
            updateReportData();
        });
    }
    
    if (periodSelector) {
        periodSelector.addEventListener('change', () => {
            console.log('Зміна періоду:', periodSelector.value);
            const employeeSelector = document.getElementById('employeeSelector');
            if (employeeSelector && employeeSelector.value) {
                showAssessmentFor(employeeSelector.value);
            }
            updateReportData();
        });
    }
    
    if (addIndicatorBtn) {
        addIndicatorBtn.onclick = () => {
            console.log('Додавання індикатора');
            addIndicatorInput();
        };
    }
    
    if (closeAssistantBtn) {
        closeAssistantBtn.addEventListener('click', () => {
            console.log('Закриття помічника');
            hideGrowthAssistant();
        });
    }
    
    if (saveAssessmentBtn) {
        saveAssessmentBtn.addEventListener('click', () => {
            console.log('Збереження оцінки');
            saveCurrentAssessment();
        });
    }
    
    if (addNewCompetencyBtn) {
        addNewCompetencyBtn.addEventListener('click', () => {
            console.log('Додавання нової компетенції');
            // Створюємо нову компетенцію
            const newComp = {
                id: `new_${Date.now()}`,
                name: 'Нова компетенція',
                category: '',
                description: '',
                indicators: [],
                departmentIds: [],
                growthAssistantComment: '',
                growthAssistantThreshold: 4,
                createdBy: currentUserId,
                createdAt: new Date()
            };
            
            competenciesModels.push(newComp);
            renderSettingsTab();
            populateSettingsForm(newComp.id);
            
            ui.showToast('Створено нову компетенцію. Відредагуйте її та збережіть.', 'success');
        });
    }
    
    if (saveCompetencyBtn) {
        saveCompetencyBtn.addEventListener('click', () => {
            console.log('Збереження моделі компетенції');
            saveCompetencyModel();
        });
    }
    
    if (deleteCompetencyBtn) {
        deleteCompetencyBtn.addEventListener('click', () => {
            console.log('Видалення моделі компетенції');
            ui.showConfirmation('Ви впевнені, що хочете видалити цю компетенцію?', false)
                .then((confirmed) => {
                    if (confirmed) {
                        deleteCompetencyModel();
                    }
                });
        });
    }
    
    console.log('Обробники подій налаштовано');
}

// Збереження поточної оцінки
async function saveCurrentAssessment() {
    const employeeSelector = document.getElementById('employeeSelector');
    const periodSelector = document.getElementById('periodSelector');
    const overallComment = document.getElementById('overallComment');
    if (!employeeSelector?.value) {
        ui.showToast('Оберіть співробітника для збереження оцінки', 'warning');
        return;
    }
    const assessmentKey = `${employeeSelector.value}_${periodSelector.value}`;
    const assessment = competencyAssessments[assessmentKey];
    
    if (!assessment) {
        ui.showToast('Оцінка не знайдена', 'error');
        return;
    }
    
    // Оновлюємо коментар
    assessment.overallComment = overallComment?.value || '';
    assessment.assessedAt = new Date();
    
    try {
        const assessmentRef = firebase.doc(firebase.db, "companies", currentCompanyId, "competencyAssessments", assessment.id);
        await firebase.updateDoc(assessmentRef, {
            scores: assessment.scores,
            overallComment: assessment.overallComment,
            assessedAt: assessment.assessedAt
        });
        ui.showToast('Оцінка збережена успішно!', 'success');
        showAssessmentFor(employeeSelector.value);
    } catch (error) {
        console.error('Помилка збереження оцінки:', error);
        ui.showToast('Помилка збереження оцінки', 'error');
    }
}

// Збереження моделі компетенції
async function saveCompetencyModel() {
    const compName = document.getElementById('compName')?.value;
    const compCategory = document.getElementById('compCategory')?.value;
    const compDesc = document.getElementById('compDesc')?.value;
    
    if (!compName?.trim()) {
        ui.showToast('Назва компетенції обов\'язкова', 'warning');
        return;
    }
    
    // Отримуємо індикатори
    const indicators = Array.from(document.querySelectorAll('#indicatorList input')).map(input => input.value.trim()).filter(v => v);
    
    // Отримуємо призначені відділи
    const departmentIds = Array.from(document.querySelectorAll('.dept-checkbox:checked')).map(cb => cb.dataset.deptId);
    
    // Знаходимо поточну компетенцію
    const editingCompetencyName = document.getElementById('editingCompetencyName')?.textContent;
    const currentComp = competenciesModels.find(c => c.name === editingCompetencyName);
    
    if (!currentComp) {
        ui.showToast('Компетенція не знайдена', 'error');
        return;
    }
    
    const compGrowthComment = document.getElementById('compGrowthComment')?.value || '';
    const compGrowthThreshold = parseInt(document.getElementById('compGrowthThreshold')?.value) || 4;
    
    const updatedModel = {
        ...currentComp,
        name: compName.trim(),
        category: compCategory?.trim() || '',
        description: compDesc?.trim() || '',
        indicators,
        departmentIds: departmentIds.length === 0 ? [] : departmentIds,
        growthAssistantComment: compGrowthComment,
        growthAssistantThreshold: compGrowthThreshold,
        updatedBy: currentUserId,
        updatedAt: new Date()
    };
    console.log('ЗБЕРІГАЄМО КОМПЕТЕНЦІЮ (з growthAssistantComment):', updatedModel);
    
    try {
        if (currentComp.id.startsWith('new_')) {
            // Створюємо новий документ
            const modelRef = firebase.collection(firebase.db, "companies", currentCompanyId, "competencyModels");
            const docRef = await firebase.addDoc(modelRef, updatedModel);
            // ОНОВЛЮЄМО id у документі та локально
            await firebase.updateDoc(docRef, { id: docRef.id });
            const index = competenciesModels.findIndex(c => c.id === currentComp.id);
            if (index !== -1) {
                competenciesModels[index] = { ...updatedModel, id: docRef.id };
            }
            ui.showToast('Нову модель компетенції створено!', 'success');
        } else {
            // Оновлюємо існуючий документ
        const modelRef = firebase.doc(firebase.db, "companies", currentCompanyId, "competencyModels", currentComp.id);
        await firebase.updateDoc(modelRef, updatedModel);
        const index = competenciesModels.findIndex(c => c.id === currentComp.id);
        if (index !== -1) {
            competenciesModels[index] = updatedModel;
        }
        ui.showToast('Модель компетенції збережена!', 'success');
        }
        await loadCompetencyModels();
        // Оновлюємо детальну оцінку для поточного співробітника
        const employeeSelector = document.getElementById('employeeSelector');
        if (employeeSelector && employeeSelector.value) {
            showAssessmentFor(employeeSelector.value);
        }
        renderSettingsTab();
    } catch (error) {
        console.error('Помилка збереження моделі компетенції:', error);
        ui.showToast('Помилка збереження моделі компетенції', 'error');
    }
}

// Видалення моделі компетенції
async function deleteCompetencyModel() {
    const editingCompetencyName = document.getElementById('editingCompetencyName')?.textContent;
    const currentComp = competenciesModels.find(c => c.name === editingCompetencyName);
    console.log('Видалення компетенції:', {
        id: currentComp?.id,
        name: currentComp?.name,
        isNew: currentComp?.id?.startsWith('new_')
    });
    if (!currentComp) {
        ui.showToast('Компетенція не знайдена', 'error');
        return;
    }
    // Перевіряємо чи це нова компетенція (ще не збережена)
    if (currentComp.id.startsWith('new_')) {
        console.log('Видаляємо нову (ще не збережену) компетенцію лише з локального масиву');
        competenciesModels = competenciesModels.filter(c => c.id !== currentComp.id);
        ui.showToast('Нову компетенцію видалено', 'success');
        renderSettingsTab(); // Оновлюємо список
        return;
    }
    try {
        console.log('Видаляємо компетенцію з Firestore:', currentComp.id);
        const modelRef = firebase.doc(firebase.db, "companies", currentCompanyId, "competencyModels", currentComp.id);
        await firebase.deleteDoc(modelRef);
        competenciesModels = competenciesModels.filter(c => c.id !== currentComp.id);
        ui.showToast('Модель компетенції видалена', 'success');
        await loadCompetencyModels();
        // Оновлюємо детальну оцінку для поточного співробітника
        const employeeSelector = document.getElementById('employeeSelector');
        if (employeeSelector && employeeSelector.value) {
            showAssessmentFor(employeeSelector.value);
        }
        renderSettingsTab(); // Оновлюємо список
    } catch (error) {
        console.error('Помилка видалення моделі компетенції:', error);
        ui.showToast('Помилка видалення моделі компетенції', 'error');
    }
}

// --- Логіка перемикання вкладок Оцінка/Історія ---
function setupAssessmentTabs() {
    const tabAssessment = document.getElementById('tab-assessment');
    const tabHistory = document.getElementById('tab-history');
    const panelAssessment = document.getElementById('panel-assessment');
    const panelHistory = document.getElementById('panel-history');
    if (!tabAssessment || !tabHistory || !panelAssessment || !panelHistory) return;
    tabAssessment.addEventListener('click', () => {
        tabAssessment.classList.add('tab-active');
        tabHistory.classList.remove('tab-active');
        panelAssessment.classList.add('active');
        panelAssessment.classList.remove('hidden');
        panelHistory.classList.remove('active');
        panelHistory.classList.add('hidden');
    });
    tabHistory.addEventListener('click', () => {
        tabHistory.classList.add('tab-active');
        tabAssessment.classList.remove('tab-active');
        panelHistory.classList.add('active');
        panelHistory.classList.remove('hidden');
        panelAssessment.classList.remove('active');
        panelAssessment.classList.add('hidden');
        renderAssessmentHistory();
    });
}

// --- Рендер історії оцінок співробітника ---
function renderAssessmentHistory() {
    const employeeSelector = document.getElementById('employeeSelector');
    const historyList = document.getElementById('historyList');
    const historyPanel = document.getElementById('panel-history');
    if (!employeeSelector || !historyList) return;
    const employeeId = employeeSelector.value;
    // Збираємо всі оцінки для співробітника
    const assessments = Object.values(competencyAssessments).filter(a => a.employeeId === employeeId);
    if (assessments.length === 0) {
        historyList.innerHTML = '<div class="text-gray-400">Немає історії оцінок для цього співробітника.</div>';
        return;
    }
    // Сортуємо за періодом (новіші зверху)
    assessments.sort((a, b) => (a.period < b.period ? 1 : -1));
    historyList.innerHTML = assessments.map(a => `
      <div class="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <div class="flex justify-between items-center mb-2">
          <span class="font-semibold text-indigo-400">${a.period}</span>
          <span class="text-xs text-gray-400">Оцінював: ${a.assessedBy || ''}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${a.scores.map(s => `
            <div class="flex justify-between items-center">
              <span class="font-medium">${s.name}</span>
              <span class="text-indigo-300 font-bold">${s.score} / 5</span>
            </div>
          `).join('')}
        </div>
        ${a.overallComment ? `<div class="mt-2 text-sm text-gray-400">Коментар: ${a.overallComment}</div>` : ''}
      </div>
    `).join('');
    // --- Динаміка ---
    let chartContainer = document.getElementById('historyDynamicsChartContainer');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'historyDynamicsChartContainer';
        chartContainer.className = 'my-8';
        historyPanel.insertBefore(chartContainer, historyList);
    }
    chartContainer.innerHTML = '<canvas id="historyDynamicsChart" height="80"></canvas>';
    // Дані для графіка
    const periods = assessments.map(a => a.period).reverse();
    const avgScores = assessments.map(a => (a.scores.reduce((sum, s) => sum + s.score, 0) / a.scores.length).toFixed(2)).reverse();
    if (window.historyDynamicsChartInstance) window.historyDynamicsChartInstance.destroy();
    window.historyDynamicsChartInstance = new Chart(document.getElementById('historyDynamicsChart').getContext('2d'), {
        type: 'line',
        data: { labels: periods, datasets: [{ label: 'Середній бал', data: avgScores, borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 1, max: 5 } } }
    });
}

// --- Викликаю setupAssessmentTabs при ініціалізації модуля ---
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', setupAssessmentTabs);
}

// Експортуємо функції для глобального використання
window.switchCompetencyTab = switchCompetencyTab;
window.showGrowthAssistantByIndex = showGrowthAssistantByIndex;
window.hideGrowthAssistant = hideGrowthAssistant;
window.updateCompetenciesData = updateCompetenciesData;
window.initCompetenciesModule = initCompetenciesModule; // <--- ADD THIS LINE

// === ДОДАТКОВИЙ КОД ДЛЯ КОНТРОЛЮ ПЕРЕЗАПИСУ ТА ДИНАМІКИ ===

// --- Модальне попередження про існуючу оцінку ---
function showAssessmentExistsModal(onUpdate) {
    const modalId = 'assessmentExistsModal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay z-50';
        modal.innerHTML = `
            <div class="relative p-6 border border-gray-700 w-full max-w-md shadow-lg rounded-md bg-gray-800 flex flex-col items-center">
                <h3 class="text-lg font-medium text-white mb-4">Оцінка вже існує</h3>
                <p class="text-gray-300 mb-6">Оцінка за цей місяць вже існує. Ви впевнені, що хочете продовжити і оновити її?</p>
                <div class="flex gap-4 w-full">
                    <button id="assessmentExistsUpdateBtn" class="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Продовжити</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    document.getElementById('assessmentExistsUpdateBtn').onclick = () => {
        modal.classList.add('hidden');
        onUpdate();
    };
}

// --- Проверка наличия оценки только по месяцу и сотруднику ---
function checkAssessmentExists(period, employeeId) {
    const assessmentKey = `${employeeId}_${period}`;
    return !!competencyAssessments[assessmentKey];
}

// --- Вкладка "Оцінка": порядок выбора и проверка ---
function setupAssessmentFilters() {
    const periodSelector = document.getElementById('periodSelector');
    const deptSelector = document.getElementById('departmentSelector');
    const empSelector = document.getElementById('employeeSelector');
    if (!periodSelector || !deptSelector || !empSelector) return;
    // Обновляем сотрудников при смене отдела
    deptSelector.onchange = () => {
        const deptId = deptSelector.value;
        const filtered = deptId ? allEmployees.filter(e => e.department === deptId) : allEmployees;
        empSelector.innerHTML = '<option value="">-- Оберіть співробітника --</option>' + filtered.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        empSelector.value = '';
        clearAssessmentWarning();
    };
    // Очищаем предупреждение при смене месяца или сотрудника
    periodSelector.onchange = clearAssessmentWarning;
    empSelector.onchange = clearAssessmentWarning;
    // Проверка только если все выбрано
    [periodSelector, deptSelector, empSelector].forEach(sel => {
        sel.onblur = sel.onchange = () => {
            if (periodSelector.value && deptSelector.value && empSelector.value) {
                const period = periodSelector.value;
                const employeeId = empSelector.value;
                if (checkAssessmentExists(period, employeeId)) {
                    showAssessmentExistsModal(() => showAssessmentFor(employeeId, period));
                } else {
                    showAssessmentFor(employeeId, period);
                }
            }
        };
    });
}
function clearAssessmentWarning() {
    const modal = document.getElementById('assessmentExistsModal');
    if (modal) modal.classList.add('hidden');
}

// --- showAssessmentFor поддерживает periodOverride ---
const _originalShowAssessmentFor = showAssessmentFor;
showAssessmentFor = function(employeeId, periodOverride) {
    const periodSelector = document.getElementById('periodSelector');
    const period = periodOverride || periodSelector?.value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    _originalShowAssessmentFor(employeeId);
};

// --- Исправить renderHistoryFilters: не делать двойных обёрток, не вызывать саму себя ---
function renderHistoryFilters() {
    const historyPanel = document.getElementById('panel-history');
    if (!historyPanel) return;
    let filterContainer = document.getElementById('historyFilterContainer');
    if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'historyFilterContainer';
        filterContainer.className = 'mb-6 flex gap-4 items-end';
        historyPanel.insertBefore(filterContainer, historyPanel.firstChild);
    }
    // Відділи
    let deptSelect = document.getElementById('historyDeptSelect');
    if (!deptSelect) {
        deptSelect = document.createElement('select');
        deptSelect.id = 'historyDeptSelect';
        deptSelect.className = 'dark-input';
        filterContainer.appendChild(deptSelect);
    }
    deptSelect.innerHTML = '<option value="">Всі відділи</option>' + allDepartments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    // Співробітники
    let empSelect = document.getElementById('historyEmpSelect');
    if (!empSelect) {
        empSelect = document.createElement('select');
        empSelect.id = 'historyEmpSelect';
        empSelect.className = 'dark-input';
        filterContainer.appendChild(empSelect);
    }
    // Фільтруємо співробітників за відділом
    const selectedDept = deptSelect.value;
    const filteredEmps = selectedDept ? allEmployees.filter(e => e.department === selectedDept) : allEmployees;
    empSelect.innerHTML = '<option value="">-- Оберіть співробітника --</option>' + filteredEmps.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    // Подія: зміна відділу
    deptSelect.onchange = () => {
        // Завжди фільтруємо від allEmployees
        const filtered = deptSelect.value ? allEmployees.filter(e => e.department === deptSelect.value) : allEmployees;
        empSelect.innerHTML = '<option value="">-- Оберіть співробітника --</option>' + filtered.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        empSelect.value = '';
        renderAssessmentHistory();
    };
    // Подія: зміна співробітника
    empSelect.onchange = renderAssessmentHistory;
}

// --- renderAssessmentHistory не вызывает renderHistoryFilters рекурсивно ---
const _originalRenderAssessmentHistory = renderAssessmentHistory;
renderAssessmentHistory = function() {
    if (!document.getElementById('historyFilterContainer')) renderHistoryFilters();
    const empSelect = document.getElementById('historyEmpSelect');
    const employeeId = empSelect?.value;
    const historyList = document.getElementById('historyList');
    const historyPanel = document.getElementById('panel-history');
    if (!employeeId || !historyList) {
        historyList.innerHTML = '<div class="text-gray-400">Оберіть співробітника для перегляду історії.</div>';
        const chartContainer = document.getElementById('historyDynamicsChartContainer');
        if (chartContainer) chartContainer.innerHTML = '';
        return;
    }
    // Далі — як було, але тільки для обраного співробітника
    const assessments = Object.values(competencyAssessments).filter(a => a.employeeId === employeeId);
    if (assessments.length === 0) {
        historyList.innerHTML = '<div class="text-gray-400">Немає історії оцінок для цього співробітника.</div>';
        const chartContainer = document.getElementById('historyDynamicsChartContainer');
        if (chartContainer) chartContainer.innerHTML = '';
        return;
    }
    // Сортуємо за періодом (новіші зверху)
    assessments.sort((a, b) => (a.period < b.period ? 1 : -1));
    historyList.innerHTML = assessments.map(a => `
      <div class="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <div class="flex justify-between items-center mb-2">
          <span class="font-semibold text-indigo-400">${a.period}</span>
          <span class="text-xs text-gray-400">Оцінював: ${a.assessedBy || ''}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${a.scores.map(s => `
            <div class="flex justify-between items-center">
              <span class="font-medium">${s.name}</span>
              <span class="text-indigo-300 font-bold">${s.score} / 5</span>
            </div>
          `).join('')}
        </div>
        ${a.overallComment ? `<div class="mt-2 text-sm text-gray-400">Коментар: ${a.overallComment}</div>` : ''}
      </div>
    `).join('');
    // --- Динаміка ---
    let chartContainer = document.getElementById('historyDynamicsChartContainer');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'historyDynamicsChartContainer';
        chartContainer.className = 'my-8';
        historyPanel.insertBefore(chartContainer, historyList);
    }
    chartContainer.innerHTML = '<canvas id="historyDynamicsChart" height="80"></canvas>';
    // Дані для графіка
    const periods = assessments.map(a => a.period).reverse();
    const avgScores = assessments.map(a => (a.scores.reduce((sum, s) => sum + s.score, 0) / a.scores.length).toFixed(2)).reverse();
    if (window.historyDynamicsChartInstance) window.historyDynamicsChartInstance.destroy();
    window.historyDynamicsChartInstance = new Chart(document.getElementById('historyDynamicsChart').getContext('2d'), {
        type: 'line',
        data: { labels: periods, datasets: [{ label: 'Середній бал', data: avgScores, borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 1, max: 5 } } }
    });
};

// --- ініціалізація фільтрів при завантаженні ---
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        setupAssessmentFilters();
    });
}

// === Переключение под-вкладок в panel-reports ===
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        setupAssessmentFilters();
        // --- Переключение под-вкладок отчетов ---
        const tabMain = document.getElementById('reportTabMain');
        const tabCompare = document.getElementById('reportTabCompare');
        const panelMain = document.getElementById('mainReportTabPanel');
        const panelCompare = document.getElementById('compareReportTabPanel');
        if (tabMain && tabCompare && panelMain && panelCompare) {
            tabMain.onclick = function() {
                panelMain.classList.add('active');
                panelCompare.classList.remove('active');
                tabMain.classList.add('active-tab');
                tabCompare.classList.remove('active-tab');
            };
            tabCompare.onclick = function() {
                panelMain.classList.remove('active');
                panelCompare.classList.add('active');
                tabCompare.classList.add('active-tab');
                tabMain.classList.remove('active-tab');
                // Если есть функция инициализации сравнения — вызвать её здесь
                if (typeof renderReportComparison === 'function') {
                    // Можно вызвать с последними выбранными периодами, если нужно
                }
            };
        }
    });
}
