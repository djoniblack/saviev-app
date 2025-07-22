// Демо-данные для оргструктуры с руководителем и сотрудниками
const demoOrgDataV2 = [
  {
    id: 'dev',
    name: 'Отдел Разработки',
    head: { id: 'h1', name: 'Петр Симоненко', position: 'Руководитель отдела', avatar: '', },
    employees: [
      { id: 'e1', name: 'Иван Иванов', position: 'Frontend Developer', avatar: '' },
      { id: 'e2', name: 'Елена Петрова', position: 'Backend Developer', avatar: '' },
    ]
  },
  {
    id: 'hr',
    name: 'Отдел кадров',
    head: { id: 'h2', name: 'Ольга Максимова', position: 'Руководитель отдела', avatar: '' },
    employees: [
      { id: 'e3', name: 'Семен Слепаков', position: 'Рекрутер', avatar: '' },
    ]
  }
];

// --- Співробітники без відділу (демо) ---
let unassignedEmployees = [
  { id: 'u1', name: 'Олексій Безвідділов', position: 'Дизайнер', avatar: '' },
  { id: 'u2', name: 'Марія Вільна', position: 'QA', avatar: '' },
];

// SVG-заглушка для аватара
function avatarSVG() {
  return `<svg class="w-10 h-10 rounded-full bg-gray-700 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#312e81"/><text x="50%" y="55%" text-anchor="middle" fill="#a5b4fc" font-size="18" font-family="Inter, sans-serif" dy=".3em">👤</text></svg>`;
}

// Кнопки действий
function actionButtons(type = 'employee', id = '') {
  return `<div class="flex gap-2 ml-auto">
    <button class="p-1 rounded hover:bg-indigo-600" title="Редактировать" data-action="edit" data-id="${id}"><svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6M3 21h18"/></svg></button>
    <button class="p-1 rounded hover:bg-yellow-600" title="Сменить отдел" data-action="move" data-id="${id}"><svg class="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7"/></svg></button>
    <button class="p-1 rounded hover:bg-red-600" title="Удалить" data-action="delete" data-id="${id}"><svg class="w-5 h-5 text-red-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
  </div>`;
}

// Карточка сотрудника (drag&drop)
function employeeCard(emp, isHead = false) {
  return `<div class="flex items-center bg-gray-800 border border-gray-700 rounded-xl shadow p-3 mb-2 min-w-[220px] drag-employee" draggable="true" data-emp-id="${emp.id}">
    ${avatarSVG()}
    <div class="ml-4">
      <div class="font-semibold text-white">${emp.name}</div>
      <div class="text-xs text-gray-400">${emp.position || ''}</div>
    </div>
    ${actionButtons('employee', emp.id)}
  </div>`;
}

// --- Шапка сторінки ---
function renderOrgChartHeader(container, onAddEmp, onAddDept, onShowUnassigned) {
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-6 px-6 pt-6';
  header.innerHTML = `
    <div class="text-2xl font-bold text-indigo-300">Організаційна структура компанії</div>
    <div class="flex gap-4">
      <button id="addEmpBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">Додати співробітника</button>
      <button id="addDeptBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">Додати відділ</button>
      <button id="showUnassignedBtn" class="px-4 py-2 bg-gray-700 text-indigo-300 rounded-lg font-semibold hover:bg-gray-600 transition flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#818cf8" stroke-width="2" fill="none"/><path d="M8 12h8M12 8v8" stroke="#818cf8" stroke-width="2"/></svg>
        Співробітники без відділу
      </button>
    </div>
  `;
  container.appendChild(header);
  header.querySelector('#addEmpBtn').onclick = onAddEmp;
  header.querySelector('#addDeptBtn').onclick = onAddDept;
  header.querySelector('#showUnassignedBtn').onclick = onShowUnassigned;
}

