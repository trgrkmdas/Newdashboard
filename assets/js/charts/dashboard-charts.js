/**
 * DASHBOARD-CHARTS.JS - Dashboard Grafikleri
 */

import { safeConsole } from '../core/logger.js';
import {
    getDashYearlyChartInstance, setDashYearlyChartInstance,
    getDashTopStoresChartInstance, setDashTopStoresChartInstance,
    getDashTopSalespeopleChartInstance, setDashTopSalespeopleChartInstance,
    getDashTopBrandsChartInstance, setDashTopBrandsChartInstance,
    getDashTopCategoriesChartInstance, setDashTopCategoriesChartInstance,
    getDashTopCitiesChartInstance, setDashTopCitiesChartInstance,
    getDashTopProductsChartInstance, setDashTopProductsChartInstance
} from './chart-manager.js';

// Dashboard metrik tipi (sales veya qty)
let dashYearlyMetricType = 'sales';

// Chart verilerini cache'le (performans optimizasyonu)
let cachedYearlyData = null;
let cachedYearlyDataTimestamp = 0;
const CACHE_DURATION = 1000; // 1 saniye cache süresi

/**
 * Yıllık chart verilerini hazırla (optimize edilmiş)
 */
function prepareYearlyChartData(data) {
    const now = Date.now();
    
    // Cache kontrolü - eğer veri değişmemişse cache'i kullan
    if (cachedYearlyData && (now - cachedYearlyDataTimestamp) < CACHE_DURATION) {
        return cachedYearlyData;
    }
    
    const yearlyMonthlyData = {};
    const yearlyMonthlyQty = {};
    
    // Optimize edilmiş veri işleme - tek döngüde hem sales hem qty
    const dataLength = data.length;
    for (let i = 0; i < dataLength; i++) {
        const item = data[i];
        if (!item.date) continue;
        
        const year = item.date.substring(0, 4);
        const month = item.date.substring(5, 7);
        
        // Satış tutarı
        if (!yearlyMonthlyData[year]) yearlyMonthlyData[year] = {};
        if (!yearlyMonthlyData[year][month]) yearlyMonthlyData[year][month] = 0;
        yearlyMonthlyData[year][month] += parseFloat(item.usd_amount || 0);
        
        // Miktar
        if (!yearlyMonthlyQty[year]) yearlyMonthlyQty[year] = {};
        if (!yearlyMonthlyQty[year][month]) yearlyMonthlyQty[year][month] = 0;
        yearlyMonthlyQty[year][month] += parseFloat(item.quantity || 0);
    }
    
    // Tüm ayları topla
    const allMonthKeys = new Set();
    for (const yearData of Object.values(yearlyMonthlyData)) {
        for (const month of Object.keys(yearData)) {
            allMonthKeys.add(month);
        }
    }
    
    const sortedMonths = Array.from(allMonthKeys).sort();
    
    // Cache'e kaydet
    cachedYearlyData = {
        yearlyMonthlyData,
        yearlyMonthlyQty,
        sortedMonths
    };
    cachedYearlyDataTimestamp = now;
    
    return cachedYearlyData;
}

/**
 * Dashboard yıllık metrik tipini değiştir
 */
export function changeDashYearlyMetric(type) {
    dashYearlyMetricType = type;
    
    // Buton stillerini güncelle
    const salesBtn = document.getElementById('dashYearlyMetricSales');
    const qtyBtn = document.getElementById('dashYearlyMetricQty');
    
    if (type === 'sales') {
        if (salesBtn) {
            salesBtn.style.background = '#667eea';
            salesBtn.style.color = 'white';
        }
        if (qtyBtn) {
            qtyBtn.style.background = 'white';
            qtyBtn.style.color = '#667eea';
        }
    } else {
        if (salesBtn) {
            salesBtn.style.background = 'white';
            salesBtn.style.color = '#667eea';
        }
        if (qtyBtn) {
            qtyBtn.style.background = '#667eea';
            qtyBtn.style.color = 'white';
        }
    }
    
    // Grafiği yeniden çiz
    renderDashYearlyChart();
}

