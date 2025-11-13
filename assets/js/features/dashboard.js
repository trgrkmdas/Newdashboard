/**
 * DASHBOARD.JS - Dashboard Yönetimi
 */

import { safeConsole } from '../core/logger.js';
import { loadYearData } from '../data/data-loader.js';
import { applyDiscountLogic, isDiscountProduct } from '../data/data-processor.js';
import { getDataViewManager } from '../core/data-view-manager.js';
import { getWorkerManager } from '../core/worker-manager.js';
import { getProgressiveLoader } from '../core/progressive-loader.js';

/**
 * Tüm yılların verilerini yükle
 */
export async function loadAllYearsData(metadata) {
    if (!metadata || !metadata.years || metadata.years.length === 0) {
        safeConsole.warn('⚠️ Metadata yok veya yıllar bulunamadı');
        return;
    }
    
    try {
        safeConsole.log(`📅 Yıllar yükleniyor: ${metadata.years.join(', ')}`);
        
        // Yıl toggle'larını initialize et
        if (typeof window.initializeYearToggles === 'function') {
            window.initializeYearToggles(metadata.years);
            // initializeYearToggles async değil ama DOM işlemleri olabilir, kısa bir bekleme
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // SADECE SEÇİLİ YILLARI yükle (initializeYearToggles varsayılan olarak son yılı seçiyor)
        const selectedYears = window.selectedYears || new Set();
        const yearsToLoad = Array.from(selectedYears); // Sadece seçili yıllar
        
        if (yearsToLoad.length === 0) {
            safeConsole.warn('⚠️ Hiçbir yıl seçili değil! initializeYearToggles çalıştı mı kontrol ediliyor...');
            safeConsole.log(`📦 window.selectedYears:`, window.selectedYears);
            safeConsole.log(`📦 metadata.years:`, metadata.years);
            // Eğer hiç yıl seçili değilse, en son yılı otomatik seç
            if (metadata.years && metadata.years.length > 0) {
                const latestYear = metadata.years.sort((a, b) => parseInt(b) - parseInt(a))[0].toString();
                safeConsole.log(`🔄 Otomatik olarak en son yıl seçiliyor: ${latestYear}`);
                if (typeof window.initializeYearToggles === 'function') {
                    window.initializeYearToggles(metadata.years);
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                // Tekrar kontrol et
                const retrySelectedYears = window.selectedYears || new Set();
                const retryYearsToLoad = Array.from(retrySelectedYears);
                if (retryYearsToLoad.length === 0) {
                    safeConsole.error('❌ initializeYearToggles çalıştı ama selectedYears hala boş!');
                    if (typeof window.updateDataStatus === 'function') {
                        window.updateDataStatus();
                    }
                    return;
                }
                // Retry başarılı, yearsToLoad'ı güncelle
                yearsToLoad.length = 0;
                yearsToLoad.push(...retryYearsToLoad);
            } else {
                if (typeof window.updateDataStatus === 'function') {
                    window.updateDataStatus();
                }
                return;
            }
        }
        
        safeConsole.log(`📦 Seçili yıllar yükleniyor: ${yearsToLoad.join(', ')}`);
        
        // Seçili yılları paralel olarak yükle
        // Metadata güncellenmişse, verileri yeniden yükle
        const forceReload = metadata?.needsReload || false;
        const yearPromises = yearsToLoad.map(year => loadYearData(year, forceReload));
        const yearResults = await Promise.all(yearPromises);
        
        // Tüm verileri birleştir
        let allRawData = [];
        let totalRecords = 0;
        
        for (let i = 0; i < yearsToLoad.length; i++) {
            const year = yearsToLoad[i];
            const yearData = yearResults[i];
            
            if (yearData?.details && yearData.details.length > 0) {
                safeConsole.log(`✅ ${year} yılı yüklendi: ${yearData.details.length} kayıt`);
                allRawData = allRawData.concat(yearData.details);
                totalRecords += yearData.details.length;
            } else {
                safeConsole.warn(`⚠️ ${year} yılında veri bulunamadı`);
            }
        }
        
        safeConsole.log(`📊 Toplam yüklenen kayıt: ${totalRecords}`);
        
        if (allRawData.length === 0) {
            console.error('❌ Hiçbir yılda veri bulunamadı!');
            return;
        }
        
        // Tüm verileri işle (chunk processing ile - performans optimizasyonu)
        // NOT: Progress indicator loadYearData içinde yönetiliyor, burada göstermiyoruz
        const chunkSize = 3000; // Chunk size (veri işleme optimizasyonu)
        const workerThreshold = 5000; // Worker kullanımı için eşik (büyük veri setleri)
        const progressiveThreshold = 10000; // Progressive loading için eşik (çok büyük veri setleri)
        let processedData = [];
        
        // Çok büyük veri setlerinde Progressive Loading kullan
        if (allRawData.length > progressiveThreshold) {
            safeConsole.log(`📊 Çok büyük veri seti (${allRawData.length} kayıt), Progressive Loading kullanılıyor...`);
            const progressiveLoader = getProgressiveLoader();
            const workerManager = getWorkerManager();
            
            // Processor fonksiyonu - Worker veya main thread kullan
            const processor = async (chunk) => {
                if (workerManager && workerManager.isAvailable()) {
                    try {
                        return await workerManager.processDataChunk(chunk);
                    } catch (workerError) {
                        safeConsole.warn(`⚠️ Worker hatası, fallback kullanılıyor:`, workerError);
                        return chunk.map(item => applyDiscountLogic(item));
                    }
                } else {
                    return chunk.map(item => applyDiscountLogic(item));
                }
            };
            
            // Progressive loading ile işle
            processedData = await progressiveLoader.processProgressive(
                allRawData,
                processor,
                chunkSize,
                (progress, message) => {
                    safeConsole.log(`📊 ${message} (%${Math.round(progress * 100)})`);
                }
            );
        }
        // Büyük veri setlerinde Worker kullan, küçüklerde main thread
        else if (allRawData.length > workerThreshold) {
            safeConsole.log(`📊 Büyük veri seti (${allRawData.length} kayıt), Worker ile işleniyor...`);
            const workerManager = getWorkerManager();
            const chunks = [];
            for (let i = 0; i < allRawData.length; i += chunkSize) {
                chunks.push(allRawData.slice(i, i + chunkSize));
            }
            
            // Chunk'ları Worker'da işle (paralel)
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                let processedChunk;
                
                // Worker kullanılabilir mi kontrol et
                if (workerManager && workerManager.isAvailable()) {
                    try {
                        processedChunk = await workerManager.processDataChunk(chunk, (progress, message) => {
                            if (chunks.length > 5 && i % 5 === 0) {
                                safeConsole.log(`📊 Worker ile işleniyor: %${Math.round(progress * 100)}`);
                            }
                        });
                    } catch (workerError) {
                        safeConsole.warn(`⚠️ Worker hatası, fallback kullanılıyor:`, workerError);
                        // Fallback: main thread'de işle
                        processedChunk = chunk.map(item => applyDiscountLogic(item));
                    }
                } else {
                    // Worker kullanılamıyor, main thread'de işle
                    processedChunk = chunk.map(item => applyDiscountLogic(item));
                }
                
                // STACK OVERFLOW ÖNLEME: Spread yerine loop ile ekle
                for (let j = 0; j < processedChunk.length; j++) {
                    processedData.push(processedChunk[j]);
                }
                
                // Progress göstergesi (büyük veriler için)
                if (chunks.length > 5 && i % 5 === 0) {
                    const progress = Math.round((i / chunks.length) * 100);
                    safeConsole.log(`📊 Veri işleniyor: %${progress}`);
                }
            }
        } else if (allRawData.length > chunkSize) {
            // Orta büyüklükte veri setleri - chunk processing (main thread)
            safeConsole.log(`📊 Orta büyüklükte veri seti (${allRawData.length} kayıt), chunk processing kullanılıyor...`);
            const chunks = [];
            for (let i = 0; i < allRawData.length; i += chunkSize) {
                chunks.push(allRawData.slice(i, i + chunkSize));
            }
            
            // Chunk'ları sırayla işle (non-blocking)
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const processedChunk = chunk.map(item => applyDiscountLogic(item));
                // STACK OVERFLOW ÖNLEME: Spread yerine loop ile ekle
                for (let j = 0; j < processedChunk.length; j++) {
                    processedData.push(processedChunk[j]);
                }
                
                // Progress göstergesi (büyük veriler için)
                if (chunks.length > 5 && i % 5 === 0) {
                    const progress = Math.round((i / chunks.length) * 100);
                    safeConsole.log(`📊 Veri işleniyor: %${progress}`);
                }
            }
        } else {
            // Küçük veri setlerinde direkt işle
            processedData = allRawData.map(item => applyDiscountLogic(item));
        }
        
        window.allData = processedData;
        // LAZY EVALUATION: DataViewManager kullan (gereksiz kopyaları önler)
        const dataViewManager = getDataViewManager();
        dataViewManager.invalidateCache(); // allData değişti, cache'i temizle
        window.baseData = dataViewManager.getBaseData();
        const discountProducts = window.allData.filter(item => isDiscountProduct(item));
        window.filteredData = dataViewManager.getFilteredData();
        
        safeConsole.log(`💰 ${discountProducts.length} indirim ürünü negatif değer olarak işlendi (toplam kayıt: ${allRawData.length})`);
        
        // NOT: Progress indicator loadYearData içinde yönetiliyor ve kapatılıyor
        // Burada ekstra bir işlem yapmıyoruz
        
        // Update info cards
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = metadata.last_update || '-';
        }
        
        // Toplam kayıt sayısını güncelle
        const totalRecordsEl = document.getElementById('totalRecords');
        if (totalRecordsEl && window.allData) {
            totalRecordsEl.textContent = window.allData.length.toLocaleString('tr-TR');
        }
        
        if (typeof window.updateDataStatus === 'function') {
            window.updateDataStatus(); // Badge'i ve bilgileri güncelle
        }
        
        if (typeof window.populateFilters === 'function') {
            window.populateFilters();
        }
        if (typeof window.updateSummary === 'function') {
            window.updateSummary();
        }
        if (typeof window.renderTable === 'function') {
            window.renderTable();
        }
        
        // Satış temsilcisi ve mağaza yıl filtrelerini doldur
        if (typeof window.populateSalespersonYearFilter === 'function') {
            window.populateSalespersonYearFilter();
        }
        if (typeof window.populateSalespersonMonthFilter === 'function') {
            window.populateSalespersonMonthFilter();
        }
        if (typeof window.populateSalespersonDayFilter === 'function') {
            window.populateSalespersonDayFilter();
        }
        if (typeof window.populateStoreYearFilter === 'function') {
            window.populateStoreYearFilter();
        }
        if (typeof window.populateStoreMonthFilter === 'function') {
            window.populateStoreMonthFilter();
        }
        if (typeof window.populateStoreDayFilter === 'function') {
            window.populateStoreDayFilter();
        }
        
        // Günlük satış filtrelerini doldur (veri yüklendikten sonra)
        if (typeof window.populateDailySalesStoreFilter === 'function') {
            window.populateDailySalesStoreFilter();
        }
        if (typeof window.populateDailySalesDateFilters === 'function') {
            window.populateDailySalesDateFilters();
        }
        
        // Ürün filtrelerini initialize et
        if (typeof window.initializeProductFilters === 'function') {
            window.initializeProductFilters();
        }
        
        // Dashboard'ı yükle - veri tamamen yüklendikten sonra
        safeConsole.log('📊 İlk veri yükleme tamamlandı, dashboard yükleniyor...');
        setTimeout(() => {
            if (window.allData && window.allData.length > 0) {
                if (typeof window.loadDashboard === 'function') {
                    window.loadDashboard();
                }
                safeConsole.log('✅ Dashboard yüklendi');
            } else {
                safeConsole.warn('⚠️ Dashboard yüklenemedi - veri yok');
            }
        }, 500);
        
        // Loading progress'i tamamla (ilk yükleme bitti)
        if (typeof window.dataLoadProgress !== 'undefined') {
            window.dataLoadProgress.ready = true;
            checkLoadingComplete();
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        const dataStatusEl = document.getElementById('dataStatus');
        if (dataStatusEl) {
            dataStatusEl.innerHTML = '<span class="status-badge status-error">❌ Hata</span>';
        }
        // tableContainer null check
        const tableContainerError = document.getElementById('tableContainer');
        if (tableContainerError) {
            tableContainerError.innerHTML = '<div class="error">❌ Veri yüklenirken hata oluştu!<br><small>' + error.message + '</small></div>';
        }
    }
}

