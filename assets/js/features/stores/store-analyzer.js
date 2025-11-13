/**
 * STORE-ANALYZER.JS - Mağaza Analizi Modülü
 * 
 * Bu modül mağaza analizi ile ilgili tüm fonksiyonları içerir:
 * - Tek mağaza analizi (renderSingleStoreView)
 * - Çoklu mağaza karşılaştırması (renderMultipleStoresView)
 * - Mağaza karşılaştırma tabloları ve grafikleri
 * - AI analizi (performStoreAIAnalysis, performMultipleStoresAIAnalysis)
 */

import { safeConsole } from '../../core/logger.js';
import { normalizeStoreName } from '../../core/utils.js';
import { normalizeDistrictName } from '../../core/district-normalizer.js';
import { shouldHideItem, isDiscountProduct, getStoreWorkingHours } from '../../data/data-processor.js';

// ==================== PERFORMANCE OPTIMIZATION ====================
/**
 * SalespersonIndex - Satış temsilcisi verilerini index'leme sistemi
 * Proje genelindeki performans sistemleriyle uyumlu (MemoCache, IndexedDB pattern)
 */
class SalespersonIndex {
    constructor() {
        // Map: salesperson name -> data array
        this.index = new Map();
        // Map: normalized name (lowercase) -> original name
        this.nameMap = new Map();
        // Cache: filtreleme sonuçları için
        this.filterCache = new Map();
        // Index durumu
        this.isIndexed = false;
        this.lastDataHash = null;
    }
    
    /**
     * Veriyi index'le (tüm satış temsilcilerini grupla)
     * @param {Array} allData - Tüm veri
     */
    buildIndex(allData) {
        if (!allData || allData.length === 0) {
            this.index.clear();
            this.nameMap.clear();
            this.isIndexed = false;
            return;
        }
        
        // Veri hash'i hesapla (değişiklik kontrolü için)
        const dataHash = this._calculateHash(allData);
        if (this.lastDataHash === dataHash && this.isIndexed) {
            safeConsole.log('📦 SalespersonIndex: Veri değişmemiş, index yeniden oluşturulmadı');
            return;
        }
        
        const startTime = performance.now();
        this.index.clear();
        this.nameMap.clear();
        this.filterCache.clear();
        
        // Satış temsilcilerini grupla
        allData.forEach(item => {
            const name = item.sales_person || '';
            if (!name || name.trim() === '') return;
            
            const normalizedName = name.toLowerCase().trim();
            
            // Index'e ekle
            if (!this.index.has(normalizedName)) {
                this.index.set(normalizedName, []);
                this.nameMap.set(normalizedName, name); // Orijinal ismi sakla
            }
            this.index.get(normalizedName).push(item);
        });
        
        this.isIndexed = true;
        this.lastDataHash = dataHash;
        
        const duration = performance.now() - startTime;
        safeConsole.log(`✅ SalespersonIndex: ${this.index.size} satış temsilcisi index'lendi (${duration.toFixed(2)}ms)`);
    }
    
    /**
     * Satış temsilcisi verilerini al (index'ten)
     * @param {string} name - Satış temsilcisi adı (case-insensitive)
     * @returns {Array} - Satış temsilcisi verileri
     */
    getSalespersonData(name) {
        if (!name || !this.isIndexed) return [];
        
        const normalizedName = name.toLowerCase().trim();
        return this.index.get(normalizedName) || [];
    }
    
    /**
     * İsim araması (fuzzy search - includes)
     * @param {string} query - Arama sorgusu
     * @returns {Array} - Eşleşen satış temsilcileri [{name, sales, count}, ...]
     */
    searchSalespersons(query) {
        if (!query || query.length < 2 || !this.isIndexed) return [];
        
        const normalizedQuery = query.toLowerCase().trim();
        const results = [];
        
        // Index'te ara
        for (const [normalizedName, data] of this.index.entries()) {
            if (normalizedName.includes(normalizedQuery)) {
                const originalName = this.nameMap.get(normalizedName);
                const sales = data.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
                const count = data.length;
                
                results.push({
                    name: originalName,
                    sales: sales,
                    count: count
                });
            }
        }
        
        // Satışa göre sırala
        results.sort((a, b) => b.sales - a.sales);
        
        return results;
    }
    
    /**
     * Filtrelenmiş veriyi al (cache ile)
     * @param {Object} filters - Filtreler {year, month, day}
     * @returns {Array} - Filtrelenmiş veri
     */
    getFilteredData(filters = {}) {
        // Cache key oluştur
        const cacheKey = this._getFilterCacheKey(filters);
        
        // Cache'den kontrol et
        if (this.filterCache.has(cacheKey)) {
            const cached = this.filterCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 dakika (MemoCache ile uyumlu)
                safeConsole.log('📦 SalespersonIndex: Filtreleme cache hit');
                return cached.data;
            }
        }
        
        // Cache'de yoksa, filtrele
        const allData = this._getAllIndexedData();
        let filtered = allData;
        
        if (filters.year && filters.year.length > 0) {
            filtered = filtered.filter(item => {
                const itemYear = item.date ? item.date.split('-')[0] : '';
                return filters.year.includes(itemYear);
            });
        }
        
        if (filters.month && filters.month.length > 0) {
            filtered = filtered.filter(item => {
                const itemMonth = item.date ? item.date.split('-')[1] : '';
                return filters.month.includes(itemMonth);
            });
        }
        
        if (filters.day && filters.day.length > 0) {
            filtered = filtered.filter(item => {
                const itemDay = item.date ? item.date.split('-')[2] : '';
                return filters.day.includes(itemDay);
            });
        }
        
        // Cache'e kaydet
        this.filterCache.set(cacheKey, {
            data: filtered,
            timestamp: Date.now()
        });
        
        // Cache boyutu kontrolü (max 50)
        if (this.filterCache.size > 50) {
            const firstKey = this.filterCache.keys().next().value;
            this.filterCache.delete(firstKey);
        }
        
        return filtered;
    }
    
    /**
     * Tüm index'lenmiş veriyi al
     * @returns {Array} - Tüm veri
     */
    _getAllIndexedData() {
        const allData = [];
        for (const data of this.index.values()) {
            for (const item of data) {
                allData.push(item);
            }
        }
        return allData;
    }
    
    /**
     * Filtre cache key oluştur
     */
    _getFilterCacheKey(filters) {
        return JSON.stringify({
            year: (filters.year || []).sort().join(','),
            month: (filters.month || []).sort().join(','),
            day: (filters.day || []).sort().join(',')
        });
    }
    
    /**
     * Veri hash'i hesapla (değişiklik kontrolü için)
     */
    _calculateHash(data) {
        // Basit hash: veri uzunluğu + ilk ve son item'ın hash'i
        if (!data || data.length === 0) return 'empty';
        const first = data[0];
        const last = data[data.length - 1];
        return `${data.length}-${first?.date || ''}-${last?.date || ''}`;
    }
    
    /**
     * Index'i temizle
     */
    clear() {
        this.index.clear();
        this.nameMap.clear();
        this.filterCache.clear();
        this.isIndexed = false;
        this.lastDataHash = null;
    }
    
    /**
     * Index istatistikleri
     */
    getStats() {
        return {
            salespersonCount: this.index.size,
            isIndexed: this.isIndexed,
            cacheSize: this.filterCache.size
        };
    }
}

// Singleton instance
let salespersonIndexInstance = null;

/**
 * SalespersonIndex instance'ını al
 */
function getSalespersonIndex() {
    if (!salespersonIndexInstance) {
        salespersonIndexInstance = new SalespersonIndex();
    }
    return salespersonIndexInstance;
}

/**
 * Debounce helper (proje genelindeki pattern ile uyumlu)
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Chart instance'ları
let storeBrandChartInstance = null;
let storeCategoryChartInstance = null;
let storeDistrictChartInstance = null;
let storeSalespersonChartInstance = null;
let storeMonthlyChartInstance = null;
let comparisonStoreSalesChartInstance = null;
let comparisonStoreQtyChartInstance = null;

// Sıralama state'leri
let storeTopProductsSortState = {
    column: 'sales',
    direction: 'desc'
};

let storeSpSortColumn = 2;
let storeSpSortAsc = false;

// Global değişkenlere erişim için helper fonksiyonlar
function getAllData() {
    return window.allData || [];
}

/**
 * Index'i otomatik olarak build et (veri değiştiğinde)
 */
function ensureSalespersonIndex() {
    const allData = getAllData();
    if (allData && allData.length > 0) {
        const index = getSalespersonIndex();
        index.buildIndex(allData);
    }
}

function getInventoryData() {
    return window.inventoryData || null;
}

function getStockLocations() {
    return window.stockLocations || {};
}

function getFilteredData() {
    return window.filteredData || [];
}

