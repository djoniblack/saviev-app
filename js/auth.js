// js/auth.js

import { 
    auth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from './firebase.js';
import { 
    showLoading, 
    showAuthError,
    elements 
} from './ui.js';

/**
 * Ініціалізує слухача стану автентифікації Firebase та прив'язує обробники подій для форм входу/реєстрації/виходу.
 * @param {function(string)} onLogin - Колбек, що викликається при успішному вході користувача, передає UID.
 * @param {function()} onLogout - Колбек, що викликається при виході користувача.
 */
export function initAuthListener(onLogin, onLogout) {
    // Ця частина з прив'язкою слухачів до кнопок залишається без змін
    elements.registerBtn.addEventListener('click', async () => {
        const email = elements.authEmail.value.trim();
        const password = elements.authPassword.value.trim();
        showAuthError('');

        if (!email || !password || password.length < 6) {
            showAuthError('Перевірте email та пароль (мін. 6 символів).');
            return;
        }

        showLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            showAuthError('Помилка реєстрації. Можливо, такий email вже існує.');
        } finally {
            showLoading(false);
        }
    });

    elements.loginBtn.addEventListener('click', async () => {
        const email = elements.authEmail.value.trim();
        const password = elements.authPassword.value.trim();
        showAuthError('');

        if (!email || !password) {
            showAuthError('Будь ласка, введіть email та пароль.');
            return;
        }
        
        showLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            showAuthError('Невірний email або пароль.');
        } finally {
            showLoading(false);
        }
    });
    
    elements.logoutBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Помилка виходу:", error);
        } finally {
            showLoading(false);
        }
    });

    // Головний слухач зміни стану автентифікації Firebase
    onAuthStateChanged(auth, (user) => {
        // --- ОСНОВНА ЗМІНА ТУТ ---
        // Ми більше не викликаємо showPage() або інші UI функції звідси.
        // Ми лише повідомляємо main.js про подію, викликаючи передані колбеки.
        if (user) {
            // Користувач увійшов. Викликаємо onLogin з main.js.
            onLogin(user.uid);
        } else {
            // Користувач вийшов. Викликаємо onLogout з main.js.
            onLogout();
        }
    });
}