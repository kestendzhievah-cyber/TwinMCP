# Serveur MCP (Model Context Protocol)

Ce projet implémente un serveur MCP compatible avec Next.js et déployable sur Vercel.

## Architecture

Le serveur MCP est implémenté comme des API routes Next.js dans `/app/api/mcp-server/` et utilise le SDK MCP officiel (`@modelcontextprotocol/sdk`).

## Structure des fichiers

```
/app/api/mcp-server/route.ts          # Endpoint principal du serveur MCP
/app/api/mcp/tools/route.ts           # Liste des outils disponibles (legacy)
/app/api/mcp/call/route.ts            # Exécution des outils (legacy)
/app/api/mcp/initialize/route.ts      # Initialisation du serveur (legacy)
/lib/mcp-tools.ts                     # Configuration centralisée des outils
```

## Endpoints

### Endpoint Principal : `/api/mcp-server`

**GET** - Informations du serveur
```bash
curl http://localhost:3000/api/mcp-server
```

**POST** - Exécuter des méthodes MCP
```bash
curl -X POST http://localhost:3000/api/mcp-server \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list"
  }'
```

**POST** - Appeler un outil
```bash
curl -X POST http://localhost:3000/api/mcp-server \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "send_email",
      "arguments": {
        "to": "user@example.com",
        "subject": "Test",
        "body": "Hello World"
      }
    }
  }'
```

## Outils Disponibles

1. **send_email** - Envoyer un email via Gmail
2. **read_calendar** - Lire les événements Google Calendar
3. **create_notion_page** - Créer une page Notion
4. **firebase_read** - Lire des données Firebase
5. **firebase_write** - Écrire des données Firebase

## Méthodes MCP Supportées

- `initialize` - Initialiser le serveur MCP
- `tools/list` - Lister les outils disponibles
- `tools/call` - Appeler un outil spécifique

## Configuration

### tsconfig.json
Le serveur MCP est exclu du build Next.js :
```json
{
  "exclude": ["mcp-server-demo"]
}
```

### Variables d'environnement
Les outils nécessitent des configurations API (Gmail, Notion, Firebase, etc.) via les variables d'environnement.

## Utilisation

### Développement local
```bash
npm run dev
```

Le serveur MCP sera disponible sur `http://localhost:3000/api/mcp-server`

### Déploiement Vercel
L'implémentation est entièrement compatible avec Vercel et Next.js - pas besoin de serveur Express séparé.

## Migration depuis l'ancienne structure

Les anciens endpoints dans `/app/api/mcp/` sont maintenus pour la compatibilité mais utilisent maintenant la configuration centralisée dans `/lib/mcp-tools.ts`.

## Avantages de cette approche

✅ **Compatible Vercel** - Pas de serveur Express nécessaire
✅ **SDK MCP officiel** - Utilise `@modelcontextprotocol/sdk`
✅ **Configuration centralisée** - Pas de duplication de code
✅ **TypeScript natif** - Entièrement typé
✅ **Performance** - API routes Next.js optimisées

## Exemple d'utilisation client

```typescript
// Lister les outils
const response = await fetch('/api/mcp-server', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ method: 'tools/list' })
});

// Appeler un outil
const response = await fetch('/api/mcp-server', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'send_email',
      arguments: {
        to: 'user@example.com',
        subject: 'Hello',
        body: 'World!'
      }
    }
  })
});
```
