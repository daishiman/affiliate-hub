/**
 * @tier 1
 * @req REQ-UX03
 * @types equivalence, decision-table, audit-log
 *
 * ブログの設計図を直す・取り下げる (A2 基本管理機能)。
 *
 * --- ここで守りたいこと ---
 * 1. **他社のブログは「無い」と同じ応答にする。** 断り方が違うと、
 *    その URL 名が実在することだけが外から分かってしまう。
 * 2. **何も変えずに保存しても断らない。** よくある操作を断ると、
 *    「押したのに何も起きない」より分かりにくい状態になる。
 * 3. **記事が残っているブログは取り下げない。** 先に消すと、記事の側から
 *    自分がどこに載っていたか辿れなくなり、訂正も取り下げもできない孤児が残る。
 * 4. **記録に書けなかったことを、成功として黙らせない。**
 */
import { describe, expect, it } from "vitest";
import type { ArticleSummary } from "@/application/read-models/published-article";
import {
  type EditSitesDeps,
  createDeleteManagedSiteUseCase,
  createUpdateManagedSiteUseCase,
} from "@/application/usecases/site/edit-sites";
import type { SiteBlueprint } from "@/domain/authoring";
import { type WorkspaceId, markCommercial, ok } from "@/domain/shared";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anOwner } from "../support/actors";
import { failing, testDeps } from "../support/doubles";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const nobody = aNobody({ workspaceId: WS });
/** 権限はあるが、別の会社にいる人。テナント境界はこの人でしか確かめられない。 */
const outsider = anOwner({ workspaceId: "ws-someone-else" as WorkspaceId });

type Saved = { blueprints: SiteBlueprint[] };

/**
 * 見本の保管庫は登録も取り下げも断るので、既定で受け取れるようにしておく。
 * 分かれ目の先（何が変わったか・記録に何を残したか）を見たいため。
 */
function deps(over: Partial<EditSitesDeps> = {}, saved?: Saved): EditSitesDeps {
  const base = testDeps({
    siteDrafts: {
      publishBlueprint: async (_slug: string, blueprint: SiteBlueprint) => {
        saved?.blueprints.push(blueprint);
        return ok(blueprint);
      },
      removeBlueprint: async () => ok(true as const),
    },
    publishedContent: {
      listRecent: async () => ok([] as readonly ArticleSummary[]),
    },
  });
  return {
    sites: base.sites,
    drafts: base.siteDrafts,
    publishedContent: base.publishedContent,
    auditLog: base.auditLog,
    ids: base.ids,
    ...over,
  };
}

const anArticle = { slug: "a", title: "残っている記事" } as unknown as ArticleSummary;

describe("ブログの設定を直す", () => {
  it("その権限が無い人には断る", async () => {
    const result = await createUpdateManagedSiteUseCase(deps()).execute(nobody, {
      siteSlug: SAMPLE_SITE_SLUG,
      name: "新しい名前",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("他社のブログは、無いブログと同じ断り方にする", async () => {
    const others = await createUpdateManagedSiteUseCase(deps()).execute(outsider, {
      siteSlug: SAMPLE_SITE_SLUG,
      name: "乗っ取り",
    });
    const missing = await createUpdateManagedSiteUseCase(deps()).execute(owner, {
      siteSlug: "no-such-site",
      name: "x",
    });

    expect(others.ok).toBe(false);
    expect(missing.ok).toBe(false);
    if (others.ok || missing.ok) return;
    // 断り方が 1 文字でも違うと、その URL 名が実在することだけが分かってしまう。
    expect(others.error.code).toBe(missing.error.code);
    expect(others.error.message).toBe(missing.error.message);
    expect(others.error.code).toBe("NOT_FOUND");
  });

  it("ブログを引けなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      sites: testDeps({ sites: { findBySlug: async () => failing() } }).sites,
    });
    const result = await createUpdateManagedSiteUseCase(broken).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      name: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("何も変えずに保存しても断らない。変わっていないことを返す", async () => {
    const result = await createUpdateManagedSiteUseCase(deps()).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changedLabels).toEqual([]);
    expect(result.value.siteSlug).toBe(SAMPLE_SITE_SLUG);
  });

  it("変えた項目だけが、画面に出せる表示名で返る", async () => {
    const saved: Saved = { blueprints: [] };
    const result = await createUpdateManagedSiteUseCase(deps({}, saved)).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      name: "動画編集の道具箱",
      emitLlmsTxt: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changedLabels).toContain("ブログ名");
    // 触っていない項目が並ぶと、「何を直したか」の記録が読めなくなる。
    expect(result.value.changedLabels).not.toContain("扱う分野");
    expect(saved.blueprints[0]?.name).toBe("動画編集の道具箱");
  });

  it("差別化の軸は、渡した軸だけが差し替わる", async () => {
    const saved: Saved = { blueprints: [] };
    const result = await createUpdateManagedSiteUseCase(deps({}, saved)).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      differentiation: { targetReader: "動画編集を始めて 1 年の人" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changedLabels).toEqual(["読者"]);
    const after = saved.blueprints[0]!.differentiation;
    expect(after.targetReader).toBe("動画編集を始めて 1 年の人");
    // 渡していない軸が空になると、10 軸のうち 9 軸が黙って消える。
    expect(after.searchIntent).not.toBe("");
    expect(after.ctaStrategy).not.toBe("");
  });

  it("登録に失敗したら、その断りをそのまま返す", async () => {
    const broken = deps({
      drafts: testDeps({ siteDrafts: { publishBlueprint: async () => failing() } }).siteDrafts,
    });
    const result = await createUpdateManagedSiteUseCase(broken).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      name: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記録に書けなかったら、保存したことを伝えたうえで断る", async () => {
    const broken = deps({
      auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog,
    });
    const result = await createUpdateManagedSiteUseCase(broken).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      name: "x",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 「失敗しました」だけだと、もう一度押して二重に直そうとする。
      expect(result.error.message).toContain("ブログの設定は保存しました");
    }
  });
});

