const fs = require('fs');
const path = require('path');
const rateLimit = require('../middleware/rateLimit');
const logger = require('../utils/logger');

class ApiManager {
  constructor() {
    this.configPath = path.join(__dirname, '../config/apis.json');
    this.config = null;
    this.errorCounts = new Map(); // 记录连续错误次数
    this.disableTimers = new Map(); // 记录禁用计时器
    this.disabledApis = new Map(); // 记录禁用状态和禁用时间
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

  reloadApis() {
    logger.info('Attempting to reload API configurations...');
    try {
      this.loadConfig();
      // After reloading, you might want to reset certain states,
      // but for now, we'll just log the success.
      logger.info('API configurations reloaded successfully.');
      return true;
    } catch (error) {
      logger.error('Failed to reload API configurations:', error.message);
      return false;
    }
  }

  // 重新加载配置文件
  reloadConfig() {
    this.loadConfig();
  }

  // 获取所有可用的API
  getAvailableApis(modelName) {
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

        // 检查API是否被临时禁用
        if (this.isApiTemporarilyDisabled(api.id)) {
          logger.debug(`API ${api.name} 已被临时禁用`);
          return false;
        }

        // 如果提供了modelName，则检查该API是否支持该模型
        if (modelName) {
          const supportedModels = api.models || [];
          const modelMapping = api.modelMapping || {};

          // 检查模型是否直接在支持列表，或者是否在映射中
          if (!supportedModels.includes(modelName) && !modelMapping[modelName]) {
            logger.debug(`API ${api.name} 不支持模型 ${modelName}`);
            return false;
          }
        }


        return true;
      });
    } catch (error) {
      logger.error('获取可用APIs时发生错误:', error);
      return [];
    }
  }

  // 随机选择一个可用的API
  selectRandomApi(modelName) {
    try {
      const availableApis = this.getAvailableApis(modelName);
      
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
      const isRateLimited = !rateLimit.checkRateLimit(api);
      const isTemporarilyDisabled = this.isApiTemporarilyDisabled(api.id);
      const errorCount = this.errorCounts.get(api.id) || 0;
      const isAvailable = api.enabled && !isRateLimited && !isTemporarilyDisabled;
      
      return {
        id: api.id,
        name: api.name,
        enabled: api.enabled,
        available: isAvailable,
        temporarilyDisabled: isTemporarilyDisabled,
        errorCount: errorCount,
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

  // 记录API成功
  recordApiSuccess(apiId) {
    this.errorCounts.set(apiId, 0); // 重置错误计数
    // 如果之前有禁用计时器，取消它
    if (this.disableTimers.has(apiId)) {
      clearTimeout(this.disableTimers.get(apiId));
      this.disableTimers.delete(apiId);
    }
    // 如果API被禁用，重新启用
    if (this.disabledApis.has(apiId)) {
      this.disabledApis.delete(apiId);
      this.reenableApi(apiId);
    }
  }

  // 记录API错误
  recordApiError(apiId) {
    const currentCount = this.errorCounts.get(apiId) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(apiId, newCount);
    
    logger.warn(`API ${apiId} 错误次数: ${newCount}`);
    
    // 如果连续错误达到3次，临时禁用该API
    if (newCount >= 3) {
      this.disableApiTemporarily(apiId);
    }
  }

  // 检查API是否被临时禁用
  isApiTemporarilyDisabled(apiId) {
    return this.disabledApis.has(apiId);
  }

  // 临时禁用API
  disableApiTemporarily(apiId) {
    const disableTime = 10 * 60 * 1000; // 10分钟
    const disableUntil = Date.now() + disableTime;
    
    this.disabledApis.set(apiId, disableUntil);
    
    // 设置自动重新启用计时器
    const timer = setTimeout(() => {
      this.reenableApi(apiId);
    }, disableTime);
    
    this.disableTimers.set(apiId, timer);
    
    // 查找API名称并记录日志
    const api = this.config.apis.find(a => a.id === apiId);
    const apiName = api ? api.name : apiId;
    logger.error(`API ${apiName} 连续失败3次，已被临时禁用10分钟`);
  }

  // 重新启用API
  reenableApi(apiId) {
    this.disabledApis.delete(apiId);
    this.disableTimers.delete(apiId);
    this.errorCounts.set(apiId, 0); // 重置错误计数
    
    // 查找API名称并记录日志
    const api = this.config.apis.find(a => a.id === apiId);
    const apiName = api ? api.name : apiId;
    logger.info(`API ${apiName} 已重新启用`);
  }

  // 获取API状态信息（增强版）
  getApiStatus() {
    if (!this.config || !this.config.apis) {
      return [];
    }

    return this.config.apis.map(api => {
      const status = rateLimit.getApiStatus(api.id);
      const isRateLimited = !rateLimit.checkRateLimit(api);
      const isTemporarilyDisabled = this.isApiTemporarilyDisabled(api.id);
      const errorCount = this.errorCounts.get(api.id) || 0;
      const isAvailable = api.enabled && !isRateLimited && !isTemporarilyDisabled;
      
      return {
        id: api.id,
        name: api.name,
        enabled: api.enabled,
        available: isAvailable,
        temporarilyDisabled: isTemporarilyDisabled,
        errorCount: errorCount,
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
}

module.exports = new ApiManager();