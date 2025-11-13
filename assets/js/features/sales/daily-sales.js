/**
 * DAILY-SALES.JS - Günlük Satış Modülü
 */

import { safeConsole } from '../../core/logger.js';

// Global değişkenlere erişim için helper fonksiyonlar
function getAllData() {
    return window.allData || [];
}

/**
 * Mağaza filtresini doldur
 */
export function populateDailySalesStoreFilter() {
    const allData = getAllData();
    
    if (!allData || allData.length === 0) {
        safeConsole.warn('⚠️ Veri yok, mağaza listesi doldurulamıyor');
        return;
    }
    
    const stores = new Set();
    allData.forEach(item => {
        if (item.store && 
            item.store !== 'Analitik' && 
            !item.store.toLowerCase().includes('eğitim') &&
            item.store !== 'Genel') {
            stores.add(item.store);
        }
    });
    
    const storeFilter = document.getElementById('dailySalesStoreFilter');
    if (storeFilter) {
        const currentValue = storeFilter.value;
        storeFilter.innerHTML = '<option value="">Tüm Mağazalar</option>';
        Array.from(stores).sort().forEach(store => {
            const selected = store === currentValue ? 'selected' : '';
            storeFilter.innerHTML += `<option value="${store}" ${selected}>${store}</option>`;
        });
    }
}

/**
 * Tarih filtrelerini doldur
 */
export function populateDailySalesDateFilters() {
    const allData = getAllData();
    
    if (!allData || allData.length === 0) {
        safeConsole.warn('⚠️ Veri yok, tarih filtreleri doldurulamıyor');
        return;
    }
    
    // Son güncelleme tarihini al
    const lastUpdateEl = document.getElementById('lastUpdate');
    let defaultYear = '';
    let defaultMonth = '';
    let defaultDay = '';
    
    if (lastUpdateEl && lastUpdateEl.textContent && lastUpdateEl.textContent !== '-') {
        // Format: "2025-11-11 03:44:00" veya "2025-11-11"
        const lastUpdateText = lastUpdateEl.textContent.trim();
        const dateMatch = lastUpdateText.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            defaultYear = dateMatch[1];
            defaultMonth = dateMatch[2];
            defaultDay = dateMatch[3];
            safeConsole.log('📅 Son güncelleme tarihinden varsayılan tarih alındı:', { defaultYear, defaultMonth, defaultDay });
        }
    }
    
    // Yılları topla
    const years = new Set();
    allData.forEach(item => {
        if (item.date) {
            const year = item.date.substring(0, 4);
            if (year) years.add(year);
        }
    });
    
    const yearFilter = document.getElementById('dailySalesYearFilter');
    if (yearFilter) {
        // Eğer zaten bir değer seçili değilse, son güncelleme tarihini kullan
        const currentValue = yearFilter.value || defaultYear;
        yearFilter.innerHTML = '<option value="">Tüm Yıllar</option>';
        Array.from(years).sort().reverse().forEach(year => {
            const selected = year === currentValue ? 'selected' : '';
            yearFilter.innerHTML += `<option value="${year}" ${selected}>${year}</option>`;
        });
        // Eğer varsayılan değer seçildiyse, value'yu güncelle
        if (defaultYear && !yearFilter.value) {
            yearFilter.value = defaultYear;
        }
    }
    
    const monthFilter = document.getElementById('dailySalesMonthFilter');
    if (monthFilter) {
        // Eğer zaten bir değer seçili değilse, son güncelleme tarihini kullan
        const currentValue = monthFilter.value || defaultMonth;
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        monthFilter.innerHTML = '<option value="">Tüm Aylar</option>';
        for (let i = 1; i <= 12; i++) {
            const month = String(i).padStart(2, '0');
            const selected = month === currentValue ? 'selected' : '';
            monthFilter.innerHTML += `<option value="${month}" ${selected}>${monthNames[i - 1]}</option>`;
        }
        // Eğer varsayılan değer seçildiyse, value'yu güncelle
        if (defaultMonth && !monthFilter.value) {
            monthFilter.value = defaultMonth;
        }
    }
    
    // Günleri doldur (1-31)
    const dayFilter = document.getElementById('dailySalesDayFilter');
    if (dayFilter) {
        // Eğer zaten bir değer seçili değilse, son güncelleme tarihini kullan
        const currentValue = dayFilter.value || defaultDay;
        dayFilter.innerHTML = '<option value="">Tüm Günler</option>';
        for (let i = 1; i <= 31; i++) {
            const day = String(i).padStart(2, '0');
            const selected = day === currentValue ? 'selected' : '';
            dayFilter.innerHTML += `<option value="${day}" ${selected}>${day}</option>`;
        }
        // Eğer varsayılan değer seçildiyse, value'yu güncelle
        if (defaultDay && !dayFilter.value) {
            dayFilter.value = defaultDay;
        }
    }
}

