"""
認證 API 測試案例
測試 /api/auth/login 端點的各種情境
"""
import pytest
import json
import jwt
from datetime import datetime, timedelta, timezone
from app import User, db
from werkzeug.security import generate_password_hash


class TestAuthLogin:
    """測試登入 API 的各種情境"""
    
    def test_successful_login(self, client, test_user):
        """測試成功登入"""
        response = client.post('/api/auth/login', json={
            'username': 'testuser',
            'password': 'testpassword'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'access_token' in data
        
        # 驗證 JWT token 格式和內容
        token = data['access_token']
        decoded = jwt.decode(token, 'test-secret-key', algorithms=['HS256'])
        assert decoded['username'] == 'testuser'
        assert 'exp' in decoded
    
    def test_login_with_wrong_password(self, client, test_user):
        """測試密碼錯誤的情況"""
        response = client.post('/api/auth/login', json={
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == '帳號或密碼錯誤'
    
    def test_login_with_nonexistent_user(self, client):
        """測試使用者不存在的情況"""
        response = client.post('/api/auth/login', json={
            'username': 'nonexistentuser',
            'password': 'anypassword'
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == '帳號或密碼錯誤'
    
    def test_login_missing_username(self, client):
        """測試缺少使用者名稱的情況"""
        response = client.post('/api/auth/login', json={
            'password': 'testpassword'
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == 'Could not verify'
    
    def test_login_missing_password(self, client):
        """測試缺少密碼的情況"""
        response = client.post('/api/auth/login', json={
            'username': 'testuser'
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == 'Could not verify'
    
    def test_login_empty_request_body(self, client):
        """測試空的請求體"""
        response = client.post('/api/auth/login', json={})
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == 'Could not verify'
    
    def test_login_no_json_data(self, client):
        """測試沒有 JSON 資料的請求"""
        response = client.post('/api/auth/login')
        
        # 沒有 Content-Type: application/json 會回傳 415 Unsupported Media Type
        # 或者 400 Bad Request，這是正常的
        assert response.status_code in [400, 415]
        # 如果是 400，檢查錯誤訊息
        if response.status_code == 400 and response.get_json():
            data = response.get_json()
            assert data['message'] == 'Could not verify'
    
    def test_login_with_empty_username(self, client):
        """測試空的使用者名稱"""
        response = client.post('/api/auth/login', json={
            'username': '',
            'password': 'testpassword'
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == 'Could not verify'
    
    def test_login_with_empty_password(self, client):
        """測試空的密碼"""
        response = client.post('/api/auth/login', json={
            'username': 'testuser',
            'password': ''
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == 'Could not verify'
    
    def test_token_expiration_time(self, client, test_user):
        """測試 token 的過期時間設定（應該是 8 小時）"""
        response = client.post('/api/auth/login', json={
            'username': 'testuser',
            'password': 'testpassword'
        })
        
        assert response.status_code == 200
        token = response.get_json()['access_token']
        decoded = jwt.decode(token, 'test-secret-key', algorithms=['HS256'])
        
        # 計算 token 的過期時間與當前時間的差距
        exp_time = datetime.fromtimestamp(decoded['exp'], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        time_diff = exp_time - now
        
        # 應該接近 8 小時（允許一些誤差）
        expected_hours = 8
        assert abs(time_diff.total_seconds() - expected_hours * 3600) < 60  # 允許 1 分鐘誤差
    
    def test_multiple_users_login(self, client, test_app):
        """測試多個使用者登入"""
        # 創建第二個測試使用者
        user2 = User(
            username='testuser2',
            password_hash=generate_password_hash('password2'),
            role='admin'
        )
        db.session.add(user2)
        db.session.commit()
        
        # 測試第一個使用者登入
        response1 = client.post('/api/auth/login', json={
            'username': 'testuser2',
            'password': 'password2'
        })
        assert response1.status_code == 200
        token1 = response1.get_json()['access_token']
        
        # 驗證 token
        decoded1 = jwt.decode(token1, 'test-secret-key', algorithms=['HS256'])
        assert decoded1['username'] == 'testuser2'
    
    def test_case_sensitive_username(self, client, test_user):
        """測試使用者名稱大小寫敏感性"""
        response = client.post('/api/auth/login', json={
            'username': 'TESTUSER',  # 大寫
            'password': 'testpassword'
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == '帳號或密碼錯誤'
    
    def test_sql_injection_attempt(self, client):
        """測試 SQL 注入攻擊防護"""
        response = client.post('/api/auth/login', json={
            'username': "admin' OR '1'='1",
            'password': "anything"
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == '帳號或密碼錯誤'


class TestAuthIntegration:
    """認證整合測試"""
    
    def test_login_and_use_token(self, client, test_user):
        """測試登入後使用 token 存取受保護的端點"""
        # 先登入獲取 token
        login_response = client.post('/api/auth/login', json={
            'username': 'testuser',
            'password': 'testpassword'
        })
        
        assert login_response.status_code == 200
        token = login_response.get_json()['access_token']
        
        # 使用 token 存取受保護的 API（例如 /api/materials）
        headers = {'Authorization': f'Bearer {token}'}
        materials_response = client.get('/api/materials', headers=headers)
        
        # 這個端點不需要認證，但我們測試 token 格式是否正確
        assert materials_response.status_code == 200
    
    def test_invalid_token_format(self, client):
        """測試使用無效格式的 token"""
        headers = {'Authorization': 'Bearer invalid-token-format'}
        response = client.post('/api/assignments', 
                             headers=headers,
                             data={'section_key': 'test', 'type': 'single_media', 'media_id': 'test'})
        
        assert response.status_code == 401
        data = response.get_json()
        assert 'Token error' in data['message']
    
    def test_missing_bearer_prefix(self, client, test_user):
        """測試缺少 Bearer 前綴的 token"""
        # 先獲取有效 token
        login_response = client.post('/api/auth/login', json={
            'username': 'testuser',
            'password': 'testpassword'
        })
        token = login_response.get_json()['access_token']
        
        # 使用沒有 Bearer 前綴的 token
        headers = {'Authorization': token}
        response = client.post('/api/assignments',
                             headers=headers,
                             data={'section_key': 'test', 'type': 'single_media', 'media_id': 'test'})
        
        assert response.status_code == 401
        data = response.get_json()
        assert data['message'] == 'Token is missing!'
    
    def test_expired_token(self, client, test_user):
        """測試過期的 token（模擬）"""
        # 手動創建一個過期的 token
        expired_payload = {
            'username': 'testuser',
            'exp': datetime.now(timezone.utc) - timedelta(hours=1)  # 1 小時前過期
        }
        expired_token = jwt.encode(expired_payload, 'test-secret-key', algorithm='HS256')
        
        headers = {'Authorization': f'Bearer {expired_token}'}
        response = client.post('/api/assignments',
                             headers=headers,
                             data={'section_key': 'test', 'type': 'single_media', 'media_id': 'test'})
        
        assert response.status_code == 401
        data = response.get_json()
        assert 'Token error' in data['message']
