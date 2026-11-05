import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "mammoth"],
  // Question paper files are uploaded through server actions (Vercel allows up to about 4.5 MB per request).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
