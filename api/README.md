# AI Proxy Backend

OpenAI GPT-4o Mini API için proxy backend servisi.

## 🚀 Kurulum

### Development (Local)

1. Bağımlılıkları yükleyin:
```bash
cd api
npm install
```

2. `.env` dosyası oluşturun:
```bash
echo "OPENAI_API_KEY=your-api-key-here" > .env
```

3. Sunucuyu başlatın:
```bash
npm start
# veya
node ai-proxy.js
```

Sunucu `http://localhost:3001` adresinde çalışacaktır.

### Production (Vercel)

Vercel'de otomatik olarak serverless function olarak çalışır.

**ÖNEMLİ: Vercel Environment Variable Ayarlama:**

1. Vercel Dashboard'a gidin: https://vercel.com/dashboard
2. Projenizi seçin
3. **Settings** → **Environment Variables** bölümüne gidin
4. Yeni environment variable ekleyin:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** OpenAI API key'iniz (örn: `sk-proj-...`)
   - **Environment:** Production, Preview, Development (hepsini seçin)
5. **Save** butonuna tıklayın
6. Projeyi yeniden deploy edin (Vercel otomatik deploy yapabilir)

**API Endpoints:**
- Production: `https://your-domain.vercel.app/api/ai/query`
- Health Check: `https://your-domain.vercel.app/api/ai/health`

## 📁 Dosya Yapısı

```
api/
├── ai/
│   ├── query.js          # Vercel serverless function (production)
│   └── health.js         # Health check endpoint
├── ai-proxy.js           # Local development server
├── package.json
└── README.md
```

## 🔧 Özellikler

- ✅ OpenAI GPT-4o Mini API entegrasyonu
- ✅ API key güvenli şekilde backend'de saklanıyor
- ✅ CORS desteği
- ✅ Development ve Production modları
- ✅ Hata yönetimi

## 🧪 Test

### Local Test
```bash
curl -X POST http://localhost:3001/api/ai/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Bu ayın toplam satışı nedir?"}'
```

### Production Test
```bash
curl -X POST https://your-domain.vercel.app/api/ai/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Bu ayın toplam satışı nedir?"}'
```

## ⚠️ Notlar

- API key'i **asla** frontend koduna yazmayın
- Environment variable'ları Vercel dashboard'dan yönetin
- Production'da API key'in doğru ayarlandığından emin olun
