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
  return drizzle(env.DB, { schema });
}

/** R2 バケット (レポートCSV・生成物の保存先) */
export async function getBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.BUCKET;
}

export { schema };
