/**
 * @tier 2
 * @req REQ-G09, REQ-G10
 * @types equivalence, boundary, state-transition
 *
 * G09 評価セット   「評価セットの構成」と「網羅に穴が無いこと」
 *                   （記事タイプ・切り口・出し先・知識量を全部使っているか＝
 *                    同値分割の網羅そのもの。件数は下限 50 と 9=3×3 の境界）
 * G10 ローンチ基準 「ローンチ基準」（未実行なら本番へ上げられない／全部そろえば
 *                    上げられる／止める基準が 1 つ欠けても上げられない）。
 *                    片方向だけだと、常に false を返す関数でも通ってしまう。
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLE_TYPE_SECTIONS } from "@/domain/authoring/article-structure";
import { CONTENT_ANGLES } from "@/domain/authoring/content-package";
import { CHANNEL_CAPABILITIES } from "@/domain/distribution/channel";
import { EVAL_CASES, casesByAxis, casesByCategory } from "../../evals/generation/cases";
import { LAUNCH_BARS, canActivatePromptVersion } from "../../evals/generation/launch-bars";
import { SPEC_QUALITY_CHECKS, SPEC_QUALITY_CHECK_IDS } from "../../evals/generation/quality-gates";
import { expectLedgerFile } from "../support/ledger-file";

/**
 * 評価セットの検査。
 *
 * ここで見るのは「生成が良いか」ではなく、**物差しが欠けていないか**。
 * 網羅のつもりで作った一覧から 1 軸だけ抜けていても、目視では気づけない。
 *
 * 更新するとき: `UPDATE_EVAL_LEDGER=1 pnpm test`
 */
const ROOT = resolve(import.meta.dirname, "../..");
const LEDGER_PATH = join(ROOT, "docs/product/eval-ledger.md");

const ARTICLE_TYPES = Object.keys(ARTICLE_TYPE_SECTIONS);
const CHANNEL_KINDS = Object.keys(CHANNEL_CAPABILITIES);

function renderLedger(): string {
  const axes = [...new Set(EVAL_CASES.map((c) => c.axis))];
  const implemented = SPEC_QUALITY_CHECKS.filter((c) => c.implementedBy !== null);

  return [
    "# 生成の評価セット（台帳）",
    "",
    "このファイルは `tests/evals/generation-eval-set.test.ts` が作る。手で書き換えない。",
    "更新は `UPDATE_EVAL_LEDGER=1 pnpm test` を実行して、出た差分をそのまま保存する。",
    "末尾の指紋がその見張りで、手で 1 文字でも書くと、内容が合っていてもテストが赤くなる。",
    "",
    "生成を直したときに「前より良くなった」と言うための物差し。",
    "**まだ生成の提供元をつないでいないため、合否は 1 件も出ていない。**",
    "実行していない基準は `NOT RUN` と書く。緑にしたい気持ちで PASS と書かない。",
    "",
    `## 件数: ${EVAL_CASES.length} 件（仕様の下限は 50 件）`,
    "",
    "| 区分 | 軸 | 件数 |",
    "|---|---|---|",
    ...axes.map((axis) => {
      const cases = casesByAxis(axis);
      return `| ${cases[0].category} | ${axis} | ${cases.length} |`;
    }),
    "",
    "## 網羅できているもの",
    "",
    `- 記事タイプ: ${ARTICLE_TYPES.length} 種すべて`,
    `- 切り口: ${CONTENT_ANGLES.length} 種すべて`,
    `- 出し先: ${CHANNEL_KINDS.length} 種すべて`,
    "- 読者の知識量 3 段階すべて / 気づきの段階 4 種すべて",
    "",
    "## 公開を止める検査（QC）の実装状況",
    "",
    `仕様の ${SPEC_QUALITY_CHECKS.length} 件のうち、いま機械で判定できるもの: ${implemented.length} 件`,
    "",
    "| ID | 検査 | 重さ | 判定している場所 / 何が済めば判定できるか |",
    "|---|---|---|---|",
    ...SPEC_QUALITY_CHECKS.map((c) => {
      const where =
        c.implementedBy === null
          ? `まだ判定できない（${c.blockedBy}）`
          : c.implementedBy.kind === "quality_check"
            ? `品質検査 \`${c.implementedBy.id}\``
            : `公開ゲート \`${c.implementedBy.requirement}\``;
      return `| ${c.id} | ${c.label} | ${c.severity} | ${where} |`;
    }),
    "",
    "## ローンチ基準の実行状況",
    "",
    "| ID | 基準 | 閾値 | 状態 | 何が済めば実行できるか |",
    "|---|---|---|---|---|",
    ...LAUNCH_BARS.map(
      (b) =>
        `| ${b.id} | ${b.criterion} | ${b.threshold} | ${b.status} | ${b.blockedBy ?? "—"} |`,
    ),
    "",
    `本番で使ってよいか: ${canActivatePromptVersion() ? "よい" : "まだ使えない（未実行の基準がある）"}`,
    "",
    "## 人手で書いた参照回答",
    "",
    `${EVAL_CASES.filter((c) => c.humanReference !== null).length} / ${EVAL_CASES.length} 件`,
    "",
    "参照回答が 0 件のあいだ、LB-8（人の見本との一致率）は実行できない。",
    "",
  ].join("\n");
}

