// Алгоритмы прогнозирования продаж
// Автор: AI Assistant
// Дата: 2024

// Глобальные настройки жизненного цикла клиента
export const LIFECYCLE_SETTINGS = {
    // Пороговые значения для определения стадии жизненного цикла
    NEW_CLIENT_ORDERS: 1,                    // Количество заказов для нового клиента
    GROWING_CLIENT_MIN_ORDERS: 5,            // Минимальное количество заказов для растущего клиента
    ACTIVE_CLIENT_MIN_ORDERS: 10,            // Минимальное количество заказов для активного клиента
    
    // Множители для определения стадии по времени
    AT_RISK_MULTIPLIER: 3,                   // Множитель для определения клиента в группе риска
    ACTIVE_CLIENT_MULTIPLIER: 1.5,           // Множитель для активного клиента
    GROWING_CLIENT_MULTIPLIER: 2,            // Множитель для растущего клиента
    
    // Настройки прогнозирования
    FORECAST_REDUCTION_FOR_AT_RISK: 0.7,     // Снижение прогноза для клиентов в группе риска (30%)
    
    // Настройки точности
    MIN_CONFIDENCE_NEW: 0.3,                 // Минимальная уверенность для новых клиентов
    MIN_CONFIDENCE_GROWING: 0.6,             // Минимальная уверенность для растущих клиентов
    MIN_CONFIDENCE_ACTIVE: 0.8,              // Минимальная уверенность для активных клиентов
    MIN_CONFIDENCE_AT_RISK: 0.4              // Минимальная уверенность для клиентов в группе риска
};

// Основные алгоритмы прогнозирования
export class ForecastingAlgorithms {
    
