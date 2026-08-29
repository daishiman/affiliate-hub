/** @tier 1 @req REQ-R11, REQ-SEC07, REQ-SEC09 @types state-transition, decision-table, audit-log */
import { describe, expect, it } from "vitest";
import {
  CONTENT_STATE_LABEL,
  DEFAULT_REVIEW_OVERDUE_LIMIT,
  type AdvanceContentStateDeps,
  type ManageContentDeps,
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createGetContentUseCase,
  createListContentBoardUseCase,
  createListReviewOverdueUseCase,
} from "@/application/usecases/content/manage-content";
import type { EditorialPublishedArticleWriterPort } from "@/application/ports/site";
import type { BrandScopeFilter } from "@/application/ports/common";
import {
  CONTENT_STATES,
  type ContentPackage,
  type ContentState,
  type ContentVariant,
} from "@/domain/authoring";
import type { PolicyDomainScope } from "@/domain/compliance";
import type { Publication } from "@/domain/distribution";
import type { BrandId, ContentPackageId, ContentVariantId, WorkspaceId } from "@/domain/shared";
import { markCommercial, markEditorial, ok, taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anAiAccount, anAnalyst, anOutsider, anOwner, aWriter } from "../support/actors";
import { failing, recordingAuditLog, recordingEvents, testDeps } from "../support/doubles";

/**
 * 記事の進行と承認。
 *
 * --- ここで固定したいこと ---
 * この仕組みの中心は「承認を飛ばして公開できないこと」ひとつに尽きる。
 * 状態の判断は domain の `transition` だけが持ち、ここでも画面でも
 * if を書き足さない約束になっている。**書き足したら抜け道ができる**ので、
 * 通れない道（飛ばし・AI 単独の承認・不適合のまま承認）を通る道より多く確かめる。
 *
 * もう 1 つは「確認しなかった項目を、合格として見せない」こと。
 * ハッシュタグの上限は能力表に無いので、上限なしと偽らず
 * 実行しなかった検査として残る。ここが崩れると、画面は緑なのに
 * 誰も見ていない項目がある、という最も気づけない壊れ方になる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2（ユースケースの単体テスト）
 */

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const outsideBrandOwner = anOwner({
  workspaceId: WS,
  scopedBrandIds: [taggedString<"BrandId">("brand-outside") as BrandId],
});
const writer = aWriter({ workspaceId: WS });
const analyst = anAnalyst({ workspaceId: WS });
const aiAccount = anAiAccount({ workspaceId: WS });
const nobody = aNobody({ workspaceId: WS });

/** 見本の記事。合格する側と、わざと欠陥を入れてある側。 */
const REVIEWABLE = "cv_alpha_review";
const FAILING_DRAFT = "cv_alpha_draft";
const SHORT_POST = "cv_beta_short";
const APPROVED_POST = "cv_alpha_approved";

/** 承認の理由。空だと承認そのものが断られる（記録に理由が要るため）。 */
const APPROVE_REASON = "根拠と価格の表記を確認したため。";

function deps(over: Partial<AdvanceContentStateDeps> = {}): AdvanceContentStateDeps {
  const base = testDeps();
  return {
    packages: base.contentPackages,
    variants: base.contentVariants,
    personas: base.personas,
    policyRules: base.policyRules,
    // 既定を見本（追記できない）にすると、承認のテストが全部
    // 「記録できない」で落ちる。ここで見たいのは承認そのものなので受け皿を置く。
    auditLog: recordingAuditLog().port,
    ids: base.ids,
    events: base.events,
    publications: base.publications,
    articles: base.publishedArticles,
    ...over,
  };
}

/** 見本の記事置き場を土台に、指定の操作だけ差し替える。編集側の印は付け直す。 */
function variantsWith(over: Record<string, unknown>): ManageContentDeps["variants"] {
  return markEditorial({ ...testDeps().contentVariants, ...over }) as ManageContentDeps["variants"];
}

/**
 * 進行の現在地を覚えていられる記事置き場。
 *
 * 見本の置き場は保存を断る（保存先が無いのに成功を装わないため）ので、
 * それでは「進めたこと」そのものを確かめられない。ここでは保存先の代わりを立てて、
 * **進んだ位置が残るか**と**出来事が出るか**だけを見る。
 *
 * 記録は空から始める。空のときは呼び出し側が渡した `from` を出発点として
 * 受け入れる決まりなので、各テストは見本の段階に縛られずに順路を選べる。
 * 保存先に実際に書けるかどうかは D1 の結合テスト（tests/integration/d1-content.test.ts）が見る。
 */
function variantsRemembering(seed: Partial<Record<string, ContentState>> = {}) {
  const states = new Map<string, ContentState>(
    Object.entries(seed).filter((e): e is [string, ContentState] => e[1] !== undefined),
  );
  const saved: { current: ContentVariant | null } = { current: null };
  const port = variantsWith({
    findState: async (_ws: unknown, id: unknown) => ok(states.get(String(id)) ?? null),
    saveState: async (_ws: unknown, id: unknown, state: ContentState) => {
      states.set(String(id), state);
      return ok(state);
    },
    save: async (v: ContentVariant) => {
      saved.current = v;
      return ok(v);
    },
  });
  return { port, states, saved };
}

function ownSitePublication(): Publication {
  return {
    id: "pub_quiet_laptop",
    workspaceId: WS,
    variantId: FAILING_DRAFT,
    channelKind: "own_site",
    connectionId: null,
    state: "PUBLISHED",
    scheduledAt: null,
    idempotencyKey: "pub_quiet_laptop:key",
    attempts: 1,
    externalId: "quiet-laptop",
    externalUrl: "/s/video-editing-gear/guides/quiet-laptop",
    lastError: null,
    publishedAt: new Date("2026-08-26T00:00:00Z"),
  } as Publication;
}

function publicationsWith(items: readonly Publication[]): AdvanceContentStateDeps["publications"] {
  return {
    ...testDeps().publications,
    async listByVariant() {
      return ok(items);
    },
  };
}

function articleProjection(
  over: Partial<EditorialPublishedArticleWriterPort> = {},
) {
  const visible = new Set(["video-editing-gear/quiet-laptop"]);
  const port = markEditorial({
    async save() {
      return ok(true as const);
    },
    async unpublish(_workspaceId: WorkspaceId, siteSlug: string, slug: string) {
      visible.delete(`${siteSlug}/${slug}`);
      return ok(true as const);
    },
    ...over,
  }) as EditorialPublishedArticleWriterPort;
  return { port, visible };
}

function personasWith(over: Record<string, unknown>): ManageContentDeps["personas"] {
  return markEditorial({ ...testDeps().personas, ...over }) as ManageContentDeps["personas"];
}

function packagesWith(over: Record<string, unknown>): ManageContentDeps["packages"] {
  return markEditorial({
    ...testDeps().contentPackages,
    ...over,
  }) as ManageContentDeps["packages"];
}

/** 見本の記事を 1 本取り出す。テストが id を手打ちしないため。 */
async function sampleVariant(id: string): Promise<ContentVariant> {
  const found = await createGetContentUseCase(deps()).execute(owner, { variantId: id });
  if (!found.ok) throw new Error(`見本の記事 ${id} を読めません: ${found.error.message}`);
  return found.value.variant;
}

