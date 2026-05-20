/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
