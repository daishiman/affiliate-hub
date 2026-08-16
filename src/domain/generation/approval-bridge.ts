import {
  CONTENT_STATES,
  type ContentState,
  HUMAN_APPROVAL_REQUIRED,
  allowedNextStates,
} from "../authoring/content-state";

/**
 * 生成の手順と、承認の段階のつなぎ目（生成基盤設計 §3-3）。
 *
 * どこまで AI だけで進めてよく、どこから人の承認が要るかを 1 箇所で持つ。
 * 画面ごと・道具ごとに書くと、必ずどこかが緩む。
 * ここで決めた境界は、画面からも AI からも迂回できない。
 */

export type StageBridge = {
  readonly state: ContentState;
  readonly label: string;
  /** この段階で動く手順（`skill-catalog.ts` の id）。無ければ空。 */
  readonly skillIds: readonly string[];
  /** 次へ進めるのは誰か。 */
  readonly advancedBy: "ai" | "human";
  /** なぜ人が要るのか、または AI だけでよいのか。 */
  readonly why: string;
};

export const STAGE_BRIDGE: readonly StageBridge[] = [
  {
    state: "IDEA",
    label: "着想",
    skillIds: [],
    advancedBy: "human",
    why: "何について書くかは人が決めます。題材選びを任せません。",
  },
  {
    state: "RESEARCHING",
    label: "素材集め",
    skillIds: [],
    advancedBy: "ai",
    why: "候補を集めるだけで、採否は決めません。",
  },
  {
    state: "BRIEF_READY",
    label: "骨組みができた",
    skillIds: ["generate-article-outline"],
    advancedBy: "human",
    why: "骨組みを承認しないまま本文へ進むと、承認前の並びに沿った本文が積み上がります。",
  },
  {
    state: "GENERATED",
    label: "本文ができた",
    skillIds: [
      "write-article-body",
      "generate-comparison-table",
      "generate-conversation-block",
      "insert-affiliate-disclosure",
    ],
    advancedBy: "ai",
    why: "書くところまでは進めます。ここではまだ公開できません。",
  },
  {
    state: "FACT_CHECK",
    label: "事実の確認",
    skillIds: ["inspect-content-quality"],
    advancedBy: "ai",
    why: "書いた役とは別の役が確認します。指摘を並べるだけで、直しはしません。",
  },
  {
    state: "COMPLIANCE_REVIEW",
    label: "決まりの確認",
    skillIds: ["inspect-content-quality"],
    advancedBy: "ai",
    why: "薬機法・景表法・広告表示・規約への適合を、根拠つきで判定します。",
  },
  {
    state: "APPROVED",
    label: "承認済み",
    skillIds: ["generate-content-meta"],
    advancedBy: "human",
    why: "内容の責任を持つのは人です。ここは AI では越えられません。",
  },
  {
    state: "SCHEDULED",
    label: "公開待ち",
    skillIds: ["convert-to-channel-variant"],
    advancedBy: "human",
    why: "いつ出すかは人が決めます。",
  },
  {
    state: "PUBLISHED",
    label: "公開済み",
    skillIds: [],
    advancedBy: "human",
    why: "公開は人の操作でだけ行います。",
  },
  {
    state: "MONITORING",
    label: "様子見",
    skillIds: [],
    advancedBy: "ai",
    why: "公開後の数字を見ます。内容は変えません。",
  },
  {
    state: "REFRESH_DUE",
    label: "更新の時期",
    skillIds: [],
    advancedBy: "ai",
    why: "古くなった箇所を示すところまでを行います。",
  },
  {
    state: "ARCHIVED",
    label: "取り下げ済み",
    skillIds: [],
    advancedBy: "human",
    why: "取り下げは人の判断です。",
  },
];

export function bridgeFor(state: ContentState): StageBridge {
  const found = STAGE_BRIDGE.find((s) => s.state === state);
  // 一覧は状態の定義から漏れなく作る決まりなので、ここには来ない。
  // 来た場合は状態を足して一覧を足し忘れているので、そう分かる形で落とす。
  if (!found) throw new Error(`${state} の進め方が決まっていません。`);
  return found;
}

/**
 * つなぎ目の一覧が、状態の定義とずれていないことを確かめる。
 * 状態を足して一覧を足し忘れると、その段階が誰の担当か決まらない。
 */
export function bridgeBreaches(): readonly string[] {
  const breaches: string[] = [];
  const listed = new Set(STAGE_BRIDGE.map((s) => s.state));
  for (const state of CONTENT_STATES) {
    if (!listed.has(state)) breaches.push(`${state} の進め方が決まっていません。`);
  }
  for (const bridge of STAGE_BRIDGE) {
    // 人の承認が要る状態へ「AI が進める」と書いていないか。
    const humanOnlyNext = allowedNextStates(bridge.state).filter((n) =>
      HUMAN_APPROVAL_REQUIRED.has(n),
    );
    if (bridge.advancedBy === "ai" && humanOnlyNext.length > 0) {
      const stillAllowed = humanOnlyNext.every((n) => bridgeFor(n).advancedBy === "human");
      if (!stillAllowed) {
        breaches.push(`${bridge.label} から人の承認が要る状態へ、AI だけで進めるようになっています。`);
      }
    }
  }
  return breaches;
}

/** AI サービスアカウントだけで越えられない段階。画面の説明にそのまま使う。 */
export function humanOnlyStages(): readonly StageBridge[] {
  return STAGE_BRIDGE.filter((s) => s.advancedBy === "human");
}
