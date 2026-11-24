/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Uploaded board images are user content stored as data URLs / blobs.
    dangerouslyAllowSVG: false,
  },
  experimental: {
    // Keep the bundle lean for the canvas editing surface.
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
