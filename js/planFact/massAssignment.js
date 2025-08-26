// massAssignment.js - Підмодуль масового призначення планів
import * as firebase from '../firebase.js';
import { getState, updateState } from './state.js';

/**
 * Завантаження історії масових призначень
 */
function loadMassAssignmentHistory() {
    console.log('📋 Завантаження історії масових призначень...');
    
    const historyContainer = document.getElementById('massAssignmentHistory');
    if (!historyContainer) {
        console.error('❌ Контейнер історії масових призначень не знайдено');
        return;
    }
    
    // Отримуємо відфільтровану історію
    const filteredHistory = getFilteredMassAssignmentHistory();
    
    // Оновлюємо список
    historyContainer.innerHTML = renderMassAssignmentHistory(filteredHistory);
    
    console.log(`✅ Завантажено ${filteredHistory.length} записів історії`);
}

/**
 * Отримання відфільтрованої історії масових призначень
 */
function getFilteredMassAssignmentHistory() {
    const allHistory = getState().planFactData?.massAssignmentHistory || [];
    const monthFilter = document.getElementById('massAssignmentMonth')?.value;
    const departmentFilter = document.getElementById('massAssignmentDepartment')?.value;
    const statusFilter = document.getElementById('massAssignmentStatus')?.value;
    
    return allHistory.filter(record => {
        if (monthFilter && record.month !== monthFilter) {
            return false;
        }
        if (departmentFilter && record.departmentId !== departmentFilter) {
            return false;
        }
        if (statusFilter && record.status !== statusFilter) {
            return false;
        }
        return true;
    });
}

/**
 * Рендеринг історії масових призначень
 */
