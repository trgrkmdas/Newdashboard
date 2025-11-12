/**
 * CUSTOMER-ANALYZER.JS - Müşteri Analizi Modülü
 */

import { safeConsole } from '../../core/logger.js';

// Chart instance'ları
let customerCityChart = null;
let customerTrendChart = null;
let customerBrandChartMainInstance = null;
let customerCategoryChartMainInstance = null;

// Sıralama için global değişkenler
let lastCustomerPurchaseData = null;
let currentCustomerPurchaseSortColumn = 'date';
let currentCustomerPurchaseSortDirection = 'desc';

// Global değişkenlere erişim için helper fonksiyonlar
function getAllData() {
    return window.allData || [];
}

/**
 * Müşteri analizi ana fonksiyonu
 */
export function analyzeCustomers() {
    const allData = getAllData();
    
    // Mağaza filtresi
    const selectedStore = document.getElementById('customerStoreFilter')?.value || '';
    
    // Müşteri verilerini analiz et (mağaza filtresi ile)
    const customerData = {};
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    allData.forEach(item => {
        // Mağaza filtresi kontrolü
        if (selectedStore && item.store !== selectedStore) {
            return;
        }
        
        const partner = item.partner;
        if (!partner) return;
        
        if (!customerData[partner]) {
            customerData[partner] = {
                name: partner,
                totalSales: 0,
                orderCount: 0,
                city: item.partner_city || 'Bilinmiyor', // İL bilgisi (state_id)
                lastOrderDate: item.date || ''
            };
        }
        
        customerData[partner].totalSales += parseFloat(item.usd_amount || 0);
        customerData[partner].orderCount += 1;
        
        if (item.date && item.date > customerData[partner].lastOrderDate) {
            customerData[partner].lastOrderDate = item.date;
        }
    });
    
    // Array'e çevir ve sırala
    const customers = Object.values(customerData).sort((a, b) => b.totalSales - a.totalSales);
    
    // İstatistikler
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => {
        if (!c.lastOrderDate) return false;
        const lastOrder = new Date(c.lastOrderDate);
        return lastOrder >= ninetyDaysAgo;
    }).length;
    
    const avgOrderValue = customers.reduce((sum, c) => sum + c.totalSales, 0) / totalCustomers;
    const maxOrderValue = customers.length > 0 ? customers[0].totalSales : 0;
    
    document.getElementById('totalCustomers').textContent = totalCustomers.toLocaleString('tr-TR');
    document.getElementById('activeCustomers').textContent = activeCustomers.toLocaleString('tr-TR');
    document.getElementById('avgOrderValue').textContent = '$' + avgOrderValue.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    document.getElementById('maxOrderValue').textContent = '$' + maxOrderValue.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    
    // Top 30 müşteri kartları (otomatik göster)
    renderTopCustomers(customers.slice(0, 30));
    
    // Grafikler
    renderCustomerCityChart(customers);
    renderCustomerTrendChart();
    
    // Mağaza filtresi dropdown'ını doldur (eğer boşsa)
    populateCustomerStoreFilter();
}

/**
 * Mağaza filtresini doldur
 */
export function populateCustomerStoreFilter() {
    const allData = getAllData();
    const storeFilter = document.getElementById('customerStoreFilter');
    if (!storeFilter) return;
    
    // Eğer zaten doldurulmuşsa, sadece seçili değeri koru
    if (storeFilter.options.length > 1) {
        return;
    }
    
    // Tüm mağazaları topla (Analitik ve Eğitim hariç)
    const storeSet = new Set();
    allData.forEach(item => {
        if (item.store && item.store !== 'Analitik' && !item.store.toLowerCase().includes('eğitim')) {
            storeSet.add(item.store);
        }
    });
    
    // Dropdown'ı doldur
    storeFilter.innerHTML = '<option value="">Tüm Mağazalar</option>';
    Array.from(storeSet).sort().forEach(store => {
        storeFilter.innerHTML += `<option value="${store}">${store}</option>`;
    });
}

/**
 * Top müşterileri render et
 */
