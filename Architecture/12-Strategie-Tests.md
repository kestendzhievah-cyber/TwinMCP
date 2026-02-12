# Stratégie de tests

## 1. Pyramide de tests

```
        /\
       /  \        E2E (5%)
      /____\
     /      \      Integration (25%)
    /________\
   /          \    Unit (70%)
  /__________  \
```

---

## 2. Tests unitaires

### Framework: Jest + ts-jest

```typescript
// services/library/resolver.test.ts
import { LibraryResolver } from './resolver';
import { mockLibraryRepository } from '@/test/mocks';

describe('LibraryResolver', () => {
  let resolver: LibraryResolver;

  beforeEach(() => {
    resolver = new LibraryResolver(mockLibraryRepository);
  });

  it('should resolve MongoDB library from query', async () => {
    const result = await resolver.resolve('How to use MongoDB?', 'MongoDB');
    
    expect(result.libraryId).toBe('/mongodb/docs');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should throw LibraryNotFoundError for unknown library', async () => {
    await expect(
      resolver.resolve('test', 'UnknownLib123')
    ).rejects.toThrow(LibraryNotFoundError);
  });
});
```

---

## 3. Tests d'intégration

### Avec base de données de test

```typescript
// __tests__/integration/mcp-api.test.ts
import { setupTestDB, teardownTestDB } from '@/test/db';
import { createTestServer } from '@/test/server';
import { createTestUser, createApiKey } from '@/test/fixtures';

describe('MCP API Integration', () => {
  let server;
  let apiKey;

  beforeAll(async () => {
    await setupTestDB();
    server = await createTestServer();
    const user = await createTestUser();
    apiKey = await createApiKey(user.id);
  });

  afterAll(async () => {
    await teardownTestDB();
    await server.close();
  });

  it('should resolve library via MCP tool', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'TWINMCP_API_KEY': apiKey
      },
      payload: {
        tool: 'resolve-library-id',
        params: {
          query: 'Setup Next.js',
          libraryName: 'Next.js'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().libraryId).toBe('/vercel/next.js');
  });
});
```

---

## 4. Tests E2E

### Playwright pour le dashboard

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('should create API key', async ({ page }) => {
  await page.goto('https://dashboard.twinmcp.com');
  
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');
  
  await page.waitForURL('**/dashboard');
  
  await page.click('text=Create API Key');
  await page.fill('[name=keyName]', 'Test Key');
  await page.click('button:has-text("Generate")');
  
  const apiKey = await page.textContent('[data-testid=api-key-value]');
  expect(apiKey).toMatch(/^twinmcp_test_/);
});
```

---

## 5. Coverage Requirements

- **Unit tests** : > 80% coverage
- **Critical paths** : 100% coverage (auth, rate limiting)
- **Rapport** : Généré via `jest --coverage`

---

## 6. Mocks & Fixtures

### Mock OpenAI API
```typescript
// test/mocks/openai.ts
export const mockOpenAI = {
  embeddings: {
    create: jest.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }]
    })
  }
};
```

### Fixtures
```typescript
// test/fixtures/libraries.ts
export const mongoDBLibrary = {
  id: '/mongodb/docs',
  name: 'MongoDB',
  repo_url: 'https://github.com/mongodb/docs',
  default_version: '7.0'
};
```
