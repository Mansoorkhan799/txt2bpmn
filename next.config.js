/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enhanced webpack configuration for better stability
    webpack: (config, { dev, isServer }) => {
        // Disable webpack cache to prevent corruption issues
        config.cache = false;

        // Fix for potential module resolution issues
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
            canvas: false,
        };

        // Fix for webpack runtime errors
        config.optimization = {
            ...config.optimization,
            moduleIds: 'deterministic',
        };

        return config;
    },
    // Disable ESLint during build to avoid configuration issues
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Configure allowed image domains for Next.js Image component
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                port: '',
                pathname: '/**',
            },
        ],
    },
    // Production optimizations
    experimental: {
        serverComponentsExternalPackages: ['mongoose', 'mongodb'],
    },
    // Optimize for Vercel
    compress: true,
    poweredByHeader: false,
    generateEtags: false,
};

module.exports = nextConfig; 