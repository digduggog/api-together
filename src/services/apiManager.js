const fs = require('fs');
const path = require('path');
const rateLimit = require('../middleware/rateLimit');
const logger = require('../utils/logger');

class ApiManager {
  constructor() {
    this.configPath = path.join(__dirname, '../config/apis.json');
    this.config = null;
    this.loadConfig();
  }

  // 加载配置文件
  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`配置文件不存在: ${this.configPath}`);
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      
      if (!configData || configData.trim() === '') {
        throw new Error('配置文件为空');
      }

      this.config = JSON.parse(configData);
      
      // 验证配置结构
      if (!this.config || typeof this.config !== 'object') {
        throw new Error('配置文件格式无效');
      }

      if (!this.config.apis || !Array.isArray(this.config.apis)) {
        throw new Error('配置文件中缺少有效的apis数组');
      }

      logger.info(`配置文件加载成功，包含 ${this.config.apis.length} 个API配置`);
    } catch (error) {
      logger.error('配置文件加载失败:', error.message);
      logger.error('错误详情:', error);
      throw new Error(`无法加载配置文件: ${error.message}`);
    }
  }

  // 重新加载配置文件
  reloadConfig() {
    this.loadConfig();
  }

  // 获取所有可用的API
  getAvailableApis() {
    try {
      if (!this.config || !this.config.apis || !Array.isArray(this.config.apis)) {
        logger.error('配置文件中没有有效的APIs数组');
        return [];
      }

      return this.config.apis.filter(api => {
        // 检查API对象是否有效
        if (!api || typeof api !== 'object') {
          logger.warn('发现无效的API配置对象');
          return false;
        }

        // 检查必要字段
        if (!api.id || !api.name || !api.baseUrl || !api.apiKey) {
          logger.warn(`API配置缺少必要字段: ${JSON.stringify(api)}`);
          return false;
        }

        // 检查API是否启用
        if (!api.enabled) {
          logger.debug(`API ${api.name} 已禁用`);
          return false;
        }

        // 检查请求限制
        if (!rateLimit.checkRateLimit(api)) {
          logger.debug(`API ${api.name} 达到请求限制`);
          return false;
        }

        return true;
      });
    } catch (error) {
      logger.error('获取可用APIs时发生错误:', error);
      return [];
    }
  }

  // 随机选择一个可用的API
  selectRandomApi() {
    try {
      const availableApis = this.getAvailableApis();
      
      if (!availableApis || availableApis.length === 0) {
        logger.error('没有可用的API端点');
        return null;
      }

      const randomIndex = Math.floor(Math.random() * availableApis.length);
      const selectedApi = availableApis[randomIndex];
      
      if (!selectedApi) {
        logger.error('选择的API为空');
        return null;
      }
      
      logger.info(`选择API: ${selectedApi.name} (${selectedApi.id})`);
      return selectedApi;
    } catch (error) {
      logger.error('选择API时发生错误:', error);
      return null;
    }
  }

  // 记录API使用
  recordApiUsage(apiId) {
    rateLimit.incrementCounter(apiId);
  }

  // 获取API状态信息
  getApiStatus() {
    if (!this.config || !this.config.apis) {
      return [];
    }

    return this.config.apis.map(api => {
      const status = rateLimit.getApiStatus(api.id);
      const isAvailable = api.enabled && rateLimit.checkRateLimit(api);
      
      return {
        id: api.id,
        name: api.name,
        enabled: api.enabled,
        available: isAvailable,
        limits: {
          rpm: api.rpm === -1 ? '无限制' : api.rpm,
          rpd: api.rpd === -1 ? '无限制' : api.rpd
        },
        usage: {
          rpm: status.rpm,
          rpd: status.rpd
        }
      };
    });
  }

  // 获取服务器配置
  getServerConfig() {
    return this.config ? this.config.server : null;
  }
}

module.exports = new ApiManager();