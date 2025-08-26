// Фокус 2.0 - Главный модуль
import * as firebase from '../../firebase.js';
import { hasPermission, loadClientManagerDirectory } from '../../main.js';
import { FocusLoadingManager } from './loading.js';
import { FocusTaskConstructor } from './taskConstructor.js';
import { FocusNomenclatureSelector } from './nomenclatureSelector.js';
import { FocusClientAnalyzer } from './clientAnalyzer.js';
import { FocusFilters } from './filters.js';
import { FocusReports } from './reports.js';
import { FocusAnalytics } from './analytics.js';
import { FocusUI } from './ui.js';
import { initNotesModule } from './notes.js';

// Глобальные переменные модуля
let focus2Data = {
  tasks: [],
  clients: [],
  sales: [],
  nomenclature: [],
  clientManagerDirectory: {},
  userAccess: {},
  currentTask: null
};

// Делаем данные доступными глобально
window.focus2Data = focus2Data;

// API endpoints
const API_ENDPOINTS = {
  sales: 'https://fastapi.lookfort.com/nomenclature.analysis',
  staticSales: 'модуль помічник продажу/data.json',
  clientManager: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url',
  nomenclature: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category',
  deals: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=dela',
  calls: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=calls'
};

/**
 * Инициализация модуля Фокус 2.0
 */
export async function initFocus2Module(container) {
  // Проверяем права доступа
  if (!hasPermission('focus_view')) {
    container.innerHTML = `
      <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
        <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
        <p class="text-gray-300">У вас немає прав для перегляду модуля Фокус 2.0.</p>
      </div>
    `;
    return;
  }
  
  try {
    // Показываем анимированную загрузку
    showFocus2LoadingAnimation(container);
    
    // Инициализируем компоненты
    await initializeComponents(container);
    
    // Показываем основной интерфейс
    await showMainInterface(container);
    
  } catch (error) {
    console.error('❌ Помилка ініціалізації Фокус 2.0:', error);
    showFocus2Error(container, 'Помилка ініціалізації модуля');
  }
}

/**
 * Показ анимированной загрузки (как в Sales Assistant)
 */
function showFocus2LoadingAnimation(container) {
  container.innerHTML = `
    <div class="w-full min-h-screen pb-6">
      <header class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold">Фокус 2.0</h1>
          <p class="mt-2">Розширена система управління фокусними задачами</p>
        </div>
      </header>
      
      <!-- Індикатор завантаження -->
      <div id="focus2-loading-container" class="text-center p-8">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <div>
          <p id="focus2-loading-message" class="text-lg font-medium text-gray-200 mb-2">Завантаження даних...</p>
          <div class="bg-gray-700 rounded-full h-2 max-w-md mx-auto mb-2">
            <div id="focus2-progress-bar" class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          <p id="focus2-loading-step" class="text-sm text-gray-400">Ініціалізація...</p>
        </div>
      </div>
      
      <!-- Основний контент (спочатку прихований) -->
      <div id="focus2-main-content" class="hidden">
        <!-- Основной контент будет загружен здесь -->
      </div>
    </div>
  `;
}

/**
 * Обновление прогресса загрузки
 */
function updateFocus2LoadingProgress(percent, message, step) {
  const progressBar = document.getElementById('focus2-progress-bar');
  const loadingMessage = document.getElementById('focus2-loading-message');
  const loadingStep = document.getElementById('focus2-loading-step');
  
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (loadingMessage) loadingMessage.textContent = message;
  if (loadingStep) loadingStep.textContent = step;
}

/**
 * Показ основного контента
 */
function showFocus2MainContent() {
  const loadingContainer = document.getElementById('focus2-loading-container');
  const mainContent = document.getElementById('focus2-main-content');
  
  if (loadingContainer) loadingContainer.classList.add('hidden');
  if (mainContent) mainContent.classList.remove('hidden');
}

/**
 * Показ ошибки
 */
