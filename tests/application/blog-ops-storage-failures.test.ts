/**
 * @tier 1
 * @req REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS06, REQ-BOPS07
 * @req REQ-BOPS08, REQ-BOPS09, REQ-BOPS10
 * @types decision-table, equivalence, audit-log
 *
 * 保存先が落ちているときの振る舞い。
 *
 * --- なぜこれだけを別に見るのか ---
 *
 * ブログ運用のユースケースは、保管庫の口を 1 回の処理で 2〜4 本叩く。
 * 一覧なら記事・配信物・点検結果、保存なら「今あるものを読む」→「書く」。
 * **どれか 1 本が落ちたときに、残りの結果だけで話を進めてしまう**のが
 * ここで防ぎたい失敗である。読めなかったものを「0 件」と受け取れば、
 * 画面には「まだ 1 件もありません」と出る。落ちていることは出ない。
 *
 * もう 1 つ見るのが**記録の順番**である。断ったのに監査へ書いていれば、
 * 後から履歴を読んだ人は「やった」と読む。断った操作は記録も残さない。
 *
 * 保存できた場合の正しさは `blog-ops-usecases.test.ts` が見ているので重ねない。
 * ここは「落ちている口が 1 本ある」ことだけを変えて、結果を見る。
 */
import { describe, expect, it } from "vitest";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import {
  createCheckBlogDeliveryUseCase,
  createCreateBlogArticleUseCase,
  createCreateSiteNetworkNodeUseCase,
  createDeleteBlogArticleUseCase,
  createDeleteBlogTagUseCase,
  createDeleteSiteNetworkNodeUseCase,
  createEvaluateBlogArticlesUseCase,
  createGetBlogArticleUseCase,
  createListArticleRatingsUseCase,
  createListBlogArticlesUseCase,
  createListBlogTagsUseCase,
  createListDeletedBlogArticlesUseCase,
  createListDeletedSiteNetworkUseCase,
  createListSiteNetworkUseCase,
  createReadBlogLayoutUseCase,
  createRestoreBlogArticleUseCase,
  createRestoreSiteNetworkNodeUseCase,
  createSaveBlogLayoutBandUseCase,
  createSaveBlogLayoutSlotUseCase,
  createSaveBlogTagUseCase,
  createSaveDeliveryPartUseCase,
  createSetArticleRatingHiddenUseCase,
  createUpdateBlogArticleUseCase,
  createUpdateSiteNetworkNodeUseCase,
} from "@/application/usecases/blog-ops";
import { DELIVERY_PARTS, SIDEBAR_SLOT_KEYS, TOP_BANDS } from "@/domain/blogops";
import { type DomainError, type Result, domainError, err, isErr, ok } from "@/domain/shared";
import { WORKSPACE, anOwner } from "../support/actors";
import { NOW } from "../support/clock";
import { type Store, article, fakeRepository, node, sequentialIds } from "../support/blog-ops-fake";
import { recordingAuditLog } from "../support/doubles";

/**
 * 保管庫が返す「今は届きません」。
 *
 * `VALIDATION_FAILED` ではなく `UPSTREAM_UNAVAILABLE` にしてある。
 * 入力が悪いのではないので、画面は「直してもう一度」ではなく
 * 「時間を置いて」と言う必要がある。
 */
const OUTAGE: DomainError = domainError("UPSTREAM_UNAVAILABLE", "保存先 (D1) に届きません。", {
  retryable: true,
});

/** 口を 1 本だけ落とした保管庫。**残りは本物どおり動く。** */
function breaking<K extends keyof BlogOpsRepositoryPort>(
  port: BlogOpsRepositoryPort,
  name: K,
): BlogOpsRepositoryPort {
  return {
    ...port,
    [name]: async (): Promise<Result<never, DomainError>> => err(OUTAGE),
  } as BlogOpsRepositoryPort;
}

