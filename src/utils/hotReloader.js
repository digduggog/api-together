const chokidar = require('chokidar');
const path = require('path');
const apiManager = require('../services/apiManager');
const logger = require('./logger');

class ConfigHotReloader {
    constructor() {
        this.configPath = path.resolve(__dirname, '../config/apis.json');
        this.watcher = null;
        this.isReloading = false;
    }

    /**
     * 启动配置文件热重载
     */
    start() {
        if (this.watcher) {
            logger.warn('Config hot reloader is already running');
            return;
        }

        logger.info(`Starting config hot reloader for: ${this.configPath}`);
        
        // 使用 chokidar 监控配置文件
        this.watcher = chokidar.watch(this.configPath, {
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', this.handleFileChange.bind(this))
            .on('change', this.handleFileChange.bind(this))
            .on('error', this.handleError.bind(this));

        logger.info('Config hot reloader started successfully');
    }

    /**
     * 停止配置文件热重载
     */
    stop() {
        if (!this.watcher) {
            logger.warn('Config hot reloader is not running');
            return;
        }

        logger.info('Stopping config hot reloader...');
        
        this.watcher.close().then(() => {
            this.watcher = null;
            logger.info('Config hot reloader stopped');
        }).catch(error => {
            logger.error('Error stopping config hot reloader:', error);
        });
    }

    /**
     * 处理文件变化事件
     */
    handleFileChange(filePath) {
        if (this.isReloading) {
            logger.debug('Already reloading, skipping...');
            return;
        }

        this.isReloading = true;
        logger.info(`Config file changed: ${filePath}`);

        // 尝试重新加载配置
        try {
            const success = apiManager.reloadApis();
            if (success) {
                logger.info('Configuration reloaded successfully');
            } else {
                logger.error('Failed to reload configuration');
            }
        } catch (error) {
            logger.error('Error during configuration reload:', error);
        } finally {
            this.isReloading = false;
        }
    }

    /**
     * 处理监控错误
     */
    handleError(error) {
        logger.error('Config hot reloader error:', error);
    }
}

// 创建单例实例
const hotReloader = new ConfigHotReloader();

module.exports = hotReloader;