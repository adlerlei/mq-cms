// =========================================================================
// App State & Core Functions
// =========================================================================

// The single source of truth for our application's data.
const appState = {
    media: [],
    groups: [],
    assignments: [],
    materials: [],
    settings: {},
    available_sections: {}
};

// 全局變量來存儲DOM元素引用
let mediaTypeSelect, sectionKeyField, fileUploadField, carouselGroupField, carouselOffsetField, sectionKeySelect;

/**
 * 動態切換表單欄位的顯示
 */
function toggleFormFields() {
    const selectedType = mediaTypeSelect?.value;
    
    if (selectedType === 'image' || selectedType === 'video') {
        if(sectionKeyField) sectionKeyField.style.display = 'block';
        if(fileUploadField) fileUploadField.style.display = 'block';
        if(carouselGroupField) carouselGroupField.style.display = 'none';
        if(carouselOffsetField) carouselOffsetField.style.display = 'none';
        if(sectionKeySelect) {
            sectionKeySelect.innerHTML = '<option value="" disabled selected>-- 請選擇區塊 --</option>';
            const sectionOrder = ['header_video', 'carousel_top_left', 'carousel_top_right', 'carousel_bottom_left', 'carousel_bottom_right', 'footer_content'];
            for (const key of sectionOrder) {
                if (appState.available_sections[key]) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = appState.available_sections[key];
                    sectionKeySelect.appendChild(option);
                }
            }
        }
    } else if (selectedType === 'group_reference') {
        if(sectionKeyField) sectionKeyField.style.display = 'block';
        if(fileUploadField) fileUploadField.style.display = 'none';
        if(carouselGroupField) carouselGroupField.style.display = 'block';
        if(carouselOffsetField) carouselOffsetField.style.display = 'block';
        if(sectionKeySelect) {
            sectionKeySelect.innerHTML = '<option value="" disabled selected>-- 請選擇輪播區塊 --</option>';
            const carouselSectionOrder = ['carousel_top_left', 'carousel_top_right', 'carousel_bottom_left', 'carousel_bottom_right'];
            for (const key of carouselSectionOrder) {
                if (appState.available_sections[key]) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = appState.available_sections[key];
                    sectionKeySelect.appendChild(option);
                }
            }
        }
    }
}

/**
 * Fetches the latest data from the server, updates the app state,
 * and re-renders the entire UI.
 */
async function fetchDataAndRender() {
    try {
        console.log('開始獲取數據...');
        const response = await fetch('/api/media_with_settings');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.json();

        // Update the state
        appState.assignments = data._debug_all_assignments || [];
        appState.materials = data._debug_all_materials || [];
        appState.groups = data._debug_all_groups || [];
        appState.settings = data.settings || {};
        appState.available_sections = available_sections_for_js;

        renderAll();
        toggleFormFields();
        
    } catch (error) {
        console.error('Error fetching data and rendering:', error);
        alert(`無法從伺服器獲取最新資料：${error.message}`);
    }
}

/**
 * Main render function that orchestrates the rendering of all UI components.
 */
function renderAll() {
    renderMediaAndAssignments();
    renderCarouselGroups();
}

// =========================================================================
// Render Functions
// =========================================================================
function renderMediaAndAssignments() {
    const tableBody = document.querySelector('.media-list-table tbody');
    if (!tableBody) return;

    const { assignments, materials, groups, available_sections } = appState;
    const used_material_ids = new Set();
    assignments.forEach(assign => {
        if (assign.content_source_type === 'single_media') used_material_ids.add(assign.media_id);
    });
    groups.forEach(group => (group.image_ids || []).forEach(id => used_material_ids.add(id)));

    let html = '';

    if (assignments.length > 0) {
        html += '<tr class="table-section-header"><th colspan="4">區塊內容指派</th></tr>';
        assignments.forEach(item => {
            let contentInfo = '';
            if (item.content_source_type === 'single_media') {
                const mat = materials.find(m => m.id === item.media_id);
                contentInfo = mat ? `${mat.type === 'image' ? `<img src="${mat.url}" class="image-thumbnail">` : '<i class="fas fa-film fa-2x"></i>'} <span>${mat.original_filename || mat.filename}</span>` : '<span class="has-text-danger">素材遺失</span>';
            } else if (item.content_source_type === 'group_reference') {
                const grp = groups.find(g => g.id === item.group_id);
                contentInfo = `<span>輪播組: ${grp ? grp.name : '群組遺失'}</span>`;
            }
            html += `<tr><td>${contentInfo}</td><td><span class="tag is-primary is-light">${item.content_source_type === 'single_media' ? '直接指派' : '輪播群組指派'}</span></td><td>${available_sections[item.section_key] || '未知區塊'}</td><td class="actions-cell has-text-right"><form class="delete-form" data-item-id="${item.id}" data-item-type="assignment"><button type="submit" class="button is-small is-danger">刪除指派</button></form></td></tr>`;
        });
    }

    const unusedMaterials = materials.filter(m => !used_material_ids.has(m.id));
    if (unusedMaterials.length > 0) {
        html += '<tr class="table-section-header"><th colspan="4">未使用的素材</th></tr>';
        unusedMaterials.forEach(item => {
            const preview = item.type === 'image' ? `<img src="${item.url}" class="image-thumbnail">` : '<i class="fas fa-film fa-2x"></i>';
            html += `<tr><td>${preview} <span>${item.original_filename || item.filename}</span></td><td><span class="tag is-info is-light">${item.type === 'image' ? '圖片素材' : '影片素材'}</span></td><td><span class="is-italic">在庫，未指派</span></td><td class="actions-cell has-text-right"><button class="button is-small is-info reassign-media-button" data-media-id="${item.id}" data-media-type="${item.type}" data-media-filename="${item.original_filename || item.filename}">重新指派</button><form class="delete-form" data-item-id="${item.id}" data-item-type="material"><button type="submit" class="button is-small is-warning">刪除素材</button></form></td></tr>`;
        });
    }

    tableBody.innerHTML = html || '<tr><td colspan="4" class="has-text-centered">目前媒體庫為空。</td></tr>';
}

