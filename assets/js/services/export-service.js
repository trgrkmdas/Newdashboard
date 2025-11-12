/**
 * EXPORT-SERVICE.JS - Excel Export Servisi
 */

import { safeConsole } from '../core/logger.js';

/**
 * Verileri Excel'e aktar
 * @param {Array} filteredData - Filtrelenmiş veri array'i
 * @param {Function} shouldHideItem - Item'ı gizlemeli mi kontrol fonksiyonu
 */
export function exportToExcel(filteredData, shouldHideItem) {
    if (filteredData.length === 0) {
        alert('⚠️ Dışa aktarılacak veri yok!');
        return;
    }
    
    safeConsole.log('📥 Excel export başlatılıyor...');
    
    // Veriyi Excel formatına dönüştür (Kategori kaydırılmış)
    const excelData = filteredData.map(item => ({
        'İş Ortağı': item.partner || '',
        'Ürün': item.product || '',
        'Marka': item.brand || '',
        'Kategori 1': item.category_2 || '', // category_2 -> Kategori 1
        'Kategori 2': item.category_3 || '', // category_3 -> Kategori 2
        'Kategori 3': item.category_4 || '', // category_4 -> Kategori 3
        'Satış Temsilcisi': item.sales_person || '',
        'Mağaza': item.store || '',
        'Şehir': item.city || '',
        'Tarih': item.date || '',
        'Miktar': parseFloat(item.quantity || 0),
        'USD (KDV Hariç)': parseFloat(item.usd_amount || 0)
    }));
    
    // Özet satırı ekle
    const summary = {
        'İş Ortağı': 'TOPLAM',
        'Ürün': '',
        'Marka': '',
        'Kategori 1': '',
        'Kategori 2': '',
        'Kategori 3': '',
        'Satış Temsilcisi': '',
        'Mağaza': '',
        'Şehir': '',
        'Tarih': '',
        'Miktar': filteredData.reduce((sum, item) => {
            if (shouldHideItem && shouldHideItem(item)) return sum;
            return sum + parseFloat(item.quantity || 0);
        }, 0),
        'USD (KDV Hariç)': filteredData.reduce((sum, item) => {
            if (shouldHideItem && shouldHideItem(item)) return sum;
            return sum + parseFloat(item.usd_amount || 0);
        }, 0)
    };
    excelData.push(summary);
    
    // Workbook oluştur
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Sütun genişliklerini ayarla
    ws['!cols'] = [
        {wch: 30}, // İş Ortağı
        {wch: 40}, // Ürün
        {wch: 15}, // Marka
        {wch: 20}, // Kategori 1
        {wch: 20}, // Kategori 2
        {wch: 20}, // Kategori 3
        {wch: 20}, // Satış Temsilcisi
        {wch: 30}, // Mağaza
        {wch: 15}, // Şehir
        {wch: 12}, // Tarih
        {wch: 12}, // Miktar
        {wch: 18}  // USD (KDV Hariç)
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Satış Verileri');
    
    // Dosya adı oluştur
    const today = new Date().toISOString().split('T')[0];
    const filename = `Satis_Analizi_${today}.xlsx`;
    
    // İndir
    XLSX.writeFile(wb, filename);
    
    safeConsole.log(`✅ Excel dosyası indirildi: ${filename}`);
    alert(`✅ ${filteredData.length} kayıt Excel'e aktarıldı!\nDosya: ${filename}`);
}

// Global erişim için (mevcut kod uyumluluğu)
window.exportToExcel = exportToExcel;