/**
 * Günlük satış verilerini yükle
 */
export function loadDailySales() {
    const allData = getAllData();
    
    // Mağaza ve tarih filtrelerini doldur (veri yüklendikten sonra)
    if (allData && allData.length > 0) {
        populateDailySalesStoreFilter();
        populateDailySalesDateFilters();
    }
    
    if (!allData || allData.length === 0) {
        const container = document.getElementById('dailySalesTableContainer');
        if (container) {
            container.innerHTML = 
                '<p style="text-align: center; color: #f5576c; padding: 40px;">⚠️ Veriler henüz yüklenmedi. Lütfen bekleyin...</p>';
        }
        return;
    }
    
    safeConsole.log('📅 Günlük satış verileri yükleniyor...');
    
    // Filtreleri al
    const selectedStore = document.getElementById('dailySalesStoreFilter')?.value || '';
    const selectedYear = document.getElementById('dailySalesYearFilter')?.value || '';
    const selectedMonth = document.getElementById('dailySalesMonthFilter')?.value || '';
    const selectedDay = document.getElementById('dailySalesDayFilter')?.value || '';
    
    // Tarih belirleme: Eğer filtre yoksa en son tarihi kullan
    let targetDate = null;
    if (selectedYear || selectedMonth || selectedDay) {
        // Filtre varsa, filtrelere göre tarih oluştur
        if (selectedYear && selectedMonth && selectedDay) {
            targetDate = `${selectedYear}-${selectedMonth}-${selectedDay}`;
        } else if (selectedYear && selectedMonth) {
            // Ay seçilmişse, o ayın tüm günlerini göster
            targetDate = null; // Tüm günleri göster
        } else if (selectedYear) {
            // Sadece yıl seçilmişse, o yılın tüm günlerini göster
            targetDate = null; // Tüm günleri göster
        } else {
            // Sadece ay veya gün seçilmişse, en son yılı kullan
            const dates = allData.map(item => item.date).filter(Boolean).sort();
            const latestDate = dates[dates.length - 1];
            if (latestDate) {
                const year = latestDate.substring(0, 4);
                if (selectedMonth && selectedDay) {
                    targetDate = `${year}-${selectedMonth}-${selectedDay}`;
                } else if (selectedMonth) {
                    targetDate = null; // O ayın tüm günleri
                } else if (selectedDay) {
                    targetDate = null; // O günün tüm ayları (en son yıl)
                }
            }
        }
    } else {
        // Filtre yoksa en son tarihi kullan
        const dates = allData.map(item => item.date).filter(Boolean).sort();
        targetDate = dates[dates.length - 1];
    }
    
    // Eğer hiçbir tarih filtresi yoksa ve targetDate null ise, tüm verileri göster
    // (targetDate null olabilir çünkü ay veya yıl seçilmiş olabilir)
    if (!targetDate && !selectedYear && !selectedMonth && !selectedDay) {
        const dates = allData.map(item => item.date).filter(Boolean).sort();
        if (dates.length === 0) {
            const container = document.getElementById('dailySalesTableContainer');
            if (container) {
                container.innerHTML = 
                    '<p style="text-align: center; color: #f5576c; padding: 40px;">⚠️ Tarih bilgisi bulunamadı.</p>';
            }
            return;
        }
        // En son tarihi kullan
        targetDate = dates[dates.length - 1];
        safeConsole.log('📅 Tarih filtresi yok, en son tarih kullanılıyor:', targetDate);
    }
    
    safeConsole.log('📅 Seçilen tarih/filtreler:', { targetDate, selectedYear, selectedMonth, selectedDay });
    
    // Satışları filtrele
    // DÜZELTME: BRUT hesaplama (Dashboard ve diğer modüllerle tutarlılık için)
    // shouldHideItem ile iadeler ve indirim ürünleri filtreleniyor
    let dailyData = allData.filter(item => {
        // shouldHideItem kontrolü (iadeler ve indirim ürünleri filtreleniyor)
        if (typeof window.shouldHideItem === 'function' && window.shouldHideItem(item)) {
            return false;
        }
        
        // Tarih filtresi
        if (targetDate) {
            if (item.date !== targetDate) return false;
        } else {
            // Filtre var ama tam tarih yok
            if (selectedYear) {
                const itemYear = item.date ? item.date.substring(0, 4) : '';
                if (itemYear !== selectedYear) return false;
            }
            if (selectedMonth) {
                const itemMonth = item.date ? item.date.substring(5, 7) : '';
                if (itemMonth !== selectedMonth) return false;
            }
            if (selectedDay) {
                const itemDay = item.date ? item.date.substring(8, 10) : '';
                if (itemDay !== selectedDay) return false;
            }
        }
        
        // Mağaza filtresi
        if (selectedStore && item.store !== selectedStore) return false;
        
        return true;
    });
    
    if (dailyData.length === 0) {
        const dateInfo = targetDate || (selectedYear ? `${selectedYear}${selectedMonth ? '-' + selectedMonth : ''}${selectedDay ? '-' + selectedDay : ''}` : 'seçilen tarih');
        const container = document.getElementById('dailySalesTableContainer');
        if (container) {
            container.innerHTML = 
                `<p style="text-align: center; color: #6c757d; padding: 40px;">📅 ${dateInfo} için ${selectedStore ? selectedStore + ' mağazası ' : ''}satış verisi bulunamadı.</p>`;
        }
        safeConsole.warn(`⚠️ ${dateInfo} için satış verisi bulunamadı. Filtreler:`, { selectedStore, selectedYear, selectedMonth, selectedDay, targetDate });
        safeConsole.warn(`⚠️ Toplam veri sayısı: ${allData.length}, Filtrelenmiş veri sayısı: ${dailyData.length}`);
        return;
    }
    
    safeConsole.log(`✅ ${dailyData.length} satış kaydı bulundu`);
    
    // Ürün bazında grupla ve topla
    const productMap = {};
    dailyData.forEach(item => {
        const productKey = `${item.product || 'Bilinmiyor'}_${item.brand || 'Bilinmiyor'}_${item.category_2 || 'Bilinmiyor'}`;
        
        if (!productMap[productKey]) {
            productMap[productKey] = {
                product: item.product || 'Bilinmiyor',
                productCode: item.product_code || '',
                brand: item.brand || '-',
                category: item.category_2 || item.category_1 || '-',
                sales: 0,
                qty: 0,
                transactions: new Set()
            };
        }
        
        productMap[productKey].sales += parseFloat(item.usd_amount || 0);
        productMap[productKey].qty += parseFloat(item.quantity || 0);
        
        // Fatura numarası (işlem sayısı için)
        const invoiceId = item.move_name || item.move_id || '';
        if (invoiceId) {
            productMap[productKey].transactions.add(invoiceId);
        }
    });
    
    // Array'e çevir ve sırala (Satış USD'ye göre azalan)
    const productList = Object.values(productMap).map(item => {
        const transactionCount = item.transactions.size;
        
        return {
            product: item.product,
            productCode: item.productCode,
            brand: item.brand,
            category: item.category,
            sales: item.sales,
            qty: item.qty,
            transactionCount: transactionCount
        };
    }).sort((a, b) => b.sales - a.sales);
    
    // Global değişkene kaydet (sıralama için)
    window.dailySalesProductList = productList;
    window.dailySalesCurrentSort = { field: 'sales', direction: 'desc' };
    
    // Tarih bilgisini oluştur (gösterim için)
    const displayDate = targetDate || (selectedYear ? `${selectedYear}${selectedMonth ? '-' + selectedMonth : ''}${selectedDay ? '-' + selectedDay : ''}` : 'Tüm Tarihler');
    
    safeConsole.log('📊 Tablo render ediliyor:', { productListLength: productList.length, displayDate, selectedStore });
    
    // Tabloyu oluştur
    renderDailySalesTable(productList, displayDate, selectedStore);
}

