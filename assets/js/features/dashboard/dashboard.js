/**
 * DASHBOARD.JS - Dashboard Ana Modülü
 */

import { safeConsole } from '../../core/logger.js';
import { shouldHideItem } from '../../data/data-processor.js';
import {
    renderDashYearlyChart,
    renderDashTopStoresChart,
    renderDashTopSalespeopleChart,
    renderDashTopBrandsChart,
    renderDashTopCategoriesChart,
    renderDashTopCitiesChart,
    renderDashTopProductsChart,
    clearYearlyChartCache,
    aggregateAllChartData
} from '../../charts/dashboard-charts.js';
import { performDashboardAIAnalysis } from '../ai/dashboard-ai-analyzer.js';

/**
 * Dashboard'u yükle ve render et
 */
export async function loadDashboard() {
    safeConsole.log('🏠 Dashboard yükleniyor...');
    
    if (!window.allData || window.allData.length === 0) {
        safeConsole.warn('⚠️ Veri yok, dashboard yüklenemedi');
        return;
    }
    
    // Chart cache'ini temizle (yeni veri yüklendiğinde)
    clearYearlyChartCache();
    
    // Genel istatistikler (optimize edilmiş - tek iterate'de tüm hesaplamalar)
    // İndirim ürünleri ve iadeler hesaplamalardan düşüyor
    let totalSales = 0;
    let totalQty = 0;
    let salesInvoicesTotal = 0; // PERFORMANS: Sepet ortalaması için satış faturalarının toplamı (ilk loop'ta hesaplanacak)
    const uniqueCustomersSet = new Set();
    const uniqueProductsSet = new Set();
    const uniqueStoresSet = new Set();
    const uniqueSalespeopleSet = new Set();
    const uniqueDatesSet = new Set();
    const invoiceKeysSet = new Set();
    
    // Tek iterate'de tüm istatistikleri hesapla (performans optimizasyonu)
    for (const item of window.allData) {
        if (shouldHideItem(item)) continue;
        
        // Toplam satış ve miktar
        const amt = parseFloat(item.usd_amount || 0);
        totalSales += amt;
        totalQty += parseFloat(item.quantity || 0);
        
        // Unique değerler
        if (item.partner) uniqueCustomersSet.add(item.partner);
        if (item.product) uniqueProductsSet.add(item.product);
        if (item.store) uniqueStoresSet.add(item.store);
        if (item.sales_person) uniqueSalespeopleSet.add(item.sales_person);
        if (item.date) uniqueDatesSet.add(item.date);
        
        // Invoice keys ve salesInvoicesTotal (sepet ortalaması için)
        // PERFORMANS OPTİMİZASYONU: salesInvoicesTotal'ı da burada hesapla (gereksiz ikinci iterate'i önle)
        // DÜZELTME: Sadece satış faturaları (iade değil) ve pozitif tutarlı
        if (amt > 0 && item.move_type !== 'out_refund' && (item.move_type === 'out_invoice' || !item.move_type)) {
            // Sepet ortalaması için satış faturalarının toplamını hesapla
            salesInvoicesTotal += amt;
            
            // DÜZELTME: Invoice key'ler sadece move_name veya move_id kullanmalı (product YOK)
            // Fallback'te product kullanmak yanlış - aynı faturadaki farklı ürünler farklı key oluşturur
            const invoiceKey = item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}`;
            if (invoiceKey) {
                invoiceKeysSet.add(invoiceKey);
            }
        }
    }
    
    const uniqueCustomers = uniqueCustomersSet.size;
    const uniqueProducts = uniqueProductsSet.size;
    const uniqueStores = uniqueStoresSet.size;
    const uniqueSalespeople = uniqueSalespeopleSet.size;
    const uniqueDates = uniqueDatesSet.size;
    const uniqueInvoices = invoiceKeysSet.size;
    
    // Günlük Ortalama ve Sepet Ortalaması Hesaplama (GLOBAL MANTIK - DİĞER SEKMELERLE AYNI)
    // Günlük Ortalama = Toplam USD / Benzersiz Tarih Sayısı (tüm zamanlar)
    const dailyAverage = uniqueDates > 0 ? totalSales / uniqueDates : 0;
    
    // Sepet Ortalaması = Sadece Satış Faturalarının Toplamı / Satış Fatura Sayısı (İadeler Hariç)
    // PERFORMANS OPTİMİZASYONU: salesInvoicesTotal artık ilk loop'ta hesaplanıyor (gereksiz ikinci iterate kaldırıldı)
    const basketAverage = uniqueInvoices > 0 ? salesInvoicesTotal / uniqueInvoices : 0;
    
    safeConsole.log('📅 Benzersiz Gün Sayısı (Tüm Zamanlar):', uniqueDates);
    safeConsole.log('💰 Toplam Satış:', totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2}));
    safeConsole.log('📦 Toplam Kayıt Sayısı:', window.allData.length.toLocaleString('tr-TR'));
    safeConsole.log('🧾 Toplam Fatura Sayısı:', uniqueInvoices.toLocaleString('tr-TR'));
    safeConsole.log('📊 Günlük Ortalama:', dailyAverage.toLocaleString('tr-TR', {minimumFractionDigits: 2}), '(Toplam Satış /', uniqueDates, 'gün)');
    safeConsole.log('🛒 Sepet Ortalaması:', basketAverage.toLocaleString('tr-TR', {minimumFractionDigits: 2}), '(Toplam Satış /', uniqueInvoices, 'fatura)');
    
    // Yıllık karşılaştırma (hemen render et)
    renderDashYearlyChart();
    
    // PERFORMANS OPTİMİZASYONU: Tüm chart verilerini tek bir pass'te topla
    // Bu, 6 ayrı chart için 6 ayrı full iteration yerine tek bir iteration yapar
    const aggregatedChartData = aggregateAllChartData(window.allData);
    
    // Top performanslar (TÜM ZAMANLAR) - optimize edilmiş batch rendering
    // Chart'ları sırayla render et (her biri arasında requestAnimationFrame ile mola)
    // Bu, main thread'i bloklamadan daha smooth bir deneyim sağlar
    
    // İlk chart'ı hemen render et (aggregated data ile)
    renderDashTopStoresChart(aggregatedChartData);
    
    // Diğer chart'ları sırayla render et (her biri arasında kısa bir mola)
    // requestAnimationFrame kullanarak browser'a render fırsatı ver
    await new Promise(resolve => requestAnimationFrame(resolve));
    renderDashTopSalespeopleChart(aggregatedChartData);
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    renderDashTopBrandsChart(aggregatedChartData);
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    renderDashTopCategoriesChart(aggregatedChartData);
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    renderDashTopCitiesChart(aggregatedChartData);
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    renderDashTopProductsChart(aggregatedChartData);
    
    // AI Analizi (non-blocking - requestIdleCallback ile)
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
            performDashboardAIAnalysis();
        }, { timeout: 500 });
    } else {
        setTimeout(() => {
            performDashboardAIAnalysis();
        }, 100);
    }
}

// Global erişim için
window.loadDashboard = loadDashboard;

