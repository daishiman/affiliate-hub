/**
 * @tier 1
 * @req REQ-SEC09, REQ-SEC01, REQ-R08, REQ-P01
 * @types equivalence, boundary, permission-matrix
 */
import { describe, expect, it } from "vitest";
import type { AuditLogPort } from "@/application/ports/compliance";
import { auditDenials } from "@/application/access-denial";
import type { UseCase } from "@/application/usecases/usecase";
import { requireCapability } from "@/domain/identity";
import { createAuditLogEntry } from "@/domain/compliance";
import type { AuditLogEntry } from "@/domain/compliance";
import { assertSameTenant } from "@/domain/shared/tenancy";
import {
  type ActorContext,
  type AuditLogId,
  type WorkspaceId,
  err,
  notFound,
  ok,
} from "@/domain/shared";
import { errorResponse } from "@/presentation/http/error-response";
import { refusalText } from "@/presentation/refusal-text";
import { OTHER_WORKSPACE, WORKSPACE, anAnalyst, anOwner } from "../../support/actors";

/**
 * AWS-ACC-02 / AWS-ACC-04 のうち、**記録の側**を見る。
 *
 * 判定そのもの（403 になるか、他所のものが取れないか）は
 * `access-boundary.test.ts` が見ている。ここが足すのは 1 つ——
 * **断ったことが、後から読める形で残るか**である。
 *
 * なぜ分けて要るのか。断りは押した人には見えるが、守る側には何も見えない。
 * 行が無ければ「誰も試していない」と「試して止めた」が同じ顔をする。
 * 前者と後者では次にすることが違う（役の付け直しか、侵入の調査か）。
 *
 * **断る側だけを並べない。** 通る側を必ず隣に置く。
 * 断りを全部記録する実装は、全部を断る実装でも緑になってしまう。
 * 「許された操作は通り、そのとき断りの行は増えない」を同じ describe に置く。
 */

const NOW = new Date("2026-08-24T09:00:00.000Z");
const REQUEST_ID = "req-テスト-0001";

/** 記録先の控え。**本物の `AuditLogPort` の形をそのまま満たす。** */
function 記録先() {
  const 行: AuditLogEntry[] = [];
  const port: AuditLogPort = {
    async append(entry) {
      行.push(entry);
      return ok(entry.id);
    },
    async listByTarget() {
      return ok(行);
    },
    async search() {
      return ok({ items: 行, nextCursor: null });
    },
  };
  return { 行, port };
}

function 入口(port: AuditLogPort) {
  let n = 0;
  /** 公開。**本物の権限判定を呼ぶ**（判定を書き写すと、判定が変わっても緑のままになる）。 */
  const publishArticle: UseCase<{ publicationId: string }, string> = {
    async execute(actor) {
      const allowed = requireCapability(actor, "content.publish", "記事の公開");
      if (!allowed.ok) return err(allowed.error);
      return ok("公開した");
    },
  };
  /** 数字の閲覧。許された操作の側。 */
  const readAnalytics: UseCase<Record<string, never>, string> = {
    async execute(actor) {
      const allowed = requireCapability(actor, "analytics.read", "数字の閲覧");
      if (!allowed.ok) return err(allowed.error);
      return ok("読んだ");
    },
  };
  /** 記事 1 本の取得。他所のものと、そもそも無いものの両方を返し分ける。 */
  const getArticle: UseCase<{ articleId: string }, { workspaceId: WorkspaceId }> = {
    async execute(actor, input) {
      if (input.articleId === "obj-自分") {
        return assertSameTenant(actor, { workspaceId: WORKSPACE, id: input.articleId }, "記事");
      }
      if (input.articleId === "obj-他所") {
        return assertSameTenant(
          actor,
          { workspaceId: OTHER_WORKSPACE, id: input.articleId },
          "記事",
        );
      }
      return err(notFound("記事", input.articleId));
    },
  };
  return auditDenials(
    { auditLog: port, ids: { newId: () => `test-${++n}` }, now: () => NOW },
    { publishArticle, readAnalytics, getArticle },
  );
}

const 分析担当 = (): ActorContext => ({ ...anAnalyst(), requestId: REQUEST_ID });

describe("AWS-ACC-04 権限の無い役の公開操作が、断られ、記録に残る", () => {
  it("断られた事実が 1 行残り、誰が・どの作業場所で・何を・どうなったかが揃っている", async () => {
    const { 行, port } = 記録先();
    const got = await 入口(port).publishArticle.execute(分析担当(), { publicationId: "pub-1" });

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("FORBIDDEN");

    expect(行).toHaveLength(1);
    const 記録 = 行[0];
    // actor
    expect(String(記録.actor.userId)).toBe("user-analyst");
    expect(記録.actor.isAiServiceAccount).toBe(false);
    // workspace
    expect(記録.workspaceId).toBe(WORKSPACE);
    // action（記録の語と、何をしようとしたか）
    expect(記録.action).toBe("access.denied");
    expect(記録.after?.attempted).toBe("publishArticle");
    // result
    expect(記録.after?.result).toBe("denied");
    expect(記録.after?.code).toBe("FORBIDDEN");
  });

  it("断りの記録には request ID が付く（同じ要求の断りを並べて読めること）", async () => {
    const { 行, port } = 記録先();
    await 入口(port).publishArticle.execute(分析担当(), { publicationId: "pub-1" });
    expect(行[0].requestId).toBe(REQUEST_ID);
  });

  it("同じ役でも、許された操作は通り、断りの行は増えない（全部を記録に倒していないこと）", async () => {
    const { 行, port } = 記録先();
    const got = await 入口(port).readAnalytics.execute(分析担当(), {});
    expect(got.ok).toBe(true);
    expect(行).toHaveLength(0);
  });

  it("断りを記録しても、押した人に届く番号と文は 1 バイトも変わらない", async () => {
    const { port } = 記録先();
    const 記録あり = await 入口(port).publishArticle.execute(分析担当(), { publicationId: "pub-1" });
    const 記録なし = requireCapability(分析担当(), "content.publish", "記事の公開");
    if (記録あり.ok || 記録なし.ok) throw new Error("前提が崩れている: 公開が通っている");
    expect(記録あり.error).toEqual(記録なし.error);
  });
});

