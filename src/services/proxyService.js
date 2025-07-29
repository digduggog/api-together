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

// 通用代理请求处理函数
async function handleProxyRequest(req, res) {
  try {
    // 选择一个可用的API
    const selectedApi = apiManager.selectRandomApi();
    
    if (!selectedApi || typeof selectedApi !== 'object') {
      logger.error('无法选择有效的API端点');
      return res.status(503).json({
        error: {
          message: '当前没有可用的API端点，请稍后重试',
          type: 'service_unavailable',
          code: 'no_available_api'
        }
      });
    }

    // 验证选中的API配置
    if (!selectedApi.baseUrl || !selectedApi.apiKey) {
      logger.error('选中的API配置不完整:', selectedApi);
      return res.status(500).json({
        error: {
          message: 'API配置错误',
          type: 'api_error',
          code: 'invalid_config'
        }
      });
    }

    // 记录API使用
    apiManager.recordApiUsage(selectedApi.id);

    // 创建axios实例
    const axiosInstance = createAxiosInstance(selectedApi);

    // 构建请求路径
    let requestPath = req.path;
    
    // 确保路径正确构建
    if (requestPath.startsWith('/')) {
      requestPath = requestPath.substring(1); // 移除开头的斜杠
    }
    
    // 如果baseUrl不包含/v1，则添加v1前缀
    if (!selectedApi.baseUrl.includes('/v1')) {
      requestPath = 'v1/' + requestPath;
    }
    
    logger.info(`代理请求: ${req.method} ${requestPath} -> ${selectedApi.name} (${selectedApi.baseUrl})`);
    logger.info(`完整URL: ${selectedApi.baseUrl}/${requestPath}`);

    // 准备请求头
    const requestHeaders = {
      'Authorization': `Bearer ${selectedApi.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'OpenAI-API-Proxy/1.0'
    };

    // 发送请求到选中的API
    const requestConfig = {
      method: req.method,
      url: requestPath,
      data: req.body,
      params: req.query,
      headers: requestHeaders,
      timeout: 60000,
      validateStatus: function (status) {
        return status < 600; // 接受所有小于600的状态码
      }
    };

    logger.debug('请求配置:', JSON.stringify({
      ...requestConfig,
      headers: { ...requestConfig.headers, Authorization: '[HIDDEN]' }
    }, null, 2));
    
    let lastError = null;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await axiosInstance(requestConfig);

        if (response.status < 500) {
          res.status(response.status);
          const excludeHeaders = ['content-encoding', 'transfer-encoding', 'connection'];
          Object.keys(response.headers).forEach(key => {
            if (!excludeHeaders.includes(key.toLowerCase())) {
              res.set(key, response.headers[key]);
            }
          });
          res.json(response.data);
          logger.info(`请求成功: ${req.method} ${requestPath} - ${response.status}`);
          return;
        }

        lastError = { response };
        logger.warn(`Attempt ${i + 1} failed with status ${response.status}. Retrying in 500ms...`);

      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${i + 1} failed with network error. Retrying in 500ms...`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.error('Proxy request failed after 3 retries:', lastError.message);
    
    if (lastError.response) {
      const { status, data } = lastError.response;
      res.status(status).json(data);
    } else if (lastError.request) {
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
          message: lastError.message || 'Internal server error',
          type: 'api_error',
          code: 'internal_error'
        }
      });
    }
  } catch (error) {
    logger.error('代理请求失败:', error.message);
    logger.error('错误堆栈:', error.stack);

    if (error.response) {
      // API返回了错误响应
      const status = error.response.status;
      const errorData = error.response.data;
      
      logger.error(`API错误响应: ${status} - ${JSON.stringify(errorData)}`);
      
      res.status(status).json(errorData);
    } else if (error.request) {
      // 请求发送失败（网络错误等）
      logger.error('网络请求失败:', error.message);
      
      res.status(502).json({
        error: {
          message: '上游服务器连接失败',
          type: 'bad_gateway',
          code: 'network_error'
        }
      });
    } else {
      // 其他错误，包括代码逻辑错误
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