    static trendAnalysis(data, periods = 12) {
        if (data.length < 2) return new Array(periods).fill(data[0] || 0);
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i; sumY += data[i]; sumXY += i * data[i]; sumX2 += i * i;
        }
        const denominator = (n * sumX2 - sumX * sumX);
        if (denominator === 0) return new Array(periods).fill(data.reduce((a, b) => a + b, 0) / n);
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        const forecast = [];
        for (let i = 0; i < periods; i++) {
            forecast.push(Math.max(0, slope * (n + i) + intercept));
        }
        return forecast;
    }

    static seasonalDecomposition(data, seasonLength = 12, periods = 12) {
        if (data.length < seasonLength * 2) {
             const trendForecast = this.trendAnalysis(data, periods);
             return { trend: trendForecast, seasonal: new Array(periods).fill(0), forecast: trendForecast };
        }
        const trend = this.calculateTrend(data, seasonLength);
        const seasonal = this.calculateSeasonal(data, trend, seasonLength);
        const trendForecast = this.trendAnalysis(trend, periods);
        const seasonalForecast = this.forecastSeasonal(seasonal, periods, seasonLength);
        const forecast = trendForecast.map((t, i) => Math.max(0, t + seasonalForecast[i]));
        return { trend: trendForecast, seasonal: seasonalForecast, forecast: forecast };
    }

    static calculateTrend(data, seasonLength) {
        const trend = []; const halfSeason = Math.floor(seasonLength / 2);
        for (let i = 0; i < data.length; i++) {
            let sum = 0; let count = 0;
            for (let j = Math.max(0, i - halfSeason); j <= Math.min(data.length - 1, i + halfSeason); j++) {
                sum += data[j]; count++;
            }
            trend.push(sum / count);
        }
        return trend;
    }

    static calculateSeasonal(data, trend, seasonLength) {
        const seasonalPattern = new Array(seasonLength).fill(0);
        const seasonalCounts = new Array(seasonLength).fill(0);
        for (let i = 0; i < data.length; i++) {
            const seasonIndex = i % seasonLength;
            seasonalPattern[seasonIndex] += data[i] - trend[i];
            seasonalCounts[seasonIndex]++;
        }
        for (let i = 0; i < seasonLength; i++) {
            if (seasonalCounts[i] > 0) seasonalPattern[i] /= seasonalCounts[i];
        }
        return seasonalPattern;
    }

    static forecastSeasonal(seasonalPattern, periods, seasonLength) {
        const forecast = [];
        for (let i = 0; i < periods; i++) {
            forecast.push(seasonalPattern[i % seasonLength] || 0);
        }
        return forecast;
    }

    static neuralNetworkForecast(data, periods = 12, lookback = 6) {
        if (data.length < lookback + 1) {
            return this.trendAnalysis(data, periods);
        }
        
        const { normalizedData, min, max } = this.normalizeData(data);
        
        const trainingData = [];
        const targets = [];
        for (let i = lookback; i < normalizedData.length; i++) {
            trainingData.push(normalizedData.slice(i - lookback, i));
            targets.push(normalizedData[i]);
        }
        
        const inputSize = lookback;
        const hiddenSize = Math.max(4, Math.floor(inputSize / 2));
        
        let weights1 = this.initializeWeights(inputSize, hiddenSize);
        let weights2 = this.initializeWeights(hiddenSize, 1);
        
        const epochs = 100;
        const learningRate = 0.01;
        
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (let i = 0; i < trainingData.length; i++) {
                const hidden = this.forwardPass(trainingData[i], weights1);
                const output = this.forwardPassLinear(hidden, weights2);
                const error = targets[i] - output[0];
                this.backpropagateLinear(trainingData[i], hidden, error, weights1, weights2, learningRate);
            }
        }
        
        const forecast = [];
        let currentInput = normalizedData.slice(-lookback);
        
        for (let i = 0; i < periods; i++) {
            const hidden = this.forwardPass(currentInput, weights1);
            const output = this.forwardPassLinear(hidden, weights2); // ИСПРАВЛЕНО
            const normalizedPrediction = output[0];
            
            const prediction = this.denormalizeValue(normalizedPrediction, min, max);
            forecast.push(Math.max(0, prediction));
            
            currentInput = [...currentInput.slice(1), normalizedPrediction];
        }
        
        return forecast;
    }
    
    static initializeWeights(inputSize, outputSize) {
        const weights = [];
        for (let i = 0; i < inputSize; i++) {
            weights[i] = [];
            for (let j = 0; j < outputSize; j++) {
                weights[i][j] = (Math.random() - 0.5) * 0.1;
            }
        }
        return weights;
    }
    
    static forwardPass(input, weights) {
        const output = [];
        for (let j = 0; j < weights[0].length; j++) {
            let sum = 0;
            for (let i = 0; i < input.length; i++) {
                sum += input[i] * weights[i][j];
            }
            output[j] = this.sigmoid(sum);
        }
        return output;
    }
    
    static sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    
    static sigmoidDerivative(sig) { return sig * (1 - sig); }
    
    static normalizeData(data) {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min;
        if (range === 0) return { normalizedData: data.map(() => 0.5), min, max };
        const normalizedData = data.map(value => (value - min) / range);
        return { normalizedData, min, max };
    }
    
    static denormalizeValue(normalizedValue, min, max) { return normalizedValue * (max - min) + min; }
    
    static forwardPassLinear(input, weights) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
            sum += input[i] * weights[i][0];
        }
        return [sum];
    }
    
    static backpropagateLinear(input, hidden, error, weights1, weights2, learningRate) {
        const outputDelta = error;

        const hiddenErrors = [];
        for(let i=0; i < hidden.length; i++) {
            hiddenErrors[i] = outputDelta * weights2[i][0];
        }

        const hiddenDeltas = [];
        for(let i=0; i < hidden.length; i++) {
            hiddenDeltas[i] = hiddenErrors[i] * this.sigmoidDerivative(hidden[i]);
        }

        for (let i = 0; i < hidden.length; i++) {
            weights2[i][0] += learningRate * outputDelta * hidden[i];
        }

        for (let i = 0; i < input.length; i++) {
            for (let j = 0; j < hidden.length; j++) {
                weights1[i][j] += learningRate * hiddenDeltas[j] * input[i];
            }
        }
    }
    
    static combinedForecast(data, periods = 12, weights = { trend: 0.4, seasonal: 0.4, neural: 0.2 }) {
        const trendForecast = this.trendAnalysis(data, periods);
        const seasonalForecast = this.seasonalDecomposition(data, 12, periods).forecast;
        const neuralForecast = this.neuralNetworkForecast(data, periods);
        const combinedForecast = [];
        for (let i = 0; i < periods; i++) {
            const combined = (trendForecast[i] || 0) * weights.trend + (seasonalForecast[i] || 0) * weights.seasonal + (neuralForecast[i] || 0) * weights.neural;
            combinedForecast.push(Math.max(0, combined));
        }
        return { trend: trendForecast, seasonal: seasonalForecast, neural: neuralForecast, combined: combinedForecast };
    }
    
    /**
     * Расчет точности прогноза
     * @param {Array} actual - фактические значения
     * @param {Array} forecast - прогнозные значения
     * @returns {Object} - метрики точности
     */
    static calculateAccuracy(actual, forecast) {
        if (actual.length !== forecast.length || actual.length === 0) {
            return { rmse: 0, mape: 0 };
        }
        
        let sumSquaredError = 0;
        let sumAbsolutePercentageError = 0;
        let validPoints = 0;
        
        for (let i = 0; i < actual.length; i++) {
            if (actual[i] > 0) {
                const error = actual[i] - forecast[i];
                const percentageError = Math.abs(error / actual[i]) * 100;
                
                sumSquaredError += error * error;
                sumAbsolutePercentageError += percentageError;
                validPoints++;
            }
        }
        
        if (validPoints === 0) {
            return { rmse: 0, mape: 0 };
        }
        
        const rmse = Math.sqrt(sumSquaredError / validPoints);
        const mape = sumAbsolutePercentageError / validPoints;
        
        return { rmse, mape };
    }
}