function renderCarouselGroups() {
    const tableBody = document.querySelector('#createGroupForm').closest('.box').nextElementSibling.querySelector('tbody');
    if (!tableBody) return;

    const { groups } = appState;
    let html = '';

    if (groups.length === 0) {
        html = '<tr><td colspan="3" class="has-text-centered">目前沒有任何輪播圖片組。</td></tr>';
    } else {
        groups.forEach(item => {
            html += `<tr><td>${item.name}</td><td>${(item.image_ids || []).length}</td><td class="actions-cell has-text-right"><button class="button is-small is-link edit-group-images-button" data-group-id="${item.id}" data-group-name="${item.name}">編輯圖片</button><form class="delete-form" data-item-id="${item.id}" data-item-type="carousel_group"><button type="submit" class="button is-small is-danger">刪除</button></form></td></tr>`;
        });
    }
    tableBody.innerHTML = html;
}

// =========================================================================
// Helper Functions
// =========================================================================
const JWT_TOKEN = localStorage.getItem('jwt_token');

async function fetchWithAuth(url, options = {}) {
    const headers = { ...options.headers };
    if (JWT_TOKEN) headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('jwt_token');
        alert('您的登入已逾期或無效，請重新登入。');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    return response;
}

// =========================================================================
// Modal Logic
// =========================================================================
function openGroupEditModal(groupId, groupName) {
    const modal = document.getElementById('editCarouselGroupModal');
    if (!modal) return;

    document.getElementById('modalGroupName').textContent = groupName;
    document.getElementById('modalGroupId').value = groupId;

    const { materials, groups } = appState;
    const targetGroup = groups.find(g => g.id === groupId);
    const imageIdsInGroup = new Set(targetGroup ? (targetGroup.image_ids || []) : []);

    const selectedList = document.getElementById('selectedImagesList');
    const availableList = document.getElementById('availableImagesList');
    selectedList.innerHTML = '';
    availableList.innerHTML = '';
    
    const materialUsage = {};
    groups.forEach(g => {
        (g.image_ids || []).forEach(imgId => {
            if (!materialUsage[imgId]) materialUsage[imgId] = [];
            if (g.id !== groupId) materialUsage[imgId].push(g.name);
        });
    });

    if (imageIdsInGroup.size === 0) {
        selectedList.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
    } else {
        (targetGroup.image_ids || []).forEach(imgId => {
            const material = materials.find(m => m.id === imgId);
            if (material) selectedList.appendChild(createDraggableImageItem(material, false, materialUsage));
        });
    }

    materials.filter(m => m.type === 'image' && !imageIdsInGroup.has(m.id)).forEach(material => {
        availableList.appendChild(createDraggableImageItem(material, true, materialUsage));
    });

    modal.classList.add('is-active');
}

function createDraggableImageItem(material, isAvailable, usage) {
    const item = document.createElement('div');
    item.className = 'image-list-item';
    item.dataset.imageId = material.id;
    item.draggable = true;

    let tags = '';
    const ownerGroup = appState.groups.find(g => (g.image_ids || []).includes(material.id) && g.id !== document.getElementById('modalGroupId').value);
    if (material.source === 'group_specific') {
         const specificOwner = appState.groups.find(g => (g.image_ids || []).includes(material.id));
         if (specificOwner) tags += `<span class="tag is-success is-small">群組: ${specificOwner.name}</span>`;
    }
    if (usage[material.id] && usage[material.id].length > 0) {
         tags += `<span class="tag is-info is-small" title="${usage[material.id].join(', ')}">在其他群組</span>`;
    }

    item.innerHTML = `<img src="${material.url}" alt="${material.original_filename}"><div class="image-item-info"><p>${material.original_filename}</p><div class="tags">${tags}</div></div><button class="button is-small is-light toggle-button"><i class="fas ${isAvailable ? 'fa-plus' : 'fa-minus'}"></i></button>`;
    return item;
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('is-active');
}

