/**
 * VOICE-SERVICE.JS - Sesli Arama Servisi
 */

import { safeConsole } from '../core/logger.js';

let recognition = null;
let isListening = false;

/**
 * Sesli aramayı başlat
 */
export function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('⚠️ Tarayıcınız ses tanıma özelliğini desteklemiyor!\nChrome veya Edge kullanın.');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (isListening) {
        // Dinlemeyi durdur
        if (recognition) {
            recognition.stop();
        }
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    const voiceBtn = document.getElementById('voiceBtn') || document.getElementById('voiceButton');
    
    recognition.onstart = () => {
        isListening = true;
        if (voiceBtn) {
            voiceBtn.classList.add('listening');
            voiceBtn.textContent = '🎙️';
        }
        safeConsole.log('🎤 Dinleniyor...');
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        safeConsole.log('🗣️ Algılanan:', transcript);
        const searchInput = document.getElementById('smartSearch') || document.querySelector('.search-box input');
        if (searchInput) {
            searchInput.value = transcript;
            // applySmartSearch fonksiyonunu çağır (eğer varsa)
            if (typeof window.applySmartSearch === 'function') {
                window.applySmartSearch();
            }
        }
    };
    
    recognition.onerror = (event) => {
        console.error('❌ Ses tanıma hatası:', event.error);
        if (event.error === 'no-speech') {
            alert('⚠️ Ses algılanamadı. Lütfen tekrar deneyin.');
        } else if (event.error === 'not-allowed') {
            alert('⚠️ Mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından mikrofon izni verin.');
        }
    };
    
    recognition.onend = () => {
        isListening = false;
        if (voiceBtn) {
            voiceBtn.classList.remove('listening');
            voiceBtn.textContent = '🎤';
        }
        safeConsole.log('🎤 Dinleme bitti');
    };
    
    recognition.start();
}

// Global erişim için
window.startVoiceSearch = startVoiceSearch;

