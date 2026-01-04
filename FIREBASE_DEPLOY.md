# Guide de Déploiement Firebase

## Configuration du Projet

### 1. Configurer Firebase

Si vous n'avez pas encore de fichier `.firebaserc`, créez-le à partir du template :

```bash
cp .firebaserc.example .firebaserc
```

Puis éditez `.firebaserc` et remplacez `YOUR_FIREBASE_PROJECT_ID` par votre ID de projet Firebase.

### 2. Versions Requises

- **Node.js**: 18.20.8
- **npm**: ≥9.0.0

## Déploiement

### Option 1 : Déploiement Local

```bash
# Installer les dépendances
npm install --legacy-peer-deps

# Build pour Firebase
npm run build:firebase

# Déployer
npm run deploy
```

### Option 2 : Déploiement CI/CD

```bash
npm run deploy:ci
```

Cette commande :
1. Installe les dépendances proprement (`npm ci --legacy-peer-deps`)
2. Build le projet en mode production
3. Déploie sur Firebase

### Option 3 : Déploiement Manuel

```bash
# 1. Nettoyer le projet
npm run clean

# 2. Installer les dépendances
npm ci --legacy-peer-deps

# 3. Build
npm run build:firebase

# 4. Vérifier le dossier out
ls out

# 5. Déployer
firebase deploy --only hosting
```

## Configuration des Fichiers

### `next.config.js`
- **output**: `export` (génère un site statique dans le dossier `out`)
- **images**: `unoptimized: true` (requis pour l'export statique)

### `firebase.json`
- **public**: `out` (dossier contenant le site statique)

### `apphosting.yaml`
- **nodeVersion**: 18
- **installCommand**: `npm ci --legacy-peer-deps`
- **buildCommand**: `npm run build:firebase`

## Résolution des Problèmes

### Problème: `npm view next` échoue

**Solution appliquée** :
- Fichier `.npmrc` configuré avec `engine-strict = false`
- Fichier `apphosting.yaml` avec commandes d'installation explicites
- Script `build:firebase` dédié dans `package.json`

### Problème: Buildpack npm ne fonctionne pas

**Solution** :
- Fichier `project.toml` créé avec configuration des buildpacks
- Variables d'environnement configurées pour npm

### Problème: Build échoue avec erreurs de mémoire

**Solutions** :
- Augmenter `NODE_OPTIONS='--max-old-space-size=8192'` dans les scripts
- Augmenter `memoryMiB: 2048` dans `apphosting.yaml`

## Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Développement local |
| `npm run build` | Build standard |
| `npm run build:firebase` | Build pour Firebase (export statique) |
| `npm run predeploy` | Exécuté automatiquement avant deploy |
| `npm run deploy` | Déployer sur Firebase |
| `npm run deploy:ci` | Déploiement complet (CI/CD) |
| `npm run clean` | Nettoyer les fichiers de build |

## Notes Importantes

1. **Export Statique** : Le projet est configuré en mode `export` pour Firebase Hosting
   - Pas de SSR (Server-Side Rendering)
   - Pas d'API Routes Next.js (utilisez Firebase Functions à la place)
   
2. **Legacy Peer Dependencies** : Le flag `--legacy-peer-deps` est nécessaire pour résoudre certains conflits de dépendances

3. **Firebase Functions** : Configurées séparément dans le dossier `functions/`

## Support

En cas de problème, vérifiez :
1. Les versions de Node.js et npm
2. Le fichier `.firebaserc` est correctement configuré
3. Le fichier `package-lock.json` existe
4. Les commandes s'exécutent sans erreur localement avant de déployer
