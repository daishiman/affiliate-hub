/** @tier 1 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_EVAL_BUDGET,
  CHECKS,
  GLOBAL_COVERAGE,
  LAYER_COVERAGE,
  MAX_STUB_GAP_POINTS,
  RELEASE_GATES,
  STUB_PATTERNS,
  TIERS,
  TIER_IDS,
  checksForTiers,
  judgeStubGap,
} from "../../quality-gates.config.mjs";
import { readTier, scanTiers } from "../../scripts/tier-scan.mjs";

/**
 * 品質ゲートの正本が 1 つであり続けることを見る。
 *
 * 閾値や検査名が 2 か所に書かれると、**手元と機械で別々の基準**が育つ。
 * そうなると「機械の上でだけ落ちる」が起き、やがて機械の結果が信用されなくなる。
 * ここで見ているのは「数字が正しいか」ではなく「数字の置き場所が 1 つか」である。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §2
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("閾値の置き場所", () => {
  it("要件どおり 80% を下限にしている", () => {
    // 下げるときは docs/product/coverage.md §4 に理由を書いてから下げる、という決まりを
    // ここで機械にする。黙って下げるとこのテストが落ちる。
    for (const [key, value] of Object.entries(GLOBAL_COVERAGE)) {
      expect(value, `${key} の下限が 80% を割っています`).toBeGreaterThanOrEqual(80);
    }
  });

  it("業務の中心（domain・application）は全体より高い下限を持つ", () => {
    // 全体だけ 80% を満たしても、薄いのが domain なら守れていない。
    const of = (layer: string) => LAYER_COVERAGE.find((l) => l.layer === layer)?.target ?? 0;
    expect(of("domain")).toBeGreaterThan(GLOBAL_COVERAGE.lines);
    expect(of("application")).toBeGreaterThan(GLOBAL_COVERAGE.lines);
  });

  it("層の一覧が src の実際の作りと一致する", () => {
    for (const layer of LAYER_COVERAGE) {
      expect(existsSync(join(ROOT, layer.dir)), `${layer.dir} がありません`).toBe(true);
    }
  });

  it("すべての層に、その下限にした理由が書かれている", () => {
    // 理由の無い数字は、次に見た人には動かしてよい数字に見える。
    for (const layer of LAYER_COVERAGE) {
      expect(layer.why.length, `${layer.layer} に理由がありません`).toBeGreaterThan(10);
    }
  });
});

describe("検査の一覧", () => {
  it("package.json に無い指示を検査に並べていない", () => {
    // 並べると `pnpm verify` が「そんなスクリプトはありません」で落ち、
    // 中身の検査に 1 つも到達しないまま赤くなる。
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    for (const check of CHECKS) {
      const [command, ...args] = check.command;
      if (command === "pnpm" && args[0] === "run") {
        expect(scripts[args[1]], `package.json に ${args[1]} がありません`).toBeDefined();
      }
      if (command === "node") {
        expect(existsSync(join(ROOT, args[0])), `${args[0]} がありません`).toBe(true);
      }
    }
  });

  it("安いものから順に並んでいる", () => {
    // 型が合っていないコードのテストを 30 秒かけて走らせても、分かるのは同じことである。
    const order = CHECKS.map((c) => c.id);
    expect(order.indexOf("typecheck")).toBeLessThan(order.indexOf("test"));
    expect(order.indexOf("lint")).toBeLessThan(order.indexOf("test"));
    expect(order.indexOf("test")).toBeLessThan(order.indexOf("coverage-report"));
  });

  it("止める検査と警告どまりの検査が、どちらも 1 つ以上ある", () => {
    // 全部が警告どまりなら検査は飾りになり、全部が止めるなら上流待ちで手が止まる。
    expect(CHECKS.filter((c) => c.blocking).length).toBeGreaterThan(0);
    expect(CHECKS.filter((c) => !c.blocking).length).toBeGreaterThan(0);
  });

  it("それぞれの検査に、入れた理由が書かれている", () => {
    for (const check of CHECKS) {
      expect(check.why.length, `${check.id} に理由がありません`).toBeGreaterThan(10);
    }
  });
});

describe("検査の段", () => {
  it("すべての検査が、実在する段に属している", () => {
    // 段の無い検査は `checksForTiers` の網から落ち、どの実行でも走らない。
    for (const check of CHECKS) {
      expect(TIER_IDS, `${check.id} の段 ${check.tier} は定義されていません`).toContain(check.tier);
    }
  });

  it("すべてのテストファイルに段の印がある", () => {
    // これが `scripts/tier-audit.mjs` と同じことを見ている理由は、
    // 検査スクリプトそのものが CI から外されたときに気づける場所を、
    // テスト側にも 1 つ残しておくため。
    const bad = scanTiers(ROOT).filter((f) => f.problem !== null);
    expect(bad.map((f) => `${f.path}（${f.problem}）`)).toEqual([]);
  });

  it("段の印が無い / 知らない番号 / 二重指定を、それぞれ見分ける", () => {
    // 一番大事な検査なので、検査自身が壊れていないことを直接確かめる。
    expect(readTier("describe('x', () => {})").problem).toBe("missing");
    expect(readTier("/** @tier 1 */").problem).toBe(null);
    expect(readTier("/** @tier 9 */").problem).toBe("unknown");
    expect(readTier("/** @tier 1 */\n/** @tier 2 */").problem).toBe("duplicate");
  });

  it("段の指定漏れの検査が、テストを走らせる前に置かれている", () => {
    // 後ろに置くと、印の無いテストが走らないまま緑になったあとで気づくことになる。
    const order = CHECKS.map((c) => c.id);
    expect(order.indexOf("tier-audit")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("tier-audit")).toBeLessThan(order.indexOf("test"));
  });

  it("既定ではマージを止める段だけが走る", () => {
    // 手元で `pnpm verify` を打った人を、夜間向けの 90 分に付き合わせない。
    const ids = checksForTiers(null).map((c) => c.id);
    const ciTiers = TIERS.filter((t) => t.runOn === "ci").map((t) => t.id);
    for (const check of CHECKS) {
      expect(ids.includes(check.id)).toBe(ciTiers.includes(check.tier));
    }
  });

  it("マージを止める段は、機械の上で走る段と一致する", () => {
    // 手元でしか走らないものにマージを止めさせると、機械は緑のまま人だけが止まる。
    for (const tier of TIERS) {
      if (tier.blocksMerge) expect(tier.runOn, `${tier.label}`).toBe("ci");
    }
  });

  it("時間の目標が段の重さの順に並んでいる", () => {
    const minutes = TIERS.map((t) => t.targetMinutes);
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
  });

  it("AI 評価セットの上限が、評価セットの実件数を超えていない", () => {
    // 上限が実件数より大きいと、上限は 1 度も効かない飾りになる。
    expect(AI_EVAL_BUDGET.maxCases).toBeLessThanOrEqual(51);
    expect(AI_EVAL_BUDGET.maxTokens).toBeGreaterThan(0);
  });

  it("それぞれの段に、その段にした理由が書かれている", () => {
    for (const tier of TIERS) {
      expect(tier.why.length, `${tier.label} に理由がありません`).toBeGreaterThan(10);
    }
  });
});

