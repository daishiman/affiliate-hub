import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type {
  ArticleThumbnailStoragePort,
  BlogOpsRepositoryPort,
} from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { requireCapability } from "@/domain/identity";
import {
  ALLOWED_THUMBNAIL_MIME,
  MAX_THUMBNAIL_BYTES,
  isAllowedThumbnailMime,
  isThumbnailWidth,
} from "@/domain/blogops";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  err,
  notFound,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 記事のサムネイル（運営者が上げた 1 枚）の登録と取り消し。
 *
 * --- なぜ絵を作る仕事がここに無いのか ---
 *
 * 縮小した絵（320/640/1280）は**ブラウザ側で作って送る**。Workers に画像の
 * デコーダは無く、`wrangler.jsonc` に Images のバインディングも無いので、
 * ここで原本 1 枚から派生を作ることはできない。作れないものを層の内側に
 * 書くと、動かして初めて分かる。だから入力の形（原本＋派生の束）そのものを
 * 「送る側が作って持ってくる」と決めてある。
 *
 * --- 置き場と台帳の順番 ---
 *
 * 先に置き場（R2）へ置き、置けた鍵を台帳（D1）へ書く。逆にすると、台帳に
 * 載っているのに絵が無い記事ができ、読者の一覧に 404 を指す `img` が並ぶ。
 * この順番だと失敗したときに残るのは「誰も参照していない絵」で、
 * これは掃除で拾える（参照の無い世代を消す定期実行）。
 */
export type ManageArticleThumbnailDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly storage: ArticleThumbnailStoragePort;
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

