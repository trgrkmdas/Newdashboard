/**
 * PERFORMANCE TEST - Veri yükleme performansı test etme
 * 🚀 Streaming JSON Parser ve Progressive UI Updates testleri
 * 
 * ÖZELLİKLER:
 * - Performans metrikleri ölçme
 * - Memory kullanımını takip etme
 * - UI responsiveness testi
 * - Karşılaştırmalı testler
 */

import { safeConsole } from './logger.js';
import { getWorkerManager } from './worker-manager.js';
import { StreamingJSONParser } from './streaming-json-parser.js';

class PerformanceTest {
    constructor() {
        this.testResults = [];
        this.memorySnapshots = [];
        this.uiResponseTimes = [];
    }

    /**
     * Ana performans testini çalıştır
     */
    async runFullTest() {
        safeConsole.log('🧪 Performans testi başlatılıyor...');
        
        // Test ortamını hazırla
        this.setupTestEnvironment();
        
        try {
            // 1. Streaming JSON Parser testi
            await this.testStreamingParser();
            
            // 2. Worker vs Main Thread karşılaştırması
            await this.testWorkerVsMainThread();
            
            // 3. Progressive UI Updates testi
            await this.testProgressiveUI();
            
            // 4. Memory kullanım testi
            await this.testMemoryUsage();
            
            // 5. Chunking stratejisi testi
            await this.testChunkingStrategies();
            
            // Sonuçları raporla
            this.generateReport();
            
        } catch (error) {
            safeConsole.error('❌ Performans testi hatası:', error);
        } finally {
            this.cleanupTestEnvironment();
        }
    }

    /**
     * Test ortamını hazırla
     */
    setupTestEnvironment() {
        // Memory monitoring başlat
        if (performance.memory) {
            this.memoryInterval = setInterval(() => {
                this.memorySnapshots.push({
                    timestamp: performance.now(),
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                });
            }, 100); // 100ms'de bir snapshot
        }
        
        // UI responsiveness monitoring
        this.uiResponseStart = performance.now();
        
        // Test verisi oluştur (eğer yoksa)
        this.generateTestData();
    }

    /**
     * Test verisi oluştur
     */
    generateTestData() {
        if (window.testData) return;
        
        safeConsole.log('📊 Test verisi oluşturuluyor...');
        const testData = {
            details: []
        };
        
        // 100,000 kayıtlık test verisi
        for (let i = 0; i < 100000; i++) {
            testData.details.push({
                id: i + 1,
                date: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                product: `Test Product ${i}`,
                partner: `Customer ${Math.floor(Math.random() * 1000)}`,
                store: `Store ${Math.floor(Math.random() * 50)}`,
                usd_amount: Math.random() * 1000,
                quantity: Math.floor(Math.random() * 10) + 1,
                move_type: Math.random() > 0.1 ? 'out_invoice' : 'out_refund'
            });
        }
        
        window.testData = testData;
        window.testDataString = JSON.stringify(testData);
        
        safeConsole.log(`✅ Test verisi oluşturuldu: ${testData.details.length.toLocaleString()} kayıt`);
    }

