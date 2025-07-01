#!/usr/bin/env python3
"""
測試路由是否正確設置
"""

from app import app

def test_routes():
    """測試所有路由是否正確註冊"""
    print("🔍 檢查應用程序路由...")
    
    with app.app_context():
        # 獲取所有路由
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                'endpoint': rule.endpoint,
                'methods': list(rule.methods),
                'rule': rule.rule
            })
        
        # 檢查關鍵路由
        key_routes = [
            'create_carousel_group_legacy',
            'admin_page',
            'login_page',
            'create_group',
            'get_groups'
        ]
        
        print("\n📋 關鍵路由檢查:")
        for route_name in key_routes:
            found = any(r['endpoint'] == route_name for r in routes)
            status = "✅" if found else "❌"
            print(f"  {status} {route_name}")
        
        print(f"\n📊 總共註冊了 {len(routes)} 個路由")
        
        # 檢查是否有重複的路由
        endpoints = [r['endpoint'] for r in routes]
        duplicates = set([x for x in endpoints if endpoints.count(x) > 1])
        if duplicates:
            print(f"\n⚠️  發現重複的端點: {duplicates}")
        else:
            print("\n✅ 沒有發現重複的端點")
        
        # 顯示所有與群組相關的路由
        print("\n🔗 群組相關路由:")
        group_routes = [r for r in routes if 'group' in r['endpoint'].lower() or 'carousel' in r['endpoint'].lower()]
        for route in group_routes:
            print(f"  • {route['endpoint']}: {route['rule']} {route['methods']}")

if __name__ == '__main__':
    test_routes()