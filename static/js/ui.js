import { getState } from './store.js';

// =========================================================================
// DOM Element References
// =========================================================================

const elements = {};

/**
 * Caches all necessary DOM elements for the UI to avoid repeated queries.
 */
function cacheDOMElements() {
    if (Object.keys(elements).length > 0) return; // Cache only once
    elements.mediaTypeSelect = document.getElementById('mediaTypeSelect');
    elements.sectionKeyField = document.getElementById('sectionKeyField');
    elements.fileUploadField = document.getElementById('fileUploadField');
    elements.carouselGroupField = document.getElementById('carouselGroupField');
    elements.carouselOffsetField = document.getElementById('carouselOffsetField');
    elements.sectionKeySelect = document.getElementById('sectionKeySelect');
    elements.mediaListTableBody = document.querySelector('.media-list-table tbody');
    elements.groupAssignmentSelect = document.querySelector('#carouselGroupField select[name="carousel_group_id"]');
    elements.carouselGroupsTableBody = document.querySelector('#createGroupForm').closest('.box').nextElementSibling.querySelector('tbody');
    elements.editGroupModal = document.getElementById('editCarouselGroupModal');
    elements.modalGroupName = document.getElementById('modalGroupName');
    elements.modalGroupId = document.getElementById('modalGroupId');
    elements.selectedImagesList = document.getElementById('selectedImagesList');
    elements.availableImagesList = document.getElementById('availableImagesList');
    elements.reassignModal = document.getElementById('reassignMediaModal');
    elements.reassignMediaFilename = document.getElementById('reassignMediaFilename');
    elements.reassignMediaId = document.getElementById('reassignMediaId');
    elements.reassignMediaType = document.getElementById('reassignMediaType');
    elements.reassignSectionSelect = document.getElementById('reassignSectionSelect');
}


// =========================================================================
// Render Functions - The Core of the UI
// =========================================================================

/**
 * Main render function, subscribed to all state changes.
 * It re-renders the main page and, if active, the modal content.
 */
export function render() {
    cacheDOMElements(); // Ensure elements are cached

    // Render main page components
    renderMediaAndAssignments();
    renderCarouselGroups();
    renderGroupAssignmentDropdown();
    toggleFormFields();

    // Render users table
    const state = getState();
    renderUsersTable(state.users);

    // **THE FIX**: Check if the modal is active and re-render its content if so.
    // This ensures the modal view is always in sync with the latest state.
    if (elements.editGroupModal && elements.editGroupModal.classList.contains('is-active')) {
        console.log('State changed, re-rendering active modal content.');
        renderGroupEditModalContent();
    }
}

/**
 * Renders ONLY the content within the group edit modal.
 * This function is called by the main render loop if the modal is open.
 */
function renderGroupEditModalContent() {
    if (!elements.editGroupModal || !elements.modalGroupId.value) return;

    const groupId = elements.modalGroupId.value;
    const { materials, groups } = getState();
    const targetGroup = groups.find(g => g.id.toString() === groupId.toString());
    const imageIdsInGroup = new Set(targetGroup ? (targetGroup.image_ids || []) : []);
    
    elements.selectedImagesList.innerHTML = '';
    elements.availableImagesList.innerHTML = '';

    const materialUsage = {};
    groups.forEach(g => {
        (g.image_ids || []).forEach(imgId => {
            if (!materialUsage[imgId]) materialUsage[imgId] = [];
            if (g.id.toString() !== groupId.toString()) materialUsage[imgId].push(g.name);
        });
    });

    if (imageIdsInGroup.size === 0) {
        elements.selectedImagesList.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
    } else {
        (targetGroup.image_ids || []).forEach(imgId => {
            const material = materials.find(m => m.id === imgId);
            if (material) elements.selectedImagesList.appendChild(createDraggableImageItem(material, false, materialUsage));
        });
    }

    materials.filter(m => m.type === 'image' && !imageIdsInGroup.has(m.id)).forEach(material => {
        elements.availableImagesList.appendChild(createDraggableImageItem(material, true, materialUsage));
    });
}


// =========================================================================
// UI Component-Specific Renderers (Called by the main `render` function)
// =========================================================================

