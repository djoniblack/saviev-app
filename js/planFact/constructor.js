// constructor.js - Конструктор планов і шаблонів

// Імпортуємо функції з центрального хранилища стану
import { getState, updateState } from './state.js';

import * as firebase from '../firebase.js';
import { openNomenclatureSelector, setNomenclatureSelectionCallback } from './nomenclatureSelector.js';

/**
 * Рендеринг конструктора планів
 */
export function renderConstructorTab(container = null) {
    // Если контейнер не передан, ищем его
    if (!container) {
        container = document.getElementById('plan-fact-content');
    }
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Заголовок та кнопки -->
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-white">Конструктор шаблонів планів</h2>
                <button onclick="showCreatePlanTemplateModal()" 
                        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    + Створити шаблон
                </button>
            </div>
            
            <!-- Фільтри -->
            <div class="bg-gray-700 rounded-lg p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Місяць</label>
                        <input type="month" id="constructorMonth" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" 
                               value="${new Date().toISOString().slice(0, 7)}" onchange="loadPlanTemplatesForMonth()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Відділ</label>
                        <select id="constructorDepartment" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadPlanTemplatesForMonth()">
                            <option value="">Всі відділи</option>
                            ${getState().planFactData?.departments?.map(dept => 
                                `<option value="${dept.id}">${dept.name}</option>`
                            ).join('') || ''}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Статус</label>
                        <select id="constructorStatus" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadPlanTemplatesForMonth()">
                            <option value="">Всі статуси</option>
                            <option value="active">Активні</option>
                            <option value="draft">Чернетки</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Список шаблонів планів -->
            <div class="bg-gray-700 rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-600">
                    <h3 class="text-lg font-bold text-white">Шаблони планів</h3>
                </div>
                <div id="planTemplatesList" class="p-4">
                    ${renderPlanTemplatesList()}
                </div>
            </div>
        </div>
    `;
    
    loadPlanTemplatesForMonth();
}

/**
 * Рендеринг списку шаблонів планів
 */
function renderPlanTemplatesList() {
    const filteredTemplates = getFilteredPlanTemplates();
    
    if (filteredTemplates.length === 0) {
        const hasCompanyId = !!window.state?.currentCompanyId;
        
        return `
            <div class="text-center py-8 text-gray-400">
                ${!hasCompanyId ? `
                    <div class="mb-6">
                        <div class="text-blue-400 text-4xl mb-4">🏢</div>
                        <p class="text-lg font-medium text-blue-300 mb-2">Компанія не налаштована</p>
                        <p class="text-sm text-gray-400 max-w-md mx-auto">
                            Для роботи з планами продажів потрібно спочатку налаштувати дані компанії та відділів.
                        </p>
                    </div>
                ` : ''}
                <p>Немає шаблонів планів для відображення</p>
                <p class="text-sm mt-2">
                    ${hasCompanyId ? 
                        'Створіть новий шаблон, натиснувши кнопку "Створити шаблон"' :
                        'Налаштуйте компанію щоб почати створювати плани продажів'
                    }
                </p>
                ${!hasCompanyId ? `
                    <div class="mt-6 pt-4 border-t border-gray-600">
                        <button onclick="loadDemoData()" 
                                class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">
                            🧪 Завантажити демо дані для тестування
                        </button>
                        <p class="text-xs text-gray-500 mt-2">Тільки для ознайомлення з функціоналом</p>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    return `
        <div class="space-y-4">
            ${filteredTemplates.map(template => `
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="text-lg font-bold text-white">${template.name}</h4>
                            <p class="text-sm text-gray-400">${getDepartmentName(template.department || template.departmentId)}</p>
                            <p class="text-xs text-gray-500">Місяць: ${formatMonthKey(template.monthKey || template.month)}</p>
                            <p class="text-xs text-gray-500">План продажів: ${formatCurrency(template.salesPlan || template.revenuePlan)} грн</p>
                        </div>
                        <div class="text-right">
                            <span class="px-2 py-1 rounded-full text-xs ${
                                template.status === 'active' ? 'bg-green-600 text-white' : 
                                template.status === 'draft' ? 'bg-yellow-600 text-white' :
                                'bg-gray-600 text-white'
                            }">
                                ${template.status === 'active' ? 'Активний' : template.status === 'draft' ? 'Чернетка' : 'Завершений'}
                            </span>
                        </div>
                    </div>
                    
                                         <!-- Фокусні задачі -->
                     ${template.focusTasks && template.focusTasks.length > 0 ? `
                         <div class="mt-3">
                             <p class="text-sm font-medium text-gray-300 mb-2">Фокусні задачі:</p>
                             <div class="flex flex-wrap gap-2">
                                 ${template.focusTasks.map(taskId => {
                                     const focusType = getFocusTypeById(taskId);
                                     return `
                                     <span class="px-2 py-1 bg-blue-600 text-white rounded text-xs">
                                             ${focusType ? focusType.name : taskId}
                                     </span>
                                     `;
                                 }).join('')}
                             </div>
                         </div>
                     ` : ''}
                     
                     <!-- Категорії номенклатури -->
                     ${template.nomenclatureFilters ? `
                         <div class="mt-3">
                             <p class="text-sm font-medium text-gray-300 mb-2">Категорії номенклатури:</p>
                             <div class="space-y-1">
                                 ${template.nomenclatureFilters.category1 && template.nomenclatureFilters.category1.length > 0 ? `
                                     <div class="text-xs">
                                         <span class="text-gray-400">Кат. 1:</span>
                                         <span class="text-white">${template.nomenclatureFilters.category1.join(', ')}</span>
                                     </div>
                                 ` : ''}
                                 ${template.nomenclatureFilters.category2 && template.nomenclatureFilters.category2.length > 0 ? `
                                     <div class="text-xs">
                                         <span class="text-gray-400">Кат. 2:</span>
                                         <span class="text-white">${template.nomenclatureFilters.category2.join(', ')}</span>
                                     </div>
                                 ` : ''}
                                 ${template.nomenclatureFilters.category3 && template.nomenclatureFilters.category3.length > 0 ? `
                                     <div class="text-xs">
                                         <span class="text-gray-400">Кат. 3:</span>
                                         <span class="text-white">${template.nomenclatureFilters.category3.join(', ')}</span>
                                     </div>
                                 ` : ''}
                                 ${(!template.nomenclatureFilters.category1 || template.nomenclatureFilters.category1.length === 0) &&
                                   (!template.nomenclatureFilters.category2 || template.nomenclatureFilters.category2.length === 0) &&
                                   (!template.nomenclatureFilters.category3 || template.nomenclatureFilters.category3.length === 0) ? `
                                     <div class="text-xs text-gray-400">Всі категорії</div>
                                 ` : ''}
                             </div>
                         </div>
                     ` : ''}
                    
                    <!-- Дії -->
                    <div class="flex gap-2 mt-4">
                        <button onclick="viewPlanTemplate('${template.id}')" 
                                class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                            Переглянути
                        </button>
                        <button onclick="editPlanTemplate('${template.id}')" 
                                class="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">
                            Редагувати
                        </button>
                        <button onclick="copyPlanTemplate('${template.id}')" 
                                class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                            Копіювати
                        </button>
                        <button onclick="activatePlanTemplate('${template.id}')" 
                                class="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                            ${template.status === 'active' ? 'Деактивувати' : 'Активувати'}
                        </button>
                        <button onclick="deletePlanTemplate('${template.id}')" 
                                class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                            Видалити
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Показ модального вікна створення шаблону плану
 */
window.showCreatePlanTemplateModal = function() {
    const modalHTML = `
        <div id="createPlanTemplateModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-semibold text-white">Створити шаблон плану</h3>
                    <button onclick="closeModal('createPlanTemplateModal')" class="text-gray-400 hover:text-white">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <form id="createPlanTemplateForm" class="space-y-6">
                    <!-- Назва шаблону -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Назва шаблону плану</label>
                        <input type="text" id="template-name" required 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                               placeholder="Наприклад: План Заклади, План Ресторан">
                    </div>
                    
                    <!-- Відділ -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Відділ</label>
                        <select id="template-department" required 
                                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500">
                            <option value="">Оберіть відділ</option>
                            ${getState().planFactData?.departments?.map(dept => 
                                `<option value="${dept.id}">${dept.name}</option>`
                            ).join('') || '<option disabled>Немає доступних відділів</option>'}
                        </select>
                    </div>
                    
                    <!-- Місяць -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Місяць</label>
                        <input type="month" id="template-month" required 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500">
                    </div>
                    
                    <!-- План продажів -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">План продажів (грн)</label>
                        <input type="number" id="template-sales-plan" required min="0" step="1000"
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                               placeholder="Введіть план продажів">
                    </div>
                    
                    <!-- Фокусні задачі -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Фокусні задачі</label>
                        <div id="focus-tasks-container" class="space-y-2">
                            <!-- Фокусні задачі будуть додані динамічно -->
                        </div>
                        <button type="button" id="add-focus-task-btn" 
                                class="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-500">
                            + Додати фокусну задачу
                        </button>
                    </div>
                    
                    <!-- Номенклатура для розрахунку фактів -->
                    <div id="template-nomenclature-section">
                        <label class="block text-sm font-medium text-gray-300 mb-2">Номенклатура для розрахунку фактів</label>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600">
                                <div>
                                    <span class="text-white font-medium">Обрати номенклатуру</span>
                                    <p class="text-sm text-gray-400" id="template-selected-nomenclature-info">Не обрано</p>
                                </div>
                                <button type="button" id="select-template-nomenclature-btn" 
                                        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
                                    Обрати
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Опис -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Опис (необов'язково)</label>
                        <textarea id="template-description" rows="3"
                                  class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                  placeholder="Детальний опис шаблону плану"></textarea>
                    </div>
                    
                    <!-- Кнопки -->
                    <div class="flex justify-end space-x-3 pt-4">
                        <button type="button" onclick="closeModal('createPlanTemplateModal')" 
                                class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">
                            Скасувати
                        </button>
                        <button type="submit" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500">
                            Створити шаблон
                        </button>
                    </div>
                </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Додаємо обробники подій
    setupTemplateFormEventListeners();
    
    // Завантажуємо фокусні задачі
    loadFocusTasksForTemplate();
    
    // Показуємо модальне вікно
    document.getElementById('createPlanTemplateModal').classList.remove('hidden');
};

/**
 * Налаштовує обробники подій для ієрархічного вибору в шаблонах
 */
function setupTemplateHierarchicalEventListeners() {
    // Обробник для категорії 1
    document.querySelectorAll('.template-nomenclature-category1-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const isChecked = this.checked;
            const categoryName = this.value;
            const hasChildren = this.dataset.hasChildren === 'true';
            const children = this.dataset.children ? this.dataset.children.split(',') : [];
            
            if (hasChildren) {
                // Встановлюємо всіх дітей
                children.forEach(childName => {
                    const childCheckbox = document.querySelector(`.template-nomenclature-category2-checkbox[value="${childName}"]`);
                    if (childCheckbox) {
                        childCheckbox.checked = isChecked;
                        childCheckbox.indeterminate = false;
                    }
                });
            }
            
            // Оновлюємо стан батьківських елементів
            updateTemplateParentCheckboxState(this);
        });
    });
    
    // Обробник для категорії 2
    document.querySelectorAll('.template-nomenclature-category2-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const isChecked = this.checked;
            const categoryName = this.value;
            const hasChildren = this.dataset.hasChildren === 'true';
            const children = this.dataset.children ? this.dataset.children.split(',') : [];
            
            if (hasChildren) {
                // Встановлюємо всіх дітей
                children.forEach(childName => {
                    const childCheckbox = document.querySelector(`.template-nomenclature-category3-checkbox[value="${childName}"]`);
                    if (childCheckbox) {
                        childCheckbox.checked = isChecked;
                        childCheckbox.indeterminate = false;
                    }
                });
            }
            
            // Оновлюємо стан батьківських елементів
            updateTemplateParentCheckboxState(this);
        });
    });
    
    // Обробник для категорії 3
    document.querySelectorAll('.template-nomenclature-category3-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateTemplateParentCheckboxState(this);
        });
    });
}

