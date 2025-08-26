// utils.js - Общие утилиты для модуля План-Факт

import { getState } from './state.js';

/**
 * Форматирование валюты
 */
export function formatCurrency(amount) {
    if (!amount) return '0';
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Форматирование ключа месяца
 */
export function formatMonthKey(monthKey) {
    if (!monthKey) return '';
    
    if (monthKey.includes('-')) {
        const [year, month] = monthKey.split('-');
        const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                           'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    
    if (monthKey.length === 6) {
        const year = monthKey.substring(0, 4);
        const month = monthKey.substring(4, 6);
        const monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                           'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    
    return monthKey;
}

/**
 * Получение названия отдела по ID
 */
export function getDepartmentName(departmentId) {
    if (!departmentId) return 'Не вказано';
    const state = getState();
    const department = state.planFactData?.departments?.find(dept => dept.id === departmentId);
    return department ? department.name : departmentId;
}

/**
 * Получение типа фокуса по ID
 */
export function getFocusTypeById(focusTypeId) {
    if (!focusTypeId) return null;
    const state = getState();
    return state.planFactData?.focusTypes?.find(type => type.id === focusTypeId) || null;
}

/**
 * Показ тост-сообщения (fallback если основная функция недоступна)
 */
export function showToastSafe(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

/**
 * Безопасное закрытие модального окна
 */
export function closeModalSafe(modalId) {
    if (typeof window.closeModal === 'function') {
        window.closeModal(modalId);
    } else {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }
}

/**
 * Генерация уникального ID
 */
export function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Форматирование процентов
 */
export function formatPercent(value) {
    if (!value) return '0%';
    return `${Math.round(value)}%`;
}

/**
 * Получение цвета статуса
 */
export function getStatusColor(status) {
    switch (status) {
        case 'active': return 'bg-green-600';
        case 'draft': return 'bg-yellow-600';
        case 'completed': return 'bg-blue-600';
        case 'archived': return 'bg-gray-600';
        default: return 'bg-gray-600';
    }
}

/**
 * Получение текста статуса
 */
export function getStatusText(status) {
    switch (status) {
        case 'active': return 'Активний';
        case 'draft': return 'Чернетка';
        case 'completed': return 'Завершений';
        case 'archived': return 'Архівний';
        default: return 'Невідомо';
    }
} 