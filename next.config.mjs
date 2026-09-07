/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // TensorFlow and sharp both ship platform-specific/native pieces that must
    // not be webpack-bundled into the server build.
    serverComponentsExternalPackages: [
      '@tensorflow/tfjs',
      '@tensorflow-models/mobilenet',
      'sharp',
    ],
    serverActions: {
      // uploadCat() accepts images up to 5 MB, but a Server Action body is
      // capped at 1 MB by default -- so every photo bigger than that was
      // rejected by the framework before the action ever ran. Kept a little
      // above the app's own limit so the app's error message is the one users
      // see, not the framework's.
      bodySizeLimit: '6mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn2.thecatapi.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
