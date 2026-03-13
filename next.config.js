/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['app', 'lib', 'components', 'src'],
  },
  // Optimisation des images (Next.js Image Optimization)
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  // SWC compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Remove X-Powered-By header (smaller responses)
  poweredByHeader: false,
  // Enable gzip compression
  compress: true,
  // Configuration pour le build de production
  distDir: '.next',
  // Configuration pour le output standalone
  output: 'standalone',
  // outputFileTracingRoot moved out of experimental in Next.js 15
  outputFileTracingRoot: process.env.NODE_ENV === 'production' ? __dirname : undefined,
  outputFileTracingExcludes: {
    '*': [
      '.next/cache/**/*',
    ],
  },
  // Configuration Webpack personnalisée
  webpack: (config, { isServer }) => {
    // Augmenter la limite de taille des fichiers
    config.performance = {
      maxAssetSize: 1024 * 1024 * 5, // 5MB
      maxEntrypointSize: 1024 * 1024 * 5, // 5MB
    };

    // Externaliser les packages problématiques côté serveur
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'vm2': 'commonjs vm2',
        'dockerode': 'commonjs dockerode',
        'ssh2': 'commonjs ssh2',
        'puppeteer': 'commonjs puppeteer',
        'sharp': 'commonjs sharp',
        '@qdrant/js-client-rest': 'commonjs @qdrant/js-client-rest',
        // Heavy MCP/API dependencies — resolved at runtime from node_modules
        'googleapis': 'commonjs googleapis',
        'nodemailer': 'commonjs nodemailer',
        '@modelcontextprotocol/sdk': 'commonjs @modelcontextprotocol/sdk',
        '@octokit/rest': 'commonjs @octokit/rest',
        '@octokit/webhooks': 'commonjs @octokit/webhooks',
        'firebase-admin': 'commonjs firebase-admin',
        'openai': 'commonjs openai',
        'natural': 'commonjs natural',
        '@google-cloud/text-to-speech': 'commonjs @google-cloud/text-to-speech',
        '@google-cloud/vision': 'commonjs @google-cloud/vision',
        '@pinecone-database/pinecone': 'commonjs @pinecone-database/pinecone',
      });
    }

    // Configurer les résolutions pour éviter les problèmes de dépendances
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      dns: false,
      child_process: false,
    };

    // Ignorer les avertissements spécifiques
    config.ignoreWarnings = [
      /Failed to parse source map/,
      /the request of a dependency is an expression/,
      /Module not found: Can't resolve/,
      /Critical dependency/,
    ];

    return config;
  },
  // Configuration pour les en-têtes de sécurité et caching
  async headers() {
    return [
      // Immutable static assets — cache for 1 year
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Font files — cache for 1 year
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Optimized images — cache for 30 days
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      // CORS headers for API routes (Architecture 08-Securite)
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Api-Key, X-Request-ID',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
      // Security headers on all routes
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.firebaseapp.com https://apis.google.com https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://api.stripe.com https://apis.google.com wss://*.firebaseio.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://github.com https://apis.google.com https://js.stripe.com https://hooks.stripe.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
