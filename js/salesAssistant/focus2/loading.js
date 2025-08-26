// Модуль анимированной загрузки для Фокус 2.0
import * as firebase from '../../firebase.js';
import { loadClientManagerDirectory } from '../../main.js';

export class FocusLoadingManager {
  constructor(container) {
    this.container = container;
    this.currentStep = 0;
    this.totalSteps = 8;
    this.focus2Data = {
      tasks: [],
      clients: [],
      sales: [],
      nomenclature: [],
      clientManagerDirectory: {},
      userAccess: {},
      currentTask: null
    };
  }
  
  /**
   * Показ экрана загрузки
   */
  showLoading() {
    this.container.innerHTML = `
      <div class="focus2-loading">
        <div class="loading-animation">
          <div class="spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <div class="loading-text">
            <h3 id="loading-title" class="text-2xl font-bold text-white mb-2">Завантаження Фокус 2.0...</h3>
            <p id="loading-message" class="text-gray-300 mb-4">Ініціалізація модуля</p>
            <div class="progress-container">
              <div class="progress-bar">
                <div id="loading-progress" class="progress-fill"></div>
              </div>
              <p id="loading-step" class="step-text text-sm text-gray-400 mt-2">Крок 1 з ${this.totalSteps}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Обновление прогресса загрузки
   */
  updateProgress(step, title, message) {
    this.currentStep = step;
    const progress = (step / this.totalSteps) * 100;
    
    const titleEl = document.getElementById('loading-title');
    const messageEl = document.getElementById('loading-message');
    const progressEl = document.getElementById('loading-progress');
    const stepEl = document.getElementById('loading-step');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (progressEl) progressEl.style.width = `${progress}%`;
    if (stepEl) stepEl.textContent = `Крок ${step} з ${this.totalSteps}`;
  }
  
  /**
   * Основной процесс загрузки с шагами
   */
  async loadWithSteps() {
    console.log('🎬 Початок анімованого завантаження...');
    this.showLoading();
    
    try {
      // Шаг 1: Инициализация
      this.updateProgress(1, 'Ініціалізація...', 'Перевірка компанії та користувача');
      await this.initializeModule();
      
      // Шаг 2: Загрузка справочников
      this.updateProgress(2, 'Завантаження довідників...', 'Отримання номенклатури та клієнтів');
      await this.loadDirectories();
      
      // Шаг 3: Загрузка продаж
      this.updateProgress(3, 'Завантаження продажів...', 'Підключення до серверів даних');
      await this.loadSalesData();
      
      // Шаг 4: Анализ клиентов
      this.updateProgress(4, 'Аналіз клієнтів...', 'Обробка даних продажу');
      await this.analyzeClients();
      
      // Шаг 5: Построение расчетов
      this.updateProgress(5, 'Побудова розрахунків...', 'Формування списку клієнтів');
      await this.buildCalculations();
      
      // Шаг 6: Применение фильтров
      this.updateProgress(6, 'Застосування фільтрів...', 'Налаштування відображення');
      await this.applyFilters();
      
      // Шаг 7: Рендеринг интерфейса
      this.updateProgress(7, 'Створення інтерфейсу...', 'Формування елементів UI');
      await this.renderInterface();
      
      // Шаг 8: Завершение
      this.updateProgress(8, 'Завершення...', 'Модуль готовий до роботи');
      await this.finalize();
      
      // Основной контент будет показан в основном модуле
      console.log('🎉 Завантаження завершено, готовий до показу інтерфейсу');
      
    } catch (error) {
      console.error('❌ Помилка завантаження Фокус 2.0:', error);
      this.showErrorState(error.message);
    }
  }
  
  /**
   * Шаг 1: Инициализация модуля
   */
  async initializeModule() {
    console.log('🔧 Ініціалізація модуля Фокус 2.0...');
    
    // Проверяем наличие компании
    const companyId = window.state?.currentCompanyId;
    if (!companyId) {
      throw new Error('Компанія не вибрана!');
    }
    
    // Проверяем права доступа
    if (!window.hasPermission || !window.hasPermission('focus_view')) {
      throw new Error('У вас немає прав для перегляду модуля Фокус 2.0');
    }
    
    // Инициализируем userAccess
    this.focus2Data.userAccess = {
      userId: window.state?.currentUserId,
      employeeId: null,
      employee: null,
      role: window.state?.currentUserRole?.toLowerCase(),
      departmentId: window.state?.currentUserDepartment,
      isAdmin: window.state?.isAdmin || false
    };
    
    // Находим сотрудника через members
    if (window.state?.allMembers && window.state.allMembers.length > 0) {
      const currentMember = window.state.allMembers.find(m => 
        m.userId === this.focus2Data.userAccess.userId || 
        m.userId === window.state?.currentUserId
      );
      
      if (currentMember && currentMember.employeeId) {
        this.focus2Data.userAccess.employeeId = currentMember.employeeId;
      }
    }
    
    console.log('✅ Ініціалізація завершена');
  }
  
  /**
   * Шаг 2: Загрузка справочников
   */
  async loadDirectories() {
    console.log('📚 Завантаження довідників...');
    
    try {
      // Загружаем справочник клиент-менеджер
      this.focus2Data.clientManagerDirectory = await loadClientManagerDirectory();
      
      // Загружаем номенклатуру с категориями
      const nomenclatureResponse = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category');
      const nomenclature = await nomenclatureResponse.json();
      this.focus2Data.nomenclature = nomenclature;
      
      console.log('✅ Довідники завантажено');
      
    } catch (error) {
      console.error('❌ Помилка завантаження довідників:', error);
      throw new Error('Не вдалося завантажити довідники');
    }
  }
  
  /**
   * Шаг 3: Загрузка данных продаж
   */
  async loadSalesData() {
    console.log('📊 Завантаження даних продажів...');
    
    try {
      // Загружаем продажи из API и статического файла
      const [apiResponse, staticResponse] = await Promise.all([
        fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
        fetch('модуль помічник продажу/data.json')
      ]);
      
      const apiData = await apiResponse.json();
      const staticData = await staticResponse.json();
      
      // Объединяем данные продаж
      this.focus2Data.sales = apiData.concat(staticData);
      
      console.log(`✅ Завантажено ${this.focus2Data.sales.length} записів продажів`);
      
    } catch (error) {
      console.error('❌ Помилка завантаження продажів:', error);
      throw new Error('Не вдалося завантажити дані продажів');
    }
  }
  
  /**
   * Шаг 4: Анализ клиентов
   */
  async analyzeClients() {
    console.log('🔍 Аналіз клієнтів...');
    
    try {
      // Группируем продажи по клиентам
      const clientsMap = new Map();
      
      this.focus2Data.sales.forEach(sale => {
        const clientCode = sale['Клиент.Код'];
        if (!clientCode) return;
        
        if (!clientsMap.has(clientCode)) {
          clientsMap.set(clientCode, {
            code: clientCode,
            name: sale['Клиент'],
            sphere: sale['Сфера деятельности'],
            manager: sale['Основной менеджер'] || sale['Менеджер'] || '',
            sales: [],
            totalRevenue: 0,
            lastPurchaseDate: null,
            daysSinceLastPurchase: 0
          });
        }
        
        const client = clientsMap.get(clientCode);
        client.sales.push(sale);
        
        // Считаем выручку
        const revenue = typeof sale['Выручка'] === 'string' 
          ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
          : (sale['Выручка'] || 0);
        client.totalRevenue += revenue;
        
        // Обновляем дату последней покупки
        const saleDate = new Date(sale['Дата']);
        if (!client.lastPurchaseDate || saleDate > client.lastPurchaseDate) {
          client.lastPurchaseDate = saleDate;
        }
      });
      
      // Вычисляем дни с последней покупки
      const now = new Date();
      clientsMap.forEach(client => {
        if (client.lastPurchaseDate) {
          const diffTime = now - client.lastPurchaseDate;
          client.daysSinceLastPurchase = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      });
      
      this.focus2Data.clients = Array.from(clientsMap.values());
      
      console.log(`✅ Проаналізовано ${this.focus2Data.clients.length} клієнтів`);
      
    } catch (error) {
      console.error('❌ Помилка аналізу клієнтів:', error);
      throw new Error('Не вдалося проаналізувати клієнтів');
    }
  }
  
  /**
   * Шаг 5: Построение расчетов
   */
  async buildCalculations() {
    console.log('🧮 Побудова розрахунків...');
    
    try {
      // Здесь будут расчеты для задач
      // Пока что просто готовим структуру
      this.focus2Data.calculations = {
        ready: true,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Розрахунки готові');
      
    } catch (error) {
      console.error('❌ Помилка побудови розрахунків:', error);
      throw new Error('Не вдалося побудувати розрахунки');
    }
  }
  
  /**
   * Шаг 6: Применение фильтров
   */
  async applyFilters() {
    console.log('🔧 Застосування фільтрів...');
    
    try {
      // Инициализируем фильтры
      this.focus2Data.filters = {
        department: '',
        manager: '',
        period: '3',
        status: '',
        search: ''
      };
      
      console.log('✅ Фільтри налаштовано');
      
    } catch (error) {
      console.error('❌ Помилка налаштування фільтрів:', error);
      throw new Error('Не вдалося налаштувати фільтри');
    }
  }
  
  /**
   * Шаг 7: Рендеринг интерфейса
   */
  async renderInterface() {
    console.log('🎨 Створення інтерфейсу...');
    
    try {
      // Подготавливаем UI компоненты
      this.focus2Data.ui = {
        ready: true,
        components: ['tasks', 'reports', 'analytics']
      };
      
      console.log('✅ Інтерфейс готовий');
      
    } catch (error) {
      console.error('❌ Помилка створення інтерфейсу:', error);
      throw new Error('Не вдалося створити інтерфейс');
    }
  }
  
  /**
   * Шаг 8: Завершение
   */
  async finalize() {
    console.log('✅ Завершення ініціалізації...');
    
    try {
      // Сохраняем данные в глобальную переменную
      window.focus2Data = this.focus2Data;
      
      // Очищаем кэш если нужно
      if (window._focusSalesCache) {
        delete window._focusSalesCache;
      }
      
      console.log('✅ Фокус 2.0 готовий до роботи');
      
    } catch (error) {
      console.error('❌ Помилка завершення:', error);
      throw new Error('Не вдалося завершити ініціалізацію');
    }
  }
  
  /**
   * Показ основного контента
   */
  showMainContent() {
    // Контент будет загружен в основном модуле
    console.log('🎉 Фокус 2.0 успішно завантажено!');
  }
  
  /**
   * Показ состояния ошибки
   */
  showErrorState(errorMessage) {
    this.container.innerHTML = `
      <div class="text-center p-8">
        <div class="text-red-500 text-6xl mb-4">⚠️</div>
        <p class="text-lg font-medium text-red-400 mb-2">Помилка завантаження Фокус 2.0</p>
        <p class="text-sm text-gray-400">${errorMessage}</p>
        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
          Спробувати ще раз
        </button>
      </div>
    `;
  }
} 