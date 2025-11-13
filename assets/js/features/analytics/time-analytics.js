/**
 * TIME-ANALYTICS.JS - Zaman Analizi Modülü
 */

import { safeConsole } from '../../core/logger.js';
import { getDataViewManager } from '../../core/data-view-manager.js';

// Chart instance'ları
let hourlyChartInstance = null;
let monthlyTrendChartInstance = null;
let yearlyTrendChartInstance = null;
let storeTimeChartInstance = null;
let categoryTimeChartInstance = null;
let salesPersonTimeChartInstance = null;

// Global değişkenlere erişim için helper fonksiyonlar
function getAllData() {
    return window.allData || [];
}

function getFilteredData() {
    return window.filteredData || [];
}

function setFilteredData(data) {
    window.filteredData = data;
}

/**
 * Tarih ve saat bilgisini doğru parse eden helper fonksiyon
 * Python: 0=Pazartesi, 6=Pazar (weekday())
 * JavaScript: 0=Pazar, 6=Cumartesi (getDay())
 * Bu yüzden mapping yapıyoruz
 */
function extractTimeInfo(item) {
    let hour = null;
    let dayOfWeek = null;
    
    // 1. Önce create_hour ve day_of_week varsa kullan
    // DÜZELTME: create_hour = 0 geçerli bir saat (gece yarısı), kontrol düzeltildi
    if (item.create_hour !== undefined && item.create_hour !== null) {
        const parsedHour = parseInt(item.create_hour);
        if (!isNaN(parsedHour) && parsedHour >= 0 && parsedHour < 24) {
            hour = parsedHour;
        }
    }
    if (item.day_of_week !== undefined && item.day_of_week !== null && item.day_of_week !== '') {
        const parsedDay = parseInt(item.day_of_week);
        if (!isNaN(parsedDay) && parsedDay >= 0 && parsedDay < 7) {
            dayOfWeek = parsedDay;
        }
    }
    
    // 2. Yoksa item.date'den parse et
    if (hour === null && item.date) {
        try {
            // Format: "2025-01-15" veya "2025-01-15 14:30:00"
            const dateStr = item.date.trim();
            
            // Saat bilgisi varsa çıkar
            if (dateStr.includes(' ') || dateStr.includes('T')) {
                const datetimeMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})[T\s]+(\d{2}):(\d{2}):(\d{2})/);
                if (datetimeMatch) {
                    const [, datePart, hourStr] = datetimeMatch;
                    hour = parseInt(hourStr);
                    
                    // Tarihten gün bilgisini çıkar
                    const dateObj = new Date(datePart + 'T12:00:00');
                    if (!isNaN(dateObj.getTime())) {
                        // JavaScript: 0=Pazar, 6=Cumartesi
                        // Python: 0=Pazartesi, 6=Pazar
                        // Python değerine çevir: JS_Pazar(0) -> Python_Pazar(6), JS_Pazartesi(1) -> Python_Pazartesi(0)
                        const jsDay = dateObj.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
                        dayOfWeek = (jsDay === 0) ? 6 : jsDay - 1; // Python formatı: 0=Pazartesi, 6=Pazar
                    }
                } else {
                    // Sadece tarih formatı: "2025-01-15"
                    const dateObj = new Date(dateStr + 'T12:00:00');
                    if (!isNaN(dateObj.getTime())) {
                        const jsDay = dateObj.getDay();
                        dayOfWeek = (jsDay === 0) ? 6 : jsDay - 1;
                    }
                }
            } else {
                // Sadece tarih: "2025-01-15"
                const dateObj = new Date(dateStr + 'T12:00:00');
                if (!isNaN(dateObj.getTime())) {
                    const jsDay = dateObj.getDay();
                    dayOfWeek = (jsDay === 0) ? 6 : jsDay - 1;
                }
            }
        } catch (e) {
            safeConsole.warn('⚠️ Tarih parse hatası:', item.date, e);
        }
    }
    
    // 3. Geçerli aralık kontrolü (ekstra güvenlik)
    if (hour !== null && (hour < 0 || hour >= 24)) hour = null;
    if (dayOfWeek !== null && (dayOfWeek < 0 || dayOfWeek >= 7)) dayOfWeek = null;
    
    // DÜZELTME: null değerleri döndür (0 yerine), çağıran fonksiyon kontrol etsin
    return {
        hour: hour, // null olabilir
        dayOfWeek: dayOfWeek // null olabilir
    };
}

