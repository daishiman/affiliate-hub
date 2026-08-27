/**
 * @tier 2
 * @req REQ-E13
 * @types equivalence, boundary, adversarial
 *
 * 登録済みの成果リンクを見て、表記が古くなったものを止める。
 *
 * --- 何が無かったか（2026-08-26 まで）---
 *
 * 商品名も ASP の URL も**登録した日の写し**で、上書きしない決まりにしてある
 * （`docs/product/design-decisions.md` §2）。だから直し方は
 * 「止める → 新しく登録し直す」の 2 手しか無い。ところが 1 手目が存在せず、
 * ASP 側で商品名が変わっても、読者のカードには古い名前が出続けていた。
 *
 * --- ここで固定すること ---
 *
 *   1. 二度押しても止めた日時がずれない（いつ出なくなったかが言える）。
 *   2. ID を知っているだけでは、他社のリンクを止められない。
 *   3. 期限切れも止められる（ASP 側で復活したときに区別が付く）。
 *   4. 記録が残せなければ成功にしない。
 *   5. 理由の無い停止を通さない（記録が空になる）。
 */
import { describe, expect, it } from "vitest";
import type { CommercialAffiliateLinkRepositoryPort } from "@/application/ports/monetization";
import {
  type AffiliateLinkDeps,
  createDisableAffiliateLinkUseCase,
  createListAffiliateLinksUseCase,
} from "@/application/usecases/monetization/manage-affiliate-links";
import { type AffiliateLink, type ProductSnapshot, createAffiliateLink } from "@/domain/monetization";
import type { ActorContext, AffiliateLinkId, WorkspaceId } from "@/domain/shared";
import { domainError, err, markCommercial, ok, taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner } from "../support/actors";
import { recordingAuditLog, testDeps } from "../support/doubles";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
/** 別の会社。ID だけを知っている相手として使う。 */
const OTHER_WS = taggedString<"WorkspaceId">("ws_other") as WorkspaceId;
const NOW = new Date("2026-08-26T09:00:00Z");
const manager: ActorContext = anOwner({ workspaceId: WS });

function linkOf(input: {
  id: string;
  workspaceId?: WorkspaceId;
  expiresAt?: Date | null;
  disabledAt?: Date | null;
}): AffiliateLink {
  const built = createAffiliateLink({
    id: taggedString<"AffiliateLinkId">(input.id) as AffiliateLinkId,
    workspaceId: input.workspaceId ?? WS,
    programId: taggedString<"AffiliateProgramId">("prg_amazon_pc"),
    originalUrl: `https://example.invalid/asp/${input.id}`,
    trackingRef: `ref_${input.id}`,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    expiresAt: input.expiresAt ?? null,
  });
  if (!built.ok) throw new Error(built.error.message);
  return { ...built.value, disabledAt: input.disabledAt ?? null };
}

const SNAPSHOT: ProductSnapshot = {
  productName: "Alpha Studio 15",
  brand: "Alpha",
  oneLine: "書き出しの速さと持ち運びやすさの釣り合いが取れた機種。",
};

/**
 * 覚えておく保存先。
 *
 * **`disable` は行を書き換える形にする。** 返事だけ ok にすると、
 * 二度押しを断る判断が「1 度目で本当に止まったか」に依存していないことになり、
 * 断り文だけが正しくて中身が止まっていない状態を見逃す。
 */
function linksOf(seed: readonly AffiliateLink[]) {
  const rows = seed.map((link) => ({ link, snapshot: SNAPSHOT }));
  const port = markCommercial({
    async findById(workspaceId: WorkspaceId, id: AffiliateLinkId) {
      return ok(rows.find((r) => r.link.workspaceId === workspaceId && r.link.id === id)?.link ?? null);
    },
    async findUsableByOriginalUrl() {
      return ok(null);
    },
    async listByProduct() {
      return ok([]);
    },
    async listNeedingAttention() {
      return ok([]);
    },
    async save(link: AffiliateLink) {
      return ok(link);
    },
    async listWithSnapshot(workspaceId: WorkspaceId) {
      return ok(rows.filter((r) => r.link.workspaceId === workspaceId));
    },
    async disable(workspaceId: WorkspaceId, id: AffiliateLinkId, at: Date) {
      const row = rows.find((r) => r.link.workspaceId === workspaceId && r.link.id === id);
      if (row === undefined) {
        return err(domainError("CONFLICT", "行がありません。", { field: "affiliateLinkId" }));
      }
      row.link = { ...row.link, disabledAt: at };
      return ok(row.link);
    },
  }) as unknown as CommercialAffiliateLinkRepositoryPort;
  return { port, rows };
}

function deps(seed: readonly AffiliateLink[], over: Partial<AffiliateLinkDeps> = {}) {
  const base = testDeps();
  const audit = recordingAuditLog();
  const links = linksOf(seed);
  const built: AffiliateLinkDeps = {
    links: links.port,
    ids: base.ids,
    auditLog: audit.port,
    now: () => NOW,
    ...over,
  };
  return { deps: built, audit, links };
}