    /**
     * Streaming JSON Parser testi
     */
    async testStreamingParser() {
        safeConsole.log('🚀 Streaming JSON Parser testi başlatılıyor...');
        
        const testData = window.testDataString;
        const startTime = performance.now();
        const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        try {
            // Streaming parser ile test
            const streamingParser = new StreamingJSONParser({
                chunkSize: 10000,
                onProgress: (progress, processed, total) => {
                    // Progress'i kaydet
                    this.testResults.push({
                        type: 'streaming_progress',
                        progress,
                        processed,
                        total,
                        timestamp: performance.now()
                    });
                }
            });
            
            const result = await streamingParser.parse(testData);
            
            const endTime = performance.now();
            const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            const duration = endTime - startTime;
            const memoryIncrease = endMemory - startMemory;
            
            this.testResults.push({
                type: 'streaming_parser',
                duration,
                recordCount: result.details.length,
                memoryIncrease,
                recordsPerSecond: Math.round(result.details.length / (duration / 1000)),
                timestamp: endTime
            });
            
            safeConsole.log(`✅ Streaming JSON Parser testi tamamlandı:`);
            safeConsole.log(`   ⏱️ Süre: ${duration.toFixed(2)}ms`);
            safeConsole.log(`   📦 Kayıt: ${result.details.length.toLocaleString()}`);
            safeConsole.log(`   ⚡ Hız: ${Math.round(result.details.length / (duration / 1000)).toLocaleString()} kayıt/saniye`);
            safeConsole.log(`   💾 Memory artışı: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
            
        } catch (error) {
            safeConsole.error('❌ Streaming JSON Parser testi hatası:', error);
            this.testResults.push({
                type: 'streaming_parser_error',
                error: error.message,
                timestamp: performance.now()
            });
        }
    }

    /**
     * Worker vs Main Thread karşılaştırması
     */
    async testWorkerVsMainThread() {
        safeConsole.log('⚖️ Worker vs Main Thread karşılaştırması başlatılıyor...');
        
        const testData = window.testDataString;
        
        // Worker testi
        try {
            const workerManager = getWorkerManager();
            await workerManager.init();
            
            const workerStartTime = performance.now();
            const workerResult = await workerManager.decompressAndParseStreaming(
                new TextEncoder().encode(testData).buffer,
                {
                    chunkSize: 10000,
                    onProgress: (progress, message) => {
                        // Worker progress'i kaydet
                        this.testResults.push({
                            type: 'worker_progress',
                            progress,
                            message,
                            timestamp: performance.now()
                        });
                    }
                }
            );
            
            const workerEndTime = performance.now();
            const workerDuration = workerEndTime - workerStartTime;
            
            this.testResults.push({
                type: 'worker_performance',
                duration: workerDuration,
                recordCount: workerResult.details.length,
                recordsPerSecond: Math.round(workerResult.details.length / (workerDuration / 1000)),
                timestamp: workerEndTime
            });
            
            safeConsole.log(`✅ Worker testi: ${workerDuration.toFixed(2)}ms, ${Math.round(workerResult.details.length / (workerDuration / 1000)).toLocaleString()} kayıt/s`);
            
        } catch (error) {
            safeConsole.error('❌ Worker testi hatası:', error);
        }
        
        // Main Thread testi
        try {
            const mainStartTime = performance.now();
            const mainResult = JSON.parse(testData);
            const mainEndTime = performance.now();
            const mainDuration = mainEndTime - mainStartTime;
            
            this.testResults.push({
                type: 'main_thread_performance',
                duration: mainDuration,
                recordCount: mainResult.details.length,
                recordsPerSecond: Math.round(mainResult.details.length / (mainDuration / 1000)),
                timestamp: mainEndTime
            });
            
            safeConsole.log(`✅ Main Thread testi: ${mainDuration.toFixed(2)}ms, ${Math.round(mainResult.details.length / (mainDuration / 1000)).toLocaleString()} kayıt/s`);
            
            // Karşılaştırma
            const speedup = mainDuration / workerDuration;
            safeConsole.log(`🚀 Worker hızlandırması: ${speedup.toFixed(2)}x daha hızlı`);
            
        } catch (error) {
            safeConsole.error('❌ Main Thread testi hatası:', error);
        }
    }

    /**
     * Progressive UI Updates testi
     */
    async testProgressiveUI() {
        safeConsole.log('🎨 Progressive UI Updates testi başlatılıyor...');
        
        // UI element'leri oluştur
        const testContainer = document.createElement('div');
        testContainer.id = 'performanceTestContainer';
        testContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: white;
            border: 1px solid #ccc;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 9999;
            font-family: monospace;
            font-size: 12px;
        `;
        
        document.body.appendChild(testContainer);
        
        // Progressive UI testi
        const testStartTime = performance.now();
        let updateCount = 0;
        
        const updateUI = () => {
            updateCount++;
            const now = performance.now();
            const elapsed = now - testStartTime;
            
            testContainer.innerHTML = `
                <h4>🎨 Progressive UI Test</h4>
                <div>⏱️ Süre: ${elapsed.toFixed(0)}ms</div>
                <div>🔄 Update: ${updateCount}</div>
                <div>⚡ FPS: ${(updateCount / (elapsed / 1000)).toFixed(1)}</div>
                <div>💾 Memory: ${performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + 'MB' : 'N/A'}</div>
            `;
            
            // UI response time'ı kaydet
            this.uiResponseTimes.push({
                updateCount,
                timestamp: now,
                elapsed,
                memory: performance.memory ? performance.memory.usedJSHeapSize : 0
            });
            
            if (elapsed < 5000) { // 5 saniye test
                requestAnimationFrame(updateUI);
            }
        };
        
        requestAnimationFrame(updateUI);
        
        // 5 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Test sonuçlarını kaydet
        const avgFPS = updateCount / 5;
        this.testResults.push({
            type: 'progressive_ui',
            duration: 5000,
            updateCount,
            avgFPS,
            timestamp: performance.now()
        });
        
        safeConsole.log(`✅ Progressive UI testi: ${avgFPS.toFixed(1)} FPS, ${updateCount} update`);
        
        // Test container'ı kaldır
        document.body.removeChild(testContainer);
    }

    /**
     * Memory kullanım testi
     */
    async testMemoryUsage() {
        safeConsole.log('💾 Memory kullanım testi başlatılıyor...');
        
        const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        // Büyük veri işlemleri yap
        const largeArrays = [];
        for (let i = 0; i < 10; i++) {
            const largeArray = new Array(100000).fill(0).map((_, index) => ({
                id: index,
                data: `test_data_${i}_${index}`,
                timestamp: Date.now(),
                random: Math.random()
            }));
            largeArrays.push(largeArray);
            
            // Memory snapshot al
            this.testResults.push({
                type: 'memory_snapshot',
                iteration: i + 1,
                memory: performance.memory ? performance.memory.usedJSHeapSize : 0,
                arraySize: largeArray.length,
                timestamp: performance.now()
            });
        }
        
        const peakMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const memoryIncrease = peakMemory - startMemory;
        
        // Temizle
        largeArrays.length = 0;
        
        // GC tetikle (varsa)
        if (window.gc) {
            window.gc();
        }
        
        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        this.testResults.push({
            type: 'memory_usage',
            startMemory,
            peakMemory,
            finalMemory,
            memoryIncrease,
            memoryLeak: finalMemory - startMemory,
            timestamp: performance.now()
        });
        
        safeConsole.log(`💾 Memory testi:`);
        safeConsole.log(`   📈 Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB`);
        safeConsole.log(`   📉 Artış: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        safeConsole.log(`   🔍 Leak: ${(finalMemory - startMemory > 0 ? '+' : '')}${((finalMemory - startMemory) / 1024 / 1024).toFixed(2)}MB`);
    }

    /**
     * Chunking stratejileri testi
     */
    async testChunkingStrategies() {
        safeConsole.log('📦 Chunking stratejileri testi başlatılıyor...');
        
        const testData = window.testData.details;
        const chunkSizes = [500, 1000, 2000, 5000, 10000];
        
        for (const chunkSize of chunkSizes) {
            const startTime = performance.now();
            
            // Veriyi chunk'lara böl
            const chunks = [];
            for (let i = 0; i < testData.length; i += chunkSize) {
                chunks.push(testData.slice(i, i + chunkSize));
            }
            
            // Chunk'ları işle
            let processedCount = 0;
            for (const chunk of chunks) {
                // Simüle edilmiş işleme
                const processed = chunk.map(item => ({
                    ...item,
                    processed: true,
                    chunkSize: chunkSize
                }));
                processedCount += processed.length;
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            this.testResults.push({
                type: 'chunking_strategy',
                chunkSize,
                chunkCount: chunks.length,
                duration,
                recordsPerSecond: Math.round(processedCount / (duration / 1000)),
                timestamp: endTime
            });
            
            safeConsole.log(`📦 Chunk ${chunkSize}: ${duration.toFixed(2)}ms, ${chunks.length} chunk, ${Math.round(processedCount / (duration / 1000)).toLocaleString()} kayıt/s`);
        }
    }

    /**
     * Test raporu oluştur
     */
    generateReport() {
        safeConsole.log('📊 Performans test raporu oluşturuluyor...');
        
        const report = {
            testDate: new Date().toISOString(),
            browser: navigator.userAgent,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null,
            results: this.testResults,
            summary: this.generateSummary()
        };
        
        // Raporu konsola yazdır
        console.group('🚀 PERFORMANS TEST RAPORU');
        console.log('📅 Tarih:', report.testDate);
        console.log('🌐 Browser:', report.browser);
        console.log('💾 Memory:', report.memory);
        console.log('📊 Özet:', report.summary);
        console.log('📋 Detaylı sonuçlar:', report.results);
        console.groupEnd();
        
        // Raporu localStorage'a kaydet
        localStorage.setItem('performanceTestReport', JSON.stringify(report));
        
        // HTML raporu oluştur
        this.createHTMLReport(report);
        
        safeConsole.log('✅ Performans test raporu tamamlandı!');
    }

    /**
     * Test özeti oluştur
     */
    generateSummary() {
        const summary = {
            streamingParser: this.testResults.filter(r => r.type === 'streaming_parser')[0],
            workerPerformance: this.testResults.filter(r => r.type === 'worker_performance')[0],
            mainThreadPerformance: this.testResults.filter(r => r.type === 'main_thread_performance')[0],
            progressiveUI: this.testResults.filter(r => r.type === 'progressive_ui')[0],
            memoryUsage: this.testResults.filter(r => r.type === 'memory_usage')[0],
            chunkingStrategies: this.testResults.filter(r => r.type === 'chunking_strategy')
        };
        
        // En iyi chunking stratejisi
        if (summary.chunkingStrategies.length > 0) {
            summary.bestChunkingStrategy = summary.chunkingStrategies.reduce((best, current) => 
                current.recordsPerSecond > best.recordsPerSecond ? current : best
            );
        }
        
        // Worker vs Main Thread karşılaştırması
        if (summary.workerPerformance && summary.mainThreadPerformance) {
            summary.speedup = summary.mainThreadPerformance.duration / summary.workerPerformance.duration;
        }
        
        return summary;
    }

    /**
     * HTML raporu oluştur
     */
    createHTMLReport(report) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Performans Test Raporu</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
                .section { margin-bottom: 30px; }
                .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9ecef; border-radius: 3px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .success { color: #28a745; }
                .warning { color: #ffc107; }
                .error { color: #dc3545; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚀 Performans Test Raporu</h1>
                <p><strong>Tarih:</strong> ${new Date(report.testDate).toLocaleString('tr-TR')}</p>
                <p><strong>Browser:</strong> ${report.browser}</p>
            </div>
            
            <div class="section">
                <h2>📊 Özet</h2>
                <div class="metric">Streaming Parser: ${report.summary.streamingParser ? report.summary.streamingParser.recordsPerSecond.toLocaleString() + ' kayıt/s' : 'N/A'}</div>
                <div class="metric">Worker: ${report.summary.workerPerformance ? report.summary.workerPerformance.recordsPerSecond.toLocaleString() + ' kayıt/s' : 'N/A'}</div>
                <div class="metric">Main Thread: ${report.summary.mainThreadPerformance ? report.summary.mainThreadPerformance.recordsPerSecond.toLocaleString() + ' kayıt/s' : 'N/A'}</div>
                <div class="metric">Hızlanma: ${report.summary.speedup ? report.summary.speedup.toFixed(2) + 'x' : 'N/A'}</div>
                <div class="metric">UI FPS: ${report.summary.progressiveUI ? report.summary.progressiveUI.avgFPS.toFixed(1) : 'N/A'}</div>
            </div>
            
            <div class="section">
                <h2>📦 Chunking Stratejileri</h2>
                <table>
                    <tr><th>Chunk Boyutu</th><th>Süre (ms)</th><th>Chunk Sayısı</th><th>Kayıt/saniye</th></tr>
                    ${report.summary.chunkingStrategies.map(strategy => `
                        <tr>
                            <td>${strategy.chunkSize.toLocaleString()}</td>
                            <td>${strategy.duration.toFixed(2)}</td>
                            <td>${strategy.chunkCount}</td>
                            <td>${strategy.recordsPerSecond.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <div class="section">
                <h2>💾 Memory Kullanımı</h2>
                ${report.summary.memoryUsage ? `
                    <div class="metric">Peak: ${(report.summary.memoryUsage.peakMemory / 1024 / 1024).toFixed(2)} MB</div>
                    <div class="metric">Artış: ${(report.summary.memoryUsage.memoryIncrease / 1024 / 1024).toFixed(2)} MB</div>
                    <div class="metric ${report.summary.memoryUsage.memoryLeak > 0 ? 'warning' : 'success'}">
                        Memory Leak: ${(report.summary.memoryUsage.memoryLeak / 1024 / 1024).toFixed(2)} MB
                    </div>
                ` : '<p>Memory verisi mevcut değil</p>'}
            </div>
        </body>
        </html>
        `;
        
        // HTML raporunu yeni sekmede aç
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    /**
     * Test ortamını temizle
     */
    cleanupTestEnvironment() {
        // Memory monitoring'i durdur
        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
        }
        
        // Test verisini temizle
        delete window.testData;
        delete window.testDataString;
        
        // UI element'lerini temizle
        const testContainer = document.getElementById('performanceTestContainer');
        if (testContainer) {
            document.body.removeChild(testContainer);
        }
        
        safeConsole.log('🧹 Test ortamı temizlendi');
    }
}

// Global erişim için
window.PerformanceTest = PerformanceTest;

// Testi başlatma fonksiyonu
window.runPerformanceTest = async () => {
    const test = new PerformanceTest();
    await test.runFullTest();
};

// Console'da kolay erişim için
safeConsole.log('🧪 Performans testi hazır! Çalıştırmak için: runPerformanceTest()');