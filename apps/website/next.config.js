/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    esmExternals: false,
    serverActions: {
      bodySizeLimit:'10mb'
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      }
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };

    // Handle pino-pretty and other optional dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    };

    // Ignore optional dependencies that cause build issues
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('pino-pretty');
    }

    return config;
  },
  // Handle dynamic imports better
  transpilePackages: ['@coinbase/onchainkit', 'agora-rtc-react'],
}

module.exports = nextConfig
