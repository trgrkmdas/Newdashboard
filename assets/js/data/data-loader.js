/**
 * DATA-LOADER.JS - Veri Yükleme Fonksiyonları
 */

import { getDailyVersion } from '../core/utils.js';
import { safeConsole } from '../core/logger.js';
import { getLoadedYears, setLoadedYears, getLoadedDataCache, setLoadedDataCache, loadMetadata } from './metadata-manager.js';
import { applyDiscountLogic, isDiscountProduct } from './data-processor.js';
import { getWorkerManager, initWorkerManager } from '../core/worker-manager.js';
import { getCache, initCache } from '../core/indexeddb-cache.js';
import { getDataViewManager } from '../core/data-view-manager.js';
import { StreamingJSONParser } from '../core/streaming-json-parser.js';

// Global state'i metadata-manager'dan al
let loadedYears = getLoadedYears();
let loadedDataCache = getLoadedDataCache();

// Loading guard - aynı anda birden fazla çağrılmasını önler
let dataLoadPromise = null;
let loadDataCallCount = 0; // Debug için çağrı sayacı
let originalLoadCentralTargets = null;

// AŞAMA 2: Worker Manager - eager initialization (sayfa yüklendiğinde başlat)
let workerManager = null;
let workerManagerInitPromise = null;

/**
 * Worker Manager'ı başlat (eager initialization - sayfa yüklendiğinde)
 */
async function ensureWorkerManager() {
    if (!workerManagerInitPromise) {
        workerManagerInitPromise = initWorkerManager().then(manager => {
            workerManager = manager;
            return manager;
        }).catch(error => {
            safeConsole.warn('⚠️ Worker Manager başlatılamadı, fallback kullanılacak:', error);
            workerManager = getWorkerManager(); // Fallback için instance al
            return workerManager;
        });
    }
    return workerManagerInitPromise;
}

// AŞAMA 3: IndexedDB Cache - eager initialization
let cacheInstance = null;
let cacheInitPromise = null;

/**
 * Cache'i başlat (eager initialization)
 */
async function ensureCache() {
    if (!cacheInitPromise) {
        cacheInitPromise = initCache().then(cache => {
            cacheInstance = cache;
            return cache;
        }).catch(error => {
            safeConsole.warn('⚠️ Cache başlatılamadı, cache kullanılmayacak:', error);
            cacheInstance = getCache(); // Fallback için instance al
            return cacheInstance;
        });
    }
    return cacheInitPromise;
}

// AŞAMA 3 OPTİMİZASYON: Cache ve Worker'ı sayfa yüklendiğinde hemen başlat
if (typeof window !== 'undefined') {
    // Sayfa yüklendiğinde Cache ve Worker'ı başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ensureCache().catch(() => {
                // Sessizce devam et, cache kullanılmayacak
            });
            ensureWorkerManager().catch(() => {
                // Sessizce devam et, fallback kullanılacak
            });
        });
    } else {
        // Sayfa zaten yüklendi
        ensureCache().catch(() => {
            // Sessizce devam et, cache kullanılmayacak
        });
        ensureWorkerManager().catch(() => {
            // Sessizce devam et, fallback kullanılacak
        });
    }
}

/**
 * Yıl verisini yükle (JSON formatında, sıkıştırma yok)
 */