// --- Модальне вікно співробітників без відділу ---
function renderUnassignedModal(container, onClose, onDragStart) {
  let modal = document.getElementById('unassignedModal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'unassignedModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center';
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto relative modal-content-flip">
      <button id="closeUnassignedBtn" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
      <h3 class="text-xl font-bold text-indigo-300 mb-4">Співробітники без відділу</h3>
      <div id="unassignedList" class="flex flex-col gap-3">
        ${unassignedEmployees.length === 0 ? '<div class="text-gray-400">Немає співробітників</div>' :
          unassignedEmployees.map(emp => `
            <div class="flex items-center bg-gray-800 border border-gray-700 rounded-xl shadow p-3 drag-employee" draggable="true" data-emp-id="${emp.id}">
              ${avatarSVG()}
              <div class="ml-4">
                <div class="font-semibold text-white">${emp.name}</div>
                <div class="text-xs text-gray-400">${emp.position || ''}</div>
              </div>
              ${actionButtons('employee', emp.id)}
            </div>`).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#closeUnassignedBtn').onclick = () => {
    modal.remove();
    if (onClose) onClose();
  };
  // Drag&Drop для співробітників без відділу
  modal.querySelectorAll('.drag-employee').forEach(el => {
    el.addEventListener('dragstart', e => {
      if (onDragStart) onDragStart(el.dataset.empId);
      el.classList.add('opacity-50');
    });
    el.addEventListener('dragend', e => {
      el.classList.remove('opacity-50');
    });
  });
}

// --- Масив з'єднань між anchor points ---
let connections = [];

// --- Drag-to-connect для anchor points ---
function setupAnchorDragToConnect(container) {
  let isDragging = false;
  let startAnchor = null;
  let tempLine = null;

  function onMouseMove(e) {
    if (!isDragging || !tempLine) return;
    const svg = document.getElementById('orgchart-svg-layer');
    const svgRect = svg.getBoundingClientRect();
    const x2 = e.clientX - svgRect.left;
    const y2 = e.clientY - svgRect.top;
    tempLine.setAttribute('x2', x2);
    tempLine.setAttribute('y2', y2);
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    document.body.style.cursor = '';
    isDragging = false;
    if (tempLine) tempLine.remove();
    tempLine = null;
    // Перевіряємо, чи відпустили над іншою anchor point
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && target.classList.contains('anchor-point')) {
      const fromId = startAnchor.dataset.anchorId;
      const toId = target.dataset.anchorId;
      if (fromId && toId && fromId !== toId) {
        connections.push({ from: fromId, to: toId });
        drawAllConnections();
      }
    }
    startAnchor = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  container.querySelectorAll('.anchor-point').forEach(anchor => {
    anchor.style.cursor = 'grab';
    anchor.addEventListener('mouseenter', () => { anchor.style.cursor = 'grab'; });
    anchor.addEventListener('mousedown', e => {
      e.stopPropagation();
      isDragging = true;
      startAnchor = anchor;
      anchor.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';
      // Малюємо тимчасову лінію
      const svg = document.getElementById('orgchart-svg-layer');
      const rect = anchor.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const x1 = rect.left + rect.width / 2 - svgRect.left;
      const y1 = rect.top + rect.height / 2 - svgRect.top;
      tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tempLine.setAttribute('x1', x1);
      tempLine.setAttribute('y1', y1);
      tempLine.setAttribute('x2', x1);
      tempLine.setAttribute('y2', y1);
      tempLine.setAttribute('stroke', '#fbbf24');
      tempLine.setAttribute('stroke-width', '3');
      tempLine.setAttribute('stroke-dasharray', '6,4');
      tempLine.setAttribute('id', 'temp-connection-line');
      svg.appendChild(tempLine);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
    anchor.addEventListener('mouseup', e => {
      // handled in onMouseUp
    });
  });
}

// --- Малювання всіх з'єднань ---
function drawAllConnections() {
  const svg = document.getElementById('orgchart-svg-layer');
  if (!svg) return;
  // Видаляємо старі лінії
  Array.from(svg.querySelectorAll('.connection-line')).forEach(l => l.remove());
  connections.forEach(conn => {
    const fromAnchor = document.querySelector(`[data-anchor-id='${conn.from}']`);
    const toAnchor = document.querySelector(`[data-anchor-id='${conn.to}']`);
    if (fromAnchor && toAnchor) {
      const svgRect = svg.getBoundingClientRect();
      const fromRect = fromAnchor.getBoundingClientRect();
      const toRect = toAnchor.getBoundingClientRect();
      const x1 = fromRect.left + fromRect.width / 2 - svgRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
      const x2 = toRect.left + toRect.width / 2 - svgRect.left;
      const y2 = toRect.top + toRect.height / 2 - svgRect.top;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`);
      path.setAttribute('stroke', '#fbbf24');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'connection-line');
      svg.appendChild(path);
    }
  });
}

// --- Anchor points з унікальним id ---
function anchorPointsHTML(deptId) {
  return `
    <div class="anchor-point absolute left-1/2 -translate-x-1/2 -top-2 w-3 h-3 bg-indigo-400 rounded-full border-2 border-white shadow" data-anchor-id="${deptId}-top"></div>
    <div class="anchor-point absolute left-1/2 -translate-x-1/2 -bottom-2 w-3 h-3 bg-indigo-400 rounded-full border-2 border-white shadow" data-anchor-id="${deptId}-bottom"></div>
    <div class="anchor-point absolute top-1/2 -translate-y-1/2 -left-2 w-3 h-3 bg-indigo-400 rounded-full border-2 border-white shadow" data-anchor-id="${deptId}-left"></div>
    <div class="anchor-point absolute top-1/2 -translate-y-1/2 -right-2 w-3 h-3 bg-indigo-400 rounded-full border-2 border-white shadow" data-anchor-id="${deptId}-right"></div>
  `;
}

// --- Деревоподібна структура відділів (демо) ---
let demoOrgTree = [
  {
    id: 'dev',
    name: 'Відділ розробки',
    head: { id: 'h1', name: 'Петро Симоненко', position: 'Керівник відділу', avatar: '' },
    employees: [
      { id: 'e1', name: 'Іван Іванов', position: 'Frontend Developer', avatar: '' },
      { id: 'e2', name: 'Олена Петрова', position: 'Backend Developer', avatar: '' },
    ],
    children: [
      {
        id: 'subdev',
        name: 'Підвідділ розробки',
        head: { id: 'h3', name: 'Василь Підрозділов', position: 'Керівник підвідділу', avatar: '' },
        employees: [],
        children: []
      }
    ]
  },
  {
    id: 'hr',
    name: 'Відділ кадрів',
    head: { id: 'h2', name: 'Ольга Максимова', position: 'Керівник відділу', avatar: '' },
    employees: [
      { id: 'e3', name: 'Семен Слепаков', position: 'Рекрутер', avatar: '' },
    ],
    children: []
  }
];

// --- Рекурсивний рендер відділів (з вкладеністю) ---
function departmentCardTree(dept, parentId = null) {
  return `<div class="relative bg-gray-900 border-2 border-indigo-700 rounded-2xl shadow-xl p-0 min-w-[320px] max-w-[340px] mx-4 flex flex-col items-stretch dept-draggable" draggable="true" data-dept-id="${dept.id}" data-parent-id="${parentId || ''}">
    ${anchorPointsHTML(dept.id)}
    <div class="rounded-t-2xl bg-indigo-900 text-indigo-300 text-lg font-bold px-6 py-3 text-center tracking-wide">${dept.name}</div>
    <div class="px-6 pt-4 pb-2">
      <div class="mb-4">
        <div class="text-xs text-gray-400 mb-1">Керівник відділу</div>
        ${employeeCard(dept.head, true)}
      </div>
      <div class="border-t border-dashed border-indigo-400 my-2"></div>
      <div class="flex flex-col gap-2 pt-2">
        ${dept.employees.map(emp => employeeCard(emp)).join('')}
      </div>
      ${dept.children && dept.children.length > 0 ?
        `<div class="flex flex-row flex-wrap gap-8 mt-6 justify-center">
          ${dept.children.map(child => departmentCardTree(child, dept.id)).join('')}
        </div>` : ''}
    </div>
  </div>`;
}

// --- Динамічне малювання SVG-ліній між anchor points ---
function drawDynamicLines() {
  // Знаходимо всі anchor points (наприклад, верхні точки)
  const anchors = Array.from(document.querySelectorAll('.dept-draggable'));
  const svgLayer = document.getElementById('orgchart-svg-layer');
  if (svgLayer) svgLayer.remove();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'orgchart-svg-layer');
  svg.style.position = 'absolute';
  svg.style.left = '0';
  svg.style.top = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '5';
  // Для демо: малюємо лінії від кожного відділу до його дочірніх
  anchors.forEach(deptEl => {
    const deptId = deptEl.dataset.deptId;
    const children = Array.from(deptEl.querySelectorAll('.dept-draggable'));
    children.forEach(childEl => {
      // Верхня точка батька
      const parentAnchor = deptEl.querySelector('.left-1\/2.-top-2');
      // Нижня точка дитини
      const childAnchor = childEl.querySelector('.left-1\/2.-bottom-2');
      if (parentAnchor && childAnchor) {
        const parentRect = parentAnchor.getBoundingClientRect();
        const childRect = childAnchor.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const x1 = parentRect.left + parentRect.width / 2 - svgRect.left;
        const y1 = parentRect.top + parentRect.height / 2 - svgRect.top;
        const x2 = childRect.left + childRect.width / 2 - svgRect.left;
        const y2 = childRect.top + childRect.height / 2 - svgRect.top;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`);
        path.setAttribute('stroke', '#60a5fa');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }
    });
  });
  document.getElementById('org-chart-container').appendChild(svg);
}

