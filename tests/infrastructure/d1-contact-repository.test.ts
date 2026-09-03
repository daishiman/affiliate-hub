/**
 * @tier 1
 * @req REQ-B18
 * @types equivalence, boundary, injection
 *
 * 読者から届いた問い合わせの保存先（D1）。
 *
 * --- ここで最も守りたいこと ---
 * 1. **受付番号は保存先が決める。** 送る側が指定できると、他人の問い合わせを上書きできる。
 * 2. **保存したものは読み出せる。** 読めない保存は「受け取ったふり」でしかない。
 * 3. **保存先が落ちたら握りつぶさない。** 黙って落とすと「送信しました」が嘘になる。
 * 4. **見つからない相手に印を付けない。** 0 件更新を成功にしない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { ContactMessageRow } from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import {
  CONTACT_RATE_LIMIT_PER_MINUTE,
  createD1ContactRepository,
} from "@/infrastructure/persistence/d1/contact-repository";

const SITE = "sample-site";
const WORKSPACE = "ws_contact" as WorkspaceId;
const NOW = () => new Date("2026-08-26T09:00:00.000Z");

function row(over: Partial<ContactMessageRow> = {}): ContactMessageRow {
  return {
    id: "cm_1",
    workspaceId: String(WORKSPACE),
    siteSlug: SITE,
    body: "記事の型番が違うようです。",
    replyTo: "reader@example.com",
    rateLimitKey: "ip_hash_1",
    receivedAt: "2026-08-25T00:00:00.000Z",
    handledAt: null,
    ...over,
  };
}

/** 保存された値を覗ける偽物。書いた内容そのものを見たいので記録して返す。 */
function fakeDb(rows: readonly ContactMessageRow[] = []) {
  const inserted: Record<string, unknown>[] = [];
  const updated: { set: Record<string, unknown> }[] = [];

  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    orderBy: () => Promise.resolve(rows),
  };

  const db = {
    select: () => selectChain,
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v);
        return Promise.resolve(undefined);
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updated.push({ set: v });
        return {
          where: () => ({
            returning: () => Promise.resolve(rows.map((r) => ({ id: r.id }))),
          }),
        };
      },
    }),
  } as unknown as DrizzleD1;

  return { db, inserted, updated };
}

