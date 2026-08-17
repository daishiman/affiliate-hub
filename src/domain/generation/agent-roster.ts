/**
 * 生成を担う役の分け方（生成基盤設計 §3）。
 *
 * 一番大事な決まりは 1 つ（GC-5）。
 * **書いた役に、自分の書いたものを検証させない。**
 * 書いたときの前提をそのまま正しいものとして扱ってしまうため、
 * 検証にならない。だから検証役は別の役として立て、
 * 書いたときのやり取りを引き継がせない。
 *
 * これを守る手立ては 3 段。
 *   1. 型: 検証役は生成の道具を持てない（そう書くとコンパイルが通らない）
 *   2. 型: 検証役は前の話の続きから始められない（`freshContext` が真で固定）
 *   3. 検査: 一覧に対する検査で、役の重複と道具の逸脱を機械的に見る
 */

/** 執筆側が使える道具。 */
export type AuthoringTool = "read" | "fetch" | "generate";
/** 検証側が使える道具。**生成は入れられない。** */
export type ReviewTool = "read";

type Common = {
  readonly id: string;
  readonly label: string;
  /** この役がやること。 */
  readonly responsibility: string;
  /** この役がやってはいけないこと。 */
  readonly mustNot: string;
  readonly output: string;
};

export type AuthoringAgent = Common & {
  readonly kind: "collect" | "write" | "convert";
  readonly tools: readonly AuthoringTool[];
  /** 執筆側は前の工程の文脈を引き継いでよい。 */
  readonly freshContext: boolean;
};

export type ReviewAgent = Common & {
  readonly kind: "verify" | "integrate";
  readonly tools: readonly ReviewTool[];
  /** 検証側は必ず新しい文脈で始める。ここは true 以外を書けない。 */
  readonly freshContext: true;
};

export type GenerationAgent = AuthoringAgent | ReviewAgent;

export const GENERATION_AGENTS: readonly GenerationAgent[] = [
  {
    id: "content-researcher",
    label: "素材集め役",
    kind: "collect",
    responsibility: "素材を集めて整える。根拠の候補と出どころを記録する。",
    mustNot: "集めた候補を確定させない。採否は担当者が決める。",
    tools: ["read", "fetch"],
    freshContext: false,
    output: "根拠の候補一覧（未確定）",
  },
  {
    id: "content-writer",
    label: "書き役",
    kind: "write",
    responsibility: "構成・本文・会話の作成を行う。",
    mustNot: "自分の書いたものを自分で検証しない。素材に無い事実を足さない。",
    tools: ["read", "generate"],
    freshContext: false,
    output: "コンテンツ版の下書き",
  },
  {
    id: "fact-checker",
    label: "事実の確認役",
    kind: "verify",
    responsibility: "本文の主張を、承認済みの主張と根拠へ 1 つずつ突き合わせる。",
    mustNot: "本文を書き直さない。指摘の列挙だけを行う。",
    tools: ["read"],
    freshContext: true,
    output: "主張ごとの判定（裏づけあり／裏づけなし／食い違い）と根拠の番号",
  },
  {
    id: "compliance-reviewer",
    label: "決まりの確認役",
    kind: "verify",
    responsibility: "薬機法・景表法・広告表示・ASP の規約・出し先の規約への適合を見る。",
    mustNot: "本文を書き直さない。判定の根拠を空欄にしない。",
    tools: ["read"],
    freshContext: true,
    output: "決まりごとの判定と、その判定の根拠",
  },
  {
    id: "channel-adapter",
    label: "出し先あわせ役",
    kind: "convert",
    responsibility: "承認済みの本文を、出し先ごとの決まりと文字数へ合わせる。",
    mustNot: "本文に無い事実を足さない。長さを詰めるために断り書きを落とさない。",
    tools: ["read", "generate"],
    freshContext: false,
    output: "出し先ごとのコンテンツ版",
  },
  {
    id: "content-editor",
    label: "まとめ役",
    kind: "integrate",
    responsibility: "各役の結果をまとめ、担当者が判断する差分と論点を作る。",
    mustNot: "検証の結果を書き換えない。まとめと提示だけを行う。",
    tools: ["read"],
    freshContext: true,
    output: "採用・修正・保留の推しどころとその理由",
  },
];

/** 検証にあたる役。 */
export function verifiers(): readonly ReviewAgent[] {
  return GENERATION_AGENTS.filter((a): a is ReviewAgent => a.kind === "verify");
}

/** 書く側の役。 */
export function authors(): readonly AuthoringAgent[] {
  return GENERATION_AGENTS.filter((a): a is AuthoringAgent => a.kind === "write");
}

/**
 * 書き役と検証役が同じ役になっていないことを確かめる（GC-5）。
 * 一覧を書き替えたときに、この検査が壊れて気づける。
 */
export function separationBreaches(
  roster: readonly GenerationAgent[] = GENERATION_AGENTS,
): readonly string[] {
  const breaches: string[] = [];
  const writerIds = new Set(roster.filter((a) => a.kind === "write").map((a) => a.id));
  for (const agent of roster) {
    if (agent.kind !== "verify" && agent.kind !== "integrate") continue;
    if (writerIds.has(agent.id)) {
      breaches.push(`${agent.label} が書き役と同じ役になっています。`);
    }
    if ((agent.tools as readonly string[]).includes("generate")) {
      breaches.push(`${agent.label} が生成の道具を持っています。`);
    }
    // 型では true 以外を書けないが、一覧を組み立てる側で崩れることはある。
    // 実行時にも見ておく（型だけの保証は `as` で外せる）。
    if ((agent as { freshContext: boolean }).freshContext !== true) {
      breaches.push(`${agent.label} が書いたときのやり取りを引き継いでいます。`);
    }
  }
  return breaches;
}

/** 指摘を受けて書き直してよい回数。 */
export const MAX_REVISION_ROUNDS = 3;

export type RevisionOutcome =
  | { readonly kind: "retry"; readonly round: number }
  | { readonly kind: "hand_to_human"; readonly round: number; readonly reason: string };

/**
 * 書き直しの打ち切り。
 * 3 回で片づかないものは、片づいたことにせず人へ渡す。
 */
export function concludeRevision(round: number, openIssues: number): RevisionOutcome {
  if (openIssues === 0) return { kind: "retry", round };
  if (round < MAX_REVISION_ROUNDS) return { kind: "retry", round: round + 1 };
  return {
    kind: "hand_to_human",
    round,
    reason: `${MAX_REVISION_ROUNDS} 回書き直しても ${openIssues} 件の指摘が残りました。解消したことにせず、担当者の判断へ回します。`,
  };
}