function showFocus2Error(container, errorMessage) {
  container.innerHTML = `
    <div class="text-center p-8">
      <div class="text-red-500 text-6xl mb-4">⚠️</div>
      <p class="text-lg font-medium text-red-400 mb-2">Помилка завантаження</p>
      <p class="text-sm text-gray-400">${errorMessage}</p>
      <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
        Спробувати ще раз
      </button>
    </div>
  `;
}

/**
 * Инициализация компонентов модуля
 */
async function initializeComponents(container) {
  try {
    // Инициализируем менеджер загрузки
    updateFocus2LoadingProgress(10, 'Ініціалізація менеджера завантаження...', 'Створення системи завантаження');
    const loadingManager = new FocusLoadingManager();
    
    // Инициализируем конструктор задач
    updateFocus2LoadingProgress(15, 'Ініціалізація конструктора задач...', 'Налаштування системи задач');
    const taskConstructor = new FocusTaskConstructor();
    await taskConstructor.init();
    
    // Инициализируем селектор номенклатуры
    updateFocus2LoadingProgress(20, 'Ініціалізація селектора номенклатури...', 'Завантаження довідника');
    const nomenclatureSelector = new FocusNomenclatureSelector();
    await nomenclatureSelector.init();
    
    // Инициализируем анализатор клиентов
    updateFocus2LoadingProgress(30, 'Ініціалізація аналізатора клієнтів...', 'Налаштування аналітики');
    const clientAnalyzer = new FocusClientAnalyzer();
    
    // Инициализируем фильтры
    updateFocus2LoadingProgress(40, 'Ініціалізація фільтрів...', 'Налаштування фільтрації');
    const filters = new FocusFilters();
    await filters.init();
    
    // Инициализируем отчеты
    updateFocus2LoadingProgress(50, 'Ініціалізація звітів...', 'Підключення модуля звітів');
    const reports = new FocusReports();
    await reports.init();
    
    // Инициализируем аналитику
    updateFocus2LoadingProgress(60, 'Ініціалізація аналітики...', 'Підключення модуля аналітики');
    const analytics = new FocusAnalytics();
    await analytics.init();
    
    // Инициализируем UI
    updateFocus2LoadingProgress(70, 'Ініціалізація інтерфейсу...', 'Створення UI компонентів');
    const ui = new FocusUI();
    await ui.init();
    
    // Инициализируем модуль заметок
    updateFocus2LoadingProgress(75, 'Ініціалізація модуля нотаток...', 'Підключення системи нотаток');
    await initNotesModule();
    
    // Сохраняем ссылки на компоненты
    window.focus2Components = {
      nomenclatureSelector,
      clientAnalyzer,
      filters,
      reports,
      analytics,
      ui
    };
    
    updateFocus2LoadingProgress(80, 'Завантаження даних...', 'Отримання даних з серверів');
    
    // Загружаем данные
    await loadFocus2Data();
    
    updateFocus2LoadingProgress(90, 'Фіналізація...', 'Завершення ініціалізації');
    
  } catch (error) {
    console.error('❌ Помилка ініціалізації компонентів:', error);
    throw error;
  }
}

/**
 * Показ основного интерфейса
 */
