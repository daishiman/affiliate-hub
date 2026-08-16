import {
  type BrandId,
  type DomainError,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Identity & Tenancy コンテキスト / Brand 集約。
 *
 * Brand は「読者から見た発信主体」(プラットフォーム層 §7.1)。
 * 1 ワークスペースが複数ブランドを持ち、1 ブランドが複数サイト・チャネルを持つ。
 *
 * ブランドをサイトと分ける理由:
 *   - 同じブランドで「サイト + X + YouTube」を出すとき、名乗り・声・免責は共通
 *   - サイトを 1 つ増やすたびにブランド設定を書き写すと、必ず食い違う
 *
 * ここに置くのは「どの面でも変わらないもの」だけ。
 * 見た目 (色・書体) はサイト側のテーマトークンが持つ。
 */
export type Brand = {
  readonly id: BrandId;
  readonly workspaceId: WorkspaceId;
  /** 読者に見せる名前。運営者情報・著者欄・SNS の名乗りで同じ文字列を使う。 */
  readonly displayName: string;
  /** 運営者の法的表示名。特定商取引法・運営者情報ページで使う。 */
  readonly legalName: string | null;
  /** 問い合わせ先。訂正報告の導線に必要 (公開ゲートの前提)。 */
  readonly contactEmail: string | null;
  /** ブランドの立場を 1 文で。AI 生成の文体指示の土台になる。 */
  readonly positioning: string;
  /** 声のトーン。書き手ペルソナより上位の制約。 */
  readonly voice: BrandVoice;
  /** 全記事の末尾に必ず出す免責。空でもよいが、設定漏れと区別する。 */
  readonly disclaimer: string | null;
  readonly createdAt: Date;
};

export type BrandVoice = {
  /** 敬体/常体。サイト間で混ざると同じ運営者に見えない。 */
  readonly politeness: "polite" | "plain";
  /** 一人称。「私たち」「編集部」など。 */
  readonly firstPerson: string;
  /** 使う言葉。専門用語をどこまで残すか。 */
  readonly vocabulary: "plain" | "mixed" | "technical";
  /** 使ってはいけない言い回し。ブランド固有の禁止表現。 */
  readonly avoidPhrases: readonly string[];
};

export const DEFAULT_BRAND_VOICE: BrandVoice = {
  politeness: "polite",
  firstPerson: "編集部",
  vocabulary: "mixed",
  avoidPhrases: [],
};

export function createBrand(input: {
  id: BrandId;
  workspaceId: WorkspaceId;
  displayName: string;
  legalName?: string | null;
  contactEmail?: string | null;
  positioning: string;
  voice?: BrandVoice;
  disclaimer?: string | null;
  createdAt: Date;
}): Result<Brand, DomainError> {
  if (input.displayName.trim() === "") {
    return err(validationError("ブランド名が必要です。", "displayName"));
  }
  if (input.positioning.trim() === "") {
    return err(
      validationError(
        "ブランドの立場を 1 文で書いてください。これが無いと、サイトごとに書き手の姿勢がばらつきます。",
        "positioning",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    displayName: input.displayName.trim(),
    legalName: input.legalName ?? null,
    contactEmail: input.contactEmail ?? null,
    positioning: input.positioning.trim(),
    voice: input.voice ?? DEFAULT_BRAND_VOICE,
    disclaimer: input.disclaimer ?? null,
    createdAt: input.createdAt,
  });
}

/**
 * 公開に必要なブランド情報が揃っているか。
 *
 * 公開ゲートは記事単位で見るが、訂正報告先の欠落は
 * ブランド単位で 1 度だけ止めれば足りる。
 */
export function missingPublishReadiness(brand: Brand): readonly string[] {
  const missing: string[] = [];
  if (!brand.legalName) missing.push("運営者の表示名");
  if (!brand.contactEmail) missing.push("問い合わせ先メールアドレス");
  return missing;
}
