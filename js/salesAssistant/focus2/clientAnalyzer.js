// Анализатор клиентов для Фокус 2.0
import * as firebase from '../../firebase.js';

export class FocusClientAnalyzer {
  constructor() {
    this.salesData = [];
    this.clientsData = [];
    this.nomenclatureData = [];
    this.clientManagerDirectory = {};
    this.focusClientLinks = null;
  }
  
  /**
   * Парсинг дати з різних форматів
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Спробуємо стандартний формат
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    
    // Спробуємо різні формати
    const parts = dateStr.split(/[-T:]/);
    if (parts.length >= 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Місяці починаються з 0
      const day = parseInt(parts[2]);
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    
    console.warn('⚠️ Не вдалося розпарсити дату:', dateStr);
    return null;
  }
  
  /**
   * Инициализация анализатора
   */
  async init(salesData, nomenclatureData, clientManagerDirectory) {
    this.salesData = salesData;
    this.nomenclatureData = nomenclatureData;
    this.clientManagerDirectory = clientManagerDirectory;
    
    
    
    if (salesData && salesData.length > 0) {
      const sampleSale = salesData[0];
      
      
      // Перевіряємо різні поля для кодів товарів
      const possibleProductFields = Object.keys(sampleSale).filter(key => 
        key.toLowerCase().includes('код') || 
        key.toLowerCase().includes('номенклатура') ||
        key.toLowerCase().includes('товар')
      );
      
      
      
      possibleProductFields.forEach(field => {
        const uniqueValues = new Set(salesData.map(s => s[field]).filter(v => v));
        const isCodeField = field.includes('Код');
   
      });
    }
    
    // Загружаем ссылки на клиентов
    await this.loadFocusClientLinks();
    
   
  }

  /**
   * Загрузка ссылок на клиентов
   */
  async loadFocusClientLinks() {
    if (this.focusClientLinks) return this.focusClientLinks;
    
    try {
      const res = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
      const arr = await res.json();
      this.focusClientLinks = {};
      arr.forEach(c => { 
        this.focusClientLinks[c['Клиент.Код']] = c['посилання']; 
      });
      return this.focusClientLinks;
    } catch (error) {
      console.error('❌ Помилка завантаження посилань клієнтів:', error);
      this.focusClientLinks = {};
      return this.focusClientLinks;
    }
  }

  /**
   * Генерация clientsSnapshot для задачи
   */
  async generateClientsSnapshot(task) {
    
    let clientsSnapshot = [];
    
    if (task.parameters && (task.parameters.param1?.enabled || task.parameters.param2?.enabled || task.parameters.param3?.enabled || task.parameters.param4?.enabled || task.parameters.param5?.enabled || task.parameters.param6?.enabled || task.parameters.param7?.enabled)) {
      let c1 = [], c2 = [], c3 = [], c4 = [], c5 = [], c6 = [], c7 = [];
      
      if (task.parameters.param1?.enabled) {
        c1 = (await this.getFocusClientsParam1(task, task.parameters.param1.period || 'month'))
          .map(c => ({...c, params: ['param1']}));
      }
      
      if (task.parameters.param2?.enabled) {
        c2 = (await this.getFocusClientsParam2(task))
          .map(c => ({...c, params: ['param2']}));
      }
      
      if (task.parameters.param3?.enabled) {
        c3 = (await this.getFocusClientsParam3(task))
          .map(c => ({...c, params: ['param3']}));
      }
      
      if (task.parameters.param4?.enabled) {
        c4 = (await this.getFocusClientsParam4(task))
          .map(c => ({...c, params: ['param4']}));
      }
      
      if (task.parameters.param5?.enabled) {
        c5 = (await this.getFocusClientsParam5(task))
          .map(c => ({...c, params: ['param5']}));
      }
      
      if (task.parameters.param6?.enabled) {
        c6 = (await this.getFocusClientsParam6(task))
          .map(c => ({...c, params: ['param6']}));
      }
      
      if (task.parameters.param7?.enabled) {
        c7 = (await this.getFocusClientsParam7(task))
          .map(c => ({...c, params: ['param7']}));
      }
      
      // Объединяем клиентов по коду
      const byCode = {};
      [...c1, ...c2, ...c3, ...c4, ...c5, ...c6, ...c7].forEach(c => {
        if (!byCode[c.code]) {
          byCode[c.code] = { 
            code: c.code, 
            name: c.name, 
            manager: c.manager, 
            sphere: c.sphere, 
            link: c.link, 
            params: c.params 
          };
        } else {
          // Если клиент уже есть, добавляем параметр, если его ещё нет
          c.params.forEach(p => {
            if (!byCode[c.code].params.includes(p)) byCode[c.code].params.push(p);
          });
        }
      });
      
      clientsSnapshot = Object.values(byCode);
    }
    
    
    return clientsSnapshot;
  }

