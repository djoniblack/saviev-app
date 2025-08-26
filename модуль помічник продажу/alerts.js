// alerts.js (lightweight, без классов оформления)

// === СИСТЕМА ЛОГИРОВАНИЯ ===
const ALERTS_DEBUG_MODE = window.location.hostname === 'localhost' || 
                         window.location.search.includes('debug=true') ||
                         localStorage.getItem('alertsDebugMode') === 'true';

const ALERTS_LOG_LEVEL = ALERTS_DEBUG_MODE ? 'verbose' : 'error'; // verbose, info, warn, error

// Оптимизированная система логирования для модуля alerts
const alertsLogger = {
    verbose: (...args) => ALERTS_DEBUG_MODE && ALERTS_LOG_LEVEL === 'verbose' && console.log('[ALERTS VERBOSE]', ...args),
    info: (...args) => ['verbose', 'info'].includes(ALERTS_LOG_LEVEL) && console.log('[ALERTS INFO]', ...args),
    warn: (...args) => ['verbose', 'info', 'warn'].includes(ALERTS_LOG_LEVEL) && console.warn('[ALERTS WARN]', ...args),
    error: (...args) => console.error('[ALERTS ERROR]', ...args)
};

// Функция для включения/выключения отладки
window.toggleAlertsDebug = function() {
    const newMode = !ALERTS_DEBUG_MODE;
    localStorage.setItem('alertsDebugMode', newMode.toString());
    alertsLogger.info(`Режим отладки alerts ${newMode ? 'включен' : 'выключен'}. Перезагрузите страницу.`);
};

let masterData = [];
let clientLinks = {};
let clientNames = {}; // Справочник названий клиентов из API
let clientManagerDirectory = {}; // Полный справочник клиент-менеджер из API
let currentSignal = 'revenue-drop';
let currentManager = '';
let currentDepartment = '';
let currentPeriod = 3;
let currentSearch = '';
let currentStatus = ''; // Новый фильтр по статусам клиентов
let revenueChart, freqChart, avgCheckChart;
let isAlertsInitialized = false; // --- NEW: Прапор ініціалізації ---

// === Данные из Firebase ===
let managersData = [];
let departmentsData = [];

// === NEW: Данные для трекинга действий ===
let clientActionsData = {}; // {clientCode: {status, actions: [], lastActivity, potentialOrderDate}}
let currentUserId = null;

// === NEW: Система уведомлений ===
let notificationCheckInterval = null;
let lastNotificationCheck = new Date();

// === NEW: Система AI-рекомендаций ===
let aiRecommendations = [];
let lastRecommendationUpdate = null;

/**
 * Получение статуса клиента в алертах
 */
function getClientAlertStatus(clientCode) {
  return clientActionsData[clientCode]?.status || 'new';
}

/**
 * Отображение кнопок действий для клиента
 */
// === НОВЫЕ ФУНКЦИИ ДЛЯ UI ===

// Функция для отображения статуса клиента
function renderClientStatus(clientCode) {
  const status = getClientAlertStatus(clientCode);
  
  const statusColors = {
    'new': 'bg-red-600 text-white',
    'in_progress': 'bg-yellow-600 text-white', 
    'resolved': 'bg-green-600 text-white',
    'closed': 'bg-gray-600 text-white'
  };
  
  const statusLabels = {
    'new': '🆕 Новий',
    'in_progress': '🔄 В роботі',
    'resolved': '✅ Вирішено',
    'closed': '🗂️ Закрито'
  };
  
  return `<div class="text-xs px-2 py-1 rounded ${statusColors[status]}">${statusLabels[status]}</div>`;
}

// Функция для отображения гамбургер меню действий
function renderActionsMenu(clientCode) {
  return `
    <div class="relative">
      <button class="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center gap-1" 
              onclick="toggleActionsMenu('${clientCode}')" 
              id="actions-btn-${clientCode}">
        <span class="text-sm">Дії</span>
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
        </svg>
      </button>
      <div class="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-40 z-50 hidden" 
           id="actions-menu-${clientCode}">
        <button class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b" 
                onclick="quickAction('${clientCode}', 'call')">
          📞 Дзвінок
        </button>
        <button class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b" 
                onclick="quickAction('${clientCode}', 'meeting')">
          🤝 Зустріч
        </button>
        <button class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b" 
                onclick="quickAction('${clientCode}', 'email')">
          📧 Email
        </button>
        <button class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b" 
                onclick="quickAction('${clientCode}', 'proposal')">
          📄 Комерційна пропозиція
        </button>
        <button class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2 rounded-b-lg" 
                onclick="changeClientStatus('${clientCode}')">
          🔄 Змінити статус
        </button>
      </div>
    </div>
  `;
}

// Функция для переключения видимости меню действий
window.toggleActionsMenu = function(clientCode) {
  const menu = document.getElementById(`actions-menu-${clientCode}`);
  const button = document.getElementById(`actions-btn-${clientCode}`);
  
  // Закрываем все другие меню
  document.querySelectorAll('[id^="actions-menu-"]').forEach(otherMenu => {
    if (otherMenu.id !== `actions-menu-${clientCode}`) {
      otherMenu.classList.add('hidden');
    }
  });
  
  // Переключаем текущее меню
  menu.classList.toggle('hidden');
  
  // Закрываем меню при клике вне его
  if (!menu.classList.contains('hidden')) {
    const closeMenu = (e) => {
      if (!button.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }
};

// Функция для изменения статуса клиента
window.changeClientStatus = async function(clientCode) {
  const currentStatus = getClientAlertStatus(clientCode);
  
  const statusOptions = [
    { value: 'new', label: '🆕 Новий' },
    { value: 'in_progress', label: '🔄 В роботі' },
    { value: 'resolved', label: '✅ Вирішено' },
    { value: 'closed', label: '🗂️ Закрито' }
  ];
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]';
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
      <h3 class="text-xl font-bold text-white mb-4">Змінити статус клієнта</h3>
      <p class="text-gray-300 mb-4">Клієнт: <strong>${getClientName(clientCode, clientCode)}</strong></p>
      <p class="text-gray-300 mb-4">Поточний статус: <strong>${statusOptions.find(s => s.value === currentStatus)?.label || currentStatus}</strong></p>
      
      <div class="space-y-2 mb-6">
        ${statusOptions.map(option => `
          <label class="flex items-center space-x-3 cursor-pointer">
            <input type="radio" name="status" value="${option.value}" 
                   ${option.value === currentStatus ? 'checked' : ''} 
                   class="text-indigo-600">
            <span class="text-white">${option.label}</span>
          </label>
        `).join('')}
      </div>
      
      <div class="flex justify-end space-x-3">
        <button onclick="this.closest('.fixed').remove()" 
                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          Скасувати
        </button>
        <button onclick="saveClientStatus('${clientCode}')" 
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Зберегти
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Закрываем меню действий
  const menu = document.getElementById(`actions-menu-${clientCode}`);
  if (menu) menu.classList.add('hidden');
};

// Функция для автоматической проверки и обновления статусов клиентов
function checkAndUpdateClientStatuses() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  Object.keys(clientActionsData).forEach(clientCode => {
    const clientData = clientActionsData[clientCode];
    if (!clientData || clientData.status === 'resolved' || clientData.status === 'closed') return;
    
    // Проверяем потенциальную дату заказа
    if (clientData.potentialOrderDate) {
      const orderDate = new Date(clientData.potentialOrderDate);
      if (orderDate < today) {
        clientActionsData[clientCode].status = 'resolved';
        alertsLogger.info(`✅ Автоматично встановлено статус "resolved" для клієнта ${clientCode}`);
      }
    }
  });
}

