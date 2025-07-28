const cron = require('node-cron');
const logger = require('../utils/logger');

// 存储每个API的请求计数
const requestCounts = new Map();

// 初始化API计数器
function initializeCounter(apiId) {
  if (!requestCounts.has(apiId)) {
    requestCounts.set(apiId, {
      rpm: 0,        // 每分钟请求数
      rpd: 0,        // 每日请求数
      lastMinute: new Date().getMinutes(),
      lastDay: new Date().getDate()
    });
  }
}

// 检查API是否达到限制
function checkRateLimit(api) {
  initializeCounter(api.id);
  
  const counter = requestCounts.get(api.id);
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentDay = now.getDate();
  
  // 重置分钟计数器
  if (currentMinute !== counter.lastMinute) {
    counter.rpm = 0;
    counter.lastMinute = currentMinute;
  }
  
  // 重置日计数器
  if (currentDay !== counter.lastDay) {
    counter.rpd = 0;
    counter.lastDay = currentDay;
  }
  
  // 检查RPM限制（-1表示无限制）
  if (api.rpm !== -1 && counter.rpm >= api.rpm) {
    logger.warn(`API ${api.name} 达到RPM限制: ${counter.rpm}/${api.rpm}`);
    return false;
  }
  
  // 检查RPD限制（-1表示无限制）
  if (api.rpd !== -1 && counter.rpd >= api.rpd) {
    logger.warn(`API ${api.name} 达到RPD限制: ${counter.rpd}/${api.rpd}`);
    return false;
  }
  
  return true;
}

// 增加请求计数
function incrementCounter(apiId) {
  initializeCounter(apiId);
  const counter = requestCounts.get(apiId);
  counter.rpm++;
  counter.rpd++;
  
  logger.info(`API ${apiId} 请求计数 - RPM: ${counter.rpm}, RPD: ${counter.rpd}`);
}

// 获取API状态
function getApiStatus(apiId) {
  if (!requestCounts.has(apiId)) {
    return { rpm: 0, rpd: 0 };
  }
  
  const counter = requestCounts.get(apiId);
  return {
    rpm: counter.rpm,
    rpd: counter.rpd
  };
}

// 定时任务：每分钟重置RPM计数器
cron.schedule('0 * * * * *', () => {
  const now = new Date();
  const currentMinute = now.getMinutes();
  
  for (const [apiId, counter] of requestCounts.entries()) {
    if (counter.lastMinute !== currentMinute) {
      counter.rpm = 0;
      counter.lastMinute = currentMinute;
    }
  }
});

// 定时任务：每天重置RPD计数器
cron.schedule('0 0 * * *', () => {
  const now = new Date();
  const currentDay = now.getDate();
  
  for (const [apiId, counter] of requestCounts.entries()) {
    if (counter.lastDay !== currentDay) {
      counter.rpd = 0;
      counter.lastDay = currentDay;
    }
  }
  
  logger.info('每日请求计数器已重置');
});

module.exports = {
  checkRateLimit,
  incrementCounter,
  getApiStatus
};