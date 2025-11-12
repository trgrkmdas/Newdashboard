/**
 * FILTER-MANAGER.JS - Filtre Yönetimi
 */

import { safeConsole } from '../core/logger.js';
import { getDataViewManager } from '../core/data-view-manager.js';

/**
 * Filtreleri doldur (mağaza, marka, kategori, vb.)
 * NOT: Kategori kaydırması var - category_2 -> Kategori 1, category_3 -> Kategori 2, category_4 -> Kategori 3
 */
export function populateFilters() {
    if (!window.allData || window.allData.length === 0) {
        safeConsole.warn('⚠️ Veri yok, filtreler doldurulamıyor');
        return;
    }
    
    const data = window.allData;
    const brands = new Set();
    const cat1 = new Set(); // category_2 verisi
    const cat2 = new Set(); // category_3 verisi
    const cat3 = new Set(); // category_4 verisi
    const salesPersons = new Set();
    const stores = new Set();
    const cities = new Set();
    const years = new Set();
    const months = new Set();
    const days = new Set();
    
    data.forEach(item => {
        if (item.brand) brands.add(item.brand);
        // Kategori kaydırması: category_2 -> Kategori 1, category_3 -> Kategori 2, category_4 -> Kategori 3
        if (item.category_2) cat1.add(item.category_2);
        if (item.category_3) cat2.add(item.category_3);
        if (item.category_4) cat3.add(item.category_4);
        if (item.sales_person) salesPersons.add(item.sales_person);
        if (item.store) stores.add(item.store);
        if (item.city) cities.add(item.city);
        
        // Tarih bilgilerini ayır
        if (item.date) {
            const dateParts = item.date.split('-');
            if (dateParts.length >= 3) {
                years.add(dateParts[0]); // YYYY
                months.add(dateParts[1]); // MM
                days.add(dateParts[2]); // DD
            }
        }
    });
    
    populateMultiSelect('filterBrand', Array.from(brands).sort(), 'countBrand');
    populateMultiSelect('filterCategory1', Array.from(cat1).sort(), 'countCategory1');
    populateMultiSelect('filterCategory2', Array.from(cat2).sort(), 'countCategory2');
    populateMultiSelect('filterCategory3', Array.from(cat3).sort(), 'countCategory3');
    populateMultiSelect('filterSalesPerson', Array.from(salesPersons).sort(), 'countSalesPerson');
    populateMultiSelect('filterStore', Array.from(stores).sort(), 'countStore');
    populateMultiSelect('filterCity', Array.from(cities).sort(), 'countCity');
    populateMultiSelect('filterYear', Array.from(years).sort().reverse(), 'countYear'); // En yeni önce
    populateMultiSelect('filterMonth', Array.from(months).sort(), 'countMonth');
    populateMultiSelect('filterDay', Array.from(days).sort(), 'countDay');
    
    safeConsole.log('✅ Filtreler dolduruldu');
}

/**
 * Multi-select dropdown'ı doldur
 */
export function populateMultiSelect(id, values, countId) {
    const container = document.getElementById(id);
    if (!container) {
        // Container yoksa sessizce atla (bazı sekmelerde filtreler olmayabilir)
        // safeConsole.warn(`⚠️ Container bulunamadı: ${id}`);
        return;
    }
    
    // Mevcut seçimleri koru
    const currentChecked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    
    // Mevcut içeriği temizle
    container.innerHTML = '';
    
    // Her değer için checkbox oluştur
    values.forEach(value => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = value;
        checkbox.id = `${id}_${value.replace(/\s+/g, '_')}`;
        checkbox.checked = currentChecked.includes(value);
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = value;
        
        // Checkbox değiştiğinde sayıyı güncelle
        checkbox.addEventListener('change', () => {
            updateSelectionCount(id, countId);
            if (typeof window.applyFilters === 'function') {
                window.applyFilters();
            }
        });
        
        item.appendChild(checkbox);
        item.appendChild(label);
        container.appendChild(item);
    });
    
    // İlk yüklemede sayıyı güncelle
    updateSelectionCount(id, countId);
}

