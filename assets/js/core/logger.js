/**
 * LOGGER.JS - Log Yönetimi ve Güvenlik
 */

// Development mode kontrolü (config.js'den bağımsız)
const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * Hassas bilgi filtreleme fonksiyonu
 */
function sanitizeForLogging(data) {
    if (!data) return data;
    const sensitivePatterns = [
        /password/gi,
        /token/gi,
        /apikey/gi,
        /api_key/gi,
        /secret/gi,
        /credential/gi,
        /auth/gi,
        /firebaseToken/gi
    ];
    
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Hassas bilgi içeriyor mu kontrol et
    const hasSensitive = sensitivePatterns.some(pattern => pattern.test(dataStr));
    
    if (hasSensitive) {
        // Production'da hassas bilgiyi tamamen gizle
        if (!IS_DEVELOPMENT) {
            return '[Hassas bilgi gizlendi]';
        }
        // Development'ta kısmi göster (ilk/last karakter)
        return dataStr.replace(/(password|token|apikey|api_key|secret|credential|auth|firebaseToken)\s*[=:]\s*['"]?([^'";\s]+)/gi, 
            (match, key, value) => {
                if (value.length > 4) {
                    return `${key}='${value.substring(0, 2)}...${value.substring(value.length - 2)}'`;
                }
                return `${key}='***'`;
            });
    }
    return data;
}

/**
 * Güvenli console wrapper
 */
export const safeConsole = {
    log: IS_DEVELOPMENT ? console.log.bind(console) : () => {},
    warn: IS_DEVELOPMENT ? console.warn.bind(console) : () => {},
    error: function(...args) {
        // Production'da hassas bilgiyi filtrele
        if (IS_DEVELOPMENT) {
            console.error(...args);
        } else {
            // Production'da sadece güvenli hata mesajları göster
            const sanitized = args.map(arg => sanitizeForLogging(arg));
            console.error(...sanitized);
        }
    },
    info: IS_DEVELOPMENT ? console.info.bind(console) : () => {},
    debug: IS_DEVELOPMENT ? console.debug.bind(console) : () => {}
};

// Global erişim için
window.safeConsole = safeConsole;

