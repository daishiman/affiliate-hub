/**
 * @tier 1
 * @req REQ-E13, REQ-A07
 * @types permission-matrix, state-transition, audit-log, equivalence
 *
 * 受信箱の 1 件を、記事に出せる成果リンクとして登録する手続き。
 *
 * --- ここで固定したいこと ---
 * `affiliate_links` は長いあいだ**読む側しか無かった**。記事の組み立てはこの表を
 * 引くのに、入れる口がどこにも無いので、実運用では表が空のまま公開されていた。
 * 空の表を引いた記事は、成果リンクが 1 件も無いまま「正しく公開できた」ように見える。
 *
 * だから確かめるのは「入った」ことだけではない。**入らない道**のほうを多く見る。
 *   - 商品名が無いまま入らない（その場で作った名前が読者のカードに出ないこと）
 *   - 広告主・商品が決まっていないものが入らない
 *   - 重複の印が付いたものが入らない（同じ URL のカードが 2 枚出ない）
 *   - 権限の無い人・他の作業場所の ID では入らない
 *   - 記録が残せなければ、成功として返さない
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2（ユースケースの単体テスト）、
 *       docs/product/design-decisions.md §2（商品名の正本）
 */
import { describe, expect, it } from "vitest";
import {
  createMatchLinkIngestionUseCase,
  createResolveLinkIngestionUseCase,
  createSubmitAffiliateUrlUseCase,
  type ManageLinkInboxDeps,
} from "@/application/usecases/monetization/manage-link-inbox";
import {
  createRegisterAffiliateLinkUseCase,
  type RegisterAffiliateLinkDeps,
} from "@/application/usecases/monetization/register-affiliate-link";
import type { CommercialAffiliateLinkRepositoryPort } from "@/application/ports/monetization";
import { type AffiliateLink, type ProductSnapshot, isLinkUsable } from "@/domain/monetization";
import type { ActorContext, WorkspaceId } from "@/domain/shared";
import { err, domainError, markCommercial, ok, taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anAnalyst, anOwner } from "../support/actors";
import { recordingAuditLog, testDeps } from "../support/doubles";

/** 見本にある広告主。作業場所ごとに分かれているので、見本の作業場所に合わせる。 */
const PROGRAM_ID = "prg_amazon_pc";
const PRODUCT_ID = "p_alpha_15";
const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;

const manager: ActorContext = anOwner({ workspaceId: WS });

/** 貼り付けるたびに違う URL を作る。見本の受信箱は動いている間ずっと溜まるため。 */
let serial = 0;
function freshUrl(): string {
  serial += 1;
  return `https://example.invalid/asp/amazon/register-${serial}-${Date.now()}`;
}

/**
 * 覚えておく成果リンクの保存先。
 *
 * **商品の写しも一緒に覚える。** 保存先が写しを落とす作りだと、
 * 「登録できたのに記事には名前が出ない」を試験が見逃す。
 */
function recordingLinks(): {
  readonly port: CommercialAffiliateLinkRepositoryPort;
  readonly saved: () => readonly { link: AffiliateLink; snapshot: ProductSnapshot }[];
} {
  const rows: { link: AffiliateLink; snapshot: ProductSnapshot }[] = [];
  return {
    port: markCommercial({
      async findById(workspaceId, id) {
        return ok(
          rows.find((r) => r.link.workspaceId === workspaceId && r.link.id === id)?.link ?? null,
        );
      },
      async findUsableByOriginalUrl(workspaceId, originalUrl, at) {
        return ok(
          rows.find(
            (r) =>
              r.link.workspaceId === workspaceId &&
              r.link.originalUrl === originalUrl &&
              isLinkUsable(r.link, at),
          )?.link ?? null,
        );
      },
      async listByProduct(workspaceId, productId) {
        return ok(
          rows
            .filter((r) => r.link.workspaceId === workspaceId && r.link.productId === productId)
            .map((r) => r.link),
        );
      },
      async listNeedingAttention() {
        return ok([]);
      },
      async save(link, snapshot) {
        rows.push({ link, snapshot });
        return ok(link);
      },
    }) as CommercialAffiliateLinkRepositoryPort,
    saved: () => rows,
  };
}

type Harness = {
  readonly register: ReturnType<typeof createRegisterAffiliateLinkUseCase>;
  readonly inboxDeps: ManageLinkInboxDeps;
  readonly links: ReturnType<typeof recordingLinks>;
  readonly audit: ReturnType<typeof recordingAuditLog>;
};

function harness(over: Partial<RegisterAffiliateLinkDeps> = {}): Harness {
  const base = testDeps();
  const audit = recordingAuditLog();
  const links = recordingLinks();
  const inboxDeps: ManageLinkInboxDeps = {
    inbox: base.linkInbox,
    programs: base.affiliatePrograms,
    ids: base.ids,
    events: base.events,
    auditLog: audit.port,
    now: () => new Date(),
  };
  const register = createRegisterAffiliateLinkUseCase({
    inbox: base.linkInbox,
    links: links.port,
    ids: base.ids,
    auditLog: audit.port,
    now: () => new Date(),
    ...over,
  });
  return { register, inboxDeps, links, audit };
}

