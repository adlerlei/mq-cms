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
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mq_cms.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

# --- 常數設定 ---
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}


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

# --- 資料庫模型 ---
class User(db.Model):
    """使用者資料模型"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(80), nullable=False, default='admin')
    def __repr__(self): return f'<User {self.username}>'

# 輪播群組與圖片的多對多關聯表 (改用 Association Object 來儲存順序)
class GroupImageAssociation(db.Model):
    __tablename__ = 'group_image_association'
    group_id = db.Column(db.String(36), db.ForeignKey('carousel_group.id'), primary_key=True)
    material_id = db.Column(db.String(36), db.ForeignKey('material.id'), primary_key=True)
    order = db.Column(db.Integer, nullable=False)

    material = db.relationship("Material", back_populates="group_associations")
    group = db.relationship("CarouselGroup", back_populates="image_associations")

class Setting(db.Model):
    """儲存全域設定"""
    __tablename__ = 'setting'
    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.String(100), nullable=False)

    def __repr__(self):
        return f'<Setting {self.key}={self.value}>'

class Material(db.Model):
    """儲存媒體素材資訊"""
    __tablename__ = 'material'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), unique=True, nullable=False)
    type = db.Column(db.String(10), nullable=False)  # 'image' or 'video'
    url = db.Column(db.String(255), nullable=False)
    source = db.Column(db.String(20), default='global') # 'global' or 'group_specific'
    
    assignments = db.relationship('Assignment', backref='material', lazy=True, cascade="all, delete-orphan")
    group_associations = db.relationship('GroupImageAssociation', back_populates='material', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Material {self.original_filename}>'

class CarouselGroup(db.Model):
    """儲存輪播群組"""
    __tablename__ = 'carousel_group'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    
    image_associations = db.relationship('GroupImageAssociation', back_populates='group', lazy='dynamic', order_by='GroupImageAssociation.order', cascade="all, delete-orphan")
    assignments = db.relationship('Assignment', backref='carousel_group', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<CarouselGroup {self.name}>' 

class Assignment(db.Model):
    """儲存區塊內容指派"""
    __tablename__ = 'assignment'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    section_key = db.Column(db.String(50), nullable=False)
    content_source_type = db.Column(db.String(20), nullable=False) # 'single_media' or 'group_reference'
    offset = db.Column(db.Integer, default=0)
    
    # 外鍵
    media_id = db.Column(db.String(36), db.ForeignKey('material.id'), nullable=True)
    group_id = db.Column(db.String(36), db.ForeignKey('carousel_group.id'), nullable=True)

    def __repr__(self):
        return f'<Assignment {self.section_key}>'


# --- 輔助函式 ---
def allowed_file(filename):
    """檢查檔案副檔名是否在允許的列表中"""
    if '.' not in filename:
        return False
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS

# --- JWT 認證裝飾器 ---
def token_required(f):
    """JWT 認證裝飾器，用於保護需要登入才能存取的 API 路由"""
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

def page_auth_required(f):
    """頁面認證裝飾器，用於保護需要登入才能存取的頁面路由，失敗時重定向到登入頁面"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers and request.headers['Authorization'].startswith('Bearer '):
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return redirect(url_for('login_page'))
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(username=data['username']).first()
            if not current_user:
                return redirect(url_for('login_page'))
        except Exception as e:
            return redirect(url_for('login_page'))
        return f(current_user, *args, **kwargs)
    return decorated

# --- 頁面渲染路由 ---
@app.route('/')
def login_page():
    """渲染登入頁面作為首頁"""
    return render_template('login.html')

@app.route('/display')
def display_page():
    """渲染廣告機展示頁面，無需驗證"""
    return render_template('display.html')

@app.route('/login')
def login_redirect():
    """重定向到首頁登入"""
    return redirect(url_for('login_page'))

