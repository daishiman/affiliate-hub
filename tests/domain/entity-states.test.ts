/**
 * @tier 1
 * @req REQ-E19, REQ-E25, REQ-E27
 * @types state-transition
 */
import { describe, expect, it } from "vitest";
import { approveVariant, createContentVariant } from "@/domain/authoring";
import { advance, createPublication, type Publication, type PublicationState } from "@/domain/distribution";
import { createClaim, expireIfDue, isClaimUsable, verifyClaim } from "@/domain/evidence";
import {
  asAudiencePersonaId,
  asAuthorPersonaId,
  asChannelConnectionId,
  asClaimId,
  asContentPackageId,
  asContentVariantId,
  asPublicationId,
  asWorkspaceId,
} from "@/domain/shared/ids";

/**
 * 3 つのエンティティ（E19 主張 / E25 記事の下書き / E27 配信）の**状態の動き**を見る。
 *
 * 遷移の一覧は、このファイル側に**文字で**書いてある。実装の
 * `ALLOWED` を読み込んで回すと、実装から 1 行消えたときに、
 * 短くなった一覧を回して短くなったぶんだけ確かめ、緑を返す
 * （`docs/product/backlog.md` 項目 78 の 5 つ目）。
 *
 * 総当たりは 10 × 10 = 100 通りを全部通す。前提で狭めない
 * （同 6 つ目）。公開ゲートは常に「通った」を渡してあるので、
 * 断られたときの理由は遷移表そのものになる。ゲートを要求すること自体は
 * 別の `it` で当てる。
 */

const WS = asWorkspaceId("ws-1");
const NOW = new Date("2026-08-19T00:00:00Z");
const GATE = { ok: true, failures: [], skipped: [] };

const STATES: readonly PublicationState[] = [
  "QUEUED",
  "RENDERING",
  "VALIDATING",
  "SENDING",
  "PUBLISHED",
  "MANUAL_EXPORT_READY",
  "FAILED_VALIDATION",
  "FAILED_SEND",
  "RETRY_SCHEDULED",
  "CANCELLED",
];

/** 進める先の一覧。**実装から読まず、ここに書き写して固定する。** */
const EXPECTED_NEXT: Readonly<Record<PublicationState, readonly PublicationState[]>> = {
  QUEUED: ["RENDERING", "CANCELLED"],
  RENDERING: ["VALIDATING", "FAILED_VALIDATION", "CANCELLED"],
  VALIDATING: ["SENDING", "MANUAL_EXPORT_READY", "FAILED_VALIDATION", "CANCELLED"],
  SENDING: ["PUBLISHED", "FAILED_SEND"],
  PUBLISHED: [],
  MANUAL_EXPORT_READY: ["PUBLISHED", "CANCELLED"],
  FAILED_VALIDATION: ["QUEUED", "CANCELLED"],
  FAILED_SEND: ["RETRY_SCHEDULED", "CANCELLED"],
  RETRY_SCHEDULED: ["SENDING", "CANCELLED"],
  CANCELLED: [],
};

function queued(): Publication {
  const r = createPublication({
    id: asPublicationId("pb-1"),
    workspaceId: WS,
    variantId: asContentVariantId("cv-1"),
    variantRevision: 1,
    channelKind: "x",
    connectionId: asChannelConnectionId("ch-1"),
    idempotencyKey: "pb-1:key",
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const at = (state: PublicationState): Publication => ({ ...queued(), state });

describe("Publication（E27）: 10 状態 × 10 行き先の総当たり", () => {
  it("進める先は 19 通りだけで、残り 81 通りは断る", () => {
    let allowed = 0;
    let refused = 0;
    for (const from of STATES) {
      for (const to of STATES) {
        const r = advance(at(from), to, { gate: GATE, at: NOW });
        const expected = EXPECTED_NEXT[from].includes(to);
        expect(r.ok, `${from} → ${to}`).toBe(expected);
        if (expected) allowed += 1;
        else refused += 1;
      }
    }
    // 通る側と断る側の件数も固定する。表から 1 行消えたら、この数が動く。
    expect(allowed).toBe(19);
    expect(refused).toBe(81);
  });

  it("行き止まりの状態では、次にできることを別の言葉で示す", () => {
    for (const dead of ["PUBLISHED", "CANCELLED"] as const) {
      const r = advance(at(dead), "SENDING", { gate: GATE, at: NOW });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.suggestedAction).toContain("新しい配信");
    }
  });

  it("出す前の確認から先へ進むときだけ、公開ゲートの結果を要求する", () => {
    for (const to of ["SENDING", "MANUAL_EXPORT_READY"] as const) {
      const none = advance(at("VALIDATING"), to, { at: NOW });
      expect(none.ok).toBe(false);
      if (!none.ok) expect(none.error.code).toBe("PUBLISH_GATE_FAILED");

      const failed = advance(at("VALIDATING"), to, {
        gate: {
          ok: false,
          failures: [{ requirement: "disclosure", message: "広告表記がありません" }],
          skipped: [],
        },
        at: NOW,
      });
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.error.message).toContain("広告表記がありません");

      expect(advance(at("VALIDATING"), to, { gate: GATE, at: NOW }).ok).toBe(true);
    }
    // 同じ行き先でも、確認より手前の状態からはゲートを求めない。
    expect(advance(at("RETRY_SCHEDULED"), "SENDING", { at: NOW }).ok).toBe(true);
  });

  it("公開した時刻は、公開へ進んだ回にだけ入る", () => {
    const sending = advance(at("VALIDATING"), "SENDING", { gate: GATE, at: NOW });
    expect(sending.ok).toBe(true);
    if (!sending.ok) return;
    expect(sending.value.publishedAt).toBeNull();
    const published = advance(sending.value, "PUBLISHED", { gate: GATE, at: NOW });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.value.publishedAt).toEqual(NOW);
  });
});

