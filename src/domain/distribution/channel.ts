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
 */
export type ChannelKind =
  | "own_site" // 自社サイト (Workers 上のブログ)
  | "x"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "threads"
  | "note"
  | "newsletter"
  | "wordpress"
  | "bluesky";

/**
 * 出稿の方式。
 *   api_publish   : 公式 API で投稿まで行える
 *   api_schedule  : 公式 API で予約投稿まで行える
 *   manual_export : 下書きを書き出し、人が貼り付ける (公式 API が無い)
 */
export type PublishMode = "api_publish" | "api_schedule" | "manual_export";

export type ChannelCapability = {
  readonly kind: ChannelKind;
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
};

/**
 * チャネル能力表。
 *
 * 数値は各社の規約・仕様に依存し変動するため、
 * ここは「初期値」であって最終的な正本ではない。
 * 実運用ではワークスペース設定で上書きできるようにする。
 */
export const CHANNEL_CAPABILITIES: Readonly<Record<ChannelKind, ChannelCapability>> = {
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
  }
};

/** 画面に「直接公開」ボタンを出してよいチャネルか。 */
export function supportsDirectPublish(kind: ChannelKind): boolean {
  return CHANNEL_CAPABILITIES[kind].publishMode !== "manual_export";
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