/**
 * Zaman analizi ana fonksiyonu
 */
export function analyzeTime() {
    safeConsole.log('⏰ Zaman analizi başlatılıyor...');
    
    // Kategori 1 filtresini uygula
    const category1Filter = document.getElementById('timeCategory1Filter')?.value || '';
    
    if (category1Filter) {
        const allData = getAllData();
        const filtered = allData.filter(item => item.category_2 === category1Filter);
        setFilteredData(filtered);
        safeConsole.log(`📁 Kategori filtresi: "${category1Filter}" - ${filtered.length} kayıt`);
    } else {
        // LAZY EVALUATION: DataViewManager kullan (gereksiz kopyaları önler)
        const dataViewManager = getDataViewManager();
        setFilteredData(dataViewManager.getFilteredData());
    }
    
    // Summary cards güncelle
    updateTimeSummary();
    
    // Grafikleri render et
    renderHourlyChart();
    renderMonthlyTrendChart();
    renderYearlyTrendChart();
    
    // Filtreleri doldur
    populateTimeFilters();
    
    // İlk grafikleri render et
    renderStoreTimeChart();
    renderCategoryTimeChart();
    renderSalesPersonTimeChart();
    
    // AI analiz
    performTimeAIAnalysis();
}

/**
 * Zaman özet kartlarını güncelle
 */