export async function loadYearData(year, forceReload = false) {
    // PERFORMANS LOG: Başlangıç zamanını kaydet
    const startTime = performance.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    // AŞAMA 3: Memory cache kontrolü (öncelikli)
    if (!forceReload && loadedYears.has(year) && loadedDataCache[year]) {
        const cacheHitTime = performance.now() - startTime;
        safeConsole.log(`⏭️ ${year} zaten yüklü, memory cache'den döndürülüyor... (${cacheHitTime.toFixed(2)}ms)`);
        return loadedDataCache[year];
    }
    
    try {
            safeConsole.log(`📦 ${year} yükleniyor...`);
            safeConsole.log(`🔍 PERFORMANS DEBUG - ${year}: Başlangıç zamanı: ${startTime.toFixed(2)}ms, Memory: ${(startMemory / 1024 / 1024).toFixed(2)}MB`);
            
            // AŞAMA 3: IndexedDB Cache kontrolü
            const cache = await ensureCache();
            if (!forceReload && cache && cache.isSupported) {
                const cachedData = await cache.get(year);
                if (cachedData) {
                    safeConsole.log(`✅ ${year} IndexedDB cache'den yüklendi (çok hızlı!)`);
                    
                    // Memory cache'e de ekle
                    loadedDataCache[year] = cachedData;
                    loadedYears.add(year);
                    setLoadedDataCache(loadedDataCache);
                    setLoadedYears(loadedYears);
                    
                    // Cache'den yükleme durumunda da progress güncelle (spinner kapatılmaz, tüm yıllar bittiğinde kapatılacak)
                    if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                        window.PerformanceOptimizer.LoadingManager.updateProgress(100, `✅ ${year} yüklendi!`, `${cachedData?.details?.length || 0} kayıt yüklendi`);
                    }
                    
                    return cachedData;
                }
            }
            
            // Progress indicator göster
            if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                window.PerformanceOptimizer.LoadingManager.show(
                    `📦 ${year} verisi yükleniyor...`,
                    'Dosya indiriliyor...'
                );
                window.PerformanceOptimizer.LoadingManager.setProgress(5);
            }
            
            const version = getDailyVersion();
            const dataUrl = `data-${year}.json?v=${version}`;
            
            // PERFORMANS LOG: Fetch başlangıcı
            const fetchStartTime = performance.now();
            safeConsole.log(`🔍 PERFORMANS DEBUG - ${year}: Fetch başlatılıyor: ${dataUrl}`);
            
            let response;
            try {
                response = await fetch(dataUrl, {
                    headers: {
                        'Cache-Control': 'public, max-age=86400' // 24 saat cache
                    }
                });
            } catch (fetchError) {
                throw new Error(`${year} verisi yüklenemedi: ${fetchError.message}`);
            }
            
            // PERFORMANS LOG: Fetch tamamlandı
            const fetchEndTime = performance.now();
            const fetchDuration = fetchEndTime - fetchStartTime;
            const contentLength = response.headers.get('content-length');
            safeConsole.log(`🔍 PERFORMANS DEBUG - ${year}: Fetch tamamlandı (${fetchDuration.toFixed(2)}ms), Boyut: ${contentLength ? (contentLength / 1024 / 1024).toFixed(2) + 'MB' : 'bilinmiyor'}`);
            
            // Response kontrolü
            const contentType = response.headers.get('content-type') || '';
            if (!response.ok) {
                if (contentType.includes('text/html')) {
                    throw new Error(`${year} verisi bulunamadı - Dosya mevcut değil (404)`);
                }
                throw new Error(`${year} verisi bulunamadı (${response.status}: ${response.statusText})`);
            }
            
            // Progress: Dosya indirildi
            if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                window.PerformanceOptimizer.LoadingManager.updateProgress(15, `📦 ${year} verisi yükleniyor...`, 'Dosya indirildi, parse ediliyor...');
            }
            
            // PERFORMANS LOG: ArrayBuffer başlangıcı
            const arrayBufferStartTime = performance.now();
            const arrayBuffer = await response.arrayBuffer();
            const arrayBufferEndTime = performance.now();
            const arrayBufferDuration = arrayBufferEndTime - arrayBufferStartTime;
            safeConsole.log(`🔍 PERFORMANS DEBUG - ${year}: ArrayBuffer oluşturuldu (${arrayBufferDuration.toFixed(2)}ms), Boyut: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
            
            // 🚀 HİZMET 1: Streaming JSON Parser ile Progressive UI Updates
            let yearData;
            const parseStartTime = performance.now();
            
            try {
                const workerManager = await ensureWorkerManager();
                
                if (workerManager && workerManager.isAvailable()) {
                    // Worker kullanılabilir - Streaming JSON Parser ile parse et
                    safeConsole.log(`🚀 ${year} Streaming JSON Parser ile Worker'da parse ediliyor...`);
                    
                    // Progressive UI Updates için callback'ler
                    const onProgress = (progress, message) => {
                        if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                            // Progress'i 15-90 arasına map et
                            const mappedProgress = 15 + (progress * 0.75); // 15-90 arası
                            window.PerformanceOptimizer.LoadingManager.updateProgress(
                                mappedProgress,
                                `📦 ${year} verisi yükleniyor...`,
                                message
                            );
                        }
                    };
                    
                    // Progressive UI Updates için chunk callback
                    const onChunk = (chunkData, chunkIndex, totalChunks, processedItems) => {
                        // Her chunk tamamlandığında UI'ı güncelle (non-blocking)
                        if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                            const chunkProgress = 15 + ((processedItems / (totalChunks * 1000)) * 75); // Tahmini
                            window.PerformanceOptimizer.LoadingManager.updateProgress(
                                Math.min(chunkProgress, 90),
                                `📦 ${year} verisi yükleniyor...`,
                                `Chunk ${chunkIndex + 1}/${totalChunks} (${processedItems.toLocaleString()} kayıt)`
                            );
                        }
                        
                        // 🎯 PROGRESSIVE UI UPDATES: Anlık kullanıcı feedback'i
                        // Her chunk'ta UI'ı güncelle, ama performans için throttling yap
                        if (chunkIndex % 3 === 0) { // Her 3 chunk'ta bir UI update (daha sık)
                            requestAnimationFrame(() => {
                                // UI'ı bloklamadan güncelle
                                const statusEl = document.getElementById('dataStatus');
                                if (statusEl) {
                                    // Progress bar da ekle
                                    const progressBar = document.getElementById('dataProgressBar');
                                    const progressPercent = Math.round((processedItems / (totalChunks * 1000)) * 100);
                                    
                                    if (progressBar) {
                                        progressBar.style.width = `${Math.min(progressPercent, 90)}%`;
                                        progressBar.textContent = `${progressPercent}%`;
                                    } else {
                                        // Progress bar yoksa oluştur
                                        const newProgressBar = document.createElement('div');
                                        newProgressBar.id = 'dataProgressBar';
                                        newProgressBar.style.cssText = `
                                            width: ${Math.min(progressPercent, 90)}%;
                                            height: 4px;
                                            background: linear-gradient(90deg, #007bff, #28a745);
                                            border-radius: 2px;
                                            margin-top: 4px;
                                            font-size: 10px;
                                            color: white;
                                            text-align: center;
                                            line-height: 4px;
                                        `;
                                        newProgressBar.textContent = `${progressPercent}%`;
                                        statusEl.appendChild(newProgressBar);
                                    }
                                    
                                    statusEl.innerHTML = `<span class="status-badge loading">📦 ${year}: ${processedItems.toLocaleString()} kayıt...</span>`;
                                    
                                    // Progress bar'ı tekrar ekle
                                    const reAddedBar = document.getElementById('dataProgressBar');
                                    if (reAddedBar) {
                                        statusEl.appendChild(reAddedBar);
                                    }
                                }
                                
                                // 🎯 REAL-TIME METRICS: Performans göstergeleri
                                const metricsEl = document.getElementById('realTimeMetrics');
                                if (metricsEl) {
                                    const currentTime = performance.now();
                                    const elapsedSeconds = (currentTime - parseStartTime) / 1000;
                                    const recordsPerSecond = Math.round(processedItems / elapsedSeconds);
                                    
                                    metricsEl.innerHTML = `
                                        <div style="font-size: 11px; color: #666;">
                                            ⚡ ${recordsPerSecond.toLocaleString()} kayıt/saniye |
                                            📊 ${processedItems.toLocaleString()} işlendi |
                                            ⏱️ ${elapsedSeconds.toFixed(1)}s
                                        </div>
                                    `;
                                } else {
                                    // Metrics element'i yoksa oluştur
                                    const newMetricsEl = document.createElement('div');
                                    newMetricsEl.id = 'realTimeMetrics';
                                    newMetricsEl.style.cssText = `
                                        font-size: 11px;
                                        color: #666;
                                        margin-top: 2px;
                                        text-align: center;
                                    `;
                                    
                                    const currentTime = performance.now();
                                    const elapsedSeconds = (currentTime - parseStartTime) / 1000;
                                    const recordsPerSecond = Math.round(processedItems / elapsedSeconds);
                                    
                                    newMetricsEl.innerHTML = `
                                        <div style="font-size: 11px; color: #666;">
                                            ⚡ ${recordsPerSecond.toLocaleString()} kayıt/saniye |
                                            📊 ${processedItems.toLocaleString()} işlendi |
                                            ⏱️ ${elapsedSeconds.toFixed(1)}s
                                        </div>
                                    `;
                                    
                                    const statusEl = document.getElementById('dataStatus');
                                    if (statusEl && statusEl.parentNode) {
                                        statusEl.parentNode.insertBefore(newMetricsEl, statusEl.nextSibling);
                                    }
                                }
                            });
                        }
                    };
                    
                    // Worker'da streaming parse et
                    yearData = await workerManager.decompressAndParseStreaming(arrayBuffer, {
                        onProgress,
                        onChunk,
                        chunkSize: 10000, // Her chunk 10,000 kayıt
                        enableProgressiveUI: true
                    });
                    
                    const parseEndTime = performance.now();
                    const parseDuration = parseEndTime - parseStartTime;
                    safeConsole.log(`✅ ${year} Streaming JSON Parser ile Worker'da parse edildi (${parseDuration.toFixed(2)}ms)`);
                    
                } else {
                    // Worker kullanılamıyor, fallback (main thread'de streaming parse)
                    safeConsole.warn(`⚠️ Worker kullanılamıyor (${year}), main thread'de streaming parse ediliyor...`);
                    
                    const decoder = new TextDecoder('utf-8');
                    const jsonText = decoder.decode(new Uint8Array(arrayBuffer));
                    const trimmed = jsonText.trim();
                    
                    // HTML kontrolü (404 sayfası olabilir)
                    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
                        throw new Error(`${year} verisi bulunamadı - HTML sayfası döndü (404)`);
                    }
                    
                    // Main thread'de streaming parser kullan (fallback)
                    const streamingParser = new StreamingJSONParser({
                        chunkSize: 10000,
                        onProgress: (progress, processed, total) => {
                            if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                                const mappedProgress = 15 + (progress * 0.75);
                                window.PerformanceOptimizer.LoadingManager.updateProgress(
                                    mappedProgress,
                                    `📦 ${year} verisi yükleniyor...`,
                                    `Main thread: ${processed.toLocaleString()}/${total.toLocaleString()} kayıt`
                                );
                            }
                            
                            // Progressive UI Updates (main thread fallback)
                            if (processed % 50000 === 0) { // Her 50k kayıtta bir UI update
                                requestAnimationFrame(() => {
                                    const statusEl = document.getElementById('dataStatus');
                                    if (statusEl) {
                                        statusEl.innerHTML = `<span class="status-badge loading">📦 ${year}: ${processed.toLocaleString()} kayıt...</span>`;
                                    }
                                });
                            }
                        }
                    });
                    
                    yearData = await streamingParser.parse(jsonText);
                    
                    const parseEndTime = performance.now();
                    const parseDuration = parseEndTime - parseStartTime;
                    safeConsole.log(`⚠️ ${year} Main thread'de streaming parse edildi (${parseDuration.toFixed(2)}ms)`);
                }
            } catch (parseError) {
                throw new Error(`${year} verisi parse edilemedi: ${parseError.message}`);
            }
            
            // Progress: Parse tamamlandı
            if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                window.PerformanceOptimizer.LoadingManager.updateProgress(90, `📦 ${year} verisi yükleniyor...`, 'Veri işleniyor...');
            }
            
            safeConsole.log(`✅ ${year} yüklendi: ${yearData?.details?.length || 0} kayıt`);
            if (!yearData?.details) {
                safeConsole.warn(`⚠️ ${year} verisi boş veya geçersiz`);
            }
            
            // PERFORMANS LOG: Tamamlanma zamanı
            const endTime = performance.now();
            const totalDuration = endTime - startTime;
            const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            const memoryIncrease = endMemory - startMemory;
            safeConsole.log(`🔍 PERFORMANS DEBUG - ${year}: Tamamlandı (${totalDuration.toFixed(2)}ms), Memory artışı: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB, Toplam Memory: ${(endMemory / 1024 / 1024).toFixed(2)}MB`);
            
            // AŞAMA 3: IndexedDB Cache'e kaydet (background'da - blocking olmaz)
            if (cache && cache.isSupported) {
                cache.set(year, yearData).catch(error => {
                    safeConsole.warn(`⚠️ Cache kaydetme hatası (${year}):`, error);
                });
            }
            
            // Memory cache'e kaydet
            loadedDataCache[year] = yearData;
            loadedYears.add(year);
            
            // Global state'i güncelle
            setLoadedDataCache(loadedDataCache);
            setLoadedYears(loadedYears);
            
            // Progress: Tamamlandı
            if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                window.PerformanceOptimizer.LoadingManager.updateProgress(100, `✅ ${year} yüklendi!`, `${yearData?.details?.length || 0} kayıt yüklendi`);
                // NOT: Spinner'ı burada kapatmıyoruz - tüm yıllar bittiğinde loadAllYearsData içinde kapatılacak
                // Bu şekilde paralel yükleme durumunda da doğru çalışır
            }
            
            return yearData;
            
        } catch (error) {
            // Hata durumunda activeOperations'ı azalt (hide() çağrılmayacak, loadAllYearsData içinde kapatılacak)
            if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
                // activeOperations'ı manuel olarak azalt (hide() çağrılmadan)
                window.PerformanceOptimizer.LoadingManager.activeOperations = Math.max(0, 
                    window.PerformanceOptimizer.LoadingManager.activeOperations - 1);
            }
            console.error(`❌ ${year} yükleme hatası:`, error);
            throw error;
        }
}

/**
 * Stok konumlarını yükle
 */
export async function loadStockLocations() {
    try {
        const response = await fetch('data/stock-locations.json');
        if (!response.ok) throw new Error('Stock locations yüklenemedi');
        const data = await response.json();
        const stockLocations = data.stock_locations || {};
        safeConsole.log('✅ Stok konumları yüklendi:', Object.keys(stockLocations).length, 'lokasyon');
        // Window objesine otomatik atama
        window.stockLocations = stockLocations;
        return stockLocations;
    } catch (error) {
        console.error('❌ Stock locations hatası:', error);
        // Hata durumunda boş obje ata
        window.stockLocations = {};
        return {};
    }
}

/**
 * Envanter verilerini yükle
 */
