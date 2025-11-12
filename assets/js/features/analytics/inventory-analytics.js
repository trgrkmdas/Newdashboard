/**
 * INVENTORY-ANALYTICS.JS - Envanter Analizi Modülü
 */

import { safeConsole } from '../../core/logger.js';

// Global değişkenlere erişim için helper fonksiyonlar
function getInventoryData() {
    return window.inventoryData || null;
}

function getAllData() {
    return window.allData || [];
}

function isDiscountProduct(item) {
    // window.isDiscountProduct varsa kullan, yoksa basit kontrol
    if (typeof window.isDiscountProduct === 'function') {
        return window.isDiscountProduct(item);
    }
    // Fallback kontrolü
    const product = (item.product || '').toLowerCase();
    return product.includes('indirim') || product.includes('discount');
}

export function filterStockAnalysis() {
    const inventoryData = getInventoryData();
    const allData = getAllData();
    
    if (!inventoryData || !inventoryData.inventory || inventoryData.inventory.length === 0 || !allData || allData.length === 0) {
        safeConsole.warn('⚠️ Envanter veya satış verisi yok!');
        document.getElementById('stockAnalysisTableContainer').innerHTML = '<p style="text-align: center; color: #f5576c; padding: 40px;">⚠️ Veri henüz yüklenmedi. Lütfen bekleyin...</p>';
        return;
    }
    
    safeConsole.log('🔍 Stok analizi filtreleniyor...');
    
    // Filtre değerlerini al
    const searchBrand = (document.getElementById('stockSearchBrand')?.value || '').toLowerCase().trim();
    const searchProduct = (document.getElementById('stockSearchProduct')?.value || '').toLowerCase().trim();
    const searchCat2 = (document.getElementById('stockSearchCat2')?.value || '').toLowerCase().trim();
    const searchCat3 = (document.getElementById('stockSearchCat3')?.value || '').toLowerCase().trim();
    const searchCat4 = (document.getElementById('stockSearchCat4')?.value || '').toLowerCase().trim();
    
    // Envanter verilerini filtrele
    let filtered = inventoryData.inventory.filter(item => {
        if (searchBrand && !(item.brand || '').toLowerCase().includes(searchBrand)) return false;
        
        // Ürün adı: product_name veya product alanını kontrol et
        const productName = item.product_name || item.product || '';
        if (searchProduct && !productName.toLowerCase().includes(searchProduct)) return false;
        
        // Kategoriler: tek bir string'de birleşik (örn: "All / Lifestyle / Kitap")
        const category = item.category || '';
        if (searchCat2 && !category.toLowerCase().includes(searchCat2)) return false;
        if (searchCat3 && !category.toLowerCase().includes(searchCat3)) return false;
        if (searchCat4 && !category.toLowerCase().includes(searchCat4)) return false;
        
        return true;
    });
    
    safeConsole.log(`📦 Filtrelenmiş envanter: ${filtered.length} ürün`);
    
    // Her ürün için mağaza bazlı stok ve satış analizi
    const storeAnalysis = {};
    
    filtered.forEach(invItem => {
        const store = invItem.location || 'Bilinmeyen';
        const product = invItem.product_name || invItem.product || '';
        const brand = invItem.brand || '';
        
        if (!storeAnalysis[store]) {
            storeAnalysis[store] = {};
        }
        
        const key = `${brand}_${product}`;
        if (!storeAnalysis[store][key]) {
            storeAnalysis[store][key] = {
                brand: brand,
                product: product,
                stock: 0,
                sales: 0,
                salesQty: 0
            };
        }
        
        storeAnalysis[store][key].stock += parseFloat(invItem.quantity) || 0;
    });
    
    // Satış verilerini ekle (son 12 ay)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    allData.forEach(saleItem => {
        const saleDate = new Date(saleItem.date);
        if (saleDate < twelveMonthsAgo) return;
        
        const store = saleItem.store || 'Bilinmeyen';
        const product = saleItem.product || '';
        const brand = saleItem.brand || '';
        const key = `${brand}_${product}`;
        
        if (storeAnalysis[store] && storeAnalysis[store][key]) {
            storeAnalysis[store][key].sales += parseFloat(saleItem.usd_amount) || 0;
            storeAnalysis[store][key].salesQty += parseFloat(saleItem.quantity) || 0;
        }
    });
    
    // AI: Önerilen stok ve satın alma hesapla
    Object.keys(storeAnalysis).forEach(store => {
        Object.keys(storeAnalysis[store]).forEach(key => {
            const item = storeAnalysis[store][key];
            
            // Aylık ortalama satış (son 12 ay)
            const monthlySales = item.salesQty / 12;
            
            // Önerilen stok: 2 aylık satış + %20 güvenlik marjı
            const recommendedStock = Math.ceil(monthlySales * 2 * 1.2);
            item.recommendedStock = recommendedStock;
            
            // Önerilen satın alma: Önerilen stok - Mevcut stok
            const purchaseNeed = Math.max(0, recommendedStock - item.stock);
            item.recommendedPurchase = Math.ceil(purchaseNeed);
        });
    });

