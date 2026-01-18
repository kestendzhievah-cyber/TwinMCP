# E10-Story10-6-Plan-Haute-Priorite.md

## Plan d'Implémentation - Haute Priorité

**Date**: 2026-01-18  
**Priorité**: HAUTE  
**Durée estimée**: 12-14 semaines  
**Dépendances**: Fonctionnalités critiques (Tests, OAuth, Monitoring, Documentation, CI/CD)

---

## 🎯 Objectifs

Implémenter les 5 fonctionnalités à haute priorité pour compléter les fonctionnalités core du projet:

1. **Crawling** - Indexation automatique de documentation
2. **Embeddings** - Optimisation de la recherche vectorielle
3. **Providers LLM** - Support multi-providers (Claude, Gemini)
4. **Interface Chat** - Expérience utilisateur avancée
5. **Analytics** - Tracking et insights utilisateur

---

## 📋 1. CRAWLING & INDEXATION

### Objectif
Système complet de crawling et indexation de documentation multi-sources.

### État Actuel
- Monitoring GitHub: 30%
- Download sources: 20%
- Indexation: 0%
- Scheduler: 0%

### Plan d'Action (3 semaines)

#### Semaine 1: Infrastructure de Crawling

**Dépendances:**
```bash
npm install cheerio puppeteer
npm install turndown gray-matter
npm install bull bullmq
npm install node-cron
```

**Architecture:**
```
src/crawlers/
├── base/
│   ├── crawler.interface.ts
│   ├── base-crawler.ts
│   └── crawler-config.ts
├── github/
│   ├── github-crawler.ts
│   ├── github-parser.ts
│   └── github-webhook.ts
├── documentation/
│   ├── docs-crawler.ts
│   ├── markdown-parser.ts
│   └── html-parser.ts
├── npm/
│   ├── npm-crawler.ts
│   └── npm-parser.ts
└── scheduler/
    ├── crawl-scheduler.ts
    ├── priority-queue.ts
    └── rate-limiter.ts
```

**Base Crawler:**
```typescript
// src/crawlers/base/crawler.interface.ts
export interface ICrawler {
  name: string;
  type: CrawlerType;
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
  parse(content: string): Promise<ParsedContent>;
  validate(content: ParsedContent): boolean;
  store(content: ParsedContent): Promise<void>;
}

export interface CrawlOptions {
  depth?: number;
  maxPages?: number;
  followLinks?: boolean;
  respectRobotsTxt?: boolean;
  userAgent?: string;
  timeout?: number;
  retries?: number;
}

export interface CrawlResult {
  url: string;
  content: string;
  metadata: CrawlMetadata;
  links: string[];
  timestamp: Date;
}

export interface ParsedContent {
  title: string;
  description: string;
  content: string;
  sections: Section[];
  codeBlocks: CodeBlock[];
  metadata: ContentMetadata;
}
```

**Schéma Database:**
```sql
-- Crawl Jobs
CREATE TABLE crawl_jobs (
    id UUID PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL,
    source_url TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    priority INTEGER DEFAULT 5,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crawled Content
CREATE TABLE crawled_content (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES crawl_jobs(id),
    url TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    content_type VARCHAR(50),
    language VARCHAR(10),
    metadata JSONB,
    hash VARCHAR(64) UNIQUE,
    indexed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Content Sections
CREATE TABLE content_sections (
    id UUID PRIMARY KEY,
    content_id UUID REFERENCES crawled_content(id),
    heading TEXT,
    level INTEGER,
    content TEXT,
    order_index INTEGER,
    metadata JSONB
);

-- Code Blocks
CREATE TABLE code_blocks (
    id UUID PRIMARY KEY,
    content_id UUID REFERENCES crawled_content(id),
    language VARCHAR(50),
    code TEXT,
    description TEXT,
    line_start INTEGER,
    line_end INTEGER
);

CREATE INDEX idx_crawled_content_hash ON crawled_content(hash);
CREATE INDEX idx_crawled_content_indexed ON crawled_content(indexed);
CREATE INDEX idx_crawl_jobs_status ON crawl_jobs(status);
```

