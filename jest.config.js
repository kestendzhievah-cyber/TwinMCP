module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'lib/mcp/**/*.ts',
    'app/api/**/*.ts',
    '!lib/mcp/**/*.d.ts',
    '!app/api/**/route.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  testTimeout: 10000,
  verbose: true
}
