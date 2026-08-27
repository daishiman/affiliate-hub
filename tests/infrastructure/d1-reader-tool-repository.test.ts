/**
 * @tier 1
 * @req REQ-B07
 * @types equivalence, boundary
 *
 * 診断・計算の道具の保存先（D1）。
 *
 * --- ここで最も守りたいこと ---
 * 1. **保存先を繋いだ瞬間に、動いていた道具が消えない。** 作り付けの 1 つは残る。
 * 2. **同じ slug を登録したら、運営者の定義が勝つ。** 直したのに古いほうが返る、を作らない。
 * 3. **計算式は保存側から取り、解くのは domain の読み取り機。** ここで計算しない。
 * 4. **保存先が落ちたら握りつぶさず失敗として返す。**
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */
import { describe, expect, it } from "vitest";
import type { ReaderToolRow } from "@/db/schema";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { createD1ReaderToolRepository } from "@/infrastructure/persistence/d1/reader-tool-repository";

const SITE = "sample-site";

function row(over: Partial<ReaderToolRow> = {}): ReaderToolRow {
  return {
    workspaceId: "ws_1",
    siteSlug: SITE,
    slug: "budget",
    name: "予算の目安",
    purpose: "使える金額から 1 台あたりの上限を出す。",
    inputs: [
      { key: "total", label: "使える金額", unit: "円" },
      { key: "count", label: "買う台数", unit: "台" },
    ],
    howToRead: "税込みの金額です。",
    formula: {
      rows: [{ label: "1 台あたり", expression: "total / count", unit: " 円", decimals: 0 }],
      summary: "1 台あたり {1 台あたり} までが目安です。",
    },
    updatedAt: new Date("2026-08-26T00:00:00.000Z"),
    ...over,
  };
}

function fakeDb(rows: readonly ReaderToolRow[]) {
  const selectChain = {
    from: () => selectChain,
    where: () => Promise.resolve(rows),
  };
  return { select: () => selectChain } as unknown as DrizzleD1;
}

/** どの問い合わせも落ちる接続。保存先が止まっている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table");
  };
  return { select: boom } as unknown as DrizzleD1;
}

describe("診断・計算の道具の保存先（D1）", () => {
  it("登録が 0 件でも、作り付けの道具は一覧から消えない", async () => {
    const listed = await createD1ReaderToolRepository(fakeDb([])).list(SITE);
    if (!listed.ok) throw new Error("読み出せていません");
    // 消えると、運営者から見て「登録し忘れ」なのか「壊れた」のか判断できない。
    expect(listed.value.map((t) => t.slug)).toContain("storage-estimator");
  });

  it("登録した道具と作り付けの道具が、どちらも一覧に並ぶ", async () => {
    const listed = await createD1ReaderToolRepository(fakeDb([row()])).list(SITE);
    if (!listed.ok) throw new Error("読み出せていません");
    expect(listed.value.map((t) => t.slug).sort()).toEqual(["budget", "storage-estimator"]);
  });

  it("同じ slug を登録すると、運営者の定義が作り付けに勝つ", async () => {
    const overridden = row({ slug: "storage-estimator", name: "こちらが正" });
    const listed = await createD1ReaderToolRepository(fakeDb([overridden])).list(SITE);
    if (!listed.ok) throw new Error("読み出せていません");
    expect(listed.value).toHaveLength(1);
    expect(listed.value[0]?.name).toBe("こちらが正");
  });

  it("登録した道具の入力欄が、そのまま読み出せる", async () => {
    const found = await createD1ReaderToolRepository(fakeDb([row()])).find(SITE, "budget");
    if (!found.ok || found.value === null) throw new Error("見つかっていません");
    expect(found.value.inputs.map((i) => i.key)).toEqual(["total", "count"]);
    expect(found.value.howToRead).toBe("税込みの金額です。");
  });

  it("保存境界から JSON 文字列で届いた入力欄と計算式を、形を確かめて読む", async () => {
    const encoded = row({
      inputs: JSON.stringify(row().inputs) as unknown as ReaderToolRow["inputs"],
      formula: JSON.stringify(row().formula) as unknown as ReaderToolRow["formula"],
    });
    const repository = createD1ReaderToolRepository(fakeDb([encoded]));

    const found = await repository.find(SITE, "budget");
    if (!found.ok || found.value === null) throw new Error("保存した定義を読めていません");
    expect(found.value.inputs.map((input) => input.key)).toEqual(["total", "count"]);

    const run = await repository.run(SITE, "budget", { total: "120000", count: "3" });
    if (!run.ok) throw new Error(run.error.message);
    expect(run.value.rows[0]?.value).toBe("40,000 円");
  });

  it("壊れた保存 JSON を作り付けの定義で隠さず、読み出し失敗にする", async () => {
    const corrupted = row({
      slug: "storage-estimator",
      inputs: "not-json" as unknown as ReaderToolRow["inputs"],
    });
    const repository = createD1ReaderToolRepository(fakeDb([corrupted]));

    expect((await repository.find(SITE, "storage-estimator")).ok).toBe(false);
    expect((await repository.list(SITE)).ok).toBe(false);
    expect((await repository.run(SITE, "storage-estimator", {})).ok).toBe(false);
  });

  it("登録の無い名前は、作り付けにも無ければ null", async () => {
    const found = await createD1ReaderToolRepository(fakeDb([])).find(SITE, "no-such-tool");
    expect(found.ok && found.value).toBeNull();
  });

  it("保存された計算式で実際に計算する", async () => {
    const run = await createD1ReaderToolRepository(fakeDb([row()])).run(SITE, "budget", {
      total: "120,000",
      count: "3",
    });
    if (!run.ok) throw new Error(run.error.message);
    expect(run.value.rows).toEqual([{ label: "1 台あたり", value: "40,000 円" }]);
    expect(run.value.summary).toBe("1 台あたり 40,000 円 までが目安です。");
  });

  it("入力が足りないときは、どの欄かを名指しして止める", async () => {
    const run = await createD1ReaderToolRepository(fakeDb([row()])).run(SITE, "budget", {
      total: "120000",
    });
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error.field).toBe("count");
  });

  it("登録も作り付けも無い道具は、見つからないと返す", async () => {
    const run = await createD1ReaderToolRepository(fakeDb([])).run(SITE, "no-such-tool", {});
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error.code).toBe("NOT_FOUND");
  });

  it("保存先が落ちているときは、握りつぶさず失敗として返す", async () => {
    const repo = createD1ReaderToolRepository(brokenDb());
    expect((await repo.find(SITE, "budget")).ok).toBe(false);
    expect((await repo.list(SITE)).ok).toBe(false);
    expect((await repo.run(SITE, "budget", {})).ok).toBe(false);
  });
});
