/**
 * PRODUCT-ANALYZER.JS - Ürün Analizi Modülü
 * 
 * Bu modül ürün arama, filtreleme ve analiz işlemlerini yönetir.
 * - Ürün arama ve filtreleme
 * - Kategori dropdown yönetimi
 * - Grafik render işlemleri (mağaza, şehir, ilçe, temsilci, aylık)
 * - Detaylı ürün tablosu
 * - AI analizi
 */

import { normalizeDistrictName } from '../../core/district-normalizer.js';

// Chart instance'ları
let productStoreChartInstance = null;
let productCityChartInstance = null;
let productDistrictChartInstance = null;
let productSalesPersonChartInstance = null;
let productMonthlyChartInstance = null;

// Ürün tablosu sıralama için
let currentProductData = [];
let currentSortColumn = 'sales';
let currentSortDirection = 'desc';
let lastProductSearchData = null;

// Kategori dropdown için
let allCategories = [];
let allCategoriesHierarchical = []; // Hiyerarşik kategori listesi

/**
 * Ürün filtrelerini başlatma
 */
export function initializeProductFilters() {
    // Tüm kategorileri topla (hiyerarşik olarak + ara seviyeler)
    const categoryMap = new Map();
    window.allData.forEach(item => {
        const cat1 = item.category_1 || '';
        const cat2 = item.category_2 || '';
        const cat3 = item.category_3 || '';
        const cat4 = item.category_4 || '';
        
        // Her seviyeyi ayrı ayrı ekle
        const levels = [cat1, cat2, cat3, cat4].filter(c => c && c.trim());
        
        // Tüm kombinasyonları ekle (ara seviyeler dahil)
        for (let i = 1; i <= levels.length; i++) {
            const hierarchy = levels.slice(0, i).join(' > ');
            if (hierarchy && !categoryMap.has(hierarchy)) {
                categoryMap.set(hierarchy, {
                    cat1: levels[0] || '',
                    cat2: levels[1] || '',
                    cat3: levels[2] || '',
                    cat4: levels[3] || ''
                });
            }
        }
    });
    
    allCategoriesHierarchical = Array.from(categoryMap.keys()).sort();
    
    // Basit liste için de tüm kategorileri topla
    const categorySet = new Set();
    window.allData.forEach(item => {
        if (item.category_1) categorySet.add(item.category_1);
        if (item.category_2) categorySet.add(item.category_2);
        if (item.category_3) categorySet.add(item.category_3);
        if (item.category_4) categorySet.add(item.category_4);
    });
    allCategories = Array.from(categorySet).sort();
    
    // Mağaza dropdown'ını doldur
    const storeSet = new Set();
    window.allData.forEach(item => {
        if (item.store && item.store !== 'Analitik' && !item.store.toLowerCase().includes('eğitim')) {
            storeSet.add(item.store);
        }
    });
    const storeFilter = document.getElementById('productStoreFilter');
    if (storeFilter) {
        storeFilter.innerHTML = '<option value="">Tüm Mağazalar</option>';
        Array.from(storeSet).sort().forEach(store => {
            storeFilter.innerHTML += `<option value="${store}">${store}</option>`;
        });
    }
}

/**
 * Kategori dropdown göster
 */
export function showProductCategoryDropdown() {
    filterProductCategories();
    document.getElementById('productCategoryDropdown').style.display = 'block';
}

/**
 * Kategori dropdown gizle
 */
export function hideProductCategoryDropdown() {
    document.getElementById('productCategoryDropdown').style.display = 'none';
}

/**
 * Kategorileri filtrele
 */
export function filterProductCategories() {
    const searchValue = document.getElementById('productCategorySearch').value.toLowerCase();
    const dropdown = document.getElementById('productCategoryDropdown');
    
    // Hiyerarşik kategorilerde ara
    const filtered = allCategoriesHierarchical.filter(cat => 
        cat.toLowerCase().includes(searchValue)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 15px; text-align: center; color: #999;">Sonuç bulunamadı</div>';
    } else {
        dropdown.innerHTML = filtered.slice(0, 20).map(cat => {
            // Kategori seviyelerini renklendir
            const parts = cat.split(' > ');
            const displayText = parts.map((part, idx) => {
                const colors = ['#667eea', '#764ba2', '#e74c3c', '#f39c12'];
                return `<span style="color: ${colors[idx % colors.length]}; font-weight: ${idx === 0 ? 'bold' : 'normal'};">${part}</span>`;
            }).join(' <span style="color: #999;">›</span> ');
            
            return `
                <div onclick="window.productAnalyzer.selectProductCategory('${cat.replace(/'/g, "\\'")}')" 
                     style="padding: 12px; cursor: pointer; border-bottom: 1px solid #eee; transition: all 0.2s;"
                     onmouseover="this.style.background='#f5f5f5'"
                     onmouseout="this.style.background='white'">
                    📁 ${displayText}
                </div>
            `;
        }).join('');
        
        if (filtered.length > 20) {
            dropdown.innerHTML += '<div style="padding: 10px; text-align: center; color: #999; font-size: 0.9em;">+' + (filtered.length - 20) + ' daha...</div>';
        }
    }
    
    dropdown.style.display = 'block';
}

