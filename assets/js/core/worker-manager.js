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
            
            // Worker mesajlarını dinle
            this.worker.addEventListener('message', (e) => {
                this.handleWorkerMessage(e.data);
            });
            
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
        const { type, taskId, progress, message, result, error } = data;
        
        const task = this.pendingTasks.get(taskId);
        if (!task) {
            safeConsole.warn(`⚠️ Bilinmeyen task ID: ${taskId}`);
            return;
        }
        
        switch (type) {
            case 'progress':
                // Progress callback'i çağır
                if (task.onProgress) {
                    task.onProgress(progress, message);
                }
                break;
                
            case 'success':
                // Task'ı tamamla
                task.resolve(result);
                this.pendingTasks.delete(taskId);
                break;
                
            case 'error':
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
        if (!this.isReady || !this.worker) {
            if (this.fallbackEnabled) {
                return this.decompressAndParseFallback(arrayBuffer);
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
            
            // AŞAMA 2 OPTİMİZASYON: Transferable objects kullan (ArrayBuffer transfer)
            // Bu şekilde ArrayBuffer kopyalanmaz, sadece ownership transfer edilir (çok daha hızlı)
            this.worker.postMessage({
                type: 'decompress-and-parse',
                data: arrayBuffer,
                taskId
            }, [arrayBuffer]); // Transferable objects - ArrayBuffer ownership transfer edilir
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
     * Fallback: GZIP açma + JSON parse (main thread'de)
     */
    async decompressAndParseFallback(arrayBuffer) {
        safeConsole.log('⚠️ Worker kullanılamıyor, fallback (main thread) kullanılıyor');
        
        const decompressed = await this.decompressGzipFallback(arrayBuffer);
        return this.parseJSONFallback(decompressed);
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

