// Менеджер комерційних пропозицій
import * as firebase from '../../firebase.js';

export class CommercialProposalManager {
  constructor() {
    this.proposals = [];
    this.templates = [];
    this.currentProposal = null;
    this.isInitialized = false;
    // Коли true — не робимо жодних запитів до Firestore
    this.disableRemote = true;
  }

  /**
   * Ініціалізація менеджера
   */
  async init() {
    try {
      console.log('📋 Ініціалізація менеджера пропозицій...');
      
      // Завантажуємо збережені пропозиції
      await this.loadProposals();
      
      // Завантажуємо шаблони
      await this.loadTemplates();
      
      this.isInitialized = true;
      console.log('✅ Менеджер пропозицій успішно ініціалізовано');
      
    } catch (error) {
      console.error('❌ Помилка ініціалізації менеджера пропозицій:', error);
      throw error;
    }
  }

  /**
   * Створення нової пропозиції
   */
  async createProposal(proposalData) {
    try {
      const proposal = {
        id: this.generateId(),
        ...proposalData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        version: 1
      };

      // Зберігаємо в Firebase (якщо доступний)
      await this.saveProposal(proposal);
      
      // Додаємо в локальний масив
      this.proposals.push(proposal);
      
      console.log('✅ Нова пропозиція створена:', proposal.id);
      return proposal;
      
    } catch (error) {
      console.error('❌ Помилка створення пропозиції:', error);
      throw error;
    }
  }

