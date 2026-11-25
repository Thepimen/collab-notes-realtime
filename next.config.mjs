/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
