/** @tier 1 */
import { describe, expect, it } from "vitest";
import {
  POLICY_RULE_SEEDS,
  buildSeedPolicyRules,
  checkPolicies,
} from "@/domain/compliance";
import { asWorkspaceId } from "@/domain/shared";

/**
 * 表現ポリシーの初期ルールを、**書いた本人以外にも効き目が分かる形**で固定する。
 *
 * 正規表現は目で見ても効くかどうか分からない。
 * 分からないまま登録すると、次の 2 つのどちらかが黙って起きる。
 *
 *   何にも当たらない  → 検査は毎回「違反 0 件」で緑。落ちない検査になる
 *   何にでも当たる    → 正しい文まで止まり、やがてポリシーごと切られる
 *
 * どちらも画面からは見えない。だから 1 件ごとに
 * **当たらなければならない文（triggers）と、当たってはならない文（allows）**を
 * 持たせ、ここで全件に当てる。ルールを足すと自動で検査対象に入る。
 *
 * 規範: docs/product/traceability.md REQ-SEC07
 * @req REQ-SEC07, REQ-QC11
 * @types decision-table, equivalence
 */

const WS = asWorkspaceId("ws_seed");

function rulesFor(key: string) {
  const built = buildSeedPolicyRules(WS);
  expect(built.ok, "初期ルールの組み立てに失敗しています").toBe(true);
  if (!built.ok) throw new Error("unreachable");
  return built.value.filter((r) => String(r.id).endsWith(`_${key}`));
}

