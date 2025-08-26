// Конструктор задач для Фокус 2.0
import * as firebase from '../../firebase.js';
import { hasPermission } from '../../main.js';
import { FocusClientAnalyzer } from './clientAnalyzer.js';

// Функция для обновления данных задач
async function refreshFocus2Data() {
  try {
    const companyId = window.state?.currentCompanyId;
    if (companyId) {
      const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2');
      const snapshot = await firebase.getDocs(tasksRef);
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Обновляем глобальные данные
      if (window.focus2Data) {
        window.focus2Data.tasks = tasks;
      }
      
      console.log('✅ Дані задач оновлено:', tasks.length);
      return tasks;
    }
  } catch (error) {
    console.error('❌ Помилка оновлення даних задач:', error);
  }
  return [];
}

export class FocusTaskConstructor {
  constructor() {
    this.currentTask = null;
    this.nomenclatureSelector = null;
  }
  
  /**
   * Инициализация конструктора
   */
  async init(nomenclatureSelector) {
    this.nomenclatureSelector = nomenclatureSelector;
    console.log('🔧 Конструктор задач Фокус 2.0 ініціалізовано');
    console.log('📋 Отриманий селектор номенклатури:', this.nomenclatureSelector);
  }
  
  /**
   * Показ модального окна создания задачи
   */
  showCreateModal() {
    if (!hasPermission('focus_create')) {
      alert('У вас немає прав для створення фокусних задач!');
      return;
    }
    
    const modalHTML = `
      <div id="focus2-create-task-modal" class="fixed inset-0 bg-black bg-opacity-50 z-[70]">
        <div class="flex items-center justify-center min-h-screen p-4">
          <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            <!-- Заголовок -->
            <div class="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 class="text-xl font-semibold text-white">Створення фокусної задачі 2.0</h3>
              <button id="close-focus2-create-modal" class="text-gray-400 hover:text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <!-- Форма создания задачи -->
            <div class="flex-1 overflow-y-auto p-6">
              <form id="focus2-task-form" class="space-y-6">
                <!-- Основная информация -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Назва задачі *</label>
                    <input type="text" id="focus2TaskTitle" class="w-full bg-gray-700 border border-gray-600 rounded-md text-white p-3" 
                           required maxlength="100" placeholder="Введіть назву задачі">
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Період дії задачі</label>
                    <div class="grid grid-cols-2 gap-2">
                      <input type="date" id="focus2TaskPeriodFrom" class="bg-gray-700 border border-gray-600 rounded-md text-white p-3">
                      <input type="date" id="focus2TaskPeriodTo" class="bg-gray-700 border border-gray-600 rounded-md text-white p-3">
                    </div>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Опис задачі</label>
                  <textarea id="focus2TaskDescription" rows="3" 
                           class="w-full bg-gray-700 border border-gray-600 rounded-md text-white p-3"
                           placeholder="Опишіть мету та деталі задачі"></textarea>
                </div>
                
                <!-- Номенклатура -->
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Фокусна номенклатура</label>
                  <div class="flex items-center space-x-2">
                    <button type="button" id="focus2SelectNomenclature" 
                            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
                      Обрати номенклатуру
                    </button>
                    <span id="focus2SelectedNomenclatureCount" class="text-gray-400">0 позицій обрано</span>
                  </div>
                  <div id="focus2NomenclatureList" class="mt-2 p-3 bg-gray-700 rounded-md min-h-[60px]">
                    <span class="text-gray-400">Номенклатура не обрана</span>
                  </div>
                </div>
                
                <!-- Параметры анализа -->
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Параметри аналізу</label>
                  <div class="space-y-3">
                    <!-- Param1: Клиенты, которые покупали раньше, но не сейчас -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="focus2Param1" class="mt-1">
                      <div class="flex-1">
                        <label for="focus2Param1" class="text-white font-medium">Клієнти, які купували раніше, але не зараз</label>
                        <p class="text-gray-400 text-sm">Клієнти, які купували фокусні товари в попередньому періоді, але не купують в поточному</p>
                        <div id="focus2Param1Options" class="mt-2 hidden">
                          <select id="focus2Param1Period" class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm">
                            <option value="month">Порівняння з попереднім місяцем</option>
                            <option value="quarter">Порівняння з попереднім кварталом</option>
                            <option value="custom">Кастомний період</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param2: Клиенты, которые не покупали определенное количество дней -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="focus2Param2" class="mt-1">
                      <div class="flex-1">
                        <label for="focus2Param2" class="text-white font-medium">Клієнти, які не купували певну кількість днів</label>
                        <p class="text-gray-400 text-sm">Клієнти, які не робили покупок фокусних товарів протягом вказаного періоду</p>
                        <div id="focus2Param2Options" class="mt-2 hidden">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="focus2Param2Days" min="1" max="365" value="30" 
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-20">
                            <span class="text-gray-400 text-sm">днів</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param3: Клиенты с низкой частотой покупок -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="focus2Param3" class="mt-1">
                      <div class="flex-1">
                        <label for="focus2Param3" class="text-white font-medium">Клієнти з низькою частотою покупок</label>
                        <p class="text-gray-400 text-sm">Клієнти, які рідко купують фокусні товари</p>
                        <div id="focus2Param3Options" class="mt-2 hidden">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="focus2Param3Frequency" min="1" max="12" value="1" 
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-20">
                            <span class="text-gray-400 text-sm">покупок за місяць</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param4: Клиенты с низькою сумою покупок -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="focus2Param4" class="mt-1">
                      <div class="flex-1">
                        <label for="focus2Param4" class="text-white font-medium">Клієнти з низькою сумою покупок</label>
                        <p class="text-gray-400 text-sm">Клієнти, які купують на невеликі суми</p>
                        <div id="focus2Param4Options" class="mt-2 hidden">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="focus2Param4Amount" min="1" value="1000" 
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-32">
                            <span class="text-gray-400 text-sm">₴ за місяць</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param5: Клиенты из определенных сегментов -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="focus2Param5" class="mt-1">
                      <div class="flex-1">
                        <label for="focus2Param5" class="text-white font-medium">Клієнти з певних сегментів</label>
                        <p class="text-gray-400 text-sm">Клієнти, які належать до вказаних сегментів</p>
                        <div id="focus2Param5Options" class="mt-2 hidden">
                          <div class="space-y-2">
                            <label class="flex items-center">
                              <input type="checkbox" id="focus2Param5VIP" class="mr-2">
                              <span class="text-white text-sm">VIP клієнти</span>
                            </label>
                            <label class="flex items-center">
                              <input type="checkbox" id="focus2Param5Regular" class="mr-2">
                              <span class="text-white text-sm">Звичайні клієнти</span>
                            </label>
                            <label class="flex items-center">
                              <input type="checkbox" id="focus2Param5New" class="mr-2">
                              <span class="text-white text-sm">Нові клієнти</span>
                            </label>
                            <label class="flex items-center">
                              <input type="checkbox" id="focus2Param5Inactive" class="mr-2">
                              <span class="text-white text-sm">Неактивні клієнти</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param6: Похожі клієнти, які ніколи не купували -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="focus2Param6" class="mt-1">
                      <div class="flex-1">
                        <label for="focus2Param6" class="text-white font-medium">Похожі клієнти, які ніколи не купували</label>
                        <p class="text-gray-400 text-sm">Клієнти з схожою сферою діяльності, які ніколи не купували фокусні товари</p>
                        <div id="focus2Param6Options" class="mt-2 hidden">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="focus2Param6Similarity" min="1" max="100" value="80"
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-32">
                            <span class="text-gray-400 text-sm">% схожості</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param7: Клієнти, які беруть X, але не беруть товари з фокуса -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="focus2Param7" class="mt-1">
                      <div class="flex-1">
                        <label for="focus2Param7" class="text-white font-medium">Клієнти, які беруть X, але не беруть товари з фокуса</label>
                        <p class="text-gray-400 text-sm">Клієнти, які купують вказані товари, але не купують фокусні</p>
                        <div id="focus2Param7Options" class="mt-2 hidden">
                          <div class="space-y-2">
                            <button type="button" id="focus2SelectParam7Products" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm">
                              Обрати номенклатуру X
                            </button>
                            <div id="focus2Param7ProductsDisplay" class="bg-gray-800 rounded p-3 min-h-[60px] text-sm text-gray-300">
                              Номенклатура X не обрана
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <!-- Футер -->
            <div class="p-6 border-t border-gray-700 flex items-center justify-between">
              <button id="cancel-focus2-create-task" class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">
                Скасувати
              </button>
              <button id="save-focus2-create-task" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
                Створити задачу
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Добавляем модальное окно к body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Настраиваем обработчики событий
    this.setupCreateModalEventListeners();
    
    console.log('✅ Модальне вікно створення задачі відкрито');
  }
  
  /**
   * Настройка обработчиков событий для модального окна создания
   */
  setupCreateModalEventListeners() {
    // Кнопка закрытия
    const closeBtn = document.getElementById('close-focus2-create-modal');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeCreateModal();
    }
    
    // Кнопка отмены
    const cancelBtn = document.getElementById('cancel-focus2-create-task');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.closeCreateModal();
    }
    
    // Кнопка сохранения
    const saveBtn = document.getElementById('save-focus2-create-task');
    if (saveBtn) {
      saveBtn.onclick = () => this.saveTask();
    }
    
    // Кнопка выбора номенклатуры
    const nomenclatureBtn = document.getElementById('focus2SelectNomenclature');
    if (nomenclatureBtn) {
      nomenclatureBtn.onclick = () => {
        console.log('🔄 Клік по кнопці вибору номенклатури');
        console.log('📋 this.nomenclatureSelector:', this.nomenclatureSelector);
        if (this.nomenclatureSelector && typeof this.nomenclatureSelector.openSelector === 'function') {
          console.log('✅ Селектор номенклатури готовий для використання');
          this.nomenclatureSelector.openSelector(
            this.getSelectedNomenclature(),
            'include',
            (selectedItems) => {
              console.log('✅ Номенклатура обрана:', selectedItems);
              this.setSelectedNomenclature(selectedItems);
              this.updateNomenclatureDisplay();
            }
          );
        } else {
          console.error('❌ Селектор номенклатури не ініціалізовано');
          console.log('📋 Тип nomenclatureSelector:', typeof this.nomenclatureSelector);
          console.log('📋 Методи nomenclatureSelector:', this.nomenclatureSelector ? Object.keys(this.nomenclatureSelector) : 'null');
          alert('Помилка: селектор номенклатури не готовий. Спробуйте перезавантажити сторінку.');
        }
      };
    }
    
    // Форма
    const form = document.getElementById('focus2-task-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.saveTask();
      };
    }
    
    // Параметры
    this.setupParameterEventListeners();
    
    // Селекторы номенклатуры
    this.setupNomenclatureSelectors();
  }
  
  /**
   * Настройка обработчиков для параметров
   */
  setupParameterEventListeners() {
    // Param1
    const param1 = document.getElementById('focus2Param1');
    if (param1) {
      param1.addEventListener('change', (e) => {
        const options = document.getElementById('focus2Param1Options');
        if (options) {
          options.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
    
    // Param2
    const param2 = document.getElementById('focus2Param2');
    if (param2) {
      param2.addEventListener('change', (e) => {
        const options = document.getElementById('focus2Param2Options');
        if (options) {
          options.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
    
    // Param3
    const param3 = document.getElementById('focus2Param3');
    if (param3) {
      param3.addEventListener('change', (e) => {
        const options = document.getElementById('focus2Param3Options');
        if (options) {
          options.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
    
    // Param4
    const param4 = document.getElementById('focus2Param4');
    if (param4) {
      param4.addEventListener('change', (e) => {
        const options = document.getElementById('focus2Param4Options');
        if (options) {
          options.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
    
    // Param5
    const param5 = document.getElementById('focus2Param5');
    if (param5) {
      param5.addEventListener('change', (e) => {
        const options = document.getElementById('focus2Param5Options');
        if (options) {
          options.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
    
    // Param6
    const param6 = document.getElementById('focus2Param6');
    if (param6) {
      param6.addEventListener('change', (e) => {
        const options = document.getElementById('focus2Param6Options');
        if (options) {
          options.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
    
    // Param7
    const param7 = document.getElementById('focus2Param7');
    if (param7) {
      param7.addEventListener('change', (e) => {
        const options = document.getElementById('focus2Param7Options');
        if (options) {
          options.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
  }
  
  /**
   * Настройка селекторов номенклатуры
   */
  setupNomenclatureSelectors() {
    // Основной селектор номенклатуры
    const mainSelector = document.getElementById('focus2SelectNomenclature');
    if (mainSelector) {
      mainSelector.addEventListener('click', () => {
        console.log('🔄 Клік по основній кнопці вибору номенклатури');
        if (this.nomenclatureSelector) {
          this.nomenclatureSelector.openSelector(
            this.getSelectedNomenclature(),
            'include',
            (selectedItems, filterType) => {
              this.setSelectedNomenclature(selectedItems);
              this.updateNomenclatureDisplay();
            }
          );
        }
      });
    } else {
      console.error('❌ Кнопка focus2SelectNomenclature не знайдена');
    }
    

    
    // Селектор товаров для Param7
    const param7Selector = document.getElementById('focus2SelectParam7Products');
    if (param7Selector) {
      param7Selector.addEventListener('click', () => {
        console.log('🔄 Клік по кнопці вибору номенклатури X для параметра 7');
        console.log('📋 this.nomenclatureSelector:', this.nomenclatureSelector);
        
        if (this.nomenclatureSelector && typeof this.nomenclatureSelector.openSelector === 'function') {
          console.log('✅ Селектор номенклатури готовий для параметра 7');
          this.nomenclatureSelector.openSelector(
            this.getSelectedParam7Products(),
            'include',
            (selectedItems, filterType) => {
              console.log('✅ Номенклатура X обрана для параметра 7:', selectedItems);
              this.setSelectedParam7Products(selectedItems);
              this.updateParam7ProductsDisplay();
            }
          );
        } else {
          console.error('❌ Селектор номенклатури не ініціалізовано для параметра 7');
          alert('Помилка: селектор номенклатури не готовий. Спробуйте перезавантажити сторінку.');
        }
      });
    } else {
      console.error('❌ Кнопка focus2SelectParam7Products не знайдена');
    }
  }
  
  /**
   * Закрытие модального окна создания
   */
  closeCreateModal() {
    const modal = document.getElementById('focus2-create-task-modal');
    if (modal) {
      modal.remove();
    }
  }
  
  /**
   * Сохранение задачи
   */
  async saveTask() {
    try {
      // Собираем данные формы
      const taskData = this.collectTaskData();
      
      // Валидация
      if (!this.validateTaskData(taskData)) {
        return;
      }
      
      // Показываем прогресс
      this.showSaveProgress();
      
      // Создаем задачу в Firebase
      const taskId = await this.createTaskInFirebase(taskData);
      
      // Закрываем модальное окно
      this.closeCreateModal();
      
      // Показываем уведомление об успехе
      this.showSuccessNotification(taskId);
      
      // Обновляем список задач
      await this.refreshTasksList();
      
    } catch (error) {
      console.error('❌ Помилка створення задачі:', error);
      this.showErrorNotification(error.message);
    }
  }
  
  /**
   * Сбор данных формы
   */
  collectTaskData() {
    return {
      title: document.getElementById('focus2TaskTitle')?.value?.trim() || '',
      description: document.getElementById('focus2TaskDescription')?.value?.trim() || '',
      periodFrom: document.getElementById('focus2TaskPeriodFrom')?.value || '',
      periodTo: document.getElementById('focus2TaskPeriodTo')?.value || '',
      products: this.getSelectedNomenclature(),
      parameters: {
        param1: {
          enabled: document.getElementById('focus2Param1')?.checked || false,
          period: document.getElementById('focus2Param1Period')?.value || 'month'
        },
        param2: {
          enabled: document.getElementById('focus2Param2')?.checked || false,
          days: parseInt(document.getElementById('focus2Param2Days')?.value || '30')
        },
        param3: {
          enabled: document.getElementById('focus2Param3')?.checked || false,
          frequency: parseInt(document.getElementById('focus2Param3Frequency')?.value || '1')
        },
        param4: {
          enabled: document.getElementById('focus2Param4')?.checked || false,
          amount: parseInt(document.getElementById('focus2Param4Amount')?.value || '1000')
        },
        param5: {
          enabled: document.getElementById('focus2Param5')?.checked || false,
          segments: {
            vip: document.getElementById('focus2Param5VIP')?.checked || false,
            regular: document.getElementById('focus2Param5Regular')?.checked || false,
            new: document.getElementById('focus2Param5New')?.checked || false,
            inactive: document.getElementById('focus2Param5Inactive')?.checked || false
          }
        },
        param6: {
          enabled: document.getElementById('focus2Param6')?.checked || false,
          similarity: parseInt(document.getElementById('focus2Param6Similarity')?.value || '80')
        },
        param7: {
          enabled: document.getElementById('focus2Param7')?.checked || false,
          products: this.getSelectedParam7Products()
        }
      },
      createdAt: new Date().toISOString(),
      createdBy: window.state?.currentUserId,
      status: 'active'
    };
  }
  
  /**
   * Валидация данных задачи
   */
  validateTaskData(taskData) {
    if (!taskData.title) {
      alert('Введіть назву задачі!');
      return false;
    }
    
    if (taskData.products.length === 0) {
      alert('Оберіть хоча б один товар для фокусу!');
      return false;
    }
    
    // Проверяем, что хотя бы один параметр включен
    const hasEnabledParams = Object.values(taskData.parameters).some(param => param.enabled);
    if (!hasEnabledParams) {
      alert('Оберіть хоча б один параметр аналізу!');
      return false;
    }
    
    return true;
  }
  
  /**
   * Создание задачи в Firebase
   */
  async createTaskInFirebase(taskData) {
    const companyId = window.state?.currentCompanyId;
    if (!companyId) {
      throw new Error('Компанія не вибрана!');
    }
    
    // Генерируем clientsSnapshot если есть доступ к данным
    let clientsSnapshot = [];
    let hasSnapshot = false;
    
    if (window.focus2Data?.salesData && window.focus2Data?.nomenclatureData && window.focus2Data?.clientManagerDirectory) {
      try {
        console.log('🔍 Генерація clientsSnapshot для нової задачі...');
        
        const clientAnalyzer = new FocusClientAnalyzer();
        await clientAnalyzer.init(
          window.focus2Data.salesData,
          window.focus2Data.nomenclatureData,
          window.focus2Data.clientManagerDirectory
        );
        
        clientsSnapshot = await clientAnalyzer.generateClientsSnapshot(taskData);
        hasSnapshot = clientsSnapshot.length > 0;
        console.log('✅ Згенеровано clientsSnapshot:', clientsSnapshot.length, 'клієнтів');
      } catch (error) {
        console.error('❌ Помилка генерації clientsSnapshot:', error);
        // Продолжаем создание задачи без clientsSnapshot
      }
    } else {
      console.warn('⚠️ Дані для аналізу клієнтів недоступні, створюємо задачу без clientsSnapshot');
    }
    
    // Создаем задачу без clientsSnapshot в основном документе
    const taskDataWithoutSnapshot = {
      ...taskData,
      hasClientsSnapshot: hasSnapshot,
      clientsSnapshotCount: clientsSnapshot.length
    };
    
    const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2');
    const docRef = await firebase.addDoc(tasksRef, taskDataWithoutSnapshot);
    
    // Если есть clientsSnapshot, сохраняем его в отдельной подколлекции
    if (hasSnapshot && clientsSnapshot.length > 0) {
      try {
        const snapshotRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2', docRef.id, 'clientsSnapshot');
        
        // Разбиваем clientsSnapshot на части, если он слишком большой
        const chunkSize = 1000; // Максимальное количество клиентов в одном документе
        const chunks = [];
        
        for (let i = 0; i < clientsSnapshot.length; i += chunkSize) {
          chunks.push(clientsSnapshot.slice(i, i + chunkSize));
        }
        
        // Сохраняем каждую часть как отдельный документ
        for (let i = 0; i < chunks.length; i++) {
          await firebase.addDoc(snapshotRef, {
            chunkIndex: i,
            totalChunks: chunks.length,
            clients: chunks[i],
            createdAt: new Date().toISOString()
          });
        }
        
        console.log('✅ clientsSnapshot збережено в окремій підколекції:', chunks.length, 'частин');
      } catch (error) {
        console.error('❌ Помилка збереження clientsSnapshot:', error);
        // Задача создана, но snapshot не сохранен
      }
    }
    
    console.log('✅ Задачу створено:', docRef.id);
    return docRef.id;
  }
  
  /**
   * Показ прогресса сохранения
   */
  showSaveProgress() {
    const saveBtn = document.getElementById('save-focus2-create-task');
    saveBtn.textContent = 'Створення...';
    saveBtn.disabled = true;
  }
  
  /**
   * Показ уведомления об успехе
   */
  showSuccessNotification(taskId) {
    // Здесь можно добавить красивое уведомление
    alert(`✅ Задачу успішно створено! ID: ${taskId}`);
  }
  
  /**
   * Показ уведомления об ошибке
   */
  showErrorNotification(message) {
    alert(`❌ Помилка: ${message}`);
  }
  
  /**
   * Обновление списка задач
   */
  async refreshTasksList() {
    try {
      console.log('🔄 Оновлення списку задач...');
      
      // Обновляем данные из Firebase
      await refreshFocus2Data();
      
      // Обновляем интерфейс
      const tasksContainer = document.getElementById('tasks-tab');
      if (tasksContainer && window.focus2Components?.ui) {
        await window.focus2Components.ui.loadTasksContent(tasksContainer);
      }
      
      // Обновляем статистику
      if (window.updateStatistics) {
        window.updateStatistics();
      }
      
      console.log('✅ Список задач оновлено');
    } catch (error) {
      console.error('❌ Помилка оновлення списку задач:', error);
    }
  }
  
  // Методы для работы с номенклатурой
  
  getSelectedNomenclature() {
    return window.focus2SelectedNomenclature || [];
  }
  
  setSelectedNomenclature(items) {
    window.focus2SelectedNomenclature = items;
  }
  

  
  getSelectedParam7Products() {
    return window.focus2SelectedParam7Products || [];
  }
  
  setSelectedParam7Products(items) {
    window.focus2SelectedParam7Products = items;
  }
  
  updateNomenclatureDisplay() {
    const container = document.getElementById('focus2NomenclatureList');
    const countElement = document.getElementById('focus2SelectedNomenclatureCount');
    const items = this.getSelectedNomenclature();
    
    if (countElement) {
      countElement.textContent = `${items.length} позицій обрано`;
    }
    
    if (container) {
      if (items.length === 0) {
        container.innerHTML = '<span class="text-gray-400">Номенклатура не обрана</span>';
      } else {
        container.innerHTML = this.renderSelectedNomenclature(items);
      }
    }
  }
  

  
  updateParam7ProductsDisplay() {
    const container = document.getElementById('focus2Param7ProductsDisplay');
    const items = this.getSelectedParam7Products();
    
    if (container) {
      if (items.length === 0) {
        container.innerHTML = '<span class="text-gray-400 text-sm">Номенклатура X не обрана</span>';
      } else if (items.length <= 5) {
        // Якщо позицій мало, показуємо всі
        container.innerHTML = items.map(code => 
          `<span class="inline-block bg-orange-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
            ${this.getNomenclatureName(code)}
          </span>`
        ).join('');
      } else {
        // Якщо позицій багато, показуємо перші 3 і кнопку
        container.innerHTML = `
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-orange-400 text-sm font-medium">Обрана номенклатура X (${items.length} позицій)</span>
              <button type="button" onclick="window.focus2Components?.taskConstructor?.toggleParam7Details()" 
                      class="text-orange-400 hover:text-orange-300 text-sm">
                Показати деталі
              </button>
            </div>
            <div id="param7Details" class="hidden space-y-2 max-h-40 overflow-y-auto">
              ${items.map(code => 
                `<span class="inline-block bg-orange-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
                  ${this.getNomenclatureName(code)}
                </span>`
              ).join('')}
            </div>
            <div id="param7Preview">
              ${items.slice(0, 3).map(code => 
                `<span class="inline-block bg-orange-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
                  ${this.getNomenclatureName(code)}
                </span>`
              ).join('')}
              <span class="inline-block bg-orange-500 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
                ... та ще ${items.length - 3} позицій
              </span>
            </div>
          </div>
        `;
      }
    }
  }
  
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
   * Рендеринг вибраної номенклатури
   */
  renderSelectedNomenclature(products) {
    if (!products || products.length === 0) {
      return '<span class="text-gray-400">Номенклатура не обрана</span>';
    }
    
    // Якщо позицій мало (менше 5), показуємо всі
    if (products.length <= 5) {
      return `
        <div class="space-y-2">
          ${products.map(code => `
            <span class="inline-block bg-blue-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
              ${this.getNomenclatureName(code)}
            </span>
          `).join('')}
        </div>
      `;
    }
    
    // Якщо позицій багато, показуємо перші 3 і кнопку "Показати деталі"
    return `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-white font-medium">Обрана номенклатура (${products.length} позицій)</span>
          <button type="button" onclick="window.focus2Components?.taskConstructor?.toggleNomenclatureDetails()" 
                  class="text-blue-400 hover:text-blue-300 text-sm">
            Показати деталі
          </button>
        </div>
        <div id="nomenclatureDetails" class="hidden space-y-2 max-h-40 overflow-y-auto">
          ${products.map(code => `
            <span class="inline-block bg-blue-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
              ${this.getNomenclatureName(code)}
            </span>
          `).join('')}
        </div>
        <div id="nomenclaturePreview" class="space-y-2">
          ${products.slice(0, 3).map(code => `
            <span class="inline-block bg-blue-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
              ${this.getNomenclatureName(code)}
            </span>
          `).join('')}
          <span class="inline-block bg-blue-500 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
            ... та ще ${products.length - 3} позицій
          </span>
        </div>
      </div>
    `;
  }
  
  /**
   * Переключение отображения деталей номенклатуры
   */
  toggleNomenclatureDetails() {
    const detailsElement = document.getElementById('nomenclatureDetails');
    const previewElement = document.getElementById('nomenclaturePreview');
    const button = document.querySelector('button[onclick*="toggleNomenclatureDetails"]');
    
    if (detailsElement && previewElement && button) {
      const isHidden = detailsElement.classList.contains('hidden');
      
      if (isHidden) {
        detailsElement.classList.remove('hidden');
        previewElement.classList.add('hidden');
        button.textContent = 'Сховати деталі';
      } else {
        detailsElement.classList.add('hidden');
        previewElement.classList.remove('hidden');
        button.textContent = 'Показати деталі';
      }
    }
  }
  
  /**
   * Переключение отображения деталей номенклатуры для Param7
   */
  toggleParam7Details() {
    const detailsElement = document.getElementById('param7Details');
    const previewElement = document.getElementById('param7Preview');
    const button = document.querySelector('button[onclick*="toggleParam7Details"]');
    
    if (detailsElement && previewElement && button) {
      const isHidden = detailsElement.classList.contains('hidden');
      
      if (isHidden) {
        detailsElement.classList.remove('hidden');
        previewElement.classList.add('hidden');
        button.textContent = 'Сховати деталі';
      } else {
        detailsElement.classList.add('hidden');
        previewElement.classList.remove('hidden');
        button.textContent = 'Показати деталі';
      }
    }
  }
  
  /**
   * Рендеринг вибраної номенклатури для Param7 (редагування)
   */
  renderSelectedParam7Nomenclature(products) {
    if (!products || products.length === 0) {
      return '<span class="text-gray-400">Номенклатура X не обрана</span>';
    }
    
    // Якщо позицій мало (менше 5), показуємо всі
    if (products.length <= 5) {
      return `
        <div class="space-y-2">
          ${products.map(code => `
            <span class="inline-block bg-orange-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
              ${this.getNomenclatureName(code)}
            </span>
          `).join('')}
        </div>
      `;
    }
    
    // Якщо позицій багато, показуємо перші 3 і кнопку "Показати деталі"
    return `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-white font-medium">Обрана номенклатура X (${products.length} позицій)</span>
          <button type="button" onclick="window.focus2Components?.taskConstructor?.toggleEditParam7Details()" 
                  class="text-blue-400 hover:text-blue-300 text-sm">
            Показати деталі
          </button>
        </div>
        <div id="editParam7Details" class="hidden space-y-2 max-h-40 overflow-y-auto">
          ${products.map(code => `
            <span class="inline-block bg-orange-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
              ${this.getNomenclatureName(code)}
            </span>
          `).join('')}
        </div>
        <div id="editParam7Preview" class="space-y-2">
          ${products.slice(0, 3).map(code => `
            <span class="inline-block bg-orange-600 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
              ${this.getNomenclatureName(code)}
            </span>
          `).join('')}
          <span class="inline-block bg-orange-500 text-white px-2 py-1 rounded text-sm mr-2 mb-2">
            ... та ще ${products.length - 3} позицій
          </span>
        </div>
      </div>
    `;
  }
  
  /**
   * Переключение отображения деталей номенклатуры для Param7 (редагування)
   */
  toggleEditParam7Details() {
    const detailsElement = document.getElementById('editParam7Details');
    const previewElement = document.getElementById('editParam7Preview');
    const button = document.querySelector('button[onclick*="toggleEditParam7Details"]');
    
    if (detailsElement && previewElement && button) {
      const isHidden = detailsElement.classList.contains('hidden');
      
      if (isHidden) {
        detailsElement.classList.remove('hidden');
        previewElement.classList.add('hidden');
        button.textContent = 'Сховати деталі';
      } else {
        detailsElement.classList.add('hidden');
        previewElement.classList.remove('hidden');
        button.textContent = 'Показати деталі';
      }
    }
  }
  
  /**
   * Загрузка clientsSnapshot из подколлекции
   */
  async loadClientsSnapshot(taskId) {
    const companyId = window.state?.currentCompanyId;
    if (!companyId) {
      throw new Error('Компанія не вибрана!');
    }
    
    try {
      const snapshotRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2', taskId, 'clientsSnapshot');
      const snapshot = await firebase.getDocs(snapshotRef);
      
      if (snapshot.empty) {
        console.log('⚠️ clientsSnapshot не знайдено для задачі:', taskId);
        return [];
      }
      
      // Собираем все части snapshot
      const chunks = [];
      snapshot.forEach(doc => {
        chunks.push({
          chunkIndex: doc.data().chunkIndex,
          clients: doc.data().clients
        });
      });
      
      // Сортируем по индексу и объединяем
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      const clientsSnapshot = chunks.flatMap(chunk => chunk.clients);
      
      console.log('✅ clientsSnapshot завантажено:', clientsSnapshot.length, 'клієнтів');
      return clientsSnapshot;
      
    } catch (error) {
      console.error('❌ Помилка завантаження clientsSnapshot:', error);
      return [];
    }
  }
  
  /**
   * Редактирование существующей задачи
   */
  async editTask(taskId) {
    try {
      console.log('✏️ Редагування задачі:', taskId);
      
      // Показываем предупреждение
      const confirmed = confirm('⚠️ Увага! Редагування задачі може вплинути на існуючі дані та аналіз. Продовжити?');
      if (!confirmed) {
        return;
      }
      
      // Находим задачу
      const tasks = window.focus2Data?.tasks || [];
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) {
        throw new Error('Задачу не знайдено');
      }
      
      // Показываем модальное окно редактирования
      this.showEditModal(task);
      
    } catch (error) {
      console.error('❌ Помилка редагування задачі:', error);
      alert('Помилка редагування задачі: ' + error.message);
    }
  }
  
  /**
   * Показ модального окна редактирования
   */
  showEditModal(task) {
    const modalHTML = `
      <div id="focus2-edit-task-modal" class="fixed inset-0 bg-black bg-opacity-50 z-[70]">
        <div class="flex items-center justify-center min-h-screen p-4">
          <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            <!-- Заголовок -->
            <div class="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 class="text-xl font-semibold text-white">Редагування фокусної задачі 2.0</h3>
              <button id="close-focus2-edit-modal" class="text-gray-400 hover:text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <!-- Форма редактирования задачи -->
            <div class="flex-1 overflow-y-auto p-6">
              <form id="focus2-edit-task-form" class="space-y-6">
                <!-- Основная информация -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Назва задачі *</label>
                    <input type="text" id="editFocus2TaskTitle" class="w-full bg-gray-700 border border-gray-600 rounded-md text-white p-3" 
                           required maxlength="100" placeholder="Введіть назву задачі" value="${task.title || ''}">
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Період дії задачі</label>
                    <div class="grid grid-cols-2 gap-2">
                      <input type="date" id="editFocus2TaskPeriodFrom" class="bg-gray-700 border border-gray-600 rounded-md text-white p-3" value="${task.periodFrom || ''}">
                      <input type="date" id="editFocus2TaskPeriodTo" class="bg-gray-700 border border-gray-600 rounded-md text-white p-3" value="${task.periodTo || ''}">
                    </div>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Опис задачі</label>
                  <textarea id="editFocus2TaskDescription" rows="3" 
                           class="w-full bg-gray-700 border border-gray-600 rounded-md text-white p-3"
                           placeholder="Опишіть мету та деталі задачі">${task.description || ''}</textarea>
                </div>
                
                <!-- Номенклатура -->
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Фокусна номенклатура</label>
                  <div class="flex items-center space-x-2">
                    <button type="button" id="editFocus2SelectNomenclature" 
                            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
                      Обрати номенклатуру
                    </button>
                    <span id="editFocus2SelectedNomenclatureCount" class="text-gray-400">${(task.products || []).length} позицій обрано</span>
                  </div>
                  <div id="editFocus2NomenclatureList" class="mt-2 p-3 bg-gray-700 rounded-md min-h-[60px]">
                    ${this.renderSelectedNomenclature(task.products || [])}
                  </div>
                </div>
                
                <!-- Параметры анализа -->
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Параметри аналізу</label>
                  <div class="space-y-3">
                    <!-- Param1: Клиенты, которые покупали раньше, но не сейчас -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="editFocus2Param1" class="mt-1" ${task.parameters?.param1?.enabled ? 'checked' : ''}>
                      <div class="flex-1">
                        <label for="editFocus2Param1" class="text-white font-medium">Клієнти, які купували раніше, але не зараз</label>
                        <p class="text-gray-400 text-sm">Клієнти, які купували фокусні товари в попередньому періоді, але не купують в поточному</p>
                        <div id="editFocus2Param1Options" class="mt-2 ${task.parameters?.param1?.enabled ? '' : 'hidden'}">
                          <select id="editFocus2Param1Period" class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm">
                            <option value="month" ${task.parameters?.param1?.period === 'month' ? 'selected' : ''}>Порівняння з попереднім місяцем</option>
                            <option value="quarter" ${task.parameters?.param1?.period === 'quarter' ? 'selected' : ''}>Порівняння з попереднім кварталом</option>
                            <option value="custom" ${task.parameters?.param1?.period === 'custom' ? 'selected' : ''}>Кастомний період</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param2: Клиенты, которые не покупали определенное количество дней -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="editFocus2Param2" class="mt-1" ${task.parameters?.param2?.enabled ? 'checked' : ''}>
                      <div class="flex-1">
                        <label for="editFocus2Param2" class="text-white font-medium">Клієнти, які не купували певну кількість днів</label>
                        <p class="text-gray-400 text-sm">Клієнти, які не робили покупок фокусних товарів протягом вказаного періоду</p>
                        <div id="editFocus2Param2Options" class="mt-2 ${task.parameters?.param2?.enabled ? '' : 'hidden'}">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="editFocus2Param2Days" min="1" max="365" value="${task.parameters?.param2?.days || 30}" 
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-20">
                            <span class="text-gray-400 text-sm">днів</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param3: Клиенты с низкой частотой покупок -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="editFocus2Param3" class="mt-1" ${task.parameters?.param3?.enabled ? 'checked' : ''}>
                      <div class="flex-1">
                        <label for="editFocus2Param3" class="text-white font-medium">Клієнти з низькою частотою покупок</label>
                        <p class="text-gray-400 text-sm">Клієнти, які рідко купують фокусні товари</p>
                        <div id="editFocus2Param3Options" class="mt-2 ${task.parameters?.param3?.enabled ? '' : 'hidden'}">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="editFocus2Param3Frequency" min="1" max="12" value="${task.parameters?.param3?.frequency || 1}" 
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-20">
                            <span class="text-gray-400 text-sm">покупок за місяць</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param4: Клиенты с низькою сумою покупок -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="editFocus2Param4" class="mt-1" ${task.parameters?.param4?.enabled ? 'checked' : ''}>
                      <div class="flex-1">
                        <label for="editFocus2Param4" class="text-white font-medium">Клієнти з низькою сумою покупок</label>
                        <p class="text-gray-400 text-sm">Клієнти, які купують на невеликі суми</p>
                        <div id="editFocus2Param4Options" class="mt-2 ${task.parameters?.param4?.enabled ? '' : 'hidden'}">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="editFocus2Param4Amount" min="1" value="${task.parameters?.param4?.amount || 1000}" 
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-32">
                            <span class="text-gray-400 text-sm">₴ за місяць</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param5: Клиенты из определенных сегментов -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="editFocus2Param5" class="mt-1" ${task.parameters?.param5?.enabled ? 'checked' : ''}>
                      <div class="flex-1">
                        <label for="editFocus2Param5" class="text-white font-medium">Клієнти з певних сегментів</label>
                        <p class="text-gray-400 text-sm">Клієнти, які належать до вказаних сегментів</p>
                        <div id="editFocus2Param5Options" class="mt-2 ${task.parameters?.param5?.enabled ? '' : 'hidden'}">
                          <div class="space-y-2">
                            <label class="flex items-center">
                              <input type="checkbox" id="editFocus2Param5VIP" class="mr-2" ${task.parameters?.param5?.segments?.vip ? 'checked' : ''}>
                              <span class="text-white text-sm">VIP клієнти</span>
                            </label>
                            <label class="flex items-center">
                              <input type="checkbox" id="editFocus2Param5Regular" class="mr-2" ${task.parameters?.param5?.segments?.regular ? 'checked' : ''}>
                              <span class="text-white text-sm">Звичайні клієнти</span>
                            </label>
                            <label class="flex items-center">
                              <input type="checkbox" id="editFocus2Param5New" class="mr-2" ${task.parameters?.param5?.segments?.new ? 'checked' : ''}>
                              <span class="text-white text-sm">Нові клієнти</span>
                            </label>
                            <label class="flex items-center">
                              <input type="checkbox" id="editFocus2Param5Inactive" class="mr-2" ${task.parameters?.param5?.segments?.inactive ? 'checked' : ''}>
                              <span class="text-white text-sm">Неактивні клієнти</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param6: Похожі клієнти, які ніколи не купували -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="editFocus2Param6" class="mt-1" ${task.parameters?.param6?.enabled ? 'checked' : ''}>
                      <div class="flex-1">
                        <label for="editFocus2Param6" class="text-white font-medium">Похожі клієнти, які ніколи не купували</label>
                        <p class="text-gray-400 text-sm">Клієнти з схожою сферою діяльності, які ніколи не купували фокусні товари</p>
                        <div id="editFocus2Param6Options" class="mt-2 ${task.parameters?.param6?.enabled ? '' : 'hidden'}">
                          <div class="flex items-center space-x-2">
                            <input type="number" id="editFocus2Param6Similarity" min="1" max="100" value="${task.parameters?.param6?.similarity || 80}"
                                   class="bg-gray-700 border border-gray-600 rounded-md text-white p-2 text-sm w-32">
                            <span class="text-gray-400 text-sm">% схожості</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Param7: Клієнти, які беруть X, але не беруть товари з фокуса -->
                    <div class="flex items-start space-x-3">
                      <input type="checkbox" id="editFocus2Param7" class="mt-1" ${task.parameters?.param7?.enabled ? 'checked' : ''}>
                      <div class="flex-1">
                        <label for="editFocus2Param7" class="text-white font-medium">Клієнти, які беруть X, але не беруть товари з фокуса</label>
                        <p class="text-gray-400 text-sm">Клієнти, які купують вказані товари, але не купують фокусні</p>
                        <div id="editFocus2Param7Options" class="mt-2 ${task.parameters?.param7?.enabled ? '' : 'hidden'}">
                          <div class="space-y-2">
                            <button type="button" id="editFocus2SelectParam7Products" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm">
                              Обрати номенклатуру X
                            </button>
                            <div id="editFocus2Param7ProductsDisplay" class="bg-gray-800 rounded p-3 min-h-[60px] text-sm text-gray-300">
                              ${this.renderSelectedParam7Nomenclature(task.parameters?.param7?.products || [])}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <!-- Футер -->
            <div class="p-6 border-t border-gray-700 flex items-center justify-between">
              <button id="cancel-focus2-edit-task" class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">
                Скасувати
              </button>
              <button id="save-focus2-edit-task" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
                Зберегти зміни
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Добавляем модальное окно к body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Настраиваем обработчики событий
    this.setupEditModalEventListeners(task);
    
    console.log('✅ Модальне вікно редагування задачі відкрито');
  }
    
