/**
 * TABLE-RENDERER.JS - Tablo Render Modülü
 */

import { safeConsole } from '../core/logger.js';
import { renderTopCategoryChart, renderTopBrandChart, renderTopProductChart, renderTopSalesPersonChart } from '../charts/sales-charts.js';

/**
 * Top N değerleri al (optimize edilmiş sıralama)
 * @param {Object} data - Sıralanacak veri objesi
 * @param {number} n - Alınacak top N değer
 * @returns {Array} - Top N değerler array'i
 */
function getTopN(data, n) {
    const entries = [];
    // Object.entries() kullanımını optimize et
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            entries.push([key, data[key]]);
        }
    }
    // Sırala ve top N'i al
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, n);
}

/**
 * Tabloyu render et
 */
export function renderTable() {
    const container = document.getElementById('tableContainer');
    
    // tableContainer yoksa (Dashboard sekmesinde), çık
    if (!container) {
        return;
    }
    
    if (!window.filteredData || window.filteredData.length === 0) {
        container.innerHTML = '<div class="loading">⚠️ Filtreye uygun veri bulunamadı.</div>';
        return;
    }
    
    // Veriyi analiz et - OPTİMİZE EDİLMİŞ: forEach → for loop, tek iterate
    const categoryData = {};
    const brandData = {};
    const productData = {};
    const salesPersonData = {};
    
    // forEach yerine for loop kullan (daha hızlı)
    const dataLength = window.filteredData.length;
    for (let i = 0; i < dataLength; i++) {
        const item = window.filteredData[i];
        const amount = parseFloat(item.usd_amount || 0);
        
        // Kategori
        const cat = item.category_1 || 'Bilinmiyor';
        if (!categoryData[cat]) categoryData[cat] = 0;
        categoryData[cat] += amount;
        
        // Marka
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = 0;
        brandData[brand] += amount;
        
        // Ürün
        const product = item.product || 'Bilinmiyor';
        if (!productData[product]) productData[product] = 0;
        productData[product] += amount;
        
        // Satış Temsilcisi
        const person = item.sales_person || 'Bilinmiyor';
        if (!salesPersonData[person]) salesPersonData[person] = 0;
        salesPersonData[person] += amount;
    }
    
    // Top 10'ları al - OPTİMİZE EDİLMİŞ: getTopN helper fonksiyonu
    const topCategories = getTopN(categoryData, 10);
    const topBrands = getTopN(brandData, 10);
    const topProducts = getTopN(productData, 10);
    const topSalesPersons = getTopN(salesPersonData, 10);
    
    // HTML oluştur
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 30px; margin-top: 30px;">
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">🏆 En Başarılı Kategoriler</h3>
                <canvas id="topCategoryChart"></canvas>
            </div>
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">🏷️ En Çok Satan Markalar</h3>
                <canvas id="topBrandChart"></canvas>
            </div>
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">⭐ En Çok Satan Ürünler</h3>
                <canvas id="topProductChart"></canvas>
            </div>
            <div class="chart-container">
                <h3 style="text-align: center; margin-bottom: 20px;">👤 En Başarılı Satış Temsilcileri</h3>
                <canvas id="topSalesPersonChart"></canvas>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Grafikleri render et
    setTimeout(() => {
        renderTopCategoryChart(topCategories);
        renderTopBrandChart(topBrands);
        renderTopProductChart(topProducts);
        renderTopSalesPersonChart(topSalesPersons);
    }, 100);
}

// Global erişim için
window.renderTable = renderTable;

