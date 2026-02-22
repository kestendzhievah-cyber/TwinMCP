# ── Stage 1: Install dependencies ──────────────────────────────────
FROM node:18-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl ca-certificates python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV HUSKY=0

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# ── Stage 2: Build the application ────────────────────────────────
FROM node:18-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY . .

# Generate Prisma client
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN npx prisma generate --schema=prisma/schema

# Dummy env vars required at build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV REDIS_DISABLED="true"
ENV MINIO_ENDPOINT="localhost"
ENV MINIO_PORT="9000"
ENV MINIO_ACCESS_KEY="minioadmin"
ENV MINIO_SECRET_KEY="minioadmin"
ENV MINIO_BUCKET_NAME="twinmcp"
ENV MINIO_USE_SSL="false"
ENV ENCRYPTION_KEY="build-time-dummy-key-32-chars!!"
ENV BILLING_ENCRYPTION_KEY="build-time-dummy-key-32-chars!!"
ENV OPENAI_API_KEY="sk-dummy-key-for-build-only"
ENV JWT_SECRET="build-time-dummy-jwt-secret-key"

# Ensure public directory exists (Next.js standalone output expects it)
RUN mkdir -p /app/public

RUN npm run build

# ── Stage 3: Production runner ─────────────────────────────────────
FROM node:18-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy only what is needed at runtime
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
