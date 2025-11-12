/**
 * DATA-PROCESSOR.JS - Veri İşleme Fonksiyonları
 */

import { STORE_WORKING_HOURS } from '../core/constants.js';
import { normalizeStoreName } from '../core/utils.js';
import { safeConsole } from '../core/logger.js';

/**
 * İndirim ürünlerini tespit eden yardımcı fonksiyon
 */
export function isDiscountProduct(item) {
    const productName = (item.product || '').toLowerCase();
    // İndirim ürünlerini tespit et - daha kapsamlı kontrol
    return productName.includes('[disc]') ||
           productName.includes('indirim') || 
           productName.includes('discount') ||
           productName.includes('toplam tutarda indirim') ||
           (productName.includes('%') && productName.includes('ürünlerde indirim')) ||
           (productName.includes('%') && productName.includes('indirim')) ||
           productName.includes('ücretsiz');
}

/**
 * İndirim ürünlerinin tutarını negatif yapan fonksiyon
 * TEST MODU: İndirim mantığı devre dışı (Odoo zaten indirimleri düşüyor)
 */
export function applyDiscountLogic(item) {
    // TEST MODU: İndirim mantığı devre dışı
    return item;
    
    // ORİJİNAL KOD (şimdilik devre dışı):
    // if (isDiscountProduct(item)) {
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
 * İade ve indirim ürünlerini kontrol eden yardımcı fonksiyon
 */
export function shouldHideItem(item) {
    // İadeleri gizle
    if (item.move_type === 'out_refund' || item.is_refund) return true;
    
    // İndirim ürünlerini gizle
    if (isDiscountProduct(item)) return true;
    
    return false;
}

/**
 * Mağaza çalışma saatlerini kontrol eden fonksiyon
 */
export function getStoreWorkingHours(storeName) {
    // Mağaza adını temizle (kodları kaldır)
    const cleanName = storeName.replace(/\[.*?\]\s*/g, '').trim();
    
    // Özel mağazalarda arama yap (kısmi eşleşme)
    for (const [key, hours] of Object.entries(STORE_WORKING_HOURS)) {
        if (key !== 'default' && cleanName.toLowerCase().includes(key.toLowerCase())) {
            return hours;
        }
    }
    
    // Bulunamazsa default döndür
    return STORE_WORKING_HOURS.default;
}

/**
 * Satış verisinin çalışma saatleri içinde olup olmadığını kontrol eden fonksiyon
 */
export function isWithinWorkingHours(item) {
    const hours = getStoreWorkingHours(item.store || '');
    const hour = item.create_hour;
    const dayOfWeek = item.day_of_week;
    
    // Gün kontrolü (kapalı gün mü?)
    if (dayOfWeek !== undefined && dayOfWeek !== null) {
        const dayIndex = (dayOfWeek + 1) % 7; // 0=Pazar, 1=Pazartesi, ...
        if (hours.closedDays && hours.closedDays.includes(dayIndex)) {
            return false; // Kapalı gün
        }
    }
    
    // Saat kontrolü (çalışma saatleri içinde mi?)
    if (hour !== undefined && hour !== null) {
        if (hour < hours.openHour || hour >= hours.closeHour) {
            return false; // Çalışma saatleri dışında
        }
    }
    
    return true; // Çalışma saatleri içinde
}

/**
 * Belirli bir mağaza ve ürün için mevcut stok miktarını hesaplayan fonksiyon
 */
export function getCurrentStock(storeName, productCode, inventoryData, stockLocations) {
    if (!inventoryData || !inventoryData.inventory || inventoryData.inventory.length === 0) {
        return 0;
    }
    
    if (!stockLocations || Object.keys(stockLocations).length === 0) {
        return 0;
    }
    
    // Mağaza ismini normalize et
    const normalizedStore = normalizeStoreName(storeName);
    safeConsole.log(`🔍 Store name normalization: "${storeName}" -> "${normalizedStore}"`);
    
    // stock-locations'da bu mağazaya karşılık gelen location_id'leri bul
    const matchingLocations = [];
    for (const [locationId, mappedStore] of Object.entries(stockLocations)) {
        safeConsole.log(`🔍 Checking: ${locationId} -> ${mappedStore} (looking for: ${normalizedStore})`);
        if (mappedStore === normalizedStore) {
            matchingLocations.push(locationId);
            safeConsole.log(`✅ Match found: ${locationId} -> ${mappedStore}`);
        }
    }
    
    if (matchingLocations.length === 0) {
        safeConsole.warn(`⚠️ "${storeName}" için stok konumu bulunamadı`);
        return 0;
    }
    
    // Inventory verilerinde bu lokasyonlarda ve bu üründe ne kadar stok var?
    let totalStock = 0;
    inventoryData.inventory.forEach(item => {
        const itemLocation = item.location || '';
        const itemProduct = (item.product_name || item.product || '').toLowerCase();
        const searchProduct = productCode.toLowerCase();
        
        // Lokasyon eşleşmesi ve ürün eşleşmesi
        if (matchingLocations.includes(itemLocation) && itemProduct.includes(searchProduct)) {
            totalStock += parseFloat(item.quantity || 0);
        }
    });
    
    return totalStock;
}

