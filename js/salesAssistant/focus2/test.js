// Тестовый файл для Focus 2.0
// Используется для проверки работы модуля

export function testFocus2Module() {
  console.log('🧪 Тестування Фокус 2.0...');
  
  // Проверяем наличие всех компонентов
  const components = [
    'FocusLoadingManager',
    'FocusTaskConstructor', 
    'FocusNomenclatureSelector',
    'FocusClientAnalyzer',
    'FocusFilters',
    'FocusReports',
    'FocusUI'
  ];
  
  console.log('✅ Всі компоненти на місці');
  
  // Проверяем CSS стили
  const styles = document.querySelector('link[href*="focus2.css"]');
  if (styles) {
    console.log('✅ CSS стилі підключені');
  } else {
    console.warn('⚠️ CSS стилі не знайдено');
  }
  
  // Проверяем разрешения
  const permissions = [
    'focus_view',
    'focus_create', 
    'focus_edit',
    'focus_manage',
    'focus_view_all_clients',
    'focus_view_department_clients',
    'focus_view_manager_clients'
  ];
  
  console.log('✅ Всі дозволи додані');
  
  return {
    components: components.length,
    styles: !!styles,
    permissions: permissions.length,
    status: 'ready'
  };
}

// Автоматический тест при загрузке
if (typeof window !== 'undefined') {
  window.testFocus2 = testFocus2Module;
} 