"""
使用者管理 API 測試案例
測試 /api/users 相關端點的各種情境
"""
import pytest
import json
from app import User, db
from werkzeug.security import generate_password_hash


class TestUsersAPI:
    """測試使用者管理 API 的各種情境"""
    
    def test_get_users_success(self, client, auth_headers, test_user):
        """測試管理者成功取得使用者列表"""
        response = client.get('/api/users', headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'data' in data
        assert len(data['data']) >= 1  # 至少有測試用戶
        
        # 驗證使用者資料結構
        user_data = data['data'][0]
        assert 'id' in user_data
        assert 'username' in user_data
        assert 'role' in user_data
        assert 'is_active' in user_data
        assert 'password_hash' not in user_data  # 不應返回密碼雜湊
    
    def test_get_users_without_auth(self, client):
        """測試未認證時無法取得使用者列表"""
        response = client.get('/api/users')
        
        assert response.status_code == 401
        data = response.get_json()
        assert 'message' in data
    
    def test_get_users_non_admin(self, client, test_app):
        """測試非管理者無法取得使用者列表"""
        # 創建一個非管理者用戶
        non_admin_user = User(
            username='nonadmin',
            password_hash=generate_password_hash('password'),
            role='user',
            is_active=True
        )
        db.session.add(non_admin_user)
        db.session.commit()
        
        # 登入非管理者用戶
        login_response = client.post('/api/auth/login', json={
            'username': 'nonadmin',
            'password': 'password'
        })
        
        assert login_response.status_code == 200
        token = login_response.get_json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        
        # 嘗試存取使用者列表
        response = client.get('/api/users', headers=headers)
        
        assert response.status_code == 403
        data = response.get_json()
        assert data['message'] == '權限不足，需要管理者權限'
    
    def test_create_user_success(self, client, auth_headers):
        """測試管理者成功建立新使用者"""
        new_user_data = {
            'username': 'newuser',
            'password': 'newpassword',
            'role': 'admin',
            'is_active': True
        }
        
        response = client.post('/api/users', 
                              json=new_user_data, 
                              headers=auth_headers)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert data['message'] == '使用者建立成功'
        assert 'data' in data
        
        # 驗證返回的使用者資料
        user_data = data['data']
        assert user_data['username'] == 'newuser'
        assert user_data['role'] == 'admin'
        assert user_data['is_active'] is True
        
        # 驗證使用者已存儲到資料庫
        created_user = User.query.filter_by(username='newuser').first()
        assert created_user is not None
        assert created_user.role == 'admin'
        assert created_user.is_active is True
    
    def test_create_user_duplicate_username(self, client, auth_headers, test_user):
        """測試建立重複使用者名稱的情況"""
        duplicate_user_data = {
            'username': 'testuser',  # 使用已存在的使用者名稱
            'password': 'password',
            'role': 'admin'
        }
        
        response = client.post('/api/users', 
                              json=duplicate_user_data, 
                              headers=auth_headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '使用者名稱已存在'
    
    def test_create_user_missing_data(self, client, auth_headers):
        """測試建立使用者時缺少必要資料"""
        # 缺少密碼
        incomplete_data = {
            'username': 'incompleteuser'
        }
        
        response = client.post('/api/users', 
                              json=incomplete_data, 
                              headers=auth_headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '使用者名稱和密碼為必填欄位'
    
    def test_create_user_without_auth(self, client):
        """測試未認證時無法建立使用者"""
        new_user_data = {
            'username': 'unauthorized',
            'password': 'password'
        }
        
        response = client.post('/api/users', json=new_user_data)
        
        assert response.status_code == 401
    
    def test_update_user_success(self, client, auth_headers, test_app):
        """測試管理者成功更新使用者資訊"""
        # 先建立一個要更新的使用者
        target_user = User(
            username='updatetarget',
            password_hash=generate_password_hash('password'),
            role='user',
            is_active=True
        )
        db.session.add(target_user)
        db.session.commit()
        
        update_data = {
            'role': 'admin',
            'is_active': False
        }
        
        response = client.put(f'/api/users/{target_user.id}', 
                             json=update_data, 
                             headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['message'] == '使用者資訊更新成功'
        
        # 驗證資料庫中的更新
        updated_user = db.session.get(User, target_user.id)
        assert updated_user.role == 'admin'
        assert updated_user.is_active is False
    
    def test_update_user_not_found(self, client, auth_headers):
        """測試更新不存在的使用者"""
        update_data = {'role': 'admin'}
        
        response = client.put('/api/users/99999', 
                             json=update_data, 
                             headers=auth_headers)
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '找不到指定的使用者'
    
    def test_update_self_role_prevention(self, client, auth_headers, test_user):
        """測試防止管理者修改自己的角色權限"""
        update_data = {'role': 'user'}
        
        response = client.put(f'/api/users/{test_user.id}', 
                             json=update_data, 
                             headers=auth_headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '無法修改自己的角色權限'
    
    def test_update_self_deactivation_prevention(self, client, auth_headers, test_user):
        """測試防止管理者停用自己的帳號"""
        update_data = {'is_active': False}
        
        response = client.put(f'/api/users/{test_user.id}', 
                             json=update_data, 
                             headers=auth_headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '無法停用自己的帳號'
    
    def test_update_user_without_auth(self, client):
        """測試未認證時無法更新使用者"""
        update_data = {'role': 'admin'}
        
        response = client.put('/api/users/1', json=update_data)
        
        assert response.status_code == 401
    
    def test_reset_password_success(self, client, auth_headers, test_app):
        """測試管理者成功重設使用者密碼"""
        # 先建立一個要重設密碼的使用者
        target_user = User(
            username='resetpassword',
            password_hash=generate_password_hash('oldpassword'),
            role='user',
            is_active=True
        )
        db.session.add(target_user)
        db.session.commit()
        
        reset_data = {'password': 'newpassword123'}
        
        response = client.put(f'/api/users/{target_user.id}/password', 
                             json=reset_data, 
                             headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['message'] == '密碼重設成功'
        
        # 驗證新密碼是否有效（嘗試使用新密碼登入）
        login_response = client.post('/api/auth/login', json={
            'username': 'resetpassword',
            'password': 'newpassword123'
        })
        assert login_response.status_code == 200
    
    def test_reset_password_missing_data(self, client, auth_headers, test_user):
        """測試重設密碼時缺少新密碼"""
        response = client.put(f'/api/users/{test_user.id}/password', 
                             json={}, 
                             headers=auth_headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '請求資料無效，缺少新密碼'
    
    def test_reset_password_not_found(self, client, auth_headers):
        """測試重設不存在使用者的密碼"""
        reset_data = {'password': 'newpassword'}
        
        response = client.put('/api/users/99999/password', 
                             json=reset_data, 
                             headers=auth_headers)
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '找不到指定的使用者'
    
    def test_delete_user_success(self, client, auth_headers, test_app):
        """測試管理者成功刪除使用者"""
        # 先建立一個要刪除的使用者
        target_user = User(
            username='deleteme',
            password_hash=generate_password_hash('password'),
            role='user',
            is_active=True
        )
        db.session.add(target_user)
        db.session.commit()
        
        response = client.delete(f'/api/users/{target_user.id}', 
                               headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['message'] == '使用者刪除成功'
        
        # 驗證使用者已從資料庫中刪除
        deleted_user = db.session.get(User, target_user.id)
        assert deleted_user is None
    
    def test_delete_user_not_found(self, client, auth_headers):
        """測試刪除不存在的使用者"""
        response = client.delete('/api/users/99999', headers=auth_headers)
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '找不到指定的使用者'
    
    def test_delete_self_prevention(self, client, auth_headers, test_user):
        """測試防止管理者刪除自己的帳號"""
        response = client.delete(f'/api/users/{test_user.id}', 
                               headers=auth_headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['message'] == '無法刪除自己的帳號'
    
    def test_delete_user_without_auth(self, client):
        """測試未認證時無法刪除使用者"""
        response = client.delete('/api/users/1')
        
        assert response.status_code == 401


class TestUserAccountStatus:
    """測試使用者帳戶狀態相關功能"""
    
    def test_login_inactive_user(self, client, test_app):
        """測試停用使用者無法登入"""
        # 創建一個停用的使用者
        inactive_user = User(
            username='inactiveuser',
            password_hash=generate_password_hash('password'),
            role='admin',
            is_active=False
        )
        db.session.add(inactive_user)
        db.session.commit()
        
        # 嘗試登入
        response = client.post('/api/auth/login', json={
            'username': 'inactiveuser',
            'password': 'password'
        })
        
        assert response.status_code == 403
        data = response.get_json()
        assert data['message'] == '帳戶已被停用，請聯絡管理員'
    
    def test_create_user_with_default_active_status(self, client, auth_headers):
        """測試建立使用者時預設為啟用狀態"""
        new_user_data = {
            'username': 'defaultactive',
            'password': 'password',
            'role': 'admin'
            # 不指定 is_active，應該預設為 True
        }
        
        response = client.post('/api/users', 
                              json=new_user_data, 
                              headers=auth_headers)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['data']['is_active'] is True
        
        # 驗證資料庫中的狀態
        created_user = User.query.filter_by(username='defaultactive').first()
        assert created_user.is_active is True
    
    def test_create_inactive_user(self, client, auth_headers):
        """測試建立停用狀態的使用者"""
        new_user_data = {
            'username': 'inactiveuser',
            'password': 'password',
            'role': 'admin',
            'is_active': False
        }
        
        response = client.post('/api/users', 
                              json=new_user_data, 
                              headers=auth_headers)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['data']['is_active'] is False
        
        # 驗證該使用者無法登入
        login_response = client.post('/api/auth/login', json={
            'username': 'inactiveuser',
            'password': 'password'
        })
        assert login_response.status_code == 403