function guardEditorial(deps: ManageArticleThumbnailDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `サムネイルの管理に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を表紙の選択の入力にすることはできません。",
    );
  }
}

export type SetArticleThumbnailInput = {
  readonly articleId: string;
  readonly mimeType: string;
  readonly original: ArrayBuffer;
  /** ブラウザ側で作った縮小版。落ちた幅があっても原本だけで成立する。 */
  readonly derived: readonly { readonly width: number; readonly bytes: ArrayBuffer }[];
  /** 目の見えない読者に絵の代わりに読まれる文。空は「飾り」を意味しない。 */
  readonly altText: string;
};

export type SetArticleThumbnailOutput = {
  readonly objectKey: string;
  readonly derivedWidths: readonly number[];
};

export function createSetArticleThumbnailUseCase(
  deps: ManageArticleThumbnailDeps,
): UseCase<SetArticleThumbnailInput, SetArticleThumbnailOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SetArticleThumbnailInput,
    ): Promise<Result<SetArticleThumbnailOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "記事サムネイルの登録");
      if (!allowed.ok) return allowed;

      if (!isAllowedThumbnailMime(input.mimeType)) {
        return err(
          validationError(
            `この形式の画像は置けません（${ALLOWED_THUMBNAIL_MIME.join(" / ")} のいずれか）。`,
            "mimeType",
          ),
        );
      }
      if (input.original.byteLength > MAX_THUMBNAIL_BYTES) {
        return err(
          validationError(
            `画像が大きすぎます（上限 ${MAX_THUMBNAIL_BYTES / 1024 / 1024}MB）。`,
            "original",
          ),
        );
      }
      const altText = input.altText.trim();
      if (altText === "") {
        return err(
          validationError(
            "絵の説明を入れてください。絵が出ないときと、読み上げで聞く読者に、" +
              "ここだけが届きます。",
            "altText",
          ),
        );
      }

      const found = await deps.repository.findArticle(actor.workspaceId, input.articleId);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ記事", input.articleId));
      const { article } = found.value;

      const previous = await deps.repository.findArticleThumbnail(
        actor.workspaceId,
        input.articleId,
      );
      if (!previous.ok) return previous;

      const stored = await deps.storage.putGeneration({
        siteSlug: article.siteSlug,
        articleSlug: article.slug,
        mimeType: input.mimeType,
        original: input.original,
        derived: input.derived.filter((d) => isThumbnailWidth(d.width)),
      });
      if (!stored.ok) return stored;

      const at = deps.now();
      const saved = await deps.repository.saveArticleThumbnail(actor.workspaceId, {
        articleId: input.articleId,
        objectKey: stored.value.objectKey,
        mimeType: input.mimeType,
        byteLength: input.original.byteLength,
        derivedWidths: stored.value.derivedWidths,
        altText,
        uploadedAt: at,
      });
      if (!saved.ok) return saved;

      /*
        ここから先は**古い世代（前に上げた絵）の始末**である。

        置き場の鍵は原本の中身の指紋を含むので、絵を差し替えると鍵ごと変わる。
        つまり古い世代は上書きされずに R2 に残り、台帳からの参照だけが新しい方へ移る。
        参照の外れた絵は誰にも出ないが、消さない限り置き場に積み上がる。

        `previous.value` が前の世代（無ければ null）、
        `stored.value.objectKey` が今置いた世代の鍵である。
        同じ絵を上げ直したときは、この 2 つが**同じ鍵になる**。そのまま消すと、
        いま置いたばかりの絵を自分で消すので、鍵が違うときだけ消す。

        消せなかったことをこの操作の失敗にはしない。差し替え自体は成功していて、
        読者にはもう新しい絵が出ている。ここで失敗を返すと、運営者は押し直し、
        押し直すたびに**世代が増える**（鍵が中身から決まるので、同じ絵なら
        増えないが、別の絵を選び直せば増える）。消し残りは
        「参照の無い世代を消す掃除」が拾う。
      */
      if (previous.value !== null && previous.value.objectKey !== stored.value.objectKey) {
        await deps.storage.deleteGeneration(previous.value.objectKey);
      }

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_article_thumbnail.set",
        targetType: "blog_article",
        targetId: input.articleId,
        before: previous.value === null ? null : { objectKey: previous.value.objectKey },
        after: { objectKey: stored.value.objectKey, derivedWidths: stored.value.derivedWidths },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`記事「${article.title}」のサムネイルを登録しました`, {
            articleId: input.articleId,
          }),
        );
      }

      return ok({ objectKey: stored.value.objectKey, derivedWidths: stored.value.derivedWidths });
    },
  };
}

export type GetArticleThumbnailOutput = {
  readonly objectKey: string;
  readonly altText: string;
  readonly derivedWidths: readonly number[];
  readonly uploadedAt: Date;
} | null;

/**
 * いま何が付いているかを読む。**書く側とは別の権限（`content.read`）で通す。**
 *
 * 読めない口にすると、管理画面は「表紙が無い」と「表紙を読めなかった」を
 * 同じ空欄で描くことになり、運営者は無い方だと思って上げ直す。
 */
export function createGetArticleThumbnailUseCase(
  deps: ManageArticleThumbnailDeps,
): UseCase<RemoveArticleThumbnailInput, GetArticleThumbnailOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input): Promise<Result<GetArticleThumbnailOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "記事サムネイルの閲覧");
      if (!allowed.ok) return allowed;
      const found = await deps.repository.findArticleThumbnail(actor.workspaceId, input.articleId);
      if (!found.ok) return found;
      if (found.value === null) return ok(null);
      const { objectKey, altText, derivedWidths, uploadedAt } = found.value;
      return ok({ objectKey, altText, derivedWidths, uploadedAt });
    },
  };
}

export type RemoveArticleThumbnailInput = { readonly articleId: string };

/**
 * サムネイルを外す。
 *
 * **台帳の参照を先に外し、置き場はその後で消す。** 逆にすると、絵が消えたのに
 * 参照が残る瞬間ができ、その間に一覧を開いた読者には 404 を指す `img` が出る。
 * この順番なら、置き場の削除が落ちても残るのは「誰も参照していない絵」で、
 * 読者側には何も起きない。
 */
export function createRemoveArticleThumbnailUseCase(
  deps: ManageArticleThumbnailDeps,
): UseCase<RemoveArticleThumbnailInput, { readonly removed: boolean }> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: RemoveArticleThumbnailInput,
    ): Promise<Result<{ readonly removed: boolean }, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "記事サムネイルの取り消し");
      if (!allowed.ok) return allowed;

      const previous = await deps.repository.findArticleThumbnail(
        actor.workspaceId,
        input.articleId,
      );
      if (!previous.ok) return previous;
      if (previous.value === null) return ok({ removed: false });

      const detached = await deps.repository.deleteArticleThumbnail(
        actor.workspaceId,
        input.articleId,
      );
      if (!detached.ok) return detached;

      // 置き場の失敗は読者に見えない（参照はもう外れている）ので、
      // ここで止めない。消し残りは掃除が拾う。
      await deps.storage.deleteGeneration(previous.value.objectKey);

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_article_thumbnail.removed",
        targetType: "blog_article",
        targetId: input.articleId,
        before: { objectKey: previous.value.objectKey },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure("サムネイルを外しました", { articleId: input.articleId }),
        );
      }

      return ok({ removed: true });
    },
  };
}
