/**
 * 🤖 ENHANCED AI ANALYZER
 * Zuhal Müzik Dashboard - Gelişmiş AI Analiz Modülü
 * 
 * ÖZELLİKLER:
 * - Dinamik AI analizleri (filtrelere göre güncellenir)
 * - Detaylı trend analizi
 * - Kritik nokta tespiti
 * - Olumlu/Olumsuz durum analizi
 * - Aksiyon önerileri
 * - Zaman serisi analizi
 */

const EnhancedAI = {
    
    /**
     * Genel trend analizi yapar
     */
    analyzeTrend(data, metric = 'usd_amount') {
        if (!data || data.length === 0) return null;
        
        const total = data.reduce((sum, item) => sum + (parseFloat(item[metric]) || 0), 0);
        const avg = total / data.length;
        
        // Yıllara göre grupla
        const yearlyData = {};
        data.forEach(item => {
            const year = item.date ? item.date.substring(0, 4) : 'Unknown';
            if (!yearlyData[year]) yearlyData[year] = { total: 0, count: 0 };
            yearlyData[year].total += parseFloat(item[metric]) || 0;
            yearlyData[year].count++;
        });
        
        const years = Object.keys(yearlyData).sort();
        
        // Trend hesapla (son 2 yıl karşılaştırması)
        let trend = 'stable';
        let trendPercent = 0;
        
        if (years.length >= 2) {
            const lastYear = years[years.length - 1];
            const prevYear = years[years.length - 2];
            
            const lastYearTotal = yearlyData[lastYear].total;
            const prevYearTotal = yearlyData[prevYear].total;
            
            if (prevYearTotal > 0) {
                trendPercent = ((lastYearTotal - prevYearTotal) / prevYearTotal) * 100;
                if (trendPercent > 5) trend = 'rising';
                else if (trendPercent < -5) trend = 'falling';
            }
        }
        
        return {
            total,
            avg,
            yearlyData,
            years,
            trend,
            trendPercent
        };
    },
    
    /**
     * Kritik noktaları tespit eder
     */
    findCriticalPoints(data, metric = 'usd_amount') {
        const points = {
            positive: [],
            negative: [],
            warnings: []
        };
        
        if (!data || data.length === 0) return points;
        
        const trend = this.analyzeTrend(data, metric);
        
        // OLU MSUZ DURUMLAR
        if (trend.trend === 'falling') {
            points.negative.push({
                type: 'trend',
                severity: 'high',
                message: `📉 ${Math.abs(trend.trendPercent).toFixed(1)}% düşüş trendi tespit edildi`
            });
        }
        
        if (trend.trendPercent < -20) {
            points.warnings.push({
                type: 'critical',
                severity: 'critical',
                message: `🚨 KRİTİK: %${Math.abs(trend.trendPercent).toFixed(1)} ciddi düşüş!`
            });
        }
        
        // OLUMLU DURUMLAR
        if (trend.trend === 'rising') {
            points.positive.push({
                type: 'trend',
                severity: 'good',
                message: `📈 ${trend.trendPercent.toFixed(1)}% büyüme trendi`
            });
        }
        
        if (trend.trendPercent > 20) {
            points.positive.push({
                type: 'growth',
                severity: 'excellent',
                message: `🚀 MÜKEMMEL: %${trend.trendPercent.toFixed(1)} güçlü büyüme!`
            });
        }
        
        // Sezonsal analiz
        const monthlyPattern = this.analyzeSeasonality(data, metric);
        if (monthlyPattern.hasPattern) {
            points.positive.push({
                type: 'seasonality',
                severity: 'info',
                message: `📅 En yoğun ay: ${monthlyPattern.peakMonth}`
            });
        }
        
        return points;
    },
    
    /**
     * Sezonsal analiz
     */
    analyzeSeasonality(data, metric = 'usd_amount') {
        const monthlyData = {};
        
        data.forEach(item => {
            if (!item.date) return;
            const month = item.date.substring(5, 7);
            if (!monthlyData[month]) monthlyData[month] = 0;
            monthlyData[month] += parseFloat(item[metric]) || 0;
        });
        
        const months = Object.keys(monthlyData);
        if (months.length === 0) return { hasPattern: false };
        
        let maxMonth = months[0];
        let maxValue = monthlyData[months[0]];
        
        months.forEach(month => {
            if (monthlyData[month] > maxValue) {
                maxValue = monthlyData[month];
                maxMonth = month;
            }
        });
        
        const monthNames = {
            '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
            '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
            '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
        };
        
        return {
            hasPattern: true,
            peakMonth: monthNames[maxMonth] || maxMonth,
            monthlyData
        };
    },
    
    /**
     * Aksiyon önerileri üretir
     */
    generateActionItems(criticalPoints, context = {}) {
        const actions = [];
        
        // Negatif durumlar için aksiyonlar
        criticalPoints.negative.forEach(point => {
            if (point.type === 'trend') {
                actions.push({
                    priority: 'high',
                    action: '🎯 Satış stratejisi gözden geçirilmeli',
                    reason: 'Düşüş trendi devam ediyor'
                });
                actions.push({
                    priority: 'high',
                    action: '👥 Müşteri memnuniyeti analizi yapılmalı',
                    reason: 'Satışlar azalıyor'
                });
            }
        });
        
        // Uyarılar için aksiyonlar
        criticalPoints.warnings.forEach(point => {
            if (point.severity === 'critical') {
                actions.push({
                    priority: 'critical',
                    action: '🚨 ACİL: Yönetim toplantısı gerekli',
                    reason: 'Kritik düşüş seviyesi'
                });
                actions.push({
                    priority: 'critical',
                    action: '📊 Detaylı veri analizi yapılmalı',
                    reason: 'Düşüşün kök nedeni bulunmalı'
                });
            }
        });
        
        // Pozitif durumlar için aksiyonlar
        criticalPoints.positive.forEach(point => {
            if (point.type === 'growth') {
                actions.push({
                    priority: 'medium',
                    action: '✅ Başarılı stratejiler belgelenmeli',
                    reason: 'Güçlü büyüme var'
                });
                actions.push({
                    priority: 'medium',
                    action: '📈 Büyüme momentumu korunmalı',
                    reason: 'Trend olumlu'
                });
            }
        });
        
        // Genel öneriler
        if (actions.length === 0) {
            actions.push({
                priority: 'low',
                action: '📊 Düzenli takip sürdürülmeli',
                reason: 'Stabil durum'
            });
        }
        
        return actions;
    },
    
    /**
     * Kapsamlı AI analizi üretir
     */
    generateComprehensiveAnalysis(data, options = {}) {
        const {
            metric = 'usd_amount',
            context = {},
            filterInfo = ''
        } = options;
        
        if (!data || data.length === 0) {
            return `
                <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Veri Bulunamadı</h4>
                    <p style="margin: 0; color: #856404;">Seçilen filtreler için analiz edilecek veri bulunmamaktadır.</p>
                </div>
            `;
        }
        
        const trend = this.analyzeTrend(data, metric);
        const critical = this.findCriticalPoints(data, metric);
        const actions = this.generateActionItems(critical, context);
        const seasonality = this.analyzeSeasonality(data, metric);
        
        // HTML oluştur
        let html = '';
        
        // Filtre bilgisi
        if (filterInfo) {
            html += `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
                    <strong>🔍 Aktif Filtre:</strong> ${filterInfo}
                </div>
            `;
        }
        
        // Genel durum
        const trendIcon = trend.trend === 'rising' ? '📈' : trend.trend === 'falling' ? '📉' : '➡️';
        const trendColor = trend.trend === 'rising' ? '#4caf50' : trend.trend === 'falling' ? '#f44336' : '#ff9800';
        
        html += `
            <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #333;">📊 Genel Durum</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666;">Toplam Satış</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: #333;">$${trend.total.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666;">Trend</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: ${trendColor};">${trendIcon} ${trend.trendPercent.toFixed(1)}%</div>
                    </div>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666;">Kayıt Sayısı</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: #333;">${data.length.toLocaleString('tr-TR')}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Kritik noktalar - OLUMSUZ
        if (critical.warnings.length > 0 || critical.negative.length > 0) {
            html += `
                <div style="background: #ffebee; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #f44336;">
                    <h4 style="margin: 0 0 15px 0; color: #c62828;">⚠️ Olumsuz Durumlar ve Riskler</h4>
            `;
            
            critical.warnings.forEach(warning => {
                html += `<div style="padding: 10px; background: white; border-radius: 5px; margin-bottom: 10px;">${warning.message}</div>`;
            });
            
            critical.negative.forEach(neg => {
                html += `<div style="padding: 10px; background: white; border-radius: 5px; margin-bottom: 10px;">${neg.message}</div>`;
            });
            
            html += `</div>`;
        }
        
        // Kritik noktalar - OLUMLU
        if (critical.positive.length > 0) {
            html += `
                <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                    <h4 style="margin: 0 0 15px 0; color: #2e7d32;">✅ Olumlu Durumlar ve Fırsatlar</h4>
            `;
            
            critical.positive.forEach(pos => {
                html += `<div style="padding: 10px; background: white; border-radius: 5px; margin-bottom: 10px;">${pos.message}</div>`;
            });
            
            html += `</div>`;
        }
        
        // Aksiyon önerileri
        if (actions.length > 0) {
            html += `
                <div style="background: #fff9c4; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #fbc02d;">
                    <h4 style="margin: 0 0 15px 0; color: #f57f17;">🎯 Önerilen Aksiyonlar</h4>
            `;
            
            // Önceliğe göre sırala
            const sortedActions = actions.sort((a, b) => {
                const priority = { critical: 0, high: 1, medium: 2, low: 3 };
                return priority[a.priority] - priority[b.priority];
            });
            
            sortedActions.forEach(action => {
                const priorityColors = {
                    critical: '#d32f2f',
                    high: '#f57c00',
                    medium: '#1976d2',
                    low: '#388e3c'
                };
                
                html += `
                    <div style="padding: 10px; background: white; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid ${priorityColors[action.priority]};">
                        <strong>${action.action}</strong><br>
                        <small style="color: #666;">${action.reason}</small>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        // Sezonsal bilgi
        if (seasonality.hasPattern) {
            html += `
                <div style="background: #e1f5fe; padding: 20px; border-radius: 10px; border-left: 4px solid #03a9f4;">
                    <h4 style="margin: 0 0 10px 0; color: #01579b;">📅 Sezonsal Analiz</h4>
                    <p style="margin: 0; color: #01579b;">
                        En yoğun satış ayı: <strong>${seasonality.peakMonth}</strong><br>
                        <small>Bu ay için özel kampanyalar ve stok planlaması yapılabilir.</small>
                    </p>
                </div>
            `;
        }
        
        return html;
    }
};

// Global erişim
window.EnhancedAI = EnhancedAI;

console.log('🤖 Enhanced AI Analyzer yüklendi');