  /**
   * Параметр 1: Клиенты, которые покупали фокусные товары в прошлом периоде, но не в текущем
   */
  async getFocusClientsParam1(task, period) {
    
    let prevFrom, prevTo, currFrom, currTo;
    
    if (period === 'month') {
      const now = new Date();
      currFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      currTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevTo = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === 'quarter') {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      currFrom = new Date(now.getFullYear(), q * 3, 1);
      currTo = new Date(now.getFullYear(), q * 3 + 3, 0);
      prevFrom = new Date(now.getFullYear(), (q - 1) * 3, 1);
      prevTo = new Date(now.getFullYear(), q * 3, 0);
    } else {
      // fallback: текущий месяц
      const now = new Date();
      currFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      currTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevTo = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    
    const focusCodes = new Set(task.products || []);
    const byClient = {};
    
    this.salesData.forEach(s => {
      const code = s['Клиент.Код'];
      if (!code) return;
      
      if (!byClient[code]) {
        byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: this.focusClientLinks && this.focusClientLinks[code] ? this.focusClientLinks[code] : ''
        };
      }
      byClient[code].sales.push(s);
    });
    
    const result = [];
    
    
    // Визначаємо правильне поле для кодів товарів
    const getProductCode = (sale) => {
      // Пріоритет: Номенклатура.Код (це правильне поле для кодів)
      return sale['Номенклатура.Код'] || sale['Номенклатура'] || sale['Код'] || sale['Товар.Код'];
    };
    
    for (const c of Object.values(byClient)) {
      const prev = c.sales.filter(s => 
        focusCodes.has(getProductCode(s)) && 
        new Date(s['Дата']) >= prevFrom && 
        new Date(s['Дата']) <= prevTo
      );
      
      const curr = c.sales.filter(s => 
        focusCodes.has(getProductCode(s)) && 
        new Date(s['Дата']) >= currFrom && 
        new Date(s['Дата']) <= currTo
      );
      
      if (prev.length > 0) {
        
        if (curr.length === 0) {
        } else {
        }
      }
      
      if (prev.length > 0 && curr.length === 0) {
        const sum = prev.reduce((a, b) => {
          const revenue = typeof b['Выручка'] === 'string' 
            ? parseFloat(b['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (b['Выручка'] || 0);
          return a + revenue;
        }, 0);
        
        result.push({
          name: c.name,
          code: c.code,
          sphere: c.sphere,
          sum: sum,
          lastDate: Math.max(...prev.map(s => new Date(s['Дата']).getTime())),
          manager: c.manager,
          link: c.link
        });
      }
    }
    
    return result;
  }

  /**
   * Параметр 2: Клиенты, которые не покупали фокусные товары определенное количество дней
   */
  async getFocusClientsParam2(task) {
    
    const focusCodes = new Set(task.products || []);
    const daysThreshold = task.parameters?.param2?.days || 30;
    
    
    // Перевіряємо наявність продажів з фокусними товарами
    const focusSales = this.salesData.filter(sale => focusCodes.has(sale['Номенклатура.Код']));
    
    // Перевіряємо унікальні коди товарів в продажах
    const uniqueProductCodes = new Set(this.salesData.map(s => s['Номенклатура.Код']));
    
    // Перевіряємо перетин фокусних товарів з продажами
    const intersection = Array.from(focusCodes).filter(code => uniqueProductCodes.has(code));
    
    // Текущая дата
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (daysThreshold * 24 * 60 * 60 * 1000));
    
    
    // Группируем продажи по клиенту
    const byClient = {};
    this.salesData.forEach(s => {
      const code = s['Клиент.Код'];
      if (!code) return;
      
      if (!byClient[code]) {
        byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: this.focusClientLinks && this.focusClientLinks[code] ? this.focusClientLinks[code] : ''
        };
      }
      byClient[code].sales.push(s);
    });
    
    
    const result = [];
    
    // Спочатку знаходимо ВСІХ клієнтів, які коли-небудь купували фокусні товари
    const clientsWithFocusSales = [];
    
    // Визначаємо правильне поле для кодів товарів
    const getProductCode = (sale) => {
      // Пріоритет: Номенклатура.Код (це правильне поле для кодів)
      return sale['Номенклатура.Код'] || sale['Номенклатура'] || sale['Код'] || sale['Товар.Код'];
    };
    
    for (const c of Object.values(byClient)) {
      // Находим ВСІ продажи фокусных товаров для этого клиента
      const focusSales = c.sales.filter(s => focusCodes.has(getProductCode(s)));
      
      if (focusSales.length === 0) {
        // Клиент никогда не покупал фокусные товары - пропускаем
        continue;
      }
      
      
      // Находим дату последней покупки фокусных товаров
      const lastFocusSaleTimestamp = Math.max(...focusSales.map(s => new Date(s['Дата']).getTime()));
      const lastFocusSaleDate = new Date(lastFocusSaleTimestamp);
      
      // РАХУЄМО дні з останньої покупки
      const daysSinceLastPurchase = Math.floor((now - lastFocusSaleDate) / (24 * 60 * 60 * 1000));
      
      
      // Додаємо ВСІХ клієнтів, які купували фокусні товари
      clientsWithFocusSales.push({
        name: c.name,
        code: c.code,
        sphere: c.sphere,
        lastDate: lastFocusSaleDate.getTime(),
        daysSinceLastPurchase: daysSinceLastPurchase,
        manager: c.manager,
        link: c.link,
        totalFocusSales: focusSales.length
      });
    }
    
    
    // Тепер фільтруємо тих, хто не купував останні 30 днів
    for (const client of clientsWithFocusSales) {
      if (client.daysSinceLastPurchase >= daysThreshold) {
        // Розраховуємо загальну виручку клієнта
        const clientSales = byClient[client.code].sales;
        const totalRevenue = clientSales.reduce((a, b) => {
          const revenue = typeof b['Выручка'] === 'string' 
            ? parseFloat(b['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (b['Выручка'] || 0);
          return a + revenue;
        }, 0);
        
        result.push({
          name: client.name,
          code: client.code,
          sphere: client.sphere,
          sum: totalRevenue,
          lastDate: client.lastDate,
          daysSinceLastPurchase: client.daysSinceLastPurchase,
          manager: client.manager,
          link: client.link
        });
        
      } else {
      }
    }
    
    // Сортируем по количеству дней (больше дней = выше в списке)
    result.sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);
    
    return result;
  }

  /**
   * Параметр 3: Клиенты с низкой частотой покупок фокусных товаров
   */
  async getFocusClientsParam3(task) {
    
    const focusCodes = new Set(task.products || []);
    const frequencyThreshold = task.parameters?.param3?.frequency || 1;
    
    
    // Группируем продажи по клиенту
    const byClient = {};
    this.salesData.forEach(s => {
      const code = s['Клиент.Код'];
      if (!code) return;
      
      if (!byClient[code]) {
        byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: this.focusClientLinks && this.focusClientLinks[code] ? this.focusClientLinks[code] : ''
        };
      }
      byClient[code].sales.push(s);
    });
    
    const result = [];
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    
    // Визначаємо правильне поле для кодів товарів
    const getProductCode = (sale) => {
      // Пріоритет: Номенклатура.Код (це правильне поле для кодів)
      return sale['Номенклатура.Код'] || sale['Номенклатура'] || sale['Код'] || sale['Товар.Код'];
    };
    
    for (const c of Object.values(byClient)) {
      // Фильтруем продажи фокусных товаров за последние 6 месяцев
      const focusSales = c.sales.filter(s => 
        focusCodes.has(getProductCode(s)) && 
        new Date(s['Дата']) >= sixMonthsAgo
      );
      
      if (focusSales.length === 0) {
        // Клиент не покупал фокусные товары в последние 6 месяцев
        continue;
      }
      
      
      // Группируем продажи по месяцам
      const salesByMonth = {};
      focusSales.forEach(sale => {
        const saleDate = new Date(sale['Дата']);
        const monthKey = `${saleDate.getFullYear()}-${saleDate.getMonth()}`;
        if (!salesByMonth[monthKey]) {
          salesByMonth[monthKey] = [];
        }
        salesByMonth[monthKey].push(sale);
      });
      
      // Считаем среднюю частоту покупок за месяц
      const monthsWithSales = Object.keys(salesByMonth).length;
      const averageFrequency = focusSales.length / monthsWithSales;
      
      if (averageFrequency < frequencyThreshold) {
        const totalRevenue = c.sales.reduce((a, b) => {
          const revenue = typeof b['Выручка'] === 'string' 
            ? parseFloat(b['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (b['Выручка'] || 0);
          return a + revenue;
        }, 0);
        
        result.push({
          name: c.name,
          code: c.code,
          sphere: c.sphere,
          sum: totalRevenue,
          lastDate: Math.max(...c.sales.map(s => new Date(s['Дата']).getTime())),
          averageFrequency: averageFrequency,
          monthsWithSales: monthsWithSales,
          manager: c.manager,
          link: c.link
        });
      }
    }
    
    // Сортируем по частоте покупок (меньше частота = выше в списке)
    result.sort((a, b) => a.averageFrequency - b.averageFrequency);
    
    return result;
  }
  
  /**
   * Параметр 4: Клиенты с низкой суммой покупок фокусных товаров
   */
  async getFocusClientsParam4(task) {
    
    const focusCodes = new Set(task.products || []);
    const amountThreshold = task.parameters?.param4?.amount || 1000;
    
    
    // Группируем продажи по клиенту
    const byClient = {};
    this.salesData.forEach(s => {
      const code = s['Клиент.Код'];
      if (!code) return;
      
      if (!byClient[code]) {
        byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: this.focusClientLinks && this.focusClientLinks[code] ? this.focusClientLinks[code] : ''
        };
      }
      byClient[code].sales.push(s);
    });
    
    const result = [];
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    // Визначаємо правильне поле для кодів товарів
    const getProductCode = (sale) => {
      // Пріоритет: Номенклатура.Код (це правильне поле для кодів)
      return sale['Номенклатура.Код'] || sale['Номенклатура'] || sale['Код'] || sale['Товар.Код'];
    };
    
    for (const c of Object.values(byClient)) {
      // Фильтруем продажи фокусных товаров за последние 3 месяца
      const focusSales = c.sales.filter(s => 
        focusCodes.has(getProductCode(s)) && 
        new Date(s['Дата']) >= threeMonthsAgo
      );
      
      if (focusSales.length === 0) {
        // Клиент не покупал фокусные товары в последние 3 месяца
        continue;
      }
      
      // Считаем общую сумму покупок фокусных товаров за 3 месяца
      const totalFocusAmount = focusSales.reduce((sum, sale) => {
        const revenue = typeof sale['Выручка'] === 'string' 
          ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
          : (sale['Выручка'] || 0);
        return sum + revenue;
      }, 0);
      
      // Считаем среднюю сумму за месяц
      const averageMonthlyAmount = totalFocusAmount / 3;
      
      if (averageMonthlyAmount < amountThreshold) {
        const totalRevenue = c.sales.reduce((a, b) => {
          const revenue = typeof b['Выручка'] === 'string' 
            ? parseFloat(b['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (b['Выручка'] || 0);
          return a + revenue;
        }, 0);
        
        result.push({
          name: c.name,
          code: c.code,
          sphere: c.sphere,
          sum: totalRevenue,
          lastDate: Math.max(...c.sales.map(s => new Date(s['Дата']).getTime())),
          averageMonthlyAmount: averageMonthlyAmount,
          totalFocusAmount: totalFocusAmount,
          manager: c.manager,
          link: c.link
        });
      }
    }
    
    // Сортируем по средней сумме покупок (меньше сумма = выше в списке)
    result.sort((a, b) => a.averageMonthlyAmount - b.averageMonthlyAmount);
    
    return result;
  }
  
  /**
   * Параметр 5: Клиенты из определенных сегментов
   */
  async getFocusClientsParam5(task) {
    
    const selectedSegments = task.parameters?.param5?.segments || {};
    const enabledSegments = Object.keys(selectedSegments).filter(segment => selectedSegments[segment]);
    
    
    if (enabledSegments.length === 0) {
      return [];
    }
    
    // Группируем продажи по клиенту
    const byClient = {};
    this.salesData.forEach(s => {
      const code = s['Клиент.Код'];
      if (!code) return;
      
      if (!byClient[code]) {
        byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: this.focusClientLinks && this.focusClientLinks[code] ? this.focusClientLinks[code] : ''
        };
      }
      byClient[code].sales.push(s);
    });
    
    const result = [];
    
    for (const clientCode of Object.keys(byClient)) {
      const client = byClient[clientCode];
      
      // Анализируем сегмент клиента
      const segmentation = await this.getSegmentationAnalysis(clientCode);
      const clientSegment = segmentation.segment;
      
      
      // Проверяем, подходит ли клиент под выбранные сегменты
      if (enabledSegments.includes(clientSegment)) {
        const totalRevenue = client.sales.reduce((sum, sale) => {
          const revenue = typeof sale['Выручка'] === 'string' 
            ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (sale['Выручка'] || 0);
          return sum + revenue;
        }, 0);
        
        result.push({
          name: client.name,
          code: client.code,
          sphere: client.sphere,
          sum: totalRevenue,
          lastDate: Math.max(...client.sales.map(s => new Date(s['Дата']).getTime())),
          segment: clientSegment,
          rfmScore: segmentation.rfmScore,
          manager: client.manager,
          link: client.link
        });
      }
    }
    
    // Сортируем по сегменту и общей сумме продаж
    result.sort((a, b) => {
      const segmentOrder = { 'vip': 1, 'regular': 2, 'occasional': 3, 'new': 4, 'inactive': 5 };
      const aOrder = segmentOrder[a.segment] || 6;
      const bOrder = segmentOrder[b.segment] || 6;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      return b.sum - a.sum; // По убыванию суммы
    });
    
    console.log('📊 Розподіл по сегментах:', result.reduce((acc, c) => {
      acc[c.segment] = (acc[c.segment] || 0) + 1;
      return acc;
    }, {}));
    
    return result;
  }
  
  /**
   * Параметр 6: Похожі клієнти, які ніколи не купували
   */
  async getFocusClientsParam6(task) {
    
    const focusCodes = new Set(task.products || []);
    const similarityThreshold = task.parameters?.param6?.similarity || 80;
    
    
    // Группируем продажи по клиенту
    const byClient = {};
    this.salesData.forEach(s => {
      const code = s['Клиент.Код'];
      if (!code) return;
      
      if (!byClient[code]) {
        byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: this.focusClientLinks && this.focusClientLinks[code] ? this.focusClientLinks[code] : ''
        };
      }
      byClient[code].sales.push(s);
    });
    
    // Находим клиентов, которые покупали фокусные товары
    const clientsWithFocusSales = new Set();
    this.salesData.forEach(sale => {
      if (focusCodes.has(sale['Номенклатура.Код'])) {
        clientsWithFocusSales.add(sale['Клиент.Код']);
      }
    });
    
    
    // Группируем клиентов по сфере деятельности
    const clientsBySphere = {};
    Object.values(byClient).forEach(client => {
      if (!clientsBySphere[client.sphere]) {
        clientsBySphere[client.sphere] = [];
      }
      clientsBySphere[client.sphere].push(client);
    });
    
    const result = [];
    
    // Для каждой сферы деятельности находим похожих клиентов
    Object.entries(clientsBySphere).forEach(([sphere, clients]) => {
      // Находим клиентов этой сферы, которые покупали фокусные товары
      const sphereClientsWithFocus = clients.filter(c => clientsWithFocusSales.has(c.code));
      
      if (sphereClientsWithFocus.length === 0) {
        return; // Пропускаем сферы без клиентов, покупавших фокусные товары
      }
      
      // Находим клиентов этой сферы, которые НЕ покупали фокусные товары
      const sphereClientsWithoutFocus = clients.filter(c => !clientsWithFocusSales.has(c.code));
      
      
      // Рассчитываем средние показатели клиентов, покупавших фокусные товары
      const avgRevenue = sphereClientsWithFocus.reduce((sum, c) => {
        const revenue = c.sales.reduce((s, sale) => {
          const saleRevenue = typeof sale['Выручка'] === 'string' 
            ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (sale['Выручка'] || 0);
          return s + saleRevenue;
        }, 0);
        return sum + revenue;
      }, 0) / sphereClientsWithFocus.length;
      
      const avgFrequency = sphereClientsWithFocus.reduce((sum, c) => sum + c.sales.length, 0) / sphereClientsWithFocus.length;
      
      // Находим похожих клиентов
      sphereClientsWithoutFocus.forEach(client => {
        const clientRevenue = client.sales.reduce((sum, sale) => {
          const revenue = typeof sale['Выручка'] === 'string' 
            ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (sale['Выручка'] || 0);
          return sum + revenue;
        }, 0);
        
        const clientFrequency = client.sales.length;
        
        // Рассчитываем схожесть по выручке и частоте покупок
        const revenueSimilarity = Math.min(clientRevenue / avgRevenue, avgRevenue / clientRevenue) * 100;
        const frequencySimilarity = Math.min(clientFrequency / avgFrequency, avgFrequency / clientFrequency) * 100;
        
        const totalSimilarity = (revenueSimilarity + frequencySimilarity) / 2;
        
        if (totalSimilarity >= similarityThreshold) {
          result.push({
            name: client.name,
            code: client.code,
            sphere: client.sphere,
            sum: clientRevenue,
            lastDate: Math.max(...client.sales.map(s => new Date(s['Дата']).getTime())),
            similarity: Math.round(totalSimilarity),
            manager: client.manager,
            link: client.link
          });
        }
      });
    });
    
    // Сортируем по схожести (больше схожесть = выше в списке)
    result.sort((a, b) => b.similarity - a.similarity);
    
    return result;
  }
  
  /**
   * Параметр 7: Клієнти, які беруть X, але не беруть товари з фокуса
   */
  async getFocusClientsParam7(task) {
    
    const focusCodes = new Set(task.products || []);
    const xProducts = new Set(task.parameters?.param7?.products || []);
    
    if (xProducts.size === 0) {
      return [];
    }
    
    
    // Группируем продажи по клиенту
    const byClient = {};
    this.salesData.forEach(s => {
      const code = s['Клиент.Код'];
      if (!code) return;
      
      if (!byClient[code]) {
        byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: this.focusClientLinks && this.focusClientLinks[code] ? this.focusClientLinks[code] : ''
        };
      }
      byClient[code].sales.push(s);
    });
    
    const result = [];
    
    // Визначаємо правильне поле для кодів товарів
    const getProductCode = (sale) => {
      return sale['Номенклатура.Код'] || sale['Номенклатура'] || sale['Код'] || sale['Товар.Код'];
    };
    
    for (const c of Object.values(byClient)) {
      // Находим продажи товаров X
      const xSales = c.sales.filter(s => xProducts.has(getProductCode(s)));
      
      // Находим продажи фокусных товаров
      const focusSales = c.sales.filter(s => focusCodes.has(getProductCode(s)));
      
      // Клиент подходит если покупал X, но не покупал фокусные товары
      if (xSales.length > 0 && focusSales.length === 0) {
        const totalRevenue = c.sales.reduce((sum, sale) => {
          const revenue = typeof sale['Выручка'] === 'string' 
            ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (sale['Выручка'] || 0);
          return sum + revenue;
        }, 0);
        
        const xRevenue = xSales.reduce((sum, sale) => {
          const revenue = typeof sale['Выручка'] === 'string' 
            ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
            : (sale['Выручка'] || 0);
          return sum + revenue;
        }, 0);
        
        result.push({
          name: c.name,
          code: c.code,
          sphere: c.sphere,
          sum: totalRevenue,
          lastDate: Math.max(...c.sales.map(s => new Date(s['Дата']).getTime())),
          xRevenue: xRevenue,
          xSalesCount: xSales.length,
          manager: c.manager,
          link: c.link
        });
      }
    }
    
    // Сортируем по выручке от товаров X (больше выручка = выше в списке)
    result.sort((a, b) => b.xRevenue - a.xRevenue);
    
    return result;
  }
  
