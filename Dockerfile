FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl

# Copy package files
COPY package.json ./

# Install dependencies with verbose logging
RUN npm install --legacy-peer-deps --loglevel verbose 2>&1 || (cat /root/.npm/_logs/*.log && exit 1)

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
