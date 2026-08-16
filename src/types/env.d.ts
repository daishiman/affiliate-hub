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
  }
}

export {};
