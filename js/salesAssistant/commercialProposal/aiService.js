// AI-сервіс для комерційних пропозицій
export class CommercialProposalAIService {
  constructor() {
    this.isInitialized = false;
    this.pricingRules = {};
    this.templates = {};
    this.markupPercentages = {
      standard: 15,    // 15% націнка для стандартних пропозицій
      premium: 25,     // 25% націнка для преміум пропозицій
      wholesale: 10,   // 10% націнка для оптових замовлень
      retail: 30       // 30% націнка для роздрібних замовлень
    };
    
    // Gemini API налаштування
    this.geminiAPIKey = null;
    // Оновлена модель за замовчуванням, щоб уникнути 404
    this.geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
    this.useGemini = false;
  }

  /**
   * Ініціалізація AI-сервісу
   */
  async init() {
    try {
      console.log('🤖 Ініціалізація AI-сервісу...');
      
      // Завантажуємо правила ціноутворення
      await this.loadPricingRules();
      
      // Завантажуємо шаблони для AI
      await this.loadAITemplates();
      
      this.isInitialized = true;
      console.log('✅ AI-сервіс успішно ініціалізовано');
      
    } catch (error) {
      console.error('❌ Помилка ініціалізації AI-сервісу:', error);
      throw error;
    }
  }

  /**
   * Ініціалізація Gemini API
   */
  async initGeminiAPI(apiKey) {
    try {
      this.geminiAPIKey = apiKey;
      this.useGemini = true;
      console.log('✅ Gemini API ініціалізовано');
      return true;
    } catch (error) {
      console.error('❌ Помилка ініціалізації Gemini API:', error);
      this.useGemini = false;
      return false;
    }
  }

  /**
   * Завантаження правил ціноутворення
   */
  async loadPricingRules() {
    // Базові правила ціноутворення
    this.pricingRules = {
      // Правила для різних типів продуктів
      productTypes: {
        'electronics': { baseMarkup: 20, volumeDiscount: true },
        'clothing': { baseMarkup: 40, volumeDiscount: true },
        'food': { baseMarkup: 25, volumeDiscount: false },
        'services': { baseMarkup: 35, volumeDiscount: false },
        'software': { baseMarkup: 50, volumeDiscount: true }
      },
      
      // Правила для різних обсягів замовлення
      volumeDiscounts: {
        'small': { minQuantity: 1, maxQuantity: 10, discount: 0 },
        'medium': { minQuantity: 11, maxQuantity: 50, discount: 5 },
        'large': { minQuantity: 51, maxQuantity: 100, discount: 10 },
        'wholesale': { minQuantity: 101, maxQuantity: 999999, discount: 15 }
      },
      
      // Правила для різних типів клієнтів
      clientTypes: {
        'new': { additionalDiscount: 0 },
        'returning': { additionalDiscount: 5 },
        'vip': { additionalDiscount: 10 },
        'wholesale': { additionalDiscount: 15 }
      }
    };
  }

  /**
   * Завантаження AI-шаблонів
   */
  async loadAITemplates() {
    this.templates = {
      // Шаблони для генерації описів
      descriptions: {
        'electronics': [
          'Високоякісна електроніка з гарантією якості та технічною підтримкою',
          'Інноваційні рішення для вашого бізнесу з найкращим співвідношенням ціна/якість',
          'Професійне обладнання для підвищення ефективності ваших процесів'
        ],
        'clothing': [
          'Стильний одяг преміум-класу з натуральних матеріалів',
          'Сучасні колекції для активних людей, що цінують комфорт та стиль',
          'Якісний одяг для вашого бізнесу з урахуванням корпоративного стилю'
        ],
        'food': [
          'Свіжі та якісні продукти з перевірених постачальників',
          'Здорове харчування для вашої команди з доставкою вчасно',
          'Натуральні продукти без штучних добавок для здорового способу життя'
        ],
        'services': [
          'Професійні послуги від досвідчених спеціалістів з гарантією якості',
          'Індивідуальний підхід до кожного клієнта з максимальною ефективністю',
          'Комплексні рішення для вашого бізнесу з постійною підтримкою'
        ]
      },
      
      // Шаблони для генерації переваг
      benefits: [
        'Економія часу та ресурсів завдяки оптимізованим процесам',
        'Підвищення якості продукції та послуг',
        'Зменшення операційних витрат',
        'Покращення конкурентних переваг',
        'Масштабування бізнесу з мінімальними ризиками'
      ],
      
      // Шаблони для генерації термінів
      terms: [
        'Гнучкі умови оплати з можливістю розстрочки',
        'Швидка доставка по всій Україні',
        'Технічна підтримка 24/7',
        'Гарантія якості на всі продукти та послуги',
        'Безкоштовна консультація та налаштування'
      ]
    };
  }

