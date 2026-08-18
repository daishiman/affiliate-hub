/** @tier 1 */
import { describe, expect, it } from "vitest";
import {
  CONVERSION_STATUS_LABEL,
  type ManageAffiliateDeps,
  createAdjustConversionUseCase,
  createGetConversionUseCase,
  createListAffiliateAccountsUseCase,
  createListAffiliateProgramsUseCase,
  createListConversionsUseCase,
  createListProductLinksUseCase,
  rewardModelLabel,
} from "@/application/usecases/monetization/manage-affiliate";
import { markCommercial } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anAnalyst, anOwner } from "../support/actors";
import { failing, recordingAuditLog, testDeps } from "../support/doubles";

/**
 * 提携（アフィリエイト）と成果。
 *
 * --- ここで最も守りたいこと ---
 * 1. **金額は順位づけへ渡らない。** 型（商業の印）で塞いであるが、印を付け忘れた
 *    実装が混ざれば塞がらない。組み立ての時点で落ちることを確かめる。
 * 2. **「未取得」と「0 円」を混ぜない。** 混ぜると、取り込めていないことに誰も気づけず、
 *    実際より低い売上を正しい数字だと思い込む。
 * 3. **締めた期間は動かない。** 締めた後に金額が変わると、提出済みの報告と食い違う。
 * 4. **できない理由を必ず返す。** ボタンが出ない理由が分からないと、
 *    権限の問題なのか壊れているのか切り分けられない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / docs/architecture/testing-architecture.md §2
 */

/**
 * 見本の提携データは作業場所ごとに分かれている。
 * ここを合わせずに書くと、**分離が効いているせいの空振り**を
 * 「機能が壊れている」と読み違える。
 */
const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const analyst = anAnalyst({ workspaceId: WS });
const nobody = aNobody({ workspaceId: WS });

function deps(over: Partial<ManageAffiliateDeps> = {}): ManageAffiliateDeps {
  const base = testDeps();
  return {
    accounts: base.affiliateAccounts,
    programs: base.affiliatePrograms,
    links: base.affiliateLinks,
    conversions: base.conversions,
    ids: base.ids,
    // 見本の記録は書き足しを断る（保存先が無い）ので、溜める版を使う。
    auditLog: recordingAuditLog().port,
    now: () => new Date(),
    ...over,
  };
}

/** 指定した操作だけ失敗させる。商業の印は付け直す（外れると組み立てが落ちる）。 */
function conversionsThatFail(over: Record<string, unknown>): ManageAffiliateDeps["conversions"] {
  return markCommercial({
    ...testDeps().conversions,
    ...over,
  }) as ManageAffiliateDeps["conversions"];
}

describe("順位づけとの分離", () => {
  it("商業の印が無いポートを渡されたら、組み立ての時点で落ちる", () => {
    // 展開すると印が外れる（印は列挙されない属性として付けてある）。
    const naked = { ...testDeps().conversions } as ManageAffiliateDeps["conversions"];

    // 動き出してから気づくのでは遅い。渡した瞬間に落とす。
    expect(() => createListConversionsUseCase(deps({ conversions: naked }))).toThrow(
      /商業データの印/,
    );
    expect(() => createListProductLinksUseCase(deps({ conversions: naked }))).toThrow(
      /順位づけ側へ渡せて/,
    );
  });
});

describe("報酬の決め方の書き方", () => {
  it("決め方ごとに、読んで分かる言葉になる", () => {
    expect(rewardModelLabel({ kind: "rate", percent: 3 })).toContain("3%");
    expect(
      rewardModelLabel({ kind: "fixed", amount: { amountMinor: 500, currency: "JPY" } }),
    ).toContain("500");
    expect(rewardModelLabel({ kind: "tiered", note: "月間 10 件から上がる" })).toContain(
      "月間 10 件から上がる",
    );
  });

  it("決め方が取れていないときは「未取得」と書く", () => {
    const unknown = { kind: "まだ聞いていない" } as unknown as Parameters<typeof rewardModelLabel>[0];

    // 「0%」と書くと、報酬が出ない提携に見える。取れていないことをそのまま出す。
    expect(rewardModelLabel(unknown)).toBe("未取得");
  });
});

