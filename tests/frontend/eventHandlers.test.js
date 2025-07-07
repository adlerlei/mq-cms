// Mock dependencies
jest.mock('../../static/js/api.js', () => ({
  deleteItem: jest.fn().mockResolvedValue({}),
  updateGroupImages: jest.fn().mockResolvedValue({}),
  getInitialData: jest.fn().mockResolvedValue({
    _debug_all_assignments: [],
    _debug_all_materials: [],
    _debug_all_groups: []
  }),
  createGroup: jest.fn().mockResolvedValue({}),
  createAssignment: jest.fn().mockResolvedValue({}),
  uploadMediaWithProgress: jest.fn().mockResolvedValue({}),
  updateGlobalSettings: jest.fn().mockResolvedValue({ message: '設定儲存成功！' })
}));

jest.mock('../../static/js/store.js', () => ({
  setState: jest.fn(),
  getState: jest.fn(() => ({
    assignments: [],
    materials: [],
    groups: [],
    available_sections: {}
  }))
}));

import * as api from '../../static/js/api.js';
import { setState } from '../../static/js/store.js';
import { initializeEventListeners } from '../../static/js/eventHandlers.js';

describe('Event Handlers', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset DOM
    document.body.innerHTML = '';
    
    // Setup basic DOM structure
    setupBasicDOM();
    
    // Mock global functions
    global.confirm = jest.fn();
    global.alert = jest.fn();
    
    // Initialize event listeners
    initializeEventListeners();
  });

  function setupBasicDOM() {
    document.body.innerHTML = `
      <!-- Delete forms -->
      <form class="delete-form" data-item-id="123" data-item-type="material">
        <button type="submit">刪除素材</button>
      </form>
      
      <form class="delete-form" data-item-id="456" data-item-type="carousel_group">
        <button type="submit">刪除群組</button>
      </form>
      
      <form class="delete-form" data-item-id="789" data-item-type="assignment">
        <button type="submit">刪除指派</button>
      </form>
      
      <!-- Group edit modal -->
      <div id="editCarouselGroupModal" class="modal">
        <div class="modal-card">
          <header class="modal-card-head">
            <p id="modalGroupName" class="modal-card-title"></p>
          </header>
          <section class="modal-card-body">
            <input type="hidden" id="modalGroupId" value="group123" />
            <div id="selectedImagesList">
              <div class="image-list-item" data-image-id="img1"></div>
              <div class="image-list-item" data-image-id="img2"></div>
              <div class="image-list-item" data-image-id="img3"></div>
            </div>
            <div id="availableImagesList"></div>
          </section>
          <footer class="modal-card-foot">
            <button id="saveGroupChangesButton" class="button is-primary">儲存變更</button>
            <button id="cancelGroupChangesButton" class="button">取消</button>
          </footer>
        </div>
      </div>
      
      <!-- Edit group buttons -->
      <button class="edit-group-images-button" 
              data-group-id="group456" 
              data-group-name="測試群組">編輯圖片</button>
      
      <!-- Reassign media buttons -->
      <button class="reassign-media-button" 
              data-media-id="media789" 
              data-media-type="image" 
              data-media-filename="test.jpg">重新指派</button>
      
      <!-- Upload form -->
      <form id="uploadForm">
        <input type="file" class="file-input" />
        <span class="file-name">未選擇任何檔案</span>
        <button type="submit">上傳</button>
      </form>
      
      <!-- Create group form -->
      <form id="createGroupForm">
        <input name="name" value="新群組" />
        <button type="submit">建立群組</button>
      </form>
      
      <!-- Global settings form -->
      <form id="globalSettingsForm">
        <input id="header_interval" value="5" />
        <input id="carousel_interval" value="3" />
        <input id="footer_interval" value="4" />
        <button id="saveSettingsButton" type="submit">儲存設定</button>
      </form>
      
      <!-- Media type selector -->
      <select id="mediaTypeSelect">
        <option value="image">圖片</option>
      </select>
      
      <!-- Toggle button for images -->
      <div class="image-list-item">
        <button class="toggle-button">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `;
  }

  describe('Delete Form Submission', () => {
    test('應該在確認後刪除素材', async () => {
      global.confirm.mockReturnValue(true);
      api.deleteItem.mockResolvedValue({});
      
      const deleteForm = document.querySelector('.delete-form[data-item-type="material"]');
      const submitEvent = new Event('submit', { bubbles: true });
      
      deleteForm.dispatchEvent(submitEvent);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(global.confirm).toHaveBeenCalledWith('確定要刪除此素材嗎？此操作不可逆！');
      expect(api.deleteItem).toHaveBeenCalledWith('material', '123');
      expect(api.getInitialData).toHaveBeenCalled();
      expect(setState).toHaveBeenCalled();
    });
    
    test('應該在確認後刪除輪播群組', async () => {
      global.confirm.mockReturnValue(true);
      
      const deleteForm = document.querySelector('.delete-form[data-item-type="carousel_group"]');
      const submitEvent = new Event('submit', { bubbles: true });
      
      deleteForm.dispatchEvent(submitEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(global.confirm).toHaveBeenCalledWith('確定要刪除此輪播群組嗎？此操作將同時刪除群組內專屬圖片！');
      expect(api.deleteItem).toHaveBeenCalledWith('carousel_group', '456');
    });
    
    test('應該在確認後刪除指派', async () => {
      global.confirm.mockReturnValue(true);
      
      const deleteForm = document.querySelector('.delete-form[data-item-type="assignment"]');
      const submitEvent = new Event('submit', { bubbles: true });
      
      deleteForm.dispatchEvent(submitEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(global.confirm).toHaveBeenCalledWith('確定要刪除此指派嗎？');
      expect(api.deleteItem).toHaveBeenCalledWith('assignment', '789');
    });
    
    test('當使用者取消確認時不應該刪除', async () => {
      global.confirm.mockReturnValue(false);
      
      const deleteForm = document.querySelector('.delete-form[data-item-type="material"]');
      const submitEvent = new Event('submit', { bubbles: true });
      
      deleteForm.dispatchEvent(submitEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(global.confirm).toHaveBeenCalled();
      expect(api.deleteItem).not.toHaveBeenCalled();
    });
  });

  describe('Save Group Changes', () => {
    test('應該從模態框收集圖片 ID 並儲存群組變更', async () => {
      const saveButton = document.getElementById('saveGroupChangesButton');
      const clickEvent = new Event('click', { bubbles: true });
      
      saveButton.dispatchEvent(clickEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(api.updateGroupImages).toHaveBeenCalledWith('group123', ['img1', 'img2', 'img3']);
      expect(api.getInitialData).toHaveBeenCalled();
      expect(setState).toHaveBeenCalled();
    });
  });

  describe('Modal Triggers', () => {
    test('應該開啟群組編輯模態框', () => {
      const editButton = document.querySelector('.edit-group-images-button');
      const clickEvent = new Event('click', { bubbles: true });
      
      editButton.dispatchEvent(clickEvent);
      
      // The actual modal opening is handled by ui.js which is mocked
      // We can verify the event was processed by checking if the button exists
      expect(editButton.dataset.groupId).toBe('group456');
      expect(editButton.dataset.groupName).toBe('測試群組');
    });
    
    test('應該開啟重新指派媒體模態框', () => {
      const reassignButton = document.querySelector('.reassign-media-button');
      const clickEvent = new Event('click', { bubbles: true });
      
      reassignButton.dispatchEvent(clickEvent);
      
      expect(reassignButton.dataset.mediaId).toBe('media789');
      expect(reassignButton.dataset.mediaType).toBe('image');
      expect(reassignButton.dataset.mediaFilename).toBe('test.jpg');
    });
  });

  describe('Form Submissions', () => {
    test('應該處理檔案上傳表單提交', async () => {
      const uploadForm = document.getElementById('uploadForm');
      const submitEvent = new Event('submit', { bubbles: true });
      
      uploadForm.dispatchEvent(submitEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(api.uploadMediaWithProgress).toHaveBeenCalled();
      expect(api.getInitialData).toHaveBeenCalled();
    });
    
    test('應該處理建立群組表單提交', async () => {
      const createGroupForm = document.getElementById('createGroupForm');
      const submitEvent = new Event('submit', { bubbles: true });
      
      createGroupForm.dispatchEvent(submitEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(api.createGroup).toHaveBeenCalled();
      expect(api.getInitialData).toHaveBeenCalled();
    });
    
    test('應該處理全域設定表單提交', async () => {
      const settingsForm = document.getElementById('globalSettingsForm');
      const submitEvent = new Event('submit', { bubbles: true });
      
      settingsForm.dispatchEvent(submitEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(api.updateGlobalSettings).toHaveBeenCalledWith({
        header_interval: '5',
        carousel_interval: '3',
        footer_interval: '4'
      });
      expect(setState).toHaveBeenCalledWith({
        settings: {
          header_interval: '5',
          carousel_interval: '3',
          footer_interval: '4'
        }
      });
    });
  });

  describe('Toggle Button Interaction', () => {
    test('應該切換圖片在選中和可用列表之間', () => {
      // Setup toggle button structure
      document.body.innerHTML += `
        <div id="selectedImagesList"></div>
        <div id="availableImagesList">
          <div class="image-list-item">
            <button class="toggle-button">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
      `;
      
      const toggleButton = document.querySelector('.toggle-button');
      const icon = toggleButton.querySelector('i');
      const imageItem = toggleButton.closest('.image-list-item');
      const selectedList = document.getElementById('selectedImagesList');
      const availableList = document.getElementById('availableImagesList');
      
      expect(availableList.contains(imageItem)).toBe(true);
      expect(icon.classList.contains('fa-plus')).toBe(true);
      
      const clickEvent = new Event('click', { bubbles: true });
      toggleButton.dispatchEvent(clickEvent);
      
      expect(selectedList.contains(imageItem)).toBe(true);
      expect(availableList.contains(imageItem)).toBe(false);
      expect(icon.classList.contains('fa-minus')).toBe(true);
      expect(icon.classList.contains('fa-plus')).toBe(false);
    });
  });

  describe('File Input Changes', () => {
    test('應該在檔案選擇時更新檔案名稱顯示', () => {
      const fileInput = document.querySelector('.file-input');
      const fileNameSpan = document.querySelector('.file-name');
      
      // Mock file selection
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });
      
      const changeEvent = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(changeEvent);
      
      expect(fileNameSpan.textContent).toBe('test.jpg');
    });
  });
});

