/**
 * @tier 1
 * @req REQ-FB07, REQ-FB08, REQ-FB09, REQ-FB12
 * @types audit-log, state-transition, permission-matrix, secrets
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { AppDeps } from "@/application/deps";
import { createHandOffFeedbackUseCase } from "@/application/usecases/feedback/hand-off-feedback";
import { createListFeedbackUseCase } from "@/application/usecases/feedback/list-feedback";
import { createManageIntegrationKeysUseCase } from "@/application/usecases/feedback/manage-integration-keys";
import { createReadFeedbackUseCase } from "@/application/usecases/feedback/read-feedback";
import { createSubmitFeedbackUseCase } from "@/application/usecases/feedback/submit-feedback";
import { createUpdateFeedbackStatusUseCase } from "@/application/usecases/feedback/update-feedback-status";
import {
  CAPTURE_RETENTION_DAYS,
  MAX_CAPTURE_BYTES,
  USER_TEXT_FENCE,
  WISH_ABSENT_TEXT,
} from "@/domain/feedback";
import type { ActorContext, Role } from "@/domain/shared";
import {
  clearFeedbackStore,
  clearIntegrationKeyStore,
} from "@/infrastructure/persistence/sample/feedback-sample-repository";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anAiAccount, anOwner } from "../support/actors";
import type { AuditLogPort } from "@/application/ports/compliance";
import { failing, recordingAuditLog, testDeps } from "../support/doubles";

/**
 * 改善要望（Product Feedback）のユースケース。
 *
 * --- ここで最も守りたいこと ---
 * 1. **他の作業場所の要望が見えない。** 画像には他社の画面が写り得るため、
 *    ここが漏れると取り返しがつかない。権限ではなく作業場所で確かめる。
 * 2. **画像が無くても要望は残る。** 画像で失敗して要望ごと消えると、
 *    送った人は「送ったのに無い」としか分からない。
 * 3. **渡す相手（Claude Code）に渡してよい範囲が、人の管理者より狭い。**
 *    状況は進められるが、扱いの決定と鍵の管理はできない。
 * 4. **1 件でもまとめてでも同じ道を通る。** まとめて渡す側だけ歯止めが
 *    抜けている状態を作らない。
 * 5. **平文の鍵は発行の 1 回しか現れない。** 一覧にも履歴にも出ない。
 *
 * 規範: docs/spec/13-改善要望フィードバック仕様.md / docs/architecture/feedback-loop.md §5
 */

/** ブランド担当者。送ることと見ることはできるが、扱いの決定と鍵の管理はできない。 */
const aBrandManager = (over: { workspaceId?: typeof WORKSPACE } = {}): ActorContext => ({
  workspaceId: over.workspaceId ?? WORKSPACE,
  userId: "user-brand",
  roles: ["brand_manager"] as readonly Role[],
  isAiServiceAccount: false,
  // 身元を確かめてある人。ここは権限の検査で、ログインの有無は見ていない。
  identified: true,
});

/** 別の作業場所の所有者。権限はあるが、こちらの要望は見えてはいけない。 */
const outsider = anOwner({ workspaceId: OTHER_WORKSPACE, userId: "user-outsider" });

/** 順番に増える ID。どの要望がどれか、失敗時のログから読めるようにする。 */
function seqIds(prefix: string) {
  let n = 0;
  return {
    newId: () => {
      n += 1;
      return `${prefix}-${n}`;
    },
  };
}

const AT = new Date("2026-08-16T09:00:00Z");

function origin(route = "/admin/rankings", screenName = "順位表") {
  return {
    screenName,
    url: `https://example.invalid${route}`,
    route,
    viewportWidth: 1280,
    viewportHeight: 800,
  };
}

function technical(over: Partial<{ jsErrors: readonly string[]; redactedCount: number }> = {}) {
  return {
    jsErrors: over.jsErrors ?? [],
    failedRequests: [],
    userAgent: "test",
    recentActions: ["画面を開いた"],
    redactedCount: over.redactedCount ?? 0,
  };
}

