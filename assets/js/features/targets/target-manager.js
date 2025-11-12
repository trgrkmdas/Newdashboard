/**
 * Hedef Takip Modülü
 * Yıllık ve aylık hedef yönetimi, hesaplama ve analiz fonksiyonları
 */

// Chart instance'ı saklamak için
let targetChart = null;

// Mağaza dropdown'larının doldurulup doldurulmadığını takip et
let targetStoresPopulated = false;

/**
 * Yıl tamamlanma oranı hesaplama fonksiyonu
 */
function getYearProgress(year) {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    if (currentYear > year) {
        return 1; // Geçmiş yıl - tamamlandı
    } else if (currentYear === year) {
        // Mevcut yıl - tamamlanma oranını hesapla
        const daysInYear = 365;
        const daysPassed = Math.floor((currentDate - new Date(year, 0, 1)) / (1000 * 60 * 60 * 24));
        return daysPassed / daysInYear;
    } else {
        return 0; // Gelecek yıl - henüz başlamadı
    }
}

/**
 * Hedef mağaza dropdown'larını doldur
 */
function populateTargetStoreDropdowns() {
    // Global allData'ya erişim
    const allData = window.allData || [];
    const safeConsole = window.safeConsole || console;
    
    // Veri yoksa veya zaten doldurulduysa çık
    if (!allData || allData.length === 0) {
        safeConsole.warn('⚠️ Mağaza dropdown doldurulamıyor: Veri yok');
        return;
    }
    
    // ZATEN DOLDURULDUYSA BİR DAHA DOLDURMA (kullanıcı seçimini korur)
    if (targetStoresPopulated) {
        safeConsole.log('✅ Mağaza dropdown zaten dolduruldu, tekrar doldurulmayacak');
        return;
    }
    
    // Mağazaları topla
    const stores = new Set();
    allData.forEach(item => {
        if (item.store) stores.add(item.store);
    });
    
    const sortedStores = Array.from(stores).sort();
    
    // Yıllık hedef mağaza dropdown
    const yearStoreSelect = document.getElementById('targetYearStore');
    const targetYearElement = document.getElementById('targetYear');
    
    if (yearStoreSelect && targetYearElement) {
        // Mevcut seçimi koru (localStorage'dan gelecek)
        const savedYearTargets = JSON.parse(localStorage.getItem('yearlyTargets') || '{}');
        const currentYear = targetYearElement.value;
        const savedStoreForYear = savedYearTargets[currentYear] ? Object.keys(savedYearTargets[currentYear])[0] : 'TÜM MAĞAZALAR';
        
        yearStoreSelect.innerHTML = '<option value="TÜM MAĞAZALAR">🏢 Tüm Mağazalar</option>';
        sortedStores.forEach(store => {
            const option = document.createElement('option');
            option.value = store;
            option.textContent = store;
            yearStoreSelect.appendChild(option);
        });
        
        // Kaydedilmiş mağazayı seç
        if (savedStoreForYear) {
            yearStoreSelect.value = savedStoreForYear;
        }
    }
    
    // Aylık hedef mağaza dropdown
    const monthStoreSelect = document.getElementById('targetMonthStore');
    if (monthStoreSelect) {
        // Mevcut seçimi koru (localStorage'dan gelecek)
        const savedMonthTargets = JSON.parse(localStorage.getItem('monthlyTargets') || '{}');
        const currentYear = document.getElementById('targetYear').value;
        const currentMonth = document.getElementById('targetMonth').value;
        const savedStoreForMonth = savedMonthTargets[currentYear] && savedMonthTargets[currentYear][currentMonth] 
            ? Object.keys(savedMonthTargets[currentYear])[0] 
            : 'TÜM MAĞAZALAR';
        
        monthStoreSelect.innerHTML = '<option value="TÜM MAĞAZALAR">🏢 Tüm Mağazalar</option>';
        sortedStores.forEach(store => {
            const option = document.createElement('option');
            option.value = store;
            option.textContent = store;
            monthStoreSelect.appendChild(option);
        });
        
        // Kaydedilmiş mağazayı seç
        if (savedStoreForMonth) {
            monthStoreSelect.value = savedStoreForMonth;
        }
    }
    
    targetStoresPopulated = true;
    safeConsole.log('✅ Hedef takip mağaza dropdownları dolduruldu:', stores.size, 'mağaza');
}

/**
 * Yıllık hedef kaydetme
 */
function saveYearlyTarget() {
    const safeConsole = window.safeConsole || console;
    const year = document.getElementById('targetYear').value;
    const store = document.getElementById('targetYearStore').value;
    const target = parseFloat(document.getElementById('yearlyTarget').value) || 0;
    
    safeConsole.log('💾 saveYearlyTarget çağrıldı:', {year, store, target});
    
    if (target <= 0) {
        alert('⚠️ Lütfen geçerli bir hedef girin!');
        return;
    }
    
    // Mevcut hedefleri al
    let yearlyTargets = JSON.parse(localStorage.getItem('yearlyTargets') || '{}');
    safeConsole.log('📂 Mevcut localStorage:', yearlyTargets);
    
    // 🔧 ESKİ FORMAT TESPİTİ VE OTOMATİK TEMİZLİK
    // Eski format: {2025: 5750000} -> sayı
    // Yeni format: {2025: {"TÜM MAĞAZALAR": 5750000}} -> object
    let needsMigration = false;
    for (const [y, value] of Object.entries(yearlyTargets)) {
        if (typeof value === 'number') {
            needsMigration = true;
            safeConsole.warn('⚠️ Eski localStorage formatı tespit edildi! Otomatik temizleniyor...');
            break;
        }
    }
    
    if (needsMigration) {
        // Eski verileri yeni formata dönüştür
        const migratedTargets = {};
        for (const [y, value] of Object.entries(yearlyTargets)) {
            if (typeof value === 'number') {
                // Eski format: sayı -> yeni format: {TÜM MAĞAZALAR: sayı}
                migratedTargets[y] = {'TÜM MAĞAZALAR': value};
                safeConsole.log(`🔄 ${y} yılı formatı güncellendi:`, value, '→', migratedTargets[y]);
            } else {
                // Zaten yeni format
                migratedTargets[y] = value;
            }
        }
        yearlyTargets = migratedTargets;
        localStorage.setItem('yearlyTargets', JSON.stringify(yearlyTargets));
        safeConsole.log('✅ Eski format temizlendi ve yeni formata dönüştürüldü!');
    }
    
    // Yıl yoksa oluştur
    if (!yearlyTargets[year]) {
        yearlyTargets[year] = {};
    }
    
    // Mağaza bazında hedefi kaydet
    yearlyTargets[year][store] = target;
    localStorage.setItem('yearlyTargets', JSON.stringify(yearlyTargets));
    
    safeConsole.log('✅ localStorage\'a kaydedildi:', yearlyTargets);
    safeConsole.log('🔍 Kontrol: localStorage.getItem:', localStorage.getItem('yearlyTargets'));
    
    // Hesapla
    calculateTargets();
    
    // Bildirim
    const storeText = store === 'TÜM MAĞAZALAR' ? 'Tüm Mağazalar' : store;
    alert(`✅ ${year} yılı ${storeText} hedefi kaydedildi: $${target.toLocaleString('tr-TR', {minimumFractionDigits: 2})}`);
}

