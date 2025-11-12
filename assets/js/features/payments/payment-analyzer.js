/**
 * PAYMENT-ANALYZER.JS - Ödeme Analizi Modülü
 */

import { safeConsole } from '../../core/logger.js';

// Pagination state
let paymentCurrentPage = 1;
const paymentItemsPerPage = 500;

/**
 * Ödeme analizini başlat
 */
export function analyzePayments() {
    safeConsole.log('💳 Ödeme analizi başlatılıyor...');
    
    // Filtre değiştiğinde sayfa 1'e dön
    paymentCurrentPage = 1;
    
    if (!window.paymentData || !window.paymentData.transactions || window.paymentData.transactions.length === 0) {
        // Veri yokken özet kartlarını sıfırla
        document.getElementById('paymentTotalAmount').textContent = '$0';
        document.getElementById('paymentTotalCount').textContent = '0';
        document.getElementById('paymentAvgAmount').textContent = '$0';
        document.getElementById('paymentUniqueCustomers').textContent = '0';
        document.getElementById('paymentUniquePosOrders').textContent = '0';
        document.getElementById('paymentTopCardFamily').textContent = '-';
        document.getElementById('paymentTopInstallment').textContent = '-';
        document.getElementById('paymentTopVpos').textContent = '-';
        
        document.getElementById('paymentResultsContainer').style.display = 'none';
        document.getElementById('paymentNoResults').style.display = 'block';
        return;
    }
    
    // TÜM VERİLER ÜZERİNDEN ÖZET KARTLARINI HESAPLA (Filtreleme yok)
    const allPayments = window.paymentData.transactions;
    
    // İstatistikleri TÜM veriler üzerinden hesapla
    const totalAmount = allPayments.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const avgAmount = allPayments.length > 0 ? totalAmount / allPayments.length : 0;
    const uniqueCustomers = new Set(allPayments.map(t => {
        const partner = t.partner_id;
        return partner && typeof partner === 'object' ? partner[0] : partner;
    }).filter(Boolean)).size;
    
    // Farklı PoS Siparişi sayısı - Geliştirilmiş parsing
    const posOrderSamples = [];
    let posOrderWithValue = 0;
    let posOrderEmpty = 0;
    
    const uniquePosOrders = new Set(allPayments.map(t => {
        const posOrder = t.pos_order_id;
        
        // Debug için örnek topla (ilk 10 kayıt)
        if (posOrderSamples.length < 10) {
            posOrderSamples.push({ 
                raw: posOrder, 
                type: typeof posOrder, 
                isArray: Array.isArray(posOrder),
                isNull: posOrder === null,
                isUndefined: posOrder === undefined,
                isFalse: posOrder === false,
                keys: posOrder && typeof posOrder === 'object' && !Array.isArray(posOrder) ? Object.keys(posOrder) : null
            });
        }
        
        // Boş değer kontrolü
        if (posOrder === false || posOrder === null || posOrder === undefined || posOrder === '') {
            posOrderEmpty++;
            return null;
        }
        
        // Değer var, parse et
        posOrderWithValue++;
        let posOrderValue = null;
        
        if (Array.isArray(posOrder)) {
            if (posOrder.length > 0) {
                posOrderValue = String(posOrder[0]); // ID'yi string olarak al
            }
        } else if (posOrder && typeof posOrder === 'object') {
            // Object formatı: {id: X, name: Y} veya [id, name] gibi
            posOrderValue = String(posOrder.id || posOrder[0] || posOrder.value || posOrder);
        } else if (posOrder) {
            posOrderValue = String(posOrder);
        }
        
        return posOrderValue;
    }).filter(Boolean)).size;
    
    // Debug log
    safeConsole.log('🔍 PoS Order Analizi:', {
        toplamKayıt: allPayments.length,
        değerVar: posOrderWithValue,
        değerYok: posOrderEmpty,
        benzersizPoS: uniquePosOrders,
        örnekler: posOrderSamples.slice(0, 5)
    });
    
    // En çok kullanılan Kart Programı - Geliştirilmiş parsing
    const cardFamilyCounts = {};
    const cardFamilySamples = [];
    let cardFamilyWithValue = 0;
    let cardFamilyEmpty = 0;
    
    allPayments.forEach(t => {
        const cardFamily = t.jetcheckout_card_family;
        
        // Debug için örnek topla (ilk 10 kayıt)
        if (cardFamilySamples.length < 10) {
            cardFamilySamples.push({ 
                raw: cardFamily, 
                type: typeof cardFamily, 
                isArray: Array.isArray(cardFamily),
                isNull: cardFamily === null,
                isUndefined: cardFamily === undefined,
                isFalse: cardFamily === false,
                keys: cardFamily && typeof cardFamily === 'object' && !Array.isArray(cardFamily) ? Object.keys(cardFamily) : null
            });
        }
        
        // Boş değer kontrolü
        if (cardFamily === false || cardFamily === null || cardFamily === undefined || cardFamily === '') {
            cardFamilyEmpty++;
            return; // Bu kaydı atla
        }
        
        // Değer var, parse et
        cardFamilyWithValue++;
        let cardFamilyValue = null;
        
        if (Array.isArray(cardFamily)) {
            if (cardFamily.length > 1) {
                cardFamilyValue = String(cardFamily[1]); // İkinci eleman 'name'
            } else if (cardFamily.length === 1) {
                cardFamilyValue = String(cardFamily[0]); // Sadece ID varsa
            }
        } else if (cardFamily && typeof cardFamily === 'object') {
            // Object formatı: {id: X, name: Y} veya benzeri
            cardFamilyValue = String(cardFamily.name || cardFamily[1] || cardFamily[0] || cardFamily.id || cardFamily.value || cardFamily);
        } else if (cardFamily) {
            cardFamilyValue = String(cardFamily);
        }
        
        // Geçerli değer kontrolü
        if (cardFamilyValue && 
            cardFamilyValue !== 'false' && 
            cardFamilyValue !== 'null' && 
            cardFamilyValue !== 'undefined' &&
            cardFamilyValue !== 'None' &&
            cardFamilyValue.trim() !== '') {
            cardFamilyCounts[cardFamilyValue] = (cardFamilyCounts[cardFamilyValue] || 0) + 1;
        }
    });
    
    // Debug log
    safeConsole.log('🔍 Card Family Analizi:', {
        toplamKayıt: allPayments.length,
        değerVar: cardFamilyWithValue,
        değerYok: cardFamilyEmpty,
        farklıDeğer: Object.keys(cardFamilyCounts).length,
        tümDeğerler: Object.keys(cardFamilyCounts).slice(0, 10),
        örnekler: cardFamilySamples.slice(0, 5)
    });
    
    const topCardFamily = Object.keys(cardFamilyCounts).length > 0 
        ? Object.entries(cardFamilyCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    
    // En çok kullanılan Taksit - Geliştirilmiş parsing
    const installmentCounts = {};
    const installmentSamples = [];
    let installmentWithValue = 0;
    let installmentEmpty = 0;
    
    allPayments.forEach(t => {
        const installment = t.jetcheckout_installment_description_long;
        
        // Debug için örnek topla (ilk 10 kayıt)
        if (installmentSamples.length < 10) {
            installmentSamples.push({ 
                raw: installment, 
                type: typeof installment, 
                isArray: Array.isArray(installment),
                isNull: installment === null,
                isUndefined: installment === undefined,
                isFalse: installment === false,
                keys: installment && typeof installment === 'object' && !Array.isArray(installment) ? Object.keys(installment) : null
            });
        }
        
        // Boş değer kontrolü
        if (installment === false || installment === null || installment === undefined || installment === '') {
            installmentEmpty++;
            return; // Bu kaydı atla
        }
        
        // Değer var, parse et
        installmentWithValue++;
        let installmentValue = null;
        
        if (Array.isArray(installment)) {
            if (installment.length > 1) {
                installmentValue = String(installment[1]); // İkinci eleman 'name'
            } else if (installment.length === 1) {
                installmentValue = String(installment[0]); // Sadece ID varsa
            }
        } else if (installment && typeof installment === 'object') {
            // Object formatı: {id: X, name: Y} veya benzeri
            installmentValue = String(installment.name || installment[1] || installment[0] || installment.id || installment.value || installment);
        } else if (installment) {
            installmentValue = String(installment);
        }
        
        // Geçerli değer kontrolü
        if (installmentValue && 
            installmentValue !== 'false' && 
            installmentValue !== 'null' && 
            installmentValue !== 'undefined' &&
            installmentValue !== 'None' &&
            installmentValue.trim() !== '') {
            installmentCounts[installmentValue] = (installmentCounts[installmentValue] || 0) + 1;
        }
    });
    
    // Debug log
    safeConsole.log('🔍 Installment Analizi:', {
        toplamKayıt: allPayments.length,
        değerVar: installmentWithValue,
        değerYok: installmentEmpty,
        farklıDeğer: Object.keys(installmentCounts).length,
        tümDeğerler: Object.keys(installmentCounts).slice(0, 10),
        örnekler: installmentSamples.slice(0, 5)
    });
    
    const topInstallment = Object.keys(installmentCounts).length > 0
        ? Object.entries(installmentCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    
    // En çok kullanılan Sanal Pos - Geliştirilmiş parsing
    const vposCounts = {};
    const vposSamples = [];
    let vposWithValue = 0;
    let vposEmpty = 0;
    
    allPayments.forEach(t => {
        const vpos = t.jetcheckout_vpos_name;
        
        // Debug için örnek topla (ilk 10 kayıt)
        if (vposSamples.length < 10) {
            vposSamples.push({ 
                raw: vpos, 
                type: typeof vpos, 
                isArray: Array.isArray(vpos),
                isNull: vpos === null,
                isUndefined: vpos === undefined,
                isFalse: vpos === false,
                keys: vpos && typeof vpos === 'object' && !Array.isArray(vpos) ? Object.keys(vpos) : null
            });
        }
        
        // Boş değer kontrolü
        if (vpos === false || vpos === null || vpos === undefined || vpos === '') {
            vposEmpty++;
            return; // Bu kaydı atla
        }
        
        // Değer var, parse et
        vposWithValue++;
        let vposValue = null;
        
        if (Array.isArray(vpos)) {
            if (vpos.length > 1) {
                vposValue = String(vpos[1]); // İkinci eleman 'name'
            } else if (vpos.length === 1) {
                vposValue = String(vpos[0]); // Sadece ID varsa
            }
        } else if (vpos && typeof vpos === 'object') {
            // Object formatı: {id: X, name: Y} veya benzeri
            vposValue = String(vpos.name || vpos[1] || vpos[0] || vpos.id || vpos.value || vpos);
        } else if (vpos) {
            vposValue = String(vpos);
        }
        
        // Geçerli değer kontrolü
        if (vposValue && 
            vposValue !== 'false' && 
            vposValue !== 'null' && 
            vposValue !== 'undefined' &&
            vposValue !== 'None' &&
            vposValue.trim() !== '') {
            vposCounts[vposValue] = (vposCounts[vposValue] || 0) + 1;
        }
    });
    
    // Debug log
    safeConsole.log('🔍 VPOS Analizi:', {
        toplamKayıt: allPayments.length,
        değerVar: vposWithValue,
        değerYok: vposEmpty,
        farklıDeğer: Object.keys(vposCounts).length,
        tümDeğerler: Object.keys(vposCounts).slice(0, 10),
        örnekler: vposSamples.slice(0, 5)
    });
    
    const topVpos = Object.keys(vposCounts).length > 0
        ? Object.entries(vposCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    
    // Genel debug log - DETAYLI
    safeConsole.log('💳 Ödeme Analizi ÖZET SONUÇLARI:', {
        toplamKayıt: allPayments.length,
        uniquePosOrders: uniquePosOrders,
        topCardFamily: topCardFamily || 'VERİ YOK',
        topInstallment: topInstallment || 'VERİ YOK',
        topVpos: topVpos || 'VERİ YOK',
        cardFamilyFarklıDeğer: Object.keys(cardFamilyCounts).length,
        installmentFarklıDeğer: Object.keys(installmentCounts).length,
        vposFarklıDeğer: Object.keys(vposCounts).length,
        cardFamilyTop3: Object.entries(cardFamilyCounts).sort((a, b) => b[1] - a[1]).slice(0, 3),
        installmentTop3: Object.entries(installmentCounts).sort((a, b) => b[1] - a[1]).slice(0, 3),
        vposTop3: Object.entries(vposCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    });
    
    // Eğer hiç veri yoksa, kullanıcıya bilgi ver
    if (uniquePosOrders === 0) {
        safeConsole.warn('⚠️ PoS Siparişi: Tüm kayıtlarda pos_order_id boş veya null!');
    }
    if (!topCardFamily) {
        safeConsole.warn('⚠️ Kart Programı: Tüm kayıtlarda jetcheckout_card_family boş veya null!');
    }
    if (!topInstallment) {
        safeConsole.warn('⚠️ Taksit: Tüm kayıtlarda jetcheckout_installment_description_long boş veya null!');
    }
    if (!topVpos) {
        safeConsole.warn('⚠️ Sanal Pos: Tüm kayıtlarda jetcheckout_vpos_name boş veya null!');
    }
    
    // Özet kartlarını TÜM veriler üzerinden güncelle
    document.getElementById('paymentTotalAmount').textContent = `$${totalAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('paymentTotalCount').textContent = allPayments.length.toLocaleString('tr-TR');
    document.getElementById('paymentAvgAmount').textContent = `$${avgAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('paymentUniqueCustomers').textContent = uniqueCustomers.toLocaleString('tr-TR');
    document.getElementById('paymentUniquePosOrders').textContent = uniquePosOrders.toLocaleString('tr-TR');
    document.getElementById('paymentTopCardFamily').textContent = topCardFamily || '-';
    document.getElementById('paymentTopInstallment').textContent = topInstallment || '-';
    document.getElementById('paymentTopVpos').textContent = topVpos || '-';
    
    // Tablo container'ını gizle
    const tableContainer = document.getElementById('paymentResultsContainer');
    if (tableContainer) {
        tableContainer.style.display = 'none';
    }
    
    // Filtreleri al (AI Analiz için)
    const stateFilter = document.getElementById('paymentStateFilter')?.value || 'done';
    const dateStart = document.getElementById('paymentDateStart')?.value || '';
    const dateEnd = document.getElementById('paymentDateEnd')?.value || '';
    const minAmount = parseFloat(document.getElementById('paymentMinAmount')?.value) || 0;
    const maxAmount = parseFloat(document.getElementById('paymentMaxAmount')?.value) || Infinity;
    
    // Filtrele (Sadece AI Analiz için)
    let filteredPayments = allPayments.filter(transaction => {
        // Durum filtresi
        if (stateFilter && transaction.state !== stateFilter) {
            return false;
        }
        
        // Tarih filtresi (date veya create_date)
        const transactionDate = transaction.date || transaction.create_date || '';
        if (dateStart && transactionDate < dateStart) {
            return false;
        }
        if (dateEnd && transactionDate > dateEnd) {
            return false;
        }
        
        // Tutar filtresi
        const amount = parseFloat(transaction.amount || 0);
        if (amount < minAmount || amount > maxAmount) {
            return false;
        }
        
        return true;
    });
    
    safeConsole.log(`✅ Tüm ödeme verileri: ${allPayments.length} kayıt`);
    safeConsole.log(`✅ Filtrelenmiş ödeme (AI için): ${filteredPayments.length} kayıt`);
    
    // AI Analiz (Filtrelenmiş verilerle - kullanıcı isterse filtreleyebilir)
    const filteredTotalAmount = filteredPayments.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const filteredAvgAmount = filteredPayments.length > 0 ? filteredTotalAmount / filteredPayments.length : 0;
    const filteredUniqueCustomers = new Set(filteredPayments.map(t => {
        const partner = t.partner_id;
        return partner && typeof partner === 'object' ? partner[0] : partner;
    }).filter(Boolean)).size;
    const filteredUniquePosOrders = new Set(filteredPayments.map(t => {
        const posOrder = t.pos_order_id;
        return posOrder && typeof posOrder === 'object' ? posOrder[0] : posOrder;
    }).filter(Boolean)).size;
    
    // Filtrelenmiş veriler için top değerler
    const filteredCardFamilyCounts = {};
    filteredPayments.forEach(t => {
        const cardFamily = t.jetcheckout_card_family;
        if (cardFamily) {
            filteredCardFamilyCounts[cardFamily] = (filteredCardFamilyCounts[cardFamily] || 0) + 1;
        }
    });
    const filteredTopCardFamily = Object.keys(filteredCardFamilyCounts).length > 0 
        ? Object.entries(filteredCardFamilyCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    
    const filteredInstallmentCounts = {};
    filteredPayments.forEach(t => {
        const installment = t.jetcheckout_installment_description_long;
        if (installment) {
            filteredInstallmentCounts[installment] = (filteredInstallmentCounts[installment] || 0) + 1;
        }
    });
    const filteredTopInstallment = Object.keys(filteredInstallmentCounts).length > 0
        ? Object.entries(filteredInstallmentCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    
    const filteredVposCounts = {};
    filteredPayments.forEach(t => {
        const vpos = t.jetcheckout_vpos_name;
        if (vpos) {
            filteredVposCounts[vpos] = (filteredVposCounts[vpos] || 0) + 1;
        }
    });
    const filteredTopVpos = Object.keys(filteredVposCounts).length > 0
        ? Object.entries(filteredVposCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    
    performPaymentAIAnalysis(filteredPayments, {
        totalAmount: filteredTotalAmount,
        totalCount: filteredPayments.length,
        avgAmount: filteredAvgAmount,
        uniqueCustomers: filteredUniqueCustomers,
        uniquePosOrders: filteredUniquePosOrders,
        topCardFamily: filteredTopCardFamily,
        topInstallment: filteredTopInstallment,
        topVpos: filteredTopVpos
    });
    
    // Sonuçları göster
    document.getElementById('paymentNoResults').style.display = 'none';
}

/**
 * Ödeme sayfasını değiştir (pagination)
 */
export function changePaymentPage(direction) {
    if (!window.paymentData || !window.paymentData.transactions || window.paymentData.transactions.length === 0) {
        return;
    }
    
    // Filtreleri al
    const stateFilter = document.getElementById('paymentStateFilter')?.value || 'done';
    const dateStart = document.getElementById('paymentDateStart')?.value || '';
    const dateEnd = document.getElementById('paymentDateEnd')?.value || '';
    const minAmount = parseFloat(document.getElementById('paymentMinAmount')?.value) || 0;
    const maxAmount = parseFloat(document.getElementById('paymentMaxAmount')?.value) || Infinity;
    
    // Filtrele
    let filteredPayments = window.paymentData.transactions.filter(transaction => {
        if (stateFilter && transaction.state !== stateFilter) return false;
        const transactionDate = transaction.date || transaction.create_date || '';
        if (dateStart && transactionDate < dateStart) return false;
        if (dateEnd && transactionDate > dateEnd) return false;
        const amount = parseFloat(transaction.amount || 0);
        if (amount < minAmount || amount > maxAmount) return false;
        return true;
    });
    
    const totalPages = Math.ceil(filteredPayments.length / paymentItemsPerPage);
    
    if (direction === 'prev' && paymentCurrentPage > 1) {
        paymentCurrentPage--;
    } else if (direction === 'next' && paymentCurrentPage < totalPages) {
        paymentCurrentPage++;
    } else if (typeof direction === 'number') {
        paymentCurrentPage = Math.max(1, Math.min(direction, totalPages));
    }
    
    renderPaymentTable(filteredPayments);
}

/**
 * Payment AI Analiz Fonksiyonu
 */
export function performPaymentAIAnalysis(transactions, stats) {
    const aiContainer = document.getElementById('paymentAIAnalysis');
    const aiResults = document.getElementById('paymentAIResults');
    
    if (!aiContainer || !aiResults || transactions.length === 0) {
        if (aiContainer) aiContainer.style.display = 'none';
        return;
    }
    
    aiContainer.style.display = 'block';
    
    // Basit istatistiksel analiz
    let analysisHTML = '<div style="line-height: 1.8;">';
    
    // Genel özet
    analysisHTML += `<h4 style="color: #667eea; margin-bottom: 15px;">📊 Genel Özet</h4>`;
    analysisHTML += `<p><strong>Toplam İşlem:</strong> ${stats.totalCount.toLocaleString('tr-TR')} ödeme işlemi</p>`;
    analysisHTML += `<p><strong>Toplam Tutar:</strong> $${stats.totalAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>`;
    analysisHTML += `<p><strong>Ortalama Tutar:</strong> $${stats.avgAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>`;
    analysisHTML += `<p><strong>Farklı Müşteri:</strong> ${stats.uniqueCustomers.toLocaleString('tr-TR')}</p>`;
    analysisHTML += `<p><strong>Farklı PoS Siparişi:</strong> ${stats.uniquePosOrders.toLocaleString('tr-TR')}</p>`;
    
    // Ödeme tercihleri
    if (stats.topCardFamily) {
        analysisHTML += `<hr style="margin: 20px 0; border: 1px solid #dee2e6;">`;
        analysisHTML += `<h4 style="color: #667eea; margin-bottom: 15px;">💳 Ödeme Tercihleri</h4>`;
        analysisHTML += `<p><strong>En Çok Kullanılan Kart:</strong> ${stats.topCardFamily}</p>`;
    }
    
    if (stats.topInstallment) {
        analysisHTML += `<p><strong>En Çok Tercih Edilen Taksit:</strong> ${stats.topInstallment}</p>`;
    }
    
    if (stats.topVpos) {
        analysisHTML += `<p><strong>En Çok Kullanılan Sanal Pos:</strong> ${stats.topVpos}</p>`;
    }
    
    // Tarih analizi
    const dateCounts = {};
    transactions.forEach(t => {
        const date = (t.create_date || t.date || '').substring(0, 10);
        if (date) {
            dateCounts[date] = (dateCounts[date] || 0) + 1;
        }
    });
    
    if (Object.keys(dateCounts).length > 0) {
        const topDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        analysisHTML += `<hr style="margin: 20px 0; border: 1px solid #dee2e6;">`;
        analysisHTML += `<h4 style="color: #667eea; margin-bottom: 15px;">📅 En Yoğun Ödeme Günleri</h4>`;
        topDates.forEach(([date, count], idx) => {
            analysisHTML += `<p><strong>${idx + 1}.</strong> ${date}: ${count} işlem</p>`;
        });
    }
    
    analysisHTML += '</div>';
    aiResults.innerHTML = analysisHTML;
}

/**
 * Ödeme tablosunu render et
 */
export function renderPaymentTable(transactions) {
    const container = document.getElementById('paymentTable');
    if (!container) return;
    
    // Pagination hesaplamaları
    const totalItems = transactions.length;
    const totalPages = Math.ceil(totalItems / paymentItemsPerPage);
    const startIndex = (paymentCurrentPage - 1) * paymentItemsPerPage;
    const endIndex = Math.min(startIndex + paymentItemsPerPage, totalItems);
    const paginatedTransactions = transactions.slice(startIndex, endIndex);
    
    // Tablo HTML'i
    let html = `
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="color: #667eea; font-weight: 600;">
                📊 Toplam ${totalItems.toLocaleString('tr-TR')} kayıt gösteriliyor (${(startIndex + 1).toLocaleString('tr-TR')}-${endIndex.toLocaleString('tr-TR')})
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button onclick="window.changePaymentPage('prev')" 
                        style="padding: 8px 16px; background: ${paymentCurrentPage > 1 ? '#667eea' : '#ccc'}; color: white; border: none; border-radius: 8px; cursor: ${paymentCurrentPage > 1 ? 'pointer' : 'not-allowed'}; font-weight: 600;"
                        ${paymentCurrentPage <= 1 ? 'disabled' : ''}>
                    ← Önceki
                </button>
                <span style="padding: 8px 16px; background: #f8f9fa; border-radius: 8px; font-weight: 600;">
                    Sayfa ${paymentCurrentPage} / ${totalPages}
                </span>
                <button onclick="window.changePaymentPage('next')" 
                        style="padding: 8px 16px; background: ${paymentCurrentPage < totalPages ? '#667eea' : '#ccc'}; color: white; border: none; border-radius: 8px; cursor: ${paymentCurrentPage < totalPages ? 'pointer' : 'not-allowed'}; font-weight: 600;"
                        ${paymentCurrentPage >= totalPages ? 'disabled' : ''}>
                    Sonraki →
                </button>
            </div>
        </div>
        <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="padding: 12px; text-align: left; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">📅 Tarih</th>
                    <th style="padding: 12px; text-align: left; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">💰 Tutar</th>
                    <th style="padding: 12px; text-align: left; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">👤 Müşteri</th>
                    <th style="padding: 12px; text-align: left; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">🛒 PoS Siparişi</th>
                    <th style="padding: 12px; text-align: left; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">💳 Taksit</th>
                    <th style="padding: 12px; text-align: left; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">🏷️ Kart Programı</th>
                    <th style="padding: 12px; text-align: left; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">🏦 Sanal Pos</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    paginatedTransactions.forEach((transaction, index) => {
        const date = transaction.create_date || transaction.date || '-';
        const amount = parseFloat(transaction.amount || 0);
        const partner = transaction.partner_id;
        const partnerName = partner && typeof partner === 'object' ? (partner[1] || partner[0] || '-') : (partner || '-');
        
        // PoS Siparişi
        const posOrder = transaction.pos_order_id;
        const posOrderName = posOrder && typeof posOrder === 'object' ? (posOrder[1] || posOrder[0] || '-') : (posOrder || '-');
        
        // Taksit
        const installment = transaction.jetcheckout_installment_description_long || '-';
        
        // Kart Programı
        const cardProgram = transaction.jetcheckout_card_family || '-';
        
        // Sanal Pos
        const vposName = transaction.jetcheckout_vpos_name || '-';
        
        const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
        html += `
            <tr style="background: ${bgColor};">
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${date}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">$${amount.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${partnerName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${posOrderName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${installment}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${cardProgram}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${vposName}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * Ödeme filtrelerini temizle
 */
export function clearPaymentFilters() {
    document.getElementById('paymentStateFilter').value = 'done';
    document.getElementById('paymentDateStart').value = '';
    document.getElementById('paymentDateEnd').value = '';
    document.getElementById('paymentMinAmount').value = '';
    document.getElementById('paymentMaxAmount').value = '';
    analyzePayments();
}

// Global erişim için
window.analyzePayments = analyzePayments;
window.changePaymentPage = changePaymentPage;
window.clearPaymentFilters = clearPaymentFilters;

