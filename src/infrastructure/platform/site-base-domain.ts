/**
 * ブログの住所の基底ドメイン（例: `example.com`）を取る場所。
 *
 * `SITE_BASE_DOMAIN` という構成値 1 つで決まる。秘密ではない
 * （読者が打つ住所そのものなので隠せない）ので `wrangler.jsonc` の
 * `vars` に置く。秘密値の置き場（`wrangler secret` / `.dev.vars`）と混ぜない。
 *
 * **無ければ `null` を返す。例外にしない。**
 * `tryGetWorkerEnv` と同じ考え方で、Workers の外（`pnpm dev`・自動テスト）
 * には供給されない。ここで投げると、住所を設定していないだけの環境で
 * ブログ作成そのものが落ちる。`null` のときは `/s/<URL名>` だけが住所になる。
 */

/** 構成値の名前。文字列を各所に書かない（打ち間違いは黙って null になる）。 */
export const SITE_BASE_DOMAIN_VAR = "SITE_BASE_DOMAIN";

/**
 * 環境の入れ物から基底ドメインを 1 件取り出す。**唯一の解釈**。
 *
 * 取り出し口は 2 つある（組み立て済みの `env` を持つ側と、入口のように
 * 自分で取りに行く側）が、`null` と見なす条件をここに 1 本化する。
 * 条件が 2 つあると、片方だけが空文字を住所として扱う形が作れる。
 */
export function pickSiteBaseDomain(env: Readonly<Record<string, unknown>>): string | null {
  const raw = env[SITE_BASE_DOMAIN_VAR];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 自分で環境を取りに行く版。入口（`middleware.ts`）が使う。
 *
 * `"server-only"` を付けていないのは middleware から呼ぶため。
 * middleware は server component ではないので、付けると読み込みで落ちる。
 * 同じ理由で `@opennextjs/cloudflare` は**呼ばれた時に**取り込む。
 * 冒頭で取り込むと、この定数を読むだけの自動テストまで Workers 実行時を要求する。
 */
export async function readSiteBaseDomain(): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return pickSiteBaseDomain(env as unknown as Readonly<Record<string, unknown>>);
  } catch {
    return null;
  }
}
