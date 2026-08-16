import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// 開発サーバー(next dev)からも wrangler.jsonc のバインディング(D1/R2)を
// getCloudflareContext() 経由で参照できるようにする
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
