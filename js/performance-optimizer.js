/**
 * 🚀 PERFORMANCE OPTIMIZER
 * Zuhal Müzik Dashboard - Performans İyileştirme Modülü
 * 
 * ÖZELLİKLER:
 * 1. Global Loading Spinner
 * 2. Debouncing (Arama gecikme)
 * 3. Memoization (Hesaplama önbellek)
 * 4. IndexedDB Cache (Veri önbellek)
 * 5. Performance Monitoring
 */

// ============================================
// 1. GLOBAL LOADING SPINNER YÖNETİMİ
// ============================================
const LoadingManager = {
    spinner: null,
    loadingText: null,
    progressBar: null,
    progressPercent: null,
    activeOperations: 0,
    currentProgress: 0,
    
    init() {
        // Önce globalLoadingSpinner'ı kontrol et (yeni sistem)
        this.spinner = document.getElementById('globalLoadingSpinner');
        this.loadingText = document.getElementById('globalLoadingText');
        this.progressBar = document.getElementById('globalProgressBar');
        this.progressPercent = document.getElementById('globalProgressPercent');
        
        // Eğer yoksa, eski sistem spinner'ını kontrol et (geriye uyumluluk)
        if (!this.spinner) {
            this.spinner = document.getElementById('channelLoadingSpinner');
            this.loadingText = document.getElementById('channelLoadingText');
        }
        
        // Eğer hala yoksa, yeni spinner oluştur
        if (!this.spinner) {
            this.createSpinner();
        }
    },
    
    createSpinner() {
        const spinnerHTML = `
            <div id="globalLoadingSpinner" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; justify-content: center; align-items: center;">
                <div style="text-align: center; max-width: 400px; padding: 30px;">
                    <div style="width: 80px; height: 80px; border: 8px solid rgba(255,255,255,0.2); border-top: 8px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <div style="color: white; font-size: 1.3em; font-weight: bold; margin-bottom: 15px;" id="globalLoadingText">🔄 Yükleniyor...</div>
                    <!-- Progress Bar -->
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; margin-bottom: 10px;">
                        <div id="globalProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s ease; border-radius: 4px;"></div>
                    </div>
                    <div style="color: rgba(255,255,255,0.9); font-size: 0.95em; font-weight: 500;" id="globalProgressPercent">0%</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.9em; margin-top: 10px;" id="globalLoadingSubtext">Lütfen bekleyin</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', spinnerHTML);
        this.spinner = document.getElementById('globalLoadingSpinner');
        this.loadingText = document.getElementById('globalLoadingText');
        this.progressBar = document.getElementById('globalProgressBar');
        this.progressPercent = document.getElementById('globalProgressPercent');
    },
    
    show(message = '🔄 Yükleniyor...', subtext = 'Lütfen bekleyin') {
        // Eğer spinner yoksa, önce init et
        if (!this.spinner) {
            this.init();
        }
        
        this.activeOperations++;
        if (this.spinner) {
            this.spinner.style.display = 'flex';
            if (this.loadingText) {
                this.loadingText.textContent = message;
            }
            const subtextEl = document.getElementById('globalLoadingSubtext');
            if (subtextEl) {
                subtextEl.textContent = subtext;
            }
            this.setProgress(0);
        }
    },
    
    setProgress(percent, message = null) {
        // Eğer spinner yoksa, önce init et
        if (!this.spinner) {
            this.init();
        }
        
        this.currentProgress = Math.max(0, Math.min(100, percent));
        if (this.progressBar) {
            this.progressBar.style.width = this.currentProgress + '%';
        }
        if (this.progressPercent) {
            this.progressPercent.textContent = Math.round(this.currentProgress) + '%';
        }
        if (message && this.loadingText) {
            this.loadingText.textContent = message;
        }
    },
    
    updateProgress(percent, message = null, subtext = null) {
        // Eğer spinner yoksa, önce init et
        if (!this.spinner) {
            this.init();
        }
        
        this.setProgress(percent, message);
        if (subtext) {
            const subtextEl = document.getElementById('globalLoadingSubtext');
            if (subtextEl) {
                subtextEl.textContent = subtext;
            }
        }
    },
    
    hide() {
        this.activeOperations = Math.max(0, this.activeOperations - 1);
        if (this.activeOperations === 0 && this.spinner) {
            // Progress'i 100% yap (tamamlandı gösterimi için)
            this.setProgress(100);
            // Kısa bir süre sonra gizle (kullanıcı görebilsin)
            setTimeout(() => {
                if (this.activeOperations === 0 && this.spinner) {
                    this.spinner.style.display = 'none';
                    // Progress'i sıfırla
                    this.setProgress(0);
                    // Text'leri de temizle
                    if (this.loadingText) {
                        this.loadingText.textContent = '🔄 Yükleniyor...';
                    }
                    const subtextEl = document.getElementById('globalLoadingSubtext');
                    if (subtextEl) {
                        subtextEl.textContent = 'Lütfen bekleyin';
                    }
                }
            }, 500); // 300ms → 500ms (kullanıcı görebilsin)
        }
    }
};

// ============================================
// 2. DEBOUNCING - Arama Optimizasyonu
// ============================================
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// 3. MEMOIZATION - Hesaplama Önbelleği
// ============================================
const MemoCache = {
    cache: new Map(),
    maxSize: 100, // Maximum 100 kayıt
    
    get(key) {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < 300000) { // 5 dakika geçerli
            return item.value;
        }
        return null;
    },
    
    set(key, value) {
        // Cache boyutu kontrolü
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    },
    
    clear() {
        this.cache.clear();
    },
    
    // Fonksiyon memoization wrapper
    memoize(fn, keyGenerator) {
        return (...args) => {
            const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
            const cached = this.get(key);
            if (cached !== null) {
                console.log(`📦 Cache hit: ${key}`);
                return cached;
            }
            
            const result = fn(...args);
            this.set(key, result);
            return result;
        };
    }
};

// ============================================
// 4. DATA CACHE - IndexedDB Cache kullanılıyor
// ============================================
// IndexedDB cache sistemi assets/js/core/indexeddb-cache.js'de yönetiliyor.
// Bu stub kaldırıldı, IndexedDB cache doğrudan kullanılıyor.
// Browser cache (CDN) ve localStorage da kullanılıyor.
const DataCache = {
    init() {
        // IndexedDB cache assets/js/core/indexeddb-cache.js'de yönetiliyor
        // Bu stub sadece geriye uyumluluk için korunuyor
        console.log('📦 DataCache init (IndexedDB cache assets/js/core/indexeddb-cache.js\'de yönetiliyor)');
    },
    get() { 
        // IndexedDB cache doğrudan kullanılıyor, bu stub kullanılmıyor
        return null; 
    },
    set() { 
        // IndexedDB cache doğrudan kullanılıyor, bu stub kullanılmıyor
        return; 
    },
    clear() { 
        // IndexedDB cache doğrudan kullanılıyor, bu stub kullanılmıyor
        return; 
    }
};

// ============================================
// 5. PERFORMANCE MONITORING
// ============================================
const PerformanceMonitor = {
    metrics: {},
    
    start(label) {
        this.metrics[label] = performance.now();
    },
    
    end(label) {
        if (this.metrics[label]) {
            const duration = performance.now() - this.metrics[label];
            console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
            delete this.metrics[label];
            return duration;
        }
        return 0;
    },
    
    measure(label, fn) {
        this.start(label);
        const result = fn();
        this.end(label);
        return result;
    },
    
    async measureAsync(label, fn) {
        this.start(label);
        const result = await fn();
        this.end(label);
        return result;
    }
};

// ============================================
// 6. CHUNK PROCESSING - Büyük Veri İşleme
// ============================================
async function processInChunks(array, processor, chunkSize = 1000) {
    const results = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        const chunkResults = await new Promise(resolve => {
            setTimeout(() => {
                resolve(chunk.map(processor));
            }, 0);
        });
        results.push(...chunkResults);
        
        // Progress update
        const progress = Math.round((i + chunk.length) / array.length * 100);
        console.log(`📊 İşleniyor: %${progress}`);
    }
    return results;
}

// ============================================
// INITIALIZATION
// ============================================
(function() {
    console.log('🚀 Performance Optimizer yüklendi');
    
    // DOM hazır olduğunda başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            LoadingManager.init();
            DataCache.init();
        });
    } else {
        LoadingManager.init();
        DataCache.init();
    }
    
    // Global erişim için
    window.PerformanceOptimizer = {
        LoadingManager,
        debounce,
        MemoCache,
        DataCache,
        PerformanceMonitor,
        processInChunks
    };
    
    console.log('✅ Performance Optimizer hazır');
})();

// ============================================
// EXPORT (Mevcut kodla uyumlu)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LoadingManager,
        debounce,
        MemoCache,
        DataCache,
        PerformanceMonitor,
        processInChunks
    };
}

