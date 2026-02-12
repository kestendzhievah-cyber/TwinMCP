#!/usr/bin/env node

// Script de diagnostic pour le problème tsconfig fantôme
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔍 Diagnostic du problème tsconfig.json fantôme...\n')

const projectRoot = path.resolve(__dirname)

try {
  // 1. Vérifier l'existence du dossier mcp-server-demo
  console.log('1️⃣  Recherche du dossier mcp-server-demo...')
  const mcpServerDemoPath = path.join(projectRoot, 'mcp-server-demo')
  const exists = fs.existsSync(mcpServerDemoPath)

  if (exists) {
    console.log('   ❌ Le dossier mcp-server-demo EXISTE !')
    console.log('   📁 Chemin:', mcpServerDemoPath)
    const stats = fs.statSync(mcpServerDemoPath)
    console.log('   📊 Taille:', stats.size, 'bytes')
    console.log('   📅 Modifié:', stats.mtime)
  } else {
    console.log('   ✅ Le dossier mcp-server-demo N\'EXISTE PAS')
    console.log('   🎯 C\'est bien une référence fantôme IDE')
  }

  // 2. Vérifier les références dans les fichiers de configuration
  console.log('\n2️⃣  Vérification des références dans les fichiers...')

  const filesToCheck = [
    'tsconfig.json',
    '.gitignore',
    'package.json',
    path.join('.vscode', 'settings.json')
  ]

  filesToCheck.forEach(file => {
    const filePath = path.join(projectRoot, file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      const references = content.match(/mcp-server-demo/g)
      if (references) {
        console.log(`   📄 ${file}: ${references.length} référence(s)`)
      } else {
        console.log(`   📄 ${file}: ✅ Aucune référence`)
      }
    } else {
      console.log(`   📄 ${file}: ❌ Fichier non trouvé`)
    }
  })

  // 3. Vérifier TypeScript
  console.log('\n3️⃣  Test de compilation TypeScript...')
  try {
    execSync('npx tsc --noEmit --skipLibCheck', {
      stdio: 'pipe',
      cwd: projectRoot,
      timeout: 30000
    })
    console.log('   ✅ TypeScript compile sans erreur')
  } catch (error) {
    console.log('   ❌ TypeScript a des erreurs:')
    console.log('   ', error.stdout?.toString() || error.message)
  }

  // 4. Vérifier la configuration VS Code
  console.log('\n4️⃣  Vérification de la configuration VS Code...')
  const vscodeSettings = path.join(projectRoot, '.vscode', 'settings.json')
  if (fs.existsSync(vscodeSettings)) {
    const settings = JSON.parse(fs.readFileSync(vscodeSettings, 'utf8'))
    const hasExclusions = settings['files.exclude'] &&
                         settings['files.exclude']['**/mcp-server-demo']
    console.log(`   📋 Exclusions configurées: ${hasExclusions ? '✅' : '❌'}`)
  } else {
    console.log('   ❌ Configuration VS Code non trouvée')
  }

  // 5. Recommandations
  console.log('\n💡 RECOMMANDATIONS :')

  if (exists) {
    console.log('   🗑️  Supprimer manuellement le dossier mcp-server-demo')
    console.log('   🔄 Redémarrer VS Code')
  } else {
    console.log('   🔄 Redémarrer VS Code/IDE')
    console.log('   🧹 Nettoyer le cache IDE')
    console.log('   📝 Forcer rechargement de la fenêtre (Ctrl+Shift+P > "Developer: Reload Window")')
  }

  console.log('\n📚 Scripts disponibles :')
  console.log('   node clean-cache.js       - Nettoyage complet des caches')
  console.log('   node rebuild-typescript.js - Reconstruction des références TypeScript')
  console.log('   npm run build             - Build de production')

} catch (error) {
  console.error('❌ Erreur lors du diagnostic:', error.message)
  process.exit(1)
}
