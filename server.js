const app = require('./src/app');
const apiManager = require('./src/services/apiManager');
const logger = require('./src/utils/logger');
const hotReloader = require('./src/utils/hotReloader');

// 获取服务器配置
const serverConfig = apiManager.getServerConfig();
const PORT = process.env.PORT || serverConfig?.port || 3001;

// 启动服务器
const server = app.listen(PORT, () => {
  logger.success(`🚀 OpenAI API代理服务已启动`);
  logger.info(`📡 服务地址: http://localhost:${PORT}`);
  logger.info(`🔑 API密钥: ${serverConfig?.apiKey || 'sk-123'}`);
  logger.info(`📊 状态查询: http://localhost:${PORT}/v1/status`);
  logger.info(`❤️  健康检查: http://localhost:${PORT}/health`);
  
  // 显示可用的API端点
  const availableApis = apiManager.getAvailableApis();
  if (availableApis.length > 0) {
    logger.info(`🔗 已配置 ${availableApis.length} 个可用API端点:`);
    availableApis.forEach(api => {
      logger.info(`   - ${api.name} (${api.id})`);
    });
  } else {
    logger.warn('⚠️  当前没有可用的API端点，请检查配置文件');
  }
  
  // 启动配置文件热重载
  hotReloader.start();
  logger.info(`🔄 配置文件热重载已启动`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  // 停止热重载
  hotReloader.stop();
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  // 停止热重载
  hotReloader.stop();
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});