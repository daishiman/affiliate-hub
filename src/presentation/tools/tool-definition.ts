import type { UseCase } from "@/application/usecases/usecase";
import type { ActorContext, DomainError, Result } from "@/domain/shared";
import { domainError, err } from "@/domain/shared";

/**
 * ツール定義。
 *
 * **REST API・WebMCP・バックエンド MCP は、この 1 つの定義から作る。**
 * ロジックを 3 回書かないための要 (要求 C)。
 *
 *   ツール定義 ─┬─→ REST の Route Handler
 *               ├─→ WebMCP (document.modelContext)
 *               └─→ バックエンド MCP (JSON-RPC)
 *
 * 定義に書いてよいのは「入力の受け取り方」と「どのユースケースを呼ぶか」だけ。
 * 業務の判断をここに書いたら、3 つの入口で結果が食い違い始める。
 */
export type ToolDefinition<Input, Output> = {
  /** 機械が使う名前。`snake_case`。変えると外部の設定が壊れるので慎重に。 */
  readonly name: string;
  /** 人と AI が読む説明。何ができるかと、何ができないかを書く。 */
  readonly description: string;
  /** 入力の形 (JSON Schema 相当)。3 つの入口で同じものを配る。 */
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /**
   * 読み取り専用か。**これは「外への申告」であって、載せ先の決定ではない。**
   *
   * この値を 1 つ変えると、変わるのは次の 2 つだけである。
   *
   *   1. MCP の `readOnlyHint`（`mcp-adapter.ts`）。呼ぶ側への申告
   *   2. 自サイトの画面からの実行可否（`http/tool-scope.ts`。
   *      ログインしていない可能性がある呼び出しには読み取りだけを許す）
   *
   * **変わらないもの**（かつて黙って変わっていたもの）:
   *
   *   - **WebMCP に載るかどうか** … `webmcp-policy.ts` の `PAGE_TOOLS` が決める。
   *     表に名前が無ければ載らない。ここを true にしても載らない
   *   - **検査の対象に入るかどうか** … `tests/presentation/tool-inputs.ts` に
   *     入力の見本があるかで決まる。ここを false にしても検査から外れない
   *
   * この 3 つは以前この 1 語が兼ねており、①のつもりで書いた `true` が③に効いて
   * `export_manual_draft` が記事の本文をページ内の AI へ渡していた。逆に `false` へ
   * 直すと②から外れ、テナント分離の検査対象から静かに消えた。分けたのはそのため。
   *
   * **この値が事実と合っているかは、旗を読む検査では分からない。**
   * `tests/presentation/readonly-honesty.test.ts` が、`true` を名乗る道具を
   * 実際に動かして記録の口へ手が伸びないことを測っている。
   */
  readonly readOnly: boolean;
  /**
   * 人の承認が要る操作か。
   * true のツールは AI サービスアカウントから呼べない (公開・承認・課金など)。
   */
  readonly requiresHumanApproval: boolean;
  /** 生の入力を検証して型にする。失敗は利用者が直せる文言で返す。 */
  parse(raw: unknown): Result<Input, DomainError>;
  /** 実処理。ユースケースそのもの。 */
  readonly useCase: UseCase<Input, Output>;
};

/**
 * ツールを呼ぶ。
 *
 * 権限の最終判定はユースケース側で行う。ここでは
 * 「AI に人の承認が要る操作をさせない」という入口の門だけを見る。
 */
export async function invokeTool<I, O>(
  tool: ToolDefinition<I, O>,
  actor: ActorContext,
  raw: unknown,
): Promise<Result<O, DomainError>> {
  if (tool.requiresHumanApproval && actor.isAiServiceAccount) {
    return err(
      domainError("FORBIDDEN", "この操作は人が行う必要があります。", {
        suggestedAction: "担当者が画面から実行してください。",
        details: { tool: tool.name },
      }),
    );
  }

  const parsed = tool.parse(raw);
  if (!parsed.ok) return parsed;

  return tool.useCase.execute(actor, parsed.value);
}

/** 型の違うツールをまとめて持つための箱。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- カタログは異なる入出力型を1つの配列に並べる
export type AnyToolDefinition = ToolDefinition<any, any>;
