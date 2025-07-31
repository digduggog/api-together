const axios = require('axios');

async function simpleTest() {
  try {
    console.log('开始测试API...');
    
    const response = await axios.post('http://localhost:3001/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: '你好，请回复一个简单的问候'
        }
      ],
      max_tokens: 100
    }, {
      headers: {
        'Authorization': 'Bearer sk-123',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ API调用成功!');
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ API调用失败:');
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误响应:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('网络错误:', error.message);
    } else {
      console.error('其他错误:', error.message);
    }
  }
}

simpleTest();