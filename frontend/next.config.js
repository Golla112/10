/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/wikipedia/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/superbet/:path*',
        destination: `${backendUrl}/superbet/:path*`,
      },
      {
        source: '/superbet/:path*',
        destination: `${backendUrl}/superbet/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
