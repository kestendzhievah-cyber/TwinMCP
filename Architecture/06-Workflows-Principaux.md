# Workflows principaux

## Workflow 1 : Résolution de bibliothèque

**Acteurs** : IDE/LLM, TwinMCP Server, Library Resolution Engine

**Étapes** :

1. **Client envoie une requête MCP**
   ```json
   {
     "tool": "resolve-library-id",
     "params": {
       "query": "How do I set up MongoDB authentication?",
       "libraryName": "MongoDB"
     }
   }
   ```

2. **TwinMCP Server valide l'API key** (si remote) ou passe directement (si stdio)

3. **Appel au Library Resolution Engine**
   - Hash de la query pour vérifier le cache Redis
   - Si cache hit → retour immédiat
   - Sinon → recherche dans PostgreSQL (full-text search sur `libraries.name`)

4. **Scoring et sélection**
   - Calcul de similarité (Levenshtein + popularité)
   - Retour du meilleur match

5. **Réponse au client**
   ```json
   {
     "libraryId": "/mongodb/docs",
     "name": "MongoDB Official Documentation",
     "repoUrl": "https://github.com/mongodb/docs",
     "defaultVersion": "7.0",
     "confidence": 0.95
   }
   ```

---

## Workflow 2 : Interrogation de documentation

**Acteurs** : IDE/LLM, TwinMCP Server, Documentation Query Engine

**Étapes** :

1. **Client envoie une requête MCP**
   ```json
   {
     "tool": "query-docs",
     "params": {
       "libraryId": "/mongodb/docs",
       "query": "Show me an example of connection pooling"
     }
   }
   ```

2. **Vérification des quotas** (rate limiting via Redis)

3. **Génération de l'embedding de la query**
   - Appel à OpenAI API ou modèle local

4. **Recherche vectorielle**
   - K-NN dans Pinecone/Qdrant (top 10 chunks)
   - Filtrage par `library_id` et `version`

5. **Reranking** (optionnel)
   - Cross-encoder pour affiner l'ordre

6. **Assemblage du contexte**
   - Concaténation des chunks avec métadonnées
   - Limitation à ~4000 tokens pour le LLM

7. **Réponse au client**
   ```json
   {
     "content": "Here's how to configure MongoDB connection pooling:\n\n```javascript\n...\n```\n\nSee: https://mongodb.com/docs/...",
     "snippets": [
       {
         "text": "...",
         "sourceUrl": "...",
         "relevanceScore": 0.89
       }
     ]
   }
   ```

---

## Workflow 3 : Crawling d'une nouvelle bibliothèque

**Acteurs** : Admin, Crawling Service, Parsing Service

**Étapes** :

1. **Ajout d'une bibliothèque au catalogue** (dashboard ou API)
   ```sql
   INSERT INTO libraries (id, name, repo_url, docs_url)
   VALUES ('/vercel/next.js', 'Next.js', 'https://github.com/vercel/next.js', 'https://nextjs.org/docs');
   ```

2. **Déclenchement du job de crawling** (BullMQ)
   ```typescript
   await crawlQueue.add('crawl:library', { libraryId: '/vercel/next.js' });
   ```

3. **Téléchargement des sources**
   - Clonage Git shallow ou fetch via GitHub API
   - Téléchargement de la doc officielle (scraping si nécessaire)

4. **Stockage brut dans S3**
   - Path: `s3://twinmcp-docs/vercel/next.js/14.0/raw/`

5. **Déclenchement du job de parsing**
   ```typescript
   await parseQueue.add('parse:library', { libraryId: '/vercel/next.js', version: '14.0' });
   ```

6. **Parsing et chunking**
   - Extraction du Markdown structuré
   - Découpage en chunks sémantiques

7. **Génération d'embeddings**
   - Batch processing via OpenAI API

8. **Insertion dans vector store et PostgreSQL**
   ```sql
   INSERT INTO documentation_chunks (library_version_id, content, embedding_id, ...)
   VALUES (...);
   ```

9. **Mise à jour des métadonnées**
   ```sql
   UPDATE libraries SET last_crawled_at = NOW(), total_snippets = 1234 WHERE id = '/vercel/next.js';
   ```

---

## Workflow 4 : Authentification OAuth 2.0

**Acteurs** : Utilisateur, IDE (Cursor/Claude Code), API Gateway, Auth Service

**Étapes** :

1. **Utilisateur configure MCP remote avec OAuth** dans l'IDE

2. **IDE déclenche le flow OAuth**
   - Ouverture du navigateur vers `https://api.twinmcp.com/auth/oauth/authorize?client_id=...&redirect_uri=...`

3. **Utilisateur se connecte** (ou s'inscrit) sur le dashboard TwinMCP

4. **Autorisation accordée**
   - Redirection vers `redirect_uri` avec `code`

5. **IDE échange le code contre un token**
   ```http
   POST /auth/oauth/token
   {
     "grant_type": "authorization_code",
     "code": "abc123",
     "client_id": "...",
     "client_secret": "..."
   }
   ```

6. **Auth Service retourne un access token**
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refresh_token": "...",
     "expires_in": 3600
   }
   ```

7. **IDE stocke le token** et l'utilise dans les headers pour les appels MCP
   ```http
   POST /mcp/oauth
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