#### Semaine 2: Crawlers Spécifiques

**GitHub Crawler:**
```typescript
// src/crawlers/github/github-crawler.ts
export class GitHubCrawler implements ICrawler {
  async crawl(repoUrl: string): Promise<CrawlResult> {
    // 1. Clone ou download repository
    const repo = await this.downloadRepo(repoUrl);
    
    // 2. Parse README.md
    const readme = await this.parseReadme(repo);
    
    // 3. Parse documentation folder
    const docs = await this.parseDocs(repo);
    
    // 4. Extract code examples
    const examples = await this.extractExamples(repo);
    
    // 5. Parse JSDoc/TSDoc comments
    const apiDocs = await this.parseApiDocs(repo);
    
    return {
      url: repoUrl,
      content: this.mergeContent([readme, docs, examples, apiDocs]),
      metadata: await this.extractMetadata(repo),
      links: this.extractLinks(docs),
      timestamp: new Date()
    };
  }
  
  private async parseReadme(repo: Repository): Promise<string> {
    const readmePath = this.findReadme(repo);
    const content = await fs.readFile(readmePath, 'utf-8');
    return this.markdownToText(content);
  }
  
  private async parseDocs(repo: Repository): Promise<string[]> {
    const docsPaths = ['docs/', 'documentation/', 'wiki/'];
    const docs: string[] = [];
    
    for (const path of docsPaths) {
      if (await this.exists(repo, path)) {
        const files = await this.findMarkdownFiles(repo, path);
        for (const file of files) {
          docs.push(await this.parseMarkdownFile(file));
        }
      }
    }
    
    return docs;
  }
}
```

**Documentation Sites Crawler:**
```typescript
// src/crawlers/documentation/docs-crawler.ts
export class DocumentationCrawler implements ICrawler {
  async crawl(url: string, options: CrawlOptions): Promise<CrawlResult> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      // Extract main content
      const content = await page.evaluate(() => {
        const main = document.querySelector('main, article, .content');
        return main?.textContent || document.body.textContent;
      });
      
      // Extract navigation links
      const links = await this.extractLinks(page, url, options.depth);
      
      // Extract metadata
      const metadata = await this.extractMetadata(page);
      
      return {
        url,
        content: this.cleanContent(content),
        metadata,
        links,
        timestamp: new Date()
      };
    } finally {
      await browser.close();
    }
  }
  
  private async extractLinks(
    page: Page, 
    baseUrl: string, 
    maxDepth: number
  ): Promise<string[]> {
    const links = await page.$$eval('a[href]', (anchors) =>
      anchors.map(a => a.getAttribute('href'))
    );
    
    return links
      .filter(link => link && this.isValidDocLink(link, baseUrl))
      .map(link => new URL(link, baseUrl).href);
  }
}
```

#### Semaine 3: Scheduler & Processing

**Crawl Scheduler:**
```typescript
// src/crawlers/scheduler/crawl-scheduler.ts
import { Queue, Worker } from 'bullmq';
import cron from 'node-cron';

export class CrawlScheduler {
  private crawlQueue: Queue;
  private worker: Worker;
  
  constructor() {
    this.crawlQueue = new Queue('crawl-jobs', {
      connection: redisConnection
    });
    
    this.setupWorker();
    this.setupCronJobs();
  }
  
  private setupWorker() {
    this.worker = new Worker('crawl-jobs', async (job) => {
      const { sourceType, sourceUrl, options } = job.data;
      
      const crawler = this.getCrawler(sourceType);
      const result = await crawler.crawl(sourceUrl, options);
      
      await this.processResult(result);
      
      return result;
    }, {
      connection: redisConnection,
      concurrency: 5
    });
  }
  
  private setupCronJobs() {
    // Crawl popular libraries daily
    cron.schedule('0 2 * * *', async () => {
      await this.schedulePopularLibraries();
    });
    
    // Crawl updated repos every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      await this.scheduleUpdatedRepos();
    });
    
    // Process pending jobs every hour
    cron.schedule('0 * * * *', async () => {
      await this.processPendingJobs();
    });
  }
  
  async scheduleCrawl(
    sourceType: string,
    sourceUrl: string,
    priority: number = 5
  ): Promise<void> {
    await this.crawlQueue.add('crawl', {
      sourceType,
      sourceUrl,
      priority
    }, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }
}
```

