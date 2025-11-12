/**
 * DASHBOARD-AI-ANALYZER.JS - Dashboard AI Analiz Modülü
 */

import { safeConsole } from '../../core/logger.js';

export function performDashboardAIAnalysis() {
    safeConsole.log('🤖 Gelişmiş AI Analiz başlatılıyor...');
    
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const thisYearData = window.allData.filter(item => item.date && item.date.startsWith(currentYear.toString()));
    const lastYearData = window.allData.filter(item => item.date && item.date.startsWith(lastYear.toString()));
    
    // ========== VERİ GÜNCELLEME TARİHİ VE İVME HESAPLAMA ==========
    const allDates = window.allData.map(item => item.date).filter(d => d).sort();
    const latestDataDate = allDates[allDates.length - 1];
    const latestYear = latestDataDate ? latestDataDate.substring(0, 4) : currentYear;
    const latestMonth = latestDataDate ? latestDataDate.substring(5, 7) : '';
    const latestDay = latestDataDate ? latestDataDate.substring(8, 10) : '';
    
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const latestMonthName = latestMonth ? monthNames[parseInt(latestMonth) - 1] : '';
    const dataUpdateInfo = `${latestDay} ${latestMonthName} ${latestYear}`;
    
    safeConsole.log('📅 Son veri güncelleme tarihi:', dataUpdateInfo);
    
    // ========== YILLIK KARŞILAŞTIRMA (İVME BAZLI) ==========
    const totalSalesThisYear = thisYearData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const totalSalesLastYear = lastYearData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    
    // Bu yıl için geçen gün sayısını hesapla (veri güncelleme tarihine göre)
    const startOfYear = new Date(currentYear, 0, 1);
    const latestDate = new Date(latestDataDate);
    const daysPassedThisYear = Math.ceil((latestDate - startOfYear) / (1000 * 60 * 60 * 24));
    const daysRemainingThisYear = 365 - daysPassedThisYear;
    
    // Günlük ortalama ciro (bu yıl vs geçen yıl)
    const dailyAvgThisYear = daysPassedThisYear > 0 ? totalSalesThisYear / daysPassedThisYear : 0;
    const dailyAvgLastYear = totalSalesLastYear / 365;
    
    // Günlük ortalama bazında ivme
    const dailyGrowth = dailyAvgLastYear > 0 ? ((dailyAvgThisYear - dailyAvgLastYear) / dailyAvgLastYear * 100) : 0;
    
    // Yıl sonu projeksiyonu (mevcut günlük ortalama ile)
    const projectedYearEndSales = dailyAvgThisYear * 365;
    const projectedGrowth = totalSalesLastYear > 0 ? ((projectedYearEndSales - totalSalesLastYear) / totalSalesLastYear * 100) : 0;
    
    // Hedef hesaplama: 2024 seviyesine ulaşmak için kalan günlerde ne kadar gerekli
    const targetRemainingForLastYear = Math.max(0, totalSalesLastYear - totalSalesThisYear);
    const dailyTargetToMatchLastYear = daysRemainingThisYear > 0 ? targetRemainingForLastYear / daysRemainingThisYear : 0;
    
    // Basit karşılaştırma (yanıltıcı olabilir ama gösterelim)
    const yearGrowth = lastYearData.length > 0 ? ((totalSalesThisYear - totalSalesLastYear) / totalSalesLastYear * 100) : 0;
    
    // ========== MAĞAZA ANALİZİ ==========
    const storeData = {};
    const storeDataLastYear = {};
    thisYearData.forEach(item => {
        const store = item.store || 'Bilinmiyor';
        if (!storeData[store]) storeData[store] = 0;
        storeData[store] += parseFloat(item.usd_amount || 0);
    });
    lastYearData.forEach(item => {
        const store = item.store || 'Bilinmiyor';
        if (!storeDataLastYear[store]) storeDataLastYear[store] = 0;
        storeDataLastYear[store] += parseFloat(item.usd_amount || 0);
    });
    const sortedStores = Object.entries(storeData).sort((a, b) => b[1] - a[1]);
    const top10Stores = sortedStores.slice(0, 10);
    const weakStore = sortedStores[sortedStores.length - 1];
    
    // Mağaza ivme hesaplama
    const storeGrowth = sortedStores.map(([store, sales]) => {
        const lastYearSales = storeDataLastYear[store] || 0;
        const growth = lastYearSales > 0 ? ((sales - lastYearSales) / lastYearSales * 100) : 0;
        return { store, sales, growth };
    }).sort((a, b) => b.growth - a.growth);
    const fastestGrowingStore = storeGrowth[0];
    const slowestGrowingStore = storeGrowth[storeGrowth.length - 1];
    
    // ========== TEMSİLCİ ANALİZİ ==========
    const spData = {};
    const spDataLastYear = {};
    thisYearData.forEach(item => {
        const sp = item.sales_person || 'Bilinmiyor';
        if (!spData[sp]) spData[sp] = 0;
        spData[sp] += parseFloat(item.usd_amount || 0);
    });
    lastYearData.forEach(item => {
        const sp = item.sales_person || 'Bilinmiyor';
        if (!spDataLastYear[sp]) spDataLastYear[sp] = 0;
        spDataLastYear[sp] += parseFloat(item.usd_amount || 0);
    });
    const sortedSP = Object.entries(spData).sort((a, b) => b[1] - a[1]);
    const top10SP = sortedSP.slice(0, 10);
    
    // Temsilci ivme hesaplama
    const spGrowth = sortedSP.map(([sp, sales]) => {
        const lastYearSales = spDataLastYear[sp] || 0;
        const growth = lastYearSales > 0 ? ((sales - lastYearSales) / lastYearSales * 100) : 0;
        return { sp, sales, growth };
    }).sort((a, b) => b.growth - a.growth);
    
    // ========== MARKA ANALİZİ (TOP 10) ==========
    const brandData = {};
    const brandDataLastYear = {};
    thisYearData.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) brandData[brand] = 0;
        brandData[brand] += parseFloat(item.usd_amount || 0);
    });
    lastYearData.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandDataLastYear[brand]) brandDataLastYear[brand] = 0;
        brandDataLastYear[brand] += parseFloat(item.usd_amount || 0);
    });
    const sortedBrands = Object.entries(brandData).sort((a, b) => b[1] - a[1]);
    const top10Brands = sortedBrands.slice(0, 10);
    const brandConcentration10 = (top10Brands.reduce((sum, b) => sum + b[1], 0) / totalSalesThisYear * 100);
    
    // Marka ivme hesaplama
    const brandGrowth = sortedBrands.map(([brand, sales]) => {
        const lastYearSales = brandDataLastYear[brand] || 0;
        const growth = lastYearSales > 0 ? ((sales - lastYearSales) / lastYearSales * 100) : 0;
        return { brand, sales, growth };
    }).sort((a, b) => b.growth - a.growth);
    const fastestGrowingBrand = brandGrowth[0];
    const slowestGrowingBrand = brandGrowth[brandGrowth.length - 1];
    
    // ========== KATEGORİ ANALİZİ ==========
    const categoryData = {};
    const categoryDataLastYear = {};
    thisYearData.forEach(item => {
        const category = item.category_2 || 'Bilinmiyor';
        if (!categoryData[category]) categoryData[category] = 0;
        categoryData[category] += parseFloat(item.usd_amount || 0);
    });
    lastYearData.forEach(item => {
        const category = item.category_2 || 'Bilinmiyor';
        if (!categoryDataLastYear[category]) categoryDataLastYear[category] = 0;
        categoryDataLastYear[category] += parseFloat(item.usd_amount || 0);
    });
    const sortedCategories = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);
    const top10Categories = sortedCategories.slice(0, 10);
    
    // Kategori ivme hesaplama
    const categoryGrowth = sortedCategories.map(([category, sales]) => {
        const lastYearSales = categoryDataLastYear[category] || 0;
        const growth = lastYearSales > 0 ? ((sales - lastYearSales) / lastYearSales * 100) : 0;
        return { category, sales, growth };
    }).sort((a, b) => b.growth - a.growth);
    const fastestGrowingCategory = categoryGrowth[0];
    const slowestGrowingCategory = categoryGrowth[categoryGrowth.length - 1];
    
    // Aylık trend - GÜNLÜK ORTALAMA bazında karşılaştırma (ay henüz bitmemiş olabilir)
    const monthlyDataThisYear = {};
    const monthlyDataLastYear = {};
    const monthlyDaysThisYear = {};
    const monthlyDaysLastYear = {};
    
    thisYearData.forEach(item => {
        const month = item.date.substring(5, 7);
        const day = item.date.substring(8, 10);
        if (!monthlyDataThisYear[month]) {
            monthlyDataThisYear[month] = 0;
            monthlyDaysThisYear[month] = new Set();
        }
        monthlyDataThisYear[month] += parseFloat(item.usd_amount || 0);
        monthlyDaysThisYear[month].add(day);
    });
    
    lastYearData.forEach(item => {
        const month = item.date.substring(5, 7);
        const day = item.date.substring(8, 10);
        if (!monthlyDataLastYear[month]) {
            monthlyDataLastYear[month] = 0;
            monthlyDaysLastYear[month] = new Set();
        }
        monthlyDataLastYear[month] += parseFloat(item.usd_amount || 0);
        monthlyDaysLastYear[month].add(day);
    });
    
    const months = Object.keys(monthlyDataThisYear).sort();
    const lastMonth = months[months.length - 1];
    const lastMonthThisYear = monthlyDataThisYear[lastMonth] || 0;
    const lastMonthLastYear = monthlyDataLastYear[lastMonth] || 0;
    const daysThisYear = monthlyDaysThisYear[lastMonth] ? monthlyDaysThisYear[lastMonth].size : 1;
    const daysLastYear = monthlyDaysLastYear[lastMonth] ? monthlyDaysLastYear[lastMonth].size : 1;
    
    // GÜNLÜK ORTALAMA hesapla (AYLIK bazında)
    const dailyAvgThisMonth = lastMonthThisYear / daysThisYear;
    const dailyAvgLastMonth = lastMonthLastYear / daysLastYear;
    const monthGrowth = dailyAvgLastMonth > 0 ? ((dailyAvgThisMonth - dailyAvgLastMonth) / dailyAvgLastMonth * 100) : 0;
    
    // Ay tamamlanma durumu
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const isCurrentMonth = (lastMonth === currentMonth);
    const monthCompletionRate = isCurrentMonth ? ((currentDay / 30) * 100).toFixed(0) : 100;
    
    // ========== MÜŞTERİ ANALİZİ ==========
    const uniqueCustomers = new Set(thisYearData.map(item => item.partner)).size;
    
    // Sepet ortalaması için fatura sayısı (sağlamlaştırılmış - sadece satış faturaları)
    const invoiceKeysThisYear = thisYearData
        .filter(item => {
            const amt = parseFloat(item.usd_amount || 0);
            if (item.move_type) return item.move_type === 'out_invoice';
            return amt > 0;
        })
        .map(item => item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}-${item.product || ''}`)
        .filter(Boolean);
    const uniqueInvoices = new Set(invoiceKeysThisYear).size;
    const avgBasketValue = uniqueInvoices > 0 ? totalSalesThisYear / uniqueInvoices : 0;
    const avgCustomerValue = uniqueCustomers > 0 ? totalSalesThisYear / uniqueCustomers : 0;
    
    // Sepet ortalaması geçen yıl (sağlamlaştırılmış)
    const invoiceKeysLastYear = lastYearData
        .filter(item => {
            const amt = parseFloat(item.usd_amount || 0);
            if (item.move_type) return item.move_type === 'out_invoice';
            return amt > 0;
        })
        .map(item => item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}-${item.product || ''}`)
        .filter(Boolean);
    const uniqueInvoicesLastYear = new Set(invoiceKeysLastYear).size;
    const avgBasketValueLastYear = uniqueInvoicesLastYear > 0 ? totalSalesLastYear / uniqueInvoicesLastYear : 0;
    const basketGrowth = avgBasketValueLastYear > 0 ? ((avgBasketValue - avgBasketValueLastYear) / avgBasketValueLastYear * 100) : 0;
    
    const lastMonthName = monthNames[parseInt(lastMonth) - 1];
    
    // ========== GELİŞMİŞ AI ANALİZ HTML ÇIKTISI ==========
    safeConsole.log('📊 Veri güncelleme:', dataUpdateInfo);
    safeConsole.log(`⏱️ ${currentYear}: ${daysPassedThisYear} gün geçti, ${daysRemainingThisYear} gün kaldı`);
    safeConsole.log('📊 Günlük ortalama:', dailyAvgLastYear.toFixed(0), '→', dailyAvgThisYear.toFixed(0), `(${dailyGrowth > 0 ? '+' : ''}${dailyGrowth.toFixed(1)}%)`);
    safeConsole.log('🎯 Yıl sonu tahmini:', projectedYearEndSales.toFixed(0), `(${projectedGrowth > 0 ? '+' : ''}${projectedGrowth.toFixed(1)}%)`);
    safeConsole.log('📈 Basit karşılaştırma (YANILTICI):', yearGrowth.toFixed(1) + '%');
    safeConsole.log('📊 Aylık ivme:', monthGrowth.toFixed(1) + '%');
    
    const analysis = `
        <!-- Veri Güncelleme Tarihi -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; color: white; text-align: center;">
            <strong>📅 Son Veri Güncelleme:</strong> ${dataUpdateInfo} | <strong>🎵 Müzik Enstrüman Sektörü</strong>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
            <div>
                <h4 style="margin-bottom: 15px; color: #38ef7d;">✅ Olumlu Tespitler & Güçlü Yönler</h4>
                <ul style="line-height: 2.2; margin: 0;">
                    ${dailyGrowth > 0 ? `<li><strong>📈 Günlük Ortalama İvme:</strong> %${Math.abs(dailyGrowth).toFixed(1)} artış<br><span style="font-size: 0.9em; color: #666;">💵 ${lastYear}: $${dailyAvgLastYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün → ${currentYear}: $${dailyAvgThisYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün<br>🎯 Yıl sonu tahmini: $${projectedYearEndSales.toLocaleString('tr-TR', {minimumFractionDigits: 0})} (%${projectedGrowth.toFixed(1)} büyüme)</span></li>` : ''}
                    ${monthGrowth > 0 ? `<li><strong>📊 ${lastMonthName} Ayı İvme (Günlük Ort.):</strong> %${Math.abs(monthGrowth).toFixed(1)} artış ${isCurrentMonth ? `<span style="color: #667eea;">(⏱️ Ay %${monthCompletionRate} tamamlandı)</span>` : ''}<br><span style="font-size: 0.9em; color: #666;">📅 ${lastYear}: $${dailyAvgLastMonth.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün → ${currentYear}: $${dailyAvgThisMonth.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün</span></li>` : ''}
                    ${basketGrowth > 0 ? `<li><strong>🛒 Sepet Ortalaması İvmesi:</strong> %${Math.abs(basketGrowth).toFixed(1)} artış<br><span style="font-size: 0.9em; color: #666;">💰 ${lastYear}: $${avgBasketValueLastYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})} → ${currentYear}: $${avgBasketValue.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</span></li>` : ''}
                    ${fastestGrowingStore && fastestGrowingStore.growth > 20 ? `<li><strong>🚀 En Hızlı Büyüyen Mağaza:</strong> ${fastestGrowingStore.store} (%${fastestGrowingStore.growth.toFixed(1)} ivme)<br><span style="font-size: 0.9em; color: #666;">🎯 Best practice kaynak olarak kullanılmalı</span></li>` : ''}
                    ${fastestGrowingBrand && fastestGrowingBrand.growth > 30 ? `<li><strong>🏷️ En Hızlı Büyüyen Marka:</strong> ${fastestGrowingBrand.brand} (%${fastestGrowingBrand.growth.toFixed(1)} ivme)<br><span style="font-size: 0.9em; color: #666;">💡 Bu markaya yatırım artırılmalı</span></li>` : ''}
                    <li><strong>🏷️ Top 10 Marka Performansı:</strong><br>
                        ${top10Brands.map((b, i) => `<span style="font-size: 0.9em;">${i+1}. ${b[0]}: $${b[1].toLocaleString('tr-TR', {minimumFractionDigits: 0})} (%${(b[1]/totalSalesThisYear*100).toFixed(1)})</span>`).join('<br>')}
                        <br><span style="font-size: 0.9em; color: #666;">🎯 Top 10 marka toplam satışın %${brandConcentration10.toFixed(1)}'ini oluşturuyor</span>
                    </li>
                    <li><strong>👥 Müşteri Metrikleri:</strong><br>
                        <span style="font-size: 0.9em;">• ${uniqueCustomers.toLocaleString('tr-TR')} aktif müşteri<br>
                        • Müşteri başı ortalama: $${avgCustomerValue.toLocaleString('tr-TR', {minimumFractionDigits: 0})}<br>
                        • Sepet ortalaması: $${avgBasketValue.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                    </li>
                </ul>
            </div>
            <div>
                <h4 style="margin-bottom: 15px; color: #f5576c;">⚠️ Dikkat Noktaları & İyileştirme Alanları</h4>
                <ul style="line-height: 2.2; margin: 0;">
                    ${yearGrowth < 0 ? `<li><strong>⏱️ ${currentYear} Durum Raporu (${daysPassedThisYear} gün geçti, ${daysRemainingThisYear} gün kaldı):</strong><br><span style="font-size: 0.9em; color: #666;">💵 <strong>${lastYear} Tamamı:</strong> $${totalSalesLastYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})}<br>💵 <strong>${currentYear} Şu An:</strong> $${totalSalesThisYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})} <span style="color: #f5576c;">(-%${Math.abs(yearGrowth).toFixed(1)} - YANILTICI!)</span><br>📊 <strong>Günlük Ortalama:</strong> ${lastYear}: $${dailyAvgLastYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün → ${currentYear}: $${dailyAvgThisYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün <span style="${dailyGrowth < 0 ? 'color: #f5576c;' : 'color: #38ef7d;'}">(${dailyGrowth > 0 ? '+' : ''}%${dailyGrowth.toFixed(1)})</span><br>🎯 <strong>Yıl Sonu Tahmini:</strong> $${projectedYearEndSales.toLocaleString('tr-TR', {minimumFractionDigits: 0})} <span style="${projectedGrowth < 0 ? 'color: #f5576c;' : 'color: #38ef7d;'}">(${projectedGrowth > 0 ? '+' : ''}%${projectedGrowth.toFixed(1)} vs ${lastYear})</span><br>🚨 <strong>${lastYear} seviyesini yakalamak için kalan ${daysRemainingThisYear} günde:</strong> $${targetRemainingForLastYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})} ciro gerekli ($${dailyTargetToMatchLastYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün vs mevcut $${dailyAvgThisYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})}/gün)</span></li>` : ''}
                    ${monthGrowth < 0 ? `<li><strong>⚠️ ${lastMonthName} Ayı Negatif İvme:</strong> %${Math.abs(monthGrowth).toFixed(1)} düşüş ${isCurrentMonth ? `<span style="color: #f5576c;">(⏱️ Ay %${monthCompletionRate} tamamlandı)</span>` : ''}<br><span style="font-size: 0.9em; color: #666;">📅 Günlük ort: $${dailyAvgLastMonth.toLocaleString('tr-TR', {minimumFractionDigits: 0})} → $${dailyAvgThisMonth.toLocaleString('tr-TR', {minimumFractionDigits: 0})}<br>💡 Ay sonu tahmini: $${(dailyAvgThisMonth * 30).toLocaleString('tr-TR', {minimumFractionDigits: 0})} (vs ${lastYear}: $${lastMonthLastYear.toLocaleString('tr-TR', {minimumFractionDigits: 0})})</span></li>` : ''}
                    ${basketGrowth < 0 ? `<li><strong>🛒 Sepet Ortalaması Düşüşü:</strong> %${Math.abs(basketGrowth).toFixed(1)} azalış<br><span style="font-size: 0.9em; color: #666;">⚠️ Cross-selling ve upselling stratejileri güçlendirilmeli</span></li>` : ''}
                    ${slowestGrowingStore && slowestGrowingStore.growth < -10 ? `<li><strong>📊 En Düşük İvmeli Mağaza:</strong> ${slowestGrowingStore.store} (%${slowestGrowingStore.growth.toFixed(1)})<br><span style="font-size: 0.9em; color: #666;">🎯 Acil müdahale ve destek gerekli</span></li>` : ''}
                    ${slowestGrowingBrand && slowestGrowingBrand.growth < -20 ? `<li><strong>🏷️ Düşüş Yaşayan Marka:</strong> ${slowestGrowingBrand.brand} (%${slowestGrowingBrand.growth.toFixed(1)})<br><span style="font-size: 0.9em; color: #666;">💡 Ürün yelpazesi ve fiyatlandırma gözden geçirilmeli</span></li>` : ''}
                    ${weakStore ? `<li><strong>📍 En Düşük Performanslı Mağaza:</strong> ${weakStore[0]} ($${weakStore[1].toLocaleString('tr-TR', {minimumFractionDigits: 0})})<br><span style="font-size: 0.9em; color: #666;">Toplam satışın %${(weakStore[1]/totalSalesThisYear*100).toFixed(2)}'i - Stratejik değerlendirme gerekli</span></li>` : ''}
                    <li><strong>🎯 Marka Çeşitliliği:</strong> Top 10 marka satışların %${brandConcentration10.toFixed(1)}'ini oluşturuyor ${brandConcentration10 > 70 ? '<span style="color: #f5576c;">(⚠️ Risk yüksek!)</span>' : '<span style="color: #38ef7d;">(✓ Dengeli)</span>'}<br><span style="font-size: 0.9em; color: #666;">💡 Portföy çeşitliliği artırılmalı</span></li>
                </ul>
            </div>
        </div>
        
        <hr style="margin: 25px 0; border: none; border-top: 2px solid rgba(255,255,255,0.2);">
        <h4 style="margin-bottom: 15px; color: #10B981;">💡 Stratejik Öneriler & Aksiyon Planı (Müzik Sektörü Özel)</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div style="background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px; border-left: 4px solid #10B981; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1);">
                <strong style="color: #10B981;">🎯 Kısa Vadeli (1-3 ay)</strong>
                <ul style="margin: 10px 0 0 0; line-height: 2; font-size: 0.95em; color: #cbd5e1;">
                    ${monthGrowth < 0 ? `<li><strong>🚨 ACİL:</strong> ${lastMonthName} ayı düşüşü analizi - Stok, kampanya ve sezonsal faktörleri inceleyin</li>` : ''}
                    ${top10Stores.length > 0 ? `<li><strong>🏆 Best Practice:</strong> ${top10Stores[0][0]} mağazasının başarı faktörlerini (vitrin düzeni, müşteri deneyimi, teşhir teknikleri) diğer mağazalara aktarın</li>` : ''}
                    <li><strong>🎸 Ürün Teşhiri:</strong> Gitarlar, klavyeler, davullar için akustik test alanları oluşturun - deneyimsel satış artışı hedefleyin</li>
                    <li><strong>🛒 Sepet Büyütme:</strong> Aksesuar paketleri (teller, kılıflar, tuner) ile cross-selling - hedef: %20 sepet artışı</li>
                    ${top10Brands.length > 0 ? `<li><strong>🏷️ Kampanya:</strong> ${top10Brands[0][0]} için "Yeni Başlayanlar Paketi" kampanyası düzenleyin</li>` : ''}
                    <li><strong>📱 Dijital:</strong> Online mağazada canlı ürün demoları ve sanal deneme özellikleri ekleyin</li>
                </ul>
            </div>
            <div style="background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px; border-left: 4px solid #3b82f6; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1);">
                <strong style="color: #3b82f6;">📈 Orta Vadeli (3-6 ay)</strong>
                <ul style="margin: 10px 0 0 0; line-height: 2; font-size: 0.95em; color: #cbd5e1;">
                    <li><strong>👥 Müşteri Segmentasyonu:</strong> Profesyonel müzisyenler, amatörler ve yeni başlayanlar için özel hizmet paketleri</li>
                    <li><strong>🎓 Eğitim Programı:</strong> Mağazalarda ücretsiz enstrüman tanıtım ve deneme workshopları (müşteri bağlılığı %30+ artış)</li>
                    <li><strong>🔧 Servis Geliştirme:</strong> Enstrüman bakım ve onarım servisleri ile satış sonrası gelir kaynağı oluşturun</li>
                    <li><strong>📦 Stok Optimizasyonu:</strong> Sezonsal trendlere göre (okul açılışı, yılbaşı) stok planlaması yapın</li>
                    ${weakStore ? `<li><strong>📊 Mağaza İyileştirme:</strong> ${weakStore[0]} için özel destek programı - ürün karması ve satış ekibi eğitimi</li>` : ''}
                    <li><strong>🌐 Online-Offline Entegrasyon:</strong> Click & Collect, mağazadan deneme sonrası online sipariş sistemi</li>
                </ul>
            </div>
            <div style="background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px; border-left: 4px solid #f97316; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1);">
                <strong style="color: #f97316;">🚀 Uzun Vadeli (6-12 ay)</strong>
                <ul style="margin: 10px 0 0 0; line-height: 2; font-size: 0.95em; color: #cbd5e1;">
                    <li><strong>🎵 Topluluk Oluşturma:</strong> Müzisyen topluluğu platformu - konserler, jamler, ürün lansmanları düzenleyin</li>
                    <li><strong>🤝 B2B Geliştirme:</strong> Müzik okulları, kurslar ve tiyatrolar ile kurumsal anlaşmalar yapın</li>
                    <li><strong>💼 Kiralama Servisi:</strong> Profesyonel ekipman kiralama servisi başlatın (pasif gelir kaynağı)</li>
                    <li><strong>📊 Data Analytics:</strong> Müşteri satın alma davranışları analizi ile kişiselleştirilmiş öneriler geliştirin</li>
                    <li><strong>🌍 Pazar Genişletme:</strong> Yeni mağaza açılışları için potansiyel şehirleri analiz edin (${currentYear} verilerine göre)</li>
                    <li><strong>🎯 Hedef Belirleme:</strong> ${currentYear + 1} yılı için gerçekçi büyüme hedefleri belirleyin - önerilen: %${yearGrowth > 0 ? (yearGrowth * 1.2).toFixed(0) : '15'} büyüme</li>
                </ul>
            </div>
        </div>
    `;
    
    document.getElementById('dashAIAnalysis').innerHTML = analysis;
    }

/**
 * AI Analiz & Öngörüler (Filtrelenmiş veri için)
 */
export function performAIAnalysis() {
    safeConsole.log('🤖 AI Analiz başlatılıyor...');
    
    const panel = document.getElementById('aiAnalysisPanel');
    const filteredData = window.filteredData || [];
    if (!panel || filteredData.length === 0) return;
    
    // Veri analizi
    const analysis = analyzeData(filteredData);
    
    // Öngörüler ve öneriler
    const insights = generateInsights(analysis);
    
    // HTML oluştur
    let html = `
        <div class="analysis-panel">
            <h2 style="margin: 0 0 20px 0; font-size: 2em;">🤖 AI Analiz & Öneriler</h2>
            <p style="opacity: 0.9; margin-bottom: 20px;">Filtrelenen ${filteredData.length.toLocaleString('tr-TR')} kayıt üzerinden yapılan akıllı analiz sonuçları</p>
            
            ${insights.positive.length > 0 ? `
            <div class="analysis-section">
                <h3>✅ Olumlu Tespitler</h3>
                ${insights.positive.map(item => `
                    <div class="insight-item insight-positive">
                        <span class="insight-icon">✅</span>
                        <strong>${item.title}</strong><br>
                        ${item.description}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.negative.length > 0 ? `
            <div class="analysis-section">
                <h3>⚠️ Dikkat Edilmesi Gerekenler</h3>
                ${insights.negative.map(item => `
                    <div class="insight-item insight-negative">
                        <span class="insight-icon">⚠️</span>
                        <strong>${item.title}</strong><br>
                        ${item.description}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${insights.neutral.length > 0 ? `
            <div class="analysis-section">
                <h3>💡 Önemli Bilgiler</h3>
                ${insights.neutral.map(item => `
                    <div class="insight-item insight-neutral">
                        <span class="insight-icon">💡</span>
                        <strong>${item.title}</strong><br>
                        ${item.description}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <div class="analysis-section">
                <h3>🎯 Aksiyon Önerileri</h3>
                ${insights.recommendations.map(item => `
                    <div class="recommendation">
                        <span class="recommendation-icon">${item.icon}</span>
                        <div>
                            <strong style="font-size: 1.1em;">${item.title}</strong><br>
                            <p style="margin: 10px 0 0 0; opacity: 0.95;">${item.description}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    panel.innerHTML = html;
    panel.style.display = 'block';
}

/**
 * Veri analizi
 */
export function analyzeData(data) {
    // Temel metrikler
    const totalUSD = data.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const totalQty = data.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const avgOrderValue = totalUSD / data.length;
    
    // Mağaza analizi
    const storeData = {};
    data.forEach(item => {
        const store = item.store || 'Bilinmiyor';
        if (!storeData[store]) {
            storeData[store] = {sales: 0, count: 0, qty: 0};
        }
        storeData[store].sales += parseFloat(item.usd_amount || 0);
        storeData[store].count += 1;
        storeData[store].qty += parseFloat(item.quantity || 0);
    });
    
    // Marka analizi
    const brandData = {};
    data.forEach(item => {
        const brand = item.brand || 'Bilinmiyor';
        if (!brandData[brand]) {
            brandData[brand] = {sales: 0, count: 0};
        }
        brandData[brand].sales += parseFloat(item.usd_amount || 0);
        brandData[brand].count += 1;
    });
    
    // Kategori analizi
    const categoryData = {};
    data.forEach(item => {
        const cat = item.category_2 || item.category_1 || 'Bilinmiyor';
        if (!categoryData[cat]) {
            categoryData[cat] = {sales: 0, count: 0};
        }
        categoryData[cat].sales += parseFloat(item.usd_amount || 0);
        categoryData[cat].count += 1;
    });
    
    // Müşteri analizi
    const customerData = {};
    data.forEach(item => {
        const customer = item.partner || 'Bilinmiyor';
        if (!customerData[customer]) {
            customerData[customer] = {sales: 0, count: 0};
        }
        customerData[customer].sales += parseFloat(item.usd_amount || 0);
        customerData[customer].count += 1;
    });
    
    // Satış temsilcisi analizi
    const salesPersonData = {};
    data.forEach(item => {
        const person = item.sales_person || 'Bilinmiyor';
        if (!salesPersonData[person]) {
            salesPersonData[person] = {sales: 0, count: 0};
        }
        salesPersonData[person].sales += parseFloat(item.usd_amount || 0);
        salesPersonData[person].count += 1;
    });
    
    // Tarih analizi
    const dateData = {};
    data.forEach(item => {
        if (!item.date) return;
        const month = item.date.substring(0, 7);
        if (!dateData[month]) {
            dateData[month] = {sales: 0, count: 0};
        }
        dateData[month].sales += parseFloat(item.usd_amount || 0);
        dateData[month].count += 1;
    });
    
    // Sıralama
    const topStores = Object.entries(storeData).sort((a, b) => b[1].sales - a[1].sales);
    const topBrands = Object.entries(brandData).sort((a, b) => b[1].sales - a[1].sales);
    const topCategories = Object.entries(categoryData).sort((a, b) => b[1].sales - a[1].sales);
    const topCustomers = Object.entries(customerData).sort((a, b) => b[1].sales - a[1].sales);
    const topSalesPersons = Object.entries(salesPersonData).sort((a, b) => b[1].sales - a[1].sales);
    
    return {
        totalUSD,
        totalQty,
        avgOrderValue,
        recordCount: data.length,
        storeData,
        brandData,
        categoryData,
        customerData,
        salesPersonData,
        dateData,
        topStores,
        topBrands,
        topCategories,
        topCustomers,
        topSalesPersons
    };
}

/**
 * Öngörüler üret
 */
export function generateInsights(analysis) {
    const insights = {
        positive: [],
        negative: [],
        neutral: [],
        recommendations: []
    };
    
    // Olumlu tespitler
    if (analysis.topStores.length > 0) {
        const topStore = analysis.topStores[0];
        const storePercent = (topStore[1].sales / analysis.totalUSD * 100).toFixed(1);
        if (storePercent > 30) {
            insights.positive.push({
                title: `En Başarılı Mağaza: ${topStore[0]}`,
                description: `<span class="metric-highlight">$${topStore[1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span> satış ile toplam satışların <span class="metric-highlight">%${storePercent}</span>'ini gerçekleştirmiş. Mükemmel performans! 🎉`
            });
        }
    }
    
    if (analysis.topBrands.length > 0) {
        const topBrand = analysis.topBrands[0];
        insights.positive.push({
            title: `En Çok Satan Marka: ${topBrand[0]}`,
            description: `<span class="metric-highlight">${topBrand[1].count}</span> adet satış ile lider marka. Stok yönetimine dikkat edin.`
        });
    }
    
    if (analysis.avgOrderValue > 100) {
        insights.positive.push({
            title: 'Yüksek Ortalama Sipariş Değeri',
            description: `Ortalama sipariş değeri <span class="metric-highlight">$${analysis.avgOrderValue.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>. Müşteriler yüksek değerli ürünleri tercih ediyor.`
        });
    }
    
    // Dikkat edilmesi gerekenler
    if (analysis.topStores.length > 1) {
        const topStore = analysis.topStores[0];
        const secondStore = analysis.topStores[1];
        const gap = ((topStore[1].sales - secondStore[1].sales) / topStore[1].sales * 100).toFixed(1);
        if (gap > 50) {
            insights.negative.push({
                title: 'Mağazalar Arası Dengesizlik',
                description: `${topStore[0]} ile ${secondStore[0]} arasında <span class="metric-highlight">%${gap}</span> fark var. Düşük performanslı mağazalara destek gerekebilir.`
            });
        }
    }
    
    if (analysis.topCustomers.length > 0) {
        const topCustomer = analysis.topCustomers[0];
        const customerPercent = (topCustomer[1].sales / analysis.totalUSD * 100).toFixed(1);
        if (customerPercent > 20) {
            insights.negative.push({
                title: 'Tek Müşteriye Bağımlılık Riski',
                description: `${topCustomer[0]} toplam satışların <span class="metric-highlight">%${customerPercent}</span>'ini oluşturuyor. Müşteri portföyünü çeşitlendirmeyi düşünün.`
            });
        }
    }
    
    if (analysis.recordCount < 10) {
        insights.negative.push({
            title: 'Düşük Veri Hacmi',
            description: `Sadece <span class="metric-highlight">${analysis.recordCount}</span> kayıt analiz edildi. Daha geniş tarih aralığı seçerek daha sağlıklı analiz yapabilirsiniz.`
        });
    }
    
    // Önemli bilgiler
    // En Popüler Kategoriler (All ve Analitik olanları hariç tut)
    const validCategories = analysis.topCategories.filter(cat => 
        !cat[0].toLowerCase().includes('all') && 
        !cat[0].toLowerCase().includes('analitik') &&
        !cat[0].toLowerCase().includes('eğitim')
    ).slice(0, 5);
    
    if (validCategories.length > 0) {
        const categoryDetails = validCategories.map((cat, idx) => {
            const percent = (cat[1].sales / analysis.totalUSD * 100).toFixed(1);
            return `${idx + 1}. <strong>${cat[0]}</strong>: <span class="metric-highlight">${cat[1].count}</span> adet, <span class="metric-highlight">%${percent}</span>`;
        }).join('<br>');
        
        insights.neutral.push({
            title: '🎸 En Popüler Kategoriler (İlk 5)',
            description: categoryDetails
        });
    }
    
    // En Başarılı Satış Temsilcileri (İlk 5)
    if (analysis.topSalesPersons.length > 0) {
        const topSalesPersons = analysis.topSalesPersons.slice(0, 5);
        const salesPersonDetails = topSalesPersons.map((person, idx) => {
            const percent = (person[1].sales / analysis.totalUSD * 100).toFixed(1);
            return `${idx + 1}. <strong>${person[0]}</strong>: <span class="metric-highlight">$${person[1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span> (<span class="metric-highlight">%${percent}</span>)`;
        }).join('<br>');
        
        insights.neutral.push({
            title: '👤 En Başarılı Satış Temsilcileri (İlk 5)',
            description: salesPersonDetails
        });
    }
    
    const uniqueCustomers = Object.keys(analysis.customerData).length;
    insights.neutral.push({
        title: 'Müşteri Çeşitliliği',
        description: `<span class="metric-highlight">${uniqueCustomers}</span> farklı müşteri ile işlem yapılmış.`
    });
    
    // Öneriler
    insights.recommendations.push({
        icon: '🎯',
        title: 'Hedef Belirleme',
        description: `Mevcut performans: <span class="metric-highlight">$${analysis.totalUSD.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>. "Hedef Takip" sekmesinden aylık/yıllık hedeflerinizi belirleyin ve ilerlemenizi takip edin.`
    });
    
    if (analysis.topStores.length > 1) {
        const weakStores = analysis.topStores.slice(-2);
        insights.recommendations.push({
            icon: '📈',
            title: 'Düşük Performanslı Mağazalara Odaklanın',
            description: `${weakStores.map(s => s[0]).join(' ve ')} mağazalarının performansını artırmak için özel kampanyalar düzenleyin.`
        });
    }
    
    // En Çok Satan Markalar (İlk 5)
    if (analysis.topBrands.length > 0) {
        const topBrands = analysis.topBrands.slice(0, 5);
        const brandDetails = topBrands.map((brand, idx) => {
            const percent = (brand[1].sales / analysis.totalUSD * 100).toFixed(1);
            return `${idx + 1}. <strong>${brand[0]}</strong>: <span class="metric-highlight">${brand[1].count}</span> adet, <span class="metric-highlight">%${percent}</span>`;
        }).join('<br>');
        
        insights.recommendations.push({
            icon: '🏷️',
            title: 'Stok Optimizasyonu - En Çok Satan Markalar (İlk 5)',
            description: brandDetails + '<br><br>Bu markaların stok seviyelerini yakından takip edin.'
        });
    }
    
    insights.recommendations.push({
        icon: '👥',
        title: 'Müşteri İlişkileri',
        description: `"Müşteri Analizi" sekmesinden top müşterilerinizi inceleyin ve özel teklifler sunarak sadakati artırın.`
    });
    
    if (analysis.avgOrderValue < 50) {
        insights.recommendations.push({
            icon: '💰',
            title: 'Ortalama Sipariş Değerini Artırın',
            description: `Mevcut ortalama: <span class="metric-highlight">$${analysis.avgOrderValue.toFixed(2)}</span>. Cross-selling ve up-selling stratejileri uygulayın.`
        });
    }
    
    insights.recommendations.push({
        icon: '📊',
        title: 'Düzenli Raporlama',
        description: `"Excel'e Aktar" özelliğini kullanarak haftalık/aylık raporlar oluşturun ve trendleri takip edin.`
    });
    
    return insights;
}

/**
 * GPT API ve Maliyet Takibi
 */

// Maliyet takibi için localStorage
let queryCostTracker = {
    totalQueries: parseInt(localStorage.getItem('gpt_total_queries') || '0'),
    totalCost: parseFloat(localStorage.getItem('gpt_total_cost') || '0'),
    monthlyQueries: parseInt(localStorage.getItem('gpt_monthly_queries') || '0'),
    monthlyCost: parseFloat(localStorage.getItem('gpt_monthly_cost') || '0'),
    lastResetDate: localStorage.getItem('gpt_last_reset') || new Date().toISOString().slice(0, 7)
};

/**
 * Aylık sıfırlama kontrolü
 */
export function checkMonthlyReset() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (queryCostTracker.lastResetDate !== currentMonth) {
        queryCostTracker.monthlyQueries = 0;
        queryCostTracker.monthlyCost = 0;
        queryCostTracker.lastResetDate = currentMonth;
        localStorage.setItem('gpt_monthly_queries', '0');
        localStorage.setItem('gpt_monthly_cost', '0');
        localStorage.setItem('gpt_last_reset', currentMonth);
    }
}