function performStoreAIAnalysis(data, profile, insights) {
    // DÜZELTME: Güvenli sayı dönüşümü ve NaN kontrolü
    // Marka analizi
    const brandData = {};
    data.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = 0;
        const amount = parseFloat(item.usd_amount || 0);
        brandData[brand] += (isNaN(amount) ? 0 : amount);
    });
    const topBrands = Object.entries(brandData).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    // Kategori analizi
    const categoryData = {};
    data.forEach(item => {
        const cat = item.category_2 || 'Bilinmiyor';
        if (cat.toLowerCase() === 'all' || cat.toLowerCase().includes('analitik') || cat.toLowerCase().includes('eğitim')) {
            return;
        }
        if (!categoryData[cat]) categoryData[cat] = 0;
        const amount = parseFloat(item.usd_amount || 0);
        categoryData[cat] += (isNaN(amount) ? 0 : amount);
    });
    const topCategories = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    // ZAMAN ANALİZLERİ
    // Aylık analiz
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const monthData = {};
    data.forEach(item => {
        const date = new Date(item.date);
        const month = date.getMonth();
        if (!monthData[month]) monthData[month] = 0;
        const amount = parseFloat(item.usd_amount || 0);
        monthData[month] += (isNaN(amount) ? 0 : amount);
    });
    const monthEntries = Object.entries(monthData).map(([m, v]) => ({month: parseInt(m), name: monthNames[m], value: v}));
    const bestMonth = monthEntries.sort((a, b) => b.value - a.value)[0];
    const worstMonth = monthEntries.sort((a, b) => a.value - b.value)[0];
    
    // Günlük analiz (haftanın günleri)
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const dayData = {};
    data.forEach(item => {
        const day = item.day_of_week;
        if (day !== undefined && day !== null) {
            // Python: 0=Pazartesi, 1=Salı, ..., 6=Pazar
            const dayIndex = day; // Direkt kullan, mapping yok
            if (!dayData[dayIndex]) dayData[dayIndex] = 0;
            const amount = parseFloat(item.usd_amount || 0);
            dayData[dayIndex] += (isNaN(amount) ? 0 : amount);
        }
    });
    const dayEntries = Object.entries(dayData).map(([d, v]) => ({day: parseInt(d), name: dayNames[d], value: v}));
    const bestDay = dayEntries.sort((a, b) => b.value - a.value)[0];
    const worstDay = dayEntries.sort((a, b) => a.value - b.value)[0];
    
    // Saatlik analiz
    const hourData = {};
    data.forEach(item => {
        const hour = item.create_hour;
        if (hour !== undefined && hour !== null) {
            if (!hourData[hour]) hourData[hour] = 0;
            hourData[hour] += parseFloat(item.usd_amount || 0);
        }
    });
    const hourEntries = Object.entries(hourData).map(([h, v]) => ({hour: parseInt(h), value: v}));
    const bestHour = hourEntries.sort((a, b) => b.value - a.value)[0];
    const worstHour = hourEntries.sort((a, b) => a.value - b.value)[0];
    
    // Saat aralığı analizi (sabah, öğlen, akşam)
    let morning = 0, afternoon = 0, evening = 0, night = 0;
    data.forEach(item => {
        const hour = item.create_hour;
        const amount = parseFloat(item.usd_amount || 0);
        if (hour >= 6 && hour < 12) morning += amount;
        else if (hour >= 12 && hour < 17) afternoon += amount;
        else if (hour >= 17 && hour < 22) evening += amount;
        else night += amount;
    });
    const timeSlots = [
        {name: 'Sabah (06:00-12:00)', value: morning},
        {name: 'Öğlen (12:00-17:00)', value: afternoon},
        {name: 'Akşam (17:00-22:00)', value: evening},
        {name: 'Gece (22:00-06:00)', value: night}
    ].sort((a, b) => b.value - a.value);
    
    // Temsilci-Gün kombinasyonu
    const spDayData = {};
    data.forEach(item => {
        const sp = item.sales_person || 'Bilinmiyor';
        const day = item.day_of_week;
        if (day !== undefined && day !== null) {
            const dayIndex = day; // Direkt kullan
            const key = `${sp}_${dayIndex}`;
            if (!spDayData[key]) spDayData[key] = {sp, day: dayIndex, dayName: dayNames[dayIndex], value: 0};
            spDayData[key].value += parseFloat(item.usd_amount || 0);
        }
    });
    const topSpDay = Object.values(spDayData).sort((a, b) => b.value - a.value)[0];
    
    // Temsilci-Saat kombinasyonu
    const spHourData = {};
    data.forEach(item => {
        const sp = item.sales_person || 'Bilinmiyor';
        const hour = item.create_hour;
        if (hour !== undefined && hour !== null) {
            const key = `${sp}_${hour}`;
            if (!spHourData[key]) spHourData[key] = {sp, hour, value: 0};
            spHourData[key].value += parseFloat(item.usd_amount || 0);
        }
    });
    const topSpHour = Object.values(spHourData).sort((a, b) => b.value - a.value)[0];
    
    // Pozitif
    if (profile.totalSales > 100000) {
        insights.positive.push({
            title: '💰 Yüksek Ciro',
            description: `Mağaza toplam <span class="metric-highlight">$${profile.totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span> satış gerçekleştirmiş. Mükemmel performans!`
        });
    }
    
    if (topBrands.length > 0) {
        const topBrand = topBrands[0];
        const brandPercent = (topBrand[1] / profile.totalSales * 100).toFixed(1);
        insights.positive.push({
            title: `🏷️ En Başarılı 3 Marka`,
            description: `${topBrands.slice(0, 3).map(b => `${b[0]} (%${(b[1]/profile.totalSales*100).toFixed(1)})`).join(', ')}`
        });
    }
    
    if (topCategories.length > 0) {
        const topCat = topCategories[0];
        const catPercent = (topCat[1] / profile.totalSales * 100).toFixed(1);
        insights.positive.push({
            title: `📂 En Başarılı 3 Kategori`,
            description: `${topCategories.slice(0, 3).map(c => `${c[0]} (%${(c[1]/profile.totalSales*100).toFixed(1)})`).join(', ')}`
        });
    }
    
    // ZAMAN BAZLI ANALİZLER - Neutral
    if (bestMonth && worstMonth) {
        const bestPercent = ((bestMonth.value / profile.totalSales) * 100).toFixed(1);
        const worstPercent = ((worstMonth.value / profile.totalSales) * 100).toFixed(1);
        insights.neutral.push({
            title: '📅 Aylık Performans',
            description: `En güçlü ay: <span class="metric-highlight">${bestMonth.name}</span> (%${bestPercent})<br>En zayıf ay: ${worstMonth.name} (%${worstPercent})`
        });
    }
    
    if (bestDay && worstDay) {
        const bestDayPercent = ((bestDay.value / profile.totalSales) * 100).toFixed(1);
        const worstDayPercent = ((worstDay.value / profile.totalSales) * 100).toFixed(1);
        insights.neutral.push({
            title: '📆 Günlük Performans',
            description: `En güçlü gün: <span class="metric-highlight">${bestDay.name}</span> (%${bestDayPercent})<br>En zayıf gün: ${worstDay.name} (%${worstDayPercent})`
        });
    }
    
    if (timeSlots.length > 0) {
        const bestSlot = timeSlots[0];
        const bestSlotPercent = ((bestSlot.value / profile.totalSales) * 100).toFixed(1);
        insights.neutral.push({
            title: '🕐 Saat Dilimi Performansı',
            description: `En güçlü: <span class="metric-highlight">${bestSlot.name}</span> - Cironun %${bestSlotPercent}'i bu saatlerde`
        });
    }
    
    if (topSpDay) {
        const spDayPercent = ((topSpDay.value / profile.totalSales) * 100).toFixed(1);
        insights.neutral.push({
            title: '⭐ En Başarılı Kombinasyon',
            description: `<span class="metric-highlight">${topSpDay.sp}</span> - <span class="metric-highlight">${topSpDay.dayName}</span> günleri harika! (%${spDayPercent})`
        });
    }
    
    // MAĞAZA ÇALIŞMA SAATLERİ BİLGİSİ
    const storeHours = getStoreWorkingHours(profile.name || '');
    const closedDayNames = storeHours.closedDays.map(d => {
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return days[d];
    }).join(', ');
    
    
    // Nötr
    if (topSP.length > 0) {
        const spList = topSP.map((sp, idx) => {
            const percent = (sp[1] / profile.totalSales * 100).toFixed(1);
            return `${idx + 1}. ${sp[0]} (%${percent})`;
        }).join('<br>');
        insights.neutral.push({
            title: '👨‍💼 En Başarılı Satış Temsilcileri',
            description: spList
        });
    }
    
    insights.neutral.push({
        title: '📊 Genel Performans',
        description: `<span class="metric-highlight">${profile.uniqueCustomers}</span> farklı müşteri, <span class="metric-highlight">${profile.uniqueProducts}</span> farklı ürün satıldı.`
    });
    
    // TOPLAM SATIŞ İÇİNDEKİ PAY
    insights.neutral.push({
        title: '📈 Toplam Satış İçindeki Pay',
        description: `${profile.name} mağazası, toplam şirket satışının <strong>%${profile.storeSalesPercentage}</strong> payını oluşturuyor. Bu, $${profile.totalAllSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} toplam satış içinde $${profile.totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} değerinde bir performans.`
    });
    
    if (topCategories.length >= 3) {
        insights.neutral.push({
            title: '📂 Kategori Çeşitliliği',
            description: `En çok satılan kategoriler: ${topCategories.map(c => c[0]).join(', ')}. Bu kategorilerde güçlü performans.`
        });
    }
    
    // Öneriler - ZAMAN BAZLI (ÇALIŞMA SAATLERİ DİKKATE ALINARAK)
    if (worstDay && bestDay) {
        // Kapalı gün kontrolü
        const worstDayIndex = worstDay.day;
        const isWorstDayClosed = storeHours.closedDays.includes(worstDayIndex);
        
        if (isWorstDayClosed) {
            insights.recommendations.push({
                icon: '📆',
                title: 'Kapalı Gün Değerlendirmesi',
                description: `${worstDay.name} günleri mağaza kapalı. Bu gün için özel bir strateji gerekmiyor.`
            });
        } else {
            insights.recommendations.push({
                icon: '📆',
                title: 'Gün Bazlı Strateji',
                description: `${worstDay.name} günleri zayıf. ${bestDay.name} günlerindeki başarılı stratejileri ${worstDay.name}'ya da uygulayın. Özel kampanyalar düzenleyin.`
            });
        }
    }
    
    if (topSpHour) {
        const bestHourInRange = topSpHour.hour >= storeHours.openHour && topSpHour.hour < storeHours.closeHour;
        if (bestHourInRange) {
            insights.recommendations.push({
                icon: '⏰',
                title: 'Saat Bazlı Planlama',
                description: `${topSpHour.sp} saat ${topSpHour.hour}:00'da en başarılı. Vardiya planlamasını buna göre optimize edin. (Çalışma saatleri: ${storeHours.openHour}:00-${storeHours.closeHour}:00)`
            });
        }
    }
    
    // Zayıf saat dilimi önerisi kaldırıldı - mağazalar 20:00-22:00 kapanıyor
    // Perakende mağazalar: Tünel, Mavibahçe, Kızılay, İzmir: 20:00
    // Diğer perakende mağazalar: 22:00
    
    insights.recommendations.push({
        icon: '🎯',
        title: 'Stok Yönetimi',
        description: `En çok satan markalar: ${topBrands.map(b => b[0]).join(', ')}. Bu markaların stok seviyelerini takip edin.`
    });
    
    insights.recommendations.push({
        icon: '👥',
        title: 'Ekip Yönetimi',
        description: `En başarılı temsilci ${topSP[0][0]}. Başarı hikayesini diğer ekip üyeleriyle paylaşın.`
    });
    
    let html = `<div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white; padding: 30px; border-radius: 15px;">`;
    
    if (insights.positive.length > 0) {
        html += `<div class="analysis-section"><h3 style="color: white; margin-top: 0;">✅ Güçlü Yönler</h3>`;
        insights.positive.forEach(item => {
            html += `<div class="insight-item" style="background: rgba(56, 239, 125, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #38ef7d;">
                <strong style="font-size: 1.1em;">${item.title}</strong><br>
                <span style="opacity: 0.95; margin-top: 8px; display: block;">${item.description}</span>
            </div>`;
        });
        html += `</div>`;
    }
    
    if (insights.neutral.length > 0) {
        html += `<div class="analysis-section" style="margin-top: 25px;"><h3 style="color: white;">💡 Önemli Bilgiler</h3>`;
        insights.neutral.forEach(item => {
            html += `<div class="insight-item" style="background: rgba(255, 215, 0, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #ffd700;">
                <strong style="font-size: 1.1em;">${item.title}</strong><br>
                <span style="opacity: 0.95; margin-top: 8px; display: block;">${item.description}</span>
            </div>`;
        });
        html += `</div>`;
    }
    
    if (insights.recommendations.length > 0) {
        html += `<div class="analysis-section" style="margin-top: 25px;"><h3 style="color: white;">🎯 Öneriler</h3>`;
        insights.recommendations.forEach(item => {
            html += `<div class="recommendation" style="background: rgba(255, 255, 255, 0.15); padding: 18px; border-radius: 10px; margin: 12px 0;">
                <span style="font-size: 1.8em; margin-right: 12px;">${item.icon}</span>
                <div style="display: inline-block; vertical-align: top; width: calc(100% - 50px);">
                    <strong style="font-size: 1.15em; display: block; margin-bottom: 8px;">${item.title}</strong>
                    <p style="margin: 0; opacity: 0.95; line-height: 1.6;">${item.description}</p>
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    
    html += `</div>`;
    document.getElementById('storeAIAnalysisContent').innerHTML = html;
}

// ==================== CITY ANALYSIS TAB ====================
let cityBrandChartInstance = null;
let cityProductChartInstance = null;
let cityCategoryChartInstance = null;
let cityMonthlyChartInstance = null;

function populateCitySelect() {
    // Veri yüklenmemişse uyarı ver
    const allData = getAllData();
    if (!allData || allData.length === 0) {
        safeConsole.warn('⚠️ Şehir listesi doldurulamadı: Veri henüz yüklenmedi');
        return;
    }
    
    const cities = new Set();
    allData.forEach(item => {
        if (item.partner_city) cities.add(item.partner_city);  // İL bilgisi (state_id)
    });
    
    const select = document.getElementById('citySelect');
    if (!select) {
        console.error('❌ citySelect elementi bulunamadı');
        return;
    }
    
    select.innerHTML = '<option value="">-- Şehir Seçin --</option>';
    
    if (cities.size === 0) {
        safeConsole.warn('⚠️ Hiç şehir verisi bulunamadı');
        select.innerHTML += '<option value="" disabled>Şehir verisi bulunamadı</option>';
        return;
    }
    
    Array.from(cities).sort().forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        select.appendChild(option);
    });
    
    safeConsole.log('✅ Şehir dropdown dolduruldu:', cities.size, 'şehir');
    safeConsole.log('📋 Dropdown içeriği:', select.innerHTML.substring(0, 500));
}

let targetStoresPopulated = false; // Sadece bir kez doldur

// ==================== İLÇE NORMALIZASYON SİSTEMİ ====================
// Levenshtein Distance - Harf hatalarını tespit eder
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];
    
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[len1][len2];
}

// Türkçe karakter normalizasyonu
function normalizeTurkish(str) {
    if (!str) return '';
    
    // Genişletilmiş Türkçe karakter mapping'i
    const turkishMap = {
        // Temel Türkçe karakterler
        'ı': 'i', 'İ': 'i', 'I': 'i',
        'ş': 's', 'Ş': 's', 'S': 's',
        'ğ': 'g', 'Ğ': 'g', 'G': 'g',
        'ü': 'u', 'Ü': 'u', 'U': 'u',
        'ö': 'o', 'Ö': 'o', 'O': 'o',
        'ç': 'c', 'Ç': 'c', 'C': 'c',
        
        // Yaygın yazım hataları
        'i': 'i', 'I': 'i', 'İ': 'i',
        's': 's', 'S': 's', 'Ş': 's',
        'g': 'g', 'G': 'g', 'Ğ': 'g',
        'u': 'u', 'U': 'u', 'Ü': 'u',
        'o': 'o', 'O': 'o', 'Ö': 'o',
        'c': 'c', 'C': 'c', 'Ç': 'c',
        
        // Özel durumlar
        'a': 'a', 'A': 'a', 'Â': 'a',
        'e': 'e', 'E': 'e', 'Ê': 'e',
        'b': 'b', 'B': 'b',
        'd': 'd', 'D': 'd',
        'f': 'f', 'F': 'f',
        'h': 'h', 'H': 'h',
        'j': 'j', 'J': 'j',
        'k': 'k', 'K': 'k',
        'l': 'l', 'L': 'l',
        'm': 'm', 'M': 'm',
        'n': 'n', 'N': 'n',
        'p': 'p', 'P': 'p',
        'q': 'q', 'Q': 'q',
        'r': 'r', 'R': 'r',
        't': 't', 'T': 't',
        'v': 'v', 'V': 'v',
        'w': 'w', 'W': 'w',
        'x': 'x', 'X': 'x',
        'y': 'y', 'Y': 'y',
        'z': 'z', 'Z': 'z'
    };
    
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Özel karakterleri kaldır
        .split('')
        .map(char => turkishMap[char] || char)
        .join('')
        .replace(/\s+/g, '') // Boşlukları kaldır
        .replace(/\d+/g, ''); // Sayıları kaldır
}

// normalizeDistrictName fonksiyonu artık assets/js/core/district-normalizer.js'de

function performCityAIAnalysis(data, cityName, stats) {
    safeConsole.log('🤖 Şehir AI analizi başlatılıyor...');
    
    // Marka analizi
    const brandData = {};
    data.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = 0;
        brandData[brand] += parseFloat(item.usd_amount || 0);
    });
    const topBrands = Object.entries(brandData).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    // Kategori analizi (category_2 kullanıyoruz)
    const categoryData = {};
    data.forEach(item => {
        const category = item.category_2 || 'Bilinmiyor';
        if (!categoryData[category]) categoryData[category] = 0;
        categoryData[category] += parseFloat(item.usd_amount || 0);
    });
    const topCategories = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    const insights = {
        positive: [],
        negative: [],
        neutral: [],
        recommendations: []
    };
    
    // Pozitif içgörüler
    if (topBrands.length > 0) {
        const topBrand = topBrands[0];
        const brandShare = (topBrand[1] / stats.totalSales * 100).toFixed(1);
        insights.positive.push({
            title: `🏷️ ${topBrand[0]} Lider Marka`,
            description: `${cityName} ilinde ${topBrand[0]} markası %${brandShare} pay ile lider ($${topBrand[1].toLocaleString('tr-TR', {minimumFractionDigits: 2})}).`
        });
    }
    
    if (topCategories.length > 0) {
        const topCategory = topCategories[0];
        const catShare = (topCategory[1] / stats.totalSales * 100).toFixed(1);
        insights.positive.push({
            title: `📂 ${topCategory[0]} En Popüler Kategori`,
            description: `${cityName} ilinde ${topCategory[0]} kategorisi %${catShare} pay ile en çok tercih edilen ($${topCategory[1].toLocaleString('tr-TR', {minimumFractionDigits: 2})}).`
        });
    }
    
    // Nötr bilgiler
    insights.neutral.push({
        title: `📊 ${cityName} Genel Performans`,
        description: `Toplam ${stats.uniqueCustomers} müşteri, $${stats.totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} satış gerçekleştirdi. Ortalama sepet değeri $${stats.avgBasket.toLocaleString('tr-TR', {minimumFractionDigits: 2})}.`
    });
    
    if (topBrands.length > 0) {
        insights.neutral.push({
            title: `🏷️ Top 3 Marka`,
            description: `${topBrands.map(b => b[0]).join(', ')} markaları ${cityName} ilinde en çok tercih ediliyor.`
        });
    }
    
    // Öneriler
    insights.recommendations.push({
        icon: '📦',
        title: 'Stok Optimizasyonu',
        description: `${cityName} ilindeki mağazalarda ${topBrands[0][0]} markası ve ${topCategories[0][0]} kategorisi ürünlerinin stok seviyesini artırın.`
    });
    
    insights.recommendations.push({
        icon: '📢',
        title: 'Bölgesel Kampanya',
        description: `${cityName} ili için ${topBrands[0][0]} markasında özel kampanya düzenleyin. Bu bölgede yüksek talep var.`
    });
    
    insights.recommendations.push({
        icon: '🎯',
        title: 'Müşteri Segmentasyonu',
        description: `${cityName} ilindeki ${stats.uniqueCustomers} müşteriye özel e-posta kampanyaları gönderin. Tercih ettikleri kategorilerdeki yeni ürünleri tanıtın.`
    });
    
    // HTML oluştur
    let html = `
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white; padding: 30px; border-radius: 15px;">
            ${insights.positive.length > 0 ? `
            <div class="analysis-section">
                <h3 style="color: white; margin-top: 0;">✅ ${cityName} Güçlü Yönler</h3>
                ${insights.positive.map(item => `
                    <div class="insight-item insight-positive" style="background: rgba(56, 239, 125, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #38ef7d;">
                        <span class="insight-icon" style="font-size: 1.5em; margin-right: 10px;">✅</span>
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
    
    document.getElementById('cityAIAnalysisContent').innerHTML = html;
}

// ==================== STOCK DISTRIBUTION TAB ====================
let stockList = [];  // {product_code: string, qty: number}

function handleStockExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Excel dosyasını okuma işlemi buraya eklenecek
    // Şimdilik sadece renderStockList çağrılıyor
    safeConsole.log('📁 Excel dosyası yüklendi:', file.name);
    renderStockList();
}

function renderStockList() {
    let html = `
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <thead style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white;">
                <tr>
                    <th style="padding: 12px; text-align: left;">#</th>
                    <th style="padding: 12px; text-align: left;">Ürün Kodu</th>
                    <th style="padding: 12px; text-align: right;">Miktar</th>
                    <th style="padding: 12px; text-align: center;">İşlem</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    stockList.forEach((item, index) => {
        html += `
            <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background: #f8f9fa;' : ''}">
                <td style="padding: 12px;">${index + 1}</td>
                <td style="padding: 12px;"><strong>${item.product_code}</strong></td>
                <td style="padding: 12px; text-align: right;">${item.qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="removeStock(${index})" style="background: #dc3545; color: white; border: none; padding: 5px 15px; border-radius: 5px; cursor: pointer;">
                        🗑️ Sil
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    document.getElementById('stockListTable').innerHTML = html;
}

function removeStock(index) {
    stockList.splice(index, 1);
    renderStockList();
}

function clearStockList() {
    if (confirm('Tüm stok listesini temizlemek istediğinize emin misiniz?')) {
        stockList = [];
        renderStockList();
        document.getElementById('stockDistributionResults').style.display = 'none';
    }
}

function analyzeStockDistribution() {
    if (stockList.length === 0) {
        alert('Önce stok listesi yükleyin veya manuel giriş yapın');
        return;
    }
    
    safeConsole.log('🤖 AI stok dağılım analizi başlatılıyor...');
    
    // Envanter verilerinin yüklendiğini kontrol et
    if (!getInventoryData() || !getInventoryData()?.inventory || getInventoryData()?.inventory.length === 0) {
        safeConsole.warn('⚠️ Envanter verisi yok, mevcut stok bilgisi gösterilemeyecek');
    }
    
    if (!getStockLocations() || Object.keys(getStockLocations()).length === 0) {
        safeConsole.warn('⚠️ Stok konumları yok, mevcut stok bilgisi gösterilemeyecek');
    }
    
    // Tarih filtrelerini al
    const dateStart = document.getElementById('stockDateStart').value;
    const dateEnd = document.getElementById('stockDateEnd').value;
    
    safeConsole.log('📅 Tarih Filtreleri:', {dateStart, dateEnd});
    
    const recommendations = [];
    
    const allData = getAllData();
    stockList.forEach(stockItem => {
        // Bu ürün kodunu içeren satışları bul (tarih filtresiyle)
        let productSales = allData.filter(item => 
            item.product && item.product.toLowerCase().includes(stockItem.product_code.toLowerCase())
        );
        
        // Tarih filtresi uygula (opsiyonel)
        if (dateStart) {
            productSales = productSales.filter(item => item.date >= dateStart);
        }
        if (dateEnd) {
            productSales = productSales.filter(item => item.date <= dateEnd);
        }
        
        if (productSales.length === 0) {
            recommendations.push({
                productCode: stockItem.product_code,
                totalStock: stockItem.qty,
                distribution: [],
                message: `⚠️ "${stockItem.product_code}" için geçmiş satış verisi bulunamadı. Eşit dağılım öneriliyor.`,
                noData: true
            });
            return;
        }
        
        // Mağaza bazında satış analizi (son 3 ay)
        const storePerformance = {};
        productSales.forEach(item => {
            const store = item.store || 'Bilinmiyor';
            if (!storePerformance[store]) {
                storePerformance[store] = {qty: 0, sales: 0};
            }
            storePerformance[store].qty += parseFloat(item.quantity || 0);
            storePerformance[store].sales += parseFloat(item.usd_amount || 0);
        });
        
        // Toplam satış
        const totalSold = Object.values(storePerformance).reduce((sum, s) => sum + s.qty, 0);
        
        // Yüzde dağılım hesapla ve mevcut stok bilgisini ekle
        const distribution = [];
        Object.entries(storePerformance).forEach(([store, data]) => {
            const percentage = data.qty / totalSold;
            const recommendedQty = Math.round(stockItem.qty * percentage);
            
            // Envanter verisinden mevcut stok bilgisini bul
            let currentStock = 0;
            if (getInventoryData() && getInventoryData()?.inventory && Object.keys(getStockLocations()).length > 0) {
                // Mağaza adını normalize et
                const normalizedStore = normalizeStoreName(store);
                
                // Bu mağazaya ait stok konumlarını bul
                const matchingLocations = [];
                for (const [locationId, mappedStore] of Object.entries(getStockLocations())) {
                    if (mappedStore === normalizedStore) {
                        matchingLocations.push(locationId);
                    }
                }
                
                // Bu ürün kodunu içeren envanter kayıtlarını bul
                // getCurrentStock fonksiyonu ile TAM AYNI mantık kullanılıyor
                getInventoryData()?.inventory.forEach(invItem => {
                    // getCurrentStock ile aynı: sadece location kullanılıyor
                    const itemLocation = invItem.location || '';
                    const itemProduct = (invItem.product_name || invItem.product || '').toLowerCase();
                    const searchProduct = stockItem.product_code.toLowerCase();
                    
                    // getCurrentStock ile aynı: önce lokasyon, sonra ürün kontrolü
                    if (matchingLocations.includes(itemLocation) && itemProduct.includes(searchProduct)) {
                        currentStock += parseFloat(invItem.quantity || 0);
                    }
                });
            }
            
            distribution.push({
                store: store,
                historicalQty: data.qty,
                historicalSales: data.sales,
                percentage: (percentage * 100).toFixed(1),
                currentStock: currentStock,
                recommendedQty: recommendedQty
            });
        });
        
        // Büyükten küçüğe sırala
        distribution.sort((a, b) => b.recommendedQty - a.recommendedQty);
        
        recommendations.push({
            productCode: stockItem.product_code,
            totalStock: stockItem.qty,
            distribution: distribution,
            message: `✅ "${stockItem.product_code}" için ${distribution.length} mağazaya dağılım önerisi hazırlandı.`,
            noData: false
        });
    });
    
    // Sonuçları göster
    renderStockDistributionResults(recommendations);
}

function clearStockDateFilters() {
    document.getElementById('stockDateStart').value = '';
    document.getElementById('stockDateEnd').value = '';
    safeConsole.log('🔄 Stok tarih filtreleri temizlendi');
}

function renderStockDistributionResults(recommendations) {
    document.getElementById('stockDistributionResults').style.display = 'block';
    
    let html = '';
    
    recommendations.forEach((rec, index) => {
        html += `
            <div style="background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); padding: 30px; border-radius: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px; color: #e2e8f0;">
                <h3 style="margin: 0 0 20px 0; color: #10B981;">
                    ${index + 1}. ${rec.productCode} (Toplam Stok: ${rec.totalStock.toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet)
                </h3>
                <p style="color: #cbd5e1; margin-bottom: 20px;">${rec.message}</p>
                
                ${rec.noData ? `
                    <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107;">
                        <strong>💡 Öneri:</strong> Geçmiş satış verisi olmadığı için mağazalara eşit dağıtım yapabilirsiniz.
                    </div>
                ` : `
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: #f8f9fa;">
                            <tr>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Mağaza</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Geçmiş Satış</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Pay (%)</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Mevcut Stok</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Önerilen Stok</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rec.distribution.map((dist, i) => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); ${i % 2 === 0 ? 'background: rgba(255,255,255,0.05);' : ''}">
                                    <td style="padding: 12px; color: #e2e8f0;"><strong>${dist.store}</strong></td>
                                    <td style="padding: 12px; text-align: right; color: #e2e8f0;">${dist.historicalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet</td>
                                    <td style="padding: 12px; text-align: right; color: #10B981; font-weight: bold;">${dist.percentage}%</td>
                                    <td style="padding: 12px; text-align: right; color: #94a3b8; font-weight: bold;">${(dist.currentStock || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet</td>
                                    <td style="padding: 12px; text-align: right; color: #38ef7d; font-weight: bold; font-size: 1.1em;">${(dist.recommendedQty || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div style="background: #d1ecf1; padding: 20px; border-radius: 10px; border-left: 4px solid #0c5460; margin-top: 20px;">
                        <strong>🤖 AI Öneri:</strong> Bu dağılım, geçmiş satış performansına göre optimize edilmiştir. 
                        En yüksek satış yapan mağazalara daha fazla stok ayrılmıştır.
                    </div>
                `}
            </div>
        `;
    });
    
    
    // Sonuçlara scroll
    document.getElementById('stockDistributionResults').scrollIntoView({behavior: 'smooth', block: 'start'});
}

// ==================== SALESPERSON ANALYSIS TAB ====================
let salespersonBrandChartInstance = null;
let salespersonCategoryChartInstance = null;
let salespersonStoreChartInstance = null;
let salespersonMonthlyChartInstance = null;
// comparisonStoreSalesChartInstance ve comparisonStoreQtyChartInstance dosyanın başında tanımlı

// Seçili satış temsilcileri array
let selectedSalespersons = [];
let lastSalespersonSearchTerms = []; // Son arama terimlerini sakla (yıl filtresi için)
let lastSalespersonTopProductsData = null; // Son ürün verilerini sakla (sıralama için)
let currentSalespersonSortColumn = 'sales'; // Mevcut sıralama kolonu
let currentSalespersonSortDirection = 'desc'; // Mevcut sıralama yönü

// ==================== STORE ANALYSIS TAB ====================
// comparisonStoreSalesChartInstance ve comparisonStoreQtyChartInstance dosyanın başında tanımlı

// Satış temsilcisi filtrelerini doldur (checkbox yapısı)
// Multi-Select Helper Functions
function initMultiSelect(selectId, options, placeholder = 'Seçiniz...') {
    safeConsole.log('🔍 [DEBUG] initMultiSelect çağrıldı:', { selectId, optionsCount: options.length, placeholder });
    const originalSelect = document.getElementById(selectId);
    if (!originalSelect) {
        safeConsole.error('❌ [DEBUG] initMultiSelect: Element bulunamadı:', selectId);
        return;
    }
    
    safeConsole.log('🔍 [DEBUG] Original select bulundu:', originalSelect);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'multi-select-wrapper';
    wrapper.innerHTML = `
        <button class="multi-select-button" type="button">
            <span class="selected-text placeholder">${placeholder}</span>
            <span class="arrow">▼</span>
        </button>
        <div class="multi-select-dropdown">
            <div class="multi-select-options"></div>
            <div class="multi-select-footer">
                <button type="button" class="select-all">Tümünü Seç</button>
                <button type="button" class="clear-all">Temizle</button>
            </div>
        </div>
    `;
    
    originalSelect.parentNode.insertBefore(wrapper, originalSelect);
    originalSelect.style.display = 'none';
    safeConsole.log('🔍 [DEBUG] Multi-select wrapper eklendi, original select gizlendi');
    
    const button = wrapper.querySelector('.multi-select-button');
    const dropdown = wrapper.querySelector('.multi-select-dropdown');
    const optionsContainer = wrapper.querySelector('.multi-select-options');
    const selectAllBtn = wrapper.querySelector('.select-all');
    const clearAllBtn = wrapper.querySelector('.clear-all');
    const selectedText = button.querySelector('.selected-text');
    
    safeConsole.log('🔍 [DEBUG] Multi-select elementleri:', {
        hasButton: !!button,
        hasDropdown: !!dropdown,
        hasOptionsContainer: !!optionsContainer,
        hasSelectAll: !!selectAllBtn,
        hasClearAll: !!clearAllBtn
    });
    
    let selectedValues = [];
    
    // Options oluştur
    safeConsole.log('🔍 [DEBUG] Options oluşturuluyor, toplam:', options.length);
    options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multi-select-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option.value;
        checkbox.id = `${selectId}-${option.value}`;
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = option.label;
        
        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        optionsContainer.appendChild(optionDiv);
        
        checkbox.addEventListener('change', updateSelected);
        if (index < 3) { // İlk 3 option için log
            safeConsole.log('🔍 [DEBUG] Option eklendi:', { value: option.value, label: option.label });
        }
    });
    safeConsole.log('✅ [DEBUG] Tüm options eklendi');
    
    function updateSelected() {
        selectedValues = Array.from(optionsContainer.querySelectorAll('input:checked')).map(cb => cb.value);
        safeConsole.log('🔍 [DEBUG] updateSelected - Seçili değerler:', selectedValues);
        
        // Original select'i güncelle (virgülle ayrılmış)
        originalSelect.value = selectedValues.join(',');
        safeConsole.log('🔍 [DEBUG] Original select güncellendi:', originalSelect.value);
        
        // Button text güncelle
        if (selectedValues.length === 0) {
            selectedText.textContent = placeholder;
            selectedText.className = 'selected-text placeholder';
        } else if (selectedValues.length <= 3) {
            selectedText.textContent = selectedValues.map(v => {
                const opt = options.find(o => o.value === v);
                return opt ? opt.label : v;
            }).join(', ');
            selectedText.className = 'selected-text';
        } else {
            selectedText.textContent = `${selectedValues.length} seçili`;
            selectedText.className = 'selected-text';
        }
        
        // Apply filter
        if (selectId.includes('Salesperson')) {
            applySalespersonFilters();
        } else if (selectId.includes('Store')) {
            applyStoreFilters();
        }
    }
    
    // Aç/Kapa
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = dropdown.classList.contains('active');
        closeAllMultiSelects();
        if (!isActive) {
            dropdown.classList.add('active');
            button.classList.add('active');
        }
    });
    
    // Dışarı tıklayınca kapat
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.remove('active');
            button.classList.remove('active');
        }
    });
    
    // Tümünü seç
    selectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsContainer.querySelectorAll('input').forEach(cb => cb.checked = true);
        updateSelected();
    });
    
    // Temizle
    clearAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        safeConsole.log('🔍 [DEBUG] Clear All butonuna tıklandı');
        optionsContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
        updateSelected();
    });
    
    safeConsole.log('✅ [DEBUG] initMultiSelect tamamlandı:', selectId);
    return wrapper;
}

