#!/usr/bin/env python3
"""
驗證修復是否成功
"""

from app import app
from flask import url_for

def verify_fix():
    """驗證修復是否成功"""
    print("🔧 驗證 BuildError 修復...")
    
    with app.app_context():
        try:
            # 嘗試生成 create_carousel_group_legacy 的 URL
            url = url_for('create_carousel_group_legacy')
            print(f"✅ create_carousel_group_legacy URL: {url}")
            
            # 檢查其他關鍵路由
            key_routes = [
                'admin_page',
                'login_page', 
                'create_group',
                'get_groups',
                'get_settings'
            ]
            
            print("\n📋 其他關鍵路由檢查:")
            for route_name in key_routes:
                try:
                    url = url_for(route_name)
                    print(f"  ✅ {route_name}: {url}")
                except Exception as e:
                    print(f"  ❌ {route_name}: {e}")
            
            print("\n🎉 所有路由檢查完成！")
            print("💡 ��在可以嘗試訪問 admin.html 頁面了")
            
        except Exception as e:
            print(f"❌ 錯誤: {e}")
            return False
    
    return True

if __name__ == '__main__':
    verify_fix()