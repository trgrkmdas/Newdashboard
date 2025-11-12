/**
 * AI-FILTER.JS - AI Destekli Filtreleme ve Analiz
 */

import { safeConsole } from '../core/logger.js';
import { fuzzyMatch, levenshteinDistance } from './search-engine.js';
import { updateSelectionCount } from './filter-manager.js';

/**
 * AI ile sorgu analizi yap
 */
export function analyzeQueryWithAI(query) {
    if (!window.allData || window.allData.length === 0) {
        safeConsole.warn('⚠️ Veri yok, AI analizi yapılamıyor');
        return createEmptyAnalysis();
    }
    
    const lowerQuery = query.toLowerCase();
    const analysis = {
        intent: 'search', // search, filter, analyze, compare, recommendation
        queryType: 'basic', // basic, person_analysis, city_analysis, product_recommendation
        entities: {
            stores: [],
            brands: [],
            categories: [],
            cities: [],
            salesPersons: [],
            products: [],
            dateRange: null,
            years: [],
            months: [],
            keywords: []
        },
        question: {
            type: null, // "who_sold_what", "city_bought_what", "where_to_sell", "best_for"
            subject: null, // Kişi adı, şehir adı, ürün adı
            object: null, // Ürün, marka, kategori
            action: null // "sattı", "aldı", "satmalı", "konumlandırmalı"
        },
        confidence: 0,
        interpretation: '',
        needsGPT: false // Karmaşık soru mu?
    };
    
    // ==================== GELİŞMİŞ SORU TİPİ TESPİTİ ====================
    
    // 1. "X en çok hangi Y sattı/aldı?" pattern
    const personSoldPattern = /(.+?)\s+(en\s+çok|en\s+fazla)?\s*hangi\s+(ürün|marka|kategori|model).*?(sattı|satmış|satıyor)/i;
    const personSoldMatch = query.match(personSoldPattern);
    
    if (personSoldMatch) {
        analysis.queryType = 'person_analysis';
        analysis.question.type = 'who_sold_what';
        analysis.question.subject = personSoldMatch[1].trim();
        analysis.question.object = personSoldMatch[3]; // ürün, marka, kategori
        analysis.question.action = 'sattı';
        analysis.intent = 'analyze';
        safeConsole.log('🎯 Tespit: Kişi analizi -', analysis.question.subject, 'hangi', analysis.question.object, 'sattı?');
    }
    
    // 2. "X hangi Y aldı?" pattern (Şehir/Müşteri bazlı)
    const cityBoughtPattern = /(.+?)\s+(en\s+çok|en\s+fazla)?\s*hangi\s+(marka|model|kategori|ürün).*?(aldı|almış|alıyor|satın\s+aldı)/i;
    const cityBoughtMatch = query.match(cityBoughtPattern);
    
    if (cityBoughtMatch) {
        analysis.queryType = 'city_analysis';
        analysis.question.type = 'city_bought_what';
        analysis.question.subject = cityBoughtMatch[1].trim();
        analysis.question.object = cityBoughtMatch[3];
        analysis.question.action = 'aldı';
        analysis.intent = 'analyze';
        safeConsole.log('🎯 Tespit: Şehir/Müşteri analizi -', analysis.question.subject, 'hangi', analysis.question.object, 'aldı?');
    }
    
    // 3. "Hangi X'de Y daha çok satıyor/satar?" pattern (Öneri)
    const whereToSellPattern = /hangi\s+(mağaza|şehir|yer).*?(satmalı|satmalıyım|satmak|konumlandır|daha\s+çok\s+sat)/i;
    const whereToSellMatch = query.match(whereToSellPattern);
    
    if (whereToSellMatch) {
        analysis.queryType = 'product_recommendation';
        analysis.question.type = 'where_to_sell';
        analysis.question.action = 'satmalı';
        analysis.intent = 'recommendation';
        analysis.needsGPT = true; // Öneri için GPT kullanılabilir
        safeConsole.log('🎯 Tespit: Ürün konumlandırma önerisi');
    }
    
    // 4. "X için en iyi Y nedir?" pattern
    const bestForPattern = /(.+?)\s+için\s+en\s+iyi\s+(mağaza|şehir|yer|kategori)/i;
    const bestForMatch = query.match(bestForPattern);
    
    if (bestForMatch) {
        analysis.queryType = 'product_recommendation';
        analysis.question.type = 'best_for';
        analysis.question.subject = bestForMatch[1].trim();
        analysis.question.object = bestForMatch[2];
        analysis.intent = 'recommendation';
        safeConsole.log('🎯 Tespit: En iyi yer önerisi -', analysis.question.subject, 'için');
    }
    
    // 5. "Hangi X Y'de popüler/çok satıyor?" pattern
    const popularWherePattern = /hangi\s+(ürün|marka|kategori).*?(şehir|mağaza|yer).*?(popüler|çok\s+sat|başarılı)/i;
    const popularWhereMatch = query.match(popularWherePattern);
    
    if (popularWhereMatch) {
        analysis.queryType = 'city_analysis';
        analysis.question.type = 'what_popular_where';
        analysis.question.object = popularWhereMatch[1];
        analysis.intent = 'analyze';
        safeConsole.log('🎯 Tespit: Popülerlik analizi');
    }
    
    // 1. MAĞAZA TESPİTİ (Fuzzy matching ile)
    const allStores = [...new Set(window.allData.map(item => item.store).filter(Boolean))];
    allStores.forEach(store => {
        const storeLower = store.toLowerCase();
        // Tam eşleşme veya kısmi eşleşme
        if (lowerQuery.includes(storeLower) || 
            storeLower.includes(lowerQuery) ||
            fuzzyMatch(lowerQuery, storeLower)) {
            analysis.entities.stores.push(store);
        }
    });
    
    // Yaygın mağaza kısaltmaları
    const storeAliases = {
        'aka': 'akasya', 'kadi': 'kadıköy', 'kadı': 'kadıköy',
        'beylik': 'beylikdüzü', 'beyl': 'beylikdüzü'
    };
    for (const [alias, fullName] of Object.entries(storeAliases)) {
        if (lowerQuery.includes(alias)) {
            const matchingStores = allStores.filter(s => s.toLowerCase().includes(fullName));
            analysis.entities.stores.push(...matchingStores);
        }
    }
    
    // 2. MARKA TESPİTİ
    const allBrands = [...new Set(window.allData.map(item => item.brand).filter(Boolean))];
    allBrands.forEach(brand => {
        if (lowerQuery.includes(brand.toLowerCase())) {
            analysis.entities.brands.push(brand);
        }
    });
    
    // 3. KATEGORİ TESPİTİ (Tüm seviyeler)
    const allCategories = new Set();
    window.allData.forEach(item => {
        [item.category_1, item.category_2, item.category_3, item.category_4].forEach(cat => {
            if (cat) allCategories.add(cat);
        });
    });
    Array.from(allCategories).forEach(category => {
        if (lowerQuery.includes(category.toLowerCase())) {
            analysis.entities.categories.push(category);
        }
    });
    
    // Yaygın kategori anahtar kelimeleri
    const categoryKeywords = {
        'gitar': ['gitar', 'guitar'],
        'piyano': ['piyano', 'piano'],
        'davul': ['davul', 'drum', 'bateri'],
        'keman': ['keman', 'violin'],
        'saz': ['saz', 'bağlama'],
        'aksesu': ['aksesuar', 'aksesuarlar']
    };
    for (const [key, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => lowerQuery.includes(kw))) {
            const matchingCats = Array.from(allCategories).filter(c => 
                c.toLowerCase().includes(key)
            );
            analysis.entities.categories.push(...matchingCats);
        }
    }
    
    // 4. TARİH ANALİZİ (Gelişmiş)
    // "son X gün/ay" tespiti
    const timePatterns = [
        /son\s+(\d+)\s+(gün|gun)/i,
        /son\s+(\d+)\s+(ay)/i,
        /son\s+(\d+)\s+(hafta)/i,
        /geçen\s+(\d+)\s+(gün|gun|ay|hafta)/i,
        /gecen\s+(\d+)\s+(gün|gun|ay|hafta)/i
    ];
    
    for (const pattern of timePatterns) {
        const match = query.match(pattern);
        if (match) {
            const amount = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            const today = new Date();
            
            if (unit.includes('ay')) {
                today.setMonth(today.getMonth() - amount);
            } else if (unit.includes('hafta')) {
                today.setDate(today.getDate() - (amount * 7));
            } else {
                today.setDate(today.getDate() - amount);
            }
            
            analysis.entities.dateRange = {
                from: today.toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0],
                description: `Son ${amount} ${unit}`
            };
            break;
        }
    }
    
    // Ay isimleri (Türkçe ve İngilizce)
    const monthNames = {
        'ocak': '01', 'january': '01', 'jan': '01',
        'şubat': '02', 'subat': '02', 'february': '02', 'feb': '02',
        'mart': '03', 'march': '03', 'mar': '03',
        'nisan': '04', 'april': '04', 'apr': '04',
        'mayıs': '05', 'mayis': '05', 'may': '05',
        'haziran': '06', 'june': '06', 'jun': '06',
        'temmuz': '07', 'july': '07', 'jul': '07',
        'ağustos': '08', 'agustos': '08', 'august': '08', 'aug': '08',
        'eylül': '09', 'eylul': '09', 'september': '09', 'sep': '09',
        'ekim': '10', 'october': '10', 'oct': '10',
        'kasım': '11', 'kasim': '11', 'november': '11', 'nov': '11',
        'aralık': '12', 'aralik': '12', 'december': '12', 'dec': '12'
    };
    
    for (const [monthName, monthNum] of Object.entries(monthNames)) {
        if (lowerQuery.includes(monthName)) {
            analysis.entities.months.push(monthNum);
        }
    }
    
    // Yıl tespiti (2020-2030)
    const yearMatches = query.match(/\b(202[0-9])\b/g);
    if (yearMatches) {
        analysis.entities.years.push(...yearMatches);
    }
    
    // 5. ŞEHİR TESPİTİ
    const allCities = [...new Set(window.allData.map(item => item.city).filter(Boolean))];
    allCities.forEach(city => {
        if (lowerQuery.includes(city.toLowerCase())) {
            analysis.entities.cities.push(city);
        }
    });
    
    // 6. SATIŞ TEMSİLCİSİ TESPİTİ (Fuzzy matching ile)
    const allSalesPersons = [...new Set(window.allData.map(item => item.sales_person).filter(Boolean))];
    allSalesPersons.forEach(person => {
        const personLower = person.toLowerCase();
        // Tam eşleşme veya kısmi eşleşme (ad veya soyad)
        const queryWords = lowerQuery.split(/\s+/);
        const personWords = personLower.split(/\s+/);
        
        const matches = queryWords.some(qw => 
            personWords.some(pw => pw.includes(qw) || qw.includes(pw))
        );
        
        if (matches || lowerQuery.includes(personLower)) {
            analysis.entities.salesPersons.push(person);
        }
    });
    
    // 6.5. ÜRÜN TESPİTİ (Yeni ürün önerileri için)
    const allProducts = [...new Set(window.allData.map(item => item.product).filter(Boolean))];
    
    // Ürün anahtar kelimeleri
    const productKeywords = {
        'gitar': ['gitar', 'guitar', 'elektro gitar', 'akustik gitar'],
        'piyano': ['piyano', 'piano', 'dijital piyano', 'akustik piyano'],
        'davul': ['davul', 'drum', 'bateri', 'davul seti'],
        'keman': ['keman', 'violin'],
        'saz': ['saz', 'bağlama'],
        'amfi': ['amfi', 'amplifier', 'amplifikatör']
    };
    
    for (const [key, keywords] of Object.entries(productKeywords)) {
        if (keywords.some(kw => lowerQuery.includes(kw))) {
            const matchingProducts = allProducts.filter(p => 
                p.toLowerCase().includes(key)
            );
            analysis.entities.products.push(...matchingProducts.slice(0, 5)); // İlk 5 ürün
        }
    }
    
    // 7. GENEL ANAHTAR KELİMELER
    const stopWords = ['ve', 'veya', 'ile', 'için', 'son', 'gün', 'gun', 'ay', 'yıl', 'yil', 
                       'toplam', 'kaç', 'kac', 'ne', 'kadar', 'göster', 'goster', 'bul', 'ara'];
    const words = query.toLowerCase().split(/\s+/).filter(w => 
        w.length > 2 && !stopWords.includes(w) && !/^\d+$/.test(w)
    );
    analysis.entities.keywords = words;
    
    // 8. GÜVENİLİRLİK SKORU
    let confidence = 0;
    if (analysis.entities.stores.length > 0) confidence += 30;
    if (analysis.entities.brands.length > 0) confidence += 25;
    if (analysis.entities.categories.length > 0) confidence += 20;
    if (analysis.entities.dateRange || analysis.entities.years.length > 0 || analysis.entities.months.length > 0) confidence += 15;
    if (analysis.entities.keywords.length > 0) confidence += 10;
    analysis.confidence = Math.min(confidence, 100);
    
    // 9. YORUMLAMA
    const parts = [];
    if (analysis.entities.stores.length > 0) parts.push(`Mağaza: ${analysis.entities.stores.join(', ')}`);
    if (analysis.entities.brands.length > 0) parts.push(`Marka: ${analysis.entities.brands.join(', ')}`);
    if (analysis.entities.categories.length > 0) parts.push(`Kategori: ${analysis.entities.categories.join(', ')}`);
    if (analysis.entities.dateRange) parts.push(`Tarih: ${analysis.entities.dateRange.description}`);
    else if (analysis.entities.years.length > 0) parts.push(`Yıl: ${analysis.entities.years.join(', ')}`);
    if (analysis.entities.months.length > 0) parts.push(`Ay: ${analysis.entities.months.join(', ')}`);
    if (analysis.entities.keywords.length > 0) parts.push(`Anahtar: ${analysis.entities.keywords.join(', ')}`);
    
    analysis.interpretation = parts.length > 0 ? parts.join(' | ') : 'Genel arama';
    
    return analysis;
}

