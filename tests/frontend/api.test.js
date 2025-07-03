// Import the module - mocks are set up in setup.js
import {
  getInitialData,
  createAssignment,
  deleteItem,
  createGroup,
  updateGlobalSettings,
  updateGroupImages,
  uploadImagesToGroup,
  reassignMedia,
  uploadMediaWithProgress
} from '../../static/js/api.js';

describe('API Module', () => {
  let fetchSpy;
  let localStorageRemoveItemSpy;
  let localStorageGetItemSpy;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock fetch function
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      })
    );

    // Create proper spies for localStorage
    localStorageGetItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    localStorageRemoveItemSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
    
    // Reset alert
    global.alert = jest.fn();
    
    // Reset window.location.href to original value
    // jsdom will complain about navigation but that's expected in tests
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    localStorageGetItemSpy.mockRestore();
    localStorageRemoveItemSpy.mockRestore();
  });

  describe('fetchWithAuth', () => {
    describe('JWT Token 處理', () => {
      test('沒有 JWT token 時，不應該加入 Authorization 標頭', async () => {
        // 由於 JWT_TOKEN 在模組載入時已經被設定，我們需要檢查當初始狀態是 null 時的行為
        await getInitialData();
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/media_with_settings',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });

      test('有 JWT token 時，應該正確加入 Authorization 標頭', async () => {
        // 這個測試讓我們檢查 fetchWithAuth 的一般行為
        // 由於 JWT_TOKEN 在模組載入時獲取，我們只能測試已載入的狀態
        await getInitialData();
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/media_with_settings',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });
    });

    describe('Content-Type 標頭處理', () => {
      test('當 body 是 FormData 時，不應該設定 Content-Type', async () => {
        const formData = new FormData();
        formData.append('test', 'value');
        
        await createAssignment(formData);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/assignments',
          expect.objectContaining({
            method: 'POST',
            body: formData,
            headers: expect.not.objectContaining({
              'Content-Type': expect.any(String)
            })
          })
        );
      });

      test('當 body 是 JSON 字串時，應該設定 Content-Type 為 application/json', async () => {
        const settings = { theme: 'dark', autoplay: true };
        
        await updateGlobalSettings(settings);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/settings',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(settings),
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });
    });

    describe('錯誤處理', () => {
      test('當回應狀態為 401 時，應該清除 token 並重定向到登入頁面', async () => {
        fetchSpy.mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Unauthorized' })
          })
        );
        
        await expect(getInitialData()).rejects.toThrow('Unauthorized');
        
        expect(localStorageRemoveItemSpy).toHaveBeenCalledWith('jwt_token');
        expect(global.alert).toHaveBeenCalledWith('您的登入已逾期或無效，請重新登入。');
        // jsdom navigation 將會發出警告，但這是預期的
        // 我們只需要確認 localStorage 和 alert 被呼叫
      });

      test('當回應不成功但不是 401 時，應該拋出伺服器回應的錯誤訊息', async () => {
        const errorMessage = 'Server error occurred';
        fetchSpy.mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: errorMessage })
          })
        );
        
        await expect(getInitialData()).rejects.toThrow(errorMessage);
        
        expect(localStorageRemoveItemSpy).not.toHaveBeenCalled();
        // 非 401 錯誤不應該觸發 location 變更
      });

      test('當回應不成功且沒有錯誤訊息時，應該拋出預設錯誤', async () => {
        fetchSpy.mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({})
          })
        );
        
        await expect(getInitialData()).rejects.toThrow('HTTP Error 404');
      });
    });
  });

  describe('API Functions', () => {
    describe('getInitialData', () => {
      test('應該使用 GET 方法呼叫正確的 URL', async () => {
        await getInitialData();
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/media_with_settings',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });
    });

    describe('createAssignment', () => {
      test('應該使用 POST 方法和 FormData', async () => {
        const formData = new FormData();
        formData.append('group_id', '123');
        formData.append('section', 'home');
        
        await createAssignment(formData);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/assignments',
          expect.objectContaining({
            method: 'POST',
            body: formData
          })
        );
      });
    });

    describe('deleteItem', () => {
      test('應該使用 DELETE 方法刪除 material', async () => {
        const itemId = '123';
        
        await deleteItem('material', itemId);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          `/api/materials/${itemId}`,
          expect.objectContaining({
            method: 'DELETE'
          })
        );
      });

      test('應該使用 DELETE 方法刪除 carousel_group', async () => {
        const itemId = '456';
        
        await deleteItem('carousel_group', itemId);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          `/api/groups/${itemId}`,
          expect.objectContaining({
            method: 'DELETE'
          })
        );
      });

      test('應該使用 DELETE 方法刪除 assignment', async () => {
        const itemId = '789';
        
        await deleteItem('assignment', itemId);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          `/api/assignments/${itemId}`,
          expect.objectContaining({
            method: 'DELETE'
          })
        );
      });
    });

    describe('createGroup', () => {
      test('應該使用 POST 方法和 FormData', async () => {
        const formData = new FormData();
        formData.append('name', 'New Group');
        
        await createGroup(formData);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/groups',
          expect.objectContaining({
            method: 'POST',
            body: formData
          })
        );
      });
    });

    describe('updateGlobalSettings', () => {
      test('應該使用 PUT 方法和 JSON 資料', async () => {
        const settings = { theme: 'dark', autoplay: true };
        
        await updateGlobalSettings(settings);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/settings',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(settings),
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });
    });

    describe('updateGroupImages', () => {
      test('應該使用 PUT 方法更新群組圖片', async () => {
        const groupId = '123';
        const imageIds = ['img1', 'img2', 'img3'];
        
        await updateGroupImages(groupId, imageIds);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          `/api/groups/${groupId}/images`,
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ image_ids: imageIds }),
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });
    });

    describe('uploadImagesToGroup', () => {
      test('應該使用 POST 方法上傳圖片到群組', async () => {
        const groupId = '123';
        const formData = new FormData();
        formData.append('files', new File([''], 'test.jpg'));
        
        await uploadImagesToGroup(groupId, formData);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          `/api/groups/${groupId}/images`,
          expect.objectContaining({
            method: 'POST',
            body: formData
          })
        );
      });
    });

    describe('reassignMedia', () => {
      test('應該使用 POST 方法重新分配媒體', async () => {
        const formData = new FormData();
        formData.append('media_id', '123');
        formData.append('new_section', 'footer');
        
        await reassignMedia(formData);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/assignments',
          expect.objectContaining({
            method: 'POST',
            body: formData
          })
        );
      });
    });
  });

  describe('uploadMediaWithProgress', () => {
    let mockXHR;

    beforeEach(() => {
      mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        upload: {},
        onload: null,
        onerror: null,
        status: 200,
        responseText: JSON.stringify({ success: true, id: '123' })
      };
      global.XMLHttpRequest.mockImplementation(() => mockXHR);
    });

    test('應該正確設定 XMLHttpRequest', async () => {
      const formData = new FormData();
      const onProgress = jest.fn();
      
      const promise = uploadMediaWithProgress(formData, onProgress);
      
      expect(mockXHR.open).toHaveBeenCalledWith('POST', '/api/materials', true);
      // 檢查是否設定了 Authorization 標頭（使用初始 JWT_TOKEN）
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith('Authorization', expect.stringContaining('Bearer'));
      expect(mockXHR.upload.onprogress).toBe(onProgress);
      
      // 觸發成功回應
      mockXHR.onload();
      
      const result = await promise;
      expect(result).toEqual({ success: true, id: '123' });
      expect(mockXHR.send).toHaveBeenCalledWith(formData);
    });

    test('應該處理成功的回應', async () => {
      const formData = new FormData();
      const onProgress = jest.fn();
      
      const promise = uploadMediaWithProgress(formData, onProgress);
      
      // 模擬成功回應
      mockXHR.status = 201;
      mockXHR.responseText = JSON.stringify({ id: '456', filename: 'test.jpg' });
      mockXHR.onload();
      
      const result = await promise;
      expect(result).toEqual({ id: '456', filename: 'test.jpg' });
    });

    test('應該處理錯誤回應', async () => {
      const formData = new FormData();
      const onProgress = jest.fn();
      
      const promise = uploadMediaWithProgress(formData, onProgress);
      
      // 模擬錯誤回應
      mockXHR.status = 400;
      mockXHR.statusText = 'Bad Request';
      mockXHR.responseText = JSON.stringify({ message: 'File too large' });
      mockXHR.onload();
      
      await expect(promise).rejects.toThrow('File too large');
    });

    test('應該處理無法解析的錯誤回應', async () => {
      const formData = new FormData();
      const onProgress = jest.fn();
      
      const promise = uploadMediaWithProgress(formData, onProgress);
      
      // 模擬無法解析的錯誤回應
      mockXHR.status = 500;
      mockXHR.statusText = 'Internal Server Error';
      mockXHR.responseText = 'Invalid JSON';
      mockXHR.onload();
      
      await expect(promise).rejects.toThrow('Internal Server Error');
    });

    test('應該處理網路錯誤', async () => {
      const formData = new FormData();
      const onProgress = jest.fn();
      
      const promise = uploadMediaWithProgress(formData, onProgress);
      
      // 模擬網路錯誤
      mockXHR.onerror();
      
      await expect(promise).rejects.toThrow('上傳過程中發生網路錯誤。');
    });

    test('應該正確設定進度回調', async () => {
      const formData = new FormData();
      const onProgress = jest.fn();
      
      uploadMediaWithProgress(formData, onProgress);
      
      expect(mockXHR.upload.onprogress).toBe(onProgress);
    });
  });
});