// --- Додавання відділу як дочірнього (drag&drop) ---
let draggedDeptId = null;
function setupDeptDragAndDrop(container, tree) {
  container.querySelectorAll('.dept-draggable').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggedDeptId = el.dataset.deptId;
      el.classList.add('opacity-50');
    });
    el.addEventListener('dragend', e => {
      draggedDeptId = null;
      el.classList.remove('opacity-50');
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      el.classList.add('ring-4', 'ring-indigo-400');
    });
    el.addEventListener('dragleave', e => {
      el.classList.remove('ring-4', 'ring-indigo-400');
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('ring-4', 'ring-indigo-400');
      if (!draggedDeptId || draggedDeptId === el.dataset.deptId) return;
      // Знаходимо відділ у дереві та переміщаємо його як дочірній
      moveDeptInTree(tree, draggedDeptId, el.dataset.deptId);
      renderDemoOrgChartTree(document.getElementById('org-chart-container'), tree);
    });
  });
  // Drop на фон (унест)
  const dropZone = container.querySelector('.orgchart-dropzone');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('ring-2', 'ring-yellow-400'); });
    dropZone.addEventListener('dragleave', e => { dropZone.classList.remove('ring-2', 'ring-yellow-400'); });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('ring-2', 'ring-yellow-400');
      if (!draggedDeptId) return;
      moveDeptInTreeToRoot(tree, draggedDeptId);
      renderDemoOrgChartTree(document.getElementById('org-chart-container'), tree);
    });
  }
}

