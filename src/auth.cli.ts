import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/**
 * **スキーマを作るためだけの設定。実行時には誰も読まない。**
 *
 * Better Auth が要るテーブル（`user` / `account` / `session` / `verification` /
 * `rateLimit`）の形は、こちらが手で書き写してよいものではない。
 * 書き写すと、Better Auth の版を上げた日に、列が足りないことに
 * **ログインが失敗するまで気づけない**。
 *
 * そこで、形は必ず Better Auth の CLI に出させる。
 *
 * ```
 * pnpm dlx @better-auth/cli@latest generate --config src/auth.cli.ts \
 *   --output src/db/auth-schema.ts --yes
 * pnpm drizzle-kit generate
 * ```
 *
 * ここに置いてある値は**すべて偽物**である。CLI は形しか見ないので、
 * 本物の鍵を置く理由が無い。本物は実行時に
 * `src/infrastructure/identity/better-auth.ts` が環境から取る。
 *
 * このファイルを実行時のコードから import しない。
 * import した瞬間、偽の鍵で動く経路ができる。
 */
export const auth = betterAuth({
  appName: "affiliate-hub",
  baseURL: "http://localhost:3000",
  secret: "schema-generation-only-not-a-real-secret",
  // 接続は渡さない。CLI が見るのは方言（sqlite）だけで、
  // ここで本物の D1 を掴むと、形を出すだけの操作が保存先に触れてしまう。
  database: drizzleAdapter({} as never, { provider: "sqlite" }),
  socialProviders: {
    google: {
      clientId: "schema-generation-only",
      clientSecret: "schema-generation-only",
    },
  },
  rateLimit: { enabled: true, storage: "database" },
});
