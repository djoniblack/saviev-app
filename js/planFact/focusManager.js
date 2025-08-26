// focusManager.js - Підмодуль управління фокусними задачами
import * as firebase from '../firebase.js';
import { openNomenclatureSelector, setNomenclatureSelectionCallback } from './nomenclatureSelector.js';
import { getState, updateState } from './state.js';

/**
 * Завантаження типів фокусів
 */
function loadFocusTypes() {
    console.log('🎯 Завантаження типів фокусів...');
    
    const focusTypesList = document.getElementById('focusTypesList');
    if (!focusTypesList) {
        console.error('❌ Контейнер списку типів фокусів не знайдено');
        return;
    }
    
    // Отримуємо відфільтровані типи фокусів
    const filteredFocusTypes = getFilteredFocusTypes();
    
    // Оновлюємо список
    focusTypesList.innerHTML = renderFocusTypesList(filteredFocusTypes);
    
    console.log(`✅ Завантажено ${filteredFocusTypes.length} типів фокусів`);
}

/**
 * Отримання відфільтрованих типів фокусів
 */
function getFilteredFocusTypes() {
    const allFocusTypes = getState().planFactData?.focusTypes || [];
    const categoryFilter = document.getElementById('focusCategoryFilter')?.value;
    const typeFilter = document.getElementById('focusTypeFilter')?.value;
    
    return allFocusTypes.filter(focusType => {
        if (categoryFilter && focusType.category !== categoryFilter) {
            return false;
        }
        if (typeFilter && focusType.type !== typeFilter) {
            return false;
        }
        return true;
    });
}

/**
 * Рендеринг списку типів фокусів
 */
