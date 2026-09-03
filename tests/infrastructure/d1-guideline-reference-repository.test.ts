/**
 * @tier 1
 * @req REQ-SEO05
 * @types equivalence, tenant-isolation, fault-injection
 *
 * SEO/AI 指針の出典の保存先（D1）。
 *
 * ここで見るのは、本物の D1 を使う結合検査では確かめにくい 3 つ。
 *
 *   1. **消えた出典への再確認が成功に見えないこと。** update の件数だけを
 *      見る作りだと「無かった」と「変わらなかった」が同じに見え、
 *      押した人には「更新しました」と出る。先に実在を見ているかを確かめる。
 *   2. **問い合わせに必ず workspace_id が入ること。** 出典の URL 自体は
 *      公開情報だが、「どの作業場所が何をいつ確認したか」は運用記録である。
 *   3. **保存先が落ちたときに投げないこと。** 投げると画面が白くなり、
 *      押した人には何が起きたのか分からない。
 */
import { describe, expect, it } from "vitest";
import type { GuidelineReferenceRow } from "@/db/schema";
import { createD1GuidelineReferenceRepository } from "@/infrastructure/persistence/d1/guideline-reference-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { asWorkspaceId } from "@/domain/shared";

const WS = asWorkspaceId("ws_main");

function row(over: Partial<GuidelineReferenceRow> = {}): GuidelineReferenceRow {
  return {
    id: "gr_google",
    workspaceId: String(WS),
    title: "Google 検索の AI 機能で成功するためのガイド",
    url: "https://developers.google.com/search/docs/ai",
    publisher: "Google Search Central",
    region: "global",
    checkedAt: "2026-06-01",
    // 既定は原典未取得。取得済みは、その事実を立てた試験だけが名乗る。
    sourceFetchedAt: null,
    sourceSha256: null,
    previousSourceSha256: null,
    reEvaluatedSha256: null,
    reEvaluatedAt: null,
    note: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    ...over,
  };
}

/**
 * 問い合わせの形だけ受け取って、決めた行を返す偽の接続。
 *
 * `where` に渡された値は drizzle の式なので中身を読まない。代わりに
 * **呼ばれた回数と順序**、および `set` に渡した値を控える。
 */
function fakeDb(
  rows: readonly GuidelineReferenceRow[],
  failOn?: "select" | "insert" | "update",
  updateReturnsEmpty = false,
) {
  const calls = { select: 0, insert: 0, update: 0, where: 0, limit: 0 };
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];

  const boom = (kind: "select" | "insert" | "update") => {
    if (failOn === kind) throw new TypeError("接続が切れました");
  };

  const selectChain = {
    from: () => selectChain,
    where: (..._args: unknown[]) => {
      calls.where += 1;
      return selectChain;
    },
    limit: (_n: number) => {
      calls.limit += 1;
      return Promise.resolve(rows);
    },
    then: (resolve: (v: readonly GuidelineReferenceRow[]) => unknown) => resolve(rows),
  };

  const db = {
    select: () => {
      calls.select += 1;
      boom("select");
      return selectChain;
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        calls.insert += 1;
        boom("insert");
        inserted.push(v);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        calls.update += 1;
        boom("update");
        updated.push(v);
        return {
          where: (..._args: unknown[]) => {
            calls.where += 1;
            return {
              // 既存の更新は where 自体を await する。
              then: (resolve: (value: undefined) => unknown) => resolve(undefined),
              // 競合を閉じる更新は、実際に更新できた行を確認する。
              returning: () =>
                Promise.resolve(
                  updateReturnsEmpty ? [] : rows.map((existing) => ({ ...existing, ...v })),
                ),
            };
          },
        };
      },
    }),
  };
  return { db: db as unknown as DrizzleD1, calls, inserted, updated };
}

function repo(
  rows: readonly GuidelineReferenceRow[] = [],
  failOn?: "select" | "insert" | "update",
  updateReturnsEmpty = false,
) {
  const fake = fakeDb(rows, failOn, updateReturnsEmpty);
  return {
    ...fake,
    port: createD1GuidelineReferenceRepository({
      db: fake.db,
      now: () => new Date("2026-08-24T09:00:00.000Z"),
    }),
  };
}

describe("一覧", () => {
  it("行を業務の形へ写す（note が null のときは欄ごと出さない）", async () => {
    const { port } = repo([row()]);
    const result = await port.list(WS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      id: "gr_google",
      title: "Google 検索の AI 機能で成功するためのガイド",
      url: "https://developers.google.com/search/docs/ai",
      publisher: "Google Search Central",
      region: "global",
      checkedAt: "2026-06-01",
      verification: { kind: "summary_only" },
    });
    expect("note" in result.value[0]).toBe(false);
  });

  it("note があるときは、そのまま持ち上がる", async () => {
    const { port } = repo([row({ note: "要約しか読めていない" })]);
    const result = await port.list(WS);
    expect(result.ok && result.value[0].note).toBe("要約しか読めていない");
  });

  it("作業場所で必ず絞る（where を通さずに全件返さない）", async () => {
    const { port, calls } = repo([row()]);
    await port.list(WS);
    expect(calls.where).toBe(1);
  });

  it("1 件も無ければ空で返す（空と不調を混ぜない）", async () => {
    const { port } = repo([]);
    const result = await port.list(WS);
    expect(result.ok && result.value).toEqual([]);
  });

  it("保存先が落ちても投げず、読める言葉で返す", async () => {
    const { port } = repo([], "select");
    const result = await port.list(WS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.message).toContain("指針の出典一覧の取得");
    // 例外の中身ではなく、種類の名前だけを残す。
    expect(result.error.details).toEqual({ reason: "TypeError" });
  });
});

