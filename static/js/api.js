
// =========================================================================
// API Layer
// =========================================================================

const JWT_TOKEN = localStorage.getItem('jwt_token');

/**
 * A wrapper around fetch that adds JWT authentication and handles common errors.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options (method, body, etc.).
 * @returns {Promise<any>} - The JSON response from the server.
 */
async function fetchWithAuth(url, options = {}) {
    const headers = { ...options.headers };
    if (JWT_TOKEN) {
        headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
    }

    // Don't set Content-Type for FormData, the browser does it.
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

    const responseData = await response.json();

    if (!response.ok) {
        throw new Error(responseData.message || `HTTP Error ${response.status}`);
    }

    return responseData;
}

/**
 * Fetches all the initial data needed for the admin panel.
 */
export function getInitialData() {
    return fetchWithAuth('/api/media_with_settings');
}

/**
 * Creates a new assignment (e.g., assigning a group to a section).
 * @param {FormData} formData - The form data for the assignment.
 */
export function createAssignment(formData) {
    return fetchWithAuth('/api/assignments', { method: 'POST', body: formData });
}

/**
 * Deletes an item from the server.
 * @param {'material' | 'carousel_group' | 'assignment'} itemType - The type of item to delete.
 * @param {string} itemId - The ID of the item to delete.
 */
export function deleteItem(itemType, itemId) {
    const apiDetails = {
        material: { url: `/api/materials/${itemId}` },
        carousel_group: { url: `/api/groups/${itemId}` },
        assignment: { url: `/api/assignments/${itemId}` }
    };
    return fetchWithAuth(apiDetails[itemType].url, { method: 'DELETE' });
}

/**
 * Creates a new carousel group.
 * @param {FormData} formData - The form data containing the group name.
 */
export function createGroup(formData) {
    return fetchWithAuth('/api/groups', { method: 'POST', body: formData });
}

/**
 * Updates the global player settings.
 * @param {object} settings - The settings object.
 */
export function updateGlobalSettings(settings) {
    return fetchWithAuth('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

/**
 * Updates the images within a specific group.
 * @param {string} groupId - The ID of the group.
 * @param {string[]} imageIds - An array of image IDs.
 */
export function updateGroupImages(groupId, imageIds) {
    return fetchWithAuth(`/api/groups/${groupId}/images`, {
        method: 'PUT',
        body: JSON.stringify({ image_ids: imageIds })
    });
}

/**
 * Uploads images specifically to a carousel group.
 * @param {string} groupId - The ID of the group.
 * @param {FormData} formData - The FormData containing the files.
 */
export function uploadImagesToGroup(groupId, formData) {
    return fetchWithAuth(`/api/groups/${groupId}/images`, {
        method: 'POST',
        body: formData
    });
}

/**
 * Reassigns an existing media item to a new section.
 * @param {FormData} formData - The form data for the reassignment.
 */
export function reassignMedia(formData) {
    return fetchWithAuth('/api/assignments', { method: 'POST', body: formData });
}

/**
 * Uploads a new media file using XMLHttpRequest for progress tracking.
 * @param {FormData} formData - The form data containing the file.
 * @param {function(ProgressEvent): void} onProgress - Callback for upload progress.
 * @returns {Promise<any>} - The parsed JSON response.
 */
export function uploadMediaWithProgress(formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/materials', true);
        xhr.setRequestHeader('Authorization', `Bearer ${JWT_TOKEN}`);

        xhr.upload.onprogress = onProgress;

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                try {
                    const err = JSON.parse(xhr.responseText);
                    reject(new Error(err.message || xhr.statusText));
                } catch (e) {
                    reject(new Error(xhr.statusText));
                }
            }
        };

        xhr.onerror = () => {
            reject(new Error('上傳過程中發生網路錯誤。'));
        };

        xhr.send(formData);
    });
}
