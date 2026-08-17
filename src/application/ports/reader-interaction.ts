import type { Editorial } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 読者が自分で操作するもののポート。
 *
 * 「気になる商品」「診断・計算」「問い合わせ」の 3 つ。
 * どれも読者向けなので **Editorial 区分**。
 * ここに報酬に関わるポートを混ぜると、
 * 「保存した商品を報酬順に並べる」実装が書けてしまう。
 */

/** 保存した商品 1 件。読者に見せる分だけを持つ（価格の推移や報酬は持たない）。 */
export type ShortlistItem = {
  readonly productId: string;
  readonly productName: string;
  readonly savedAt: string;
  /** 保存元の記事。「なぜ保存したか」を思い出せるようにする。 */
  readonly fromArticleHref?: string;
  readonly oneLine?: string;
};

export type ShortlistPort = {
  /** 読者ごとの保存一覧。まだ 1 件も無いことは失敗ではない。 */
  list(siteSlug: string, readerKey: string): PortResult<readonly ShortlistItem[]>;
  add(siteSlug: string, readerKey: string, item: ShortlistItem): PortResult<true>;
  remove(siteSlug: string, readerKey: string, productId: string): PortResult<true>;
};

/** 診断・計算の道具 1 つ。入力欄の定義まで含めて保存側から受け取る。 */
export type ReaderToolDefinition = {
  readonly slug: string;
  readonly name: string;
  /** 何が分かる道具か。1 文。 */
  readonly purpose: string;
  readonly inputs: readonly {
    readonly key: string;
    readonly label: string;
    readonly hint?: string;
    readonly unit?: string;
  }[];
  /** 結果の読み方。数字だけ出して解釈を読者任せにしない。 */
  readonly howToRead: string;
};

export type ReaderToolPort = {
  find(siteSlug: string, slug: string): PortResult<ReaderToolDefinition | null>;
  list(siteSlug: string): PortResult<readonly ReaderToolDefinition[]>;
  /** 実行。計算そのものは道具の定義側に属するため、結果は文字列の組で返す。 */
  run(
    siteSlug: string,
    slug: string,
    values: Readonly<Record<string, string>>,
  ): PortResult<{ readonly summary: string; readonly rows: readonly { readonly label: string; readonly value: string }[] }>;
};

export type ContactMessage = {
  readonly siteSlug: string;
  readonly body: string;
  /** 返信先。書かなくても送れる（意見だけ伝えたい人を締め出さない）。 */
  readonly replyTo?: string;
  /** 自動送信よけの確認結果。検証は infrastructure 側で行う。 */
  readonly humanCheckToken?: string;
};

export type ContactPort = {
  submit(message: ContactMessage): PortResult<{ readonly receiptId: string }>;
};

export type EditorialShortlistPort = Editorial<ShortlistPort>;
export type EditorialReaderToolPort = Editorial<ReaderToolPort>;
export type EditorialContactPort = Editorial<ContactPort>;
