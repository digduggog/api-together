const express = require('express');
const axios = require('axios');
const apiManager = require('./apiManager');
const tokenTracker = require('./tokenTracker');
const logger = require('../utils/logger');
const StreamTokenParser = require('../utils/streamParser');

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

// Token统计端点
router.get('/token/stats', (req, res) => {
  try {
    const summary = tokenTracker.getStatsSummary();
    const detailedStats = tokenTracker.getAllStats();
    
    res.json({
      service: 'OpenAI API代理服务',
      timestamp: new Date().toISOString(),
      summary,
      detailedStats
    });
  } catch (error) {
    logger.error('获取token统计失败:', error);
    res.status(500).json({
      error: {
        message: '获取token统计失败',
        type: 'internal_server_error'
      }
    });
  }
});

// 重置token统计端点
router.post('/token/reset', (req, res) => {
  try {
    const { apiId } = req.body;
    
    if (apiId) {
      const success = tokenTracker.resetApiStats(apiId);
      if (success) {
        res.json({
          message: `API ${apiId} 的token统计已重置`
        });
      } else {
        res.status(404).json({
          error: {
            message: `未找到API ${apiId} 的统计数据`,
            type: 'not_found'
          }
        });
      }
    } else {
      tokenTracker.resetAllStats();
      res.json({
        message: '所有token统计已重置'
      });
    }
  } catch (error) {
    logger.error('重置token统计失败:', error);
    res.status(500).json({
      error: {
        message: '重置token统计失败',
        type: 'internal_server_error'
      }
    });
  }
});

// Helper function to check for empty response
const isResponseEmptyTokens = (response) => {
    const usage = extractTokenUsage(response.data);
    return usage && usage.completionTokens === 0 && usage.totalTokens > 0 && usage.totalTokens === usage.promptTokens;
};

const isResponseEmpty = (response) => {
    if (response.status !== 200) {
        return false;
    }

    // Check for 0 token response
    if (isResponseEmptyTokens(response)) {
        return true;
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
    const isStream = req.body?.stream === true;
    let lastError = null;
    const usedApiIds = new Set();
    const maxRetries = 10;

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

        logger.info(`Attempt ${i + 1}/${maxRetries}: Proxying to ${selectedApi.name} (${selectedApi.baseUrl})`);

        const requestConfig = {
          method: req.method,
          url: requestPath,
          data: requestBody,
          params: req.query,
          responseType: isStream ? 'stream' : 'json',
          headers: {
            'Authorization': `Bearer ${selectedApi.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'OpenAI-API-Proxy/1.0'
          },
          timeout: 60000,
          validateStatus: (status) => status < 600,
        };

        const response = await axiosInstance(requestConfig);

        if (isStream) {
            if (response.status === 200) {
                logger.info(`Streaming request successful with ${selectedApi.name}`);
                res.setHeader('Content-Type', response.headers['content-type']);
                
                const streamParser = new StreamTokenParser({
                    onTokenUsage: (usage) => {
                        tokenTracker.recordTokenUsage(selectedApi.id, usage.promptTokens, usage.completionTokens, usage.totalTokens);
                        apiManager.recordApiSuccess(selectedApi.id);
                    }
                });

                response.data.pipe(streamParser).pipe(res);
                return;
            } else {
                const errorData = await response.data.read();
                logger.warn(`Attempt ${i + 1} failed: ${selectedApi.name} returned status ${response.status} for stream. Retrying...`);
                lastError = { message: errorData ? errorData.toString() : 'Stream error' };
                apiManager.recordApiError(selectedApi.id);
                continue;
            }
        }


        const shouldRetry = response.status >= 400;

        if (response.status < 400 && !isResponseEmpty(response)) {
          logger.info(`Request successful with ${selectedApi.name}: ${response.status}`);
          apiManager.recordApiSuccess(selectedApi.id); // 记录成功
          
          // 非流式请求的 token 统计
          const usage = extractTokenUsage(response.data);
          if (usage) {
            tokenTracker.recordTokenUsage(selectedApi.id, usage.promptTokens, usage.completionTokens, usage.totalTokens);
          }
          
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
          let emptyReason = `Empty response from ${selectedApi.name} (status ${response.status})`;
          if (isResponseEmptyTokens(response)) {
            emptyReason = `0 token response from ${selectedApi.name}`;
            const usage = extractTokenUsage(response.data);
            logger.warn(`0 token usage detected: ${JSON.stringify(usage)}`);
          }
          lastError = { message: emptyReason };
          logger.warn(`Attempt ${i + 1} failed: ${lastError.message}. Retrying...`);
          apiManager.recordApiError(selectedApi.id); // 记录错误
        } else if (shouldRetry) {
          lastError = { response };
          logger.warn(`Attempt ${i + 1} failed: ${selectedApi.name} returned status ${response.status}. Retrying...`);
          apiManager.recordApiError(selectedApi.id); // 记录错误
        } else {
          logger.error(`Request failed with non-retryable status from ${selectedApi.name}: ${response.status}. Not retrying.`);
          res.status(response.status).json(response.data);
          return;
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${i + 1} with ${selectedApi.name} failed with network error: ${error.message}. Retrying...`);
        apiManager.recordApiError(selectedApi.id); // 记录网络错误
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

// 提取token使用情况
function extractTokenUsage(responseData) {
  try {
    // 处理聊天完成响应
    if (responseData.usage) {
      return {
        promptTokens: responseData.usage.prompt_tokens || 0,
        completionTokens: responseData.usage.completion_tokens || 0,
        totalTokens: responseData.usage.total_tokens || 0
      };
    }
    
    // 处理嵌入向量响应
    if (responseData.data && responseData.data.length > 0) {
      const firstItem = responseData.data[0];
      if (firstItem.usage) {
        return {
          promptTokens: firstItem.usage.prompt_tokens || 0,
          completionTokens: 0,
          totalTokens: firstItem.usage.total_tokens || firstItem.usage.prompt_tokens || 0
        };
      }
    }
    
    // 处理其他响应格式
    if (responseData.prompt_tokens !== undefined || responseData.total_tokens !== undefined) {
      return {
        promptTokens: responseData.prompt_tokens || 0,
        completionTokens: responseData.completion_tokens || 0,
        totalTokens: responseData.total_tokens || (responseData.prompt_tokens || 0) + (responseData.completion_tokens || 0)
      };
    }
    
    return null;
  } catch (error) {
    logger.warn('提取token使用信息失败:', error.message);
    return null;
  }
}

module.exports = router;