#!/usr/bin/env node

// Générateur d'arborescence complète du projet Corel.IA
const fs = require('fs')
const path = require('path')

console.log('🌳 ARBORESCENCE COMPLÈTE DU PROJET COREL.IA')
console.log('='.repeat(60))

function generateTree(dir, prefix = '', isRoot = true) {
  try {
    const items = fs.readdirSync(dir)
      .filter(item => {
        // Exclure les dossiers système et caches
        const excluded = [
          'node_modules', '.next', '.git', '.firebase',
          'dist', 'build', 'out', '.cache', 'coverage',
          'tsconfig.tsbuildinfo', '.DS_Store'
        ]
        return !excluded.includes(item)
      })
      .sort((a, b) => {
        // Dossiers d'abord, puis fichiers
        const aIsDir = fs.statSync(path.join(dir, a)).isDirectory()
        const bIsDir = fs.statSync(path.join(dir, b)).isDirectory()
        if (aIsDir && !bIsDir) return -1
        if (!aIsDir && bIsDir) return 1
        return a.localeCompare(b)
      })

    if (isRoot) {
      console.log(path.basename(dir))
    }

    items.forEach((item, index) => {
      const fullPath = path.join(dir, item)
      const isLast = index === items.length - 1
      const stat = fs.statSync(fullPath)
      const isDir = stat.isDirectory()
      const size = isDir ? `(${getDirSize(fullPath)} items)` : `(${formatBytes(stat.size)})`

      // Obtenir le type de fichier
      let type = ''
      if (!isDir) {
        if (item.endsWith('.tsx')) type = ' (React/TypeScript)'
        else if (item.endsWith('.ts')) type = ' (TypeScript)'
        else if (item.endsWith('.js')) type = ' (JavaScript)'
        else if (item.endsWith('.json')) type = ' (JSON)'
        else if (item.endsWith('.md')) type = ' (Markdown)'
        else if (item.endsWith('.css')) type = ' (CSS)'
        else if (item.endsWith('.yaml') || item.endsWith('.yml')) type = ' (YAML)'
        else if (item.endsWith('.toml')) type = ' (TOML)'
        else if (item.endsWith('.sh')) type = ' (Shell)'
        else if (item.endsWith('.bat')) type = ' (Batch)'
      }

      console.log(`${prefix}${isLast ? '└── ' : '├── '}${item}${type} ${size}`)

      if (isDir) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ')
        generateTree(fullPath, newPrefix, false)
      }
    })
  } catch (error) {
    console.log(`${prefix}└── ❌ ${path.basename(dir)} (Accès refusé)`)
  }
}

function getDirSize(dirPath) {
  try {
    return fs.readdirSync(dirPath).length
  } catch {
    return 0
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Générer l'arborescence
generateTree('c:\\Users\\sofia\\Desktop\\CorelIA')

console.log('\n' + '='.repeat(60))
console.log('📊 RÉSUMÉ DES COMPOSANTS PRINCIPAUX')
console.log('='.repeat(60))

const structure = {
  '🎯 Applications': {
    'Next.js (Principal)': 'app/, components/, lib/',
    'Next.js (Corel.IA)': 'Corel.IA/app/, Corel.IA/components/, Corel.IA/lib/',
    'MCP Server': 'lib/mcp/, app/api/mcp/',
    'Firebase Functions': 'functions/, Corel.IA/functions/'
  },
  '🛠️ Configuration': {
    'TypeScript': 'tsconfig.json, next.config.js',
    'Firebase': 'firebase.json, .firebaserc',
    'Déploiement': 'vercel.json, netlify.toml, wrangler.toml',
    'Tests': 'jest.config.js, __tests__/'
  },
  '📚 Documentation': {
    'README': 'README.md, README-*.md (15 fichiers)',
    'MCP': 'MCP-SERVER-README.md, lib/mcp/README.md',
    'API': 'app/api/*/README.md'
  }
}

Object.entries(structure).forEach(([category, items]) => {
  console.log(`\n${category}:`)
  Object.entries(items).forEach(([item, description]) => {
    console.log(`  • ${item}: ${description}`)
  })
})

console.log('\n📈 STATISTIQUES:')
console.log(`  • ${getTotalFiles('c:\\Users\\sofia\\Desktop\\CorelIA')} fichiers au total`)
console.log(`  • ${getTotalDirectories('c:\\Users\\sofia\\Desktop\\CorelIA')} dossiers`)
console.log(`  • ${getCodeLines('c:\\Users\\sofia\\Desktop\\CorelIA')} lignes de code`)

function getTotalFiles(dir) {
  try {
    return fs.readdirSync(dir).reduce((total, item) => {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory() && !['node_modules', '.next', '.git'].includes(item)) {
        return total + getTotalFiles(fullPath)
      }
      return total + 1
    }, 0)
  } catch {
    return 0
  }
}

function getTotalDirectories(dir) {
  try {
    return fs.readdirSync(dir).reduce((total, item) => {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory() && !['node_modules', '.next', '.git'].includes(item)) {
        return total + 1 + getTotalDirectories(fullPath)
      }
      return total
    }, 0)
  } catch {
    return 0
  }
}

function getCodeLines(dir) {
  let total = 0
  try {
    fs.readdirSync(dir).forEach(item => {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory() && !['node_modules', '.next', '.git'].includes(item)) {
        total += getCodeLines(fullPath)
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js'))) {
        total += fs.readFileSync(fullPath, 'utf8').split('\n').length
      }
    })
  } catch {}
  return total
}
