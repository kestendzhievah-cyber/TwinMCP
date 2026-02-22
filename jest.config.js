module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@types/uuid|@octokit)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    'lib/mcp/**/*.ts',
    'app/api/**/*.ts',
    '!lib/mcp/**/*.d.ts',
    '!app/api/**/route.ts'
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
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/.*\\.d\\.ts$',
    '<rootDir>/downloads/',
    '<rootDir>/__tests__/mocks/',
    '<rootDir>/__tests__/fixtures/',
    '<rootDir>/__tests__/setup\\.ts$',
    '<rootDir>/__tests__/setup\\.billing\\.ts$',
    '<rootDir>/__tests__/global-setup\\.ts$',
    '<rootDir>/__tests__/global-teardown\\.ts$',
  ],
  moduleNameMapper: {
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^uuid$': '<rootDir>/__tests__/mocks/uuid.ts'
  },
  testTimeout: 10000,
  verbose: true
};
