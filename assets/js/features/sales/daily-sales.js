/**
 * DAILY-SALES.JS - Günlük Satış Modülü
 */

import { safeConsole } from '../../core/logger.js';
import { isDiscountProduct } from '../../data/data-processor.js';

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
        const currentValue = yearFilter.value;
        yearFilter.innerHTML = '<option value="">Tüm Yıllar</option>';
        Array.from(years).sort().reverse().forEach(year => {
            const selected = year === currentValue ? 'selected' : '';
            yearFilter.innerHTML += `<option value="${year}" ${selected}>${year}</option>`;
        });
    }
    
    // Günleri doldur (1-31)
    const dayFilter = document.getElementById('dailySalesDayFilter');
    if (dayFilter) {
        const currentValue = dayFilter.value;
        dayFilter.innerHTML = '<option value="">Tüm Günler</option>';
        for (let i = 1; i <= 31; i++) {
            const day = String(i).padStart(2, '0');
            const selected = day === currentValue ? 'selected' : '';
            dayFilter.innerHTML += `<option value="${day}" ${selected}>${day}</option>`;
        }
    }
}

/**
 * Günlük satış verilerini yükle
 */
export function loadDailySales() {
    const allData = getAllData();
    
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
    
    if (!targetDate && !selectedYear && !selectedMonth && !selectedDay) {
        const container = document.getElementById('dailySalesTableContainer');
        if (container) {
            container.innerHTML = 
                '<p style="text-align: center; color: #f5576c; padding: 40px;">⚠️ Tarih bilgisi bulunamadı.</p>';
        }
        return;
    }
    
    safeConsole.log('📅 Seçilen tarih/filtreler:', { targetDate, selectedYear, selectedMonth, selectedDay });
    
    // Satışları filtrele
    let dailyData = allData.filter(item => {
        // İadeleri filtrele (görünür yapma - hesaplamalarda düşecek ama tablolarda gösterilmeyecek)
        if (item.move_type === 'out_refund' || item.is_refund) return false;
        
        // İndirim ürünlerini filtrele (görünür yapma - hesaplamalarda kullanılacak ama tablolarda gösterilmeyecek)
        if (isDiscountProduct(item)) return false;
        
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
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">#</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; cursor: pointer;" onclick="sortDailySalesTable('product')">Ürün ⇅</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; cursor: pointer;" onclick="sortDailySalesTable('brand')">Marka ⇅</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; cursor: pointer;" onclick="sortDailySalesTable('category')">Kategori ⇅</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd; cursor: pointer;" onclick="sortDailySalesTable('sales')">Satış (USD) ▼</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd; cursor: pointer;" onclick="sortDailySalesTable('qty')">Miktar ⇅</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd; cursor: pointer;" onclick="sortDailySalesTable('transaction')">İşlem ⇅</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    productList.forEach((item, index) => {
        html += `
            <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background: #f8f9fa;' : ''}">
                <td style="padding: 12px;">${index + 1}</td>
                <td style="padding: 12px;">
                    <strong>${item.productCode ? `[${item.productCode}]` : ''} ${item.product}</strong>
                </td>
                <td style="padding: 12px;">${item.brand}</td>
                <td style="padding: 12px;">${item.category}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #38ef7d;">
                    $${item.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                </td>
                <td style="padding: 12px; text-align: right;">
                    ${item.qty.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                </td>
                <td style="padding: 12px; text-align: right;">
                    ${item.transactionCount}
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
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

