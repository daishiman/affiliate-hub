/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, decision-table
 *
 * 1 商品を、選んだブログの数だけ書き分ける (A5)。
 *
 * --- ここで守りたいこと ---
 * 1. **1 本も選ばれていないのに動かさない。** 0 本の繰り返しは黙って成功する。
 *    成功して 0 件が返ると、画面には「押したのに何も起きない」としか映らない。
 * 2. **途中で断られたら、そこで止める。** 3 本のうち 2 本目で断られたのに
 *    3 本目を作ると、誰も指示していない並び（1 本目と 3 本目）が残る。
 * 3. **書き出しがブログごとに違う。** どのブログでも同じ書き出しになると、
 *    書き分けたはずの枠が、開くまで見分けられない。
 */
import { describe, expect, it } from "vitest";
import {
  type ConceptDraftTarget,
  createCreateConceptDraftsUseCase,
} from "@/application/usecases/content/concept-drafts";
import type { EditContentDeps } from "@/application/usecases/content/edit-content";
import type { ContentVariant } from "@/domain/authoring";
import { type WorkspaceId, ok } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anOwner } from "../support/actors";
import { failing, testDeps } from "../support/doubles";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const nobody = aNobody({ workspaceId: WS });

const PACKAGE = "cp_laptop_2026";

/** 見本の保管庫は保存を断る。分かれ目の先を見たいので受け取れるようにする。 */
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

function aTarget(over: Partial<ConceptDraftTarget> = {}): ConceptDraftTarget {
  return {
    siteName: "動画編集ラボ",
    audience: "動画編集を始めて 1 年の人",
    searchIntent: "書き出しが遅い原因を知りたい",
    stance: "メモリより先に保存先を疑う",
    ...over,
  };
}

const THREE: readonly ConceptDraftTarget[] = [
  aTarget(),
  aTarget({ siteName: "在宅ワーク手帖", audience: "家で書類を作る人", stance: "買い替えは不要" }),
  aTarget({ siteName: "写真の道具箱", audience: "写真を撮る人", stance: "色の見え方で選ぶ" }),
];

