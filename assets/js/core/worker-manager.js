/**
 * WORKER MANAGER - Web Worker Yönetim Modülü
 * AŞAMA 2: Web Worker lifecycle ve task yönetimi
 * 
 * ÖZELLİKLER:
 * - Worker instance yönetimi
 * - Task queue ve progress tracking
 * - Fallback mekanizması
 * - Error handling
 */

import { safeConsole } from './logger.js';
import { applyDiscountLogic } from '../data/data-processor.js';

class WorkerManager {
    constructor() {
        this.worker = null;
        this.workerPath = 'assets/js/core/data-worker.js';
        this.isSupported = typeof Worker !== 'undefined';
        this.isReady = false;
        this.pendingTasks = new Map();
        this.taskIdCounter = 0;
        this.fallbackEnabled = true; // Fallback aktif mi?
    }
    
    /**
     * Worker'ı başlat
     */
    async init() {
        if (!this.isSupported) {
            safeConsole.warn('⚠️ Web Worker desteklenmiyor, fallback kullanılacak');
            return false;
        }
        
        try {
            this.worker = new Worker(this.workerPath);
            
            // Worker hatalarını dinle
            this.worker.addEventListener('error', (error) => {
                safeConsole.error('❌ Worker hatası:', error);
                this.handleWorkerError(error);
            });
            
            // Worker'ın hazır olmasını bekle
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    safeConsole.warn('⚠️ Worker hazır olma timeout, fallback kullanılacak');
                    this.terminate();
                    resolve(false);
                }, 5000); // 5 saniye timeout
                
                const messageHandler = (e) => {
                    if (e.data.type === 'ready') {
                        clearTimeout(timeout);
                        this.worker.removeEventListener('message', messageHandler);
                        this.isReady = e.data.pakoLoaded;
                        safeConsole.log(`✅ Worker hazır (Pako: ${e.data.pakoLoaded ? 'Yüklü' : 'Yüklenemedi'})`);
                        
                        // 'ready' mesajı handle edildikten SONRA genel listener'ı ekle
                        // Bu şekilde 'ready' mesajı genel listener'a gitmez
                        this.worker.addEventListener('message', (e) => {
                            this.handleWorkerMessage(e.data);
                        });
                        
                        resolve(this.isReady);
                    }
                };
                
