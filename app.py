# 整合版 app.py
from flask import Flask, jsonify, render_template, request, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import jwt
import datetime
import os
import json
import uuid

# --- 應用程式與資料庫設定 ---
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-very-secret-and-secure-key-that-no-one-knows'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

# --- 常數設定 ---
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}
MEDIA_FILE = 'media.json'
SETTINGS_FILE = 'settings.json' # 新增：設定檔案的路徑

AVAILABLE_SECTIONS = {
    "header_video": "頁首影片/圖片輪播",
    "carousel_top_left": "中間左上輪播",
    "carousel_top_right": "中間右上輪播",
    "carousel_bottom_left": "中間左下輪播",
    "carousel_bottom_right": "中間右下輪播",
    "footer_content": "頁尾影片/圖片輪播"
}

# 新增：預設播放設定
DEFAULT_PLAYBACK_SETTINGS = {
    "header_interval": 5,
    "carousel_interval": 6,
    "footer_interval": 7,
    "type": "_global_settings_" # 特殊類型標識
}

# --- 使用者資料模型 ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(80), nullable=False, default='admin')
    def __repr__(self): return f'<User {self.username}>'

# --- 輔助函式 ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_media_data():
    if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0: return []
    try:
        with open(MEDIA_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        print(f"讀取 media.json 錯誤: {e}"); return []

def save_media_data(data):
    try:
        with open(MEDIA_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2, ensure_ascii=False)
    except IOError as e: print(f"儲存 media.json 錯誤: {e}")

# 新增：讀取播放設定的函式
def load_playback_settings():
    if not os.path.exists(SETTINGS_FILE) or os.path.getsize(SETTINGS_FILE) == 0:
        return DEFAULT_PLAYBACK_SETTINGS.copy()
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            # 確保所有鍵都存在
            for key, default_value in DEFAULT_PLAYBACK_SETTINGS.items():
                if key not in settings:
                    settings[key] = default_value
            return settings
    except Exception as e:
        print(f"讀取 settings.json 錯誤: {e}"); return DEFAULT_PLAYBACK_SETTINGS.copy()

# 新增：儲存播放設定的函式
def save_playback_settings(settings_data):
    try:
        settings_to_save = DEFAULT_PLAYBACK_SETTINGS.copy()
        settings_to_save.update(settings_data)
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings_to_save, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"儲存 settings.json 錯誤: {e}")

