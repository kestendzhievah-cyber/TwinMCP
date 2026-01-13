"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearchService = exports.QueryDocsInputSchema = void 0;
const zod_1 = require("zod");
// Types pour la recherche de documentation
exports.QueryDocsInputSchema = zod_1.z.object({
    library_id: zod_1.z.string()
        .min(1, "L'ID de bibliothèque est requis")
        .describe("Identifiant unique de la bibliothèque"),
    query: zod_1.z.string()
        .min(1, "La requête est requise")
        .max(1000, "La requête est trop longue")
        .describe("Question ou recherche sur la documentation"),
    version: zod_1.z.string()
        .optional()
        .describe("Version spécifique de la bibliothèque"),
    max_results: zod_1.z.number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Nombre maximum de résultats à retourner"),
    include_code: zod_1.z.boolean()
        .default(true)
        .describe("Inclure les snippets de code dans les résultats"),
    context_limit: zod_1.z.number()
        .int()
        .min(1000)
        .max(8000)
        .default(4000)
        .describe("Limite de tokens pour le contexte")
});
class VectorSearchService {
    db;
    redis;
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
    }
    async searchDocuments(input) {
        const startTime = Date.now();
        try {
            // Valider que la bibliothèque existe
            const library = await this.db.library.findUnique({
                where: { id: input.library_id }
            });
            if (!library) {
                throw new Error(`Library '${input.library_id}' not found`);
            }
            // Pour l'instant, simulation de recherche vectorielle
            // Dans une vraie implémentation, il faudrait intégrer OpenAI embeddings et Pinecone/Qdrant
            const documents = await this.mockVectorSearch(input, library);
            if (documents.length === 0) {
                return {
                    library: {
                        id: library.id,
                        name: library.name,
                        version: input.version || library.defaultVersion || 'latest',
                        description: library.description || ''
                    },
                    query: input.query,
                    results: [],
                    context: '',
                    totalTokens: 0,
                    truncated: false
                };
            }
            // Assembler le contexte
            const assembled = this.assembleContext(documents, input.query, input.context_limit);
            return {
                library: {
                    id: library.id,
                    name: library.name,
                    version: input.version || library.defaultVersion || 'latest',
                    description: library.description || ''
                },
                query: input.query,
                results: assembled.results,
                context: assembled.context,
                totalTokens: assembled.totalTokens,
                truncated: assembled.truncated
            };
        }
        catch (error) {
            throw new Error(`Document search failed: ${error.message}`);
        }
    }
    async mockVectorSearch(input, library) {
        // Simulation de recherche vectorielle
        // Dans une vraie implémentation, il faudrait :
        // 1. Générer l'embedding de la query avec OpenAI
        // 2. Rechercher dans Pinecone/Qdrant
        // 3. Récupérer les documents correspondants
        const mockResults = [
            {
                content: `# ${library.name} Documentation\n\nThis is a sample documentation entry for ${library.name}.`,
                metadata: {
                    source: `${library.name}-docs`,
                    url: `https://docs.${library.name}.com`,
                    section: 'Getting Started',
                    type: 'text',
                    relevanceScore: 0.95
                }
            },
            {
                content: `## Installation\n\n\`\`\`bash\nnpm install ${library.name}\`\`\``,
                metadata: {
                    source: `${library.name}-docs`,
                    url: `https://docs.${library.name}.com/installation`,
                    section: 'Installation',
                    type: 'code',
                    relevanceScore: 0.88
                }
            },
            {
                content: `## Basic Usage\n\nHere's how to use ${library.name} in your project:\n\n\`\`\`javascript\nimport ${library.name} from '${library.name}';\n\nconst instance = new ${library.name}();\ninstance.doSomething();\n\`\`\``,
                metadata: {
                    source: `${library.name}-docs`,
                    url: `https://docs.${library.name}.com/usage`,
                    section: 'Usage',
                    type: 'example',
                    relevanceScore: 0.82
                }
            }
        ];
        // Filtrer par type si nécessaire
        let filteredResults = mockResults;
        if (!input.include_code) {
            filteredResults = mockResults.filter(doc => doc.metadata.type === 'text');
        }
        return filteredResults.slice(0, input.max_results);
    }
    assembleContext(documents, query, maxTokens = 4000) {
        let context = `# Documentation Query Results\n\n`;
        context += `**Query**: ${query}\n\n`;
        // Estimation simple de tokens (1 token ≈ 4 caractères)
        let currentTokens = Math.ceil(context.length / 4);
        const results = [];
        for (const doc of documents) {
            const section = this.formatDocumentSection(doc);
            const sectionTokens = Math.ceil(section.length / 4);
            if (currentTokens + sectionTokens > maxTokens) {
                break;
            }
            context += section;
            currentTokens += sectionTokens;
            results.push(doc);
        }
        return {
            context,
            results,
            totalTokens: currentTokens,
            truncated: results.length < documents.length
        };
    }
    formatDocumentSection(doc) {
        const meta = doc.metadata;
        let section = '';
        if (meta.type === 'code') {
            section += `## Code Example\n`;
        }
        else if (meta.type === 'example') {
            section += `## Example\n`;
        }
        else {
            section += `## ${meta.section || 'Documentation'}\n`;
        }
        section += `**Source**: ${meta.url}\n`;
        section += `**Relevance**: ${(meta.relevanceScore * 100).toFixed(1)}%\n\n`;
        section += `${doc.content}\n\n`;
        section += `---\n\n`;
        return section;
    }
    // Méthodes pour l'implémentation réelle avec vector store
    async generateEmbedding(text) {
        // TODO: Implémenter avec OpenAI API
        // const response = await openai.embeddings.create({
        //   model: "text-embedding-3-small",
        //   input: text
        // })
        // return response.data[0].embedding
        // Simulation pour l'instant
        return new Array(1536).fill(0).map(() => Math.random());
    }
    async searchInVectorStore(embedding, options) {
        // TODO: Implémenter avec Pinecone ou Qdrant
        // const results = await pineconeIndex.query({
        //   vector: embedding,
        //   topK: options.maxResults,
        //   filter: options.filter,
        //   includeMetadata: true
        // })
        // Retourner les résultats pour l'instant
        return [];
    }
}
exports.VectorSearchService = VectorSearchService;
//# sourceMappingURL=vector-search.service.js.map