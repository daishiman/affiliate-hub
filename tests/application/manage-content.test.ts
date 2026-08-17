import { describe, expect, it } from "vitest";
import {
  CONTENT_STATE_LABEL,
  type ManageContentDeps,
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createGetContentUseCase,
  createListContentBoardUseCase,
  createListReviewOverdueUseCase,
} from "@/application/usecases/content/manage-content";
import { CONTENT_STATES, type ContentVariant } from "@/domain/authoring";
import type { WorkspaceId } from "@/domain/shared";
import { markCommercial, markEditorial, ok } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anAiAccount, anAnalyst, anOutsider, anOwner, aWriter } from "../support/actors";
import { failing, recordingEvents, testDeps } from "../support/doubles";

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
const writer = aWriter({ workspaceId: WS });
const analyst = anAnalyst({ workspaceId: WS });
const aiAccount = anAiAccount({ workspaceId: WS });
const nobody = aNobody({ workspaceId: WS });

/** 見本の記事。合格する側と、わざと欠陥を入れてある側。 */
const REVIEWABLE = "cv_alpha_review";
const FAILING_DRAFT = "cv_alpha_draft";
const SHORT_POST = "cv_beta_short";
const APPROVED_POST = "cv_alpha_approved";

function deps(over: Partial<ManageContentDeps> = {}): ManageContentDeps {
  const base = testDeps();
  return {
    packages: base.contentPackages,
    variants: base.contentVariants,
    personas: base.personas,
    events: base.events,
    ...over,
  };
}

