/**
 * PROGRESSIVE-LOADER.JS - Progressive Data Processing
 * 
 * Bu modül, büyük veri setlerini chunk chunk işleyip UI'ı progressive olarak günceller.
 * Kullanıcı veriyi daha erken görebilir, perceived performance artar.
 * 
 * Özellikler:
 * - Chunk chunk veri işleme
 * - Progressive UI güncellemeleri
 * - Progress callback desteği
 * - İlk chunk'ları hemen göster
 */

import { safeConsole } from './logger.js';

/**
 * ProgressiveLoader - Progressive data processing class
 */
class ProgressiveLoader {
    constructor() {
        this.updateUIThreshold = 3; // İlk kaç chunk'tan sonra UI'ı güncelle
    }
    
    /**
     * Veriyi progressive olarak işle
     * 
     * @param {Array} data - İşlenecek veri
     * @param {Function} processor - Veri işleme fonksiyonu (chunk'ı alır, işlenmiş chunk döndürür)
     * @param {number} chunkSize - Chunk boyutu (varsayılan: 3000)
     * @param {Function} onProgress - Progress callback (opsiyonel)
     * @returns {Promise<Array>} - İşlenmiş veri
     */
    async processProgressive(data, processor, chunkSize = 3000, onProgress = null) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return [];
        }
        
        // Chunk'lara böl
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }
        
        safeConsole.log(`📊 Progressive loading: ${chunks.length} chunk'a bölündü (chunk size: ${chunkSize})`);
        
        const results = [];
        
        // Chunk'ları sırayla işle
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Chunk'ı işle
            const processed = await processor(chunk);
            
            // Sonuçları birleştir
            for (let j = 0; j < processed.length; j++) {
                results.push(processed[j]);
            }
            
            // İlk birkaç chunk'tan sonra UI'ı güncelle (perceived performance)
            if (i < this.updateUIThreshold) {
                if (onProgress) {
                    const progress = (i + 1) / chunks.length;
                    onProgress(progress, `İşleniyor: ${(i + 1) * chunkSize} kayıt`);
                }
                
                // UI'ı güncelle (ilk chunk'ları göster)
                this.updateUI(results);
            }
            
            // Progress callback
            if (onProgress) {
                const progress = (i + 1) / chunks.length;
                onProgress(progress, `İşleniyor: ${(i + 1) * chunkSize} / ${data.length} kayıt`);
            }
        }
        
        safeConsole.log(`✅ Progressive loading tamamlandı: ${results.length} kayıt işlendi`);
        
        return results;
    }
    
    /**
     * UI'ı güncelle (ilk chunk'ları göster)
     * 
     * @param {Array} partialData - Kısmi veri (işlenmiş chunk'lar)
     */
    updateUI(partialData) {
        // allData'yı güncelle (kısmi veri ile)
        window.allData = partialData;
        
        // DataViewManager cache'ini invalidate et
        if (typeof window.getDataViewManager === 'function') {
            const dataViewManager = window.getDataViewManager();
            if (dataViewManager) {
                dataViewManager.invalidateCache();
                window.baseData = dataViewManager.getBaseData();
                window.filteredData = dataViewManager.getFilteredData();
            }
        }
        
        // Summary'yi güncelle (eğer fonksiyon varsa)
        if (typeof window.updateSummary === 'function') {
            try {
                window.updateSummary();
            } catch (error) {
                safeConsole.warn('⚠️ updateSummary hatası:', error);
            }
        }
        
        // Filtreleri güncelle (eğer fonksiyon varsa)
        if (typeof window.populateFilters === 'function') {
            try {
                window.populateFilters();
            } catch (error) {
                safeConsole.warn('⚠️ populateFilters hatası:', error);
            }
        }
    }
    
    /**
     * Update UI threshold'u ayarla
     * 
     * @param {number} threshold - İlk kaç chunk'tan sonra UI güncellenecek
     */
    setUpdateUIThreshold(threshold) {
        this.updateUIThreshold = Math.max(1, Math.min(threshold, 10)); // 1-10 arası
    }
}

// Singleton instance
let progressiveLoaderInstance = null;

/**
 * ProgressiveLoader instance'ını getir (singleton pattern)
 * 
 * @returns {ProgressiveLoader} ProgressiveLoader instance
 */
export function getProgressiveLoader() {
    if (!progressiveLoaderInstance) {
        progressiveLoaderInstance = new ProgressiveLoader();
        safeConsole.log('✅ ProgressiveLoader initialized');
    }
    return progressiveLoaderInstance;
}

/**
 * ProgressiveLoader'ı reset et (test için)
 */
export function resetProgressiveLoader() {
    progressiveLoaderInstance = null;
}

// Global erişim için (geriye uyumluluk)
if (typeof window !== 'undefined') {
    window.getProgressiveLoader = getProgressiveLoader;
}