/** 焼き込み済みの正しい画像の申告。 */
function goodCapture(over: Partial<{ redactionsBurnedIn: boolean; retainsOriginal: boolean }> = {}) {
  return {
    image: new ArrayBuffer(64),
    submission: {
      redactionsBurnedIn: over.redactionsBurnedIn ?? true,
      retainsOriginal: over.retainsOriginal ?? false,
      redactionCount: 1,
      maskedElementCount: 2,
      byteLength: 64,
      mimeType: "image/png",
    },
  };
}

let deps: AppDeps;

function submitUseCase(
  ids = seqIds("fb"),
  at: Date = AT,
  auditLog: AuditLogPort = recordingAuditLog().port,
) {
  return createSubmitFeedbackUseCase({
    repository: deps.feedback,
    captures: deps.feedbackCaptures,
    ids,
    auditLog,
    now: () => at,
  });
}

const listUseCase = () => createListFeedbackUseCase({ repository: deps.feedback });
const readUseCase = () =>
  createReadFeedbackUseCase({ repository: deps.feedback, captures: deps.feedbackCaptures });
const statusUseCase = (auditLog: AuditLogPort = recordingAuditLog().port) =>
  createUpdateFeedbackStatusUseCase({
    repository: deps.feedback,
    ids: seqIds("al"),
    auditLog,
    now: () => AT,
  });
const handoffUseCase = (auditLog: AuditLogPort = recordingAuditLog().port) =>
  createHandOffFeedbackUseCase({
    repository: deps.feedback,
    templates: deps.handoffTemplates,
    ids: seqIds("al"),
    auditLog,
    now: () => AT,
  });

/** 発行のたびに違う平文を作る。同じ値を返すと「1 回だけ」の検査が空振りする。 */
function keysUseCase(auditLog: AuditLogPort = recordingAuditLog().port) {
  let n = 0;
  return createManageIntegrationKeysUseCase({
    keys: deps.integrationKeys,
    ids: seqIds("key"),
    mintSecret: async () => {
      n += 1;
      return { plainValue: `plain-value-${n}`.padEnd(40, "x"), hashedValue: `hashed-${n}` };
    },
    now: () => AT,
    auditLog,
  });
}

/** 1 件送って、その ID を返す。 */
async function submitOne(
  body: string,
  over: {
    wish?: string | null;
    route?: string;
    actor?: ActorContext;
    ids?: ReturnType<typeof seqIds>;
    at?: Date;
  } = {},
): Promise<string> {
  const result = await submitUseCase(over.ids ?? seqIds(`fb-${body.slice(0, 4)}`), over.at).execute(
    over.actor ?? anOwner(),
    {
      kind: "hard_to_use",
      body,
      wish: over.wish,
      origin: origin(over.route),
      technical: technical(),
    },
  );
  if (!result.ok) throw new Error(`送信できませんでした: ${result.error.message}`);
  return result.value.reportId;
}

beforeEach(() => {
  // 仮置きの保存先は実行中ずっと残る。試験どうしが干渉しないよう毎回戻す。
  clearFeedbackStore();
  clearIntegrationKeyStore();
  deps = testDeps();
});

