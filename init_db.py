# init_db.py
from app import app, db, User
from werkzeug.security import generate_password_hash
import os

DB_FILE = "users.db"

def init_db():
    # 刪除舊的資料庫檔案（可選，用於完全重置）
    if os.path.exists(DB_FILE):
        print(f"找到舊的資料庫檔案 {DB_FILE}，將其刪除...")
        os.remove(DB_FILE)
        print("舊資料庫已刪除。")

    # 建立所有資料表
    print("正在建立資料庫與資料表...")
    db.create_all()
    print("資料表建立完成。")

    # 檢查是否已有 admin 使用者
    admin_user = User.query.filter_by(username='admin').first()

    if not admin_user:
        print("找不到預設 admin 使用者，正在建立...")
        # 密碼 'password' 經過雜湊處理
        hashed_password = generate_password_hash('password', method='pbkdf2:sha256')
        
        new_admin = User(
            username='admin', 
            password_hash=hashed_password, 
            role='administrator'
        )
        
        db.session.add(new_admin)
        db.session.commit()
        print("預設管理員帳號 'admin' 已成功建立。")
        print("預設密碼為: password")
        print("!!! 安全警告：請在首次登入後立即更改密碼或建立新管理員並刪除此帳號 !!!")
    else:
        print("預設 admin 使用者已存在，無需操作。")

if __name__ == '__main__':
    # 使用 app context 來確保資料庫操作在正確的環境下執行
    with app.app_context():
        init_db()