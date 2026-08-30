import type { AuditLogPort } from "@/application/ports/compliance";
import type { AuditLogEntry } from "@/domain/compliance";
import { ok, taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "./sample-identity";
import { registerStub, stubCall, stubReason } from "../../stub-registry";

/**
 * ★ これは仮置きの記録先です（スタブ）。★
 *
 * **この実行中だけ覚えます。再起動すると消えます。**
 *
 * --- なぜ「必ず断る」から「本当に書き足す」へ変えたか（2026-08-18） ---
 *
 * ここは以前 `append` が必ず失敗する実装だった。保存先が無いのに
 * 成功を装わないためで、その判断自体は正しい。ただしその結果、
 * **記録を残す操作（承認・公開・鍵の発行・受信箱を進める）は、
 * 見本の段では 1 つも通らなかった**。
 *
 * 正しく断られていることと、確かめられていることは別である。
 * 断り続けているあいだ、その先の処理については何も分かっていなかった。
 *
 * そこでメモリの控えにした。**偽の成功ではない。**
 * 本当に配列へ積み、本当に読み返せる。置き場所が短命なだけである。
 *
 * --- 引き換えに必ず守ること ---
 *
 * 記録は「残った」と言えること自体が意味を持つ唯一の種類なので、
 * 控えで動いているあいだは**必ず画面に文字で出す**
 * （`src/presentation/composition.ts` の `auditLogNotice()`）。
 * **黙って控えへ落ちる監査記録は、無いより悪い。**
 * 残っていると思われて、残っていないため。
 *
 * 断られる側の道は消していない。`createUnavailableAuditLog()` が
 * 以前と同じく必ず失敗を返す。記録が残せないときの断り方を見る試験は
 * そちらを指す。
 */
const stub = registerStub({
  id: "persistence:audit-log-memory",
  port: "操作の記録先",
  label: "操作の記録（この実行中だけ覚える仮置き）",
  blockedBy: "済み（保存先は D1 の audit_logs）",
  fallbackFor: "src/infrastructure/persistence/d1/audit-log-repository.ts",
});

export function auditLogStubNotice(): string {
  return `${stub.label}。${stubReason(stub)}。この実行を終えると消えます。`;
}

/**
 * 見本の記録。画面が空のままだと「記録が動いていない」のか
 * 「まだ何もしていない」のか区別がつかない。
 *
 * `workspaceId` を全件に入れてあるのは、読み出しが作業場所で絞れることを
 * 見本データの上でも確かめられるようにするため。
 *
 * --- 見本に置いてよい語の条件（2026-08-21 に決めた） ---
 *
 * **実処理から出す場所を持つ語しか置かない。**
 * ここには以前 `content.created`（記事を作った）と
 * `ranking_model.changed`（評価基準を変えた）が並んでいた。どちらも
 * **その行を作る操作がどこにも無い**語で、画面には記録が並ぶのに
 * 実際には 1 行も増えない。見本を消すまで誰も気づけない形である。
 *
 * 出す場所のある語だけにすると、見本の行は「実際に起きうる操作」の
 * 見本になる。`tests/architecture/audit-action-emitters.test.ts` が
 * 「見本にしか無い語 0」を見張っているので、ここへ出す場所の無い語を
 * 足すと赤になる。
 */
const SEED_ENTRIES: readonly AuditLogEntry[] = [
  {
    id: taggedString<"AuditLogId">("al_3"),
    workspaceId: SAMPLE_WORKSPACE_ID,
    action: "content.approved",
    actor: {
      userId: taggedString<"UserId">("u_owner"),
      isAiServiceAccount: false,
      modelId: null,
      // 見本の持ち主は、ログイン済みの人として置いてある。
      identified: true,
    },
    targetType: "content_package",
    targetId: "cp_alpha_01",
    before: null,
    after: null,
    requestId: null,
    reason: "根拠と価格の確認が取れたため。",
    occurredAt: new Date("2026-08-14T02:00:00Z"),
  },
  {
    id: taggedString<"AuditLogId">("al_2"),
    workspaceId: SAMPLE_WORKSPACE_ID,
    // AI が下書きの段階を進めた。`createAdvanceContentStateUseCase` が出す語。
    action: "content.state_changed",
    actor: {
      userId: taggedString<"UserId">("u_ai"),
      isAiServiceAccount: true,
      modelId: "見本モデル",
      // 鍵で入った AI として置いてある（鍵を照合して入る道筋）。
      identified: true,
    },
    targetType: "content_package",
    targetId: "cp_alpha_01",
    before: { state: "DRAFT" },
    after: { state: "REVIEW" },
    requestId: null,
    reason: null,
    occurredAt: new Date("2026-08-12T09:00:00Z"),
  },
  {
    id: taggedString<"AuditLogId">("al_1"),
    workspaceId: SAMPLE_WORKSPACE_ID,
    // 受け取った成果リンクを対象外にした。`createRejectLinkUseCase` が出す語で、
    // 理由が必須の語でもあるので、見本の一覧に理由の欄が埋まった行が 1 つ残る。
    action: "affiliate_link.rejected",
    actor: {
      userId: taggedString<"UserId">("u_owner"),
      isAiServiceAccount: false,
      modelId: null,
      // 見本の持ち主は、ログイン済みの人として置いてある。
      identified: true,
    },
    targetType: "affiliate_link",
    targetId: "lnk_sample_01",
    before: null,
    after: null,
    requestId: null,
    reason: "販売が終わった商品のリンクだったため。",
    occurredAt: new Date("2026-08-01T00:00:00Z"),
  },
];

/**
 * 溜め場所。
 *
 * 上限を置くのは、長く動かしたときにメモリを食い潰さないため。
 * 溢れたら**古いものから捨てる**（新しいものを捨てると、
 * いま確かめたい操作が記録されない）。
 */
const MAX_ENTRIES = 5_000;
const buffer: AuditLogEntry[] = [...SEED_ENTRIES];

/** 試験が積み上がりを断ち切るために使う。見本の 3 件まで戻す。 */
export function resetSampleAuditLog(): void {
  buffer.length = 0;
  buffer.push(...SEED_ENTRIES);
}

/** いま溜まっているもの。試験が読む。 */
export function recentSampleAuditLog(): readonly AuditLogEntry[] {
  return [...buffer];
}

/**
 * 操作の記録（控え）。
 *
 * 読み出しは**必ず作業場所で絞る**。本物（D1）が `workspace_id` で絞る以上、
 * 控えが絞らないと「見本では他社の記録が見えるが本物では見えない」という、
 * 画面で確かめても分からない食い違いが残る。
 */
export function createSampleAuditLog(): AuditLogPort {
  return {
    async append(entry) {
      buffer.push(entry);
      if (buffer.length > MAX_ENTRIES) buffer.shift();
      return ok(entry.id);
    },
    async listByTarget(workspaceId, targetType, targetId) {
      return ok(
        buffer.filter(
          (e) =>
            String(e.workspaceId) === String(workspaceId) &&
            e.targetType === targetType &&
            e.targetId === targetId,
        ),
      );
    },
    async search(workspaceId, query, page) {
      const filtered = buffer.filter((e) => {
        if (String(e.workspaceId) !== String(workspaceId)) return false;
        if (query.action !== undefined && e.action !== query.action) return false;
        if (query.from !== undefined && e.occurredAt < query.from) return false;
        if (query.to !== undefined && e.occurredAt > query.to) return false;
        return true;
      });
      // 新しいものから返す。本物（D1）も occurred_at の降順で返す。
      const sorted = [...filtered].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      return ok({ items: sorted.slice(0, page.limit), nextCursor: null });
    },
  };
}

/**
 * 記録が残せない側の記録先。**呼ぶと必ず失敗する。**
 *
 * 控えを入れたあとも残すのは、「記録が残せないなら操作を通さない」を
 * 確かめる道が要るため。控えだけにすると、その断り方は誰も見なくなる。
 */
export function createUnavailableAuditLog(): AuditLogPort {
  return {
    append: () => stubCall(stub, "操作の記録の追記"),
    listByTarget: () => stubCall(stub, "操作の記録の読み出し"),
    search: () => stubCall(stub, "操作の記録の検索"),
  };
}
