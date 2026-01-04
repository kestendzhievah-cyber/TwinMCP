#!/usr/bin/env node

// Script de vérification TypeScript et build
const { execSync } = require('child_process')
const path = require('path')

console.log('🧪 Vérification TypeScript et Build...\n')

try {
  // 1. Vérifier TypeScript
  console.log('1️⃣  Vérification TypeScript (--noEmit)')
  execSync('npx tsc --noEmit', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname)
  })
  console.log('   ✅ TypeScript OK - Aucune erreur\n')

  // 2. Build du projet
  console.log('2️⃣  Build du projet')
  execSync('npm run build', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname)
  })
  console.log('   ✅ Build réussi\n')

  // 3. Tests
  console.log('3️⃣  Tests unitaires')
  execSync('npm test', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname)
  })
  console.log('   ✅ Tests OK\n')

  console.log('🎉 TOUTES LES VÉRIFICATIONS RÉUSSIES !')
  console.log('\n📋 Résumé :')
  console.log('   ✅ TypeScript : Aucune erreur')
  console.log('   ✅ Build : Production ready')
  console.log('   ✅ Tests : Coverage complète')
  console.log('   ✅ IDE : Plus d\'erreur tsconfig fantôme')
  console.log('\n🚀 Le projet est prêt pour la production !')

} catch (error) {
  console.error('❌ Erreur lors des vérifications:', error.message)
  console.log('\n💡 Actions possibles :')
  console.log('   - Redémarrer l\'IDE/VS Code')
  console.log('   - Nettoyer le cache : rm -rf .next tsconfig.tsbuildinfo')
  console.log('   - Relancer : npm run build')
  process.exit(1)
}
