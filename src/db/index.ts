import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * リクエストスコープの Drizzle インスタンスを返す。
 *
 * Workers ではバインディングがリクエストごとに供給されるため、
 * モジュールトップレベルでインスタンス化してはいけない。
 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  // **無い接続を、あることにしない。** `drizzle(undefined)` は例外を投げずに
  // 使えない相手を返すため、呼び出し側は「つながっている」と判断してしまう。
  // すると画面には「保存されます」と出たまま、実際の保存だけが落ちる。
  // ここで止めれば `tryGetDb()` が null を返し、見本として正直に出る。
  if (env.DB === undefined || env.DB === null) {
    throw new Error("D1 のバインディング DB がありません（Workers の外か、設定漏れです）。");
  }
  return drizzle(env.DB, { schema });
}

/** R2 バケット (レポートCSV・生成物の保存先) */
export async function getBucket() {
  const { env } = await getCloudflareContext({ async: true });
  if (env.BUCKET === undefined || env.BUCKET === null) {
    throw new Error("R2 のバインディング BUCKET がありません（Workers の外か、設定漏れです）。");
  }
  return env.BUCKET;
}

export { schema };
