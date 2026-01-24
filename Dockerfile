FROM node:18-alpine

WORKDIR /app

# Install system dependencies for native modules (sharp, bcrypt, puppeteer)
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    python3 \
    make \
    g++ \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Skip Puppeteer Chromium download (use system chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package.json ./

# Install dependencies (ignore prepare/husky scripts)
RUN npm install --legacy-peer-deps --ignore-scripts && \
    npm rebuild bcrypt --build-from-source || true

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate || true

# Build the app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