/**
 * Boş analiz objesi oluştur
 */
function createEmptyAnalysis() {
    return {
        intent: 'search',
        queryType: 'basic',
        entities: {
            stores: [],
            brands: [],
            categories: [],
            cities: [],
            salesPersons: [],
            products: [],
            dateRange: null,
            years: [],
            months: [],
            keywords: []
        },
        question: {
            type: null,
            subject: null,
            object: null,
            action: null
        },
        confidence: 0,
        interpretation: '',
        needsGPT: false
    };
}

/**
 * AI filtrelerini uygula (checkbox'ları seç)
 */
export function applyAIFilters(analysis) {
    // Mağaza filtrelerini seç
    if (analysis.entities.stores.length > 0) {
        const storeContainer = document.getElementById('filterStore');
        if (storeContainer) {
            const checkboxes = storeContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (analysis.entities.stores.some(store => 
                    cb.value.toLowerCase().includes(store.toLowerCase())
                )) {
                    cb.checked = true;
                }
            });
            updateSelectionCount('filterStore', 'countStore');
        }
    }
    
    // Marka filtrelerini seç
    if (analysis.entities.brands.length > 0) {
        const brandContainer = document.getElementById('filterBrand');
        if (brandContainer) {
            const checkboxes = brandContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (analysis.entities.brands.includes(cb.value)) {
                    cb.checked = true;
                }
            });
            updateSelectionCount('filterBrand', 'countBrand');
        }
    }
    
    // Yıl filtrelerini seç
    if (analysis.entities.years.length > 0) {
        const yearContainer = document.getElementById('filterYear');
        if (yearContainer) {
            const checkboxes = yearContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (analysis.entities.years.includes(cb.value)) {
                    cb.checked = true;
                }
            });
            updateSelectionCount('filterYear', 'countYear');
        }
    }
    
    // Ay filtrelerini seç
    if (analysis.entities.months.length > 0) {
        const monthContainer = document.getElementById('filterMonth');
        if (monthContainer) {
            const checkboxes = monthContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (analysis.entities.months.includes(cb.value)) {
                    cb.checked = true;
                }
            });
            updateSelectionCount('filterMonth', 'countMonth');
        }
    }
}

