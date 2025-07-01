# MQ CMS RESTful API 文檔

## 概述

本文檔描述了 MQ 直立式廣告機內容管理系統的 RESTful API 端點。所有需要認證的端點都需要在請求標頭中包含 JWT Token。

## 認證

```
Authorization: Bearer <your-jwt-token>
```

## API 端點

### 1. 認證 API

#### 登入
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### 2. 設定 API

#### 獲取所有設定
```
GET /api/settings

Response:
{
  "success": true,
  "data": {
    "header_interval": "5",
    "carousel_interval": "6",
    "footer_interval": "7"
  }
}
```

#### 更新設定
```
PUT /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "header_interval": 5,
  "carousel_interval": 6,
  "footer_interval": 7
}

Response:
{
  "success": true,
  "message": "設定已成功儲存！"
}
```

### 3. 媒體素材 API

#### 獲取所有素材
```
GET /api/materials

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "original_filename": "image.jpg",
      "filename": "uuid.jpg",
      "type": "image",
      "url": "/static/uploads/uuid.jpg",
      "source": "global"
    }
  ]
}
```

#### 獲取單個素材
```
GET /api/materials/{material_id}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "original_filename": "image.jpg",
    "filename": "uuid.jpg",
    "type": "image",
    "url": "/static/uploads/uuid.jpg",
    "source": "global",
    "assignments": [...],
    "groups": [...]
  }
}
```

#### 上傳素材
```
POST /api/materials
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
section_key: "header_video" (optional)

Response:
{
  "success": true,
  "message": "上傳成功",
  "data": {
    "id": "uuid-string",
    "original_filename": "image.jpg",
    "filename": "uuid.jpg",
    "type": "image",
    "url": "/static/uploads/uuid.jpg",
    "source": "global"
  }
}
```

#### 刪除素材
```
DELETE /api/materials/{material_id}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "刪除成功"
}
```

### 4. 輪播群組 API

#### 獲取所有群組
```
GET /api/groups

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "name": "群組名稱",
      "image_ids": ["uuid1", "uuid2"],
      "image_count": 2
    }
  ]
}
```

#### 獲取單個群組
```
GET /api/groups/{group_id}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "name": "群組名稱",
    "image_ids": ["uuid1", "uuid2"],
    "images": [
      {
        "id": "uuid1",
        "original_filename": "image1.jpg",
        "filename": "uuid1.jpg",
        "url": "/static/uploads/uuid1.jpg",
        "order": 0
      }
    ]
  }
}
```

#### 建立群組
```
POST /api/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新群組名稱"
}

Response:
{
  "success": true,
  "message": "群組建立成功",
  "data": {
    "id": "uuid-string",
    "name": "新群組名稱",
    "image_ids": [],
    "image_count": 0
  }
}
```

#### 更新群組
```
PUT /api/groups/{group_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新後的群組名稱"
}

Response:
{
  "success": true,
  "message": "群組更新成功",
  "data": {
    "id": "uuid-string",
    "name": "更新後��群組名稱",
    "image_ids": [...],
    "image_count": 2
  }
}
```

#### 刪除群組
```
DELETE /api/groups/{group_id}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "群組刪除成功"
}
```

#### 上傳圖片到群組
```
POST /api/groups/{group_id}/images
Authorization: Bearer <token>
Content-Type: multipart/form-data

files: <multiple files>

Response:
{
  "success": true,
  "message": "成功上傳 2 張圖片",
  "data": [
    {
      "id": "uuid-string",
      "original_filename": "image.jpg",
      "filename": "uuid.jpg",
      "type": "image",
      "source": "group_specific",
      "group_id": "group-uuid",
      "group_name": "群組名稱",
      "url": "/static/uploads/uuid.jpg"
    }
  ]
}
```

#### 更新群組圖片順序
```
PUT /api/groups/{group_id}/images
Authorization: Bearer <token>
Content-Type: application/json

{
  "image_ids": ["uuid1", "uuid2", "uuid3"]
}

Response:
{
  "success": true,
  "message": "圖片順序已儲存",
  "data": {
    "id": "group-uuid",
    "name": "群組名稱",
    "image_ids": ["uuid1", "uuid2", "uuid3"],
    "image_count": 3
  }
}
```

### 5. 內容指派 API

#### 獲取所有指派
```
GET /api/assignments

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "section_key": "header_video",
      "content_source_type": "single_media",
      "offset": 0,
      "media_id": "media-uuid",
      "group_id": null,
      "material": {
        "id": "media-uuid",
        "original_filename": "video.mp4",
        "type": "video",
        "url": "/static/uploads/uuid.mp4"
      }
    }
  ]
}
```

#### 獲取單個指派
```
GET /api/assignments/{assignment_id}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "section_key": "header_video",
    "content_source_type": "single_media",
    "offset": 0,
    "media_id": "media-uuid",
    "group_id": null,
    "material": {...},
    "group": null
  }
}
```

#### 建立指派
```
POST /api/assignments
Authorization: Bearer <token>
Content-Type: application/x-www-form-urlencoded

section_key=header_video&type=single_media&media_id=uuid-string

Response:
{
  "success": true,
  "message": "指派成功"
}
```

#### 更新指派
```
PUT /api/assignments/{assignment_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "section_key": "footer_content",
  "offset": 2,
  "group_id": "group-uuid"
}

Response:
{
  "success": true,
  "message": "指派更新成功",
  "data": {
    "id": "assignment-uuid",
    "section_key": "footer_content",
    "content_source_type": "group_reference",
    "offset": 2,
    "media_id": null,
    "group_id": "group-uuid"
  }
}
```

#### 刪除指派
```
DELETE /api/assignments/{assignment_id}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "刪除成功"
}
```

### 6. 公開 API

#### 獲取媒體和設定（用於前端顯示）
```
GET /api/media_with_settings

Response:
{
  "media": [...],
  "settings": {...},
  "_debug_all_materials": [...],
  "_debug_all_groups": [...],
  "_debug_all_assignments": [...]
}
```

## 向後兼容性

為了確保現有前端代碼的正常運行，所有舊的 API 端點仍然可用：

- `POST /admin/settings/update` → 重定向到 `PUT /api/settings`
- `POST /admin/carousel_group/create` → 重定向到 `POST /api/groups`
- `POST /admin/carousel_group/delete/{id}` → 重定向到 `DELETE /api/groups/{id}`
- `POST /admin/carousel_group/upload_images/{id}` → 重定向到 `POST /api/groups/{id}/images`
- `POST /admin/carousel_group/update_images/{id}` → 重定向到 `PUT /api/groups/{id}/images`

## ��誤處理

所有 API 端點都遵循統一的錯誤響應格式：

```json
{
  "success": false,
  "message": "錯誤描述"
}
```

常見的 HTTP 狀態碼：
- `200` - 成功
- `201` - 創建成功
- `400` - 請求錯誤
- `401` - 未授權
- `404` - 資源不存在
- `500` - 伺服器錯誤

## WebSocket 事件

系統使用 Socket.IO 進行即時通信：

- `media_updated` - 當媒體、群組或指派發生變更時觸發
- `settings_updated` - 當設定更新時觸發

## 注意事項

1. 所有需要認證的端點都需要有效的 JWT Token
2. 檔案上傳使用 `multipart/form-data` 格式
3. JSON 請求使用 `application/json` Content-Type
4. 所有 UUID 都是字符串格式
5. 圖片順序從 0 開始計算