// --- Переміщення відділу в дереві ---
function moveDeptInTree(tree, deptId, newParentId) {
  let dept = null;
  function removeDept(arr) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === deptId) {
        dept = arr.splice(i, 1)[0];
        return true;
      }
      if (arr[i].children && removeDept(arr[i].children)) return true;
    }
    return false;
  }
  removeDept(tree);
  function addToParent(arr) {
    for (let d of arr) {
      if (d.id === newParentId) {
        d.children = d.children || [];
        d.children.push(dept);
        return true;
      }
      if (d.children && addToParent(d.children)) return true;
    }
    return false;
  }
  addToParent(tree);
}

// --- Переміщення відділу на верхній рівень ---
function moveDeptInTreeToRoot(tree, deptId) {
  let dept = null;
  function removeDept(arr) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === deptId) {
        dept = arr.splice(i, 1)[0];
        return true;
      }
      if (arr[i].children && removeDept(arr[i].children)) return true;
    }
    return false;
  }
  removeDept(tree);
  if (dept) tree.push(dept);
}

// --- Основний рендер оргструктури (дерево) з drop-зоною ---
function renderDemoOrgChartTree(container, tree = demoOrgTree) {
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.minHeight = '400px';
  renderOrgChartHeader(container, addEmployee, addDepartment, () => renderUnassignedModal(container, null, (empId) => { draggedUnassignedId = empId; }));
  container.insertAdjacentHTML('beforeend', dottedBackground());
  // Drop-зона для унесту
  container.insertAdjacentHTML('beforeend', '<div class="orgchart-dropzone absolute left-0 right-0 top-0 bottom-0 z-0"></div>');
  const treeHtml = `<div class="relative z-10 flex flex-row items-start justify-center gap-8 pt-8 pb-12">
    ${tree.map(dept => departmentCardTree(dept)).join('')}
  </div>`;
  container.insertAdjacentHTML('beforeend', treeHtml);
  setupDeptDragAndDrop(container, tree);
  setupDragAndDrop(container, tree); // для співробітників
  setTimeout(() => { drawDynamicLines(); setupAnchorDragToConnect(container); drawAllConnections(); }, 100);
}

