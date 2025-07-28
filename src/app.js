const express = require('express');
const cors = require('cors');
const path = require('path');
const authMiddleware = require('./middleware/auth');
const proxyService = require('./services/proxyService');
const logger = require('./utils/logger');

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// 认证中间件
app.use('/v1', authMiddleware);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'OpenAI API代理服务'
  });
});

// OpenAI API代理路由
app.use('/v1', proxyService);

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({
    error: {
      message: '内部服务器错误',
      type: 'internal_server_error'
    }
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: '未找到请求的端点',
      type: 'not_found'
    }
  });
});

module.exports = app;