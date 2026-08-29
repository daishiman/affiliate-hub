/** @tier 2 @req REQ-P07, REQ-S06, REQ-W10, REQ-TS07 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import { createGetSiteUseCase } from "@/application/usecases/site/read-site";
import {
  type BuildSiteDeps,
  createCreateSiteFromDraftUseCase,
  createGetSiteDraftUseCase,
  createListSiteDraftsUseCase,
  createSaveSiteDraftStepUseCase,
  createStartSiteDraftUseCase,
} from "@/application/usecases/site/build-site";
import { SITE_WIZARD_STEPS } from "@/domain/authoring";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { OTHER_WORKSPACE, anOwner } from "../support/actors";
import { recordingAuditLog } from "../support/doubles";

/**
 * ブログ作成ウィザードを、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * この保存先を見本から本物へ切り替えた理由は「入れる口（ウィザード）が
 * 既にある」ことだった。入れる口があるということは、
 * **入れたものが読み出せなければ即座に業務が止まる**ということでもある。
 * 単体側（`tests/application/build-site.test.ts`）は覚え書き（メモリ）の
 * 保存先で通しているので、次の 3 つは公開してから初めて分かる:
 *
 *   1. マイグレーション 0006 が 2 つの表を本当に作れるか
 *   2. 13 段階ぶんの回答を JSON 1 列に畳んで、読み直したとき同じ形に戻るか
 *   3. 同じ URL 名で作り直したとき、**弾かれずに差し替わる**か
 *
 * 3 は特に、一意索引の付け方を間違えると
 * 「やり直しても永久に通らない失敗」になる。ここで実測する。
 *
 * --- ここで見ないこと ---
 * 段階ごとの入力検証・権限・質問文の網羅は単体側で見る。
 * ここは**下書きから読者向けの 1 本になるまで**だけを見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: BuildSiteDeps;
let sites: ReturnType<typeof createD1SiteRepository>;
/** 読者側の入口を、作る側と**同じ保存先**から組み立てるための一式。 */
let readerSide: ReturnType<typeof createDeps>;

const owner: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/** マイグレーションの本文を、実行できる単位に割る。 */
function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  const db = drizzle(proxy.env.DB, { schema });
  // 分解して組み直すと、商業データの印が落ちる（印は入れ物ごと持ち回る）。
  const all = createDeps({ db });
  // 見本の記録は書き足しを断る（保存先が無い）ので、溜める版を使う。
  // ここで見たいのは D1 に下書きとブログが残るかで、記録の保存先は別の試験で見る。
  deps = {
    drafts: all.siteDrafts,
    ids: all.ids,
    auditLog: recordingAuditLog().port,
    now: () => new Date(),
    capacity: { withLease: async (_workspaceId, _kind, mutation) => mutation() },
  };
  sites = createD1SiteRepository(db);
  readerSide = all;
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM site_drafts").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();
});

/** 13 段階ぶんの答え。中身は最小限で足りる（見るのは往復であって内容ではない）。 */
const ANSWERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  purpose: { purpose: "はじめて一眼カメラを買う人が、レンズ選びで迷わないようにする" },
  genre: { genre: "カメラ・交換レンズ" },
  audience: {
    targetReader: "一眼カメラを買って半年以内の人",
    searchIntent: "次に買う 1 本をどう選べばよいか知りたい",
  },
  author: {
    uniqueExperience: "同じ被写体を全レンズで撮り比べた作例",
    conclusionStance: "用途ごとに 1 本ずつ挙げる",
  },
  revenue: { revenueModel: "affiliate" },
  pattern: { pattern: "beginner_guide" },
  design: { theme: "indigo-clay" },
  policy: {
    articlePurpose: "用途から候補を 3 本に絞らせる",
    ctaStrategy: "在庫と価格が確認できる販売ページのみ",
  },
  content_plan: {
    evaluationAxis: "焦点距離と最短撮影距離",
    usageScene: "屋内で子どもを撮る",
    comparisonScope: "実売 10 万円以下の交換レンズ",
    internalLinkStrategy: "用途別の案内から個別レビューへ落とす",
  },
};

/** 13 段階すべてに答えた下書きを、本物の保存先の上で作る。 */
async function completeDraft(slug: string, name = "はじめてのレンズ"): Promise<string> {
  const started = await createStartSiteDraftUseCase(deps).execute(owner, {});
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error("下書きを始められませんでした");
  const draftId = started.value.draftId;

  const saveStep = createSaveSiteDraftStepUseCase(deps);
  for (const step of SITE_WIZARD_STEPS) {
    if (step === "create") continue;
    const saved = await saveStep.execute(owner, {
      draftId,
      step,
      answers: step === "domain" ? { name, slug } : (ANSWERS[step] ?? {}),
      categoriesText:
        step === "categories"
          ? "prime-lenses / 単焦点レンズ / 明るさで選ぶ 1 本目\nzoom-lenses / ズームレンズ / 交換せずに済ませたい人向け"
          : undefined,
      articleTypes: step === "article_types" ? ["guide", "comparison"] : undefined,
    });
    expect(saved.ok, `${step} の保存に失敗しました`).toBe(true);
  }
  return draftId;
}

