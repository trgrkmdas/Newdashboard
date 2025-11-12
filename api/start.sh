#!/bin/bash

# AI Proxy Backend Başlatma Scripti

echo "🤖 AI Proxy Backend başlatılıyor..."

# .env dosyası kontrolü
if [ ! -f .env ]; then
    echo "⚠️  .env dosyası bulunamadı."
    echo "📝 Lütfen .env dosyası oluşturun ve OPENAI_API_KEY değerini ekleyin:"
    echo "   OPENAI_API_KEY=your-api-key-here"
    exit 1
fi

# Node modules kontrolü
if [ ! -d "node_modules" ]; then
    echo "📦 Bağımlılıklar yükleniyor..."
    npm install
fi

# Backend'i başlat
echo "🚀 Backend başlatılıyor (Port: 3001)..."
node ai-proxy.js