/**
 * Maliyet güncelleme
 */
export function updateQueryCost(model, inputTokens, outputTokens) {
    checkMonthlyReset();
    
    let cost = 0;
    if (model === 'gpt-3.5-turbo') {
        cost = (inputTokens / 1000 * 0.0005) + (outputTokens / 1000 * 0.0015);
    } else if (model === 'gpt-4-turbo') {
        cost = (inputTokens / 1000 * 0.01) + (outputTokens / 1000 * 0.03);
    } else if (model === 'gpt-4o-mini') {
        cost = (inputTokens / 1000 * 0.00015) + (outputTokens / 1000 * 0.0006);
    }
    
    queryCostTracker.totalQueries++;
    queryCostTracker.totalCost += cost;
    queryCostTracker.monthlyQueries++;
    queryCostTracker.monthlyCost += cost;
    
    localStorage.setItem('gpt_total_queries', queryCostTracker.totalQueries.toString());
    localStorage.setItem('gpt_total_cost', queryCostTracker.totalCost.toFixed(4));
    localStorage.setItem('gpt_monthly_queries', queryCostTracker.monthlyQueries.toString());
    localStorage.setItem('gpt_monthly_cost', queryCostTracker.monthlyCost.toFixed(4));
    
    safeConsole.log(`💰 GPT Maliyet: $${cost.toFixed(4)} | Aylık Toplam: $${queryCostTracker.monthlyCost.toFixed(2)} (${queryCostTracker.monthlyQueries} sorgu)`);
    
    return cost;
}

