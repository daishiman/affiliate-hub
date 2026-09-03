/**
 * @tier 1
 * @req REQ-R08, REQ-P01
 * @types equivalence, boundary
 *
 * `audit.ts` の**入れ物の組み立て**と、記録を残せなかったときの断り文を固定する。
 *
 * ここは全ユースケースの記録が通る 1 点である。にもかかわらず
 * 「行が積まれた」ことしか見られておらず、`al_` の採番も、
 * 省略された欄を `null` に倒す扱いも、断り文の中身も押さえていなかった。
 *
 * 断り文をここで固定するのは、**その文が「もう一度押してよいか」を決める**ためである。
 * 済んだことと残っていることの両方が書いてないと、押した人は判断できない。
 */
import { describe, expect, it } from "vitest";
import { auditActorOf, auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { AuditClock } from "@/application/audit";
import { type ActorContext, ok } from "@/domain/shared";
import { WORKSPACE, anAnalyst } from "../support/actors";

const NOW = new Date("2026-08-24T09:00:00.000Z");

function clock(): AuditClock {
  let n = 0;
  return { ids: { newId: () => `n${++n}` }, now: () => NOW };
}

const 主体 = (): ActorContext => ({ ...anAnalyst(), requestId: "req-固定-1" });

const 最小入力 = { action: "content.published", targetType: "article", targetId: "a-1" } as const;

describe("操作した主体を記録の形へ移す (auditActorOf)", () => {
  it("名前・AI かどうか・確かめてあるかは、そのまま移る", () => {
    const got = auditActorOf(主体());
    expect(String(got.userId)).toBe("user-analyst");
    expect(got.isAiServiceAccount).toBe(false);
    expect(got.identified).toBe(true);
  });

  it("確かめていない身元でも、名前は落とさない", () => {
    // 名前を落とすと、読者が押したのか、ログインを解決できなかった落ち先かが
    // 後から区別できなくなる。前者は日常、後者は保存先が落ちている徴候である。
    // 読者や、ログインを解決できなかったときの落ち先がこれになる。
    const 未確認 = anAnalyst({ userId: "anonymous", identified: false });
    const got = auditActorOf(未確認);
    expect(String(got.userId)).toBe("anonymous");
    expect(got.identified).toBe(false);
  });

  it("どのモデルが動かしたかは、分からないので埋めない", () => {
    // ActorContext がまだ持っていない。分からないものを埋めない（残課題 53）。
    expect(auditActorOf(主体()).modelId).toBeNull();
  });
});

describe("記録の入れ物を組み立てる (buildAuditEntry)", () => {
  it("ID は al_ を頭に付けた採番であり、採番器を通している", () => {
    const got = buildAuditEntry(clock(), 主体(), 最小入力);
    expect(got.ok).toBe(true);
    if (got.ok) expect(String(got.value.id)).toBe("al_n1");
  });

  it("作業場所・語・対象・時刻は、渡したものがそのまま入る", () => {
    const got = buildAuditEntry(clock(), 主体(), 最小入力);
    if (!got.ok) throw new Error("前提が崩れている: 組み立てに失敗した");
    expect(got.value.workspaceId).toBe(WORKSPACE);
    expect(got.value.action).toBe("content.published");
    expect(got.value.targetType).toBe("article");
    expect(got.value.targetId).toBe("a-1");
    expect(got.value.occurredAt).toEqual(NOW);
  });

  it("省略された欄は null に倒れる（undefined を残さない）", () => {
    const got = buildAuditEntry(clock(), 主体(), 最小入力);
    if (!got.ok) throw new Error("前提が崩れている");
    expect(got.value.before).toBeNull();
    expect(got.value.after).toBeNull();
    expect(got.value.reason).toBeNull();
  });

  it("渡した before / after / reason は捨てない", () => {
    const got = buildAuditEntry(clock(), 主体(), {
      ...最小入力,
      before: { status: "draft" },
      after: { status: "published" },
      reason: "編集長が確認した",
    });
    if (!got.ok) throw new Error("前提が崩れている");
    expect(got.value.before).toEqual({ status: "draft" });
    expect(got.value.after).toEqual({ status: "published" });
    expect(got.value.reason).toBe("編集長が確認した");
  });

  it("糸は身元と一緒に運ぶ。入力からは受け取らない", () => {
    const 付き = buildAuditEntry(clock(), 主体(), 最小入力);
    if (!付き.ok) throw new Error("前提が崩れている");
    expect(付き.value.requestId).toBe("req-固定-1");

    // 要求の外で起きる操作（定期実行）は糸を持たない。null に倒れる。
    const 無し = buildAuditEntry(clock(), anAnalyst(), 最小入力);
    if (!無し.ok) throw new Error("前提が崩れている");
    expect(無し.value.requestId).toBeNull();
  });

  it("ドメインが断る入力は、断りとして返る（成功に化けない）", () => {
    const got = buildAuditEntry(clock(), 主体(), { ...最小入力, targetId: "" });
    expect(got.ok).toBe(false);
  });
});

describe("記録を残せなかったときの断り (auditWriteFailure)", () => {
  const 断り = auditWriteFailure("記事を公開しました");

  it("済んだことと、残っていないことの両方が書いてある", () => {
    expect(断り.message).toContain("記事を公開しました");
    expect(断り.message).toContain("記録を残せませんでした");
    expect(断り.message).toContain("後から「人が確認した」ことを示せません");
  });

  it("保存先の不調なので、もう一度試す価値がある扱いにする", () => {
    expect(断り.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(断り.retryable).toBe(true);
  });

  it("次に何をすればよいかが書いてある", () => {
    expect(断り.suggestedAction).toBe(
      "画面を開き直して、記録が残っているか確認してください。残っていない場合は保存先の状態を確認してください。",
    );
  });

  it("渡した手がかりは捨てない。渡さなければ undefined のまま", () => {
    expect(auditWriteFailure("x", { articleId: "a-1" }).details).toEqual({ articleId: "a-1" });
    expect(断り.details).toBeUndefined();
  });

  it("済んだことの一文は、渡したものがそのまま頭に立つ", () => {
    expect(auditWriteFailure("下書きを保存しました").message.startsWith("下書きを保存しました。")).toBe(
      true,
    );
  });
});

/** 使っていない import を型検査で落とさないための番人（`ok` はここでだけ要る）。 */
describe("補助", () => {
  it("Result の成功形は変わっていない", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });
});
