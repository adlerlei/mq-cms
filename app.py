# 匯入 Flask 套件以及 render_template, jsonify, request, redirect, url_for
from flask import Flask, jsonify, render_template, request, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
import os
import json
import uuid

# 建立 Flask 應用程式實例
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

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

DEFAULT_PLAYBACK_SETTINGS = {
    "header_interval": 5,
    "carousel_interval": 6,
    "footer_interval": 7,
    "type": "_global_settings_" # 特殊類型標識
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_media_data():
    if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0:
        return []
    try:
        with open(MEDIA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"讀取 media.json 時發生錯誤: {e}")
        return []

def save_media_data(data):
    try:
        with open(MEDIA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"儲存 media.json 錯誤: {e}")

def load_playback_settings():
    if not os.path.exists(SETTINGS_FILE) or os.path.getsize(SETTINGS_FILE) == 0:
        print(f"設定檔 {SETTINGS_FILE} 不存在或為空，使用預設設定。")
        return DEFAULT_PLAYBACK_SETTINGS.copy() # 返回預設設定的副本
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            # 確保所有預期的鍵都存在，如果不存在則使用預設值
            for key, default_value in DEFAULT_PLAYBACK_SETTINGS.items():
                if key not in settings:
                    settings[key] = default_value
            return settings
    except Exception as e:
        print(f"讀取 settings.json 時發生錯誤: {e}，使用預設設定。")
        return DEFAULT_PLAYBACK_SETTINGS.copy()

def save_playback_settings(settings_data):
    try:
        # 確保儲存的設定包含 type 標識
        settings_data_to_save = DEFAULT_PLAYBACK_SETTINGS.copy()
        settings_data_to_save.update(settings_data) # 用傳入的數據更新預設值
        settings_data_to_save["type"] = "_global_settings_" # 確保 type 存在

        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings_data_to_save, f, indent=2, ensure_ascii=False)
        print(f"播放設定已儲存到 {SETTINGS_FILE}")
    except IOError as e:
        print(f"儲存 settings.json 錯誤: {e}")


