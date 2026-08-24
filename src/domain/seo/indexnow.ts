/**
 * IndexNow の通知本文（feat-blog-ui-builder）。
 *
 * IndexNow は「更新した URL を検索エンジンへ即時に知らせる」プロトコル。
 * 送信そのもの（fetch・鍵の取得）はインフラ層
 * （`src/infrastructure/indexnow/indexnow-client.ts`）が行い、
 * ここは**本文の形を組み立てるだけ**の純関数に留める。
 * 形をドメインに置くのは、鍵の置き場所（keyLocation）の決まりを
 * 送信コードの中に埋めると、テストで形を確かめる手段が送信の擬装になるため。
 */

export type IndexNowSubmission = {
  /** 通知対象のホスト名（例: example.com）。 */
  readonly host: string;
  /** サイト所有の証明に使う鍵。 */
  readonly key: string;
  /** 鍵ファイルの置き場所。`https://<origin>/indexnow.txt` に固定する。 */
  readonly keyLocation: string;
  readonly urlList: readonly string[];
};

/**
 * 通知本文を組み立てる。
 *
 * URL が 0 件なら **null を返す**。空の urlList を送らせないのは、
 * 「何も更新していないのに通知だけ飛ぶ」経路を型の外に出さないため。
 * origin が URL として読めないときも null（壊れた設定で半端な本文を作らない）。
 */
export function buildIndexNowSubmission(
  origin: string,
  key: string,
  urls: readonly string[],
): IndexNowSubmission | null {
  if (urls.length === 0) return null;

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return null;
  }

  return {
    host,
    key,
    keyLocation: `${origin}/indexnow.txt`,
    urlList: [...urls],
  };
}