  /**
   * Детальный анализ клиента
   */
  async analyzeClient(clientCode, task) {
    
    const analysis = {
      basic: await this.getBasicInfo(clientCode),
      sales: await this.getSalesAnalysis(clientCode, task),
      orders: await this.getOrdersAnalysis(clientCode, task),
      nomenclature: await this.getNomenclatureAnalysis(clientCode, task),
      trends: await this.getTrendsAnalysis(clientCode, task),
      segments: await this.getSegmentationAnalysis(clientCode),
      activity: await this.getActivityAnalysis(clientCode),
      recommendations: await this.generateRecommendations(clientCode, task)
    };
    
    return analysis;
  }
  
  /**
   * Получение базовой информации о клиенте
   */
  async getBasicInfo(clientCode) {
    const clientInfo = this.clientManagerDirectory[clientCode];
    const clientSales = this.salesData.filter(s => s['Клиент.Код'] === clientCode);
    
    if (clientSales.length === 0) {
      return {
        code: clientCode,
        name: clientInfo?.name || clientCode,
        manager: clientInfo?.manager || '',
        link: clientInfo?.link || '',
        sphere: '',
        firstPurchase: null,
        lastPurchase: null,
        totalPurchases: 0,
        totalRevenue: 0
      };
    }
    
    const firstSale = clientSales.reduce((earliest, sale) => {
      const saleDate = new Date(sale['Дата']);
      return earliest && saleDate > earliest ? earliest : saleDate;
    }, null);
    
    const lastSale = clientSales.reduce((latest, sale) => {
      const saleDate = new Date(sale['Дата']);
      return latest && saleDate > latest ? saleDate : latest;
    }, null);
    
    const totalRevenue = clientSales.reduce((sum, sale) => {
      const revenue = typeof sale['Выручка'] === 'string' 
        ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (sale['Выручка'] || 0);
      return sum + revenue;
    }, 0);
    
    return {
      code: clientCode,
      name: clientSales[0]['Клиент'] || clientInfo?.name || clientCode,
      manager: clientSales[0]['Основной менеджер'] || clientInfo?.manager || '',
      link: clientInfo?.link || '',
      sphere: clientSales[0]['Сфера деятельности'] || '',
      firstPurchase: firstSale,
      lastPurchase: lastSale,
      totalPurchases: clientSales.length,
      totalRevenue: totalRevenue
    };
  }
  