/**
 * Yıllık hedef yükleme
 */
function loadYearlyTarget() {
    const safeConsole = window.safeConsole || console;
    const yearElement = document.getElementById('targetYear');
    const storeElement = document.getElementById('targetYearStore');
    
    // Eğer elementler yoksa (yeni hedef sistemi kullanılıyorsa), çık
    if (!yearElement || !storeElement) {
        safeConsole.log('ℹ️ Eski hedef sistemi elementleri bulunamadı, yeni sistem kullanılıyor');
        return;
    }
    
    const year = yearElement.value;
    const store = storeElement.value;
    
    // Mağaza adını temizle (kodları kaldır)
    const cleanStoreName = store.replace(/\[.*?\]\s*/g, '').replace(/^.*?\s-\s/, '').trim();
    
    // Google Sheets kaldırıldı - sadece localStorage fallback
    let yearlyTarget = null;
    
    // localStorage fallback
    if (!yearlyTarget) {
        const localTargets = JSON.parse(localStorage.getItem('yearlyTargets') || '{}')[year] || {};
        yearlyTarget = localTargets[store];
    }
    
    const yearlyTargets = {[store]: yearlyTarget};
    
    safeConsole.log('📊 loadYearlyTarget çağrıldı:', {year, store, cleanStoreName, yearlyTarget});
    
    // Hedef inputunu temizle
    const targetInput = document.getElementById('yearlyTarget');
    targetInput.value = '';
    
    // Eğer bu mağaza için hedef varsa doldur
    if (yearlyTargets[store]) {
        targetInput.value = yearlyTargets[store];
        safeConsole.log('✅ Yıllık hedef yüklendi (Google Sheets):', yearlyTargets[store]);
    } else {
        safeConsole.log('⚠️ Bu mağaza için kaydedilmiş hedef yok');
    }
    
    calculateTargets();
}

/**
 * Aylık hedef kaydetme
 */
function saveMonthlyTarget() {
    const safeConsole = window.safeConsole || console;
    const year = document.getElementById('targetYear').value;
    const month = document.getElementById('targetMonth').value;
    const store = document.getElementById('targetMonthStore').value;
    const target = parseFloat(document.getElementById('monthlyTarget').value) || 0;
    
    safeConsole.log('💾 saveMonthlyTarget çağrıldı:', {year, month, store, target});
    
    if (target <= 0) {
        alert('⚠️ Lütfen geçerli bir hedef girin!');
        return;
    }
    
    // Mevcut hedefleri al
    let monthlyTargets = JSON.parse(localStorage.getItem('monthlyTargets') || '{}');
    safeConsole.log('📂 Mevcut aylık localStorage:', monthlyTargets);
    
    // Yıl yoksa oluştur
    if (!monthlyTargets[year]) {
        monthlyTargets[year] = {};
    }
    
    // Mağaza yoksa oluştur
    if (!monthlyTargets[year][store]) {
        monthlyTargets[year][store] = {};
    }
    
    // Mağaza ve ay bazında hedefi kaydet
    monthlyTargets[year][store][month] = target;
    localStorage.setItem('monthlyTargets', JSON.stringify(monthlyTargets));
    
    safeConsole.log('✅ Aylık localStorage\'a kaydedildi:', monthlyTargets);
    
    // Hesapla
    calculateTargets();
    
    // Ay adını bul
    const monthNames = {
        '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
        '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
        '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
    };
    
    // Bildirim
    const storeText = store === 'TÜM MAĞAZALAR' ? 'Tüm Mağazalar' : store;
    alert(`✅ ${year} ${monthNames[month]} ${storeText} hedefi kaydedildi: $${target.toLocaleString('tr-TR', {minimumFractionDigits: 2})}`);
}

/**
 * Aylık hedef yükleme
 */
function loadMonthlyTarget() {
    const safeConsole = window.safeConsole || console;
    const yearElement = document.getElementById('targetYear');
    const monthElement = document.getElementById('targetMonth');
    const storeElement = document.getElementById('targetMonthStore');
    
    // Eğer elementler yoksa (yeni hedef sistemi kullanılıyorsa), çık
    if (!yearElement || !monthElement || !storeElement) {
        safeConsole.log('ℹ️ Eski hedef sistemi elementleri bulunamadı, yeni sistem kullanılıyor');
        return;
    }
    
    const year = yearElement.value;
    const month = monthElement.value;
    const store = storeElement.value;
    
    // Mağaza adını temizle (kodları kaldır)
    const cleanStoreName = store.replace(/\[.*?\]\s*/g, '').replace(/^.*?\s-\s/, '').trim();
    
    // Google Sheets kaldırıldı - sadece localStorage fallback
    const localTarget = JSON.parse(localStorage.getItem('monthlyTargets') || '{}')[year]?.[store]?.[month];
    const target = localTarget;
    
    safeConsole.log('📊 loadMonthlyTarget çağrıldı:', {year, month, store, localTarget});
    
    // Hedef inputunu temizle
    const targetInput = document.getElementById('monthlyTarget');
    targetInput.value = '';
    
    // Eğer bu mağaza ve ay için hedef varsa doldur
    if (target) {
        targetInput.value = target;
        safeConsole.log(`✅ Aylık hedef yüklendi (localStorage):`, target);
    } else {
        safeConsole.log('⚠️ Bu mağaza ve ay için kaydedilmiş hedef yok');
    }
    
    calculateTargets();
}