function closeAllMultiSelects() {
    document.querySelectorAll('.multi-select-dropdown').forEach(dd => dd.classList.remove('active'));
    document.querySelectorAll('.multi-select-button').forEach(btn => btn.classList.remove('active'));
}

function getMultiSelectValues(selectId) {
    safeConsole.log('🔍 [DEBUG] getMultiSelectValues çağrıldı:', selectId);
    const originalSelect = document.getElementById(selectId);
    if (!originalSelect) {
        safeConsole.warn(`⚠️ [DEBUG] getMultiSelectValues: ${selectId} bulunamadı!`);
        return [];
    }
    
    // HER ZAMAN checkbox'lardan oku (gerçek durum)
    const wrapper = originalSelect.previousElementSibling;
    let result = [];
    
    safeConsole.log('🔍 [DEBUG] getMultiSelectValues wrapper durumu:', {
        hasWrapper: !!wrapper,
        isMultiSelectWrapper: wrapper?.classList.contains('multi-select-wrapper')
    });
    
    if (wrapper?.classList.contains('multi-select-wrapper')) {
        const optionsContainer = wrapper.querySelector('.multi-select-options');
        if (optionsContainer) {
            const checkedBoxes = optionsContainer.querySelectorAll('input:checked');
            result = Array.from(checkedBoxes).map(cb => cb.value).filter(v => v && v.trim() !== '');
            safeConsole.log('🔍 [DEBUG] Checkbox\'lardan okunan değerler:', result);
        } else {
            safeConsole.warn('⚠️ [DEBUG] Options container bulunamadı');
        }
    } else {
        safeConsole.log('🔍 [DEBUG] Multi-select wrapper yok, fallback kullanılıyor');
    }
    
    // Eğer checkbox'lardan okuyamadıysak, select value'dan oku (fallback)
    if (result.length === 0) {
        const value = originalSelect.value;
        result = value ? value.split(',').filter(v => v && v.trim() !== '') : [];
        safeConsole.log('🔍 [DEBUG] Fallback: Select value\'dan okunan:', result);
    } else {
        // Checkbox'lardan okuduysak, select value'yu senkronize et
        originalSelect.value = result.join(',');
    }
    
    safeConsole.log(`✅ [DEBUG] getMultiSelectValues(${selectId}) sonuç:`, { 
        selectValue: originalSelect.value,
        checkboxCount: result.length,
        checkboxValues: result,
        finalResult: result 
    });
    
    return result;
}