function renderMediaAndAssignments() {
    if (!elements.mediaListTableBody) return;

    const { assignments, materials, groups, available_sections } = getState();
    const used_material_ids = new Set();
    assignments.forEach(assign => {
        if (assign.content_source_type === 'single_media') used_material_ids.add(assign.media_id);
    });
    groups.forEach(group => (group.image_ids || []).forEach(id => used_material_ids.add(id)));

    let html = '';

    if (assignments && assignments.length > 0) {
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

    elements.mediaListTableBody.innerHTML = html || '<tr><td colspan="4" class="has-text-centered">目前媒體庫為空。</td></tr>';
}

function renderCarouselGroups() {
    if (!elements.carouselGroupsTableBody) return;
    const { groups } = getState();
    let html = '';

    if (!groups || groups.length === 0) {
        html = '<tr><td colspan="3" class="has-text-centered">目前沒有任何輪播圖片組。</td></tr>';
    } else {
        groups.forEach(item => {
            html += `<tr><td>${item.name}</td><td>${(item.image_ids || []).length}</td><td class="actions-cell has-text-right"><button class="button is-small is-link edit-group-images-button" data-group-id="${item.id}" data-group-name="${item.name}">編輯圖片</button><form class="delete-form" data-item-id="${item.id}" data-item-type="carousel_group"><button type="submit" class="button is-small is-danger">刪除</button></form></td></tr>`;
        });
    }
    elements.carouselGroupsTableBody.innerHTML = html;
}

function renderGroupAssignmentDropdown() {
    if (!elements.groupAssignmentSelect) return;
    const { groups } = getState();
    elements.groupAssignmentSelect.innerHTML = '';

    if (!groups || groups.length === 0) {
        elements.groupAssignmentSelect.innerHTML = '<option value="" disabled>沒有可用的輪播組</option>';
    } else {
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            elements.groupAssignmentSelect.appendChild(option);
        });
    }
}

/**
 * Renders the users table with the provided users data.
 * @param {Array} users - Array of user objects from the store.
 */