/** どの問い合わせも落ちる接続。保存先が止まっている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table");
  };
  return { select: boom, insert: boom, update: boom } as unknown as DrizzleD1;
}

type RecordedQuery = { readonly sql: string; readonly params: readonly unknown[] };

/** Drizzle が D1 へ渡す SQL と bind 値だけを記録する接続。 */
function recordingDb(returningRows: readonly Record<string, unknown>[] = []) {
  const queries: RecordedQuery[] = [];
  const rawDb = {
    prepare(sql: string) {
      let params: readonly unknown[] = [];
      const statement = {
        bind(...values: readonly unknown[]) {
          params = values;
          return statement;
        },
        async raw() {
          queries.push({ sql, params });
          return returningRows.map((row) => Object.values(row));
        },
        async all() {
          queries.push({ sql, params });
          return { success: true, meta: {}, results: returningRows };
        },
        async run() {
          queries.push({ sql, params });
          return { success: true, meta: { changes: 0 }, results: [] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { db: drizzle(rawDb, { schema }), queries };
}

describe("問い合わせの保存先（D1）", () => {
  it("受け取ると、受付番号を返して本文をそのまま保存する", async () => {
    const { db, queries } = recordingDb([{ id: "stored" }]);
    const repo = createD1ContactRepository(db, NOW);

    const result = await repo.submit(WORKSPACE, { siteSlug: SITE, body: "はじめまして。" }, "ip_hash_1");

    expect(result.ok).toBe(true);
    const query = queries.at(-1);
    expect(query?.sql).toMatch(/^insert into "contact_messages"[\s\S]+select[\s\S]+count\(\*\)/i);
    expect(query?.params).toEqual(
      expect.arrayContaining([
        SITE,
        String(WORKSPACE),
        "はじめまして。",
        "ip_hash_1",
        "2026-08-26T09:00:00.000Z",
        "2026-08-26T08:59:00.000Z",
        CONTACT_RATE_LIMIT_PER_MINUTE,
      ]),
    );
    // 受付番号は保存した行の id と同じ。読者が問い合わせ直したときに突き合わせられる。
    if (result.ok) expect(query?.params).toContain(result.value.receiptId);
  });

  it("受付番号は送る側から受け取らない", async () => {
    const { db, queries } = recordingDb([{ id: "stored" }]);
    const repo = createD1ContactRepository(db, NOW);

    // 送信の形に無い値をわざと混ぜる。既にある番号を指定して上書きされないこと。
    await repo.submit(WORKSPACE, {
      siteSlug: SITE,
      body: "上書きを試す",
      ...({ id: "cm_1", handledAt: "2020-01-01T00:00:00.000Z" } as Record<string, unknown>),
    }, "ip_hash_1");

    const query = queries.at(-1);
    expect(query?.params).not.toContain("cm_1");
    expect(query?.params).not.toContain("2020-01-01T00:00:00.000Z");
  });

  it("返信先を書かずに送れる（意見だけ伝えたい人を締め出さない）", async () => {
    const { db, queries } = recordingDb([{ id: "stored" }]);
    const repo = createD1ContactRepository(db, NOW);

    const result = await repo.submit(WORKSPACE, { siteSlug: SITE, body: "感想です。" }, "ip_hash_1");

    expect(result.ok).toBe(true);
    expect(queries.at(-1)?.params).toContain(null);
  });

  it("保存した問い合わせは、そのまま読み出せる", async () => {
    const { db } = fakeDb([row(), row({ id: "cm_2", handledAt: "2026-08-26T00:00:00.000Z" })]);
    const listed = await createD1ContactRepository(db, NOW).list(WORKSPACE, [SITE], SITE);

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value).toHaveLength(2);
    expect(listed.value[0]).toEqual({
      id: "cm_1",
      siteSlug: SITE,
      body: "記事の型番が違うようです。",
      replyTo: "reader@example.com",
      receivedAt: "2026-08-25T00:00:00.000Z",
      handledAt: null,
    });
    // 対応済みの日時も落とさない。落とすと「対応済みも見る」が作れない。
    expect(listed.value[1]?.handledAt).toBe("2026-08-26T00:00:00.000Z");
  });

  it("サイト指定を省いた一覧 SQL も、所有サイトだけに絞る", async () => {
    const { db, queries } = recordingDb();
    const repo = createD1ContactRepository(db);

    await repo.list(WORKSPACE, [SITE, "second-owned-site"]);

    const query = queries.at(-1);
    expect(query?.sql).toMatch(/site_slug[^\n]+in \(\?, \?\)/i);
    expect(query?.params).toEqual([String(WORKSPACE), SITE, "second-owned-site"]);
  });

  it("1 件も届いていなくても失敗にしない（見本を混ぜない）", async () => {
    const { db } = fakeDb([]);
    const listed = await createD1ContactRepository(db, NOW).list(WORKSPACE, [SITE], SITE);

    expect(listed).toEqual({ ok: true, value: [] });
  });

  it("対応済みにすると、その日時が入る", async () => {
    const { db, updated } = fakeDb([row()]);
    const marked = await createD1ContactRepository(db, NOW).markHandled(
      WORKSPACE,
      [SITE],
      "cm_1",
      true,
      "2026-08-26T09:00:00.000Z",
    );

    expect(marked.ok).toBe(true);
    expect(updated[0]?.set).toEqual({ handledAt: "2026-08-26T09:00:00.000Z" });
  });

  it("未対応へ戻すと、日時が消える（押し間違いを直せる）", async () => {
    const { db, updated } = fakeDb([row()]);
    await createD1ContactRepository(db, NOW).markHandled(
      WORKSPACE,
      [SITE],
      "cm_1",
      false,
      "2026-08-26T09:00:00.000Z",
    );

    expect(updated[0]?.set).toEqual({ handledAt: null });
  });

  it("存在しない問い合わせに印は付けられない", async () => {
    const { db } = fakeDb([]);
    const marked = await createD1ContactRepository(db, NOW).markHandled(
      WORKSPACE,
      [SITE],
      "cm_none",
      true,
      "2026-08-26T09:00:00.000Z",
    );

    expect(marked.ok).toBe(false);
    if (!marked.ok) expect(marked.error.code).toBe("NOT_FOUND");
  });

  it("対応済み更新 SQL は、ID だけでなく所有サイトでも絞る", async () => {
    const { db, queries } = recordingDb();
    const repo = createD1ContactRepository(db);

    await repo.markHandled(WORKSPACE, [SITE], "cm_other", true, "2026-08-26T09:00:00.000Z");

    const query = queries.at(-1);
    expect(query?.sql).toMatch(/id[^\n]+=[^\n]+site_slug[^\n]+in \(\?\)/i);
    expect(query?.params).toEqual(expect.arrayContaining(["cm_other", String(WORKSPACE), SITE]));
  });

  it("保存先が落ちているとき、どの操作も握りつぶさずに失敗を返す", async () => {
    const repo = createD1ContactRepository(brokenDb(), NOW);

    const submitted = await repo.submit(WORKSPACE, { siteSlug: SITE, body: "届きますか" }, "ip_hash_1");
    const listed = await repo.list(WORKSPACE, [SITE], SITE);
    const marked = await repo.markHandled(
      WORKSPACE,
      [SITE],
      "cm_1",
      true,
      "2026-08-26T09:00:00.000Z",
    );

    expect(submitted.ok).toBe(false);
    expect(listed.ok).toBe(false);
    expect(marked.ok).toBe(false);
    // 本文は失敗の文にも載せない。個人情報が入りうるため。
    if (!submitted.ok) expect(submitted.error.message).not.toContain("届きますか");
  });
});

describe("問い合わせの回数制限（D1）", () => {
  it("条件付きINSERTが0行ならRATE_LIMITEDを返す", async () => {
    const { db } = recordingDb([]);
    const result = await createD1ContactRepository(db, NOW).submit(
      WORKSPACE,
      { siteSlug: SITE, body: "上限後" },
      "ip_hash_1",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED");
  });
});
