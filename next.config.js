/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // `images.domains` is deprecated in Next 16; this is the equivalent
    // remotePatterns entry (any protocol/port/path on localhost).
    remotePatterns: [{ hostname: 'localhost' }],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
