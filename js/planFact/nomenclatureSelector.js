// === МОДУЛЬ ІЄРАРХІЧНОЇ СЕЛЕКЦІЇ НОМЕНКЛАТУРИ ===
import * as firebase from '../firebase.js';

let nomenclatureHierarchy = null;
let selectedItems = new Set();
let filterType = 'include'; // 'include' або 'exclude'

// === ІНІЦІАЛІЗАЦІЯ МОДУЛЯ ===
export async function initNomenclatureSelector() {
    console.log('📋 Ініціалізація селектора номенклатури...');
    
    // Створюємо модальне вікно
    createNomenclatureModal();
    
    // Завантажуємо ієрархію
    await loadNomenclatureHierarchy();
    
    console.log('✅ Селектор номенклатури ініціалізовано');
}

// === СТВОРЕННЯ МОДАЛЬНОГО ВІКНА ===
function createNomenclatureModal() {
    const modalHTML = `
        <div id="nomenclature-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-[60]">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    <!-- Заголовок -->
                    <div class="flex items-center justify-between p-6 border-b border-gray-700">
                        <h3 class="text-xl font-semibold text-white">Обрати номенклатуру</h3>
                        <button id="close-nomenclature-modal" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Тип фільтрації -->
                    <div class="p-4 border-b border-gray-700">
                        <div class="flex items-center space-x-6">
                            <label class="flex items-center">
                                <input type="radio" name="filter-type" value="include" checked class="mr-2">
                                <span class="text-white">Включити в розрахунок</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="filter-type" value="exclude" class="mr-2">
                                <span class="text-white">Виключити з розрахунку</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Пошук -->
                    <div class="p-4 border-b border-gray-700">
                        <input type="text" id="nomenclature-search" placeholder="🔍 Пошук номенклатури..." 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                    </div>
                    
                    <!-- Ієрархія номенклатури -->
                    <div class="flex-1 overflow-hidden min-h-0">
                        <div id="nomenclature-hierarchy" class="h-full overflow-y-auto p-4 min-h-[400px] max-h-[60vh]">
                            <div class="text-center text-gray-400">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                <p class="mt-2">Завантаження номенклатури...</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Футер -->
                    <div class="p-4 border-t border-gray-700 flex items-center justify-between">
                        <div class="text-sm text-gray-400">
                            Обрано: <span id="selected-count">0</span> позицій
                        </div>
                        <div class="flex space-x-3">
                            <button id="cancel-nomenclature-selection" class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">
                                Скасувати
                            </button>
                            <button id="apply-nomenclature-selection" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500">
                                Застосувати
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Додаємо модальне вікно до body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Додаємо обробники подій
    setupModalEventListeners();
}

// === НАЛАШТУВАННЯ ОБРОБНИКІВ ПОДІЙ ===
function setupModalEventListeners() {
    // Закриття модального вікна
    document.getElementById('close-nomenclature-modal').addEventListener('click', closeNomenclatureModal);
    document.getElementById('cancel-nomenclature-selection').addEventListener('click', closeNomenclatureModal);
    
    // Застосування вибору
    document.getElementById('apply-nomenclature-selection').addEventListener('click', applyNomenclatureSelection);
    
    // Тип фільтрації
    document.querySelectorAll('input[name="filter-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            filterType = e.target.value;
            updateSelectionDisplay();
        });
    });
    
    // Пошук
    document.getElementById('nomenclature-search').addEventListener('input', (e) => {
        filterNomenclatureHierarchy(e.target.value);
    });
}

// === ЗАВАНТАЖЕННЯ ІЄРАРХІЇ ===
async function loadNomenclatureHierarchy() {
    try {
        // Спочатку перевіряємо кеш в Firebase
        const cachedHierarchy = await getCachedHierarchy();
        
        if (cachedHierarchy) {
            nomenclatureHierarchy = cachedHierarchy;
            console.log('✅ Використано кешовану ієрархію номенклатури');
        } else {
            // Завантажуємо з API та кешуємо
            await loadAndCacheHierarchy();
        }
        
        renderNomenclatureHierarchy();
        
    } catch (error) {
        console.error('❌ Помилка завантаження ієрархії номенклатури:', error);
        document.getElementById('nomenclature-hierarchy').innerHTML = `
            <div class="text-center text-red-400">
                <p>Помилка завантаження номенклатури</p>
                <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-red-600 text-white rounded-md">
                    Спробувати знову
                </button>
            </div>
        `;
    }
}

// === ОТРИМАННЯ КЕШОВАНОЇ ІЄРАРХІЇ ===
async function getCachedHierarchy() {
    try {
        const companyId = window.state?.currentCompany?.id;
        if (!companyId) return null;
        
        const doc = await firebase.db.collection('nomenclatureHierarchy')
            .where('companyId', '==', companyId)
            .limit(1)
            .get();
        
        if (!doc.empty) {
            const data = doc.docs[0].data();
            const lastUpdated = new Date(data.lastUpdated);
            const now = new Date();
            const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);
            
            // Кеш дійсний 24 години
            if (hoursDiff < 24) {
                return data.hierarchy;
            }
        }
        
        return null;
    } catch (error) {
        console.error('❌ Помилка отримання кешованої ієрархії:', error);
        return null;
    }
}

// === ЗАВАНТАЖЕННЯ ТА КЕШУВАННЯ ІЄРАРХІЇ ===
async function loadAndCacheHierarchy() {
    console.log('📥 Завантаження номенклатури з API...');
    
    const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category');
    const nomenclature = await response.json();
    
    // Будуємо ієрархію
    nomenclatureHierarchy = buildHierarchyFromNomenclature(nomenclature);
    
    // Зберігаємо в Firebase
    await cacheHierarchyInFirebase(nomenclatureHierarchy);
    
    console.log('✅ Ієрархія номенклатури завантажена та кешована');
}

// === ПОБУДОВА ІЄРАРХІЇ З НОМЕНКЛАТУРИ ===
function buildHierarchyFromNomenclature(nomenclature) {
    const hierarchy = {};
    
    nomenclature.forEach(item => {
        const category1 = item['Категория 1'] || 'Без категорії';
        const category2 = item['Категория 2'] || '';
        const category3 = item['Категория 3'] || '';
        const code = item['Код'];
        const name = item['Номенклатура'];
        
        // Створюємо структуру категорій
        if (!hierarchy[category1]) {
            hierarchy[category1] = {
                children: {},
                items: [],
                count: 0
            };
        }
        
        if (category2) {
            if (!hierarchy[category1].children[category2]) {
                hierarchy[category1].children[category2] = {
                    children: {},
                    items: [],
                    count: 0
                };
            }
            
            if (category3) {
                if (!hierarchy[category1].children[category2].children[category3]) {
                    hierarchy[category1].children[category2].children[category3] = {
                        items: [],
                        count: 0
                    };
                }
                
                hierarchy[category1].children[category2].children[category3].items.push({
                    code: code,
                    name: name
                });
                hierarchy[category1].children[category2].children[category3].count++;
            } else {
                hierarchy[category1].children[category2].items.push({
                    code: code,
                    name: name
                });
                hierarchy[category1].children[category2].count++;
            }
        } else {
            hierarchy[category1].items.push({
                code: code,
                name: name
            });
            hierarchy[category1].count++;
        }
    });
    
    // Підраховуємо загальну кількість для кожної категорії
    Object.keys(hierarchy).forEach(cat1 => {
        let totalCount = hierarchy[cat1].items.length;
        Object.keys(hierarchy[cat1].children).forEach(cat2 => {
            totalCount += hierarchy[cat1].children[cat2].items.length;
            Object.keys(hierarchy[cat1].children[cat2].children).forEach(cat3 => {
                totalCount += hierarchy[cat1].children[cat2].children[cat3].items.length;
            });
        });
        hierarchy[cat1].count = totalCount;
    });
    
    return hierarchy;
}

// === КЕШУВАННЯ ІЄРАРХІЇ В FIREBASE ===
async function cacheHierarchyInFirebase(hierarchy) {
    try {
        const companyId = window.state?.currentCompany?.id;
        if (!companyId) return;
        
        // Видаляємо старі записи для цієї компанії
        const oldDocs = await firebase.db.collection('nomenclatureHierarchy')
            .where('companyId', '==', companyId)
            .get();
        
        const batch = firebase.db.batch();
        oldDocs.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Додаємо новий запис
        const newDocRef = firebase.db.collection('nomenclatureHierarchy').doc();
        batch.set(newDocRef, {
            companyId: companyId,
            hierarchy: hierarchy,
            lastUpdated: new Date().toISOString()
        });
        
        await batch.commit();
        console.log('✅ Ієрархія номенклатури кешована в Firebase');
        
    } catch (error) {
        console.error('❌ Помилка кешування ієрархії:', error);
    }
}

// === РЕНДЕРИНГ ІЄРАРХІЇ ===
function renderNomenclatureHierarchy() {
    const container = document.getElementById('nomenclature-hierarchy');
    
    if (!nomenclatureHierarchy || Object.keys(nomenclatureHierarchy).length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400">
                <p>Номенклатура не знайдена</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    Object.keys(nomenclatureHierarchy).forEach(category1 => {
        const cat1Data = nomenclatureHierarchy[category1];
        html += renderCategoryLevel(category1, cat1Data, 0);
    });
    
    container.innerHTML = html;
    
    // Додаємо обробники подій для ієрархії
    setupHierarchyEventListeners();
    
    updateSelectionDisplay();
}

// === РЕНДЕРИНГ РІВНЯ КАТЕГОРІЇ ===
function renderCategoryLevel(name, data, level) {
    const hasChildren = data.children && Object.keys(data.children).length > 0;
    const hasItems = data.items && data.items.length > 0;
    const indent = 'ml-' + (level * 4);
    const isExpanded = level === 0; // Перший рівень розгорнутий за замовчуванням
    
    let html = `
        <div class="nomenclature-category-item ${indent}" data-level="${level}" data-name="${name}">
            <label class="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer">
                <div class="flex items-center space-x-2">
                    ${hasChildren ? `
                        <button class="expand-btn text-blue-400 hover:text-blue-300 cursor-pointer font-bold text-sm transition-transform hover:scale-110" data-expanded="${isExpanded}">
                            ${isExpanded ? '▼' : '▶'}
                        </button>
                    ` : '<div class="w-4"></div>'}
                    <input type="checkbox" class="category-checkbox" data-level="${level}" data-name="${name}">
                    <span class="font-medium text-white">${name}</span>
                    <span class="text-xs text-gray-400">(${data.count})</span>
                </div>
            </label>
    `;
    
    // Дочірні категорії
    if (hasChildren) {
        html += `<div class="children-container ${isExpanded ? '' : 'hidden'}">`;
        Object.keys(data.children).forEach(childName => {
            html += renderCategoryLevel(childName, data.children[childName], level + 1);
        });
        html += '</div>';
    }
    
    // Елементи цієї категорії
    if (hasItems) {
        html += `<div class="items-container ${isExpanded ? '' : 'hidden'}">`;
        data.items.forEach(item => {
            html += `
                <div class="nomenclature-item ml-8">
                    <label class="flex items-center p-1 hover:bg-gray-700 rounded cursor-pointer">
                        <input type="checkbox" class="item-checkbox" data-code="${item.code}" data-name="${item.name}">
                        <span class="text-sm text-gray-300 ml-2">${item.name}</span>
                    </label>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

// === НАЛАШТУВАННЯ ОБРОБНИКІВ ПОДІЙ ІЄРАРХІЇ ===
function setupHierarchyEventListeners() {
    // Функція для переключення розгортання категорії
    function toggleCategory(categoryItem, expandBtn) {
        const isExpanded = expandBtn.getAttribute('data-expanded') === 'true';
        const childrenContainer = categoryItem.querySelector('.children-container');
        const itemsContainer = categoryItem.querySelector('.items-container');
        
        if (isExpanded) {
            // Згортаємо
            if (childrenContainer) childrenContainer.classList.add('hidden');
            if (itemsContainer) itemsContainer.classList.add('hidden');
            expandBtn.textContent = '▶';
            expandBtn.setAttribute('data-expanded', 'false');
        } else {
            // Розгортаємо
            if (childrenContainer) childrenContainer.classList.remove('hidden');
            if (itemsContainer) itemsContainer.classList.remove('hidden');
            expandBtn.textContent = '▼';
            expandBtn.setAttribute('data-expanded', 'true');
        }
    }
    
    // Розгортання/згортання категорій по кліку на кнопку
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const categoryItem = btn.closest('.nomenclature-category-item');
            toggleCategory(categoryItem, btn);
        });
    });
    
    // Розгортання/згортання категорій по кліку на label (але не на checkbox)
    document.querySelectorAll('.nomenclature-category-item > label').forEach(label => {
        label.addEventListener('click', (e) => {
            // Не обробляємо клік по checkbox
            if (e.target.type === 'checkbox') return;
            
            const expandBtn = label.querySelector('.expand-btn');
            if (expandBtn) {
                e.preventDefault(); // Запобігаємо активації checkbox
                const categoryItem = label.closest('.nomenclature-category-item');
                toggleCategory(categoryItem, expandBtn);
            }
        });
    });
    
    // Чекбокси категорій
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCategoryCheckboxChange);
    });
    
    // Чекбокси елементів
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleItemCheckboxChange);
    });
}