function renderMassAssignmentHistory(history = null) {
    // Если не передана история, получаем её из состояния
    if (!history) {
        history = getFilteredMassAssignmentHistory();
    }
    
    if (history.length === 0) {
        return `
            <div class="text-center py-8 text-gray-400">
                <p>Немає історії масових призначень</p>
                <p class="text-sm mt-2">Створіть перше масове призначення, натиснувши кнопку "Масове призначення"</p>
            </div>
        `;
    }
    
    return `
        <div class="space-y-4">
            ${history.map(record => `
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="text-lg font-bold text-white">Масове призначення ${formatMonthKey(record.month)}</h4>
                            <p class="text-sm text-gray-400">${getDepartmentName(record.departmentId)} • ${record.employeesCount} співробітників</p>
                            <p class="text-xs text-gray-500">Створено: ${new Date(record.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div class="text-right">
                            <span class="px-2 py-1 rounded-full text-xs ${getMassAssignmentStatusClass(record.status)}">
                                ${getMassAssignmentStatusText(record.status)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                            <div class="text-sm text-gray-400">План продажів</div>
                            <div class="text-white font-medium">${formatCurrency(record.totalRevenue)}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-400">Створено планів</div>
                            <div class="text-white font-medium">${record.plansCount}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-400">Фокусних задач</div>
                            <div class="text-white font-medium">${record.focusTasksCount}</div>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="showMassAssignmentDetails('${record.id}')" 
                                class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            Деталі
                        </button>
                        ${record.status === 'completed' ? 
                            `<button onclick="viewMassAssignmentResults('${record.id}')" 
                                     class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                                Результати
                            </button>` : ''
                        }
                        <button onclick="deleteMassAssignment('${record.id}')" 
                                class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                            Видалити
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Отримання класу статусу масового призначення
 */
function getMassAssignmentStatusClass(status) {
    switch (status) {
        case 'completed':
            return 'bg-green-600 text-white';
        case 'in_progress':
            return 'bg-yellow-600 text-white';
        case 'failed':
            return 'bg-red-600 text-white';
        default:
            return 'bg-gray-600 text-white';
    }
}

/**
 * Отримання тексту статусу масового призначення
 */
function getMassAssignmentStatusText(status) {
    switch (status) {
        case 'completed':
            return 'Завершено';
        case 'in_progress':
            return 'В процесі';
        case 'failed':
            return 'Помилка';
        default:
            return 'Невідомий';
    }
}

/**
 * Рендеринг вкладки массового назначения
 */
export function renderMassAssignmentTab(container = null) {
    // Если контейнер не передан, ищем его
    if (!container) {
        container = document.getElementById('plan-fact-content');
    }
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Заголовок -->
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-white">Масове призначення планів</h2>
                <button onclick="showMassAssignmentModal()" 
                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    🎯 Масове призначення
                </button>
            </div>
            
            <!-- Фільтри -->
            <div class="bg-gray-700 rounded-lg p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Місяць</label>
                        <input type="month" id="massAssignmentMonth" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" 
                               value="${new Date().toISOString().slice(0, 7)}" onchange="loadMassAssignmentHistory()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Відділ</label>
                        <select id="massAssignmentDepartment" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadMassAssignmentHistory()">
                            <option value="">Всі відділи</option>
                            ${getState().planFactData?.departments?.map(dept => 
                                `<option value="${dept.id}">${dept.name}</option>`
                            ).join('') || ''}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Статус</label>
                        <select id="massAssignmentStatus" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadMassAssignmentHistory()">
                            <option value="">Всі статуси</option>
                            <option value="completed">Завершені</option>
                            <option value="in_progress">В процесі</option>
                            <option value="failed">Помилки</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Історія масових призначень -->
            <div class="bg-gray-700 rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-600">
                    <h3 class="text-lg font-bold text-white">Історія масових призначень</h3>
                </div>
                <div id="massAssignmentHistory" class="p-4">
                    ${renderMassAssignmentHistory()}
                </div>
            </div>
        </div>
    `;
    
    loadMassAssignmentHistory();
}

/**
 * Попередній перегляд масового призначення
 */
window.previewMassAssignment = function() {
    const selectedEmployees = getSelectedEmployees();
    const revenue = parseFloat(document.getElementById('mass-revenue')?.value) || 0;
    const month = document.getElementById('mass-month')?.value;
    const focusTasks = getMassFocusTasks();
    
    if (selectedEmployees.length === 0) {
        alert('Будь ласка, оберіть хоча б одного співробітника');
        return;
    }
    
    if (!revenue) {
        alert('Будь ласка, введіть план продажів');
        return;
    }
    
    if (!month) {
        alert('Будь ласка, оберіть місяць');
        return;
    }
    
    showMassAssignmentPreview(selectedEmployees, revenue, month, focusTasks);
};

/**
 * Отримання вибраних співробітників
 */
function getSelectedEmployees() {
    const checkboxes = document.querySelectorAll('.mass-employee-checkbox:checked');
    return Array.from(checkboxes).map(cb => {
        const employeeId = cb.value;
        const employee = getState().planFactData?.employees?.find(emp => emp.id === employeeId);
        return employee;
    }).filter(Boolean);
}

/**
 * Отримання фокусних задач для масового призначення
 */
function getMassFocusTasks() {
    const tasks = Array.from(document.querySelectorAll('.mass-focus-task')).map(task => {
        const typeSelect = task.querySelector('.mass-focus-type');
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const target = parseFloat(task.querySelector('.mass-focus-target').value) || 0;
        
        if (!typeSelect.value || target <= 0) return null;
        
        return {
            typeId: typeSelect.value,
            typeName: selectedOption?.textContent || '',
            type: selectedOption?.dataset.type || 'quantity',
            plan: target
        };
    }).filter(Boolean);
    
    return tasks;
}

/**
 * Показ попереднього перегляду масового призначення
 */
function showMassAssignmentPreview(employees, revenue, month, focusTasks) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Попередній перегляд масового призначення</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-blue-600 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-blue-100 mb-1">Співробітників</h4>
                        <p class="text-2xl font-bold text-white">${employees.length}</p>
                    </div>
                    <div class="bg-green-600 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-green-100 mb-1">План продажів</h4>
                        <p class="text-2xl font-bold text-white">${formatCurrency(revenue)}</p>
                    </div>
                    <div class="bg-purple-600 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-purple-100 mb-1">Фокусних задач</h4>
                        <p class="text-2xl font-bold text-white">${focusTasks.length}</p>
                    </div>
                </div>
                
                <div class="bg-gray-700 rounded-lg p-4">
                    <h3 class="text-lg font-bold text-white mb-3">Співробітники</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        ${employees.map(emp => `
                            <div class="bg-gray-600 rounded p-2">
                                <span class="text-white">${emp.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                ${focusTasks.length > 0 ? `
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-lg font-bold text-white mb-3">Фокусні задачі</h3>
                        <div class="space-y-2">
                            ${focusTasks.map(task => `
                                <div class="bg-gray-600 rounded p-2">
                                    <span class="text-white">${task.typeName}</span>
                                    <span class="text-gray-400 ml-2">${task.plan} ${task.type === 'revenue' ? 'грн' : 'шт'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="flex justify-end gap-4 mt-6">
                <button onclick="this.closest('.fixed').remove()" 
                        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    Скасувати
                </button>
                <button onclick="executeMassAssignment()" 
                        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    Створити плани
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

/**
 * Виконання масового призначення
 */
window.executeMassAssignment = function() {
    const selectedEmployees = getSelectedEmployees();
    const revenue = parseFloat(document.getElementById('mass-revenue')?.value) || 0;
    const month = document.getElementById('mass-month')?.value;
    const focusTasks = getMassFocusTasks();
    
    if (selectedEmployees.length === 0) {
        alert('Будь ласка, оберіть хоча б одного співробітника');
        return;
    }
    
    // Створюємо плани для кожного співробітника
    const createdPlans = [];
    
    selectedEmployees.forEach(employee => {
        const plan = {
            id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `План ${employee.name} - ${formatMonthKey(month)}`,
            managerId: employee.id,
            managerName: employee.name,
            departmentId: employee.department,
            departmentName: getState().planFactData?.departments?.find(d => d.id === employee.department)?.name || '',
            monthKey: month.replace('-', ''),
            status: 'draft',
            salesPlan: {
                revenue: {
                    plan: revenue,
                    fact: 0,
                    forecast: 0
                }
            },
            focusTasks: focusTasks.map(task => ({
                id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                typeId: task.typeId,
                typeName: task.typeName,
                type: task.type,
                plan: task.plan,
                fact: 0
            })),
            createdAt: new Date().toISOString(),
            createdBy: getState().state?.currentUserId || 'demo-user',
            massAssignment: true
        };
        
        createdPlans.push(plan);
        
        // Додаємо до глобальних даних
        if (!getState().planFactData.plans) {
            getState().planFactData.plans = [];
        }
        getState().planFactData.plans.push(plan);
    });
    
    // Зберігаємо в Firebase
    saveMassAssignmentToFirebase(createdPlans);
    
    alert(`✅ Створено ${createdPlans.length} планів успішно!`);
    document.querySelector('.fixed').remove();
    
    // Оновлюємо відображення
    renderMassAssignmentTab();
};

/**
 * Збереження масового призначення в Firebase
 */
async function saveMassAssignmentToFirebase(plans) {
    try {
        const companyId = getState().state?.currentCompanyId;
        if (!companyId) {
            console.warn('⚠️ ID компанії не знайдено');
            return;
        }
        
        const batch = firebase.writeBatch(firebase.db);
        
        plans.forEach(plan => {
            const planRef = firebase.doc(firebase.db, 'companies', companyId, 'plans', plan.id);
            batch.set(planRef, plan);
        });
        
        await batch.commit();
        console.log('✅ Масове призначення збережено в Firebase');
        
    } catch (error) {
        console.error('❌ Помилка збереження масового призначення:', error);
    }
}

// === ДОПОМІЖНІ ФУНКЦІЇ ===

/**
 * Форматування валюти
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

/**
 * Форматування місяця
 */
function formatMonthKey(monthKey) {
    const year = monthKey.substring(0, 4);
    const month = monthKey.substring(4, 6);
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
}

/**
 * Отримання кількості масових призначень
 */
function getMassAssignmentsCount() {
    return getState().planFactData?.plans?.filter(p => p.massAssignment).length || 0;
}

/**
 * Отримання кількості активних призначень
 */
function getActiveAssignmentsCount() {
    return getState().planFactData?.plans?.filter(p => p.massAssignment && p.status === 'active').length || 0;
}

/**
 * Показ модального вікна масового призначення
 */
window.showMassAssignmentModal = function() {
    const modalHTML = `
        <div id="massAssignmentModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-white">Масове призначення планів</h3>
                        <button onclick="closeModal('massAssignmentModal')" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                <div class="space-y-4">
                    <p class="text-gray-300">
                        Ця функція дозволяє швидко створити плани для групи співробітників на основі існуючих шаблонів.
                    </p>
                    
                    <div class="bg-blue-900 border border-blue-700 rounded-lg p-4">
                        <h4 class="text-blue-300 font-medium mb-2">Як це працює:</h4>
                        <ol class="text-blue-200 text-sm space-y-1">
                            <li>1. Оберіть активний шаблон плану для відділу</li>
                            <li>2. Виберіть співробітників зі списку</li>
                            <li>3. Сформуйте планування з базовими значеннями</li>
                            <li>4. Відредагуйте плани та фокуси для кожного менеджера</li>
                            <li>5. Збережіть та активуйте плани</li>
                            <li>6. Результати відображатимуться в дашборді виконання</li>
                        </ol>
                    </div>
                    
                    <div class="flex gap-4">
                        <button onclick="closeModal('massAssignmentModal')" 
                                class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Почати планування
                        </button>
                        <button onclick="closeModal('massAssignmentModal')" 
                                class="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Закрити
                        </button>
                    </div>
                </div>
                </div>
            </div>
        </div>
    `;
    
    // Додаємо модальне вікно
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Показуємо модальне вікно
    document.getElementById('massAssignmentModal').classList.remove('hidden');
};

/**
 * Обновление деталей шаблона при выборе
 */
window.updateTemplateDetails = function() {
    const templateId = document.getElementById('mass-template').value;
    const templateInfo = document.getElementById('template-info');
    const templateDetails = document.getElementById('template-details');
    const departmentSelect = document.getElementById('mass-department');
    
    if (!templateId) {
        templateInfo.classList.add('hidden');
        departmentSelect.disabled = true;
        departmentSelect.innerHTML = '<option value="">Спочатку оберіть шаблон</option>';
        document.getElementById('mass-employees').innerHTML = '<p class="text-gray-400 text-sm">Спочатку оберіть шаблон плану</p>';
        return;
    }
    
    const template = getState().planFactData?.planTemplates?.find(t => t.id === templateId);
    if (!template) return;
    
    // Показываем детали шаблона
    templateDetails.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div>
                <strong>Відділ:</strong> ${getDepartmentName(template.department)}
            </div>
            <div>
                <strong>План продажів:</strong> ${formatCurrency(template.salesPlan)} грн
            </div>
            <div>
                <strong>Місяць:</strong> ${formatMonthKey(template.monthKey || template.month)}
            </div>
            <div>
                <strong>Фокусні задачі:</strong> ${template.focusTasks?.length || 0}
            </div>
        </div>
        ${template.focusTasks && template.focusTasks.length > 0 ? `
            <div class="mt-3">
                <strong>Фокусні задачі:</strong>
                <div class="flex flex-wrap gap-1 mt-1">
                    ${template.focusTasks.map(taskId => {
                        const focusType = getFocusTypeById(taskId);
                        return `<span class="px-2 py-1 bg-blue-600 text-white rounded text-xs">${focusType ? focusType.name : taskId}</span>`;
                    }).join('')}
                </div>
            </div>
        ` : ''}
    `;
    templateInfo.classList.remove('hidden');
    
    // Обновляем отдел
    departmentSelect.disabled = false;
    departmentSelect.innerHTML = `
        <option value="${template.department}" selected>${getDepartmentName(template.department)}</option>
    `;
    departmentSelect.value = template.department;
    
    // Обновляем сотрудников
    updateMassEmployees();
};

/**
 * Генерация планирования для сотрудников
 */
window.generateEmployeePlanning = function() {
    const templateId = document.getElementById('mass-template').value;
    const month = document.getElementById('mass-month').value;
    
    if (!templateId || !month) {
        showToast('❌ Оберіть шаблон та місяць', 'error');
        return;
    }
    
    const selectedEmployees = Array.from(document.querySelectorAll('#mass-employees input[type="checkbox"]:checked'))
        .map(cb => cb.value);
        
    if (selectedEmployees.length === 0) {
        showToast('❌ Оберіть хоча б одного співробітника', 'error');
        return;
    }
    
    const template = getState().planFactData?.planTemplates?.find(t => t.id === templateId);
    if (!template) return;
    
    const employeePlanning = document.getElementById('employee-planning');
    const employeePlans = document.getElementById('employee-plans');
    
    let planningHTML = '';
    
    selectedEmployees.forEach(employeeId => {
        const employee = getState().planFactData?.employees?.find(e => e.id === employeeId);
        if (!employee) return;
        
        planningHTML += `
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-600" data-employee="${employeeId}">
                <h5 class="text-lg font-medium text-white mb-3">${employee.name}</h5>
                
                <!-- План продажів -->
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">План продажів (грн)</label>
                        <input type="number" 
                               id="plan-revenue-${employeeId}" 
                               class="w-full bg-gray-700 border border-gray-600 rounded text-white p-2" 
                               value="${template.salesPlan}" 
                               min="0">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Статус</label>
                        <select id="plan-status-${employeeId}" class="w-full bg-gray-700 border border-gray-600 rounded text-white p-2">
                            <option value="draft">Чернетка</option>
                            <option value="active">Активний</option>
                        </select>
                    </div>
                </div>
                
                <!-- Фокусні задачі -->
                ${template.focusTasks && template.focusTasks.length > 0 ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Фокусні задачі</label>
                        <div class="space-y-2">
                            ${template.focusTasks.map(taskId => {
                                const focusType = getFocusTypeById(taskId);
                                if (!focusType) return '';
                                
                                return `
                                    <div class="flex items-center gap-3 p-2 bg-gray-700 rounded">
                                        <span class="text-white text-sm flex-1">${focusType.name}</span>
                                        <span class="text-gray-400 text-xs">${focusType.type === 'revenue' ? 'грн' : 'шт'}</span>
                                        <input type="number" 
                                               id="focus-${taskId}-${employeeId}" 
                                               class="w-24 bg-gray-600 border border-gray-500 rounded text-white p-1 text-sm" 
                                               placeholder="План" 
                                               min="0">
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    employeePlans.innerHTML = planningHTML;
    employeePlanning.classList.remove('hidden');
    document.getElementById('save-plans-btn').classList.remove('hidden');
    
    showToast('✅ Планування сформовано', 'success');
};

/**
 * Сброс формы массового назначения
 */
window.resetMassAssignment = function() {
    document.getElementById('mass-assignment-form').reset();
    document.getElementById('template-info').classList.add('hidden');
    document.getElementById('employee-planning').classList.add('hidden');
    document.getElementById('save-plans-btn').classList.add('hidden');
    document.getElementById('mass-department').disabled = true;
    document.getElementById('mass-employees').innerHTML = '<p class="text-gray-400 text-sm">Спочатку оберіть шаблон плану</p>';
};

/**
 * Обновление списка сотрудников
 */
window.updateMassEmployees = function() {
    const departmentId = document.getElementById('mass-department').value;
    const container = document.getElementById('mass-employees');
    
    if (!departmentId) {
        container.innerHTML = '<p class="text-gray-400 text-sm">Оберіть відділ</p>';
        return;
    }
    
    // Используем правильную фильтрацию как в сигнализации
    const employees = getState().planFactData?.employees || [];
    const departmentEmployees = employees.filter(emp => {
        return emp.departmentId === departmentId ||
               emp.department === departmentId ||
               (emp.department && emp.department.id === departmentId);
    });
    
    if (departmentEmployees.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">У цьому відділі немає співробітників</p>';
        return;
    }
    
    const employeesHTML = departmentEmployees.map(emp => `
        <label class="flex items-center space-x-2 p-2 hover:bg-gray-600 rounded cursor-pointer">
            <input type="checkbox" value="${emp.id}" class="text-blue-600">
            <span class="text-white">${emp.name}</span>
        </label>
    `).join('');
    
    container.innerHTML = `
        <div class="mb-2">
            <label class="flex items-center space-x-2 p-2 bg-blue-900 rounded cursor-pointer">
                <input type="checkbox" id="select-all-employees" onchange="toggleAllEmployees()">
                <span class="text-blue-200 font-medium">Обрати всіх (${departmentEmployees.length})</span>
            </label>
        </div>
        ${employeesHTML}
    `;
    
    console.log(`👥 Знайдено ${departmentEmployees.length} співробітників для відділу ${departmentId}`);
};

/**
 * Переключение всех сотрудников
 */
window.toggleAllEmployees = function() {
    const selectAll = document.getElementById('select-all-employees');
    const checkboxes = document.querySelectorAll('#mass-employees input[type="checkbox"]:not(#select-all-employees)');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
};

/**
 * Вспомогательная функция получения названия отдела
 */
function getDepartmentName(departmentId) {
    if (!departmentId) return 'Не вказано';
    
    const department = getState().planFactData?.departments?.find(dept => dept.id === departmentId);
    return department ? department.name : departmentId;
}

/**
 * Вспомогательная функция получения типа фокуса
 */
function getFocusTypeById(focusTypeId) {
    if (!focusTypeId) return null;
    
    return getState().planFactData?.focusTypes?.find(type => type.id === focusTypeId) || null;
}





/**
 * Инициализация обработчиков событий массового назначения
 */
function initializeMassAssignmentEventListeners() {
    const form = document.getElementById('mass-assignment-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveMassAssignmentPlans();
        });
    }
}

/**
 * Сохранение планов массового назначения
 */
async function saveMassAssignmentPlans() {
    try {
        const templateId = document.getElementById('mass-template').value;
        const month = document.getElementById('mass-month').value;
        
        if (!templateId || !month) {
            showToast('❌ Заповніть всі обов\'язкові поля', 'error');
            return;
        }
        
        const template = getState().planFactData?.planTemplates?.find(t => t.id === templateId);
        if (!template) {
            showToast('❌ Шаблон не знайдено', 'error');
            return;
        }
        
        const employeePlans = [];
        const employeeCards = document.querySelectorAll('#employee-plans [data-employee]');
        
        employeeCards.forEach(card => {
            const employeeId = card.dataset.employee;
            const employee = getState().planFactData?.employees?.find(e => e.id === employeeId);
            if (!employee) return;
            
            const revenue = parseFloat(document.getElementById(`plan-revenue-${employeeId}`).value) || 0;
            const status = document.getElementById(`plan-status-${employeeId}`).value || 'draft';
            
            // Собираем фокусные задачи
            const focusTasks = [];
            if (template.focusTasks) {
                template.focusTasks.forEach(taskId => {
                    const planInput = document.getElementById(`focus-${taskId}-${employeeId}`);
                    if (planInput && planInput.value) {
                        const focusType = getFocusTypeById(taskId);
                        focusTasks.push({
                            focusTypeId: taskId,
                            focusTypeName: focusType?.name || taskId,
                            focusType: focusType?.type || 'quantity',
                            plan: parseFloat(planInput.value),
                            fact: 0,
                            unit: focusType?.unit || 'шт'
                        });
                    }
                });
            }
            
            const plan = {
                id: `plan-${employeeId}-${Date.now()}`,
                employeeId: employeeId,
                employeeName: employee.name,
                departmentId: template.department,
                departmentName: getDepartmentName(template.department),
                templateId: templateId,
                templateName: template.name,
                monthKey: month.replace('-', ''),
                month: month,
                status: status,
                salesPlan: {
                    revenue: {
                        plan: revenue,
                        fact: 0
                    }
                },
                focusTasks: focusTasks,
                createdAt: new Date().toISOString(),
                createdBy: getState().state?.currentUser?.uid || 'demo-user',
                companyId: getState().state?.currentCompanyId || null
            };
            
            employeePlans.push(plan);
        });
        
        if (employeePlans.length === 0) {
            showToast('❌ Немає планів для збереження', 'error');
            return;
        }
        
        // Сохраняем планы локально или в Firebase
        if (!getState().planFactData.plans) {
            getState().planFactData.plans = [];
        }
        
        const companyId = getState().state?.currentCompanyId;
        const savedPlans = [];
        
        for (const plan of employeePlans) {
            // Проверяем, нет ли уже плана для этого сотрудника в этом месяце
            const existingIndex = getState().planFactData.plans.findIndex(p => 
                p.employeeId === plan.employeeId && p.monthKey === plan.monthKey
            );
            
            if (existingIndex !== -1) {
                // Обновляем существующий план
                getState().planFactData.plans[existingIndex] = plan;
            } else {
                // Добавляем новый план
                getState().planFactData.plans.push(plan);
            }
            
            // Сохраняем в Firebase если есть companyId
            if (companyId) {
                try {
                    const plansRef = firebase.collection(firebase.db, 'companies', companyId, 'plans');
                    const docRef = await firebase.addDoc(plansRef, plan);
                    plan.id = docRef.id; // Обновляем ID после сохранения в Firebase
                    savedPlans.push(plan);
                    console.log('✅ План збережено в Firebase для співробітника:', plan.employeeName);
                } catch (firebaseError) {
                    console.error('❌ Помилка збереження плану в Firebase:', firebaseError);
                    savedPlans.push(plan); // Продолжаем с локальными данными
                }
            } else {
                savedPlans.push(plan);
            }
        }
        
        // Сохраняем в localStorage для локальных данных или как резерв
        try {
            localStorage.setItem('planFactData', JSON.stringify({
                planTemplates: getState().planFactData.planTemplates,
                focusTypes: getState().planFactData.focusTypes,
                plans: getState().planFactData.plans,
                goals: getState().planFactData.goals
            }));
            console.log('✅ Плани збережено в localStorage');
        } catch (storageError) {
            console.error('❌ Помилка збереження планів в localStorage:', storageError);
        }
        
        // Создаем запись в истории массовых назначений
        const assignmentRecord = {
            id: 'assignment-' + Date.now(),
            templateId: templateId,
            templateName: template.name,
            month: month,
            monthKey: month.replace('-', ''),
            departmentId: template.department,
            departmentName: getDepartmentName(template.department),
            employeesCount: savedPlans.length,
            employeeIds: savedPlans.map(p => p.employeeId),
            employeeNames: savedPlans.map(p => p.employeeName),
            totalRevenuePlan: savedPlans.reduce((sum, p) => sum + (p.salesPlan?.revenue?.plan || 0), 0),
            createdAt: new Date().toISOString(),
            createdBy: getState().state?.currentUser?.uid || 'demo-user'
        };
        
        // Сохраняем историю назначений
        if (!getState().planFactData.massAssignmentHistory) {
            getState().planFactData.massAssignmentHistory = [];
        }
        getState().planFactData.massAssignmentHistory.unshift(assignmentRecord); // Добавляем в начало
        
        // Ограничиваем историю до 50 записей
        if (getState().planFactData.massAssignmentHistory.length > 50) {
            getState().planFactData.massAssignmentHistory = getState().planFactData.massAssignmentHistory.slice(0, 50);
        }
        
        // Сохраняем историю в localStorage
        try {
            localStorage.setItem('planFactData', JSON.stringify({
                planTemplates: getState().planFactData.planTemplates,
                focusTypes: getState().planFactData.focusTypes,
                plans: getState().planFactData.plans,
                goals: getState().planFactData.goals,
                massAssignmentHistory: getState().planFactData.massAssignmentHistory
            }));
        } catch (storageError) {
            console.error('❌ Помилка збереження історії в localStorage:', storageError);
        }
        
        showToast(`✅ Створено ${savedPlans.length} планів та збережено в систему!`, 'success');
        
        // Сбрасываем форму
        resetMassAssignment();
        
        // Обновляем интерфейс
        setTimeout(() => {
            renderMassAssignmentTab();
            
            // Переключаемся на дашборд если нужно
            if (window.switchPlanFactTab) {
                window.switchPlanFactTab('dashboard');
            }
        }, 1000);
        
        console.log('✅ Створено планів:', employeePlans.length);
        
    } catch (error) {
        console.error('❌ Помилка збереження планів:', error);
        showToast('❌ Помилка збереження планів', 'error');
    }
} 

/**
 * Показ деталей назначения
 */
window.showAssignmentDetails = function(assignmentId) {
    const assignment = getState().planFactData?.massAssignmentHistory?.find(a => a.id === assignmentId);
    if (!assignment) {
        showToast('❌ Призначення не знайдено', 'error');
        return;
    }
    
    const modalHTML = `
        <div id="assignmentDetailsModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-white">Деталі призначення</h3>
                        <button onclick="closeModal('assignmentDetailsModal')" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="space-y-6">
                        <!-- Основна інформація -->
                        <div class="bg-gray-700 rounded-lg p-4">
                            <h4 class="text-lg font-bold text-white mb-3">Основна інформація</h4>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-300">Шаблон:</label>
                                    <p class="text-white">${assignment.templateName}</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-300">Відділ:</label>
                                    <p class="text-white">${assignment.departmentName}</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-300">Місяць:</label>
                                    <p class="text-white">${formatMonthKey(assignment.monthKey)}</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-300">Дата створення:</label>
                                    <p class="text-white">${new Date(assignment.createdAt).toLocaleDateString('uk-UA')} ${new Date(assignment.createdAt).toLocaleTimeString('uk-UA')}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Статистика -->
                        <div class="bg-gray-700 rounded-lg p-4">
                            <h4 class="text-lg font-bold text-white mb-3">Статистика</h4>
                            <div class="grid grid-cols-3 gap-4">
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-blue-400">${assignment.employeesCount}</div>
                                    <div class="text-sm text-gray-400">Співробітників</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-green-400">${formatCurrency(assignment.totalRevenuePlan)}</div>
                                    <div class="text-sm text-gray-400">Загальний план</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-purple-400">${formatCurrency(assignment.totalRevenuePlan / assignment.employeesCount)}</div>
                                    <div class="text-sm text-gray-400">Середній план</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Список співробітників -->
                        <div class="bg-gray-700 rounded-lg p-4">
                            <h4 class="text-lg font-bold text-white mb-3">Співробітники (${assignment.employeesCount})</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                ${assignment.employeeNames.map((name, index) => `
                                    <div class="flex items-center justify-between p-2 bg-gray-600 rounded">
                                        <span class="text-white">${name}</span>
                                        <button onclick="viewEmployeePlan('${assignment.employeeIds[index]}', '${assignment.monthKey}')" 
                                                class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                            План
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end mt-6">
                        <button onclick="closeModal('assignmentDetailsModal')" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Закрити
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('assignmentDetailsModal').classList.remove('hidden');
};

/**
 * Перегляд планів назначення
 */
window.viewAssignmentPlans = function(assignmentId) {
    const assignment = getState().planFactData?.massAssignmentHistory?.find(a => a.id === assignmentId);
    if (!assignment) {
        showToast('❌ Призначення не знайдено', 'error');
        return;
    }
    
    // Находим планы для этого назначения
    const assignmentPlans = getState().planFactData?.plans?.filter(plan => 
        assignment.employeeIds.includes(plan.employeeId) && 
        plan.monthKey === assignment.monthKey
    ) || [];
    
    if (assignmentPlans.length === 0) {
        showToast('❌ Плани для цього призначення не знайдено', 'error');
        return;
    }
    
    const modalHTML = `
        <div id="assignmentPlansModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-white">Плани назначення: ${assignment.templateName}</h3>
                        <button onclick="closeModal('assignmentPlansModal')" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-700">
                                <tr>
                                    <th class="px-4 py-3 text-left text-white">Співробітник</th>
                                    <th class="px-4 py-3 text-center text-white">План продажів</th>
                                    <th class="px-4 py-3 text-center text-white">Фокусні задачі</th>
                                    <th class="px-4 py-3 text-center text-white">Статус</th>
                                    <th class="px-4 py-3 text-center text-white">Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${assignmentPlans.map(plan => `
                                    <tr class="border-b border-gray-600">
                                        <td class="px-4 py-3">
                                            <div class="text-white font-medium">${plan.employeeName}</div>
                                            <div class="text-sm text-gray-400">${plan.departmentName}</div>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <div class="text-white font-medium">${formatCurrency(plan.salesPlan?.revenue?.plan || 0)}</div>
                                            <div class="text-sm text-gray-400">Факт: ${formatCurrency(plan.salesPlan?.revenue?.fact || 0)}</div>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <div class="text-white">${plan.focusTasks?.length || 0}</div>
                                            <div class="text-sm text-gray-400">
                                                ${plan.focusTasks?.filter(task => task.fact >= task.plan).length || 0} виконано
                                            </div>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <span class="px-2 py-1 rounded-full text-xs ${
                                                plan.status === 'active' ? 'bg-green-600 text-white' : 
                                                plan.status === 'draft' ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-white'
                                            }">
                                                ${plan.status === 'active' ? 'Активний' : plan.status === 'draft' ? 'Чернетка' : 'Завершений'}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <button onclick="viewEmployeePlan('${plan.employeeId}', '${plan.monthKey}')" 
                                                    class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                                Деталі
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="flex justify-between mt-6">
                        <div class="text-gray-400 text-sm">
                            Всього планів: ${assignmentPlans.length} • 
                            Загальна сума: ${formatCurrency(assignmentPlans.reduce((sum, p) => sum + (p.salesPlan?.revenue?.plan || 0), 0))} грн
                        </div>
                        <button onclick="closeModal('assignmentPlansModal')" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Закрити
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('assignmentPlansModal').classList.remove('hidden');
};

/**
 * Перегляд плану співробітника
 */
window.viewEmployeePlan = function(employeeId, monthKey) {
    // Переходим на дашборд с фильтрами
    if (window.switchPlanFactTab) {
        window.switchPlanFactTab('dashboard');
        
        // Устанавливаем фильтры
        setTimeout(() => {
            const managerSelect = document.getElementById('dashboardManager');
            const monthInput = document.getElementById('dashboardMonth');
            
            if (managerSelect) {
                managerSelect.value = employeeId;
            }
            if (monthInput) {
                monthInput.value = monthKey.substring(0, 4) + '-' + monthKey.substring(4, 6);
            }
            
            // Обновляем дашборд
            if (window.updateDashboard) {
                window.updateDashboard();
            }
            
            // Закрываем все модальные окна
            document.querySelectorAll('[id$="Modal"]').forEach(modal => modal.remove());
            
            showToast('✅ Перехід до плану співробітника', 'success');
        }, 200);
    }
}; 

/**
 * Обновление истории массовых назначений
 */
window.refreshMassAssignmentHistory = function() {
    console.log('🔄 Обновление истории массовых назначений...');
    console.log('📋 История данных:', getState().planFactData?.massAssignmentHistory);
    
    const historyContainer = document.getElementById('massAssignmentHistory'); // Changed ID
    if (!historyContainer) {
        console.error('❌ Контейнер истории не найден');
        return;
    }
    
    try {
        const historyHTML = renderMassAssignmentHistory();
        historyContainer.innerHTML = historyHTML;
        console.log('✅ История массовых назначений обновлена');
    } catch (error) {
        console.error('❌ Ошибка обновления истории:', error);
        historyContainer.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <p>❌ Помилка завантаження історії</p>
                <p class="text-sm mt-2">${error.message}</p>
            </div>
        `;
    }
}; 