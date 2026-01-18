#!/bin/bash

# Script d'installation des dépendances pour E10-Story10-7
# Date: 2026-01-18

echo "🚀 Installation des dépendances pour E10-Story10-7..."
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Installation des dépendances npm
echo -e "${YELLOW}📦 Installation des dépendances npm...${NC}"
npm install --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances npm installées avec succès${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'installation des dépendances npm${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔍 Vérification des dépendances critiques...${NC}"

# Vérifier fuse.js
if npm list fuse.js > /dev/null 2>&1; then
    echo -e "${GREEN}✅ fuse.js installé${NC}"
else
    echo -e "${RED}❌ fuse.js manquant${NC}"
fi

# Vérifier leven
if npm list leven > /dev/null 2>&1; then
    echo -e "${GREEN}✅ leven installé${NC}"
else
    echo -e "${RED}❌ leven manquant${NC}"
fi

# Vérifier natural
if npm list natural > /dev/null 2>&1; then
    echo -e "${GREEN}✅ natural installé${NC}"
else
    echo -e "${RED}❌ natural manquant${NC}"
fi

# Vérifier string-similarity
if npm list string-similarity > /dev/null 2>&1; then
    echo -e "${GREEN}✅ string-similarity installé${NC}"
else
    echo -e "${RED}❌ string-similarity manquant${NC}"
fi

echo ""
echo -e "${YELLOW}🔨 Compilation TypeScript...${NC}"
npm run build:ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Compilation TypeScript réussie${NC}"
else
    echo -e "${YELLOW}⚠️  Erreurs de compilation TypeScript détectées${NC}"
    echo -e "${YELLOW}   Voir IMPLEMENTATION_SUMMARY_E10-7.md pour les corrections${NC}"
fi

echo ""
echo -e "${GREEN}✅ Installation terminée!${NC}"
echo ""
echo -e "${YELLOW}📋 Prochaines étapes:${NC}"
echo "1. Corriger les configurations TypeScript (voir IMPLEMENTATION_SUMMARY_E10-7.md)"
echo "2. Lancer les tests: npm test"
echo "3. Démarrer le serveur: npm run dev"
echo ""
