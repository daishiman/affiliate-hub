import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * 指示文の組み立て方（生成基盤設計 §1-1・§1-3）。
 *
 * 指示文は 7 つの塊で固定する。順番も固定する。
 * なぜ固定するか: 塊を欠いたまま生成すると、
 * 「素材を渡し忘れたのか」「素材はあるのに書かれなかったのか」が後から分からない。
 * 塊を固定しておくと、欠けたことを出す前に検出できる。
 *
 * 版（v1・v2…）は上書きしない。1 文字でも変えたら新しい版を作る。
 * 過去に出した記事がどの指示文から出たのかを追えなくすると、
 * 「なぜこの表現になったか」を誰も再現できなくなる。
 */

export const PROMPT_BLOCK_IDS = [
  "role",
  "absolute_rules",
  "materials",
  "audience_and_channel",
  "structure",
  "style",
  "output_contract",
] as const;
export type PromptBlockId = (typeof PROMPT_BLOCK_IDS)[number];

export type PromptBlock = {
  readonly id: PromptBlockId;
  /** 何番目の塊か。1 から始める。 */
  readonly order: number;
  readonly label: string;
  /** この塊が担うこと。 */
  readonly role: string;
  /** ここに入れてはならないもの。 */
  readonly mustNotContain: string;
  /** この塊を作るのに要る入力欄。 */
  readonly needs: readonly string[];
};

export const PROMPT_BLOCKS: readonly PromptBlock[] = [
  {
    id: "role",
    order: 1,
    label: "役割",
    role: "誰の立場で書くかを決める。あわせて「事実を作らない」ことを最初に置く。",
    mustNotContain: "外部から取り込んだ文章。ここに混ぜると、それが指示として読まれる。",
    needs: ["authorPersona"],
  },
  {
    id: "absolute_rules",
    order: 2,
    label: "絶対に守ること",
    role: "素材に無い数値・仕様・体験を書かないこと、禁止する言い回し、出力の形を守ることを示す。",
    mustNotContain: "例外条件。「ただし〜の場合は」を書くと、そこが抜け道になる。",
    needs: ["forbiddenExpressions"],
  },
  {
    id: "materials",
    order: 3,
    label: "素材",
    role: "承認済みの商品・主張・根拠・実測を、資料として渡す。",
    mustNotContain: "報酬に関する数字。渡せば順位づけに影響しうる。型でも渡せないようにしてある。",
    needs: ["products", "claims", "evidence", "testRuns"],
  },
  {
    id: "audience_and_channel",
    order: 4,
    label: "読者と出し先",
    role: "誰に向けて、どこへ、どの長さで、どの切り口で書くかを決める。",
    mustNotContain: "書き手側の都合（納期・本数）。読者向けの文章に混ざる。",
    needs: ["audiencePersona", "purchaseStage", "channel", "length", "angle", "cta"],
  },
  {
    id: "structure",
    order: 5,
    label: "構成の指示",
    role: "節の並びと、各節の見出しの作り方・字数・必要な事実の種類・呼びかけを渡す。",
    mustNotContain: "「適宜まとめてよい」のような裁量。並びが記事ごとに変わると比較できない。",
    needs: ["articleTemplate"],
  },
  {
    id: "style",
    order: 6,
    label: "文体",
    role: "文の長さ・段落・単位・日付の書き方・事実の書き分けを渡す。",
    mustNotContain: "ブログごとの個別の言い回し。サイトブループリント側の値として渡す。",
    needs: ["siteBlueprint"],
  },
  {
    id: "output_contract",
    order: 7,
    label: "出力の形",
    role: "返してよい形を 1 つに決める。散文で返させない。",
    mustNotContain: "「なるべく」という表現。形が揺れると受け取り側が壊れる。",
    needs: [],
  },
];

/** 指示文の版。`v` + 数字だけを許す。 */
export type PromptVersion = `v${number}`;

export function isPromptVersion(value: string): value is PromptVersion {
  return /^v[1-9][0-9]*$/.test(value);
}

/** 指示文の置き場所。版ごとのフォルダを切り、既存の版のファイルは書き換えない。 */
export const PROMPT_ROOT = "prompts/generation";

export type PromptFileKind =
  | "article-outline"
  | "article-body"
  | "comparison-table"
  | "conversation-block"
  | "channel-variant"
  | "quality-inspection"
  | "disclosure-insertion"
  | "meta-generation";

/**
 * 指示文ファイルの場所を組み立てる。
 * 文字列を画面ごとに書くと、版を上げたときに片方だけ古くなる。
 */
export function promptPath(
  version: PromptVersion,
  kind: PromptFileKind,
  qualifier?: string,
): string {
  const name = qualifier ? `${kind}.${qualifier}` : kind;
  return `${PROMPT_ROOT}/${version}/${name}.md`;
}

/** 全プロンプトで共通に読み込む部分。 */
export const SHARED_PROMPT_FILES: readonly { readonly file: string; readonly contains: string }[] = [
  { file: "_shared/system-base.md", contains: "全プロンプト共通の土台" },
  { file: "_shared/fact-discipline.md", contains: "事実 6 分類の書き分け" },
  { file: "_shared/style-rules.md", contains: "文体の規則" },
  { file: "_shared/forbidden-expressions.md", contains: "禁止する言い回し" },
];

/**
 * 版を変えるときの判定。
 *
 * 既存の版を書き換えることを許さない。書き換えた瞬間、
 * その版で出した過去の記事を再現できなくなる。
 */
export function requireNewVersion(
  current: PromptVersion,
  intent: "edit_in_place" | "new_version",
): Result<PromptVersion, DomainError> {
  if (intent === "edit_in_place") {
    return err(
      domainError("INVARIANT_VIOLATED", `${current} の指示文をそのまま書き換えることはできません。`, {
        suggestedAction: `${nextVersion(current)} を新しく作ってから変更してください。過去に出した記事をどの指示文で書いたか追えなくなります。`,
      }),
    );
  }
  return ok(nextVersion(current));
}

export function nextVersion(current: PromptVersion): PromptVersion {
  const n = Number(current.slice(1));
  return `v${n + 1}` as PromptVersion;
}

/**
 * 塊がそろっているかを確かめる。
 * 欠けた塊があれば、その塊が何のためのものかも一緒に返す。
 */
export function missingPromptBlocks(present: readonly string[]): readonly PromptBlock[] {
  const has = new Set(present);
  return PROMPT_BLOCKS.filter((b) => !has.has(b.id));
}
