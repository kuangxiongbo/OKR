import 'express-async-errors';
import express, { Express } from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import okrRoutes from './routes/okrs';
import workflowRoutes from './routes/workflows';
import gradeConfigRoutes from './routes/gradeConfigs';
import departmentRoutes from './routes/departments';
import customRoleRoutes from './routes/customRoles';
import logRoutes from './routes/logs';
import configRoutes from './routes/configs';

// 创建 Express 应用（不包含启动逻辑，用于测试）
export function createApp(): Express {
  const app: Express = express();

  // 中间件
  app.use(cors());
  // 允许较大的 AI 导入请求体（base64 图片/文件）
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // 根路径
  app.get('/', (req, res) => {
    res.json({
      name: 'OKR System Backend API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        auth: '/api/v1/auth',
        users: '/api/v1/users',
        okrs: '/api/v1/okrs',
        workflows: '/api/v1/workflows',
        gradeConfigs: '/api/v1/grade-configs',
        departments: '/api/v1/departments',
        customRoles: '/api/v1/custom-roles',
        logs: '/api/v1/logs',
        configs: '/api/v1/configs'
      },
      documentation: '访问 /api/v1/* 路径使用 API'
    });
  });

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API 路由
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/okrs', okrRoutes);
  app.use('/api/v1/workflows', workflowRoutes);
  app.use('/api/v1/grade-configs', gradeConfigRoutes);
  app.use('/api/v1/departments', departmentRoutes);
  app.use('/api/v1/custom-roles', customRoleRoutes);
  app.use('/api/v1/logs', logRoutes);
  app.use('/api/v1/configs', configRoutes);

  // 404 处理
  app.use(notFoundHandler);

  // 错误处理
  app.use(errorHandler);

  return app;
}

// 启动服务器（仅在生产环境或直接运行时）
if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 7001;

  // 导入迁移（仅在启动时）
  import('./config/migrate').then(({ migrate }) => {
    migrate().then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
        console.log(`📝 API 文档: http://localhost:${PORT}/api/v1`);
      });
    }).catch((error) => {
      console.error('❌ 启动失败:', error);
      process.exit(1);
    });
  });
}

export default createApp();