/**
 * Cache'i temizle (veri değiştiğinde)
 */
export function clearYearlyChartCache() {
    cachedYearlyData = null;
    cachedYearlyDataTimestamp = 0;
}

/**
 * Dashboard yıllık grafiğini render et (optimize edilmiş)
 */
export function renderDashYearlyChart() {
    const ctx = document.getElementById('dashYearlyChart');
    if (!ctx || !window.allData) return;
    
    // Veriyi hazırla (cache kullanarak)
    const chartData = prepareYearlyChartData(window.allData);
    const { yearlyMonthlyData, yearlyMonthlyQty, sortedMonths } = chartData;
    const sourceData = dashYearlyMetricType === 'sales' ? yearlyMonthlyData : yearlyMonthlyQty;
    
    // Dataset oluştur (seçilen metriğe göre)
    const datasets = [];
    const colors = [
        {border: 'rgba(102, 126, 234, 1)', bg: 'rgba(102, 126, 234, 0.1)'},
        {border: 'rgba(245, 87, 108, 1)', bg: 'rgba(245, 87, 108, 0.1)'},
        {border: 'rgba(56, 239, 125, 1)', bg: 'rgba(56, 239, 125, 0.1)'},
        {border: 'rgba(255, 206, 86, 1)', bg: 'rgba(255, 206, 86, 0.1)'}
    ];
    
    const sortedYears = Object.keys(sourceData).sort();
    for (let idx = 0; idx < sortedYears.length; idx++) {
        const year = sortedYears[idx];
        const yearData = sourceData[year];
        const values = sortedMonths.map(month => yearData[month] || 0);
        const color = colors[idx % colors.length];
        
        datasets.push({
            label: `${year}`,
            data: values,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 3,
            fill: true,
            tension: 0.4
        });
    }
    
    // Ay isimlerini göster
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const labels = sortedMonths.map(m => monthNames[parseInt(m) - 1]);
    
    // Y ekseni ayarları
    const isSales = dashYearlyMetricType === 'sales';
    const yAxisLabel = isSales ? 'Satış (USD - KDV Hariç)' : 'Miktar (Adet)';
    const yAxisColor = isSales ? 'rgba(102, 126, 234, 1)' : 'rgba(255, 159, 64, 1)';
    
    const existingChart = getDashYearlyChartInstance();
    
    // Chart instance'ı update et (destroy/create yerine - performans iyileştirmesi)
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets = datasets;
        existingChart.options.scales.y.title.text = yAxisLabel;
        existingChart.options.scales.y.title.color = yAxisColor;
        existingChart.options.scales.y.ticks.callback = function(value) {
            if (isSales) {
                return '$' + value.toLocaleString('tr-TR');
            } else {
                return value.toLocaleString('tr-TR') + ' adet';
            }
        };
        existingChart.options.plugins.tooltip.callbacks.label = function(context) {
            if (isSales) {
                return context.dataset.label + ': $' + context.parsed.y.toLocaleString('tr-TR', {minimumFractionDigits: 2});
            } else {
                return context.dataset.label + ': ' + context.parsed.y.toLocaleString('tr-TR', {minimumFractionDigits: 0}) + ' adet';
            }
        };
        existingChart.update('none'); // 'none' mode ile animasyon yok, daha hızlı
    } else {
        // İlk kez oluşturuluyor
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {display: true, position: 'top'},
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (isSales) {
                                    return context.dataset.label + ': $' + context.parsed.y.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                                } else {
                                    return context.dataset.label + ': ' + context.parsed.y.toLocaleString('tr-TR', {minimumFractionDigits: 0}) + ' adet';
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: yAxisLabel,
                            color: yAxisColor,
                            font: {
                                weight: 'bold',
                                size: 12
                            }
                        },
                        ticks: {
                            callback: function(value) {
                                if (isSales) {
                                    return '$' + value.toLocaleString('tr-TR');
                                } else {
                                    return value.toLocaleString('tr-TR') + ' adet';
                                }
                            }
                        }
                    }
                },
                animation: {
                    duration: 0 // İlk render'da animasyon yok
                }
            }
        });
        
        setDashYearlyChartInstance(chart);
    }
}

