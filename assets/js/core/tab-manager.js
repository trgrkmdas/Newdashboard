/**
 * TAB-MANAGER.JS - Tab Yönetimi ve Navigasyon
 */

import { safeConsole } from './logger.js';

/**
 * Tab butonlarının sırası ve indeksleri
 */
const TAB_BUTTONS = {
    'dashboard': 0,
    'targets': 1,
    'customers': 2,
    'salesperson': 3,
    'store': 4,
    'city': 5,
    'stock': 6,
    'time': 7,
    'product': 8,
    'inventory': 9,
    'payments': 10,
    'dailySales': 11
};

/**
 * Tüm tab içeriklerini gizle
 */
function hideAllTabContents() {
    const allTabContents = document.querySelectorAll('.tab-content');
    allTabContents.forEach(tab => {
        tab.classList.remove('active');
    });
}

/**
 * Tüm tab butonlarını pasif yap
 */
function deactivateAllTabButtons() {
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(tab => {
        tab.classList.remove('active');
    });
}

/**
 * Belirli bir tab'ı aktif et
 */
function activateTab(tabName) {
    const selectedTab = document.getElementById(tabName + 'Tab');
    safeConsole.log('🔍 Aranan tab ID:', tabName + 'Tab', '| Bulundu mu?', selectedTab ? 'EVET' : 'HAYIR');
    if (selectedTab) {
        selectedTab.classList.add('active');
        safeConsole.log('✅ Tab aktif edildi:', tabName + 'Tab');
    } else {
        console.error('❌ Tab bulunamadı:', tabName + 'Tab');
    }
}

/**
 * Belirli bir tab butonunu aktif et
 */
function activateTabButton(tabName) {
    const allTabs = document.querySelectorAll('.tab');
    if (TAB_BUTTONS[tabName] !== undefined && allTabs[TAB_BUTTONS[tabName]]) {
        allTabs[TAB_BUTTONS[tabName]].classList.add('active');
    }
}

/**
 * Tab değiştirme fonksiyonu (eski versiyon - tüm özel işlemlerle)
 */
