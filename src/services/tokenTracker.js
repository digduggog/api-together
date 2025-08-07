const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const dataFilePath = path.join(__dirname, '../data/tokenData.json');
let tokenStats = new Map();

// 确保数据目录存在
if (!fs.existsSync(path.dirname(dataFilePath))) {
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
}

// 初始化API统计器
function initializeStats(apiId) {
  if (!tokenStats.has(apiId)) {
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();
    const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    tokenStats.set(apiId, {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requests: 0,
      lastUsed: null,
      hourlyStats: {},
      dailyStats: {},
      hourlyTotal: 0,
      dailyTotal: 0
    });
    
    // 初始化当前小时和天的统计
    tokenStats.get(apiId).hourlyStats[currentHour] = 0;
    tokenStats.get(apiId).dailyStats[currentDay] = 0;
  }
}

// 从文件加载统计数据
function loadStatsFromFile() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      if (data) {
        const parsedData = JSON.parse(data);
        tokenStats = new Map(parsedData);
        logger.info('Token统计数据已加载');
      }
    }
  } catch (error) {
    logger.error('无法加载Token统计数据:', error);
  }
}

// 保存统计数据到文件
function saveStatsToFile() {
  try {
    const data = JSON.stringify(Array.from(tokenStats.entries()));
    fs.writeFileSync(dataFilePath, data, 'utf8');
  } catch (error) {
    logger.error('无法保存Token统计数据:', error);
  }
}

// 记录token使用
function recordTokenUsage(apiId, promptTokens = 0, completionTokens = 0, totalTokens = 0) {
  initializeStats(apiId);
  
  const stats = tokenStats.get(apiId);
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  
  // 更新统计数据
  stats.promptTokens += promptTokens;
  stats.completionTokens += completionTokens;
  stats.totalTokens += totalTokens || (promptTokens + completionTokens);
  stats.requests += 1;
  stats.lastUsed = now.toISOString();
  
  // 更新小时统计
  if (!stats.hourlyStats[currentHour]) {
    stats.hourlyStats[currentHour] = 0;
  }
  stats.hourlyStats[currentHour] += totalTokens || (promptTokens + completionTokens);
  stats.hourlyTotal += totalTokens || (promptTokens + completionTokens);
  
  // 更新日统计
  if (!stats.dailyStats[currentDay]) {
    stats.dailyStats[currentDay] = 0;
  }
  stats.dailyStats[currentDay] += totalTokens || (promptTokens + completionTokens);
  stats.dailyTotal += totalTokens || (promptTokens + completionTokens);
  
  logger.info(`API ${apiId} Token使用 - Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${totalTokens || (promptTokens + completionTokens)}`);
  
  saveStatsToFile();
}

// 获取API统计信息
function getApiStats(apiId) {
  if (!tokenStats.has(apiId)) {
    return null;
  }
  
  return tokenStats.get(apiId);
}

// 获取所有统计信息
function getAllStats() {
  const result = {};
  for (const [apiId, stats] of tokenStats.entries()) {
    result[apiId] = stats;
  }
  return result;
}

// 获取统计摘要
function getStatsSummary() {
  let totalTokens = 0;
  let totalRequests = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let hourlyTotal = 0;
  let dailyTotal = 0;
  
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  
  for (const stats of tokenStats.values()) {
    totalTokens += stats.totalTokens;
    totalRequests += stats.requests;
    totalPromptTokens += stats.promptTokens;
    totalCompletionTokens += stats.completionTokens;
    hourlyTotal += stats.hourlyStats[currentHour] || 0;
    dailyTotal += stats.dailyStats[currentDay] || 0;
  }
  
  return {
    totalTokens,
    totalRequests,
    totalPromptTokens,
    totalCompletionTokens,
    currentHourTokens: hourlyTotal,
    currentDayTokens: dailyTotal,
    averageTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
    activeApis: tokenStats.size
  };
}

// 重置指定API的统计
function resetApiStats(apiId) {
  if (tokenStats.has(apiId)) {
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();
    const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    tokenStats.set(apiId, {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requests: 0,
      lastUsed: null,
      hourlyStats: {},
      dailyStats: {},
      hourlyTotal: 0,
      dailyTotal: 0
    });
    
    tokenStats.get(apiId).hourlyStats[currentHour] = 0;
    tokenStats.get(apiId).dailyStats[currentDay] = 0;
    
    logger.info(`API ${apiId} 的Token统计数据已重置`);
    saveStatsToFile();
    return true;
  }
  return false;
}

// 重置所有统计
function resetAllStats() {
  tokenStats.clear();
  logger.info('所有Token统计数据已重置');
  saveStatsToFile();
}

// 清理旧数据（保留最近7天的数据）
function cleanupOldData() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  for (const [apiId, stats] of tokenStats.entries()) {
    // 清理日统计
    for (const day in stats.dailyStats) {
      const dayDate = new Date(day);
      if (dayDate < sevenDaysAgo) {
        delete stats.dailyStats[day];
      }
    }
    
    // 清理小时统计（保留最近48小时）
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    
    for (const hour in stats.hourlyStats) {
      const hourDate = new Date(hour);
      if (hourDate < fortyEightHoursAgo) {
        delete stats.hourlyStats[hour];
      }
    }
  }
  
  logger.info('旧的Token统计数据已清理');
  saveStatsToFile();
}

// 每小时清理一次旧数据
setInterval(cleanupOldData, 60 * 60 * 1000);

// 在启动时加载数据
loadStatsFromFile();

module.exports = {
  recordTokenUsage,
  getApiStats,
  getAllStats,
  getStatsSummary,
  resetApiStats,
  resetAllStats
};