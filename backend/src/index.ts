import { createApp } from './app';
import { migrate } from './config/migrate';

const PORT = process.env.PORT || 7001;

// 启动服务器
async function start() {
  try {
    // 确保数据库迁移完成
    await migrate();
    
    const app = createApp();
    const server = app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`📝 API 文档: http://localhost:${PORT}/api/v1`);
    });
    
    // 处理服务器错误
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，请检查是否有其他服务在运行`);
      } else {
        console.error('❌ 服务器错误:', error);
      }
    });
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('❌ 未捕获的异常:', error);
      // 不退出进程，让服务继续运行
    });
    
    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未处理的 Promise 拒绝:', reason);
      // 不退出进程，让服务继续运行
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

start();
