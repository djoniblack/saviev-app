// Селектор номенклатуры для Фокус 2.0 (адаптированный из PlanFact)
import * as firebase from '../../firebase.js';

export class FocusNomenclatureSelector {
  constructor() {
    this.nomenclature = [];
    this.selectedItems = new Set();
    this.hierarchy = {};
    this.filterType = 'include'; // 'include' или 'exclude'
    this.searchTerm = '';
    this.callback = null;
  }
  
  /**
   * Инициализация селектора
   */
  async init() {
    console.log('📋 Ініціалізація селектора номенклатури Фокус 2.0...');
    
    // Создаем модальное окно
    this.createModal();
    
    // Загружаем иерархию
    await this.loadNomenclatureHierarchy();
    
    console.log('✅ Селектор номенклатури ініціалізовано');
  }
  
  /**
   * Создание модального окна
   */
  createModal() {
    const modalHTML = `
      <div id="focus2-nomenclature-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-[80]">
        <div class="flex items-center justify-center min-h-screen p-4">
          <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <!-- Заголовок -->
            <div class="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 class="text-xl font-semibold text-white">Обрати номенклатуру для фокусної задачі</h3>
              <button id="close-focus2-nomenclature-modal" class="text-gray-400 hover:text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <!-- Тип фильтрации -->
            <div class="p-4 border-b border-gray-700">
              <div class="flex items-center space-x-6">
                <label class="flex items-center">
                  <input type="radio" name="focus2-filter-type" value="include" checked class="mr-2">
                  <span class="text-white">Включити в розрахунок</span>
                </label>
                <label class="flex items-center">
                  <input type="radio" name="focus2-filter-type" value="exclude" class="mr-2">
                  <span class="text-white">Виключити з розрахунку</span>
                </label>
              </div>
            </div>
            
            <!-- Поиск -->
            <div class="p-4 border-b border-gray-700">
              <input type="text" id="focus2-nomenclature-search" placeholder="🔍 Пошук номенклатури..." 
                     class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
            </div>
            
            <!-- Иерархия номенклатуры -->
            <div class="flex-1 overflow-hidden min-h-0">
              <div id="focus2-nomenclature-hierarchy" class="h-full overflow-y-auto p-4 min-h-[400px] max-h-[60vh]">
                <div class="text-center text-gray-400">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p class="mt-2">Завантаження номенклатури...</p>
                </div>
              </div>
            </div>
            
            <!-- Футер -->
            <div class="p-4 border-t border-gray-700 flex items-center justify-between">
              <div class="text-sm text-gray-400">
                Обрано: <span id="focus2-selected-count">0</span> позицій
              </div>
              <div class="flex space-x-3">
                <button id="cancel-focus2-nomenclature-selection" class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">
                  Скасувати
                </button>
                <button id="apply-focus2-nomenclature-selection" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500">
                  Застосувати
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Добавляем модальное окно к body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Добавляем обработчики событий
    this.setupModalEventListeners();
  }
  
  /**
   * Настройка обработчиков событий
   */
  setupModalEventListeners() {
    // Закрытие модального окна
    document.getElementById('close-focus2-nomenclature-modal').addEventListener('click', () => this.closeModal());
    document.getElementById('cancel-focus2-nomenclature-selection').addEventListener('click', () => this.closeModal());
    
    // Применение выбора
    document.getElementById('apply-focus2-nomenclature-selection').addEventListener('click', () => this.applySelection());
    
    // Тип фильтрации
    document.querySelectorAll('input[name="focus2-filter-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.filterType = e.target.value;
        this.updateSelectionDisplay();
      });
    });
    
    // Поиск
    document.getElementById('focus2-nomenclature-search').addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this.filterNomenclatureHierarchy();
    });
  }
  
  /**
   * Загрузка иерархии номенклатуры
   */
  async loadNomenclatureHierarchy() {
    try {
      // Сначала проверяем кеш в Firebase
      const cachedHierarchy = await this.getCachedHierarchy();
      
      if (cachedHierarchy) {
        this.hierarchy = cachedHierarchy;
        console.log('✅ Використано кешовану ієрархію номенклатури');
      } else {
        // Загружаем из API и кешируем
        await this.loadAndCacheHierarchy();
      }
      
      this.renderNomenclatureHierarchy();
      
    } catch (error) {
      console.error('❌ Помилка завантаження ієрархії номенклатури:', error);
      document.getElementById('focus2-nomenclature-hierarchy').innerHTML = `
        <div class="text-center text-red-400">
          <p>Помилка завантаження номенклатури</p>
          <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-red-600 text-white rounded-md">
            Спробувати знову
          </button>
        </div>
      `;
    }
  }
  
  /**
   * Получение кешированной иерархии
   */
  async getCachedHierarchy() {
    try {
      const companyId = window.state?.currentCompanyId;
      if (!companyId) return null;
      
      const hierarchyRef = firebase.collection(firebase.db, 'companies', companyId, 'focusNomenclatureCache');
      const snapshot = await firebase.getDocs(hierarchyRef);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        
        // Проверяем актуальность кеша (не старше 24 часов)
        const lastUpdated = new Date(data.lastUpdated);
        const now = new Date();
        const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);
        
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
  
  /**
   * Загрузка и кеширование иерархии
   */
  async loadAndCacheHierarchy() {
    console.log('📥 Завантаження номенклатури з API...');
    
    try {
      const response = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const nomenclature = await response.json();
      
      // Строим иерархию
      this.hierarchy = this.buildHierarchyFromNomenclature(nomenclature);
      
      // Сохраняем в Firebase только если есть данные
      if (Object.keys(this.hierarchy).length > 0) {
        await this.cacheHierarchyInFirebase(this.hierarchy);
      }
      
      console.log('✅ Ієрархія номенклатури завантажена та кешована');
    } catch (error) {
      console.error('❌ Помилка завантаження номенклатури:', error);
      // Создаем пустую иерархию в случае ошибки
      this.hierarchy = {};
    }
  }
  
  /**
   * Построение иерархии из номенклатуры
   */
  buildHierarchyFromNomenclature(nomenclature) {
    const hierarchy = {};
    
    if (!nomenclature || !Array.isArray(nomenclature)) {
      console.warn('⚠️ Номенклатура не є масивом або відсутня');
      return hierarchy;
    }
    
    nomenclature.forEach(item => {
      const category1 = item['Категория 1'] || 'Без категорії';
      const category2 = item['Категория 2'] || '';
      const category3 = item['Категория 3'] || '';
      const code = item['Код'];
      const name = item['Номенклатура'];
      
      // Создаем структуру категорий
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
    
    // Подсчитываем общее количество для каждой категории
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
  
  /**
   * Кеширование иерархии в Firebase
   */
  async cacheHierarchyInFirebase(hierarchy) {
    try {
      const companyId = window.state?.currentCompanyId;
      if (!companyId) return;
      
      // Удаляем старые записи для этой компании
      const hierarchyRef = firebase.collection(firebase.db, 'companies', companyId, 'focusNomenclatureCache');
      const oldDocs = await firebase.getDocs(hierarchyRef);
      
      const batch = firebase.writeBatch(firebase.db);
      oldDocs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Добавляем новую запись используя addDoc
      const newDocRef = await firebase.addDoc(hierarchyRef, {
        hierarchy: hierarchy,
        lastUpdated: new Date().toISOString()
      });
      console.log('✅ Ієрархія номенклатури кешована в Firebase');
      
    } catch (error) {
      console.error('❌ Помилка кешування ієрархії:', error);
    }
  }
  
  /**
   * Рендеринг иерархии
   */
  renderNomenclatureHierarchy() {
    const container = document.getElementById('focus2-nomenclature-hierarchy');
    
    if (!this.hierarchy || Object.keys(this.hierarchy).length === 0) {
      container.innerHTML = `
        <div class="text-center text-gray-400">
          <p>Немає даних номенклатури</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    Object.keys(this.hierarchy).forEach(category => {
      html += this.renderCategoryLevel(category, this.hierarchy[category], 0);
    });
    
    container.innerHTML = html;
    this.setupHierarchyEventListeners();
  }
  
