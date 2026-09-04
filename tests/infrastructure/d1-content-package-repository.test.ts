/**
 * @tier 1
 * @req REQ-P05, REQ-B01
 * @types equivalence, boundary
 *
 * 企画の保存先（D1）。
 *
 * 見るのは 4 つ。書き手の保存先（`d1-persona-repository.test.ts`）と同じ約束を
 * 企画でも守れているかを確かめる。
 *   1. 保存先が落ちても投げず、断りとして返すこと
 *   2. 例外の中身（表の名前）を画面へ出す言葉に混ぜないこと
 *   3. 保存された分が見本より**先**に並ぶこと
 *   4. 保存先に無い ID は見本を見に行くこと
 *
 * それに加えて、この表だけの決めごとを 1 つ見る。
 * **`variantIds` を列にしない**こと。列にすると、記事を 1 本作るたびに
 * 企画の行を作り直すことになり、企画を編集していないのに更新日時が動く。
 *
 * 本物の D1 は動かせないので、問い合わせの組み立てだけを受け取る偽の接続を使う。
 */
import { describe, expect, it } from "vitest";
import type { ContentPackageRow } from "@/db/schema";
import { asWorkspaceId, taggedString } from "@/domain/shared";
import type { ContentPackageId, WorkspaceId } from "@/domain/shared";
import { createD1ContentPackageRepository } from "@/infrastructure/persistence/d1/content-package-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { SAMPLE_CONTENT_PACKAGES } from "@/infrastructure/persistence/sample/content-editorial-sample-repository";

const WS = asWorkspaceId("ws_sample") as WorkspaceId;
const PAGE = { limit: 50, cursor: null };

/** どの問い合わせも落ちる接続。表が無い・形がずれている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table: content_packages");
  };
  return { select: boom, insert: boom } as unknown as DrizzleD1;
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb(rows: readonly unknown[]): DrizzleD1 {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
    orderBy: () => Promise.resolve(rows),
  };
  return { select: () => chain } as unknown as DrizzleD1;
}

/** 保存の問い合わせだけを受け取って、何を渡されたかを覚えておく接続。 */
function recordingDb(): { db: DrizzleD1; saved: Record<string, unknown>[] } {
  const saved: Record<string, unknown>[] = [];
  const chain = {
    values: (v: Record<string, unknown>) => {
      saved.push(v);
      return chain;
    },
    onConflictDoUpdate: () => Promise.resolve(undefined),
  };
  return { db: { insert: () => chain } as unknown as DrizzleD1, saved };
}

/** 見本の企画をそのまま 1 行にした形。JSON 列の中身も本物と同じ作りにする。 */
function packageRow(over: Partial<ContentPackageRow> = {}): ContentPackageRow {
  const sample = SAMPLE_CONTENT_PACKAGES[0];
  const { id, workspaceId, objective, status, domainScope, ...rest } = sample;
  void id;
  void workspaceId;
  void objective;
  void status;
  void domainScope;
  return {
    id: "cp_stored",
    workspaceId: "ws_sample",
    objective: "保存された企画",
    status: "researching",
    domainScope: "general",
    updatedAt: new Date("2026-08-26T00:00:00.000Z"),
    packageJson: JSON.stringify(rest),
    ...over,
  };
}

function packageRowForBrand(id: string, brandId: string): ContentPackageRow {
  const row = packageRow({ id });
  const stored = JSON.parse(row.packageJson) as Record<string, unknown>;
  return { ...row, packageJson: JSON.stringify({ ...stored, brandId }) };
}