/**
 * Оновлює стан батьківського чекбоксу для шаблонів
 */
function updateTemplateParentCheckboxState(childCheckbox) {
    const parentName = childCheckbox.dataset.parent;
    if (!parentName) return;
    
    const parentCheckbox = document.querySelector(`.template-nomenclature-category${childCheckbox.dataset.category - 1}-checkbox[value="${parentName}"]`);
    if (!parentCheckbox) return;
    
    const siblings = document.querySelectorAll(`.template-nomenclature-category${childCheckbox.dataset.category}-checkbox[data-parent="${parentName}"]`);
    const checkedSiblings = Array.from(siblings).filter(cb => cb.checked);
    const uncheckedSiblings = Array.from(siblings).filter(cb => !cb.checked);
    
    if (checkedSiblings.length === siblings.length) {
        // Всі діти вибрані
        parentCheckbox.checked = true;
        parentCheckbox.indeterminate = false;
    } else if (checkedSiblings.length === 0) {
        // Жоден з дітей не вибраний
        parentCheckbox.checked = false;
        parentCheckbox.indeterminate = false;
    } else {
        // Частково вибрані діти
        parentCheckbox.checked = false;
        parentCheckbox.indeterminate = true;
    }
}

/**
 * Налаштовує обробники подій для ієрархічного вибору в шаблонах
 */
