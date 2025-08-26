// Модуль сигналізації - сучасний інтерфейс з боковим меню
// Імпортуємо необхідні функції з alerts.js

// 🔥 КОНТРОЛЬНОЕ СООБЩЕНИЕ ДЛЯ ДИАГНОСТИКИ ОБНОВЛЕНИЙ

// Версия файла с исправлениями фильтрации
window.SIGNALIZATION_VERSION = '1754397530740-ACCESS-FILTERING';

// Инициализируем clientActionsData если не существует
if (!window.clientActionsData) {
  window.clientActionsData = {};
}

// Глобальні змінні для стану
let currentTab = 'dashboard';
let signalizationData = null;
let filters = {
  department: '',
  manager: '',
  period: '3',
  status: '',
  search: ''
};

// Глобальні змінні для сумісності з оригінальним модулем
let currentPeriod = 3;
let currentDepartment = '';
let currentManager = '';
let currentStatus = '';
let currentSearch = '';

// Основний контейнер для рендерингу
let mainContainer = null;

// Ініціалізація модуля сигналізації
export async function initSignalizationModule(container) {
  mainContainer = container;
  
  // Показуємо завантаження
  showLoadingState();
  
  try {
    // Завантажуємо дані
    await loadSignalizationData();
    
    // Перевіряємо та оновлюємо статуси клієнтів
    checkAndUpdateClientStatuses();
    
    // Рендеримо інтерфейс (тепер після завантаження даних)
    renderSignalizationInterface();
    
    // Автоматично встановлюємо фільтри по поточному користувачу
    await setupUserFilters();
    
    // Показуємо контент
    showMainContent();
    
    // Експортуємо тільки необхідні функції в глобальну область для сумісності
    window.initSignalizationModule = initSignalizationModule;
    window.passesFilters = passesFilters;
    window.renderTable = renderTable;
    
    // Експортуємо глобальні змінні для сумісності
    window.currentPeriod = currentPeriod;
    window.currentDepartment = currentDepartment;
    window.currentManager = currentManager;
    window.currentStatus = currentStatus;
    window.currentSearch = currentSearch;
    
    
  } catch (error) {
    console.error('Помилка ініціалізації сигналізації:', error);
    showErrorState('Помилка завантаження даних сигналізації');
  }
}

// Завантаження даних
async function loadSignalizationData() {
  try {
    
    // Перевіряємо чи є дані зі старого модуля
    if (window.masterData && window.masterData.length > 0) {
      signalizationData = {
        masterData: window.masterData,
        clientLinks: window.clientLinks || {},
        clientNames: window.clientNames || {},
        clientManagerDirectory: window.clientManagerDirectory || {},
        managersData: window.managersData || [],
        departmentsData: window.departmentsData || [],
        clientActionsData: window.clientActionsData || {}
      };
      
      // Встановлюємо глобальні змінні для сумісності
      window.masterData = signalizationData.masterData;
      window.clientLinks = signalizationData.clientLinks;
      window.clientNames = signalizationData.clientNames;
      window.clientManagerDirectory = signalizationData.clientManagerDirectory;
      window.managersData = signalizationData.managersData;
      window.departmentsData = signalizationData.departmentsData;
      window.clientActionsData = signalizationData.clientActionsData;
    } else {
      
      // Завантажуємо дані з API
      const companyId = window.state?.currentCompanyId;
      
      const promises = [
        fetch('модуль помічник продажу/data.json'),
        fetch('https://fastapi.lookfort.com/nomenclature.analysis'),
        fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url')
      ];
      
      // Завантажуємо дані з Firebase якщо є компанія
      if (companyId) {
        try {
          const firebase = await import('../js/firebase.js');
          promises.push(
            firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'employees')),
            firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'departments')),
            firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'members'))
          );
          
          // Завантажуємо дані про дії клієнтів
          try {
            const clientAlertsSnap = await firebase.getDocs(firebase.collection(firebase.db, 'companies', companyId, 'clientAlerts'));
            const clientActionsData = {};
            clientAlertsSnap.forEach(doc => {
              clientActionsData[doc.id] = doc.data();
            });
            window.clientActionsData = clientActionsData;
          } catch (error) {
            console.warn('⚠️ Помилка завантаження дій клієнтів з Firebase:', error);
            // Пытаемся загрузить из localStorage
            try {
              const localActions = JSON.parse(localStorage.getItem('clientActionsData') || '{}');
              window.clientActionsData = localActions;
            } catch (localError) {
              console.warn('⚠️ Помилка завантаження локальних даних:', localError);
              window.clientActionsData = {};
            }
          }
        } catch (error) {
          console.warn('⚠️ Помилка завантаження Firebase даних:', error);
          // Пытаемся загрузить локальные данные если Firebase недоступен
          try {
            const localActions = JSON.parse(localStorage.getItem('clientActionsData') || '{}');
            window.clientActionsData = localActions;
          } catch (localError) {
            console.warn('⚠️ Помилка завантаження локальних даних:', localError);
            window.clientActionsData = {};
          }
        }
      }
      
      const results = await Promise.all(promises);
      const [dataRes, dataJulyRes, refRes] = results;
      
      const data = await dataRes.json();
      const dataJuly = await dataJulyRes.json();
      const masterData = data.concat(dataJuly);
      const refData = await refRes.json();
      
      // Створюємо структуру даних
      signalizationData = {
        masterData: masterData,
        clientLinks: Object.fromEntries(refData.map(item => [item['Клиент.Код'], item['посилання']])),
        clientNames: Object.fromEntries(refData.map(item => [item['Клиент.Код'], item['Клиент.Название'] || item['Клиент.Код']])),
        clientManagerDirectory: {},
        managersData: [],
        departmentsData: [],
        clientActionsData: window.clientActionsData || {}
      };
      
      // Створюємо повний довідник клієнт-менеджер
      refData.forEach(item => {
        const code = item['Клиент.Код'];
        if (code) {
          signalizationData.clientManagerDirectory[code] = {
            manager: item['Менеджер'],
            link: item['посилання'],
            name: item['Клиент.Название'] || code
          };
        }
      });
      
      // Обробляємо дані Firebase
      if (companyId && results.length > 4) {
        const [, , , employeesSnap, departmentsSnap, membersSnap] = results;
        
        // Завантажуємо members
        const allMembers = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.state = window.state || {};
        window.state.allMembers = allMembers;
        
        // Завантажуємо всіх співробітників і фільтруємо менеджерів
        const allEmployees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Фільтруємо менеджерів за критеріями
        signalizationData.managersData = allEmployees.filter(emp => {
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
        
        // Якщо не знайшли менеджерів за критеріями, використовуємо всіх співробітників
        if (signalizationData.managersData.length === 0) {
          console.warn('🔍 Менеджери не знайдені за критеріями в сигналізації, використовуємо всіх співробітників');
          signalizationData.managersData = allEmployees;
        }
        
        signalizationData.departmentsData = departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      // Встановлюємо глобальні змінні для сумісності
      window.masterData = signalizationData.masterData;
      window.clientLinks = signalizationData.clientLinks;
      window.clientNames = signalizationData.clientNames;
      window.clientManagerDirectory = signalizationData.clientManagerDirectory;
      window.managersData = signalizationData.managersData;
      window.departmentsData = signalizationData.departmentsData;
    }
    
    console.log('✅ Дані сигналізації завантажено:', {
      masterData: signalizationData.masterData.length,
      managersData: signalizationData.managersData.length,
      departmentsData: signalizationData.departmentsData.length,
      clientActionsData: Object.keys(signalizationData.clientActionsData).length
    });
    
  } catch (error) {
    console.error('❌ Помилка завантаження даних сигналізації:', error);
    throw error;
  }
}

// Рендеринг основного інтерфейсу
function renderSignalizationInterface() {
  mainContainer.innerHTML = `
    <div class="signalization-container">
      <!-- Бокове меню -->
      <div class="sidebar-menu" id="sidebar-menu">
        <div class="sidebar-header">
          <h3>Сигналізація</h3>
          <button class="sidebar-toggle" id="sidebar-toggle" title="Згорнути/розгорнути меню">
            <i class="fas fa-chevron-left"></i>
          </button>
        </div>
        
        <nav class="sidebar-nav">
          <button class="nav-btn active" data-tab="dashboard">
            <i class="fas fa-tachometer-alt"></i>
            <span class="nav-text">Головне меню</span>
          </button>
          <button class="nav-btn" data-tab="forecast">
            <i class="fas fa-chart-line"></i>
            <span class="nav-text">Прогноз</span>
          </button>
          <button class="nav-btn" data-tab="revenue-drop">
            <i class="fas fa-chart-area"></i>
            <span class="nav-text">Спад виручки</span>
          </button>
          <button class="nav-btn" data-tab="transferred-clients">
            <i class="fas fa-exchange-alt"></i>
            <span class="nav-text">Передані клієнти</span>
          </button>
          <button class="nav-btn" data-tab="analytics">
            <i class="fas fa-chart-bar"></i>
            <span class="nav-text">Аналітика</span>
          </button>
        </nav>
        
        <!-- Фільтри під кнопками навігації -->
        <div class="sidebar-filters">
          <h4>Фільтри</h4>
          <div class="filter-group">
            <label for="department-filter" class="filter-label">Відділ</label>
            <select id="department-filter" class="filter-select">
              <option value="">Всі відділи</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="manager-filter" class="filter-label">Менеджер</label>
            <select id="manager-filter" class="filter-select">
              <option value="">Всі менеджери</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="period-filter" class="filter-label">Період</label>
            <select id="period-filter" class="filter-select">
              <option value="1">1 місяць</option>
              <option value="3" selected>3 місяці</option>
              <option value="6">6 місяців</option>
              <option value="12">12 місяців</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="status-filter" class="filter-label">Статус</label>
            <select id="status-filter" class="filter-select">
              <option value="">Всі статуси</option>
              <option value="new">🆕 Новий</option>
              <option value="in_progress">🔄 В роботі</option>
              <option value="resolved">✅ Вирішено</option>
              <option value="closed">🗂️ Закрито</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="search-input" class="filter-label">Пошук</label>
            <input id="search-input" type="text" class="filter-input" placeholder="Пошук клієнта...">
          </div>
        </div>
      </div>
      
      <!-- Основний контент -->
      <div class="main-content">
        <div class="content-header">
          <h2 id="content-title">Головне меню</h2>
        </div>
        <div class="content-body" id="content-body">
          <!-- Контент буде рендеритися тут -->
        </div>
      </div>
    </div>
  `;
  
  // Додаємо обробники подій
  setupEventHandlers();
  
  // Рендеримо фільтри
  renderFilters();
  
  // Рендеримо початковий контент
  renderDashboard();
}

// Налаштування обробників подій
function setupEventHandlers() {
  // Обробники для кнопок навігації
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Використовуємо currentTarget замість target для отримання правильного елемента
      const tab = e.currentTarget.dataset.tab;
      if (tab) {
      switchTab(tab);
      } else {
        console.warn('Не знайдено data-tab атрибут у кнопці:', e.currentTarget);
      }
    });
  });
  
  // Обробник для згортання/розгортання бокового меню
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarMenu = document.getElementById('sidebar-menu');
  
  if (sidebarToggle && sidebarMenu) {
    sidebarToggle.addEventListener('click', () => {
      sidebarMenu.classList.toggle('collapsed');
      
      // Змінюємо іконку
      const icon = sidebarToggle.querySelector('i');
      if (sidebarMenu.classList.contains('collapsed')) {
        icon.className = 'fas fa-chevron-right';
      } else {
        icon.className = 'fas fa-chevron-left';
      }
      
      // Відкладаємо тільки перерахунок розмірів після завершення анімації
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    });
  }
  
  // Функція для встановлення event listeners після рендерингу
  function setupDynamicEventListeners() {
    
    // Event listeners для кнопок деталей клієнтів
    document.querySelectorAll('.client-detail-btn').forEach(btn => {
      // Удаляем старые обработчики перед добавлением новых
      btn.removeEventListener('click', btn._detailHandler);
      btn._detailHandler = (e) => {
        const clientCode = e.currentTarget.dataset.clientCode;
        if (clientCode) {
          showClientDetail(clientCode);
        }
      };
      btn.addEventListener('click', btn._detailHandler);
    });
    
    // Event listeners для кнопок перемикання втрачених продуктів
    document.querySelectorAll('.toggle-lost-products-btn').forEach(btn => {
      btn.removeEventListener('click', btn._lostProductsHandler);
      btn._lostProductsHandler = (e) => {
        const elementId = e.currentTarget.dataset.elementId;
        if (elementId) {
          toggleLostProducts(elementId);
        }
      };
      btn.addEventListener('click', btn._lostProductsHandler);
    });
    
    // Event listeners для кнопок перемикання деталей замовлень
    document.querySelectorAll('.toggle-order-detail-btn').forEach(btn => {
      btn.removeEventListener('click', btn._orderDetailHandler);
      btn._orderDetailHandler = (e) => {
        const elementId = e.currentTarget.dataset.elementId;
        if (elementId) {
          const el = document.getElementById(elementId);
          if (el) {
            el.classList.toggle('hidden');
          }
        }
      };
      btn.addEventListener('click', btn._orderDetailHandler);
    });
    
    // Event listeners для кнопок меню дій
    document.querySelectorAll('.actions-menu-toggle').forEach(btn => {
      btn.removeEventListener('click', btn._actionsMenuHandler);
      btn._actionsMenuHandler = (e) => {
        const clientCode = e.currentTarget.dataset.clientCode;
        if (clientCode) {
          toggleActionsMenu(clientCode);
        }
      };
      btn.addEventListener('click', btn._actionsMenuHandler);
    });
    
    // Event listeners для кнопок модальних вікон дій
    document.querySelectorAll('.action-modal-btn').forEach(btn => {
      btn.removeEventListener('click', btn._actionModalHandler);
      btn._actionModalHandler = (e) => {
        const clientCode = e.currentTarget.dataset.clientCode;
        const actionType = e.currentTarget.dataset.actionType;
        if (clientCode && actionType) {
          showActionModal(clientCode, actionType);
        }
      };
      btn.addEventListener('click', btn._actionModalHandler);
    });
    
    // Event listener для кнопки перезавантаження
    document.querySelectorAll('.reload-btn').forEach(btn => {
      btn.removeEventListener('click', btn._reloadHandler);
      btn._reloadHandler = () => {
        location.reload();
      };
      btn.addEventListener('click', btn._reloadHandler);
    });
    
  }
  
  // Викликаємо функцію після рендерингу
  setupDynamicEventListeners();
  
  // Експортуємо функцію для використання в інших місцях
  window.setupDynamicEventListeners = setupDynamicEventListeners;
}

// Рендеринг фільтрів
function renderFilters() {
  
  // Затримка для забезпечення доступності DOM елементів
  setTimeout(() => {
    // Додаємо обробники подій для фільтрів
    const departmentFilter = document.getElementById('department-filter');
    const managerFilter = document.getElementById('manager-filter');
    const periodFilter = document.getElementById('period-filter');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-input');
    
    if (departmentFilter) {
      departmentFilter.addEventListener('change', () => {
        updateManagersFilter();
        applyFilters();
      });
    }
    
    if (managerFilter) {
      managerFilter.addEventListener('change', applyFilters);
    }
    
    if (periodFilter) {
      periodFilter.addEventListener('change', applyFilters);
    }
    
    if (statusFilter) {
      statusFilter.addEventListener('change', applyFilters);
    }
    
    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }
    
    // Заповнюємо фільтри даними
    populateFilters();
  }, 100);
}

// Заповнення фільтрів даними
function populateFilters() {
  
  // Створюємо userAccess аналогічно до alerts.js
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
  
  // Знаходимо співробітника через members
  
  if (window.state?.allMembers && window.state.allMembers.length > 0) {
    const currentMember = window.state.allMembers.find(m => 
      m.userId === userAccess.userId || 
      m.userId === window.state?.currentUserId
    );
    
    if (currentMember && currentMember.employeeId) {
      userAccess.employeeId = currentMember.employeeId;
      
      // Знаходимо employee по employeeId в managersData
      const employee = signalizationData.managersData?.find(emp => emp.id === currentMember.employeeId);
      
      if (employee) {
        userAccess.employee = employee;
        if (!userAccess.departmentId && employee.department) {
          if (typeof employee.department === 'object' && employee.department.id) {
            userAccess.departmentId = employee.department.id;
          } else if (typeof employee.department === 'string') {
            userAccess.departmentId = employee.department;
          }
        }
        
        // Визначаємо role з employee
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
        
      } else {
      }
    } else {
    }
  } else {
  }
  
  
  // Заповнюємо відділи
  const departmentFilter = document.getElementById('department-filter');
  if (departmentFilter && signalizationData.departmentsData) {
    // Очищаємо існуючі опції
    departmentFilter.innerHTML = '<option value="">Всі відділи</option>';
    
    // Фільтруємо відділи за ролями
    let visibleDepartments = signalizationData.departmentsData;
    if (!userAccess.isAdmin && userAccess.departmentId) {
      if (userAccess.role && (userAccess.role.includes('менедж') || userAccess.role.includes('керівник'))) {
        visibleDepartments = signalizationData.departmentsData.filter(dep => dep.id === userAccess.departmentId);
      }
    }
    
    visibleDepartments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name || dept.id;
      departmentFilter.appendChild(option);
    });
  }
  
  // Заповнюємо менеджерів
  const managerFilter = document.getElementById('manager-filter');
  if (managerFilter && signalizationData.managersData) {
    // Очищаємо існуючі опції
    managerFilter.innerHTML = '<option value="">Всі менеджери</option>';
    
    // Фільтруємо менеджерів за вибраним відділом і ролями
    let filteredManagers = signalizationData.managersData;
    
    // Контроль доступу: якщо менеджер — тільки він, якщо керівник — всі з відділу, якщо адмін — всі
    if (!userAccess.isAdmin && userAccess.employeeId) {
      if (userAccess.role && userAccess.role.includes('менедж')) {
        // Тільки сам користувач
        filteredManagers = filteredManagers.filter(emp => emp.id === userAccess.employeeId);
      } else if (userAccess.role && userAccess.role.includes('керівник')) {
        // Всі з його відділу
        filteredManagers = filteredManagers.filter(emp => {
          if (!emp.department) return false;
          if (typeof emp.department === 'object' && emp.department.id) {
            return emp.department.id === userAccess.departmentId;
          } else if (typeof emp.department === 'string') {
            return emp.department === userAccess.departmentId;
          }
          return false;
        });
      }
    }
    
    filteredManagers.forEach(manager => {
      const option = document.createElement('option');
      option.value = manager.id;
      option.textContent = manager.name || manager.fullName || manager.id;
      managerFilter.appendChild(option);
    });
    
    // Автоматично встановлюємо фільтр по поточному користувачу
    if (!userAccess.isAdmin && userAccess.employeeId) {
      if (userAccess.role && userAccess.role.includes('менедж')) {
        // Для менеджера встановлюємо тільки себе
        managerFilter.value = userAccess.employeeId;
        filters.manager = userAccess.employeeId;
      } else if (userAccess.role && userAccess.role.includes('керівник')) {
        // Для керівника встановлюємо його відділ
        if (userAccess.departmentId) {
          departmentFilter.value = userAccess.departmentId;
          filters.department = userAccess.departmentId;
        }
      }
    }
    
    // Оновлюємо глобальні змінні для сумісності
    currentDepartment = filters.department;
    currentManager = filters.manager;
    window.currentDepartment = currentDepartment;
    window.currentManager = currentManager;
  }
}

// Оновлення фільтра менеджерів на основі вибраного відділу
function updateManagersFilter() {
  const departmentFilter = document.getElementById('department-filter');
  const managerFilter = document.getElementById('manager-filter');
  
  if (!departmentFilter || !managerFilter) return;
  
  const selectedDepartment = departmentFilter.value;
  
  // Очищаємо список менеджерів
  managerFilter.innerHTML = '<option value="">Всі менеджери</option>';
  
  // Якщо є дані про менеджерів, фільтруємо їх
  if (signalizationData.managersData && signalizationData.managersData.length > 0) {
    const filteredManagers = selectedDepartment 
      ? signalizationData.managersData.filter(manager => {
          if (!manager.department) return false;
          if (typeof manager.department === 'object' && manager.department.id) {
            return manager.department.id === selectedDepartment;
          } else if (typeof manager.department === 'string') {
            return manager.department === selectedDepartment;
          }
          return false;
        })
      : signalizationData.managersData;
      
    filteredManagers.forEach(manager => {
      const option = document.createElement('option');
      option.value = manager.id;
      option.textContent = manager.name || manager.fullName || manager.id;
      managerFilter.appendChild(option);
    });
  }
}

