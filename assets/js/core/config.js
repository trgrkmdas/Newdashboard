/**
 * CONFIG.JS - Firebase ve API Konfigürasyonu
 */

// Firebase configuration - Environment variables kullanılacak (Vercel'de ayarlanacak)
// Fallback olarak hardcoded config (development için)
export const firebaseConfig = {
    apiKey: "AIzaSyD3H_v4Tq5h_30U8sZXYM7wARu9GPg3RDk",
    authDomain: "zuhalrapor.firebaseapp.com",
    projectId: "zuhalrapor",
    storageBucket: "zuhalrapor.firebasestorage.app",
    messagingSenderId: "1070847166914",
    appId: "1:1070847166914:web:b9d05ea13fa3bb5f46ee5b",
    measurementId: "G-HV3MES215N"
};

// Development mode kontrolü
export const isDevelopmentMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// API Keys (environment variables'dan alınacak)
export const MXBAI_API_KEY = window.MXBAI_API_KEY || null;
export const MXBAI_STORE_ID = window.MXBAI_STORE_ID || null;
export const FIREBASE_APP_CHECK_SITE_KEY = window.FIREBASE_APP_CHECK_SITE_KEY || null;

