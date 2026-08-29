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
  /**
   * 記事の既定の言語。日付・数量の書式もこれに従う。
   * サイトごとに変えられるが、既定はブランドが持つ。
   */
  readonly locale: string;
  /**
   * 予定日時を読み書きするときの時間帯。
   * ここが揃っていないと、投稿カレンダーの「20日 9:00」が人によって別の時刻になる。
   */
  readonly timeZone: string;
  /**
   * 標準の行動文言（「価格を見る」など）。
   * 記事ごとに書き起こすと、同じ運営者なのに誘い方がばらつく。
   */
  readonly defaultCta: string;
  readonly createdAt: Date;
};

/** 既定値。未設定と「あえてこの値」を区別できるよう、定数として置く。 */
export const DEFAULT_LOCALE = "ja-JP";
export const DEFAULT_TIME_ZONE = "Asia/Tokyo";
export const DEFAULT_CTA = "価格を見る";

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
  locale?: string;
  timeZone?: string;
  defaultCta?: string;
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
    locale: input.locale?.trim() || DEFAULT_LOCALE,
    timeZone: input.timeZone?.trim() || DEFAULT_TIME_ZONE,
    defaultCta: input.defaultCta?.trim() || DEFAULT_CTA,
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

/**
 * ブランドの標準値のうち、記事生成の入力へそのまま渡すもの。
 *
 * 生成側の型（`GenerationInput`）を **import しない**。
 * ブランドは身元の文脈、生成は制作の文脈で、どちらも相手を知らないでよい。
 * 形だけを合わせておけば、受け取る側が構造的に受け取れる。
 * import すると、生成側の都合でブランドが動かされるようになる。
 */
export type BrandGenerationDefaults = {
  readonly cta: { readonly kind: string; readonly phrase: string } | null;
  readonly disclosure: string | null;
};

/**
 * ブランド設定 → 記事生成の既定値。
 *
 * **免責が未設定なら埋めない。** ここで既定文を入れると、
 * 「書いていないのに広告表記が付いた記事」が公開まで通る。
 * `null` のまま返し、生成の手前（`missingInputFields`）で止まらせる。
 * 呼びかけ文のほうは `createBrand` が必ず既定を入れるので、常に埋まる。
 */
export function brandGenerationDefaults(brand: Brand): BrandGenerationDefaults {
  return {
    cta: { kind: "brand_default", phrase: brand.defaultCta },
    disclosure: brand.disclaimer,
  };
}

/**
 * 呼び出し側が明示しなかったところだけを、ブランドの標準値で埋める。
 *
 * **明示した値が勝つ。** 記事ごとに呼びかけを変えたい場面はあり、
 * そこでブランドの標準値が上書きしてしまうと、指定した意味が無くなる。
 *
 * ブランドが取れないとき（保存先へ届かない等）は `null` を渡す。
 * 何も足さずに返し、足りなければ生成の手前で止まる。
 * ここで見本の値をでっち上げると、**設定していないのに動いてしまう**。
 *
 * `cta` を `??` で倒してよいのは、このコードベースで `cta: null` が
 * 「呼びかけを置かない」を意味しないためである。`missingInputFields` は
 * `null` を欠落として数える（`isEmpty(null)` が真）。置かない意図は
 * `{ kind: "none", phrase: ... }` と明示するしかなく、明示されたものは
 * ここで上書きされない。この前提が変わったら、ここも変える必要がある。
 */
export type BrandDefaultable = {
  readonly cta?: { readonly kind: string; readonly phrase: string } | null;
  /**
   * 受け取る側は `null` を持たない。**未設定は `undefined` で表す。**
   *
   * `brandGenerationDefaults` は `null`（＝ブランドが免責を決めていない）を返すが、
   * それをそのまま流すと、受け取る型（`GenerationInput`）と食い違う。
   * 境目をここに置き、`null` は `undefined` へ落として渡す。
   */
  readonly disclosure?: string;
};

export function withBrandDefaults<T extends BrandDefaultable>(
  brand: Brand | null,
  provided: T,
): T & BrandDefaultable {
  if (brand === null) return provided;
  const d = brandGenerationDefaults(brand);
  return {
    ...provided,
    cta: provided.cta ?? d.cta,
    disclosure: provided.disclosure ?? d.disclosure ?? undefined,
  };
}
