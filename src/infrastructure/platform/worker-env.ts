import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Worker の環境（設定値と秘密情報）を取る。**無ければ空を返す。**
 *
 * `tryGetDb()`（`persistence/d1/connection.ts`）と同じ考え方である。
 * Workers の外（`pnpm dev` や自動テスト）では供給されないので、
 * ここで例外を投げると、設定が無いだけの環境で画面が真っ白になる。
 *
 * **空で返すことと、黙って動くことは別である。**
 * 空のときに何が足りないかは、必ず画面に文字で出す
 * （鍵の設定画面の「使えない理由」）。
 * 黙って落ちると、鍵を登録したのに使われない、という
 * いちばん気づきにくい形になる。
 *
 * --- 値をここから先へ広げない ---
 * 戻り値は読み取り専用の入れ物で、受け取り側は
 * 参照キーで 1 件ずつ引くだけである（`createSecretResolver`）。
 * この入れ物ごとログや画面へ渡さないこと。中に秘密が入っている。
 */
export async function tryGetWorkerEnv(): Promise<Readonly<Record<string, unknown>>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as Readonly<Record<string, unknown>>;
  } catch {
    return {};
  }
}
