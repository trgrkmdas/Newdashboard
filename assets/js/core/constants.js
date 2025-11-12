/**
 * CONSTANTS.JS - Sabitler ve Enum'lar
 */

// Metadata Storage Key
export const METADATA_STORAGE_KEY = 'zuhaMetadataLastUpdate';

// Store Working Hours (mağaza çalışma saatleri ve kapalılıkları)
export const STORE_WORKING_HOURS = {
    // Özel saatli mağazalar (10:00-20:00, Pazar kapalı)
    'Tünel': { openHour: 10, closeHour: 20, closedDays: [0] }, // 0 = Pazar
    'İzmir': { openHour: 10, closeHour: 20, closedDays: [0] },
    'Antalya': { openHour: 10, closeHour: 20, closedDays: [0] },
    'Kızılay': { openHour: 10, closeHour: 20, closedDays: [0] },
    // Default: Tüm diğer mağazalar (10:00-22:00, 7 gün açık)
    'default': { openHour: 10, closeHour: 22, closedDays: [] }
};

// Payment pagination
export const PAYMENT_ITEMS_PER_PAGE = 500;

// Store mapping
export const STORE_MAPPING = {
    'perakende': 'perakende',
    'toptan': 'toptan',
    'online': 'online',
    'kurumsal': 'corporate',
    'merkezi': 'central'
};