  /**
   * Настройка обработчиков событий для модального окна редактирования
   */
  setupEditModalEventListeners(task) {
    const modal = document.getElementById('focus2-edit-task-modal');
    if (!modal) return;
    
    // Закрытие модального окна
    const closeModal = () => {
      modal.remove();
    };
    
    const closeBtn = modal.querySelector('#close-focus2-edit-modal');
    const cancelBtn = modal.querySelector('#cancel-focus2-edit-task');
    const saveBtn = modal.querySelector('#save-focus2-edit-task');
    
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    
    // Обработчики для номенклатуры
    const selectNomenclatureBtn = modal.querySelector('#editFocus2SelectNomenclature');
    const nomenclatureList = modal.querySelector('#editFocus2NomenclatureList');
    const nomenclatureCount = modal.querySelector('#editFocus2SelectedNomenclatureCount');
    
    let selectedProducts = task.products || [];
    
    selectNomenclatureBtn.onclick = () => {
      if (this.nomenclatureSelector) {
        this.nomenclatureSelector.openSelector(
          selectedProducts,
          'include',
          (selectedCodes) => {
            selectedProducts = selectedCodes;
            nomenclatureList.innerHTML = this.renderSelectedNomenclature(selectedProducts);
            nomenclatureCount.textContent = `${selectedProducts.length} позицій обрано`;
          }
        );
      }
    };
    
    // Обработчики для параметров
    this.setupEditParameterEventListeners(modal);
    
    // Обработчик для номенклатуры Param7
    const selectParam7ProductsBtn = modal.querySelector('#editFocus2SelectParam7Products');
    const param7ProductsDisplay = modal.querySelector('#editFocus2Param7ProductsDisplay');
    
    let selectedParam7Products = task.parameters?.param7?.products || [];
    
    if (selectParam7ProductsBtn) {
      selectParam7ProductsBtn.onclick = () => {
        if (this.nomenclatureSelector) {
          this.nomenclatureSelector.openSelector(
            selectedParam7Products,
            'include',
            (selectedCodes) => {
              selectedParam7Products = selectedCodes;
              param7ProductsDisplay.innerHTML = this.renderSelectedNomenclature(selectedParam7Products);
            }
          );
        }
      };
    }
    
    // Обработчик сохранения
    saveBtn.onclick = async () => {
      try {
        const formData = this.collectEditFormData(modal, task, selectedProducts, selectedParam7Products);
        await this.updateTaskInFirebase(task.id, formData);
        
        console.log('✅ Задачу успішно оновлено');
        closeModal();
        
        // Обновляем список задач
        await this.refreshTasksList();
        
        alert('✅ Задачу успішно оновлено');
        
      } catch (error) {
        console.error('❌ Помилка оновлення задачі:', error);
        alert('Помилка оновлення задачі: ' + error.message);
      }
    };
  }
  
