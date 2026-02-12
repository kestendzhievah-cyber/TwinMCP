-- Migration: Add indexation schema for document processing
-- Created: 2025-01-13
-- Description: Tables for document indexing, chunking, and embedding storage

-- Table for indexing tasks
CREATE TABLE IF NOT EXISTS indexing_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id VARCHAR(255) NOT NULL,
    source_path TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress JSONB NOT NULL DEFAULT '{}',
    config JSONB NOT NULL DEFAULT '{}',
    results JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT
);

-- Table for parsed documents
CREATE TABLE IF NOT EXISTS parsed_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id VARCHAR(255) NOT NULL,
    source_path TEXT NOT NULL,
    title TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    format VARCHAR(50) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    content TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for document chunks
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES parsed_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    position JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    context JSONB NOT NULL DEFAULT '{}',
    embedding VECTOR(1536), -- Adjust size based on embedding model
    embedding_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for document sections (hierarchical structure)
CREATE TABLE IF NOT EXISTS document_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES parsed_documents(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL,
    parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for code blocks
CREATE TABLE IF NOT EXISTS code_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES parsed_documents(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    explanation TEXT,
    context TEXT NOT NULL,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for document links
CREATE TABLE IF NOT EXISTS document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES parsed_documents(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    target TEXT,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_indexing_tasks_library_id ON indexing_tasks(library_id);
CREATE INDEX IF NOT EXISTS idx_indexing_tasks_status ON indexing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_indexing_tasks_created_at ON indexing_tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_parsed_documents_library_id ON parsed_documents(library_id);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_type ON parsed_documents(type);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_format ON parsed_documents(format);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_created_at ON parsed_documents(created_at);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_type ON document_chunks(type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_created_at ON document_chunks(created_at);

-- Vector index for similarity search (requires pgvector extension)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_document_sections_document_id ON document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_parent_id ON document_sections(parent_section_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_level ON document_sections(level);

CREATE INDEX IF NOT EXISTS idx_code_blocks_document_id ON code_blocks(document_id);
CREATE INDEX IF NOT EXISTS idx_code_blocks_language ON code_blocks(language);

CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_type ON document_links(type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.processed_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_parsed_documents_updated_at 
    BEFORE UPDATE ON parsed_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;
