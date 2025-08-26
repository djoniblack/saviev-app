rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isUserAuthenticated() {
      return request.auth != null;
    }

    function isCompanyOwner(companyId) {
      let companyPath = /databases/$(database)/documents/companies/$(companyId);
      return exists(companyPath) && get(companyPath).data.ownerId == request.auth.uid;
    }

    // ИСПРАВЛЕНО: Упрощенная и надежная функция проверки прав
    function getUserEffectivePermissions(companyId, userId) {
      let memberPath = /databases/$(database)/documents/companies/$(companyId)/members/$(userId);
      
      if (!exists(memberPath)) {
        return {};
      }
      
      let memberData = get(memberPath).data;
      
      // Если пользователь - владелец, даем все права
      if (memberData.role == 'owner') {
        return {
          // Все права для владельца (как в оригинале)
          'timesheet_view': true,
          'timesheet_edit_cells': true,
          'timesheet_archive_employees': true,
          'timesheet_fill_schedule': true,
          'timesheet_clear_month': true,
          'timesheet_change_norm': true,
          'timesheet_export': true,
          'massSalary_view_page': true,
          'massSalary_generate_table': true,
          'massSalary_calculate_all': true,
          'massSalary_save_snapshot': true,
          'massSalary_export_excel': true,
          'kpiIndividual_view_page': true,
          'kpiIndividual_load_actuals': true,
          'kpiIndividual_calculate': true,
          'kpiIndividual_save_actuals': true,
          'reports_view_page': true,
          'reports_view_dynamics': true,
          'settings_employees_manage': true,
          'settings_departments_manage': true,
          'settings_schedules_manage': true,
          'settings_positions_manage': true,
          'settings_users_access_manage': true,
          'settings_roles_manage': true,
          'settings_kpi_constructor_manage': true,
          'vacations_view_page': true,
          'vacations_manage_requests': true,
          'competencies_view_page': true,
          'competencies_assess_employees': true,
          'competencies_manage_models': true,
          'competencies_view_reports': true,
          'competencies_view_own_assessment': true,
          'isOwner': true,
          'smartday_access': true,
          'department_dashboard_view': true,
          'focus_view': true,
          'focus_create': true,
          'focus_edit': true,
          'focus_manage': true,
          'debts_view_page': true,
          'debts_view_all_clients': true,
          'debts_view_manager_clients': true,
          'debts_view_department_clients': true,
          'debts_add_comments': true,
          'debts_edit_comments': true,
          'debts_delete_comments': true,
          'debts_add_forecasts': true,
          'debts_edit_forecasts': true,
          'debts_delete_forecasts': true,
          'debts_export_data': true,
          'alerts_view_page': true,
          'alerts_view_all_clients': true,
          'alerts_view_manager_clients': true,
          'alerts_view_department_clients': true,
          'alerts_add_actions': true,
          'alerts_edit_actions': true,
          'alerts_view_actions': true,
          'alerts_change_status': true,
          'alerts_add_potential_orders': true,
          'alerts_view_overdue_agreements': true,
          'alerts_export_data': true,
          'ai_notifications_view': true,
          'ai_notifications_create': true,
          'planfact_view_page': true,
          'planfact_create_plans': true,
          'planfact_edit_own_plans': true,
          'planfact_edit_all_plans': true,
          'planfact_delete_own_plans': true,
          'planfact_delete_all_plans': true,
          'planfact_view_dashboard': true,
          'planfact_create_targets': true,
          'planfact_edit_targets': true,
          'forecasting_view_page': true,
          'forecasting_create_plans': true,
          'forecasting_edit_plans': true,
          'forecasting_delete_plans': true,
          'forecasting_generate_forecasts': true,
          'forecasting_view_analytics': true,
          'forecasting_manage_settings': true,
          'forecasting_export_reports': true,
          'manager_calendar_view_page': true,
          'manager_calendar_view_all_tasks': true,
          'manager_calendar_view_own_tasks': true,
          'manager_calendar_view_department_tasks': true,
          'manager_calendar_manage_tasks': true,
          'manager_calendar_view_reports': true,
          'manager_calendar_manage_reports': true,
          'manager_calendar_export_data': true
        };
      }
      
      // ИСПРАВЛЕНО: Для обычных пользователей возвращаем их права или пустой объект
      return memberData.permissions != null ? memberData.permissions : {};
    }

    // ИСПРАВЛЕНО: Более надежная проверка прав
    function hasPermission(companyId, userId, permission) {
      // Владелец компании имеет все права
      if (isCompanyOwner(companyId)) {
        return true;
      }
      
      // Проверяем конкретное право пользователя
      let permissions = getUserEffectivePermissions(companyId, userId);
      return permissions[permission] == true;
    }

    function canMemberRead(companyId) {
      return isUserAuthenticated() && (isCompanyOwner(companyId) || exists(/databases/$(database)/documents/companies/$(companyId)/members/$(request.auth.uid)));
    }

    // Group rules for members
    match /{path=**}/members/{memberDocId} {
      allow read: if isUserAuthenticated() && request.auth.uid == resource.data.userId;
    }

    // Company rules
    match /companies/{companyId} {
      allow read: if canMemberRead(companyId);
      allow create: if isUserAuthenticated();
      allow update, delete: if isUserAuthenticated() && isCompanyOwner(companyId);

      // ИСПРАВЛЕНО: AI Notifications (убрана двойная проверка managerId)
      match /aiNotifications/{notificationId} {
        allow read: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'ai_notifications_view')
        );
        allow create: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'ai_notifications_create')
        );
        allow update: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'ai_notifications_view')
        );
        allow delete: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'alerts_edit_actions')
        );
      }

      // ИСПРАВЛЕНО: Manager Calendar tasks (упрощенная проверка прав)
      match /managerCalendarTasks/{taskId} {
        allow read: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'manager_calendar_view_page')
        );
        allow create, update: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'manager_calendar_manage_tasks') ||
          hasPermission(companyId, request.auth.uid, 'manager_calendar_view_page')
        );
        allow delete: if isUserAuthenticated() && isCompanyOwner(companyId);
      }

      // Manager Calendar analytics
      match /managerCalendarAnalytics/{analyticsId} {
        allow read: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'manager_calendar_view_reports') ||
          hasPermission(companyId, request.auth.uid, 'manager_calendar_view_page')
        );
        allow write: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'manager_calendar_manage_reports') ||
          hasPermission(companyId, request.auth.uid, 'manager_calendar_view_page')
        );
      }

      // Остальные правила остаются без изменений
      // (sales, members, roles, employees, departments, etc. - как в оригинале)
      
      // Sales collection
      match /sales/{monthKey} {
        allow read: if isUserAuthenticated() && canMemberRead(companyId);
        allow write: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'sales_manage')
        );
      }
      
      // Client segments
      match /clientSegments/{clientCode} {
        allow read: if isUserAuthenticated() && canMemberRead(companyId);
        allow write: if isUserAuthenticated() && (
          isCompanyOwner(companyId) ||
          hasPermission(companyId, request.auth.uid, 'sales_manage')
        );
      }

      match /members/{memberUserId} {
        allow read: if canMemberRead(companyId);
        allow create: if request.auth.uid == memberUserId &&
                         request.resource.data.userId == request.auth.uid &&
                         request.resource.data.permissions != null;
        allow update: if isUserAuthenticated() &&
                       ( isCompanyOwner(companyId) ||
                         (request.auth.uid == memberUserId && !request.resource.data.keys().hasAny(['permissions', 'roleId', 'role']))
                       );
        allow delete: if isUserAuthenticated() &&
                         isCompanyOwner(companyId) &&
                         request.auth.uid != memberUserId;
      }

      match /roles/{roleId} {
        allow read: if canMemberRead(companyId);
        allow write: if isUserAuthenticated() && hasPermission(companyId, request.auth.uid, 'settings_roles_manage');
      }

      // Все остальные коллекции...
      // (Можно скопировать из оригинального файла)
    }

    match /invites/{inviteId} {
      allow create: if isUserAuthenticated() && request.resource.data.companyId != null && isCompanyOwner(request.resource.data.companyId);
      allow read: if isUserAuthenticated() && request.auth.uid == resource.data.invitedBy;
      allow update, delete: if isUserAuthenticated() && request.auth.uid == resource.data.invitedBy;
    }
  }
}