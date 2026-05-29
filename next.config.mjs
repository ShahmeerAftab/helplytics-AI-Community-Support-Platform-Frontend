/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://helplytics-ai-production.up.railway.app/api/:path*'
      }
    ]
  }
};

export default nextConfig;
