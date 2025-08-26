// FocusFilters.js - Модуль фильтров для Фокус 2.0
import * as firebase from '../../firebase.js';

export class FocusFilters {
  constructor() {
    this.filters = {
      department: '',
      manager: '',
      status: '',
      period: '',
      search: ''
    };
    
    this.availableFilters = {
      departments: [],
      managers: [],
      statuses: ['active', 'completed', 'paused', 'archived']
    };
  }
  
  async init() {
    try {
      // Загружаем доступные фильтры
      await this.loadAvailableFilters();
      
      // Оновлюємо UI після ініціалізації
      setTimeout(() => this.updateFiltersUI(), 200);
      
    } catch (error) {
      console.error('❌ Помилка ініціалізації фільтрів:', error);
    }
  }
  
  /**
   * Загрузка доступных фильтров
   */
  async loadAvailableFilters() {
    try {
      // Получаем отделы и менеджеров из справочника клиент-менеджер
      const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
      
      // Извлекаем уникальные отделы и менеджеров
      const departments = new Set();
      const managers = new Set();
      
      Object.values(clientManagerDirectory).forEach(client => {
        if (client.department && client.department.trim()) {
          departments.add(client.department.trim());
        }
        if (client.manager && client.manager.trim()) {
          managers.add(client.manager.trim());
        }
      });
      
      this.availableFilters.departments = Array.from(departments).sort();
      this.availableFilters.managers = Array.from(managers).sort();
      
      // Загружаем данные из Firebase если есть компания
      const companyId = window.state?.currentCompanyId;
      if (companyId) {
        await this.loadFiltersFromFirebase(companyId);
      }
      
      // Примусово оновлюємо UI фільтрів
      this.updateFiltersUI();
      
    } catch (error) {
      console.error('❌ Помилка завантаження доступних фільтрів:', error);
    }
  }
  
