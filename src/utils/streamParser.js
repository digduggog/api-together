const { Transform } = require('stream');
const logger = require('./logger');

/**
 * A Transform stream that parses Server-Sent Events (SSE) from an OpenAI-compatible API stream,
 * extracts token usage information, and passes the original data through.
 */
class StreamTokenParser extends Transform {
    /**
     * @param {object} options - Stream options.
     * @param {function} options.onTokenUsage - Callback function to be called with token usage data.
     *   The function will receive an object like: { promptTokens, completionTokens, totalTokens }
     */
    constructor(options) {
        super(options);
        this.onTokenUsage = options.onTokenUsage || (() => {});
        this.buffer = '';
    }

    _transform(chunk, encoding, callback) {
        // Add new chunk to buffer
        this.buffer += chunk.toString();
        
        // Process buffer line by line
        this.parseBuffer();
        
        // Pass the original chunk through to the client
        callback(null, chunk);
    }

    _flush(callback) {
        // Process any remaining data in the buffer when the stream ends
        this.parseBuffer(true);
        callback();
    }

    /**
     * Parses the internal buffer to find and process SSE data lines.
     * @param {boolean} isFlush - Indicates if this is the final flush call.
     */
    parseBuffer(isFlush = false) {
        // Split buffer into lines
        const lines = this.buffer.split('\n');
        
        // If not flushing, keep the last (potentially incomplete) line in the buffer
        this.buffer = isFlush ? '' : lines.pop();

        for (const line of lines) {
            if (line.startsWith('data:')) {
                const dataContent = line.substring(5).trim();
                
                if (dataContent === '[DONE]') {
                    // End of stream signal from OpenAI
                    continue;
                }

                try {
                    const jsonData = JSON.parse(dataContent);
                    
                    // The 'usage' field is typically included in the final data event of a stream
                    if (jsonData.usage && typeof jsonData.usage === 'object') {
                        const usage = {
                            promptTokens: jsonData.usage.prompt_tokens || 0,
                            completionTokens: jsonData.usage.completion_tokens || 0,
                            totalTokens: jsonData.usage.total_tokens || 0,
                        };

                        if (usage.totalTokens > 0) {
                             logger.info(`流式响应中提取的Token使用情况: ${JSON.stringify(usage)}`);
                            this.onTokenUsage(usage);
                        }
                    }
                } catch (error) {
                    // This line is not valid JSON, which can be normal for some lines in a stream.
                    // We can ignore it.
                }
            }
        }
    }
}

module.exports = StreamTokenParser;