async function showMainInterface(container) {
  const mainContent = document.getElementById('focus2-main-content');
  
  mainContent.innerHTML = `
    <div class="focus2-dashboard">
      <!-- Статистика -->
      <div class="focus2-stats">
        <div class="stat-card">
          <h3>Активних задач</h3>
          <span class="stat-number" id="activeTasksCount">0</span>
        </div>
        <div class="stat-card">
          <h3>Клієнтів в роботі</h3>
          <span class="stat-number" id="totalClientsCount">0</span>
        </div>
        <div class="stat-card">
          <h3>Конверсія</h3>
          <span class="stat-number" id="conversionRate">0%</span>
        </div>
        <div class="stat-card">
          <h3>Середній чек</h3>
          <span class="stat-number" id="avgOrderValue">0 ₴</span>
        </div>
      </div>
      
      <!-- Вкладки -->
      <div class="focus2-tabs">
        <button class="tab-btn active" data-tab="tasks">Задачі</button>
        <button class="tab-btn" data-tab="reports">Звіти</button>
        <button class="tab-btn" data-tab="analytics">Аналітика</button>
      </div>
      
      <!-- Контент вкладок -->
      <div class="focus2-content">
        <div id="tasks-tab" class="tab-content active">
          <!-- Содержимое вкладки задач -->
        </div>
        <div id="reports-tab" class="tab-content">
          <!-- Содержимое вкладки отчетов -->
        </div>
        <div id="analytics-tab" class="tab-content">
          <!-- Содержимое вкладки аналитики -->
        </div>
      </div>
    </div>
  `;
  
  // Оновлюємо статистику після створення інтерфейсу
  updateStatistics();
  
  // Навешиваем обработчики
  await setupEventListeners(container);
  
  // Показываем основной контент
  showFocus2MainContent();
  
  // Загружаем начальный контент
  loadTabContent('tasks');
}

/**
 * Настройка обработчиков событий
 */
async function setupEventListeners(container) {
  // Кнопка создания задачи
  const createBtn = container.querySelector('#createFocus2TaskBtn');
  if (createBtn) {
    createBtn.onclick = () => {
      console.log('🔄 Клік по кнопці створення задачі');
      if (window.focus2TaskConstructor) {
        console.log('✅ Конструктор задач готовий');
        window.focus2TaskConstructor.showCreateModal();
      } else {
        console.error('❌ Конструктор задач не ініціалізовано');
        alert('Помилка: конструктор задач не готовий. Спробуйте перезавантажити сторінку.');
      }
    };
  }
  
  // Переключение вкладок
  const tabBtns = container.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      console.log('🔄 Переключення вкладки:', btn.dataset.tab);
      const tab = btn.dataset.tab;
      switchTab(tab);
    };
  });
  
      // Инициализируем селектор номенклатуры для конструктора задач
    if (window.focus2Components?.nomenclatureSelector) {
      console.log('🔧 Ініціалізація конструктора задач з селектором номенклатури');
      console.log('📋 Селектор номенклатури:', window.focus2Components.nomenclatureSelector);
      const taskConstructor = new FocusTaskConstructor();
      await taskConstructor.init(window.focus2Components.nomenclatureSelector);
      window.focus2TaskConstructor = taskConstructor;
      // Добавляем конструктор задач в компоненты для доступа из UI
      window.focus2Components.taskConstructor = taskConstructor;
      console.log('✅ Конструктор задач успішно ініціалізовано');
      
      // Обновляем статусы задач
      await taskConstructor.updateTaskStatuses();
    } else {
      console.error('❌ Селектор номенклатури не знайдено для конструктора задач');
      console.log('📋 Доступні компоненти:', Object.keys(window.focus2Components || {}));
    }
}

/**
 * Переключение вкладок
 */
function switchTab(tabName) {
  // Убираем активный класс со всех кнопок и контента
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Добавляем активный класс выбранной вкладке
  const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
  const activeContent = document.getElementById(`${tabName}-tab`);
  
  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.classList.add('active');
  
  // Загружаем контент вкладки
  loadTabContent(tabName);
}

/**
 * Загрузка контента вкладки
 */
async function loadTabContent(tabName) {
  const contentContainer = document.getElementById(`${tabName}-tab`);
  
  switch (tabName) {
    case 'tasks':
      await loadTasksContent(contentContainer);
      break;
    case 'reports':
      await loadReportsContent(contentContainer);
      break;
    case 'analytics':
      await loadAnalyticsContent(contentContainer);
      break;
  }
}

/**
 * Загрузка контента вкладки задач
 */
