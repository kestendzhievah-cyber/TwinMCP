import { NextRequest, NextResponse } from 'next/server';
import { crawlerService, LIBRARY_CRAWL_CONFIGS } from '@/lib/services/github-crawler.service';
import { getQdrantService } from '@/lib/services/qdrant-vector.service';

// Simple admin auth check
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('X-Admin-Key');
  return adminKey === process.env.ADMIN_SECRET_KEY;
}

// GET - Get crawl status and available libraries
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    // Get vector store stats
    let vectorStats = { totalDocuments: 0, libraries: 0, indexedAt: '' };
    try {
      vectorStats = await getQdrantService().getStats();
    } catch {
      // Qdrant might not be available
    }

    // Get crawl configs with status
    const libraries = await Promise.all(
      LIBRARY_CRAWL_CONFIGS.map(async (config) => {
        const status = await crawlerService.getCrawlStatus(config.libraryId);
        return {
          libraryId: config.libraryId,
          owner: config.owner,
          repo: config.repo,
          version: config.version,
          docsPath: config.docsPath,
          lastCrawledAt: status?.lastCrawledAt,
          totalSnippets: status?.totalSnippets || 0,
          status: status?.lastCrawledAt ? 'crawled' : 'pending',
        };
      })
    );

    return NextResponse.json({
      vectorStore: vectorStats,
      libraries,
      availableConfigs: LIBRARY_CRAWL_CONFIGS.length,
    });
  } catch (error) {
    console.error('Failed to get crawl status:', error);
    return NextResponse.json(
      { error: 'Failed to get crawl status' },
      { status: 500 }
    );
  }
}

// POST - Trigger crawl for a library
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { libraryId, owner, repo, docsPath, version, async: runAsync } = body;

    // Find config or create new one
    let config = LIBRARY_CRAWL_CONFIGS.find(c => c.libraryId === libraryId);
    
    if (!config && owner && repo) {
      config = {
        libraryId: libraryId || `/${owner}/${repo}`,
        owner,
        repo,
        docsPath: docsPath || 'docs',
        version: version || 'latest',
      };
    }

    if (!config) {
      return NextResponse.json(
        { error: 'Library config not found. Provide owner and repo.' },
        { status: 400 }
      );
    }

    // Run crawl (async or sync)
    if (runAsync) {
      // Start crawl in background
      crawlerService.crawlLibrary(config).then(result => {
        console.log(`[Crawler] Async crawl completed:`, result);
      });

      return NextResponse.json({
        message: 'Crawl started in background',
        libraryId: config.libraryId,
        status: 'started',
      });
    } else {
      // Run synchronously
      const result = await crawlerService.crawlLibrary(config);
      
      return NextResponse.json({
        message: result.success ? 'Crawl completed successfully' : 'Crawl failed',
        result,
      });
    }
  } catch (error) {
    console.error('Failed to start crawl:', error);
    return NextResponse.json(
      { error: 'Failed to start crawl' },
      { status: 500 }
    );
  }
}

// DELETE - Clear indexed documents for a library
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get('libraryId');

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    await getQdrantService().deleteByLibrary(libraryId);

    return NextResponse.json({
      message: `Deleted indexed documents for ${libraryId}`,
    });
  } catch (error) {
    console.error('Failed to delete documents:', error);
    return NextResponse.json(
      { error: 'Failed to delete documents' },
      { status: 500 }
    );
  }
}
