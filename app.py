# # 匯入 Flask 套件以及 render_template, jsonify, request, redirect, url_for
# from flask import Flask, jsonify, render_template, request, redirect, url_for
# from flask_cors import CORS
# from flask_socketio import SocketIO
# from werkzeug.utils import secure_filename
# import os
# import json
# import uuid # 確保 uuid 已匯入

# # 建立 Flask 應用程式實例
# app = Flask(__name__)
# CORS(app) 

# socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*")

# UPLOAD_FOLDER = 'static/uploads'
# app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}

# MEDIA_FILE = 'media.json'

# AVAILABLE_SECTIONS = {
#     "header_video": "頁首影片 (單一影片)",
#     "carousel_top_left": "中間左上輪播",
#     "carousel_top_right": "中間右上輪播",
#     "carousel_bottom_left": "中間左下輪播",
#     "carousel_bottom_right": "中間右下輪播",
#     "footer_content": "頁尾內容 (影片/圖片/輪播)"
# }

# def allowed_file(filename):
#     return '.' in filename and \
#            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# def load_media_data():
#     if not os.path.exists(MEDIA_FILE):
#         return []
#     try:
#         with open(MEDIA_FILE, 'r', encoding='utf-8') as f:
#             data = json.load(f)
#             for item in data:
#                 if 'section_key' not in item:
#                     item['section_key'] = 'uncategorized'
#             return data
#     except (IOError, json.JSONDecodeError) as e:
#         print(f"讀取 media.json 錯誤: {e}")
#         return []

# def save_media_data(data):
#     try:
#         with open(MEDIA_FILE, 'w', encoding='utf-8') as f:
#             json.dump(data, f, indent=2, ensure_ascii=False)
#     except IOError as e:
#         print(f"儲存 media.json 錯誤: {e}")

# @app.route('/admin/add', methods=['POST'])
# def add_media_item():
#     if request.method == 'POST':
#         title = request.form.get('title')
#         media_type = request.form.get('type')
#         section_key = request.form.get('section_key')

#         if not title or not media_type or not section_key:
#             print("錯誤：標題、類型或區塊未填寫完整。")
#             return redirect(url_for('admin_page'))

#         if section_key not in AVAILABLE_SECTIONS:
#             print(f"錯誤：選擇了無效的區塊 {section_key}")
#             return redirect(url_for('admin_page'))
        
#         if 'file' not in request.files:
#             print("表單中沒有檔案部分")
#             return redirect(url_for('admin_page'))
        
#         file = request.files['file']
        
#         if file.filename == '':
#             print("沒有選擇檔案")
#             return redirect(url_for('admin_page'))

#         if file and allowed_file(file.filename):
#             original_filename = secure_filename(file.filename)
#             # --- 修改點：產生唯一檔名 ---
#             name_part, extension_part = os.path.splitext(original_filename)
#             unique_suffix = str(uuid.uuid4())[:8] # 取 UUID 的前 8 個字元作為後綴
#             unique_filename = f"{name_part}_{unique_suffix}{extension_part}"
#             # ---------------------------
#             filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename) # 使用 unique_filename
            
#             try:
#                 file.save(filepath)
#                 print(f"檔案已儲存到: {filepath}")
#             except Exception as e:
#                 print(f"儲存檔案失敗: {e}")
#                 return redirect(url_for('admin_page'))

#             media_items = load_media_data()
#             new_id = str(uuid.uuid4())
            
#             new_media_item = {
#                 "id": new_id,
#                 "filename": unique_filename, # <--- 儲存唯一檔名
#                 "type": media_type,
#                 "url": f"/{UPLOAD_FOLDER}/{unique_filename}", # <--- 使用唯一檔名
#                 "title": title,
#                 "section_key": section_key
#             }
            
#             media_items.append(new_media_item)
#             save_media_data(media_items)
#             print(f"新媒體項目已加入: {new_media_item}")
            
#             socketio.emit('media_updated', {'message': 'Media content has been updated!'}, namespace='/')
#             print("已透過 WebSocket 發送 'media_updated' 事件")
            
#             return redirect(url_for('admin_page'))
#         else:
#             print(f"不允許的檔案類型或檔案有問題: {file.filename}")
#             return redirect(url_for('admin_page'))
            
#     return redirect(url_for('admin_page'))