function renderFocusTypesList(focusTypes = null) {
    // Если не переданы типы фокусов, получаем их из состояния
    if (!focusTypes) {
        focusTypes = getState().planFactData?.focusTypes || [];
    }
    
    if (focusTypes.length === 0) {
        return `
            <div class="text-center py-8 text-gray-400">
                <p>Немає типів фокусних задач</p>
                <p class="text-sm mt-2">Створіть перший тип фокусу, натиснувши кнопку "Створити тип фокусу"</p>
            </div>
        `;
    }
    
    return `
        <div class="space-y-4">
            ${focusTypes.map(focusType => `
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="text-lg font-bold text-white">${focusType.name}</h4>
                            <p class="text-sm text-gray-400">${focusType.description}</p>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-2 py-1 rounded text-xs ${focusType.type === 'revenue' ? 'bg-green-600' : 'bg-blue-600'} text-white">
                                    ${focusType.type === 'revenue' ? 'Грошовий' : 'Кількісний'}
                                </span>
                                <span class="px-2 py-1 rounded text-xs bg-gray-600 text-white">
                                    ${focusType.unit}
                                </span>
                                <span class="px-2 py-1 rounded text-xs bg-purple-600 text-white">
                                    ${focusType.category}
                                </span>
                                <span class="px-2 py-1 rounded text-xs ${focusType.calculationMethod?.startsWith('auto_') ? 'bg-orange-600' : 'bg-blue-600'} text-white">
                                    ${getCalculationMethodLabel(focusType.calculationMethod || 'manual')}
                                </span>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="px-2 py-1 rounded-full text-xs ${focusType.active !== false ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}">
                                ${focusType.active !== false ? 'Активний' : 'Неактивний'}
                            </span>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="editFocusType('${focusType.id}')" 
                                class="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm">
                            Редагувати
                        </button>
                        ${focusType.active !== false ? 
                            `<button onclick="deactivateFocusType('${focusType.id}')" 
                                     class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                                Деактивувати
                            </button>` :
                            `<button onclick="activateFocusType('${focusType.id}')" 
                                     class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                                Активувати
                            </button>`
                        }
                        <button onclick="deleteFocusType('${focusType.id}')" 
                                class="px-3 py-1 bg-red-800 text-white rounded hover:bg-red-900 text-sm">
                            Видалити
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Рендеринг вкладки управления фокусами
 */
export function renderFocusManagerTab(container = null) {
    // Если контейнер не передан, ищем его
    if (!container) {
        container = document.getElementById('plan-fact-content');
    }
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Заголовок та кнопки -->
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-white">Управління фокусними задачами</h2>
                <button onclick="showCreateFocusTypeModal()" 
                        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    + Створити тип фокусу
                </button>
            </div>
            
            <!-- Фільтри -->
            <div class="bg-gray-700 rounded-lg p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Категорія</label>
                        <select id="focusCategoryFilter" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadFocusTypes()">
                            <option value="">Всі категорії</option>
                            <option value="sales">Продажі</option>
                            <option value="communication">Комунікація</option>
                            <option value="financial">Фінанси</option>
                            <option value="other">Інше</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Тип</label>
                        <select id="focusTypeFilter" class="w-full bg-gray-600 border border-gray-500 rounded text-white p-2" onchange="loadFocusTypes()">
                            <option value="">Всі типи</option>
                            <option value="quantity">Кількість</option>
                            <option value="revenue">Виручка</option>
                            <option value="percentage">Відсоток</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Список типів фокусів -->
            <div class="bg-gray-700 rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-600">
                    <h3 class="text-lg font-bold text-white">Типи фокусних задач</h3>
                </div>
                <div id="focusTypesList" class="p-4">
                    ${renderFocusTypesList()}
                </div>
            </div>
        </div>
    `;
    
    loadFocusTypes();
}

/**
 * Показ модального вікна створення типу фокусу
 */
window.showCreateFocusTypeModal = function() {
    const modalHTML = `
        <div id="createFocusTypeModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-white">Створити новий тип фокусної задачі</h3>
                    <button onclick="closeModal('createFocusTypeModal')" class="text-gray-400 hover:text-white">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <form id="createFocusTypeForm" class="space-y-6">
                    <!-- Назва типу -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Назва типу фокусної задачі</label>
                        <input type="text" id="focus-type-name" required 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                               placeholder="Наприклад: Середній чек, Кількість дзвінків">
                    </div>
                    
                    <!-- Тип розрахунку -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Тип розрахунку</label>
                        <select id="focus-type-calculation-type" required 
                                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500">
                            <option value="">Оберіть тип розрахунку</option>
                            <option value="sum">Сума (грн)</option>
                            <option value="quantity">Кількість (шт)</option>
                            <option value="percentage">Відсоток (%)</option>
                        </select>
                    </div>
                    
                    <!-- Метод розрахунку -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Метод розрахунку</label>
                        <select id="focus-type-calculation-method" required 
                                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-blue-500">
                            <option value="manual">Ручний ввід</option>
                            <option value="auto_average_check">Автоматичний: Середній чек</option>
                            <option value="auto_clients_count">Автоматичний: Кількість клієнтів</option>
                            <option value="auto_orders_count">Автоматичний: Кількість замовлень</option>
                            <option value="auto_sales_amount">Автоматичний: Сума продажів</option>
                            <option value="auto_calls_count">Автоматичний: Кількість дзвінків</option>
                        </select>
                    </div>
                    
                    <!-- Номенклатура для автоматичного розрахунку -->
                    <div id="nomenclature-section" class="hidden">
                        <label class="block text-sm font-medium text-gray-300 mb-2">Номенклатура для розрахунку</label>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600">
                                <div>
                                    <span class="text-white font-medium">Обрати номенклатуру</span>
                                    <p class="text-sm text-gray-400" id="selected-nomenclature-info">Не обрано</p>
                                </div>
                                <button type="button" id="select-nomenclature-btn" 
                                        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
                                    Обрати
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Опис -->
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Опис (необов'язково)</label>
                        <textarea id="focus-type-description" rows="3"
                                  class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                  placeholder="Детальний опис типу фокусної задачі"></textarea>
                    </div>
                    
                    <!-- Кнопки -->
                    <div class="flex justify-end space-x-3 pt-4">
                        <button type="button" onclick="closeModal('createFocusTypeModal')" 
                                class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">
                            Скасувати
                        </button>
                        <button type="submit" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500">
                            Створити тип
                        </button>
                    </div>
                </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Додаємо обробники подій
    setupFocusTypeFormEventListeners();
    
    // Показуємо модальне вікно
    document.getElementById('createFocusTypeModal').classList.remove('hidden');
};

/**
 * Налаштовує обробники подій для ієрархічного вибору
 */
function setupHierarchicalEventListeners() {
    // Обробник для категорії 1
    document.querySelectorAll('.nomenclature-category1-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const isChecked = this.checked;
            const categoryName = this.value;
            const hasChildren = this.dataset.hasChildren === 'true';
            const children = this.dataset.children ? this.dataset.children.split(',') : [];
            
            console.log(`🔄 Категорія 1 "${categoryName}" ${isChecked ? 'вибрана' : 'знята'}, дітей: ${children.length}`);
            
            if (hasChildren) {
                // Встановлюємо всіх дітей
                children.forEach(childName => {
                    const childCheckbox = document.querySelector(`.nomenclature-category2-checkbox[value="${childName}"]`);
                    if (childCheckbox) {
                        childCheckbox.checked = isChecked;
                        childCheckbox.indeterminate = false;
                        console.log(`   → Дочірня категорія 2 "${childName}" ${isChecked ? 'вибрана' : 'знята'}`);
                    }
                });
            }
            
            // Оновлюємо стан батьківських елементів
            updateParentCheckboxState(this);
        });
    });
    
    // Обробник для категорії 2
    document.querySelectorAll('.nomenclature-category2-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const isChecked = this.checked;
            const categoryName = this.value;
            const hasChildren = this.dataset.hasChildren === 'true';
            const children = this.dataset.children ? this.dataset.children.split(',') : [];
            
            console.log(`🔄 Категорія 2 "${categoryName}" ${isChecked ? 'вибрана' : 'знята'}, дітей: ${children.length}`);
            
            if (hasChildren) {
                // Встановлюємо всіх дітей
                children.forEach(childName => {
                    const childCheckbox = document.querySelector(`.nomenclature-category3-checkbox[value="${childName}"]`);
                    if (childCheckbox) {
                        childCheckbox.checked = isChecked;
                        childCheckbox.indeterminate = false;
                        console.log(`   → Дочірня категорія 3 "${childName}" ${isChecked ? 'вибрана' : 'знята'}`);
                    }
                });
            }
            
            // Оновлюємо стан батьківських елементів
            updateParentCheckboxState(this);
        });
    });
    
    // Обробник для категорії 3
    document.querySelectorAll('.nomenclature-category3-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            console.log(`🔄 Категорія 3 "${this.value}" ${this.checked ? 'вибрана' : 'знята'}`);
            updateParentCheckboxState(this);
        });
    });
}