  /**
   * Загрузка фильтров из Firebase коллекций
   */
  async loadFiltersFromFirebase(companyId) {
    try {
      // Загружаем отделы из Firebase
      const departmentsRef = firebase.collection(firebase.db, 'companies', companyId, 'departments');
      const departmentsSnapshot = await firebase.getDocs(departmentsRef);
      const departmentsData = departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Загружаем сотрудников из Firebase
      const employeesRef = firebase.collection(firebase.db, 'companies', companyId, 'employees');
      const employeesSnapshot = await firebase.getDocs(employeesRef);
      const allEmployees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Фильтруем менеджеров
      let managersData = allEmployees.filter(emp => {
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
        managersData = allEmployees;
      }
      
      // Сохраняем данные для использования в фильтрации
      this.managersData = managersData;
      this.departmentsData = departmentsData;
      
    } catch (error) {
      console.error('❌ Помилка завантаження фільтрів з Firebase:', error);
    }
  }
  
  /**
   * Рендеринг фильтров
   */
  render() {
    // Используем данные из Firebase если они есть
    let departmentsOptions = '';
    let managersOptions = '';
    
    if (this.departmentsData && this.departmentsData.length > 0) {
      // Используем отделы из Firebase
      departmentsOptions = this.departmentsData
        .map(dept => `<option value="${dept.id}">${dept.name || dept.id}</option>`)
        .join('');
    } else {
      // Fallback: используем отделы из availableFilters
      departmentsOptions = this.availableFilters.departments.length > 0 
        ? this.availableFilters.departments.map(dept => `<option value="${dept}">${dept}</option>`).join('')
        : '<option value="" disabled>Немає даних</option>';
    }
    
    if (this.managersData && this.managersData.length > 0) {
      // Используем менеджеров из Firebase
      managersOptions = this.managersData
        .map(manager => `<option value="${manager.id}">${manager.name || manager.id}</option>`)
        .join('');
    } else {
      // Fallback: используем менеджеров из availableFilters
      managersOptions = this.availableFilters.managers.length > 0 
        ? this.availableFilters.managers.map(manager => `<option value="${manager}">${manager}</option>`).join('')
        : '<option value="" disabled>Немає даних</option>';
    }
    
    return `
      <div class="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 class="text-lg font-semibold text-white mb-4">Фільтри</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <!-- Отдел -->
          <div>
            <label class="block text-gray-300 text-sm mb-1">Відділ (${this.departmentsData ? this.departmentsData.length : this.availableFilters.departments.length})</label>
            <select id="department-filter" class="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm">
              <option value="">Всі відділи</option>
              ${departmentsOptions}
            </select>
          </div>
          
          <!-- Менеджер -->
          <div>
            <label class="block text-gray-300 text-sm mb-1">Менеджер (${this.managersData ? this.managersData.length : this.availableFilters.managers.length})</label>
            <select id="manager-filter" class="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm">
              <option value="">Всі менеджери</option>
              ${managersOptions}
            </select>
          </div>
          
          <!-- Статус -->
          <div>
            <label class="block text-gray-300 text-sm mb-1">Статус</label>
            <select id="status-filter" class="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm">
              <option value="">Всі статуси</option>
              <option value="active">Активні</option>
              <option value="completed">Завершені</option>
              <option value="paused">Призупинені</option>
              <option value="archived">Архівовані</option>
            </select>
          </div>
          
          <!-- Период -->
          <div>
            <label class="block text-gray-300 text-sm mb-1">Період</label>
            <select id="period-filter" class="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm">
              <option value="">Всі періоди</option>
              <option value="month">Місяць</option>
              <option value="quarter">Квартал</option>
              <option value="custom">Інший</option>
            </select>
          </div>
          
          <!-- Поиск -->
          <div>
            <label class="block text-gray-300 text-sm mb-1">Пошук</label>
            <input type="text" id="search-filter" 
                   class="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm" 
                   placeholder="Назва задачі...">
          </div>
          
          <!-- Кнопка сброса -->
          <div class="flex items-end space-x-2">
            <button id="reset-filters" 
                    class="flex-1 bg-gray-600 text-white rounded px-3 py-2 text-sm hover:bg-gray-500">
              Скинути
            </button>
            <button id="refresh-filters" 
                    class="flex-1 bg-blue-600 text-white rounded px-3 py-2 text-sm hover:bg-blue-500"
                    onclick="window.focus2Components.filters.loadAvailableFilters()">
              Оновити
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Применение фильтров к задачам
   */
  applyFilters(tasks) {
    if (!tasks || !Array.isArray(tasks)) {
      return [];
    }
    
    return tasks.filter(task => {
      // Фильтр по отделу (через клиентов задачи)
      if (this.filters.department && task.hasClientsSnapshot) {
        // Здесь можно добавить логику фильтрации по отделу через клиентов
        // Пока что пропускаем, так как нужно загружать clientsSnapshot
      }
      
      // Фильтр по статусу
      if (this.filters.status && task.status !== this.filters.status) {
        return false;
      }
      
      // Фильтр по периоду
      if (this.filters.period) {
        const now = new Date();
        const taskStart = task.periodFrom ? new Date(task.periodFrom) : null;
        const taskEnd = task.periodTo ? new Date(task.periodTo) : null;
        
        let matchesPeriod = false;
        
        switch (this.filters.period) {
          case 'current':
            // Поточний місяць
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            if (taskStart && taskEnd) {
              const startMonth = taskStart.getMonth();
              const startYear = taskStart.getFullYear();
              const endMonth = taskEnd.getMonth();
              const endYear = taskEnd.getFullYear();
              matchesPeriod = (startYear === currentYear && startMonth === currentMonth) ||
                             (endYear === currentYear && endMonth === currentMonth) ||
                             (startYear < currentYear && endYear > currentYear) ||
                             (startYear === currentYear && endYear === currentYear && startMonth <= currentMonth && endMonth >= currentMonth);
            }
            break;
          case 'next':
            // Наступний місяць
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const nextMonthNum = nextMonth.getMonth();
            const nextYear = nextMonth.getFullYear();
            if (taskStart && taskEnd) {
              const startMonth = taskStart.getMonth();
              const startYear = taskStart.getFullYear();
              const endMonth = taskEnd.getMonth();
              const endYear = taskEnd.getFullYear();
              matchesPeriod = (startYear === nextYear && startMonth === nextMonthNum) ||
                             (endYear === nextYear && endMonth === nextMonthNum) ||
                             (startYear < nextYear && endYear > nextYear) ||
                             (startYear === nextYear && endYear === nextYear && startMonth <= nextMonthNum && endMonth >= nextMonthNum);
            }
            break;
          case 'past':
            // Минулі місяці
            if (taskStart && taskEnd) {
              matchesPeriod = taskEnd < now;
            }
            break;
        }
        
        if (!matchesPeriod) {
          return false;
        }
      }
      
      // Фильтр по поиску
      if (this.filters.search) {
        const searchTerm = this.filters.search.toLowerCase();
        const title = (task.title || '').toLowerCase();
        const description = (task.description || '').toLowerCase();
        
        if (!title.includes(searchTerm) && !description.includes(searchTerm)) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Создание маппинга менеджер-отдел из справочника клиентов
   */
  createManagerDepartmentMap() {
    const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
    const managerDepartmentMap = {};
    
    Object.values(clientManagerDirectory).forEach(client => {
      if (client.manager && client.department) {
        managerDepartmentMap[client.manager.trim()] = client.department.trim();
      }
    });
    
    return managerDepartmentMap;
  }

  /**
   * Применение фильтров к клиентам
   */
  applyClientFilters(clients, notes = {}) {
    if (!clients || !Array.isArray(clients)) {
      return [];
    }
    
    let filteredClients = [...clients];
    
    // Используем данные из Firebase если они есть (как в debts.js)
    if (this.departmentsData && this.departmentsData.length > 0 && this.managersData && this.managersData.length > 0) {
      
      // 1. Сначала фильтруем по отделу (как в debts.js)
      if (this.filters.department && this.filters.department !== 'Всі відділи') {
        const selectedDepartment = this.departmentsData.find(dept => dept.id === this.filters.department);
        
        if (selectedDepartment) {
          // Находим менеджеров отдела
          const departmentManagersNames = this.managersData
            .filter(manager => {
              const match1 = manager.departmentId === this.filters.department;
              const match2 = manager.department === this.filters.department;
              const match3 = manager.department && manager.department.id === this.filters.department;
              return match1 || match2 || match3;
            })
            .map(manager => manager.name);
          
          // Фильтруем клиентов по менеджерам отдела
          filteredClients = filteredClients.filter(client => {
            const clientManager = client.manager || this.getClientManager(client.code);
            return departmentManagersNames.includes(clientManager);
          });
        }
      }
      
      // 2. Затем фильтруем по менеджеру
      if (this.filters.manager && this.filters.manager !== 'Всі менеджери') {
        const selectedManager = this.managersData.find(m => m.id === this.filters.manager);
        
        if (selectedManager) {
          filteredClients = filteredClients.filter(client => {
            const clientManager = client.manager || this.getClientManager(client.code);
            return clientManager === selectedManager.name;
          });
        }
      }
      
    } else {
      // Fallback: используем данные из clientManagerDirectory
      const managerDepartmentMap = this.createManagerDepartmentMap();
      
      // Фильтр по отделу
      if (this.filters.department && this.filters.department !== 'Всі відділи') {
        filteredClients = filteredClients.filter(client => {
          const clientManager = client.manager || this.getClientManager(client.code);
          const clientManagerDepartment = managerDepartmentMap[clientManager];
          return clientManagerDepartment === this.filters.department;
        });
      }
      
      // Фильтр по менеджеру
      if (this.filters.manager && this.filters.manager !== 'Всі менеджери') {
        filteredClients = filteredClients.filter(client => {
          const clientManager = client.manager || this.getClientManager(client.code);
          return clientManager === this.filters.manager;
        });
      }
    }
    
    // Фильтр по поиску
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filteredClients = filteredClients.filter(client => {
        const clientName = (client.name || '').toLowerCase();
        const clientCode = (client.code || '').toLowerCase();
        return clientName.includes(searchTerm) || clientCode.includes(searchTerm);
      });
    }
    
    return filteredClients;
  }
  
  /**
   * Установка фильтра
   */
  setFilter(filterName, value) {
    this.filters[filterName] = value;
  }
  
  /**
   * Сброс всех фильтров
   */
  resetFilters() {
    this.filters = {
      department: '',
      manager: '',
      status: '',
      period: '',
      search: ''
    };
    console.log('🔧 Фільтри скинуто');
  }
  
  /**
   * Получение менеджера клиента
   */
  getClientManager(clientCode) {
    const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
    return clientManagerDirectory[clientCode]?.manager || 'Без менеджера';
  }
  
  /**
   * Получение отдела клиента
   */
  getClientDepartment(clientCode) {
    const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
    return clientManagerDirectory[clientCode]?.department || 'Без відділу';
  }
  
  /**
   * Получение текущих фильтров
   */
  getCurrentFilters() {
    return { ...this.filters };
  }
  
  /**
   * Обновление фильтра менеджеров при изменении отдела (как в debts.js)
   */
  updateManagersFilter() {
    console.log('🔄 updateManagersFilter викликано');
    
    // Пробуємо знайти фільтри з різними ID (UI використовує client- префікс)
    const departmentFilter = document.getElementById('client-department-filter') || document.getElementById('department-filter');
    const managerFilter = document.getElementById('client-manager-filter') || document.getElementById('manager-filter');
    
    if (!departmentFilter || !managerFilter) {
      console.error('❌ Не знайдено елементи фільтрів');
      console.log('🔍 Шукаємо елементи:');
      console.log('- client-department-filter:', !!document.getElementById('client-department-filter'));
      console.log('- department-filter:', !!document.getElementById('department-filter'));
      console.log('- client-manager-filter:', !!document.getElementById('client-manager-filter'));
      console.log('- manager-filter:', !!document.getElementById('manager-filter'));
      return;
    }
    
    const selectedDepartment = departmentFilter.value;
    const currentManager = managerFilter.value;
    
    console.log('📊 Поточні значення:', {
      selectedDepartment,
      currentManager,
      'departmentsData.length': this.departmentsData?.length || 0,
      'managersData.length': this.managersData?.length || 0
    });
    
    let managerOptions = '';
    let filteredManagers = [];
    
    // Используем данные из Firebase если они есть (как в debts.js)
    if (this.departmentsData && this.departmentsData.length > 0 && this.managersData && this.managersData.length > 0) {
      console.log('✅ Використовуємо Firebase дані для оновлення менеджерів');
      
      if (selectedDepartment && selectedDepartment !== '') {
        // Фильтруем менеджеров по отделу из Firebase (как в debts.js)
        filteredManagers = this.managersData
          .filter(manager => {
            // Проверяем разные возможные поля для связи с отделом (как в debts.js)
            const match1 = manager.departmentId === selectedDepartment;
            const match2 = manager.department === selectedDepartment;
            const match3 = manager.department && manager.department.id === selectedDepartment;
            return match1 || match2 || match3;
          })
          .map(manager => ({ id: manager.id, name: manager.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`🔍 Знайдено ${filteredManagers.length} менеджерів для відділу ${selectedDepartment}`);
      } else {
        // Показываем всех менеджеров из Firebase
        filteredManagers = this.managersData
          .map(manager => ({ id: manager.id, name: manager.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        console.log('📋 Показуємо всіх менеджерів');
      }
      
    } else {
      console.log('⚠️ Використовуємо Fallback дані');
      
      // Fallback: используем данные из availableFilters
      if (selectedDepartment && selectedDepartment !== '') {
        const managerDepartmentMap = this.createManagerDepartmentMap();
        filteredManagers = Object.keys(managerDepartmentMap)
          .filter(manager => managerDepartmentMap[manager] === selectedDepartment)
          .map(manager => ({ id: manager, name: manager }))
          .sort();
        
        console.log(`🔍 Знайдено ${filteredManagers.length} менеджерів для відділу ${selectedDepartment} (Fallback)`);
      } else {
        filteredManagers = this.availableFilters.managers.map(manager => ({ id: manager, name: manager }));
        console.log('📋 Показуємо всіх менеджерів (Fallback)');
      }
    }
    
    managerOptions = filteredManagers.map(manager => 
      `<option value="${manager.id}">${manager.name}</option>`
    ).join('');
    
    // Обновляем HTML фильтра менеджеров
    const newHTML = `
      <option value="">Всі менеджери</option>
      ${managerOptions}
    `;
    
    console.log('🔄 Оновлюємо HTML фільтра менеджерів, опцій:', managerOptions.split('</option>').length - 1);
    managerFilter.innerHTML = newHTML;
    
    // Восстанавливаем выбор менеджера после обновления HTML
    if (currentManager) {
      const managerExists = filteredManagers.find(m => m.id === currentManager);
      if (managerExists) {
        console.log('✅ Відновлюємо вибір менеджера після оновлення HTML:', currentManager);
        managerFilter.value = currentManager;
      } else {
        console.log('🔄 Скидаємо вибір менеджера (не належить новому відділу):', currentManager);
        managerFilter.value = '';
      }
    }
    
    console.log('✅ updateManagersFilter завершено');
  }
  

  
  /**
   * Оновлення UI фільтрів
   */
  updateFiltersUI() {
    // Додаємо невелику затримку, щоб DOM елементи встигли створитися
    setTimeout(() => {
      try {
        // UI використовує client- префікс, тому шукаємо обидва варіанти
        const departmentSelect = document.getElementById('client-department-filter') || document.getElementById('department-filter');
        const managerSelect = document.getElementById('client-manager-filter') || document.getElementById('manager-filter');
        
        if (departmentSelect && this.departmentsData && this.departmentsData.length > 0) {
          const currentValue = departmentSelect.value;
          departmentSelect.innerHTML = `
            <option value="">Всі відділи</option>
            ${this.departmentsData.map(dept => 
              `<option value="${dept.id}" ${dept.id === currentValue ? 'selected' : ''}>${dept.name || dept.id}</option>`
            ).join('')}
          `;
        } else if (departmentSelect && this.availableFilters.departments.length > 0) {
          const currentValue = departmentSelect.value;
          departmentSelect.innerHTML = `
            <option value="">Всі відділи</option>
            ${this.availableFilters.departments.map(dept => 
              `<option value="${dept}" ${dept === currentValue ? 'selected' : ''}>${dept}</option>`
            ).join('')}
          `;
        }
        
        if (managerSelect && this.managersData && this.managersData.length > 0) {
          const currentValue = managerSelect.value;
          managerSelect.innerHTML = `
            <option value="">Всі менеджери</option>
            ${this.managersData.map(manager => 
              `<option value="${manager.id}" ${manager.id === currentValue ? 'selected' : ''}>${manager.name || manager.id}</option>`
            ).join('')}
          `;
        } else if (managerSelect && this.availableFilters.managers.length > 0) {
          const currentValue = managerSelect.value;
          managerSelect.innerHTML = `
            <option value="">Всі менеджери</option>
            ${this.availableFilters.managers.map(manager => 
              `<option value="${manager}" ${manager === currentValue ? 'selected' : ''}>${manager}</option>`
            ).join('')}
          `;
        }
        
        // Прив'язуємо обробники подій до фільтрів
        this.attachFilterEventHandlers();
        
      } catch (error) {
        console.error('❌ Помилка оновлення UI фільтрів:', error);
      }
    }, 100);
  }
  
  /**
   * Прив'язування обробників подій до фільтрів
   */
  attachFilterEventHandlers() {
    try {
      // Обробники для фільтрів задач
      const taskFilters = [
        'task-status-filter',
        'task-period-filter',
        'task-search-filter'
      ];
      
      taskFilters.forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
          // Видаляємо старі обробники
          filterElement.removeEventListener('change', this.handleTaskFilterChange);
          filterElement.removeEventListener('input', this.handleTaskFilterChange);
          
          // Додаємо нові обробники
          filterElement.addEventListener('change', this.handleTaskFilterChange.bind(this));
          filterElement.addEventListener('input', this.handleTaskFilterChange.bind(this));
        } else {
          console.warn(`⚠️ Елемент фільтра не знайдено: ${filterId}`);
        }
      });

      // Обробники для фільтрів відділу та менеджера (як в debts.js)
      // UI використовує client- префікс, тому шукаємо обидва варіанти
      const departmentFilter = document.getElementById('client-department-filter') || document.getElementById('department-filter');
      const managerFilter = document.getElementById('client-manager-filter') || document.getElementById('manager-filter');
      
      if (departmentFilter) {
        // Видаляємо старі обробники
        departmentFilter.removeEventListener('change', this.handleDepartmentFilterChange);
        
        // Додаємо новий обробник
        departmentFilter.addEventListener('change', this.handleDepartmentFilterChange.bind(this));
        console.log('✅ Обробник для фільтра відділу встановлено:', departmentFilter.id);
      }
      
      if (managerFilter) {
        // Видаляємо старі обробники
        managerFilter.removeEventListener('change', this.handleManagerFilterChange);
        
        // Додаємо новий обробник
        managerFilter.addEventListener('change', this.handleManagerFilterChange.bind(this));
        console.log('✅ Обробник для фільтра менеджера встановлено:', managerFilter.id);
      }
      
    } catch (error) {
      console.error('❌ Помилка прив\'язування обробників подій:', error);
    }
  }
  
  /**
   * Обробник зміни фільтра відділу (як в debts.js)
   */
  handleDepartmentFilterChange(event) {
    try {
      console.log('🎯 handleDepartmentFilterChange викликано:', event.target.id, event.target.value);
      
      // Зберігаємо поточного менеджера перед оновленням
      const managerFilter = document.getElementById('client-manager-filter') || document.getElementById('manager-filter');
      const currentManager = managerFilter?.value || '';
      
      console.log('💾 Зберігаємо поточного менеджера:', currentManager);
      
      // Оновлюємо значення фільтра
      this.setFilter('department', event.target.value);
      
      // Оновлюємо список менеджерів (як в debts.js)
      this.updateManagersFilter();
      
      // Восстанавливаем выбор менеджера если он есть в новом списке
      if (currentManager && managerFilter) {
        const managerOptions = Array.from(managerFilter.options).map(option => option.value);
        if (managerOptions.includes(currentManager)) {
          console.log('✅ Відновлюємо вибір менеджера після оновлення:', currentManager);
          managerFilter.value = currentManager;
          // Обновляем фильтр менеджера
          this.setFilter('manager', currentManager);
        }
      }
      
      // Застосовуємо фільтри до списку клієнтів (оптимізована версія)
      if (window.focus2Components?.uiOptimized) {
        // Знаходимо поточну задачу
        const taskId = this.getCurrentTaskId();
        if (taskId) {
          window.focus2Components.uiOptimized.applyClientFiltersOptimized(taskId);
        } else {
          window.focus2Components.ui.applyTaskFilters();
        }
      } else if (window.focus2Components?.ui) {
        // Fallback до оригінальної версії
        const taskId = this.getCurrentTaskId();
        if (taskId) {
          window.focus2Components.ui.applyClientFilters(taskId);
        } else {
          window.focus2Components.ui.applyTaskFilters();
        }
      }
      
    } catch (error) {
      console.error('❌ Помилка обробки зміни фільтра відділу:', error);
    }
  }

  /**
   * Обробник зміни фільтра менеджера
   */
  handleManagerFilterChange(event) {
    try {
      console.log('🎯 handleManagerFilterChange викликано:', event.target.id, event.target.value);
      
      // Оновлюємо значення фільтра
      this.setFilter('manager', event.target.value);
      
      console.log('💾 Збережено фільтр менеджера:', event.target.value);
      console.log('📊 Поточні фільтри:', this.getCurrentFilters());
      
      // Застосовуємо фільтри до списку клієнтів (оптимізована версія)
      if (window.focus2Components?.uiOptimized) {
        // Знаходимо поточну задачу
        const taskId = this.getCurrentTaskId();
        if (taskId) {
          console.log('🔍 Застосовуємо оптимізовані фільтри для задачі:', taskId);
          window.focus2Components.uiOptimized.applyClientFiltersOptimized(taskId);
        } else {
          console.log('🔍 Застосовуємо фільтри для списку задач');
          window.focus2Components.ui.applyTaskFilters();
        }
      } else if (window.focus2Components?.ui) {
        // Fallback до оригінальної версії
        const taskId = this.getCurrentTaskId();
        if (taskId) {
          console.log('🔍 Застосовуємо фільтри для задачі:', taskId);
          window.focus2Components.ui.applyClientFilters(taskId);
        } else {
          console.log('🔍 Застосовуємо фільтри для списку задач');
          window.focus2Components.ui.applyTaskFilters();
        }
      }
      
    } catch (error) {
      console.error('❌ Помилка обробки зміни фільтра менеджера:', error);
    }
  }

  /**
   * Обробник зміни фільтрів задач
   */
  handleTaskFilterChange(event) {
    try {
      console.log('🎯 handleTaskFilterChange викликано:', event.target.id, event.target.value);
      
      // Оновлюємо значення фільтра
      const filterName = event.target.id.replace('task-', '').replace('-filter', '');
      this.setFilter(filterName, event.target.value);
      
      // Застосовуємо фільтри до списку задач
      if (window.focus2Components?.ui) {
        window.focus2Components.ui.applyTaskFilters();
      }
      
    } catch (error) {
      console.error('❌ Помилка обробки зміни фільтра задач:', error);
    }
  }
  
  /**
   * Отримання ID поточної задачі
   */
  getCurrentTaskId() {
    // Спробуємо знайти ID задачі з URL або з DOM
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('taskId');
    
    if (taskId) return taskId;
    
    // Спробуємо знайти в DOM
    const taskElement = document.querySelector('[data-task-id]');
    if (taskElement) {
      return taskElement.getAttribute('data-task-id');
    }
    
    // Спробуємо знайти в глобальних змінних
    if (window.currentTaskId) {
      return window.currentTaskId;
    }
    
    return null;
  }
} 