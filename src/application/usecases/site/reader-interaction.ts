import type {
  ContactMessage,
  EditorialContactPort,
  EditorialReaderToolPort,
  EditorialShortlistPort,
  ReaderToolDefinition,
  ShortlistItem,
} from "@/application/ports/reader-interaction";
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

/**
 * 読者が自分で操作するもののユースケース。
 *
 * 読み取り (read-site.ts) と同じ考え方で、権限判定は入れない。
 * 公開ページの上で誰でもできる操作だけを扱う。
 *
 * 画面・REST・WebMCP・バックエンド MCP の 4 経路がここを呼ぶ。
 * 「画面でできることは AI からもできる」を、実装を 2 つ持たずに満たす。
 */

export type ReaderInteractionDeps = {
  readonly shortlist: EditorialShortlistPort;
  readonly readerTools: EditorialReaderToolPort;
  readonly contact: EditorialContactPort;
};

function guardEditorial(deps: ReaderInteractionDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `読者向けの操作に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "保存した商品の並び順を報酬で決めることはできません。",
    );
  }
}

/**
 * 読者の識別。
 *
 * ログインを求めない代わりに、ブラウザごとの合言葉で保存先を分ける。
 * 個人を特定する値は使わない（要求 K の個人情報の扱い）。
 */
export const ANONYMOUS_READER_KEY = "anonymous";

// ---------------------------------------------------------------------------
// 気になる商品
// ---------------------------------------------------------------------------

export type ListShortlistInput = { readonly siteSlug: string; readonly readerKey?: string };

export function createListShortlistUseCase(
  deps: ReaderInteractionDeps,
): UseCase<ListShortlistInput, readonly ShortlistItem[]> {
  guardEditorial(deps);
  return {
    async execute(_actor: ActorContext, input) {
      return deps.shortlist.list(input.siteSlug, input.readerKey ?? ANONYMOUS_READER_KEY);
    },
  };
}

export type SaveToShortlistInput = {
  readonly siteSlug: string;
  readonly readerKey?: string;
  readonly item: ShortlistItem;
};

export function createSaveToShortlistUseCase(
  deps: ReaderInteractionDeps,
): UseCase<SaveToShortlistInput, true> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      if (input.item.productId.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "保存する商品が指定されていません。", {
            field: "productId",
            suggestedAction: "記事の中の「気になる」から保存してください。",
          }),
        );
      }
      return deps.shortlist.add(
        input.siteSlug,
        input.readerKey ?? ANONYMOUS_READER_KEY,
        input.item,
      );
    },
  };
}

export type RemoveFromShortlistInput = {
  readonly siteSlug: string;
  readonly readerKey?: string;
  readonly productId: string;
};

export function createRemoveFromShortlistUseCase(
  deps: ReaderInteractionDeps,
): UseCase<RemoveFromShortlistInput, true> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      return deps.shortlist.remove(
        input.siteSlug,
        input.readerKey ?? ANONYMOUS_READER_KEY,
        input.productId,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// 診断・計算
// ---------------------------------------------------------------------------

export type GetReaderToolInput = { readonly siteSlug: string; readonly slug: string };

export function createGetReaderToolUseCase(
  deps: ReaderInteractionDeps,
): UseCase<GetReaderToolInput, ReaderToolDefinition> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      const found = await deps.readerTools.find(input.siteSlug, input.slug);
      if (!found.ok) return found;
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "この道具は見つかりません。", {
            suggestedAction: "トップから探し直してください。",
          }),
        );
      }
      return ok(found.value);
    },
  };
}

export type ListReaderToolsInput = { readonly siteSlug: string };

export function createListReaderToolsUseCase(
  deps: ReaderInteractionDeps,
): UseCase<ListReaderToolsInput, readonly ReaderToolDefinition[]> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      return deps.readerTools.list(input.siteSlug);
    },
  };
}

export type RunReaderToolInput = {
  readonly siteSlug: string;
  readonly slug: string;
  readonly values: Readonly<Record<string, string>>;
};

export type RunReaderToolOutput = {
  readonly summary: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
};

export function createRunReaderToolUseCase(
  deps: ReaderInteractionDeps,
): UseCase<RunReaderToolInput, RunReaderToolOutput> {
  guardEditorial(deps);
  return {
    async execute(_actor, input) {
      return deps.readerTools.run(input.siteSlug, input.slug, input.values);
    },
  };
}

// ---------------------------------------------------------------------------
// 問い合わせ
// ---------------------------------------------------------------------------

export type SubmitContactInput = ContactMessage;
export type SubmitContactOutput = { readonly receiptId: string };

/**
 * 問い合わせの送信。
 *
 * 本文が空のときは送らせない。
 * 「送信しました」と出したのに中身が無い、という状態を作らないため。
 */
export function createSubmitContactUseCase(
  deps: ReaderInteractionDeps,
): UseCase<SubmitContactInput, SubmitContactOutput> {
  guardEditorial(deps);
  return {
    async execute(
      _actor,
      input,
    ): Promise<Result<SubmitContactOutput, DomainError>> {
      if (input.body.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "内容が入力されていません。", {
            field: "body",
            suggestedAction: "お問い合わせの内容をご記入ください。",
          }),
        );
      }
      return deps.contact.submit(input);
    },
  };
}
