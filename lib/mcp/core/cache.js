"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPCache = void 0;
exports.getCache = getCache;
exports.initializeCache = initializeCache;
exports.closeCache = closeCache;
class MCPCache {
    memory = new Map();
    redis; // Redis client
    config;
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        if (this.config.strategy === 'redis' || this.config.strategy === 'hybrid') {
            try {
                const Redis = (await Promise.resolve().then(() => __importStar(require('ioredis')))).default;
                this.redis = new Redis({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    password: process.env.REDIS_PASSWORD,
                    db: parseInt(process.env.REDIS_DB || '0')
                });
                this.redis.on('error', (err) => {
                    console.error('Redis connection error:', err);
                });
                console.log('🔴 Redis cache initialized');
            }
            catch (error) {
                console.error('Failed to initialize Redis:', error);
                if (this.config.strategy === 'redis') {
                    throw new Error('Redis is required but not available');
                }
            }
        }
        // Nettoyage périodique du cache mémoire
        setInterval(() => this.cleanup(), 60000); // Nettoyer chaque minute
    }
    async get(key) {
        // 1. Vérifier le cache mémoire
        const memoryHit = this.memory.get(key);
        if (memoryHit && !this.isExpired(memoryHit)) {
            return memoryHit.value;
        }
        // 2. Vérifier le cache Redis si disponible
        if (this.redis && (this.config.strategy === 'redis' || this.config.strategy === 'hybrid')) {
            try {
                const redisData = await this.redis.get(key);
                if (redisData) {
                    const parsed = JSON.parse(redisData);
                    if (!this.isExpired(parsed)) {
                        // Remettre en cache mémoire
                        this.memory.set(key, parsed);
                        return parsed.value;
                    }
                    else {
                        // Supprimer de Redis si expiré
                        await this.redis.del(key);
                    }
                }
            }
            catch (error) {
                console.error('Redis get error:', error);
            }
        }
        return null;
    }
    async set(key, value, customTtl) {
        const ttl = customTtl || this.config.ttl;
        const entry = {
            value,
            timestamp: Date.now(),
            ttl
        };
        // Cache mémoire (toujours)
        this.memory.set(key, entry);
        // Cache Redis si disponible
        if (this.redis && (this.config.strategy === 'redis' || this.config.strategy === 'hybrid')) {
            try {
                await this.redis.setex(key, ttl, JSON.stringify(entry));
            }
            catch (error) {
                console.error('Redis set error:', error);
            }
        }
    }
    async delete(key) {
        this.memory.delete(key);
        if (this.redis) {
            try {
                await this.redis.del(key);
            }
            catch (error) {
                console.error('Redis delete error:', error);
            }
        }
    }
    async invalidate(pattern) {
        // Invalider les clés qui correspondent au pattern
        const regex = new RegExp(pattern.replace('*', '.*'));
        // Invalider du cache mémoire
        for (const [key] of this.memory) {
            if (regex.test(key)) {
                this.memory.delete(key);
            }
        }
        // Invalider de Redis si disponible
        if (this.redis) {
            try {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                }
            }
            catch (error) {
                console.error('Redis invalidate error:', error);
            }
        }
    }
    async clear() {
        this.memory.clear();
        if (this.redis) {
            try {
                await this.redis.flushdb();
            }
            catch (error) {
                console.error('Redis clear error:', error);
            }
        }
    }
    getStats() {
        return {
            memorySize: this.memory.size,
            strategy: this.config.strategy,
            redisConnected: !!this.redis
        };
    }
    isExpired(entry) {
        if (!entry.ttl)
            return false;
        return Date.now() - entry.timestamp > entry.ttl * 1000;
    }
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.memory) {
            if (entry.ttl && now - entry.timestamp > entry.ttl * 1000) {
                this.memory.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cache cleanup: ${cleaned} expired entries removed`);
        }
    }
    async close() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}
exports.MCPCache = MCPCache;
// Cache global
let globalCache = null;
function getCache() {
    if (!globalCache) {
        // Configuration par défaut
        globalCache = new MCPCache({
            enabled: true,
            ttl: 3600, // 1 heure
            key: (args) => JSON.stringify(args),
            strategy: 'memory'
        });
    }
    return globalCache;
}
async function initializeCache() {
    const cache = getCache();
    await cache.initialize();
}
async function closeCache() {
    if (globalCache) {
        await globalCache.close();
        globalCache = null;
    }
}
//# sourceMappingURL=cache.js.map