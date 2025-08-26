// Модуль для работы с заметками и ссылками на клиентов в Focus 2.0
import * as firebase from '../../firebase.js';

let focusClientLinks = null;

/**
 * Загрузка ссылок на клиентов
 */
async function loadFocusClientLinks() {
  if (focusClientLinks) return focusClientLinks;
  
  try {
    console.log('📥 Завантаження посилань на клієнтів...');
    const res = await fetch('https://fastapi.lookfort.com/nomenclature.analysis?mode=company_url');
    const arr = await res.json();
    focusClientLinks = {};
    arr.forEach(c => { 
      focusClientLinks[c['Клиент.Код']] = c['посилання']; 
    });
    console.log('✅ Посилання на клієнтів завантажено:', Object.keys(focusClientLinks).length);
    return focusClientLinks;
  } catch (error) {
    console.error('❌ Помилка завантаження посилань на клієнтів:', error);
    return {};
  }
}

/**
 * Получение заметок для задачи
 */
export async function getFocusNotes(taskId) {
  try {
    const companyId = window.state?.currentCompanyId;
    if (!companyId) {
      console.error('❌ Компанія не вибрана');
      return {};
    }
    
    const notesRef = firebase.collection(firebase.db, 'companies', companyId, 'focusTasks2', taskId, 'notes');
    const snapshot = await firebase.getDocs(notesRef);
    const notes = {};
    snapshot.docs.forEach(doc => { 
      notes[doc.id] = doc.data(); 
    });
    
    console.log('✅ Заметки завантажено для задачі:', taskId, Object.keys(notes).length);
    return notes;
  } catch (error) {
    console.error('❌ Помилка завантаження заметок:', error);
    return {};
  }
}

/**
 * Сохранение заметки для клиента
 */
export async function setFocusNote(taskId, clientCode, note) {
  try {
    const companyId = window.state?.currentCompanyId;
    if (!companyId || !taskId || !clientCode) {
      console.error('❌ Некорректные данные для сохранения заметки:', { companyId, taskId, clientCode });
      return;
    }
    
    // Проверяем поля note на undefined/null/NaN
    Object.keys(note).forEach(k => {
      if (note[k] === undefined || note[k] === null || (typeof note[k] === 'number' && isNaN(note[k]))) {
        console.warn(`⚠️ Удаляю некорректное поле note[${k}]`, note[k]);
        delete note[k];
      }
    });
    
    const noteRef = firebase.doc(firebase.db, 'companies', companyId, 'focusTasks2', taskId, 'notes', clientCode);
    await firebase.setDoc(noteRef, note, { merge: true });
    
    console.log('✅ Заметка збережена:', { taskId, clientCode, note });
  } catch (error) {
    console.error('❌ Помилка збереження заметки:', error);
  }
}

/**
 * Получение ссылки на клиента
 */
export async function getClientLink(clientCode) {
  const links = await loadFocusClientLinks();
  return links[clientCode] || null;
}

/**
 * Прикрепление обработчиков событий к таблице клиентов
 */
export function attachTableHandlers(taskId) {
  // Обработчики для даты коммуникации
  document.querySelectorAll('.focus-commdate').forEach(input => {
    input.onchange = (e) => {
      const clientCode = String(input.dataset.cid);
      console.log('📅 Зміна дати комунікації:', clientCode, input.value);
      setFocusNote(taskId, clientCode, { commDate: input.value });
    };
  });
  
  // Обработчики для чекбокса предложения
  document.querySelectorAll('.focus-done').forEach(checkbox => {
    checkbox.onchange = (e) => {
      const clientCode = String(checkbox.dataset.cid);
      console.log('✅ Зміна пропозиції:', clientCode, checkbox.checked);
      setFocusNote(taskId, clientCode, { done: checkbox.checked });
    };
  });
  
  // Обработчики для комментариев
  document.querySelectorAll('.focus-comment').forEach(input => {
    input.onchange = (e) => {
      const clientCode = String(input.dataset.cid);
      console.log('💬 Зміна коментаря:', clientCode, input.value);
      setFocusNote(taskId, clientCode, { comment: input.value });
    };
  });
  
  // Обработчики для приоритета
  document.querySelectorAll('.focus-priority').forEach(select => {
    select.onchange = (e) => {
      const clientCode = String(select.dataset.cid);
      console.log('⭐ Зміна пріоритету:', clientCode, select.value);
      setFocusNote(taskId, clientCode, { priority: select.value });
    };
  });
  
  console.log('✅ Обробники подій прикріплено для задачі:', taskId);
}

/**
 * Рендеринг таблицы клиентов с заметками
 */
