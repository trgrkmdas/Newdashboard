/**
 * FIREBASE-SERVICE.JS - Firebase Servisi
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';
import { firebaseConfig, isDevelopmentMode, FIREBASE_APP_CHECK_SITE_KEY } from '../core/config.js';
import { safeConsole } from '../core/logger.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Firebase App Check - Bot koruması ve API abuse önleme
try {
    // Sadece production'da App Check aktif (localhost'ta çalışmaz)
    if (!isDevelopmentMode && FIREBASE_APP_CHECK_SITE_KEY) {
        const recaptchaProvider = new ReCaptchaV3Provider(FIREBASE_APP_CHECK_SITE_KEY);
        initializeAppCheck(app, {
            provider: recaptchaProvider,
            isTokenAutoRefreshEnabled: true // Otomatik token yenileme
        });
        if (isDevelopmentMode) {
            safeConsole.log('✅ Firebase App Check initialized (bot koruması aktif)');
        }
    }
} catch (appCheckError) {
    // App Check başlatılamadı - kritik değil, uygulama çalışmaya devam eder
    if (isDevelopmentMode) {
        safeConsole.warn('⚠️ Firebase App Check başlatılamadı (opsiyonel):', appCheckError.message);
    }
}

// Global olarak erişilebilir yap (mevcut kod uyumluluğu için)
window.firebaseAuth = auth;
window.firebaseSignIn = signInWithEmailAndPassword;
window.firebaseSignOut = signOut;
window.firebaseOnAuthStateChanged = onAuthStateChanged;
window.firebaseSendPasswordResetEmail = sendPasswordResetEmail;

// Export
export { app, auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail };

