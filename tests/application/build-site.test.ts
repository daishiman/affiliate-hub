/**
 * @tier 1
 * @req REQ-P07, REQ-A05
 * @types equivalence, state-transition, audit-log
 *
 * 受け入れ条件 §30.5（ブログ）の中身は、ここで確かめている。
 * 複数のブログを作れること、ブログごとに設定を持てること、
 * 埋まっていない段階があるうちは作れず、どこが足りないかが返ること。
 */
import { describe, expect, it } from "vitest";
import { SITE_WIZARD_STEPS } from "@/domain/authoring";
import { createSampleAuditLog } from "@/infrastructure/persistence/sample/settings-sample-repository";
import { currentActor, siteBuilderUseCases, siteUseCases } from "@/presentation/composition";
import type { ActorContext } from "@/domain/shared";

/**
 * ブログ作成ウィザードの確認。
 *
 * ここで固定したいのは要件 C の核心 ——
 * **ブログを 1 本増やすのに、コードを 1 行も書かない**こと。
 * ウィザードで作ったブログが、見本と同じ画面・同じ読み取り経路で
 * 出てくることを、人の目視ではなく機械で確かめる。
 */

/**
 * ブログを作る担当者。
 *
 * 見本の身元（`currentActor()`）は 2026-08-18 に読む役だけになったので、
 * ここでは `site.draft` を持つ役を明示して呼ぶ。
 * **見本へ役を足して緑にしない。** 見本の役は、認証が無いいま
 * 「アドレスを知っている人全員が持つ役」と同じものである。
 */
async function builderActor(): Promise<ActorContext> {
  return { ...(await currentActor()), roles: ["writer"] };
}

