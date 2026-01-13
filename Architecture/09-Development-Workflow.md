# Development Workflow - TwinMCP Project

## Development Process Overview

### Git Workflow Strategy
```
Git Flow:
├── main (production)
├── develop (staging)
├── feature/* (new features)
├── hotfix/* (critical fixes)
└── release/* (pre-production)
```

### Branch Protection Rules
- **main branch**: Requires PR approval, CI/CD passing, no direct pushes
- **develop branch**: Requires PR approval, CI/CD passing
- **feature branches**: Can be pushed directly, require PR for merge
- **hotfix branches**: Emergency fixes, fast-tracked review process

## Development Environment Setup

### Prerequisites
```bash
# Required software versions
Node.js >= 18.20.8
npm >= 9.0.0
Git >= 2.30.0
Docker >= 20.10.0 (optional)
```

### Local Development Setup
```bash
# 1. Clone repository
git clone https://github.com/your-org/twinmcp.git
cd twinmcp

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Setup environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 4. Setup database
npx prisma migrate dev
npx prisma generate

# 5. Start development server
npm run dev
```

### Development Scripts
```json
{
  "scripts": {
    "dev": "cross-env NODE_OPTIONS='--max-old-space-size=4096' next dev",
    "dev:clean": "npm run clean && npm install && npm run dev",
    "build": "cross-env NODE_OPTIONS='--max-old-space-size=8192' next build",
    "build:analyze": "cross-env ANALYZE=true NODE_OPTIONS='--max-old-space-size=8192' next build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "clean": "rimraf .next out node_modules/.cache",
    "db:migrate": "npx prisma migrate dev",
    "db:generate": "npx prisma generate",
    "db:studio": "npx prisma studio",
    "mcp:init": "tsx lib/mcp/init.ts",
    "docs:generate": "tsx scripts/generate-docs.ts"
  }
}
```

## Code Quality Standards

### ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    '@next/next/no-img-element': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
}
```

### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/app/*": ["./app/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Pre-commit Hooks

### Husky Configuration
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run type-check && npm run test:unit"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write",
      "git add"
    ]
  }
}
```

### Pre-commit Script
```bash
#!/bin/sh
# .husky/pre-commit

# Run linting
npm run lint

# Run type checking
npm run type-check

# Run unit tests
npm run test:unit

# Check for uncommitted changes
if ! git diff --quiet; then
  echo "❌ Pre-commit checks failed. Please fix the issues and try again."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
```

## Feature Development Workflow

### 1. Feature Branch Creation
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/user-dashboard-enhancement

# Start development
npm run dev
```

### 2. Development Guidelines

#### Component Development
```typescript
// Component structure template
import React from 'react'
import { cn } from '@/lib/utils'

interface ComponentProps {
  className?: string
  children: React.ReactNode
  // Add other props
}

export function Component({ className, children, ...props }: ComponentProps) {
  return (
    <div className={cn('base-styles', className)} {...props}>
      {children}
    </div>
  )
}
```

#### API Route Development
```typescript
// API route template
import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'

const requestSchema = z.object({
  // Define request schema
})

const responseSchema = z.object({
  // Define response schema
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Validate request
    const validatedData = requestSchema.parse(req.body)
    
    // Process request
    const result = await processRequest(validatedData)
    
    // Validate response
    const validatedResponse = responseSchema.parse(result)
    
    res.status(200).json(validatedResponse)
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
```

### 3. Testing Requirements
```typescript
// Test template
import { render, screen } from '@testing-library/react'
import { Component } from '@/components/Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component>Test</Component>)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('handles props correctly', () => {
    render(<Component className="custom-class">Test</Component>)
    const element = screen.getByText('Test')
    expect(element).toHaveClass('custom-class')
  })
})
```

## Code Review Process

### Pull Request Template
```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Accessibility testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements left
- [ ] No TODO comments left without follow-up
- [ ] Performance impact considered
- [ ] Security implications considered

## Screenshots
Add screenshots if applicable.

## Additional Notes
Any additional context or considerations.
```

### Review Guidelines
1. **Functionality**: Does the code work as intended?
2. **Code Quality**: Is the code clean, readable, and maintainable?
3. **Performance**: Are there any performance concerns?
4. **Security**: Are there any security vulnerabilities?
5. **Testing**: Is adequate test coverage provided?
6. **Documentation**: Is the code properly documented?

## Database Development Workflow

### Schema Changes
```bash
# 1. Create migration
npx prisma migrate dev --name add_user_preferences