@app.route('/admin')
@app.route('/admin/')
def admin_page():
    """渲染管理員頁面，從資料庫載入資料和設定"""
    # 為了渲染範本，我們需要傳遞與舊結構類似的資料
    # 但這些資料現在全部來自資料庫
    
    # 獲取設定
    settings_from_db = Setting.query.all()
    settings = {s.key: s.value for s in settings_from_db}

    # 獲取所有素材和群組，並轉換為字典格式以相容舊的前端邏輯
    all_materials = Material.query.all()
    all_groups = CarouselGroup.query.all()
    all_assignments = Assignment.query.all()

    # 轉換為類似 media.json 的結構，以最大限度地減少對 admin.html 的更改
    media_items = []
    for m in all_materials:
        media_items.append({
            "id": m.id,
            "original_filename": m.original_filename,
            "filename": m.filename,
            "type": m.type,
            "url": m.url,
            "source": m.source
        })
    
    for g in all_groups:
        media_items.append({
            "id": g.id,
            "name": g.name,
            "type": 'carousel_group',
            "image_ids": [assoc.material_id for assoc in g.image_associations]
        })

    for a in all_assignments:
        media_items.append({
            "id": a.id,
            "type": 'section_assignment',
            "section_key": a.section_key,
            "content_source_type": a.content_source_type,
            "media_id": a.media_id,
            "group_id": a.group_id,
            "offset": a.offset
        })

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
def _create_assignment_record(data):
    """內部輔助函式，用於建立指派記錄。不執行 db.session.commit()。

    Args:
        data (dict-like): 包含指派資訊的字典，如 request.form 或自訂字典。

    Returns:
        tuple: (success, message_or_object) 成功時返回 (True, new_assignment)，失敗時返回 (False, error_message)。
    """
    section_key = data.get('section_key')
    content_type = data.get('type')

    if not section_key or not content_type:
        return False, '缺少必要參數'

    # 只有在指派輪播組時，才執行覆蓋性刪除
    if content_type == 'group_reference':
        Assignment.query.filter_by(section_key=section_key).delete()

    if content_type == 'group_reference':
        group_id = data.get('carousel_group_id')
        offset = int(data.get('offset', 0))
        if not group_id:
            return False, '缺少輪播組ID'
        
        new_assignment = Assignment(
            section_key=section_key,
            content_source_type='group_reference',
            group_id=group_id,
            offset=offset
        )
        db.session.add(new_assignment)
        return True, new_assignment

    elif content_type in ['image', 'video', 'single_media']:
        media_id = data.get('media_id')
        if not media_id:
            return False, '缺少媒體ID'
        
        new_assignment = Assignment(
            section_key=section_key,
            content_source_type='single_media',
            media_id=media_id
        )
        db.session.add(new_assignment)
        return True, new_assignment

    else:
        return False, '不支援的操作類型'