describe("提携先の一覧", () => {
  it("接続情報が未登録の提携先には、その理由が付く", async () => {
    const listed = await createListAffiliateAccountsUseCase(deps()).execute(owner, {});
    if (!listed.ok) throw new Error(listed.error.message);

    const pending = listed.value.items.find((a) => !a.credentialRegistered);
    expect(pending).toBeDefined();
    expect(pending?.blockedReason).toContain("接続情報");
    // 登録は本人が別の場所で行う。値をこちらへ持ってこさせない。
    expect(JSON.stringify(listed.value)).not.toContain("secret/");
  });

  it("登録済みの提携先には、止める理由が無い", async () => {
    const listed = await createListAffiliateAccountsUseCase(deps()).execute(owner, {});
    if (!listed.ok) throw new Error(listed.error.message);

    const ready = listed.value.items.find((a) => a.credentialRegistered && !a.disabled);
    expect(ready?.blockedReason).toBeNull();
    expect(ready?.aspLabel.trim()).not.toBe("");
  });

  it("取れなかったときは、0 件として見せない", async () => {
    const broken = deps({
      accounts: { ...testDeps().affiliateAccounts, list: async () => failing() },
    });

    const listed = await createListAffiliateAccountsUseCase(broken).execute(owner, {});
    // 0 件と「取れなかった」は別。混ぜると、壊れていることに気づけない。
    expect(listed.ok).toBe(false);
  });

  it("売上を見る権限が無ければ、一覧そのものを返さない", async () => {
    const listed = await createListAffiliateAccountsUseCase(deps()).execute(nobody, {});

    expect(listed.ok).toBe(false);
    if (listed.ok) return;
    expect(listed.error.code).toBe("FORBIDDEN");
  });
});

describe("提携条件の一覧", () => {
  it("承認率が取れていない提携は「未取得」と出す", async () => {
    const listed = await createListAffiliateProgramsUseCase(deps()).execute(owner, {});
    if (!listed.ok) throw new Error(listed.error.message);

    const labels = listed.value.items.map((p) => p.approvalRateLabel);
    // 0% と未取得を混ぜると、承認されない提携に見えて外してしまう。
    expect(labels).toContain("未取得");
    expect(labels.some((l) => /^\d+%$/.test(l))).toBe(true);
  });

  it("人が読んで確かめる掲載条件を、件数つきで返す", async () => {
    const listed = await createListAffiliateProgramsUseCase(deps()).execute(owner, {});
    if (!listed.ok) throw new Error(listed.error.message);

    const counted = listed.value.items.reduce((n, p) => n + p.restrictions.length, 0);
    // 機械で判定できない条件を、件数だけでも見えるところに出す。
    expect(listed.value.restrictionCount).toBe(counted);
    expect(listed.value.restrictionCount).toBeGreaterThan(0);
  });

  it("1 件も無いときは、その理由を書く", async () => {
    const empty = deps({
      programs: {
        ...testDeps().affiliatePrograms,
        list: async () => ({ ok: true as const, value: { items: [], nextCursor: null } }),
      },
    });

    const listed = await createListAffiliateProgramsUseCase(empty).execute(owner, {});
    if (!listed.ok) throw new Error(listed.error.message);

    expect(listed.value.total).toBe(0);
    expect(listed.value.emptyReason).toContain("提携");
  });

  it("取れなかったときは、0 件として見せない", async () => {
    const broken = deps({
      programs: { ...testDeps().affiliatePrograms, list: async () => failing() },
    });

    expect((await createListAffiliateProgramsUseCase(broken).execute(owner, {})).ok).toBe(false);
  });
});

