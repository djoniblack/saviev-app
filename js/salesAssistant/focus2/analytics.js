// Модуль аналитики для Focus 2.0
import * as firebase from '../../firebase.js';

export class FocusAnalytics {
  constructor() {
    this.data = {
      tasks: [],
      clients: [],
      sales: [],
      notes: {}
    };
    this.charts = {};
  }

  /**
   * Инициализация модуля аналитики
   */
  async init() {
    try {
      console.log('📊 Ініціалізація модуля аналітики Фокус 2.0...');
      
      // Загружаем данные
      await this.loadAnalyticsData();
      
      console.log('✅ Модуль аналітики ініціалізовано');
    } catch (error) {
      console.error('❌ Помилка ініціалізації аналітики:', error);
    }
  }

  /**
   * Загрузка данных для аналитики
   */
  async loadAnalyticsData() {
    try {
      // Получаем данные из глобального хранилища
      this.data.tasks = window.focus2Data?.tasks || [];
      this.data.clients = window.focus2Data?.clients || [];
      this.data.sales = window.focus2Data?.salesData || [];
      
      console.log('📊 Дані для аналітики завантажено:', {
        tasks: this.data.tasks.length,
        clients: this.data.clients.length,
        sales: this.data.sales.length
      });
    } catch (error) {
      console.error('❌ Помилка завантаження даних аналітики:', error);
    }
  }

  /**
   * Расчет основных метрик
   */
  calculateMetrics() {
    const activeTasks = this.data.tasks.filter(t => t.status !== 'archived');
    const totalClients = this.data.clients.length;
    
    // Расчет конверсии
    const completedTasks = activeTasks.filter(t => t.status === 'completed').length;
    const conversionRate = activeTasks.length > 0 ? (completedTasks / activeTasks.length) * 100 : 0;
    
    // Расчет среднего чека
    const totalRevenue = this.data.sales.reduce((sum, sale) => sum + (sale.Выручка || 0), 0);
    const avgOrderValue = this.data.sales.length > 0 ? totalRevenue / this.data.sales.length : 0;
    
    // Расчет эффективности по менеджерам
    const managerStats = this.calculateManagerStats();
    
    return {
      activeTasks: activeTasks.length,
      totalClients,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      managerStats,
      taskTrends: this.calculateTaskTrends(),
      clientSegments: this.calculateClientSegments()
    };
  }