/**
 * Hedef hesaplamaları
 */
function calculateTargets() {
    const allData = window.allData || [];
    const safeConsole = window.safeConsole || console;
    
    // Mağazaları doldur (ilk kez çağrıldığında)
    populateTargetStoreDropdowns();
    
    const targetYear = document.getElementById('targetYear').value;
    const targetMonth = document.getElementById('targetMonth').value;
    const yearStore = document.getElementById('targetYearStore').value;
    const monthStore = document.getElementById('targetMonthStore').value;
    
    // Hedefleri Google Sheets'ten veya input'tan al
    let yearlyTarget = parseFloat(document.getElementById('yearlyTarget').value) || 0;
    let monthlyTarget = parseFloat(document.getElementById('monthlyTarget').value) || 0;
    
    // Google Sheets kaldırıldı - hedefler targets.json'dan veya localStorage'dan geliyor
    
    // Yıllık hesaplama - HER ZAMAN gerçekleşmeyi göster (hedef olsun/olmasın)
    const yearlyData = allData.filter(item => {
        if (!item.date) return false;
        const dateMatch = item.date.startsWith(targetYear);
        const storeMatch = yearStore === 'TÜM MAĞAZALAR' || item.store === yearStore;
        return dateMatch && storeMatch;
    });
    
    const yearlyAchieved = yearlyData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    
    if (yearlyTarget > 0) {
        const yearlyRemaining = Math.max(0, yearlyTarget - yearlyAchieved);
        const yearlyPercent = (yearlyAchieved / yearlyTarget) * 100; // Math.min kaldırıldı, %100 üstü gösterilecek
        
        // Kalan günleri hesapla
        const today = new Date();
        const endOfYear = new Date(targetYear, 11, 31);
        const daysLeft = Math.max(0, Math.ceil((endOfYear - today) / (1000 * 60 * 60 * 24)));
        const dailyRequired = daysLeft > 0 ? yearlyRemaining / daysLeft : 0;
        
        // Progress bar max 100% genişlikte kalır, ama text gerçek yüzdeyi gösterir
        document.getElementById('yearlyProgress').style.width = Math.min(100, yearlyPercent) + '%';
        document.getElementById('yearlyProgress').textContent = yearlyPercent.toFixed(1) + '%';
        document.getElementById('yearlyAchieved').textContent = '$' + yearlyAchieved.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        document.getElementById('yearlyRemaining').textContent = '$' + yearlyRemaining.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        document.getElementById('yearlyDaysLeft').textContent = daysLeft;
        document.getElementById('yearlyDailyRequired').textContent = '$' + dailyRequired.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    } else {
        // Hedef yoksa sadece gerçekleşmeyi göster, diğer alanları temizle
        document.getElementById('yearlyProgress').style.width = '0%';
        document.getElementById('yearlyProgress').textContent = '0%';
        document.getElementById('yearlyAchieved').textContent = '$' + yearlyAchieved.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        document.getElementById('yearlyRemaining').textContent = '$0,00';
        document.getElementById('yearlyDaysLeft').textContent = '-';
        document.getElementById('yearlyDailyRequired').textContent = '$0,00';
    }
    
    // Aylık hesaplama - HER ZAMAN gerçekleşmeyi göster (hedef olsun/olmasın)
    const monthlyData = allData.filter(item => {
        if (!item.date) return false;
        const itemDate = item.date.split('-');
        const dateMatch = itemDate[0] === targetYear && itemDate[1] === targetMonth;
        const storeMatch = monthStore === 'TÜM MAĞAZALAR' || item.store === monthStore;
        return dateMatch && storeMatch;
    });
    
    const monthlyAchieved = monthlyData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    
    if (monthlyTarget > 0) {
        const monthlyRemaining = Math.max(0, monthlyTarget - monthlyAchieved);
        const monthlyPercent = (monthlyAchieved / monthlyTarget) * 100; // Math.min kaldırıldı, %100 üstü gösterilecek
        
        // Kalan günleri hesapla
        const today = new Date();
        const endOfMonth = new Date(targetYear, parseInt(targetMonth), 0);
        const daysLeft = Math.max(0, Math.ceil((endOfMonth - today) / (1000 * 60 * 60 * 24)));
        const dailyRequired = daysLeft > 0 ? monthlyRemaining / daysLeft : 0;
        
        // Progress bar max 100% genişlikte kalır, ama text gerçek yüzdeyi gösterir
        document.getElementById('monthlyProgress').style.width = Math.min(100, monthlyPercent) + '%';
        document.getElementById('monthlyProgress').textContent = monthlyPercent.toFixed(1) + '%';
        document.getElementById('monthlyAchieved').textContent = '$' + monthlyAchieved.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        document.getElementById('monthlyRemaining').textContent = '$' + monthlyRemaining.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        document.getElementById('monthlyDaysLeft').textContent = daysLeft;
        document.getElementById('monthlyDailyRequired').textContent = '$' + dailyRequired.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    } else {
        // Hedef yoksa sadece gerçekleşmeyi göster, diğer alanları temizle
        document.getElementById('monthlyProgress').style.width = '0%';
        document.getElementById('monthlyProgress').textContent = '0%';
        document.getElementById('monthlyAchieved').textContent = '$' + monthlyAchieved.toLocaleString('tr-TR', {minimumFractionDigits: 2});
        document.getElementById('monthlyRemaining').textContent = '$0,00';
        document.getElementById('monthlyDaysLeft').textContent = '-';
        document.getElementById('monthlyDailyRequired').textContent = '$0,00';
    }
    
    // Grafik çiz
    renderTargetChart();
}