describe("登録したリンクを並べる", () => {
  it("止めた・期限切れ・出ている を別々の言葉で出す", async () => {
    const { deps: d } = deps([
      linkOf({ id: "lnk_live" }),
      linkOf({ id: "lnk_expired", expiresAt: new Date("2026-05-31T00:00:00Z") }),
      linkOf({ id: "lnk_off", disabledAt: new Date("2026-07-01T00:00:00Z") }),
    ]);

    const r = await createListAffiliateLinksUseCase(d).execute(manager, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.rows.map((row) => row.state)).toEqual(["usable", "expired", "disabled"]);
    /*
      まとめて「使えません」にしない。押して止めたのか ASP 側の都合なのかが
      読めないと、期限切れを止めた扱いで放置する運用が生まれる。
    */
    expect(new Set(r.value.rows.map((row) => row.stateLabel)).size).toBe(3);
    // 出ている本数は 1。0 なら記事に成果リンクが 1 件も出ない、と読める数字。
    expect(r.value.usableCount).toBe(1);
    // 止め終わったものは押せる形にしない。押しても断られる欄を出す理由が無い。
    expect(r.value.rows.map((row) => row.canDisable)).toEqual([true, true, false]);
  });

  it("URL は接続先しか出さない", async () => {
    const { deps: d } = deps([linkOf({ id: "lnk_live" })]);
    const r = await createListAffiliateLinksUseCase(d).execute(manager, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // 成果の割り当て先が URL に入っている。丸ごと出すと、見せた相手が横取りできる。
    expect(r.value.rows[0]?.host).toBe("example.invalid");
    expect(JSON.stringify(r.value)).not.toContain("/asp/lnk_live");
  });

  it("読者に出ている名前を出す", async () => {
    const { deps: d } = deps([linkOf({ id: "lnk_live" })]);
    const r = await createListAffiliateLinksUseCase(d).execute(manager, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 名前が無いと ID だけで選ぶことになり、別のリンクを止める事故が起きる。
    expect(r.value.rows[0]?.productName).toBe("Alpha Studio 15");
  });
});

describe("止める", () => {
  it("止めると、その日時が行に立つ", async () => {
    const { deps: d, links, audit } = deps([linkOf({ id: "lnk_live" })]);

    const r = await createDisableAffiliateLinkUseCase(d).execute(manager, {
      affiliateLinkId: "lnk_live",
      reason: "ASP 側で商品名が変わったため",
    });

    expect(r.ok).toBe(true);
    expect(links.rows[0]?.link.disabledAt).toEqual(NOW);
    expect(audit.actions()).toContain("affiliate_link.changed");
    // 止める前の状態を記録に残す。行には最後の状態しか残らない。
    const entry = audit.entries().at(-1);
    expect(entry?.before).toMatchObject({ disabledAt: null });
    expect(entry?.after).toMatchObject({ reason: "ASP 側で商品名が変わったため" });
  });

  it("二度押しても、止めた日時が後ろへずれない", async () => {
    const already = new Date("2026-07-01T00:00:00Z");
    const { deps: d, links } = deps([linkOf({ id: "lnk_off", disabledAt: already })]);

    const r = await createDisableAffiliateLinkUseCase(d).execute(manager, {
      affiliateLinkId: "lnk_off",
      reason: "もう一度押してみる",
    });

    expect(r.ok).toBe(false);
    /*
      成功にすると、押すたびに日時が後ろへずれる。
      「いつ読者に出なくなったか」が言えなくなり、
      止めたはずの期間に出ていた疑いを晴らせなくなる。
    */
    expect(links.rows[0]?.link.disabledAt).toEqual(already);
  });

  it("ID を知っているだけでは、他社のリンクを止められない", async () => {
    const { deps: d, links } = deps([linkOf({ id: "lnk_theirs", workspaceId: OTHER_WS })]);

    const r = await createDisableAffiliateLinkUseCase(d).execute(manager, {
      affiliateLinkId: "lnk_theirs",
      reason: "止めたい",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("NOT_FOUND");
    expect(links.rows[0]?.link.disabledAt).toBeNull();
  });

  it("期限切れのリンクも止められる", async () => {
    const { deps: d, links } = deps([
      linkOf({ id: "lnk_expired", expiresAt: new Date("2026-05-31T00:00:00Z") }),
    ]);

    const r = await createDisableAffiliateLinkUseCase(d).execute(manager, {
      affiliateLinkId: "lnk_expired",
      reason: "提携そのものを終えたため",
    });

    /*
      期限が切れているだけのものを止められないと、ASP 側で提携が復活した日に
      「止めていない期限切れ」と「止めた」を区別できない。
    */
    expect(r.ok).toBe(true);
    expect(links.rows[0]?.link.disabledAt).toEqual(NOW);
  });

  it("理由が空なら止めない", async () => {
    const { deps: d, links } = deps([linkOf({ id: "lnk_live" })]);

    const r = await createDisableAffiliateLinkUseCase(d).execute(manager, {
      affiliateLinkId: "lnk_live",
      reason: "   ",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.field).toBe("reason");
    // 理由の無い停止を通すと、記録が空のまま残り、後から「なぜ」に答えられない。
    expect(links.rows[0]?.link.disabledAt).toBeNull();
  });

  it("記録が残せなければ、成功にしない", async () => {
    const { deps: d } = deps([linkOf({ id: "lnk_live" })], {
      auditLog: {
        append: async () => err(domainError("UPSTREAM_UNAVAILABLE", "記録先に届きません。")),
        listByTarget: async () => ok([]),
        search: async () => ok({ items: [], nextCursor: null }),
      } as AffiliateLinkDeps["auditLog"],
    });

    const r = await createDisableAffiliateLinkUseCase(d).execute(manager, {
      affiliateLinkId: "lnk_live",
      reason: "表記が古くなったため",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    /*
      止まってはいるが、誰がいつ止めたかが残っていない。
      **成功と出すと、記録が要らない操作だったことになる。**
      文面には「リンクは止まっています」を含め、押した人が
      もう一度押しに戻らないようにする。
    */
    expect(r.error.message).toContain("リンクは止まっています");
  });
});
