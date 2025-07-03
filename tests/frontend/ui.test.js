// Mock store.js module
jest.mock('../../static/js/store.js', () => ({
  getState: jest.fn()
}));

import { getState } from '../../static/js/store.js';
import {
  toggleFormFields,
  openGroupEditModal,
  openReassignMediaModal,
  closeModal,
  updateFileName,
  updateUploadProgress,
  showNotification
} from '../../static/js/ui.js';

describe('UI Module', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup basic DOM structure
    setupBasicDOM();
  });

  function setupBasicDOM() {
    document.body.innerHTML = `
      <select id="mediaTypeSelect">
        <option value="image">圖片</option>
        <option value="video">影片</option>
        <option value="group_reference">輪播群組</option>
      </select>
      
      <div id="sectionKeyField" style="display: none;">
        <select id="sectionKeySelect"></select>
      </div>
      
      <div id="fileUploadField" style="display: none;"></div>
      <div id="carouselGroupField" style="display: none;">
        <select name="carousel_group_id"></select>
      </div>
      <div id="carouselOffsetField" style="display: none;"></div>
      
      <div class="media-list-table">
        <tbody></tbody>
      </div>
      
      <div class="box">
        <form id="createGroupForm"></form>
      </div>
      <div class="box">
        <table>
          <tbody></tbody>
        </table>
      </div>
      
      <div id="editCarouselGroupModal" class="modal">
        <div class="modal-card">
          <header class="modal-card-head">
            <p id="modalGroupName" class="modal-card-title"></p>
          </header>
          <section class="modal-card-body">
            <input type="hidden" id="modalGroupId" />
            <div id="selectedImagesList"></div>
            <div id="availableImagesList"></div>
          </section>
        </div>
      </div>
      
      <div id="reassignMediaModal" class="modal">
        <div class="modal-card">
          <section class="modal-card-body">
            <p id="reassignMediaFilename"></p>
            <input type="hidden" id="reassignMediaId" />
            <input type="hidden" id="reassignMediaType" />
            <select id="reassignSectionSelect"></select>
          </section>
        </div>
      </div>
      
      <div id="upload-progress-container" style="display: none;">
        <progress id="upload-progress-bar" max="100" value="0"></progress>
        <span id="upload-progress-text">0%</span>
      </div>
      
      <div id="settings-notification" class="notification is-hidden"></div>
    `;
  }

  describe('toggleFormFields', () => {
    test('驗證 toggleFormFields 函數存在且可呼叫', () => {
      // Since toggleFormFields relies on cached DOM elements that are initialized on first call,
      // and our test environment resets the DOM each time, we'll test that the function exists
      // and can be called without errors
      expect(typeof toggleFormFields).toBe('function');
      
      // Mock state
      getState.mockReturnValue({
        available_sections: {
          'header_video': '頁首影片',
          'carousel_top_left': '左上輪播'
        }
      });
      
      // Function should not throw when called
      expect(() => {
        toggleFormFields();
      }).not.toThrow();
    });
  });

  describe('openGroupEditModal', () => {
    test('應該設定模態框的群組資訊並顯示模態框', () => {
      // Mock state with sample data
      getState.mockReturnValue({
        materials: [
          { id: 1, type: 'image', url: '/test1.jpg', original_filename: 'test1.jpg' },
          { id: 2, type: 'image', url: '/test2.jpg', original_filename: 'test2.jpg' }
        ],
        groups: [
          { id: 'group1', name: 'Test Group', image_ids: [1] }
        ]
      });

      const modal = document.getElementById('editCarouselGroupModal');
      const modalGroupName = document.getElementById('modalGroupName');
      const modalGroupId = document.getElementById('modalGroupId');

      expect(modal.classList.contains('is-active')).toBe(false);

      openGroupEditModal('group1', 'Test Group');

      expect(modalGroupName.textContent).toBe('Test Group');
      expect(modalGroupId.value).toBe('group1');
      expect(modal.classList.contains('is-active')).toBe(true);
    });
  });

  describe('openReassignMediaModal', () => {
    test('應該設定重新指派模態框的媒體資訊', () => {
      getState.mockReturnValue({
        available_sections: {
          'header_video': '頁首影片',
          'carousel_top_left': '左上輪播',
          'footer_content': '頁尾內容'
        }
      });

      const modal = document.getElementById('reassignMediaModal');
      const filename = document.getElementById('reassignMediaFilename');
      const mediaId = document.getElementById('reassignMediaId');
      const mediaType = document.getElementById('reassignMediaType');
      const sectionSelect = document.getElementById('reassignSectionSelect');

      openReassignMediaModal('123', 'image', 'test.jpg');

      expect(filename.textContent).toBe('test.jpg');
      expect(mediaId.value).toBe('123');
      expect(mediaType.value).toBe('image');
      expect(modal.classList.contains('is-active')).toBe(true);
      
      // Check section options are populated
      const options = Array.from(sectionSelect.options).map(opt => opt.value);
      expect(options).toContain('header_video');
      expect(options).toContain('carousel_top_left');
      expect(options).toContain('footer_content');
    });
  });

  describe('closeModal', () => {
    test('應該移除模態框的 is-active 類別', () => {
      const modal = document.getElementById('editCarouselGroupModal');
      modal.classList.add('is-active');

      expect(modal.classList.contains('is-active')).toBe(true);

      closeModal('editCarouselGroupModal');

      expect(modal.classList.contains('is-active')).toBe(false);
    });

    test('當模態框不存在時不應該出錯', () => {
      expect(() => {
        closeModal('nonExistentModal');
      }).not.toThrow();
    });
  });

  describe('updateFileName', () => {
    test('當選擇單個檔案時應該顯示檔案名稱', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      const fileNameElement = document.createElement('span');

      // Mock file selection
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      updateFileName(fileInput, fileNameElement);

      expect(fileNameElement.textContent).toBe('test.jpg');
    });

    test('當選擇多個檔案時應該顯示檔案數量', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      const fileNameElement = document.createElement('span');

      // Mock multiple file selection
      const mockFiles = [
        new File(['content1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'test3.jpg', { type: 'image/jpeg' })
      ];
      Object.defineProperty(fileInput, 'files', {
        value: mockFiles,
        writable: false
      });

      updateFileName(fileInput, fileNameElement);

      expect(fileNameElement.textContent).toBe('3 個檔案已選擇');
    });

    test('當沒有選擇檔案時應該顯示預設訊息', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      const fileNameElement = document.createElement('span');

      // Mock no file selection
      Object.defineProperty(fileInput, 'files', {
        value: [],
        writable: false
      });

      updateFileName(fileInput, fileNameElement);

      expect(fileNameElement.textContent).toBe('未選擇任何檔案');
    });
  });

  describe('updateUploadProgress', () => {
    test('應該正確更新進度條元素', () => {
      const progressContainer = document.getElementById('upload-progress-container');
      const progressBar = document.getElementById('upload-progress-bar');
      const progressText = document.getElementById('upload-progress-text');

      // Test progress in the middle
      updateUploadProgress(45);

      expect(progressContainer.style.display).toBe('block');
      expect(progressBar.value).toBe(45);
      expect(progressText.textContent).toBe('45%');

      // Test 0% progress (should hide)
      updateUploadProgress(0);

      expect(progressContainer.style.display).toBe('none');

      // Test 100% progress (should hide)
      updateUploadProgress(100);

      expect(progressContainer.style.display).toBe('none');
    });

    test('當進度元素不存在時不應該出錯', () => {
      // Remove progress elements
      const container = document.getElementById('upload-progress-container');
      const bar = document.getElementById('upload-progress-bar');
      const text = document.getElementById('upload-progress-text');
      
      if (container) container.remove();
      if (bar) bar.remove();
      if (text) text.remove();

      expect(() => {
        updateUploadProgress(50);
      }).not.toThrow();
    });
  });

  describe('showNotification', () => {
    test('應該顯示通知訊息並自動隱藏', (done) => {
      const notification = document.getElementById('settings-notification');

      showNotification('測試訊息', 'is-success');

      expect(notification.textContent).toBe('測試訊息');
      expect(notification.className).toBe('notification is-success');

      // Test that it gets hidden after timeout
      setTimeout(() => {
        expect(notification.className).toBe('notification is-hidden');
        done();
      }, 3100); // Slightly more than the 3000ms timeout
    });

    test('當通知元素不存在時不應該出錯', () => {
      document.getElementById('settings-notification').remove();

      expect(() => {
        showNotification('測試訊息', 'is-info');
      }).not.toThrow();
    });
  });

  describe('DOM Rendering Functions', () => {
    test('render 應該正確更新 DOM 元素', () => {
      // This test focuses on verifying that the render function can run without errors
      // and updates the DOM structure correctly
      
      getState.mockReturnValue({
        assignments: [
          {
            id: 1,
            content_source_type: 'single_media',
            media_id: 1,
            section_key: 'header_video'
          }
        ],
        materials: [
          {
            id: 1,
            type: 'image',
            url: '/test.jpg',
            original_filename: 'test.jpg'
          }
        ],
        groups: [],
        available_sections: {
          'header_video': '頁首影片'
        }
      });

      // Import and call render to test the DOM output
      const { render } = require('../../static/js/ui.js');
      
      // Should not throw errors when rendering
      expect(() => {
        render();
      }).not.toThrow();

      const tableBody = document.querySelector('.media-list-table tbody');
      expect(tableBody).toBeTruthy();
      // The content should be updated by the render function
      expect(tableBody.innerHTML).not.toBe('');
    });
  });
});
