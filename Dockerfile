FROM node:18-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV HUSKY=0

# Install yarn
RUN corepack enable && corepack prepare yarn@stable --activate

# Copy package files
COPY package.json ./

# Install dependencies with yarn
RUN yarn install --ignore-scripts --network-timeout 600000

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate || true

# Build the app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN yarn build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["yarn", "start"]
