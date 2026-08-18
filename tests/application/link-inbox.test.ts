/**
 * @tier 1
 * @req REQ-P02, REQ-S02
 * @types audit-log, state-transition, permission-matrix
 *
 * 印が無かった理由は「書き忘れ」ではなく、**このファイルが要件から書かれていない**
 * ように見えたからである。中身を読むと、受信箱の 4 状態（`received` / `resolved` /
 * `matched` / `rejected`）と、その遷移が誰の手で起きたかの記録を、
 * どちらも実際に見ている。名乗っていなかっただけで、要件の充足としては
 * 1 件も数えられていなかった。
 */
import { describe, expect, it } from "vitest";
import {
  createListLinkInboxUseCase,
  createMatchLinkIngestionUseCase,
  createRejectLinkIngestionUseCase,
  createResolveLinkIngestionUseCase,
  createSubmitAffiliateUrlUseCase,
  filterLabel,
  type ManageLinkInboxDeps,
} from "@/application/usecases/monetization/manage-link-inbox";
import type { WorkspaceId } from "@/domain/shared";
import { markCommercial } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anAnalyst, anOwner } from "../support/actors";
import { failing, recordingAuditLog, recordingEvents, testDeps } from "../support/doubles";

/**
 * 成果リンクの受信箱。
 *
 * --- ここで固定したいこと ---
 * 受信箱は「貼り付けたものが、記事に出るまでの唯一の道」である。
 * 途中を飛ばせてしまうと、提携が終わったときに**外すべきリンクを特定できない**。
 * だから確かめるのは通る道より、**通れない道**の方が多い。
 *
 * 権限・重複・状態の飛ばしは、いずれも画面からは見えない場所で守られている。
 * 画面側に同じ判断を書くと、片方だけ直したときに素通りする穴ができる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2（ユースケースの単体テスト）
 */

function deps(over: Partial<ManageLinkInboxDeps> = {}): ManageLinkInboxDeps {
  const base = testDeps();
  return {
    inbox: base.linkInbox,
    programs: base.affiliatePrograms,
    ids: base.ids,
    events: base.events,
    auditLog: recordingAuditLog().port,
    now: () => new Date(),
    ...over,
  };
}

/** 記録まで読み返したいときの組み立て。誰が何をしたかを後から数える。 */
function recordable(over: Partial<ManageLinkInboxDeps> = {}): ManageLinkInboxDeps & {
  readonly audit: ReturnType<typeof recordingAuditLog>;
} {
  const audit = recordingAuditLog();
  return { ...deps({ auditLog: audit.port, ...over }), audit };
}

/** 見本の受信箱を土台に、指定の操作だけ失敗させる。商業の印は付け直す。 */
function inboxThatFails(over: Record<string, unknown>): ManageLinkInboxDeps["inbox"] {
  return markCommercial({
    ...testDeps().linkInbox,
    ...over,
  }) as ManageLinkInboxDeps["inbox"];
}

/** 貼り付けるたびに違う URL を作る。見本の受信箱は動いている間ずっと溜まるため。 */
let serial = 0;
function freshUrl(): string {
  serial += 1;
  return `https://example.invalid/asp/test/case-${serial}-${Date.now()}`;
}

/**
 * 受信箱を扱えるのは、提携の管理権限を持つ人だけ。
 * 既定の実行主体（見本のログイン）では入れられないことは、権限の節で別に確かめる。
 *
 * 作業場所を見本のものに合わせているのは、**提携先が作業場所ごとに分かれている**ため。
 * 別の作業場所から見本の広告主は引けない。ここを合わせずに書くと、
 * 分離が効いているせいの失敗を「機能が壊れている」と読み違える。
 */
const actor = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId });

describe("つなぎ目の印", () => {
  it("商業の印が付いていないつなぎ目では、そもそも組み立てられない", () => {
    // 印を落としたまま動くと、報酬額が順位づけ側へ渡る道が開く。
    // 動いてから気づくのでは遅いので、組み立ての時点で止める。
    const naked = { ...testDeps().linkInbox } as ManageLinkInboxDeps["inbox"];
    expect(() => createListLinkInboxUseCase(deps({ inbox: naked }))).toThrow(/商業データの印/);
  });
});

