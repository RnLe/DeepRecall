import { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@deeprecall/ui"], // Compile workspace packages
  images: {
    unoptimized: true, // Required for static export
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  serverExternalPackages: [
    "pino",
    "better-sqlite3",
    "pg",
    "pg-native",
    "pdf-parse",
  ],
  // Default to no trailing slash to avoid API redirect loops
  trailingSlash: false,
  async rewrites() {
    return [
      // Allow existing trailing-slash URLs (especially from static docs) to keep working
      { source: "/api/:path*/", destination: "/api/:path*" },
    ];
  },
  turbopack: {
    resolveAlias: {
      canvas: "./empty-module.ts",
    },
  },
  // Webpack fallback for production builds
  webpack(config, { isServer }) {
    // Stub out 'canvas' for client and server bundles via fallback
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      canvas: false,
    };

    // For client bundles, stub out Node.js-only modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        net: false,
        tls: false,
        fs: false,
        pg: false,
        "pg-native": false,
      };
    }

    config.experiments = {
      asyncWebAssembly: true,
      layers: true, // optional but apparently recommended for module federation in rust
    };
    return config;
  },
};

export default nextConfig;