describe("送る", () => {
  it("権限が無い人は送れない", async () => {
    const result = await submitUseCase().execute(aNobody(), {
      kind: "want_feature",
      body: "検索を付けてほしいです。",
      origin: origin(),
      technical: technical(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("ブランド担当者は送れる", async () => {
    const result = await submitUseCase().execute(aBrandManager(), {
      kind: "not_working",
      body: "保存を押しても反応がありません。",
      origin: origin(),
      technical: technical(),
    });

    expect(result.ok).toBe(true);
  });

  it("画像を付けなくても送れる（付けないことを選べる）", async () => {
    const result = await submitUseCase().execute(anOwner(), {
      kind: "hard_to_use",
      body: "文字が小さくて読みにくいです。",
      origin: origin(),
      technical: technical(),
      capture: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.captureStored).toBe(false);
      // 付けなかっただけなので、問題としては扱わない。
      expect(result.value.captureIssue).toBeNull();
    }
  });

  it("画面にブランドとサイトの文脈があるときは、要望にも両方を結び付ける", async () => {
    const result = await submitUseCase().execute(anOwner(), {
      kind: "hard_to_use",
      body: "この記事だけ、商品リンクの位置が分かりにくいです。",
      origin: origin("/admin/content/article-1", "記事の編集"),
      technical: technical(),
      brandId: "br_context",
      siteId: "st_context",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const read = await readUseCase().execute(anOwner(), { id: result.value.reportId });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.brandId).toBe("br_context");
    expect(read.value.siteId).toBe("st_context");
  });

  it("焼き込んでいない画像は保存しないが、要望そのものは残る", async () => {
    const result = await submitUseCase().execute(anOwner(), {
      kind: "not_working",
      body: "一覧が真っ白になります。",
      origin: origin(),
      technical: technical(),
      capture: goodCapture({ redactionsBurnedIn: false }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.captureStored).toBe(false);
    expect(result.value.captureIssue).toContain("焼き込まれていません");

    // 画像で失敗しても、送った本人の要望は読める状態になっている。
    const read = await readUseCase().execute(anOwner(), { id: result.value.reportId });
    expect(read.ok).toBe(true);
  });

  it("正しい画像は保存され、要望に結び付く", async () => {
    const result = await submitUseCase().execute(anOwner(), {
      kind: "not_working",
      body: "並び替えが効きません。",
      origin: origin(),
      technical: technical(),
      capture: goodCapture(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.captureStored).toBe(true);
      expect(result.value.captureIssue).toBeNull();
    }
  });

  it("画像の上限は 4MB、保存期間は 180 日（数字を画面と試験で二重に持たない）", () => {
    expect(MAX_CAPTURE_BYTES).toBe(4 * 1024 * 1024);
    expect(CAPTURE_RETENTION_DAYS).toBe(180);
  });
});

describe("一覧", () => {
  it("新しい順に並び、状態ごとの件数が同じ呼び出しで返る", async () => {
    // 送った順とは逆に並ぶことを見るため、時刻を分けて入れる。
    await submitOne("古いほうの要望です。", { at: new Date("2026-08-10T00:00:00Z") });
    await submitOne("新しいほうの要望です。", { at: new Date("2026-08-15T00:00:00Z") });

    const listed = await listUseCase().execute(anOwner(), {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows.map((r) => r.summary)).toEqual([
      "新しいほうの要望です。",
      "古いほうの要望です。",
    ]);
    // 件数は一覧と同じ呼び出しで返る（別々に取ると食い違う）。
    expect(listed.value.counts.open).toBe(2);
    expect(listed.value.counts.resolved).toBe(0);
  });

  it("別の作業場所の人には 1 件も見えない", async () => {
    await submitOne("こちらの作業場所の要望です。");

    const listed = await listUseCase().execute(outsider, {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows).toHaveLength(0);
    // 「まだ無い」と伝える。相手の作業場所に何件あるかは、件数としても漏らさない。
    expect(listed.value.emptyReason).toContain("まだ改善要望はありません");
  });

  it("絞り込みで 0 件のときは、絞り込みのせいだと分かる文が出る", async () => {
    await submitOne("使いにくいところの話です。");

    const listed = await listUseCase().execute(anOwner(), { statuses: ["resolved"] });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows).toHaveLength(0);
    expect(listed.value.emptyReason).toContain("絞り込み");
  });

  it("見ることができない人には一覧を返さない", async () => {
    const listed = await listUseCase().execute(aNobody(), {});
    expect(listed.ok).toBe(false);
  });
});

describe("読む", () => {
  it("「どうなってほしいか」が空なら、無いと書いて返す（空欄にしない）", async () => {
    const id = await submitOne("押しても何も起きません。", { wish: null });

    const read = await readUseCase().execute(anOwner(), { id });

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.wishProvided).toBe(false);
    expect(read.value.wishText).toBe(WISH_ABSENT_TEXT);
  });

  it("画像が無い理由を返す（黙って欄を消さない）", async () => {
    const id = await submitOne("表の幅が狭いです。");

    const read = await readUseCase().execute(anOwner(), { id });

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.captureUrl).toBeNull();
    expect(read.value.captureAbsentReason).toContain("画像は付いていません");
  });

  it("別の作業場所からは「見つからない」になる（あることも伝えない）", async () => {
    const id = await submitOne("こちらの作業場所の要望です。");

    const read = await readUseCase().execute(outsider, { id });

    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("NOT_FOUND");
  });
});

describe("対応状況と扱い", () => {
  it("取りに来た側（Claude Code）は状況を進められる", async () => {
    const id = await submitOne("読み込みが遅いです。");

    const updated = await statusUseCase().execute(anAiAccount(), { id, status: "in_progress" });

    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value.statusLabel).toBe("対応中");
  });

  it("取りに来た側は扱いを決められない（人だけができる）", async () => {
    const id = await submitOne("重複していそうな要望です。");

    const updated = await statusUseCase().execute(anAiAccount(), {
      id,
      disposition: { kind: "will_not_fix", reason: "方針に合わないため" },
    });

    expect(updated.ok).toBe(false);
    if (!updated.ok) expect(updated.error.code).toBe("FORBIDDEN");
  });

  it("何も指定しない変更は受け付けない（空の履歴を積まない）", async () => {
    const id = await submitOne("特に変えることのない要望です。");

    const updated = await statusUseCase().execute(anOwner(), { id });

    expect(updated.ok).toBe(false);
    if (!updated.ok) expect(updated.error.code).toBe("VALIDATION_FAILED");

    const read = await readUseCase().execute(anOwner(), { id });
    // 届いた 1 行だけのまま。
    if (read.ok) expect(read.value.history).toHaveLength(1);
  });

  it("見送るときは理由が要る", async () => {
    const id = await submitOne("見送る予定の要望です。");

    const withoutReason = await statusUseCase().execute(anOwner(), { id, status: "declined" });
    expect(withoutReason.ok).toBe(false);

    const withReason = await statusUseCase().execute(anOwner(), {
      id,
      status: "declined",
      note: "同じ内容を別の要望で扱うため",
    });
    expect(withReason.ok).toBe(true);
  });

  it("1 回の変更で履歴はちょうど 1 行増える", async () => {
    const id = await submitOne("履歴の数を確かめる要望です。");

    await statusUseCase().execute(anOwner(), { id, status: "in_progress" });
    const read = await readUseCase().execute(anOwner(), { id });

    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.history).toHaveLength(2);
  });
});

describe("払い出し", () => {
  it("まとめて渡しても、渡せなかったものは理由つきで残る（黙って落とさない）", async () => {
    const first = await submitOne("1 件目の要望です。");
    const second = await submitOne("2 件目の要望です。");

    const handed = await handoffUseCase().execute(anOwner(), {
      ids: [first, second, "fb-存在しない"],
      route: "copied_by_human",
    });

    expect(handed.ok).toBe(true);
    if (!handed.ok) return;
    expect(handed.value.prompts).toHaveLength(2);
    expect(handed.value.skipped).toHaveLength(1);
    expect(handed.value.skipped[0]?.reason).toContain("見つかりません");
  });

  it("指示文には本文が入り、囲いの中に収まっている", async () => {
    const id = await submitOne("並び替えの見た目を直したいです。");

    const handed = await handoffUseCase().execute(anOwner(), {
      ids: [id],
      route: "copied_by_human",
    });

    expect(handed.ok).toBe(true);
    if (!handed.ok) return;
    const prompt = handed.value.prompts[0];
    expect(prompt?.text).toContain("並び替えの見た目を直したいです。");
    expect(prompt?.userBlock).toContain(USER_TEXT_FENCE);
    // 本文は囲いより後ろにしか現れない（封筒側に混ざっていない）。
    const fenceAt = prompt?.text.indexOf(USER_TEXT_FENCE) ?? -1;
    expect(prompt?.text.indexOf("並び替えの見た目") ?? -1).toBeGreaterThan(fenceAt);
  });

  it("下読み（previewOnly）では渡した記録が増えない", async () => {
    const id = await submitOne("下読みだけする要望です。");

    await handoffUseCase().execute(anOwner(), {
      ids: [id],
      route: "copied_by_human",
      previewOnly: true,
    });
    const read = await readUseCase().execute(anOwner(), { id });

    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.handoffCount).toBe(0);
      expect(read.value.handoffHistoryEmptyText).toContain("まだ渡した記録はありません");
    }
  });

  it("2 回渡しても指示文は同じで、回数だけが増える", async () => {
    const id = await submitOne("2 回渡す要望です。");
    const useCase = handoffUseCase();

    const first = await useCase.execute(anOwner(), { ids: [id], route: "copied_by_human" });
    const second = await useCase.execute(anOwner(), { ids: [id], route: "copied_by_human" });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.prompts[0]?.fingerprint).toBe(first.value.prompts[0]?.fingerprint);
    expect(second.value.idempotencyText).toContain("もう一度渡しても中身は同じ");

    const read = await readUseCase().execute(anOwner(), { id });
    if (read.ok) expect(read.value.handoffCount).toBe(2);
  });

  it("取りに来た経路では「どの鍵で」が履歴に残り、値そのものは残らない", async () => {
    const id = await submitOne("取りに来てもらう要望です。");

    await handoffUseCase().execute(anOwner(), {
      ids: [id],
      route: "pulled_by_agent",
      keyId: "key-1",
      keyLabel: "Claude Code 用",
    });
    const read = await readUseCase().execute(anOwner(), { id });

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const row = read.value.handoffHistory[0];
    expect(row?.routeLabel).toBe("Claude Code が取得");
    expect(row?.keyId).toBe("key-1");
    // 履歴のどこにも平文らしきものが無い。
    expect(JSON.stringify(read.value.handoffHistory)).not.toContain("plain-value");
  });

  it("1 件も選ばれていない払い出しは受け付けない", async () => {
    const handed = await handoffUseCase().execute(anOwner(), {
      ids: [],
      route: "copied_by_human",
    });
    expect(handed.ok).toBe(false);
  });

  it("見ることができない人は払い出せない", async () => {
    const handed = await handoffUseCase().execute(aNobody(), {
      ids: ["fb-1"],
      route: "copied_by_human",
    });
    expect(handed.ok).toBe(false);
  });
});

describe("誰が進めたかの記録", () => {
  it("送ると、種類と出どころは残るが、本文は残らない", async () => {
    const audit = recordingAuditLog();
    const body = "取引先の A 社の見積が 1,200,000 円で表示されません。";

    const sent = await submitUseCase(seqIds("fb-rec"), AT, audit.port).execute(anOwner(), {
      kind: "not_working",
      body,
      origin: origin("/admin/conversions", "成果の一覧"),
      technical: technical(),
    });
    expect(sent.ok).toBe(true);

    expect(audit.actions()).toEqual(["feedback.submitted"]);
    const after = audit.entries()[0]?.after as Record<string, unknown>;
    expect(after.kind).toBe("not_working");
    expect(after.route).toBe("/admin/conversions");
    /*
     * **本文が記録側へ写っていないこと。** 要望の本文には、送った人が
     * その画面で見ていたものがそのまま書かれる（ここでは取引先名と金額）。
     * 記録は後から広く読まれるので、写すと要望側の扱いが意味を失う。
     */
    expect(JSON.stringify(audit.entries())).not.toContain("A 社");
    expect(JSON.stringify(audit.entries())).not.toContain("1,200,000");
  });

  it("扱いを変えると、変える前の状態と理由が 1 行で残る", async () => {
    const audit = recordingAuditLog();
    const id = await submitOne("後回しにしてよい要望です。");

    const updated = await statusUseCase(audit.port).execute(anOwner(), {
      id,
      status: "in_progress",
      disposition: { kind: "will_not_fix", reason: "別の画面で代用できるため" },
    });
    expect(updated.ok).toBe(true);

    // 状態と扱いを同時に変えても **1 行**。行数と押した回数を一致させる。
    expect(audit.actions()).toEqual(["feedback.status_changed"]);
    const entry = audit.entries()[0]!;
    expect((entry.before as Record<string, unknown>).status).toBe("open");
    expect((entry.before as Record<string, unknown>).disposition).toBeNull();
    expect((entry.after as Record<string, unknown>).disposition).toBe("will_not_fix");
    expect(entry.reason).toBe("別の画面で代用できるため");
  });

  it("払い出すと、経路と指紋は残るが、文面そのものは残らない", async () => {
    const audit = recordingAuditLog();
    const id = await submitOne("払い出しの記録を見るための要望です。");

    const handed = await handoffUseCase(audit.port).execute(anOwner(), {
      ids: [id],
      route: "copied_by_human",
    });
    expect(handed.ok).toBe(true);
    if (!handed.ok) return;

    expect(audit.actions()).toEqual(["feedback.handed_off"]);
    const after = audit.entries()[0]?.after as Record<string, unknown>;
    expect(after.route).toBe("copied_by_human");
    expect(after.promptFingerprint).toBe(handed.value.prompts[0]?.fingerprint);
    // 同じ文面かどうかは指紋で判る。中身を記録側へ複製する理由が無い。
    expect(JSON.stringify(audit.entries())).not.toContain("払い出しの記録を見るための要望です。");
  });

  it("下読み（previewOnly）は、渡した扱いにならないので記録も積まない", async () => {
    const audit = recordingAuditLog();
    const id = await submitOne("下読みだけする要望です。");

    const handed = await handoffUseCase(audit.port).execute(anOwner(), {
      ids: [id],
      route: "copied_by_human",
      previewOnly: true,
    });
    expect(handed.ok).toBe(true);
    // 見ただけで「渡した」が積まれると、渡した回数が実態より増える。
    expect(audit.actions()).toEqual([]);
  });

  it("記録を残せないときは、どれも成功として返さない", async () => {
    const broken: AuditLogPort = {
      append: async () => failing<never>("記録の保存先に届きません"),
      listByTarget: async () => failing<never>("記録の保存先に届きません"),
      search: async () => failing<never>("記録の保存先に届きません"),
    };
    const id = await submitOne("記録が落ちる場合を見るための要望です。");

    const sent = await submitUseCase(seqIds("fb-ng"), AT, broken).execute(anOwner(), {
      kind: "hard_to_use",
      body: "記録が落ちる場合の送信です。",
      origin: origin(),
      technical: technical(),
    });
    expect(sent.ok).toBe(false);
    // 断り文は「済んだこと」を隠さない。隠すと、届いているのにもう一度送られる。
    if (!sent.ok) expect(sent.error.message).toContain("要望は届いていて");

    const updated = await statusUseCase(broken).execute(anOwner(), { id, status: "in_progress" });
    expect(updated.ok).toBe(false);

    const handed = await handoffUseCase(broken).execute(anOwner(), {
      ids: [id],
      route: "copied_by_human",
    });
    expect(handed.ok).toBe(false);
  });
});

describe("取りに来るときの鍵", () => {
  it("平文が返るのは発行の 1 回だけで、一覧には出ない", async () => {
    const useCase = keysUseCase();

    const issued = await useCase.execute(anOwner(), {
      action: "issue",
      label: "Claude Code 用",
      scopes: ["read"],
    });
    const listed = await useCase.execute(anOwner(), { action: "list" });

    expect(issued.ok).toBe(true);
    if (!issued.ok || !listed.ok) return;
    expect(issued.value.issuedValue).toContain("plain-value-1");
    expect(issued.value.shownOnceText).toContain("今回だけ");

    // 一覧では null。行のどこにも平文が現れない。
    expect(listed.value.issuedValue).toBeNull();
    expect(JSON.stringify(listed.value.rows)).not.toContain("plain-value");
    expect(JSON.stringify(listed.value.rows)).not.toContain("hashed-");
  });

  it("一度も使われていない鍵は空欄ではなく文で示す", async () => {
    const useCase = keysUseCase();
    await useCase.execute(anOwner(), { action: "issue", label: "未使用の鍵", scopes: ["read"] });

    const listed = await useCase.execute(anOwner(), { action: "list" });

    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.rows[0]?.lastUsedText).toContain("まだ使われていません");
  });

  it("失効させても一覧からは消えない（どの鍵で取ったかを後から読めるようにする）", async () => {
    const useCase = keysUseCase();
    const issued = await useCase.execute(anOwner(), {
      action: "issue",
      label: "使い終わった鍵",
      scopes: ["read"],
    });
    if (!issued.ok) throw new Error("発行できませんでした");
    const id = (await useCase.execute(anOwner(), { action: "list" })) as {
      ok: true;
      value: { rows: readonly { id: string }[] };
    };

    const revoked = await useCase.execute(anOwner(), {
      action: "revoke",
      id: id.value.rows[0]?.id ?? "",
    });

    expect(revoked.ok).toBe(true);
    if (revoked.ok) {
      expect(revoked.value.rows).toHaveLength(1);
      expect(revoked.value.rows[0]?.revoked).toBe(true);
    }
  });

  it("同じ鍵を二度は失効させられない", async () => {
    const useCase = keysUseCase();
    await useCase.execute(anOwner(), { action: "issue", label: "二度失効の鍵", scopes: ["read"] });
    const listed = await useCase.execute(anOwner(), { action: "list" });
    if (!listed.ok) throw new Error("一覧が読めませんでした");
    const id = listed.value.rows[0]?.id ?? "";

    await useCase.execute(anOwner(), { action: "revoke", id });
    const second = await useCase.execute(anOwner(), { action: "revoke", id });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("CONFLICT");
  });

  it("ブランド担当者は鍵を管理できない", async () => {
    const result = await keysUseCase().execute(aBrandManager(), { action: "list" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("取りに来る側（AI）自身は鍵を管理できない", async () => {
    const result = await keysUseCase().execute(anAiAccount(), { action: "list" });
    expect(result.ok).toBe(false);
  });

  it("鍵が 1 つも無いときは、無い理由と作るべき場面を返す", async () => {
    const listed = await keysUseCase().execute(anOwner(), { action: "list" });

    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.emptyReason).toContain("Claude Code");
  });

  /*
   * 鍵は外から中身を取りに来るための入口。
   * 「いつ誰が出したか」と「いつ止めたか」が残っていないと、
   * 漏れたかもしれないときに、どこまで疑えばよいかが決められない。
   */
  describe("鍵の出し入れの記録", () => {
    it("発行と失効を、別の言葉で残す", async () => {
      const audit = recordingAuditLog();
      const useCase = keysUseCase(audit.port);

      const issued = await useCase.execute(anOwner(), {
        action: "issue",
        label: "Claude Code 用",
        scopes: ["read"],
      });
      if (!issued.ok) throw issued.error;
      const id = issued.value.rows[0].id;
      await useCase.execute(anOwner(), { action: "revoke", id });

      expect(audit.actions()).toEqual(["integration_key.issued", "integration_key.revoked"]);
      expect(audit.entries()[1].targetId).toBe(id);
    });

    it("鍵そのものは記録に入れない", async () => {
      const audit = recordingAuditLog();
      await keysUseCase(audit.port).execute(anOwner(), {
        action: "issue",
        label: "Claude Code 用",
        scopes: ["read"],
      });

      const dumped = JSON.stringify(audit.entries());
      // 平文も、それを潰した値も。一度だけ見せる作りをここで崩さない。
      expect(dumped).not.toContain("plain-value");
      expect(dumped).not.toContain("hashed-");
    });

    it("記録が残せないときは、鍵を渡さずに断る", async () => {
      const useCase = keysUseCase({
        ...recordingAuditLog().port,
        append: async () => failing("記録の保存先に繋がりません。"),
      });

      const issued = await useCase.execute(anOwner(), {
        action: "issue",
        label: "Claude Code 用",
        scopes: ["read"],
      });

      expect(issued.ok).toBe(false);
      if (issued.ok) return;
      // 一覧には並ぶが使えない鍵が残る。それを隠さず書く。
      expect(issued.error.message).toContain("使えません");
    });
  });
});