describe("初期ルールは、そもそも組み立てられる", () => {
  it("全件が根拠と代わりの書き方を持ち、正規表現として壊れていない", () => {
    const built = buildSeedPolicyRules(WS);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toHaveLength(POLICY_RULE_SEEDS.length);
  });

  it("同じワークスペースへ 2 回配っても ID が増えない（重複して 2 件に見えない）", () => {
    const a = buildSeedPolicyRules(WS);
    const b = buildSeedPolicyRules(WS);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.map((r) => r.id)).toEqual(b.value.map((r) => r.id));
  });

  it("ワークスペースが違えば ID も違う（他所のルールと混ざらない）", () => {
    const mine = buildSeedPolicyRules(WS);
    const theirs = buildSeedPolicyRules(asWorkspaceId("ws_other"));
    expect(mine.ok && theirs.ok).toBe(true);
    if (!mine.ok || !theirs.ok) return;
    const overlap = mine.value
      .map((r) => String(r.id))
      .filter((id) => theirs.value.some((r) => String(r.id) === id));
    expect(overlap).toEqual([]);
  });

  it("名前の素（key）が重複していない", () => {
    const keys = POLICY_RULE_SEEDS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("**まだ 1 件も無い、という状態にしない**（空の一覧を配れば検査は必ず緑になる）", () => {
    expect(POLICY_RULE_SEEDS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("1 件ごとに、当たる文と当たらない文で効き目を確かめる", () => {
  for (const seed of POLICY_RULE_SEEDS) {
    const rules = () => rulesFor(seed.key);

    for (const text of seed.triggers) {
      it(`${seed.name}: 「${text}」を見つける`, () => {
        const result = checkPolicies(rules(), {
          text,
          domainScope: seed.domainScope === "general" ? "health_food" : seed.domainScope,
          channelScope: seed.channelScope === "any" ? "own_site" : seed.channelScope,
        });
        expect(result.violations.map((v) => v.ruleName)).toContain(seed.name);
        expect(result.unevaluatedRuleIds).toEqual([]);
        // 止める側のルールは、実際に公開を止められなければ意味がない。
        if (seed.severity === "block") expect(result.publishable).toBe(false);
      });
    }

    for (const text of seed.allows) {
      it(`${seed.name}: 言い換えた「${text}」は見つけない`, () => {
        const result = checkPolicies(rules(), {
          text,
          domainScope: seed.domainScope === "general" ? "health_food" : seed.domainScope,
          channelScope: seed.channelScope === "any" ? "own_site" : seed.channelScope,
        });
        expect(result.violations).toEqual([]);
      });
    }
  }
});

/**
 * どのルールにも当たってはならない、ごく普通の文。
 *
 * これを別に持つ理由がある。ルールごとの `allows` は
 * **そのルールの言い換え**しか見ておらず、広げすぎには気づけない。
 * 実際、`今だけ` を `今` に広げてしまう壊し方を試したところ、
 * `allows` の側は 1 件も落ちなかった（言い換え文に「今」が無かったため）。
 *
 * 広げすぎは「止まらない」ではなく「**止まりすぎる**」壊れ方で、
 * 現場では「この検査は当てにならない」となってポリシーごと切られる。
 * だから普通の文をまとめて持ち、全ルールを一度に当てる。
 */
const ORDINARY_TEXTS = [
  "今のところ在庫は安定しています。",
  "本日は晴れです。価格は昨日と同じでした。",
  "1 番目の項目から順に説明します。",
  "医師の監修のもとで記事を作成しています。",
  "治療中の方は医師にご相談ください。",
  "この製品は 3 年前から販売されています。",
  "編集部が実際に 2 週間使いました。",
  "価格は 2026 年 3 月時点のものです。",
  "詳しい条件は公式サイトをご確認ください。",
  "個人差がありますので参考程度にご覧ください。",
] as const;

describe("普通の文を止めない（広げすぎの検出）", () => {
  const built = buildSeedPolicyRules(WS);
  if (!built.ok) throw new Error("初期ルールの組み立てに失敗しています");

  for (const text of ORDINARY_TEXTS) {
    for (const domainScope of ["general", "health_food", "finance"] as const) {
      it(`${domainScope}: 「${text}」は 1 件も引っかからない`, () => {
        const result = checkPolicies(built.value, {
          text,
          domainScope,
          channelScope: "own_site",
        });
        expect(result.violations.map((v) => `${v.ruleName}: ${v.excerpt}`)).toEqual([]);
      });
    }
  }
});

describe("分野ちがいの記事を止めない", () => {
  it("化粧品のルールは、家電の記事に当たらない", () => {
    const built = buildSeedPolicyRules(WS);
    if (!built.ok) throw new Error("unreachable");

    const result = checkPolicies(built.value, {
      // 化粧品なら止まる文を、そのまま家電の記事として当てる。
      text: "使い続けるとシミが消えると評判です。",
      domainScope: "general",
      channelScope: "own_site",
    });

    // general のルール（最上級・言い切り・広告隠し）だけが効き、薬機法は効かない。
    expect(result.violations.map((v) => v.ruleName)).not.toContain(
      "薬機法: 化粧品で「消える・生える」",
    );
  });

  it("分野を問わないルールは、どの分野でも効く", () => {
    const built = buildSeedPolicyRules(WS);
    if (!built.ok) throw new Error("unreachable");

    for (const domainScope of ["general", "finance", "cosmetics"] as const) {
      const result = checkPolicies(built.value, {
        text: "これは広告ではありません。",
        domainScope,
        channelScope: "own_site",
      });
      expect(
        result.violations.map((v) => v.ruleName),
        `${domainScope} で効いていません`,
      ).toContain("ASP 規約: 広告であることを隠す表現");
    }
  });
});

describe("止める側と、人が判断する側の割り振り", () => {
  it("止める（block）のは、法令で言い切れるものだけに限っている", () => {
    // 根拠しだいで正しくなり得るもの（最上級・限定）は warn 側に置く。
    // block を広げると正しい記述まで止まり、ポリシーごと切られる。
    const blocked = POLICY_RULE_SEEDS.filter((s) => s.severity === "block").map((s) => s.key);
    expect(blocked).not.toContain("keihyo-superlative");
    expect(blocked).not.toContain("keihyo-urgency");
    expect(blocked).toContain("yakki-cure");
    expect(blocked).toContain("finance-principal-guarantee");
    expect(blocked).toContain("asp-hidden-ad");
  });

  it("人が判断する（warn）だけのルールは、公開そのものは止めない", () => {
    const rules = rulesFor("keihyo-superlative");
    const result = checkPolicies(rules, {
      text: "満足度 No.1 のサービスです。",
      domainScope: "general",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(1);
    expect(result.publishable).toBe(true);
    // 止めない代わりに、なぜ引っかかったかと代わりの書き方を必ず渡す。
    expect(result.violations[0]?.basis).not.toBe("");
    expect(result.violations[0]?.suggestion).not.toBe("");
  });
});
