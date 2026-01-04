#!/usr/bin/env node

// Script de nettoyage complet des caches TypeScript et IDE
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🧹 Nettoyage complet des caches TypeScript et IDE...\n')

const projectRoot = path.resolve(__dirname)

try {
  // 1. Supprimer les caches Next.js
  console.log('1️⃣  Suppression du cache Next.js...')
  const nextCache = path.join(projectRoot, '.next')
  if (fs.existsSync(nextCache)) {
    fs.rmSync(nextCache, { recursive: true, force: true })
    console.log('   ✅ Cache .next supprimé')
  }

  // 2. Supprimer les fichiers de build TypeScript
  console.log('2️⃣  Suppression des fichiers de build TypeScript...')
  const tsBuildInfo = path.join(projectRoot, 'tsconfig.tsbuildinfo')
  if (fs.existsSync(tsBuildInfo)) {
    fs.unlinkSync(tsBuildInfo)
    console.log('   ✅ tsconfig.tsbuildinfo supprimé')
  }

  // 3. Supprimer le cache VS Code
  console.log('3️⃣  Suppression du cache VS Code...')
  const vscodeCache = path.join(projectRoot, '.vscode')
  if (fs.existsSync(vscodeCache)) {
    fs.rmSync(vscodeCache, { recursive: true, force: true })
    console.log('   ✅ Cache .vscode supprimé')
  }

  // 4. Nettoyer le cache TypeScript global
  console.log('4️⃣  Nettoyage du cache TypeScript...')
  execSync('npx tsc --build --clean', { stdio: 'inherit', cwd: projectRoot })

  // 5. Recréer la configuration VS Code
  console.log('5️⃣  Recréation de la configuration VS Code...')
  const vscodeDir = path.join(projectRoot, '.vscode')
  fs.mkdirSync(vscodeDir, { recursive: true })

  const settingsJson = {
    "typescript.preferences.includePackageJsonAutoImports": "auto",
    "typescript.suggest.autoImports": true,
    "typescript.preferences.noSemicolons": "off",
    "typescript.format.semicolons": "insert",
    "typescript.preferences.quoteMark": "double",
    "typescript.format.enable": true,
    "typescript.validate.enable": true,
    "typescript.preferences.importModuleSpecifier": "relative",
    "typescript.workspaceSymbols": "on",
    "typescript.preferences.noUnusedParameters": true,
    "typescript.preferences.noUnusedLocals": true,
    "typescript.referencesCodeLens.enabled": true,
    "typescript.implementationsCodeLens.enabled": true,
    "files.exclude": {
      "**/mcp-server-demo": true,
      "**/mcp-server-demo/**": true,
      "**/node_modules": true,
      "**/.next": true,
      "**/dist": true,
      "**/*.tsbuildinfo": true,
      "**/.git": false,
      "**/.vscode": false
    },
    "typescript.preferences.exclude": [
      "**/node_modules/**",
      "**/mcp-server-demo/**",
      "**/.next/**",
      "**/dist/**",
      "**/*.tsbuildinfo"
    ],
    "search.exclude": {
      "**/node_modules": true,
      "**/mcp-server-demo": true,
      "**/.next": true,
      "**/dist": true,
      "**/*.tsbuildinfo": true
    },
    "files.watcherExclude": {
      "**/mcp-server-demo/**": true,
      "**/node_modules/**": true,
      "**/.next/**": true,
      "**/dist/**": true
    }
  }

  fs.writeFileSync(
    path.join(vscodeDir, 'settings.json'),
    JSON.stringify(settingsJson, null, 2)
  )
  console.log('   ✅ Configuration .vscode/settings.json recréée')

  // 6. Rebuild TypeScript
  console.log('6️⃣  Rebuild TypeScript...')
  execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: projectRoot })
  console.log('   ✅ TypeScript recompilé')

  console.log('\n🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS !')
  console.log('\n📋 Actions effectuées :')
  console.log('   ✅ Cache Next.js supprimé')
  console.log('   ✅ Cache TypeScript supprimé')
  console.log('   ✅ Cache VS Code supprimé')
  console.log('   ✅ Configuration VS Code recréée')
  console.log('   ✅ TypeScript recompilé')
  console.log('\n💡 Prochaines étapes :')
  console.log('   - Redémarrer VS Code/IDE')
  console.log('   - Relancer : npm run dev')
  console.log('   - Vérifier : npx tsc --noEmit')

} catch (error) {
  console.error('❌ Erreur lors du nettoyage:', error.message)
  process.exit(1)
}