describe("成果の一覧", () => {
  it("確定した分だけを合計する", async () => {
    const listed = await createListConversionsUseCase(deps()).execute(owner, { period: "2026-08" });
    if (!listed.ok) throw new Error(listed.error.message);

    // 未確定を足すと、入ってこない金額を見込みにしてしまう。
    expect(listed.value.approvedTotalLabel).toContain("1,200");
    expect(listed.value.approvedTotalLabel).not.toContain("3,600");
    expect(listed.value.pendingCount).toBeGreaterThan(0);
  });

  it("金額が取れていない成果を、0 円として合計に混ぜない", async () => {
    const listed = await createListConversionsUseCase(deps()).execute(owner, { period: "2026-08" });
    if (!listed.ok) throw new Error(listed.error.message);

    const unknown = listed.value.items.find((c) => c.ingestedLabel === "未取得");
    expect(unknown).toBeDefined();
    expect(unknown?.effectiveLabel).toBe("未取得");
  });

  it("手で直した成果は、取り込んだ値も残したまま返す", async () => {
    const listed = await createListConversionsUseCase(deps()).execute(owner, { period: "2026-07" });
    if (!listed.ok) throw new Error(listed.error.message);

    const fixed = listed.value.items.find((c) => c.adjustedLabel !== null);
    expect(fixed).toBeDefined();
    // 上書きすると、次の取り込みとの差が出せず、誤りに気づけない。
    expect(fixed?.ingestedLabel).toContain("1,000");
    expect(fixed?.adjustedLabel).toContain("900");
    expect(fixed?.effectiveLabel).toContain("900");
    expect(fixed?.adjustmentReason?.trim()).not.toBe("");
    expect(listed.value.closed).toBe(true);
  });

  it("状態は記号ではなく日本語で返す", async () => {
    const listed = await createListConversionsUseCase(deps()).execute(owner, { period: "2026-08" });
    if (!listed.ok) throw new Error(listed.error.message);

    for (const item of listed.value.items) {
      expect(Object.values(CONVERSION_STATUS_LABEL)).toContain(item.statusLabel);
    }
  });

  it("成果がまだ無い期間は、その期間を書いて伝える", async () => {
    const listed = await createListConversionsUseCase(deps()).execute(owner, { period: "2026-01" });
    if (!listed.ok) throw new Error(listed.error.message);

    expect(listed.value.total).toBe(0);
    expect(listed.value.emptyReason).toContain("2026-01");
    expect(listed.value.closed).toBe(false);
  });

  it("取れなかったときは、0 件として見せない", async () => {
    const broken = deps({ conversions: conversionsThatFail({ listByPeriod: async () => failing() }) });

    expect(
      (await createListConversionsUseCase(broken).execute(owner, { period: "2026-08" })).ok,
    ).toBe(false);
  });
});

