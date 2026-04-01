import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeDataFromAPI } from './services/okrService';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 初始化数据（从后端 API 加载）
// 注意：不阻塞应用启动，即使初始化失败也要渲染应用
initializeDataFromAPI().catch(error => {
  console.error('初始化数据失败:', error);
  // 初始化失败不影响应用启动，用户仍然可以访问登录页面
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);