@app.route('/admin/add', methods=['POST'])
def add_media_item():
    # ... (add_media_item 函數的內容與 app_py_refactored_assignment_logic 版本相同)
    if request.method == 'POST':
        media_type_action = request.form.get('type') 
        section_key_from_form = request.form.get('section_key')
        
        if not media_type_action:
            print("錯誤：操作類型未選擇。")
            return redirect(url_for('admin_page'))

        media_items_db = load_media_data()
        final_list_to_save = list(media_items_db) 
        new_item_object = None

        if media_type_action in ['image', 'video']: 
            if 'file' not in request.files or request.files['file'].filename == '':
                print("錯誤：未選擇檔案進行上傳。")
                return redirect(url_for('admin_page'))
            file = request.files['file']

            if not section_key_from_form: 
                print("錯誤：上傳圖片/影片時未指定區塊。")
                return redirect(url_for('admin_page'))
            if section_key_from_form not in AVAILABLE_SECTIONS:
                print(f"錯誤：為圖片/影片選擇了無效的區塊 {section_key_from_form}")
                return redirect(url_for('admin_page'))

            if file and allowed_file(file.filename):
                original_filename = secure_filename(file.filename)
                name_part, extension_part = os.path.splitext(original_filename)
                unique_suffix = str(uuid.uuid4())[:8]
                unique_filename = f"{name_part}_{unique_suffix}{extension_part}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                try:
                    file.save(filepath)
                except Exception as e:
                    print(f"儲存檔案失敗: {e}")
                    return redirect(url_for('admin_page'))

                new_material_id = str(uuid.uuid4())
                new_material_item = {
                    "id": new_material_id,
                    "filename": unique_filename,
                    "type": media_type_action,
                    "url": f"/{UPLOAD_FOLDER}/{unique_filename}"
                }
                final_list_to_save.append(new_material_item) # 先加入素材
                print(f"新的媒體素材已建立: {new_material_item}")

                new_assignment_id = str(uuid.uuid4())
                new_item_object = { # new_item_object 現在是指派記錄
                    "id": new_assignment_id,
                    "type": "section_assignment",
                    "section_key": section_key_from_form,
                    "content_source_type": "single_media",
                    "media_id": new_material_id
                }
                print(f"新的直接指派已建立: {new_item_object}")
                # final_list_to_save.append(new_item_object) # 指派記錄也會加入
            else:
                print(f"不允許的檔案類型或檔案有問題: {file.filename}")
                return redirect(url_for('admin_page'))

        elif media_type_action == 'carousel_reference': 
            group_id_referenced = request.form.get('carousel_group_id')
            offset_str = request.form.get('offset', '0')

            if not section_key_from_form or not section_key_from_form.startswith('carousel_'):
                print(f"錯誤：輪播指派的目標區塊無效: {section_key_from_form}")
                return redirect(url_for('admin_page'))
            if not group_id_referenced:
                print("錯誤：輪播指派未選擇圖片組。")
                return redirect(url_for('admin_page'))
            try:
                offset = int(offset_str)
                if offset < 0: offset = 0
            except ValueError:
                offset = 0
            
            if not any(item.get('id') == group_id_referenced and item.get('type') == 'carousel_group' for item in media_items_db):
                print(f"錯誤：嘗試指派一個不存在的輪播圖片組 ID: {group_id_referenced}")
                return redirect(url_for('admin_page'))

            temp_list_after_overwrite = []
            for item_from_db in media_items_db:
                if not (item_from_db.get('type') == 'section_assignment' and item_from_db.get('section_key') == section_key_from_form):
                    temp_list_after_overwrite.append(item_from_db)
                else:
                    print(f"訊息：輪播組指派給 {section_key_from_form}，將移除舊的指派項目：{item_from_db}")
            final_list_to_save = temp_list_after_overwrite
            
            new_assignment_id = str(uuid.uuid4())
            new_item_object = { # new_item_object 是輪播組指派記錄
                "id": new_assignment_id,
                "type": "section_assignment",
                "section_key": section_key_from_form,
                "content_source_type": "group_reference",
                "group_id": group_id_referenced,
                "offset": offset
            }
            print(f"新的輪播組指派已建立: {new_item_object}")
        
        else:
            print(f"未知的操作類型: {media_type_action}")
            return redirect(url_for('admin_page'))

        if new_item_object: # 無論是 single_media 指派還是 group_reference 指派
            final_list_to_save.append(new_item_object)
            save_media_data(final_list_to_save)
            socketio.emit('media_updated', {'message': f'{media_type_action} 操作完成!'}, namespace='/')
            return redirect(url_for('admin_page'))
        else:
            return redirect(url_for('admin_page'))

    return redirect(url_for('admin_page'))


# 新增：更新全局播放設定的路由
@app.route('/admin/settings/update', methods=['POST'])
def update_global_settings():
    if request.method == 'POST':
        try:
            header_interval = int(request.form.get('header_interval', DEFAULT_PLAYBACK_SETTINGS['header_interval']))
            carousel_interval = int(request.form.get('carousel_interval', DEFAULT_PLAYBACK_SETTINGS['carousel_interval']))
            footer_interval = int(request.form.get('footer_interval', DEFAULT_PLAYBACK_SETTINGS['footer_interval']))

            if header_interval < 1 or carousel_interval < 1 or footer_interval < 1:
                print("錯誤：播放間隔時間必須至少為 1 秒。")
                # 可以加入 flash message 提示用戶
                return redirect(url_for('admin_page'))

            new_settings = {
                "header_interval": header_interval,
                "carousel_interval": carousel_interval,
                "footer_interval": footer_interval
                # "type" 會在 save_playback_settings 中自動加入
            }
            save_playback_settings(new_settings)
            print(f"全局播放設定已更新: {new_settings}")
            # 通知前端設定已更新 (如果前端需要即時響應這些設定的變化)
            socketio.emit('settings_updated', new_settings, namespace='/')
        except ValueError:
            print("錯誤：輸入的播放間隔時間不是有效的數字。")
            # 可以加入 flash message 提示用戶
        except Exception as e:
            print(f"更新播放設定時發生錯誤: {e}")

        return redirect(url_for('admin_page'))
    return redirect(url_for('admin_page'))


