import { NextRequest, NextResponse } from 'next/server';
import { LibraryController } from '../../controllers/library.controller';
import { LibraryIndexService } from '../../services/library-index.service';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Initialize services
const db = new Pool({ connectionString: process.env['DATABASE_URL'] });
const redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');
const libraryIndexService = new LibraryIndexService(db, redis);
const libraryController = new LibraryController(libraryIndexService);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = Object.fromEntries(searchParams.entries());
  
  // Mock request and reply objects for Next.js compatibility
  const mockRequest = {
    query,
    params: {},
    log: {
      error: console.error
    }
  } as any;

  const mockReply = {
    code: (statusCode: number) => ({
      send: (data: any) => NextResponse.json(data, { status: statusCode })
    }),
    send: (data: any) => NextResponse.json(data)
  } as any;

  try {
    // Route to appropriate controller method based on query parameters
    if (query['q'] !== undefined && !query['name']) {
      // Search libraries
      return libraryController.searchLibraries(mockRequest, mockReply);
    } else if (query['name']) {
      // Get specific library
      mockRequest.params = { name: query['name'] };
      return libraryController.getLibrary(mockRequest, mockReply);
    } else if (query['suggestions'] !== undefined) {
      // Get suggestions
      return libraryController.getSuggestions(mockRequest, mockReply);
    } else {
      // Default to search with no query
      return libraryController.searchLibraries(mockRequest, mockReply);
    }
  } catch (error) {
    console.error('Library API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Index a new library
    const result = await libraryIndexService.indexLibrary(body);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Library index error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to index library' },
      { status: 400 }
    );
  }
}
