# Query-Docs Tool Setup Guide

This guide will help you set up and configure the `query-docs` MCP tool for searching documentation using vector search.

## Overview

The `query-docs` tool allows LLMs and IDEs to search documentation for software libraries using semantic search and vector embeddings. It provides:

- 📚 **Semantic Search**: Find relevant documentation using natural language queries
- 🔍 **Vector Storage**: Fast and accurate search using Pinecone or Qdrant
- 🧩 **Context Assembly**: Optimized context generation for LLM consumption
- 🎯 **Token Management**: Intelligent truncation to stay within token limits
- 🏷️ **Library Management**: Support for multiple libraries and versions

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis (for caching)
- OpenAI API key (for embeddings)
- Pinecone or Qdrant account (for vector storage)

## Quick Setup

### 1. Environment Configuration

Copy the environment template:

```bash
cp .env.example .env.local
```

Update `.env.local` with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/twinmcp_dev"

# OpenAI (required for embeddings)
OPENAI_API_KEY=your-openai-api-key

# Vector Store (choose one)
VECTOR_STORE_PROVIDER=pinecone
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=twinmcp-docs

# Alternative: Qdrant
# VECTOR_STORE_PROVIDER=qdrant
# QDRANT_URL=http://localhost:6333

# Redis (for caching)
REDIS_URL=redis://localhost:6379
```

### 2. Automated Setup

Run the automated setup script:

```bash
npm run setup:query-docs
```

This script will:
- ✅ Check prerequisites
- ✅ Set up environment
- ✅ Configure database
- ✅ Initialize vector store
- ✅ Populate with sample data
- ✅ Run integration tests

### 3. Manual Setup (Alternative)

If you prefer manual setup:

#### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database with sample libraries
npm run db:seed
```

#### Vector Store Setup

**Option A: Pinecone**

```bash
# Test connection
npm run vector:health

# Populate with sample documentation
npm run vector:populate
```

**Option B: Qdrant**

```bash
# Start Qdrant (if not running)
docker run -p 6333:6333 qdrant/qdrant

# Test connection
npm run vector:health

# Populate with sample documentation
npm run vector:populate
```

## Usage

### MCP Tool Interface

The `query-docs` tool accepts the following parameters:

```typescript
{
  library_id: string;           // Library identifier (e.g., '/react/react')
  query: string;               // Search query
  version?: string;            // Specific version (optional)
  max_results?: number;        // Max results (default: 5)
  include_code?: boolean;      // Include code snippets (default: true)
  context_limit?: number;      // Token limit (default: 4000)
}
```

### Example Usage

```javascript
// Search React documentation
const result = await queryDocs({
  library_id: '/react/react',
  query: 'How to use useState hook?',
  max_results: 3,
  include_code: true
});

// Response format
{
  "success": true,
  "data": {
    "library": {
      "id": "/react/react",
      "name": "react",
      "version": "18.2.0",
      "description": "A JavaScript library for building user interfaces"
    },
    "query": "How to use useState hook?",
    "results": [...],
    "context": "# Documentation Query Results\n\n...",
    "totalTokens": 2847,
    "truncated": false
  }
}
```

## Testing

### Unit Tests

```bash
# Run query-docs unit tests
npm test -- --testPathPattern=query-docs.tool

# Run all tests
npm test
```

### Integration Tests

```bash
# Run integration tests
npm test -- --testPathPattern=integration
```

### Manual Testing

```bash
# Start development server
npm run dev

# Test via API endpoint
curl -X POST http://localhost:3000/api/mcp/query-docs \
  -H "Content-Type: application/json" \
  -d '{
    "library_id": "/react/react",
    "query": "useState hook example",
    "max_results": 3
  }'
```

## Configuration Options

### Vector Store Providers

#### Pinecone (Recommended for production)

```env
VECTOR_STORE_PROVIDER=pinecone
PINECONE_API_KEY=your-api-key
PINECONE_INDEX_NAME=twinmcp-docs
PINECONE_ENVIRONMENT=us-west1-gcp
```

#### Qdrant (Good for development)

```env
VECTOR_STORE_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key
QDRANT_COLLECTION_NAME=twinmcp-docs
```

### Performance Tuning

```env
# Embeddings caching
EMBEDDINGS_CACHE_TTL=3600

# Vector search limits
MAX_SEARCH_RESULTS=20
DEFAULT_SEARCH_RESULTS=5

# Token limits
MAX_CONTEXT_TOKENS=8000
DEFAULT_CONTEXT_TOKENS=4000
```

## Adding Documentation

### Automatic Population

The setup script includes sample documentation for:
- React (hooks, components)
- Node.js (fs, http modules)
- Express.js (routing, middleware)

### Manual Documentation Addition

```bash
# Use the populate script with custom data
npm run vector:populate

# Or add documents programmatically
import { VectorStoreService } from './src/services/vector-store.service'

const vectorStore = new VectorStoreService()
await vectorStore.addDocument(content, metadata)
```

### Supported Content Types

- `guide`: Tutorial and guide content
- `snippet`: Code examples and snippets
- `api_ref`: API reference documentation

## Monitoring and Debugging

### Health Checks

```bash
# Database health
npm run health:db

# Redis health
npm run health:redis

# Vector store health
npm run vector:health
```

### Logging

Enable debug logging:

```env
LOG_LEVEL=debug
```

### Metrics

The tool tracks:
- Request count and response time
- Token usage
- Cache hit rates
- Error rates

## Troubleshooting

### Common Issues

#### "Library not found" Error

```bash
# Check if library exists in database
npx prisma studio

# View libraries table
```

#### "Vector store connection failed"

```bash
# Check Pinecone credentials
echo $PINECONE_API_KEY

# Or test Qdrant connection
curl http://localhost:6333/collections
```

#### "No documentation found"

```bash
# Populate vector store
npm run vector:populate

# Check vector store stats
npm run vector:health
```

#### OpenAI API Errors

```bash
# Check API key
echo $OPENAI_API_KEY

# Test OpenAI connection
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

### Performance Issues

1. **Increase cache TTL** for frequently accessed content
2. **Use Pinecone** for better performance at scale
3. **Optimize chunk size** when adding documentation
4. **Enable Redis clustering** for high-load scenarios

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   QueryDocsTool │────│ VectorSearchService│────│  VectorStore    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  LibraryService │    │ ContextAssembler  │    │ EmbeddingsService│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Contributing

1. Add new libraries to the seed script
2. Improve documentation chunking strategies
3. Add more content types
4. Optimize performance
5. Add tests

## License

This project is part of the TwinMCP platform. See the main project license for details.