# 2. Review generated migration
# Edit prisma/migrations/*/migration.sql if needed

# 3. Test migration locally
npx prisma migrate reset

# 4. Generate Prisma Client
npx prisma generate

# 5. Update application code
# Update types, services, etc.
```

### Database Seeding
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed users
  await prisma.user.createMany({
    data: [
      {
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN'
      },
      {
        email: 'user@example.com',
        name: 'Test User',
        role: 'USER'
      }
    ]
  })

  // Seed other data...
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

## Debugging Workflow

### Development Debugging
```typescript
// Debug configuration
const config = {
  development: {
    debug: true,
    logLevel: 'debug',
    enableSourceMaps: true
  },
  production: {
    debug: false,
    logLevel: 'error',
    enableSourceMaps: false
  }
}

// Debug logging utility
export const logger = {
  debug: (message: string, data?: any) => {
    if (config.development.debug) {
      console.debug(`[DEBUG] ${message}`, data)
    }
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error)
    // Send to error tracking service
  }
}
```

### VS Code Debug Configuration
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Jest: debug tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Performance Development

### Performance Monitoring
```typescript
// Performance monitoring utilities
export class PerformanceMonitor {
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start
    
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`)
    
    return { result, duration }
  }
  
  static measureSync<T>(
    name: string,
    fn: () => T
  ): { result: T; duration: number } {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start
    
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`)
    
    return { result, duration }
  }
}
```

### Bundle Analysis
```bash
# Analyze bundle size
npm run build:analyze

# Check for large dependencies
npx webpack-bundle-analyzer .next/static/chunks/*.js

# Optimize images
npx next-optimized-images
```

## Documentation Workflow

### Code Documentation
```typescript
/**
 * User service for managing user operations
 * @class UserService
 * @example
 * const userService = new UserService(prisma)
 * const user = await userService.createUser(userData)
 */
export class UserService {
  /**
   * Creates a new user
   * @param {CreateUserData} userData - User data to create
   * @returns {Promise<User>} Created user object
   * @throws {ValidationError} When user data is invalid
   * @example
   * const user = await userService.createUser({
   *   email: 'user@example.com',
   *   name: 'John Doe'
   * })
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // Implementation
  }
}
```

### API Documentation
```typescript
/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 */
```

## Release Management

### Version Management
```json
{
  "scripts": {
    "version:patch": "npm version patch",
    "version:minor": "npm version minor",
    "version:major": "npm version major",
    "release:prepare": "npm run build && npm run test && npm run version:patch",
    "release:publish": "git push origin main --tags"
  }
}
```

### Release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version number updated
- [ ] Build successful
- [ ] Security scan passed
- [ ] Performance tests passed
- [ ] Migration scripts tested
- [ ] Backup procedures verified
- [ ] Rollback plan documented

## Team Collaboration

### Communication Guidelines
- **Daily Standups**: Share progress and blockers
- **Sprint Planning**: Plan upcoming work
- **Retrospectives**: Improve process
- **Code Reviews**: Knowledge sharing
- **Documentation**: Keep docs current

### Issue Management
```markdown
## Bug Report Template
**Description**: Clear description of the bug
**Steps to Reproduce**: Detailed reproduction steps
**Expected Behavior**: What should happen
**Actual Behavior**: What actually happens
**Environment**: Browser, OS, version
**Screenshots**: If applicable
**Additional Context**: Any other relevant info

## Feature Request Template
**Problem**: Problem this feature solves
**Proposed Solution**: How to implement
**Alternatives**: Other approaches considered
**Additional Context**: Requirements, constraints
```

## Continuous Improvement

### Metrics to Track
- Code coverage percentage
- Build time
- Test execution time
- Bug fix time
- Feature delivery time
- Code review turnaround time
- Deployment frequency
- Change failure rate

### Process Improvements
- Regular retrospectives
- Automation opportunities
- Tool upgrades
- Training and knowledge sharing
- Documentation maintenance
- Performance optimization
- Security enhancements
