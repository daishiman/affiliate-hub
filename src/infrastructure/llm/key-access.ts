import type { LlmUsageEntry } from "@/application/ports/llm-usage";
import type { PortResult } from "@/application/ports/common";
import type { WorkspaceId } from "@/domain/shared";

/**
 * 鍵の値と利用量の記録に触れる口。**応用層には置かない。**
 *
 * --- なぜここに居るか ---
 * どちらも「呼ぶのは提供元アダプタだけ」で、ユースケース・画面・API からは
 * 一度も呼ばれない。`src/application/ports` に並べておくと、
 * つなぎ目の検査に「呼ばれていない口」として出続けるだけでなく、
 * 読む人には**使ってよい口に見える**。見えれば、いつか誰かが使う。
 *
 * 型として届かない場所へ移すと、応用層から鍵へ至る道がそもそも無くなる。
 * 実装（`d1/llm-credential-repository.ts` と `d1/llm-usage-repository.ts`）は
 * 応用層のポートとこちらの両方を満たす 1 つの物として作る。
 */
export type LlmKeyAccess = {
  /**
   * 呼び出しのときだけ鍵を使う。**値が出てくるのはここだけ。**
   *
   * `fn` の戻り値はそのまま返るが、鍵は返らない。
   * `fn` の中で投げられた例外は、実装側で鍵を塗り潰してから包み直す。
   */
  useKey<T>(input: {
    readonly workspaceId: WorkspaceId;
    readonly providerId: string;
    readonly fn: (apiKey: string) => Promise<T>;
  }): PortResult<T>;
};

/**
 * 使った量を書き留める口。
 *
 * --- なぜ「任意」にしないか ---
 * 記録を省ける形（省略可能な引数・null 許容）にすると、
 * 呼び出しを足すたびに記録が漏れ、**漏れても画面は何も変わらない**。
 * 気づくのは請求が来たときになる。
 * よってアダプタの組み立てにこの口を必須で要求し、
 * 「記録しない呼び出し」を作れない形にする。
 *
 * --- 失敗も記録する ---
 * 提供元は、失敗した呼び出しにも入力ぶんの料金を掛けることがある。
 * 成功だけ数えると、使った量と請求がずれる理由が分からなくなる。
 */
export type LlmUsageRecorder = {
  record(entry: LlmUsageEntry): PortResult<void>;
};