@app.route('/api/assignments', methods=['POST'])
@token_required
def create_assignment(current_user):
    """處理新增內容指派的請求"""
    try:
        success, result = _create_assignment_record(request.form)
        if not success:
            return jsonify({'success': False, 'message': result}), 400

        db.session.commit()
        socketio.emit('media_updated', {'message': '內容已成功指派！'})
        return jsonify({'success': True, 'message': '指派成功'})

    except Exception as e:
        db.session.rollback()
        print(f"建立指派時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '建立指派時發生伺服器錯誤。'}), 500

@app.route('/api/materials', methods=['POST'])
@token_required
def upload_material(current_user):
    """處理上傳新的媒體檔案，並可選擇性地直接指派。"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '未找到上傳的檔案'}), 400

    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'success': False, 'message': '檔案類型不支援或未選擇檔案'}), 400

    try:
        original_display_filename = file.filename
        file_extension = original_display_filename.rsplit('.', 1)[1].lower()
        media_type = 'image' if file_extension in {'png', 'jpg', 'jpeg', 'gif'} else 'video'
        
        # 統一使用一個 UUID 作為 ID 和檔名基礎
        material_id = str(uuid.uuid4())
        unique_filename = f"{material_id}.{file_extension}"

        new_material = Material(
            id=material_id,
            original_filename=original_display_filename,
            filename=unique_filename,
            type=media_type,
            url=f"/{UPLOAD_FOLDER}/{unique_filename}"
        )

        # 檢查是否需要同時建立指派
        section_key = request.form.get('section_key')
        if section_key:
            assignment_data = {
                'section_key': section_key,
                'type': 'single_media',
                'media_id': new_material.id  # 現在這裡有值了
            }
            success, result_or_message = _create_assignment_record(assignment_data)
            if not success:
                # 指派失敗，直接返回錯誤，不儲存任何東西
                return jsonify({'success': False, 'message': f'素材上傳成功，但指派失敗: {result_or_message}'}), 400

        # 將素材加入資料庫 session
        db.session.add(new_material)

        # 儲存實體檔案
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_material.filename)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        file.save(filepath)

        # 一次性提交所有變更 (素材和指派)
        db.session.commit()

        socketio.emit('media_updated', {'message': '素材已成功上傳！'})
        return jsonify({'success': True, 'message': '上傳成功', 'material': {'id': new_material.id, 'url': new_material.url}})

    except Exception as e:
        db.session.rollback()
        print(f"上傳素材時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '上傳素材時發生伺服器錯誤。'}), 500


@app.route('/api/materials/<item_id_to_delete>', methods=['DELETE'])
@token_required
def delete_material(current_user, item_id_to_delete):
    """處理刪除媒體素材的請求"""
    try:
        material_to_delete = Material.query.get(item_id_to_delete)
        if not material_to_delete:
            return jsonify({'success': False, 'message': '找不到要刪除的素材'}), 404

        # 刪除實體檔案
        if material_to_delete.filename:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], material_to_delete.filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"已成功刪除實體檔案: {filepath}")
                except OSError as e:
                    print(f"刪除檔案時發生錯誤 {filepath}: {e}")
        
        # 刪除資料庫記錄 (關聯的 Assignment 和 GroupImageAssociation 會自動級聯刪除)
        db.session.delete(material_to_delete)
        db.session.commit()

        socketio.emit('media_updated', {'message': '素材已刪除!'})
        return jsonify({'success': True, 'message': '刪除成功'})

    except Exception as e:
        db.session.rollback()
        print(f"刪除素材時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '刪除素材時發生伺服器錯誤。'}), 500

@app.route('/api/assignments/<assignment_id_to_delete>', methods=['DELETE'])
@token_required
def delete_assignment(current_user, assignment_id_to_delete):
    """處理刪除內容指派的請求"""
    try:
        assignment_to_delete = Assignment.query.get(assignment_id_to_delete)
        if not assignment_to_delete:
            return jsonify({'success': False, 'message': '找不到要刪除的指派'}), 404

        db.session.delete(assignment_to_delete)
        db.session.commit()

        socketio.emit('media_updated', {'message': '指派已刪除!'})
        return jsonify({'success': True, 'message': '刪除成功'})

    except Exception as e:
        db.session.rollback()
        print(f"刪除指派時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '刪除指派時發生伺服器錯誤。'}), 500

@app.route('/admin/settings/update', methods=['POST'])
@token_required
def update_global_settings(current_user):
    """處理更新全域播放設定的請求，寫入資料庫"""
    data = request.json
    try:
        # 遍歷收到的設定並更新資料庫
        for key, value in data.items():
            setting_to_update = Setting.query.get(key)
            if setting_to_update:
                setting_to_update.value = str(value)
        
        db.session.commit()
        
        # 通知前端更新
        socketio.emit('settings_updated', data)
        return jsonify({'success': True, 'message': '設定已成功儲存！'})
    except (ValueError, TypeError):
        db.session.rollback()
        return jsonify({'success': False, 'message': '輸入的值無效。'}), 400
    except Exception as e:
        db.session.rollback()
        print(f"更新設定時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '儲存設定時發生伺服器錯誤。'}), 500

@app.route('/admin/carousel_group/create', methods=['POST'])
@token_required
def create_carousel_group(current_user):
    """處理建立新的輪播群組的請求，寫入資料庫"""
    group_name = request.form.get('group_name')
    if not group_name:
        return jsonify({'success': False, 'message': '群組名稱不能為空'}), 400
    
    try:
        new_group = CarouselGroup(name=group_name)
        db.session.add(new_group)
        db.session.commit()
        
        socketio.emit('media_updated', {'message': '群組已建立!'})
        return jsonify({'success': True, 'message': '群組建立成功'})
    except Exception as e:
        db.session.rollback()
        print(f"建立群組時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '建立群組時發生伺服器錯誤。'}), 500

@app.route('/admin/carousel_group/delete/<group_id_to_delete>', methods=['POST'])
@token_required
def delete_carousel_group(current_user, group_id_to_delete):
    """處理刪除輪播群組的請求，從資料庫刪除"""
    try:
        group_to_delete = CarouselGroup.query.get(group_id_to_delete)
        if not group_to_delete:
            return jsonify({'success': False, 'message': '找不到要刪除的群組'}), 404

        # 找出並刪除群組專屬的圖片實體檔案
        material_ids_in_group = [assoc.material_id for assoc in group_to_delete.image_associations]
        group_specific_images = Material.query.filter(
            Material.source == 'group_specific',
            Material.id.in_(material_ids_in_group)
        ).all()
        for image_item in group_specific_images:
            if image_item.filename:
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], image_item.filename)
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                        print(f"已刪除群組專屬圖片檔案: {filepath}")
                    except OSError as e:
                        print(f"刪除群組專屬圖片檔案時發生錯誤 {filepath}: {e}")
            # 從資料庫刪除圖片記錄
            db.session.delete(image_item)

        # 刪除群組本身 (關聯的 Assignment 和 GroupImageAssociation 會自動級聯刪除)
        db.session.delete(group_to_delete)
        db.session.commit()
        
        socketio.emit('media_updated', {'message': '群組及其專屬圖片已刪除！'})
        return jsonify({'success': True, 'message': '群組刪除成功'})
    except Exception as e:
        db.session.rollback()
        print(f"刪除群組時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '刪除群組時發生伺服器錯誤。'}), 500

# 在現有路由後新增以下路由
@app.route('/admin/carousel_group/upload_images/<group_id>', methods=['POST'])
@token_required
def upload_images_to_group(current_user, group_id):
    """處理群組專屬的多圖片上傳，寫入資料庫"""
    try:
        group = CarouselGroup.query.get(group_id)
        if not group:
            return jsonify({'success': False, 'message': '找不到指定的群組'}), 404

        if 'files' not in request.files:
            return jsonify({'success': False, 'message': '沒有選擇檔案'}), 400

        files = request.files.getlist('files')
        if not files or all(file.filename == '' for file in files):
            return jsonify({'success': False, 'message': '沒有選擇有效的檔案'}), 400

        uploaded_image_objects = []
        
        for file in files:
            if file and file.filename != '' and allowed_file(file.filename):
                file_extension = file.filename.rsplit('.', 1)[1].lower()
                if file_extension not in {'png', 'jpg', 'jpeg', 'gif'}: continue

                new_material_id = str(uuid.uuid4())
                unique_filename = f"{new_material_id}.{file_extension}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
                file.save(filepath)

                new_material = Material(
                    id=new_material_id,
                    original_filename=file.filename,
                    filename=unique_filename,
                    type='image',
                    source='group_specific',
                    url=f"/{UPLOAD_FOLDER}/{unique_filename}"
                )
                db.session.add(new_material)

                # 將新圖片加入到群組的末尾
                max_order = db.session.query(db.func.max(GroupImageAssociation.order)).filter_by(group_id=group_id).scalar() or -1
                new_assoc = GroupImageAssociation(group_id=group_id, material_id=new_material_id, order=max_order + 1)
                db.session.add(new_assoc)

                uploaded_image_objects.append({
                    "id": new_material.id,
                    "original_filename": new_material.original_filename,
                    "filename": new_material.filename,
                    "type": new_material.type,
                    "source": new_material.source,
                    "group_id": group_id,
                    "group_name": group.name,
                    "url": new_material.url
                })
        
        if uploaded_image_objects:
            db.session.commit()
            # socketio.emit('media_updated', {'message': f'成功上傳 {len(uploaded_image_objects)} 張圖片到群組！'})
            return jsonify({
                'success': True, 
                'message': f'成功上傳 {len(uploaded_image_objects)} 張圖片',
                'uploaded_images': uploaded_image_objects
            })
        else:
            return jsonify({'success': False, 'message': '沒有成功上傳任何圖片，請檢查檔案格式'}), 400
            
    except Exception as e:
        db.session.rollback()
        print(f"群組上傳圖片時發生錯誤: {str(e)}")
        return jsonify({'success': False, 'message': f'上傳失敗: {str(e)}'}), 500

@app.route('/admin/carousel_group/update_images/<group_id>', methods=['POST'])
@token_required
def update_carousel_group_images(current_user, group_id):
    """處理更新輪播群組中圖片順序的請求，寫入資料庫"""
    data = request.get_json()
    if not data or 'image_ids' not in data:
        return jsonify({'success': False, 'message': '請求無效'}), 400

    try:
        group = CarouselGroup.query.get(group_id)
        if not group:
            return jsonify({'success': False, 'message': '找不到群組'}), 404

        # 刪除舊的關聯
        GroupImageAssociation.query.filter_by(group_id=group_id).delete()

        # 建立新的關聯，並儲存順序
        for index, image_id in enumerate(data['image_ids']):
            # 確保圖片存在
            if Material.query.get(image_id):
                new_assoc = GroupImageAssociation(group_id=group_id, material_id=image_id, order=index)
                db.session.add(new_assoc)
        
        db.session.commit()
        socketio.emit('media_updated', {'message': '圖片順序已更新!'})
        return jsonify({'success': True, 'message': '圖片順序已儲存'})
    except Exception as e:
        db.session.rollback()
        print(f"更新群組圖片時發生錯誤: {e}")
        return jsonify({'success': False, 'message': '更新群組圖片時發生伺服器錯誤。'}), 500
    
# --- 公開 API ---
@app.route('/api/media_with_settings', methods=['GET'])
def get_media_with_settings():
    """提供給前端的 API，返回所有媒體資料和播放設定，並處理輪播群組的偏移"""
    # 從資料庫獲取設定
    settings_from_db = Setting.query.all()
    settings = {s.key: s.value for s in settings_from_db}

    # 從資料庫獲取所有指派
    assignments = Assignment.query.all()
    
    section_content_map = {} 

    for assign in assignments:
        section_key = assign.section_key
        if section_key not in section_content_map:
            section_content_map[section_key] = []

        if assign.content_source_type == 'group_reference' and assign.carousel_group:
            group = assign.carousel_group
            # 透過 image_associations 取得已排序的圖片
            ordered_images = [assoc.material for assoc in group.image_associations]
            
            if ordered_images:
                effective_offset = assign.offset % len(ordered_images)
                # 應用偏移量
                final_image_order = ordered_images[effective_offset:] + ordered_images[:effective_offset]
                
                for material in final_image_order:
                    section_content_map[section_key].append({
                        "id": material.id,
                        "filename": material.filename,
                        "type": "image",
                        "url": material.url,
                        "section_key": section_key
                    })

        elif assign.content_source_type == 'single_media' and assign.material:
            material = assign.material
            section_content_map[section_key].append({
                "id": material.id,
                "filename": material.filename,
                "type": material.type,
                "url": material.url,
                "section_key": section_key
            })

    processed_media_for_frontend = []
    for section_key, content_list in section_content_map.items():
        processed_media_for_frontend.extend(content_list)
        
    # 為了讓後台 admin.html 仍然能讀取到所有素材和群組，暫時從資料庫查詢
    all_materials = Material.query.all()
    all_groups = CarouselGroup.query.all()
    all_assignments = Assignment.query.all()

    # 將 SQLAlchemy 物件轉換為字典列表
    _debug_all_materials = [
        {"id": m.id, "original_filename": m.original_filename, "filename": m.filename, "type": m.type, "url": m.url, "source": m.source} for m in all_materials
    ]
    _debug_all_groups = [
        {"id": g.id, "name": g.name, "image_ids": [assoc.material_id for assoc in g.image_associations]} for g in all_groups
    ]
    _debug_all_assignments = [
        {"id": a.id, "section_key": a.section_key, "content_source_type": a.content_source_type, "media_id": a.media_id, "group_id": a.group_id, "offset": a.offset} for a in all_assignments
    ]

    return jsonify({"media": processed_media_for_frontend, 
                    "settings": settings, 
                    "_debug_all_materials": _debug_all_materials, 
                    "_debug_all_groups": _debug_all_groups,
                    "_debug_all_assignments": _debug_all_assignments})

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
        db.create_all()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True)