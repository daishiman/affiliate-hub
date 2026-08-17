import {
  type AssetId,
  type DomainError,
  type Provenance,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Content Authoring コンテキスト / Asset (§21 E26)。
 *
 * 記事に載せる画像・図・表の元データ。
 *
 * **由来 ([[Provenance]]) と利用条件を持たない素材は作れない。**
 * これは「あったほうがよい」ではなく、この仕組み全体の前提。
 * よそのサイトの画像を無断で複製することを禁じている以上、
 * 「どこから来たか言えない画像」は載せられないのと同じ意味になる。
 *
 * 型で必須にしておくと、あとから「この画像どこの？」と探し直す作業が発生しない。
 */
export const ASSET_KINDS = ["image", "diagram", "chart", "table", "file"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_LABELS: Readonly<Record<AssetKind, string>> = {
  image: "写真",
  diagram: "図",
  chart: "グラフ",
  table: "表",
  file: "ファイル",
};

export type Asset = {
  readonly id: AssetId;
  readonly workspaceId: WorkspaceId;
  readonly kind: AssetKind;
  /** 保管場所の鍵。URL ではなく鍵で持つ（置き場所が変わっても記事は変わらない）。 */
  readonly storageKey: string;
  /**
   * 代替テキスト。空にできない。
   * 目で見られない人にとっては、これが画像そのものになる（WCAG 2.2 AA）。
   */
  readonly altText: string;
  /** どこから来たか。利用条件はこの中の `permittedUsage` に文字で残す。 */
  readonly provenance: Provenance;
  readonly createdAt: Date;
};

export function createAsset(input: {
  id: AssetId;
  workspaceId: WorkspaceId;
  kind: AssetKind;
  storageKey: string;
  altText: string;
  provenance: Provenance;
  createdAt: Date;
}): Result<Asset, DomainError> {
  if (input.storageKey.trim() === "") {
    return err(validationError("素材の保管先が必要です。", "storageKey"));
  }
  const altText = input.altText.trim();
  if (altText === "") {
    return err(
      validationError(
        "代替テキストが必要です。画面を見られない読者には、これが素材そのものになります。",
        "altText",
      ),
    );
  }
  if (input.provenance.permittedUsage.trim() === "") {
    return err(
      validationError(
        "利用条件が空の素材は登録できません。使ってよい範囲を書いてください（例: 「販売店リンク併記時のみ」）。",
        "permittedUsage",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    kind: input.kind,
    storageKey: input.storageKey.trim(),
    altText,
    provenance: input.provenance,
    createdAt: input.createdAt,
  });
}

/**
 * その時点で使ってよいか。
 * 期限つきで許諾された素材（メーカー提供の製品画像など）を、
 * 期限切れのまま公開し続けることを防ぐ。
 */
export function isAssetUsable(asset: Asset, at: Date): boolean {
  const until = asset.provenance.validUntil;
  return until === null || until > at;
}
