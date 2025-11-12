/**
 * DATA-VIEW-MANAGER.JS - Lazy Evaluation Data View Manager
 * 
 * Bu modül, baseData ve filteredData için lazy evaluation sağlar.
 * Memory'de gereksiz kopyalar tutmak yerine, sadece gerektiğinde slice eder ve cache'ler.
 * 
 * Özellikler:
 * - Lazy evaluation: İlk erişimde slice et, sonraki erişimlerde cache'den döndür
 * - Cache invalidation: allData değiştiğinde cache'i temizle
 * - Memory optimizasyonu: Gereksiz kopyaları önler
 */

import { safeConsole } from './logger.js';

/**
 * DataViewManager - Lazy evaluation data view manager
 */
class DataViewManager {
    constructor() {
        this._baseDataCache = null;
        this._filteredDataCache = null;
        this._cacheTimestamp = 0;
        this._dataVersion = 0;
        this._lastDataLength = 0;
        this._lastDataReference = null;
    }
    
    /**
     * BaseData'yı lazy olarak getir
     * İlk erişimde slice et ve cache'le, sonraki erişimlerde cache'den döndür
     * 
     * @returns {Array} BaseData array'i
     */
    getBaseData() {
        // Cache kontrolü - geçerliyse cache'den döndür
        if (this._baseDataCache && this.isCacheValid('base')) {
            return this._baseDataCache;
        }
        
        // Lazy slice - sadece gerektiğinde slice et
        if (!window.allData || !Array.isArray(window.allData)) {
            this._baseDataCache = [];
            this._cacheTimestamp = Date.now();
            this._lastDataLength = 0;
            this._lastDataReference = null;
            return this._baseDataCache;
        }
        
        // allData değişti mi kontrol et (reference check)
        const dataChanged = this._lastDataReference !== window.allData || 
                           window.allData.length !== this._lastDataLength;
        
        if (dataChanged) {
            // Veri değişti, cache'i temizle
            this._baseDataCache = null;
        }
        
        // Lazy slice - sadece gerektiğinde
        this._baseDataCache = window.allData.slice();
        this._cacheTimestamp = Date.now();
        this._lastDataLength = window.allData.length;
        this._lastDataReference = window.allData;
        
        return this._baseDataCache;
    }
    
    /**
     * FilteredData'yı lazy olarak getir
     * İlk erişimde slice et ve cache'le, sonraki erişimlerde cache'den döndür
     * 
     * @returns {Array} FilteredData array'i
     */
    getFilteredData() {
        // Cache kontrolü - geçerliyse cache'den döndür
        if (this._filteredDataCache && this.isCacheValid('filtered')) {
            return this._filteredDataCache;
        }
        
        // Lazy slice - sadece gerektiğinde slice et
        if (!window.allData || !Array.isArray(window.allData)) {
            this._filteredDataCache = [];
            this._cacheTimestamp = Date.now();
            this._lastDataLength = 0;
            this._lastDataReference = null;
            return this._filteredDataCache;
        }
        
        // allData değişti mi kontrol et (reference check)
        const dataChanged = this._lastDataReference !== window.allData || 
                           window.allData.length !== this._lastDataLength;
        
        if (dataChanged) {
            // Veri değişti, cache'i temizle
            this._filteredDataCache = null;
        }
        
        // Lazy slice - sadece gerektiğinde
        this._filteredDataCache = window.allData.slice();
        this._cacheTimestamp = Date.now();
        this._lastDataLength = window.allData.length;
        this._lastDataReference = window.allData;
        
        return this._filteredDataCache;
    }
    
    /**
     * Cache'i invalidate et (allData değiştiğinde çağırılmalı)
     */
    invalidateCache() {
        this._baseDataCache = null;
        this._filteredDataCache = null;
        this._dataVersion++;
        this._lastDataLength = 0;
        this._lastDataReference = null;
        
        safeConsole.log('🔄 DataViewManager cache invalidated');
    }
    
    /**
     * Cache geçerli mi kontrol et
     * 
     * @param {string} type - 'base' veya 'filtered'
     * @returns {boolean} Cache geçerli mi?
     */
    isCacheValid(type) {
        // allData yoksa cache geçersiz
        if (!window.allData || !Array.isArray(window.allData)) {
            return false;
        }
        
        // allData değişti mi kontrol et (length check)
        if (window.allData.length !== this._lastDataLength) {
            return false;
        }
        
        // allData reference değişti mi kontrol et
        if (this._lastDataReference !== window.allData) {
            return false;
        }
        
        // Cache çok eski mi kontrol et (5 dakika max age)
        const maxAge = 5 * 60 * 1000; // 5 dakika
        if (Date.now() - this._cacheTimestamp > maxAge) {
            return false;
        }
        
        // Type-specific cache kontrolü
        if (type === 'base' && !this._baseDataCache) {
            return false;
        }
        
        if (type === 'filtered' && !this._filteredDataCache) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Cache istatistiklerini getir (debug için)
     * 
     * @returns {Object} Cache istatistikleri
     */
    getCacheStats() {
        return {
            baseDataCached: this._baseDataCache !== null,
            filteredDataCached: this._filteredDataCache !== null,
            cacheTimestamp: this._cacheTimestamp,
            dataVersion: this._dataVersion,
            lastDataLength: this._lastDataLength,
            cacheAge: Date.now() - this._cacheTimestamp
        };
    }
    
    /**
     * Cache'i temizle (manuel olarak)
     */
    clearCache() {
        this.invalidateCache();
    }
}

// Singleton instance
let dataViewManagerInstance = null;

/**
 * DataViewManager instance'ını getir (singleton pattern)
 * 
 * @returns {DataViewManager} DataViewManager instance
 */
export function getDataViewManager() {
    if (!dataViewManagerInstance) {
        dataViewManagerInstance = new DataViewManager();
        safeConsole.log('✅ DataViewManager initialized');
    }
    return dataViewManagerInstance;
}

/**
 * DataViewManager'ı reset et (test için)
 */
export function resetDataViewManager() {
    dataViewManagerInstance = null;
}

// Global erişim için (geriye uyumluluk)
if (typeof window !== 'undefined') {
    window.getDataViewManager = getDataViewManager;
}

