# Оптимизация и История отчетов - Дашборд по отделам

## 🚀 Оптимизация процесса загрузки

### Текущие проблемы:
1. **Последовательная загрузка** - данные загружаются один за другим
2. **Повторные запросы** - при каждом изменении фильтров
3. **Большие объемы данных** - все продажи загружаются каждый раз
4. **Нет кеширования** - повторные расчеты при переключении периодов

### Предлагаемые улучшения:

#### 1. Кеширование данных в IndexedDB
```javascript
// Схема кеширования
{
  salesData: {
    lastUpdated: Date,
    data: [...] // Данные продаж
  },
  clientDirectory: {
    lastUpdated: Date,
    data: {...} // Справочник клиентов
  },
  employees: {
    companyId: String,
    lastUpdated: Date,
    data: [...] // Сотрудники
  }
}
```

#### 2. Предварительные расчеты
```javascript
// Создать промежуточные структуры для быстрого поиска
const salesByManager = new Map(); // менеджер -> продажи
const salesByClient = new Map();  // клиент -> продажи
const salesByPeriod = new Map();  // период -> продажи
```

#### 3. Web Workers для тяжелых расчетов
```javascript
// worker.js - расчет KPI в отдельном потоке
self.onmessage = function(e) {
  const { salesData, employees, period } = e.data;
  const kpiResults = calculateAllKPI(salesData, employees, period);
  self.postMessage(kpiResults);
};
```

#### 4. Ленивая загрузка
- Загружать данные только при первом обращении к отделу
- Использовать виртуализацию для больших таблиц
- Подгружать детали по требованию

## 📊 История отчетов по отделам

### Концепция снимков данных

#### Структура снимка в Firestore:
```javascript
// Коллекция: companies/{companyId}/departmentReports
{
  id: "2024-12-department-snapshot",
  period: "2024-12", // Период отчета
  createdAt: Timestamp,
  createdBy: "userId",
  departments: {
    "deptId1": {
      name: "Отдел продаж",
      summary: {
        totalClients: 150,
        shippedClients: 120,
        totalRevenue: 500000,
        avgCheck: 4166.67,
        focusTaskAmount: 50000,
        focusActualRevenue: 45000
      },
      managers: [
        {
          id: "managerId1",
          name: "Іван Іванов",
          kpi: {
            totalClients: 50,
            shippedClients: 40,
            shipmentPercentage: 80,
            avgCheck: 5000,
            ltv: 10000,
            totalRevenue: 200000,
            focusClients: 10,
            shippedFocusClients: 8,
            focusActualRevenue: 15000,
            productCoverage: 75.5
          }
        }
      ]
    }
  },
  metadata: {
    dataSourceVersion: "v1.2",
    calculationRules: {
      avgCheckMethod: "totalRevenue/totalChecks",
      focusLogic: "clientsSnapshot+products"
    }
  }
}
```

#### Автоматическое создание снимков:
```javascript
// Функция для создания снимка отчета
async function createDepartmentSnapshot(period) {
  const companyId = window.state.currentCompanyId;
  const reportData = await generateFullDepartmentReport(period);
  
  const snapshot = {
    period,
    createdAt: new Date(),
    createdBy: window.state.currentUserId,
    departments: reportData,
    metadata: {
      dataSourceVersion: "v1.2",
      calculationRules: getCurrentCalculationRules(),
      dataHash: generateDataHash(reportData)
    }
  };
  
  const docRef = firebase.collection(
    firebase.db, 
    `companies/${companyId}/departmentReports`
  );
  
  await firebase.addDoc(docRef, snapshot);
  return snapshot;
}
```

#### Планировщик снимков:
```javascript
// Cloud Function или клиентский планировщик
// Создавать снимки автоматически в конце каждого месяца
exports.createMonthlyDepartmentSnapshot = functions.pubsub
  .schedule('0 2 1 * *') // 1 числа каждого месяца в 2:00
  .onRun(async (context) => {
    const lastMonth = getLastMonthPeriod();
    await createDepartmentSnapshot(lastMonth);
  });
```

### Сравнение отчетов

#### UI для истории:
```javascript
// Добавить в фильтры
<select id="report-mode">
  <option value="current">Поточний звіт</option>
  <option value="history">Історія звітів</option>
  <option value="compare">Порівняння періодів</option>
</select>

<select id="history-period" style="display:none">
  <option value="2024-12">Грудень 2024</option>
  <option value="2024-11">Листопад 2024</option>
  <!-- ... -->
</select>
```

#### Функция сравнения:
```javascript
function compareReports(currentPeriod, previousPeriod) {
  return {
    revenue: {
      current: currentData.totalRevenue,
      previous: previousData.totalRevenue,
      change: calculateChange(current, previous),
      trend: getTrend(change)
    },
    // ... другие показатели
  };
}
```

### Преимущества снимков:

1. **Быстрая загрузка исторических данных**
2. **Сравнение периодов** без пересчета
3. **Защита от изменений в логике** расчетов
4. **Аудит изменений** в показателях
5. **Резервное копирование** отчетов

### График внедрения:

1. **Фаза 1**: Кеширование и оптимизация загрузки
2. **Фаза 2**: Создание структуры снимков
3. **Фаза 3**: Автоматизация создания снимков
4. **Фаза 4**: UI для истории и сравнений
5. **Фаза 5**: Планировщик и уведомления

## 🔧 Технические детали реализации

### IndexedDB схема:
```javascript
const dbSchema = {
  name: 'DepartmentDashboardCache',
  version: 1,
  stores: {
    salesData: { keyPath: 'period' },
    employees: { keyPath: 'companyId' },
    calculations: { keyPath: 'id' }
  }
};
```

### Service Worker для фонового обновления:
```javascript
// sw.js
self.addEventListener('message', async (event) => {
  if (event.data.type === 'UPDATE_CACHE') {
    await updateCachedData();
    event.ports[0].postMessage({ success: true });
  }
});
```

Эта концепция обеспечит быструю работу дашборда и возможность анализа динамики показателей.