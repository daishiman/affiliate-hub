import { drizzle } from "drizzle-orm/d1";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { FeedbackRepositoryPort } from "@/application/ports/feedback";
import * as schema from "@/db/schema";
import { createAuditLogEntry } from "@/domain/compliance/audit-log";
import { DIAGNOSTICS_RETENTION_DAYS } from "@/domain/feedback/diagnostics-retention";
import {
  type AuditLogId,
  type UserId,
  type WorkspaceId,
  asWorkspaceId,
  taggedString,
} from "@/domain/shared";
import { createD1AuditLog } from "../persistence/d1/audit-log-repository";
import {
  createD1FeedbackRepository,
  listFeedbackWorkspaceIds,
} from "../persistence/d1/feedback-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * 改善要望の技術診断を、保持期限で消す定期実行（REQ-FB08 / REQ-TM09）。
 *
 * --- なぜここに置くのか（ユースケースではなく） ---
 *
 * 画像の掃除（`feedback-capture-r2.ts` の `sweepExpiredCaptures`）と同じ理由である。
 * 定期実行には**呼び出し元の身元が無い**ので、「誰の分を消すか」を渡せない。
 * だからといって「全作業場所ぶんを消す」口をポートに置くと、
 * 画面や道具の側から**他所の分まで消せる入口**ができてしまう。
 *
 * ポートに置くのは作業場所ごとの `purgeExpiredDiagnostics` だけにして、
 * 「どの作業場所を回すか」を知っているのはこのファイル 1 つにする。
 *
 * --- 失敗したときにどうするか ---
 *
 * **1 つの作業場所で失敗しても、残りは続ける。** 途中で投げ返すと、
 * 名前が先に来た 1 社の不調で、他社の分が永久に消えなくなる。
 *
 * **失敗した作業場所には記録を残さない。** 「消しました」の記録だけが残って
 * 中身が残っている状態は、証跡として嘘になる。何も消えていないので
 * 何も書かず、失敗を戻り値で返し、入口がそれを記録に出す。
 * 対象は消えずに残るので、**次の回がそのまま拾い直す**（再試行はこれで足りる）。
 *
 * --- 何度流しても同じになる ---
 *
 * 消し済みの行は `purgeExpiredDiagnostics` が数に入れない。件数が 0 の
 * 作業場所には記録も積まない。積むと、毎晩「0 件消しました」の行が増え、
 * 本当に消えた日を探せなくなる。
 */

/** 誰がこの削除を行ったか。**人でも AI でもない。時計である。** */
const PURGE_ACTOR_ID = "system:retention";

export type FeedbackDiagnosticsPurgeResult = {
  /** 期限切れの候補を持っていた作業場所の数。 */
  readonly workspaces: number;
  /** 実際に空にした要望の件数（全作業場所の合計）。 */
  readonly purged: number;
  /** 1 回の上限に達して、続きが残っている作業場所。 */
  readonly unfinished: readonly string[];
  /** 失敗した作業場所と、その理由。**黙って握りつぶさない。** */
  readonly failures: readonly { readonly workspaceId: string; readonly message: string }[];
};

export type FeedbackDiagnosticsPurgeDeps = {
  readonly repository: FeedbackRepositoryPort;
  readonly auditLog: AuditLogPort;
  /**
   * どの作業場所を回すか。**保存先そのものから読む。**
   *
   * 一覧を設定に書くと、作業場所を 1 つ増やした日から、そこだけ消えなくなる。
   * 増やした人がこのファイルを開く理由はどこにも無い。
   */
  readonly workspaceIds: () => Promise<readonly string[]>;
  readonly newId: () => string;
};