// === ОБРОБКА ЗМІНИ ЧЕКБОКСА КАТЕГОРІЇ ===
function handleCategoryCheckboxChange(e) {
    const checkbox = e.target;
    const isChecked = checkbox.checked;
    const categoryItem = checkbox.closest('.nomenclature-category-item');
    
    // Встановлюємо стан для всіх дочірніх елементів
    const childCheckboxes = categoryItem.querySelectorAll('input[type="checkbox"]');
    childCheckboxes.forEach(childCheckbox => {
        if (childCheckbox !== checkbox) {
            childCheckbox.checked = isChecked;
            if (childCheckbox.classList.contains('item-checkbox')) {
                updateSelectedItems(childCheckbox.dataset.code, isChecked);
            }
        }
    });
    
    // Оновлюємо стан батьківських чекбоксів
    updateParentCheckboxStates();
    updateSelectionDisplay();
}

// === ОБРОБКА ЗМІНИ ЧЕКБОКСА ЕЛЕМЕНТА ===
function handleItemCheckboxChange(e) {
    const checkbox = e.target;
    const isChecked = checkbox.checked;
    const itemCode = checkbox.dataset.code;
    
    updateSelectedItems(itemCode, isChecked);
    updateParentCheckboxStates();
    updateSelectionDisplay();
}