describe("Claim（E19）: 確認の状態", () => {
  const build = () => {
    const r = createClaim({
      id: asClaimId("cl-1"),
      workspaceId: WS,
      statement: "書き出しが 3 割速い",
      type: "inference",
      evidenceIds: [],
      confidence: 0.8,
      validFrom: NOW,
      validUntil: new Date(NOW.getTime() + 86400000),
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };

  it("作った直後は未確認で、まだ使えない", () => {
    const c = build();
    expect(c.verificationStatus).toBe("pending");
    expect(isClaimUsable(c, NOW)).toBe(false);
  });

  /* この 1 件は、消しても誰も気づかなかった側である（2026-08-19 の実測）。 */
  it("確認者の名前が空なら、確認済みにできない", () => {
    for (const blank of ["", " ", "　"]) {
      expect(verifyClaim(build(), blank).ok).toBe(false);
    }
  });

  it("却下済みは確認済みへ戻せない", () => {
    const rejected = { ...build(), verificationStatus: "rejected" as const };
    const r = verifyClaim(rejected, "編集長");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });

  it("確認済みになると使えるようになり、期限を過ぎると期限切れへ移って使えなくなる", () => {
    const verified = verifyClaim(build(), "編集長");
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(isClaimUsable(verified.value, NOW)).toBe(true);

    const after = new Date(NOW.getTime() + 86400000);
    const expired = expireIfDue(verified.value, after);
    expect(expired.verificationStatus).toBe("expired");
    expect(isClaimUsable(expired, after)).toBe(false);
    // 期限のちょうど手前ではまだ動かさない。
    expect(expireIfDue(verified.value, new Date(after.getTime() - 1)).verificationStatus).toBe("verified");
  });
});

describe("ContentVariant（E25）: 承認へ進む条件", () => {
  const build = (complianceStatus: "pass" | "warning" | "fail") => {
    const r = createContentVariant({
      id: asContentVariantId("cv-1"),
      workspaceId: WS,
      contentPackageId: asContentPackageId("cp-1"),
      channel: "own_site",
      format: "article",
      authorPersonaId: asAuthorPersonaId("ap-1"),
      audiencePersonaId: asAudiencePersonaId("ad-1"),
      angle: "data_first",
      body: "本文",
      summary: "要約",
      cta: "read_detail",
      disclosure: "広告を含みます",
      factualityScore: 0.9,
      personaFitScore: 0.8,
      channelFitScore: 0.8,
      complianceStatus,
      generationPromptVersion: "v1",
      modelId: "m-1",
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };

  it("作った直後は生成済みで、承認済みではない", () => {
    expect(build("pass").status).toBe("generated");
  });

  /* この 1 件は、消しても誰も気づかなかった側である（2026-08-19 の実測）。 */
  it("人が確認していない承認は通らない", () => {
    const r = approveVariant(build("pass"), false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("AI だけで");
  });

  it("自動確認の 3 つの結果のうち、不適合だけが承認を止める", () => {
    expect(approveVariant(build("pass"), true).ok).toBe(true);
    expect(approveVariant(build("warning"), true).ok).toBe(true);
    expect(approveVariant(build("fail"), true).ok).toBe(false);
  });

  it("承認できたときだけ、状態が承認済みへ移る", () => {
    const r = approveVariant(build("pass"), true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("approved");
  });
});
