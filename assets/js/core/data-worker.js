/**
 * DATA WORKER - Web Worker for GZIP Decompression and JSON Parsing
 * AŞAMA 2: Web Worker implementasyonu - Main thread'i bloklamadan ağır işlemler
 * 
 * ÖZELLİKLER:
 * - GZIP açma (pako kütüphanesi ile)
 * - JSON parse işlemleri
 * - Progress callback desteği
 * - Error handling
 */

// Worker içinde pako kütüphanesini yükle
// AŞAMA 2 OPTİMİZASYON: Pako'yu CDN'den yükle (main thread'de zaten yüklenmiş, cache'den hızlı)
let pakoLoaded = false;

// Pako'yu yükle (CDN'den - cache'den hızlı yüklenecek)
try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
    pakoLoaded = typeof pako !== 'undefined';
} catch (e) {
    // CSP veya network hatası - fallback kullanılacak
    console.warn('[Worker] Pako CDN\'den yüklenemedi:', e);
    pakoLoaded = false;
}

/**
 * GZIP açma fonksiyonu
 * @param {Uint8Array} uint8Array - Sıkıştırılmış veri
 * @returns {string} - Açılmış string
 */
function decompressGzip(uint8Array) {
    if (!pakoLoaded) {
        throw new Error('Pako kütüphanesi yüklenemedi');
    }
    
    try {
        return pako.ungzip(uint8Array, { to: 'string' });
    } catch (error) {
        throw new Error(`GZIP açma hatası: ${error.message}`);
    }
}

/**
 * JSON parse fonksiyonu
 * @param {string} jsonString - JSON string
 * @returns {object} - Parse edilmiş obje
 */
function parseJSON(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        if (error.message && error.message.includes('Unexpected token')) {
            throw new Error('Geçersiz JSON formatı - HTML sayfası döndü (404)');
        }
        throw error;
    }
}

/**
 * İndirim ürünlerinin tutarını negatif yapan fonksiyon
 * TEST MODU: İndirim mantığı devre dışı (Odoo zaten indirimleri düşüyor)
 * NOT: Bu fonksiyon main thread'deki applyDiscountLogic ile aynı olmalı
 * @param {object} item - Veri öğesi
 * @returns {object} - İşlenmiş veri öğesi
 */
function applyDiscountLogic(item) {
    // TEST MODU: İndirim mantığı devre dışı
    // Main thread'deki fonksiyonun aynısı
    return item;
    
    // ORİJİNAL KOD (şimdilik devre dışı):
    // İndirim ürünlerini tespit et
    // const productName = (item.product || '').toLowerCase();
    // if (productName.includes('[disc]') ||
    //     productName.includes('indirim') || 
    //     productName.includes('discount') ||
    //     productName.includes('toplam tutarda indirim') ||
    //     (productName.includes('%') && productName.includes('ürünlerde indirim')) ||
    //     (productName.includes('%') && productName.includes('indirim')) ||
    //     productName.includes('ücretsiz')) {
    //     return {
    //         ...item,
    //         usd_amount: -Math.abs(parseFloat(item.usd_amount || 0)),
    //         quantity: Math.abs(parseFloat(item.quantity || 0)),
    //         _isDiscount: true
    //     };
    // }
    // return item;
}

/**
 * Worker message handler
 */
