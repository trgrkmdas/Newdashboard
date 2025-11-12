/**
 * UTILS.JS - Yardımcı Fonksiyonlar
 */

/**
 * Günlük versiyon oluştur (cache busting için)
 * Format: YYYYMMDD
 */
export function getDailyVersion() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Saatlik versiyon oluştur (metadata cache için)
 * Format: YYYYMMDDHH
 */
export function getHourlyVersion() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return `${year}${month}${day}${hour}`;
}

/**
 * Store adını normalize et (stock-locations mapping için)
 */
export function normalizeStoreName(storeName) {
    if (!storeName) return '';
    
    // "Perakende - " kısmını kaldır
    const cleaned = storeName.replace('Perakende - ', '');
    
    // Küçük harfe çevir ve boşlukları temizle
    const normalized = cleaned.toLowerCase().trim();
    
    // Mapping tablosu (satış verisindeki mağaza isimleri -> stock-locations'daki değerler)
    const storeMapping = {
        'kentpark': 'KENTPARK',
        'akasya': 'AKASYA',
        'tünel': 'TÜNEL',
        'izmir': 'İzmir',
        'kızılay': 'KIZILAY',
        'hilltown': 'Hilltown',
        'kanyon': 'KANYON',
        'antalya': 'ANTALYA',
        'adana': 'ADANA',
        'bursa': 'BURSA',
        'uniq': 'UNIQ',
        'mavibahçe': 'MAVİBAHÇE',
        'temaworld': 'TEMAWORLD',
        'bodrum': 'BODRUM',
        'outlet': 'OUTLET'
    };
    
    // Eşleşme ara
    for (const [key, value] of Object.entries(storeMapping)) {
        if (normalized.includes(key)) {
            return value;
        }
    }
    
    return storeName; // Eşleşme yoksa orijinal ismi döndür
}

/**
 * Güvenli element güncelleme
 */
export function safeUpdateElement(id, value, formatter = null) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = formatter ? formatter(value) : value;
    }
}

