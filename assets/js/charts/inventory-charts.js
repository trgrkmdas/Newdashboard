/**
 * INVENTORY-CHARTS.JS - Envanter Grafikleri
 */

import { safeConsole } from '../core/logger.js';

// Chart instance'larını tutmak için
let inventoryCharts = {
    brand: null,
    category: null,
    location: null,
    topValue: null
};

/**
 * Envanter grafiklerini render et
 */
export function renderInventoryCharts() {
    if (!window.inventoryData || !window.inventoryData.inventory || window.inventoryData.inventory.length === 0) {
        safeConsole.warn('⚠️ Envanter verisi yok, grafikler oluşturulamıyor');
        return;
    }
    
    // Marka bazında stok
    const brandData = {};
    window.inventoryData.inventory.forEach(item => {
        const brand = item.brand || 'Diğer';
        if (!brandData[brand]) brandData[brand] = 0;
        brandData[brand] += parseFloat(item.list_price || 0) * parseFloat(item.quantity || 0);
    });
    const topBrands = Object.entries(brandData).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    // Kategori bazında stok
    const categoryData = {};
    window.inventoryData.inventory.forEach(item => {
        const category = item.category || 'Diğer';
        if (!categoryData[category]) categoryData[category] = 0;
        categoryData[category] += parseFloat(item.list_price || 0) * parseFloat(item.quantity || 0);
    });
    const topCategories = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    // Lokasyon bazında stok
    const locationData = {};
    window.inventoryData.inventory.forEach(item => {
        const location = item.location || 'Diğer';
        if (!locationData[location]) locationData[location] = 0;
        locationData[location] += parseFloat(item.list_price || 0) * parseFloat(item.quantity || 0);
    });
    const topLocations = Object.entries(locationData).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    // En yüksek değerli ürünler
    const topValueProducts = [...window.inventoryData.inventory]
        .sort((a, b) => (parseFloat(b.list_price || 0) * parseFloat(b.quantity || 0)) - (parseFloat(a.list_price || 0) * parseFloat(a.quantity || 0)))
        .slice(0, 10);
    
    // Chart.js ile grafikleri oluştur
    // Marka grafiği
    if (inventoryCharts.brand) inventoryCharts.brand.destroy();
    const brandCtx = document.getElementById('invBrandChart');
    if (brandCtx) {
        inventoryCharts.brand = new Chart(brandCtx, {
            type: 'bar',
            data: {
                labels: topBrands.map(b => b[0]),
                datasets: [{
                    label: 'Stok Değeri ($)',
                    data: topBrands.map(b => b[1]),
                    backgroundColor: '#667eea'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } }
            }
        });
    }
    
    // Kategori grafiği
    if (inventoryCharts.category) inventoryCharts.category.destroy();
    const categoryCtx = document.getElementById('invCategoryChart');
    if (categoryCtx) {
        inventoryCharts.category = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: topCategories.map(c => c[0]),
                datasets: [{
                    data: topCategories.map(c => c[1]),
                    backgroundColor: ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea', '#ffa751', '#f5576c']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true
            }
        });
    }
    
    // Lokasyon grafiği
    if (inventoryCharts.location) inventoryCharts.location.destroy();
    const locationCtx = document.getElementById('invLocationChart');
    if (locationCtx) {
        inventoryCharts.location = new Chart(locationCtx, {
            type: 'bar',
            data: {
                labels: topLocations.map(l => l[0]),
                datasets: [{
                    label: 'Stok Değeri ($)',
                    data: topLocations.map(l => l[1]),
                    backgroundColor: '#f093fb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } }
            }
        });
    }
    
    // Top Value Products grafiği
    if (inventoryCharts.topValue) inventoryCharts.topValue.destroy();
    const topValueCtx = document.getElementById('invTopValueChart');
    if (topValueCtx) {
        inventoryCharts.topValue = new Chart(topValueCtx, {
            type: 'bar',
            data: {
                labels: topValueProducts.map(p => ((p.product || 'Bilinmeyen').substring(0, 30))),
                datasets: [{
                    label: 'Değer ($)',
                    data: topValueProducts.map(p => parseFloat(p.list_price || 0) * parseFloat(p.quantity || 0)),
                    backgroundColor: '#43e97b'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } }
            }
        });
    }
    
    safeConsole.log('✅ Envanter grafikleri oluşturuldu');
}

/**
 * MEMORY LEAK FIX: Envanter chart instance'larını temizle
 */
export function resetInventoryCharts() {
    if (inventoryCharts.brand) {
        inventoryCharts.brand.destroy();
        inventoryCharts.brand = null;
    }
    if (inventoryCharts.category) {
        inventoryCharts.category.destroy();
        inventoryCharts.category = null;
    }
    if (inventoryCharts.location) {
        inventoryCharts.location.destroy();
        inventoryCharts.location = null;
    }
    if (inventoryCharts.topValue) {
        inventoryCharts.topValue.destroy();
        inventoryCharts.topValue = null;
    }
    safeConsole.log('🧹 Envanter chart instance\'ları temizlendi');
}

// Global erişim için
window.renderInventoryCharts = renderInventoryCharts;
window.resetInventoryCharts = resetInventoryCharts;

// MEMORY LEAK FIX: Sayfa kapatıldığında envanter chart'larını temizle (sadece bir kez ekle)
if (typeof window !== 'undefined' && !window.inventoryChartsCleanupAdded) {
    window.addEventListener('beforeunload', () => {
        resetInventoryCharts();
    });
    window.inventoryChartsCleanupAdded = true;
}

