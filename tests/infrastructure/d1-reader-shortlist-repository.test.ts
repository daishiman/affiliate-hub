/**
 * @tier 1
 * @req REQ-B09
 * @types equivalence, boundary
 *
 * 読者の「気になる商品」の保存先（D1）。
 *
 * --- ここで最も守りたいこと ---
 * 1. **見本を混ぜない。** 押していない商品が最初から並ぶ一覧は、読者の一覧ではない。
 * 2. **2 回押しても増えない。** 押せてしまうだけの操作を作らない。
 * 3. **押し直しで「いつ気になったか」が動かない。** 動くと並び順が入れ替わる。
 * 4. **外すのは本当に消す。** 消したつもりのものをこちらが持ち続けない。
 * 5. **保存先が落ちても投げない。** 投げると読者の画面が白くなる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */
import { describe, expect, it } from "vitest";
import { createD1ShortlistRepository } from "@/infrastructure/persistence/d1/reader-shortlist-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import type { ReaderShortlistItemRow } from "@/db/schema";

const SITE = "sample-site";
const READER = "reader-abc";

function row(over: Partial<ReaderShortlistItemRow> = {}): ReaderShortlistItemRow {
  return {
    siteSlug: SITE,
    readerKey: READER,
    productId: "prd_1",
    productName: "商品 1",
    savedAt: "2026-08-20T00:00:00.000Z",
    fromArticleHref: null,
    oneLine: null,
    ...over,
  };
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb(rows: readonly ReaderShortlistItemRow[]) {
  const inserted: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let deleted = 0;
  const selectChain = {
    from: () => selectChain,
    where: () => Promise.resolve(rows),
  };
  const db = {
    select: () => selectChain,
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoUpdate: (spec: { set: Record<string, unknown> }) => {
          inserted.push(v);
          updates.push(spec.set);
          return Promise.resolve();
        },
      }),
    }),
    delete: () => ({
      where: () => {
        deleted += 1;
        return Promise.resolve();
      },
    }),
  };
  return { db: db as unknown as DrizzleD1, inserted, updates, deleted: () => deleted };
}

/** どの問い合わせも落ちる接続。保存先が止まっている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table");
  };
  return { select: boom, insert: boom, delete: boom } as unknown as DrizzleD1;
}

describe("気になる商品の保存先（D1）", () => {
  it("1 件も無い読者の一覧は空。見本で埋めない", async () => {
    const { db } = fakeDb([]);
    const listed = await createD1ShortlistRepository(db).list(SITE, READER);
    if (!listed.ok) throw new Error("読み出せていません");

    // 押していない商品が並んでいたら、それは読者の一覧ではない。
    expect(listed.value).toEqual([]);
  });

  it("保存した新しい順に並ぶ。押した直後の 1 件を探させない", async () => {
    const { db } = fakeDb([
      row({ productId: "prd_old", savedAt: "2026-08-01T00:00:00.000Z" }),
      row({ productId: "prd_new", savedAt: "2026-08-25T00:00:00.000Z" }),
    ]);
    const listed = await createD1ShortlistRepository(db).list(SITE, READER);
    if (!listed.ok) throw new Error("読み出せていません");

    expect(listed.value.map((i) => i.productId)).toEqual(["prd_new", "prd_old"]);
  });

  it("空の欄は空文字ではなく、欄そのものが無い形で返る", async () => {
    const { db } = fakeDb([row()]);
    const listed = await createD1ShortlistRepository(db).list(SITE, READER);
    if (!listed.ok) throw new Error("読み出せていません");

    // 空文字で返すと、画面が「書いてある」と読んで空の行を描く。
    expect(listed.value[0]).not.toHaveProperty("oneLine");
    expect(listed.value[0]).not.toHaveProperty("fromArticleHref");
  });

  it("2 回押しても増やさない。押し直しで保存した日時は動かない", async () => {
    const { db, updates } = fakeDb([]);
    await createD1ShortlistRepository(db).add(SITE, READER, {
      productId: "prd_1",
      productName: "名前を直した商品 1",
      savedAt: "2026-08-26T00:00:00.000Z",
    });

    // 上書きすると、間違って押し直しただけで「いつ気になったか」が今日へ動き、
    // 並び順が入れ替わる。読者は自分が何もしていないのに並びが変わったと見る。
    expect(updates[0]).not.toHaveProperty("savedAt");
    expect(updates[0]).toHaveProperty("productName", "名前を直した商品 1");
  });

  it("記事から保存すると、どの記事から保存したかが残る", async () => {
    const { db, inserted } = fakeDb([]);
    await createD1ShortlistRepository(db).add(SITE, READER, {
      productId: "prd_1",
      productName: "商品 1",
      savedAt: "2026-08-26T00:00:00.000Z",
      fromArticleHref: "/s/sample-site/reviews/prd-1",
    });

    expect(inserted[0]).toHaveProperty("fromArticleHref", "/s/sample-site/reviews/prd-1");
  });

  it("外したら本当に消す。印だけ付けて残さない", async () => {
    const { db, deleted } = fakeDb([]);
    const removed = await createD1ShortlistRepository(db).remove(SITE, READER, "prd_1");

    expect(removed.ok).toBe(true);
    expect(deleted()).toBe(1);
  });

  it("保存先が落ちても投げず、読める言葉で断る", async () => {
    const repo = createD1ShortlistRepository(brokenDb());
    const listed = await repo.list(SITE, READER);
    const added = await repo.add(SITE, READER, {
      productId: "prd_1",
      productName: "商品 1",
      savedAt: "2026-08-26T00:00:00.000Z",
    });
    const removed = await repo.remove(SITE, READER, "prd_1");

    expect(listed.ok).toBe(false);
    expect(added.ok).toBe(false);
    expect(removed.ok).toBe(false);
    if (listed.ok) return;
    expect(listed.error.message).not.toBe("");
  });
});