export function renderUsersTable(users) {
    const usersTableBody = document.getElementById('usersTableBody');
    if (!usersTableBody) return;

    if (!users || users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="4" class="has-text-centered">目前沒有任何使用者。</td></tr>';
        return;
    }

    usersTableBody.innerHTML = users.map(user => {
        const statusTag = user.is_active 
            ? '<span class="tag is-success">啟用</span>' 
            : '<span class="tag is-danger">停用</span>';
        
        const roleTag = user.role === 'admin' 
            ? '<span class="tag is-primary">管理員</span>' 
            : '<span class="tag is-info">一般使用者</span>';

        return `
            <tr>
                <td>${user.username}</td>
                <td>${roleTag}</td>
                <td>${statusTag}</td>
                <td class="actions-cell has-text-right">
                    <button class="button is-small is-info edit-user-button" 
                            data-user-id="${user.id}" 
                            data-user-username="${user.username}"
                            data-user-role="${user.role}"
                            data-user-active="${user.is_active}">
                        編輯
                    </button>
                    <button class="button is-small is-warning reset-password-button" 
                            data-user-id="${user.id}" 
                            data-user-username="${user.username}">
                        重設密碼
                    </button>
                    <button class="button is-small ${user.is_active ? 'is-warning' : 'is-success'} toggle-user-status-button" 
                            data-user-id="${user.id}" 
                            data-user-active="${user.is_active}">
                        ${user.is_active ? '停用' : '啟用'}
                    </button>
                    <button class="button is-small is-danger delete-user-button" 
                            data-user-id="${user.id}" 
                            data-user-username="${user.username}">
                        刪除
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}


// =========================================================================
// UI Helpers & Actions
// =========================================================================

export function toggleFormFields() {
    if (!elements.mediaTypeSelect) return;
    const { available_sections } = getState();
    const selectedType = elements.mediaTypeSelect.value;

    elements.sectionKeyField.style.display = 'block';
    elements.fileUploadField.style.display = (selectedType === 'image' || selectedType === 'video') ? 'block' : 'none';
    elements.carouselGroupField.style.display = (selectedType === 'group_reference') ? 'block' : 'none';
    elements.carouselOffsetField.style.display = (selectedType === 'group_reference') ? 'block' : 'none';

    if (elements.sectionKeySelect) {
        elements.sectionKeySelect.innerHTML = '';
        let sectionsToShow = [];
        if (selectedType === 'group_reference') {
            elements.sectionKeySelect.innerHTML = '<option value="" disabled selected>-- 請選擇輪播區塊 --</option>';
            sectionsToShow = ['carousel_top_left', 'carousel_top_right', 'carousel_bottom_left', 'carousel_bottom_right'];
        } else {
            elements.sectionKeySelect.innerHTML = '<option value="" disabled selected>-- 請選擇區塊 --</option>';
            sectionsToShow = ['header_video', 'carousel_top_left', 'carousel_top_right', 'carousel_bottom_left', 'carousel_bottom_right', 'footer_content'];
        }

        (sectionsToShow || []).forEach(key => {
            if (available_sections && available_sections[key]) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = available_sections[key];
                elements.sectionKeySelect.appendChild(option);
            }
        });
    }
}

export function openGroupEditModal(groupId, groupName) {
    if (!elements.editGroupModal) return;

    elements.modalGroupName.textContent = groupName;
    elements.modalGroupId.value = groupId;

    // The actual content rendering is now separated.
    renderGroupEditModalContent(); 

    elements.editGroupModal.classList.add('is-active');
}

export function openReassignMediaModal(mediaId, mediaType, mediaFilename) {
    if (!elements.reassignModal) return;
    const { available_sections } = getState();

    elements.reassignMediaFilename.textContent = mediaFilename;
    elements.reassignMediaId.value = mediaId;
    elements.reassignMediaType.value = mediaType;

    elements.reassignSectionSelect.innerHTML = '<option value="" disabled selected>-- 請選擇區塊 --</option>';
    const sectionOrder = ['header_video', 'carousel_top_left', 'carousel_top_right', 'carousel_bottom_left', 'carousel_bottom_right', 'footer_content'];
    sectionOrder.forEach(key => {
        if (available_sections[key]) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = available_sections[key];
            elements.reassignSectionSelect.appendChild(option);
        }
    });

    elements.reassignModal.classList.add('is-active');
}

function createDraggableImageItem(material, isAvailable, usage) {
    const item = document.createElement('div');
    item.className = 'image-list-item';
    item.dataset.imageId = material.id;
    item.draggable = true;

    const { groups } = getState();
    let tags = '';
    if (material.source === 'group_specific') {
         const specificOwner = groups.find(g => (g.image_ids || []).includes(material.id));
         if (specificOwner) tags += `<span class="tag is-success is-small">群組: ${specificOwner.name}</span>`;
    }
    if (usage[material.id] && usage[material.id].length > 0) {
         tags += `<span class="tag is-info is-small" title="${usage[material.id].join(', ')}">在其他群組</span>`;
    }

    item.innerHTML = `<img src="${material.url}" alt="${material.original_filename}"><div class="image-item-info"><p>${material.original_filename}</p><div class="tags">${tags}</div></div><button class="button is-small is-light toggle-button"><i class="fas ${isAvailable ? 'fa-plus' : 'fa-minus'}"></i></button>`;
    return item;
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('is-active');
}

export function updateFileName(fileInput, fileNameElement) {
    if (fileInput.files.length > 0) {
        fileNameElement.textContent = fileInput.files.length > 1 ? `${fileInput.files.length} 個檔案已選擇` : fileInput.files[0].name;
    } else {
        fileNameElement.textContent = '未選擇任何檔案';
    }
}

export function updateUploadProgress(percent) {
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');

    if (progressContainer) progressContainer.style.display = percent > 0 && percent < 100 ? 'block' : 'none';
    if (progressBar) progressBar.value = percent;
    if (progressText) progressText.textContent = `${Math.round(percent)}%`;
}

export function showNotification(message, type) {
    const notification = document.getElementById('settings-notification');
    if (!notification) return;
    notification.textContent = message;
    notification.className = `notification ${type}`;
    setTimeout(() => { notification.className = 'notification is-hidden'; }, 3000);
}