# @app.route('/admin/delete/<media_id>', methods=['POST'])
# def delete_media_item(media_id):
#     media_items = load_media_data()
#     item_to_delete = None
#     for item in media_items:
#         if item['id'] == media_id:
#             item_to_delete = item
#             break
    
#     if item_to_delete:
#         media_items.remove(item_to_delete)
#         save_media_data(media_items)
        
#         filename_to_delete = item_to_delete.get('filename')
#         if filename_to_delete:
#             filepath_to_delete = os.path.join(app.config['UPLOAD_FOLDER'], filename_to_delete)
#             if os.path.exists(filepath_to_delete):
#                 try:
#                     os.remove(filepath_to_delete)
#                     print(f"檔案已刪除: {filepath_to_delete}")
#                 except OSError as e:
#                     print(f"刪除檔案失敗: {filepath_to_delete}, 錯誤: {e}")
#             else:
#                 print(f"警告: 嘗試刪除的檔案不存在: {filepath_to_delete}")
#         else:
#             print(f"警告: 媒體項目 {media_id} 沒有 filename 欄位。")
#         print(f"媒體項目 {media_id} 已被刪除。")
        
#         socketio.emit('media_updated', {'message': 'Media content has been updated!'}, namespace='/')
#         print("已透過 WebSocket 發送 'media_updated' 事件")
#     else:
#         print(f"錯誤: 找不到 ID 為 {media_id} 的媒體項目。")

#     return redirect(url_for('admin_page'))

# @app.route('/api/media', methods=['GET'])
# def get_media():
#     media_items = load_media_data()
#     return jsonify(media_items)

# @app.route('/api/status', methods=['GET'])
# def get_status():
#     return jsonify({'status': 'Backend is running!'})

# @app.route('/admin', methods=['GET'])
# def admin_page():
#     media_items = load_media_data()
#     return render_template('admin.html', media_items=media_items, available_sections=AVAILABLE_SECTIONS)

# @socketio.on('connect', namespace='/')
# def handle_connect():
#     print('一個客戶端已連接到 WebSocket')

# @socketio.on('disconnect', namespace='/')
# def handle_disconnect():
#     print('一個客戶端已斷開 WebSocket 連線')

# if __name__ == '__main__':
#     if not os.path.exists(MEDIA_FILE):
#         initial_media_data = [] # 從一個空的 media.json 開始，避免範例資料干擾
#         save_media_data(initial_media_data)
        
#     if not os.path.exists(UPLOAD_FOLDER):
#         os.makedirs(UPLOAD_FOLDER)
#         print(f"已建立資料夾: {UPLOAD_FOLDER}")

#     print("準備啟動 SocketIO 伺服器...")
#     socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, allow_unsafe_werkzeug=True)

# 匯入 Flask 套件以及 render_template, jsonify, request, redirect, url_for

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

MEDIA_FILE = 'media.json' # 媒體資料檔案路徑

AVAILABLE_SECTIONS = {
    "header_video": "頁首影片 (單一影片)",
    "carousel_top_left": "中間左上輪播",
    "carousel_top_right": "中間右上輪播",
    "carousel_bottom_left": "中間左下輪播",
    "carousel_bottom_right": "中間右下輪播",
    "footer_content": "頁尾內容 (影片/圖片/輪播)"
}

