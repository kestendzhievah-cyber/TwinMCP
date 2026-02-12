import { QueryParserService } from '../services/query-parser.service';

describe('QueryParserService', () => {
  let parser: QueryParserService;

  beforeEach(() => {
    parser = new QueryParserService();
  });

  test('should normalize query correctly', () => {
    const result = parser.parseQuery('React.js');
    expect(result.normalized).toBe('react.js');
    expect(result.original).toBe('React.js');
  });

  test('should detect JavaScript ecosystem', () => {
    const result = parser.parseQuery('npm react');
    expect(result.ecosystem).toBe('npm');
    expect(result.language).toBe('javascript');
  });

  test('should detect Python ecosystem', () => {
    const result = parser.parseQuery('pip django');
    expect(result.ecosystem).toBe('pip');
    expect(result.language).toBe('python');
  });

  test('should extract framework entities', () => {
    const result = parser.parseQuery('react hooks');
    const frameworks = result.entities.filter(e => e.type === 'framework');
    expect(frameworks).toHaveLength(1);
    expect(frameworks[0]).toBeDefined();
    if (!frameworks[0]) {
      throw new Error('Expected framework entity to be defined');
    }
    expect(frameworks[0].value).toBe('react');
    expect(frameworks[0].confidence).toBe(1.0);
  });

  test('should extract version entities', () => {
    const result = parser.parseQuery('react 18.2.0');
    const versions = result.entities.filter(e => e.type === 'version');
    expect(versions).toHaveLength(1);
    expect(versions[0]).toBeDefined();
    if (!versions[0]) {
      throw new Error('Expected version entity to be defined');
    }
    expect(versions[0].value).toBe('18.2.0');
    expect(versions[0].confidence).toBe(0.9);
  });

  test('should extract library entities', () => {
    const result = parser.parseQuery('express middleware');
    const libraries = result.entities.filter(e => e.type === 'library');
    expect(libraries.length).toBeGreaterThan(0);
    
    const expressEntity = libraries.find(e => e.value === 'express');
    expect(expressEntity).toBeDefined();
    expect(expressEntity?.type).toBe('library');
  });

  test('should handle context parameters', () => {
    const context = {
      language: 'javascript',
      ecosystem: 'npm',
      framework: 'node'
    };
    
    const result = parser.parseQuery('react', context);
    expect(result.language).toBe('javascript');
    expect(result.ecosystem).toBe('npm');
  });

  test('should calculate confidence correctly', () => {
    const result1 = parser.parseQuery('react'); // Known library
    expect(result1.confidence).toBeGreaterThan(0.7);
    
    const result2 = parser.parseQuery('x'); // Too short
    expect(result2.confidence).toBeLessThan(0.7);
    
    const result3 = parser.parseQuery('react-hooks-component'); // Good format
    expect(result3.confidence).toBeGreaterThan(0.6);
  });

  test('should handle empty queries', () => {
    const result = parser.parseQuery('');
    expect(result.normalized).toBe('');
    expect(result.tokens).toHaveLength(0);
    expect(result.entities).toHaveLength(0);
  });

  test('should handle special characters', () => {
    const result = parser.parseQuery('react@18.0.0');
    expect(result.normalized).toBe('react@18.0.0');
    expect(result.tokens).toContain('react@18.0.0');
  });

  test('should detect multiple ecosystems', () => {
    const result1 = parser.parseQuery('cargo tokio');
    expect(result1.ecosystem).toBe('cargo');
    expect(result1.language).toBe('rust');
    
    const result2 = parser.parseQuery('composer laravel');
    expect(result2.ecosystem).toBe('composer');
    expect(result2.language).toBe('php');
  });
});