/**
 * 受信箱に 1 本入れて、指定の状態まで進める。
 *
 * **本物のユースケースで進める。** 受信箱の行を直接組み立てて渡すと、
 * 実際には通れない状態の組み合わせを試験だけが作れてしまう。
 */
async function ingestion(
  h: Harness,
  upTo: "received" | "resolved" | "matched",
): Promise<{ id: string; url: string }> {
  const url = freshUrl();
  const submitted = await createSubmitAffiliateUrlUseCase(h.inboxDeps).execute(manager, {
    url,
    source: "paste",
  });
  if (!submitted.ok) throw submitted.error;
  const id = submitted.value.item.id;
  if (upTo === "received") return { id, url };

  const resolved = await createResolveLinkIngestionUseCase(h.inboxDeps).execute(manager, {
    linkIngestionId: id,
    programId: PROGRAM_ID,
  });
  if (!resolved.ok) throw resolved.error;
  if (upTo === "resolved") return { id, url };

  const matched = await createMatchLinkIngestionUseCase(h.inboxDeps).execute(manager, {
    linkIngestionId: id,
    productId: PRODUCT_ID,
  });
  if (!matched.ok) throw matched.error;
  return { id, url };
}

describe("つなぎ目の印", () => {
  it("商業の印が付いていないつなぎ目では、そもそも組み立てられない", () => {
    // 印を落としたまま動くと、報酬に関わる口が順位づけ側へ渡る道が開く。
    const naked = { ...recordingLinks().port } as CommercialAffiliateLinkRepositoryPort;
    expect(() => harness({ links: naked })).toThrow(/商業データの印/);
  });
});

describe("登録できる道", () => {
  it("商品まで決まったリンクを登録すると、URL と商品名がそのまま保存先へ渡る", async () => {
    const h = harness();
    const { id, url } = await ingestion(h, "matched");

    const done = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
      brand: "Alpha",
      oneLine: "書き出しの速さと持ち運びやすさの釣り合いが取れた機種。",
    });
    if (!done.ok) throw done.error;

    const saved = h.links.saved();
    expect(saved).toHaveLength(1);
    // **URL を 1 文字も変えない。** 加工した URL は成果が計上されない。
    expect(saved[0]?.link.originalUrl).toBe(url);
    expect(saved[0]?.snapshot.productName).toBe("Alpha Studio 15");
    expect(saved[0]?.link.programId).toBe(PROGRAM_ID);
    expect(saved[0]?.link.productId).toBe(PRODUCT_ID);
    expect(done.value.affiliateLinkId).toBe(String(saved[0]?.link.id));
  });

  it("ブランドと 1 文を空で送ると、空文字ではなく未設定として保存される", async () => {
    // 空文字で入れると、「空欄で登録した」と「入れなかった」が保存先で区別できない。
    const h = harness();
    const { id } = await ingestion(h, "matched");

    const done = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Delta Light 13",
      brand: "   ",
    });
    if (!done.ok) throw done.error;

    expect(h.links.saved()[0]?.snapshot.brand).toBeNull();
    expect(h.links.saved()[0]?.snapshot.oneLine).toBeNull();
  });

  it("期限を勝手に入れない", async () => {
    // ASP から期限を取れていない。入れると、切れていないリンクが
    // 期限切れ扱いで記事から静かに消える。
    const h = harness();
    const { id } = await ingestion(h, "matched");
    const done = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
    });
    if (!done.ok) throw done.error;

    expect(h.links.saved()[0]?.link.expiresAt).toBeNull();
    expect(h.links.saved()[0]?.link.disabledAt).toBeNull();
  });
});

