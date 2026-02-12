import { Request, Response } from 'express';
import { databaseHealthCheck } from '../config/database';
import { redisHealthCheck } from '../config/redis';

export class HealthController {
  static async check(req: Request, res: Response) {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: await databaseHealthCheck(),
        redis: await redisHealthCheck(),
      },
    };

    const allHealthy = Object.values(health.services).every(Boolean);
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json(health);
  }

  static async readiness(req: Request, res: Response) {
    // Check readiness for Kubernetes
    const isReady = await databaseHealthCheck() && await redisHealthCheck();
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
    });
  }

  static async liveness(req: Request, res: Response) {
    // Simple liveness probe
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
    });
  }
}