/**
 * AI ile veri filtreleme
 */
export function filterDataWithAI(data, analysis) {
    return data.filter(item => {
        // Mağaza kontrolü
        if (analysis.entities.stores.length > 0) {
            const itemStore = (item.store || '').toLowerCase();
            const matches = analysis.entities.stores.some(store => 
                itemStore.includes(store.toLowerCase())
            );
            if (!matches) return false;
        }
        
        // Marka kontrolü
        if (analysis.entities.brands.length > 0) {
            if (!analysis.entities.brands.includes(item.brand)) return false;
        }
        
        // Kategori kontrolü (tüm seviyeler)
        if (analysis.entities.categories.length > 0) {
            const itemCategories = [item.category_1, item.category_2, item.category_3, item.category_4]
                .filter(Boolean).map(c => c.toLowerCase());
            const matches = analysis.entities.categories.some(cat => 
                itemCategories.some(ic => ic.includes(cat.toLowerCase()) || cat.toLowerCase().includes(ic))
            );
            if (!matches) return false;
        }
        
        // Tarih aralığı kontrolü
        if (analysis.entities.dateRange) {
            if (!item.date || item.date < analysis.entities.dateRange.from) return false;
        }
        
        // Yıl kontrolü
        if (analysis.entities.years.length > 0 && item.date) {
            const itemYear = item.date.split('-')[0];
            if (!analysis.entities.years.includes(itemYear)) return false;
        }
        
        // Ay kontrolü
        if (analysis.entities.months.length > 0 && item.date) {
            const itemMonth = item.date.split('-')[1];
            if (!analysis.entities.months.includes(itemMonth)) return false;
        }
        
        // Şehir kontrolü
        if (analysis.entities.cities.length > 0) {
            if (!analysis.entities.cities.includes(item.city)) return false;
        }
        
        // Satış temsilcisi kontrolü
        if (analysis.entities.salesPersons.length > 0) {
            if (!analysis.entities.salesPersons.includes(item.sales_person)) return false;
        }
        
        // Anahtar kelime kontrolü (fuzzy)
        if (analysis.entities.keywords.length > 0) {
            const searchableText = [
                item.partner, item.product, item.brand,
                item.category_1, item.category_2, item.category_3, item.category_4,
                item.sales_person, item.store, item.city
            ].filter(Boolean).join(' ').toLowerCase();
            
            const matches = analysis.entities.keywords.some(keyword => 
                searchableText.includes(keyword)
            );
            if (!matches) return false;
        }
        
        return true;
    });
}

/**
 * AI yorumunu göster
 */
export function showAIInterpretation(analysis, resultCount) {
    const debugPanel = document.getElementById('debugPanel');
    const debugInfo = document.getElementById('debugInfo');
    
    if (!debugPanel || !debugInfo) {
        safeConsole.warn('⚠️ Debug panel bulunamadı');
        return;
    }
    
    let html = `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">`;
    html += `<h4 style="margin: 0 0 10px 0; color: white;">🤖 AI Agent Analizi</h4>`;
    html += `<p style="margin: 5px 0; font-size: 0.95em;"><strong>Anladığım:</strong> ${analysis.interpretation}</p>`;
    html += `<p style="margin: 5px 0; font-size: 0.9em;">📊 Güvenilirlik: ${analysis.confidence}% | 🎯 Sonuç: ${resultCount} kayıt</p>`;
    html += `</div>`;
    
    html += `<strong>🔍 Tespit Edilen Varlıklar:</strong><br>`;
    if (analysis.entities.stores.length > 0) html += `🏪 Mağazalar: ${analysis.entities.stores.join(', ')}<br>`;
    if (analysis.entities.brands.length > 0) html += `🏷️ Markalar: ${analysis.entities.brands.join(', ')}<br>`;
    if (analysis.entities.categories.length > 0) html += `📂 Kategoriler: ${analysis.entities.categories.join(', ')}<br>`;
    if (analysis.entities.dateRange) html += `📅 Tarih: ${analysis.entities.dateRange.description}<br>`;
    if (analysis.entities.years.length > 0) html += `📆 Yıl: ${analysis.entities.years.join(', ')}<br>`;
    if (analysis.entities.months.length > 0) html += `📆 Ay: ${analysis.entities.months.join(', ')}<br>`;
    if (analysis.entities.cities.length > 0) html += `🌍 Şehir: ${analysis.entities.cities.join(', ')}<br>`;
    if (analysis.entities.salesPersons.length > 0) html += `👤 Satış Tem.: ${analysis.entities.salesPersons.join(', ')}<br>`;
    if (analysis.entities.keywords.length > 0) html += `🔑 Anahtar Kelimeler: ${analysis.entities.keywords.join(', ')}<br>`;
    
    debugInfo.innerHTML = html;
    debugPanel.style.display = 'block';
}

