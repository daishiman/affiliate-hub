import { z } from "zod";
import type { UseCase } from "@/application/usecases/usecase";
import { domainError, err, ok } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";
import type { ToolDefinition } from "./tool-definition";

/**
 * ツール 1 つ分の定型をまとめる。
 *
 * 入力検証の正本は zod ひとつ。ここから JSON Schema を作って
 * REST・WebMCP・バックエンド MCP の 3 つに同じものを配る。
 * ツールごとに検証を書くと、「宣言している形」と
 * 「実際に受け付ける形」が少しずつずれる。
 */

/**
 * 選択肢のどれを選んでも要る項目を、いちばん外側の `required` へ写す。
 *
 * `z.discriminatedUnion` は `oneOf` を出す。枝の中には `required` が付くが、
 * **外側の `required` は空のまま**になる。呼ぶ側が AI のとき、これは嘘に近い——
 * AI は宣言を信じる以外にないので、`required` が空なら「何も入れずに呼べる」と読む。
 * 実際には `action` が無ければ必ず断られる。
 *
 * ここで写すのは**全部の枝に共通するもの**だけである。1 つの枝にしか無い項目を
 * 写すと、今度は逆向きの嘘（要らないものを要ると宣言する）になる。
 * 枝の `required` はそのまま残すので、写しても受け付ける形は変わらない。
 */
function hoistCommonRequired(schema: Record<string, unknown>): Record<string, unknown> {
  const branches = schema.oneOf ?? schema.anyOf;
  if (!Array.isArray(branches) || branches.length === 0) return schema;

  const requiredOf = (branch: unknown): readonly string[] => {
    const value = (branch as { required?: unknown } | null)?.required;
    return Array.isArray(value) ? value.filter((f): f is string => typeof f === "string") : [];
  };

  const common = requiredOf(branches[0]).filter((field) =>
    branches.every((branch) => requiredOf(branch).includes(field)),
  );
  if (common.length === 0) return schema;

  const existing = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  return { ...schema, required: [...new Set([...existing, ...common])] };
}

/**
 * 宣言を、**素のオブジェクトだけでできた形**にする。
 *
 * `z.toJSONSchema()` の戻り値は、見た目は JSON でも素のオブジェクトではない。
 * zod は仕上げに `Object.defineProperty(..., "~standard", { enumerable: false })` で
 * **関数入りの隠し属性**を貼る（`zod/v4/core/to-json-schema.js` の `finalize`）。
 *
 * React はサーバーからブラウザへ渡す値に、列挙できない自前の属性があると
 * 「plain object ではない」と判断して警告を出す。関数は境界を越えられないからである。
 * 宣言は `webmcp-adapter.ts` からブラウザ側の AI へそのまま渡るので、
 * **ここを通った時点で素にしておかないと、全ページで警告が出る。**
 *
 * `JSON.parse(JSON.stringify(...))` にしているのは、隠し属性を名指しで消すより
 * **残る側を数える**ほうが強いからである。zod が次の版で別の隠し属性を足しても、
 * 名指しの除去は取りこぼすが、こちらは JSON に写せるものしか通さない。
 * 宣言は元から JSON Schema——JSON で表せないものが入っていたらそちらが誤りである。
 */
export function toJsonSchema(schema: z.ZodType): Readonly<Record<string, unknown>> {
  const hoisted = hoistCommonRequired(z.toJSONSchema(schema) as Record<string, unknown>);
  return JSON.parse(JSON.stringify(hoisted)) as Record<string, unknown>;
}

/** zod の英語メッセージのままでは利用者が直せないため、要点を日本語に置き換える。 */
export function jaMessage(issue: z.core.$ZodIssue | undefined): string {
  if (issue === undefined) return "入力の形式が正しくありません。";
  const where = issue.path.length > 0 ? `「${issue.path.join(".")}」` : "入力";
  switch (issue.code) {
    case "invalid_type":
      return `${where}の形式が正しくありません。`;
    case "too_small":
      return `${where}が足りません。`;
    case "too_big":
      return `${where}が多すぎます。`;
    default:
      return `${where}を確認してください。`;
  }
}

export function parseWith<T>(schema: z.ZodType<T>): (raw: unknown) => Result<T, DomainError> {
  return (raw) => {
    const result = schema.safeParse(raw);
    if (result.success) return ok(result.data);
    const first = result.error.issues[0];
    return err(
      domainError("VALIDATION_FAILED", jaMessage(first), {
        field: first?.path.join(".") || undefined,
        suggestedAction: "入力の形式を確認して、もう一度お試しください。",
      }),
    );
  };
}

/**
 * 定義を 1 つ作る。
 *
 * `requiresHumanApproval` の既定は false。
 * 人の承認が要る操作（公開・承認・課金・外部への送信）だけ true にする。
 *
 * --- `declaredSchema`（宣言する形）を分けられるようにしてある理由 ---
 * 受け付ける形（`schema`）を**わざと緩くしてある**道具がある。緩くしてあるのは、
 * 欠けているものを入口で弾かずに先まで通し、「何が足りないか」を並べて返すためである
 * （入口で弾くと `` 「provided」の形式が正しくありません `` としか言えない）。
 *
 * その緩さを宣言へそのまま出すと、**必ず断られる入力を「呼べる」と宣言する**ことになる。
 * 呼ぶ側が AI のとき、これは直しようがない——AI は宣言を信じる以外にないので、
 * 断り文を親切にしても、宣言が「要らない」と言っている項目を足そうとは考えない。
 *
 * そこで、宣言だけを実際に通る形へ寄せる。**宣言は受け付ける形より狭くする**。
 * 狭い側を宣言する限り、宣言どおりに組み立てた入力は必ず受け付けられる。
 * 逆（宣言のほうが広い）は今の嘘そのものなので、やらない。
 * 宣言と実際が一致していることは `tests/presentation/tool-catalog-adapters.test.ts` の
 * 「宣言どおりに組み立てた入力が、入力不備で断られない」が総当たりで確かめる。
 */
export function defineTool<Input, Output>(spec: {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType<Input>;
  readonly declaredSchema?: z.ZodType;
  readonly readOnly: boolean;
  readonly requiresHumanApproval?: boolean;
  readonly useCase: UseCase<Input, Output>;
}): ToolDefinition<Input, Output> {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: toJsonSchema(spec.declaredSchema ?? spec.schema),
    readOnly: spec.readOnly,
    requiresHumanApproval: spec.requiresHumanApproval ?? false,
    parse: parseWith(spec.schema),
    useCase: spec.useCase,
  };
}
