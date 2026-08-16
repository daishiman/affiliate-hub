import { z } from "zod";

/**
 * ツールの「仕様」だけを持つモジュール。
 *
 * DB や Cloudflare バインディングに依存しないため、ブラウザ(WebMCP)からも
 * 安全に import できる。実処理は tools.ts 側で紐付ける。
 */

export const listProgramsInput = z.object({
  status: z
    .enum(["active", "paused", "closed"])
    .optional()
    .describe("案件のステータスで絞り込む。省略時は全件。"),
  limit: z.number().int().min(1).max(100).default(20).describe("取得件数の上限"),
});

export const recordConversionInput = z.object({
  programId: z.string().min(1).describe("成果が発生した案件のID"),
  occurredAt: z.string().describe("成果発生日 (YYYY-MM-DD)"),
  amount: z.number().int().describe("報酬額(円)。未確定時は見込み額。"),
  status: z
    .enum(["pending", "approved", "rejected"])
    .default("pending")
    .describe("ASP 側の確定状態"),
  externalId: z.string().optional().describe("ASP 側の一意キー。再取り込み時の重複排除に使う。"),
});

export const revenueSummaryInput = z.object({
  from: z.string().describe("集計開始日 (YYYY-MM-DD, 含む)"),
  to: z.string().describe("集計終了日 (YYYY-MM-DD, 含む)"),
  programId: z.string().optional().describe("特定案件に絞る場合のID"),
});

export type ToolSpec<TSchema extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  inputSchema: TSchema;
  /** ブラウザ(WebMCP)にも公開してよいか。書き込み系は false にしている。 */
  exposeToBrowser: boolean;
};

export const listProgramsSpec: ToolSpec<typeof listProgramsInput> = {
  name: "list_programs",
  title: "案件一覧の取得",
  description:
    "登録済みのアフィリエイト案件を一覧する。ステータスで絞り込める。案件IDは他のツールの引数に使う。",
  inputSchema: listProgramsInput,
  exposeToBrowser: true,
};

export const recordConversionSpec: ToolSpec<typeof recordConversionInput> = {
  name: "record_conversion",
  title: "成果の記録",
  description: "案件に対する成果(コンバージョン)を1件登録する。",
  inputSchema: recordConversionInput,
  exposeToBrowser: false,
};

export const revenueSummarySpec: ToolSpec<typeof revenueSummaryInput> = {
  name: "get_revenue_summary",
  title: "収益サマリの取得",
  description:
    "指定期間の収益を集計する。確定(approved)と見込み(pending)を分けて返す。ダッシュボードと AI エージェントが同じ数字を見るための唯一の集計口。",
  inputSchema: revenueSummaryInput,
  exposeToBrowser: true,
};

export const TOOL_SPECS: ToolSpec[] = [
  listProgramsSpec,
  recordConversionSpec,
  revenueSummarySpec,
];

/** ブラウザ(WebMCP)に公開するツール仕様 */
export const BROWSER_TOOL_SPECS: ToolSpec[] = TOOL_SPECS.filter((s) => s.exposeToBrowser);