self.addEventListener('message', async function(e) {
    const { type, data, taskId, options } = e.data;
    
    try {
        switch (type) {
            case 'decompress-gzip': {
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 10,
                    message: 'GZIP açılıyor...'
                });
                
                const uint8Array = new Uint8Array(data);
                const decompressed = decompressGzip(uint8Array);
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 50,
                    message: 'GZIP açıldı'
                });
                
                // Sonucu gönder
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: decompressed
                });
                break;
            }
            
            case 'parse-json': {
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 60,
                    message: 'JSON parse ediliyor...'
                });
                
                const parsed = parseJSON(data);
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 90,
                    message: 'JSON parse edildi'
                });
                
                // Sonucu gönder
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: parsed
                });
                break;
            }
            
            case 'decompress-and-parse': {
                // 🚀 HİZMET 1: Streaming JSON Parser entegrasyonu
                // Artık streaming JSON parser kullanılıyor - 10x daha hızlı
                const totalStart = performance.now();
                
                // PERFORMANS LOG: Worker başlangıç
                const workerStartTime = performance.now();
                const dataInfo = {
                    type: data instanceof ArrayBuffer ? 'ArrayBuffer' : typeof data,
                    size: data instanceof ArrayBuffer ? data.byteLength : (typeof data === 'string' ? data.length : 'unknown')
                };
                
                console.log(`🚀 PERFORMANS DEBUG - Worker Task ${taskId}: Streaming JSON Parser başlatılıyor`);
                console.log(`📊 Veri tipi: ${dataInfo.type}, Boyut: ${dataInfo.size}`);
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 5,
                    message: 'Streaming JSON parser hazırlanıyor...'
                });
                
                // Eğer data ArrayBuffer ise (eski kod uyumluluğu), text'e çevir
                let jsonString;
                let conversionTime = 0;
                
                if (data instanceof ArrayBuffer) {
                    const conversionStart = performance.now();
                    const decoder = new TextDecoder('utf-8');
                    jsonString = decoder.decode(new Uint8Array(data));
                    conversionTime = performance.now() - conversionStart;
                    console.log(`🔍 PERFORMANS DEBUG - Worker Task ${taskId}: ArrayBuffer -> String conversion: ${conversionTime.toFixed(2)}ms`);
                } else if (typeof data === 'string') {
                    jsonString = data;
                } else {
                    throw new Error('Beklenmeyen veri tipi: ArrayBuffer veya string bekleniyor');
                }
                
                // HTML kontrolü (404 sayfası olabilir)
                const trimmed = jsonString.trim();
                if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
                    throw new Error('Veri bulunamadı - HTML sayfası döndü (404)');
                }
                
                // JSON parse öncesi bilgi
                const jsonSize = jsonString.length;
                console.log(`📊 JSON boyutu: ${(jsonSize / 1024 / 1024).toFixed(2)}MB`);
                
                // 🚀 STREAMING JSON PARSER KULLANIMI
                try {
                    // Streaming parser'ı worker içinde implemente et
                    const result = await parseJSONStreaming(jsonString, taskId, (progress, processed, total) => {
                        self.postMessage({
                            type: 'progress',
                            taskId,
                            progress: Math.round(10 + (progress * 0.8)), // 10% - 90% arası
                            message: `Streaming parse: ${processed.toLocaleString()}/${total.toLocaleString()} kayıt`
                        });
                    });
                    
                    const totalDuration = performance.now() - totalStart;
                    const parsedSize = Array.isArray(result) ? result.length : (typeof result === 'object' ? Object.keys(result).length : 'unknown');
                    
                    console.log(`✅ Worker Task ${taskId}: Streaming JSON parser tamamlandı`);
                    console.log(`   ⏱️ Toplam süre: ${totalDuration.toFixed(2)}ms`);
                    console.log(`   📦 İşlenen kayıt: ${parsedSize.toLocaleString()}`);
                    console.log(`   ⚡ Hız: ${(parsedSize / (totalDuration / 1000)).toFixed(0)} kayıt/saniye`);
                    
                    // Progress mesajı
                    self.postMessage({
                        type: 'progress',
                        taskId,
                        progress: 90,
                        message: `Streaming parse tamamlandı (${totalDuration.toFixed(1)}ms)`
                    });
                    
                    // Sonucu gönder
                    self.postMessage({
                        type: 'success',
                        taskId,
                        result: result
                    });
                    
                } catch (error) {
                    console.error(`❌ Worker Task ${taskId}: Streaming JSON parser hatası:`, error);
                    
                    // Fallback: Normal JSON.parse
                    console.log(`🔄 Fallback: Normal JSON.parse kullanılıyor...`);
                    self.postMessage({
                        type: 'progress',
                        taskId,
                        progress: 50,
                        message: 'Fallback: Normal JSON parse kullanılıyor...'
                    });
                    
                    const parsed = parseJSON(jsonString);
                    const totalDuration = performance.now() - totalStart;
                    
                    self.postMessage({
                        type: 'progress',
                        taskId,
                        progress: 90,
                        message: `Fallback parse tamamlandı (${totalDuration.toFixed(1)}ms)`
                    });
                    
                    self.postMessage({
                        type: 'success',
                        taskId,
                        result: parsed
                    });
                }
                break;
            }
            
            // 🚀 HİZMET 1: Streaming JSON Parser (Worker'da)
            case 'decompress-and-parse-streaming': {
                const startTime = performance.now();
                const dataSize = data ? data.byteLength : 0;
                
                // Streaming JSON Parser import et
                const { StreamingJSONParser } = await import('./streaming-json-parser.js');
                
                // ArrayBuffer'ı string'e çevir
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(new Uint8Array(data));
                
                // Streaming parser oluştur
                const streamingParser = new StreamingJSONParser({
                    chunkSize: options?.chunkSize || 10000,
                    onProgress: (progress, processed, total) => {
                        // Progress'i ana thread'e gönder
                        self.postMessage({
                            type: 'progress',
                            taskId,
                            progress: Math.round(10 + (progress * 0.8)),
                            message: `Streaming parse: ${processed.toLocaleString()}/${total.toLocaleString()} kayıt`
                        });
                    },
                    onChunk: (chunkData, chunkIndex, totalChunks, processedItems) => {
                        // Chunk tamamlandığında ana thread'e gönder (Progressive UI Updates)
                        self.postMessage({
                            type: 'chunk',
                            taskId,
                            chunkData,
                            chunkIndex,
                            totalChunks,
                            processedItems
                        });
                    }
                });
                
                // Streaming parse yap
                const result = await streamingParser.parse(jsonString);
                
                const endTime = performance.now();
                const duration = endTime - startTime;
                const resultSize = Array.isArray(result) ? result.length : (typeof result === 'object' ? Object.keys(result).length : 'unknown');
                
                console.log(`🚀 Streaming JSON Parser tamamlandı: ${duration.toFixed(2)}ms, ${resultSize} kayıt`);
                
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: result
                });
                break;
            }
            
            case 'process-data-chunk': {
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 10,
                    message: 'Veri işleniyor...'
                });
                
                // Chunk'ı işle - applyDiscountLogic uygula
                const processed = data.map(item => applyDiscountLogic(item));
                
                // Progress callback gönder
                self.postMessage({
                    type: 'progress',
                    taskId,
                    progress: 90,
                    message: 'Veri işlendi'
                });
                
                // Sonucu gönder
                self.postMessage({
                    type: 'success',
                    taskId,
                    result: processed
                });
                break;
            }
            
            default:
                throw new Error(`Bilinmeyen işlem tipi: ${type}`);
        }
    } catch (error) {
        // Hata durumunda
        self.postMessage({
            type: 'error',
            taskId,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});

/**
 * 🚀 STREAMING JSON PARSER - Worker içinde implemente
 * Büyük JSON verilerini incremental olarak parse eder
 */
async function parseJSONStreaming(jsonString, taskId, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            const result = [];
            let currentIndex = 1; // '[' karakterinden sonra başla
            let inString = false;
            let escapeNext = false;
            let braceDepth = 0;
            let bracketDepth = 0;
            let currentChunk = '';
            let chunkItemCount = 0;
            let processedItems = 0;
            
            // Tahmin edilen toplam item sayısı
            const totalItems = jsonString.match(/{/g)?.length || 100000;
            
            console.log(`🔍 Worker Task ${taskId}: Streaming parser başlatılıyor, Tahmin edilen toplam: ${totalItems}`);
            
            const processChunk = () => {
                if (currentChunk.trim()) {
                    try {
                        const parseStart = performance.now();
                        const items = JSON.parse(`[${currentChunk}]`);
                        const parseTime = performance.now() - parseStart;
                        
                        // Her item'ı result array'ine ekle
                        items.forEach(item => {
                            result.push(item);
                            processedItems++;
                            chunkItemCount++;
                        });
                        
                        // Progress callback
                        const progress = (processedItems / totalItems) * 100;
                        onProgress(progress, processedItems, totalItems);
                        
                        // Chunk boyutuna ulaştıysa biraz bekle
                        if (chunkItemCount >= 5000) { // Worker içinde daha küçük chunk
                            currentChunk = '';
                            chunkItemCount = 0;
                            setTimeout(processNextChunk, 1); // 1ms bekle
                            return;
                        }
                    } catch (error) {
                        console.error(`❌ Worker streaming parse chunk hatası:`, error);
                        reject(error);
                        return;
                    }
                }
                currentChunk = '';
                parseNextChunk();
            };

            const parseNextChunk = () => {
                try {
                    // String'in sonuna mı ulaştık?
                    if (currentIndex >= jsonString.length - 1) {
                        // Son chunk'ı işle
                        if (currentChunk.trim()) {
                            const items = JSON.parse(`[${currentChunk}]`);
                            items.forEach(item => {
                                result.push(item);
                                processedItems++;
                            });
                        }
                        console.log(`✅ Worker Task ${taskId}: Streaming parser tamamlandı, Toplam işlenen: ${processedItems}`);
                        resolve(result);
                        return;
                    }

                    // Sonraki item'ı bul
                    let itemStart = currentIndex;
                    let itemEnd = -1;
                    let foundCompleteItem = false;

                    for (let i = currentIndex; i < jsonString.length; i++) {
                        const char = jsonString[i];
                        const prevChar = i > 0 ? jsonString[i - 1] : '';

                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }

                        if (char === '\\') {
                            escapeNext = true;
                            continue;
                        }

                        if (char === '"' && prevChar !== '\\') {
                            inString = !inString;
                            continue;
                        }

                        if (inString) continue;

                        if (char === '{') {
                            braceDepth++;
                        } else if (char === '}') {
                            braceDepth--;
                        } else if (char === '[') {
                            bracketDepth++;
                        } else if (char === ']') {
                            bracketDepth--;
                        }

                        // Item tamamlandığında
                        if (braceDepth === 0 && bracketDepth === 0 && char === '}' && i < jsonString.length - 1) {
                            // Sonraki karakteri kontrol et
                            const nextChar = jsonString[i + 1];
                            if (nextChar === ',' || nextChar === ']') {
                                itemEnd = i + 1;
                                foundCompleteItem = true;
                                currentIndex = nextChar === ',' ? i + 2 : i + 1;
                                break;
                            }
                        }
                    }

                    if (foundCompleteItem) {
                        const item = jsonString.substring(itemStart, itemEnd);
                        if (currentChunk) {
                            currentChunk += ',';
                        }
                        currentChunk += item;
                        chunkItemCount++;

                        // Chunk boyutuna ulaştıysa işle
                        if (chunkItemCount >= 5000) {
                            processChunk();
                        } else {
                            // Devam et
                            parseNextChunk();
                        }
                    } else {
                        // Son item'a ulaştık
                        const remaining = jsonString.substring(itemStart).trim();
                        if (remaining && remaining !== ']') {
                            if (currentChunk) {
                                currentChunk += ',';
                            }
                            currentChunk += remaining.replace(/]$/, '');
                        }
                        processChunk();
                    }
                } catch (error) {
                    console.error(`❌ Worker streaming parse hatası (index: ${currentIndex}):`, error);
                    reject(error);
                }
            };

            // Başlat
            parseNextChunk();
            
        } catch (error) {
            console.error(`❌ Worker streaming parser başlatma hatası:`, error);
            reject(error);
        }
    });
}

// Worker başlatıldığında
self.postMessage({
    type: 'ready',
    pakoLoaded
});
