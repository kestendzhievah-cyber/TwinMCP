import { PrismaClient } from '@prisma/client'
import { VectorStoreService } from '../src/services/vector-store.service'
import { EmbeddingsService } from '../src/services/embeddings.service'
import { logger } from '../src/utils/logger'

const prisma = new PrismaClient()

// Sample documentation chunks for testing
const sampleDocumentation = {
  '/react/react': [
    {
      content: `# React Hooks

Hooks are functions that let you "hook into" React state and lifecycle features from function components.

## useState Hook

The useState Hook lets you add React state to function components.

\`\`\`javascript
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

The useState returns an array with exactly two values:
1. The current state
2. A function to update it`,
      metadata: {
        section: 'Hooks Reference',
        subsection: 'useState',
        contentType: 'guide' as const,
        sourceUrl: 'https://react.dev/reference/react/useState',
        codeLanguage: 'javascript'
      }
    },
    {
      content: `# useEffect Hook

The useEffect Hook lets you perform side effects in function components.

\`\`\`javascript
import React, { useState, useEffect } from 'react';

function Example() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = \`You clicked \${count} times\`;
  });

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

useEffect runs after every render by default.`,
      metadata: {
        section: 'Hooks Reference',
        subsection: 'useEffect',
        contentType: 'guide' as const,
        sourceUrl: 'https://react.dev/reference/react/useEffect',
        codeLanguage: 'javascript'
      }
    },
    {
      content: `React.memo is a higher order component that memoizes the result of a function component.

\`\`\`javascript
const MemoizedComponent = React.memo(function MyComponent(props) {
  // component logic
});
\`\`\``,
      metadata: {
        section: 'API Reference',
        subsection: 'React.memo',
        contentType: 'snippet' as const,
        sourceUrl: 'https://react.dev/reference/react/memo',
        codeLanguage: 'javascript'
      }
    }
  ],
  '/nodejs/node': [
    {
      content: `# File System Module

The fs module enables interacting with the file system in a way modeled on standard POSIX functions.

\`\`\`javascript
const fs = require('fs');

// Read a file
fs.readFile('/etc/passwd', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data);
});

// Write to a file
fs.writeFile('message.txt', 'Hello Node.js', 'utf8', (err) => {
  if (err) throw err;
  console.log('The file has been saved!');
});
\`\`\``,
      metadata: {
        section: 'Modules',
        subsection: 'File System',
        contentType: 'guide' as const,
        sourceUrl: 'https://nodejs.org/api/fs.html',
        codeLanguage: 'javascript'
      }
    },
    {
      content: `# HTTP Module

The HTTP module provides an HTTP server and client.

\`\`\`javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
\`\`\``,
      metadata: {
        section: 'Modules',
        subsection: 'HTTP',
        contentType: 'guide' as const,
        sourceUrl: 'https://nodejs.org/api/http.html',
        codeLanguage: 'javascript'
      }
    }
  ],
  '/expressjs/express': [
    {
      content: `# Express.js Basics

Express is a minimal and flexible Node.js web application framework.

\`\`\`javascript
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(\`Example app listening at http://localhost:\${port}\`);
});
\`\`\``,
      metadata: {
        section: 'Getting Started',
        subsection: 'Hello World',
        contentType: 'guide' as const,
        sourceUrl: 'https://expressjs.com/en/starter/hello-world.html',
        codeLanguage: 'javascript'
      }
    },
    {
      content: `# Routing

Routing refers to how an application's endpoints (URIs) respond to client requests.

\`\`\`javascript
app.get('/users/:userId/books/:bookId', (req, res) => {
  res.send(req.params);
});
\`\`\``,
      metadata: {
        section: 'Guide',
        subsection: 'Routing',
        contentType: 'snippet' as const,
        sourceUrl: 'https://expressjs.com/en/guide/routing.html',
        codeLanguage: 'javascript'
      }
    }
  ]
}

async function populateVectorStore() {
  try {
    logger.info('🚀 Starting vector store population...')

    // Initialize services
    const vectorStoreService = new VectorStoreService()
    await vectorStoreService.initialize()

    const embeddingsService = new EmbeddingsService()
    await embeddingsService.healthCheck()

    // Get all libraries from database
    const libraries = await prisma.library.findMany({
      include: {
        versions: {
          where: { isLatest: true },
          take: 1
        }
      }
    })

    logger.info(`Found ${libraries.length} libraries in database`)

    for (const library of libraries) {
      const docs = sampleDocumentation[library.id as keyof typeof sampleDocumentation]
      
      if (!docs) {
        logger.warn(`No sample documentation for library: ${library.id}`)
        continue
      }

      const version = library.versions[0]?.version || library.defaultVersion || 'latest'
      logger.info(`Processing ${library.name} (${version})...`)

      const documents = docs.map(doc => ({
        content: doc.content,
        metadata: {
          libraryId: library.id,
          version,
          contentType: doc.metadata.contentType,
          sourceUrl: doc.metadata.sourceUrl,
          section: doc.metadata.section,
          subsection: doc.metadata.subsection,
          codeLanguage: doc.metadata.codeLanguage,
          tokenCount: Math.ceil(doc.content.length / 4) // Rough estimation
        }
      }))

      // Add documents to vector store in batches
      await vectorStoreService.addDocumentsBatch(documents)
      
      // Update library stats
      await prisma.library.update({
        where: { id: library.id },
        data: {
          totalSnippets: documents.length,
          totalTokens: documents.reduce((sum, doc) => sum + doc.metadata.tokenCount, 0)
        }
      })

      logger.info(`✅ Added ${documents.length} documentation chunks for ${library.name}`)
    }

    // Get final stats
    const stats = await vectorStoreService.getStats()
    logger.info('🎉 Vector store population completed!')
    logger.info('📊 Final stats:', JSON.stringify(stats, null, 2))

  } catch (error) {
    logger.error('❌ Error populating vector store:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
if (require.main === module) {
  populateVectorStore()
    .then(() => {
      logger.info('✅ Vector store population completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('❌ Vector store population failed:', error)
      process.exit(1)
    })
}

export { populateVectorStore }