/**
 * Hedef grafiği render
 */
function renderTargetChart() {
    const allData = window.allData || [];
    const Chart = window.Chart;
    
    if (!Chart) {
        console.warn('⚠️ Chart.js yüklenmedi, grafik oluşturulamıyor');
        return;
    }
    
    const ctx = document.getElementById('targetChart');
    if (!ctx) return;
    
    // Aylık satış verileri
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                   'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const targetYear = document.getElementById('targetYear').value;
    const yearStore = document.getElementById('targetYearStore').value;
    
    const monthlySales = months.map((month, index) => {
        const monthNum = String(index + 1).padStart(2, '0');
        const monthData = allData.filter(item => {
            if (!item.date) return false;
            const itemDate = item.date.split('-');
            const dateMatch = itemDate[0] === targetYear && itemDate[1] === monthNum;
            const storeMatch = yearStore === 'TÜM MAĞAZALAR' || item.store === yearStore;
            return dateMatch && storeMatch;
        });
        return monthData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    });
    
    if (targetChart) {
        targetChart.destroy();
    }
    
    targetChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Aylık Satış (USD)',
                data: monthlySales,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: `${targetYear} Yılı Aylık Satış Performansı ${yearStore !== 'TÜM MAĞAZALAR' ? '(' + yearStore + ')' : ''}`,
                    font: {
                        size: 16,
                        weight: 'bold'
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
 * Yıllık hedef analizi render - Kaldırıldı
 */
function renderYearlyTargetAnalysis() {
    // Bu fonksiyon kaldırıldı - artık hiçbir şey yapmıyor
    const container = document.getElementById('targetsTab');
    if (!container) return;
    
    // Eski analiz alanını kaldır (varsa)
    const oldAnalysis = container.querySelector('#yearlyTargetAnalysis');
    if (oldAnalysis) {
        oldAnalysis.remove();
    }
}

/**
 * Tüm mağazaların hedeflerini yükle ve göster
 */
function loadAllStoresTargets() {
    const allData = window.allData || [];
    const centralTargets = window.centralTargets || {yearly: {}, monthly: {}};
    const safeConsole = window.safeConsole || console;
    
    // Debug: centralTargets kontrolü
    safeConsole.log('🔍 loadAllStoresTargets çağrıldı:', {
        hasCentralTargets: !!window.centralTargets,
        centralTargetsKeys: window.centralTargets ? Object.keys(window.centralTargets) : [],
        yearlyKeys: centralTargets.yearly ? Object.keys(centralTargets.yearly) : [],
        monthlyKeys: centralTargets.monthly ? Object.keys(centralTargets.monthly) : [],
        hasInfo: !!(centralTargets._info),
        storeMapping: centralTargets._info ? centralTargets._info.store_mapping : null
    });
    
    // Veri kontrolü
    if (!allData || allData.length === 0) {
        safeConsole.warn('⚠️ Veri henüz yüklenmedi, hedef listesi oluşturulamıyor.');
        const container = document.getElementById('allStoresTargetsContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;">⏳ Veriler yükleniyor, lütfen bekleyin...</div>';
        }
        return;
    }
    
    const year = document.getElementById('targetFilterYear').value;
    const month = document.getElementById('targetFilterMonth').value || ''; // Boş string'i garantile
    const container = document.getElementById('allStoresTargetsContainer');
    
    safeConsole.log('📊 Tüm mağazalar hedef listesi yükleniyor:', {year, month, monthType: typeof month, monthLength: month.length});
    
    // Tüm mağazaları bul
    const allStores = new Set();
    allData.forEach(item => {
        if (item.store && item.store !== 'Analitik' && !item.store.toLowerCase().includes('eğitim')) {
            allStores.add(item.store);
        }
    });
    
    const storesList = Array.from(allStores).sort();
    
    // Her mağaza için hedef ve gerçekleşme hesapla
    const storesData = storesList.map(storeName => {
        // Mağaza adından [ID] prefix'ini temizle
        let cleanStoreName = storeName.replace(/^\[\d+\]\s*/, ''); // "[1101404] " gibi prefix'leri kaldır
        // Mağaza adından "Perakende - " prefix'ini de kaldır (eğer varsa)
        cleanStoreName = cleanStoreName.replace(/^Perakende\s*-\s*/i, '').trim();
        
        // Hedefi al (Esnek eşleştirme ile)
        let target = 0;
        
        // Hedef anahtarı bul (tam eşleşme veya kısmi eşleşme)
        function findTargetKey(targetObj, storeName) {
            if (!targetObj) return null;
            
            // Önce store_mapping kullan (eğer varsa)
            if (centralTargets._info && centralTargets._info.store_mapping) {
                const mapping = centralTargets._info.store_mapping;
                // Mağaza adını normalize et (büyük harf, boşlukları temizle, özel karakterleri kaldır)
                let normalizedStoreName = storeName.toUpperCase().trim();
                // Özel karakterleri kaldır ve sadece harf/rakam bırak
                normalizedStoreName = normalizedStoreName.replace(/[^A-Z0-9]/g, '');
                
                // Mapping'de ara (hem tam eşleşme hem de kısmi eşleşme)
                for (const [key, value] of Object.entries(mapping)) {
                    const normalizedKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (normalizedKey === normalizedStoreName || normalizedStoreName.includes(normalizedKey) || normalizedKey.includes(normalizedStoreName)) {
                        if (targetObj[value]) {
                            safeConsole.log(`✅ Mapping bulundu: "${storeName}" → "${value}"`);
                            return value;
                        }
                    }
                }
            }
            
            // Tam eşleşme (temiz isimle)
            if (targetObj[storeName]) return storeName;
            
            // "Perakende - " prefix'i ile eşleşme dene
            const withPrefix = `Perakende - ${storeName}`;
            if (targetObj[withPrefix]) {
                safeConsole.log(`✅ Prefix ile eşleşme: "${storeName}" → "${withPrefix}"`);
                return withPrefix;
            }
            
            // Kısmi eşleşme (case-insensitive)
            const storeNameLower = storeName.toLowerCase();
            for (const key of Object.keys(targetObj)) {
                const keyLower = key.toLowerCase();
                // Eğer hedef anahtarı mağaza adını içeriyorsa veya tam tersi
                if (keyLower.includes(storeNameLower) || storeNameLower.includes(keyLower)) {
                    safeConsole.log(`✅ Kısmi eşleşme: "${storeName}" → "${key}"`);
                    return key;
                }
            }
            return null;
        }
        
        if (month) {
            // AYLIK HEDEF - Önce centralTargets (GitHub), sonra Google Sheets, sonra localStorage
            if (centralTargets.monthly && centralTargets.monthly[year]) {
                const targetKey = findTargetKey(centralTargets.monthly[year], cleanStoreName);
                // safeConsole.log(`🔍 Mağaza: "${storeName}" → Temiz: "${cleanStoreName}" → Hedef Anahtarı: "${targetKey}"`);
                if (targetKey && centralTargets.monthly[year][targetKey] && centralTargets.monthly[year][targetKey][month]) {
                    target = centralTargets.monthly[year][targetKey][month];
                    // safeConsole.log(`✅ Hedef bulundu: $${target}`);
                }
            }
            
            // Google Sheets kaldırıldı - sadece localStorage fallback
            if (target === 0) {
                const localTargets = JSON.parse(localStorage.getItem('monthlyTargets') || '{}');
                if (localTargets[year]) {
                    const targetKey = findTargetKey(localTargets[year], cleanStoreName);
                    if (targetKey && localTargets[year][targetKey][month]) {
                        target = localTargets[year][targetKey][month];
                    }
                }
            }
        } else {
            // YILLIK HEDEF - Önce centralTargets (GitHub), sonra Google Sheets, sonra localStorage
            if (centralTargets.yearly && centralTargets.yearly[year]) {
                const targetKey = findTargetKey(centralTargets.yearly[year], cleanStoreName);
                if (targetKey) {
                    target = centralTargets.yearly[year][targetKey];
                }
            }
            
            // Google Sheets kaldırıldı - sadece localStorage fallback
            if (target === 0) {
                const localTargets = JSON.parse(localStorage.getItem('yearlyTargets') || '{}');
                if (localTargets[year]) {
                    const targetKey = findTargetKey(localTargets[year], cleanStoreName);
                    if (targetKey) {
                        target = localTargets[year][targetKey];
                    }
                }
            }
        }
        
        // Gerçekleşmeyi hesapla
        const storeData = allData.filter(item => {
            if (item.store !== storeName) return false;
            if (!item.date) return false;
            
            if (month) {
                // Aylık: Belirli yıl ve ay
                return item.date.startsWith(`${year}-${month}`);
            } else {
                // Yıllık: Sadece yıl
                return item.date.startsWith(year);
            }
        });
        
        const achieved = storeData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
        const percentage = target > 0 ? (achieved / target * 100) : 0;
        const remaining = target - achieved;
        
        // Kalan gün hesapla
        const today = new Date();
        let daysLeft = 0;
        
        if (month) {
            // Ayın son günü
            const lastDay = new Date(year, parseInt(month), 0);
            daysLeft = Math.max(0, Math.ceil((lastDay - today) / (1000 * 60 * 60 * 24)));
        } else {
            // Yılın son günü
            const lastDay = new Date(year, 11, 31);
            daysLeft = Math.max(0, Math.ceil((lastDay - today) / (1000 * 60 * 60 * 24)));
        }
        
        const dailyRequired = daysLeft > 0 ? remaining / daysLeft : 0;
        
        return {
            name: storeName,
            target,
            achieved,
            percentage,
            remaining,
            daysLeft,
            dailyRequired
        };
    }); // TÜM mağazaları göster (hedef olsun olmasın)
    
    // Hedefsiz mağazaları ayır (en alta koyacağız)
    const storesWithTarget = storesData.filter(store => store.target > 0);
    const storesWithoutTarget = storesData.filter(store => store.target === 0);
    
    // Hedefli mağazaları yüzdeye göre sırala
    storesWithTarget.sort((a, b) => b.percentage - a.percentage);
    
    // Hedefsiz mağazaları alfabetik sırala
    storesWithoutTarget.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    
    // Önce hedefli, sonra hedefsiz mağazalar
    const sortedStoresData = [...storesWithTarget, ...storesWithoutTarget];
    
    safeConsole.log(`📊 Toplam ${storesData.length} mağaza, ${storesWithTarget.length} hedefli, ${storesWithoutTarget.length} hedefsiz`);
    
    // Renk belirleme fonksiyonu
    function getPerformanceColor(percentage) {
        if (percentage >= 130) return '#3b82f6'; // Mavi - %130 ve üzeri
        if (percentage >= 100) return '#22c55e'; // Yeşil
        if (percentage >= 85) return '#f59e0b'; // Turuncu
        return '#ef4444'; // Kırmızı
    }
    
    // HTML oluştur
    let html = '<div style="margin-bottom: 20px; text-align: center;">';
    html += '<h3 style="margin: 0; font-size: 1.5em;">';
    html += (month ? year + ' - ' + ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][parseInt(month) - 1] + ' Dönemi' : year + ' Yılı') + ' Mağaza Hedef Durumları';
    html += '</h3>';
    html += '<p style="color: #6c757d; margin-top: 5px;">Toplam ' + sortedStoresData.length + ' mağaza</p>';
    html += '</div>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">';
    
    sortedStoresData.forEach(store => {
        // Hedefsiz mağazalar için özel görünüm
        if (store.target === 0) {
            html += '<div class="storeCard" style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); border-radius: 15px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); color: white; opacity: 0.7;">';
            html += '<h3 style="margin: 0 0 15px 0; font-size: 1.5em; color: white;">' + store.name + '</h3>';
            html += '<div style="text-align: center; padding: 40px 0;">';
            html += '<div style="font-size: 3em; margin-bottom: 10px;">📊</div>';
            html += '<div style="font-size: 1.1em; opacity: 0.9; margin-bottom: 10px;">Hedef Tanımlanmamış</div>';
            html += '<div style="font-size: 1.3em; font-weight: 600; margin-top: 15px;">';
            html += 'Gerçekleşme: $' + store.achieved.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            html += '</div></div></div>';
            return;
        }
        
        const bgColor = getPerformanceColor(store.percentage);
        const textColor = 'white';
        
        // Circular progress için derece hesapla (max 100% için 360 derece)
        const progressDeg = Math.min(store.percentage * 3.6, 360);
        
        // İçerik belirleme
        let contentHtml = '';
        
        if (store.percentage >= 130) {
            // %130 hedefi aşıldı - Circular progress ile modern görünüm
            contentHtml = '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">';
            contentHtml += '<div style="font-size: 1.1em; font-weight: 700; flex: 1;">🏪 ' + store.name + '</div>';
            contentHtml += '<div style="width: 65px; height: 65px; border-radius: 50%; background: conic-gradient(from 0deg, #10B981 0deg ' + progressDeg + 'deg, rgba(255,255,255,0.2) ' + progressDeg + 'deg 360deg); display: flex; align-items: center; justify-content: center; position: relative;">';
            contentHtml += '<div style="width: 48px; height: 48px; border-radius: 50%; background: ' + bgColor + '; display: flex; align-items: center; justify-content: center; font-size: 1em; font-weight: 700;">' + store.percentage.toFixed(1) + '%</div>';
            contentHtml += '</div></div>';
            contentHtml += '<div style="text-align: center; font-size: 1.2em; margin: 12px 0; font-weight: bold;">🏆 Tüm Hedefler Tamamlandı!</div>';
            contentHtml += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📊 Gerçekleşen</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + store.achieved.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
            contentHtml += '</div>';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">🎯 %100 Hedef</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + store.target.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
            contentHtml += '</div>';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">🏆 %130 Hedef</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + (store.target * 1.3).toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
            contentHtml += '</div>';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📈 Fazla</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + (store.achieved - store.target * 1.3).toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
            contentHtml += '</div></div>';
        } else if (store.percentage >= 100) {
            // %100 hedef gerçekleşti - Circular progress ile modern görünüm
            contentHtml = '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">';
            contentHtml += '<div style="font-size: 1.1em; font-weight: 700; flex: 1;">🏪 ' + store.name + '</div>';
            contentHtml += '<div style="width: 65px; height: 65px; border-radius: 50%; background: conic-gradient(from 0deg, #10B981 0deg ' + progressDeg + 'deg, rgba(255,255,255,0.2) ' + progressDeg + 'deg 360deg); display: flex; align-items: center; justify-content: center; position: relative;">';
            contentHtml += '<div style="width: 48px; height: 48px; border-radius: 50%; background: ' + bgColor + '; display: flex; align-items: center; justify-content: center; font-size: 1em; font-weight: 700;">' + store.percentage.toFixed(1) + '%</div>';
            contentHtml += '</div></div>';
            contentHtml += '<div style="text-align: center; font-size: 1.1em; margin: 12px 0; font-weight: bold;">✅ Hedef Gerçekleşti!</div>';
            
            // SADECE AYLIK SEÇİMDE %130 HEDEF GÖSTER
            if (month) {
                const remaining130 = Math.max(0, (store.target * 1.3) - store.achieved);
                const dailyRequired130 = store.daysLeft > 0 ? remaining130 / store.daysLeft : 0;
                
                contentHtml += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
                contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
                contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📊 Gerçekleşen</div>';
                contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + store.achieved.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
                contentHtml += '</div>';
                contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
                contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📈 Kalan (%130)</div>';
                contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + remaining130.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
                contentHtml += '</div>';
                contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
                contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📅 Kalan Gün</div>';
                contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">' + store.daysLeft + '</div>';
                contentHtml += '</div>';
                contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
                contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">💰 Günlük Gerekli</div>';
                contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + dailyRequired130.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
                contentHtml += '</div></div>';
            } else {
                // YILLIK SEÇİMDE SADECE %100 HEDEF GÖSTER
                contentHtml += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
                contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
                contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📊 Gerçekleşen</div>';
                contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + store.achieved.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
                contentHtml += '</div>';
                contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
                contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">🎯 %100 Hedef</div>';
                contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + store.target.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
                contentHtml += '</div></div>';
            }
        } else {
            // %100'ün altında - Circular progress ile modern görünüm
            const remaining100 = Math.max(0, store.target - store.achieved);
            const dailyRequired100 = store.daysLeft > 0 ? remaining100 / store.daysLeft : 0;
            
            contentHtml = '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">';
            contentHtml += '<div style="font-size: 1.1em; font-weight: 700; flex: 1;">🏪 ' + store.name + '</div>';
            contentHtml += '<div style="width: 65px; height: 65px; border-radius: 50%; background: conic-gradient(from 0deg, #10B981 0deg ' + progressDeg + 'deg, rgba(255,255,255,0.2) ' + progressDeg + 'deg 360deg); display: flex; align-items: center; justify-content: center; position: relative;">';
            contentHtml += '<div style="width: 48px; height: 48px; border-radius: 50%; background: ' + bgColor + '; display: flex; align-items: center; justify-content: center; font-size: 1em; font-weight: 700;">' + store.percentage.toFixed(1) + '%</div>';
            contentHtml += '</div></div>';
            
            contentHtml += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📊 Gerçekleşen</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + store.achieved.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
            contentHtml += '</div>';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📈 Kalan</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + remaining100.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
            contentHtml += '</div>';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">📅 Kalan Gün</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">' + store.daysLeft + '</div>';
            contentHtml += '</div>';
            contentHtml += '<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 8px;">';
            contentHtml += '<div style="font-size: 0.75em; opacity: 0.9; margin-bottom: 4px;">💰 Günlük Gerekli</div>';
            contentHtml += '<div style="font-size: 0.9em; font-weight: 700;">$' + dailyRequired100.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}) + '</div>';
            contentHtml += '</div></div>';
        }
        
        html += '<div style="background: ' + bgColor + '; color: ' + textColor + '; padding: 18px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">';
        html += contentHtml;
        html += '</div>';
    });
    
    html += '</div>';
    
    if (sortedStoresData.length === 0) {
        html = `
            <div style="text-align: center; padding: 60px; background: #f8f9fa; border-radius: 15px;">
                <div style="font-size: 4em; margin-bottom: 20px;">📊</div>
                <h3 style="color: #6c757d; margin-bottom: 10px;">Hedef Bulunamadı</h3>
                <p style="color: #adb5bd;">Seçili dönem için hiçbir mağazaya hedef tanımlanmamış</p>
            </div>
        `;
    }
    
    safeConsole.log(`📊 HTML oluşturuldu, container bulundu: ${!!container}, HTML uzunluğu: ${html.length}`);
    safeConsole.log(`📊 HTML başlangıcı:`, html.substring(0, 200));
    
    try {
        container.innerHTML = html;
        safeConsole.log(`✅ HTML container'a yazıldı!`);
    } catch (error) {
        console.error(`❌ HTML yazma hatası:`, error);
        safeConsole.log(`❌ Hatalı HTML:`, html.substring(0, 500));
    }
    
    // Yıllık Hedef Analizi ve Gelecek Potansiyel alanı kaldırıldı
}