/** 13 段階すべてに答えた下書きを作る。答えの中身は最小限で足りる。 */
async function completeDraft(slug: string): Promise<string> {
  const actor = await builderActor();
  const uc = (await siteBuilderUseCases());

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

describe("下書きの操作の記録", () => {
  it("記録が残せなくても、下書きは進む", async () => {
    /*
     * 下書きは読者から見えず、何度でも上書きでき、捨ててもよい。
     * 公開や鍵の発行と違い、**記録の欠けを理由に止めると、
     * 直せる範囲の作業まで止まる**。実際に止めた版では、記録の置き場が無い段で
     * ウィザードが 1 段目から進まなくなった。
     * 記録が要る境目は「作った瞬間」で、そこは別の試験が押さえている。
     */
    const actor = await builderActor();
    const uc = await siteBuilderUseCases();

    const started = await uc.startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const saved = await uc.saveStep.execute(actor, {
      draftId: started.value.draftId,
      step: "purpose",
      answers: { purpose: "記録が書けない段でも入力が進むことの確認" },
    });
    expect(saved.ok).toBe(true);
  });

  // 書ける置き場を渡したときに何が積まれるかは、
  // つなぎ目を差し替えられるこのファイル下部（「下書きの記録の中身」）で見る。
});

describe("ブログ作成ウィザード", () => {
  it("13 段階すべてに、何を決めるかの質問が付いている", async () => {
    const actor = await builderActor();
    const started = await (await siteBuilderUseCases()).startDraft.execute(actor, {});
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
    const actor = await builderActor();
    const started = await (await siteBuilderUseCases()).startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(started.value.createdSiteSlug).toBeNull();
    expect(started.value.incomplete.length).toBeGreaterThan(0);
  });

  it("開いている段階の入力欄が application 層から返る（画面が欄を書き起こさない）", async () => {
    const actor = await builderActor();
    const started = await (await siteBuilderUseCases()).startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    for (const step of SITE_WIZARD_STEPS) {
      const view = await (await siteBuilderUseCases()).getDraft.execute(actor, {
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
    const actor = await builderActor();
    const started = await (await siteBuilderUseCases()).startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const created = await (await siteBuilderUseCases()).createSite.execute(actor, {
      draftId: started.value.draftId,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    // 「作れません」だけで終わらせない。戻る先が分かる言葉を出す。
    expect(created.error.message).toContain("ブログの目的");
  });

  it("URL に使えない文字は、直し方の分かる言葉で断る", async () => {
    const actor = await builderActor();
    const started = await (await siteBuilderUseCases()).startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const saved = await (await siteBuilderUseCases()).saveStep.execute(actor, {
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
    const actor = await builderActor();
    const started = await (await siteBuilderUseCases()).startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const saved = await (await siteBuilderUseCases()).saveStep.execute(actor, {
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
    const actor = await builderActor();
    const started = await (await siteBuilderUseCases()).startDraft.execute(actor, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const saved = await (await siteBuilderUseCases()).saveStep.execute(actor, {
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
  /*
   * 「作れて、読者向けの経路に出てくる」ことは
   * `tests/integration/d1-site-draft.test.ts` で、**本物の保存先の上**で見る。
   *
   * --- ここで見るものが 2026-08-18 に変わった ---
   *
   * それまで、この段では記録の追記が必ず失敗していたので、
   * ここで見ていたのは「残せないときに作ってしまわないこと」だった。
   * 記録先を控え（この実行中だけ覚える置き場）にしたので、
   * 作る操作は**この段でも最後まで通る**ようになった。
   *
   * 断られる側が消えたわけではない。記録が残せないときの断り方と文面は、
   * つなぎ目を差し替えられる下部（「ブログを作ったことの記録」の
   * 「記録を残せなかったときは、作れたこととして返さない」）が見ている。
   * ここで見るのは、**通ったときに本当に記録が残っているか**である。
   * 通るようになったのに記録が空なら、控えは偽の成功に戻っている。
   */
  it("作れて、読者向けの一覧に出てくる", async () => {
    const slug = "first-lens-guide";
    const draftId = await completeDraft(slug);
    const actor = await builderActor();

    const created = await (await siteBuilderUseCases()).createSite.execute(actor, { draftId });
    expect(created.ok).toBe(true);

    const after = await (await siteUseCases()).listSites.execute(actor, {});
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.some((s) => s.slug === slug)).toBe(true);
  });

  /*
   * 控えは「この実行中だけ覚える」置き場であって、書いたふりではない。
   * 積んだだけで読み返せないなら、断り続けていたときと同じく
   * **その先について何も確かめられていない**ことになる。
   */
  it("作った記録が、本当に読み返せる", async () => {
    const slug = "second-lens-guide";
    const draftId = await completeDraft(slug);
    const actor = await builderActor();

    const created = await (await siteBuilderUseCases()).createSite.execute(actor, { draftId });
    expect(created.ok).toBe(true);

    const audit = createSampleAuditLog();
    const found = await audit.listByTarget(actor.workspaceId, "site", slug);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.map((e) => e.action)).toContain("site.created");
  });
});


// --- ここから下は、つなぎ目を差し替えて 1 段階ずつ確かめる ------------------

import type { SiteDraft } from "@/domain/authoring";
import {
  SITE_PROVISIONING_REQUIRED_COUNTS,
  createSiteDraft,
  evaluateSiteComposition,
} from "@/domain/authoring";
import type { SiteProvisionRequest } from "@/application/ports/authoring";
import { defaultLayoutSlotSeeds } from "@/domain/blogops";
import {
  STEP_FIELDS,
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
import { failing, recordingAuditLog, testDeps } from "../support/doubles";

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
  const creationAudits: SiteProvisionRequest["audit"][] = [];
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
    provisionSite: async (request: SiteProvisionRequest) => {
      published.push(request.slug);
      rows.set(String(request.completedDraft.id), request.completedDraft);
      creationAudits.push(request.audit);
      return ok({
        blueprint: request.blueprint,
        composition: evaluateSiteComposition(
          {
            ...SITE_PROVISIONING_REQUIRED_COUNTS,
            categories: request.blueprint.categories.length,
            articles: 0,
          },
          ["site_documents"],
        ),
      });
    },
  } as unknown as BuildSiteDeps["drafts"];
  return { port, rows, published, creationAudits };
}

/**
 * 見本の記録は書き足しを断る（保存先が無い）ので、溜める版を使う。
 * `audit` から、何が残ったかをそのまま読める。
 */
function buildDeps(
  drafts: BuildSiteDeps["drafts"],
  over: Partial<BuildSiteDeps> = {},
): BuildSiteDeps & { readonly audit: ReturnType<typeof recordingAuditLog> } {
  const audit = recordingAuditLog();
  return {
    drafts,
    ids: testDeps().ids,
    auditLog: audit.port,
    now: () => new Date(),
    capacity: { withLease: async (_workspaceId, _kind, mutation) => mutation() },
    ...over,
    audit,
  };
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

/**
 * REQ-S06 の「未入力のステップは次へ進めない理由を表示」を、**段階ごとに**押さえる。
 *
 * ここを足した理由（実測、2026-08-29）。`createSaveSiteDraftStepUseCase` の
 * `isStepComplete` の門を丸ごと素通しにしたとき、赤くなったのは 2 件だけだった
 *（この段の「空欄のまま進もうとしたら…」と `admin-actions.test.ts` の 1 件）。
 * さらに `purpose` と `content_plan` の 2 段階だけ検査を残して**残り 11 段階を
 * 素通し**にしたところ、この 2 ファイル 123 件すべて緑だった。
 *
 * つまり要件は 13 段階について書かれているのに、機械が見ていたのは 2 段階だけだった。
 * 段階を足したときも同じ穴が空く（新しい段階の検査は誰も見ていない）。
 *
 * `create` は入力欄を持たない最終段階なので除く（`STEP_FIELDS.create` が空）。
 */
describe("REQ-S06: どの段階も、空欄のままでは次へ進めない", () => {
  const inputSteps = SITE_WIZARD_STEPS.filter((s) => STEP_FIELDS[s].length > 0);

  it("入力欄を持つ段階が 12 ある（段階を足したらこの数も動く）", () => {
    expect(inputSteps).toHaveLength(12);
  });

  it.each(inputSteps)("%s: 空欄で保存しようとすると断られる", async (step) => {
    // その段階の入力欄をすべて空文字で埋めて保存を試みる。
    const answers = Object.fromEntries(STEP_FIELDS[step].map((f) => [f, "  "]));
    const result = await save(memoryDrafts([filledDraft()]).port, step, answers);

    // 「次へ進めない」。どちらの門が断ったかは問わない
    //（段階によっては `isStepComplete` より先に `applyStep` が断る）。
    expect(result.ok, `${step} が空欄のまま通った`).toBe(false);
    if (result.ok) return;

    // 「理由を表示」。文言そのものは写さない——実装から期待値を組み立てると、
    // 文言を変えたときテストも一緒に動いて何も守らなくなる。
    // 代わりに**直す場所を指しているか**を見る。読者にとっての「理由」は
    // 「どこを直せばよいか」であって、文章の言い回しではない。
    expect(result.error.message.trim()).not.toBe("");
    expect(STEP_FIELDS[step], `${step} の誤りが、この段階の入力欄を指していない`).toContain(
      result.error.field,
    );
  });
});

describe("ブログを作る（つなぎ目を差し替えて）", () => {
  it("上限なら公開保存の前に止める", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await createCreateSiteFromDraftUseCase(
      buildDeps(drafts.port, {
        capacity: { withLease: async () => failing("ブログの上限です。") },
      }),
    ).execute(owner, { draftId: String(DRAFT_ID) });

    expect(result.ok).toBe(false);
    expect(drafts.published).toHaveLength(0);
  });

  it("作成済みの下書きは編集経路へ案内し、作成も容量確保もしない", async () => {
    const drafts = memoryDrafts([
      filledDraft({ slug: "changed-draft-slug", createdSiteSlug: "lens-start" }),
    ]);
    let leases = 0;
    const result = await createCreateSiteFromDraftUseCase(
      buildDeps(drafts.port, {
        capacity: {
          withLease: async () => {
            leases += 1;
            return failing("ブログの上限です。");
          },
        },
      }),
    ).execute(owner, { draftId: String(DRAFT_ID) });

    expect(result.ok).toBe(false);
    expect(leases).toBe(0);
    expect(drafts.published).toEqual([]);
    if (!result.ok) expect(result.error.message).toContain("編集画面");
  });

  it("信頼のために足りないページを、作ったあとに伝える", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await createCreateSiteFromDraftUseCase(buildDeps(drafts.port)).execute(owner, {
      draftId: String(DRAFT_ID),
    });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value.readerPath).toBe("/s/lens-start");
    expect(drafts.published).toContain("lens-start");
    expect(result.value.missingTrustPages).toHaveLength(8);
    /*
      `pageCount` は**中身のあるサイト文書の実数**であって、枠の数ではない。
      空の枠を 8 行先に作るのをやめた（`SITE_PROVISIONING_REQUIRED_COUNTS`
      の `site_documents: 0`）ので、作った直後は 0 で、8 種すべてが
      `missingTrustPages` に並ぶ。ここを 8 に戻すと、まだ 1 文字も書かれて
      いない運営者情報を「作成済みのページ」として数えることになる。
    */
    expect(result.value.pageCount).toBe(0);
    expect(result.value.provisioningComplete).toBe(true);
    expect(result.value.contentReady).toBe(false);
    expect(result.value.gaps.map((gap) => gap.element)).toEqual(["site_documents", "articles"]);
    expect(result.value.summary).toContain("はじめてのレンズ");
    expect(result.value.summary).toContain("公開準備には未完了");
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
      provisionSite: async () => failing("登録できません。"),
    };
    const result = await createCreateSiteFromDraftUseCase(
      buildDeps(drafts as BuildSiteDeps["drafts"]),
    ).execute(owner, { draftId: String(DRAFT_ID) });
    expect(result.ok).toBe(false);
  });

  it("下書き更新を含む一括保存が失敗したら、成功として返さない", async () => {
    const drafts = {
      ...memoryDrafts([filledDraft()]).port,
      provisionSite: async () => failing("下書きを更新できません。"),
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

/**
 * ブログを消す口はまだ無い。つまり作るのは**取り消せない操作**で、
 * 「誰が・いつ・どんな設計で作ったか」はここでしか残せない。
 */
describe("ブログを作ったことの記録", () => {
  it("誰が・どのブログを作ったかが残る", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const deps = buildDeps(drafts.port);
    const done = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: String(DRAFT_ID),
    });
    expect(done.ok, done.ok ? "" : done.error.message).toBe(true);

    const entries = drafts.creationAudits;
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry?.action).toBe("site.created");
    expect(entry?.targetType).toBe("site");
    // 「どのブログか」は URL 名で辿る。読者が見ているものと同じ手がかりにする。
    expect(entry?.targetId).toBe("lens-start");
    expect(String(entry?.actor.userId)).toBe(owner.userId);
    expect(entry?.after).toMatchObject({ name: "はじめてのレンズ", recreated: false });
  });

  it("同じ下書きの二重作成を断り、監査記録も 1 件のままにする", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const deps = buildDeps(drafts.port);
    const useCase = createCreateSiteFromDraftUseCase(deps);
    await useCase.execute(owner, { draftId: String(DRAFT_ID) });
    const second = await useCase.execute(owner, { draftId: String(DRAFT_ID) });

    expect(second.ok).toBe(false);
    expect(drafts.creationAudits).toHaveLength(1);
    expect(drafts.creationAudits[0]?.after).toMatchObject({ recreated: false });
  });

  it("記録を残せなかったときは、作れたこととして返さない", async () => {
    const base = memoryDrafts([filledDraft()]);
    const drafts = {
      ...base.port,
      provisionSite: async () => failing("操作の記録を保存できません。"),
    } as BuildSiteDeps["drafts"];
    const deps = buildDeps(drafts);
    const done = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: String(DRAFT_ID),
    });

    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.message).toContain("記録");
    expect(base.published).toEqual([]);
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

describe("下書きの記録の中身", () => {
  it("始めたことと、埋めた段が 1 行ずつ残る", async () => {
    const deps = buildDeps(memoryDrafts().port);

    const started = await createStartSiteDraftUseCase(deps).execute(owner, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    await createSaveSiteDraftStepUseCase(deps).execute(owner, {
      draftId: started.value.draftId,
      step: "purpose",
      answers: { purpose: "レンズ選びで迷わせない" },
    });

    expect(deps.audit.actions()).toEqual(["site_draft.started", "site_draft.step_saved"]);
  });

  it("答えの中身は記録に写らない", async () => {
    /*
     * 下書きに書かれるのはブログの狙いや説明文で、後から画面で読めば済む。
     * 記録へ写しても増える情報が無く、段階を進めるたびに
     * 同じ文章が記録側へ積み上がるだけになる。
     */
    const deps = buildDeps(memoryDrafts([filledDraft()]).port);
    const answer = "この文章は記録へ写らないこと";

    await createSaveSiteDraftStepUseCase(deps).execute(owner, {
      draftId: String(DRAFT_ID),
      step: "purpose",
      answers: { purpose: answer },
    });

    expect(JSON.stringify(deps.audit.entries())).not.toContain(answer);
  });

  it("どこまで埋まったかは残る（途中で止まった下書きを記録側から追える）", async () => {
    const deps = buildDeps(memoryDrafts([filledDraft()]).port);

    await createSaveSiteDraftStepUseCase(deps).execute(owner, {
      draftId: String(DRAFT_ID),
      step: "purpose",
      answers: { purpose: "レンズ選びで迷わせない" },
    });

    const after = deps.audit.entries().at(-1)?.after as
      | { step: string; doneCount: number; totalSteps: number }
      | undefined;
    expect(after?.step).toBe("purpose");
    expect(after?.totalSteps).toBe(13);
    expect(after?.doneCount).toBeGreaterThan(0);
  });
});

/**
 * 「作れた」と言ったのに `/s/<URL名>` が 404 だった事故の再発防止。
 *
 * 成功の定義を**保存先から数え直した件数**に一本化する。
 * 数え直しは本物の保存先でも見本でも同じ順序で行うので、
 * 手元と本番で「作れた」の意味が分かれない。
 */
describe("作れたと言えるのは、原子的な一括保存が完了したときだけ", () => {
  it("必要実体がそろえば作成完了、本文未公開なら内容準備は未完了と返す", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await createCreateSiteFromDraftUseCase(buildDeps(drafts.port)).execute(owner, {
      draftId: String(DRAFT_ID),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reachable).toBe(true);
    expect(result.value.provisioningComplete).toBe(true);
    expect(result.value.contentReady).toBe(false);
    expect(result.value.gaps.map((gap) => gap.element)).toEqual(["site_documents", "articles"]);
    expect(result.value.counts.network_node).toBe(1);
    expect(result.value.counts.layout_slots).toBe(defaultLayoutSlotSeeds().length);
    expect(result.value.counts.articles).toBe(0);
  });

  it("一括保存が失敗したら、下書きを完了にせず成功も返さない", async () => {
    const base = memoryDrafts([filledDraft()]);
    const drafts = {
      ...base.port,
      provisionSite: async () => failing("ブログの作成を完了できません。"),
    } as BuildSiteDeps["drafts"];
    const result = await createCreateSiteFromDraftUseCase(
      buildDeps(drafts),
    ).execute(owner, { draftId: String(DRAFT_ID) });

    expect(result.ok).toBe(false);
    expect(base.rows.get(String(DRAFT_ID))?.createdSiteSlug).toBeNull();
    expect(base.published).toEqual([]);
  });

  it("住所が設定されていれば、読者に伝える先はサブドメインになる", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await createCreateSiteFromDraftUseCase(
      buildDeps(drafts.port, { siteBaseDomain: "example.com" }),
    ).execute(owner, { draftId: String(DRAFT_ID) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.readerHost).toBe("lens-start.example.com");
    expect(result.value.summary).toContain("lens-start.example.com");
    // パスでも同じものが開くことは、案内から落とさない。
    expect(result.value.summary).toContain("/s/lens-start");
  });

  it("住所が設定されていない環境では、パスだけを案内する", async () => {
    const drafts = memoryDrafts([filledDraft()]);
    const result = await createCreateSiteFromDraftUseCase(buildDeps(drafts.port)).execute(owner, {
      draftId: String(DRAFT_ID),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.readerHost).toBeNull();
    expect(result.value.summary).toContain("/s/lens-start");
  });
});
