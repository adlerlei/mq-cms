# mq-cms 後端測試說明

## 測試架構

本專案使用 `pytest` 作為測試框架，針對 Flask 後端 API 進行完整的單元測試和整合測試。

## 測試結構

```
tests/
├── __init__.py          # 測試模組初始化
├── conftest.py          # pytest 配置和共用 fixtures
├── test_auth.py         # 認證 API 測試
└── README.md           # 本說明文件
```

## 安裝測試依賴

首先確保已激活虛擬環境，然後安裝依賴：

```bash
# 激活虛擬環境
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate     # Windows

# 安裝依賴
pip install -r requirements.txt
```

## 執行測試

### 方法一：使用提供的測試腳本（推薦）

```bash
python run_tests.py
```

### 方法二：直接使用 pytest

```bash
# 執行所有測試
pytest tests/ -v

# 執行特定測試文件
pytest tests/test_auth.py -v

# 執行特定測試類別
pytest tests/test_auth.py::TestAuthLogin -v

# 執行特定測試方法
pytest tests/test_auth.py::TestAuthLogin::test_successful_login -v
```

### 方法三：使用標記篩選測試

```bash
# 只執行認證相關測試
pytest -m auth -v

# 只執行單元測試
pytest -m unit -v

# 只執行整合測試
pytest -m integration -v
```

## 測試涵蓋範圍

### 🔐 認證 API (`/api/auth/login`)

- ✅ 成功登入
- ✅ 密碼錯誤
- ✅ 使用者不存在
- ✅ 缺少必要參數
- ✅ 空值處理
- ✅ JWT token 驗證
- ✅ token 過期時間檢查
- ✅ 多使用者登入
- ✅ 大小寫敏感性
- ✅ SQL 注入防護
- ✅ token 格式驗證
- ✅ 認證整合測試

## 測試配置

### Fixtures 說明

- `test_app`: 提供測試專用的 Flask 應用程式實例
- `client`: 提供測試客戶端，用於發送 HTTP 請求
- `test_user`: 創建測試用的使用者帳號
- `auth_headers`: 提供已認證的 HTTP headers
- `runner`: 提供命令行測試運行器

### 測試資料庫

測試使用記憶體內的 SQLite 資料庫（`:memory:`），確保：
- 測試執行速度快
- 測試之間完全隔離
- 不會影響開發資料庫

## 測試最佳實踐

1. **每個測試都應該獨立**：測試之間不應該有依賴關係
2. **使用描述性的測試名稱**：清楚表達測試的目的
3. **遵循 AAA 模式**：Arrange（準備）、Act（執行）、Assert（驗證）
4. **測試正常和異常情況**：包括成功路徑和錯誤處理
5. **使用適當的斷言**：確保測試準確驗證預期行為

## 增加新測試

### 創建新的測試文件

```python
# tests/test_new_feature.py
import pytest
from app import app, db

class TestNewFeature:
    def test_something(self, client, test_user):
        # 測試邏輯
        pass
```

### 常用的測試模式

```python
def test_api_success(self, client, auth_headers):
    """測試 API 成功情況"""
    response = client.post('/api/endpoint', 
                          headers=auth_headers,
                          json={'key': 'value'})
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True

def test_api_validation_error(self, client, auth_headers):
    """測試 API 驗證錯誤"""
    response = client.post('/api/endpoint',
                          headers=auth_headers,
                          json={})  # 缺少必要參數
    
    assert response.status_code == 400
    data = response.get_json()
    assert data['success'] is False
```

## 故障排除

### 常見問題

1. **ImportError**: 確保已安裝所有依賴和已激活虛擬環境
2. **Database errors**: 測試使用獨立的測試資料庫，不會影響開發資料
3. **Token errors**: 檢查 JWT 相關的測試配置

### 調試測試

```bash
# 顯示更詳細的錯誤信息
pytest tests/ -v -s --tb=long

# 只執行失敗的測試
pytest tests/ --lf

# 停止在第一個失敗的測試
pytest tests/ -x
```