// Застосування фільтрів
function applyFilters() {
  
  // Отримуємо значення фільтрів
  const departmentFilter = document.getElementById('department-filter');
  const managerFilter = document.getElementById('manager-filter');
  const periodFilter = document.getElementById('period-filter');
  const statusFilter = document.getElementById('status-filter');
  const searchInput = document.getElementById('search-input');
  
  filters.department = departmentFilter ? departmentFilter.value : '';
  filters.manager = managerFilter ? managerFilter.value : '';
  filters.period = periodFilter ? periodFilter.value : '3';
  filters.status = statusFilter ? statusFilter.value : '';
  filters.search = searchInput ? searchInput.value : '';
  
  // Оновлюємо глобальні змінні для сумісності з оригінальним модулем
  currentDepartment = filters.department;
  currentManager = filters.manager;
  currentPeriod = parseInt(filters.period) || 3;
  currentStatus = filters.status;
  currentSearch = filters.search;
  
  // Оновлюємо глобальні змінні в window
  window.currentPeriod = currentPeriod;
  window.currentDepartment = currentDepartment;
  window.currentManager = currentManager;
  window.currentStatus = currentStatus;
  window.currentSearch = currentSearch;
  
  
  // Оновлюємо контент на основі фільтрів
  const currentTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab');
  if (currentTab) {
    renderTabContent(currentTab);
  }
}

// Рендеринг контенту вкладки з урахуванням фільтрів
function renderTabContent(tab) {
  
  switch(tab) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'forecast':
      renderForecast();
      break;
    case 'revenue-drop':
      renderRevenueDrop();
      break;
    case 'transferred-clients':
      renderTransferredClients();
      break;
    case 'analytics':
      renderAnalytics();
      break;
    default:
      renderDashboard();
  }
  
  // Налаштовуємо обробники подій після рендерингу
  setTimeout(() => {
    if (window.setupDynamicEventListeners) {
      window.setupDynamicEventListeners();
    }
  }, 100);
}

