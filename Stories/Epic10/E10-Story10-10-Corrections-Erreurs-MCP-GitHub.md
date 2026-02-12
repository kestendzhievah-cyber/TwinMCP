# E10-Story10-10-Corrections-Erreurs-MCP-GitHub.md

## Epic 10: Déploiement & Production

### Story 10.10: Corrections MCP + Import GitHub (flux end-to-end)

**Description**: Corriger les erreurs bloquantes et écarts de comportement autour du flux “Importer depuis GitHub” et des routes MCP v1, en garantissant la compatibilité Windows et en ajoutant des tests de non-régression.

---

## Objectif

Rendre fonctionnel (et robuste) le scénario suivant :

1. L’utilisateur saisit un URL de repository GitHub dans le dashboard.
2. Le backend crée une tâche de download/clone du repo.
3. L’UI peut suivre l’état de la tâche et afficher le résultat.
4. Le système MCP v1 reste opérationnel (tools/list, execute, health) avec validation des inputs.

---

## Contraintes

- Changement minimal (éviter refactor massif).
- Sécurité : aucune injection shell, validation stricte des inputs.
- Compatibilité Windows (pas de dépendance à `find`, `wget`, `tar`).
- Ne pas casser les endpoints MCP existants (`/api/v1/mcp/*`).

---

## Problèmes détectés (résumé)

- Routes Next API “downloads” incohérentes (`app/api` vs `src/app/api`) ou incomplètes.
- `DownloadManagerService` fragile (commandes non portables, quoting, injection).
- Schéma Prisma présent mais migrations manquantes pour `download_tasks` / `download_results`.
- MCP v1 : risque de registry/validator non initialisés (schemas non enregistrés).
- `GitHubTool` (MCP) = simulation (écart produit/UX si présenté comme réel).
- Incohérence possible du format de config `mcpServers` (http `url` vs stdio `command/args`).

---

## Plan de correction (instructions LLM)

### Phase 0 — Clarification (bloquante)

Définir précisément ce que “Importer depuis GitHub” doit produire :
- Option A : cloner le repo + afficher localPath/fichiers (MVP).
- Option B : cloner + détecter un fichier de config MCP (ex: `mcp.json`) et l’importer.
- Option C : créer/installer automatiquement un serveur MCP (hors scope MVP si ambigu).

### Phase 1 — API Downloads (Next)

Rendre disponibles les endpoints :
- `POST /api/downloads`
- `GET /api/downloads` (queue)
- `GET /api/downloads/[taskId]` (status)
- `DELETE /api/downloads/[taskId]`

### Phase 2 — DownloadManagerService (Windows + sécurité)

- Sécuriser `git clone` (validation + `execFile` + quoting + timeout).
- Remplacer `cleanRepository()` par une implémentation Node cross-platform.
- Gérer clairement les features non supportées sous Windows (website/npm).

### Phase 3 — Prisma / migrations

Créer une migration qui ajoute les tables `download_tasks` et `download_results`.

### Phase 4 — MCP v1 : initialisation + validation

- Garantir que `initializeMCP()` est appelé en runtime Next (lazy init).
- Enregistrer les schemas Zod de chaque tool dans `InputValidator`.

### Phase 5 — UI Dashboard : wiring Import GitHub

- Ajouter un appel client vers `POST /api/downloads`.
- Poller `GET /api/downloads/[taskId]` jusqu’à `completed/failed`.
- Afficher erreurs et localPath.

### Phase 6 — GitHubTool (simulation vs réel)

Choisir une stratégie et l’assumer :
- soit l’UI indique clairement “simulation”.
- soit implémenter réellement via Octokit.

---

## Tests de non-régression (minimum)

- Tests API : création de task + récupération status.
- Tests MCP : `tools/list` et `execute` ne doivent pas échouer sur validation manquante.

---

## Livrables

1. Story 10.10 validée et actionnable.
2. Routes downloads opérationnelles.
3. Correctifs Windows/sécurité sur `DownloadManagerService`.
4. MCP v1 stable (registry + validator).

---

## Critères de succès

- [ ] Depuis le dashboard, un URL GitHub valide déclenche une tâche et retourne un `taskId`.
- [ ] Le status de tâche est consultable via API jusqu’à completion.
- [ ] Aucune dépendance à `find`, `wget`, `tar` en environnement Windows.
- [ ] `/api/v1/mcp/tools` et `/api/v1/mcp/execute` fonctionnent (validator OK).

