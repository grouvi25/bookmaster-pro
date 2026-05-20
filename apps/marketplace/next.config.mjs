/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'http://localhost:8000/api/v1',
    APP_URL: process.env.APP_URL || 'http://localhost:5173',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.yandexcloud.net',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/masters',
        destination: '/search',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
