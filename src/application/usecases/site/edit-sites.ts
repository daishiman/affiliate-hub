import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { EditorialSiteDraftRepositoryPort } from "@/application/ports/authoring";
import type {
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "@/application/ports/site";
import type { DifferentiationAxes, SiteBlueprint } from "@/domain/authoring";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import { DIFFERENTIATION_AXIS_LABEL } from "./manage-sites";

/**
 * ブログの設計図を直す・取り下げる。
 *
 * **読むのは `sites`、書くのは `siteDrafts` になっている。** ちぐはぐに見えるが、
 * ブログの実体は「ウィザードから登録された設計図」1 つで、登録の窓口が
 * `publishBlueprint` だからである。読者向けの `sites` に書き込み口を足すと、
 * 読者からの要求で設計図を書き換える経路が型の上で作れてしまう。
 *
 * ここに「このブログのときだけこうする」を書き始めたら、
 * それは Blueprint の項目が足りない合図であって、分岐を足す合図ではない。
 */
export type EditSitesDeps = {
  readonly sites: EditorialSiteRepositoryPort;
  readonly drafts: EditorialSiteDraftRepositoryPort;
  /** 取り下げの前に、まだ読者に出ている記事が残っていないかを見る。 */
  readonly publishedContent: EditorialPublishedContentPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
};

function guardEditorial(deps: EditSitesDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `ブログの編集に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額をブログの設計の入力にすることはできません。",
    );
  }
}

/**
 * 自分の会社のブログを 1 本引く。
 *
 * **他社のブログは「無い」と同じ応答にする。** `code` の違いだけで
 * 「その URL 名は実在する」と分かってしまうため（`manage-sites.ts` と同じ判断）。
 */
async function loadOwned(
  deps: EditSitesDeps,
  actor: ActorContext,
  slug: string,
): Promise<Result<SiteBlueprint, DomainError>> {
  const found = await deps.sites.findBySlug(slug);
  if (!found.ok) return found;
  if (found.value === null || found.value.workspaceId !== actor.workspaceId) {
    return err(
      domainError("NOT_FOUND", "このブログが見つかりません。", {
        suggestedAction: "ブログの一覧から選び直してください。",
      }),
    );
  }
  return ok(found.value);
}

// --- 設計図を直す -----------------------------------------------------------

/**
 * 直せる項目。
 *
 * **URL 名（slug）とパターンは入っていない。** URL 名を変えると、
 * すでに読者へ配った住所が消える。パターンを変えると固定ページの構成が変わり、
 * 公開済みの記事の置き場所がその場で無くなる。どちらも「直す」ではなく
 * 「作り直す」なので、この口では扱わない。
 */
export type UpdateManagedSiteInput = {
  readonly siteSlug: string;
  readonly name?: string;
  readonly purpose?: string;
  readonly genre?: string;
  readonly emitLlmsTxt?: boolean;
  /** 差別化の 10 軸。渡した軸だけを差し替える。 */
  readonly differentiation?: Partial<Record<keyof DifferentiationAxes, string>>;
};

export type UpdateManagedSiteOutput = {
  readonly siteSlug: string;
  /** 実際に変わった項目の表示名。何も変わらなかったときは空。 */
  readonly changedLabels: readonly string[];
  readonly blueprint: SiteBlueprint;
};

const FIELD_LABEL: Readonly<Record<string, string>> = {
  name: "ブログ名",
  purpose: "このブログの狙い",
  genre: "扱う分野",
  emitLlmsTxt: "llms.txt を出すか",
};

export function createUpdateManagedSiteUseCase(
  deps: EditSitesDeps,
): UseCase<UpdateManagedSiteInput, UpdateManagedSiteOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "site.manage", "ブログの設定変更");
      if (!allowed.ok) return allowed;

      const current = await loadOwned(deps, actor, input.siteSlug);
      if (!current.ok) return current;

      const before = current.value;
      const differentiation: DifferentiationAxes = {
        ...before.differentiation,
        ...(input.differentiation ?? {}),
      };
      const next: SiteBlueprint = {
        ...before,
        name: input.name ?? before.name,
        purpose: input.purpose ?? before.purpose,
        genre: input.genre ?? before.genre,
        emitLlmsTxt: input.emitLlmsTxt ?? before.emitLlmsTxt,
        differentiation,
      };

      /*
       * 変わった項目を数え上げる。
       *
       * **0 件のときに断らない。** 何も変えずに保存を押すのは普通の操作で、
       * 断ると「押したのに何も起きない」より分かりにくい状態になる。
       * その代わり、変わっていないことを返して画面に出せるようにする。
       */
      const changedLabels: string[] = [];
      for (const key of ["name", "purpose", "genre", "emitLlmsTxt"] as const) {
        if (next[key] !== before[key]) changedLabels.push(FIELD_LABEL[key] ?? key);
      }
      for (const key of Object.keys(differentiation) as (keyof DifferentiationAxes)[]) {
        if (differentiation[key] !== before.differentiation[key]) {
          changedLabels.push(DIFFERENTIATION_AXIS_LABEL[String(key)] ?? String(key));
        }
      }

      const saved = await deps.drafts.publishBlueprint(input.siteSlug, next);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "site.changed",
        targetType: "site",
        targetId: input.siteSlug,
        // 設計図の全文は写さない。画面で読めるものを記録側へ複製しても情報が増えない。
        // 残すのは「どの項目が変わったか」まで。
        before: { changed: changedLabels.join(" / ") || "（変更なし）" },
        after: { name: next.name, genre: next.genre, emitLlmsTxt: next.emitLlmsTxt },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("ブログの設定は保存しました", appended.error.details));
      }

      return ok({ siteSlug: input.siteSlug, changedLabels, blueprint: saved.value });
    },
  };
}

// --- 取り下げ ---------------------------------------------------------------

export type DeleteManagedSiteInput = {
  readonly siteSlug: string;
  /** なぜ取り下げるか。`after` が無いので、差分からは読めない。 */
  readonly reason: string;
};

export type DeleteManagedSiteOutput = {
  readonly siteSlug: string;
  readonly name: string;
};

/**
 * ブログを取り下げる。
 *
 * **読者に出ている記事が残っていれば断る。** 先にブログを消すと、
 * 記事の側からは自分がどこに載っていたか辿れなくなり、
 * 訂正も取り下げもできない孤児が残る。断り文には件数を入れる。
 * 「何かが残っている」だけでは、何本片付ければよいのかが分からない。
 */
export function createDeleteManagedSiteUseCase(
  deps: EditSitesDeps,
): UseCase<DeleteManagedSiteInput, DeleteManagedSiteOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "site.manage", "ブログの取り下げ");
      if (!allowed.ok) return allowed;

      if (input.reason.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "取り下げる理由を書いてください。", {
            field: "reason",
            suggestedAction:
              "消したものは戻せません。後から「なぜ消したか」を説明できるようにしておいてください。",
          }),
        );
      }

      const current = await loadOwned(deps, actor, input.siteSlug);
      if (!current.ok) return current;

      const remaining = await deps.publishedContent.listRecent(input.siteSlug, 50);
      if (!remaining.ok) return remaining;
      if (remaining.value.length > 0) {
        return err(
          domainError(
            "CONFLICT",
            `このブログにはまだ ${remaining.value.length} 本の記事が出ています。先に記事を取り下げてください。`,
            {
              suggestedAction:
                "記事の一覧から 1 本ずつ取り下げるか、公開を止めてからもう一度お試しください。",
              details: { remainingArticles: remaining.value.length },
            },
          ),
        );
      }

      const removed = await deps.drafts.removeBlueprint(actor.workspaceId, input.siteSlug);
      if (!removed.ok) return removed;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "site.deleted",
        targetType: "site",
        targetId: input.siteSlug,
        before: { name: current.value.name, genre: current.value.genre },
        after: null,
        reason: input.reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("ブログは取り下げました", appended.error.details));
      }

      return ok({ siteSlug: input.siteSlug, name: current.value.name });
    },
  };
}