/**
 * Günlük satış tablosunu render et
 */
export function renderDailySalesTable(productList, date, selectedStore) {
    const container = document.getElementById('dailySalesTableContainer');
    if (!container) {
        safeConsole.warn('⚠️ dailySalesTableContainer bulunamadı');
        return;
    }
    
    const totalSales = productList.reduce((sum, p) => sum + p.sales, 0);
    
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <!-- Tarih Kartı -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3); color: white; text-align: center; transition: transform 0.3s ease;">
                <div style="font-size: 2.5em; margin-bottom: 10px;">📅</div>
                <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Tarih</div>
                <div style="font-size: 1.4em; font-weight: 700; letter-spacing: 0.5px;">${date}</div>
            </div>
            
            <!-- Mağaza Kartı -->
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 20px rgba(245, 87, 108, 0.3); color: white; text-align: center; transition: transform 0.3s ease;">
                <div style="font-size: 2.5em; margin-bottom: 10px;">🏪</div>
                <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Mağaza</div>
                <div style="font-size: 1.2em; font-weight: 700; letter-spacing: 0.5px; word-break: break-word;">${selectedStore || 'Tüm Mağazalar'}</div>
            </div>
            
            <!-- Toplam Ürün Kartı -->
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 20px rgba(79, 172, 254, 0.3); color: white; text-align: center; transition: transform 0.3s ease;">
                <div style="font-size: 2.5em; margin-bottom: 10px;">📦</div>
                <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Toplam Ürün</div>
                <div style="font-size: 2em; font-weight: 800; letter-spacing: 1px;">${productList.length.toLocaleString('tr-TR')}</div>
            </div>
            
            <!-- Toplam Satış Kartı -->
            <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 20px rgba(67, 233, 123, 0.3); color: white; text-align: center; transition: transform 0.3s ease;">
                <div style="font-size: 2.5em; margin-bottom: 10px;">💰</div>
                <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Toplam Satış</div>
                <div style="font-size: 1.8em; font-weight: 800; letter-spacing: 0.5px;">$${totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border-radius: 15px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <tr>
                        <th style="padding: 15px; text-align: left; border-bottom: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600; font-size: 0.95em;">#</th>
                        <th style="padding: 15px; text-align: left; border-bottom: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600; font-size: 0.95em; cursor: pointer; transition: background 0.2s;" onclick="sortDailySalesTable('product')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">Ürün ⇅</th>
                        <th style="padding: 15px; text-align: left; border-bottom: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600; font-size: 0.95em; cursor: pointer; transition: background 0.2s;" onclick="sortDailySalesTable('brand')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">Marka ⇅</th>
                        <th style="padding: 15px; text-align: left; border-bottom: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600; font-size: 0.95em; cursor: pointer; transition: background 0.2s;" onclick="sortDailySalesTable('category')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">Kategori ⇅</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600; font-size: 0.95em; cursor: pointer; transition: background 0.2s;" onclick="sortDailySalesTable('sales')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">Satış (USD) ▼</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600; font-size: 0.95em; cursor: pointer; transition: background 0.2s;" onclick="sortDailySalesTable('qty')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">Miktar ⇅</th>
                        <th style="padding: 15px; text-align: right; border-bottom: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600; font-size: 0.95em; cursor: pointer; transition: background 0.2s;" onclick="sortDailySalesTable('transaction')" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">İşlem ⇅</th>
                    </tr>
                </thead>
                <tbody>
        `;
    
    productList.forEach((item, index) => {
        const rowBg = index % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'rgba(30, 41, 59, 0.3)';
        html += `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: ${rowBg}; transition: background 0.2s;" onmouseover="this.style.background='rgba(102, 126, 234, 0.2)'" onmouseout="this.style.background='${rowBg}'">
                <td style="padding: 15px; color: #e2e8f0; font-size: 0.95em;">${index + 1}</td>
                <td style="padding: 15px; color: #e2e8f0; font-size: 0.95em;">
                    <strong style="color: #10B981;">${item.productCode ? `[${item.productCode}]` : ''} ${item.product}</strong>
                </td>
                <td style="padding: 15px; color: #cbd5e1; font-size: 0.95em;">${item.brand}</td>
                <td style="padding: 15px; color: #cbd5e1; font-size: 0.95em;">${item.category}</td>
                <td style="padding: 15px; text-align: right; font-weight: bold; color: #38ef7d; font-size: 0.95em;">
                    $${item.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                </td>
                <td style="padding: 15px; text-align: right; color: #e2e8f0; font-size: 0.95em;">
                    ${item.qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                </td>
                <td style="padding: 15px; text-align: right; color: #e2e8f0; font-size: 0.95em;">
                    ${item.transactionCount}
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
    safeConsole.log(`✅ Günlük satış tablosu oluşturuldu: ${productList.length} ürün`);
}

/**
 * Günlük satış tablosunu sırala
 */
export function sortDailySalesTable(field) {
    const allData = getAllData();
    
    if (!window.dailySalesProductList || window.dailySalesProductList.length === 0) {
        safeConsole.warn('⚠️ Sıralama için veri yok');
        return;
    }
    
    const currentSort = window.dailySalesCurrentSort || { field: 'sales', direction: 'desc' };
    
    // Aynı alana tıklanırsa yönü değiştir
    let direction = 'asc';
    if (currentSort.field === field && currentSort.direction === 'asc') {
        direction = 'desc';
    }
    
    // Sırala
    const sortedList = [...window.dailySalesProductList].sort((a, b) => {
        let aVal, bVal;
        
        switch(field) {
            case 'product':
                aVal = (a.product || '').toLowerCase();
                bVal = (b.product || '').toLowerCase();
                break;
            case 'brand':
                aVal = (a.brand || '').toLowerCase();
                bVal = (b.brand || '').toLowerCase();
                break;
            case 'category':
                aVal = (a.category || '').toLowerCase();
                bVal = (b.category || '').toLowerCase();
                break;
            case 'sales':
                aVal = a.sales || 0;
                bVal = b.sales || 0;
                break;
            case 'qty':
                aVal = a.qty || 0;
                bVal = b.qty || 0;
                break;
            case 'transaction':
                aVal = a.transactionCount || 0;
                bVal = b.transactionCount || 0;
                break;
            default:
                return 0;
        }
        
        if (typeof aVal === 'string') {
            return direction === 'asc' 
                ? aVal.localeCompare(bVal, 'tr')
                : bVal.localeCompare(aVal, 'tr');
        } else {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });
    
    // Güncelle
    window.dailySalesProductList = sortedList;
    window.dailySalesCurrentSort = { field: field, direction: direction };
    
    // Tarih ve mağaza bilgisini al
    const selectedStore = document.getElementById('dailySalesStoreFilter')?.value || '';
    
    // En son tarihi bul
    const dates = allData.map(item => item.date).filter(Boolean).sort();
    const latestDate = dates[dates.length - 1] || '';
    
    // Tabloyu yeniden render et
    renderDailySalesTable(sortedList, latestDate, selectedStore);
}

/**
 * Günlük satış verilerini Excel'e aktar
 */
export function exportDailySalesToExcel() {
    if (!window.dailySalesProductList || window.dailySalesProductList.length === 0) {
        alert('⚠️ Dışa aktarılacak veri yok!');
        return;
    }
    
    safeConsole.log('📥 Günlük satış Excel export başlatılıyor...');
    
    // Veriyi Excel formatına dönüştür
    const excelData = window.dailySalesProductList.map((item, index) => ({
        '#': index + 1,
        'Ürün Kodu': item.productCode || '',
        'Ürün': item.product || '',
        'Marka': item.brand || '',
        'Kategori': item.category || '',
        'Satış (USD)': item.sales || 0,
        'Miktar': item.qty || 0,
        'İşlem Sayısı': item.transactionCount || 0
    }));
    
    // Özet satırı ekle
    const summary = {
        '#': '',
        'Ürün Kodu': 'TOPLAM',
        'Ürün': '',
        'Marka': '',
        'Kategori': '',
        'Satış (USD)': window.dailySalesProductList.reduce((sum, item) => sum + (item.sales || 0), 0),
        'Miktar': window.dailySalesProductList.reduce((sum, item) => sum + (item.qty || 0), 0),
        'İşlem Sayısı': window.dailySalesProductList.reduce((sum, item) => sum + (item.transactionCount || 0), 0)
    };
    excelData.push(summary);
    
    // Workbook oluştur
    if (typeof XLSX === 'undefined') {
        alert('⚠️ Excel export için SheetJS kütüphanesi yüklenmemiş!');
        return;
    }
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Sütun genişliklerini ayarla
    ws['!cols'] = [
        {wch: 5},  // #
        {wch: 15}, // Ürün Kodu
        {wch: 40}, // Ürün
        {wch: 15}, // Marka
        {wch: 20}, // Kategori
        {wch: 15}, // Satış (USD)
        {wch: 12}, // Miktar
        {wch: 15}  // İşlem Sayısı
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Günlük Satış');
    
    // Dosya adı oluştur
    const selectedStore = document.getElementById('dailySalesStoreFilter')?.value || 'TumMagazalar';
    const selectedYear = document.getElementById('dailySalesYearFilter')?.value || '';
    const selectedMonth = document.getElementById('dailySalesMonthFilter')?.value || '';
    const selectedDay = document.getElementById('dailySalesDayFilter')?.value || '';
    
    let filename = 'Gunluk_Satis';
    if (selectedYear) filename += `_${selectedYear}`;
    if (selectedMonth) filename += `_${selectedMonth}`;
    if (selectedDay) filename += `_${selectedDay}`;
    filename += `_${selectedStore.replace(/\s+/g, '_')}.xlsx`;
    
    // İndir
    XLSX.writeFile(wb, filename);
    
    safeConsole.log(`✅ Excel dosyası indirildi: ${filename}`);
    alert(`✅ ${window.dailySalesProductList.length} ürün Excel'e aktarıldı!\nDosya: ${filename}`);
}