**Content Processor:**
```typescript
// src/crawlers/processor/content-processor.ts
export class ContentProcessor {
  async process(result: CrawlResult): Promise<void> {
    // 1. Detect duplicates
    const hash = this.generateHash(result.content);
    const existing = await this.findByHash(hash);
    
    if (existing) {
      logger.info(`Duplicate content detected: ${result.url}`);
      return;
    }
    
    // 2. Parse content
    const parsed = await this.parse(result);
    
    // 3. Validate content
    if (!this.validate(parsed)) {
      logger.warn(`Invalid content: ${result.url}`);
      return;
    }
    
    // 4. Store in database
    const contentId = await this.store(parsed);
    
    // 5. Generate embeddings (async)
    await this.queueEmbeddingGeneration(contentId);
    
    // 6. Update search index
    await this.updateSearchIndex(contentId);
  }
  
  private async parse(result: CrawlResult): Promise<ParsedContent> {
    return {
      title: this.extractTitle(result),
      description: this.extractDescription(result),
      content: this.cleanContent(result.content),
      sections: this.extractSections(result.content),
      codeBlocks: this.extractCodeBlocks(result.content),
      metadata: result.metadata
    };
  }
}
```

### Critères de Succès
- ✅ 3+ types de crawlers (GitHub, Docs, NPM)
- ✅ Scheduler automatique avec cron
- ✅ Queue de jobs avec retry
- ✅ Détection de duplicates
- ✅ 1000+ documents crawlés
- ✅ Webhooks GitHub configurés

---

## 📋 2. EMBEDDINGS & RECHERCHE VECTORIELLE

### Objectif
Optimiser la génération d'embeddings et la recherche vectorielle.

### État Actuel
- Génération embeddings: 45%
- Stockage vectoriel: 40%
- Recherche: 35%
- Chunking: 0%

### Plan d'Action (3 semaines)

#### Semaine 1: Chunking Intelligent

**Stratégies de Chunking:**
```typescript
// src/services/chunking/chunking-strategy.interface.ts
export interface IChunkingStrategy {
  chunk(content: string, metadata?: ChunkMetadata): Promise<Chunk[]>;
  estimateTokens(text: string): number;
}

export interface Chunk {
  id: string;
  content: string;
  tokens: number;
  metadata: ChunkMetadata;
  position: number;
  overlap?: string;
}

export interface ChunkMetadata {
  documentId: string;
  title?: string;
  section?: string;
  language?: string;
  type?: 'text' | 'code' | 'table';
}
```

**Fixed-Size Chunker:**
```typescript
// src/services/chunking/fixed-size.chunker.ts
export class FixedSizeChunker implements IChunkingStrategy {
  constructor(
    private chunkSize: number = 512,
    private overlap: number = 50
  ) {}
  
  async chunk(content: string, metadata?: ChunkMetadata): Promise<Chunk[]> {
    const chunks: Chunk[] = [];
    const sentences = this.splitIntoSentences(content);
    
    let currentChunk = '';
    let currentTokens = 0;
    let position = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      
      if (currentTokens + sentenceTokens > this.chunkSize) {
        if (currentChunk) {
          chunks.push({
            id: uuidv4(),
            content: currentChunk,
            tokens: currentTokens,
            metadata: metadata || {},
            position: position++
          });
        }
        
        // Add overlap from previous chunk
        const overlapText = this.getOverlap(currentChunk, this.overlap);
        currentChunk = overlapText + sentence;
        currentTokens = this.estimateTokens(currentChunk);
      } else {
        currentChunk += sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    if (currentChunk) {
      chunks.push({
        id: uuidv4(),
        content: currentChunk,
        tokens: currentTokens,
        metadata: metadata || {},
        position: position
      });
    }
    
    return chunks;
  }
}
```

