import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { securityHeaderRouteRules } from "@/infrastructure/http/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () =>
    securityHeaderRouteRules().map(({ source, headers }) => ({
      source,
      headers: headers.map(({ key, value }) => ({ key, value })),
    })),
};

export default nextConfig;

// 開発サーバー(next dev)からも wrangler.jsonc のバインディング(D1/R2)を
// getCloudflareContext() 経由で参照できるようにする
initOpenNextCloudflareForDev();