describe("評価セットの構成", () => {
  it("仕様の下限 50 件を満たす", () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(50);
  });

  it("番号が重複していない", () => {
    const ids = EVAL_CASES.map((c) => c.caseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("区分ごとの件数が仕様どおり", () => {
    expect(casesByCategory("coverage").length).toBeGreaterThanOrEqual(34);
    expect(casesByCategory("adversarial").length).toBe(8);
    expect(casesByCategory("boundary").length).toBe(8);
  });

  it("網羅の軸ごとの件数が仕様どおり", () => {
    expect(casesByAxis("記事タイプ").length).toBeGreaterThanOrEqual(12);
    expect(casesByAxis("読者ペルソナ").length).toBe(9);
    expect(casesByAxis("切り口").length).toBe(8);
    expect(casesByAxis("媒体").length).toBe(5);
  });
});

describe("網羅に穴が無いこと", () => {
  it("記事タイプを全部使っている", () => {
    const used = new Set(EVAL_CASES.map((c) => c.input.articleType));
    for (const type of ARTICLE_TYPES) {
      expect(used.has(type as never), `記事タイプ ${type} の評価がありません`).toBe(true);
    }
  });

  it("切り口を全部使っている", () => {
    const used = new Set(EVAL_CASES.flatMap((c) => c.input.angles));
    for (const angle of CONTENT_ANGLES) {
      expect(used.has(angle), `切り口 ${angle} の評価がありません`).toBe(true);
    }
  });

  it("出し先を全部使っている", () => {
    const used = new Set(EVAL_CASES.map((c) => c.input.channel));
    for (const channel of CHANNEL_KINDS) {
      expect(used.has(channel as never), `出し先 ${channel} の評価がありません`).toBe(true);
    }
  });

  it("読者の知識量と気づきの段階を全部使っている", () => {
    const levels = new Set(EVAL_CASES.map((c) => c.input.knowledgeLevel));
    expect([...levels].sort()).toEqual(["beginner", "expert", "intermediate"]);

    const stages = new Set(EVAL_CASES.map((c) => c.input.awarenessStage));
    expect([...stages].sort()).toEqual([
      "problem_aware",
      "product_aware",
      "solution_aware",
      "unaware",
    ]);
  });

  it("読者ペルソナの 9 件は知識量ごとに 3 件ずつ", () => {
    const persona = casesByAxis("読者ペルソナ");
    for (const level of ["beginner", "intermediate", "expert"] as const) {
      expect(persona.filter((c) => c.input.knowledgeLevel === level).length).toBe(3);
    }
  });
});

describe("期待値の書き方", () => {
  it("どのケースにも「必ず現れるべきもの」がある", () => {
    for (const c of EVAL_CASES) {
      expect(c.expected.mustInclude.length, `${c.caseId} に期待値がありません`).toBeGreaterThan(0);
    }
  });

  it("敵対的ケースには「現れてはならないもの」が必ずある", () => {
    // ここが空だと、誘導に従ってもケースが通る。それは評価ではない。
    for (const c of casesByCategory("adversarial")) {
      expect(c.expected.mustNotInclude.length, `${c.caseId} に禁止語がありません`).toBeGreaterThan(
        0,
      );
    }
  });

  it("期待する検査は仕様の QC 番号だけを使う", () => {
    for (const c of EVAL_CASES) {
      for (const id of Object.keys(c.expected.qualityGates)) {
        expect(SPEC_QUALITY_CHECK_IDS, `${c.caseId} が知らない検査 ${id} を指しています`).toContain(
          id,
        );
      }
    }
  });

  it("報酬額の混入ケースは、順位に報酬を出さないことを求めている", () => {
    // 順位に報酬が混ざることは、この製品で最も避けたい壊れ方。
    const c = EVAL_CASES.find((x) => x.axis === "報酬額の混入");
    expect(c).toBeDefined();
    expect(c?.expected.mustNotInclude).toContain("成果報酬");
  });
});

describe("公開を止める検査の実装状況", () => {
  it("仕様の 17 件がすべて載っている", () => {
    expect(SPEC_QUALITY_CHECKS.length).toBe(17);
    expect(SPEC_QUALITY_CHECK_IDS).toEqual(
      Array.from({ length: 17 }, (_, i) => `QC-${String(i + 1).padStart(2, "0")}`),
    );
  });

  it("まだ判定できないものには、何を待っているかが書いてある", () => {
    for (const c of SPEC_QUALITY_CHECKS) {
      if (c.implementedBy !== null) continue;
      expect((c.blockedBy ?? "").trim(), `${c.id} の待ち条件が空です`).not.toBe("");
    }
  });
});

describe("ローンチ基準", () => {
  it("実行していない基準を PASS と書いていない", () => {
    for (const bar of LAUNCH_BARS) {
      if (bar.status !== "NOT RUN") continue;
      expect((bar.blockedBy ?? "").trim(), `${bar.id} の待ち条件が空です`).not.toBe("");
    }
  });

  it("未実行のあいだは、そのプロンプト版を本番で使えない", () => {
    expect(canActivatePromptVersion()).toBe(false);
  });

  it("全部そろえば上げられる（止まりっぱなしではない）", () => {
    // 上の検査は「いまは上げられない」しか言っていない。
    // それだけだと `false` を返すだけの関数でも通ってしまい、
    // **基準を満たしたときに開く**ことは誰も確かめていないことになる。
    const allPass = LAUNCH_BARS.map((b) => ({ ...b, status: "PASS" as const }));
    expect(canActivatePromptVersion(allPass)).toBe(true);
  });

  it("止めるべき基準が 1 つでも未実行なら上げられない", () => {
    for (const bar of LAUNCH_BARS.filter((b) => b.blocksActivation)) {
      const oneLeft = LAUNCH_BARS.map((b) => ({
        ...b,
        status: b.id === bar.id ? ("NOT RUN" as const) : ("PASS" as const),
      }));
      expect(canActivatePromptVersion(oneLeft), `${bar.id} が未実行でも上げられます`).toBe(false);
    }
  });

  it("LB-8 だけは未実行でも上げられる（暫定運用の 1 つ）", () => {
    const exceptLb8 = LAUNCH_BARS.map((b) => ({
      ...b,
      status: b.id === "LB-8" ? ("NOT RUN" as const) : ("PASS" as const),
    }));
    expect(canActivatePromptVersion(exceptLb8)).toBe(true);
  });

  it("LB-3 の閾値が実際の件数と一致している", () => {
    const lb3 = LAUNCH_BARS.find((b) => b.id === "LB-3");
    expect(lb3?.threshold).toBe(`${EVAL_CASES.length}/${EVAL_CASES.length}`);
  });

  it("暫定運用を許すのは LB-8 だけ", () => {
    const lenient = LAUNCH_BARS.filter((b) => !b.blocksActivation).map((b) => b.id);
    expect(lenient).toEqual(["LB-8"]);
  });
});

describe("台帳", () => {
  it("台帳ファイルが実際の状態と一致していて、手で書かれていない", () => {
    expectLedgerFile(
      LEDGER_PATH,
      renderLedger(),
      process.env.UPDATE_EVAL_LEDGER === "1",
      "評価セットの台帳が古くなっています。`UPDATE_EVAL_LEDGER=1 pnpm test` で作り直してください。",
    );
  });
});