**Semantic Chunker:**
```typescript
// src/services/chunking/semantic.chunker.ts
export class SemanticChunker implements IChunkingStrategy {
  async chunk(content: string, metadata?: ChunkMetadata): Promise<Chunk[]> {
    // 1. Split by sections/headings
    const sections = this.splitBySections(content);
    
    const chunks: Chunk[] = [];
    let position = 0;
    
    for (const section of sections) {
      // 2. If section is too large, split by paragraphs
      if (this.estimateTokens(section.content) > this.maxTokens) {
        const subChunks = await this.splitLargeSection(section);
        chunks.push(...subChunks.map(c => ({
          ...c,
          position: position++,
          metadata: {
            ...metadata,
            section: section.heading
          }
        })));
      } else {
        chunks.push({
          id: uuidv4(),
          content: section.content,
          tokens: this.estimateTokens(section.content),
          metadata: {
            ...metadata,
            section: section.heading
          },
          position: position++
        });
      }
    }
    
    return chunks;
  }
  
  private splitBySections(content: string): Section[] {
    const sections: Section[] = [];
    const lines = content.split('\n');
    
    let currentSection: Section | null = null;
    
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          level: headingMatch[1].length,
          heading: headingMatch[2],
          content: ''
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }
}
```

#### Semaine 2: Optimisation Embeddings

**Batch Processing:**
```typescript
// src/services/embeddings/batch-embedding.service.ts
export class BatchEmbeddingService {
  private queue: Queue;
  private batchSize = 100;
  private batchTimeout = 5000; // 5 seconds
  
  constructor() {
    this.queue = new Queue('embeddings', {
      connection: redisConnection
    });
    
    this.setupBatchWorker();
  }
  
  private setupBatchWorker() {
    const worker = new Worker('embeddings', async (job) => {
      const chunks: Chunk[] = job.data.chunks;
      
      // Process in batches
      const batches = this.createBatches(chunks, this.batchSize);
      const results: Embedding[] = [];
      
      for (const batch of batches) {
        const embeddings = await this.generateBatchEmbeddings(batch);
        results.push(...embeddings);
        
        // Rate limiting
        await this.delay(100);
      }
      
      // Store embeddings
      await this.storeEmbeddings(results);
      
      return results;
    }, {
      connection: redisConnection,
      concurrency: 3
    });
  }
  
  private async generateBatchEmbeddings(
    chunks: Chunk[]
  ): Promise<Embedding[]> {
    const texts = chunks.map(c => c.content);
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float'
    });
    
    return response.data.map((item, index) => ({
      chunkId: chunks[index].id,
      vector: item.embedding,
      model: 'text-embedding-3-small',
      dimensions: item.embedding.length,
      createdAt: new Date()
    }));
  }
  
  async queueChunks(chunks: Chunk[]): Promise<void> {
    await this.queue.add('generate', { chunks }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }
}
```

