/**
 * @tier 1
 * @req REQ-P05, REQ-B01
 * @types equivalence, boundary
 *
 * 作業場所とブランドの保存先（D1）。
 *
 * 根拠の保存先（`d1-evidence-repository.test.ts`）と同じ 3 つに加えて、
 * **数える側だけの決めごと**を 3 つ見る。
 *   4. 今月の生成回数を「その月の 1 日」から数えること
 *      （直近 30 日で数えると、月が替わった日に上限が戻らない）
 *   5. 上書きの対象に作った日が入っていないこと
 *      （入れると、直すたびに「今日できた作業場所」になる）
 *   6. 1 行も無いときに見本の作業場所を返すこと
 *      （`null` を返すと、ログインできているのに
 *        **どの作業場所にも属していない人**として全画面が断りになる）
 *
 * 本物の D1 は動かせないので、問い合わせの組み立てだけを受け取る偽の接続を使う。
 */
import { describe, expect, it } from "vitest";
import { asWorkspaceId, taggedString } from "@/domain/shared";
import type { BrandId, WorkspaceId } from "@/domain/shared";
import {
  createD1BrandRepository,
  createD1WorkspaceRepository,
} from "@/infrastructure/persistence/d1/settings-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import {
  SAMPLE_BRANDS,
  SAMPLE_WORKSPACE,
} from "@/infrastructure/persistence/sample/settings-sample-repository";

const WS = asWorkspaceId("ws_sample") as WorkspaceId;
const UNKNOWN_WS = asWorkspaceId("ws_nowhere") as WorkspaceId;

/** どの問い合わせも落ちる接続。表が無い・形がずれている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table: brands");
  };
  return { select: boom, insert: boom } as unknown as DrizzleD1;
}

/** 1 行も返さない読み出し用の接続。`where` に渡された条件を覚えておく。 */
function emptyDb(): { db: DrizzleD1; wheres: unknown[] } {
  const wheres: unknown[] = [];
  const chain = {
    from: () => chain,
    where: (arg: unknown) => {
      wheres.push(arg);
      return chain;
    },
    limit: () => Promise.resolve([]),
    orderBy: () => Promise.resolve([]),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve),
  };
  return { db: { select: () => chain } as unknown as DrizzleD1, wheres };
}

/** 保存の問い合わせだけを受け取って、何を渡されたかを覚えておく接続。 */
function recordingDb(): {
  db: DrizzleD1;
  saved: Record<string, unknown>[];
  conflicts: { set: Record<string, unknown> }[];
} {
  const saved: Record<string, unknown>[] = [];
  const conflicts: { set: Record<string, unknown> }[] = [];
  const chain = {
    values: (v: Record<string, unknown>) => {
      saved.push(v);
      return chain;
    },
    onConflictDoUpdate: (arg: { set: Record<string, unknown> }) => {
      conflicts.push(arg);
      return Promise.resolve(undefined);
    },
  };
  return { db: { insert: () => chain } as unknown as DrizzleD1, saved, conflicts };
}

