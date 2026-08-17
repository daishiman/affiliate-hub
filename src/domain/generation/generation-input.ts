import type { Editorial } from "../shared/data-classification";
import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * 生成に渡す入力（生成基盤設計 §1-2）。
 *
 * 中心にある決まりは 1 つだけ。
 * **AI に自由に書かせず、承認済みの素材を渡して書かせる**（GC-1）。
 *
 * そのため入力の欄は固定し、1 つでも欠けたら生成を始めない。
 * 「足りない分は AI がうまく補う」を許すと、
 * 素材に無い事実がどこから来たのか誰にも追えなくなる。
 *
 * もう 1 つ、報酬に関する数字はこの型に入れられない（GC-4）。
 * 商品の素材は `Editorial` の印が付いたものだけを受け取るので、
 * 報酬の付いた素材を渡すとコンパイルの時点で止まる。
 */

/** 入力欄の 1 つ。仕様のどこから来たかを持たせ、後から照合できるようにする。 */
export type GenerationInputField = {
  readonly key: GenerationInputKey;
  /** 画面と AI への説明に使う日本語名。 */
  readonly label: string;
  /** なぜ人が決めた値を渡す必要があるか。 */
  readonly why: string;
  /** 本設計で足した欄か（仕様 §1-2 の「以下は本設計で追加した必須入力」）。 */
  readonly addedByDesign: boolean;
  /** 記事の種類によっては空でよい欄か。 */
  readonly optionalWhen: string | null;
};

export const GENERATION_INPUT_KEYS = [
  "subject",
  "products",
  "claims",
  "evidence",
  "testRuns",
  "authorPersona",
  "audiencePersona",
  "channel",
  "contentPurpose",
  "purchaseStage",
  "angle",
  "length",
  "cta",
  "disclosure",
  "forbiddenExpressions",
  "articleTemplate",
  "siteBlueprint",
  "rankingModel",
] as const;
export type GenerationInputKey = (typeof GENERATION_INPUT_KEYS)[number];

export const GENERATION_INPUT_FIELDS: readonly GenerationInputField[] = [
  {
    key: "subject",
    label: "主題",
    why: "何について書くかを人が決める。AI に題材から選ばせない。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "products",
    label: "承認済みの商品",
    why: "商品の仕様は承認済みのものだけを使う。報酬に関する数字は型として渡せない。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "claims",
    label: "承認済みの主張",
    why: "本文に書いてよい主張の範囲をあらかじめ確定させる。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "evidence",
    label: "根拠",
    why: "主張ごとの裏づけ。これが無い主張は公開できない。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "testRuns",
    label: "実測の記録",
    why: "自分で試した結果と、他所から取った数字を混ぜないため、別の欄で渡す。",
    addedByDesign: false,
    optionalWhen: "実測をしていない記事では空の一覧を渡す（省略はできない）",
  },
  {
    key: "authorPersona",
    label: "書き手",
    why: "誰の立場で書くかが決まらないと、文体も断り方も定まらない。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "audiencePersona",
    label: "読者",
    why: "前提知識の量で説明の深さが変わる。読者を決めずに書かせない。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "channel",
    label: "出し先",
    why: "出し先ごとに文字数と広告表示の決まりが違う。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "contentPurpose",
    label: "この記事の目的",
    why: "読んだ人に何をしてほしいかが決まらないと、締めが定まらない。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "purchaseStage",
    label: "購買段階",
    why: "調べ始めの人と買う直前の人では、必要な情報が違う。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "angle",
    label: "切り口",
    why: "同じ商品でも切り口が違えば別の記事になる。重複を避ける要でもある。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "length",
    label: "長さ",
    why: "長さを決めずに書かせると、出し先の上限を超えた本文が出てくる。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "cta",
    label: "行動の呼びかけ",
    why: "呼びかけ方は人が決める。AI に売り方を発明させない。",
    addedByDesign: false,
    optionalWhen: "呼びかけを置かない記事では「置かない」と明示して渡す",
  },
  {
    key: "disclosure",
    label: "広告表示",
    why: "成果リンクを含む記事では必ず要る。後から足すと入れ忘れが起きる。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "forbiddenExpressions",
    label: "禁止する言い回し",
    why: "薬機法・景表法に触れる言い回しを、生成の前に渡して避けさせる。",
    addedByDesign: false,
    optionalWhen: null,
  },
  {
    key: "articleTemplate",
    label: "記事の型",
    why: "節の並びと各節の役目を先に決める。並びを AI に決めさせない。",
    addedByDesign: true,
    optionalWhen: null,
  },
  {
    key: "siteBlueprint",
    label: "サイトブループリント",
    why: "どのブログの記事かで、文体・会話の有無・差別化の軸が変わる。",
    addedByDesign: true,
    optionalWhen: null,
  },
  {
    key: "rankingModel",
    label: "順位の決め方",
    why: "順位を書く記事では、何をどう重みづけたかを本文へ書く必要がある。",
    addedByDesign: true,
    optionalWhen: "順位を扱わない記事では null を渡す",
  },
];

