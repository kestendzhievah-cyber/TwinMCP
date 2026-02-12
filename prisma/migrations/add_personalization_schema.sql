-- Migration: Ajout du schéma de personnalisation
-- Description: Ajout des tables pour la gestion des préférences utilisateur, thèmes personnalisés et analytics

-- Table pour les préférences utilisateur
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    preferences JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_user_preferences_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Table pour les thèmes personnalisés
CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('built-in', 'custom', 'community')),
    colors JSONB NOT NULL,
    typography JSONB NOT NULL,
    spacing JSONB NOT NULL,
    shadows JSONB NOT NULL,
    border_radius JSONB NOT NULL,
    animations JSONB NOT NULL,
    custom BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_themes_creator 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Table pour les analytics de personnalisation
CREATE TABLE IF NOT EXISTS personalization_analytics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('theme_change', 'theme_created', 'theme_deleted', 'preference_update', 'preference_import')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_personalization_analytics_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_themes_category ON themes(category);
CREATE INDEX IF NOT EXISTS idx_themes_created_by ON themes(created_by);
CREATE INDEX IF NOT EXISTS idx_personalization_analytics_user_id ON personalization_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_personalization_analytics_action_type ON personalization_analytics(action_type);
CREATE INDEX IF NOT EXISTS idx_personalization_analytics_created_at ON personalization_analytics(created_at);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application du trigger sur les tables
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_themes_updated_at 
    BEFORE UPDATE ON themes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion des thèmes par défaut
INSERT INTO themes (id, name, description, category, colors, typography, spacing, shadows, border_radius, animations, custom) VALUES
(
    'light',
    'Light',
    'Thème clair par défaut',
    'built-in',
    '{
        "primary": "#3b82f6",
        "secondary": "#6b7280",
        "accent": "#10b981",
        "background": "#ffffff",
        "surface": "#f9fafb",
        "text": "#1f2937",
        "textSecondary": "#6b7280",
        "border": "#e5e7eb",
        "error": "#ef4444",
        "warning": "#f59e0b",
        "success": "#10b981",
        "info": "#3b82f6"
    }',
    '{
        "fontFamily": "Inter",
        "fontSize": {
            "xs": "0.75rem",
            "sm": "0.875rem",
            "md": "1rem",
            "lg": "1.125rem",
            "xl": "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem"
        },
        "fontWeight": {
            "light": 300,
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    }',
    '{
        "xs": "0.25rem",
        "sm": "0.5rem",
        "md": "1rem",
        "lg": "1.5rem",
        "xl": "2rem",
        "2xl": "3rem",
        "3xl": "4rem",
        "4xl": "6rem"
    }',
    '{
        "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
        "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
    }',
    '{
        "none": "0",
        "sm": "0.125rem",
        "md": "0.375rem",
        "lg": "0.5rem",
        "full": "9999px"
    }',
    '{
        "enabled": true,
        "duration": {
            "fast": "150ms",
            "normal": "300ms",
            "slow": "500ms"
        },
        "easing": {
            "ease": "ease",
            "easeIn": "ease-in",
            "easeOut": "ease-out",
            "easeInOut": "ease-in-out"
        }
    }',
    false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO themes (id, name, description, category, colors, typography, spacing, shadows, border_radius, animations, custom) VALUES
(
    'dark',
    'Dark',
    'Thème sombre par défaut',
    'built-in',
    '{
        "primary": "#60a5fa",
        "secondary": "#9ca3af",
        "accent": "#34d399",
        "background": "#111827",
        "surface": "#1f2937",
        "text": "#f9fafb",
        "textSecondary": "#d1d5db",
        "border": "#374151",
        "error": "#f87171",
        "warning": "#fbbf24",
        "success": "#34d399",
        "info": "#60a5fa"
    }',
    '{
        "fontFamily": "Inter",
        "fontSize": {
            "xs": "0.75rem",
            "sm": "0.875rem",
            "md": "1rem",
            "lg": "1.125rem",
            "xl": "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem"
        },
        "fontWeight": {
            "light": 300,
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    }',
    '{
        "xs": "0.25rem",
        "sm": "0.5rem",
        "md": "1rem",
        "lg": "1.5rem",
        "xl": "2rem",
        "2xl": "3rem",
        "3xl": "4rem",
        "4xl": "6rem"
    }',
    '{
        "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
        "md": "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
        "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
        "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.6)"
    }',
    '{
        "none": "0",
        "sm": "0.125rem",
        "md": "0.375rem",
        "lg": "0.5rem",
        "full": "9999px"
    }',
    '{
        "enabled": true,
        "duration": {
            "fast": "150ms",
            "normal": "300ms",
            "slow": "500ms"
        },
        "easing": {
            "ease": "ease",
            "easeIn": "ease-in",
            "easeOut": "ease-out",
            "easeInOut": "ease-in-out"
        }
    }',
    false
) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE user_preferences IS 'Stockage des préférences utilisateur complètes';
COMMENT ON TABLE themes IS 'Thèmes prédéfinis et personnalisés';
COMMENT ON TABLE personalization_analytics IS 'Analytics sur l''utilisation des fonctionnalités de personnalisation';