describe("企画の保存先（D1）が落ちたとき", () => {
  it("一覧は、投げずに断りとして返す", async () => {
    const result = await createD1ContentPackageRepository(brokenDb()).list(WS, PAGE);

    // 投げると画面が 500 になり、押した人には何が起きたか分からない。
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.retryable).toBe(true);
  });

  it("1 件を引くときも、投げずに断りとして返す", async () => {
    const result = await createD1ContentPackageRepository(brokenDb()).findById(
      WS,
      taggedString<"ContentPackageId">("cp_x") as ContentPackageId,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("保存も、投げずに断りとして返す", async () => {
    const result = await createD1ContentPackageRepository(brokenDb()).save(
      SAMPLE_CONTENT_PACKAGES[0],
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("例外の中身を、画面へ出す言葉に混ぜない", async () => {
    const result = await createD1ContentPackageRepository(brokenDb()).list(WS, PAGE);
    if (result.ok) throw new Error("落ちているのに通っています");

    // 表の名前は利用者の役に立たないうえ、内部の作りを外へ出すことになる（§26.3）。
    expect(result.error.message).not.toContain("content_packages");
    expect(result.error.suggestedAction ?? "").not.toContain("content_packages");
  });
});

describe("見本を消さずに重ねる", () => {
  it("brand絞り込みをlimitより先に行い、nextCursorも絞り込み後の列を指す", async () => {
    const repository = createD1ContentPackageRepository(
      fakeDb([
        packageRowForBrand("cp-outside", "brand-outside"),
        packageRowForBrand("cp-allowed-1", "brand-allowed"),
        packageRowForBrand("cp-allowed-2", "brand-allowed"),
      ]),
    );
    const scope = { brandIds: [taggedString<"BrandId">("brand-allowed")] };

    const first = await repository.list(WS, { limit: 1, cursor: null }, scope);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.items.map((pkg) => String(pkg.id))).toEqual(["cp-allowed-1"]);
    expect(first.value.nextCursor).toBe("cp-allowed-1");

    const second = await repository.list(
      WS,
      { limit: 1, cursor: first.value.nextCursor },
      scope,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.items.map((pkg) => String(pkg.id))).toEqual(["cp-allowed-2"]);
    expect(second.value.nextCursor).toBeNull();
  });

  it("保存された企画が見本より先に並ぶ", async () => {
    const result = await createD1ContentPackageRepository(fakeDb([packageRow()])).list(WS, PAGE);
    if (!result.ok) throw new Error("読み出せていません");

    expect(String(result.value.items[0].id)).toBe("cp_stored");
    expect(result.value.items.length).toBe(1 + SAMPLE_CONTENT_PACKAGES.length);
  });

  it("1 件も保存していなくても、一覧は空にならない", async () => {
    const result = await createD1ContentPackageRepository(fakeDb([])).list(WS, PAGE);
    if (!result.ok) throw new Error("読み出せていません");

    // 空だと、記事を作る画面が「先に企画を立てます」から動かなくなる。
    // 見本の企画 1 件があるので、つないだ直後でも記事を 1 本作って試せる。
    expect(result.value.items.length).toBe(SAMPLE_CONTENT_PACKAGES.length);
  });

  it("保存先に無い ID は見本を見に行く", async () => {
    const sample = SAMPLE_CONTENT_PACKAGES[0];
    const result = await createD1ContentPackageRepository(fakeDb([])).findById(WS, sample.id);
    if (!result.ok) throw new Error("読み出せていません");

    // 見本の企画で作った記事が、保存先をつないだ日に
    // 「企画が見つかりません」で開けなくなるのを防ぐ。
    expect(result.value?.objective).toBe(sample.objective);
  });

  it("別workspaceからは見本のIDを指定されても返さない", async () => {
    const sample = SAMPLE_CONTENT_PACKAGES[0];
    const otherWorkspace = asWorkspaceId("ws_other") as WorkspaceId;
    const result = await createD1ContentPackageRepository(fakeDb([])).findById(
      otherWorkspace,
      sample.id,
    );
    if (!result.ok) throw new Error("読み出しが失敗しています");

    expect(result.value).toBeNull();
  });

  it("保存先にも見本にも無い ID は、見つからないとして null を返す", async () => {
    const result = await createD1ContentPackageRepository(fakeDb([])).findById(
      WS,
      taggedString<"ContentPackageId">("cp_nowhere") as ContentPackageId,
    );
    if (!result.ok) throw new Error("読み出せていません");

    // ここで見本の 1 件目を返すと、消した企画が別の企画として生き続ける。
    expect(result.value).toBeNull();
  });

  it("JSON 列に入れた決めごとが、読み出しで元へ戻る", async () => {
    const sample = SAMPLE_CONTENT_PACKAGES[0];
    const result = await createD1ContentPackageRepository(fakeDb([packageRow()])).list(WS, PAGE);
    if (!result.ok) throw new Error("読み出せていません");

    // 列にしていない決めごと（切り口・読者像）が落ちると、
    // 一覧は出るのに記事案が 1 つも作れない企画になる。
    expect(result.value.items[0].contentAngles).toEqual(sample.contentAngles);
    expect(result.value.items[0].audiencePersonaIds).toEqual(sample.audiencePersonaIds);
  });
});

describe("保存するときの列の切り方", () => {
  it("絞り込みと並べ替えに使うものだけを列に出し、残りは JSON 1 列へ入れる", async () => {
    const { db, saved } = recordingDb();
    const pkg = SAMPLE_CONTENT_PACKAGES[0];

    const result = await createD1ContentPackageRepository(db).save(pkg);
    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(1);

    const row = saved[0];
    expect(row.id).toBe(String(pkg.id));
    expect(row.objective).toBe(pkg.objective);
    expect(row.status).toBe(pkg.status);
    expect(row.domainScope).toBe(pkg.domainScope);

    // 列に出したものは JSON へ二重に持たない。両方に持つと、
    // 片方だけ直したときにどちらが本当か決められなくなる。
    const stored = JSON.parse(String(row.packageJson)) as Record<string, unknown>;
    expect(stored.objective).toBeUndefined();
    expect(stored.status).toBeUndefined();
    expect(stored.id).toBeUndefined();

    // `variantIds` は列にしない。列にすると記事を 1 本作るたびに
    // 企画の行の作り直しが要る。
    expect(row.variantIds).toBeUndefined();
    expect(stored.variantIds).toBeDefined();
  });
});
