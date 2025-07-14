
import * as api from './api.js';
import { setState, getState } from './store.js';
import { openGroupEditModal, openReassignMediaModal, closeModal, updateFileName, updateUploadProgress, showNotification, toggleFormFields } from './ui.js';

// =========================================================================
// Event Handlers
// =========================================================================

async function handleUploadFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const selectedType = document.getElementById('mediaTypeSelect')?.value;

    submitButton.classList.add('is-loading');
    submitButton.disabled = true;

    try {
        const formData = new FormData(form);
        if (selectedType === 'group_reference') {
            await api.createAssignment(formData);
        } else {
            await api.uploadMediaWithProgress(formData, (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    updateUploadProgress(percentComplete);
                }
            });
        }
        
        // After a successful operation, fetch all data to ensure UI is in sync
        const data = await api.getInitialData();
        setState({
            assignments: data._debug_all_assignments || [],
            materials: data._debug_all_materials || [],
            groups: data._debug_all_groups || [],
        });

        form.reset();
        const fileNameSpan = form.querySelector('.file-name');
        if (fileNameSpan) fileNameSpan.textContent = '未選擇任何檔案';
        toggleFormFields(); // Reset form fields visibility

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            alert(`操作失敗: ${error.message}`);
        }
    } finally {
        submitButton.classList.remove('is-loading');
        submitButton.disabled = false;
        updateUploadProgress(0); // Hide progress bar
    }
}

async function handleCreateGroupSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const createButton = form.querySelector('button[type="submit"]');
    createButton.classList.add('is-loading');
    try {
        const formData = new FormData(form);
        const newGroup = await api.createGroup(formData);
        const data = await api.getInitialData(); // Refetch to get the full updated list
        setState({ groups: data._debug_all_groups });
        form.reset();
    } catch (error) {
        if (error.message !== 'Unauthorized') alert(`錯誤: ${error.message}`);
    } finally {
        createButton.classList.remove('is-loading');
    }
}

async function handleSettingsSubmit(event) {
    event.preventDefault();
    const saveButton = document.getElementById('saveSettingsButton');
    saveButton.classList.add('is-loading');
    const payload = {
        header_interval: document.getElementById('header_interval').value,
        carousel_interval: document.getElementById('carousel_interval').value,
        footer_interval: document.getElementById('footer_interval').value
    };
    try {
        const result = await api.updateGlobalSettings(payload);
        showNotification(result.message || '設定儲存成功！', 'is-success');
        setState({ settings: payload }); // Optimistically update state
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            showNotification(error.message, 'is-danger');
        }
    } finally {
        saveButton.classList.remove('is-loading');
    }
}

async function handleDeleteFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const itemId = form.dataset.itemId;
    const itemType = form.dataset.itemType;
    const confirmMessages = {
        material: '確定要刪除此素材嗎？此操作不可逆！',
        carousel_group: '確定要刪除此輪播群組嗎？此操作將同時刪除群組內專屬圖片！',
        assignment: '確定要刪除此指派嗎？'
    };

    if (!confirm(confirmMessages[itemType])) return;

    try {
        await api.deleteItem(itemType, itemId);
        const data = await api.getInitialData(); // Refetch all data
        setState({
            assignments: data._debug_all_assignments || [],
            materials: data._debug_all_materials || [],
            groups: data._debug_all_groups || [],
        });
    } catch (error) {
        if (error.message !== 'Unauthorized') alert(`刪除失敗: ${error.message}`);
    }
}

async function handleReassignConfirm(event) {
    const button = event.target;
    const mediaId = document.getElementById('reassignMediaId').value;
    const sectionKey = document.getElementById('reassignSectionSelect').value;

    if (!sectionKey) {
        alert('請選擇一個要指派的區塊。');
        return;
    }

    button.classList.add('is-loading');

    try {
        const formData = new FormData();
        formData.append('section_key', sectionKey);
        formData.append('type', 'single_media');
        formData.append('media_id', mediaId);

        await api.reassignMedia(formData);
        closeModal('reassignMediaModal');
        const data = await api.getInitialData(); // Refetch
        setState({ assignments: data._debug_all_assignments, materials: data._debug_all_materials });

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            alert(`重新指派失敗: ${error.message}`);
        }
    } finally {
        button.classList.remove('is-loading');
    }
}