**Caching Strategy:**
```typescript
// src/services/embeddings/embedding-cache.service.ts
export class EmbeddingCacheService {
  private redis: Redis;
  private ttl = 7 * 24 * 60 * 60; // 7 days
  
  async get(contentHash: string): Promise<number[] | null> {
    const cached = await this.redis.get(`embedding:${contentHash}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(contentHash: string, embedding: number[]): Promise<void> {
    await this.redis.setex(
      `embedding:${contentHash}`,
      this.ttl,
      JSON.stringify(embedding)
    );
  }
  
  async getBatch(hashes: string[]): Promise<Map<string, number[]>> {
    const pipeline = this.redis.pipeline();
    hashes.forEach(hash => pipeline.get(`embedding:${hash}`));
    
    const results = await pipeline.exec();
    const embeddings = new Map<string, number[]>();
    
    results?.forEach((result, index) => {
      if (result[1]) {
        embeddings.set(hashes[index], JSON.parse(result[1] as string));
      }
    });
    
    return embeddings;
  }
}
```

#### Semaine 3: Recherche Hybride

**Hybrid Search:**
```typescript
// src/services/search/hybrid-search.service.ts
export class HybridSearchService {
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // 1. Vector search
    const vectorResults = await this.vectorSearch(query, options);
    
    // 2. Full-text search
    const textResults = await this.fullTextSearch(query, options);
    
    // 3. Merge and re-rank
    const merged = this.mergeResults(vectorResults, textResults);
    const reranked = await this.rerank(merged, query);
    
