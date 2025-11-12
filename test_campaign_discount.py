#!/usr/bin/env python3
"""
Local Test Script: Kampanya İndirim Hesaplama Testi

Bu script, kampanya indirim hesaplama mantığını test eder.
Gerçek Odoo bağlantısı olmadan, mock verilerle çalışır.
"""

import os

# Not: .env dosyası kullanılmıyor, direkt environment variables kullanılabilir

def convert_to_usd_hybrid(amount_tl, currency_code, currency_rate=None, 
                          usd_rate_map=None, invoice_currency_rate_map=None, 
                          move_id=None, line_id=None):
    """
    Hibrit USD çevirme mantığı (workflow'daki gibi)
    """
    if 'USD' in currency_code.upper():
        return amount_tl  # Zaten USD
    
    # Satır bazında kur varsa kullan
    if line_id and usd_rate_map and line_id in usd_rate_map:
        return amount_tl / usd_rate_map[line_id]
    
    # Fatura kuru varsa kullan
    if move_id and invoice_currency_rate_map and move_id in invoice_currency_rate_map:
        return amount_tl / invoice_currency_rate_map[move_id]
    
    # Son çare: ortalama kur
    return amount_tl / 35.0


def calculate_discount(move_id, product_id, price_unit, discount_field,
                      list_price_tl, currency_code, currency_rate,
                      invoice_pricelist_map, pricelist_item_map,
                      usd_rate_map=None, invoice_currency_rate_map=None):
    """
    Kampanya indirim hesaplama fonksiyonu
    
    Returns:
        dict: {
            'has_campaign': bool,
            'campaign_discount_pct': float,
            'extra_discount_pct': float,
            'actual_discount_pct': float,
            'campaign_lost': bool,
            'list_price_usd': float,
            'campaign_price_usd': float or None,
            'price_unit_usd': float
        }
    """
    
    # 1. Pricelist bilgisini al
    pricelist_id = invoice_pricelist_map.get(move_id, None)
    
    # 2. Kampanya bilgisini al
    campaign_price_tl = None
    campaign_discount_pct = 0
    has_campaign = False
    
    if pricelist_id:
        campaign_data = pricelist_item_map.get((product_id, pricelist_id), None)
        if campaign_data:
            campaign_price_tl, campaign_discount_pct = campaign_data
            has_campaign = True
    
    # 3. Fiyatları USD'ye çevir
    list_price_usd = convert_to_usd_hybrid(
        list_price_tl, currency_code, currency_rate,
        usd_rate_map, invoice_currency_rate_map, move_id
    )
    
    campaign_price_usd = None
    if has_campaign:
        campaign_price_usd = convert_to_usd_hybrid(
            campaign_price_tl, currency_code, currency_rate,
            usd_rate_map, invoice_currency_rate_map, move_id
        )
    
    price_unit_usd = convert_to_usd_hybrid(
        price_unit, currency_code, currency_rate,
        usd_rate_map, invoice_currency_rate_map, move_id
    )
    
    # 4. İndirim hesaplama
    extra_discount_pct = 0
    actual_discount_pct = 0
    campaign_lost = False
    
    if has_campaign:
        # Kampanya VAR
        if abs(price_unit_usd - campaign_price_usd) < 0.01:  # Yaklaşık eşit
            # Senaryo: Kampanyalı fiyattan satıldı
            extra_discount_pct = 0
            actual_discount_pct = 0  # ✅ SAYFADA %0 GÖRÜNECEK
        elif price_unit_usd < campaign_price_usd:
            # Senaryo: Kampanyanın üstüne ek indirim
            extra_discount_pct = (campaign_price_usd - price_unit_usd) / campaign_price_usd * 100
            actual_discount_pct = (list_price_usd - price_unit_usd) / list_price_usd * 100
        else:
            # Senaryo: Kampanya uygulanmamış (kayıp)
            campaign_lost = True
            actual_discount_pct = (list_price_usd - price_unit_usd) / list_price_usd * 100
    else:
        # Kampanya YOK
        if list_price_usd > 0:
            actual_discount_pct = (list_price_usd - price_unit_usd) / list_price_usd * 100
        else:
            actual_discount_pct = discount_field  # Odoo'dan gelen değer
    
    return {
        'has_campaign': has_campaign,
        'campaign_discount_pct': campaign_discount_pct,
        'extra_discount_pct': extra_discount_pct,
        'actual_discount_pct': actual_discount_pct,  # ✅ SAYFADA BU GÖRÜNECEK
        'campaign_lost': campaign_lost,
        'list_price_usd': list_price_usd,
        'campaign_price_usd': campaign_price_usd,
        'price_unit_usd': price_unit_usd
    }