describe("受け取り", () => {
  it("受け取ると、次にすることが文で返る", async () => {
    const result = await createSubmitAffiliateUrlUseCase(deps()).execute(actor, {
      url: freshUrl(),
      source: "paste",
      note: "確認用",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.duplicate).toBe(false);
    expect(result.value.message).toContain("広告主");
    expect(result.value.item.state).toBe("received");
    // 状態の英字をそのまま画面へ出さない。
    expect(result.value.item.stateLabel).not.toBe("received");
    expect(result.value.item.nextStates).toEqual(["resolved", "rejected"]);
  });

  it("同じリンクは消さずに受け取り、重なっていることを知らせる", async () => {
    const url = freshUrl();
    const submit = createSubmitAffiliateUrlUseCase(deps());
    await submit.execute(actor, { url, source: "paste" });
    const again = await submit.execute(actor, { url, source: "csv" });

    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // 黙って捨てると「入れたのに無い」になる。入れたうえで知らせる。
    expect(again.value.duplicate).toBe(true);
    expect(again.value.item.duplicateOf).not.toBeNull();
    expect(again.value.message).toContain("消していません");
  });

  it("並び替えの目印が違うだけの URL は、同じものとして重なりを見つける", async () => {
    const url = freshUrl();
    const submit = createSubmitAffiliateUrlUseCase(deps());
    await submit.execute(actor, { url, source: "paste" });
    const tracked = await submit.execute(actor, {
      url: `${url}?utm_source=slack&utm_medium=chat`,
      source: "paste",
    });

    expect(tracked.ok).toBe(true);
    if (!tracked.ok) return;
    expect(tracked.value.duplicate).toBe(true);
  });

  it("URL として読めないものは受け取らない", async () => {
    const result = await createSubmitAffiliateUrlUseCase(deps()).execute(actor, {
      url: "これはURLではない",
      source: "paste",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("url");
  });

  it("内部あて・別方式の URL は受け取らない", async () => {
    const submit = createSubmitAffiliateUrlUseCase(deps());
    const internal = await submit.execute(actor, {
      url: "http://localhost:8788/admin",
      source: "paste",
    });
    const scheme = await submit.execute(actor, {
      url: "javascript:alert(1)",
      source: "paste",
    });

    expect(internal.ok).toBe(false);
    expect(scheme.ok).toBe(false);
    if (internal.ok || scheme.ok) return;
    // 受け取れない理由を、直し方まで含めて返す。
    expect(internal.error.suggestedAction).toBeTruthy();
    expect(scheme.error.suggestedAction).toBeTruthy();
  });

  it("重なりを調べられないときは、受け取ったことにしない", async () => {
    const result = await createSubmitAffiliateUrlUseCase(
      deps({ inbox: inboxThatFails({ findByNormalizedUrl: async () => failing() }) }),
    ).execute(actor, { url: freshUrl(), source: "paste" });

    // 調べられないまま受け取ると、重複したまま記事に 2 本並ぶ。
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("保存できないときは、成功したことにしない", async () => {
    const result = await createSubmitAffiliateUrlUseCase(
      deps({ inbox: inboxThatFails({ save: async () => failing() }) }),
    ).execute(actor, { url: freshUrl(), source: "paste" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message.trim()).not.toBe("");
  });

  it("受け取ったことは、出来事として流れる", async () => {
    const events = recordingEvents();
    const result = await createSubmitAffiliateUrlUseCase(
      deps({ events: events.port as ManageLinkInboxDeps["events"] }),
    ).execute(actor, { url: freshUrl(), source: "paste" });

    expect(result.ok).toBe(true);
    expect(events.names()).toContain("affiliate_url.submitted");
  });

});

describe("広告主を決める・商品に結びつける", () => {
  async function received(): Promise<string> {
    const created = await createSubmitAffiliateUrlUseCase(deps()).execute(actor, {
      url: freshUrl(),
      source: "paste",
    });
    if (!created.ok) throw new Error(created.error.message);
    return created.value.item.id;
  }

  it("広告主を決めると、表示名まで付いて返る", async () => {
    const id = await received();
    const result = await createResolveLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: id,
      programId: "prg_rakuten_pc",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe("resolved");
    // ID を画面へ出さない。誰との提携かが分からないと確認できない。
    expect(result.value.programLabel).toContain("（");
    expect(result.value.nextStates).toEqual(["matched", "rejected"]);
  });

  it("居ないリンク・居ない広告主は、見つからないと分かる誤りになる", async () => {
    const resolve = createResolveLinkIngestionUseCase(deps());
    const noLink = await resolve.execute(actor, {
      linkIngestionId: "li_does_not_exist",
      programId: "prg_rakuten_pc",
    });
    const noProgram = await resolve.execute(actor, {
      linkIngestionId: await received(),
      programId: "prg_does_not_exist",
    });

    expect(noLink.ok).toBe(false);
    expect(noProgram.ok).toBe(false);
    if (noLink.ok || noProgram.ok) return;
    expect(noLink.error.message).toContain("li_does_not_exist");
    expect(noProgram.error.message).toContain("prg_does_not_exist");
  });

  it("広告主が分からないまま商品へ結びつけられない", async () => {
    const result = await createMatchLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: await received(),
      productId: "p_alpha_15",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 提携が終わったときに外すべきリンクを特定できなくなる。
    expect(result.error.code).toBe("INVARIANT_VIOLATED");
    expect(result.error.suggestedAction).toContain("広告主");
  });

  it("広告主が決まっていれば、商品に結びつく", async () => {
    const id = await received();
    await createResolveLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: id,
      programId: "prg_rakuten_pc",
    });
    const result = await createMatchLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: id,
      productId: "p_alpha_15",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe("p_alpha_15");
    expect(result.value.nextStates).toEqual(["rejected"]);
  });

  it("結びつける相手のリンクが居なければ、そこで止まる", async () => {
    const result = await createMatchLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: "li_does_not_exist",
      productId: "p_alpha_15",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("受信箱");
  });

  it("読み出せない・保存できないときは、進んだことにしない", async () => {
    const cannotRead = await createResolveLinkIngestionUseCase(
      deps({ inbox: inboxThatFails({ findById: async () => failing() }) }),
    ).execute(actor, { linkIngestionId: "li_received_1", programId: "prg_rakuten_pc" });

    const id = await received();
    await createResolveLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: id,
      programId: "prg_rakuten_pc",
    });
    const cannotSave = await createMatchLinkIngestionUseCase(
      deps({ inbox: inboxThatFails({ save: async () => failing() }) }),
    ).execute(actor, { linkIngestionId: id, productId: "p_alpha_15" });

    expect(cannotRead.ok).toBe(false);
    expect(cannotSave.ok).toBe(false);
    if (cannotRead.ok || cannotSave.ok) return;
    expect(cannotRead.error.code).toBe("NOT_IMPLEMENTED");
    expect(cannotSave.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("広告主の一覧が引けないときも、リンクの確定自体は止めない", async () => {
    const result = await createResolveLinkIngestionUseCase(
      deps({
        programs: {
          ...testDeps().affiliatePrograms,
          list: async () => failing(),
        } as ManageLinkInboxDeps["programs"],
      }),
    ).execute(actor, { linkIngestionId: await received(), programId: "prg_rakuten_pc" });

    // 一覧は表示名を作るためだけのもの。引けないことを理由に操作を落とさない。
    expect(result.ok).toBe(true);
  });
});

describe("対象外にする", () => {
  async function anId(): Promise<string> {
    const created = await createSubmitAffiliateUrlUseCase(deps()).execute(actor, {
      url: freshUrl(),
      source: "paste",
    });
    if (!created.ok) throw new Error(created.error.message);
    return created.value.item.id;
  }

  it("理由が空のままでは対象外にできない", async () => {
    const result = await createRejectLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: await anId(),
      reason: "   ",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 理由の無い「対象外」は、後から見ても判断をやり直せない。
    expect(result.error.field).toBe("reason");
  });

  it("対象外にすると理由が残り、次にできることは無くなる", async () => {
    const id = await anId();
    const result = await createRejectLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: id,
      reason: "提携が終了しているため。",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rejectedReason).toBe("提携が終了しているため。");
    expect(result.value.nextStates).toEqual([]);
  });

  it("対象外にしたものは、そのままでは先へ進められない", async () => {
    const id = await anId();
    await createRejectLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: id,
      reason: "提携が終了しているため。",
    });
    const result = await createResolveLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: id,
      programId: "prg_rakuten_pc",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.suggestedAction).toContain("入れ直");
  });

  it("居ないリンクは対象外にもできない", async () => {
    const result = await createRejectLinkIngestionUseCase(deps()).execute(actor, {
      linkIngestionId: "li_does_not_exist",
      reason: "重複のため。",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("li_does_not_exist");
  });
});

describe("一覧", () => {
  it("状態ごとの件数と、重なりの数を一覧側で数える", async () => {
    const result = await createListLinkInboxUseCase(deps()).execute(actor, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 画面に数え方を書かせない。書くと画面ごとに数え方がずれる。
    expect(result.value.total).toBe(result.value.items.length);
    expect(Object.keys(result.value.countsByState).sort()).toEqual([
      "matched",
      "received",
      "rejected",
      "resolved",
    ]);
    expect(result.value.duplicateCount).toBe(
      result.value.items.filter((i) => i.duplicateOf !== null).length,
    );
    expect(result.value.emptyReason).toBeNull();
  });

  it("絞り込みで 1 件も無いときは、何が無いのかを名指しで返す", async () => {
    const result = await createListLinkInboxUseCase(
      deps({ inbox: inboxThatFails({ list: async () => ({ ok: true, value: { items: [], nextCursor: null } }) }) }),
    ).execute(actor, { state: "matched" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toContain(filterLabel("matched"));
  });

  it("受信箱がまるごと空のときは、使い始め方を返す", async () => {
    const result = await createListLinkInboxUseCase(
      deps({ inbox: inboxThatFails({ list: async () => ({ ok: true, value: { items: [], nextCursor: null } }) }) }),
    ).execute(actor, { state: "all" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toContain("貼り付ける");
  });

  it("読み出せないときは、空の一覧として見せない", async () => {
    const result = await createListLinkInboxUseCase(
      deps({ inbox: inboxThatFails({ list: async () => failing() }) }),
    ).execute(actor, {});

    // 0 件と「取れなかった」は別。混ぜると、壊れていることに気づけない。
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("絞り込みの表示名は、すべてを含めて言葉になっている", () => {
    expect(filterLabel("all")).toBe("すべて");
    expect(filterLabel("received")).not.toBe("received");
  });
});

/**
 * 誰がリンクを進めたかの記録。
 *
 * --- なぜ出来事とは別に要るのか ---
 * 出来事（`events`）は受け手に知らせるためのもので、受け手がいなければ
 * 流れなくてよい。実際「対象外にする」は 1 つも流していない。
 * つまり記録が無いと、**捨てた操作だけ跡が 1 つも残らない**。
 *
 * リンク 1 本は「受け取り → 広告主 → 商品」と進み、最後は記事に出る。
 * 提携が終わったときに外すのも、報酬の宛先を直すのも、
 * 「誰がいつそう決めたか」を辿れることが前提になる。
 */
describe("誰が進めたかの記録", () => {
  it("受け取りは、行き先のホストと重なりの有無まで残る", async () => {
    const d = recordable();
    const url = freshUrl();
    const result = await createSubmitAffiliateUrlUseCase(d).execute(actor, { url, source: "paste" });
    expect(result.ok).toBe(true);

    const entry = d.audit.entries().at(-1);
    expect(entry?.action).toBe("affiliate_link.created");
    expect(entry?.targetType).toBe("link_ingestion");
    expect(entry?.after).toMatchObject({ host: "example.invalid", state: "received" });
  });

  it("受け取りの記録に、貼り付けられた URL そのものは入らない", async () => {
    const d = recordable();
    const url = freshUrl();
    await createSubmitAffiliateUrlUseCase(d).execute(actor, { url, source: "paste" });

    /*
     * 成果リンクの URL には、成果の割り当て先を示す文字列が入っている。
     * 記録は後から広く読まれる場所なので、行き先のホスト名までにとどめる。
     */
    expect(JSON.stringify(d.audit.entries())).not.toContain(url);
  });

  it("広告主を決め直したときは、どこから変えたかが残る", async () => {
    const d = recordable();
    const created = await createSubmitAffiliateUrlUseCase(d).execute(actor, {
      url: freshUrl(),
      source: "paste",
    });
    if (!created.ok) throw new Error(created.error.message);

    const resolve = createResolveLinkIngestionUseCase(d);
    await resolve.execute(actor, {
      linkIngestionId: created.value.item.id,
      programId: "prg_rakuten_pc",
    });
    await resolve.execute(actor, {
      linkIngestionId: created.value.item.id,
      programId: "prg_amazon_pc",
    });

    // 2 回目の `before` が null だと、取り違えを直すときに元の宛先が分からない。
    const entry = d.audit.entries().at(-1);
    expect(entry?.before).toMatchObject({ programId: "prg_rakuten_pc" });
    expect(entry?.after).toMatchObject({ programId: "prg_amazon_pc" });
  });

  it("対象外にしたときは、理由まで記録に残る", async () => {
    const d = recordable();
    const created = await createSubmitAffiliateUrlUseCase(d).execute(actor, {
      url: freshUrl(),
      source: "paste",
    });
    if (!created.ok) throw new Error(created.error.message);

    await createRejectLinkIngestionUseCase(d).execute(actor, {
      linkIngestionId: created.value.item.id,
      reason: "提携が終了しているため。",
    });

    const entry = d.audit.entries().at(-1);
    expect(entry?.action).toBe("affiliate_link.rejected");
    expect(entry?.reason).toBe("提携が終了しているため。");
  });

  it("記録を残せなかったときは、どの操作も成功として返さない", async () => {
    const url = freshUrl();
    const broken = {
      auditLog: {
        ...recordingAuditLog().port,
        append: async () => failing<never>("記録の保存先が落ちています"),
      },
    };

    const created = await createSubmitAffiliateUrlUseCase(deps(broken)).execute(actor, {
      url,
      source: "paste",
    });
    expect(created.ok).toBe(false);
    // 済んだこと（もう受信箱にある）を隠すと、貼った人はもう一度貼る。
    if (!created.ok) expect(created.error.message).toContain("受信箱に入っています");

    // 受け取り自体は効いている。断り文はそれと食い違ってはいけない。
    const listed = await createListLinkInboxUseCase(deps()).execute(actor, { state: "all" });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.items.some((i) => i.submittedUrl === url)).toBe(true);
  });
});

describe("権限", () => {
  it("権限が無い人は、受信箱を見ることも入れることもできない", async () => {
    const nobody = aNobody({ workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId });
    const list = await createListLinkInboxUseCase(deps()).execute(nobody, {});
    const submit = await createSubmitAffiliateUrlUseCase(deps()).execute(nobody, {
      url: freshUrl(),
      source: "paste",
    });

    expect(list.ok).toBe(false);
    expect(submit.ok).toBe(false);
    if (list.ok || submit.ok) return;
    // 何をしようとして断られたのかが分からないと、権限の申請もできない。
    expect(list.error.message).toContain("受信箱");
    expect(submit.error.message.trim()).not.toBe("");
  });

  it("数字を見るだけの人は、見られるが動かせない", async () => {
    const analyst = anAnalyst({ workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId });
    const list = await createListLinkInboxUseCase(deps()).execute(analyst, {});
    const reject = await createRejectLinkIngestionUseCase(deps()).execute(analyst, {
      linkIngestionId: "li_received_1",
      reason: "重複のため。",
    });

    // 見る権限と変える権限を分けていないと、分析の役割が編集までできてしまう。
    expect(list.ok).toBe(true);
    expect(reject.ok).toBe(false);
  });
});
