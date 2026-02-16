import { CodeExtractorService } from '../../src/services/crawling/code-extractor.service'

describe('CodeExtractorService', () => {
  let service: CodeExtractorService

  beforeEach(() => {
    service = new CodeExtractorService()
  })

  describe('Fenced code block extraction', () => {
    it('extracts fenced code blocks with language', () => {
      const content = `
# Getting Started

Install the package:

\`\`\`bash
npm install express
\`\`\`

Then create a server:

\`\`\`javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.listen(3000);
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples.length).toBe(2)
      expect(result.examples[0].language).toBe('bash')
      expect(result.examples[1].language).toBe('javascript')
    })

    it('extracts code blocks without language declaration', () => {
      const content = `
Example:

\`\`\`
const x = 42;
console.log(x);
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples.length).toBe(1)
      expect(result.examples[0].language).toBe('javascript') // auto-detected
    })

    it('extracts imports and dependencies', () => {
      const content = `
\`\`\`javascript
import React from 'react';
import { useState } from 'react';
import axios from 'axios';
import './styles.css';

function App() {
  const [data, setData] = useState(null);
  return <div>{data}</div>;
}
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples[0].imports).toContain('react')
      expect(result.examples[0].imports).toContain('axios')
      expect(result.examples[0].dependencies).toContain('react')
      expect(result.examples[0].dependencies).toContain('axios')
      // Relative imports should not be in dependencies
      expect(result.examples[0].dependencies).not.toContain('.')
    })
  })

  describe('Language detection', () => {
    it('detects TypeScript', () => {
      expect(service.detectLanguage('interface User { name: string; age: number; }')).toBe('typescript')
    })

    it('detects Python', () => {
      expect(service.detectLanguage('def hello():\n    print("hello")\n\nimport os')).toBe('python')
    })

    it('detects HTML', () => {
      expect(service.detectLanguage('<html><head><title>Test</title></head><body></body></html>')).toBe('html')
    })

    it('detects SQL', () => {
      expect(service.detectLanguage('SELECT * FROM users WHERE id = 1')).toBe('sql')
    })

    it('detects bash', () => {
      expect(service.detectLanguage('#!/bin/bash\necho "hello"\nif [ -f file ]; then\n  echo "exists"\nfi')).toBe('bash')
    })

    it('returns text for unrecognized code', () => {
      expect(service.detectLanguage('just some random text here')).toBe('text')
    })
  })

  describe('Complexity assessment', () => {
    it('classifies simple code as beginner', () => {
      const content = `
\`\`\`javascript
const x = 42;
console.log(x);
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples[0].complexity).toBe('beginner')
    })

    it('classifies async code as intermediate or advanced', () => {
      const content = `
\`\`\`javascript
async function fetchData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data;
}
\`\`\`
`
      const result = service.extract(content)
      expect(['intermediate', 'advanced']).toContain(result.examples[0].complexity)
    })

    it('classifies complex class hierarchies as advanced', () => {
      const content = `
\`\`\`typescript
class BaseService {
  constructor(private db: Pool) {}
}

class UserService extends BaseService {
  async findUser(id: string): Promise<User> {
    const result = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }
}
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples[0].complexity).toBe('advanced')
    })
  })

  describe('Runnable detection', () => {
    it('detects runnable JavaScript', () => {
      const content = `
\`\`\`javascript
console.log("Hello World");
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples[0].isRunnable).toBe(true)
    })

    it('detects non-runnable type definitions', () => {
      const content = `
\`\`\`typescript
interface User {
  name: string;
  age: number;
}

type Role = 'admin' | 'user';
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples[0].isRunnable).toBe(false)
    })
  })

  describe('Stats', () => {
    it('generates extraction stats', () => {
      const content = `
\`\`\`javascript
const a = 1;
\`\`\`

\`\`\`python
x = 42
\`\`\`

\`\`\`javascript
const b = 2;
\`\`\`
`
      const result = service.extract(content)
      expect(result.stats.total).toBe(3)
      expect(result.stats.byLanguage['javascript']).toBe(2)
      expect(result.stats.byLanguage['python']).toBe(1)
    })
  })

  describe('Tags generation', () => {
    it('generates relevant tags', () => {
      const content = `
\`\`\`javascript
import React, { useState, useEffect } from 'react';

async function fetchData() {
  const res = await fetch('/api');
  return res.json();
}
\`\`\`
`
      const result = service.extract(content)
      const tags = result.examples[0].tags
      expect(tags).toContain('javascript')
      expect(tags).toContain('async')
      expect(tags).toContain('react-hooks')
    })
  })

  describe('Context extraction', () => {
    it('extracts surrounding context', () => {
      const content = `
This function demonstrates how to create an Express server:

\`\`\`javascript
const app = express();
app.listen(3000);
\`\`\`
`
      const result = service.extract(content)
      expect(result.examples[0].context).toContain('Express server')
    })
  })
})