/**
 * Seçim sayısını güncelle
 */
export function updateSelectionCount(containerId, countId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const count = container.querySelectorAll('input[type="checkbox"]:checked').length;
    const countSpan = document.getElementById(countId);
    if (countSpan) {
        if (count > 0) {
            countSpan.textContent = `(${count} seçili)`;
        } else {
            countSpan.textContent = '';
        }
    }
}

/**
 * Seçili değerleri al
 */
export function getSelectedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Checkbox'ları filtrele (arama kutusu için)
 */
export function filterCheckboxes(containerId, searchText) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const searchLower = searchText.toLowerCase().trim();
    const items = container.querySelectorAll('.checkbox-item');
    
    items.forEach(item => {
        const label = item.querySelector('label');
        if (!label) return;
        
        const text = label.textContent.toLowerCase();
        
        if (searchLower === '' || text.includes(searchLower)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
}

/**
 * Filtreleri uygula
 * NOT: Kategori kaydırması var - category_2 -> Kategori 1, category_3 -> Kategori 2, category_4 -> Kategori 3
 */
export function applyFilters() {
    if (!window.allData || window.allData.length === 0) {
        safeConsole.warn('⚠️ Veri yok, filtreler uygulanamıyor');
        return;
    }
    
    const brands = getSelectedValues('filterBrand');
    const cat1s = getSelectedValues('filterCategory1'); // category_2 verisi
    const cat2s = getSelectedValues('filterCategory2'); // category_3 verisi
    const cat3s = getSelectedValues('filterCategory3'); // category_4 verisi
    const salesPersons = getSelectedValues('filterSalesPerson');
    const stores = getSelectedValues('filterStore');
    const cities = getSelectedValues('filterCity');
    const years = getSelectedValues('filterYear');
    const months = getSelectedValues('filterMonth');
    const days = getSelectedValues('filterDay');
    
    safeConsole.log('🔍 Çoklu Filtreler:', {
        brands: brands.length,
        cat1s: cat1s.length,
        cat2s: cat2s.length,
        cat3s: cat3s.length,
        salesPersons: salesPersons.length,
        stores: stores.length,
        cities: cities.length,
        years: years.length,
        months: months.length,
        days: days.length
    });
    
    window.filteredData = window.allData.filter(item => {
        // İadeleri filtrele (görünür yapma - hesaplamalarda düşecek ama tablolarda gösterilmeyecek)
        if (item.move_type === 'out_refund' || item.is_refund) return false;
        
        // İndirim ürünlerini filtrele (görünür yapma - hesaplamalarda kullanılacak ama tablolarda gösterilmeyecek)
        if (typeof window.isDiscountProduct === 'function' && window.isDiscountProduct(item)) return false;
        
        // Marka filtresi (çoklu)
        if (brands.length > 0 && !brands.includes(item.brand)) return false;
        
        // Kategori filtreleri (çoklu) - KAYDIRILMIŞ
        if (cat1s.length > 0 && !cat1s.includes(item.category_2)) return false; // Kategori 1 = category_2
        if (cat2s.length > 0 && !cat2s.includes(item.category_3)) return false; // Kategori 2 = category_3
        if (cat3s.length > 0 && !cat3s.includes(item.category_4)) return false; // Kategori 3 = category_4
        
        // Satış temsilcisi filtresi (çoklu)
        if (salesPersons.length > 0 && !salesPersons.includes(item.sales_person)) return false;
        
        // Mağaza filtresi (çoklu) - KISMI EŞLEŞME
        if (stores.length > 0) {
            const itemStore = (item.store || '').toLowerCase();
            const matches = stores.some(store => itemStore.includes(store.toLowerCase()));
            if (!matches) return false;
        }
        
        // Şehir filtresi (çoklu)
        if (cities.length > 0 && !cities.includes(item.city)) return false;
        
        // Tarih filtreleri (çoklu)
        if (years.length > 0 || months.length > 0 || days.length > 0) {
            if (!item.date) return false;
            
            const dateParts = item.date.split('-');
            if (dateParts.length < 3) return false;
            
            if (years.length > 0 && !years.includes(dateParts[0])) return false;
            if (months.length > 0 && !months.includes(dateParts[1])) return false;
            if (days.length > 0 && !days.includes(dateParts[2])) return false;
        }
        
        return true;
    });
    
    safeConsole.log(`Filtreleme sonucu: ${window.filteredData.length} kayıt`);
    
    // Debug panel göster
    const debugPanel = document.getElementById('debugPanel');
    const debugInfo = document.getElementById('debugInfo');
    if (window.filteredData && window.filteredData.length > 0 && debugPanel && debugInfo) {
        // Toplam USD ve Miktar hesapla
        const totalUSD = window.filteredData.reduce((sum, item) => {
            if (typeof window.shouldHideItem === 'function' && window.shouldHideItem(item)) return sum;
            return sum + (parseFloat(item.usd_amount) || 0);
        }, 0);
        const totalQty = window.filteredData.reduce((sum, item) => {
            if (typeof window.shouldHideItem === 'function' && window.shouldHideItem(item)) return sum;
            return sum + (parseFloat(item.quantity) || 0);
        }, 0);
        
        // Benzersiz mağazaları say
        const uniqueStores = new Set(window.filteredData.map(item => item.store)).size;
        
        let debugText = `<strong>Toplam Kayıt:</strong> ${window.allData.length.toLocaleString('tr-TR')}<br>`;
        debugText += `<strong>Filtrelenmiş Kayıt:</strong> ${window.filteredData.length.toLocaleString('tr-TR')}<br>`;
        debugText += `<strong>Toplam USD:</strong> $${totalUSD.toLocaleString('tr-TR', {minimumFractionDigits: 2})}<br>`;
        debugText += `<strong>Toplam Miktar:</strong> ${totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}<br>`;
        debugText += `<strong>Benzersiz Mağaza:</strong> ${uniqueStores}<br><br>`;
        
        debugText += `<strong>Aktif Filtreler:</strong><br>`;
        if (stores.length > 0) debugText += `- Mağaza: ${stores.join(', ')}<br>`;
        if (years.length > 0) debugText += `- Yıl: ${years.join(', ')}<br>`;
        if (months.length > 0) debugText += `- Ay: ${months.join(', ')}<br>`;
        if (days.length > 0) debugText += `- Gün: ${days.join(', ')}<br>`;
        if (brands.length > 0) debugText += `- Marka: ${brands.join(', ')}<br>`;
        if (cat1s.length > 0) debugText += `- Kategori 1: ${cat1s.join(', ')}<br>`;
        
        debugInfo.innerHTML = debugText;
        debugPanel.style.display = 'block';
    }
    
    // Tabloyu ve özeti güncelle
    if (typeof window.updateSummary === 'function') {
        window.updateSummary();
    }
    if (typeof window.renderTable === 'function') {
        window.renderTable();
    }
}

/**
 * Filtreleri sıfırla
 */
export function resetFilters() {
    // Tüm checkbox'ları temizle
    const containers = [
        'filterBrand', 'filterCategory1', 'filterCategory2', 'filterCategory3', 'filterCategory4',
        'filterSalesPerson', 'filterStore', 'filterCity', 'filterYear', 'filterMonth', 'filterDay'
    ];
    
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
        }
    });
    
    // Seçim sayılarını güncelle
    const countIds = [
        'countBrand', 'countCategory1', 'countCategory2', 'countCategory3', 'countCategory4',
        'countSalesPerson', 'countStore', 'countCity', 'countYear', 'countMonth', 'countDay'
    ];
    
    countIds.forEach(countId => {
        const countSpan = document.getElementById(countId);
        if (countSpan) countSpan.textContent = '';
    });
    
    // Smart search input'unu temizle
    const smartSearchInput = document.getElementById('smartSearch');
    if (smartSearchInput) {
        smartSearchInput.value = '';
    }
    
    // Debug panel'leri gizle
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
        debugPanel.style.display = 'none';
    }
    const aiAnalysisPanel = document.getElementById('aiAnalysisPanel');
    if (aiAnalysisPanel) {
        aiAnalysisPanel.style.display = 'none';
    }
    
    // LAZY EVALUATION: DataViewManager kullan (gereksiz kopyaları önler)
    if (window.allData) {
        const dataViewManager = getDataViewManager();
        window.filteredData = dataViewManager.getFilteredData();
    }
    
    // Özeti ve tabloyu güncelle
    if (typeof window.updateSummary === 'function') {
        window.updateSummary();
    }
    if (typeof window.renderTable === 'function') {
        window.renderTable();
    }
    
    safeConsole.log('✅ Filtreler sıfırlandı');
}

