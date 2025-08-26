// js/firebase.js

// Імпорт необхідних функцій з Firebase SDKs (версія 11.6.1, як вказано у вашому HTML)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    addDoc, 
    onSnapshot, 
    writeBatch, 
    query, 
    where, 
    updateDoc, 
    deleteField, 
    deleteDoc,
    collectionGroup,
    documentId, // Імпортуємо documentId
    serverTimestamp // Додаю serverTimestamp для модуля дебіторки
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    getStorage,
    ref as storageRef, // Перейменовуємо ref, щоб уникнути конфлікту з firebase.ref від RTDB (якщо використовується)
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


// Ваша конфігурація Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBCsLElef1PrZsbCGWy0wwh3qNu3HmT7zc",
    authDomain: "tabel-a62f4.firebaseapp.com",
    projectId: "tabel-a62f4",
    storageBucket: "tabel-a62f4.appspot.com", // Виправлено на .appspot.com
    messagingSenderId: "988516358004",
    appId: "1:988516358004:web:e3c9b23c5fb48baa9dfe21"
};

// Ініціалізація Firebase
const app = initializeApp(firebaseConfig);

// Експортуємо сервіси Firebase Authentication, Cloud Firestore та Storage
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // Ініціалізація та експорт Storage

// Експортуємо всі функції, які потрібні в інших модулях проекту.
export {
    // Функції Firebase Authentication
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    
    // Функції Cloud Firestore
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    onSnapshot,
    writeBatch,
    query,
    where,
    updateDoc,
    deleteField,
    deleteDoc,
    collectionGroup,
    documentId, // Додано documentId для експорту
    serverTimestamp, // Додано serverTimestamp для експорту

    // Функції Firebase Storage
    storageRef,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
};