// renderStockAnalysisTable
    // Tabloyu oluştur
    renderStockAnalysisTable(storeAnalysis);
}

export function renderStockAnalysisTable(storeAnalysis) {
    const container = document.getElementById('stockAnalysisTableContainer');
    if (!container) return;
    
    // Her mağaza için tablo
    let html = '';
    
    Object.entries(storeAnalysis).sort((a, b) => a[0].localeCompare(b[0])).forEach(([store, products]) => {
        const productList = Object.values(products);
        if (productList.length === 0) return;
        
        html += `
            <div style="margin-bottom: 40px;">
                <h4 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                    🏪 ${store} <span style="opacity: 0.8; font-size: 0.9em;">(${productList.length} ürün)</span>
                </h4>
                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background: #f8f9fa; text-align: left;">
                            <th style="padding: 12px; border-bottom: 2px solid #dee2e6;">Marka</th>
                            <th style="padding: 12px; border-bottom: 2px solid #dee2e6;">Ürün</th>
                            <th style="padding: 12px; border-bottom: 2px solid #dee2e6; text-align: right;">📦 Stok</th>
                            <th style="padding: 12px; border-bottom: 2px solid #dee2e6; text-align: right;">📊 Satış (12 Ay)</th>
                            <th style="padding: 12px; border-bottom: 2px solid #dee2e6; text-align: right;">🤖 Önerilen Stok</th>
                            <th style="padding: 12px; border-bottom: 2px solid #dee2e6; text-align: right;">🛒 Önerilen Satın Alma</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productList.map(item => {
                            const stockStatus = item.stock >= item.recommendedStock ? 'background: #d4edda;' : item.stock < item.recommendedStock * 0.5 ? 'background: #f8d7da;' : '';
                            return `
                                <tr style="${stockStatus}">
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${item.brand || '-'}</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${item.product || '-'}</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: bold;">${item.stock.toFixed(0)}</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right;">${item.salesQty.toFixed(0)} adet</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right; color: #667eea; font-weight: bold;">${item.recommendedStock}</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right; ${item.recommendedPurchase > 0 ? 'color: #f5576c; font-weight: bold;' : 'color: #38ef7d;'}">${item.recommendedPurchase > 0 ? item.recommendedPurchase : '✓ Yeterli'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });
    
    if (html === '') {
        html = '<p style="text-align: center; color: #666; padding: 40px;">Filtre kriterlerine uygun ürün bulunamadı.</p>';
    }

// clearStockFilters
    container.innerHTML = html;
    safeConsole.log('✅ Stok analiz tablosu oluşturuldu!');
}

export function clearStockFilters() {
    document.getElementById('stockSearchBrand').value = '';
    document.getElementById('stockSearchProduct').value = '';
    document.getElementById('stockSearchCat2').value = '';
    document.getElementById('stockSearchCat3').value = '';
    document.getElementById('stockSearchCat4').value = '';
}

// Güvenli element güncelleme fonksiyonu
export function safeUpdateElement(id, value, formatter = null) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = formatter ? formatter(value) : value;

// switchInventoryAnalysis
    }
}

// 📊 Envanter Analizi Fonksiyonları
export function switchInventoryAnalysis() {
    const analysisType = document.getElementById('inventoryAnalysisType').value;
    
    // Tüm görünümleri gizle
    document.getElementById('priceAnalysisView').style.display = 'none';
    document.getElementById('stockAnalysisView').style.display = 'none';
    document.getElementById('performanceView').style.display = 'none';
    document.getElementById('trendsView').style.display = 'none';
    document.getElementById('alertsView').style.display = 'none';
    
    // Seçilen görünümü göster
    switch(analysisType) {
        case 'price':
            document.getElementById('priceAnalysisView').style.display = 'block';
            performPriceAnalysis();
            break;
        case 'stock':
            document.getElementById('stockAnalysisView').style.display = 'block';
            performStockAnalysis();
            break;
        case 'performance':
            document.getElementById('performanceView').style.display = 'block';
            performPerformanceAnalysis();
            break;
        case 'trends':
            document.getElementById('trendsView').style.display = 'block';
            performTrendAnalysis();
            break;
        case 'alerts':
            document.getElementById('alertsView').style.display = 'block';

// performPriceAnalysis
            break;
    }
}