describe("ブログ別に記事の枠を書き分ける", () => {
  it("その権限が無い人には断る", async () => {
    const result = await createCreateConceptDraftsUseCase(deps()).execute(nobody, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("書き分ける先が 1 本も無ければ、どの欄の話かを添えて断る", async () => {
    // ここを通してしまうと「成功したが 0 件」が返る。押した人には何も起きなく見える。
    const result = await createCreateConceptDraftsUseCase(deps()).execute(owner, {
      contentPackageId: PACKAGE,
      targets: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.field).toBe("targets");
    }
  });

  it("まとまりが引けなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      packages: testDeps({ contentPackages: { findById: async () => failing() } }).contentPackages,
    });
    const result = await createCreateConceptDraftsUseCase(broken).execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("無いまとまりを指したら、どの欄の話かを添えて断る", async () => {
    const result = await createCreateConceptDraftsUseCase(deps()).execute(owner, {
      contentPackageId: "cp_nonexistent",
      targets: THREE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.field).toBe("contentPackageId");
    }
  });

  it("読者像が 1 つも無いまとまりは、先に決めるよう促して断る", async () => {
    const base = deps();
    const empty = deps({
      packages: testDeps({
        contentPackages: {
          findById: async (ws: WorkspaceId, id: Parameters<typeof base.packages.findById>[1]) => {
            const found = await base.packages.findById(ws, id);
            if (!found.ok || found.value === null) return found;
            return ok({ ...found.value, audiencePersonaIds: [] });
          },
        },
      }).contentPackages,
    });
    const result = await createCreateConceptDraftsUseCase(empty).execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      // 「誰に向けた記事か」が決まらない、という次の一手まで伝える。
      expect(result.error.suggestedAction ?? "").not.toBe("");
    }
  });

  it("保存済みの枠を確認できなければ、新しい枠を作らずに断る", async () => {
    let saved = false;
    const unreadable = deps({
      variants: testDeps({
        contentVariants: {
          listByPackage: async () => failing("保存済みの記事を読み出せませんでした。"),
          save: async (variant: ContentVariant) => {
            saved = true;
            return ok(variant);
          },
        },
      }).contentVariants,
    });
    const result = await createCreateConceptDraftsUseCase(unreadable).execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(result.ok).toBe(false);
    expect(saved).toBe(false);
  });

  it("選んだ数だけ枠ができ、どのブログのものかが並びで分かる", async () => {
    const result = await createCreateConceptDraftsUseCase(deps()).execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.map((c) => c.siteName)).toEqual([
      "動画編集ラボ",
      "在宅ワーク手帖",
      "写真の道具箱",
    ]);
    // 枠は別々のものとして作られる。同じ id が並ぶなら 1 本を作り直している。
    expect(new Set(result.value.created.map((c) => c.variantId)).size).toBe(3);
  });

  it("ブログごとに書き出しが違う（3 軸がそのまま文になる）", async () => {
    const saved: ContentVariant[] = [];
    const recording = deps({
      variants: testDeps({
        contentVariants: {
          save: async (v: ContentVariant) => {
            saved.push(v);
            return ok(v);
          },
        },
      }).contentVariants,
    });
    const result = await createCreateConceptDraftsUseCase(recording).execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(3);
    expect(new Set(saved.map((v) => v.body)).size).toBe(3);
    // 切り口を人に入力させない代わりに、切り口が本文から読み返せる。
    expect(saved[0]?.body).toContain("動画編集を始めて 1 年の人");
    expect(saved[0]?.body).toContain("メモリより先に保存先を疑う");
    // 題にはブログ名と結論が入る。一覧で並んだときに見分けが付く。
    expect(saved[1]?.title).toContain("在宅ワーク手帖");
  });

  it("途中で断られたら、そこで止めて残りを作らない", async () => {
    let calls = 0;
    const stopsOnSecond = deps({
      variants: testDeps({
        contentVariants: {
          save: async (v: ContentVariant) => {
            calls += 1;
            return calls === 2 ? failing() : ok(v);
          },
        },
      }).contentVariants,
    });
    const result = await createCreateConceptDraftsUseCase(stopsOnSecond).execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(result.ok).toBe(false);
    // 3 本目に手を付けていない。付けていれば「1 本目と 3 本目がある」状態が残る。
    expect(calls).toBe(2);
  });

  it("途中まで保存された同じ要求を再試行すると、既存の枠を再利用して不足分だけを作る", async () => {
    const stored: ContentVariant[] = [];
    let saveAttempts = 0;
    let refuseSecondSave = true;
    const persistent = deps({
      variants: testDeps({
        contentVariants: {
          listByPackage: async (_workspaceId, contentPackageId) =>
            ok(stored.filter((variant) => variant.contentPackageId === contentPackageId)),
          save: async (variant: ContentVariant) => {
            saveAttempts += 1;
            if (refuseSecondSave && saveAttempts === 2) {
              refuseSecondSave = false;
              return failing("2 本目の保存だけ失敗しました。");
            }
            stored.push(variant);
            return ok(variant);
          },
        },
      }).contentVariants,
    });
    const useCase = createCreateConceptDraftsUseCase(persistent);

    // 同じ 3 本の要求で、1 本目だけを保存したあと2 本目に失敗する部分成功を作る。
    const partial = await useCase.execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });
    expect(partial.ok).toBe(false);
    expect(stored).toHaveLength(1);
    const firstVariantId = String(stored[0]!.id);

    // 利用者は元の 3 本の要求をそのまま押し直す。
    const retried = await useCase.execute(owner, {
      contentPackageId: PACKAGE,
      targets: THREE,
    });

    expect(retried.ok).toBe(true);
    if (!retried.ok) return;
    expect(stored).toHaveLength(3);
    expect(new Set(stored.map((variant) => String(variant.id))).size).toBe(3);
    expect(retried.value.created.map((draft) => draft.variantId)).toEqual(
      stored.map((variant) => String(variant.id)),
    );
    expect(retried.value.created[0]?.variantId).toBe(firstVariantId);
  });

  it("対応は4軸の安定IDで決め、編集後のタイトルや同名の別記事に左右されない", async () => {
    const stored: ContentVariant[] = [];
    const persistent = deps({
      variants: testDeps({
        contentVariants: {
          listByPackage: async (_workspaceId, contentPackageId) =>
            ok(stored.filter((variant) => variant.contentPackageId === contentPackageId)),
          save: async (variant: ContentVariant) => {
            stored.push(variant);
            return ok(variant);
          },
        },
      }).contentVariants,
    });
    const useCase = createCreateConceptDraftsUseCase(persistent);
    const original = aTarget();

    const first = await useCase.execute(owner, {
      contentPackageId: PACKAGE,
      targets: [original],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const stableId = first.value.created[0]!.variantId;

    // 人が題名と本文を編集しても、同じ4軸の要求は保存済みの同じ記事を指す。
    stored[0] = { ...stored[0]!, title: "編集後の題名", body: "人が編集した本文" };
    const sameTarget = await useCase.execute(owner, {
      contentPackageId: PACKAGE,
      targets: [original],
    });
    expect(sameTarget.ok).toBe(true);
    if (!sameTarget.ok) return;
    expect(sameTarget.value.created[0]?.variantId).toBe(stableId);
    expect(stored).toHaveLength(1);

    // サイト名と結論が同じなら題名は同じになるが、読者・検索意図が違えば別記事である。
    const sameTitleDifferentAxes = aTarget({
      audience: "動画編集を今日始めた人",
      searchIntent: "最初に揃える道具を知りたい",
    });
    const another = await useCase.execute(owner, {
      contentPackageId: PACKAGE,
      targets: [sameTitleDifferentAxes],
    });
    expect(another.ok).toBe(true);
    if (!another.ok) return;
    expect(another.value.created[0]?.variantId).not.toBe(stableId);
    expect(stored).toHaveLength(2);
  });

  it("同じ書き分け先が要求内で重なっても、保存も結果も1本にまとめる", async () => {
    const stored: ContentVariant[] = [];
    const persistent = deps({
      variants: testDeps({
        contentVariants: {
          listByPackage: async () => ok(stored),
          save: async (variant: ContentVariant) => {
            stored.push(variant);
            return ok(variant);
          },
        },
      }).contentVariants,
    });
    const result = await createCreateConceptDraftsUseCase(persistent).execute(owner, {
      contentPackageId: PACKAGE,
      targets: [aTarget(), aTarget()],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(stored).toHaveLength(1);
    expect(result.value.created).toHaveLength(1);
    expect(result.value.created[0]?.variantId).toBe(String(stored[0]?.id));
  });
});