/**
 * Yıllık hedef analiz fonksiyonu
 */
function performYearlyTargetAnalysis() {
    const allData = window.allData || [];
    const safeConsole = window.safeConsole || console;
    
    safeConsole.log('📊 Yıllık hedef analizi başlatılıyor...');
    
    // Veri kontrolü - güvenli çıkış
    if (!allData || allData.length === 0) {
        safeConsole.log('⚠️ Veri henüz yüklenmedi, analiz atlanıyor');
        return;
    }
    
    // Sadece Hedef Takip sekmesinde çalış
    const targetsTab = document.getElementById('targetsTab');
    if (!targetsTab || !targetsTab.classList.contains('active')) {
        safeConsole.log('⚠️ Hedef Takip sekmesi aktif değil, analiz atlanıyor');
        return;
    }
    
    const container = document.getElementById('yearlyAnalysisContent');
    if (!container) {
        safeConsole.log('⚠️ yearlyAnalysisContent elementi bulunamadı, önce renderYearlyTargetAnalysis çağrılmalı');
        return;
    }
    
    // Mevcut yıl
    const currentYear = new Date().getFullYear();
    
    // Seçilen yıl (targetFilterYear dropdown'ından)
    const selectedYear = document.getElementById('targetFilterYear')?.value || currentYear.toString();
    
    // Yıllık hedefleri localStorage'dan yükle
    const yearlyTargets = JSON.parse(localStorage.getItem('yearlyTargets') || '{}');
    
    // Yıl tamamlanma oranları
    const yearProgress2023 = getYearProgress(2023);
    const yearProgress2024 = getYearProgress(2024);
    const yearProgress2025 = getYearProgress(2025);
    
    // Yıllık verileri topla
    const yearlyData = {};
    const years = ['2023', '2024', '2025'];
    
    years.forEach(year => {
        yearlyData[year] = allData.filter(item => item.date && item.date.startsWith(year));
    });
    
    // Mağaza bazlı analiz
    const storeAnalysis = {};
    
    // Tüm mağazaları topla
    const allStores = new Set();
    Object.values(yearlyData).forEach(yearData => {
        yearData.forEach(item => {
            if (item.store) allStores.add(item.store);
        });
    });
    
    // Her mağaza için analiz yap
    allStores.forEach(store => {
        const storeData = {
            name: store,
            years: {},
            trends: {},
            recommendations: []
        };
        
        // Her yıl için mağaza verilerini topla
        years.forEach(year => {
            const yearStoreData = yearlyData[year].filter(item => item.store === store);
            const totalSales = yearStoreData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
            const totalQty = yearStoreData.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
            const invoiceCount = new Set(yearStoreData.filter(item => item.move_type === 'out_invoice').map(item => item.move_name)).size;
            
            storeData.years[year] = {
                sales: totalSales,
                qty: totalQty,
                invoiceCount: invoiceCount,
                recordCount: yearStoreData.length
            };
        });
        
        // Trend analizi - 2025 tamamlanmamış yıl dikkate alınarak
        const sales2023 = storeData.years['2023']?.sales || 0;
        const sales2024 = storeData.years['2024']?.sales || 0;
        const sales2025 = storeData.years['2025']?.sales || 0;
        
        // Mevcut tarih ve tamamlanmamış yıl analizi
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        
        // Dinamik trend analizi - her yıl için tamamlanma durumunu dikkate al
        const calculateTrend = (fromYear, toYear, fromSales, toSales, fromProgress, toProgress) => {
            if (fromSales <= 0) return null;
            
            let actualToSales = toSales;
            let isProjected = false;
            
            // Eğer hedef yıl tamamlanmamışsa projeksiyon yap
            if (toProgress < 1 && toProgress > 0) {
                actualToSales = toSales / toProgress;
                isProjected = true;
            }
            
            const growth = ((actualToSales - fromSales) / fromSales) * 100;
            
            return {
                growth: growth,
                type: growth > 0 ? 'positive' : 'negative',
                isProjected: isProjected,
                yearProgress: toProgress,
                projectedSales: isProjected ? actualToSales : toSales
            };
        };
        
        // 2023-2024 trend
        storeData.trends['2023-2024'] = calculateTrend(2023, 2024, sales2023, sales2024, yearProgress2023, yearProgress2024);
        
        // 2024-2025 trend
        storeData.trends['2024-2025'] = calculateTrend(2024, 2025, sales2024, sales2025, yearProgress2024, yearProgress2025);
        
        // 2023-2025 genel trend
        storeData.trends['2023-2025'] = calculateTrend(2023, 2025, sales2023, sales2025, yearProgress2023, yearProgress2025);
        
        // Dinamik öneriler oluştur - gelecek yıl hedefi hesapla
        const nextYear = currentYear + 1;
        const currentYearSales = storeData.years[currentYear.toString()]?.sales || 0;
        const projectedCurrentYear = yearProgress2025 < 1 && yearProgress2025 > 0 ? 
            (storeData.years['2025']?.sales || 0) / yearProgress2025 : 
            currentYearSales;
        
        const generateRecommendation = () => {
            const trend2023_2024 = storeData.trends['2023-2024'];
            const trend2024_2025 = storeData.trends['2024-2025'];
            
            if (trend2023_2024?.type === 'positive' && trend2024_2025?.type === 'positive') {
                return {
                    type: 'success',
                    title: '🚀 Sürekli Büyüme',
                    description: `Mağaza 2 yıldır sürekli büyüyor. ${nextYear} hedefi: $${(projectedCurrentYear * 1.15).toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`
                };
            } else if (trend2023_2024?.type === 'negative' && trend2024_2025?.type === 'positive') {
                return {
                    type: 'warning',
                    title: '📈 Toparlanma',
                    description: `2024'te düşüş yaşadı ama ${currentYear}'te toparlandı. ${nextYear} hedefi: $${(projectedCurrentYear * 1.10).toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`
                };
            } else if (trend2023_2024?.type === 'positive' && trend2024_2025?.type === 'negative') {
                return {
                    type: 'danger',
                    title: '⚠️ Dikkat Gerekli',
                    description: `2024'te büyüdü ama ${currentYear}'te düştü. ${nextYear} hedefi: $${(projectedCurrentYear * 1.05).toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`
                };
            } else {
                return {
                    type: 'info',
                    title: '📊 Stabil Durum',
                    description: `Mağaza stabil performans gösteriyor. ${nextYear} hedefi: $${(projectedCurrentYear * 1.08).toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`
                };
            }
        };
        
        storeData.recommendations.push(generateRecommendation());
        
        storeAnalysis[store] = storeData;
    });
    
    // HTML oluştur
    let html = '';
    
    Object.values(storeAnalysis).forEach(store => {
        const bgColor = store.recommendations[0]?.type === 'success' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' :
                       store.recommendations[0]?.type === 'warning' ? 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)' :
                       store.recommendations[0]?.type === 'danger' ? 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)' :
                       'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
        
        html += `
            <div style="background: ${bgColor}; color: white; padding: 25px; border-radius: 15px; box-shadow: 0 8px 25px rgba(0,0,0,0.2);">
                <h3 style="margin: 0 0 20px 0; font-size: 1.4em; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px;">
                    🏪 ${store.name}
                </h3>
                
                <!-- Yıllık Veriler -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                    ${['2023', '2024', '2025'].map(year => {
                        const yearData = store.years[year];
                        const isCurrentYear = year === currentYear.toString();
                        const currentYearProgress = getYearProgress(parseInt(year));
                        const isProjected = isCurrentYear && currentYearProgress < 1 && currentYearProgress > 0;
                        const displayValue = isProjected ? 
                            (yearData?.sales || 0) / currentYearProgress : 
                            (yearData?.sales || 0);
                        
                        // Eğer "Proj." yazıyorsa (projeksiyon yılı), o yılın hedefini göster
                        let targetInfo = '';
                        if (isProjected && yearlyTargets[year] && yearlyTargets[year][store.name]) {
                            const targetValue = parseFloat(yearlyTargets[year][store.name]) || 0;
                            if (targetValue > 0) {
                                targetInfo = `<div style="font-size: 0.85em; opacity: 0.9; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                                    🎯 %100 Hedef: $${targetValue.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </div>`;
                            }
                        }
                        
                        return `
                            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; text-align: center;">
                                <div style="font-size: 0.9em; opacity: 0.8;">
                                    ${year}${isProjected ? ' (Proj.)' : ''}
                                </div>
                                <div style="font-size: 1.2em; font-weight: bold;">
                                    $${displayValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                </div>
                                ${targetInfo}
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <!-- Trend Göstergeleri -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                    ${[
                        { key: '2023-2024', label: '2023→2024' },
                        { key: '2024-2025', label: '2024→2025' }
                    ].map(trend => {
                        const trendData = store.trends[trend.key];
                        return `
                            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
                                <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 5px;">
                                    ${trend.label}${trendData?.isProjected ? ' (Proj.)' : ''}
                                </div>
                                <div style="font-size: 1.1em; font-weight: bold;">
                                    ${trendData ? 
                                        (trendData.type === 'positive' ? '📈 +' : '📉 ') + 
                                        trendData.growth.toFixed(1) + '%' : 
                                        'N/A'}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <!-- Öneriler -->
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px;">
                    <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 10px;">💡 Analiz ve Öneri</div>
                    <div style="font-size: 1em; font-weight: 500;">
                        ${store.recommendations[0]?.title || 'Bilgi yok'}
                    </div>
                    <div style="font-size: 0.9em; opacity: 0.9; margin-top: 5px;">
                        ${store.recommendations[0]?.description || 'Analiz yapılamadı'}
                    </div>
                    ${yearlyTargets[selectedYear] && yearlyTargets[selectedYear][store.name] ? `
                        <div style="font-size: 0.9em; opacity: 0.9; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                            🎯 ${selectedYear} Hedefi: $${parseFloat(yearlyTargets[selectedYear][store.name]).toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    safeConsole.log('✅ Yıllık hedef analizi tamamlandı');
}

// Export fonksiyonları (ES6 modül formatı)
export {
    saveYearlyTarget,
    loadYearlyTarget,
    saveMonthlyTarget,
    loadMonthlyTarget,
    calculateTargets,
    renderTargetChart,
    renderYearlyTargetAnalysis,
    performYearlyTargetAnalysis,
    loadAllStoresTargets,
    populateTargetStoreDropdowns,
    getYearProgress
};

