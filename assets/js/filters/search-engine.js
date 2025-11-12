/**
 * SEARCH-ENGINE.JS - Akıllı Arama Motoru
 */

import { safeConsole } from '../core/logger.js';

/**
 * Akıllı arama uygula (AI destekli)
 */
export function applySmartSearch() {
    const query = document.getElementById('smartSearch')?.value?.trim();
    if (!query) {
        // Boş sorgu - filtreleri sıfırla
        if (typeof window.resetFilters === 'function') {
            window.resetFilters();
        }
        return;
    }
    
    safeConsole.log('🤖 AI AGENT BAŞLATILIYOR...');
    safeConsole.log('📝 Sorgu:', query);
    
    // Önce filtreleri sıfırla
    if (typeof window.resetFilters === 'function') {
        window.resetFilters();
    }
    
    // AI ile sorguyu analiz et
    if (typeof window.analyzeQueryWithAI === 'function' && window.allData) {
        const aiAnalysis = window.analyzeQueryWithAI(query);
        safeConsole.log('🧠 AI Analiz Sonucu:', aiAnalysis);
        
        // Filtreleri uygula
        if (typeof window.applyAIFilters === 'function') {
            window.applyAIFilters(aiAnalysis);
        }
        
        // Veriyi filtrele
        if (typeof window.filterDataWithAI === 'function') {
            window.filteredData = window.filterDataWithAI(window.allData, aiAnalysis);
            safeConsole.log(`✅ AI Agent Sonucu: ${window.filteredData.length} kayıt bulundu`);
            
            // Gelişmiş soru tipleri için özel analiz
            if (aiAnalysis.queryType !== 'basic') {
                if (typeof window.performAdvancedAnalysis === 'function') {
                    window.performAdvancedAnalysis(aiAnalysis, window.filteredData);
                }
            } else {
                // Kullanıcıya AI'nın ne anladığını göster
                if (typeof window.showAIInterpretation === 'function') {
                    window.showAIInterpretation(aiAnalysis, window.filteredData.length);
                }
            }
            
            // Tabloyu ve özeti güncelle
            if (typeof window.updateSummary === 'function') {
                window.updateSummary();
            }
            if (typeof window.renderTable === 'function') {
                window.renderTable();
            }
        }
    } else {
        // Fallback: Basit metin araması
        if (window.allData) {
            const searchLower = query.toLowerCase();
            window.filteredData = window.allData.filter(item => {
                const searchableText = [
                    item.partner, item.product, item.brand,
                    item.category_1, item.category_2, item.category_3, item.category_4,
                    item.sales_person, item.store, item.city
                ].filter(Boolean).join(' ').toLowerCase();
                
                return searchableText.includes(searchLower);
            });
            
            if (typeof window.renderTable === 'function') {
                window.renderTable();
            }
            if (typeof window.updateSummary === 'function') {
                window.updateSummary();
            }
        }
    }
}

/**
 * Fuzzy matching (benzerlik skoru)
 */
export function fuzzyMatch(query, target) {
    const queryWords = query.split(/\s+/);
    const targetLower = target.toLowerCase();
    return queryWords.some(word => {
        if (word.length < 3) return false;
        return targetLower.includes(word) || levenshteinDistance(word, targetLower) < 3;
    });
}

/**
 * Levenshtein Distance (düzenleme mesafesi)
 */
export function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Global erişim için
window.applySmartSearch = applySmartSearch;
window.fuzzyMatch = fuzzyMatch;
window.levenshteinDistance = levenshteinDistance;

