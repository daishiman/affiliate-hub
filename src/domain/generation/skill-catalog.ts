import type { ContentState } from "../authoring/content-state";
import type { PromptFileKind } from "./prompt-blocks";

/**
 * 生成の手順を単位に切ったもの（生成基盤設計 §2）。
 *
 * 1 つの手順は 1 つのことだけをして、1 つの形で返す。
 * まとめて 1 つにすると、失敗したときにどこで失敗したのかが分からない。
 *
 * 依存の向きも決めてある。構成が承認されるまで本文を書き始めない。
 * 順番を守らないと、承認前の構成に沿った本文が積み上がる。
 */

export type GenerationSkill = {
  readonly id: string;
  readonly label: string;
  readonly responsibility: string;
  readonly input: string;
  readonly output: string;
  /** どうなったら動かすか。 */
  readonly startsWhen: string;
  /** 先に終わっていなければならない手順。 */
  readonly dependsOn: readonly string[];
  /** 使う指示文の種類。 */
  readonly promptKind: PromptFileKind;
  /** この手順を担う役（`agent-roster.ts` の id）。 */
  readonly agentId: string;
  /** 動かすとコンテンツがどの状態に近づくか。 */
  readonly relatedState: ContentState;
};

export const GENERATION_SKILLS: readonly GenerationSkill[] = [
  {
    id: "generate-article-outline",
    label: "記事の骨組みを作る",
    responsibility: "節の並びと、各節に割り当てる主張・根拠を決める。",
    input: "生成の入力一式（本文は不要）",
    output: "節ごとの見出し案と、割り当てた主張・根拠の番号",
    startsWhen: "コンテンツパッケージを作った直後",
    dependsOn: [],
    promptKind: "article-outline",
    agentId: "content-writer",
    relatedState: "BRIEF_READY",
  },
  {
    id: "write-article-body",
    label: "本文を書く",
    responsibility: "承認された骨組みに沿って本文を書く。",
    input: "生成の入力一式 + 承認済みの骨組み",
    output: "本文と、使った主張・根拠の番号",
    startsWhen: "骨組みを担当者が承認したとき",
    dependsOn: ["generate-article-outline"],
    promptKind: "article-body",
    agentId: "content-writer",
    relatedState: "GENERATED",
  },
  {
    id: "generate-comparison-table",
    label: "比べる表を作る",
    responsibility: "比べる列と行を、実測と仕様から組み立てる。",
    input: "編集判断に使える商品情報 + 実測の記録",
    output: "列の定義と行の値（文章ではなく構造化した形）",
    startsWhen: "比べる対象が 2 件以上あるとき",
    dependsOn: ["write-article-body"],
    promptKind: "comparison-table",
    agentId: "content-writer",
    relatedState: "GENERATED",
  },
  {
    id: "generate-conversation-block",
    label: "会話のやり取りを作る",
    responsibility: "本文の節に添える会話を作る。",
    input: "本文の節 + 話者の決め",
    output: "話者・本文・対応する位置の一覧",
    startsWhen: "サイトブループリントで会話を使うと決めているとき",
    dependsOn: ["write-article-body"],
    promptKind: "conversation-block",
    agentId: "content-writer",
    relatedState: "GENERATED",
  },
  {
    id: "insert-affiliate-disclosure",
    label: "広告表示を入れる",
    responsibility: "広告表示を本文へ入れ、成果リンクに要る属性を付ける。",
    input: "本文 + 広告表示の文言 + 方針",
    output: "広告表示を入れた本文と、リンクへの属性の付与結果",
    startsWhen: "成果リンクが 1 件以上あるとき",
    dependsOn: ["write-article-body"],
    promptKind: "disclosure-insertion",
    agentId: "content-writer",
    relatedState: "GENERATED",
  },
  {
    id: "inspect-content-quality",
    label: "品質を検査する",
    responsibility: "公開を止める検査を含む 17 件の判定を、根拠つきで出す。",
    input: "コンテンツ版 + 記事の型",
    output: "検査ごとの判定と、その判定の根拠",
    startsWhen: "生成の直後と、公開の前",
    dependsOn: ["insert-affiliate-disclosure"],
    promptKind: "quality-inspection",
    agentId: "fact-checker",
    relatedState: "FACT_CHECK",
  },
  {
    id: "generate-content-meta",
    label: "見出し情報を作る",
    responsibility: "題・説明・共有時の見え方・構造化した情報を作る。",
    input: "承認済みの本文",
    output: "題・説明・共有時の情報・構造化した情報",
    startsWhen: "公開の準備に入るとき",
    dependsOn: ["inspect-content-quality"],
    promptKind: "meta-generation",
    agentId: "content-writer",
    relatedState: "APPROVED",
  },
  {
    id: "convert-to-channel-variant",
    label: "出し先ごとに作り直す",
    responsibility: "承認済みの記事を、出し先の決まりと文字数へ合わせる。",
    input: "承認済みの記事 + 出し先 + 長さ",
    output: "出し先ごとのコンテンツ版",
    startsWhen: "記事が承認されたとき",
    dependsOn: ["generate-content-meta"],
    promptKind: "channel-variant",
    agentId: "channel-adapter",
    relatedState: "SCHEDULED",
  },
];

export function skillById(id: string): GenerationSkill | null {
  return GENERATION_SKILLS.find((s) => s.id === id) ?? null;
}

/**
 * 依存の並びが壊れていないことを確かめる。
 * 存在しない手順に依存していないか、輪になっていないかを見る。
 */
export function skillOrderBreaches(
  skills: readonly GenerationSkill[] = GENERATION_SKILLS,
): readonly string[] {
  const breaches: string[] = [];
  const index = new Map(skills.map((s, i) => [s.id, i]));
  for (const skill of skills) {
    for (const dep of skill.dependsOn) {
      const at = index.get(dep);
      if (at === undefined) {
        breaches.push(`${skill.label} が、存在しない手順「${dep}」に依存しています。`);
        continue;
      }
      if (at >= (index.get(skill.id) ?? 0)) {
        breaches.push(`${skill.label} が、後ろの手順「${dep}」に依存しています。`);
      }
    }
  }
  return breaches;
}

/**
 * 自分の書いたものを自分で検査していないことを確かめる（GC-5）。
 * 検査の手順は、書く手順と別の役が担う。
 */
export function selfInspectionBreaches(
  skills: readonly GenerationSkill[] = GENERATION_SKILLS,
): readonly string[] {
  const writerIds = new Set(
    skills.filter((s) => s.promptKind !== "quality-inspection").map((s) => s.agentId),
  );
  return skills
    .filter((s) => s.promptKind === "quality-inspection" && writerIds.has(s.agentId))
    .map((s) => `${s.label} を、書いた役と同じ役が担っています。`);
}
