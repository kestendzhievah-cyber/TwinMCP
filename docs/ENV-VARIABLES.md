# Environment Variables Reference

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/twinmcp` |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | `your-super-secret-key-at-least-32-chars` |

## Required — Firebase Client (for Google/GitHub OAuth on /auth page)

| Variable | Description | Example |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `your-project` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `your-project.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `123456789012` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | `1:123456789012:web:abcdef` |

> **Where to find these:** Firebase Console > Project Settings > General > Your apps > Web app config

> **Also required in Firebase Console:** Enable Google and/or GitHub as sign-in providers under Authentication > Sign-in method. For GitHub, create an OAuth App at https://github.com/settings/developers with callback URL `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`.

## Optional — Firebase Server (Admin SDK for backend token verification)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | NextAuth.js secret | — |
| `FIREBASE_PROJECT_ID` | Firebase project ID | — |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | — |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | — |

## Optional — Redis

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDIS_HOST` | Redis host (if not using URL) | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | — |
| `REDIS_DISABLED` | Disable Redis entirely | `false` |

## Optional — LLM Providers

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (starts with `sk-`) | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `GOOGLE_API_KEY` | Google Gemini API key | — |

## Optional — Payments

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_` or `sk_live_`) | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `PAYPAL_CLIENT_ID` | PayPal client ID | — |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret | — |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID | — |

## Optional — GitHub

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub personal access token | — |

## Optional — App

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `development` |
| `NEXT_PUBLIC_APP_URL` | Public application URL | `http://localhost:3000` |
| `TWINMCP_INTERNAL_KEY` | Internal key for server-to-server calls | — |
| `MCP_DEV_API_KEY` | Dev API key for MCP (auto-generated if not set) | — |

## Quick Start

```bash
# Minimum required for development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/twinmcp
JWT_SECRET=dev-secret-key-at-least-32-characters-long
```
