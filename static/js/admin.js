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
        console.log('API回應狀態:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('獲取到的數據:', data);

        // Update the state
        appState.assignments = data._debug_all_assignments || [];
        appState.materials = data._debug_all_materials || [];
        appState.groups = data._debug_all_groups || [];
        appState.settings = data.settings || {};
        appState.available_sections = available_sections_for_js;

        // Re-render all components
        renderAll();
        
        // 在數據載入完成後調用 toggleFormFields
        toggleFormFields();
        
        console.log('數據載入成功');

    } catch (error) {
        console.error('Error fetching data and rendering:', error);
        console.error('錯誤詳情:', error.message);
        alert(`無法從伺服器獲取最新資料：${error.message}\n請檢查伺服器是否正在運行，並嘗試重新整理頁面。`);
    }
}

/**
 * Main render function that orchestrates the rendering of all UI components.
 */
function renderAll() {
    renderMediaAndAssignments();
    renderCarouselGroups();
    // Add other render functions here as needed (e.g., for forms)
}

// =========================================================================
// Render Functions
// =========================================================================

/**
 * Renders the "Media Library & Assignments" table.
 */
function renderMediaAndAssignments() {
    const tableBody = document.querySelector('.media-list-table tbody');
    if (!tableBody) return;

    const { assignments, materials, groups, available_sections } = appState;
    
    // Determine which materials are used
    const used_material_ids = new Set();
    assignments.forEach(assign => {
        if (assign.content_source_type === 'single_media') {
            used_material_ids.add(assign.media_id);
        }
    });
    groups.forEach(group => {
        (group.image_ids || []).forEach(id => used_material_ids.add(id));
    });

    let html = '';

    // Render Assignments
    if (assignments.length > 0) {
        html += '<tr class="table-section-header"><th colspan="4">區塊內容指派</th></tr>';
        assignments.forEach(item => {
            let contentInfo = '';
            if (item.content_source_type === 'single_media') {
                const mat = materials.find(m => m.id === item.media_id);
                if (mat) {
                    const preview = mat.type === 'image' ? `<img src="${mat.url}" class="image-thumbnail">` : '<i class="fas fa-film fa-2x"></i>';
                    contentInfo = `${preview} <span>${mat.original_filename || mat.filename}</span>`;
                } else {
                    contentInfo = '<span class="has-text-danger">素材遺失</span>';
                }
            } else if (item.content_source_type === 'group_reference') {
                const grp = groups.find(g => g.id === item.group_id);
                contentInfo = `<span>輪播組: ${grp ? grp.name : '群組遺失'}</span>`;
            }

            html += `
                <tr>
                    <td>${contentInfo}</td>
                    <td><span class="tag is-primary is-light">${item.content_source_type === 'single_media' ? '直接指派' : '輪播群組指派'}</span></td>
                    <td>${available_sections[item.section_key] || '未知區塊'}</td>
                    <td class="actions-cell has-text-right">
                        <form class="delete-form" data-item-id="${item.id}" data-item-type="assignment"><button type="submit" class="button is-small is-danger">刪除指派</button></form>
                    </td>
                </tr>
            `;
        });
    }

    // Render Unused Materials
    const unusedMaterials = materials.filter(m => !used_material_ids.has(m.id));
    if (unusedMaterials.length > 0) {
        html += '<tr class="table-section-header"><th colspan="4">未使用的素材</th></tr>';
        unusedMaterials.forEach(item => {
            const preview = item.type === 'image' ? `<img src="${item.url}" class="image-thumbnail">` : '<i class="fas fa-film fa-2x"></i>';
            html += `
                <tr>
                    <td>${preview} <span>${item.original_filename || item.filename}</span></td>
                    <td><span class="tag is-info is-light">${item.type === 'image' ? '圖片素材' : '影片素材'}</span></td>
                    <td><span class="is-italic">在庫，未指派</span></td>
                    <td class="actions-cell has-text-right">
                        <button class="button is-small is-info reassign-media-button" data-media-id="${item.id}" data-media-type="${item.type}" data-media-filename="${item.original_filename || item.filename}">重新指派</button>
                        <form class="delete-form" data-item-id="${item.id}" data-item-type="material"><button type="submit" class="button is-small is-warning">刪除素材</button></form>
                    </td>
                </tr>
            `;
        });
    }

    if (html === '') {
        html = '<tr><td colspan="4" class="has-text-centered">目前媒體庫為空。</td></tr>';
    }

    tableBody.innerHTML = html;
}