function updateMultiSelectButton(wrapper, selectedValues, options, placeholder) {
    const button = wrapper.querySelector('.multi-select-button');
    const selectedText = button?.querySelector('.selected-text');
    if (!selectedText) return;
    if (selectedValues.length === 0) {
        selectedText.textContent = placeholder;
        selectedText.className = 'selected-text placeholder';
    } else if (selectedValues.length <= 3) {
        selectedText.textContent = selectedValues.map(v => {
            const opt = options.find(o => o.value === v);
            return opt ? opt.label : v;
        }).join(', ');
        selectedText.className = 'selected-text';
    } else {
        selectedText.textContent = `${selectedValues.length} seçili`;
        selectedText.className = 'selected-text';
    }
}

function populateSalespersonYearFilter() {
    safeConsole.log('🔍 [DEBUG] populateSalespersonYearFilter çağrıldı');
    const allData = getAllData();
    safeConsole.log('🔍 [DEBUG] getAllData() sonucu:', { dataLength: allData?.length || 0, hasData: !!allData });
    if (!allData || allData.length === 0) {
        safeConsole.warn('⚠️ [DEBUG] populateSalespersonYearFilter: Veri yok, çıkılıyor');
        return;
    }
    
    const years = new Set();
    
    allData.forEach(item => {
        if (item.date) {
            const dateParts = item.date.split('-');
            if (dateParts.length >= 3) {
                years.add(dateParts[0]); // YYYY
            }
        }
    });
    
    safeConsole.log('🔍 [DEBUG] Bulunan yıllar:', Array.from(years).sort().reverse());
    
    // Multi-select için options hazırla
    const yearOptions = Array.from(years).sort().reverse().map(year => ({
        value: year,
        label: year
    }));
    
    safeConsole.log('🔍 [DEBUG] Year options hazırlandı:', yearOptions);
    
    const yearSelect = document.getElementById('filterSalespersonYearSelect');
    if (!yearSelect) {
        safeConsole.error('❌ [DEBUG] populateSalespersonYearFilter: filterSalespersonYearSelect elementi bulunamadı');
        return;
    }
    
    safeConsole.log('🔍 [DEBUG] filterSalespersonYearSelect elementi bulundu:', yearSelect);
    
    const wrapper = yearSelect.previousElementSibling;
    safeConsole.log('🔍 [DEBUG] Wrapper durumu:', { 
        hasWrapper: !!wrapper, 
        wrapperClass: wrapper?.className,
        isMultiSelectWrapper: wrapper?.classList.contains('multi-select-wrapper')
    });
    
    // Eğer multi-select henüz oluşturulmamışsa oluştur
    if (!wrapper?.classList.contains('multi-select-wrapper')) {
        safeConsole.log('🔍 [DEBUG] Multi-select yok, oluşturuluyor...');
        initMultiSelect('filterSalespersonYearSelect', yearOptions, 'Tüm Yıllar');
        safeConsole.log('✅ [DEBUG] Multi-select oluşturuldu');
        return; // Multi-select oluşturuldu, işlem tamamlandı
    } else {
        safeConsole.log('🔍 [DEBUG] Multi-select zaten var, options güncelleniyor...');
        // Multi-select zaten varsa, options'ları güncelle
        const optionsContainer = wrapper.querySelector('.multi-select-options');
        safeConsole.log('🔍 [DEBUG] Options container:', { found: !!optionsContainer });
        if (optionsContainer) {
            // Mevcut seçili değerleri sakla
            const currentSelected = Array.from(optionsContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            safeConsole.log('🔍 [DEBUG] Mevcut seçili değerler:', currentSelected);
            
            // Options container'ı temizle
            optionsContainer.innerHTML = '';
            safeConsole.log('🔍 [DEBUG] Options container temizlendi');
            
            // Update function
            const updateSelected = () => {
                const selected = Array.from(optionsContainer.querySelectorAll('input:checked')).map(cb => cb.value);
                yearSelect.value = selected.join(',');
                updateMultiSelectButton(wrapper, selected, yearOptions, 'Tüm Yıllar');
                applySalespersonFilters();
            };
            
            // Yeni options'ları ekle
            yearOptions.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'multi-select-option';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = option.value;
                checkbox.id = `filterSalespersonYearSelect-${option.value}`;
                checkbox.checked = currentSelected.includes(option.value); // Seçili değerleri geri yükle
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = option.label;
                
                optionDiv.appendChild(checkbox);
                optionDiv.appendChild(label);
                optionsContainer.appendChild(optionDiv);
                
                // Event listener ekle
                checkbox.addEventListener('change', updateSelected);
            });
            
            // Select All ve Clear All butonlarını güncelle
            const selectAllBtn = wrapper.querySelector('.select-all');
            const clearAllBtn = wrapper.querySelector('.clear-all');
            if (selectAllBtn) {
                // Mevcut event listener'ları kaldır ve yenisini ekle
                const newSelectAllBtn = selectAllBtn.cloneNode(true);
                selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);
                newSelectAllBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsContainer.querySelectorAll('input').forEach(cb => cb.checked = true);
                    updateSelected();
                });
            }
            if (clearAllBtn) {
                const newClearAllBtn = clearAllBtn.cloneNode(true);
                clearAllBtn.parentNode.replaceChild(newClearAllBtn, clearAllBtn);
                newClearAllBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
                    updateSelected();
                });
            }
            
            // Button text'i güncelle
            const selected = Array.from(optionsContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            updateMultiSelectButton(wrapper, selected, yearOptions, 'Tüm Yıllar');
            safeConsole.log('✅ [DEBUG] populateSalespersonYearFilter tamamlandı, seçili değerler:', selected);
        } else {
            safeConsole.warn('⚠️ [DEBUG] Options container bulunamadı');
        }
    }
}

function populateSalespersonMonthFilter() {
    safeConsole.log('🔍 [DEBUG] populateSalespersonMonthFilter çağrıldı');
    const monthOptions = [
        {value: '01', label: 'Ocak'},
        {value: '02', label: 'Şubat'},
        {value: '03', label: 'Mart'},
        {value: '04', label: 'Nisan'},
        {value: '05', label: 'Mayıs'},
        {value: '06', label: 'Haziran'},
        {value: '07', label: 'Temmuz'},
        {value: '08', label: 'Ağustos'},
        {value: '09', label: 'Eylül'},
        {value: '10', label: 'Ekim'},
        {value: '11', label: 'Kasım'},
        {value: '12', label: 'Aralık'}
    ];
    
    const monthSelect = document.getElementById('filterSalespersonMonthSelect');
    safeConsole.log('🔍 [DEBUG] filterSalespersonMonthSelect:', { found: !!monthSelect });
    if (monthSelect && !monthSelect.previousElementSibling?.classList.contains('multi-select-wrapper')) {
        safeConsole.log('🔍 [DEBUG] Month multi-select oluşturuluyor...');
        initMultiSelect('filterSalespersonMonthSelect', monthOptions, 'Tüm Aylar');
        safeConsole.log('✅ [DEBUG] Month multi-select oluşturuldu');
    } else {
        safeConsole.log('🔍 [DEBUG] Month multi-select zaten var veya element bulunamadı');
    }
}

function populateSalespersonDayFilter() {
    safeConsole.log('🔍 [DEBUG] populateSalespersonDayFilter çağrıldı');
    const dayOptions = [];
    for (let i = 1; i <= 31; i++) {
        const day = String(i).padStart(2, '0');
        dayOptions.push({value: day, label: day});
    }
    
    const daySelect = document.getElementById('filterSalespersonDaySelect');
    safeConsole.log('🔍 [DEBUG] filterSalespersonDaySelect:', { found: !!daySelect });
    if (daySelect && !daySelect.previousElementSibling?.classList.contains('multi-select-wrapper')) {
        safeConsole.log('🔍 [DEBUG] Day multi-select oluşturuluyor...');
        initMultiSelect('filterSalespersonDaySelect', dayOptions, 'Tüm Günler');
        safeConsole.log('✅ [DEBUG] Day multi-select oluşturuldu');
    } else {
        safeConsole.log('🔍 [DEBUG] Day multi-select zaten var veya element bulunamadı');
    }
}

