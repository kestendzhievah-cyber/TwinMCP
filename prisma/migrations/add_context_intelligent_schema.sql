-- Migration pour le contexte intelligent
-- Création des tables pour le système de contexte intelligent

-- Table des sources de contexte
CREATE TABLE IF NOT EXISTS context_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('documentation', 'code', 'example', 'api', 'tutorial')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    library_id VARCHAR(255),
    version VARCHAR(50),
    language VARCHAR(50) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    relevance_score DECIMAL(3,2) DEFAULT 0.0 CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
    freshness DECIMAL(3,2) DEFAULT 0.0 CHECK (freshness >= 0.0 AND freshness <= 1.0),
    popularity DECIMAL(3,2) DEFAULT 0.0 CHECK (popularity >= 0.0 AND popularity <= 1.0),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des chunks de contexte
CREATE TABLE IF NOT EXISTS context_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES context_sources(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    position_start INTEGER NOT NULL DEFAULT 0,
    position_end INTEGER NOT NULL DEFAULT 0,
    position_index INTEGER NOT NULL DEFAULT 0,
    position_total INTEGER NOT NULL DEFAULT 1,
    section_title TEXT,
    code_blocks INTEGER DEFAULT 0,
    links INTEGER DEFAULT 0,
    images INTEGER DEFAULT 0,
    complexity VARCHAR(20) DEFAULT 'medium' CHECK (complexity IN ('low', 'medium', 'high')),
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des requêtes de contexte
CREATE TABLE IF NOT EXISTS context_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    query_text TEXT NOT NULL,
    intent_type VARCHAR(50) CHECK (intent_type IN ('question', 'explanation', 'example', 'troubleshooting', 'comparison', 'tutorial')),
    intent_confidence DECIMAL(3,2) CHECK (intent_confidence >= 0.0 AND intent_confidence <= 1.0),
    intent_keywords TEXT[] DEFAULT '{}',
    intent_category VARCHAR(100),
    intent_subcategory VARCHAR(100),
    entities JSONB DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des résultats de contexte
CREATE TABLE IF NOT EXISTS context_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES context_queries(id) ON DELETE CASCADE,
    sources JSONB NOT NULL DEFAULT '[]',
    chunks JSONB NOT NULL DEFAULT '[]',
    summary TEXT,
    total_sources INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    query_time INTEGER DEFAULT 0, -- en millisecondes
    relevance_score DECIMAL(3,2) DEFAULT 0.0 CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
    coverage DECIMAL(3,2) DEFAULT 0.0 CHECK (coverage >= 0.0 AND coverage <= 1.0),
    freshness DECIMAL(3,2) DEFAULT 0.0 CHECK (freshness >= 0.0 AND freshness <= 1.0),
    suggestions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des injections de contexte
CREATE TABLE IF NOT EXISTS context_injections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    context JSONB NOT NULL,
    template_id VARCHAR(255),
    injected_prompt TEXT NOT NULL,
    original_length INTEGER DEFAULT 0,
    injected_length INTEGER DEFAULT 0,
    compression_ratio DECIMAL(5,4) DEFAULT 0.0,
    relevance_score DECIMAL(3,2) DEFAULT 0.0 CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des templates de contexte
CREATE TABLE IF NOT EXISTS context_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('general_context', 'code_context', 'api_context', 'example_context', 'tutorial_context')),
    template TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    description TEXT,
    version VARCHAR(50) DEFAULT '1.0.0',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des analytics des requêtes de contexte
CREATE TABLE IF NOT EXISTS context_query_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES context_queries(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) NOT NULL,
    query_text TEXT NOT NULL,
    intent JSONB NOT NULL,
    entities JSONB DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}',
    result_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table du cache de contexte