describe("正本がひとつであること", () => {
  it("vitest の設定が閾値を直接書かず、正本から読んでいる", () => {
    const config = read("vitest.config.mts");
    expect(config).toContain("quality-gates.config.mjs");
    // 段を絞ったときだけ判定を外すので、行の形は固定しない。
    // 見張るのは「閾値が正本から来ていること」と「数字を直接書いていないこと」の 2 つ。
    expect(config).toMatch(/thresholds:.*GLOBAL_COVERAGE/);
    // 「80」を直接書いていないこと。書くと、正本を直しても効かない場所が生まれる。
    expect(config).not.toMatch(/thresholds:\s*\{/);
    expect(config).not.toMatch(/thresholds:.*\b(80|85|90)\b/);
  });

  it("自動化の設定ファイルに閾値や検査名を書き写していない", () => {
    // ここが崩れると、機械だけが古い基準で判定し続ける。
    // 落ちたときは .github 側を消して、正本から読むように直すこと。
    const dir = join(ROOT, ".github/workflows");
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const body = read(`.github/workflows/${name}`);
      expect(body, `${name} にカバレッジの閾値が直接書かれています`).not.toMatch(
        /coverage[^\n]*\b(80|85|90)\b/i,
      );
    }
  });
});

describe("スタブの扱い", () => {
  it("スタブを測る対象から外していない", () => {
    // 外すと、外す線引きを動かすだけで数字を作れてしまう。
    // STUB_PATTERNS は「併記のための目印」であって除外リストではない。
    const config = read("vitest.config.mts");
    for (const pattern of STUB_PATTERNS) {
      expect(config, `${pattern} を測定対象から除外しています`).not.toContain(pattern);
    }
  });

  it("スタブと実質の差に上限がある", () => {
    expect(MAX_STUB_GAP_POINTS).toBeGreaterThan(0);
    expect(MAX_STUB_GAP_POINTS).toBeLessThanOrEqual(5);
  });

  it("スタブが実質を大きく上回ったときだけ落とす（数字合わせの向き）", () => {
    // これが検出したい事故そのもの。スタブを厚くして全体の数字を作った状態。
    const bad = judgeStubGap(50, 50 + MAX_STUB_GAP_POINTS + 0.1);
    expect(bad.exceeded).toBe(true);
    expect(bad.note).toContain("スタブに寄っています");
  });

  it("実質のほうが厚いときは、どれだけ差があっても落とさない", () => {
    // 絶対値で見ると「良くなったのに赤くなる」。
    // 良くなって落ちる検査は、そのうち誰も読まなくなる。理由は coverage.md §3。
    for (const stub of [49.9, 40, 10, 0]) {
      const judged = judgeStubGap(50, stub);
      expect(judged.exceeded, `実質50 / スタブ${stub} で落ちています`).toBe(false);
    }
    expect(judgeStubGap(91.9, 81.9).note).toContain("望ましい向き");
  });

  it("上限ちょうどでは落とさない（境界）", () => {
    expect(judgeStubGap(50, 50 + MAX_STUB_GAP_POINTS).exceeded).toBe(false);
    expect(judgeStubGap(50, 50).gap).toBe(0);
  });
});

describe("公開の条件", () => {
  it("止める理由は 2 つだけにしてある", () => {
    // ゲートを増やすほど、ゲートを無視する運用に近づく。
    // 他の指摘は残課題リスト（docs/product/backlog.md）へ回す。
    expect(RELEASE_GATES).toHaveLength(2);
    expect(RELEASE_GATES.map((g) => g.id)).toEqual(["verify", "critical-zero"]);
  });
});
