const express = require('express');
const axios = require('axios');
const apiManager = require('./apiManager');
const logger = require('../utils/logger');

const router = express.Router();

// 创建axios实例，设置默认配置
const createAxiosInstance = (api) => {
  return axios.create({
    baseURL: api.baseUrl,
    timeout: 60000, // 60秒超时
    headers: {
      'Authorization': `Bearer ${api.apiKey}`,
      'Content-Type': 'application/json'
    }
  });
};

// API状态查询端点
router.get('/status', (req, res) => {
  try {
    const status = apiManager.getApiStatus();
    res.json({
      service: 'OpenAI API代理服务',
      timestamp: new Date().toISOString(),
      apis: status
    });
  } catch (error) {
    logger.error('获取状态失败:', error);
    res.status(500).json({
      error: {
        message: '获取状态失败',
        type: 'internal_server_error'
      }
    });
  }
});

// 处理聊天完成请求
router.post('/chat/completions', handleProxyRequest);
router.post('/completions', handleProxyRequest);
router.post('/embeddings', handleProxyRequest);
router.post('/moderations', handleProxyRequest);
router.get('/models', handleProxyRequest);
router.get('/models/:model', handleProxyRequest);

// Helper function to check for empty response
const isResponseEmpty = (response) => {
  if (response.status !== 200) {
    return false;
  }
  const contentLength = response.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) === 0) {
    return true;
  }
  const data = response.data;
  if (data === null || data === undefined) {
    return true;
  }
  if (typeof data === 'object' && Object.keys(data).length === 0) {
    return true;
  }
  if (Array.isArray(data) && data.length === 0) {
    return true;
  }
  if (typeof data === 'string' && data.trim() === '') {
    return true;
  }
  return false;
};

// 通用代理请求处理函数
async function handleProxyRequest(req, res) {
  try {
    const modelName = req.body?.model;
    let lastError = null;
    const usedApiIds = new Set();
    const maxRetries = 3;

    // Initial check for any available APIs
    const initialApis = apiManager.getAvailableApis(modelName);
    if (!initialApis || initialApis.length === 0) {
      logger.error('无法选择有效的API端点');
      return res.status(503).json({
        error: {
          message: '当前没有可用的API端点，请稍后重试',
          type: 'service_unavailable',
          code: 'no_available_api'
        }
      });
    }

    for (let i = 0; i < maxRetries; i++) {
      const availableApis = apiManager.getAvailableApis(modelName).filter(api => !usedApiIds.has(api.id));

      if (availableApis.length === 0) {
        logger.warn('No more available APIs to try.');
        break;
      }

      const randomIndex = Math.floor(Math.random() * availableApis.length);
      const selectedApi = availableApis[randomIndex];
      usedApiIds.add(selectedApi.id);

      try {
        let requestBody = { ...req.body };
        if (modelName && selectedApi.modelMapping && selectedApi.modelMapping[modelName]) {
          const originalModel = modelName;
          requestBody.model = selectedApi.modelMapping[modelName];
          logger.info(`Attempt ${i + 1}: Model mapping for ${selectedApi.name}: ${originalModel} -> ${requestBody.model}`);
        }

        if (!selectedApi.baseUrl || !selectedApi.apiKey) {
          logger.error(`Attempt ${i + 1}: API config for ${selectedApi.name} is incomplete.`);
          lastError = new Error(`API config for ${selectedApi.name} is incomplete.`);
          continue;
        }

        apiManager.recordApiUsage(selectedApi.id);
        const axiosInstance = createAxiosInstance(selectedApi);

        let requestPath = req.path;
        if (requestPath.startsWith('/')) {
          requestPath = requestPath.substring(1);
        }
        if (!selectedApi.baseUrl.includes('/v1')) {
          requestPath = 'v1/' + requestPath;
        }

        logger.info(`Attempt ${i + 1}/${maxRetries}: Proxying to ${selectedApi.name} (${selectedApi.baseUrl})`);

        const requestConfig = {
          method: req.method,
          url: requestPath,
          data: requestBody,
          params: req.query,
          headers: {
            'Authorization': `Bearer ${selectedApi.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'OpenAI-API-Proxy/1.0'
          },
          timeout: 60000,
          validateStatus: (status) => status < 600,
        };

        const response = await axiosInstance(requestConfig);

        if (response.status < 400 && !isResponseEmpty(response)) {
          logger.info(`Request successful with ${selectedApi.name}: ${response.status}`);
          res.status(response.status);
          const excludeHeaders = ['content-encoding', 'transfer-encoding', 'connection'];
          Object.keys(response.headers).forEach(key => {
            if (!excludeHeaders.includes(key.toLowerCase())) {
              res.set(key, response.headers[key]);
            }
          });
          res.json(response.data);
          return;
        }

        if (isResponseEmpty(response)) {
          lastError = { message: `Empty response from ${selectedApi.name} (status ${response.status})` };
          logger.warn(`Attempt ${i + 1} failed: ${lastError.message}. Retrying...`);
        } else if (response.status >= 500) {
          lastError = { response };
          logger.warn(`Attempt ${i + 1} failed: ${selectedApi.name} returned status ${response.status}. Retrying...`);
        } else {
          logger.error(`Request failed with client-side error from ${selectedApi.name}: ${response.status}. Not retrying.`);
          res.status(response.status).json(response.data);
          return;
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${i + 1} with ${selectedApi.name} failed with network error: ${error.message}. Retrying...`);
      }

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    logger.error('Proxy request failed after all retries.', lastError?.message || 'Unknown error');

    if (lastError?.response) {
      const { status, data } = lastError.response;
      res.status(status).json(data);
    } else if (lastError?.request) {
      res.status(502).json({
        error: {
          message: 'Upstream server connection failed',
          type: 'bad_gateway',
          code: 'network_error'
        }
      });
    } else {
      res.status(500).json({
        error: {
          message: lastError?.message || 'Internal server error',
          type: 'api_error',
          code: 'internal_error'
        }
      });
    }
  } catch (error) {
    logger.error('代理请求失败:', error.message);
    logger.error('错误堆栈:', error.stack);

    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      logger.error(`API错误响应: ${status} - ${JSON.stringify(errorData)}`);
      
      res.status(status).json(errorData);
    } else if (error.request) {
      logger.error('网络请求失败:', error.message);
      
      res.status(502).json({
        error: {
          message: '上游服务器连接失败',
          type: 'bad_gateway',
          code: 'network_error'
        }
      });
    } else {
      logger.error('未知错误:', error.message);
      logger.error('错误详情:', error);
      
      res.status(500).json({
        error: {
          message: error.message || '内部服务器错误',
          type: 'api_error',
          code: 'internal_error'
        }
      });
    }
  }
}

module.exports = router;