/** 記事の種類にかかわらず空にできない欄。 */
export const REQUIRED_INPUT_KEYS: readonly GenerationInputKey[] = GENERATION_INPUT_KEYS.filter(
  (k) => k !== "rankingModel",
);

/**
 * 生成の入力。
 *
 * `products` は `Editorial` の印つき。報酬の付いた素材は渡せない（GC-4）。
 * 各素材の中身は各コンテキストが持つため、ここでは識別子と最小限だけを持つ。
 */
export type EditorialMaterial = Editorial<{
  readonly id: string;
  readonly label: string;
}>;

export type GenerationInput = {
  readonly subject: string;
  readonly products: readonly EditorialMaterial[];
  readonly claims: readonly { readonly id: string; readonly statement: string }[];
  readonly evidence: readonly { readonly id: string; readonly sourceUrl: string | null }[];
  readonly testRuns: readonly { readonly id: string }[];
  readonly authorPersona: { readonly id: string; readonly role: string };
  readonly audiencePersona: { readonly id: string; readonly knowledgeLevel: string };
  readonly channel: string;
  readonly contentPurpose: string;
  readonly purchaseStage: string;
  readonly angle: string;
  readonly length: { readonly kind: string; readonly minChars: number; readonly maxChars: number };
  readonly cta: { readonly kind: string; readonly phrase: string } | null;
  readonly disclosure: string;
  readonly forbiddenExpressions: readonly string[];
  readonly articleTemplate: { readonly type: string; readonly sectionIds: readonly string[] };
  readonly siteBlueprint: { readonly id: string; readonly slug: string };
  readonly rankingModel: { readonly id: string } | null;
};

/** どの欄が埋まっていないか。 */
export type MissingInputField = {
  readonly key: GenerationInputKey;
  readonly label: string;
  readonly howToFill: string;
};

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  // 空の一覧は「まだ渡していない」ではなく「無いと確認した」ことがある。
  // 一覧の欄は個別に扱うため、ここでは空でないものだけを埋まっていると見なさない。
  return false;
}

/**
 * 入力の充足を確かめる（GC-1）。
 *
 * 欠けた欄があれば生成を始めない。**AI に補わせない。**
 * 失敗のときは「どの欄が」「どう埋めるか」まで返す。
 * 「入力が不正です」だけでは、次に何をすればよいか分からない。
 */
export function validateGenerationInput(
  input: Partial<GenerationInput>,
): Result<GenerationInput, DomainError> {
  const missing = missingInputFields(input);
  if (missing.length > 0) {
    return err(
      domainError(
        "VALIDATION_FAILED",
        `生成に必要な項目が ${missing.length} 件そろっていません: ${missing
          .map((m) => m.label)
          .join("・")}`,
        {
          suggestedAction:
            "足りない項目を決めてから生成してください。足りないまま生成すると、素材に無いことが本文に混ざります。",
          details: { missing: missing.map((m) => m.key).join(",") },
        },
      ),
    );
  }
  return ok(input as GenerationInput);
}

/** どの欄が足りないかを一覧で返す。画面はこれをそのまま並べる。 */
export function missingInputFields(input: Partial<GenerationInput>): readonly MissingInputField[] {
  const missing: MissingInputField[] = [];
  for (const field of GENERATION_INPUT_FIELDS) {
    if (!REQUIRED_INPUT_KEYS.includes(field.key)) continue;
    const value = (input as Record<string, unknown>)[field.key];
    // 一覧の欄は「渡していない」だけを欠落とする。空の一覧は渡したと見なす。
    if (value === undefined || isEmpty(value)) {
      missing.push({
        key: field.key,
        label: field.label,
        howToFill: field.optionalWhen ?? field.why,
      });
    }
  }
  // 順位の決め方は、順位を扱う記事でだけ必須。
  if (input.articleTemplate?.type === "ranking" && !input.rankingModel) {
    missing.push({
      key: "rankingModel",
      label: "順位の決め方",
      howToFill: "順位を書く記事では、どの基準でどう重みづけたかを渡してください。",
    });
  }
  return missing;
}