---

# ANNEXE A — Diagnostics détaillés

## A.1 Routes API Downloads : duplication `app/` vs `src/app/`

### Symptôme
- L'UI appelle `/api/downloads` mais Next.js ne trouve pas la route.
- Erreur 404 ou "Cannot POST /api/downloads".

### Cause
- Les routes existent dans `src/app/api/downloads/route.ts` et `src/app/api/downloads/[taskId]/route.ts`.
- Next.js App Router utilise par défaut `app/` (racine) pour le routing, **pas** `src/app/`.
- Le dossier `app/api/` existe mais ne contient pas `downloads/`.

### Fichiers concernés
- `src/app/api/downloads/route.ts` (POST, GET)
- `src/app/api/downloads/[taskId]/route.ts` (GET, DELETE)
- `app/api/` (manque `downloads/`)

### Correction minimale (Option A — déplacer)
Déplacer les fichiers de `src/app/api/downloads/` vers `app/api/downloads/`.

```bash
# Windows PowerShell
mkdir -p app/api/downloads
Copy-Item -Path src/app/api/downloads/route.ts -Destination app/api/downloads/route.ts
Copy-Item -Path src/app/api/downloads/[taskId]/route.ts -Destination app/api/downloads/[taskId]/route.ts
```

### Correction minimale (Option B — re-export)
Créer des fichiers dans `app/api/downloads/` qui ré-exportent depuis `src/app/api/downloads/`.

```typescript
// app/api/downloads/route.ts
export { GET, POST } from '@/src/app/api/downloads/route';
```

```typescript
// app/api/downloads/[taskId]/route.ts
export { GET, DELETE } from '@/src/app/api/downloads/[taskId]/route';
```

### Vérification
```bash
curl -X POST http://localhost:3000/api/downloads -H "Content-Type: application/json" -d '{"type":"github","source":{"owner":"facebook","repository":"react"}}'
# Attendu : { "success": true, "taskId": "..." }
```

---

## A.2 `DownloadManagerService` : injection shell + Windows

### Symptôme
- `git clone` échoue si `owner` ou `repository` contiennent des caractères spéciaux.
- `cleanRepository()` échoue sur Windows (commande `find` inexistante).
- `downloadFromNPM()` échoue sur Windows (`tar` absent).
- `downloadFromWebsite()` échoue sur Windows (`wget` absent).

### Cause
- Utilisation de `exec()` avec concaténation de strings (injection possible).
- Commandes Unix-only (`find`, `wget`, `tar`).

### Fichiers concernés
- `src/services/download-manager.service.ts`

### Correction minimale — `downloadFromGitHub`

Remplacer :
```typescript
gitCommand += ` https://github.com/${owner}/${repository}.git ${localPath}`;
const { stderr } = await execAsync(gitCommand);
```

Par :
```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

// Validation stricte
const GITHUB_NAME_REGEX = /^[A-Za-z0-9_.-]+$/;
if (!GITHUB_NAME_REGEX.test(owner) || !GITHUB_NAME_REGEX.test(repository)) {
  throw new Error('Invalid GitHub owner or repository name');
}

const args = ['clone'];
if (task.options.shallow) {
  args.push('--depth', '1');
}
args.push(`https://github.com/${owner}/${repository}.git`, localPath);

try {
  await execFileAsync('git', args, { timeout: this.config.timeout });
} catch (error) {
  throw new Error(`Git clone failed: ${(error as Error).message}`);
}
```

### Correction minimale — `cleanRepository`

Remplacer l'appel à `find` par une implémentation Node.js cross-platform :

```typescript
import { rm } from 'fs/promises';
import { glob } from 'fast-glob'; // Ajouter à package.json si absent

