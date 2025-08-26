// Модуль комерційної пропозиції
import { commercialProposalManager } from './proposalManager.js';
import { commercialProposalUI } from './ui.js';
import { commercialProposalAIService } from './aiService.js';

// Глобальні змінні модуля
let commercialProposalData = {
  proposals: [],
  currentProposal: null,
  templates: [],
  settings: {}
};

// Робимо дані доступними глобально
window.commercialProposalData = commercialProposalData;

/**
 * Ініціалізація модуля комерційної пропозиції
 */
export async function initCommercialProposalModule(container) {
  try {
    console.log('🚀 Ініціалізація модуля комерційної пропозиції...');
    
    // Показуємо анімовану завантаження
    showCommercialProposalLoadingAnimation(container);
    
    // Ініціалізуємо компоненти
    await initializeComponents();
    
    // Показуємо основний інтерфейс
    await showMainInterface(container);
    
    console.log('✅ Модуль комерційної пропозиції успішно ініціалізовано');
    
  } catch (error) {
    console.error('❌ Помилка ініціалізації модуля комерційної пропозиції:', error);
    showCommercialProposalError(container, 'Помилка ініціалізації модуля');
  }
}

/**
 * Показ анімованої завантаження
 */
function showCommercialProposalLoadingAnimation(container) {
  container.innerHTML = `
    <div class="w-full min-h-screen pb-6">
      <header class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold">Комерційна пропозиція</h1>
          <p class="mt-2">Створення та управління комерційними пропозиціями з AI-підтримкою</p>
        </div>
      </header>
      
      <!-- Індикатор завантаження -->
      <div id="commercial-proposal-loading-container" class="text-center p-8">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <div>
          <p id="commercial-proposal-loading-message" class="text-lg font-medium text-gray-200 mb-2">Завантаження модуля...</p>
          <div class="bg-gray-700 rounded-full h-2 max-w-md mx-auto mb-2">
            <div id="commercial-proposal-progress-bar" class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          <p id="commercial-proposal-loading-step" class="text-sm text-gray-400">Ініціалізація...</p>
        </div>
      </div>
      
      <!-- Основний контент (спочатку прихований) -->
      <div id="commercial-proposal-main-content" class="hidden">
        <!-- Основний контент буде завантажено тут -->
      </div>
    </div>
  `;
}

/**
 * Ініціалізація компонентів
 */
async function initializeComponents() {
  const loadingContainer = document.getElementById('commercial-proposal-loading-container');
  const progressBar = document.getElementById('commercial-proposal-progress-bar');
  const loadingMessage = document.getElementById('commercial-proposal-loading-message');
  const loadingStep = document.getElementById('commercial-proposal-loading-step');
  
  if (!loadingContainer) return;
  
  // Крок 1: Ініціалізація менеджера пропозицій
  updateLoadingProgress(progressBar, loadingMessage, loadingStep, 25, 'Ініціалізація менеджера пропозицій...');
  await commercialProposalManager.init();
  
  // Крок 2: Ініціалізація AI-сервісу
  updateLoadingProgress(progressBar, loadingMessage, loadingStep, 50, 'Ініціалізація AI-сервісу...');
  await commercialProposalAIService.init();
  
  // Крок 3: Завантаження шаблонів
  updateLoadingProgress(progressBar, loadingMessage, loadingStep, 75, 'Завантаження шаблонів...');
  await commercialProposalManager.loadTemplates();
  
  // Крок 4: Завершення
  updateLoadingProgress(progressBar, loadingMessage, loadingStep, 100, 'Завершення ініціалізації...');
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Оновлення прогресу завантаження
 */
function updateLoadingProgress(progressBar, loadingMessage, loadingStep, progress, step) {
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (loadingStep) loadingStep.textContent = step;
}

/**
 * Показ основного інтерфейсу
 */
async function showMainInterface(container) {
  const loadingContainer = document.getElementById('commercial-proposal-loading-container');
  const mainContent = document.getElementById('commercial-proposal-main-content');
  
  if (loadingContainer) loadingContainer.classList.add('hidden');
  if (mainContent) mainContent.classList.remove('hidden');
  
  // Ініціалізуємо UI
  await commercialProposalUI.init(mainContent);
}

/**
 * Показ помилки
 */
function showCommercialProposalError(container, message) {
  container.innerHTML = `
    <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
      <h2 class="text-2xl font-bold text-white mb-4">Помилка</h2>
      <p class="text-gray-300">${message}</p>
      <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white">
        Спробувати знову
      </button>
    </div>
  `;
}

/**
 * Очищення модуля
 */
export function cleanupCommercialProposalModule() {
  try {
    commercialProposalManager.cleanup();
    commercialProposalUI.cleanup();
    commercialProposalAIService.cleanup();
    console.log('🧹 Модуль комерційної пропозиції очищено');
  } catch (error) {
    console.error('❌ Помилка очищення модуля комерційної пропозиції:', error);
  }
}

// Експортуємо основні функції та екземпляри
export { commercialProposalManager, commercialProposalUI, commercialProposalAIService }; 