// === ОНОВЛЕННЯ ОБРАНИХ ЕЛЕМЕНТІВ ===
function updateSelectedItems(itemCode, isSelected) {
    if (isSelected) {
        selectedItems.add(itemCode);
    } else {
        selectedItems.delete(itemCode);
    }
}

// === ОНОВЛЕННЯ СТАНУ БАТЬКІВСЬКИХ ЧЕКБОКСІВ ===
function updateParentCheckboxStates() {
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
        const categoryItem = checkbox.closest('.nomenclature-category-item');
        const childCheckboxes = categoryItem.querySelectorAll('input[type="checkbox"]:not(.category-checkbox)');
        
        if (childCheckboxes.length === 0) return;
        
        const checkedCount = Array.from(childCheckboxes).filter(cb => cb.checked).length;
        const totalCount = childCheckboxes.length;
        
        if (checkedCount === 0) {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        } else if (checkedCount === totalCount) {
            checkbox.checked = true;
            checkbox.indeterminate = false;
        } else {
            checkbox.checked = false;
            checkbox.indeterminate = true;
        }
    });
}

// === ОНОВЛЕННЯ ВІДОБРАЖЕННЯ ВИБОРУ ===
function updateSelectionDisplay() {
    const countElement = document.getElementById('selected-count');
    countElement.textContent = selectedItems.size;
}