/**
 * Kanal filtreleme fonksiyonları
 */

// Global kanal filtresi state'i (index.html'de tanımlı olabilir)
if (typeof window.activeChannels === 'undefined') {
    window.activeChannels = {all: true, retail: false, wholesale: false, online: false, corporate: false, central: false};
}

/**
 * Kanal filtresi handler
 */
export function handleChannelFilter(clickedId) {
    const safeConsole = window.safeConsole || console;
    safeConsole.log('🔄 handleChannelFilter çağrıldı, tıklanan:', clickedId);
    safeConsole.log('📊 baseData boyutu:', (window.baseData || []).length);
    safeConsole.log('📊 allData boyutu:', (window.allData || []).length);
    
    const channelAll = document.getElementById('channelAll')?.checked || false;
    const channelRetail = document.getElementById('channelRetail')?.checked || false;
    const channelWholesale = document.getElementById('channelWholesale')?.checked || false;
    const channelOnline = document.getElementById('channelOnline')?.checked || false;
    const channelCorporate = document.getElementById('channelCorporate')?.checked || false;
    const channelCentral = document.getElementById('channelCentral')?.checked || false;
    
    safeConsole.log('✅ Checkbox durumları:', {channelAll, channelRetail, channelWholesale, channelOnline, channelCorporate, channelCentral});
    
    // Eğer Tümü tıklandıysa, diğerlerini kapat
    if (clickedId === 'channelAll' && channelAll) {
        const retailEl = document.getElementById('channelRetail');
        const wholesaleEl = document.getElementById('channelWholesale');
        const onlineEl = document.getElementById('channelOnline');
        const corporateEl = document.getElementById('channelCorporate');
        const centralEl = document.getElementById('channelCentral');
        if (retailEl) retailEl.checked = false;
        if (wholesaleEl) wholesaleEl.checked = false;
        if (onlineEl) onlineEl.checked = false;
        if (corporateEl) corporateEl.checked = false;
        if (centralEl) centralEl.checked = false;
        window.activeChannels = {all: true, retail: false, wholesale: false, online: false, corporate: false, central: false};
    }
    // Eğer diğer bir kanal tıklandıysa, Tümü'yü kapat
    else if (clickedId !== 'channelAll' && (channelRetail || channelWholesale || channelOnline || channelCorporate || channelCentral)) {
        const allEl = document.getElementById('channelAll');
        if (allEl) allEl.checked = false;
        window.activeChannels = {
            all: false,
            retail: channelRetail,
            wholesale: channelWholesale,
            online: channelOnline,
            corporate: channelCorporate,
            central: channelCentral
        };
    }
    // Hiçbiri seçili değilse Tümü'yü aktif et
    else if (!channelAll && !channelRetail && !channelWholesale && !channelOnline && !channelCorporate && !channelCentral) {
        const allEl = document.getElementById('channelAll');
        if (allEl) allEl.checked = true;
        window.activeChannels = {all: true, retail: false, wholesale: false, online: false, corporate: false, central: false};
    }
    // Sadece Tümü kapatıldıysa hiçbir şey yapma (diğerleri zaten kapalı)
    else if (clickedId === 'channelAll' && !channelAll) {
        const allEl = document.getElementById('channelAll');
        if (allEl) allEl.checked = true;
        window.activeChannels = {all: true, retail: false, wholesale: false, online: false, corporate: false, central: false};
    }
    
    // Veriyi filtrele
    applyChannelFilter();
}

