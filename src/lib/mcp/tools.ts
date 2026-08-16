import "server-only";

import { and, desc, eq, gte, lte } from "drizzle-orm";

import { getDb } from "@/db";
import { conversions, programs } from "@/db/schema";

import {
  listProgramsInput,
  listProgramsSpec,
  recordConversionInput,
  recordConversionSpec,
  revenueSummaryInput,
  revenueSummarySpec,
  type ToolSpec,
} from "./specs";
import { errorResult, jsonResult, type ToolResult } from "./types";

/** 仕様(specs.ts)にサーバー側の実処理を紐付けたもの */
export type Tool<TSpec extends ToolSpec = ToolSpec> = TSpec & {
  handler: (input: never) => Promise<ToolResult>;
};

/** YYYY-MM-DD 形式の日付文字列を Date に変換する */
function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

const listPrograms = {
  ...listProgramsSpec,
  async handler(input: unknown): Promise<ToolResult> {
    const { status, limit } = listProgramsInput.parse(input);
    const db = await getDb();
    const rows = await db
      .select()
      .from(programs)
      .where(status ? eq(programs.status, status) : undefined)
      .orderBy(desc(programs.updatedAt))
      .limit(limit);
    return jsonResult({ count: rows.length, programs: rows });
  },
};

const recordConversion = {
  ...recordConversionSpec,
  async handler(input: unknown): Promise<ToolResult> {
    const { programId, occurredAt, amount, status, externalId } =
      recordConversionInput.parse(input);
    const db = await getDb();
    const program = await db.select().from(programs).where(eq(programs.id, programId)).limit(1);
    if (program.length === 0) {
      return errorResult(`案件が見つかりません: ${programId}`);
    }
    const id = crypto.randomUUID();
    await db.insert(conversions).values({
      id,
      programId,
      occurredAt: parseDate(occurredAt),
      amount,
      status,
      externalId,
    });
    return jsonResult({ id, programId, occurredAt, amount, status });
  },
};

const revenueSummary = {
  ...revenueSummarySpec,
  async handler(input: unknown): Promise<ToolResult> {
    const { from, to, programId } = revenueSummaryInput.parse(input);
    const db = await getDb();
    const rows = await db
      .select()
      .from(conversions)
      .where(
        and(
          gte(conversions.occurredAt, parseDate(from)),
          lte(conversions.occurredAt, parseDate(to)),
          programId ? eq(conversions.programId, programId) : undefined,
        ),
      );

    // アフィリエイトの報酬は事後に却下されうるため、確定(approved)と
    // 見込み(pending)を合算せずに分けて返す。合算した数字だけを返すと
    // ダッシュボードも AI も楽観的な収益を報告してしまう。
    const byProgram = new Map<
      string,
      { approved: number; pending: number; rejected: number; conversions: number; clicks: number }
    >();

    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let clicks = 0;

    for (const row of rows) {
      const bucket = byProgram.get(row.programId) ?? {
        approved: 0,
        pending: 0,
        rejected: 0,
        conversions: 0,
        clicks: 0,
      };
      bucket[row.status] += row.amount;
      bucket.conversions += 1;
      bucket.clicks += row.clicks;
      byProgram.set(row.programId, bucket);

      if (row.status === "approved") approved += row.amount;
      else if (row.status === "pending") pending += row.amount;
      else rejected += row.amount;
      clicks += row.clicks;
    }

    return jsonResult({
      period: { from, to },
      // 確定済みの収益。実際に受け取れる見込みが最も高い数字。
      approvedRevenue: approved,
      // 未確定。却下されると消えるため確定収益とは足さないこと。
      pendingRevenue: pending,
      rejectedRevenue: rejected,
      conversionCount: rows.length,
      clicks,
      conversionRate: clicks > 0 ? rows.length / clicks : null,
      byProgram: Object.fromEntries(byProgram),
    });
  },
};

/** Remote MCP エンドポイントが公開する全ツール */
export const TOOLS = [listPrograms, recordConversion, revenueSummary];

export function findTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}
