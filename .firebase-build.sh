#!/bin/bash

# Script de build personnalisé pour Firebase
echo "🔧 Starting Firebase build process..."

# Configurer npm
echo "📦 Configuring npm..."
npm config set legacy-peer-deps true
npm config set engine-strict true

# Installer les dépendances
echo "📥 Installing dependencies..."
npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Build le projet
echo "🏗️ Building project..."
npm run build:firebase

echo "✅ Build completed successfully!"