  /**
   * Рендеринг уровня категории
   */
  renderCategoryLevel(name, data, level) {
    const indent = level * 20;
    const hasChildren = data.children && Object.keys(data.children).length > 0;
    const hasItems = data.items && data.items.length > 0;
    
    let html = `
      <div class="category-item" data-category="${name}" style="margin-left: ${indent}px;">
        <div class="flex items-center py-2 hover:bg-gray-700 rounded">
          ${hasChildren ? `
            <button class="expand-btn mr-2 text-gray-400 hover:text-white" data-category="${name}">
              <svg class="w-4 h-4 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          ` : '<div class="w-4 mr-2"></div>'}
          
          <label class="flex items-center flex-1 cursor-pointer">
            <input type="checkbox" class="category-checkbox mr-2" data-category="${name}">
            <span class="text-white">${name}</span>
            <span class="text-gray-400 text-sm ml-2">(${data.count})</span>
          </label>
        </div>
    `;
    
    // Рендерим подкатегории
    if (hasChildren && data.children) {
      html += '<div class="category-children hidden">';
      Object.keys(data.children).forEach(subCategory => {
        html += this.renderCategoryLevel(subCategory, data.children[subCategory], level + 1);
      });
      html += '</div>';
    }
    
    // Рендерим элементы
    if (hasItems && data.items) {
      html += '<div class="category-items hidden">';
      data.items.forEach(item => {
        html += `
          <div class="item-row" style="margin-left: ${(level + 1) * 20}px;">
            <label class="flex items-center py-1 hover:bg-gray-700 rounded cursor-pointer">
              <input type="checkbox" class="item-checkbox mr-2" data-code="${item.code}">
              <span class="text-gray-300">${item.name}</span>
            </label>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }
  
