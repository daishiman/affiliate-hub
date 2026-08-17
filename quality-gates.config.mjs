/**
 * 品質ゲートの唯一の正本。
 *
 * 閾値と検査項目をここ 1 箇所に集める。読み手は 4 つだけ:
 *   - `vitest.config.mts`              カバレッジ閾値をそのまま渡す
 *   - `scripts/verify.mjs`             検査の並びと順番をそのまま実行する
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
 * 検査の並び。`scripts/verify.mjs` はこの順にそのまま実行する。
 *
 * 順番には理由がある。**安いものから先に落とす**。
 * 型が合っていないコードのテストを 30 秒かけて走らせても、分かるのは同じことである。
 *
 * `blocking: false` は「落ちても止めないが、必ず出力する」もの。
 * 依存の脆弱性は上流の更新待ちで手が止まるため、警告どまりにする。
 */
export const CHECKS = [
  {
    id: "typecheck",
    label: "型検査",
    command: ["pnpm", "run", "typecheck"],
    blocking: true,
    why: "最も速く、最も多くの壊れ方を捕まえる。vitest は型を見ないので別に必要",
  },
  {
    id: "lint",
    label: "書き方の検査",
    command: ["pnpm", "run", "lint"],
    blocking: true,
    why: "層をまたぐ import と色の直書きを、編集中に気づける場所で止める",
  },
  {
    id: "test",
    label: "テストとカバレッジ",
    command: ["pnpm", "run", "test:coverage"],
    blocking: true,
    why: "単体・結合・画面・契約検査はすべてここで走る。閾値未達もここで落ちる",
  },
  {
    id: "coverage-report",
    label: "層別の記録",
    command: ["node", "scripts/coverage-report.mjs"],
    blocking: true,
    why: "層別の下限と、スタブとの差を見る。全体 80% だけでは薄い場所が隠れる",
  },
  {
    id: "spec-freshness",
    label: "仕様レポートの鮮度",
    command: ["node", "scripts/spec-freshness.mjs"],
    blocking: false,
    why: "評価後に仕様書を書き換えると、古い PASS が古く見えないまま残る。指紋で気づける形にする",
  },
  {
    id: "audit",
    label: "依存の脆弱性",
    command: ["pnpm", "audit", "--audit-level", "high"],
    blocking: false,
    why: "数秒で済む。ただし上流待ちで作業が止まるのを避けるため警告どまり",
  },
];

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
  CHECKS,
  RELEASE_GATES,
};

export default qualityGates;
