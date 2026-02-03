import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/prisma';
import { qdrantService, DocumentChunk } from './qdrant-vector.service';
import { v4 as uuidv4 } from 'uuid';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface CrawlConfig {
  libraryId: string;
  owner: string;
  repo: string;
  branch?: string;
  docsPath?: string;
  includePaths?: string[];
  excludePaths?: string[];
  maxFiles?: number;
  version?: string;
}

interface CrawlResult {
  success: boolean;
  libraryId: string;
  filesProcessed: number;
  chunksIndexed: number;
  errors: string[];
  duration: number;
}

interface FileContent {
  path: string;
  content: string;
  url: string;
}

export class GitHubCrawlerService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: GITHUB_TOKEN,
    });
  }

  // Main crawl method
  async crawlLibrary(config: CrawlConfig): Promise<CrawlResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let filesProcessed = 0;
    let chunksIndexed = 0;

    console.log(`[Crawler] Starting crawl for ${config.libraryId}`);

    try {
      // Get repository info
      const { data: repoInfo } = await this.octokit.repos.get({
        owner: config.owner,
        repo: config.repo,
      });

      const branch = config.branch || repoInfo.default_branch;
      const docsPath = config.docsPath || 'docs';

      // Get documentation files
      const files = await this.getDocumentationFiles(config, branch, docsPath);
      console.log(`[Crawler] Found ${files.length} documentation files`);

      // Process each file
      const chunks: DocumentChunk[] = [];
      
      for (const file of files.slice(0, config.maxFiles || 500)) {
        try {
          const fileChunks = await this.processFile(file, config, repoInfo.full_name);
          chunks.push(...fileChunks);
          filesProcessed++;
        } catch (error) {
          errors.push(`Failed to process ${file.path}: ${(error as Error).message}`);
        }
      }

      // Index chunks in Qdrant
      if (chunks.length > 0) {
        await qdrantService.indexDocuments(chunks);
        chunksIndexed = chunks.length;
      }

      // Update library metadata in database
      await this.updateLibraryMetadata(config.libraryId, {
        lastCrawledAt: new Date(),
        totalSnippets: chunksIndexed,
        version: config.version,
      });

      console.log(`[Crawler] Completed crawl for ${config.libraryId}: ${filesProcessed} files, ${chunksIndexed} chunks`);

      return {
        success: true,
        libraryId: config.libraryId,
        filesProcessed,
        chunksIndexed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`[Crawler] Crawl failed for ${config.libraryId}:`, error);
      errors.push((error as Error).message);

      return {
        success: false,
        libraryId: config.libraryId,
        filesProcessed,
        chunksIndexed,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  // Get documentation files from repository
  private async getDocumentationFiles(
    config: CrawlConfig,
    branch: string,
    docsPath: string
  ): Promise<FileContent[]> {
    const files: FileContent[] = [];
    
    try {
      // Try to get files from docs directory
      const { data: contents } = await this.octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: docsPath,
        ref: branch,
      });

      if (Array.isArray(contents)) {
        await this.collectFiles(config, branch, contents, files, docsPath);
      }
    } catch {
      // Docs folder doesn't exist, try README
      console.log(`[Crawler] No docs folder found, checking for README`);
    }

    // Always include README
    try {
      const readme = await this.getFileContent(config.owner, config.repo, 'README.md', branch);
      if (readme) {
        files.push(readme);
      }
    } catch {
      // README doesn't exist
    }

    // Check for additional include paths
    if (config.includePaths) {
      for (const path of config.includePaths) {
        try {
          const { data: contents } = await this.octokit.repos.getContent({
            owner: config.owner,
            repo: config.repo,
            path,
            ref: branch,
          });

          if (Array.isArray(contents)) {
            await this.collectFiles(config, branch, contents, files, path);
          }
        } catch {
          // Path doesn't exist
        }
      }
    }

    return files;
  }

  // Recursively collect files
  private async collectFiles(
    config: CrawlConfig,
    branch: string,
    contents: any[],
    files: FileContent[],
    basePath: string
  ): Promise<void> {
    for (const item of contents) {
      // Check exclusions
      if (config.excludePaths?.some(p => item.path.includes(p))) {
        continue;
      }

      if (item.type === 'file' && this.isDocFile(item.name)) {
        const fileContent = await this.getFileContent(
          config.owner,
          config.repo,
          item.path,
          branch
        );
        if (fileContent) {
          files.push(fileContent);
        }
      } else if (item.type === 'dir') {
        try {
          const { data: subContents } = await this.octokit.repos.getContent({
            owner: config.owner,
            repo: config.repo,
            path: item.path,
            ref: branch,
          });

          if (Array.isArray(subContents)) {
            await this.collectFiles(config, branch, subContents, files, item.path);
          }
        } catch {
          // Skip inaccessible directories
        }
      }
    }
  }

  // Get file content
  private async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch: string
  ): Promise<FileContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if ('content' in data && data.type === 'file') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
          path,
          content,
          url: data.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${path}`,
        };
      }
    } catch {
      // File not found or error
    }

    return null;
  }

  // Check if file is a documentation file
  private isDocFile(filename: string): boolean {
    const docExtensions = ['.md', '.mdx', '.rst', '.txt', '.html'];
    const docNames = ['README', 'CHANGELOG', 'CONTRIBUTING', 'API', 'GUIDE'];
    
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
    const name = filename.toUpperCase().replace(/\.[^.]+$/, '');
    
    return docExtensions.includes(ext) || docNames.includes(name);
  }

  // Process a file into chunks
  private async processFile(
    file: FileContent,
    config: CrawlConfig,
    repoFullName: string
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const sections = this.splitIntoSections(file.content);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (section.content.trim().length < 50) continue; // Skip very short sections

      const chunk: DocumentChunk = {
        id: uuidv4(),
        libraryId: config.libraryId,
        libraryName: repoFullName,
        version: config.version || 'latest',
        content: section.content,
        contentType: this.detectContentType(section.content),
        title: section.title || file.path,
        section: section.title || `Section ${i + 1}`,
        sourceUrl: file.url,
        tokenCount: this.estimateTokens(section.content),
        metadata: {
          filePath: file.path,
          sectionIndex: i,
        },
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  // Split content into sections based on headers
  private splitIntoSections(content: string): { title: string; content: string }[] {
    const sections: { title: string; content: string }[] = [];
    const lines = content.split('\n');
    
    let currentTitle = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
      
      if (headerMatch) {
        // Save previous section if exists
        if (currentContent.length > 0) {
          sections.push({
            title: currentTitle,
            content: currentContent.join('\n').trim(),
          });
        }
        
        currentTitle = headerMatch[2];
        currentContent = [line];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentContent.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentContent.join('\n').trim(),
      });
    }

    // If no sections were created, return the whole content
    if (sections.length === 0) {
      sections.push({ title: '', content });
    }

    return sections;
  }

  // Detect content type from content
  private detectContentType(content: string): 'snippet' | 'guide' | 'api_ref' {
    const codeBlockCount = (content.match(/```/g) || []).length / 2;
    const hasApiKeywords = /\b(api|endpoint|method|function|class|interface|type)\b/i.test(content);
    
    if (codeBlockCount >= 2) return 'snippet';
    if (hasApiKeywords && codeBlockCount >= 1) return 'api_ref';
    return 'guide';
  }

  // Estimate token count (roughly 4 chars per token)
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  // Update library metadata
  private async updateLibraryMetadata(
    libraryId: string,
    data: { lastCrawledAt: Date; totalSnippets: number; version?: string }
  ): Promise<void> {
    try {
      await prisma.library.update({
        where: { id: libraryId },
        data: {
          lastCrawledAt: data.lastCrawledAt,
          totalSnippets: data.totalSnippets,
          defaultVersion: data.version,
        },
      });
    } catch (error) {
      console.error('[Crawler] Failed to update library metadata:', error);
    }
  }

  // Get crawl status for a library
  async getCrawlStatus(libraryId: string): Promise<{
    lastCrawledAt: Date | null;
    totalSnippets: number;
    version: string | null;
  } | null> {
    try {
      const library = await prisma.library.findUnique({
        where: { id: libraryId },
        select: {
          lastCrawledAt: true,
          totalSnippets: true,
          defaultVersion: true,
        },
      });

      if (!library) return null;

      return {
        lastCrawledAt: library.lastCrawledAt,
        totalSnippets: library.totalSnippets,
        version: library.defaultVersion,
      };
    } catch {
      return null;
    }
  }
}

