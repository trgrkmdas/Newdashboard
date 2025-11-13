/**
 * SUMMARY-CARDS.JS - Özet Kartları Modülü
 */

import { safeConsole } from '../core/logger.js';

/**
 * Özet kartlarını güncelle
 */
export function updateSummary() {
    if (!window.filteredData || !window.allData) {
        safeConsole.warn('⚠️ Veri yok, özet güncellenemiyor');
        return;
    }
    
    // DÜZELTME: Veri hazır değilse veya çok az veri varsa bekle
    // İlk yüklemede filteredData henüz hazır olmayabilir
    if (window.allData.length === 0 || (window.filteredData.length === 0 && window.allData.length > 0)) {
        safeConsole.warn('⚠️ Veri henüz hazır değil, özet güncellenemiyor');
        return;
    }
    
    safeConsole.log('updateSummary - Filtrelenmiş veri sayısı:', window.filteredData.length);
    
    // Toplam kayıt sayısını güncelle
    const totalRecordsEl = document.getElementById('totalRecords');
    if (totalRecordsEl) {
        totalRecordsEl.textContent = window.allData.length.toLocaleString('tr-TR');
    }
    
    // DÜZELTME: BRUT hesaplama (Dashboard ve diğer modüllerle tutarlılık için)
    // İptal (cancel) ve taslak (draft) faturaları HARİÇ TUT
    // applyDiscountLogic zaten devre dışı (Odoo indirimleri zaten düşmüş)
    
    // Hesaplamalar için: allData'dan al, shouldHideItem ile filtrele (BRUT hesaplama)
    // NOT: filteredData'da iadeler ve indirim ürünleri zaten filtrelenmiş (görünmez)
    const allInvoicesForCalculation = window.allData.filter(item => {
        // state alanı varsa kontrol et
        if (item.state) {
            return item.state === 'posted'; // Sadece onaylanmış faturalar
        }
        // state alanı yoksa (geriye dönük uyumluluk) tümünü al
        return true;
    });
    
    // BRUT hesaplama: İadeler ve indirim ürünleri filtreleniyor (Dashboard ile tutarlı)
    // shouldHideItem ile iadeler ve indirim ürünleri çıkarılıyor
    const processedData = allInvoicesForCalculation.filter(item => {
        // shouldHideItem kontrolü (iadeler ve indirim ürünleri filtreleniyor)
        if (typeof window.shouldHideItem === 'function' && window.shouldHideItem(item)) {
            return false;
        }
        return true;
    });
    
    // BRUT hesapla: Sadece Satış (İadeler Hariç) - Dashboard ile tutarlı
    const totalUSD = processedData.reduce((sum, item) => {
        return sum + (parseFloat(item.usd_amount) || 0);
    }, 0);
    // BRUT hesaplama: processedData zaten shouldHideItem ile filtrelenmiş
    const totalQty = processedData.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    const uniquePartners = new Set(window.filteredData.map(item => item.partner)).size;
    const uniqueProducts = new Set(window.filteredData.map(item => item.product)).size;
    const uniqueStores = new Set(window.filteredData.map(item => item.store)).size;
    const uniqueSalespeople = new Set(window.filteredData.map(item => item.sales_person)).size;
    
    // Günlük ortalama hesapla (BRUT bazlı - Dashboard ile tutarlı)
    const uniqueDays = new Set(processedData.map(item => item.date)).size;
    const dailyAverage = uniqueDays > 0 ? totalUSD / uniqueDays : 0;
    
    // Sepet ortalaması ve fatura sayısı (sadece satış faturaları için)
    // DÜZELTME: Sadece satış faturalarının toplamını kullan (iade faturaları hariç)
    const salesInvoices = processedData.filter(item => {
        // Sadece satış faturaları (iade değil)
        if (item.move_type === 'out_refund') return false;
        // Pozitif tutarlı satışlar
        const amount = parseFloat(item.usd_amount || 0);
        return amount > 0 && (item.move_type === 'out_invoice' || !item.move_type);
    });
    
    // DÜZELTME: Invoice key'ler sadece move_name veya move_id kullanmalı
    // Fallback'te product kullanmak yanlış - aynı faturadaki farklı ürünler farklı key oluşturur
    const invoiceKeys = salesInvoices
        .map(item => {
            // Önce move_name, sonra move_id, sonra date-partner-store kombinasyonu (product YOK)
            return item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}`;
        })
        .filter(Boolean);
    const uniqueInvoices = new Set(invoiceKeys).size;
    
    // DÜZELTME: Pay (totalUSD) yerine sadece satış faturalarının toplamını kullan
    const salesInvoicesTotal = salesInvoices.reduce((sum, item) => {
        return sum + parseFloat(item.usd_amount || 0);
    }, 0);
    const basketAverage = uniqueInvoices > 0 ? salesInvoicesTotal / uniqueInvoices : 0;
    
    const refundCount = window.filteredData.filter(item => item.move_type === 'out_refund').length;
    const refundTotal = window.filteredData
        .filter(item => item.move_type === 'out_refund')
        .reduce((sum, item) => sum + Math.abs(parseFloat(item.usd_amount || 0)), 0);
    const salesTotal = window.filteredData
        .filter(item => item.move_type === 'out_invoice')
        .reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    
    // Debug: İptal ve taslak kontrolü
    const draftCount = window.filteredData.filter(item => item.state === 'draft').length;
    const cancelCount = window.filteredData.filter(item => item.state === 'cancel').length;
    const postedCount = window.filteredData.filter(item => item.state === 'posted').length;
    const noStateCount = window.filteredData.filter(item => !item.state).length;
    
    // Dashboard hesaplaması ile karşılaştırma
    const dashboardTotalSales = window.allData.reduce((sum, item) => {
        if (typeof window.shouldHideItem === 'function' && window.shouldHideItem(item)) return sum;
        return sum + parseFloat(item.usd_amount || 0);
    }, 0);
    
    safeConsole.log('Özet (BRUT - Dashboard ile tutarlı):', {
        totalUSD_BRUT: totalUSD,
        totalUSD_FORMATTED: '$' + totalUSD.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        dashboardTotalSales: dashboardTotalSales,
        dashboardTotalSales_FORMATTED: '$' + dashboardTotalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        fark: Math.abs(totalUSD - dashboardTotalSales),
        salesTotal: salesTotal,
        refundTotal: refundTotal,
        totalQty, 
        uniquePartners: new Set(processedData.map(item => item.partner)).size,
        uniqueProducts: new Set(processedData.map(item => item.product)).size,
        uniqueStores: new Set(processedData.map(item => item.store)).size,
        uniqueSalespeople: new Set(processedData.map(item => item.sales_person)).size,
        dailyAverage, 
        basketAverage,
        toplamKayit: processedData.length,
        allDataLength: window.allData.length,
        filteredDataLength: window.filteredData.length,
        satisKayitSayisi: window.filteredData.filter(item => item.move_type === 'out_invoice').length,
        iadeKayitSayisi: refundCount,
        stateKontrolu: {
            posted: postedCount,
            draft: draftCount,
            cancel: cancelCount,
            stateYok: noStateCount
        },
        indirimUrunSayisi: processedData.filter(item => typeof window.isDiscountProduct === 'function' && window.isDiscountProduct(item)).length,
        beklentiOdoo: '$39,171,668.53'
    });
    
    // Eski Sales sekmesi elementleri - null check
    const summaryUSD = document.getElementById('summaryUSD');
    const summaryQuantity = document.getElementById('summaryQuantity');
    const summaryPartners = document.getElementById('summaryPartners');
    const summaryProducts = document.getElementById('summaryProducts');
    
    if (summaryUSD) summaryUSD.textContent = '$' + totalUSD.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (summaryQuantity) summaryQuantity.textContent = totalQty.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (summaryPartners) summaryPartners.textContent = uniquePartners.toLocaleString('tr-TR');
    if (summaryProducts) summaryProducts.textContent = uniqueProducts.toLocaleString('tr-TR');
    
    // Dashboard özet kartları - null check
    const dashTotalSales = document.getElementById('dashTotalSales');
    const dashTotalQty = document.getElementById('dashTotalQty');
    const dashTotalCustomers = document.getElementById('dashTotalCustomers');
    const dashTotalProducts = document.getElementById('dashTotalProducts');
    const dashTotalStores = document.getElementById('dashTotalStores');
    const dashTotalSalespeople = document.getElementById('dashTotalSalespeople');
    const dashDailyAverage = document.getElementById('dashDailyAverage');
    const dashBasketAverage = document.getElementById('dashBasketAverage');
    const dashTotalInvoices = document.getElementById('dashTotalInvoices');
    
    // Dashboard kartları için seçili yılların verilerini kullan
    // DÜZELTME: BRUT hesaplama (Dashboard ile tutarlılık için)
    // İadeler ve indirim ürünleri filtreleniyor (shouldHideItem ile)
    const selectedYears = window.selectedYears || new Set();
    const selectedYearsArray = Array.from(selectedYears).map(y => y.toString());
    const dataForDashboard = window.allData.filter(item => {
        // shouldHideItem kontrolü (iadeler ve indirim ürünleri filtreleniyor)
        if (typeof window.shouldHideItem === 'function' && window.shouldHideItem(item)) {
            return false;
        }
        if (!item.date) return false;
        const year = item.date.split('-')[0];
        // Seçili yıllardan biriyse dahil et
        return selectedYearsArray.length === 0 || selectedYearsArray.includes(year);
    });
    
    // Başlığı güncelle
    const dashTotalSalesTitle = document.getElementById('dashTotalSalesTitle');
    if (dashTotalSalesTitle) {
        if (selectedYearsArray.length === 1) {
            dashTotalSalesTitle.textContent = `💰 ${selectedYearsArray[0]} Toplam Satış`;
        } else if (selectedYearsArray.length > 1) {
            const yearsText = selectedYearsArray.sort().join(', ');
            dashTotalSalesTitle.textContent = `💰 ${yearsText} Toplam Satış`;
        } else {
            dashTotalSalesTitle.textContent = '💰 Toplam Satış';
        }
    }
    
    // BRUT hesaplama: Sadece Satış (İadeler Hariç) - Dashboard ile tutarlı
    const totalSalesSelected = dataForDashboard.reduce((sum, item) => {
        return sum + (parseFloat(item.usd_amount) || 0);
    }, 0);
    
    // Dashboard için seçili yıllar miktar hesaplama (BRUT - dataForDashboard zaten shouldHideItem ile filtrelenmiş)
    const totalQtySelected = dataForDashboard.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    
    // Dashboard için seçili yıllar benzersiz sayılar (iadeler ve indirim ürünleri düşülmüş)
    const uniquePartnersSelected = new Set(dataForDashboard.map(item => item.partner).filter(Boolean)).size;
    const uniqueProductsSelected = new Set(dataForDashboard.filter(item => !(typeof window.isDiscountProduct === 'function' && window.isDiscountProduct(item))).map(item => item.product).filter(Boolean)).size;
    const uniqueStoresSelected = new Set(dataForDashboard.map(item => item.store).filter(Boolean)).size;
    const uniqueSalespeopleSelected = new Set(dataForDashboard.map(item => item.sales_person).filter(Boolean)).size;
    
    // Dashboard için seçili yıllar günlük ortalama
    const uniqueDaysSelected = new Set(dataForDashboard.map(item => item.date).filter(Boolean)).size;
    const dailyAverageSelected = uniqueDaysSelected > 0 ? totalSalesSelected / uniqueDaysSelected : 0;
    
    // Dashboard için seçili yıllar sepet ortalaması
    // DÜZELTME: Sadece satış faturalarının toplamını kullan (iade faturaları hariç)
    const salesInvoicesSelected = dataForDashboard.filter(item => {
        // Sadece satış faturaları (iade değil)
        if (item.move_type === 'out_refund') return false;
        // Pozitif tutarlı satışlar
        const amount = parseFloat(item.usd_amount || 0);
        return amount > 0 && (item.move_type === 'out_invoice' || !item.move_type);
    });
    
    // DÜZELTME: Invoice key'ler sadece move_name veya move_id kullanmalı (product YOK)
    const invoiceKeysSelected = salesInvoicesSelected
        .map(item => {
            return item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}`;
        })
        .filter(Boolean);
    const uniqueInvoicesSelected = new Set(invoiceKeysSelected).size;
    
    // DÜZELTME: Pay (totalSalesSelected) yerine sadece satış faturalarının toplamını kullan
    const salesInvoicesTotalSelected = salesInvoicesSelected.reduce((sum, item) => {
        return sum + parseFloat(item.usd_amount || 0);
    }, 0);
    const basketAverageSelected = uniqueInvoicesSelected > 0 ? salesInvoicesTotalSelected / uniqueInvoicesSelected : 0;
    
    if (dashTotalSales) dashTotalSales.textContent = '$' + totalSalesSelected.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    if (dashTotalQty) dashTotalQty.textContent = totalQtySelected.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    if (dashTotalCustomers) dashTotalCustomers.textContent = uniquePartnersSelected.toLocaleString('tr-TR');
    if (dashTotalProducts) dashTotalProducts.textContent = uniqueProductsSelected.toLocaleString('tr-TR');
    if (dashTotalStores) dashTotalStores.textContent = uniqueStoresSelected.toLocaleString('tr-TR');
    if (dashTotalSalespeople) dashTotalSalespeople.textContent = uniqueSalespeopleSelected.toLocaleString('tr-TR');
    if (dashDailyAverage) dashDailyAverage.textContent = '$' + dailyAverageSelected.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    if (dashBasketAverage) dashBasketAverage.textContent = '$' + basketAverageSelected.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    if (dashTotalInvoices) dashTotalInvoices.textContent = uniqueInvoicesSelected.toLocaleString('tr-TR');
    
    // AI Analiz yap
    if (window.filteredData.length > 0 && typeof window.performAIAnalysis === 'function') {
        window.performAIAnalysis();
    }
}

// Global erişim için
window.updateSummary = updateSummary;

