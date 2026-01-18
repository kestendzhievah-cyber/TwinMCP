-- Migration pour le système de gestion des conversations
-- Créée le: 2025-01-13
-- Description: Ajout des tables pour la gestion complète des conversations

-- Table principale des conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    analytics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes pour la performance
    CONSTRAINT fk_conversations_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_messages_conversation 
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Table des réactions aux messages
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    emoji VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_message_reactions_message 
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_reactions_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Un utilisateur ne peut réagir qu'une fois par message/emoji
    UNIQUE(message_id, user_id, emoji)
);

-- Table des pièces jointes aux messages
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('image', 'file', 'code', 'link', 'audio', 'video')),
    name VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    size BIGINT,
    mime_type VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    thumbnail TEXT,
    
    CONSTRAINT fk_message_attachments_message 
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Table des partages de conversations
CREATE TABLE IF NOT EXISTS conversation_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    share_id VARCHAR(255) UNIQUE NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    permissions JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    analytics JSONB NOT NULL DEFAULT '{}',
    
    CONSTRAINT fk_conversation_shares_conversation 
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversation_shares_creator 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des exports de conversations
CREATE TABLE IF NOT EXISTS conversation_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    format VARCHAR(50) NOT NULL CHECK (format IN ('json', 'markdown', 'pdf', 'html', 'csv')),
    options JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    
    CONSTRAINT fk_conversation_exports_conversation 
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes pour optimiser les performances

-- Indexes sur les conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_metadata_gin ON conversations USING GIN(metadata);

-- Indexes sur les messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- Indexes de recherche plein texte
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages USING GIN(to_tsvector('french', content));
CREATE INDEX IF NOT EXISTS idx_conversations_title_fts ON conversations USING GIN(to_tsvector('french', title));

-- Indexes sur les réactions
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Indexes sur les pièces jointes
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_type ON message_attachments(type);

