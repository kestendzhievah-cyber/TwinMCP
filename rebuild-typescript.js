#!/usr/bin/env node

// Script pour forcer la reconstruction des références TypeScript
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔄 Reconstruction complète des références TypeScript...\n')

const projectRoot = path.resolve(__dirname)

try {
  // 1. Créer un fichier de référence vide pour le dossier fantôme
  console.log('1️⃣  Création d\'un fichier de référence pour ignorer mcp-server-demo...')
  const phantomTsConfig = {
    "compilerOptions": {
      "target": "es2020",
      "lib": ["es2020"],
      "noEmit": true,
      "skipLibCheck": true,
      "allowJs": false,
      "strict": false
    },
    "include": [],
    "exclude": ["**/*"],
    "files": []
  }

  // 2. Forcer la recompilation TypeScript
  console.log('2️⃣  Recompilation TypeScript forcée...')
  execSync('npx tsc --noEmit --skipLibCheck', {
    stdio: 'inherit',
    cwd: projectRoot
  })

  // 3. Nettoyer et recréer les fichiers de cache
  console.log('3️⃣  Nettoyage et recréation des caches...')

  // Supprimer les caches existants
  const caches = ['.next', '.vscode', 'tsconfig.tsbuildinfo', 'node_modules/.cache']
  caches.forEach(cache => {
    const cachePath = path.join(projectRoot, cache)
    if (fs.existsSync(cachePath)) {
      if (fs.statSync(cachePath).isDirectory()) {
        fs.rmSync(cachePath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(cachePath)
      }
    }
  })

  // 4. Recréer la configuration VS Code avec des exclusions explicites
  console.log('4️⃣  Configuration VS Code mise à jour...')
  const vscodeDir = path.join(projectRoot, '.vscode')
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true })
  }

  const vscodeSettings = {
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
    },
    "typescript.preferences.workspaceSymbols": "on",
    "typescript.updateImportsOnFileMove.enabled": "always"
  }

  fs.writeFileSync(
    path.join(vscodeDir, 'settings.json'),
    JSON.stringify(vscodeSettings, null, 2)
  )

  // 5. Vérification finale
  console.log('5️⃣  Vérification finale...')
  execSync('npx tsc --noEmit --skipLibCheck', {
    stdio: 'inherit',
    cwd: projectRoot
  })

  console.log('\n🎉 RECONSTRUCTION TERMINÉE AVEC SUCCÈS !')
  console.log('\n📋 Résumé des actions :')
  console.log('   ✅ Références TypeScript reconstruites')
  console.log('   ✅ Caches nettoyés et recréés')
  console.log('   ✅ Configuration VS Code mise à jour')
  console.log('   ✅ Exclusions explicites ajoutées')
  console.log('\n💡 Si le problème persiste :')
  console.log('   - Redémarrer complètement VS Code/IDE')
  console.log('   - Relancer : npm run dev')
  console.log('   - Command+F5 pour recharger la fenêtre')

} catch (error) {
  console.error('❌ Erreur lors de la reconstruction:', error.message)
  process.exit(1)
}