  /**
   * Настройка обработчиков событий иерархии
   */
  setupHierarchyEventListeners() {
    // Обработчики для кнопок разворачивания
    document.querySelectorAll('.expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const category = btn.dataset.category;
        const categoryItem = btn.closest('.category-item');
        const children = categoryItem.querySelector('.category-children');
        const items = categoryItem.querySelector('.category-items');
        
        if (children) children.classList.toggle('hidden');
        if (items) items.classList.toggle('hidden');
        
        btn.querySelector('svg').classList.toggle('rotate-90');
      });
    });
    
    // Обработчики для чекбоксов категорий
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.handleCategoryCheckboxChange(e);
      });
    });
    
    // Обработчики для чекбоксов элементов
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.handleItemCheckboxChange(e);
      });
    });
  }
  
  /**
   * Обработка изменения чекбокса категории
   */
  handleCategoryCheckboxChange(e) {
    const category = e.target.dataset.category;
    const isChecked = e.target.checked;
    
    // Находим все элементы в этой категории
    const categoryItem = e.target.closest('.category-item');
    const itemCheckboxes = categoryItem.querySelectorAll('.item-checkbox');
    
    // Устанавливаем состояние всех элементов
    itemCheckboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
      this.updateSelectedItems(checkbox.dataset.code, isChecked);
    });
    
    this.updateSelectionDisplay();
  }
  
  /**
   * Обработка изменения чекбокса элемента
   */
  handleItemCheckboxChange(e) {
    const code = e.target.dataset.code;
    const isChecked = e.target.checked;
    
    this.updateSelectedItems(code, isChecked);
    this.updateSelectionDisplay();
  }
  
  /**
   * Обновление выбранных элементов
   */
  updateSelectedItems(code, isSelected) {
    if (isSelected) {
      this.selectedItems.add(code);
    } else {
      this.selectedItems.delete(code);
    }
  }
  
  /**
   * Обновление отображения выбора
   */
  updateSelectionDisplay() {
    const countElement = document.getElementById('focus2-selected-count');
    if (countElement) {
      countElement.textContent = this.selectedItems.size;
    }
  }
  
  /**
   * Фильтрация иерархии по поиску
   */
  filterNomenclatureHierarchy() {
    if (!this.searchTerm.trim()) {
      // Показываем все если поиск пустой
      document.querySelectorAll('.category-item').forEach(item => {
        item.style.display = '';
      });
      return;
    }
    
    const searchLower = this.searchTerm.toLowerCase();
    
    document.querySelectorAll('.category-item').forEach(item => {
      const categoryName = item.querySelector('label span').textContent.toLowerCase();
      const itemNames = Array.from(item.querySelectorAll('.item-row label span')).map(span => span.textContent.toLowerCase());
      
      const categoryMatches = categoryName.includes(searchLower);
      const itemsMatch = itemNames.some(name => name.includes(searchLower));
      
      if (categoryMatches || itemsMatch) {
        item.style.display = '';
        // Разворачиваем категории с совпадениями
        if (categoryMatches) {
          const children = item.querySelector('.category-children');
          const items = item.querySelector('.category-items');
          if (children) children.classList.remove('hidden');
          if (items) items.classList.remove('hidden');
        }
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  /**
   * Открытие селектора
   */
  openSelector(currentSelection = [], currentFilterType = 'include', callback = null) {
    this.selectedItems = new Set(currentSelection);
    this.filterType = currentFilterType;
    this.callback = callback;
    
    // Устанавливаем состояние чекбоксов
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
      checkbox.checked = this.selectedItems.has(checkbox.dataset.code);
    });
    
    // Устанавливаем тип фильтрации
    document.querySelector(`input[name="focus2-filter-type"][value="${this.filterType}"]`).checked = true;
    
    // Показываем модальное окно
    document.getElementById('focus2-nomenclature-modal').classList.remove('hidden');
    
    this.updateSelectionDisplay();
  }
  
  /**
   * Закрытие модального окна
   */
  closeModal() {
    document.getElementById('focus2-nomenclature-modal').classList.add('hidden');
  }
  
  /**
   * Применение выбора
   */
  applySelection() {
    if (this.callback) {
      this.callback(Array.from(this.selectedItems), this.filterType);
    }
    this.closeModal();
  }
  
  /**
   * Установка callback для обработки выбора
   */
  setSelectionCallback(callback) {
    this.callback = callback;
  }
} 