/**
 * Оновлює стан батьківського чекбоксу
 */
function updateParentCheckboxState(childCheckbox) {
    const parentName = childCheckbox.dataset.parent;
    if (!parentName) return;
    
    const parentCheckbox = document.querySelector(`.nomenclature-category${childCheckbox.dataset.category - 1}-checkbox[value="${parentName}"]`);
    if (!parentCheckbox) return;
    
    const siblings = document.querySelectorAll(`.nomenclature-category${childCheckbox.dataset.category}-checkbox[data-parent="${parentName}"]`);
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
 * Налаштовує обробники подій для нової форми фокусного типу
 */
function setupFocusTypeFormEventListeners() {
    const calculationMethodSelect = document.getElementById('focus-type-calculation-method');
    const nomenclatureSection = document.getElementById('nomenclature-section');
    const selectNomenclatureBtn = document.getElementById('select-nomenclature-btn');
    
    // Показуємо/ховаємо секцію номенклатури залежно від методу розрахунку
    calculationMethodSelect.addEventListener('change', function() {
        const method = this.value;
        if (method.startsWith('auto_')) {
            nomenclatureSection.classList.remove('hidden');
        } else {
            nomenclatureSection.classList.add('hidden');
        }
    });
    
    // Обробник для кнопки вибору номенклатури
    selectNomenclatureBtn.addEventListener('click', function() {
        // Отримуємо поточний вибір з форми
        const currentSelection = window.currentNomenclatureSelection || [];
        const currentFilterType = window.currentNomenclatureFilterType || 'include';
        
        // Відкриваємо селектор номенклатури
        openNomenclatureSelector(currentSelection, currentFilterType);
    });
    
    // Налаштовуємо callback для селектора номенклатури
    setNomenclatureSelectionCallback(function(result) {
        window.currentNomenclatureSelection = result.items;
        window.currentNomenclatureFilterType = result.filterType;
        
        // Оновлюємо інформацію про вибір
        const infoElement = document.getElementById('selected-nomenclature-info');
        if (result.items.length > 0) {
            infoElement.textContent = `Обрано ${result.items.length} позицій (${result.filterType === 'include' ? 'включити' : 'виключити'})`;
        } else {
            infoElement.textContent = 'Не обрано';
        }
    });
    
    // Обробник відправки форми
    document.getElementById('createFocusTypeForm').addEventListener('submit', saveNewFocusType);
}

/**
 * Збереження нового типу фокусу
 */
async function saveNewFocusType(e) {
    e.preventDefault();
    
    try {
        const name = document.getElementById('focus-type-name').value.trim();
        const calculationType = document.getElementById('focus-type-calculation-type').value;
        const calculationMethod = document.getElementById('focus-type-calculation-method').value;
        const description = document.getElementById('focus-type-description').value.trim();
        
        if (!name || !calculationType || !calculationMethod) {
            showToast('❌ Заповніть всі обов\'язкові поля', 'error');
            return;
        }
        
        // Перевіряємо наявність необхідних даних
        const companyId = window.state?.currentCompanyId || window.state?.currentCompany?.id;
        const userId = window.state?.currentUser?.uid || 'demo-user';
        
        if (!companyId) {
            console.warn('⚠️ ID компанії не знайдено, зберігаємо локально');
        }
        
        const formData = {
            name: name,
            calculationType: calculationType,
            calculationMethod: calculationMethod,
            description: description,
            companyId: companyId,
            createdBy: userId,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        
        // Додаємо номенклатуру якщо це автоматичний метод
        if (calculationMethod.startsWith('auto_')) {
            formData.nomenclatureFilters = {
                items: window.currentNomenclatureSelection || [],
                filterType: window.currentNomenclatureFilterType || 'include'
            };
        }
        
        let focusTypeId;
        
        // Зберігаємо в Firebase або локально
        if (companyId) {
            try {
                const focusTypesRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTypes');
                const docRef = await firebase.addDoc(focusTypesRef, formData);
                focusTypeId = docRef.id;
                console.log('✅ Новий тип фокусної задачі створено в Firebase:', docRef.id);
            } catch (firebaseError) {
                console.error('❌ Помилка збереження в Firebase:', firebaseError);
                throw firebaseError;
            }
        } else {
            // Зберігаємо локально
            focusTypeId = 'focus-' + Date.now();
            formData.id = focusTypeId;
            
            if (!getState().planFactData.focusTypes) {
                getState().planFactData.focusTypes = [];
            }
            getState().planFactData.focusTypes.push(formData);
            
            // Зберігаємо в localStorage
            try {
                localStorage.setItem('planFactData', JSON.stringify({
                    planTemplates: getState().planFactData.planTemplates,
                    focusTypes: getState().planFactData.focusTypes,
                    plans: getState().planFactData.plans,
                    goals: getState().planFactData.goals
                }));
                console.log('✅ Новий тип фокусної задачі створено локально:', focusTypeId);
            } catch (storageError) {
                console.error('❌ Помилка збереження в localStorage:', storageError);
            }
        }
        
        showToast('✅ Тип фокусної задачі створено успішно', 'success');
        
        // Очищаємо форму
        document.getElementById('createFocusTypeForm').reset();
        window.currentNomenclatureSelection = [];
        window.currentNomenclatureFilterType = 'include';
        document.getElementById('selected-nomenclature-info').textContent = 'Не обрано';
        document.getElementById('nomenclature-section').classList.add('hidden');
        
        // Закриваємо модальне вікно
        closeModal('createFocusTypeModal');
        
        // Оновлюємо список типів
        if (window.loadFocusTypesFromFirebase) {
            await window.loadFocusTypesFromFirebase();
        }
        
        // Принудительно обновляем DOM
        const focusTypesList = document.getElementById('focusTypesList');
        if (focusTypesList) {
            focusTypesList.innerHTML = renderFocusTypesList();
            console.log('✅ Список типів фокусних задач оновлено в DOM');
        } else {
            console.warn('⚠️ Контейнер focusTypesList не знайдено');
        }
        
    } catch (error) {
        console.error('❌ Помилка збереження типу фокусної задачі:', error);
        showToast('❌ Помилка збереження типу фокусної задачі', 'error');
    }
}

/**
 * Редагування типу фокусу
 */
window.editFocusType = function(focusTypeId) {
    const focusType = getState().planFactData?.focusTypes?.find(f => f.id === focusTypeId);
    if (!focusType) {
        alert('Тип фокусу не знайдено');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Редагування типу фокусу: ${focusType.name}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <form id="edit-focus-type-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Назва типу *</label>
                        <input type="text" id="edit-focus-type-name" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" 
                               value="${focusType.name}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Тип розрахунку *</label>
                        <select id="edit-focus-type-type" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" required>
                            <option value="quantity" ${focusType.calculationType === 'quantity' ? 'selected' : ''}>Кількісний</option>
                            <option value="revenue" ${focusType.calculationType === 'revenue' ? 'selected' : ''}>Грошовий</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Метод розрахунку *</label>
                    <select id="edit-calculation-method" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" 
                            onchange="toggleEditNomenclatureSection()" required>
                        <option value="manual" ${focusType.calculationMethod === 'manual' ? 'selected' : ''}>Ручний ввід</option>
                        <option value="clients_count" ${focusType.calculationMethod === 'clients_count' ? 'selected' : ''}>Кількість клієнтів</option>
                        <option value="orders_count" ${focusType.calculationMethod === 'orders_count' ? 'selected' : ''}>Кількість замовлень</option>
                        <option value="average_check" ${focusType.calculationMethod === 'average_check' ? 'selected' : ''}>Середній чек</option>
                        <option value="total_revenue" ${focusType.calculationMethod === 'total_revenue' ? 'selected' : ''}>Загальна виручка</option>
                        <option value="unique_products" ${focusType.calculationMethod === 'unique_products' ? 'selected' : ''}>Унікальні товари</option>
                        <option value="auto_api" ${focusType.calculationMethod === 'auto_api' ? 'selected' : ''}>Автоматично з API</option>
                    </select>
                </div>
                
                <!-- Секція номенклатури -->
                <div id="edit-nomenclature-section" class="${focusType.calculationMethod?.startsWith('auto_') || focusType.nomenclatureFilters ? '' : 'hidden'}">
                    <label class="block text-sm font-medium text-gray-300 mb-2">Номенклатура для розрахунку</label>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600">
                            <div>
                                <span class="text-white font-medium">Обрана номенклатура:</span>
                                <p class="text-sm text-gray-400" id="edit-selected-nomenclature-info">
                                    ${focusType.nomenclatureFilters && focusType.nomenclatureFilters.items && focusType.nomenclatureFilters.items.length > 0 
                                        ? `Обрано ${focusType.nomenclatureFilters.items.length} позицій (${focusType.nomenclatureFilters.filterType === 'include' ? 'включити' : 'виключити'})`
                                        : 'Не обрано'
                                    }
                                </p>
                                ${focusType.nomenclatureFilters && focusType.nomenclatureFilters.items && focusType.nomenclatureFilters.items.length > 0 
                                    ? `<div class="mt-2">
                                        <div class="text-xs text-gray-500">Обрані позиції:</div>
                                        <div class="mt-1 flex flex-wrap gap-1">
                                            ${focusType.nomenclatureFilters.items.map(item => 
                                                `<span class="px-2 py-1 bg-blue-600 text-white rounded text-xs">${item}</span>`
                                            ).join('')}
                                        </div>
                                    </div>`
                                    : ''
                                }
                            </div>
                            <button type="button" id="edit-select-nomenclature-btn" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
                                ${focusType.nomenclatureFilters && focusType.nomenclatureFilters.items && focusType.nomenclatureFilters.items.length > 0 ? 'Змінити' : 'Обрати'}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Опис</label>
                    <textarea id="edit-focus-type-description" class="w-full bg-gray-600 text-white rounded border border-gray-500 p-2" rows="3">${focusType.description || ''}</textarea>
                </div>
                
                <div class="flex justify-end gap-4">
                    <button type="button" onclick="this.closest('.fixed').remove()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Скасувати
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Зберегти зміни
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Устанавливаем текущую номенклатуру в глобальные переменные
    window.currentEditNomenclatureSelection = focusType.nomenclatureFilters?.items || [];
    window.currentEditNomenclatureFilterType = focusType.nomenclatureFilters?.filterType || 'include';
    
    // Обробник форми
    document.getElementById('edit-focus-type-form').onsubmit = function(e) {
        e.preventDefault();
        updateFocusType(focusTypeId);
    };
    
    // Обработчик кнопки выбора номенклатуры
    document.getElementById('edit-select-nomenclature-btn').onclick = function() {
        openEditNomenclatureSelector();
    };
};

/**
 * Переключение секции номенклатуры при редагуванні
 */
window.toggleEditNomenclatureSection = function() {
    const calculationMethod = document.getElementById('edit-calculation-method').value;
    const nomenclatureSection = document.getElementById('edit-nomenclature-section');
    
    if (calculationMethod.startsWith('auto_') || ['clients_count', 'orders_count', 'average_check', 'total_revenue', 'unique_products'].includes(calculationMethod)) {
        nomenclatureSection.classList.remove('hidden');
    } else {
        nomenclatureSection.classList.add('hidden');
    }
};

/**
 * Открытие селектора номенклатуры при редагуванні
 */
function openEditNomenclatureSelector() {
    // Импортируем функцию открытия селектора номенклатуры
    if (typeof openNomenclatureSelector === 'function') {
        openNomenclatureSelector(
            window.currentEditNomenclatureSelection || [],
            window.currentEditNomenclatureFilterType || 'include'
        );
        
        // Устанавливаем callback для обновления информации
        if (typeof setNomenclatureSelectionCallback === 'function') {
            setNomenclatureSelectionCallback(function(result) {
                window.currentEditNomenclatureSelection = result.items;
                window.currentEditNomenclatureFilterType = result.filterType;
                
                // Обновляем информацию в модальном окне
                const infoElement = document.getElementById('edit-selected-nomenclature-info');
                if (infoElement) {
                    if (result.items.length > 0) {
                        infoElement.textContent = `Обрано ${result.items.length} позицій (${result.filterType === 'include' ? 'включити' : 'виключити'})`;
                    } else {
                        infoElement.textContent = 'Не обрано';
                    }
                }
                
                // Обновляем текст кнопки
                const btnElement = document.getElementById('edit-select-nomenclature-btn');
                if (btnElement) {
                    btnElement.textContent = result.items.length > 0 ? 'Змінити' : 'Обрати';
                }
            });
        }
    } else {
        showToast('❌ Селектор номенклатури недоступний', 'error');
    }
}

/**
 * Оновлення типу фокусу
 */
async function updateFocusType(focusTypeId) {
    try {
        const focusType = getState().planFactData?.focusTypes?.find(f => f.id === focusTypeId);
        if (!focusType) {
            showToast('❌ Тип фокусу не знайдено', 'error');
            return;
        }
        
        const name = document.getElementById('edit-focus-type-name').value.trim();
        const calculationType = document.getElementById('edit-focus-type-type').value;
        const calculationMethod = document.getElementById('edit-calculation-method').value;
        const description = document.getElementById('edit-focus-type-description').value.trim();
        
        // Валідація
        if (!name || !calculationType || !calculationMethod) {
            showToast('❌ Заповніть всі обов\'язкові поля', 'error');
            return;
        }
        
        const updatedData = {
            name: name,
            calculationType: calculationType,
            calculationMethod: calculationMethod,
            description: description,
            updatedAt: new Date().toISOString(),
            updatedBy: window.state?.currentUser?.uid || 'demo-user'
        };
        
        // Додаємо номенклатуру якщо це автоматичний метод
        if (calculationMethod.startsWith('auto_') || ['clients_count', 'orders_count', 'average_check', 'total_revenue', 'unique_products'].includes(calculationMethod)) {
            updatedData.nomenclatureFilters = {
                items: window.currentEditNomenclatureSelection || [],
                filterType: window.currentEditNomenclatureFilterType || 'include'
            };
        } else {
            // Убираем номенклатуру для ручного метода
            updatedData.nomenclatureFilters = null;
        }
        
        // Оновлюємо дані в локальному об'єкті
        Object.assign(focusType, updatedData);
        
        // Зберігаємо в Firebase або localStorage
        const companyId = window.state?.currentCompanyId;
        if (companyId) {
            try {
                const focusTypeRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTypes', focusTypeId);
                await firebase.updateDoc(focusTypeRef, updatedData);
                console.log('✅ Тип фокусу оновлено в Firebase');
            } catch (firebaseError) {
                console.error('❌ Помилка оновлення в Firebase:', firebaseError);
                // Продолжаем с локальными данными
            }
        } else {
            // Зберігаємо в localStorage
            try {
                localStorage.setItem('planFactData', JSON.stringify({
                    planTemplates: getState().planFactData.planTemplates,
                    focusTypes: getState().planFactData.focusTypes,
                    plans: getState().planFactData.plans,
                    goals: getState().planFactData.goals
                }));
                console.log('✅ Тип фокусу оновлено в localStorage');
            } catch (storageError) {
                console.error('❌ Помилка збереження в localStorage:', storageError);
            }
        }
        
        showToast('✅ Тип фокусної задачі оновлено успішно!', 'success');
        
        // Закриваємо модальне вікно
        document.querySelector('.fixed').remove();
        
        // Оновлюємо відображення списку
        const focusTypesList = document.getElementById('focusTypesList');
        if (focusTypesList) {
            focusTypesList.innerHTML = renderFocusTypesList();
            console.log('✅ Список типів фокусних задач оновлено після редагування');
        }
        
        // Очищаємо глобальні змінні
        window.currentEditNomenclatureSelection = [];
        window.currentEditNomenclatureFilterType = 'include';
        
    } catch (error) {
        console.error('❌ Помилка оновлення типу фокусу:', error);
        showToast('❌ Помилка оновлення типу фокусу', 'error');
    }
}

/**
 * Активація типу фокусу
 */
window.activateFocusType = function(focusTypeId) {
    const focusType = getState().planFactData?.focusTypes?.find(f => f.id === focusTypeId);
    if (focusType) {
        focusType.active = true;
        renderFocusManagerTab();
        alert('✅ Тип фокусу активовано!');
    }
};

/**
 * Деактивація типу фокусу
 */
window.deactivateFocusType = function(focusTypeId) {
    const focusType = getState().planFactData?.focusTypes?.find(f => f.id === focusTypeId);
    if (focusType) {
        focusType.active = false;
        renderFocusManagerTab();
        alert('✅ Тип фокусу деактивовано!');
    }
};

/**
 * Видалення типу фокусу
 */
window.deleteFocusType = function(focusTypeId) {
    if (confirm('Ви впевнені, що хочете видалити цей тип фокусу? Це може вплинути на існуючі плани.')) {
        const index = getState().planFactData?.focusTypes?.findIndex(f => f.id === focusTypeId);
        if (index !== -1) {
            getState().planFactData.focusTypes.splice(index, 1);
            renderFocusManagerTab();
            alert('✅ Тип фокусу видалено!');
        }
    }
};

/**
 * Получение метки метода расчета
 */
function getCalculationMethodLabel(method) {
    switch (method) {
        case 'auto_average_check':
            return 'Авто: середній чек';
        case 'auto_clients_count':
            return 'Авто: кількість клієнтів';
        case 'auto_orders_count':
            return 'Авто: кількість замовлень';
        case 'auto_sales_amount':
            return 'Авто: сума продажів';
        case 'auto_calls_count':
            return 'Авто: кількість дзвінків';
        case 'manual':
        default:
            return 'Ручний ввід';
    }
} 