import { fileURLToPath } from 'node:url';

import withBundleAnalyzer from '@next/bundle-analyzer';
import createJiti from 'jiti';
import withNextIntl from 'next-intl/plugin';
import webpack from 'webpack';

const jiti = createJiti(fileURLToPath(import.meta.url));

jiti('./src/libs/Env');

const withNextIntlConfig = withNextIntl('./src/libs/i18n.ts');

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
export default bundleAnalyzer(
  withNextIntlConfig({
    eslint: {
      dirs: ['.'],
    },
    poweredByHeader: false,
    reactStrictMode: true,
    experimental: {
      serverComponentsExternalPackages: [
        '@electric-sql/pglite',
        'pdf-parse',
        '@langchain/textsplitters',
        'ai',
        '@ai-sdk/openai',
        '@logtail/pino',
        '@logtail/node',
        'pino',
        'pino-pretty',
      ],
    },
    webpack: (config, { isServer }) => {
      if (!isServer) {
        // Excluir módulos de Node.js del bundle del cliente
        config.resolve.fallback = {
          ...config.resolve.fallback,
          'worker_threads': false,
          'zlib': false,
          'http': false,
          'https': false,
          'stream': false,
          'util': false,
        };
        // Ignorar completamente @logtail/pino y el módulo de logtail en el cliente
        config.plugins.push(
          new webpack.IgnorePlugin({
            resourceRegExp: /^@logtail\/pino$/,
          }),
          new webpack.IgnorePlugin({
            resourceRegExp: /Logger\.logtail\.ts$/,
          }),
        );
      }
      return config;
    },
  }),
);
