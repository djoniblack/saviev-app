// UI компоненти для комерційної пропозиції
import { commercialProposalManager } from './proposalManager.js';
import { commercialProposalAIService } from './aiService.js';

export class CommercialProposalUI {
  constructor() {
    this.currentView = 'list';
    this.currentProposal = null;
    this.isInitialized = false;
  }

  /**
   * Ініціалізація UI
   */
  async init(container) {
    try {
      console.log('🎨 Ініціалізація UI модуля комерційної пропозиції...');
      
      this.container = container;
      this.isInitialized = true;
      
      // Показуємо список пропозицій
      await this.showProposalsList();
      
      console.log('✅ UI модуля комерційної пропозиції успішно ініціалізовано');
      
    } catch (error) {
      console.error('❌ Помилка ініціалізації UI:', error);
      throw error;
    }
  }

  /**
   * Показ списку пропозицій
   */
  async showProposalsList() {
    try {
      this.currentView = 'list';
      
      const proposals = commercialProposalManager.getAllProposals();
      
      this.container.innerHTML = `
        <div class="w-full">
          <!-- Заголовок та кнопки -->
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 class="text-2xl font-bold text-white">Мої комерційні пропозиції</h2>
              <p class="text-gray-300 mt-1">Управління та створення комерційних пропозицій</p>
            </div>
            <div class="flex gap-3">
              <button id="createProposalBtn" class="btn-primary">
                <i class="fas fa-plus mr-2"></i>
                Створити пропозицію
              </button>
              <button id="refreshProposalsBtn" class="btn-secondary">
                <i class="fas fa-sync-alt mr-2"></i>
                Оновити
              </button>
            </div>
          </div>

          <!-- Статистика -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white">
              <div class="text-2xl font-bold">${proposals.length}</div>
              <div class="text-blue-100">Всього пропозицій</div>
            </div>
            <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-4 text-white">
              <div class="text-2xl font-bold">${proposals.filter(p => p.status === 'active').length}</div>
              <div class="text-green-100">Активні</div>
            </div>
            <div class="bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-xl p-4 text-white">
              <div class="text-2xl font-bold">${proposals.filter(p => p.status === 'draft').length}</div>
              <div class="text-yellow-100">Чернетки</div>
            </div>
            <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-4 text-white">
              <div class="text-2xl font-bold">${proposals.filter(p => p.status === 'sent').length}</div>
              <div class="text-purple-100">Відправлені</div>
            </div>
          </div>

          <!-- Список пропозицій -->
          <div class="bg-gray-800 rounded-xl p-6">
            ${proposals.length === 0 ? this.renderEmptyState() : this.renderProposalsList(proposals)}
          </div>
        </div>
      `;

      // Додаємо обробники подій
      this.addEventListeners();
      
    } catch (error) {
      console.error('❌ Помилка показу списку пропозицій:', error);
      this.showError('Помилка завантаження списку пропозицій');
    }
  }

  /**
   * Рендер порожнього стану
   */
  renderEmptyState() {
    return `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">📋</div>
        <h3 class="text-xl font-semibold text-white mb-2">Пропозицій ще немає</h3>
        <p class="text-gray-400 mb-6">Створіть свою першу комерційну пропозицію з AI-підтримкою</p>
        <button id="createFirstProposalBtn" class="btn-primary">
          <i class="fas fa-magic mr-2"></i>
          Створити з AI
        </button>
      </div>
    `;
  }

  /**
   * Рендер списку пропозицій
   */
  renderProposalsList(proposals) {
    return `
      <div class="space-y-4">
        ${proposals.map(proposal => this.renderProposalCard(proposal)).join('')}
      </div>
    `;
  }

