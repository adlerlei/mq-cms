# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MQ-CMS is a content management system for vertical advertising displays. It's a dual-architecture project:

1. **Flask Backend** (main application) - Python-based CMS with SQLite database
2. **Cloudflare Worker** (in mq-cms/ subdirectory) - TypeScript-based with Durable Objects

## 任務執行內容
這個項目中有一個資料夾：mq-cms。 

 這個就是我要把原本的 mq-cms （使用python, flask)專案項目重構改寫為使用 cloudflare 來部署的專案。目前已經部署完畢了，完成基本的上傳跟輪播顯示。接下來我需要完整的將專案項目的 display.html 跟 admin.html 中的功能還有前端展示樣式全部都重構移植到 mq-cms_to_cloudflare_mq-cms 這個專案中。你能明白我的意思嗎？

## Development Commands

### Python Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database
python init_db.py

# Run Flask development server
python app.py

# Run backend tests
pytest

# Run frontend tests
npm test
```

### Cloudflare Worker
```bash
cd mq-cms/
# Install dependencies
npm install

# Run local development
npm run dev
# or
wrangler dev

# Deploy to Cloudflare
npm run deploy

# Run tests
npm run test
```

## Architecture

### Backend (Flask)
- **Main Application**: `app.py` - Flask app with SQLAlchemy models, RESTful APIs, and WebSocket support
- **Database**: SQLite (`instance/mq_cms.db`) with models for Users, Materials, CarouselGroups, Assignments, Settings
- **Authentication**: JWT-based with password hashing
- **WebSocket**: Real-time updates using Flask-SocketIO
- **File Storage**: Static files in `static/uploads/`

### Frontend (JavaScript Modules)
Modern ES6+ modules with separation of concerns:
- **`static/js/admin.js`**: Main entry point and initialization
- **`static/js/api.js`**: API communication layer
- **`static/js/store.js`**: State management
- **`static/js/ui.js`**: DOM manipulation and rendering
- **`static/js/eventHandlers.js`**: Event handling
- **`static/js/animation.js`**: Display page animations

### Cloudflare Worker
- **Durable Objects**: `MessageBroadcaster` for WebSocket connections
- **R2 Storage**: Media file storage
- **TypeScript**: Type-safe development

## Key Features

1. **Media Management**: Upload and manage images/videos
2. **Carousel Groups**: Create and manage image carousels with drag-and-drop ordering
3. **Content Assignment**: Assign media to display sections
4. **Real-time Updates**: WebSocket-based live updates
5. **RESTful API**: Standard REST endpoints for all operations

## Testing

### Backend Testing
- **pytest** for Python backend tests
- Test files in `tests/` directory
- Markers: `@pytest.mark.auth`, `@pytest.mark.integration`, `@pytest.mark.unit`

### Frontend Testing
- **Jest** with jsdom for JavaScript testing
- Test files in `tests/frontend/`
- Coverage threshold: 80% for branches, functions, lines, statements

## Database Schema

Key entities:
- **User**: Authentication and user management
- **Material**: Media files (images/videos)
- **CarouselGroup**: Collections of images for carousels
- **Assignment**: Content assignments to display sections
- **Setting**: Global configuration
- **GroupImageAssociation**: Many-to-many relationship with ordering

## API Endpoints

RESTful API structure:
- `/api/materials` - Media management
- `/api/groups` - Carousel group management
- `/api/assignments` - Content assignments
- `/api/settings` - Global settings
- `/api/auth` - Authentication

## Environment Setup

1. Python 3.8+ required
2. Node.js for frontend testing and Cloudflare Worker development
3. SQLite database auto-created on first run
4. Default admin credentials set in `init_db.py`

## Security Notes

- JWT tokens for API authentication
- Password hashing with Werkzeug
- File upload validation
- CORS configuration for cross-origin requests

## Development Workflow

1. Backend changes: Edit Python files, test with pytest
2. Frontend changes: Edit JS modules, test with Jest
3. Database changes: Use Flask-Migrate for schema updates
4. Cloudflare Worker: Develop in mq-cms/ subdirectory with Wrangler