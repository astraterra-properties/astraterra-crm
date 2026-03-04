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
