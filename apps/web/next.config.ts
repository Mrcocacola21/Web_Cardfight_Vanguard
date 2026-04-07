import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: [
    '@web-vg/ui',
    '@web-vg/shared',
    '@web-vg/catalog',
    '@web-vg/decks',
    '@web-vg/legality',
    '@web-vg/rules-core',
    '@web-vg/social',
  ],
}

export default nextConfig
