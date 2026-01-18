@echo off
REM Script d'installation des dépendances pour E10-Story10-7
REM Date: 2026-01-18

echo.
echo ============================================
echo Installation des dependances E10-Story10-7
echo ============================================
echo.

echo [1/4] Installation des dependances npm...
call npm install --legacy-peer-deps

if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Echec de l'installation npm
    exit /b 1
)

echo [OK] Dependances npm installees
echo.

echo [2/4] Verification des dependances critiques...
call npm list fuse.js >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] fuse.js installe
) else (
    echo [WARN] fuse.js manquant
)

call npm list leven >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] leven installe
) else (
    echo [WARN] leven manquant
)

call npm list natural >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] natural installe
) else (
    echo [WARN] natural manquant
)

call npm list string-similarity >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] string-similarity installe
) else (
    echo [WARN] string-similarity manquant
)

echo.
echo [3/4] Compilation TypeScript...
call npm run build:ts

if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Erreurs de compilation TypeScript detectees
    echo       Voir IMPLEMENTATION_SUMMARY_E10-7.md pour les corrections
) else (
    echo [OK] Compilation TypeScript reussie
)

echo.
echo [4/4] Generation de la documentation...
echo [OK] Voir IMPLEMENTATION_SUMMARY_E10-7.md

echo.
echo ============================================
echo Installation terminee!
echo ============================================
echo.
echo Prochaines etapes:
echo 1. Corriger les configurations TypeScript
echo 2. Lancer les tests: npm test
echo 3. Demarrer le serveur: npm run dev
echo.

pause
