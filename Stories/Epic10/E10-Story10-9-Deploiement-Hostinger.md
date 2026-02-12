# E10-Story10-9-Deploiement-Hostinger.md

## Epic 10: Déploiement & Production

### Story 10.9: Déploiement SaaS sur Hostinger (pas à pas)

**Description**: Déployer TwinMe IA en production sur Hostinger avec un parcours clair, reproductible et sécurisé.

---

## Objectif

Mettre en ligne l'application SaaS TwinMe IA sur Hostinger (VPS) avec un domaine, SSL, base de données, variables d'environnement, monitoring minimal et procédures de mise à jour/rollback.

---

## Prérequis

- Compte Hostinger actif (VPS Linux requis)
- Nom de domaine acheté et contrôlé (chez Hostinger ou externe)
- Accès SSH au VPS
- Accès au repository (Git)
- Secrets disponibles (API keys, DB, JWT, etc.)

---

## Spécifications Techniques

### 1. Choix de l'infrastructure Hostinger

#### 1.1 VPS recommandé

- **Plan**: VPS KVM (2 vCPU / 4-8 GB RAM / 80 GB SSD minimum)
- **OS**: Ubuntu 22.04 LTS
- **Accès**: SSH (clé publique)

#### 1.2 Ports nécessaires

- **80/443**: HTTP/HTTPS
- **22**: SSH
- **3000**: App Node (exposé uniquement en interne via reverse proxy)

---

## Déploiement pas à pas

### Étape 1 — Préparer le VPS

1. Se connecter en SSH:
   ```bash
   ssh root@<IP_VPS>
   ```
2. Mettre à jour le système:
   ```bash
   apt update && apt upgrade -y
   ```
3. Créer un utilisateur non-root:
   ```bash
   adduser twinme
   usermod -aG sudo twinme
   ```
4. Se reconnecter avec l’utilisateur:
   ```bash
   ssh twinme@<IP_VPS>
   ```

### Étape 2 — Installer les dépendances système

1. Installer Node.js (LTS):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
2. Installer Git:
   ```bash
   sudo apt install -y git
   ```
3. Installer Nginx:
   ```bash
   sudo apt install -y nginx
   ```
4. Installer PM2:
   ```bash
   sudo npm install -g pm2
   ```

### Étape 3 — Cloner le projet

1. Créer un dossier applicatif:
   ```bash
   mkdir -p /home/twinme/apps
   cd /home/twinme/apps
   ```
2. Cloner le repo:
   ```bash
   git clone <URL_GIT> twinme
   cd twinme
   ```

### Étape 4 — Configurer l’environnement

1. Créer le fichier `.env.production`:
   ```bash
   cp .env.production.example .env.production
   nano .env.production
   ```
2. Renseigner **toutes** les variables sensibles:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `REDIS_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `APP_URL`
3. Vérifier que `NODE_ENV=production`.

### Étape 5 — Installer les dépendances

```bash
npm ci
```

### Étape 6 — Construire l’application

```bash
npm run build
```

### Étape 7 — Démarrer avec PM2

1. Lancer le serveur:
   ```bash
   pm2 start npm --name twinme -- start
   ```
2. Sauvegarder la configuration PM2:
   ```bash
   pm2 save
   ```
3. Activer le démarrage automatique:
   ```bash
   pm2 startup
   ```
   Copier-coller la commande générée.

### Étape 8 — Configurer Nginx (reverse proxy)

1. Créer la config Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/twinme
   ```
2. Exemple de configuration:
   ```nginx
   server {
       listen 80;
       server_name votre-domaine.com www.votre-domaine.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Activer le site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/twinme /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Étape 9 — Configurer le domaine (DNS)

1. Dans le DNS du domaine:
   - **A** → IP du VPS (ex: `votre-domaine.com`)
   - **CNAME** → `www` vers `votre-domaine.com`
2. Attendre la propagation (5-60 min).

### Étape 10 — Activer HTTPS (Let’s Encrypt)

1. Installer Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```
2. Générer le certificat:
   ```bash
   sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
   ```
3. Tester le renouvellement:
   ```bash
   sudo certbot renew --dry-run
   ```

### Étape 11 — Vérifier l’application

1. Endpoint santé:
   ```bash
   curl -f https://votre-domaine.com/health
   ```
2. Vérifier la page d’accueil et l’authentification.

---

## Tâches Détaillées

### 1. Infrastructure Hostinger
- [ ] Choisir un VPS compatible (KVM)
- [ ] Activer SSH + clés publiques
- [ ] Mettre à jour le système

### 2. Déploiement Application
- [ ] Cloner le repo
- [ ] Configurer `.env.production`
- [ ] Build de l’application
- [ ] Démarrer via PM2

### 3. Réseau & Domaine
- [ ] Configurer DNS (A + CNAME)
- [ ] Configurer Nginx reverse proxy
- [ ] Activer HTTPS

### 4. Observabilité minimale
- [ ] Logs via PM2 (`pm2 logs`)
- [ ] Uptime monitoring (Hostinger/StatusCake)

---

## Validation

### Checklist

- [ ] Le domaine répond en HTTPS
- [ ] `/health` retourne 200
- [ ] Login/Logout fonctionnels
- [ ] Aucune erreur dans `pm2 logs`
- [ ] Redémarrage automatique OK (reboot VPS)

---

## Procédures de mise à jour

### Déploiement d’une nouvelle version

```bash
cd /home/twinme/apps/twinme
git pull origin main
npm ci
npm run build
pm2 restart twinme
```

### Rollback rapide

```bash
git log --oneline -n 5
git checkout <COMMIT_PRECEDENT>
npm ci
npm run build
pm2 restart twinme
```

---

## Livrables

1. **Application en production** sur Hostinger
2. **Domaine + SSL** configurés
3. **Reverse proxy** opérationnel
4. **Procédure de mise à jour** documentée

---

## Critères de Succès

- [ ] Service accessible en HTTPS
- [ ] Temps de réponse stable
- [ ] Déploiement reproductible
- [ ] Mise à jour sans downtime critique