describe("マイグレーションそのもの", () => {
  it("下書きと、作られたブログの表を実際に作る", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    const names = tables.results.map((r) => r.name);
    expect(names).toContain("site_drafts");
    expect(names).toContain("site_blueprints");
  });

  it("URL 名だけを一意にする（下書きは縛らない）", async () => {
    const blueprintIndexes = await proxy.env.DB.prepare(
      "pragma index_list(site_blueprints)",
    ).all<{ name: string; unique: number }>();
    // 同じ URL 名のブログが 2 本あると、読者がどちらを見ているか決められない。
    const bySlug = blueprintIndexes.results.find((r) => r.name.includes("slug"));
    expect(bySlug).toBeDefined();
    expect(bySlug?.unique).toBe(1);

    const draftIndexes = await proxy.env.DB.prepare("pragma index_list(site_drafts)").all<{
      name: string;
      unique: number;
      origin: string;
    }>();
    // 下書きは重複しても困らない。縛ると「同じ題材で作りかけをもう 1 本」ができなくなる。
    // 主キー（origin = "pk"）は別。行を 1 件に定める役目なので一意で正しい。
    for (const index of draftIndexes.results.filter((r) => r.origin !== "pk")) {
      expect(index.unique, `${index.name} が一意になっています`).toBe(0);
    }
  });
});