                this.worker.addEventListener('message', messageHandler);
            });
        } catch (error) {
            safeConsole.error('❌ Worker başlatılamadı:', error);
            this.worker = null;
            return false;
        }
    }
    
    /**
     * Worker mesajlarını işle
     */
    handleWorkerMessage(data) {
        const { type, taskId, progress, message, result, error, chunkData, chunkIndex, totalChunks, processedItems } = data;
        
        // 'ready' mesajı taskId gerektirmez (worker başlatıldığında gönderilir)
        // Bu mesaj init() içinde özel olarak handle ediliyor, buraya gelmemeli
        // Ama güvenlik için kontrol ediyoruz
        if (type === 'ready') {
            // Bu mesaj init() içinde handle ediliyor, buraya gelmemeli
            // Ama eğer gelirse sessizce ignore et
            return;
        }
        
        // Task gerektiren mesajlar için taskId kontrolü yap
        if (!taskId) {
            safeConsole.warn(`⚠️ Worker mesajında taskId eksik:`, { type, data });
            return;
        }
        
        const task = this.pendingTasks.get(taskId);
        if (!task) {
            safeConsole.warn(`⚠️ Bilinmeyen task ID: ${taskId} (type: ${type})`);
            return;
        }
        
        switch (type) {
            case 'progress':
                // PERFORMANS LOG: Progress update
                const progressTime = performance.now() - task.startTime;
                safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Task ${taskId}: Progress ${progress}% - ${message} (${progressTime.toFixed(2)}ms)`);
                
                // Progress callback'i çağır
                if (task.onProgress) {
                    task.onProgress(progress, message);
                }
                break;
                
            case 'chunk':
                // 🚀 HİZMET 1: Streaming chunk callback
                const chunkTime = performance.now() - task.startTime;
                safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Task ${taskId}: Chunk ${chunkIndex + 1}/${totalChunks} tamamlandı (${chunkTime.toFixed(2)}ms), İşlenen kayıt: ${processedItems?.toLocaleString() || 'bilinmiyor'}`);
                
                // Chunk callback'i çağır (Progressive UI Updates için)
                if (task.onChunk && chunkData) {
                    task.onChunk(chunkData, chunkIndex, totalChunks, processedItems);
                }
                break;
                
            case 'success':
                // PERFORMANS LOG: Task başarıyla tamamlandı
                const successTime = performance.now() - task.startTime;
                const resultSize = Array.isArray(result) ? result.length : (typeof result === 'object' ? Object.keys(result).length : 'unknown');
                safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Task ${taskId}: Başarıyla tamamlandı (${successTime.toFixed(2)}ms), Kayıt sayısı: ${resultSize}`);
                
                // Task'ı tamamla
                task.resolve(result);
                this.pendingTasks.delete(taskId);
                break;
                
            case 'error':
                // PERFORMANS LOG: Task hata ile tamamlandı
                const errorTime = performance.now() - task.startTime;
                safeConsole.error(`🔍 PERFORMANS DEBUG - Worker Task ${taskId}: Hata (${errorTime.toFixed(2)}ms): ${error.message}`);
                
                // Task'ı hata ile tamamla
                task.reject(new Error(error.message));
                this.pendingTasks.delete(taskId);
                break;
        }
    }
    
    /**
     * Worker hatasını işle
     */
    handleWorkerError(error) {
        // Tüm pending task'ları iptal et
        for (const [taskId, task] of this.pendingTasks.entries()) {
            task.reject(new Error(`Worker hatası: ${error.message}`));
        }
        this.pendingTasks.clear();
        
        // Worker'ı sonlandır
        this.terminate();
    }
    
    /**
     * GZIP açma (Worker'da)
     */
    async decompressGzip(arrayBuffer, onProgress = null) {
        if (!this.isReady || !this.worker) {
            if (this.fallbackEnabled) {
                return this.decompressGzipFallback(arrayBuffer);
            }
            throw new Error('Worker hazır değil ve fallback devre dışı');
        }
        
        const taskId = ++this.taskIdCounter;
        
        return new Promise((resolve, reject) => {
            this.pendingTasks.set(taskId, {
                resolve,
                reject,
                onProgress
            });
            
            // Worker'a gönder
            this.worker.postMessage({
                type: 'decompress-gzip',
                data: arrayBuffer,
                taskId
            });
        });
    }
    
    /**
     * JSON parse (Worker'da)
     */
    async parseJSON(jsonString, onProgress = null) {
        if (!this.isReady || !this.worker) {
            if (this.fallbackEnabled) {
                return this.parseJSONFallback(jsonString);
            }
            throw new Error('Worker hazır değil ve fallback devre dışı');
        }
        
        const taskId = ++this.taskIdCounter;
        
        return new Promise((resolve, reject) => {
            this.pendingTasks.set(taskId, {
                resolve,
                reject,
                onProgress
            });
            
            // Worker'a gönder
            this.worker.postMessage({
                type: 'parse-json',
                data: jsonString,
                taskId
            });
        });
    }
    
    /**
     * GZIP açma + JSON parse (Worker'da - tek seferde)
     */
    async decompressAndParse(arrayBuffer, onProgress = null) {
        const startTime = performance.now();
        const dataSize = arrayBuffer ? arrayBuffer.byteLength : 0;
        
        // PERFORMANS LOG: Worker task başlangıcı
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Manager: decompressAndParse çağrıldı, Veri boyutu: ${dataSize} bytes`);
        
        if (!this.isReady || !this.worker) {
            safeConsole.log(`🔍 PERFORMANS DEBUG - Worker hazır değil, Fallback kullanılacak (Ready: ${this.isReady}, Worker: ${!!this.worker})`);
            if (this.fallbackEnabled) {
                return this.decompressAndParseFallback(arrayBuffer);
            }
            throw new Error('Worker hazır değil ve fallback devre dışı');
        }
        
        const taskId = ++this.taskIdCounter;
        const taskStartTime = performance.now();
        
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Manager: Task ${taskId} oluşturuldu, Worker'a gönderiliyor...`);
        
        return new Promise((resolve, reject) => {
            this.pendingTasks.set(taskId, {
                resolve,
                reject,
                onProgress,
                startTime: taskStartTime
            });
            
            // AŞAMA 2 OPTİMİZASYON: Transferable objects kullan (ArrayBuffer transfer)
            // Bu şekilde ArrayBuffer kopyalanmaz, sadece ownership transfer edilir (çok daha hızlı)
            const postMessageStart = performance.now();
            this.worker.postMessage({
                type: 'decompress-and-parse',
                data: arrayBuffer,
                taskId
            }, [arrayBuffer]); // Transferable objects - ArrayBuffer ownership transfer edilir
            
            const postMessageTime = performance.now() - postMessageStart;
            safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Manager: Task ${taskId} Worker'a gönderildi (${postMessageTime.toFixed(2)}ms)`);
        });
    }
    
    /**
     * 🚀 HİZMET 1: Streaming JSON Parser (Worker'da)
     * Büyük JSON verilerini incremental olarak parse eder
     *
     * @param {ArrayBuffer} arrayBuffer - JSON verisi
     * @param {Object} options - Ayarlar
     * @param {Function} options.onProgress - Progress callback
     * @param {Function} options.onChunk - Chunk tamamlandığında callback
     * @param {number} options.chunkSize - Chunk boyutu (varsayılan: 10000)
     * @param {boolean} options.enableProgressiveUI - Progressive UI aktif mi
     * @returns {Promise<Object>} - Parse edilmiş veri
     */
    async decompressAndParseStreaming(arrayBuffer, options = {}) {
        const startTime = performance.now();
        const dataSize = arrayBuffer ? arrayBuffer.byteLength : 0;
        
        // PERFORMANS LOG: Streaming parser başlangıcı
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Manager: decompressAndParseStreaming çağrıldı, Veri boyutu: ${dataSize} bytes`);
        safeConsole.log(`🚀 Streaming JSON Parser başlatılıyor: chunkSize=${options.chunkSize || 10000}, progressiveUI=${options.enableProgressiveUI || false}`);
        
        if (!this.isReady || !this.worker) {
            safeConsole.log(`🔍 PERFORMANS DEBUG - Worker hazır değil, Streaming Fallback kullanılacak (Ready: ${this.isReady}, Worker: ${!!this.worker})`);
            if (this.fallbackEnabled) {
                return this.decompressAndParseStreamingFallback(arrayBuffer, options);
            }
            throw new Error('Worker hazır değil ve fallback devre dışı');
        }
        
        const taskId = ++this.taskIdCounter;
        const taskStartTime = performance.now();
        
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Manager: Streaming Task ${taskId} oluşturuldu, Worker'a gönderiliyor...`);
        
        return new Promise((resolve, reject) => {
            this.pendingTasks.set(taskId, {
                resolve,
                reject,
                onProgress: options.onProgress,
                onChunk: options.onChunk,
                startTime: taskStartTime,
                chunkSize: options.chunkSize || 10000,
                enableProgressiveUI: options.enableProgressiveUI || false
            });
            
            // Transferable objects ile gönder (performans optimizasyonu)
            const postMessageStart = performance.now();
            this.worker.postMessage({
                type: 'decompress-and-parse-streaming',
                data: arrayBuffer,
                taskId,
                options: {
                    chunkSize: options.chunkSize || 10000,
                    enableProgressiveUI: options.enableProgressiveUI || false
                }
            }, [arrayBuffer]); // Transferable objects - ArrayBuffer ownership transfer edilir
            
            const postMessageTime = performance.now() - postMessageStart;
            safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Manager: Streaming Task ${taskId} Worker'a gönderildi (${postMessageTime.toFixed(2)}ms)`);
        });
    }
    
    /**
     * Veri chunk'ını işle (Worker'da - applyDiscountLogic uygula)
     * Büyük veri setlerinde Worker kullan, küçüklerde main thread
     *
     * @param {Array} chunk - İşlenecek veri chunk'ı
     * @param {Function} onProgress - Progress callback (opsiyonel)
     * @returns {Promise<Array>} - İşlenmiş veri chunk'ı
     */
    async processDataChunk(chunk, onProgress = null) {
        if (!this.isReady || !this.worker) {
            if (this.fallbackEnabled) {
                return this.processDataChunkFallback(chunk);
            }
            throw new Error('Worker hazır değil ve fallback devre dışı');
        }
        
        const taskId = ++this.taskIdCounter;
        
        return new Promise((resolve, reject) => {
            this.pendingTasks.set(taskId, {
                resolve,
                reject,
                onProgress
            });
            
            // Worker'a chunk'ı gönder
            this.worker.postMessage({
                type: 'process-data-chunk',
                data: chunk,
                taskId
            });
        });
    }
    
    /**
     * Fallback: GZIP açma (main thread'de)
     */
    async decompressGzipFallback(arrayBuffer) {
        safeConsole.log('⚠️ Worker kullanılamıyor, fallback (main thread) kullanılıyor');
        
        if (typeof pako === 'undefined') {
            throw new Error('Pako kütüphanesi yüklenmedi');
        }
        
        const uint8Array = new Uint8Array(arrayBuffer);
        return pako.ungzip(uint8Array, { to: 'string' });
    }
    
    /**
     * Fallback: Veri chunk'ını işle (main thread'de)
     * 
     * @param {Array} chunk - İşlenecek veri chunk'ı
     * @returns {Array} - İşlenmiş veri chunk'ı
     */
    processDataChunkFallback(chunk) {
        // Main thread'de işle - applyDiscountLogic uygula
        return chunk.map(item => applyDiscountLogic(item));
    }
    
    /**
     * Fallback: JSON parse (main thread'de)
     */
    async parseJSONFallback(jsonString) {
        safeConsole.log('⚠️ Worker kullanılamıyor, fallback (main thread) kullanılıyor');
        return JSON.parse(jsonString);
    }
    
    /**
     * Fallback: JSON parse (main thread'de) - Artık sıkıştırma yok
     */
    async decompressAndParseFallback(arrayBuffer) {
        const startTime = performance.now();
        const dataSize = arrayBuffer ? arrayBuffer.byteLength : 0;
        
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Fallback: decompressAndParse çağrıldı, Veri boyutu: ${dataSize} bytes`);
        
        // Artık sıkıştırma yok, direkt JSON parse
        const decodeStart = performance.now();
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(new Uint8Array(arrayBuffer));
        const decodeTime = performance.now() - decodeStart;
        
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Fallback: ArrayBuffer -> String decode: ${decodeTime.toFixed(2)}ms, String uzunluğu: ${jsonString.length}`);
        
        const parseStart = performance.now();
        const result = this.parseJSONFallback(jsonString);
        const parseTime = performance.now() - parseStart;
        const totalTime = performance.now() - startTime;
        
        const resultSize = Array.isArray(result) ? result.length : (typeof result === 'object' ? Object.keys(result).length : 'unknown');
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Fallback: JSON parse: ${parseTime.toFixed(2)}ms, Toplam: ${totalTime.toFixed(2)}ms, Kayıt sayısı: ${resultSize}`);
        
        return result;
    }
    
    /**
     * 🚀 HİZMET 1: Streaming JSON Parser Fallback (Main thread)
     * Worker kullanılamadığında main thread'de streaming parser kullan
     *
     * @param {ArrayBuffer} arrayBuffer - JSON verisi
     * @param {Object} options - Ayarlar
     * @returns {Promise<Object>} - Parse edilmiş veri
     */
    async decompressAndParseStreamingFallback(arrayBuffer, options = {}) {
        const startTime = performance.now();
        const dataSize = arrayBuffer ? arrayBuffer.byteLength : 0;
        
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Fallback: Streaming Parser çağrıldı, Veri boyutu: ${dataSize} bytes`);
        
        // ArrayBuffer'ı string'e çevir
        const decodeStart = performance.now();
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(new Uint8Array(arrayBuffer));
        const decodeTime = performance.now() - decodeStart;
        
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Fallback: ArrayBuffer -> String decode: ${decodeTime.toFixed(2)}ms, String uzunluğu: ${jsonString.length}`);
        
        // Main thread'de streaming parser kullan (import edilmiş class)
        const { StreamingJSONParser } = await import('../core/streaming-json-parser.js');
        
        const streamingParser = new StreamingJSONParser({
            chunkSize: options.chunkSize || 10000,
            onProgress: (progress, processed, total) => {
                if (options.onProgress) {
                    options.onProgress(progress, `${processed.toLocaleString()}/${total.toLocaleString()} kayıt`);
                }
            },
            onChunk: (chunkData, chunkIndex, totalChunks) => {
                if (options.onChunk) {
                    options.onChunk(chunkData, chunkIndex, totalChunks, (chunkIndex + 1) * (options.chunkSize || 10000));
                }
            }
        });
        
        const parseStart = performance.now();
        const result = await streamingParser.parse(jsonString);
        const parseTime = performance.now() - parseStart;
        const totalTime = performance.now() - startTime;
        
        const resultSize = Array.isArray(result) ? result.length : (typeof result === 'object' ? Object.keys(result).length : 'unknown');
        safeConsole.log(`🔍 PERFORMANS DEBUG - Worker Fallback: Streaming JSON parse: ${parseTime.toFixed(2)}ms, Toplam: ${totalTime.toFixed(2)}ms, Kayıt sayısı: ${resultSize}`);
        
        return result;
    }
    
    /**
     * Worker'ı sonlandır
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
            this.pendingTasks.clear();
            safeConsole.log('🧹 Worker terminate edildi');
        }
    }
    
    /**
     * Worker durumunu kontrol et
     */
    isAvailable() {
        return this.isSupported && this.isReady && this.worker !== null;
    }
}

// Singleton instance
let workerManagerInstance = null;

/**
 * Worker Manager instance'ını al
 */
export function getWorkerManager() {
    if (!workerManagerInstance) {
        workerManagerInstance = new WorkerManager();
        
        // MEMORY LEAK FIX: Sayfa kapatıldığında worker'ı terminate et (sadece bir kez ekle)
        if (typeof window !== 'undefined' && !window.workerManagerCleanupAdded) {
            window.addEventListener('beforeunload', () => {
                if (workerManagerInstance) {
                    workerManagerInstance.terminate();
                }
            });
            window.workerManagerCleanupAdded = true;
        }
    }
    return workerManagerInstance;
}

/**
 * Worker Manager'ı başlat
 */
export async function initWorkerManager() {
    const manager = getWorkerManager();
    await manager.init();
    return manager;
}

export default WorkerManager;

