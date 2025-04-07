import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
  serverExternalPackages: ['pino'],
};

export default withNextIntl(nextConfig);
