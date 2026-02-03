/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Désactiver la vérification TypeScript pendant le build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Désactiver la vérification ESLint pendant le build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Configuration pour le développement - PAS d'export statique
  // output: 'export', // Commenté pour permettre les routes API
  // Désactiver les images optimisées
  images: {
    unoptimized: true,
  },
  // Configuration pour le build de production
  distDir: '.next',
  // Désactiver le cache du build
  cache: false,
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
    ];

    return config;
  },
  // Configuration pour les en-têtes de sécurité
  async headers() {
    return [
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
        ],
      },
    ];
  },
  // Configuration pour le build de production
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: process.env.NODE_ENV === 'production' ? './' : undefined,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/**/*',
        '.next/cache/**/*',
      ],
    },
  },
};

module.exports = nextConfig;
