# init_db.py
from app import app, db, User, Setting, Material, CarouselGroup, Assignment
from werkzeug.security import generate_password_hash
import os

DB_FILE = "mq_cms.db"

def init_db():
    """初始化資料庫，建立所有資料表，並建立預設使用者和設定。"""
    # 刪除舊的資料庫檔案（可選，用於完全重置）
    if os.path.exists(DB_FILE):
        print(f"找到舊的資料庫檔案 {DB_FILE}，將其刪除...")
        os.remove(DB_FILE)
        print("舊資料庫已刪除。")

    # 建立所有資料表
    print("正在建立所有資料庫資料表...")
    db.create_all()
    print("資料表建立完成。")

    # 建立預設 admin 使用者
    if not User.query.filter_by(username='admin').first():
        print("正在建立預設 admin 使用者...")
        hashed_password = generate_password_hash('password', method='pbkdf2:sha256')
        new_admin = User(username='admin', password_hash=hashed_password, role='admin')
        db.session.add(new_admin)
        print("預設管理員帳號 'admin' 已成功建立，密碼為 'password'。")
    else:
        print("預設 admin 使用者已存在。")

    # 建立預設播放設定
    if not Setting.query.first():
        print("正在建立預設播放設定...")
        default_settings = [
            Setting(key='header_interval', value='5'),
            Setting(key='carousel_interval', value='6'),
            Setting(key='footer_interval', value='7')
        ]
        db.session.bulk_save_objects(default_settings)
        print("預設播放設定已成功建立。")
    else:
        print("播放設定已存在。")
    
    db.session.commit()
    print("資料庫初始化完成。")

if __name__ == '__main__':
    # 使用 app context 來確保資料庫操作在正確的環境下執行
    with app.app_context():
        init_db()