function initOrgChartModule(container, data, callbacks) {
  renderDemoOrgChartTree(container);
}

window.initOrgChartModule = initOrgChartModule;

// --- Додавання співробітника ---
function addEmployee() {
  const id = 'u' + (Math.random() * 100000 | 0);
  unassignedEmployees.push({ id, name: 'Новий співробітник', position: 'Посада', avatar: '' });
  renderDemoOrgChartTree(document.getElementById('org-chart-container'));
}

// --- Додавання відділу ---
function addDepartment() {
  const id = 'd' + (Math.random() * 100000 | 0);
  demoOrgTree.push({
    id,
    name: 'Новий відділ',
    head: { id: 'h' + id, name: 'Керівник', position: 'Керівник відділу', avatar: '' },
    employees: [],
    children: []
  });
  renderDemoOrgChartTree(document.getElementById('org-chart-container'));
}

// Фон с точками
function dottedBackground() {
  return `<div style="position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(circle,#374151 1px,transparent 1.5px) repeat;background-size:22px 22px;"></div>`;
}

// --- Drag&Drop між відділами і співробітниками без відділу ---
let draggedUnassignedId = null;
function setupDragAndDrop(container, depts) {
  let draggedId = null;
  container.querySelectorAll('.drag-employee').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggedId = el.dataset.empId;
      el.classList.add('opacity-50');
    });
    el.addEventListener('dragend', e => {
      draggedId = null;
      el.classList.remove('opacity-50');
      draggedUnassignedId = null;
    });
  });
  container.querySelectorAll('.bg-gray-900').forEach(deptEl => {
    deptEl.addEventListener('dragover', e => {
      e.preventDefault();
      deptEl.classList.add('ring-4', 'ring-indigo-400');
    });
    deptEl.addEventListener('dragleave', e => {
      deptEl.classList.remove('ring-4', 'ring-indigo-400');
    });
    deptEl.addEventListener('drop', e => {
      e.preventDefault();
      deptEl.classList.remove('ring-4', 'ring-indigo-400');
      let empId = draggedId || draggedUnassignedId;
      if (!empId) return;
      // Переміщення з відділу
      let fromDept = null, toDept = null, emp = null;
      for (const d of depts) {
        if (d.head.id === empId) { fromDept = d; emp = d.head; break; }
        const idx = d.employees.findIndex(e => e.id === empId);
        if (idx !== -1) { fromDept = d; emp = d.employees[idx]; break; }
      }
      toDept = depts.find(d => deptEl.querySelector(`[data-emp-id='${d.head.id}']`));
      // Переміщення зі співробітників без відділу
      if (!emp && unassignedEmployees.length) {
        const idx = unassignedEmployees.findIndex(e => e.id === empId);
        if (idx !== -1) {
          emp = unassignedEmployees[idx];
          unassignedEmployees.splice(idx, 1);
        }
      }
      if (!emp || !toDept || (fromDept && fromDept === toDept)) return;
      if (fromDept && fromDept.head.id === empId) return; // не даємо перетягувати керівника
      if (fromDept) fromDept.employees = fromDept.employees.filter(e => e.id !== empId);
      toDept.employees.push(emp);
      renderDemoOrgChartTree(document.getElementById('org-chart-container'));
    });
  });
} 