describe("登録", () => {
  const reference = {
    id: "gr_new",
    title: "AI 検索の指針",
    url: "https://example.com/guide",
    publisher: "Example",
    region: "jp" as const,
    checkedAt: "2026-08-24",
    verification: { kind: "summary_only" as const },
  };

  it("作業場所と作成時刻を添えて保存し、登録したものをそのまま返す", async () => {
    const { port, inserted } = repo();
    const result = await port.add({ workspaceId: WS, reference });
    expect(result.ok && result.value).toEqual(reference);
    expect(inserted[0]).toMatchObject({
      id: "gr_new",
      workspaceId: WS,
      region: "jp",
      checkedAt: "2026-08-24",
    });
    expect(inserted[0].createdAt).toEqual(new Date("2026-08-24T09:00:00.000Z"));
  });

  it("原典未取得で登録したら、取得の 3 列はすべて null で入る", async () => {
    // 半端に埋まった列があると、読み戻しで「取得済み」を名乗りかねない。
    const { port, inserted } = repo();
    await port.add({ workspaceId: WS, reference });
    expect(inserted[0].sourceFetchedAt).toBeNull();
    expect(inserted[0].sourceSha256).toBeNull();
    expect(inserted[0].previousSourceSha256).toBeNull();
    expect(inserted[0].reEvaluatedSha256).toBeNull();
    expect(inserted[0].reEvaluatedAt).toBeNull();
  });

  it("但し書きが無いときは null で埋める（未指定の欄を作らない）", async () => {
    const { port, inserted } = repo();
    await port.add({ workspaceId: WS, reference });
    expect(inserted[0].note).toBeNull();
  });

  it("但し書きがあるときは、その文字列を保存する", async () => {
    const { port, inserted } = repo();
    await port.add({ workspaceId: WS, reference: { ...reference, note: "取得保留" } });
    expect(inserted[0].note).toBe("取得保留");
  });

  it("保存先が落ちても投げない", async () => {
    const { port } = repo([], "insert");
    const result = await port.add({ workspaceId: WS, reference });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("指針の出典の登録");
  });
});

