# MCP Server API Routes

Cette implémentation transforme le serveur MCP standalone en API routes Next.js pour le déploiement sur Vercel.

## Endpoints disponibles

### 1. Initialisation du serveur
```
GET /api/mcp/initialize?clientName=AxeWash
POST /api/mcp/initialize
```
Initialise le serveur MCP avec la configuration du client.

### 2. Liste des outils disponibles
```
GET /api/mcp/tools
```
Retourne la liste de tous les outils MCP disponibles.

### 3. Exécution d'un outil
```
POST /api/mcp/call
Content-Type: application/json

{
  "name": "send_email",
  "arguments": {
    "to": "client@example.com",
    "subject": "Test",
    "body": "Hello World"
  }
}
```
Exécute un outil MCP spécifique avec ses paramètres.

## Outils disponibles

- **send_email**: Envoi d'email via Gmail
- **read_calendar**: Lecture des événements Google Calendar
- **create_notion_page**: Création de page Notion
- **firebase_read**: Lecture de données Firebase
- **firebase_write**: Écriture de données Firebase

## Migration depuis le serveur standalone

Le serveur MCP original (mcp-server-demo/src/index.ts) a été migré vers ces API routes HTTP pour :
- ✅ Compatibilité avec Vercel
- ✅ Facilité d'intégration avec le frontend
- ✅ Sécurité (pas de code serveur standalone)
- ✅ Monitoring et logging intégrés

## Utilisation

```typescript
// Exemple d'utilisation côté client
const response = await fetch('/api/mcp/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'send_email',
    arguments: {
      to: 'user@example.com',
      subject: 'Welcome!',
      body: 'Hello from AgentFlow'
    }
  })
});

const result = await response.json();
console.log(result);
```