  /**
   * Анализ продаж клиента
   */
  async getSalesAnalysis(clientCode, task) {
    const clientSales = this.salesData.filter(s => s['Клиент.Код'] === clientCode);
    const focusProducts = new Set(task.products || []);
    
    // Группируем продажи по периодам
    const salesByPeriod = this.groupSalesByPeriod(clientSales);
    
    // Анализируем продажи фокусных товаров
    const focusSales = clientSales.filter(s => focusProducts.has(s['Номенклатура']));
    const focusRevenue = focusSales.reduce((sum, s) => {
      const revenue = typeof s['Выручка'] === 'string' 
        ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (s['Выручка'] || 0);
      return sum + revenue;
    }, 0);
    
    // Топ товары
    const productStats = {};
    clientSales.forEach(sale => {
      const product = sale['Номенклатура'];
      const revenue = typeof sale['Выручка'] === 'string' 
        ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (sale['Выручка'] || 0);
      
      if (!productStats[product]) {
        productStats[product] = { revenue: 0, count: 0, lastDate: new Date(sale['Дата']) };
      }
      
      productStats[product].revenue += revenue;
      productStats[product].count += 1;
      
      const saleDate = new Date(sale['Дата']);
      if (saleDate > productStats[product].lastDate) {
        productStats[product].lastDate = saleDate;
      }
    });
    
    const topProducts = Object.entries(productStats)
      .map(([name, stats]) => ({
        name,
        revenue: stats.revenue,
        count: stats.count,
        lastDate: stats.lastDate,
        isFocus: focusProducts.has(name)
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    return {
      totalRevenue: clientSales.reduce((sum, s) => {
        const revenue = typeof s['Выручка'] === 'string' 
          ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) 
          : (s['Выручка'] || 0);
        return sum + revenue;
      }, 0),
      focusRevenue: focusRevenue,
      salesByPeriod: salesByPeriod,
      topProducts: topProducts,
      salesTrend: this.calculateSalesTrend(clientSales),
      lastPurchaseDate: this.getLastPurchaseDate(clientSales),
      daysSinceLastPurchase: this.calculateDaysSinceLastPurchase(clientSales),
      averageOrderValue: this.calculateAverageOrderValue(clientSales)
    };
  }
  
  /**
   * Анализ заказов клиента
   */
  async getOrdersAnalysis(clientCode, task) {
    const clientSales = this.salesData.filter(s => s['Клиент.Код'] === clientCode);
    
    // Группируем продажи по датам (заказы)
    const ordersByDate = {};
    clientSales.forEach(sale => {
      const date = sale['Дата'].split('T')[0]; // Берем только дату
      if (!ordersByDate[date]) {
        ordersByDate[date] = {
          date: date,
          items: [],
          totalRevenue: 0,
          itemCount: 0
        };
      }
      
      const revenue = typeof sale['Выручка'] === 'string' 
        ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (sale['Выручка'] || 0);
      
      ordersByDate[date].items.push(sale);
      ordersByDate[date].totalRevenue += revenue;
      ordersByDate[date].itemCount += 1;
    });
    
    const orders = Object.values(ordersByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return {
      totalOrders: orders.length,
      averageOrderValue: orders.reduce((sum, o) => sum + o.totalRevenue, 0) / orders.length,
      orderFrequency: this.calculateOrderFrequency(orders),
      lastOrderDate: orders.length > 0 ? new Date(orders[orders.length - 1].date) : null,
      daysSinceLastOrder: this.calculateDaysSinceLastOrder(orders),
      orderTrend: this.calculateOrderTrend(orders),
      averageItemsPerOrder: orders.reduce((sum, o) => sum + o.itemCount, 0) / orders.length
    };
  }
  
  /**
   * Анализ номенклатуры клиента
   */
  async getNomenclatureAnalysis(clientCode, task) {
    const clientSales = this.salesData.filter(s => s['Клиент.Код'] === clientCode);
    const focusProducts = new Set(task.products || []);
    
    // Группируем по категориям номенклатуры
    const categoryStats = {};
    const productStats = {};
    
    clientSales.forEach(sale => {
      const product = sale['Номенклатура'];
      const revenue = typeof sale['Выручка'] === 'string' 
        ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (sale['Выручка'] || 0);
      
      // Находим категорию товара
      const nomenclatureItem = this.nomenclatureData.find(n => n['Код'] === product);
      const category = nomenclatureItem ? nomenclatureItem['Категория 1'] || 'Без категорії' : 'Без категорії';
      
      if (!categoryStats[category]) {
        categoryStats[category] = { revenue: 0, count: 0, products: new Set() };
      }
      
      categoryStats[category].revenue += revenue;
      categoryStats[category].count += 1;
      categoryStats[category].products.add(product);
      
      if (!productStats[product]) {
        productStats[product] = { revenue: 0, count: 0, category: category };
      }
      
      productStats[product].revenue += revenue;
      productStats[product].count += 1;
    });
    
    // Анализ перекрестных продаж
    const crossSellingOpportunities = this.findCrossSellingOpportunities(clientSales, task);
    
    return {
      totalProducts: new Set(clientSales.map(s => s['Номенклатура'])).size,
      focusProducts: clientSales.filter(s => focusProducts.has(s['Номенклатура'])),
      productCategories: Object.entries(categoryStats).map(([category, stats]) => ({
        category,
        revenue: stats.revenue,
        count: stats.count,
        productCount: stats.products.size
      })),
      crossSellingOpportunities: crossSellingOpportunities,
      topProducts: Object.entries(productStats)
        .map(([name, stats]) => ({
          name,
          revenue: stats.revenue,
          count: stats.count,
          category: stats.category,
          isFocus: focusProducts.has(name)
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    };
  }
  
  /**
   * Анализ трендов клиента
   */
  async getTrendsAnalysis(clientCode, task) {
    const clientSales = this.salesData.filter(s => s['Клиент.Код'] === clientCode);
    const focusProducts = new Set(task.products || []);
    
    // Группируем продажи по месяцам
    const monthlySales = {};
    clientSales.forEach(sale => {
      const date = new Date(sale['Дата']);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlySales[monthKey]) {
        monthlySales[monthKey] = {
          totalRevenue: 0,
          focusRevenue: 0,
          orderCount: 0,
          productCount: 0
        };
      }
      
      const revenue = typeof sale['Выручка'] === 'string' 
        ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (sale['Выручка'] || 0);
      
      monthlySales[monthKey].totalRevenue += revenue;
      monthlySales[monthKey].orderCount += 1;
      
      if (focusProducts.has(sale['Номенклатура'])) {
        monthlySales[monthKey].focusRevenue += revenue;
      }
    });
    
    // Анализируем тренды
    const months = Object.keys(monthlySales).sort();
    const revenueTrend = months.map(month => monthlySales[month].totalRevenue);
    const focusRevenueTrend = months.map(month => monthlySales[month].focusRevenue);
    
    return {
      monthlySales: monthlySales,
      revenueTrend: revenueTrend,
      focusRevenueTrend: focusRevenueTrend,
      growthRate: this.calculateGrowthRate(revenueTrend),
      focusGrowthRate: this.calculateGrowthRate(focusRevenueTrend),
      trendDirection: this.determineTrendDirection(revenueTrend)
    };
  }
  
  /**
   * Сегментационный анализ клиента
   */
  async getSegmentationAnalysis(clientCode) {
    const clientSales = this.salesData.filter(s => s['Клиент.Код'] === clientCode);
    
    if (clientSales.length === 0) {
      return {
        segment: 'new',
        rfmScore: { recency: 0, frequency: 0, monetary: 0 },
        totalScore: 0
      };
    }
    
    // RFM анализ
    const now = new Date();
    const lastPurchase = new Date(Math.max(...clientSales.map(s => new Date(s['Дата']).getTime())));
    const recency = Math.ceil((now - lastPurchase) / (1000 * 60 * 60 * 24));
    
    const totalRevenue = clientSales.reduce((sum, s) => {
      const revenue = typeof s['Выручка'] === 'string' 
        ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (s['Выручка'] || 0);
      return sum + revenue;
    }, 0);
    
    const frequency = clientSales.length;
    
    // Определяем сегмент
    let segment = 'new';
    if (recency <= 30 && frequency >= 5 && totalRevenue >= 10000) {
      segment = 'vip';
    } else if (recency <= 90 && frequency >= 3 && totalRevenue >= 5000) {
      segment = 'regular';
    } else if (recency <= 180 && frequency >= 1 && totalRevenue >= 1000) {
      segment = 'occasional';
    } else if (recency > 180) {
      segment = 'inactive';
    }
    
    return {
      segment: segment,
      rfmScore: { recency, frequency, monetary: totalRevenue },
      totalScore: this.calculateRFMScore(recency, frequency, totalRevenue)
    };
  }
  
  /**
   * Анализ активности клиента
   */
  async getActivityAnalysis(clientCode) {
    // Здесь можно добавить анализ звонков и дел из API
    // Пока возвращаем базовую информацию
    return {
      totalCalls: 0,
      successfulCalls: 0,
      totalDeals: 0,
      activeDeals: 0,
      lastActivity: null,
      activityScore: 0
    };
  }
  
  /**
   * Генерация рекомендаций
   */
  async generateRecommendations(clientCode, task) {
    const analysis = await this.analyzeClient(clientCode, task);
    const recommendations = [];
    
    // Рекомендации на основе сегмента
    if (analysis.segments.segment === 'vip') {
      recommendations.push({
        type: 'upsell',
        priority: 'high',
        message: 'VIP клієнт - можна пропонувати преміум товари та послуги'
      });
    } else if (analysis.segments.segment === 'inactive') {
      recommendations.push({
        type: 'reactivation',
        priority: 'high',
        message: 'Неактивний клієнт - потрібна програма реактивації'
      });
    }
    
    // Рекомендации на основе фокусных товаров
    const focusRevenue = analysis.sales.focusRevenue;
    const totalRevenue = analysis.sales.totalRevenue;
    
    if (focusRevenue > 0 && focusRevenue < totalRevenue * 0.3) {
      recommendations.push({
        type: 'focus_upsell',
        priority: 'medium',
        message: 'Можна збільшити продажі фокусних товарів'
      });
    }
    
    // Рекомендации на основе дней без заказов
    const daysSinceLastOrder = analysis.orders.daysSinceLastOrder;
    if (daysSinceLastOrder > 90) {
      recommendations.push({
        type: 'contact',
        priority: 'high',
        message: `Клієнт не замовляв ${daysSinceLastOrder} днів - потрібен дзвінок`
      });
    }
    
    return recommendations;
  }
  
  // Вспомогательные методы
  
  /**
   * Группировка продаж по периодам
   */
  groupSalesByPeriod(sales) {
    const periods = {};
    sales.forEach(sale => {
      const date = new Date(sale['Дата']);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!periods[monthKey]) {
        periods[monthKey] = { revenue: 0, count: 0 };
      }
      
      const revenue = typeof sale['Выручка'] === 'string' 
        ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (sale['Выручка'] || 0);
      
      periods[monthKey].revenue += revenue;
      periods[monthKey].count += 1;
    });
    
    return periods;
  }
  
  /**
   * Расчет тренда продаж
   */
  calculateSalesTrend(sales) {
    if (sales.length < 2) return 'stable';
    
    const monthlyRevenue = this.groupSalesByPeriod(sales);
    const months = Object.keys(monthlyRevenue).sort();
    
    if (months.length < 2) return 'stable';
    
    const firstMonth = monthlyRevenue[months[0]].revenue;
    const lastMonth = monthlyRevenue[months[months.length - 1]].revenue;
    
    const change = ((lastMonth - firstMonth) / firstMonth) * 100;
    
    if (change > 10) return 'growing';
    if (change < -10) return 'declining';
    return 'stable';
  }
  
  /**
   * Получение даты последней покупки
   */
  getLastPurchaseDate(sales) {
    if (sales.length === 0) return null;
    return new Date(Math.max(...sales.map(s => new Date(s['Дата']).getTime())));
  }
  
  /**
   * Расчет дней с последней покупки
   */
  calculateDaysSinceLastPurchase(sales) {
    const lastPurchase = this.getLastPurchaseDate(sales);
    if (!lastPurchase) return null;
    
    const now = new Date();
    return Math.ceil((now - lastPurchase) / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Расчет среднего чека
   */
  calculateAverageOrderValue(sales) {
    if (sales.length === 0) return 0;
    
    const totalRevenue = sales.reduce((sum, s) => {
      const revenue = typeof s['Выручка'] === 'string' 
        ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) 
        : (s['Выручка'] || 0);
      return sum + revenue;
    }, 0);
    
    return totalRevenue / sales.length;
  }
  
  /**
   * Расчет частоты заказов
   */
  calculateOrderFrequency(orders) {
    if (orders.length < 2) return null;
    
    const firstOrder = new Date(orders[0].date);
    const lastOrder = new Date(orders[orders.length - 1].date);
    const daysDiff = (lastOrder - firstOrder) / (1000 * 60 * 60 * 24);
    
    return orders.length / (daysDiff / 30); // Заказов в месяц
  }
  
  /**
   * Расчет дней с последнего заказа
   */
  calculateDaysSinceLastOrder(orders) {
    if (orders.length === 0) return null;
    
    const lastOrder = new Date(orders[orders.length - 1].date);
    const now = new Date();
    return Math.ceil((now - lastOrder) / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Расчет тренда заказов
   */
  calculateOrderTrend(orders) {
    if (orders.length < 3) return 'stable';
    
    const recentOrders = orders.slice(-3);
    const olderOrders = orders.slice(-6, -3);
    
    const recentAvg = recentOrders.reduce((sum, o) => sum + o.totalRevenue, 0) / recentOrders.length;
    const olderAvg = olderOrders.reduce((sum, o) => sum + o.totalRevenue, 0) / olderOrders.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'growing';
    if (change < -10) return 'declining';
    return 'stable';
  }
  
  /**
   * Поиск возможностей перекрестных продаж
   */
  findCrossSellingOpportunities(sales, task) {
    const focusProducts = new Set(task.products || []);
    const clientProducts = new Set(sales.map(s => s['Номенклатура']));
    
    // Находим товары, которые клиент не покупал, но покупал фокусные
    const opportunities = [];
    
    focusProducts.forEach(focusProduct => {
      if (!clientProducts.has(focusProduct)) {
        opportunities.push({
          product: focusProduct,
          reason: 'Клієнт купує схожі товари, але не цей фокусний товар'
        });
      }
    });
    
    return opportunities;
  }
  
  /**
   * Расчет темпа роста
   */
  calculateGrowthRate(values) {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }
  
  /**
   * Определение направления тренда
   */
  determineTrendDirection(values) {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    
    if (last > first * 1.1) return 'growing';
    if (last < first * 0.9) return 'declining';
    return 'stable';
  }
  
  /**
   * Расчет RFM скора
   */
  calculateRFMScore(recency, frequency, monetary) {
    // Простая формула RFM скора
    const rScore = recency <= 30 ? 5 : recency <= 60 ? 4 : recency <= 90 ? 3 : recency <= 180 ? 2 : 1;
    const fScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 2 ? 2 : 1;
    const mScore = monetary >= 10000 ? 5 : monetary >= 5000 ? 4 : monetary >= 2000 ? 3 : monetary >= 1000 ? 2 : 1;
    
    return rScore + fScore + mScore;
  }
} 