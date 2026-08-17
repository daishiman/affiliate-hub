import type {
  FeedbackCaptureStoragePort,
  FeedbackFilter,
  FeedbackRepositoryPort,
  IntegrationKeyPort,
} from "@/application/ports/feedback";
import {
  type FeedbackReport,
  type IntegrationKey,
  assertCaptureIsStorable,
  createFeedbackReport,
  hasBeenHandedOff,
  isCaptureExpired,
  markUsed,
} from "@/domain/feedback";
import {
  asFeedbackReportId,
  asUserId,
  asWorkspaceId,
  err,
  ok,
} from "@/domain/shared";
import { registerStub, stubCall, stubFailure, stubReason } from "../../stub-registry";

/**
 * ★ これは保存先が無いときの控えです（見本データ）。★
 *
 * **この実行中だけ覚えます。再起動すると消えます。**
 * できたふりではなく、本当に受け取って本当に絞り込んでいる。
 * 置き場所がメモリなので長くは残らない。
 *
 * 本物（D1）は `../d1/feedback-repository.ts` にある。
 * `feedback_reports` / `integration_keys` / `integration_key_usages` の
 * 3 つの表を作って、composition.ts の 2 行が接続の有無で選び分けている。
 *
 * **それでもこの実装は消せない。** Workers の外（`pnpm dev`・自動テスト）では
 * 接続が供給されないので、消すと画面が開かなくなる。
 * ただし**黙って控えへ落ちることはしない**。何で動いているかは画面に文字で出す。
 *
 * 残っているのは画面の写し（R2）だけで、そちらは下の `captureStub` にある。
 *
 * **絞り込みは必ず workspaceId から始める。**
 * 見本であっても、ここで手を抜くと本物へ移すときに同じ手抜きが写る。
 */
const stub = registerStub({
  id: "persistence:feedback-memory",
  port: "改善要望の記録先",
  label: "改善要望の記録（この実行中だけ覚える仮置き）",
  blockedBy: "済み。保存先が無い環境（pnpm dev・自動テスト）での控えとして残す",
  fallbackFor: "src/infrastructure/persistence/d1/feedback-repository.ts",
});

const captureStub = registerStub({
  id: "storage:feedback-capture-memory",
  port: "画面の写しの置き場",
  label: "画面の写し（この実行中だけ覚える仮置き。表示用の口はまだありません）",
  blockedBy: "R2 バケットと、期限つき URL を配る口の用意",
});

export function feedbackStubNotice(): string {
  return `${stub.label}。${stubReason(stub)}。`;
}

const WS = asWorkspaceId("ws_sample");

function sampleReport(input: {
  id: string;
  kind: "not_working" | "hard_to_use" | "want_feature";
  body: string;
  wish: string | null;
  screenName: string;
  route: string;
  at: string;
  jsErrors?: readonly string[];
}): FeedbackReport {
  const created = createFeedbackReport({
    id: asFeedbackReportId(input.id),
    workspaceId: WS,
    kind: input.kind,
    body: input.body,
    wish: input.wish,
    origin: {
      screenName: input.screenName,
      url: `https://example.invalid${input.route}`,
      route: input.route,
      viewportWidth: 1440,
      viewportHeight: 900,
    },
    technical: {
      jsErrors: input.jsErrors ?? [],
      failedRequests: [],
      userAgent: "見本のため実際の環境情報は入っていません",
      recentActions: ["画面を開いた", "並び替えを押した"],
      redactedCount: 0,
    },
    submittedBy: asUserId("user_sample_admin"),
    at: new Date(input.at),
  });
  // 見本の作り方が規則に反していたら、ここで気づけるようにする。
  if (!created.ok) throw new Error(`見本の改善要望が作れません: ${created.error.message}`);
  return created.value;
}

/**
 * 見本には**わざと 3 通り**入れてある。
 *   1. 「どうなってほしいか」まで書かれたもの
 *   2. 本文だけのもの（詳細画面で「記入はありません」が出ることを確かめる）
 *   3. エラーが出ていたもの（件数が 0 でない表示を確かめる）
 * 良く書けた要望だけが並ぶ画面を作らないため。実際にはこの 3 通りが混ざる。
 */
const SEED: readonly FeedbackReport[] = [
  sampleReport({
    id: "fb_sample_sort",
    kind: "hard_to_use",
    body: "順位表の並び替えが、押しても効いているのか分かりません。押した直後に何も変わらない列があります。",
    wish: "並び替えたときに、いまどの列で並んでいるのかが分かるようにしてほしいです。",
    screenName: "順位表",
    route: "/admin/rankings",
    at: "2026-08-12T01:00:00Z",
  }),
  sampleReport({
    id: "fb_sample_draft",
    kind: "want_feature",
    body: "記事の下書きを作る前に、似た記事がすでにあるかどうかを見たいです。",
    wish: null,
    screenName: "記事の進行",
    route: "/admin/content",
    at: "2026-08-14T02:30:00Z",
  }),
  sampleReport({
    id: "fb_sample_error",
    kind: "not_working",
    body: "リンクの受信箱を開くと、白いままで何も出ません。もう一度読み込むと出ることがあります。",
    wish: "開いたときに必ず出るようにしてほしいです。",
    screenName: "リンクの受信箱",
    route: "/admin/links/inbox",
    at: "2026-08-15T04:10:00Z",
    jsErrors: ["TypeError: Cannot read properties of null"],
  }),
];

const reports = new Map<string, FeedbackReport>(SEED.map((r) => [String(r.id), r]));

export function clearFeedbackStore(): void {
  reports.clear();
  for (const r of SEED) reports.set(String(r.id), r);
}