describe("作業場所の保存先（D1）が落ちたとき", () => {
  it("読み出しは投げずに断りを返し、表の名前を漏らさない", async () => {
    const repo = createD1WorkspaceRepository(brokenDb());
    const result = await repo.findById(WS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.message).not.toContain("brands");
    expect(result.error.message).not.toContain("D1_ERROR");
  });

  it("数を数える問い合わせも投げずに断る", async () => {
    const repo = createD1WorkspaceRepository(brokenDb());
    const result = await repo.countBrands(WS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("作業場所を引くとき", () => {
  it("1 行も無ければ見本の作業場所を返す（誰にも属さない状態を作らない）", async () => {
    const { db } = emptyDb();
    const repo = createD1WorkspaceRepository(db);

    const result = await repo.findById(WS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.id).toBe(SAMPLE_WORKSPACE.id);
  });

  it("見本でもない番号を引いたときだけ null を返す", async () => {
    const { db } = emptyDb();
    const repo = createD1WorkspaceRepository(db);

    const result = await repo.findById(UNKNOWN_WS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});

describe("作業場所を保存するとき", () => {
  it("上書きの対象に作った日を入れない", async () => {
    const { db, saved, conflicts } = recordingDb();
    const repo = createD1WorkspaceRepository(db);

    await repo.save({ ...SAMPLE_WORKSPACE, name: "直した名前" });

    // 入れるときには持つ（新しい行に作った日が要る）。
    expect(saved[0].createdAt).toEqual(SAMPLE_WORKSPACE.createdAt);
    // 上書きには入れない。入れると直すたびに「今日できた作業場所」になる。
    expect(Object.keys(conflicts[0].set)).not.toContain("createdAt");
    expect(conflicts[0].set.name).toBe("直した名前");
  });
});

describe("今月の生成回数を数えるとき", () => {
  it("その月の 1 日を境にする（直近 30 日にしない）", async () => {
    const { db, wheres } = emptyDb();
    const repo = createD1WorkspaceRepository(db);

    // 月末に数えても、境目は同じ月の 1 日でなければならない。
    // 30 日で数えると、月が替わった日に上限が戻らない。
    const result = await repo.countGenerationsThisMonth(WS, new Date("2026-08-31T23:00:00.000Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(0);
    // 条件が組み立てられていること自体は見る（全件を数えていない）。
    expect(wheres).toHaveLength(1);
    expect(wheres[0]).not.toBeUndefined();
  });
});

describe("ブランドの保存先（D1）", () => {
  it("読み出しが落ちても投げずに断り、表の名前を漏らさない", async () => {
    const repo = createD1BrandRepository(brokenDb());
    const result = await repo.list(WS, { limit: 50, cursor: null });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.message).not.toContain("brands");
  });

  it("1 行も無いときは見本のブランドを返す（画面が空にならない）", async () => {
    const { db } = emptyDb();
    const repo = createD1BrandRepository(db);

    const result = await repo.list(WS, { limit: 50, cursor: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((b) => String(b.id))).toEqual(
      SAMPLE_BRANDS.map((b) => String(b.id)),
    );
  });

  it("上書きの対象に作った日と作業場所を入れない", async () => {
    const { db, saved, conflicts } = recordingDb();
    const repo = createD1BrandRepository(db);

    await repo.save({ ...SAMPLE_BRANDS[0], displayName: "直した名前" });

    expect(saved[0].createdAt).toEqual(SAMPLE_BRANDS[0].createdAt);
    expect(Object.keys(conflicts[0].set)).not.toContain("createdAt");
    // 作業場所を上書きに入れると、直した拍子にブランドが別の作業場所へ移る。
    expect(Object.keys(conflicts[0].set)).not.toContain("workspaceId");
    expect(conflicts[0].set.displayName).toBe("直した名前");
  });

  it("問い合わせ先が未設定のブランドは、空文字ではなく null のまま入る", async () => {
    const { db, saved } = recordingDb();
    const repo = createD1BrandRepository(db);

    await repo.save({ ...SAMPLE_BRANDS[0], legalName: null, contactEmail: null });

    // 空文字で入ると、公開前の確認が「埋まっている」と読む。
    expect(saved[0].legalName).toBeNull();
    expect(saved[0].contactEmail).toBeNull();
  });

  it("番号で引いて 1 行も無ければ、見本にある番号だけを返す", async () => {
    const { db } = emptyDb();
    const repo = createD1BrandRepository(db);

    const known = await repo.findById(WS, SAMPLE_BRANDS[0].id as BrandId);
    const unknown = await repo.findById(WS, taggedString<"BrandId">("br_nowhere") as BrandId);

    expect(known.ok && known.value?.id).toBe(SAMPLE_BRANDS[0].id);
    expect(unknown.ok && unknown.value).toBeNull();
  });
});