// Утилиты для работы с данными продаж
export class SalesDataProcessor {
    
    /**
     * Подготовка данных для прогнозирования
     * @param {Array} salesData - сырые данные продаж
     * @param {Array} excludedNomenclature - исключенная номенклатура
     * @param {string} aggregationLevel - уровень агрегации (month, quarter, year)
     * @returns {Array} - подготовленные данные
     */
    static prepareDataForForecasting(salesData, excludedNomenclature = [], aggregationLevel = 'month') {
        // Фильтруем исключенную номенклатуру
        const filteredData = salesData.filter(sale => {
            return !excludedNomenclature.includes(sale['Номенклатура']);
        });
        
        // Группируем по периодам
        const groupedData = this.groupByPeriod(filteredData, aggregationLevel);
        
        // Сортируем по дате
        const sortedData = Object.entries(groupedData)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .map(([_, value]) => value);
        
        return sortedData;
    }
    
    /**
     * Группировка данных по периодам
     */
    static groupByPeriod(data, level) {
        const grouped = {};
        
        data.forEach(sale => {
            const date = new Date(sale['Дата']);
            let periodKey;
            
            switch (level) {
                case 'month':
                    periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'quarter':
                    const quarter = Math.floor(date.getMonth() / 3) + 1;
                    periodKey = `${date.getFullYear()}-Q${quarter}`;
                    break;
                case 'year':
                    periodKey = `${date.getFullYear()}`;
                    break;
                default:
                    periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }
            
            if (!grouped[periodKey]) {
                grouped[periodKey] = 0;
            }
            
            const revenue = typeof sale['Выручка'] === 'string' 
                ? parseFloat(sale['Выручка'].replace(/\s/g, '').replace(',', '.')) 
                : (sale['Выручка'] || 0);
            
            grouped[periodKey] += revenue;
        });
        
        return grouped;
    }
    
