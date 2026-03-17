/** @type {import('next').NextConfig} */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: BACKEND_URL,
  },
  async rewrites() {
    return [
      {
        // Proxy all /api/* to the backend (Next.js internal routes like /api/cloudinary take priority)
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        // Landscape AI proxy
        source: '/landscape-api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
      {
        // Futures Pro Bot API (port 4509) — main trading engine with 188 trades
        source: '/futures-pro-api/:path*',
        destination: 'http://localhost:4509/pro/:path*',
      },
      {
        // Futures Pro direct proxy
        source: '/pro/:path*',
        destination: 'http://localhost:4509/pro/:path*',
      },
      {
        // Futures Trend page API calls (futures-pro on port 4509)
        source: '/futures-trend/api/:path*',
        destination: 'http://localhost:4509/pro/:path*',
      },
      {
        // Futures Pro bot API (port 4509) — all 28 pairs signal data
        source: '/futures-pro-bot/:path*',
        destination: 'http://localhost:4509/pro/:path*',
      },
      {
        // Gold Scalper dashboard proxy — root status endpoint
        source: '/gold-scalper-api',
        destination: 'http://localhost:4507/gold-binance',
      },
      {
        // Gold Scalper dashboard proxy — sub-paths
        source: '/gold-scalper-api/:path*',
        destination: 'http://localhost:4507/gold-binance/:path*',
      },
      {
        // Funding Rate Arb Bot — root status endpoint
        source: '/funding-rate-api',
        destination: 'http://localhost:4503/funding-rate',
      },
      {
        // Funding Rate Arb Bot API (port 4503)
        source: '/funding-rate-api/:path*',
        destination: 'http://localhost:4503/funding-rate/:path*',
      },
      {
        // Serve uploaded files (offplan images, property photos, etc.)
        source: '/uploads/:path*',
        destination: 'http://localhost:3001/uploads/:path*',
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
      {
        // CORS for bot.astraterra.ae to call CRM bot API proxy routes
        source: '/(futures-pro-api|gold-scalper-api|funding-rate-api|pro)/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://bot.astraterra.ae' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
