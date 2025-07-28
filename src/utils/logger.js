// 简单的日志工具
class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  // 获取时间戳
  getTimestamp() {
    return new Date().toISOString();
  }

  // 格式化日志消息
  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      logMessage += ` ${typeof data === 'object' ? JSON.stringify(data) : data}`;
    }
    
    return logMessage;
  }

  // 信息日志
  info(message, data = null) {
    const logMessage = this.formatMessage('INFO', message, data);
    console.log(`${this.colors.green}${logMessage}${this.colors.reset}`);
  }

  // 警告日志
  warn(message, data = null) {
    const logMessage = this.formatMessage('WARN', message, data);
    console.log(`${this.colors.yellow}${logMessage}${this.colors.reset}`);
  }

  // 错误日志
  error(message, data = null) {
    const logMessage = this.formatMessage('ERROR', message, data);
    console.error(`${this.colors.red}${logMessage}${this.colors.reset}`);
  }

  // 调试日志
  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      const logMessage = this.formatMessage('DEBUG', message, data);
      console.log(`${this.colors.cyan}${logMessage}${this.colors.reset}`);
    }
  }

  // 成功日志
  success(message, data = null) {
    const logMessage = this.formatMessage('SUCCESS', message, data);
    console.log(`${this.colors.green}${logMessage}${this.colors.reset}`);
  }
}

module.exports = new Logger();