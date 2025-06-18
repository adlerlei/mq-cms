// 確保在 DOM 完全載入後執行腳本
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // Task 3: 使用者認證與 API 請求處理 (Authentication & API Handling)
    // =========================================================================

    const JWT_TOKEN = localStorage.getItem('jwt_token');
    const authCheckingScreen = document.getElementById('authCheckingScreen');
    const mainContent = document.getElementById('mainContent');

    // 路由守衛 (Route Guard): 如果沒有 token，立即重導向到登入頁面
    if (!JWT_TOKEN) {
        // 假設後端 Flask 的登入頁面路由是 /login
        window.location.href = '/login';
        // 停止執行此腳本的任何後續程式碼，因為使用者未經授權
        return;
    }

    // 認證通過，顯示主要內容並隱藏載入畫面
    function showMainContent() {
        if (authCheckingScreen) authCheckingScreen.style.display = 'none';
        if (mainContent) {
            mainContent.classList.add('authenticated');
            mainContent.style.display = 'block';
        }
    }

    // 立即顯示主要內容（因為已經有 token）
    showMainContent();

    /**
     * API 請求封裝 (API Request Wrapper)
     * 一個輔助函數，用於發送帶有 JWT 認證標頭的 fetch 請求。
     * 它會自動處理 401 (未授權) 錯誤，將使用者登出並重導向。
     * @param {string} url - The URL to fetch.
     * @param {object} options - Options for the fetch request (e.g., method, body).
     * @returns {Promise<Response>} - The fetch response promise.
     */
    async function fetchWithAuth(url, options = {}) {
        // 準備請求標頭，加入 Authorization
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${JWT_TOKEN}`
        };

        // 如果請求主體不是 FormData，則設定 Content-Type 為 application/json
        // (fetch 會為 FormData 自動設定正確的 multipart/form-data 標頭)
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, { ...options, headers });

        // 檢查 Token 是否失效
        if (response.status === 401) {
            localStorage.removeItem('jwt_token');
            alert('您的登入已逾期或無效，請重新登入。');
            window.location.href = '/login';
            // 拋出錯誤以中斷當前的 try...catch 鏈
            throw new Error('Unauthorized');
        }

        return response;
    }
    
    // 登出按鈕事件監聽
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('jwt_token');
            window.location.href = '/login';
        });
    }

    // =========================================================================
    // 新增：全局播放設定表單處理 (New: Global Settings Form Handling)
    // =========================================================================
    const globalSettingsForm = document.getElementById('globalSettingsForm');
    const saveSettingsButton = document.getElementById('saveSettingsButton');
    const settingsNotification = document.getElementById('settings-notification');

    if (globalSettingsForm) {
        globalSettingsForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // 阻止表單預設的刷新頁面行為

            saveSettingsButton.classList.add('is-loading');
            saveSettingsButton.disabled = true;
            settingsNotification.classList.add('is-hidden');

            const payload = {
                header_interval: document.getElementById('header_interval').value,
                carousel_interval: document.getElementById('carousel_interval').value,
                footer_interval: document.getElementById('footer_interval').value
            };

            try {
                const response = await fetchWithAuth('/admin/settings/update', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok) {
                    settingsNotification.textContent = data.message || '設定儲存成功！';
                    settingsNotification.classList.remove('is-hidden', 'is-danger');
                    settingsNotification.classList.add('is-success');
                } else {
                    throw new Error(data.message || '儲存設定失敗。');
                }

            } catch (error) {
                if (error.message !== 'Unauthorized') {
                    settingsNotification.textContent = error.message;
                    settingsNotification.classList.remove('is-hidden', 'is-success');
                    settingsNotification.classList.add('is-danger');
                }
            } finally {
                saveSettingsButton.classList.remove('is-loading');
                saveSettingsButton.disabled = false;
                 // 3秒後自動隱藏提示訊息
                setTimeout(() => {
                    settingsNotification.classList.add('is-hidden');
                }, 3000);
            }
        });
    }

    // =========================================================================
    // 既有功能：檔案上傳表單 (Existing: File Upload Form)
    // =========================================================================
    
    // 選取檔案輸入框和檔案名稱顯示元素
    const fileInput = document.querySelector('.file-input');
    const fileNameDisplay = document.querySelector('.file-name');

    fileInput?.addEventListener('change', () => {
        fileNameDisplay.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : '未選擇任何檔案';
    });

    // 上傳表單和進度條相關元素
    const uploadForm = document.getElementById('uploadForm');
    const progressBarContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const uploadFormSubmitButton = uploadForm ? uploadForm.querySelector('button[type="submit"]') : null;

    function resetUploadFormState(hideDelay = 0) {
        uploadFormSubmitButton?.classList.remove('is-loading');
        if (uploadFormSubmitButton) uploadFormSubmitButton.disabled = false;
        if (hideDelay > 0) {
            setTimeout(() => { if(progressBarContainer) progressBarContainer.style.display = 'none'; }, hideDelay);
        } else if (progressBarContainer) {
            progressBarContainer.style.display = 'none';
        }
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', function(event) {
            event.preventDefault(); // 阻止表單預設提交

            if (!uploadForm.checkValidity()) {
                console.warn('HTML5 表單驗證未通過 (uploadForm)。');
                return;
            }
            
            // UI 狀態更新
            if(progressBarContainer) progressBarContainer.style.display = 'block';
            if(progressBar) progressBar.value = 0;
            if(progressText) progressText.textContent = '0%';
            uploadFormSubmitButton?.classList.add('is-loading');
            if(uploadFormSubmitButton) uploadFormSubmitButton.disabled = true;

            const formData = new FormData(uploadForm);
            const xhr = new XMLHttpRequest();

            // 上傳進度監聽
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentage = Math.round((e.loaded / e.total) * 100);
                    if(progressBar) progressBar.value = percentage;
                    if(progressText) progressText.textContent = percentage + '%';
                }
            });

            // 上傳完成後的回呼
            xhr.addEventListener('load', function() {
                resetUploadFormState();
                
                // **認證修改**: 處理 401 錯誤
                if (xhr.status === 401) {
                    localStorage.removeItem('jwt_token');
                    alert('您的登入已逾期或無效，請重新登入。');
                    window.location.href = '/login';
                    return;
                }

                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log('操作成功 (uploadForm)，正在重新載入頁面...');
                    window.location.reload();
                } else {
                    console.error('操作失敗 (uploadForm):', xhr.status, xhr.responseText);
                    alert(`操作失敗: ${xhr.status} - ${xhr.responseText || '未知錯誤'}`);
                }
            });
            
            xhr.addEventListener('error', function() {
                console.error('上傳過程中發生網路錯誤。');
                alert('上傳過程中發生網路錯誤，請檢查您的網路連線。');
                resetUploadFormState(2000);
            });

            xhr.addEventListener('abort', function() {
                console.warn('上傳已中止。');
                resetUploadFormState(1000);
            });
            
            xhr.open('POST', uploadForm.action, true);
            // **認證修改**: 在 XHR 請求中加入 Authorization 標頭
            xhr.setRequestHeader('Authorization', `Bearer ${JWT_TOKEN}`);
            xhr.send(formData);
        });
    }

    // =========================================================================
    // 既有功能：輪播圖片組 Modal (Existing: Carousel Group Modal)
    // =========================================================================
    const editCarouselGroupModal = document.getElementById('editCarouselGroupModal');
    const modalGroupName = document.getElementById('modalGroupName');
    const modalGroupIdInput = document.getElementById('modalGroupId');
    const selectedImagesListDiv = document.getElementById('selectedImagesList');
    const availableImagesListDiv = document.getElementById('availableImagesList');
    const saveGroupChangesButton = document.getElementById('saveGroupChangesButton');

    function openCarouselModal() { if(editCarouselGroupModal) editCarouselGroupModal.classList.add('is-active'); }
    function closeCarouselModal() { if(editCarouselGroupModal) editCarouselGroupModal.classList.remove('is-active'); }

    // 開啟編輯輪播組 Modal
    document.querySelectorAll('.edit-group-images-button').forEach(button => {
        button.addEventListener('click', function() {
            const groupId = this.dataset.groupId;
            const groupName = this.dataset.groupName;
            if(modalGroupIdInput) modalGroupIdInput.value = groupId;
            if(modalGroupName) modalGroupName.textContent = groupName;
            populateAvailableImages(groupId);
            populateSelectedImages(groupId);
            openCarouselModal();
        });
    });

    // 關閉 Modal 的所有方式
    editCarouselGroupModal?.querySelector('.delete')?.addEventListener('click', closeCarouselModal);
    editCarouselGroupModal?.querySelector('#cancelGroupChangesButton')?.addEventListener('click', closeCarouselModal);
    editCarouselGroupModal?.querySelector('.modal-background')?.addEventListener('click', closeCarouselModal);

    // 儲存輪播組變更
    if (saveGroupChangesButton) {
        saveGroupChangesButton.addEventListener('click', async function() {
            const groupId = modalGroupIdInput.value;
            const selectedImageElements = selectedImagesListDiv?.querySelectorAll('.media-item-entry.draggable-item') || [];
            const imageIdsInOrder = Array.from(selectedImageElements).map(el => el.dataset.imageId);

            this.classList.add('is-loading');

            try {
                // **認證修改**: 使用 fetchWithAuth
                const response = await fetchWithAuth(`/admin/carousel_group/update_images/${groupId}`, {
                    method: 'POST',
                    body: JSON.stringify({ image_ids: imageIdsInOrder }),
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || '伺服器返回錯誤');
                }
                
                // 成功後重載頁面以顯示最新狀態
                window.location.reload();

            } catch (error) {
                // 如果錯誤不是 'Unauthorized' (因為它會自己處理)，就顯示錯誤訊息
                if (error.message !== 'Unauthorized') {
                    console.error('儲存輪播組失敗:', error);
                    alert(`儲存失敗: ${error.message}`);
                }
            } finally {
                this.classList.remove('is-loading');
            }
        });
    }

    // --- 輪播組 Modal 內部相關的既有函式 (填充、新增、移除、拖曳) ---
    function populateAvailableImages(currentGroupId) {
        if(!availableImagesListDiv) return;
        availableImagesListDiv.innerHTML = '';
        const group = allMediaItemsForJS.find(item => item.id === currentGroupId && item.type === 'carousel_group');
        const selectedImageIdsInCurrentGroup = group ? group.image_ids || [] : [];

        if (availableImageSources && availableImageSources.length > 0) {
            availableImageSources.forEach(imgSrc => {
                const entryDiv = document.createElement('div');
                entryDiv.classList.add('media-item-entry');
                entryDiv.dataset.imageId = imgSrc.id;

                const imgPreview = document.createElement('img');
                imgPreview.src = imgSrc.url;
                imgPreview.alt = imgSrc.filename;
                imgPreview.classList.add('image-thumbnail');

                const fileNameSpan = document.createElement('span');
                fileNameSpan.textContent = imgSrc.filename;
                fileNameSpan.classList.add('is-flex-grow-1', 'ml-2');

                const addButton = document.createElement('button');
                addButton.classList.add('button', 'is-small', 'is-success', 'add-image-to-group-button');
                addButton.dataset.imageId = imgSrc.id;
                addButton.dataset.imageUrl = imgSrc.url;
                addButton.dataset.imageFilename = imgSrc.filename;

                if (selectedImageIdsInCurrentGroup.includes(imgSrc.id)) {
                    addButton.textContent = '已加入';
                    addButton.disabled = true;
                    addButton.classList.remove('is-success');
                    addButton.classList.add('is-light');
                } else {
                    addButton.textContent = '加入';
                    addButton.disabled = false;
                }
                entryDiv.appendChild(imgPreview);
                entryDiv.appendChild(fileNameSpan);
                entryDiv.appendChild(addButton);
                availableImagesListDiv.appendChild(entryDiv);
            });
        } else {
            availableImagesListDiv.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">沒有可用的圖片素材。</p>';
        }
    }
    function populateSelectedImages(groupId) {
        if(!selectedImagesListDiv) return;
        selectedImagesListDiv.innerHTML = '';
        const group = allMediaItemsForJS.find(item => item.id === groupId && item.type === 'carousel_group');
        if (group && group.image_ids && group.image_ids.length > 0) {
            group.image_ids.forEach(imageId => {
                const imgSrc = availableImageSources.find(src => src.id === imageId);
                if (imgSrc) {
                    addSelectedImageToDOM(imgSrc.id, imgSrc.url, imgSrc.filename);
                }
            });
        } else {
            selectedImagesListDiv.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
        }
    }
    function addSelectedImageToDOM(imageId, imageUrl, imageFilename) {
        if (selectedImagesListDiv?.querySelector(`[data-image-id="${imageId}"]`)) return;
        if (selectedImagesListDiv?.querySelector('p.has-text-grey-light')) {
            selectedImagesListDiv.innerHTML = '';
        }
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('media-item-entry', 'draggable-item');
        entryDiv.dataset.imageId = imageId;
        entryDiv.draggable = true;

        const dragHandle = document.createElement('span');
        dragHandle.innerHTML = '&#x2630; ';
        dragHandle.style.cursor = 'grab';
        dragHandle.style.marginRight = '8px';

        const imgPreview = document.createElement('img');
        imgPreview.src = imageUrl;
        imgPreview.alt = imageFilename;
        imgPreview.classList.add('image-thumbnail');

        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = imageFilename;
        fileNameSpan.classList.add('is-flex-grow-1', 'ml-2');

        const removeButton = document.createElement('button');
        removeButton.classList.add('button', 'is-small', 'is-danger', 'is-outlined', 'remove-image-from-group-button');
        removeButton.textContent = '移除';
        removeButton.dataset.imageId = imageId;

        entryDiv.appendChild(dragHandle);
        entryDiv.appendChild(imgPreview);
        entryDiv.appendChild(fileNameSpan);
        entryDiv.appendChild(removeButton);
        selectedImagesListDiv?.appendChild(entryDiv);

        entryDiv.addEventListener('dragstart', handleDragStart);
        entryDiv.addEventListener('dragend', handleDragEnd);
    }
    let draggedItem = null;
    let placeholder = null;
    function handleDragStart(e) {
        draggedItem = e.target.closest('.draggable-item');
        if (!draggedItem) return;
        if (e.dataTransfer) { e.dataTransfer.setData('text/plain', draggedItem.dataset.imageId); e.dataTransfer.effectAllowed = 'move'; }
        setTimeout(() => { if(draggedItem) draggedItem.classList.add('dragging'); }, 0);
    }
    function handleDragEnd() {
        if (!draggedItem) return;
        draggedItem.classList.remove('dragging');
        draggedItem = null;
        if (placeholder) { placeholder.remove(); placeholder = null; }
        selectedImagesListDiv?.classList.remove('drag-over-active');
    }
    function handleDragEnter(e) {
        e.preventDefault();
        if (draggedItem && selectedImagesListDiv?.contains(draggedItem)) {
            selectedImagesListDiv?.classList.add('drag-over-active');
        }
    }
    function handleDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget) ) {
            selectedImagesListDiv?.classList.remove('drag-over-active');
            if (placeholder) { placeholder.remove(); placeholder = null; }
        }
    }
    function handleDragOver(e) {
        e.preventDefault();
        if (!draggedItem || !selectedImagesListDiv?.contains(draggedItem)) return;
        const container = selectedImagesListDiv;
        const afterElement = getDragAfterElement(container, e.clientY);
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.classList.add('drag-placeholder');
        }
        if (afterElement) { container.insertBefore(placeholder, afterElement); } 
        else { container.appendChild(placeholder); }
    }
    function handleDrop(e) {
        e.preventDefault();
        if (!draggedItem || !selectedImagesListDiv?.contains(draggedItem)) return;
        if (placeholder?.parentNode === selectedImagesListDiv) {
            selectedImagesListDiv.insertBefore(draggedItem, placeholder);
        }
        if (placeholder) { placeholder.remove(); placeholder = null; }
        selectedImagesListDiv?.classList.remove('drag-over-active');
    }
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } 
            else { return closest; }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    selectedImagesListDiv?.addEventListener('dragover', handleDragOver);
    selectedImagesListDiv?.addEventListener('drop', handleDrop);
    selectedImagesListDiv?.addEventListener('dragenter', handleDragEnter);
    selectedImagesListDiv?.addEventListener('dragleave', handleDragLeave);
    editCarouselGroupModal?.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('add-image-to-group-button') && !target.disabled) {
            addSelectedImageToDOM(target.dataset.imageId, target.dataset.imageUrl, target.dataset.imageFilename);
            target.disabled = true; target.textContent = '已加入'; target.classList.remove('is-success'); target.classList.add('is-light');
        } else if (target.classList.contains('remove-image-from-group-button')) {
            const imageIdToRemove = target.dataset.imageId;
            const itemToRemove = selectedImagesListDiv?.querySelector(`.media-item-entry[data-image-id="${imageIdToRemove}"]`);
            if (itemToRemove) {
                itemToRemove.remove();
                const correspondingAddButton = availableImagesListDiv?.querySelector(`.add-image-to-group-button[data-image-id="${imageIdToRemove}"]`);
                if (correspondingAddButton) { correspondingAddButton.disabled = false; correspondingAddButton.textContent = '加入'; correspondingAddButton.classList.add('is-success'); correspondingAddButton.classList.remove('is-light'); }
                if (selectedImagesListDiv && selectedImagesListDiv.children.length === 0) { selectedImagesListDiv.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>'; }
            }
        }
    });

    // =========================================================================
    // Task 1: 新功能 - 編輯「指派」Modal (New: Edit "Assignment" Modal)
    // =========================================================================
    
    const editAssignmentModal = document.getElementById('editAssignmentModal');
    const editAssignmentForm = document.getElementById('editAssignmentForm');
    const editDirectFields = document.getElementById('editDirectAssignFields');
    const editGroupFields = document.getElementById('editGroupAssignFields');
    const saveAssignmentChangesButton = document.getElementById('saveAssignmentChangesButton');

    function openEditAssignmentModal(data) {
        if (!editAssignmentForm) return;
        editAssignmentForm.reset();
        editDirectFields.style.display = 'none';
        editGroupFields.style.display = 'none';

        document.getElementById('editAssignmentId').value = data.itemId;
        document.getElementById('editAssignmentType').value = data.assignmentType;
        const sectionName = available_sections_for_js[data.sectionKey] || data.sectionKey;
        document.getElementById('editSectionKeyDisplay').value = sectionName;

        if (data.assignmentType === 'single_media') {
            editDirectFields.style.display = 'block';
            const media = allMediaItemsForJS.find(m => m.id === data.mediaId);
            document.getElementById('currentMediaFilename').textContent = media ? media.filename : '素材遺失';
            document.getElementById('editMediaSelect').value = data.mediaId;
        } else if (data.assignmentType === 'group_reference') {
            editGroupFields.style.display = 'block';
            document.getElementById('editCarouselGroupSelect').value = data.groupId;
            document.getElementById('editOffsetInput').value = data.offset;
        }

        editAssignmentModal.classList.add('is-active');
    }

    function closeEditAssignmentModal() {
        if(editAssignmentModal) editAssignmentModal.classList.remove('is-active');
    }

    document.querySelectorAll('.edit-assignment-button').forEach(button => {
        button.addEventListener('click', function() {
            const data = {
                itemId: this.dataset.itemId,
                assignmentType: this.dataset.assignmentType,
                sectionKey: this.dataset.sectionKey,
                mediaId: this.dataset.mediaId,
                groupId: this.dataset.groupId,
                offset: this.dataset.offset,
            };
            openEditAssignmentModal(data);
        });
    });
    
    // 關閉 Modal 的所有方式
    editAssignmentModal?.querySelector('.delete')?.addEventListener('click', closeEditAssignmentModal);
    editAssignmentModal?.querySelector('#cancelAssignmentChangesButton')?.addEventListener('click', closeEditAssignmentModal);
    editAssignmentModal?.querySelector('.modal-background')?.addEventListener('click', closeEditAssignmentModal);
    
    // 儲存「指派」變更
    if(saveAssignmentChangesButton) {
        saveAssignmentChangesButton.addEventListener('click', async function() {
            this.classList.add('is-loading');
            const assignmentId = document.getElementById('editAssignmentId').value;
            const assignmentType = document.getElementById('editAssignmentType').value;
            
            let payload = {};
            if (assignmentType === 'single_media') {
                payload.media_id = document.getElementById('editMediaSelect').value;
                if (!payload.media_id) {
                     alert("請選擇一個新的媒體素材。");
                     this.classList.remove('is-loading');
                     return;
                }
            } else {
                payload.group_id = document.getElementById('editCarouselGroupSelect').value;
                payload.offset = document.getElementById('editOffsetInput').value;
            }

            try {
                // **認證修改**: 使用 fetchWithAuth
                const response = await fetchWithAuth(`/api/assignment/update/${assignmentId}`, {
                    method: 'POST', // 或 'PUT'，依後端設計
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || '更新指派失敗');
                }
                
                window.location.reload();

            } catch(error) {
                if (error.message !== 'Unauthorized') {
                    alert(`儲存失敗: ${error.message}`);
                }
            } finally {
                 this.classList.remove('is-loading');
            }
        });
    }


    // =========================================================================
    // 既有功能：主表單欄位動態顯示 (Existing: Main Form Dynamic Fields)
    // =========================================================================
    const mediaTypeSelect = document.getElementById('mediaTypeSelect');
    const sectionKeyField = document.getElementById('sectionKeyField');
    const fileUploadField = document.getElementById('fileUploadField');
    const carouselGroupField = document.getElementById('carouselGroupField');
    const carouselOffsetField = document.getElementById('carouselOffsetField');
    const sectionKeySelect = document.getElementById('sectionKeySelect');
    const fileInputForForm = fileUploadField ? fileUploadField.querySelector('input[type="file"]') : null;
    const carouselGroupIdSelect = carouselGroupField ? carouselGroupField.querySelector('select[name="carousel_group_id"]') : null;
    const offsetInput = carouselOffsetField ? carouselOffsetField.querySelector('input[name="offset"]') : null;

    function toggleFormFields() {
        const selectedType = mediaTypeSelect?.value;
        if(sectionKeyField) sectionKeyField.style.display = 'none';
        if(fileUploadField) fileUploadField.style.display = 'none';
        if(carouselGroupField) carouselGroupField.style.display = 'none';
        if(carouselOffsetField) carouselOffsetField.style.display = 'none';
        if(sectionKeySelect) sectionKeySelect.required = false;
        if(fileInputForForm) fileInputForForm.required = false;
        if(carouselGroupIdSelect) carouselGroupIdSelect.required = false;
        if(offsetInput) offsetInput.required = false;

        if (selectedType === 'image' || selectedType === 'video') {
            if(sectionKeyField) sectionKeyField.style.display = 'block';
            if(fileUploadField) fileUploadField.style.display = 'block';
            if(sectionKeySelect) sectionKeySelect.required = true;
            if(fileInputForForm) fileInputForForm.required = true;
            if(sectionKeySelect) {
                sectionKeySelect.innerHTML = '<option value="" disabled selected>-- 請選擇區塊 --</option>';
                // 明確定義順序，確保下拉選單按照正確順序顯示
                const sectionOrder = [
                    'header_video',
                    'carousel_top_left',
                    'carousel_top_right',
                    'carousel_bottom_left',
                    'carousel_bottom_right',
                    'footer_content'
                ];
                for (const key of sectionOrder) {
                    if (available_sections_for_js[key]) {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = available_sections_for_js[key];
                        sectionKeySelect.appendChild(option);
                    }
                }
            }
        } else if (selectedType === 'carousel_reference') {
            if(sectionKeyField) sectionKeyField.style.display = 'block';
            if(carouselGroupField) carouselGroupField.style.display = 'block';
            if(carouselOffsetField) carouselOffsetField.style.display = 'block';
            if(sectionKeySelect) sectionKeySelect.required = true;
            if(carouselGroupIdSelect) carouselGroupIdSelect.required = true;
            if(offsetInput) offsetInput.required = true;
            if(sectionKeySelect) {
                sectionKeySelect.innerHTML = '<option value="" disabled selected>-- 請選擇輪播區塊 --</option>';
                // 明確定義輪播區塊的順序
                const carouselSectionOrder = [
                    'carousel_top_left',
                    'carousel_top_right',
                    'carousel_bottom_left',
                    'carousel_bottom_right'
                ];
                for (const key of carouselSectionOrder) {
                    if (available_sections_for_js[key]) {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = available_sections_for_js[key];
                        sectionKeySelect.appendChild(option);
                    }
                }
            }
        }
    }

    if (mediaTypeSelect) {
        mediaTypeSelect.addEventListener('change', toggleFormFields);
        // 頁面載入時，根據預設選項初始化表單欄位
        toggleFormFields();
    }
});

// --- 請將以下程式碼新增到 admin.js 的最末端 ---

document.addEventListener('DOMContentLoaded', () => {
    // 監聽整個頁面的表單提交事件
    document.body.addEventListener('submit', function(event) {

        // 處理建立群組表單
        if (event.target && event.target.matches('#createGroupForm')) {
            // 1. 阻止表單用傳統方式送出
            event.preventDefault();

            const form = event.target;
            const formData = new FormData(form);
            const url = form.action;
            const token = localStorage.getItem('jwt_token');
            const submitButton = form.querySelector('#createGroupButton');

            // 2. 檢查 Token 是否存在
            if (!token) {
                alert('認證已過期或不存在，請重新登入。');
                window.location.href = '/login';
                return;
            }

            // 3. 顯示載入狀態
            if (submitButton) {
                submitButton.classList.add('is-loading');
                submitButton.disabled = true;
            }

            // 4. 使用 fetch API 發送帶有認證標頭的請求
            fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('群組建立成功！');
                    window.location.reload(); // 重新整理頁面以顯示最新列表
                } else {
                    alert(`建立失敗: ${data.message || '未知錯誤'}`);
                }
            })
            .catch(error => {
                console.error('建立群組時發生錯誤:', error);
                alert('建立失敗，請檢查網絡連線或查看控制台日誌。');
            })
            .finally(() => {
                // 5. 恢復按鈕狀態
                if (submitButton) {
                    submitButton.classList.remove('is-loading');
                    submitButton.disabled = false;
                }
            });
        }

        // 判斷被提交的是否為我們標記的刪除表單
        else if (event.target && event.target.matches('form.delete-form')) {
            
            // 1. 阻止表單用傳統方式送出
            event.preventDefault(); 

            const form = event.target;
            const url = form.action;
            const token = localStorage.getItem('jwt_token'); // 從瀏覽器儲存中獲取 Token

            // 2. 檢查 Token 是否存在
            if (!token) {
                alert('認證已過期或不存在，請重新登入。');
                window.location.href = '/login'; // 重定向到登入頁面
                return;
            }

            // 3. 使用 fetch API 發送帶有認證標頭的請求
            fetch(url, {
                method: 'POST',
                headers: {
                    // 這就是解決問題的關鍵：在請求中加入認證 Token
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (response.ok) {
                    // 如果伺服器回應成功 (status 200-299)
                    console.log('刪除成功！');
                    window.location.reload(); // 重新整理頁面以顯示最新列表
                } else {
                    // 如果伺服器回應失敗
                    response.json().then(data => {
                        alert(`刪除失敗: ${data.message || '未知錯誤'}`);
                    });
                }
            })
            .catch(error => {
                // 處理網絡連線等問題
                console.error('刪除操作時發生網絡錯誤:', error);
                alert('刪除失敗，請檢查網絡連線或查看控制台日誌。');
            });
        }
    });
});