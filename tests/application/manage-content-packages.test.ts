/**
 * @tier 1
 * @req REQ-P05, REQ-A03
 * @types equivalence, boundary
 *
 * 企画の一覧と登録。
 *
 * ここで固定したいのは 3 つ。
 *   1. 一覧が **ID ではなく名前**を返すこと（画面で引き直させない）
 *   2. 引けなかった ID を黙って捨てず、**見つからないと分かる言葉**にすること
 *   3. 登録が主張と根拠を受け取らず、`researching` から始まること
 *
 * 3 は「必須にしない」という判断そのものの検査である。必須にすると
 * 「とりあえず何か入れる」が起き、空でない嘘の根拠が付いた企画が
 * 生成の検査を通り抜ける。
 */
import { describe, expect, it } from "vitest";
import type {
  EditorialContentPackageRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "@/application/ports/authoring";
import type { BrandScopeFilter } from "@/application/ports/common";
import type { BrandRepositoryPort } from "@/application/ports/identity";
import type { EditorialProductRepositoryPort } from "@/application/ports/product";
import {
  type RecordedContentPackagesDeps,
  createListContentPackagesUseCase,
  createSaveContentPackageUseCase,
} from "@/application/usecases/authoring/manage-content-packages";
import type { ContentPackage } from "@/domain/authoring";
import { markEditorial, ok, taggedString } from "@/domain/shared";
import type { AudiencePersonaId, AuthorPersonaId } from "@/domain/shared";
import { SAMPLE_CONTENT_PACKAGES } from "@/infrastructure/persistence/sample/content-editorial-sample-repository";
import { createUnavailableAuditLog } from "@/infrastructure/persistence/sample/audit-log-sample-repository";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anOwner } from "../support/actors";
import { recordingAuditLog } from "../support/doubles";

// この単体検査の既定actorと同じworkspaceへ置く。sample保存先のworkspaceを
// そのまま借りると、所有境界を追加した瞬間に正常系まで他tenantになる。
const SAMPLE = {
  ...SAMPLE_CONTENT_PACKAGES[0],
  workspaceId: WORKSPACE,
} as ContentPackage;

/** 決めた企画だけを返し、保存されたものを覚えておく保存先。 */
function packagesPort(items: readonly ContentPackage[] = [SAMPLE]) {
  const saved: ContentPackage[] = [];
  const port = markEditorial({
    findById: async () => ok(items[0] ?? null),
    list: async (_workspaceId: unknown, page: { limit: number }, scope?: BrandScopeFilter) => {
      const candidates =
        scope === undefined
          ? items
          : items.filter((pkg) =>
              scope.brandIds.some((brandId) => String(brandId) === pkg.brandId),
            );
      const visible = candidates.slice(0, page.limit);
      return ok({
        items: visible,
        total: candidates.length,
        nextCursor:
          visible.length > 0 && visible.length < candidates.length
            ? String(visible.at(-1)?.id)
            : null,
      });
    },
    save: async (pkg: ContentPackage) => {
      saved.push(pkg);
      return ok(pkg);
    },
  }) as unknown as EditorialContentPackageRepositoryPort;
  return { port, saved };
}

/** 名前を引くためだけの書き手・読者像。引けない場合を作れるように差し替えられる。 */
function personasPort(
  authors: readonly { id: string; displayName: string; workspaceId?: string }[],
  audiences: readonly { id: string; name: string; workspaceId?: string }[],
) {
  const page = <T>(items: readonly T[]) => ok({ items, total: items.length, nextCursor: null });
  return markEditorial({
    listAuthors: async () => page(authors),
    listAudiences: async () => page(audiences),
    findAuthor: async (_workspaceId: unknown, id: unknown) => {
      const found = authors.find((author) => author.id === String(id));
      return ok(found === undefined ? null : { ...found, workspaceId: found.workspaceId ?? WORKSPACE });
    },
    findAudience: async (_workspaceId: unknown, id: unknown) => {
      const found = audiences.find((audience) => audience.id === String(id));
      return ok(found === undefined ? null : { ...found, workspaceId: found.workspaceId ?? WORKSPACE });
    },
    saveAuthor: async () => ok(null),
    saveAudience: async () => ok(null),
  }) as unknown as EditorialPersonaRepositoryPort;
}

