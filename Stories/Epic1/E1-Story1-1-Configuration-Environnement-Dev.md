# Story 1.1: Configuration de l'environnement de développement

**Epic**: 1 - Infrastructure Core et Foundation  
**Story**: 1.1 - Configuration de l'environnement de développement  
**Estimation**: 3-4 jours  
**Priorité**: Critique  

---

## Objectif

Mettre en place un environnement de développement TypeScript robuste avec tous les outils nécessaires pour assurer la qualité du code throughout le projet.

---

## Prérequis

- Node.js 20+ installé
- npm ou yarn disponible
- Git configuré
- VS Code ou autre IDE moderne

---

## Étapes Détaillées

### Étape 1: Initialisation du projet TypeScript

**Action**: Créer la structure de base du projet

```bash
# Initialiser le package.json
npm init -y

# Installer les dépendances TypeScript de base
npm install --save-dev typescript @types/node ts-node nodemon

# Créer le fichier tsconfig.json strict
npx tsc --init --strict --target ES2022 --module commonjs --outDir ./dist --rootDir ./src --esModuleInterop --allowSyntheticDefaultImports --forceConsistentCasingInFileNames --declaration --declarationMap --sourceMap
```

**Configuration tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/config/*": ["src/config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Vérification**:
```bash
# Créer un fichier test src/index.ts
echo 'console.log("Hello TypeScript!");' > src/index.ts

# Compiler et vérifier
npx tsc
node dist/index.js
```

### Étape 2: Configuration ESLint

**Action**: Mettre en place ESLint avec règles strictes

```bash
# Installer ESLint et plugins
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-prettier eslint-plugin-prettier

# Initialiser ESLint
npx eslint --init
```

**Configuration .eslintrc.js**:
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    
    // General rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    
    // Prettier integration
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true,
      },
    },
  ],
};
```

**Test ESLint**:
```bash
# Créer un fichier avec des erreurs volontaires
cat > src/bad-code.ts << 'EOF'
function test(a: any) {
  var b = a + 1;
  console.log(b);
  return undefined;
}
EOF

# Vérifier qu'ESLint détecte les erreurs
npx eslint src/bad-code.ts
```

### Étape 3: Configuration Prettier

**Action**: Mettre en place Prettier pour le formatage automatique

```bash
# Installer Prettier
npm install --save-dev prettier

# Créer la configuration Prettier
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
EOF

# Créer .prettierignore
cat > .prettierignore << 'EOF'
node_modules
dist
coverage
*.log
.env*
package-lock.json
yarn.lock
EOF
```

**Scripts package.json**:
```json
{
  "scripts": {
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\"",
    "lint": "eslint \"src/**/*.ts\" --fix",
    "lint:check": "eslint \"src/**/*.ts\""
  }
}
```

**Test Prettier**:
```bash
# Formater un fichier de test
echo 'const x=1;const y=2;console.log(x+y)' > src/format-test.ts
npm run format
# Vérifier que le fichier est bien formaté
cat src/format-test.ts
```

### Étape 4: Configuration Husky et lint-staged

**Action**: Mettre en place les hooks Git pour assurer la qualité

```bash
# Installer Husky et lint-staged
npm install --save-dev husky lint-staged

# Initialiser Husky
npx husky install

# Ajouter le hook pre-commit
npx husky add .husky/pre-commit "npx lint-staged"

# Configurer lint-staged dans package.json
```

**Configuration package.json**:
```json
{
  "lint-staged": {
    "src/**/*.ts": [
      "prettier --write",
      "eslint --fix",
      "git add"
    ]
  },
  "scripts": {
    "prepare": "husky install"
  }
}
```

**Test des hooks**:
```bash
# Créer un commit pour tester
git add .
git commit -m "feat: add linting setup"
# Vérifier que les hooks s'exécutent
```

### Étape 5: Configuration Jest pour les tests

**Action**: Mettre en place Jest avec support TypeScript

```bash
# Installer Jest et dépendances
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest

# Initialiser la configuration Jest
npx ts-jest config:init
```

**Configuration jest.config.js**:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 10000,
};
```

**Fichier de setup src/test/setup.ts**:
```typescript
// Configuration globale pour les tests
import 'jest-extended';

// Mock console methods pour les tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Timeout étendu pour les tests asynchrones
jest.setTimeout(30000);
```

**Scripts de test dans package.json**:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

**Test Jest**:
```bash
# Créer un test simple
mkdir -p src/test
cat > src/test/example.test.ts << 'EOF'
describe('Example test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
EOF

# Exécuter les tests
npm test
```