// =========================================================================
// DOMContentLoaded - Main Entry Point
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    socket.on('connect', () => console.log('Socket.IO Connected!'));
    socket.on('media_updated', () => fetchDataAndRender());
    socket.on('settings_updated', () => fetchDataAndRender());

    const authCheckingScreen = document.getElementById('authCheckingScreen');
    const mainContent = document.getElementById('mainContent');
    mediaTypeSelect = document.getElementById('mediaTypeSelect');
    sectionKeyField = document.getElementById('sectionKeyField');
    fileUploadField = document.getElementById('fileUploadField');
    carouselGroupField = document.getElementById('carouselGroupField');
    carouselOffsetField = document.getElementById('carouselOffsetField');
    sectionKeySelect = document.getElementById('sectionKeySelect');

    if (!JWT_TOKEN) {
        window.location.href = '/login';
        return;
    }
    
    if (authCheckingScreen) authCheckingScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    
    fetchDataAndRender();

    if (mediaTypeSelect) mediaTypeSelect.addEventListener('change', toggleFormFields);
    
    const fileInput = document.querySelector('.file-input');
    const fileName = document.querySelector('.file-name');
    if (fileInput && fileName) {
        fileInput.addEventListener('change', (event) => {
            fileName.textContent = event.target.files.length > 0 ? event.target.files[0].name : '未選擇任何檔案';
        });
    }

    document.getElementById('logoutButton')?.addEventListener('click', () => {
        localStorage.removeItem('jwt_token');
        window.location.href = '/login';
    });
    
    // --- Event Delegation for Forms and Dynamic Buttons ---
    document.body.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (event.target.id === 'uploadForm') {
            const form = event.target;
            const submitButton = form.querySelector('button[type="submit"]');
            const progressContainer = document.getElementById('upload-progress-container');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressText = document.getElementById('upload-progress-text');
            
            if (progressContainer) progressContainer.style.display = 'block';
            if (progressBar) progressBar.value = 0;
            if (progressText) progressText.textContent = '0%';
            submitButton.classList.add('is-loading');
            submitButton.disabled = true;

            const formData = new FormData(form);
            const selectedType = document.getElementById('mediaTypeSelect')?.value;
            let apiUrl = selectedType === 'group_reference' ? '/api/assignments' : '/api/materials';

            const xhr = new XMLHttpRequest();
            xhr.open('POST', apiUrl, true);
            xhr.setRequestHeader('Authorization', `Bearer ${JWT_TOKEN}`);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    if(progressBar) progressBar.value = percentComplete;
                    if(progressText) progressText.textContent = `${Math.round(percentComplete)}%`;
                }
            };
            xhr.onload = () => {
                submitButton.classList.remove('is-loading');
                submitButton.disabled = false;
                if(progressContainer) progressContainer.style.display = 'none';
                if (xhr.status >= 200 && xhr.status < 300) {
                    fetchDataAndRender();
                    form.reset();
                    const fileNameSpan = form.querySelector('.file-name');
                    if (fileNameSpan) fileNameSpan.textContent = '未選擇任何檔案';
                    toggleFormFields();
                } else {
                    const err = JSON.parse(xhr.responseText);
                    alert(`操作失敗: ${err.message || xhr.statusText}`);
                }
            };
            xhr.onerror = () => {
                 submitButton.classList.remove('is-loading');
                submitButton.disabled = false;
                 if(progressContainer) progressContainer.style.display = 'none';
                alert('上傳過程中發生網路錯誤。');
            };
            xhr.send(formData);
        }

        if (event.target.id === 'createGroupForm') {
            const form = event.target;
            const createButton = document.getElementById('createGroupButton');
            createButton.classList.add('is-loading');
            try {
                const response = await fetchWithAuth(form.action, { method: 'POST', body: new FormData(form) });
                if (!response.ok) throw new Error((await response.json()).message || '建立群組失敗');
                form.reset();
                fetchDataAndRender();
            } catch (error) {
                if (error.message !== 'Unauthorized') alert(`錯誤: ${error.message}`);
            } finally {
                createButton.classList.remove('is-loading');
            }
        }

        if (event.target.id === 'globalSettingsForm') {
            const form = event.target;
            const saveButton = document.getElementById('saveSettingsButton');
            const notification = document.getElementById('settings-notification');
            saveButton.classList.add('is-loading');
            const payload = {
                header_interval: document.getElementById('header_interval').value,
                carousel_interval: document.getElementById('carousel_interval').value,
                footer_interval: document.getElementById('footer_interval').value
            };
            try {
                const response = await fetchWithAuth('/admin/settings/update', { method: 'POST', body: JSON.stringify(payload) });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || '儲存設定失敗');
                notification.textContent = data.message || '設定儲存成功！';
                notification.className = 'notification is-success';
                setTimeout(() => { notification.className = 'notification is-hidden'; }, 3000);
                fetchDataAndRender();
            } catch (error) {
                if (error.message !== 'Unauthorized') {
                    notification.textContent = error.message;
                    notification.className = 'notification is-danger';
                }
            } finally {
                saveButton.classList.remove('is-loading');
            }
        }

        if (event.target.classList.contains('delete-form')) {
            const form = event.target;
            const itemId = form.dataset.itemId;
            const itemType = form.dataset.itemType;
            const confirmMessages = {
                material: '確定要刪除此素材嗎？此操作不可逆！',
                carousel_group: '確定要刪除此輪播群組嗎？此操作將同時刪除群組內專屬圖片！',
                assignment: '確定要刪除此指派嗎？'
            };
            const apiDetails = {
                material: { url: `/api/materials/${itemId}`, method: 'DELETE' },
                carousel_group: { url: `/admin/carousel_group/delete/${itemId}`, method: 'POST' },
                assignment: { url: `/api/assignments/${itemId}`, method: 'DELETE' }
            };

            if (!confirm(confirmMessages[itemType])) return;
            try {
                const response = await fetchWithAuth(apiDetails[itemType].url, { method: apiDetails[itemType].method });
                if (!response.ok) throw new Error((await response.json()).message || '刪除失敗');
                fetchDataAndRender();
            } catch (error) {
                if (error.message !== 'Unauthorized') alert(`刪除失敗: ${error.message}`);
            }
        }
    });

    // --- Event Delegation for Clicks ---
    document.body.addEventListener('click', async (event) => {
        const editButton = event.target.closest('.edit-group-images-button');
        if (editButton) {
            openGroupEditModal(editButton.dataset.groupId, editButton.dataset.groupName);
        }

        if (event.target.matches('.modal-background, .modal-card-head .delete, #cancelGroupChangesButton')) {
            closeModal('editCarouselGroupModal');
        }

        // --- FIX STARTS HERE: Toggle button for moving images in modal ---
        const toggleButton = event.target.closest('.toggle-button');
        if (toggleButton) {
            const item = toggleButton.closest('.image-list-item');
            const selectedList = document.getElementById('selectedImagesList');
            const availableList = document.getElementById('availableImagesList');
            const icon = toggleButton.querySelector('i');

            if (selectedList.contains(item)) {
                availableList.appendChild(item);
                icon.classList.remove('fa-minus');
                icon.classList.add('fa-plus');
            } else {
                selectedList.appendChild(item);
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-minus');
                if (selectedList.querySelector('p')) selectedList.querySelector('p').remove();
            }
        }
        
        // --- FIX STARTS HERE: Save group changes button ---
        if (event.target.id === 'saveGroupChangesButton') {
            const button = event.target;
            button.classList.add('is-loading');
            const groupId = document.getElementById('modalGroupId').value;
            const selectedImagesList = document.getElementById('selectedImagesList');
            const imageIds = [...selectedImagesList.querySelectorAll('.image-list-item')].map(item => item.dataset.imageId);

            try {
                const response = await fetchWithAuth(`/admin/carousel_group/update_images/${groupId}`, {
                    method: 'POST',
                    body: JSON.stringify({ image_ids: imageIds })
                });
                if (!response.ok) throw new Error((await response.json()).message || '儲存失敗');
                
                closeModal('editCarouselGroupModal');
                fetchDataAndRender();

            } catch(error) {
                if (error.message !== 'Unauthorized') alert(`儲存失敗: ${error.message}`);
            } finally {
                button.classList.remove('is-loading');
            }
        }
    });

    // --- Drag and Drop Logic for Modal ---
    let draggedItem = null;
    document.body.addEventListener('dragstart', (event) => {
        if (event.target.classList.contains('image-list-item')) {
            draggedItem = event.target;
            setTimeout(() => {
                event.target.style.display = 'none';
            }, 0);
        }
    });

    document.body.addEventListener('dragend', (event) => {
        if (draggedItem) {
            setTimeout(() => {
                draggedItem.style.display = 'flex';
                draggedItem = null;
            }, 0);
        }
    });

    const lists = document.querySelectorAll('.selected-images-list, .available-images-list');
    lists.forEach(list => {
        list.addEventListener('dragover', (event) => {
            event.preventDefault();
            const afterElement = getDragAfterElement(list, event.clientY);
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
        });
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.image-list-item:not([style*="display: none"])')];
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
});
