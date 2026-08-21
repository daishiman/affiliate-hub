import { tryGetDb } from "./persistence/d1/connection";
import type { DrizzleD1 } from "./persistence/d1/link-inbox-repository";
import { tryGetWorkerEnv } from "./platform/worker-env";

/**
 * 実行のたびに変わるもの（保存先と環境）を 1 度にそろえる。
 *
 * **2 つを別々に取りに行かせない。** 片方だけ渡す呼び出しが混ざると、
 * 「保存先はつながっているのに鍵が見えない」という、
 * 画面には何も出ない食い違いが生まれる（実際に `createLlmPorts()` が
 * 環境なしで呼ばれ続けていた）。1 つの関数から両方返せば、
 * 片方を忘れる書き方が残らない。
 *
 * どちらも無いときは `null` と `{}` を返す。例外にしない理由は
 * `tryGetDb` と `tryGetWorkerEnv` の説明のとおりで、
 * **無いこと自体は画面に文字で出す**（黙って見本へ落ちない）。
 */
export async function appContext(): Promise<{
  readonly db: DrizzleD1 | null;
  readonly env: Readonly<Record<string, unknown>>;
}> {
  return { db: await tryGetDb(), env: await tryGetWorkerEnv() };
}