    /**
     * Прогнозирование по менеджерам
     * @param {Array} salesData - данные продаж
     * @param {string} managerName - имя менеджера
     * @param {number} periods - количество периодов
     * @returns {Object} - прогноз для менеджера
     */
    static forecastByManager(salesData, managerName, periods = 12) {
        const managerSales = salesData.filter(sale => 
            (sale['Основной менеджер'] || sale['Менеджер']) === managerName
        );
        
        const preparedData = this.prepareDataForForecasting(managerSales);
        
        return {
            manager: managerName,
            historical: preparedData,
            forecast: ForecastingAlgorithms.combinedForecast(preparedData, periods),
            accuracy: this.calculateHistoricalAccuracy(preparedData)
        };
    }
    
    /**
     * Прогнозирование по отделам
     * @param {Array} salesData - данные продаж
     * @param {Array} employees - данные сотрудников
     * @param {string} departmentName - название отдела
     * @param {number} periods - количество периодов
     * @returns {Object} - прогноз для отдела
     */
    static forecastByDepartment(salesData, employees, departmentName, periods = 12) {
        // Находим сотрудников отдела
        const departmentEmployees = employees.filter(emp => 
            emp.department && emp.department.name === departmentName
        );
        
        // Получаем продажи сотрудников отдела
        const departmentSales = salesData.filter(sale => {
            const manager = sale['Основной менеджер'] || sale['Менеджер'];
            return departmentEmployees.some(emp => emp.name === manager);
        });
        
        const preparedData = this.prepareDataForForecasting(departmentSales);
        
        return {
            department: departmentName,
            historical: preparedData,
            forecast: ForecastingAlgorithms.combinedForecast(preparedData, periods),
            accuracy: this.calculateHistoricalAccuracy(preparedData)
        };
    }
    
    /**
     * Вычисление точности на исторических данных
     */
    static calculateHistoricalAccuracy(data) {
        if (data.length < 6) return { rmse: 0, mape: 0 };
        
        // Используем первые 80% данных для обучения, остальные для тестирования
        const splitIndex = Math.floor(data.length * 0.8);
        const trainingData = data.slice(0, splitIndex);
        const testData = data.slice(splitIndex);
        
        const forecast = ForecastingAlgorithms.combinedForecast(trainingData, testData.length);
        
        return ForecastingAlgorithms.calculateAccuracy(testData, forecast.combined);
    }
}

export class ClientLifecycleForecasting {
    
