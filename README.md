# OpenAI API 轮询代理服务

[English](./README_EN.md) | 中文

一个强大的 OpenAI 格式 API 代理服务，支持多端点负载均衡、请求限制和智能轮询。

## 🌟 功能特性

- ✅ **多端点轮询**: 支持配置多个 OpenAI 格式的 API 端点
- ✅ **智能负载均衡**: 随机选择可用的 API 端点分散请求压力
- ✅ **模型路由**: 根据请求的模型，自动选择支持该模型的 API 端点
- ✅ **模型映射**: 支持将请求模型映射为特定 API 端点的模型名称
- ✅ **请求限制**: 支持 RPM（每分钟请求数）和 RPD（每日请求数）限制
- ✅ **自动重试**: 在上游 API 报错时自动重试，提高稳定性
- ✅ **数据持久化**: RPD 和 RPM 记录会保存到本地，防止程序关闭后数据丢失
- ✅ **配置管理**: 通过 JSON 文件轻松管理所有 API 配置
- ✅ **密钥验证**: 统一的 API 密钥验证机制
- ✅ **实时监控**: 提供 API 状态查询和健康检查端点
- ✅ **错误处理**: 完善的错误处理和日志记录
- ✅ **易于部署**: 简单的配置和启动流程

## 📋 系统要求

- Node.js 14.0.0 或更高版本
- npm 或 yarn 包管理器

## 🚀 快速开始

### 第一步：检查 Node.js 安装

1. **打开命令提示符（CMD）**
   - 按 `Win + R` 键
   - 输入 `cmd` 并按回车键

2. **检查 Node.js 版本**
   ```bash
   node --version
   ```
   如果显示版本号（如 v18.17.0），说明已安装。如果提示"不是内部或外部命令"，需要先安装 Node.js。

3. **安装 Node.js（如果未安装）**
   - 访问 [Node.js 官网](https://nodejs.org/)
   - 下载 LTS 版本（推荐）
   - 运行安装程序，一路点击"下一步"
   - 安装完成后重新打开 CMD 验证

### 第二步：下载和配置项目

1. **选择安装位置并打开命令提示符**
   - 在文件资源管理器中找到你想安装项目的位置（例如：`D:\` 或 `C:\Users\你的用户名\Desktop\`）
   - 在该文件夹的地址栏中输入 `cmd` 并按回车（这样会在当前位置打开命令提示符）
   - 或者：打开命令提示符后，使用 `cd` 命令切换到想要的位置：
     ```bash
     cd D:\
     ```

2. **下载项目文件**
   - 在命令提示符中使用以下命令克隆项目：
   ```bash
   git clone https://github.com/digduggog/api-together.git
   ```
   - **注意**：git clone 会自动创建一个名为 `api-together` 的文件夹，不需要你手动创建

3. **进入项目文件夹**
   ```bash
   cd api-together
   ```

4. **安装依赖包**
   ```bash
   npm install
   ```
   等待安装完成（可能需要几分钟）

### 第三步：配置 API 端点

1. **打开配置文件**
   - 使用记事本或其他文本编辑器打开 `src/config/apis.json`

2. **修改配置**
   ```json
   {
     "server": {
       "port": 3001,
       "apiKey": "sk-123"
     },
     "apis": [
       {
         "id": "api1",
         "name": "OpenAI官方API",
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
         "name": "备用API端点",
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

3. **配置说明**
   - `baseUrl`: API 的基础地址
   - `apiKey`: 对应 API 的密钥
   - `rpm`: 每分钟最大请求数（-1 表示无限制）
   - `rpd`: 每日最大请求数（-1 表示无限制）
   - `enabled`: 是否启用此 API（true/false）
   - `models`: (必选) 支持的模型列表 (例如: `["gpt-3.5-turbo", "gpt-4"]`)
   - `modelMapping`: (可选) 模型名称映射，将请求模型映射到目标模型 (例如: `{"gpt-3.5": "gpt-3.5-turbo"}` 表示当请求模型为 `gpt-3.5` 时，将使用 `gpt-3.5-turbo` 模型)

### 第四步：启动服务

1. **启动服务器**
   ```bash
   npm start
   ```

2. **看到成功信息**
   ```
   🚀 OpenAI API代理服务已启动
   📡 服务地址: http://localhost:3001
   🔑 API密钥: sk-123
   📊 状态查询: http://localhost:3001/v1/status
   ❤️  健康检查: http://localhost:3001/health
   ```

3. **保持窗口打开**
   - 不要关闭命令提示符窗口
   - 服务会一直运行直到你按 `Ctrl + C` 停止

## 🔧 使用方法

### 基本使用

将你的 OpenAI API 请求地址从：
```
https://api.openai.com/v1/chat/completions
```

改为：
```
http://localhost:3001/v1/chat/completions
```

请求头中使用配置的密钥：
```
Authorization: Bearer sk-123
```

### 示例请求

**使用 curl 命令：**
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

**使用 Python：**
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

### 查看服务状态

访问状态端点查看所有 API 的使用情况：
```
http://localhost:3001/v1/status
```

## 📊 监控和管理

### 健康检查
```
GET http://localhost:3001/health
```

### API 状态查询
```
GET http://localhost:3001/v1/status
```

返回示例：
```json
{
  "service": "OpenAI API代理服务",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "apis": [
    {
      "id": "api1",
      "name": "OpenAI官方API",
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

## ⚙️ 高级配置

### 环境变量

创建 `.env` 文件（可选）：
```env
PORT=3001
NODE_ENV=production
```

### 请求限制说明

- **RPM (Requests Per Minute)**: 每分钟最大请求数
- **RPD (Requests Per Day)**: 每日最大请求数
- **-1**: 表示无限制
- **0**: 表示禁用该 API

### 添加更多 API 端点

在 `src/config/apis.json` 的 `apis` 数组中添加更多配置：

```json
{
  "id": "api3",
  "name": "第三方API",
  "baseUrl": "https://api.third-party.com",
  "apiKey": "sk-third-party-key",
  "rpm": 100,
  "rpd": 2000,
  "enabled": true
}
```

## 🛠️ 故障排除

### 常见问题

**Q: 启动时提示"端口已被占用"**
A: 修改 `src/config/apis.json` 中的 `port` 值，或者关闭占用 3001 端口的其他程序。

**Q: 请求返回 401 错误**
A: 检查请求头中的 `Authorization` 是否正确，应该是 `Bearer sk-123`。

**Q: 所有 API 都不可用**
A: 检查配置文件中的 API 密钥是否正确，网络连接是否正常。

**Q: 如何停止服务**
A: 在命令提示符窗口中按 `Ctrl + C`。

### 日志查看

服务运行时会在控制台显示详细日志：
- 绿色：正常信息
- 黄色：警告信息
- 红色：错误信息

### 重启服务

如果修改了配置文件，需要重启服务：
1. 按 `Ctrl + C` 停止服务
2. 运行 `npm start` 重新启动

## 📝 更新日志

### v1.0.0
- 初始版本发布
- 支持多端点轮询
- 实现 RPM/RPD 限制
- 添加配置文件管理
- 完善错误处理和日志

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如果遇到问题，请：
1. 检查本文档的故障排除部分
2. 查看控制台日志信息
3. 提交 Issue 描述问题