/** 見本の記事置き場を土台に、指定の操作だけ差し替える。編集側の印は付け直す。 */
function variantsWith(over: Record<string, unknown>): ManageContentDeps["variants"] {
  return markEditorial({ ...testDeps().contentVariants, ...over }) as ManageContentDeps["variants"];
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

  it("権限が無い人には記事の中身を返さない", async () => {
    const got = await createGetContentUseCase(deps()).execute(nobody, { variantId: REVIEWABLE });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("見直しの時期が来たもの", () => {
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
    expect(asked).toBe(20);
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
  it("決められた順路は通れて、進んだ先が読める言葉で返る", async () => {
    const got = await createAdvanceContentStateUseCase(deps()).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "GENERATED",
      to: "FACT_CHECK",
    });
    if (!got.ok) throw got.error;

    expect(got.value.state).toBe("FACT_CHECK");
    expect(got.value.label).toBe("事実確認中");
    expect(got.value.variantId).toBe(FAILING_DRAFT);
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
    const got = await createAdvanceContentStateUseCase(deps()).execute(aiAccount, {
      variantId: FAILING_DRAFT,
      from: "BRIEF_READY",
      to: "GENERATED",
    });
    if (!got.ok) throw got.error;

    expect(got.value.state).toBe("GENERATED");
  });

  it("下書きができたことは、他の仕組みが受け取れる出来事として出る", async () => {
    const events = recordingEvents();
    const got = await createAdvanceContentStateUseCase(deps({ events: events.port })).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "BRIEF_READY",
      to: "GENERATED",
    });

    expect(got.ok).toBe(true);
    expect(events.names()).toContain("content_variant.generated");
    const payload = events.published()[0]?.payload as { variantId?: string };
    expect(payload.variantId).toBe(FAILING_DRAFT);
  });

  it("見直しの時期に入ったことも、出来事として出る", async () => {
    const events = recordingEvents();
    const got = await createAdvanceContentStateUseCase(deps({ events: events.port })).execute(owner, {
      variantId: REVIEWABLE,
      from: "PUBLISHED",
      to: "REFRESH_DUE",
    });

    expect(got.ok).toBe(true);
    expect(events.names()).toEqual(["content.refresh_due"]);
  });

  it("途中の移動では、出来事を作らない", async () => {
    const events = recordingEvents();
    const got = await createAdvanceContentStateUseCase(deps({ events: events.port })).execute(owner, {
      variantId: FAILING_DRAFT,
      from: "GENERATED",
      to: "FACT_CHECK",
    });

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
      deps({ events: { publish: async () => failing("通知先に繋がりません。") } }),
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
  /** 見本の保存先は保存できないので、保存だけ動くものに差し替える。 */
  function savable(saved: { current: ContentVariant | null }): ManageContentDeps["variants"] {
    return variantsWith({
      save: async (v: ContentVariant) => {
        saved.current = v;
        return ok(v);
      },
    });
  }

  it("人が承認すると、承認済みとして保存される", async () => {
    const saved: { current: ContentVariant | null } = { current: null };
    const got = await createApproveContentUseCase(deps({ variants: savable(saved) })).execute(owner, {
      variantId: REVIEWABLE,
    });
    if (!got.ok) throw got.error;

    expect(got.value.status).toBe("approved");
    expect(saved.current?.status).toBe("approved");
    expect(saved.current?.id).toBe(REVIEWABLE);
  });

  it("承認したことは、誰が承認したかつきで出来事になる", async () => {
    const events = recordingEvents();
    const saved: { current: ContentVariant | null } = { current: null };
    const got = await createApproveContentUseCase(
      deps({ variants: savable(saved), events: events.port }),
    ).execute(owner, { variantId: REVIEWABLE });

    expect(got.ok).toBe(true);
    expect(events.names()).toEqual(["content_variant.approved"]);
    const payload = events.published()[0]?.payload as { approvedBy?: string };
    expect(payload.approvedBy).toBe(String(owner.userId));
  });

  it("AI のサービスアカウントが持ち主の権限を借りていても、単独では承認できない", async () => {
    const saved: { current: ContentVariant | null } = { current: null };
    const got = await createApproveContentUseCase(deps({ variants: savable(saved) })).execute(
      anOwner({ workspaceId: WS, isAiServiceAccount: true }),
      { variantId: REVIEWABLE },
    );

    expect(got.ok).toBe(false);
    if (got.ok) return;
    // 役割の一覧ではなく「AI かどうか」で止まる。役割を足しても抜けられない。
    expect(got.error.code).toBe("FORBIDDEN");
    expect(got.error.message).toContain("人が行う");
    expect(saved.current).toBeNull();
  });

  it("自動確認で不適合の記事は承認できない", async () => {
    const saved: { current: ContentVariant | null } = { current: null };
    const got = await createApproveContentUseCase(deps({ variants: savable(saved) })).execute(owner, {
      variantId: FAILING_DRAFT,
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(saved.current).toBeNull();
  });

  it("保存できなかったときに、承認できたと返さない", async () => {
    const events = recordingEvents();
    const got = await createApproveContentUseCase(deps({ events: events.port })).execute(owner, {
      variantId: REVIEWABLE,
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
    expect(events.names()).toEqual([]);
  });

  it("知らせられなくても、承認そのものは残る", async () => {
    const saved: { current: ContentVariant | null } = { current: null };
    const got = await createApproveContentUseCase(
      deps({ variants: savable(saved), events: { publish: async () => failing("通知先が無い。") } }),
    ).execute(owner, { variantId: REVIEWABLE });
    if (!got.ok) throw got.error;

    expect(got.value.status).toBe("approved");
  });

  it("書ける人でも、承認の権限が無ければ承認できない", async () => {
    const saved: { current: ContentVariant | null } = { current: null };
    const got = await createApproveContentUseCase(deps({ variants: savable(saved) })).execute(writer, {
      variantId: REVIEWABLE,
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
    expect(saved.current).toBeNull();
  });

  it("無い記事は承認できない", async () => {
    const saved: { current: ContentVariant | null } = { current: null };
    const got = await createApproveContentUseCase(deps({ variants: savable(saved) })).execute(owner, {
      variantId: "cv_no_such",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
  });
});