  /**
   * Рендер картки пропозиції
   */
  renderProposalCard(proposal) {
    const statusColors = {
      'draft': 'bg-yellow-600',
      'active': 'bg-green-600',
      'sent': 'bg-blue-600',
      'expired': 'bg-red-600'
    };

    const statusText = {
      'draft': 'Чернетка',
      'active': 'Активна',
      'sent': 'Відправлена',
      'expired': 'Застаріла'
    };

    return `
      <div class="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-lg font-semibold text-white">${proposal.companyName}</h3>
              <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[proposal.status]} text-white">
                ${statusText[proposal.status]}
              </span>
              ${proposal.aiVersion ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-pink-600 to-purple-600 text-white">🤖 AI</span>' : ''}
            </div>
            <p class="text-gray-300 text-sm mb-2">${proposal.description || 'Опис відсутній'}</p>
            <div class="flex items-center gap-4 text-sm text-gray-400">
              <span><i class="fas fa-calendar mr-1"></i>${new Date(proposal.createdAt).toLocaleDateString('uk-UA')}</span>
              <span><i class="fas fa-clock mr-1"></i>Версія ${proposal.version}</span>
              ${proposal.products ? `<span><i class="fas fa-box mr-1"></i>${proposal.products.length} продуктів</span>` : ''}
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary btn-sm" onclick="window.commercialProposalUI.viewProposal('${proposal.id}')">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-primary btn-sm" onclick="window.commercialProposalUI.editProposal('${proposal.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-danger btn-sm" onclick="window.commercialProposalUI.deleteProposal('${proposal.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Показ форми створення пропозиції
   */
  async showCreateForm() {
    try {
      this.currentView = 'create';
      
      const templates = commercialProposalManager.getAllTemplates();
      
      this.container.innerHTML = `
        <div class="w-full">
          <!-- Заголовок -->
          <div class="flex items-center gap-4 mb-6">
            <button id="backToListBtn" class="btn-secondary">
              <i class="fas fa-arrow-left mr-2"></i>
              Назад до списку
            </button>
            <div>
              <h2 class="text-2xl font-bold text-white">Створення комерційної пропозиції</h2>
              <p class="text-gray-300 mt-1">Заповніть основні дані, а AI допоможе з рештою</p>
            </div>
          </div>

          <!-- Перемикач режимів -->
          <div class="bg-gray-800 rounded-xl p-4 mb-6">
            <div class="flex gap-4">
              <button id="standardModeBtn" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
                <i class="fas fa-edit mr-2"></i>
                Стандартна форма
              </button>
              <button id="textModeBtn" class="px-4 py-2 rounded-lg bg-gray-600 text-white font-medium hover:bg-gray-500">
                <i class="fas fa-keyboard mr-2"></i>
                Текст менеджера
              </button>
            </div>
          </div>

          <!-- Форма створення -->
          <div class="bg-gray-800 rounded-xl p-6">
            <form id="createProposalForm" class="space-y-6">
              <!-- Основна інформація -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">
                    Назва компанії *
                  </label>
                  <input type="text" id="companyName" name="companyName" required
                         class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">
                    Шаблон
                  </label>
                  <select id="template" name="template"
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                    ${templates.map(template => `
                      <option value="${template.id}">${template.name}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <!-- Тип клієнта та обсяг замовлення -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">
                    Тип клієнта
                  </label>
                  <select id="clientType" name="clientType"
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                    <option value="new">Новий клієнт</option>
                    <option value="returning">Постійний клієнт</option>
                    <option value="vip">VIP клієнт</option>
                    <option value="wholesale">Оптовий клієнт</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">
                    Обсяг замовлення
                  </label>
                  <select id="orderVolume" name="orderVolume"
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                    <option value="small">Малий (1-10)</option>
                    <option value="medium">Середній (11-50)</option>
                    <option value="large">Великий (51-100)</option>
                    <option value="wholesale">Оптовий (100+)</option>
                  </select>
                </div>
              </div>

              <!-- Продукти -->
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">
                  Продукти/Послуги
                </label>
                <div id="productsContainer" class="space-y-3">
                  <div class="product-item bg-gray-700 rounded-lg p-4">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input type="text" name="products[0][name]" placeholder="Назва продукту" required
                             class="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                      <input type="text" name="products[0][category]" placeholder="Категорія"
                             class="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                      <input type="number" name="products[0][basePrice]" placeholder="Базова ціна" step="0.01" required
                             class="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                      <input type="number" name="products[0][quantity]" placeholder="Кількість" value="1" min="1" required
                             class="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
                    </div>
                  </div>
                </div>
                <button type="button" id="addProductBtn" class="btn-secondary mt-3">
                  <i class="fas fa-plus mr-2"></i>
                  Додати продукт
                </button>
              </div>

              <!-- Кнопки -->
              <div class="flex gap-3 pt-4">
                <button type="submit" class="btn-primary flex-1">
                  <i class="fas fa-magic mr-2"></i>
                  Створити з AI
                </button>
                <button type="button" id="previewBtn" class="btn-secondary">
                  <i class="fas fa-eye mr-2"></i>
                  Попередній перегляд
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Додаємо обробники подій
      this.addCreateFormEventListeners();
      
    } catch (error) {
      console.error('❌ Помилка показу форми створення:', error);
      this.showError('Помилка завантаження форми створення');
    }
  }

  /**
   * Показ форми створення пропозиції з тексту менеджера
   */
  async showTextForm() {
    try {
      this.currentView = 'text';
      
      this.container.innerHTML = `
        <div class="w-full">
          <!-- Заголовок -->
          <div class="flex items-center gap-4 mb-6">
            <button id="backToListBtn" class="btn-secondary">
              <i class="fas fa-arrow-left mr-2"></i>
              Назад до списку
            </button>
            <div>
              <h2 class="text-2xl font-bold text-white">Створення пропозиції з тексту</h2>
              <p class="text-gray-300 mt-1">Просто введіть текст як зазвичай робите для клієнтів</p>
            </div>
          </div>

          <!-- Перемикач режимів -->
          <div class="bg-gray-800 rounded-xl p-4 mb-6">
            <div class="flex gap-4">
              <button id="standardModeBtn" class="px-4 py-2 rounded-lg bg-gray-600 text-white font-medium hover:bg-gray-500">
                <i class="fas fa-edit mr-2"></i>
                Стандартна форма
              </button>
              <button id="textModeBtn" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
                <i class="fas fa-keyboard mr-2"></i>
                Текст менеджера
              </button>
            </div>
          </div>

          <!-- Вибір методу аналізу -->
          <div class="bg-gray-800 rounded-xl p-4 mb-6">
            <h4 class="text-white font-medium mb-3">Метод аналізу тексту:</h4>
            <div class="flex gap-4">
              <label class="flex items-center">
                <input type="radio" name="analysisMethod" value="regex" checked
                       class="mr-2 text-blue-500">
                <span class="text-gray-300">Звичайний парсинг</span>
              </label>
              <label class="flex items-center">
                <input type="radio" name="analysisMethod" value="gemini"
                       class="mr-2 text-blue-500">
                <span class="text-gray-300">AI Gemini (потребує API ключ)</span>
              </label>
            </div>
          </div>
          
          <!-- Поле для API ключа Gemini -->
          <div id="geminiApiKeyField" class="bg-gray-800 rounded-xl p-4 mb-6 hidden">
            <h4 class="text-white font-medium mb-3">Налаштування Gemini API</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">
                  Gemini API ключ *
                </label>
                <input type="password" id="geminiApiKey" name="geminiApiKey"
                       class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                       placeholder="Введіть ваш Gemini API ключ">
                <p class="text-xs text-gray-400 mt-1">
                  Отримайте ключ на <a href="https://makersuite.google.com/app/apikey" target="_blank" class="text-blue-400 hover:underline">Google AI Studio</a>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <input type="checkbox" id="saveApiKey" class="text-blue-500">
                <label for="saveApiKey" class="text-sm text-gray-300">Зберегти ключ локально</label>
              </div>
            </div>
          </div>

          <!-- Форма тексту менеджера -->
          <div class="bg-gray-800 rounded-xl p-6">
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-white mb-3">Введіть текст пропозиції</h3>
              <p class="text-gray-300 text-sm mb-4">
                Просто введіть текст як зазвичай робите для клієнтів. AI автоматично розбере товари, ціни та знижки.
              </p>
              <div class="bg-gray-900 rounded-lg p-4 mb-4">
                <h4 class="text-white font-medium mb-2">Приклад формату:</h4>
                <div class="text-gray-300 text-sm space-y-1">
                  <div>1. Стакан КУПОЛЬНЫЙ 420мл РЕТ LF (50шт/1000шт) основна ціна 2,92 грн</div>
                  <div>2. Стакан КУПОЛЬНЫЙ 300мл РЕТ LF (50шт/1000шт) основна ціна 2,28 грн</div>
                  <div>3. Стакан КУПОЛЬНЫЙ 200мл РЕТ LF (50шт/1000шт) основна ціна 1,85 грн</div>
                  <div>Пропозиція при покупці від 5 ящиків знижка 10%, від 10 ящиків знижка 15%, від 20 ящиків знижка 25%</div>
                </div>
              </div>
            </div>
            
            <form id="textProposalForm" class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">
                  Назва компанії *
                </label>
                <input type="text" id="textCompanyName" name="companyName" required
                       class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                       placeholder="Введіть назву вашої компанії">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">
                  Текст пропозиції *
                </label>
                <textarea id="managerText" name="managerText" rows="8" required
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                          placeholder="Введіть текст вашої пропозиції..."></textarea>
              </div>
              
              <div class="flex gap-3 pt-4">
                <button type="submit" class="btn-primary flex-1">
                  <i class="fas fa-robot mr-2"></i>
                  Аналізувати з AI
                </button>
                <button type="button" id="textPreviewBtn" class="btn-secondary">
                  <i class="fas fa-eye mr-2"></i>
                  Попередній перегляд
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Додаємо обробники подій
      this.addTextFormEventListeners();
      
      // Завантажуємо збережений API ключ, якщо є
      this.loadSavedApiKey();
      
    } catch (error) {
      console.error('❌ Помилка показу форми тексту:', error);
      this.showError('Помилка завантаження форми тексту');
    }
  }

  /**
   * Завантаження збереженого API ключа
   */
  loadSavedApiKey() {
    try {
      const savedKey = localStorage.getItem('geminiApiKey');
      if (savedKey) {
        const geminiApiKeyInput = document.getElementById('geminiApiKey');
        if (geminiApiKeyInput) {
          geminiApiKeyInput.value = savedKey;
          // Автоматично вибираємо Gemini метод
          const geminiRadio = document.querySelector('input[name="analysisMethod"][value="gemini"]');
          if (geminiRadio) {
            geminiRadio.checked = true;
            document.getElementById('geminiApiKeyField').classList.remove('hidden');
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Не вдалося завантажити збережений API ключ:', error);
    }
  }

  /**
   * Додавання обробників подій для текстової форми
   */
  addTextFormEventListeners() {
    // Кнопка "Назад до списку"
    const backBtn = document.getElementById('backToListBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showProposalsList());
    }

    // Перемикач на стандартну форму
    const standardModeBtn = document.getElementById('standardModeBtn');
    if (standardModeBtn) {
      standardModeBtn.addEventListener('click', () => this.showCreateForm());
    }

    // Перемикач на метод аналізу
    const regexRadio = document.querySelector('input[name="analysisMethod"][value="regex"]');
    const geminiRadio = document.querySelector('input[name="analysisMethod"][value="gemini"]');

    if (regexRadio) {
      regexRadio.addEventListener('change', () => {
        document.getElementById('geminiApiKeyField').classList.add('hidden');
        document.getElementById('geminiApiKey').value = ''; // Очищаємо поле API ключа
        document.getElementById('saveApiKey').checked = false; // Скидаємо чекбокс
      });
    }

    if (geminiRadio) {
      geminiRadio.addEventListener('change', () => {
        document.getElementById('geminiApiKeyField').classList.remove('hidden');
      });
    }

    // Форма тексту
    const form = document.getElementById('textProposalForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleTextProposal(e));
    }

    // Кнопка попереднього перегляду
    const previewBtn = document.getElementById('textPreviewBtn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.previewTextProposal());
    }
  }

  /**
   * Додавання обробників подій для форми створення
   */
  addCreateFormEventListeners() {
    // Кнопка "Назад до списку"
    const backBtn = document.getElementById('backToListBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showProposalsList());
    }

    // Перемикач на текстову форму
    const textModeBtn = document.getElementById('textModeBtn');
    if (textModeBtn) {
      textModeBtn.addEventListener('click', () => this.showTextForm());
    }

    // Кнопка "Додати продукт"
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
      addProductBtn.addEventListener('click', () => this.addProductField());
    }

    // Форма створення
    const form = document.getElementById('createProposalForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCreateProposal(e));
    }

    // Кнопка попереднього перегляду
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.previewProposal());
    }
  }

  /**
   * Додавання поля продукту
   */
  addProductField() {
    const container = document.getElementById('productsContainer');
    const productCount = container.children.length;
    
    const productItem = document.createElement('div');
    productItem.className = 'product-item bg-gray-700 rounded-lg p-4';
    productItem.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input type="text" name="products[${productCount}][name]" placeholder="Назва продукту" required
               class="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
        <input type="text" name="products[${productCount}][category]" placeholder="Категорія"
               class="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
        <input type="number" name="products[${productCount}][basePrice]" placeholder="Базова ціна" step="0.01" required
               class="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
        <div class="flex gap-2">
          <input type="number" name="products[${productCount}][quantity]" placeholder="Кількість" value="1" min="1" required
                 class="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500">
          <button type="button" class="btn-danger btn-sm" onclick="this.parentElement.parentElement.parentElement.remove()">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(productItem);
  }

  /**
   * Обробка створення пропозиції з тексту менеджера
   */
  async handleTextProposal(event) {
    event.preventDefault();
    
    try {
      const formData = new FormData(event.target);
      const companyName = formData.get('companyName');
      const managerText = formData.get('managerText');
      // Radios та ключ знаходяться поза формою -> читаємо напряму з DOM
      const analysisMethod = (document.querySelector('input[name="analysisMethod"]:checked')?.value) || 'regex';
      const geminiApiKey = document.getElementById('geminiApiKey')?.value || '';
      const saveApiKey = document.getElementById('saveApiKey')?.checked || false;
      
      if (!companyName || !managerText) {
        this.showError('Заповніть всі обов\'язкові поля');
        return;
      }
      
      // Показуємо завантаження
      this.showLoading('Аналіз тексту менеджера з AI...');
      
      let analyzedProposal;
      if (analysisMethod === 'regex') {
        analyzedProposal = await commercialProposalAIService.analyzeManagerText(managerText);
      } else if (analysisMethod === 'gemini') {
        if (!geminiApiKey) {
          this.showError('Будь ласка, введіть Gemini API ключ для аналізу тексту AI.');
          return;
        }
        
        // Ініціалізуємо Gemini API
        await commercialProposalAIService.initGeminiAPI(geminiApiKey);
        
        // Аналізуємо з Gemini
        analyzedProposal = await commercialProposalAIService.analyzeManagerText(managerText, true);
        
        // Зберігаємо ключ локально, якщо користувач обрав
        if (saveApiKey) {
          localStorage.setItem('geminiApiKey', geminiApiKey);
        }
      }
      
      // Перевіряємо, чи отримали ми валідну пропозицію
      if (!analyzedProposal) {
        this.showError('Помилка аналізу тексту. Не вдалося створити структуровану пропозицію.');
        return;
      }
      
      // Додаємо назву компанії
      analyzedProposal.companyName = companyName;
      
      // Зберігаємо в базі
      const savedProposal = await commercialProposalManager.createProposal(analyzedProposal);
      
      // Показуємо успіх
      this.showSuccess('Пропозицію успішно створено з тексту!');
      
      // Переходимо до перегляду
      setTimeout(() => {
        this.viewProposal(savedProposal.id);
      }, 1500);
      
    } catch (error) {
      console.error('❌ Помилка створення пропозиції з тексту:', error);
      this.showError('Помилка створення пропозиції: ' + error.message);
    }
  }

  /**
   * Попередній перегляд пропозиції з тексту
   */
  async previewTextProposal() {
    try {
      const formData = new FormData(document.getElementById('textProposalForm'));
      const companyName = formData.get('companyName');
      const managerText = formData.get('managerText');
      // Radios та ключ знаходяться поза формою -> читаємо напряму з DOM
      const analysisMethod = (document.querySelector('input[name="analysisMethod"]:checked')?.value) || 'regex';
      const geminiApiKey = document.getElementById('geminiApiKey')?.value || '';
      
      if (!companyName || !managerText) {
        this.showError('Заповніть всі обов\'язкові поля для попереднього перегляду');
        return;
      }
      
      let analyzedProposal;
      if (analysisMethod === 'regex') {
        analyzedProposal = await commercialProposalAIService.analyzeManagerText(managerText);
      } else if (analysisMethod === 'gemini') {
        if (!geminiApiKey) {
          this.showError('Будь ласка, введіть Gemini API ключ для попереднього перегляду.');
          return;
        }
        
        // Ініціалізуємо Gemini API
        await commercialProposalAIService.initGeminiAPI(geminiApiKey);
        
        // Аналізуємо з Gemini
        analyzedProposal = await commercialProposalAIService.analyzeManagerText(managerText, true);
      }
      
      // Перевіряємо, чи отримали ми валідну пропозицію
      if (!analyzedProposal) {
        this.showError('Помилка аналізу тексту. Не вдалося створити структуровану пропозицію для попереднього перегляду.');
        return;
      }
      
      analyzedProposal.companyName = companyName;
      
      // Генеруємо HTML
      const html = commercialProposalAIService.generateHTML(analyzedProposal);
      
      // Показуємо в новому вікні
      const previewWindow = window.open('', '_blank');
      previewWindow.document.write(html);
      previewWindow.document.close();
      
    } catch (error) {
      console.error('❌ Помилка попереднього перегляду тексту:', error);
      this.showError('Помилка попереднього перегляду: ' + error.message);
    }
  }

  /**
   * Обробка створення пропозиції
   */
  async handleCreateProposal(event) {
    event.preventDefault();
    
    try {
      const formData = new FormData(event.target);
      const proposalData = {
        companyName: formData.get('companyName'),
        template: formData.get('template'),
        clientType: formData.get('clientType'),
        orderVolume: formData.get('orderVolume'),
        products: this.extractProductsFromForm(formData)
      };

      // Показуємо завантаження
      this.showLoading('Створення пропозиції з AI...');

              // Генеруємо повну пропозицію з AI
        const fullProposal = await commercialProposalAIService.generateFullProposal(proposalData);
      
      // Зберігаємо в базі
      const savedProposal = await commercialProposalManager.createProposal(fullProposal);
      
      // Показуємо успіх
      this.showSuccess('Пропозицію успішно створено!');
      
      // Переходимо до перегляду
      setTimeout(() => {
        this.viewProposal(savedProposal.id);
      }, 1500);
      
    } catch (error) {
      console.error('❌ Помилка створення пропозиції:', error);
      this.showError('Помилка створення пропозиції: ' + error.message);
    }
  }

  /**
   * Витягування продуктів з форми
   */
  extractProductsFromForm(formData) {
    const products = [];
    let index = 0;
    
    while (formData.get(`products[${index}][name]`)) {
      products.push({
        name: formData.get(`products[${index}][name]`),
        category: formData.get(`products[${index}][category]`),
        basePrice: parseFloat(formData.get(`products[${index}][basePrice]`)),
        quantity: parseInt(formData.get(`products[${index}][quantity]`))
      });
      index++;
    }
    
    return products;
  }

  /**
   * Попередній перегляд пропозиції
   */
  async previewProposal() {
    try {
      const formData = new FormData(document.getElementById('createProposalForm'));
      const proposalData = {
        companyName: formData.get('companyName'),
        template: formData.get('template'),
        clientType: formData.get('clientType'),
        orderVolume: formData.get('orderVolume'),
        products: this.extractProductsFromForm(formData)
      };

      if (!proposalData.companyName || proposalData.products.length === 0) {
        this.showError('Заповніть обов\'язкові поля для попереднього перегляду');
        return;
      }

      // Генеруємо HTML
              const fullProposal = await commercialProposalAIService.generateFullProposal(proposalData);
              const html = commercialProposalAIService.generateHTML(fullProposal);
      
      // Показуємо в новому вікні
      const previewWindow = window.open('', '_blank');
      previewWindow.document.write(html);
      previewWindow.document.close();
      
    } catch (error) {
      console.error('❌ Помилка попереднього перегляду:', error);
      this.showError('Помилка попереднього перегляду: ' + error.message);
    }
  }

  /**
   * Перегляд пропозиції
   */
  async viewProposal(proposalId) {
    try {
      const proposal = commercialProposalManager.getProposal(proposalId);
      if (!proposal) {
        throw new Error('Пропозицію не знайдено');
      }

      this.currentProposal = proposal;
      this.currentView = 'view';
      
      // Генеруємо HTML
              const html = commercialProposalAIService.generateHTML(proposal);
      
      this.container.innerHTML = `
        <div class="w-full">
          <!-- Заголовок -->
          <div class="flex items-center gap-4 mb-6">
            <button id="backToListBtn" class="btn-secondary">
              <i class="fas fa-arrow-left mr-2"></i>
              Назад до списку
            </button>
            <div>
              <h2 class="text-2xl font-bold text-white">Перегляд пропозиції</h2>
              <p class="text-gray-300 mt-1">${proposal.companyName}</p>
            </div>
            <div class="ml-auto flex gap-2">
              <button id="exportHtmlBtn" class="btn-primary">
                <i class="fas fa-download mr-2"></i>
                Експорт HTML
              </button>
              <button id="editProposalBtn" class="btn-secondary">
                <i class="fas fa-edit mr-2"></i>
                Редагувати
              </button>
            </div>
          </div>

          <!-- HTML пропозиції -->
          <div class="bg-white rounded-xl overflow-hidden">
            <iframe id="proposalPreview" class="w-full h-screen border-0"></iframe>
          </div>
        </div>
      `;

      // Завантажуємо HTML в iframe
      const iframe = document.getElementById('proposalPreview');
      iframe.onload = () => {
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
      };

      // Додаємо обробники подій
      this.addViewEventListeners();
      
    } catch (error) {
      console.error('❌ Помилка перегляду пропозиції:', error);
      this.showError('Помилка завантаження пропозиції: ' + error.message);
    }
  }

  /**
   * Додавання обробників подій для перегляду
   */
  addViewEventListeners() {
    // Кнопка "Назад до списку"
    const backBtn = document.getElementById('backToListBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showProposalsList());
    }

    // Кнопка "Експорт HTML"
    const exportBtn = document.getElementById('exportHtmlBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportProposalHTML());
    }

    // Кнопка "Редагувати"
    const editBtn = document.getElementById('editProposalBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.editProposal(this.currentProposal.id));
    }
  }

  /**
   * Експорт пропозиції в HTML
   */
  async exportProposalHTML() {
    try {
      if (!this.currentProposal) return;
      
              const html = commercialProposalAIService.generateHTML(this.currentProposal);
      
      // Створюємо blob та завантажуємо
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal_${this.currentProposal.companyName}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      this.showSuccess('HTML файл успішно завантажено!');
      
    } catch (error) {
      console.error('❌ Помилка експорту HTML:', error);
      this.showError('Помилка експорту: ' + error.message);
    }
  }

  /**
   * Редагування пропозиції
   */
  editProposal(proposalId) {
    // Тут можна додати логіку редагування
    console.log('Редагування пропозиції:', proposalId);
    this.showInfo('Функція редагування в розробці');
  }

  /**
   * Видалення пропозиції
   */
  async deleteProposal(proposalId) {
    try {
      if (!confirm('Ви впевнені, що хочете видалити цю пропозицію?')) {
        return;
      }

      await commercialProposalManager.deleteProposal(proposalId);
      this.showSuccess('Пропозицію успішно видалено!');
      
      // Оновлюємо список
      setTimeout(() => {
        this.showProposalsList();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Помилка видалення пропозиції:', error);
      this.showError('Помилка видалення: ' + error.message);
    }
  }

  /**
   * Додавання основних обробників подій
   */
  addEventListeners() {
    // Кнопка створення пропозиції
    const createBtn = document.getElementById('createProposalBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateForm());
    }

    // Кнопка створення першої пропозиції
    const createFirstBtn = document.getElementById('createFirstProposalBtn');
    if (createFirstBtn) {
      createFirstBtn.addEventListener('click', () => this.showCreateForm());
    }

    // Кнопка оновлення
    const refreshBtn = document.getElementById('refreshProposalsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.showProposalsList());
    }
  }

  /**
   * Показ завантаження
   */
  showLoading(message) {
    // Тут можна додати спінер завантаження
    console.log('Завантаження:', message);
  }

  /**
   * Показ успіху
   */
  showSuccess(message) {
    // Тут можна додати красиве повідомлення про успіх
    alert('✅ ' + message);
  }

  /**
   * Показ помилки
   */
  showError(message) {
    // Тут можна додати красиве повідомлення про помилку
    alert('❌ ' + message);
  }

  /**
   * Показ інформації
   */
  showInfo(message) {
    // Тут можна додати красиве інформаційне повідомлення
    alert('ℹ️ ' + message);
  }

  /**
   * Очищення UI
   */
  cleanup() {
    this.isInitialized = false;
    this.currentView = 'list';
    this.currentProposal = null;
    console.log('🧹 UI модуля комерційної пропозиції очищено');
  }
}

// Створюємо глобальний екземпляр
export const commercialProposalUI = new CommercialProposalUI();

// Робимо доступним глобально для обробників подій
window.commercialProposalUI = commercialProposalUI; 