private async cleanRepository(localPath: string, excludePatterns: string[]): Promise<void> {
  for (const pattern of excludePatterns) {
    try {
      const matches = await glob(pattern, { cwd: localPath, absolute: true, onlyDirectories: true });
      for (const match of matches) {
        await rm(match, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Failed to clean pattern ${pattern}:`, error);
    }
  }
}
```

### Correction minimale — `downloadFromNPM` et `downloadFromWebsite`

Option 1 : Retourner une erreur explicite sur Windows.
```typescript
private async downloadFromNPM(task: DownloadTask): Promise<DownloadResult> {
  if (process.platform === 'win32') {
    throw new Error('NPM download is not supported on Windows (requires tar)');
  }
  // ... reste du code
}
```

Option 2 : Implémenter avec `tar-stream` (déjà dans `package.json`).

### Vérification
```bash
npm test -- --testPathPattern=download-manager
```

---

## A.3 Prisma : migrations manquantes pour `download_tasks` / `download_results`

### Symptôme
- Erreur SQL : `relation "download_tasks" does not exist`.

### Cause
- Les modèles `DownloadTask` et `DownloadResult` sont définis dans `prisma/schema.prisma`.
- Aucune migration n'a été générée/commitée pour ces tables.

### Fichiers concernés
- `prisma/schema.prisma`
- `prisma/migrations/` (manque la migration)

### Correction minimale

1. Vérifier que les modèles sont bien dans `schema.prisma` :
```prisma
model DownloadTask {
  id          String   @id @default(uuid())
  type        String
  source      Json
  options     Json
  priority    String   @default("normal")
  status      String   @default("pending")
  progress    Json     @default("{}")
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now()) @map("created_at")
  startedAt   DateTime? @map("started_at")
  completedAt DateTime? @map("completed_at")
  error       String?
  retryCount  Int      @default(0) @map("retry_count")

  results     DownloadResult[]

  @@map("download_tasks")
}

model DownloadResult {
  id        String   @id @default(uuid())
  taskId    String   @map("task_id")
  success   Boolean
  localPath String   @map("local_path")
  metadata  Json
  files     Json
  errors    Json     @default("[]")
  createdAt DateTime @default(now()) @map("created_at")

  task      DownloadTask @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@map("download_results")
}
```

2. Générer la migration :
```bash
npx prisma migrate dev --name add_download_tables
```

3. Appliquer en production :
```bash
npx prisma migrate deploy
```

### Vérification
```bash
npx prisma db pull
# Vérifier que download_tasks et download_results apparaissent
```

---

## A.4 MCP v1 : schemas non enregistrés dans `InputValidator`

### Symptôme
- `/api/v1/mcp/execute` retourne `"No validation schema found for tool: <toolId>"`.

### Cause
- `initializeTools()` enregistre les tools dans `registry` mais **pas** leurs schemas dans `validator`.
- `validator.validate(toolId, args)` échoue car `schemas.get(toolId)` retourne `undefined`.

### Fichiers concernés
- `lib/mcp/tools/index.ts` (`initializeTools`)
- `lib/mcp/core/validator.ts` (`InputValidator`)
- `app/api/v1/mcp/execute/route.ts` (appelle `validator.validate`)

### Correction minimale

Modifier `initializeTools()` pour enregistrer les schemas :

```typescript
// lib/mcp/tools/index.ts
import { validator } from '../core/validator';

export async function initializeTools(services: any = {}): Promise<void> {
  console.log('🔧 Initializing MCP Tools...');

  // ... code existant pour créer les tools ...

  // Enregistrer les schemas dans le validator
  for (const tool of registry.getAll()) {
    if (tool.inputSchema) {
      validator.registerSchema(tool.id, tool.inputSchema);
    }
  }

  console.log(`📋 Registered ${validator.getAllSchemas().length} validation schemas`);
}
```

### Vérification
```bash
curl -X POST http://localhost:3000/api/v1/mcp/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: mcp-default-key-12345" \
  -d '{"toolId":"email","args":{"to":"test@example.com","subject":"Test","body":"Test"}}'
# Attendu : { "success": true, ... } ou erreur de validation (pas "No validation schema found")
```

---

## A.5 MCP v1 : `initializeMCP()` non appelé en runtime Next

### Symptôme
- `registry.getAll()` retourne un tableau vide.
- `/api/v1/mcp/tools` retourne `{ "tools": [], "totalCount": 0 }`.

### Cause
- `initializeMCP()` n'est appelé nulle part dans le cycle de vie Next.js.
- Les tests l'appellent dans `beforeAll` / `globalSetup`, mais pas l'app.

### Fichiers concernés
- `lib/mcp/init.ts`
- `app/api/v1/mcp/tools/route.ts`
- `app/api/v1/mcp/execute/route.ts`
- `app/api/v1/mcp/health/route.ts`

### Correction minimale — Lazy initialization

Créer un helper singleton :

```typescript
// lib/mcp/ensure-init.ts
import { initializeMCP } from './init';

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureMCPInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = initializeMCP().then(() => {
    initialized = true;
  });

  return initPromise;
}
```

Appeler au début de chaque route MCP :

```typescript
// app/api/v1/mcp/tools/route.ts
import { ensureMCPInitialized } from '@/lib/mcp/ensure-init';

export async function GET(request: NextRequest) {
  await ensureMCPInitialized();
  // ... reste du code
}
```

### Vérification
```bash
# Redémarrer le serveur Next
npm run dev

curl http://localhost:3000/api/v1/mcp/tools
# Attendu : { "tools": [...], "totalCount": > 0 }
```

---

## A.6 UI Dashboard : bouton "Clone the docs" non câblé

### Symptôme
- Le bouton "Clone the docs for installation" ne fait rien.

### Cause
- Le bouton n'a pas de `onClick` handler.
- Aucun appel à `/api/downloads`.

### Fichiers concernés
- `app/dashboard/page.tsx` (ligne ~1080)
- `app/dashboard/page.jsx` (ligne ~844)

### Correction minimale

Ajouter un état et un handler :

```tsx
// Dans le composant Dashboard
const [githubUrl, setGithubUrl] = useState('');
const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
const [taskId, setTaskId] = useState<string | null>(null);

const handleImportFromGitHub = async () => {
  if (!githubUrl) return;

  // Extraire owner/repo de l'URL
  const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    alert('Invalid GitHub URL');
    return;
  }

  const [, owner, repository] = match;
  setImportStatus('loading');

  try {
    const res = await fetch('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'github',
        source: { owner, repository: repository.replace('.git', '') },
        options: { shallow: true, includeDocs: true, includeTests: false, includeExamples: true, maxDepth: 5, excludePatterns: [] },
        priority: 'normal'
      })
    });

    const data = await res.json();
    if (data.success) {
      setTaskId(data.taskId);
      setImportStatus('success');
    } else {
      setImportStatus('error');
    }
  } catch (error) {
    setImportStatus('error');
  }
};
```

Modifier le JSX :

```tsx
<div className="mb-4">
  <h2 className="text-xl font-bold text-white mb-1">Connect</h2>
  <input
    type="text"
    placeholder="https://github.com/owner/repo"
    value={githubUrl}
    onChange={(e) => setGithubUrl(e.target.value)}
    className="w-full p-2 mb-2 bg-gray-800 text-white rounded"
  />
  <button
    onClick={handleImportFromGitHub}
    disabled={importStatus === 'loading'}
    className="text-sm text-purple-400 hover:text-purple-300 transition"
  >
    {importStatus === 'loading' ? 'Importing...' : 'Import from GitHub'}
  </button>
  {taskId && <p className="text-green-400 text-xs mt-1">Task ID: {taskId}</p>}
</div>
```

### Vérification
- Ouvrir le dashboard.
- Saisir une URL GitHub valide.
- Cliquer sur "Import from GitHub".
- Vérifier qu'un `taskId` s'affiche.

---

## A.7 `GitHubTool` (MCP) : simulation vs réel

### Symptôme
- L'utilisateur pense que le GitHubTool effectue des actions réelles sur GitHub.
- En réalité, c'est une simulation.

### Cause
- `executeGitHubAction` dans `lib/mcp/tools/development/github.ts` simule les réponses.

### Fichiers concernés
- `lib/mcp/tools/development/github.ts`

### Correction minimale (Option A — clarifier)

Ajouter un avertissement dans la réponse :

```typescript
private async executeGitHubAction(args: any, config: any): Promise<any> {
  // Ajouter un flag dans la réponse
  const result = await this.simulateAction(args);
  return {
    ...result,
    _simulation: true,
    _warning: 'This is a simulated response. Real GitHub API integration requires GITHUB_TOKEN.'
  };
}
```

### Correction minimale (Option B — implémenter réellement)

Utiliser `@octokit/rest` (déjà dans `package.json`) :

```typescript
import { Octokit } from '@octokit/rest';

private async executeGitHubAction(args: any, config: any): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required for real GitHub API calls');
  }

  const octokit = new Octokit({ auth: token });

  switch (args.action) {
    case 'issues':
      const { data: issues } = await octokit.issues.listForRepo({
        owner: args.owner,
        repo: args.repo,
        state: args.state || 'open'
      });
      return { issues };
    // ... autres actions
  }
}
```

### Vérification
```bash
curl -X POST http://localhost:3000/api/v1/mcp/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: mcp-default-key-12345" \
  -d '{"toolId":"github","args":{"action":"issues","owner":"facebook","repo":"react"}}'
# Vérifier la présence de _simulation ou de vraies données
```

---

# ANNEXE B — Tests de non-régression

## B.1 Test unitaire : `DownloadManagerService`

Fichier : `__tests__/download-manager.service.test.ts`

Ajouter :

```typescript
describe('downloadFromGitHub security', () => {
  it('should reject invalid owner names', async () => {
    const task = {
      type: 'github' as const,
      source: { owner: 'facebook; rm -rf /', repository: 'react' },
      // ...
    };

    await expect(service.createDownloadTask(task)).rejects.toThrow('Invalid GitHub owner');
  });

  it('should reject invalid repository names', async () => {
    const task = {
      type: 'github' as const,
      source: { owner: 'facebook', repository: 'react && echo pwned' },
      // ...
    };

    await expect(service.createDownloadTask(task)).rejects.toThrow('Invalid GitHub');
  });
});
```

## B.2 Test d'intégration : API Downloads

Fichier : `__tests__/integration/downloads-api.integration.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';

describe('Downloads API', () => {
  it('POST /api/downloads should create a task', async () => {
    const res = await fetch('http://localhost:3000/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'github',
        source: { owner: 'facebook', repository: 'react' }
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.taskId).toBeDefined();
  });

  it('GET /api/downloads/[taskId] should return task status', async () => {
    // Créer une tâche d'abord
    const createRes = await fetch('http://localhost:3000/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'github',
        source: { owner: 'facebook', repository: 'react' }
      })
    });
    const { taskId } = await createRes.json();

    // Récupérer le status
    const statusRes = await fetch(`http://localhost:3000/api/downloads/${taskId}`);
    expect(statusRes.status).toBe(200);
    const statusData = await statusRes.json();
    expect(statusData.success).toBe(true);
    expect(statusData.task).toBeDefined();
  });
});
```

## B.3 Test MCP : validation des schemas

Fichier : `__tests__/mcp/validator.test.ts`

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { initializeMCP } from '../../lib/mcp/init';
import { validator } from '../../lib/mcp/core/validator';
import { registry } from '../../lib/mcp/tools';

describe('MCP Validator Integration', () => {
  beforeAll(async () => {
    await initializeMCP();
  });

  it('should have schemas registered for all tools', () => {
    const tools = registry.getAll();
    const schemas = validator.getAllSchemas();

    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas.length).toBe(tools.length);
  });

  it('should validate email tool arguments', async () => {
    const result = await validator.validate('email', {
      to: 'test@example.com',
      subject: 'Test',
      body: 'Test body'
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid email tool arguments', async () => {
    const result = await validator.validate('email', {
      to: 'invalid-email',
      subject: 'Test'
      // missing body
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
```

## B.4 Commandes de vérification rapide

```bash
# Lancer tous les tests
npm test

# Lancer uniquement les tests MCP
npm test -- --testPathPattern=mcp

# Lancer uniquement les tests download
npm test -- --testPathPattern=download

# Vérifier que les migrations sont à jour
npx prisma migrate status

# Vérifier que le build passe
npm run build
```

---

# ANNEXE C — Checklist de validation finale

- [ ] `app/api/downloads/route.ts` existe et répond à POST/GET
- [ ] `app/api/downloads/[taskId]/route.ts` existe et répond à GET/DELETE
- [ ] `npx prisma migrate status` ne montre pas de migrations en attente
- [ ] `npm test -- --testPathPattern=download` passe
- [ ] `npm test -- --testPathPattern=mcp` passe
- [ ] `/api/v1/mcp/tools` retourne une liste non vide
- [ ] `/api/v1/mcp/execute` avec un tool valide ne retourne pas "No validation schema found"
- [ ] Le dashboard permet de saisir une URL GitHub et affiche un taskId
- [ ] `git clone` fonctionne sur Windows (pas de dépendance à `find`)
- [ ] Aucune injection shell possible via owner/repository