export function updateTimeSummary() {
    const filteredData = getFilteredData();
    
    // DÜZELTME: shouldHideItem ile filtrelenmiş veriden hesapla (Dashboard ile tutarlı)
    const shouldHideItem = window.shouldHideItem || (() => false);
    
    // Saatlik veri topla
    const hourData = {};
    // Günlük veri: hem tutar, hem adet, hem de unique tarih sayısı için
    const dayData = {}; // {day: {total: 0, quantity: 0, dates: new Set()}}
    let workHoursSales = 0;
    let weekendSales = 0;
    
    filteredData.forEach(item => {
        // shouldHideItem kontrolü (iadeler ve indirim ürünleri filtreleniyor)
        if (shouldHideItem(item)) {
            return;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (isNaN(sales) || sales <= 0) return;
        
        // Satış adedi (quantity) - pozitif değerler için
        const quantity = parseFloat(item.quantity || 0);
        const validQuantity = !isNaN(quantity) && quantity > 0 ? quantity : 0;
        
        // DÜZELTME: En yoğun gün satış adedi bazında hesaplandığı için,
        // quantity = 0 olan item'ları quantity hesaplamasına dahil etmemek daha mantıklı
        // Ancak sales > 0 ise, o item hala bir satış işlemi, sadece quantity bilgisi eksik
        // Bu durumda quantity hesaplamasına dahil etmemek daha doğru
        
        // Tarih ve saat bilgisini doğru parse et
        const timeInfo = extractTimeInfo(item);
        const hour = timeInfo.hour;
        const day = timeInfo.dayOfWeek;
        
        // Saatlik (hour null ise atla)
        if (hour !== null && hour >= 0 && hour < 24) {
            if (!hourData[hour]) hourData[hour] = 0;
            hourData[hour] += sales;
        }
        
        // Günlük veri toplama - hem tutar, hem adet, hem de unique tarih sayısı
        // NOT: quantity > 0 olan item'lar için quantity hesaplaması yapılıyor
        if (day !== null && day >= 0 && day < 7) {
            if (!dayData[day]) {
                dayData[day] = {
                    total: 0,
                    quantity: 0,
                    dates: new Set()
                };
            }
            dayData[day].total += sales;
            // Sadece quantity > 0 olan item'ları quantity hesaplamasına dahil et
            if (validQuantity > 0) {
                dayData[day].quantity += validQuantity;
            }
            // Unique tarih sayısı için (normalizasyon için) - sadece quantity > 0 olan item'lar için
            // DÜZELTME: Normalizasyon için sadece quantity > 0 olan item'ların tarihlerini saymak daha mantıklı
            if (item.date && validQuantity > 0) {
                dayData[day].dates.add(item.date.split(' ')[0]); // Sadece tarih kısmı (YYYY-MM-DD)
            }
        }
        
        // Mesai saati (09:00-18:00) - hour null kontrolü
        if (hour !== null && hour >= 9 && hour < 18) {
            workHoursSales += sales;
        }
        
        // Hafta sonu (Cumartesi=5, Pazar=6) - Python formatı: 0=Pazartesi, 6=Pazar - day null kontrolü
        if (day !== null && (day === 5 || day === 6)) {
            weekendSales += sales;
        }
    });
    
    // En yoğun saat
    let peakHour = null;
    let maxHourSales = 0;
    for (const [hour, sales] of Object.entries(hourData)) {
        const hourNum = parseInt(hour);
        if (!isNaN(hourNum) && sales > maxHourSales) {
            maxHourSales = sales;
            peakHour = hourNum;
        }
    }
    
    // Eğer peakHour bulunamadıysa, varsayılan değer
    if (peakHour === null) peakHour = 0;
    
    // En yoğun gün - SATIŞ ADEDİ (QUANTITY) BAZINDA
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    let peakDay = null;
    let maxDayQuantity = 0;
    let peakDayTotal = 0;
    let peakDayDailyAvg = 0;
    
    for (const [day, data] of Object.entries(dayData)) {
        const dayNum = parseInt(day);
        if (!isNaN(dayNum) && dayNum >= 0 && dayNum < 7) {
            // Satış adedi bazında en yoğun günü bul
            // DÜZELTME: quantity > 0 kontrolü eklendi - sadece geçerli quantity'ye sahip günleri karşılaştır
            if (data.quantity > 0 && data.quantity > maxDayQuantity) {
                maxDayQuantity = data.quantity;
                peakDay = dayNum;
                peakDayTotal = data.total;
                // Günlük ortalama normalizasyonu: toplam adet / unique tarih sayısı
                const uniqueDatesCount = data.dates.size || 1; // En az 1 (sıfıra bölme önleme)
                peakDayDailyAvg = data.quantity / uniqueDatesCount;
            }
        }
    }
    
    // Eğer peakDay bulunamadıysa, varsayılan değer
    if (peakDay === null) peakDay = 0;
    
    // UI güncelle
    const peakHourEl = document.getElementById('peakHour');
    const peakDayEl = document.getElementById('peakDay');
    const workHoursSalesEl = document.getElementById('workHoursSales');
    const weekendSalesEl = document.getElementById('weekendSales');
    
    if (peakHourEl) peakHourEl.textContent = `${String(peakHour).padStart(2, '0')}:00-${String(peakHour + 1).padStart(2, '0')}:00`;
    
    // En yoğun gün: gün adı + satış adedi + günlük ortalama bilgisi
    if (peakDayEl) {
        const peakDayName = dayNames[peakDay];
        const quantityText = maxDayQuantity > 0 
            ? `${maxDayQuantity.toLocaleString('tr-TR')} adet` 
            : 'Veri yok';
        
        // Günlük ortalama bilgisi (normalizasyon)
        const uniqueDatesCount = dayData[peakDay]?.dates?.size || 1;
        const dailyAvgText = uniqueDatesCount > 1 
            ? ` (Günlük ort: ${peakDayDailyAvg.toFixed(0)} adet)` 
            : '';
        
        peakDayEl.innerHTML = `${peakDayName}<br><small style="opacity: 0.8;">${quantityText}${dailyAvgText}</small>`;
    }
    
    if (workHoursSalesEl) workHoursSalesEl.textContent = '$' + workHoursSales.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    if (weekendSalesEl) weekendSalesEl.textContent = '$' + weekendSales.toLocaleString('tr-TR', {minimumFractionDigits: 2});
}

/**
 * Saatlik grafik render
 */
export function renderHourlyChart() {
    const ctx = document.getElementById('hourlyChart');
    if (!ctx) return;
    
    const filteredData = getFilteredData();
    
    // 24 saatlik veri
    const hourData = Array(24).fill(0);
    // DÜZELTME: shouldHideItem ile filtrelenmiş veriden hesapla (Dashboard ile tutarlı)
    const shouldHideItem = window.shouldHideItem || (() => false);
    
    const hourCount = Array(24).fill(0);
    
    filteredData.forEach(item => {
        // shouldHideItem kontrolü (iadeler ve indirim ürünleri filtreleniyor)
        if (shouldHideItem(item)) {
            return;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (isNaN(sales) || sales <= 0) return;
        
        const timeInfo = extractTimeInfo(item);
        const hour = timeInfo.hour;
        
        // hour null veya geçersiz ise atla
        if (hour === null || hour < 0 || hour >= 24) return;
        
        hourData[hour] += sales;
        hourCount[hour] += 1;
    });
    
    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }
    
    hourlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`),
            datasets: [{
                label: 'Satış ($ - KDV Hariç)',
                data: hourData,
                backgroundColor: hourData.map((val, idx) => {
                    const max = Math.max(...hourData);
                    if (val === max) return 'rgba(245, 87, 108, 0.8)'; // En yoğun
                    if (idx >= 9 && idx < 18) return 'rgba(56, 239, 125, 0.6)'; // Mesai saati
                    return 'rgba(102, 126, 234, 0.6)'; // Normal
                }),
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Satış: $${context.parsed.y.toLocaleString('tr-TR')} (${hourCount[context.dataIndex]} adet)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Aylık trend grafiği render
 */
export function renderMonthlyTrendChart() {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx) return;
    
    const filteredData = getFilteredData();
    
    // Aylık veriyi topla
    const monthlyData = {};
    filteredData.forEach(item => {
        // İade ve indirim ürünlerini atla
        if (item.is_refund || item.is_discount || item.is_service) {
            return;
        }
        
        if (!item.date) return;
        const month = item.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = 0;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (!isNaN(sales) && sales > 0) {
            monthlyData[month] += sales;
        }
    });
    
    // Sırala ve formata et
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthLabels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        const monthIndex = parseInt(month) - 1;
        // Güvenlik kontrolü: geçerli ay index'i (0-11)
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${monthNames[monthIndex]} ${year}`;
        }
        // Fallback: ay numarasını göster
        return `${month} ${year}`;
    });
    const monthValues = sortedMonths.map(m => monthlyData[m]);
    
    if (monthlyTrendChartInstance) {
        monthlyTrendChartInstance.destroy();
    }
    
    monthlyTrendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Aylık Satış ($ - KDV Hariç)',
                data: monthValues,
                backgroundColor: 'rgba(102, 126, 234, 0.7)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Satış: $${context.parsed.y.toLocaleString('tr-TR')}`;
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
 * Yıllık trend grafiği render
 */
