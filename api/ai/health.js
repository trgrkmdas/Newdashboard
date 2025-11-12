/**
 * Vercel Serverless Function - AI Proxy Health Check
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS request için CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const hasApiKey = !!process.env.OPENAI_API_KEY;

    return res.status(200).json({ 
        status: 'ok', 
        service: 'AI Proxy',
        apiKeyConfigured: hasApiKey
    });
}