/**
 * Gelişmiş analiz (Kişi, Şehir, Öneri sorguları)
 */
export function performAdvancedAnalysis(analysis, data) {
    safeConsole.log('🎯 Gelişmiş analiz başlatılıyor:', analysis.queryType);
    
    const debugPanel = document.getElementById('debugPanel');
    const debugInfo = document.getElementById('debugInfo');
    
    if (!debugPanel || !debugInfo) {
        safeConsole.warn('⚠️ Debug panel bulunamadı');
        return;
    }
    
    let html = `<div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 10px;">`;
    html += `<h3 style="margin: 0 0 15px 0; color: white;">🤖 Gelişmiş AI Analizi</h3>`;
    
    if (analysis.queryType === 'person_analysis') {
        // "Mustafa Kılıç en çok hangi ürünü sattı?"
        const personName = analysis.question.subject;
        const objectType = analysis.question.object; // ürün, marka, kategori
        
        // Kişinin verilerini filtrele
        const personData = data.filter(item => 
            item.sales_person && item.sales_person.toLowerCase().includes(personName.toLowerCase())
        );
        
        if (personData.length === 0) {
            html += `<p>⚠️ "${personName}" adlı satış temsilcisi bulunamadı.</p>`;
        } else {
            // Analiz yap
            const results = {};
            personData.forEach(item => {
                let key;
                if (objectType === 'ürün') key = item.product;
                else if (objectType === 'marka') key = item.brand;
                else if (objectType === 'kategori') key = item.category_1;
                else if (objectType === 'model') key = item.product;
                
                if (key) {
                    if (!results[key]) results[key] = {sales: 0, count: 0};
                    results[key].sales += parseFloat(item.usd_amount || 0);
                    results[key].count += 1;
                }
            });
            
            // Sırala
            const sorted = Object.entries(results).sort((a, b) => b[1].sales - a[1].sales);
            const top5 = sorted.slice(0, 5);
            
            html += `<p style="font-size: 1.1em; margin-bottom: 15px;">📊 <strong>${personName}</strong> analizi:</p>`;
            html += `<p>💰 Toplam Satış: <strong>$${personData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</strong></p>`;
            html += `<p>📦 Toplam İşlem: <strong>${personData.length}</strong></p>`;
            html += `<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 15px 0;">`;
            html += `<p style="font-size: 1.05em; margin-bottom: 10px;">🏆 En Çok Sattığı ${objectType.charAt(0).toUpperCase() + objectType.slice(1)}ler:</p>`;
            
            top5.forEach((item, index) => {
                html += `<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 5px; margin: 8px 0;">`;
                html += `<strong>${index + 1}. ${item[0]}</strong><br>`;
                html += `💰 Satış: $${item[1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} | 📦 Adet: ${item[1].count}`;
                html += `</div>`;
            });
            
            // Öneri
            html += `<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 15px 0;">`;
            html += `<p style="font-size: 1em;">💡 <strong>Öneri:</strong> ${personName}, <strong>${top5[0][0]}</strong> konusunda uzman. Bu ${objectType}'e odaklanmalı ve stok takibi yapmalı.</p>`;
        }
        
    } else if (analysis.queryType === 'city_analysis') {
        // "İstanbul en çok hangi marka piyano aldı?"
        const cityName = analysis.question.subject;
        const objectType = analysis.question.object; // marka, model, kategori
        
        // Şehir verilerini filtrele
        let cityData = data.filter(item => 
            item.city && item.city.toLowerCase().includes(cityName.toLowerCase())
        );
        
        // Eğer partner adı ise
        if (cityData.length === 0) {
            cityData = data.filter(item => 
                item.partner && item.partner.toLowerCase().includes(cityName.toLowerCase())
            );
        }
        
        if (cityData.length === 0) {
            html += `<p>⚠️ "${cityName}" için veri bulunamadı.</p>`;
        } else {
            // Analiz yap
            const results = {};
            cityData.forEach(item => {
                let key;
                if (objectType === 'marka') key = item.brand;
                else if (objectType === 'model') key = item.product;
                else if (objectType === 'kategori') key = item.category_1;
                else if (objectType === 'ürün') key = item.product;
                
                if (key) {
                    if (!results[key]) results[key] = {sales: 0, count: 0};
                    results[key].sales += parseFloat(item.usd_amount || 0);
                    results[key].count += 1;
                }
            });
            
            // Sırala
            const sorted = Object.entries(results).sort((a, b) => b[1].sales - a[1].sales);
            const top5 = sorted.slice(0, 5);
            
            html += `<p style="font-size: 1.1em; margin-bottom: 15px;">📊 <strong>${cityName}</strong> analizi:</p>`;
            html += `<p>💰 Toplam Satış: <strong>$${cityData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}</strong></p>`;
            html += `<p>📦 Toplam İşlem: <strong>${cityData.length}</strong></p>`;
            html += `<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 15px 0;">`;
            html += `<p style="font-size: 1.05em; margin-bottom: 10px;">🏆 En Çok Tercih Edilen ${objectType.charAt(0).toUpperCase() + objectType.slice(1)}ler:</p>`;
            
            top5.forEach((item, index) => {
                html += `<div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 5px; margin: 8px 0;">`;
                html += `<strong>${index + 1}. ${item[0]}</strong><br>`;
                html += `💰 Satış: $${item[1].sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} | 📦 Adet: ${item[1].count}`;
                html += `</div>`;
            });
            
            // Öneri
            html += `<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 15px 0;">`;
            html += `<p style="font-size: 1em;">💡 <strong>Öneri:</strong> ${cityName}'da <strong>${top5[0][0]}</strong> en popüler. Bu ${objectType} için stok artırılmalı.</p>`;
        }
        
    } else if (analysis.queryType === 'product_recommendation') {
        // "Hangi mağazada bu ürünü satmalıyım?"
        html += `<p style="font-size: 1.1em; margin-bottom: 15px;">🎯 Ürün Konumlandırma Önerisi</p>`;
        
        // Kategori veya marka bazlı analiz
        const storeData = {};
        
        data.forEach(item => {
            const store = item.store || 'Bilinmiyor';
            const category = item.category_1 || 'Bilinmiyor';
            
            if (!storeData[store]) storeData[store] = {sales: 0, count: 0, categories: {}};
            storeData[store].sales += parseFloat(item.usd_amount || 0);
            storeData[store].count += 1;
            
            if (!storeData[store].categories[category]) storeData[store].categories[category] = 0;
            storeData[store].categories[category] += parseFloat(item.usd_amount || 0);
        });
        
        // En başarılı mağazaları bul
        const sortedStores = Object.entries(storeData).sort((a, b) => b[1].sales - a[1].sales);
        const top3Stores = sortedStores.slice(0, 3);
        
        html += `<p>📊 Mağaza Performans Analizi:</p>`;
        
        top3Stores.forEach((store, index) => {
            const storeName = store[0];
            const storeStats = store[1];
            const topCategory = Object.entries(storeStats.categories).sort((a, b) => b[1] - a[1])[0];
            
            html += `<div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 5px; margin: 10px 0;">`;
            html += `<strong>${index + 1}. ${storeName}</strong><br>`;
            html += `💰 Toplam Satış: $${storeStats.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}<br>`;
            html += `📦 İşlem Sayısı: ${storeStats.count}<br>`;
            html += `🏆 En Güçlü Kategori: ${topCategory[0]}`;
            html += `</div>`;
        });
        
        // Öneri
        html += `<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 15px 0;">`;
        html += `<p style="font-size: 1em;">💡 <strong>Öneri:</strong></p>`;
        html += `<p>• <strong>${top3Stores[0][0]}</strong> en yüksek satış performansına sahip.</p>`;
        html += `<p>• Yeni ürün için bu mağazayı tercih edin.</p>`;
        html += `<p>• Özellikle <strong>${Object.entries(top3Stores[0][1].categories).sort((a, b) => b[1] - a[1])[0][0]}</strong> kategorisinde güçlü.</p>`;
        
        if (analysis.needsGPT) {
            html += `<hr style="border: 1px solid rgba(255,255,255,0.3); margin: 15px 0;">`;
            html += `<p style="font-size: 0.9em; opacity: 0.9;">🤖 <em>Daha detaylı analiz için GPT-4 kullanılabilir. (İsteğe bağlı)</em></p>`;
        }
    }
    
    html += `</div>`;
    
    debugInfo.innerHTML = html;
    debugPanel.style.display = 'block';
}

