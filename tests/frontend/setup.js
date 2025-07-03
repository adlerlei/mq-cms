// Global test setup file - runs before each test file

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
localStorageMock.getItem.mockReturnValue(null);
global.localStorage = localStorageMock;

// Mock window.alert
global.alert = jest.fn();

// Mock window.location - just track the href changes
global.originalLocationHref = window.location.href;

// Mock fetch globally
global.fetch = jest.fn();

// Mock XMLHttpRequest
global.XMLHttpRequest = jest.fn(() => ({
  open: jest.fn(),
  setRequestHeader: jest.fn(),
  send: jest.fn(),
  upload: {},
  onload: null,
  onerror: null,
  status: 200,
  responseText: '{"success": true}'
}));
