-- Création de la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS twinmcp_dev;

-- Création de l'utilisateur avec permissions
CREATE USER IF NOT EXISTS twinmcp_user WITH PASSWORD 'twinmcp_password';

-- Attribution des permissions
GRANT ALL PRIVILEGES ON DATABASE twinmcp_dev TO twinmcp_user;

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
