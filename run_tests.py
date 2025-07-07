#!/usr/bin/env python3
"""
測試執行腳本
用於執行專案的所有測試
"""
import sys
import subprocess
import os


def main():
    """執行測試的主函數"""
    print("🚀 開始執行 mq-cms 後端測試...")
    print("=" * 60)
    
    # 確保在正確的目錄
    if not os.path.exists('app.py'):
        print("❌ 錯誤：請在專案根目錄執行此腳本")
        sys.exit(1)
    
    # 檢查是否在虛擬環境中
    if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("⚠️  警告：建議在虛擬環境中執行測試")
    
    try:
        # 執行 pytest
        cmd = [sys.executable, '-m', 'pytest', 'tests/', '-v', '--tb=short']
        
        print(f"執行命令: {' '.join(cmd)}")
        print("-" * 60)
        
        result = subprocess.run(cmd, check=False)
        
        print("-" * 60)
        if result.returncode == 0:
            print("✅ 所有測試通過！")
        else:
            print(f"❌ 測試失敗，返回碼: {result.returncode}")
            
        return result.returncode
        
    except FileNotFoundError:
        print("❌ 錯誤：找不到 pytest，請確保已安裝 pytest")
        print("安裝命令：pip install pytest pytest-flask")
        return 1
    except Exception as e:
        print(f"❌ 執行測試時發生錯誤: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
