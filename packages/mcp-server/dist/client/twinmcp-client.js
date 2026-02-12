"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwinMCPClient = void 0;
const logger_1 = require("../utils/logger");
class TwinMCPClient {
    constructor(options = {}) {
        this.config = {
            serverUrl: options.serverUrl || process.env['TWINMCP_SERVER_URL'] || 'http://localhost:3000',
            apiKey: options.apiKey || process.env['TWINMCP_API_KEY'] || '',
            timeout: options.timeout || 30000,
            retries: options.retries || 3,
        };
        this.logger = options.logger || logger_1.MCPLogger.create('TwinMCPClient');
        if (!this.config.apiKey) {
            this.logger.warn('No API key provided, some features may be limited');
        }
    }
    async resolveLibrary(params) {
        return this.makeRequest('/api/resolve-library', params);
    }
    async queryDocs(params) {
        return this.makeRequest('/api/query-docs', params);
    }
    async makeRequest(endpoint, data) {
        const url = `${this.config.serverUrl}${endpoint}`;
        const requestId = this.generateRequestId();
        this.logger.debug('Making request', { requestId, endpoint, hasData: !!data });
        let lastError;
        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                const requestOptions = {
                    method: data ? 'POST' : 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Request-ID': requestId,
                        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
                    },
                };
                if (data) {
                    requestOptions.body = JSON.stringify(data);
                }
                const response = await this.fetchWithTimeout(url, requestOptions);
                if (!response.ok) {
                    const errorData = (await response.json().catch(() => ({})));
                    throw new Error(errorData.message || `HTTP ${response.status}`);
                }
                const result = (await response.json());
                this.logger.debug('Request successful', { requestId, attempt });
                return result;
            }
            catch (error) {
                lastError = error;
                this.logger.warn(`Request attempt ${attempt} failed`, { requestId, error: lastError.message });
                if (attempt < this.config.retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        this.logger.error('Request failed after all retries', lastError, { requestId });
        throw lastError;
    }
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.config.timeout}ms`);
            }
            throw error;
        }
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async healthCheck() {
        try {
            await this.makeRequest('/api/health');
            return true;
        }
        catch (error) {
            this.logger.error('Health check failed', error);
            return false;
        }
    }
}
exports.TwinMCPClient = TwinMCPClient;
//# sourceMappingURL=twinmcp-client.js.map