  /**
   * Настройка обработчиков событий для параметров в модальном окне редактирования
   */
  setupEditParameterEventListeners(modal) {
    // Param1
    const param1Checkbox = modal.querySelector('#editFocus2Param1');
    const param1Options = modal.querySelector('#editFocus2Param1Options');
    
    if (param1Checkbox && param1Options) {
      param1Checkbox.onchange = () => {
        param1Options.style.display = param1Checkbox.checked ? 'block' : 'none';
      };
    }
    
    // Param2
    const param2Checkbox = modal.querySelector('#editFocus2Param2');
    const param2Options = modal.querySelector('#editFocus2Param2Options');
    
    if (param2Checkbox && param2Options) {
      param2Checkbox.onchange = () => {
        param2Options.style.display = param2Checkbox.checked ? 'block' : 'none';
      };
    }
    
    // Param3
    const param3Checkbox = modal.querySelector('#editFocus2Param3');
    const param3Options = modal.querySelector('#editFocus2Param3Options');
    
    if (param3Checkbox && param3Options) {
      param3Checkbox.onchange = () => {
        param3Options.style.display = param3Checkbox.checked ? 'block' : 'none';
      };
    }
    
    // Param4
    const param4Checkbox = modal.querySelector('#editFocus2Param4');
    const param4Options = modal.querySelector('#editFocus2Param4Options');
    
    if (param4Checkbox && param4Options) {
      param4Checkbox.onchange = () => {
        param4Options.style.display = param4Checkbox.checked ? 'block' : 'none';
      };
    }
    
    // Param5
    const param5Checkbox = modal.querySelector('#editFocus2Param5');
    const param5Options = modal.querySelector('#editFocus2Param5Options');
    
    if (param5Checkbox && param5Options) {
      param5Checkbox.onchange = () => {
        param5Options.style.display = param5Checkbox.checked ? 'block' : 'none';
      };
    }
    
    // Param6
    const param6Checkbox = modal.querySelector('#editFocus2Param6');
    const param6Options = modal.querySelector('#editFocus2Param6Options');
    
    if (param6Checkbox && param6Options) {
      param6Checkbox.onchange = () => {
        param6Options.style.display = param6Checkbox.checked ? 'block' : 'none';
      };
    }
    
    // Param7
    const param7Checkbox = modal.querySelector('#editFocus2Param7');
    const param7Options = modal.querySelector('#editFocus2Param7Options');
    
    if (param7Checkbox && param7Options) {
      param7Checkbox.onchange = () => {
        param7Options.style.display = param7Checkbox.checked ? 'block' : 'none';
      };
    }
  }
  