function applySalespersonFilters() {
    safeConsole.log('🔍 [DEBUG] applySalespersonFilters çağrıldı');
    // Eğer satış temsilcisi aranmışsa, filtreleri uygula
    const salespersonProfileContainer = document.getElementById('salespersonProfileContainer');
    const isProfileVisible = salespersonProfileContainer && salespersonProfileContainer.style.display !== 'none';
    safeConsole.log('🔍 [DEBUG] Profil container durumu:', { 
        found: !!salespersonProfileContainer, 
        isVisible: isProfileVisible 
    });
    
    if (isProfileVisible) {
        safeConsole.log('🔍 [DEBUG] Profil görünüyor, searchSalespersonProfile çağrılıyor');
        // Profil görünüyorsa, mevcut aramayı yıl filtresine göre yeniden filtrele
        searchSalespersonProfile();
    } else {
        safeConsole.log('🔍 [DEBUG] Profil görünmüyor, Top 50 listesi güncelleniyor');
        // Profil görünmüyorsa, Top 50 listesini yıl filtresine göre yeniden render et
        const yearFilter = getMultiSelectValues('filterSalespersonYearSelect');
        const monthFilter = getMultiSelectValues('filterSalespersonMonthSelect');
        const dayFilter = getMultiSelectValues('filterSalespersonDaySelect');
        safeConsole.log('📅 [DEBUG] Satış Temsilcisi - Filtreler:', { 
            year: yearFilter, 
            month: monthFilter, 
            day: dayFilter 
        });
        
        // Top 50 listesini yeniden render et (yıl filtresi uygulanacak)
        const allData = getAllData();
        if (allData && allData.length > 0) {
            safeConsole.log('🔍 [DEBUG] Top 50 listesi render ediliyor...');
            renderSalespersonListTable();
        } else {
            safeConsole.warn('⚠️ [DEBUG] Veri yok, liste render edilemedi');
        }
    }
    safeConsole.log('✅ [DEBUG] applySalespersonFilters tamamlandı');
}

// Satış temsilcisi filtrelerini temizle
function toggleSalespersonCustomDayRange(value) {
    const customDiv = document.getElementById('salespersonCustomDayRange');
    if (value === 'custom') {
        customDiv.style.display = 'block';
    } else {
        customDiv.style.display = 'none';
        // Hazır seçenekleri uygula
        if (value) {
            const [start, end] = value.split('-');
            document.getElementById('salespersonStartDay').value = start;
            document.getElementById('salespersonEndDay').value = end;
        } else {
            document.getElementById('salespersonStartDay').value = '';
            document.getElementById('salespersonEndDay').value = '';
        }
    }
}

function clearSalespersonFilters() {
    // Multi-select'leri temizle
    const yearSelect = document.getElementById('filterSalespersonYearSelect');
    const monthSelect = document.getElementById('filterSalespersonMonthSelect');
    const daySelect = document.getElementById('filterSalespersonDaySelect');
    
    if (yearSelect) {
        yearSelect.value = '';
        const yearWrapper = yearSelect.previousElementSibling;
        if (yearWrapper?.classList.contains('multi-select-wrapper')) {
            yearWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            const yearText = yearWrapper.querySelector('.selected-text');
            yearText.textContent = 'Tüm Yıllar';
            yearText.className = 'selected-text placeholder';
        }
    }
    
    if (monthSelect) {
        monthSelect.value = '';
        const monthWrapper = monthSelect.previousElementSibling;
        if (monthWrapper?.classList.contains('multi-select-wrapper')) {
            monthWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            const monthText = monthWrapper.querySelector('.selected-text');
            monthText.textContent = 'Tüm Aylar';
            monthText.className = 'selected-text placeholder';
        }
    }
    
    if (daySelect) {
        daySelect.value = '';
        const dayWrapper = daySelect.previousElementSibling;
        if (dayWrapper?.classList.contains('multi-select-wrapper')) {
            dayWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            const dayText = dayWrapper.querySelector('.selected-text');
            dayText.textContent = 'Tüm Günler';
            dayText.className = 'selected-text placeholder';
        }
    }
    
    // Filtreleri uygula
    applySalespersonFilters();
}

function renderSalespersonStoreChart(data) {
    const storeData = {};
    data.forEach(item => {
        const store = item.store || 'Bilinmiyor';
        if (!storeData[store]) storeData[store] = {sales: 0, qty: 0};
        storeData[store].sales += parseFloat(item.usd_amount || 0);
        storeData[store].qty += parseFloat(item.quantity || 0);
    });
    
    const sorted = Object.entries(storeData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 5); // Top 5 mağaza
    // Mağaza adlarını temizle (kodları kaldır)
    const labels = sorted.map(item => item[0].replace(/\[.*?\]\s*/g, '').replace(/^.*?\s-\s/, '').trim());
    const salesValues = sorted.map(item => item[1].sales);
    const qtyValues = sorted.map(item => item[1].qty);
    
    const ctx = document.getElementById('salespersonStoreChart');
    if (!ctx) return;
    
    if (salespersonStoreChartInstance) {
        salespersonStoreChartInstance.destroy();
    }
    
    salespersonStoreChartInstance = new Chart(ctx, {
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
                legend: {display: true, position: 'top'}
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderSalespersonBrandChart(data) {
    const brandData = {};
    data.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = {sales: 0, qty: 0};
        brandData[brand].sales += parseFloat(item.usd_amount || 0);
        brandData[brand].qty += parseFloat(item.quantity || 0);
    });
    
    const sorted = Object.entries(brandData)
        .sort((a, b) => b[1].sales - a[1].sales)
        .slice(0, 10); // Top 10 marka
    
    const labels = sorted.map(item => item[0]);
    const salesValues = sorted.map(item => item[1].sales);
    
    const ctx = document.getElementById('salespersonBrandChart');
    if (!ctx) {
        safeConsole.warn('⚠️ salespersonBrandChart canvas bulunamadı');
        return;
    }
    
    if (salespersonBrandChartInstance) {
        salespersonBrandChartInstance.destroy();
    }
    
    salespersonBrandChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: salesValues,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'top'}
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                        }
                    }
                }
            }
        }
    });
    
    safeConsole.log('✅ salespersonBrandChart render edildi');
}

function renderSalespersonCategoryChart(data) {
    const categoryData = {};
    data.forEach(item => {
        // Hiyerarşik kategori oluştur (ALL atlanır)
        const categoryParts = [item.category_1, item.category_2, item.category_3, item.category_4]
            .filter(c => c && c.trim() && c.toLowerCase() !== 'all');
        const categoryDisplay = categoryParts.length > 0 ? categoryParts.join(' › ') : 'Bilinmiyor';
        
        if (!categoryData[categoryDisplay]) categoryData[categoryDisplay] = {sales: 0, qty: 0};
        categoryData[categoryDisplay].sales += parseFloat(item.usd_amount || 0);
        categoryData[categoryDisplay].qty += parseFloat(item.quantity || 0);
    });
    
    const sorted = Object.entries(categoryData)
        .sort((a, b) => b[1].sales - a[1].sales)
        .slice(0, 15); // Top 15 kategori
    
    const labels = sorted.map(item => item[0]);
    const salesValues = sorted.map(item => item[1].sales);
    
    const ctx = document.getElementById('salespersonCategoryChart');
    if (!ctx) {
        safeConsole.warn('⚠️ salespersonCategoryChart canvas bulunamadı');
        return;
    }
    
    if (salespersonCategoryChartInstance) {
        salespersonCategoryChartInstance.destroy();
    }
    
    salespersonCategoryChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: salesValues,
                backgroundColor: 'rgba(245, 87, 108, 0.6)',
                borderColor: 'rgba(245, 87, 108, 1)',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'top'}
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('tr-TR', {minimumFractionDigits: 2});
                        }
                    }
                }
            }
        }
    });
    
    safeConsole.log('✅ salespersonCategoryChart render edildi');
}