/**
 * Renders the "Manage Carousel Groups" table.
 */
function renderCarouselGroups() {
    const tableBody = document.querySelector('#createGroupForm').closest('.box').nextElementSibling.querySelector('tbody');
    if (!tableBody) return;

    const { groups } = appState;
    let html = '';

    if (groups.length === 0) {
        html = '<tr><td colspan="3" class="has-text-centered">目前沒有任何輪播圖片組。</td></tr>';
    } else {
        groups.forEach(item => {
            html += `
                <tr>
                    <td>${item.name}</td>
                    <td>${(item.image_ids || []).length}</td>
                    <td class="actions-cell has-text-right">
                        <button class="button is-small is-link edit-group-images-button" data-group-id="${item.id}" data-group-name="${item.name}">編輯圖片</button>
                        <form class="delete-form" data-item-id="${item.id}" data-item-type="carousel_group"><button type="submit" class="button is-small is-danger">刪除</button></form>
                    </td>
                </tr>
            `;
        });
    }
    tableBody.innerHTML = html;
}


// =========================================================================
// Helper Functions (fetchWithAuth, etc.)
// =========================================================================
const JWT_TOKEN = localStorage.getItem('jwt_token');

async function fetchWithAuth(url, options = {}) {
    const headers = { ...options.headers, 'Authorization': `Bearer ${JWT_TOKEN}` };
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
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
// DOMContentLoaded - Main Entry Point
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- WebSocket Connection & Auto-Update ---
    const socket = io();
    socket.on('connect', () => console.log('Socket.IO Connected!'));
    socket.on('media_updated', (data) => {
        console.log('Media updated message received:', data.message);
        fetchDataAndRender();
    });
    socket.on('settings_updated', (data) => {
        console.log('Settings updated message received:', data);
        fetchDataAndRender();
    });

    // --- Auth Check & Initial Render ---
    const authCheckingScreen = document.getElementById('authCheckingScreen');
    const mainContent = document.getElementById('mainContent');

    // 初始化全局DOM元素引用
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

    // 隱藏認證檢查畫面，顯示主內容
    if (authCheckingScreen) {
        authCheckingScreen.style.display = 'none';
    }
    if (mainContent) {
        mainContent.style.display = 'block';
    }

    // 初始化數據並渲染UI
    fetchDataAndRender();

    // 監聽媒體類型變更
    if (mediaTypeSelect) {
        mediaTypeSelect.addEventListener('change', toggleFormFields);
    }

    // 添加檔案選擇事件監聽器
    const fileInput = document.querySelector('.file-input');
    const fileName = document.querySelector('.file-name');
    if (fileInput && fileName) {
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                fileName.textContent = file.name;
            } else {
                fileName.textContent = '未選擇任何檔案';
            }
        });
    }

    // Logout Button
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('jwt_token');
            window.location.href = '/login';
        });
    }

    // Main Upload Form
    const mainUploadForm = document.getElementById('uploadForm');
    if (mainUploadForm) {
        const submitButton = mainUploadForm.querySelector('button[type="submit"]');
        const progressContainer = document.getElementById('upload-progress-container');
        const progressBar = document.getElementById('upload-progress-bar');
        const progressText = document.getElementById('upload-progress-text');

        function resetUploadFormUI() {
            submitButton.classList.remove('is-loading');
            submitButton.disabled = false;
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }

        mainUploadForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            // --- UI Update: Show progress bar ---
            if(progressContainer) progressContainer.style.display = 'block';
            if(progressBar) progressBar.value = 0;
            if(progressText) progressText.textContent = '0%';
            submitButton.classList.add('is-loading');
            submitButton.disabled = true;
            // ------------------------------------

            const formData = new FormData(mainUploadForm);
            const selectedType = document.getElementById('mediaTypeSelect')?.value;
            let apiUrl, httpMethod = 'POST', body = formData;

            if (selectedType === 'image' || selectedType === 'video') {
                apiUrl = '/api/materials';
            } else if (selectedType === 'group_reference') {
                apiUrl = '/api/assignments';
            }

            try {
                const xhr = new XMLHttpRequest();
                xhr.open(httpMethod, apiUrl, true);
                xhr.setRequestHeader('Authorization', `Bearer ${JWT_TOKEN}`);

                xhr.upload.onprogress = function(event) {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        if(progressBar) progressBar.value = percentComplete;
                        if(progressText) progressText.textContent = Math.round(percentComplete) + '%';
                    }
                };

                xhr.onload = function() {
                    resetUploadFormUI();
                    if (xhr.status >= 200 && xhr.status < 300) {
                        fetchDataAndRender();
                        mainUploadForm.reset();
                        document.querySelector('.file-name').textContent = '未選擇任何檔案';
                        toggleFormFields(); // After reset, re-toggle fields to ensure correct state
                    } else {
                        const err = JSON.parse(xhr.responseText);
                        alert(`操作失敗: ${err.message || xhr.statusText}`);
                    }
                };

                xhr.onerror = function() {
                    resetUploadFormUI();
                    alert('上傳過程中發生網路錯誤。');
                };

                xhr.send(body);

            } catch (error) {
                resetUploadFormUI();
                if (error.message !== 'Unauthorized') {
                    alert(`操作失敗: ${error.message}`);
                }
            }
        });
    }

    // Global Settings Form
    const globalSettingsForm = document.getElementById('globalSettingsForm');
    if (globalSettingsForm) {
        globalSettingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saveButton = document.getElementById('saveSettingsButton');
            const notification = document.getElementById('settings-notification');

            saveButton.classList.add('is-loading');
            saveButton.disabled = true;

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

                if (!response.ok) throw new Error(data.message || '儲存設定失敗');

                // SUCCESS: Show notification and then fetch new data
                notification.textContent = data.message || '設定儲存成功！';
                notification.classList.remove('is-hidden', 'is-danger');
                notification.classList.add('is-success');
                setTimeout(() => notification.classList.add('is-hidden'), 3000);

                fetchDataAndRender(); // Re-fetch data to ensure state is in sync

            } catch (error) {
                if (error.message !== 'Unauthorized') {
                    notification.textContent = error.message;
                    notification.classList.remove('is-hidden', 'is-success');
                    notification.classList.add('is-danger');
                    setTimeout(() => notification.classList.add('is-hidden'), 3000);
                }
            } finally {
                saveButton.classList.remove('is-loading');
                saveButton.disabled = false;
            }
        });
    }

    // Delete Forms (using event delegation)
    document.body.addEventListener('submit', async function(event) {
        if (event.target.classList.contains('delete-form')) {
            event.preventDefault();
            const form = event.target;
            const itemId = form.dataset.itemId;
            const itemType = form.dataset.itemType;
            let confirmMessage = '';
            let apiUrl = '';
            let httpMethod = '';

            if (itemType === 'material') {
                confirmMessage = '確定要刪除此素材嗎？此操作不可逆！';
                apiUrl = `/api/materials/${itemId}`;
                httpMethod = 'DELETE';
            } else if (itemType === 'carousel_group') {
                confirmMessage = '確定要刪除此輪播群組嗎？此操作將同時刪除群組內專屬圖片！';
                apiUrl = `/admin/carousel_group/delete/${itemId}`;
                httpMethod = 'POST';
            } else if (itemType === 'assignment') {
                confirmMessage = '確定要刪自此指派嗎？';
                apiUrl = `/api/assignments/${itemId}`;
                httpMethod = 'DELETE';
            }

            if (!confirm(confirmMessage)) return;

            try {
                const response = await fetchWithAuth(apiUrl, { method: httpMethod });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || '刪除失敗');
                }
                // On success, fetch new data and re-render
                fetchDataAndRender();
            } catch (error) {
                if (error.message !== 'Unauthorized') {
                    alert(`刪除失敗: ${error.message}`);
                }
            }
        }
    });

    // Other event listeners (Modals, etc.) would go here
    // They should also call fetchDataAndRender() on success where appropriate
});