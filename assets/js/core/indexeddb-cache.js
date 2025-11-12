/**
 * INDEXEDDB CACHE - Parse edilmiş veri cache yönetimi
 * AŞAMA 3: Hybrid Optimization - IndexedDB Caching
 * 
 * ÖZELLİKLER:
 * - Parse edilmiş JSON verilerini IndexedDB'de sakla
 * - Cache versioning (veri güncellendiğinde cache'i temizle)
 * - Otomatik cache invalidation
 * - Storage quota yönetimi
 */

import { safeConsole } from './logger.js';
import { getDailyVersion } from './utils.js';

const DB_NAME = 'ZuhalMusicCache';
const DB_VERSION = 1;
const STORE_NAME = 'parsedData';
const CACHE_VERSION_KEY = 'cacheVersion';

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
            const version = getDailyVersion();
            
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
                        safeConsole.log(`🔄 Cache versiyonu eski (${year}), yeniden yüklenecek`);
                        // Eski cache'i sil
                        this.delete(cacheKey).catch(() => {});
                        resolve(null);
                        return;
                    }
                    
                    // Cache timestamp kontrolü (24 saat)
                    const cacheAge = Date.now() - result.timestamp;
                    const maxAge = 24 * 60 * 60 * 1000; // 24 saat
                    
                    if (cacheAge > maxAge) {
                        safeConsole.log(`⏰ Cache çok eski (${year}), yeniden yüklenecek`);
                        this.delete(cacheKey).catch(() => {});
                        resolve(null);
                        return;
                    }
                    
                    safeConsole.log(`✅ Cache'den yüklendi: ${year} (${(cacheAge / 1000).toFixed(1)}s önce)`);
                    resolve(result.data);
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
     * Cache'e veri kaydet
     * @param {string} year - Yıl (örn: "2025")
     * @param {object} data - Parse edilmiş veri
     */
    async set(year, data) {
        if (!this.db || !this.isSupported) {
            return false;
        }
        
        try {
            const cacheKey = `yearData-${year}`;
            const version = getDailyVersion();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const cacheEntry = {
                    key: cacheKey,
                    year: year,
                    data: data,
                    version: version,
                    timestamp: Date.now(),
                    size: JSON.stringify(data).length // Approximate size
                };
                
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    safeConsole.log(`💾 Cache'e kaydedildi: ${year} (${(cacheEntry.size / 1024 / 1024).toFixed(2)} MB)`);
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

