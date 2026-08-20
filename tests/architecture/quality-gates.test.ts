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
  REQUIRED_TEST_TYPES,
  STUB_PATTERNS,
  TEST_TYPES,
  TEST_TYPES_MAX_STRAY,
  TEST_TYPES_MAX_UNPOINTED,
  TEST_TYPES_MIN_VOCABULARY,
  TIERS,
  TIER_IDS,
  COVERAGE_AXES,
  checksForTiers,
  judgeLayerCoverage,
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

/**
 * 2026-08-21 に見つけた穴を、文章ではなく検査にする。
 *
 * それまで `scripts/coverage-report.mjs` は行の 1 列だけを見ながら 4 列を表示し、
 * 隣に「下限」の列を置いて「すべての層が下限を満たしています」と出していた。
 * `app` の分岐 62.5 は、印刷された 70 を下回ったまま緑を通っていた。
 *
 * ここで固定するのは数字ではなく**形**である——
 * 「表示している列すべてに門があること」と「その門が実際に噛むこと」。
 */
describe("層別カバレッジの床", () => {
  it("すべての層が、表示する 4 軸すべてに床を宣言している", () => {
    // 1 軸でも欠けると `judgeLayerCoverage` の比較が `undefined` 相手になり、
    // **その軸は常に達成**になる。表には出続けるので、誰も欠けたと気づかない。
    for (const layer of LAYER_COVERAGE) {
      for (const axis of COVERAGE_AXES) {
        expect(
          typeof layer.floors?.[axis],
          `${layer.layer} に ${axis} の床がありません（門の無い列が表に並びます）`,
        ).toBe("number");
      }
    }
  });

  it("軸の一覧が 4 本を割らない（上の検査を、軸を消して満たせないようにする）", () => {
    // 上の検査は「宣言された軸すべて」を回るので、**軸そのものを消せば必ず通る**。
    // 数えている対象を消して数字を満たす形なので、逆向きの下限で受け止める。
    // 増やす方向は妨げない。減らす方向だけを止める。
    expect(
      COVERAGE_AXES.length,
      "COVERAGE_AXES が 4 本を割っています。軸を消して床の検査を満たす形は禁止です",
    ).toBeGreaterThanOrEqual(4);
    expect(new Set(COVERAGE_AXES).size).toBe(COVERAGE_AXES.length);
  });

  it("行の床は、宣言した target と同じ値である", () => {
    // 別の数を置くと、`target` と `floors.lines` のどちらが本物か分からなくなり、
    // 片方だけ下げても「もう片方は下げていない」と言えてしまう。
    for (const layer of LAYER_COVERAGE) {
      expect(layer.floors.lines, `${layer.layer} の floors.lines が target と違います`).toBe(
        layer.target,
      );
    }
  });

  it("床を下回った軸を実際に見つける（合成例による陽性対照）", () => {
    // **0 件を返す検査は、0 の作り方を 2 通り持たないと 0 を主張できない。**
    // 対象が健全でも、判定側が壊れていても、同じ「不足なし」が出る。
    // そこで、床をちょうど 1pt 割る合成値を軸ごとに 1 つずつ通して、噛むことを見る。
    const layer = LAYER_COVERAGE.find((l) => l.layer === "app");
    if (!layer) throw new Error("app 層が LAYER_COVERAGE にありません");

    // 名前を ASCII にしているのは好みではない。`const 満たす` と書くと整形の過程で
    // 空白が落ち、`const満たす` という 1 個の識別子になって ReferenceError になった。
    const atFloor = Object.fromEntries(COVERAGE_AXES.map((a) => [a, layer.floors[a]]));
    expect(judgeLayerCoverage(atFloor, layer), "床ちょうどは達成のはず").toEqual([]);

    for (const axis of COVERAGE_AXES) {
      const below = { ...atFloor, [axis]: layer.floors[axis] - 1 };
      const found = judgeLayerCoverage(below, layer);
      expect(found.length, `${axis} を 1pt 割ったのに検出されません`).toBe(1);
      expect(found[0]).toContain(String(layer.floors[axis]));
    }

    // 実際に起きていた形そのもの: 分岐 62.5 が、隣に印刷された 70 の下で緑を通っていた。
    // 床が 70 だったなら赤くなるはずだったことを、ここで固定する。
    expect(
      judgeLayerCoverage(
        { ...atFloor, branches: 62.5 },
        { layer: "app", floors: { ...layer.floors, branches: 70 } },
      ),
    ).toHaveLength(1);
  });

  it("既知の不足: app の分岐の床は、宣言した target に届いていない", () => {
    // **塞げていないことを、文章ではなく検査にする。**
    // 2026-08-21 の穴を塞ぐとき、直し方を 2 つ比べて (B)「4 列に床を張り、
    // 行以外は実測で凍結」を採った。(A)「4 列とも target で見る」を採らなかったのは、
    // それが**穴を塞ぐ作業ではなく、塞いだあとに現れる別の課題**だからである。
    // その課題がここに残っている: app の分岐は実測 62.5 で、宣言した 70 に 7.5pt 足りない。
    //
    // 本文に「まだ届いていません」と書くだけでは、届いた日にも古く見えないまま残る。
    // ここに置けば、**届いて床を 70 へ上げた日にこの検査が赤くなって知らせる。**
    //
    // 反転先（赤くなった日に、消さずにこう書き換える）:
    //   `expect(app.floors.branches).toBe(app.target)` へ反転させ、
    //   さらに全層について `floors[axis] >= target` を要求する形へ広げる。
    //   消すと、届いた状態が後で戻っても誰も気づかない状態へ帰る。
    const app = LAYER_COVERAGE.find((l) => l.layer === "app");
    if (!app) throw new Error("app 層が LAYER_COVERAGE にありません");
    expect(
      app.floors.branches,
      "app の分岐が target に届きました。この検査を消さず、反転先（上の注釈）へ書き換えてください",
    ).toBeLessThan(app.target);
  });

  it("判定式が scripts/coverage-report.mjs の中に埋め戻されていない", () => {
    // 式がスクリプトの中にあると、外から合成例を通せない。
    // 実際、この穴が 1 度も検出されなかった理由がそれである。
    const script = read("scripts/coverage-report.mjs");
    expect(script, "judgeLayerCoverage を呼ばずに判定しています").toContain("judgeLayerCoverage(");

    // **注釈を数えない。**最初に書いたときこれを忘れ、「昔はこう書いていた」と
    // 説明している注釈そのものを式として拾って赤くなった。
    // 昔の形を説明できなくなる検査は、やがて説明のほうが消される。
    const code = script
      .split("\n")
      .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
      .join("\n");
    expect(
      /r(?:\.\w+|\[[^\]]+\])\s*>=\s*layer\.target/.test(code),
      "1 列だけを見る比較（r.lines >= layer.target の形）が戻っています",
    ).toBe(false);

    // 注釈を外したことで検査が何も見なくなっていないか、合成例で確かめる。
    expect(/r(?:\.\w+|\[[^\]]+\])\s*>=\s*layer\.target/.test("  const ok = r.lines >= layer.target;")).toBe(
      true,
    );
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

/**
 * 種別の語彙そのものを見る 3 つ。
 *
 * 見ているのは「要件が宣言できているか」ではなく、**語彙の側**である。
 * `TEST_TYPES` に載っているのにどの性質からも指されていない語は一度も要求されず、
 * **名前があるだけで門としては存在していない**（残課題 78 ⑯）。
 *
 * **向きが逆の 2 つを対にしてある。**指されていない数の上限だけを張ると、
 * その語を一覧から**消せば下がる**。消える候補は `visual` `e2e` `perf` `load`
 * `injection` `csrf` `rate-limit` で、どれも仕様が要求しているのにまだ書けていない
 * 検査の名前である。だから語数に下限を張り、消す道を塞ぐ。
 * 2 つが揃うと、上限を下げる道が「実際に指す」だけになる。
 */
describe("種別の語彙", () => {
  /** 一覧に載っている語と、要求している側の突き合わせ。読まずに数える。 */
  const pointed = new Set(Object.values(REQUIRED_TEST_TYPES).flat());
  const vocabulary = Object.keys(TEST_TYPES);
  const unpointed = vocabulary.filter((type) => !pointed.has(type));
  const stray = [...pointed].filter((type) => !vocabulary.includes(type));

  it("指されていない種別は上限以内（下げる方向にしか動かさない）", () => {
    expect(
      unpointed.length,
      `どの性質からも指されていない種別: ${unpointed.join(", ")}`,
    ).toBeLessThanOrEqual(TEST_TYPES_MAX_UNPOINTED);
  });

  it("語彙を減らして上限を満たす道は塞いである（上げる方向にしか動かさない）", () => {
    // これが無いと、書けていない検査の名前を消すだけで上の検査が緑になる。
    // 名前が無い穴は、穴として数えられない。
    expect(vocabulary.length).toBeGreaterThanOrEqual(TEST_TYPES_MIN_VOCABULARY);
  });

  it("一覧に無い語を要求していない", () => {
    // 要求はされるが名乗りようが無い状態になる。除外理由が並ぶだけで門は何も見ない。
    expect(stray.length, `一覧に無いのに指されている: ${stray.join(", ")}`).toBe(
      TEST_TYPES_MAX_STRAY,
    );
  });

  it("2 つの数字は逆向きに張ってある（揃えると抜け道が開く）", () => {
    // 片方だけを見た人が「向きを揃えよう」と言い出したときのための検査。
    // 上限は実測ちょうど、下限も実測ちょうど。余裕は「動かしてよい幅」として使われる。
    expect(TEST_TYPES_MAX_UNPOINTED).toBe(unpointed.length);
    expect(TEST_TYPES_MIN_VOCABULARY).toBe(vocabulary.length);
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