export function performPriceAnalysis() {
    safeConsole.log('💰 Fiyat Analizi başlatılıyor...');
    
    // Filtrelenmiş veriyi al
    const filteredData = getFilteredInventoryData();
    
    if (filteredData.length === 0) {
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    document.getElementById('inventoryResultsContainer').style.display = 'block';
    document.getElementById('inventoryNoResults').style.display = 'none';
    
    // Fiyat analizi hesaplamaları
    let totalDiscount = 0;
    let totalPriceDiff = 0;
    let priceVariance = 0;
    let validComparisons = 0;
    
    const priceData = [];
    
    filteredData.forEach(item => {
        const listPrice = parseFloat(item.list_price || 0);
        const salesPrice = parseFloat(item.usd_amount || 0) / parseFloat(item.quantity || 1);
        
        if (listPrice > 0 && salesPrice > 0) {
            const discount = ((listPrice - salesPrice) / listPrice) * 100;
            const priceDiff = listPrice - salesPrice;
            
            totalDiscount += discount;
            totalPriceDiff += priceDiff;
            priceVariance += Math.pow(discount, 2);
            validComparisons++;
            
            priceData.push({
                product: item.product,
                listPrice,
                salesPrice,
                discount,
                priceDiff
            });
        }
    });
    
    // Özet kartlarını güncelle
    const avgDiscount = validComparisons > 0 ? totalDiscount / validComparisons : 0;
    const variance = validComparisons > 0 ? priceVariance / validComparisons : 0;
    
    safeUpdateElement('avgDiscountRate', avgDiscount.toFixed(1) + '%');
    safeUpdateElement('priceVariance', '$' + variance.toFixed(2));
    safeUpdateElement('totalPriceDiff', '$' + totalPriceDiff.toFixed(2));
    
    // Grafikleri render et (placeholder fonksiyonlar)
    renderPriceComparisonChart(priceData);
    renderDiscountDistributionChart(priceData);
    renderPriceAnalysisTable(priceData);
}

/**
 * Placeholder grafik render fonksiyonları
 */
export function renderPriceComparisonChart(data) {
    safeConsole.log('📊 Fiyat karşılaştırma grafiği render ediliyor...', data.length);
}

export function renderDiscountDistributionChart(data) {
    safeConsole.log('📈 İndirim dağılım grafiği render ediliyor...', data.length);
}

export function renderPriceAnalysisTable(data) {
    safeConsole.log('📋 Fiyat analizi tablosu render ediliyor...', data.length);
}

export function performStockAnalysis() {
    safeConsole.log('📦 Stok vs Satış Analizi başlatılıyor...');
    
    const filteredData = getFilteredInventoryData();
    safeConsole.log(`📊 Eşleştirilmiş veri: ${filteredData.length} ürün`);
    
    if (filteredData.length === 0) {
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    document.getElementById('stockAnalysisView').style.display = 'block';
    document.getElementById('inventoryResultsContainer').style.display = 'block';
    document.getElementById('inventoryNoResults').style.display = 'none';
    
    // Toplam değerler
    let totalCurrentStock = 0;
    let totalSoldQuantity = 0;
    let totalSoldAmount = 0;
    let totalRemainingStock = 0;
    let totalOrderedQuantity = 0;
    let totalExpectedStock = 0;
    
    filteredData.forEach(item => {
        totalCurrentStock += parseFloat(item.current_stock || 0);
        totalSoldQuantity += parseFloat(item.sold_quantity || 0);
        totalSoldAmount += parseFloat(item.sold_amount || 0);
        totalRemainingStock += parseFloat(item.remaining_stock || 0);
        totalOrderedQuantity += parseFloat(item.ordered_quantity || 0);  // YENİ
        totalExpectedStock += parseFloat(item.total_expected || 0);  // YENİ
    });
    
    // Özet kartlarını güncelle
    safeUpdateElement('avgStockTurnover', totalSoldQuantity.toLocaleString('tr-TR', {minimumFractionDigits: 0}) + ' adet');
    safeUpdateElement('overstockCount', filteredData.length + ' ürün');
    safeUpdateElement('understockCount', totalOrderedQuantity.toLocaleString('tr-TR', {minimumFractionDigits: 0}) + ' adet');  // Bekleyen sipariş sayısı göster
    
    // Detaylı tablo göster
    renderStockSalesTable(filteredData);
    
    safeConsole.log('✅ Stok vs Satış analizi tamamlandı');
}

export function renderStockSalesTable(data) {
    const container = document.getElementById('stockAnalysisView');
    if (!container) return;
    
    // Tablo HTML'i oluştur
    let html = `
        <div style="background: white; border-radius: 15px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 30px;">
            <h4 style="margin-bottom: 20px;">📋 Ürün Bazında Stok vs Satış Detayları</h4>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #555;">Ürün Adı</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #555;">Marka</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #555;">Mevcut Stok</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #555;">Satılan Stok</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #555;">Verilen Sipariş</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #555;">Sipariş No</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #555;">Kalan Stok</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #555;">Toplam Beklenen</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #555;">Mağaza</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // İlk 100 ürünü göster
    const limitedData = data.slice(0, 100);
    limitedData.forEach((item, index) => {
        const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
        const remainingStock = item.remaining_stock;
        const stockColor = remainingStock < 0 ? '#ff6b6b' : remainingStock < 10 ? '#ffa500' : '#51cf66';
        
        const orderedQuantity = item.ordered_quantity || 0;
        const totalExpected = item.total_expected || remainingStock;
        const orderedColor = orderedQuantity > 0 ? '#ffa500' : '#999';
        const purchaseOrderNames = item.purchase_order_names || [];
        const purchaseOrderDisplay = purchaseOrderNames.length > 0 
            ? purchaseOrderNames.join(', ') 
            : '-';
        
        html += `
            <tr style="background: ${bgColor};">
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.product_name || 'Bilinmeyen'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.brand || 'Bilinmeyen'}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">${item.current_stock.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd; color: #667eea; font-weight: bold;">${item.sold_quantity.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd; color: ${orderedColor}; font-weight: bold;">${orderedQuantity.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 0.85em; color: #666;">${purchaseOrderDisplay}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd; color: ${stockColor}; font-weight: bold;">${remainingStock.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd; color: #51cf66; font-weight: bold;">${totalExpected.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.location || 'Bilinmeyen'}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
    `;
    
    if (data.length > 100) {
        html += `
            <p style="margin-top: 15px; text-align: center; color: #666; font-size: 0.9em;">
                ℹ️ İlk 100 ürün gösteriliyor (Toplam: ${data.length} ürün). Daha fazlası için filtreleri daraltabilirsiniz.
            </p>
        `;
    }
    
    html += `</div>`;
    
    // Mevcut içeriği güncelle veya ekle
    let tableContainer = container.querySelector('#stockSalesTableContainer');
    if (!tableContainer) {
        tableContainer = document.createElement('div');
        tableContainer.id = 'stockSalesTableContainer';
        container.appendChild(tableContainer);
    }
    tableContainer.innerHTML = html;
}

export function performPerformanceAnalysis() {
    safeConsole.log('🎯 Performans Analizi başlatılıyor...');
    
    const filteredData = getFilteredInventoryData();
    safeConsole.log(`📊 Filtrelenmiş veri: ${filteredData.length} ürün`);
    
    if (filteredData.length === 0) {
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    document.getElementById('inventoryResultsContainer').style.display = 'block';
    document.getElementById('inventoryNoResults').style.display = 'none';
    
    // Basit performans analizi - sadece ilk 50 ürün
    const limitedData = filteredData.slice(0, 50);
    safeConsole.log(`📦 Analiz edilecek ürün sayısı: ${limitedData.length}`);
    
    let totalValue = 0;
    let validItems = 0;
    
    limitedData.forEach(item => {
        const currentStock = parseFloat(item.quantity || 0);
        const listPrice = parseFloat(item.list_price || 0);
        
        if (currentStock > 0) {
            totalValue += currentStock * listPrice;
            validItems++;
        }
    });
    
    // Özet kartlarını güncelle
    const avgValue = validItems > 0 ? totalValue / validItems : 0;
    
    safeUpdateElement('avgPerformance', '$' + avgValue.toLocaleString('tr-TR', {minimumFractionDigits: 0, maximumFractionDigits: 0}));
    safeUpdateElement('totalPerformance', validItems + ' ürün');

// performTrendAnalysis
    
    safeConsole.log('✅ Performans analizi tamamlandı');
}

export function performTrendAnalysis() {
    safeConsole.log('📈 Trend Analizi başlatılıyor...');
    
    const filteredData = getFilteredInventoryData();
    safeConsole.log(`📊 Filtrelenmiş veri: ${filteredData.length} ürün`);
    
    if (filteredData.length === 0) {
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    document.getElementById('inventoryResultsContainer').style.display = 'block';
    document.getElementById('inventoryNoResults').style.display = 'none';
    
    // Basit trend analizi - sadece ilk 30 ürün
    const limitedData = filteredData.slice(0, 30);
    safeConsole.log(`📦 Analiz edilecek ürün sayısı: ${limitedData.length}`);
    
    let totalValue = 0;
    let validItems = 0;
    
    limitedData.forEach(item => {
        const currentStock = parseFloat(item.quantity || 0);
        const listPrice = parseFloat(item.list_price || 0);
        
        if (currentStock > 0) {
            totalValue += currentStock * listPrice;
            validItems++;
        }
    });
    
    // Özet kartlarını güncelle
    const avgValue = validItems > 0 ? totalValue / validItems : 0;
    
    safeUpdateElement('trendScore', Math.min(100, Math.round((validItems / 30) * 100)) + '%');
    safeUpdateElement('trendDirection', validItems > 15 ? 'Yükseliş' : 'Düşüş');

// performAlertAnalysis
    
    safeConsole.log('✅ Trend analizi tamamlandı');
}

export function performAlertAnalysis() {
    safeConsole.log('🚨 Uyarı Analizi başlatılıyor...');
    
    const filteredData = getFilteredInventoryData();
    safeConsole.log(`📊 Filtrelenmiş veri: ${filteredData.length} ürün`);
    
    if (filteredData.length === 0) {
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    document.getElementById('inventoryResultsContainer').style.display = 'block';
    document.getElementById('inventoryNoResults').style.display = 'none';
    
    // Basit uyarı analizi - sadece ilk 20 ürün
    const limitedData = filteredData.slice(0, 20);
    safeConsole.log(`📦 Analiz edilecek ürün sayısı: ${limitedData.length}`);
    
    let criticalAlerts = 0;
    let warningAlerts = 0;
    let infoAlerts = 0;
    
    limitedData.forEach(item => {
        const currentStock = parseFloat(item.quantity || 0);
        const listPrice = parseFloat(item.list_price || 0);
        
        if (currentStock === 0) {
            criticalAlerts++; // Stok yok
        } else if (currentStock < 5) {
            warningAlerts++; // Düşük stok
        } else {
            infoAlerts++; // Normal stok
        }
    });
    
    // Özet kartlarını güncelle
    safeUpdateElement('criticalAlerts', criticalAlerts + ' ürün');
    safeUpdateElement('warningAlerts', warningAlerts + ' ürün');

// performInventoryAnalysis
    safeConsole.log('✅ Uyarı analizi tamamlandı');
}

// Ana analiz fonksiyonu - Filtreleri uygular ve product_id bazlı eşleştirme yapar
export function performInventoryAnalysis() {
    safeConsole.log('📊 Envanter + Satış Analizi başlatılıyor...');
    
    // Filtreleri al
    const searchTerm = document.getElementById('inventoryProductSearchInput')?.value.trim() || '';
    const selectedCategory = document.getElementById('inventoryCategorySearch')?.value || '';
    const selectedStore = document.getElementById('inventoryStoreFilter')?.value || '';
    const dateStart = document.getElementById('inventoryDateStart')?.value || '';
    const dateEnd = document.getElementById('inventoryDateEnd')?.value || '';
    
    safeConsole.log('🔍 Filtreler:', {searchTerm, selectedCategory, selectedStore, dateStart, dateEnd});
    
    // Envanter verisi kontrolü (daha detaylı debug)
    if (!inventoryData) {
        safeConsole.warn('⚠️ Envanter verisi yok: inventoryData null/undefined');
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    if (!inventoryData.inventory) {
        safeConsole.warn('⚠️ Envanter verisi yok: inventoryData.inventory yok');
        safeConsole.log('📦 inventoryData yapısı:', Object.keys(inventoryData));
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    if (!Array.isArray(inventoryData.inventory) || inventoryData.inventory.length === 0) {
        safeConsole.warn(`⚠️ Envanter verisi boş: ${inventoryData.inventory?.length || 0} kayıt`);
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    safeConsole.log(`✅ Envanter verisi mevcut: ${inventoryData.inventory.length} kayıt`);
    
    // Envanter verilerini filtrele
    const searchLower = searchTerm.toLowerCase();
    let filteredInventory = inventoryData.inventory.filter(item => {
        // DEBUG: İlk birkaç item'ı logla
        if (inventoryData.inventory.indexOf(item) < 3) {
            safeConsole.log('🔍 Item örneği:', {
                product_id: item.product_id,
                product_name: item.product_name,
                brand: item.brand,
                category: item.category,
                location: item.location
            });
        }
        
        // Ürün/Marka arama (eğer searchTerm varsa)
        if (searchTerm) {
            const productName = (item.product_name || '').toLowerCase();
            const brand = (item.brand || '').toLowerCase();
            const productCode = (item.product_code || '').toLowerCase();
            
            const matchesSearch = productName.includes(searchLower) || 
                                 brand.includes(searchLower) || 
                                 productCode.includes(searchLower);
            
            if (!matchesSearch) {
                return false; // Arama terimi ile eşleşmiyor
            }
        }
        
        // Kategori filtresi (eğer selectedCategory varsa)
        if (selectedCategory) {
            const selectedLower = selectedCategory.toLowerCase();
            const itemCategory = (item.category || '').toLowerCase();
            
            // Hiyerarşik kategori kontrolü
            if (selectedCategory.includes(' > ')) {
                // Hiyerarşik yapıyı kontrol et
                const categoryParts = selectedCategory.split(' > ').map(c => c.trim().toLowerCase());
                const matchesCategory = categoryParts.some(part => itemCategory.includes(part));
                if (!matchesCategory) {
                    return false;
                }
            } else {
                // Basit arama - kategori string'i içinde ara
                if (!itemCategory.includes(selectedLower)) {
                    return false;
                }
            }
        }
        
        // Mağaza filtresi (eğer selectedStore varsa)
        if (selectedStore) {
            const itemStore = (item.location || '').toLowerCase();
            const selectedStoreLower = selectedStore.toLowerCase();
            if (!itemStore.includes(selectedStoreLower) && itemStore !== selectedStoreLower) {
                return false;
            }
        }
        
        return true; // Tüm filtrelerden geçti
    });
    
    safeConsole.log(`✅ Filtrelenmiş envanter: ${filteredInventory.length} ürün`);
    
    if (filteredInventory.length === 0) {
        document.getElementById('inventoryResultsContainer').style.display = 'none';
        document.getElementById('inventoryNoResults').style.display = 'block';
        return;
    }
    
    // Bekleyen siparişleri yükle (inventory.json.gz'den)
    const pendingOrdersMap = {};
    const pendingOrdersInfoMap = {};  // Sipariş numaraları için
    if (inventoryData && inventoryData.pending_orders && Array.isArray(inventoryData.pending_orders)) {
        inventoryData.pending_orders.forEach(order => {
            if (order.product_id) {
                pendingOrdersMap[order.product_id] = parseFloat(order.ordered_quantity || 0);
                pendingOrdersInfoMap[order.product_id] = {
                    quantity: parseFloat(order.ordered_quantity || 0),
                    purchase_order_names: order.purchase_order_names || []  // Sipariş numaraları listesi
                };
            }
        });
        safeConsole.log(`📦 ${inventoryData.pending_orders.length} ürün için bekleyen sipariş yüklendi`);
    }
    
    // PERFORMANS OPTİMİZASYONU: allData'yı product_id bazlı Map'e çevir
    const salesByProductId = new Map();
    if (allData && allData.length > 0) {
        // Önce allData'yı product_id bazlı grupla (tek seferde)
        allData.forEach(saleItem => {
            const productId = saleItem.product_id;
            // İadeleri ve indirim ürünlerini atla
            if (!productId || saleItem.is_refund || saleItem.move_type === 'out_refund' || isDiscountProduct(saleItem)) return;
            
            // Tarih filtresi
            if (dateStart && saleItem.date < dateStart) return;
            if (dateEnd && saleItem.date > dateEnd) return;
            
            // Mağaza filtresi (opsiyonel)
            if (selectedStore) {
                const saleStore = (saleItem.store || '').toLowerCase();
                if (!saleStore.includes(selectedStore.toLowerCase())) return;
            }
            
            // Map'e ekle veya güncelle
            if (!salesByProductId.has(productId)) {
                salesByProductId.set(productId, {
                    quantity: 0,
                    amount: 0
                });
            }
            
            const salesData = salesByProductId.get(productId);
            salesData.quantity += parseFloat(saleItem.quantity || 0);
            salesData.amount += parseFloat(saleItem.usd_amount || 0);
        });
    }
    
    safeConsole.log(`📊 Satış verisi hazırlandı: ${salesByProductId.size} ürün için satış verisi`);
    
    // product_id bazlı eşleştirme: Envanter, Satış ve Bekleyen Sipariş verilerini birleştir
    const matchedData = [];
    
    // Chunk processing ile performans iyileştirmesi
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < filteredInventory.length; i += chunkSize) {
        chunks.push(filteredInventory.slice(i, i + chunkSize));
    }
    
    safeConsole.log(`🔄 ${chunks.length} chunk'a bölündü (chunk size: ${chunkSize})`);
    
    // Her chunk'ı işle (non-blocking)
    let processedChunks = 0;
    function processChunk(chunkIndex) {
        if (chunkIndex >= chunks.length) {
            // Tüm chunk'lar işlendi, sonuçları göster
            safeConsole.log(`✅ Eşleştirilmiş veri: ${matchedData.length} ürün`);
            
            // Veriyi kaydet (analiz fonksiyonları için)
            window.lastInventoryMatchedData = matchedData;
            
            // Sonuçları göster
            document.getElementById('inventoryResultsContainer').style.display = 'block';
            document.getElementById('inventoryNoResults').style.display = 'none';
            
            // Analiz türüne göre görünümü göster
            switchInventoryAnalysis();
            return;
        }
        
        const chunk = chunks[chunkIndex];
        
        chunk.forEach(invItem => {
            const productId = invItem.product_id;
            if (!productId) return; // product_id yoksa atla
            
            // Mevcut stok (envanterden)
            let currentStock = parseFloat(invItem.quantity || 0);
            
            // Satılan stok (Map'ten hızlı lookup)
            const salesData = salesByProductId.get(productId);
            const soldQuantity = salesData ? salesData.quantity : 0;
            const soldAmount = salesData ? salesData.amount : 0;
            
            // Bekleyen sipariş (pending_orders'dan - product_id ile eşleştir)
            const orderedQuantity = pendingOrdersMap[productId] || 0;
            const pendingOrderInfo = pendingOrdersInfoMap[productId] || { quantity: 0, purchase_order_names: [] };
            const purchaseOrderNames = pendingOrderInfo.purchase_order_names || [];
            
            // Eşleştirilmiş veri
            matchedData.push({
                product_id: productId,
                product_name: invItem.product_name || 'Bilinmeyen',
                product_code: invItem.product_code || '',
                brand: invItem.brand || 'Bilinmeyen',
                category: invItem.category || 'Bilinmeyen',
                location: invItem.location || 'Bilinmeyen',
                current_stock: currentStock,
                sold_quantity: soldQuantity,
                sold_amount: soldAmount,
                ordered_quantity: orderedQuantity,  // Bekleyen sipariş miktarı
                purchase_order_names: purchaseOrderNames,  // Satın alma sipariş numaraları
                remaining_stock: currentStock - soldQuantity,
                total_expected: currentStock - soldQuantity + orderedQuantity,  // Toplam beklenen stok
                list_price: parseFloat(invItem.list_price || 0),
                cost_price: parseFloat(invItem.cost_price || 0),
                total_value: parseFloat(invItem.total_value || 0)
            });
        });
        
        processedChunks++;
        
        // Sonraki chunk'ı işle (non-blocking)
        if (chunkIndex < chunks.length - 1) {
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => processChunk(chunkIndex + 1), { timeout: 50 });
            } else {
                setTimeout(() => processChunk(chunkIndex + 1), 10);
            }
        } else {
            // Son chunk tamamlandı, sonuçları göster
            safeConsole.log(`✅ Eşleştirilmiş veri: ${matchedData.length} ürün`);
            
            // Veriyi kaydet (analiz fonksiyonları için)
            window.lastInventoryMatchedData = matchedData;
            
            // Sonuçları göster
            document.getElementById('inventoryResultsContainer').style.display = 'block';
            document.getElementById('inventoryNoResults').style.display = 'none';
            
            // Analiz türüne göre görünümü göster
            switchInventoryAnalysis();
        }
    }
    
    // İlk chunk'ı başlat
    if (chunks.length > 0) {
        processChunk(0);
    } else {
        // Chunk yoksa direkt sonuç göster

// getFilteredInventoryData
        document.getElementById('inventoryNoResults').style.display = 'block';
    }
}