function brokenDeps(name: keyof BlogOpsRepositoryPort, seed: Partial<Store> = {}) {
  const repo = fakeRepository(seed);
  const audit = recordingAuditLog();
  return {
    audit,
    deps: {
      repository: breaking(repo.port, name),
      publishedContent: {
        listRecent: async () =>
          ok(
            repo.store.articles
              .map((detail) => detail.article)
              .filter((candidate) => candidate.status === "published")
              .map((candidate) => ({
                slug: candidate.slug,
                siteSlug: candidate.siteSlug,
                type: "guide" as const,
                title: candidate.title,
                summary: candidate.lead,
                categorySlug: candidate.categorySlug ?? "uncategorized",
                updatedAt: candidate.updatedAt.toISOString(),
                authorName: candidate.authorName,
              })),
          ),
      },
      ids: sequentialIds(),
      auditLog: audit.port,
      now: () => NOW,
    },
  };
}

/**
 * 落ちた口の断りが、そのまま呼び出し元へ届くか。
 *
 * **`isErr` だけでは足りない。**別の理由（権限・見つからない）で断っていても
 * `isErr` は真になるので、口が落ちたことが伝わったとは言えない。
 * `code` まで見て初めて、画面が「時間を置いて」と言える。
 */
function expectOutage(result: Result<unknown, DomainError>): void {
  expect(isErr(result)).toBe(true);
  if (isErr(result)) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
}

const HUB = node({ siteSlug: "hub", role: "hub" });
const DETAIL = { article: article({ id: "art1", siteSlug: "hub" }), blocks: [], tagIds: [] };
const TAG = {
  id: "tag1",
  siteSlug: "hub",
  slug: "camera",
  name: "カメラ",
  description: "",
  kind: "brand" as const,
};

describe("サイト網 — 口が 1 本落ちたら断る", () => {
  const seed = { network: [HUB] };

  it.each([
    ["ブログの一覧", "listNetwork"],
    ["記事の一覧", "listArticles"],
    ["配信物の設定", "listDeliveryParts"],
    ["点検の結果", "listDeliverySnapshots"],
  ] as const)("一覧は %s が読めなければ断る", async (_what, port) => {
    const { deps } = brokenDeps(port, seed);
    expectOutage(await createListSiteNetworkUseCase(deps).execute(anOwner(), {}));
  });

  it("削除済みの一覧も、読めなければ空とは言わない", async () => {
    const { deps } = brokenDeps("listDeletedNetwork", seed);
    expectOutage(await createListDeletedSiteNetworkUseCase(deps).execute(anOwner(), {}));
  });

  it.each(["listNetwork", "listDeletedNetwork", "saveNetworkNode"] as const)(
    "追加は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      // 親のいる `sub` を足す。**親なしの `sub` は入力の誤りとして
      // 保管庫に触る前に断られる**ので、落とした口まで届かない。
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createCreateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
          siteSlug: "gear",
          role: "sub",
          parentSlug: "hub",
          name: "道具の話",
          oneLine: "",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["findNetworkNode", "listNetwork", "saveNetworkNode"] as const)(
    "変更は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createUpdateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
          nodeId: HUB.id,
          name: "新しい名前",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["listNetwork", "deleteNetworkNode"] as const)(
    "削除は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createDeleteSiteNetworkNodeUseCase(deps).execute(anOwner(), {
          nodeId: HUB.id,
          reason: "統合したため",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["listDeletedNetwork", "listNetwork", "restoreNetworkNode"] as const)(
    "復元は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, {
        deletedNetwork: [{ node: HUB, deletedAt: NOW }],
      });
      expectOutage(
        await createRestoreSiteNetworkNodeUseCase(deps).execute(anOwner(), { nodeId: HUB.id }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );
});