# 新增：首頁 index.html 管理頁面路由
@app.route('/')
@app.route('/index', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/admin', methods=['GET'])
def admin_page():
    media_items = load_media_data()
    current_settings = load_playback_settings() # 載入當前設定傳給模板
    return render_template('admin.html', 
                           media_items=media_items, 
                           available_sections=AVAILABLE_SECTIONS,
                           settings=current_settings) # 傳遞 settings 給模板

@app.route('/api/media_with_settings', methods=['GET']) # 修改 API 端點以包含設定
def get_media_with_settings():
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
                            current_section_images.append({
                                "id": material.get("id"), "filename": material.get("filename"),
                                "type": "image", "url": material.get("url"),
                                "section_key": section_key
                            })
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
        "settings": settings # 將設定一起返回
    })


# ... (create_carousel_group, update_carousel_group_images, delete_media_item, delete_carousel_group, get_status, socketio handlers 保持不變) ...
@app.route('/admin/carousel_group/create', methods=['POST'])
def create_carousel_group():
    if request.method == 'POST':
        group_name = request.form.get('group_name')
        if not group_name:
            print("錯誤：輪播圖片組名稱未填寫。")
            return redirect(url_for('admin_page'))
        media_items = load_media_data()
        new_group_id = str(uuid.uuid4())
        new_carousel_group = {
            "id": new_group_id,
            "type": "carousel_group",
            "name": group_name,
            "image_ids": []
        }
        media_items.append(new_carousel_group)
        save_media_data(media_items)
        socketio.emit('media_updated', {'message': 'Carousel group created!'}, namespace='/')
        return redirect(url_for('admin_page'))
    return redirect(url_for('admin_page'))

@app.route('/admin/carousel_group/update_images/<group_id>', methods=['POST'])
def update_carousel_group_images(group_id):
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'image_ids' not in data:
            return jsonify({'success': False, 'message': '無效的請求數據，缺少 image_ids'}), 400
        new_image_ids = data['image_ids']
        media_items = load_media_data()
        group_found = False
        for item in media_items:
            if item.get('id') == group_id and item.get('type') == 'carousel_group':
                valid_ids = True
                all_materials = {m['id']: m for m in media_items if m.get('type') == 'image'}
                for img_id in new_image_ids:
                    if img_id not in all_materials:
                        valid_ids = False
                        print(f"錯誤：嘗試將不存在的圖片素材ID {img_id} 加入輪播組 {group_id}")
                        break
                if not valid_ids:
                    return jsonify({'success': False, 'message': f'一個或多個圖片ID無效或不是圖片類型'}), 400
                item['image_ids'] = new_image_ids
                group_found = True
                break
        if group_found:
            save_media_data(media_items)
            socketio.emit('media_updated', {'message': f'Carousel group {group_id} images updated!'}, namespace='/') # 可以考慮發送更特定的事件，例如 group_images_updated
            return jsonify({'success': True, 'message': '圖片順序已成功儲存'})
        else:
            return jsonify({'success': False, 'message': '找不到指定的輪播圖片組'}), 404
    return jsonify({'success': False, 'message': '只允許 POST 請求'}), 405

@app.route('/admin/carousel_group/delete/<group_id_to_delete>', methods=['POST'])
def delete_carousel_group(group_id_to_delete):
    media_items = load_media_data()
    final_list = []
    group_deleted = False
    deleted_group_name = "未知群組"
    for item in media_items:
        if item.get('id') == group_id_to_delete and item.get('type') == 'carousel_group':
            group_deleted = True
            deleted_group_name = item.get('name', group_id_to_delete)
        elif item.get('type') == 'section_assignment' and \
             item.get('content_source_type') == 'group_reference' and \
             item.get('group_id') == group_id_to_delete:
            print(f"同時移除對已刪除輪播組 {group_id_to_delete} 的指派: {item}")
        else:
            final_list.append(item)
    if group_deleted:
        save_media_data(final_list)
        print(f"輪播圖片組 '{deleted_group_name}' 及其相關指派已被刪除。")
        socketio.emit('media_updated', {'message': 'Carousel group and its assignments deleted!'}, namespace='/')
    else:
        print(f"錯誤：找不到 ID 為 {group_id_to_delete} 的輪播圖片組來刪除。")
    return redirect(url_for('admin_page'))

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({'status': 'Backend is running!'})

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0:
        save_media_data([])
    if not os.path.exists(SETTINGS_FILE) or os.path.getsize(SETTINGS_FILE) == 0:
        save_playback_settings({}) # 初始化空的設定檔或使用預設值
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, allow_unsafe_werkzeug=True)

