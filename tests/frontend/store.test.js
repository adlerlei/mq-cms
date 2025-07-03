import { subscribe, setState, getState } from '../../static/js/store.js';

describe('Store Module', () => {
  // 在每個測試之前重置 store 狀態
  beforeEach(() => {
    // 重置狀態到初始值
    setState({
      media: [],
      groups: [],
      assignments: [],
      materials: [],
      settings: {},
      available_sections: {}
    });
  });

  describe('getState', () => {
    test('應該返回當前狀態的副本', () => {
      const state = getState();
      expect(state).toEqual({
        media: [],
        groups: [],
        assignments: [],
        materials: [],
        settings: {},
        available_sections: {}
      });
    });

    test('返回的狀態應該是一個副本，不是原始狀態對象', () => {
      const state1 = getState();
      const state2 = getState();
      
      // 應該有相同的值但不是同一個對象
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe('setState', () => {
    test('應該能夠更新狀態', () => {
      const newMedia = [{ id: 1, name: 'test.jpg' }];
      setState({ media: newMedia });
      
      const state = getState();
      expect(state.media).toEqual(newMedia);
    });

    test('應該能夠部分更新狀態', () => {
      setState({ media: [{ id: 1 }] });
      setState({ groups: [{ id: 2 }] });
      
      const state = getState();
      expect(state.media).toEqual([{ id: 1 }]);
      expect(state.groups).toEqual([{ id: 2 }]);
    });

    test('應該合併新狀態而不是替換整個狀態', () => {
      setState({ media: [{ id: 1 }] });
      setState({ settings: { theme: 'dark' } });
      
      const state = getState();
      expect(state.media).toEqual([{ id: 1 }]);
      expect(state.settings).toEqual({ theme: 'dark' });
      expect(state.groups).toEqual([]);
    });
  });

  describe('subscribe', () => {
    test('應該能夠訂閱狀態變化', () => {
      const mockListener = jest.fn();
      
      subscribe(mockListener);
      setState({ media: [{ id: 1 }] });
      
      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    test('多個監聽器都應該被調用', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();
      
      subscribe(mockListener1);
      subscribe(mockListener2);
      setState({ media: [{ id: 1 }] });
      
      expect(mockListener1).toHaveBeenCalledTimes(1);
      expect(mockListener2).toHaveBeenCalledTimes(1);
    });

    test('應該返回一個取消訂閱的函數', () => {
      const mockListener = jest.fn();
      
      const unsubscribe = subscribe(mockListener);
      expect(typeof unsubscribe).toBe('function');
      
      // 調用取消訂閱函數
      unsubscribe();
      setState({ media: [{ id: 1 }] });
      
      // 監聽器不應該被調用
      expect(mockListener).not.toHaveBeenCalled();
    });

    test('取消訂閱後，其他監聽器仍然應該工作', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();
      
      const unsubscribe1 = subscribe(mockListener1);
      subscribe(mockListener2);
      
      // 取消第一個監聽器的訂閱
      unsubscribe1();
      setState({ media: [{ id: 1 }] });
      
      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('狀態一致性', () => {
    test('狀態變化應該正確反映在後續的 getState 調用中', () => {
      const initialState = getState();
      expect(initialState.media).toEqual([]);
      
      const newMedia = [{ id: 1, name: 'test.jpg' }];
      setState({ media: newMedia });
      
      const updatedState = getState();
      expect(updatedState.media).toEqual(newMedia);
      expect(updatedState.media).not.toBe(initialState.media);
    });
  });
});
