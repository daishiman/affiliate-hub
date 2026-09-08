import type {
  ContactRecord,
  EditorialContactPort,
} from "@/application/ports/reader-interaction";
import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  assertWorkspaceWideAccess,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 届いた問い合わせを運営者が読む側のユースケース。
 *
 * 送る側（`reader-interaction.ts`）と分けているのは、**権限の有無が違う**から。
 * 送るのは公開ページの上で誰でもできる。読むのは運営者だけ。
 * 同じファイルに置くと、読者向けの経路から一覧が呼べる形をいつか作ってしまう。
 *
 * 権限は改善要望と同じ `feedback.read` / `feedback.status_update` を使う。
 * どちらも「外から届いたものを読んで捌く」仕事で、分ける理由が今は無い。
 * 別の権限を足すと、役割の表に増えた行の意味を誰も説明できなくなる。
 */

export type ManageContactDeps = {
  readonly contact: EditorialContactPort;
  readonly sites: EditorialSiteRepositoryPort;
};

/**
 * 印を**付ける**側の口。一覧だけの口には持たせない。
 *
 * 中身は 1 文字も変わらない操作なので、`before` / `after` の差からは
 * 何も読めない。「誰がいつ、これはもう見たと言ったか」は記録の行にしか残らない。
 */
export type RecordedContactDeps = ManageContactDeps & {
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
};

export type ListContactMessagesInput = {
  /** 省略するとすべてのサイト分。1 人で複数サイトを見る運営者のため。 */
  readonly siteSlug?: string;
  /** true のとき、対応済みのものも出す。既定は未対応だけ。 */
  readonly includeHandled?: boolean;
};

export type ContactMessageRowView = ContactRecord & {
  /** 一覧に出す 1 行分の抜粋。本文全体は詳細で読む。 */
  readonly summary: string;
  readonly handled: boolean;
};

export type ListContactMessagesOutput = {
  readonly rows: readonly ContactMessageRowView[];
  /** 対応済みも含めた総数。絞り込んで 0 件でも「全部で何件あるか」は言える。 */
  readonly totalCount: number;
  readonly unhandledCount: number;
  /** 0 件のときに、なぜ 0 件かを返す。白紙は「壊れている」と読まれる。 */
  readonly emptyReason: string | null;
};

const SUMMARY_LENGTH = 60;

function summarize(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length <= SUMMARY_LENGTH ? oneLine : `${oneLine.slice(0, SUMMARY_LENGTH)}…`;
}

async function ownedSiteSlugs(
  deps: ManageContactDeps,
  actor: ActorContext,
): Promise<Result<readonly string[], DomainError>> {
  const listed = await deps.sites.list();
  if (!listed.ok) return listed;
  return ok(
    listed.value
      .filter((entry) => entry.blueprint.workspaceId === actor.workspaceId)
      .map((entry) => entry.slug),
  );
}

function assertOwnedSite(
  siteSlugs: readonly string[],
  siteSlug: string | undefined,
): Result<true, DomainError> {
  if (siteSlug === undefined || siteSlugs.includes(siteSlug)) return ok(true);
  return err(
    domainError("NOT_FOUND", "このブログが見つかりません。", {
      suggestedAction: "ブログの一覧から選び直してください。",
    }),
  );
}

export function createListContactMessagesUseCase(
  deps: ManageContactDeps,
): UseCase<ListContactMessagesInput, ListContactMessagesOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ListContactMessagesInput,
    ): Promise<Result<ListContactMessagesOutput, DomainError>> {
      const allowed = requireCapability(actor, "feedback.read", "問い合わせの参照");
      if (!allowed.ok) return allowed;
      const scoped = assertWorkspaceWideAccess(actor, "ブログの問い合わせ");
      if (!scoped.ok) return scoped;

      const siteSlugs = await ownedSiteSlugs(deps, actor);
      if (!siteSlugs.ok) return siteSlugs;
      const owned = assertOwnedSite(siteSlugs.value, input.siteSlug);
      if (!owned.ok) return owned;

      const listed = await deps.contact.list(actor.workspaceId, siteSlugs.value, input.siteSlug);
      if (!listed.ok) return listed;

      const all = listed.value;
      const unhandledCount = all.filter((r) => r.handledAt === null).length;
      const visible = input.includeHandled === true ? all : all.filter((r) => r.handledAt === null);

      const rows = visible.map((r) => ({
        ...r,
        summary: summarize(r.body),
        handled: r.handledAt !== null,
      }));

      const emptyReason =
        rows.length > 0
          ? null
          : all.length > 0
            ? "未対応の問い合わせはありません。対応済みのものは「対応済みも見る」で出せます。"
            : input.siteSlug === undefined
              ? "まだ問い合わせは届いていません。読者は各ブログの「お問い合わせ」から送れます。"
              : `${input.siteSlug} にはまだ問い合わせが届いていません。`;

      return ok({ rows, totalCount: all.length, unhandledCount, emptyReason });
    },
  };
}

export type MarkContactHandledInput = {
  readonly id: string;
  /** false を渡すと未対応へ戻す。押し間違いを直せないと、押すのが怖くなる。 */
  readonly handled: boolean;
};

export function createMarkContactHandledUseCase(
  deps: RecordedContactDeps,
  now: () => Date = () => new Date(),
): UseCase<MarkContactHandledInput, true> {
  return {
    async execute(
      actor: ActorContext,
      input: MarkContactHandledInput,
    ): Promise<Result<true, DomainError>> {
      const allowed = requireCapability(
        actor,
        "feedback.status_update",
        "問い合わせの対応状況の更新",
      );
      if (!allowed.ok) return allowed;
      const scoped = assertWorkspaceWideAccess(actor, "ブログの問い合わせ");
      if (!scoped.ok) return scoped;

      const siteSlugs = await ownedSiteSlugs(deps, actor);
      if (!siteSlugs.ok) return siteSlugs;

      const entry = buildAuditEntry({ ids: deps.ids, now }, actor, {
        action: "contact.handled",
        targetType: "contact_message",
        targetId: input.id,
        before: null,
        after: { handled: input.handled },
      });
      if (!entry.ok) return entry;

      const marked = await deps.contact.markHandled(
        actor.workspaceId,
        siteSlugs.value,
        input.id,
        input.handled,
        now().toISOString(),
      );
      if (!marked.ok) return marked;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        const done = input.handled ? "対応済みの印は付いています" : "印を外すのは済んでいます";
        return err(auditWriteFailure(done, appended.error.details));
      }
      return marked;
    },
  };
}
