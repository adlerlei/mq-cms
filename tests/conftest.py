"""
測試配置文件 - pytest 會自動載入此文件中的 fixture
"""
import pytest
import tempfile
import os
from app import app, db, User
from werkzeug.security import generate_password_hash


@pytest.fixture
def test_app():
    """創建測試用的 Flask 應用程式"""
    # 創建臨時資料庫文件
    db_fd, db_path = tempfile.mkstemp()
    app.config['DATABASE'] = db_path
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'  # 使用內存資料庫
    app.config['SECRET_KEY'] = 'test-secret-key'
    app.config['WTF_CSRF_ENABLED'] = False  # 禁用 CSRF 保護以便測試
    
    with app.app_context():
        # 清除並重新創建所有表
        db.drop_all()
        db.create_all()
        yield app
        # 測試結束後清理
        db.session.rollback()
        db.drop_all()
        
    # 清理
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(test_app):
    """創建測試客戶端"""
    return test_app.test_client()


@pytest.fixture
def test_user(test_app):
    """創建測試用戶"""
    # 檢查使用者是否已存在，如果存在則先刪除
    existing_user = User.query.filter_by(username='testuser').first()
    if existing_user:
        db.session.delete(existing_user)
        db.session.commit()
    
    user = User(
        username='testuser',
        password_hash=generate_password_hash('testpassword'),
        role='admin',
        is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def auth_headers(client, test_user):
    """創建認證後的 headers"""
    # 模擬登入獲取 token
    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'testpassword'
    })
    
    if response.status_code == 200:
        token = response.get_json()['access_token']
        return {'Authorization': f'Bearer {token}'}
    else:
        pytest.fail("Failed to get authentication token for test")


@pytest.fixture
def runner(test_app):
    """創建命令行測試運行器"""
    return test_app.test_cli_runner()
