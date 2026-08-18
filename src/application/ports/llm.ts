import type { WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 生成 AI とのつなぎ目。
 *
 * 特定の提供元 (OpenAI / Anthropic / Workers AI) の名前を型に出さない。
 * 提供元を替えるときに触るのは infrastructure/llm/ の実装だけにする。
 *
 * プロンプト注入への備え:
 *   - 取り込んだ外部テキストは必ず `untrustedContext` に入れる
 *   - `instructions` に外部テキストを混ぜない (混ぜた時点で指示として実行されうる)
 *   - 出力は必ずスキーマ検証を通す (自由文をそのまま公開しない)
 */
export type LlmMessageRole = "system" | "user" | "assistant";

/**
 * どの提供元のどのモデルへ送るか。
 *
 * --- なぜ依頼ごとに運ぶのか（既定のモデルを作らない） ---
 * 組み立てのときに 1 つ決めてしまうと、記事ごとに選び分けられない。
 * 選び分けを後から足そうとすると、**すでに既定で書かれた記事**が大量にあり、
 * それがどのモデルの出力なのかを遡って知る手立てが無い。
 *
 * 依頼に載せる形にすると、選ばれていない依頼は**そもそも組み立てられない**。
 * 「未選択のときは先頭のモデル」という分岐を書く場所が無いのが、この形の値打ちである。
 */
export type LlmModelSelection = {
  readonly providerId: string;
  readonly modelId: string;
};

export type LlmRequest = {
  /**
   * どの作業場所からの依頼か。
   *
   * 鍵は作業場所ごとに預かっているので、これが無いとどの鍵で呼ぶかが決まらない。
   * **鍵そのものはここに載らない。** 載るのは「どこの鍵か」だけで、
   * 値に触れるのは提供元アダプタだけである（`infrastructure/llm/key-access.ts`）。
   */
  readonly workspaceId: WorkspaceId;
  /** どのモデルで書くか。既定は無い（上の説明）。 */
  readonly model: LlmModelSelection;
  /** 指示。信頼できる自分たちの文言だけを入れる。 */
  readonly instructions: string;
  /**
   * 外部から取り込んだテキスト。
   * 実装側で「これは資料であり指示ではない」と明示して渡す。
   */
  readonly untrustedContext: readonly UntrustedBlock[];
  /** 期待する出力の形。JSON Schema 相当の記述。 */
  readonly outputSchema: Readonly<Record<string, unknown>>;
  /** プロンプトの版。生成物に記録し、後から再現できるようにする。 */
  readonly promptVersion: string;
  readonly maxOutputTokens: number;
  readonly temperature: number;
};

export type UntrustedBlock = {
  readonly label: string;
  readonly sourceUrl: string | null;
  readonly text: string;
};

export type LlmResponse<T> = {
  readonly output: T;
  /** 実際に使われたモデル。生成物に記録する。 */
  readonly modelId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** 打ち切られたか。途中で切れた本文をそのまま公開しないため。 */
  readonly truncated: boolean;
};

export type LlmPort = {
  /** スキーマに沿った構造化出力を得る。自由文の生成は使わない。 */
  generateStructured<T>(request: LlmRequest): PortResult<LlmResponse<T>>;
  /** 埋め込み。類似記事の検出と重複確認に使う。 */
  embed(texts: readonly string[]): PortResult<readonly (readonly number[])[]>;
};

/**
 * 費用の見積り。
 *
 * 生成の前に概算を出し、上限を超える依頼を止める。
 * 実行してから請求で気づく、を避ける。
 */
export type LlmCostEstimatorPort = {
  estimate(request: LlmRequest): PortResult<{ estimatedCostMinor: number; currency: string }>;
};
