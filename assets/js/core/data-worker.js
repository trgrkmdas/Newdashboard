/**
 * DATA WORKER - Web Worker for GZIP Decompression and JSON Parsing
 * AŞAMA 2: Web Worker implementasyonu - Main thread'i bloklamadan ağır işlemler
 * 
 * ÖZELLİKLER:
 * - GZIP açma (pako kütüphanesi ile)
 * - JSON parse işlemleri
 * - Progress callback desteği
 * - Error handling
 */

// Worker içinde pako kütüphanesini yükle
// AŞAMA 2 OPTİMİZASYON: Pako'yu CDN'den yükle (main thread'de zaten yüklenmiş, cache'den hızlı)
let pakoLoaded = false;

// Pako'yu yükle (CDN'den - cache'den hızlı yüklenecek)
try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
    pakoLoaded = typeof pako !== 'undefined';
} catch (e) {
    // CSP veya network hatası - fallback kullanılacak
    console.warn('[Worker] Pako CDN\'den yüklenemedi:', e);
    pakoLoaded = false;
}

/**
 * GZIP açma fonksiyonu
 * @param {Uint8Array} uint8Array - Sıkıştırılmış veri
 * @returns {string} - Açılmış string
 */
function decompressGzip(uint8Array) {
    if (!pakoLoaded) {
        throw new Error('Pako kütüphanesi yüklenemedi');
    }
    
    try {
        return pako.ungzip(uint8Array, { to: 'string' });
    } catch (error) {
        throw new Error(`GZIP açma hatası: ${error.message}`);
    }
}

/**
 * JSON parse fonksiyonu
 * @param {string} jsonString - JSON string
 * @returns {object} - Parse edilmiş obje
 */
function parseJSON(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        if (error.message && error.message.includes('Unexpected token')) {
            throw new Error('Geçersiz JSON formatı - HTML sayfası döndü (404)');
        }
        throw error;
    }
}

/**
 * İndirim ürünlerinin tutarını negatif yapan fonksiyon
 * TEST MODU: İndirim mantığı devre dışı (Odoo zaten indirimleri düşüyor)
 * NOT: Bu fonksiyon main thread'deki applyDiscountLogic ile aynı olmalı
 * @param {object} item - Veri öğesi
 * @returns {object} - İşlenmiş veri öğesi
 */
function applyDiscountLogic(item) {
    // TEST MODU: İndirim mantığı devre dışı
    // Main thread'deki fonksiyonun aynısı
    return item;
    
    // ORİJİNAL KOD (şimdilik devre dışı):
    // İndirim ürünlerini tespit et
    // const productName = (item.product || '').toLowerCase();
    // if (productName.includes('[disc]') ||
    //     productName.includes('indirim') || 
    //     productName.includes('discount') ||
    //     productName.includes('toplam tutarda indirim') ||
    //     (productName.includes('%') && productName.includes('ürünlerde indirim')) ||
    //     (productName.includes('%') && productName.includes('indirim')) ||
    //     productName.includes('ücretsiz')) {
    //     return {
    //         ...item,
    //         usd_amount: -Math.abs(parseFloat(item.usd_amount || 0)),
    //         quantity: Math.abs(parseFloat(item.quantity || 0)),
    //         _isDiscount: true
    //     };
    // }
    // return item;
}

/**
 * Worker message handler
 */
self.addEventListener('message', async function(e) {
    const { type, data, taskId } = e.data;
    
    try {
        switch (type) {
            case 'decompress-gzip': {
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 10,
                    message: 'GZIP açılıyor...'
                });
                
                const uint8Array = new Uint8Array(data);
                const decompressed = decompressGzip(uint8Array);
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 50,
                    message: 'GZIP açıldı'
                });
                
                // Sonucu gönder
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: decompressed
                });
                break;
            }
            
            case 'parse-json': {
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 60,
                    message: 'JSON parse ediliyor...'
                });
                
                const parsed = parseJSON(data);
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 90,
                    message: 'JSON parse edildi'
                });
                
                // Sonucu gönder
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: parsed
                });
                break;
            }
            
            case 'decompress-and-parse': {
                const totalStart = performance.now();
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 10,
                    message: 'GZIP açılıyor...'
                });
                
                // GZIP açma süresini ölç
                const gzipStart = performance.now();
                const uint8Array = new Uint8Array(data);
                const decompressed = decompressGzip(uint8Array);
                const gzipDuration = performance.now() - gzipStart;
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 50,
                    message: `GZIP açıldı (${gzipDuration.toFixed(1)}ms), JSON parse ediliyor...`
                });
                
                // JSON parse süresini ölç
                const parseStart = performance.now();
                const parsed = parseJSON(decompressed);
                const parseDuration = performance.now() - parseStart;
                const totalDuration = performance.now() - totalStart;
                
                // Progress mesajı
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 90,
                    message: `JSON parse edildi (${parseDuration.toFixed(1)}ms)`
                });
                
                // Sonucu gönder
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: parsed
                });
                break;
            }
            
            case 'process-data-chunk': {
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 10,
                    message: 'Veri işleniyor...'
                });
                
                // Chunk'ı işle - applyDiscountLogic uygula
                const processed = data.map(item => applyDiscountLogic(item));
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 90,
                    message: 'Veri işlendi'
                });
                
                // Sonucu gönder
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: processed
                });
                break;
            }
            
            default:
                throw new Error(`Bilinmeyen işlem tipi: ${type}`);
        }
    } catch (error) {
        // Hata durumunda
        self.postMessage({
            type: 'error',
            taskId,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});

// Worker başlatıldığında
self.postMessage({
    type: 'ready',
    pakoLoaded
});

