import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["jsdom"],
  allowedDevOrigins: ["supermentally-uncontested-susie.ngrok-free.dev"],
};

export default nextConfig;