export function renderClientsTableWithNotes(taskId, clients, notes = {}) {
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr class="bg-gray-700 text-gray-300">
            <th class="px-3 py-2 text-left">Клієнт</th>
            <th class="px-3 py-2 text-left">Менеджер</th>
            <th class="px-3 py-2 text-left">Сфера</th>
            <th class="px-3 py-2 text-left">Параметри</th>
            <th class="px-3 py-2 text-left">Сума</th>
            <th class="px-3 py-2 text-left">Остання покупка</th>
            <th class="px-3 py-2 text-left">Дата комунікації</th>
            <th class="px-3 py-2 text-center">Пропозиція</th>
            <th class="px-3 py-2 text-center">Пріоритет</th>
            <th class="px-3 py-2 text-left">Коментар</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map(client => {
            const note = notes[client.code] || {};
            const clientName = client.link ? 
              `<a href="${client.link}" target="_blank" class="text-blue-400 underline hover:text-blue-600">${client.name}</a>` : 
              client.name;
            
            return `
              <tr class="border-b border-gray-700 hover:bg-gray-700">
                <td class="px-3 py-2 text-gray-200">
                  <div>
                    <div class="font-medium">${clientName}</div>
                    <div class="text-gray-400 text-xs">${client.code}</div>
                  </div>
                </td>
                <td class="px-3 py-2 text-gray-300">${client.manager || '-'}</td>
                <td class="px-3 py-2 text-gray-300">${client.sphere || '-'}</td>
                <td class="px-3 py-2 text-gray-300">
                  <div class="text-xs">
                    ${(() => {
                      const paramLabels = {
                        param1: 'Купували раніше',
                        param2: 'Не купували днів',
                        param3: 'Низька частота',
                        param4: 'Низька сума',
                        param5: 'Певні сегменти',
                        param6: 'Похожі клієнти',
                        param7: 'Беруть X'
                      };
                      
                      return client.params && Array.isArray(client.params) ? 
                        client.params.map(param => paramLabels[param] || param).join(', ') : '-';
                    })()}
                  </div>
                </td>
                <td class="px-3 py-2 text-green-400">${client.sum ? client.sum.toFixed(2) : '-'}</td>
                <td class="px-3 py-2 text-gray-300">${client.lastDate ? new Date(client.lastDate).toLocaleDateString('uk-UA') : '-'}</td>
                <td class="px-3 py-2">
                  <input type="date" 
                         value="${note.commDate || ''}" 
                         data-cid="${client.code}" 
                         class="focus-commdate bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs">
                </td>
                <td class="px-3 py-2 text-center">
                  <input type="checkbox" 
                         data-cid="${client.code}" 
                         class="focus-done" 
                         ${note.done ? 'checked' : ''}>
                </td>
                <td class="px-3 py-2 text-center">
                  <select data-cid="${client.code}" 
                          class="focus-priority bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs">
                    <option value="">-</option>
                    <option value="low" ${note.priority === 'low' ? 'selected' : ''}>Низький</option>
                    <option value="medium" ${note.priority === 'medium' ? 'selected' : ''}>Середній</option>
                    <option value="high" ${note.priority === 'high' ? 'selected' : ''}>Високий</option>
                    <option value="urgent" ${note.priority === 'urgent' ? 'selected' : ''}>Терміново</option>
                  </select>
                </td>
                <td class="px-3 py-2">
                  <input type="text" 
                         value="${note.comment || ''}" 
                         data-cid="${client.code}" 
                         class="focus-comment bg-gray-900 text-gray-200 rounded px-2 py-1 text-xs w-full"
                         placeholder="Коментар...">
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Экспорт данных в CSV
 */
export function exportToCSV(clients, notes = {}) {
  let csv = 'Клієнт,Код,Менеджер,Сфера,Параметри,Сума,Остання покупка,Дата комунікації,Пропозиція,Пріоритет,Коментар\n';
  
  const paramLabels = {
    param1: 'Купували раніше',
    param2: 'Не купували днів',
    param3: 'Низька частота',
    param4: 'Низька сума',
    param5: 'Певні сегменти',
    param6: 'Похожі клієнти',
    param7: 'Беруть X'
  };
  
  clients.forEach(client => {
    const note = notes[client.code] || {};
    const clientName = client.name.replace(/"/g, '""');
    const comment = (note.comment || '').replace(/"/g, '""');
    
    // Формуємо рядок параметрів
    const clientParams = client.params && Array.isArray(client.params) ? 
      client.params.map(param => paramLabels[param] || param).join('; ') : '';
    
    csv += `"${clientName}","${client.code}","${client.manager || ''}","${client.sphere || ''}","${clientParams}",${client.sum || 0},"${client.lastDate ? new Date(client.lastDate).toLocaleDateString('uk-UA') : ''}","${note.commDate || ''}","${note.done ? 'Так' : 'Ні'}","${note.priority || ''}","${comment}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focus_clients_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('✅ Дані експортовано в CSV');
}

/**
 * Инициализация модуля заметок
 */
export async function initNotesModule() {
  try {
    await loadFocusClientLinks();
    console.log('✅ Модуль заметок ініціалізовано');
  } catch (error) {
    console.error('❌ Помилка ініціалізації модуля заметок:', error);
  }
} 