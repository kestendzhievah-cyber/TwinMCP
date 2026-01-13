# Standards de code

## 1. Conventions TypeScript

### Naming
```typescript
// Classes: PascalCase
class LibraryResolver {}

// Interfaces: PascalCase avec préfixe I (optionnel)
interface IMCPTool {}

// Types: PascalCase
type MCPRequest = {};

// Variables/functions: camelCase
const apiKey = 'xxx';
function resolveLibrary() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Private members: préfixe _
class Service {
  private _cache: Map<string, unknown>;
}
```

---

### File Structure
```
src/
├── server/           # Serveur MCP
│   ├── tools/        # Implémentation des outils MCP
│   ├── handlers/     # Handlers de requêtes
│   └── index.ts
├── services/         # Logique métier
│   ├── auth/
│   ├── library/
│   └── docs/
├── models/           # Modèles de données (Prisma)
├── utils/            # Utilitaires
├── types/            # Types TypeScript partagés
└── config/           # Configuration
```

---

### Imports
```typescript
// Ordre des imports:
// 1. Node built-ins
import { promises as fs } from 'fs';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal modules (ordre alphabétique)
import { AuthService } from '@/services/auth';
import { LibraryResolver } from '@/services/library';
import { logger } from '@/utils/logger';

// 4. Types
import type { MCPRequest } from '@/types';
```

---

## 2. Linting & Formatting

### ESLint (.eslintrc.js)
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn'
  }
};
```

### Prettier (.prettierrc)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## 3. Documentation

### JSDoc pour fonctions publiques
```typescript
/**
 * Résout l'identifiant d'une bibliothèque à partir d'une query utilisateur
 * 
 * @param query - Question ou tâche de l'utilisateur
 * @param libraryName - Nom humain de la bibliothèque
 * @returns Identifiant canonique et métadonnées
 * @throws {LibraryNotFoundError} Si aucune bibliothèque ne correspond
 * 
 * @example
 * ```typescript
 * const result = await resolveLibrary('How to use MongoDB?', 'MongoDB');
 * console.log(result.libraryId); // '/mongodb/docs'
 * ```
 */
export async function resolveLibrary(
  query: string,
  libraryName: string
): Promise<LibraryResolution> {
  // ...
}
```

---

## 4. Error Handling

### Custom Errors
```typescript
export class TwinMCPError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TwinMCPError';
  }
}

export class LibraryNotFoundError extends TwinMCPError {
  constructor(libraryName: string) {
    super('LIBRARY_NOT_FOUND', `Library '${libraryName}' not found`, 404);
  }
}
```

---

## 5. Git Workflow

### Commit Messages (Conventional Commits)
```
feat: add OAuth 2.0 support for Cursor
fix: resolve library resolution timeout
docs: update installation guide
refactor: extract embedding logic to service
test: add integration tests for query-docs tool
chore: upgrade dependencies
```

### Branch Naming
- `feat/oauth-support`
- `fix/rate-limit-bug`
- `docs/api-reference`
