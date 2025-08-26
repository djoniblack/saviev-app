// js/focus.js
import * as firebase from './firebase.js';
import { hasPermission, loadClientManagerDirectory } from './main.js';

let focusClientLinks = null;
async function loadFocusClientLinks() {
  if (focusClientLinks) return focusClientLinks;
  const res = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
  const arr = await res.json();
  focusClientLinks = {};
  arr.forEach(c => { focusClientLinks[c['Клиент.Код']] = c['посилання']; });
  return focusClientLinks;
}

function showCreateTaskModal(container, onCreated) {
    // Создаем модалку
    let modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    modal.innerHTML = `
      <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-xl relative flex flex-col animate-fade-in">
        <button id="close-create-task" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
        <h2 class="text-2xl font-bold text-white mb-6">Створення фокусної задачі</h2>
        <form id="focusTaskForm" class="space-y-4">
          <div>
            <label class="block text-gray-300 mb-1">Назва задачі *</label>
            <input type="text" id="focusTaskTitle" class="dark-input w-full" required maxlength="100">
          </div>
          <div>
            <label class="block text-gray-300 mb-1">Опис</label>
            <textarea id="focusTaskDesc" class="dark-input w-full" rows="2"></textarea>
          </div>
          <div>
            <label class="block text-gray-300 mb-1">Список товарів (номенклатура, по одному на рядок)</label>
            <textarea id="focusTaskProducts" class="dark-input w-full" rows="4" placeholder="Наприклад:\nСтакан 360мл\nКришка купол"></textarea>
          </div>
          <div>
            <label class="block text-gray-300 mb-1">Параметри аналізу</label>
            <div class="flex flex-col gap-2">
              <label><input type="checkbox" id="param1" checked> Клієнти, які купували ці товари в минулому періоді, а в цьому — ні</label>
              <label><input type="checkbox" id="param2"> Похожие клієнти, які ніколи не купували
                <span id="param2-options" style="display:none; margin-left:1em;">
                  <label class="ml-2"><input type="checkbox" id="param2sphere" checked> По сфері</label>
                  <label class="ml-2"><input type="checkbox" id="param2similar"> По схожим товарам</label>
                </span>
              </label>
              <label><input type="checkbox" id="param3"> Клієнти, які беруть X, але не беруть товари з фокуса
                <span id="param3-xblock" style="display:none; margin-left:1em;">
                  <label class="block text-gray-400 mt-2">Список товарів X (по одному на рядок):</label>
                  <textarea id="focusTaskXProducts" class="dark-input w-full" rows="2" placeholder="Наприклад:\nМолоко\nСироп"></textarea>
                </span>
              </label>
            </div>
          </div>
          <div class="flex gap-4 mb-4">
            <div>
              <label class="block text-gray-300 mb-1">Початок дії задачі</label>
              <input type="date" id="focusTaskPeriodFrom" class="dark-input w-full">
            </div>
            <div>
              <label class="block text-gray-300 mb-1">Кінець дії задачі</label>
              <input type="date" id="focusTaskPeriodTo" class="dark-input w-full">
            </div>
          </div>
          <div>
            <label class="block text-gray-300 mb-1">Період аналізу</label>
            <select id="focusTaskPeriod" class="dark-input w-full">
              <option value="month">Місяць</option>
              <option value="quarter">Квартал</option>
              <option value="custom">Інший</option>
            </select>
          </div>
          <div class="flex gap-4 mb-4" id="analysisDatesBlock" style="display:none;">
            <div>
              <label class="block text-gray-300 mb-1">Початок поточного періоду аналізу</label>
              <input type="date" id="focusTaskAnalysisFrom" class="dark-input w-full">
            </div>
            <div>
              <label class="block text-gray-300 mb-1">Кінець поточного періоду аналізу</label>
              <input type="date" id="focusTaskAnalysisTo" class="dark-input w-full">
            </div>
          </div>
          <div class="flex gap-4 mb-4" id="prevAnalysisDatesBlock" style="display:none;">
            <div>
              <label class="block text-gray-300 mb-1">Початок попереднього періоду аналізу</label>
              <input type="date" id="focusTaskPrevAnalysisFrom" class="dark-input w-full">
            </div>
            <div>
              <label class="block text-gray-300 mb-1">Кінець попереднього періоду аналізу</label>
              <input type="date" id="focusTaskPrevAnalysisTo" class="dark-input w-full">
            </div>
          </div>
          <div class="flex justify-end gap-4 mt-6">
            <button type="button" id="cancelCreateTask" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Скасувати</button>
            <button type="submit" class="px-6 py-2 bg-orange-600 text-white font-semibold rounded hover:bg-orange-700">Зберегти</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    // Добавить скролл и ограничение высоты для модалки
    const modalContent = modal.querySelector('.bg-gray-900.rounded-2xl.shadow-2xl.p-8');
    if (modalContent) {
      modalContent.style.maxHeight = '90vh';
      modalContent.style.overflowY = 'auto';
    }
    document.getElementById('close-create-task').onclick = close;
    document.getElementById('cancelCreateTask').onclick = close;
    function close() { 
        try {
            if (modal && modal.parentNode) {
                modal.remove();
            } else {
                console.warn('Modal not found or already removed');
            }
        } catch (error) {
            console.error('Error closing modal:', error);
        }
    }
    // Логика отображения опций для параметров
    const param2 = document.getElementById('param2');
    const param2options = document.getElementById('param2-options');
    param2.onchange = () => { param2options.style.display = param2.checked ? '' : 'none'; };
    param2options.style.display = param2.checked ? '' : 'none';
    const param3 = document.getElementById('param3');
    const param3xblock = document.getElementById('param3-xblock');
    param3.onchange = () => { param3xblock.style.display = param3.checked ? '' : 'none'; };
    param3xblock.style.display = param3.checked ? '' : 'none';
    // === showCreateTaskModal: динамическое отображение дат анализа ===
    const periodSelect = document.getElementById('focusTaskPeriod');
    const analysisDatesBlock = document.getElementById('analysisDatesBlock');
    const prevAnalysisDatesBlock = document.getElementById('prevAnalysisDatesBlock');
    function updatePeriodFields() {
      const isCustom = periodSelect.value === 'custom';
      analysisDatesBlock.style.display = isCustom ? '' : 'none';
      prevAnalysisDatesBlock.style.display = isCustom ? '' : 'none';
    }
    periodSelect.onchange = updatePeriodFields;
    updatePeriodFields();
    document.getElementById('focusTaskForm').onsubmit = async (e) => {
        e.preventDefault();
        
        // Проверяем права на создание задач
        if (!window.hasPermission || !window.hasPermission('focus_create')) {
            alert('У вас немає прав для створення фокусних задач!');
            return;
        }
        
        const title = document.getElementById('focusTaskTitle').value.trim();
        const description = document.getElementById('focusTaskDesc').value.trim();
        const products = document.getElementById('focusTaskProducts').value.split('\n').map(s=>s.trim()).filter(Boolean);
        const period = document.getElementById('focusTaskPeriod').value;
        const params = {
            param1: document.getElementById('param1').checked,
            param2: param2.checked,
            param2sphere: param2.checked ? document.getElementById('param2sphere').checked : false,
            param2similar: param2.checked ? document.getElementById('param2similar').checked : false,
            param3: param3.checked,
            analysisFrom: period === 'custom' ? document.getElementById('focusTaskAnalysisFrom').value : '',
            analysisTo: period === 'custom' ? document.getElementById('focusTaskAnalysisTo').value : '',
            prevAnalysisFrom: period === 'custom' ? document.getElementById('focusTaskPrevAnalysisFrom').value : '',
            prevAnalysisTo: period === 'custom' ? document.getElementById('focusTaskPrevAnalysisTo').value : ''
        };
        const xProducts = param3.checked ? document.getElementById('focusTaskXProducts').value.split('\n').map(s=>s.trim()).filter(Boolean) : [];
        const periodFrom = document.getElementById('focusTaskPeriodFrom').value;
        const periodTo = document.getElementById('focusTaskPeriodTo').value;
        if (period === 'custom' && (!periodFrom || !periodTo || !params.analysisFrom || !params.analysisTo || !params.prevAnalysisFrom || !params.prevAnalysisTo)) {
            alert('Вкажіть всі дати для аналізу!');
            return;
        }
        if (!title) {
            alert('Вкажіть назву задачі!');
            return;
        }
        // --- Считаем clientsSnapshot ---
        let clientsSnapshot = [];
        if (params.param1 || params.param2 || params.param3) {
          let c1 = [], c2 = [], c3 = [];
          if (params.param1) c1 = (await getFocusClientsParam1({products, params}, period)).map(c => ({...c, params: ['param1']}));
          if (params.param2) c2 = (await getFocusClientsParam2({products, params})).map(c => ({...c, params: ['param2']}));
          if (params.param3) c3 = (await getFocusClientsParam3({products, params, xProducts})).map(c => ({...c, params: ['param3']}));
          const byCode = {};
          [...c1, ...c2, ...c3].forEach(c => {
            if (!byCode[c.code]) {
              byCode[c.code] = { code: c.code, name: c.name, manager: c.manager, sphere: c.sphere, link: c.link, params: c.params };
            } else {
              // Если клиент уже есть, добавляем параметр, если его ещё нет
              c.params.forEach(p => {
                if (!byCode[c.code].params.includes(p)) byCode[c.code].params.push(p);
              });
            }
          });
          clientsSnapshot = Object.values(byCode);
        }
        // Логирование перед сохранением
        const companyId = window.state.currentCompanyId;
        const userId = window.state.currentUserId;
        console.log('[createFocusTask] companyId:', companyId, 'userId:', userId, {
            title, description, products, params, xProducts, period, periodFrom, periodTo, clientsSnapshot
        });
        // Сохраняем в Firestore
        try {
            const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks');
            const docRef = await firebase.addDoc(tasksRef, {
                title,
                description,
                products,
                params,
                xProducts,
                period,
                periodFrom,
                periodTo,
                createdAt: new Date(),
                createdBy: userId,
                clientsSnapshot
            });
            console.log('[createFocusTask] Успешно создана задача:', docRef.id);
            // После создания задачи сразу обновляем страницу/список задач
            try {
                close();
                if (onCreated) onCreated(); // initFocusPage(container) вызывается в onCreated
            } catch (error) {
                console.error('Error after task creation:', error);
                // Показываем сообщение об успехе даже если есть ошибка закрытия
                alert('Задачу успішно створено!');
                if (onCreated) onCreated();
            }
        } catch (e) {
            console.error('[createFocusTask] Ошибка при создании задачи:', e);
            alert('Помилка збереження: ' + (e.message || e));
        }
    };
}

// --- Функция для обновления старых задач ---
window.updateOldFocusTask = async function(taskId) {
  try {
    console.log('🔄 Обновление старой задачи:', taskId);
    
    // Получаем задачу
    const companyId = window.state.currentCompanyId;
    const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks', taskId);
    const taskDoc = await firebase.getDoc(taskRef);
    
    if (!taskDoc.exists()) {
      alert('Задача не знайдена!');
      return;
    }
    
    const task = taskDoc.data();
    
    // Показываем прогресс
    const progressDiv = document.createElement('div');
    progressDiv.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
    progressDiv.innerHTML = `
      <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h3 class="text-xl font-bold text-white mb-2">Оновлення задачі</h3>
          <p class="text-gray-300">Формування списку клієнтів...</p>
        </div>
      </div>
    `;
    document.body.appendChild(progressDiv);
    
    // Формируем clientsSnapshot
    let clientsSnapshot = [];
    if (task.params && (task.params.param1 || task.params.param2 || task.params.param3)) {
      let c1 = [], c2 = [], c3 = [];
      if (task.params.param1) c1 = (await getFocusClientsParam1({products: task.products, params: task.params}, task.period)).map(c => ({...c, params: ['param1']}));
      if (task.params.param2) c2 = (await getFocusClientsParam2({products: task.products, params: task.params})).map(c => ({...c, params: ['param2']}));
      if (task.params.param3) c3 = (await getFocusClientsParam3({products: task.products, params: task.params, xProducts: task.xProducts})).map(c => ({...c, params: ['param3']}));
      
      const byCode = {};
      [...c1, ...c2, ...c3].forEach(c => {
        if (!byCode[c.code]) {
          byCode[c.code] = { code: c.code, name: c.name, manager: c.manager, sphere: c.sphere, link: c.link, params: c.params };
        } else {
          c.params.forEach(p => {
            if (!byCode[c.code].params.includes(p)) byCode[c.code].params.push(p);
          });
        }
      });
      clientsSnapshot = Object.values(byCode);
    }
    
    // Обновляем задачу
    await firebase.updateDoc(taskRef, {
      clientsSnapshot: clientsSnapshot,
      updatedAt: new Date()
    });
    
    // Убираем прогресс
    progressDiv.remove();
    
    // Показываем успех
    alert(`✅ Задача оновлена! Знайдено ${clientsSnapshot.length} клієнтів.`);
    
    // Обновляем страницу
    location.reload();
    
  } catch (error) {
    console.error('❌ Ошибка обновления задачи:', error);
    alert('Помилка оновлення задачі: ' + error.message);
  }
};

// --- Новый способ хранения пометок через Firestore ---
export async function getFocusNotes(taskId) {
    const companyId = window.state.currentCompanyId;
    const notesRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks', taskId, 'notes');
    const snapshot = await firebase.getDocs(notesRef);
    const notes = {};
    snapshot.docs.forEach(doc => { notes[doc.id] = doc.data(); });
    return notes;
}

export async function setFocusNote(taskId, clientCode, note) {
    const companyId = window.state.currentCompanyId;
    // Логируем все параметры
    console.log('[setFocusNote] companyId:', companyId, 'taskId:', taskId, 'clientCode:', clientCode, 'note:', note);
    if (!clientCode || typeof note !== 'object' || !companyId || !taskId) {
        console.error('[setFocusNote] Некорректные данные для сохранения note', {companyId, taskId, clientCode, note});
        return;
    }
    // Проверяем поля note на undefined/null/NaN
    Object.keys(note).forEach(k => {
        if (note[k] === undefined || note[k] === null || (typeof note[k] === 'number' && isNaN(note[k]))) {
            console.warn(`[setFocusNote] Удаляю некорректное поле note[${k}]`, note[k]);
            delete note[k];
        }
    });
    try {
        const noteRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks', taskId, 'notes', clientCode);
        await firebase.setDoc(noteRef, note, { merge: true });
        console.log('[setFocusNote] Успешно сохранено в Firestore:', noteRef.path, note);
    } catch (e) {
        console.error('[setFocusNote] Ошибка при сохранении в Firestore:', e, {companyId, taskId, clientCode, note});
    }
}

async function getAllSalesData() {
    // Получаем все продажи компании (используем те же данные, что и salesAssistant)
    if (window._focusSalesCache) return window._focusSalesCache;
    const [dataRes, dataJulyRes] = await Promise.all([
        fetch('модуль помічник продажу/data.json'),
        fetch('https://fastapi.lookfort.com/nomenclature.analysis')
    ]);
    const data = await dataRes.json();
    const dataJuly = await dataJulyRes.json();
    window._focusSalesCache = data.concat(dataJuly);
    return window._focusSalesCache;
}

function renderFocusClientsTable(taskId, clients, notes) {
    return `
    <table class="min-w-full text-sm bg-gray-800 rounded-lg overflow-hidden">
      <thead><tr class="bg-gray-700 text-gray-300">
        <th class="px-3 py-2">Клієнт</th>
        <th class="px-3 py-2">Сфера</th>
        <th class="px-3 py-2">Сума</th>
        <th class="px-3 py-2">Остання покупка</th>
        <th class="px-3 py-2">Дата комунікації</th>
        <th class="px-3 py-2">Пропозиція</th>
        <th class="px-3 py-2">Коментар</th>
      </tr></thead>
      <tbody>
        ${clients.map(c => {
            const n = notes[c.code] || {};
            const clientName = c.link ? `<a href="${c.link}" target="_blank" class="text-blue-400 underline hover:text-blue-600">${c.name}</a>` : c.name;
            return `<tr>
              <td class="px-3 py-2 text-gray-200">${clientName}</td>
              <td class="px-3 py-2 text-gray-400">${c.sphere||''}</td>
              <td class="px-3 py-2 text-green-400">${c.sum?.toFixed(2)||''}</td>
              <td class="px-3 py-2">${c.lastDate ? new Date(c.lastDate).toLocaleDateString('uk-UA') : ''}</td>
              <td class="px-3 py-2"><input type="date" value="${n.commDate||''}" data-cid="${c.code}" class="focus-commdate bg-gray-900 text-gray-200 rounded px-2 py-1"></td>
              <td class="px-3 py-2 text-center"><input type="checkbox" data-cid="${c.code}" class="focus-done" ${n.done?'checked':''}></td>
              <td class="px-3 py-2"><input type="text" value="${n.comment||''}" data-cid="${c.code}" class="focus-comment bg-gray-900 text-gray-200 rounded px-2 py-1 w-full"></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    `;
}

async function getFocusClientsParam1(task, period) {
    await loadFocusClientLinks();
    const sales = await getAllSalesData();
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
    } else if (period === 'custom' && task.params?.analysisFrom && task.params?.analysisTo && task.params?.prevAnalysisFrom && task.params?.prevAnalysisTo) {
        currFrom = new Date(task.params.analysisFrom);
        currTo = new Date(task.params.analysisTo);
        prevFrom = new Date(task.params.prevAnalysisFrom);
        prevTo = new Date(task.params.prevAnalysisTo);
    } else {
        // fallback: текущий месяц
        const now = new Date();
        currFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        currTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevTo = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    const yCodes = new Set(task.products);
    const byClient = {};
    sales.forEach(s => {
        const code = s['Клиент.Код'];
        if (!code) return;
        if (!byClient[code]) byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: focusClientLinks && focusClientLinks[code] ? focusClientLinks[code] : ''
        };
        byClient[code].sales.push(s);
    });
    const result = [];
    for (const c of Object.values(byClient)) {
        let prev = [], curr = [];
        if (period === 'custom' && task.params?.analysisFrom && task.params?.analysisTo && task.params?.prevAnalysisFrom && task.params?.prevAnalysisTo) {
            curr = c.sales.filter(s => yCodes.has(s['Номенклатура']) && new Date(s['Дата']) >= currFrom && new Date(s['Дата']) <= currTo);
            prev = c.sales.filter(s => yCodes.has(s['Номенклатура']) && new Date(s['Дата']) >= prevFrom && new Date(s['Дата']) <= prevTo);
        } else {
            prev = c.sales.filter(s => yCodes.has(s['Номенклатура']) && new Date(s['Дата']) >= prevFrom && new Date(s['Дата']) <= prevTo);
            curr = c.sales.filter(s => yCodes.has(s['Номенклатура']) && new Date(s['Дата']) >= currFrom && new Date(s['Дата']) <= currTo);
        }
        if (prev.length > 0 && curr.length === 0) {
            result.push({
                name: c.name,
                code: c.code,
                sphere: c.sphere,
                sum: prev.reduce((a,b)=>a+(typeof b['Выручка']==='string'?parseFloat(b['Выручка'].replace(/\s/g,'').replace(',','.')):(b['Выручка']||0)),0),
                lastDate: Math.max(...prev.map(s=>+new Date(s['Дата']))),
                manager: c.manager,
                link: c.link
            });
        }
    }
    return result;
}

async function getFocusClientsParam2(task) {
    await loadFocusClientLinks();
    const sales = await getAllSalesData();
    const yCodes = new Set(task.products);
    // 1. Находим клиентов, которые хоть раз покупали фокус-товары
    const buyers = new Set(sales.filter(s => yCodes.has(s['Номенклатура'])).map(s => s['Клиент.Код']));
    // 2. Собираем всех клиентов
    const byClient = {};
    sales.forEach(s => {
        const code = s['Клиент.Код'];
        if (!code) return;
        if (!byClient[code]) byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: focusClientLinks && focusClientLinks[code] ? focusClientLinks[code] : ''
        };
        byClient[code].sales.push(s);
    });
    // 3. Фильтруем по сфере/по схожим товарам
    let result = Object.values(byClient).filter(c => !buyers.has(c.code));
    if (task.params.param2sphere) {
        // Берём сферы всех покупателей фокус-товаров
        const focusSpheres = new Set(sales.filter(s => yCodes.has(s['Номенклатура'])).map(s => s['Сфера деятельности']));
        result = result.filter(c => focusSpheres.has(c.sphere));
    }
    if (task.params.param2similar) {
        // Берём товары, которые покупают клиенты-фокусники
        const focusBuyers = Object.values(byClient).filter(c => c.sales.some(s => yCodes.has(s['Номенклатура'])));
        const focusProducts = new Set();
        focusBuyers.forEach(c => c.sales.forEach(s => focusProducts.add(s['Номенклатура'])));
        result = result.filter(c => c.sales.some(s => focusProducts.has(s['Номенклатура'])));
    }
    // Итоговая таблица
    return result.map(c => ({
        name: c.name,
        code: c.code,
        sphere: c.sphere,
        sum: c.sales.reduce((a,b)=>a+(typeof b['Выручка']==='string'?parseFloat(b['Выручка'].replace(/\s/g,'').replace(',','.')):(b['Выручка']||0)),0),
        lastDate: Math.max(...c.sales.map(s=>+new Date(s['Дата']))),
        manager: c.manager,
        link: c.link
    }));
}

async function getFocusClientsParam3(task) {
    await loadFocusClientLinks();
    const sales = await getAllSalesData();
    const yCodes = new Set(task.products);
    const xCodes = new Set(task.xProducts||[]);
    // Группируем продажи по клиенту
    const byClient = {};
    sales.forEach(s => {
        const code = s['Клиент.Код'];
        if (!code) return;
        if (!byClient[code]) byClient[code] = {
          name: s['Клиент'],
          code,
          sphere: s['Сфера деятельности'],
          sales: [],
          manager: s['Основной менеджер'] || s['Менеджер'] || '',
          link: focusClientLinks && focusClientLinks[code] ? focusClientLinks[code] : ''
        };
        byClient[code].sales.push(s);
    });
    const result = [];
    for (const c of Object.values(byClient)) {
        const hasX = c.sales.some(s => xCodes.has(s['Номенклатура']));
        const hasY = c.sales.some(s => yCodes.has(s['Номенклатура']));
        if (hasX && !hasY) {
            result.push({
                name: c.name,
                code: c.code,
                sphere: c.sphere,
                sum: c.sales.filter(s => xCodes.has(s['Номенклатура'])).reduce((a,b)=>a+(typeof b['Выручка']==='string'?parseFloat(b['Выручка'].replace(/\s/g,'').replace(',','.')):(b['Выручка']||0)),0),
                lastDate: Math.max(...c.sales.filter(s => xCodes.has(s['Номенклатура'])).map(s=>+new Date(s['Дата']))),
                manager: c.manager,
                link: c.link
            });
        }
    }
    return result;
}

function renderTaskDetails(container, task, onBack) {
    container.innerHTML = `
        <div class="flex items-center mb-2">
          <span id="backToTasksBtn" class="mr-3 cursor-pointer text-orange-400 hover:text-orange-600 text-2xl" title="Назад до списку задач">←</span>
          <h2 class="text-2xl font-bold text-white mb-0 flex-1 flex items-center">
            ${task.title || 'Без назви'}
            ${hasPermission('focus_edit') ? `<span id="editFocusTaskBtn" class="ml-4 cursor-pointer text-blue-400 hover:text-blue-600" title="Редагувати"><svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' fill='none' viewBox='0 0 24 24'><path stroke='currentColor' stroke-width='2' d='M16.5 4.5l3 3m-2.086-2.086a2 2 0 0 1 2.828 2.828l-9.193 9.193a2 2 0 0 1-.707.464l-3.387 1.13a.5.5 0 0 1-.632-.632l1.13-3.387a2 2 0 0 1 .464-.707l9.193-9.193Z'/></svg></span>` : ''}
            ${hasPermission('focus_manage') ? `<span id="deleteFocusTaskBtn" class="ml-2 cursor-pointer text-red-400 hover:text-red-600" title="Видалити"><svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' fill='none' viewBox='0 0 24 24'><path stroke='currentColor' stroke-width='2' d='M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z'/></svg></span>` : ''}
          </h2>
        </div>
        <div class="flex flex-wrap gap-4 items-center mb-2">
            <span class="inline-block bg-gray-800 text-gray-200 rounded px-3 py-1">Період: ${task.period || '-'}</span>
            <span class="inline-block bg-gray-800 text-gray-200 rounded px-3 py-1">Товарів у фокусі: ${task.products?.length || 0}</span>
            <button id="toggleAnalysisParams" class="ml-2 px-3 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-xs">Показати параметри аналізу</button>
        </div>
        <div id="analysisParamsBlock" class="mb-2 hidden">
            <div class="font-semibold text-gray-400 mb-1">Параметри аналізу:</div>
            <ul class="list-disc list-inside text-gray-200 text-sm">
                ${task.params?.param1 ? '<li>Клієнти, які купували раніше, але не зараз</li>' : ''}
                ${task.params?.param2 ? '<li>Клієнти, які не купували певну кількість днів</li>' : ''}
                ${task.params?.param3 ? '<li>Клієнти з низькою частотою покупок</li>' : ''}
                ${task.params?.param4 ? '<li>Клієнти з низькою сумою покупок</li>' : ''}
                ${task.params?.param5 ? '<li>Клієнти з певних сегментів</li>' : ''}
                ${task.params?.param6 ? '<li>Похожі клієнти, які ніколи не купували</li>' : ''}
                ${task.params?.param7 ? '<li>Клієнти, які беруть X, але не беруть товари з фокуса</li>' : ''}
            </ul>
        </div>
        <div class="flex flex-wrap gap-2 items-center mb-2">
            <div id="focus-tabs" class="flex gap-2"></div>
            <button id="toggleFilters" class="ml-2 px-3 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-xs">Показати фільтри</button>
        </div>
        <div id="focus-filters-block" class="mb-2 hidden"></div>
        <div id="focus-tab-content"></div>
    `;
    document.getElementById('backToTasksBtn').onclick = onBack;
    if (hasPermission('focus_edit')) {
        document.getElementById('editFocusTaskBtn').onclick = () => {
            showEditTaskModal(task, () => onBack());
        };
    }
    if (hasPermission('focus_manage')) {
        document.getElementById('deleteFocusTaskBtn').onclick = async () => {
            if (confirm('Ви впевнені, що хочете видалити цю задачу?')) {
                const companyId = window.state.currentCompanyId;
                await firebase.deleteDoc(firebase.doc(firebase.db, 'companies', companyId, 'focusTasks', task.id));
                onBack();
            }
        };
    }
    // --- Показ/скрытие параметров анализа ---
    const analysisParamsBlock = container.querySelector('#analysisParamsBlock');
    container.querySelector('#toggleAnalysisParams').onclick = () => {
        analysisParamsBlock.classList.toggle('hidden');
    };
    // --- Показ/скрытие фильтров ---
    const filtersBlock = container.querySelector('#focus-filters-block');
    container.querySelector('#toggleFilters').onclick = () => {
        filtersBlock.classList.toggle('hidden');
    };
    const tabsDiv = container.querySelector('#focus-tabs');
    const tabContentDiv = container.querySelector('#focus-tab-content');
    let currentFilters = {
        manager: '',
        proposal: false,
        sphere: '',
        sumMin: '',
        sumMax: '',
        lastCommFrom: '',
        lastCommTo: '',
        search: ''
    };
    const tabs = [];
    tabs.push({ id: 'all', label: 'Всі клієнти' });
    if (task.params?.param1) tabs.push({ id: 'param1', label: 'Купували раніше, не купили зараз' });
    if (task.params?.param2) tabs.push({ id: 'param2', label: 'Не купували певну кількість днів' });
    if (task.params?.param3) tabs.push({ id: 'param3', label: 'Низька частота покупок' });
    if (task.params?.param4) tabs.push({ id: 'param4', label: 'Низька сума покупок' });
    if (task.params?.param5) tabs.push({ id: 'param5', label: 'Певні сегменти' });
    if (task.params?.param6) tabs.push({ id: 'param6', label: 'Похожі клієнти, які ніколи не купували' });
    if (task.params?.param7) tabs.push({ id: 'param7', label: 'Беруть X, але не беруть товари з фокуса' });
    let activeTab = 'all';
    let notes = {};
    let clientsData = [];
    async function renderContent() {
        if (!task.clientsSnapshot || !Array.isArray(task.clientsSnapshot) || !task.clientsSnapshot.length) {
            tabContentDiv.innerHTML = `
                <div class="text-red-400 mb-4">Задача створена за старою логікою. Пересоздайте задачу для коректних звітів.</div>
                <button onclick="updateOldFocusTask('${task.id}')" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
                    🔄 Оновити задачу
                </button>
            `;
            return;
        }
        let allSales = window._focusSalesCache;
        if (!allSales) {
            allSales = await getAllSalesData();
            window._focusSalesCache = allSales;
        }
        const salesByClient = allSales.reduce((acc, s) => {
            const code = s['Клиент.Код'];
            if (code) {
                if (!acc[code]) acc[code] = [];
                acc[code].push(s);
            }
            return acc;
        }, {});
        // --- Інтеграція справочника клієнт-менеджер ---
        const clientManagerDirectory = await loadClientManagerDirectory();
        clientsData = task.clientsSnapshot
            .filter(c => clientManagerDirectory[c.code])
            .map(c => ({
                ...c,
                manager: clientManagerDirectory[c.code]?.manager || '',
                link: clientManagerDirectory[c.code]?.link || ''
            }));
        const focusProducts = new Set(task.products);
        const periodStart = new Date(task.periodFrom);
        const periodEnd = new Date(task.periodTo);
        for (const client of clientsData) {
            const clientSales = salesByClient[client.code] || [];
            const focusSales = clientSales.filter(s => {
                const saleDate = new Date(s['Дата']);
                return focusProducts.has(s['Номенклатура']) && saleDate >= periodStart && saleDate <= periodEnd;
            });
            client.sum = focusSales.reduce((acc, s) => acc + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
            client.lastDate = focusSales.length ? Math.max(...focusSales.map(s => +new Date(s['Дата']))) : null;
        }
        let filteredClients = clientsData;
        if (activeTab !== 'all') {
            filteredClients = clientsData.filter(c => Array.isArray(c.params) && c.params.includes(activeTab));
        }
        // --- Компактные фильтры ---
        const uniqueManagers = Array.from(new Set(filteredClients.map(c => (c.manager||'').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'uk'));
        const filtersHTML = `
            <div class="flex flex-wrap gap-2 items-end mb-2">
                <div>
                    <label class="block text-gray-300 text-xs">Менеджер</label>
                    <select id="focusFilterManager" class="dark-input h-7 text-xs px-2 py-1">
                        <option value="">Всі</option>
                        ${uniqueManagers.map(m => `<option value="${m}" ${currentFilters.manager === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-gray-300 text-xs mb-1">Без пропозиції</label>
                    <input type="checkbox" id="focusFilterProposal" ${currentFilters.proposal ? 'checked' : ''}>
                </div>
                <div>
                    <label class="block text-gray-300 text-xs">Сфера</label>
                    <input type="text" id="focusFilterSphere" class="dark-input h-7 text-xs px-2 py-1" placeholder="Сфера" value="${currentFilters.sphere}">
                </div>
                <div>
                    <label class="block text-gray-300 text-xs">Сума від</label>
                    <input type="number" id="focusFilterSumMin" class="dark-input h-7 text-xs px-2 py-1" style="width:70px;" value="${currentFilters.sumMin}">
                </div>
                <div>
                    <label class="block text-gray-300 text-xs">Сума до</label>
                    <input type="number" id="focusFilterSumMax" class="dark-input h-7 text-xs px-2 py-1" style="width:70px;" value="${currentFilters.sumMax}">
                </div>
                <div>
                    <label class="block text-gray-300 text-xs">Остання комунікація з</label>
                    <input type="date" id="focusFilterLastCommFrom" class="dark-input h-7 text-xs px-2 py-1" style="width:120px;" value="${currentFilters.lastCommFrom}">
                </div>
                <div>
                    <label class="block text-gray-300 text-xs">по</label>
                    <input type="date" id="focusFilterLastCommTo" class="dark-input h-7 text-xs px-2 py-1" style="width:120px;" value="${currentFilters.lastCommTo}">
                </div>
                <div>
                    <label class="block text-gray-300 text-xs">Пошук</label>
                    <input type="text" id="focusFilterSearch" class="dark-input h-7 text-xs px-2 py-1" placeholder="Ім'я або код клієнта" value="${currentFilters.search||''}">
                </div>
            </div>
            <div id="focusClientsTableContainer"></div>
        `;
        filtersBlock.innerHTML = filtersHTML;
        notes = await getFocusNotes(task.id);
        const filtered = applyClientFilters(filteredClients, notes, currentFilters);
        tabContentDiv.innerHTML = `<div id="focusClientsTableContainer"></div>`;
        tabContentDiv.querySelector('#focusClientsTableContainer').innerHTML = renderFocusClientsTable(task.id, filtered, notes);
        if (filtersBlock.querySelector('#focusFilterManager')) filtersBlock.querySelector('#focusFilterManager').onchange = (e) => { currentFilters.manager = e.target.value; renderContent(); };
        if (filtersBlock.querySelector('#focusFilterProposal')) filtersBlock.querySelector('#focusFilterProposal').onchange = (e) => { currentFilters.proposal = e.target.checked; renderContent(); };
        if (filtersBlock.querySelector('#focusFilterSphere')) filtersBlock.querySelector('#focusFilterSphere').oninput = (e) => { currentFilters.sphere = e.target.value; renderContent(); };
        if (filtersBlock.querySelector('#focusFilterSumMin')) filtersBlock.querySelector('#focusFilterSumMin').oninput = (e) => { currentFilters.sumMin = e.target.value; renderContent(); };
        if (filtersBlock.querySelector('#focusFilterSumMax')) filtersBlock.querySelector('#focusFilterSumMax').oninput = (e) => { currentFilters.sumMax = e.target.value; renderContent(); };
        if (filtersBlock.querySelector('#focusFilterLastCommFrom')) filtersBlock.querySelector('#focusFilterLastCommFrom').onchange = (e) => { currentFilters.lastCommFrom = e.target.value; renderContent(); };
        if (filtersBlock.querySelector('#focusFilterLastCommTo')) filtersBlock.querySelector('#focusFilterLastCommTo').onchange = (e) => { currentFilters.lastCommTo = e.target.value; renderContent(); };
        if (filtersBlock.querySelector('#focusFilterSearch')) filtersBlock.querySelector('#focusFilterSearch').oninput = (e) => { currentFilters.search = e.target.value; renderContent(); };
        attachTableHandlers(task.id);
    }
    function renderTabs() {
        tabsDiv.innerHTML = tabs.map(tab =>
            `<button class="px-4 py-2 rounded ${activeTab === tab.id ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}" data-tab="${tab.id}">${tab.label}</button>`
        ).join('');
        Array.from(tabsDiv.querySelectorAll('button')).forEach(btn => {
            btn.onclick = () => {
                activeTab = btn.dataset.tab;
                renderTabs();
                renderContent();
            };
        });
    }
    renderTabs();
    renderContent();
}

// --- Модалка редактирования задачи ---
function showEditTaskModal(task, onSaved) {
  let modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-xl relative flex flex-col animate-fade-in">
      <button id="close-edit-task" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
      <h2 class="text-2xl font-bold text-white mb-6">Редагування фокусної задачі</h2>
      <form id="focusEditTaskForm" class="space-y-4">
        <div>
          <label class="block text-gray-300 mb-1">Назва задачі *</label>
          <input type="text" id="editFocusTaskTitle" class="dark-input w-full" required maxlength="100" value="${task.title||''}">
        </div>
        <div>
          <label class="block text-gray-300 mb-1">Опис</label>
          <textarea id="editFocusTaskDesc" class="dark-input w-full" rows="2">${task.description||''}</textarea>
        </div>
        <div>
          <label class="block text-gray-300 mb-1">Список товарів (номенклатура, по одному на рядок)</label>
          <textarea id="editFocusTaskProducts" class="dark-input w-full" rows="4">${(task.products||[]).join('\n')}</textarea>
        </div>
        <div>
          <label class="block text-gray-300 mb-1">Параметри аналізу</label>
          <div class="flex flex-col gap-2">
            <label><input type="checkbox" id="editParam1" ${task.params?.param1?'checked':''}> Клієнти, які купували ці товари в минулому періоді, а в цьому — ні</label>
            <label><input type="checkbox" id="editParam2" ${task.params?.param2?'checked':''}> Похожие клієнти, які ніколи не купували
              <span id="editParam2-options" style="display:${task.params?.param2?'':'none'}; margin-left:1em;">
                <label class="ml-2"><input type="checkbox" id="editParam2sphere" ${task.params?.param2sphere?'checked':''}> По сфері</label>
                <label class="ml-2"><input type="checkbox" id="editParam2similar" ${task.params?.param2similar?'checked':''}> По схожим товарам</label>
              </span>
            </label>
            <label><input type="checkbox" id="editParam3" ${task.params?.param3?'checked':''}> Клієнти, які беруть X, але не беруть товари з фокуса
              <span id="editParam3-xblock" style="display:${task.params?.param3?'':'none'}; margin-left:1em;">
                <label class="block text-gray-400 mt-2">Список товарів X (по одному на рядок):</label>
                <textarea id="editFocusTaskXProducts" class="dark-input w-full" rows="2">${(task.xProducts||[]).join('\n')}</textarea>
              </span>
            </label>
          </div>
        </div>
        <div class="flex gap-4 mb-4">
          <div>
            <label class="block text-gray-300 mb-1">Початок дії задачі</label>
            <input type="date" id="editFocusTaskPeriodFrom" class="dark-input w-full" value="${task.periodFrom||''}">
          </div>
          <div>
            <label class="block text-gray-300 mb-1">Кінець дії задачі</label>
            <input type="date" id="editFocusTaskPeriodTo" class="dark-input w-full" value="${task.periodTo||''}">
          </div>
        </div>
        <div>
          <label class="block text-gray-300 mb-1">Період аналізу</label>
          <select id="editFocusTaskPeriod" class="dark-input w-full">
            <option value="month" ${task.period==='month'?'selected':''}>Місяць</option>
            <option value="quarter" ${task.period==='quarter'?'selected':''}>Квартал</option>
            <option value="custom" ${task.period==='custom'?'selected':''}>Інший</option>
          </select>
        </div>
        <div class="flex gap-4 mb-4" id="editAnalysisDatesBlock" style="display:none;">
          <div>
            <label class="block text-gray-300 mb-1">Початок поточного періоду аналізу</label>
            <input type="date" id="editFocusTaskAnalysisFrom" class="dark-input w-full" value="${task.params?.analysisFrom||''}">
          </div>
          <div>
            <label class="block text-gray-300 mb-1">Кінець поточного періоду аналізу</label>
            <input type="date" id="editFocusTaskAnalysisTo" class="dark-input w-full" value="${task.params?.analysisTo||''}">
          </div>
        </div>
        <div class="flex gap-4 mb-4" id="editPrevAnalysisDatesBlock" style="display:none;">
          <div>
            <label class="block text-gray-300 mb-1">Початок попереднього періоду аналізу</label>
            <input type="date" id="editFocusTaskPrevAnalysisFrom" class="dark-input w-full" value="${task.params?.prevAnalysisFrom||''}">
          </div>
          <div>
            <label class="block text-gray-300 mb-1">Кінець попереднього періоду аналізу</label>
            <input type="date" id="editFocusTaskPrevAnalysisTo" class="dark-input w-full" value="${task.params?.prevAnalysisTo||''}">
          </div>
        </div>
        <div class="flex justify-end gap-4 mt-6">
          <button type="button" id="cancelEditTask" class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Скасувати</button>
          <button type="submit" class="px-6 py-2 bg-orange-600 text-white font-semibold rounded hover:bg-orange-700">Зберегти</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  // Добавить скролл и ограничение высоты для модалки
  const modalContent = modal.querySelector('.bg-gray-900.rounded-2xl.shadow-2xl.p-8');
  if (modalContent) {
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflowY = 'auto';
  }
  document.getElementById('close-edit-task').onclick = close;
  document.getElementById('cancelEditTask').onclick = close;
  function close() { modal.remove(); }
  // Логика отображения опций для параметров
  const param2 = document.getElementById('editParam2');
  const param2options = document.getElementById('editParam2-options');
  param2.onchange = () => { param2options.style.display = param2.checked ? '' : 'none'; };
  param2options.style.display = param2.checked ? '' : 'none';
  const param3 = document.getElementById('editParam3');
  const param3xblock = document.getElementById('editParam3-xblock');
  param3.onchange = () => { param3xblock.style.display = param3.checked ? '' : 'none'; };
  param3xblock.style.display = param3.checked ? '' : 'none';
  // === showEditTaskModal: динамическое отображение дат анализа ===
  const periodSelectE = document.getElementById('editFocusTaskPeriod');
  const analysisDatesBlockE = document.getElementById('editAnalysisDatesBlock');
  const prevAnalysisDatesBlockE = document.getElementById('editPrevAnalysisDatesBlock');
  function updatePeriodFieldsE() {
    const isCustom = periodSelectE.value === 'custom';
    analysisDatesBlockE.style.display = isCustom ? '' : 'none';
    prevAnalysisDatesBlockE.style.display = isCustom ? '' : 'none';
  }
  periodSelectE.onchange = updatePeriodFieldsE;
  updatePeriodFieldsE();
  document.getElementById('focusEditTaskForm').onsubmit = async (e) => {
    e.preventDefault();
    const period = document.getElementById('editFocusTaskPeriod').value;
    const analysisFrom = document.getElementById('editFocusTaskAnalysisFrom').value;
    const analysisTo = document.getElementById('editFocusTaskAnalysisTo').value;
    const prevAnalysisFrom = document.getElementById('editFocusTaskPrevAnalysisFrom').value;
    const prevAnalysisTo = document.getElementById('editFocusTaskPrevAnalysisTo').value;
    if (period === 'custom' && (!analysisFrom || !analysisTo || !prevAnalysisFrom || !prevAnalysisTo)) {
        alert('Вкажіть всі дати для аналізу!');
        return;
    }
    const title = document.getElementById('editFocusTaskTitle').value.trim();
    const description = document.getElementById('editFocusTaskDesc').value.trim();
    const products = document.getElementById('editFocusTaskProducts').value.split('\n').map(s=>s.trim()).filter(Boolean);
    const params = {
      param1: document.getElementById('editParam1').checked,
      param2: param2.checked,
      param2sphere: param2.checked ? document.getElementById('editParam2sphere').checked : false,
      param2similar: param2.checked ? document.getElementById('editParam2similar').checked : false,
      param3: param3.checked,
      analysisFrom: period === 'custom' ? analysisFrom : '',
      analysisTo: period === 'custom' ? analysisTo : '',
      prevAnalysisFrom: period === 'custom' ? prevAnalysisFrom : '',
      prevAnalysisTo: period === 'custom' ? prevAnalysisTo : ''
    };
    const xProducts = param3.checked ? document.getElementById('editFocusTaskXProducts').value.split('\n').map(s=>s.trim()).filter(Boolean) : [];
    const periodFrom = document.getElementById('editFocusTaskPeriodFrom').value;
    const periodTo = document.getElementById('editFocusTaskPeriodTo').value;
    if (period === 'custom' && (!periodFrom || !periodTo)) {
        alert('Вкажіть початок і кінець періоду!');
        return;
    }
    if (!title) {
      alert('Вкажіть назву задачі!');
      return;
    }
    // --- Предупреждение о пересчёте клиентов ---
    if (!confirm('Увага! При зміні параметрів задачі список клієнтів буде пересчитано. Продовжити?')) return;
    // --- Считаем clientsSnapshot ---
    let clientsSnapshot = [];
    if (params.param1 || params.param2 || params.param3) {
      let c1 = [], c2 = [], c3 = [];
      if (params.param1) c1 = (await getFocusClientsParam1({products, params}, period)).map(c => ({...c, params: ['param1']}));
      if (params.param2) c2 = (await getFocusClientsParam2({products, params})).map(c => ({...c, params: ['param2']}));
      if (params.param3) c3 = (await getFocusClientsParam3({products, params, xProducts})).map(c => ({...c, params: ['param3']}));
      const byCode = {};
      [...c1, ...c2, ...c3].forEach(c => {
        if (!byCode[c.code]) {
          byCode[c.code] = { code: c.code, name: c.name, manager: c.manager, sphere: c.sphere, link: c.link, params: c.params };
        } else {
          // Если клиент уже есть, добавляем параметр, если его ещё нет
          c.params.forEach(p => {
            if (!byCode[c.code].params.includes(p)) byCode[c.code].params.push(p);
          });
        }
      });
      clientsSnapshot = Object.values(byCode);
    }
    try {
      const companyId = window.state.currentCompanyId;
      const taskRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks', task.id);
      await firebase.setDoc(taskRef, {
        title,
        description,
        products,
        params,
        xProducts,
        period,
        periodFrom,
        periodTo,
        updatedAt: new Date(),
        clientsSnapshot
      }, { merge: true });
      close();
      if (onSaved) onSaved();
    } catch (e) {
      alert('Помилка збереження: ' + (e.message || e));
    }
  };
}

// --- Универсальная функция фильтрации клиентов для отчетов ---
function applyClientFilters(clients, notes, filters) {
    return clients.filter(client => {
        const note = notes[client.code] || {};
        if (filters.manager && client.manager && client.manager.trim().toLowerCase() !== filters.manager.trim().toLowerCase()) {
            return false;
        }
        if (filters.proposal && note.done) {
            return false;
        }
        if (filters.sphere && !client.sphere?.toLowerCase().includes(filters.sphere.toLowerCase())) {
            return false;
        }
        const sum = client.sum || 0;
        if (filters.sumMin && sum < parseFloat(filters.sumMin)) {
            return false;
        }
        if (filters.sumMax && sum > parseFloat(filters.sumMax)) {
            return false;
        }
        const commDate = note.commDate ? new Date(note.commDate) : null;
        if (filters.lastCommFrom && (!commDate || commDate < new Date(filters.lastCommFrom))) {
            return false;
        }
        if (filters.lastCommTo && (!commDate || commDate > new Date(filters.lastCommTo))) {
            return false;
        }
        if (filters.search) {
            const search = filters.search.trim().toLowerCase();
            if (!client.name?.toLowerCase().includes(search) && !client.code?.toLowerCase().includes(search)) {
                return false;
            }
        }
        return true;
    });
}

export async function initFocusPage(container) {
    // Проверяем права доступа к модулю
    if (!window.hasPermission || !window.hasPermission('focus_view')) {
        container.innerHTML = `
            <div class="bg-red-900/20 border border-red-500 rounded-xl p-8 text-center">
                <h2 class="text-2xl font-bold text-white mb-4">Доступ заборонено</h2>
                <p class="text-gray-300">У вас немає прав для перегляду модуля Фокус.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div>
            <h1 class="text-3xl font-bold text-white mb-4">Фокус</h1>
            
            <!-- Індикатор завантаження -->
            <div id="focus-loading-container" class="text-center p-8">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
                <div>
                    <p id="focus-loading-message" class="text-lg font-medium text-gray-200 mb-2">Завантаження фокусних задач...</p>
                    <div class="bg-gray-700 rounded-full h-2 max-w-md mx-auto mb-2">
                        <div id="focus-progress-bar" class="bg-orange-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p id="focus-loading-step" class="text-sm text-gray-400">Ініціалізація...</p>
                </div>
            </div>
            
            <!-- Основний контент (спочатку прихований) -->
            <div id="focus-main-content" class="hidden">
                <div class="flex gap-4 mb-4">
                  <button id="focusTabTasks" class="px-4 py-2 rounded bg-orange-600 text-white font-semibold mr-2">Задачі</button>
                  <button id="focusTabReports" class="px-4 py-2 rounded bg-gray-700 text-white font-semibold">Звіти</button>
                </div>
                <div id="focusTabPanelTasks"></div>
                <div id="focusTabPanelReports" style="display:none"></div>
            </div>
        </div>
    `;
    // Функции управления загрузкой
    function updateFocusProgress(percent, message, step) {
        const progressBar = container.querySelector('#focus-progress-bar');
        const loadingMessage = container.querySelector('#focus-loading-message');
        const loadingStep = container.querySelector('#focus-loading-step');
        
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingStep) loadingStep.textContent = step;
    }
    
    function showFocusContent() {
        const loadingContainer = container.querySelector('#focus-loading-container');
        const mainContent = container.querySelector('#focus-main-content');
        
        if (loadingContainer) loadingContainer.classList.add('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
    }
    
    function showFocusError(errorMessage) {
        const loadingContainer = container.querySelector('#focus-loading-container');
        if (loadingContainer) {
            loadingContainer.innerHTML = `
                <div class="text-center p-8">
                    <div class="text-red-500 text-6xl mb-4">⚠️</div>
                    <p class="text-lg font-medium text-red-400 mb-2">Помилка завантаження</p>
                    <p class="text-sm text-gray-400">${errorMessage}</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
                        Спробувати ще раз
                    </button>
                </div>
            `;
        }
    }

    try {
        updateFocusProgress(20, 'Ініціалізація...', 'Підготовка інтерфейсу');
        
        // --- Универсальный таб-контрол ---
        const tabTasks = container.querySelector('#focusTabTasks');
        const tabReports = container.querySelector('#focusTabReports');
        const panelTasks = container.querySelector('#focusTabPanelTasks');
        const panelReports = container.querySelector('#focusTabPanelReports');
        tabTasks.onclick = () => {
          tabTasks.classList.add('bg-orange-600');
          tabTasks.classList.remove('bg-gray-700');
          tabReports.classList.remove('bg-orange-600');
          tabReports.classList.add('bg-gray-700');
          panelTasks.style.display = '';
          panelReports.style.display = 'none';
        };
        tabReports.onclick = () => {
          tabReports.classList.add('bg-orange-600');
          tabReports.classList.remove('bg-gray-700');
          tabTasks.classList.remove('bg-orange-600');
          tabTasks.classList.add('bg-gray-700');
          panelTasks.style.display = 'none';
          panelReports.style.display = '';
          renderFocusReportsTab(panelReports);
        };
        
        updateFocusProgress(40, 'Підготовка форм...', 'Створення інтерфейсу задач');
    // --- Рендерим первую вкладку по умолчанию ---
    panelTasks.innerHTML = `
              <div class="flex gap-4 mb-4 items-end">
        <div>
          <label class="block text-gray-300 mb-1">Період дії задачі (з)</label>
          <input type="date" id="focusFilterPeriodFrom" class="dark-input">
        </div>
        <div>
          <label class="block text-gray-300 mb-1">по</label>
          <input type="date" id="focusFilterPeriodTo" class="dark-input">
        </div>
        ${window.hasPermission && window.hasPermission('focus_create') ? `
        <button id="createFocusTaskBtn" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
          Створити задачу
        </button>
        ` : ''}
        </div>
        <button id="focusFilterApply" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">Застосувати</button>
      </div>
      <div id="focus-tasks-list" class="mb-6"></div>
      <div id="focus-task-details"></div>`;
    // --- Обработчик для кнопки создания задачи ---
    const createBtn = panelTasks.querySelector('#createFocusTaskBtn');
    if (createBtn) {
        createBtn.onclick = () => showCreateTaskModal(container, () => initFocusPage(container));
    }
    // Загрузка задач из Firestore
    try {
        const companyId = window.state.currentCompanyId;
        const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks');
        const snapshot = await firebase.getDocs(tasksRef);
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let filteredTasks = tasks;
        function applyTaskFilters() {
          const from = panelTasks.querySelector('#focusFilterPeriodFrom').value;
          const to = panelTasks.querySelector('#focusFilterPeriodTo').value;
          filteredTasks = tasks.filter(task => {
            if (from && task.periodFrom && task.periodFrom < from) return false;
            if (to && task.periodTo && task.periodTo > to) return false;
            return true;
          });
          renderTaskList();
        }
        function renderTaskList() {
          const listDiv = panelTasks.querySelector('#focus-tasks-list');
          const detailsDiv = panelTasks.querySelector('#focus-task-details');
          if (filteredTasks.length === 0) {
            listDiv.innerHTML = '<div class="text-gray-400">Немає фокусних задач.</div>';
            detailsDiv.innerHTML = '';
          } else {
            listDiv.innerHTML = filteredTasks.map(task =>
              `<div class="bg-gray-700 rounded-lg p-4 mb-3 cursor-pointer hover:bg-orange-700" data-task-id="${task.id}">
                  <div class="font-bold text-lg text-orange-300">${task.title || 'Без назви'}</div>
                  <div class="text-gray-300 text-sm">${task.description || ''}</div>
                  <div class="text-gray-400 text-xs mt-1">Період: ${task.periodFrom || '-'} — ${task.periodTo || '-'}</div>
              </div>`
            ).join('');
            detailsDiv.innerHTML = '';
            Array.from(listDiv.querySelectorAll('[data-task-id]')).forEach(el => {
              el.onclick = () => {
                renderTaskDetails(detailsDiv, filteredTasks.find(t => t.id === el.dataset.taskId), () => initFocusPage(container));
              };
            });
          }
        }
        const filterBtn = panelTasks.querySelector('#focusFilterApply');
        if (filterBtn) filterBtn.onclick = applyTaskFilters;
        
        updateFocusProgress(80, 'Завантаження задач...', 'Отримання даних з Firebase');
        renderTaskList();
        
        updateFocusProgress(100, 'Готово!', 'Модуль Фокус успішно завантажено');
        
        // Задержка чтобы пользователь увидел 100%
        setTimeout(() => {
            showFocusContent();
        }, 500);
        
    } catch (e) {
        panelTasks.querySelector('#focus-tasks-list').innerHTML = '<div class="text-red-400">Помилка завантаження задач: ' + e.message + '</div>';
        setTimeout(() => {
            showFocusContent();
        }, 1000);
    }
    
} catch (error) {
    console.error('❌ Помилка завантаження модуля Фокус:', error);
    showFocusError(error.message || 'Невідома помилка');
}
}

// --- Новая функция для вкладки Звіти ---
async function renderFocusReportsTab(panel) {
  panel.innerHTML = `
    <div class="mb-4 flex gap-2">
      <button id="focusReportTabTable" class="px-4 py-2 rounded bg-orange-600 text-white font-semibold">Менеджер
      <button id="focusReportTabCharts" class="px-4 py-2 rounded bg-gray-700 text-white font-semibold">Графіки</button>
      <button id="focusReportTabDynamics" class="px-4 py-2 rounded bg-gray-700 text-white font-semibold">Динаміка</button>
      <button id="focusReportTabClients" class="px-4 py-2 rounded bg-gray-700 text-white font-semibold">Клієнти</button>
    </div>
    <div id="focusReportPanelTable"></div>
    <div id="focusReportPanelCharts" style="display:none"></div>
    <div id="focusReportPanelDynamics" style="display:none"></div>
    <div id="focusReportPanelClients" style="display:none"></div>
  `;
  // --- Универсальный таб-контрол ---
  const tabTable = panel.querySelector('#focusReportTabTable');
  const tabCharts = panel.querySelector('#focusReportTabCharts');
  const tabDynamics = panel.querySelector('#focusReportTabDynamics');
  const tabClients = panel.querySelector('#focusReportTabClients');
  const panelTable = panel.querySelector('#focusReportPanelTable');
  const panelCharts = panel.querySelector('#focusReportPanelCharts');
  const panelDynamics = panel.querySelector('#focusReportPanelDynamics');
  const panelClients = panel.querySelector('#focusReportPanelClients');
  function switchTab(tab) {
    tabTable.classList.toggle('bg-orange-600', tab==='table');
    tabTable.classList.toggle('bg-gray-700', tab!=='table');
    tabCharts.classList.toggle('bg-orange-600', tab==='charts');
    tabCharts.classList.toggle('bg-gray-700', tab!=='charts');
    tabDynamics.classList.toggle('bg-orange-600', tab==='dynamics');
    tabDynamics.classList.toggle('bg-gray-700', tab!=='dynamics');
    tabClients.classList.toggle('bg-orange-600', tab==='clients');
    tabClients.classList.toggle('bg-gray-700', tab!=='clients');
    panelTable.style.display = tab==='table' ? '' : 'none';
    panelCharts.style.display = tab==='charts' ? '' : 'none';
    panelDynamics.style.display = tab==='dynamics' ? '' : 'none';
    panelClients.style.display = tab==='clients' ? '' : 'none';
    if (tab==='table') renderTableTab(panelTable);
    if (tab==='charts') renderChartsTab(panelCharts);
    if (tab==='dynamics') renderDynamicsTab(panelDynamics);
    // (Клієнти — позже)
  }
  tabTable.onclick = () => switchTab('table');
  tabCharts.onclick = () => switchTab('charts');
  tabDynamics.onclick = () => switchTab('dynamics');
  tabClients.onclick = () => switchTab('clients');
  // --- Инициализация ---
  switchTab('table');

  // --- Компактные фильтры для таблицы ---
  async function renderTableTab(targetPanel) {
    targetPanel.innerHTML = `<form id="focusTableFilters" class="flex flex-wrap gap-2 items-end mb-4 text-sm">
      <label>Задача:<select id="focusTableTask" class="dark-input h-8 px-2 py-1"></select></label>
      <label>Параметр:<select id="focusTableParam" class="dark-input h-8 px-2 py-1">
        <option value="all">Всі</option>
        <option value="param1">param1</option>
        <option value="param2">param2</option>
        <option value="param3">param3</option>
      </select></label>
      <label>Менеджер:<select id="focusTableManager" class="dark-input h-8 px-2 py-1"><option value="">Всі</option></select></label>
      <label>Період:<input type="date" id="focusTablePeriodFrom" class="dark-input h-8 px-2 py-1" style="width:130px;"> - <input type="date" id="focusTablePeriodTo" class="dark-input h-8 px-2 py-1" style="width:130px;"></label>
      <button type="button" id="focusTableExport" class="px-3 py-1 bg-indigo-600 text-white rounded ml-2">Експорт</button>
    </form>
    <div id="focusTableData"></div>`;
    // --- Заполняем задачи и менеджеров ---
    const companyId = window.state.currentCompanyId;
    const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks');
    const snapshot = await firebase.getDocs(tasksRef);
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const taskSelect = targetPanel.querySelector('#focusTableTask');
    taskSelect.innerHTML = `<option value="all">Всі задачі</option>` + tasks.map(t => `<option value="${t.id}">${t.title||'Без назви'}</option>`).join('');
    // --- Менеджеры из продаж ---
    const allSales = await getAllSalesData();
    const managers = Array.from(new Set(allSales.map(s => s['Основной менеджер']).filter(Boolean))).sort();
    const managerSelect = targetPanel.querySelector('#focusTableManager');
    managerSelect.innerHTML = `<option value="">Всі</option>` + managers.map(m => `<option value="${m}">${m}</option>`).join('');
    // --- Обработчик фильтров ---
    async function rerenderTableData() {
      const taskId = taskSelect.value;
      const param = targetPanel.querySelector('#focusTableParam').value;
      const manager = managerSelect.value;
      const periodFrom = targetPanel.querySelector('#focusTablePeriodFrom').value;
      const periodTo = targetPanel.querySelector('#focusTablePeriodTo').value;
      const tableDiv = targetPanel.querySelector('#focusTableData');
      tableDiv.innerHTML = '<div class="text-gray-400">Завантаження...</div>';
      let filteredTasks = tasks;
      if (taskId !== 'all') filteredTasks = tasks.filter(t => t.id === taskId);
      if (!filteredTasks.length) {
        tableDiv.innerHTML = '<div class="text-red-400">Немає задач для звіту</div>';
        return;
      }
      // Получаем все продажи один раз и строим индекс по клиенту
      const allSales = await getAllSalesData();
      const salesByClient = allSales.reduce((acc, s) => {
        const code = s['Клиент.Код'];
        if (code) {
          if (!acc[code]) acc[code] = [];
          acc[code].push(s);
        }
        return acc;
      }, {});
      // Собираем клиентов по задачам и параметрам
      let allClients = [];
      for (const task of filteredTasks) {
        let clients = [];
        if (task.clientsSnapshot && Array.isArray(task.clientsSnapshot) && task.clientsSnapshot.length) {
          // Используем clientsSnapshot
          clients = task.clientsSnapshot.map(c => ({...c, _task: task}));
          // Пересчитываем сумму продаж по фокусной номенклатуре и периоду задачи
          for (const client of clients) {
            const focusProducts = new Set(task.products);
            const periodStart = new Date(task.periodFrom);
            const periodEnd = new Date(task.periodTo);
            const clientSales = salesByClient[client.code] || [];
            const focusSales = clientSales.filter(s => {
              const saleDate = new Date(s['Дата']);
              return focusProducts.has(s['Номенклатура']) && saleDate >= periodStart && saleDate <= periodEnd;
            });
            client.sum = focusSales.reduce((acc, s) => acc + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
            client.lastDate = focusSales.length ? Math.max(...focusSales.map(s => +new Date(s['Дата']))) : null;
          }
        } else {
          // Нет clientsSnapshot — показываем предупреждение и не строим отчёт
          tableDiv.innerHTML = `
            <div class="text-red-400 mb-4">Задача створена за старою логікою. Пересоздайте задачу для коректних звітів.</div>
            <button onclick="updateOldFocusTask('${task.id}')" class="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
              🔄 Оновити задачу
            </button>
          `;
          return;
        }
        allClients = allClients.concat(clients);
      }
      // Фильтрация по менеджеру
      if (manager) {
        allClients = allClients.filter(c => (c.manager||c["Основной менеджер"]) === manager);
      }
      // Фильтрация по периоду (по последней покупке)
      if (periodFrom) {
        const from = new Date(periodFrom);
        allClients = allClients.filter(c => c.lastDate && new Date(c.lastDate) >= from);
      }
      if (periodTo) {
        const to = new Date(periodTo);
        allClients = allClients.filter(c => c.lastDate && new Date(c.lastDate) <= to);
      }
      // Привязка notes к клиентам для корректного отображения пропозицій и топ-коментарів
let allNotes = {};
for (const task of filteredTasks) {
  const notes = await getFocusNotes(task.id);
  Object.assign(allNotes, notes);
}
for (const client of allClients) {
  client._notes = allNotes[client.code] || {};
}
      // Группировка по менеджерам для отчёта
      const byManager = {};
      allClients.forEach(c => {
        const m = (c.manager||c["Основной менеджер"])||'Без менеджера';
        if (!byManager[m]) byManager[m] = [];
        byManager[m].push(c);
      });
      // Формируем таблицу
      let html = `<div id='focusReportTable'><table class='min-w-full text-xs bg-gray-800 rounded-lg overflow-hidden'><thead><tr class='bg-gray-700 text-gray-300'>
        <th class='px-2 py-1'>Менеджер</th>
        <th class='px-2 py-1'>К-сть клієнтів</th>
        <th class='px-2 py-1'>Сума продаж (фокус)</th>
        <th class='px-2 py-1'>К-сть пропозицій</th>
        <th class='px-2 py-1'>% пропозицій</th>
        <th class='px-2 py-1'>Топ-коментар</th>
        <th class='px-2 py-1'>Конверсія</th>
        <th class='px-2 py-1'>Деталізація</th>
      </tr></thead><tbody>`;
      for (const m of Object.keys(byManager)) {
        const clients = byManager[m];
        const sum = clients.reduce((a, c) => a + (c.sum||0), 0);
        const proposals = clients.filter(c => c._notes?.done || c.done).length;
        const percent = clients.length ? Math.round(proposals/clients.length*100) : 0;
        const topComment = clients.map(c => c._notes?.comment || c.comment || '').filter(Boolean).sort((a,b)=>b.length-a.length)[0]||'';
        const conversion = clients.length ? Math.round(clients.filter(c=>c.sum>0).length/clients.length*100) : 0;
        html += `<tr><td class='px-2 py-1 text-orange-300'>${m}</td><td class='px-2 py-1'>${clients.length}</td><td class='px-2 py-1 text-green-400'>${sum.toFixed(2)}</td><td class='px-2 py-1'>${proposals}</td><td class='px-2 py-1'>${percent}%</td><td class='px-2 py-1'>${topComment.length>30?topComment.slice(0,30)+'…':topComment}</td><td class='px-2 py-1'>${conversion}%</td><td class='px-2 py-1'><button class='px-2 py-1 bg-gray-700 text-white rounded focus:outline-none' data-manager='${m}'>Деталі</button></td></tr>`;
      }
      html += '</tbody></table></div>';
      tableDiv.innerHTML = html;
      // Навешиваем обработчик детализации
      tableDiv.querySelectorAll('button[data-manager]').forEach(btn => {
        btn.onclick = () => {
          const m = btn.getAttribute('data-manager');
          showManagerDetailModal(m, byManager[m], salesByClient, allNotes);
        };
      });
    }
    // --- Навешиваем обработчики ---
    taskSelect.onchange = rerenderTableData;
    targetPanel.querySelector('#focusTableParam').onchange = rerenderTableData;
    managerSelect.onchange = rerenderTableData;
    targetPanel.querySelector('#focusTablePeriodFrom').onchange = rerenderTableData;
    targetPanel.querySelector('#focusTablePeriodTo').onchange = rerenderTableData;
    targetPanel.querySelector('#focusTableExport').onclick = () => exportFocusReportCSV();
    // --- Первый рендер ---
    rerenderTableData();
  }
  // --- Компактные фильтры для графиков ---
  async function renderChartsTab(targetPanel) {
    targetPanel.innerHTML = `<form id="focusChartsFilters" class="flex flex-wrap gap-2 items-end mb-4 text-sm">
      <label>Задача:<select id="focusChartsTask" class="dark-input h-8 px-2 py-1"></select></label>
      <label>Менеджер:<select id="focusChartsManager" class="dark-input h-8 px-2 py-1"><option value="">Всі</option></select></label>
      <label>Період:<input type="date" id="focusChartsPeriodFrom" class="dark-input h-8 px-2 py-1" style="width:130px;"> - <input type="date" id="focusChartsPeriodTo" class="dark-input h-8 px-2 py-1" style="width:130px;"></label>
    </form>
    <div class="flex flex-col gap-8">
      <div><canvas id="focusChartsCanvasSum" height="80"></canvas></div>
      <div><canvas id="focusChartsCanvasClients" height="80"></canvas></div>
      <div><canvas id="focusChartsCanvasProposals" height="80"></canvas></div>
      <div><canvas id="focusChartsCanvasConversion" height="80"></canvas></div>
    </div>
    <div id="focusChartsData" class="text-gray-400"></div>`;
    // --- Заполняем задачи и менеджеров ---
    const companyId = window.state.currentCompanyId;
    const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks');
    const snapshot = await firebase.getDocs(tasksRef);
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const taskSelect = targetPanel.querySelector('#focusChartsTask');
    taskSelect.innerHTML = `<option value="all">Всі задачі</option>` + tasks.map(t => `<option value="${t.id}">${t.title||'Без назви'}</option>`).join('');
    // --- Менеджеры из продаж ---
    const allSales = await getAllSalesData();
    const managers = Array.from(new Set(allSales.map(s => s['Основной менеджер']).filter(Boolean))).sort();
    const managerSelect = targetPanel.querySelector('#focusChartsManager');
    managerSelect.innerHTML = `<option value="">Всі</option>` + managers.map(m => `<option value="${m}">${m}</option>`).join('');
    // --- Графики ---
    let chartSum = null, chartClients = null, chartProposals = null, chartConversion = null;
    async function rerenderChartsData() {
      const taskId = taskSelect.value;
      const manager = managerSelect.value;
      const periodFrom = targetPanel.querySelector('#focusChartsPeriodFrom').value;
      const periodTo = targetPanel.querySelector('#focusChartsPeriodTo').value;
      const infoDiv = targetPanel.querySelector('#focusChartsData');
      infoDiv.textContent = '';
      // --- Собираем клиентов по задачам ---
      let filteredTasks = tasks;
      if (taskId !== 'all') filteredTasks = tasks.filter(t => t.id === taskId);
      // --- Оставляем только задачи с clientsSnapshot ---
      filteredTasks = filteredTasks.filter(t => t.clientsSnapshot && Array.isArray(t.clientsSnapshot) && t.clientsSnapshot.length);
      if (!filteredTasks.length) {
        infoDiv.textContent = 'Немає задач для графіка';
        [chartSum, chartClients, chartProposals, chartConversion].forEach(c => c && c.destroy());
        chartSum = chartClients = chartProposals = chartConversion = null;
        return;
      }
      // Индекс продаж по клиенту
      const salesByClient = allSales.reduce((acc, s) => {
        const code = s['Клиент.Код'];
        if (code) {
          if (!acc[code]) acc[code] = [];
          acc[code].push(s);
        }
        return acc;
      }, {});
      // --- Собираем клиентов только из clientsSnapshot ---
      let allClients = [];
      for (const task of filteredTasks) {
        const focusProducts = new Set(task.products);
        const periodStart = new Date(task.periodFrom);
        const periodEnd = new Date(task.periodTo);
        for (const client of task.clientsSnapshot) {
          const clientSales = salesByClient[client.code] || [];
          const focusSales = clientSales.filter(s => {
            const saleDate = new Date(s['Дата']);
            return focusProducts.has(s['Номенклатура']) && saleDate >= periodStart && saleDate <= periodEnd;
          });
          const sum = focusSales.reduce((acc, s) => acc + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
          allClients.push({ ...client, sum });
        }
      }
      // Фильтрация по менеджеру
      if (manager) {
        allClients = allClients.filter(c => (c.manager||c["Основной менеджер"]) === manager);
      }
      // Фильтрация по периоду (по последней покупке)
      if (periodFrom) {
        const from = new Date(periodFrom);
        allClients = allClients.filter(c => c.lastDate && new Date(c.lastDate) >= from);
      }
      if (periodTo) {
        const to = new Date(periodTo);
        allClients = allClients.filter(c => c.lastDate && new Date(c.lastDate) <= to);
      }
      // --- Формируем данные для графиков ---
      const sum = allClients.reduce((a, c) => a + (c.sum||0), 0);
      const clientCount = allClients.length;
      // ... (остальной код построения графиков остаётся прежним, только данные берём из allClients) ...
    }
    // --- Навешиваем обработчики ---
    taskSelect.onchange = rerenderChartsData;
    managerSelect.onchange = rerenderChartsData;
    targetPanel.querySelector('#focusChartsPeriodFrom').onchange = rerenderChartsData;
    targetPanel.querySelector('#focusChartsPeriodTo').onchange = rerenderChartsData;
    // --- Первый рендер ---
    rerenderChartsData();
  }
  // --- Компактные фильтры для динамики ---
  async function renderDynamicsTab(targetPanel) {
    targetPanel.innerHTML = `<form id="focusDynamicsFilters" class="flex flex-wrap gap-2 items-end mb-4 text-sm">
      <label>Задача:<select id="focusDynamicsTask" class="dark-input h-8 px-2 py-1"></select></label>
      <label>Менеджер:<select id="focusDynamicsManager" class="dark-input h-8 px-2 py-1"><option value="">Всі</option></select></label>
      <label>Період:<input type="date" id="focusDynamicsPeriodFrom" class="dark-input h-8 px-2 py-1" style="width:130px;"> - <input type="date" id="focusDynamicsPeriodTo" class="dark-input h-8 px-2 py-1" style="width:130px;"></label>
      <label>Параметр:<select id="focusDynamicsParam" class="dark-input h-8 px-2 py-1">
        <option value="all">Всі</option>
        <option value="param1">param1</option>
        <option value="param2">param2</option>
        <option value="param3">param3</option>
      </select></label>
    </form>
    <div id="focusDynamicsData" class="text-gray-400">(Динаміка буде тут)</div>`;
    // --- Заполняем задачи и менеджеров ---
    const companyId = window.state.currentCompanyId;
    const tasksRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks');
    const snapshot = await firebase.getDocs(tasksRef);
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const taskSelect = targetPanel.querySelector('#focusDynamicsTask');
    taskSelect.innerHTML = `<option value="all">Всі задачі</option>` + tasks.map(t => `<option value="${t.id}">${t.title||'Без назви'}</option>`).join('');
    // --- Менеджеры из продаж ---
    const allSales = await getAllSalesData();
    const managers = Array.from(new Set(allSales.map(s => s['Основной менеджер']).filter(Boolean))).sort();
    const managerSelect = targetPanel.querySelector('#focusDynamicsManager');
    managerSelect.innerHTML = `<option value="">Всі</option>` + managers.map(m => `<option value="${m}">${m}</option>`).join('');
    // --- Динамика ---
    async function rerenderDynamicsData() {
      const taskId = taskSelect.value;
      const manager = managerSelect.value;
      const periodFrom = targetPanel.querySelector('#focusDynamicsPeriodFrom').value;
      const periodTo = targetPanel.querySelector('#focusDynamicsPeriodTo').value;
      const param = targetPanel.querySelector('#focusDynamicsParam').value;
      const infoDiv = targetPanel.querySelector('#focusDynamicsData');
      infoDiv.textContent = '';
      // --- Собираем клиентов по задачам и параметрам ---
      let filteredTasks = tasks;
      if (taskId !== 'all') filteredTasks = tasks.filter(t => t.id === taskId);
      // --- Оставляем только задачи с clientsSnapshot ---
      filteredTasks = filteredTasks.filter(t => t.clientsSnapshot && Array.isArray(t.clientsSnapshot) && t.clientsSnapshot.length);
      if (!filteredTasks.length) {
        infoDiv.textContent = 'Немає задач для динаміки';
        return;
      }
      // Индекс продаж по клиенту
      const salesByClient = allSales.reduce((acc, s) => {
        const code = s['Клиент.Код'];
        if (code) {
          if (!acc[code]) acc[code] = [];
          acc[code].push(s);
        }
        return acc;
      }, {});
      // --- Новый блок: строим временную шкалу по месяцам всех задач ---
      let minDate = null, maxDate = null;
      for (const task of filteredTasks) {
        if (task.periodFrom) {
          const d = new Date(task.periodFrom);
          if (!minDate || d < minDate) minDate = d;
        }
        if (task.periodTo) {
          const d = new Date(task.periodTo);
          if (!maxDate || d > maxDate) maxDate = d;
        }
      }
      if (!minDate || !maxDate) {
        infoDiv.textContent = 'Немає валідних періодів задач';
        return;
      }
      // --- Формируем список месяцев от minDate до maxDate ---
      const months = [];
      let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      while (d <= end) {
        months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        d.setMonth(d.getMonth()+1);
      }
      // --- Для каждого месяца ищем активные задачи и собираем клиентов ---
      const byMonth = {};
      for (const ym of months) {
        const [y, m] = ym.split('-').map(Number);
        const monthStart = new Date(y, m-1, 1);
        const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
        // Активные задачи в этом месяце
        const activeTasks = filteredTasks.filter(t => {
          const from = t.periodFrom ? new Date(t.periodFrom) : null;
          const to = t.periodTo ? new Date(t.periodTo) : null;
          return from && to && from <= monthEnd && to >= monthStart;
        });
        let monthClients = [];
        for (const task of activeTasks) {
          // --- Используем только clientsSnapshot ---
          const focusProducts = new Set(task.products);
          for (const client of task.clientsSnapshot) {
            // Для каждого клиента ищем продажи в этом месяце по фокусной номенклатуре
            const clientSales = salesByClient[client.code] || [];
            const monthSales = clientSales.filter(s => {
              const saleDate = new Date(s['Дата']);
              return focusProducts.has(s['Номенклатура']) && saleDate >= monthStart && saleDate <= monthEnd;
            });
            if (monthSales.length) {
              const sum = monthSales.reduce((acc, s) => acc + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
              monthClients.push({ ...client, sum });
            }
          }
        }
        // Фильтрация по менеджеру
        if (manager) {
          monthClients = monthClients.filter(c => (c.manager||c["Основной менеджер"]) === manager);
        }
        // Фильтрация по периоду (по месяцу)
        if (periodFrom) {
          const from = new Date(periodFrom);
          if (monthEnd < from) continue;
        }
        if (periodTo) {
          const to = new Date(periodTo);
          if (monthStart > to) continue;
        }
        byMonth[ym] = monthClients;
      }
      // --- Формируем данные для динамики ---
      const dataSum = months.map(m => (byMonth[m]||[]).reduce((a, c) => a + (c.sum||0), 0));
      const dataClients = months.map(m => (byMonth[m]||[]).length);
      // --- Рендерим динамику (таблица + график) ---
      let html = `<table class='min-w-full text-xs bg-gray-800 rounded-lg overflow-hidden mb-4' id='focusDynamicsTable'><thead><tr class='bg-gray-700 text-gray-300'><th class='px-2 py-1'>Місяць</th><th class='px-2 py-1'>Кількість клієнтів</th><th class='px-2 py-1'>Сума продаж (фокус)</th></tr></thead><tbody>`;
      months.forEach((m,i) => {
        html += `<tr class='focus-dyn-month' data-month='${m}' style='cursor:pointer;'><td class='px-2 py-1'>${m}</td><td class='px-2 py-1'>${dataClients[i]}</td><td class='px-2 py-1 text-green-400'>${dataSum[i].toFixed(2)}</td></tr>`;
      });
      html += '</tbody></table>';
      html += `<canvas id='focusDynamicsCanvas' height='80'></canvas>`;
      infoDiv.innerHTML = html;
      // --- График ---
      const ctx = targetPanel.querySelector('#focusDynamicsCanvas').getContext('2d');
      new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Сума продаж (фокус)',
              data: dataSum,
              borderColor: '#ea580c',
              backgroundColor: 'rgba(245,158,66,0.2)',
              yAxisID: 'y',
            },
            {
              label: 'Кількість клієнтів',
              data: dataClients,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(96,165,250,0.2)',
              yAxisID: 'y1',
            }
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          stacked: false,
          plugins: {
            legend: { display: true },
            title: { display: true, text: 'Динаміка по місяцях' }
          },
          scales: {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Сума продаж' } },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Кількість клієнтів' } }
          }
        }
      });
      // --- Детализация по клику на месяц ---
      infoDiv.querySelectorAll('.focus-dyn-month').forEach(row => {
        row.onclick = () => {
          const ym = row.getAttribute('data-month');
          const clients = byMonth[ym] || [];
          let modal = document.createElement('div');
          modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
          modal.innerHTML = `
            <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-3xl relative flex flex-col animate-fade-in max-h-[95vh] overflow-y-auto">
              <button id="close-dyn-detail" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
              <h2 class="text-2xl font-bold text-white mb-6">Деталізація за місяць: <span class="text-orange-400">${ym}</span></h2>
              <table class='min-w-full text-xs bg-gray-800 rounded-lg overflow-hidden mb-4'><thead><tr class='bg-gray-700 text-gray-300'>
                <th class='px-2 py-1'>Код</th><th class='px-2 py-1'>Назва</th><th class='px-2 py-1'>Менеджер</th><th class='px-2 py-1'>Сфера</th><th class='px-2 py-1'>Сума</th>
              </tr></thead><tbody>` +
              clients.map(c => `<tr><td class='px-2 py-1'>${c.code}</td><td class='px-2 py-1'>${c.name}</td><td class='px-2 py-1'>${c.manager||''}</td><td class='px-2 py-1'>${c.sphere||''}</td><td class='px-2 py-1 text-green-400'>${c.sum.toFixed(2)}</td></tr>`).join('') +
              `</tbody></table>
            </div>`;
          document.body.appendChild(modal);
          document.getElementById('close-dyn-detail').onclick = () => { modal.remove(); };
        };
      });
    }
    // --- Навешиваем обработчики ---
    taskSelect.onchange = rerenderDynamicsData;
    managerSelect.onchange = rerenderDynamicsData;
    targetPanel.querySelector('#focusDynamicsPeriodFrom').onchange = rerenderDynamicsData;
    targetPanel.querySelector('#focusDynamicsPeriodTo').onchange = rerenderDynamicsData;
    targetPanel.querySelector('#focusDynamicsParam').onchange = rerenderDynamicsData;
    // --- Первый рендер ---
    rerenderDynamicsData();
  }
  // --- Компактные фильтры для клієнтів ---
  async function renderClientsTab(targetPanel) {
    targetPanel.innerHTML = `<form id="focusClientsFilters" class="flex flex-wrap gap-2 items-end mb-4 text-sm">
      <label>Задача:<select id="focusClientsTask" class="dark-input h-8 px-2 py-1"></select></label>
      <label>Менеджер:<select id="focusClientsManager" class="dark-input h-8 px-2 py-1"><option value="">Всі</option></select></label>
      <label>Період:<input type="date" id="focusClientsPeriodFrom" class="dark-input h-8 px-2 py-1" style="width:130px;"> - <input type="date" id="focusClientsPeriodTo" class="dark-input h-8 px-2 py-1" style="width:130px;"></label>
      <label>Параметр:<select id="focusClientsParam" class="dark-input h-8 px-2 py-1">
        <option value="all">Всі</option>
        <option value="param1">param1</option>
        <option value="param2">param2</option>
        <option value="param3">param3</option>
      </select></label>
      <label>Пошук:<input type="text" id="focusClientsSearch" class="dark-input h-8 px-2 py-1" placeholder="Пошук клієнта..." style="width:180px;"></label>
    </form>
    <div id="focusClientsData" class="text-gray-400">(Таблиця клієнтів буде тут)</div>`;
  }
  // ... (аналогично для dynamics/clients)
}

