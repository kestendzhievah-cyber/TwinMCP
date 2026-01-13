"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarTool = void 0;
const zod_1 = require("zod");
const core_1 = require("../../core");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../utils");
const calendarReadSchema = zod_1.z.object({
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    calendarId: zod_1.z.string().optional(),
    maxResults: zod_1.z.number().min(1).max(100).default(50),
    singleEvents: zod_1.z.boolean().default(true),
    orderBy: zod_1.z.enum(['startTime', 'updated']).default('startTime')
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
    message: "Start date must be before end date",
    path: ["endDate"]
});
class CalendarTool {
    id = 'calendar';
    name = 'Read Calendar';
    version = '1.0.0';
    category = 'productivity';
    description = 'Read Google Calendar events with advanced filtering and caching';
    author = 'MCP Team';
    tags = ['calendar', 'google', 'events', 'productivity', 'schedule'];
    requiredConfig = ['google_calendar_api_key'];
    optionalConfig = ['default_calendar_id', 'timezone'];
    inputSchema = calendarReadSchema;
    capabilities = {
        async: false,
        batch: true,
        streaming: false,
        webhook: true
    };
    rateLimit = {
        requests: 200,
        period: '1h',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 600, // 10 minutes
        key: (args) => `calendar:${args.calendarId || 'primary'}:${args.startDate}:${args.endDate}`,
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
                throw new Error('Rate limit exceeded for calendar tool');
            }
            // Vérifier le cache
            const cache = (0, core_1.getCache)();
            const cacheKey = this.cache.key(args);
            const cachedResult = await cache.get(cacheKey);
            if (cachedResult) {
                console.log(`📅 Calendar cache hit for ${args.startDate} to ${args.endDate}`);
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
            // Simulation de la lecture du calendrier
            const result = await this.readCalendarEvents(args, config);
            // Mettre en cache
            await cache.set(cacheKey, result, this.cache.ttl);
            // Tracker les métriques
            (0, utils_1.getMetrics)().track({
                toolId: this.id,
                userId: config.userId || 'anonymous',
                timestamp: new Date(),
                executionTime: Date.now() - startTime,
                cacheHit: false,
                success: true,
                apiCallsCount: 1,
                estimatedCost: 0.0005 // Coût estimé par requête calendar
            });
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false,
                    apiCallsCount: 1,
                    cost: 0.0005
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
                errorType: error.name || 'CalendarError',
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
    async readCalendarEvents(args, config) {
        // Simulation de la lecture des événements calendrier
        // Dans une vraie implémentation, utiliser Google Calendar API
        await new Promise(resolve => setTimeout(resolve, 150)); // Simulation réseau
        const startDate = new Date(args.startDate);
        const endDate = new Date(args.endDate);
        // Générer des événements simulés
        const events = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            // Générer 0-3 événements par jour
            const eventsPerDay = Math.floor(Math.random() * 4);
            for (let i = 0; i < eventsPerDay; i++) {
                const hour = 8 + Math.floor(Math.random() * 10); // 8h à 18h
                const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45 min
                const duration = 30 + Math.floor(Math.random() * 4) * 30; // 30min à 2h
                const eventStart = new Date(currentDate);
                eventStart.setHours(hour, minute, 0, 0);
                const eventEnd = new Date(eventStart);
                eventEnd.setMinutes(eventEnd.getMinutes() + duration);
                events.push({
                    id: `event_${currentDate.toISOString().split('T')[0]}_${i}`,
                    summary: `Meeting ${i + 1}`,
                    description: `Scheduled meeting on ${currentDate.toLocaleDateString()}`,
                    start: {
                        dateTime: eventStart.toISOString(),
                        timeZone: args.timezone || 'UTC'
                    },
                    end: {
                        dateTime: eventEnd.toISOString(),
                        timeZone: args.timezone || 'UTC'
                    },
                    status: 'confirmed',
                    attendees: [
                        { email: 'organizer@example.com', responseStatus: 'accepted' },
                        { email: 'attendee@example.com', responseStatus: 'needsAction' }
                    ],
                    location: `Room ${Math.floor(Math.random() * 10) + 1}`,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return {
            events: events.slice(0, args.maxResults),
            totalCount: events.length,
            startDate: args.startDate,
            endDate: args.endDate,
            calendarId: args.calendarId || 'primary',
            maxResults: args.maxResults,
            nextSyncToken: `sync_${Date.now()}`,
            metadata: {
                queryTime: 150,
                apiCalls: 1,
                filtered: events.length > args.maxResults
            }
        };
    }
    async beforeExecute(args) {
        console.log(`📅 Fetching calendar events from ${args.startDate} to ${args.endDate}`);
        return args;
    }
    async afterExecute(result) {
        if (result.success) {
            console.log(`✅ Retrieved ${result.data?.events?.length || 0} calendar events`);
        }
        return result;
    }
    async onError(error) {
        console.error(`❌ Calendar error: ${error.message}`);
    }
}
exports.CalendarTool = CalendarTool;
//# sourceMappingURL=calendar.js.map