/**
 * Loading tamamlanma kontrolü
 */
export function checkLoadingComplete() {
    if (typeof window.dataLoadProgress === 'undefined') {
        return;
    }
    
    let progress = 0;
    if (window.dataLoadProgress.pageInit) progress += 25;
    if (window.dataLoadProgress.dataFiles) progress += 50;
    if (window.dataLoadProgress.targets) progress += 20;
    if (window.dataLoadProgress.ready) progress += 5;
    
    // Progress'i güncelle
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (progressBar) {
        progressBar.style.width = progress + '%';
    }
    if (progressText) {
        progressText.textContent = Math.round(progress) + '%';
    }
    
    // Step'leri güncelle
    if (window.dataLoadProgress.pageInit) {
        const step1 = document.getElementById('step1');
        if (step1) {
            step1.style.display = 'block';
            step1.style.opacity = '1';
            step1.style.color = '#4ade80';
        }
    }
    
    if (window.dataLoadProgress.dataFiles) {
        const step2 = document.getElementById('step2');
        if (step2) {
            step2.style.display = 'block';
            step2.style.opacity = '1';
            step2.style.color = '#4ade80';
        }
    }
    
    if (window.dataLoadProgress.targets) {
        const step3 = document.getElementById('step3');
        if (step3) {
            step3.style.display = 'block';
            step3.style.opacity = '1';
            step3.style.color = '#4ade80';
        }
    }
    
    if (window.dataLoadProgress.ready) {
        const step4 = document.getElementById('step4');
        if (step4) {
            step4.style.display = 'block';
            step4.style.opacity = '1';
            step4.style.color = '#4ade80';
        }
        
        // %100'e ulaştıysak loading'i gizle
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            const mainContainer = document.getElementById('mainContainer');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    if (mainContainer) {
                        mainContainer.style.display = 'block';
                    }
                }, 500);
            }
        }, 500);
    }
}