function setupTemplateFormEventListeners() {
    const selectNomenclatureBtn = document.getElementById('select-template-nomenclature-btn');
    const addFocusTaskBtn = document.getElementById('add-focus-task-btn');
    
    // Обробник для кнопки вибору номенклатури
    selectNomenclatureBtn.addEventListener('click', function() {
        // Отримуємо поточний вибір з форми
        const currentSelection = window.currentTemplateNomenclatureSelection || [];
        const currentFilterType = window.currentTemplateNomenclatureFilterType || 'include';
        
        // Відкриваємо селектор номенклатури
        openNomenclatureSelector(currentSelection, currentFilterType);
    });
    
    // Налаштовуємо callback для селектора номенклатури
    setNomenclatureSelectionCallback(function(result) {
        window.currentTemplateNomenclatureSelection = result.items;
        window.currentTemplateNomenclatureFilterType = result.filterType;
        
        // Оновлюємо інформацію про вибір
        const infoElement = document.getElementById('template-selected-nomenclature-info');
        if (result.items.length > 0) {
            infoElement.textContent = `Обрано ${result.items.length} позицій (${result.filterType === 'include' ? 'включити' : 'виключити'})`;
        } else {
            infoElement.textContent = 'Не обрано';
        }
    });
    
    // Обробник для додавання фокусної задачі
    addFocusTaskBtn.addEventListener('click', addFocusTaskToTemplate);
    
    // Обробник відправки форми
    document.getElementById('createPlanTemplateForm').addEventListener('submit', saveNewPlanTemplate);
}

/**
 * Додавання фокусної задачі до шаблону
 */