describe("記事の依存関係", () => {
  it("報酬のポートが混ざっていたら、組み立ての時点で止まる", () => {
    const commercial = markCommercial({ findById: async () => ok(null) });
    expect(() =>
      createListContentBoardUseCase(
        deps({ variants: commercial as unknown as ManageContentDeps["variants"] }),
      ),
    ).toThrow(/商業データのポート/);
  });

  it("止まる理由に、報酬を判断に入れられないことが書いてある", () => {
    const commercial = markCommercial({ findById: async () => ok(null) });
    expect(() =>
      createApproveContentUseCase(
        deps({ variants: commercial as unknown as ManageContentDeps["variants"] }),
      ),
    ).toThrow(/報酬/);
  });
});

describe("進行の一覧", () => {
  it("限定担当者の一覧に担当外ブランドの記事を混ぜない", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(outsideBrandOwner, {});
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.total).toBe(0);
    expect(got.value.columns.flatMap((column) => column.items)).toEqual([]);
  });

  it("担当外の記事がraw limitの先頭でも、後続の担当記事を同じページで返す", async () => {
    const base = await sampleVariant(REVIEWABLE);
    const allowedPackageId = taggedString<"ContentPackageId">("pkg-allowed") as ContentPackageId;
    const outsidePackageId = taggedString<"ContentPackageId">("pkg-outside") as ContentPackageId;
    const outside = {
      ...base,
      id: taggedString<"ContentVariantId">("cv-outside") as ContentVariantId,
      contentPackageId: outsidePackageId,
    };
    const allowed = {
      ...base,
      id: taggedString<"ContentVariantId">("cv-allowed") as ContentVariantId,
      contentPackageId: allowedPackageId,
    };
    const basePackage = await testDeps().contentPackages.findById(WS, base.contentPackageId);
    if (!basePackage.ok || basePackage.value === null) throw new Error("見本企画がありません");
    const packages = new Map<string, ContentPackage>([
      [String(outsidePackageId), { ...basePackage.value, id: outsidePackageId, brandId: "brand-outside" }],
      [String(allowedPackageId), { ...basePackage.value, id: allowedPackageId, brandId: "brand-allowed" }],
    ]);
    const actor = anOwner({
      workspaceId: WS,
      scopedBrandIds: [taggedString<"BrandId">("brand-allowed") as BrandId],
    });
    const got = await createListContentBoardUseCase(
      deps({
        packages: packagesWith({
          findById: async (_workspaceId: WorkspaceId, id: ContentPackageId) =>
            ok(packages.get(String(id)) ?? null),
        }),
        variants: variantsWith({
          listByState: async (
            _workspaceId: WorkspaceId,
            state: ContentState,
            page: { limit: number },
            scope?: BrandScopeFilter,
          ) => {
            const raw = state === "FACT_CHECK" ? [outside, allowed] : [];
            const scoped =
              scope === undefined
                ? raw
                : raw.filter((variant) => {
                    const pkg = packages.get(String(variant.contentPackageId));
                    return scope.brandIds.some((brandId) => String(brandId) === pkg?.brandId);
                  });
            const items = scoped.slice(0, page.limit);
            return ok({
              items,
              nextCursor:
                items.length > 0 && items.length < scoped.length ? String(items.at(-1)?.id) : null,
            });
          },
        }),
      }),
    ).execute(actor, { limitPerState: 1 });

    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.columns.flatMap((column) => column.items).map((item) => item.variantId)).toEqual([
      "cv-allowed",
    ]);
    expect(got.value.total).toBe(1);
  });

  it("状態の数だけ列が並び、内部の名前をそのまま出さない", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    expect(got.value.columns.map((c) => c.state)).toEqual([...CONTENT_STATES]);
    for (const column of got.value.columns) {
      expect(column.label).toBe(CONTENT_STATE_LABEL[column.state]);
      expect(column.label).not.toBe(column.state);
    }
  });

  it("見本の 4 本が、それぞれの列に入っている", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    const idsOf = (state: string) =>
      got.value.columns.find((c) => c.state === state)?.items.map((i) => i.variantId) ?? [];
    expect(idsOf("GENERATED")).toContain(FAILING_DRAFT);
    expect(idsOf("FACT_CHECK")).toContain(REVIEWABLE);
    expect(idsOf("COMPLIANCE_REVIEW")).toContain(SHORT_POST);
    // 承認済みが 1 本ある。これが無いと、配信を作る操作を誰も試せない。
    expect(idsOf("APPROVED")).toContain(APPROVED_POST);
    expect(got.value.total).toBe(4);
    expect(got.value.emptyReason).toBeNull();
  });

  it("見出しの無い記事は、空欄ではなく未設定と分かる文字で出る", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    const card = got.value.columns
      .flatMap((c) => c.items)
      .find((i) => i.variantId === SHORT_POST);
    expect(card?.title).toBe("（見出し未設定）");
    expect(card?.channel).toBe("x");
  });

  it("表示のきまりの確認中からは、承認へ進めるが、それは人の操作にあたる", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    const column = got.value.columns.find((c) => c.state === "COMPLIANCE_REVIEW");
    expect(column?.nextStates).toContainEqual({ state: "APPROVED", label: "承認済み" });
    expect(column?.humanOnlyNext).toEqual(["APPROVED"]);
  });

  it("下書きの列から承認へは直接進めない（人の操作の一覧にも出ない）", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    const column = got.value.columns.find((c) => c.state === "GENERATED");
    expect(column?.nextStates.map((n) => n.state)).not.toContain("APPROVED");
    expect(column?.humanOnlyNext).toEqual([]);
  });

  it("取り下げ済みからは、どこへも進めない", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    const column = got.value.columns.find((c) => c.state === "ARCHIVED");
    expect(column?.nextStates).toEqual([]);
    expect(column?.humanOnlyNext).toEqual([]);
  });

  it("1 列あたり 0 件までと指定すると、0 件になり、理由の一文が出る", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, { limitPerState: 0 });
    if (!got.ok) throw got.error;

    expect(got.value.total).toBe(0);
    expect(got.value.emptyReason).toContain("まだ記事がありません");
  });

  it("1 列あたり 1 件までと指定すると、どの列も 1 件を超えない", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(owner, { limitPerState: 1 });
    if (!got.ok) throw got.error;

    for (const column of got.value.columns) {
      expect(column.items.length).toBeLessThanOrEqual(1);
    }
  });

  it("読み出しに失敗したときは、0 件の一覧として見せない", async () => {
    const got = await createListContentBoardUseCase(
      deps({ variants: variantsWith({ listByState: async () => failing("記事置き場に繋がりません。") }) }),
    ).execute(owner, {});

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("権限が無い人には一覧を返さない", async () => {
    const got = await createListContentBoardUseCase(deps()).execute(nobody, {});
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("記事 1 本の確認", () => {
  it("担当外ブランドの記事はIDを知っていても読めない", async () => {
    const got = await createGetContentUseCase(deps()).execute(outsideBrandOwner, {
      variantId: REVIEWABLE,
    });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("TENANT_MISMATCH");
  });

  it("書き手の名前と企画が一緒に返る", async () => {
    const got = await createGetContentUseCase(deps()).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.authorName).toBe("編集部");
    expect(got.value.package).not.toBeNull();
    expect(got.value.variant.id).toBe(REVIEWABLE);
  });

  it("指摘が出ている下書きは、承認できない理由が文章で返る", async () => {
    const got = await createGetContentUseCase(deps()).execute(owner, { variantId: FAILING_DRAFT });
    if (!got.ok) throw got.error;

    expect(got.value.quality.status).toBe("fail");
    expect(got.value.approvalBlockedReason).toContain("指摘");
    expect(got.value.quality.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("誇大表現が指摘として名前つきで出る", async () => {
    const got = await createGetContentUseCase(deps()).execute(owner, { variantId: FAILING_DRAFT });
    if (!got.ok) throw got.error;

    const issues = got.value.quality.issues.map((i) => i.check);
    expect(issues).toContain("exaggeration");
  });

  it("確認していない項目は、合格ではなく未実施として残る", async () => {
    const got = await createGetContentUseCase(deps()).execute(owner, { variantId: SHORT_POST });
    if (!got.ok) throw got.error;

    const skipped = got.value.quality.skipped.find((s) => s.check === "hashtag_fit");
    expect(skipped).toBeDefined();
    expect(skipped?.reason.length).toBeGreaterThan(0);
    expect(got.value.quality.issues.map((i) => i.check)).not.toContain("hashtag_fit");
  });

  it("能力表に無い媒体でも、広告表記は本文に要るものとして確認する", async () => {
    const base = await sampleVariant(FAILING_DRAFT);
    const got = await createGetContentUseCase(
      deps({
        variants: variantsWith({
          findById: async () =>
            ok({ ...base, channel: "未知の媒体", affiliateLinkIds: ["al_sample"] }),
        }),
      }),
    ).execute(owner, { variantId: FAILING_DRAFT });
    if (!got.ok) throw got.error;

    // 知らない媒体を「広告表記の要らない媒体」として扱うと、規制に触れる側へ倒れる。
    const issue = got.value.quality.issues.find((i) => i.check === "disclosure_present");
    expect(issue).toBeDefined();
    // 媒体名は能力表から引けないので、記事に書かれている名前がそのまま出る。
    expect(issue?.message).toContain("未知の媒体");
  });

  it("能力表にある媒体では、指摘の文言も表示名で出る", async () => {
    const base = await sampleVariant(SHORT_POST);
    const long = "あ".repeat(400);
    const got = await createGetContentUseCase(
      deps({ variants: variantsWith({ findById: async () => ok({ ...base, body: long }) }) }),
    ).execute(owner, { variantId: SHORT_POST });
    if (!got.ok) throw got.error;

    const issue = got.value.quality.issues.find((i) => i.check === "length_fit");
    expect(issue?.message).toContain("X");
    expect(issue?.message).toContain("280");
  });

  it("書き手の設定が見つからないときは、合格を返さず理由を返す", async () => {
    const got = await createGetContentUseCase(
      deps({ personas: personasWith({ findAuthor: async () => ok(null) }) }),
    ).execute(owner, { variantId: REVIEWABLE });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.message).toContain("書き手");
    expect(got.error.suggestedAction ?? "").not.toBe("");
  });

  it("無い記事を指しても、空の中身を返さない", async () => {
    const got = await createGetContentUseCase(deps()).execute(owner, { variantId: "cv_no_such" });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.suggestedAction ?? "").toContain("一覧");
  });

  it("別の作業場所の人には、権限があっても見えない", async () => {
    const got = await createGetContentUseCase(deps()).execute(anOutsider(), {
      variantId: REVIEWABLE,
    });
    expect(got.ok).toBe(false);
  });

  it("企画の読み出しに失敗したときは、企画なしとして通さない", async () => {
    const got = await createGetContentUseCase(
      deps({ packages: packagesWith({ findById: async () => failing("企画に繋がりません。") }) }),
    ).execute(owner, { variantId: REVIEWABLE });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("書き手の読み出しに失敗したときも、判定を続けない", async () => {
    const got = await createGetContentUseCase(
      deps({ personas: personasWith({ findAuthor: async () => failing("書き手に繋がりません。") }) }),
    ).execute(owner, { variantId: REVIEWABLE });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("すでに承認済みの記事は、その旨が理由として返る", async () => {
    const base = await sampleVariant(REVIEWABLE);
    const got = await createGetContentUseCase(
      deps({
        variants: variantsWith({ findById: async () => ok({ ...base, status: "approved" }) }),
      }),
    ).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.approvalBlockedReason).toContain("承認済み");
  });

  it("いまの段階と、そこから進める先が一緒に返る", async () => {
    const got = await createGetContentUseCase(deps()).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    // 見本のこの記事は事実確認中にいる。
    expect(got.value.state).toBe("FACT_CHECK");
    expect(got.value.stateLabel).toBe("事実確認中");
    // 進める先は遷移表そのまま。画面が並べ直さないための材料。
    expect(got.value.nextStates.map((n) => n.state)).toEqual([
      "COMPLIANCE_REVIEW",
      "GENERATED",
      "ARCHIVED",
    ]);
    expect(got.value.nextStates.every((n) => n.label !== n.state)).toBe(true);
  });

  it("人の操作でしか進めない先には、その印が付く", async () => {
    const store = variantsRemembering({ [SHORT_POST]: "COMPLIANCE_REVIEW" });
    const got = await createGetContentUseCase(deps({ variants: store.port })).execute(owner, {
      variantId: SHORT_POST,
    });
    if (!got.ok) throw got.error;

    const approved = got.value.nextStates.find((n) => n.state === "APPROVED");
    // 印が無いと、画面は承認を「段階の選択肢の 1 つ」として出してしまう。
    expect(approved?.humanOnly).toBe(true);
    expect(got.value.nextStates.find((n) => n.state === "FACT_CHECK")?.humanOnly).toBe(false);
  });

  it("進行の記録が無いときは、最初の段階にいることにしない", async () => {
    const got = await createGetContentUseCase(
      deps({ variants: variantsWith({ findState: async () => ok(null) }) }),
    ).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    // 既定値で埋めると、画面には進めるように見えて、押しても通らない。
    expect(got.value.state).toBeNull();
    expect(got.value.stateLabel).toBeNull();
    expect(got.value.nextStates).toEqual([]);
  });

  it("確認の段階まで来ていない記事は、承認できない理由が段階で返る", async () => {
    const got = await createGetContentUseCase(deps()).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    // 押してから断るのではなく、押す前に同じ理由を出す。
    expect(got.value.approvalBlockedReason).toContain("事実確認中");
    expect(got.value.approvalBlockedReason).toContain("表示のきまりを確認中");
  });

  it("確認の段階まで来ている記事は、承認を止める理由が無い", async () => {
    const store = variantsRemembering({ [REVIEWABLE]: "COMPLIANCE_REVIEW" });
    const got = await createGetContentUseCase(deps({ variants: store.port })).execute(owner, {
      variantId: REVIEWABLE,
    });
    if (!got.ok) throw got.error;

    expect(got.value.approvalBlockedReason).toBeNull();
  });

  it("権限が無い人には記事の中身を返さない", async () => {
    const got = await createGetContentUseCase(deps()).execute(nobody, { variantId: REVIEWABLE });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("見直しの時期が来たもの", () => {
  it("限定担当者の見直し一覧に担当外ブランドの記事を混ぜない", async () => {
    const variant = await sampleVariant(REVIEWABLE);
    const got = await createListReviewOverdueUseCase(
      deps({ variants: variantsWith({ listReviewOverdue: async () => ok([variant]) }) }),
    ).execute(outsideBrandOwner, {});
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.items).toEqual([]);
  });

  it("担当外の期限超過がraw limitの先頭でも、後続の担当記事を返す", async () => {
    const base = await sampleVariant(REVIEWABLE);
    const allowedPackageId = taggedString<"ContentPackageId">("pkg-review-allowed") as ContentPackageId;
    const outsidePackageId = taggedString<"ContentPackageId">("pkg-review-outside") as ContentPackageId;
    const outside = {
      ...base,
      id: taggedString<"ContentVariantId">("cv-review-outside") as ContentVariantId,
      contentPackageId: outsidePackageId,
    };
    const allowed = {
      ...base,
      id: taggedString<"ContentVariantId">("cv-review-allowed") as ContentVariantId,
      contentPackageId: allowedPackageId,
    };
    const basePackage = await testDeps().contentPackages.findById(WS, base.contentPackageId);
    if (!basePackage.ok || basePackage.value === null) throw new Error("見本企画がありません");
    const packages = new Map<string, ContentPackage>([
      [String(outsidePackageId), { ...basePackage.value, id: outsidePackageId, brandId: "brand-outside" }],
      [String(allowedPackageId), { ...basePackage.value, id: allowedPackageId, brandId: "brand-allowed" }],
    ]);
    const actor = anOwner({
      workspaceId: WS,
      scopedBrandIds: [taggedString<"BrandId">("brand-allowed") as BrandId],
    });
    const got = await createListReviewOverdueUseCase(
      deps({
        packages: packagesWith({
          findById: async (_workspaceId: WorkspaceId, id: ContentPackageId) =>
            ok(packages.get(String(id)) ?? null),
        }),
        variants: variantsWith({
          listReviewOverdue: async (
            _workspaceId: WorkspaceId,
            _at: Date,
            limit: number,
            scope?: BrandScopeFilter,
          ) => {
            const raw = [outside, allowed];
            const scoped =
              scope === undefined
                ? raw
                : raw.filter((variant) => {
                    const pkg = packages.get(String(variant.contentPackageId));
                    return scope.brandIds.some((brandId) => String(brandId) === pkg?.brandId);
                  });
            return ok(scoped.slice(0, limit));
          },
        }),
      }),
    ).execute(actor, { limit: 1 });

    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.items.map((item) => item.variantId)).toEqual(["cv-review-allowed"]);
  });

  it("0 件のときは、無言の空白ではなく期日内である旨を返す", async () => {
    const got = await createListReviewOverdueUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    expect(got.value.items).toEqual([]);
    expect(got.value.emptyReason).toContain("期日");
  });

  it("対象があるときは一覧になり、理由の一文は出ない", async () => {
    const base = await sampleVariant(REVIEWABLE);
    const got = await createListReviewOverdueUseCase(
      deps({ variants: variantsWith({ listReviewOverdue: async () => ok([base]) }) }),
    ).execute(owner, {});
    if (!got.ok) throw got.error;

    expect(got.value.items.map((i) => i.variantId)).toEqual([REVIEWABLE]);
    expect(got.value.emptyReason).toBeNull();
  });

  it("件数の指定が無いときは 20 件までを取りに行く", async () => {
    let asked: number | null = null;
    const got = await createListReviewOverdueUseCase(
      deps({
        variants: variantsWith({
          listReviewOverdue: async (_ws: unknown, _now: unknown, limit: number) => {
            asked = limit;
            return ok([]);
          },
        }),
      }),
    ).execute(owner, {});

    expect(got.ok).toBe(true);
    // 実物に名前が付いたので読める。素の字だったころは、ユースケース側の
    // 無名の `20` と検査側の `20` が別々に動けた。
    expect(asked).toBe(DEFAULT_REVIEW_OVERDUE_LIMIT);
  });

  it("件数を指定すると、その数がそのまま渡る", async () => {
    let asked: number | null = null;
    const got = await createListReviewOverdueUseCase(
      deps({
        variants: variantsWith({
          listReviewOverdue: async (_ws: unknown, _now: unknown, limit: number) => {
            asked = limit;
            return ok([]);
          },
        }),
      }),
    ).execute(owner, { limit: 3 });

    expect(got.ok).toBe(true);
    expect(asked).toBe(3);
  });

  it("読み出しに失敗したときは、0 件として見せない", async () => {
    const got = await createListReviewOverdueUseCase(
      deps({ variants: variantsWith({ listReviewOverdue: async () => failing("繋がりません。") }) }),
    ).execute(owner, {});

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("権限が無い人には返さない", async () => {
    const got = await createListReviewOverdueUseCase(deps()).execute(nobody, {});
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("状態を進める", () => {
  it("担当外ブランドの記事はIDを知っていても状態を進められない", async () => {
    const store = variantsRemembering();
    const got = await createAdvanceContentStateUseCase(deps({ variants: store.port })).execute(
      outsideBrandOwner,
      { variantId: FAILING_DRAFT, from: "GENERATED", to: "FACT_CHECK" },
    );
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("TENANT_MISMATCH");
    expect(store.states.size).toBe(0);
  });

  it("決められた順路は通れて、進んだ先が読める言葉で返る", async () => {
    const store = variantsRemembering();
    const got = await createAdvanceContentStateUseCase(deps({ variants: store.port })).execute(
      owner,
      { variantId: FAILING_DRAFT, from: "GENERATED", to: "FACT_CHECK" },
    );
    if (!got.ok) throw got.error;

    expect(got.value.state).toBe("FACT_CHECK");
    expect(got.value.label).toBe("事実確認中");
    expect(got.value.variantId).toBe(FAILING_DRAFT);
    // 返り値だけでなく、**進んだ位置が置き場に残っている**ことまで見る。
    expect(store.states.get(FAILING_DRAFT)).toBe("FACT_CHECK");
  });

  it("進めたのに保存できなかったときは、進んだと返さない", async () => {
    // 見本の置き場は進行を保存できない。成功を装うと、押した直後だけ動いて見える。
    const got = await createAdvanceContentStateUseCase(deps()).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "GENERATED",
      to: "FACT_CHECK",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("画面を開いたままの人が古い段階から押しても、後から押したほうが勝たない", async () => {
    const store = variantsRemembering({ [FAILING_DRAFT]: "FACT_CHECK" });
    const got = await createAdvanceContentStateUseCase(deps({ variants: store.port })).execute(
      owner,
      // 画面には GENERATED と出ているが、置き場ではもう FACT_CHECK。
      { variantId: FAILING_DRAFT, from: "GENERATED", to: "BRIEF_READY" },
    );

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("CONFLICT");
    expect(got.error.message).toContain("事実確認中");
    expect(got.error.suggestedAction ?? "").not.toBe("");
    // 弾いたのだから、置き場は動かない。
    expect(store.states.get(FAILING_DRAFT)).toBe("FACT_CHECK");
  });

  it("承認を飛ばして公開へは進めない", async () => {
    const got = await createAdvanceContentStateUseCase(deps()).execute(owner, {
      variantId: REVIEWABLE,
      from: "FACT_CHECK",
      to: "PUBLISHED",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("CONFLICT");
    expect(got.error.suggestedAction ?? "").toContain("COMPLIANCE_REVIEW");
  });

  it("AI のサービスアカウントは承認へ進められない", async () => {
    const got = await createAdvanceContentStateUseCase(deps()).execute(aiAccount, {
      variantId: SHORT_POST,
      from: "COMPLIANCE_REVIEW",
      to: "APPROVED",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
    expect(got.error.message).toContain("人が行う");
  });

  it("AI のサービスアカウントでも、下書きの手前までは進められる", async () => {
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: variantsRemembering().port }),
    ).execute(aiAccount, { variantId: FAILING_DRAFT, from: "BRIEF_READY", to: "GENERATED" });
    if (!got.ok) throw got.error;

    expect(got.value.state).toBe("GENERATED");
  });

  it("下書きができたことは、他の仕組みが受け取れる出来事として出る", async () => {
    const events = recordingEvents();
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: variantsRemembering().port, events: events.port }),
    ).execute(owner, { variantId: FAILING_DRAFT, from: "BRIEF_READY", to: "GENERATED" });

    expect(got.ok).toBe(true);
    expect(events.names()).toContain("content_variant.generated");
    const payload = events.published()[0]?.payload as { variantId?: string };
    expect(payload.variantId).toBe(FAILING_DRAFT);
  });

  it("見直しの時期に入ったことも、出来事として出る", async () => {
    const events = recordingEvents();
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: variantsRemembering().port, events: events.port }),
    ).execute(owner, { variantId: REVIEWABLE, from: "PUBLISHED", to: "REFRESH_DUE" });

    expect(got.ok).toBe(true);
    expect(events.names()).toEqual(["content.refresh_due"]);
  });

  it("途中の移動では、出来事を作らない", async () => {
    const events = recordingEvents();
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: variantsRemembering().port, events: events.port }),
    ).execute(owner, { variantId: FAILING_DRAFT, from: "GENERATED", to: "FACT_CHECK" });

    expect(got.ok).toBe(true);
    expect(events.names()).toEqual([]);
  });

  it("進めなかったときは、出来事も作らない", async () => {
    const events = recordingEvents();
    const got = await createAdvanceContentStateUseCase(deps({ events: events.port })).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "GENERATED",
      to: "PUBLISHED",
    });

    expect(got.ok).toBe(false);
    expect(events.names()).toEqual([]);
  });

  it("知らせられなくても、進んだこと自体は取り消さない", async () => {
    const got = await createAdvanceContentStateUseCase(
      deps({
        variants: variantsRemembering().port,
        events: { publish: async () => failing("通知先に繋がりません。") },
      }),
    ).execute(owner, { variantId: FAILING_DRAFT, from: "BRIEF_READY", to: "GENERATED" });
    if (!got.ok) throw got.error;

    expect(got.value.state).toBe("GENERATED");
  });

  it("無い記事は、状態を確かめる前に見つからないと返す", async () => {
    const got = await createAdvanceContentStateUseCase(deps()).execute(owner, {
      variantId: "cv_no_such",
      from: "GENERATED",
      to: "FACT_CHECK",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
  });

  it("読むだけの人は、状態を進められない", async () => {
    const got = await createAdvanceContentStateUseCase(deps()).execute(analyst, {
      variantId: FAILING_DRAFT,
      from: "GENERATED",
      to: "FACT_CHECK",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("承認", () => {
  it("担当外ブランドの記事はIDを知っていても承認できない", async () => {
    const store = variantsRemembering({ [REVIEWABLE]: "COMPLIANCE_REVIEW" });
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(
      outsideBrandOwner,
      { variantId: REVIEWABLE, reason: APPROVE_REASON },
    );
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("TENANT_MISMATCH");
    expect(store.saved.current).toBeNull();
  });

  it("人が承認すると、承認済みとして保存される", async () => {
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(owner, {
      reason: APPROVE_REASON,
      variantId: REVIEWABLE,
    });
    if (!got.ok) throw got.error;

    expect(got.value.status).toBe("approved");
    expect(store.saved.current?.status).toBe("approved");
    expect(store.saved.current?.id).toBe(REVIEWABLE);
  });

  it("表示のきまりの確認まで来ている記事を承認すると、かんばんの列も承認済みへ動く", async () => {
    // 記事は「承認済み」なのに列は「確認中」のまま、という
    // 同じ 1 本について 2 つの答えが見える状態を作らない。
    const store = variantsRemembering({ [SHORT_POST]: "COMPLIANCE_REVIEW" });
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(owner, {
      reason: APPROVE_REASON,
      variantId: SHORT_POST,
    });
    if (!got.ok) throw got.error;

    expect(store.states.get(SHORT_POST)).toBe("APPROVED");
  });

  it("確認をまだ通っていない記事は、承認できない理由が読める言葉で返る", async () => {
    const store = variantsRemembering({ [REVIEWABLE]: "FACT_CHECK" });
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(owner, {
      reason: APPROVE_REASON,
      variantId: REVIEWABLE,
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("CONFLICT");
    // 遷移表の言葉（FACT_CHECK → APPROVED）をそのまま画面へ出さない。
    expect(got.error.message).not.toContain("FACT_CHECK");
    expect(got.error.message).toContain("事実確認中");
    expect(got.error.suggestedAction ?? "").not.toBe("");
    // 承認していないのだから、本文も列も動いていない。
    expect(store.saved.current).toBeNull();
    expect(store.states.get(REVIEWABLE)).toBe("FACT_CHECK");
  });

  it("承認したことは、誰が承認したかつきで出来事になる", async () => {
    const events = recordingEvents();
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(
      deps({ variants: store.port, events: events.port }),
    ).execute(owner, { reason: APPROVE_REASON, variantId: REVIEWABLE });

    expect(got.ok).toBe(true);
    expect(events.names()).toEqual(["content_variant.approved"]);
    const payload = events.published()[0]?.payload as { approvedBy?: string };
    expect(payload.approvedBy).toBe(String(owner.userId));
  });

  it("AI のサービスアカウントが持ち主の権限を借りていても、単独では承認できない", async () => {
    const store = variantsRemembering();
    const saved = store.saved;
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(
      anOwner({ workspaceId: WS, isAiServiceAccount: true }),
      { reason: APPROVE_REASON, variantId: REVIEWABLE },
    );

    expect(got.ok).toBe(false);
    if (got.ok) return;
    // 役割の一覧ではなく「AI かどうか」で止まる。役割を足しても抜けられない。
    expect(got.error.code).toBe("FORBIDDEN");
    expect(got.error.message).toContain("人が行う");
    expect(saved.current).toBeNull();
  });

  it("自動確認で不適合の記事は承認できない", async () => {
    const store = variantsRemembering();
    const saved = store.saved;
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(owner, {
      reason: APPROVE_REASON,
      variantId: FAILING_DRAFT,
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(saved.current).toBeNull();
  });

  it("保存できなかったときに、承認できたと返さない", async () => {
    const events = recordingEvents();
    // 見本の置き場は保存を断る。進行の記録はまだ無い（＝段階では止まらない）ので、
    // ここで返るのは保存できなかったことそのものになる。
    const got = await createApproveContentUseCase(
      deps({ variants: variantsWith({ findState: async () => ok(null) }), events: events.port }),
    ).execute(owner, { reason: APPROVE_REASON, variantId: REVIEWABLE });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
    expect(events.names()).toEqual([]);
  });

  it("知らせられなくても、承認そのものは残る", async () => {
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(
      deps({ variants: store.port, events: { publish: async () => failing("通知先が無い。") } }),
    ).execute(owner, { reason: APPROVE_REASON, variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.status).toBe("approved");
  });

  it("書ける人でも、承認の権限が無ければ承認できない", async () => {
    const store = variantsRemembering();
    const saved = store.saved;
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(writer, {
      reason: APPROVE_REASON,
      variantId: REVIEWABLE,
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
    expect(saved.current).toBeNull();
  });

  it("無い記事は承認できない", async () => {
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(deps({ variants: store.port })).execute(owner, {
      reason: APPROVE_REASON,
      variantId: "cv_no_such",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
  });
});

/**
 * 表現ポリシー（薬機法など）が、記事の確認画面と承認の両方から**実際に呼ばれている**こと。
 *
 * ルールは `policy-rule-seed.ts` に 13 件登録してあり、当て方の検査も domain 側にある。
 * それでも**呼ばれていなければ結果は 1 文字も変わらない**。
 * 登録されたルールは、呼ばれるまでは無いルールと同じである。
 *
 * ここで見るのは登録内容ではなく経路そのもの。
 *   - 分野が合う記事では止まる（当たる）
 *   - 分野が違う記事では止まらない（当たりすぎない）
 *   - 画面の案内と、承認の拒否が**同じ理由**で起きる
 *   - 分野が分からないときは「違反 0 件」にせず止める
 *
 * 規範: tasks/task-policy-check-wiring.md / docs/product/traceability.md REQ-SEC07
 *
 * 要件 REQ-SEC07 / 種別 decision-table。**印はファイル冒頭にある**
 * （機械が読むのは先頭 40 行だけなので、ここに `@` で書いても読まれない）。
 */
describe("表現ポリシーの検査", () => {
  /** 薬機法の block ルール（治る・完治の断定）に当たる一文。 */
  const NG_TEXT = "飲み続ければ花粉症が治ります。";

  async function samplePackage(id: string) {
    const found = await createGetContentUseCase(deps()).execute(owner, { variantId: id });
    if (!found.ok) throw found.error;
    if (found.value.package === null) throw new Error(`見本の記事 ${id} に企画がありません`);
    return found.value.package;
  }

  /** 指定した分野の企画と、指定した本文の記事を組み合わせた依存一式。 */
  async function depsWith(over: {
    domainScope?: PolicyDomainScope;
    body?: string;
    packageMissing?: boolean;
    variants?: ManageContentDeps["variants"];
  }) {
    const pkg = await samplePackage(REVIEWABLE);
    const variant = await sampleVariant(REVIEWABLE);
    const base = over.variants ?? deps().variants;
    return deps({
      packages: packagesWith({
        findById: async () =>
          ok(
            over.packageMissing === true
              ? null
              : { ...pkg, domainScope: over.domainScope ?? pkg.domainScope },
          ),
      }),
      variants: markEditorial({
        ...base,
        findById: async () => ok({ ...variant, body: over.body ?? variant.body }),
      }) as ManageContentDeps["variants"],
    });
  }

  it("薬機法の分野の記事に断定表現があると、確認画面に違反として出る", async () => {
    const got = await createGetContentUseCase(
      await depsWith({ domainScope: "health_food", body: NG_TEXT }),
    ).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.policyUncheckedReason).toBeNull();
    expect(got.value.policy?.violations.map((v) => v.ruleName)).toContain(
      "薬機法: 治る・完治の断定",
    );
    expect(got.value.policy?.publishable).toBe(false);
    // 禁止だけ示して終わらせない。言い換えが無いと執筆者はそこで止まる。
    expect(got.value.policy?.violations[0]?.suggestion.length).toBeGreaterThan(0);
  });

  it("同じ文でも、分野の違う記事には当たらない", async () => {
    const got = await createGetContentUseCase(
      await depsWith({ domainScope: "general", body: NG_TEXT }),
    ).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.policy?.violations.map((v) => v.ruleName)).not.toContain(
      "薬機法: 治る・完治の断定",
    );
  });

  it("止める違反があるあいだは、承認へ進めない理由が画面に出る", async () => {
    const got = await createGetContentUseCase(
      await depsWith({ domainScope: "health_food", body: NG_TEXT }),
    ).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.approvalBlockedReason).toContain("表現のきまり");
    expect(got.value.approvalBlockedReason).toContain("薬機法: 治る・完治の断定");
  });

  it("画面で案内するだけでなく、承認そのものが断られる", async () => {
    // 案内文だけにすると、REST や AI から直接呼んだときに素通りする。
    const store = variantsRemembering({ [REVIEWABLE]: "COMPLIANCE_REVIEW" });
    const got = await createApproveContentUseCase(
      await depsWith({ domainScope: "health_food", body: NG_TEXT, variants: store.port }),
    ).execute(owner, { reason: APPROVE_REASON, variantId: REVIEWABLE });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("CONFLICT");
    expect(got.error.message).toContain("薬機法: 治る・完治の断定");
    // 断ったのだから、本文も列も動いていない。
    expect(store.saved.current).toBeNull();
    expect(store.states.get(REVIEWABLE)).toBe("COMPLIANCE_REVIEW");
  });

  it("同じ記事でも、分野が違えば承認は通る", async () => {
    const store = variantsRemembering({ [REVIEWABLE]: "COMPLIANCE_REVIEW" });
    const got = await createApproveContentUseCase(
      await depsWith({ domainScope: "general", body: NG_TEXT, variants: store.port }),
    ).execute(owner, { reason: APPROVE_REASON, variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.status).toBe("approved");
  });

  it("企画が見つからないときは、違反 0 件にせず止める", async () => {
    // 分野が分からないまま通すと、薬機法のルールが 1 件も当たっていない記事が
    // 「指摘なし」で承認される。分からないことを緑にしない。
    const got = await createGetContentUseCase(await depsWith({ packageMissing: true })).execute(
      owner,
      { variantId: REVIEWABLE },
    );
    if (!got.ok) throw got.error;

    expect(got.value.policy).toBeNull();
    expect(got.value.policyUncheckedReason).toContain("確認できていません");
    expect(got.value.approvalBlockedReason).toContain("確認できていません");
  });

  it("ルールの読み出しに失敗したときは、判定を続けない", async () => {
    const got = await createGetContentUseCase(
      deps({
        policyRules: {
          ...testDeps().policyRules,
          listEnabled: async () => failing("ポリシーの保存先に繋がりません。"),
        },
      }),
    ).execute(owner, { variantId: REVIEWABLE });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("見出しも本文と同じく検査の対象になる", async () => {
    // 見出しだけ規制を素通りする道を残さない。検索結果に出るのは見出しである。
    const pkg = await samplePackage(REVIEWABLE);
    const variant = await sampleVariant(REVIEWABLE);
    const got = await createGetContentUseCase(
      deps({
        packages: packagesWith({
          findById: async () => ok({ ...pkg, domainScope: "health_food" }),
        }),
        variants: variantsWith({
          findById: async () => ok({ ...variant, title: NG_TEXT, body: "本文は問題ありません。" }),
        }),
      }),
    ).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.policy?.publishable).toBe(false);
  });
});

/**
 * 操作の記録（監査ログ）が、承認と段階の移動から**実際に書かれている**こと。
 *
 * --- なぜここで固定するか ---
 * ドメインには記録の作り方（`createAuditLogEntry`）が最初からあり、
 * 設定画面には読み口もあった。**書く側だけが 1 か所も無かった。**
 * ルールが揃っていて呼ぶ場所が無い、という壊れ方は、
 * 一覧が「0 件」と出るだけなので画面からは正常に見える。
 * 表現ポリシー（上の describe）とまったく同じ形の穴だった。
 *
 * 見るのは「記録の型が正しいか」ではない（それは
 * tests/domain/records-and-metrics.test.ts が見ている）。
 * ここで見るのは**経路**、つまり承認を通すと記録が 1 件増えるか、
 * 記録できないときに承認を成功として返さないか、の 2 点。
 *
 * 種別を `audit-log` としているのは、確かめているのが入力値の分割ではなく
 * 「操作 → 記録」の対応そのものだから。
 *
 * 規範: docs/product/traceability.md REQ-SEC09
 *
 * 要件 REQ-SEC09 / 種別 audit-log。**印はファイル冒頭にある**
 * （機械が読むのは先頭 40 行だけなので、ここに `@` で書いても読まれない）。
 */
describe("操作の記録", () => {
  it("承認すると、誰が・何に・なぜ が 1 件記録される", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(owner, { variantId: REVIEWABLE, reason: APPROVE_REASON });
    if (!got.ok) throw got.error;

    expect(log.actions()).toEqual(["content.approved"]);
    const entry = log.entries()[0];
    expect(entry?.targetType).toBe("content_variant");
    expect(entry?.targetId).toBe(REVIEWABLE);
    expect(String(entry?.actor.userId)).toBe(String(owner.userId));
    // 人が承認したことを、後から型で確かめられる形で残す。
    expect(entry?.actor.isAiServiceAccount).toBe(false);
    expect(entry?.reason).toBe(APPROVE_REASON);
  });

  it("理由の無い承認は断る。本文も列も記録も動かない", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(owner, { variantId: REVIEWABLE, reason: "   " });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(got.error.field).toBe("reason");
    expect(store.saved.current).toBeNull();
    expect(log.entries()).toEqual([]);
  });

  /*
   * 取り下げ（読者へ出したものを引っ込める）。
   *
   * ここまで、`ARCHIVED` へ移す操作はすべて `content.state_changed` の
   * 1 語で記録されていた。**`ARCHIVED` はどの段階からも行ける**ので、
   * 「まだ誰の目にも触れていない記事を没にした」と
   * 「読者が見ていた記事を引っ込めた」が同じ 1 語に潰れていた。
   * 後者は仕様書 §7 の必須記録対象（公開・削除）である。
   */
  it("読者へ出した記事を取り下げると、理由つきで content.unpublished が残る", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "紹介した商品の取り扱いが終わったため",
    });
    if (!got.ok) throw got.error;

    expect(log.actions()).toEqual(["content.unpublished"]);
    expect(log.entries()[0]?.reason).toBe("紹介した商品の取り扱いが終わったため");
    expect(log.entries()[0]?.before).toEqual({ state: "PUBLISHED" });
  });

  it("公開中の記事を ARCHIVED にしたら、同じ公開先を読者から見えなくする", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const projection = articleProjection();

    const got = await createAdvanceContentStateUseCase(
      deps({
        variants: store.port,
        auditLog: log.port,
        articles: projection.port,
        publications: publicationsWith([ownSitePublication()]),
      }),
    ).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "掲載内容を見直すため",
    });
    if (!got.ok) throw got.error;

    expect(projection.visible.has("video-editing-gear/quiet-laptop")).toBe(false);
    expect(log.actions()).toEqual(["content.unpublished"]);
  });

  it("読者向けの写しを外せなければ、段階も監査記録も動かさない", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const projection = articleProjection({
      unpublish: async () => failing("公開記事の保存先に繋がりません。"),
    });

    const got = await createAdvanceContentStateUseCase(
      deps({
        variants: store.port,
        auditLog: log.port,
        articles: projection.port,
        publications: publicationsWith([ownSitePublication()]),
      }),
    ).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "掲載内容を見直すため",
    });

    expect(got.ok).toBe(false);
    expect(store.states.get(FAILING_DRAFT)).toBe("PUBLISHED");
    expect(log.entries()).toEqual([]);
  });

  it("複数公開先の途中で失敗しても、再試行で済んだURLを冪等に通して残りへ収束する", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const hidden = new Set<string>();
    let secondFailed = false;
    const articles = markEditorial({
      async save() {
        return ok(true as const);
      },
      async unpublish(_workspaceId: WorkspaceId, siteSlug: string, slug: string) {
        const key = `${siteSlug}/${slug}`;
        if (slug === "second-article" && !secondFailed) {
          secondFailed = true;
          return failing("2件目の取り下げだけ一時的に失敗しました。");
        }
        hidden.add(key);
        return ok(true as const);
      },
    }) as EditorialPublishedArticleWriterPort;
    const publications = publicationsWith([
      ownSitePublication(),
      {
        ...ownSitePublication(),
        id: "pub_second_article",
        externalId: "second-article",
        externalUrl: "/s/second-site/guides/second-article",
      } as Publication,
    ]);
    const advance = createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: log.port, articles, publications }),
    );
    const input = {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED" as const,
      to: "ARCHIVED" as const,
      reason: "複数公開先から取り下げるため",
    };

    const first = await advance.execute(owner, input);
    expect(first.ok).toBe(false);
    expect(hidden.has("video-editing-gear/quiet-laptop")).toBe(true);
    expect(store.states.get(FAILING_DRAFT)).toBe("PUBLISHED");

    const retried = await advance.execute(owner, input);
    expect(retried.ok).toBe(true);
    expect(hidden).toEqual(
      new Set(["video-editing-gear/quiet-laptop", "second-site/second-article"]),
    );
    expect(store.states.get(FAILING_DRAFT)).toBe("ARCHIVED");
    expect(log.actions()).toEqual(["content.unpublished"]);
  });

  it("写しを外した後に段階保存が失敗したら、済んだことを隠さない", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const variants = markEditorial({
      ...store.port,
      saveState: async () => failing("進行状態の保存先に繋がりません。"),
    }) as AdvanceContentStateDeps["variants"];
    const projection = articleProjection();

    const got = await createAdvanceContentStateUseCase(
      deps({
        variants,
        auditLog: log.port,
        articles: projection.port,
        publications: publicationsWith([ownSitePublication()]),
      }),
    ).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "掲載内容を見直すため",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(projection.visible.has("video-editing-gear/quiet-laptop")).toBe(false);
    expect(store.states.get(FAILING_DRAFT)).toBe("PUBLISHED");
    expect(got.error.message).toContain("読者ページから外れ");
    expect(got.error.message).toContain("進行状態");
    expect(log.entries()).toEqual([]);
  });

  it("監査記録に失敗しても、取り下げ済みの事実と既存履歴を失わない", async () => {
    const history = recordingAuditLog();
    const priorStore = variantsRemembering({ [FAILING_DRAFT]: "GENERATED" });
    const prior = await createAdvanceContentStateUseCase(
      deps({ variants: priorStore.port, auditLog: history.port }),
    ).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "GENERATED",
      to: "FACT_CHECK",
    });
    if (!prior.ok) throw prior.error;

    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const projection = articleProjection();
    const got = await createAdvanceContentStateUseCase(
      deps({
        variants: store.port,
        articles: projection.port,
        publications: publicationsWith([ownSitePublication()]),
        auditLog: {
          ...history.port,
          append: async () => failing("監査記録の保存先に繋がりません。"),
        },
      }),
    ).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "掲載内容を見直すため",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(projection.visible.has("video-editing-gear/quiet-laptop")).toBe(false);
    expect(store.states.get(FAILING_DRAFT)).toBe("ARCHIVED");
    expect(got.error.message).toContain("読者ページから外れ");
    expect(got.error.message).toContain("記録");
    expect(history.actions()).toEqual(["content.state_changed"]);
  });

  it("監査だけ失敗した取り下げは、同じ要求の再試行で補記し、その後も重複しない", async () => {
    const history = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const projection = articleProjection();
    let rejectNextAppend = true;
    const auditLog: AdvanceContentStateDeps["auditLog"] = {
      ...history.port,
      async append(entry) {
        if (rejectNextAppend) {
          rejectNextAppend = false;
          return failing("監査記録の保存先に一時的に繋がりません。");
        }
        return history.port.append(entry);
      },
    };
    const advance = createAdvanceContentStateUseCase(
      deps({
        variants: store.port,
        articles: projection.port,
        publications: publicationsWith([ownSitePublication()]),
        auditLog,
      }),
    );
    const input = {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED" as const,
      to: "ARCHIVED" as const,
      reason: "掲載内容を見直すため",
    };

    const first = await advance.execute(owner, input);
    expect(first.ok).toBe(false);
    expect(store.states.get(FAILING_DRAFT)).toBe("ARCHIVED");
    expect(projection.visible.has("video-editing-gear/quiet-laptop")).toBe(false);
    expect(history.entries()).toEqual([]);

    const resumed = await advance.execute(owner, input);
    expect(resumed.ok, resumed.ok ? "" : resumed.error.message).toBe(true);
    expect(history.actions()).toEqual(["content.unpublished"]);

    const repeated = await advance.execute(owner, input);
    expect(repeated.ok, repeated.ok ? "" : repeated.error.message).toBe(true);
    expect(history.actions()).toEqual(["content.unpublished"]);
  });

  it.each([
    {
      label: "理由が違う",
      retryActor: owner,
      retryReason: "別の判断で取り下げるため",
    },
    {
      label: "操作した人が違う",
      retryActor: { ...owner, userId: "u_other_owner" },
      retryReason: "掲載内容を見直すため",
    },
  ])("ARCHIVEDでも $label 要求を取り下げの再開として通さない", async ({ retryActor, retryReason }) => {
    const history = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const advance = createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: history.port }),
    );
    const first = await advance.execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "掲載内容を見直すため",
    });
    if (!first.ok) throw first.error;

    const unrelated = await advance.execute(retryActor, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: retryReason,
    });

    expect(unrelated.ok).toBe(false);
    expect(history.actions()).toEqual(["content.unpublished"]);
  });

  it("別の公開段階からARCHIVEDにした履歴を、PUBLISHEDからの再開と取り違えない", async () => {
    const history = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "MONITORING" });
    const advance = createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: history.port }),
    );
    const first = await advance.execute(owner, {
      variantId: FAILING_DRAFT,
      from: "MONITORING",
      to: "ARCHIVED",
      reason: "掲載の監視を終了するため",
    });
    if (!first.ok) throw first.error;

    const unrelated = await advance.execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "掲載の監視を終了するため",
    });

    expect(unrelated.ok).toBe(false);
    expect(history.entries()).toHaveLength(1);
    expect(history.entries()[0]?.before).toEqual({ state: "MONITORING" });
  });

  it("まだ読者に出ていない記事を没にするのは、取り下げとして記録しない", async () => {
    // ここに理由を求めると、片付ける手が止まって**片付けないほうが楽になる**。
    // 誰の目にも触れていないものを消すのは、引っ込めるのとは別のことである。
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "GENERATED" });
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(owner, { variantId: FAILING_DRAFT, from: "GENERATED", to: "ARCHIVED" });
    if (!got.ok) throw got.error;

    expect(log.actions()).toEqual(["content.state_changed"]);
    expect(log.entries()[0]?.reason).toBeNull();
  });

  it("理由の無い取り下げは断る。段階も記録も動かない", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "PUBLISHED" });
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "   ",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(got.error.field).toBe("reason");
    // 断り文に記録の語（content.unpublished）が出てこないこと。
    // 操作した人はその語を知らないので、出ても直しようがない。
    expect(got.error.message).not.toContain("content.");
    expect(log.entries()).toEqual([]);
    // **段階が動いていないこと**まで見る。記録だけ止めて段階が進むと、
    // 読者からは消えているのに、なぜ消えたかがどこにも無い状態になる。
    expect(store.states.get(FAILING_DRAFT)).toBe("PUBLISHED");
  });

  /**
   * 公開中の段階は 3 つある（PUBLISHED / MONITORING / REFRESH_DUE）。
   * 1 つだけ試すと、**残り 2 つから黙って消せる**まま気づけない。
   */
  it.each(["PUBLISHED", "MONITORING", "REFRESH_DUE"] as const)(
    "%s からの取り下げも、理由が無ければ通らない",
    async (from) => {
      const log = recordingAuditLog();
      const store = variantsRemembering({ [FAILING_DRAFT]: from });
      const got = await createAdvanceContentStateUseCase(
        deps({ variants: store.port, auditLog: log.port }),
      ).execute(owner, { variantId: FAILING_DRAFT, from, to: "ARCHIVED" });

      expect(got.ok, `${from} からの取り下げが理由なしで通っています`).toBe(false);
      expect(log.entries()).toEqual([]);
    },
  );

  it("記録できなかったときに、承認できたと返さない", async () => {
    // 記録は「人が承認した」ことの証拠そのものなので、
    // 残せなければ成功にしない。連絡（出来事）の失敗とは扱いが逆。
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(
      deps({
        variants: store.port,
        auditLog: {
          ...recordingAuditLog().port,
          append: async () => failing("記録先に繋がりません。"),
        },
      }),
    ).execute(owner, { variantId: REVIEWABLE, reason: APPROVE_REASON });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    // 押した人には「承認は済んだが記録が無い」ことがそのまま伝わること。
    // 「失敗しました」だけだと、もう一度押してよいのかが分からない。
    expect(got.error.message).toContain("承認されました");
    expect(got.error.message).toContain("記録");
    expect(got.error.suggestedAction ?? "").not.toBe("");
  });

  it("承認できなかった記事の記録は残らない", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering();
    const got = await createApproveContentUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(owner, { variantId: FAILING_DRAFT, reason: APPROVE_REASON });

    expect(got.ok).toBe(false);
    // 起きていない承認の証拠を作らない。
    expect(log.entries()).toEqual([]);
  });

  it("段階を進めると、どこからどこへ動いたかが記録される", async () => {
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "GENERATED" });
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(owner, { variantId: FAILING_DRAFT, from: "GENERATED", to: "FACT_CHECK" });
    if (!got.ok) throw got.error;

    expect(log.actions()).toEqual(["content.state_changed"]);
    const entry = log.entries()[0];
    expect(entry?.before).toEqual({ state: "GENERATED" });
    expect(entry?.after).toEqual({ state: "FACT_CHECK" });
  });

  it("AI が動かした操作は、人の操作として記録されない", async () => {
    // ここを取り違えると、AI が人の権限を借りて進めた記録が
    // 「人がやった」として読める。証拠としての意味が消える。
    const log = recordingAuditLog();
    const store = variantsRemembering({ [FAILING_DRAFT]: "GENERATED" });
    const got = await createAdvanceContentStateUseCase(
      deps({ variants: store.port, auditLog: log.port }),
    ).execute(anOwner({ workspaceId: WS, isAiServiceAccount: true }), {
      variantId: FAILING_DRAFT,
      from: "GENERATED",
      to: "FACT_CHECK",
    });
    if (!got.ok) throw got.error;

    expect(log.entries()[0]?.actor.isAiServiceAccount).toBe(true);
  });

  it("記録できなかったときに、段階を進められたと返さない", async () => {
    const store = variantsRemembering({ [FAILING_DRAFT]: "GENERATED" });
    const got = await createAdvanceContentStateUseCase(
      deps({
        variants: store.port,
        auditLog: {
          ...recordingAuditLog().port,
          append: async () => failing("記録先に繋がりません。"),
        },
      }),
    ).execute(owner, { variantId: FAILING_DRAFT, from: "GENERATED", to: "FACT_CHECK" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("事実確認中");
  });
});