/**
 * Tab değiştirme
 */
export async function switchTab(tabName) {
    safeConsole.log('🔄 switchTab çağrıldı:', tabName);
    
    // Tüm tab içeriklerini gizle
    const allTabContents = document.querySelectorAll('.tab-content');
    allTabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Tüm tab butonlarını pasif yap
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Seçilen tab'ı aktif et
    const selectedTab = document.getElementById(tabName + 'Tab');
    safeConsole.log('🔍 Aranan tab ID:', tabName + 'Tab', '| Bulundu mu?', selectedTab ? 'EVET' : 'HAYIR');
    if (selectedTab) {
        selectedTab.classList.add('active');
        safeConsole.log('✅ Tab aktif edildi:', tabName + 'Tab');
    } else {
        console.error('❌ Tab bulunamadı:', tabName + 'Tab');
    }
    
    // İlgili tab butonunu aktif et
    const tabButtons = {
        'dashboard': 0,
        'dailySales': 1,
        'targets': 2,
        'customers': 3,
        'salesperson': 4,
        'store': 5,
        'city': 6,
        'stock': 7,
        'time': 8,
        'product': 9,
        'inventory': 10,
        'payments': 11
    };
    if (tabButtons[tabName] !== undefined && allTabs[tabButtons[tabName]]) {
        allTabs[tabButtons[tabName]].classList.add('active');
    }
    
    // Tab'a göre özel işlemler
    if (tabName === 'dashboard') {
        if (typeof window.loadDashboard === 'function') {
            window.loadDashboard();
        }
    } else if (tabName === 'targets') {
        if (typeof window.loadAllStoresTargets === 'function') {
            window.loadAllStoresTargets(); // Yeni hedef takip sistemi
        }
    } else if (tabName === 'customers') {
        // Ödeme verilerini yükle (müşteri ödeme bilgileri için gerekli)
        if (!window.paymentData || !window.paymentData.transactions || window.paymentData.transactions.length === 0) {
            safeConsole.log('🔄 Ödeme verileri yükleniyor (müşteri ödeme bilgileri için)...');
            if (typeof window.loadPaymentData === 'function') {
                await window.loadPaymentData();
            }
        }
        if (typeof window.analyzeCustomers === 'function') {
            window.analyzeCustomers();
        }
    } else if (tabName === 'time') {
        if (typeof window.analyzeTime === 'function') {
            window.analyzeTime();
        }
    } else if (tabName === 'salesperson') {
        safeConsole.log('👨‍💼 Satış temsilcisi analizi sekmesi açılıyor...');
        // Multi-select filtreleri initialize et
        setTimeout(() => {
            if (typeof window.populateSalespersonYearFilter === 'function') {
                window.populateSalespersonYearFilter();
            }
            if (typeof window.populateSalespersonMonthFilter === 'function') {
                window.populateSalespersonMonthFilter();
            }
            if (typeof window.populateSalespersonDayFilter === 'function') {
                window.populateSalespersonDayFilter();
            }
        }, 100);
        
        // Arama durumunu kontrol et
        const searchInput = document.getElementById('salespersonSearchInput');
        const selectedSalespersons = window.selectedSalespersons || [];
        const hasSearchQuery = searchInput && searchInput.value.trim() !== '';
        const hasSelectedSalespersons = selectedSalespersons && selectedSalespersons.length > 0;
        const profileContainer = document.getElementById('salespersonProfileContainer');
        const hasSearchResults = profileContainer && profileContainer.style.display !== 'none';
        
        if (!hasSearchQuery && !hasSelectedSalespersons && !hasSearchResults) {
            // Arama yoksa: default listeyi göster, arama sonuçlarını gizle
            if (profileContainer) profileContainer.style.display = 'none';
            const defaultSection = document.getElementById('salespersonListSectionDefault');
            const bottomSection = document.getElementById('salespersonListSectionBottom');
            if (defaultSection) defaultSection.style.display = 'block';
            if (bottomSection) bottomSection.style.display = 'none';
            
            // Otomatik olarak ilk 50 satış temsilcisini göster
            if (window.allData && window.allData.length > 0) {
                if (typeof window.renderSalespersonListTable === 'function') {
                    window.renderSalespersonListTable();
                }
            } else {
                safeConsole.warn('⚠️ Veri henüz yüklenmedi, satış temsilcisi listesi gösterilemiyor.');
            }
        } else {
            // Arama varsa: arama sonuçlarını göster, listeyi en alta taşı
            const defaultSection = document.getElementById('salespersonListSectionDefault');
            const bottomSection = document.getElementById('salespersonListSectionBottom');
            if (defaultSection) defaultSection.style.display = 'none';
            if (bottomSection) bottomSection.style.display = 'block';
            if (window.allData && window.allData.length > 0) {
                if (typeof window.renderSalespersonListTable === 'function') {
                    window.renderSalespersonListTable();
                }
            }
        }
    } else if (tabName === 'store') {
        safeConsole.log('🏪 Mağaza analizi sekmesi açılıyor...');
        // Multi-select filtreleri initialize et
        setTimeout(() => {
            if (typeof window.populateStoreYearFilter === 'function') {
                window.populateStoreYearFilter();
            }
            if (typeof window.populateStoreMonthFilter === 'function') {
                window.populateStoreMonthFilter();
            }
            if (typeof window.populateStoreDayFilter === 'function') {
                window.populateStoreDayFilter();
            }
        }, 100);
        
        if (typeof window.analyzeStores === 'function') {
            window.analyzeStores();
        }
    } else if (tabName === 'inventory') {
        if (typeof window.renderInventoryCharts === 'function') {
            window.renderInventoryCharts();
        }
        if (typeof window.renderInventoryTable === 'function') {
            window.renderInventoryTable();
        }
    }
}

// Global erişim için
window.loadAllYearsData = loadAllYearsData;
window.checkLoadingComplete = checkLoadingComplete;
window.switchTab = switchTab;