// --- Модалка детализации по менеджеру ---
function showManagerDetailModal(manager, clients, salesByClient, allNotes) {
  let modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60';
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-3xl relative flex flex-col animate-fade-in max-h-[95vh] overflow-y-auto">
      <button id="close-manager-detail" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
      <h2 class="text-2xl font-bold text-white mb-6">Деталізація по менеджеру: <span class="text-orange-400">${manager}</span></h2>
      <table class='min-w-full text-xs bg-gray-800 rounded-lg overflow-hidden mb-4'><thead><tr class='bg-gray-700 text-gray-300'>
        <th class='px-2 py-1'>Клієнт</th>
        <th class='px-2 py-1'>Сума продаж (фокус)</th>
        <th class='px-2 py-1'>Пропозиція</th>
        <th class='px-2 py-1'>Останній коментар</th>
        <th class='px-2 py-1'>Остання покупка</th>
      </tr></thead><tbody>
        ${clients.map(c => {
          const note = c._notes || allNotes[c.code] || {};
          const clientSales = (salesByClient[c.code] || []).filter(s => {
            const products = new Set(c._task.products || []);
            const periodStart = c._task.periodFrom ? new Date(c._task.periodFrom) : null;
            const periodEnd = c._task.periodTo ? new Date(c._task.periodTo) : null;
            return products.has(s['Номенклатура']) && (!periodStart || new Date(s['Дата']) >= periodStart) && (!periodEnd || new Date(s['Дата']) <= periodEnd);
          });
          const sum = clientSales.reduce((a, s) => a + (typeof s['Выручка'] === 'string' ? parseFloat(s['Выручка'].replace(/\s/g, '').replace(',', '.')) : (s['Выручка'] || 0)), 0);
          const lastDate = clientSales.length ? new Date(Math.max(...clientSales.map(s => +new Date(s['Дата'])))) : null;
          return `<tr><td class='px-2 py-1 text-gray-200'>${c.name}</td><td class='px-2 py-1 text-green-400'>${sum.toFixed(2)}</td><td class='px-2 py-1 text-center'>${note.done ? 'Так' : ''}</td><td class='px-2 py-1'>${note.comment ? `<span title='${note.comment.replace(/'/g, '&apos;')}'>${note.comment.length > 30 ? note.comment.slice(0, 30) + '…' : note.comment}</span>` : ''}</td><td class='px-2 py-1'>${lastDate ? lastDate.toLocaleDateString('uk-UA') : ''}</td></tr>`;
        }).join('')}
      </tbody></table>
      <button id="close-manager-detail-bottom" class="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">Закрити</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('close-manager-detail').onclick = close;
  document.getElementById('close-manager-detail-bottom').onclick = close;
  function close() { modal.remove(); }
}