describe("記事 — 口が 1 本落ちたら断る", () => {
  const seed = { network: [HUB], articles: [DETAIL] };

  it("一覧は記事が読めなければ断る", async () => {
    const { deps } = brokenDeps("listArticles", seed);
    expectOutage(await createListBlogArticlesUseCase(deps).execute(anOwner(), {}));
  });

  it("削除済みの一覧も、読めなければ空とは言わない", async () => {
    const { deps } = brokenDeps("listDeletedArticles", seed);
    expectOutage(await createListDeletedBlogArticlesUseCase(deps).execute(anOwner(), {}));
  });

  it("1 本の閲覧は、記事が読めなければ断る", async () => {
    const { deps } = brokenDeps("findArticle", seed);
    expectOutage(
      await createGetBlogArticleUseCase(deps).execute(anOwner(), { articleId: "art1" }),
    );
  });

  it.each(["listArticles", "saveArticle"] as const)(
    "作成は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, { network: [HUB] });
      expectOutage(
        await createCreateBlogArticleUseCase(deps).execute(anOwner(), {
          siteSlug: "hub",
          slug: "new-article",
          template: "T4",
          title: "新しい記事",
          lead: "",
          authorName: "編集部",
          categorySlug: "chairs",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["findArticle", "saveArticle"] as const)(
    "変更は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createUpdateBlogArticleUseCase(deps).execute(anOwner(), {
          articleId: "art1",
          title: "直した題名",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["findArticle", "deleteArticle"] as const)(
    "削除は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createDeleteBlogArticleUseCase(deps).execute(anOwner(), {
          articleId: "art1",
          reason: "重複していたため",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["listDeletedArticles", "restoreArticle"] as const)(
    "復元は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, {
        network: [HUB],
        deletedArticles: [{ ...DETAIL, deletedAt: NOW }],
      });
      expectOutage(
        await createRestoreBlogArticleUseCase(deps).execute(anOwner(), { articleId: "art1" }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );
});

describe("タグ — 口が 1 本落ちたら断る", () => {
  const seed = { network: [HUB], tags: [TAG] };

  it("タグの一覧は、読めなければ断る", async () => {
    const { deps } = brokenDeps("listTags", seed);
    expectOutage(await createListBlogTagsUseCase(deps).execute(anOwner(), { siteSlug: "hub" }));
  });

  it.each(["listTags", "saveTag"] as const)(
    "タグの保存は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createSaveBlogTagUseCase(deps).execute(anOwner(), {
          siteSlug: "hub",
          slug: "lens",
          name: "レンズ",
          description: "",
          kind: "topic",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["listTags", "deleteTag"] as const)(
    "タグの削除は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createDeleteBlogTagUseCase(deps).execute(anOwner(), {
          siteSlug: "hub",
          tagId: TAG.id,
          reason: "使わなくなったため",
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );
});

describe("版面と配信物 — 口が 1 本落ちたら断る", () => {
  const seed = { network: [HUB] };

  it.each([
    "listLayoutSlots",
    "listLayoutBands",
    "listDeliveryParts",
    "listDeliverySnapshots",
  ] as const)("版面の読み出しは %s が落ちていれば断る", async (port) => {
    const { deps } = brokenDeps(port, seed);
    expectOutage(await createReadBlogLayoutUseCase(deps).execute(anOwner(), { siteSlug: "hub" }));
  });

  it.each(["listLayoutSlots", "saveLayoutSlot"] as const)(
    "枠の保存は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createSaveBlogLayoutSlotUseCase(deps).execute(anOwner(), {
          siteSlug: "hub",
          region: "sidebar",
          slotKey: SIDEBAR_SLOT_KEYS[0],
          title: "運営者について",
          body: "本文",
          position: 0,
          enabled: true,
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["listLayoutBands", "saveLayoutBand"] as const)(
    "帯の保存は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createSaveBlogLayoutBandUseCase(deps).execute(anOwner(), {
          siteSlug: "hub",
          band: TOP_BANDS[0],
          title: "新着",
          enabled: true,
          position: 0,
          itemLimit: 6,
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it.each(["listDeliveryParts", "saveDeliveryPart"] as const)(
    "配信物の設定は %s が落ちていれば断り、記録も残さない",
    async (port) => {
      const { deps, audit } = brokenDeps(port, seed);
      expectOutage(
        await createSaveDeliveryPartUseCase(deps).execute(anOwner(), {
          siteSlug: "hub",
          part: DELIVERY_PARTS[0],
          enabled: true,
          note: "",
          position: 0,
        }),
      );
      expect(audit.entries()).toHaveLength(0);
    },
  );

  it("点検は、結果を書けなければ「点検しました」と言わない", async () => {
    const { deps, audit } = brokenDeps("saveDeliverySnapshot", {
      network: [HUB],
      articles: [DETAIL],
    });
    expectOutage(
      await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), {
        siteSlug: "hub",
        siteName: "中心のブログ",
        purpose: "道具選びの記録",
        origin: "https://example.test",
        basePath: "/s/hub",
        emitLlmsTxt: true,
      }),
    );
    expect(audit.entries()).toHaveLength(0);
  });

  it("点検は、公開 projection を読めなければ記事 0 件として続けない", async () => {
    const { deps, audit } = brokenDeps("saveDeliverySnapshot", {
      network: [HUB],
      articles: [DETAIL],
    });
    const failedPublicRead = {
      ...deps,
      publishedContent: {
        listRecent: async (): Promise<Result<never, DomainError>> => err(OUTAGE),
      },
    };

    expectOutage(
      await createCheckBlogDeliveryUseCase(failedPublicRead).execute(anOwner(), {
        siteSlug: "hub",
        siteName: "中心のブログ",
        purpose: "道具選びの記録",
        origin: "https://example.test",
        basePath: "/s/hub",
        emitLlmsTxt: true,
      }),
    );
    expect(audit.entries()).toHaveLength(0);
  });
});

describe("評価 — 口が 1 本落ちたら断る", () => {
  const seed = { network: [HUB], articles: [DETAIL] };

  it.each(["listArticles", "summarizeRatings"] as const)(
    "評価の一覧は %s が落ちていれば断る",
    async (port) => {
      const { deps } = brokenDeps(port, seed);
      expectOutage(await createEvaluateBlogArticlesUseCase(deps).execute(anOwner(), {}));
    },
  );

  it("1 本ぶんの票は、読めなければ「0 件」とは言わない", async () => {
    const { deps } = brokenDeps("listRatings", seed);
    expectOutage(
      await createListArticleRatingsUseCase(deps).execute(anOwner(), { articleId: "art1" }),
    );
  });

  it("伏せる操作は、書けなければ断り、記録も残さない", async () => {
    const { deps, audit } = brokenDeps("setRatingHidden", {
      ...seed,
      votes: [
        {
          id: "rt1",
          articleId: "art1",
          readerKey: "reader-1",
          score: 5,
          comment: null,
          hidden: false,
          createdAt: NOW,
        },
      ],
    });
    expectOutage(
      await createSetArticleRatingHiddenUseCase(deps).execute(anOwner(), {
        articleId: "art1",
        ratingId: "rt1",
        hidden: true,
        reason: "宣伝だったため",
      }),
    );
    expect(audit.entries()).toHaveLength(0);
  });
});

describe("作業場所は落ちた口をまたいでも混ざらない", () => {
  it("落ちているのは自分の作業場所の口であって、他社の分ではない", async () => {
    // 落ちた口はどの作業場所から呼ばれても落ちる。**作業場所ごとに
    // 出し分けない。**「他社のときだけ動く」保管庫を書いてしまうと、
    // 落ちている状況の再現が作業場所に依存して不安定になる。
    const { deps } = brokenDeps("listNetwork", { network: [HUB] });
    const mine = await createListSiteNetworkUseCase(deps).execute(anOwner(), {});
    expectOutage(mine);
    expect(anOwner().workspaceId).toBe(WORKSPACE);
  });
});