    return reranked.slice(0, options.limit || 10);
  }
  
  private async vectorSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generate(query);
    
    // Search in pgvector
    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT 
        c.id,
        c.content,
        c.metadata,
        1 - (e.vector <=> ${queryEmbedding}::vector) as similarity
      FROM chunks c
      JOIN embeddings e ON e.chunk_id = c.id
      WHERE 1 - (e.vector <=> ${queryEmbedding}::vector) > ${options.threshold || 0.7}
      ORDER BY e.vector <=> ${queryEmbedding}::vector
      LIMIT ${options.limit || 20}
    `;
    
    return results.map(r => ({
      ...r,
      score: r.similarity,
      source: 'vector'
    }));
  }
  
  private async fullTextSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT 
        id,
        content,
        metadata,
        ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
      FROM chunks
      WHERE search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${options.limit || 20}
    `;
    
    return results.map(r => ({
      ...r,
      score: r.rank,
      source: 'fulltext'
    }));
  }
  
  private mergeResults(
    vectorResults: SearchResult[],
    textResults: SearchResult[]
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();
    
    // Add vector results with weight
    vectorResults.forEach(r => {
      merged.set(r.id, {
        ...r,
        score: r.score * 0.7 // 70% weight for vector
      });
    });
    
    // Add or merge text results
    textResults.forEach(r => {
      const existing = merged.get(r.id);
      if (existing) {
        existing.score += r.score * 0.3; // 30% weight for text
      } else {
        merged.set(r.id, {
          ...r,
          score: r.score * 0.3
        });
      }
    });
    
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score);
  }
  
  private async rerank(
    results: SearchResult[],
    query: string
  ): Promise<SearchResult[]> {
    // Use cross-encoder for re-ranking
    const pairs = results.map(r => [query, r.content]);
    const scores = await this.crossEncoderService.score(pairs);
    
    return results
      .map((r, i) => ({
        ...r,
        score: scores[i]
      }))
      .sort((a, b) => b.score - a.score);
  }
}
```

### Critères de Succès
- ✅ 3+ stratégies de chunking
- ✅ Batch processing optimisé
- ✅ Cache Redis pour embeddings
- ✅ Hybrid search implémenté
- ✅ Re-ranking avec cross-encoder
- ✅ Latence recherche < 200ms

---

## 📋 3. PROVIDERS LLM (Claude & Gemini)

### Objectif
Ajouter support pour Anthropic Claude et Google Gemini.

### État Actuel
- OpenAI: 60%
- Claude: 0%
- Gemini: 0%
- Fallback: 0%

### Plan d'Action (2 semaines)

#### Semaine 1: Provider Anthropic Claude

**Dépendances:**
```bash
npm install @anthropic-ai/sdk
```

**Claude Provider:**
```typescript
// src/services/llm/providers/claude.provider.ts
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeProvider implements ILLMProvider {
  private client: Anthropic;
  
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: request.model || 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.7,
      messages: this.formatMessages(request.messages),
      system: request.systemPrompt
    });
    
    return {
      id: response.id,
      content: response.content[0].text,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      finishReason: response.stop_reason
    };
  }
  
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const stream = await this.client.messages.create({
      model: request.model || 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4096,
      messages: this.formatMessages(request.messages),
      stream: true
    });
    
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        yield {
          id: event.index.toString(),
          content: event.delta.text,
          finishReason: null
        };
      } else if (event.type === 'message_stop') {
        yield {
          id: 'final',
          content: '',
          finishReason: 'stop'
        };
      }
    }
  }
  
  async functionCall(
    request: LLMRequest,
    functions: FunctionDefinition[]
  ): Promise<LLMFunctionCallResponse> {
    const response = await this.client.messages.create({
      model: request.model || 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4096,
      messages: this.formatMessages(request.messages),
      tools: functions.map(f => ({
        name: f.name,
        description: f.description,
        input_schema: f.parameters
      }))
    });
    
    const toolUse = response.content.find(c => c.type === 'tool_use');
    
    return {
      id: response.id,
      functionName: toolUse?.name,
      arguments: toolUse?.input,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }
}
```

#### Semaine 2: Provider Google Gemini

**Dépendances:**
```bash
npm install @google/generative-ai
```

**Gemini Provider:**
```typescript
// src/services/llm/providers/gemini.provider.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider implements ILLMProvider {
  private client: GoogleGenerativeAI;
  
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
  
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = this.client.getGenerativeModel({
      model: request.model || 'gemini-1.5-pro'
    });
    
    const chat = model.startChat({
      history: this.formatHistory(request.messages),
      generationConfig: {
        maxOutputTokens: request.maxTokens || 8192,
        temperature: request.temperature || 0.7
      }
    });
    
    const result = await chat.sendMessage(
      request.messages[request.messages.length - 1].content
    );
    
    const response = result.response;
    
    return {
      id: crypto.randomUUID(),
      content: response.text(),
      model: request.model || 'gemini-1.5-pro',
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      },
      finishReason: 'stop'
    };
  }
  
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const model = this.client.getGenerativeModel({
      model: request.model || 'gemini-1.5-pro'
    });
    
    const chat = model.startChat({
      history: this.formatHistory(request.messages)
    });
    
    const result = await chat.sendMessageStream(
      request.messages[request.messages.length - 1].content
    );
    
    for await (const chunk of result.stream) {
      yield {
        id: crypto.randomUUID(),
        content: chunk.text(),
        finishReason: null
      };
    }
    
    yield {
      id: 'final',
      content: '',
      finishReason: 'stop'
    };
  }
}
```

**Provider Factory avec Fallback:**
```typescript
// src/services/llm/llm-factory.service.ts
export class LLMFactory {
  private providers: Map<string, ILLMProvider>;
  private fallbackOrder: string[];
  
  constructor() {
    this.providers = new Map([
      ['openai', new OpenAIProvider()],
      ['claude', new ClaudeProvider()],
      ['gemini', new GeminiProvider()]
    ]);
    
    this.fallbackOrder = ['openai', 'claude', 'gemini'];
  }
  
  async complete(
    request: LLMRequest,
    options: { fallback?: boolean } = {}
  ): Promise<LLMResponse> {
    const provider = this.getProvider(request.provider);
    
    try {
      return await provider.complete(request);
    } catch (error) {
      if (options.fallback && this.shouldFallback(error)) {
        logger.warn(`Provider ${request.provider} failed, trying fallback`);
        return await this.completeFallback(request);
      }
      throw error;
    }
  }
  