    /**
     * Анализ жизненного цикла клиента
     * @param {Array} salesData - данные продаж
     * @param {string} clientCode - код клиента
     * @param {Object} settings - настройки жизненного цикла (опционально)
     * @returns {Object} - анализ жизненного цикла
     */
    static analyzeClientLifecycle(salesData, clientCode, settings = LIFECYCLE_SETTINGS) {
        const clientSales = salesData.filter(sale => sale['Клиент.Код'] === clientCode);
        
        if (clientSales.length === 0) {
            return {
                clientCode,
                firstPurchase: null,
                lastPurchase: null,
                totalPurchases: 0,
                totalRevenue: 0,
                averageOrderValue: 0,
                purchaseFrequency: 0,
                lifecycleStage: 'new',
                seasonalPattern: [],
                productPreferences: {}
            };
        }
        
        // Сортируем продажи по дате
        const sortedSales = clientSales.sort((a, b) => new Date(a['Дата']) - new Date(b['Дата']));
        
        const firstPurchase = new Date(sortedSales[0]['Дата']);
        const lastPurchase = new Date(sortedSales[sortedSales.length - 1]['Дата']);
        const totalRevenue = sortedSales.reduce((sum, sale) => sum + (parseFloat(sale['Выручка']) || 0), 0);
        const averageOrderValue = totalRevenue / sortedSales.length;
        
        // Анализируем частоту покупок
        const daysSinceFirstPurchase = (lastPurchase - firstPurchase) / (1000 * 60 * 60 * 24);
        const purchaseFrequency = daysSinceFirstPurchase > 0 ? sortedSales.length / (daysSinceFirstPurchase / 30) : 0;
        
        // Определяем стадию жизненного цикла с использованием настраиваемых параметров
        const currentDate = new Date();
        const daysSinceLastPurchase = (currentDate - lastPurchase) / (1000 * 60 * 60 * 24);
        const averageDaysBetweenPurchases = daysSinceFirstPurchase / (sortedSales.length - 1);
        
        let lifecycleStage = 'new';
        
        // Критерии для определения стадии жизненного цикла с использованием настроек
        if (sortedSales.length === settings.NEW_CLIENT_ORDERS) {
            // Один заказ - новый клиент
            lifecycleStage = 'new';
        } else if (daysSinceLastPurchase > averageDaysBetweenPurchases * settings.AT_RISK_MULTIPLIER) {
            // Последняя покупка была больше чем в N раз дольше среднего интервала
            lifecycleStage = 'at-risk';
        } else if (sortedSales.length > settings.ACTIVE_CLIENT_MIN_ORDERS && 
                   daysSinceLastPurchase < averageDaysBetweenPurchases * settings.ACTIVE_CLIENT_MULTIPLIER) {
            // Много заказов и последняя покупка недавно - активный клиент
            lifecycleStage = 'active';
        } else if (sortedSales.length > settings.GROWING_CLIENT_MIN_ORDERS && 
                   daysSinceLastPurchase < averageDaysBetweenPurchases * settings.GROWING_CLIENT_MULTIPLIER) {
            // Среднее количество заказов и последняя покупка недавно - развивается
            lifecycleStage = 'growing';
        } else if (daysSinceLastPurchase > averageDaysBetweenPurchases * settings.GROWING_CLIENT_MULTIPLIER) {
            // Последняя покупка была давно - риск
            lifecycleStage = 'at-risk';
        } else {
            // По умолчанию - новый клиент
            lifecycleStage = 'new';
        }
        
        // Анализируем сезонность
        const seasonalPattern = this.analyzeSeasonality(sortedSales);
        
        // Анализируем предпочтения по товарам
        const productPreferences = this.analyzeProductPreferences(sortedSales);
        
        return {
            clientCode,
            firstPurchase,
            lastPurchase,
            totalPurchases: sortedSales.length,
            totalRevenue,
            averageOrderValue,
            purchaseFrequency,
            lifecycleStage,
            seasonalPattern,
            productPreferences,
            daysSinceFirstPurchase
        };
    }
    
    /**
     * Анализ сезонности покупок клиента
     */
    static analyzeSeasonality(sales) {
        const monthlyData = new Array(12).fill(0);
        const monthlyCount = new Array(12).fill(0);
        
        sales.forEach(sale => {
            const month = new Date(sale['Дата']).getMonth();
            monthlyData[month] += parseFloat(sale['Выручка']) || 0;
            monthlyCount[month]++;
        });
        
        // Вычисляем средние значения для месяцев с продажами
        const seasonalPattern = monthlyData.map((revenue, month) => {
            const count = monthlyCount[month];
            return count > 0 ? revenue / count : 0;
        });
        
        return seasonalPattern;
    }
    
    /**
     * Анализ предпочтений по товарам
     */
    static analyzeProductPreferences(sales) {
        const productStats = {};
        
        sales.forEach(sale => {
            const product = sale['Номенклатура'];
            if (!productStats[product]) {
                productStats[product] = {
                    count: 0,
                    revenue: 0,
                    lastPurchase: null
                };
            }
            
            productStats[product].count++;
            productStats[product].revenue += parseFloat(sale['Выручка']) || 0;
            productStats[product].lastPurchase = new Date(sale['Дата']);
        });
        
        // Сортируем по выручке
        return Object.entries(productStats)
            .sort(([,a], [,b]) => b.revenue - a.revenue)
            .reduce((acc, [product, stats]) => {
                acc[product] = stats;
                return acc;
            }, {});
    }
    
