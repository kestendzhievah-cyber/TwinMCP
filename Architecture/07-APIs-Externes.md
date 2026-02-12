# APIs externes

## 1. GitHub API (Octokit)

**Usage** : Monitoring des releases, récupération du code source

**Endpoints utilisés** :
- `GET /repos/{owner}/{repo}/releases` : Liste des releases
- `GET /repos/{owner}/{repo}/git/trees/{sha}` : Arborescence du repo
- `GET /repos/{owner}/{repo}/contents/{path}` : Contenu d'un fichier

**Rate limits** :
- 5000 requêtes/heure (authentifié)
- Gestion du `X-RateLimit-Remaining` header

**Gestion d'erreurs** :
- Retry avec backoff exponentiel
- Fallback sur cache si quota épuisé

---

## 2. OpenAI API

**Usage** : Génération d'embeddings

**Modèle** : `text-embedding-3-small` (1536 dimensions)

**Coût** : $0.02 / 1M tokens

**Optimisations** :
- Batch requests (jusqu'à 2048 inputs)
- Cache des embeddings pour queries fréquentes

**Alternatives** :
- Sentence-Transformers (open-source, hébergé)
- Cohere Embed API

---

## 3. Pinecone / Qdrant API

**Usage** : Stockage et recherche vectorielle

**Opérations** :
- `POST /vectors/upsert` : Insertion de vecteurs
- `POST /query` : Recherche K-NN
- `DELETE /vectors` : Suppression

**Configuration** :
- Index dimension: 1536
- Metric: cosine similarity
- Pods: 1x p1 (MVP), scale selon usage
