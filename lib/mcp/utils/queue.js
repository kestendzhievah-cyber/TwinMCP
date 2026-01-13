"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPQueue = void 0;
exports.getQueue = getQueue;
exports.initializeQueue = initializeQueue;
exports.closeQueue = closeQueue;
const uuid_1 = require("uuid");
const registry_1 = require("../core/registry");
class MCPQueue {
    jobs = new Map();
    workers = [];
    maxWorkers = 3;
    jobTimeout = 300000; // 5 minutes
    persistenceCallback;
    webhookCallback;
    constructor(options = {}) {
        this.maxWorkers = options.maxWorkers || 3;
        this.jobTimeout = options.jobTimeout || 300000;
        this.persistenceCallback = options.persistenceCallback;
        this.webhookCallback = options.webhookCallback;
        this.initializeWorkers();
    }
    initializeWorkers() {
        for (let i = 0; i < this.maxWorkers; i++) {
            this.workers.push({
                id: `worker-${i + 1}`,
                isBusy: false,
                currentJob: null,
                processJob: this.processJob.bind(this)
            });
        }
        console.log(`🚀 Queue initialized with ${this.maxWorkers} workers`);
    }
    async enqueue(job) {
        const jobId = (0, uuid_1.v4)();
        const queueJob = {
            ...job,
            id: jobId,
            status: 'pending',
            createdAt: new Date(),
            retries: 0
        };
        this.jobs.set(jobId, queueJob);
        // Persister le job
        if (this.persistenceCallback) {
            await this.persistenceCallback(queueJob);
        }
        console.log(`📝 Job enqueued: ${jobId} (${job.toolId})`);
        this.notifyWorkers();
        return jobId;
    }
    async getStatus(jobId) {
        return this.jobs.get(jobId) || null;
    }
    async getJobsByUser(userId) {
        return Array.from(this.jobs.values())
            .filter(job => job.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async getJobsByStatus(status) {
        return Array.from(this.jobs.values())
            .filter(job => job.status === status)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    async cancelJob(jobId, userId) {
        const job = this.jobs.get(jobId);
        if (!job || job.userId !== userId) {
            return false;
        }
        if (job.status === 'processing') {
            return false; // Ne peut pas annuler un job en cours
        }
        job.status = 'failed';
        job.error = 'Cancelled by user';
        job.completedAt = new Date();
        if (this.persistenceCallback) {
            await this.persistenceCallback(job);
        }
        console.log(`❌ Job cancelled: ${jobId}`);
        return true;
    }
    async processJob(job) {
        const startTime = Date.now();
        try {
            console.log(`⚡ Processing job: ${job.id} (${job.toolId})`);
            // Vérifier si l'outil existe
            const tool = registry_1.registry.get(job.toolId);
            if (!tool) {
                throw new Error(`Tool not found: ${job.toolId}`);
            }
            // Vérifier les capacités asynchrones
            if (!tool.capabilities.async) {
                throw new Error(`Tool ${job.toolId} does not support async execution`);
            }
            // Exécuter l'outil
            const result = await tool.execute(job.args, {});
            // Mettre à jour le job
            job.status = 'completed';
            job.result = result;
            job.completedAt = new Date();
            console.log(`✅ Job completed: ${job.id} (${Date.now() - startTime}ms)`);
            // Envoyer le webhook si configuré
            if (this.webhookCallback && tool.capabilities.webhook) {
                await this.webhookCallback(job);
            }
        }
        catch (error) {
            console.error(`❌ Job failed: ${job.id}`, error);
            if (job.retries < job.maxRetries) {
                job.retries++;
                job.status = 'pending';
                console.log(`🔄 Retrying job: ${job.id} (attempt ${job.retries})`);
                // Attendre avant de retenter (backoff exponentiel)
                setTimeout(() => {
                    this.notifyWorkers();
                }, Math.pow(2, job.retries) * 1000);
            }
            else {
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : 'Unknown error';
                job.completedAt = new Date();
            }
        }
        // Persister les changements
        if (this.persistenceCallback) {
            await this.persistenceCallback(job);
        }
    }
    notifyWorkers() {
        // Trouver un worker libre
        const freeWorker = this.workers.find(w => !w.isBusy);
        if (!freeWorker)
            return;
        // Trouver le prochain job à traiter (par priorité et date de création)
        const nextJob = this.getNextJob();
        if (!nextJob)
            return;
        // Assigner le job au worker
        freeWorker.isBusy = true;
        freeWorker.currentJob = nextJob;
        nextJob.status = 'processing';
        nextJob.startedAt = new Date();
        // Traiter le job de manière asynchrone
        freeWorker.processJob(nextJob)
            .finally(() => {
            freeWorker.isBusy = false;
            freeWorker.currentJob = null;
            // Notifier pour le prochain job
            setTimeout(() => this.notifyWorkers(), 100);
        });
    }
    getNextJob() {
        const pendingJobs = Array.from(this.jobs.values())
            .filter(job => job.status === 'pending')
            .sort((a, b) => {
            // Trier par priorité (high > normal > low)
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
            // Puis par date de création (plus ancien d'abord)
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
        return pendingJobs[0] || null;
    }
    getStats() {
        const jobs = Array.from(this.jobs.values());
        const stats = {
            total: jobs.length,
            pending: jobs.filter(j => j.status === 'pending').length,
            processing: jobs.filter(j => j.status === 'processing').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            failed: jobs.filter(j => j.status === 'failed').length,
            workersBusy: this.workers.filter(w => w.isBusy).length,
            workersTotal: this.workers.length,
            avgProcessingTime: 0
        };
        const completedJobs = jobs.filter(j => j.status === 'completed' && j.startedAt && j.completedAt);
        if (completedJobs.length > 0) {
            const totalTime = completedJobs.reduce((sum, job) => {
                return sum + (job.completedAt.getTime() - job.startedAt.getTime());
            }, 0);
            stats.avgProcessingTime = totalTime / completedJobs.length;
        }
        return stats;
    }
    async clear() {
        // Annuler tous les jobs en attente
        for (const job of this.jobs.values()) {
            if (job.status === 'pending') {
                job.status = 'failed';
                job.error = 'Queue cleared';
                job.completedAt = new Date();
            }
        }
        console.log('🧹 Queue cleared');
    }
    async close() {
        // Attendre que tous les workers terminent
        const maxWait = 30000; // 30 secondes max
        const startTime = Date.now();
        while (this.workers.some(w => w.isBusy) && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('🛑 Queue closed');
    }
}
exports.MCPQueue = MCPQueue;
// Instance globale
let globalQueue = null;
function getQueue() {
    if (!globalQueue) {
        globalQueue = new MCPQueue();
    }
    return globalQueue;
}
async function initializeQueue() {
    const queue = getQueue();
    console.log('🔄 Queue system initialized');
}
async function closeQueue() {
    if (globalQueue) {
        await globalQueue.close();
        globalQueue = null;
    }
}
//# sourceMappingURL=queue.js.map