async function handleSaveGroupChanges(event) {
    const button = event.target;
    button.classList.add('is-loading');
    const groupId = document.getElementById('modalGroupId').value;
    const selectedImagesList = document.getElementById('selectedImagesList');
    const imageIds = [...selectedImagesList.querySelectorAll('.image-list-item')].map(item => item.dataset.imageId);

    try {
        await api.updateGroupImages(groupId, imageIds);
        closeModal('editCarouselGroupModal');
        const data = await api.getInitialData(); // Refetch
        setState({ groups: data._debug_all_groups, materials: data._debug_all_materials });
    } catch (error) {
        if (error.message !== 'Unauthorized') alert(`儲存失敗: ${error.message}`);
    } finally {
        button.classList.remove('is-loading');
    }
}

async function handleGroupImageUpload(event) {
    const button = event.target.closest('#uploadToGroupButton');
    if (!button) return;

    const groupId = document.getElementById('modalGroupId').value;
    const input = document.getElementById('groupImageUpload');
    const files = input.files;

    if (!groupId || files.length === 0) {
        alert('請選擇要上傳的檔案。');
        return;
    }

    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }

    button.classList.add('is-loading');
    button.disabled = true;

    try {
        // 1. Upload the images
        await api.uploadImagesToGroup(groupId, formData);

        // 2. Refetch all data to ensure UI consistency
        const data = await api.getInitialData();
        setState({
            materials: data._debug_all_materials || [],
            groups: data._debug_all_groups || [],
            assignments: data._debug_all_assignments || []
        });

        // 3. Reset the form elements
        input.value = '';
        updateFileName(input, document.getElementById('groupUploadFileName'));
        button.disabled = true;

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            alert(`上傳失敗: ${error.message}`);
        }
        // Re-enable button on failure only if files are still selected
        if (input.files.length > 0) {
            button.disabled = false;
        }
    } finally {
        button.classList.remove('is-loading');
    }
}

// =========================================================================
// Event Listener Initialization (using Delegation)
// =========================================================================

let listenersInitialized = false;