describe("下書きから読者向けの 1 本になるまで（1 本の道）", () => {
  it("13 段階の答えが、保存先を往復しても同じ形で戻る", async () => {
    const draftId = await completeDraft("first-lens");

    const view = await createGetSiteDraftUseCase(deps).execute(owner, {
      draftId,
      step: "content_plan",
    });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    // JSON 1 列に畳んだあと、段階の完了状態が落ちていないこと。
    expect(view.value.incomplete).toHaveLength(0);
    expect(view.value.name).toBe("はじめてのレンズ");
    expect(view.value.slug).toBe("first-lens");
  });

  it("作ると、読者向けの一覧に載る（見本は消えない）", async () => {
    const draftId = await completeDraft("first-lens");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.slug).toBe("first-lens");

    const found = await sites.findBySlug("first-lens");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value?.name).toBe("はじめてのレンズ");

    const listed = await sites.list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const slugs = listed.value.map((entry) => entry.slug);
    expect(slugs).toContain("first-lens");
    // まだ 1 本も作っていない人の画面が空にならないよう、見本は残す。
    expect(slugs.length).toBeGreaterThan(1);
  });

  /*
   * 下の 2 件は、以前は見本の保存先の上（単体側）で見ていた。
   * 作ったことを記録に残すようになり、**記録の保存先が無い状態では
   * 作れなくなった**（残せない記録を「残した」ことにしないため）。
   * 見る値は変えずに、保存先が本物のここへ移してある。
   */
  it("読者向けの入口から、見本のブログと同じ扱いで引ける", async () => {
    const draftId = await completeDraft("first-lens");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    if (!created.ok) throw created.error;

    expect(created.value.readerPath).toBe("/s/first-lens");
    expect(created.value.categoryCount).toBe(2);
    // 画面の種類は型（beginner_guide）から自動で決まる。手で並べていない。
    expect(created.value.pageCount).toBeGreaterThan(0);

    // 読者側の入口は、見本のブログと同じユースケース。
    const site = await createGetSiteUseCase({
      sites: readerSide.sites,
      content: readerSide.publishedContent,
    }).execute(owner, { siteSlug: "first-lens" });
    expect(site.ok, "作ったブログが読者向けの経路で見つかりません").toBe(true);
    if (!site.ok) return;
    expect(site.value.blueprint.name).toBe("はじめてのレンズ");
  });

  it("差別化の 10 軸がすべて埋まっている（言い換えブログを作らせない）", async () => {
    const draftId = await completeDraft("third-lens");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    // 10 軸のどれかが空なら createSiteBlueprint が断る。作れた時点で 10 軸が揃っている。
    expect(created.ok, created.ok ? "" : created.error.message).toBe(true);
  });

  it("同じ URL 名で作り直すと、弾かれずに差し替わる", async () => {
    const first = await completeDraft("first-lens", "はじめてのレンズ");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: first,
    });
    expect(created.ok).toBe(true);

    // 名前だけ変えて、同じ URL 名でもう一度作る。
    const second = await completeDraft("first-lens", "はじめてのレンズ 改訂版");
    const again = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: second,
    });
    // **ここが弾かれると、名前を決め直す以外に先へ進めなくなる。**
    expect(again.ok, "同じ URL 名の作り直しが失敗しました").toBe(true);

    const found = await sites.findBySlug("first-lens");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value?.name).toBe("はじめてのレンズ 改訂版");

    // 差し替えであって追記ではない（同じ URL 名が 2 行にならない）。
    const rows = await proxy.env.DB.prepare(
      "select count(*) as n from site_blueprints where slug = 'first-lens'",
    ).all<{ n: number }>();
    expect(rows.results[0]?.n).toBe(1);
  });

  it("同じ URL 名を別の作業場所から登録しても、所有者は入れ替わらない", async () => {
    const draftId = await completeDraft("owned-lens", "元の所有者のブログ");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    if (!created.ok) throw created.error;

    const current = await sites.findBySlug("owned-lens");
    if (!current.ok || current.value === null) throw new Error("登録したブログを読めませんでした");

    const attacked = await deps.drafts.publishBlueprint("owned-lens", {
      ...current.value,
      workspaceId: OTHER_WORKSPACE,
      name: "別の作業場所からの差し替え",
    });

    expect(attacked.ok).toBe(false);
    const rows = await proxy.env.DB.prepare(
      "select workspace_id as workspaceId, name from site_blueprints where slug = 'owned-lens'",
    ).all<{ workspaceId: string; name: string }>();
    expect(rows.results).toEqual([
      { workspaceId: String(owner.workspaceId), name: "元の所有者のブログ" },
    ]);
  });

  it("取り下げた URL 名も、別の作業場所へ再割り当てしない", async () => {
    const draftId = await completeDraft("retired-lens", "取り下げ前のブログ");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    if (!created.ok) throw created.error;

    const before = await sites.findBySlug("retired-lens");
    if (!before.ok || before.value === null) throw new Error("登録したブログを読めませんでした");

    const removed = await deps.drafts.removeBlueprint(owner.workspaceId, "retired-lens");
    expect(removed.ok).toBe(true);

    const attacked = await deps.drafts.publishBlueprint("retired-lens", {
      ...before.value,
      workspaceId: OTHER_WORKSPACE,
      name: "別の作業場所が再利用したブログ",
    });

    expect(attacked.ok).toBe(false);
    const rows = await proxy.env.DB.prepare(
      `select b.workspace_id as workspaceId, r.retired_at as retiredAt
       from site_blueprints b
       inner join site_retirements r on r.slug = b.slug
       where b.slug = 'retired-lens'`,
    ).all<{ workspaceId: string; retiredAt: number | null }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]?.workspaceId).toBe(String(owner.workspaceId));
    expect(rows.results[0]?.retiredAt).not.toBeNull();

    const hidden = await sites.findBySlug("retired-lens");
    expect(hidden).toEqual({ ok: true, value: null });
  });

  it("見本と同じslugを取り下げても、見本がfallbackで再露出しない", async () => {
    const slug = "video-editing-gear";
    const sample = await sites.findBySlug(slug);
    if (!sample.ok || sample.value === null) throw new Error("見本サイトがありません");

    const published = await deps.drafts.publishBlueprint(slug, {
      ...sample.value,
      workspaceId: owner.workspaceId,
      name: "所有者が公開した同名サイト",
    });
    expect(published.ok).toBe(true);
    const removed = await deps.drafts.removeBlueprint(owner.workspaceId, slug);
    expect(removed.ok).toBe(true);

    const hidden = await sites.findBySlug(slug);
    expect(hidden).toEqual({ ok: true, value: null });
  });

  it("作りかけの下書きは、2 本とも一覧に残る", async () => {
    const first = await completeDraft("older-blog", "先に始めたほう");
    const second = await completeDraft("newer-blog", "あとから始めたほう");

    const listed = await createListSiteDraftsUseCase(deps).execute(owner, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 並び順（新しい順）はここでは見ない。試験内では 2 本の更新時刻が
    // 同じミリ秒に収まりうるため、たまに落ちる試験になる。
    const ids = listed.value.items.map((draft) => draft.draftId);
    expect(ids).toContain(first);
    expect(ids).toContain(second);
    expect(listed.value.total).toBe(2);
    expect(listed.value.emptyReason).toBeNull();
  });

  it("段階が埋まっていない下書きは作れない（どこが足りないかを言葉で返す）", async () => {
    const started = await createStartSiteDraftUseCase(deps).execute(owner, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: started.value.draftId,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    // 「失敗しました」だけでは直せない。足りない段階の名前が要る。
    expect(created.error.message).toContain("まだ埋まっていない段階があります");
  });
});