async function loadTasksContent(container) {
  try {
    // Загружаем задачи из Firebase
    const companyId = window.state?.currentCompanyId;
    if (companyId) {
      const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2');
      const snapshot = await firebase.getDocs(tasksRef);
      focus2Data.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // Рендерим список задач
    if (window.focus2Components?.ui) {
      container.innerHTML = window.focus2Components.ui.renderTasksList(focus2Data.tasks);
      
      // Додаємо фільтри якщо вони є
      if (window.focus2Components?.filters) {
        const filtersContainer = container.querySelector('.filters-container');
        if (filtersContainer) {
          filtersContainer.innerHTML = window.focus2Components.filters.render();
        }
      }
    } else {
      container.innerHTML = `
        <div class="text-center p-8">
          <h3 class="text-xl font-semibold text-white mb-4">Задачі Фокус 2.0</h3>
          <p class="text-gray-400">Список активних задач</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('❌ Помилка завантаження задач:', error);
    container.innerHTML = '<div class="text-center p-8 text-red-400">Помилка завантаження задач</div>';
  }
}

/**
 * Загрузка контента вкладки отчетов
 */
async function loadReportsContent(container) {
  try {
    if (window.focus2Components?.reports) {
      container.innerHTML = window.focus2Components.reports.render();
    } else {
      container.innerHTML = `
        <div class="text-center p-8">
          <h3 class="text-xl font-semibold text-white mb-4">Звіти Фокус 2.0</h3>
          <p class="text-gray-400">Функція звітів буде додана в наступному оновленні</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('❌ Помилка завантаження звітів:', error);
  }
}

/**
 * Загрузка контента вкладки аналитики
 */
async function loadAnalyticsContent(container) {
  try {
    if (window.focus2Components?.analytics) {
      // Обновляем данные аналитики
      await window.focus2Components.analytics.loadAnalyticsData();
      
      const analyticsContent = window.focus2Components.analytics.render();
      container.innerHTML = analyticsContent;
      
      console.log('✅ Контент аналітики завантажено');
    } else {
      container.innerHTML = `
        <div class="text-center p-8">
          <h3 class="text-xl font-semibold text-white mb-4">Аналітика Фокус 2.0</h3>
          <p class="text-gray-400">Функція аналітики буде додана в наступному оновленні</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('❌ Помилка завантаження аналітики:', error);
  }
}

/**
 * Загрузка данных модуля
 */
async function loadFocus2Data() {
  try {
    // Загружаем задачи из Firebase
    const companyId = window.state?.currentCompanyId;
    if (companyId) {
      const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2');
      const snapshot = await firebase.getDocs(tasksRef);
      focus2Data.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // Загружаем данные продаж (используем те же данные, что и salesAssistant)
    try {
      const [dataRes, dataJulyRes] = await Promise.all([
        fetch('модуль помічник продажу/data.json'),
        fetch('https://fastapi.lookfort.com/nomenclature.analysis')
      ]);
      const data = await dataRes.json();
      const dataJuly = await dataJulyRes.json();
      focus2Data.salesData = data.concat(dataJuly);
    } catch (error) {
      console.error('❌ Помилка завантаження даних продаж:', error);
      focus2Data.salesData = [];
    }
    
    // Загружаем справочник номенклатуры
    try {
      const [nomenclatureRes, nomenclatureCategoryRes] = await Promise.all([
        fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
        fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category')
      ]);
      focus2Data.nomenclatureData = await nomenclatureRes.json();
      focus2Data.nomenclature = await nomenclatureCategoryRes.json();
    } catch (error) {
      console.error('❌ Помилка завантаження номенклатури:', error);
      focus2Data.nomenclatureData = [];
      focus2Data.nomenclature = [];
    }
    
    // Загружаем справочник клиент-менеджер
    try {
      const clientManagerRes = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
      focus2Data.clientManagerDirectory = await clientManagerRes.json();
    } catch (error) {
      console.error('❌ Помилка завантаження довідника клієнт-менеджер:', error);
      focus2Data.clientManagerDirectory = {};
    }
    
    // Инициализируем анализатор клиентов с загруженными данными
    if (window.focus2Components?.clientAnalyzer) {
      try {
        await window.focus2Components.clientAnalyzer.init(
          focus2Data.salesData,
          focus2Data.nomenclatureData,
          focus2Data.clientManagerDirectory
        );
      } catch (error) {
        console.error('❌ Помилка ініціалізації аналізатора клієнтів:', error);
      }
    }
    
    // Оновлюємо фільтри після завантаження даних
    if (window.focus2Components?.filters) {
      try {
        await window.focus2Components.filters.loadAvailableFilters();
      } catch (error) {
        console.error('❌ Помилка оновлення фільтрів:', error);
      }
    }
    
    // Обновляем глобальные данные
    window.focus2Data = focus2Data;
    
  } catch (error) {
    console.error('❌ Помилка завантаження даних Фокус 2.0:', error);
  }
}

/**
 * Обновление статистики
 */
function updateStatistics() {
  console.log('📊 Оновлення статистики Фокус 2.0...');
  
  // Подсчитываем активные задачи
  const activeTasks = focus2Data.tasks.filter(t => t.status !== 'archived').length;
  console.log('✅ Активних задач:', activeTasks);
  
  // Подсчитываем общее количество клиентов из всех задач
  let totalClients = 0;
  let totalRevenue = 0;
  let totalClientsWithRevenue = 0;
  
  focus2Data.tasks.forEach(task => {
    // Проверяем наличие клиентов в задаче
    if (task.clientsSnapshot && Array.isArray(task.clientsSnapshot)) {
      totalClients += task.clientsSnapshot.length;
      console.log(`📋 Задача "${task.title}": ${task.clientsSnapshot.length} клієнтів`);
    } else if (task.clientsSnapshotCount && task.clientsSnapshotCount > 0) {
      totalClients += task.clientsSnapshotCount;
      console.log(`📋 Задача "${task.title}": ${task.clientsSnapshotCount} клієнтів (з лічильника)`);
    }
    
    // Подсчитываем выручку по клиентам задачи
    if (task.clientsSnapshot && Array.isArray(task.clientsSnapshot)) {
      task.clientsSnapshot.forEach(client => {
        if (client.revenue && client.revenue > 0) {
          totalRevenue += client.revenue;
          totalClientsWithRevenue++;
        }
      });
    }
  });
  
  console.log('📊 Загальна статистика:', {
    activeTasks,
    totalClients,
    totalRevenue,
    totalClientsWithRevenue
  });
  
  // Рассчитываем конверсию (процент активных задач от общего количества задач)
  const totalTasks = focus2Data.tasks.length;
  const conversion = totalTasks > 0 ? Math.round((activeTasks / totalTasks) * 100) : 0;
  
  // Рассчитываем средний чек
  const avgOrder = totalClientsWithRevenue > 0 ? totalRevenue / totalClientsWithRevenue : 0;
  
  // Обновляем элементы на странице
  const activeTasksEl = document.getElementById('activeTasksCount');
  const totalClientsEl = document.getElementById('totalClientsCount');
  const conversionEl = document.getElementById('conversionRate');
  const avgOrderEl = document.getElementById('avgOrderValue');
  
  if (activeTasksEl) {
    activeTasksEl.textContent = activeTasks;
    console.log('✅ Оновлено активних задач:', activeTasks);
  }
  
  if (totalClientsEl) {
    totalClientsEl.textContent = totalClients;
    console.log('✅ Оновлено клієнтів:', totalClients);
  }
  
  if (conversionEl) {
    conversionEl.textContent = `${conversion}%`;
    console.log('✅ Оновлено конверсію:', conversion);
  }
  
  if (avgOrderEl) {
    avgOrderEl.textContent = `${Math.round(avgOrder).toLocaleString()} ₴`;
    console.log('✅ Оновлено середній чек:', avgOrder);
  }
  
  console.log('✅ Статистика успішно оновлена');
}

// Делаем функцию глобально доступной
window.updateStatistics = updateStatistics;

// Экспортируем функции для использования в других модулях
export { focus2Data, API_ENDPOINTS }; 