describe("ブログを取り下げる", () => {
  const REASON = "運用をやめるため";

  it("その権限が無い人には断る", async () => {
    const result = await createDeleteManagedSiteUseCase(deps()).execute(nobody, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: REASON,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("理由が空白なら、どの欄の話かを添えて断る", async () => {
    const result = await createDeleteManagedSiteUseCase(deps()).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: "   ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.field).toBe("reason");
      // 消したものは戻せない、と次の一手まで伝える。
      expect(result.error.suggestedAction ?? "").not.toBe("");
    }
  });

  it("他社のブログは、無いブログと同じ断り方にする", async () => {
    const result = await createDeleteManagedSiteUseCase(deps()).execute(outsider, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: REASON,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("記事が残っていれば、何本残っているかを添えて断る", async () => {
    const remaining = deps({
      publishedContent: testDeps({
        publishedContent: { listRecent: async () => ok([anArticle, anArticle]) },
      }).publishedContent,
    });
    const result = await createDeleteManagedSiteUseCase(remaining).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: REASON,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      // 「何かが残っている」だけでは、何本片付ければよいのかが分からない。
      expect(result.error.message).toContain("2");
      expect(result.error.details).toEqual({ remainingArticles: 2 });
    }
  });

  it("残っている記事を数えられなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      publishedContent: testDeps({ publishedContent: { listRecent: async () => failing() } })
        .publishedContent,
    });
    const result = await createDeleteManagedSiteUseCase(broken).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: REASON,
    });
    expect(result.ok).toBe(false);
    // 数えられないまま「0 本だった」とみなして消すと、孤児が出る。
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("取り下げに失敗したら、その断りをそのまま返す", async () => {
    const broken = deps({
      drafts: testDeps({ siteDrafts: { removeBlueprint: async () => failing() } }).siteDrafts,
    });
    const result = await createDeleteManagedSiteUseCase(broken).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: REASON,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記事が残っていなければ取り下げ、消したブログの名前を返す", async () => {
    const result = await createDeleteManagedSiteUseCase(deps()).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: REASON,
    });

    expect(result.ok).toBe(true);
    // 一覧から消えたあと、何を消したのかを画面に出せる。ID だけでは伝わらない。
    if (result.ok) expect(result.value.name).not.toBe("");
  });

  it("記録に書けなかったら、取り下げたことを伝えたうえで断る", async () => {
    const broken = deps({
      auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog,
    });
    const result = await createDeleteManagedSiteUseCase(broken).execute(owner, {
      siteSlug: SAMPLE_SITE_SLUG,
      reason: REASON,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("ブログは取り下げました");
  });
});

describe("ブログの編集に報酬のデータを混ぜない", () => {
  it("商業のポートが渡されたら、組み立ての時点で止まる", () => {
    const mixed = { ...deps(), affiliate: markCommercial({}) } as unknown as EditSitesDeps;

    // 実行時ではなく組み立て時に落とす。実行時だと、混ざったまま動く経路が残る。
    expect(() => createUpdateManagedSiteUseCase(mixed)).toThrow(/商業データ/);
    expect(() => createDeleteManagedSiteUseCase(mixed)).toThrow(/商業データ/);
  });
});
