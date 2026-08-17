import { describe, expect, it } from "vitest";
import { SITE_WIZARD_STEPS } from "@/domain/authoring";
import { currentActor, siteBuilderUseCases, siteUseCases } from "@/presentation/composition";

/**
 * ブログ作成ウィザードの確認。
 *
 * ここで固定したいのは要件 C の核心 ——
 * **ブログを 1 本増やすのに、コードを 1 行も書かない**こと。
 * ウィザードで作ったブログが、見本の 3 本と同じ画面・同じ読み取り経路で
 * 出てくることを、人の目視ではなく機械で確かめる。
 */

/** 13 段階すべてに答えた下書きを作る。答えの中身は最小限で足りる。 */
async function completeDraft(slug: string): Promise<string> {
  const actor = await currentActor();
  const uc = siteBuilderUseCases();

  const started = await uc.startDraft.execute(actor, {});
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error("下書きを始められませんでした");
  const draftId = started.value.draftId;

  const answers: Record<string, Record<string, string>> = {
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
    domain: { name: "はじめてのレンズ", slug },
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

  for (const step of SITE_WIZARD_STEPS) {
    if (step === "create") continue;

    const saved = await uc.saveStep.execute(actor, {
      draftId,
      step,
      answers: answers[step] ?? {},
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

describe("ブログ作成ウィザード", () => {
  it("13 段階すべてに、何を決めるかの質問が付いている", async () => {
    const actor = await currentActor();
    const started = await siteBuilderUseCases().startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(started.value.steps).toHaveLength(13);
    for (const step of started.value.steps) {
      expect(step.label.trim()).not.toBe("");
      // ラベルだけでは何を書けばよいか分からない。質問文を必ず添える。
      expect(step.question.trim()).not.toBe("");
    }
  });

  it("始めた直後は、まだ公開されていない", async () => {
    const actor = await currentActor();
    const started = await siteBuilderUseCases().startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(started.value.createdSiteSlug).toBeNull();
    expect(started.value.incomplete.length).toBeGreaterThan(0);
  });

  it("開いている段階の入力欄が application 層から返る（画面が欄を書き起こさない）", async () => {
    const actor = await currentActor();
    const started = await siteBuilderUseCases().startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    for (const step of SITE_WIZARD_STEPS) {
      const view = await siteBuilderUseCases().getDraft.execute(actor, {
        draftId: started.value.draftId,
        step,
      });
      expect(view.ok).toBe(true);
      if (!view.ok) continue;

      if (step === "create") {
        // 最後は入力ではなく実行。欄が無いのが正しい。
        expect(view.value.fields).toHaveLength(0);
        continue;
      }
      expect(view.value.fields.length, `${step} に入力欄がありません`).toBeGreaterThan(0);
      for (const field of view.value.fields) {
        expect(field.label.trim()).not.toBe("");
        expect(field.hint.trim()).not.toBe("");
        if (field.kind === "choice" || field.kind === "multi_choice") {
          expect(field.options.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("埋まっていない段階があるうちは作れず、どこが足りないかが返る", async () => {
    const actor = await currentActor();
    const started = await siteBuilderUseCases().startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const created = await siteBuilderUseCases().createSite.execute(actor, {
      draftId: started.value.draftId,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    // 「作れません」だけで終わらせない。戻る先が分かる言葉を出す。
    expect(created.error.message).toContain("ブログの目的");
  });

  it("URL に使えない文字は、直し方の分かる言葉で断る", async () => {
    const actor = await currentActor();
    const started = await siteBuilderUseCases().startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const saved = await siteBuilderUseCases().saveStep.execute(actor, {
      draftId: started.value.draftId,
      step: "domain",
      answers: { name: "テスト", slug: "日本語スラッグ" },
    });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.field).toBe("slug");
    expect(saved.error.message).toContain("英小文字");
  });

  it("カテゴリーの行の形が違うときは、その行を示して断る", async () => {
    const actor = await currentActor();
    const started = await siteBuilderUseCases().startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const saved = await siteBuilderUseCases().saveStep.execute(actor, {
      draftId: started.value.draftId,
      step: "categories",
      answers: {},
      categoriesText: "レンズだけ書いた行",
    });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("レンズだけ書いた行");
  });

  it("保存すると次の段階が開く（同じ画面に留まらない）", async () => {
    const actor = await currentActor();
    const started = await siteBuilderUseCases().startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const saved = await siteBuilderUseCases().saveStep.execute(actor, {
      draftId: started.value.draftId,
      step: "purpose",
      answers: { purpose: "レンズ選びで迷わないようにする" },
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.currentStep).toBe("genre");
  });
});

describe("作ったブログ", () => {
  it("読者向けの経路で、見本のブログと同じ扱いで出てくる", async () => {
    const slug = "first-lens-guide";
    const draftId = await completeDraft(slug);
    const actor = await currentActor();

    const created = await siteBuilderUseCases().createSite.execute(actor, { draftId });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.readerPath).toBe(`/s/${slug}`);
    expect(created.value.categoryCount).toBe(2);
    // 画面の種類は型（beginner_guide）から自動で決まる。手で並べていない。
    expect(created.value.pageCount).toBeGreaterThan(0);

    // 読者側の入口は、見本のブログと同じユースケース。
    const site = await siteUseCases().getSite.execute(actor, { siteSlug: slug });
    expect(site.ok, "作ったブログが読者向けの経路で見つかりません").toBe(true);
    if (!site.ok) return;
    expect(site.value.blueprint.name).toBe("はじめてのレンズ");
  });

  it("ブログの一覧にも、見本と区別なく並ぶ", async () => {
    const slug = "second-lens-guide";
    const draftId = await completeDraft(slug);
    const actor = await currentActor();

    const before = await siteUseCases().listSites.execute(actor, {});
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    const created = await siteBuilderUseCases().createSite.execute(actor, { draftId });
    expect(created.ok).toBe(true);

    const after = await siteUseCases().listSites.execute(actor, {});
    expect(after.ok).toBe(true);
    if (!after.ok) return;

    expect(after.value.length).toBe(before.value.length + 1);
    expect(after.value.some((s) => s.slug === slug)).toBe(true);
  });

  it("差別化の 10 軸がすべて埋まっている（言い換えブログを作らせない）", async () => {
    const slug = "third-lens-guide";
    const draftId = await completeDraft(slug);
    const actor = await currentActor();

    const created = await siteBuilderUseCases().createSite.execute(actor, { draftId });
    // 10 軸のどれかが空なら createSiteBlueprint が断る。作れた時点で 10 軸が揃っている。
    expect(created.ok).toBe(true);
  });
});


// --- ここから下は、つなぎ目を差し替えて 1 段階ずつ確かめる ------------------

import type { SiteDraft } from "@/domain/authoring";
import { createSiteDraft } from "@/domain/authoring";
import {
  createCreateSiteFromDraftUseCase,
  createGetSiteDraftUseCase,
  createListSiteDraftsUseCase,
  createSaveSiteDraftStepUseCase,
  createStartSiteDraftUseCase,
} from "@/application/usecases/site/build-site";
import type { BuildSiteDeps } from "@/application/usecases/site/build-site";
import type { SiteDraftId, WorkspaceId } from "@/domain/shared/ids";
import { ok } from "@/domain/shared/result";
import { taggedString } from "@/domain/shared";
import { WORKSPACE, aNobody, anOwner } from "../support/actors";
import { failing, testDeps } from "../support/doubles";

/**
 * 見本の保存先を使うと、途中で止まった下書き・壊れた選択肢を作れない。
 * ウィザードで一番起きるのは「選ばずに次へ進んだ」「行の形が違う」で、
 * そこで何と言うかが、作れるか作れないかを分ける。
 */

const owner = anOwner();

/** 手元だけに置く下書きの保存先。 */
function memoryDrafts(seed: readonly SiteDraft[] = []) {
  const rows = new Map<string, SiteDraft>();
  for (const d of seed) rows.set(String(d.id), d);
  const published: string[] = [];
  const port = {
    find: async (_ws: unknown, id: unknown) => ok(rows.get(String(id)) ?? null),
    list: async () => ok([...rows.values()]),
    save: async (d: SiteDraft) => {
      rows.set(String(d.id), d);
      return ok(d);
    },
    publishBlueprint: async (slug: string, bp: unknown) => {
      published.push(slug);
      return ok(bp);
    },
  } as unknown as BuildSiteDeps["drafts"];
  return { port, rows, published };
}

function buildDeps(drafts: BuildSiteDeps["drafts"]): BuildSiteDeps {
  return { drafts, ids: testDeps().ids };
}

const DRAFT_ID = taggedString<"SiteDraftId">("sd_test") as SiteDraftId;

/** 全部の段階が埋まった下書き。作る操作を確かめるための土台。 */
function filledDraft(over: Partial<SiteDraft> = {}): SiteDraft {
  const base = createSiteDraft({ id: DRAFT_ID, workspaceId: WORKSPACE as WorkspaceId });
  return {
    ...base,
    purpose: "レンズ選びで迷わないようにする",
    genre: "カメラ・交換レンズ",
    targetReader: "一眼カメラを買って半年以内の人",
    searchIntent: "次に買う 1 本の選び方",
    uniqueExperience: "同じ被写体を全レンズで撮り比べた作例",
    conclusionStance: "用途ごとに 1 本ずつ挙げる",
    revenueModel: "affiliate",
    pattern: "beginner_guide",
    theme: "indigo-clay",
    name: "はじめてのレンズ",
    slug: "lens-start",
    articlePurpose: "候補を 3 本に絞らせる",
    ctaStrategy: "価格の確認だけに使う",
    evaluationAxis: "焦点距離と最短撮影距離",
    usageScene: "屋内で子どもを撮る",
    comparisonScope: "実売 10 万円以下",
    internalLinkStrategy: "案内から個別レビューへ送る",
    categories: [
      {
        slug: "prime-lenses",
        name: "単焦点レンズ",
        oneLine: "明るさで選ぶ 1 本目",
        initialArticleTypes: ["guide"],
      },
    ],
    articleTypes: ["guide", "comparison"],
    ...over,
  } as SiteDraft;
}

async function save(
  drafts: BuildSiteDeps["drafts"],
  step: string,
  answers: Record<string, string>,
  extra: Record<string, unknown> = {},
) {
  return createSaveSiteDraftStepUseCase(buildDeps(drafts)).execute(owner, {
    draftId: String(DRAFT_ID),
    step: step as never,
    answers,
    ...extra,
  });
}

describe("作りかけの一覧", () => {
  it("1 件も無いときは、次に何ができるかを書く", async () => {
    const result = await createListSiteDraftsUseCase(buildDeps(memoryDrafts().port)).execute(
      owner,
      {},
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(0);
    expect(result.value.emptyReason ?? "").toContain("新しく");
  });

  it("あるときは理由を出さない（空でもないのに空の説明が出ると混乱する）", async () => {
    const result = await createListSiteDraftsUseCase(
      buildDeps(memoryDrafts([filledDraft()]).port),
    ).execute(owner, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toBeNull();
    // 最後の「作る」は答える段階ではなく押す段階なので、
    // 全部答えても 12/13 と出る。埋め残しは無い（incomplete が空）。
    expect(result.value.items[0].doneCount).toBe(result.value.items[0].totalSteps - 1);
    expect(result.value.items[0].incomplete).toEqual([]);
  });

  it("読み取れないときは、空の一覧として返さない", async () => {
    const drafts = { ...memoryDrafts().port, list: async () => failing("読めません。") };
    const result = await createListSiteDraftsUseCase(
      buildDeps(drafts as BuildSiteDeps["drafts"]),
    ).execute(owner, {});
    expect(result.ok).toBe(false);
  });
});

describe("下書きを開く", () => {
  it("無い下書きは、見つからないと伝える", async () => {
    const result = await createGetSiteDraftUseCase(buildDeps(memoryDrafts().port)).execute(owner, {
      draftId: "sd_missing",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("読み取りに失敗したときは、無いことにしない", async () => {
    const drafts = { ...memoryDrafts().port, find: async () => failing("読めません。") };
    const result = await createGetSiteDraftUseCase(
      buildDeps(drafts as BuildSiteDeps["drafts"]),
    ).execute(owner, { draftId: String(DRAFT_ID) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).not.toBe("NOT_FOUND");
  });

  it("段階を指定しなければ、最初に埋まっていない段階を開く（続きから再開できる）", async () => {
    const half = filledDraft({ evaluationAxis: "", usageScene: "", comparisonScope: "", internalLinkStrategy: "" });
    const result = await createGetSiteDraftUseCase(
      buildDeps(memoryDrafts([half]).port),
    ).execute(owner, { draftId: String(DRAFT_ID) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentStep).toBe("content_plan");
  });

  it("全部埋まっていれば、作る段階が開く", async () => {
    const result = await createGetSiteDraftUseCase(
      buildDeps(memoryDrafts([filledDraft()]).port),
    ).execute(owner, { draftId: String(DRAFT_ID) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentStep).toBe("create");
    expect(result.value.incomplete).toEqual([]);
  });
});

describe("始める", () => {
  it("保存に失敗したら、始められたことにしない", async () => {
    const drafts = { ...memoryDrafts().port, save: async () => failing("保存できません。") };
    const result = await createStartSiteDraftUseCase(
      buildDeps(drafts as BuildSiteDeps["drafts"]),
    ).execute(owner, {});
    expect(result.ok).toBe(false);
  });
});

describe("選ぶ段階", () => {
  it("収益のしかたを選ばずに進もうとしたら、選ぶよう伝える", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "revenue", { revenueModel: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("revenueModel");
  });

  it("一覧にない収益のしかたは受け取らない", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "revenue", {
      revenueModel: "donation",
    });
    expect(result.ok).toBe(false);
  });

  it("ブログの型を選ばなければ断る", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "pattern", { pattern: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("pattern");
  });

  it("配色を選ばなければ断る", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "design", { theme: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("theme");
  });

  it("一覧にない配色は受け取らない（色の値を直接入れさせない）", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "design", { theme: "#ff0000" });
    expect(result.ok).toBe(false);
  });

  it("記事の種類を 1 つも選ばなければ断る", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "article_types", {}, {
      articleTypes: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("articleTypes");
  });

  it("知らない種類を混ぜても、知っているものだけを受け取る", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await save(drafts.port, "article_types", {}, {
      articleTypes: ["guide", "存在しない種類"],
    });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    expect(drafts.rows.get(String(DRAFT_ID))?.articleTypes).toEqual(["guide"]);
  });

  it("選んだ記事の種類は、カテゴリーにも配られる", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    await save(drafts.port, "article_types", {}, { articleTypes: ["comparison"] });
    const stored = drafts.rows.get(String(DRAFT_ID));
    expect(stored?.categories[0].initialArticleTypes).toEqual(["comparison"]);
  });

  it("最後の段階は入力ではなく実行だと伝える", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "create", {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("押して");
  });
});

describe("カテゴリーの入力", () => {
  it("1 行も無ければ、書き方の例を添えて断る", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "categories", {}, {
      categoriesText: "   \n  ",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("例:");
  });

  it("URL 名に使えない文字は、その行を示して断る", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "categories", {}, {
      categoriesText: "単焦点 / 単焦点レンズ / 明るさで選ぶ",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("単焦点");
  });

  it("全角のスラッシュでも受け取る（貼り付けで混ざる）", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await save(drafts.port, "categories", {}, {
      categoriesText: "zoom／ズームレンズ／交換せずに済ませたい人向け",
    });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    expect(drafts.rows.get(String(DRAFT_ID))?.categories[0].slug).toBe("zoom");
  });

  it("説明にスラッシュが入っていても、切り落とさずに残す", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    await save(drafts.port, "categories", {}, {
      categoriesText: "zoom / ズームレンズ / 屋内 / 屋外の両方で使う",
    });
    expect(drafts.rows.get(String(DRAFT_ID))?.categories[0].oneLine).toContain("屋外");
  });

  it("3 つに足りない行は断る", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "categories", {}, {
      categoriesText: "zoom / ズームレンズ",
    });
    expect(result.ok).toBe(false);
  });
});

describe("住所の段階", () => {
  it("名前が空なら断る", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "domain", {
      name: "",
      slug: "lens-start",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("name");
  });

  it("空欄のまま進もうとしたら、その段階の質問を添えて止める", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "purpose", { purpose: "  " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("purpose");
    expect(result.error.message).toContain("まだ埋まっていません");
  });

  it("保存に失敗したら、次の段階へ進めない", async () => {
    const drafts = {
      ...memoryDrafts([filledDraft()]).port,
      save: async () => failing("保存できません。"),
    };
    const result = await save(drafts as BuildSiteDeps["drafts"], "purpose", { purpose: "目的" });
    expect(result.ok).toBe(false);
  });

  it("無い下書きへの保存は、見つからないと伝える", async () => {
    const result = await save(memoryDrafts().port, "purpose", { purpose: "目的" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("最後の入力段階を保存しても、それ以上先へは進めない", async () => {
    const result = await save(memoryDrafts([filledDraft()]).port, "content_plan", {
      evaluationAxis: "焦点距離",
      usageScene: "屋内",
      comparisonScope: "10 万円以下",
      internalLinkStrategy: "案内から個別へ",
    });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentStep).toBe("create");
  });
});

describe("ブログを作る（つなぎ目を差し替えて）", () => {
  it("信頼のために足りないページを、作ったあとに伝える", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await createCreateSiteFromDraftUseCase(buildDeps(drafts.port)).execute(owner, {
      draftId: String(DRAFT_ID),
    });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value.readerPath).toBe("/s/lens-start");
    expect(drafts.published).toContain("lens-start");
    // 作れたことと、まだ足りないものは別。足りないものは隠さず返す。
    expect(Array.isArray(result.value.missingTrustPages)).toBe(true);
    expect(result.value.summary).toContain("はじめてのレンズ");
  });

  it("作ったあと、下書きに「作った先」が記録される（二重に作らせない）", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    await createCreateSiteFromDraftUseCase(buildDeps(drafts.port)).execute(owner, {
      draftId: String(DRAFT_ID),
    });
    expect(drafts.rows.get(String(DRAFT_ID))?.createdSiteSlug).toBe("lens-start");
  });

  it("登録に失敗したら、作れたことにしない", async () => {
    const drafts = {
      ...memoryDrafts([filledDraft()]).port,
      publishBlueprint: async () => failing("登録できません。"),
    };
    const result = await createCreateSiteFromDraftUseCase(
      buildDeps(drafts as BuildSiteDeps["drafts"]),
    ).execute(owner, { draftId: String(DRAFT_ID) });
    expect(result.ok).toBe(false);
  });

  it("下書きの更新に失敗したら、成功として返さない", async () => {
    const drafts = {
      ...memoryDrafts([filledDraft()]).port,
      save: async () => failing("保存できません。"),
    };
    const result = await createCreateSiteFromDraftUseCase(
      buildDeps(drafts as BuildSiteDeps["drafts"]),
    ).execute(owner, { draftId: String(DRAFT_ID) });
    expect(result.ok).toBe(false);
  });

  it("無い下書きからは作らない", async () => {
    const result = await createCreateSiteFromDraftUseCase(buildDeps(memoryDrafts().port)).execute(
      owner,
      { draftId: "sd_missing" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("権限", () => {
  it("ブログを作る権限が無い人には、どの操作も許さない", async () => {
    const deps = buildDeps(memoryDrafts([filledDraft()]).port);
    const nobody = aNobody();
    const results = await Promise.all([
      createListSiteDraftsUseCase(deps).execute(nobody, {}),
      createStartSiteDraftUseCase(deps).execute(nobody, {}),
      createGetSiteDraftUseCase(deps).execute(nobody, { draftId: String(DRAFT_ID) }),
      createSaveSiteDraftStepUseCase(deps).execute(nobody, {
        draftId: String(DRAFT_ID),
        step: "purpose",
        answers: { purpose: "目的" },
      }),
      createCreateSiteFromDraftUseCase(deps).execute(nobody, { draftId: String(DRAFT_ID) }),
    ]);
    for (const r of results) {
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.error.code).toBe("FORBIDDEN");
    }
  });
});