export async function loadInventoryData() {
    safeConsole.log('📦 Envanter verileri yükleniyor...');
    
    const inventoryLoading = document.getElementById('inventoryLoading');
    const inventoryContent = document.getElementById('inventoryContent');
    if (inventoryLoading) inventoryLoading.style.display = 'block';
    if (inventoryContent) inventoryContent.style.display = 'none';
    
    try {
        const response = await fetch('inventory.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // ArrayBuffer olarak al (gzip kontrolü için)
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Gzip kontrolü (ilk 2 byte: 0x1F 0x8B)
        const isGzip = uint8Array.length >= 2 && uint8Array[0] === 0x1F && uint8Array[1] === 0x8B;
        
        let parsedData;
        if (isGzip) {
            // Gzip formatında - aç
            if (typeof pako !== 'undefined') {
                const decompressed = pako.ungzip(uint8Array, { to: 'string' });
                parsedData = JSON.parse(decompressed);
            } else {
                throw new Error('GZIP açma kütüphanesi yüklenmedi. Lütfen sayfayı yenileyin.');
            }
        } else {
            // JSON formatında - direkt parse
            const decoder = new TextDecoder('utf-8');
            const jsonText = decoder.decode(uint8Array);
            parsedData = JSON.parse(jsonText);
        }
        
        let inventoryData;
        if (parsedData.inventory && Array.isArray(parsedData.inventory)) {
            inventoryData = parsedData;
            safeConsole.log(`✅ Envanter verileri yüklendi: ${inventoryData.inventory.length} kayıt`);
        } else if (Array.isArray(parsedData)) {
            inventoryData = { inventory: parsedData };
            safeConsole.log(`✅ Envanter verileri yüklendi: ${inventoryData.inventory.length} kayıt`);
        } else {
            throw new Error('Beklenmeyen veri formatı: inventory array bulunamadı');
        }
        
        // Window objesine otomatik atama
        window.inventoryData = inventoryData;
        return inventoryData;
        
    } catch (error) {
        console.error('❌ Envanter verileri yüklenemedi:', error);
        // Hata durumunda window objesini temizle (undefined bırak)
        window.inventoryData = undefined;
        throw error;
    }
}

/**
 * Ödeme verilerini yükle
 */
export async function loadPaymentData() {
    safeConsole.log('💳 Ödeme verileri yükleniyor...');
    
    try {
        const response = await fetch('payments.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // ArrayBuffer olarak al (gzip kontrolü için)
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Gzip kontrolü (ilk 2 byte: 0x1F 0x8B)
        const isGzip = uint8Array.length >= 2 && uint8Array[0] === 0x1F && uint8Array[1] === 0x8B;
        
        let paymentData;
        if (isGzip) {
            // Gzip formatında - aç
            if (typeof pako !== 'undefined') {
                const decompressed = pako.ungzip(uint8Array, { to: 'string' });
                paymentData = JSON.parse(decompressed);
            } else {
                throw new Error('GZIP açma kütüphanesi yüklenmedi. Lütfen sayfayı yenileyin.');
            }
        } else {
            // JSON formatında - direkt parse
            const decoder = new TextDecoder('utf-8');
            const jsonText = decoder.decode(uint8Array);
            paymentData = JSON.parse(jsonText);
        }
        safeConsole.log(`✅ Ödeme verileri yüklendi: ${paymentData.payments?.length || 0} kayıt`);
        
        // Window objesine otomatik atama
        window.paymentData = paymentData;
        return paymentData;
        
    } catch (error) {
        console.error('❌ Ödeme verileri yüklenemedi:', error);
        // Hata durumunda window objesini temizle (undefined bırak)
        window.paymentData = undefined;
        throw error;
    }
}

/**
 * Birden fazla veri dosyasını paralel olarak yükle
 * @param {Array<string>} dataTypes - Yüklenecek veri tipleri: ['inventory', 'payment', 'stockLocations']
 * @returns {Promise<Object>} Yüklenen verilerin sonuçları
 * 
 * Örnek kullanım:
 * await loadDataParallel(['inventory', 'payment', 'stockLocations']);
 */
export async function loadDataParallel(dataTypes) {
    if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
        safeConsole.warn('⚠️ loadDataParallel: Geçersiz dataTypes parametresi');
        return {};
    }
    
    safeConsole.log(`🔄 Paralel veri yükleme başlatılıyor: ${dataTypes.join(', ')}`);
    const startTime = performance.now();
    
    // Her veri tipi için yükleme fonksiyonunu belirle
    const loaders = {
        'inventory': async () => {
            // Mevcut yükleme kontrolü
            if (window.inventoryData && window.inventoryData.inventory && window.inventoryData.inventory.length > 0) {
                safeConsole.log('✅ Envanter verileri zaten yüklü, atlanıyor');
                return { type: 'inventory', data: window.inventoryData, cached: true };
            }
            const data = await loadInventoryData();
            return { type: 'inventory', data: data, cached: false };
        },
        'payment': async () => {
            // Mevcut yükleme kontrolü
            if (window.paymentData && window.paymentData.transactions && window.paymentData.transactions.length > 0) {
                safeConsole.log('✅ Ödeme verileri zaten yüklü, atlanıyor');
                return { type: 'payment', data: window.paymentData, cached: true };
            }
            const data = await loadPaymentData();
            return { type: 'payment', data: data, cached: false };
        },
        'stockLocations': async () => {
            // Mevcut yükleme kontrolü
            if (window.stockLocations && typeof window.stockLocations === 'object' && Object.keys(window.stockLocations).length > 0) {
                safeConsole.log('✅ Stok konumları zaten yüklü, atlanıyor');
                return { type: 'stockLocations', data: window.stockLocations, cached: true };
            }
            const data = await loadStockLocations();
            return { type: 'stockLocations', data: data, cached: false };
        }
    };
    
    // Geçerli veri tiplerini filtrele ve yükleme promise'lerini oluştur
    const validTypes = dataTypes.filter(type => loaders[type]);
    if (validTypes.length === 0) {
        safeConsole.warn('⚠️ loadDataParallel: Geçerli veri tipi bulunamadı');
        return {};
    }
    
    // Her yükleme için ayrı try-catch ile hata yönetimi (partial success desteği)
    const loadPromises = validTypes.map(async (type) => {
        try {
            return await loaders[type]();
        } catch (error) {
            safeConsole.error(`❌ ${type} yükleme hatası:`, error);
            return { type: type, data: null, error: error.message, cached: false };
        }
    });
    
    // Paralel yükleme
    try {
        const results = await Promise.all(loadPromises);
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        // Sonuçları organize et
        const resultMap = {};
        let successCount = 0;
        let errorCount = 0;
        let cachedCount = 0;
        
        results.forEach(result => {
            resultMap[result.type] = result;
            if (result.error) {
                errorCount++;
            } else if (result.cached) {
                cachedCount++;
                successCount++;
            } else {
                successCount++;
            }
        });
        
        safeConsole.log(`✅ Paralel veri yükleme tamamlandı: ${successCount} başarılı, ${errorCount} hata, ${cachedCount} cache hit (${duration}s)`);
        
        // Hata durumunda kullanıcıya bilgi ver (partial success)
        if (errorCount > 0) {
            const errorTypes = results.filter(r => r.error).map(r => r.type).join(', ');
            safeConsole.warn(`⚠️ Bazı veriler yüklenemedi: ${errorTypes}. Uygulama sınırlı işlevsellikle çalışabilir.`);
            
            // Kullanıcıya görsel geri bildirim (opsiyonel - dataStatus badge'i güncellenebilir)
            const dataStatusEl = document.getElementById('dataStatus');
            if (dataStatusEl && errorCount < validTypes.length) {
                // Partial success - bazı veriler yüklendi
                const existingBadge = dataStatusEl.querySelector('.status-badge');
                if (existingBadge && !existingBadge.textContent.includes('⚠️')) {
                    // Mevcut badge'i koru, sadece uyarı ekle
                    safeConsole.log('ℹ️ Kısmi veri yükleme: Bazı özellikler kullanılamayabilir');
                }
            }
        }
        
        return resultMap;
    } catch (error) {
        safeConsole.error('❌ Paralel veri yükleme genel hatası:', error);
        // Genel hata durumunda kullanıcıya bilgi ver
        const dataStatusEl = document.getElementById('dataStatus');
        if (dataStatusEl) {
            const existingBadge = dataStatusEl.querySelector('.status-badge');
            if (!existingBadge || !existingBadge.textContent.includes('❌')) {
                safeConsole.error('❌ Veri yükleme hatası: Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin');
            }
        }
        return {};
    }
}

/**
 * İkincil verileri önceden yükle (prefetch stratejisi)
 * Sayfa yüklendikten sonra idle time'da kritik verileri önceden yükler
 * 
 * Öncelik sırası:
 * 1. paymentData (customers, payments tab'ları için)
 * 2. inventoryData (store, inventory tab'ları için)
 * 3. stockLocations (store, inventory tab'ları için)
 */
export function prefetchSecondaryData() {
    // Sadece ana veriler yüklendikten sonra çalış
    // window.dataLoaded flag'i veya allData kontrolü yap
    const isDataLoaded = window.dataLoaded || (window.allData && window.allData.length > 0);
    
    if (!isDataLoaded) {
        safeConsole.log('⏳ Prefetch: Ana veriler henüz yüklenmedi, bekleniyor...');
        // Ana veriler yüklenene kadar bekle (maksimum 30 saniye)
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            checkCount++;
            const dataLoaded = window.dataLoaded || (window.allData && window.allData.length > 0);
            if (dataLoaded || checkCount >= 300) {
                clearInterval(checkInterval);
                if (checkCount >= 300) {
                    safeConsole.warn('⚠️ Prefetch: Ana veriler 30 saniye içinde yüklenemedi, prefetch iptal edildi');
                    return;
                }
                // Ana veriler yüklendi, prefetch'i başlat
                safeConsole.log('✅ Prefetch: Ana veriler yüklendi, prefetch başlatılıyor...');
                _executePrefetch();
            }
        }, 100);
        return;
    }
    
    // Ana veriler zaten yüklü, prefetch'i başlat
    safeConsole.log('✅ Prefetch: Ana veriler hazır, prefetch başlatılıyor...');
    _executePrefetch();
}

/**
 * Prefetch işlemini gerçekleştir (internal helper)
 */
function _executePrefetch() {
    // requestIdleCallback kullan (daha iyi UX)
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(async () => {
            await _loadPrefetchData();
        }, { timeout: 5000 }); // Maksimum 5 saniye bekle
    } else {
        // Fallback: setTimeout (requestIdleCallback desteklenmiyorsa)
        setTimeout(async () => {
            await _loadPrefetchData();
        }, 2000); // 2 saniye sonra başlat
    }
}

/**
 * Prefetch verilerini yükle (internal helper)
 */
