#!/bin/bash

# 🚀 Script de test rapide de l'API MCP

API_BASE="http://localhost:3000/api/v1/mcp"
API_KEY="mcp-default-key-12345"

echo "🚀 Test de l'API MCP..."
echo "📍 Base URL: $API_BASE"
echo "🔑 API Key: $API_KEY"
echo ""

# 1. Health Check
echo "🔍 1. Health Check"
curl -s "$API_BASE/health" | jq '.status'
echo ""

# 2. Liste des outils
echo "📋 2. Liste des outils disponibles"
curl -s -H "x-api-key: $API_KEY" "$API_BASE/tools" | jq '.totalCount'
echo ""

# 3. Détails d'un outil
echo "🔧 3. Détails de l'outil Email"
curl -s -H "x-api-key: $API_KEY" "$API_BASE/tools" | jq '.tools[] | select(.id=="email") | {name, description, capabilities}'
echo ""

# 4. Exécuter un outil (Email)
echo "📧 4. Test d'envoi d'email"
curl -s -X POST "$API_BASE/execute" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "toolId": "email",
    "args": {
      "to": "test@example.com",
      "subject": "Test MCP API",
      "body": "Email envoyé via l API MCP!"
    }
  }' | jq '.success'
echo ""

# 5. Test avec cache
echo "💾 5. Test du cache (2ème appel identique)"
curl -s -X POST "$API_BASE/execute" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "toolId": "email",
    "args": {
      "to": "test@example.com",
      "subject": "Test MCP API",
      "body": "Email envoyé via l API MCP!"
    }
  }' | jq '.metadata.cacheHit'
echo ""

# 6. Test async
echo "⚡ 6. Test d'exécution asynchrone"
curl -s -X POST "$API_BASE/execute" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "toolId": "github",
    "args": {
      "owner": "octocat",
      "repo": "Hello-World",
      "action": "issues"
    },
    "async": true
  }' | jq '.jobId'
echo ""

# 7. Métriques
echo "📊 7. Métriques système"
curl -s -H "x-api-key: $API_KEY" "$API_BASE/metrics?period=day" | jq '.systemStats.totalExecutions'
echo ""

# 8. Documentation
echo "📚 8. Génération de documentation"
curl -s "$API_BASE/docs?format=markdown" | head -5
echo "... (documentation complète générée)"
echo ""

echo "✅ Tests terminés !"
echo ""
echo "📖 Consultez la documentation complète :"
echo "   - README-MCP.md"
echo "   - README-IMPLEMENTATION.md"
echo "   - README-SUCCESS.md"
echo ""
echo "🧪 Lancez les tests complets : npm test"
echo "📊 Vérifiez la couverture : npm run test:coverage"