  /**
   * Оновлення пропозиції
   */
  async updateProposal(proposalId, updates) {
    try {
      const proposalIndex = this.proposals.findIndex(p => p.id === proposalId);
      if (proposalIndex === -1) {
        throw new Error(`Пропозицію з ID ${proposalId} не знайдено`);
      }

      const updatedProposal = {
        ...this.proposals[proposalIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
        version: this.proposals[proposalIndex].version + 1
      };

      // Оновлюємо в Firebase
      await this.saveProposal(updatedProposal);
      
      // Оновлюємо локальний масив
      this.proposals[proposalIndex] = updatedProposal;
      
      console.log('✅ Пропозицію оновлено:', proposalId);
      return updatedProposal;
      
    } catch (error) {
      console.error('❌ Помилка оновлення пропозиції:', error);
      throw error;
    }
  }

  /**
   * Видалення пропозиції
   */
  async deleteProposal(proposalId) {
    try {
      // Видаляємо з Firebase
      await this.deleteProposalFromFirebase(proposalId);
      
      // Видаляємо з локального масиву
      this.proposals = this.proposals.filter(p => p.id !== proposalId);
      
      console.log('✅ Пропозицію видалено:', proposalId);
      
    } catch (error) {
      console.error('❌ Помилка видалення пропозиції:', error);
      throw error;
    }
  }

  /**
   * Отримання пропозиції за ID
   */
  getProposal(proposalId) {
    return this.proposals.find(p => p.id === proposalId);
  }

  /**
   * Отримання всіх пропозицій
   */
  getAllProposals() {
    return [...this.proposals];
  }

  /**
   * Отримання пропозицій за статусом
   */
  getProposalsByStatus(status) {
    return this.proposals.filter(p => p.status === status);
  }

  /**
   * Збереження пропозиції в Firebase
   */
  async saveProposal(proposal) {
    try {
      // Перевіряємо Firebase
      if (this.disableRemote || !firebase || !firebase.db) {
        console.log('⚠️ Firebase недоступний, зберігаємо локально');
        return;
      }

      const userId = firebase.auth?.currentUser?.uid;
      if (!userId) {
        console.log('⚠️ Користувач не авторизований, зберігаємо локально');
        return;
      }

      try {
        const proposalRef = firebase.doc(firebase.collection(firebase.db, 'commercialProposals'), proposal.id);
        await firebase.setDoc(proposalRef, {
          ...proposal,
          userId: userId
        });

        console.log('💾 Пропозицію збережено в Firebase:', proposal.id);
      } catch (firebaseError) {
        console.warn('⚠️ Помилка Firebase, зберігаємо локально:', firebaseError);
      }
      
    } catch (error) {
      console.error('❌ Помилка збереження пропозиції:', error);
      // Не кидаємо помилку, щоб модуль міг продовжити роботу
    }
  }

  /**
   * Видалення пропозиції з Firebase
   */
  async deleteProposalFromFirebase(proposalId) {
    try {
      // Перевіряємо Firebase
      if (this.disableRemote || !firebase || !firebase.db) {
        console.log('⚠️ Firebase недоступний, видаляємо локально');
        return;
      }

      const userId = firebase.auth?.currentUser?.uid;
      if (!userId) {
        console.log('⚠️ Користувач не авторизований, видаляємо локально');
        return;
      }

      try {
        const proposalRef = firebase.doc(firebase.collection(firebase.db, 'commercialProposals'), proposalId);
        await firebase.deleteDoc(proposalRef);

        console.log('🗑️ Пропозицію видалено з Firebase:', proposalId);
      } catch (firebaseError) {
        console.warn('⚠️ Помилка Firebase, видаляємо локально:', firebaseError);
      }
      
    } catch (error) {
      console.error('❌ Помилка видалення пропозиції:', error);
      // Не кидаємо помилку, щоб модуль міг продовжити роботу
    }
  }

  /**
   * Завантаження пропозицій з Firebase
   */
  async loadProposals() {
    try {
      // Перевіряємо, чи доступний Firebase
      if (this.disableRemote || !firebase || !firebase.db) {
        console.log('⚠️ Firebase недоступний, створюємо демо-дані');
        this.createDemoProposals();
        return;
      }

      const userId = firebase.auth?.currentUser?.uid;
      if (!userId) {
        console.log('⚠️ Користувач не авторизований, створюємо демо-дані');
        this.createDemoProposals();
        return;
      }

      try {
        const collectionRef = firebase.collection(firebase.db, 'commercialProposals');
        const hasOrderBy = typeof firebase.orderBy === 'function';
        const queryArgs = [collectionRef, firebase.where('userId', '==', userId)];
        if (hasOrderBy) {
          queryArgs.push(firebase.orderBy('createdAt', 'desc'));
        }
        const q = firebase.query(...queryArgs);
        const proposalsSnapshot = await firebase.getDocs(q);

        this.proposals = proposalsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log(`📥 Завантажено ${this.proposals.length} пропозицій з Firebase`);
      } catch (firebaseError) {
        console.warn('⚠️ Помилка Firebase, створюємо демо-дані:', firebaseError);
        this.createDemoProposals();
      }
      
    } catch (error) {
      console.error('❌ Помилка завантаження пропозицій:', error);
      this.createDemoProposals();
    }
  }

  /**
   * Створення демо-пропозицій
   */
  createDemoProposals() {
    this.proposals = [
      {
        id: 'demo-1',
        companyName: 'Демо Компанія 1',
        description: 'Приклад комерційної пропозиції для демонстрації функціоналу',
        products: [
          { name: 'Продукт A', description: 'Опис продукту A', price: '1000 грн' },
          { name: 'Послуга B', description: 'Опис послуги B', price: '500 грн' }
        ],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      },
      {
        id: 'demo-2',
        companyName: 'Демо Компанія 2',
        description: 'Ще один приклад для тестування',
        products: [
          { name: 'Продукт C', description: 'Опис продукту C', price: '2000 грн' }
        ],
        status: 'draft',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        version: 1
      }
    ];
    
    console.log(`📋 Створено ${this.proposals.length} демо-пропозицій`);
  }

  /**
   * Завантаження шаблонів
   */
  async loadTemplates() {
    try {
      // Базові шаблони
      this.templates = [
        {
          id: 'standard',
          name: 'Стандартна пропозиція',
          description: 'Базова комерційна пропозиція для B2B',
          fields: ['companyName', 'description', 'products', 'pricing', 'terms']
        },
        {
          id: 'premium',
          name: 'Преміум пропозиція',
          description: 'Розширена пропозиція з детальним описом',
          fields: ['companyName', 'description', 'products', 'pricing', 'terms', 'benefits', 'caseStudies']
        },
        {
          id: 'custom',
          name: 'Кастомна пропозиція',
          description: 'Пропозиція з унікальними полями',
          fields: ['companyName', 'description', 'customFields']
        }
      ];

      console.log(`📋 Завантажено ${this.templates.length} шаблонів`);
      
    } catch (error) {
      console.error('❌ Помилка завантаження шаблонів:', error);
    }
  }

  /**
   * Отримання шаблону за ID
   */
  getTemplate(templateId) {
    return this.templates.find(t => t.id === templateId);
  }

  /**
   * Отримання всіх шаблонів
   */
  getAllTemplates() {
    return [...this.templates];
  }

  /**
   * Генерація унікального ID
   */
  generateId() {
    return 'proposal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Експорт пропозиції в різних форматах
   */
  async exportProposal(proposalId, format = 'html') {
    try {
      const proposal = this.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Пропозицію з ID ${proposalId} не знайдено`);
      }

      switch (format) {
        case 'html':
          return this.exportToHTML(proposal);
        case 'pdf':
          return this.exportToPDF(proposal);
        case 'json':
          return this.exportToJSON(proposal);
        default:
          throw new Error(`Непідтримуваний формат експорту: ${format}`);
      }
      
    } catch (error) {
      console.error('❌ Помилка експорту пропозиції:', error);
      throw error;
    }
  }

  /**
   * Експорт в HTML
   */
  exportToHTML(proposal) {
    return `
      <!DOCTYPE html>
      <html lang="uk">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Комерційна пропозиція - ${proposal.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 40px; }
          .section { margin-bottom: 30px; }
          .product-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .price { font-size: 18px; font-weight: bold; color: #2c5aa0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Комерційна пропозиція</h1>
          <h2>${proposal.companyName}</h2>
          <p>Дата: ${new Date(proposal.createdAt).toLocaleDateString('uk-UA')}</p>
        </div>
        
        <div class="section">
          <h3>Опис пропозиції</h3>
          <p>${proposal.description}</p>
        </div>
        
        ${proposal.products ? `
        <div class="section">
          <h3>Продукти/Послуги</h3>
          ${proposal.products.map(product => `
            <div class="product-item">
              <h4>${product.name}</h4>
              <p>${product.description}</p>
              <div class="price">${product.price}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${proposal.pricing ? `
        <div class="section">
          <h3>Ціноутворення</h3>
          <p>${proposal.pricing}</p>
        </div>
        ` : ''}
        
        ${proposal.terms ? `
        <div class="section">
          <h3>Умови</h3>
          <p>${proposal.terms}</p>
        </div>
        ` : ''}
      </body>
      </html>
    `;
  }

  /**
   * Експорт в PDF (заглушка)
   */
  exportToPDF(proposal) {
    // Тут можна додати логіку конвертації в PDF
    throw new Error('Експорт в PDF ще не реалізовано');
  }

  /**
   * Експорт в JSON
   */
  exportToJSON(proposal) {
    return JSON.stringify(proposal, null, 2);
  }

  /**
   * Очищення менеджера
   */
  cleanup() {
    this.proposals = [];
    this.templates = [];
    this.currentProposal = null;
    this.isInitialized = false;
    console.log('🧹 Менеджер пропозицій очищено');
  }
}

// Створюємо глобальний екземпляр
export const commercialProposalManager = new CommercialProposalManager(); 