  /**
   * Сбор данных из формы редактирования
   */
  collectEditFormData(modal, task, selectedProducts = null, selectedParam7Products = null) {
    const title = modal.querySelector('#editFocus2TaskTitle').value.trim();
    const description = modal.querySelector('#editFocus2TaskDescription').value.trim();
    const products = selectedProducts || task.products || [];
    
    const parameters = {
      param1: {
        enabled: modal.querySelector('#editFocus2Param1').checked,
        period: modal.querySelector('#editFocus2Param1Period')?.value || task.parameters?.param1?.period || 'month'
      },
      param2: {
        enabled: modal.querySelector('#editFocus2Param2').checked,
        days: parseInt(modal.querySelector('#editFocus2Param2Days')?.value || task.parameters?.param2?.days || 30)
      },
      param3: {
        enabled: modal.querySelector('#editFocus2Param3').checked,
        frequency: parseInt(modal.querySelector('#editFocus2Param3Frequency')?.value || task.parameters?.param3?.frequency || 1)
      },
      param4: {
        enabled: modal.querySelector('#editFocus2Param4').checked,
        amount: parseInt(modal.querySelector('#editFocus2Param4Amount')?.value || task.parameters?.param4?.amount || 1000)
      },
      param5: {
        enabled: modal.querySelector('#editFocus2Param5').checked,
        segments: {
          vip: modal.querySelector('#editFocus2Param5VIP')?.checked || false,
          regular: modal.querySelector('#editFocus2Param5Regular')?.checked || false,
          new: modal.querySelector('#editFocus2Param5New')?.checked || false,
          inactive: modal.querySelector('#editFocus2Param5Inactive')?.checked || false
        }
      },
      param6: {
        enabled: modal.querySelector('#editFocus2Param6').checked,
        similarity: parseInt(modal.querySelector('#editFocus2Param6Similarity')?.value || task.parameters?.param6?.similarity || 80)
      },
      param7: {
        enabled: modal.querySelector('#editFocus2Param7').checked,
        products: selectedParam7Products || task.parameters?.param7?.products || []
      }
    };
    
    const periodFrom = modal.querySelector('#editFocus2TaskPeriodFrom').value;
    const periodTo = modal.querySelector('#editFocus2TaskPeriodTo').value;
    
    return {
      title,
      description,
      products,
      parameters,
      periodFrom,
      periodTo,
      updatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Обновление задачи в Firebase
   */
  async updateTaskInFirebase(taskId, taskData) {
    try {
      const companyId = window.state?.currentCompanyId;
      if (!companyId) {
        throw new Error('ID компанії не знайдено');
      }
      
      const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks2', taskId);
      await firebase.updateDoc(taskRef, taskData);
      
      console.log('✅ Задачу оновлено в Firebase:', taskId);
      
    } catch (error) {
      console.error('❌ Помилка оновлення задачі в Firebase:', error);
      throw error;
    }
  }
  
  /**
   * Архивирование задачи
   */
  async archiveTask(taskId) {
    try {
      console.log('📦 Архівування задачі:', taskId);
      
      const companyId = window.state?.currentCompanyId;
      if (!companyId) {
        throw new Error('ID компанії не знайдено');
      }
      
      const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks2', taskId);
      await firebase.updateDoc(taskRef, {
        status: 'archived',
        archivedAt: new Date().toISOString()
      });
      
      console.log('✅ Задачу архівовано:', taskId);
      
      // Обновляем список задач
      await this.refreshTasksList();
      
      alert('✅ Задачу успішно архівовано');
      
    } catch (error) {
      console.error('❌ Помилка архівування задачі:', error);
      alert('Помилка архівування задачі: ' + error.message);
    }
  }

  /**
   * Автоматическое обновление статусов задач
   */
  async updateTaskStatuses() {
    try {
      console.log('🔄 Оновлення статусів задач...');
      
      const tasks = window.focus2Data?.tasks || [];
      const now = new Date();
      let updatedCount = 0;
      
      for (const task of tasks) {
        if (task.status === 'active' && task.periodTo) {
          const endDate = new Date(task.periodTo);
          
          // Если срок задачи истек, меняем статус на "completed"
          if (endDate < now) {
            try {
              const companyId = window.state?.currentCompanyId;
              if (companyId) {
                const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks2', task.id);
                await firebase.updateDoc(taskRef, {
                  status: 'completed',
                  completedAt: now.toISOString()
                });
                
                console.log('✅ Статус задачі оновлено на "completed":', task.id);
                updatedCount++;
              }
            } catch (error) {
              console.error('❌ Помилка оновлення статусу задачі:', task.id, error);
            }
          }
        }
      }
      
      if (updatedCount > 0) {
        console.log(`✅ Оновлено статусів задач: ${updatedCount}`);
        // Обновляем данные задач
        await this.refreshTasksList();
      }
      
    } catch (error) {
      console.error('❌ Помилка оновлення статусів задач:', error);
    }
  }
} 