/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001',
  },
  async rewrites() {
    return [
      {
        // Proxy all /api/* to the backend (Next.js internal routes like /api/cloudinary take priority)
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        // Landscape AI proxy
        source: '/landscape-api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
      {
        // Futures Trend Bot dashboard proxy (port 4506) — actual execution engine
        source: '/futures-pro-api/:path*',
        destination: 'http://localhost:4506/trend/:path*',
      },
      {
        // Gold Scalper dashboard proxy
        source: '/gold-scalper-api/:path*',
        destination: 'http://localhost:4507/gold-binance/:path*',
      },

    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
