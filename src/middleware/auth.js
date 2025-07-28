const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// 读取配置文件
function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../config/apis.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    logger.error('读取配置文件失败:', error);
    throw new Error('配置文件读取失败');
  }
}

// 认证中间件
function authMiddleware(req, res, next) {
  try {
    const config = loadConfig();
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: {
          message: '缺少Authorization头',
          type: 'authentication_error'
        }
      });
    }

    // 支持 "Bearer sk-123" 和 "sk-123" 两种格式
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (token !== config.server.apiKey) {
      logger.warn(`认证失败 - 无效的API密钥: ${token}`);
      return res.status(401).json({
        error: {
          message: '无效的API密钥',
          type: 'authentication_error'
        }
      });
    }

    logger.info('认证成功');
    next();
  } catch (error) {
    logger.error('认证中间件错误:', error);
    res.status(500).json({
      error: {
        message: '认证服务错误',
        type: 'internal_server_error'
      }
    });
  }
}

module.exports = authMiddleware;