/**
 * GPT API çağrısı (Backend'e gönderilecek)
 */
export async function callGPTAPI(query, context) {
    // ÖNEMLİ: Bu fonksiyon şu anda placeholder. 
    // Gerçek kullanım için backend API endpoint'i gerekli.
    
    safeConsole.log('🤖 GPT API çağrısı hazırlanıyor...');
    safeConsole.log('📝 Sorgu:', query);
    safeConsole.log('📊 Context boyutu:', JSON.stringify(context).length, 'karakter');
    
    // Backend endpoint
    const BACKEND_URL = 'YOUR_BACKEND_URL_HERE'; // Buraya backend URL'i eklenecek
    
    try {
        // Backend'e istek gönder
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                context: context,
                model: 'gpt-3.5-turbo' // veya 'gpt-4-turbo'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Maliyet takibi
        if (data.usage) {
            updateQueryCost(
                data.model || 'gpt-3.5-turbo',
                data.usage.prompt_tokens,
                data.usage.completion_tokens
            );
        }
        
        return {
            success: true,
            answer: data.answer,
            model: data.model,
            cost: data.cost
        };
        
    } catch (error) {
        console.error('❌ GPT API Hatası:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Maliyet istatistiklerini göster
 */
export function showCostStats() {
    checkMonthlyReset();
    
    const statsHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin: 10px 0;">
            <h4 style="margin: 0 0 10px 0;">💰 GPT Maliyet İstatistikleri</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <strong>Bu Ay:</strong><br>
                    ${queryCostTracker.monthlyQueries} sorgu<br>
                    $${queryCostTracker.monthlyCost.toFixed(2)} (~${(queryCostTracker.monthlyCost * 30).toFixed(0)} TL)
                </div>
                <div>
                    <strong>Toplam:</strong><br>
                    ${queryCostTracker.totalQueries} sorgu<br>
                    $${queryCostTracker.totalCost.toFixed(2)}
                </div>
            </div>
            <div style="margin-top: 10px; font-size: 0.9em; opacity: 0.9;">
                📊 Ortalama: $${(queryCostTracker.monthlyCost / Math.max(queryCostTracker.monthlyQueries, 1)).toFixed(4)}/sorgu
            </div>
        </div>
    `;
    
    // Stats'ı debug panel'e ekle
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel && debugPanel.style.display === 'block') {
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            debugInfo.innerHTML += statsHTML;
        }
    }
}

// Konsol komutu: Maliyet istatistiklerini göster
window.showGPTStats = function() {
    checkMonthlyReset();
    safeConsole.log('💰 GPT Maliyet İstatistikleri:');
    safeConsole.log('Bu Ay:', queryCostTracker.monthlyQueries, 'sorgu, $' + queryCostTracker.monthlyCost.toFixed(2));
    safeConsole.log('Toplam:', queryCostTracker.totalQueries, 'sorgu, $' + queryCostTracker.totalCost.toFixed(2));
    safeConsole.log('Ortalama:', '$' + (queryCostTracker.monthlyCost / Math.max(queryCostTracker.monthlyQueries, 1)).toFixed(4), 'per sorgu');
};

// Konsol komutu: Maliyet sıfırla
window.resetGPTStats = function() {
    if (confirm('Tüm GPT maliyet istatistiklerini sıfırlamak istediğinize emin misiniz?')) {
        localStorage.removeItem('gpt_total_queries');
        localStorage.removeItem('gpt_total_cost');
        localStorage.removeItem('gpt_monthly_queries');
        localStorage.removeItem('gpt_monthly_cost');
        localStorage.removeItem('gpt_last_reset');
        queryCostTracker = {
            totalQueries: 0,
            totalCost: 0,
            monthlyQueries: 0,
            monthlyCost: 0,
            lastResetDate: new Date().toISOString().slice(0, 7)
        };
        safeConsole.log('✅ GPT maliyet istatistikleri sıfırlandı.');
    }
};

// Global erişim için
window.performAIAnalysis = performAIAnalysis;
window.analyzeData = analyzeData;
window.generateInsights = generateInsights;
window.checkMonthlyReset = checkMonthlyReset;
window.updateQueryCost = updateQueryCost;
window.callGPTAPI = callGPTAPI;
window.showCostStats = showCostStats;

safeConsole.log('✅ GPT Backend hazır! Kullanım:');
safeConsole.log('   showGPTStats() - Maliyet istatistiklerini göster');
safeConsole.log('   resetGPTStats() - Maliyet istatistiklerini sıfırla');