def allowed_file(filename):
    """檢查檔案副檔名是否在允許的清單中"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_media_data():
    """從 media.json 載入媒體資料"""
    if not os.path.exists(MEDIA_FILE):
        return []
    try:
        # 先檢查檔案大小，如果為 0，直接回傳空列表，避免 json.load 錯誤
        if os.path.getsize(MEDIA_FILE) == 0:
            print(f"警告: {MEDIA_FILE} 檔案為空。")
            return []
        with open(MEDIA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # 確保舊資料的 section_key
            for item in data:
                if 'section_key' not in item:
                    item['section_key'] = 'uncategorized'
            return data
    except json.JSONDecodeError as e: # 更明確捕捉 JSON 解析錯誤
        print(f"讀取 media.json 錯誤 (JSONDecodeError): {e} - 檔案內容可能不是有效的 JSON。")
        return []
    except IOError as e: # 捕捉其他可能的檔案讀寫錯誤
        print(f"讀取 media.json 錯誤 (IOError): {e}")
        return []
    except Exception as e: # 捕捉其他未知錯誤
        print(f"讀取 media.json 時發生未知錯誤: {e}")
        return []


def save_media_data(data):
    """將媒體資料儲存到 media.json"""
    try:
        with open(MEDIA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"儲存 media.json 錯誤: {e}")

@app.route('/admin/add', methods=['POST'])
def add_media_item():
    if request.method == 'POST':
        media_type = request.form.get('type')
        section_key = request.form.get('section_key')

        if not media_type or not section_key:
            print("錯誤：類型或區塊未填寫完整。")
            return redirect(url_for('admin_page'))

        if section_key not in AVAILABLE_SECTIONS:
            print(f"錯誤：選擇了無效的區塊 {section_key}")
            return redirect(url_for('admin_page'))
        
        if 'file' not in request.files:
            print("表單中沒有檔案部分")
            return redirect(url_for('admin_page'))
        
        file = request.files['file']
        
        if file.filename == '':
            print("沒有選擇檔案")
            return redirect(url_for('admin_page'))

        if file and allowed_file(file.filename):
            original_filename = secure_filename(file.filename)
            name_part, extension_part = os.path.splitext(original_filename)
            unique_suffix = str(uuid.uuid4())[:8] 
            unique_filename = f"{name_part}_{unique_suffix}{extension_part}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            try:
                file.save(filepath)
                print(f"檔案已儲存到: {filepath}")
            except Exception as e:
                print(f"儲存檔案失敗: {e}")
                return redirect(url_for('admin_page'))

            media_items = load_media_data()
            new_id = str(uuid.uuid4())
            
            new_media_item = {
                "id": new_id,
                "filename": unique_filename,
                "type": media_type,
                "url": f"/{UPLOAD_FOLDER}/{unique_filename}",
                "section_key": section_key
            }
            
            media_items.append(new_media_item)
            save_media_data(media_items)
            print(f"新媒體項目已加入: {new_media_item}")
            
            socketio.emit('media_updated', {'message': 'Media content has been updated!'}, namespace='/')
            print("已透過 WebSocket 發送 'media_updated' 事件")
            
            return redirect(url_for('admin_page'))
        else:
            print(f"不允許的檔案類型或檔案有問題: {file.filename}")
            return redirect(url_for('admin_page'))
            
    return redirect(url_for('admin_page'))

@app.route('/admin/delete/<media_id>', methods=['POST'])
def delete_media_item(media_id):
    media_items = load_media_data()
    item_to_delete = None
    for item in media_items:
        if item['id'] == media_id:
            item_to_delete = item
            break
    
    if item_to_delete:
        media_items.remove(item_to_delete)
        save_media_data(media_items)
        
        filename_to_delete = item_to_delete.get('filename')
        if filename_to_delete:
            filepath_to_delete = os.path.join(app.config['UPLOAD_FOLDER'], filename_to_delete)
            if os.path.exists(filepath_to_delete):
                try:
                    os.remove(filepath_to_delete)
                    print(f"檔案已刪除: {filepath_to_delete}")
                except OSError as e:
                    print(f"刪除檔案失敗: {filepath_to_delete}, 錯誤: {e}")
            else:
                print(f"警告: 嘗試刪除的檔案不存在: {filepath_to_delete}")
        else:
            print(f"警告: 媒體項目 {media_id} 沒有 filename 欄位。")
        print(f"媒體項目 {media_id} 已被刪除。")
        
        socketio.emit('media_updated', {'message': 'Media content has been updated!'}, namespace='/')
        print("已透過 WebSocket 發送 'media_updated' 事件")
    else:
        print(f"錯誤: 找不到 ID 為 {media_id} 的媒體項目。")

    return redirect(url_for('admin_page'))

@app.route('/api/media', methods=['GET'])
def get_media():
    media_items = load_media_data()
    return jsonify(media_items)

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
    # 確保 uploads 資料夾存在
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
        print(f"已建立資料夾: {UPLOAD_FOLDER}")

    # 初始化 media.json (如果不存在或為空，則寫入 [])
    if not os.path.exists(MEDIA_FILE) or os.path.getsize(MEDIA_FILE) == 0:
        save_media_data([]) # 確保檔案存在且包含有效的空 JSON 陣列
        print(f"已初始化空的 {MEDIA_FILE}")
        
    print("準備啟動 SocketIO 伺服器...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, allow_unsafe_werkzeug=True)
