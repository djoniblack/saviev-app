// logger.js - Простой логгер для модулей

const DEBUG_MODE = true; // ВРЕМЕННО ВКЛЮЧАЕМ ДЛЯ ДИАГНОСТИКИ
const LOG_LEVEL = 'verbose'; // ВРЕМЕННО ВКЛЮЧАЕМ ПОДРОБНЫЕ ЛОГИ

export const logger = {
    verbose: (...args) => {
        if (DEBUG_MODE && LOG_LEVEL === 'verbose') {
            console.log('[LOGGER]', ...args);
        }
    },
    info: (...args) => {
        if (DEBUG_MODE) {
            console.log('[LOGGER]', ...args);
        }
    },
    warn: (...args) => {
        if (DEBUG_MODE) {
            console.warn('[LOGGER]', ...args);
        }
    },
    error: (...args) => {
        console.error('[LOGGER]', ...args);
    },
    isDebugMode: () => DEBUG_MODE
}; 