/**
 * Dashboard top mağazalar progress bar listesini render et
 * PERFORMANS OPTİMİZASYONU: Artık sadece render yapıyor, data iteration yapmıyor
 * 
 * @param {Object|Array} dataOrAggregated - Eğer Object ise aggregated data, Array ise eski format (backward compatibility)
 */
export function renderDashTopStoresChart(dataOrAggregated) {
    const container = document.getElementById('dashTopStoresList');
    if (!container) return;
    
    // Eski chart instance'ı temizle
    const existingChart = getDashTopStoresChartInstance();
    if (existingChart) {
        existingChart.destroy();
        setDashTopStoresChartInstance(null);
    }
    
    // PERFORMANS: Eğer aggregated data geliyorsa direkt kullan, değilse eski format (backward compatibility)
    let storeData;
    if (Array.isArray(dataOrAggregated)) {
        // Eski format - backward compatibility için
        storeData = {};
        const dataLength = dataOrAggregated.length;
        for (let i = 0; i < dataLength; i++) {
            const item = dataOrAggregated[i];
            const store = item.store || 'Bilinmiyor';
            if (!storeData[store]) storeData[store] = 0;
            storeData[store] += parseFloat(item.usd_amount || 0);
        }
    } else {
        // Yeni format - aggregated data
        storeData = dataOrAggregated.stores || {};
    }
    
    // PERFORMANS: Top-k algorithm kullan (O(n log k) yerine O(n log n))
    const top10 = getTopK(storeData, 10);
    const maxValue = top10.length > 0 ? top10[0][1] : 1; // En yüksek değer (100% için)
    
    // Progress bar listesi oluştur
    let html = '';
    top10.forEach((store, index) => {
        let storeName = store[0];
        
        // Başındaki köşeli parantez içindeki rakamları kaldır (örn: [1101404])
        storeName = storeName.replace(/^\[\d+\]\s*/g, '');
        
        const storeValue = store[1];
        const percentage = (storeValue / maxValue) * 100;
        const formattedValue = '$' + storeValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        
        html += `
            <div class="store-item-progress">
                <div class="store-header-progress">
                    <span class="store-rank-progress">${index + 1}</span>
                    <span class="store-name-progress">${storeName}</span>
                    <span class="store-value-progress">${formattedValue}</span>
                </div>
                <div class="progress-bar-store" style="width: ${percentage}%;"></div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Dashboard top satış temsilcileri progress bar listesini render et
 * PERFORMANS OPTİMİZASYONU: Artık sadece render yapıyor, data iteration yapmıyor
 * 
 * @param {Object|Array} dataOrAggregated - Eğer Object ise aggregated data, Array ise eski format (backward compatibility)
 */
export function renderDashTopSalespeopleChart(dataOrAggregated) {
    const container = document.getElementById('dashTopSalespeopleList');
    if (!container) return;
    
    // Eski chart instance'ı temizle
    const existingChart = getDashTopSalespeopleChartInstance();
    if (existingChart) {
        existingChart.destroy();
        setDashTopSalespeopleChartInstance(null);
    }
    
    // PERFORMANS: Eğer aggregated data geliyorsa direkt kullan, değilse eski format (backward compatibility)
    let spData;
    if (Array.isArray(dataOrAggregated)) {
        // Eski format - backward compatibility için
        spData = {};
        const dataLength = dataOrAggregated.length;
        for (let i = 0; i < dataLength; i++) {
            const item = dataOrAggregated[i];
            const sp = item.sales_person || 'Bilinmiyor';
            
            // "Kasa" ile başlayan satış temsilcilerini filtrele
            if (sp.trim().toLowerCase().startsWith('kasa')) continue;
            
            if (!spData[sp]) spData[sp] = 0;
            spData[sp] += parseFloat(item.usd_amount || 0);
        }
    } else {
        // Yeni format - aggregated data
        spData = dataOrAggregated.salespeople || {};
    }
    
    // PERFORMANS: Top-k algorithm kullan (O(n log k) yerine O(n log n))
    const top10 = getTopK(spData, 10);
    const maxValue = top10.length > 0 ? top10[0][1] : 1;
    
    // Progress bar listesi oluştur
    let html = '';
    top10.forEach((sp, index) => {
        const spName = sp[0];
        const spValue = sp[1];
        const percentage = (spValue / maxValue) * 100;
        const formattedValue = '$' + spValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        
        html += `
            <div class="store-item-progress">
                <div class="store-header-progress">
                    <span class="store-rank-progress">${index + 1}</span>
                    <span class="store-name-progress">${spName}</span>
                    <span class="store-value-progress">${formattedValue}</span>
                </div>
                <div class="progress-bar-store" style="width: ${percentage}%;"></div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Dashboard top markalar progress bar listesini render et
 * PERFORMANS OPTİMİZASYONU: Artık sadece render yapıyor, data iteration yapmıyor
 * 
 * @param {Object|Array} dataOrAggregated - Eğer Object ise aggregated data, Array ise eski format (backward compatibility)
 */
export function renderDashTopBrandsChart(dataOrAggregated) {
    const container = document.getElementById('dashTopBrandsList');
    if (!container) return;
    
    // Eski chart instance'ı temizle
    const existingChart = getDashTopBrandsChartInstance();
    if (existingChart) {
        existingChart.destroy();
        setDashTopBrandsChartInstance(null);
    }
    
    // PERFORMANS: Eğer aggregated data geliyorsa direkt kullan, değilse eski format (backward compatibility)
    let brandData;
    if (Array.isArray(dataOrAggregated)) {
        // Eski format - backward compatibility için
        brandData = {};
        const dataLength = dataOrAggregated.length;
        for (let i = 0; i < dataLength; i++) {
            const item = dataOrAggregated[i];
            const brand = item.brand || 'Bilinmiyor';
            if (!brandData[brand]) brandData[brand] = 0;
            brandData[brand] += parseFloat(item.usd_amount || 0);
        }
    } else {
        // Yeni format - aggregated data
        brandData = dataOrAggregated.brands || {};
    }
    
    // PERFORMANS: Top-k algorithm kullan (O(n log k) yerine O(n log n))
    const top10 = getTopK(brandData, 10);
    const maxValue = top10.length > 0 ? top10[0][1] : 1;
    
    // Progress bar listesi oluştur
    let html = '';
    top10.forEach((brand, index) => {
        const brandName = brand[0];
        const brandValue = brand[1];
        const percentage = (brandValue / maxValue) * 100;
        const formattedValue = '$' + brandValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        
        html += `
            <div class="store-item-progress">
                <div class="store-header-progress">
                    <span class="store-rank-progress">${index + 1}</span>
                    <span class="store-name-progress">${brandName}</span>
                    <span class="store-value-progress">${formattedValue}</span>
                </div>
                <div class="progress-bar-store" style="width: ${percentage}%;"></div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Dashboard top kategoriler progress bar listesini render et
 * PERFORMANS OPTİMİZASYONU: Artık sadece render yapıyor, data iteration yapmıyor
 * 
 * @param {Object|Array} dataOrAggregated - Eğer Object ise aggregated data, Array ise eski format (backward compatibility)
 */
export function renderDashTopCategoriesChart(dataOrAggregated) {
    const container = document.getElementById('dashTopCategoriesList');
    if (!container) return;
    
    // Eski chart instance'ı temizle
    const existingChart = getDashTopCategoriesChartInstance();
    if (existingChart) {
        existingChart.destroy();
        setDashTopCategoriesChartInstance(null);
    }
    
    // PERFORMANS: Eğer aggregated data geliyorsa direkt kullan, değilse eski format (backward compatibility)
    let catData;
    if (Array.isArray(dataOrAggregated)) {
        // Eski format - backward compatibility için
        catData = {};
        const dataLength = dataOrAggregated.length;
        for (let i = 0; i < dataLength; i++) {
            const item = dataOrAggregated[i];
            // Eğer category_1 "All" ise category_2 kullan, değilse category_1
            let cat = (item.category_1 && item.category_1.toLowerCase() !== 'all') 
                ? item.category_1 
                : (item.category_2 || item.category_3 || 'Diğer');
            
            // Boş değerleri ve Analitik/Eğitim atla
            if (!cat || cat.toLowerCase() === 'bilinmiyor') continue;
            if (cat.toLowerCase().includes('analitik') || cat.toLowerCase().includes('eğitim')) continue;
            
            if (!catData[cat]) catData[cat] = 0;
            catData[cat] += parseFloat(item.usd_amount || 0);
        }
    } else {
        // Yeni format - aggregated data
        catData = dataOrAggregated.categories || {};
    }
    
    // PERFORMANS: Top-k algorithm kullan (O(n log k) yerine O(n log n))
    const top10 = getTopK(catData, 10);
    const maxValue = top10.length > 0 ? top10[0][1] : 1;
    
    // Progress bar listesi oluştur
    let html = '';
    top10.forEach((category, index) => {
        const categoryName = category[0];
        const categoryValue = category[1];
        const percentage = (categoryValue / maxValue) * 100;
        const formattedValue = '$' + categoryValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        
        html += `
            <div class="store-item-progress">
                <div class="store-header-progress">
                    <span class="store-rank-progress">${index + 1}</span>
                    <span class="store-name-progress">${categoryName}</span>
                    <span class="store-value-progress">${formattedValue}</span>
                </div>
                <div class="progress-bar-store" style="width: ${percentage}%;"></div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Dashboard top şehirler progress bar listesini render et
 * PERFORMANS OPTİMİZASYONU: Artık sadece render yapıyor, data iteration yapmıyor
 * 
 * @param {Object|Array} dataOrAggregated - Eğer Object ise aggregated data, Array ise eski format (backward compatibility)
 */
export function renderDashTopCitiesChart(dataOrAggregated) {
    const container = document.getElementById('dashTopCitiesList');
    if (!container) return;
    
    // Eski chart instance'ı temizle
    const existingChart = getDashTopCitiesChartInstance();
    if (existingChart) {
        existingChart.destroy();
        setDashTopCitiesChartInstance(null);
    }
    
    // PERFORMANS: Eğer aggregated data geliyorsa direkt kullan, değilse eski format (backward compatibility)
    let cityData;
    if (Array.isArray(dataOrAggregated)) {
        // Eski format - backward compatibility için
        cityData = {};
        const dataLength = dataOrAggregated.length;
        for (let i = 0; i < dataLength; i++) {
            const item = dataOrAggregated[i];
            const city = item.partner_city || 'Bilinmiyor';
            if (!cityData[city]) cityData[city] = 0;
            cityData[city] += parseFloat(item.usd_amount || 0);
        }
    } else {
        // Yeni format - aggregated data
        cityData = dataOrAggregated.cities || {};
    }
    
    // PERFORMANS: Top-k algorithm kullan (O(n log k) yerine O(n log n))
    const top10 = getTopK(cityData, 10);
    const maxValue = top10.length > 0 ? top10[0][1] : 1;
    
    // Progress bar listesi oluştur
    let html = '';
    top10.forEach((city, index) => {
        const cityName = city[0];
        const cityValue = city[1];
        const percentage = (cityValue / maxValue) * 100;
        const formattedValue = '$' + cityValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        
        html += `
            <div class="store-item-progress">
                <div class="store-header-progress">
                    <span class="store-rank-progress">${index + 1}</span>
                    <span class="store-name-progress">${cityName}</span>
                    <span class="store-value-progress">${formattedValue}</span>
                </div>
                <div class="progress-bar-store" style="width: ${percentage}%;"></div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Dashboard top ürünler progress bar listesini render et
 * PERFORMANS OPTİMİZASYONU: Artık sadece render yapıyor, data iteration yapmıyor
 * 
 * @param {Object|Array} dataOrAggregated - Eğer Object ise aggregated data, Array ise eski format (backward compatibility)
 */
export function renderDashTopProductsChart(dataOrAggregated) {
    const container = document.getElementById('dashTopProductsList');
    if (!container) return;
    
    // Eski chart instance'ı temizle
    const existingChart = getDashTopProductsChartInstance();
    if (existingChart) {
        existingChart.destroy();
        setDashTopProductsChartInstance(null);
    }
    
    // PERFORMANS: Eğer aggregated data geliyorsa direkt kullan, değilse eski format (backward compatibility)
    let productData;
    if (Array.isArray(dataOrAggregated)) {
        // Eski format - backward compatibility için
        productData = {};
        const dataLength = dataOrAggregated.length;
        for (let i = 0; i < dataLength; i++) {
            const item = dataOrAggregated[i];
            const product = item.product || 'Bilinmiyor';
            if (!productData[product]) productData[product] = 0;
            productData[product] += parseFloat(item.usd_amount || 0);
        }
    } else {
        // Yeni format - aggregated data
        productData = dataOrAggregated.products || {};
    }
    
    // PERFORMANS: Top-k algorithm kullan (O(n log k) yerine O(n log n))
    const top10 = getTopK(productData, 10);
    const maxValue = top10.length > 0 ? top10[0][1] : 1;
    
    // Progress bar listesi oluştur
    let html = '';
    top10.forEach((product, index) => {
        let productName = product[0];
        
        // Ürün isimlerini temizle ve kısalt
        productName = productName.replace(/^[\[\(]?[A-Z0-9']+[\]\)]?\s*/g, '');
        productName = productName.replace(/\s+Dijital\s+Piyano/gi, ' Piyano');
        productName = productName.replace(/\s+Kuyruklu\s+Piyano/gi, ' K.Piyano');
        productName = productName.replace(/\s+M\/PEP\s+/gi, ' ');
        
        // Max 40 karakter
        const fullName = productName;
        if (productName.length > 40) {
            productName = productName.substring(0, 37) + '...';
        }
        
        const productValue = product[1];
        const percentage = (productValue / maxValue) * 100;
        const formattedValue = '$' + productValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        
        html += `
            <div class="store-item-progress">
                <div class="store-header-progress">
                    <span class="store-rank-progress">${index + 1}</span>
                    <span class="store-name-progress" title="${product[0]}">${productName}</span>
                    <span class="store-value-progress">${formattedValue}</span>
                </div>
                <div class="progress-bar-store" style="width: ${percentage}%;"></div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * PERFORMANS OPTİMİZASYONU: Top-k algorithm (min-heap kullanarak)
 * O(n log k) complexity - O(n log n) yerine çok daha hızlı
 * 
 * @param {Object} dataObj - Key-value pairs (örn: {store1: 100, store2: 200})
 * @param {number} k - Top k değer (varsayılan: 10)
 * @returns {Array} - Top k [key, value] pairs, value'ya göre descending sıralı
 */
function getTopK(dataObj, k = 10) {
    const entries = Object.entries(dataObj);
    
    // Küçük veri setlerinde (k'den az veya eşit) direkt sort daha hızlı
    if (entries.length <= k) {
        return entries.sort((a, b) => b[1] - a[1]);
    }
    
    // Min-heap kullanarak top-k bul (O(n log k))
    // Min-heap: En küçük değer root'ta, sadece k eleman tutuyoruz
    const heap = [];
    
    for (const entry of entries) {
        const value = entry[1];
        
        if (heap.length < k) {
            // Heap dolu değil, ekle
            heap.push(entry);
            // Heap'in sonuna ekledik, bubble up yap
            let i = heap.length - 1;
            while (i > 0) {
                const parent = Math.floor((i - 1) / 2);
                if (heap[parent][1] <= heap[i][1]) break;
                [heap[parent], heap[i]] = [heap[i], heap[parent]];
                i = parent;
            }
        } else if (value > heap[0][1]) {
            // Yeni değer heap'in minimum'undan büyük, değiştir
            heap[0] = entry;
            // Bubble down yap
            let i = 0;
            while (true) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                
                if (left < heap.length && heap[left][1] < heap[smallest][1]) {
                    smallest = left;
                }
                if (right < heap.length && heap[right][1] < heap[smallest][1]) {
                    smallest = right;
                }
                
                if (smallest === i) break;
                [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
                i = smallest;
            }
        }
    }
    
    // Heap'ten çıkar ve descending sırala
    return heap.sort((a, b) => b[1] - a[1]);
}

/**
 * PERFORMANS OPTİMİZASYONU: Tüm chart verilerini tek bir pass'te topla
 * Bu fonksiyon 6 ayrı chart için gereken tüm aggregations'ı tek loop'ta yapar
 * 
 * @param {Array} data - İşlenecek veri array'i
 * @returns {Object} - Tüm chart verilerini içeren obje
 */
export function aggregateAllChartData(data) {
    // Tüm chart verileri için aggregation objeleri
    const storeData = {};
    const spData = {};
    const brandData = {};
    const catData = {};
    const cityData = {};
    const productData = {};
    
    // PERFORMANS: Tek loop'ta tüm chart verilerini topla
    const dataLength = data.length;
    for (let i = 0; i < dataLength; i++) {
        const item = data[i];
        const amt = parseFloat(item.usd_amount || 0);
        
        // Stores aggregation
        const store = item.store || 'Bilinmiyor';
        if (!storeData[store]) storeData[store] = 0;
        storeData[store] += amt;
        
        // Salespeople aggregation (Kasa filtresi ile)
        const sp = item.sales_person || 'Bilinmiyor';
        if (!sp.trim().toLowerCase().startsWith('kasa')) {
            if (!spData[sp]) spData[sp] = 0;
            spData[sp] += amt;
        }
        
        // Brands aggregation
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = 0;
        brandData[brand] += amt;
        
        // Categories aggregation (filtreler ile)
        let cat = (item.category_1 && item.category_1.toLowerCase() !== 'all') 
            ? item.category_1 
            : (item.category_2 || item.category_3 || 'Diğer');
        
        // Boş değerleri ve Analitik/Eğitim atla
        if (cat && cat.toLowerCase() !== 'bilinmiyor' && 
            !cat.toLowerCase().includes('analitik') && 
            !cat.toLowerCase().includes('eğitim')) {
            if (!catData[cat]) catData[cat] = 0;
            catData[cat] += amt;
        }
        
        // Cities aggregation
        const city = item.partner_city || 'Bilinmiyor';
        if (!cityData[city]) cityData[city] = 0;
        cityData[city] += amt;
        
        // Products aggregation
        const product = item.product || 'Bilinmiyor';
        if (!productData[product]) productData[product] = 0;
        productData[product] += amt;
    }
    
    return {
        stores: storeData,
        salespeople: spData,
        brands: brandData,
        categories: catData,
        cities: cityData,
        products: productData
    };
}

// Global erişim için
window.changeDashYearlyMetric = changeDashYearlyMetric;