/**
 * Kanal filtresini uygula
 */
export function applyChannelFilter() {
    const safeConsole = window.safeConsole || console;
    safeConsole.log('🏢 applyChannelFilter başladı');
    safeConsole.log('📊 activeChannels:', window.activeChannels);
    safeConsole.log('📊 baseData uzunluk:', (window.baseData || []).length);
    
    // Spinner'ı göster
    const spinner = document.getElementById('channelLoadingSpinner');
    const loadingText = document.getElementById('channelLoadingText');
    if (spinner) spinner.style.display = 'flex';
    
    // Hangi kanal seçiliyse onu göster
    const channelNames = {
        retail: '🏪 Perakende',
        wholesale: '📦 Toptan Satış',
        online: '🌐 Online Satış',
        corporate: '🏢 Kurumsal Satış',
        central: '🏛️ Merkezi Satış'
    };
    
    let activeChannelName = 'Tüm Kanallar';
    if (!window.activeChannels.all) {
        const active = Object.keys(window.activeChannels).filter(key => window.activeChannels[key] && key !== 'all');
        activeChannelName = active.map(key => channelNames[key]).join(' + ');
    }
    
    if (loadingText) {
        loadingText.textContent = `🔄 ${activeChannelName} verileri yükleniyor...`;
    }
    
    // Filtrelemeyi setTimeout ile geciktir - UI'ın güncellenmesi için
    setTimeout(() => {
        // LAZY EVALUATION: DataViewManager'dan baseData'yı al
        const dataViewManager = getDataViewManager();
        const baseData = dataViewManager.getBaseData();
        
        // Tümü seçiliyse tüm veriyi kullan
        if (window.activeChannels.all) {
            // baseData zaten bir kopya, direkt kullan
            window.allData = baseData.slice();
            safeConsole.log('✅ Tümü seçili, allData uzunluk:', window.allData.length);
            const infoEl = document.getElementById('channelFilterInfo');
            if (infoEl) infoEl.textContent = '📊 Aktif: Tüm Kanallar (19)';
        } else {
            // Seçili kanallara göre filtrele
            const selectedChannels = [];
            let allData = [];
            
            if (window.activeChannels.retail) {
                // 14 perakende mağaza
                allData = baseData.filter(item => 
                    item.store && item.store.toLowerCase().includes('perakende')
                );
                selectedChannels.push('Perakende');
            }
            
            if (window.activeChannels.wholesale) {
                const wholesaleData = baseData.filter(item => 
                    item.store && item.store.toLowerCase().includes('toptan')
                );
                // STACK OVERFLOW ÖNLEME: Büyük array'lerde spread yerine loop ile ekle
                if (window.activeChannels.retail) {
                    for (let i = 0; i < wholesaleData.length; i++) {
                        allData.push(wholesaleData[i]);
                    }
                } else {
                    allData = wholesaleData.slice();
                }
                selectedChannels.push('Toptan');
            }
            
            if (window.activeChannels.online) {
                const onlineData = baseData.filter(item => 
                    item.store && item.store.toLowerCase().includes('online')
                );
                // STACK OVERFLOW ÖNLEME: Büyük array'lerde spread yerine loop ile ekle
                if (window.activeChannels.retail || window.activeChannels.wholesale) {
                    for (let i = 0; i < onlineData.length; i++) {
                        allData.push(onlineData[i]);
                    }
                } else {
                    allData = onlineData.slice();
                }
                selectedChannels.push('Online');
            }
            
            if (window.activeChannels.corporate) {
                const corporateData = baseData.filter(item => 
                    item.store && item.store.toLowerCase().includes('kurumsal')
                );
                // STACK OVERFLOW ÖNLEME: Büyük array'lerde spread yerine loop ile ekle
                if (window.activeChannels.retail || window.activeChannels.wholesale || window.activeChannels.online) {
                    for (let i = 0; i < corporateData.length; i++) {
                        allData.push(corporateData[i]);
                    }
                } else {
                    allData = corporateData.slice();
                }
                selectedChannels.push('Kurumsal');
            }
            
            if (window.activeChannels.central) {
                const centralData = baseData.filter(item => 
                    item.store && item.store.toLowerCase().includes('merkezi')
                );
                // STACK OVERFLOW ÖNLEME: Büyük array'lerde spread yerine loop ile ekle
                if (window.activeChannels.retail || window.activeChannels.wholesale || window.activeChannels.online || window.activeChannels.corporate) {
                    for (let i = 0; i < centralData.length; i++) {
                        allData.push(centralData[i]);
                    }
                } else {
                    allData = centralData.slice();
                }
                selectedChannels.push('Merkezi');
            }
            
            window.allData = allData;
            const infoEl = document.getElementById('channelFilterInfo');
            if (infoEl) {
                infoEl.textContent = `📊 Aktif: ${selectedChannels.join(' + ')} (${allData.length.toLocaleString('tr-TR')} kayıt)`;
            }
        }
        
        // LAZY EVALUATION: allData değişti, cache'i temizle ve filteredData'yı güncelle
        dataViewManager.invalidateCache(); // allData değişti, cache'i temizle
        window.filteredData = dataViewManager.getFilteredData();
        
        // TÜM SAYFA YENİDEN HESAPLANIYOR!
        updateAfterChannelFilter();
    }, 100); // 100ms gecikme - UI'ın spinner'ı göstermesi için
}

