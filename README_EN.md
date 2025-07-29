# OpenAI API Polling Proxy Service

English | [中文](./README.md)

A powerful OpenAI-format API proxy service that supports multi-endpoint load balancing, request limiting, and intelligent polling.

## 🌟 Features

- ✅ **Multi-endpoint Polling**: Support for configuring multiple OpenAI-format API endpoints
- ✅ **Smart Load Balancing**: Randomly select available API endpoints to distribute request load
- ✅ **Model Routing**: Automatically select API endpoints that support the requested model
- ✅ **Model Mapping**: Support for mapping request models to specific API endpoint model names
- ✅ **Request Limiting**: Support for RPM (Requests Per Minute) and RPD (Requests Per Day) limits
- ✅ **Automatic Retries**: Automatically retries when the upstream API fails, improving stability
- ✅ **Data Persistence**: RPD and RPM records are saved locally to prevent data loss after program shutdown
- ✅ **Configuration Management**: Easy management of all API configurations through JSON files
- ✅ **Key Authentication**: Unified API key authentication mechanism
- ✅ **Real-time Monitoring**: Provides API status query and health check endpoints
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **Easy Deployment**: Simple configuration and startup process

## 📋 System Requirements

- Node.js 14.0.0 or higher
- npm or yarn package manager

## 🚀 Quick Start

### Step 1: Check Node.js Installation

1. **Open Command Prompt (CMD)**
   - Press `Win + R` keys
   - Type `cmd` and press Enter

2. **Check Node.js Version**
   ```bash
   node --version
   ```
   If it shows a version number (like v18.17.0), it's installed. If it says "not recognized as an internal or external command", you need to install Node.js first.

