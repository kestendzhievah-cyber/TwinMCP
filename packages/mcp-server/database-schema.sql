-- Table principale des bibliothèques
CREATE TABLE IF NOT EXISTS libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  language VARCHAR(50) NOT NULL,
  ecosystem VARCHAR(50) NOT NULL,
  popularity_score DECIMAL(3,2) DEFAULT 0.0 CHECK (popularity_score >= 0.0 AND popularity_score <= 1.0),
  latest_version VARCHAR(50),
  homepage VARCHAR(500),
  repository VARCHAR(500),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des aliases pour les bibliothèques
CREATE TABLE IF NOT EXISTS library_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(library_id, alias)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_libraries_name ON libraries(name);
CREATE INDEX IF NOT EXISTS idx_libraries_display_name ON libraries(display_name);
CREATE INDEX IF NOT EXISTS idx_libraries_language ON libraries(language);
CREATE INDEX IF NOT EXISTS idx_libraries_ecosystem ON libraries(ecosystem);
CREATE INDEX IF NOT EXISTS idx_libraries_popularity ON libraries(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_libraries_tags ON libraries USING GIN(tags);

-- Index pour les aliases
CREATE INDEX IF NOT EXISTS idx_library_aliases_alias ON library_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_library_aliases_library_id ON library_aliases(library_id);

-- Index de recherche textuelle (PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_libraries_search ON libraries USING GIN(
  to_tsvector('english', name || ' ' || display_name || ' ' || COALESCE(description, ''))
);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_libraries_updated_at 
  BEFORE UPDATE ON libraries 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insertion de données de test
INSERT INTO libraries (name, display_name, description, language, ecosystem, popularity_score, latest_version, homepage, repository, tags) VALUES
  ('react', 'React', 'A JavaScript library for building user interfaces', 'javascript', 'npm', 0.95, '18.2.0', 'https://reactjs.org', 'https://github.com/facebook/react', ARRAY['ui', 'frontend', 'javascript', 'components']),
  ('vue', 'Vue.js', 'Progressive JavaScript Framework', 'javascript', 'npm', 0.85, '3.3.0', 'https://vuejs.org', 'https://github.com/vuejs/vue', ARRAY['ui', 'frontend', 'javascript', 'framework']),
  ('angular', 'Angular', 'Platform for building mobile and desktop web applications', 'javascript', 'npm', 0.80, '17.0.0', 'https://angular.io', 'https://github.com/angular/angular', ARRAY['ui', 'frontend', 'javascript', 'framework']),
  ('express', 'Express', 'Fast, unopinionated, minimalist web framework', 'javascript', 'npm', 0.90, '4.18.0', 'https://expressjs.com', 'https://github.com/expressjs/express', ARRAY['backend', 'api', 'javascript', 'framework']),
  ('django', 'Django', 'High-level Python web framework', 'python', 'pip', 0.88, '4.2.0', 'https://djangoproject.com', 'https://github.com/django/django', ARRAY['backend', 'api', 'python', 'framework']),
  ('flask', 'Flask', 'A lightweight WSGI web application framework', 'python', 'pip', 0.75, '2.3.0', 'https://flask.palletsprojects.com', 'https://github.com/pallets/flask', ARRAY['backend', 'api', 'python', 'framework']),
  ('tokio', 'Tokio', 'A runtime for writing reliable asynchronous applications', 'rust', 'cargo', 0.92, '1.35.0', 'https://tokio.rs', 'https://github.com/tokio-rs/tokio', ARRAY['async', 'runtime', 'rust', 'framework']),
  ('serde', 'Serde', 'Serialization framework for Rust', 'rust', 'cargo', 0.87, '1.0.190', 'https://serde.rs', 'https://github.com/serde-rs/serde', ARRAY['serialization', 'json', 'rust', 'framework']),
  ('laravel', 'Laravel', 'The PHP Framework for Web Artisans', 'php', 'composer', 0.86, '10.45.0', 'https://laravel.com', 'https://github.com/laravel/laravel', ARRAY['backend', 'api', 'php', 'framework'])
ON CONFLICT (name) DO NOTHING;

-- Insertion d'aliases de test
INSERT INTO library_aliases (library_id, alias) VALUES
  ((SELECT id FROM libraries WHERE name = 'react'), 'reactjs'),
  ((SELECT id FROM libraries WHERE name = 'react'), 'react-dom'),
  ((SELECT id FROM libraries WHERE name = 'vue'), 'vuejs'),
  ((SELECT id FROM libraries WHERE name = 'vue'), 'vue3'),
  ((SELECT id FROM libraries WHERE name = 'express'), 'express.js'),
  ((SELECT id FROM libraries WHERE name = 'django'), 'djangoproject'),
  ((SELECT id FROM libraries WHERE name = 'flask'), 'flask-framework')
ON CONFLICT (library_id, alias) DO NOTHING;
