-- Migration: add_download_tables
-- Description: Creates tables for download task management (GitHub, NPM, Website downloads)
-- Date: 2026-01-24

-- Table for download tasks
CREATE TABLE IF NOT EXISTS download_tasks (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'github', 'npm', 'website', 'documentation'
    source JSONB NOT NULL, -- { owner?, repository?, packageName?, version?, url? }
    options JSONB NOT NULL DEFAULT '{}',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'downloading', 'completed', 'failed', 'retrying'
    progress JSONB NOT NULL DEFAULT '{"downloaded": 0, "total": 0, "percentage": 0, "currentFile": ""}',
    metadata JSONB NOT NULL DEFAULT '{"size": 0, "files": 0, "duration": 0}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0
);

-- Table for download results
CREATE TABLE IF NOT EXISTS download_results (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL REFERENCES download_tasks(id) ON DELETE CASCADE,
    success BOOLEAN NOT NULL,
    local_path TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    files JSONB NOT NULL DEFAULT '[]',
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_download_tasks_status ON download_tasks(status);
CREATE INDEX IF NOT EXISTS idx_download_tasks_type ON download_tasks(type);
CREATE INDEX IF NOT EXISTS idx_download_tasks_priority ON download_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_download_tasks_created_at ON download_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_results_task_id ON download_results(task_id);

-- Comments
COMMENT ON TABLE download_tasks IS 'Stores download task information for GitHub repos, NPM packages, and websites';
COMMENT ON TABLE download_results IS 'Stores results of completed download tasks including file metadata';