/**
 * Kanal filtresi sonrası güncellemeler
 */
export function updateAfterChannelFilter() {
    const allData = window.allData || [];
    const shouldHideItem = window.shouldHideItem || (() => false);
    
    // Info kartlarını güncelle
    const totalRecordsEl = document.getElementById('totalRecords');
    if (totalRecordsEl) {
        totalRecordsEl.textContent = allData.length.toLocaleString('tr-TR');
    }
    
    const totalUSD = allData.reduce((sum, item) => {
        if (shouldHideItem(item)) return sum;
        return sum + (parseFloat(item.usd_amount) || 0);
    }, 0);
    const totalUSDEl = document.getElementById('totalUSD');
    if (totalUSDEl) {
        totalUSDEl.textContent = '$' + totalUSD.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
    
    // Günlük Ortalama Hesapla
    const uniqueDates = [...new Set(allData.map(item => item.date))];
    const dailyAverage = uniqueDates.length > 0 ? totalUSD / uniqueDates.length : 0;
    const dailyAverageEl = document.getElementById('dailyAverage');
    if (dailyAverageEl) {
        dailyAverageEl.textContent = '$' + dailyAverage.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
    
    // Sepet Ortalaması Hesapla (Toplam USD / Satış Fatura Sayısı - İadeler Hariç)
    const invoiceKeys = allData
        .filter(item => {
            const amt = parseFloat(item.usd_amount || 0);
            if (item.move_type) return item.move_type === 'out_invoice';
            return amt > 0;
        })
        .map(item => item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}-${item.product || ''}`)
        .filter(Boolean);
    const uniqueInvoices = new Set(invoiceKeys).size;
    const basketAverage = uniqueInvoices > 0 ? totalUSD / uniqueInvoices : 0;
    const basketAverageEl = document.getElementById('basketAverage');
    if (basketAverageEl) {
        basketAverageEl.textContent = '$' + basketAverage.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
    
    // Filtreleri yeniden doldur
    if (typeof window.populateFilters === 'function') {
        window.populateFilters();
    }
    if (typeof window.updateSummary === 'function') {
        window.updateSummary();
    }
    
    // Dashboard'ı yenile
    if (typeof window.loadDashboard === 'function') {
        window.loadDashboard();
    }
    
    // Müşteri analizini yenile
    if (typeof window.analyzeCustomers === 'function') {
        window.analyzeCustomers();
    }
    
    // Hedef takibini yenile
    if (typeof window.loadAllStoresTargets === 'function') {
        window.loadAllStoresTargets();
    }
    
    // Şehir analizini yenile
    if (typeof window.analyzeCityPerformance === 'function') {
        window.analyzeCityPerformance();
    }
    
    // Yıllık hedef analizini yenile
    if (typeof window.performYearlyTargetAnalysis === 'function') {
        window.performYearlyTargetAnalysis();
    }
    
    // Zaman analizini yenile (eğer zaman analizi sekmesi aktifse)
    const timeTab = document.getElementById('timeTab');
    if (timeTab && timeTab.classList.contains('active')) {
        if (typeof window.analyzeTime === 'function') {
            window.analyzeTime();
        }
    }
    
    // Stok analizini yenile (eğer stok sekmesi aktifse)
    const stockTab = document.getElementById('stockTab');
    if (stockTab && stockTab.classList.contains('active')) {
        if (typeof window.analyzeStockDistribution === 'function') {
            window.analyzeStockDistribution();
        }
    }
    
    // Satış temsilcisi listesini yenile (eğer satış temsilcisi sekmesi aktifse)
    const salespersonTab = document.getElementById('salespersonTab');
    if (salespersonTab && salespersonTab.classList.contains('active')) {
        if (typeof window.renderSalespersonListTable === 'function') {
            window.renderSalespersonListTable();
        }
        // Eğer bir satış temsilcisi araması yapılmışsa, sonuçları da güncelle
        const salespersonProfileContainer = document.getElementById('salespersonProfileContainer');
        if (salespersonProfileContainer && salespersonProfileContainer.style.display !== 'none') {
            const searchInput = document.getElementById('salespersonSearchInput');
            if (searchInput && searchInput.value.trim()) {
                if (typeof window.searchSalespersonProfile === 'function') {
                    window.searchSalespersonProfile();
                }
            }
        }
    }
    
    // Ürün analizi sonuçlarını yenile (eğer ürün sekmesi aktifse ve bir arama yapılmışsa)
    const productTab = document.getElementById('productTab');
    if (productTab && productTab.classList.contains('active')) {
        const productResults = document.getElementById('productResultsContainer');
        if (productResults && productResults.style.display !== 'none') {
            const searchInput = document.getElementById('productSearchInput');
            if (searchInput && searchInput.value.trim()) {
                if (typeof window.searchProduct === 'function') {
                    window.searchProduct();
                }
            }
        }
    }
    
    // Mağaza analizi sonuçlarını yenile (eğer mağaza sekmesi aktifse ve bir mağaza seçilmişse)
    const storeTab = document.getElementById('storeTab');
    if (storeTab && storeTab.classList.contains('active')) {
        const storeProfile = document.getElementById('storeProfileContainer');
        if (storeProfile && storeProfile.style.display !== 'none') {
            const storeSearchInput = document.getElementById('storeSearchInput');
            if (storeSearchInput && storeSearchInput.value.trim()) {
                if (typeof window.searchStoreProfile === 'function') {
                    window.searchStoreProfile();
                }
            }
        }
    }
    
    // Ödeme analizi sonuçlarını yenile (eğer ödeme sekmesi aktifse)
    const paymentsTab = document.getElementById('paymentsTab');
    if (paymentsTab && paymentsTab.classList.contains('active')) {
        if (typeof window.analyzePayments === 'function') {
            window.analyzePayments();
        }
    }
    
    // Spinner'ı gizle
    setTimeout(() => {
        const spinner = document.getElementById('channelLoadingSpinner');
        if (spinner) spinner.style.display = 'none';
    }, 500); // Tüm işlemler bittikten 500ms sonra kapat
}

// Global erişim için
window.populateFilters = populateFilters;
window.populateMultiSelect = populateMultiSelect;
window.updateSelectionCount = updateSelectionCount;
window.getSelectedValues = getSelectedValues;
window.filterCheckboxes = filterCheckboxes;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.handleChannelFilter = handleChannelFilter;
window.applyChannelFilter = applyChannelFilter;
window.updateAfterChannelFilter = updateAfterChannelFilter;