3. **Install Node.js (if not installed)**
   - Visit [Node.js Official Website](https://nodejs.org/)
   - Download the LTS version (recommended)
   - Run the installer and click "Next" all the way through
   - After installation, reopen CMD to verify

### Step 2: Download and Configure Project

1. **Choose Installation Location and Open Command Prompt**
   - In File Explorer, navigate to where you want to install the project (e.g., `D:\` or `C:\Users\YourUsername\Desktop\`)
   - Type `cmd` in the address bar of that folder and press Enter (this opens Command Prompt in the current location)
   - Alternatively: Open Command Prompt and use `cd` command to navigate to your desired location:
     ```bash
     cd D:\
     ```

2. **Download Project Files**
   - In Command Prompt, clone the project using the following command:
   ```bash
   git clone https://github.com/digduggog/api-together.git
   ```
   - **Note**: git clone will automatically create a folder named `api-together`, you don't need to create it manually

3. **Navigate to Project Folder**
   ```bash
   cd api-together
   ```

4. **Install Dependencies**
   ```bash
   npm install
   ```
   Wait for installation to complete (may take a few minutes)

### Step 3: Configure API Endpoints

1. **Open Configuration File**
   - Use Notepad or any text editor to open `src/config/apis.json`

2. **Modify Configuration**
   ```json
   {
     "server": {
       "port": 3001,
       "apiKey": "sk-123"
     },
     "apis": [
       {
         "id": "api1",
         "name": "OpenAI Official API",
         "baseUrl": "https://api.openai.com",
         "apiKey": "sk-your-real-openai-key-here",
         "rpm": 60,
         "rpd": 1000,
         "enabled": true,
         "models": ["gpt-3.5-turbo", "gpt-4"],
         "modelMapping": {
           "gpt-3.5": "gpt-3.5-turbo"
         }
       },
       {
         "id": "api2",
         "name": "Backup API Endpoint",
         "baseUrl": "https://your-backup-api.com",
         "apiKey": "sk-your-backup-key-here",
         "rpm": -1,
         "rpd": 500,
         "enabled": true,
         "models": ["claude-2", "claude-instant-1"]
       }
     ]
   }
   ```

3. **Configuration Explanation**
   - `baseUrl`: Base URL of the API
   - `apiKey`: API key for the corresponding API
   - `rpm`: Maximum requests per minute (-1 means unlimited)
   - `rpd`: Maximum requests per day (-1 means unlimited)
   - `enabled`: Whether to enable this API (true/false)
   - `models`: (Required) List of supported models (e.g., `["gpt-3.5-turbo", "gpt-4"]`)
   - `modelMapping`: (Optional) Model name mapping, to map a requested model to a target model (e.g., `{"gpt-3.5": "gpt-3.5-turbo"}` means that when `gpt-3.5` is requested, the `gpt-3.5-turbo` model will be used)

### Step 4: Start Service

1. **Start Server**
   ```bash
   npm start
   ```

2. **Success Message**
   ```
   🚀 OpenAI API代理服务已启动
   📡 服务地址: http://localhost:3001
   🔑 API密钥: sk-123
   📊 状态查询: http://localhost:3001/v1/status
   ❤️  健康检查: http://localhost:3001/health
   ```

3. **Keep Window Open**
   - Don't close the Command Prompt window
   - The service will keep running until you press `Ctrl + C` to stop

## 🔧 Usage

### Basic Usage

Change your OpenAI API request URL from:
```
https://api.openai.com/v1/chat/completions
```

To:
```
http://localhost:3001/v1/chat/completions
```

Use the configured key in request headers:
```
Authorization: Bearer sk-123
```

### Example Requests

**Using curl command:**
```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-123" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

**Using Python:**
```python
import requests

url = "http://localhost:3001/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-123"
}
data = {
    "model": "gpt-3.5-turbo",
    "messages": [
        {"role": "user", "content": "Hello, how are you?"}
    ]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

### Check Service Status

Visit the status endpoint to view usage of all APIs:
```
http://localhost:3001/v1/status
```

## 📊 Monitoring and Management

### Health Check
```
GET http://localhost:3001/health
```

### API Status Query
```
GET http://localhost:3001/v1/status
```

Example Response:
```json
{
  "service": "OpenAI API代理服务",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "apis": [
    {
      "id": "api1",
      "name": "OpenAI Official API",
      "enabled": true,
      "available": true,
      "limits": {
        "rpm": 60,
        "rpd": 1000
      },
      "usage": {
        "rpm": 15,
        "rpd": 234
      }
    }
  ]
}
```

## ⚙️ Advanced Configuration

### Environment Variables

Create `.env` file (optional):
```env
PORT=3001
NODE_ENV=production
```

### Request Limiting Explanation

- **RPM (Requests Per Minute)**: Maximum requests per minute
- **RPD (Requests Per Day)**: Maximum requests per day
- **-1**: Means unlimited
- **0**: Means disable this API

### Adding More API Endpoints

Add more configurations to the `apis` array in `src/config/apis.json`:

```json
{
  "id": "api3",
  "name": "Third Party API",
  "baseUrl": "https://api.third-party.com",
  "apiKey": "sk-third-party-key",
  "rpm": 100,
  "rpd": 2000,
  "enabled": true
}
```

## 🛠️ Troubleshooting

### Common Issues

**Q: "Port already in use" error on startup**
A: Change the `port` value in `src/config/apis.json`, or close other programs using port 3001.

**Q: Requests return 401 error**
A: Check if the `Authorization` header is correct, should be `Bearer sk-123`.

**Q: All APIs are unavailable**
A: Check if API keys in the configuration file are correct and network connection is normal.

**Q: How to stop the service**
A: Press `Ctrl + C` in the Command Prompt window.

### View Logs

The service displays detailed logs in the console while running:
- Green: Normal information
- Yellow: Warning information
- Red: Error information

### Restart Service

If you modified the configuration file, you need to restart the service:
1. Press `Ctrl + C` to stop the service
2. Run `npm start` to restart

## 📝 Changelog

### v1.1.0
- Added model routing feature to select APIs based on the requested model
- Added model mapping feature to support aliases
- Updated `apis.json` configuration format
- Improved documentation and examples

### v1.0.0
- Initial release
- Support for multi-endpoint polling
- Implement RPM/RPD limiting
- Add configuration file management
- Comprehensive error handling and logging

## 📄 License

MIT License

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📞 Support

If you encounter problems, please:
1. Check the troubleshooting section in this document
2. Review console log information
3. Submit an Issue describing the problem