    /**
     * Прогнозирование по клиенту с учетом жизненного цикла
     * @param {Array} salesData - данные продаж
     * @param {string} clientCode - код клиента
     * @param {number} periods - количество периодов
     * @param {Object} settings - настройки жизненного цикла (опционально)
     */
    static forecastClientRevenue(salesData, clientCode, periods = 12, settings = LIFECYCLE_SETTINGS) {
        const lifecycle = this.analyzeClientLifecycle(salesData, clientCode, settings);
        
        if (lifecycle.totalPurchases === 0) {
            return {
                clientCode,
                forecast: new Array(periods).fill(0),
                confidence: 0,
                lifecycleStage: 'new',
                recommendations: ['Клиент новый, нужна активная работа с ним']
            };
        }
        
        // Получаем исторические данные по месяцам
        const clientSales = salesData.filter(sale => sale['Клиент.Код'] === clientCode);
        const monthlyData = this.groupSalesByMonth(clientSales);
        
        // Применяем разные алгоритмы в зависимости от стадии жизненного цикла
        let forecast;
        let confidence;
        
        switch (lifecycle.lifecycleStage) {
            case 'new':
                // Для новых клиентов используем простой тренд
                forecast = ForecastingAlgorithms.trendAnalysis(monthlyData, periods);
                confidence = settings.MIN_CONFIDENCE_NEW;
                break;
                
            case 'growing':
                // Для растущих клиентов учитываем рост
                const combinedForecast = ForecastingAlgorithms.combinedForecast(monthlyData, periods);
                forecast = combinedForecast.combined;
                confidence = settings.MIN_CONFIDENCE_GROWING;
                break;
                
            case 'active':
                // Для активных клиентов учитываем сезонность
                const seasonalForecast = ForecastingAlgorithms.seasonalDecomposition(monthlyData, 12, periods);
                forecast = seasonalForecast.forecast;
                confidence = settings.MIN_CONFIDENCE_ACTIVE;
                break;
                
            case 'at-risk':
                // Для клиентов в группе риска снижаем прогноз
                forecast = ForecastingAlgorithms.trendAnalysis(monthlyData, periods);
                forecast = forecast.map(value => value * settings.FORECAST_REDUCTION_FOR_AT_RISK);
                confidence = settings.MIN_CONFIDENCE_AT_RISK;
                break;
                
            default:
                const defaultCombinedForecast = ForecastingAlgorithms.combinedForecast(monthlyData, periods);
                forecast = defaultCombinedForecast.combined;
                confidence = 0.5;
        }
        
        // Применяем сезонные коэффициенты
        const seasonalAdjustedForecast = this.applySeasonalAdjustment(forecast, lifecycle.seasonalPattern);
        
        return {
            clientCode,
            forecast: seasonalAdjustedForecast,
            confidence,
            lifecycleStage: lifecycle.lifecycleStage,
            averageOrderValue: lifecycle.averageOrderValue,
            purchaseFrequency: lifecycle.purchaseFrequency,
            recommendations: this.generateRecommendations(lifecycle)
        };
    }
    
    /**
     * Группировка продаж по месяцам з урахуванням року
     */
    static groupSalesByMonth(sales) {
        const groupedByYearMonth = {};
        sales.forEach(sale => {
            const date = new Date(sale['Дата']);
            if (isNaN(date)) return;
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groupedByYearMonth[yearMonth]) groupedByYearMonth[yearMonth] = 0;
            groupedByYearMonth[yearMonth] += parseFloat(sale['Выручка']) || 0;
        });
        
        const sortedKeys = Object.keys(groupedByYearMonth).sort();
        if (sortedKeys.length === 0) return [];

        const timeSeries = [];
        const startDate = new Date(sortedKeys[0]);
        const endDate = new Date(sortedKeys[sortedKeys.length - 1]);
        let currentDate = new Date(startDate);
        while(currentDate <= endDate) {
            const periodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            timeSeries.push(groupedByYearMonth[periodKey] || 0);
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        return timeSeries;
    }

    
    /**
     * Применение сезонных корректировок
     */
    static applySeasonalAdjustment(forecast, seasonalPattern) {
        // Перевіряємо, чи forecast є масивом
        if (!Array.isArray(forecast)) {
            console.error('❌ forecast не є масивом:', forecast);
            return new Array(12).fill(0);
        }
        
        if (seasonalPattern.length === 0) return forecast;
        
        const maxSeasonalValue = Math.max(...seasonalPattern);
        const seasonalCoefficients = seasonalPattern.map(value => 
            maxSeasonalValue > 0 ? value / maxSeasonalValue : 1
        );
        
        return forecast.map((value, index) => {
            const seasonalIndex = index % 12;
            return value * seasonalCoefficients[seasonalIndex];
        });
    }
    
