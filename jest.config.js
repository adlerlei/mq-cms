module.exports = {
  // 測試環境
  testEnvironment: 'jsdom',
  
  // 設定檔案在模組載入前執行
  setupFiles: ['<rootDir>/tests/frontend/setup.js'],
  
  // 測試檔案的路徑模式
  testMatch: [
    '**/tests/frontend/**/*.test.js'
  ],
  
  // 轉換設定
  transform: {
    '^.+\.js$': 'babel-jest',
  },
  
  // 設定測試覆蓋率
  collectCoverageFrom: [
    'static/js/**/*.js',
    '!static/js/**/*.min.js'
  ],
  
  // 覆蓋率閾值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // 靜音 console.log（在測試中）
  silent: false,
  verbose: true
};