/**
 * AI Sorgulama Fonksiyonları (GPT API entegrasyonu)
 */

// AI Proxy URL (development/production)
const getAIProxyURL = () => {
    const isDevelopment = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return isDevelopment 
        ? 'http://localhost:3001/api/ai/query' // Development: local proxy
        : '/api/ai/query'; // Production: Vercel serverless function
};

/**
 * Gelişmiş RAG benzeri AI Context Builder
 */
export function buildAdvancedAIContext(query, allData) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    // 1. GENEL İSTATİSTİKLER
    const totalRecords = allData.length;
    const totalSales = allData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const totalQuantity = allData.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const avgOrderValue = totalRecords > 0 ? totalSales / totalRecords : 0;
    
    const dateRange = allData.length > 0 ? {
        min: allData.reduce((min, item) => !min || item.date < min ? item.date : min, null),
        max: allData.reduce((max, item) => !max || item.date > max ? item.date : max, null)
    } : null;
    
    // 2. KATEGORİ BAZLI DETAYLI ANALİZLER
    const storeStats = {};
    const productStats = {};
    const customerStats = {};
    const cityStats = {};
    const salespersonStats = {};
    const categoryStats = {};
    const brandStats = {};
    const monthlyStats = {};
    const yearlyStats = {};
    
    allData.forEach(item => {
        // Mağaza istatistikleri
        const store = item.store || item.store_name || 'Bilinmiyor';
        if (!storeStats[store]) {
            storeStats[store] = { sales: 0, qty: 0, count: 0, customers: new Set(), products: new Set() };
        }
        storeStats[store].sales += parseFloat(item.usd_amount || 0);
        storeStats[store].qty += parseFloat(item.quantity || 0);
        storeStats[store].count += 1;
        if (item.partner || item.customer_name) storeStats[store].customers.add(item.partner || item.customer_name);
        if (item.product || item.product_name) storeStats[store].products.add(item.product || item.product_name);
        
        // Ürün istatistikleri
        const product = item.product || item.product_name || 'Bilinmiyor';
        if (!productStats[product]) {
            productStats[product] = { sales: 0, qty: 0, count: 0, stores: new Set(), customers: new Set() };
        }
        productStats[product].sales += parseFloat(item.usd_amount || 0);
        productStats[product].qty += parseFloat(item.quantity || 0);
        productStats[product].count += 1;
        if (item.store || item.store_name) productStats[product].stores.add(item.store || item.store_name);
        if (item.partner || item.customer_name) productStats[product].customers.add(item.partner || item.customer_name);
        
        // Müşteri istatistikleri
        const customer = item.partner || item.customer_name || 'Bilinmiyor';
        if (!customerStats[customer]) {
            customerStats[customer] = { sales: 0, qty: 0, count: 0, stores: new Set(), products: new Set() };
        }
        customerStats[customer].sales += parseFloat(item.usd_amount || 0);
        customerStats[customer].qty += parseFloat(item.quantity || 0);
        customerStats[customer].count += 1;
        if (item.store || item.store_name) customerStats[customer].stores.add(item.store || item.store_name);
        if (item.product || item.product_name) customerStats[customer].products.add(item.product || item.product_name);
        
        // Şehir istatistikleri
        const city = item.city || item.partner_city || 'Bilinmiyor';
        if (!cityStats[city]) {
            cityStats[city] = { sales: 0, qty: 0, count: 0, customers: new Set(), stores: new Set() };
        }
        cityStats[city].sales += parseFloat(item.usd_amount || 0);
        cityStats[city].qty += parseFloat(item.quantity || 0);
        cityStats[city].count += 1;
        if (item.partner || item.customer_name) cityStats[city].customers.add(item.partner || item.customer_name);
        if (item.store || item.store_name) cityStats[city].stores.add(item.store || item.store_name);
        
        // Satış temsilcisi istatistikleri
        const salesperson = item.sales_person || item.salesperson_name || 'Bilinmiyor';
        if (!salespersonStats[salesperson]) {
            salespersonStats[salesperson] = { sales: 0, qty: 0, count: 0, customers: new Set(), stores: new Set() };
        }
        salespersonStats[salesperson].sales += parseFloat(item.usd_amount || 0);
        salespersonStats[salesperson].qty += parseFloat(item.quantity || 0);
        salespersonStats[salesperson].count += 1;
        if (item.partner || item.customer_name) salespersonStats[salesperson].customers.add(item.partner || item.customer_name);
        if (item.store || item.store_name) salespersonStats[salesperson].stores.add(item.store || item.store_name);
        
        // Kategori istatistikleri
        const category = item.category_1 || item.product_category || 'Bilinmiyor';
        if (!categoryStats[category]) {
            categoryStats[category] = { sales: 0, qty: 0, count: 0, products: new Set() };
        }
        categoryStats[category].sales += parseFloat(item.usd_amount || 0);
        categoryStats[category].qty += parseFloat(item.quantity || 0);
        categoryStats[category].count += 1;
        if (item.product || item.product_name) categoryStats[category].products.add(item.product || item.product_name);
        
        // Marka istatistikleri
        const brand = item.brand || 'Bilinmiyor';
        if (!brandStats[brand]) {
            brandStats[brand] = { sales: 0, qty: 0, count: 0, products: new Set() };
        }
        brandStats[brand].sales += parseFloat(item.usd_amount || 0);
        brandStats[brand].qty += parseFloat(item.quantity || 0);
        brandStats[brand].count += 1;
        if (item.product || item.product_name) brandStats[brand].products.add(item.product || item.product_name);
        
        // Aylık istatistikler
        if (item.date) {
            const month = item.date.substring(0, 7); // YYYY-MM
            if (!monthlyStats[month]) {
                monthlyStats[month] = { sales: 0, qty: 0, count: 0 };
            }
            monthlyStats[month].sales += parseFloat(item.usd_amount || 0);
            monthlyStats[month].qty += parseFloat(item.quantity || 0);
            monthlyStats[month].count += 1;
        }
        
        // Yıllık istatistikler
        if (item.date) {
            const year = item.date.substring(0, 4); // YYYY
            if (!yearlyStats[year]) {
                yearlyStats[year] = { sales: 0, qty: 0, count: 0 };
            }
            yearlyStats[year].sales += parseFloat(item.usd_amount || 0);
            yearlyStats[year].qty += parseFloat(item.quantity || 0);
            yearlyStats[year].count += 1;
        }
    });
    
    // 3. TOP PERFORMERS (En iyi performans gösterenler - Daha fazla veri)
    const topStores = Object.entries(storeStats)
        .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            qty: stats.qty,
            count: stats.count,
            avgOrder: stats.count > 0 ? stats.sales / stats.count : 0,
            uniqueCustomers: stats.customers.size,
            uniqueProducts: stats.products.size
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    const topProducts = Object.entries(productStats)
        .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            qty: stats.qty,
            count: stats.count,
            avgPrice: stats.qty > 0 ? stats.sales / stats.qty : 0,
            uniqueStores: stats.stores.size,
            uniqueCustomers: stats.customers.size
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    const topCustomers = Object.entries(customerStats)
        .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            qty: stats.qty,
            count: stats.count,
            avgOrder: stats.count > 0 ? stats.sales / stats.count : 0,
            uniqueStores: stats.stores.size,
            uniqueProducts: stats.products.size
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    const topSalespersons = Object.entries(salespersonStats)
        .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            qty: stats.qty,
            count: stats.count,
            avgOrder: stats.count > 0 ? stats.sales / stats.count : 0,
            uniqueCustomers: stats.customers.size,
            uniqueStores: stats.stores.size
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    const topCities = Object.entries(cityStats)
        .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            qty: stats.qty,
            count: stats.count,
            uniqueCustomers: stats.customers.size,
            uniqueStores: stats.stores.size
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    // Tüm kategoriler ve markalar için listeler
    const allCategoriesList = Object.entries(categoryStats)
        .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            qty: stats.qty,
            count: stats.count,
            uniqueProducts: stats.products.size
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    const allBrandsList = Object.entries(brandStats)
        .map(([name, stats]) => ({
            name,
            sales: stats.sales,
            qty: stats.qty,
            count: stats.count,
            uniqueProducts: stats.products.size
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    // 4. SORUYA ÖZEL İLGİLİ VERİLER (RAG - Retrieval)
    const relevantData = allData.filter(item => {
        const searchText = [
            item.store || item.store_name,
            item.product || item.product_name,
            item.partner || item.customer_name,
            item.city || item.partner_city,
            item.sales_person || item.salesperson_name,
            item.category_1 || item.product_category,
            item.brand
        ].filter(Boolean).join(' ').toLowerCase();
        
        return queryWords.every(word => searchText.includes(word)) || 
               queryLower.length > 3 && searchText.includes(queryLower);
    });
    
    const relevantSales = relevantData.reduce((sum, item) => sum + parseFloat(item.usd_amount || 0), 0);
    const relevantCount = relevantData.length;
    const relevantQty = relevantData.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    
    // İlgili verilerden detaylı analiz
    const relevantStoreBreakdown = {};
    const relevantProductBreakdown = {};
    const relevantCustomerBreakdown = {};
    
    relevantData.forEach(item => {
        const store = item.store || item.store_name || 'Bilinmiyor';
        if (!relevantStoreBreakdown[store]) relevantStoreBreakdown[store] = { sales: 0, count: 0 };
        relevantStoreBreakdown[store].sales += parseFloat(item.usd_amount || 0);
        relevantStoreBreakdown[store].count += 1;
        
        const product = item.product || item.product_name || 'Bilinmiyor';
        if (!relevantProductBreakdown[product]) relevantProductBreakdown[product] = { sales: 0, count: 0 };
        relevantProductBreakdown[product].sales += parseFloat(item.usd_amount || 0);
        relevantProductBreakdown[product].count += 1;
        
        const customer = item.partner || item.customer_name || 'Bilinmiyor';
        if (!relevantCustomerBreakdown[customer]) relevantCustomerBreakdown[customer] = { sales: 0, count: 0 };
        relevantCustomerBreakdown[customer].sales += parseFloat(item.usd_amount || 0);
        relevantCustomerBreakdown[customer].count += 1;
    });
    
    const relevantStores = Object.entries(relevantStoreBreakdown)
        .map(([name, stats]) => ({ name, sales: stats.sales, count: stats.count }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    const relevantProducts = Object.entries(relevantProductBreakdown)
        .map(([name, stats]) => ({ name, sales: stats.sales, count: stats.count }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    const relevantCustomers = Object.entries(relevantCustomerBreakdown)
        .map(([name, stats]) => ({ name, sales: stats.sales, count: stats.count }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 30);
    
    // İlgili verilerden RAW DATA örnekleri (ilk 100 kayıt - AI'ın gerçek veriyi görmesi için)
    const relevantDataSamples = relevantData
        .slice(0, 100)
        .map(item => ({
            tarih: item.date || 'Bilinmiyor',
            mağaza: item.store || item.store_name || 'Bilinmiyor',
            ürün: item.product || item.product_name || 'Bilinmiyor',
            marka: item.brand || 'Bilinmiyor',
            kategori: item.category_1 || item.product_category || 'Bilinmiyor',
            müşteri: item.partner || item.customer_name || 'Bilinmiyor',
            şehir: item.city || item.partner_city || 'Bilinmiyor',
            satış_temsilcisi: item.sales_person || item.salesperson_name || 'Bilinmiyor',
            miktar: parseFloat(item.quantity || 0),
            satış_tutarı: parseFloat(item.usd_amount || 0),
            fatura: item.move_name || 'Bilinmiyor'
        }));
    
    // 5. TREND ANALİZİ (Aylık trend)
    const monthlyTrend = Object.entries(monthlyStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, stats]) => ({
            month,
            sales: stats.sales,
            count: stats.count,
            avgOrder: stats.count > 0 ? stats.sales / stats.count : 0
        }));
    
    // 6. CONTEXT OLUŞTURMA
    const activeChannels = typeof document !== 'undefined' && document.getElementById('channelFilterInfo') 
        ? document.getElementById('channelFilterInfo').textContent 
        : 'Tüm Kanallar';
    
    let context = `Sen bir satış analiz uzmanısın ve veri bilimcisisin. Aşağıdaki DETAYLI satış verileri hakkında sorulara yanıt ver:

=== 📊 GENEL ÖZET ===
Aktif Filtreler: ${activeChannels}
Toplam Kayıt: ${totalRecords.toLocaleString('tr-TR')}
Toplam Satış (USD): $${totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
Toplam Miktar: ${totalQuantity.toLocaleString('tr-TR', {minimumFractionDigits: 0})} adet
Ortalama Sipariş Değeri: $${avgOrderValue.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
Tarih Aralığı: ${dateRange ? `${dateRange.min} - ${dateRange.max}` : 'Belirtilmemiş'}

=== 🏆 TOP PERFORMERS (DETAYLI LİSTE) ===
EN İYİ 30 MAĞAZA:
${topStores.map((s, i) => `${i+1}. ${s.name}: $${s.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${s.count} sipariş, ${s.uniqueCustomers} müşteri, ${s.uniqueProducts} ürün, Ort: $${s.avgOrder.toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

EN İYİ 30 ÜRÜN:
${topProducts.map((p, i) => `${i+1}. ${p.name}: $${p.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${p.qty.toLocaleString('tr-TR')} adet, ${p.uniqueStores} mağaza, ${p.uniqueCustomers} müşteri, Ort Fiyat: $${p.avgPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

EN İYİ 30 MÜŞTERİ:
${topCustomers.map((c, i) => `${i+1}. ${c.name}: $${c.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${c.count} sipariş, ${c.uniqueStores} mağaza, ${c.uniqueProducts} ürün, Ort: $${c.avgOrder.toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

EN İYİ 30 SATIŞ TEMSİLCİSİ:
${topSalespersons.map((s, i) => `${i+1}. ${s.name}: $${s.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${s.count} sipariş, ${s.uniqueCustomers} müşteri, ${s.uniqueStores} mağaza, Ort: $${s.avgOrder.toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

EN İYİ 30 ŞEHİR:
${topCities.map((c, i) => `${i+1}. ${c.name}: $${c.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${c.count} sipariş, ${c.uniqueCustomers} müşteri, ${c.uniqueStores} mağaza)`).join('\n')}

EN İYİ 30 KATEGORİ:
${allCategoriesList.map((c, i) => `${i+1}. ${c.name}: $${c.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${c.count} sipariş, ${c.qty.toLocaleString('tr-TR')} adet, ${c.uniqueProducts} ürün)`).join('\n')}

EN İYİ 30 MARKA:
${allBrandsList.map((b, i) => `${i+1}. ${b.name}: $${b.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${b.count} sipariş, ${b.qty.toLocaleString('tr-TR')} adet, ${b.uniqueProducts} ürün)`).join('\n')}

=== 📈 TREND ANALİZİ ===
AYLIK SATIŞ TRENDİ (Son 12 ay):
${monthlyTrend.slice(-12).map(m => `${m.month}: $${m.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${m.count} sipariş, Ort: $${m.avgOrder.toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

YILLIK ÖZET:
${Object.entries(yearlyStats).map(([year, stats]) => `${year}: $${stats.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${stats.count} sipariş, ${stats.qty.toLocaleString('tr-TR')} adet)`).join('\n')}

=== 🔍 SORU İLE İLGİLİ DETAYLI VERİLER (CANLI ANALİZ) ===
${relevantCount > 0 ? `
"${query}" ile ilgili bulunan ${relevantCount.toLocaleString('tr-TR')} kayıt:

TOPLAM İSTATİSTİKLER:
- Toplam Satış: $${relevantSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
- Toplam Miktar: ${relevantQty.toLocaleString('tr-TR', {minimumFractionDigits: 0})} adet
- Kayıt Sayısı: ${relevantCount.toLocaleString('tr-TR')}
- Ortalama Sipariş: $${(relevantCount > 0 ? relevantSales / relevantCount : 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}
- Genel Toplam İçindeki Pay: %${((relevantSales / totalSales) * 100).toFixed(2)}
- Ortalama Ürün Fiyatı: $${(relevantQty > 0 ? relevantSales / relevantQty : 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}

MAĞAZA DAĞILIMI (Top 30):
${relevantStores.map(s => `- ${s.name}: $${s.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${s.count} sipariş, Ort: $${(s.count > 0 ? s.sales / s.count : 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

ÜRÜN DAĞILIMI (Top 30):
${relevantProducts.map(p => `- ${p.name}: $${p.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${p.count} sipariş, Ort: $${(p.count > 0 ? p.sales / p.count : 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

MÜŞTERİ DAĞILIMI (Top 30):
${relevantCustomers.map(c => `- ${c.name}: $${c.sales.toLocaleString('tr-TR', {minimumFractionDigits: 2})} (${c.count} sipariş, Ort: $${(c.count > 0 ? c.sales / c.count : 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})})`).join('\n')}

📋 GERÇEK VERİ ÖRNEKLERİ (İlk 100 Kayıt - RAW DATA):
${relevantDataSamples.slice(0, 100).map((item, idx) => 
    `${idx + 1}. Tarih: ${item.tarih} | Mağaza: ${item.mağaza} | Ürün: ${item.ürün} | Marka: ${item.marka} | Kategori: ${item.kategori} | Müşteri: ${item.müşteri} | Şehir: ${item.şehir} | Temsilci: ${item.satış_temsilcisi} | Miktar: ${item.miktar.toLocaleString('tr-TR')} | Tutar: $${item.satış_tutarı.toLocaleString('tr-TR', {minimumFractionDigits: 2})} | Fatura: ${item.fatura}`
).join('\n')}
` : `⚠️ "${query}" ile ilgili hiçbir kayıt bulunamadı. Yukarıdaki kategorilere bakarak benzer terimler önerebilirsin.`}

=== 📋 VERİ KATEGORİLERİ ÖZET ===
- Toplam ${Object.keys(storeStats).length} farklı mağaza
- Toplam ${Object.keys(productStats).length} farklı ürün
- Toplam ${Object.keys(customerStats).length} farklı müşteri
- Toplam ${Object.keys(cityStats).length} farklı şehir
- Toplam ${Object.keys(salespersonStats).length} farklı satış temsilcisi
- Toplam ${Object.keys(categoryStats).length} farklı kategori
- Toplam ${Object.keys(brandStats).length} farklı marka

=== ❓ KULLANICI SORUSU ===
${query}

=== 💡 YANIT TALİMATI (CANLI DİNAMİK ANALİZ) ===
Sen bir VERİ BİLİMCİSİ ve SATIŞ ANALİZ UZMANISIN. Yukarıdaki TÜM VERİLERİ analiz ederek CANLI ve DİNAMİK cevaplar üret.

TALİMATLAR:
1. TÜM VERİLERİ ANALİZ ET: Yukarıdaki tüm istatistikleri, top performers listelerini, trend analizlerini ve RAW DATA örneklerini detaylıca incele
2. CANLI HESAPLAMALAR YAP: Veriler üzerinden gerçek zamanlı hesaplamalar yap (büyüme oranları, karşılaştırmalar, yüzdeler)
3. DİNAMİK YANITLAR ÜRET: Kullanıcının sorusuna göre en ilgili verileri seç ve detaylı analiz yap
4. KARŞILAŞTIRMALAR: Farklı kategoriler arasında karşılaştırmalar yap (örn: "X mağazası Y mağazasından %Z daha fazla satış yapmış")
5. TREND ANALİZİ: Aylık/yıllık trendleri analiz et, artış/azalış tespit et, büyüme oranları hesapla
6. İSTATİSTİKSEL ÖZETLER: Ortalama, toplam, yüzde paylar, standart sapma gibi istatistiksel metrikler kullan
7. ÖNERİLER: Hangi mağaza/ürün/müşteri/temsilci daha iyi performans gösteriyor, nedenleriyle açıkla
8. RAW DATA YORUMLAMA: Gerçek veri örneklerini inceleyerek spesifik örnekler ver
9. FORMATLI GÖSTERİM: Sayısal verileri Türkçe formatında göster (örn: $1.234,56 veya 1.234 adet)
10. DETAYLI AÇIKLAMALAR: Her analizi detaylıca açıkla, neden-sonuç ilişkileri kur

ÖNEMLİ: Tüm verileri okuyup analiz et, sadece özetlere bakma. RAW DATA örneklerini de incele ve spesifik örnekler ver.`;
    
    return context;
}

/**
 * Öğrenme mekanizması (localStorage ile geçmiş sorular)
 */
export function saveQueryToHistory(query, response) {
    try {
        const history = JSON.parse(localStorage.getItem('ai_query_history') || '[]');
        history.push({
            query: query,
            response: response.substring(0, 500), // İlk 500 karakter
            timestamp: new Date().toISOString()
        });
        // Son 50 sorguyu sakla
        if (history.length > 50) {
            history.shift();
        }
        localStorage.setItem('ai_query_history', JSON.stringify(history));
    } catch (e) {
        safeConsole.warn('Query history kaydedilemedi:', e);
    }
}

/**
 * Geçmiş sorguları getir
 */
export function getQueryHistory() {
    try {
        return JSON.parse(localStorage.getItem('ai_query_history') || '[]');
    } catch (e) {
        return [];
    }
}

/**
 * AI sorgulama fonksiyonu (GPT API entegrasyonu)
 */
export async function askAI() {
    const queryInput = document.getElementById('aiQueryInput');
    const query = queryInput.value.trim();
    const responseContainer = document.getElementById('aiResponseContainer');
    const responseText = document.getElementById('aiResponseText');
    const loadingIndicator = document.getElementById('aiLoadingIndicator');
    const queryButton = document.getElementById('aiQueryButton');
    
    if (!query) {
        alert('⚠️ Lütfen bir soru girin!');
        return;
    }
    
    const AI_PROXY_URL = getAIProxyURL();
    
    // Backend proxy kontrolü
    if (!AI_PROXY_URL || AI_PROXY_URL === '') {
        alert('⚠️ Backend proxy endpoint tanımlanmamış!\n\nLütfen AI_PROXY_URL değişkenine backend proxy endpoint\'inizi girin.');
        return;
    }
    
    // Veri kontrolü
    const allData = window.allData || [];
    if (!allData || allData.length === 0) {
        alert('⚠️ Veriler henüz yüklenmedi. Lütfen bekleyin...');
        return;
    }
    
    // UI güncelle
    queryButton.disabled = true;
    queryButton.textContent = '⏳ Analiz ediliyor...';
    responseContainer.style.display = 'none';
    loadingIndicator.style.display = 'block';
    
    try {
        // Gelişmiş context oluştur (RAG benzeri)
        const context = buildAdvancedAIContext(query, allData);
        
        // Geçmiş sorguları context'e ekle (öğrenme)
        const history = getQueryHistory();
        const enhancedContext = history.length > 0
            ? context + `\n\n=== 📚 GEÇMİŞ SORULAR (Öğrenme) ===\nKullanıcının son 5 sorusu:\n${history.slice(-5).map(h => `- "${h.query}"`).join('\n')}\n\nBu geçmiş sorulara bakarak kullanıcının ilgi alanlarını anlayabilirsin.`
            : context;
        
        // Backend proxy üzerinden OpenAI API çağrısı
        const response = await fetch(AI_PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                context: enhancedContext,
                model: 'gpt-4o-mini'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || errorData.details || `API hatası: ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        const aiResponse = data.response || data.error || 'Yanıt alınamadı.';
        
        // Yanıtı göster ve kaydet
        responseText.innerHTML = aiResponse.replace(/\n/g, '<br>');
        responseContainer.style.display = 'block';
        saveQueryToHistory(query, aiResponse);
        
    } catch (error) {
        safeConsole.error('❌ AI sorgu hatası:', error);
        let errorMessage = 'Bilinmeyen hata oluştu.';
        
        if (error.message.includes('Failed to fetch') || error.message.includes('CSP') || error.message.includes('Content Security Policy')) {
            errorMessage = 'Backend proxy\'ye bağlanılamadı. Lütfen kontrol edin:<br><br><strong>Çözüm önerileri:</strong><br>1. Backend sunucusunun çalıştığından emin olun (http://localhost:3001/api/ai/health)<br>2. Tarayıcı konsolunu kontrol edin (F12) - CSP hatası olabilir<br>3. Backend sunucusunu başlatın: <code>cd api && node ai-proxy.js</code><br>4. Network bağlantınızı kontrol edin';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMessage = 'API key geçersiz veya yetkisiz. Lütfen API key\'inizi kontrol edin.';
        } else if (error.message.includes('429')) {
            errorMessage = 'Rate limit aşıldı. Lütfen birkaç saniye sonra tekrar deneyin.';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            if (error.message.includes('API key not configured') || error.message.includes('OPENAI_API_KEY')) {
                errorMessage = '❌ <strong>OpenAI API Key Tanımlı Değil!</strong><br><br>Vercel Production için:<br>1. Vercel Dashboard → Project Settings → Environment Variables<br>2. <code>OPENAI_API_KEY</code> ekleyin (değer: sk-proj-...)<br>3. Redeploy yapın<br><br>Development için:<br>1. <code>api/.env</code> dosyası oluşturun<br>2. <code>OPENAI_API_KEY=sk-proj-...</code> ekleyin<br>3. Backend\'i yeniden başlatın';
            } else {
                errorMessage = `OpenAI sunucu hatası: ${error.message}`;
            }
        } else {
            errorMessage = `Hata: ${error.message}`;
        }
        
        responseText.innerHTML = `<span style="color: #dc3545;">❌ ${errorMessage}</span>`;
        responseContainer.style.display = 'block';
    } finally {
        loadingIndicator.style.display = 'none';
        queryButton.disabled = false;
        queryButton.textContent = '🤖 Sor';
    }
}

// Global erişim için
window.analyzeQueryWithAI = analyzeQueryWithAI;
window.applyAIFilters = applyAIFilters;
window.filterDataWithAI = filterDataWithAI;
window.showAIInterpretation = showAIInterpretation;
window.performAdvancedAnalysis = performAdvancedAnalysis;
window.buildAdvancedAIContext = buildAdvancedAIContext;
window.askAI = askAI;
window.saveQueryToHistory = saveQueryToHistory;
window.getQueryHistory = getQueryHistory;

