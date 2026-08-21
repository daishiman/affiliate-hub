/**
 * @tier 1
 * @req REQ-FB03, REQ-FB06
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import {
  ANNOTATION_TOOLS,
  CAPTURE_RETENTION_DAYS,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  INCLUDE_CAPTURE_IN_PROMPT,
  KEY_SCOPES,
  MAX_BODY_LENGTH,
  MAX_WISH_LENGTH,
  UNFINISHED_STATUSES,
  WISH_ABSENT_TEXT,
  appendHistory,
  assertCaptureIsStorable,
  assertStatusChange,
  authorize,
  canChooseColor,
  colorFor,
  createFeedbackReport,
  decideDisposition,
  emptyHandoffState,
  hasBeenHandedOff,
  isCaptureExpired,
  isDiscarded,
  isRevoked,
  REDACT_COLOR,
  issueIntegrationKey,
  linkBeadsIssue,
  markUsed,
  recordHandoff,
  revokeIntegrationKey,
  undoDisposition,
} from "@/domain/feedback";
import {
  asBrandId,
  asFeedbackReportId,
  asIntegrationKeyId,
  asSiteId,
  asUserId,
  asWorkspaceId,
} from "@/domain/shared";
import { NOW } from "../support/clock";

const AT = NOW;
const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");

function makeReport(overrides?: { wish?: string | null; body?: string }) {
  return createFeedbackReport({
    id: asFeedbackReportId("fb-1"),
    workspaceId: WORKSPACE,
    brandId: asBrandId("brand-1"),
    siteId: asSiteId("site-1"),
    kind: "hard_to_use",
    body: overrides?.body ?? "記事一覧の絞り込みが毎回リセットされます。",
    wish: overrides?.wish,
    origin: {
      screenName: "記事一覧",
      url: "https://example.com/admin/articles",
      route: "/admin/articles",
      viewportWidth: 1440,
      viewportHeight: 900,
    },
    technical: {
      jsErrors: [],
      failedRequests: [],
      userAgent: "test-agent",
      recentActions: ["絞り込みを開いた"],
      redactedCount: 0,
    },
    submittedBy: USER,
    at: AT,
  });
}

describe("改善要望を受け取る", () => {
  it("届いた時点では未対応で、履歴が 1 行だけ積まれている", () => {
    const result = makeReport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("open");
    expect(result.value.history).toHaveLength(1);
    expect(result.value.disposition).toBeNull();
    expect(hasBeenHandedOff(result.value.handoff)).toBe(false);
  });

  it("「どうなってほしいか」は任意で、空欄は null になる（画面で断りを出すため）", () => {
    const blank = makeReport({ wish: "   " });
    const filled = makeReport({ wish: " 前回の条件を覚えていてほしい " });
    expect(blank.ok && blank.value.wish).toBeNull();
    expect(filled.ok && filled.value.wish).toBe("前回の条件を覚えていてほしい");
    expect(WISH_ABSENT_TEXT).toContain("記入はありません");
  });

  it("「改善したいこと」が空だと受け取らない", () => {
    const result = makeReport({ body: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_FAILED");
    expect(result.error.field).toBe("body");
  });

  it("本文の上限を超えたら、どうすればよいかを添えて断る（境界値）", () => {
    const justFit = makeReport({ body: "あ".repeat(MAX_BODY_LENGTH) });
    expect(justFit.ok).toBe(true);
    const tooLong = makeReport({ body: "あ".repeat(MAX_BODY_LENGTH + 1) });
    expect(tooLong.ok).toBe(false);
    if (tooLong.ok) return;
    expect(tooLong.error.suggestedAction).toBeTruthy();
  });

  it("「どうなってほしいか」にも上限があり、その境目で切り替わる（境界値）", () => {
    // 本文の境目だけを見ていて、こちらは誰も見ていなかった。
    // 上限を 1 文字動かしても緑のまま通ることを、実際に測って確かめてある。
    expect(makeReport({ wish: "い".repeat(MAX_WISH_LENGTH - 1) }).ok).toBe(true);
    expect(makeReport({ wish: "い".repeat(MAX_WISH_LENGTH) }).ok).toBe(true);
    const tooLong = makeReport({ wish: "い".repeat(MAX_WISH_LENGTH + 1) });
    expect(tooLong.ok).toBe(false);
    if (tooLong.ok) return;
    expect(tooLong.error.field).toBe("wish");
  });

  it("種類は 3 つだけ", () => {
    expect([...FEEDBACK_KINDS]).toEqual(["not_working", "hard_to_use", "want_feature"]);
  });

  it("履歴は積むだけで、前の行が消えない", () => {
    const created = makeReport();
    if (!created.ok) throw new Error("前提が崩れています");
    const after = appendHistory(created.value, {
      at: new Date("2026-08-17T10:00:00Z"),
      by: "admin",
      summary: "対応中にしました。",
    });
    expect(after.history).toHaveLength(2);
    expect(after.history[0]).toEqual(created.value.history[0]);
  });

  it("Beads の課題は 1 件につき 1 つまで（二重管理にしない）", () => {
    const created = makeReport();
    if (!created.ok) throw new Error("前提が崩れています");
    const first = linkBeadsIssue(created.value, "ah-abc");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // 同じ番号なら通る（送り直しても壊れない）
    expect(linkBeadsIssue(first.value, "ah-abc").ok).toBe(true);
    const second = linkBeadsIssue(first.value, "ah-xyz");
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("CONFLICT");
  });
});

describe("対応状況の進み方", () => {
  it("状態は 4 つで、終わっていないものは未対応と対応中", () => {
    expect([...FEEDBACK_STATUSES]).toEqual(["open", "in_progress", "resolved", "declined"]);
    expect([...UNFINISHED_STATUSES]).toEqual(["open", "in_progress"]);
  });

  it("対応済みからでも戻せる（間違えたときに直せないと、誰も状態を触らなくなる）", () => {
    expect(assertStatusChange("resolved", "in_progress", null).ok).toBe(true);
    expect(assertStatusChange("declined", "open", null).ok).toBe(true);
  });

  it("同じ状態への変更は断る", () => {
    const result = assertStatusChange("open", "open", null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("すでに");
  });

  it("見送りには理由が要る", () => {
    const without = assertStatusChange("open", "declined", "  ");
    expect(without.ok).toBe(false);
    if (without.ok) return;
    expect(without.error.field).toBe("note");
    expect(assertStatusChange("open", "declined", "同じ要望を別で対応中のため").ok).toBe(true);
  });

  it("対応済みから見送りへは飛べない（表に無い道は通れない）", () => {
    const result = assertStatusChange("resolved", "declined", "理由あり");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVARIANT_VIOLATED");
  });
});

describe("扱い（対応しない・重複・廃棄）", () => {
  it("理由なしでは決められない", () => {
    const result = decideDisposition({
      kind: "will_not_fix",
      reason: "",
      decidedBy: "admin",
      at: AT,
    });
    expect(result.ok).toBe(false);
  });

  it("重複はどれと同じかを指す。それ以外では指せない", () => {
    const missing = decideDisposition({
      kind: "duplicate",
      reason: "同じ内容",
      decidedBy: "admin",
      at: AT,
    });
    expect(missing.ok).toBe(false);
    const ok = decideDisposition({
      kind: "duplicate",
      reason: "同じ内容",
      duplicateOf: "fb-9",
      decidedBy: "admin",
      at: AT,
    });
    expect(ok.ok).toBe(true);
    const wrong = decideDisposition({
      kind: "will_not_fix",
      reason: "仕様どおりのため",
      duplicateOf: "fb-9",
      decidedBy: "admin",
      at: AT,
    });
    expect(wrong.ok).toBe(false);
  });

  it("廃棄は見分けられ、取り消せる", () => {
    const decided = decideDisposition({
      kind: "discarded",
      reason: "動作確認用のため",
      decidedBy: "admin",
      at: AT,
    });
    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(isDiscarded(decided.value)).toBe(true);
    expect(undoDisposition(decided.value).ok).toBe(true);
    expect(undoDisposition(null).ok).toBe(false);
  });
});

describe("払い出しは回数と履歴を増やすだけ", () => {
  const entry = {
    at: AT,
    route: "copied_by_human" as const,
    actor: "admin",
    keyId: null,
    promptFingerprint: "abcd1234",
  };

  it("同じ指紋なら何度でも積める（もう一度渡しても中身が変わらない）", () => {
    const first = recordHandoff(emptyHandoffState(), entry);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = recordHandoff(first.value, { ...entry, at: new Date("2026-08-17T11:00:00Z") });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.count).toBe(2);
    expect(second.value.entries).toHaveLength(2);
    expect(hasBeenHandedOff(second.value)).toBe(true);
  });

  it("前と違う指示文が出たら記録を拒む", () => {
    const first = recordHandoff(emptyHandoffState(), entry);
    if (!first.ok) throw new Error("前提が崩れています");
    const drifted = recordHandoff(first.value, { ...entry, promptFingerprint: "ffff0000" });
    expect(drifted.ok).toBe(false);
    if (drifted.ok) return;
    expect(drifted.error.code).toBe("INVARIANT_VIOLATED");
  });

  it("取りに来た経路では、どの鍵で取ったかを必ず残す", () => {
    const missingKey = recordHandoff(emptyHandoffState(), {
      ...entry,
      route: "pulled_by_agent",
      keyId: null,
    });
    expect(missingKey.ok).toBe(false);
    const withKey = recordHandoff(emptyHandoffState(), {
      ...entry,
      route: "pulled_by_agent",
      keyId: "key-1",
    });
    expect(withKey.ok).toBe(true);
  });

  it("画面からのコピーに鍵は使わない", () => {
    const result = recordHandoff(emptyHandoffState(), { ...entry, keyId: "key-1" });
    expect(result.ok).toBe(false);
  });
});

describe("画像の扱い", () => {
  const submission = {
    redactionsBurnedIn: true,
    retainsOriginal: false,
    redactionCount: 2,
    maskedElementCount: 1,
    byteLength: 100_000,
    mimeType: "image/png",
  };

  it("焼き込んでいない画像は保存しない", () => {
    const result = assertCaptureIsStorable({ ...submission, redactionsBurnedIn: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVARIANT_VIOLATED");
  });

  it("黒塗り前の画像が残っていたら保存しない", () => {
    const result = assertCaptureIsStorable({ ...submission, retainsOriginal: true });
    expect(result.ok).toBe(false);
  });

  it("png 以外と、空・大きすぎる画像は断る（境界値）", () => {
    expect(assertCaptureIsStorable({ ...submission, mimeType: "image/jpeg" }).ok).toBe(false);
    expect(assertCaptureIsStorable({ ...submission, byteLength: 0 }).ok).toBe(false);
    expect(assertCaptureIsStorable({ ...submission, byteLength: 4 * 1024 * 1024 }).ok).toBe(true);
    expect(assertCaptureIsStorable({ ...submission, byteLength: 4 * 1024 * 1024 + 1 }).ok).toBe(
      false,
    );
  });

  it("黒塗りだけは色を選べない", () => {
    expect(canChooseColor("redact")).toBe(false);
    expect(colorFor("redact", "red")).toBe(REDACT_COLOR);
    expect(colorFor("pen", "red")).toBe("red");
    expect([...ANNOTATION_TOOLS]).toContain("redact");
  });

  it("保存期間を過ぎた画像は期限切れになる（境界値）", () => {
    const storedAt = new Date("2026-01-01T00:00:00Z");
    const day = 24 * 60 * 60 * 1000;
    expect(isCaptureExpired(storedAt, new Date(storedAt.getTime() + day))).toBe(false);
    expect(
      isCaptureExpired(storedAt, new Date(storedAt.getTime() + CAPTURE_RETENTION_DAYS * day)),
    ).toBe(true);
  });

  it("保存期間は 180 日（日数そのものを押さえる）", () => {
    // 上の 1 件は境目を定数から作っている。**定数を動かすと境目も一緒に動く**ので、
    // 「180 日」が「179 日」に変わっても緑のまま通る（実際に測って緑だった）。
    // 数え方の検査と、数そのものの検査は別物なので、ここで数を名指しする。
    expect(CAPTURE_RETENTION_DAYS).toBe(180);
    const storedAt = new Date("2026-01-01T00:00:00Z");
    const day = 24 * 60 * 60 * 1000;
    expect(isCaptureExpired(storedAt, new Date(storedAt.getTime() + 179 * day))).toBe(false);
    expect(isCaptureExpired(storedAt, new Date(storedAt.getTime() + 180 * day))).toBe(true);
  });

  it("画像は指示文へ入れない", () => {
    expect(INCLUDE_CAPTURE_IN_PROMPT).toBe(false);
  });
});

describe("取りに来るときの鍵", () => {
  function issue(scopes: readonly ("read" | "update_status")[] = ["read"]) {
    return issueIntegrationKey({
      id: asIntegrationKeyId("key-1"),
      workspaceId: WORKSPACE,
      label: "Claude Code 用",
      hashedValue: "hashed-value",
      scopes,
      createdBy: "admin",
      at: AT,
    });
  }

  it("鍵は潰した値だけを持ち、平文を受け取る口が無い", () => {
    const result = issue();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value)).not.toContain("value");
    expect(result.value.hashedValue).toBe("hashed-value");
    expect(result.value.rateLimitPerMinute).toBe(DEFAULT_RATE_LIMIT_PER_MINUTE);
    expect(result.value.lastUsedAt).toBeNull();
  });

  it("名前と権限が無い鍵は作れない", () => {
    const noLabel = issueIntegrationKey({
      id: asIntegrationKeyId("key-2"),
      workspaceId: WORKSPACE,
      label: "  ",
      hashedValue: "h",
      scopes: ["read"],
      createdBy: "admin",
      at: AT,
    });
    expect(noLabel.ok).toBe(false);
    expect(issue([]).ok).toBe(false);
  });

  it("権限の外の操作は断る", () => {
    const key = issue(["read"]);
    if (!key.ok) throw new Error("前提が崩れています");
    expect(authorize(key.value, "read", AT).ok).toBe(true);
    const denied = authorize(key.value, "update_status", AT);
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe("FORBIDDEN");
    expect([...KEY_SCOPES]).toEqual(["read", "update_status"]);
  });

  it("失効した鍵は、権限があっても通らない（理由も失効だと分かる）", () => {
    const key = issue(["read"]);
    if (!key.ok) throw new Error("前提が崩れています");
    const revoked = revokeIntegrationKey(key.value, AT);
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(isRevoked(revoked.value, AT)).toBe(true);
    const result = authorize(revoked.value, "read", AT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNAUTHENTICATED");
    // 二重の失効は断る（記録が上書きされない）
    expect(revokeIntegrationKey(revoked.value, AT).ok).toBe(false);
  });

  it("使えたときだけ最終利用日時が進む", () => {
    const key = issue();
    if (!key.ok) throw new Error("前提が崩れています");
    const used = markUsed(key.value, new Date("2026-08-17T12:00:00Z"));
    expect(used.lastUsedAt?.toISOString()).toBe("2026-08-17T12:00:00.000Z");
    expect(key.value.lastUsedAt).toBeNull();
  });
});
