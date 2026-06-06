FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @twinmcp/backend --config.dangerously-allow-all-builds=true

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY . .
WORKDIR /app/apps/backend
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* are inlined into the client bundle AT BUILD TIME, not read at
# runtime. Dokploy only injects env at runtime, so without these build args the
# browser Supabase client ends up with empty URL/key and every auth method
# (password, magic-link, OAuth) silently fails. These three are public values
# (shipped to the browser anyway), so we default them to the real prod values:
# the build then works even when no build arg is wired, and they can still be
# overridden with --build-arg. An empty NEXT_PUBLIC_SITE_URL also crashes the
# build (new URL("") in layout metadataBase), so a valid default is required.
ARG NEXT_PUBLIC_SUPABASE_URL=https://dzaktzfmhcfqbothsvlh.supabase.co
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_L_BEyVEx3dmjNSr25T40Ng_snbswlXy
ARG NEXT_PUBLIC_SITE_URL=https://twinmcp.fr
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_GSC_VERIFICATION
ARG NEXT_PUBLIC_BING_VERIFICATION
ARG NEXT_PUBLIC_YANDEX_VERIFICATION
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_GSC_VERIFICATION=$NEXT_PUBLIC_GSC_VERIFICATION \
    NEXT_PUBLIC_BING_VERIFICATION=$NEXT_PUBLIC_BING_VERIFICATION \
    NEXT_PUBLIC_YANDEX_VERIFICATION=$NEXT_PUBLIC_YANDEX_VERIFICATION
RUN node ./node_modules/next/dist/bin/next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/backend/public ./apps/backend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/backend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/backend/.next/static ./apps/backend/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
WORKDIR /app/apps/backend
CMD ["node", "server.js"]