// Перемикання між вкладками
function switchTab(tab) {
  currentTab = tab;
  
  // Оновлюємо активну кнопку
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Безпечно додаємо активний клас
  const activeButton = document.querySelector(`[data-tab="${tab}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  } else {
    console.warn(`Кнопка з data-tab="${tab}" не знайдена`);
  }
  
  // Оновлюємо заголовок
  const titles = {
    'dashboard': 'Головне меню',
    'forecast': 'Прогноз',
    'revenue-drop': 'Спад виручки',
    'transferred-clients': 'Передані клієнти',
    'analytics': 'Аналітика'
  };
  
  const contentTitle = document.getElementById('content-title');
  if (contentTitle) {
    contentTitle.textContent = titles[tab];
  }
  
  // Рендеримо відповідний контент
  renderTabContent(tab);
}

// Глобальні змінні для AI-рекомендацій
let aiRecommendations = [];
let lastRecommendationUpdate = null;

// Рендеринг головного меню (Dashboard)
function renderDashboard() {
  const contentBody = document.getElementById('content-body');
  
  // Отримуємо статистику
  const stats = calculateDashboardStats();
  
  // Генеруємо AI-рекомендації якщо потрібно
  if (!aiRecommendations.length || !lastRecommendationUpdate || 
      (new Date() - lastRecommendationUpdate) > 300000) { // 5 хвилин
    generateAIRecommendations();
  }
  
  contentBody.innerHTML = `
    <div class="dashboard-grid">
      <!-- Картка з кількістю клієнтів -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>Клієнти в роботі</h3>
          <i class="fas fa-users"></i>
        </div>
        <div class="card-content">
          <div class="metric-value">${stats.activeClients}</div>
          <div class="metric-label">активних клієнтів</div>
        </div>
      </div>
      
      <!-- Картка з пріоритетними сигналами -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>Пріоритетні сигнали</h3>
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="card-content">
          <div class="metric-value">${stats.prioritySignals}</div>
          <div class="metric-label">критичних сигналів</div>
        </div>
      </div>
      
      <!-- Картка з топ спадів виручки -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>Топ спадів виручки</h3>
          <i class="fas fa-chart-area"></i>
        </div>
        <div class="card-content">
          <div class="metric-value">${stats.revenueDrops}</div>
          <div class="metric-label">клієнтів зі спадом</div>
        </div>
      </div>
      
      <!-- Картка з простроченими домовленостями -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>Прострочені домовленості</h3>
          <i class="fas fa-clock"></i>
        </div>
        <div class="card-content">
          <div class="metric-value">${stats.overdueAgreements}</div>
          <div class="metric-label">прострочених угод</div>
        </div>
      </div>
    </div>
    
    <!-- AI Рекомендації -->
    <div class="mt-6">
      ${renderAIRecommendationsWidget()}
    </div>
  `;
}

// Розрахунок статистики для головного меню
function calculateDashboardStats() {
  // Сбрасываем счетчик логирования для новых диагностик
  hasAccessDebugCount = 0;
  if (!signalizationData || !signalizationData.masterData) {
    return {
      activeClients: 0,
      prioritySignals: 0,
      revenueDrops: 0,
      overdueAgreements: 0
    };
  }
  
  // Отримуємо userAccess для фільтрації
  const userAccess = getUserAccess();
  
  // Підраховуємо активних клієнтів (з фільтрацією доступу)
  const activeClients = new Set();
  signalizationData.masterData.forEach(sale => {
    if (sale['Клиент.Код'] && hasAccessToClient(sale['Клиент.Код'], userAccess)) {
      activeClients.add(sale['Клиент.Код']);
    }
  });
  
  // Аналізуємо спад виручки (тепер з фільтрацією)
  const revenueDrops = analyzeRevenueDropsFiltered(userAccess);
  
  // Підраховуємо пріоритетні сигнали (клієнти зі статусом "new") з фільтрацією
  let prioritySignals = 0;
  Object.keys(signalizationData.clientActionsData).forEach(clientCode => {
    if (hasAccessToClient(clientCode, userAccess)) {
      const status = signalizationData.clientActionsData[clientCode]?.status;
      if (status === 'new') {
        prioritySignals++;
      }
    }
  });
  
  // Підраховуємо прострочені домовленості (заглушка)
  const overdueAgreements = Math.floor(Math.random() * 10) + 5; // Тимчасово
  

  return {
    activeClients: activeClients.size,
    prioritySignals,
    revenueDrops: revenueDrops.clientsCount,
    overdueAgreements
  };
}

// Рендеринг прогнозу
function renderForecast() {
  const contentBody = document.getElementById('content-body');
  contentBody.innerHTML = `
    <div class="forecast-container">
      <div class="forecast-tabs">
        <button class="forecast-tab-btn active" data-forecast="missed">Пропущений прогноз</button>
        <button class="forecast-tab-btn" data-forecast="products">Спад продуктів</button>
      </div>
      
      <div class="forecast-content">
        <div id="missed-forecast-content" class="forecast-tab-content active">
          <!-- Контент пропущеного прогнозу -->
        </div>
        <div id="products-forecast-content" class="forecast-tab-content">
          <!-- Контент спаду продуктів -->
        </div>
      </div>
    </div>
  `;
  
  // Рендеримо початковий контент
  renderMissedForecast();
  
  // Додаємо обробники для вкладок прогнозу
  document.querySelectorAll('.forecast-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const forecastType = e.currentTarget.dataset.forecast;
      if (forecastType) {
      switchForecastTab(forecastType);
      } else {
        console.warn('Не знайдено data-forecast атрибут у кнопці:', e.currentTarget);
      }
    });
  });
}

// Перемикання вкладок прогнозу
function switchForecastTab(forecastType) {
  // Оновлюємо активну вкладку
  document.querySelectorAll('.forecast-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Безпечно додаємо активний клас
  const activeButton = document.querySelector(`[data-forecast="${forecastType}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  } else {
    console.warn(`Кнопка з data-forecast="${forecastType}" не знайдена`);
  }
  
  // Оновлюємо контент
  document.querySelectorAll('.forecast-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  if (forecastType === 'missed') {
    const missedContent = document.getElementById('missed-forecast-content');
    if (missedContent) {
      missedContent.classList.add('active');
    renderMissedForecast();
    }
  } else if (forecastType === 'products') {
    const productsContent = document.getElementById('products-forecast-content');
    if (productsContent) {
      productsContent.classList.add('active');
    renderProductDrop();
    }
  }
}

// Кэш для оптимизации производительности
let missedForecastCache = null;
let lastFilterHash = null;

// Рендеринг пропущеного прогнозу
function renderMissedForecast() {
  const contentDiv = document.getElementById('missed-forecast-content');
  if (!contentDiv) return;
  
  const filteredData = getFilteredData();
  if (!filteredData || filteredData.length === 0) {
    contentDiv.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }
  
  // Создаем хеш текущих фильтров для проверки кэша
  const currentFilterHash = JSON.stringify({
    period: filters.period,
    department: filters.department,
    manager: filters.manager,
    status: filters.status,
    search: filters.search
  });
  
  // Если данные не изменились, используем кэш
  if (missedForecastCache && lastFilterHash === currentFilterHash) {
    contentDiv.innerHTML = missedForecastCache;
    return;
  }
  
  const now = new Date();
  const periodMs = parseInt(filters.period || 3) * 30 * 24 * 60 * 60 * 1000;
  const clients = {};
  
  filteredData.forEach(sale => {
    const code = sale['Клиент.Код'];
    const date = new Date(sale['Дата']);
    if (!clients[code]) {
      clients[code] = { 
        name: signalizationData.clientNames[code] || code, 
        code, 
        dates: [], 
        link: signalizationData.clientLinks[code], 
        manager: signalizationData.clientManagerDirectory[code]?.manager || 'Невідомий' 
      };
    }
    if (now - date <= periodMs * 2) clients[code].dates.push(date);
  });
  
  function avgInterval(dates) {
    if (dates.length < 2) return null;
    // Враховуємо тільки унікальні дні
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
  
  // Сортуємо по даті прогнозу
  alerts.sort((a,b)=>b.forecast-a.forecast);
  
  contentDiv.innerHTML = `
    <div class="missed-forecast-section">
      <h4>Пропущені прогнози</h4>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Клієнти з пропущеними прогнозами</div>
          <div class="metric-value">${alerts.length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Середній інтервал</div>
          <div class="metric-value">${alerts.length > 0 ? (alerts.reduce((sum, a) => sum + a.avgIntervalDays, 0) / alerts.length).toFixed(1) : 0} днів</div>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Клієнт</th>
              <th>Менеджер</th>
              <th>Прогнозована дата</th>
              <th>Остання покупка</th>
              <th>Середній інтервал (днів)</th>
              <th>CRM</th>
              <th>Статус</th>
              <th>Дії</th>
              <th>Детальніше</th>
            </tr>
          </thead>
          <tbody>
            ${alerts.map(client => `
              <tr class="${client.forecast && client.forecast < now ? 'bg-red-900' : 'bg-yellow-900'}">
                <td>${client.name}</td>
                <td>${client.manager}</td>
                <td>${client.forecast ? client.forecast.toLocaleDateString('uk-UA') : '-'}</td>
                <td>${client.last ? client.last.toLocaleDateString('uk-UA') : '-'}</td>
                <td>${client.avgIntervalDays ? client.avgIntervalDays.toFixed(1) : '-'}</td>
                <td>${client.link ? `<a href="${client.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : ''}</td>
                <td>${renderClientStatus(client.code)}</td>
                <td>${renderActionsMenu(client.code)}</td>
                <td><button class='px-2 py-1 bg-gray-100 rounded text-black client-detail-btn' data-client-code="${client.code}">Детальніше</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  // Сохраняем результат в кэш
  missedForecastCache = contentDiv.innerHTML;
  lastFilterHash = currentFilterHash;
  
  // Встановлюємо event listeners після рендерингу
  if (window.setupDynamicEventListeners) {
    window.setupDynamicEventListeners();
  }
}

// Кэш для спаду продуктів
let productDropCache = null;
let lastProductFilterHash = null;

// Рендеринг спаду продуктів
function renderProductDrop() {
  const contentDiv = document.getElementById('products-forecast-content');
  if (!contentDiv) return;
  
  const filteredData = getFilteredData();
  if (!filteredData || filteredData.length === 0) {
    contentDiv.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }
  
  // Создаем хеш текущих фильтров для проверки кэша
  const currentProductFilterHash = JSON.stringify({
    period: filters.period,
    department: filters.department,
    manager: filters.manager,
    status: filters.status,
    search: filters.search
  });
  
  // Если данные не изменились, используем кэш
  if (productDropCache && lastProductFilterHash === currentProductFilterHash) {
    contentDiv.innerHTML = productDropCache;
    return;
  }
  
  const now = new Date();
  const monthAgo = new Date(now.getTime());
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const clients = {};
  
  filteredData.forEach(sale => {
    const code = sale['Клиент.Код'];
    const product = sale['Номенклатура'];
    const date = new Date(sale['Дата']);
    if (!clients[code]) {
      clients[code] = { 
        name: signalizationData.clientNames[code] || code, 
        code, 
        lostProducts: [], 
        link: signalizationData.clientLinks[code], 
        manager: signalizationData.clientManagerDirectory[code]?.manager || 'Невідомий', 
        lastDates: {} 
      };
    }
    if (!clients[code].lastDates[product] || clients[code].lastDates[product] < date) {
      clients[code].lastDates[product] = date;
    }
  });
  
  // Формуємо масив клієнтів з втраченими продуктами
  let clientList = Object.values(clients).map(c => {
    const lost = Object.entries(c.lastDates)
      .filter(([_, lastDate]) => lastDate < monthAgo)
      .map(([product, lastDate]) => ({ product, lastDate }));
    return { ...c, lostProducts: lost };
  }).filter(c => c.lostProducts.length > 0);
  
  // Сортуємо по кількості втрачених продуктів
  clientList.sort((a,b)=>b.lostProducts.length - a.lostProducts.length);
  
  contentDiv.innerHTML = `
    <div class="product-drop-section">
      <h4>Спад продуктів</h4>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Клієнти з втраченими продуктами</div>
          <div class="metric-value">${clientList.length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Середня кількість втрачених продуктів</div>
          <div class="metric-value">${clientList.length > 0 ? (clientList.reduce((sum, c) => sum + c.lostProducts.length, 0) / clientList.length).toFixed(1) : 0}</div>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Клієнт</th>
              <th>Менеджер</th>
              <th>Втрачені продукти</th>
              <th>Остання дата</th>
              <th>CRM</th>
              <th>Статус</th>
              <th>Дії</th>
              <th>Детальніше</th>
              <th>Товари</th>
            </tr>
          </thead>
          <tbody>
            ${clientList.map((client, idx) => {
              const safeId = 'lost_products_' + client.code.replace(/[^\w]/g, '_') + '_' + idx;
              return `
                <tr>
                  <td>${client.name}</td>
                  <td>${client.manager}</td>
                  <td><span class="px-2 py-1 rounded-full bg-red-600 text-white text-xs">${client.lostProducts.length}</span></td>
                  <td>${client.lostProducts.length > 0 ? client.lostProducts[0].lastDate.toLocaleDateString('uk-UA') : '-'}</td>
                  <td>${client.link ? `<a href="${client.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : ''}</td>
                  <td>${renderClientStatus(client.code)}</td>
                  <td>${renderActionsMenu(client.code)}</td>
                  <td><button class='px-2 py-1 bg-gray-100 rounded text-black client-detail-btn' data-client-code="${client.code}">Детальніше</button></td>
                  <td><button class='px-2 py-1 bg-gray-100 rounded text-black toggle-lost-products-btn' data-element-id="${safeId}">Показати</button>
                    <div id='${safeId}' class='hidden mt-2 text-xs bg-gray-900 rounded p-3 max-h-48 overflow-y-auto'>
                      <ul class='list-disc list-inside space-y-1'>
                        ${client.lostProducts.map(p=>`<li>${p.product} <span class='text-gray-400'>(${p.lastDate.toISOString().slice(0,10)})</span></li>`).join('')}
                      </ul>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  // Сохраняем результат в кэш
  productDropCache = contentDiv.innerHTML;
  lastProductFilterHash = currentProductFilterHash;
  
  // Встановлюємо event listeners після рендерингу
  if (window.setupDynamicEventListeners) {
    window.setupDynamicEventListeners();
  }
}

// Рендеринг аналітики
function renderAnalytics() {
  const contentBody = document.getElementById('content-body');
  contentBody.innerHTML = `
    <div class="analytics-container">
      <!-- Фільтри під меню вкладок -->
      <div class="analytics-filters">
        <div class="filter-row">
          <div class="filter-group">
            <label for="department-filter">Відділ:</label>
            <select id="department-filter" class="filter-select">
              <option value="">Всі відділи</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label for="manager-filter">Менеджер:</label>
            <select id="manager-filter" class="filter-select">
              <option value="">Всі менеджери</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label for="period-filter">Період:</label>
            <select id="period-filter" class="filter-select">
              <option value="1">1 місяць</option>
              <option value="2">2 місяці</option>
              <option value="3" selected>3 місяці</option>
              <option value="6">6 місяців</option>
              <option value="12">12 місяців</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label for="status-filter">Статус:</label>
            <select id="status-filter" class="filter-select">
              <option value="">Всі статуси</option>
              <option value="new">Новий</option>
              <option value="in_progress">В роботі</option>
              <option value="completed">Завершено</option>
              <option value="cancelled">Скасовано</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label for="search-input">Пошук:</label>
            <input type="text" id="search-input" class="filter-input" placeholder="Пошук клієнтів...">
          </div>
        </div>
      </div>
      
      <div class="analytics-tabs">
        <button class="analytics-tab-btn active" data-analytics="overdue">Прострочені домовленості</button>
        <button class="analytics-tab-btn" data-analytics="managers">Аналітика менеджерів</button>
        <button class="analytics-tab-btn" data-analytics="reports">Детальні звіти</button>
      </div>
      
      <div class="analytics-content">
        <div id="overdue-analytics-content" class="analytics-tab-content active">
          <!-- Контент прострочених домовленостей -->
        </div>
        <div id="managers-analytics-content" class="analytics-tab-content">
          <!-- Контент аналітики менеджерів -->
        </div>
        <div id="reports-analytics-content" class="analytics-tab-content">
          <!-- Контент детальних звітів -->
        </div>
      </div>
    </div>
  `;
  
  // Рендеримо фільтри
  renderFilters();
  
  // Рендеримо початковий контент
  renderOverdueAgreements();
  
  // Додаємо обробники для вкладок аналітики
  document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const analyticsType = e.currentTarget.dataset.analytics;
      if (analyticsType) {
      switchAnalyticsTab(analyticsType);
      } else {
        console.warn('Не знайдено data-analytics атрибут у кнопці:', e.currentTarget);
      }
    });
  });
}

// Перемикання вкладок аналітики
function switchAnalyticsTab(analyticsType) {
  // Оновлюємо активну вкладку
  document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Безпечно додаємо активний клас
  const activeButton = document.querySelector(`[data-analytics="${analyticsType}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  } else {
    console.warn(`Кнопка з data-analytics="${analyticsType}" не знайдена`);
  }
  
  // Оновлюємо контент
  document.querySelectorAll('.analytics-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  if (analyticsType === 'overdue') {
    const overdueContent = document.getElementById('overdue-analytics-content');
    if (overdueContent) {
      overdueContent.classList.add('active');
    renderOverdueAgreements();
    }
  } else if (analyticsType === 'managers') {
    const managersContent = document.getElementById('managers-analytics-content');
    if (managersContent) {
      managersContent.classList.add('active');
    renderManagerAnalytics();
    }
  } else if (analyticsType === 'reports') {
    const reportsContent = document.getElementById('reports-analytics-content');
    if (reportsContent) {
      reportsContent.classList.add('active');
    renderClientReports();
    }
  }
}

// Рендеринг прострочених домовленостей
function renderOverdueAgreements() {
  const contentDiv = document.getElementById('overdue-analytics-content');
  if (!contentDiv) return;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Збираємо всіх клієнтів з простроченими діями
  const overdueClients = [];
  
  Object.keys(signalizationData.clientActionsData || {}).forEach(clientCode => {
    const clientData = signalizationData.clientActionsData[clientCode];
    if (!clientData || !clientData.actions) return;
    
    // Знаходимо останні дії з nextActionDate
    const actionsWithDates = clientData.actions.filter(action => 
      action.nextActionDate && action.status !== 'cancelled'
    );
    
    if (actionsWithDates.length === 0) return;
    
    // Сортуємо по даті створення (останні зверху)
    actionsWithDates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Беремо останню заплановану дію
    const latestAction = actionsWithDates[0];
    const actionDate = new Date(latestAction.nextActionDate);
    
    // Перевіряємо, чи прострочена дія
    if (actionDate < today) {
      const daysPastDue = Math.floor((today - actionDate) / (1000 * 60 * 60 * 24));
      
      // Отримуємо інформацію про клієнта з продаж або довідника
      const clientName = getClientName(clientCode, clientCode);
      const clientLink = signalizationData.clientLinks[clientCode];
      
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
  
  // Сортуємо по кількості прострочених днів (найбільш прострочені зверху)
  const sortedOverdue = overdueClients.sort((a, b) => b.daysPastDue - a.daysPastDue);
  
  // Застосовуємо фільтрацію
  const filteredOverdue = sortedOverdue.filter(client => {
    if (filters.search && !client.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.status && client.status !== filters.status) {
      return false;
    }
    return true;
  });
  
  if (filteredOverdue.length === 0) {
    contentDiv.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">🎉</div>
        <h2 class="text-2xl font-bold text-white mb-2">Відмінно! Немає прострочених домовленостей</h2>
        <p class="text-gray-400">Всі заплановані дії виконані вчасно або ще не прострочені</p>
      </div>
    `;
    return;
  }
  
  contentDiv.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-white">Прострочені домовленості</h2>
        <p class="text-gray-400 mt-1">Клієнти з простроченими запланованими діями</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-sm text-gray-300">
          <span class="text-red-400 font-semibold">${filteredOverdue.length}</span> 
          ${filteredOverdue.length === 1 ? 'прострочена домовленість' : 
            filteredOverdue.length < 5 ? 'прострочені домовленості' : 'прострочених домовленостей'}
        </div>
      </div>
    </div>
    
    <!-- Опис статусів -->
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
                          onclick="showClientDetail('${client.code}')">
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

// Рендеринг аналітики менеджерів
function renderManagerAnalytics() {
  const contentDiv = document.getElementById('managers-analytics-content');
  if (!contentDiv) return;
  
  // Збираємо статистику по менеджерах
  const managerStats = {};
  
  // Ініціалізуємо статистику для всіх менеджерів
  signalizationData.managersData.forEach(manager => {
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
  
  // Аналізуємо дані по клієнтах
  Object.keys(signalizationData.clientActionsData || {}).forEach(clientCode => {
    const clientData = signalizationData.clientActionsData[clientCode];
    if (!clientData || !clientData.actions || clientData.actions.length === 0) return;
    
    // Знаходимо менеджера цього клієнта
    const clientInfo = signalizationData.clientManagerDirectory[clientCode];
    if (!clientInfo || !clientInfo.manager) return;
    
    // Шукаємо менеджера в списку
    const manager = signalizationData.managersData.find(m => m.name === clientInfo.manager);
    if (!manager || !managerStats[manager.id]) return;
    
    const stats = managerStats[manager.id];
    
    // Основна статистика
    stats.totalClients++;
    stats.totalActions += clientData.actions.length;
    
    // Статус клієнта
    const status = clientData.status || 'new';
    if (status === 'in_progress') stats.activeClients++;
    else if (status === 'resolved') stats.resolvedClients++;
    else if (status === 'closed') stats.closedClients++;
    
    // Потенційні замовлення
    if (clientData.potentialOrderDate) {
      stats.potentialOrders++;
      if (clientData.expectedAmount) {
        stats.potentialAmount += clientData.expectedAmount;
      }
    }
    
    // Прострочені дії
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
    
    // Остання активність
    if (clientData.lastActivity) {
      const activityDate = new Date(clientData.lastActivity);
      if (!stats.lastActivityDate || activityDate > stats.lastActivityDate) {
        stats.lastActivityDate = activityDate;
      }
    }
  });
  
  // Обчислюємо похідні метрики
  Object.values(managerStats).forEach(stats => {
    if (stats.totalClients > 0) {
      stats.conversionRate = ((stats.resolvedClients / stats.totalClients) * 100).toFixed(1);
    }
  });
  
  // Сортуємо менеджерів по загальній ефективності
  const sortedManagers = Object.values(managerStats)
    .filter(stats => stats.totalClients > 0)
    .sort((a, b) => {
      // Комплексна оцінка: конверсія * кількість клієнтів - прострочка
      const scoreA = (parseFloat(a.conversionRate) * a.totalClients) - (a.overdueActions * 10);
      const scoreB = (parseFloat(b.conversionRate) * b.totalClients) - (b.overdueActions * 10);
      return scoreB - scoreA;
    });
  
  // Застосовуємо фільтрацію
  const filteredManagers = sortedManagers.filter(manager => {
    if (filters.department) {
      const managerData = signalizationData.managersData.find(m => m.id === manager.id);
      if (managerData) {
        return managerData.departmentId === filters.department ||
               managerData.department === filters.department ||
               (managerData.department && managerData.department.id === filters.department);
      }
      return false;
    }
    if (filters.manager) {
      return manager.id === filters.manager;
    }
    return true;
  });
  
  contentDiv.innerHTML = `
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
      
      <!-- Детальна таблиця -->
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
      
      <!-- Рекомендації -->
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

// Рендеринг детальних звітів
function renderClientReports() {
  const contentDiv = document.getElementById('reports-analytics-content');
  if (!contentDiv) return;
  
  // Збираємо детальну інформацію по всіх клієнтах з діями
  const clientReports = [];
  
  Object.keys(signalizationData.clientActionsData || {}).forEach(clientCode => {
    const clientData = signalizationData.clientActionsData[clientCode];
    if (!clientData || !clientData.actions || clientData.actions.length === 0) return;
    
    const clientInfo = signalizationData.clientManagerDirectory[clientCode];
    const clientName = getClientName(clientCode, clientCode);
    const clientLink = signalizationData.clientLinks[clientCode];
    
    // Аналізуємо дії клієнта
    const actions = [...clientData.actions].sort((a, b) => {
      // Додаємо перевірку на undefined для createdAt
      const dateA = a && a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b && b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });
    const lastAction = actions[0];
    const firstAction = actions[actions.length - 1];
    
    // Статистика по типам дій
    const actionStats = {};
    const actionTypes = ['call', 'meeting', 'email', 'commercial_proposal', 'other'];
    actionTypes.forEach(type => {
      actionStats[type] = actions.filter(a => a.type === type).length;
    });
    
    // Прострочені дії
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdueActions = actions.filter(action => {
      if (!action.nextActionDate || action.status === 'cancelled') return false;
      const actionDate = new Date(action.nextActionDate);
      return actionDate < today;
    });
    
    // Час роботи з клієнтом
    const firstActionDate = firstAction && firstAction.createdAt ? new Date(firstAction.createdAt) : new Date();
    const workingDays = Math.floor((now - firstActionDate) / (1000 * 60 * 60 * 24));
    
    // Ефективність роботи
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
      lastActionDate: lastAction && lastAction.createdAt ? new Date(lastAction.createdAt) : new Date(),
      overdueCount: overdueActions.length,
      actionStats: actionStats,
      isResolved: isResolved,
      isActive: isActive,
      potentialOrderDate: clientData.potentialOrderDate,
      expectedAmount: clientData.expectedAmount,
      lastActivity: clientData.lastActivity
    });
  });
  
  // Застосовуємо фільтрацію
  let filteredReports = clientReports;
  
  if (filters.department || filters.manager) {
    filteredReports = filteredReports.filter(report => {
      if (filters.manager) {
        const manager = signalizationData.managersData.find(m => m.name === report.manager);
        return manager && manager.id === filters.manager;
      }
      if (filters.department) {
        const manager = signalizationData.managersData.find(m => m.name === report.manager);
        if (manager) {
          return manager.departmentId === filters.department ||
                 manager.department === filters.department ||
                 (manager.department && manager.department.id === filters.department);
        }
        return false;
      }
      return true;
    });
  }
  
  if (filters.status) {
    filteredReports = filteredReports.filter(report => report.status === filters.status);
  }
  
  if (filters.search) {
    filteredReports = filteredReports.filter(report => 
      report.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      report.manager.toLowerCase().includes(filters.search.toLowerCase())
    );
  }
  
  // Сортуємо по кількості днів роботи з клієнтом (найбільш "старі" клієнти зверху)
  filteredReports.sort((a, b) => b.workingDays - a.workingDays);
  
  contentDiv.innerHTML = `
          <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-white">Детальні звіти по клієнтах</h2>
          <p class="text-gray-400 mt-1">Повна історія взаємодій та статистика роботи з клієнтами</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-sm text-gray-300">
            <span class="text-blue-400 font-semibold">${filteredReports.length}</span> 
            ${filteredReports.length === 1 ? 'клієнт' : 
              filteredReports.length < 5 ? 'клієнти' : 'клієнтів'} з історією
          </div>
          <button onclick="exportCSV()" 
                  class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
            📊 Експорт CSV
          </button>
        </div>
      </div>
    
    ${filteredReports.length === 0 ? `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">📋</div>
        <h2 class="text-2xl font-bold text-white mb-2">Немає даних для звіту</h2>
        <p class="text-gray-400">Виберіть інші фільтри або дочекайтеся накопичення даних</p>
      </div>
    ` : `
      <!-- Статистика зверху -->
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
      
      <!-- Детальна таблиця -->
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
                              onclick="showClientDetail('${report.code}')">
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
      
      <!-- Аналітика по типах дій -->
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

// Рендеринг спаду виручки
function renderRevenueDrop() {
  const contentBody = document.getElementById('content-body');
  contentBody.innerHTML = `
    <div class="revenue-drop-container">
      <div class="revenue-drop-content">
        <div class="revenue-drop-tabs">
          <button class="revenue-drop-tab active" data-revenue="revenue">Спад виручки</button>
          <button class="revenue-drop-tab" data-revenue="frequency">Частота покупок</button>
          <button class="revenue-drop-tab" data-revenue="avg-check">Середній чек</button>
        </div>
        <div class="revenue-drop-tab-content" id="revenue-drop-tab-content">
          <!-- Контент буде рендеритися тут -->
        </div>
      </div>
    </div>
  `;
  
  // Додаємо обробники для вкладок спаду виручки
  document.querySelectorAll('.revenue-drop-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const revenueType = e.currentTarget.dataset.revenue;
      if (revenueType) {
      switchRevenueDropTab(revenueType);
      } else {
        console.warn('Не знайдено data-revenue атрибут у вкладці:', e.currentTarget);
      }
    });
  });
  
  // Показуємо першу вкладку
  switchRevenueDropTab('revenue');
}

// Перемикання вкладок спаду виручки
function switchRevenueDropTab(revenueType) {
  // Оновлюємо активну вкладку
  document.querySelectorAll('.revenue-drop-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Безпечно додаємо активний клас
  const activeTab = document.querySelector(`[data-revenue="${revenueType}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  } else {
    console.warn(`Вкладка з data-revenue="${revenueType}" не знайдена`);
  }
  
  const contentDiv = document.getElementById('revenue-drop-tab-content');
  
  switch(revenueType) {
    case 'revenue':
      renderRevenueDropData();
      break;
    case 'frequency':
      renderFrequencyDropData();
      break;
    case 'avg-check':
      renderAvgCheckDropData();
      break;
  }
}

// Рендеринг даних спаду виручки
function renderRevenueDropData() {
  const contentDiv = document.getElementById('revenue-drop-tab-content');
  

  
  if (!signalizationData || !signalizationData.masterData) {
    contentDiv.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }
  
  // Аналізуємо дані для спаду виручки
  const revenueDrops = analyzeRevenueDrops();
  
  // Используем renderTable для унификации
  
  renderTable(
    revenueDrops.clients,
    ['Клієнт', 'Виручка (зараз)', 'Було (до)', 'Зміна', 'CRM', 'Статус', 'Дії', 'Детальніше'],
    client => {
      return [
        (client.now < client.prev*0.5
                    ? `<span title='Критичне падіння' style='vertical-align:middle; margin-right:4px;'>
                        <svg width='18' height='18' viewBox='0 0 20 20' fill='red' style='display:inline'><polygon points='10,2 2,18 18,18'/></svg>
                      </span>`
                    : `<span title='Менш критичне' style='vertical-align:middle; margin-right:4px;'>
                        <svg width='18' height='18' viewBox='0 20 20' fill='#FFD600' style='display:inline'><polygon points='10,2 2,18 18,18'/></svg>
            </span>`)
        + `<span class='text-gray-200'>${client.name}</span>`,
        client.now.toFixed(2),
        client.prev.toFixed(2),
        `<span class="${client.dropPercent > 0 ? 'text-red-500' : 'text-green-500'}">${client.dropPercent.toFixed(1)}%</span>`,
        client.link ? `<a href="${client.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
        renderClientStatus(client.code),
        renderActionsMenu(client.code),
        `<button class='px-2 py-1 bg-gray-100 rounded text-black client-detail-btn' data-client-code="${client.code}">Детальніше</button>`
      ];
    },
    client => ''
  );
}

// Рендеринг даних зменшення частоти покупок
function renderFrequencyDropData() {
  const contentDiv = document.getElementById('revenue-drop-tab-content');
  
  if (!signalizationData || !signalizationData.masterData) {
    contentDiv.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }
  
  // Аналізуємо дані для зменшення частоти
  const frequencyDrops = analyzeFrequencyDrops();
  
  // Используем renderTable для унификации
  renderTable(
    frequencyDrops.clients,
    ['Клієнт', 'Інтервал (днів, зараз)', 'Було (днів)', 'Зміна', 'CRM', 'Статус', 'Дії', 'Детальніше'],
    client => [
      client.name,
      client.nowInt ? (client.nowInt / (1000 * 60 * 60 * 24)).toFixed(1) : '-',
      client.prevInt ? (client.prevInt / (1000 * 60 * 60 * 24)).toFixed(1) : '-',
      `<span class="${client.dropPercent > 0 ? 'text-red-500' : 'text-green-500'}">${client.dropPercent.toFixed(1)}%</span>`,
      client.link ? `<a href="${client.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      renderClientStatus(client.code),
      renderActionsMenu(client.code),
      `<button class='px-2 py-1 bg-gray-100 rounded text-black client-detail-btn' data-client-code="${client.code}">Детальніше</button>`
    ],
    client => client.nowInt > client.prevInt*3 ? 'bg-red-900' : 'bg-yellow-900'
  );
}

// Рендеринг даних зменшення середнього чека
function renderAvgCheckDropData() {
  const contentDiv = document.getElementById('revenue-drop-tab-content');
  
  if (!signalizationData || !signalizationData.masterData) {
    contentDiv.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }
  
  // Аналізуємо дані для середнього чека
  const avgCheckDrops = analyzeAvgCheckDrops();
  
  // Используем renderTable для унификации
  renderTable(
    avgCheckDrops.clients,
    ['Клієнт', 'Середній чек (зараз)', 'Було', 'Зміна', 'CRM', 'Статус', 'Дії', 'Детальніше'],
    client => [
      client.name,
      client.nowAvg ? client.nowAvg.toFixed(2) : '-',
      client.prevAvg ? client.prevAvg.toFixed(2) : '-',
      `<span class="${client.change > 0 ? 'text-red-500' : 'text-green-500'}">${client.change.toFixed(1)}%</span>`,
      client.link ? `<a href="${client.link}" target="_blank" class="text-blue-600 underline">CRM</a>` : '',
      renderClientStatus(client.code),
      renderActionsMenu(client.code),
      `<button class='px-2 py-1 bg-gray-100 rounded text-black client-detail-btn' data-client-code="${client.code}">Детальніше</button>`
    ],
    client => client.nowAvg < client.prevAvg*0.6 ? 'bg-red-900' : 'bg-yellow-900'
  );
}

// Рендеринг переданих клієнтів (заглушка)
function renderTransferredClients() {
  const contentBody = document.getElementById('content-body');
  
  if (!signalizationData || !signalizationData.masterData) {
    contentBody.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }
  
  // Аналізуємо передачі клієнтів
  const transfers = analyzeClientTransfers();
  
  contentBody.innerHTML = `
    <div class="transferred-clients-container">
      <div class="transferred-clients-content">
        <div class="transferred-clients-tabs">
          <button class="transferred-clients-tab active" data-transfer="list">Передані клієнти</button>
          <button class="transferred-clients-tab" data-transfer="statistics">Статистика</button>
        </div>
        <div class="transferred-clients-tab-content" id="transferred-clients-tab-content">
          <!-- Контент буде рендеритися тут -->
        </div>
      </div>
    </div>
  `;
  
  // Додаємо обробники для вкладок передач
  document.querySelectorAll('.transferred-clients-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const transferType = e.currentTarget.dataset.transfer;
      if (transferType) {
        switchTransferredClientsTab(transferType);
      } else {
        console.warn('Не знайдено data-transfer атрибут у вкладці:', e.currentTarget);
      }
    });
  });
  
  // Показуємо першу вкладку
  switchTransferredClientsTab('list');
}

// Аналіз передач клієнтів між менеджерами
function analyzeClientTransfers() {
  if (!signalizationData || !signalizationData.masterData) {
    return [];
  }
  
  const now = new Date();
  // currentPeriod = 3 означает 3 месяца (90 дней)
  // periodMs - это период в миллисекундах для фильтрации передач
  const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
  const transfers = [];
  
  // Групуємо продажі по клієнтах та періодах
  const clientSales = {};
  
  signalizationData.masterData.forEach(sale => {
    if (!passesFilters || !passesFilters(sale)) return;
    
    const clientCode = sale['Клиент.Код'];
    const date = new Date(sale['Дата']);
    const manager = sale['Основной менеджер'];
    
    if (!clientSales[clientCode]) {
      clientSales[clientCode] = [];
    }
    
    clientSales[clientCode].push({
      date,
      manager,
      revenue: typeof sale['Выручка'] === 'string' ? 
        parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : 
        (sale['Выручка'] || 0)
    });
  });
  
  // Аналізуємо зміни менеджерів для кожного клієнта
  Object.keys(clientSales).forEach(clientCode => {
    const sales = clientSales[clientCode].sort((a, b) => a.date - b.date);
    
    // Групуємо по менеджерам та знаходимо періоди роботи
    const managerPeriods = [];
    let currentManager = null;
    let periodStart = null;
    
    sales.forEach(sale => {
      if (sale.manager !== currentManager) {
        // Закриваємо попередній період
        if (currentManager && periodStart) {
          managerPeriods.push({
            manager: currentManager,
            start: periodStart,
            end: sale.date,
            sales: sales.filter(s => 
              s.manager === currentManager && 
              s.date >= periodStart && 
              s.date < sale.date
            )
          });
        }
        
        // Починаємо новий період
        currentManager = sale.manager;
        periodStart = sale.date;
      }
    });
    
    // Закриваємо останній період
    if (currentManager && periodStart) {
      managerPeriods.push({
        manager: currentManager,
        start: periodStart,
        end: now,
        sales: sales.filter(s => 
          s.manager === currentManager && 
          s.date >= periodStart
        )
      });
    }
    
    // Знаходимо передачі (коли менеджер змінюється)
    for (let i = 1; i < managerPeriods.length; i++) {
      const prevPeriod = managerPeriods[i - 1];
      const currentPeriod = managerPeriods[i];
      
      // Перевіряємо чи передача відбулася в рамках вибраного періоду
      // Показываем передачи, которые произошли в указанном периоде
      if (currentPeriod.start >= now - periodMs && currentPeriod.start <= now) {
        transfers.push({
          clientCode,
          clientName: signalizationData.clientNames[clientCode] || clientCode,
          fromManager: prevPeriod.manager,
          toManager: currentPeriod.manager,
          transferDate: currentPeriod.start,
          prevPeriodRevenue: prevPeriod.sales.reduce((sum, s) => sum + s.revenue, 0),
          currentPeriodRevenue: currentPeriod.sales.reduce((sum, s) => sum + s.revenue, 0),
          link: signalizationData.clientLinks[clientCode]
        });
      }
    }
  });
  
  // ДОПОЛНИТЕЛЬНО: Проверяем справочник на предмет передач без продаж
  Object.keys(clientSales).forEach(clientCode => {
    const sales = clientSales[clientCode].sort((a, b) => a.date - b.date);
    
    // Получаем текущего менеджера из справочника
    const currentManagerFromDirectory = signalizationData.clientManagerDirectory[clientCode]?.manager;
    
    if (currentManagerFromDirectory && sales.length > 0) {
      const lastSale = sales[sales.length - 1];
      const lastManagerFromSales = lastSale.manager;
      
      // Если в справочнике другой менеджер, чем в последней продаже
      if (lastManagerFromSales && 
          currentManagerFromDirectory !== lastManagerFromSales &&
          lastSale.date >= now - periodMs && lastSale.date <= now) { // Последняя продажа в указанном периоде
        
        // Проверяем, что такой передачи еще нет
        const existingTransfer = transfers.find(t => 
          t.clientCode === clientCode && 
          t.fromManager === lastManagerFromSales && 
          t.toManager === currentManagerFromDirectory
        );
        
        if (!existingTransfer) {
          // Добавляем передачу из справочника
          transfers.push({
            clientCode,
            clientName: signalizationData.clientNames[clientCode] || clientCode,
            fromManager: lastManagerFromSales,
            toManager: currentManagerFromDirectory,
            transferDate: lastSale.date, // Дата последней продажи
            prevPeriodRevenue: sales.reduce((sum, s) => sum + s.revenue, 0),
            currentPeriodRevenue: 0, // Нет продаж с новым менеджером
            link: signalizationData.clientLinks[clientCode],
            transferType: 'directory' // Тип передачи из справочника
          });
        }
      }
    }
  });
  
  // Сортуємо за датою передачі (новіші спочатку)
  return transfers.sort((a, b) => b.transferDate - a.transferDate);
}

// Рендеринг таблиці передач
function renderTransfersTable(transfers) {
  // Добавляем приоритет и сортируем
  const transfersWithPriority = transfers.map(transfer => {
    let priority = 0;
    let priorityIcon = '';
    let priorityClass = '';
    
    // Критический спад (выручка упала до 0)
    if (transfer.currentPeriodRevenue === 0 && transfer.prevPeriodRevenue > 0) {
      priority = 3;
      priorityIcon = '🔴';
      priorityClass = 'border-l-4 border-red-500';
    }
    // Значительный спад (выручка упала более чем на 50%)
    else if (transfer.currentPeriodRevenue < transfer.prevPeriodRevenue * 0.5) {
      priority = 2;
      priorityIcon = '🟡';
      priorityClass = 'border-l-4 border-yellow-500';
    }
    // Умеренный спад (выручка упала на 20-50%)
    else if (transfer.currentPeriodRevenue < transfer.prevPeriodRevenue * 0.8) {
      priority = 1;
      priorityIcon = '🟠';
      priorityClass = 'border-l-4 border-orange-500';
    }
    
    return { ...transfer, priority, priorityIcon, priorityClass };
  }).sort((a, b) => b.priority - a.priority); // Сортируем по приоритету (критические первыми)
  
  return `
    <div class="mb-4">
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center space-x-2">
          <span class="text-sm text-gray-600">Сортування:</span>
          <button class="sort-btn px-2 py-1 rounded bg-blue-600 text-white text-xs" data-sort="priority">По пріоритету</button>
          <button class="sort-btn px-2 py-1 rounded bg-gray-300 text-gray-700 text-xs" data-sort="date">По даті</button>
          <button class="sort-btn px-2 py-1 rounded bg-gray-300 text-gray-700 text-xs" data-sort="revenue">По виручці</button>
        </div>
        <div class="flex items-center space-x-2 text-xs text-gray-600">
          <span>🔴 Критичний</span>
          <span>🟡 Значний</span>
          <span>🟠 Умерений</span>
        </div>
      </div>
    </div>
    <table class="data-table w-full text-sm">
      <thead>
        <tr class="bg-gray-100">
          <th class="px-2 py-1 text-left w-12">Пріоритет</th>
          <th class="px-2 py-1 text-left w-48">Клієнт</th>
          <th class="px-2 py-1 text-left w-32">Від менеджера</th>
          <th class="px-2 py-1 text-left w-32">До менеджера</th>
          <th class="px-2 py-1 text-left w-24">Дата</th>
          <th class="px-2 py-1 text-left w-20">Виручка (до)</th>
          <th class="px-2 py-1 text-left w-20">Виручка (після)</th>
          <th class="px-2 py-1 text-left w-16">Зміна</th>
          <th class="px-2 py-1 text-left w-12">CRM</th>
          <th class="px-2 py-1 text-left w-24">Дії</th>
        </tr>
      </thead>
      <tbody>
        ${transfersWithPriority.map(transfer => {
          const revenueChange = transfer.currentPeriodRevenue - transfer.prevPeriodRevenue;
          const revenueChangePercent = transfer.prevPeriodRevenue > 0 ? 
            ((revenueChange / transfer.prevPeriodRevenue) * 100) : 0;
          
          return `
            <tr class="border-b hover:bg-gray-50 ${transfer.priorityClass}">
              <td class="px-2 py-1">
                <span class="text-sm">${transfer.priorityIcon}</span>
              </td>
              <td class="px-2 py-1">
                <span class="font-medium text-xs">${transfer.clientName}</span>
              </td>
              <td class="px-2 py-1">
                <span class="text-gray-600 text-xs">${transfer.fromManager}</span>
              </td>
              <td class="px-2 py-1">
                <span class="text-blue-600 font-medium text-xs">${transfer.toManager}</span>
                ${transfer.transferType === 'directory' ? 
                  '<span class="text-xs text-gray-500 ml-1">(спр)</span>' : 
                  '<span class="text-xs text-green-500 ml-1">(продажі)</span>'
                }
              </td>
              <td class="px-2 py-1">
                <span class="text-xs text-gray-500">
                  ${transfer.transferDate.toLocaleDateString('uk-UA')}
                </span>
              </td>
              <td class="px-2 py-1">
                <span class="text-gray-600 text-xs">${transfer.prevPeriodRevenue.toFixed(0)}</span>
              </td>
              <td class="px-2 py-1">
                <span class="text-blue-600 text-xs">${transfer.currentPeriodRevenue.toFixed(0)}</span>
              </td>
              <td class="px-2 py-1">
                <span class="${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'} font-medium text-xs">
                  ${revenueChange >= 0 ? '+' : ''}${revenueChangePercent.toFixed(0)}%
                </span>
              </td>
              <td class="px-2 py-1">
                ${transfer.link ? `<a href="${transfer.link}" target="_blank" class="text-blue-600 underline text-xs">CRM</a>` : '-'}
              </td>
              <td class="px-2 py-1">
                ${renderActionsMenu(transfer.clientCode)}
                <button class='px-1 py-0.5 bg-gray-100 rounded text-black client-detail-btn ml-1 text-xs' data-client-code="${transfer.clientCode}">Детальніше</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// Аналіз статистики передач клієнтів
function analyzeTransfersStatistics(transfers) {
  if (!transfers || transfers.length === 0) {
    return null;
  }
  
  const now = new Date();
  const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
  
  // Группируем передачи по периодам
  const periods = {
    'last_week': { start: new Date(now - 7 * 24 * 60 * 60 * 1000), count: 0, clients: new Set() },
    'last_month': { start: new Date(now - 30 * 24 * 60 * 60 * 1000), count: 0, clients: new Set() },
    'last_quarter': { start: new Date(now - 90 * 24 * 60 * 60 * 1000), count: 0, clients: new Set() },
    'current_period': { start: new Date(now - periodMs), count: 0, clients: new Set() }
  };
  
  // Группируем по менеджерам
  const managers = {};
  const departments = {};
  
  // Анализируем каждую передачу
  transfers.forEach(transfer => {
    const transferDate = transfer.transferDate;
    
    // Подсчитываем по периодам
    Object.keys(periods).forEach(periodKey => {
      if (transferDate >= periods[periodKey].start) {
        periods[periodKey].count++;
        periods[periodKey].clients.add(transfer.clientCode);
      }
    });
    
    // Подсчитываем по менеджерам
    if (!managers[transfer.fromManager]) {
      managers[transfer.fromManager] = { sent: 0, received: 0, clients: new Set() };
    }
    if (!managers[transfer.toManager]) {
      managers[transfer.toManager] = { sent: 0, received: 0, clients: new Set() };
    }
    
    managers[transfer.fromManager].sent++;
    managers[transfer.toManager].received++;
    managers[transfer.fromManager].clients.add(transfer.clientCode);
    managers[transfer.toManager].clients.add(transfer.clientCode);
    
    // Подсчитываем по отделам (если есть данные)
    if (signalizationData.managersData) {
      const fromManagerData = signalizationData.managersData.find(m => m.name === transfer.fromManager);
      const toManagerData = signalizationData.managersData.find(m => m.name === transfer.toManager);
      
      if (fromManagerData?.department) {
        const deptName = typeof fromManagerData.department === 'object' ? fromManagerData.department.name : fromManagerData.department;
        if (!departments[deptName]) {
          departments[deptName] = { sent: 0, received: 0, clients: new Set() };
        }
        departments[deptName].sent++;
        departments[deptName].clients.add(transfer.clientCode);
      }
      
      if (toManagerData?.department) {
        const deptName = typeof toManagerData.department === 'object' ? toManagerData.department.name : toManagerData.department;
        if (!departments[deptName]) {
          departments[deptName] = { sent: 0, received: 0, clients: new Set() };
        }
        departments[deptName].received++;
        departments[deptName].clients.add(transfer.clientCode);
      }
    }
  });
  
  // Анализируем конверсию (передано vs отгружено)
  const conversionAnalysis = analyzeTransferConversion(transfers);
  
  // Вычисляем общую статистику
  const totalTransfers = transfers.length;
  const uniqueClients = new Set(transfers.map(t => t.clientCode)).size;
  const uniqueManagers = new Set(transfers.flatMap(t => [t.fromManager, t.toManager])).size;
  
  return {
    totalTransfers,
    uniqueClients,
    uniqueManagers,
    periods,
    managers,
    departments,
    conversion: conversionAnalysis
  };
}

// Анализ конверсии передач
function analyzeTransferConversion(transfers) {
  const conversionData = {
    totalTransfers: transfers.length,
    transferredWithRevenue: 0,
    transferredWithoutRevenue: 0,
    conversionRate: 0,
    averageRevenueAfterTransfer: 0,
    totalRevenueAfterTransfer: 0
  };
  
  transfers.forEach(transfer => {
    if (transfer.currentPeriodRevenue > 0) {
      conversionData.transferredWithRevenue++;
      conversionData.totalRevenueAfterTransfer += transfer.currentPeriodRevenue;
    } else {
      conversionData.transferredWithoutRevenue++;
    }
  });
  
  conversionData.conversionRate = (conversionData.transferredWithRevenue / conversionData.totalTransfers) * 100;
  conversionData.averageRevenueAfterTransfer = conversionData.transferredWithRevenue > 0 ? 
    conversionData.totalRevenueAfterTransfer / conversionData.transferredWithRevenue : 0;
  
  return conversionData;
}

// Функции для расчета сумм отгрузки
function calculateTotalRevenueBeforeTransfer(transfers) {
  return transfers.reduce((sum, transfer) => sum + transfer.prevPeriodRevenue, 0);
}

function calculateTotalRevenueAfterTransfer(transfers) {
  return transfers.reduce((sum, transfer) => sum + transfer.currentPeriodRevenue, 0);
}

function calculateRevenueChange(transfers) {
  const after = calculateTotalRevenueAfterTransfer(transfers);
  const before = calculateTotalRevenueBeforeTransfer(transfers);
  return after - before;
}

function calculateManagerRevenueBefore(transfers, manager) {
  return transfers
    .filter(t => t.fromManager === manager)
    .reduce((sum, t) => sum + t.prevPeriodRevenue, 0);
}

function calculateManagerRevenueAfter(transfers, manager) {
  return transfers
    .filter(t => t.toManager === manager)
    .reduce((sum, t) => sum + t.currentPeriodRevenue, 0);
}

// Показ модального окна со статистикой передач
function showTransfersStatistics(transfers) {
  const statistics = analyzeTransfersStatistics(transfers);
  if (!statistics) {
    alert('Немає даних для аналізу статистики');
    return;
  }
  
  // Удаляем старое модальное окно если есть
  const oldModal = document.getElementById('transfers-statistics-modal');
  if (oldModal) oldModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'transfers-statistics-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]';
  
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-lg p-6 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-white">Статистика передач клієнтів</h2>
        <button class="text-gray-400 hover:text-white text-xl close-modal-btn transition-colors">&times;</button>
      </div>
      
      <!-- Календарь для выбора месяца и года -->
      <div class="mb-6">
        <div class="flex items-center space-x-4 mb-4">
          <div class="flex items-center space-x-2">
            <label class="text-gray-300 text-sm">Місяць:</label>
            <select class="month-select bg-gray-800 text-white border border-gray-600 rounded px-3 py-1 text-sm">
              <option value="1">Січень</option>
              <option value="2">Лютий</option>
              <option value="3">Березень</option>
              <option value="4">Квітень</option>
              <option value="5">Травень</option>
              <option value="6">Червень</option>
              <option value="7">Липень</option>
              <option value="8">Серпень</option>
              <option value="9">Вересень</option>
              <option value="10">Жовтень</option>
              <option value="11">Листопад</option>
              <option value="12">Грудень</option>
            </select>
          </div>
          <div class="flex items-center space-x-2">
            <label class="text-gray-300 text-sm">Рік:</label>
            <select class="year-select bg-gray-800 text-white border border-gray-600 rounded px-3 py-1 text-sm">
              ${generateYearOptions()}
            </select>
          </div>
          <button class="apply-date-filter px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
            Застосувати
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Конверсия -->
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 class="text-lg font-semibold text-blue-400 mb-3">Конверсия передач</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-300">Всього передач:</span>
              <span class="font-semibold text-white">${statistics.conversion.totalTransfers}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-300">З виручкою:</span>
              <span class="font-semibold text-green-400">${statistics.conversion.transferredWithRevenue}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-300">Без виручки:</span>
              <span class="font-semibold text-red-400">${statistics.conversion.transferredWithoutRevenue}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-300">Конверсия:</span>
              <span class="font-semibold text-blue-400">${statistics.conversion.conversionRate.toFixed(1)}%</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-300">Середня виручка:</span>
              <span class="font-semibold text-white">${statistics.conversion.averageRevenueAfterTransfer.toFixed(2)} грн</span>
            </div>
          </div>
        </div>
        
        <!-- По периодам -->
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 class="text-lg font-semibold text-green-400 mb-3">По періодах</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-300">Останній тиждень:</span>
              <span class="font-semibold text-white">${statistics.periods.last_week.count} (${statistics.periods.last_week.clients.size} клієнтів)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-300">Останній місяць:</span>
              <span class="font-semibold text-white">${statistics.periods.last_month.count} (${statistics.periods.last_month.clients.size} клієнтів)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-300">Останній квартал:</span>
              <span class="font-semibold text-white">${statistics.periods.last_quarter.count} (${statistics.periods.last_quarter.clients.size} клієнтів)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-300">Поточний період:</span>
              <span class="font-semibold text-white">${statistics.periods.current_period.count} (${statistics.periods.current_period.clients.size} клієнтів)</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Суммы отгрузки -->
      <div class="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h3 class="text-lg font-semibold text-yellow-400 mb-3">Сумми відгрузки</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-red-400">${calculateTotalRevenueBeforeTransfer(transfers).toFixed(2)} грн</div>
            <div class="text-sm text-gray-400">До передачі</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-400">${calculateTotalRevenueAfterTransfer(transfers).toFixed(2)} грн</div>
            <div class="text-sm text-gray-400">Після передачі</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold ${calculateRevenueChange(transfers) >= 0 ? 'text-green-400' : 'text-red-400'}">
              ${calculateRevenueChange(transfers) >= 0 ? '+' : ''}${calculateRevenueChange(transfers).toFixed(2)} грн
            </div>
            <div class="text-sm text-gray-400">Зміна</div>
          </div>
        </div>
      </div>
      
      <!-- По менеджерам -->
      <div class="mt-6">
        <h3 class="text-lg font-semibold text-white mb-3">По менеджерах</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-gray-300">Менеджер</th>
                <th class="px-4 py-2 text-left text-gray-300">Передано</th>
                <th class="px-4 py-2 text-left text-gray-300">Отримано</th>
                <th class="px-4 py-2 text-left text-gray-300">Унікальних клієнтів</th>
                <th class="px-4 py-2 text-left text-gray-300">Сума до передачі</th>
                <th class="px-4 py-2 text-left text-gray-300">Сума після передачі</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(statistics.managers).map(([manager, data]) => {
                const managerTransfers = transfers.filter(t => t.fromManager === manager || t.toManager === manager);
                const revenueBefore = calculateManagerRevenueBefore(managerTransfers, manager);
                const revenueAfter = calculateManagerRevenueAfter(managerTransfers, manager);
                return `
                  <tr class="border-b border-gray-700">
                    <td class="px-4 py-2 font-medium text-white">${manager}</td>
                    <td class="px-4 py-2 text-red-400">${data.sent}</td>
                    <td class="px-4 py-2 text-green-400">${data.received}</td>
                    <td class="px-4 py-2 text-gray-300">${data.clients.size}</td>
                    <td class="px-4 py-2 text-gray-300">${revenueBefore.toFixed(2)} грн</td>
                    <td class="px-4 py-2 text-gray-300">${revenueAfter.toFixed(2)} грн</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      ${Object.keys(statistics.departments).length > 0 ? `
        <!-- По отделам -->
        <div class="mt-6">
          <h3 class="text-lg font-semibold text-white mb-3">По відділах</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-700">
                <tr>
                  <th class="px-4 py-2 text-left text-gray-300">Відділ</th>
                  <th class="px-4 py-2 text-left text-gray-300">Передано</th>
                  <th class="px-4 py-2 text-left text-gray-300">Отримано</th>
                  <th class="px-4 py-2 text-left text-gray-300">Унікальних клієнтів</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(statistics.departments).map(([department, data]) => `
                  <tr class="border-b border-gray-700">
                    <td class="px-4 py-2 font-medium text-white">${department}</td>
                    <td class="px-4 py-2 text-red-400">${data.sent}</td>
                    <td class="px-4 py-2 text-green-400">${data.received}</td>
                    <td class="px-4 py-2 text-gray-300">${data.clients.size}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Обработчик закрытия
  const closeBtn = modal.querySelector('.close-modal-btn');
  const close = () => modal.remove();
  
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });
  
  // Обработчики для календаря
  const applyDateFilter = modal.querySelector('.apply-date-filter');
  const monthSelect = modal.querySelector('.month-select');
  const yearSelect = modal.querySelector('.year-select');
  
  // Устанавливаем текущий месяц и год по умолчанию
  const currentDate = new Date();
  monthSelect.value = currentDate.getMonth() + 1;
  yearSelect.value = currentDate.getFullYear();
  
  // Функция применения фильтра
  const applyFilter = () => {
    const selectedMonth = parseInt(monthSelect.value);
    const selectedYear = parseInt(yearSelect.value);
    
    // Фильтруем передачи по выбранному месяцу и году
    const filteredTransfers = transfers.filter(transfer => {
      const transferDate = transfer.transferDate;
      const transferMonth = transferDate.getMonth() + 1;
      const transferYear = transferDate.getFullYear();
      return transferMonth === selectedMonth && transferYear === selectedYear;
    });
    
    // Обновляем статистику для выбранного периода
    updateStatisticsForMonthAndYear(filteredTransfers, selectedMonth, selectedYear, transfers);
    
    // Сохраняем выбранные значения (предотвращаем сброс)
    setTimeout(() => {
      monthSelect.value = selectedMonth;
      yearSelect.value = selectedYear;
    }, 0);
  };
  
  // Обработчики событий
  applyDateFilter.addEventListener('click', applyFilter);
  
  // Применение фильтра по Enter в селектах
  monthSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      applyFilter();
    }
  });
  
  yearSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      applyFilter();
    }
  });
}

// Обновление статистики для выбранного месяца и года
function updateStatisticsForMonthAndYear(filteredTransfers, selectedMonth, selectedYear, allTransfers) {
  if (filteredTransfers.length === 0) {
    // Показываем сообщение об отсутствии данных
    const contentArea = document.querySelector('#transfers-statistics-modal .grid');
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="col-span-2 text-center py-8">
          <div class="text-gray-400 text-lg mb-2">Немає передач у ${getMonthName(selectedMonth)} ${selectedYear}</div>
          <div class="text-gray-500 text-sm">Виберіть інший період для перегляду статистики</div>
        </div>
      `;
    }
    return;
  }
  
  // Пересчитываем статистику для отфильтрованных передач
  const monthStatistics = analyzeTransfersStatistics(filteredTransfers);
  
  // Обновляем конверсию
  const conversionSection = document.querySelector('#transfers-statistics-modal .bg-gray-800:first-of-type');
  if (conversionSection) {
    conversionSection.innerHTML = `
      <h3 class="text-lg font-semibold text-blue-400 mb-3">Конверсия передач (${getMonthName(selectedMonth)} ${selectedYear})</h3>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-gray-300">Всього передач:</span>
          <span class="font-semibold text-white">${monthStatistics.conversion.totalTransfers}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">З виручкою:</span>
          <span class="font-semibold text-green-400">${monthStatistics.conversion.transferredWithRevenue}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Без виручки:</span>
          <span class="font-semibold text-red-400">${monthStatistics.conversion.transferredWithoutRevenue}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Конверсия:</span>
          <span class="font-semibold text-blue-400">${monthStatistics.conversion.conversionRate.toFixed(1)}%</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Середня виручка:</span>
          <span class="font-semibold text-white">${monthStatistics.conversion.averageRevenueAfterTransfer.toFixed(2)} грн</span>
        </div>
      </div>
    `;
  }
  
  // Обновляем секцию по периодам
  const periodsSection = document.querySelector('#transfers-statistics-modal .bg-gray-800:nth-of-type(2)');
  if (periodsSection) {
    periodsSection.innerHTML = `
      <h3 class="text-lg font-semibold text-green-400 mb-3">По періодах (${getMonthName(selectedMonth)} ${selectedYear})</h3>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-gray-300">Останній тиждень:</span>
          <span class="font-semibold text-white">${monthStatistics.periods.last_week.count} (${monthStatistics.periods.last_week.clients.size} клієнтів)</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Останній місяць:</span>
          <span class="font-semibold text-white">${monthStatistics.periods.last_month.count} (${monthStatistics.periods.last_month.clients.size} клієнтів)</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Останній квартал:</span>
          <span class="font-semibold text-white">${monthStatistics.periods.last_quarter.count} (${monthStatistics.periods.last_quarter.clients.size} клієнтів)</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-300">Поточний період:</span>
          <span class="font-semibold text-white">${monthStatistics.periods.current_period.count} (${monthStatistics.periods.current_period.clients.size} клієнтів)</span>
        </div>
      </div>
    `;
  }
  
  // Обновляем суммы отгрузки
  const revenueSection = document.querySelector('#transfers-statistics-modal .bg-gray-800:nth-of-type(3)');
  if (revenueSection) {
    revenueSection.innerHTML = `
      <h3 class="text-lg font-semibold text-yellow-400 mb-3">Сумми відгрузки (${getMonthName(selectedMonth)} ${selectedYear})</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-red-400">${calculateTotalRevenueBeforeTransfer(filteredTransfers).toFixed(2)} грн</div>
          <div class="text-sm text-gray-400">До передачі</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-400">${calculateTotalRevenueAfterTransfer(filteredTransfers).toFixed(2)} грн</div>
          <div class="text-sm text-gray-400">Після передачі</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold ${calculateRevenueChange(filteredTransfers) >= 0 ? 'text-green-400' : 'text-red-400'}">
            ${calculateRevenueChange(filteredTransfers) >= 0 ? '+' : ''}${calculateRevenueChange(filteredTransfers).toFixed(2)} грн
          </div>
          <div class="text-sm text-gray-400">Зміна</div>
        </div>
      </div>
    `;
  }
  
  // Обновляем таблицу менеджеров
  const managersSection = document.querySelector('#transfers-statistics-modal .overflow-x-auto');
  if (managersSection && monthStatistics.managers) {
    const managersTable = managersSection.querySelector('tbody');
    if (managersTable) {
      managersTable.innerHTML = Object.entries(monthStatistics.managers).map(([manager, data]) => {
        const managerTransfers = filteredTransfers.filter(t => t.fromManager === manager || t.toManager === manager);
        const revenueBefore = calculateManagerRevenueBefore(managerTransfers, manager);
        const revenueAfter = calculateManagerRevenueAfter(managerTransfers, manager);
        return `
          <tr class="border-b border-gray-700">
            <td class="px-4 py-2 font-medium text-white">${manager}</td>
            <td class="px-4 py-2 text-red-400">${data.sent}</td>
            <td class="px-4 py-2 text-green-400">${data.received}</td>
            <td class="px-4 py-2 text-gray-300">${data.clients.size}</td>
            <td class="px-4 py-2 text-gray-300">${revenueBefore.toFixed(2)} грн</td>
            <td class="px-4 py-2 text-gray-300">${revenueAfter.toFixed(2)} грн</td>
          </tr>
        `;
      }).join('');
    }
  }
  
  // Обновляем таблицу отделов (если есть)
  const departmentsSection = document.querySelector('#transfers-statistics-modal .mt-6:last-child');
  if (departmentsSection && monthStatistics.departments) {
    const departmentsTable = departmentsSection.querySelector('tbody');
    if (departmentsTable) {
      departmentsTable.innerHTML = Object.entries(monthStatistics.departments).map(([department, data]) => `
        <tr class="border-b border-gray-700">
          <td class="px-4 py-2 font-medium text-white">${department}</td>
          <td class="px-4 py-2 text-red-400">${data.sent}</td>
          <td class="px-4 py-2 text-green-400">${data.received}</td>
          <td class="px-4 py-2 text-gray-300">${data.clients.size}</td>
        </tr>
      `).join('');
    }
  }
  
  // Повторно добавляем обработчики для календаря после обновления контента
  const applyDateFilter = document.querySelector('#transfers-statistics-modal .apply-date-filter');
  const monthSelect = document.querySelector('#transfers-statistics-modal .month-select');
  const yearSelect = document.querySelector('#transfers-statistics-modal .year-select');
  
  if (applyDateFilter && monthSelect && yearSelect) {
    // Удаляем старые обработчики
    const newApplyFilter = applyDateFilter.cloneNode(true);
    applyDateFilter.parentNode.replaceChild(newApplyFilter, applyDateFilter);
    
    // Добавляем новый обработчик
    newApplyFilter.addEventListener('click', () => {
      const selectedMonth = parseInt(monthSelect.value);
      const selectedYear = parseInt(yearSelect.value);
      
      // Фильтруем передачи по выбранному месяцу и году
      const newFilteredTransfers = allTransfers.filter(transfer => {
        const transferDate = transfer.transferDate;
        const transferMonth = transferDate.getMonth() + 1;
        const transferYear = transferDate.getFullYear();
        return transferMonth === selectedMonth && transferYear === selectedYear;
      });
      
      // Обновляем статистику для выбранного периода
      updateStatisticsForMonthAndYear(newFilteredTransfers, selectedMonth, selectedYear, allTransfers);
      
      // Сохраняем выбранные значения (предотвращаем сброс)
      setTimeout(() => {
        monthSelect.value = selectedMonth;
        yearSelect.value = selectedYear;
      }, 0);
    });
  }
}

// Получение названия месяца
function getMonthName(monthNumber) {
  const months = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];
  return months[monthNumber - 1];
}

// Генерация опций для выбора года
function generateYearOptions() {
  const currentYear = new Date().getFullYear();
  let options = '';
  for (let year = currentYear; year >= currentYear - 3; year--) {
    options += `<option value="${year}">${year}</option>`;
  }
  return options;
}

// Функции сортировки передач
function sortTransfersByPriority(transfers) {
  return transfers.map(transfer => {
    let priority = 0;
    if (transfer.currentPeriodRevenue === 0 && transfer.prevPeriodRevenue > 0) {
      priority = 3;
    } else if (transfer.currentPeriodRevenue < transfer.prevPeriodRevenue * 0.5) {
      priority = 2;
    } else if (transfer.currentPeriodRevenue < transfer.prevPeriodRevenue * 0.8) {
      priority = 1;
    }
    return { ...transfer, priority };
  }).sort((a, b) => b.priority - a.priority);
}

function sortTransfersByDate(transfers) {
  return [...transfers].sort((a, b) => b.transferDate - a.transferDate);
}

function sortTransfersByRevenue(transfers) {
  return [...transfers].sort((a, b) => {
    const aChange = a.currentPeriodRevenue - a.prevPeriodRevenue;
    const bChange = b.currentPeriodRevenue - b.prevPeriodRevenue;
    return aChange - bChange; // Сортируем по убыванию изменения выручки
  });
}

// Настройка обработчиков сортировки для передач
function setupTransfersSortHandlers(transfers) {
  const sortBtns = document.querySelectorAll('.sort-btn');
  sortBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sortType = e.currentTarget.dataset.sort;
      
      // Обновляем активную кнопку
      sortBtns.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-gray-300', 'text-gray-700');
      });
      e.currentTarget.classList.remove('bg-gray-300', 'text-gray-700');
      e.currentTarget.classList.add('bg-blue-600', 'text-white');
      
      // Сортируем передачи
      let sortedTransfers = [...transfers];
      switch(sortType) {
        case 'priority':
          sortedTransfers = sortTransfersByPriority(transfers);
          break;
        case 'date':
          sortedTransfers = sortTransfersByDate(transfers);
          break;
        case 'revenue':
          sortedTransfers = sortTransfersByRevenue(transfers);
          break;
      }
      
      // Обновляем таблицу
      const tableContainer = document.querySelector('.table-container');
      if (tableContainer) {
        tableContainer.innerHTML = renderTransfersTable(sortedTransfers);
        // НЕ вызываем setupTransfersSortHandlers повторно - это создает рекурсию
        // Обработчики уже привязаны к кнопкам и будут работать
      }
    });
  });
}