  /**
   * Расчет статистики по менеджерам
   */
  calculateManagerStats() {
    const managerMap = new Map();
    
    this.data.clients.forEach(client => {
      const manager = client.manager || 'Не призначений';
      if (!managerMap.has(manager)) {
        managerMap.set(manager, {
          name: manager,
          clients: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          tasks: 0
        });
      }
      
      const stats = managerMap.get(manager);
      stats.clients++;
      stats.totalRevenue += client.sum || 0;
    });
    
    // Рассчитываем средние значения
    managerMap.forEach(stats => {
      stats.avgOrderValue = stats.clients > 0 ? stats.totalRevenue / stats.clients : 0;
    });
    
    return Array.from(managerMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Расчет трендов задач
   */
  calculateTaskTrends() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    
    const tasksThisMonth = this.data.tasks.filter(t => new Date(t.createdAt) >= lastMonth);
    const tasksThisQuarter = this.data.tasks.filter(t => new Date(t.createdAt) >= lastQuarter);
    
    return {
      thisMonth: tasksThisMonth.length,
      thisQuarter: tasksThisQuarter.length,
      total: this.data.tasks.length,
      completionRate: this.calculateCompletionRate()
    };
  }

  /**
   * Расчет сегментации клиентов
   */
  calculateClientSegments() {
    const segments = {
      vip: { count: 0, revenue: 0 },
      regular: { count: 0, revenue: 0 },
      new: { count: 0, revenue: 0 },
      inactive: { count: 0, revenue: 0 }
    };
    
    this.data.clients.forEach(client => {
      const revenue = client.sum || 0;
      let segment = 'new';
      
      if (revenue > 10000) segment = 'vip';
      else if (revenue > 1000) segment = 'regular';
      else if (revenue === 0) segment = 'inactive';
      
      segments[segment].count++;
      segments[segment].revenue += revenue;
    });
    
    return segments;
  }

  /**
   * Расчет процента завершения задач
   */
  calculateCompletionRate() {
    const completedTasks = this.data.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = this.data.tasks.length;
    return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  }

  /**
   * Получение топ менеджеров
   */
  getTopManagers(limit = 5) {
    const managerStats = this.calculateManagerStats();
    return managerStats.slice(0, limit);
  }

  /**
   * Расчет средней продолжительности задач
   */
  calculateAverageTaskDuration() {
    const completedTasks = this.data.tasks.filter(t => t.status === 'completed' && t.completedAt);
    
    if (completedTasks.length === 0) return 0;
    
    const totalDuration = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt);
      const completed = new Date(task.completedAt);
      return sum + (completed - created);
    }, 0);
    
    return Math.round(totalDuration / completedTasks.length / (1000 * 60 * 60 * 24)); // в днях
  }

  /**
   * Рендеринг аналитики
   */
  render() {
    const metrics = this.calculateMetrics();
    
    return `
      <div class="focus2-analytics">
        <!-- Основные метрики -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-gray-400 text-sm mb-2">Активних задач</h3>
            <p class="text-3xl font-bold text-white">${metrics.activeTasks}</p>
          </div>
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-gray-400 text-sm mb-2">Конверсія</h3>
            <p class="text-3xl font-bold text-green-400">${metrics.conversionRate}%</p>
          </div>
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-gray-400 text-sm mb-2">Середній чек</h3>
            <p class="text-3xl font-bold text-blue-400">${metrics.avgOrderValue.toFixed(2)} ₴</p>
          </div>
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-gray-400 text-sm mb-2">Тривалість задач</h3>
            <p class="text-3xl font-bold text-yellow-400">${this.calculateAverageTaskDuration()} дн.</p>
          </div>
        </div>

        <!-- Графики и диаграммы -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <!-- Статистика по менеджерам -->
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-white mb-4">Топ менеджерів</h3>
            <div class="space-y-4">
              ${this.renderManagerStats(metrics.managerStats.slice(0, 5))}
            </div>
          </div>

          <!-- Сегментация клиентов -->
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-xl font-semibold text-white mb-4">Сегментація клієнтів</h3>
            <div class="space-y-4">
              ${this.renderClientSegments(metrics.clientSegments)}
            </div>
          </div>
        </div>

        <!-- Тренды и динамика -->
        <div class="bg-gray-800 rounded-lg p-6">
          <h3 class="text-xl font-semibold text-white mb-4">Тренди та динаміка</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="text-center">
              <h4 class="text-gray-400 text-sm mb-2">Задач цього місяця</h4>
              <p class="text-2xl font-bold text-blue-400">${metrics.taskTrends.thisMonth}</p>
            </div>
            <div class="text-center">
              <h4 class="text-gray-400 text-sm mb-2">Задач цього кварталу</h4>
              <p class="text-2xl font-bold text-green-400">${metrics.taskTrends.thisQuarter}</p>
            </div>
            <div class="text-center">
              <h4 class="text-gray-400 text-sm mb-2">Всього задач</h4>
              <p class="text-2xl font-bold text-white">${metrics.taskTrends.total}</p>
            </div>
          </div>
        </div>

        <!-- Рекомендации -->
        <div class="bg-gray-800 rounded-lg p-6 mt-8">
          <h3 class="text-xl font-semibold text-white mb-4">Рекомендації</h3>
          <div class="space-y-3">
            ${this.generateRecommendations(metrics)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Рендеринг статистики менеджеров
   */
  renderManagerStats(managers) {
    return managers.map(manager => `
      <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
        <div>
          <p class="text-white font-medium">${manager.name}</p>
          <p class="text-gray-400 text-sm">${manager.clients} клієнтів</p>
        </div>
        <div class="text-right">
          <p class="text-green-400 font-semibold">${manager.totalRevenue.toFixed(2)} ₴</p>
          <p class="text-gray-400 text-sm">${manager.avgOrderValue.toFixed(2)} ₴/клієнт</p>
        </div>
      </div>
    `).join('');
  }

  /**
   * Рендеринг сегментации клиентов
   */
  renderClientSegments(segments) {
    const segmentColors = {
      vip: 'text-purple-400',
      regular: 'text-blue-400',
      new: 'text-green-400',
      inactive: 'text-gray-400'
    };

    const segmentNames = {
      vip: 'VIP клієнти',
      regular: 'Регулярні клієнти',
      new: 'Нові клієнти',
      inactive: 'Неактивні клієнти'
    };

    return Object.entries(segments).map(([key, data]) => `
      <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
        <div>
          <p class="text-white font-medium">${segmentNames[key]}</p>
          <p class="text-gray-400 text-sm">${data.count} клієнтів</p>
        </div>
        <div class="text-right">
          <p class="${segmentColors[key]} font-semibold">${data.revenue.toFixed(2)} ₴</p>
          <p class="text-gray-400 text-sm">${data.count > 0 ? (data.revenue / data.count).toFixed(2) : 0} ₴/клієнт</p>
        </div>
      </div>
    `).join('');
  }

  /**
   * Генерация рекомендаций
   */
  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.conversionRate < 50) {
      recommendations.push({
        type: 'warning',
        message: 'Низька конверсія задач. Рекомендується переглянути стратегію створення задач.',
        action: 'Аналізувати невдалі задачі'
      });
    }
    
    if (metrics.avgOrderValue < 1000) {
      recommendations.push({
        type: 'info',
        message: 'Середній чек нижче норми. Можна покращити через фокусні задачі.',
        action: 'Створити задачу для підвищення чеку'
      });
    }
    
    if (this.calculateAverageTaskDuration() > 30) {
      recommendations.push({
        type: 'priority',
        message: 'Тривалість виконання задач занадто довга. Потрібно оптимізувати процес.',
        action: 'Переглянути процес виконання'
      });
    }
    
    const topManager = metrics.managerStats[0];
    if (topManager && topManager.totalRevenue > 50000) {
      recommendations.push({
        type: 'success',
        message: `Менеджер ${topManager.name} показує відмінні результати. Можна використати його досвід.`,
        action: 'Дослідити методику'
      });
    }
    
    return recommendations.map(rec => `
      <div class="flex items-start space-x-3 p-3 bg-gray-700 rounded-lg">
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
    `).join('');
  }

  /**
   * Получение цвета для рекомендации
   */
  getRecommendationColor(type) {
    const colors = {
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      priority: 'bg-red-500',
      info: 'bg-blue-500'
    };
    return colors[type] || 'bg-gray-500';
  }

  /**
   * Обновление данных
   */
  async refresh() {
    await this.loadAnalyticsData();
    return this.render();
  }
} 