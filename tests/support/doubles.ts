import type { AppDeps } from "@/application/deps";
import { createDeps } from "@/infrastructure/composition";
import { type DomainError, domainError } from "@/domain/shared/errors";
import { type Result, err } from "@/domain/shared/result";

/**
 * テスト用のつなぎ目（ポート）の差し替え。
 *
 * **モックの呼び出し回数を検証しない。** 「products.list が 1 回呼ばれた」を固定すると、
 * 同じ結果を返すより良い実装（まとめて取る・キャッシュする）に変えた瞬間にテストが落ちる。
 * それは壊れたのではなく、**テストが実装の書き方を固定してしまっている**状態で、
 * 変更しやすさを最も直接的に殺す。見るのは戻り値と、外に出た結果だけにする。
 *
 * 差し替えはポート単位で行う。関数単位でモックしないのは、
 * ポートが「差し替えられる」ことこそ設計上の約束だからで、
 * そこを通さない差し替えは、その約束が守られているかを何も確かめない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §4 / docs/architecture/testing-architecture.md §2
 */

type DeepPartialDeps = {
  readonly [K in keyof AppDeps]?: Partial<AppDeps[K]>;
};

/**
 * 見本の実装一式を土台に、指定したつなぎ目だけを差し替える。
 *
 * 全部を自前で組み立てさせない理由: `AppDeps` に 1 つポートが増えたとき、
 * 自前で組み立てているテストは**全部が型エラーになる**。
 * ここを通していれば、増えたポートは見本の実装が埋める。
 *
 * ```ts
 * const deps = testDeps({
 *   products: { search: async () => ok({ items: [aProduct()], nextCursor: null }) },
 * });
 * ```
 */
export function testDeps(overrides: DeepPartialDeps = {}): AppDeps {
  const base = createDeps();
  const result = { ...base } as Record<string, unknown>;
  for (const [key, patch] of Object.entries(overrides)) {
    if (patch === undefined) continue;
    const original = (base as Record<string, unknown>)[key];
    result[key] = { ...(original as object), ...(patch as object) };
  }
  return result as AppDeps;
}

/**
 * 呼ばれたら必ず失敗を返すつなぎ目。
 *
 * 「まだ繋がっていない」状態を、**成功したふりで隠さない**ために使う。
 * 空配列を返すスタブは、繋がっているのに結果が 0 件という
 * 最も分かりにくい壊れ方をそのまま作る。
 */
export function failing<T>(reason = "この機能はまだ繋がっていません。"): Result<T, DomainError> {
  return err(
    domainError("NOT_IMPLEMENTED", reason, {
      suggestedAction: "接続情報の登録が済むまで、この操作は使えません。",
    }),
  );
}

/**
 * 起きたことを溜めておく発行口。
 *
 * 呼び出し回数ではなく**何が起きたと宣言されたか**を見る。
 * 出来事は他の仕組み（通知・再生成）への入力なので、
 * 名前と中身は外から見える約束にあたる。
 */
export function recordingEvents() {
  const published: { name: string; payload: unknown }[] = [];
  return {
    port: {
      publish: async (name: string, payload: unknown) => {
        published.push({ name, payload });
      },
    },
    published: () => published as readonly { name: string; payload: unknown }[],
    names: () => published.map((e) => e.name),
    clear: () => {
      published.length = 0;
    },
  };
}

/**
 * 溜めておく計測の受け口。
 *
 * 同意が無いときに何が落ちるかは、**送る側ではなくここで確かめる**。
 * 画面ごとに判断させると、1 画面直し忘れただけで漏れる。
 */
export function recordingTelemetry() {
  const received: unknown[] = [];
  return {
    port: {
      record: async (event: unknown) => {
        received.push(event);
      },
    },
    received: () => received as readonly unknown[],
    count: () => received.length,
    clear: () => {
      received.length = 0;
    },
  };
}

/**
 * 決まった答えを返す生成 AI。
 *
 * 本物を呼ぶと、費用がかかり、毎回違う文章が返り、外部の都合で落ちる。
 * テストで確かめたいのは**受け取った文章をどう扱うか**であって、
 * 文章の出来ではない。
 */
export function scriptedLlm(responses: readonly string[]) {
  let i = 0;
  return {
    complete: async () => {
      const text = responses[i % responses.length] ?? "";
      i += 1;
      return text;
    },
    calls: () => i,
  };
}