// Predefined crawl configurations for popular libraries
export const LIBRARY_CRAWL_CONFIGS: CrawlConfig[] = [
  {
    libraryId: '/vercel/next.js',
    owner: 'vercel',
    repo: 'next.js',
    docsPath: 'docs',
    includePaths: ['examples'],
    excludePaths: ['node_modules', '.github'],
    version: '15.0',
  },
  {
    libraryId: '/facebook/react',
    owner: 'facebook',
    repo: 'react',
    docsPath: 'docs',
    version: '19.0',
  },
  {
    libraryId: '/mongodb/docs',
    owner: 'mongodb',
    repo: 'node-mongodb-native',
    docsPath: 'docs',
    includePaths: ['README.md'],
    version: '8.0',
  },
  {
    libraryId: '/prisma/prisma',
    owner: 'prisma',
    repo: 'prisma',
    docsPath: 'docs',
    version: '6.0',
  },
  {
    libraryId: '/supabase/supabase',
    owner: 'supabase',
    repo: 'supabase-js',
    includePaths: ['README.md', 'docs'],
    version: '2.45',
  },
  {
    libraryId: '/tailwindlabs/tailwindcss',
    owner: 'tailwindlabs',
    repo: 'tailwindcss',
    docsPath: 'docs',
    version: '4.0',
  },
];

// Export singleton
export const crawlerService = new GitHubCrawlerService();
