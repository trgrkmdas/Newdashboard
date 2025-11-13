/**
 * INDEXEDDB CACHE - Parse edilmiş veri cache yönetimi
 * AŞAMA 3: Hybrid Optimization - IndexedDB Caching
 * AŞAMA 4: Compression Optimization - GZIP ile sıkıştırılmış cache
 * 
 * ÖZELLİKLER:
 * - Parse edilmiş JSON verilerini IndexedDB'de sakla
 * - GZIP compression ile sıkıştırılmış saklama (daha hızlı transfer)
 * - Cache versioning (veri güncellendiğinde cache'i temizle)
 * - Otomatik cache invalidation
 * - Storage quota yönetimi
 */

import { safeConsole } from './logger.js';
import { getDailyVersion } from './utils.js';
import { getWorkerManager } from './worker-manager.js';

const DB_NAME = 'ZuhalMusicCache';
const DB_VERSION = 1;
const STORE_NAME = 'parsedData';
const CACHE_VERSION_KEY = 'cacheVersion';
const COMPRESSION_LEVEL = 1; // Düşük sıkıştırma (level 1) - hızlı decompression

class IndexedDBCache {
    constructor() {
        this.db = null;
        this.isSupported = typeof indexedDB !== 'undefined';
    }
    
    /**
     * IndexedDB'yi başlat
     */
    async init() {
        if (!this.isSupported) {
            safeConsole.warn('⚠️ IndexedDB desteklenmiyor, cache kullanılamayacak');
            return false;
        }
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                safeConsole.error('❌ IndexedDB açılamadı:', request.error);
                resolve(false);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                safeConsole.log('✅ IndexedDB cache hazır');
                resolve(true);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Object store oluştur
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    objectStore.createIndex('year', 'year', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }
    
    /**
     * Cache'den veri al
     * @param {string} year - Yıl (örn: "2025")
     * @returns {Promise<object|null>} - Cache'den veri veya null
     */
    async get(year) {
        if (!this.db || !this.isSupported) {
            return null;
        }
        
        try {
            const cacheKey = `yearData-${year}`;
            // Cache version: günlük versiyon + compression level (level değiştiğinde cache yenilenecek)
            const version = `${getDailyVersion()}-cl${COMPRESSION_LEVEL}`;
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(cacheKey);
                
                request.onsuccess = () => {
                    const result = request.result;
                    
                    if (!result) {
                        resolve(null);
                        return;
                    }
                    
                    // Cache version kontrolü
                    if (result.version !== version) {
                        // Eski cache'i sil
                        this.delete(cacheKey).catch(() => {});
                        resolve(null);
                        return;
                    }
                    
                    // Cache timestamp kontrolü (24 saat)
                    const cacheAge = Date.now() - result.timestamp;
                    const maxAge = 24 * 60 * 60 * 1000; // 24 saat
                    
                    if (cacheAge > maxAge) {
                        this.delete(cacheKey).catch(() => {});
                        resolve(null);
                        return;
                    }
                    
                    // Veriyi aç (sıkıştırılmışsa)
                    let data = result.data;
                    if (result.compressed && typeof pako !== 'undefined') {
                        try {
                            // IndexedDB'den gelen veri Uint8Array veya Array olabilir
                            const uint8Array = result.data instanceof Uint8Array 
                                ? result.data 
                                : new Uint8Array(result.data);
                            const decompressed = pako.ungzip(uint8Array, { to: 'string' });
                            data = JSON.parse(decompressed);
                        } catch (decompressError) {
                            safeConsole.warn(`⚠️ Decompression hatası (${year}):`, decompressError);
                            // Fallback: Sıkıştırılmamış olarak dene
                            data = result.data;
                        }
                    } else if (result.compressed) {
                        safeConsole.warn(`⚠️ ${year} sıkıştırılmış ama pako yüklü değil, cache atlanıyor`);
                        resolve(null);
                        return;
                    }
                    
                    resolve(data);
                };
                
                request.onerror = () => {
                    safeConsole.warn(`⚠️ Cache okuma hatası (${year}):`, request.error);
                    resolve(null);
                };
            });
        } catch (error) {
            safeConsole.error(`❌ Cache get hatası (${year}):`, error);
            return null;
        }
    }
    
    /**
     * Birden fazla yıl verisini tek transaction'da oku (optimizasyon)
     * Worker ile paralel decompression kullanır
     * @param {Array<string>} years - Yıl listesi (örn: ["2023", "2024", "2025"])
     * @returns {Promise<Object>} - {year: data} formatında sonuçlar
     */
    async getBatch(years) {
        if (!this.db || !this.isSupported || !Array.isArray(years) || years.length === 0) {
            return {};
        }
        
        try {
            // Cache version: günlük versiyon + compression level (level değiştiğinde cache yenilenecek)
            const version = `${getDailyVersion()}-cl${COMPRESSION_LEVEL}`;
            const cacheKeys = years.map(year => `yearData-${year}`);
            const startTime = performance.now();
            
            // OPTİMİZASYON: IndexedDB'den okuma işlemini optimize et
            // Transaction'ı daha verimli kullan ve request'leri optimize et
            const readStartTime = performance.now();
            const rawResults = await new Promise((resolve, reject) => {
                // Transaction'ı optimize et: 'readonly' modu daha hızlı
                const transaction = this.db.transaction([STORE_NAME], 'readonly', {
                    durability: 'relaxed' // Daha hızlı, durability garantisi daha düşük
                });
                const store = transaction.objectStore(STORE_NAME);
                const rawData = {};
                let completed = 0;
                const maxAge = 24 * 60 * 60 * 1000; // 24 saat
                
                // Transaction'ın tamamlanmasını bekle (tüm request'ler bitene kadar)
                transaction.oncomplete = () => {
                    resolve(rawData);
                };
                
                transaction.onerror = () => {
                    safeConsole.error(`❌ IndexedDB transaction hatası:`, transaction.error);
                    resolve(rawData); // Hata olsa bile mevcut verileri döndür
                };
                
                // Tüm yılları paralel oku (tek transaction içinde)
                // OPTİMİZASYON: Request'leri hemen başlat (sıralı değil, paralel)
                cacheKeys.forEach((cacheKey, index) => {
                    const year = years[index];
                    const request = store.get(cacheKey);
                    
                    request.onsuccess = () => {
                        const result = request.result;
                        
                        if (result) {
                            // Cache version kontrolü (hızlı kontrol - önce version)
                            if (result.version === version) {
                                // Cache timestamp kontrolü
                                const cacheAge = Date.now() - result.timestamp;
                                if (cacheAge <= maxAge) {
                                    // OPTİMİZASYON: Veriyi hemen kaydet (decompression sonra yapılacak)
                                    rawData[year] = {
                                        data: result.data,
                                        compressed: result.compressed || false
                                    };
                                } else {
                                    this.delete(cacheKey).catch(() => {});
                                }
                            } else {
                                this.delete(cacheKey).catch(() => {});
                            }
                        }
                        
                        completed++;
                        // Tüm request'ler tamamlandı mı kontrol et
                        // Transaction.oncomplete zaten çağrılacak ama manuel kontrol de yap
                        if (completed === cacheKeys.length && transaction.readyState === 'done') {
                            // Transaction zaten tamamlandı, oncomplete çağrılacak
                        }
                    };
                    
                    request.onerror = () => {
                        safeConsole.warn(`⚠️ Cache okuma hatası (${year}):`, request.error);
                        completed++;
                        // Hata olsa bile devam et
                        if (completed === cacheKeys.length && transaction.readyState === 'done') {
                            // Transaction zaten tamamlandı
                        }
                    };
                });
            });
            
            // Şimdi sıkıştırılmış verileri Worker'da paralel aç
            // Her yıl için ayrı worker instance'ı oluştur (gerçek paralellik)
            const decompressStartTime = performance.now();
            const decompressPromises = [];
            const results = {};
            const workers = [];
            const decompressTimes = {}; // Her yıl için süre ölçümü
            
            for (const [year, rawData] of Object.entries(rawResults)) {
                if (rawData.compressed) {
                    // Her yıl için ayrı worker oluştur (gerçek paralellik)
                    if (typeof Worker !== 'undefined') {
                        try {
                            const yearDecompressStart = performance.now();
                            
                            // Uint8Array'i ArrayBuffer'a çevir (her worker için kopya oluştur)
                            const uint8Array = rawData.data instanceof Uint8Array 
                                ? rawData.data 
                                : new Uint8Array(rawData.data);
                            
                            // ArrayBuffer kopyası oluştur (transfer için)
                            const arrayBufferCopy = uint8Array.buffer.slice(
                                uint8Array.byteOffset,
                                uint8Array.byteOffset + uint8Array.byteLength
                            );
                            
                            // Fallback için uint8Array kopyası (worker hatası durumunda)
                            const uint8ArrayCopy = new Uint8Array(uint8Array);
                            
                            // Yeni worker instance'ı oluştur
                            const worker = new Worker('assets/js/core/data-worker.js');
                            let workerTiming = null; // Worker'dan gelen timing bilgisi
                            const workerPromise = new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => {
                                    worker.terminate();
                                    reject(new Error(`Worker timeout (${year})`));
                                }, 30000); // 30 saniye timeout

                                worker.addEventListener('message', (e) => {
                                    if (e.data.type === 'ready') {
                                        // Worker hazır, decompress task'ı gönder
                                        worker.postMessage({
                                            type: 'decompress-and-parse',
                                            data: arrayBufferCopy,
                                            taskId: year
                                        }, [arrayBufferCopy]); // Transferable - ownership transfer edilir
                                    } else if (e.data.type === 'success') {
                                        clearTimeout(timeout);
                                        worker.terminate();
                                        const yearDecompressDuration = performance.now() - yearDecompressStart;
                                        decompressTimes[year] = yearDecompressDuration;
                                        results[year] = e.data.result;
                                        
                                        // Worker timing bilgisi varsa göster
                                        if (workerTiming) {
                                            const { gzip, parse, total } = workerTiming;
                                            safeConsole.log(`✅ ${year} decompression: ${yearDecompressDuration.toFixed(1)}ms (Worker: GZIP=${gzip.toFixed(1)}ms, Parse=${parse.toFixed(1)}ms, Total=${total.toFixed(1)}ms)`);
                                        }
                                        resolve({ year, success: true });
                                    } else if (e.data.type === 'error') {
                                        clearTimeout(timeout);
                                        worker.terminate();
                                        reject(new Error(e.data.error));
                                    }
                                });
                                
                                worker.addEventListener('error', (error) => {
                                    clearTimeout(timeout);
                                    worker.terminate();
                                    reject(error);
                                });
                            });
                            
                            decompressPromises.push(
                                workerPromise.catch(error => {
                                    safeConsole.warn(`⚠️ Worker decompression hatası (${year}):`, error);
                                    // Fallback: Main thread'de dene
                                    try {
                                        const decompressed = pako.ungzip(uint8ArrayCopy, { to: 'string' });
                                        results[year] = JSON.parse(decompressed);
                                        const fallbackDuration = performance.now() - yearDecompressStart;
                                        decompressTimes[year] = fallbackDuration;
                                        return { year, success: true };
                                    } catch (fallbackError) {
                                        safeConsole.error(`❌ Fallback decompression hatası (${year}):`, fallbackError);
                                        return { year, success: false };
                                    }
                                })
                            );
                            
                            workers.push(worker);
                        } catch (error) {
                            safeConsole.warn(`⚠️ Worker oluşturma hatası (${year}), fallback kullanılıyor:`, error);
                            // Fallback: Main thread'de dene
                            try {
                                const uint8Array = rawData.data instanceof Uint8Array 
                                    ? rawData.data 
                                    : new Uint8Array(rawData.data);
                                const decompressed = pako.ungzip(uint8Array, { to: 'string' });
                                results[year] = JSON.parse(decompressed);
                            } catch (fallbackError) {
                                safeConsole.error(`❌ Fallback decompression hatası (${year}):`, fallbackError);
                            }
                        }
                    } else {
                        // Worker desteklenmiyor, main thread'de dene
                        try {
                            const uint8Array = rawData.data instanceof Uint8Array 
                                ? rawData.data 
                                : new Uint8Array(rawData.data);
                            const decompressed = pako.ungzip(uint8Array, { to: 'string' });
                            results[year] = JSON.parse(decompressed);
                        } catch (error) {
                            safeConsole.error(`❌ Decompression hatası (${year}):`, error);
                        }
                    }
                } else {
                    // Sıkıştırılmamış, direkt kullan
                    results[year] = rawData.data;
                }
            }
            
            // Tüm decompression'ları bekle (gerçek paralellik - her yıl için ayrı worker)
            if (decompressPromises.length > 0) {
                const decompressAllStart = performance.now();
                await Promise.all(decompressPromises);
                const decompressAllDuration = performance.now() - decompressAllStart;
                
                // Decompression süre özeti
                const decompressSummary = Object.entries(decompressTimes)
                    .map(([year, time]) => `${year}: ${time.toFixed(1)}ms`)
                    .join(', ');
                safeConsole.log(`⚡ Decompression: ${decompressAllDuration.toFixed(1)}ms (${decompressSummary})`);
                
                // Paralellik analizi: En uzun süre = gerçek paralel süre
                const maxDecompressTime = Math.max(...Object.values(decompressTimes));
                const totalDecompressTime = Object.values(decompressTimes).reduce((sum, time) => sum + time, 0);
                const parallelEfficiency = ((totalDecompressTime / decompressAllDuration) * 100).toFixed(1);
                safeConsole.log(`📊 Paralellik: En uzun ${maxDecompressTime.toFixed(1)}ms, Toplam ${totalDecompressTime.toFixed(1)}ms, Verimlilik %${parallelEfficiency}`);
            }
            
            const duration = performance.now() - startTime;
            safeConsole.log(`⚡ Cache batch: ${Object.keys(results).length} yıl ${duration.toFixed(1)}ms'de yüklendi`);
            
            return results;
        } catch (error) {
            safeConsole.error(`❌ Cache batch get hatası:`, error);
            return {};
        }
    }
    
    /**
     * Cache'e veri kaydet (GZIP compression ile)
     * @param {string} year - Yıl (örn: "2025")
     * @param {object} data - Parse edilmiş veri
     */
    async set(year, data) {
        if (!this.db || !this.isSupported) {
            return false;
        }
        
        try {
            const cacheKey = `yearData-${year}`;
            // Cache version: günlük versiyon + compression level (level değiştiğinde cache yenilenecek)
            const version = `${getDailyVersion()}-cl${COMPRESSION_LEVEL}`;
            
            // Veriyi JSON string'e çevir
            const jsonString = JSON.stringify(data);
            const originalSize = jsonString.length;
            
            // GZIP ile sıkıştır (pako library kullan)
            let compressedData = null;
            let compressedSize = originalSize;
            
            if (typeof pako !== 'undefined') {
                try {
                    // OPTİMİZASYON: Düşük sıkıştırma (level 1) - daha hızlı decompression
                    // Level 1: En hızlı sıkıştırma/açma, daha az sıkıştırma oranı
                    // Level 6 (default): Yüksek sıkıştırma, yavaş açma
                    const compressed = pako.gzip(jsonString, { level: COMPRESSION_LEVEL });
                    // IndexedDB structured clone algorithm Uint8Array'i destekler
                    compressedData = new Uint8Array(compressed);
                    compressedSize = compressed.length;
                    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
                } catch (compressError) {
                    safeConsole.warn(`⚠️ Sıkıştırma hatası (${year}), sıkıştırılmamış saklanacak:`, compressError);
                    // Fallback: Sıkıştırılmamış sakla
                    compressedData = null;
                }
            } else {
                safeConsole.warn(`⚠️ Pako library yüklü değil, ${year} sıkıştırılmamış saklanacak`);
            }
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const cacheEntry = {
                    key: cacheKey,
                    year: year,
                    data: compressedData || data, // Sıkıştırılmış veya sıkıştırılmamış
                    compressed: compressedData !== null, // Sıkıştırılmış mı?
                    version: version,
                    timestamp: Date.now(),
                    size: compressedSize, // Sıkıştırılmış boyut
                    originalSize: originalSize // Orijinal boyut (decompression için)
                };
                
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    resolve(true);
                };
                
                request.onerror = () => {
                    // Quota exceeded hatası olabilir
                    if (request.error.name === 'QuotaExceededError') {
                        safeConsole.warn(`⚠️ Cache storage dolu (${year}), eski cache'ler temizlenecek`);
                        this.clearOldCache().then(() => {
                            // Tekrar dene
                            this.set(year, data).then(resolve).catch(reject);
                        }).catch(reject);
                    } else {
                        safeConsole.warn(`⚠️ Cache kaydetme hatası (${year}):`, request.error);
                        resolve(false);
                    }
                };
            });
        } catch (error) {
            safeConsole.error(`❌ Cache set hatası (${year}):`, error);
            return false;
        }
    }
    
    /**
     * Cache'den veri sil
     * @param {string} key - Cache key
     */
    async delete(key) {
        if (!this.db || !this.isSupported) {
            return false;
        }
        
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(key);
                
                request.onsuccess = () => {
                    resolve(true);
                };
                
                request.onerror = () => {
                    resolve(false);
                };
            });
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Eski cache'leri temizle (storage quota için)
     */
    async clearOldCache() {
        if (!this.db || !this.isSupported) {
            return false;
        }
        
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('timestamp');
                
                // 7 günden eski cache'leri sil
                const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                const range = IDBKeyRange.upperBound(sevenDaysAgo);
                const request = index.openCursor(range);
                
                let deletedCount = 0;
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        deletedCount++;
                        cursor.continue();
                    } else {
                        safeConsole.log(`🗑️ Eski cache temizlendi: ${deletedCount} kayıt`);
                        resolve(true);
                    }
                };
                
                request.onerror = () => {
                    resolve(false);
                };
            });
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Tüm cache'i temizle
     */
    async clear() {
        if (!this.db || !this.isSupported) {
            return false;
        }
        
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();
                
                request.onsuccess = () => {
                    safeConsole.log('🗑️ Tüm cache temizlendi');
                    resolve(true);
                };
                
                request.onerror = () => {
                    resolve(false);
                };
            });
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Cache istatistikleri
     */
    async getStats() {
        if (!this.db || !this.isSupported) {
            return null;
        }
        
        try {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const entries = request.result;
                    const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
                    
                    resolve({
                        count: entries.length,
                        totalSize: totalSize,
                        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                        entries: entries.map(e => ({
                            year: e.year,
                            age: ((Date.now() - e.timestamp) / 1000 / 60).toFixed(1) + ' dakika',
                            size: (e.size / 1024 / 1024).toFixed(2) + ' MB'
                        }))
                    });
                };
                
                request.onerror = () => {
                    resolve(null);
                };
            });
        } catch (error) {
            return null;
        }
    }
}

// Singleton instance
let cacheInstance = null;

/**
 * Cache instance'ını al
 */
export function getCache() {
    if (!cacheInstance) {
        cacheInstance = new IndexedDBCache();
    }
    return cacheInstance;
}

/**
 * Cache'i başlat
 */
export async function initCache() {
    const cache = getCache();
    await cache.init();
    return cache;
}

export default IndexedDBCache;

