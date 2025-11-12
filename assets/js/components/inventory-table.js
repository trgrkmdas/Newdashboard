/**
 * INVENTORY-TABLE.JS - Envanter Tablo Modülü
 */

import { safeConsole } from '../core/logger.js';

/**
 * Envanter tablosunu render et
 */
export function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    
    if (!window.inventoryData || !window.inventoryData.inventory || window.inventoryData.inventory.length === 0) {
        safeConsole.warn('⚠️ Envanter verisi yok, tablo oluşturulamıyor');
        return;
    }
    
    // İlk 100 kayıt
    const displayData = window.inventoryData.inventory.slice(0, 100);
    
    tbody.innerHTML = displayData.map(item => `
        <tr>
            <td>${item.product || '-'}</td>
            <td>${item.brand || '-'}</td>
            <td>${item.category || '-'}</td>
            <td>${item.location || '-'}</td>
            <td style="text-align: right;">${(parseFloat(item.quantity) || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
            <td style="text-align: right;">$${((parseFloat(item.list_price) || 0) * (parseFloat(item.quantity) || 0)).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
        </tr>
    `).join('');
    
    safeConsole.log(`✅ Envanter tablosu oluşturuldu: ${displayData.length} kayıt`);
}

/**
 * Envanter tablosunu filtrele
 */
export function filterInventoryTable() {
    if (!window.inventoryData || !window.inventoryData.inventory || window.inventoryData.inventory.length === 0) {
        safeConsole.warn('⚠️ Envanter verisi yok, filtreleme yapılamıyor');
        return;
    }
    
    const searchInput = document.getElementById('inventorySearch');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm.trim()) {
        // Arama boşsa ilk 100 kaydı göster
        renderInventoryTable();
        return;
    }
    
    // Arama yap
    const filtered = window.inventoryData.inventory.filter(item => {
        return (
            (item.product && item.product.toLowerCase().includes(searchTerm)) ||
            (item.brand && item.brand.toLowerCase().includes(searchTerm)) ||
            (item.category && item.category.toLowerCase().includes(searchTerm)) ||
            (item.location && item.location.toLowerCase().includes(searchTerm))
        );
    });
    
    // Tabloyu güncelle
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    
    const displayData = filtered.slice(0, 100); // İlk 100 sonuç
    
    tbody.innerHTML = displayData.map(item => `
        <tr>
            <td>${item.product || '-'}</td>
            <td>${item.brand || '-'}</td>
            <td>${item.category || '-'}</td>
            <td>${item.location || '-'}</td>
            <td style="text-align: right;">${(parseFloat(item.quantity) || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
            <td style="text-align: right;">$${((parseFloat(item.list_price) || 0) * (parseFloat(item.quantity) || 0)).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
        </tr>
    `).join('');
    
    safeConsole.log(`🔍 Arama sonucu: ${filtered.length} kayıt bulundu, ${displayData.length} gösteriliyor`);
}

// Global erişim için
window.renderInventoryTable = renderInventoryTable;
window.filterInventoryTable = filterInventoryTable;