export async function purgeExpiredFeedbackDiagnostics(
  deps: FeedbackDiagnosticsPurgeDeps,
  now: Date,
): Promise<FeedbackDiagnosticsPurgeResult> {
  const ids = await deps.workspaceIds();
  let purged = 0;
  const unfinished: string[] = [];
  const failures: { workspaceId: string; message: string }[] = [];

  for (const id of ids) {
    const workspaceId: WorkspaceId = asWorkspaceId(id);
    const result = await deps.repository.purgeExpiredDiagnostics(workspaceId, now);
    if (!result.ok) {
      failures.push({ workspaceId: id, message: result.error.message });
      continue;
    }
    if (!result.value.finished) unfinished.push(id);
    if (result.value.purged === 0) continue;
    purged += result.value.purged;

    /*
     * 記録は**消したあとに**書く。先に書くと、書けたのに消せなかったときに
     * 「消しました」だけが残る。順番はこちら向きにしか倒せない。
     */
    const entry = createAuditLogEntry({
      id: taggedString<"AuditLogId">(`al_${deps.newId()}`) as AuditLogId,
      workspaceId,
      action: "feedback.diagnostics_purged",
      actor: {
        userId: taggedString<"UserId">(PURGE_ACTOR_ID) as UserId,
        isAiServiceAccount: false,
        modelId: null,
        // 人がログインして押したのではない。**確かめた身元ではないと明示する。**
        // ここを true にすると、「人が確認した」の数え上げにこの行が混ざる。
        identified: false,
      },
      targetType: "feedback_report",
      // 1 件ずつではなく作業場所ごとに 1 行にする。要望の id を並べると、
      // 消したはずの中身の手がかりが記録の側に残る。
      targetId: `retention:${id}`,
      after: {
        purgedCount: result.value.purged,
        retentionDays: DIAGNOSTICS_RETENTION_DAYS,
        finished: result.value.finished,
      },
      // 定期実行が回った時刻。**「今」を取り直さない。**
      // 取り直すと、同じ 1 回の実行の中で作業場所ごとに時刻がばらけ、
      // どこまでが同じ夜の作業だったのかを後から束ねられなくなる。
      occurredAt: now,
    });
    if (!entry.ok) {
      failures.push({ workspaceId: id, message: entry.error.message });
      continue;
    }
    const appended = await deps.auditLog.append(entry.value);
    if (!appended.ok) {
      // 消したのに記録が残らなかった。**これは失敗として数える。**
      // 消えたことは元に戻せないので、せめて気づける場所へ出す。
      failures.push({
        workspaceId: id,
        message: `技術情報は消しましたが、その記録を残せませんでした（${appended.error.message}）`,
      });
    }
  }

  return { workspaces: ids.length, purged, unfinished, failures };
}

/**
 * 保存先（D1）につないだ形。**入口はこれだけを呼ぶ。**
 *
 * 入口（`worker-entry.js`）は型検査の外側にあるので、組み立てをあちらに書くと
 * 「つなぎ間違えても誰も止めない」場所に配線が生まれる。ここに置けば型が見る。
 */
export function createD1FeedbackDiagnosticsPurge(db: DrizzleD1): FeedbackDiagnosticsPurgeDeps {
  return {
    repository: createD1FeedbackRepository(db),
    auditLog: createD1AuditLog(db),
    workspaceIds: () => listFeedbackWorkspaceIds(db),
    // 記録の id。作り方を知っているのは infrastructure だけでよい。
    newId: () => crypto.randomUUID(),
  };
}

/**
 * 定期実行から呼ぶ 1 本。**入口（`worker-entry.js`）が呼ぶのはこれだけ。**
 *
 * バインディングを受け取って接続を組み立てるところまでを含める。
 * `getDb()` を使わないのは、あちらがリクエストの文脈
 * （`getCloudflareContext`）から取るためで、定期実行にはその文脈が無い。
 */
export async function runFeedbackDiagnosticsPurge(
  binding: D1Database,
  now: Date,
): Promise<FeedbackDiagnosticsPurgeResult> {
  return await purgeExpiredFeedbackDiagnostics(
    createD1FeedbackDiagnosticsPurge(drizzle(binding, { schema })),
    now,
  );
}
