/**
 * METADATA-MANAGER.JS - Metadata Yönetimi
 */

import { METADATA_STORAGE_KEY } from '../core/constants.js';
import { getHourlyVersion } from '../core/utils.js';
import { safeConsole } from '../core/logger.js';

// Global state
let metadata = null;
let loadedYears = new Set();
let loadedDataCache = {};

/**
 * localStorage'dan son metadata güncellemesini al
 */
export function getLastMetadataUpdate() {
    try {
        return localStorage.getItem(METADATA_STORAGE_KEY);
    } catch (e) {
        // localStorage kapalı veya dolu ise null döndür
        return null;
    }
}

/**
 * Son metadata güncellemesini localStorage'a kaydet
 */
export function saveLastMetadataUpdate(lastUpdate) {
    try {
        localStorage.setItem(METADATA_STORAGE_KEY, lastUpdate);
    } catch (e) {
        // localStorage dolu ise sessizce devam et
    }
}

/**
 * Metadata güncellenmiş mi kontrol et
 */
export function isMetadataUpdated(newMetadata) {
    const lastUpdate = getLastMetadataUpdate();
    const newUpdate = newMetadata?.last_update;
    
    // İlk yükleme: Metadata kaydet, verileri yükle
    if (!lastUpdate) {
        if (newUpdate) saveLastMetadataUpdate(newUpdate);
        return true;
    }
    
    // Metadata güncellenmiş: Cache temizle, verileri yeniden yükle
    if (newUpdate && newUpdate !== lastUpdate) {
        safeConsole.log(`🔄 Metadata güncellendi! Eski: ${lastUpdate} → Yeni: ${newUpdate}`);
        saveLastMetadataUpdate(newUpdate);
        
        // Memory cache temizle
        loadedYears.clear();
        loadedDataCache = {};
        
        return true;
    }
    
    // Metadata değişmemiş: Cache kullan
    return false;
}

/**
 * Metadata yükle
 */
export async function loadMetadata() {
    try {
        // Akıllı Cache: Metadata için saatlik versiyon
        const version = getHourlyVersion();
        const response = await fetch(`data-metadata.json?v=${version}`, {
            headers: {
                'Cache-Control': 'public, max-age=3600' // 1 saat cache
            }
        });
        if (!response.ok) throw new Error('Metadata yüklenemedi');
        const newMetadata = await response.json();
        
        // Metadata güncelleme kontrolü
        const shouldReload = isMetadataUpdated(newMetadata);
        
        if (shouldReload) {
            safeConsole.log('✅ Metadata yüklendi ve güncellendi:', newMetadata);
        } else {
            safeConsole.log('✅ Metadata yüklendi (değişiklik yok):', newMetadata);
        }
        
        metadata = newMetadata;
        metadata.needsReload = shouldReload;
        return metadata;
    } catch (error) {
        safeConsole.error('❌ Metadata yükleme hatası:', error);
        throw error;
    }
}

/**
 * Metadata getter
 */
export function getMetadata() {
    return metadata;
}

/**
 * Loaded years getter/setter
 */
export function getLoadedYears() {
    return loadedYears;
}

export function setLoadedYears(years) {
    loadedYears = years;
}

/**
 * Data cache getter/setter
 */
export function getLoadedDataCache() {
    return loadedDataCache;
}

export function setLoadedDataCache(cache) {
    loadedDataCache = cache;
}

// Global erişim için (mevcut kod uyumluluğu)
window.loadMetadata = loadMetadata;
window.getMetadata = getMetadata;

