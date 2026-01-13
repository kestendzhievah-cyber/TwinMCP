"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubTool = void 0;
const zod_1 = require("zod");
const core_1 = require("../../core");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../utils");
const githubRepoSchema = zod_1.z.object({
    owner: zod_1.z.string().min(1, 'Owner is required'),
    repo: zod_1.z.string().min(1, 'Repository name is required'),
    action: zod_1.z.enum(['issues', 'pulls', 'commits', 'releases', 'create_issue', 'create_pr']),
    data: zod_1.z.object({
        title: zod_1.z.string().optional(),
        body: zod_1.z.string().optional(),
        assignee: zod_1.z.string().optional(),
        labels: zod_1.z.array(zod_1.z.string()).optional(),
        branch: zod_1.z.string().optional(),
        base: zod_1.z.string().optional(),
        head: zod_1.z.string().optional()
    }).optional(),
    limit: zod_1.z.number().min(1).max(100).default(20),
    state: zod_1.z.enum(['open', 'closed', 'all']).default('open')
});
class GitHubTool {
    id = 'github';
    name = 'GitHub Repository';
    version = '1.0.0';
    category = 'development';
    description = 'Interact with GitHub repositories - read issues, PRs, commits and create new items';
    author = 'MCP Team';
    tags = ['github', 'git', 'repository', 'development', 'issues', 'pull-requests'];
    requiredConfig = ['github_token'];
    optionalConfig = ['default_owner', 'default_repo'];
    inputSchema = githubRepoSchema;
    capabilities = {
        async: false,
        batch: true,
        streaming: false,
        webhook: true
    };
    rateLimit = {
        requests: 500,
        period: '1h',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 600, // 10 minutes
        key: (args) => `github:${args.owner}:${args.repo}:${args.action}:${args.state}`,
        strategy: 'memory'
    };
    async validate(args) {
        try {
            const validated = await this.inputSchema.parseAsync(args);
            return { success: true, data: validated };
        }
        catch (error) {
            return {
                success: false,
                errors: error.errors?.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message
                })) || [{ path: 'unknown', message: 'Validation failed' }]
            };
        }
    }
    async execute(args, config) {
        const startTime = Date.now();
        try {
            // Validation des arguments
            const validation = await this.validate(args);
            if (!validation.success) {
                throw new Error(`Validation failed: ${validation.errors?.map(e => e.message).join(', ')}`);
            }
            // Vérifier les rate limits
            const userLimit = await middleware_1.rateLimiter.checkUserLimit(config.userId || 'anonymous', this.id);
            if (!userLimit) {
                throw new Error('Rate limit exceeded for GitHub tool');
            }
            // Vérifier le cache (sauf pour les actions de création)
            const cache = (0, core_1.getCache)();
            const cacheKey = this.cache.key(args);
            const cachedResult = args.action.startsWith('create_') ? null : await cache.get(cacheKey);
            if (cachedResult) {
                console.log(`🐙 GitHub cache hit for ${args.owner}/${args.repo}/${args.action}`);
                (0, utils_1.getMetrics)().track({
                    toolId: this.id,
                    userId: config.userId || 'anonymous',
                    timestamp: new Date(),
                    executionTime: Date.now() - startTime,
                    cacheHit: true,
                    success: true,
                    apiCallsCount: 0,
                    estimatedCost: 0
                });
                return {
                    success: true,
                    data: cachedResult,
                    metadata: {
                        executionTime: Date.now() - startTime,
                        cacheHit: true,
                        apiCallsCount: 0,
                        cost: 0
                    }
                };
            }
            // Exécuter l'action GitHub
            const result = await this.executeGitHubAction(args, config);
            // Mettre en cache (sauf pour les actions de création)
            if (!args.action.startsWith('create_')) {
                await cache.set(cacheKey, result, this.cache.ttl);
            }
            // Tracker les métriques
            (0, utils_1.getMetrics)().track({
                toolId: this.id,
                userId: config.userId || 'anonymous',
                timestamp: new Date(),
                executionTime: Date.now() - startTime,
                cacheHit: false,
                success: true,
                apiCallsCount: 1,
                estimatedCost: args.action.startsWith('create_') ? 0.001 : 0.0005
            });
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false,
                    apiCallsCount: 1,
                    cost: args.action.startsWith('create_') ? 0.001 : 0.0005
                }
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            (0, utils_1.getMetrics)().track({
                toolId: this.id,
                userId: config.userId || 'anonymous',
                timestamp: new Date(),
                executionTime,
                cacheHit: false,
                success: false,
                errorType: error.name || 'GitHubError',
                apiCallsCount: 1,
                estimatedCost: 0
            });
            return {
                success: false,
                error: error.message,
                metadata: {
                    executionTime,
                    cacheHit: false,
                    apiCallsCount: 1,
                    cost: 0
                }
            };
        }
    }
    async executeGitHubAction(args, config) {
        // Simulation des actions GitHub
        // Dans une vraie implémentation, utiliser GitHub API
        await new Promise(resolve => setTimeout(resolve, 180)); // Simulation réseau
        switch (args.action) {
            case 'issues':
                return await this.getIssues(args);
            case 'pulls':
                return await this.getPullRequests(args);
            case 'commits':
                return await this.getCommits(args);
            case 'releases':
                return await this.getReleases(args);
            case 'create_issue':
                return await this.createIssue(args, config);
            case 'create_pr':
                return await this.createPullRequest(args, config);
            default:
                throw new Error(`Unsupported action: ${args.action}`);
        }
    }
    async getIssues(args) {
        const issues = [];
        const numIssues = Math.floor(Math.random() * args.limit) + 1;
        for (let i = 0; i < numIssues; i++) {
            issues.push({
                id: Math.floor(Math.random() * 10000),
                number: i + 1,
                title: `Issue ${i + 1}: ${['Bug', 'Feature', 'Enhancement'][Math.floor(Math.random() * 3)]}`,
                state: args.state,
                body: `This is a sample issue description for testing purposes.`,
                labels: [
                    { name: ['bug', 'enhancement', 'question'][Math.floor(Math.random() * 3)] },
                    { name: ['good first issue', 'help wanted', 'priority:high'][Math.floor(Math.random() * 3)] }
                ].filter(() => Math.random() > 0.3),
                assignee: Math.random() > 0.5 ? { login: 'assignee' } : null,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        return {
            issues,
            total_count: numIssues,
            repository: `${args.owner}/${args.repo}`,
            state: args.state,
            metadata: {
                apiCalls: 1,
                queryTime: 180
            }
        };
    }
    async getPullRequests(args) {
        const pulls = [];
        const numPulls = Math.floor(Math.random() * args.limit) + 1;
        for (let i = 0; i < numPulls; i++) {
            pulls.push({
                id: Math.floor(Math.random() * 10000),
                number: i + 100,
                title: `PR ${i + 1}: ${['feat', 'fix', 'docs', 'refactor'][Math.floor(Math.random() * 4)]}: Sample pull request`,
                state: args.state,
                body: `This is a sample pull request description.`,
                base: { ref: args.data?.base || 'main' },
                head: { ref: args.data?.head || 'feature-branch' },
                merged: Math.random() > 0.5,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        return {
            pulls,
            total_count: numPulls,
            repository: `${args.owner}/${args.repo}`,
            metadata: {
                apiCalls: 1,
                queryTime: 180
            }
        };
    }
    async getCommits(args) {
        const commits = [];
        const numCommits = Math.floor(Math.random() * args.limit) + 1;
        for (let i = 0; i < numCommits; i++) {
            commits.push({
                sha: Math.random().toString(36).substr(2, 8),
                message: `Commit ${i + 1}: ${['Initial commit', 'Add feature', 'Fix bug', 'Update docs'][Math.floor(Math.random() * 4)]}`,
                author: {
                    name: 'Test Author',
                    email: 'author@example.com'
                },
                date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        return {
            commits,
            total_count: numCommits,
            repository: `${args.owner}/${args.repo}`,
            metadata: {
                apiCalls: 1,
                queryTime: 180
            }
        };
    }
    async getReleases(args) {
        const releases = [];
        const numReleases = Math.floor(Math.random() * args.limit) + 1;
        for (let i = 0; i < numReleases; i++) {
            releases.push({
                id: Math.floor(Math.random() * 10000),
                tag_name: `v${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
                name: `Release ${i + 1}`,
                body: `Release notes for version ${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                published_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        return {
            releases,
            total_count: numReleases,
            repository: `${args.owner}/${args.repo}`,
            metadata: {
                apiCalls: 1,
                queryTime: 180
            }
        };
    }
    async createIssue(args, config) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
            id: Math.floor(Math.random() * 10000),
            number: Math.floor(Math.random() * 1000) + 1000,
            title: args.data?.title || 'New Issue',
            body: args.data?.body || '',
            state: 'open',
            labels: args.data?.labels || [],
            assignee: args.data?.assignee ? { login: args.data.assignee } : null,
            repository: `${args.owner}/${args.repo}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            html_url: `https://github.com/${args.owner}/${args.repo}/issues/${Math.floor(Math.random() * 1000) + 1000}`,
            metadata: {
                apiCalls: 1,
                created: true
            }
        };
    }
    async createPullRequest(args, config) {
        await new Promise(resolve => setTimeout(resolve, 250));
        return {
            id: Math.floor(Math.random() * 10000),
            number: Math.floor(Math.random() * 1000) + 2000,
            title: args.data?.title || 'New Pull Request',
            body: args.data?.body || '',
            state: 'open',
            base: { ref: args.data?.base || 'main' },
            head: { ref: args.data?.head || 'feature-branch' },
            repository: `${args.owner}/${args.repo}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            html_url: `https://github.com/${args.owner}/${args.repo}/pull/${Math.floor(Math.random() * 1000) + 2000}`,
            metadata: {
                apiCalls: 1,
                created: true
            }
        };
    }
    async beforeExecute(args) {
        console.log(`🐙 GitHub action: ${args.action} on ${args.owner}/${args.repo}`);
        return args;
    }
    async afterExecute(result) {
        if (result.success) {
            const action = result.data?.metadata?.created ? 'created' : 'retrieved';
            console.log(`✅ GitHub ${action}: ${result.data?.total_count || 1} items`);
        }
        return result;
    }
    async onError(error) {
        console.error(`❌ GitHub error: ${error.message}`);
    }
}
exports.GitHubTool = GitHubTool;
//# sourceMappingURL=github.js.map