describe("登録できない道", () => {
  it("商品名が空なら断る（その場で名前を作らない）", async () => {
    const h = harness();
    const { id } = await ingestion(h, "matched");

    const result = await h.register.execute(manager, { linkIngestionId: id, productName: "  " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("productName");
    // 断ったのだから、保存先には 1 行も入っていない。
    expect(h.links.saved()).toHaveLength(0);
  });

  it("広告主が決まっていないリンクは登録できない", async () => {
    const h = harness();
    const { id } = await ingestion(h, "received");

    const result = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("先に広告主と商品を決めてください");
  });

  it("商品が決まっていないリンクは登録できない", async () => {
    const h = harness();
    const { id } = await ingestion(h, "resolved");

    const result = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("先に広告主と商品を決めてください");
  });

  it("同じ URL が既に登録されていれば、2 本目を作らない", async () => {
    // 2 本作ると、記事に同じ商品が 2 枚並び、クリックが 2 つの合言葉へ割れる。
    const h = harness();
    const first = await ingestion(h, "matched");
    const done = await h.register.execute(manager, {
      linkIngestionId: first.id,
      productName: "Alpha Studio 15",
    });
    if (!done.ok) throw done.error;

    // 同じ URL をもう一度受け取り、商品まで決めてから登録しようとする。
    const submitted = await createSubmitAffiliateUrlUseCase(h.inboxDeps).execute(manager, {
      url: first.url,
      source: "paste",
    });
    if (!submitted.ok) throw submitted.error;
    // 受け取りの側で重複の印が付く。**捨てずに受け取ったうえで**知らせる決まり。
    expect(submitted.value.duplicate).toBe(true);

    const again = await h.register.execute(manager, {
      linkIngestionId: submitted.value.item.id,
      productName: "Alpha Studio 15",
    });
    expect(again.ok).toBe(false);
    expect(h.links.saved()).toHaveLength(1);
  });

  it("他の作業場所のリンク ID を渡しても、見つからないとして断る", async () => {
    const h = harness();
    const { id } = await ingestion(h, "matched");

    // ID は本物。違うのは押した人の作業場所だけ。
    const outsider = anOwner({ workspaceId: "ws-someone-else" as WorkspaceId });
    const result = await h.register.execute(outsider, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(h.links.saved()).toHaveLength(0);
  });

  it("提携を扱う権限が無ければ、入力を読む前に断る", async () => {
    const h = harness();
    const { id } = await ingestion(h, "matched");

    for (const actor of [
      anAnalyst({ workspaceId: WS }),
      aNobody({ workspaceId: WS }),
    ]) {
      const result = await h.register.execute(actor, {
        linkIngestionId: id,
        productName: "Alpha Studio 15",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(h.links.saved()).toHaveLength(0);
  });

  /*
   * --- ここに「ログインしていない人」の試験を置かない ---
   * `identified: false` は**この層では断りの根拠にならない**。身元を確かめられたかは
   * 記録へ写す印（`AuditActor.identified`）であって、権限の判定には入っていない
   * （`src/domain/shared/tenancy.ts` の長い注記）。ここへ「`identified: false` なら
   * 断る」試験を置くと、通すために判定を 2 か所へ増やすことになる。
   *
   * 未ログインを止めるのは画面側の `signedInActor()` で、そこが `null` を返すと
   * ユースケースまで届かない。その道は
   * `tests/presentation/admin-actions.test.ts` の「ログインしていない人は、
   * 成果リンクを登録できない」が見ている。
   */
});

describe("誰がやったかの記録", () => {
  it("登録の記録が、商品名つきで残る", async () => {
    const h = harness();
    const { id } = await ingestion(h, "matched");

    const done = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
      brand: "Alpha",
    });
    if (!done.ok) throw done.error;

    const entry = h.audit
      .entries()
      .find((e) => e.targetType === "affiliate_link" && e.targetId === done.value.affiliateLinkId);
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("affiliate_link.created");
    expect(entry?.after?.productName).toBe("Alpha Studio 15");
    // 受け取りからここまでを 1 本で辿れるように、受信箱の ID を残す。
    expect(entry?.after?.linkIngestionId).toBe(id);
    // **URL 全体は残さない。** 成果の割り当て先が URL に入っている。
    expect(JSON.stringify(entry?.after)).not.toContain("https://");
  });

  it("記録を残せなければ、登録は成功として返さない", async () => {
    const h = harness({
      auditLog: {
        append: async () =>
          err(domainError("UPSTREAM_UNAVAILABLE", "記録の保存先が落ちています。", {})),
        listByTarget: async () => ok([]),
        search: async () => ok({ items: [], nextCursor: null }),
      },
    });
    const { id } = await ingestion(h, "matched");

    const result = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 保存自体は済んでいる。**済んだことを断り文で言う**（二重に押させない）。
    expect(result.error.message).toContain("成果リンクは登録されています");
  });
});

describe("順位づけへ渡らないこと", () => {
  it("登録の結果に報酬の欄が無い", async () => {
    const h = harness();
    const { id } = await ingestion(h, "matched");
    const done = await h.register.execute(manager, {
      linkIngestionId: id,
      productName: "Alpha Studio 15",
    });
    if (!done.ok) throw done.error;

    // 返す形に金額が入ると、画面や道具の側から順位づけへ流れる道ができる。
    expect(Object.keys(done.value).sort()).toEqual(["affiliateLinkId", "message", "productName"]);
  });
});

/** 型だけの確認: 商品の写しを渡さずに保存を呼ぶ書き方は、そもそも通らない。 */
const _snapshotIsRequired: ProductSnapshot = {
  productName: "Alpha Studio 15",
  brand: null,
  oneLine: null,
};
void _snapshotIsRequired;

/** 使わない import を残さないための固定（`taggedString` は ID を作る道具）。 */
void taggedString;
