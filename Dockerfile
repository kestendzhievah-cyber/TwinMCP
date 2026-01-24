FROM node:18-slim

WORKDIR /app

# Install system dependencies for native modules and git for npm github deps
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer download and disable husky
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV HUSKY=0

# Copy package files
COPY package.json ./

# Install dependencies (allow scripts for native modules like bcrypt)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma client (required for build)
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN npx prisma generate

# Build environment variables (dummy values for build time)
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

# OpenAI dummy key for build
ENV OPENAI_API_KEY="sk-dummy-key-for-build-only"

# Firebase Admin - skip dummy credentials to use graceful fallback

# Build the app
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