// Показ стану завантаження
function showLoadingState() {
  mainContainer.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Завантаження сигналізації...</p>
    </div>
  `;
}

// Показ основного контенту
function showMainContent() {
  // Контент вже відображається після рендерингу
}

// Показ стану помилки
function showErrorState(message) {
  mainContainer.innerHTML = `
    <div class="error-container">
      <i class="fas fa-exclamation-circle"></i>
      <h3>Помилка</h3>
      <p>${message}</p>
      <button class="reload-btn">Спробувати знову</button>
    </div>
  `;
}

// Система AI-рекомендацій
function generateAIRecommendations() {
  const recommendations = [];
  const now = new Date();
  
  // Отримуємо userAccess для фільтрації
  const userAccess = getUserAccess();
  
  // Аналізуємо дані і генеруємо рекомендації (тільки для доступних клієнтів)
  Object.keys(signalizationData.clientActionsData || {}).forEach(clientCode => {
    // Перевіряємо доступ до клієнта
    if (!hasAccessToClient(clientCode, userAccess)) {
      return; // Пропускаємо клієнтів без доступу
    }
    
    const clientData = signalizationData.clientActionsData[clientCode];
    if (!clientData || !clientData.actions) return;
    
    const clientName = getClientName(clientCode, clientCode);
    const clientInfo = signalizationData.clientManagerDirectory[clientCode];
    const managerName = clientInfo?.manager || 'Невідомий';
    
    const actions = [...clientData.actions].sort((a, b) => {
      const dateA = a && a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b && b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });
    const lastAction = actions[0];
    const firstAction = actions[actions.length - 1];
    
    // Перевіряємо чи є дії та чи мають вони createdAt
    if (!actions.length || !firstAction || !firstAction.createdAt) {
      return; // Пропускаємо клієнтів без дій або без дат
    }
    
    const workingDays = Math.floor((now - new Date(firstAction.createdAt)) / (1000 * 60 * 60 * 24));
    const status = clientData.status || 'new';
    
    // Рекомендація 1: Довга робота з клієнтом без результату
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
    
    // Рекомендація 2: Багато дзвінків без результату - запропонувати КП
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
    
    // Рекомендація 3: Прострочені дії
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
    
    // Рекомендація 4: Потенційний замовлення скоро
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
    
    // Рекомендація 5: Статус "новий" занадто довго
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
  
  // Сортуємо по пріоритету
  const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  
  aiRecommendations = recommendations;
  lastRecommendationUpdate = now;
  
  return recommendations;
}

// Рендеринг віджета AI-рекомендацій
function renderAIRecommendationsWidget() {
  if (!aiRecommendations.length) {
    generateAIRecommendations();
  }
  
  // Показуємо тільки топ-5 рекомендацій
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
    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="text-blue-400 text-xl">🤖</span>
          <div>
            <h3 class="text-lg font-semibold text-white">AI Рекомендації</h3>
            <p class="text-sm text-gray-400">Розумні поради для покращення роботи з клієнтами</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="generateAIRecommendations(); renderDashboard();" 
                  class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            Оновити
          </button>
          <div class="text-xs text-gray-400">
            ${criticalCount > 0 ? `${criticalCount} критичних` : ''}
            ${highCount > 0 ? `${highCount} важливих` : ''}
          </div>
        </div>
      </div>
      
      <div class="space-y-3">
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
                <button onclick="showClientDetail('${rec.clientCode}')" 
                        class="text-blue-400 hover:text-blue-300 underline text-xs">
                  Детальніше →
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
      
      ${aiRecommendations.length > 5 ? `
        <div class="mt-3 text-center">
          <button onclick="showAllAIRecommendations()" 
                  class="text-blue-400 hover:text-blue-300 text-sm underline">
            Показати всі ${aiRecommendations.length} рекомендацій
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// Показ всіх AI-рекомендацій
function showAllAIRecommendations() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]';
  
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-white">Всі AI Рекомендації</h2>
        <button class="text-gray-400 hover:text-white text-xl close-modal-btn">&times;</button>
      </div>
      
      <div class="space-y-4">
        ${aiRecommendations.map(rec => {
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
            <div class="border rounded p-4 ${priorityColors[rec.priority]}">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">${priorityIcons[rec.priority]}</span>
                  <span class="font-medium text-lg">${rec.title}</span>
                </div>
                <button onclick="showClientDetail('${rec.clientCode}')" 
                        class="text-blue-400 hover:text-blue-300 underline">
                  Детальніше →
                </button>
              </div>
              <p class="mb-3">${rec.description}</p>
              <div class="flex items-center justify-between text-sm opacity-75">
                <span>Менеджер: ${rec.manager}</span>
                <span>Причина: ${rec.reasoning}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Обробник закриття
  const closeBtn = modal.querySelector('.close-modal-btn');
  const close = () => modal.remove();
  
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

// Експортуємо функції для глобального використання
window.generateAIRecommendations = generateAIRecommendations;
window.showAllAIRecommendations = showAllAIRecommendations;

// Система експорту даних
function exportCSV() {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  
  // Збираємо дані для експорту
  const exportData = [];
  
  Object.keys(signalizationData.clientActionsData || {}).forEach(clientCode => {
    const clientData = signalizationData.clientActionsData[clientCode];
    if (!clientData || !clientData.actions) return;
    
    const clientName = getClientName(clientCode, clientCode);
    const clientInfo = signalizationData.clientManagerDirectory[clientCode];
    const managerName = clientInfo?.manager || 'Невідомий';
    
    const actions = [...clientData.actions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const firstAction = actions[actions.length - 1];
    
    const workingDays = Math.floor((now - new Date(firstAction.createdAt)) / (1000 * 60 * 60 * 24));
    const status = clientData.status || 'new';
    
    // Статистика по типам дій
    const actionStats = {};
    const actionTypes = ['call', 'meeting', 'email', 'commercial_proposal', 'other'];
    actionTypes.forEach(type => {
      actionStats[type] = actions.filter(a => a.type === type).length;
    });
    
    // Прострочені дії
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdueActions = actions.filter(action => {
      if (!action.nextActionDate || action.status === 'cancelled') return false;
      const actionDate = new Date(action.nextActionDate);
      return actionDate < today;
    });
    
    exportData.push({
      'Код клієнта': clientCode,
      'Назва клієнта': clientName,
      'Менеджер': managerName,
      'Статус': status,
      'Всього дій': actions.length,
      'Днів роботи': workingDays,
      'Прострочені дії': overdueActions.length,
      'Дзвінки': actionStats.call,
      'Зустрічі': actionStats.meeting,
      'Email': actionStats.email,
      'КП': actionStats.commercial_proposal,
      'Інше': actionStats.other,
      'Потенційне замовлення': clientData.potentialOrderDate || '',
      'Очікувана сума': clientData.expectedAmount || '',
      'Остання активність': clientData.lastActivity || '',
      'Перша дія': firstAction.createdAt,
      'Остання дія': actions[0].createdAt
    });
  });
  
  if (exportData.length === 0) {
    alert('Немає даних для експорту');
    return;
  }
  
  // Створюємо CSV
  const headers = Object.keys(exportData[0]);
  const csvContent = [
    headers.join(','),
    ...exportData.map(row => 
      headers.map(header => {
        const value = row[header];
        // Екрануємо коми та лапки
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  // Створюємо файл для завантаження
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `signalization_export_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
}

// Експортуємо функцію експорту
window.exportCSV = exportCSV;

// Функція для фільтрації даних згідно з поточними фільтрами
function getFilteredData() {
  if (!signalizationData || !signalizationData.masterData) {
    return [];
  }
  
  let filteredData = signalizationData.masterData;
  
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
  if (userAccess.userId && signalizationData.managersData && signalizationData.managersData.length > 0) {
    const currentEmployee = signalizationData.managersData.find(emp => emp.userId === userAccess.userId);
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
  
  // Применяем фильтрацию по правам доступа
  filteredData = filteredData.filter(sale => {
    const clientCode = sale['Клиент.Код'];
    
    // Используем универсальную функцию для проверки прав доступа
    if (!hasAccessToClient(clientCode, userAccess)) {
            return false;
    }
    
    // Проверяем по справочнику клиент-менеджер из API
    const clientInfo = signalizationData.clientManagerDirectory[clientCode];
    if (!clientInfo) {
      // Если клиента нет в справочнике API, используем старую логику как fallback
      return passesFiltersOldLogic(sale);
    }
    
    // Если выбран конкретный менеджер - проверяем что клиент принадлежит этому менеджеру по справочнику
    if (filters.manager) {
      const managerName = getManagerName(filters.manager);
      if (!managerName || !clientInfo.manager) {
        return false;
      }
      
      // Проверяем что клиент принадлежит выбранному менеджеру согласно справочнику
      return clientInfo.manager.trim() === managerName.trim();
    }
    
    // Если выбран только отдел (без конкретного менеджера) - проверяем что клиент принадлежит менеджеру из этого отдела
    else if (filters.department) {
      if (signalizationData.managersData && signalizationData.managersData.length > 0) {
        // Режим Firebase: получаем всех менеджеров выбранного отдела
        const departmentManagers = signalizationData.managersData.filter(manager => {
          return manager.departmentId === filters.department ||
                 manager.department === filters.department ||
                 (manager.department && manager.department.id === filters.department);
        });
        
        const departmentManagerNames = departmentManagers.map(m => m.name);
        
        // Проверяем, принадлежит ли клиент одному из менеджеров отдела согласно справочнику
        return departmentManagerNames.includes(clientInfo.manager);
      } else {
        // Fallback режим: возвращаем false
        return false;
      }
    }
    
    return true;
  });
  
  // Фільтр по статусу
  if (filters.status) {
    filteredData = filteredData.filter(sale => {
      const clientCode = sale['Клиент.Код'];
      const clientStatus = signalizationData.clientActionsData[clientCode]?.status || 'new';
      return clientStatus === filters.status;
    });
  }
  
  // Фільтр по пошуку
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredData = filteredData.filter(sale => {
      const clientCode = sale['Клиент.Код'];
      const clientName = signalizationData.clientNames[clientCode] || clientCode;
      return clientName.toLowerCase().includes(searchTerm) || 
             clientCode.toLowerCase().includes(searchTerm);
    });
  }
  
  // Фільтр по періоду
  if (filters.period) {
    const periodMonths = parseInt(filters.period);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
    
    filteredData = filteredData.filter(sale => {
      const saleDate = new Date(sale['Дата']);
      return saleDate >= cutoffDate;
    });
  }
  
  return filteredData;
}

// Счетчик для ограничения логирования
let hasAccessDebugCount = 0;

// Універсальна функція для перевірки прав доступу до клієнта
function hasAccessToClient(clientCode, userAccess) {
  const shouldLog = hasAccessDebugCount < 5; // Логируем только первые 5 вызовов
  hasAccessDebugCount++;

  // Добавляем детальное логирование для диагностики
  if (!userAccess?.userId) {
    return true;
  }

  // Проверяем, есть ли данные для фильтрации
  if (!signalizationData?.clientManagerDirectory) {
    if (shouldLog) console.warn('⚠️ [hasAccessToClient] Нет данных clientManagerDirectory, размер данных:', Object.keys(signalizationData || {}).length);
    return true; // Разрешаем доступ если нет данных для фильтрации
  }

  if (shouldLog) {
  }
  
  // Если пользователь админ - имеет доступ ко всем клиентам
  if (userAccess.isAdmin) {
    return true;
  }
  
  // Проверяем права на просмотр всех алертов компании
  if (window.hasPermission && window.hasPermission('alerts_view_all_clients')) {
    return true;
  }
  
  // Проверяем права sales_manage (как в salesAssistant.js)
  if (window.state?.currentUserPermissions?.sales_manage) {
    return true;
  }
  
  // Получаем информацию о клиенте
  const clientInfo = signalizationData.clientManagerDirectory[clientCode];
  if (!clientInfo) {
    if (shouldLog) console.warn('⚠️ Нет информации о клиенте:', clientCode);
    return false;
  }
  
  // Проверяем права на просмотр алертов своего отдела
  if (window.hasPermission && window.hasPermission('alerts_view_department_clients')) {
    const currentUser = userAccess.employee;
    if (currentUser && currentUser.department) {
      const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
      
      // Проверяем, что клиент принадлежит менеджеру из отдела пользователя
      const departmentManagers = signalizationData.managersData.filter(manager => {
        return manager.departmentId === userDeptId ||
               manager.department === userDeptId ||
               (manager.department && manager.department.id === userDeptId);
      });
      
      const departmentManagerNames = departmentManagers.map(m => m.name);
      return departmentManagerNames.includes(clientInfo.manager);
    }
  }
  
  // Проверяем права на просмотр только своих клиентов
  if (window.hasPermission && window.hasPermission('alerts_view_manager_clients')) {
    const currentUser = userAccess.employee;
    if (currentUser) {
      const managerName = currentUser.name;
      return clientInfo.manager === managerName;
    }
  }
  
  // Дополнительная фильтрация по ролям
  if (userAccess.role && userAccess.role.includes('менедж')) {
    const currentUser = userAccess.employee;
    if (currentUser) {
      const managerName = currentUser.name;
      const isMyClient = clientInfo.manager === managerName;
      return isMyClient;
    }
  } else if (userAccess.role && userAccess.role.includes('керівник')) {
    const currentUser = userAccess.employee;
    if (currentUser && currentUser.department) {
      const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
      
      // Проверяем, что клиент принадлежит менеджеру из отдела руководителя
      const departmentManagers = signalizationData.managersData.filter(manager => {
        return manager.departmentId === userDeptId ||
               manager.department === userDeptId ||
               (manager.department && manager.department.id === userDeptId);
      });
      
      const departmentManagerNames = departmentManagers.map(m => m.name);
      return departmentManagerNames.includes(clientInfo.manager);
    }
  }
  
  return false;
}

// Функція для отримання імені менеджера по ID
function getManagerName(managerId) {
  if (!signalizationData?.managersData) return null;
  
  const manager = signalizationData.managersData.find(m => m.id === managerId);
  return manager ? manager.name : null;
}

// Вспомогательная функция для получения userAccess
function getUserAccess() {
  const userAccess = {
    userId: window.state?.currentUserId,
    employeeId: null,
    employee: null,
    role: window.state?.currentUserRole?.toLowerCase(),
    departmentId: window.state?.currentUserDepartment,
    isAdmin: window.state?.isAdmin || false
  };
  
  // Знаходимо співробітника через members
  if (window.state?.allMembers && window.state.allMembers.length > 0) {
    const currentMember = window.state.allMembers.find(m => 
      m.userId === userAccess.userId || 
      m.userId === window.state?.currentUserId
    );
    
    if (currentMember && currentMember.employeeId) {
      userAccess.employeeId = currentMember.employeeId;
      const employee = signalizationData.managersData?.find(emp => emp.id === currentMember.employeeId);
      if (employee) {
        userAccess.employee = employee;
        if (!userAccess.departmentId && employee.department) {
          if (typeof employee.department === 'object' && employee.department.id) {
            userAccess.departmentId = employee.department.id;
          } else if (typeof employee.department === 'string') {
            userAccess.departmentId = employee.department;
          }
        }
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
      }
    }
  }
  
  return userAccess;
}

// Функція для автоматичного встановлення фільтрів по поточному користувачу
async function setupUserFilters() {
  
  // Створюємо userAccess аналогічно до salesAssistant.js
  const userAccess = {
    userId: window.state?.currentUserId,
    employeeId: null,
    employee: null,
    role: window.state?.currentUserRole?.toLowerCase(),
    departmentId: window.state?.currentUserDepartment,
    isAdmin: window.state?.isAdmin || false
  };
  
  // Знаходимо співробітника через members (як в salesAssistant.js)
  if (window.state?.allMembers && window.state.allMembers.length > 0) {
    const currentMember = window.state.allMembers.find(m => 
      m.userId === userAccess.userId || 
      m.userId === window.state?.currentUserId
    );
    
    if (currentMember && currentMember.employeeId) {
      userAccess.employeeId = currentMember.employeeId;
      
      // Знаходимо employee по employeeId в managersData
      const employee = signalizationData.managersData?.find(emp => emp.id === currentMember.employeeId);
      
      if (employee) {
        userAccess.employee = employee;
        if (!userAccess.departmentId && employee.department) {
          if (typeof employee.department === 'object' && employee.department.id) {
            userAccess.departmentId = employee.department.id;
          } else if (typeof employee.department === 'string') {
            userAccess.departmentId = employee.department;
          }
        }
        
        // Визначаємо role з employee
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
        
        
        // Автоматично встановлюємо фільтри в залежності від ролі
        if (!userAccess.isAdmin && userAccess.employeeId) {
          if (userAccess.role && userAccess.role.includes('менедж')) {
            // Для менеджера встановлюємо тільки себе
            filters.manager = userAccess.employeeId;
          } else if (userAccess.role && userAccess.role.includes('керівник')) {
            // Для керівника встановлюємо його відділ
            if (userAccess.departmentId) {
              filters.department = userAccess.departmentId;
            }
          }
        }
      }
    }
  }
  
  // Оновлюємо фільтри в інтерфейсі
  populateFilters();
  
  // Застосовуємо фільтри
  applyFilters();
}

// Оновлена функція аналізу спаду виручки - точно як в оригіналі
function analyzeRevenueDrops() {
  const now = new Date();
  const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
  const prevPeriodMs = periodMs;
  const clients = {};
  

  
  // Використовуємо точно таку ж логіку як в оригіналі
  let processedSales = 0;
  let filteredSales = 0;
  
  signalizationData.masterData.forEach(sale => {
    processedSales++;
    
    if (!passesFilters || !passesFilters(sale)) {
      filteredSales++;
      return;
    }
    
    const code = sale['Клиент.Код'];
    const date = new Date(sale['Дата']);
    const revenue = typeof sale['Выручка'] === 'string' ? 
      parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : 
      (sale['Выручка'] || 0);
    
    if (!clients[code]) {
      clients[code] = { 
        name: signalizationData.clientNames[code] || sale['Клиент'] || code, 
        code, 
        now: 0, 
        prev: 0, 
        link: signalizationData.clientLinks[code] 
      };
    }
    
    if (now - date <= periodMs) {
      clients[code].now += revenue;
    } else if (now - date <= periodMs + prevPeriodMs) {
      clients[code].prev += revenue;
    }
  });
  
  
  
  // Фільтруємо всіх клієнтів зі зменшенням продажів
  let alerts = Object.values(clients)
    .filter(c => c.prev > 0 && c.now < c.prev)
    .sort((a, b) => (a.now/a.prev) - (b.now/b.prev));
  

  
  // Додаємо додаткову інформацію для відображення
  alerts = alerts.map(client => ({
    ...client,
    dropPercent: ((client.now - client.prev) / client.prev) * 100
  }));
  
  const averageDrop = alerts.length > 0 
    ? alerts.reduce((sum, client) => sum + Math.abs(client.dropPercent), 0) / alerts.length 
    : 0;
  

  
  return {
    clientsCount: alerts.length,
    averageDrop,
    clients: alerts // Показуємо всіх клієнтів
  };
}

// Функція аналізу спаду виручки з фільтрацією доступу
function analyzeRevenueDropsFiltered(userAccess) {
  const now = new Date();
  const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
  const prevPeriodMs = periodMs;
  const clients = {};
  
  signalizationData.masterData.forEach(sale => {
    // Спочатку перевіряємо доступ до клієнта
    const code = sale['Клиент.Код'];
    if (!hasAccessToClient(code, userAccess)) {
      return; // Пропускаємо клієнтів без доступу
    }
    
    // Потім застосовуємо звичайні фільтри
    if (!passesFilters || !passesFilters(sale)) {
      return;
    }
    
    const date = new Date(sale['Дата']);
    const revenue = typeof sale['Выручка'] === 'string' ? 
      parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : 
      (sale['Выручка'] || 0);
    
    if (!clients[code]) {
      clients[code] = { 
        name: signalizationData.clientNames[code] || sale['Клиент'] || code, 
        code, 
        now: 0, 
        prev: 0, 
        link: signalizationData.clientLinks[code] 
      };
    }
    
    if (now - date <= periodMs) {
      clients[code].now += revenue;
    } else if (now - date <= periodMs + prevPeriodMs) {
      clients[code].prev += revenue;
    }
  });
  
  // Фільтруємо всіх клієнтів зі зменшенням продажів
  let alerts = Object.values(clients)
    .filter(c => c.prev > 0 && c.now < c.prev)
    .sort((a, b) => (a.now/a.prev) - (b.now/b.prev));
  
  // Додаємо додаткову інформацію для відображення
  alerts = alerts.map(client => ({
    ...client,
    dropPercent: ((client.now - client.prev) / client.prev) * 100
  }));
  
  const averageDrop = alerts.length > 0 
    ? alerts.reduce((sum, client) => sum + Math.abs(client.dropPercent), 0) / alerts.length 
    : 0;
  
  return {
    clientsCount: alerts.length,
    averageDrop,
    clients: alerts
  };
}

// Оновлена функція аналізу зменшення частоти - точно як в оригіналі
function analyzeFrequencyDrops() {
  const now = new Date();
  const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
  const prevPeriodMs = periodMs;
  const clients = {};
  

  
  // Використовуємо точно таку ж логіку як в оригіналі
  signalizationData.masterData.forEach(sale => {
    if (!passesFilters || !passesFilters(sale)) return;
    
    const code = sale['Клиент.Код'];
    const date = new Date(sale['Дата']);
    
    if (!clients[code]) {
      clients[code] = { 
        name: signalizationData.clientNames[code] || sale['Клиент'] || code, 
        code, 
        now: [], 
        prev: [], 
        link: signalizationData.clientLinks[code],
        manager: sale['Основной менеджер']
      };
    }
    
    if (now - date <= periodMs) {
      clients[code].now.push(date);
    } else if (now - date <= periodMs + prevPeriodMs) {
      clients[code].prev.push(date);
    }
  });
  
  // Розрахунок середнього інтервалу (точно як в оригіналі)
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
  }).filter(c => c.prevInt && c.nowInt && c.nowInt > c.prevInt);
  
  // Сортуємо за зростанням інтервалу
  alerts = alerts.sort((a,b) => b.nowInt/b.prevInt - a.nowInt/a.prevInt);
  
  // Додаємо додаткову інформацію для відображення
  alerts = alerts.map(client => ({
    ...client,
    dropPercent: ((client.nowInt - client.prevInt) / client.prevInt) * 100
  }));
  
  const averageDrop = alerts.length > 0 
    ? alerts.reduce((sum, client) => sum + Math.abs(client.dropPercent), 0) / alerts.length 
    : 0;
  
  return {
    clientsCount: alerts.length,
    averageDrop,
    clients: alerts // Показуємо всіх клієнтів
  };
}

// Оновлена функція аналізу зменшення середнього чека - точно як в оригіналі
function analyzeAvgCheckDrops() {
  const now = new Date();
  const periodMs = currentPeriod * 30 * 24 * 60 * 60 * 1000;
  const prevPeriodMs = periodMs;
  const clients = {};
  

  
  // Використовуємо точно таку ж логіку як в оригіналі
  signalizationData.masterData.forEach(sale => {
    if (!passesFilters || !passesFilters(sale)) return;
    
    const code = sale['Клиент.Код'];
    const date = new Date(sale['Дата']);
    const revenue = typeof sale['Выручка'] === 'string' ? 
      parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) : 
      (sale['Выручка'] || 0);
    
    if (!clients[code]) {
      clients[code] = { 
        name: signalizationData.clientNames[code] || sale['Клиент'] || code, 
        code, 
        now: [], 
        prev: [], 
        link: signalizationData.clientLinks[code],
        manager: sale['Основной менеджер']
      };
    }
    
    if (now - date <= periodMs) {
      clients[code].now.push(revenue);
    } else if (now - date <= periodMs + prevPeriodMs) {
      clients[code].prev.push(revenue);
    }
  });
  
  function avg(arr) { 
    return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; 
  }
  
  let alerts = Object.values(clients).map(c => {
    const nowAvg = avg(c.now);
    const prevAvg = avg(c.prev);
    return { ...c, nowAvg, prevAvg };
  }).filter(c => c.prevAvg && c.nowAvg && c.nowAvg < c.prevAvg);
  
  // Сортуємо по спаду середнього чека
  alerts = alerts.sort((a,b) => a.nowAvg/a.prevAvg - b.nowAvg/b.prevAvg);
  
  // Додаємо додаткову інформацію для відображення
  alerts = alerts.map(client => ({
    ...client,
    change: ((client.nowAvg - client.prevAvg) / client.prevAvg) * 100
  }));
  
  const averageDrop = alerts.length > 0 
    ? alerts.reduce((sum, client) => sum + Math.abs(client.change), 0) / alerts.length 
    : 0;
  
  const totalOldAvg = alerts.length > 0 
    ? alerts.reduce((sum, client) => sum + client.prevAvg, 0) / alerts.length 
    : 0;
  
  const totalNewAvg = alerts.length > 0 
    ? alerts.reduce((sum, client) => sum + client.nowAvg, 0) / alerts.length 
    : 0;
  
  const totalChange = totalOldAvg > 0 ? ((totalNewAvg - totalOldAvg) / totalOldAvg) * 100 : 0;
  
  return {
    clientsCount: alerts.length,
    averageDrop,
    totalOldAvg,
    totalNewAvg,
    totalChange,
    clients: alerts // Показуємо всіх клієнтів
  };
}

// Допоміжні функції
function calculateAverageInterval(dates) {
  if (dates.length < 2) return 0;
  
  let totalDays = 0;
  for (let i = 1; i < dates.length; i++) {
    const diffTime = Math.abs(dates[i] - dates[i-1]);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    totalDays += diffDays;
  }
  
  return totalDays / (dates.length - 1);
}

function renderClientStatus(clientCode) {
  // Используем данные из window.clientActionsData для немедленного обновления
  const status = window.clientActionsData?.[clientCode]?.status || 
                 signalizationData.clientActionsData?.[clientCode]?.status || 'new';
  
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
  
  return `<span class="text-xs px-2 py-1 rounded ${statusColors[status]}">${statusLabels[status]}</span>`;
}

// Модуль готовий до використання 

// Функція для відображення детальної інформації про клієнта
function showClientDetail(clientCode) {
  const oldModal = document.getElementById('client-detail-modal');
  if (oldModal) oldModal.remove();

  const sales = signalizationData.masterData.filter(s => s['Клиент.Код'] === clientCode);
  if (!sales.length) {
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

  // Получаем текущий статус клиента
  const currentStatus = window.clientActionsData?.[clientCode]?.status || 
                       signalizationData.clientActionsData?.[clientCode]?.status || 'new';
  const statusOptions = [
    { value: 'new', label: '🆕 Новий', color: 'bg-red-600' },
    { value: 'in_progress', label: '🔄 В роботі', color: 'bg-yellow-600' },
    { value: 'resolved', label: '✅ Вирішено', color: 'bg-green-600' },
    { value: 'closed', label: '🗂️ Закрито', color: 'bg-gray-600' }
  ];

  let modal = document.createElement('div');
  modal.id = 'client-detail-modal';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60';
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-6xl relative max-h-[95vh] flex flex-col overflow-y-auto animate-fade-in">
      <button id="close-client-detail" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-2xl font-bold text-white">Деталізація: <span class="text-indigo-400">${sales[0] ? signalizationData.clientNames[clientCode] || sales[0]['Клиент'] : ''}</span></h3>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-300">Статус:</span>
            <select id="client-status-select" class="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm">
              ${statusOptions.map(option => 
                `<option value="${option.value}" ${option.value === currentStatus ? 'selected' : ''}>${option.label}</option>`
              ).join('')}
            </select>
          </div>
          <button id="save-status-btn" class="px-4 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm">
            Зберегти статус
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Левая колонка - графики и заказы -->
        <div class="space-y-8">
          <div>
            <h4 class="font-bold mb-3 text-gray-200">Динаміка виручки по місяцям</h4>
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
              <table class="min-w-full text-xs bg-gray-800 rounded-lg overflow-hidden">
                <thead>
                  <tr class="bg-gray-700 text-gray-300">
                    <th class="px-3 py-2">Дата</th>
                    <th class="px-3 py-2">Сума</th>
                    <th class="px-3 py-2">Товари</th>
                  </tr>
                </thead>
                <tbody>
                  ${lastDates.map(date => {
                    const orders = salesByDate[date];
                    const total = orders.reduce((sum, s) => sum + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
                    const safeId = 'order_' + date.replace(/[^\d]/g, '');
                    return `<tr>
                      <td class="px-3 py-2 text-gray-200">${date}</td>
                      <td class="px-3 py-2 text-green-400">${total.toFixed(2)}</td>
                      <td class="px-3 py-2">
                        <button class='px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 toggle-order-detail-btn' data-element-id="${safeId}">Показати</button>
                        <div id='${safeId}' class='hidden mt-2 text-xs bg-gray-900 rounded p-3'>
                          <ul class='list-disc list-inside space-y-1'>
                            ${orders.map(s=>`<li>${s['Номенклатура']} <span class='text-gray-400'>(${typeof s['Выручка'] === 'string' ? s['Выручка'] : (s['Выручка']||0)})</span></li>`).join('')}
                          </ul>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Правая колонка - история действий -->
        <div>
          <h4 class="font-bold mb-3 text-gray-200">Історія дій</h4>
          <div class="bg-gray-800 rounded-lg p-4 max-h-[600px] overflow-y-auto">
            ${renderClientActionsHistory(clientCode)}
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  

  
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
  
  // Обработчик сохранения статуса
  document.getElementById('save-status-btn').onclick = async function() {
    const newStatus = document.getElementById('client-status-select').value;
    const oldStatus = currentStatus;
    
    if (newStatus === oldStatus) {
      showActionNotification('Статус не змінився', 'info');
      return;
    }
    
    try {
      // Обновляем локальные данные
      if (!signalizationData.clientActionsData[clientCode]) {
        signalizationData.clientActionsData[clientCode] = {
          status: 'new',
          actions: [],
          lastActivity: null,
          potentialOrderDate: null,
          expectedAmount: null
        };
      }
      
      // Обновляем данные в signalizationData
      signalizationData.clientActionsData[clientCode].status = newStatus;
      signalizationData.clientActionsData[clientCode].lastActivity = new Date().toISOString();
      
      // Обновляем данные в window.clientActionsData для немедленного отображения
      if (!window.clientActionsData[clientCode]) {
        window.clientActionsData[clientCode] = {
          status: 'new',
          actions: [],
          lastActivity: null,
          potentialOrderDate: null,
          expectedAmount: null
        };
      }
      
      window.clientActionsData[clientCode].status = newStatus;
      window.clientActionsData[clientCode].lastActivity = new Date().toISOString();
      
      // Очищаем кэш прогноза для обновления данных
      missedForecastCache = null;
      lastFilterHash = null;
      
      // Сохраняем в Firebase
      const companyId = window.state?.currentCompanyId;
      if (companyId) {
        try {
          const { db, doc, setDoc, serverTimestamp } = await import('./firebase.js');
          const docRef = doc(db, 'companies', companyId, 'clientAlerts', clientCode);
          
          await setDoc(docRef, {
            ...signalizationData.clientActionsData[clientCode],
            updatedAt: serverTimestamp()
          }, { merge: true });
          
        } catch (firebaseError) {
          console.warn('⚠️ Помилка збереження статусу в Firebase, зберігаємо локально:', firebaseError);
          
          // Сохраняем локально в localStorage как fallback
          try {
            const localActions = JSON.parse(localStorage.getItem('clientActionsData') || '{}');
            localActions[clientCode] = signalizationData.clientActionsData[clientCode];
            localStorage.setItem('clientActionsData', JSON.stringify(localActions));
          } catch (localError) {
            console.error('❌ Помилка локального збереження статусу:', localError);
          }
        }
      }
      
      showActionNotification('Статус успішно оновлено!', 'success');
      
      // Обновляем отображение
      const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab') || currentTab;
      if (activeTab) {
        renderTabContent(activeTab);
      }
      
      // Принудительно обновляем статус в таблице
      setTimeout(() => {
        const statusElements = document.querySelectorAll(`[data-client-code="${clientCode}"] .client-status`);
        statusElements.forEach(element => {
          element.innerHTML = renderClientStatus(clientCode);
        });
      }, 50);
      
      // Принудительно обновляем вкладку "Прогноз" если она активна
      if (activeTab === 'forecast') {
        setTimeout(() => {
          renderMissedForecast();
        }, 100);
      }
      
    } catch (error) {
      console.error('❌ Помилка збереження статусу:', error);
      showActionNotification('Помилка збереження статусу: ' + error.message, 'error');
    }
  };
  
  // Графіки
  setTimeout(()=>{
    const revenueCanvas = document.getElementById('clientRevenueChart');
    const freqCanvas = document.getElementById('clientFreqChart');
    const avgCheckCanvas = document.getElementById('clientAvgCheckChart');
    
    if (revenueCanvas) {
      new Chart(revenueCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [{
            label:'Виручка',
            data:sortedMonths.map(m=>monthMap[m]),
            borderColor:'#34d399',
            backgroundColor:'rgba(52,211,153,0.2)',
            fill:true
          }]
        },
        options: {
          responsive:true, 
          plugins:{legend:{display:false}}, 
          scales:{
            x:{ticks:{color:'#a1a1aa'}},
            y:{ticks:{color:'#a1a1aa'}}
          }
        }
      });
    }
    
    if (freqCanvas) {
      new Chart(freqCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: freqArr.map((_,i)=>i+1),
          datasets: [{
            label:'Інтервал (днів)',
            data:freqArr,
            borderColor:'#fbbf24',
            backgroundColor:'rgba(251,191,36,0.2)',
            fill:true
          }]
        },
        options: {
          responsive:true, 
          plugins:{legend:{display:false}}, 
          scales:{
            x:{ticks:{color:'#a1a1aa'}},
            y:{ticks:{color:'#a1a1aa'}}
          }
        }
      });
    }
    
    if (avgCheckCanvas) {
      new Chart(avgCheckCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: sortedMonths,
          datasets: [{
            label:'Середній чек',
            data:sortedAvgCheck,
            borderColor:'#8b5cf6',
            backgroundColor:'rgba(139,92,246,0.2)',
            fill:true
          }]
        },
        options: {
          responsive:true, 
          plugins:{legend:{display:false}}, 
          scales:{
            x:{ticks:{color:'#a1a1aa'}},
            y:{ticks:{color:'#a1a1aa'}}
          }
        }
      });
    }
    
    // Налаштовуємо обробники подій для модального вікна
    if (window.setupDynamicEventListeners) {
      window.setupDynamicEventListeners();
    }
  }, 100);
}

// Глобальна функція для доступу з HTML
window.showClientDetail = showClientDetail;

// Функція для відображення меню дій
function renderActionsMenu(clientCode) {
  return `
    <div class="relative">
      <button class="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center gap-1 actions-menu-toggle" 
              data-client-code="${clientCode}" 
              id="actions-btn-${clientCode}">
        <span class="text-sm">Дії</span>
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
        </svg>
      </button>
      <div class="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-40 z-50 hidden" 
           id="actions-menu-${clientCode}">
        <div class="py-1">
          <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 action-modal-btn"
                  data-client-code="${clientCode}" 
                  data-action-type="call">
            <span>📞</span>
            <span>Дзвінок</span>
          </button>
          <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 action-modal-btn"
                  data-client-code="${clientCode}" 
                  data-action-type="meeting">
            <span>🤝</span>
            <span>Зустріч</span>
          </button>
          <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 action-modal-btn"
                  data-client-code="${clientCode}" 
                  data-action-type="email">
            <span>📧</span>
            <span>Лист</span>
          </button>
          <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 action-modal-btn"
                  data-client-code="${clientCode}" 
                  data-action-type="proposal">
            <span>📄</span>
            <span>Комерційна пропозиція</span>
          </button>
          <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 action-modal-btn"
                  data-client-code="${clientCode}" 
                  data-action-type="other">
            <span>📝</span>
            <span>Інше</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Функція для перемикання меню дій
function toggleActionsMenu(clientCode) {
  const menu = document.getElementById(`actions-menu-${clientCode}`);
  if (!menu) return;
  
  const isVisible = !menu.classList.contains('hidden');
  
  // Закриваємо всі інші меню
  document.querySelectorAll('[id^="actions-menu-"]').forEach(m => {
    m.classList.add('hidden');
  });
  
  if (!isVisible) {
    menu.classList.remove('hidden');
  }
  
  // Закриваємо меню при кліку поза ним
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && !e.target.closest(`#actions-btn-${clientCode}`)) {
      menu.classList.add('hidden');
      document.removeEventListener('click', closeMenu);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

// Глобальні функції для доступу з HTML
window.renderActionsMenu = renderActionsMenu;
window.toggleActionsMenu = toggleActionsMenu;

// Функція для відображення модального вікна дій
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
  
  const clientName = signalizationData.clientNames[clientCode] || clientCode;
  
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
        <p class="text-gray-300 text-sm mb-2">Клієнт: <span class="text-indigo-400 font-medium">${clientName}</span></p>
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

// Функція для збереження дії клієнта
async function saveClientAction(clientCode, actionType) {
  try {
    // Проверяем права доступа
    if (window.hasPermission && !window.hasPermission('alerts_add_actions')) {
      alert('Помилка: У вас немає прав для додавання дій по алертах');
      return;
    }
    
    const comment = document.getElementById('action-comment')?.value || '';
    const nextAction = document.getElementById('next-action')?.value || '';
    const nextActionDate = document.getElementById('next-action-date')?.value || '';
    const potentialOrderDate = document.getElementById('potential-order-date')?.value || '';
    const potentialAmount = document.getElementById('potential-amount')?.value || '';
    
    // Получаем данные пользователя
    const userId = window.state?.currentUserId || 'unknown';
    const companyId = window.state?.currentCompanyId || 'unknown';
    
    if (userId === 'unknown' || companyId === 'unknown') {
      console.warn('⚠️ Не вдалося визначити користувача або компанію, використовуємо локальне збереження');
    }
    
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
  if (!window.clientActionsData[clientCode]) {
    window.clientActionsData[clientCode] = {
        status: 'new',
      actions: [],
      lastActivity: null,
      potentialOrderDate: null,
      expectedAmount: null
    };
    }
    
    window.clientActionsData[clientCode].actions.push(actionData);
    window.clientActionsData[clientCode].lastActivity = now.toISOString();
    
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
    
    window.clientActionsData[clientCode].status = newStatus;
    
    if (potentialOrderDate) {
      window.clientActionsData[clientCode].potentialOrderDate = potentialOrderDate;
    }
    if (potentialAmount) {
      window.clientActionsData[clientCode].expectedAmount = parseFloat(potentialAmount);
    }
    
    // Очищаем кэш прогноза для обновления данных
    missedForecastCache = null;
    lastFilterHash = null;
    
    // Пытаемся сохранить в Firebase
    try {
      // Импортируем Firebase
      const { db, serverTimestamp } = await import('./firebase.js');
      
      window.clientActionsData[clientCode].updatedAt = serverTimestamp(); // Метка времени на уровне документа
      
      // Сохраняем в Firebase
      const { collection, doc, setDoc } = await import('./firebase.js');
      const docRef = doc(db, 'companies', companyId, 'clientAlerts', clientCode);
      
      await setDoc(docRef, window.clientActionsData[clientCode], { merge: true });
      
    } catch (firebaseError) {
      console.warn('⚠️ Помилка збереження в Firebase, зберігаємо локально:', firebaseError);
      
      // Сохраняем локально в localStorage как fallback
      try {
        const localActions = JSON.parse(localStorage.getItem('clientActionsData') || '{}');
        localActions[clientCode] = window.clientActionsData[clientCode];
        localStorage.setItem('clientActionsData', JSON.stringify(localActions));
      } catch (localError) {
        console.error('❌ Помилка локального збереження:', localError);
      }
    }
    
    // Обновляем отображение
    if (window.renderSignals) {
      window.renderSignals();
    } else {
      // Если renderSignals не доступен, обновляем текущий контент
      const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab') || currentTab;
      if (activeTab) {
        renderTabContent(activeTab);
      } else {
        // Принудительно обновляем текущую вкладку
        renderTabContent(currentTab);
      }
    }
    
    // Принудительно обновляем таблицу, если она существует
    setTimeout(() => {
      const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab') || currentTab;
      if (activeTab) {
        renderTabContent(activeTab);
      }
      
      // Принудительно обновляем вкладку "Прогноз" если она активна
      if (activeTab === 'forecast') {
        setTimeout(() => {
          renderMissedForecast();
        }, 100);
      }
      
      // Налаштовуємо обробники подій після оновлення
      if (window.setupDynamicEventListeners) {
        window.setupDynamicEventListeners();
      }
    }, 100);
    
    // Показываем уведомление
    showActionNotification('Дія збережена успішно!', 'success');
    
  } catch (error) {
    console.error('❌ Помилка збереження дії:', error);
    showActionNotification('Помилка збереження дії: ' + error.message, 'error');
  }
}

// Функція для показу повідомлень
function showActionNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-[200] px-4 py-2 rounded-md text-white ${
    type === 'success' ? 'bg-green-600' : 
    type === 'error' ? 'bg-red-600' : 'bg-blue-600'
  }`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Функція для перемикання відображення втрачених продуктів
function toggleLostProducts(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.toggle('hidden');
  }
}




// Функция для получения имени клиента (аналог из alerts.js)
function getClientName(clientCode, fallbackName) {
  if (signalizationData && signalizationData.clientNames && signalizationData.clientNames[clientCode]) {
    return signalizationData.clientNames[clientCode];
  }
  return fallbackName || clientCode;
}







// Универсальная функция для рендеринга таблиц
function renderTable(list, headers, rowFn, rowClassFn) {
  // Знаходимо активний контент для рендерингу
  let contentBody = document.getElementById('content-body');
  
  // Якщо ми в контексті конкретної вкладки, використовуємо її контент
  const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab') || currentTab;
  if (activeTab && activeTab !== 'dashboard') {
    const tabContent = document.getElementById(`${activeTab}-tab-content`);
    if (tabContent) {
      contentBody = tabContent;
    }
  }
  
  if (!contentBody) {
    console.warn('⚠️ Не знайдено контейнер для рендерингу таблиці');
    return;
  }
  
  contentBody.innerHTML = `
    <div class="table-container">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-white">${getSignalTitle()}</h2>
        <span class="text-xs text-gray-400">${list.length} клієнтів</span>
          </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-800">
            <tr>
              ${headers.map(h => `<th class="px-4 py-3 text-left text-gray-300 font-medium">${h}</th>`).join('')}
                  </tr>
                </thead>
          <tbody class="divide-y divide-gray-700">
            ${list.map(c => `<tr class="${rowClassFn ? rowClassFn(c) : 'hover:bg-gray-800/50 transition-colors'}">${rowFn(c).map(cell => `<td class="px-4 py-3">${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
              </table>
      </div>
    </div>
  `;
  
  // Встановлюємо event listeners після рендерингу таблиці
  if (window.setupDynamicEventListeners) {
    window.setupDynamicEventListeners();
  }
}

// Функция для получения заголовка сигнала
function getSignalTitle() {
  const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab') || currentTab;
  switch(activeTab) {
    case 'revenue-drop': return 'Клієнти зі спадом виручки >30%';
    case 'frequency-drop': return 'Клієнти з падінням частоти замовлень';
    case 'avgcheck-drop': return 'Клієнти зі зменшенням середнього чека';
    case 'missed-forecast': return 'Клієнти, які не замовили у прогнозовану дату';
    case 'product-drop': return 'Клієнти, які перестали купувати товари';
    case 'overdue-agreements': return 'Прострочені домовленості';
    case 'manager-analytics': return 'Аналітика менеджерів';
    case 'client-reports': return 'Детальні звіти по клієнтах';
    default: return 'Сигналізація';
  }
}

// Універсальна функція перевірки фільтрів (скопійована з alerts.js)
function passesFilters(sale) {
  const clientCode = sale['Клиент.Код'];
  
  // Створюємо об'єкт userAccess аналогічно до модуля Помічник продажу
  const userAccess = {
    userId: window.state?.currentUserId,
    employeeId: null,
    employee: null,
    role: window.state?.currentUserRole?.toLowerCase(),
    departmentId: window.state?.currentUserDepartment,
    isAdmin: window.state?.isAdmin || false
  };
  
  // Знаходимо співробітника по userId
  if (userAccess.userId && window.managersData && window.managersData.length > 0) {
    const currentEmployee = window.managersData.find(emp => emp.userId === userAccess.userId);
    if (currentEmployee) {
      userAccess.employeeId = currentEmployee.id;
      userAccess.employee = currentEmployee;
      // Визначаємо departmentId якщо не заданий
      if (!userAccess.departmentId && currentEmployee.department) {
        if (typeof currentEmployee.department === 'object' && currentEmployee.department.id) {
          userAccess.departmentId = currentEmployee.department.id;
        } else if (typeof currentEmployee.department === 'string') {
          userAccess.departmentId = currentEmployee.department;
        }
      }
    }
  }
  
  // Перевіряємо права доступу до даних
  if (!hasAccessToClient(clientCode, userAccess)) {
    return false;
  }
  
  // Перевіряємо по довіднику клієнт-менеджер з API
  const clientInfo = signalizationData.clientManagerDirectory[clientCode];
  if (!clientInfo) {
    // Якщо клієнта немає в довіднику API, використовуємо стару логіку як fallback
    return passesFiltersOldLogic(sale);
  }
  
  // Якщо вибраний конкретний менеджер - перевіряємо що клієнт належить цьому менеджеру по довіднику
  if (filters.manager) {
    const managerName = getManagerName(filters.manager);
    if (!managerName || !clientInfo.manager) {
      return false;
    }
    
    // Проверяем что клиент принадлежит выбранному менеджеру согласно справочнику
    return clientInfo.manager.trim() === managerName.trim();
  }
  
      // Если выбран только отдел (без конкретного менеджера) - проверяем что клиент принадлежит менеджеру из этого отдела
    else if (filters.department) {
      if (signalizationData.managersData && signalizationData.managersData.length > 0) {
        // Режим Firebase: получаем всех менеджеров выбранного отдела
        const departmentManagers = signalizationData.managersData.filter(manager => {
          return manager.departmentId === filters.department ||
                 manager.department === filters.department ||
                 (manager.department && manager.department.id === filters.department);
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

// Стара логіка фільтрації як fallback (скопійована з alerts.js)
function passesFiltersOldLogic(sale) {
  // Отримуємо код клієнта з продажу
  const clientCode = sale['Клиент.Код'];
  
  // Створюємо об'єкт userAccess аналогічно до модуля Помічник продажу
  const userAccess = {
    userId: window.state?.currentUserId,
    employeeId: null,
    employee: null,
    role: window.state?.currentUserRole?.toLowerCase(),
    departmentId: window.state?.currentUserDepartment,
    isAdmin: window.state?.isAdmin || false
  };
  
  // Знаходимо співробітника по userId
  if (userAccess.userId && window.managersData && window.managersData.length > 0) {
    const currentEmployee = window.managersData.find(emp => emp.userId === userAccess.userId);
    if (currentEmployee) {
      userAccess.employeeId = currentEmployee.id;
      userAccess.employee = currentEmployee;
      // Визначаємо departmentId якщо не заданий
      if (!userAccess.departmentId && currentEmployee.department) {
        if (typeof currentEmployee.department === 'object' && currentEmployee.department.id) {
          userAccess.departmentId = currentEmployee.department.id;
        } else if (typeof currentEmployee.department === 'string') {
          userAccess.departmentId = currentEmployee.department;
        }
      }
    }
  }
  
  // Перевіряємо права доступу до даних
  if (!userAccess.isAdmin) {
    // Перевіряємо права на перегляд всіх алертів компанії
    if (window.hasPermission && window.hasPermission('alerts_view_all_clients')) {
      // Користувач може бачити всі алерти - пропускаємо
    } else if (window.hasPermission && window.hasPermission('alerts_view_department_clients')) {
      // Користувач може бачити алерти свого відділу
      const currentUser = signalizationData.managersData?.find(emp => emp.id === userAccess.employeeId);
      if (currentUser && currentUser.department) {
        const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
        const departmentManagers = signalizationData.managersData?.filter(manager => {
          return manager.departmentId === userDeptId ||
                 manager.department === userDeptId ||
                 (manager.department && manager.department.id === userDeptId);
        }) || [];
        
        const departmentManagerNames = departmentManagers.map(m => m.name);
        if (!departmentManagerNames.includes(sale['Основной менеджер'])) {
          return false;
        }
      }
    } else if (window.hasPermission && window.hasPermission('alerts_view_manager_clients')) {
      // Користувач може бачити тільки своїх клієнтів
      const currentUser = signalizationData.managersData?.find(emp => emp.id === userAccess.employeeId);
      if (currentUser && sale['Основной менеджер'] !== currentUser.name) {
        return false;
      }
    } else {
      // Немає прав на перегляд - приховуємо все
      return false;
    }
  }
  
  // Якщо користувач не адмін, застосовуємо додаткову фільтрацію по ролях
  if (!userAccess.isAdmin && userAccess.employeeId) {
    if (userAccess.role && userAccess.role.includes('менедж')) {
      // Менеджер бачить тільки своїх клієнтів
      const currentUser = signalizationData.managersData?.find(emp => emp.id === userAccess.employeeId);
      if (currentUser && sale['Основной менеджер'] !== currentUser.name) {
        return false;
      }
    } else if (userAccess.role && userAccess.role.includes('керівник')) {
      // Керівник бачить клієнтів свого відділу
      const currentUser = signalizationData.managersData?.find(emp => emp.id === userAccess.employeeId);
      if (currentUser && currentUser.department) {
        const userDeptId = typeof currentUser.department === 'object' ? currentUser.department.id : currentUser.department;
        const clientInfo = signalizationData.clientManagerDirectory[clientCode];
        if (!clientInfo) return false;
        
        // Перевіряємо, що клієнт належить менеджеру з відділу керівника
        const departmentManagers = signalizationData.managersData?.filter(manager => {
          return manager.departmentId === userDeptId ||
                 manager.department === userDeptId ||
                 (manager.department && manager.department.id === userDeptId);
        }) || [];
        
        const departmentManagerNames = departmentManagers.map(m => m.name);
        if (!departmentManagerNames.includes(clientInfo.manager)) {
          return false;
        }
      }
    }
  }
  
  // Перевіряємо по довіднику клієнт-менеджер з API
  const clientInfo = signalizationData.clientManagerDirectory[clientCode];
  if (!clientInfo) {
    // Якщо клієнта немає в довіднику API, повертаємо false
    return false;
  }
  
  // Якщо вибраний конкретний менеджер - фільтруємо тільки по ньому
  if (filters.manager) {
    if (signalizationData.managersData && signalizationData.managersData.length > 0) {
      // Режим Firebase: шукаємо по ID менеджера
      const manager = signalizationData.managersData.find(m => m.id === filters.manager);
      if (!manager || sale['Основной менеджер'] !== manager.name) {
        return false;
      }
    } else {
      // Fallback режим: пряме порівняння імені
      if (sale['Основной менеджер'] !== filters.manager) {
        return false;
      }
    }
  }
  // Якщо вибраний тільки відділ (без конкретного менеджера) - показуємо всіх менеджерів відділу
  else if (filters.department) {
    if (signalizationData.managersData && signalizationData.managersData.length > 0) {
      // Режим Firebase: отримуємо всіх менеджерів вибраного відділу
      const departmentManagers = signalizationData.managersData.filter(manager => {
        return manager.departmentId === filters.department ||
               manager.department === filters.department ||
               (manager.department && manager.department.id === filters.department);
      });
      
      const departmentManagerNames = departmentManagers.map(m => m.name);
      
      // Перевіряємо, чи є менеджер продажу серед менеджерів відділу
      if (!departmentManagerNames.includes(sale['Основной менеджер'])) {
        return false;
      }
    } else {
      // Fallback режим: використовуємо дані з продажів
      const managersInDepartment = [...new Set(signalizationData.masterData.filter(d => d['Відділ'] === filters.department).map(d => d['Основной менеджер']))];
      
      if (!managersInDepartment.includes(sale['Основной менеджер'])) {
        return false;
      }
    }
  }
  
  return true;
}

// Функція для отримання імені менеджера по ID

// Функція для автоматичної перевірки та оновлення статусів клієнтів
function checkAndUpdateClientStatuses() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  Object.keys(signalizationData.clientActionsData).forEach(clientCode => {
    const clientData = signalizationData.clientActionsData[clientCode];
    if (!clientData || clientData.status === 'resolved' || clientData.status === 'closed') return;
    
    // Перевіряємо потенційну дату замовлення
    if (clientData.potentialOrderDate) {
      const orderDate = new Date(clientData.potentialOrderDate);
      if (orderDate < today) {
        signalizationData.clientActionsData[clientCode].status = 'resolved';
      }
    }
  });
}

// Функція для збереження нового статусу клієнта
window.saveClientStatus = async function(clientCode) {
  try {
    const selectedStatus = document.querySelector('input[name="status"]:checked')?.value;
    if (!selectedStatus) {
      alert('Будь ласка, виберіть статус');
      return;
    }
    
    // Перевіряємо права доступу
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
    if (!signalizationData.clientActionsData[clientCode]) {
      signalizationData.clientActionsData[clientCode] = {
        status: 'new',
        actions: [],
        lastActivity: null,
        potentialOrderDate: null,
        expectedAmount: null
      };
    }
    
    // Обновляем данные в signalizationData
    signalizationData.clientActionsData[clientCode].status = selectedStatus;
    signalizationData.clientActionsData[clientCode].lastActivity = new Date().toISOString();
    
    // Обновляем данные в window.clientActionsData для немедленного отображения
    if (!window.clientActionsData[clientCode]) {
      window.clientActionsData[clientCode] = {
        status: 'new',
        actions: [],
        lastActivity: null,
        potentialOrderDate: null,
        expectedAmount: null
      };
    }
    
    window.clientActionsData[clientCode].status = selectedStatus;
    window.clientActionsData[clientCode].lastActivity = new Date().toISOString();
    
    // Очищаем кэш прогноза для обновления данных
    missedForecastCache = null;
    lastFilterHash = null;
    
    // Сохраняем в Firebase
    const { db, doc, setDoc, serverTimestamp } = await import('./firebase.js');
    const docRef = doc(db, 'companies', companyId, 'clientAlerts', clientCode);
    
    await setDoc(docRef, {
      ...signalizationData.clientActionsData[clientCode],
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Закриваємо модальне вікно
    document.querySelector('.fixed')?.remove();
    
    // Оновлюємо відображення
    const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab') || currentTab;
    if (activeTab) {
      renderTabContent(activeTab);
    }
    
    // Принудительно обновляем статус в таблице
    setTimeout(() => {
      const statusElements = document.querySelectorAll(`[data-client-code="${clientCode}"] .client-status`);
      statusElements.forEach(element => {
        element.innerHTML = renderClientStatus(clientCode);
      });
    }, 50);
    
    // Принудительно обновляем вкладку "Прогноз" если она активна
    if (activeTab === 'forecast') {
      setTimeout(() => {
        renderMissedForecast();
      }, 100);
    }
    
    // Показуємо повідомлення
    showActionNotification(`Статус змінено на: ${selectedStatus}`, 'success');
    
  } catch (error) {
    console.error('❌ Помилка зміни статусу:', error);
    showActionNotification('Помилка зміни статусу: ' + error.message, 'error');
  }
};

// Функція для перемикання панелі деталей дій по даті
window.toggleActionDetails = function(safeId) {
  const details = document.getElementById(safeId);
  const arrow = document.getElementById(`arrow-${safeId}`);
  
  if (!details || !arrow) return;
  
  // Перемикаємо видимість
  details.classList.toggle('hidden');
  
  // Повертаємо стрілку
  if (details.classList.contains('hidden')) {
    arrow.style.transform = 'rotate(0deg)';
  } else {
    arrow.style.transform = 'rotate(90deg)';
  }
};

// Функція для відображення історії дій клієнта
function renderClientActionsHistory(clientCode) {
  const clientData = window.clientActionsData?.[clientCode] || signalizationData.clientActionsData?.[clientCode];
  
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
  
  // Сортуємо дії по даті (нові зверху)  
  const sortedActions = [...clientData.actions].sort((a, b) => {
    const dateA = a && a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b && b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  });
  
  // Групуємо дії по датах
  const groupedByDate = {};
  sortedActions.forEach(action => {
    if (!action || !action.createdAt) return; // Пропускаємо дії без дати
    
    const createdDate = new Date(action.createdAt);
    const dateKey = createdDate.toLocaleDateString('uk-UA');
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(action);
  });
  
  // Сортуємо дати (нові зверху)
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
        
        // Визначаємо іконки для дій в цей день
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
            <!-- Компактний рядок дати -->
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
                  ${dayActions[0] && dayActions[0].createdAt ? new Date(dayActions[0].createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''}
                  ${dayActions.length > 1 && dayActions[dayActions.length-1] && dayActions[dayActions.length-1].createdAt ? ` - ${new Date(dayActions[dayActions.length-1].createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
              </div>
            </div>
            
            <!-- Детальна інформація (прихована за замовчуванням) -->
            <div id="${safeId}" class="hidden border-t border-gray-700">
              ${dayActions.map((action, index) => {
                const actionLabels = {
                  'call': 'Дзвінок',
                  'meeting': 'Зустріч',
                  'email': 'Email',
                  'proposal': 'Комерційна пропозиція'
                };
                
                const createdDate = action && action.createdAt ? new Date(action.createdAt) : new Date();
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

// Швидка дія по клієнту
window.quickAction = function(clientCode, actionType) {
  // Показуємо модальне вікно для введення деталей дії
  showActionModal(clientCode, actionType);
};

// Експортуємо функції для глобального доступу
window.checkAndUpdateClientStatuses = checkAndUpdateClientStatuses;
window.renderClientActionsHistory = renderClientActionsHistory;

// Перемикання вкладок передач клієнтів
function switchTransferredClientsTab(transferType) {
  // Оновлюємо активну вкладку
  document.querySelectorAll('.transferred-clients-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Безпечно додаємо активний клас
  const activeTab = document.querySelector(`[data-transfer="${transferType}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  } else {
    console.warn(`Вкладка з data-transfer="${transferType}" не знайдена`);
  }
  
  const contentDiv = document.getElementById('transferred-clients-tab-content');
  
  switch(transferType) {
    case 'list':
      renderTransfersList();
      break;
    case 'statistics':
      renderTransfersStatistics();
      break;
  }
}

// Рендеринг списка передач
function renderTransfersList() {
  const contentDiv = document.getElementById('transferred-clients-tab-content');
  
  if (!signalizationData || !signalizationData.masterData) {
    contentDiv.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }

  // Аналізуємо передачі клієнтів
  const transfers = analyzeClientTransfers();
  
  contentDiv.innerHTML = `
    ${transfers.length > 0 ? `
      <div class="stats-summary mb-4">
        <div class="flex justify-between items-center mb-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-gray-100 p-3 rounded-lg">
              <h4 class="text-sm font-semibold text-gray-800">Всього передач</h4>
              <p class="text-xl font-bold text-blue-600">${transfers.length}</p>
              <p class="text-xs text-gray-500">Передачі за останні ${currentPeriod} місяці</p>
            </div>
            <div class="bg-gray-100 p-3 rounded-lg">
              <h4 class="text-sm font-semibold text-gray-800">Унікальних клієнтів</h4>
              <p class="text-xl font-bold text-green-600">${new Set(transfers.map(t => t.clientCode)).size}</p>
              <p class="text-xs text-gray-500">Клієнти з передачами за ${currentPeriod} міс.</p>
            </div>
            <div class="bg-gray-100 p-3 rounded-lg">
              <h4 class="text-sm font-semibold text-gray-800">Залучених менеджерів</h4>
              <p class="text-xl font-bold text-purple-600">${new Set(transfers.flatMap(t => [t.fromManager, t.toManager])).size}</p>
              <p class="text-xs text-gray-500">Менеджери за ${currentPeriod} міс.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="table-container">
        ${renderTransfersTable(transfers)}
      </div>
    ` : `
      <div class="empty-state">
        <i class="fas fa-exchange-alt text-gray-400 text-4xl mb-4"></i>
        <h4 class="text-xl font-semibold text-gray-600 mb-2">Передач не знайдено</h4>
        <p class="text-gray-500">За вибраний період передач клієнтів між менеджерами не було</p>
      </div>
    `}
  `;
  
  // Налаштовуємо обробники подій для таблиці передач
  setupDynamicEventListeners();
  
  // Добавляем обработчики для кнопок сортировки
  setupTransfersSortHandlers(transfers);
}

// Рендеринг статистики передач
function renderTransfersStatistics() {
  const contentDiv = document.getElementById('transferred-clients-tab-content');
  
  if (!signalizationData || !signalizationData.masterData) {
    contentDiv.innerHTML = '<p>Дані не завантажені</p>';
    return;
  }
  
  // Аналізуємо передачі клієнтів
  const transfers = analyzeClientTransfers();
  
  if (transfers.length === 0) {
    contentDiv.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-chart-bar text-gray-400 text-4xl mb-4"></i>
        <h4 class="text-xl font-semibold text-gray-600 mb-2">Статистика недоступна</h4>
        <p class="text-gray-500">Немає даних для відображення статистики</p>
      </div>
    `;
    return;
  }
  
  // Аналізуємо статистику
  const statistics = analyzeTransfersStatistics(transfers) || {
    totalTransfers: 0,
    uniqueClients: 0,
    uniqueManagers: 0,
    periods: {},
    departments: {},
    managers: {}
  };
  const conversion = analyzeTransferConversion(transfers) || {
    conversionRate: 0,
    averageRevenueAfterTransfer: 0
  };
  
  // Генерируем опции для месяцев и лет
  const monthOptions = Array.from({length: 12}, (_, i) => 
    `<option value="${i + 1}">${getMonthName(i + 1)}</option>`
  ).join('');
  
  const yearOptions = generateYearOptions();
  
  contentDiv.innerHTML = `
    <div class="transfers-statistics-content">
      <!-- Фильтры по периоду -->
      <div class="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 class="text-lg font-semibold text-white mb-4">Фільтр за періодом</h3>
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <label class="text-gray-300 text-sm">Місяць:</label>
            <select class="month-select bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm">
              ${monthOptions}
            </select>
          </div>
          <div class="flex items-center space-x-2">
            <label class="text-gray-300 text-sm">Рік:</label>
            <select class="year-select bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm">
              ${yearOptions}
            </select>
          </div>
          <button class="apply-date-filter px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
            Застосувати
          </button>
        </div>
      </div>
      
      <!-- Общая статистика -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-800 p-4 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-300 mb-2">Всього передач</h4>
          <p class="text-2xl font-bold text-blue-400">${statistics.totalTransfers}</p>
          </div>
        <div class="bg-gray-800 p-4 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-300 mb-2">Унікальних клієнтів</h4>
          <p class="text-2xl font-bold text-green-400">${statistics.uniqueClients}</p>
          </div>
        <div class="bg-gray-800 p-4 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-300 mb-2">Залучених менеджерів</h4>
          <p class="text-2xl font-bold text-purple-400">${statistics.uniqueManagers}</p>
          </div>
        <div class="bg-gray-800 p-4 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-300 mb-2">Конверсія</h4>
          <p class="text-2xl font-bold text-yellow-400">${conversion.conversionRate}%</p>
        </div>
      </div>
      
      <!-- Суммы отгрузки -->
      <div class="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 class="text-lg font-semibold text-white mb-4">Сумми відгрузки</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center">
            <h4 class="text-sm font-semibold text-gray-300 mb-2">До передачі</h4>
            <p class="text-xl font-bold text-green-400">${calculateTotalRevenueBeforeTransfer(transfers).toFixed(2)} грн</p>
          </div>
          <div class="text-center">
            <h4 class="text-sm font-semibold text-gray-300 mb-2">Після передачі</h4>
            <p class="text-xl font-bold text-blue-400">${calculateTotalRevenueAfterTransfer(transfers).toFixed(2)} грн</p>
          </div>
          <div class="text-center">
            <h4 class="text-sm font-semibold text-gray-300 mb-2">Зміна</h4>
            <p class="text-xl font-bold ${calculateRevenueChange(transfers) >= 0 ? 'text-green-400' : 'text-red-400'}">
              ${calculateRevenueChange(transfers).toFixed(2)} грн
            </p>
          </div>
        </div>
      </div>
      
      <!-- Статистика по периодам -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-white mb-4">По періодах</h3>
        <div class="bg-gray-800 rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-gray-300">Період</th>
                <th class="px-4 py-2 text-left text-gray-300">Передачі</th>
                <th class="px-4 py-2 text-left text-gray-300">Клієнти</th>
                <th class="px-4 py-2 text-left text-gray-300">Менеджери</th>
                  </tr>
                </thead>
                <tbody>
              ${Object.entries(statistics.periods).map(([period, data]) => `
                <tr class="border-b border-gray-700">
                  <td class="px-4 py-2 font-medium text-white">${period}</td>
                  <td class="px-4 py-2 text-blue-400">${data.transfers}</td>
                  <td class="px-4 py-2 text-green-400">${data.clients}</td>
                  <td class="px-4 py-2 text-purple-400">${data.managers}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
                        </div>
      </div>
      
      <!-- Статистика по отделам -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-white mb-4">По відділах</h3>
        <div class="bg-gray-800 rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-gray-300">Відділ</th>
                <th class="px-4 py-2 text-left text-gray-300">Відправлено</th>
                <th class="px-4 py-2 text-left text-gray-300">Отримано</th>
                <th class="px-4 py-2 text-left text-gray-300">Клієнти</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(statistics.departments).map(([department, data]) => `
                <tr class="border-b border-gray-700">
                  <td class="px-4 py-2 font-medium text-white">${department}</td>
                  <td class="px-4 py-2 text-red-400">${data.sent}</td>
                  <td class="px-4 py-2 text-green-400">${data.received}</td>
                  <td class="px-4 py-2 text-gray-300">${data.clients.size}</td>
                </tr>
              `).join('')}
                </tbody>
              </table>
          </div>
        </div>
        
      <!-- Статистика по менеджерам -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-white mb-4">По менеджерах</h3>
        <div class="bg-gray-800 rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-gray-300">Менеджер</th>
                <th class="px-4 py-2 text-left text-gray-300">Відправлено</th>
                <th class="px-4 py-2 text-left text-gray-300">Отримано</th>
                <th class="px-4 py-2 text-left text-gray-300">Клієнти</th>
                <th class="px-4 py-2 text-left text-gray-300">Сума до передачі</th>
                <th class="px-4 py-2 text-left text-gray-300">Сума після передачі</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(statistics.managers).map(([manager, data]) => {
                const managerTransfers = transfers.filter(t => t.fromManager === manager || t.toManager === manager);
                const revenueBefore = calculateManagerRevenueBefore(managerTransfers, manager);
                const revenueAfter = calculateManagerRevenueAfter(managerTransfers, manager);
                return `
                  <tr class="border-b border-gray-700">
                    <td class="px-4 py-2 font-medium text-white">${manager}</td>
                    <td class="px-4 py-2 text-red-400">${data.sent}</td>
                    <td class="px-4 py-2 text-green-400">${data.received}</td>
                    <td class="px-4 py-2 text-gray-300">${data.clients.size}</td>
                    <td class="px-4 py-2 text-gray-300">${revenueBefore.toFixed(2)} грн</td>
                    <td class="px-4 py-2 text-gray-300">${revenueAfter.toFixed(2)} грн</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // Добавляем обработчики для фильтров
  setupTransfersStatisticsHandlers(transfers);
}

// Настройка обработчиков для статистики передач
function setupTransfersStatisticsHandlers(transfers) {
  const applyDateFilter = document.querySelector('.apply-date-filter');
  const monthSelect = document.querySelector('.month-select');
  const yearSelect = document.querySelector('.year-select');
  
  if (applyDateFilter && monthSelect && yearSelect) {
    applyDateFilter.addEventListener('click', () => {
      const selectedMonth = parseInt(monthSelect.value);
      const selectedYear = parseInt(yearSelect.value);
      
      // Фильтруем передачи по выбранному месяцу и году
      const newFilteredTransfers = transfers.filter(transfer => {
        const transferDate = transfer.transferDate;
        const transferMonth = transferDate.getMonth() + 1;
        const transferYear = transferDate.getFullYear();
        return transferMonth === selectedMonth && transferYear === selectedYear;
      });
      
      // Обновляем статистику для выбранного периода
      updateStatisticsForSubmodule(newFilteredTransfers, selectedMonth, selectedYear, transfers);
      
      // Сохраняем выбранные значения
      setTimeout(() => {
        monthSelect.value = selectedMonth;
        yearSelect.value = selectedYear;
      }, 0);
    });
  }
}

// Обновление статистики для подмодуля
function updateStatisticsForSubmodule(filteredTransfers, selectedMonth, selectedYear, allTransfers) {
  // Анализируем статистику для отфильтрованных передач
  const monthStatistics = analyzeTransfersStatistics(filteredTransfers);
  const conversion = analyzeTransferConversion(filteredTransfers);
  
  // Обновляем общую статистику
  const statsCards = document.querySelectorAll('.transfers-statistics-content .bg-gray-800');
  if (statsCards.length >= 4) {
    // Всього передач
    const totalTransfersCard = statsCards[0];
    if (totalTransfersCard) {
      const valueElement = totalTransfersCard.querySelector('p');
      if (valueElement) {
        valueElement.textContent = monthStatistics.totalTransfers || 0;
      }
    }
    
    // Унікальних клієнтів
    const uniqueClientsCard = statsCards[1];
    if (uniqueClientsCard) {
      const valueElement = uniqueClientsCard.querySelector('p');
      if (valueElement) {
        valueElement.textContent = monthStatistics.uniqueClients || 0;
      }
    }
    
    // Залучених менеджерів
    const uniqueManagersCard = statsCards[2];
    if (uniqueManagersCard) {
      const valueElement = uniqueManagersCard.querySelector('p');
      if (valueElement) {
        valueElement.textContent = monthStatistics.uniqueManagers || 0;
      }
    }
    
    // Конверсія
    const conversionCard = statsCards[3];
    if (conversionCard) {
      const valueElement = conversionCard.querySelector('p');
      if (valueElement) {
        valueElement.textContent = `${conversion.conversionRate || 0}%`;
      }
    }
  }
  
  // Обновляем суммы отгрузки
  const revenueSection = document.querySelector('.transfers-statistics-content .mb-6:nth-of-type(3)');
  if (revenueSection) {
    const revenueValues = revenueSection.querySelectorAll('.text-xl');
    if (revenueValues.length >= 3) {
      // До передачі
      revenueValues[0].textContent = `${calculateTotalRevenueBeforeTransfer(filteredTransfers).toFixed(2)} грн`;
      // Після передачі
      revenueValues[1].textContent = `${calculateTotalRevenueAfterTransfer(filteredTransfers).toFixed(2)} грн`;
      // Зміна
      const change = calculateRevenueChange(filteredTransfers);
      revenueValues[2].textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)} грн`;
      revenueValues[2].className = `text-xl font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`;
    }
  }
  
  // Обновляем таблицу по периодам
  const periodsTable = document.querySelector('.transfers-statistics-content .bg-gray-800:nth-of-type(4) tbody');
  if (periodsTable && monthStatistics.periods) {
    periodsTable.innerHTML = Object.entries(monthStatistics.periods).map(([period, data]) => `
      <tr class="border-b border-gray-700">
        <td class="px-4 py-2 font-medium text-white">${period}</td>
        <td class="px-4 py-2 text-blue-400">${data.transfers || 0}</td>
        <td class="px-4 py-2 text-green-400">${data.clients || 0}</td>
        <td class="px-4 py-2 text-purple-400">${data.managers || 0}</td>
      </tr>
    `).join('');
  }
  
  // Обновляем таблицу по отделам
  const departmentsTable = document.querySelector('.transfers-statistics-content .bg-gray-800:nth-of-type(5) tbody');
  if (departmentsTable && monthStatistics.departments) {
    departmentsTable.innerHTML = Object.entries(monthStatistics.departments).map(([department, data]) => `
      <tr class="border-b border-gray-700">
        <td class="px-4 py-2 font-medium text-white">${department}</td>
        <td class="px-4 py-2 text-red-400">${data.sent || 0}</td>
        <td class="px-4 py-2 text-green-400">${data.received || 0}</td>
        <td class="px-4 py-2 text-gray-300">${data.clients ? data.clients.size : 0}</td>
      </tr>
    `).join('');
  }
  
  // Обновляем таблицу по менеджерам
  const managersTable = document.querySelector('.transfers-statistics-content .bg-gray-800:nth-of-type(6) tbody');
  if (managersTable && monthStatistics.managers) {
    managersTable.innerHTML = Object.entries(monthStatistics.managers).map(([manager, data]) => {
      const managerTransfers = filteredTransfers.filter(t => t.fromManager === manager || t.toManager === manager);
      const revenueBefore = calculateManagerRevenueBefore(managerTransfers, manager);
      const revenueAfter = calculateManagerRevenueAfter(managerTransfers, manager);
      return `
        <tr class="border-b border-gray-700">
          <td class="px-4 py-2 font-medium text-white">${manager}</td>
          <td class="px-4 py-2 text-red-400">${data.sent || 0}</td>
          <td class="px-4 py-2 text-green-400">${data.received || 0}</td>
          <td class="px-4 py-2 text-gray-300">${data.clients ? data.clients.size : 0}</td>
          <td class="px-4 py-2 text-gray-300">${revenueBefore.toFixed(2)} грн</td>
          <td class="px-4 py-2 text-gray-300">${revenueAfter.toFixed(2)} грн</td>
        </tr>
      `;
    }).join('');
  }
}
