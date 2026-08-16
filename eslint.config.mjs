import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // wrangler / opennext が生成するもの
    "cloudflare-env.d.ts",
    ".open-next/**",
    ".wrangler/**",
    // HarnessHub からベンダリングしたプラグイン。上流が真実源で本リポジトリでは編集しない
    // (更新は .claude/scripts/sync-plugins.sh)。lint して直すと次の同期で消える。
    ".claude/plugins/**",
  ]),
]);

export default eslintConfig;