export function getFilteredInventoryData() {
    // performInventoryAnalysis'den kaydedilmiş veriyi kullan
    if (window.lastInventoryMatchedData) {
        return window.lastInventoryMatchedData;
    }
    
    // Fallback: Eski yöntem (geriye uyumluluk için)
    safeConsole.log('🔍 getFilteredInventoryData başlatılıyor (fallback)...');
    
    const inventoryItems = inventoryData?.inventory || [];
    if (inventoryItems.length === 0) {
        return [];
    }
    
    // Basit filtreleme (fallback)
    return inventoryItems;
}

/**
 * Envanter filtre fonksiyonları
 */

/**
 * Envanter filtrelerini doldur
 */
export function populateInventoryFilters() {
    safeConsole.log('🔧 Envanter filtreleri dolduruluyor...');
    
    // Kategori filtreleri initialize et (Ürün Analizi ile aynı - tüm kategoriler)
    if (typeof window.initializeProductFilters === 'function') {
        window.initializeProductFilters();
    }
    
    // Mağaza dropdown'ını doldur (Ürün Analizi ile aynı yapı)
    const storeSet = new Set();
    const allData = window.allData || [];
    if (allData.length > 0) {
        allData.forEach(item => {
            if (item.store && item.store !== 'Analitik' && !item.store.toLowerCase().includes('eğitim')) {
                storeSet.add(item.store);
            }
        });
    }
    const storeFilter = document.getElementById('inventoryStoreFilter');
    if (storeFilter) {
        storeFilter.innerHTML = '<option value="">Tüm Mağazalar</option>';
        Array.from(storeSet).sort().forEach(store => {
            storeFilter.innerHTML += `<option value="${store}">${store}</option>`;
        });
    }
    
    safeConsole.log('✅ Envanter filtreleri dolduruldu');
}

