import { logger } from '../../../../utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { LibraryController } from '../../../../controllers/library.controller';
import { LibraryIndexService } from '../../../../services/library-index.service';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Initialize services
const db = new Pool({ connectionString: process.env['DATABASE_URL'] });
const redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');
const libraryIndexService = new LibraryIndexService(db, redis);
const libraryController = new LibraryController(libraryIndexService);

export async function GET(
  _request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    // Mock request and reply objects for Next.js compatibility
    const mockRequest = {
      params,
      log: {
        error: (...args: unknown[]) => logger.error('Request error', { args })
      }
    } as any;

    const mockReply = {
      code: (statusCode: number) => ({
        send: (data: any) => NextResponse.json(data, { status: statusCode })
      }),
      send: (data: any) => NextResponse.json(data)
    } as any;

    // Get library versions
    return libraryController.getLibraryVersions(mockRequest, mockReply);
  } catch (error) {
    logger.error('Library versions API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