def test_scenario_1():
    """Senaryo 1: Kampanyalı fiyattan satış (Gerçek indirim: %0)"""
    print("\n" + "=" * 60)
    print("🧪 SENARYO 1: Kampanyalı Fiyattan Satış")
    print("=" * 60)
    
    # Mock veriler
    move_id = 789
    product_id = 12345
    price_unit = 12750.0  # TL
    discount_field = 15.0  # Odoo'nun gösterdiği
    list_price_tl = 15000.0
    currency_code = "TL"
    currency_rate = 35.0
    
    invoice_pricelist_map = {789: 10}  # Fatura 789, Pricelist 10
    pricelist_item_map = {
        (12345, 10): (12750.0, 15.0)  # Ürün 12345, Pricelist 10 → Fiyat: 12,750 TL, İndirim: %15
    }
    
    result = calculate_discount(
        move_id, product_id, price_unit, discount_field,
        list_price_tl, currency_code, currency_rate,
        invoice_pricelist_map, pricelist_item_map
    )
    
    print(f"📊 Sonuçlar:")
    print(f"   Normal Fiyat: ${result['list_price_usd']:.2f} ({list_price_tl:,.0f} TL)")
    print(f"   Kampanya Fiyatı: ${result['campaign_price_usd']:.2f} ({12750:,.0f} TL)")
    print(f"   Satış Fiyatı: ${result['price_unit_usd']:.2f} ({price_unit:,.0f} TL)")
    print(f"   🎟️ Kampanya İndirimi: %{result['campaign_discount_pct']:.2f}")
    print(f"   ➕ Ek İndirim: %{result['extra_discount_pct']:.2f}")
    print(f"   ✅ Gerçek İndirim: %{result['actual_discount_pct']:.2f}")
    
    assert result['actual_discount_pct'] == 0, "❌ HATA: Gerçek indirim %0 olmalı!"
    print("   ✅ TEST BAŞARILI: Gerçek indirim %0!")


def test_scenario_2():
    """Senaryo 2: Kampanyanın üstüne ek indirim"""
    print("\n" + "=" * 60)
    print("🧪 SENARYO 2: Kampanyanın Üstüne Ek İndirim")
    print("=" * 60)
    
    # Mock veriler
    move_id = 789
    product_id = 12345
    price_unit = 12000.0  # TL (kampanya fiyatından daha düşük)
    discount_field = 20.0
    list_price_tl = 15000.0
    currency_code = "TL"
    currency_rate = 35.0
    
    invoice_pricelist_map = {789: 10}
    pricelist_item_map = {
        (12345, 10): (12750.0, 15.0)
    }
    
    result = calculate_discount(
        move_id, product_id, price_unit, discount_field,
        list_price_tl, currency_code, currency_rate,
        invoice_pricelist_map, pricelist_item_map
    )
    
    print(f"📊 Sonuçlar:")
    print(f"   Normal Fiyat: ${result['list_price_usd']:.2f} ({list_price_tl:,.0f} TL)")
    print(f"   Kampanya Fiyatı: ${result['campaign_price_usd']:.2f} ({12750:,.0f} TL)")
    print(f"   Satış Fiyatı: ${result['price_unit_usd']:.2f} ({price_unit:,.0f} TL)")
    print(f"   🎟️ Kampanya İndirimi: %{result['campaign_discount_pct']:.2f}")
    print(f"   ➕ Ek İndirim: %{result['extra_discount_pct']:.2f}")
    print(f"   📊 Toplam İndirim: %{result['actual_discount_pct']:.2f}")
    
    assert result['extra_discount_pct'] > 0, "❌ HATA: Ek indirim > 0 olmalı!"
    assert abs(result['actual_discount_pct'] - 20.0) < 0.01, f"❌ HATA: Toplam indirim %20 olmalı! Gerçek: {result['actual_discount_pct']:.2f}%"
    print("   ✅ TEST BAŞARILI!")


def test_scenario_3():
    """Senaryo 3: Kampanya yok"""
    print("\n" + "=" * 60)
    print("🧪 SENARYO 3: Kampanya Yok")
    print("=" * 60)
    
    # Mock veriler
    move_id = 790
    product_id = 12345
    price_unit = 13500.0  # TL (%10 indirim)
    discount_field = 10.0
    list_price_tl = 15000.0
    currency_code = "TL"
    currency_rate = 35.0
    
    invoice_pricelist_map = {790: None}  # Pricelist yok
    pricelist_item_map = {}  # Kampanya yok
    
    result = calculate_discount(
        move_id, product_id, price_unit, discount_field,
        list_price_tl, currency_code, currency_rate,
        invoice_pricelist_map, pricelist_item_map
    )
    
    print(f"📊 Sonuçlar:")
    print(f"   Normal Fiyat: ${result['list_price_usd']:.2f} ({list_price_tl:,.0f} TL)")
    campaign_price_str = 'Yok' if not result['campaign_price_usd'] else f"${result['campaign_price_usd']:.2f}"
    print(f"   Kampanya Fiyatı: {campaign_price_str}")
    print(f"   Satış Fiyatı: ${result['price_unit_usd']:.2f} ({price_unit:,.0f} TL)")
    print(f"   🎟️ Kampanya İndirimi: %{result['campaign_discount_pct']:.2f}")
    print(f"   ➕ Ek İndirim: %{result['actual_discount_pct']:.2f}")
    
    assert result['has_campaign'] == False, "❌ HATA: Kampanya olmamalı!"
    assert abs(result['actual_discount_pct'] - 10.0) < 0.01, f"❌ HATA: İndirim %10 olmalı! Gerçek: {result['actual_discount_pct']:.2f}%"
    print("   ✅ TEST BAŞARILI!")


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 KAMPANYA İNDİRİM HESAPLAMA TEST SCRIPT")
    print("=" * 60)
    
    try:
        test_scenario_1()
        test_scenario_2()
        test_scenario_3()
        
        print("\n" + "=" * 60)
        print("✅ TÜM TESTLER BAŞARILI!")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n❌ TEST HATASI: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ BEKLENMEYEN HATA: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