function addFocusTaskToTemplate() {
    const container = document.getElementById('focus-tasks-container');
    const taskId = `focus-task-${Date.now()}`;
    
    const taskHTML = `
        <div id="${taskId}" class="flex items-center space-x-3 p-3 bg-gray-700 rounded-md border border-gray-600">
            <select class="focus-task-type flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:border-blue-500">
                <option value="">Оберіть тип фокусної задачі</option>
                ${getState().planFactData.focusTypes ? getState().planFactData.focusTypes.map(type => 
                    `<option value="${type.id}">${type.name}</option>`
                ).join('') : ''}
            </select>
            <button type="button" onclick="removeFocusTaskFromTemplate('${taskId}')" 
                    class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
                Видалити
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', taskHTML);
}

/**
 * Видалення фокусної задачі з шаблону
 */
window.removeFocusTaskFromTemplate = function(taskId) {
    const taskElement = document.getElementById(taskId);
    if (taskElement) {
        taskElement.remove();
    }
};

/**
 * Завантаження фокусних задач для шаблону
 */
async function loadFocusTasksForTemplate() {
    try {
        const state = getState();
        if (!state.planFactData.focusTypes) {
            if (window.loadFocusTypesFromFirebase) {
                await window.loadFocusTypesFromFirebase();
            }
        }
        
        // Оновлюємо опції в існуючих селектах
        const focusTaskSelects = document.querySelectorAll('.focus-task-type');
        focusTaskSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Оберіть тип фокусної задачі</option>' +
                state.planFactData.focusTypes.map(type => 
                    `<option value="${type.id}" ${type.id === currentValue ? 'selected' : ''}>${type.name}</option>`
                ).join('');
        });
        
    } catch (error) {
        console.error('❌ Помилка завантаження фокусних задач для шаблону:', error);
    }
}

/**
 * Збереження нового шаблону плану
 */
async function saveNewPlanTemplate(e) {
    e.preventDefault();
    
    try {
        const name = document.getElementById('template-name').value.trim();
        const department = document.getElementById('template-department').value;
        const month = document.getElementById('template-month').value;
        const salesPlan = parseFloat(document.getElementById('template-sales-plan').value);
        const description = document.getElementById('template-description').value.trim();
        
        if (!name || !department || !month || !salesPlan) {
            showToast('❌ Заповніть всі обов\'язкові поля', 'error');
            return;
        }
        
        // Збираємо обрані фокусні задачі
        const selectedFocusTasks = [];
        document.querySelectorAll('.focus-task-type').forEach(select => {
            if (select.value) {
                selectedFocusTasks.push(select.value);
            }
        });
        
        // Перевіряємо наявність необхідних даних
        const companyId = window.state?.currentCompanyId || window.state?.currentCompany?.id;
        const userId = window.state?.currentUser?.uid || 'demo-user';
        
        if (!companyId) {
            console.warn('⚠️ ID компанії не знайдено, зберігаємо локально');
        }
        
        const templateData = {
            name: name,
            department: department,
            monthKey: month.replace('-', ''),
            month: month,
            salesPlan: salesPlan,
            focusTasks: selectedFocusTasks,
            nomenclatureFilters: {
                items: window.currentTemplateNomenclatureSelection || [],
                filterType: window.currentTemplateNomenclatureFilterType || 'include'
            },
            description: description,
            companyId: companyId,
            createdBy: userId,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        
        // Зберігаємо в Firebase або локально
        let templateId;
        if (companyId) {
            try {
                const templatesRef = firebase.collection(firebase.db, 'companies', companyId, 'planTemplates');
                const docRef = await firebase.addDoc(templatesRef, templateData);
                templateId = docRef.id;
                console.log('✅ Новий шаблон плану створено в Firebase:', docRef.id);
            } catch (error) {
                console.error('❌ Помилка збереження в Firebase:', error);
                throw error;
            }
        } else {
            // Зберігаємо локально
            templateId = 'template-' + Date.now();
            templateData.id = templateId;
            
            const state = getState();
            if (!state.planFactData.planTemplates) {
                updateState({ 
                    planFactData: { 
                        ...state.planFactData, 
                        planTemplates: [] 
                    } 
                });
            }
            updateState({ 
                planFactData: { 
                    ...state.planFactData, 
                    planTemplates: [...(state.planFactData.planTemplates || []), templateData] 
                } 
            });
            console.log('✅ Новий шаблон плану створено локально:', templateId);
        }
        
        showToast('✅ Шаблон плану створено успішно', 'success');
        
        // Очищаємо форму
        document.getElementById('createPlanTemplateForm').reset();
        window.currentTemplateNomenclatureSelection = [];
        window.currentTemplateNomenclatureFilterType = 'include';
        document.getElementById('template-selected-nomenclature-info').textContent = 'Не обрано';
        document.getElementById('focus-tasks-container').innerHTML = '';
        
        // Закриваємо модальне вікно
        const modal = document.getElementById('createPlanTemplateModal');
        if (modal) {
            modal.remove();
        }
        
        // Оновлюємо список шаблонів
        setTimeout(() => {
            loadPlanTemplatesForMonth();
            console.log('✅ Список шаблонів оновлено після створення');
        }, 100);
        
    } catch (error) {
        console.error('❌ Помилка збереження шаблону плану:', error);
        showToast('❌ Помилка збереження шаблону плану', 'error');
    }
}

/**
 * Завантаження шаблонів планів з Firebase
 */
async function loadPlanTemplatesFromFirebase() {
    try {
        if (!window.state?.currentCompanyId) return;
        
        const templatesRef = firebase.collection(firebase.db, 'companies', window.state.currentCompanyId, 'planTemplates');
        const snapshot = await firebase.getDocs(templatesRef);
        
        const templates = [];
        snapshot.forEach(doc => {
            templates.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateState({ 
            planFactData: { 
                ...getState().planFactData, 
                planTemplates: templates 
            } 
        });
        console.log('✅ Шаблони планів завантажено:', templates.length);
        
    } catch (error) {
        console.error('❌ Помилка завантаження шаблонів планів:', error);
        updateState({ 
            planFactData: { 
                ...getState().planFactData, 
                planTemplates: [] 
            } 
        });
    }
}

/**
 * Перегляд шаблону плану
 */
window.viewPlanTemplate = function(templateId) {
    const template = getState().planFactData.planTemplates?.find(t => t.id === templateId);
    if (!template) {
        alert('Шаблон не знайдено');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Перегляд шаблону плану</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="space-y-4">
                <div class="bg-gray-700 rounded-lg p-4">
                    <h3 class="text-lg font-bold text-white mb-3">Основна інформація</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-gray-400">Назва:</span>
                            <p class="text-white font-medium">${template.name}</p>
                        </div>
                        <div>
                            <span class="text-gray-400">Відділ:</span>
                            <p class="text-white font-medium">${template.departmentName}</p>
                        </div>
                        <div>
                            <span class="text-gray-400">Місяць:</span>
                            <p class="text-white font-medium">${formatMonthKey(template.monthKey)}</p>
                        </div>
                        <div>
                            <span class="text-gray-400">Статус:</span>
                            <p class="text-white font-medium">${template.status === 'active' ? 'Активний' : 'Чернетка'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-700 rounded-lg p-4">
                    <h3 class="text-lg font-bold text-white mb-3">План продажів</h3>
                    <p class="text-2xl font-bold text-green-400">${formatCurrency(template.revenuePlan)} грн</p>
                </div>
                
                ${template.focusTasks && template.focusTasks.length > 0 ? `
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-lg font-bold text-white mb-3">Фокусні задачі</h3>
                        <div class="space-y-2">
                            ${template.focusTasks.map(task => `
                                <div class="flex items-center gap-3 p-2 bg-gray-600 rounded">
                                    <span class="text-white font-medium">${task.focusTypeName}</span>
                                    <span class="text-gray-400 text-sm">(${task.focusType === 'quantity' ? 'Кількість' : 'Сума'} - ${task.focusUnit})</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="flex justify-end mt-6">
                <button onclick="this.closest('.fixed').remove()" 
                        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    Закрити
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

/**
 * Редагування шаблону плану
 */
window.editPlanTemplate = function(templateId) {
    const { planFactData } = getState();
    const template = planFactData.planTemplates?.find(t => t.id === templateId);
    if (!template) {
        showToast('❌ Шаблон не знайдено', 'error');
        return;
    }
    
    // Создаем модальное окно редактирования (похоже на создание, но с предзаполненными данными)
    const modalHTML = `
        <div id="editPlanTemplateModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-white">Редагувати шаблон плану: ${template.name}</h3>
                        <button onclick="closeModal('editPlanTemplateModal')" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <form id="editPlanTemplateForm" class="space-y-6">
                        <!-- Назва шаблону -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Назва шаблону плану</label>
                            <input type="text" id="edit-template-name" required 
                                   value="${template.name}"
                                   class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                        </div>
                        
                        <!-- Відділ -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Відділ</label>
                            <select id="edit-template-department" required 
                                    class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500">
                                <option value="">Оберіть відділ</option>
                                ${getState().planFactData?.departments?.map(dept => 
                                    `<option value="${dept.id}" ${dept.id === template.department ? 'selected' : ''}>${dept.name}</option>`
                                ).join('') || '<option disabled>Немає доступних відділів</option>'}
                            </select>
                        </div>
                        
                        <!-- Місяць -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Місяць</label>
                            <input type="month" id="edit-template-month" required 
                                   value="${template.month || (template.monthKey ? template.monthKey.substring(0,4) + '-' + template.monthKey.substring(4,6) : '')}"
                                   class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500">
                        </div>
                        
                        <!-- План продажів -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">План продажів (грн)</label>
                            <input type="number" id="edit-template-sales-plan" required min="0" step="1000"
                                   value="${template.salesPlan || 0}"
                                   class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                        </div>
                        
                        <!-- Фокусні задачі -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Фокусні задачі</label>
                            <div id="edit-focus-tasks-container" class="space-y-2">
                                <!-- Існуючі фокусні задачі -->
                                ${template.focusTasks ? template.focusTasks.map(taskId => {
                                    const focusType = getFocusTypeById(taskId);
                                    const editTaskId = `edit-focus-task-${Date.now()}-${Math.random()}`;
                                    return `
                                        <div id="${editTaskId}" class="flex items-center space-x-3 p-3 bg-gray-700 rounded-md border border-gray-600">
                                            <select class="edit-focus-task-type flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:border-blue-500">
                                                <option value="">Оберіть тип фокусної задачі</option>
                                                ${getState().planFactData.focusTypes ? getState().planFactData.focusTypes.map(type => 
                                                    `<option value="${type.id}" ${type.id === taskId ? 'selected' : ''}>${type.name}</option>`
                                                ).join('') : ''}
                                            </select>
                                            <button type="button" onclick="removeEditFocusTask('${editTaskId}')" 
                                                    class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
                                                Видалити
                                            </button>
                                        </div>
                                    `;
                                }).join('') : ''}
                            </div>
                            <button type="button" id="edit-add-focus-task-btn" 
                                    class="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-500">
                                + Додати фокусну задачу
                            </button>
                        </div>
                        
                        <!-- Опис -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Опис (необов'язково)</label>
                            <textarea id="edit-template-description" rows="3"
                                      class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                      placeholder="Детальний опис шаблону плану">${template.description || ''}</textarea>
                        </div>
                        
                        <!-- Кнопки -->
                        <div class="flex justify-end space-x-3 pt-4">
                            <button type="button" onclick="closeModal('editPlanTemplateModal')" 
                                    class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">
                                Скасувати
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500">
                                Зберегти зміни
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Додаємо обробники подій
    setupEditTemplateEventListeners(template);
    
    // Показуємо модальне вікно
    document.getElementById('editPlanTemplateModal').classList.remove('hidden');
};

/**
 * Налаштування обробників подій для редагування шаблону
 */
function setupEditTemplateEventListeners(template) {
    // Обробник додавання фокусної задачі
    document.getElementById('edit-add-focus-task-btn').addEventListener('click', function() {
        const container = document.getElementById('edit-focus-tasks-container');
        const taskId = `edit-focus-task-${Date.now()}`;
        
        const taskHTML = `
            <div id="${taskId}" class="flex items-center space-x-3 p-3 bg-gray-700 rounded-md border border-gray-600">
                <select class="edit-focus-task-type flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:border-blue-500">
                    <option value="">Оберіть тип фокусної задачі</option>
                    ${getState().planFactData.focusTypes ? getState().planFactData.focusTypes.map(type => 
                        `<option value="${type.id}">${type.name}</option>`
                    ).join('') : ''}
                </select>
                <button type="button" onclick="removeEditFocusTask('${taskId}')" 
                        class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
                    Видалити
                </button>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', taskHTML);
    });
    
    // Обробник відправки форми
    document.getElementById('editPlanTemplateForm').addEventListener('submit', function(e) {
        saveEditedPlanTemplate(e, template);
    });
}

/**
 * Видалення фокусної задачі при редагуванні
 */
window.removeEditFocusTask = function(taskId) {
    const taskElement = document.getElementById(taskId);
    if (taskElement) {
        taskElement.remove();
    }
};

/**
 * Збереження відредагованого шаблону плану
 */
async function saveEditedPlanTemplate(e, originalTemplate) {
    e.preventDefault();
    
    try {
        const name = document.getElementById('edit-template-name').value.trim();
        const department = document.getElementById('edit-template-department').value;
        const month = document.getElementById('edit-template-month').value;
        const salesPlan = parseFloat(document.getElementById('edit-template-sales-plan').value);
        const description = document.getElementById('edit-template-description').value.trim();
        
        if (!name || !department || !month || !salesPlan) {
            showToast('❌ Заповніть всі обов\'язкові поля', 'error');
            return;
        }
        
        // Збираємо обрані фокусні задачі
        const selectedFocusTasks = [];
        document.querySelectorAll('.edit-focus-task-type').forEach(select => {
            if (select.value) {
                selectedFocusTasks.push(select.value);
            }
        });
        
        // Оновлюємо дані шаблону
        const updatedTemplate = {
            ...originalTemplate,
            name: name,
            department: department,
            monthKey: month.replace('-', ''),
            month: month,
            salesPlan: salesPlan,
            focusTasks: selectedFocusTasks,
            description: description,
            updatedAt: new Date().toISOString()
        };
        
        // Зберігаємо в Firebase або локально
        const companyId = window.state?.currentCompanyId;
        if (companyId && originalTemplate.id && !originalTemplate.id.startsWith('template-')) {
            try {
                const templateRef = firebase.doc(firebase.db, 'companies', companyId, 'planTemplates', originalTemplate.id);
                await firebase.updateDoc(templateRef, updatedTemplate);
                console.log('✅ Шаблон оновлено в Firebase');
            } catch (firebaseError) {
                console.error('❌ Помилка оновлення в Firebase:', firebaseError);
                throw firebaseError;
            }
        } else {
            // Оновлюємо в локальних даних
            const state = getState();
            const templateIndex = state.planFactData.planTemplates?.findIndex(t => t.id === originalTemplate.id);
            if (templateIndex !== -1) {
                const updatedTemplates = [...state.planFactData.planTemplates];
                updatedTemplates[templateIndex] = updatedTemplate;
                updateState({ 
                    planFactData: { 
                        ...state.planFactData, 
                        planTemplates: updatedTemplates 
                    } 
                });
            }
            
            // Зберігаємо в localStorage
            try {
                localStorage.setItem('planFactData', JSON.stringify({
                    planTemplates: state.planFactData.planTemplates,
                    focusTypes: state.planFactData.focusTypes,
                    plans: state.planFactData.plans,
                    goals: state.planFactData.goals
                }));
                console.log('✅ Шаблон оновлено локально');
            } catch (storageError) {
                console.error('❌ Помилка збереження в localStorage:', storageError);
            }
        }
        
        showToast('✅ Шаблон плану оновлено успішно', 'success');
        
        // Закриваємо модальне вікно
        const modal = document.getElementById('editPlanTemplateModal');
        if (modal) {
            modal.remove();
        }
        
        // Оновлюємо список шаблонів
        setTimeout(() => {
            loadPlanTemplatesForMonth();
            console.log('✅ Список шаблонів оновлено після редагування');
        }, 100);
        
    } catch (error) {
        console.error('❌ Помилка збереження шаблону плану:', error);
        showToast('❌ Помилка збереження змін шаблону плану', 'error');
    }
}

/**
 * Копіювання шаблону плану
 */
window.copyPlanTemplate = function(templateId) {
    // Перевіряємо права
    if (!window.hasPermission?.('planfact_create_templates')) {
        alert('У вас немає прав для створення шаблонів планів');
        return;
    }
    
    const state = getState();
    const template = state.planFactData.planTemplates?.find(t => t.id === templateId);
    if (!template) {
        alert('Шаблон не знайдено');
        return;
    }
    
    // Копіюємо шаблон з новим місяцем
    const newTemplate = {
        ...template,
        name: `${template.name} (копія)`,
        monthKey: state.planFactData.currentMonth.replace('-', ''),
        status: 'draft',
        createdAt: new Date()
    };
    
    // Зберігаємо копію
    const docRef = firebase.doc(firebase.db, 'companies', window.state.currentCompanyId, 'planTemplates', `${template.departmentId}_${newTemplate.monthKey}`);
    firebase.setDoc(docRef, newTemplate).then(() => {
        loadPlanTemplatesFromFirebase().then(() => {
            loadPlanTemplatesForMonth();
            alert('Шаблон скопійовано успішно!');
        });
    }).catch(error => {
        console.error('Помилка копіювання шаблону:', error);
        alert('Помилка копіювання шаблону');
    });
};

/**
 * Активування/деактивування шаблону плану
 */
window.activatePlanTemplate = function(templateId) {
    // Перевіряємо права
    if (!window.hasPermission?.('planfact_activate_templates')) {
        alert('У вас немає прав для активування/деактивування шаблонів планів');
        return;
    }
    
    const { planFactData } = getState();
    const template = planFactData.planTemplates?.find(t => t.id === templateId);
    if (!template) {
        alert('Шаблон не знайдено');
        return;
    }
    
    const newStatus = template.status === 'active' ? 'draft' : 'active';
    
    const docRef = firebase.doc(firebase.db, 'companies', window.state.currentCompanyId, 'planTemplates', templateId);
    firebase.updateDoc(docRef, { status: newStatus }).then(() => {
        loadPlanTemplatesFromFirebase().then(() => {
            loadPlanTemplatesForMonth();
            alert(`Шаблон ${newStatus === 'active' ? 'активовано' : 'деактивовано'}!`);
        });
    }).catch(error => {
        console.error('Помилка зміни статусу шаблону:', error);
        alert('Помилка зміни статусу шаблону');
    });
};

/**
 * Видалення шаблону плану
 */
window.deletePlanTemplate = function(templateId) {
    if (!confirm('Ви впевнені, що хочете видалити цей шаблон?')) {
        return;
    }
    
    const { planFactData } = getState();
    const currentTemplates = planFactData.planTemplates || [];
    
    // Создаем новый массив без удаленного элемента
    const updatedTemplates = currentTemplates.filter(t => t.id !== templateId);
    
    // Проверяем, был ли элемент действительно удален
    if (updatedTemplates.length < currentTemplates.length) {
        // Обновляем состояние с новым массивом
        updateState({ 
            planFactData: { 
                ...planFactData, 
                planTemplates: updatedTemplates 
            } 
        });
        
        // Перерисовываем список
        loadPlanTemplatesForMonth();
        showToast('✅ Шаблон видалено', 'success');
    } else {
        showToast('❌ Шаблон не знайдено', 'error');
    }
    // Логику для Firebase нужно добавить сюда, если используется
};

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
 * Отримання відфільтрованих шаблонів планів
 */
function getFilteredPlanTemplates() {
    const state = getState();
    const monthFilter = document.getElementById('constructorMonth')?.value || state.planFactData?.currentMonth;
    const departmentFilter = document.getElementById('constructorDepartment')?.value || '';
    const statusFilter = document.getElementById('constructorStatus')?.value || '';
    

    
    const filtered = state.planFactData?.planTemplates?.filter(template => {
        // Конвертуємо monthFilter в формат monthKey (без дефісу)
        if (monthFilter) {
            const expectedMonthKey = monthFilter.replace('-', '');
            if (template.monthKey !== expectedMonthKey) {
                return false;
            }
        }
        if (departmentFilter && template.departmentId !== departmentFilter) {
            return false;
        }
        if (statusFilter && template.status !== statusFilter) {
            return false;
        }
        return true;
    }) || [];
    

    return filtered;
}

/**
 * Завантаження шаблонів для місяця
 */
window.loadPlanTemplatesForMonth = function() {
    const planTemplatesList = document.getElementById('planTemplatesList');
    if (planTemplatesList) {
        planTemplatesList.innerHTML = renderPlanTemplatesList();
    } else {
        console.error('❌ Елемент planTemplatesList не знайдено');
    }
};

/**
 * Получение названия отдела по ID
 */
function getDepartmentName(departmentId) {
    if (!departmentId) return 'Не вказано';
    const state = getState();
    const department = state.planFactData?.departments?.find(dept => dept.id === departmentId);
    return department ? department.name : departmentId;
}

/**
 * Получение типа фокуса по ID
 */
function getFocusTypeById(focusTypeId) {
    if (!focusTypeId) return null;
    const state = getState();
    return state.planFactData?.focusTypes?.find(type => type.id === focusTypeId) || null;
}

/**
 * Перегляд шаблону плану
 */
window.viewPlanTemplate = function(templateId) {
    const { planFactData } = getState();
    const template = planFactData.planTemplates?.find(t => t.id === templateId);
    if (!template) {
        showToast('❌ Шаблон не знайдено', 'error');
        return;
    }
    
    const modalHTML = `
        <div id="viewTemplateModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-white">Перегляд шаблону: ${template.name}</h3>
                        <button onclick="closeModal('viewTemplateModal')" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300">Назва:</label>
                                <p class="text-white">${template.name}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300">Відділ:</label>
                                <p class="text-white">${getDepartmentName(template.department)}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300">Місяць:</label>
                                <p class="text-white">${formatMonthKey(template.monthKey || template.month)}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300">План продажів:</label>
                                <p class="text-white">${formatCurrency(template.salesPlan)} грн</p>
                            </div>
                        </div>
                        
                        ${template.description ? `
                            <div>
                                <label class="block text-sm font-medium text-gray-300">Опис:</label>
                                <p class="text-white">${template.description}</p>
                            </div>
                        ` : ''}
                        
                        ${template.focusTasks && template.focusTasks.length > 0 ? `
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">Фокусні задачі:</label>
                                <div class="space-y-2">
                                    ${template.focusTasks.map(taskId => {
                                        const focusType = getFocusTypeById(taskId);
                                        return `
                                            <div class="p-2 bg-gray-700 rounded">
                                                <span class="text-white">${focusType ? focusType.name : taskId}</span>
                                                ${focusType ? `<span class="text-gray-400 text-sm ml-2">(${focusType.type})</span>` : ''}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('viewTemplateModal').classList.remove('hidden');
};

/**
 * Копіювання шаблону плану
 */
window.copyPlanTemplate = function(templateId) {
    const { planFactData } = getState();
    const template = planFactData.planTemplates?.find(t => t.id === templateId);
    if (!template) {
        showToast('❌ Шаблон не знайдено', 'error');
        return;
    }
    
    const newTemplate = {
        ...template,
        id: 'template-' + Date.now(),
        name: template.name + ' (копія)',
        createdAt: new Date().toISOString(),
        status: 'draft'
    };
    
    // Обновляем состояние с новым шаблоном
    const updatedTemplates = [...(planFactData.planTemplates || []), newTemplate];
    updateState({ 
        planFactData: { 
            ...planFactData, 
            planTemplates: updatedTemplates 
        } 
    });
    
    loadPlanTemplatesForMonth();
    showToast('✅ Шаблон скопійовано', 'success');
};

/**
 * Активація/деактивація шаблону плану
 */
window.activatePlanTemplate = async function(templateId) {
    const { planFactData } = getState();
    const template = planFactData.planTemplates?.find(t => t.id === templateId);
    if (!template) {
        showToast('❌ Шаблон не знайдено', 'error');
        return;
    }
    
    const newStatus = template.status === 'active' ? 'draft' : 'active';
    const companyId = window.state?.currentCompanyId;
    
    try {
        // Обновляем статус в центральном состоянии
        const updatedTemplates = planFactData.planTemplates.map(t => 
            t.id === templateId 
                ? { ...t, status: newStatus, updatedAt: new Date().toISOString() }
                : t
        );
        
        updateState({ 
            planFactData: { 
                ...planFactData, 
                planTemplates: updatedTemplates 
            } 
        });
        
        // Сохраняем в Firebase если есть companyId
        if (companyId) {
            try {
                const templateRef = firebase.doc(firebase.db, 'companies', companyId, 'planTemplates', templateId);
                await firebase.updateDoc(templateRef, {
                    status: newStatus,
                    updatedAt: new Date().toISOString()
                });
                console.log('✅ Статус шаблону збережено в Firebase');
            } catch (firebaseError) {
                console.error('❌ Помилка збереження в Firebase:', firebaseError);
                // Продолжаем работу с локальными данными
            }
        } else {
            // Сохраняем в localStorage для локальных данных
            try {
                localStorage.setItem('planFactData', JSON.stringify({
                    planTemplates: updatedTemplates,
                    focusTypes: planFactData.focusTypes,
                    plans: planFactData.plans,
                    goals: planFactData.goals
                }));
                console.log('✅ Статус шаблону збережено в localStorage');
            } catch (storageError) {
                console.error('❌ Помилка збереження в localStorage:', storageError);
            }
        }
        
        // Обновляем интерфейс
        loadPlanTemplatesForMonth();
        showToast(`✅ Шаблон ${newStatus === 'active' ? 'активовано' : 'деактивовано'}`, 'success');
        
    } catch (error) {
        console.error('❌ Помилка зміни статусу шаблону:', error);
        showToast('❌ Помилка зміни статусу шаблону', 'error');
    }
};

/**
 * Видалення шаблону плану
 */
window.deletePlanTemplate = function(templateId) {
    if (!confirm('Ви впевнені, що хочете видалити цей шаблон?')) {
        return;
    }
    
    const { planFactData } = getState();
    const currentTemplates = planFactData.planTemplates || [];
    
    // Создаем новый массив без удаленного элемента
    const updatedTemplates = currentTemplates.filter(t => t.id !== templateId);
    
    // Проверяем, был ли элемент действительно удален
    if (updatedTemplates.length < currentTemplates.length) {
        // Обновляем состояние с новым массивом
        updateState({ 
            planFactData: { 
                ...planFactData, 
                planTemplates: updatedTemplates 
            } 
        });
        
        // Перерисовываем список
        loadPlanTemplatesForMonth();
        showToast('✅ Шаблон видалено', 'success');
    } else {
        showToast('❌ Шаблон не знайдено', 'error');
    }
    // Логику для Firebase нужно добавить сюда, если используется
}; 