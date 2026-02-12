#!/usr/bin/env node

// Solution finale pour le problème tsconfig.json fantôme
const fs = require('fs')
const path = require('path')

console.log('🎯 SOLUTION FINALE - Problème tsconfig.json fantôme\n')

const projectRoot = path.resolve(__dirname)

try {
  // 1. Créer un fichier tsconfig.json fantôme pour mcp-server-demo
  console.log('1️⃣  Création d\'un tsconfig.json fantôme...')
  const phantomDir = path.join(projectRoot, 'mcp-server-demo')
  const phantomTsConfig = path.join(phantomDir, 'tsconfig.json')

  // Créer le dossier fantôme
  if (!fs.existsSync(phantomDir)) {
    fs.mkdirSync(phantomDir, { recursive: true })
    console.log('   📁 Dossier mcp-server-demo créé')
  }

  // Créer le tsconfig.json fantôme
  const phantomConfig = {
    "compilerOptions": {
      "target": "es5",
      "lib": ["dom", "es6"],
      "allowJs": true,
      "skipLibCheck": true,
      "strict": false,
      "noEmit": true,
      "allowSyntheticDefaultImports": true,
      "module": "esnext",
      "moduleResolution": "node",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve"
    },
    "include": [],
    "exclude": [
      "**/*"
    ],
    "files": []
  }

  fs.writeFileSync(phantomTsConfig, JSON.stringify(phantomConfig, null, 2))
  console.log('   📄 tsconfig.json fantôme créé')

  // 2. Mettre à jour .gitignore pour ignorer ce dossier
  console.log('2️⃣  Mise à jour de .gitignore...')
  const gitignorePath = path.join(projectRoot, '.gitignore')
  let gitignore = fs.readFileSync(gitignorePath, 'utf8')

  if (!gitignore.includes('mcp-server-demo/')) {
    gitignore += '\n# mcp server demo (phantom)\nmcp-server-demo/\n'
    fs.writeFileSync(gitignorePath, gitignore)
    console.log('   ✅ .gitignore mis à jour')
  }

  // 3. Forcer TypeScript à reconnaître ce fichier
  console.log('3️⃣  Recompilation TypeScript...')
  const { execSync } = require('child_process')
  execSync('npx tsc --noEmit --skipLibCheck', {
    stdio: 'inherit',
    cwd: projectRoot
  })

  console.log('\n🎉 SOLUTION FINALE APPLIQUÉE !')
  console.log('\n📋 Ce qui a été fait :')
  console.log('   ✅ Dossier mcp-server-demo créé avec tsconfig.json')
  console.log('   ✅ Configuration fantôme qui n\'inclut rien')
  console.log('   ✅ TypeScript va maintenant ignorer ce dossier')
  console.log('   ✅ .gitignore mis à jour')
  console.log('\n💡 Prochaines étapes :')
  console.log('   - Redémarrer VS Code/IDE')
  console.log('   - Relancer : npm run dev')
  console.log('   - L\'erreur devrait avoir disparu')

  console.log('\n📚 Si le problème persiste :')
  console.log('   - Exécuter : node diagnose-tsconfig.js')
  console.log('   - Vérifier : npx tsc --noEmit')
  console.log('   - Forcer rechargement VS Code (Ctrl+Shift+P > "Developer: Reload Window")')

} catch (error) {
  console.error('❌ Erreur lors de la solution finale:', error.message)
  process.exit(1)
}