function matches(report: FeedbackReport, filter: FeedbackFilter | undefined): boolean {
  if (filter === undefined) return report.disposition?.kind !== "discarded";
  if (filter.includeDiscarded !== true && report.disposition?.kind === "discarded") return false;
  if (filter.statuses !== undefined && !filter.statuses.includes(report.status)) return false;
  if (filter.kinds !== undefined && !filter.kinds.includes(report.kind)) return false;
  if (filter.route !== undefined && report.origin.route !== filter.route) return false;
  if (filter.handedOff !== undefined && hasBeenHandedOff(report.handoff) !== filter.handedOff) {
    return false;
  }
  return true;
}

export function createSampleFeedbackRepository(): FeedbackRepositoryPort {
  return {
    async save(workspaceId, report) {
      if (report.workspaceId !== workspaceId) {
        // 別の作業場所のものを書き込ませない。見本でも通さない。
        return err(stubFailure(stub, "別の作業場所の要望の保存"));
      }
      reports.set(String(report.id), report);
      return ok(true);
    },

    async findById(workspaceId, id) {
      const found = reports.get(id);
      // 他の作業場所のものは「無い」と答える。存在の有無も漏らさない。
      if (found === undefined || found.workspaceId !== workspaceId) return ok(null);
      return ok(found);
    },

    async list(workspaceId, filter) {
      const rows = [...reports.values()].filter(
        (r) => r.workspaceId === workspaceId && matches(r, filter),
      );
      return ok(rows);
    },
  };
}

/** 画面の写しの中身。表示用の口ができるまで、ここから外へは出ない。 */
const captures = new Map<string, { bytes: ArrayBuffer; storedAt: Date }>();

export function createSampleFeedbackCaptureStore(): FeedbackCaptureStoragePort {
  return {
    async put(workspaceId, id, image, submission) {
      // 焼き込み済みかどうかの判定は domain が持つ。ここでは通すだけ。
      const allowed = assertCaptureIsStorable(submission);
      if (!allowed.ok) return allowed;
      captures.set(`${String(workspaceId)}/${String(id)}`, {
        bytes: image,
        storedAt: new Date(),
      });
      return ok({ key: `${String(workspaceId)}/${String(id)}.png` });
    },

    async signedUrl() {
      // 受け取ってはいるが、配る口がまだ無い。
      // ここで適当な URL を返すと、画面には出るのに開けない状態になり、
      // 「保存できていない」のか「表示できない」のかが分からなくなる。
      return stubCall(captureStub, "期限つき URL の発行");
    },

    async deleteExpired(workspaceId, now) {
      let deleted = 0;
      for (const [key, value] of captures) {
        if (!key.startsWith(`${String(workspaceId)}/`)) continue;
        if (isCaptureExpired(value.storedAt, now)) {
          captures.delete(key);
          deleted += 1;
        }
      }
      return ok({ deleted });
    },
  };
}

/**
 * 取りに来るときの鍵の置き場（仮）。
 *
 * **潰した値しか入らない。** 平文は入口（ユースケース）で 1 度返るだけで、
 * ここには届かない。届かないので、ここの実装をどう間違えても平文は残らない。
 */
const storedKeys = new Map<string, IntegrationKey>();

/** 直近 1 分の利用回数。回数の上限を本当に数えるために持つ。 */
const usageTimes = new Map<string, Date[]>();

export function clearIntegrationKeyStore(): void {
  storedKeys.clear();
  usageTimes.clear();
}

export function createSampleIntegrationKeyStore(options: {
  /** 平文を潰す。作り方は platform 側が持つ。 */
  readonly hash: (plainValue: string) => Promise<string>;
}): IntegrationKeyPort {
  return {
    async issue(workspaceId, key) {
      if (key.workspaceId !== workspaceId) {
        return err(stubFailure(stub, "別の作業場所の鍵の発行"));
      }
      storedKeys.set(String(key.id), key);
      return ok(true);
    },

    async list(workspaceId) {
      return ok([...storedKeys.values()].filter((k) => k.workspaceId === workspaceId));
    },

    async revoke(workspaceId, id, at) {
      const found = storedKeys.get(String(id));
      if (found === undefined || found.workspaceId !== workspaceId) {
        return err(stubFailure(stub, "見つからない鍵の失効"));
      }
      storedKeys.set(String(id), { ...found, revokedAt: at });
      return ok(true);
    },

    async authenticate(plainValue) {
      const hashed = await options.hash(plainValue);
      // 見つからない場合も同じ形で返す。どの鍵が存在するかを漏らさない。
      const found = [...storedKeys.values()].find((k) => k.hashedValue === hashed);
      return ok(found ?? null);
    },

    async withinRateLimit(id, now) {
      const key = storedKeys.get(String(id));
      if (key === undefined) return ok(false);
      const oneMinuteAgo = now.getTime() - 60_000;
      const recent = (usageTimes.get(String(id)) ?? []).filter(
        (t) => t.getTime() > oneMinuteAgo,
      );
      usageTimes.set(String(id), recent);
      return ok(recent.length < key.rateLimitPerMinute);
    },

    async recordUsage(workspaceId, usage) {
      const key = storedKeys.get(String(usage.keyId));
      if (key === undefined || key.workspaceId !== workspaceId) {
        return err(stubFailure(stub, "見つからない鍵の利用の記録"));
      }
      storedKeys.set(String(usage.keyId), markUsed(key, usage.at));
      usageTimes.set(String(usage.keyId), [
        ...(usageTimes.get(String(usage.keyId)) ?? []),
        usage.at,
      ]);
      return ok(true);
    },
  };
}

/** 試験から鍵を直接置くための口（本番の経路では使わない）。 */
export function seedIntegrationKey(key: IntegrationKey): void {
  storedKeys.set(String(key.id), key);
}
