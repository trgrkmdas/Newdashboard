/**
 * CHUNKED PROCESSOR - Chunk'lara bölerek işleme
 * DEPRECATED: Bu modül artık kullanılmıyor. Web Worker kullanımına geçildi.
 * Worker gerçek paralellik sağlar ve daha iyi performans sunar.
 * 
 * Bu dosya geriye uyumluluk için korunuyor ama yeni kodda kullanılmamalı.
 * 
 * @deprecated Web Worker kullanın (worker-manager.js)
 */

import { safeConsole } from './logger.js';

/**
 * Chunked GZIP açma (optimize edilmiş)
 * Not: Pako streaming API yok, bu yüzden tam açma yapıyoruz ama requestIdleCallback ile optimize ediyoruz
 */
export async function decompressGzipChunked(uint8Array, onProgress = null) {
    return new Promise((resolve, reject) => {
        if (typeof pako === 'undefined') {
            reject(new Error('Pako kütüphanesi yüklenmedi'));
            return;
        }
        
        // Progress: GZIP açma başladı
        if (onProgress) {
            onProgress(10, 'GZIP açılıyor...');
        }
        
        // Büyük dosyalar için requestIdleCallback kullan
        const decompressInIdle = () => {
            try {
                const startTime = performance.now();
                const decompressed = pako.ungzip(uint8Array, { to: 'string' });
                const duration = performance.now() - startTime;
                
                // Progress: GZIP açıldı
                if (onProgress) {
                    onProgress(50, `GZIP açıldı (${duration.toFixed(0)}ms)`);
                }
                
                safeConsole.log(`✅ GZIP açıldı: ${(decompressed.length / 1024 / 1024).toFixed(2)} MB (${duration.toFixed(0)}ms)`);
                resolve(decompressed);
            } catch (error) {
                reject(error);
            }
        };
        
        // Dosya boyutuna göre strateji seç
        const fileSizeMB = uint8Array.length / 1024 / 1024;
        
        if (fileSizeMB > 10) {
            // 10MB'dan büyükse: requestIdleCallback (daha agresif timeout)
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(decompressInIdle, { timeout: 1000 });
            } else {
                // Fallback: setTimeout
                setTimeout(decompressInIdle, 0);
            }
        } else if (fileSizeMB > 5) {
            // 5-10MB arası: requestIdleCallback (orta timeout)
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(decompressInIdle, { timeout: 500 });
            } else {
                setTimeout(decompressInIdle, 0);
            }
        } else {
            // 5MB'dan küçükse: direkt işle
            decompressInIdle();
        }
    });
}

/**
 * Chunked JSON parsing (optimize edilmiş)
 * Not: JSON parse chunk'lara bölünemez, ama requestIdleCallback ile optimize edebiliriz
 */
export async function parseJSONChunked(jsonString, onProgress = null) {
    return new Promise((resolve, reject) => {
        // Progress: JSON parse başladı
        if (onProgress) {
            onProgress(60, 'JSON parse ediliyor...');
        }
        
        // HTML kontrolü
        const trimmed = jsonString.trim();
        if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
            reject(new Error('Geçersiz JSON formatı - HTML sayfası döndü (404)'));
            return;
        }
        
        // Büyük JSON'lar için requestIdleCallback kullan
        const parseInIdle = () => {
            try {
                const startTime = performance.now();
                const parsed = JSON.parse(jsonString);
                const duration = performance.now() - startTime;
                
                // Progress: JSON parse edildi
                if (onProgress) {
                    onProgress(90, `JSON parse edildi (${duration.toFixed(0)}ms)`);
                }
                
                // Memory cleanup
                jsonString = null;
                
                safeConsole.log(`✅ JSON parse edildi: ${(Object.keys(parsed).length)} keys (${duration.toFixed(0)}ms)`);
                resolve(parsed);
            } catch (error) {
                if (error.message && error.message.includes('Unexpected token')) {
                    reject(new Error('Geçersiz JSON formatı - HTML sayfası döndü (404)'));
                } else {
                    reject(error);
                }
            }
        };
        
        // JSON boyutuna göre strateji seç
        const jsonSizeMB = jsonString.length / 1024 / 1024;
        
        if (jsonSizeMB > 5) {
            // 5MB'dan büyükse: requestIdleCallback (agresif timeout)
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(parseInIdle, { timeout: 500 });
            } else {
                setTimeout(parseInIdle, 0);
            }
        } else {
            // 5MB'dan küçükse: direkt işle
            parseInIdle();
        }
    });
}

/**
 * GZIP açma + JSON parse (tek seferde, optimize edilmiş)
 */
export async function decompressAndParseChunked(arrayBuffer, onProgress = null) {
    const uint8Array = new Uint8Array(arrayBuffer);
    const isGzip = uint8Array.length >= 2 && uint8Array[0] === 0x1F && uint8Array[1] === 0x8B;
    
    if (!isGzip) {
        // GZIP değil, direkt text
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(uint8Array);
        return parseJSONChunked(jsonString, onProgress);
    }
    
    // GZIP aç
    const decompressed = await decompressGzipChunked(uint8Array, onProgress);
    
    // JSON parse et
    const parsed = await parseJSONChunked(decompressed, onProgress);
    
    // Memory cleanup
    decompressed = null;
    
    return parsed;
}

