import { getDb } from "@/db";
import type { DrizzleD1 } from "./link-inbox-repository";

/**
 * D1 への接続を取る。**無ければ null を返す。**
 *
 * Workers の外（`pnpm dev` や自動テスト）では、そもそも接続が供給されない。
 * ここで例外を投げると、保存先が無いだけの環境で画面が真っ白になる。
 *
 * **ただし「黙って見本データに落ちる」ことはしない。**
 * 何で動いているかは、必ず画面に文字で出す（`linkInboxNotice`）。
 * 黙って落ちると、「保存したのに消えた」が不具合として報告され、
 * 原因を探すのに一番時間がかかる形になる。
 */
export async function tryGetDb(): Promise<DrizzleD1 | null> {
  try {
    return await getDb();
  } catch {
    return null;
  }
}
