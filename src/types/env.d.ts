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
    /**
     * 公開サイトの起点（`https://example.com`）。
     *
     * 画面からの要求なら Host から作れるが、**定時実行には要求が無い。**
     * 未設定のときは推測せず、収集を見送って理由を返す。
     */
    PUBLIC_SITE_ORIGIN?: string;
    /**
     * Google Search Console のサービスアカウント JSON（秘密鍵を含む）。
     * Cloudflare の画面から登録する。リポジトリには置かない。
     */
    GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT?: string;
    /** AI 検索での被引用チェックに使う Anthropic の API キー。 */
    AEO_CITATION_API_KEY?: string;
  }
}

export {};
