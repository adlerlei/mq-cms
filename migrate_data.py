from app import app, db, Material, CarouselGroup, Assignment, GroupImageAssociation, UPLOAD_FOLDER
import json
import os

OLD_MEDIA_FILE = 'media.json'

def migrate_data():
    print(f"\n--- 開始資料遷移 (從 {OLD_MEDIA_FILE} 到資料庫) ---")

    if not os.path.exists(OLD_MEDIA_FILE):
        print(f"錯誤: 找不到舊的媒體檔案 {OLD_MEDIA_FILE}。請確認檔案是否存在於專案根目錄。")
        return

    try:
        with open(OLD_MEDIA_FILE, 'r', encoding='utf-8') as f:
            old_data = json.load(f)
        print(f"成功讀取 {len(old_data)} 條舊資料。")
    except json.JSONDecodeError:
        print(f"錯誤: 無法解析 {OLD_MEDIA_FILE}。請確認其為有效的 JSON 格式。")
        return
    except Exception as e:
        print(f"讀取舊資料時發生錯誤: {e}")
        return

    # 儲存已遷移的物件，以便後續關聯
    migrated_materials = {}
    migrated_groups = {}

    # 步驟 1: 遷移 Material (圖片和影片)
    print("\n--- 遷移媒體素材 ---")
    for item in old_data:
        if item.get('type') in ['image', 'video']:
            # 檢查是否已存在，避免重複遷移
            if Material.query.get(item['id']):
                print(f"素材 {item['id']} 已存在，跳過。")
                migrated_materials[item['id']] = Material.query.get(item['id'])
                continue

            new_material = Material(
                id=item['id'],
                original_filename=item.get('original_filename', item['filename']),
                filename=item['filename'],
                type=item['type'],
                url=item['url'],
                source=item.get('source', 'global') # 預設為 global
            )
            db.session.add(new_material)
            migrated_materials[item['id']] = new_material
            print(f"已遷移素材: {new_material.original_filename} ({new_material.id})")
    db.session.flush() # 確保 ID 在 session 中可用

    # 步驟 2: 遷移 CarouselGroup (輪播群組) 及圖片關聯
    print("\n--- 遷移輪播群組 ---")
    for item in old_data:
        if item.get('type') == 'carousel_group':
            if CarouselGroup.query.get(item['id']):
                print(f"群組 {item['id']} 已存在，跳過。")
                migrated_groups[item['id']] = CarouselGroup.query.get(item['id'])
                continue

            new_group = CarouselGroup(
                id=item['id'],
                name=item['name']
            )
            db.session.add(new_group)
            migrated_groups[item['id']] = new_group
            print(f"已遷移群組: {new_group.name} ({new_group.id})")

            # 處理圖片關聯和順序
            if 'image_ids' in item and item['image_ids']:
                for index, image_id in enumerate(item['image_ids']):
                    if image_id in migrated_materials:
                        new_assoc = GroupImageAssociation(
                            group_id=new_group.id,
                            material_id=image_id,
                            order=index
                        )
                        db.session.add(new_assoc)
                        print(f"  - 已為群組 {new_group.name} 添加圖片 {image_id} (順序: {index})")
                    else:
                        print(f"  - 警告: 群組 {new_group.name} 中的圖片 {image_id} 未找到或未遷移。")
    db.session.flush() # 確保 ID 在 session 中可用

    # 步驟 3: 遷移 Assignment (內容指派)
    print("\n--- 遷移內容指派 ---")
    for item in old_data:
        if item.get('type') == 'section_assignment':
            # 檢查是否已存在，避免重複遷移
            if Assignment.query.get(item['id']):
                print(f"指派 {item['id']} 已存在，跳過。")
                continue

            new_assignment = Assignment(
                id=item['id'],
                section_key=item['section_key'],
                content_source_type=item['content_source_type'],
                offset=item.get('offset', 0)
            )

            if new_assignment.content_source_type == 'single_media':
                if item['media_id'] in migrated_materials:
                    new_assignment.media_id = item['media_id']
                else:
                    print(f"  - 警告: 指派 {item['id']} 中的素材 {item['media_id']} 未找到或未遷移，跳過此指派。")
                    continue
            elif new_assignment.content_source_type == 'group_reference':
                if item['group_id'] in migrated_groups:
                    new_assignment.group_id = item['group_id']
                else:
                    print(f"  - 警告: 指派 {item['id']} 中的群組 {item['group_id']} 未找到或未遷移，跳過此指派。")
                    continue
            
            db.session.add(new_assignment)
            print(f"已遷移指派: {new_assignment.section_key} ({new_assignment.id})")

    try:
        db.session.commit()
        print("\n--- 資料遷移完成！所有資料已成功寫入資料庫。---")
    except Exception as e:
        db.session.rollback()
        print(f"\n--- 資料遷移失敗: {e} ---")

if __name__ == '__main__':
    with app.app_context():
        migrate_data()