describe("再確認（確認日の更新）", () => {
  it("実在する出典は、確認日だけが新しくなって返る", async () => {
    const { port, updated } = repo([row()]);
    const result = await port.updateCheckedAt({ workspaceId: WS, id: "gr_google", checkedAt: "2026-08-24" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checkedAt).toBe("2026-08-24");
    // 登録内容（URL・発行元）は変わらない。
    expect(result.value.url).toBe("https://developers.google.com/search/docs/ai");
    expect(updated[0]).toEqual({ checkedAt: "2026-08-24" });
  });

  it("消えた出典への再確認は成功に見せない（NOT_FOUND で断る）", async () => {
    const { port, updated } = repo([]);
    const result = await port.updateCheckedAt({ workspaceId: WS, id: "gr_gone", checkedAt: "2026-08-24" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.details).toEqual({ id: "gr_gone" });
    // 実在しないのに書き込みへ進んでいない。
    expect(updated).toHaveLength(0);
  });

  it("実在を見るときも 1 件に絞って問い合わせる", async () => {
    const { port, calls } = repo([row()]);
    await port.updateCheckedAt({ workspaceId: WS, id: "gr_google", checkedAt: "2026-08-24" });
    expect(calls.limit).toBe(1);
    expect(calls.where).toBeGreaterThanOrEqual(1);
  });

  it("保存先が落ちても投げない", async () => {
    const { port } = repo([row()], "update");
    const result = await port.updateCheckedAt({ workspaceId: WS, id: "gr_google", checkedAt: "2026-08-24" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("指針の確認日の更新");
  });
});

describe("原典取得の記録", () => {
  const SHA_A = "a".repeat(64);
  const SHA_B = "b".repeat(64);

  it("時刻と指紋が揃った行だけが取得済みとして読み戻る", async () => {
    const { port } = repo([row({ sourceFetchedAt: "2026-08-20T00:00:00.000Z", sourceSha256: SHA_A })]);
    const listed = await port.list(WS);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value[0].verification).toEqual({
      kind: "source_fetched",
      fetchedAt: "2026-08-20T00:00:00.000Z",
      contentSha256: SHA_A,
    });
  });

  it("片方だけ残った行は未取得へ倒す（半端な列を確かめた証拠にしない）", async () => {
    for (const half of [
      { sourceFetchedAt: "2026-08-20T00:00:00.000Z", sourceSha256: null },
      { sourceFetchedAt: null, sourceSha256: SHA_A },
    ]) {
      const { port } = repo([row(half)]);
      const listed = await port.list(WS);
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      expect(listed.value[0].verification).toEqual({ kind: "summary_only" });
    }
  });

  it("取り込むと、いま入っている指紋が「前回」へ 1 世代だけ繰り上がる", async () => {
    const { port, updated } = repo([
      row({
        sourceFetchedAt: "2026-08-20T00:00:00.000Z",
        sourceSha256: SHA_A,
        reEvaluatedSha256: SHA_A,
        reEvaluatedAt: "2026-08-20T00:00:00.000Z",
      }),
    ]);
    const result = await port.recordSourceFetch({
      workspaceId: WS,
      id: "gr_google",
      fetchedAt: "2026-08-24T09:00:00.000Z",
      contentSha256: SHA_B,
      checkedAt: "2026-08-24",
    });
    expect(result.ok).toBe(true);
    expect(updated[0]).toEqual({
      sourceFetchedAt: "2026-08-24T09:00:00.000Z",
      sourceSha256: SHA_B,
      previousSourceSha256: SHA_A,
      reEvaluatedSha256: SHA_A,
      reEvaluatedAt: "2026-08-20T00:00:00.000Z",
      checkedAt: "2026-08-24",
    });
    if (!result.ok) return;
    expect(result.value.verification).toMatchObject({
      kind: "source_fetched",
      contentSha256: SHA_B,
      previousSha256: SHA_A,
      reEvaluatedSha256: SHA_A,
    });
    // 確認日も取り込んだ日へ揃う。原典を読んだ日と食い違わせない。
    expect(result.value.checkedAt).toBe("2026-08-24");
  });

  it("初回取得だけは、取得した本文版を再評価済みの基準値にする", async () => {
    const { port, updated } = repo([row()]);
    const result = await port.recordSourceFetch({
      workspaceId: WS,
      id: "gr_google",
      fetchedAt: "2026-08-24T09:00:00.000Z",
      contentSha256: SHA_A,
      checkedAt: "2026-08-24",
    });
    expect(result.ok).toBe(true);
    expect(updated[0]).toMatchObject({
      reEvaluatedSha256: SHA_A,
      reEvaluatedAt: "2026-08-24T09:00:00.000Z",
    });
  });

  it("消えた出典への取り込みは NOT_FOUND で断り、書き込まない", async () => {
    const { port, updated } = repo([]);
    const result = await port.recordSourceFetch({
      workspaceId: WS,
      id: "gr_gone",
      fetchedAt: "2026-08-24T09:00:00.000Z",
      contentSha256: SHA_A,
      checkedAt: "2026-08-24",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(updated).toHaveLength(0);
  });

  it("保存先が落ちても投げない", async () => {
    const { port } = repo([row()], "update");
    const result = await port.recordSourceFetch({
      workspaceId: WS,
      id: "gr_google",
      fetchedAt: "2026-08-24T09:00:00.000Z",
      contentSha256: SHA_A,
      checkedAt: "2026-08-24",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("原典取得の記録");
  });
});

describe("仕様の再評価完了", () => {
  const SHA_A = "a".repeat(64);
  const SHA_B = "b".repeat(64);

  const changedRow = () =>
    row({
      sourceFetchedAt: "2026-08-24T09:00:00.000Z",
      sourceSha256: SHA_B,
      previousSourceSha256: SHA_A,
      reEvaluatedSha256: SHA_A,
      reEvaluatedAt: "2026-08-20T09:00:00.000Z",
    });

  it("画面で確認した最新版だけを再評価済みにして返す", async () => {
    const { port, updated } = repo([changedRow()]);
    const result = await port.acknowledgeReevaluation({
      workspaceId: WS,
      id: "gr_google",
      expectedContentSha256: SHA_B,
      reEvaluatedAt: "2026-08-25T09:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(updated[0]).toEqual({
      reEvaluatedSha256: SHA_B,
      reEvaluatedAt: "2026-08-25T09:00:00.000Z",
    });
    if (!result.ok) return;
    expect(result.value.verification).toMatchObject({
      contentSha256: SHA_B,
      reEvaluatedSha256: SHA_B,
      reEvaluatedAt: "2026-08-25T09:00:00.000Z",
    });
  });

  it("画面で見た後に本文版が変わっていたら、古い版の完了操作を断る", async () => {
    const { port, updated } = repo([changedRow()]);
    const result = await port.acknowledgeReevaluation({
      workspaceId: WS,
      id: "gr_google",
      expectedContentSha256: SHA_A,
      reEvaluatedAt: "2026-08-25T09:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    expect(updated).toHaveLength(0);
  });

  it("読み取り直後に本文版が変わる競合も、条件付き更新の0件で断る", async () => {
    const { port } = repo([changedRow()], undefined, true);
    const result = await port.acknowledgeReevaluation({
      workspaceId: WS,
      id: "gr_google",
      expectedContentSha256: SHA_B,
      reEvaluatedAt: "2026-08-25T09:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });
});
