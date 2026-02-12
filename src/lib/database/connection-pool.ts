import { Pool } from 'pg';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/database.log' })
  ]
});

export class DatabasePool {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'twinmcp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      maxUses: 7500
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.pool.on('connect', () => {
      logger.debug('New client connected to pool');
    });
    
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }
  
  async query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  }
  
  async getClient() {
    return await this.pool.connect();
  }
  
  async close() {
    await this.pool.end();
  }
}
