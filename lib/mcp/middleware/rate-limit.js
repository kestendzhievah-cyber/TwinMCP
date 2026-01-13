"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.RateLimiter = void 0;
class MemoryRateLimitStore {
    data = new Map();
    async increment(windowMs) {
        const now = Date.now();
        const resetTime = now + windowMs;
        const existing = this.data.get('global') || { count: 0, resetTime };
        if (now > existing.resetTime) {
            existing.count = 1;
            existing.resetTime = resetTime;
        }
        else {
            existing.count++;
        }
        this.data.set('global', existing);
        return existing.count;
    }
    async reset(key) {
        this.data.delete(key);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, data] of this.data) {
            if (now > data.resetTime) {
                this.data.delete(key);
            }
        }
    }
}
class RateLimiter {
    stores = new Map();
    memoryStore = new MemoryRateLimitStore();
    constructor() {
        // Nettoyage périodique
        setInterval(() => this.memoryStore.cleanup(), 60000);
    }
    async checkLimit(key, config) {
        const store = this.getStore(key);
        const count = await store.increment(config.requests * 1000); // Convertir en millisecondes
        const windowMs = this.parseTimePeriod(config.period);
        const resetAt = Date.now() + windowMs;
        return {
            allowed: count <= config.requests,
            remaining: Math.max(0, config.requests - count),
            resetAt,
            current: count
        };
    }
    // Rate limit par utilisateur
    async checkUserLimit(userId, toolId, config = {}) {
        const key = `user:${userId}:${toolId}`;
        const defaultConfig = {
            requests: 60,
            period: '1m',
            strategy: 'sliding',
            ...config
        };
        const result = await this.checkLimit(key, defaultConfig);
        return result.allowed;
    }
    // Rate limit global par outil
    async checkGlobalLimit(toolId, maxRequests = 1000) {
        const key = `global:${toolId}`;
        const result = await this.checkLimit(key, {
            requests: maxRequests,
            period: '1m',
            strategy: 'token-bucket'
        });
        return result.allowed;
    }
    // Rate limit par IP
    async checkIPLimit(ip, maxRequests = 100) {
        const key = `ip:${ip}`;
        const result = await this.checkLimit(key, {
            requests: maxRequests,
            period: '1m',
            strategy: 'sliding'
        });
        return result.allowed;
    }
    // Vérifier les limites multiples
    async checkMultipleLimits(userId, toolId, ip) {
        // 1. Vérifier limite globale de l'outil
        const globalAllowed = await this.checkGlobalLimit(toolId);
        if (!globalAllowed) {
            return { allowed: false, reason: 'Global rate limit exceeded' };
        }
        // 2. Vérifier limite par utilisateur
        const userAllowed = await this.checkUserLimit(userId, toolId);
        if (!userAllowed) {
            return { allowed: false, reason: 'User rate limit exceeded' };
        }
        // 3. Vérifier limite par IP
        const ipAllowed = await this.checkIPLimit(ip);
        if (!ipAllowed) {
            return { allowed: false, reason: 'IP rate limit exceeded' };
        }
        return { allowed: true };
    }
    // Obtenir les stats de rate limiting
    getStats() {
        return {
            activeStores: this.stores.size,
            memoryStoreSize: this.memoryStore['data']?.size || 0
        };
    }
    // Reset rate limit pour une clé spécifique
    async resetLimit(key) {
        const store = this.stores.get(key);
        if (store) {
            await store.reset(key);
        }
        else {
            await this.memoryStore.reset(key);
        }
    }
    getStore(key) {
        // Pour l'instant, on utilise le store mémoire
        // Plus tard, on pourrait implémenter Redis ou d'autres stores
        return this.memoryStore;
    }
    parseTimePeriod(period) {
        const unit = period.slice(-1);
        const value = parseInt(period.slice(0, -1));
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 60 * 1000; // 1 minute par défaut
        }
    }
}
exports.RateLimiter = RateLimiter;
// Instance globale
exports.rateLimiter = new RateLimiter();
//# sourceMappingURL=rate-limit.js.map