    /**
     * Генерация рекомендаций для клиента
     */
    static generateRecommendations(lifecycle) {
        const recommendations = [];
        
        if (lifecycle.lifecycleStage === 'new') {
            recommendations.push('Активно работать с клиентом, предлагать новые товары');
            recommendations.push('Установить регулярный контакт');
        } else if (lifecycle.lifecycleStage === 'growing') {
            recommendations.push('Расширять ассортимент для клиента');
            recommendations.push('Предлагать премиум товары');
        } else if (lifecycle.lifecycleStage === 'active') {
            recommendations.push('Поддерживать текущий уровень обслуживания');
            recommendations.push('Предлагать дополнительные услуги');
        } else if (lifecycle.lifecycleStage === 'at-risk') {
            recommendations.push('Выяснить причины снижения активности');
            recommendations.push('Предложить специальные условия');
        }
        
        if (lifecycle.purchaseFrequency < 1) {
            recommendations.push('Увеличить частоту контактов');
        }
        
        return recommendations;
    }
    
    /**
     * Агрегация продаж по клиентам и датам
     * Объединяет продажи одного клиента в одну дату
     */
    static aggregateClientSalesByDate(salesData) {
        const aggregatedSales = {};
        
        salesData.forEach(sale => {
            const clientCode = sale['Клиент.Код'];
            const date = sale['Дата'];
            const key = `${clientCode}_${date}`;
            
            if (!aggregatedSales[key]) {
                aggregatedSales[key] = {
                    'Клиент.Код': clientCode,
                    'Дата': date,
                    'Выручка': 0,
                    'Номенклатура': [],
                    'Основной менеджер': sale['Основной менеджер'] || sale['Менеджер'],
                    'Количество': 0
                };
            }
            
            const revenue = parseFloat(sale['Выручка']) || 0;
            aggregatedSales[key]['Выручка'] += revenue;
            aggregatedSales[key]['Количество'] += parseInt(sale['Количество']) || 1;
            
            if (!aggregatedSales[key]['Номенклатура'].includes(sale['Номенклатура'])) {
                aggregatedSales[key]['Номенклатура'].push(sale['Номенклатура']);
            }
        });
        
        return Object.values(aggregatedSales);
    }
    
    /**
     * Прогнозирование по всем клиентам с учетом жизненного цикла
     * @param {Array} salesData - данные продаж
     * @param {number} periods - количество периодов
     * @param {Object} settings - настройки жизненного цикла (опционально)
     */
    static forecastAllClients(salesData, periods = 12, settings = LIFECYCLE_SETTINGS) {
        // Агрегируем продажи по клиентам и датам
        const aggregatedData = this.aggregateClientSalesByDate(salesData);
        
        // Получаем уникальных клиентов
        const uniqueClients = [...new Set(aggregatedData.map(sale => sale['Клиент.Код']))];
        
        const clientForecasts = {};
        let totalForecast = 0;
        
        uniqueClients.forEach(clientCode => {
            const forecast = this.forecastClientRevenue(aggregatedData, clientCode, periods, settings);
            clientForecasts[clientCode] = forecast;
            totalForecast += forecast.forecast.reduce((sum, value) => sum + value, 0);
        });
        
        return {
            clientForecasts,
            totalForecast,
            clientCount: uniqueClients.length,
            averageForecastPerClient: totalForecast / uniqueClients.length
        };
    }
}

// Экспорт для использования в основном модуле
export { ForecastingAlgorithms as Algorithms, SalesDataProcessor as DataProcessor }; 