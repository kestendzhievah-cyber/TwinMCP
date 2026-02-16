// Configuration Jest pour MCP
module.exports = {
  // Configuration de base
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Coverage
  collectCoverageFrom: [
    'lib/mcp/**/*.ts',
    'app/api/**/*.ts',
    '!lib/mcp/**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Setup
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],

  // Transformation
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      }
    }]
  },

  // Module mapping
  moduleNameMapper: {
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^uuid$': '<rootDir>/__tests__/mocks/uuid.ts'
  },

  // Timeouts
  testTimeout: 15000,

  // Verbose output
  verbose: true,

  // Global setup
  globalSetup: '<rootDir>/__tests__/global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/global-teardown.ts'
}
