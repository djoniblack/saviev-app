// dataService.js - Централизованный сервис данных для Focus 2.0
import * as firebase from '../../firebase.js';

// Кэш для хранения данных
const cache = new Map();
const cacheTimestamps = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

// API endpoints
const API_ENDPOINTS = {
  sales: 'https://fastapi.lookfort.com/nomenclature.analysis',
  clientLinks: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url',
  nomenclature: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=nomenclature_category',
  deals: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=dela',
  calls: 'https://fastapi.lookfort.com/nomenclature.analysis?mode=calls'
};

/**
 * Проверка актуальности кэша
 */
function isCacheValid(key) {
  const timestamp = cacheTimestamps.get(key);
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_DURATION;
}

/**
 * Fetch с таймаутом
 */
async function fetchWithTimeout(resource, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(id);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Универсальная функция загрузки данных с кэшированием
 */
async function fetchData(key, endpoint, options = {}) {
  // Проверяем кэш
  if (cache.has(key) && isCacheValid(key)) {
    console.log(`📋 Використовую кеш для ${key}`);
    return cache.get(key);
  }

  try {
    console.log(`📥 Завантаження ${key}...`);
    const response = await fetchWithTimeout(endpoint, options);
    const data = await response.json();
    
    // Сохраняем в кэш
    cache.set(key, data);
    cacheTimestamps.set(key, Date.now());
    
    console.log(`✅ ${key} завантажено:`, Array.isArray(data) ? data.length : 'object');
    return data;
  } catch (error) {
    console.error(`❌ Помилка завантаження ${key}:`, error);
    
    // Возвращаем кэшированные данные если есть, даже если они устарели
    if (cache.has(key)) {
      console.warn(`⚠️ Використовую застарілий кеш для ${key}`);
      return cache.get(key);
    }
    
    // Возвращаем пустые данные при ошибке
    return Array.isArray(cache.get(key)) ? [] : {};
  }
}

/**
 * Загрузка данных о продажах
 */
export async function getSalesData() {
  return fetchData('sales', API_ENDPOINTS.sales);
}

/**
 * Загрузка ссылок на клиентов
 */
export async function getClientLinks() {
  return fetchData('clientLinks', API_ENDPOINTS.clientLinks);
}

/**
 * Загрузка номенклатуры
 */
export async function getNomenclatureData() {
  return fetchData('nomenclature', API_ENDPOINTS.nomenclature);
}

/**
 * Загрузка сделок
 */
export async function getDealsData() {
  return fetchData('deals', API_ENDPOINTS.deals);
}

/**
 * Загрузка звонков
 */
export async function getCallsData() {
  return fetchData('calls', API_ENDPOINTS.calls);
}

/**
 * Загрузка справочника клиент-менеджер
 */
export async function getClientManagerDirectory() {
  const clientLinks = await getClientLinks();
  const directory = {};
  
  // Преобразуем данные в формат справочника
  Object.keys(clientLinks).forEach(clientCode => {
    directory[clientCode] = {
      link: clientLinks[clientCode],
      // Здесь можно добавить дополнительную логику для извлечения менеджера и отдела
      manager: 'Без менеджера',
      department: 'Без відділу'
    };
  });
  
  return directory;
}

/**
 * Загрузка данных из Firebase
 */
export async function getFirebaseData(collectionPath, options = {}) {
  const cacheKey = `firebase_${collectionPath.join('_')}`;
  
  // Проверяем кэш
  if (cache.has(cacheKey) && isCacheValid(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    console.log(`📥 Завантаження Firebase даних: ${collectionPath.join('/')}`);
    
    const ref = firebase.collection(firebase.db, ...collectionPath);
    const snapshot = await firebase.getDocs(ref);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Сохраняем в кэш
    cache.set(cacheKey, data);
    cacheTimestamps.set(cacheKey, Date.now());
    
    console.log(`✅ Firebase дані завантажено: ${data.length} записів`);
    return data;
  } catch (error) {
    console.error(`❌ Помилка завантаження Firebase даних:`, error);
    
    // Возвращаем кэшированные данные если есть
    if (cache.has(cacheKey)) {
      console.warn(`⚠️ Використовую застарілий кеш для Firebase даних`);
      return cache.get(cacheKey);
    }
    
    return [];
  }
}

/**
 * Загрузка отделов из Firebase
 */
export async function getDepartments(companyId) {
  if (!companyId) return [];
  return getFirebaseData(['companies', companyId, 'departments']);
}

/**
 * Загрузка сотрудников из Firebase
 */
export async function getEmployees(companyId) {
  if (!companyId) return [];
  return getFirebaseData(['companies', companyId, 'employees']);
}

/**
 * Загрузка задач из Firebase
 */
export async function getFocusTasks(companyId) {
  if (!companyId) return [];
  return getFirebaseData(['companies', companyId, 'focusTasks2']);
}

/**
 * Загрузка заметок для задачи
 */
export async function getTaskNotes(companyId, taskId) {
  if (!companyId || !taskId) return {};
  
  try {
    const notesRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2', taskId, 'notes');
    const snapshot = await firebase.getDocs(notesRef);
    const notes = {};
    snapshot.docs.forEach(doc => { 
      notes[doc.id] = doc.data(); 
    });
    
    return notes;
  } catch (error) {
    console.error('❌ Помилка завантаження заметок:', error);
    return {};
  }
}

/**
 * Сохранение заметки
 */
export async function saveTaskNote(companyId, taskId, clientCode, note) {
  if (!companyId || !taskId || !clientCode) {
    throw new Error('Некорректные данные для сохранения заметки');
  }
  
  try {
    // Очищаем некорректные поля
    Object.keys(note).forEach(k => {
      if (note[k] === undefined || note[k] === null || (typeof note[k] === 'number' && isNaN(note[k]))) {
        delete note[k];
      }
    });
    
    const noteRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks2', taskId, 'notes', clientCode);
    await firebase.setDoc(noteRef, note, { merge: true });
    
    console.log('✅ Заметка збережена:', { taskId, clientCode, note });
    return true;
  } catch (error) {
    console.error('❌ Помилка збереження заметки:', error);
    throw error;
  }
}

/**
 * Очистка кэша
 */
export function clearCache(key = null) {
  if (key) {
    cache.delete(key);
    cacheTimestamps.delete(key);
    console.log(`🗑️ Кеш очищено для ${key}`);
  } else {
    cache.clear();
    cacheTimestamps.clear();
    console.log('🗑️ Весь кеш очищено');
  }
}

/**
 * Получение статистики кэша
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    timestamps: Object.fromEntries(cacheTimestamps)
  };
}

/**
 * Предзагрузка всех основных данных
 */
export async function preloadAllData() {
  console.log('🚀 Початок попереднього завантаження даних...');
  
  const promises = [
    getSalesData(),
    getClientLinks(),
    getNomenclatureData(),
    getDealsData(),
    getCallsData()
  ];
  
  try {
    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Попереднє завантаження завершено: ${successCount}/${promises.length} успішно`);
  } catch (error) {
    console.error('❌ Помилка попереднього завантаження:', error);
  }
} 