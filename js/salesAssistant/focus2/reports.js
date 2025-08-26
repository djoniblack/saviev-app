// FocusReports.js - Модуль отчетов для Фокус 2.0
import * as firebase from '../../firebase.js';

export class FocusReports {
  constructor() {
    this.data = {
      tasks: [],
      clients: [],
      reports: []
    };
  }
  
  /**
   * Инициализация модуля отчетов
   */
  async init() {
    console.log('📋 Ініціалізація модуля звітів Фокус 2.0...');
    
    try {
      // Загружаем данные для отчетов
      await this.loadReportsData();
      
      console.log('✅ Модуль звітів успішно ініціалізовано');
    } catch (error) {
      console.error('❌ Помилка ініціалізації звітів:', error);
    }
  }
  
  /**
   * Загрузка данных для отчетов
   */
  async loadReportsData() {
    try {
      const companyId = window.state?.currentCompanyId;
      if (companyId) {
        // Загружаем задачи
        const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2');
        const tasksSnapshot = await firebase.getDocs(tasksRef);
        this.data.tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Генерируем отчеты
        this.generateReports();
      }
    } catch (error) {
      console.error('❌ Помилка завантаження даних звітів:', error);
    }
  }
  
  /**
   * Генерация отчетов
   */
  generateReports() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    
    this.data.reports = [
      {
        id: 'monthly',
        title: 'Звіт за місяць',
        period: 'Останній місяць',
        data: this.generateMonthlyReport(lastMonth),
        icon: '📅'
      },
      {
        id: 'quarterly',
        title: 'Квартальний звіт',
        period: 'Останній квартал',
        data: this.generateQuarterlyReport(lastQuarter),
        icon: '📊'
      },
      {
        id: 'performance',
        title: 'Звіт по продуктивності',
        period: 'Загальний',
        data: this.generatePerformanceReport(),
        icon: '📈'
      },
      {
        id: 'clients',
        title: 'Звіт по клієнтах',
        period: 'Загальний',
        data: this.generateClientsReport(),
        icon: '👥'
      }
    ];
  }
  
  /**
   * Генерация месячного отчета
   */
  generateMonthlyReport(startDate) {
    const monthlyTasks = this.data.tasks.filter(task => {
      const taskDate = new Date(task.createdAt);
      return taskDate >= startDate;
    });
    
    const completed = monthlyTasks.filter(t => t.status === 'completed').length;
    const active = monthlyTasks.filter(t => t.status === 'active').length;
    const total = monthlyTasks.length;
    
    return {
      total,
      completed,
      active,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDuration: this.calculateAverageDuration(monthlyTasks.filter(t => t.status === 'completed'))
    };
  }
  
  /**
   * Генерация квартального отчета
   */
  generateQuarterlyReport(startDate) {
    const quarterlyTasks = this.data.tasks.filter(task => {
      const taskDate = new Date(task.createdAt);
      return taskDate >= startDate;
    });
    
    const completed = quarterlyTasks.filter(t => t.status === 'completed').length;
    const active = quarterlyTasks.filter(t => t.status === 'active').length;
    const total = quarterlyTasks.length;
    
    return {
      total,
      completed,
      active,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDuration: this.calculateAverageDuration(quarterlyTasks.filter(t => t.status === 'completed')),
      trends: this.calculateTrends(quarterlyTasks)
    };
  }
  
  /**
   * Генерация отчета по продуктивности
   */
  generatePerformanceReport() {
    const allTasks = this.data.tasks;
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    
    return {
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      activeTasks: allTasks.filter(t => t.status === 'active').length,
      completionRate: allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0,
      avgDuration: this.calculateAverageDuration(completedTasks),
      topPerformers: this.getTopPerformers(),
      bottlenecks: this.identifyBottlenecks()
    };
  }
  
  /**
   * Генерация отчета по клиентам
   */
  generateClientsReport() {
    const clientStats = {};
    
    this.data.tasks.forEach(task => {
      const clientCode = task.clientCode;
      if (clientCode) {
        if (!clientStats[clientCode]) {
          clientStats[clientCode] = {
            clientName: task.clientName || clientCode,
            totalTasks: 0,
            completedTasks: 0,
            activeTasks: 0
          };
        }
        
        clientStats[clientCode].totalTasks++;
        if (task.status === 'completed') {
          clientStats[clientCode].completedTasks++;
        } else if (task.status === 'active') {
          clientStats[clientCode].activeTasks++;
        }
      }
    });
    
    return {
      totalClients: Object.keys(clientStats).length,
      clientStats: Object.values(clientStats).map(client => ({
        ...client,
        completionRate: client.totalTasks > 0 ? 
          Math.round((client.completedTasks / client.totalTasks) * 100) : 0
      })).sort((a, b) => b.totalTasks - a.totalTasks)
    };
  }
  
  /**
   * Вычисление средней продолжительности
   */
  calculateAverageDuration(tasks) {
    if (tasks.length === 0) return 0;
    
    const totalDays = tasks.reduce((sum, task) => {
      if (task.createdAt && task.completedAt) {
        const created = new Date(task.createdAt);
        const completed = new Date(task.completedAt);
        const diffTime = completed - created;
        return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      return sum;
    }, 0);
    
    return Math.round(totalDays / tasks.length);
  }
  
  /**
   * Вычисление трендов
   */
  calculateTrends(tasks) {
    const weeklyStats = {};
    
    tasks.forEach(task => {
      const taskDate = new Date(task.createdAt);
      const weekStart = new Date(taskDate);
      weekStart.setDate(taskDate.getDate() - taskDate.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = { created: 0, completed: 0 };
      }
      
      weeklyStats[weekKey].created++;
      if (task.status === 'completed') {
        weeklyStats[weekKey].completed++;
      }
    });
    
    return Object.entries(weeklyStats)
      .map(([week, stats]) => ({
        week,
        created: stats.created,
        completed: stats.completed
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }
  
  /**
   * Получение топ исполнителей
   */
  getTopPerformers() {
    const performerStats = {};
    
    this.data.tasks.forEach(task => {
      const performer = task.assignedTo || task.createdBy;
      if (performer) {
        if (!performerStats[performer]) {
          performerStats[performer] = { total: 0, completed: 0 };
        }
        performerStats[performer].total++;
        if (task.status === 'completed') {
          performerStats[performer].completed++;
        }
      }
    });
    
    return Object.entries(performerStats)
      .map(([performer, stats]) => ({
        performer,
        total: stats.total,
        completed: stats.completed,
        completionRate: Math.round((stats.completed / stats.total) * 100)
      }))
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);
  }
  
  /**
   * Выявление узких мест
   */
  identifyBottlenecks() {
    const bottlenecks = [];
    
    // Анализ долгих задач
    const longTasks = this.data.tasks.filter(task => {
      if (task.createdAt && task.status === 'active') {
        const created = new Date(task.createdAt);
        const now = new Date();
        const daysSinceCreation = Math.ceil((now - created) / (1000 * 60 * 60 * 24));
        return daysSinceCreation > 30;
      }
      return false;
    });
    
    if (longTasks.length > 0) {
      bottlenecks.push({
        type: 'long_tasks',
        title: 'Довго виконуються',
        count: longTasks.length,
        description: `${longTasks.length} задач виконуються більше 30 днів`
      });
    }
    
    // Анализ задач без назначенного исполнителя
    const unassignedTasks = this.data.tasks.filter(task => 
      task.status === 'active' && !task.assignedTo
    );
    
    if (unassignedTasks.length > 0) {
      bottlenecks.push({
        type: 'unassigned',
        title: 'Без призначення',
        count: unassignedTasks.length,
        description: `${unassignedTasks.length} задач без призначеного виконавця`
      });
    }
    
    return bottlenecks;
  }
  
  /**
   * Рендеринг интерфейса отчетов
   */
  render() {
    return `
      <div class="focus2-reports">
        <div class="reports-header mb-6">
          <h2 class="text-2xl font-bold text-white mb-2">Звіти Фокус 2.0</h2>
          <p class="text-gray-400">Детальні звіти по задачам та продуктивності</p>
        </div>
        
        <!-- Список отчетов -->
        <div class="reports-grid grid grid-cols-1 md:grid-cols-2 gap-6">
          ${this.data.reports.map(report => this.renderReportCard(report)).join('')}
        </div>
        
        <!-- Детальный отчет -->
        <div id="report-details" class="mt-8">
          <!-- Детали будут загружены при клике на отчет -->
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг карточки отчета
   */
  renderReportCard(report) {
    return `
      <div class="report-card" data-report-id="${report.id}">
        <div class="report-header">
          <div class="report-icon">${report.icon}</div>
          <div class="report-info">
            <h3 class="report-title">${report.title}</h3>
            <p class="report-period">${report.period}</p>
          </div>
        </div>
        <div class="report-summary">
          ${this.renderReportSummary(report)}
        </div>
        <button class="report-view-btn" onclick="window.focus2Components?.reports?.viewReport('${report.id}')">
          Переглянути деталі
        </button>
      </div>
    `;
  }
  
  /**
   * Рендеринг сводки отчета
   */
  renderReportSummary(report) {
    switch (report.id) {
      case 'monthly':
        return `
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Всього задач:</span>
              <span class="stat-value">${report.data.total}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Завершено:</span>
              <span class="stat-value">${report.data.completed}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Конверсія:</span>
              <span class="stat-value">${report.data.completionRate}%</span>
            </div>
          </div>
        `;
      
      case 'quarterly':
        return `
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Всього задач:</span>
              <span class="stat-value">${report.data.total}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Завершено:</span>
              <span class="stat-value">${report.data.completed}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Середній час:</span>
              <span class="stat-value">${report.data.avgDuration} дн.</span>
            </div>
          </div>
        `;
      
      case 'performance':
        return `
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Конверсія:</span>
              <span class="stat-value">${report.data.completionRate}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Середній час:</span>
              <span class="stat-value">${report.data.avgDuration} дн.</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Топ виконавців:</span>
              <span class="stat-value">${report.data.topPerformers.length}</span>
            </div>
          </div>
        `;
      
      case 'clients':
        return `
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Клієнтів:</span>
              <span class="stat-value">${report.data.totalClients}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Середня конверсія:</span>
              <span class="stat-value">${this.calculateAverageClientCompletion(report.data.clientStats)}%</span>
            </div>
          </div>
        `;
      
      default:
        return '<div class="text-gray-400">Немає даних</div>';
    }
  }
  
  /**
   * Вычисление средней конверсии клиентов
   */
  calculateAverageClientCompletion(clientStats) {
    if (clientStats.length === 0) return 0;
    
    const totalCompletion = clientStats.reduce((sum, client) => sum + client.completionRate, 0);
    return Math.round(totalCompletion / clientStats.length);
  }
  
  /**
   * Генерация отчета по конкретной задаче
   */
  async generateTaskReport(taskId) {
    try {
      console.log('📊 Генерація звіту для задачі:', taskId);
      
      // Находим задачу
      const tasks = window.focus2Data?.tasks || [];
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Задачу не знайдено');
      }
      
      // Загружаем clientsSnapshot из подколлекции, если он есть
      let clientsSnapshot = [];
      let hasClientsSnapshot = false;
      
      if (task.hasClientsSnapshot && task.clientsSnapshotCount > 0) {
        try {
          console.log('📥 Завантаження clientsSnapshot для звіту задачі:', taskId);
          
          // Добавляем таймаут для предотвращения зависания
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Таймаут завантаження даних')), 10000); // 10 секунд
          });
          
          const loadPromise = window.focus2TaskConstructor.loadClientsSnapshot(taskId);
          
          clientsSnapshot = await Promise.race([loadPromise, timeoutPromise]);
          hasClientsSnapshot = clientsSnapshot.length > 0;
          console.log('✅ clientsSnapshot завантажено для звіту:', clientsSnapshot.length, 'клієнтів');
        } catch (error) {
          console.error('❌ Помилка завантаження clientsSnapshot для звіту:', error);
          hasClientsSnapshot = false;
          
          // Если произошла ошибка, создаем базовый отчет
          if (error.message.includes('Таймаут')) {
            console.log('⚠️ Таймаут завантаження, створюємо базовий звіт');
          }
        }
      }
      
      if (!hasClientsSnapshot) {
        // Создаем базовый отчет без clientsSnapshot
        const report = {
          taskId: taskId,
          taskTitle: task.title,
          taskDescription: task.description,
          createdAt: task.createdAt,
          status: task.status,
          summary: {
            totalClients: 0,
            matchedClients: 0,
            matchPercentage: 0,
            paramBreakdown: []
          },
          recommendations: [
            {
              type: 'warning',
              message: 'Задача створена без аналізу клієнтів. Створіть нову задачу для отримання повного звіту.',
              action: null
            }
          ],
          clients: [],
          parameters: task.parameters || {}
        };
        
        console.log('✅ Звіт згенеровано (без clientsSnapshot):', report);
        return report;
      }
      
      // Анализируем clientsSnapshot
      const clients = clientsSnapshot;
      const totalClients = clients.length;
      
      // Группируем по менеджерам
      const byManager = {};
      clients.forEach(client => {
        const manager = client.manager || 'Без менеджера';
        if (!byManager[manager]) {
          byManager[manager] = [];
        }
        byManager[manager].push(client);
      });
      
      // Группируем по параметрам
      const byParam = {};
      clients.forEach(client => {
        if (client.params && Array.isArray(client.params)) {
          client.params.forEach(param => {
            if (!byParam[param]) {
              byParam[param] = [];
            }
            byParam[param].push(client);
          });
        }
      });
      
      // Рассчитываем статистику
      const totalRevenue = clients.reduce((sum, client) => sum + (client.sum || 0), 0);
      const avgRevenue = totalRevenue / totalClients;
      const managers = Object.keys(byManager);
      const topManager = managers.reduce((top, manager) => {
        const managerRevenue = byManager[manager].reduce((sum, client) => sum + (client.sum || 0), 0);
        return managerRevenue > top.revenue ? { manager, revenue: managerRevenue } : top;
      }, { manager: '', revenue: 0 });
      
      // Анализируем продажи по позициям фокуса
      const focusProducts = new Set(task.products || []);
      const salesByProduct = {};
      const salesByClient = {};
      
      // Получаем данные продаж
      const salesData = window.focus2Data?.salesData || [];
      const periodStart = task.periodFrom ? new Date(task.periodFrom) : new Date();
      const periodEnd = task.periodTo ? new Date(task.periodTo) : new Date();
      
      // Анализируем продажи клиентов из фокуса
      clients.forEach(client => {
        const clientSales = salesData.filter(sale => 
          sale['Клиент.Код'] === client.code &&
          focusProducts.has(sale['Номенклатура']) &&
          new Date(sale['Дата']) >= periodStart &&
          new Date(sale['Дата']) <= periodEnd
        );
        
        salesByClient[client.code] = clientSales;
        
        clientSales.forEach(sale => {
          const product = sale['Номенклатура'];
          if (!salesByProduct[product]) {
            salesByProduct[product] = {
              totalQuantity: 0,
              totalRevenue: 0,
              clientCount: 0,
              clients: new Set()
            };
          }
          salesByProduct[product].totalQuantity += sale['Количество'] || 0;
          salesByProduct[product].totalRevenue += sale['Выручка'] || 0;
          salesByProduct[product].clients.add(client.code);
        });
      });
      
      // Обновляем количество клиентов для каждого продукта
      Object.keys(salesByProduct).forEach(product => {
        salesByProduct[product].clientCount = salesByProduct[product].clients.size;
        delete salesByProduct[product].clients; // Удаляем Set для JSON сериализации
      });
      
      // Создаем детальный отчет
      const report = {
        taskId: taskId,
        taskTitle: task.title,
        taskDescription: task.description,
        createdAt: task.createdAt,
        status: task.status,
        period: {
          from: task.periodFrom,
          to: task.periodTo
        },
        summary: {
          totalClients: totalClients,
          totalRevenue: totalRevenue,
          avgRevenue: avgRevenue,
          managersCount: managers.length,
          topManager: topManager.manager,
          topManagerRevenue: topManager.revenue,
          focusProducts: Array.from(focusProducts),
          salesByProduct: salesByProduct
        },
        breakdown: {
          byManager: byManager,
          byParam: byParam,
          salesByClient: salesByClient
        },
        recommendations: this.generateRecommendations(clients, task),
        parameters: task.parameters || {}
      };
      
      console.log('✅ Детальний звіт згенеровано:', report);
      return report;
      
    } catch (error) {
      console.error('❌ Помилка генерації звіту задачі:', error);
      throw error;
    }
  }
  
  /**
   * Генерация рекомендаций на основе клиентов
   */
  generateRecommendations(clients, task) {
    const recommendations = [];
    
    if (clients.length === 0) {
      recommendations.push({
        type: 'info',
        message: 'Клієнтів не знайдено за критеріями задачі',
        action: null
      });
      return recommendations;
    }
    
    // Анализ по менеджерам
    const byManager = {};
    clients.forEach(client => {
      const manager = client.manager || 'Без менеджера';
      if (!byManager[manager]) {
        byManager[manager] = [];
      }
      byManager[manager].push(client);
    });
    
    const topManagers = Object.entries(byManager)
      .map(([manager, clients]) => ({
        manager,
        count: clients.length,
        revenue: clients.reduce((sum, client) => sum + (client.sum || 0), 0)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    if (topManagers.length > 0) {
      recommendations.push({
        type: 'success',
        message: `Топ менеджерів: ${topManagers.map(m => `${m.manager} (${m.count} клієнтів)`).join(', ')}`,
        action: null
      });
    }
    
    // Анализ по сферам
    const bySphere = {};
    clients.forEach(client => {
      const sphere = client.sphere || 'Без сфери';
      if (!bySphere[sphere]) {
        bySphere[sphere] = [];
      }
      bySphere[sphere].push(client);
    });
    
    const topSpheres = Object.entries(bySphere)
      .map(([sphere, clients]) => ({
        sphere,
        count: clients.length,
        revenue: clients.reduce((sum, client) => sum + (client.sum || 0), 0)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    if (topSpheres.length > 0) {
      recommendations.push({
        type: 'info',
        message: `Топ сфери: ${topSpheres.map(s => `${s.sphere} (${s.count} клієнтів)`).join(', ')}`,
        action: null
      });
    }
    
    // Анализ по датам
    const recentClients = clients.filter(client => {
      if (!client.lastDate) return false;
      const lastDate = new Date(client.lastDate);
      const now = new Date();
      const daysDiff = (now - lastDate) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    });
    
    if (recentClients.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${recentClients.length} клієнтів мали активність в останні 30 днів - можливо, вони ще активні`,
        action: null
      });
    }
    
    // Общие рекомендации
    if (clients.length >= 10) {
      recommendations.push({
        type: 'success',
        message: 'Знайдено багато клієнтів - можна розділити роботу між менеджерами',
        action: null
      });
    } else if (clients.length <= 3) {
      recommendations.push({
        type: 'warning',
        message: 'Знайдено мало клієнтів - можливо, потрібно розширити критерії пошуку',
        action: null
      });
    }
    
    return recommendations;
  }
  
  /**
   * Обновление данных
   */
  async refresh() {
    await this.loadReportsData();
    this.generateReports();
  }

  /**
   * Отображение отчета задачи в модальном окне
   */
  async showTaskReportModal(taskId) {
    try {
      console.log('📊 Показ звіту задачі в модальному вікні:', taskId);
      
      const report = await this.generateTaskReport(taskId);
      
      // Создаем модальное окно
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
      modal.innerHTML = `
        <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-6xl max-h-[90vh] overflow-y-auto relative">
          <button id="close-report-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
          
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-white mb-2">Звіт задачі: ${report.taskTitle}</h2>
            <p class="text-gray-400">${report.taskDescription || 'Без опису'}</p>
          </div>
          
          <!-- Вкладки отчета -->
          <div class="flex gap-2 mb-6">
            <button class="report-tab-btn active px-4 py-2 bg-blue-600 text-white rounded" data-tab="summary">Загальна інформація</button>
            <button class="report-tab-btn px-4 py-2 bg-gray-700 text-white rounded" data-tab="managers">По менеджерах</button>
            <button class="report-tab-btn px-4 py-2 bg-gray-700 text-white rounded" data-tab="products">По продуктах</button>
            <button class="report-tab-btn px-4 py-2 bg-gray-700 text-white rounded" data-tab="clients">Деталі клієнтів</button>
            <button class="report-tab-btn px-4 py-2 bg-gray-700 text-white rounded" data-tab="recommendations">Рекомендації</button>
          </div>
          
          <!-- Контент вкладок -->
          <div id="report-content">
            <!-- Контент будет загружен динамически -->
          </div>
          
          <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
            <button id="export-report-csv" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500">
              📊 Експорт CSV
            </button>
            <button id="close-report" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">
              Закрити
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Обработчики событий
      const closeModal = () => modal.remove();
      const closeBtn = modal.querySelector('#close-report-modal');
      const closeReportBtn = modal.querySelector('#close-report');
      const exportBtn = modal.querySelector('#export-report-csv');
      
      closeBtn.onclick = closeModal;
      closeReportBtn.onclick = closeModal;
      exportBtn.onclick = () => this.exportReportToCSV(report);
      
      // Обработчики вкладок
      const tabBtns = modal.querySelectorAll('.report-tab-btn');
      const contentDiv = modal.querySelector('#report-content');
      
      const switchTab = (tabName) => {
        // Обновляем активную вкладку
        tabBtns.forEach(btn => {
          btn.classList.toggle('bg-blue-600', btn.dataset.tab === tabName);
          btn.classList.toggle('bg-gray-700', btn.dataset.tab !== tabName);
        });
        
        // Загружаем контент вкладки
        contentDiv.innerHTML = this.renderReportTab(report, tabName);
      };
      
      tabBtns.forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
      });
      
      // Показываем первую вкладку
      switchTab('summary');
      
      console.log('✅ Модальне вікно звіту відкрито');
      
    } catch (error) {
      console.error('❌ Помилка показу звіту:', error);
      alert('Помилка генерації звіту: ' + error.message);
    }
  }
  
  /**
   * Рендеринг контента вкладки отчета
   */
  renderReportTab(report, tabName) {
    switch (tabName) {
      case 'summary':
        return this.renderSummaryTab(report);
      case 'managers':
        return this.renderManagersTab(report);
      case 'products':
        return this.renderProductsTab(report);
      case 'clients':
        return this.renderClientsTab(report);
      case 'recommendations':
        return this.renderRecommendationsTab(report);
      default:
        return '<div class="text-gray-400">Вкладка не знайдена</div>';
    }
  }
  
  /**
   * Рендеринг вкладки общей информации
   */
  renderSummaryTab(report) {
    const { summary } = report;
    
    return `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-gray-400 text-sm mb-1">Всього клієнтів</h3>
          <p class="text-2xl font-bold text-white">${summary.totalClients}</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-gray-400 text-sm mb-1">Загальна виручка</h3>
          <p class="text-2xl font-bold text-white">${this.formatCurrency(summary.totalRevenue)}</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-gray-400 text-sm mb-1">Середня виручка</h3>
          <p class="text-2xl font-bold text-white">${this.formatCurrency(summary.avgRevenue)}</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-gray-400 text-sm mb-1">Менеджерів</h3>
          <p class="text-2xl font-bold text-white">${summary.managersCount}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-gray-800 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Топ менеджер</h3>
          <div class="space-y-2">
            <p class="text-gray-400">Менеджер: <span class="text-white">${summary.topManager}</span></p>
            <p class="text-gray-400">Виручка: <span class="text-white">${this.formatCurrency(summary.topManagerRevenue)}</span></p>
          </div>
        </div>
        
        <div class="bg-gray-800 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Фокусні продукти</h3>
          <div class="space-y-2">
            ${summary.focusProducts.map(product => `
              <span class="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2 mb-2">
                ${this.getNomenclatureName(product)}
              </span>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг вкладки по менеджерам
   */
  renderManagersTab(report) {
    const { breakdown } = report;
    const managers = Object.entries(breakdown.byManager);
    
    return `
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-white mb-4">Аналіз по менеджерах</h3>
        
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-800">
                <th class="text-left p-3 text-gray-300">Менеджер</th>
                <th class="text-left p-3 text-gray-300">Клієнтів</th>
                <th class="text-left p-3 text-gray-300">Виручка</th>
                <th class="text-left p-3 text-gray-300">Середня виручка</th>
              </tr>
            </thead>
            <tbody>
              ${managers.map(([manager, clients]) => {
                const totalRevenue = clients.reduce((sum, client) => sum + (client.sum || 0), 0);
                const avgRevenue = totalRevenue / clients.length;
                return `
                  <tr class="border-b border-gray-700">
                    <td class="p-3 text-white">${manager}</td>
                    <td class="p-3 text-white">${clients.length}</td>
                    <td class="p-3 text-white">${this.formatCurrency(totalRevenue)}</td>
                    <td class="p-3 text-white">${this.formatCurrency(avgRevenue)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг вкладки по продуктам
   */
  renderProductsTab(report) {
    const { summary } = report;
    const products = Object.entries(summary.salesByProduct);
    
    return `
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-white mb-4">Аналіз по продуктах фокусу</h3>
        
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-800">
                <th class="text-left p-3 text-gray-300">Продукт</th>
                <th class="text-left p-3 text-gray-300">Кількість</th>
                <th class="text-left p-3 text-gray-300">Виручка</th>
                <th class="text-left p-3 text-gray-300">Клієнтів</th>
                <th class="text-left p-3 text-gray-300">Середня ціна</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(([product, data]) => {
                const avgPrice = data.totalQuantity > 0 ? data.totalRevenue / data.totalQuantity : 0;
                return `
                  <tr class="border-b border-gray-700">
                    <td class="p-3 text-white">${this.getNomenclatureName(product)}</td>
                    <td class="p-3 text-white">${data.totalQuantity}</td>
                    <td class="p-3 text-white">${this.formatCurrency(data.totalRevenue)}</td>
                    <td class="p-3 text-white">${data.clientCount}</td>
                    <td class="p-3 text-white">${this.formatCurrency(avgPrice)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг вкладки клиентов
   */
  renderClientsTab(report) {
    const { breakdown } = report;
    const clients = Object.keys(breakdown.salesByClient);
    
    return `
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-white mb-4">Деталі клієнтів (${clients.length})</h3>
        
        <div class="overflow-x-auto max-h-96">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-gray-800">
              <tr>
                <th class="text-left p-3 text-gray-300">Клієнт</th>
                <th class="text-left p-3 text-gray-300">Менеджер</th>
                <th class="text-left p-3 text-gray-300">Продажів</th>
                <th class="text-left p-3 text-gray-300">Виручка</th>
                <th class="text-left p-3 text-gray-300">Остання покупка</th>
              </tr>
            </thead>
            <tbody>
              ${clients.map(clientCode => {
                const clientSales = breakdown.salesByClient[clientCode];
                const totalRevenue = clientSales.reduce((sum, sale) => sum + (sale['Выручка'] || 0), 0);
                const lastSale = clientSales.length > 0 ? 
                  clientSales.sort((a, b) => new Date(b['Дата']) - new Date(a['Дата']))[0] : null;
                
                return `
                  <tr class="border-b border-gray-700">
                    <td class="p-3 text-white">${this.getClientName(clientCode)}</td>
                    <td class="p-3 text-white">${this.getClientManager(clientCode)}</td>
                    <td class="p-3 text-white">${clientSales.length}</td>
                    <td class="p-3 text-white">${this.formatCurrency(totalRevenue)}</td>
                    <td class="p-3 text-white">${lastSale ? this.formatDate(lastSale['Дата']) : 'Немає'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг вкладки рекомендаций
   */
  renderRecommendationsTab(report) {
    const { recommendations } = report;
    
    return `
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-white mb-4">Рекомендації</h3>
        
        <div class="space-y-3">
          ${recommendations.map((rec, index) => `
            <div class="bg-gray-800 rounded-lg p-4 border-l-4 ${this.getRecommendationColor(rec.type)}">
              <div class="flex items-start">
                <div class="flex-shrink-0 mr-3">
                  ${rec.type === 'success' ? '✅' : rec.type === 'warning' ? '⚠️' : '💡'}
                </div>
                <div class="flex-1">
                  <p class="text-white">${rec.message}</p>
                  ${rec.action ? `<p class="text-gray-400 text-sm mt-1">Дія: ${rec.action}</p>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  /**
   * Экспорт отчета в CSV
   */
  exportReportToCSV(report) {
    try {
      const { summary, breakdown } = report;
      
      // Создаем CSV данные
      let csvContent = 'data:text/csv;charset=utf-8,';
      
      // Заголовок
      csvContent += 'Звіт задачі: ' + report.taskTitle + '\n';
      csvContent += 'Дата створення: ' + this.formatDate(report.createdAt) + '\n\n';
      
      // Общая статистика
      csvContent += 'Загальна статистика\n';
      csvContent += 'Параметр,Значення\n';
      csvContent += `Всього клієнтів,${summary.totalClients}\n`;
      csvContent += `Загальна виручка,${summary.totalRevenue}\n`;
      csvContent += `Середня виручка,${summary.avgRevenue}\n`;
      csvContent += `Кількість менеджерів,${summary.managersCount}\n\n`;
      
      // По менеджерам
      csvContent += 'Аналіз по менеджерах\n';
      csvContent += 'Менеджер,Клієнтів,Виручка,Середня виручка\n';
      Object.entries(breakdown.byManager).forEach(([manager, clients]) => {
        const totalRevenue = clients.reduce((sum, client) => sum + (client.sum || 0), 0);
        const avgRevenue = totalRevenue / clients.length;
        csvContent += `${manager},${clients.length},${totalRevenue},${avgRevenue}\n`;
      });
      csvContent += '\n';
      
      // По продуктам
      csvContent += 'Аналіз по продуктах\n';
      csvContent += 'Продукт,Кількість,Виручка,Клієнтів,Середня ціна\n';
      Object.entries(summary.salesByProduct).forEach(([product, data]) => {
        const avgPrice = data.totalQuantity > 0 ? data.totalRevenue / data.totalQuantity : 0;
        csvContent += `${this.getNomenclatureName(product)},${data.totalQuantity},${data.totalRevenue},${data.clientCount},${avgPrice}\n`;
      });
      
      // Создаем ссылку для скачивания
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `focus_report_${report.taskId}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Звіт експортовано в CSV');
      
    } catch (error) {
      console.error('❌ Помилка експорту звіту:', error);
      alert('Помилка експорту звіту');
    }
  }
  
  /**
   * Вспомогательные функции
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH'
    }).format(amount || 0);
  }
  
  formatDate(dateString) {
    if (!dateString) return 'Немає';
    return new Date(dateString).toLocaleDateString('uk-UA');
  }
  
  getNomenclatureName(code) {
    const nomenclatureData = window.focus2Data?.nomenclatureData || {};
    return nomenclatureData[code] || code;
  }
  
  getClientName(code) {
    const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
    return clientManagerDirectory[code]?.name || code;
  }
  
  getClientManager(code) {
    const clientManagerDirectory = window.focus2Data?.clientManagerDirectory || {};
    return clientManagerDirectory[code]?.manager || 'Без менеджера';
  }
  
  getRecommendationColor(type) {
    switch (type) {
      case 'success': return 'border-green-500';
      case 'warning': return 'border-yellow-500';
      case 'info': return 'border-blue-500';
      default: return 'border-gray-500';
    }
  }
  
  /**
   * Показ детального отчета
   */
  viewReport(reportId) {
    try {
      console.log('📊 Перегляд звіту:', reportId);
      
      const report = this.data.reports.find(r => r.id === reportId);
      if (!report) {
        console.error('❌ Звіт не знайдено:', reportId);
        return;
      }
      
      const detailsContainer = document.getElementById('report-details');
      if (detailsContainer) {
        detailsContainer.innerHTML = this.renderDetailedReport(report);
      }
      
    } catch (error) {
      console.error('❌ Помилка показу звіту:', error);
    }
  }
  
  /**
   * Рендеринг детального отчета
   */
  renderDetailedReport(report) {
    return `
      <div class="bg-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-xl font-bold text-white">${report.title}</h3>
            <p class="text-gray-400">${report.period}</p>
          </div>
          <button onclick="window.focus2Components?.reports?.exportReportToCSV('${report.id}')" 
                  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500">
            Експорт CSV
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${this.renderDetailedStats(report)}
        </div>
        
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-white mb-4">Детальні дані</h4>
          ${this.renderDetailedData(report)}
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг детальной статистики
   */
  renderDetailedStats(report) {
    const stats = report.data;
    
    return `
      <div class="bg-gray-700 rounded p-4">
        <h4 class="text-white font-semibold mb-2">Загальна статистика</h4>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-400">Всього задач:</span>
            <span class="text-white">${stats.total || 0}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Завершено:</span>
            <span class="text-white">${stats.completed || 0}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Конверсія:</span>
            <span class="text-white">${stats.completionRate || 0}%</span>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Рендеринг детальных данных
   */
  renderDetailedData(report) {
    const data = report.data;
    
    if (data.tasks && data.tasks.length > 0) {
      return `
        <div class="bg-gray-700 rounded p-4">
          <h4 class="text-white font-semibold mb-4">Список задач</h4>
          <div class="space-y-2">
            ${data.tasks.map(task => `
              <div class="flex items-center justify-between p-2 bg-gray-600 rounded">
                <span class="text-white">${task.title}</span>
                <span class="text-gray-400">${task.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    return `
      <div class="bg-gray-700 rounded p-4">
        <p class="text-gray-400">Детальні дані відсутні</p>
      </div>
    `;
  }
}

// Глобальная функция для просмотра отчетов
window.viewReport = function(reportId) {
  console.log(`Перегляд звіту: ${reportId}`);
  
  if (window.focus2Components?.reports) {
    window.focus2Components.reports.viewReport(reportId);
  } else {
    console.error('❌ Модуль звітів не ініціалізовано');
  }
}; 