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

export function toJsonSchema(schema: z.ZodType): Readonly<Record<string, unknown>> {
  return z.toJSONSchema(schema) as Readonly<Record<string, unknown>>;
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
 */
export function defineTool<Input, Output>(spec: {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType<Input>;
  readonly readOnly: boolean;
  readonly requiresHumanApproval?: boolean;
  readonly useCase: UseCase<Input, Output>;
}): ToolDefinition<Input, Output> {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: toJsonSchema(spec.schema),
    readOnly: spec.readOnly,
    requiresHumanApproval: spec.requiresHumanApproval ?? false,
    parse: parseWith(spec.schema),
    useCase: spec.useCase,
  };
}