async function _loadPrefetchData() {
    safeConsole.log('🔄 Prefetch: İkincil veriler önceden yükleniyor...');
    
    // Yüklenmesi gereken verileri belirle (öncelik sırasına göre)
    const dataToLoad = [];
    
    // 1. paymentData (en çok kullanılan)
    if (!window.paymentData || !window.paymentData.transactions || window.paymentData.transactions.length === 0) {
        dataToLoad.push('payment');
    }
    
    // 2. inventoryData
    if (!window.inventoryData || !window.inventoryData.inventory || window.inventoryData.inventory.length === 0) {
        dataToLoad.push('inventory');
    }
    
    // 3. stockLocations (inventory ile birlikte kullanılıyor)
    if (typeof window.stockLocations === 'undefined' || Object.keys(window.stockLocations || {}).length === 0) {
        dataToLoad.push('stockLocations');
    }
    
    if (dataToLoad.length === 0) {
        safeConsole.log('✅ Prefetch: Tüm ikincil veriler zaten yüklü');
        return;
    }
    
    safeConsole.log(`📦 Prefetch: ${dataToLoad.length} veri tipi yüklenecek: ${dataToLoad.join(', ')}`);
    
    // Paralel yükleme
    if (typeof window.loadDataParallel === 'function') {
        try {
            const startTime = performance.now();
            await window.loadDataParallel(dataToLoad);
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            safeConsole.log(`✅ Prefetch: ${dataToLoad.length} veri tipi önceden yüklendi (${duration}s)`);
        } catch (error) {
            safeConsole.warn('⚠️ Prefetch hatası (kritik değil):', error);
        }
    } else {
        safeConsole.warn('⚠️ Prefetch: loadDataParallel bulunamadı');
    }
}

/**
 * Merkezi hedefleri yükle
 */
export async function loadCentralTargets() {
    try {
        safeConsole.log('🎯 Merkezi hedefler yükleniyor...');
        const response = await fetch('data/targets.json?' + Date.now()); // Cache bypass
        if (response.ok) {
            const centralTargets = await response.json();
            safeConsole.log('✅ Merkezi hedefler yüklendi:', centralTargets);
            return centralTargets;
        } else {
            safeConsole.warn('⚠️ targets.json yüklenemedi, varsayılan hedefler kullanılacak');
            return { yearly: {}, monthly: {} };
        }
    } catch (error) {
        console.error('❌ Hedef yükleme hatası:', error);
        return { yearly: {}, monthly: {} };
    }
}

/**
 * Merkezi hedefleri yükleme wrapper fonksiyonu
 * Modül yüklenene kadar bekler ve progress tracking yapar
 */
export async function loadCentralTargetsWrapper() {
    // Orijinal fonksiyonu kullan (modülden gelen)
    let loadFn = null;
    if (originalLoadCentralTargets && typeof originalLoadCentralTargets === 'function') {
        loadFn = originalLoadCentralTargets;
    } else if (window.loadCentralTargets !== loadCentralTargetsWrapper && typeof window.loadCentralTargets === 'function') {
        loadFn = window.loadCentralTargets;
    }
    
    if (!loadFn || typeof loadFn !== 'function') {
        safeConsole.warn(`⚠️ Modül henüz yüklenmemiş, bekleniyor...`);
        // Modül yüklenene kadar bekle (maksimum 10 saniye)
        return new Promise((resolve) => {
            let timeoutReached = false;
            let waitCount = 0;
            const timeout = setTimeout(() => {
                timeoutReached = true;
                clearInterval(waitForModule);
                safeConsole.warn('⏱️ loadCentralTargets fonksiyonu 10 saniye içinde yüklenemedi, varsayılan değerler kullanılıyor');
                const defaultResult = { yearly: {}, monthly: {} };
                if (typeof window.dataLoadProgress !== 'undefined') {
                    window.dataLoadProgress.targets = true;
                    if (typeof window.checkLoadingComplete === 'function') {
                        window.checkLoadingComplete();
                    }
                }
                resolve(defaultResult);
            }, 10000);
            
            const waitForModule = setInterval(() => {
                if (timeoutReached) return;
                waitCount++;
                
                // Her 1 saniyede bir log (gereksiz logları azalt)
                if (waitCount % 10 === 0) {
                    safeConsole.log(`⏳ Modül bekleniyor... (${waitCount * 100}ms)`);
                }
                
                const fn = originalLoadCentralTargets || (window.loadCentralTargets !== loadCentralTargetsWrapper ? window.loadCentralTargets : null);
                if (fn && typeof fn === 'function') {
                    clearInterval(waitForModule);
                    clearTimeout(timeout);
                    fn().then(result => {
                        // Her zaman window.centralTargets'e ata
                        if (result) {
                            window.centralTargets = result;
                            safeConsole.log('✅ window.centralTargets güncellendi:', result);
                        }
                        if (result && typeof window.dataLoadProgress !== 'undefined') {
                            window.dataLoadProgress.targets = true;
                            if (typeof window.checkLoadingComplete === 'function') {
                                window.checkLoadingComplete();
                            }
                        }
                        resolve(result);
                    }).catch(error => {
                        safeConsole.error('❌ loadCentralTargets hatası:', error);
                        const defaultResult = { yearly: {}, monthly: {} };
                        window.centralTargets = defaultResult;
                        resolve(defaultResult);
                    });
                }
            }, 100);
        });
    }
    
    const result = await loadFn();
    // Her zaman window.centralTargets'e ata
    if (result) {
        window.centralTargets = result;
        safeConsole.log('✅ window.centralTargets güncellendi (doğrudan):', result);
    }
    if (result && typeof window.dataLoadProgress !== 'undefined') {
        window.dataLoadProgress.targets = true;
        if (typeof window.checkLoadingComplete === 'function') {
            window.checkLoadingComplete();
        }
    }
    return result;
}

/**
 * Ana veri yükleme fonksiyonu
 * Race condition önleme ve modül yükleme koordinasyonu ile
 */