### Étape 6: Scripts de build et développement

**Action**: Créer les scripts npm pour le développement

**Scripts complets dans package.json**:
```json
{
  "scripts": {
    // Développement
    "dev": "nodemon --watch 'src/**/*.ts' --exec 'ts-node' src/index.ts",
    "dev:debug": "nodemon --watch 'src/**/*.ts' --exec 'node --inspect -r ts-node/register' src/index.ts",
    
    // Build
    "build": "tsc --project tsconfig.json",
    "build:watch": "tsc --watch",
    "build:clean": "rm -rf dist && npm run build",
    
    // Exécution
    "start": "node dist/index.js",
    "start:dev": "ts-node src/index.ts",
    
    // Qualité
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\"",
    "lint": "eslint \"src/**/*.ts\" --fix",
    "lint:check": "eslint \"src/**/*.ts\"",
    
    // Tests
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false",
    
    // Pré-commit
    "pre-commit": "npm run lint:check && npm run format:check && npm test"
  }
}
```

**Configuration nodemon.json**:
```json
{
  "watch": ["src"],
  "ext": "ts",
  "ignore": ["src/**/*.test.ts", "src/**/*.spec.ts"],
  "exec": "ts-node src/index.ts",
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Étape 7: Structure des dossiers

**Action**: Créer la structure de dossiers pour le projet

```bash
# Créer la structure de base
mkdir -p src/{config,types,utils,services,controllers,middleware,routes,test}
mkdir -p src/{models,interfaces,constants,helpers}
mkdir -p docs
mkdir -p scripts
```

**Fichiers de base**:
```bash
# src/index.ts - Point d'entrée
cat > src/index.ts << 'EOF'
// Point d'entrée principal de l'application
console.log('TwinMCP Server starting...');

// TODO: Importer et initialiser les modules
async function main() {
  try {
    // TODO: Initialiser les services
    console.log('Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
EOF

# src/config/index.ts - Configuration
cat > src/config/index.ts << 'EOF'
// Configuration centralisée
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // TODO: Ajouter les autres configurations
};

export default config;
EOF

# src/types/index.ts - Types globaux
cat > src/types/index.ts << 'EOF'
// Types globaux et interfaces
export interface AppConfig {
  port: number;
  nodeEnv: string;
}

// TODO: Ajouter les autres types
EOF
```

### Étape 8: Documentation et README

**Action**: Créer la documentation de base

**README.md**:
```markdown
# TwinMCP Development Setup

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

## Scripts disponibles

- `npm run dev` - Démarrer en mode développement
- `npm run build` - Compiler le projet
- `npm test` - Exécuter les tests
- `npm run lint` - Vérifier et corriger le code
- `npm run format` - Formater le code

## Structure

```
src/
├── config/     # Configuration
├── types/      # Types TypeScript
├── utils/      # Utilitaires
├── services/   # Services métier
├── controllers/ # Contrôleurs
├── middleware/ # Middleware
├── routes/     # Routes API
└── test/       # Tests
```
```

---

## Critères d'Achèvement

- [ ] TypeScript compile sans erreurs
- [ ] ESLint ne détecte aucune erreur
- [ ] Prettier formate correctement tous les fichiers
- [ ] Husky exécute les hooks pre-commit
- [ ] Jest exécute les tests avec succès
- [ ] Scripts npm fonctionnent correctement
- [ ] Structure de dossiers créée
- [ ] Documentation de base rédigée

---

## Tests de Validation

```bash
# 1. Vérifier TypeScript
npx tsc --noEmit

# 2. Vérifier ESLint
npm run lint:check

# 3. Vérifier Prettier
npm run format:check

# 4. Exécuter les tests
npm test

# 5. Builder le projet
npm run build

# 6. Démarrer en développement
npm run dev
```

---

## Risques et Mitigations

**Risque**: Configuration TypeScript trop stricte bloque le développement  
**Mitigation**: Ajuster progressivement les règles en commençant par les plus critiques

**Risque**: Husky ralentit les commits  
**Mitigation**: Optimiser lint-staged pour ne traiter que les fichiers modifiés

**Risque**: Jest lent sur gros projet  
**Mitigation**: Configurer correctement les patterns de test et utiliser watch mode

---

## Prochaine Étape

Une fois cette Story terminée, passer à **Story 1.2: Configuration des bases de données** pour mettre en place PostgreSQL et Redis.
