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
