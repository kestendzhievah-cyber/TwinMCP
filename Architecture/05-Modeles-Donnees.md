# Modèles de données

## Schema PostgreSQL

### Table `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255),
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table `api_keys`
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(10) NOT NULL, -- pour affichage partiel
  name VARCHAR(100),
  quota_requests_per_minute INT DEFAULT 60,
  quota_requests_per_day INT DEFAULT 10000,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

### Table `libraries`
```sql
CREATE TABLE libraries (
  id VARCHAR(100) PRIMARY KEY, -- ex: /mongodb/docs
  name VARCHAR(255) NOT NULL,
  vendor VARCHAR(100),
  repo_url VARCHAR(500),
  docs_url VARCHAR(500),
  default_version VARCHAR(50),
  popularity_score INT DEFAULT 0,
  total_snippets INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  last_crawled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- tags, categories, etc.
);

CREATE INDEX idx_libraries_name ON libraries USING gin(to_tsvector('english', name));
```

### Table `library_versions`
```sql
CREATE TABLE library_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id VARCHAR(100) REFERENCES libraries(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  release_date DATE,
  is_latest BOOLEAN DEFAULT FALSE,
  docs_snapshot_url VARCHAR(500), -- S3 path
  UNIQUE(library_id, version)
);
```

### Table `documentation_chunks`
```sql
CREATE TABLE documentation_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_version_id UUID REFERENCES library_versions(id) ON DELETE CASCADE,
  chunk_index INT,
  content TEXT NOT NULL,
  content_type VARCHAR(50), -- 'snippet', 'guide', 'api_ref'
  source_url VARCHAR(500),
  token_count INT,
  embedding_id VARCHAR(255), -- ID dans le vector store
  metadata JSONB, -- { section, subsection, code_language, etc. }
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chunks_library_version ON documentation_chunks(library_version_id);
```

### Table `usage_logs`
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  tool_name VARCHAR(50), -- 'resolve-library-id', 'query-docs'
  library_id VARCHAR(100),
  query TEXT,
  tokens_returned INT,
  response_time_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_logs_api_key_created ON usage_logs(api_key_id, created_at DESC);
```

---

## Vector Store Schema (Pinecone/Qdrant)

### Structure d'un vecteur
```json
{
  "id": "chunk_uuid",
  "values": [0.123, -0.456, ...], // embedding (1536 dimensions)
  "metadata": {
    "library_id": "/mongodb/docs",
    "version": "7.0",
    "content_type": "snippet",
    "source_url": "https://...",
    "chunk_text": "Sample code..."
  }
}
```

---

## Redis Cache

### Clés
- `library:resolve:{query_hash}` → `{ libraryId, confidence }`
- `docs:query:{library_id}:{query_hash}` → `{ snippets, ttl: 3600 }`
- `rate_limit:{api_key}:{window}` → compteur
- `oauth:session:{state}` → OAuth flow data
