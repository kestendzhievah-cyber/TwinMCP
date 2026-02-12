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

### Table `invoices`
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  number VARCHAR(50) UNIQUE NOT NULL,
  period JSONB NOT NULL, -- { type: 'monthly', startDate: '2024-01-01', endDate: '2024-01-31' }
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
  items JSONB NOT NULL, -- [{ id, description, quantity, unitPrice, amount, type, metadata }]
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  issue_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  paid_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- { generationTime, usageData, billingCycle, customerInfo, paymentMethod, notes }
);

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_period ON invoices USING gin(period);
```

### Table `payments`
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, refunded
  method_id UUID REFERENCES payment_methods(id),
  provider VARCHAR(20) NOT NULL, -- stripe, paypal, wise
  provider_transaction_id VARCHAR(255),
  failure_reason TEXT,
  refunded_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
```

### Table `payment_methods`
```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- card, bank_account, sepa
  provider VARCHAR(20) NOT NULL, -- stripe, paypal, wise
  is_default BOOLEAN DEFAULT FALSE,
  provider_method_id VARCHAR(255) NOT NULL, -- ID from provider
  last_four VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  brand VARCHAR(50), -- visa, mastercard, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(user_id, is_default);
```

### Table `subscriptions`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL, -- free, basic, premium, enterprise
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, cancelled, expired
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  interval VARCHAR(10) NOT NULL, -- month, year
  interval_count INTEGER DEFAULT 1,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period ON subscriptions(current_period_end);
```

### Table `credits`
```sql
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  reason TEXT NOT NULL,
  type VARCHAR(20) NOT NULL, -- promotional, refund, compensation, adjustment
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  invoice_id UUID REFERENCES invoices(id),
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_credits_user_id ON credits(user_id);
CREATE INDEX idx_credits_type ON credits(type);
CREATE INDEX idx_credits_expires_at ON credits(expires_at);
```

### Table `billing_alerts`
```sql
CREATE TABLE billing_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL, -- usage_threshold, payment_failed, invoice_overdue, subscription_expiring
  threshold DECIMAL(10,2),
  current_value DECIMAL(10,2),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_billing_alerts_user_id ON billing_alerts(user_id);
CREATE INDEX idx_billing_alerts_read ON billing_alerts(is_read);
```

### Table `plans`
```sql
CREATE TABLE plans (
  id VARCHAR(50) PRIMARY KEY, -- free, basic, premium, enterprise
  name VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  interval VARCHAR(10) NOT NULL, -- month, year
  features JSONB, -- ["feature1", "feature2"]
  limits JSONB, -- { requestsPerMonth: 10000, tokensPerMonth: 1000000, concurrentRequests: 10 }
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
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
