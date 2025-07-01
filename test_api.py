#!/usr/bin/env python3
"""
簡單的API測試腳本
用於驗證新的RESTful API端點是否正常工作
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def test_api_endpoints():
    """測試主要的API端點"""
    
    print("🧪 開始測試 RESTful API 端點...")
    
    # 測試公開端點
    print("\n📋 測試公開端點:")
    
    # 測試獲取設定
    try:
        response = requests.get(f"{BASE_URL}/api/settings")
        print(f"GET /api/settings: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ 成功獲取設定: {data.get('success', False)}")
        else:
            print(f"  ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"  ❌ 連接錯誤: {e}")
    
    # 測試獲取素材
    try:
        response = requests.get(f"{BASE_URL}/api/materials")
        print(f"GET /api/materials: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ 成功獲取素材列表: {len(data.get('data', []))} 個素材")
        else:
            print(f"  ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"  ❌ 連接錯誤: {e}")
    
    # 測試獲取群組
    try:
        response = requests.get(f"{BASE_URL}/api/groups")
        print(f"GET /api/groups: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ 成功獲取群組列表: {len(data.get('data', []))} 個群組")
        else:
            print(f"  ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"  ❌ 連接錯誤: {e}")
    
    # 測試獲取指派
    try:
        response = requests.get(f"{BASE_URL}/api/assignments")
        print(f"GET /api/assignments: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ 成功獲取指派列表: {len(data.get('data', []))} 個指派")
        else:
            print(f"  ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"  ❌ 連接錯誤: {e}")
    
    # 測試獲取媒體和設定（舊端點）
    try:
        response = requests.get(f"{BASE_URL}/api/media_with_settings")
        print(f"GET /api/media_with_settings: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ 成功獲取媒體和設定")
        else:
            print(f"  ❌ 失敗: {response.text}")
    except Exception as e:
        print(f"  ❌ 連接錯誤: {e}")
    
    print("\n🔐 需要認證的端點需要有效的JWT Token才能測試")
    print("   可以通過 POST /api/auth/login 獲取Token")
    
    print("\n✨ API測試完成！")
    print("📖 完整的API文檔請參考 API_DOCUMENTATION.md")

if __name__ == "__main__":
    test_api_endpoints()