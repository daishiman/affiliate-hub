import type { AppDeps } from "@/application/deps";
import type { DomainEvent, EventPublisherPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { LlmRequest } from "@/application/ports/llm";
import type { AuditLogEntry } from "@/domain/compliance";
import type { WorkspaceId } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import type { LlmProviderContext } from "@/infrastructure/llm/llm-provider-registry";
import type { LlmPricingLookup } from "@/infrastructure/llm/pricing";
import { markCommercial, markEditorial, readDataClass } from "@/domain/shared/data-classification";
import { type DomainError, domainError } from "@/domain/shared/errors";
import { type Result, err, ok } from "@/domain/shared/result";

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
 *
 * **Editorial / Commercial の印を引き継ぐ。** 印は列挙されない形で付いているので、
 * 展開して組み直すと黙って消える。消えたまま渡すと、ユースケースは
 * 組み立てた時点で「印が付いていません」と例外になり、
 * 差し替えた中身とは何の関係も無い場所で落ちる。
 */
export function testDeps(overrides: DeepPartialDeps = {}): AppDeps {
  const base = createDeps();
  const result = { ...base } as Record<string, unknown>;
  for (const [key, patch] of Object.entries(overrides)) {
    if (patch === undefined) continue;
    const original = (base as Record<string, unknown>)[key];
    const merged = { ...(original as object), ...(patch as object) };
    const dataClass = readDataClass(original);
    result[key] =
      dataClass === "editorial"
        ? markEditorial(merged)
        : dataClass === "commercial"
          ? markCommercial(merged)
          : merged;
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
export function recordingEvents(): {
  readonly port: EventPublisherPort;
  readonly published: () => readonly DomainEvent[];
  readonly names: () => string[];
  readonly clear: () => void;
} {
  const published: DomainEvent[] = [];
  return {
    port: {
      publish: async (event: DomainEvent) => {
        published.push(event);
        return ok(true as const);
      },
    },
    published: () => published,
    names: () => published.map((e) => e.name),
    clear: () => {
      published.length = 0;
    },
  };
}

/**
 * 溜めておく操作の記録先。
 *
 * 見本の記録先（`createSampleAuditLog`）は 2026-08-18 から、控え
 * （この実行中だけ覚える置き場）へ**本当に追記する**ようになった。
 * ただしあちらは「残ったこと」を確かめる作りではないので、
 * **何が記録されたかを 1 件ずつ読みたいテスト**にはここを使う。
 *
 * 追記が断られる側を見たいときは `createUnavailableAuditLog()` を指す。
 * 見本のほうへ戻すと、断られる道筋の検査が**緑のまま何も確かめなくなる**。
 *
 * 実際に D1 へ書けるかどうかは結合テスト（tests/integration/d1-content.test.ts）が見る。
 */
export function recordingAuditLog(): {
  readonly port: AuditLogPort;
  readonly entries: () => readonly AuditLogEntry[];
  readonly actions: () => string[];
} {
  const entries: AuditLogEntry[] = [];
  return {
    port: {
      append: async (entry: AuditLogEntry) => {
        entries.push(entry);
        return ok(entry.id);
      },
      listByTarget: async (_ws, targetType, targetId) =>
        ok(entries.filter((e) => e.targetType === targetType && e.targetId === targetId)),
      search: async (_ws, _query, page) =>
        ok({ items: entries.slice(0, page.limit), nextCursor: null }),
    },
    entries: () => entries,
    actions: () => entries.map((e) => e.action),
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

/**
 * 生成 AI への依頼の雛形。
 *
 * **どの作業場所の・どのモデルへ**は依頼が運ぶ（既定のモデルを置かないため）。
 * 検査ごとに書き起こすと、欄が 1 つ増えるたびに全部を直すことになる。
 */
export function anLlmRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
  return {
    workspaceId: "ws_test" as WorkspaceId,
    model: { providerId: "anthropic", modelId: "test-model" },
    instructions: "商品の仕様を表にまとめてください。",
    untrustedContext: [],
    outputSchema: { type: "object" },
    promptVersion: "v1",
    maxOutputTokens: 1000,
    temperature: 0.2,
    ...overrides,
  };
}

/** 決まった単価を返す引き当て。目録を組み立てずに単価だけ与えたいとき用。 */
export function fixedPricing(
  pricing: {
    readonly inputMinorPerMillionTokens: number;
    readonly outputMinorPerMillionTokens: number;
    readonly currency: string;
  } = { inputMinorPerMillionTokens: 1_000, outputMinorPerMillionTokens: 5_000, currency: "JPY" },
): LlmPricingLookup {
  return { find: async () => ok(pricing) };
}

/**
 * 組み立てにだけ使う提供元の文脈。
 *
 * **呼ばれたら落ちる**ようにしてある。組み立てられることだけを見たい検査で、
 * 中身が呼ばれてしまったことに気づけるようにするため
 * （静かに空を返すと、呼んでいないつもりの検査が通ってしまう）。
 */
export function llmProviderContextDouble(): LlmProviderContext {
  const notCalled = (): never => {
    throw new Error("この検査では提供元を呼ばない");
  };
  return {
    vault: { useKey: notCalled },
    usage: { record: notCalled },
    pricing: { find: notCalled },
  };
}
