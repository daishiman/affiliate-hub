/**
 * 品質ゲートの唯一の正本。
 *
 * 閾値と検査項目をここ 1 箇所に集める。読み手は 6 つだけ:
 *   - `vitest.config.mts`              カバレッジ閾値と、段で絞った対象をそのまま渡す
 *   - `scripts/verify.mjs`             検査の並びと順番をそのまま実行する
 *   - `scripts/run-tests.mjs`          段で絞ってテストを走らせる
 *   - `scripts/tier-audit.mjs`         段の印が無いテストを見つける
 *   - `scripts/coverage-report.mjs`    層別の判定と記録の生成に使う
 *   - `tests/architecture/quality-gates.test.ts`  ここと CI が食い違っていないか見る
 *
 * **`.github/workflows/` に閾値や検査名を書かない。** 書いた瞬間に、
 * 手元と機械で別々の基準が育ち、「機械の上でだけ落ちる」状態が生まれる。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md
 * 実測: docs/product/coverage.md
 */

/**
 * 全体の下限。要件は 80%。
 *
 * **下げて緑にすることを禁じる。** どうしても下げる場合は、
 * 下げた値・日付・理由を `docs/product/coverage.md` §4 に書いてから下げる。
 * 記録の無い引き下げは、次に見た人には「元からこの水準だった」としか見えない。
 */
export const GLOBAL_COVERAGE = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
};

/**
 * 層ごとの下限。
 *
 * 全体 1 個の数字は、どこが薄いかを隠す。
 * domain と application を高く置くのは、**壊れたときの被害が最も大きい**ため。
 * ここが薄いまま全体だけ 80% を超えても、守れているのは薄い場所だけになる。
 *
 * `target` に届くまでの経過は `current` に実測を書く（手で書かない。
 * `scripts/coverage-report.mjs` が更新する）。
 */
export const LAYER_COVERAGE = [
  {
    layer: "domain",
    dir: "src/domain",
    target: 90,
    why: "業務の決まりごと。壊れると仕様違反がそのまま本番に出る",
  },
  {
    layer: "application",
    dir: "src/application",
    target: 85,
    why: "手順。外側はポートで差し替えられるので、厚く書けない言い訳が無い",
  },
  {
    layer: "presentation",
    dir: "src/presentation",
    target: 75,
    why: "入口の配線。ここが外れると、正しいドメインが呼ばれないまま画面が動く",
  },
  {
    layer: "app",
    dir: "src/app",
    target: 70,
    why: "画面そのもの。4 つの状態と孤立ページを見る。見た目の網羅は追わない",
  },
  {
    layer: "infrastructure",
    dir: "src/infrastructure",
    target: 70,
    why: "道具。スタブが多く、実接続後に再評価する",
  },
];

/**
 * スタブと見なす場所。
 *
 * **カバレッジ計算から除外しない。** 除外すると、除外の線引きを動かすだけで
 * 数字を作れてしまう。ここは「全体」と「スタブを除いた実質」を**併記**するための
 * 目印であって、除外リストではない。
 *
 * 判断: docs/spec/10-テスト戦略仕様.md §2-1
 */
export const STUB_PATTERNS = [
  "src/infrastructure/persistence/sample/",
  "-sample-repository.ts",
  "-sample-sink.ts",
  "sample.ts",
];

/**
 * 実質カバレッジと全体カバレッジの差の上限（ポイント）。
 *
 * スタブは「呼ばれたら必ず失敗を返す」だけの短い関数なので、
 * テストが通りやすく分母も小さい。放っておくと、ここを厚くするだけで
 * 全体の数字が上がっていく。**その差の広がりが数字合わせの兆候**である。
 *
 * 起点は +11.55pt（実質 51.92% / スタブ 63.47%）で、
 * 画面の総当たり描画を入れた時点で +0.7pt まで縮んだ。
 * 差が広がる方向へ動いたら、テストを足す場所を間違えている。
 */
export const MAX_STUB_GAP_POINTS = 3;

/**
 * スタブと実質の差の判定。**片側だけを見る。**
 *
 * 見張りたいのは「スタブを厚くして全体の数字を作る」という 1 方向だけである。
 * 逆向き（実質がスタブを上回る）は本物のコードの方が厚く検査されている状態で、
 * これは求めている姿そのものなので、止める理由が無い。
 *
 * 絶対値で見ると、望ましい方向へ大きく進んだときにも警告が出る。
 * 「良くなったのに赤くなる」検査は、そのうち誰も読まなくなる。
 *
 * @param {number} realLines 実質（スタブを除いた）行カバレッジ
 * @param {number} stubLines スタブのみの行カバレッジ
 * @returns {{ gap: number, exceeded: boolean, note: string }}
 */