// Функция для сохранения нового статуса клиента
window.saveClientStatus = async function(clientCode) {
  try {
    const selectedStatus = document.querySelector('input[name="status"]:checked')?.value;
    if (!selectedStatus) {
      alert('Будь ласка, виберіть статус');
      return;
    }
    
    // Проверяем права доступа
    if (!window.hasPermission || !window.hasPermission('alerts_change_status')) {
      alert('Помилка: У вас немає прав для зміни статусу');
      return;
    }
    
    const userId = window.state?.currentUserId;
    const companyId = window.state?.currentCompanyId;
    
    if (!userId || !companyId) {
      alert('Помилка: Не вдалося визначити користувача або компанію');
      return;
    }
    
    // Обновляем локальные данные
    if (!clientActionsData[clientCode]) {
      clientActionsData[clientCode] = {
        status: 'new',
        actions: [],
        lastActivity: null,
        potentialOrderDate: null,
        expectedAmount: null
      };
    }
    
    clientActionsData[clientCode].status = selectedStatus;
    clientActionsData[clientCode].lastActivity = new Date().toISOString();
    
    // Сохраняем в Firebase
    const { db, doc, setDoc, serverTimestamp } = await import('../js/firebase.js');
    const docRef = doc(db, 'companies', companyId, 'clientAlerts', clientCode);
    
    await setDoc(docRef, {
      ...clientActionsData[clientCode],
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Закрываем модальное окно
    document.querySelector('.fixed').remove();
    
    // Обновляем отображение
    renderSignals();
    
    // Показываем уведомление
    showActionNotification(`Статус змінено на: ${selectedStatus}`, 'success');
    
  } catch (error) {
    console.error('❌ Помилка зміни статусу:', error);
    showActionNotification('Помилка зміни статусу: ' + error.message, 'error');
  }
};

// Функция для переключения панели AI-рекомендаций
window.toggleAIRecommendations = function() {
  const panel = document.getElementById('ai-recommendations-panel');
  if (panel) {
    panel.classList.toggle('hidden');
  }
};

// Функция для переключения видимости деталей действий по дате
window.toggleActionDetails = function(safeId) {
  const details = document.getElementById(safeId);
  const arrow = document.getElementById(`arrow-${safeId}`);
  
  if (!details || !arrow) return;
  
  // Переключаем видимость
  details.classList.toggle('hidden');
  
  // Поворачиваем стрелку
  if (details.classList.contains('hidden')) {
    arrow.style.transform = 'rotate(0deg)';
  } else {
    arrow.style.transform = 'rotate(90deg)';
  }
};

// СТАРАЯ ФУНКЦИЯ (оставляем для совместимости, но заменяем на новые)
function renderActionButtons(clientCode) {
  return renderActionsMenu(clientCode);
}

// Функция для отображения истории действий клиента в модальном окне
function renderClientActionsHistory(clientCode) {
  const clientData = clientActionsData[clientCode];
  
  if (!clientData || !clientData.actions || clientData.actions.length === 0) {
    return `
      <div class="text-center text-gray-400 py-8">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 10a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
        </svg>
        <p class="text-sm">Поки що немає записаних дій по цьому клієнту</p>
        <p class="text-xs text-gray-500 mt-1">Додайте першу дію через меню "Дії" в таблиці алертів</p>
      </div>
    `;
  }
  
  // Сортируем действия по дате (новые сверху)  
  const sortedActions = [...clientData.actions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Группируем действия по датам
  const groupedByDate = {};
  sortedActions.forEach(action => {
    const createdDate = new Date(action.createdAt);
    const dateKey = createdDate.toLocaleDateString('uk-UA');
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(action);
  });
  
  // Сортируем даты (новые сверху)
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    const dateA = new Date(a.split('.').reverse().join('-'));
    const dateB = new Date(b.split('.').reverse().join('-'));
    return dateB - dateA;
  });
  
  return `
    <div class="space-y-2">
      <div class="flex justify-between items-center mb-4">
        <h5 class="text-sm font-semibold text-gray-300">Всього дій: ${sortedActions.length}</h5>
        <div class="text-xs text-gray-400">
          Статус: ${renderClientStatus(clientCode)}
        </div>
      </div>
      
      ${sortedDates.map(dateKey => {
        const dayActions = groupedByDate[dateKey];
        const safeId = `actions-${clientCode}-${dateKey}`.replace(/[^\w-]/g, '_');
        
        // Определяем иконки для действий в этот день
        const dayActionTypes = [...new Set(dayActions.map(a => a.type))];
        const actionIcons = {
          'call': '📞',
          'meeting': '🤝', 
          'email': '📧',
          'proposal': '📄'
        };
        const dayIcons = dayActionTypes.map(type => actionIcons[type] || '📋').join(' ');
        
        return `
          <div class="bg-gray-800 rounded-lg border border-gray-700">
            <!-- Компактная строка даты -->
            <div class="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-750 transition-colors" 
                 onclick="toggleActionDetails('${safeId}')">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-gray-400 transition-transform duration-200" id="arrow-${safeId}" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                  </svg>
                  <span class="font-medium text-white">${dateKey}</span>
                </div>
                <div class="text-lg">${dayIcons}</div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs px-2 py-1 bg-blue-600/20 text-blue-300 rounded-full">
                  ${dayActions.length} ${dayActions.length === 1 ? 'дія' : dayActions.length < 5 ? 'дії' : 'дій'}
                </span>
                <span class="text-xs text-gray-500">
                  ${dayActions[0] ? new Date(dayActions[0].createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''}
                  ${dayActions.length > 1 ? ` - ${new Date(dayActions[dayActions.length-1].createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
              </div>
            </div>
            
            <!-- Детальная информация (скрыта по умолчанию) -->
            <div id="${safeId}" class="hidden border-t border-gray-700">
              ${dayActions.map((action, index) => {
                const actionLabels = {
                  'call': 'Дзвінок',
                  'meeting': 'Зустріч',
                  'email': 'Email',
                  'proposal': 'Комерційна пропозиція'
                };
                
                const createdDate = new Date(action.createdAt);
                const formattedTime = createdDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                
                return `
                  <div class="p-3 ${index < dayActions.length - 1 ? 'border-b border-gray-700/50' : ''} bg-gray-750/30">
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex items-center gap-2">
                        <span class="text-base">${actionIcons[action.type] || '📋'}</span>
                        <span class="font-medium text-gray-200">${actionLabels[action.type] || action.type}</span>
                      </div>
                      <div class="text-xs text-gray-500">
                        ${formattedTime}
                      </div>
                    </div>
                    
                    ${action.comment ? `
                      <div class="mb-2 ml-6">
                        <span class="text-xs text-gray-400">Коментар:</span>
                        <p class="text-sm text-gray-300 mt-1">${action.comment}</p>
                      </div>
                    ` : ''}
                    
                    ${action.nextAction ? `
                      <div class="mb-2 ml-6">
                        <span class="text-xs text-gray-400">Наступна дія:</span>
                        <p class="text-sm text-blue-300">${action.nextAction}</p>
                        ${action.nextActionDate ? `<span class="text-xs text-gray-500">на ${action.nextActionDate}</span>` : ''}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
      
      ${clientData.potentialOrderDate ? `
        <div class="bg-green-900/30 border border-green-600 rounded-lg p-3 mt-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-green-400">🎯</span>
            <span class="font-medium text-green-200">Потенційне замовлення</span>
          </div>
          <p class="text-sm text-gray-200">
            Дата: <span class="text-green-300">${clientData.potentialOrderDate}</span>
            ${clientData.expectedAmount ? ` • Сума: <span class="text-green-300">${clientData.expectedAmount} грн</span>` : ''}
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Быстрое действие по клиенту
 */
window.quickAction = function(clientCode, actionType) {
  alertsLogger.info(`🚀 Швидка дія: ${actionType} для клієнта ${clientCode}`);
  
  // Показываем модальное окно для ввода деталей действия
  showActionModal(clientCode, actionType);
}

/**
 * Показать модальное окно для действия
 */
function showActionModal(clientCode, actionType) {
  const oldModal = document.getElementById('action-modal');
  if (oldModal) oldModal.remove();
  
  const actionLabels = {
    'call': '📞 Дзвінок',
    'meeting': '🤝 Зустріч', 
    'email': '📧 Лист',
    'proposal': '📄 Комерційна пропозиція',
    'other': '📝 Інше'
  };
  
  const clientName = getClientName(clientCode, '');
  
  const modal = document.createElement('div');
  modal.id = 'action-modal';
  modal.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-60';
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md relative">
      <button id="close-action-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
      
      <h3 class="text-xl font-bold text-white mb-4">
        ${actionLabels[actionType] || actionLabels.other}
      </h3>
      
      <div class="mb-4">
        <p class="text-gray-300 text-sm mb-2">Клієнт: <span class="text-indigo-400 font-medium">${clientName || clientCode}</span></p>
      </div>
      
      <form id="action-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Коментар</label>
          <textarea id="action-comment" 
                    class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                    rows="3" 
                    placeholder="Опишіть що було зроблено..."></textarea>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Наступна дія</label>
          <select id="next-action" 
                  class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Не потрібно</option>
            <option value="call">Дзвінок</option>
            <option value="meeting">Зустріч</option>
            <option value="email">Лист</option>
            <option value="proposal">Комерційна пропозиція</option>
            <option value="other">Інше</option>
          </select>
        </div>
        
        <div id="next-action-date-container" class="hidden">
          <label class="block text-sm font-medium text-gray-300 mb-2">Дата наступної дії</label>
          <input type="date" id="next-action-date" 
                 class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Потенційне замовлення</label>
          <div class="grid grid-cols-2 gap-2">
            <input type="date" id="potential-order-date" 
                   class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   placeholder="Дата">
            <input type="number" id="potential-amount" 
                   class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   placeholder="Сума">
          </div>
        </div>
        
        <div class="flex gap-3">
          <button type="submit" 
                  class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            Зберегти
          </button>
          <button type="button" id="cancel-action" 
                  class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500">
            Скасувати
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Обработчики событий
  const closeModal = () => modal.remove();
  document.getElementById('close-action-modal').onclick = closeModal;
  document.getElementById('cancel-action').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  
  // Показать/скрыть поле даты следующей акции
  document.getElementById('next-action').onchange = function() {
    const container = document.getElementById('next-action-date-container');
    if (this.value) {
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  };
  
  // Обработка формы
  document.getElementById('action-form').onsubmit = function(e) {
    e.preventDefault();
    saveClientAction(clientCode, actionType);
    closeModal();
  };
  }

  // === NEW: Функция для отображения просроченных домовленостей ===
  function renderOverdueAgreements() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Собираем всех клиентов с просроченными действиями
    const overdueClients = [];
    
    Object.keys(clientActionsData).forEach(clientCode => {
      const clientData = clientActionsData[clientCode];
      if (!clientData || !clientData.actions) return;
      
      // Находим последние действия с nextActionDate
      const actionsWithDates = clientData.actions.filter(action => 
        action.nextActionDate && action.status !== 'cancelled'
      );
      
      if (actionsWithDates.length === 0) return;
      
      // Сортируем по дате создания (последние сверху)
      actionsWithDates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Берем последнее запланированное действие
      const latestAction = actionsWithDates[0];
      const actionDate = new Date(latestAction.nextActionDate);
      
      // Проверяем, просрочено ли действие
      if (actionDate < today) {
        const daysPastDue = Math.floor((today - actionDate) / (1000 * 60 * 60 * 24));
        
        // Получаем информацию о клиенте из продаж или справочника
        const clientName = getClientName(clientCode, clientCode);
        const clientLink = clientLinks[clientCode];
        
        overdueClients.push({
          code: clientCode,
          name: clientName,
          link: clientLink,
          plannedDate: latestAction.nextActionDate,
          plannedAction: latestAction.nextAction,
          daysPastDue: daysPastDue,
          lastComment: latestAction.comment || '',
          status: clientData.status || 'new',
          potentialOrderDate: clientData.potentialOrderDate,
          expectedAmount: clientData.expectedAmount
        });
      }
    });
    
    // Сортируем по количеству просроченных дней (самые просроченные сверху)
    const sortedOverdue = overdueClients.sort((a, b) => b.daysPastDue - a.daysPastDue);
    
    // Применяем фильтрацию
    const filteredOverdue = window.alertsFilterClients(sortedOverdue);
    
    // Рендерим таблицу
    const content = window.alertsGet('alerts-content-container');
    if (!content) return;
    
    if (filteredOverdue.length === 0) {
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">🎉</div>
          <h2 class="text-2xl font-bold text-white mb-2">Відмінно! Немає прострочених домовленостей</h2>
          <p class="text-gray-400">Всі заплановані дії виконані вчасно або ще не прострочені</p>
        </div>
      `;
      return;
    }
    
    content.innerHTML = `
              <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-white">Прострочені домовленості</h2>
            <p class="text-gray-400 mt-1">Клієнти з прострочениими запланованими діями</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-sm text-gray-300">
              <span class="text-red-400 font-semibold">${filteredOverdue.length}</span> 
              ${filteredOverdue.length === 1 ? 'прострочена домовленість' : 
                filteredOverdue.length < 5 ? 'прострочені домовленості' : 'прострочених домовленостей'}
            </div>
          </div>
        </div>
        
        <!-- Описание статусов -->
        <div class="bg-gray-700 rounded-lg p-4 mb-6">
          <h3 class="text-lg font-semibold text-white mb-3">📋 Опис статусів клієнтів:</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 rounded bg-red-600 text-white text-xs">🆕 Новий</span>
              <span class="text-gray-300">Клієнт щойно доданий до системи, ще не працювали</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 rounded bg-yellow-600 text-white text-xs">🔄 В роботі</span>
              <span class="text-gray-300">Активна робота з клієнтом, є заплановані дії</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 rounded bg-green-600 text-white text-xs">✅ Вирішено</span>
              <span class="text-gray-300">Проблема вирішена або потенційний замовлення в минулому</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 rounded bg-gray-600 text-white text-xs">🗂️ Закрито</span>
              <span class="text-gray-300">Клієнт закритий, робота завершена</span>
            </div>
          </div>
        </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700">
              <th class="px-4 py-3 text-left text-gray-300 font-medium">Клієнт</th>
              <th class="px-4 py-3 text-left text-gray-300 font-medium">Заплановане</th>
              <th class="px-4 py-3 text-left text-gray-300 font-medium">Дата</th>
              <th class="px-4 py-3 text-left text-gray-300 font-medium">Прострочено</th>
              <th class="px-4 py-3 text-left text-gray-300 font-medium">CRM</th>
              <th class="px-4 py-3 text-left text-gray-300 font-medium">Статус</th>
              <th class="px-4 py-3 text-left text-gray-300 font-medium">Дії</th>
              <th class="px-4 py-3 text-left text-gray-300 font-medium">Детальніше</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            ${filteredOverdue.map(client => {
              const urgencyClass = client.daysPastDue > 7 ? 'bg-red-900/30' : 
                                   client.daysPastDue > 3 ? 'bg-orange-900/30' : 'bg-yellow-900/30';
              const urgencyIcon = client.daysPastDue > 7 ? '🚨' : 
                                  client.daysPastDue > 3 ? '⚠️' : '⏰';
              
              return `
                <tr class="hover:bg-gray-800/50 transition-colors ${urgencyClass}">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="text-lg">${urgencyIcon}</span>
                      <div>
                        <div class="font-medium text-white">${client.name}</div>
                        <div class="text-xs text-gray-400">${client.code}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-gray-200">${client.plannedAction}</div>
                    ${client.lastComment ? `<div class="text-xs text-gray-400 mt-1">${client.lastComment}</div>` : ''}
                  </td>
                  <td class="px-4 py-3 text-gray-300">${client.plannedDate}</td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded text-xs font-medium ${
                      client.daysPastDue > 7 ? 'bg-red-600 text-white' :
                      client.daysPastDue > 3 ? 'bg-orange-600 text-white' : 
                      'bg-yellow-600 text-black'
                    }">
                      ${client.daysPastDue} ${client.daysPastDue === 1 ? 'день' : 
                        client.daysPastDue < 5 ? 'дні' : 'днів'}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    ${client.link ? `<a href="${client.link}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">CRM</a>` : ''}
                  </td>
                  <td class="px-4 py-3">${renderClientStatus(client.code)}</td>
                  <td class="px-4 py-3">${renderActionsMenu(client.code)}</td>
                  <td class="px-4 py-3">
                    <button class="px-3 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-sm" 
                            onclick="window.showClientDetail('${client.code}')">
                      Детальніше
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      ${filteredOverdue.length > 0 ? `
        <div class="mt-6 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-blue-400">💡</span>
            <span class="font-medium text-blue-200">Рекомендації:</span>
          </div>
          <ul class="text-sm text-blue-300 space-y-1 ml-6">
            <li>• Зверніться до клієнтів з найбільшою прострочкою в першу чергу</li>
            <li>• Використовуйте гамбургер меню "Дії" для швидкого створення нових планів</li>
            <li>• Оновіть статус клієнтів після контакту</li>
          </ul>
        </div>
      ` : ''}
    `;
  }

  // === NEW: Аналитика эффективности менеджеров ===
  function renderManagerAnalytics() {
    const content = window.alertsGet('alerts-content-container');
    if (!content) return;
    
    // Собираем статистику по менеджерам
    const managerStats = {};
    
    // Инициализируем статистику для всех менеджеров
    managersData.forEach(manager => {
      managerStats[manager.id] = {
        id: manager.id,
        name: manager.name,
        department: manager.department?.name || manager.department || 'Невідомий відділ',
        totalClients: 0,
        activeClients: 0,
        resolvedClients: 0,
        closedClients: 0,
        overdueActions: 0,
        totalActions: 0,
        potentialOrders: 0,
        potentialAmount: 0,
        avgResponseTime: 0,
        conversionRate: 0,
        lastActivityDate: null
      };
    });
    
    // Анализируем данные по клиентам
    Object.keys(clientActionsData).forEach(clientCode => {
      const clientData = clientActionsData[clientCode];
      if (!clientData || !clientData.actions || clientData.actions.length === 0) return;
      
      // Находим менеджера этого клиента
      const clientInfo = clientManagerDirectory[clientCode];
      if (!clientInfo || !clientInfo.manager) return;
      
      // Ищем менеджера в списке
      const manager = managersData.find(m => m.name === clientInfo.manager);
      if (!manager || !managerStats[manager.id]) return;
      
      const stats = managerStats[manager.id];
      
      // Основная статистика
      stats.totalClients++;
      stats.totalActions += clientData.actions.length;
      
      // Статус клиента
      const status = clientData.status || 'new';
      if (status === 'in_progress') stats.activeClients++;
      else if (status === 'resolved') stats.resolvedClients++;
      else if (status === 'closed') stats.closedClients++;
      
      // Потенциальные заказы
      if (clientData.potentialOrderDate) {
        stats.potentialOrders++;
        if (clientData.expectedAmount) {
          stats.potentialAmount += clientData.expectedAmount;
        }
      }
      
      // Просроченные действия
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const actionsWithDates = clientData.actions.filter(action => 
        action.nextActionDate && action.status !== 'cancelled'
      );
      
      if (actionsWithDates.length > 0) {
        actionsWithDates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latestAction = actionsWithDates[0];
        const actionDate = new Date(latestAction.nextActionDate);
        
        if (actionDate < today) {
          stats.overdueActions++;
        }
      }
      
      // Последняя активность
      if (clientData.lastActivity) {
        const activityDate = new Date(clientData.lastActivity);
        if (!stats.lastActivityDate || activityDate > stats.lastActivityDate) {
          stats.lastActivityDate = activityDate;
        }
      }
    });
    
    // Вычисляем производные метрики
    Object.values(managerStats).forEach(stats => {
      if (stats.totalClients > 0) {
        stats.conversionRate = ((stats.resolvedClients / stats.totalClients) * 100).toFixed(1);
      }
    });
    
    // Сортируем менеджеров по общей эффективности
    const sortedManagers = Object.values(managerStats)
      .filter(stats => stats.totalClients > 0)
      .sort((a, b) => {
        // Комплексная оценка: конверсия * количество клиентов - просрочка
        const scoreA = (parseFloat(a.conversionRate) * a.totalClients) - (a.overdueActions * 10);
        const scoreB = (parseFloat(b.conversionRate) * b.totalClients) - (b.overdueActions * 10);
        return scoreB - scoreA;
      });
    
    // Применяем фильтрацию
    const filteredManagers = sortedManagers.filter(manager => {
      if (currentDepartment) {
        const managerData = managersData.find(m => m.id === manager.id);
        if (managerData) {
          return managerData.departmentId === currentDepartment ||
                 managerData.department === currentDepartment ||
                 (managerData.department && managerData.department.id === currentDepartment);
        }
        return false;
      }
      if (currentManager) {
        return manager.id === currentManager;
      }
      return true;
    });
    
    content.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-white">Аналітика ефективності менеджерів</h2>
          <p class="text-gray-400 mt-1">Статистика роботи з клієнтами по менеджерам</p>
        </div>
        <div class="text-sm text-gray-300">
          <span class="text-blue-400 font-semibold">${filteredManagers.length}</span> 
          ${filteredManagers.length === 1 ? 'менеджер' : 
            filteredManagers.length < 5 ? 'менеджери' : 'менеджерів'} в роботі
        </div>
      </div>
      
      ${filteredManagers.length === 0 ? `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📊</div>
          <h2 class="text-2xl font-bold text-white mb-2">Немає даних для аналізу</h2>
          <p class="text-gray-400">Виберіть інші фільтри або дочекайтеся накопичення даних</p>
        </div>
      ` : `
        <!-- Топ-3 менеджера -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          ${filteredManagers.slice(0, 3).map((manager, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const colors = ['from-yellow-600 to-yellow-700', 'from-gray-500 to-gray-600', 'from-orange-600 to-orange-700'];
            
            return `
              <div class="bg-gradient-to-br ${colors[index]} rounded-lg p-4 text-white">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-2xl">${medals[index]}</span>
                  <span class="text-xs px-2 py-1 bg-white/20 rounded-full">#${index + 1}</span>
                </div>
                <h3 class="font-bold text-lg mb-1">${manager.name}</h3>
                <p class="text-xs opacity-75 mb-3">${manager.department}</p>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p class="opacity-75">Клієнтів</p>
                    <p class="font-bold text-lg">${manager.totalClients}</p>
                  </div>
                  <div>
                    <p class="opacity-75">Конверсія</p>
                    <p class="font-bold text-lg">${manager.conversionRate}%</p>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <!-- Детальная таблица -->
        <div class="bg-gray-700 rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-gray-300 font-medium">Менеджер</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Клієнтів</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Активних</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Вирішено</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Конверсія</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Прострочка</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Потенціал</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Остання активність</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-600">
                ${filteredManagers.map((manager, index) => {
                  const conversionColor = parseFloat(manager.conversionRate) >= 70 ? 'text-green-400' :
                                         parseFloat(manager.conversionRate) >= 50 ? 'text-yellow-400' : 'text-red-400';
                  
                  const overdueColor = manager.overdueActions === 0 ? 'text-green-400' :
                                      manager.overdueActions <= 2 ? 'text-yellow-400' : 'text-red-400';
                  
                  const lastActivity = manager.lastActivityDate ? 
                    manager.lastActivityDate.toLocaleDateString('uk-UA') : 'Немає';
                  
                  return `
                    <tr class="hover:bg-gray-600/50 transition-colors">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <span class="text-lg">${index < 3 ? ['🥇', '🥈', '🥉'][index] : '👤'}</span>
                          <div>
                            <div class="font-medium text-white">${manager.name}</div>
                            <div class="text-xs text-gray-400">${manager.department}</div>
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-center text-white font-medium">${manager.totalClients}</td>
                      <td class="px-4 py-3 text-center text-yellow-400">${manager.activeClients}</td>
                      <td class="px-4 py-3 text-center text-green-400">${manager.resolvedClients}</td>
                      <td class="px-4 py-3 text-center ${conversionColor} font-bold">${manager.conversionRate}%</td>
                      <td class="px-4 py-3 text-center ${overdueColor} font-medium">${manager.overdueActions}</td>
                      <td class="px-4 py-3 text-center">
                        <div class="text-white font-medium">${manager.potentialOrders}</div>
                        ${manager.potentialAmount > 0 ? `
                          <div class="text-xs text-green-300">~${(manager.potentialAmount / 1000).toFixed(0)}k грн</div>
                        ` : ''}
                      </td>
                      <td class="px-4 py-3 text-center text-gray-300 text-xs">${lastActivity}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Рекомендации -->
        <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-blue-400">🏆</span>
              <span class="font-medium text-blue-200">Лідери ефективності:</span>
            </div>
            <ul class="text-sm text-blue-300 space-y-1">
              ${filteredManagers.slice(0, 3).map(m => 
                `<li>• ${m.name} - ${m.conversionRate}% конверсія, ${m.totalClients} клієнтів</li>`
              ).join('')}
            </ul>
          </div>
          
          <div class="bg-orange-900/20 border border-orange-600 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-orange-400">⚠️</span>
              <span class="font-medium text-orange-200">Потребують уваги:</span>
            </div>
            <ul class="text-sm text-orange-300 space-y-1">
              ${filteredManagers.filter(m => m.overdueActions > 0 || parseFloat(m.conversionRate) < 50)
                .slice(0, 3).map(m => 
                  `<li>• ${m.name} - ${m.overdueActions > 0 ? `${m.overdueActions} прострочень` : `${m.conversionRate}% конверсія`}</li>`
                ).join('') || '<li>• Всі менеджери працюють ефективно! 🎉</li>'}
            </ul>
          </div>
        </div>
      `}
    `;
     }

  // === NEW: Система уведомлений и напоминаний ===
  function initNotificationSystem() {
    // Проверяем уведомления каждые 30 секунд
    if (notificationCheckInterval) {
      clearInterval(notificationCheckInterval);
    }
    
    notificationCheckInterval = setInterval(() => {
      checkForNotifications();
      
      // Проверяем и обновляем статусы каждые 5 минут
      checkAndUpdateClientStatuses();
      
      // Обновляем AI-рекомендации каждые 5 минут
      if (!lastRecommendationUpdate || (new Date() - lastRecommendationUpdate) > 300000) {
        generateAIRecommendations();
        // Додаємо перевірку на існування функції renderDashboard
        if (typeof renderDashboard === 'function') {
          renderDashboard(); // Перерендериваем дашборд с новыми рекомендациями
        } else {
          console.warn('⚠️ Функція renderDashboard не знайдена - пропускаємо оновлення дашборду');
        }
      }
    }, 30000); // 30 секунд
    
    // Первая проверка сразу
    setTimeout(() => checkForNotifications(), 2000);
    
    console.log('🔔 Система уведомлений инициализирована');
  }
  
  function checkForNotifications() {
    const now = new Date();
    const notifications = [];
    
    // Проверяем просроченные действия
    Object.keys(clientActionsData).forEach(clientCode => {
      const clientData = clientActionsData[clientCode];
      if (!clientData || !clientData.actions) return;
      
      const actionsWithDates = clientData.actions.filter(action => 
        action.nextActionDate && action.status !== 'cancelled'
      );
      
      if (actionsWithDates.length === 0) return;
      
      // Берем последнее запланированное действие
      actionsWithDates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const latestAction = actionsWithDates[0];
      const actionDate = new Date(latestAction.nextActionDate);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Проверяем просрочку
      if (actionDate < today) {
        const daysPastDue = Math.floor((today - actionDate) / (1000 * 60 * 60 * 24));
        const clientName = getClientName(clientCode, clientCode);
        
        notifications.push({
          type: 'overdue',
          priority: daysPastDue > 7 ? 'high' : daysPastDue > 3 ? 'medium' : 'low',
          title: `Прострочена дія: ${clientName}`,
          message: `${latestAction.nextAction} заплановано на ${latestAction.nextActionDate} (${daysPastDue} днів тому)`,
          clientCode: clientCode,
          daysPastDue: daysPastDue
        });
      }
      
      // Проверяем действия на сегодня
      const todayStr = now.toISOString().split('T')[0];
      if (latestAction.nextActionDate === todayStr) {
        const clientName = getClientName(clientCode, clientCode);
        
        notifications.push({
          type: 'today',
          priority: 'medium',
          title: `Сьогодні: ${clientName}`,
          message: `Заплановано: ${latestAction.nextAction}`,
          clientCode: clientCode
        });
      }
      
      // Проверяем потенциальные заказы на завтра/послезавтра
      if (clientData.potentialOrderDate) {
        const potentialDate = new Date(clientData.potentialOrderDate);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(today.getDate() + 2);
        
        if (potentialDate <= dayAfterTomorrow && potentialDate >= tomorrow) {
          const clientName = getClientName(clientCode, clientCode);
          const daysUntil = Math.floor((potentialDate - today) / (1000 * 60 * 60 * 24));
          
          notifications.push({
            type: 'potential',
            priority: 'high',
            title: `Потенційне замовлення: ${clientName}`,
            message: `Очікується замовлення ${daysUntil === 1 ? 'завтра' : 'післязавтра'}`,
            clientCode: clientCode,
            expectedAmount: clientData.expectedAmount
          });
        }
      }
    });
    
    // Показываем уведомления
    if (notifications.length > 0) {
      showNotificationSummary(notifications);
    }
  }
  
  function showNotificationSummary(notifications) {
    // Фильтруем дубликаты и сортируем по приоритету
    const uniqueNotifications = notifications.filter((notif, index, arr) => 
      arr.findIndex(n => n.clientCode === notif.clientCode && n.type === notif.type) === index
    );
    
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    uniqueNotifications.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    
    // Показываем только топ-5 уведомлений
    const topNotifications = uniqueNotifications.slice(0, 5);
    
    if (topNotifications.length === 0) return;
    
    // Создаем всплывающее уведомление
    const notificationElement = document.createElement('div');
    notificationElement.className = `
      fixed top-4 right-4 z-[150] bg-gray-800 border border-gray-600 rounded-lg shadow-xl 
      max-w-sm transition-all duration-300 transform translate-x-full
    `;
    
    const overdueCount = topNotifications.filter(n => n.type === 'overdue').length;
    const todayCount = topNotifications.filter(n => n.type === 'today').length;
    const potentialCount = topNotifications.filter(n => n.type === 'potential').length;
    
    notificationElement.innerHTML = `
      <div class="p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <span class="text-2xl">🔔</span>
            Сповіщення
          </h3>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                  class="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <div class="space-y-2 mb-4">
          ${overdueCount > 0 ? `
            <div class="flex items-center gap-2 text-red-400 text-sm">
              <span>⏰</span>
              <span>${overdueCount} прострочені дії</span>
            </div>
          ` : ''}
          ${todayCount > 0 ? `
            <div class="flex items-center gap-2 text-yellow-400 text-sm">
              <span>📅</span>
              <span>${todayCount} дії на сьогодні</span>
            </div>
          ` : ''}
          ${potentialCount > 0 ? `
            <div class="flex items-center gap-2 text-green-400 text-sm">
              <span>🎯</span>
              <span>${potentialCount} потенційні замовлення</span>
            </div>
          ` : ''}
        </div>
        
        <div class="space-y-2 mb-4 max-h-48 overflow-y-auto">
          ${topNotifications.map(notif => `
            <div class="p-2 bg-gray-700 rounded text-sm">
              <div class="font-medium text-white">${notif.title}</div>
              <div class="text-gray-300 text-xs">${notif.message}</div>
              ${notif.expectedAmount ? `
                <div class="text-green-300 text-xs mt-1">~${(notif.expectedAmount / 1000).toFixed(0)}k грн</div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        
        <div class="flex gap-2">
          <button onclick="showAlertsModule('overdue-agreements')" 
                  class="flex-1 px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
            Переглянути всі
          </button>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                  class="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
            Закрити
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(notificationElement);
    
    // Анимация появления
    setTimeout(() => {
      notificationElement.style.transform = 'translateX(0)';
    }, 100);
    
    // Автоматическое скрытие через 10 секунд для неприоритетных уведомлений
    const hasHighPriority = topNotifications.some(n => n.priority === 'high');
    if (!hasHighPriority) {
      setTimeout(() => {
        if (notificationElement.parentElement) {
          notificationElement.style.transform = 'translateX(100%)';
          setTimeout(() => notificationElement.remove(), 300);
        }
      }, 10000);
    }
  }
  
  // Функция для перехода к модулю сигнализации
  window.showAlertsModule = function(tab = 'overdue-agreements') {
    // Убираем активные классы со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Активируем кнопку сигнализации
    const alertsBtn = document.querySelector('[data-module="alerts"]');
    if (alertsBtn) {
      alertsBtn.classList.add('active');
      alertsBtn.click();
      
      // После загрузки модуля переключаемся на нужную вкладку
      setTimeout(() => {
        if (window.setSignal) {
          window.setSignal(tab);
        }
      }, 500);
    }
     };

  // === NEW: Детальные отчеты по клиентам ===
  function renderClientReports() {
    const content = window.alertsGet('alerts-content-container');
    if (!content) return;
    
    // Собираем детальную информацию по всем клиентам с действиями
    const clientReports = [];
    
    Object.keys(clientActionsData).forEach(clientCode => {
      const clientData = clientActionsData[clientCode];
      if (!clientData || !clientData.actions || clientData.actions.length === 0) return;
      
      const clientInfo = clientManagerDirectory[clientCode];
      const clientName = getClientName(clientCode, clientCode);
      const clientLink = clientLinks[clientCode];
      
      // Анализируем действия клиента
      const actions = [...clientData.actions].sort((a, b) => {
        // Додаємо перевірку на undefined для createdAt
        const dateA = a && a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b && b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });
      const lastAction = actions[0];
      const firstAction = actions[actions.length - 1];
      
      // Статистика по типам действий
      const actionStats = {};
      const actionTypes = ['call', 'meeting', 'email', 'commercial_proposal', 'other'];
      actionTypes.forEach(type => {
        actionStats[type] = actions.filter(a => a.type === type).length;
      });
      
      // Просроченные действия
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const overdueActions = actions.filter(action => {
        if (!action.nextActionDate || action.status === 'cancelled') return false;
        const actionDate = new Date(action.nextActionDate);
        return actionDate < today;
      });
      
      // Время работы с клиентом
      const firstActionDate = firstAction && firstAction.createdAt ? new Date(firstAction.createdAt) : new Date();
      const workingDays = Math.floor((now - firstActionDate) / (1000 * 60 * 60 * 24));
      
      // Эффективность работы
      const status = clientData.status || 'new';
      const isResolved = status === 'resolved';
      const isActive = status === 'in_progress';
      
      clientReports.push({
        code: clientCode,
        name: clientName,
        manager: clientInfo?.manager || 'Невідомий',
        link: clientLink,
        status: status,
        totalActions: actions.length,
        workingDays: workingDays,
        firstActionDate: firstActionDate,
        lastActionDate: new Date(lastAction.createdAt),
        overdueCount: overdueActions.length,
        actionStats: actionStats,
        isResolved: isResolved,
        isActive: isActive,
        potentialOrderDate: clientData.potentialOrderDate,
        expectedAmount: clientData.expectedAmount,
        lastActivity: clientData.lastActivity
      });
    });
    
    // Применяем фильтрацию
    let filteredReports = clientReports;
    
    if (currentDepartment || currentManager) {
      filteredReports = filteredReports.filter(report => {
        if (currentManager) {
          const manager = managersData.find(m => m.name === report.manager);
          return manager && manager.id === currentManager;
        }
        if (currentDepartment) {
          const manager = managersData.find(m => m.name === report.manager);
          if (manager) {
            return manager.departmentId === currentDepartment ||
                   manager.department === currentDepartment ||
                   (manager.department && manager.department.id === currentDepartment);
          }
          return false;
        }
        return true;
      });
    }
    
    if (currentStatus) {
      filteredReports = filteredReports.filter(report => report.status === currentStatus);
    }
    
    if (currentSearch) {
      filteredReports = filteredReports.filter(report => 
        report.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
        report.manager.toLowerCase().includes(currentSearch.toLowerCase())
      );
    }
    
    // Сортируем по количеству дней работы с клиентом (самые "старые" клиенты сверху)
    filteredReports.sort((a, b) => b.workingDays - a.workingDays);
    
    content.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-white">Детальні звіти по клієнтах</h2>
          <p class="text-gray-400 mt-1">Повна історія взаємодій та статистика роботи з клієнтами</p>
        </div>
        <div class="text-sm text-gray-300">
          <span class="text-blue-400 font-semibold">${filteredReports.length}</span> 
          ${filteredReports.length === 1 ? 'клієнт' : 
            filteredReports.length < 5 ? 'клієнти' : 'клієнтів'} з історією
        </div>
      </div>
      
      ${filteredReports.length === 0 ? `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📋</div>
          <h2 class="text-2xl font-bold text-white mb-2">Немає даних для звіту</h2>
          <p class="text-gray-400">Виберіть інші фільтри або дочекайтеся накопичення даних</p>
        </div>
      ` : `
        <!-- Статистика сверху -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-3 text-white text-center">
            <div class="text-2xl mb-1">📊</div>
            <div class="text-sm opacity-75">Середній час роботи</div>
            <div class="text-lg font-bold">
              ${Math.round(filteredReports.reduce((sum, r) => sum + r.workingDays, 0) / filteredReports.length)} днів
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-3 text-white text-center">
            <div class="text-2xl mb-1">✅</div>
            <div class="text-sm opacity-75">Успішно вирішено</div>
            <div class="text-lg font-bold">
              ${filteredReports.filter(r => r.isResolved).length}
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-3 text-white text-center">
            <div class="text-2xl mb-1">🔄</div>
            <div class="text-sm opacity-75">Активно в роботі</div>
            <div class="text-lg font-bold">
              ${filteredReports.filter(r => r.isActive).length}
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-3 text-white text-center">
            <div class="text-2xl mb-1">⏰</div>
            <div class="text-sm opacity-75">З прострочкою</div>
            <div class="text-lg font-bold">
              ${filteredReports.filter(r => r.overdueCount > 0).length}
            </div>
          </div>
        </div>
        
        <!-- Детальная таблица -->
        <div class="bg-gray-700 rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-gray-300 font-medium">Клієнт</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Менеджер</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Статус</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Дії</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Днів роботи</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Прострочка</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Потенціал</th>
                  <th class="px-4 py-3 text-center text-gray-300 font-medium">Детальніше</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-600">
                ${filteredReports.map(report => {
                  const statusColors = {
                    'new': 'bg-gray-600 text-white',
                    'in_progress': 'bg-yellow-600 text-white',
                    'resolved': 'bg-green-600 text-white',
                    'closed': 'bg-gray-500 text-white'
                  };
                  
                  const statusLabels = {
                    'new': '🆕 Новий',
                    'in_progress': '🔄 В роботі',
                    'resolved': '✅ Вирішено',
                    'closed': '🗂️ Закрито'
                  };
                  
                  const workingDaysColor = report.workingDays > 30 ? 'text-red-400' :
                                          report.workingDays > 14 ? 'text-yellow-400' : 'text-green-400';
                  
                  const overdueColor = report.overdueCount === 0 ? 'text-green-400' :
                                      report.overdueCount <= 2 ? 'text-yellow-400' : 'text-red-400';
                  
                  return `
                    <tr class="hover:bg-gray-600/50 transition-colors">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <span class="text-lg">${report.isResolved ? '✅' : report.isActive ? '🔄' : '🆕'}</span>
                          <div>
                            <div class="font-medium text-white">${report.name}</div>
                            <div class="text-xs text-gray-400">${report.code}</div>
                            ${report.link ? `
                              <a href="${report.link}" target="_blank" class="text-blue-400 hover:text-blue-300 underline text-xs">CRM</a>
                            ` : ''}
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-center text-gray-300">${report.manager}</td>
                      <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 rounded text-xs ${statusColors[report.status]}">
                          ${statusLabels[report.status]}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <div class="text-white font-medium">${report.totalActions}</div>
                        <div class="text-xs text-gray-400">
                          📞${report.actionStats.call} 🤝${report.actionStats.meeting} 
                          📧${report.actionStats.email} 📄${report.actionStats.commercial_proposal}
                        </div>
                      </td>
                      <td class="px-4 py-3 text-center ${workingDaysColor} font-medium">${report.workingDays}</td>
                      <td class="px-4 py-3 text-center ${overdueColor} font-medium">${report.overdueCount}</td>
                      <td class="px-4 py-3 text-center">
                        ${report.potentialOrderDate ? `
                          <div class="text-green-400 font-medium">🎯 ${report.potentialOrderDate}</div>
                          ${report.expectedAmount ? `
                            <div class="text-xs text-green-300">~${(report.expectedAmount / 1000).toFixed(0)}k грн</div>
                          ` : ''}
                        ` : '<span class="text-gray-500">—</span>'}
                      </td>
                      <td class="px-4 py-3 text-center">
                        <button class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm" 
                                onclick="window.showClientDetail('${report.code}')">
                          Історія
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Аналитика по типам действий -->
        <div class="mt-6 bg-gray-700 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-4">Аналітика дій</h3>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            ${['call', 'meeting', 'email', 'commercial_proposal', 'other'].map(actionType => {
              const total = filteredReports.reduce((sum, r) => sum + r.actionStats[actionType], 0);
              const actionLabels = {
                'call': '📞 Дзвінки',
                'meeting': '🤝 Зустрічі',
                'email': '📧 Email',
                'commercial_proposal': '📄 КП',
                'other': '📋 Інше'
              };
              
              return `
                <div class="text-center">
                  <div class="text-2xl mb-2">${actionLabels[actionType].split(' ')[0]}</div>
                  <div class="text-sm text-gray-300">${actionLabels[actionType].split(' ')[1]}</div>
                  <div class="text-xl font-bold text-white">${total}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `}
    `;
     }

  // === NEW: Система AI-рекомендаций с push-уведомлениями ===
  
  // Функция для сохранения AI уведомлений в Firestore
  window.saveAIRecommendationNotification = async function(recommendation) {
    try {
      const firebaseModule = await import('../js/firebase.js');
      const { collection, addDoc } = firebaseModule;
      const companyId = window.state?.currentCompanyId;
      if (!companyId) {
        console.warn('Company ID not found, cannot save AI notification');
        return;
      }
      
      // Проверяем права доступа
      if (!window.hasPermission('ai_notifications_create')) {
        console.warn('No permission to create AI notifications');
        return;
      }
      
      // Находим managerId по имени менеджера
      const managerId = window.findManagerIdByName(recommendation.manager);
      if (!managerId) {
        console.warn(`Manager not found: ${recommendation.manager}`);
        return;
      }
      
      const notificationData = {
        type: 'ai_recommendation',
        title: recommendation.title,
        description: recommendation.description,
        clientCode: recommendation.clientCode,
        clientName: recommendation.clientName,
        managerId: managerId,
        managerName: recommendation.manager,
        priority: recommendation.priority,
        actionType: recommendation.actionType,
        reasoning: recommendation.reasoning,
        createdAt: new Date(),
        isRead: false,
        recommendationData: recommendation
      };
      
      alertsLogger.verbose('💾 Сохраняем уведомление:', notificationData);
      
      const notificationsRef = collection(firebaseModule.db, 'companies', companyId, 'aiNotifications');
      await addDoc(notificationsRef, notificationData);
      
      alertsLogger.info(`✅ AI уведомление сохранено для менеджера ${recommendation.manager} (ID: ${managerId})`);
    } catch (error) {
      console.error('❌ Ошибка сохранения AI уведомления:', error);
    }
  }
  
  // Функция для поиска managerId по имени
  window.findManagerIdByName = function(managerName) {
    if (!window.state?.allEmployees) {
      console.warn('❌ allEmployees не загружены');
      return null;
    }
    
    alertsLogger.verbose(`🔍 Ищем менеджера: "${managerName}"`);
    alertsLogger.verbose('📋 Доступные сотрудники:', window.state.allEmployees.map(emp => ({ id: emp.id, name: emp.name })));
    
    const manager = window.state.allEmployees.find(emp => 
      emp.name && emp.name.trim().toLowerCase() === managerName.trim().toLowerCase()
    );
    
    if (manager) {
      alertsLogger.verbose(`✅ Найден менеджер: ${manager.name} (ID: ${manager.id})`);
    } else {
      alertsLogger.warn(`❌ Менеджер не найден: "${managerName}"`);
    }
    
    return manager?.id || null;
  }
  
  // Функция для загрузки AI уведомлений для текущего пользователя
  window.loadAIRecommendationNotifications = async function() {
    try {
      const firebaseModule = await import('../js/firebase.js');
      const { collection, query, where, orderBy, getDocs } = firebaseModule;
      const companyId = window.state?.currentCompanyId;
      const currentUserId = window.state?.currentUserId;
      
      alertsLogger.verbose('🔍 Отладка AI уведомлений:', { companyId, currentUserId });
      
      if (!companyId || !currentUserId) {
        alertsLogger.warn('❌ Отсутствует companyId или currentUserId');
        return [];
      }
      
      // Проверяем права доступа
      if (!window.hasPermission('ai_notifications_view')) {
        console.warn('No permission to view AI notifications');
        return [];
      }
      
      const notificationsRef = collection(firebaseModule.db, 'companies', companyId, 'aiNotifications');
      const q = query(
        notificationsRef,
        where('managerId', '==', currentUserId),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const notifications = [];
      
      snapshot.docs.forEach(doc => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      alertsLogger.info(`📱 Загружено ${notifications.length} AI уведомлений для пользователя ${currentUserId}`);
      return notifications;
    } catch (error) {
      alertsLogger.error('❌ Ошибка загрузки AI уведомлений:', error);
      return [];
    }
  }
  
  // Функция для отметки уведомления как прочитанного
  window.markAIRecommendationAsRead = async function(notificationId) {
    try {
      const firebaseModule = await import('../js/firebase.js');
      const { doc, updateDoc } = firebaseModule;
      const companyId = window.state?.currentCompanyId;
      if (!companyId) return;
      
      const notificationRef = doc(firebaseModule.db, 'companies', companyId, 'aiNotifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: new Date()
      });
      
      alertsLogger.info(`✅ AI уведомление ${notificationId} отмечено как прочитанное`);
    } catch (error) {
      alertsLogger.error('❌ Ошибка отметки AI уведомления как прочитанного:', error);
    }
  }
  
  window.generateAIRecommendations = async function() {
    const recommendations = [];
    const now = new Date();
    
    // Анализируем данные и генерируем рекомендации
    Object.keys(clientActionsData).forEach(clientCode => {
      const clientData = clientActionsData[clientCode];
      if (!clientData || !clientData.actions) return;
      
      const clientName = getClientName(clientCode, clientCode);
      const clientInfo = clientManagerDirectory[clientCode];
      const managerName = clientInfo?.manager || 'Невідомий';
      
      const actions = [...clientData.actions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const lastAction = actions[0];
      const firstAction = actions[actions.length - 1];
      
      const workingDays = Math.floor((now - new Date(firstAction.createdAt)) / (1000 * 60 * 60 * 24));
      const status = clientData.status || 'new';
      
      // Рекомендация 1: Долгая работа с клиентом без результата
      if (workingDays > 21 && status === 'in_progress' && actions.length >= 3) {
        const callActions = actions.filter(a => a.type === 'call').length;
        const meetingActions = actions.filter(a => a.type === 'meeting').length;
        
        if (meetingActions === 0 && callActions >= 2) {
          recommendations.push({
            type: 'action_suggestion',
            priority: 'high',
            clientCode: clientCode,
            clientName: clientName,
            manager: managerName,
            title: 'Рекомендується особиста зустріч',
            description: `З клієнтом ${clientName} працюємо ${workingDays} днів, було ${callActions} дзвінків, але жодної зустрічі. Час для особистої зустрічі.`,
            actionType: 'meeting',
            reasoning: 'Довга робота без прогресу, потрібен особистий контакт'
          });
        }
      }
      
      // Рекомендация 2: Много звонков без результата - предложить КП
      if (status === 'in_progress') {
        const callActions = actions.filter(a => a.type === 'call').length;
        const proposalActions = actions.filter(a => a.type === 'commercial_proposal').length;
        
        if (callActions >= 3 && proposalActions === 0) {
          recommendations.push({
            type: 'action_suggestion',
            priority: 'medium',
            clientCode: clientCode,
            clientName: clientName,
            manager: managerName,
            title: 'Час відправити комерційну пропозицію',
            description: `Після ${callActions} дзвінків з ${clientName} варто відправити КП для конкретизації потреб.`,
            actionType: 'commercial_proposal',
            reasoning: 'Багато контактів без конкретної пропозиції'
          });
        }
      }
      
      // Рекомендация 3: Просроченные действия
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const actionsWithDates = actions.filter(action => 
        action.nextActionDate && action.status !== 'cancelled'
      );
      
      if (actionsWithDates.length > 0) {
        const latestAction = actionsWithDates[0];
        const actionDate = new Date(latestAction.nextActionDate);
        
        if (actionDate < today) {
          const daysPastDue = Math.floor((today - actionDate) / (1000 * 60 * 60 * 24));
          
          recommendations.push({
            type: 'urgent_action',
            priority: daysPastDue > 7 ? 'critical' : 'high',
            clientCode: clientCode,
            clientName: clientName,
            manager: managerName,
            title: `Термінова дія: ${latestAction.nextAction}`,
            description: `Заплановане ${latestAction.nextAction} з ${clientName} прострочено на ${daysPastDue} днів!`,
            actionType: latestAction.type,
            reasoning: `Прострочка ${daysPastDue} днів`
          });
        }
      }
      
      // Рекомендация 4: Потенциальный заказ скоро
      if (clientData.potentialOrderDate) {
        const potentialDate = new Date(clientData.potentialOrderDate);
        const daysUntil = Math.floor((potentialDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil >= 0 && daysUntil <= 3) {
          recommendations.push({
            type: 'opportunity',
            priority: 'high',
            clientCode: clientCode,
            clientName: clientName,
            manager: managerName,
            title: 'Потенційне замовлення близько!',
            description: `${clientName} планував замовлення на ${clientData.potentialOrderDate} (${daysUntil === 0 ? 'сьогодні' : `через ${daysUntil} днів`})`,
            actionType: 'call',
            reasoning: 'Час закривати угоду'
          });
        }
      }
      
      // Рекомендация 5: Статус "новый" слишком долго
      if (status === 'new' && workingDays > 3) {
        recommendations.push({
          type: 'status_issue',
          priority: 'medium',
          clientCode: clientCode,
          clientName: clientName,
          manager: managerName,
          title: 'Оновіть статус клієнта',
          description: `${clientName} має статус "новий" вже ${workingDays} днів. Оновіть статус відповідно до поточної роботи.`,
          actionType: 'status_update',
          reasoning: 'Неактуальний статус заважає аналітиці'
        });
      }
    });
    
    // Сортируем по приоритету
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    
    aiRecommendations = recommendations;
    lastRecommendationUpdate = now;
    
    // Сохраняем уведомления в Firestore для каждого менеджера
    alertsLogger.verbose(`💾 Сохраняем ${recommendations.length} уведомлений в Firestore...`);
    
          for (const recommendation of recommendations) {
        try {
          await window.saveAIRecommendationNotification(recommendation);
        } catch (error) {
          alertsLogger.error(`❌ Ошибка сохранения уведомления для ${recommendation.clientName}:`, error);
        }
      }
    
    alertsLogger.info(`🤖 Згенеровано ${recommendations.length} AI-рекомендацій`);
    return recommendations;
  }
  
  function renderAIRecommendationsWidget() {
    if (!aiRecommendations.length) {
      generateAIRecommendations();
    }
    
    // Показываем только топ-5 рекомендаций
    const topRecommendations = aiRecommendations.slice(0, 5);
    
    if (topRecommendations.length === 0) {
      return `
        <div class="bg-green-900/20 border border-green-600 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-green-400">🤖</span>
            <span class="font-medium text-green-200">AI Рекомендації</span>
          </div>
          <p class="text-sm text-green-300">Відмінно! Наразі немає критичних рекомендацій. Продовжуйте в тому ж дусі! 🎉</p>
        </div>
      `;
    }
    
    const criticalCount = topRecommendations.filter(r => r.priority === 'critical').length;
    const highCount = topRecommendations.filter(r => r.priority === 'high').length;
    
    return `
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-2xl font-bold text-white mb-2">Сигналізація</h2>
          <p class="text-gray-300">Повідомлення про критичні події та сигнали по клієнтах</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.generateAIRecommendations()" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            Тест AI
          </button>
          <div class="relative">
          <button onclick="toggleAIRecommendations()" 
                  class="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all duration-300">
            <span class="text-xl">🔔</span>
            ${criticalCount > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">${criticalCount}</span>` : ''}
          </button>
          
          <div id="ai-recommendations-panel" class="absolute top-16 right-0 z-40 bg-gray-800 rounded-lg shadow-xl border border-gray-600 max-w-sm w-80 hidden">
          <div class="p-4 border-b border-gray-600">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-blue-400">🤖</span>
                <span class="font-medium text-white">AI Рекомендації</span>
              </div>
              <button onclick="toggleAIRecommendations()" class="text-gray-400 hover:text-white">✕</button>
            </div>
            <div class="text-xs text-gray-300 mt-1">
              ${criticalCount > 0 ? `${criticalCount} критичних` : ''}
              ${highCount > 0 ? `${highCount} важливих` : ''}
            </div>
          </div>
          
          <div class="max-h-96 overflow-y-auto p-4 space-y-3">
            ${topRecommendations.map(rec => {
              const priorityColors = {
                critical: 'border-red-500 bg-red-900/30 text-red-200',
                high: 'border-orange-500 bg-orange-900/30 text-orange-200',
                medium: 'border-yellow-500 bg-yellow-900/30 text-yellow-200',
                low: 'border-gray-500 bg-gray-900/30 text-gray-200'
              };
              
              const priorityIcons = {
                critical: '🚨',
                high: '⚠️',
                medium: '💡',
                low: 'ℹ️'
              };
              
              return `
                <div class="border rounded p-3 text-sm ${priorityColors[rec.priority]}">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span>${priorityIcons[rec.priority]}</span>
                      <span class="font-medium">${rec.title}</span>
                    </div>
                    <button onclick="toggleAIRecommendations(); showAlertsModule('client-reports'); setTimeout(() => window.showClientDetail('${rec.clientCode}'), 1000)" 
                            class="text-blue-400 hover:text-blue-300 underline text-xs">
                      →
                    </button>
                  </div>
                  <p class="mb-2 text-xs">${rec.description}</p>
                  <div class="flex items-center justify-between text-xs opacity-75">
                    <span>${rec.manager}</span>
                    <span>${rec.reasoning}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // === NEW: Глобальные вспомогательные функции ===
  window.alertsGet = function(id) {
    if (window.alertsContainer) {
      return window.alertsContainer.querySelector(`#${id}`);
    }
    return null;
  };
  
  // Инициализируем контейнер при загрузке модуля
  window.alertsContainer = null;
  
  window.alertsFilterClients = function(list) {
    let filtered = list;
    
    // Фильтр по поиску
    if (window.currentSearch) {
      filtered = filtered.filter(c => c.name.toLowerCase().includes(window.currentSearch.toLowerCase()));
    }
    
    // Фильтр по статусу
    if (window.currentStatus) {
      filtered = filtered.filter(c => {
        const clientStatus = getClientAlertStatus(c.code);
        return clientStatus === window.currentStatus;
      });
    }
    
    return filtered;
  };

// === NEW: Головна функція ініціалізації ===
window.initAlertsModule = function(container) {
  if (isAlertsInitialized) return; // Запобігаємо повторній ініціалізації
  alertsLogger.info('initAlertsModule called', container);
  if (!container) return;
  
  // Сохраняем ссылку на контейнер в глобальной переменной
  window.alertsContainer = container;
  
  // Проверяем права доступа к модулю
  if (!window.hasPermission || !window.hasPermission('alerts_view_page')) {
  container.innerHTML = `
      <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
        <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
        <p class="text-red-200">У вас немає прав для перегляду модуля "Сигналізація".</p>
        <p class="text-red-300 text-sm mt-2">Зверніться до адміністратора для надання доступу.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="bg-gray-800 rounded-xl shadow-lg p-4">
      <!-- Заголовок будет рендериться в renderDashboard -->
      
      <!-- Індикатор завантаження -->
      <div id="alerts-loading-container" class="text-center p-8">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <div>
          <p id="alerts-loading-message" class="text-lg font-medium text-gray-200 mb-2">Завантаження данных...</p>
          <div class="bg-gray-700 rounded-full h-2 max-w-md mx-auto mb-2">
            <div id="alerts-progress-bar" class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
          <p id="alerts-loading-step" class="text-sm text-gray-400">Ініціалізація...</p>
      </div>
      </div>
      
      <!-- Основний контент (спочатку прихований) -->
      <div id="alerts-main-content" class="hidden">
        <!-- Дашборд статистики -->
        <div id="alerts-dashboard-container" class="mb-4"></div>
        
      <div id="alerts-filters-container" class="mb-4"></div>
      <div id="alerts-tabs-container" class="mb-4"></div>
      <div id="alerts-content-container" class="mb-4"></div>
      <div id="chart-container" class="mb-4"></div>
      </div>
    </div>
  `;

  // Функции управления UI загрузки
  function updateLoadingProgress(percent, message, step) {
    const progressBar = window.alertsGet('alerts-progress-bar');
    const loadingMessage = window.alertsGet('alerts-loading-message');
    const loadingStep = window.alertsGet('alerts-loading-step');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingStep) loadingStep.textContent = step;
  }
  
  function showMainContent() {
    const loadingContainer = window.alertsGet('alerts-loading-container');
    const mainContent = window.alertsGet('alerts-main-content');
    
    if (loadingContainer) loadingContainer.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
  }
  
  function showError(errorMessage) {
    const loadingContainer = window.alertsGet('alerts-loading-container');
    if (loadingContainer) {
      loadingContainer.innerHTML = `
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
  }

  async function loadData() {
    alertsLogger.info('alerts.js: loadData called');
    try {
      updateLoadingProgress(10, 'Ініціалізація...', 'Підготовка до завантаження даних');
      
      // Загружаем данные параллельно
      const companyId = window.state?.currentCompanyId;
      
      updateLoadingProgress(20, 'Завантаження даних...', 'Підключення до серверів');
      
      const promises = [
      fetch('модуль помічник продажу/data.json'),
      fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
      fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url')
      ];
      
      // Загружаем данные из Firebase если есть компания
      if (companyId) {
        updateLoadingProgress(30, 'Завантаження даних...', 'Підключення до Firebase');
        const firebase = await import('../js/firebase.js');
        promises.push(
          firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'employees')),
          firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'departments')),
          firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'members'))
        );
        
        // Загружаем данные о действиях клиентов
        try {
          const clientAlertsSnap = await firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'clientAlerts'));
          clientAlertsSnap.forEach(doc => {
            clientActionsData[doc.id] = doc.data();
          });
          
          // Проверяем и обновляем статусы автоматически
          checkAndUpdateClientStatuses();
          
        } catch (error) {
          console.warn('⚠️ Помилка завантаження дій клієнтів:', error);
        }
      }
      
      updateLoadingProgress(50, 'Завантаження даних...', 'Отримання даних з серверів');
      const results = await Promise.all(promises);
      
      updateLoadingProgress(60, 'Обробка даних...', 'Парсинг JSON файлів');
      const [dataRes, dataJulyRes, refRes] = results;
      
    const data = await dataRes.json();
    const dataJuly = await dataJulyRes.json();
    masterData = data.concat(dataJuly);
    const refData = await refRes.json();
    clientLinks = Object.fromEntries(refData.map(item => [item['Клиент.Код'], item['посилання']]));
      clientNames = Object.fromEntries(refData.map(item => [item['Клиент.Код'], item['Клиент.Название'] || item['Клиент.Код']]));
      
      // Создаем полный справочник клиент-менеджер
      clientManagerDirectory = {};
      refData.forEach(item => {
        const code = item['Клиент.Код'];
        if (code) {
          clientManagerDirectory[code] = {
            manager: item['Менеджер'],
            link: item['посилання'],
            name: item['Клиент.Название'] || code
          };
        }
      });
      
      updateLoadingProgress(70, 'Обробка користувачів...', 'Завантаження співробітників та відділів');
      
      // Обрабатываем данные Firebase
      if (companyId && results.length > 4) {
        const [, , , employeesSnap, departmentsSnap, membersSnap] = results;
        
        // Загружаем members (как в Помічник продажу)
        const allMembers = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.state = window.state || {};
        window.state.allMembers = allMembers;
        console.log('🔧 Завантажено members:', allMembers.length);
        
        // Загружаем всех сотрудников и фильтруем менеджеров
        const allEmployees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        updateLoadingProgress(80, 'Фільтрація менеджерів...', 'Визначення доступних менеджерів');
        
        // Фильтруем менеджеров по критериям
        managersData = allEmployees.filter(emp => {
          if (emp.role === 'manager') return true;
          if (emp.position) {
            const position = emp.position.toLowerCase();
            return position.includes('менеджер') || 
                   position.includes('manager') || 
                   position.includes('sales') ||
                   position.includes('продаж');
          }
          return false;
        });
        
        // Если не нашли менеджеров по критериям, используем всех сотрудников
        if (managersData.length === 0) {
          console.warn('🔍 Менеджери не знайдені за критеріями в сигналізації, використовуємо всіх співробітників');
          managersData = allEmployees;
        }
        
        departmentsData = departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Загружаем существующие действия клиентов
        try {
          console.log('📥 Завантаження дій клієнтів з Firebase...');
          const firebase = await import('../js/firebase.js');
          const { db, collection, getDocs } = firebase;
          const clientAlertsRef = collection(db, 'companies', companyId, 'clientAlerts');
          const clientAlertsSnap = await getDocs(clientAlertsRef);
          
          clientActionsData = {};
          clientAlertsSnap.docs.forEach(doc => {
            clientActionsData[doc.id] = doc.data();
          });
          
          console.log('✅ Завантажено дій клієнтів:', Object.keys(clientActionsData).length);
        } catch (error) {
          console.warn('⚠️ Помилка завантаження дій клієнтів:', error);
          clientActionsData = {};
        }
        
        // Получаем ID текущего пользователя
        currentUserId = window.state?.currentUserId;
        
        console.log('📊 Завантажено з Firebase в сигналізації:');
        console.log('- Співробітників:', allEmployees.length);
        console.log('- Менеджерів:', managersData.length);
        console.log('- Відділів:', departmentsData.length);
        console.log('- Дій клієнтів:', Object.keys(clientActionsData).length);
      }
      
      updateLoadingProgress(90, 'Підготовка інтерфейсу...', 'Створення фільтрів та вкладок');
      
    alertsLogger.info('alerts.js: masterData loaded', masterData.length);
    if (typeof renderDashboard === 'function') {
      renderDashboard();
    } else {
      alertsLogger.warn('⚠️ Функція renderDashboard не знайдена - пропускаємо рендеринг дашборду');
    }
    renderFilters();
    renderTabs();
      
      updateLoadingProgress(95, 'Фінальні розрахунки...', 'Обробка сигналів');
    renderSignals();
      updateLoadingProgress(100, 'Готово!', 'Сигналізація успішно завантажена');
      
      // Задержка чтобы пользователь увидел 100%
      setTimeout(() => {
        showMainContent();
        // Инициализируем систему уведомлений
        initNotificationSystem();
        
        // Обновляем уведомления в основном приложении
        if (typeof window.updateVacationNotifications === 'function') {
          setTimeout(() => {
            window.updateVacationNotifications();
          }, 2000);
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Помилка завантаження даних в сигналізації:', error);
      showError(error.message || 'Невідома помилка');
    }
  }

  // === NEW: Функция для рендеринга дашборда статистики ===
  function renderDashboard() {
    const dashboardDiv = window.alertsGet('alerts-dashboard-container');
    if (!dashboardDiv) return;
    
    // Подсчитываем статистику
    const stats = {
      total: Object.keys(clientActionsData).length,
      new: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      overdue: 0,
      potentialOrders: 0,
      potentialAmount: 0
    };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    Object.keys(clientActionsData).forEach(clientCode => {
      const clientData = clientActionsData[clientCode];
      if (!clientData) return;
      
      // Подсчитываем по статусам
      const status = clientData.status || 'new';
      stats[status] = (stats[status] || 0) + 1;
      
      // Подсчитываем просроченные действия
      if (clientData.actions) {
        const actionsWithDates = clientData.actions.filter(action => 
          action.nextActionDate && action.status !== 'cancelled'
        );
        
        if (actionsWithDates.length > 0) {
          actionsWithDates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          const latestAction = actionsWithDates[0];
          const actionDate = new Date(latestAction.nextActionDate);
          
          if (actionDate < today) {
            stats.overdue++;
          }
        }
      }
      
      // Подсчитываем потенциальные заказы
      if (clientData.potentialOrderDate) {
        stats.potentialOrders++;
        if (clientData.expectedAmount) {
          stats.potentialAmount += clientData.expectedAmount;
        }
      }
    });
    
    dashboardDiv.innerHTML = `
      <!-- Компактные карточки статистики -->
      <div class="grid grid-cols-4 gap-3 mb-3">
        <div class="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-3 text-white">
          <div class="flex items-center gap-2">
            <span class="text-xl">👥</span>
            <div>
              <p class="text-xs text-blue-100">Всього</p>
              <p class="text-lg font-bold">${stats.total}</p>
            </div>
          </div>
        </div>
        
        <div class="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-3 text-white">
          <div class="flex items-center gap-2">
            <span class="text-xl">🔄</span>
            <div>
              <p class="text-xs text-yellow-100">В роботі</p>
              <p class="text-lg font-bold">${stats.in_progress} <span class="text-xs">(+${stats.new})</span></p>
            </div>
          </div>
        </div>
        
        <div class="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-3 text-white">
          <div class="flex items-center gap-2">
            <span class="text-xl">⏰</span>
            <div>
              <p class="text-xs text-red-100">Прострочені</p>
              <p class="text-lg font-bold">${stats.overdue}</p>
            </div>
          </div>
        </div>
        
        <div class="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-3 text-white">
          <div class="flex items-center gap-2">
            <span class="text-xl">🎯</span>
            <div>
              <p class="text-xs text-green-100">Потенційні</p>
              <p class="text-lg font-bold">${stats.potentialOrders}</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Детальна статистика в одну строку -->
      <div class="bg-gray-700 rounded-lg p-2 mb-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-300 font-medium">Розподіл за статусами:</span>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <span>🆕</span>
              <span class="text-white font-medium">${stats.new}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>🔄</span>
              <span class="text-yellow-400 font-medium">${stats.in_progress}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>✅</span>
              <span class="text-green-400 font-medium">${stats.resolved}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>🗂️</span>
              <span class="text-gray-400 font-medium">${stats.closed}</span>
            </div>
            ${stats.potentialAmount > 0 ? `
              <div class="flex items-center gap-1 ml-2 pl-2 border-l border-gray-600">
                <span>💰</span>
                <span class="text-green-300 font-medium">~${(stats.potentialAmount / 1000).toFixed(0)}k</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <!-- AI Рекомендации -->
      <div class="mb-4">
        ${renderAIRecommendationsWidget()}
      </div>
    `;
  }

  function renderFilters() {
    console.log('🔧 Рендеринг фільтрів сигналізації:', {
      'departmentsData.length': departmentsData.length,
      'managersData.length': managersData.length
    });
    
    const filtersDiv = window.alertsGet('alerts-filters-container');
    if (!filtersDiv) return;
    
    // Создаем объект userAccess аналогично модулю Помічник продажу
    const userAccess = {
      userId: window.state?.currentUserId,
      employeeId: null,
      employee: null,
      role: window.state?.currentUserRole?.toLowerCase(),
      departmentId: window.state?.currentUserDepartment,
      isAdmin: window.state?.isAdmin || false
    };
    
    console.log('🔧 Створення userAccess з window.state:', {
      currentUserId: window.state?.currentUserId,
      currentUserEmail: window.state?.currentUserEmail,
      currentUserDepartment: window.state?.currentUserDepartment,
      currentUserRole: window.state?.currentUserRole,
      isAdmin: window.state?.isAdmin
    });
    
        // Находим сотрудника ТОЛЬКО через members (как в Помічник продажу)
    console.log('🔧 Пошук співробітника для userId:', userAccess.userId);
    console.log('🔧 managersData.length:', managersData.length);
    console.log('🔧 window.state.currentUserId:', window.state?.currentUserId);
    console.log('🔧 window.state.currentUserEmail:', window.state?.currentUserEmail);
    
    // Ищем ТОЛЬКО через members (как в Помічник продажу)
    console.log('🔧 Шукаємо через members...');
    if (window.state?.allMembers && window.state.allMembers.length > 0) {
      const currentMember = window.state.allMembers.find(m => 
        m.userId === userAccess.userId || 
        m.userId === window.state?.currentUserId
      );
      console.log('🔧 Знайдений member:', currentMember);
      
      if (currentMember && currentMember.employeeId) {
        userAccess.employeeId = currentMember.employeeId;
        console.log('🔧 Знайдений employeeId з member:', currentMember.employeeId);
        
        // Найдем employee по employeeId в managersData
        const employee = managersData.find(emp => emp.id === currentMember.employeeId);
        console.log('🔧 Знайдений employee по employeeId:', employee);
        
        if (employee) {
          userAccess.employee = employee;
          if (!userAccess.departmentId && employee.department) {
            if (typeof employee.department === 'object' && employee.department.id) {
              userAccess.departmentId = employee.department.id;
            } else if (typeof employee.department === 'string') {
              userAccess.departmentId = employee.department;
            }
          }
          
          // Определяем role из employee (как в Помічник продажу)
          if (employee.role) {
            userAccess.role = employee.role.toLowerCase();
          } else if (employee.position) {
            const position = employee.position.toLowerCase();
            if (position.includes('менеджер') || position.includes('manager')) {
              userAccess.role = 'менеджер';
            } else if (position.includes('керівник') || position.includes('head')) {
              userAccess.role = 'керівник';
            } else if (position.includes('адмін') || position.includes('admin')) {
              userAccess.role = 'адмін';
            }
          }
          
          console.log('🔧 userAccess після пошуку через members:', userAccess);
        } else {
          console.log('❌ Employee не знайдений по employeeId:', currentMember.employeeId);
        }
      } else {
        console.log('❌ Member не має employeeId або не знайдений');
      }
    } else {
      console.log('❌ window.state.allMembers не знайдено');
    }
    
    console.log('🔧 userAccess для сигналізації:', userAccess);
    
    // Получаем список отделов и менеджеров
    let departmentOptions = '';
    let managerOptions = '';
    
    if (departmentsData.length > 0 && managersData.length > 0) {
      // Используем данные из Firebase
      console.log('✅ Використовуємо Firebase дані для фільтрів сигналізації');
      
      // Фильтруем отделы по ролям (как в Помічник продажу)
      let visibleDepartments = departmentsData;
      if (!userAccess.isAdmin && userAccess.departmentId) {
        if (userAccess.role && (userAccess.role.includes('менедж') || userAccess.role.includes('керівник'))) {
          visibleDepartments = departmentsData.filter(dep => dep.id === userAccess.departmentId);
        }
      }
      
      departmentOptions = visibleDepartments.map(dept => 
        `<option value="${dept.id}">${dept.name}</option>`
      ).join('');
      
      // Фильтруем менеджеров по выбранному отделу и ролям
      let filteredManagers = currentDepartment 
        ? managersData.filter(manager => {
            return manager.departmentId === currentDepartment ||
                   manager.department === currentDepartment ||
                   (manager.department && manager.department.id === currentDepartment);
          })
        : managersData;
      
      // Контроль доступа: если менеджер — только он, если руководитель — все из отдела, если админ — все
      console.log('[renderFilters] До фільтрації менеджерів:', filteredManagers.length);
      console.log('[renderFilters] userAccess.isAdmin:', userAccess.isAdmin);
      console.log('[renderFilters] userAccess.employeeId:', userAccess.employeeId);
      console.log('[renderFilters] userAccess.role:', userAccess.role);
      
      if (!userAccess.isAdmin && userAccess.employeeId) {
        if (userAccess.role && userAccess.role.includes('менедж')) {
          // Только сам пользователь
          console.log('[renderFilters] Фільтруємо тільки себе для менеджера');
          filteredManagers = filteredManagers.filter(emp => emp.id === userAccess.employeeId);
          console.log('[renderFilters] Менеджер бачить тільки себе:', filteredManagers);
        } else if (userAccess.role && userAccess.role.includes('керівник')) {
          // Все из его отдела
          console.log('[renderFilters] Фільтруємо відділ для керівника');
          filteredManagers = filteredManagers.filter(emp => {
            if (!emp.department) return false;
            if (typeof emp.department === 'object' && emp.department.id) {
              return emp.department.id === userAccess.departmentId;
            } else if (typeof emp.department === 'string') {
              return emp.department === userAccess.departmentId;
            }
            return false;
          });
          console.log('[renderFilters] Керівник бачить менеджерів відділу:', filteredManagers);
        }
      } else {
        console.log('[renderFilters] Не фільтруємо - адмін або немає employeeId');
      }
      
      console.log('[renderFilters] Після фільтрації менеджерів:', filteredManagers.length);
      
      managerOptions = filteredManagers.map(manager => 
        `<option value="${manager.id}">${manager.name}</option>`
      ).join('');
      console.log('[renderFilters] Фінальні managerOptions:', managerOptions);
    } else {
      // Fallback: используем данные из продаж
      console.log('⚠️ Fallback: використовуємо дані з продаж для фільтрів');
      
      let uniqueDepartments = [...new Set(masterData.map(item => item['Відділ']).filter(Boolean))];
      let uniqueManagers = [...new Set(masterData.map(item => item['Основной менеджер']).filter(Boolean))];
      
      // Фильтруем отделы по ролям (как в Помічник продажу)
      if (!userAccess.isAdmin && userAccess.departmentId) {
        if (userAccess.role && (userAccess.role.includes('менедж') || userAccess.role.includes('керівник'))) {
          // Находим название отдела пользователя
          const userDepartment = departmentsData.find(dep => dep.id === userAccess.departmentId);
          if (userDepartment) {
            uniqueDepartments = uniqueDepartments.filter(dept => dept === userDepartment.name);
          }
        }
      }
      
      departmentOptions = uniqueDepartments.map(dept => 
        `<option value="${dept}">${dept}</option>`
      ).join('');
      
      // Фильтруем менеджеров по ролям (как в Помічник продажу)
      if (!userAccess.isAdmin && userAccess.employeeId) {
        if (userAccess.role && userAccess.role.includes('менедж')) {
          // Только сам пользователь
          const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
          if (currentUser) {
            uniqueManagers = uniqueManagers.filter(manager => manager === currentUser.name);
          }
        } else if (userAccess.role && userAccess.role.includes('керівник')) {
          // Все из его отдела
          uniqueManagers = uniqueManagers.filter(manager => {
            const emp = managersData.find(m => m.name === manager);
            if (!emp || !emp.department) return false;
            return emp.department === userAccess.departmentId;
          });
        }
      }
      
      managerOptions = uniqueManagers.map(manager => 
        `<option value="${manager}">${manager}</option>`
      ).join('');
    }
    
    filtersDiv.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200">Відділ:</label>
          <select id="alerts-department-filter" class="dark-input bg-gray-900 text-gray-200 w-full">
            <option value="">Всі відділи</option>
            ${departmentOptions}
        </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200">Менеджер:</label>
          <select id="alerts-manager-filter" class="dark-input bg-gray-900 text-gray-200 w-full">
            <option value="">Всі менеджери</option>
            ${managerOptions}
        </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200">Період:</label>
          <select id="alerts-period-filter" class="dark-input bg-gray-900 text-gray-200 w-full">
          <option value="3">Останні 3 міс</option>
          <option value="6">Останні 6 міс</option>
          <option value="12">Останній рік</option>
        </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200">Статус:</label>
          <select id="alerts-status-filter" class="dark-input bg-gray-900 text-gray-200 w-full">
            <option value="">Всі статуси</option>
            <option value="new">🆕 Новий</option>
            <option value="in_progress">🔄 В роботі</option>
            <option value="resolved">✅ Вирішено</option>
            <option value="closed">🗂️ Закрито</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200">Пошук:</label>
          <input id="alerts-search-input" type="text" class="dark-input bg-gray-900 text-gray-200 w-full" placeholder="Пошук клієнта..." value="${currentSearch}">
        </div>
        <div class="flex items-end">
          <button id="alerts-export-btn" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full">Експорт CSV</button>
        </div>
      </div>
    `;
    
    // Устанавливаем обработчики с учетом зависимых фильтров
    window.alertsGet('alerts-department-filter').onchange = e => {
      currentDepartment = e.target.value;
      currentManager = ''; // Сбрасываем выбор менеджера
      updateAlertsManagersFilter(); // Обновляем список менеджеров
      renderSignals();
    };
    
    window.alertsGet('alerts-manager-filter').onchange = e => {
      currentManager = e.target.value;
      renderSignals();
    };
    
    window.alertsGet('alerts-period-filter').onchange = e => {
      currentPeriod = +e.target.value;
      renderSignals();
    };
    
    window.alertsGet('alerts-status-filter').onchange = e => {
      currentStatus = e.target.value;
      renderSignals();
    };
    
    window.alertsGet('alerts-search-input').oninput = e => {
      currentSearch = e.target.value;
      renderSignals();
    };
    
    window.alertsGet('alerts-export-btn').onclick = exportCSV;
  }
  
  // Обновление фильтра менеджеров при изменении отдела
  function updateAlertsManagersFilter() {
    const managerFilter = window.alertsGet('alerts-manager-filter');
    if (!managerFilter) return;
    
    let managerOptions = '';
    let filteredManagers = [];
    
    // Создаем объект userAccess аналогично модулю Помічник продажу
    const userAccess = {
      userId: window.state?.currentUserId,
      employeeId: null,
      employee: null,
      role: window.state?.currentUserRole?.toLowerCase(),
      departmentId: window.state?.currentUserDepartment,
      isAdmin: window.state?.isAdmin || false
    };
    
    // Находим сотрудника ТОЛЬКО через members (как в renderFilters)
    console.log('[updateAlertsManagersFilter] Шукаємо через members...');
    if (window.state?.allMembers && window.state.allMembers.length > 0) {
      const currentMember = window.state.allMembers.find(m => 
        m.userId === userAccess.userId || 
        m.userId === window.state?.currentUserId
      );
      console.log('[updateAlertsManagersFilter] Знайдений member:', currentMember);
      
      if (currentMember && currentMember.employeeId) {
        userAccess.employeeId = currentMember.employeeId;
        console.log('[updateAlertsManagersFilter] Знайдений employeeId з member:', currentMember.employeeId);
        
        // Найдем employee по employeeId в managersData
        const employee = managersData.find(emp => emp.id === currentMember.employeeId);
        console.log('[updateAlertsManagersFilter] Знайдений employee по employeeId:', employee);
        
        if (employee) {
          userAccess.employee = employee;
          if (!userAccess.departmentId && employee.department) {
            if (typeof employee.department === 'object' && employee.department.id) {
              userAccess.departmentId = employee.department.id;
            } else if (typeof employee.department === 'string') {
              userAccess.departmentId = employee.department;
            }
          }
          
          // Определяем role из employee (как в renderFilters)
          if (employee.role) {
            userAccess.role = employee.role.toLowerCase();
          } else if (employee.position) {
            const position = employee.position.toLowerCase();
            if (position.includes('менеджер') || position.includes('manager')) {
              userAccess.role = 'менеджер';
            } else if (position.includes('керівник') || position.includes('head')) {
              userAccess.role = 'керівник';
            } else if (position.includes('адмін') || position.includes('admin')) {
              userAccess.role = 'адмін';
            }
          }
          
          console.log('[updateAlertsManagersFilter] userAccess після пошуку через members:', userAccess);
        } else {
          console.log('[updateAlertsManagersFilter] Employee не знайдений по employeeId:', currentMember.employeeId);
        }
      } else {
        console.log('[updateAlertsManagersFilter] Member не має employeeId або не знайдений');
      }
    } else {
      console.log('[updateAlertsManagersFilter] window.state.allMembers не знайдено');
    }
    
    if (departmentsData.length > 0 && managersData.length > 0) {
      // Используем данные из Firebase
      let allManagers = managersData;
      
      // Фильтрация по отделу
      if (currentDepartment) {
        allManagers = allManagers.filter(manager => {
          return manager.departmentId === currentDepartment ||
                 manager.department === currentDepartment ||
                 (manager.department && manager.department.id === currentDepartment);
        });
      }
      
      // Контроль доступа: если менеджер — только он, если руководитель — все из отдела, если админ — все
      if (!userAccess.isAdmin && userAccess.employeeId) {
        if (userAccess.role && userAccess.role.includes('менедж')) {
          // Только сам пользователь
          filteredManagers = allManagers.filter(emp => emp.id === userAccess.employeeId);
          console.log('[updateAlertsManagersFilter] Менеджер бачить тільки себе:', filteredManagers);
        } else if (userAccess.role && userAccess.role.includes('керівник')) {
          // Все из его отдела
          filteredManagers = allManagers.filter(emp => {
            if (!emp.department) return false;
            if (typeof emp.department === 'object' && emp.department.id) {
              return emp.department.id === userAccess.departmentId;
            } else if (typeof emp.department === 'string') {
              return emp.department === userAccess.departmentId;
            }
            return false;
          });
          console.log('[updateAlertsManagersFilter] Керівник бачить менеджерів відділу:', filteredManagers);
        } else {
          // fallback: все
          filteredManagers = allManagers;
          console.log('[updateAlertsManagersFilter] Інша роль, всі менеджери');
        }
      } else {
        // Админ видит всех
        filteredManagers = allManagers;
      }
      
      managerOptions = filteredManagers.map(manager => 
        `<option value="${manager.id}">${manager.name}</option>`
      ).join('');
    } else {
      // Fallback: используем данные из продаж
      let managersInDepartment = currentDepartment 
        ? [...new Set(masterData.filter(d => d['Відділ'] === currentDepartment).map(d => d['Основной менеджер']))]
        : [...new Set(masterData.map(d => d['Основной менеджер']))];
      
      // Применяем ту же логику фильтрации
      if (!userAccess.isAdmin && userAccess.employeeId) {
        if (userAccess.role && userAccess.role.includes('менедж')) {
          // Только сам пользователь
          const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
          if (currentUser) {
            managersInDepartment = managersInDepartment.filter(manager => manager === currentUser.name);
          }
        } else if (userAccess.role && userAccess.role.includes('керівник')) {
          // Все из его отдела
          managersInDepartment = managersInDepartment.filter(manager => {
            const emp = managersData.find(m => m.name === manager);
            if (!emp || !emp.department) return false;
            return emp.department === userAccess.departmentId;
          });
        }
      }
      
      managerOptions = managersInDepartment.filter(Boolean).map(manager => 
        `<option value="${manager}">${manager}</option>`
      ).join('');
    }
    
    managerFilter.innerHTML = `
      <option value="">Всі менеджери</option>
      ${managerOptions}
    `;
  }
  
  // Функция для получения имени менеджера из Firebase или из данных продаж
  function getManagerName(managerId) {
    if (!managerId) return null;
    
    // Если используем Firebase данные
    if (managersData.length > 0) {
      const manager = managersData.find(m => m.id === managerId);
      return manager ? manager.name : null;
    }
    
    // Fallback: ID и имя одинаковые (из данных продаж)
    return managerId;
  }
  
  // Функция для получения названия отдела
  function getDepartmentName(departmentId) {
    if (!departmentId) return null;
    
    // Если используем Firebase данные
    if (departmentsData.length > 0) {
      const department = departmentsData.find(d => d.id === departmentId);
      return department ? department.name : null;
    }
    
    // Fallback: ID и имя одинаковые (из данных продаж)
    return departmentId;
  }
  

  
  // Функция для получения списка клиентов конкретного менеджера из справочника
  function getManagerClients(managerId) {
    if (!managerId) return [];
    
    // Получаем имя менеджера
    const managerName = getManagerName(managerId);
    if (!managerName) return [];
    
    // Ищем всех клиентов этого менеджера в справочнике
    return Object.entries(clientManagerDirectory)
      .filter(([code, info]) => info.manager && info.manager.trim() === managerName.trim())
      .map(([code, info]) => ({
        code,
        name: info.name,
        manager: info.manager,
        link: info.link
      }));
  }
  
  // Универсальная функция проверки фильтров
  function passesFilters(sale) {
    const clientCode = sale['Клиент.Код'];
    
    // Создаем объект userAccess аналогично модулю Помічник продажу
    const userAccess = {
      userId: window.state?.currentUserId,
      employeeId: null,
      employee: null,
      role: window.state?.currentUserRole?.toLowerCase(),
      departmentId: window.state?.currentUserDepartment,
      isAdmin: window.state?.isAdmin || false
    };
    
    // Находим сотрудника по userId
    if (userAccess.userId && managersData.length > 0) {
      const currentEmployee = managersData.find(emp => emp.userId === userAccess.userId);
      if (currentEmployee) {
        userAccess.employeeId = currentEmployee.id;
        userAccess.employee = currentEmployee;
        // Определяем departmentId если не задан
        if (!userAccess.departmentId && currentEmployee.department) {
          if (typeof currentEmployee.department === 'object' && currentEmployee.department.id) {
            userAccess.departmentId = currentEmployee.department.id;
          } else if (typeof currentEmployee.department === 'string') {
            userAccess.departmentId = currentEmployee.department;
          }
        }
      }
    }
    
    // Проверяем права доступа к данным
    if (!userAccess.isAdmin) {
      // Проверяем права на просмотр всех алертов компании
      if (window.hasPermission && window.hasPermission('alerts_view_all_clients')) {
        // Пользователь может видеть все алерты - пропускаем
      } else if (window.hasPermission && window.hasPermission('alerts_view_department_clients')) {
        // Пользователь может видеть алерты своего отдела
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser && currentUser.department) {
          const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
          const clientInfo = clientManagerDirectory[clientCode];
          if (!clientInfo) return false;
          
          // Проверяем, что клиент принадлежит менеджеру из отдела пользователя
          const departmentManagers = managersData.filter(manager => {
            return manager.departmentId === userDeptId ||
                   manager.department === userDeptId ||
                   (manager.department && manager.department.id === userDeptId);
          });
          
          const departmentManagerNames = departmentManagers.map(m => m.name);
          if (!departmentManagerNames.includes(clientInfo.manager)) {
            return false;
          }
        }
      } else if (window.hasPermission && window.hasPermission('alerts_view_manager_clients')) {
        // Пользователь может видеть только своих клиентов
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser) {
          const managerName = currentUser.name;
          const clientInfo = clientManagerDirectory[clientCode];
          if (!clientInfo || clientInfo.manager !== managerName) {
            return false;
          }
        }
      } else {
        // Нет прав на просмотр - скрываем все
        return false;
      }
    }
    
    // Если пользователь не админ, применяем дополнительную фильтрацию по ролям
    if (!userAccess.isAdmin && userAccess.employeeId) {
      if (userAccess.role && userAccess.role.includes('менедж')) {
        // Менеджер видит только своих клиентов
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser) {
          const managerName = currentUser.name;
          const clientInfo = clientManagerDirectory[clientCode];
          if (!clientInfo || clientInfo.manager !== managerName) {
            return false;
          }
        }
      } else if (userAccess.role && userAccess.role.includes('керівник')) {
        // Руководитель видит клиентов своего отдела
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser && currentUser.department) {
          const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
          const clientInfo = clientManagerDirectory[clientCode];
          if (!clientInfo) return false;
          
          // Проверяем, что клиент принадлежит менеджеру из отдела руководителя
          const departmentManagers = managersData.filter(manager => {
            return manager.departmentId === userDeptId ||
                   manager.department === userDeptId ||
                   (manager.department && manager.department.id === userDeptId);
          });
          
          const departmentManagerNames = departmentManagers.map(m => m.name);
          if (!departmentManagerNames.includes(clientInfo.manager)) {
            return false;
          }
        }
      }
    }
    
    // Проверяем по справочнику клиент-менеджер из API
    const clientInfo = clientManagerDirectory[clientCode];
    if (!clientInfo) {
      // Если клиента нет в справочнике API, используем старую логику как fallback
      return passesFiltersOldLogic(sale);
    }
    
    // Если выбран конкретный менеджер - проверяем что клиент принадлежит этому менеджеру по справочнику
    if (currentManager) {
      const managerName = getManagerName(currentManager);
      if (!managerName || !clientInfo.manager) {
        return false;
      }
      
      // Проверяем что клиент принадлежит выбранному менеджеру согласно справочнику
      return clientInfo.manager.trim() === managerName.trim();
    }
    
    // Если выбран только отдел (без конкретного менеджера) - проверяем что клиент принадлежит менеджеру из этого отдела
    else if (currentDepartment) {
      if (managersData.length > 0) {
        // Режим Firebase: получаем всех менеджеров выбранного отдела
        const departmentManagers = managersData.filter(manager => {
          return manager.departmentId === currentDepartment ||
                 manager.department === currentDepartment ||
                 (manager.department && manager.department.id === currentDepartment);
        });
        
        const departmentManagerNames = departmentManagers.map(m => m.name);
        
        // Проверяем, принадлежит ли клиент одному из менеджеров отдела согласно справочнику
        return departmentManagerNames.includes(clientInfo.manager);
      } else {
        // Fallback режим: используем старую логику
        return passesFiltersOldLogic(sale);
      }
    }
    
    return true;
  }
  
  // Старая логика фильтрации как fallback
  function passesFiltersOldLogic(sale) {
    // Создаем объект userAccess аналогично модулю Помічник продажу
    const userAccess = {
      userId: window.state?.currentUserId,
      employeeId: null,
      employee: null,
      role: window.state?.currentUserRole?.toLowerCase(),
      departmentId: window.state?.currentUserDepartment,
      isAdmin: window.state?.isAdmin || false
    };
    
    // Находим сотрудника по userId
    if (userAccess.userId && managersData.length > 0) {
      const currentEmployee = managersData.find(emp => emp.userId === userAccess.userId);
      if (currentEmployee) {
        userAccess.employeeId = currentEmployee.id;
        userAccess.employee = currentEmployee;
        // Определяем departmentId если не задан
        if (!userAccess.departmentId && currentEmployee.department) {
          if (typeof currentEmployee.department === 'object' && currentEmployee.department.id) {
            userAccess.departmentId = currentEmployee.department.id;
          } else if (typeof currentEmployee.department === 'string') {
            userAccess.departmentId = currentEmployee.department;
          }
        }
      }
    }
    
    // Проверяем права доступа к данным
    if (!userAccess.isAdmin) {
      // Проверяем права на просмотр всех алертов компании
      if (window.hasPermission && window.hasPermission('alerts_view_all_clients')) {
        // Пользователь может видеть все алерты - пропускаем
      } else if (window.hasPermission && window.hasPermission('alerts_view_department_clients')) {
        // Пользователь может видеть алерты своего отдела
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser && currentUser.department) {
          const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
          const departmentManagers = managersData.filter(manager => {
            return manager.departmentId === userDeptId ||
                   manager.department === userDeptId ||
                   (manager.department && manager.department.id === userDeptId);
          });
          
          const departmentManagerNames = departmentManagers.map(m => m.name);
          if (!departmentManagerNames.includes(sale['Основной менеджер'])) {
            return false;
          }
        }
      } else if (window.hasPermission && window.hasPermission('alerts_view_manager_clients')) {
        // Пользователь может видеть только своих клиентов
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser && sale['Основной менеджер'] !== currentUser.name) {
          return false;
        }
      } else {
        // Нет прав на просмотр - скрываем все
        return false;
      }
    }
    
    // Если пользователь не админ, применяем дополнительную фильтрацию по ролям
    if (!userAccess.isAdmin && userAccess.employeeId) {
      if (userAccess.role && userAccess.role.includes('менедж')) {
        // Менеджер видит только своих клиентов
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser && sale['Основной менеджер'] !== currentUser.name) {
          return false;
        }
      } else if (userAccess.role && userAccess.role.includes('керівник')) {
        // Руководитель видит клиентов своего отдела
        const currentUser = managersData.find(emp => emp.id === userAccess.employeeId);
        if (currentUser && currentUser.department) {
          const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
          const departmentManagers = managersData.filter(manager => {
            return manager.departmentId === userDeptId ||
                   manager.department === userDeptId ||
                   (manager.department && manager.department.id === userDeptId);
          });
          
          const departmentManagerNames = departmentManagers.map(m => m.name);
          if (!departmentManagerNames.includes(sale['Основной менеджер'])) {
            return false;
          }
        }
      }
    }
    
    // Если выбран конкретный менеджер - фильтруем только по нему
    if (currentManager) {
      if (managersData.length > 0) {
        // Режим Firebase: ищем по ID менеджера
        const manager = managersData.find(m => m.id === currentManager);
        if (!manager || sale['Основной менеджер'] !== manager.name) {
          return false;
        }
      } else {
        // Fallback режим: прямое сравнение имени
        if (sale['Основной менеджер'] !== currentManager) {
          return false;
        }
      }
    }
    // Если выбран только отдел (без конкретного менеджера) - показываем всех менеджеров отдела
    else if (currentDepartment) {
      if (managersData.length > 0) {
        // Режим Firebase: получаем всех менеджеров выбранного отдела
        const departmentManagers = managersData.filter(manager => {
          return manager.departmentId === currentDepartment ||
                 manager.department === currentDepartment ||
                 (manager.department && manager.department.id === currentDepartment);
        });
        
        const departmentManagerNames = departmentManagers.map(m => m.name);
        
        // Проверяем, есть ли менеджер продажи среди менеджеров отдела
        if (!departmentManagerNames.includes(sale['Основной менеджер'])) {
          return false;
        }
      } else {
        // Fallback режим: используем данные из продаж
        const managersInDepartment = [...new Set(masterData.filter(d => d['Відділ'] === currentDepartment).map(d => d['Основной менеджер']))];
        
        if (!managersInDepartment.includes(sale['Основной менеджер'])) {
          return false;
        }
      }
    }
    
    return true;
  }

  function renderTabs() {
    const tabsDiv = window.alertsGet('alerts-tabs-container');
    if (!tabsDiv) return;
    const tabs = [
      {id: 'revenue-drop', label: 'Спад виручки'},
      {id: 'frequency-drop', label: 'Частота'},
      {id: 'avgcheck-drop', label: 'Середній чек'},
      {id: 'missed-forecast', label: 'Прогноз'},
      {id: 'product-drop', label: 'Товари'},
      {id: 'overdue-agreements', label: 'Прострочені домовленості'},
      {id: 'manager-analytics', label: 'Аналітика менеджерів'},
      {id: 'client-reports', label: 'Детальні звіти'}
    ];
    tabsDiv.innerHTML = tabs.map(tab =>
      `<button data-signal-id="${tab.id}" class="signal-tab-btn px-3 py-2 rounded mr-2 ${currentSignal===tab.id?'bg-indigo-600 text-white':'bg-gray-700 text-gray-200 hover:bg-gray-600'}">${tab.label}</button>`
    ).join('');
    
    container.querySelectorAll('.signal-tab-btn').forEach(btn => {
        btn.onclick = () => setSignal(btn.dataset.signalId);
    });
  }

  function setSignal(signal) {
    currentSignal = signal;
    renderTabs();
    renderSignals();
  }

  function renderSignals() {
    // Обновляем дашборд при изменении фильтров
    if (typeof renderDashboard === 'function') {
      renderDashboard();
    } else {
      console.warn('⚠️ Функція renderDashboard не знайдена - пропускаємо оновлення дашборду');
    }
    
    if (currentSignal === 'revenue-drop') {
      renderRevenueDrop();
    } else if (currentSignal === 'frequency-drop') {
      renderFrequencyDrop();
    } else if (currentSignal === 'avgcheck-drop') {
      renderAvgCheckDrop();
    } else if (currentSignal === 'missed-forecast') {
      renderMissedForecast();
    } else if (currentSignal === 'product-drop') {
      renderProductDrop();
    } else if (currentSignal === 'overdue-agreements') {
      renderOverdueAgreements();
    } else if (currentSignal === 'manager-analytics') {
      renderManagerAnalytics();
    } else if (currentSignal === 'client-reports') {
      renderClientReports();
    }
  }



  function renderRevenueDrop() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const prevPeriodMs = periodMs;
    const clients = {};
    masterData.forEach(sale => {
      if (!passesFilters(sale)) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
      if (!clients[code]) clients[code] = { name: getClientName(code, sale['Клиент']), code, now: 0, prev: 0, link: clientLinks[code] };
      if (now - date <= periodMs) clients[code].now += revenue;
      else if (now - date <= periodMs + prevPeriodMs) clients[code].prev += revenue;
    });
    let alerts = Object.values(clients)
      .filter(c => c.prev > 0 && c.now < c.prev * 0.7)
      .sort((a, b) => (a.now/a.prev) - (b.now/b.prev));
    alerts = window.alertsFilterClients(alerts);
    renderTable(alerts, ['Клієнт','Виручка (період)','Було (до)','Зміна','CRM','Статус','Дії','Детальніше'], c => [
      (c.now < c.prev*0.5
        ? `<span title='Критичне падіння' style='vertical-align:middle; margin-right:4px;'>
            <svg width='18' height='18' viewBox='0 0 20 20' fill='red' style='display:inline'><polygon points='10,2 2,18 18,18'/></svg>
          </span>`
        : `<span title='Менш критичне' style='vertical-align:middle; margin-right:4px;'>
            <svg width='18' height='18' viewBox='0 0 20 20' fill='#FFD600' style='display:inline'><polygon points='10,2 2,18 18,18'/></svg>
          </span>`)
      + `<span class='text-gray-200'>${c.name}</span>`,
      c.now.toFixed(2),
      c.prev.toFixed(2),
      ((c.now-c.prev)/c.prev*100).toFixed(1)+'%',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      renderClientStatus(c.code),
      renderActionsMenu(c.code),
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => '');
  }

  function renderFrequencyDrop() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const prevPeriodMs = periodMs;
    const clients = {};
    masterData.forEach(sale => {
      if (!passesFilters(sale)) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      if (!clients[code]) clients[code] = { name: getClientName(code, sale['Клиент']), code, now: [], prev: [], link: clientLinks[code], manager: sale['Основной менеджер'] };
      if (now - date <= periodMs) clients[code].now.push(date);
      else if (now - date <= periodMs + prevPeriodMs) clients[code].prev.push(date);
    });
    // Розрахунок середнього інтервалу
    function avgInterval(dates) {
      if (dates.length < 2) return null;
      // Учитываем только уникальные дни
      const uniqueDays = Array.from(new Set(dates.map(d => d.toISOString().slice(0, 10)))).map(s => new Date(s)).sort((a, b) => a - b);
      if (uniqueDays.length < 2) return null;
      let sum = 0;
      for (let i = 1; i < uniqueDays.length; ++i) sum += (uniqueDays[i] - uniqueDays[i - 1]);
      return sum / (uniqueDays.length - 1);
    }
    let alerts = Object.values(clients).map(c => {
      const nowInt = avgInterval(c.now);
      const prevInt = avgInterval(c.prev);
      return { ...c, nowInt, prevInt };
    }).filter(c => c.prevInt && c.nowInt && c.nowInt > c.prevInt*2);
    alerts = window.alertsFilterClients(alerts).sort((a,b)=>b.nowInt/b.prevInt - a.nowInt/a.prevInt);
    renderTable(alerts, ['Клієнт','Інтервал (днів, зараз)','Було (днів)','Зміна','CRM','Статус','Дії','Детальніше'], c => [
      c.name,
      c.nowInt ? (c.nowInt / (1000 * 60 * 60 * 24)).toFixed(1) : '-',
      c.prevInt ? (c.prevInt / (1000 * 60 * 60 * 24)).toFixed(1) : '-',
      c.prevInt ? (((c.nowInt - c.prevInt) / c.prevInt) * 100).toFixed(1) + '%' : '-',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      renderClientStatus(c.code),
      renderActionsMenu(c.code),
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => c.nowInt > c.prevInt*3 ? 'bg-red-900' : 'bg-yellow-900');

    // --- Chart.js графік ---
    const chartDiv = window.alertsGet('chart-container');
    if (chartDiv && alerts.length > 0) {
      chartDiv.innerHTML = '<canvas id="freqChart" height="120"></canvas>';
      const ctx = window.alertsGet('freqChart').getContext('2d');
      const top = alerts.slice(0, 10);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Зростання інтервалу (днів)',
            data: top.map(c=>c.nowInt-c.prevInt),
            backgroundColor: 'rgba(255,99,132,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  function renderAvgCheckDrop() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const prevPeriodMs = periodMs;
    const clients = {};
    masterData.forEach(sale => {
      if (!passesFilters(sale)) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
      if (!clients[code]) clients[code] = { name: getClientName(code, sale['Клиент']), code, now: [], prev: [], link: clientLinks[code], manager: sale['Основной менеджер'] };
      if (now - date <= periodMs) clients[code].now.push(revenue);
      else if (now - date <= periodMs + prevPeriodMs) clients[code].prev.push(revenue);
    });
    function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
    let alerts = Object.values(clients).map(c => {
      const nowAvg = avg(c.now);
      const prevAvg = avg(c.prev);
      return { ...c, nowAvg, prevAvg };
    }).filter(c => c.prevAvg && c.nowAvg && c.nowAvg < c.prevAvg*0.8);
    alerts = window.alertsFilterClients(alerts).sort((a,b)=>a.nowAvg/a.prevAvg - b.nowAvg/b.prevAvg);
    renderTable(alerts, ['Клієнт','Середній чек (зараз)','Було','Зміна','CRM','Статус','Дії','Детальніше'], c => [
      c.name,
      c.nowAvg ? c.nowAvg.toFixed(2) : '-',
      c.prevAvg ? c.prevAvg.toFixed(2) : '-',
      c.prevAvg ? ((c.nowAvg-c.prevAvg)/c.prevAvg*100).toFixed(1)+'%' : '-',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      renderClientStatus(c.code),
      renderActionsMenu(c.code),
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => c.nowAvg < c.prevAvg*0.6 ? 'bg-red-900' : 'bg-yellow-900');

    // --- Chart.js графік ---
    const chartDiv = window.alertsGet('chart-container');
    if (chartDiv && alerts.length > 0) {
      chartDiv.innerHTML = '<canvas id="avgCheckChart" height="120"></canvas>';
      const ctx = window.alertsGet('avgCheckChart').getContext('2d');
      const top = alerts.slice(0, 10);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Падіння середнього чека',
            data: top.map(c=>c.prevAvg-c.nowAvg),
            backgroundColor: 'rgba(54,162,235,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  function renderMissedForecast() {
    const now = new Date();
    const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
    const clients = {};
    masterData.forEach(sale => {
      if (!passesFilters(sale)) return;
      const code = sale['Клиент.Код'];
      const date = new Date(sale['Дата']);
      if (!clients[code]) clients[code] = { name: getClientName(code, sale['Клиент']), code, dates: [], link: clientLinks[code], manager: sale['Основной менеджер'] };
      if (now - date <= periodMs*2) clients[code].dates.push(date);
    });
    function avgInterval(dates) {
      if (dates.length < 2) return null;
      // Учитываем только уникальные дни
      const uniqueDays = Array.from(new Set(dates.map(d => d.toISOString().slice(0, 10)))).map(s => new Date(s)).sort((a, b) => a - b);
      if (uniqueDays.length < 2) return null;
      let sum = 0;
      for (let i = 1; i < uniqueDays.length; ++i) sum += (uniqueDays[i] - uniqueDays[i - 1]);
      return sum / (uniqueDays.length - 1);
    }
    let alerts = Object.values(clients).map(c => {
      if (c.dates.length < 2) return null;
      c.dates.sort((a,b)=>a-b);
      const last = c.dates[c.dates.length-1];
      const interval = avgInterval(c.dates);
      const forecast = new Date(last.getTime() + interval);
      const hasOrderAfter = c.dates.some(d => d > forecast);
      return (!hasOrderAfter && forecast < now) ? {
        ...c,
        forecast,
        last,
        avgIntervalDays: interval / (1000 * 60 * 60 * 24)
      } : null;
    }).filter(Boolean);
    alerts = window.alertsFilterClients(alerts).sort((a,b)=>b.forecast-a.forecast);
    renderTable(alerts, ['Клієнт','Прогнозована дата','Остання покупка','Середній інтервал (днів)','CRM','Статус','Дії','Детальніше'], c => [
      c.name,
      c.forecast ? c.forecast.toLocaleDateString('uk-UA') : '-',
      c.last ? c.last.toLocaleDateString('uk-UA') : '-',
      c.avgIntervalDays ? c.avgIntervalDays.toFixed(1) : '-',
      c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      renderClientStatus(c.code),
      renderActionsMenu(c.code),
      `<button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button>`
    ], c => c.forecast && c.forecast < now ? 'bg-red-900' : 'bg-yellow-900');

    // --- Chart.js графік ---
    const chartDiv = window.alertsGet('chart-container');
    if (chartDiv && alerts.length > 0) {
      chartDiv.innerHTML = '<canvas id="forecastChart" height="120"></canvas>';
      const ctx = window.alertsGet('forecastChart').getContext('2d');
      const top = alerts.slice(0, 10);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Днів прострочення',
            data: top.map(c=>Math.round((now-c.forecast)/86400000)),
            backgroundColor: 'rgba(255,205,86,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  let productDropPage = 1;
  const PRODUCT_DROP_PAGE_SIZE = 20;

  function renderProductDrop() {
    const now = new Date();
    const monthAgo = new Date(now.getTime());
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const clients = {};
    masterData.forEach(sale => {
      if (!passesFilters(sale)) return;
      const code = sale['Клиент.Код'];
      const product = sale['Номенклатура'];
      const date = new Date(sale['Дата']);
      if (!clients[code]) clients[code] = { name: getClientName(code, sale['Клиент']), code, lostProducts: [], link: clientLinks[code], manager: sale['Основной менеджер'], lastDates: {} };
      if (!clients[code].lastDates[product] || clients[code].lastDates[product] < date) {
        clients[code].lastDates[product] = date;
      }
    });
    // Формуємо масив: [{name, lostProducts: [{product, lastDate}], ...}]
    let clientList = Object.values(clients).map(c => {
      const lost = Object.entries(c.lastDates)
        .filter(([_, lastDate]) => lastDate < monthAgo)
        .map(([product, lastDate]) => ({ product, lastDate }));
      return { ...c, lostProducts: lost };
    }).filter(c => c.lostProducts.length > 0);
    
    clientList = window.alertsFilterClients(clientList).sort((a,b)=>b.lostProducts.length - a.lostProducts.length);

    // Пагінація
    const totalPages = Math.ceil(clientList.length / PRODUCT_DROP_PAGE_SIZE) || 1;
    if (productDropPage > totalPages) productDropPage = totalPages;
    const pageClients = clientList.slice((productDropPage-1)*PRODUCT_DROP_PAGE_SIZE, productDropPage*PRODUCT_DROP_PAGE_SIZE);

    // Таблиця
    const content = window.alertsGet('alerts-content-container');
    if (!content) return;
    content.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-bold">Клієнти, які перестали купувати товари</h2>
        <span class="text-xs text-gray-400">${clientList.length} клієнтів</span>
      </div>
      <div class="mb-4">
        <button onclick="productDropPage=Math.max(1,productDropPage-1);renderProductDrop()" ${productDropPage <= 1 ? 'disabled' : ''} class="px-2 py-1 bg-gray-600 text-white rounded mr-2 ${productDropPage <= 1 ? 'opacity-50' : ''}">← Попередня</button>
        <span class="text-sm text-gray-300">Сторінка ${productDropPage} з ${totalPages}</span>
        <button onclick="productDropPage=Math.min(${totalPages},productDropPage+1);renderProductDrop()" ${productDropPage >= totalPages ? 'disabled' : ''} class="px-2 py-1 bg-gray-600 text-white rounded ml-2 ${productDropPage >= totalPages ? 'opacity-50' : ''}">Наступна →</button>
      </div>
      <table class="min-w-full text-sm mb-4"><thead><tr>
        <th class="px-2 py-1">Клієнт</th><th class="px-2 py-1">Кількість втрачених товарів</th><th class="px-2 py-1">CRM</th><th class="px-2 py-1">Статус</th><th class="px-2 py-1">Дії</th><th class="px-2 py-1">Детальніше</th><th class="px-2 py-1">Товари</th>
      </tr></thead><tbody>
        ${pageClients.map((c, idx) => {
          const safeId = 'lost_products_' + c.code.replace(/[^\w]/g, '_') + '_' + idx;
          return `<tr>
            <td class="px-2 py-1 align-top">${c.name}</td>
            <td class="px-2 py-1 align-top text-center"><span class="px-2 py-1 rounded-full bg-red-600 text-white text-xs">${c.lostProducts.length}</span></td>
            <td class="px-2 py-1 align-top">${c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : ''}</td>
            <td class="px-2 py-1 align-top">${renderClientStatus(c.code)}</td>
            <td class="px-2 py-1 align-top">${renderActionsMenu(c.code)}</td>
            <td class="px-2 py-1 align-top"><button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button></td>
            <td class="px-2 py-1 align-top"><button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.toggleLostProducts('${safeId}')">Показати</button><div id='${safeId}' class='hidden mt-2 text-xs bg-gray-900 rounded p-3 max-h-48 overflow-y-auto'><ul class='list-disc list-inside space-y-1'>${c.lostProducts.map(p=>`<li>${p.product} <span class='text-gray-400'>(${p.lastDate.toISOString().slice(0,10)})</span></li>`).join('')}</ul></div></td>
          </tr>`;
        }).join('')}
      </tbody></table>
    `;
  }

/**
 * Сохранение действия клиента в Firebase
 */
window.saveClientAction = async function(clientCode, actionType) {
  try {
    // Проверяем права доступа
    if (!window.hasPermission || !window.hasPermission('alerts_add_actions')) {
      alert('Помилка: У вас немає прав для додавання дій по алертах');
      return;
    }
    
    const comment = document.getElementById('action-comment')?.value || '';
    const nextAction = document.getElementById('next-action')?.value || '';
    const nextActionDate = document.getElementById('next-action-date')?.value || '';
    const potentialOrderDate = document.getElementById('potential-order-date')?.value || '';
    const potentialAmount = document.getElementById('potential-amount')?.value || '';
    
    // Получаем данные пользователя
    const userId = window.state?.currentUserId;
    const companyId = window.state?.currentCompanyId;
    
    if (!userId || !companyId) {
      alert('Помилка: Не вдалося визначити користувача або компанію');
      return;
    }
    
    // Импортируем Firebase
    const { db, serverTimestamp } = await import('../js/firebase.js');
    
    const now = new Date();
    const actionData = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: actionType,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      comment: comment,
      nextAction: nextAction,
      nextActionDate: nextActionDate,
      status: 'completed',
      userId: userId,
      createdAt: now.toISOString() // Используем обычную дату вместо serverTimestamp для массива
    };
    
    // Обновляем локальные данные
    if (!clientActionsData[clientCode]) {
      clientActionsData[clientCode] = {
        status: 'new',
        actions: [],
        lastActivity: null,
        potentialOrderDate: null,
        expectedAmount: null
      };
    }
    
    clientActionsData[clientCode].actions.push(actionData);
    clientActionsData[clientCode].lastActivity = now.toISOString();
    
    // Автоматически устанавливаем статус "resolved" если есть потенциальный заказ в прошлом
    let newStatus = 'in_progress';
    if (potentialOrderDate) {
      const orderDate = new Date(potentialOrderDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Сбрасываем время для сравнения только дат
      
      if (orderDate < today) {
        newStatus = 'resolved';
      }
    }
    
    clientActionsData[clientCode].status = newStatus;
    clientActionsData[clientCode].updatedAt = serverTimestamp(); // Метка времени на уровне документа
    
    if (potentialOrderDate) {
      clientActionsData[clientCode].potentialOrderDate = potentialOrderDate;
    }
    if (potentialAmount) {
      clientActionsData[clientCode].expectedAmount = parseFloat(potentialAmount);
    }
    
    // Сохраняем в Firebase
    const { collection, doc, setDoc } = await import('../js/firebase.js');
    const docRef = doc(db, 'companies', companyId, 'clientAlerts', clientCode);
    
    await setDoc(docRef, clientActionsData[clientCode], { merge: true });
    
    console.log('✅ Дія збережена успішно:', actionData);
    
    // Обновляем отображение
    renderSignals();
    
    // Показываем уведомление
    showActionNotification('Дія збережена успішно!', 'success');
    
  } catch (error) {
    console.error('❌ Помилка збереження дії:', error);
    showActionNotification('Помилка збереження дії: ' + error.message, 'error');
  }
};

/**
 * Показать уведомление о действии
 */
function showActionNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-[120] px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
    type === 'success' ? 'bg-green-600 text-white' : 
    type === 'error' ? 'bg-red-600 text-white' : 
    'bg-blue-600 text-white'
  }`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

  function renderTable(list, headers, rowFn, rowClassFn) {
    const content = window.alertsGet('alerts-content-container');
    if (!content) return;
    content.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-bold">Клієнти, які перестали купувати товари</h2>
        <span class="text-xs text-gray-400">${clientList.length} клієнтів</span>
      </div>
      <table class="min-w-full text-sm mb-4"><thead><tr>
        <th class="px-2 py-1">Клієнт</th><th class="px-2 py-1">Кількість втрачених товарів</th><th class="px-2 py-1">CRM</th><th class="px-2 py-1">Детальніше</th><th class="px-2 py-1">Товари</th>
      </tr></thead><tbody>
        ${pageClients.map((c, idx) => {
          const safeCode = c.code || c.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
          const rowId = `prodrow_${safeCode}`;
          return `
          <tr class="bg-yellow-900">
            <td class="px-2 py-1 align-top font-bold">${c.name}</td>
            <td class="px-2 py-1 text-center align-top">${c.lostProducts.length}</td>
            <td class="px-2 py-1 align-top">${c.link ? `<a href="${c.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : ''}</td>
            <td class="px-2 py-1 align-top"><button class='px-2 py-1 bg-gray-100 rounded text-black' onclick="window.showClientDetail('${c.code}')">Детальніше</button></td>
            <td class="px-2 py-1 align-top">
              <button class="px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 flex items-center gap-1" onclick="window.toggleLostProductsRow('${rowId}')"><span id='icon_${rowId}'>▼</span> Показати</button>
            </td>
          </tr>
          <tr id="${rowId}" class="hidden">
            <td colspan="5" class="bg-gray-800 text-gray-100 px-4 py-3 rounded-b-xl">
              <div class="font-semibold mb-2">Втрачено товари:</div>
              <ul class="space-y-1">
                ${c.lostProducts.map(lp => `<li>${lp.product}</li>`).join('')}
              </ul>
            </td>
          </tr>`;
        }).join('')}
      </tbody></table>
      <div class="flex justify-between items-center mb-2">
        <button ${productDropPage===1?'disabled':''} onclick="window.productDropPrevPage()" class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Назад</button>
        <span class="text-xs">Сторінка ${productDropPage} з ${totalPages}</span>
        <button ${productDropPage===totalPages?'disabled':''} onclick="window.productDropNextPage()" class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Вперед</button>
      </div>
    `;
    window.toggleLostProductsRow = function(id) {
      const row = window.alertsGet(id);
      if (!row) return;
      row.classList.toggle('hidden');
      const icon = window.alertsGet('icon_' + id);
      if (icon) icon.textContent = row.classList.contains('hidden') ? '▼' : '▲';
    };
    window.productDropPrevPage = function() {
      if (productDropPage > 1) { productDropPage--; renderProductDrop(); }
    };
    window.productDropNextPage = function() {
      if (productDropPage < totalPages) { productDropPage++; renderProductDrop(); }
    };

    // --- Chart.js графік ---
    const chartDiv = window.alertsGet('chart-container');
    if (chartDiv && clientList.length > 0) {
      const top = clientList.slice(0, 10);
      chartDiv.innerHTML = '<canvas id="prodDropChart" height="120"></canvas>';
      const ctx = window.alertsGet('prodDropChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top.map(c=>c.name),
          datasets: [{
            label: 'Втрачені товари',
            data: top.map(c=>c.lostProducts.length),
            backgroundColor: 'rgba(255,99,132,0.5)'
          }]
        },
        options: {responsive:true, plugins:{legend:{display:false}}}
      });
    } else if (chartDiv) {
      chartDiv.innerHTML = '';
    }
  }

  function renderTable(list, headers, rowFn, rowClassFn) {
    const content = window.alertsGet('alerts-content-container');
    if (!content) return;
    content.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-xl font-bold">${getSignalTitle()}</h2>
        <span class="text-xs text-gray-400">${list.length} клієнтів</span>
      </div>
      <table class="min-w-full text-sm mb-4"><thead><tr>
        ${headers.map(h=>`<th class="px-2 py-1">${h}</th>`).join('')}
      </tr></thead><tbody>
        ${list.map(c => `<tr class="${rowClassFn(c)}">${rowFn(c).map(cell => `<td class="px-2 py-1">${cell}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
    `;
  }

  function getSignalTitle() {
    switch(currentSignal) {
      case 'revenue-drop': return 'Клієнти зі спадом виручки >30%';
      case 'frequency-drop': return 'Клієнти з падінням частоти замовлень';
      case 'avgcheck-drop': return 'Клієнти зі зменшенням середнього чека';
      case 'missed-forecast': return 'Клієнти, які не замовили у прогнозовану дату';
      case 'product-drop': return 'Клієнти, які перестали купувати товари';
      default: return '';
    }
  }

  function exportCSV() {
    const content = window.alertsGet('alerts-content-container');
    if (!content) return;
    const table = content.querySelector('table');
    if (!table) return;
    let csv = '';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('th,td');
      csv += Array.from(cells).map(cell => '"'+cell.innerText.replace(/"/g,'""')+'"').join(',') + '\n';
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alerts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // --- Завантаження даних ---
  loadData(); 
  isAlertsInitialized = true;
};

// --- Глобальные вспомогательные функции ---

// Функция для получения названия клиента из справочника
function getClientName(clientCode, fallbackName) {
  // Сначала пробуем взять из справочника API
  if (clientNames[clientCode]) {
    return clientNames[clientCode];
  }
  
  // Fallback на название из данных продаж
  return fallbackName || clientCode;
}

// --- Модалка деталізації по клієнту ---
// Недостающие функции для работы с интерфейсом
window.toggleLostProducts = function(id) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.toggle('hidden');
  }
};

// Залишаємо глобально доступною, бо вона може викликатись з різних місць
window.showClientDetail = function(clientCode) {
    console.log('showClientDetail called for code:', clientCode);
    const oldModal = document.getElementById('client-detail-modal');
    if (oldModal) oldModal.remove();

    const sales = masterData.filter(s => s['Клиент.Код'] === clientCode);
    if (!sales.length) {
        console.log('No sales found for client code:', clientCode);
        return;
    }
  
    const monthMap = {};
    sales.forEach(sale => {
        const date = new Date(sale['Дата']);
        const ym = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
        if (!monthMap[ym]) monthMap[ym] = 0;
        monthMap[ym] += revenue;
    });
    const sortedMonths = Object.keys(monthMap).sort((a, b) => new Date(a + '-01') - new Date(b + '-01'));

    const dates = sales.map(s=>new Date(s['Дата'])).sort((a,b)=>a-b);
    let freqArr = [];
    for (let i=1; i<dates.length; ++i) freqArr.push((dates[i]-dates[i-1])/86400000);

    const avgCheckArr = {};
    sales.forEach(sale => {
        const date = new Date(sale['Дата']);
        const ym = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        const revenue = typeof sale['Выручка'] === 'string' ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : (sale['Выручка'] || 0);
        if (!avgCheckArr[ym]) avgCheckArr[ym] = [];
        avgCheckArr[ym].push(revenue);
    });
    const avgCheckByMonth = Object.fromEntries(Object.entries(avgCheckArr).map(([m, arr]) => [m, arr.reduce((a,b)=>a+b,0)/arr.length]));
    const sortedAvgCheck = sortedMonths.map(m => avgCheckByMonth[m] || null);

    const salesByDate = {};
    sales.forEach(sale => {
        const date = sale['Дата'];
        if (!salesByDate[date]) salesByDate[date] = [];
        salesByDate[date].push(sale);
    });
    const lastDates = Object.keys(salesByDate).sort((a,b)=>new Date(b)-new Date(a)).slice(0,10);

    let modal = document.createElement('div');
    modal.id = 'client-detail-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60'; // Increased z-index
    modal.innerHTML = `
    <div class="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-4xl relative max-h-[95vh] flex flex-col overflow-y-auto animate-fade-in">
      <button id="close-client-detail" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
      <h3 class="text-2xl font-bold text-white mb-6">Деталізація: <span class="text-indigo-400">${sales[0] ? getClientName(clientCode, sales[0]['Клиент']) : ''}</span></h3>
      <div class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Динаміка виручки по місяцях</h4>
          <canvas id="clientRevenueChart" height="100"></canvas>
        </div>
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Динаміка частоти покупок</h4>
          <canvas id="clientFreqChart" height="80"></canvas>
        </div>
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Динаміка середнього чека</h4>
          <canvas id="clientAvgCheckChart" height="80"></canvas>
        </div>
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Останні замовлення</h4>
          <div class="max-h-[200px] overflow-y-auto">
            <table class="min-w-full text-xs bg-gray-800 rounded-lg overflow-hidden"><thead><tr class="bg-gray-700 text-gray-300"><th class="px-3 py-2">Дата</th><th class="px-3 py-2">Сума</th><th class="px-3 py-2">Товари</th></tr></thead><tbody>
              ${lastDates.map(date => {
                const orders = salesByDate[date];
                const total = orders.reduce((sum, s) => sum + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
                const safeId = 'order_' + date.replace(/[^\d]/g, '');
                return `<tr><td class="px-3 py-2 text-gray-200">${date}</td><td class="px-3 py-2 text-green-400">${total.toFixed(2)}</td><td class="px-3 py-2"><button class='px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600' onclick="window.toggleOrderDetail('${safeId}')">Показати</button><div id='${safeId}' class='hidden mt-2 text-xs bg-gray-900 rounded p-3'><ul class='list-disc list-inside space-y-1'>${orders.map(s=>`<li>${s['Номенклатура']} <span class='text-gray-400'>(${typeof s['Выручка'] === 'string' ? s['Выручка'] : (s['Выручка']||0)})</span></li>`).join('')}</ul></div></td></tr>`;
              }).join('')}
            </tbody></table>
          </div>
        </div>
        
        <!-- НОВАЯ СЕКЦИЯ: История действий -->
        <div class="col-span-1 md:col-span-2">
          <h4 class="font-bold mb-3 text-gray-200">Історія дій менеджера</h4>
          <div id="client-actions-history" class="bg-gray-800 rounded-lg p-4 max-h-[300px] overflow-y-auto">
            ${renderClientActionsHistory(clientCode)}
          </div>
        </div>
        
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  window.toggleOrderDetail = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden');
  };
  const close = () => modal.remove();
  document.getElementById('close-client-detail').onclick = close;
  modal.onclick = (e) => {
      if (e.target === modal) close();
  }
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });
  // Графіки
  setTimeout(()=>{
    const revenueCanvas = document.getElementById('clientRevenueChart');
    const freqCanvas = document.getElementById('clientFreqChart');
    const avgCheckCanvas = document.getElementById('clientAvgCheckChart');
    if (revenueChart) revenueChart.destroy();
    if (freqChart) freqChart.destroy();
    if (avgCheckChart) avgCheckChart.destroy();
    if (revenueCanvas) {
      revenueChart = new Chart(revenueCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [{label:'Виручка',data:sortedMonths.map(m=>monthMap[m]),borderColor:'#34d399',backgroundColor:'rgba(52,211,153,0.2)',fill:true}]
        },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
    }
    if (freqCanvas) {
      freqChart = new Chart(freqCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: freqArr.map((_,i)=>i+1),
          datasets: [{label:'Інтервал (днів)',data:freqArr,borderColor:'#fbbf24',backgroundColor:'rgba(251,191,36,0.2)',fill:true}]
        },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
    }
    if (avgCheckCanvas) {
      avgCheckChart = new Chart(avgCheckCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [{label:'Середній чек',data:sortedAvgCheck,borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.2)',fill:true}]
        },
        options: {responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#a1a1aa'}},y:{ticks:{color:'#a1a1aa'}}}}
      });
    }
  }, 100);
}

// Експортуємо функції для використання в інших модулях
window.passesFilters = passesFilters;
window.showClientDetail = showClientDetail;
window.renderActionsMenu = renderActionsMenu;
window.showActionModal = showActionModal;
window.saveClientAction = saveClientAction;
window.showActionNotification = showActionNotification;
window.toggleLostProducts = toggleLostProducts;