export async function loadData() {
    loadDataCallCount++;
    const callId = loadDataCallCount;
    const console = window.safeConsole || safeConsole;
    console.log(`📞 loadData çağrısı #${callId} (isLoadingData: ${window.isLoadingData})`);
    
    // Race condition önleme: Atomic kontrol - eğer zaten yükleme devam ediyorsa, mevcut promise'i döndür
    if (window.isLoadingData && dataLoadPromise) {
        console.log(`⏸️ loadData çağrısı #${callId} - zaten çalışıyor, mevcut promise bekleniyor...`);
        return dataLoadPromise;
    }
    
    // Eğer veri zaten yüklendiyse, tekrar yükleme
    if (window.dataLoaded || (typeof window.dataLoadProgress !== 'undefined' && window.dataLoadProgress.dataFiles && 
        typeof window.allData !== 'undefined' && window.allData && window.allData.length > 0)) {
        console.log(`✅ loadData çağrısı #${callId} - veri zaten yüklü, tekrar yükleme atlandı`);
        return Promise.resolve();
    }
    
    // Yeni yükleme başlat - Atomic: flag'i ve promise'i aynı anda set et
    if (window.isLoadingData) {
        // Eğer flag set ama promise yoksa, kısa bir süre bekle
        console.log(`⏸️ loadData çağrısı #${callId} - flag set ama promise yok, bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        if (window.isLoadingData && dataLoadPromise) {
            return dataLoadPromise;
        }
    }
    
    // Race condition önleme: Tekrar kontrol et (başka bir çağrı araya girmiş olabilir)
    if (window.isLoadingData && dataLoadPromise) {
        console.log(`⏸️ loadData çağrısı #${callId} - başka bir çağrı araya girdi, mevcut promise bekleniyor...`);
        return dataLoadPromise;
    }
    
    // Yeni yükleme başlat - Atomic: flag'i ve promise'i aynı anda set et
    window.isLoadingData = true;
    console.log(`🚀 loadData çağrısı #${callId} - yükleme başlatılıyor...`);
    dataLoadPromise = (async () => {
        try {
            console.log(`🚀 loadData çağrısı #${callId} - fonksiyon içinde`);
            // Loading progress'i güncelle (sadece ilk yüklemede)
            if (typeof window.dataLoadProgress !== 'undefined' && !window.dataLoadProgress.dataFiles) {
                window.dataLoadProgress.dataFiles = true;
                if (typeof window.checkLoadingComplete === 'function') {
                    window.checkLoadingComplete();
                }
            }
            
            if (document.getElementById('dataStatus')) {
                document.getElementById('dataStatus').innerHTML = '<span class="status-badge loading">⏳ Yükleniyor...</span>';
            }
            
            // tableContainer artık Dashboard'da yok, null check ekledik
            const tableContainer = document.getElementById('tableContainer');
            if (tableContainer) {
                tableContainer.innerHTML = '<div style="text-align:center;padding:50px;font-size:1.2em;">⏳ Veriler yükleniyor, lütfen bekleyin...</div>';
            }
            
            // Hedefleri yükle - wrapper zaten modül yüklenene kadar bekliyor
            const startTime = Date.now();
            try {
                // loadCentralTargetsWrapper modül yüklenene kadar bekleyecek
                const targetsResult = await window.loadCentralTargets();
                // Sonucu window.centralTargets'e ata (eğer henüz atanmadıysa)
                if (targetsResult && !window.centralTargets) {
                    window.centralTargets = targetsResult;
                    safeConsole.log('✅ window.centralTargets yüklendi (loadData içinde):', targetsResult);
                }
                const duration = Date.now() - startTime;
                console.log(`✅ loadCentralTargets tamamlandı (${duration}ms)`);
            } catch (error) {
                console.error(`❌ loadCentralTargets hatası:`, error);
                // Hata durumunda varsayılan değer ata
                if (!window.centralTargets) {
                    window.centralTargets = { yearly: {}, monthly: {} };
                }
            }
            
            // İlk olarak metadata'yı yükle
            // Modül yüklenene kadar bekle
            let metadata = null;
            if (typeof window.loadMetadata !== 'function') {
                // Modül yüklenene kadar bekle
                await new Promise((resolve) => {
                    const waitForMetadata = setInterval(() => {
                        if (typeof window.loadMetadata === 'function') {
                            clearInterval(waitForMetadata);
                            resolve();
                        }
                    }, 50);
                    // Maksimum 10 saniye bekle
                    setTimeout(() => {
                        clearInterval(waitForMetadata);
                        resolve();
                    }, 10000);
                });
                
                if (typeof window.loadMetadata !== 'function') {
                    throw new Error('loadMetadata fonksiyonu 10 saniye içinde yüklenemedi. Lütfen sayfayı yenileyin.');
                }
            }
            metadata = await window.loadMetadata();
            console.log('📊 Metadata yüklendi:', metadata);
            
            if (!metadata || !metadata.years || metadata.years.length === 0) {
                throw new Error('Geçerli yıl verisi bulunamadı');
            }
            
            // Tüm yılları yükle - modül yüklenene kadar bekle
            if (typeof window.loadAllYearsData !== 'function') {
                console.warn('⚠️ loadAllYearsData modülü henüz yüklenmedi, bekleniyor...');
                // Modül yüklenene kadar bekle (maksimum 10 saniye)
                await new Promise((resolve) => {
                    let checkCount = 0;
                    const waitForModule = setInterval(() => {
                        checkCount++;
                        if (typeof window.loadAllYearsData === 'function') {
                            clearInterval(waitForModule);
                            console.log('✅ loadAllYearsData modülü yüklendi');
                            resolve();
                        } else if (checkCount >= 100) { // 10 saniye timeout
                            clearInterval(waitForModule);
                            console.error('❌ loadAllYearsData modülü 10 saniye içinde yüklenemedi!');
                            resolve();
                        }
                    }, 100);
                });
            }
            
            // Modül yüklendiyse verileri yükle
            if (typeof window.loadAllYearsData === 'function') {
                console.log('📦 Yıl verileri yükleniyor...');
                await window.loadAllYearsData(metadata);
                console.log('✅ Yıl verileri yüklendi');
            } else {
                throw new Error('loadAllYearsData fonksiyonu yüklenemedi. Lütfen sayfayı yenileyin.');
            }
            
            // Veri kontrolü - gerçekten yüklendi mi?
            if (!window.allData || window.allData.length === 0) {
                throw new Error('Veri yüklenemedi - allData boş!');
            }
            
            console.log(`✅ Veri yükleme tamamlandı (${window.allData.length} kayıt)`);
            
            // Veri yükleme başarıyla tamamlandı, flag'i set et
            window.dataLoaded = true;
            
            // Ana veriler yüklendi, prefetch'i başlat
            if (typeof window.prefetchSecondaryData === 'function') {
                window.prefetchSecondaryData();
            }
            
        } catch (error) {
            console.error('❌ Veri yükleme hatası:', error);
            if (document.getElementById('dataStatus')) {
                document.getElementById('dataStatus').innerHTML = '<span class="status-badge" style="background:#dc3545;color:#fff;">❌ Hata</span>';
            }
            throw error;
        } finally {
            // Loading tamamlandı, flag'i sıfırla
            window.isLoadingData = false;
            dataLoadPromise = null;
        }
    })();
    
    return dataLoadPromise;
}

/**
 * Eski yıl verisi yükleme fonksiyonu (legacy)
 * Not: Bu fonksiyon eski kod uyumluluğu için korunuyor
 */
export async function loadAllYearsDataOld(metadata) {
    try {
        safeConsole.log(`📅 Yıllar yükleniyor: ${metadata.years.join(', ')}`);
        
        // Yıl toggle'larını initialize et
        if (typeof window.initializeYearToggles === 'function') {
            window.initializeYearToggles(metadata.years);
        }
        
        // SADECE SEÇİLİ YILLARI yükle (initializeYearToggles varsayılan olarak son yılı seçiyor)
        const selectedYears = window.selectedYears || new Set();
        const yearsToLoad = Array.from(selectedYears); // Sadece seçili yıllar
        
        if (yearsToLoad.length === 0) {
            safeConsole.warn('⚠️ Hiçbir yıl seçili değil!');
            if (typeof window.updateDataStatus === 'function') {
                window.updateDataStatus();
            }
            return;
        }
        
        safeConsole.log(`📦 Seçili yıllar yükleniyor: ${yearsToLoad.join(', ')}`);
        
        // Seçili yılları paralel olarak yükle
        // Metadata güncellenmişse, verileri yeniden yükle
        const forceReload = metadata?.needsReload || false;
        const yearPromises = yearsToLoad.map(year => loadYearData(year, forceReload));
        const yearResults = await Promise.all(yearPromises);
        
        // Tüm verileri birleştir
        let allRawData = [];
        let totalRecords = 0;
        
        for (let i = 0; i < yearsToLoad.length; i++) {
            const year = yearsToLoad[i];
            const yearData = yearResults[i];
            
            if (yearData?.details && yearData.details.length > 0) {
                safeConsole.log(`✅ ${year} yılı yüklendi: ${yearData.details.length} kayıt`);
                allRawData = allRawData.concat(yearData.details);
                totalRecords += yearData.details.length;
            } else {
                safeConsole.warn(`⚠️ ${year} yılında veri bulunamadı`);
            }
        }
        
        safeConsole.log(`📊 Toplam yüklenen kayıt: ${totalRecords}`);
        
        if (allRawData.length === 0) {
            console.error('❌ Hiçbir yılda veri bulunamadı!');
            return;
        }
        
        // Tüm verileri işle
        window.allData = allRawData.map(item => applyDiscountLogic(item));
        // LAZY EVALUATION: DataViewManager kullan (gereksiz kopyaları önler)
        const dataViewManager = getDataViewManager();
        dataViewManager.invalidateCache(); // allData değişti, cache'i temizle
        window.baseData = dataViewManager.getBaseData();
        const discountProducts = window.allData.filter(item => isDiscountProduct(item));
        window.filteredData = dataViewManager.getFilteredData();
        
        safeConsole.log(`💰 ${discountProducts.length} indirim ürünü negatif değer olarak işlendi (toplam kayıt: ${allRawData.length})`);
        
        // Update info cards
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = metadata.last_update || '-';
        }
        
        if (typeof window.updateDataStatus === 'function') {
            window.updateDataStatus(); // Badge'i ve bilgileri güncelle
        }
        
        if (typeof window.populateFilters === 'function') {
            window.populateFilters();
        }
        if (typeof window.updateSummary === 'function') {
            window.updateSummary();
        }
        if (typeof window.renderTable === 'function') {
            window.renderTable();
        }
        
        // YENİ HEDEF SİSTEMİ: loadAllStoresTargets() kullanılıyor
        // Eski hedef sistemi (loadYearlyTarget, loadMonthlyTarget) kaldırıldı
        
        // Satış temsilcisi ve mağaza yıl filtrelerini doldur
        if (typeof window.populateSalespersonYearFilter === 'function') {
            window.populateSalespersonYearFilter();
        }
        if (typeof window.populateSalespersonMonthFilter === 'function') {
            window.populateSalespersonMonthFilter();
        }
        if (typeof window.populateSalespersonDayFilter === 'function') {
            window.populateSalespersonDayFilter();
        }
        if (typeof window.populateStoreYearFilter === 'function') {
            window.populateStoreYearFilter();
        }
        if (typeof window.populateStoreMonthFilter === 'function') {
            window.populateStoreMonthFilter();
        }
        if (typeof window.populateStoreDayFilter === 'function') {
            window.populateStoreDayFilter();
        }
        
        // Ürün filtrelerini initialize et
        if (typeof window.initializeProductFilters === 'function') {
            window.initializeProductFilters();
        }
        
        // Dashboard'ı yükle - veri tamamen yüklendikten sonra
        safeConsole.log('📊 İlk veri yükleme tamamlandı, dashboard yükleniyor...');
        setTimeout(() => {
            if (window.allData && window.allData.length > 0) {
                if (typeof window.loadDashboard === 'function') {
                    window.loadDashboard();
                }
                safeConsole.log('✅ Dashboard yüklendi');
            } else {
                safeConsole.warn('⚠️ Dashboard yüklenemedi - veri yok');
            }
        }, 500);

        // Loading progress'i tamamla (ilk yükleme bitti)
        if (typeof window.dataLoadProgress !== 'undefined') {
            window.dataLoadProgress.ready = true;
            if (typeof window.checkLoadingComplete === 'function') {
                window.checkLoadingComplete();
            }
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        const dataStatusEl = document.getElementById('dataStatus');
        if (dataStatusEl) {
            dataStatusEl.innerHTML = '<span class="status-badge status-error">❌ Hata</span>';
        }
        // tableContainer null check
        const tableContainerError = document.getElementById('tableContainer');
        if (tableContainerError) {
            tableContainerError.innerHTML = '<div class="error">❌ Veri yüklenirken hata oluştu!<br><small>' + error.message + '</small></div>';
        }
    }
}

/**
 * Kalan yılları yükle (arka planda)
 */
export async function loadRemainingYears(skipYear) {
    // loadedYears'i metadata-manager'dan güncel olarak al
    loadedYears = getLoadedYears();
    
    const metadata = window.metadata || (typeof window.getMetadata === 'function' ? window.getMetadata() : null);
    if (!metadata || !metadata.years) return;
    
    safeConsole.log('📦 Diğer yıllar arka planda yükleniyor...');
    
    // Paralel yükleme için Promise.all kullan
    const yearPromises = metadata.years
        .filter(year => year !== skipYear && !loadedYears.has(year))
        .map(year => loadYearData(year).catch(err => {
            console.error(`❌ ${year} yükleme hatası:`, err);
            return null;
        }));
    
    let yearResults = [];
    try {
        yearResults = await Promise.all(yearPromises);
    } finally {
        // Tüm yıllar yüklendikten sonra (başarılı veya hatalı) spinner'ı kapat
        if (window.PerformanceOptimizer && window.PerformanceOptimizer.LoadingManager) {
            const loadingManager = window.PerformanceOptimizer.LoadingManager;
            // Tüm yıllar bitti, activeOperations'ı sıfırla
            loadingManager.activeOperations = 0;
            loadingManager.hide();
        }
    }
    
    // loadedYears'i tekrar güncelle (loadYearData içinde güncellenmiş olabilir)
    loadedYears = getLoadedYears();
    
    for (let i = 0; i < yearResults.length; i++) {
        const yearData = yearResults[i];
        const year = metadata.years.filter(y => y !== skipYear && !loadedYears.has(y))[i];
        
        if (!yearData) continue;
        
        try {
            // Eğer yıl zaten yüklüyse (null döndü), atla
            if (!yearData) {
                continue;
            }
            
            // Verileri birleştir ve indirim ürünlerini negatif yap
            if (yearData?.details && Array.isArray(yearData.details)) {
                const yearRawData = yearData.details;
                const yearDiscountCount = yearRawData.filter(item => isDiscountProduct(item)).length;
                
                // Tüm verileri işle - indirim ürünleri negatif olarak
                const processedYearData = yearRawData.map(item => applyDiscountLogic(item));
                // STACK OVERFLOW ÖNLEME: Büyük array'lerde spread yerine loop ile ekle
                for (let j = 0; j < processedYearData.length; j++) {
                    window.allData.push(processedYearData[j]);
                }
                // LAZY EVALUATION: DataViewManager kullan (allData değişti, cache'i temizle)
                const dataViewManager = getDataViewManager();
                dataViewManager.invalidateCache(); // allData değişti, cache'i temizle
                window.baseData = dataViewManager.getBaseData(); // Kanal filtresi için güncelle
                window.filteredData = dataViewManager.getFilteredData();
                
                safeConsole.log(`💰 ${year}: ${yearDiscountCount} indirim ürünü negatif değer olarak işlendi (toplam: ${yearRawData.length})`);
                
                // Filtreleri ve tabloyu güncelle
                if (typeof window.populateFilters === 'function') {
                    window.populateFilters();
                }
                if (typeof window.updateSummary === 'function') {
                    window.updateSummary();
                }
                
                // Satış temsilcisi ve mağaza yıl filtrelerini güncelle
                if (typeof window.populateSalespersonYearFilter === 'function') {
                    window.populateSalespersonYearFilter();
                }
                if (typeof window.populateStoreYearFilter === 'function') {
                    window.populateStoreYearFilter();
                }
                
                // Status güncelle
                loadedYears = getLoadedYears(); // Tekrar güncelle
                const loadedYearsList = Array.from(loadedYears).sort().join(', ');
                const dataStatusEl = document.getElementById('dataStatus');
                if (dataStatusEl) {
                    dataStatusEl.innerHTML = `<span class="status-badge status-success">✅ ${loadedYearsList}</span>`;
                }
                const totalRecordsEl = document.getElementById('totalRecords');
                if (totalRecordsEl) {
                    totalRecordsEl.textContent = window.allData.length.toLocaleString('tr-TR');
                }
                
                // Toplam USD'yi güncelle (indirim ürünleri ve iadeler hesaplamalardan düşüyor)
                if (typeof window.shouldHideItem === 'function') {
                    const totalUSD = window.allData.reduce((sum, item) => {
                        if (window.shouldHideItem(item)) return sum;
                        return sum + (parseFloat(item.usd_amount) || 0);
                    }, 0);
                    const totalUSDEl = document.getElementById('totalUSD');
                    if (totalUSDEl) {
                        totalUSDEl.textContent = '$' + totalUSD.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    }
                    
                    // Günlük Ortalama Hesapla
                    // DÜZELTME: shouldHideItem ile filtrelenmiş veriden unique dates hesapla (Dashboard ile tutarlı)
                    const uniqueDates = [...new Set(window.allData
                        .filter(item => !window.shouldHideItem(item))
                        .map(item => item.date)
                        .filter(Boolean))];
                    const dailyAverage = uniqueDates.length > 0 ? totalUSD / uniqueDates.length : 0;
                    const dailyAverageEl = document.getElementById('dailyAverage');
                    if (dailyAverageEl) {
                        dailyAverageEl.textContent = '$' + dailyAverage.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    }
                    
                    // Sepet Ortalaması Hesapla (Sadece Satış Faturalarının Toplamı / Satış Fatura Sayısı)
                    // DÜZELTME: Dashboard ve summary-cards ile aynı mantık
                    const salesInvoices = window.allData.filter(item => {
                        if (window.shouldHideItem && window.shouldHideItem(item)) return false;
                        if (item.move_type === 'out_refund') return false;
                        const amount = parseFloat(item.usd_amount || 0);
                        return amount > 0 && (item.move_type === 'out_invoice' || !item.move_type);
                    });
                    
                    // Invoice key'ler sadece move_name veya move_id kullanmalı (product YOK)
                    const invoiceKeys = salesInvoices
                        .map(item => item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}`)
                        .filter(Boolean);
                    const uniqueInvoices = new Set(invoiceKeys).size;
                    
                    // Sadece satış faturalarının toplamını kullan
                    const salesInvoicesTotal = salesInvoices.reduce((sum, item) => {
                        return sum + parseFloat(item.usd_amount || 0);
                    }, 0);
                    // NOT: basketAverage elementi HTML'de yok, sadece dashBasketAverage var
                    // Bu hesaplama gereksiz - updateSummary() zaten dashBasketAverage'i güncelliyor (satır 872)
                    // Burada güncelleme yapmıyoruz, updateSummary() zaten çağrılıyor
                }
                
                // Dashboard'ı güncelle - sadece grafikleri yenile, veri yükleme yapma
                // loadDashboard() çağırmıyoruz çünkü zaten veriler yüklü
            }
            
        } catch (error) {
            console.error(`⚠️ ${year} yüklenemedi:`, error);
        }
    }
    
    safeConsole.log('✅ Tüm yıllar yüklendi!');
    if (typeof window.updateDataStatus === 'function') {
        window.updateDataStatus(); // Badge'i güncelle
    }
    
    // Loading progress'i tamamla
    if (typeof window.dataLoadProgress !== 'undefined') {
        window.dataLoadProgress.ready = true;
        if (typeof window.checkLoadingComplete === 'function') {
            window.checkLoadingComplete();
        }
    }
}

/**
 * Yıl yönetimi fonksiyonları
 */

// Global state
let selectedYears = new Set(); // Seçili yılları tut
let yearToggleLock = false; // Yıl toggle işlemi devam ederken başka işlem engelle
let yearUpdateTimeout = null; // Debounce için
let dataStatusCache = { totalUSD: 0, uniqueDates: null, uniqueInvoices: 0, salesInvoicesTotal: 0, allDataLength: 0 };

/**
 * Yıl toggle'larını initialize et
 */
export function initializeYearToggles(availableYears) {
    // Varsayılan olarak sadece 2025 aktif (eğer mevcutsa)
    const yearsToSelect = [];
    const availableYearsStr = availableYears.map(y => y.toString());
    
    // Sadece 2025'i kontrol et ve varsa ekle
    if (availableYearsStr.includes('2025')) {
        yearsToSelect.push('2025');
    }
    
    // Eğer 2025 yoksa, en güncel yılı seç (fallback)
    if (yearsToSelect.length === 0 && availableYears.length > 0) {
        const latestYear = (availableYears
            .map(y => y.toString())
            .sort((a,b) => parseInt(b) - parseInt(a))[0]); // En yeni yıl (büyükten küçüğe)
        yearsToSelect.push(latestYear);
    }
    
    selectedYears = new Set(yearsToSelect);
    // Modül erişimi için window'a da ekle (ÖNEMLİ: container yoksa bile set et)
    window.selectedYears = selectedYears;
    
    const container = document.getElementById('yearToggleContainer');
    if (!container) {
        // Container yoksa sadece selectedYears'ı set et, UI oluşturmayı atla
        return;
    }
    
    // Toggle'ları oluştur
    container.innerHTML = '';
    availableYears.sort().reverse().forEach(year => {
        const isSelected = selectedYears.has(year.toString());
        const toggleItem = document.createElement('div');
        toggleItem.className = isSelected ? 'year-toggle-item active' : 'year-toggle-item';
        toggleItem.dataset.year = year;
        toggleItem.innerHTML = `
            <div class="year-toggle-switch ${isSelected ? 'active' : ''}" onclick="event.stopPropagation(); toggleYear('${year}')"></div>
            <span class="year-toggle-label" onclick="toggleYear('${year}')">${year}</span>
        `;
        container.appendChild(toggleItem);
    });
    
    container.style.display = 'flex';
    updateYearToggleUI();
}

/**
 * Yıl toggle fonksiyonu (Optimized: Debounce + Loading State)
 */
export async function toggleYear(year) {
    const safeConsole = window.safeConsole || console;
    // Eğer bir işlem devam ediyorsa, bekle
    if (yearToggleLock) {
        safeConsole.log(`⏸️ Yıl değişikliği zaten işleniyor, bekleniyor...`);
        return;
    }
    
    const wasSelected = selectedYears.has(year);
    
    // UI'ı hemen güncelle (kullanıcı geri bildirimi için)
    if (wasSelected) {
        selectedYears.delete(year);
    } else {
        selectedYears.add(year);
    }
    // Modül erişimi için window'a da ekle
    window.selectedYears = selectedYears;
    updateYearToggleUI();
    
    // Debounce: Kullanıcı hızlı tıklarsa sadece son tıklamayı işle
    if (yearUpdateTimeout) {
        clearTimeout(yearUpdateTimeout);
    }
    
    yearUpdateTimeout = setTimeout(async () => {
        yearToggleLock = true;
        
        try {
            // Loading göster
            const statusEl = document.getElementById('dataStatus');
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-badge loading">⏳ Yükleniyor...</span>';
            }
            
            if (wasSelected) {
                // Yılı kaldır
                await removeYearDataOptimized(year);
            } else {
                // Yılı ekle
                await loadYearDataAndMergeOptimized(year);
            }
            
            // UI güncellemeleri (asenkron, non-blocking)
            requestAnimationFrame(() => {
                updateYearToggleUI();
                updateDataStatusOptimized();
            });
            
        } catch (error) {
            console.error('❌ Yıl toggle hatası:', error);
            // Hata durumunda geri al
            if (wasSelected) {
                selectedYears.add(year);
            } else {
                selectedYears.delete(year);
            }
            updateYearToggleUI();
            updateDataStatusOptimized();
        } finally {
            yearToggleLock = false;
        }
    }, 300); // 300ms debounce
}

/**
 * Yıl verisini kaldır (Optimized: Asenkron işlemler)
 */
export async function removeYearDataOptimized(year) {
    const safeConsole = window.safeConsole || console;
    safeConsole.log(`🗑️ ${year} yılı verisi kaldırılıyor...`);
    
    // allData'dan bu yılın verilerini kaldır
    const yearStr = year.toString();
    window.allData = (window.allData || []).filter(item => {
        if (!item.date) return true;
        const itemYear = item.date.split('-')[0];
        return itemYear !== yearStr;
    });
    
    // LAZY EVALUATION: DataViewManager kullan (allData değişti, cache'i temizle)
    const dataViewManager = getDataViewManager();
    dataViewManager.invalidateCache(); // allData değişti, cache'i temizle
    window.baseData = dataViewManager.getBaseData();
    window.filteredData = dataViewManager.getFilteredData();
        
    // Cache'den kaldır
    loadedYears.delete(year);
    if (loadedDataCache[year]) {
        delete loadedDataCache[year];
    }
    
    // UI güncellemeleri (requestIdleCallback ile - PERFORMANS OPTİMİZASYONU)
    const updateUI = () => {
        if (typeof window.populateFilters === 'function') {
            window.populateFilters();
        }
        if (typeof window.updateSummary === 'function') {
            window.updateSummary();
        }
    };
    
    // UI güncellemeleri için requestIdleCallback kullan (optimize edilmiş timeout)
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(updateUI, { timeout: 100 });
    } else {
        requestAnimationFrame(updateUI);
    }
    
    // Ağır işlemleri asenkron yap (requestIdleCallback ile - tarayıcı boşta iken)
    const heavyOperations = () => {
        if (typeof window.renderTable === 'function') {
            window.renderTable();
        }
        if (typeof window.loadDashboard === 'function') {
            window.loadDashboard();
        }
        if (typeof window.analyzeCustomers === 'function') {
            window.analyzeCustomers();
        }
        if (typeof window.loadAllStoresTargets === 'function') {
            window.loadAllStoresTargets();
        }
        if (typeof window.analyzeCityPerformance === 'function') {
            window.analyzeCityPerformance();
        }
        if (typeof window.performYearlyTargetAnalysis === 'function') {
            window.performYearlyTargetAnalysis();
        }
        if (typeof window.populateSalespersonYearFilter === 'function') {
            window.populateSalespersonYearFilter();
        }
        if (typeof window.populateSalespersonMonthFilter === 'function') {
            window.populateSalespersonMonthFilter();
        }
        if (typeof window.populateSalespersonDayFilter === 'function') {
            window.populateSalespersonDayFilter();
        }
        if (typeof window.populateStoreYearFilter === 'function') {
            window.populateStoreYearFilter();
        }
        if (typeof window.populateStoreMonthFilter === 'function') {
            window.populateStoreMonthFilter();
        }
        if (typeof window.populateStoreDayFilter === 'function') {
            window.populateStoreDayFilter();
        }
    };
    
    // Ağır işlemler için requestIdleCallback (optimize edilmiş timeout)
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(heavyOperations, { timeout: 300 });
    } else {
        setTimeout(heavyOperations, 100);
    }
    
    safeConsole.log(`✅ ${year} yılı verisi kaldırıldı. Kalan veri: ${window.allData.length} kayıt`);
}

/**
 * Yıl verisini yükle ve birleştir (Optimized: Asenkron işlemler)
 */
export async function loadYearDataAndMergeOptimized(year) {
    try {
        safeConsole.log(`📦 ${year} yılı verisi yükleniyor...`);
        
        const yearData = await loadYearData(year);
        if (!yearData?.details || yearData.details.length === 0) {
            safeConsole.warn(`⚠️ ${year} yılında veri bulunamadı`);
            return;
        }
        
        // 🎯 VERİ PARÇALAMA (CHUNKING) STRATEJİSİ - Optimize edilmiş
        // Memory kullanımını optimize etmek ve UI'i responsive tutmak için
        const totalRecords = yearData.details.length;
        const chunkSize = Math.min(2000, Math.max(500, Math.floor(totalRecords / 20))); // Dinamik chunk boyutu
        const chunks = [];
        
        // Progress tracking için değişkenler
        let processedRecords = 0;
        let lastProgressUpdate = 0;
        
        safeConsole.log(`🎯 Chunking stratejisi: ${totalRecords.toLocaleString()} kayıt, ${chunkSize} kayıt/chunk, tahminen ${Math.ceil(totalRecords / chunkSize)} chunk`);
        
        // Veriyi chunk'lara böl
        for (let i = 0; i < totalRecords; i += chunkSize) {
            chunks.push(yearData.details.slice(i, i + chunkSize));
        }
        
        let processedYearData = [];
        
        // 🚀 OPTİMİZE EDİLMİŞ CHUNK İŞLEME - Progressive UI Updates ile
        const processChunk = async (chunkIndex) => {
            return new Promise((resolve) => {
                const chunk = chunks[chunkIndex];
                
                // Progressive UI Updates için timing
                const processStartTime = performance.now();
                
                // Chunk'ı işle (applyDiscountLogic)
                const processedChunk = chunk.map(item => applyDiscountLogic(item));
                
                // Memory efficient ekleme (spread operator yerine)
                for (let i = 0; i < processedChunk.length; i++) {
                    processedYearData.push(processedChunk[i]);
                }
                
                processedRecords += processedChunk.length;
                
                // 🎯 PROGRESSIVE UI UPDATES - Her chunk'ta güncelle
                const now = performance.now();
                const shouldUpdateUI = (now - lastProgressUpdate) > 100; // Throttle: 100ms'de bir
                
                if (shouldUpdateUI || chunkIndex === chunks.length - 1) {
                    lastProgressUpdate = now;
                    
                    requestAnimationFrame(() => {
                        const progress = Math.round((processedRecords / totalRecords) * 100);
                        const elapsedMs = now - processStartTime;
                        const recordsPerSecond = Math.round(processedChunk.length / (elapsedMs / 1000));
                        
                        // Status güncelle
                        const statusEl = document.getElementById('dataStatus');
                        if (statusEl) {
                            statusEl.innerHTML = `<span class="status-badge loading">📦 ${year}: ${processedRecords.toLocaleString()}/${totalRecords.toLocaleString()} kayıt...</span>`;
                        }
                        
                        // Progress bar güncelle
                        const progressBar = document.getElementById('dataProgressBar');
                        if (progressBar) {
                            progressBar.style.width = `${progress}%`;
                            progressBar.textContent = `${progress}%`;
                        }
                        
                        // Real-time metrics güncelle
                        const metricsEl = document.getElementById('realTimeMetrics');
                        if (metricsEl) {
                            const totalElapsedSeconds = (now - processStartTime) / 1000;
                            const avgRecordsPerSecond = Math.round(processedRecords / totalElapsedSeconds);
                            
                            metricsEl.innerHTML = `
                                <div style="font-size: 11px; color: #666;">
                                    📊 Chunk ${chunkIndex + 1}/${chunks.length} |
                                    ⚡ ${recordsPerSecond.toLocaleString()} kayıt/s (chunk) |
                                    📈 ${avgRecordsPerSecond.toLocaleString()} kayıt/s (ortalama) |
                                    📦 ${processedRecords.toLocaleString()}/${totalRecords.toLocaleString()}
                                </div>
                            `;
                        }
                        
                        // Console log (her 5 chunk'ta bir)
                        if (chunkIndex % 5 === 0) {
                            safeConsole.log(`📊 ${year} chunk işleniyor: ${progress}% (${chunkIndex + 1}/${chunks.length}), ⚡ ${recordsPerSecond} kayıt/s`);
                        }
                    });
                }
                
                // Küçük bir delay ile UI'ın güncellenmesine izin ver
                setTimeout(resolve, 1);
            });
        };
        
        // 🚀 PARALEL CHUNK İŞLEME (kontrollü) - 2-3 chunk paralel
        const maxParallelChunks = Math.min(3, chunks.length);
        const chunkPromises = [];
        
        for (let i = 0; i < chunks.length; i += maxParallelChunks) {
            // Bu turdaki chunk'ları paralel olarak işle
            const currentBatchPromises = [];
            
            for (let j = 0; j < maxParallelChunks && (i + j) < chunks.length; j++) {
                const chunkIndex = i + j;
                currentBatchPromises.push(processChunk(chunkIndex));
            }
            
            // Bu batch tamamlandıktan sonra sonraki batch'e geç
            await Promise.all(currentBatchPromises);
            
            // Memory garbage collection için kısa bir bekleme
            if (i % (maxParallelChunks * 5) === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        safeConsole.log(`✅ ${year} chunking tamamlandı: ${processedRecords.toLocaleString()} kayıt işlendi`);
        
        // Mevcut verilere ekle (async, non-blocking)
        // STACK OVERFLOW ÖNLEME: Spread operator yerine loop ile ekle (büyük array'lerde güvenli)
        await new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                    // Spread operator büyük array'lerde stack overflow yapar → Loop ile ekle
                    for (let i = 0; i < processedYearData.length; i++) {
                        window.allData.push(processedYearData[i]);
                    }
                    // LAZY EVALUATION: DataViewManager kullan (allData değişti, cache'i temizle)
                    const dataViewManager = getDataViewManager();
                    dataViewManager.invalidateCache(); // allData değişti, cache'i temizle
                    window.baseData = dataViewManager.getBaseData();
                    window.filteredData = dataViewManager.getFilteredData();
                    resolve();
                }, { timeout: 100 }); // Optimize edilmiş: 200ms → 100ms
            } else {
                setTimeout(() => {
                    // Spread operator büyük array'lerde stack overflow yapar → Loop ile ekle
                    for (let i = 0; i < processedYearData.length; i++) {
                        window.allData.push(processedYearData[i]);
                    }
                    // LAZY EVALUATION: DataViewManager kullan (allData değişti, cache'i temizle)
                    const dataViewManager = getDataViewManager();
                    dataViewManager.invalidateCache(); // allData değişti, cache'i temizle
                    window.baseData = dataViewManager.getBaseData();
                    window.filteredData = dataViewManager.getFilteredData();
                    resolve();
                }, 0);
            }
        });
        
        safeConsole.log(`✅ ${year} yılı yüklendi: ${processedYearData.length} kayıt`);
        
        // Toplam kayıt sayısını güncelle
        const totalRecordsEl = document.getElementById('totalRecords');
        if (totalRecordsEl && window.allData) {
            totalRecordsEl.textContent = window.allData.length.toLocaleString('tr-TR');
        }
        
        // UI güncellemeleri için requestIdleCallback (optimize edilmiş timeout)
        const updateUI = () => {
            if (typeof window.populateFilters === 'function') {
                window.populateFilters();
            }
            if (typeof window.updateSummary === 'function') {
                window.updateSummary();
            }
        };
        
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(updateUI, { timeout: 100 }); // Optimize edilmiş: 300ms → 100ms
        } else {
            requestAnimationFrame(updateUI);
        }
        
        // Ağır işlemleri asenkron yap (requestIdleCallback ile - tarayıcı boşta iken)
        const heavyOperations = () => {
            if (typeof window.renderTable === 'function') {
                window.renderTable();
            }
            if (typeof window.loadDashboard === 'function') {
                window.loadDashboard();
            }
            if (typeof window.analyzeCustomers === 'function') {
                window.analyzeCustomers();
            }
            if (typeof window.loadAllStoresTargets === 'function') {
                window.loadAllStoresTargets();
            }
            if (typeof window.analyzeCityPerformance === 'function') {
                window.analyzeCityPerformance();
            }
            if (typeof window.performYearlyTargetAnalysis === 'function') {
                window.performYearlyTargetAnalysis();
            }
            if (typeof window.populateSalespersonYearFilter === 'function') {
                window.populateSalespersonYearFilter();
            }
            if (typeof window.populateStoreYearFilter === 'function') {
                window.populateStoreYearFilter();
            }
        };
        
        // Ağır işlemler için requestIdleCallback (optimize edilmiş timeout)
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(heavyOperations, { timeout: 300 }); // Optimize edilmiş: 800ms → 300ms
        } else {
            setTimeout(heavyOperations, 100); // Optimize edilmiş: 200ms → 100ms
        }
        
    } catch (error) {
        console.error(`❌ ${year} yılı yükleme hatası:`, error);
        // Hata durumunda toggle'ı geri al
        selectedYears.delete(year);
        updateYearToggleUI();
    }
}

/**
 * Yıl toggle UI'ı güncelle
 */
export function updateYearToggleUI() {
    const container = document.getElementById('yearToggleContainer');
    if (!container) return;
    
    container.querySelectorAll('.year-toggle-item').forEach(item => {
        const year = item.dataset.year;
        const switchEl = item.querySelector('.year-toggle-switch');
        
        if (selectedYears.has(year)) {
            item.classList.add('active');
            if (switchEl) switchEl.classList.add('active');
        } else {
            item.classList.remove('active');
            if (switchEl) switchEl.classList.remove('active');
        }
    });
}

/**
 * Veri durumu badge'ini güncelle (Optimized: Cache + Debounce)
 */
export function updateDataStatusOptimized() {
    const statusEl = document.getElementById('dataStatus');
    if (!statusEl) return;
    
    // Badge güncelle (hafif işlem, hemen)
    if (selectedYears.size === 0) {
        statusEl.innerHTML = '<span class="status-badge status-warning">⚠️ Yıl Seçilmedi</span>';
    } else if (selectedYears.size === 1) {
        statusEl.innerHTML = `<span class="status-badge status-success">✅ ${Array.from(selectedYears)[0]}</span>`;
    } else {
        const yearsList = Array.from(selectedYears).sort().join(', ');
        statusEl.innerHTML = `<span class="status-badge status-success">✅ Seçili Yıllar (${yearsList})</span>`;
    }
    
    // Ağır hesaplamaları asenkron yap (non-blocking)
    const allData = window.allData || [];
    if (allData.length > 0) {
        // Toplam kayıt hemen güncelle (çok hızlı)
        const totalRecordsEl = document.getElementById('totalRecords');
        if (totalRecordsEl) {
            totalRecordsEl.textContent = allData.length.toLocaleString('tr-TR');
        }
        
        // Ağır hesaplamaları requestAnimationFrame ile yap
        requestAnimationFrame(() => {
            const shouldHideItem = window.shouldHideItem || (() => false);
            // Toplam USD (indirim ürünleri ve iadeler hesaplamalardan düşüyor)
            const totalUSD = allData.reduce((sum, item) => {
                if (shouldHideItem(item)) return sum;
                return sum + (parseFloat(item.usd_amount) || 0);
            }, 0);
            const totalUSDEl = document.getElementById('totalUSD');
            if (totalUSDEl) {
                totalUSDEl.textContent = '$' + totalUSD.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
            
            // Günlük Ortalama (cache'lenebilir - optimize edilmiş)
            // DÜZELTME: shouldHideItem ile filtrelenmiş veriden unique dates hesapla (Dashboard ile tutarlı)
            if (!dataStatusCache.uniqueDates || dataStatusCache.totalUSD !== totalUSD) {
                // Tek iterate'de unique dates hesapla (optimize edilmiş)
                const uniqueDatesSet = new Set();
                for (const item of allData) {
                    // shouldHideItem kontrolü (iadeler ve indirim ürünleri filtreleniyor)
                    if (shouldHideItem(item)) continue;
                    if (item.date) uniqueDatesSet.add(item.date);
                }
                dataStatusCache.uniqueDates = Array.from(uniqueDatesSet);
                dataStatusCache.totalUSD = totalUSD;
            }
            const dailyAverage = dataStatusCache.uniqueDates.length > 0 ? totalUSD / dataStatusCache.uniqueDates.length : 0;
            const dailyAverageEl = document.getElementById('dailyAverage');
            if (dailyAverageEl) {
                dailyAverageEl.textContent = '$' + dailyAverage.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
            
            // Sepet Ortalaması (cache'lenebilir - optimize edilmiş)
            // DÜZELTME: Dashboard ve summary-cards ile aynı mantık
            // Cache kontrolü: totalUSD değiştiyse veya cache boşsa yeniden hesapla
            // NOT: uniqueInvoices === 0 kontrolü kaldırıldı çünkü ilk yüklemede 0 olabilir
            if (dataStatusCache.totalUSD !== totalUSD || dataStatusCache.salesInvoicesTotal === undefined || dataStatusCache.allDataLength !== allData.length) {
                // Tek iterate'de satış faturalarını hesapla (optimize edilmiş)
                const uniqueInvoicesSet = new Set();
                let salesInvoicesTotal = 0;
                for (const item of allData) {
                    if (shouldHideItem(item)) continue;
                    const amt = parseFloat(item.usd_amount || 0);
                    // Sadece satış faturaları (iade değil) ve pozitif tutarlı
                    if (amt > 0 && item.move_type !== 'out_refund' && (item.move_type === 'out_invoice' || !item.move_type)) {
                        salesInvoicesTotal += amt;
                        // Invoice key'ler sadece move_name veya move_id kullanmalı (product YOK)
                        const invoiceKey = item.move_name || item.move_id || `${item.date || ''}-${item.partner || ''}-${item.store || ''}`;
                        if (invoiceKey) {
                            uniqueInvoicesSet.add(invoiceKey);
                        }
                    }
                }
                dataStatusCache.uniqueInvoices = uniqueInvoicesSet.size;
                dataStatusCache.salesInvoicesTotal = salesInvoicesTotal;
                dataStatusCache.allDataLength = allData.length;
            }
            // NOT: basketAverage elementi HTML'de yok, sadece dashBasketAverage var
            // dashBasketAverage updateSummary() tarafından güncelleniyor
            // Burada güncelleme yapmıyoruz, gereksiz hesaplama
        });
    }
}

/**
 * Eski fonksiyon (geriye uyumluluk için)
 */
export function updateDataStatus() {
    updateDataStatusOptimized();
}

// Global erişim için (mevcut kod uyumluluğu)
window.loadYearData = loadYearData;
window.loadStockLocations = loadStockLocations;
window.loadInventoryData = loadInventoryData;
window.loadPaymentData = loadPaymentData;
window.loadDataParallel = loadDataParallel;
window.prefetchSecondaryData = prefetchSecondaryData;
window.loadCentralTargets = loadCentralTargets;
window.loadCentralTargetsWrapper = loadCentralTargetsWrapper;
window.loadData = loadData;
window.loadAllYearsDataOld = loadAllYearsDataOld;
window.loadRemainingYears = loadRemainingYears;
window.initializeYearToggles = initializeYearToggles;
window.toggleYear = toggleYear;
window.removeYearDataOptimized = removeYearDataOptimized;
window.loadYearDataAndMergeOptimized = loadYearDataAndMergeOptimized;
window.updateYearToggleUI = updateYearToggleUI;
window.updateDataStatusOptimized = updateDataStatusOptimized;
window.updateDataStatus = updateDataStatus;

// loadCentralTargetsWrapper için orijinal fonksiyonu sakla
if (typeof window.loadCentralTargets === 'function' && window.loadCentralTargets !== loadCentralTargetsWrapper) {
    originalLoadCentralTargets = window.loadCentralTargets;
    window.loadCentralTargets = loadCentralTargetsWrapper;
}

