/** @tier 1 */
import { describe, expect, it } from "vitest";
import {
  createD1LinkInboxRepository,
  type DrizzleD1,
} from "@/infrastructure/persistence/d1/link-inbox-repository";
import { createSampleLinkIngestionRepository } from "@/infrastructure/persistence/sample/link-inbox-sample-repository";
import { createDeps } from "@/infrastructure/composition";
import type { LinkIngestionRow } from "@/db/schema";
import { asLinkIngestionId, asWorkspaceId } from "@/domain/shared";
import type { LinkIngestionId, WorkspaceId } from "@/domain/shared";

/**
 * 保存先を D1 へ替えたときに、上の層が何も変わらないことの確認
 * （変更容易性シナリオ ⑥）。
 *
 * ここで見るのは 3 つ。
 *   1. 行とドメインの往復で、値が失われたり形が変わったりしないこと
 *   2. 受け取った URL を**保存の都合で書き換えていない**こと
 *   3. 「次のページがあるか」の判定で、件数を数える問い合わせを足していないこと
 *
 * 本物の D1 は動かせないので、問い合わせの組み立てだけを受け取る偽の接続を使う。
 * SQL が正しいかはここでは分からない。**分からないことを分かった形にしない**ため、
 * 実際の疎通は `pnpm run preview` での確認に回している。
 */

const WS = asWorkspaceId("ws_sample") as WorkspaceId;

function row(over: Partial<LinkIngestionRow> = {}): LinkIngestionRow {
  return {
    id: "li_1",
    workspaceId: "ws_sample",
    submittedUrl: "https://af.example.com/click?a=1&b=2",
    normalizedUrl: "https://af.example.com/click?a=1&b=2",
    source: "paste",
    submittedAt: new Date("2026-08-01T00:00:00.000Z"),
    state: "received",
    programId: null,
    productId: null,
    duplicateOf: null,
    note: null,
    rejectedReason: null,
    ...over,
  };
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb(rows: readonly LinkIngestionRow[]) {
  const saved: LinkIngestionRow[] = [];
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (n: number) => Promise.resolve(rows.slice(0, n)),
  };
  const db = {
    select: () => chain,
    insert: () => ({
      values: (v: LinkIngestionRow) => ({
        onConflictDoUpdate: () => {
          saved.push(v);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db: db as unknown as DrizzleD1, saved };
}

describe("受信箱の保存先を D1 にする", () => {
  it("行から読み戻しても、受け取った URL がそのままである", async () => {
    const original = "https://af.example.com/click?a=1&b=2&utm=x";
    const { db } = fakeDb([row({ submittedUrl: original, normalizedUrl: "normalized-form" })]);
    const repo = createD1LinkInboxRepository(db);

    const found = await repo.findById(WS, asLinkIngestionId("li_1") as LinkIngestionId);
    expect(found.ok).toBe(true);
    if (!found.ok || found.value === null) throw new Error("読み出せていません");
    // 保存の都合で URL を書き換えると、ASP の規約違反になりうる。
    expect(found.value.submittedUrl).toBe(original);
    // 重複判定用の形は別に持つ（表示には使わない）。
    expect(found.value.normalizedUrl).toBe("normalized-form");
  });

  it("見つからないときは失敗ではなく null を返す", async () => {
    const { db } = fakeDb([]);
    const found = await createD1LinkInboxRepository(db).findById(
      WS,
      asLinkIngestionId("li_absent") as LinkIngestionId,
    );
    expect(found.ok).toBe(true);
    if (found.ok) expect(found.value).toBeNull();
  });

  it("次のページがあるときだけ続きの目印を返す", async () => {
    const many = [
      row({ id: "li_1", submittedAt: new Date("2026-08-03T00:00:00.000Z") }),
      row({ id: "li_2", submittedAt: new Date("2026-08-02T00:00:00.000Z") }),
      row({ id: "li_3", submittedAt: new Date("2026-08-01T00:00:00.000Z") }),
    ];
    const repo = createD1LinkInboxRepository(fakeDb(many).db);

    const page = await repo.list(WS, { state: null }, { limit: 2, cursor: null });
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.value.items.map((i) => String(i.id))).toEqual(["li_1", "li_2"]);
    // 3 件目があるので続きの目印が出る。件数を数える問い合わせは足していない。
    expect(page.value.nextCursor).toBe(String(new Date("2026-08-02T00:00:00.000Z").getTime()));

    const last = await repo.list(WS, { state: null }, { limit: 5, cursor: null });
    if (last.ok) expect(last.value.nextCursor).toBeNull();
  });

  it("保存では、受け取った値をそのまま行にする", async () => {
    const { db, saved } = fakeDb([]);
    const repo = createD1LinkInboxRepository(db);
    const found = await createD1LinkInboxRepository(fakeDb([row()]).db).findById(
      WS,
      asLinkIngestionId("li_1") as LinkIngestionId,
    );
    if (!found.ok || found.value === null) throw new Error("前提の読み出しに失敗");

    const result = await repo.save(found.value);
    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].submittedUrl).toBe(found.value.submittedUrl);
    expect(saved[0].id).toBe("li_1");
  });

  it("保存先が落ちたら、成功したふりをせず再試行できる失敗を返す", async () => {
    const broken = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.reject(new Error("D1_ERROR")),
          }),
        }),
      }),
    } as unknown as DrizzleD1;

    const result = await createD1LinkInboxRepository(broken).findById(
      WS,
      asLinkIngestionId("li_1") as LinkIngestionId,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
    // 例外の中身をそのまま出さない（接続文字列が混じることがある）。
    expect(JSON.stringify(result.error)).not.toContain("D1_ERROR");
  });
});

describe("差し替えは合成ルート 1 箇所で済む", () => {
  it("接続が無ければ見本データ、あれば D1 になる", () => {
    const withoutDb = createDeps();
    const withDb = createDeps({ db: fakeDb([]).db });
    // 同じ形（同じ契約）でありながら、中身が入れ替わっている。
    expect(Object.keys(withoutDb.linkInbox).sort()).toEqual(Object.keys(withDb.linkInbox).sort());
    expect(withoutDb.linkInbox).not.toBe(withDb.linkInbox);
  });

  it("見本データ版と D1 版が同じ操作を持っている", () => {
    const sample = createSampleLinkIngestionRepository();
    const d1 = createD1LinkInboxRepository(fakeDb([]).db);
    expect(Object.keys(d1).sort()).toEqual(
      Object.keys(sample)
        .filter((k) => k !== "__commercial")
        .sort(),
    );
  });
});
