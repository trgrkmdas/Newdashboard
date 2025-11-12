/**
 * ⏰ ENHANCED TIME ANALYSIS
 * Zuhal Müzik Dashboard - Gelişmiş Zaman Analizi Modülü
 * 
 * KRİTİK: Hatasız, detaylı, doğru analiz
 * 
 * ÖZELLİKLER:
 * - Saatlik yoğunluk analizi
 * - Günlük pattern tespiti
 * - Mesai saati vs mesai dışı karşılaştırma
 * - Hafta içi vs hafta sonu analizi
 * - Kategori bazlı zaman analizi
 * - Mağaza bazlı zaman analizi
 */

const TimeAnalysisEnhanced = {
    
    /**
     * Saatlik veri analizi - HATALIsız
     */
    analyzeHourly(data) {
        const hourData = Array(24).fill(0).map(() => ({ sales: 0, qty: 0, count: 0 }));
        
        data.forEach(item => {
            let hour = 0;
            
            // Saat bilgisini güvenli şekilde al
            if (item.create_hour !== undefined && item.create_hour !== null) {
                hour = parseInt(item.create_hour);
            } else if (item.date && item.date.length >= 13) {
                // "2025-01-15 14:30:00" formatından saat çıkar
                const hourMatch = item.date.match(/\s(\d{2}):/);
                if (hourMatch) {
                    hour = parseInt(hourMatch[1]);
                }
            }
            
            // Saat geçerli mi kontrol et (0-23 arası)
            if (hour >= 0 && hour < 24) {
                hourData[hour].sales += parseFloat(item.usd_amount) || 0;
                hourData[hour].qty += parseInt(item.qty) || 0;
                hourData[hour].count++;
            }
        });
        
        return hourData;
    },
    
    /**
     * Gün analizi - Hafta içi vs Hafta sonu
     */
    analyzeDays(data) {
        const dayData = {
            weekday: { sales: 0, qty: 0, count: 0 },
            weekend: { sales: 0, qty: 0, count: 0 },
            byDay: Array(7).fill(0).map(() => ({ sales: 0, qty: 0, count: 0 }))
        };
        
        data.forEach(item => {
            if (!item.date) return;
            
            // Tarihi parse et
            const date = new Date(item.date);
            if (isNaN(date.getTime())) return; // Geçersiz tarih
            
            const dayOfWeek = date.getDay(); // 0=Pazar, 6=Cumartesi
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            
            const sales = parseFloat(item.usd_amount) || 0;
            const qty = parseInt(item.qty) || 0;
            
            // Hafta içi/sonu
            if (isWeekend) {
                dayData.weekend.sales += sales;
                dayData.weekend.qty += qty;
                dayData.weekend.count++;
            } else {
                dayData.weekday.sales += sales;
                dayData.weekday.qty += qty;
                dayData.weekday.count++;
            }
            
            // Günlere göre
            dayData.byDay[dayOfWeek].sales += sales;
            dayData.byDay[dayOfWeek].qty += qty;
            dayData.byDay[dayOfWeek].count++;
        });
        
        return dayData;
    },
    
    /**
     * Mesai saati analizi
     */
    analyzeWorkHours(data) {
        const workHours = { sales: 0, qty: 0, count: 0 }; // 09:00-18:00
        const afterHours = { sales: 0, qty: 0, count: 0 }; // Diğer saatler
        
        data.forEach(item => {
            let hour = 0;
            
            if (item.create_hour !== undefined && item.create_hour !== null) {
                hour = parseInt(item.create_hour);
            } else if (item.date) {
                const hourMatch = item.date.match(/\s(\d{2}):/);
                if (hourMatch) hour = parseInt(hourMatch[1]);
            }
            
            const sales = parseFloat(item.usd_amount) || 0;
            const qty = parseInt(item.qty) || 0;
            
            if (hour >= 9 && hour < 18) {
                workHours.sales += sales;
                workHours.qty += qty;
                workHours.count++;
            } else {
                afterHours.sales += sales;
                afterHours.qty += qty;
                afterHours.count++;
            }
        });
        
        return { workHours, afterHours };
    },
    
    /**
     * En yoğun zaman dilimlerini bulur
     */
    findPeakTimes(hourData) {
        let peakHour = 0;
        let peakSales = 0;
        
        hourData.forEach((data, hour) => {
            if (data.sales > peakSales) {
                peakSales = data.sales;
                peakHour = hour;
            }
        });
        
        // Sabah, öğle, akşam kategorileri
        const timeSlots = {
            morning: { start: 6, end: 12, sales: 0, label: '🌅 Sabah (06:00-12:00)' },
            afternoon: { start: 12, end: 18, sales: 0, label: '☀️ Öğle (12:00-18:00)' },
            evening: { start: 18, end: 24, sales: 0, label: '🌙 Akşam (18:00-24:00)' },
            night: { start: 0, end: 6, sales: 0, label: '🌃 Gece (00:00-06:00)' }
        };
        
        hourData.forEach((data, hour) => {
            if (hour >= 6 && hour < 12) timeSlots.morning.sales += data.sales;
            else if (hour >= 12 && hour < 18) timeSlots.afternoon.sales += data.sales;
            else if (hour >= 18 && hour < 24) timeSlots.evening.sales += data.sales;
            else timeSlots.night.sales += data.sales;
        });
        
        return { peakHour, peakSales, timeSlots };
    },
    
    /**
     * Kapsamlı zaman analizi AI raporu
     */
    generateTimeAIAnalysis(data, filterInfo = '') {
        if (!data || data.length === 0) {
            return `
                <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Veri Bulunamadı</h4>
                    <p style="margin: 0; color: #856404;">Seçilen filtreler için analiz edilecek veri bulunmamaktadır.</p>
                </div>
            `;
        }
        
        const hourData = this.analyzeHourly(data);
        const dayData = this.analyzeDays(data);
        const workData = this.analyzeWorkHours(data);
        const peakInfo = this.findPeakTimes(hourData);
        
        let html = '';
        
        // Filtre bilgisi
        if (filterInfo) {
            html += `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
                    <strong>🔍 Aktif Filtre:</strong> ${filterInfo}
                </div>
            `;
        }
        
        // Genel özet
        const totalSales = data.reduce((sum, item) => sum + (parseFloat(item.usd_amount) || 0), 0);
        
        html += `
            <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #333;">⏰ Zaman Analizi Özeti</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666;">Toplam Satış</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: #333;">$${totalSales.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</div>
                    </div>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666;">En Yoğun Saat</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: #ff9800;">${peakInfo.peakHour}:00</div>
                    </div>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666;">İşlem Sayısı</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: #333;">${data.length.toLocaleString('tr-TR')}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Zaman dilimi analizi
        const sortedSlots = Object.values(peakInfo.timeSlots).sort((a, b) => b.sales - a.sales);
        
        html += `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; margin-bottom: 20px; color: white;">
                <h4 style="margin: 0 0 15px 0;">🕐 Zaman Dilimi Performansı</h4>
        `;
        
        sortedSlots.forEach((slot, index) => {
            const percent = totalSales > 0 ? (slot.sales / totalSales * 100).toFixed(1) : 0;
            const badge = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊';
            
            html += `
                <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${badge} ${slot.label}</span>
                        <strong>$${slot.sales.toLocaleString('tr-TR', {minimumFractionDigits: 0})} (%${percent})</strong>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        
        // Mesai saati vs Mesai dışı
        const workPercent = workData.workHours.count > 0 ? 
            ((workData.workHours.sales / (workData.workHours.sales + workData.afterHours.sales)) * 100).toFixed(1) : 0;
        
        html += `
            <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                <h4 style="margin: 0 0 15px 0; color: #2e7d32;">💼 Mesai Saati Analizi</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: white; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">Mesai Saati (09:00-18:00)</div>
                        <div style="font-size: 1.3em; font-weight: bold; color: #4caf50;">$${workData.workHours.sales.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</div>
                        <div style="font-size: 0.85em; color: #666;">${workData.workHours.count.toLocaleString('tr-TR')} işlem (%${workPercent})</div>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">Mesai Dışı</div>
                        <div style="font-size: 1.3em; font-weight: bold; color: #ff9800;">$${workData.afterHours.sales.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</div>
                        <div style="font-size: 0.85em; color: #666;">${workData.afterHours.count.toLocaleString('tr-TR')} işlem (%${(100-workPercent).toFixed(1)})</div>
                    </div>
                </div>
            </div>
        `;
        
        // Hafta içi vs Hafta sonu
        const weekdayPercent = dayData.weekday.count > 0 ?
            ((dayData.weekday.sales / (dayData.weekday.sales + dayData.weekend.sales)) * 100).toFixed(1) : 0;
        
        html += `
            <div style="background: #e1f5fe; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #03a9f4;">
                <h4 style="margin: 0 0 15px 0; color: #01579b;">📅 Hafta İçi / Hafta Sonu Karşılaştırması</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: white; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">Hafta İçi</div>
                        <div style="font-size: 1.3em; font-weight: bold; color: #03a9f4;">$${dayData.weekday.sales.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</div>
                        <div style="font-size: 0.85em; color: #666;">${dayData.weekday.count.toLocaleString('tr-TR')} işlem (%${weekdayPercent})</div>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">Hafta Sonu</div>
                        <div style="font-size: 1.3em; font-weight: bold; color: #ff5722;">$${dayData.weekend.sales.toLocaleString('tr-TR', {minimumFractionDigits: 0})}</div>
                        <div style="font-size: 0.85em; color: #666;">${dayData.weekend.count.toLocaleString('tr-TR')} işlem (%${(100-weekdayPercent).toFixed(1)})</div>
                    </div>
                </div>
            </div>
        `;
        
        // KRİTİK TESTİTLER VE ÖNERİLER
        html += `
            <div style="background: #fff9c4; padding: 20px; border-radius: 10px; border-left: 4px solid #fbc02d;">
                <h4 style="margin: 0 0 15px 0; color: #f57f17;">🎯 Kritik Tespitler ve Öneriler</h4>
        `;
        
        // Tespit 1: En yoğun saat
        html += `
            <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <strong>✅ En Yoğun Saat:</strong> ${peakInfo.peakHour}:00<br>
                <small style="color: #666;">💡 Öneri: Bu saatte personel sayısı artırılmalı ve stok hazır tutulmalı.</small>
            </div>
        `;
        
        // Tespit 2: Mesai saati dışı
        if (workData.afterHours.sales > workData.workHours.sales * 0.3) {
            html += `
                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <strong>⚠️ Mesai Dışı Yüksek:</strong> Toplam satışın %${(100-workPercent).toFixed(1)}'i mesai dışında<br>
                    <small style="color: #666;">💡 Öneri: Mesai dışı sipariş/online satış fırsatları değerlendirilmeli.</small>
                </div>
            `;
        }
        
        // Tespit 3: Hafta sonu
        if (dayData.weekend.count > 0) {
            const weekendPerDay = dayData.weekend.sales / 2; // 2 gün
            const weekdayPerDay = dayData.weekday.sales / 5; // 5 gün
            
            if (weekendPerDay > weekdayPerDay) {
                html += `
                    <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                        <strong>✅ Hafta Sonu Güçlü:</strong> Günlük ortalama hafta sonunda daha yüksek<br>
                        <small style="color: #666;">💡 Öneri: Hafta sonu kampanyaları genişletilebilir.</small>
                    </div>
                `;
            } else {
                html += `
                    <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                        <strong>⚠️ Hafta Sonu Potansiyel:</strong> Hafta içi günlük ortalama daha yüksek<br>
                        <small style="color: #666;">💡 Öneri: Hafta sonu özel kampanyalar düzenlenebilir.</small>
                    </div>
                `;
            }
        }
        
        // Tespit 4: Gece satışları
        if (peakInfo.timeSlots.night.sales > totalSales * 0.05) {
            html += `
                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <strong>🌃 Gece Satışları:</strong> Gece saatlerinde önemli satış var (%${((peakInfo.timeSlots.night.sales/totalSales)*100).toFixed(1)})<br>
                    <small style="color: #666;">💡 Öneri: Online sipariş sistemi ve 24 saat destek değerlendirilmeli.</small>
                </div>
            `;
        }
        
        html += `</div>`;
        
        return html;
    }
};

// Global erişim
window.TimeAnalysisEnhanced = TimeAnalysisEnhanced;

console.log('⏰ Enhanced Time Analysis yüklendi');

