/**
 * `pnpm cf-typegen` が生成する CloudflareEnv に、Secret を追記する。
 *
 * Secret は wrangler.jsonc に書かない (書くと値がリポジトリに載る) ため
 * 自動生成では型が出ない。ここで interface merging して補う。
 */
declare global {
  interface CloudflareEnv {
    /** Remote MCP クライアント用の Bearer トークン */
    MCP_TOKEN?: string;
    /** Cloudflare Turnstile siteverify 用。値は secret store から供給する。 */
    TURNSTILE_SECRET?: string;
    /** siteverify 応答で許可する frontend hostname のカンマ区切り。 */
    TURNSTILE_HOSTNAMES?: string;
    /** 問い合わせフォームへ描画する公開 site key。 */
    TURNSTILE_SITE_KEY?: string;
  }
}

export {};