  private async completeFallback(
    request: LLMRequest
  ): Promise<LLMResponse> {
    const currentIndex = this.fallbackOrder.indexOf(request.provider);
    
    for (let i = currentIndex + 1; i < this.fallbackOrder.length; i++) {
      const fallbackProvider = this.fallbackOrder[i];
      
      try {
        const provider = this.providers.get(fallbackProvider);
        logger.info(`Trying fallback provider: ${fallbackProvider}`);
        
        return await provider.complete({
          ...request,
          provider: fallbackProvider
        });
      } catch (error) {
        logger.warn(`Fallback provider ${fallbackProvider} failed`);
        continue;
      }
    }
    
    throw new Error('All providers failed');
  }
}
```

### Critères de Succès
- ✅ Claude provider complet
- ✅ Gemini provider complet
- ✅ Streaming pour tous providers
- ✅ Function calling supporté
- ✅ Fallback automatique
- ✅ Tests pour chaque provider

---

## 📋 4. INTERFACE CHAT AVANCÉE

### Objectif
Améliorer l'expérience utilisateur avec features avancées.

### État Actuel
- Interface basique: 45%
- Markdown: 50%
- Code highlighting: 0%
- Contexte: 0%

### Plan d'Action (2 semaines)

#### Semaine 1: Rendering Avancé

**Dépendances:**
```bash
npm install react-markdown remark-gfm rehype-highlight
npm install @uiw/react-codemirror @codemirror/lang-javascript
npm install katex react-katex
npm install mermaid react-mermaid2
```

**Message Renderer:**
```typescript
// src/components/chat/MessageRenderer.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { InlineMath, BlockMath } from 'react-katex';
import Mermaid from 'react-mermaid2';

