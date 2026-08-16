import { desc } from "drizzle-orm";

import { getDb } from "@/db";
import { programs } from "@/db/schema";

export const dynamic = "force-dynamic";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });

async function loadPrograms() {
  try {
    const db = await getDb();
    return await db.select().from(programs).orderBy(desc(programs.updatedAt)).limit(20);
  } catch {
    // マイグレーション未適用など、DB がまだ使えない状態でも画面は出す
    return null;
  }
}

export default async function Home() {
  const rows = await loadPrograms();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">affiliate-hub</h1>
        <p className="mt-2 text-sm text-neutral-500">
          アフィリエイト案件と成果データを一元管理する
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-medium text-neutral-500">案件</h2>

        {rows === null ? (
          <p className="rounded border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
            データベースに接続できませんでした。
            <code className="mx-1 rounded bg-neutral-100 px-1">pnpm db:migrate:local</code>
            を実行してください。
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
            案件がまだ登録されていません。MCP ツール
            <code className="mx-1 rounded bg-neutral-100 px-1">list_programs</code>
            /<code className="mx-1 rounded bg-neutral-100 px-1">record_conversion</code>
            から操作できます。
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
            {rows.map((program) => (
              <li key={program.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{program.name}</p>
                  <p className="text-xs text-neutral-500">
                    {program.advertiser ?? "広告主未設定"} / {program.status}
                  </p>
                </div>
                <p className="text-sm tabular-nums">
                  {program.rewardAmount !== null
                    ? yen.format(program.rewardAmount)
                    : program.rewardRate !== null
                      ? `${(program.rewardRate * 100).toFixed(1)}%`
                      : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 text-xs text-neutral-400">
        MCP エンドポイント: <code>/api/mcp</code>
      </footer>
    </main>
  );
}
