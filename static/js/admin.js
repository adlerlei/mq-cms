// 確保在 DOM 完全載入後執行腳本
document.addEventListener('DOMContentLoaded', () => {
    // 選取檔案輸入框和檔案名稱顯示元素
    const fileInput = document.querySelector('.file-input');
    const fileNameDisplay = document.querySelector('.file-name');

    if (fileInput && fileNameDisplay) {
        fileInput.onchange = () => {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = fileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = '未選擇任何檔案';
            }
        };
    }

    // 上傳表單和進度條相關元素
    const uploadForm = document.getElementById('uploadForm');
    const progressBarContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const uploadFormSubmitButton = uploadForm ? uploadForm.querySelector('button[type="submit"]') : null;

    if (uploadForm && progressBarContainer && progressBar && progressText && uploadFormSubmitButton) {
        uploadForm.addEventListener('submit', function(event) {
            if (!uploadForm.checkValidity()) {
                console.warn('HTML5 表單驗證未通過 (uploadForm)。');
                return;
            }
            event.preventDefault();

            progressBarContainer.style.display = 'block';
            progressBar.value = 0;
            progressText.textContent = '0%';
            uploadFormSubmitButton.classList.add('is-loading');
            uploadFormSubmitButton.disabled = true;

            const formData = new FormData(uploadForm);
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentage = Math.round((e.loaded / e.total) * 100);
                    progressBar.value = percentage;
                    progressText.textContent = percentage + '%';
                }
            });

            xhr.addEventListener('load', function() {
                progressBar.value = 100;
                progressText.textContent = '100%';
                uploadFormSubmitButton.classList.remove('is-loading');
                uploadFormSubmitButton.disabled = false;

                if (xhr.status === 200 || xhr.status === 302) {
                    console.log('操作成功 (uploadForm)，正在重新載入頁面...');
                    window.location.reload();
                } else {
                    console.error('操作失敗 (uploadForm):', xhr.status, xhr.responseText);
                    alert(`操作失敗: ${xhr.status} - ${xhr.statusText || '未知錯誤'}`);
                    setTimeout(() => {
                        progressBarContainer.style.display = 'none';
                    }, 2000);
                }
            });

            xhr.addEventListener('error', function() {
                console.error('上傳過程中發生網路錯誤。');
                alert('上傳過程中發生網路錯誤，請檢查您的網路連線。');
                uploadFormSubmitButton.classList.remove('is-loading');
                uploadFormSubmitButton.disabled = false;
                setTimeout(() => {
                    progressBarContainer.style.display = 'none';
                }, 2000);
            });

            xhr.addEventListener('abort', function() {
                console.warn('上傳已中止。');
                uploadFormSubmitButton.classList.remove('is-loading');
                uploadFormSubmitButton.disabled = false;
                setTimeout(() => {
                    progressBarContainer.style.display = 'none';
                }, 1000);
            });

            xhr.open('POST', uploadForm.action, true);
            xhr.send(formData);
        });
    }

    // --- 輪播圖片組 Modal 相關邏輯 ---
    const editModal = document.getElementById('editCarouselGroupModal');
    const modalGroupName = document.getElementById('modalGroupName');
    const modalGroupIdInput = document.getElementById('modalGroupId');
    const selectedImagesListDiv = document.getElementById('selectedImagesList');
    const availableImagesListDiv = document.getElementById('availableImagesList');
    const saveGroupChangesButton = document.getElementById('saveGroupChangesButton');
    const cancelGroupChangesButton = document.getElementById('cancelGroupChangesButton');
    const modalCloseButton = editModal ? editModal.querySelector('.delete') : null;
    const modalBackground = editModal ? editModal.querySelector('.modal-background') : null;

    function openModal() {
        if(editModal) editModal.classList.add('is-active');
    }

    function closeModal() {
        if(editModal) editModal.classList.remove('is-active');
        selectedImagesListDiv.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
        availableImagesListDiv.innerHTML = '';
        modalGroupIdInput.value = '';
        modalGroupName.textContent = '';
    }

    document.querySelectorAll('.edit-group-images-button').forEach(button => {
        button.addEventListener('click', function() {
            const groupId = this.dataset.groupId;
            const groupName = this.dataset.groupName;
            modalGroupIdInput.value = groupId;
            modalGroupName.textContent = groupName;
            populateAvailableImages(groupId);
            populateSelectedImages(groupId);
            openModal();
        });
    });

    function populateAvailableImages(currentGroupId) {
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
        if (selectedImagesListDiv.querySelector(`[data-image-id="${imageId}"]`)) return;
        if (selectedImagesListDiv.querySelector('p.has-text-grey-light')) {
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
        selectedImagesListDiv.appendChild(entryDiv);

        entryDiv.addEventListener('dragstart', handleDragStart);
        entryDiv.addEventListener('dragend', handleDragEnd);
    }

    selectedImagesListDiv.addEventListener('dragover', handleDragOver);
    selectedImagesListDiv.addEventListener('drop', handleDrop);
    selectedImagesListDiv.addEventListener('dragenter', handleDragEnter);
    selectedImagesListDiv.addEventListener('dragleave', handleDragLeave);

    if(modalCloseButton) modalCloseButton.addEventListener('click', closeModal);
    if(cancelGroupChangesButton) cancelGroupChangesButton.addEventListener('click', closeModal);
    if(modalBackground) modalBackground.addEventListener('click', closeModal);

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
        const selectedType = mediaTypeSelect.value;
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
                for (const key in available_sections_for_js) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = available_sections_for_js[key];
                    sectionKeySelect.appendChild(option);
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
                 for (const key in available_sections_for_js) {
                    if (key.startsWith('carousel_')) {
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
        toggleFormFields();
    }

    let draggedItem = null;
    let placeholder = null;

    function handleDragStart(e) {
        draggedItem = e.target.closest('.draggable-item');
        if (!draggedItem) return;
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', draggedItem.dataset.imageId);
            e.dataTransfer.effectAllowed = 'move';
        }
        setTimeout(() => {
            if(draggedItem) draggedItem.classList.add('dragging'); // 增加 null 檢查
        }, 0);
    }

    function handleDragEnd(e) {
        if (!draggedItem) return;
        draggedItem.classList.remove('dragging');
        draggedItem = null;
        if (placeholder) {
            placeholder.remove();
            placeholder = null;
        }
        selectedImagesListDiv.classList.remove('drag-over-active');
    }

    function handleDragEnter(e) {
        e.preventDefault();
        if (draggedItem && selectedImagesListDiv.contains(draggedItem)) {
            selectedImagesListDiv.classList.add('drag-over-active');
        }
    }

    function handleDragLeave(e) {
        if (e.relatedTarget && !selectedImagesListDiv.contains(e.relatedTarget)) {
            selectedImagesListDiv.classList.remove('drag-over-active');
            if (placeholder) {
                placeholder.remove();
                placeholder = null;
            }
        } else if (!e.relatedTarget) {
             selectedImagesListDiv.classList.remove('drag-over-active');
            if (placeholder) {
                placeholder.remove();
                placeholder = null;
            }
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        if (!draggedItem || !selectedImagesListDiv.contains(draggedItem)) return;
        const container = selectedImagesListDiv;
        const afterElement = getDragAfterElement(container, e.clientY);
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.classList.add('drag-placeholder');
            placeholder.style.height = '2px';
            placeholder.style.backgroundColor = 'rgba(0,0,255,0.3)';
            placeholder.style.margin = '5px 0';
        }
        if (draggedItem !== afterElement) {
            if (afterElement) {
                container.insertBefore(placeholder, afterElement);
            } else {
                container.appendChild(placeholder);
            }
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        if (!draggedItem || !selectedImagesListDiv.contains(draggedItem)) return;
        if (placeholder && placeholder.parentNode === selectedImagesListDiv) {
            selectedImagesListDiv.insertBefore(draggedItem, placeholder);
        } else if (draggedItem.parentNode === selectedImagesListDiv) {
             selectedImagesListDiv.appendChild(draggedItem);
        }
        // 清理 placeholder，因為 dragend 可能在 drop 之後或之前觸發，取決於瀏覽器
        if (placeholder) {
            placeholder.remove();
            placeholder = null;
        }
        selectedImagesListDiv.classList.remove('drag-over-active'); // 確保移除 active class
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    editModal.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('add-image-to-group-button') && !target.disabled) {
            const imageId = target.dataset.imageId;
            const imageUrl = target.dataset.imageUrl;
            const imageFilename = target.dataset.imageFilename;
            addSelectedImageToDOM(imageId, imageUrl, imageFilename);
            target.disabled = true;
            target.textContent = '已加入';
            target.classList.remove('is-success');
            target.classList.add('is-light');
        }
        else if (target.classList.contains('remove-image-from-group-button')) {
            const imageIdToRemove = target.dataset.imageId;
            const itemToRemove = selectedImagesListDiv.querySelector(`.media-item-entry[data-image-id="${imageIdToRemove}"]`);
            if (itemToRemove) {
                itemToRemove.remove();
                const correspondingAddButton = availableImagesListDiv.querySelector(`.add-image-to-group-button[data-image-id="${imageIdToRemove}"]`);
                if (correspondingAddButton) {
                    correspondingAddButton.disabled = false;
                    correspondingAddButton.textContent = '加入';
                    correspondingAddButton.classList.add('is-success');
                    correspondingAddButton.classList.remove('is-light');
                }
                if (selectedImagesListDiv.children.length === 0 ||
                    (selectedImagesListDiv.children.length === 1 && selectedImagesListDiv.firstElementChild.tagName === 'P' && selectedImagesListDiv.firstElementChild.classList.contains('has-text-grey-light'))) {
                     selectedImagesListDiv.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
                }
            }
        }
    });

    if (saveGroupChangesButton) {
        saveGroupChangesButton.addEventListener('click', function() {
            const groupId = modalGroupIdInput.value;
            const selectedImageElements = selectedImagesListDiv.querySelectorAll('.media-item-entry.draggable-item');
            const imageIdsInOrder = Array.from(selectedImageElements).map(el => el.dataset.imageId);

            console.log('要儲存的群組 ID:', groupId);
            console.log('圖片順序:', imageIdsInOrder);

            saveGroupChangesButton.classList.add('is-loading');

            fetch(`/admin/carousel_group/update_images/${groupId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image_ids: imageIdsInOrder }),
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                saveGroupChangesButton.classList.remove('is-loading');
                if (data.success) {
                    console.log('輪播組圖片順序已更新:', data.message);
                    const groupIndex = allMediaItemsForJS.findIndex(item => item.id === groupId && item.type === 'carousel_group');
                    if (groupIndex > -1) {
                        allMediaItemsForJS[groupIndex].image_ids = imageIdsInOrder;
                    }
                    const groupRow = document.querySelector(`.edit-group-images-button[data-group-id="${groupId}"]`)
                                        ?.closest('tr');
                    if (groupRow && groupRow.cells.length > 2) {
                        const countCell = groupRow.cells[2];
                        countCell.textContent = imageIdsInOrder.length;
                    }
                    closeModal();
                    // 為了確保 Arc 瀏覽器能顯示 alert，稍微延遲一下
                    setTimeout(() => {
                        alert('圖片順序已成功儲存！');
                    }, 100); // 延遲 100 毫秒
                } else {
                    console.error('儲存圖片順序失敗:', data.message);
                    alert(`儲存圖片順序失敗: ${data.message || '未知錯誤'}`);
                }
            })
            .catch(error => {
                saveGroupChangesButton.classList.remove('is-loading');
                console.error('儲存圖片順序時發生錯誤:', error);
                let errorMessage = '儲存圖片順序時發生網路或伺服器錯誤。';
                if (error && error.message) {
                    errorMessage += `\n詳細資訊: ${error.message}`;
                }
                 // 為了確保 Arc 瀏覽器能顯示 alert，稍微延遲一下
                setTimeout(() => {
                    alert(errorMessage);
                }, 100);
            });
        });
    }

    // --- 修正刪除按鈕 (適用於 Arc 瀏覽器) ---
    // 選取所有 action 包含 "delete" 的表單
    document.querySelectorAll('form[action*="delete"]').forEach(deleteForm => {
        // 先移除可能存在的內聯 onsubmit，避免重複執行或衝突
        const originalOnSubmit = deleteForm.getAttribute('onsubmit');
        if (originalOnSubmit) {
            deleteForm.removeAttribute('onsubmit');
        }

        deleteForm.addEventListener('submit', function(event) {
            event.preventDefault(); // 阻止表單的預設提交行為

            let confirmMessage = '您確定要刪除嗎？'; // 預設確認訊息
            // 嘗試從原始的 onsubmit 屬性中提取確認訊息
            if (originalOnSubmit && originalOnSubmit.includes('confirm(')) {
                try {
                    const match = originalOnSubmit.match(/confirm\(['"](.*?)['"]\)/);
                    if (match && match[1]) {
                        confirmMessage = match[1];
                    }
                } catch (e) {
                    console.warn('無法從原始 onsubmit 中解析確認訊息', e);
                }
            } else { // 如果沒有原始 onsubmit，根據 action 內容生成訊息
                if (this.action.includes('delete_media_item')) {
                    confirmMessage = '您確定要刪除這個媒體項目嗎？';
                } else if (this.action.includes('delete_carousel_group')) {
                    confirmMessage = '您確定要刪除這個輪播圖片組嗎？組本身會被刪除，但組內的圖片素材不會被刪除。';
                }
            }

            if (window.confirm(confirmMessage)) { // 使用 window.confirm 確保是全局的 confirm
                // 如果使用者確認，則實際提交表單
                // 注意：這裡不能直接呼叫 this.submit() 後再 return false，因為我們已經 preventDefault 了
                // 我們需要讓表單以其原始方式提交，或者如果後端設計為 AJAX，則發送 AJAX
                // 由於我們的刪除是傳統 POST，所以直接提交
                console.log(`使用者確認刪除，正在提交表單: ${this.action}`);
                this.submit(); // 重新觸發表單提交，這次不會被我們的 listener 攔截第二次（因為我們沒有再次 preventDefault）
            } else {
                console.log('使用者取消了刪除操作。');
                return false; // 雖然已經 preventDefault，但明確返回 false
            }
        });
    });

});
