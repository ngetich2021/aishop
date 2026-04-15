// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Never serve stale data from the client-side router cache for
    // dynamic (revalidate=0) pages — every navigation hits the server.
    staleTimes: { dynamic: 0, static: 30 },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
      // Base Cloudinary
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      // Wildcard for any subdomains (like proxy-int.res.cloudinary.com)
      {
        protocol: "https",
        hostname: "**.res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: 'https',
        hostname: 'img.icons8.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
