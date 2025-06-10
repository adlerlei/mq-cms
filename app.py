# ----------------------------------------------------------------
# --- 最終、完整、可運行的整合版 app.py ---
# ----------------------------------------------------------------
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
import stat

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
SETTINGS_FILE = 'settings.json'

AVAILABLE_SECTIONS = {
    "header_video": "頁首影片/圖片輪播",
    "carousel_top_left": "中間左上輪播",
    "carousel_top_right": "中間右上輪播",
    "carousel_bottom_left": "中間左下輪播",
    "carousel_bottom_right": "中間右下輪播",
    "footer_content": "頁尾影片/圖片輪播"
}

DEFAULT_PLAYBACK_SETTINGS = {
    "header_interval": 5,
    "carousel_interval": 6,
    "footer_interval": 7,
    "type": "_global_settings_"
}

# --- 使用者資料模型 ---
class User(db.Model):
    """使用者資料模型"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(80), nullable=False, default='admin')
    def __repr__(self): return f'<User {self.username}>'

# --- 輔助函式 ---
def allowed_file(filename):
    """檢查檔案副檔名是否在允許的列表中"""
    if '.' not in filename:
        return False
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS

def load_media_data():
    if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0: return []
    """從 media.json 載入媒體資料"""
    try:
        with open(MEDIA_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        print(f"讀取 media.json 錯誤: {e}"); return []

def save_media_data(data):
    try:
        """將媒體資料儲存到 media.json"""
        with open(MEDIA_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2, ensure_ascii=False)
    except IOError as e: print(f"儲存 media.json 錯誤: {e}")

def load_playback_settings():
    """從 settings.json 載入播放設定，如果檔案不存在或為空，則使用預設設定"""
    if not os.path.exists(SETTINGS_FILE) or os.path.getsize(SETTINGS_FILE) == 0:
        return DEFAULT_PLAYBACK_SETTINGS.copy()
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            for key, default_value in DEFAULT_PLAYBACK_SETTINGS.items():
                if key not in settings: settings[key] = default_value
            return settings
    except Exception as e:
        print(f"讀取 settings.json 錯誤: {e}"); return DEFAULT_PLAYBACK_SETTINGS.copy()

def save_playback_settings(settings_data):
    """將播放設定儲存到 settings.json"""
    try:
        settings_to_save = DEFAULT_PLAYBACK_SETTINGS.copy()
        settings_to_save.update(settings_data)
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings_to_save, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"儲存 settings.json 錯誤: {e}")

# --- JWT 認證裝飾器 ---
def token_required(f):
    """JWT 認證裝飾器，用於保護需要登入才能存取的路由"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers and request.headers['Authorization'].startswith('Bearer '):
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(username=data['username']).first()
            if not current_user:
                return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': f'Token error: {str(e)}'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# --- 頁面渲染路由 ---
@app.route('/')
def index_page():
    """渲染首頁"""
    return render_template('index.html')

@app.route('/login')
def login_page():
    """渲染登���頁面"""
    return render_template('login.html')

@app.route('/admin')
def admin_page():
    """渲染管理員頁面，載入媒體資料和設定"""
    media_items = load_media_data()
    settings = load_playback_settings()
    return render_template('admin.html', media_items=media_items, available_sections=AVAILABLE_SECTIONS, settings=settings)

