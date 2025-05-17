// 確保在 DOM 完全載入後執行腳本
document.addEventListener('DOMContentLoaded', () => {
    // 選取檔案輸入框和檔案名稱顯示元素
    const fileInput = document.querySelector('.file-input');
    const fileNameDisplay = document.querySelector('.file-name');

    // 當檔案選擇變更時，更新顯示的檔案名稱
    if (fileInput && fileNameDisplay) {
        fileInput.onchange = () => {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = fileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = '未選擇任何檔案';
            }
        };
    }

    // 選取上傳表單和進度條相關元素
    const uploadForm = document.getElementById('uploadForm');
    const progressBarContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const submitButton = uploadForm ? uploadForm.querySelector('button[type="submit"]') : null;


    if (uploadForm && progressBarContainer && progressBar && progressText && submitButton) {
        // 監聽表單提交事件
        uploadForm.addEventListener('submit', function(event) {
            // 檢查 HTML5 驗證是否通過 (雖然瀏覽器會先擋，但可以做個雙重保險或處理更複雜邏輯)
            // 對於純粹依賴 HTML5 required 的情況，這裡的檢查可以簡化或移除
            if (!uploadForm.checkValidity()) {
                // 如果表單驗證未通過，可以選擇在這裡添加一些自訂邏輯
                // 但通常瀏覽器會阻止事件的進一步傳播並顯示原生提示
                console.warn('HTML5 表單驗證未通過。');
                // event.preventDefault(); // 如果需要完全阻止，但通常不需要，瀏覽器會處理
                return; // 阻止後續的 AJAX 提交
            }

            event.preventDefault(); // 防止表單的預設提交行為 (如果 HTML5 驗證通過了才執行 AJAX)

            // --- 移除了原本的 JavaScript 檔案選擇檢查 ---
            // if (fileInput.files.length === 0) {
            //     alert('請先選擇一個檔案！');
            //     return;
            // }
            // --- ------------------------------------ ---

            // 顯示進度條容器並禁用提交按鈕
            progressBarContainer.style.display = 'block';
            progressBar.value = 0;
            progressText.textContent = '0%';
            submitButton.classList.add('is-loading'); // 添加 Bulma 的載入中樣式
            submitButton.disabled = true; // 禁用按鈕防止重複提交

            const formData = new FormData(uploadForm); // 建立 FormData 物件以包含表單數據
            const xhr = new XMLHttpRequest(); // 建立 XMLHttpRequest 物件

            // 監聽上傳進度
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentage = Math.round((e.loaded / e.total) * 100); // 計算上傳百分比
                    progressBar.value = percentage; // 更新進度條的值
                    progressText.textContent = percentage + '%'; // 更新進度文字
                }
            });

            // 監聽上傳完成事件
            xhr.addEventListener('load', function() {
                progressBar.value = 100; // 確保進度條達到100%
                progressText.textContent = '100%';
                submitButton.classList.remove('is-loading'); // 移除載入中樣式
                submitButton.disabled = false; // 重新啟用按鈕

                if (xhr.status === 200 || xhr.status === 302) { // 302 是因為 Flask redirect
                    console.log('上傳成功，正在重新載入頁面...');
                    window.location.reload(); // 重新載入頁面以更新媒體列表
                } else {
                    console.error('上傳失敗:', xhr.status, xhr.responseText);
                    alert(`上傳失敗: ${xhr.status} - ${xhr.statusText || '未知錯誤'}`);
                    setTimeout(() => {
                        progressBarContainer.style.display = 'none';
                    }, 2000);
                }
            });

            // 監聽上傳錯誤事件
            xhr.addEventListener('error', function() {
                console.error('上傳過程中發生網路錯誤。');
                alert('上傳過程中發生網路錯誤，請檢查您的網路連線。');
                submitButton.classList.remove('is-loading');
                submitButton.disabled = false;
                setTimeout(() => {
                    progressBarContainer.style.display = 'none';
                }, 2000);
            });

            // 監聽上傳中止事件
            xhr.addEventListener('abort', function() {
                console.warn('上傳已中止。');
                submitButton.classList.remove('is-loading');
                submitButton.disabled = false;
                setTimeout(() => {
                    progressBarContainer.style.display = 'none';
                }, 1000);
            });

            xhr.open('POST', uploadForm.action, true);
            xhr.send(formData);
        });
    } else {
        if (!uploadForm) console.error('錯誤：找不到 ID 為 "uploadForm" 的表單。');
        if (!progressBarContainer) console.error('錯誤：找不到 ID 為 "upload-progress-container" 的進度條容器。');
        if (!progressBar) console.error('錯誤：找不到 ID 為 "upload-progress-bar" 的進度條。');
        if (!progressText) console.error('錯誤：找不到 ID 為 "upload-progress-text" 的進度文字元素。');
        if (!submitButton) console.error('錯誤：找不到表單中的提交按鈕。');
    }
});