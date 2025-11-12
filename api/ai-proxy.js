/**
 * OpenAI GPT-4o Mini API Proxy
 * Backend'de API key'i güvenli şekilde saklar ve frontend'den gelen istekleri proxy eder
 * 
 * Kurulum:
 * 1. npm install express cors
 * 2. node api/ai-proxy.js
 * 
 * Veya bir backend framework'ünde (Express, FastAPI, vb.) endpoint olarak ekleyin
 */

const express = require('express');
const cors = require('cors');
// Node.js 18+ built-in fetch kullanıyor, node-fetch gerekmez

const app = express();
const PORT = 3001; // Backend portu

// Middleware
app.use(cors());
app.use(express.json());

// Environment variable yükleme (dotenv kullanılabilir)
require('dotenv').config();

// API Key - Environment variable'dan alın (güvenlik için)
// ⚠️ API key'i .env dosyasında saklayın, kodda hardcode etmeyin!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// API Key kontrolü
if (!OPENAI_API_KEY || OPENAI_API_KEY === '') {
    console.error('❌ OPENAI_API_KEY tanımlanmamış! Lütfen .env dosyasına veya environment variable olarak ekleyin.');
    process.exit(1);
}

// AI Query Endpoint
app.post('/api/ai/query', async (req, res) => {
    try {
        const { query, context, model = 'gpt-4o-mini' } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // OpenAI API çağrısı
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'Sen bir VERİ BİLİMCİSİ ve SATIŞ ANALİZ UZMANISIN. Kullanıcının satış verileri hakkındaki sorularına DETAYLI, CANLI ve DİNAMİK şekilde yanıt ver. Tüm verileri analiz et, gerçek zamanlı hesaplamalar yap, karşılaştırmalar yap, trend analizleri yap. Türkçe yanıtla. Sayısal verileri formatlı göster (örn: $1.234,56).'
                    },
                    {
                        role: 'user',
                        content: context || query
                    }
                ],
                temperature: 0.7,
                max_tokens: 4000  // 500'den 4000'e çıkarıldı - daha detaylı yanıtlar için
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content || 'Yanıt alınamadı.';

        res.json({ response: aiResponse });

    } catch (error) {
        console.error('AI Proxy Error:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Health check endpoint
app.get('/api/ai/health', (req, res) => {
    res.json({ status: 'ok', service: 'AI Proxy' });
});

app.listen(PORT, () => {
    console.log(`🤖 AI Proxy Server running on http://localhost:${PORT}`);
    console.log(`📝 Endpoint: http://localhost:${PORT}/api/ai/query`);
});

