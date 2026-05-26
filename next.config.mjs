import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {},
  // Prisma v7 uses WASM-based query compiler — bundlers (incl. Turbopack) strip
  // the model delegates. Load Prisma and the pg adapter directly from node_modules.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