CREATE TABLE IF NOT EXISTS context_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    result JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_context_sources_type ON context_sources(type);
CREATE INDEX IF NOT EXISTS idx_context_sources_library_id ON context_sources(library_id);
CREATE INDEX IF NOT EXISTS idx_context_sources_language ON context_sources(language);
CREATE INDEX IF NOT EXISTS idx_context_sources_tags ON context_sources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_context_sources_relevance ON context_sources(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_context_sources_last_updated ON context_sources(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_context_chunks_source_id ON context_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_context_chunks_complexity ON context_chunks(complexity);
CREATE INDEX IF NOT EXISTS idx_context_chunks_embedding ON context_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_context_queries_conversation_id ON context_queries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_context_queries_created_at ON context_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_queries_intent_type ON context_queries(intent_type);

CREATE INDEX IF NOT EXISTS idx_context_results_query_id ON context_results(query_id);
CREATE INDEX IF NOT EXISTS idx_context_results_relevance_score ON context_results(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_context_results_created_at ON context_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_injections_conversation_id ON context_injections(conversation_id);
CREATE INDEX IF NOT EXISTS idx_context_injections_created_at ON context_injections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_templates_type ON context_templates(type);
CREATE INDEX IF NOT EXISTS idx_context_templates_usage_count ON context_templates(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_context_query_analytics_conversation_id ON context_query_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_context_query_analytics_created_at ON context_query_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_cache_cache_key ON context_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_context_cache_expires_at ON context_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_context_cache_last_accessed ON context_cache(last_accessed DESC);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application des triggers
CREATE TRIGGER update_context_sources_updated_at BEFORE UPDATE ON context_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_chunks_updated_at BEFORE UPDATE ON context_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_templates_updated_at BEFORE UPDATE ON context_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion des templates par défaut
INSERT INTO context_templates (name, type, template, variables, description) VALUES
('Contexte Général', 'general_context', 
'Contexte pertinent pour votre question:

{{summary}}

Sources principales:
{{#each sources}}
- {{title}} (Pertinence: {{metadata.relevanceScore}})
{{/each}}

Question originale: {{userMessage}}

Répondez en utilisant les informations ci-dessus.',
ARRAY['summary', 'sources', 'userMessage'],
'Template général pour les requêtes de contexte'),

('Contexte Code', 'code_context',
'Contexte de développement pour votre question:

{{summary}}

Extraits de code pertinents:
{{#each chunks}}
{{#if metadata.codeBlocks > 0}}
```{{metadata.language}}
{{content}}
```
{{/if}}
{{/each}}

Documentation associée:
{{#each sources}}
- {{title}}: {{url}}
{{/each}}

Question: {{userMessage}}

Fournissez une réponse technique avec des exemples de code si approprié.',
ARRAY['summary', 'chunks', 'sources', 'userMessage'],
'Template spécialisé pour les questions de code'),

('Contexte API', 'api_context',
'Documentation API pour votre requête:

{{summary}}

Références API:
{{#each sources}}
{{#if type="api"}}
**{{title}}**
{{content}}
{{url}}
{{/if}}
{{/each}}

Paramètres et exemples:
{{#each chunks}}
{{content}}
{{/each}}

Question: {{userMessage}}

Répondez avec des détails spécifiques sur l''utilisation de l''API.',
ARRAY['summary', 'sources', 'chunks', 'userMessage'],
'Template spécialisé pour la documentation API'),

('Contexte Exemples', 'example_context',
'Exemples pertinents pour votre demande:

{{summary}}

Exemples pratiques:
{{#each sources}}
{{#if type="example"}}
**{{title}}**
{{content}}
{{/if}}
{{/each}}

Extraits de code:
{{#each chunks}}
{{#if metadata.codeBlocks > 0}}
```
{{content}}
```
{{/if}}
{{/each}}

Question: {{userMessage}}

Fournissez des exemples concrets et expliqués.',
ARRAY['summary', 'sources', 'chunks', 'userMessage'],
'Template spécialisé pour les exemples d''utilisation'),

('Contexte Tutoriel', 'tutorial_context',
'Guide tutoriel pour votre apprentissage:

{{summary}}

Étapes recommandées:
{{#each sources}}
{{#if type="tutorial"}}
**{{title}}**
{{content}}
{{/if}}
{{/each}}

Instructions détaillées:
{{#each chunks}}
{{content}}
{{/each}}

Question: {{userMessage}}

Guidez l''utilisateur pas à pas avec des instructions claires.',
ARRAY['summary', 'sources', 'chunks', 'userMessage'],
'Template spécialisé pour les guides tutoriels')
ON CONFLICT (name) DO NOTHING;