// --- Экспорт отчёта в CSV ---
function exportFocusReportCSV() {
  const table = document.querySelector('#focusReportTable table');
  if (!table) return;
  let csv = '';
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('th,td');
    csv += Array.from(cells).map(cell => '"'+cell.innerText.replace(/"/g,'""')+'"').join(',') + '\n';
  });
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'focus_report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function attachTableHandlers(taskId) {
  document.querySelectorAll('.focus-commdate').forEach(input => {
    input.onchange = (e) => {
      const clientCode = String(input.dataset.cid);
      console.log('[attachTableHandlers] commdate clientCode:', clientCode, 'value:', input.value);
      setFocusNote(taskId, clientCode, { commDate: input.value });
    };
  });
  document.querySelectorAll('.focus-done').forEach(checkbox => {
    checkbox.onchange = (e) => {
      const clientCode = String(checkbox.dataset.cid);
      console.log('[attachTableHandlers] done clientCode:', clientCode, 'value:', checkbox.checked);
      setFocusNote(taskId, clientCode, { done: checkbox.checked });
    };
  });
  document.querySelectorAll('.focus-comment').forEach(input => {
    input.onchange = (e) => {
      const clientCode = String(input.dataset.cid);
      console.log('[attachTableHandlers] comment clientCode:', clientCode, 'value:', input.value);
      setFocusNote(taskId, clientCode, { comment: input.value });
    };
  });
}