# --- 認證 API ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    """處理使用者登入請求，驗證帳號密碼並發放 JWT"""
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401
    user = User.query.filter_by(username=auth.get('username')).first()
    if not user or not check_password_hash(user.password_hash, auth.get('password')):
        return jsonify({'message': '帳號或密碼錯誤'}), 401
    token = jwt.encode({'username': user.username, 'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)}, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({'access_token': token})

# --- 受保護的管理 API ---
@app.route('/admin/add', methods=['POST'])
@token_required
def add_media_item(current_user):
    """處理新增媒體項目或輪播群組指派的請求"""
    try:
        media_type_action = request.form.get('type')
        section_key_from_form = request.form.get('section_key')
        media_items_db = load_media_data()
        final_list_to_save = list(media_items_db)
        new_item_object = None

        if media_type_action in ['image', 'video']:
            if 'file' not in request.files:
                return jsonify({'message': '未找到上傳的檔案'}), 400
                
            file = request.files['file']
            if file.filename == '':
                return jsonify({'message': '未選擇檔案'}), 400

            # 檢查檔案名稱格式
            if not file.filename or file.filename == '':
                return jsonify({'message': '檔案名稱不能為空'}), 400
            
            # 檢查是否有副檔名
            if '.' not in file.filename:
                return jsonify({'message': '檔案必須包含副檔名'}), 400
            
            # 使用 secure_filename 清理檔案名，但保留原始檔名作為備用
            original_filename = file.filename
            secure_name = secure_filename(file.filename)
            
            # 如果 secure_filename 清空了檔案名（通常是因為特殊字符），使用原始檔名的副檔名
            if not secure_name or '.' not in secure_name:
                file_extension = original_filename.rsplit('.', 1)[1].lower()
                secure_name = f"upload.{file_extension}"

            if not allowed_file(original_filename):
                allowed_types = ", ".join(ALLOWED_EXTENSIONS)
                return jsonify({'message': f'不支援的檔案類型。允許的類型：{allowed_types}'}), 400

            new_material_id = str(uuid.uuid4())
            file_extension = original_filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{new_material_id}.{file_extension}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # 確保上傳目錄存在並設置正確權限
            os.makedirs(app.config['UPLOAD_FOLDER'], mode=0o755, exist_ok=True)
            
            # 調試信息：檢查目錄權限
            dir_stat = os.stat(app.config['UPLOAD_FOLDER'])
            print(f"Upload directory permissions: {oct(dir_stat.st_mode)}")
            print(f"Upload directory owner: {dir_stat.st_uid}")
            print(f"Current process user: {os.getuid()}")
            print(f"Attempting to save file to: {filepath}")
            
            # 儲存檔案
            file.save(filepath)
            print(f"File saved successfully to: {filepath}")
            
            new_material_item = {
                "id": new_material_id,
                "original_filename": original_filename,
                "filename": unique_filename,
                "type": media_type_action,
                "url": f"/{UPLOAD_FOLDER}/{unique_filename}"
            }
            final_list_to_save.append(new_material_item)

            if section_key_from_form:
                new_item_object = {
                    "id": str(uuid.uuid4()),
                    "type": "section_assignment",
                    "section_key": section_key_from_form,
                    "content_source_type": "single_media",
                    "media_id": new_material_id
                }
                
        elif media_type_action == 'carousel_reference':
            group_id_referenced = request.form.get('carousel_group_id')
            offset = int(request.form.get('offset', '0'))
            if section_key_from_form and group_id_referenced:
                final_list_to_save = [item for item in media_items_db if not (
                    item.get('type') == 'section_assignment' and 
                    item.get('section_key') == section_key_from_form
                )]
                new_item_object = {
                    "id": str(uuid.uuid4()),
                    "type": "section_assignment",
                    "section_key": section_key_from_form,
                    "content_source_type": "group_reference",
                    "group_id": group_id_referenced,
                    "offset": offset
                }
        
        # If only a material was created (no direct assignment from the form)
        if new_item_object is None and media_type_action in ['image', 'video']:
            save_media_data(final_list_to_save)  # Save the material
            socketio.emit('media_updated', {'message': '素材已新增!'})
        elif new_item_object:  # If an assignment was created
            final_list_to_save.append(new_item_object)
            save_media_data(final_list_to_save)
            socketio.emit('media_updated', {'message': '操作完成!'})
        
        return redirect(url_for('admin_page'))
        
    except Exception as e:
        print(f"處理請求時發生錯誤: {str(e)}")
        return jsonify({'message': f'處理請求時發生錯誤: {str(e)}'}), 500


@app.route('/admin/delete/<item_id_to_delete>', methods=['POST'])
@token_required
def delete_media_item(current_user, item_id_to_delete):
    """處理刪除媒體項目或輪播群組指派的請求，並刪除相關的實體檔案"""
    media_items = load_media_data()
    item_to_delete = None
    
    # 在過濾前，先找到要被刪除的項目
    for item in media_items:
        if item.get('id') == item_id_to_delete:
            item_to_delete = item
            break

    # 如果找到了要刪除的項目，並且它是'image'或'video'類型的素材
    if item_to_delete and item_to_delete.get('type') in ['image', 'video']:
        filename = item_to_delete.get('filename') # This should now be the unique filename
        if filename:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            try:
                # 檢查檔案是否存在，然後刪除它
                if os.path.exists(filepath):
                    os.remove(filepath)
                    print(f"已成功刪除實體檔案: {filepath}")
            except OSError as e:
                print(f"刪除檔案時發生錯誤 {filepath}: {e}")

    # 從列表中移除該項目的 JSON 記錄 (無論是素材還是指派)
    final_list = [item for item in media_items if item.get('id') != item_id_to_delete]
    
    # 檢查是否有任何指派正在使用即將被刪除的素材
    if item_to_delete and item_to_delete.get('type') in ['image', 'video']:
        material_id = item_to_delete.get('id')
        # 從列表中也移除引用了此素材的 'section_assignment'
        final_list = [
            item for item in final_list 
            if not (item.get('type') == 'section_assignment' and item.get('media_id') == material_id)
        ]
        # Also remove the material from any carousel groups it was part of
        for item in final_list:
            if item.get('type') == 'carousel_group' and 'image_ids' in item:
                item['image_ids'] = [img_id for img_id in item['image_ids'] if img_id != material_id]


    save_media_data(final_list)
    socketio.emit('media_updated', {'message': '項目已刪除!'})
    # 刪除後返回 JSON 響應，讓前端 JS 處理刷新，這是更好的 API 設計
    return jsonify({'success': True, 'message': '刪除成功'})

@app.route('/admin/settings/update', methods=['POST'])
@token_required
def update_global_settings(current_user):
    """處理更新全域播放設定的請求"""
    data = request.json
    try:
        new_settings = {
            "header_interval": int(data['header_interval']),
            "carousel_interval": int(data['carousel_interval']),
            "footer_interval": int(data['footer_interval'])
        }
        save_playback_settings(new_settings)
        socketio.emit('settings_updated', new_settings)
        return jsonify({'success': True, 'message': '設定已成功儲存！'})
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': '輸入的值無效。'}), 400

@app.route('/admin/carousel_group/create', methods=['POST'])
@token_required
def create_carousel_group(current_user):
    """處理建立新的輪播群組的請求"""
    group_name = request.form.get('group_name')
    if not group_name: return redirect(url_for('admin_page'))
    media_items = load_media_data()
    new_group = {"id": str(uuid.uuid4()), "type": "carousel_group", "name": group_name, "image_ids": []}
    media_items.append(new_group)
    save_media_data(media_items)
    socketio.emit('media_updated', {'message': '群組已建立!'})
    return redirect(url_for('admin_page'))

@app.route('/admin/carousel_group/delete/<group_id_to_delete>', methods=['POST'])
@token_required
def delete_carousel_group(current_user, group_id_to_delete):
    """處理刪除輪播群組的請求，同時移除所有引用該群組的指派"""
    media_items = load_media_data()
    final_list = [item for item in media_items if item.get('id') != group_id_to_delete and item.get('group_id') != group_id_to_delete]
    if len(final_list) < len(media_items):
        save_media_data(final_list)
        socketio.emit('media_updated', {'message': '群組已刪除!'})
    return redirect(url_for('admin_page'))

@app.route('/admin/carousel_group/update_images/<group_id>', methods=['POST'])
@token_required
def update_carousel_group_images(current_user, group_id):
    """處理更新輪播群組中圖片順序的請求"""
    data = request.get_json()
    if not data or 'image_ids' not in data: return jsonify({'success': False, 'message': '請求無效'}), 400
    media_items = load_media_data()
    group_found = False
    for item in media_items:
        if item.get('id') == group_id and item.get('type') == 'carousel_group':
            item['image_ids'] = data['image_ids']
            group_found = True
            break
    if group_found:
        save_media_data(media_items)
        socketio.emit('media_updated', {'message': '圖片順序已更新!'})
        return jsonify({'success': True, 'message': '圖片順序已儲存'})
    return jsonify({'success': False, 'message': '找不到群組'}), 404
    
# --- 公開 API ---
@app.route('/api/media_with_settings', methods=['GET'])
def get_media_with_settings():
    """提供給前端的 API，返回所有媒體資料和播放設定，並處理輪播群組的偏移"""
    media_items_db = load_media_data()
    settings = load_playback_settings()
    materials = {item['id']: item for item in media_items_db if item.get('type') in ['image', 'video']}
    groups = {item['id']: item for item in media_items_db if item.get('type') == 'carousel_group'}
    assignments = [item for item in media_items_db if item.get('type') == 'section_assignment']
    
    section_content_map = {} 
    group_assigned_sections = set()

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
                            current_section_images.append({"id": material.get("id"), "filename": material.get("filename"),"type": "image", "url": material.get("url"),"section_key": section_key})
                section_content_map[section_key] = current_section_images
    
    for assign in assignments:
        if assign.get('content_source_type') == 'single_media':
            section_key = assign.get('section_key')
            media_id = assign.get('media_id')
            material = materials.get(media_id)
            if section_key and material:
                if section_key not in group_assigned_sections:
                    if section_key not in section_content_map:
                        section_content_map[section_key] = []
                    section_content_map[section_key].append({"id": material.get("id"), "filename": material.get("filename"),"type": material.get("type"), "url": material.get("url"),"section_key": section_key})

    processed_media_for_frontend = []
    for section_key, content_list in section_content_map.items():
        processed_media_for_frontend.extend(content_list)
        
    # Also include all raw materials and groups for admin page if needed elsewhere, or specific admin API
    all_materials = [item for item in media_items_db if item.get('type') in ['image', 'video']]
    all_groups = [item for item in media_items_db if item.get('type') == 'carousel_group']

    return jsonify({"media": processed_media_for_frontend, 
                    "settings": settings, 
                    "_debug_all_materials": all_materials, "_debug_all_groups": all_groups})

# --- WebSocket ---
@socketio.on('connect', namespace='/')
def handle_connect():
    """處理 WebSocket 連接事件"""
    print('一個客戶端已連接')
@socketio.on('disconnect', namespace='/')
def handle_disconnect():
    """處理 WebSocket 斷開連接事件"""
    print('一個客戶端已斷開')

# --- 主程式啟動 ---
if __name__ == '__main__':
    with app.app_context():
        if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER, mode=0o755)
        if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0: save_media_data([])
        if not os.path.exists(SETTINGS_FILE) or os.path.getsize(SETTINGS_FILE) == 0: save_playback_settings({})
        db.create_all()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True)