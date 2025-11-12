/**
 * Vercel Serverless Function - OpenAI GPT-4o Mini API Proxy
 * Production için Vercel'de çalışan serverless function
 * 
 * Environment Variable: OPENAI_API_KEY (Vercel dashboard'da ayarlanmalı)
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS request için CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Sadece POST isteklerini kabul et
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { query, context, model = 'gpt-4o-mini' } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // API Key - Vercel environment variable'dan al
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (!OPENAI_API_KEY) {
            console.error('❌ OPENAI_API_KEY environment variable tanımlanmamış!');
            return res.status(500).json({ 
                error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in Vercel environment variables.'
            });
        }

        const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
            console.error('OpenAI API Error:', response.status, errorData);
            return res.status(response.status).json({ 
                error: `OpenAI API error: ${response.status} ${response.statusText}`,
                details: errorData
            });
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content || 'Yanıt alınamadı.';

        return res.status(200).json({ response: aiResponse });

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error'
        });
    }
}