function brandPort(workspaceId: string | null = WORKSPACE): BrandRepositoryPort {
  return {
    findById: async (_workspaceId, id) =>
      ok(workspaceId === null ? null : ({ id, workspaceId } as never)),
    list: async () => ok({ items: [], nextCursor: null }),
    save: async (brand) => ok(brand),
  };
}

function productPort(workspaceId: string | null = WORKSPACE): EditorialProductRepositoryPort {
  return markEditorial({
    findById: async (_workspaceId: unknown, id: unknown) =>
      ok(workspaceId === null ? null : ({ id, workspaceId } as never)),
    findByIdentityKey: async () => ok(null),
    search: async () => ok({ items: [], nextCursor: null }),
    save: async (product: unknown) => ok(product),
    remove: async () => ok(true),
  }) as unknown as EditorialProductRepositoryPort;
}

function deps(over: Partial<RecordedContentPackagesDeps> = {}): RecordedContentPackagesDeps {
  return {
    packages: packagesPort().port,
    auditLog: recordingAuditLog().port,
    now: () => new Date("2026-08-27T00:00:00.000Z"),
    personas: personasPort(
      [{ id: String(SAMPLE.authorPersonaId), displayName: "編集部の田中" }],
      SAMPLE.audiencePersonaIds.map((id, i) => ({ id: String(id), name: `読者像 ${i + 1}` })),
    ),
    brands: brandPort(),
    products: productPort(),
    ids: { newId: () => "generated" },
    ...over,
  };
}

