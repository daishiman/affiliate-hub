import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type {
  EditorialSiteDocumentRepositoryPort,
  EditorialSiteRepositoryPort,
  SiteDocument,
} from "@/application/ports/site";
import {
  SITE_DOCUMENT_KEYS,
  SITE_DOCUMENT_LABEL,
  findRoute,
  type SiteDocumentKey,
} from "@/domain/authoring";
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
 * ブログの固定文書（運営者情報・評価方法・各方針・規約・特商法表記）の管理。
 *
 * ここが埋まるまで、その画面は読者から見て 404 のままになる。
 * だから一覧は**未整備のものも 1 行として返す**。保存済みのものだけを返すと、
 * 「無い」ことは画面から消え、フッターのリンクを踏んだ読者だけが気づく。
 *
 * 種類の一覧はルート表から来る（`SITE_DOCUMENT_KEYS`）。
 * ここで並べ直さない。並べ直すと、ルートを 1 本足した日に
 * 画面はあるのに編集できない文書が生まれる。
 */

export type ManageSiteDocumentsDeps = {
  readonly sites: EditorialSiteRepositoryPort;
  readonly documents: EditorialSiteDocumentRepositoryPort;
};

/**
 * 固定文書を**書き換える**側の口。
 *
 * 一覧だけの口には持たせない。ここが欠けるとそのブログの記事は
 * 1 本も公開できなくなるので、「昨日まで出せていたのに」の答えを
 * 記録の側に残せる形にしておく。
 */
export type RecordedSiteDocumentsDeps = ManageSiteDocumentsDeps & {
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

/** 一覧の 1 行。未整備でも行は出る（`updatedAt` が null）。 */
export type SiteDocumentRow = {
  readonly key: string;
  readonly label: string;
  /** 読者に出る URL。管理画面から実物を確かめに行けるようにする。 */
  readonly readerPath: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly updatedAt: Date | null;
  /** まだ 1 度も保存していない。読者にはこの画面が 404 で出ている。 */
  readonly missing: boolean;
};

export type ListSiteDocumentsInput = { readonly siteSlug: string };
export type ListSiteDocumentsOutput = {
  readonly siteSlug: string;
  readonly siteName: string;
  readonly rows: readonly SiteDocumentRow[];
  /** 未整備の数。0 でないときだけ画面で目立たせる。 */
  readonly missingCount: number;
};

export type SaveSiteDocumentInput = {
  readonly siteSlug: string;
  readonly key: string;
  readonly title: string;
  /** 段落。空行で区切られたものを呼び出し側が配列にして渡す。 */
  readonly body: readonly string[];
};

function isSiteDocumentKey(value: string): value is SiteDocumentKey {
  return (SITE_DOCUMENT_KEYS as readonly string[]).includes(value);
}

/**
 * 他社のブログは「無い」と同じ応答にする。
 * `FORBIDDEN` と `NOT_FOUND` を打ち分けると、返る符号の違いだけで
 * 「その名前のブログは実在する」と分かってしまう（manage-sites と同じ判断）。
 */
async function siteOwnedBy(
  deps: ManageSiteDocumentsDeps,
  actor: ActorContext,
  siteSlug: string,
): Promise<Result<{ readonly name: string }, DomainError>> {
  const scoped = assertWorkspaceWideAccess(actor, "ブログ");
  if (!scoped.ok) return scoped;
  const found = await deps.sites.findBySlug(siteSlug);
  if (!found.ok) return found;
  const blueprint = found.value;
  if (blueprint === null || blueprint.workspaceId !== actor.workspaceId) {
    return err(
      domainError("NOT_FOUND", "このブログが見つかりません。", {
        suggestedAction: "ブログの一覧から選び直してください。",
      }),
    );
  }
  return ok({ name: blueprint.name });
}

export function createListSiteDocumentsUseCase(
  deps: ManageSiteDocumentsDeps,
): UseCase<ListSiteDocumentsInput, ListSiteDocumentsOutput> {
  return {
    async execute(actor, input) {
      const site = await siteOwnedBy(deps, actor, input.siteSlug);
      if (!site.ok) return site;

      const saved = await deps.documents.listBySite(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const byKey = new Map<string, SiteDocument>(saved.value.map((d) => [d.key, d]));

      const rows = SITE_DOCUMENT_KEYS.map((key) => {
        const doc = byKey.get(key) ?? null;
        return {
          key,
          label: SITE_DOCUMENT_LABEL[key] ?? key,
          readerPath: findRoute(key)?.path ?? "",
          title: doc?.title ?? SITE_DOCUMENT_LABEL[key] ?? key,
          body: doc?.body ?? [],
          updatedAt: doc?.updatedAt ?? null,
          missing: doc === null,
        };
      });

      return ok({
        siteSlug: input.siteSlug,
        siteName: site.value.name,
        rows,
        missingCount: rows.filter((r) => r.missing).length,
      });
    },
  };
}

export function createSaveSiteDocumentUseCase(
  deps: RecordedSiteDocumentsDeps,
): UseCase<SaveSiteDocumentInput, { readonly key: string }> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "site.manage", "ブログの固定文書の保存");
      if (!allowed.ok) return allowed;

      const site = await siteOwnedBy(deps, actor, input.siteSlug);
      if (!site.ok) return site;

      // 知らない種類は保存しない。保存できてしまうと、どの画面にも出ない行が
      // 保存先に貯まり、「直したのに読者に出ない」の原因が保存先の中に隠れる。
      const key = input.key;
      if (!isSiteDocumentKey(key)) {
        return err(
          domainError("VALIDATION_FAILED", "この種類の文書は扱えません。", {
            suggestedAction: "固定ページの一覧から選び直してください。",
          }),
        );
      }

      const title = input.title.trim();
      if (title === "") {
        return err(
          domainError("VALIDATION_FAILED", "見出しを入力してください。", {
            field: "title",
            suggestedAction: "読者がその画面を何のページだと分かる言葉にしてください。",
          }),
        );
      }

      // 空の段落は落とす。落とさないと、読者の画面に空行だけが並ぶ。
      const body = input.body.map((p) => p.trim()).filter((p) => p !== "");
      if (body.length === 0) {
        return err(
          domainError("VALIDATION_FAILED", "本文を入力してください。", {
            field: "body",
            suggestedAction:
              "見出しだけを保存すると、読者には中身の無いページが出ます。1 段落以上を書いてください。",
          }),
        );
      }

      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "site_document.changed",
        targetType: "site_document",
        targetId: `${input.siteSlug}:${key}`,
        before: null,
        // 本文は写さない。画面を開けば読めるものを記録側へ積み上げても
        // 増える情報が無く、直すたびに同じ文章が二重に貯まる。
        after: { siteSlug: input.siteSlug, key, title, paragraphs: body.length },
      });
      if (!entry.ok) return entry;

      const saved = await deps.documents.save(actor.workspaceId, input.siteSlug, {
        key,
        title,
        body,
      });
      if (!saved.ok) return saved;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("固定ページの保存は済んでいます", appended.error.details));
      }
      return ok({ key });
    },
  };
}