/**
 * Kategori seç
 */
export function selectProductCategory(category) {
    document.getElementById('productCategorySearch').value = category;
    document.getElementById('productCategorySearch').setAttribute('data-selected-category', category);
    hideProductCategoryDropdown();
    searchProduct();
}

/**
 * Tarih filtrelerini temizle
 */
export function clearProductDateFilters() {
    document.getElementById('productDateStart').value = '';
    document.getElementById('productDateEnd').value = '';
    if (window.safeConsole) {
        window.safeConsole.log('🔄 Ürün tarih filtreleri temizlendi');
    }
}

/**
 * Ürün arama
 */
export function searchProduct() {
    const searchTerm = document.getElementById('productSearchInput').value.trim();
    const selectedCategory = document.getElementById('productCategorySearch').getAttribute('data-selected-category') || '';
    const selectedStore = document.getElementById('productStoreFilter').value;
    const dateStart = document.getElementById('productDateStart').value;
    const dateEnd = document.getElementById('productDateEnd').value;
    
    if (!searchTerm && !selectedCategory) {
        alert('⚠️ Lütfen bir ürün/marka adı girin veya kategori seçin!');
        return;
    }
    
    if (window.safeConsole) {
        window.safeConsole.log('🔍 Arama kriteri:', {searchTerm, selectedCategory, selectedStore, dateStart, dateEnd});
    }
    
    // Arama (ürün adı, marka, kategori, veya ürün kodu)
    const searchLower = searchTerm.toLowerCase();
    let results = window.allData.filter(item => {
        const product = (item.product || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const category1 = (item.category_1 || '').toLowerCase();
        const category2 = (item.category_2 || '').toLowerCase();
        const category3 = (item.category_3 || '').toLowerCase();
        
        // Ürün/Marka filtresi
        let matchesSearch = !searchTerm || product.includes(searchLower) || brand.includes(searchLower);
        
        // Kategori filtresi (hiyerarşik veya basit arama)
        let matchesCategory = true;
        if (selectedCategory) {
            const selectedLower = selectedCategory.toLowerCase();
            // Eğer hiyerarşik kategori seçildiyse (içinde '>' varsa)
            if (selectedCategory.includes(' > ')) {
                // Hiyerarşik yapıyı kontrol et
                const currentHierarchy = [item.category_1, item.category_2, item.category_3, item.category_4]
                    .filter(c => c && c.trim())
                    .join(' > ')
                    .toLowerCase();
                matchesCategory = currentHierarchy.includes(selectedLower);
            } else {
                // Basit arama - herhangi bir kategori seviyesinde ara
                matchesCategory = category1.includes(selectedLower) || 
                                category2.includes(selectedLower) || 
                                category3.includes(selectedLower) ||
                                (item.category_4 || '').toLowerCase().includes(selectedLower);
            }
        }
        
        // Tarih filtreleri (başlangıç-bitiş) - FIX: Tarih karşılaştırması düzeltildi
        let matchesDate = true;
        if (dateStart || dateEnd) {
            if (item.date) {
                // Tarihleri karşılaştır (YYYY-MM-DD formatında)
                if (dateStart && item.date < dateStart) {
                    matchesDate = false;
                }
                if (dateEnd && item.date > dateEnd) {
                    matchesDate = false;
                }
            } else {
                // Eğer item.date yoksa, tarih filtresi varken bu kaydı dışla
                matchesDate = false;
            }
        }
        
        // Mağaza filtresi (opsiyonel)
        let matchesStore = true;
        if (selectedStore) {
            matchesStore = (item.store || '').toLowerCase().includes(selectedStore.toLowerCase());
        }
        
        return matchesSearch && matchesCategory && matchesDate && matchesStore;
    });
    
    if (window.safeConsole) {
        window.safeConsole.log('📊 Bulunan kayıt sayısı:', results.length);
    }
    
    if (results.length === 0) {
        // Sonuç yok
        document.getElementById('productResultsContainer').style.display = 'none';
        alert('❌ Arama kriterlerine uygun sonuç bulunamadı!');
        return;
    }
    
    // Sonuçları göster
    document.getElementById('productResultsContainer').style.display = 'block';
    document.getElementById('productNoResults').style.display = 'none';
    
    // Veriyi kaydet (sıralama için)
    lastProductSearchData = results;
    
    // Özet kartları güncelle
    const totalSales = results.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const totalQty = results.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const uniqueProducts = new Set(results.map(item => item.product)).size;
    const avgPrice = totalSales / Math.max(totalQty, 1);
    
    document.getElementById('productTotalSales').textContent = '$' + totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    document.getElementById('productTotalQty').textContent = totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    document.getElementById('productUniqueCount').textContent = uniqueProducts;
    document.getElementById('productAvgPrice').textContent = '$' + avgPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    
    // Grafikleri render et
    renderProductStoreChart(results);
    renderProductCityChart(results);
    renderProductDistrictChart(results);
    renderProductSalesPersonChart(results);
    renderProductMonthlyChart(results);
    renderProductDetailTable(results);
    
    // AI Analiz ve Öneri
    performProductAIAnalysis(results);
}

/**
 * Mağaza grafiği
 */
export function renderProductStoreChart(data) {
    const storeData = {};
    data.forEach(item => {
        const store = item.store || 'Bilinmiyor';
        if (!storeData[store]) storeData[store] = {sales: 0, qty: 0};
        storeData[store].sales += parseFloat(item.usd_amount || 0);
        storeData[store].qty += parseFloat(item.quantity || 0);
    });
    
    const sorted = Object.entries(storeData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 10);
    const labels = sorted.map(item => item[0]);
    const salesValues = sorted.map(item => item[1].sales);
    const qtyValues = sorted.map(item => item[1].qty);
    
    const ctx = document.getElementById('productStoreChart');
    if (!ctx) return;
    
    if (productStoreChartInstance) {
        productStoreChartInstance.destroy();
    }
    
    productStoreChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: salesValues,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }, {
                label: 'Miktar',
                data: qtyValues,
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'top'},
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            if (label === 'Satış (USD)') {
                                return label + ': $' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            } else {
                                return label + ': ' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Şehir grafiği
 */
export function renderProductCityChart(data) {
    const cityData = {};
    data.forEach(item => {
        const city = item.partner_city || 'Bilinmiyor'; // partner_city = İL bilgisi
        if (!cityData[city]) cityData[city] = {sales: 0, qty: 0};
        cityData[city].sales += parseFloat(item.usd_amount || 0);
        cityData[city].qty += parseFloat(item.quantity || 0);
    });
    
    const sorted = Object.entries(cityData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 10);
    const labels = sorted.map(item => item[0]);
    const salesValues = sorted.map(item => item[1].sales);
    const qtyValues = sorted.map(item => item[1].qty);
    
    const ctx = document.getElementById('productCityChart');
    if (!ctx) return;
    
    if (productCityChartInstance) {
        productCityChartInstance.destroy();
    }
    
    productCityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: salesValues,
                backgroundColor: 'rgba(56, 239, 125, 0.6)',
                borderColor: 'rgba(56, 239, 125, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }, {
                label: 'Miktar',
                data: qtyValues,
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'top'},
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            if (label === 'Satış (USD)') {
                                return label + ': $' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            } else {
                                return label + ': ' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * İlçe grafiği
 */
export function renderProductDistrictChart(data) {
    const districtData = {};
    
    // Önce tüm ilçe isimlerini topla (normalize için masterList)
    const allDistricts = data.map(item => item.city).filter(Boolean);
    
    data.forEach(item => {
        let district = item.city || 'Bilinmiyor'; // city = İLÇE bilgisi
        
        // İlçe normalizasyonu uygula (Bilinmiyor değilse)
        if (district && district !== 'Bilinmiyor' && district !== 'Bilinmeyen') {
            district = normalizeDistrictName(district, allDistricts);
        }
        
        // "Bilinmiyor" veya "Bilinmeyen" ilçelerini atla (chart'ta gösterme)
        if (district === 'Bilinmiyor' || district === 'Bilinmeyen' || !district) {
            return; // Bu kaydı atla
        }
        
        if (!districtData[district]) districtData[district] = {sales: 0, qty: 0};
        districtData[district].sales += parseFloat(item.usd_amount || 0);
        districtData[district].qty += parseFloat(item.quantity || 0);
    });
    
    const sorted = Object.entries(districtData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 10);
    const labels = sorted.map(item => item[0]);
    const salesValues = sorted.map(item => item[1].sales);
    const qtyValues = sorted.map(item => item[1].qty);
    
    const ctx = document.getElementById('productDistrictChart');
    if (!ctx) return;
    
    if (productDistrictChartInstance) {
        productDistrictChartInstance.destroy();
    }
    
    productDistrictChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: salesValues,
                backgroundColor: 'rgba(245, 87, 108, 0.6)',
                borderColor: 'rgba(245, 87, 108, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }, {
                label: 'Miktar',
                data: qtyValues,
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'top'},
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            if (label === 'Satış (USD - KDV Hariç)') {
                                return label + ': $' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            } else {
                                return label + ': ' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Satış temsilcisi grafiği
 */
export function renderProductSalesPersonChart(data) {
    const personData = {};
    data.forEach(item => {
        const person = item.sales_person || 'Bilinmiyor';
        if (!personData[person]) personData[person] = {sales: 0, qty: 0};
        personData[person].sales += parseFloat(item.usd_amount || 0);
        personData[person].qty += parseFloat(item.quantity || 0);
    });
    
    const sorted = Object.entries(personData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 10);
    const labels = sorted.map(item => item[0]);
    const salesValues = sorted.map(item => item[1].sales);
    const qtyValues = sorted.map(item => item[1].qty);
    
    const ctx = document.getElementById('productSalesPersonChart');
    if (!ctx) return;
    
    if (productSalesPersonChartInstance) {
        productSalesPersonChartInstance.destroy();
    }
    
    productSalesPersonChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: salesValues,
                backgroundColor: 'rgba(245, 87, 108, 0.6)',
                borderColor: 'rgba(245, 87, 108, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }, {
                label: 'Miktar',
                data: qtyValues,
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'top'},
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            if (label === 'Satış (USD)') {
                                return label + ': $' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            } else {
                                return label + ': ' + context.parsed.x.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Aylık grafik
 */
export function renderProductMonthlyChart(data) {
    // Yıllara göre ayları grupla
    const yearlyMonthlyData = {};
    data.forEach(item => {
        if (!item.date) return;
        const year = item.date.substring(0, 4);
        const month = parseInt(item.date.substring(5, 7)); // Ay numarası (1-12)
        
        if (!yearlyMonthlyData[year]) yearlyMonthlyData[year] = {};
        if (!yearlyMonthlyData[year][month]) yearlyMonthlyData[year][month] = 0;
        yearlyMonthlyData[year][month] += parseFloat(item.usd_amount || 0);
    });
    
    const years = Object.keys(yearlyMonthlyData).sort();
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    // Her yıl için dataset oluştur
    const colors = [
        { bg: 'rgba(102, 126, 234, 0.2)', border: 'rgba(102, 126, 234, 1)' },
        { bg: 'rgba(240, 147, 251, 0.2)', border: 'rgba(240, 147, 251, 1)' },
        { bg: 'rgba(255, 159, 64, 0.2)', border: 'rgba(255, 159, 64, 1)' },
        { bg: 'rgba(75, 192, 192, 0.2)', border: 'rgba(75, 192, 192, 1)' },
        { bg: 'rgba(255, 99, 132, 0.2)', border: 'rgba(255, 99, 132, 1)' }
    ];
    
    const datasets = years.map((year, index) => {
        const monthData = Array(12).fill(0);
        Object.keys(yearlyMonthlyData[year]).forEach(month => {
            monthData[parseInt(month) - 1] = yearlyMonthlyData[year][month];
        });
        
        const color = colors[index % colors.length];
        return {
            label: year,
            data: monthData,
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 3,
            fill: true,
            tension: 0.4
        };
    });
    
    const ctx = document.getElementById('productMonthlyChart');
    if (!ctx) return;
    
    if (productMonthlyChartInstance) {
        productMonthlyChartInstance.destroy();
    }
    
    productMonthlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Detaylı ürün tablosu
 */
export function renderProductDetailTable(data = null, sortColumn = null, sortDirection = null) {
    // Eğer data null ise, mevcut veriyi kullan
    if (data === null && lastProductSearchData) {
        data = lastProductSearchData;
    }
    
    // İndirim ürünlerini filtrele (tablolarda gösterme)
    if (data) {
        data = data.filter(item => !item._isDiscount);
    }
    
    if (!data || data.length === 0) {
        document.getElementById('productDetailTable').innerHTML = '<p style="text-align: center; padding: 20px;">Veri bulunamadı</p>';
        return;
    }
    
    // Sıralama parametrelerini güncelle
    if (sortColumn !== null) {
        if (currentSortColumn === sortColumn) {
            // Aynı kolona tıklandı, yönü değiştir
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // Farklı kolon, varsayılan azalan
            currentSortColumn = sortColumn;
            currentSortDirection = 'desc';
        }
    }
    
    // Ürün bazında grupla
    const productData = {};
    data.forEach(item => {
        const product = item.product || 'Bilinmiyor';
        if (!productData[product]) {
            // Hiyerarşik kategori oluştur (ALL atlanır)
            const categoryParts = [item.category_1, item.category_2, item.category_3, item.category_4]
                .filter(c => c && c.trim() && c.toLowerCase() !== 'all');
            const categoryDisplay = categoryParts.length > 0 ? categoryParts.join(' › ') : 'Bilinmiyor';
            
            productData[product] = {
                brand: item.brand || 'Bilinmiyor',
                category: categoryDisplay,
                sales: 0,
                qty: 0,
                count: 0
            };
        }
        productData[product].sales += parseFloat(item.usd_amount || 0);
        productData[product].qty += parseFloat(item.quantity || 0);
        productData[product].count += 1;
    });
    
    // Veriyi global değişkene kaydet (sıralama için)
    currentProductData = Object.entries(productData);
    
    // Sıralama
    currentProductData.sort((a, b) => {
        let valA, valB;
        
        if (currentSortColumn === 'product') {
            valA = a[0].toLowerCase();
            valB = b[0].toLowerCase();
            return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (currentSortColumn === 'brand') {
            valA = a[1].brand.toLowerCase();
            valB = b[1].brand.toLowerCase();
            return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (currentSortColumn === 'category') {
            valA = a[1].category.toLowerCase();
            valB = b[1].category.toLowerCase();
            return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (currentSortColumn === 'sales') {
            valA = a[1].sales;
            valB = b[1].sales;
        } else if (currentSortColumn === 'qty') {
            valA = a[1].qty;
            valB = b[1].qty;
        } else if (currentSortColumn === 'count') {
            valA = a[1].count;
            valB = b[1].count;
        } else if (currentSortColumn === 'avgPrice') {
            valA = a[1].sales / Math.max(a[1].qty, 1);
            valB = b[1].sales / Math.max(b[1].qty, 1);
        }
        
        return currentSortDirection === 'asc' ? valA - valB : valB - valA;
    });
    
    // Sıralama oku ikonu
    const getSortIcon = (column) => {
        if (currentSortColumn === column) {
            return currentSortDirection === 'asc' ? ' ▲' : ' ▼';
        }
        return ' ⇅';
    };
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <tr>
                    <th style="padding: 15px; text-align: left; border-bottom: 2px solid #ddd;">#</th>
                    <th onclick="window.productAnalyzer.renderProductDetailTable(null, 'product')" style="padding: 15px; text-align: left; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none;" title="Sıralamak için tıklayın">
                        Ürün${getSortIcon('product')}
                    </th>
                    <th onclick="window.productAnalyzer.renderProductDetailTable(null, 'brand')" style="padding: 15px; text-align: left; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none;" title="Sıralamak için tıklayın">
                        Marka${getSortIcon('brand')}
                    </th>
                    <th onclick="window.productAnalyzer.renderProductDetailTable(null, 'category')" style="padding: 15px; text-align: left; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none;" title="Sıralamak için tıklayın">
                        Kategori${getSortIcon('category')}
                    </th>
                    <th onclick="window.productAnalyzer.renderProductDetailTable(null, 'sales')" style="padding: 15px; text-align: right; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none;" title="Sıralamak için tıklayın">
                        Satış (USD)${getSortIcon('sales')}
                    </th>
                    <th onclick="window.productAnalyzer.renderProductDetailTable(null, 'qty')" style="padding: 15px; text-align: right; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none;" title="Sıralamak için tıklayın">
                        Miktar${getSortIcon('qty')}
                    </th>
                    <th onclick="window.productAnalyzer.renderProductDetailTable(null, 'count')" style="padding: 15px; text-align: right; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none;" title="Sıralamak için tıklayın">
                        İşlem${getSortIcon('count')}
                    </th>
                    <th onclick="window.productAnalyzer.renderProductDetailTable(null, 'avgPrice')" style="padding: 15px; text-align: right; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none;" title="Sıralamak için tıklayın">
                        Sepet Ort.${getSortIcon('avgPrice')}
                    </th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Sadece ilk 30 ürünü göster (veri tasarrufu + performans)
    const displayLimit = 30;
    const displayData = currentProductData.slice(0, displayLimit);
    const hasMore = currentProductData.length > displayLimit;
    
    displayData.forEach((item, index) => {
        const product = item[0];
        const stats = item[1];
        const avgBasket = stats.sales / Math.max(stats.count, 1); // Sepet ortalaması = Toplam Satış / Fatura Sayısı
        
        html += `
            <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background: #f8f9fa;' : ''}">
                <td style="padding: 12px;">${index + 1}</td>
                <td style="padding: 12px;"><strong>${product}</strong></td>
                <td style="padding: 12px;">${stats.brand}</td>
                <td style="padding: 12px;">${stats.category}</td>
                <td style="padding: 12px; text-align: right; color: #38ef7d; font-weight: bold;">$${stats.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right;">${stats.qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right;">${stats.count}</td>
                <td style="padding: 12px; text-align: right;">$${avgBasket.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });
    
    // Daha fazla ürün varsa bilgilendirme satırı ekle
    if (hasMore) {
        html += `
            <tr style="background: #fffbeb; border-top: 2px solid #fbbf24;">
                <td colspan="8" style="padding: 15px; text-align: center; color: #92400e; font-weight: 600;">
                    ℹ️ İlk ${displayLimit} ürün gösteriliyor (Toplam: ${currentProductData.length} ürün). Daha fazlası için filtreleri daraltabilirsiniz.
                </td>
            </tr>
        `;
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    document.getElementById('productDetailTable').innerHTML = html;
}

/**
 * Ürün AI analizi
 */
export function performProductAIAnalysis(data) {
    if (window.safeConsole) {
        window.safeConsole.log('🤖 Ürün analizi AI değerlendirmesi başlatılıyor...');
    }
    
    // Veri analizi
    const totalSales = data.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const totalQty = data.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const uniqueProducts = new Set(data.map(item => item.product)).size;
    const avgPrice = totalSales / Math.max(totalQty, 1);
    
    // Mağaza analizi
    const storeData = {};
    data.forEach(item => {
        const store = item.store || 'Bilinmiyor';
        if (!storeData[store]) storeData[store] = {sales: 0, qty: 0};
        storeData[store].sales += parseFloat(item.usd_amount || 0);
        storeData[store].qty += parseFloat(item.quantity || 0);
    });
    const topStores = Object.entries(storeData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    
    // İl analizi (partner_city = İL bilgisi, city = İLÇE bilgisi)
    const cityData = {};
    data.forEach(item => {
        const city = item.partner_city || 'Bilinmiyor'; // partner_city = İL bilgisi (state_id)
        if (!cityData[city]) cityData[city] = {sales: 0, qty: 0};
        cityData[city].sales += parseFloat(item.usd_amount || 0);
        cityData[city].qty += parseFloat(item.quantity || 0);
    });
    const topCities = Object.entries(cityData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    
    // Temsilci analizi
    const personData = {};
    data.forEach(item => {
        const person = item.sales_person || 'Bilinmiyor';
        if (!personData[person]) personData[person] = {sales: 0, qty: 0};
        personData[person].sales += parseFloat(item.usd_amount || 0);
        personData[person].qty += parseFloat(item.quantity || 0);
    });
    const topPersons = Object.entries(personData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    
    // Marka analizi
    const brandData = {};
    data.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = {sales: 0, qty: 0};
        brandData[brand].sales += parseFloat(item.usd_amount || 0);
        brandData[brand].qty += parseFloat(item.quantity || 0);
    });
    const topBrands = Object.entries(brandData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    
    // Kategori analizi
    const categoryData = {};
    data.forEach(item => {
        const category = item.category_1 || 'Bilinmiyor';
        if (!categoryData[category]) categoryData[category] = {sales: 0, qty: 0};
        categoryData[category].sales += parseFloat(item.usd_amount || 0);
        categoryData[category].qty += parseFloat(item.quantity || 0);
    });
    const topCategories = Object.entries(categoryData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    
    // AI İçgörüleri
    const insights = {
        positive: [],
        negative: [],
        neutral: [],
        recommendations: []
    };
    
    // Pozitif içgörüler
    if (topStores.length > 0) {
        const topStore = topStores[0];
        const storeShare = (topStore[1].sales / totalSales * 100).toFixed(1);
        insights.positive.push({
            title: `🏪 ${topStore[0]} Lider Mağaza`,
            description: `${topStore[0]} mağazası toplam satışın %${storeShare}'ini gerçekleştirdi ($${topStore[1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} / ${topStore[1].qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet). Bu mağaza bu ürün/marka için en güçlü performansı gösteriyor.`
        });
    }
    
    if (topCities.length > 0) {
        const topCity = topCities[0];
        const cityShare = (topCity[1].sales / totalSales * 100).toFixed(1);
        insights.positive.push({
            title: `🌍 ${topCity[0]} Önde Gelen İl`,
            description: `${topCity[0]} ili toplam satışın %${cityShare}'ini oluşturuyor ($${topCity[1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} / ${topCity[1].qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet). Bu bölgede güçlü talep var.`
        });
    }
    
    if (topPersons.length > 0) {
        // İlk 5 temsilciyi listele
        const top5Persons = topPersons.slice(0, Math.min(5, topPersons.length));
        const personsText = top5Persons.map((p, idx) => {
            const share = (p[1].sales / totalSales * 100).toFixed(1);
            return `${idx + 1}. ${p[0]} (%${share}, $${p[1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})})`;
        }).join(' | ');
        
        insights.positive.push({
            title: `👤 En Başarılı 5 Temsilci`,
            description: personsText
        });
    }
    
    // Nötr içgörüler (Bilgilendirme)
    insights.neutral.push({
        title: `📊 Genel Performans`,
        description: `Toplam ${uniqueProducts} farklı ürün, ${totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet satıldı. Ortalama ürün fiyatı $${avgPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})}.`
    });
    
    if (topBrands.length > 0) {
        // Markaların yüzdelerini hesapla
        const brandsWithPercent = topBrands.map(b => {
            const percent = (b[1].sales / totalSales * 100).toFixed(1);
            return `${b[0]} (%${percent})`;
        }).join(', ');
        
        insights.neutral.push({
            title: `🏷️ Marka Dağılımı`,
            description: `En çok satan markalar: ${brandsWithPercent}. Bu markalar toplam satışın büyük kısmını oluşturuyor.`
        });
    }
    
    if (topCategories.length > 0) {
        // category_2 kullan (All yerine gerçek kategoriler)
        const categoryData2 = {};
        data.forEach(item => {
            const category = item.category_2 || 'Bilinmiyor';
            // All, Analitik, Eğitim kategorilerini atla
            if (category.toLowerCase() === 'all' || 
                category.toLowerCase() === 'bilinmiyor' ||
                category.toLowerCase().includes('analitik') || 
                category.toLowerCase().includes('eğitim')) {
                return;
            }
            if (!categoryData2[category]) categoryData2[category] = {sales: 0, qty: 0};
            categoryData2[category].sales += parseFloat(item.usd_amount || 0);
            categoryData2[category].qty += parseFloat(item.quantity || 0);
        });
        const topCategories2 = Object.entries(categoryData2).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
        
        if (topCategories2.length > 0) {
            const catsWithPercent = topCategories2.map(c => {
                const percent = (c[1].sales / totalSales * 100).toFixed(1);
                return `${c[0]} (%${percent})`;
            }).join(', ');
            
            insights.neutral.push({
                title: `📂 Kategori Dağılımı`,
                description: `En çok satan kategoriler: ${catsWithPercent}. Bu kategorilerde yoğunlaşma var.`
            });
        }
    }
    
    // Negatif içgörüler (Fırsatlar)
    if (topStores.length > 1) {
        const leader = topStores[0];
        const second = topStores[1];
        const leaderSales = leader[1].sales;
        const secondSales = second[1].sales;
        const gapAmount = leaderSales - secondSales;
        const gapPercent = ((gapAmount / secondSales) * 100).toFixed(1);
        
        // Mağaza sayısı
        const totalStores = Object.keys(storeData).length;
        const leaderShare = ((leaderSales / totalSales) * 100).toFixed(1);
        
        if (gapPercent > 30) { // Eşik %30'a düşürüldü (daha hassas uyarı)
            insights.negative.push({
                title: `⚠️ Mağazalar Arası Performans Farkı`,
                description: `${leader[0]} mağazası toplam ${totalStores} mağaza içinde lider (%${leaderShare} pay). ${second[0]} mağazasından $${gapAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (%${gapPercent}) daha fazla satış yapıyor. Diğer mağazalarda stok, teşhir, personel eğitimi ve pazarlama açısından iyileştirme potansiyeli var.`
            });
        }
    }
    
    if (Object.keys(cityData).length > 5 && topCities[0][1].sales / totalSales > 0.5) {
        insights.negative.push({
            title: `🌍 Coğrafi Yoğunlaşma`,
            description: `Satışların büyük kısmı ${topCities[0][0]} ilinde yoğunlaşmış. Diğer illerde pazar payı artırma fırsatı var.`
        });
    }
    
    // Öneriler
    insights.recommendations.push({
        icon: '🎯',
        title: 'Stok Optimizasyonu',
        description: `${topStores[0][0]} mağazasında bu ürün/marka için stok seviyesini artırın. Bu mağaza en yüksek satış performansını gösteriyor ve stok tükenmesi riski var.`
    });
    
    insights.recommendations.push({
        icon: '📍',
        title: 'Coğrafi Genişleme',
        description: `${topCities[0][0]} ilindeki başarıyı analiz edin ve benzer demografik özelliklere sahip diğer illerde (${topCities.slice(1, 3).map(c => c[0]).join(', ')}) pazarlama kampanyaları düzenleyin.`
    });
    
    insights.recommendations.push({
        icon: '👥',
        title: 'Temsilci Eğitimi',
        description: `${topPersons[0][0]}'in satış tekniklerini diğer temsilcilerle paylaşın. Bu temsilcinin başarı stratejilerini eğitim programına dahil edin.`
    });
    
    if (avgPrice > 300) {
        insights.recommendations.push({
            icon: '💳',
            title: 'Ödeme Kolaylığı',
            description: `Ortalama ürün fiyatı $${avgPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})} gibi yüksek bir seviyede. Taksit seçenekleri ve finansman imkanları sunarak satışları artırabilirsiniz.`
        });
    }
    
    if (topStores.length >= 3) {
        const thirdStore = topStores[2];
        if (thirdStore[1].sales < topStores[0][1].sales * 0.3) {
            insights.recommendations.push({
                icon: '📢',
                title: 'Düşük Performanslı Mağazalar',
                description: `${thirdStore[0]} ve benzeri mağazalarda özel promosyonlar düzenleyin. Bu mağazalarda satış potansiyeli henüz tam olarak kullanılmamış.`
            });
        }
    }
    
    // HTML oluştur
    let html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px;">
            ${insights.positive.length > 0 ? `
            <div class="analysis-section">
                <h3 style="color: white; margin-top: 0;">✅ Güçlü Yönler</h3>
                ${insights.positive.map(item => `
                    <div class="insight-item insight-positive" style="background: rgba(56, 239, 125, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #38ef7d;">
                        <span class="insight-icon" style="font-size: 1.5em; margin-right: 10px;">✅</span>
                        <strong style="font-size: 1.1em;">${item.title}</strong><br>
                        <span style="opacity: 0.95; margin-top: 8px; display: block;">${item.description}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.negative.length > 0 ? `
            <div class="analysis-section" style="margin-top: 25px;">
                <h3 style="color: white;">⚠️ Dikkat Edilmesi Gerekenler</h3>
                ${insights.negative.map(item => `
                    <div class="insight-item insight-negative" style="background: rgba(245, 87, 108, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #f5576c;">
                        <span class="insight-icon" style="font-size: 1.5em; margin-right: 10px;">⚠️</span>
                        <strong style="font-size: 1.1em;">${item.title}</strong><br>
                        <span style="opacity: 0.95; margin-top: 8px; display: block;">${item.description}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.neutral.length > 0 ? `
            <div class="analysis-section" style="margin-top: 25px;">
                <h3 style="color: white;">💡 Genel Bilgiler</h3>
                ${insights.neutral.map(item => `
                    <div class="insight-item insight-neutral" style="background: rgba(255, 215, 0, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #ffd700;">
                        <span class="insight-icon" style="font-size: 1.5em; margin-right: 10px;">💡</span>
                        <strong style="font-size: 1.1em;">${item.title}</strong><br>
                        <span style="opacity: 0.95; margin-top: 8px; display: block;">${item.description}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <div class="analysis-section" style="margin-top: 25px;">
                <h3 style="color: white;">🎯 Aksiyon Önerileri</h3>
                ${insights.recommendations.map(item => `
                    <div class="recommendation" style="background: rgba(255, 255, 255, 0.15); padding: 18px; border-radius: 10px; margin: 12px 0;">
                        <span class="recommendation-icon" style="font-size: 1.8em; margin-right: 12px;">${item.icon}</span>
                        <div style="display: inline-block; vertical-align: top; width: calc(100% - 50px);">
                            <strong style="font-size: 1.15em; display: block; margin-bottom: 8px;">${item.title}</strong>
                            <p style="margin: 0; opacity: 0.95; line-height: 1.6;">${item.description}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('productAIAnalysisContent').innerHTML = html;
    document.getElementById('productAIAnalysisPanel').style.display = 'block';
}

// Global erişim için window objesine ekle
window.productAnalyzer = {
    initializeProductFilters,
    showProductCategoryDropdown,
    hideProductCategoryDropdown,
    filterProductCategories,
    selectProductCategory,
    clearProductDateFilters,
    searchProduct,
    renderProductStoreChart,
    renderProductCityChart,
    renderProductDistrictChart,
    renderProductSalesPersonChart,
    renderProductMonthlyChart,
    renderProductDetailTable,
    performProductAIAnalysis
};

