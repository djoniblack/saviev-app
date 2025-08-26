// UI компоненты для Фокус 2.0
import * as firebase from '../../firebase.js';
import { getFocusNotes, setFocusNote, renderClientsTableWithNotes, attachTableHandlers, exportToCSV, getClientLink } from './notes.js';

export class FocusUI {
  constructor() {
    this.currentView = 'tasks';
    this.components = {};
  }
  
  /**
   * Инициализация UI компонентов
   */
  async init() {
    console.log('🎨 UI компоненти Фокус 2.0 ініціалізовано');
  }
  
  /**
   * Рендеринг списка задач з групуванням та анімацією
   */
  renderTasksList(tasks = []) {
    if (tasks.length === 0) {
      return `
        <div class="text-center py-12 focus-empty-state">
          <div class="text-gray-400 text-6xl mb-4">📋</div>
          <h3 class="text-xl font-semibold text-white mb-2">Немає активних задач</h3>
          <p class="text-gray-400 mb-6">Створіть першу фокусну задачу для початку роботи</p>
          <button onclick="window.focus2Components?.taskConstructor?.showCreateModal()" 
                  class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all duration-200 hover:scale-105 focus-action-btn">
            Створити задачу
          </button>
        </div>
      `;
    }
    
    // Групуємо задачі за статусом
    const groupedTasks = this.groupTasksByStatus(tasks);
    
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-white">Фокусні задачі</h2>
          <button onclick="window.focus2Components?.taskConstructor?.showCreateModal()" 
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-all duration-200 hover:scale-105 flex items-center gap-2 focus-action-btn">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Нова задача
          </button>
        </div>
        
        <!-- Фільтри -->
        <div class="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div class="flex flex-wrap gap-4 items-end">
            <div>
              <label class="block text-gray-300 text-sm mb-1">Статус</label>
              <select id="task-status-filter" class="bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none focus-filter-input">
                <option value="">Всі статуси</option>
                <option value="active">Активні</option>
                <option value="paused">Призупинені</option>
                <option value="completed">Завершені</option>
                <option value="archived">Архівовані</option>
              </select>
            </div>
            <div>
              <label class="block text-gray-300 text-sm mb-1">Період</label>
              <select id="task-period-filter" class="bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none focus-filter-input">
                <option value="">Всі періоди</option>
                <option value="current">Поточний місяць</option>
                <option value="next">Наступний місяць</option>
                <option value="past">Минулі місяці</option>
              </select>
            </div>
            <div>
              <label class="block text-gray-300 text-sm mb-1">Пошук</label>
              <input type="text" id="task-search-filter" placeholder="Назва задачі..." 
                     class="bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none focus-filter-input">
            </div>
            <div class="flex gap-2">
              <button id="task-filter-reset" class="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-500 transition-colors duration-200 focus-action-btn">
                Скинути
              </button>
              <button id="task-filter-apply" class="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 transition-colors duration-200 focus-action-btn">
                Оновити
              </button>
            </div>
          </div>
        </div>
        
        <!-- Групування задач за статусом -->
        ${this.renderTaskGroups(groupedTasks)}
      </div>
    `;
    
    // Прив'язуємо обробники подій до фільтрів задач
    setTimeout(() => {
      if (window.focus2Components?.filters) {
        window.focus2Components.filters.attachFilterEventHandlers();
      }
      
      // Прив'язуємо обробники для кнопок фільтрів задач
      const resetButton = document.getElementById('task-filter-reset');
      const applyButton = document.getElementById('task-filter-apply');
      
      if (resetButton) {
        resetButton.onclick = () => {
          // Скидаємо значення фільтрів
          const statusFilter = document.getElementById('task-status-filter');
          const periodFilter = document.getElementById('task-period-filter');
          const searchFilter = document.getElementById('task-search-filter');
          
          if (statusFilter) statusFilter.value = '';
          if (periodFilter) periodFilter.value = '';
          if (searchFilter) searchFilter.value = '';
          
          // Застосовуємо скинуті фільтри
          this.applyTaskFilters();
        };
      }
      
      if (applyButton) {
        applyButton.onclick = () => {
          this.applyTaskFilters();
        };
      }
    }, 100);
  }
  
  /**
   * Групування задач за статусом
   */
  groupTasksByStatus(tasks) {
    const groups = {
      active: { tasks: [], title: 'Активні задачі', icon: '🟢', color: 'green' },
      paused: { tasks: [], title: 'Призупинені задачі', icon: '🟡', color: 'yellow' },
      completed: { tasks: [], title: 'Завершені задачі', icon: '🔵', color: 'blue' },
      archived: { tasks: [], title: 'Архівовані задачі', icon: '⚫', color: 'gray' }
    };
    
    tasks.forEach(task => {
      const status = task.status || 'active';
      if (groups[status]) {
        groups[status].tasks.push(task);
      }
    });
    
    return groups;
  }
  
  /**
   * Рендеринг груп задач
   */
  renderTaskGroups(groupedTasks) {
    let html = '';
    
    // Спочатку показуємо активні задачі
    if (groupedTasks.active.tasks.length > 0) {
      html += this.renderTaskGroup(groupedTasks.active, 'active');
    }
    
    // Потім інші групи
    ['paused', 'completed', 'archived'].forEach(status => {
      if (groupedTasks[status].tasks.length > 0) {
        html += this.renderTaskGroup(groupedTasks[status], status);
      }
    });
    
    return html;
  }
  
  /**
   * Рендеринг групи задач
   */
  renderTaskGroup(group, status) {
    const groupColors = {
      active: { bg: 'bg-green-900/20', border: 'border-green-500/30', text: 'text-green-400' },
      paused: { bg: 'bg-yellow-900/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
      completed: { bg: 'bg-blue-900/20', border: 'border-blue-500/30', text: 'text-blue-400' },
      archived: { bg: 'bg-gray-900/20', border: 'border-gray-500/30', text: 'text-gray-400' }
    };
    
    const colors = groupColors[status] || groupColors.archived;
    
    return `
      <div class="mb-8 focus-task-group">
        <div class="flex items-center gap-3 mb-4 focus-group-header">
          <span class="text-2xl">${group.icon}</span>
          <h3 class="text-lg font-semibold ${colors.text}">${group.title}</h3>
          <span class="px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">${group.tasks.length}</span>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${group.tasks.map(task => this.renderTaskCard(task)).join('')}
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг карточки задачи з анімацією
   */
  renderTaskCard(task) {
    const statusColors = {
      active: { bg: 'bg-green-600', border: 'border-green-500', hover: 'hover:border-green-400' },
      paused: { bg: 'bg-yellow-600', border: 'border-yellow-500', hover: 'hover:border-yellow-400' },
      completed: { bg: 'bg-blue-600', border: 'border-blue-500', hover: 'hover:border-blue-400' },
      archived: { bg: 'bg-gray-600', border: 'border-gray-500', hover: 'hover:border-gray-400' }
    };
    
    const statusText = {
      active: 'Активна',
      paused: 'Призупинена',
      completed: 'Завершена',
      archived: 'Архівована'
    };
    
    const colors = statusColors[task.status] || statusColors.archived;
    
    return `
      <div class="bg-gray-800 rounded-lg p-4 border ${colors.border} hover:${colors.hover} transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20 cursor-pointer group focus-task-card" 
           onclick="window.focus2Components?.ui?.showTaskDetails('${task.id}')">
        
        <!-- Заголовок з анімацією -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-white mb-1 truncate group-hover:text-blue-300 transition-colors duration-200">
              ${task.title || 'Без назви'}
            </h3>
            <p class="text-gray-400 text-xs mb-2 line-clamp-2 group-hover:text-gray-300 transition-colors duration-200">
              ${task.description || 'Без опису'}
            </p>
          </div>
          <span class="px-2 py-1 text-xs font-medium rounded-full ${colors.bg} text-white ml-2 flex-shrink-0 group-hover:scale-110 transition-transform duration-200 focus-status-badge">
            ${statusText[task.status] || 'Невідомий'}
          </span>
        </div>
        
        <!-- Інформація про задачу -->
        <div class="space-y-2 mb-3">
          <div class="flex items-center text-xs">
            <span class="text-gray-400 w-16">Продукти:</span>
            <span class="text-white font-medium">${task.products?.length || 0} позицій</span>
          </div>
          <div class="flex items-center text-xs">
            <span class="text-gray-400 w-16">Створена:</span>
            <span class="text-white">${this.formatDate(task.createdAt)}</span>
          </div>
          ${task.periodFrom ? `
            <div class="flex items-center text-xs">
              <span class="text-gray-400 w-16">Період:</span>
              <span class="text-white">${this.formatDate(task.periodFrom)} - ${this.formatDate(task.periodTo)}</span>
            </div>
          ` : ''}
          ${task.clientsSnapshot ? `
            <div class="flex items-center text-xs">
              <span class="text-gray-400 w-16">Клієнти:</span>
              <span class="text-white font-medium">${task.clientsSnapshot.length} клієнтів</span>
            </div>
          ` : ''}
        </div>
        
        <!-- Прогрес бар (якщо є дані про прогрес) -->
        ${this.renderTaskProgress(task)}
        
        <!-- Кнопки дій -->
        <div class="flex items-center justify-between pt-3 border-t border-gray-700 mt-3">
          <div class="flex gap-2">
            <button onclick="event.stopPropagation(); window.focus2Components?.ui?.showTaskDetails('${task.id}')" 
                    class="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-500 transition-colors duration-200 group-hover:bg-blue-600 group-hover:hover:bg-blue-500 focus-action-btn">
              Деталі
            </button>
            <button onclick="event.stopPropagation(); window.focus2Components?.ui?.generateTaskReport('${task.id}')" 
                    class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 transition-colors duration-200 focus-action-btn">
              Звіт
            </button>
          </div>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button onclick="event.stopPropagation(); window.focus2Components?.ui?.editTask('${task.id}')" 
                    class="p-1 text-gray-400 hover:text-white transition-colors duration-200 focus-action-btn">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button onclick="event.stopPropagation(); window.focus2Components?.ui?.archiveTask('${task.id}')" 
                    class="p-1 text-gray-400 hover:text-red-400 transition-colors duration-200 focus-action-btn">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг прогрес бару задачі
   */
  renderTaskProgress(task) {
    // Якщо немає даних про прогрес, не показуємо
    if (!task.clientsSnapshot || !Array.isArray(task.clientsSnapshot)) {
      return '';
    }
    
    const totalClients = task.clientsSnapshot.length;
    const completedClients = task.clientsSnapshot.filter(client => {
      // Тут можна додати логіку визначення завершених клієнтів
      // Наприклад, через нотатки або статус
      return false; // Поки що повертаємо false
    }).length;
    
    const progressPercent = totalClients > 0 ? (completedClients / totalClients) * 100 : 0;
    
    return `
      <div class="mb-3">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="text-gray-400">Прогрес</span>
          <span class="text-white">${completedClients}/${totalClients}</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div class="bg-blue-600 h-2 rounded-full transition-all duration-300 focus-progress-bar" 
               style="width: ${progressPercent}%"></div>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг деталей задачи
   */
  async renderTaskDetails(taskId) {
    try {
      console.log('📋 Рендеринг деталей задачі:', taskId);
      
      const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
      if (!task) {
        return '<div class="text-red-400">Задачу не знайдено</div>';
      }

      // Start with basic task info first (fast rendering)
      const basicInfo = `
        <div class="bg-gray-800 rounded-lg p-4 w-full">
          <!-- Компактний заголовок -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-bold text-white">${task.title || 'Без назви'}</h2>
              <div class="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                <span>Статус: ${task.status}</span>
                <span>Створена: ${this.formatDate(task.createdAt)}</span>
                ${task.periodFrom ? `<span>Період: ${this.formatDate(task.periodFrom)} - ${this.formatDate(task.periodTo)}</span>` : ''}
                <span>Номенклатура: ${task.products?.length || 0} позицій</span>
              </div>
            </div>
            <div class="flex space-x-2">
              <button onclick="window.focus2Components?.ui?.generateTaskReport('${taskId}')" 
                      class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500">
                Звіт
              </button>
              <button onclick="window.focus2Components?.ui?.editTask('${taskId}')" 
                      class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">
                Редагувати
              </button>
            </div>
          </div>

          <!-- Компактна інформація (завжди згорнута) -->
          <div class="mb-4">
            <button onclick="toggleSection('task-details')" 
                    class="flex items-center justify-between w-full p-2 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors">
              <span class="text-gray-300">Деталі задачі</span>
              <svg id="task-details-icon" class="w-4 h-4 text-gray-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="task-details" class="hidden mt-2 p-3 bg-gray-700 rounded text-sm">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span class="text-gray-400">Фокусна номенклатура:</span>
                  <div class="mt-1">
                    ${task.products?.slice(0, 5).map(code => `
                      <span class="inline-block bg-blue-600 text-white px-2 py-1 rounded text-xs mr-1 mb-1">
                        ${this.getNomenclatureName(code)}
                      </span>
                    `).join('') || '<span class="text-gray-400">Не обрана</span>'}
                    ${task.products?.length > 5 ? `<span class="text-gray-400 text-xs">... та ще ${task.products.length - 5}</span>` : ''}
                  </div>
                </div>
                <div>
                  <span class="text-gray-400">Параметри аналізу:</span>
                  <div class="mt-1">
                    ${this.renderParameters(task.parameters)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Вкладки параметрів -->
          <div class="mb-4" id="parameter-tabs-container">
            ${this.renderParameterTabs(taskId)}
          </div>
          
          <!-- Фильтры клиентов -->
          <div class="mb-4" id="client-filters-container">
            ${this.renderClientFilters(taskId)}
          </div>
          
          <!-- Клиенты (с загрузкой) -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-white">Знайдені клієнти</h3>
              <div class="flex space-x-2">
                <button onclick="window.focus2Components?.ui?.exportClientsToCSV('${taskId}')" 
                        class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500">
                  📊 Експорт CSV
                </button>
                <button onclick="window.focus2Components?.ui?.showSimpleClientsTable('${taskId}')" 
                        class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">
                  📋 Простий перегляд
                </button>
              </div>
            </div>
            <div id="clients-container" class="bg-gray-700 rounded-lg p-4">
              <div class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-400">Завантаження клієнтів...</p>
              </div>
            </div>
          </div>
        </div>
      `;

      // Return basic info immediately for fast rendering
      return basicInfo;

    } catch (error) {
      console.error('❌ Помилка рендерингу деталей задачі:', error);
      return '<div class="text-red-400">Помилка відображення деталей задачі</div>';
    }
  }
  
  /**
   * Рендеринг параметров задачи
   */
  renderParameters(parameters) {
    if (!parameters) return '<span class="text-gray-400">Параметри не налаштовані</span>';
    
    const paramDescriptions = {
      param1: 'Купували раніше',
      param2: 'Не купували днів',
      param3: 'Низька частота',
      param4: 'Низька сума',
      param5: 'Певні сегменти',
      param6: 'Похожі клієнти',
      param7: 'Беруть X'
    };
    
    return Object.entries(parameters).map(([param, config]) => `
      <div class="flex items-center space-x-2 p-2 bg-gray-600 rounded text-xs">
        <div class="w-2 h-2 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-500'}"></div>
        <span class="text-white">${paramDescriptions[param] || param}</span>
        ${config.enabled ? `
          <span class="text-gray-400">(${this.getParameterDetails(param, config)})</span>
        ` : ''}
      </div>
    `).join('');
  }
  
  /**
   * Получение деталей параметра
   */
  getParameterDetails(param, config) {
    switch (param) {
      case 'param1':
        return `Період: ${config.period || 'місяць'}`;
      case 'param2':
        return `${config.days || 30} днів без покупок`;
      case 'param3':
        return `${config.frequency || 1} покупок за місяць`;
      case 'param4':
        return `${config.amount || 1000} ₴ за місяць`;
      case 'param5':
        const segments = [];
        if (config.segments?.vip) segments.push('VIP');
        if (config.segments?.regular) segments.push('Звичайні');
        if (config.segments?.new) segments.push('Нові');
        if (config.segments?.inactive) segments.push('Неактивні');
        return segments.length > 0 ? `Сегменти: ${segments.join(', ')}` : 'Сегменти не обрані';
      case 'param6':
        return `${config.similarity || 80}% схожості`;
      case 'param7':
        return `${config.products?.length || 0} товарів X`;
      default:
        return 'Налаштовано';
    }
  }
  
  /**
   * Рендеринг отчета
   */
  renderReport(report) {
    if (!report) {
      return '<div class="text-gray-400">Звіт не знайдено</div>';
    }
    
    return `
      <div class="bg-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-white">Звіт: ${report.taskTitle}</h2>
                     <div class="flex space-x-2">
             <button onclick="window.focus2Components?.ui?.exportReportToPDF()" 
                     class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500">
               PDF
             </button>
             <button onclick="window.focus2Components?.ui?.exportReportToExcel()" 
                     class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500">
               Excel
             </button>
           </div>
        </div>
        
        <!-- Сводка -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-gray-700 rounded-lg p-4">
            <h3 class="text-gray-400 text-sm">Всього клієнтів</h3>
            <p class="text-2xl font-bold text-white">${report.summary.totalClients}</p>
          </div>
          <div class="bg-gray-700 rounded-lg p-4">
            <h3 class="text-gray-400 text-sm">Підходящих</h3>
            <p class="text-2xl font-bold text-white">${report.summary.matchedClients}</p>
          </div>
          <div class="bg-gray-700 rounded-lg p-4">
            <h3 class="text-gray-400 text-sm">Відсоток</h3>
            <p class="text-2xl font-bold text-white">${report.summary.matchPercentage}%</p>
          </div>
          <div class="bg-gray-700 rounded-lg p-4">
            <h3 class="text-gray-400 text-sm">Параметрів</h3>
            <p class="text-2xl font-bold text-white">${report.summary.paramBreakdown.length}</p>
          </div>
        </div>
        
        <!-- Рекомендации -->
        <div class="mb-8">
          <h3 class="text-lg font-semibold text-white mb-4">Рекомендації</h3>
          <div class="space-y-3">
            ${report.recommendations.map(rec => `
              <div class="flex items-start space-x-3 p-3 bg-gray-700 rounded-md">
                <div class="flex-shrink-0">
                  <div class="w-2 h-2 rounded-full ${this.getRecommendationColor(rec.type)} mt-2"></div>
                </div>
                <div class="flex-1">
                  <p class="text-white">${rec.message}</p>
                  ${rec.action ? `
                    <button class="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500">
                      ${rec.action}
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Детали по параметрам -->
        <div class="mb-8">
          <h3 class="text-lg font-semibold text-white mb-4">Результати по параметрах</h3>
          <div class="space-y-4">
            ${report.summary.paramBreakdown.map(param => `
              <div class="flex items-center justify-between p-3 bg-gray-700 rounded-md">
                <span class="text-white">${param.description}</span>
                <span class="text-blue-400 font-semibold">${param.matched} клієнтів</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Графики -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-gray-700 rounded-lg p-4">
            <h3 class="text-white font-semibold mb-4">Сегменти клієнтів</h3>
            <div id="segments-chart" class="h-64"></div>
          </div>
          <div class="bg-gray-700 rounded-lg p-4">
            <h3 class="text-white font-semibold mb-4">Топ клієнтів за виручкою</h3>
            <div id="revenue-chart" class="h-64"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг списка клиентов
   */
  renderClientsList(clients = [], taskId) {
    if (clients.length === 0) {
      return `
        <div class="text-center py-12">
          <div class="text-gray-400 text-6xl mb-4">👥</div>
          <h3 class="text-xl font-semibold text-white mb-2">Клієнтів не знайдено</h3>
          <p class="text-gray-400">Спробуйте змінити фільтри або створити нову задачу</p>
        </div>
      `;
    }
    
    return `
      <div class="space-y-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-white">Знайдені клієнти (${clients.length})</h2>
                     <div class="flex space-x-2">
             <button onclick="window.focus2Components?.ui?.exportClientsToExcel()" 
                     class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500">
               Експорт
             </button>
           </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full bg-gray-800 rounded-lg overflow-hidden">
            <thead class="bg-gray-700">
              <tr>
                <th class="px-4 py-3 text-left text-white font-semibold">Клієнт</th>
                <th class="px-4 py-3 text-left text-white font-semibold">Менеджер</th>
                <th class="px-4 py-3 text-left text-white font-semibold">Виручка</th>
                <th class="px-4 py-3 text-left text-white font-semibold">Останній замов</th>
                <th class="px-4 py-3 text-left text-white font-semibold">Сегмент</th>
                <th class="px-4 py-3 text-left text-white font-semibold">Дії</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              ${clients.map(client => this.renderClientRow(client, taskId)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг строки клиента
   */
  renderClientRow(client, taskId) {
    const segmentColors = {
      vip: 'bg-purple-600',
      regular: 'bg-blue-600',
      new: 'bg-green-600',
      inactive: 'bg-gray-600'
    };
    
    return `
      <tr class="hover:bg-gray-700">
        <td class="px-4 py-3">
          <div>
            <div class="text-white font-medium">${client.name}</div>
            <div class="text-gray-400 text-sm">${client.code}</div>
          </div>
        </td>
        <td class="px-4 py-3 text-white">${client.manager || '-'}</td>
        <td class="px-4 py-3 text-white">${this.formatCurrency(client.totalRevenue || 0)}</td>
        <td class="px-4 py-3 text-white">${client.daysSinceLastPurchase ? `${client.daysSinceLastPurchase} дн.` : '-'}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-1 text-xs font-medium rounded-full ${segmentColors[client.segment] || 'bg-gray-600'} text-white">
            ${client.segment || 'new'}
          </span>
        </td>
        <td class="px-4 py-3">
          <div class="flex space-x-2">
            <button onclick="window.focus2Components?.ui?.showClientDetail('${client.code}', '${taskId}')" 
                    class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500" 
                    title="Деталі клієнта">
              👁️
            </button>
            <button onclick="window.focus2Components?.ui?.analyzeClient('${client.code}')" 
                    class="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-500" 
                    title="Аналіз клієнта">
              📊
            </button>
          </div>
        </td>
      </tr>
    `;
  }
  
  /**
   * Рендеринг деталей клиента
   */
  renderClientDetails(clientCode) {
    const client = window.focus2Data?.clients?.find(c => c.code === clientCode);
    if (!client) {
      return '<div class="text-red-400">Клієнта не знайдено</div>';
    }
    
    return `
      <div class="bg-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-white">${client.name}</h2>
                     <button onclick="window.focus2Components?.ui?.closeClientDetails()" class="text-gray-400 hover:text-white">
             <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
             </svg>
           </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-lg font-semibold text-white mb-4">Основна інформація</h3>
            <div class="space-y-3">
              <div>
                <label class="text-gray-400 text-sm">Код</label>
                <p class="text-white">${client.code}</p>
              </div>
              <div>
                <label class="text-gray-400 text-sm">Менеджер</label>
                <p class="text-white">${client.manager || '-'}</p>
              </div>
              <div>
                <label class="text-gray-400 text-sm">Сфера</label>
                <p class="text-white">${client.sphere || '-'}</p>
              </div>
              <div>
                <label class="text-gray-400 text-sm">Сегмент</label>
                <p class="text-white">${client.segment || 'new'}</p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 class="text-lg font-semibold text-white mb-4">Статистика</h3>
            <div class="space-y-3">
              <div>
                <label class="text-gray-400 text-sm">Загальна виручка</label>
                <p class="text-white">${this.formatCurrency(client.totalRevenue || 0)}</p>
              </div>
              <div>
                <label class="text-gray-400 text-sm">Кількість замовлень</label>
                <p class="text-white">${client.sales?.length || 0}</p>
              </div>
              <div>
                <label class="text-gray-400 text-sm">Останній замов</label>
                <p class="text-white">${client.daysSinceLastPurchase ? `${client.daysSinceLastPurchase} днів тому` : 'Немає даних'}</p>
              </div>
              <div>
                <label class="text-gray-400 text-sm">Середній чек</label>
                <p class="text-white">${this.formatCurrency(client.averageOrderValue || 0)}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="mt-8">
          <h3 class="text-lg font-semibold text-white mb-4">Топ товари</h3>
          <div class="space-y-2">
            ${client.topProducts?.slice(0, 5).map(product => `
              <div class="flex items-center justify-between p-2 bg-gray-700 rounded">
                <span class="text-white">${product.name}</span>
                <span class="text-blue-400">${this.formatCurrency(product.revenue)}</span>
              </div>
            `).join('') || '<span class="text-gray-400">Немає даних</span>'}
          </div>
        </div>
      </div>
    `;
  }
  
  // Вспомогательные методы
  
  /**
   * Форматирование даты
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA');
  }
  
  /**
   * Форматирование валюты
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH'
    }).format(amount);
  }
  
  /**
   * Получение названия номенклатуры
   */
  getNomenclatureName(code) {
    // Сначала пробуем найти в nomenclatureData (API данные)
    const nomenclatureData = window.focus2Data?.nomenclatureData || [];
    const item = nomenclatureData.find(n => n['Код'] === code || n['Номенклатура.Код'] === code);
    if (item) {
      return item['Номенклатура'] || item['Номенклатура.Название'] || code;
    }
    
    // Если не нашли, пробуем в nomenclature (категории)
    const nomenclature = window.focus2Data?.nomenclature || [];
    const categoryItem = nomenclature.find(n => n['Код'] === code);
    if (categoryItem) {
      return categoryItem['Номенклатура'] || code;
    }
    
    // Если ничего не нашли, возвращаем код
    return code;
  }
  
  /**
   * Получение цвета рекомендации
   */
  getRecommendationColor(type) {
    const colors = {
      info: 'bg-blue-500',
      action: 'bg-green-500',
      priority: 'bg-red-500',
      reactivation: 'bg-yellow-500'
    };
    return colors[type] || 'bg-gray-500';
  }
  
  /**
   * Групування продажів по даті
   */
  groupSalesByDate(sales) {
    if (!sales || sales.length === 0) return [];
    
    const grouped = {};
    
    sales.forEach(sale => {
      const date = sale['Дата'];
      const orderId = sale['ID'] || sale['Номер замовлення'] || sale['Дата']; // Используем ID заказа или дату как группировку
      
      if (!grouped[orderId]) {
        grouped[orderId] = {
          date: date,
          orderId: orderId,
          sales: [],
          totalRevenue: 0
        };
      }
      grouped[orderId].sales.push(sale);
      grouped[orderId].totalRevenue += (sale['Выручка'] || 0);
    });
    
    // Сортируем по дате (новые сначала)
    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  
  /**
   * Показ деталей задачи
   */
  async showTaskDetails(taskId) {
    try {
      // Проверяем, что задача существует
      const tasks = window.focus2Data?.tasks || [];
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) {
        console.error('❌ Задачу не знайдено:', taskId);
        alert('Задачу не знайдено. Спробуйте перезавантажити сторінку.');
        return;
      }
      
      const container = document.getElementById('tasks-tab');
      if (container) {
        // Показываем загрузку
        container.innerHTML = '<div class="text-center p-8"><div class="text-white">Завантаження деталей задачі...</div></div>';
        
        // Рендерим детали задачи (быстрое отображение)
        const taskDetails = await this.renderTaskDetails(taskId);
        container.innerHTML = taskDetails;
        
        // Асинхронно загружаем клиентов в отдельном контейнере
        if (task.hasClientsSnapshot) {
          const clientsContainer = document.getElementById('clients-container');
          if (clientsContainer) {
            const clientsContent = await this.loadTaskClients(taskId);
            clientsContainer.innerHTML = clientsContent;
            
            // Прикрепляем обработчики событий для таблицы с заметками
            attachTableHandlers(taskId);
            
            // Оновлюємо дані задачі в window.focus2Data після завантаження clientsSnapshot
            const clientsSnapshot = await window.focus2TaskConstructor.loadClientsSnapshot(taskId);
            const taskIndex = window.focus2Data.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
              window.focus2Data.tasks[taskIndex].clientsSnapshot = clientsSnapshot;
            }
            
            // Оновлюємо вкладки параметрів після завантаження клієнтів
            const parameterTabsContainer = document.getElementById('parameter-tabs-container');
            if (parameterTabsContainer) {
              const parameterTabsContent = this.renderParameterTabs(taskId);
              parameterTabsContainer.innerHTML = parameterTabsContent;
            }
            
            // Оновлюємо фільтри після завантаження даних
            const clientFiltersContainer = document.getElementById('client-filters-container');
            if (clientFiltersContainer) {
              const clientFiltersContent = this.renderClientFilters(taskId);
              clientFiltersContainer.innerHTML = clientFiltersContent;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Помилка показу деталей задачі:', error);
      alert(`Помилка показу деталей: ${error.message}`);
    }
  }
  
  /**
   * Закрытие деталей задачи
   */
  closeTaskDetails() {
    const container = document.getElementById('tasks-tab');
    if (container) {
      // Возвращаемся к списку задач
      this.loadTasksContent(container);
    }
  }
  
  /**
   * Загрузка контента задач
   */
  async loadTasksContent(container) {
    try {
      const tasks = window.focus2Data?.tasks || [];
      container.innerHTML = this.renderTasksList(tasks);
      
      // Прив'язуємо обробники подій до фільтрів задач після рендерингу
      setTimeout(() => {
        if (window.focus2Components?.filters) {
          window.focus2Components.filters.attachFilterEventHandlers();
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ Помилка завантаження контенту задач:', error);
      container.innerHTML = '<div class="text-center p-8 text-red-400">Помилка завантаження задач</div>';
    }
  }
  
  /**
   * Показ деталей клиента
   */
  showClientDetails(clientCode) {
    const container = document.getElementById('tasks-tab');
    if (container) {
      container.innerHTML = this.renderClientDetails(clientCode);
    }
  }
  
  /**
   * Закрытие деталей клиента
   */
  closeClientDetails() {
    const container = document.getElementById('tasks-tab');
    if (container) {
      // Возвращаемся к списку клиентов
      this.loadClientsContent(container);
    }
  }
  
  /**
   * Загрузка контента клиентов
   */
  async loadClientsContent(container) {
    try {
      const clients = window.focus2Data?.clients || [];
      container.innerHTML = this.renderClientsList(clients);
    } catch (error) {
      console.error('❌ Помилка завантаження контенту клієнтів:', error);
      container.innerHTML = '<div class="text-center p-8 text-red-400">Помилка завантаження клієнтів</div>';
    }
  }
  
  /**
   * Генерация отчета по задаче
   */
  async generateTaskReport(taskId) {
    try {
      console.log('📊 Генерація звіту для задачі:', taskId);
      console.log('📋 Доступні дані задач:', window.focus2Data?.tasks?.length || 0);
      
      // Проверяем, что данные доступны
      if (!window.focus2Data?.tasks) {
        throw new Error('Дані задач не завантажені');
      }
      
      // Проверяем, что модуль отчетов доступен
      if (!window.focus2Components?.reports) {
        throw new Error('Модуль звітів не ініціалізовано');
      }
      
      // Показываем индикатор загрузки
      const loadingModal = document.createElement('div');
      loadingModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
      loadingModal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-white">Генерація звіту...</p>
        </div>
      `;
      document.body.appendChild(loadingModal);
      
      try {
        // Показываем отчет в модальном окне с таймаутом
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Таймаут генерації звіту')), 15000); // 15 секунд
        });
        
        const reportPromise = window.focus2Components.reports.showTaskReportModal(taskId);
        
        await Promise.race([reportPromise, timeoutPromise]);
        
      } finally {
        // Убираем индикатор загрузки
        if (loadingModal.parentNode) {
          loadingModal.remove();
        }
      }
      
    } catch (error) {
      console.error('❌ Помилка генерації звіту:', error);
      
      // Показываем более информативное сообщение об ошибке
      let errorMessage = 'Помилка генерації звіту';
      if (error.message.includes('Таймаут')) {
        errorMessage = 'Звіт генерується занадто довго. Спробуйте пізніше або створіть нову задачу.';
      } else if (error.message.includes('не ініціалізовано')) {
        errorMessage = 'Модуль звітів не готовий. Перезавантажте сторінку.';
      } else {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  }
  
  /**
   * Анализ клиента
   */
  async analyzeClient(clientCode) {
    try {
      const analysis = await window.focus2Components?.clientAnalyzer?.analyzeClient(clientCode);
      // Здесь можно показать детальный анализ клиента
      console.log('🔍 Аналіз клієнта:', analysis);
    } catch (error) {
      console.error('❌ Помилка аналізу клієнта:', error);
      alert(`Помилка аналізу клієнта: ${error.message}`);
    }
  }
  
  /**
   * Экспорт отчета в PDF
   */
  async exportReportToPDF() {
    try {
      await window.focus2Components?.reports?.exportToPDF();
      alert('✅ Звіт експортовано в PDF');
    } catch (error) {
      console.error('❌ Помилка експорту в PDF:', error);
      alert(`Помилка експорту: ${error.message}`);
    }
  }
  
  /**
   * Экспорт отчета в Excel
   */
  async exportReportToExcel() {
    try {
      await window.focus2Components?.reports?.exportToExcel();
      alert('✅ Звіт експортовано в Excel');
    } catch (error) {
      console.error('❌ Помилка експорту в Excel:', error);
      alert(`Помилка експорту: ${error.message}`);
    }
  }
  
  /**
   * Экспорт клиентов в Excel
   */
  async exportClientsToExcel() {
    try {
      // Здесь можно добавить экспорт клиентов
      console.log('📊 Експорт клієнтів в Excel...');
      alert('✅ Клієнтів експортовано в Excel');
    } catch (error) {
      console.error('❌ Помилка експорту клієнтів:', error);
      alert(`Помилка експорту: ${error.message}`);
    }
  }
  
  /**
   * Редактирование задачи
   */
  editTask(taskId) {
    try {
      console.log('✏️ Редагування задачі:', taskId);
      if (window.focus2Components?.taskConstructor) {
        window.focus2Components.taskConstructor.editTask(taskId);
      } else {
        throw new Error('Конструктор задач не знайдено');
      }
    } catch (error) {
      console.error('❌ Помилка редагування задачі:', error);
      alert(`Помилка редагування: ${error.message}`);
    }
  }
  
  /**
   * Архивирование задачи
   */
  archiveTask(taskId) {
    try {
      console.log('📦 Архівування задачі:', taskId);
      if (confirm('Ви впевнені, що хочете архівувати цю задачу?')) {
        if (window.focus2Components?.taskConstructor) {
          window.focus2Components.taskConstructor.archiveTask(taskId);
        } else {
          throw new Error('Конструктор задач не знайдено');
        }
      }
    } catch (error) {
      console.error('❌ Помилка архівування задачі:', error);
      alert(`Помилка архівування: ${error.message}`);
    }
  }
  
  /**
   * Рендеринг простой таблицы клиентов
   */
  renderSimpleClientsTable(clients) {
    return `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-600">
              <th class="text-left py-2 text-gray-300">Клієнт</th>
              <th class="text-left py-2 text-gray-300">Менеджер</th>
              <th class="text-left py-2 text-gray-300">Сфера</th>
              <th class="text-left py-2 text-gray-300">Сума</th>
              <th class="text-left py-2 text-gray-300">Остання дата</th>
              <th class="text-left py-2 text-gray-300">Параметри</th>
            </tr>
          </thead>
          <tbody>
            ${clients.map(client => `
              <tr class="border-b border-gray-600 hover:bg-gray-600">
                <td class="py-2 text-white">
                  <div>
                    <div class="font-medium">${client.name}</div>
                    <div class="text-gray-400 text-xs">${client.code}</div>
                  </div>
                </td>
                <td class="py-2 text-white">${client.manager || '-'}</td>
                <td class="py-2 text-white">${client.sphere || '-'}</td>
                <td class="py-2 text-white">${this.formatCurrency(client.sum || 0)}</td>
                <td class="py-2 text-white">${client.lastDate ? this.formatDate(new Date(client.lastDate)) : '-'}</td>
                <td class="py-2 text-white">
                  ${(() => {
                    const paramLabels = {
                      param1: 'Купували раніше',
                      param2: 'Не купували днів',
                      param3: 'Низька частота',
                      param4: 'Низька сума',
                      param5: 'Певні сегменти',
                      param6: 'Похожі клієнти',
                      param7: 'Беруть X'
                    };
                    
                    return client.params && Array.isArray(client.params) ? 
                      client.params.map(param => `
                        <span class="inline-block bg-blue-600 text-white px-1 py-0.5 rounded text-xs mr-1 mb-1">
                          ${paramLabels[param] || param}
                        </span>
                      `).join('') : '-';
                  })()}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  /**
   * Показ клиентов с заметками
   */
  async showClientsWithNotes(taskId) {
    try {
      console.log('📝 Показ клієнтів з нотатками для задачі:', taskId);
      
      const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
      if (!task) {
        alert('Задачу не знайдено');
        return;
      }
      
      // Загружаем clientsSnapshot
      let clientsSnapshot = [];
      if (task.hasClientsSnapshot && task.clientsSnapshotCount > 0) {
        clientsSnapshot = await window.focus2TaskConstructor.loadClientsSnapshot(taskId);
      }
      
      if (clientsSnapshot.length === 0) {
        alert('Клієнтів не знайдено для цієї задачі');
        return;
      }
      
      // Загружаем заметки
      const notes = await getFocusNotes(taskId);
      
      // Добавляем ссылки к клиентам
      const clientsWithLinks = await Promise.all(clientsSnapshot.map(async (client) => {
        const link = await getClientLink(client.code);
        return { ...client, link };
      }));
      
             // Рендерим таблицу с заметками
       const container = document.getElementById('clients-table-container');
       if (container) {
         container.innerHTML = renderClientsTableWithNotes(taskId, clientsWithLinks, notes);
         
         // Прикрепляем обработчики событий
         attachTableHandlers(taskId);
         
         // Обновляем кнопку для переключения к простой таблице
         const button = document.querySelector(`button[onclick*="showSimpleClientsTable('${taskId}')"]`);
         if (button) {
           button.onclick = () => this.showSimpleClientsTable(taskId);
           button.innerHTML = '📋 Простий перегляд';
           button.className = 'px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500';
         }
       }
    } catch (error) {
      console.error('❌ Помилка показу клієнтів з нотатками:', error);
      alert(`Помилка: ${error.message}`);
    }
  }
  
  /**
   * Переключение к простой таблице клиентов
   */
  async showSimpleClientsTable(taskId) {
    try {
      const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
      if (!task) return;
      
      let clientsSnapshot = [];
      if (task.hasClientsSnapshot && task.clientsSnapshotCount > 0) {
        clientsSnapshot = await window.focus2TaskConstructor.loadClientsSnapshot(taskId);
      }
      
      const container = document.getElementById('clients-table-container');
      if (container) {
        container.innerHTML = this.renderSimpleClientsTable(clientsSnapshot);
        
        // Обновляем кнопку для возврата к таблице с заметками
        const button = document.querySelector(`button[onclick*="showSimpleClientsTable('${taskId}')"]`);
        if (button) {
          button.onclick = () => this.showClientsWithNotes(taskId);
          button.innerHTML = '📝 З нотатками';
          button.className = 'px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500';
        }
      }
    } catch (error) {
      console.error('❌ Помилка переключення до простої таблиці:', error);
    }
  }
  
  /**
   * Экспорт клиентов в CSV
   */
  async exportClientsToCSV(taskId) {
    try {
      console.log('📊 Експорт клієнтів в CSV для задачі:', taskId);
      
      const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
      if (!task) {
        alert('Задачу не знайдено');
        return;
      }
      
      let clientsSnapshot = [];
      if (task.hasClientsSnapshot && task.clientsSnapshotCount > 0) {
        clientsSnapshot = await window.focus2TaskConstructor.loadClientsSnapshot(taskId);
      }
      
      if (clientsSnapshot.length === 0) {
        alert('Клієнтів не знайдено для експорту');
        return;
      }
      
      // Загружаем заметки
      const notes = await getFocusNotes(taskId);
      
      // Добавляем ссылки к клиентам
      const clientsWithLinks = await Promise.all(clientsSnapshot.map(async (client) => {
        const link = await getClientLink(client.code);
        return { ...client, link };
      }));
      
      // Экспортируем в CSV
      exportToCSV(clientsWithLinks, notes);
      
    } catch (error) {
      console.error('❌ Помилка експорту клієнтів:', error);
      alert(`Помилка експорту: ${error.message}`);
    }
  }

  /**
   * Асинхронная загрузка клиентов для задачи
   */
  /**
   * Завантаження даних клієнтів для задачі (повертає об'єкт з даними)
   */
  async loadTaskClientsData(taskId) {
    try {
      const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Задачу не знайдено');
      }

      let clientsSnapshot = [];
      let hasClientsSnapshot = false;
      
      if (task.hasClientsSnapshot) {
        try {
          clientsSnapshot = await window.focus2TaskConstructor.loadClientsSnapshot(taskId);
          hasClientsSnapshot = true;
        } catch (error) {
          console.error('❌ Помилка завантаження clientsSnapshot:', error);
        }
      }

      if (!hasClientsSnapshot) {
        return { clients: [], notes: {}, error: 'Задача створена без аналізу клієнтів' };
      }

      // Завантажуємо нотатки та посилання клієнтів
      const notes = await getFocusNotes(taskId);
      
      // Оптимізована загрузка ссылок - загружаем все сразу
      const allLinks = await this.loadAllClientLinks();
      
      // Объединяем данные клиентов с заметками и ссылками
      const clientsWithNotes = clientsSnapshot.map(client => ({
        ...client,
        link: allLinks[client.code] || null
      }));

      return {
        clients: clientsWithNotes,
        notes: notes,
        totalCount: clientsSnapshot.length
      };

    } catch (error) {
      console.error('❌ Помилка завантаження даних клієнтів:', error);
      return { clients: [], notes: {}, error: error.message };
    }
  }

  /**
   * Завантаження клієнтів для задачі (повертає HTML)
   */
  async loadTaskClients(taskId) {
    try {
      const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Задачу не знайдено');
      }

      let clientsSnapshot = [];
      let hasClientsSnapshot = false;
      
      if (task.hasClientsSnapshot) {
        try {
          clientsSnapshot = await window.focus2TaskConstructor.loadClientsSnapshot(taskId);
          hasClientsSnapshot = true;
        } catch (error) {
          console.error('❌ Помилка завантаження clientsSnapshot:', error);
        }
      }

      if (!hasClientsSnapshot) {
        return `
          <div class="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-yellow-400 mb-2">Увага</h3>
            <p class="text-yellow-300">Ця задача була створена без аналізу клієнтів. Для перегляду списку клієнтів створіть нову задачу або оновіть існуючу.</p>
          </div>
        `;
      }

      // Завантажуємо нотатки та посилання клієнтів
      const notes = await getFocusNotes(taskId);
      
      // Оптимізована загрузка ссылок - загружаем все сразу
      const allLinks = await this.loadAllClientLinks();
      
      // Объединяем данные клиентов с заметками и ссылками
      const clientsWithNotes = clientsSnapshot.map(client => ({
        ...client,
        link: allLinks[client.code] || null
      }));

      // Рендерим таблицу с виртуальной прокруткой для больших списков
      return this.renderOptimizedClientsTable(taskId, clientsWithNotes, notes, clientsSnapshot.length);

    } catch (error) {
      console.error('❌ Помилка завантаження клієнтів:', error);
      return `
        <div class="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-red-400 mb-2">Помилка</h3>
          <p class="text-red-300">Не вдалося завантажити клієнтів: ${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Загрузка всех ссылок на клиентов за один раз
   */
  async loadAllClientLinks() {
    try {
      const res = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
      const arr = await res.json();
      const links = {};
      arr.forEach(c => { 
        links[c['Клиент.Код']] = c['посилання']; 
      });
      return links;
    } catch (error) {
      console.error('❌ Помилка завантаження посилань на клієнтів:', error);
      return {};
    }
  }

  /**
   * Оптимизированная таблица клиентов с виртуальной прокруткой
   */
  renderOptimizedClientsTable(taskId, clients, notes, totalCount) {
    const pageSize = 50; // Показываем по 50 клиентов за раз
    const totalPages = Math.ceil(clients.length / pageSize);
    
    return `
      <div class="space-y-4">
        <!-- Переключатель вида -->
        <div class="view-toggle">
          <button class="view-toggle-btn active" data-view="table" onclick="window.focus2Components?.ui?.switchView('table')">
            📊 Таблиця
          </button>
          <button class="view-toggle-btn" data-view="cards" onclick="window.focus2Components?.ui?.switchView('cards')">
            🃏 Картки
          </button>
        </div>
        
        <div class="flex items-center justify-between">
          <span class="text-gray-300">Всього клієнтів: ${totalCount}</span>
          <div class="flex items-center space-x-2">
            <button onclick="window.focus2Components?.ui?.changeClientsPage('${taskId}', -1)" 
                    class="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">
              ←
            </button>
            <span id="clients-page-info" class="text-gray-300 text-sm">Сторінка 1 з ${totalPages}</span>
            <button onclick="window.focus2Components?.ui?.changeClientsPage('${taskId}', 1)" 
                    class="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">
              →
            </button>
          </div>
        </div>
        
        <!-- Табличный вид -->
        <div class="clients-table-container" id="clients-table-view">
          <table class="w-full text-sm bg-gray-800 rounded-lg overflow-hidden">
            <thead class="sticky top-0 bg-gray-700">
              <tr class="text-gray-300">
                <th class="px-3 py-2 text-left">Клієнт</th>
                <th class="px-3 py-2 text-left">Менеджер</th>
                <th class="px-3 py-2 text-left">Сфера</th>
                <th class="px-3 py-2 text-left">Параметри</th>
                <th class="px-3 py-2 text-left">Сума</th>
                <th class="px-3 py-2 text-left">Остання покупка</th>
                <th class="px-3 py-2 text-left">Дата комунікації</th>
                <th class="px-3 py-2 text-center">Пропозиція</th>
                <th class="px-3 py-2 text-center">Пріоритет</th>
                <th class="px-3 py-2 text-left">Коментар</th>
                <th class="px-3 py-2 text-center">Дії</th>
              </tr>
            </thead>
            <tbody id="clients-table-body">
              ${this.renderClientsPage(clients.slice(0, pageSize), notes, taskId)}
            </tbody>
          </table>
        </div>
        
        <!-- Карточный вид -->
        <div class="clients-cards-container hidden" id="clients-cards-view">
          ${this.renderClientsCards(clients.slice(0, pageSize), notes, taskId)}
        </div>
        
        <div class="hidden" id="clients-data" data-task-id="${taskId}" data-total="${clients.length}" data-page-size="${pageSize}">
          ${JSON.stringify(clients)}
        </div>
      </div>
    `;
  }

  /**
   * Рендеринг страницы клиентов
   */
  renderClientsPage(clients, notes, taskId) {
    return clients.map(client => {
      const note = notes[client.code] || {};
      const clientName = client.link ? 
        `<a href="${client.link}" target="_blank" class="text-blue-400 underline hover:text-blue-600">${client.name}</a>` : 
        client.name;
      
      // Рендеринг параметрів клієнта
      const paramLabels = {
        param1: 'Купували раніше',
        param2: 'Не купували днів',
        param3: 'Низька частота',
        param4: 'Низька сума',
        param5: 'Певні сегменти',
        param6: 'Похожі клієнти',
        param7: 'Беруть X'
      };
      
      const clientParams = client.params && Array.isArray(client.params) ? 
        client.params.map(param => paramLabels[param] || param).join(', ') : '-';
      
      // Класс приоритета
      const priorityClass = note.priority ? `priority-${note.priority}` : '';
      
      return `
        <tr class="border-b border-gray-700 hover:bg-gray-700">
          <td class="px-3 py-2 text-gray-200">
            <div>
              <div class="font-medium">${clientName}</div>
              <div class="text-gray-400 text-xs">${client.code}</div>
            </div>
          </td>
          <td class="px-3 py-2 text-gray-300">${client.manager || '-'}</td>
          <td class="px-3 py-2 text-gray-300">${client.sphere || '-'}</td>
          <td class="px-3 py-2 text-gray-300">
            <div class="text-xs">
              ${clientParams}
            </div>
          </td>
          <td class="px-3 py-2 text-green-400">${client.sum ? client.sum.toFixed(2) : '-'}</td>
          <td class="px-3 py-2 text-gray-300">${client.lastDate ? new Date(client.lastDate).toLocaleDateString('uk-UA') : '-'}</td>
          <td class="px-3 py-2">
            <input type="date" 
                   value="${note.commDate || ''}" 
                   data-cid="${client.code}" 
                   class="focus-commdate bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs">
          </td>
          <td class="px-3 py-2 text-center">
            <input type="checkbox" 
                   data-cid="${client.code}" 
                   class="focus-done" 
                   ${note.done ? 'checked' : ''}>
          </td>
          <td class="px-3 py-2 text-center">
            <select data-cid="${client.code}" 
                    class="focus-priority bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs ${priorityClass}">
              <option value="">-</option>
              <option value="low" ${note.priority === 'low' ? 'selected' : ''}>Низький</option>
              <option value="medium" ${note.priority === 'medium' ? 'selected' : ''}>Середній</option>
              <option value="high" ${note.priority === 'high' ? 'selected' : ''}>Високий</option>
              <option value="urgent" ${note.priority === 'urgent' ? 'selected' : ''}>Терміново</option>
            </select>
          </td>
          <td class="px-3 py-2">
            <input type="text" 
                   value="${note.comment || ''}" 
                   data-cid="${client.code}" 
                   class="focus-comment bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs w-full"
                   placeholder="Коментар...">
          </td>
          <td class="px-3 py-2 text-center">
            <button onclick="window.focus2Components?.ui?.showClientDetail('${client.code}', '${taskId}')" 
                    class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 transition-colors duration-200">
              Деталізація
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Смена страницы клиентов
   */
  changeClientsPage(taskId, direction) {
    const dataElement = document.getElementById('clients-data');
    if (!dataElement) return;
    
    const clients = JSON.parse(dataElement.textContent);
    const pageSize = parseInt(dataElement.dataset.pageSize);
    const currentPage = parseInt(document.getElementById('clients-page-info').textContent.match(/Сторінка (\d+)/)[1]);
    const totalPages = Math.ceil(clients.length / pageSize);
    
    let newPage = currentPage + direction;
    if (newPage < 1) newPage = 1;
    if (newPage > totalPages) newPage = totalPages;
    
    const startIndex = (newPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageClients = clients.slice(startIndex, endIndex);
    
    // Получаем заметки для клиентов
    const notes = window.focus2Components?.notes?.getFocusNotes(taskId) || {};
    
    // Обновляем таблицу
    const tbody = document.getElementById('clients-table-body');
    if (tbody) {
      tbody.innerHTML = this.renderClientsPage(pageClients, notes, taskId);
    }
    
    // Обновляем карточки
    const cardsContainer = document.getElementById('clients-cards-view');
    if (cardsContainer && !cardsContainer.classList.contains('hidden')) {
      cardsContainer.innerHTML = this.renderClientsCards(pageClients, notes, taskId);
    }
    
    // Обновляем информацию о странице
    const pageInfo = document.getElementById('clients-page-info');
    if (pageInfo) {
      pageInfo.textContent = `Сторінка ${newPage} з ${totalPages}`;
    }
    
    // Привязываем обработчики событий
    setTimeout(() => {
      if (window.focus2Components?.notes) {
        window.focus2Components.notes.attachTableHandlers();
      }
    }, 100);
  }

  /**
   * Рендеринг вкладок параметрів для клієнтів
   */
  renderParameterTabs(taskId) {
    const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
    if (!task || !task.clientsSnapshot) {
      console.log('❌ Немає задачі або clientsSnapshot для:', taskId);
      return '';
    }
    
    console.log('🔍 Аналіз параметрів для задачі:', taskId);
    console.log('  - Кількість клієнтів:', task.clientsSnapshot.length);
    
    // Аналізуємо, які параметри використовуються
    const usedParams = new Set();
    task.clientsSnapshot.forEach(client => {
      if (client.params && Array.isArray(client.params)) {
        client.params.forEach(param => usedParams.add(param));
      }
    });
    
    console.log('  - Використовувані параметри:', Array.from(usedParams));
    console.log('  - Кількість унікальних параметрів:', usedParams.size);
    
    if (usedParams.size === 0) {
      console.log('  - Немає параметрів, вкладки не показуються');
      return ''; // Якщо немає параметрів, не показуємо вкладки
    }
    
    const paramLabels = {
      param1: 'Купували раніше',
      param2: 'Не купували днів',
      param3: 'Низька частота',
      param4: 'Низька сума',
      param5: 'Певні сегменти',
      param6: 'Похожі клієнти',
      param7: 'Беруть X'
    };
    
    const tabsHTML = Array.from(usedParams).map(param => {
      const clientCount = task.clientsSnapshot.filter(client => 
        client.params && client.params.includes(param)
      ).length;
      
      return `
        <button onclick="window.focus2Components?.ui?.switchParameterTab('${taskId}', '${param}')" 
                id="param-tab-${param}" 
                class="param-tab px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                data-param="${param}">
          ${paramLabels[param] || param} (${clientCount})
        </button>
      `;
    }).join('');
    
    console.log('  - Генеруємо вкладки для параметрів:', Array.from(usedParams));
    
    return `
      <div class="mb-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-semibold text-white">Фільтр за параметрами</h3>
          <button onclick="window.focus2Components?.ui?.showAllClients('${taskId}')" 
                  id="all-clients-tab"
                  class="param-tab px-3 py-1 rounded text-sm font-medium transition-colors bg-blue-600 text-white">
            Всі клієнти (${task.clientsSnapshot.length})
          </button>
        </div>
        <div class="flex space-x-2 overflow-x-auto">
          ${tabsHTML}
        </div>
      </div>
    `;
  }
  
  /**
   * Переключение між вкладками параметрів
   */
  switchParameterTab(taskId, param) {
    console.log('🔄 Переключення на параметр:', param, 'для задачі:', taskId);
    
    // Оновлюємо активну вкладку
    document.querySelectorAll('.param-tab').forEach(tab => {
      tab.classList.remove('bg-blue-600', 'text-white');
      tab.classList.add('bg-gray-600', 'text-gray-300');
    });
    
    const activeTab = document.querySelector(`[data-param="${param}"]`);
    if (activeTab) {
      activeTab.classList.remove('bg-gray-600', 'text-gray-300');
      activeTab.classList.add('bg-blue-600', 'text-white');
    }
    
    // Фільтруємо клієнтів за параметром
    this.filterClientsByParameter(taskId, param);
  }
  
  /**
   * Показати всіх клієнтів
   */
  showAllClients(taskId) {
    console.log('🔄 Показ всіх клієнтів для задачі:', taskId);
    
    // Оновлюємо активну вкладку
    document.querySelectorAll('.param-tab').forEach(tab => {
      tab.classList.remove('bg-blue-600', 'text-white');
      tab.classList.add('bg-gray-600', 'text-gray-300');
    });
    
    const allClientsTab = document.getElementById('all-clients-tab');
    if (allClientsTab) {
      allClientsTab.classList.remove('bg-gray-600', 'text-gray-300');
      allClientsTab.classList.add('bg-blue-600', 'text-white');
    }
    
    // Показуємо всіх клієнтів
    this.filterClientsByParameter(taskId, null);
  }
  
  /**
   * Фільтрація клієнтів за параметром
   */
  filterClientsByParameter(taskId, param) {
    const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
    if (!task || !task.clientsSnapshot) {
      return;
    }
    
    let filteredClients;
    if (param) {
      filteredClients = task.clientsSnapshot.filter(client => 
        client.params && client.params.includes(param)
      );
    } else {
      filteredClients = task.clientsSnapshot;
    }
    
    console.log(`📊 Фільтрація клієнтів: ${filteredClients.length} з ${task.clientsSnapshot.length} (параметр: ${param || 'всі'})`);
    
    // Оновлюємо таблицю клієнтів
    const clientsContainer = document.getElementById('clients-container');
    if (clientsContainer) {
      const tableContent = this.renderOptimizedClientsTable(taskId, filteredClients, {}, filteredClients.length);
      clientsContainer.innerHTML = tableContent;
      
      // Прикрепляем обработчики событий для таблицы с заметками
      attachTableHandlers(taskId);
    }
  }
  
  /**
   * Рендеринг фильтров для клиентов задачи
   */
  renderClientFilters(taskId) {
    if (!window.focus2Components?.filters) {
      return '';
    }
    
    // Используем данные из Firebase если они есть
    let departmentsCount = 0;
    let managersCount = 0;
    let departmentsOptions = '';
    let managersOptions = '';
    
    if (window.focus2Components.filters.departmentsData && window.focus2Components.filters.departmentsData.length > 0) {
      departmentsCount = window.focus2Components.filters.departmentsData.length;
      departmentsOptions = window.focus2Components.filters.departmentsData
        .map(dept => `<option value="${dept.id}">${dept.name || dept.id}</option>`)
        .join('');
    } else {
      departmentsCount = window.focus2Components.filters.availableFilters.departments.length;
      departmentsOptions = window.focus2Components.filters.availableFilters.departments.length > 0 
        ? window.focus2Components.filters.availableFilters.departments.map(dept => 
            `<option value="${dept}">${dept}</option>`
          ).join('')
        : '<option value="" disabled>Немає даних</option>';
    }
    
    if (window.focus2Components.filters.managersData && window.focus2Components.filters.managersData.length > 0) {
      managersCount = window.focus2Components.filters.managersData.length;
      managersOptions = window.focus2Components.filters.managersData
        .map(manager => `<option value="${manager.id}">${manager.name || manager.id}</option>`)
        .join('');
    } else {
      managersCount = window.focus2Components.filters.availableFilters.managers.length;
      managersOptions = window.focus2Components.filters.availableFilters.managers.length > 0 
        ? window.focus2Components.filters.availableFilters.managers.map(manager => 
            `<option value="${manager}">${manager}</option>`
          ).join('')
        : '<option value="" disabled>Немає даних</option>';
    }
    
    const filtersHTML = `
      <div class="mb-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-semibold text-white">Фільтри клієнтів</h3>
          <div class="flex space-x-2">
            <button onclick="window.focus2Components?.filters?.loadAvailableFilters()" 
                    class="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-500">
              Оновити
            </button>
            <button onclick="window.focus2Components?.ui?.applyClientFilters('${taskId}')" 
                    class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500">
              Застосувати
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- Отдел -->
          <div>
            <label class="block text-gray-300 text-xs mb-1">Відділ (${departmentsCount})</label>
            <select id="client-department-filter" class="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm">
              <option value="">Всі відділи</option>
              ${departmentsOptions}
            </select>
          </div>
          
          <!-- Менеджер -->
          <div>
            <label class="block text-gray-300 text-xs mb-1">Менеджер (${managersCount})</label>
            <select id="client-manager-filter" class="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm">
              <option value="">Всі менеджери</option>
              ${managersOptions}
            </select>
          </div>
          
          <!-- Поиск -->
          <div>
            <label class="block text-gray-300 text-xs mb-1">Пошук клієнта</label>
            <input type="text" id="client-search-filter" 
                   class="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm" 
                   placeholder="Назва клієнта...">
          </div>
        </div>
      </div>
    `;
    
    // Прив'язуємо обробники подій після рендерингу
    setTimeout(() => {
      this.attachClientFilterHandlers(taskId);
    }, 100);
    
    return filtersHTML;
  }
  
  /**
   * Прив'язування обробників подій до фільтрів клієнтів
   */
  attachClientFilterHandlers(taskId) {
    try {
      const filters = [
        'client-department-filter',
        'client-manager-filter',
        'client-search-filter'
      ];
      
      filters.forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
          // Видаляємо старі обробники
          filterElement.removeEventListener('change', this.handleClientFilterChange);
          filterElement.removeEventListener('input', this.handleClientFilterChange);
          
          // Додаємо нові обробники
          filterElement.addEventListener('change', () => this.handleClientFilterChange(taskId));
          filterElement.addEventListener('input', () => this.handleClientFilterChange(taskId));
        }
      });
      
    } catch (error) {
      console.error('❌ Помилка прив\'язування обробників фільтрів клієнтів:', error);
    }
  }
  
  /**
   * Обробник зміни фільтрів клієнтів
   */
  handleClientFilterChange(taskId) {
    try {
      // Получаем значения фильтров
      const departmentFilter = document.getElementById('client-department-filter');
      const managerFilter = document.getElementById('client-manager-filter');
      const searchFilter = document.getElementById('client-search-filter');
      
      // Перевіряємо, чи змінився відділ
      if (departmentFilter && window.focus2Components?.filters) {
        const departmentValue = departmentFilter.value;
        window.focus2Components.filters.setFilter('department', departmentValue);
        
        // Оновлюємо список менеджерів при зміні відділу
        window.focus2Components.filters.updateManagersFilter();
      }
      
      if (managerFilter && window.focus2Components?.filters) {
        const managerValue = managerFilter.value;
        window.focus2Components.filters.setFilter('manager', managerValue);
      }
      
      if (searchFilter && window.focus2Components?.filters) {
        const searchValue = searchFilter.value;
        window.focus2Components.filters.setFilter('search', searchValue);
      }
      
      // Застосовуємо фільтри автоматично
      this.applyClientFilters(taskId);
      
    } catch (error) {
      console.error('❌ Помилка обробки зміни фільтра клієнтів:', error);
    }
  }
  
  /**
   * Применение фильтров к клиентам
   */
  async applyClientFilters(taskId) {
    try {
      // Получаем значения фильтров
      const departmentFilter = document.getElementById('client-department-filter')?.value || '';
      const managerFilter = document.getElementById('client-manager-filter')?.value || '';
      const searchFilter = document.getElementById('client-search-filter')?.value || '';
      
      // Устанавливаем фильтры
      if (window.focus2Components?.filters) {
        window.focus2Components.filters.setFilter('department', departmentFilter);
        window.focus2Components.filters.setFilter('manager', managerFilter);
        window.focus2Components.filters.setFilter('search', searchFilter);
      }
      
      // Используем уже загруженные данные из window.focus2Data
      const task = window.focus2Data?.tasks?.find(t => t.id === taskId);
      if (!task || !task.clientsSnapshot) {
        return;
      }
      
      // Загружаем заметки (если еще не загружены)
      const notes = await getFocusNotes(taskId);
      
      // Загружаем ссылки (если еще не загружены)
      const allLinks = await this.loadAllClientLinks();
      
      // Объединяем данные клиентов с заметками и ссылками
      const clientsWithNotes = task.clientsSnapshot.map(client => ({
        ...client,
        link: allLinks[client.code] || null
      }));
      
      // Применяем фильтры
      if (window.focus2Components?.filters && clientsWithNotes.length > 0) {
        const filteredClients = window.focus2Components.filters.applyClientFilters(
          clientsWithNotes, 
          notes
        );
        
        // Обновляем отображение клиентов
        const clientsContainer = document.getElementById('clients-container');
        if (clientsContainer) {
          const filteredContent = this.renderOptimizedClientsTable(
            taskId, 
            filteredClients, 
            notes, 
            filteredClients.length
          );
          clientsContainer.innerHTML = filteredContent;
          
          // Прикрепляем обработчики
          if (typeof attachTableHandlers === 'function') {
            attachTableHandlers(taskId);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Помилка застосування фільтрів:', error);
    }
  }

  /**
   * Функция для переключения сворачиваемых секций
   */
  toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    if (section && icon) {
      const isHidden = section.classList.contains('hidden');
      
      if (isHidden) {
        section.classList.remove('hidden');
        icon.classList.add('rotate-180');
      } else {
        section.classList.add('hidden');
        icon.classList.remove('rotate-180');
      }
    }
  }
  
  /**
   * Застосування фільтрів до задач
   */
  async applyTaskFilters() {
    try {
      console.log('🎯 applyTaskFilters викликано');
      
      // Отримуємо значення фільтрів
      const statusFilter = document.getElementById('task-status-filter')?.value || '';
      const periodFilter = document.getElementById('task-period-filter')?.value || '';
      const searchFilter = document.getElementById('task-search-filter')?.value || '';
      
      console.log('🔍 Значення фільтрів:', { statusFilter, periodFilter, searchFilter });
      
      // Встановлюємо фільтри
      if (window.focus2Components?.filters) {
        window.focus2Components.filters.setFilter('status', statusFilter);
        window.focus2Components.filters.setFilter('period', periodFilter);
        window.focus2Components.filters.setFilter('search', searchFilter);
      }
      
      // Отримуємо всі задачі
      const tasks = window.focus2Data?.tasks || [];
      console.log('📋 Всього задач:', tasks.length);
      
      // Застосовуємо фільтри
      if (window.focus2Components?.filters) {
        const filteredTasks = window.focus2Components.filters.applyFilters(tasks);
        console.log('✅ Відфільтровано задач:', filteredTasks.length);
        
        // Оновлюємо відображення задач
        const tasksContainer = document.getElementById('tasks-tab');
        if (tasksContainer) {
          const tasksContent = this.renderTasksList(filteredTasks);
          tasksContainer.innerHTML = tasksContent;
          console.log('✅ Список задач оновлено');
          
          // Прив'язуємо обробники подій до фільтрів задач після оновлення
          setTimeout(() => {
            if (window.focus2Components?.filters) {
              window.focus2Components.filters.attachFilterEventHandlers();
            }
          }, 100);
        } else {
          console.warn('⚠️ Контейнер задач не знайдено');
        }
      }
      
    } catch (error) {
      console.error('❌ Помилка застосування фільтрів задач:', error);
    }
  }

  /**
   * Показ деталей клиента
   */
  async showClientDetail(clientCode, taskId) {
    try {
      console.log('👤 Показ деталей клієнта:', clientCode);
      
      // Получаем данные клиента
      const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
      const clientInfo = clientManagerDirectory[clientCode];
      const salesData = window.focus2Data?.salesData || [];
      
      // Фильтруем продажи клиента
      const clientSales = salesData.filter(sale => sale['Клиент.Код'] === clientCode);
      
      // Получаем задачу для анализа фокусных продуктов
      const tasks = window.focus2Data?.tasks || [];
      const task = tasks.find(t => t.id === taskId);
      const focusProducts = new Set(task?.products || []);
      
      // Получаем период действия задачи
      const taskPeriodStart = task?.periodFrom ? new Date(task.periodFrom) : null;
      const taskPeriodEnd = task?.periodTo ? new Date(task.periodTo) : null;
      
      // Анализируем продажи по фокусным продуктам В ПЕРИОД ДЕЙСТВИЯ ЗАДАЧИ
      const focusSalesInPeriod = clientSales.filter(sale => {
        const isFocusProduct = focusProducts.has(sale['Номенклатура.Код']);
        const saleDate = new Date(sale['Дата']);
        const isInTaskPeriod = (!taskPeriodStart || saleDate >= taskPeriodStart) && 
                              (!taskPeriodEnd || saleDate <= taskPeriodEnd);
        return isFocusProduct && isInTaskPeriod;
      });
      
      // Анализируем ВСЕ продажи фокусных продуктов за ВЕСЬ период (для истории)
      const allFocusSales = clientSales.filter(sale => focusProducts.has(sale['Номенклатура.Код']));
      
      const otherSales = clientSales.filter(sale => !focusProducts.has(sale['Номенклатура.Код']));
      
      // Рассчитываем статистику
      const totalRevenue = clientSales.reduce((sum, sale) => sum + (sale['Выручка'] || 0), 0);
      const focusRevenueInPeriod = focusSalesInPeriod.reduce((sum, sale) => sum + (sale['Выручка'] || 0), 0);
      const allFocusRevenue = allFocusSales.reduce((sum, sale) => sum + (sale['Выручка'] || 0), 0);
      const otherRevenue = otherSales.reduce((sum, sale) => sum + (sale['Выручка'] || 0), 0);
      
      // Получаем последние продажи
      const lastSales = clientSales
        .sort((a, b) => new Date(b['Дата']) - new Date(a['Дата']))
        .slice(0, 10);
      
      console.log('🔍 Аналіз клієнта:', {
        clientCode,
        totalSales: clientSales.length,
        focusSalesInPeriod: focusSalesInPeriod.length,
        allFocusSales: allFocusSales.length,
        otherSales: otherSales.length,
        focusProducts: focusProducts.size,
        taskPeriod: taskPeriodStart && taskPeriodEnd ? `${taskPeriodStart.toLocaleDateString()} - ${taskPeriodEnd.toLocaleDateString()}` : 'Не встановлено'
      });
      
      // Создаем модальное окно
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
      modal.innerHTML = `
        <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
          <button id="close-client-detail" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
          
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-white mb-2">${clientInfo?.name || clientCode}</h2>
            <p class="text-gray-400">Код: ${clientCode}</p>
            ${clientInfo?.manager ? `<p class="text-gray-400">Менеджер: ${clientInfo.manager}</p>` : ''}
            ${clientInfo?.department ? `<p class="text-gray-400">Відділ: ${clientInfo.department}</p>` : ''}
            ${taskPeriodStart && taskPeriodEnd ? `<p class="text-gray-400">Період задачі: ${taskPeriodStart.toLocaleDateString()} - ${taskPeriodEnd.toLocaleDateString()}</p>` : ''}
          </div>
          
          <!-- Статистика -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-gray-400 text-sm mb-1">Загальна виручка</h3>
              <p class="text-2xl font-bold text-white">${this.formatCurrency(totalRevenue)}</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-gray-400 text-sm mb-1">Фокусні в періоді</h3>
              <p class="text-2xl font-bold text-blue-400">${this.formatCurrency(focusRevenueInPeriod)}</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-gray-400 text-sm mb-1">Всі фокусні</h3>
              <p class="text-2xl font-bold text-green-400">${this.formatCurrency(allFocusRevenue)}</p>
            </div>
          </div>
          
          <!-- Вкладки -->
          <div class="flex gap-2 mb-6">
            <button class="client-tab-btn active px-4 py-2 bg-blue-600 text-white rounded" data-tab="focus">Фокусні продукти</button>
            <button class="client-tab-btn px-4 py-2 bg-gray-700 text-white rounded" data-tab="all">Всі продажі</button>
            <button class="client-tab-btn px-4 py-2 bg-gray-700 text-white rounded" data-tab="history">Історія фокусні</button>
          </div>
          
          <!-- Контент вкладок -->
          <div id="client-detail-content">
            <!-- Контент будет загружен динамически -->
          </div>
          
          <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
            <button id="export-client-csv" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500">
              📊 Експорт CSV
            </button>
            <button id="close-client-detail-btn" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">
              Закрити
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Обработчики событий
      const closeModal = () => modal.remove();
      const closeBtn = modal.querySelector('#close-client-detail');
      const closeDetailBtn = modal.querySelector('#close-client-detail-btn');
      const exportBtn = modal.querySelector('#export-client-csv');
      
      closeBtn.onclick = closeModal;
      closeDetailBtn.onclick = closeModal;
      exportBtn.onclick = () => this.exportClientToCSV(clientCode, clientSales);
      
      // Обработчики вкладок
      const tabBtns = modal.querySelectorAll('.client-tab-btn');
      const contentDiv = modal.querySelector('#client-detail-content');
      
      const switchTab = (tabName) => {
        // Обновляем активную вкладку
        tabBtns.forEach(btn => {
          btn.classList.toggle('bg-blue-600', btn.dataset.tab === tabName);
          btn.classList.toggle('bg-gray-700', btn.dataset.tab !== tabName);
        });
        
        // Загружаем контент вкладки
        contentDiv.innerHTML = this.renderClientDetailTab(tabName, {
          clientCode,
          clientInfo,
          focusSales: focusSalesInPeriod, // Для вкладки "Фокусні продукти" - только в периоде
          allFocusSales, // Для вкладки "Історія фокусні" - все фокусные продажи
          otherSales,
          lastSales,
          totalRevenue,
          focusRevenue: focusRevenueInPeriod, // Для вкладки "Фокусні продукти"
          allFocusRevenue, // Для вкладки "Історія фокусні"
          otherRevenue,
          clientSales: focusSalesInPeriod.concat(otherSales), // Добавляем продажи в периоде
          taskPeriodStart,
          taskPeriodEnd
        });
        
        console.log('✅ Модальне вікно деталей клієнта створено з даними:', {
          focusSalesInPeriod: focusSalesInPeriod.length,
          allFocusSales: allFocusSales.length,
          otherSales: otherSales.length,
          totalSales: focusSalesInPeriod.length + otherSales.length
        });
      };
      
      tabBtns.forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
      });
      
      // Показываем первую вкладку
      switchTab('focus');
      
      // Делаем функцию toggleOrderDetails глобальной
      window.toggleOrderDetails = (orderId) => this.toggleOrderDetails(orderId);
      
      // Делаем функцию toggleSelectedNomenclature глобальной
      window.toggleSelectedNomenclature = () => {
        const detailsElement = document.getElementById('selectedNomenclatureDetails');
        if (detailsElement) {
          const isHidden = detailsElement.classList.contains('hidden');
          if (isHidden) {
            detailsElement.classList.remove('hidden');
          } else {
            detailsElement.classList.add('hidden');
          }
        }
      };
      
      // Делаем функцию toggleOrderDetails для всіх продажів глобальною
      window.toggleAllOrderDetails = (orderId) => {
        const detailsElement = document.getElementById(orderId);
        const iconElement = document.getElementById(orderId.replace('-details', '-icon'));
        if (detailsElement && iconElement) {
          const isHidden = detailsElement.classList.contains('hidden');
          if (isHidden) {
            detailsElement.classList.remove('hidden');
            iconElement.classList.add('rotate-180');
          } else {
            detailsElement.classList.add('hidden');
            iconElement.classList.remove('rotate-180');
          }
        }
      };
      
      console.log('✅ Модальне вікно деталей клієнта відкрито');
      
    } catch (error) {
      console.error('❌ Помилка показу деталей клієнта:', error);
      alert('Помилка показу деталей клієнта: ' + error.message);
    }
  }
  
  /**
   * Рендеринг контента вкладки деталей клиента
   */
  renderClientDetailTab(tabName, data) {
    switch (tabName) {
      case 'focus':
        return this.renderClientFocusTab(data);
      case 'all':
        return this.renderClientAllSalesTab(data);
      case 'history':
        return this.renderClientHistoryTab(data);
      default:
        return '<div class="text-gray-400">Вкладка не знайдена</div>';
    }
  }
  
  /**
   * Рендеринг вкладки фокусных продуктов
   */
  renderClientFocusTab(data) {
    const { focusSales, focusRevenue, totalRevenue, taskPeriodStart, taskPeriodEnd } = data;
    const focusPercentage = totalRevenue > 0 ? (focusRevenue / totalRevenue * 100).toFixed(1) : 0;
    
    const periodInfo = taskPeriodStart && taskPeriodEnd 
      ? `за період ${taskPeriodStart.toLocaleDateString()} - ${taskPeriodEnd.toLocaleDateString()}`
      : 'за весь період (період задачі не встановлено)';
    
    return `
      <div class="space-y-4">
        <div class="bg-blue-900 bg-opacity-20 border border-blue-500 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-blue-400 mb-2">Продажі фокусних продуктів ${periodInfo}</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p class="text-gray-400 text-sm">Виручка по фокусу</p>
              <p class="text-xl font-bold text-blue-400">${this.formatCurrency(focusRevenue)}</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm">Частка від загальної</p>
              <p class="text-xl font-bold text-blue-400">${focusPercentage}%</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm">Кількість продажів</p>
              <p class="text-xl font-bold text-blue-400">${focusSales.length}</p>
            </div>
          </div>
        </div>
        
        ${focusSales.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-800">
                  <th class="text-left p-3 text-gray-300">Дата</th>
                  <th class="text-left p-3 text-gray-300">Продукт</th>
                  <th class="text-left p-3 text-gray-300">Кількість</th>
                  <th class="text-left p-3 text-gray-300">Виручка</th>
                </tr>
              </thead>
              <tbody>
                ${focusSales.map(sale => `
                  <tr class="border-b border-gray-700">
                    <td class="p-3 text-white">${this.formatDate(sale['Дата'])}</td>
                    <td class="p-3 text-white">${this.getNomenclatureName(sale['Номенклатура.Код'])}</td>
                    <td class="p-3 text-white">${sale['Количество'] || 0}</td>
                    <td class="p-3 text-white">${this.formatCurrency(sale['Выручка'] || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="bg-gray-800 rounded-lg p-4 text-center">
            <p class="text-gray-400">Немає продажів фокусних продуктів ${periodInfo}</p>
          </div>
        `}
      </div>
    `;
  }
  
  /**
   * Рендеринг вкладки всех продаж
   */
  renderClientAllSalesTab(data) {
    // Получаем все продажи клиента
    const clientSales = data.clientSales || [];
    const totalRevenue = data.totalRevenue || 0;
    
    console.log('📊 Рендеринг всіх продажів:', {
      clientSalesCount: clientSales.length,
      totalRevenue: totalRevenue,
      sampleSale: clientSales[0]
    });
    
    if (!clientSales || clientSales.length === 0) {
      return `
        <div class="space-y-4">
          <div class="bg-gray-800 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-2">Всі продажі клієнта</h3>
            <p class="text-gray-400">Дані про продажі відсутні</p>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="space-y-4">
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-2">Всі продажі клієнта</h3>
          <p class="text-gray-400">Загальна виручка: <span class="text-white font-bold">${this.formatCurrency(totalRevenue)}</span></p>
        </div>
        
        <div class="space-y-3">
          ${this.groupSalesByDate(clientSales).map((group, groupIndex) => `
            <div class="bg-gray-800 rounded-lg p-4">
              <button onclick="toggleAllOrderDetails('all-order-${groupIndex}-details')" 
                      class="flex items-center justify-between w-full mb-3 hover:bg-gray-700 p-2 rounded transition-colors">
                <div class="flex items-center space-x-4">
                  <span class="text-lg font-semibold text-white">${this.formatDate(group.date)}</span>
                  <span class="text-sm text-gray-400">Замовлення #${groupIndex + 1}</span>
                  <span class="text-sm text-blue-400">${group.sales.length} позицій</span>
                  <span class="text-sm text-green-400">${this.formatCurrency(group.totalRevenue)}</span>
                </div>
                <svg id="all-order-${groupIndex}-icon" class="w-5 h-5 text-gray-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div id="all-order-${groupIndex}-details" class="hidden space-y-2">
                ${group.sales.map((sale, saleIndex) => {
                  const isFocus = window.focus2Data?.tasks?.some(task => 
                    task.products?.includes(sale['Номенклатура.Код'])
                  );
                  return `
                    <div class="bg-gray-700 rounded p-3 flex items-center justify-between">
                      <div class="flex-1">
                        <p class="text-white font-medium">${this.getNomenclatureName(sale['Номенклатура.Код'])}</p>
                        <p class="text-gray-400 text-sm">${this.formatDate(sale['Дата'])}</p>
                      </div>
                      <div class="flex items-center space-x-4">
                        <div>
                          <p class="text-gray-400 text-sm">Кількість</p>
                          <p class="text-white font-medium">${sale['Количество'] || sale['Кількість'] || 1}</p>
                        </div>
                        <div>
                          <p class="text-gray-400 text-sm">Виручка</p>
                          <p class="text-white font-medium">${this.formatCurrency(sale['Выручка'] || 0)}</p>
                        </div>
                        <div>
                          <span class="px-2 py-1 rounded text-xs ${isFocus ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}">
                            ${isFocus ? 'Фокус' : 'Інший'}
                          </span>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг вкладки истории
   */
  renderClientHistoryTab(data) {
    const { allFocusSales = [], allFocusRevenue = 0 } = data;
    
    if (!allFocusSales || allFocusSales.length === 0) {
      return `
        <div class="space-y-4">
          <div class="bg-gray-800 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-2">Історія фокусних продажів</h3>
            <p class="text-gray-400">Немає продажів фокусних продуктів за весь період</p>
          </div>
        </div>
      `;
    }
    
    // Сортируем по дате (новые сначала)
    const sortedSales = allFocusSales.sort((a, b) => new Date(b['Дата']) - new Date(a['Дата']));
    
    return `
      <div class="space-y-4">
        <div class="bg-green-900 bg-opacity-20 border border-green-500 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-green-400 mb-2">Історія фокусних продажів за весь період</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-gray-400 text-sm">Загальна виручка фокусних</p>
              <p class="text-xl font-bold text-green-400">${this.formatCurrency(allFocusRevenue)}</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm">Кількість продажів</p>
              <p class="text-xl font-bold text-green-400">${allFocusSales.length}</p>
            </div>
          </div>
        </div>
        
        <div class="space-y-3">
          ${this.groupSalesByDate(sortedSales).map((group, groupIndex) => `
            <div class="bg-gray-800 rounded-lg p-4">
              <button onclick="toggleOrderDetails('history-order-${groupIndex}')" 
                      class="flex items-center justify-between w-full mb-3 hover:bg-gray-700 p-2 rounded transition-colors">
                <div class="flex items-center space-x-4">
                  <span class="text-lg font-semibold text-white">${this.formatDate(group.date)}</span>
                  <span class="text-sm text-gray-400">Замовлення #${groupIndex + 1}</span>
                  <span class="text-sm text-green-400">${group.sales.length} позицій</span>
                  <span class="text-sm text-green-400">${this.formatCurrency(group.totalRevenue)}</span>
                </div>
                <svg id="history-order-${groupIndex}-icon" class="w-5 h-5 text-gray-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div id="history-order-${groupIndex}-details" class="hidden space-y-2">
                ${group.sales.map((sale, saleIndex) => `
                  <div class="bg-gray-700 rounded p-3">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p class="text-gray-400 text-sm">Продукт</p>
                        <p class="text-white font-medium">${this.getNomenclatureName(sale['Номенклатура.Код'])}</p>
                      </div>
                      <div>
                        <p class="text-gray-400 text-sm">Кількість</p>
                        <p class="text-white font-medium">${sale['Количество'] || sale['Кількість'] || 1}</p>
                      </div>
                      <div>
                        <p class="text-gray-400 text-sm">Виручка</p>
                        <p class="text-white font-medium">${this.formatCurrency(sale['Выручка'] || 0)}</p>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="mt-3 pt-3 border-t border-gray-700">
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Загальна виручка за день:</span>
                  <span class="text-white font-bold">${this.formatCurrency(group.totalRevenue)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  /**
   * Переключение деталей замовлення
   */
  toggleOrderDetails(orderId) {
    const detailsElement = document.getElementById(`${orderId}-details`);
    const iconElement = document.getElementById(`${orderId}-icon`);
    
    if (detailsElement && iconElement) {
      const isHidden = detailsElement.classList.contains('hidden');
      
      if (isHidden) {
        detailsElement.classList.remove('hidden');
        iconElement.style.transform = 'rotate(180deg)';
      } else {
        detailsElement.classList.add('hidden');
        iconElement.style.transform = 'rotate(0deg)';
      }
    }
  }
  
  /**
   * Экспорт данных клиента в CSV
   */
  exportClientToCSV(clientCode, sales) {
    try {
      const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
      const clientInfo = clientManagerDirectory[clientCode];
      
      // Создаем CSV данные
      let csvContent = 'data:text/csv;charset=utf-8,';
      
      // Заголовок
      csvContent += `Деталі клієнта: ${clientInfo?.name || clientCode}\n`;
      csvContent += `Код: ${clientCode}\n`;
      csvContent += `Менеджер: ${clientInfo?.manager || 'Не вказано'}\n`;
      csvContent += `Відділ: ${clientInfo?.department || 'Не вказано'}\n\n`;
      
      // Заголовки таблицы
      csvContent += 'Дата,Продукт,Кількість,Виручка,Тип\n';
      
      // Данные продаж
      sales.forEach(sale => {
                          const isFocus = window.focus2Data?.tasks?.some(task => 
                    task.products?.includes(sale['Номенклатура.Код'])
                  );
        const type = isFocus ? 'Фокус' : 'Інший';
        
        csvContent += `${this.formatDate(sale['Дата'])},${this.getNomenclatureName(sale['Номенклатура'])},${sale['Количество'] || 0},${sale['Выручка'] || 0},${type}\n`;
      });
      
      // Создаем ссылку для скачивания
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `client_${clientCode}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Дані клієнта експортовано в CSV');
      
    } catch (error) {
      console.error('❌ Помилка експорту даних клієнта:', error);
      alert('Помилка експорту даних клієнта');
    }
  }

  /**
   * Рендеринг карточек клиентов
   */
  renderClientsCards(clients, notes, taskId) {
    return clients.map(client => {
      const note = notes[client.code] || {};
      const clientName = client.link ? 
        `<a href="${client.link}" target="_blank" class="text-blue-400 underline hover:text-blue-600">${client.name}</a>` : 
        client.name;
      
      // Рендеринг параметрів клієнта
      const paramLabels = {
        param1: 'Купували раніше',
        param2: 'Не купували днів',
        param3: 'Низька частота',
        param4: 'Низька сума',
        param5: 'Певні сегменти',
        param6: 'Похожі клієнти',
        param7: 'Беруть X'
      };
      
      const clientParams = client.params && Array.isArray(client.params) ? 
        client.params.map(param => paramLabels[param] || param).join(', ') : '-';
      
      return `
        <div class="client-card">
          <div class="client-card-header">
            <div>
              <div class="client-name">${clientName}</div>
              <div class="client-code">${client.code}</div>
            </div>
            <div class="client-actions">
              <button onclick="window.focus2Components?.ui?.showClientDetail('${client.code}', '${taskId}')" 
                      class="client-action-btn primary">
                Деталі
              </button>
            </div>
          </div>
          
          <div class="client-details">
            <div class="client-detail-item">
              <div class="client-detail-label">Менеджер</div>
              <div class="client-detail-value">${client.manager || '-'}</div>
            </div>
            <div class="client-detail-item">
              <div class="client-detail-label">Сфера</div>
              <div class="client-detail-value">${client.sphere || '-'}</div>
            </div>
            <div class="client-detail-item">
              <div class="client-detail-label">Параметри</div>
              <div class="client-detail-value">${clientParams}</div>
            </div>
            <div class="client-detail-item">
              <div class="client-detail-label">Сума</div>
              <div class="client-detail-value">${client.sum ? client.sum.toFixed(2) : '-'}</div>
            </div>
            <div class="client-detail-item">
              <div class="client-detail-label">Остання покупка</div>
              <div class="client-detail-value">${client.lastDate ? new Date(client.lastDate).toLocaleDateString('uk-UA') : '-'}</div>
            </div>
            <div class="client-detail-item">
              <div class="client-detail-label">Пріоритет</div>
              <div class="client-detail-value">
                <select data-cid="${client.code}" 
                        class="focus-priority bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs">
                  <option value="">-</option>
                  <option value="low" ${note.priority === 'low' ? 'selected' : ''}>Низький</option>
                  <option value="medium" ${note.priority === 'medium' ? 'selected' : ''}>Середній</option>
                  <option value="high" ${note.priority === 'high' ? 'selected' : ''}>Високий</option>
                  <option value="urgent" ${note.priority === 'urgent' ? 'selected' : ''}>Терміново</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="client-details">
            <div class="client-detail-item">
              <div class="client-detail-label">Дата комунікації</div>
              <div class="client-detail-value">
                <input type="date" 
                       value="${note.commDate || ''}" 
                       data-cid="${client.code}" 
                       class="focus-commdate bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs">
              </div>
            </div>
            <div class="client-detail-item">
              <div class="client-detail-label">Пропозиція</div>
              <div class="client-detail-value">
                <input type="checkbox" 
                       data-cid="${client.code}" 
                       class="focus-done" 
                       ${note.done ? 'checked' : ''}>
              </div>
            </div>
          </div>
          
          <div class="client-detail-item">
            <div class="client-detail-label">Коментар</div>
            <div class="client-detail-value">
              <input type="text" 
                     value="${note.comment || ''}" 
                     data-cid="${client.code}" 
                     class="focus-comment bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs w-full"
                     placeholder="Коментар...">
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Переключение между видами таблицы
   */
  switchView(viewType) {
    const tableView = document.getElementById('clients-table-view');
    const cardsView = document.getElementById('clients-cards-view');
    const tableBtn = document.querySelector('[data-view="table"]');
    const cardsBtn = document.querySelector('[data-view="cards"]');
    
    if (viewType === 'table') {
      tableView.classList.remove('hidden');
      cardsView.classList.add('hidden');
      tableBtn.classList.add('active');
      cardsBtn.classList.remove('active');
    } else {
      tableView.classList.add('hidden');
      cardsView.classList.remove('hidden');
      tableBtn.classList.remove('active');
      cardsBtn.classList.add('active');
    }
  }
}

// Глобальная функция для переключения секций
window.toggleSection = function(sectionId) {
  const section = document.getElementById(sectionId);
  const icon = document.getElementById(`${sectionId}-icon`);
  
  if (section && icon) {
    const isHidden = section.classList.contains('hidden');
    
    if (isHidden) {
      section.classList.remove('hidden');
      icon.classList.add('rotate-180');
    } else {
      section.classList.add('hidden');
      icon.classList.remove('rotate-180');
    }
  }
};