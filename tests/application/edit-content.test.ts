/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, decision-table
 *
 * 記事 1 本を、人の手で作る・直す・消す。
 *
 * --- ここで守りたいこと ---
 * 1. **無いまとまりに属する記事を作らせない。** 作れてしまうと、
 *    盤面のどの列にも出てこない記事が生まれる。
 * 2. **公開中の本文はこの口では触らせない。** 読者が読んだ文章と
 *    今ある文章が黙って別物になる。
 * 3. **承認済みの文章を直したら承認は外れる。** 人が良いと言ったのは
 *    そのときの文章であって、差し替えた後の文章ではない。
 * 4. **本文は空にできない。** 消したいなら消す操作を使う。
 */
import { describe, expect, it } from "vitest";
import {
  type EditContentDeps,
  createCreateContentVariantUseCase,
  createDeleteContentVariantUseCase,
  createUpdateContentVariantUseCase,
} from "@/application/usecases/content/edit-content";
import type { ContentVariant } from "@/domain/authoring";
import {
  type BrandId,
  type ContentVariantId,
  type WorkspaceId,
  ok,
  taggedString,
} from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anOwner } from "../support/actors";
import { failing, testDeps } from "../support/doubles";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const outsideBrandOwner = anOwner({
  workspaceId: WS,
  scopedBrandIds: [taggedString<"BrandId">("brand-outside") as BrandId],
});
const nobody = aNobody({ workspaceId: WS });

const PACKAGE = "cp_laptop_2026";
/** 下書き。直すのも消すのも通る側。 */
const DRAFT = "cv_alpha_draft";
/** 承認済み。直すと承認が外れる側。 */
const APPROVED = "cv_alpha_approved";

/** 見本の保管庫は保存も削除も断る。分かれ目の先を見たいので受け取れるようにする。 */
function deps(over: Partial<EditContentDeps> = {}): EditContentDeps {
  const base = testDeps({
      contentVariants: {
      save: async (v: ContentVariant) => ok(v),
      remove: async () => ok(true as const),
    },
  });
  return {
    variants: base.contentVariants,
    packages: base.contentPackages,
    auditLog: base.auditLog,
    ids: base.ids,
    ...over,
  };
}

/** 見本には公開済みが 1 本も無い。公開中の断りを見るためだけに 1 本作る。 */
function withPublished(base: EditContentDeps, id: string): EditContentDeps {
  return {
    ...base,
    variants: testDeps({
      contentVariants: {
        findById: async (ws: WorkspaceId, wanted: ContentVariantId) => {
          const found = await base.variants.findById(ws, wanted);
          if (!found.ok || found.value === null) return found;
          if (String(wanted) !== id) return found;
          return ok({ ...found.value, status: "published" as const });
        },
      },
    }).contentVariants,
  };
}

async function sampleBody(): Promise<string> {
  const found = await testDeps().contentVariants.findById(WS, DRAFT as ContentVariantId);
  if (!found.ok || found.value === null) throw new Error("見本の記事が引けません。");
  return found.value.body;
}

async function aCreateInput(over: Record<string, unknown> = {}) {
  return {
    contentPackageId: PACKAGE,
    channel: "own_site",
    format: "article",
    authorPersonaId: "ap_editor",
    audiencePersonaId: "dp_video_intermediate",
    angle: "data_first",
    cta: "read_detail",
    disclosure: "広告を含みます",
    title: "新しい記事",
    body: await sampleBody(),
    summary: "書き出しの実測をもとに比べます。",
    ...over,
  } as Parameters<ReturnType<typeof createCreateContentVariantUseCase>["execute"]>[1];
}