describe("成果 1 件", () => {
  it("広告主の名前を添えて返す", async () => {
    const got = await createGetConversionUseCase(deps()).execute(owner, {
      conversionId: "cv_2026_08_a",
    });
    if (!got.ok) throw new Error(got.error.message);

    expect(got.value.advertiserName).toContain("Amazon");
    expect(got.value.adjustable).toBe(true);
    expect(got.value.notAdjustableReason).toBeNull();
  });

  it("締め済みの期間は、直せない理由を添えて直させない", async () => {
    const got = await createGetConversionUseCase(deps()).execute(owner, {
      conversionId: "cv_2026_07_a",
    });
    if (!got.ok) throw new Error(got.error.message);

    expect(got.value.adjustable).toBe(false);
    // 「押せない」だけでは、壊れているのか決まりなのか分からない。
    expect(got.value.notAdjustableReason).toContain("締めている");
    expect(got.value.notAdjustableReason).toContain("次の期間");
  });

  it("権限が足りないときも、直せない理由が権限だと分かる", async () => {
    const got = await createGetConversionUseCase(deps()).execute(analyst, {
      conversionId: "cv_2026_08_a",
    });
    if (!got.ok) throw new Error(got.error.message);

    expect(got.value.adjustable).toBe(false);
    expect(got.value.notAdjustableReason).toContain("担当者");
  });

  it("広告主が引けなくても、成果そのものは見せる", async () => {
    const partial = deps({
      programs: { ...testDeps().affiliatePrograms, findById: async () => ({ ok: true as const, value: null }) },
    });

    const got = await createGetConversionUseCase(partial).execute(owner, {
      conversionId: "cv_2026_08_a",
    });
    if (!got.ok) throw new Error(got.error.message);

    // 名前が引けないことと、成果が無いことは別。
    expect(got.value.advertiserName).toBe("未取得");
    expect(got.value.view.conversionId).toBe("cv_2026_08_a");
  });

  it("居ない成果は、期間の選び直しを促して断る", async () => {
    const got = await createGetConversionUseCase(deps()).execute(owner, {
      conversionId: "cv_missing",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.suggestedAction).toContain("期間");
  });

  it("読み出しに失敗したときと、見つからないときを分ける", async () => {
    const broken = deps({ conversions: conversionsThatFail({ findById: async () => failing() }) });

    const got = await createGetConversionUseCase(broken).execute(owner, {
      conversionId: "cv_2026_08_a",
    });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    // 取れなかったのに「ありません」と言うと、消えたと誤解される。
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("広告主が引けない障害は、そのまま伝える", async () => {
    const broken = deps({
      programs: { ...testDeps().affiliatePrograms, findById: async () => failing() },
    });

    expect(
      (await createGetConversionUseCase(broken).execute(owner, { conversionId: "cv_2026_08_a" })).ok,
    ).toBe(false);
  });
});

describe("成果の手修正", () => {
  it("取り込んだ値を残したまま、直した値と理由を記録する", async () => {
    /*
      保存先は★仮置き（スタブ）で、書き込みは NOT_IMPLEMENTED を返す。
      そこで**保存だけ**を、渡されたものをそのまま返す形に差し替える。
      「保存できない」ことは別のテストで確かめてあるので、
      ここで見たいのは**保存へ渡る中身**——取り込んだ値が消えていないか——だけになる。
    */
    const saving = deps({
      conversions: conversionsThatFail({
        save: async (c: unknown) => ({ ok: true as const, value: c }),
      }),
    });

    const adjusted = await createAdjustConversionUseCase(saving).execute(owner, {
      conversionId: "cv_2026_08_b",
      amountMinor: 2000,
      currency: "JPY",
      reason: "ASP の確定連絡に合わせて訂正しました。",
    });
    if (!adjusted.ok) throw new Error(adjusted.error.message);

    expect(adjusted.value.view.ingestedLabel).toContain("2,400");
    expect(adjusted.value.view.adjustedLabel).toContain("2,000");
    expect(adjusted.value.view.effectiveLabel).toContain("2,000");
    expect(adjusted.value.view.adjustmentReason).toContain("確定連絡");
  });

  it("締めた期間は直せない", async () => {
    const adjusted = await createAdjustConversionUseCase(deps()).execute(owner, {
      conversionId: "cv_2026_07_a",
      amountMinor: 1,
      currency: "JPY",
      reason: "訂正",
    });

    expect(adjusted.ok).toBe(false);
    if (adjusted.ok) return;
    // 締めた後に動くと、提出済みの報告と食い違う。
    expect(adjusted.error.code).toBe("CONFLICT");
    expect(adjusted.error.suggestedAction).toContain("次の期間");
  });

  it("金額として成り立たない値は受け取らない", async () => {
    const adjusted = await createAdjustConversionUseCase(deps()).execute(owner, {
      conversionId: "cv_2026_08_b",
      amountMinor: -1,
      currency: "JPY",
      reason: "誤入力",
    });

    expect(adjusted.ok).toBe(false);
  });

  it("理由が無ければ直させない", async () => {
    const adjusted = await createAdjustConversionUseCase(deps()).execute(owner, {
      conversionId: "cv_2026_08_b",
      amountMinor: 2000,
      currency: "JPY",
      reason: "   ",
    });

    // 後から見て「なぜこの数字なのか」が分からない記録は、無いのと同じ。
    expect(adjusted.ok).toBe(false);
  });

  it("居ない成果は直せない", async () => {
    const adjusted = await createAdjustConversionUseCase(deps()).execute(owner, {
      conversionId: "cv_missing",
      amountMinor: 100,
      currency: "JPY",
      reason: "訂正します。",
    });

    expect(adjusted.ok).toBe(false);
    if (adjusted.ok) return;
    expect(adjusted.error.code).toBe("NOT_FOUND");
  });

  it("保存に失敗したら、直せたことにしない", async () => {
    const broken = deps({ conversions: conversionsThatFail({ save: async () => failing() }) });

    const adjusted = await createAdjustConversionUseCase(broken).execute(owner, {
      conversionId: "cv_2026_08_b",
      amountMinor: 2000,
      currency: "JPY",
      reason: "ASP の確定連絡に合わせて訂正しました。",
    });
    expect(adjusted.ok).toBe(false);
  });

  it("読む権限だけの人は直せない", async () => {
    const adjusted = await createAdjustConversionUseCase(deps()).execute(analyst, {
      conversionId: "cv_2026_08_b",
      amountMinor: 2000,
      currency: "JPY",
      reason: "訂正します。",
    });

    expect(adjusted.ok).toBe(false);
    if (adjusted.ok) return;
    expect(adjusted.error.code).toBe("FORBIDDEN");
  });
});

/**
 * 金額を手で直したことの記録。
 *
 * 数字は見ただけでは書き換わったことに気づけない。締めの報告に使われた後で
 * 「誰がいつ、いくらから、いくらに、なぜ直したか」を答えられないと、
 * ASP 側の誤りだったのか自分の入力ミスだったのかを切り分けられない。
 */
describe("金額を手で直したことの記録", () => {
  /** 保存だけ通す。ここで見たいのは記録の中身で、保存の可否は別のテストで見ている。 */
  function recordable(): {
    readonly deps: ManageAffiliateDeps;
    readonly audit: ReturnType<typeof recordingAuditLog>;
  } {
    const audit = recordingAuditLog();
    return {
      deps: deps({
        conversions: conversionsThatFail({
          save: async (c: unknown) => ({ ok: true as const, value: c }),
        }),
        auditLog: audit.port,
      }),
      audit,
    };
  }

  it("誰が・いくらから・いくらに・なぜ直したかが残る", async () => {
    const { deps: d, audit } = recordable();
    const done = await createAdjustConversionUseCase(d).execute(owner, {
      conversionId: "cv_2026_08_b",
      amountMinor: 2000,
      currency: "JPY",
      reason: "ASP の確定連絡に合わせて訂正しました。",
    });
    if (!done.ok) throw new Error(done.error.message);

    const entries = audit.entries();
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry?.action).toBe("conversion.adjusted");
    expect(entry?.targetId).toBe("cv_2026_08_b");
    expect(String(entry?.actor.userId)).toBe(owner.userId);
    // 直す前の額が入っていないと、差がいくらだったかを後から出せない。
    expect(entry?.before).toMatchObject({ amountMinor: 2400, currency: "JPY" });
    expect(entry?.after).toMatchObject({ amountMinor: 2000, currency: "JPY" });
    expect(entry?.reason).toContain("確定連絡");
  });

  it("記録を残せなかったときは、直せたこととして返さない", async () => {
    const d = deps({
      conversions: conversionsThatFail({
        save: async (c: unknown) => ({ ok: true as const, value: c }),
      }),
      auditLog: { ...recordingAuditLog().port, append: async () => failing("記録できません。") },
    });

    const done = await createAdjustConversionUseCase(d).execute(owner, {
      conversionId: "cv_2026_08_b",
      amountMinor: 2000,
      currency: "JPY",
      reason: "ASP の確定連絡に合わせて訂正しました。",
    });

    expect(done.ok).toBe(false);
    if (done.ok) return;
    // 金額はもう直っている。それを隠すと、押した人がもう一度直しにいく。
    expect(done.error.message).toContain("2,000");
    expect(done.error.message).toContain("記録");
  });

  it("保存に失敗したときは、記録も残さない", async () => {
    const audit = recordingAuditLog();
    const d = deps({
      conversions: conversionsThatFail({ save: async () => failing() }),
      auditLog: audit.port,
    });

    const done = await createAdjustConversionUseCase(d).execute(owner, {
      conversionId: "cv_2026_08_b",
      amountMinor: 2000,
      currency: "JPY",
      reason: "訂正します。",
    });

    expect(done.ok).toBe(false);
    // 直っていない金額の「直した」が残ると、記録のほうが信じられなくなる。
    expect(audit.entries()).toHaveLength(0);
  });
});

describe("商品につながる提携リンク", () => {
  it("URL を 1 文字も変えずに返す", async () => {
    const listed = await createListProductLinksUseCase(deps()).execute(owner, {
      productId: "p_alpha_15",
    });
    if (!listed.ok) throw new Error(listed.error.message);

    expect(listed.value.items.length).toBeGreaterThan(0);
    for (const link of listed.value.items) {
      // 計測用の印を足すと、多くの提携先で規約違反になり成果が付かなくなる。
      expect(link.url).not.toContain("utm_");
      expect(link.url).not.toContain("?ref=");
    }
  });

  it("期限切れのリンクには、作り直しを促す理由が付く", async () => {
    const listed = await createListProductLinksUseCase(deps()).execute(owner, {
      productId: "p_alpha_15",
    });
    if (!listed.ok) throw new Error(listed.error.message);

    const expired = listed.value.items.find((l) => !l.usable);
    expect(expired?.blockedReason).toContain("作り直して");

    const alive = listed.value.items.find((l) => l.usable);
    expect(alive?.blockedReason).toBeNull();
  });

  it("リンクが 1 本も無い商品は、その理由を書く", async () => {
    const listed = await createListProductLinksUseCase(deps()).execute(owner, {
      productId: "p_no_links",
    });
    if (!listed.ok) throw new Error(listed.error.message);

    expect(listed.value.items).toHaveLength(0);
    expect(listed.value.emptyReason).toContain("提携リンク");
  });

  it("取れなかったときは、0 件として見せない", async () => {
    const broken = deps({
      links: markCommercial({
        ...testDeps().affiliateLinks,
        listByProduct: async () => failing(),
      }) as ManageAffiliateDeps["links"],
    });

    expect(
      (await createListProductLinksUseCase(broken).execute(owner, { productId: "p_alpha_15" })).ok,
    ).toBe(false);
  });

  it("売上を見る権限が無ければ、リンクも見せない", async () => {
    const listed = await createListProductLinksUseCase(deps()).execute(nobody, {
      productId: "p_alpha_15",
    });

    expect(listed.ok).toBe(false);
  });
});