  /**
   * Автоматичний розрахунок цін
   */
  calculatePricing(products, clientType = 'new', orderVolume = 'small') {
    try {
      const calculatedProducts = products.map(product => {
        const basePrice = parseFloat(product.basePrice) || 0;
        const quantity = parseInt(product.quantity) || 1;
        
        // Визначаємо тип продукту
        const productType = this.detectProductType(product.name, product.category);
        const productRules = this.pricingRules.productTypes[productType] || this.pricingRules.productTypes['services'];
        
        // Базова націнка
        let markup = productRules.baseMarkup;
        
        // Знижка за обсяг
        const volumeDiscount = this.pricingRules.volumeDiscounts[orderVolume]?.discount || 0;
        
        // Додаткова знижка для клієнта
        const clientDiscount = this.pricingRules.clientTypes[clientType]?.additionalDiscount || 0;
        
        // Загальна знижка
        const totalDiscount = volumeDiscount + clientDiscount;
        
        // Розрахунок фінальної ціни
        const priceWithMarkup = basePrice * (1 + markup / 100);
        const finalPrice = priceWithMarkup * (1 - totalDiscount / 100);
        
        // Розрахунок загальної вартості
        const totalPrice = finalPrice * quantity;
        
        return {
          ...product,
          calculatedPrice: finalPrice.toFixed(2),
          totalPrice: totalPrice.toFixed(2),
          markup: markup,
          volumeDiscount: volumeDiscount,
          clientDiscount: clientDiscount,
          totalDiscount: totalDiscount
        };
      });
      
      // Розрахунок загальної суми
      const totalOrderAmount = calculatedProducts.reduce((sum, product) => {
        return sum + parseFloat(product.totalPrice);
      }, 0);
      
      return {
        products: calculatedProducts,
        totalAmount: totalOrderAmount.toFixed(2),
        summary: {
          totalProducts: calculatedProducts.length,
          totalQuantity: calculatedProducts.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0),
          averageDiscount: calculatedProducts.reduce((sum, p) => sum + p.totalDiscount, 0) / calculatedProducts.length
        }
      };
      
    } catch (error) {
      console.error('❌ Помилка розрахунку цін:', error);
      throw error;
    }
  }

  /**
   * Автоматичне визначення типу продукту
   */
  detectProductType(name, category) {
    const nameLower = (name || '').toLowerCase();
    const categoryLower = (category || '').toLowerCase();
    
    // Перевіряємо назву та категорію
    if (nameLower.includes('телефон') || nameLower.includes('компьютер') || nameLower.includes('ноутбук') || 
        categoryLower.includes('електроніка')) {
      return 'electronics';
    }
    
    if (nameLower.includes('футболка') || nameLower.includes('джинси') || nameLower.includes('куртка') || 
        categoryLower.includes('одяг')) {
      return 'clothing';
    }
    
    if (nameLower.includes('хліб') || nameLower.includes('молоко') || nameLower.includes('м\'ясо') || 
        categoryLower.includes('продукти')) {
      return 'food';
    }
    
    if (nameLower.includes('консультація') || nameLower.includes('обслуговування') || nameLower.includes('ремонт') || 
        categoryLower.includes('послуги')) {
      return 'services';
    }
    
    // За замовчуванням
    return 'services';
  }

  /**
   * Генерація опису пропозиції
   */
  generateDescription(companyName, products, template = 'standard') {
    try {
      const productTypes = [...new Set(products.map(p => this.detectProductType(p.name, p.category)))];
      const mainType = productTypes[0] || 'services';
      
      // Отримуємо шаблони описів
      const descriptions = this.templates.descriptions[mainType] || this.templates.descriptions['services'];
      const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
      
      // Генеруємо персоналізований опис
      let description = `Компанія "${companyName}" пропонує ${randomDescription}. `;
      
      if (products.length === 1) {
        description += `Наша пропозиція включає ${products[0].name} з найкращими умовами на ринку.`;
      } else {
        description += `Наша пропозиція включає ${products.length} позицій з найкращими умовами на ринку.`;
      }
      
      // Додаємо переваги
      const benefits = this.templates.benefits.slice(0, 2);
      description += ` Основні переваги: ${benefits.join(', ')}.`;
      
      return description;
      
    } catch (error) {
      console.error('❌ Помилка генерації опису:', error);
      return 'Якісна пропозиція від надійного постачальника з найкращими умовами на ринку.';
    }
  }

  /**
   * Генерація переваг
   */
  generateBenefits(products, clientType) {
    try {
      const baseBenefits = this.templates.benefits.slice(0, 3);
      const customBenefits = [];
      
      // Додаємо специфічні переваги залежно від типів продуктів
      const productTypes = [...new Set(products.map(p => this.detectProductType(p.name, p.category)))];
      
      if (productTypes.includes('electronics')) {
        customBenefits.push('Технічна підтримка та налаштування');
        customBenefits.push('Гарантія та сервісне обслуговування');
      }
      
      if (productTypes.includes('clothing')) {
        customBenefits.push('Індивідуальний підбір розмірів');
        customBenefits.push('Можливість брендування');
      }
      
      if (productTypes.includes('food')) {
        customBenefits.push('Свіжість та якість продуктів');
        customBenefits.push('Гнучкий графік доставки');
      }
      
      // Додаємо переваги для різних типів клієнтів
      if (clientType === 'vip') {
        customBenefits.push('Персональний менеджер');
        customBenefits.push('Пріоритетне обслуговування');
      }
      
      if (clientType === 'wholesale') {
        customBenefits.push('Спеціальні умови для оптових замовлень');
        customBenefits.push('Логістична підтримка');
      }
      
      return [...baseBenefits, ...customBenefits];
      
    } catch (error) {
      console.error('❌ Помилка генерації переваг:', error);
      return this.templates.benefits.slice(0, 3);
    }
  }

  /**
   * Генерація термінів
   */
  generateTerms(products, clientType, orderVolume) {
    try {
      const baseTerms = this.templates.terms.slice(0, 3);
      const customTerms = [];
      
      // Додаємо специфічні терміни залежно від обсягу замовлення
      if (orderVolume === 'wholesale') {
        customTerms.push('Розстрочка до 30 днів');
        customTerms.push('Безкоштовна логістика при замовленні від 100 тис. грн');
      }
      
      if (orderVolume === 'large') {
        customTerms.push('Знижка 10% при оплаті заздалегідь');
        customTerms.push('Пріоритетна доставка');
      }
      
      // Додаємо терміни для різних типів клієнтів
      if (clientType === 'vip') {
        customTerms.push('Ексклюзивні умови та пріоритетне обслуговування');
        customTerms.push('Персональна знижка 15%');
      }
      
      if (clientType === 'returning') {
        customTerms.push('Додаткова знижка 5% для постійних клієнтів');
        customTerms.push('Програма лояльності');
      }
      
      return [...baseTerms, ...customTerms];
      
    } catch (error) {
      console.error('❌ Помилка генерації термінів:', error);
      return this.templates.terms.slice(0, 3);
    }
  }

  /**
   * Генерація повної пропозиції з AI
   */
  async generateFullProposal(proposalData) {
    try {
      console.log('🤖 Генерація повної пропозиції з AI...');
      
      const {
        companyName,
        products,
        clientType = 'new',
        orderVolume = 'small',
        template = 'standard'
      } = proposalData;
      
      // Розрахунок цін
      const pricing = this.calculatePricing(products, clientType, orderVolume);
      
      // Генерація опису
      const description = this.generateDescription(companyName, products, template);
      
      // Генерація переваг
      const benefits = this.generateBenefits(products, clientType);
      
      // Генерація термінів
      const terms = this.generateTerms(products, clientType, orderVolume);
      
      // Формуємо повну пропозицію
      const fullProposal = {
        ...proposalData,
        description: description,
        benefits: benefits,
        terms: terms,
        pricing: pricing,
        generatedAt: new Date().toISOString(),
        aiVersion: '1.0'
      };
      
      console.log('✅ Повна пропозиція згенерована з AI');
      return fullProposal;
      
    } catch (error) {
      console.error('❌ Помилка генерації повної пропозиції:', error);
      throw error;
    }
  }

  /**
   * Генерація HTML для пропозиції
   */
  generateHTML(proposal) {
    try {
      const html = `
        <!DOCTYPE html>
        <html lang="uk">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Комерційна пропозиція - ${proposal.companyName}</title>
          <base href="${window.location.origin}/">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
            }
            .container { 
              max-width: 1200px; 
              margin: 0 auto; 
              padding: 20px; 
            }
            .proposal-card { 
              background: white; 
              border-radius: 20px; 
              box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
              overflow: hidden; 
              margin: 20px 0; 
            }
            .header { 
              background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); 
              color: white; 
              padding: 18px; 
              text-align: center; 
            }
            .brand {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 16px;
              margin-bottom: 16px;
            }
            .brand .logo {
              height: 36px;
              width: auto;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
              background: transparent;
            }
            .header h1 { 
              font-size: 1.8em; 
              margin-bottom: 6px; 
              font-weight: 300; 
            }
            .header h2 { 
              font-size: 1.2em; 
              margin-bottom: 10px; 
              opacity: 0.9; 
            }
            .header .date { 
              font-size: 0.95em; 
              opacity: 0.8; 
            }
            .content { 
              padding: 40px; 
            }
            .section { 
              margin-bottom: 40px; 
            }
            .section h3 { 
              color: #2c3e50; 
              font-size: 1.5em; 
              margin-bottom: 20px; 
              border-bottom: 3px solid #3498db; 
              padding-bottom: 10px; 
            }
            .description { 
              font-size: 1.1em; 
              line-height: 1.8; 
              color: #555; 
            }
            .products-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
              gap: 20px; 
              margin-top: 20px; 
            }
            .product-card { 
              border: 2px solid #ecf0f1; 
              border-radius: 15px; 
              padding: 20px; 
              transition: all 0.3s ease; 
            }
            .product-card:hover { 
              border-color: #3498db; 
              transform: translateY(-5px); 
              box-shadow: 0 10px 20px rgba(52, 152, 219, 0.2); 
            }
            .product-name { 
              font-size: 1.3em; 
              font-weight: bold; 
              color: #2c3e50; 
              margin-bottom: 10px; 
            }
            .product-category {
              background: #3498db;
              color: white;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 0.8em;
              display: inline-block;
              margin-bottom: 10px;
            }
            .product-description { 
              color: #666; 
              margin-bottom: 15px; 
            }
            .product-price { 
              font-size: 1.4em; 
              font-weight: bold; 
              color: #27ae60; 
              text-align: right; 
            }
            .product-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin: 10px 0;
              font-size: 0.9em;
              color: #666;
            }
            .benefits-list { 
              list-style: none; 
              margin-top: 20px; 
            }
            .benefits-list li { 
              padding: 10px 0; 
              border-bottom: 1px solid #ecf0f1; 
              position: relative; 
              padding-left: 30px; 
            }
            .benefits-list li:before { 
              content: '✓'; 
              position: absolute; 
              left: 0; 
              color: #27ae60; 
              font-weight: bold; 
              font-size: 1.2em; 
            }
            .pricing-summary { 
              background: #f8f9fa; 
              border-radius: 15px; 
              padding: 30px; 
              margin-top: 20px; 
            }
            .total-amount { 
              font-size: 2em; 
              font-weight: bold; 
              color: #2c3e50; 
              text-align: center; 
              margin: 20px 0; 
            }
            .terms-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
              gap: 15px; 
              margin-top: 20px; 
            }
            .term-item { 
              background: #ecf0f1; 
              padding: 15px; 
              border-radius: 10px; 
              text-align: center; 
              font-weight: 500; 
            }
            
            .discounts-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 20px;
              margin-top: 20px;
            }
            .discount-card {
              background: linear-gradient(135deg, #28a745, #20c997);
              color: white;
              padding: 25px;
              border-radius: 15px;
              box-shadow: 0 10px 25px rgba(40, 167, 69, 0.3);
              text-align: center;
            }
            .discount-header {
              margin-bottom: 20px;
            }
            .discount-badge {
              display: inline-block;
              background: rgba(255,255,255,0.2);
              padding: 8px 16px;
              border-radius: 25px;
              font-size: 1.2em;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .discount-quantity {
              display: block;
              font-size: 1.1em;
              opacity: 0.9;
            }
            .discount-details {
              text-align: left;
            }
            .price-row, .savings-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              padding: 8px 0;
              border-bottom: 1px solid rgba(255,255,255,0.2);
            }
            .savings-row {
              border-bottom: none;
              font-weight: bold;
              font-size: 1.1em;
            }
            .original-price {
              text-decoration: line-through;
              opacity: 0.8;
            }
            .discounted-price {
              color: #ffeb3b;
              font-weight: bold;
            }
            .savings-amount {
              color: #ffeb3b;
              font-weight: bold;
            }
            
            
            .footer { 
              background: #2c3e50; 
              color: white; 
              text-align: center; 
              padding: 30px; 
              margin-top: 40px; 
            }
            /* ai badge removed by request */
            .actions {
              margin-top: 16px;
            }
            .download-btn {
              display: inline-block;
              background: #e83e8c;
              color: white;
              border: none;
              padding: 10px 18px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
            }
            .download-btn:hover { background: #d63384; }
            @media (max-width: 768px) { 
              .container { padding: 10px; } 
              .header { padding: 20px; } 
              .content { padding: 20px; } 
              .products-grid { grid-template-columns: 1fr; } 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="proposal-card">
              <div class="header">
                <div class="brand">
                  <img src="Lookfort_logo_new.svg" alt="Company Logo" class="logo"/>
                </div>
                <h1>Комерційна пропозиція</h1>
                <h2>${proposal.companyName}</h2>
                <div class="date">Дата: ${new Date(proposal.createdAt || new Date()).toLocaleDateString('uk-UA')}</div>
                
                <div class="actions">
                  <button id="downloadPdfBtn" class="download-btn">Завантажити PDF</button>
                </div>
              </div>
              
              <div class="content">
                <div class="section">
                  <h3>Опис пропозиції</h3>
                  <div class="description">${proposal.description}</div>
                </div>
                
                ${proposal.products && proposal.products.length > 0 ? `
                <div class="section">
                  <h3>Продукти та послуги (${proposal.products.length} позицій)</h3>
                  <div class="products-grid">
                    ${proposal.products.map(product => `
                      <div class="product-card">
                        <div class="product-category">${product.category || 'Товар'}</div>
                        <div class="product-name">${product.name}</div>
                        <div class="product-details">
                          <div>Мін. кількість: ${product.minQuantity || 1} ${product.unit || 'шт'}</div>
                          <div>Макс. кількість: ${product.maxQuantity || 1} ${product.unit || 'шт'}</div>
                        </div>
                        <div class="product-price">
                          ${product.calculatedPrice ? `${product.calculatedPrice} грн` : (product.basePrice ? `${product.basePrice} грн` : 'Ціна за запитом')}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
                ` : ''}
                
                ${proposal.calculations && proposal.calculations.discountExamples && proposal.calculations.discountExamples.length > 0 ? `
                <div class="section">
                  <h3>Система знижок та вигоди</h3>
                  <div class="discounts-grid">
                    ${proposal.calculations.discountExamples.map(discount => `
                      <div class="discount-card">
                        <div class="discount-header">
                          <span class="discount-badge">-${discount.discountPercent}%</span>
                          <span class="discount-quantity">від ${discount.quantity} шт</span>
                        </div>
                        <div class="discount-details">
                          <div class="price-row">
                            <span>Ціна без знижки:</span>
                            <span class="original-price">${discount.originalPrice.toFixed(2)} грн</span>
                          </div>
                          <div class="price-row">
                            <span>Ціна зі знижкою:</span>
                            <span class="discounted-price">${discount.discountedPrice.toFixed(2)} грн</span>
                          </div>
                          <div class="savings-row">
                            <span>Ваша вигода:</span>
                            <span class="savings-amount">${discount.savings.toFixed(2)} грн</span>
                          </div>
                          ${discount.description ? `<div style="text-align: center; margin-top: 10px; font-size: 0.9em; opacity: 0.8;">${discount.description}</div>` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
                ` : ''}
                
                ${proposal.benefits && proposal.benefits.length > 0 ? `
                <div class="section">
                  <h3>Переваги співпраці</h3>
                  <ul class="benefits-list">
                    ${proposal.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
                  </ul>
                </div>
                ` : ''}
                
                ${proposal.pricing && proposal.pricing.totalAmount ? `
                <div class="section">
                  <h3>Ціноутворення</h3>
                  <div class="pricing-summary">
                    <div class="total-amount">Загальна сума: ${proposal.pricing.totalAmount} грн</div>
                    <div style="text-align: center; color: #666;">
                      Кількість позицій: ${proposal.pricing.summary?.totalProducts || 0} | 
                      Загальна кількість: ${proposal.pricing.summary?.totalQuantity || 0}
                    </div>
                  </div>
                </div>
                ` : ''}
                
                ${proposal.terms && proposal.terms.length > 0 ? `
                <div class="section">
                  <h3>Умови співпраці</h3>
                  <div class="terms-grid">
                    ${proposal.terms.map(term => `
                      <div class="term-item">${term}</div>
                    `).join('')}
                  </div>
                </div>
                ` : ''}
              </div>
              
              <div class="footer">
                <p>Дякуємо за інтерес до нашої пропозиції!</p>
                <p>Для отримання додаткової інформації звертайтеся до менеджера</p>
              </div>
            </div>
          </div>
        </body>
        <script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"></script>
        <script>
          (function(){
            function loadPdfLibs(callback){
              if (window.html2pdf || (window.jspdf && window.jspdf.jsPDF && window.html2canvas)) {
                callback();
                return;
              }
              var s = document.createElement('script');
              s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
              s.onload = callback;
              s.onerror = function(){ callback(new Error('failed')); };
              document.body.appendChild(s);
            }

            function exportAsPdf(){
              var content = document.querySelector('.proposal-card');
              if (!content) return;
              var fileCompany = ${JSON.stringify((proposal.companyName || 'proposal'))};
              var safeName = String(fileCompany).replace(/[^a-z0-9\-_]+/gi, '_');

              if (window.html2pdf) {
                // Use html2pdf if available
                var width = content.scrollWidth || content.offsetWidth || 794;
                var height = content.scrollHeight || 1123;
                var opt = {
                  margin: 0,
                  filename: 'proposal_' + safeName + '.pdf',
                  image: { type: 'jpeg', quality: 0.98 },
                  html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
                  jsPDF: { unit: 'px', format: [width, height], orientation: 'portrait' },
                  pagebreak: { mode: ['avoid-all'] }
                };
                window.html2pdf().set(opt).from(content).save();
                return;
              }

              var jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
              if (jsPDF && typeof window.html2canvas === 'function') {
                window.html2canvas(content, { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' })
                  .then(function(canvas){
                    var imgData = canvas.toDataURL('image/jpeg', 0.98);
                    var pdf = new jsPDF('p', 'px', [canvas.width, canvas.height]);
                    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
                    pdf.save('proposal_' + safeName + '.pdf');
                  })
                  .catch(function(){ window.print(); });
                return;
              }

              // As a last resort
              window.print();
            }

            var btn = document.getElementById('downloadPdfBtn');
            if (!btn) return;
            btn.addEventListener('click', function(){
              loadPdfLibs(function(){
                exportAsPdf();
              });
            });
          })();
        </script>
        </html>
      `;
      
      return html;
      
    } catch (error) {
      console.error('❌ Помилка генерації HTML:', error);
      throw error;
    }
  }

  /**
   * Парсинг тексту менеджера
   */
  parseManagerText(text) {
    const result = {
      products: [],
      pricing: {},
      discounts: [],
      calculations: {}
    };
    
    // Розбиваємо на рядки
    const lines = text.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Шукаємо товари (рядки з цифрами та цінами)
      if (trimmedLine.match(/^\d+\.\s*.*\d+.*грн/)) {
        const product = this.parseProductLine(trimmedLine);
        if (product) {
          result.products.push(product);
        }
      }
      
      // Шукаємо знижки
      if (trimmedLine.toLowerCase().includes('знижка') || trimmedLine.toLowerCase().includes('скидка')) {
        const discount = this.parseComplexDiscounts(trimmedLine);
        if (discount && Array.isArray(discount)) {
          result.discounts.push(...discount);
        }
      }
    });
    
    // Розраховуємо вигоди та знижки
    result.calculations = this.calculateDiscountsAndSavings(result.products, result.discounts);
    
    return result;
  }

  /**
   * Парсинг складних знижок
   */
  parseComplexDiscounts(line) {
    try {
      const discounts = [];
      
      // Шукаємо комбінації знижок
      // Приклад: "від 5 шт знижка 10%, від 10 шт знижка 15%, від 20 шт знижка 25%"
      const discountPattern = /(?:від\s+)?(\d+)\s+(?:шт|штук?|ящик?|ящиків?)\s+знижка\s+(\d+)%/gi;
      let match;
      
      while ((match = discountPattern.exec(line)) !== null) {
        discounts.push({
          minQuantity: parseInt(match[1]),
          discountPercent: parseInt(match[2]),
          type: 'quantity'
        });
      }
      
      // Сортуємо за кількістю (від меншої до більшої)
      discounts.sort((a, b) => a.minQuantity - b.minQuantity);
      
      return discounts;
    } catch (error) {
      console.warn('⚠️ Не вдалося розібрати складні знижки:', line);
      return [];
    }
  }

  /**
   * Парсинг рядка з товаром
   */
  parseProductLine(line) {
    try {
      // Приклад: "1.Стакан КУПОЛЬНЫЙ 420мл РЕТ LF (50шт/1000шт) основна ціна 2,92 грн"
      const match = line.match(/^\d+\.\s*(.+?)\s*\((\d+)шт\/(\d+)шт\)\s*.*?(\d+[,.]?\d*)\s*грн/);
      
      if (match) {
        return {
          name: match[1].trim(),
          minQuantity: parseInt(match[2]),
          maxQuantity: parseInt(match[3]),
          basePrice: parseFloat(match[4].replace(',', '.')),
          unit: 'шт',
          category: 'Стакани'
        };
      }
      
      // Спрощений парсинг, якщо не вдалося розібрати складну структуру
      const simpleMatch = line.match(/^\d+\.\s*(.+?)\s*(\d+[,.]?\d*)\s*грн/);
      if (simpleMatch) {
        return {
          name: simpleMatch[1].trim(),
          basePrice: parseFloat(simpleMatch[2].replace(',', '.')),
          unit: 'шт',
          category: 'Товар'
        };
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Не вдалося розібрати рядок товару:', line);
      return null;
    }
  }

  /**
   * Розрахунок знижок та вигод для багатьох товарів
   */
  calculateDiscountsAndSavings(products, discounts) {
    const calculations = {
      totalBasePrice: 0,
      totalWithDiscounts: 0,
      savings: 0,
      discountExamples: [],
      productSummary: {}, // Додаємо підсумок по товарах
      totalProducts: products.length
    };
    
    // Розраховуємо базову вартість по кожному товару
    products.forEach(product => {
      calculations.totalBasePrice += product.basePrice;
      
      // Групуємо товари по категоріях
      if (!calculations.productSummary[product.category]) {
        calculations.productSummary[product.category] = {
          count: 0,
          totalPrice: 0,
          items: []
        };
      }
      calculations.productSummary[product.category].count++;
      calculations.productSummary[product.category].totalPrice += product.basePrice;
      calculations.productSummary[product.category].items.push(product.name);
    });
    
    // Розраховуємо приклади знижок для різних комбінацій
    if (discounts && discounts.length > 0) {
      discounts.forEach(discount => {
        if (discount.type === 'quantity') {
          // Для кожного рівня знижки показуємо приклад
          const exampleQuantity = discount.minQuantity;
          const discountMultiplier = (100 - discount.discountPercent) / 100;
          
          // Розрахунок для всіх товарів разом
          const examplePrice = calculations.totalBasePrice * exampleQuantity * discountMultiplier;
          const savings = calculations.totalBasePrice * exampleQuantity * (discount.discountPercent / 100);
          
          calculations.discountExamples.push({
            quantity: exampleQuantity,
            discountPercent: discount.discountPercent,
            originalPrice: calculations.totalBasePrice * exampleQuantity,
            discountedPrice: examplePrice,
            savings: savings,
            description: `При закупівлі ${exampleQuantity} шт кожного товару`
          });
        }
      });
    }
    
    return calculations;
  }

  /**
   * Аналіз тексту менеджера з вибором методу
   */
  async analyzeManagerText(rawText, useGemini = false) {
    try {
      console.log('🔍 Аналіз тексту менеджера...');
      
      let parsedData;
      
      if (useGemini && this.geminiAPIKey) {
        console.log('🤖 Використовуємо Gemini API для аналізу...');
        parsedData = await this.analyzeWithGemini(rawText);
      } else {
        console.log('📝 Використовуємо звичайний парсинг...');
        parsedData = this.parseManagerText(rawText);
      }
      
      // Перевіряємо, чи отримали ми валідні дані
      if (!parsedData) {
        console.warn('⚠️ parsedData is undefined or null after analysis. Creating default structure.');
        parsedData = {
          products: [],
          pricing: {},
          discounts: [],
          calculations: {}
        };
      }
      
      // Створюємо структуровану пропозицію з перевіркою всіх полів
      const structuredProposal = {
        companyName: parsedData.companyName || 'Компанія',
        products: parsedData.products || [],
        pricing: parsedData.pricing || {},
        discounts: parsedData.discounts || [],
        calculations: parsedData.calculations || {},
        description: this.generateDescriptionFromText(rawText),
        benefits: this.generateBenefitsFromText(rawText),
        terms: this.generateTermsFromText(rawText),
        aiGenerated: true,
        aiVersion: useGemini ? '3.0 (Gemini)' : '2.0',
        generatedAt: new Date().toISOString()
      };
      
      console.log('✅ Текст менеджера проаналізовано та структуровано');
      return structuredProposal;
      
    } catch (error) {
      console.error('❌ Помилка аналізу тексту менеджера:', error);
      // Повертаємо базову структуру замість того, щоб кидати помилку
      return {
        companyName: 'Компанія',
        products: [],
        pricing: {},
        discounts: [],
        calculations: {},
        description: 'Помилка аналізу тексту. Будь ласка, перевірте формат введення.',
        benefits: ['Базові умови'],
        terms: ['Стандартні умови'],
        aiGenerated: false,
        aiVersion: 'Error',
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Аналіз тексту з Gemini API
   */
  async analyzeWithGemini(rawText) {
    try {
      if (!this.geminiAPIKey) {
        throw new Error('Gemini API ключ не налаштовано');
      }

      const prompt = `
      Проаналізуй наступний текст комерційної пропозиції та витягни структуровану інформацію:

      "${rawText}"

      Поверни JSON з такою структурою:
      {
        "companyName": "назва компанії або 'Компанія' якщо не вказано",
        "products": [
          {
            "name": "назва товару",
            "basePrice": число,
            "minQuantity": число,
            "maxQuantity": число,
            "unit": "одиниця виміру",
            "category": "категорія"
          }
        ],
        "discounts": [
          {
            "minQuantity": число,
            "discountPercent": число,
            "type": "quantity"
          }
        ]
      }
      `;

      const response = await fetch(`${this.geminiEndpoint}?key=${this.geminiAPIKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      const data = await response.json();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        // Об'єднуємо всі частини відповіді в один текст
        const parts = data.candidates[0].content.parts || [];
        const aiResponse = parts.map(p => p.text || '').join('\n');

        // Парсимо JSON відповідь з урахуванням можливих ```json блоків
        const parsedData = this.extractJsonFromText(aiResponse);
        if (parsedData) {
          return this.processGeminiResponse(parsedData);
        }

        console.warn('⚠️ Некоректний JSON від Gemini. Повертаємось до звичайного парсингу.');
        return this.parseManagerText(rawText);
      }

      // If Gemini returns an invalid structure, fall back to regular parsing
      console.warn('⚠️ Некоректна відповідь від Gemini API, повернення до звичайного парсингу.');
      return this.parseManagerText(rawText);

    } catch (error) {
      console.error('❌ Помилка аналізу з Gemini:', error);
      // Fallback to regular parsing in case of API errors
      return this.parseManagerText(rawText);
    }
  }

  /**
   * Витягує JSON з тексту (підтримує ```json блоки та змішаний текст)
   */
  extractJsonFromText(text) {
    if (!text || typeof text !== 'string') return null;
    // 1) Пряма спроба
    try {
      return JSON.parse(text);
    } catch (_) {}

    // 2) Блок коду ```json ... ```
    const fenceMatch = text.match(/```\s*json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      const fenced = fenceMatch[1].trim();
      try {
        return JSON.parse(fenced);
      } catch (_) {}
    }

    // 3) Евристика: перший { до останнього }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch (_) {}
    }

    return null;
  }

  /**
   * Обробка відповіді від Gemini API
   */
  processGeminiResponse(geminiData) {
    try {
      const result = {
        companyName: geminiData.companyName || 'Компанія',
        products: [],
        pricing: {},
        discounts: [],
        calculations: {}
      };

      // Обробляємо товари
      if (geminiData.products && Array.isArray(geminiData.products)) {
        result.products = geminiData.products.map(product => ({
          name: product.name || 'Товар',
          basePrice: product.basePrice || 0,
          minQuantity: product.minQuantity || 1,
          maxQuantity: product.maxQuantity || 1000,
          unit: product.unit || 'шт',
          category: product.category || 'Товар'
        }));
      }

      // Обробляємо знижки
      if (geminiData.discounts && Array.isArray(geminiData.discounts)) {
        result.discounts = geminiData.discounts.map(discount => ({
          minQuantity: discount.minQuantity || 1,
          discountPercent: discount.discountPercent || 0,
          type: discount.type || 'quantity'
        }));
      }

      // Розраховуємо вигоди та знижки
      result.calculations = this.calculateDiscountsAndSavings(result.products, result.discounts);

      return result;

    } catch (error) {
      console.error('❌ Помилка обробки відповіді Gemini:', error);
      // Fallback to regular parsing
      return this.parseManagerText(geminiData.rawText || '');
    }
  }

  /**
   * Генерація опису з тексту менеджера
   */
  generateDescriptionFromText(text) {
    if (text.toLowerCase().includes('стакан')) {
      return 'Пропозиція по цінам товарів - стакани різних об\'ємів та конфігурацій. Включає гнучкі умови закупівлі та систему знижок для великих обсягів.';
    }
    
    return 'Спеціальна комерційна пропозиція з вигідною системою знижок та розрахунками вигоди для клієнта.';
  }

  /**
   * Генерація переваг з тексту менеджера
   */
  generateBenefitsFromText(text) {
    const benefits = [];
    
    if (text.toLowerCase().includes('знижка')) {
      benefits.push('Система прогресивних знижок для великих обсягів');
      benefits.push('Автоматичний розрахунок вигоди при закупівлі');
    }
    
    if (text.toLowerCase().includes('стакан')) {
      benefits.push('Широкий асортимент стаканів різних об\'ємів');
      benefits.push('Якісні матеріали та надійна конструкція');
    }
    
    benefits.push('Гнучкі умови оплати та доставки');
    benefits.push('Професійна консультація по вибору товару');
    
    return benefits;
  }

  /**
   * Генерація умов з тексту менеджера
   */
  generateTermsFromText(text) {
    const terms = [];
    
    if (text.toLowerCase().includes('знижка')) {
      terms.push('Знижки діють при закупівлі від вказаної кількості');
      terms.push('Розрахунок знижок виконується автоматично');
    }
    
    terms.push('Мінімальна сума замовлення - за домовленістю');
    terms.push('Термін виконання замовлення - 1-3 робочі дні');
    terms.push('Оплата: передоплата або за домовленістю');
    
    return terms;
  }

  /**
   * Очищення AI-сервісу
   */
  cleanup() {
    this.isInitialized = false;
    this.pricingRules = {};
    this.templates = {};
    console.log('🧹 AI-сервіс очищено');
  }
}

// Створюємо глобальний екземпляр
export const commercialProposalAIService = new CommercialProposalAIService(); 