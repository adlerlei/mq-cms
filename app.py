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

AVAILABLE_SECTIONS = {
    "header_video": "頁首影片/圖片輪播",
    "carousel_top_left": "中間左上輪播",
    "carousel_top_right": "中間右上輪播",
    "carousel_bottom_left": "中間左下輪播",
    "carousel_bottom_right": "中間右下輪播",
    "footer_content": "頁尾影片/圖片輪播"
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

@app.route('/admin/add', methods=['POST'])
def add_media_item():
    if request.method == 'POST':
        media_type_action = request.form.get('type') # 'image', 'video', 'carousel_reference'
        section_key_from_form = request.form.get('section_key')
        
        if not media_type_action:
            print("錯誤：操作類型未選擇。")
            return redirect(url_for('admin_page'))

        media_items_db = load_media_data()
        
        if media_type_action in ['image', 'video']: # 操作：上傳圖片/影片素材，並可選直接指派
            if 'file' not in request.files or request.files['file'].filename == '':
                print("錯誤：未選擇檔案進行上傳。")
                return redirect(url_for('admin_page'))
            file = request.files['file']

            if not section_key_from_form: # 必須指定區塊
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

                # 1. 創建媒體素材記錄 (不含 section_key)
                new_material_id = str(uuid.uuid4())
                new_material_item = {
                    "id": new_material_id,
                    "filename": unique_filename,
                    "type": media_type_action,
                    "url": f"/{UPLOAD_FOLDER}/{unique_filename}"
                }
                media_items_db.append(new_material_item)
                print(f"新的媒體素材已建立: {new_material_item}")

                # 2. 創建直接指派記錄 (累加，不覆蓋其他同 section_key 的 single_media 指派)
                new_assignment_id = str(uuid.uuid4())
                new_assignment_item = {
                    "id": new_assignment_id,
                    "type": "section_assignment",
                    "section_key": section_key_from_form,
                    "content_source_type": "single_media",
                    "media_id": new_material_id
                }
                media_items_db.append(new_assignment_item)
                print(f"新的直接指派已建立: {new_assignment_item}")
                
                save_media_data(media_items_db)
                socketio.emit('media_updated', {'message': f'{media_type_action} 已上傳並指派!'}, namespace='/')
                return redirect(url_for('admin_page'))
            else:
                print(f"不允許的檔案類型或檔案有問題: {file.filename}")
                return redirect(url_for('admin_page'))

        elif media_type_action == 'carousel_reference': # 操作：指派輪播群組到中間輪播區塊 (覆蓋性)
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

            # 覆蓋邏輯：移除目標 section_key 之前的所有 section_assignment
            items_to_keep_after_overwrite = []
            for item in media_items_db:
                if not (item.get('type') == 'section_assignment' and item.get('section_key') == section_key_from_form):
                    items_to_keep_after_overwrite.append(item)
                else:
                    print(f"訊息：輪播組指派給 {section_key_from_form}，將移除舊的指派項目：{item}")
            
            new_assignment_id = str(uuid.uuid4())
            new_group_assignment_item = {
                "id": new_assignment_id,
                "type": "section_assignment",
                "section_key": section_key_from_form,
                "content_source_type": "group_reference",
                "group_id": group_id_referenced,
                "offset": offset
            }
            items_to_keep_after_overwrite.append(new_group_assignment_item)
            print(f"新的輪播組指派已建立: {new_group_assignment_item}")
            
            save_media_data(items_to_keep_after_overwrite)
            socketio.emit('media_updated', {'message': '輪播組已指派!'}, namespace='/')
            return redirect(url_for('admin_page'))
        else:
            print(f"未知的操作類型: {media_type_action}")
            return redirect(url_for('admin_page'))
    return redirect(url_for('admin_page'))

@app.route('/admin/delete/<item_id_to_delete>', methods=['POST']) # Renamed media_id to item_id_to_delete
def delete_media_item(item_id_to_delete):
    media_items = load_media_data()
    final_list_after_delete = []
    item_deleted = False
    deleted_item_details = None

    # 遍歷查找並移除目標項目，同時處理相關聯的刪除
    for item in media_items:
        if item['id'] == item_id_to_delete:
            item_deleted = True
            deleted_item_details = item.copy() # 保存被刪除項目的信息以供後續處理
            print(f"找到並準備刪除項目: {deleted_item_details}")
            # 不立即加入 final_list_after_delete，即為刪除
            continue # 跳過此項目
        final_list_after_delete.append(item)
    
    if not item_deleted:
        print(f"錯誤: 找不到 ID 為 {item_id_to_delete} 的媒體項目來刪除。")
        return redirect(url_for('admin_page'))

    item_type = deleted_item_details.get('type')

    # 如果刪除的是圖片或影片素材，還需要：
    # 1. 從所有輪播組的 image_ids 中移除此素材ID
    # 2. 刪除引用此素材的 section_assignment (single_media)
    # 3. 刪除實體檔案
    if item_type in ['image', 'video']:
        temp_list = []
        for item in final_list_after_delete: # 迭代已經移除了目標素材的列表
            if item.get('type') == 'carousel_group' and deleted_item_details['id'] in item.get('image_ids', []):
                print(f"從輪播組 '{item.get('name')}' 中移除圖片素材 ID: {deleted_item_details['id']}")
                item['image_ids'].remove(deleted_item_details['id'])
            
            if item.get('type') == 'section_assignment' and \
               item.get('content_source_type') == 'single_media' and \
               item.get('media_id') == deleted_item_details['id']:
                print(f"移除對已刪除素材 {deleted_item_details['id']} 的直接指派: {item}")
                continue # 不將這個指派加入到最終列表
            temp_list.append(item)
        final_list_after_delete = temp_list

        # 刪除實體檔案
        filename_to_delete = deleted_item_details.get('filename')
        if filename_to_delete:
            filepath_to_delete = os.path.join(app.config['UPLOAD_FOLDER'], filename_to_delete)
            if os.path.exists(filepath_to_delete):
                try:
                    os.remove(filepath_to_delete)
                    print(f"實體檔案已成功刪除: {filepath_to_delete}")
                except OSError as e:
                    print(f"刪除實體檔案失敗: {filepath_to_delete}, 錯誤: {e}")
            else:
                print(f"警告: 嘗試刪除的實體檔案不存在: {filepath_to_delete}")

    # 如果刪除的是輪播組定義
    elif item_type == 'carousel_group':
        temp_list = []
        for item in final_list_after_delete:
            if item.get('type') == 'section_assignment' and \
               item.get('content_source_type') == 'group_reference' and \
               item.get('group_id') == deleted_item_details['id']:
                print(f"移除對已刪除輪播組 {deleted_item_details['id']} 的指派: {item}")
                continue
            temp_list.append(item)
        final_list_after_delete = temp_list
        print(f"輪播圖片組 '{deleted_item_details.get('name')}' (ID: {item_id_to_delete}) 的定義已被刪除。")

    # 如果刪除的是一個 section_assignment (無論是 single_media 還是 group_reference)
    elif item_type == 'section_assignment':
        print(f"區塊指派項目 (ID: {item_id_to_delete}) 已被刪除。")
        # 不需要額外操作，因為它已經從 final_list_after_delete 中被排除了

    save_media_data(final_list_after_delete)
    socketio.emit('media_updated', {'message': '項目已刪除!'}, namespace='/')
    return redirect(url_for('admin_page'))


@app.route('/api/media', methods=['GET'])
def get_media():
    media_items_db = load_media_data()
    
    materials = {item['id']: item for item in media_items_db if item.get('type') in ['image', 'video']}
    groups = {item['id']: item for item in media_items_db if item.get('type') == 'carousel_group'}
    assignments = [item for item in media_items_db if item.get('type') == 'section_assignment']
    
    # print(f"DEBUG /api/media: materials={materials}")
    # print(f"DEBUG /api/media: groups={groups}")
    # print(f"DEBUG /api/media: assignments={assignments}")

    processed_media_for_frontend = []
    
    # 每個區塊的內容列表
    section_content_map = {} # key: section_key, value: list of media objects for frontend

    # 優先處理輪播組指派，因為它們會覆蓋
    group_assigned_sections = set()
    for assign in assignments:
        if assign.get('content_source_type') == 'group_reference':
            section_key = assign.get('section_key')
            group_id = assign.get('group_id')
            offset = assign.get('offset', 0)
            group_def = groups.get(group_id)

            if section_key and group_def:
                group_assigned_sections.add(section_key) # 標記此區塊已被群組指派
                current_section_images = []
                image_ids_in_group = group_def.get('image_ids', [])
                if image_ids_in_group:
                    effective_offset = offset % len(image_ids_in_group)
                    ordered_image_ids = image_ids_in_group[effective_offset:] + image_ids_in_group[:effective_offset]
                    for img_id in ordered_image_ids:
                        material = materials.get(img_id)
                        if material and material.get('type') == 'image': # 假設輪播組目前只支持圖片
                            current_section_images.append({
                                "id": material.get("id"),
                                "filename": material.get("filename"),
                                "type": "image", # 前端輪播期望的類型
                                "url": material.get("url"),
                                "section_key": section_key
                            })
                section_content_map[section_key] = current_section_images
            else:
                print(f"警告 (/api/media): 輪播指派 {assign.get('id')} 引用了無效的組ID {group_id} 或無效的 section_key {section_key}")


    # 處理直接指派的單一媒體 (累加到對應區塊，除非該區塊已被輪播組覆蓋)
    for assign in assignments:
        if assign.get('content_source_type') == 'single_media':
            section_key = assign.get('section_key')
            media_id = assign.get('media_id')
            material = materials.get(media_id)

            if section_key and material:
                # 如果此區塊未被輪播組指派 (即可以累加單一媒體)
                if section_key not in group_assigned_sections:
                    if section_key not in section_content_map:
                        section_content_map[section_key] = []
                    
                    section_content_map[section_key].append({
                        "id": material.get("id"),
                        "filename": material.get("filename"),
                        "type": material.get("type"), # image or video
                        "url": material.get("url"),
                        "section_key": section_key
                    })
            else:
                print(f"警告 (/api/media): 直接指派 {assign.get('id')} 引用了無效的素材ID {media_id} 或無效的 section_key {section_key}")

    # 將 section_content_map 中的內容展開到最終列表
    for section_key, content_list in section_content_map.items():
        # 如果一個區塊有多個 single_media，前端 animation.js 需要能處理這個列表並輪播
        # 如果是輪播組，content_list 已經是排序好的圖片列表
        processed_media_for_frontend.extend(content_list)
        
    # print(f"DEBUG /api/media - processed_media_for_frontend: {json.dumps(processed_media_for_frontend, indent=2, ensure_ascii=False)}")
    return jsonify(processed_media_for_frontend)

# create_carousel_group, update_carousel_group_images, delete_carousel_group, get_status, admin_page, socketio handlers 保持不變
# (但 delete_carousel_group 也需要更新以刪除相關的 section_assignment)
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
                # 在更新前，驗證所有 new_image_ids 是否都存在於 media_items 中且類型為 image
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
            socketio.emit('media_updated', {'message': f'Carousel group {group_id} images updated!'}, namespace='/')
            return jsonify({'success': True, 'message': '圖片順序已成功儲存'})
        else:
            return jsonify({'success': False, 'message': '找不到指定的輪播圖片組'}), 404
    return jsonify({'success': False, 'message': '只允許 POST 請求'}), 405

@app.route('/admin/carousel_group/delete/<group_id_to_delete>', methods=['POST'])
def delete_carousel_group(group_id_to_delete): # Renamed group_id
    media_items = load_media_data()
    final_list = []
    group_deleted = False
    deleted_group_name = "未知群組"

    for item in media_items:
        if item.get('id') == group_id_to_delete and item.get('type') == 'carousel_group':
            group_deleted = True
            deleted_group_name = item.get('name', group_id_to_delete)
            print(f"找到並準備刪除輪播組: {deleted_group_name} (ID: {group_id_to_delete})")
            # 不加入 final_list 即為刪除
        elif item.get('type') == 'section_assignment' and \
             item.get('content_source_type') == 'group_reference' and \
             item.get('group_id') == group_id_to_delete:
            print(f"同時移除對已刪除輪播組 {group_id_to_delete} 的指派: {item}")
            # 不加入 final_list 即為刪除此指派
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

@app.route('/admin', methods=['GET'])
def admin_page():
    media_items = load_media_data()
    return render_template('admin.html', media_items=media_items, available_sections=AVAILABLE_SECTIONS)

@socketio.on('connect', namespace='/')
def handle_connect():
    print('一個客戶端已連接到 WebSocket')

@socketio.on('disconnect', namespace='/')
def handle_disconnect():
    print('一個客戶端已斷開 WebSocket 連線')

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0:
        save_media_data([])
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, allow_unsafe_werkzeug=True)