export function initializeEventListeners() {
    if (listenersInitialized) return;

    document.body.addEventListener('submit', (event) => {
        if (event.target.id === 'uploadForm') handleUploadFormSubmit(event);
        if (event.target.id === 'createGroupForm') handleCreateGroupSubmit(event);
        if (event.target.id === 'globalSettingsForm') handleSettingsSubmit(event);
        if (event.target.classList.contains('delete-form')) handleDeleteFormSubmit(event);
    });

    document.body.addEventListener('click', (event) => {
        // Modal triggers
        const editButton = event.target.closest('.edit-group-images-button');
        if (editButton) {
            openGroupEditModal(editButton.dataset.groupId, editButton.dataset.groupName);
        }

        const reassignButton = event.target.closest('.reassign-media-button');
        if (reassignButton) {
            openReassignMediaModal(reassignButton.dataset.mediaId, reassignButton.dataset.mediaType, reassignButton.dataset.mediaFilename);
        }

        // User management buttons
        if (event.target.id === 'addUserButton') {
            openUserModal();
        }

        const editUserButton = event.target.closest('.edit-user-button');
        if (editUserButton) {
            const userId = editUserButton.dataset.userId;
            const username = editUserButton.dataset.userUsername;
            const role = editUserButton.dataset.userRole;
            const isActive = editUserButton.dataset.userActive === 'true';
            openUserModal(userId, username, role, isActive);
        }

        const resetPasswordButton = event.target.closest('.reset-password-button');
        if (resetPasswordButton) {
            const userId = resetPasswordButton.dataset.userId;
            const username = resetPasswordButton.dataset.userUsername;
            openResetPasswordModal(userId, username);
        }

        const toggleUserStatusButton = event.target.closest('.toggle-user-status-button');
        if (toggleUserStatusButton) {
            const userId = toggleUserStatusButton.dataset.userId;
            const isActive = toggleUserStatusButton.dataset.userActive === 'true';
            handleToggleUserStatus(userId, !isActive);
        }

        const deleteUserButton = event.target.closest('.delete-user-button');
        if (deleteUserButton) {
            const userId = deleteUserButton.dataset.userId;
            const username = deleteUserButton.dataset.userUsername;
            handleDeleteUser(userId, username);
        }

        // Modal actions
        if (event.target.id === 'confirmReassignButton') handleReassignConfirm(event);
        if (event.target.id === 'saveGroupChangesButton') handleSaveGroupChanges(event);
        if (event.target.closest('#uploadToGroupButton')) handleGroupImageUpload(event);
        if (event.target.id === 'saveUserButton') handleSaveUser(event);
        if (event.target.id === 'confirmResetPasswordButton') handleResetPassword(event);

        // Modal close buttons
        if (event.target.matches('.modal-background, .modal-card-head .delete, #cancelGroupChangesButton, #cancelReassignButton, #cancelUserButton, #cancelResetPasswordButton')) {
            closeModal('editCarouselGroupModal');
            closeModal('reassignMediaModal');
            closeModal('userManagementModal');
            closeModal('resetPasswordModal');
        }

        // Logout
        if (event.target.id === 'logoutButton') {
            localStorage.removeItem('jwt_token');
            window.location.href = '/login';
        }
        
        // Toggle images in modal
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
    });

    document.body.addEventListener('change', (event) => {
        if (event.target.id === 'mediaTypeSelect') {
            toggleFormFields();
        }
        // File input name display
        if (event.target.matches('.file-input')) {
            const fileInput = event.target;
            const fileNameEl = fileInput.closest('.file').querySelector('.file-name');
            if (fileNameEl) updateFileName(fileInput, fileNameEl);

            // Specifically handle the group image upload button
            if (fileInput.id === 'groupImageUpload') {
                const uploadButton = document.getElementById('uploadToGroupButton');
                if (uploadButton) {
                    uploadButton.disabled = fileInput.files.length === 0;
                }
            }
        }
    });

    // --- Drag and Drop Logic for Modal ---
    let draggedItem = null;
    document.body.addEventListener('dragstart', (event) => {
        if (event.target.classList.contains('image-list-item')) {
            draggedItem = event.target;
            setTimeout(() => { event.target.style.display = 'none'; }, 0);
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

    document.body.addEventListener('dragover', (event) => {
        const list = event.target.closest('.selected-images-list, .available-images-list');
        if (list && draggedItem) {
            event.preventDefault();
            const afterElement = getDragAfterElement(list, event.clientY);
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
        }
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

    listenersInitialized = true;
}

// =========================================================================
// User Management Functions
// =========================================================================

function openUserModal(userId = null, username = '', role = 'admin', isActive = true) {
    const modal = document.getElementById('userManagementModal');
    const title = document.getElementById('userModalTitle');
    const userIdInput = document.getElementById('userFormUserId');
    const usernameInput = document.getElementById('userFormUsername');
    const passwordField = document.getElementById('passwordField');
    const passwordInput = document.getElementById('userFormPassword');
    const roleSelect = document.getElementById('userFormRole');
    const isActiveCheckbox = document.getElementById('userFormIsActive');

    if (userId) {
        // Edit mode
        title.textContent = '編輯使用者';
        userIdInput.value = userId;
        usernameInput.value = username;
        usernameInput.disabled = true; // Don't allow username changes
        passwordField.style.display = 'none'; // Hide password field in edit mode
        passwordInput.required = false;
        roleSelect.value = role;
        isActiveCheckbox.checked = isActive;
    } else {
        // Add mode
        title.textContent = '新增使用者';
        userIdInput.value = '';
        usernameInput.value = '';
        usernameInput.disabled = false;
        passwordField.style.display = 'block';
        passwordInput.required = true;
        roleSelect.value = 'admin';
        isActiveCheckbox.checked = true;
    }

    modal.classList.add('is-active');
}

function openResetPasswordModal(userId, username) {
    const modal = document.getElementById('resetPasswordModal');
    const usernameSpan = document.getElementById('resetPasswordUsername');
    const userIdInput = document.getElementById('resetPasswordUserId');

    usernameSpan.textContent = username;
    userIdInput.value = userId;

    modal.classList.add('is-active');
}

async function handleSaveUser(event) {
    const button = event.target;
    const userId = document.getElementById('userFormUserId').value;
    const username = document.getElementById('userFormUsername').value;
    const password = document.getElementById('userFormPassword').value;
    const role = document.getElementById('userFormRole').value;
    const isActive = document.getElementById('userFormIsActive').checked;

    if (!username) {
        alert('請輸入使用者名稱');
        return;
    }

    if (!userId && !password) {
        alert('請輸入密碼');
        return;
    }

    button.classList.add('is-loading');
    button.disabled = true;

    try {
        if (userId) {
            // Update existing user
            const updateData = { role, is_active: isActive };
            await api.updateUser(parseInt(userId), updateData);
            alert('使用者資訊更新成功！');
        } else {
            // Create new user
            const userData = { username, password, role, is_active: isActive };
            await api.createUser(userData);
            alert('使用者建立成功！');
        }

        closeModal('userManagementModal');
        // Refresh users data
        await refreshUsersData();
    } catch (error) {
        console.error('儲存使用者時發生錯誤:', error);
        alert(`操作失敗: ${error.message}`);
    } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
    }
}

async function handleResetPassword(event) {
    const button = event.target;
    const userId = document.getElementById('resetPasswordUserId').value;
    const newPassword = document.getElementById('resetPasswordNewPassword').value;
    const confirmPassword = document.getElementById('resetPasswordConfirm').value;

    if (!newPassword) {
        alert('請輸入新密碼');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('兩次輸入的密碼不一致');
        return;
    }

    button.classList.add('is-loading');
    button.disabled = true;

    try {
        await api.resetUserPassword(parseInt(userId), newPassword);
        alert('密碼重設成功！');
        closeModal('resetPasswordModal');
        // Reset form
        document.getElementById('resetPasswordForm').reset();
    } catch (error) {
        console.error('重設密碼時發生錯誤:', error);
        alert(`重設密碼失敗: ${error.message}`);
    } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
    }
}

async function handleToggleUserStatus(userId, newStatus) {
    try {
        await api.updateUser(parseInt(userId), { is_active: newStatus });
        alert(`使用者狀態已${newStatus ? '啟用' : '停用'}`);
        // Refresh users data
        await refreshUsersData();
    } catch (error) {
        console.error('更新使用者狀態時發生錯誤:', error);
        alert(`操作失敗: ${error.message}`);
    }
}

async function handleDeleteUser(userId, username) {
    if (!confirm(`確定要刪除使用者「${username}」嗎？此操作無法復原。`)) {
        return;
    }

    try {
        await api.deleteUser(parseInt(userId));
        alert('使用者刪除成功！');
        // Refresh users data
        await refreshUsersData();
    } catch (error) {
        console.error('刪除使用者時發生錯誤:', error);
        alert(`刪除失敗: ${error.message}`);
    }
}

async function refreshUsersData() {
    try {
        const response = await api.getUsers();
        setState({ users: response.data });
    } catch (error) {
        console.error('重新載入使用者資料時發生錯誤:', error);
    }
}