describe("記事の枠を作る", () => {
  it("担当外ブランドの企画には記事の枠を作れない", async () => {
    const result = await createCreateContentVariantUseCase(deps()).execute(
      outsideBrandOwner,
      await aCreateInput(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
  });

  it("その権限が無い人には断る", async () => {
    const result = await createCreateContentVariantUseCase(deps()).execute(
      nobody,
      await aCreateInput(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("まとまりが引けなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      packages: testDeps({ contentPackages: { findById: async () => failing() } }).contentPackages,
    });
    const result = await createCreateContentVariantUseCase(broken).execute(
      owner,
      await aCreateInput(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("無いまとまりを指したら、どの欄の話かを添えて断る", async () => {
    const result = await createCreateContentVariantUseCase(deps()).execute(
      owner,
      await aCreateInput({ contentPackageId: "cp_nonexistent" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.field).toBe("contentPackageId");
    }
  });

  it("業務側の決まりに合わない中身は、組み立てで断られる", async () => {
    const result = await createCreateContentVariantUseCase(deps()).execute(
      owner,
      await aCreateInput({ body: "" }),
    );
    expect(result.ok).toBe(false);
  });

  it("題を省いても作れる（題は後から付けられる）", async () => {
    const input = await aCreateInput();
    const { title: _dropped, ...withoutTitle } = input as Record<string, unknown>;
    const result = await createCreateContentVariantUseCase(deps()).execute(
      owner,
      withoutTitle as typeof input,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBeNull();
  });

  it("保管庫が受け取れなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      variants: testDeps({ contentVariants: { save: async () => failing<ContentVariant>() } })
        .contentVariants,
    });
    const result = await createCreateContentVariantUseCase(broken).execute(
      owner,
      await aCreateInput(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記録が書けないときは「枠は作りました」と添えて断る", async () => {
    const noLog = deps({
      auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog,
    });
    const result = await createCreateContentVariantUseCase(noLog).execute(
      owner,
      await aCreateInput(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("記事の枠は作りました");
  });
});

describe("記事を直す", () => {
  it("担当外ブランドの記事はIDを知っていても直せない", async () => {
    const result = await createUpdateContentVariantUseCase(deps()).execute(outsideBrandOwner, {
      variantId: DRAFT,
      title: "担当外からの変更",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
  });

  it("その権限が無い人には断る", async () => {
    const result = await createUpdateContentVariantUseCase(deps()).execute(nobody, {
      variantId: DRAFT,
      title: "別の題",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("無い記事は、一覧から選び直すよう添えて断る", async () => {
    const result = await createUpdateContentVariantUseCase(deps()).execute(owner, {
      variantId: "cv_nonexistent",
      title: "別の題",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("記事を引けなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      variants: testDeps({ contentVariants: { findById: async () => failing<ContentVariant | null>() } })
        .contentVariants,
    });
    const result = await createUpdateContentVariantUseCase(broken).execute(owner, {
      variantId: DRAFT,
      title: "別の題",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("公開中の記事は、取り下げか訂正へ案内して断る", async () => {
    const result = await createUpdateContentVariantUseCase(
      withPublished(deps(), DRAFT),
    ).execute(owner, { variantId: DRAFT, title: "別の題" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.details).toMatchObject({ status: "published" });
    }
  });

  it("本文を空白だけにはできない", async () => {
    const result = await createUpdateContentVariantUseCase(deps()).execute(owner, {
      variantId: DRAFT,
      body: "   ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("body");
  });

  it("触らなかった欄は元のまま残る", async () => {
    const saved: ContentVariant[] = [];
    const capture = deps({
      variants: testDeps({
      contentVariants: {
          save: async (v: ContentVariant) => {
            saved.push(v);
            return ok(v);
          },
        },
      }).contentVariants,
    });
    const found = await testDeps().contentVariants.findById(WS, DRAFT as ContentVariantId);
    const before = found.ok ? found.value : null;

    const result = await createUpdateContentVariantUseCase(capture).execute(owner, {
      variantId: DRAFT,
      title: "新しい題",
    });
    expect(result.ok).toBe(true);
    expect(saved[0]?.body).toBe(before?.body);
    expect(saved[0]?.summary).toBe(before?.summary);
    expect(saved[0]?.title).toBe("新しい題");
  });

  it("承認済みを直すと、承認が外れたことを知らせる", async () => {
    const result = await createUpdateContentVariantUseCase(deps()).execute(owner, {
      variantId: APPROVED,
      summary: "書き直した要約",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approvalCleared).toBe(true);
      expect(result.value.status).toBe("generated");
    }
  });

  it("承認前の記事を直しても、外れる承認は無い", async () => {
    const result = await createUpdateContentVariantUseCase(deps()).execute(owner, {
      variantId: DRAFT,
      summary: "書き直した要約",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.approvalCleared).toBe(false);
  });

  it("保管庫が受け取れなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      variants: testDeps({ contentVariants: { save: async () => failing<ContentVariant>() } })
        .contentVariants,
    });
    const result = await createUpdateContentVariantUseCase(broken).execute(owner, {
      variantId: DRAFT,
      title: "別の題",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記録が書けないときは「保存はした」と添えて断る", async () => {
    const noLog = deps({
      auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog,
    });
    const result = await createUpdateContentVariantUseCase(noLog).execute(owner, {
      variantId: DRAFT,
      title: "別の題",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("記事は保存しました");
  });
});

describe("記事を消す", () => {
  it("担当外ブランドの記事はIDを知っていても消せない", async () => {
    const result = await createDeleteContentVariantUseCase(deps()).execute(outsideBrandOwner, {
      variantId: DRAFT,
      reason: "担当外からの削除",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
  });

  it("その権限が無い人には断る", async () => {
    const result = await createDeleteContentVariantUseCase(deps()).execute(nobody, {
      variantId: DRAFT,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("理由が空欄なら、権限があっても消させない", async () => {
    const result = await createDeleteContentVariantUseCase(deps()).execute(owner, {
      variantId: DRAFT,
      reason: "  ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("reason");
  });

  it("無い記事は断る", async () => {
    const result = await createDeleteContentVariantUseCase(deps()).execute(owner, {
      variantId: "cv_nonexistent",
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("公開中の記事は消させない", async () => {
    const result = await createDeleteContentVariantUseCase(
      withPublished(deps(), DRAFT),
    ).execute(owner, { variantId: DRAFT, reason: "重複" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });

  it("下書きは消せる", async () => {
    const result = await createDeleteContentVariantUseCase(deps()).execute(owner, {
      variantId: DRAFT,
      reason: "同じ内容を別の枠で作り直したため",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.variantId).toBe(DRAFT);
  });

  it("保管庫が消せなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      variants: testDeps({ contentVariants: { remove: async () => failing<true>() } }).contentVariants,
    });
    const result = await createDeleteContentVariantUseCase(broken).execute(owner, {
      variantId: DRAFT,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記録が書けないときは「消しました」と添えて断る", async () => {
    const noLog = deps({
      auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog,
    });
    const result = await createDeleteContentVariantUseCase(noLog).execute(owner, {
      variantId: DRAFT,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("記事は消しました");
  });
});