export async function switchTabOld(tabName) {
    safeConsole.log('🔄 switchTab çağrıldı:', tabName);
    
    // Tüm tab içeriklerini gizle
    hideAllTabContents();
    
    // Tüm tab butonlarını pasif yap
    deactivateAllTabButtons();
    
    // Seçilen tab'ı aktif et
    activateTab(tabName);
    
    // İlgili tab butonunu aktif et
    activateTabButton(tabName);
    
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
        // Envanter verilerini yükle
        if (!window.inventoryData) {
            safeConsole.log('🔄 Envanter verileri yükleniyor...');
            if (typeof window.loadInventoryData === 'function') {
                await window.loadInventoryData();
            }
        }
        // Stok konumlarını yükle
        if (typeof window.stockLocations === 'undefined' || Object.keys(window.stockLocations || {}).length === 0) {
            safeConsole.log('🔄 Stok konumları yükleniyor...');
            if (typeof window.loadStockLocations === 'function') {
                await window.loadStockLocations();
            }
        }
        // Ödeme verilerini yükle (mağaza ödeme bilgileri için gerekli)
        if (!window.paymentData || !window.paymentData.transactions || window.paymentData.transactions.length === 0) {
            safeConsole.log('🔄 Ödeme verileri yükleniyor (mağaza ödeme bilgileri için)...');
            if (typeof window.loadPaymentData === 'function') {
                await window.loadPaymentData();
            }
        }
        // Envanter verisi yüklendikten sonra mağaza analizini başlat
        setTimeout(() => {
            if (window.inventoryData && window.stockLocations && Object.keys(window.stockLocations).length > 0) {
                safeConsole.log('✅ Envanter verileri hazır, mağaza analizi başlatılıyor...');
            }
        }, 1000);
    } else if (tabName === 'city') {
        safeConsole.log('🌍 Şehir analizi sekmesi açılıyor...');
        safeConsole.log('📊 allData durumu:', window.allData ? `${window.allData.length} kayıt` : 'Henüz yüklenmedi');
        if (window.allData && window.allData.length > 0) {
            if (typeof window.populateCitySelect === 'function') {
                window.populateCitySelect();
            }
        } else {
            safeConsole.warn('⚠️ Veriler henüz yüklenmedi, şehir listesi doldurulamıyor');
            setTimeout(() => {
                if (window.allData && window.allData.length > 0) {
                    safeConsole.log('🔄 Veri yüklendi, şehir listesi yeniden dolduruluyor...');
                    if (typeof window.populateCitySelect === 'function') {
                        window.populateCitySelect();
                    }
                }
            }, 2000);
        }
    } else if (tabName === 'stock') {
        safeConsole.log('📦 Stok dağılım sekmesi açılıyor...');
        // LAZY LOAD: Envanter verilerini sadece ilk kez yükle
        if (!window.inventoryData) {
            safeConsole.log('🔄 Envanter verileri lazy loading ile yükleniyor...');
            if (typeof window.loadInventoryData === 'function') {
                await window.loadInventoryData();
            }
        } else {
            safeConsole.log('✅ Envanter verileri zaten yüklü');
        }
        // Stok konumlarını yükle
        if (typeof window.stockLocations === 'undefined' || Object.keys(window.stockLocations || {}).length === 0) {
            safeConsole.log('🔄 Stok konumları yükleniyor...');
            if (typeof window.loadStockLocations === 'function') {
                await window.loadStockLocations();
            }
        }
    } else if (tabName === 'inventory') {
        safeConsole.log('📊 Envanter + Satış Analizi sekmesi açılıyor...');
        // Envanter verilerini yükle (eğer yüklenmemişse veya boşsa)
        if (!window.inventoryData || !window.inventoryData.inventory || window.inventoryData.inventory.length === 0) {
            safeConsole.log('🔄 Envanter verileri yükleniyor...');
            if (typeof window.loadInventoryData === 'function') {
                await window.loadInventoryData();
            }
        }
        // Stok konumlarını yükle
        if (typeof window.stockLocations === 'undefined' || Object.keys(window.stockLocations || {}).length === 0) {
            safeConsole.log('🔄 Stok konumları yükleniyor...');
            if (typeof window.loadStockLocations === 'function') {
                await window.loadStockLocations();
            }
        }
        // Filtreleri doldur ve analizi çalıştır
        if (typeof window.populateInventoryFilters === 'function') {
            window.populateInventoryFilters();
        }
        // Biraz bekle (filtreler doldurulsun), sonra analizi çalıştır
        setTimeout(() => {
            if (typeof window.performInventoryAnalysis === 'function') {
                window.performInventoryAnalysis();
            }
        }, 300);
    } else if (tabName === 'payments') {
        safeConsole.log('💳 Ödeme Analizi sekmesi açılıyor...');
        
        // Özet kartlarının görünür olduğundan emin ol
        const summaryCards = document.getElementById('paymentSummaryCards');
        if (summaryCards) {
            summaryCards.style.display = 'grid';
        }
        
        // Ödeme verilerini yükle (eğer yüklenmemişse)
        if (!window.paymentData || !window.paymentData.transactions || window.paymentData.transactions.length === 0) {
            safeConsole.log('🔄 Ödeme verileri yükleniyor...');
            if (typeof window.loadPaymentData === 'function') {
                await window.loadPaymentData();
            }
        }
        // Analizi çalıştır
        setTimeout(() => {
            if (typeof window.analyzePayments === 'function') {
                window.analyzePayments();
            }
        }, 300);
    } else if (tabName === 'dailySales') {
        safeConsole.log('📅 Günlük Satış sekmesi açılıyor...');
        
        // Mağaza dropdown'unu doldur
        if (typeof window.populateDailySalesStoreFilter === 'function') {
            window.populateDailySalesStoreFilter();
        }
        
        // Tarih filtrelerini doldur
        if (typeof window.populateDailySalesDateFilters === 'function') {
            window.populateDailySalesDateFilters();
        }
        
        // Günlük satışları yükle
        setTimeout(() => {
            if (typeof window.loadDailySales === 'function') {
                window.loadDailySales();
            }
        }, 100);
    } else if (tabName === 'product') {
        safeConsole.log('🎸 Ürün, Marka ve Kategori Analizi sekmesi açılıyor...');
        
        // Ürün filtrelerini initialize et
        if (typeof window.initializeProductFilters === 'function') {
            window.initializeProductFilters();
        }
        
        // Ürün analizini çalıştır
        setTimeout(() => {
            if (typeof window.analyzeProducts === 'function') {
                window.analyzeProducts();
            }
        }, 200);
    }
}

/**
 * Tab'ları başlat ve varsayılan tab'ı göster
 */
export function initializeTabs() {
    safeConsole.log('🚀 Tab yönetimi başlatılıyor...');
    
    // Varsayılan olarak dashboard tab'ını göster
    const defaultTab = 'dashboard';
    
    // Tüm tab butonlarına event listener ekle
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
            if (tabName) {
                switchTabOld(tabName);
            }
        });
    });
    
    // Varsayılan tab'ı göster
    if (typeof window.switchTab === 'function') {
        // Yeni switchTab fonksiyonu varsa onu kullan
        window.switchTab(defaultTab);
    } else {
        // Yoksa eski fonksiyonu kullan
        switchTabOld(defaultTab);
    }
    
    safeConsole.log('✅ Tab yönetimi başlatıldı');
}

/**
 * Belirli bir tab'ın aktif olup olmadığını kontrol et
 */
export function isTabActive(tabName) {
    const tab = document.getElementById(tabName + 'Tab');
    return tab && tab.classList.contains('active');
}

/**
 * Aktif tab'ı al
 */
export function getActiveTab() {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        const tabId = activeTab.id;
        return tabId.replace('Tab', '');
    }
    return null;
}

// Global erişim için (mevcut kod uyumluluğu)
window.switchTabOld = switchTabOld;
window.initializeTabs = initializeTabs;
window.isTabActive = isTabActive;
window.getActiveTab = getActiveTab;