/**
 * Envanter kategori dropdown'ını göster
 */
export function showInventoryCategoryDropdown() {
    filterInventoryCategories();
    const dropdown = document.getElementById('inventoryCategoryDropdown');
    if (dropdown) {
        dropdown.style.display = 'block';
    }
}

/**
 * Envanter kategori dropdown'ını gizle
 */
export function hideInventoryCategoryDropdown() {
    const dropdown = document.getElementById('inventoryCategoryDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

/**
 * Envanter kategorilerini filtrele
 */
export function filterInventoryCategories() {
    const searchValue = document.getElementById('inventoryCategorySearch')?.value.toLowerCase() || '';
    const dropdown = document.getElementById('inventoryCategoryDropdown');
    
    if (!dropdown || typeof window.allCategoriesHierarchical === 'undefined') {
        return;
    }
    
    // Hiyerarşik kategorilerde ara
    const filtered = window.allCategoriesHierarchical.filter(cat => 
        cat.toLowerCase().includes(searchValue)
    );
    
    dropdown.innerHTML = '';
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 15px; text-align: center; color: #666;">Kategori bulunamadı</div>';
    } else {
        filtered.slice(0, 100).forEach(cat => {
            const div = document.createElement('div');
            div.style.padding = '10px 15px';
            div.style.cursor = 'pointer';
            div.textContent = cat;
            div.onmouseenter = () => div.style.background = '#f0f0f0';
            div.onmouseleave = () => div.style.background = 'white';
            div.onclick = () => {
                const searchInput = document.getElementById('inventoryCategorySearch');
                if (searchInput) searchInput.value = cat;
                hideInventoryCategoryDropdown();
                if (typeof window.performInventoryAnalysis === 'function') {
                    window.performInventoryAnalysis();
                }
            };
            dropdown.appendChild(div);
        });
        if (filtered.length > 100) {
            const moreDiv = document.createElement('div');
            moreDiv.style.padding = '10px 15px';
            moreDiv.style.textAlign = 'center';
            moreDiv.style.color = '#666';
            moreDiv.textContent = `... ve ${filtered.length - 100} kategori daha`;
            dropdown.appendChild(moreDiv);
        }
    }
}

/**
 * Envanter tarih filtrelerini temizle
 */
export function clearInventoryDateFilters() {
    // Tüm filtreleri temizle
    const productSearchInput = document.getElementById('inventoryProductSearchInput');
    const categorySearch = document.getElementById('inventoryCategorySearch');
    const storeFilter = document.getElementById('inventoryStoreFilter');
    const dateStart = document.getElementById('inventoryDateStart');
    const dateEnd = document.getElementById('inventoryDateEnd');
    
    if (productSearchInput) productSearchInput.value = '';
    if (categorySearch) categorySearch.value = '';
    if (storeFilter) storeFilter.value = '';
    if (dateStart) dateStart.value = '';
    if (dateEnd) dateEnd.value = '';
    
    // Kategori dropdown'ını gizle
    const categoryDropdown = document.getElementById('inventoryCategoryDropdown');
    if (categoryDropdown) {
        categoryDropdown.style.display = 'none';
    }
    
    // Analizi yeniden çalıştır (tüm filtreler temizlendi)
    if (typeof window.performInventoryAnalysis === 'function') {
        window.performInventoryAnalysis();
    }
}

// Global erişim için window'a ekle
window.performInventoryAnalysis = performInventoryAnalysis;
window.getFilteredInventoryData = getFilteredInventoryData;
window.switchInventoryAnalysis = switchInventoryAnalysis;
window.performPriceAnalysis = performPriceAnalysis;
window.performStockAnalysis = performStockAnalysis;
window.performPerformanceAnalysis = performPerformanceAnalysis;
window.performTrendAnalysis = performTrendAnalysis;
window.performAlertAnalysis = performAlertAnalysis;
window.filterStockAnalysis = filterStockAnalysis;
window.renderStockAnalysisTable = renderStockAnalysisTable;
window.renderStockSalesTable = renderStockSalesTable;
window.clearStockFilters = clearStockFilters;
window.safeUpdateElement = safeUpdateElement;
window.renderPriceComparisonChart = renderPriceComparisonChart;
window.renderDiscountDistributionChart = renderDiscountDistributionChart;
window.renderPriceAnalysisTable = renderPriceAnalysisTable;
window.populateInventoryFilters = populateInventoryFilters;
window.showInventoryCategoryDropdown = showInventoryCategoryDropdown;
window.hideInventoryCategoryDropdown = hideInventoryCategoryDropdown;
window.filterInventoryCategories = filterInventoryCategories;
window.clearInventoryDateFilters = clearInventoryDateFilters;
