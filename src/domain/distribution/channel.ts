import {
  type ChannelConnectionId,
  type DomainError,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Distribution コンテキスト / チャネル定義。
 *
 * 「どこへ出せるか」を 1 箇所の表で持つ。
 * 画面が独自に「note へ公開」ボタンを生やすことを防ぐのが目的。
 *
 * 重要 (プラットフォーム層 §17): note には公開された投稿用 API が無い。
 * したがって note は publishMode = "manual_export" とし、
 * 「note へ直接公開」という表示を画面に出してはならない。
 * 非公式 API に依存する実装も禁止する。
 *
 * 表と型の向き (feat-uiux-overhaul A4): `ChannelKind` は手書きの union ではなく
 * `CHANNEL_CAPABILITIES` から導く。配信先を足す作業を 1 エントリの追加だけに保つため。
 */

/**
 * 出稿の方式。
 *   api_publish   : 公式 API で投稿まで行える
 *   api_schedule  : 公式 API で予約投稿まで行える
 *   manual_export : 下書きを書き出し、人が貼り付ける (公式 API が無い)
 */
export type PublishMode = "api_publish" | "api_schedule" | "manual_export";

/**
 * 出稿の状態。方式が違っても状態そのものは同じ 5 つ。
 * 違うのは**言い方**だけで、それは `statusLabels` が持つ。
 */
export type PublishState = "not_started" | "scheduled" | "sending" | "done" | "failed";

/**
 * 方式ごとの状態の言い方。
 *
 * `manual_export` で「送信中」と言わないのが要点。人が貼り付けるまで、
 * こちらは何も送っていない。送っていないものを送信中と呼ぶと、
 * 見た人は「待てば終わる」と受け取り、実際には永久に終わらない。
 */
const STATUS_LABELS = {
  api_publish: {
    not_started: "未投稿",
    scheduled: "予約済み",
    sending: "送信中",
    done: "投稿済み",
    failed: "投稿できず",
  },
  api_schedule: {
    not_started: "未投稿",
    scheduled: "予約済み",
    sending: "送信中",
    done: "投稿済み",
    failed: "投稿できず",
  },
  manual_export: {
    not_started: "未書き出し",
    scheduled: "書き出し待ち",
    sending: "書き出し中",
    done: "貼り付け済み",
    failed: "書き出せず",
  },
} as const satisfies Readonly<Record<PublishMode, Readonly<Record<PublishState, string>>>>;

/**
 * 表の各行が満たす形。
 *
 * `kind` を `string` で受けるのは、`ChannelKind` を**この表から導く**ため。
 * 型を先に手書きすると、配信先を足すときに「型」と「表」の 2 か所を直すことになり、
 * 片方だけ直した状態が作れてしまう。表を正本にすれば、足す作業は 1 エントリの追加だけになる。
 */
type ChannelCapabilityShape = {
  readonly kind: string;
  readonly label: string;
  readonly publishMode: PublishMode;
  /** 本文の上限文字数。null は実質無制限。 */
  readonly maxBodyLength: number | null;
  /** 本文中に外部リンクを置けるか。置けない場合は導線を変える必要がある。 */
  readonly allowsBodyLinks: boolean;
  /** 添付できる画像の最大枚数。0 は画像不可。 */
  readonly maxImages: number;
  /** 動画を扱うか。 */
  readonly supportsVideo: boolean;
  /** アフィリエイトリンクの掲載が規約上認められるか。false なら別導線にする。 */
  readonly allowsAffiliateLinks: boolean;
  /** 広告表記をどこに出す必要があるか。 */
  readonly disclosurePlacement: "body_top" | "body_anywhere" | "platform_tag";
  /** 制約の根拠。規約は変わるため、確認先を必ず持つ。 */
  readonly basisNote: string;
  /**
   * 状態の言い方。画面はここを引くだけで、配信先ごとの分岐を持たない。
   * 分岐を 1 つ持った時点で、配信先を足すたびにその分岐を探して直すことになる。
   */
  readonly statusLabels: Readonly<Record<PublishState, string>>;
  /**
   * 見分けの色。生の色値でなくトークン名にする。
   * 生値を書くと、明暗の切り替えでそこだけ取り残される。
   */
  readonly accentToken: string;
  /**
   * 絵柄。**投稿方式ごとの 3 種**で、配信先ごとに増やさない。
   * 配信先ごとの絵柄にすると、足すたびに絵柄そのものを共通部品へ足すことになり、
   * 「既存画面を変えずに足せる」が崩れる。見分けは `label` と `accentToken` が担う。
   */
  readonly iconName: PublishMode;
  /** 根拠をいつ確認したか。古い制約で組み立てて失敗したとき、最初に疑う先になる。 */
  readonly basisCheckedAt: string;
  /**
   * 記事の本文をこのシステム自身が描いて出すか。
   *
   * true の配信先だけ、管理画面の中で体裁を整えてそのまま公開できる。
   * false は、本文を外へ渡したあとの見た目を相手側が決める。
   *
   * `publishMode` とは別の問いである点に注意。WordPress は API で投稿できる
   * (`api_schedule`) が、出来上がりを描くのは向こう側なので false になる。
   * 画面はこの値を引くだけで済み、`kind === "own_site"` と書かずに済む。
   */
  readonly rendersOwnArticle: boolean;
};

/**
 * チャネル能力表。
 *
 * 数値は各社の規約・仕様に依存し変動するため、
 * ここは「初期値」であって最終的な正本ではない。
 * 実運用ではワークスペース設定で上書きできるようにする。
 */
export const CHANNEL_CAPABILITIES = {
  own_site: {
    kind: "own_site",
    label: "自社サイト",
    publishMode: "api_schedule",
    maxBodyLength: null,
    allowsBodyLinks: true,
    maxImages: 100,
    supportsVideo: true,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_top",
    basisNote: "自社運用のため制約は自分たちで決める",
    statusLabels: STATUS_LABELS.api_schedule,
    accentToken: "--channel-own-site",
    iconName: "api_schedule",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: true,
  },
  x: {
    kind: "x",
    label: "X",
    publishMode: "api_publish",
    maxBodyLength: 280,
    allowsBodyLinks: true,
    maxImages: 4,
    supportsVideo: true,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_anywhere",
    basisNote: "文字数・投稿方法は X の開発者向け仕様に従う。利用前に最新版を確認する",
    statusLabels: STATUS_LABELS.api_publish,
    accentToken: "--channel-x",
    iconName: "api_publish",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  instagram: {
    kind: "instagram",
    label: "Instagram",
    publishMode: "api_publish",
    maxBodyLength: 2200,
    allowsBodyLinks: false,
    maxImages: 10,
    supportsVideo: true,
    allowsAffiliateLinks: false,
    disclosurePlacement: "platform_tag",
    basisNote: "本文リンクが機能しないため、プロフィール導線を前提に設計する",
    statusLabels: STATUS_LABELS.api_publish,
    accentToken: "--channel-instagram",
    iconName: "api_publish",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  youtube: {
    kind: "youtube",
    label: "YouTube",
    publishMode: "api_schedule",
    maxBodyLength: 5000,
    allowsBodyLinks: true,
    maxImages: 1,
    supportsVideo: true,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_top",
    basisNote: "説明欄の冒頭に広告表記を置く。有料プロモーション設定も併用する",
    statusLabels: STATUS_LABELS.api_schedule,
    accentToken: "--channel-youtube",
    iconName: "api_schedule",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  tiktok: {
    kind: "tiktok",
    label: "TikTok",
    publishMode: "api_publish",
    maxBodyLength: 2200,
    allowsBodyLinks: false,
    maxImages: 35,
    supportsVideo: true,
    allowsAffiliateLinks: false,
    disclosurePlacement: "platform_tag",
    basisNote: "商用開示のプラットフォーム機能を使う",
    statusLabels: STATUS_LABELS.api_publish,
    accentToken: "--channel-tiktok",
    iconName: "api_publish",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  threads: {
    kind: "threads",
    label: "Threads",
    publishMode: "api_publish",
    maxBodyLength: 500,
    allowsBodyLinks: true,
    maxImages: 10,
    supportsVideo: true,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_anywhere",
    basisNote: "投稿仕様は提供元の最新仕様を確認する",
    statusLabels: STATUS_LABELS.api_publish,
    accentToken: "--channel-threads",
    iconName: "api_publish",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  /*
    Facebook。

    このエントリは A4（新しい配信先の追加が、記述の追加だけで済むこと）を
    実際に通した 1 件でもある。足したのはこの表の 1 エントリと、
    登録所 (`src/infrastructure/channels/channel-registry.ts`) の 1 行だけで、
    `src/app/admin/**` と `src/presentation/ui/**` は 1 行も変えていない。

    `accentToken` に配信先ごとの別名 (`--channel-facebook`) を作らず、
    投稿方式の色を直接指しているのはそのためである。別名を作ると
    `src/presentation/ui/tokens/semantic.css` を触ることになり、
    「記述を足すだけ」が崩れる。この配信先だけ色を変えたくなった時点で、
    そこで初めて別名を作ればよい。
  */
  facebook: {
    kind: "facebook",
    label: "Facebook",
    publishMode: "api_schedule",
    // 実際の上限は桁が 1 つ違うが、それは「置ける」であって「読まれる」ではない。
    maxBodyLength: 63206,
    allowsBodyLinks: true,
    maxImages: 10,
    supportsVideo: true,
    allowsAffiliateLinks: true,
    /*
      ブランドコンテンツのタグ機能があるが、`body_top` にしておく。
      タグは付け忘れても投稿が通ってしまい、付いていないことに
      こちらから気づけない。本文の冒頭なら、出す前に目で確かめられる。
    */
    disclosurePlacement: "body_top",
    basisNote:
      "ページ投稿は Facebook ページと Graph API のアクセス権が要る。投稿仕様と審査要件は提供元の最新仕様を確認する",
    statusLabels: STATUS_LABELS.api_schedule,
    accentToken: "--channel-mode-api-schedule",
    iconName: "api_schedule",
    basisCheckedAt: "2026-08-22",
    rendersOwnArticle: false,
  },
  note: {
    kind: "note",
    label: "note",
    // note には公開された投稿 API が無い。書き出して人が貼り付ける。
    publishMode: "manual_export",
    maxBodyLength: null,
    allowsBodyLinks: true,
    maxImages: 100,
    supportsVideo: false,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_top",
    basisNote:
      "note に公開された投稿用 API は存在しない。非公式 API に依存せず、下書き書き出しのみを提供する",
    statusLabels: STATUS_LABELS.manual_export,
    accentToken: "--channel-note",
    iconName: "manual_export",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  newsletter: {
    kind: "newsletter",
    label: "メール配信",
    publishMode: "api_schedule",
    maxBodyLength: null,
    allowsBodyLinks: true,
    maxImages: 20,
    supportsVideo: false,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_top",
    basisNote: "配信停止導線と広告表記を本文冒頭に置く",
    statusLabels: STATUS_LABELS.api_schedule,
    accentToken: "--channel-newsletter",
    iconName: "api_schedule",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  wordpress: {
    kind: "wordpress",
    label: "WordPress",
    publishMode: "api_schedule",
    maxBodyLength: null,
    allowsBodyLinks: true,
    maxImages: 100,
    supportsVideo: true,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_top",
    basisNote: "REST API を利用する。認証情報は接続設定として別管理",
    statusLabels: STATUS_LABELS.api_schedule,
    accentToken: "--channel-wordpress",
    iconName: "api_schedule",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
  bluesky: {
    kind: "bluesky",
    label: "Bluesky",
    publishMode: "api_publish",
    maxBodyLength: 300,
    allowsBodyLinks: true,
    maxImages: 4,
    supportsVideo: true,
    allowsAffiliateLinks: true,
    disclosurePlacement: "body_anywhere",
    basisNote: "文字数・投稿方法は AT Protocol の仕様に従う。利用前に最新版を確認する",
    statusLabels: STATUS_LABELS.api_publish,
    accentToken: "--channel-bluesky",
    iconName: "api_publish",
    basisCheckedAt: "2026-08-21",
    rendersOwnArticle: false,
  },
} as const satisfies Readonly<Record<string, ChannelCapabilityShape>>;

/**
 * 配信先の種別。**表から導く**。
 *
 * 配信先を足す作業は「表に 1 エントリ足す」だけになり、
 * 型・画面・状態表示は自動で追随する。手書きの union に戻さないこと。
 */
export type ChannelKind = keyof typeof CHANNEL_CAPABILITIES;

/**
 * 表の 1 行。既存の呼び出し側はこの名前で参照している。
 * `kind` だけは表から導いた `ChannelKind` に狭める。
 */
export type ChannelCapability = ChannelCapabilityShape & { readonly kind: ChannelKind };

/** 画面に「直接公開」ボタンを出してよいチャネルか。 */
export function supportsDirectPublish(kind: ChannelKind): boolean {
  return CHANNEL_CAPABILITIES[kind].publishMode !== "manual_export";
}

/**
 * 記事の体裁を管理画面の中で整えてから出す配信先か。
 *
 * 画面側に `kind === "own_site"` と書かせないために置く。
 * 書かせると、同じ性質の配信先を足したときに画面を探して直すことになり、
 * 「表に 1 エントリ足すだけ」が崩れる。
 */
export function rendersOwnArticle(kind: ChannelKind): boolean {
  return CHANNEL_CAPABILITIES[kind].rendersOwnArticle;
}

/**
 * チャネル接続。
 *
 * 認証情報そのものはここに持たない。
 * トークンは infrastructure 層の秘密管理 (Workers Secrets) が保持し、
 * ドメインは「接続済みか」「いつ切れるか」だけを知る。
 */
export type ChannelConnection = {
  readonly id: ChannelConnectionId;
  readonly workspaceId: WorkspaceId;
  readonly kind: ChannelKind;
  /** 接続先の表示名 (アカウント名など)。誤爆防止のため画面に出す。 */
  readonly accountLabel: string;
  readonly connectedAt: Date;
  /** 認証の有効期限。null は期限なし。切れたら再接続を促す。 */
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  /** 認証情報の参照キー。値ではなく「どこに保管したか」だけを持つ。 */
  readonly credentialRef: string;
};

export function createChannelConnection(input: {
  id: ChannelConnectionId;
  workspaceId: WorkspaceId;
  kind: ChannelKind;
  accountLabel: string;
  connectedAt: Date;
  expiresAt?: Date | null;
  credentialRef: string;
}): Result<ChannelConnection, DomainError> {
  if (input.accountLabel.trim() === "") {
    return err(
      validationError("接続先のアカウント名が必要です。誤った接続先への投稿を防ぎます。", "accountLabel"),
    );
  }
  if (input.credentialRef.trim() === "") {
    return err(validationError("認証情報の保管先が必要です。", "credentialRef"));
  }
  // 認証情報そのものが渡されていないか、形で確認する。
  // ドメインのオブジェクトに秘密が入ると、ログや監査記録に流出する。
  if (looksLikeSecret(input.credentialRef)) {
    return err(
      validationError(
        "認証情報の値そのものを渡さないでください。保管先の参照キーだけを渡します。",
        "credentialRef",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    kind: input.kind,
    accountLabel: input.accountLabel.trim(),
    connectedAt: input.connectedAt,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    credentialRef: input.credentialRef.trim(),
  });
}

const SECRET_SHAPE = /^(Bearer\s|sk-|ghp_|xox[baprs]-|eyJ[A-Za-z0-9_-]{10,})/;

function looksLikeSecret(value: string): boolean {
  return SECRET_SHAPE.test(value.trim()) || value.trim().length > 200;
}

export function isConnectionUsable(c: ChannelConnection, at: Date): boolean {
  if (c.revokedAt !== null && c.revokedAt <= at) return false;
  if (c.expiresAt !== null && c.expiresAt <= at) return false;
  return true;
}
