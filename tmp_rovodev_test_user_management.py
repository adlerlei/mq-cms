#!/usr/bin/env python3
"""
測試使用者管理功能的腳本
"""

import requests
import json

BASE_URL = "http://localhost:5003"

def test_login():
    """測試登入功能"""
    print("=== 測試登入功能 ===")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if response.status_code == 200:
        token = response.json().get('access_token')
        print("✅ 登入成功")
        return token
    else:
        print(f"❌ 登入失敗: {response.status_code} - {response.text}")
        return None

def test_get_users(token):
    """測試獲取使用者列表"""
    print("\n=== 測試獲取使用者列表 ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/api/users", headers=headers)
    if response.status_code == 200:
        users = response.json().get('data', [])
        print(f"✅ 成功獲取 {len(users)} 個使用者")
        for user in users:
            print(f"   - {user['username']} ({user['role']}) - {'啟用' if user['is_active'] else '停用'}")
        return users
    else:
        print(f"❌ 獲取使用者列表失敗: {response.status_code} - {response.text}")
        return []

def test_create_user(token):
    """測試建立新使用者"""
    print("\n=== 測試建立新使用者 ===")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    new_user_data = {
        "username": "testuser",
        "password": "test123",
        "role": "user",
        "is_active": True
    }
    
    response = requests.post(f"{BASE_URL}/api/users", headers=headers, json=new_user_data)
    if response.status_code == 201:
        user = response.json().get('data')
        print(f"✅ 成功建立使用者: {user['username']}")
        return user
    else:
        print(f"❌ 建立使用者失敗: {response.status_code} - {response.text}")
        return None

def test_update_user(token, user_id):
    """測試更新使用者"""
    print("\n=== 測試更新使用者 ===")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    update_data = {
        "role": "admin",
        "is_active": False
    }
    
    response = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=headers, json=update_data)
    if response.status_code == 200:
        user = response.json().get('data')
        print(f"✅ 成功更新使用者: {user['username']} - 角色: {user['role']}, 狀態: {'啟用' if user['is_active'] else '停用'}")
        return user
    else:
        print(f"❌ 更新使用者失敗: {response.status_code} - {response.text}")
        return None

def test_reset_password(token, user_id):
    """測試重設密碼"""
    print("\n=== 測試重設密碼 ===")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    password_data = {
        "password": "newpassword123"
    }
    
    response = requests.put(f"{BASE_URL}/api/users/{user_id}/password", headers=headers, json=password_data)
    if response.status_code == 200:
        print("✅ 成功重設密碼")
        return True
    else:
        print(f"❌ 重設密碼失敗: {response.status_code} - {response.text}")
        return False

def test_delete_user(token, user_id):
    """測試刪除使用者"""
    print("\n=== 測試刪除使用者 ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)
    if response.status_code == 200:
        print("✅ 成功刪除使用者")
        return True
    else:
        print(f"❌ 刪除使用者失敗: {response.status_code} - {response.text}")
        return False

def main():
    print("開始測試使用者管理 API...")
    
    # 1. 登入
    token = test_login()
    if not token:
        print("無法獲取認證令牌，測試終止")
        return
    
    # 2. 獲取使用者列表
    users = test_get_users(token)
    
    # 3. 建立新使用者
    new_user = test_create_user(token)
    if not new_user:
        print("無法建立測試使用者，跳過後續測試")
        return
    
    user_id = new_user['id']
    
    # 4. 更新使用者
    test_update_user(token, user_id)
    
    # 5. 重設密碼
    test_reset_password(token, user_id)
    
    # 6. 再次獲取使用者列表確認變更
    print("\n=== 確認變更後的使用者列表 ===")
    test_get_users(token)
    
    # 7. 刪除測試使用者
    test_delete_user(token, user_id)
    
    # 8. 最終確認
    print("\n=== 最終使用者列表 ===")
    test_get_users(token)
    
    print("\n🎉 使用者管理 API 測試完成！")

if __name__ == "__main__":
    main()