export function judgeStubGap(realLines, stubLines) {
  const gap = Math.round((stubLines - realLines) * 100) / 100;
  const exceeded = gap > MAX_STUB_GAP_POINTS;
  const note = exceeded
    ? `スタブが実質より ${gap}pt 高い（上限 ${MAX_STUB_GAP_POINTS}pt）。テストを足す場所が本物のコードではなくスタブに寄っています`
    : gap > 0
      ? `上限 ${MAX_STUB_GAP_POINTS}pt 以内`
      : "スタブは実質を上回っていない（望ましい向き）";
  return { gap, exceeded, note };
}

/**
 * 検査の段（1 / 2 / 3）。
 *
 * **重いテストを足せる置き場所を、重いテストより先に作る。**
 * 順序を逆にすると、CI が回らなくなってから「重いテストを消す」判断に流れる。
 * ここでやることは 1 つだけ、**実行する場所を変える**ことである。
 * テストを消す・skip する・閾値を下げるのは、いずれもこの設計の目的に反する。
 *
 * 費用の前提（2026-08-17 実測）:
 *   - このリポジトリは **public**。GitHub Actions の標準ランナーは無料・無制限で、
 *     直近の実行は 40〜70 秒。**実行時間は費用の要因ではない**。
 *   - 課金されるのは **AI の評価セット**（`AI_EVAL_BUDGET`）だけである。
 * したがって「時間を減らすために CI からテストを外す」判断はしない。
 * 単体テストは CI に置き続ける（手元で流し忘れた場合と、手元だけで通る場合を捕まえる）。
 *
 * `runOn` は実行場所で、**ここ 1 か所で切り替える**。
 *   - `ci`     機械の上で毎回走る
 *   - `local`  手元でだけ走らせる（将来このリポジトリを非公開にしたときの逃がし先）
 *   - `manual` 人が起動したときだけ走る
 * テストファイル側が持つのは**段の印だけ**で、実行場所は書かない。
 * 書くと、場所を変えるたびに全テストを触ることになり、
 * そのとき人は「移す」より「消す」を選ぶ。
 *
 * `targetMinutes` は**目標であって、落とす条件ではない**。
 * 超えたら警告を出す。時間で赤くすると、時間を守るためにテストを削る力が働く。
 */
export const TIERS = [
  {
    id: 1,
    key: "fast",
    label: "速い門",
    runOn: "ci",
    triggers: ["push", "pull_request"],
    targetMinutes: 5,
    blocksMerge: true,
    contains: "型検査 / 書き方 / 段の指定漏れ / 単体・契約検査",
    why: "書いている最中に返ってくる速さを守る。ここが遅くなると、人は push をためらう",
  },
  {
    id: 2,
    key: "wide",
    label: "広い門",
    runOn: "ci",
    triggers: ["pull_request"],
    targetMinutes: 15,
    blocksMerge: true,
    contains:
      "結合 / API 契約 / 画面 / 読み上げ / 境界値 / カバレッジ閾値 / 変更範囲だけのミューテーション",
    why: "マージの直前に 1 回でよいもの。ここを毎 push に混ぜると 1 段の速さが死ぬ",
  },
  {
    id: 3,
    key: "deep",
    label: "深い門",
    runOn: "manual",
    triggers: ["schedule", "workflow_dispatch"],
    targetMinutes: 90,
    blocksMerge: false,
    contains: "全体ミューテーション / 負荷 / 見た目の回帰 / 脆弱性の深掘り / AI 評価セット",
    why: "落ちてもマージは止めない。止めると、夜間の赤を消すために夜間の検査が外される",
  },
];

/** 段の番号の一覧。テストに付けた印の検証に使う。 */
export const TIER_IDS = TIERS.map((t) => t.id);

/**
 * AI 評価セットの費用の上限。**この 2 つだけが従量課金の対象**である。
 *
 * `workflow_dispatch`（手動起動）のみとし、定期実行にも PR にも載せない。
 * 定期実行に載せた瞬間、誰も見ていない時間に費用が発生し続ける。
 *
 * 上限は**途中で止まる**ように使う（走り終えてから「超えました」と言わない）。
 * 見積り費用と実費用の両方を出し、`docs/product/ai-eval-cost.md` に
 * カバレッジと同じやり方で記録する（手で書き換えない）。
 *
 * 非 AI の構造検査（`tests/evals/generation-eval-set.test.ts`）はここに含めない。
 * あれは提供元へ 1 回も問い合わせないので、毎回の CI で走らせ続ける。
 */