export function renderYearlyTrendChart() {
    const ctx = document.getElementById('yearlyTrendChart');
    if (!ctx) return;
    
    const filteredData = getFilteredData();
    
    // Yıllık veriyi topla
    const yearlyData = {};
    filteredData.forEach(item => {
        // İade ve indirim ürünlerini atla
        if (item.is_refund || item.is_discount || item.is_service) {
            return;
        }
        
        if (!item.date) return;
        const year = item.date.substring(0, 4); // YYYY
        if (!yearlyData[year]) {
            yearlyData[year] = 0;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (!isNaN(sales) && sales > 0) {
            yearlyData[year] += sales;
        }
    });
    
    // Sırala
    const sortedYears = Object.keys(yearlyData).sort();
    const yearValues = sortedYears.map(y => yearlyData[y]);
    
    if (yearlyTrendChartInstance) {
        yearlyTrendChartInstance.destroy();
    }
    
    yearlyTrendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedYears,
            datasets: [{
                label: 'Yıllık Satış ($ - KDV Hariç)',
                data: yearValues,
                backgroundColor: 'rgba(118, 75, 162, 0.7)',
                borderColor: 'rgba(118, 75, 162, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Satış: $${context.parsed.y.toLocaleString('tr-TR')}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000000).toFixed(1) + 'M';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Zaman filtrelerini doldur
 */
export function populateTimeFilters() {
    const allData = getAllData();
    const filteredData = getFilteredData();
    
    // Kategori filtresi (üst filtre - allData'dan doldur)
    const category1Set = [...new Set(allData.map(item => item.category_2).filter(c => c && c.toLowerCase() !== 'all'))].sort();
    const category1Select = document.getElementById('timeCategory1Filter');
    if (category1Select) {
        const currentValue = category1Select.value;
        category1Select.innerHTML = '<option value="">Tüm Kategoriler</option>';
        category1Set.forEach(cat => {
            const selected = cat === currentValue ? 'selected' : '';
            category1Select.innerHTML += `<option value="${cat}" ${selected}>${cat}</option>`;
        });
    }
    
    // Mağaza filtresi
    const stores = [...new Set(filteredData.map(item => item.store).filter(Boolean))];
    const storeSelect = document.getElementById('storeTimeFilter');
    if (storeSelect) {
        storeSelect.innerHTML = '<option value="">Tüm Mağazalar</option>';
        stores.forEach(store => {
            storeSelect.innerHTML += `<option value="${store}">${store}</option>`;
        });
    }
    
    // Kategori filtresi (alt grafik için - sadece Kategori 2, ALL hariç)
    const categories = [...new Set(filteredData.map(item => item.category_2).filter(c => c && c.toLowerCase() !== 'all'))].sort();
    const categorySelect = document.getElementById('categoryTimeFilter');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Tüm Kategoriler</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
    
    // Satış temsilcisi filtresi
    const salesPersons = [...new Set(filteredData.map(item => item.sales_person).filter(Boolean))];
    const salesPersonSelect = document.getElementById('salesPersonTimeFilter');
    if (salesPersonSelect) {
        salesPersonSelect.innerHTML = '<option value="">Tüm Temsilciler</option>';
        salesPersons.forEach(person => {
            salesPersonSelect.innerHTML += `<option value="${person}">${person}</option>`;
        });
    }
}

/**
 * Zaman filtrelerini temizle
 */
export function clearTimeFilters() {
    // Kategori 1 filtresini temizle
    const category1Select = document.getElementById('timeCategory1Filter');
    if (category1Select) {
        category1Select.value = '';
    }
    
    safeConsole.log('🔄 Zaman analizi filtreleri temizlendi');
    analyzeTime();
}

/**
 * Mağaza zaman grafiği render
 */
export function renderStoreTimeChart() {
    const ctx = document.getElementById('storeTimeChart');
    if (!ctx) return;
    
    const filteredData = getFilteredData();
    const selectedStore = document.getElementById('storeTimeFilter')?.value || '';
    const data = selectedStore ? 
        filteredData.filter(item => item.store === selectedStore) : 
        filteredData;
    
    const hourData = Array(24).fill(0);
    data.forEach(item => {
        // İade ve indirim ürünlerini atla
        if (item.is_refund || item.is_discount || item.is_service) {
            return;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (isNaN(sales) || sales <= 0) return;
        
        const timeInfo = extractTimeInfo(item);
        const hour = timeInfo.hour;
        
        // hour null veya geçersiz ise atla
        if (hour === null || hour < 0 || hour >= 24) return;
        
        hourData[hour] += sales;
    });
    
    if (storeTimeChartInstance) {
        storeTimeChartInstance.destroy();
    }
    
    storeTimeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`),
            datasets: [{
                label: selectedStore || 'Tüm Mağazalar',
                data: hourData,
                backgroundColor: 'rgba(56, 239, 125, 0.6)',
                borderColor: 'rgba(56, 239, 125, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true}
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Kategori zaman grafiği render
 */
export function renderCategoryTimeChart() {
    const ctx = document.getElementById('categoryTimeChart');
    if (!ctx) return;
    
    const filteredData = getFilteredData();
    const selectedCategory = document.getElementById('categoryTimeFilter')?.value || '';
    const data = selectedCategory ? 
        filteredData.filter(item => item.category_2 === selectedCategory) : 
        filteredData;
    
    const hourData = Array(24).fill(0);
    data.forEach(item => {
        // İade ve indirim ürünlerini atla
        if (item.is_refund || item.is_discount || item.is_service) {
            return;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (isNaN(sales) || sales <= 0) return;
        
        const timeInfo = extractTimeInfo(item);
        const hour = timeInfo.hour;
        
        // hour null veya geçersiz ise atla
        if (hour === null || hour < 0 || hour >= 24) return;
        
        hourData[hour] += sales;
    });
    
    if (categoryTimeChartInstance) {
        categoryTimeChartInstance.destroy();
    }
    
    categoryTimeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`),
            datasets: [{
                label: selectedCategory || 'Tüm Kategoriler',
                data: hourData,
                backgroundColor: 'rgba(245, 87, 108, 0.6)',
                borderColor: 'rgba(245, 87, 108, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true}
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Satış temsilcisi zaman grafiği render
 */
export function renderSalesPersonTimeChart() {
    const ctx = document.getElementById('salesPersonTimeChart');
    if (!ctx) return;
    
    const filteredData = getFilteredData();
    const selectedPerson = document.getElementById('salesPersonTimeFilter')?.value || '';
    const data = selectedPerson ? 
        filteredData.filter(item => item.sales_person === selectedPerson) : 
        filteredData;
    
    const hourData = Array(24).fill(0);
    data.forEach(item => {
        // İade ve indirim ürünlerini atla
        if (item.is_refund || item.is_discount || item.is_service) {
            return;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (isNaN(sales) || sales <= 0) return;
        
        const timeInfo = extractTimeInfo(item);
        const hour = timeInfo.hour;
        
        // hour null veya geçersiz ise atla
        if (hour === null || hour < 0 || hour >= 24) return;
        
        hourData[hour] += sales;
    });
    
    if (salesPersonTimeChartInstance) {
        salesPersonTimeChartInstance.destroy();
    }
    
    salesPersonTimeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`),
            datasets: [{
                label: selectedPerson || 'Tüm Temsilciler',
                data: hourData,
                backgroundColor: 'rgba(240, 147, 251, 0.6)',
                borderColor: 'rgba(240, 147, 251, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true}
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Zaman AI Analizi
 */
export function performTimeAIAnalysis() {
    safeConsole.log('🤖 Zaman AI analizi başlatılıyor...');
    
    const panel = document.getElementById('timeInsightsPanel');
    const filteredData = getFilteredData();
    if (!panel || filteredData.length === 0) return;
    
    // Zaman verilerini analiz et
    const hourData = {};
    const dayData = {}; // {day: {sales: 0, quantity: 0, count: 0, dates: new Set()}}
    const storeHourData = {};
    const categoryHourData = {};
    
    filteredData.forEach(item => {
        // İade ve indirim ürünlerini atla (sadece gerçek satışlar)
        if (item.is_refund || item.is_discount || item.is_service) {
            return;
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const sales = parseFloat(item.usd_amount || 0);
        if (isNaN(sales) || sales <= 0) return;
        
        // Satış adedi (quantity) - pozitif değerler için
        const quantity = parseFloat(item.quantity || 0);
        const validQuantity = !isNaN(quantity) && quantity > 0 ? quantity : 0;
        
        // Tarih ve saat bilgisini doğru parse et
        const timeInfo = extractTimeInfo(item);
        const hour = timeInfo.hour;
        const day = timeInfo.dayOfWeek;
        
        // hour/day null veya geçersiz ise atla
        if (hour === null || hour < 0 || hour >= 24) return;
        if (day === null || day < 0 || day >= 7) return;
        
        const store = item.store || 'Bilinmiyor';
        const category = item.category_1 || 'Bilinmiyor';
        
        if (!hourData[hour]) hourData[hour] = {sales: 0, count: 0};
        hourData[hour].sales += sales;
        hourData[hour].count += 1;
        
        if (!dayData[day]) dayData[day] = {sales: 0, quantity: 0, count: 0, dates: new Set()};
        dayData[day].sales += sales;
        // Sadece quantity > 0 olan item'ları quantity hesaplamasına dahil et
        if (validQuantity > 0) {
            dayData[day].quantity += validQuantity;
        }
        dayData[day].count += 1;
        // Unique tarih sayısı için (normalizasyon için) - sadece quantity > 0 olan item'lar için
        if (item.date && validQuantity > 0) {
            dayData[day].dates.add(item.date.split(' ')[0]); // Sadece tarih kısmı (YYYY-MM-DD)
        }
        
        if (!storeHourData[store]) storeHourData[store] = {};
        if (!storeHourData[store][hour]) storeHourData[store][hour] = 0;
        storeHourData[store][hour] += sales;
        
        if (!categoryHourData[category]) categoryHourData[category] = {};
        if (!categoryHourData[category][hour]) categoryHourData[category][hour] = 0;
        categoryHourData[category][hour] += sales;
    });
    
    // İçgörüler üret
    const insights = {
        positive: [],
        negative: [],
        neutral: [],
        recommendations: []
    };
    
    // En yoğun saat
    let peakHour = 0;
    let maxHourSales = 0;
    for (const [hour, data] of Object.entries(hourData)) {
        if (data.sales > maxHourSales) {
            maxHourSales = data.sales;
            peakHour = parseInt(hour);
        }
    }
    
    insights.positive.push({
        title: `En Yoğun Saat: ${String(peakHour).padStart(2, '0')}:00-${String(peakHour + 1).padStart(2, '0')}:00`,
        description: `<span class="metric-highlight">$${maxHourSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span> satış ile en yoğun saat dilimi. Bu saatte personel sayısını artırın.`
    });
    
    // Gün analizi - SATIŞ ADEDİ (QUANTITY) BAZINDA
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    let peakDay = 0;
    let maxDayQuantity = 0;
    let maxDaySales = 0;
    let peakDayDailyAvg = 0;
    let minDay = 0;
    let minDayQuantity = Infinity;
    let minDaySales = Infinity;
    
    for (const [day, data] of Object.entries(dayData)) {
        // Satış adedi bazında en yoğun günü bul
        // DÜZELTME: quantity > 0 kontrolü eklendi - sadece geçerli quantity'ye sahip günleri karşılaştır
        if (data.quantity > 0 && data.quantity > maxDayQuantity) {
            maxDayQuantity = data.quantity;
            maxDaySales = data.sales;
            peakDay = parseInt(day);
            // Günlük ortalama normalizasyonu
            const uniqueDatesCount = data.dates.size || 1;
            peakDayDailyAvg = data.quantity / uniqueDatesCount;
        }
        // En düşük günü de bul (karşılaştırma için)
        if (data.quantity < minDayQuantity && data.quantity > 0) {
            minDayQuantity = data.quantity;
            minDaySales = data.sales;
            minDay = parseInt(day);
        }
    }
    
    // Günlük ortalama bilgisi ile birlikte göster
    const uniqueDatesCount = dayData[peakDay]?.dates?.size || 1;
    const dailyAvgInfo = uniqueDatesCount > 1 
        ? ` (Günlük ort: ${peakDayDailyAvg.toFixed(0)} adet)` 
        : '';
    
    insights.positive.push({
        title: `En Yoğun Gün: ${dayNames[peakDay]}`,
        description: `<span class="metric-highlight">${maxDayQuantity.toLocaleString('tr-TR')} adet</span> satış ile haftanın en yoğun günü${dailyAvgInfo}. Toplam tutar: <span class="metric-highlight">$${maxDaySales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>`
    });
    
    // Sıfıra bölme kontrolü - adet bazında karşılaştırma
    if (minDayQuantity > 0 && maxDayQuantity / minDayQuantity > 2) {
        insights.negative.push({
            title: 'Günler Arası Büyük Fark',
            description: `${dayNames[peakDay]} ile ${dayNames[minDay]} arasında satış adedi açısından <span class="metric-highlight">${((maxDayQuantity / minDayQuantity - 1) * 100).toFixed(0)}%</span> fark var. ${dayNames[minDay]} için özel kampanyalar düşünün.`
        });
    }
    
    // Mesai saati vs mesai dışı
    let workHoursSales = 0;
    let offHoursSales = 0;
    for (const [hour, data] of Object.entries(hourData)) {
        if (parseInt(hour) >= 9 && parseInt(hour) < 18) {
            workHoursSales += data.sales;
        } else {
            offHoursSales += data.sales;
        }
    }
    
    // Sıfıra bölme kontrolü
    const totalSales = workHoursSales + offHoursSales;
    const workHoursPercent = totalSales > 0 
        ? (workHoursSales / totalSales * 100).toFixed(1)
        : '0.0';
    insights.neutral.push({
        title: 'Mesai Saati Dağılımı',
        description: `Satışların <span class="metric-highlight">%${workHoursPercent}</span>'i mesai saatlerinde (09:00-18:00) gerçekleşiyor.`
    });
    
    // Öneriler
    insights.recommendations.push({
        icon: '⏰',
        title: 'Personel Planlaması',
        description: `${String(peakHour).padStart(2, '0')}:00-${String(peakHour + 1).padStart(2, '0')}:00 saatleri arasında personel sayısını artırın. Bu saatte satışların %${((maxHourSales / Object.values(hourData).reduce((sum, d) => sum + d.sales, 0)) * 100).toFixed(1)}'i gerçekleşiyor.`
    });
    
    insights.recommendations.push({
        icon: '📅',
        title: 'Kampanya Zamanlaması',
        description: `${dayNames[minDay]} günleri için özel kampanyalar düzenleyin. Mevcut satış adedi ${dayNames[peakDay]}'ye göre %${((1 - minDayQuantity / maxDayQuantity) * 100).toFixed(0)} daha düşük.`
    });
    
    if (offHoursSales > workHoursSales * 0.3) {
        insights.recommendations.push({
            icon: '🌙',
            title: 'Mesai Dışı Potansiyel',
            description: `Mesai dışı satışlar toplam satışların %${((offHoursSales / (workHoursSales + offHoursSales)) * 100).toFixed(1)}'ini oluşturuyor. Online satış kanallarını güçlendirin.`
        });
    }
    
    // HTML oluştur
    let html = `
        <div class="analysis-panel" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <h2 style="margin: 0 0 20px 0; font-size: 2em;">⏰ Zaman Analizi AI Önerileri</h2>
            <p style="opacity: 0.9; margin-bottom: 20px;">Filtrelenen ${filteredData.length.toLocaleString('tr-TR')} kayıt üzerinden yapılan zaman analizi sonuçları</p>
            
            ${insights.positive.length > 0 ? `
            <div class="analysis-section">
                <h3>✅ Olumlu Tespitler</h3>
                ${insights.positive.map(item => `
                    <div class="insight-item insight-positive">
                        <span class="insight-icon">✅</span>
                        <strong>${item.title}</strong><br>
                        ${item.description}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.negative.length > 0 ? `
            <div class="analysis-section">
                <h3>⚠️ Dikkat Edilmesi Gerekenler</h3>
                ${insights.negative.map(item => `
                    <div class="insight-item insight-negative">
                        <span class="insight-icon">⚠️</span>
                        <strong>${item.title}</strong><br>
                        ${item.description}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.neutral.length > 0 ? `
            <div class="analysis-section">
                <h3>💡 Önemli Bilgiler</h3>
                ${insights.neutral.map(item => `
                    <div class="insight-item insight-neutral">
                        <span class="insight-icon">💡</span>
                        <strong>${item.title}</strong><br>
                        ${item.description}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <div class="analysis-section">
                <h3>🎯 Aksiyon Önerileri</h3>
                ${insights.recommendations.map(item => `
                    <div class="recommendation">
                        <span class="recommendation-icon">${item.icon}</span>
                        <div>
                            <strong style="font-size: 1.1em;">${item.title}</strong><br>
                            <p style="margin: 10px 0 0 0; opacity: 0.95;">${item.description}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    panel.innerHTML = html;
    panel.style.display = 'block';
}

// Global erişim için window objesine ekle
window.extractTimeInfo = extractTimeInfo;
window.analyzeTime = analyzeTime;
window.updateTimeSummary = updateTimeSummary;
window.renderHourlyChart = renderHourlyChart;
window.renderMonthlyTrendChart = renderMonthlyTrendChart;
window.renderYearlyTrendChart = renderYearlyTrendChart;
window.populateTimeFilters = populateTimeFilters;
window.clearTimeFilters = clearTimeFilters;
window.renderStoreTimeChart = renderStoreTimeChart;
window.renderCategoryTimeChart = renderCategoryTimeChart;
window.renderSalesPersonTimeChart = renderSalesPersonTimeChart;
window.performTimeAIAnalysis = performTimeAIAnalysis;

