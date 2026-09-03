import type { Editorial } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
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
  /**
   * 読者が「気になる」を押した時刻（サーバーが決める）。
   *
   * 運営者の記事保存時刻（`persistedAt`）や端末下書きの保存時刻（`draftSavedAt`）と
   * 同じ `savedAt` という名前だったので、名前で意味を分ける。
   * **保存列の名前は `saved_at` のまま**で、変えるには migration が要るため据え置き。
   */
  readonly shortlistedAt: string;
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

/** 公開入口が server-side で付ける、送信元ごとのレート制限キー。 */
export type ContactRequest = ContactMessage & {
  /** 公開入口がserver-sideで得た送信元。保存前に秘密鍵付きの仮名キーへ変換する。 */
  readonly rateLimitIdentity?: {
    readonly scope: "ip" | "actor";
    readonly value: string;
  };
  /** request metadataからserver-sideで得た接続元。siteverifyへだけ渡し、保存しない。 */
  readonly remoteIp?: string;
};

/** 生の送信元を保存可能な短い仮名キーへ変換する、秘密鍵を内包した境界。 */
export type ContactRateLimitKeyPort = {
  derive(scope: "ip" | "actor", value: string): PortResult<string>;
};

export const TURNSTILE_CONTACT_ACTION = "turnstile-spin-v2" as const;

export type HumanCheckPort = {
  verify(input: {
    readonly token: string;
    readonly action: typeof TURNSTILE_CONTACT_ACTION;
    /** Cloudflare siteverifyの補助照合。問い合わせ本文や保存行へは入れない。 */
    readonly remoteIp?: string;
  }): PortResult<true>;
};

/**
 * 届いた問い合わせ 1 件（運営者が読む側の形）。
 *
 * `ContactMessage` は「送るときの形」、こちらは「読むときの形」。
 * 分けているのは、**送る側が受付番号や対応済みの日時を指定できないようにする**ため。
 */
export type ContactRecord = {
  readonly id: string;
  readonly siteSlug: string;
  readonly body: string;
  readonly replyTo: string | null;
  readonly receivedAt: string;
  /** 運営者が読んで対応を終えた日時。まだなら null。 */
  readonly handledAt: string | null;
};

export type ContactPort = {
  submit(
    /** 読者の入力ではなく、有効な公開サイトから server-side に解決した所属。 */
    workspaceId: WorkspaceId,
    message: ContactMessage,
    /** 保存時刻と同じ行へ残し、直近窓の回数を数える秘密鍵付き仮名キー。 */
    rateLimitKey: string,
  ): PortResult<{ readonly receiptId: string }>;
  /**
   * 届いた分の一覧（新しい順）。
   *
   * **読める場所が無いのに受け付けるのは、受け取ったふりでしかない。**
   * 保存するなら必ず読み出せること、を型の側で要求する。
   */
  list(
    /** server-side actor context から得た所属。サイト列だけに依存しない。 */
    workspaceId: WorkspaceId,
    /** 呼び出した運営者が所有するサイト。空なら 1 件も返さない。 */
    ownedSiteSlugs: readonly string[],
    /** 一覧で選ばれたサイト。所有サイトのいずれかでなければ 1 件も返さない。 */
    siteSlug?: string,
  ): PortResult<readonly ContactRecord[]>;
  /** 対応済みにする。`handled` が false なら未対応へ戻す（押し間違いを直せる）。 */
  markHandled(
    /** ID だけで別 workspace の行を更新しないための所有境界。 */
    workspaceId: WorkspaceId,
    /** ID だけで別サイトの行を更新しないための所有範囲。 */
    ownedSiteSlugs: readonly string[],
    id: string,
    handled: boolean,
    at: string,
  ): PortResult<true>;
};

export type EditorialShortlistPort = Editorial<ShortlistPort>;
export type EditorialReaderToolPort = Editorial<ReaderToolPort>;
export type EditorialContactPort = Editorial<ContactPort>;
export type EditorialHumanCheckPort = Editorial<HumanCheckPort>;
