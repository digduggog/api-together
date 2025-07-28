const axios = require('axios');

async function testApi() {
  try {
    console.log('测试API服务...');
    
    // 测试健康检查
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('健康检查:', healthResponse.data);
    
    // 测试状态端点
    const statusResponse = await axios.get('http://localhost:3001/v1/status', {
      headers: {
        'Authorization': 'Bearer sk-123'
      }
    });
    console.log('状态检查:', JSON.stringify(statusResponse.data, null, 2));
    
    // 测试聊天完成
    const chatResponse = await axios.post('http://localhost:3001/v1/chat/completions', {
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: '你好'
        }
      ]
    }, {
      headers: {
        'Authorization': 'Bearer sk-123',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('聊天测试成功:', chatResponse.data);
    
  } catch (error) {
    console.error('测试失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误数据:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误信息:', error.message);
    }
  }
}

testApi();