describe("企画の一覧", () => {
  it("ID ではなく、人が読める名前で返す", async () => {
    const result = await createListContentPackagesUseCase(deps()).execute(anOwner(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.value.items[0];
    // ID をそのまま出すと、選ぶ画面としては使えない。
    expect(row.authorName).toBe("編集部の田中");
    expect(row.audienceNames.every((n) => !n.startsWith("dp_"))).toBe(true);
    expect(row.statusLabel).not.toBe(SAMPLE.status);
    expect(row.angleLabels.length).toBe(SAMPLE.contentAngles.length);
  });

  it("引けなかった書き手は、見つからないと分かる言葉で出す", async () => {
    const result = await createListContentPackagesUseCase(
      deps({ personas: personasPort([], []) }),
    ).execute(anOwner(), {});
    if (!result.ok) throw new Error("一覧を出せていません");

    // 空文字にすると列が消えて「書き手を決めていない企画」に見える。
    // ID を出すと読む人に何も伝わらない。消されたと分かる言い方にする。
    expect(result.value.items[0].authorName).toBe("（見つからない書き手）");
    expect(result.value.items[0].audienceNames[0]).toBe("（見つからない読者像）");
  });

  it("主張と根拠が空の企画には、書き始められない理由が付く", async () => {
    const result = await createListContentPackagesUseCase(
      deps({ packages: packagesPort([{ ...SAMPLE, claimIds: [], evidenceIds: [] }]).port }),
    ).execute(anOwner(), {});
    if (!result.ok) throw new Error("一覧を出せていません");

    // 生成の直前まで行って初めて断られると、書き始めてから引き返すことになる。
    expect(result.value.items[0].missing).toContain("承認済みの主張");
    expect(result.value.items[0].missing).toContain("根拠");
  });

  it("0 件のときは、無言の空表にせず理由を返す", async () => {
    const result = await createListContentPackagesUseCase(
      deps({ packages: packagesPort([]).port }),
    ).execute(anOwner(), {});
    if (!result.ok) throw new Error("一覧を出せていません");

    expect(result.value.items).toEqual([]);
    expect(result.value.emptyReason).not.toBeNull();
  });

  it("権限の無い人には断る", async () => {
    const result = await createListContentPackagesUseCase(deps()).execute(aNobody(), {});
    expect(result.ok).toBe(false);
  });

  it("限定担当者の一覧には、担当外ブランドの企画を出さない", async () => {
    const outside = {
      ...SAMPLE,
      id: taggedString<"ContentPackageId">("pkg-outside"),
      brandId: "brand-outside",
    } as ContentPackage;
    const actor = {
      ...anOwner(),
      scopedBrandIds: [taggedString<"BrandId">(SAMPLE.brandId)],
    };

    const result = await createListContentPackagesUseCase(
      deps({ packages: packagesPort([SAMPLE, outside]).port }),
    ).execute(actor, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items.map((item) => item.packageId)).toEqual([String(SAMPLE.id)]);
  });

  it("担当外の100件が先にあっても、limit前のbrand絞り込みで後続の担当企画を返す", async () => {
    const outside = Array.from({ length: 100 }, (_, index) => ({
      ...SAMPLE,
      id: taggedString<"ContentPackageId">(`pkg-outside-${index}`),
      brandId: "brand-outside",
    })) as readonly ContentPackage[];
    const actor = {
      ...anOwner(),
      scopedBrandIds: [taggedString<"BrandId">(SAMPLE.brandId)],
    };

    const result = await createListContentPackagesUseCase(
      deps({ packages: packagesPort([...outside, SAMPLE]).port }),
    ).execute(actor, {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.packageId)).toEqual([String(SAMPLE.id)]);
  });
});

describe("企画の登録", () => {
  const input = {
    brandId: "brand_main",
    primarySubjectId: String(SAMPLE.primarySubjectId),
    domainScope: "general" as const,
    authorPersonaId: String(SAMPLE.authorPersonaId),
    audiencePersonaIds: SAMPLE.audiencePersonaIds.map(String),
    objective: "  動画編集を始めた人が書き出しの速さで選べるようにする  ",
    funnelStage: "consideration" as const,
    contentAngles: ["conclusion_first", "comparison_first"] as const,
  };

  it("主張と根拠を受け取らず、調べている状態から始める", async () => {
    const { port, saved } = packagesPort();
    const result = await createSaveContentPackageUseCase(deps({ packages: port })).execute(
      anOwner(),
      input,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 立てた時点で調べ終わっているほうが珍しい。必須にすると
    // 「とりあえず何か入れる」が起き、嘘の根拠が生成の検査を通る。
    expect(saved[0].claimIds).toEqual([]);
    expect(saved[0].evidenceIds).toEqual([]);
    expect(saved[0].status).toBe("researching");
  });

  it("前後の空白を落として保存する", async () => {
    const { port, saved } = packagesPort();
    await createSaveContentPackageUseCase(deps({ packages: port })).execute(anOwner(), input);

    // 落とさないと、一覧の見出しが 1 件だけ字下がりして並ぶ。
    expect(saved[0].objective).toBe("動画編集を始めた人が書き出しの速さで選べるようにする");
  });

  it("読者像を複数選んだ分だけ保存する", async () => {
    const { port, saved } = packagesPort();
    await createSaveContentPackageUseCase(deps({ packages: port })).execute(anOwner(), input);

    // 1 件へ畳むと、同じ企画から読者ごとに書き分けられなくなる。
    expect(saved[0].audiencePersonaIds.map(String)).toEqual(input.audiencePersonaIds);
  });

  it("ID の作り方が無い組み方では、断って理由を返す", async () => {
    const result = await createSaveContentPackageUseCase(deps({ ids: undefined })).execute(
      anOwner(),
      input,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("NOT_IMPLEMENTED");
    expect(result.error.suggestedAction ?? "").not.toBe("");
  });

  it("切り口を 1 つも選ばない企画は立てられない", async () => {
    const result = await createSaveContentPackageUseCase(deps()).execute(anOwner(), {
      ...input,
      contentAngles: [],
    });
    // 断るのは domain（`createContentPackage`）。画面へ写さない。
    expect(result.ok).toBe(false);
  });

  it("権限の無い人には断る", async () => {
    const result = await createSaveContentPackageUseCase(deps()).execute(aNobody(), input);
    expect(result.ok).toBe(false);
  });

  it("担当外ブランドの番号を知っていても企画へ結び付けず、保存しない", async () => {
    const { port, saved } = packagesPort();
    const scopedOwner = {
      ...anOwner(),
      scopedBrandIds: [taggedString<"BrandId">("brand-allowed")],
    };

    const result = await createSaveContentPackageUseCase(deps({ packages: port })).execute(
      scopedOwner,
      input,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
    expect(saved).toHaveLength(0);
  });

  it("担当ブランドなら、同じ限定担当でも企画へ結び付けられる", async () => {
    const { port, saved } = packagesPort();
    const scopedOwner = {
      ...anOwner(),
      scopedBrandIds: [taggedString<"BrandId">(input.brandId)],
    };

    const result = await createSaveContentPackageUseCase(deps({ packages: port })).execute(
      scopedOwner,
      input,
    );

    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it.each([
    ["存在しないブランド", { brands: brandPort(null) }],
    ["別の作業場所のブランド", { brands: brandPort(OTHER_WORKSPACE) }],
    ["存在しない商品", { products: productPort(null) }],
    ["別の作業場所の商品", { products: productPort(OTHER_WORKSPACE) }],
    ["存在しない書き手", { personas: personasPort([], []) }],
    [
      "別の作業場所の書き手",
      {
        personas: personasPort(
          [
            {
              id: String(SAMPLE.authorPersonaId),
              displayName: "別会社の書き手",
              workspaceId: OTHER_WORKSPACE,
            },
          ],
          SAMPLE.audiencePersonaIds.map((id) => ({ id: String(id), name: "読者像" })),
        ),
      },
    ],
    [
      "存在しない読者像",
      {
        personas: personasPort(
          [{ id: String(SAMPLE.authorPersonaId), displayName: "編集部の田中" }],
          [],
        ),
      },
    ],
    [
      "別の作業場所の読者像",
      {
        personas: personasPort(
          [{ id: String(SAMPLE.authorPersonaId), displayName: "編集部の田中" }],
          SAMPLE.audiencePersonaIds.map((id) => ({
            id: String(id),
            name: "別会社の読者像",
            workspaceId: OTHER_WORKSPACE,
          })),
        ),
      },
    ],
  ] as const)("%sを参照した企画は保存しない", async (_name, override) => {
    const { port, saved } = packagesPort();
    const result = await createSaveContentPackageUseCase(
      deps({ packages: port, ...override }),
    ).execute(anOwner(), input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_FAILED");
    expect(saved).toHaveLength(0);
  });

  it("居ない読者像を渡しても、型の印だけで通さない", async () => {
    // ここは「通ること」を確かめる検査ではない。ID の形を作るだけの
    // `taggedString` が、存在の確認になっていないことを覚えておくための行。
    const bogus = taggedString<"AudiencePersonaId">("dp_nowhere") as AudiencePersonaId;
    const author = taggedString<"AuthorPersonaId">("ap_nowhere") as AuthorPersonaId;
    expect(String(bogus)).toBe("dp_nowhere");
    expect(String(author)).toBe("ap_nowhere");
  });

  it("誰が企画を立てたかを記録に残す", async () => {
    const audit = recordingAuditLog();
    const { port } = packagesPort();

    await createSaveContentPackageUseCase(
      deps({ packages: port, auditLog: audit.port }),
    ).execute(anOwner(), input);

    expect(audit.actions()).toEqual(["content_package.changed"]);
    expect(audit.entries()[0]?.targetType).toBe("content_package");
  });

  it("記録が残せなくても、企画そのものは巻き戻さない", async () => {
    const { port, saved } = packagesPort();

    const result = await createSaveContentPackageUseCase(
      deps({ packages: port, auditLog: createUnavailableAuditLog() }),
    ).execute(anOwner(), input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.message).toContain("企画の登録は済んでいます");
    expect(saved).toHaveLength(1);
  });
});
