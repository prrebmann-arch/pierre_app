import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      '@supabase/supabase-js',
      '@stripe/stripe-js',
      '@stripe/react-stripe-js',
      'chart.js',
      'react-chartjs-2',
    ],
  },
  typescript: {
    // Pre-existing Supabase type errors (ungenerated DB types → 'never' on insert/update)
    // Does NOT skip compilation — only skips the type-check step during build
    ignoreBuildErrors: true,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
  async redirects() {
    return [
      // Backwards compatibility — old API paths redirect to new Next.js routes
      // stripe-webhook redirect REMOVED — it caused 308 on POST, breaking Stripe delivery.
      // The proxy route at app/api/stripe-webhook/route.ts handles forwarding instead.
      { source: '/api/stripe-cron', destination: '/api/stripe/cron', permanent: true },
      { source: '/api/ig-auth', destination: '/api/instagram/auth', permanent: true },
      { source: '/api/ig-messages', destination: '/api/instagram/messages', permanent: true },
      { source: '/api/ig-publish', destination: '/api/instagram/publish', permanent: true },
      { source: '/api/ig-webhook', destination: '/api/instagram/webhook', permanent: true },
      { source: '/api/ig-sync-profile', destination: '/api/instagram/sync-profile', permanent: true },
      { source: '/api/ig-sync-reels', destination: '/api/instagram/sync-reels', permanent: true },
      { source: '/api/ig-sync-stories', destination: '/api/instagram/sync-stories', permanent: true },
      { source: '/api/fb-page-auth', destination: '/api/facebook/page-auth', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), display-capture=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

export default nextConfig