export const AI_EVAL_BUDGET = {
  maxCases: 51,
  maxTokens: 400_000,
  why: "評価セットは 51 件。1 件あたり入出力で 8,000 トークンを上限の目安とした",
};

/**
 * 検査の並び。`scripts/verify.mjs` はこの順にそのまま実行する。
 *
 * 順番には理由がある。**安いものから先に落とす**。
 * 型が合っていないコードのテストを 30 秒かけて走らせても、分かるのは同じことである。
 * この並びは CI 側でも崩さない（`ci.yml` は段を呼ぶだけで、中身を持たない）。
 *
 * `blocking: false` は「落ちても止めないが、必ず出力する」もの。
 * 依存の脆弱性は上流の更新待ちで手が止まるため、警告どまりにする。
 *
 * `tier` はその検査が属する段。`node scripts/verify.mjs --tier 1` のように選べる。
 * 指定しなければ 1 段と 2 段を続けて走らせる（＝これまでと同じ内容）。
 */
export const CHECKS = [
  {
    id: "typecheck",
    label: "型検査",
    command: ["pnpm", "run", "typecheck"],
    blocking: true,
    tier: 1,
    why: "最も速く、最も多くの壊れ方を捕まえる。vitest は型を見ないので別に必要",
  },
  {
    id: "lint",
    label: "書き方の検査",
    command: ["pnpm", "run", "lint"],
    blocking: true,
    tier: 1,
    why: "層をまたぐ import と色の直書きを、編集中に気づける場所で止める",
  },
  {
    id: "tier-audit",
    label: "段の指定漏れ",
    command: ["node", "scripts/tier-audit.mjs"],
    blocking: true,
    tier: 1,
    why: "段の印が無いテストは、どの段でも走らないまま緑になる。テストを走らせる前に潰す",
  },
  {
    id: "test",
    label: "テストとカバレッジ",
    command: ["node", "scripts/run-tests.mjs", "--coverage"],
    blocking: true,
    tier: 1,
    why: "単体・結合・画面・契約検査はすべてここで走る。閾値未達もここで落ちる",
  },
  {
    id: "coverage-report",
    label: "層別の記録",
    command: ["node", "scripts/coverage-report.mjs"],
    blocking: true,
    tier: 2,
    why: "層別の下限と、スタブとの差を見る。全体 80% だけでは薄い場所が隠れる",
  },
  {
    id: "spec-freshness",
    label: "仕様レポートの鮮度",
    command: ["node", "scripts/spec-freshness.mjs"],
    blocking: false,
    tier: 2,
    why: "評価後に仕様書を書き換えると、古い PASS が古く見えないまま残る。指紋で気づける形にする",
  },
  {
    id: "audit",
    label: "依存の脆弱性",
    command: ["pnpm", "audit", "--audit-level", "high"],
    blocking: false,
    tier: 2,
    why: "数秒で済む。ただし上流待ちで作業が止まるのを避けるため警告どまり",
  },
];

/**
 * `--tier` の指定から、走らせる検査を選ぶ。
 *
 * 指定が無いときは `runOn: "ci"` の段だけを走らせる。
 * 3 段は夜間・週次・手動のもので、手元で `pnpm verify` を打った人を
 * 90 分待たせる意味が無い。
 *
 * @param {number[] | null} tiers 走らせたい段。空か null なら既定
 * @returns {typeof CHECKS}
 */
export function checksForTiers(tiers) {
  const wanted =
    tiers === null || tiers === undefined || tiers.length === 0
      ? TIERS.filter((t) => t.runOn === "ci").map((t) => t.id)
      : tiers;
  return CHECKS.filter((c) => wanted.includes(c.tier));
}

/**
 * 公開できる条件（リリースゲート）。
 *
 * **この 2 つ以外の理由で公開を止めない。** 他の指摘は残課題リストへ回す。
 * ゲートを増やすほど、ゲートを無視する運用に近づく。
 */
export const RELEASE_GATES = [
  { id: "verify", label: "`pnpm verify` が通っている" },
  { id: "critical-zero", label: "セキュリティ監査の CRITICAL が 0 件" },
];

const qualityGates = {
  GLOBAL_COVERAGE,
  LAYER_COVERAGE,
  STUB_PATTERNS,
  MAX_STUB_GAP_POINTS,
  judgeStubGap,
  TIERS,
  TIER_IDS,
  AI_EVAL_BUDGET,
  checksForTiers,
  CHECKS,
  RELEASE_GATES,
};

export default qualityGates;
