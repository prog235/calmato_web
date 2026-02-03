import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "homucwnalqzacoimgumj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  reactStrictMode: true,
  devIndicators: false
};

export default nextConfig;