// === ФІЛЬТРАЦІЯ ІЄРАРХІЇ ===
function filterNomenclatureHierarchy(searchTerm) {
    if (!searchTerm.trim()) {
        // Показуємо все
        document.querySelectorAll('.nomenclature-category-item').forEach(item => {
            item.style.display = '';
        });
        return;
    }
    
    const searchLower = searchTerm.toLowerCase();
    
    document.querySelectorAll('.nomenclature-category-item').forEach(categoryItem => {
        const categoryName = categoryItem.querySelector('.font-medium')?.textContent || '';
        const items = categoryItem.querySelectorAll('.nomenclature-item');
        
        let hasMatch = categoryName.toLowerCase().includes(searchLower);
        
        items.forEach(item => {
            const itemName = item.querySelector('.text-sm')?.textContent || '';
            const matches = itemName.toLowerCase().includes(searchLower);
            
            if (matches) {
                hasMatch = true;
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
        
        if (hasMatch) {
            categoryItem.style.display = '';
            // Розгортаємо категорії з відповідями
            const expandBtn = categoryItem.querySelector('.expand-btn');
            if (expandBtn && expandBtn.getAttribute('data-expanded') === 'false') {
                expandBtn.click();
            }
        } else {
            categoryItem.style.display = 'none';
        }
    });
}

// === ВІДКРИТТЯ МОДАЛЬНОГО ВІКНА ===
export function openNomenclatureSelector(currentSelection = [], currentFilterType = 'include') {
    selectedItems = new Set(currentSelection);
    filterType = currentFilterType;
    
    // Встановлюємо правильний тип фільтрації
    document.querySelector(`input[name="filter-type"][value="${filterType}"]`).checked = true;
    
    // Встановлюємо обрані елементи
    selectedItems.forEach(itemCode => {
        const checkbox = document.querySelector(`input[data-code="${itemCode}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    updateParentCheckboxStates();
    updateSelectionDisplay();
    
    // Показуємо модальне вікно
    document.getElementById('nomenclature-modal').classList.remove('hidden');
}

// === ЗАКРИТТЯ МОДАЛЬНОГО ВІКНА ===
function closeNomenclatureModal() {
    document.getElementById('nomenclature-modal').classList.add('hidden');
    selectedItems.clear();
    updateSelectionDisplay();
}

// === ЗАСТОСУВАННЯ ВИБОРУ ===
function applyNomenclatureSelection() {
    const result = {
        items: Array.from(selectedItems),
        filterType: filterType
    };
    
    // Викликаємо callback з результатом
    if (window.nomenclatureSelectionCallback) {
        window.nomenclatureSelectionCallback(result);
    }
    
    closeNomenclatureModal();
}

// === ЕКСПОРТ ФУНКЦІЙ ===
export function setNomenclatureSelectionCallback(callback) {
    window.nomenclatureSelectionCallback = callback;
} 