function renderSalespersonMonthlyChart(data) {
    // Yıl bazında grupla (karşılaştırma için)
    const yearlyMonthlyData = {};
    data.forEach(item => {
        const date = new Date(item.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        if (!yearlyMonthlyData[year]) yearlyMonthlyData[year] = {};
        if (!yearlyMonthlyData[year][month]) yearlyMonthlyData[year][month] = 0;
        yearlyMonthlyData[year][month] += parseFloat(item.usd_amount || 0);
    });
    
    // Tüm ayları topla (etiketler için)
    const allMonthKeys = new Set();
    Object.values(yearlyMonthlyData).forEach(yearData => {
        Object.keys(yearData).forEach(month => allMonthKeys.add(month));
    });
    const sortedMonths = Array.from(allMonthKeys).sort();
    
    // Dataset oluştur (her yıl için)
    const datasets = [];
    const colors = [
        {border: 'rgba(102, 126, 234, 1)', bg: 'rgba(102, 126, 234, 0.1)'},
        {border: 'rgba(245, 87, 108, 1)', bg: 'rgba(245, 87, 108, 0.1)'},
        {border: 'rgba(56, 239, 125, 1)', bg: 'rgba(56, 239, 125, 0.1)'},
        {border: 'rgba(255, 206, 86, 1)', bg: 'rgba(255, 206, 86, 0.1)'}
    ];
    
    Object.keys(yearlyMonthlyData).sort().forEach((year, idx) => {
        const yearData = yearlyMonthlyData[year];
        const values = sortedMonths.map(month => yearData[month] || 0);
        const color = colors[idx % colors.length];
        
        datasets.push({
            label: `${year} Satışları`,
            data: values,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 3,
            fill: true,
            tension: 0.4
        });
    });
    
    const ctx = document.getElementById('salespersonMonthlyChart');
    if (!ctx) return;
    
    if (salespersonMonthlyChartInstance) {
        salespersonMonthlyChartInstance.destroy();
    }
    
    // Ay isimlerini göster
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const labels = sortedMonths.map(m => monthNames[parseInt(m) - 1]);
    
    salespersonMonthlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: true, position: 'top'}
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

function renderSalespersonTopProducts(data = null, sortColumn = null, sortDirection = null) {
    // Eğer data null ise, mevcut veriyi kullan
    if (data === null && lastSalespersonTopProductsData) {
        data = lastSalespersonTopProductsData;
    }
    
    if (!data || data.length === 0) {
        document.getElementById('salespersonTopProductsTable').innerHTML = '<p style="text-align: center; padding: 20px;">Veri bulunamadı</p>';
        return;
    }
    
    // Sıralama parametrelerini güncelle
    if (sortColumn !== null) {
        if (currentSalespersonSortColumn === sortColumn) {
            currentSalespersonSortDirection = currentSalespersonSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSalespersonSortColumn = sortColumn;
            currentSalespersonSortDirection = 'desc';
        }
    }
    
    // Ürün bazında grupla
    const productData = {};
    data.forEach(item => {
        // İndirim ürünlerini ve iadeleri gizle
        if (shouldHideItem(item)) {
            return;
        }
        
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
    
    // Sıralama
    let sorted = Object.entries(productData);
    
    if (currentSalespersonSortColumn === 'product') {
        sorted.sort((a, b) => {
            return currentSalespersonSortDirection === 'asc' 
                ? a[0].localeCompare(b[0], 'tr')
                : b[0].localeCompare(a[0], 'tr');
        });
    } else if (currentSalespersonSortColumn === 'brand') {
        sorted.sort((a, b) => {
            return currentSalespersonSortDirection === 'asc'
                ? a[1].brand.localeCompare(b[1].brand, 'tr')
                : b[1].brand.localeCompare(a[1].brand, 'tr');
        });
    } else if (currentSalespersonSortColumn === 'category') {
        sorted.sort((a, b) => {
            return currentSalespersonSortDirection === 'asc'
                ? a[1].category.localeCompare(b[1].category, 'tr')
                : b[1].category.localeCompare(a[1].category, 'tr');
        });
    } else if (currentSalespersonSortColumn === 'sales') {
        sorted.sort((a, b) => {
            return currentSalespersonSortDirection === 'asc'
                ? a[1].sales - b[1].sales
                : b[1].sales - a[1].sales;
        });
    } else if (currentSalespersonSortColumn === 'qty') {
        sorted.sort((a, b) => {
            return currentSalespersonSortDirection === 'asc'
                ? a[1].qty - b[1].qty
                : b[1].qty - a[1].qty;
        });
    } else if (currentSalespersonSortColumn === 'count') {
        sorted.sort((a, b) => {
            return currentSalespersonSortDirection === 'asc'
                ? a[1].count - b[1].count
                : b[1].count - a[1].count;
        });
    }
    
    // Top 20
    sorted = sorted.slice(0, 20);
    
    const getSortIcon = (column) => {
        if (currentSalespersonSortColumn !== column) return '⇅';
        return currentSalespersonSortDirection === 'asc' ? '↑' : '↓';
    };
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow: hidden;">
            <thead style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white;">
                <tr>
                    <th style="padding: 15px; text-align: left; color: white; font-weight: 600;">#</th>
                    <th style="padding: 15px; text-align: left; cursor: pointer; color: white; font-weight: 600;" onclick="renderSalespersonTopProducts(null, 'product')">
                        Ürün ${getSortIcon('product')}
                    </th>
                    <th style="padding: 15px; text-align: left; cursor: pointer; color: white; font-weight: 600;" onclick="renderSalespersonTopProducts(null, 'brand')">
                        Marka ${getSortIcon('brand')}
                    </th>
                    <th style="padding: 15px; text-align: left; cursor: pointer; color: white; font-weight: 600;" onclick="renderSalespersonTopProducts(null, 'category')">
                        Kategori ${getSortIcon('category')}
                    </th>
                    <th style="padding: 15px; text-align: right; cursor: pointer; color: white; font-weight: 600;" onclick="renderSalespersonTopProducts(null, 'sales')">
                        Satış (USD) ${getSortIcon('sales')}
                    </th>
                    <th style="padding: 15px; text-align: right; cursor: pointer; color: white; font-weight: 600;" onclick="renderSalespersonTopProducts(null, 'qty')">
                        Miktar ${getSortIcon('qty')}
                    </th>
                    <th style="padding: 15px; text-align: right; cursor: pointer; color: white; font-weight: 600;" onclick="renderSalespersonTopProducts(null, 'count')">
                        İşlem ${getSortIcon('count')}
                    </th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach((item, index) => {
        const product = item[0];
        const stats = item[1];
        
        html += `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.05)'" onmouseout="this.style.background='${index % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'transparent'}'">
                <td style="padding: 12px; color: #e2e8f0;">${index + 1}</td>
                <td style="padding: 12px; color: #e2e8f0;"><strong>${product}</strong></td>
                <td style="padding: 12px; color: #e2e8f0;">${stats.brand}</td>
                <td style="padding: 12px; color: #e2e8f0;">${stats.category}</td>
                <td style="padding: 12px; text-align: right; color: #10B981; font-weight: bold;">$${stats.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right; color: #e2e8f0;">${stats.qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right; color: #e2e8f0;">${stats.count}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    document.getElementById('salespersonTopProductsTable').innerHTML = html;
    
    // Veriyi kaydet (sıralama için)
    lastSalespersonTopProductsData = data;
}

function renderSalespersonBottomProducts(data) {
    // Ürün bazında grupla
    const productData = {};
    data.forEach(item => {
        // İndirim ürünlerini ve iadeleri gizle
        if (shouldHideItem(item)) {
            return;
        }
        
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
    
    // Bottom 10 (en az satan)
    const sorted = Object.entries(productData).sort((a, b) => a[1].sales - b[1].sales).slice(0, 10);
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <thead style="background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white;">
                <tr>
                    <th style="padding: 15px; text-align: left;">#</th>
                    <th style="padding: 15px; text-align: left;">Ürün</th>
                    <th style="padding: 15px; text-align: left;">Marka</th>
                    <th style="padding: 15px; text-align: left;">Kategori</th>
                    <th style="padding: 15px; text-align: right;">Satış (USD)</th>
                    <th style="padding: 15px; text-align: right;">Miktar</th>
                    <th style="padding: 15px; text-align: right;">İşlem</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach((item, index) => {
        const product = item[0];
        const stats = item[1];
        
        html += `
            <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background: #fff3cd;' : 'background: #ffe5e5;'}">
                <td style="padding: 12px;">${index + 1}</td>
                <td style="padding: 12px;"><strong>${product}</strong></td>
                <td style="padding: 12px;">${stats.brand}</td>
                <td style="padding: 12px;">${stats.category}</td>
                <td style="padding: 12px; text-align: right; color: #f5576c; font-weight: bold;">$${stats.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right;">${stats.qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right;">${stats.count}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    document.getElementById('salespersonBottomProductsTable').innerHTML = html;
}

function renderSalespersonComparisonTable(salespersonsData) {
    const container = document.getElementById('salespersonComparisonTable');
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white;">
                    <th style="padding: 15px; text-align: left;">Metrik</th>
                    ${salespersonsData.map(sp => `<th style="padding: 15px; text-align: right;">👨‍💼 ${sp.name}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                <tr style="background: white;">
                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600;">💰 Toplam Satış</td>
                    ${salespersonsData.map(sp => `<td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: right;">$${sp.totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>`).join('')}
                </tr>
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600;">📦 Toplam Adet</td>
                    ${salespersonsData.map(sp => `<td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: right;">${sp.totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>`).join('')}
                </tr>
                <tr style="background: white;">
                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600;">🛒 Fatura Sayısı</td>
                    ${salespersonsData.map(sp => `<td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: right;">${sp.invoiceCount}</td>`).join('')}
                </tr>
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600;">📊 Günlük Ort. Satış</td>
                    ${salespersonsData.map(sp => `<td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: right;">$${sp.avgTransaction.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>`).join('')}
                </tr>
                <tr style="background: white;">
                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600;">🛒 Sepet Ortalaması</td>
                    ${salespersonsData.map(sp => `<td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: right;">$${sp.avgBasket.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>`).join('')}
                </tr>
                <tr style="background: white;">
                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600;">👥 Farklı Müşteri</td>
                    ${salespersonsData.map(sp => `<td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: right;">${sp.uniqueCustomers}</td>`).join('')}
                </tr>
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: 600;">🎯 Farklı Ürün</td>
                    ${salespersonsData.map(sp => `<td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: right;">${sp.uniqueProducts}</td>`).join('')}
                </tr>
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function renderSalespersonComparisonCharts(salespersonsData) {
    const names = salespersonsData.map(sp => sp.name);
    const sales = salespersonsData.map(sp => sp.totalSales);
    const quantities = salespersonsData.map(sp => sp.totalQty);
    
    const colors = [
        'rgba(102, 126, 234, 0.7)',
        'rgba(240, 147, 251, 0.7)',
        'rgba(255, 159, 64, 0.7)'
    ];
    
    const borderColors = [
        'rgba(102, 126, 234, 1)',
        'rgba(240, 147, 251, 1)',
        'rgba(255, 159, 64, 1)'
    ];
    
    // Satış karşılaştırma grafiği
    const salesCtx = document.getElementById('comparisonSalesChart');
    if (comparisonStoreSalesChartInstance) {
        comparisonStoreSalesChartInstance.destroy();
    }
    
    comparisonStoreSalesChartInstance = new Chart(salesCtx, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [{
                label: 'Toplam Satış ($)',
                data: sales,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
    
    // Miktar karşılaştırma grafiği
    const qtyCtx = document.getElementById('comparisonQtyChart');
    if (qtyCtx) {
        if (comparisonStoreQtyChartInstance) {
            comparisonStoreQtyChartInstance.destroy();
        }
        
        comparisonStoreQtyChartInstance = new Chart(qtyCtx, {
            type: 'bar',
            data: {
                labels: names,
                datasets: [{
                    label: 'Toplam Miktar',
                    data: quantities,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

/**
 * Satış temsilcisi önerilerini göster (OPTIMIZED - Index kullanıyor)
 */
function _showSalespersonSuggestionsInternal(query) {
    safeConsole.log('🔍 [DEBUG] showSalespersonSuggestions çağrıldı:', { query, queryType: typeof query });
    if (!query || typeof query !== 'string') {
        query = '';
        safeConsole.log('🔍 [DEBUG] Query boş veya string değil, temizlendi');
    }
    
    // Index'i build et (eğer yapılmadıysa)
    ensureSalespersonIndex();
    const index = getSalespersonIndex();
    
    const suggestionsDiv = document.getElementById('salespersonSuggestions');
    if (!suggestionsDiv) {
        safeConsole.warn('⚠️ [DEBUG] salespersonSuggestions div bulunamadı');
        return;
    }
    safeConsole.log('🔍 [DEBUG] suggestionsDiv bulundu');
    
    // Virgülden sonraki son terimi al
    const terms = query.split(',');
    const lastTerm = terms[terms.length - 1].trim().toLowerCase();
    query = lastTerm;
    safeConsole.log('🔍 [DEBUG] İşlenmiş query:', { original: query, lastTerm, terms });
    
    if (query.length < 2) {
        safeConsole.log('🔍 [DEBUG] Query çok kısa (< 2 karakter), öneriler gizleniyor');
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    if (!index.isIndexed) {
        safeConsole.warn('⚠️ [DEBUG] Index henüz oluşturulmamış');
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    safeConsole.log('🔍 [DEBUG] Satış temsilcisi önerileri aranıyor (Index kullanılıyor):', query);
    
    // PERFORMANCE: Index kullanarak arama yap (çok daha hızlı)
    const startTime = performance.now();
    const salespersons = index.searchSalespersons(query).slice(0, 10); // Top 10
    const duration = performance.now() - startTime;
    
    safeConsole.log(`🔍 [DEBUG] Index araması tamamlandı: ${salespersons.length} sonuç (${duration.toFixed(2)}ms)`);
    
    safeConsole.log('🔍 [DEBUG] Sıralanmış öneriler (Top 10):', salespersons.map(s => s.name));
    
    if (salespersons.length === 0) {
        safeConsole.log('🔍 [DEBUG] Öneri bulunamadı, div gizleniyor');
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    safeConsole.log('🔍 [DEBUG] HTML oluşturuluyor, toplam öneri:', salespersons.length);
    let html = '';
    salespersons.forEach((salesperson, idx) => {
        html += `<div class="suggestion-item" data-index="${idx}" data-name="${salesperson.name}" 
            style="padding: 12px 20px; cursor: pointer; border-bottom: 1px solid #e0e0e0; transition: background 0.2s;"
            onmouseover="this.style.background='#f0f0ff'; window.salespersonSuggestionIndex=${idx};"
            onmouseout="this.style.background='white';"
            onclick="window.selectSalespersonSuggestion('${salesperson.name.replace(/'/g, "\\'")}')">
            <strong>${salesperson.name}</strong>
            <span style="color: #10B981; margin-left: 10px; font-size: 0.9em;">
                $${salesperson.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} • ${salesperson.count} sipariş
            </span>
        </div>`;
    });
    
    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';
    window.salespersonSuggestionIndex = -1;
    safeConsole.log('✅ [DEBUG] showSalespersonSuggestions tamamlandı, öneriler gösterildi');
    
    // Eğer sadece bir öneri varsa ve tam eşleşme varsa, otomatik olarak arama yap
    const input = document.getElementById('salespersonSearchInput');
    if (input && salespersons.length === 1) {
        const inputValue = input.value.trim();
        const lastTerm = inputValue.split(',').map(t => t.trim()).filter(t => t.length > 0).pop() || '';
        const exactMatch = salespersons[0].name.toLowerCase() === lastTerm.toLowerCase();
        if (exactMatch) {
            safeConsole.log('🔍 [DEBUG] Tam eşleşme bulundu, otomatik arama yapılıyor:', salespersons[0].name);
            // Kısa bir gecikme ile arama yap (kullanıcı yazmayı bitirsin)
            clearTimeout(window.salespersonAutoSearchTimeout);
            window.salespersonAutoSearchTimeout = setTimeout(() => {
                const currentInput = document.getElementById('salespersonSearchInput');
                if (currentInput) {
                    const currentValue = currentInput.value.trim();
                    const currentLastTerm = currentValue.split(',').map(t => t.trim()).filter(t => t.length > 0).pop() || '';
                    if (currentLastTerm.toLowerCase() === salespersons[0].name.toLowerCase()) {
                        window.selectSalespersonSuggestion(salespersons[0].name);
                    }
                }
            }, 800);
        }
    }
}

// PERFORMANCE: Debounced version (autocomplete için)
export const showSalespersonSuggestions = debounce(_showSalespersonSuggestionsInternal, 300);

/**
 * Satış temsilcisi klavye event handler
 */
export function handleSalespersonKeydown(event) {
    const suggestionsDiv = document.getElementById('salespersonSuggestions');
    if (!suggestionsDiv) return;
    
    const items = suggestionsDiv.querySelectorAll('.suggestion-item');
    
    if (items.length === 0) return;
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        window.salespersonSuggestionIndex = Math.min((window.salespersonSuggestionIndex || -1) + 1, items.length - 1);
        highlightSalespersonSuggestion(items);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        window.salespersonSuggestionIndex = Math.max((window.salespersonSuggestionIndex || -1) - 1, 0);
        highlightSalespersonSuggestion(items);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (window.salespersonSuggestionIndex >= 0 && items[window.salespersonSuggestionIndex]) {
            const name = items[window.salespersonSuggestionIndex].getAttribute('data-name');
            if (window.selectSalespersonSuggestion) {
                window.selectSalespersonSuggestion(name);
            }
        } else {
            searchSalespersonProfile();
        }
    } else if (event.key === 'Escape') {
        suggestionsDiv.style.display = 'none';
    }
}

/**
 * Satış temsilcisi önerisini vurgula
 */
function highlightSalespersonSuggestion(items) {
    items.forEach((item, idx) => {
        if (idx === (window.salespersonSuggestionIndex || -1)) {
            item.style.background = '#f0f0ff';
            item.scrollIntoView({block: 'nearest'});
        } else {
            item.style.background = 'white';
        }
    });
}

/**
 * Satış temsilcisi profili arama
 */
export function searchSalespersonProfile() {
    safeConsole.log('🔍 [DEBUG] searchSalespersonProfile çağrıldı');
    const allData = getAllData();
    safeConsole.log('🔍 [DEBUG] getAllData() sonucu:', { dataLength: allData?.length || 0 });
    
    const searchInput = document.getElementById('salespersonSearchInput');
    if (!searchInput) {
        safeConsole.error('❌ [DEBUG] searchSalespersonProfile: salespersonSearchInput bulunamadı');
        return;
    }
    
    const searchQuery = searchInput.value.trim();
    safeConsole.log('🔍 [DEBUG] Arama sorgusu:', searchQuery);
    
    if (!searchQuery) {
        safeConsole.warn('⚠️ [DEBUG] Arama sorgusu boş');
        alert('Lütfen bir satış temsilcisi adı girin');
        return;
    }
    
    safeConsole.log('🔍 [DEBUG] Satış temsilcisi aranıyor:', searchQuery);
    
    // Virgülle ayrılmış isimleri al
    const searchTerms = searchQuery.split(',').map(term => term.trim().toLowerCase()).filter(term => term.length > 0);
    safeConsole.log('🔍 [DEBUG] Arama terimleri:', searchTerms);
    
    // Filtreleri al
    const yearFilter = getMultiSelectValues('filterSalespersonYearSelect');
    const monthFilter = getMultiSelectValues('filterSalespersonMonthSelect');
    const dayFilter = getMultiSelectValues('filterSalespersonDaySelect');
    safeConsole.log('🔍 [DEBUG] Aktif filtreler:', { year: yearFilter, month: monthFilter, day: dayFilter });
    
    // PERFORMANCE: Index kullanarak veriyi filtrele
    ensureSalespersonIndex();
    const index = getSalespersonIndex();
    
    safeConsole.log('🔍 [DEBUG] Veri filtreleniyor (Index kullanılıyor)...');
    const startTime = performance.now();
    
    // Önce satış temsilcisi verilerini index'ten al
    let filteredData = [];
    for (const term of searchTerms) {
        const salespersonData = index.getSalespersonData(term);
        if (salespersonData.length > 0) {
            // Fuzzy match: eğer tam eşleşme yoksa, includes ile ara
            if (salespersonData.length === 0) {
                // Index'te tam eşleşme yoksa, tüm index'te ara
                const allIndexedData = index._getAllIndexedData();
                const matched = allIndexedData.filter(item => {
                    const salesPerson = (item.sales_person || '').toLowerCase();
                    return salesPerson.includes(term);
                });
                filteredData.push(...matched);
            } else {
                filteredData.push(...salespersonData);
            }
        } else {
            // Index'te tam eşleşme yoksa, tüm index'te ara
            const allIndexedData = index._getAllIndexedData();
            const matched = allIndexedData.filter(item => {
                const salesPerson = (item.sales_person || '').toLowerCase();
                return salesPerson.includes(term);
            });
            filteredData.push(...matched);
        }
    }
    
    // Benzersiz hale getir (aynı item birden fazla kez eklenmiş olabilir)
    const uniqueData = [];
    const seen = new Set();
    for (const item of filteredData) {
        const key = `${item.date}-${item.product}-${item.partner}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueData.push(item);
        }
    }
    filteredData = uniqueData;
    
    // Tarih filtrelerini uygula
    if (yearFilter.length > 0 || monthFilter.length > 0 || dayFilter.length > 0) {
        filteredData = filteredData.filter(item => {
            // Yıl filtresi
            if (yearFilter.length > 0) {
                const itemYear = item.date ? item.date.split('-')[0] : '';
                if (!yearFilter.includes(itemYear)) return false;
            }
            
            // Ay filtresi
            if (monthFilter.length > 0) {
                const itemMonth = item.date ? item.date.split('-')[1] : '';
                if (!monthFilter.includes(itemMonth)) return false;
            }
            
            // Gün filtresi
            if (dayFilter.length > 0) {
                const itemDay = item.date ? item.date.split('-')[2] : '';
                if (!dayFilter.includes(itemDay)) return false;
            }
            
            return true;
        });
    }
    
    const duration = performance.now() - startTime;
    safeConsole.log(`🔍 [DEBUG] Filtrelenmiş veri (Index kullanıldı): ${filteredData.length} kayıt (${duration.toFixed(2)}ms)`);
    
    if (filteredData.length === 0) {
        safeConsole.warn('⚠️ [DEBUG] Filtrelenmiş veri bulunamadı');
        const profileContainer = document.getElementById('salespersonProfileContainer');
        if (profileContainer) profileContainer.style.display = 'none';
        alert('Satış temsilcisi bulunamadı. Lütfen farklı bir isim deneyin.');
        return;
    }
    
    // Son arama terimlerini kaydet
    lastSalespersonSearchTerms = searchTerms;
    safeConsole.log('🔍 [DEBUG] Son arama terimleri kaydedildi:', lastSalespersonSearchTerms);
    
    // Profil container'ı göster
    const profileContainer = document.getElementById('salespersonProfileContainer');
    if (profileContainer) {
        profileContainer.style.display = 'block';
        safeConsole.log('✅ [DEBUG] Profil container gösterildi');
    } else {
        safeConsole.warn('⚠️ [DEBUG] Profil container bulunamadı');
    }
    
    // Default listeyi gizle
    const defaultSection = document.getElementById('salespersonListSectionDefault');
    const bottomSection = document.getElementById('salespersonListSectionBottom');
    if (defaultSection) {
        defaultSection.style.display = 'none';
        safeConsole.log('🔍 [DEBUG] Default section gizlendi');
    }
    if (bottomSection) {
        bottomSection.style.display = 'block';
        safeConsole.log('🔍 [DEBUG] Bottom section gösterildi');
    }
    
    // Seçili satış temsilcilerini güncelle
    const uniqueSalespersons = [...new Set(filteredData.map(item => item.sales_person).filter(Boolean))];
    selectedSalespersons = uniqueSalespersons.slice(0, 3); // En fazla 3
    safeConsole.log('🔍 [DEBUG] Seçili satış temsilcileri:', selectedSalespersons);
    
    // Seçili temsilcileri göster
    updateSelectedSalespersonsDisplay();
    
    // View görünürlüğünü ayarla
    const singleView = document.getElementById('singleSalespersonView');
    const multipleView = document.getElementById('multipleSalespersonsView');
    
    // Eğer tek bir satış temsilcisi varsa, detaylı profil göster
    if (selectedSalespersons.length === 1) {
        safeConsole.log('🔍 [DEBUG] Tek satış temsilcisi, detaylı profil gösteriliyor');
        
        // View görünürlüğünü ayarla
        if (singleView) singleView.style.display = 'block';
        if (multipleView) multipleView.style.display = 'none';
        
        const salespersonName = selectedSalespersons[0];
        const salespersonData = filteredData.filter(item => item.sales_person === salespersonName);
        safeConsole.log('🔍 [DEBUG] Satış temsilcisi verisi:', { name: salespersonName, dataCount: salespersonData.length });
        
        // İstatistikleri hesapla
        // DÜZELTME: shouldHideItem kontrolü eklenmeli (Dashboard ile tutarlılık için)
        // İadeler ve indirim ürünleri totalSales'e dahil edilmemeli
        const filteredSalespersonData = salespersonData.filter(item => !shouldHideItem(item));
        
        const totalSales = filteredSalespersonData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
        const totalQty = filteredSalespersonData.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
        
        // Benzersiz tarih sayısı (sadece filtrelenmiş veriden)
        const uniqueDates = new Set(filteredSalespersonData.map(item => item.date));
        const uniqueDatesCount = uniqueDates.size;
        
        // Günlük Ort. Satış = Toplam Satış / Benzersiz Tarih Sayısı (Dashboard ile tutarlı)
        const avgTransaction = totalSales / Math.max(uniqueDatesCount, 1);
        
            // Sepet Ortalaması = Sadece Satış Faturalarının Toplamı / Satış Fatura Sayısı (İadeler Hariç)
            // DÜZELTME: Dashboard ve summary-cards ile aynı mantık
            // Not: filteredSalespersonData zaten shouldHideItem ile filtrelenmiş, ama yine de kontrol ediyoruz
            const salesInvoices = filteredSalespersonData.filter(item => {
            const amt = parseFloat(item.usd_amount || 0);
            // Sadece satış faturaları (iade değil) ve pozitif tutarlı
            return amt > 0 && item.move_type !== 'out_refund' && (item.move_type === 'out_invoice' || !item.move_type);
        });
        
        // Invoice key'ler sadece move_name veya move_id kullanmalı (product YOK)
        // Fallback'te product kullanmak yanlış - aynı faturadaki farklı ürünler farklı key oluşturur
        const invoiceKeys = salesInvoices
            .map(item => item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}`)
            .filter(Boolean);
        const uniqueInvoices = new Set(invoiceKeys).size;
        
        // Sadece satış faturalarının toplamını hesapla
        const salesInvoicesTotal = salesInvoices.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
        const avgBasket = uniqueInvoices > 0 ? salesInvoicesTotal / uniqueInvoices : 0;
        
        // Fatura sayısı (benzersiz tarih sayısı değil, gerçek fatura sayısı)
        const invoiceCount = uniqueInvoices;
        
        const uniqueCustomers = new Set(filteredSalespersonData.map(item => item.partner).filter(Boolean)).size;
        const uniqueProducts = new Set(filteredSalespersonData.map(item => item.product).filter(Boolean)).size;
        
        safeConsole.log('🔍 [DEBUG] Hesaplanan istatistikler:', {
            totalSales, totalQty, invoiceCount, avgTransaction, avgBasket, uniqueCustomers, uniqueProducts
        });
        
        // İsim bilgisini güncelle
        const nameElement = document.getElementById('salespersonName');
        if (nameElement) nameElement.textContent = salespersonName;
        
        // İstatistikleri DOM'a yaz
        const totalSalesElement = document.getElementById('salespersonTotalSales');
        if (totalSalesElement) {
            totalSalesElement.textContent = '$' + totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        }
        
        const totalQtyElement = document.getElementById('salespersonTotalQty');
        if (totalQtyElement) {
            totalQtyElement.textContent = totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        }
        
        const invoiceCountElement = document.getElementById('salespersonInvoiceCount');
        if (invoiceCountElement) {
            invoiceCountElement.textContent = invoiceCount.toLocaleString('tr-TR');
        }
        
        const avgTransactionElement = document.getElementById('salespersonAvgTransaction');
        if (avgTransactionElement) {
            avgTransactionElement.textContent = '$' + avgTransaction.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        }
        
        const avgBasketElement = document.getElementById('salespersonAvgBasket');
        if (avgBasketElement) {
            avgBasketElement.textContent = '$' + avgBasket.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        }
        
        const uniqueCustomersElement = document.getElementById('salespersonUniqueCustomers');
        if (uniqueCustomersElement) {
            uniqueCustomersElement.textContent = uniqueCustomers.toLocaleString('tr-TR');
        }
        
        const uniqueProductsElement = document.getElementById('salespersonUniqueProducts');
        if (uniqueProductsElement) {
            uniqueProductsElement.textContent = uniqueProducts.toLocaleString('tr-TR');
        }
        
        safeConsole.log('✅ [DEBUG] İstatistikler DOM\'a yazıldı');
        
        // Grafikleri render et
        safeConsole.log('🔍 [DEBUG] Grafikler render ediliyor...');
        renderSalespersonMonthlyChart(salespersonData);
        renderSalespersonStoreChart(salespersonData);
        renderSalespersonBrandChart(salespersonData);
        renderSalespersonCategoryChart(salespersonData);
        renderSalespersonTopProducts(salespersonData);
        renderSalespersonBottomProducts(salespersonData);
        
        // AI analiz
        safeConsole.log('🔍 [DEBUG] AI analizi yapılıyor...');
        performSalespersonAIAnalysis(salespersonData, { name: salespersonName });
        safeConsole.log('✅ [DEBUG] Tek satış temsilcisi profil gösterimi tamamlandı');
    } else if (selectedSalespersons.length > 1) {
        safeConsole.log('🔍 [DEBUG] Çoklu satış temsilcisi, karşılaştırma gösteriliyor');
        
        // View görünürlüğünü ayarla
        if (singleView) singleView.style.display = 'none';
        if (multipleView) multipleView.style.display = 'block';
        // Çoklu karşılaştırma
        const comparisonData = selectedSalespersons.map(name => {
            const data = filteredData.filter(item => item.sales_person === name);
            
            // DÜZELTME: shouldHideItem kontrolü eklenmeli (Dashboard ile tutarlılık için)
            const filteredDataForPerson = data.filter(item => !shouldHideItem(item));
            
            const totalSales = filteredDataForPerson.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
            const totalQty = filteredDataForPerson.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
            const uniqueDates = new Set(filteredDataForPerson.map(item => item.date));
            const uniqueDatesCount = uniqueDates.size;
            
            // Günlük Ort. Satış = Toplam Satış / Benzersiz Tarih Sayısı
            const avgTransaction = totalSales / Math.max(uniqueDatesCount, 1);
            
            // Sepet Ortalaması = Sadece Satış Faturalarının Toplamı / Satış Fatura Sayısı (İadeler Hariç)
            // DÜZELTME: Dashboard ve summary-cards ile aynı mantık
            // Not: filteredDataForPerson zaten shouldHideItem ile filtrelenmiş, ama yine de kontrol ediyoruz
            const salesInvoices = filteredDataForPerson.filter(item => {
                const amt = parseFloat(item.usd_amount || 0);
                return amt > 0 && item.move_type !== 'out_refund' && (item.move_type === 'out_invoice' || !item.move_type);
            });
            
            // Invoice key'ler sadece move_name veya move_id kullanmalı (product YOK)
            const invoiceKeys = salesInvoices
                .map(item => item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}`)
                .filter(Boolean);
            const uniqueInvoices = new Set(invoiceKeys).size;
            
            // Sadece satış faturalarının toplamını hesapla
            const salesInvoicesTotal = salesInvoices.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
            const avgBasket = uniqueInvoices > 0 ? salesInvoicesTotal / uniqueInvoices : 0;
            
            // Fatura sayısı (benzersiz tarih sayısı değil, gerçek fatura sayısı)
            const invoiceCount = uniqueInvoices;
            
            const uniqueCustomers = new Set(filteredDataForPerson.map(item => item.partner).filter(Boolean)).size;
            const uniqueProducts = new Set(filteredDataForPerson.map(item => item.product).filter(Boolean)).size;
            
            return {
                name,
                totalSales,
                totalQty,
                invoiceCount,
                avgTransaction,
                avgBasket,
                uniqueCustomers,
                uniqueProducts
            };
        });
        
        renderSalespersonComparisonTable(comparisonData);
        renderSalespersonComparisonCharts(comparisonData);
        safeConsole.log('✅ [DEBUG] Çoklu satış temsilcisi karşılaştırması tamamlandı');
    }
    
    // Sonuçlara scroll
    if (profileContainer) {
        profileContainer.scrollIntoView({behavior: 'smooth', block: 'start'});
        safeConsole.log('🔍 [DEBUG] Profil container\'a scroll yapıldı');
    }
    
    safeConsole.log('✅ [DEBUG] searchSalespersonProfile tamamlandı');
}

/**
 * Seçili satış temsilcilerini göster
 */
function updateSelectedSalespersonsDisplay() {
    const container = document.getElementById('selectedSalespersonsContainer');
    const tagsDiv = document.getElementById('selectedSalespersonsTags');
    
    if (!container || !tagsDiv) return;
    
    if (selectedSalespersons.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    tagsDiv.innerHTML = selectedSalespersons.map((name, idx) => `
        <span style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white; padding: 8px 15px; border-radius: 20px; font-size: 0.9em; display: flex; align-items: center; gap: 8px;">
            ${name}
            <button onclick="removeSalesperson('${name.replace(/'/g, "\\'")}')" style="background: rgba(255,255,255,0.3); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 0.8em; padding: 0;">×</button>
        </span>
    `).join('');
}

/**
 * Satış temsilcisi AI analizi
 */
function performSalespersonAIAnalysis(data, profile) {
    // Bu fonksiyon mevcut performSalespersonAIAnalysis ile aynı olabilir
    // Şimdilik basit bir implementasyon
    const analysisDiv = document.getElementById('salespersonAIAnalysis');
    if (!analysisDiv) return;
    
    const totalSales = data.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const totalQty = data.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    
    analysisDiv.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="color: #10B981; margin-top: 0;">🤖 AI Analizi</h3>
            <p><strong>${profile.name}</strong> için toplam satış: $${totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
            <p>Toplam miktar: ${totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
        </div>
    `;
}

/**
 * Satış temsilcisi listesi tablosu (OPTIMIZED - Index kullanıyor)
 */
export function renderSalespersonListTable() {
    // PERFORMANCE: Index kullan
    ensureSalespersonIndex();
    const index = getSalespersonIndex();
    
    if (!index.isIndexed) {
        safeConsole.warn('⚠️ Index henüz oluşturulmamış, renderSalespersonListTable atlanıyor');
        return;
    }
    
    // Yıl filtresi
    const yearFilter = getMultiSelectValues('filterSalespersonYearSelect');
    
    // PERFORMANCE: Index'ten filtreli veriyi al (cache ile)
    const startTime = performance.now();
    const filteredData = index.getFilteredData({
        year: yearFilter,
        month: [],
        day: []
    });
    const filterDuration = performance.now() - startTime;
    safeConsole.log(`📦 Filtreleme (Index): ${filteredData.length} kayıt (${filterDuration.toFixed(2)}ms)`);
    
    // Satış temsilcisi bazında grupla
    const salespersonData = {};
    const processStartTime = performance.now();
    filteredData.forEach(item => {
        // Boşluk kontrolü ve trim (bir kez yapılıyor)
        let name = (item.sales_person || 'Bilinmiyor').trim();
        
        // "Kasa" ile başlayan satış temsilcilerini filtrele (Dashboard ile tutarlılık)
        if (name.toLowerCase().startsWith('kasa')) {
            return;
        }
        
        // Boş string kontrolü
        if (!name || name === '') {
            name = 'Bilinmiyor';
        }
        
        if (!salespersonData[name]) {
            salespersonData[name] = {
                name,
                sales: 0,
                qty: 0,
                count: 0
            };
        }
        
        // Güvenli sayı dönüşümü (NaN kontrolü)
        const salesAmount = parseFloat(item.usd_amount || 0);
        const quantity = parseFloat(item.quantity || 0);
        
        salespersonData[name].sales += (isNaN(salesAmount) ? 0 : salesAmount);
        salespersonData[name].qty += (isNaN(quantity) ? 0 : quantity);
        salespersonData[name].count += 1;
    });
    
    const processDuration = performance.now() - processStartTime;
    safeConsole.log(`📦 Gruplama: ${Object.keys(salespersonData).length} satış temsilcisi (${processDuration.toFixed(2)}ms)`);
    
    // Satışa göre sırala, eşitlik durumunda miktara göre, Top 50
    const sorted = Object.values(salespersonData)
        .sort((a, b) => {
            // Önce satışa göre (azalan)
            if (b.sales !== a.sales) {
                return b.sales - a.sales;
            }
            // Eşitlik durumunda miktara göre (azalan)
            if (b.qty !== a.qty) {
                return b.qty - a.qty;
            }
            // Eşitlik durumunda işlem sayısına göre (azalan)
            return b.count - a.count;
        })
        .slice(0, 50);
    
    // Hangi div'e yazılacağını belirle
    const defaultSection = document.getElementById('salespersonListSectionDefault');
    const bottomSection = document.getElementById('salespersonListSectionBottom');
    const isDefaultVisible = defaultSection && defaultSection.style.display !== 'none';
    
    const tableDivDefault = document.getElementById('salespersonListTableDefault');
    const tableDivBottom = document.getElementById('salespersonListTableBottom');
    
    // Boş veri kontrolü
    if (sorted.length === 0) {
        const emptyMessage = `
            <div style="text-align: center; padding: 40px; background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(10px); border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 3em; margin-bottom: 15px;">📊</div>
                <h3 style="color: #e2e8f0; margin-bottom: 10px;">Veri Bulunamadı</h3>
                <p style="color: #94a3b8;">Seçili filtreler için satış temsilcisi verisi bulunamadı.</p>
            </div>
        `;
        if (tableDivDefault) {
            tableDivDefault.innerHTML = emptyMessage;
        }
        if (tableDivBottom) {
            tableDivBottom.innerHTML = emptyMessage;
        }
        return;
    }
    
    // HTML escape fonksiyonu (XSS koruması)
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    
    // JavaScript string escape fonksiyonu (onclick için)
    function escapeJsString(str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')  // Önce backslash escape et (diğer escape'leri bozmamak için)
            .replace(/'/g, "\\'")     // Tek tırnak escape
            .replace(/"/g, '\\"')     // Çift tırnak escape
            .replace(/`/g, '\\`')     // Backtick escape (template literal injection koruması)
            .replace(/\n/g, '\\n')    // Newline escape
            .replace(/\r/g, '\\r')    // Carriage return escape
            .replace(/\t/g, '\\t');   // Tab escape
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">
            <thead style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white;">
                <tr>
                    <th style="padding: 15px; text-align: left;">#</th>
                    <th style="padding: 15px; text-align: left;">Satış Temsilcisi</th>
                    <th style="padding: 15px; text-align: right;">Toplam Satış</th>
                    <th style="padding: 15px; text-align: right;">Toplam Miktar</th>
                    <th style="padding: 15px; text-align: right;">Satış Kaydı</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach((item, index) => {
        const escapedName = escapeHtml(item.name);
        const escapedNameJs = escapeJsString(item.name);
        const salesValue = isNaN(item.sales) ? 0 : item.sales;
        const qtyValue = isNaN(item.qty) ? 0 : item.qty;
        
        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); ${index % 2 === 0 ? 'background: rgba(255,255,255,0.05);' : 'background: transparent;'} cursor: pointer; color: #e2e8f0;"
                onclick="document.getElementById('salespersonSearchInput').value='${escapedNameJs}'; searchSalespersonProfile();"
                onmouseover="this.style.background='rgba(16, 185, 129, 0.1)';"
                onmouseout="this.style.background='${index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'}';">
                <td style="padding: 12px; color: #e2e8f0;">${index + 1}</td>
                <td style="padding: 12px; color: #e2e8f0;"><strong>${escapedName}</strong></td>
                <td style="padding: 12px; text-align: right; color: #10B981; font-weight: bold;">$${salesValue.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right; color: #e2e8f0;">${qtyValue.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 12px; text-align: right; color: #e2e8f0;">${item.count}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    // Her iki div'e de yaz (görünür olan kullanılacak)
    if (tableDivDefault) {
        tableDivDefault.innerHTML = html;
    }
    if (tableDivBottom) {
        tableDivBottom.innerHTML = html;
    }
}

// Global fonksiyonlar (window'a eklenecek)
window.selectSalespersonSuggestion = function(name) {
    const input = document.getElementById('salespersonSearchInput');
    if (!input) return;
    
    const currentValue = input.value.trim();
    const terms = currentValue.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    safeConsole.log('🔍 [DEBUG] selectSalespersonSuggestion çağrıldı:', { 
        name, 
        currentValue, 
        terms, 
        selectedSalespersons 
    });
    
    // Eğer virgül varsa (çoklu seçim modu), son terimi seçilen isimle değiştir
    if (currentValue.includes(',')) {
        // Çoklu seçim modu: Son terimi seçilen isimle değiştir
        const previousTerms = terms.slice(0, -1); // Son terim hariç tüm terimler
        if (!previousTerms.includes(name)) {
            // Eğer seçilen isim önceki terimlerde yoksa, son terimi değiştir ve ekle
            previousTerms.push(name);
            input.value = previousTerms.join(', ');
        } else {
            // Eğer seçilen isim önceki terimlerde varsa, sadece son terimi kaldır
            input.value = previousTerms.join(', ');
        }
    } else {
        // Virgül yok: Tek seçim modu mu yoksa çoklu seçim başlangıcı mı?
        // Eğer selectedSalespersons array'inde zaten personeller varsa, çoklu seçim modu
        // Basit mantık: Eğer zaten seçilmiş personeller varsa, yeni seçilen personeli yanına ekle
        const hasSelectedPersons = selectedSalespersons.length > 0;
        
        if (hasSelectedPersons) {
            // Zaten seçilmiş personeller var, yeni seçilen personeli yanına ekle
            if (!selectedSalespersons.includes(name)) {
                // En fazla 3 personel seçilebilir
                if (selectedSalespersons.length < 3) {
                    const newTerms = [...selectedSalespersons, name];
                    input.value = newTerms.join(', ');
                    safeConsole.log('🔍 [DEBUG] Çoklu seçim modu: Yeni personel eklendi', newTerms);
                } else {
                    // 3 personel zaten seçili, son seçileni değiştir
                    const newTerms = [...selectedSalespersons.slice(0, -1), name];
                    input.value = newTerms.join(', ');
                    safeConsole.log('🔍 [DEBUG] 3 personel limiti: Son personel değiştirildi', newTerms);
                }
            } else {
                // Zaten seçilmiş, değiştirme (tek seçim moduna geç)
                input.value = name;
                safeConsole.log('🔍 [DEBUG] Personel zaten seçili, tek seçim moduna geçildi');
            }
        } else {
            // İlk seçim, tüm input değerini seçilen isimle değiştir
            input.value = name;
            safeConsole.log('🔍 [DEBUG] Tek seçim modu: Input değeri değiştirildi');
        }
    }
    
    safeConsole.log('🔍 [DEBUG] Input değeri güncellendi:', input.value);
    
    // Önerileri gizle
    const suggestionsDiv = document.getElementById('salespersonSuggestions');
    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
    
    // Arama yap
    searchSalespersonProfile();
    
    // Personel seçildikten sonra input'u temizle (seçili personeller zaten tag'lerde gösteriliyor)
    input.value = '';
    safeConsole.log('🔍 [DEBUG] Input temizlendi, seçili personeller tag\'lerde gösteriliyor');
};

window.removeSalesperson = function(name) {
    selectedSalespersons = selectedSalespersons.filter(sp => sp !== name);
    updateSelectedSalespersonsDisplay();
    
    const input = document.getElementById('salespersonSearchInput');
    if (input) {
        const terms = input.value.split(',').map(t => t.trim()).filter(t => t !== name);
        input.value = terms.join(', ');
    }
    
    // Eğer hiç temsilci kalmadıysa, profili gizle
    if (selectedSalespersons.length === 0) {
        const profileContainer = document.getElementById('salespersonProfileContainer');
        if (profileContainer) profileContainer.style.display = 'none';
        
        const defaultSection = document.getElementById('salespersonListSectionDefault');
        const bottomSection = document.getElementById('salespersonListSectionBottom');
        if (defaultSection) defaultSection.style.display = 'block';
        if (bottomSection) bottomSection.style.display = 'none';
        
        renderSalespersonListTable();
    } else {
        // Kalan temsilcilerle arama yap
        searchSalespersonProfile();
    }
};

// Export tüm fonksiyonlar
export function analyzeStore(storeName, yearFilter, monthFilter, dayFilter, categoryFilter = []) {
    // TODO: renderSingleStoreView fonksiyonu henüz tanımlanmamış
    safeConsole.warn('⚠️ analyzeStore: renderSingleStoreView fonksiyonu henüz tanımlanmamış');
    return null;
}

export {
    // Sadece tanımlı olan fonksiyonları export et
    performStoreAIAnalysis,
    renderSalespersonMonthlyChart,
    renderSalespersonTopProducts,
    renderSalespersonBottomProducts,
    renderSalespersonComparisonTable,
    renderSalespersonComparisonCharts,
    populateSalespersonYearFilter,
    populateSalespersonMonthFilter,
    populateSalespersonDayFilter,
    applySalespersonFilters,
    clearSalespersonFilters
    // Not: showSalespersonSuggestions, handleSalespersonKeydown, searchSalespersonProfile, 
    // renderSalespersonListTable, analyzeStore zaten export function olarak tanımlı
};

// Global erişim için window'a ekle
// Sadece tanımlı olan fonksiyonları ekle
window.storeAnalyzerModule = {
    performStoreAIAnalysis,
    analyzeStore,
    showSalespersonSuggestions,
    handleSalespersonKeydown,
    searchSalespersonProfile,
    renderSalespersonListTable,
    renderSalespersonMonthlyChart,
    renderSalespersonTopProducts,
    renderSalespersonBottomProducts,
    renderSalespersonComparisonTable,
    renderSalespersonComparisonCharts,
    populateSalespersonYearFilter,
    populateSalespersonMonthFilter,
    populateSalespersonDayFilter,
    applySalespersonFilters,
    clearSalespersonFilters
};

// HTML'deki inline event handler'lar için doğrudan window'a atama
window.applySalespersonFilters = applySalespersonFilters;
window.clearSalespersonFilters = clearSalespersonFilters;
window.populateSalespersonYearFilter = populateSalespersonYearFilter;
window.populateSalespersonMonthFilter = populateSalespersonMonthFilter;
window.populateSalespersonDayFilter = populateSalespersonDayFilter;
window.showSalespersonSuggestions = showSalespersonSuggestions;
window.handleSalespersonKeydown = handleSalespersonKeydown;