describe("AWS-ACC-02 他所の作業場所への操作が、断られ、記録に残り、本文からは存在が読めない", () => {
  it("他所を指した断りは、権限不足とは別の語で残る", async () => {
    const { 行, port } = 記録先();
    const got = await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-他所" });

    expect(got.ok).toBe(false);
    expect(行).toHaveLength(1);
    expect(行[0].action).toBe("access.cross_workspace_blocked");
    expect(行[0].requestId).toBe(REQUEST_ID);
  });

  it("外へ潰した種類（TENANT_MISMATCH）が、記録の側には残っている", async () => {
    const { 行, port } = 記録先();
    await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-他所" });
    expect(行[0].after?.code).toBe("TENANT_MISMATCH");
    // 潰したあとの本文からは、もうこの区別は読めない。
    expect(errorResponse({ code: "TENANT_MISMATCH", message: "x", retryable: false }).status).toBe(
      404,
    );
  });

  it("自分のものは取れ、断りの行は増えない（全部 404 に倒していないこと）", async () => {
    const { 行, port } = 記録先();
    const got = await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-自分" });
    expect(got.ok).toBe(true);
    expect(行).toHaveLength(0);
  });

  /**
   * ここが画面の経路。**REST と MCP は潰していたが、画面は潰していなかった。**
   * 画面は番号を見ずに本文だけが目に入るので、差はいちばん読まれやすい。
   */
  it("画面へ出る文も、他所のものと、そもそも無いものとで区別できない", async () => {
    const { port } = 記録先();
    const 他所 = await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-他所" });
    const 無い = await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-9999" });
    if (他所.ok || 無い.ok) throw new Error("前提が崩れている: 断られていない");
    expect(refusalText(他所.error)).toBe(refusalText(無い.error));
    // 「潰して全部同じ文にしただけ」でないこと。通る側の文は別物である。
    expect(refusalText(他所.error)).not.toBe(
      refusalText({ code: "VALIDATION_FAILED", message: "題名を入れてください。", retryable: false }),
    );
  });

  it("REST の本文も、他所のものと、そもそも無いものとで 1 バイトも違わない", async () => {
    const { port } = 記録先();
    const 他所 = await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-他所" });
    const 無い = await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-9999" });
    if (他所.ok || 無い.ok) throw new Error("前提が崩れている: 断られていない");
    const a = errorResponse(他所.error);
    const b = errorResponse(無い.error);
    expect(a.status).toBe(b.status);
    expect(await a.text()).toBe(await b.text());
  });
});

describe("断りの一覧が、読めるものであり続けるか", () => {
  it("そもそも無い ID の 404 は記録しない（一覧が 404 で埋まらない）", async () => {
    const { 行, port } = 記録先();
    await 入口(port).getArticle.execute(分析担当(), { articleId: "obj-9999" });
    expect(行).toHaveLength(0);
  });

  it("糸を持たない身元でも、断りは必ず残る（その場で 1 本作る）", async () => {
    const { 行, port } = 記録先();
    // `requestId` を持たない身元。定期実行や、見出しを付け損ねた要求がこれになる。
    await 入口(port).publishArticle.execute(anAnalyst(), { publicationId: "pub-1" });
    expect(行).toHaveLength(1);
    expect(行[0].requestId ?? "").not.toBe("");
  });

  it("断りの語は、糸が無ければ記録そのものを断る（ドメインの決まり）", () => {
    const 共通 = {
      id: "al_1" as AuditLogId,
      workspaceId: WORKSPACE,
      actor: { userId: null, isAiServiceAccount: false, modelId: null, identified: true },
      targetType: "publishArticle",
      targetId: "pub-1",
      occurredAt: NOW,
    };
    const 糸なし = createAuditLogEntry({ ...共通, action: "access.denied", requestId: null });
    expect(糸なし.ok).toBe(false);
    // 断り以外は糸が無くても残す。要求の外で起きる操作（定期実行）があるため。
    const 通した操作 = createAuditLogEntry({
      ...共通,
      action: "content.published",
      requestId: null,
    });
    expect(通した操作.ok).toBe(true);
  });

  it("持ち主が公開しても記録は増えない（断りの一覧に、通った操作が混ざらない）", async () => {
    const { 行, port } = 記録先();
    const got = await 入口(port).publishArticle.execute(
      { ...anOwner(), requestId: REQUEST_ID },
      { publicationId: "pub-1" },
    );
    expect(got.ok).toBe(true);
    expect(行).toHaveLength(0);
  });
});