# --- JWT 認證裝飾器 ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token or not token.startswith('Bearer '):
            return jsonify({'message': 'Token is missing or invalid!'}), 401
        
        try:
            token = token.split(" ")[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(username=data['username']).first()
            if not current_user: return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': f'Token error: {str(e)}'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# --- 頁面渲染路由 ---
@app.route('/')
def index_page():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/admin')
def admin_page(): # 移除了 @token_required 和 current_user
    media_items = load_media_data()
    settings = load_playback_settings()
    # 移除了 username=current_user.username
    return render_template('admin.html', media_items=media_items, available_sections=AVAILABLE_SECTIONS, settings=settings)

# --- 認證 API ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401, {'ContentType':'application/json'}
    user = User.query.filter_by(username=auth.get('username')).first()
    if not user or not check_password_hash(user.password_hash, auth.get('password')):
        return jsonify({'message': '帳號或密碼錯誤'}), 401, {'ContentType':'application/json'}
    
    token = jwt.encode({
        'username': user.username, 
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({'access_token': token})

# --- 受保護的管理 API ---
# (此處省略了 add_media_item, delete_media_item 等函式，它們維持原樣，無需變更)
# 您的 add, delete 等函式應保留在原位

@app.route('/admin/add', methods=['POST'])
@token_required
def add_media_item(current_user):
    # 此處應為您原本的 add_media_item 完整邏輯
    # ...
    # 範例，請貼上您原本完整的函式
    print(f"使用者 {current_user.username} 正在新增媒體。")
    # ... 您原本的邏輯 ...
    socketio.emit('media_updated', {'message': '媒體已更新!'})
    return redirect(url_for('admin_page'))


@app.route('/admin/delete/<item_id_to_delete>', methods=['POST'])
@token_required
def delete_media_item(current_user, item_id_to_delete):
    # 此處應為您原本的 delete_media_item 完整邏輯
    # ...
    # 範例，請貼上您原本完整的函式
    print(f"使用者 {current_user.username} 正在刪除 {item_id_to_delete}。")
    # ... 您原本的邏輯 ...
    socketio.emit('media_updated', {'message': '媒體已刪除!'})
    return redirect(url_for('admin_page'))
    
# 新增：更新全局播放設定的路由，並加上權限保護
@app.route('/admin/settings/update', methods=['POST'])
@token_required
def update_global_settings(current_user):
    try:
        data = request.json
        header_interval = int(data.get('header_interval', DEFAULT_PLAYBACK_SETTINGS['header_interval']))
        carousel_interval = int(data.get('carousel_interval', DEFAULT_PLAYBACK_SETTINGS['carousel_interval']))
        footer_interval = int(data.get('footer_interval', DEFAULT_PLAYBACK_SETTINGS['footer_interval']))

        if header_interval < 1 or carousel_interval < 1 or footer_interval < 1:
            return jsonify({'success': False, 'message': '播放間隔時間必須至少為 1 秒。'}), 400

        new_settings = {
            "header_interval": header_interval,
            "carousel_interval": carousel_interval,
            "footer_interval": footer_interval
        }
        save_playback_settings(new_settings)
        print(f"使用者 {current_user.username} 更新了全局播放設定: {new_settings}")
        
        # 通知前端設定已更新
        socketio.emit('settings_updated', new_settings)
        return jsonify({'success': True, 'message': '設定已成功儲存！'})
        
    except ValueError:
        return jsonify({'success': False, 'message': '輸入的播放間隔時間不是有效的數字。'}), 400
    except Exception as e:
        print(f"更新播放設定時發生錯誤: {e}")
        return jsonify({'success': False, 'message': f'伺服器錯誤: {e}'}), 500

# --- 公開 API ---
# 新增：給前端顯示頁面使用的 API，包含媒體與設定 (與 old_app.py 邏輯相同)
@app.route('/api/media_with_settings', methods=['GET'])
def get_media_with_settings():
    media_items_db = load_media_data()
    settings = load_playback_settings()
    
    materials = {item['id']: item for item in media_items_db if item.get('type') in ['image', 'video']}
    groups = {item['id']: item for item in media_items_db if item.get('type') == 'carousel_group'}
    assignments = [item for item in media_items_db if item.get('type') == 'section_assignment']
    
    section_content_map = {} 
    group_assigned_sections = set()

    # 優先處理輪播組指派
    for assign in assignments:
        if assign.get('content_source_type') == 'group_reference':
            section_key = assign.get('section_key')
            group_id = assign.get('group_id')
            offset = assign.get('offset', 0)
            group_def = groups.get(group_id)
            if section_key and group_def:
                group_assigned_sections.add(section_key) 
                current_section_images = []
                image_ids_in_group = group_def.get('image_ids', [])
                if image_ids_in_group:
                    effective_offset = offset % len(image_ids_in_group)
                    ordered_image_ids = image_ids_in_group[effective_offset:] + image_ids_in_group[:effective_offset]
                    for img_id in ordered_image_ids:
                        material = materials.get(img_id)
                        if material and material.get('type') == 'image': 
                            current_section_images.append({
                                "id": material.get("id"), "filename": material.get("filename"),
                                "type": "image", "url": material.get("url"),
                                "section_key": section_key
                            })
                section_content_map[section_key] = current_section_images
    
    # 處理直接指派的媒體，但跳過已被輪播組佔用的區塊
    for assign in assignments:
        if assign.get('content_source_type') == 'single_media':
            section_key = assign.get('section_key')
            media_id = assign.get('media_id')
            material = materials.get(media_id)
            if section_key and material:
                if section_key not in group_assigned_sections:
                    if section_key not in section_content_map:
                        section_content_map[section_key] = []
                    section_content_map[section_key].append({
                        "id": material.get("id"), "filename": material.get("filename"),
                        "type": material.get("type"), "url": material.get("url"),
                        "section_key": section_key
                    })

    processed_media_for_frontend = []
    for section_key, content_list in section_content_map.items():
        processed_media_for_frontend.extend(content_list)
        
    return jsonify({
        "media": processed_media_for_frontend,
        "settings": settings
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({'status': 'Backend is running!'})

# --- WebSocket ---
@socketio.on('connect', namespace='/')
def handle_connect(): print('一個客戶端已連接')
@socketio.on('disconnect', namespace='/')
def handle_disconnect(): print('一個客戶端已斷開')

# --- 主程式啟動 ---
if __name__ == '__main__':
    with app.app_context():
        if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)
        if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0: save_media_data([])
        if not os.path.exists(SETTINGS_FILE) or os.path.getsize(SETTINGS_FILE) == 0: save_playback_settings({})
        db.create_all()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, allow_unsafe_werkzeug=True)