export function renderTopCustomers(topCustomers) {
    const grid = document.getElementById('topCustomersGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    topCustomers.forEach((customer, index) => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span class="customer-rank">${index + 1}</span>
                <div style="flex: 1;">
                    <h4 style="margin: 0; font-size: 1.1em;">${customer.name}</h4>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 0.9em;">📍 ${customer.city}</p>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
                    <p style="margin: 0; font-size: 0.85em; color: #6c757d;">Toplam Satış</p>
                    <p style="margin: 5px 0 0 0; font-size: 1.2em; font-weight: 700; color: #667eea;">$${customer.totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
                </div>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
                    <p style="margin: 0; font-size: 0.85em; color: #6c757d;">Sipariş Sayısı</p>
                    <p style="margin: 5px 0 0 0; font-size: 1.2em; font-weight: 700; color: #764ba2;">${customer.orderCount}</p>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

/**
 * Müşteri şehir grafiğini render et
 */
export function renderCustomerCityChart(customers) {
    const ctx = document.getElementById('customerCityChart');
    if (!ctx) return;
    
    // Şehir bazında müşteri sayısı
    const cityData = {};
    customers.forEach(c => {
        const city = c.city || 'Bilinmiyor';
        cityData[city] = (cityData[city] || 0) + 1;
    });
    
    const sortedCities = Object.entries(cityData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    // Toplam müşteri sayısı (yüzde hesaplama için)
    const totalCustomers = sortedCities.reduce((sum, c) => sum + c[1], 0);
    
    if (customerCityChart) {
        customerCityChart.destroy();
    }
    
    // Legend'da gösterilecek etiketler: "Şehir Adı (Sayı - %)"
    const labelsWithStats = sortedCities.map(c => {
        const percentage = totalCustomers > 0 ? ((c[1] / totalCustomers) * 100).toFixed(1) : '0.0';
        return `${c[0]} (${c[1].toLocaleString('tr-TR')} - %${percentage})`;
    });
    
    customerCityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labelsWithStats,
            datasets: [{
                data: sortedCities.map(c => c[1]),
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(118, 75, 162, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(199, 199, 199, 0.8)',
                    'rgba(83, 102, 255, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                datalabels: {
                    display: false // Pastanın içinde yüzde gösterme
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            // Label zaten "Şehir Adı (Sayı - %Yüzde)" formatında, direkt döndür
                            return label;
                        }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * Müşteri trend grafiğini render et (Aylık)
 */
export function renderCustomerTrendChart() {
    const ctx = document.getElementById('customerTrendChart');
    if (!ctx) return;
    
    const allData = getAllData();
    
    // Mağaza filtresi
    const selectedStore = document.getElementById('customerStoreFilter')?.value || '';
    
    safeConsole.log('📊 Aylık Müşteri Trendi oluşturuluyor...', selectedStore ? `(Mağaza: ${selectedStore})` : '(Tümü)');
    
    // Aylara göre müşteri sayısı (mağaza filtresine göre)
    const monthlyCustomers = {};
    const months = new Set();
    
    // Ay isimleri
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    allData.forEach(item => {
        // Mağaza filtresi kontrolü
        if (selectedStore && item.store !== selectedStore) {
            return;
        }
        
        if (!item.date || !item.partner) return;
        
        // Partner'ı temizle ve kontrol et
        const partner = (item.partner || '').trim();
        if (!partner || partner === '') return;
        
        // Tarih formatı: YYYY-MM-DD (tutarlılık için >= 3 kontrolü)
        const dateParts = item.date.split('-');
        if (dateParts.length < 3) return;
        
        const year = dateParts[0];
        const month = dateParts[1];
        
        // Ay'ı 2 haneli yap (sıralama sorununu önlemek için)
        const normalizedMonth = month.padStart(2, '0');
        const monthKey = `${year}-${normalizedMonth}`; // "2023-01" formatı (her zaman 2 haneli)
        
        months.add(monthKey);
        if (!monthlyCustomers[monthKey]) {
            monthlyCustomers[monthKey] = new Set();
        }
        monthlyCustomers[monthKey].add(partner);
    });
    
    // Ayları tarih sırasına göre sırala
    const sortedMonths = Array.from(months).sort();
    
    // Label'ları formatla: "Ocak 2023", "Şubat 2023" gibi
    const monthLabels = sortedMonths.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthIndex = parseInt(month) - 1;
        // Güvenlik kontrolü: geçerli ay index'i (0-11)
        if (monthIndex < 0 || monthIndex >= 12) {
            safeConsole.warn(`⚠️ Geçersiz ay index: ${monthIndex} (monthKey: ${monthKey})`);
            return `${month} ${year}`; // Fallback: ay numarasını göster
        }
        return `${monthNames[monthIndex]} ${year}`;
    });
    
    const customerCounts = sortedMonths.map(monthKey => {
        // Güvenlik kontrolü: monthKey için Set var mı?
        if (!monthlyCustomers[monthKey]) {
            safeConsole.warn(`⚠️ monthKey için Set bulunamadı: ${monthKey}`);
            return 0;
        }
        return monthlyCustomers[monthKey].size;
    });
    
    safeConsole.log('📊 Aylar:', sortedMonths);
    safeConsole.log('📊 Müşteri sayıları:', customerCounts);
    
    // Boş veri kontrolü
    if (sortedMonths.length === 0) {
        safeConsole.warn('⚠️ Aylık müşteri trendi için veri bulunamadı');
        if (customerTrendChart) {
            customerTrendChart.destroy();
            customerTrendChart = null;
        }
        // Canvas'a bilgilendirici mesaj göster
        if (ctx) {
            const ctx2d = ctx.getContext('2d');
            const width = ctx.clientWidth || 400;
            const height = ctx.clientHeight || 200;
            ctx2d.clearRect(0, 0, width, height);
            ctx2d.fillStyle = '#6c757d';
            ctx2d.font = '16px Arial';
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'middle';
            ctx2d.fillText('Veri bulunamadı', width / 2, height / 2);
        }
        return;
    }
    
    if (customerTrendChart) {
        customerTrendChart.destroy();
    }
    
    // Renk paleti - gradient benzeri renkler
    const colors = [
        'rgba(102, 126, 234, 0.8)',   // Mor
        'rgba(250, 112, 154, 0.8)',   // Pembe
        'rgba(56, 239, 125, 0.8)',    // Yeşil
        'rgba(255, 193, 7, 0.8)',     // Sarı
        'rgba(245, 87, 108, 0.8)',    // Kırmızı
        'rgba(72, 219, 251, 0.8)',    // Turkuaz
        'rgba(118, 75, 162, 0.8)',    // Mor
        'rgba(240, 147, 251, 0.8)'    // Açık Pembe
    ];
    
    customerTrendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Aktif Müşteri Sayısı',
                data: customerCounts,
                backgroundColor: sortedMonths.map((month, idx) => colors[idx % colors.length]),
                borderColor: sortedMonths.map((month, idx) => colors[idx % colors.length].replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 8,
                barThickness: 'flex',
                maxBarThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 3,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Müşteri: ' + context.parsed.y.toLocaleString('tr-TR');
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('tr-TR');
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        },
        plugins: [ChartDataLabels]
    });
    
    safeConsole.log('✅ Aylık Müşteri Trendi grafiği oluşturuldu');
}

/**
 * Müşteri profili arama
 */
export function searchCustomerProfileMain() {
    const allData = getAllData();
    const searchQuery = document.getElementById('customerSearchInputMain').value.trim().toLowerCase();
    
    if (!searchQuery) {
        alert('Lütfen bir müşteri adı girin');
        return;
    }
    
    safeConsole.log('🔍 Müşteri aranıyor:', searchQuery);
    
    // Müşteri verilerini filtrele (fuzzy matching)
    const customerData = allData.filter(item => 
        item.partner && item.partner.toLowerCase().includes(searchQuery)
    );
    
    if (customerData.length === 0) {
        document.getElementById('customerProfileMainContainer').style.display = 'none';
        alert('Müşteri bulunamadı. Lütfen farklı bir isim deneyin.');
        return;
    }
    
    // Sonuçları göster ve Top 30 + Grafikleri gizle
    document.getElementById('customerProfileMainContainer').style.display = 'block';
    document.getElementById('topCustomersSection').style.display = 'none';
    document.getElementById('customerChartsSection').style.display = 'none';
    
    // Müşteri bilgilerini hesapla
    const customerName = customerData[0].partner;
    const customerCity = customerData[0].partner_city || 'Bilinmiyor'; // İL bilgisi (state_id)
    const customerTags = customerData[0].tags || '-';
    
    const totalSales = customerData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const totalQty = customerData.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const uniqueDates = new Set(customerData.map(item => item.date));
    const transactionCount = uniqueDates.size;
    const avgBasket = totalSales / Math.max(transactionCount, 1);
    
    // Payment verilerinden müşteri ödeme bilgilerini çek (partner_id eşleştirmesi)
    let topCardFamily = '-';
    let topInstallment = '-';
    
    if (window.paymentData && window.paymentData.transactions && window.paymentData.transactions.length > 0) {
        // Müşterinin partner_id'sini bul (allData'dan)
        const customerPartnerId = customerData[0].partner_id;
        
        safeConsole.log(`🔍 Müşteri ödeme bilgileri aranıyor - Partner ID: ${customerPartnerId}`);
        
        if (customerPartnerId) {
            // Payment verilerinde bu partner_id'yi ara
            const customerPayments = window.paymentData.transactions.filter(transaction => {
                const partner = transaction.partner_id;
                const transactionPartnerId = partner && typeof partner === 'object' ? partner[0] : partner;
                return transactionPartnerId === customerPartnerId;
            });
            
            safeConsole.log(`✅ Müşteri için ${customerPayments.length} ödeme işlemi bulundu`);
            
            if (customerPayments.length > 0) {
                // En çok kullanılan kart programı
                const cardFamilyCounts = {};
                customerPayments.forEach(t => {
                    const cardFamily = t.jetcheckout_card_family;
                    if (cardFamily) {
                        cardFamilyCounts[cardFamily] = (cardFamilyCounts[cardFamily] || 0) + 1;
                    }
                });
                if (Object.keys(cardFamilyCounts).length > 0) {
                    topCardFamily = Object.entries(cardFamilyCounts).sort((a, b) => b[1] - a[1])[0][0];
                    safeConsole.log(`💳 En çok kullanılan kart: ${topCardFamily}`);
                }
                
                // En çok kullanılan taksit
                const installmentCounts = {};
                customerPayments.forEach(t => {
                    const installment = t.jetcheckout_installment_description_long;
                    if (installment) {
                        installmentCounts[installment] = (installmentCounts[installment] || 0) + 1;
                    }
                });
                if (Object.keys(installmentCounts).length > 0) {
                    topInstallment = Object.entries(installmentCounts).sort((a, b) => b[1] - a[1])[0][0];
                    safeConsole.log(`📅 En çok kullanılan taksit: ${topInstallment}`);
                }
            } else {
                safeConsole.warn(`⚠️ Müşteri için ödeme işlemi bulunamadı (Partner ID: ${customerPartnerId})`);
            }
        } else {
            safeConsole.warn(`⚠️ Müşteri partner_id bulunamadı`);
        }
    } else {
        safeConsole.warn(`⚠️ Ödeme verileri yüklenmemiş veya boş`);
    }
    
    // UI güncelle
    document.getElementById('customerNameMain').textContent = customerName;
    document.getElementById('customerCityMain').textContent = customerCity;
    document.getElementById('customerTagsMain').textContent = customerTags;
    document.getElementById('customerTotalSalesMain').textContent = '$' + totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    document.getElementById('customerTotalQtyMain').textContent = totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    document.getElementById('customerTransactionCountMain').textContent = transactionCount;
    document.getElementById('customerAvgBasketMain').textContent = '$' + avgBasket.toLocaleString('tr-TR', {minimumFractionDigits: 2});
    document.getElementById('customerTopCardFamilyMain').textContent = topCardFamily;
    document.getElementById('customerTopInstallmentMain').textContent = topInstallment;
    
    // Grafikleri render et
    renderCustomerBrandChartMain(customerData);
    renderCustomerCategoryChartMain(customerData);
    
    // Veriyi kaydet (sıralama için)
    lastCustomerPurchaseData = customerData;
    
    // Satın alma geçmişi tablosu
    renderCustomerPurchaseHistoryMain(customerData);
    
    // AI analiz
    performCustomerAIAnalysisMain(customerData, {
        name: customerName,
        city: customerCity,
        tags: customerTags,
        totalSales,
        totalQty,
        transactionCount,
        avgBasket
    });
    
    // Sonuçlara scroll
    document.getElementById('customerProfileMainContainer').scrollIntoView({behavior: 'smooth', block: 'start'});
}

/**
 * Müşteri aramasını temizle
 */
export function clearCustomerSearchMain() {
    // Input'u temizle
    document.getElementById('customerSearchInputMain').value = '';
    
    // Arama sonuçlarını gizle
    document.getElementById('customerProfileMainContainer').style.display = 'none';
    
    // Top 30 ve Grafikleri göster
    document.getElementById('topCustomersSection').style.display = 'block';
    document.getElementById('customerChartsSection').style.display = 'grid';
    
    safeConsole.log('✅ Müşteri araması temizlendi, Top 30 ve grafikler gösteriliyor');
}

/**
 * Müşteri marka grafiğini render et
 */
export function renderCustomerBrandChartMain(data) {
    const brandData = {};
    data.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = 0;
        brandData[brand] += parseFloat(item.usd_amount || 0);
    });
    
    const sorted = Object.entries(brandData).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(item => item[0]);
    const values = sorted.map(item => item[1]);
    
    const ctx = document.getElementById('customerBrandChartMain');
    if (!ctx) return;
    
    if (customerBrandChartMainInstance) {
        customerBrandChartMainInstance.destroy();
    }
    
    customerBrandChartMainInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: values,
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
                legend: {display: false}
            },
            scales: {
                x: {
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
 * Müşteri kategori grafiğini render et
 */
export function renderCustomerCategoryChartMain(data) {
    const categoryData = {};
    data.forEach(item => {
        const category = item.category_2 || item.category_1 || 'Bilinmiyor';
        if (!categoryData[category]) categoryData[category] = 0;
        categoryData[category] += parseFloat(item.usd_amount || 0);
    });
    
    const sorted = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(item => item[0]);
    const values = sorted.map(item => item[1]);
    
    const ctx = document.getElementById('customerCategoryChartMain');
    if (!ctx) return;
    
    if (customerCategoryChartMainInstance) {
        customerCategoryChartMainInstance.destroy();
    }
    
    customerCategoryChartMainInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satış (USD - KDV Hariç)',
                data: values,
                backgroundColor: 'rgba(56, 239, 125, 0.6)',
                borderColor: 'rgba(56, 239, 125, 1)',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {display: false}
            },
            scales: {
                x: {
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
 * Müşteri alışveriş geçmişini render et
 */
export function renderCustomerPurchaseHistoryMain(data = null, sortColumn = null, sortDirection = null) {
    // Eğer data null ise, mevcut veriyi kullan
    if (data === null && lastCustomerPurchaseData) {
        data = lastCustomerPurchaseData;
    }
    
    // İndirim ürünlerini filtrele (tablolarda gösterme)
    if (data) {
        data = data.filter(item => !item._isDiscount);
    }
    
    if (!data || data.length === 0) {
        const container = document.getElementById('customerPurchaseHistoryMain');
        if (container) {
            container.innerHTML = '<p style="text-align: center; padding: 20px;">Veri bulunamadı</p>';
        }
        return;
    }
    
    // Sıralama parametrelerini güncelle
    if (sortColumn !== null) {
        if (currentCustomerPurchaseSortColumn === sortColumn) {
            currentCustomerPurchaseSortDirection = currentCustomerPurchaseSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentCustomerPurchaseSortColumn = sortColumn;
            currentCustomerPurchaseSortDirection = sortColumn === 'date' ? 'desc' : 'asc';
        }
    }
    
    // Sıralama
    let sorted = [...data];
    
    if (currentCustomerPurchaseSortColumn === 'date') {
        sorted.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return currentCustomerPurchaseSortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        });
    } else if (currentCustomerPurchaseSortColumn === 'product') {
        sorted.sort((a, b) => {
            return currentCustomerPurchaseSortDirection === 'asc'
                ? (a.product || '').localeCompare(b.product || '', 'tr')
                : (b.product || '').localeCompare(a.product || '', 'tr');
        });
    } else if (currentCustomerPurchaseSortColumn === 'brand') {
        sorted.sort((a, b) => {
            return currentCustomerPurchaseSortDirection === 'asc'
                ? (a.brand || '').localeCompare(b.brand || '', 'tr')
                : (b.brand || '').localeCompare(a.brand || '', 'tr');
        });
    } else if (currentCustomerPurchaseSortColumn === 'quantity') {
        sorted.sort((a, b) => {
            return currentCustomerPurchaseSortDirection === 'asc'
                ? parseFloat(a.quantity || 0) - parseFloat(b.quantity || 0)
                : parseFloat(b.quantity || 0) - parseFloat(a.quantity || 0);
        });
    } else if (currentCustomerPurchaseSortColumn === 'amount') {
        sorted.sort((a, b) => {
            return currentCustomerPurchaseSortDirection === 'asc'
                ? parseFloat(a.usd_amount || 0) - parseFloat(b.usd_amount || 0)
                : parseFloat(b.usd_amount || 0) - parseFloat(a.usd_amount || 0);
        });
    } else if (currentCustomerPurchaseSortColumn === 'store') {
        sorted.sort((a, b) => {
            return currentCustomerPurchaseSortDirection === 'asc'
                ? (a.store || '').localeCompare(b.store || '', 'tr')
                : (b.store || '').localeCompare(a.store || '', 'tr');
        });
    }
    
    // Son 20 işlem
    sorted = sorted.slice(0, 20);
    
    const getSortIcon = (column) => {
        if (currentCustomerPurchaseSortColumn !== column) return '⇅';
        return currentCustomerPurchaseSortDirection === 'asc' ? '↑' : '↓';
    };
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <tr>
                    <th style="padding: 12px; text-align: left; cursor: pointer;" onclick="window.renderCustomerPurchaseHistoryMain(null, 'date')">
                        Tarih ${getSortIcon('date')}
                    </th>
                    <th style="padding: 12px; text-align: left; cursor: pointer;" onclick="window.renderCustomerPurchaseHistoryMain(null, 'product')">
                        Ürün ${getSortIcon('product')}
                    </th>
                    <th style="padding: 12px; text-align: left; cursor: pointer;" onclick="window.renderCustomerPurchaseHistoryMain(null, 'brand')">
                        Marka ${getSortIcon('brand')}
                    </th>
                    <th style="padding: 12px; text-align: right; cursor: pointer;" onclick="window.renderCustomerPurchaseHistoryMain(null, 'quantity')">
                        Adet ${getSortIcon('quantity')}
                    </th>
                    <th style="padding: 12px; text-align: right; cursor: pointer;" onclick="window.renderCustomerPurchaseHistoryMain(null, 'amount')">
                        Tutar ${getSortIcon('amount')}
                    </th>
                    <th style="padding: 12px; text-align: left; cursor: pointer;" onclick="window.renderCustomerPurchaseHistoryMain(null, 'store')">
                        Mağaza ${getSortIcon('store')}
                    </th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach((item, index) => {
        html += `
            <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background: #f8f9fa;' : ''}">
                <td style="padding: 10px;">${item.date}</td>
                <td style="padding: 10px;"><strong>${item.product}</strong></td>
                <td style="padding: 10px;">${item.brand}</td>
                <td style="padding: 10px; text-align: right;">${parseFloat(item.quantity || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 10px; text-align: right; color: #38ef7d; font-weight: bold;">$${parseFloat(item.usd_amount || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                <td style="padding: 10px;">${item.store}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    const container = document.getElementById('customerPurchaseHistoryMain');
    if (container) {
        container.innerHTML = html;
    }
}

/**
 * Müşteri AI analizi
 */
export function performCustomerAIAnalysisMain(data, profile) {
    safeConsole.log('🤖 Müşteri AI analizi başlatılıyor...', profile);
    
    // Veri analizi
    const brandData = {};
    const categoryData = {};
    const storeData = {};
    const monthlyData = {};
    
    data.forEach(item => {
        // Marka
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = {sales: 0, qty: 0, count: 0};
        brandData[brand].sales += parseFloat(item.usd_amount || 0);
        brandData[brand].qty += parseFloat(item.quantity || 0);
        brandData[brand].count += 1;
        
        // Kategori (category_2 öncelikli)
        const category = item.category_2 || item.category_1 || 'Bilinmiyor';
        if (!categoryData[category]) categoryData[category] = {sales: 0, qty: 0};
        categoryData[category].sales += parseFloat(item.usd_amount || 0);
        categoryData[category].qty += parseFloat(item.quantity || 0);
        
        // Mağaza
        const store = item.store || 'Bilinmiyor';
        if (!storeData[store]) storeData[store] = {sales: 0, count: 0};
        storeData[store].sales += parseFloat(item.usd_amount || 0);
        storeData[store].count += 1;
        
        // Aylık
        const month = item.date ? item.date.substring(0, 7) : 'Bilinmiyor';
        if (!monthlyData[month]) monthlyData[month] = 0;
        monthlyData[month] += parseFloat(item.usd_amount || 0);
    });
    
    // Top 3 listeler
    const topBrands = Object.entries(brandData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    const topCategories = Object.entries(categoryData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    const topStores = Object.entries(storeData).sort((a, b) => b[1].sales - a[1].sales).slice(0, 3);
    const monthlySales = Object.entries(monthlyData).sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 6);
    
    // En çok alınan ürün
    const productData = {};
    data.forEach(item => {
        const product = item.product || 'Bilinmiyor';
        if (!productData[product]) productData[product] = {qty: 0, sales: 0};
        productData[product].qty += parseFloat(item.quantity || 0);
        productData[product].sales += parseFloat(item.usd_amount || 0);
    });
    const topProduct = Object.entries(productData).sort((a, b) => b[1].qty - a[1].qty)[0];
    
    // AI İçgörüleri
    const insights = {
        positive: [],
        negative: [],
        neutral: [],
        recommendations: []
    };
    
    // Pozitif İçgörüler
    if (profile.totalSales > 10000) {
        insights.positive.push({
            title: '💎 VIP Müşteri',
            description: `${profile.name}, toplam $${profile.totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} alışveriş ile VIP müşteri kategorisinde. Bu müşteriye özel ilgi gösterilmeli.`
        });
    } else if (profile.totalSales > 5000) {
        insights.positive.push({
            title: '⭐ Değerli Müşteri',
            description: `${profile.name}, toplam $${profile.totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} alışveriş ile değerli müşteri kategorisinde.`
        });
    }
    
    if (profile.transactionCount > 10) {
        insights.positive.push({
            title: '🔄 Sadık Müşteri',
            description: `${profile.transactionCount} işlem ile düzenli alışveriş yapan sadık bir müşteri. Müşteri memnuniyeti yüksek.`
        });
    }
    
    if (profile.avgBasket > 1000) {
        insights.positive.push({
            title: '🛒 Yüksek Sepet Ortalaması',
            description: `Ortalama sepet tutarı $${profile.avgBasket.toLocaleString('tr-TR', {minimumFractionDigits: 2})}. Premium ürünlere ilgi gösteriyor.`
        });
    }
    
    if (topBrands.length > 0) {
        insights.positive.push({
            title: `🏷️ Favori Marka: ${topBrands[0][0]}`,
            description: `${topBrands[0][0]} markasından $${topBrands[0][1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} değerinde ${topBrands[0][1].count} adet ürün aldı. Bu markada yeni ürünler önerilmeli.`
        });
    }
    
    // Negatif İçgörüler / Dikkat Edilmesi Gerekenler
    if (profile.transactionCount < 3) {
        insights.negative.push({
            title: '⚠️ Yeni Müşteri',
            description: `Sadece ${profile.transactionCount} işlem gerçekleştirdi. Müşteri sadakati oluşturmak için özel kampanyalar sunulmalı.`
        });
    }
    
    if (profile.avgBasket < 500) {
        insights.negative.push({
            title: '📊 Düşük Sepet Ortalaması',
            description: `Ortalama sepet tutarı $${profile.avgBasket.toLocaleString('tr-TR', {minimumFractionDigits: 2})}. Cross-sell ve up-sell fırsatları değerlendirilmeli.`
        });
    }
    
    const lastPurchaseDate = data.length > 0 ? new Date(Math.max(...data.map(item => new Date(item.date)))) : null;
    if (lastPurchaseDate) {
        const daysSinceLastPurchase = Math.floor((new Date() - lastPurchaseDate) / (1000 * 60 * 60 * 24));
        if (daysSinceLastPurchase > 90) {
            insights.negative.push({
                title: '⏰ Uzun Süredir Alışveriş Yok',
                description: `Son alışverişten ${daysSinceLastPurchase} gün geçti. Müşteriyi geri kazanmak için hatırlatma kampanyası düzenlenebilir.`
            });
        }
    }
    
    // Nötr İçgörüler
    insights.neutral.push({
        title: '📍 Konum Bilgisi',
        description: `Müşteri ${profile.city} şehrinden alışveriş yapıyor. ${topStores.length > 0 ? `En çok ${topStores[0][0]} mağazasını tercih ediyor.` : ''}`
    });
    
    if (topCategories.length > 0) {
        insights.neutral.push({
            title: `📂 İlgi Alanı: ${topCategories[0][0]}`,
            description: `${topCategories[0][0]} kategorisinden $${topCategories[0][1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} değerinde alışveriş yaptı.`
        });
    }
    
    if (topProduct) {
        insights.neutral.push({
            title: `🎯 En Çok Aldığı Ürün`,
            description: `${topProduct[0]} ürününden ${topProduct[1].qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})} adet aldı.`
        });
    }
    
    // Öneriler
    if (topBrands.length > 1) {
        insights.recommendations.push({
            icon: '🎁',
            title: 'Çapraz Satış Fırsatı',
            description: `Müşteri ${topBrands.map(b => b[0]).join(', ')} markalarını tercih ediyor. Bu markaların yeni ürünleri ve aksesuarları önerilebilir.`
        });
    }
    
    if (profile.avgBasket > 500) {
        insights.recommendations.push({
            icon: '💳',
            title: 'Premium Ürün Önerisi',
            description: `Yüksek sepet ortalaması nedeniyle premium ve lüks ürünler önerilebilir. Özel koleksiyonlar sunulmalı.`
        });
    }
    
    if (profile.transactionCount > 5) {
        insights.recommendations.push({
            icon: '🎖️',
            title: 'Sadakat Programı',
            description: `Düzenli müşteri olduğu için sadakat programına dahil edilmeli. Özel indirimler ve erken erişim fırsatları sunulabilir.`
        });
    }
    
    if (topStores.length > 0) {
        insights.recommendations.push({
            icon: '🏪',
            title: 'Mağaza Bazlı Kampanya',
            description: `${topStores[0][0]} mağazasını sıklıkla tercih ediyor. Bu mağazada özel etkinlikler ve lansmanlar için davet gönderilebilir.`
        });
    }
    
    insights.recommendations.push({
        icon: '📧',
        title: 'Kişiselleştirilmiş İletişim',
        description: `${topCategories.length > 0 ? topCategories[0][0] : 'İlgi alanı'} kategorisindeki yeni ürünler hakkında e-posta veya SMS ile bilgilendirme yapılabilir.`
    });
    
    if (monthlySales.length > 0) {
        const avgMonthlySales = monthlySales.reduce((sum, item) => sum + item[1], 0) / monthlySales.length;
        insights.recommendations.push({
            icon: '📊',
            title: 'Alışveriş Tahmini',
            description: `Aylık ortalama $${avgMonthlySales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} alışveriş yapıyor. Gelecek ay için özel teklifler hazırlanabilir.`
        });
    }
    
    // HTML oluşturma
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
            <div class="analysis-section" style="margin-top: 30px;">
                <h3 style="color: white;">⚠️ Dikkat Edilmesi Gerekenler</h3>
                ${insights.negative.map(item => `
                    <div class="insight-item insight-negative" style="background: rgba(255, 107, 107, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #ff6b6b;">
                        <span class="insight-icon" style="font-size: 1.5em; margin-right: 10px;">⚠️</span>
                        <strong style="font-size: 1.1em;">${item.title}</strong><br>
                        <span style="opacity: 0.95; margin-top: 8px; display: block;">${item.description}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.neutral.length > 0 ? `
            <div class="analysis-section" style="margin-top: 30px;">
                <h3 style="color: white;">📊 Genel Bilgiler</h3>
                ${insights.neutral.map(item => `
                    <div class="insight-item insight-neutral" style="background: rgba(255, 255, 255, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid white;">
                        <span class="insight-icon" style="font-size: 1.5em; margin-right: 10px;">📊</span>
                        <strong style="font-size: 1.1em;">${item.title}</strong><br>
                        <span style="opacity: 0.95; margin-top: 8px; display: block;">${item.description}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.recommendations.length > 0 ? `
            <div class="analysis-section" style="margin-top: 30px;">
                <h3 style="color: white;">💡 Aksiyon Önerileri</h3>
                ${insights.recommendations.map(item => `
                    <div class="recommendation" style="background: rgba(255, 215, 0, 0.2); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #ffd700; display: flex; align-items: start; gap: 15px;">
                        <span class="recommendation-icon" style="font-size: 2em; flex-shrink: 0;">${item.icon}</span>
                        <div style="flex: 1;">
                            <strong style="font-size: 1.1em; display: block; margin-bottom: 5px;">${item.title}</strong>
                            <span style="opacity: 0.95;">${item.description}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    `;
    
    const panel = document.getElementById('customerAIAnalysisContentMain');
    if (panel) {
        panel.innerHTML = html;
    }
    const analysisPanel = document.getElementById('customerAIAnalysisPanelMain');
    if (analysisPanel) {
        analysisPanel.style.display = 'block';
    }
}

/**
 * Müşteri önerilerini göster
 */
export function showCustomerSuggestions(query) {
    const allData = getAllData();
    const suggestionsDiv = document.getElementById('customerSuggestions');
    if (!suggestionsDiv) return;
    
    // Virgülden sonraki son terimi al
    const terms = query.split(',');
    const lastTerm = terms[terms.length - 1].trim().toLowerCase();
    query = lastTerm;
    
    if (query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    if (!allData || allData.length === 0) {
        return;
    }
    
    // Benzersiz müşterileri bul
    const customerMap = {};
    allData.forEach(item => {
        const name = item.partner || '';
        if (name && name.toLowerCase().includes(query)) {
            if (!customerMap[name]) {
                customerMap[name] = {
                    name: name,
                    sales: 0,
                    count: 0
                };
            }
            customerMap[name].sales += parseFloat(item.usd_amount || 0);
            customerMap[name].count += 1;
        }
    });
    
    // Satışa göre sırala, ilk 10
    const customers = Object.values(customerMap)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);
    
    if (customers.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    let html = '';
    customers.forEach((customer, idx) => {
        html += `<div class="suggestion-item" data-index="${idx}" data-name="${customer.name}" 
            style="padding: 12px 20px; cursor: pointer; border-bottom: 1px solid #e0e0e0; transition: background 0.2s;"
            onmouseover="this.style.background='#f0f0ff'; window.customerSuggestionIndex=${idx};"
            onmouseout="this.style.background='white';"
            onclick="window.selectCustomerSuggestion('${customer.name.replace(/'/g, "\\'")}')">
            <strong>${customer.name}</strong>
            <span style="color: #667eea; margin-left: 10px; font-size: 0.9em;">
                $${customer.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} • ${customer.count} sipariş
            </span>
        </div>`;
    });
    
    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';
    window.customerSuggestionIndex = -1;
}

/**
 * Müşteri klavye event handler
 */
export function handleCustomerKeydown(event) {
    const suggestionsDiv = document.getElementById('customerSuggestions');
    if (!suggestionsDiv) return;
    
    const items = suggestionsDiv.querySelectorAll('.suggestion-item');
    
    if (items.length === 0) return;
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        window.customerSuggestionIndex = Math.min((window.customerSuggestionIndex || -1) + 1, items.length - 1);
        highlightCustomerSuggestion(items);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        window.customerSuggestionIndex = Math.max((window.customerSuggestionIndex || -1) - 1, 0);
        highlightCustomerSuggestion(items);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (window.customerSuggestionIndex >= 0 && items[window.customerSuggestionIndex]) {
            const name = items[window.customerSuggestionIndex].getAttribute('data-name');
            if (window.selectCustomerSuggestion) {
                window.selectCustomerSuggestion(name);
            }
        } else {
            searchCustomerProfileMain();
        }
    } else if (event.key === 'Escape') {
        suggestionsDiv.style.display = 'none';
    }
}

/**
 * Müşteri önerisini vurgula
 */
function highlightCustomerSuggestion(items) {
    items.forEach((item, idx) => {
        if (idx === (window.customerSuggestionIndex || -1)) {
            item.style.background = '#f0f0ff';
            item.scrollIntoView({block: 'nearest'});
        } else {
            item.style.background = 'white';
        }
    });
}