export function MessageRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          
          if (!inline && language === 'mermaid') {
            return <Mermaid chart={String(children)} />;
          }
          
          if (!inline && language === 'math') {
            return <BlockMath math={String(children)} />;
          }
          
          if (!inline) {
            return (
              <CodeBlock
                language={language}
                code={String(children)}
                {...props}
              />
            );
          }
          
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        p({ children }) {
          // Handle inline math
          const text = String(children);
          if (text.includes('$') && !text.includes('$$')) {
            return <InlineMath math={text.replace(/\$/g, '')} />;
          }
          return <p>{children}</p>;
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Code Block avec Actions:**
```typescript
// src/components/chat/CodeBlock.tsx
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const getLanguageExtension = () => {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return javascript();
      case 'python':
        return python();
      default:
        return javascript();
    }
  };
  
  return (
    <div className="code-block">
      <div className="code-header">
        <span className="language">{language}</span>
        <div className="actions">
          <button onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={() => downloadCode(code, language)}>
            Download
          </button>
        </div>
      </div>
      <CodeMirror
        value={code}
        extensions={[getLanguageExtension()]}
        editable={false}
        theme="dark"
      />
    </div>
  );
}
```

#### Semaine 2: Features Avancées

**Context Panel:**
```typescript
// src/components/chat/ContextPanel.tsx
export function ContextPanel({ conversationId }: ContextPanelProps) {
  const [context, setContext] = useState<ContextItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  
  useEffect(() => {
    loadContext();
    loadSuggestions();
  }, [conversationId]);
  
  const loadContext = async () => {
    const ctx = await api.getConversationContext(conversationId);
    setContext(ctx);
  };
  
  const loadSuggestions = async () => {
    const sugg = await api.getContextSuggestions(conversationId);
    setSuggestions(sugg);
  };
  
  return (
    <div className="context-panel">
      <h3>Context</h3>
      
      <div className="active-context">
        {context.map(item => (
          <ContextItem
            key={item.id}
            item={item}
            onRemove={() => removeContext(item.id)}
          />
        ))}
      </div>
      
      <h4>Suggested Documentation</h4>
      <div className="suggestions">
        {suggestions.map(sugg => (
          <SuggestionCard
            key={sugg.id}
            suggestion={sugg}
            onAdd={() => addContext(sugg)}
          />
        ))}
      </div>
    </div>
  );
}
```

**Keyboard Shortcuts:**
```typescript
// src/hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        focusSearch();
      }
      
      // Cmd/Ctrl + N: New conversation
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        createNewConversation();
      }
      
      // Cmd/Ctrl + /: Toggle shortcuts help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleShortcutsHelp();
      }
      
      // Esc: Clear input
      if (e.key === 'Escape') {
        clearInput();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
```

### Critères de Succès
- ✅ Markdown rendering complet
- ✅ Code syntax highlighting
- ✅ LaTeX math rendering
- ✅ Mermaid diagrams
- ✅ Context panel fonctionnel
- ✅ 10+ keyboard shortcuts

---

## 📋 5. ANALYTICS AVANCÉS

### Objectif
Tracking complet et insights utilisateur.

### État Actuel
- Event tracking: 25%
- Dashboards: 0%
- Insights: 0%

### Plan d'Action (2 semaines)

#### Semaine 1: Event Tracking

**Analytics Service:**
```typescript
// src/services/analytics/analytics.service.ts
export class AnalyticsService {
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    // 1. Buffer event
    await this.bufferEvent(event);
    
    // 2. Update real-time metrics
    await this.updateMetrics(event);
    
    // 3. Trigger insights calculation (async)
    await this.queueInsightsCalculation(event);
  }
  
  async trackPageView(userId: string, page: string): Promise<void> {
    await this.trackEvent({
      type: 'page_view',
      userId,
      properties: { page },
      timestamp: new Date()
    });
  }
  
  async trackConversation(
    userId: string,
    conversationId: string,
    action: 'created' | 'updated' | 'deleted'
  ): Promise<void> {
    await this.trackEvent({
      type: 'conversation',
      userId,
      properties: { conversationId, action },
      timestamp: new Date()
    });
  }
  
  async trackMessage(
    userId: string,
    messageId: string,
    metadata: MessageMetadata
  ): Promise<void> {
    await this.trackEvent({
      type: 'message',
      userId,
      properties: {
        messageId,
        tokens: metadata.tokens,
        model: metadata.model,
        latency: metadata.latency
      },
      timestamp: new Date()
    });
  }
}
```

#### Semaine 2: Dashboards & Insights

**Dashboard Components:**
```typescript
// src/components/analytics/AnalyticsDashboard.tsx
export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<Metrics>();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  
  return (
    <div className="analytics-dashboard">
      <MetricsOverview metrics={metrics} />
      
      <div className="charts-grid">
        <UsageChart timeRange={timeRange} />
        <UserGrowthChart timeRange={timeRange} />
        <TokenUsageChart timeRange={timeRange} />
        <CostChart timeRange={timeRange} />
      </div>
      
      <UserSegmentation />
      <TopQueries />
      <BehaviorInsights />
    </div>
  );
}
```

### Critères de Succès
- ✅ 20+ types d'événements trackés
- ✅ Dashboard analytics complet
- ✅ Insights automatiques
- ✅ Segmentation utilisateurs
- ✅ Funnel analysis

---

## 📅 Timeline Globale

| Semaines | Tâches |
|----------|--------|
| 1-3 | Crawling & Indexation |
| 4-6 | Embeddings & Recherche |
| 7-8 | Providers LLM |
| 9-10 | Interface Chat |
| 11-12 | Analytics |

**Durée totale**: 12-14 semaines

---

## 🎯 Métriques de Succès Globales

- ✅ 1000+ documents crawlés
- ✅ Recherche hybride < 200ms
- ✅ 3 providers LLM fonctionnels
- ✅ Interface chat moderne
- ✅ Analytics complets

---

**Note**: Ce plan nécessite les fonctionnalités critiques (Tests, OAuth, Monitoring, Documentation, CI/CD) complétées au préalable.