-- Indexes sur les partages
CREATE INDEX IF NOT EXISTS idx_conversation_shares_share_id ON conversation_shares(share_id);
CREATE INDEX IF NOT EXISTS idx_conversation_shares_conversation_id ON conversation_shares(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_shares_expires_at ON conversation_shares(expires_at);

-- Indexes sur les exports
CREATE INDEX IF NOT EXISTS idx_conversation_exports_conversation_id ON conversation_exports(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_exports_status ON conversation_exports(status);
CREATE INDEX IF NOT EXISTS idx_conversation_exports_expires_at ON conversation_exports(expires_at);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversations_updated_at();

-- Trigger pour maintenir les compteurs dans les métadonnées
CREATE OR REPLACE FUNCTION update_conversation_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Nouveau message: mise à jour des compteurs
        UPDATE conversations 
        SET 
            metadata = metadata || jsonb_build_object(
                'messageCount', (metadata->>'messageCount')::int + 1,
                'totalTokens', COALESCE((metadata->>'totalTokens')::int, 0) + COALESCE((NEW.metadata->>'tokens')::int, 0),
                'totalCost', COALESCE((metadata->>'totalCost')::float, 0) + COALESCE((NEW.metadata->>'cost')::float, 0),
                'lastMessageAt', NEW.timestamp,
                'updatedAt', NOW()
            )
        WHERE id = NEW.conversation_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Message mis à jour: recalculer les compteurs si nécessaire
        IF OLD.metadata IS DISTINCT FROM NEW.metadata THEN
            UPDATE conversations 
            SET 
                metadata = metadata || jsonb_build_object(
                    'totalTokens', COALESCE((metadata->>'totalTokens')::int, 0) - COALESCE((OLD.metadata->>'tokens')::int, 0) + COALESCE((NEW.metadata->>'tokens')::int, 0),
                    'totalCost', COALESCE((metadata->>'totalCost')::float, 0) - COALESCE((OLD.metadata->>'cost')::float, 0) + COALESCE((NEW.metadata->>'cost')::float, 0),
                    'updatedAt', NOW()
                )
            WHERE id = NEW.conversation_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Message supprimé: décrémenter les compteurs
        UPDATE conversations 
        SET 
            metadata = metadata || jsonb_build_object(
                'messageCount', GREATEST((metadata->>'messageCount')::int - 1, 0),
                'totalTokens', GREATEST(COALESCE((metadata->>'totalTokens')::int, 0) - COALESCE((OLD.metadata->>'tokens')::int, 0), 0),
                'totalCost', GREATEST(COALESCE((metadata->>'totalCost')::float, 0) - COALESCE((OLD.metadata->>'cost')::float, 0), 0),
                'updatedAt', NOW()
            )
        WHERE id = OLD.conversation_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_conversation_metadata
    AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_metadata();

-- Vue pour les statistiques des conversations
CREATE OR REPLACE VIEW conversation_stats AS
SELECT 
    c.id,
    c.title,
    c.user_id,
    COUNT(m.id) as message_count,
    SUM((m.metadata->>'tokens')::int) as total_tokens,
    SUM((m.metadata->>'cost')::float) as total_cost,
    MIN(m.timestamp) as first_message_at,
    MAX(m.timestamp) as last_message_at,
    c.created_at,
    c.updated_at
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id, c.title, c.user_id, c.created_at, c.updated_at;

-- Fonction de recherche plein texte améliorée
CREATE OR REPLACE FUNCTION search_conversations(
    search_user_id VARCHAR(255),
    search_query TEXT DEFAULT '',
    search_filters JSONB DEFAULT '{}',
    search_sort VARCHAR(50) DEFAULT 'updated_at',
    search_order VARCHAR(10) DEFAULT 'DESC',
    search_limit INT DEFAULT 20,
    search_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    user_id VARCHAR(255),
    metadata JSONB,
    settings JSONB,
    analytics JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    relevance_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.user_id,
        c.metadata,
        c.settings,
        c.analytics,
        c.created_at,
        c.updated_at,
        CASE 
            WHEN search_query != '' THEN 
                ts_rank(
                    to_tsvector('french', c.title || ' ' || COALESCE(string_agg(m.content, ' '), '')),
                    plainto_tsquery('french', search_query)
                )
            ELSE 1.0
        END as relevance_score
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = search_user_id
        AND (
            search_query = '' OR
            to_tsvector('french', c.title || ' ' || COALESCE(string_agg(m.content, ' '), '')) 
            @@ plainto_tsquery('french', search_query)
        )
        AND (
            search_filters IS NULL OR
            (
                -- Filtre sur les providers
                (NOT (search_filters ? 'providers') OR c.metadata->>'provider' = ANY((search_filters->>'providers')::TEXT[]))
                AND
                -- Filtre sur les tags
                (NOT (search_filters ? 'tags') OR c.metadata->'tags' ?| (search_filters->>'tags')::TEXT[])
                AND
                -- Filtre sur le statut épinglé
                (NOT (search_filters ? 'isPinned') OR (c.metadata->>'isPinned')::BOOLEAN = (search_filters->>'isPinned')::BOOLEAN)
                AND
                -- Filtre sur le statut archivé
                (NOT (search_filters ? 'isArchived') OR (c.metadata->>'isArchived')::BOOLEAN = (search_filters->>'isArchived')::BOOLEAN)
            )
        )
    GROUP BY c.id, c.title, c.user_id, c.metadata, c.settings, c.analytics, c.created_at, c.updated_at
    ORDER BY 
        CASE 
            WHEN search_query != '' THEN 
                ts_rank(
                    to_tsvector('french', c.title || ' ' || COALESCE(string_agg(m.content, ' '), '')),
                    plainto_tsquery('french', search_query)
                )
            ELSE 1.0
        END DESC,
        CASE 
            WHEN search_sort = 'created_at' THEN c.created_at
            WHEN search_sort = 'updated_at' THEN c.updated_at
            WHEN search_sort = 'lastMessageAt' THEN (c.metadata->>'lastMessageAt')::TIMESTAMP WITH TIME ZONE
            WHEN search_sort = 'messageCount' THEN (c.metadata->>'messageCount')::INT
            WHEN search_sort = 'totalCost' THEN (c.metadata->>'totalCost')::FLOAT
            ELSE c.updated_at
        END ${search_order}
    LIMIT search_limit
    OFFSET search_offset;
END;
$$ LANGUAGE plpgsql;

-- Commentaires sur les tables
COMMENT ON TABLE conversations IS 'Table principale des conversations utilisateur';
COMMENT ON TABLE messages IS 'Messages individuels dans les conversations';
COMMENT ON TABLE message_reactions IS 'Réactions des utilisateurs aux messages';
COMMENT ON TABLE message_attachments IS 'Pièces jointes aux messages';
COMMENT ON TABLE conversation_shares IS 'Partages publics de conversations';
COMMENT ON TABLE conversation_exports IS 'Exports de conversations dans différents formats';
