/**
 * @tier 1
 * @req REQ-CI01, REQ-CI02, REQ-CI03, REQ-CI04, REQ-CI05, REQ-CI06, REQ-CI07, REQ-CI09, REQ-CI10, REQ-CI11, REQ-CI13
 * @types infra-config
 *
 * 印を 1 行に収めてあるのは、`scripts/required-test-types.mjs` の `@req` の
 * 読み取りが `*` で止まるためで、折り返すと 2 行目の要件が黙って落ちる。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVAL_CASES } from "../../evals/generation/cases";
import { AI_EVAL_BUDGET, CHECKS, LAYER_COVERAGE, TIERS } from "../../quality-gates.config.mjs";

/**
 * 自動化の設定そのものを見る。**コードを 1 行も変えずに壊れる場所**である。
 *
 * 置いた理由（2026-08-19 の実測）。`.github/workflows/` の中身を壊して
 * 何が赤くなるか測ったところ、**閾値の書き写し以外は何も見ていなかった**。
 *
 * | 壊したもの | 結果 |
 * | --- | --- |
 * | 5 本それぞれに `coverage 80` を書き足す | 5 本とも赤 |
 * | `ci.yml` に検査名（`tier-audit` ほか）を書き写す | **緑** |
 * | `ci.yml` から `pnpm run verify` の呼び出しを外す | **緑** |
 * | `ci.yml` を `deploy.yml` の中身で丸ごと上書きする | **緑** |
 * | `deploy.yml` にマイグレーション適用の行を足す | **緑** |
 * | `migrate.yml` から確認文字列 `APPLY` の判定を外す | **緑** |
 *
 * `tests/architecture/quality-gates.test.ts` の
 * 「自動化の設定ファイルに閾値や検査名を書き写していない」は名前に
 * **検査名**と書いてあるが、見ているのは `coverage` の行の数字だけだった。
 * **名前が挙がっていることを、当たっている理由にしない。**
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md、docs/product/traceability.md D 節
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const workflow = (name: string) => read(`.github/workflows/${name}`);

/**
 * コメント行を落とした本体だけ。
 * 「なぜここに書かないか」を説明する注記まで禁止すると、
 * **理由を書けば書くほど赤くなる**という逆向きの力が働く。
 */
const codeOf = (name: string) =>
  workflow(name)
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

/** 検査名を「語として」探す。`ubuntu-latest` の中の `test` を拾わないため。 */
const mentions = (text: string, id: string) =>
  new RegExp(`(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(text);

/** 置いてあるべきワークフロー。**実装から読まず、ここに書き写して固定する。** */
const EXPECTED_WORKFLOWS = ["ai-eval.yml", "ci.yml", "deploy.yml", "migrate.yml", "nightly.yml"];

// --- 走査を「ディレクトリを受け取る関数」に割る ------------------------------
/**
 * **`.github/workflows/` を書き換えずに、走査の効きを測るための割り方。**
 *
 * CI の設定変更は利用者の判断なので、本物のワークフローは壊せない。
 * だが**測れないのは、走査先が実ファイルの場所に焼き付いているから**であって、
 * 決まりのせいだけではない。判定をディレクトリ引数で受ける形にすれば、
 * 本番は `.github/workflows/` を、対照は `tests/fixtures/workflow-scan/` を渡せる。
 * 本物に指 1 本触れずに「赤と緑が値で分かれる」ところまで測れる。
 *
 * **引数で受ける形の危うさ**も同時に見張る。後の誰かが本番側の引数を
 * 空ディレクトリへ差し替えれば、走査は常に緑になる。だから本番の検査は
 * ①読んだファイルの一覧が `EXPECTED_WORKFLOWS` と一致すること
 * ②`run:` を 15 行以上読めたこと、を同居させる。
 */
const WORKFLOW_DIR = join(ROOT, ".github/workflows");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/workflow-scan");

/** ディレクトリの中の `*.yml` を、コメント行を落として読む。 */
function ymlsIn(dir: string): { name: string; code: string }[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".yml"))
    .sort()
    .map((name) => ({
      name,
      code: readFileSync(join(dir, name), "utf8")
        .split("\n")
        .filter((line) => !/^\s*#/.test(line))
        .join("\n"),
    }));
}

/** `run:` の行だけを、どのファイルの行かと一緒に返す。 */
function runLinesIn(dir: string): { name: string; line: string }[] {
  return ymlsIn(dir).flatMap(({ name, code }) =>
    [...code.matchAll(/^\s*(?:- )?run: (.+)$/gm)].map((m) => ({ name, line: m[1].trim() })),
  );
}

/** 検査の道具を `pnpm exec` / `npx` / `yarn dlx` で直に叩く書き方。 */
const DIRECT_TOOL =
  /(?:pnpm exec|npx|yarn dlx)\s+(?:vitest|tsc|eslint|biome|stryker|playwright|jest)\b/;

/** 直叩きの行を返す。**判定はここ 1 箇所。**本番も対照も同じ関数を通る。 */
function scanDirectRuns(dir: string): string[] {
  return runLinesIn(dir)
    .filter((h) => DIRECT_TOOL.test(h.line))
    .map((h) => `${h.name}: ${h.line}`);
}

/** 正本 `LAYER_COVERAGE` が持つ閾値を、`coverage` の行から探す形にしたもの。 */
function thresholdPattern(): RegExp {
  const numbers = [
    ...new Set(LAYER_COVERAGE.flatMap((l) => [l.target, ...Object.values(l.floors)])),
  ].sort((a, b) => a - b);
  // **母集団の床**。正本を読めていなければ、探す数字が 0 個でも全部緑になる。
  expect(numbers.length, "正本から閾値を読めていません").toBeGreaterThanOrEqual(8);
  return new RegExp(`coverage[^\\n]*\\b(${numbers.join("|")})\\b`, "i");
}

/** 閾値を書き写しているファイルを返す。**判定はここ 1 箇所。** */
function scanWrittenThresholds(dir: string): string[] {
  const written = thresholdPattern();
  return ymlsIn(dir)
    .filter(({ code }) => written.test(code))
    .map(({ name }) => name);
}

describe("ワークフローの一覧（REQ-CI04）", () => {
  it("5 本ちょうどで、名前も固定されている", () => {
    const dir = join(ROOT, ".github/workflows");
    // 一覧が空でも緑になるのを防ぐ。ディレクトリごと消えたら、ここで落ちる。
    expect(existsSync(dir), ".github/workflows がありません").toBe(true);
    expect([...readdirSync(dir)].sort()).toEqual(EXPECTED_WORKFLOWS);
  });

  it("同じ引き金で動くものが 2 本ない（重複を残さない）", () => {
    // 旧 deploy-dev.yml / deploy-prod.yml を消した理由がこれである。
    // 2 本になると、片方だけ直した状態で「直した」と思う回が来る。
    const pushTriggered = EXPECTED_WORKFLOWS.filter((n) => /\n\s{2}push:/.test(workflow(n)));
    expect(pushTriggered).toEqual(["ci.yml", "deploy.yml"]);
    // 出し先は枝で決まる。ワークフローを増やして分けない。
    expect(workflow("deploy.yml")).toMatch(/branches:\s*\[main, dev\]/);
  });
});

describe("手元と機械で同じ検査が走る（REQ-CI01 / REQ-CI03）", () => {
  /**
   * ここが今回いちばん重い。判定欄には
   * 「`ci.yml` の検査ステップは `pnpm run verify` の 1 行のみ」と書いてあったが、
   * **実際には検査ステップが 3 つあった**（速い門 / 広い門 / マイグレーション未生成の検出）。
   * 3 つ目は機械の上にしか無く、手元の `pnpm run verify` では再現できない。
   * REQ-CI01 が禁じているのはまさにこの形で、**要件そのものが破れていた。**
   * 2026-08-19 に `scripts/migration-generated.mjs` として `verify` の中へ移した。
   */
  it("ci.yml の検査は pnpm run verify の呼び出しだけで、独自の検査を持たない", () => {
    const body = workflow("ci.yml");
    const runs = [...body.matchAll(/^\s*(?:- )?run: (.+)$/gm)].map((m) => m[1].trim());
    const setup = ["pnpm install --frozen-lockfile"];
    const checks = runs.filter((r) => !setup.includes(r));
    // 速い門（push）と広い門（PR）の 2 本だけ。どちらも verify を呼ぶ形。
    expect(checks).toEqual(["pnpm run verify --tier 1", "pnpm run verify"]);
    // 複数行のシェル（`run: |`）は、機械の上にしか無い検査の入口になる。
    expect(body, "ci.yml に複数行のシェルがあります").not.toMatch(/run: \|/);
  });

  it("検査の中身と順番を ci.yml / deploy.yml が持たない（正本は quality-gates.config.mjs）", () => {
    let checked = 0;
    for (const name of ["ci.yml", "deploy.yml"]) {
      const code = codeOf(name);
      for (const check of CHECKS) {
        expect(mentions(code, check.id), `${name} に検査名 ${check.id} が書き写されています`).toBe(
          false,
        );
        checked += 1;
      }
    }
    // 検査の一覧が空でも緑になるのを防ぐ。
    expect(checked).toBe(CHECKS.length * 2);
    expect(checked).toBeGreaterThan(0);
    expect(codeOf("deploy.yml")).toContain("pnpm run verify");
  });

  /**
   * **ここも走査の根が、要件の言葉より狭かった（2026-08-21）。**
   *
   * 要件は「`pnpm verify` が **CI と**まったく同じ検査を再現する」。
   * ところが上の検査が読んでいるのは **`ci.yml` 1 本だけ**である。
   * `deploy.yml` も `push`（main / dev）で動き、`pnpm run verify` を呼んでいる。
   * そこへ `pnpm exec vitest run` や `pnpm exec tsc --noEmit` を 1 行足せば、
   * それは**機械の上でしか走らない検査**になる——REQ-CI01 が禁じている形そのものだが、
   * `ci.yml` しか見ていない検査には届かない。
   *
   * そこで根を 5 本すべてへ広げ、**検査の道具を直に叩く書き方**を禁じる。
   * 検査は `pnpm run verify` か、正本に載っている `scripts/*.mjs` を通す。
   * `nightly.yml` の `node scripts/{tier-audit,run-tests,verify}.mjs` は
   * 手元でも同じものが走るので通る。`wrangler` は検査の道具ではないので通る。
   *
   * **測り方**: 本物のワークフローは壊さない。走査をディレクトリ引数で受ける形に割り、
   * `tests/fixtures/workflow-scan/` の偽物 2 本（違反する版・違反しない版）へ
   * **同じ関数**を向けて、赤と緑が値で分かれることを実測する（下の対照）。
   */
  it("走査が本当に効いている（仮の置き場で、赤と緑が分かれる）", () => {
    // 違反する偽物 → 1 件見つかる。「探せていないから 0 件」ではないことの証明。
    expect(scanDirectRuns(join(FIXTURE_DIR, "violating"))).toEqual([
      "sneaky.yml: pnpm exec vitest run tests/",
    ]);
    // 禁じていない書き方だけの偽物 → 0 件。**赤が出る理由が「狙ったもの」だと確定する。**
    // 2 本の差は `pnpm exec vitest` と `pnpm exec wrangler` の 1 点だけにしてある。
    expect(scanDirectRuns(join(FIXTURE_DIR, "clean"))).toEqual([]);
  });

  it("どのワークフローも、検査の道具を直に叩かない（手元で再現できない検査を作らない）", () => {
    // **本番の呼び出しが、仮の置き場や空ディレクトリを向いていないこと。**
    // 引数で受ける形にした以上、向き先の差し替えが新しい死角になる。
    expect(ymlsIn(WORKFLOW_DIR).map((y) => y.name)).toEqual(EXPECTED_WORKFLOWS);

    // **母集団の床。**`run:` を 1 行も拾えていなければ「無い」は自明に成り立つ。
    expect(runLinesIn(WORKFLOW_DIR).length, "ワークフローの run: を読めていません").toBeGreaterThanOrEqual(15);

    expect(
      scanDirectRuns(WORKFLOW_DIR),
      "検査の道具を直に叩いています。verify か scripts/*.mjs を通してください",
    ).toEqual([]);
  });

  it("マイグレーションの作り忘れの検査が、手元でも走る検査の一覧に入っている", () => {
    const ids = CHECKS.map((c) => c.id);
    expect(ids).toContain("migration-generated");
    // 速い門に置く。遅い段に置くと、push しただけの人には届かない。
    expect(CHECKS.find((c) => c.id === "migration-generated")?.tier).toBe(1);
  });
});

describe("閾値も検査名も書き写さない（REQ-CI02）", () => {
  /**
   * **2026-08-21 訂正。数字を書き写していたのは、この検査の側だった。**
   *
   * 元は `\b(80|85|90)\b` という**リテラル 3 つ**を探していた。
   * 正本 `LAYER_COVERAGE` が実際に持つ数字は 11 種類
   * （75 / 80 / 85 / 87 / 89 / 90 / 91 / 93 / 94 / 95 / 98）あり、
   * **8 種類は 1 度も探されていなかった**。
   * つまり「閾値を書き写していない」と名乗りながら、
   * `coverage 75` と書けば素通りする形だった。
   * 正本の閾値を書き写すな、と言う検査が、正本の閾値を書き写していた。
   *
   * **測り方**: 本物のワークフローは壊さない。走査をディレクトリ引数で受ける形に割り、
   * 仮の置き場の偽物 2 本へ同じ関数を向けて、赤と緑が値で分かれることを実測する。
   */
  it("走査が本当に効いている（仮の置き場で、赤と緑が分かれる）", () => {
    // 違反する偽物（`--coverage-threshold 75`）→ 1 件。
    // **もし正本から 75 が消えたら、ここが赤くなって「対照が古い」と知らせる。**
    // 対照が黙って効かなくなるより、赤で気づけるほうがよい。
    expect(scanWrittenThresholds(join(FIXTURE_DIR, "violating"))).toEqual(["sneaky.yml"]);
    // 閾値でない数字（`--retries 3`）だけの偽物 → 0 件。
    expect(scanWrittenThresholds(join(FIXTURE_DIR, "clean"))).toEqual([]);
  });

  it("5 本すべてに、閾値の数字が直接書かれていない（数字は正本から取る）", () => {
    // **本番の呼び出しが、仮の置き場や空ディレクトリを向いていないこと。**
    expect(ymlsIn(WORKFLOW_DIR).map((y) => y.name)).toEqual(EXPECTED_WORKFLOWS);

    expect(
      scanWrittenThresholds(WORKFLOW_DIR),
      "カバレッジの閾値が直接書かれています。数字は quality-gates.config.mjs から取ること",
    ).toEqual([]);
  });

  /**
   * **走査の根が、主張された範囲の端まで届いていなかった。**
   *
   * 要件の言葉は「CI 設定**と手元の設定**が別々に育たないようにする」。
   * ところが閾値を探していたのは `.github/workflows/` の 5 本と
   * `vitest.config.mts` だけで、**`package.json` は 1 度も読まれていなかった**。
   *
   * 実測（2026-08-21）: `package.json` の `test` を
   * `vitest run --coverage.thresholds.lines=75` に書き換えて全検査を流したところ、
   * `ci-config.test.ts` も `quality-gates.test.ts` も**緑のまま**通った
   * （落ちたのは無関係の既知の 1 件だけ）。
   * 手元のコマンドが正本と別の閾値で走り始めても、誰も知らせない形だった。
   *
   * **ここで見ていないもの（先に書く）**: 探すのは「`coverage` を含む行に
   * 正本の数字がある」形だけで、`75` を変数に入れてから渡す書き方は追えない。
   * 見ているのは「素の字で書き写す」経路である。
   */
  it("手元の設定（package.json）にも、閾値の数字が直接書かれていない", () => {
    const numbers = [
      ...new Set(LAYER_COVERAGE.flatMap((l) => [l.target, ...Object.values(l.floors)])),
    ];
    expect(numbers.length, "正本から閾値を読めていません").toBeGreaterThanOrEqual(8);
    const written = new RegExp(`coverage[^\\n]*\\b(${numbers.join("|")})\\b`, "i");

    // 探す側が動いていることを、同じ検査の中で示す。
    expect(written.test(`"test": "vitest run --coverage.thresholds.lines=${numbers[0]}"`)).toBe(
      true,
    );
    expect(written.test('"test": "vitest run"')).toBe(false);

    // **母集団の床**。読めていなければ「書かれていない」も自明に成り立つ。
    const scripts = read("package.json");
    expect(scripts.length, "package.json を読めていません").toBeGreaterThan(500);
    expect(scripts, "package.json の中身が想定と違います").toContain('"verify"');

    expect(scripts, "package.json にカバレッジの閾値が直接書かれています").not.toMatch(written);
  });

  /**
   * **ここは「無い」ではなく「これだけ」を固定している。**
   * `nightly.yml` は深い門の 3 ステップだけスクリプトを直に呼んでいる。
   * `verify.mjs --tier 3` に寄せられるが、段の指定漏れと 3 段の件数表示は
   * verify の外で先に出す必要があり、いまは分けてある。
   * 完全に無くせないので、**増えたら気づく形**にしてある。
   */
  it("nightly.yml が直に呼ぶスクリプトは、この 3 本だけ", () => {
    const called = [...workflow("nightly.yml").matchAll(/node (scripts\/[\w-]+\.mjs)/g)].map(
      (m) => m[1],
    );
    expect(called).toEqual([
      "scripts/tier-audit.mjs",
      "scripts/run-tests.mjs",
      "scripts/verify.mjs",
    ]);
  });
});

describe("データの形の変更は、人が起動したときだけ（REQ-CI05）", () => {
  it("migrate.yml は自動で走らず、確認文字列が合わないと最初のステップで落ちる", () => {
    const body = workflow("migrate.yml");
    expect(body).toMatch(/on:\s*\n\s*workflow_dispatch:/);
    expect(body, "自動の引き金があります").not.toMatch(/\n\s{2}(push|pull_request|schedule):/);
    expect(body).toContain("inputs.confirm != 'APPLY'");
  });

  it("適用の前に控えを取り、期限付きで残す", () => {
    const code = codeOf("migrate.yml");
    expect(code).toContain("wrangler d1 export");
    expect(code).toMatch(/retention-days:\s*30/);
    // 控えを取るステップが、適用のステップより前にあること。
    // 適用は `pnpm db:migrate:*`（wrangler の呼び出しは package.json 側）。
    expect(code.indexOf("db:migrate:")).toBeGreaterThan(-1);
    expect(code.indexOf("wrangler d1 export")).toBeLessThan(code.indexOf("db:migrate:"));
  });

  it("deploy.yml はマイグレーションを 1 行も持たない", () => {
    // 公開とマイグレーションを同じ流れに入れると、順番が逆転した回に本番が落ちる。
    const body = workflow("deploy.yml");
    for (const forbidden of ["migrations apply", "d1 migrations", "db:migrate"]) {
      expect(body, `deploy.yml に ${forbidden} があります`).not.toContain(forbidden);
    }
  });
});

describe("公開したあとの動作確認（REQ-CI06）", () => {
  const smoke = () => read(".github/scripts/smoke.sh");

  it("間隔を空けて 2 回確かめ、判定は 2 回目で行う", () => {
    const body = smoke();
    // 1 回だけだと、古い実行環境が残っている間に緑を取ってしまう。
    expect((body.match(/^sleep /gm) ?? []).length).toBe(2);
    expect(body).toContain("check_once \"1 回目\"");
    expect(body).toContain("check_once \"2 回目\"");
    expect(body).toMatch(/if \[ "\$second_status" -ne 0 \]/);
  });

  it("2 回目が落ちたときに、終了コードで落とす（記録だけ残して通さない）", () => {
    /**
     * `exit 1` があることだけを見ると通ってしまう。
     * このファイルには APP_URL 未設定の `exit 1` が別にあり、
     * **判定側の `exit 1` を消しても「exit 1 はある」で緑になる**（実測で確認した）。
     * だから、2 回目の判定の枝の中にあることを見る。
     */
    const branch = smoke().split('if [ "$second_status" -ne 0 ]')[1] ?? "";
    expect(branch.split("\nfi")[0]).toContain("exit 1");
  });

  it("deploy.yml が、公開のあとにこれを呼ぶ", () => {
    const body = workflow("deploy.yml");
    expect(body).toContain("bash .github/scripts/smoke.sh");
    // 公開の実行（deploy:prod）より後にあること。先に確認しても前の版を見るだけ。
    expect(body.indexOf("pnpm deploy:prod")).toBeGreaterThan(-1);
    expect(body.indexOf("pnpm deploy:prod")).toBeLessThan(body.indexOf("smoke.sh"));
  });
});

describe("秘密情報の置き場所（REQ-CI07）", () => {
  it("見本のファイルに値が入っていない", () => {
    const body = read(".dev.vars.example");
    for (const line of body.split("\n")) {
      if (line.startsWith("#") || line.trim() === "") continue;
      // `NAME=""` の形だけを許す。値が入ると、その値のまま使われる。
      expect(line, `${line} に値が書かれています`).toMatch(/^[A-Z0-9_]+=""$/);
    }
  });

  it("ワークフローは秘密を平文で持たず、必ず secrets 経由で受け取る", () => {
    for (const name of EXPECTED_WORKFLOWS) {
      const body = workflow(name);
      // 32 文字以上の英数の並びが右辺に来ていたら、鍵らしい形として止める。
      const suspicious = [...body.matchAll(/^\s*[A-Z0-9_]*(TOKEN|KEY|SECRET)[A-Z0-9_]*:\s*(.+)$/gm)];
      for (const [, , value] of suspicious) {
        expect(value.trim(), `${name} に値が直接書かれています`).toMatch(/^\$\{\{\s*secrets\./);
      }
    }
  });
});

describe("重い検査の置き場所（REQ-CI09 / REQ-CI10 / REQ-CI11）", () => {
  it("深い門は自動で走らない（定例を廃止した 2026-08-18 の決定）", () => {
    // 定例で走らせると、赤を消すために夜間の検査そのものが外される。
    for (const name of ["nightly.yml", "ai-eval.yml"]) {
      expect(workflow(name), `${name} に定例の引き金があります`).not.toMatch(/^\s*schedule:/m);
      expect(workflow(name)).toMatch(/workflow_dispatch:/);
    }
  });

  it("段の指定漏れの検査が、テストを走らせるより前にある", () => {
    const order = CHECKS.map((c) => c.id);
    expect(order.indexOf("tier-audit")).toBeLessThan(order.indexOf("test"));
    // 夜間の側でも同じ順番であること。片方だけ直しても気づけるようにする。
    const nightly = workflow("nightly.yml");
    expect(nightly.indexOf("tier-audit.mjs")).toBeLessThan(nightly.indexOf("run-tests.mjs"));
  });

  it("段の割り当ては設定 1 か所にあり、ワークフローは番号を渡すだけ", () => {
    // ワークフロー側に「何がその段に属するか」を書くと、正本が 2 つになる。
    for (const name of ["ci.yml", "nightly.yml"]) {
      const body = workflow(name);
      expect(body).toMatch(/--tier \d/);
      for (const tier of TIERS) {
        expect(body, `${name} に段の中身（${tier.contains}）が書き写されています`).not.toContain(
          tier.contains,
        );
      }
    }
  });

  it("マージを止める段は、機械の上で走る段と一致する", () => {
    for (const tier of TIERS) {
      if (tier.blocksMerge) expect(tier.runOn, tier.label).toBe("ci");
    }
    // 逆向きも固定する。手元専用の段が増えたときに、止める側へ紛れ込まない。
    expect(TIERS.filter((t) => t.blocksMerge).map((t) => t.id)).toEqual([1, 2]);
  });
});

describe("費用の出る検査（REQ-CI13）", () => {
  it("ai-eval.yml は手動起動のみで、確認文字列が要る", () => {
    const body = workflow("ai-eval.yml");
    expect(body).not.toMatch(/^\s*schedule:/m);
    expect(body).toContain("inputs.confirm != 'RUN'");
  });

  /**
   * **2026-08-21 訂正: 「実件数」と名乗って、実件数の写しを見ていた。**
   * 元は `toBeLessThanOrEqual(51)` で、`51` は評価セットの件数**を書き写した数**だった。
   * 評価ケースを 1 件消して測ると、この検査は**緑のまま**通り、
   * 上限 51 は 1 度も効かない飾りになる（実測 2026-08-21）。
   * いまは `EVAL_CASES.length` と突き合わせる。同じ形が
   * `tests/architecture/quality-gates.test.ts` にも残っている（残課題へ）。
   */
  it("上限は 0 より大きく、評価セットの実件数を超えない", () => {
    // **母集団の床**。評価セットが空なら「上限 ≦ 件数」は破れないので、先に実物を見る。
    expect(EVAL_CASES.length, "評価セットを読めていません").toBeGreaterThanOrEqual(50);
    // 上限が実件数より大きいと、上限は 1 度も効かない飾りになる。
    expect(AI_EVAL_BUDGET.maxCases).toBeGreaterThan(0);
    expect(AI_EVAL_BUDGET.maxCases).toBeLessThanOrEqual(EVAL_CASES.length);
    expect(AI_EVAL_BUDGET.maxTokens).toBeGreaterThan(0);
  });
});

/**
 * **緑なのにマージできない、という止まり方を二度させない（REQ-CI01）。**
 *
 * GitHub が保護設定へ報告する検査の名前は、job に `name:` があればその値、
 * 無ければ job の id になる。`main` の必須チェックはこの名前で待っているので、
 * 表示名を足すと必須チェックが永久に報告されず PR が BLOCKED のまま残る。
 * このとき PR の一覧には**緑のチェックが並ぶ**ので、原因が設定側だと分からない。
 *
 * 2026-08-21 に実際に起きた。`ci.yml` の job id は `verify` のままだったが
 * `name: 検査` が表示名を上書きしていて、必須チェック `verify` が 1 度も
 * 報告されなかった。検査は 12 門すべて緑だった。
 *
 * **保護設定はこのリポジトリの中に無い。**GitHub 側の設定なのでテストから
 * 読めない。読めない相手と突き合わせる以上、期待値をこちら側に書き写して
 * 固定するしかない。書き写した値が実物とずれたら、この検査は「守っている」と
 * 言いながら何も守らなくなる。**だから何をどう固定するかが、この検査の設計の
 * 中心になる。**
 */
/**
 * `main` の保護設定が必須にしている検査の名前。**GitHub 側の設定の写しである。**
 *
 * 実物はこれで引ける (2026-08-21 に引いて `['verify']` を確認):
 *   gh api repos/daishiman/affiliate-hub/branches/main/protection \
 *     --jq '.required_status_checks.contexts'
 *
 * **変えるときは両方変えること。**ここだけ変えても保護設定は変わらないし、
 * 保護設定だけ変えるとここがずれる。ずれても検査は緑のままなので、
 * 気づく手段は無い。その穴は下の「写しはずれうる」で固定してある。
 */
const REQUIRED_CHECK_CONTEXT = "verify";

describe("必須チェックの名前が保護設定と噛み合う（REQ-CI01）", () => {
  /**
   * job が GitHub へ報告する検査の名前を取り出す。
   * `name:` があればその値、無ければ job の id。GitHub の規則をそのまま写す。
   */
  const reportedCheckName = (yml: string, jobId: string): string => {
    const body = yml.split(/^jobs:\s*$/m)[1] ?? "";
    const block = body.split(new RegExp(`^  ${jobId}:\\s*$`, "m"))[1] ?? "";
    // 次の job が始まるまでを、この job の範囲とする。
    const own = block.split(/^  [\w-]+:\s*$/m)[0] ?? "";
    const named = own
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .find((line) => /^ {4}name:\s*\S/.test(line));
    return named
      ? named
          .replace(/^\s*name:\s*/, "")
          .trim()
          .replace(/^["']|["']$/g, "")
      : jobId;
  };

  it("取り出し方そのものが動いている（0 件は探す側が壊れていても出る）", () => {
    // 陽性: 表示名を足した合成例では、その値が返る。
    const withName = "jobs:\n  verify:\n    name: 検査\n    runs-on: x\n";
    expect(reportedCheckName(withName, "verify")).toBe("検査");
    // 陰性: 足していなければ job の id が返る。
    const without = "jobs:\n  verify:\n    runs-on: x\n";
    expect(reportedCheckName(without, "verify")).toBe("verify");
    // コメントの中の `name:` は表示名ではない。**理由を書くと赤くなる形にしない。**
    const commented = "jobs:\n  verify:\n    # name: 検査\n    runs-on: x\n";
    expect(reportedCheckName(commented, "verify")).toBe("verify");
  });

  it("ci.yml が報告する名前は、保護設定が待っている名前と一致する", () => {
    expect(reportedCheckName(workflow("ci.yml"), "verify")).toBe(REQUIRED_CHECK_CONTEXT);
  });

  /**
   * **塞げない穴を、消さずに検査として残す。**
   *
   * 上の検査が突き合わせているのは GitHub の保護設定ではなく、その**写し**
   * (`REQUIRED_CHECK_CONTEXT`) である。保護設定を `verify` 以外へ変えても、
   * 写しを一緒に書き換えれば上の検査は緑のまま通る。つまり上の検査は
   * 「実物と噛み合っていること」ではなく「写しと噛み合っていること」しか
   * 言っていない。
   *
   * 塞げない理由は難しさではなく、**保護設定がこの作業場所の外に在る**ため。
   * 読むには GitHub への認証つきアクセスが要り、それを検査の中に置くことは
   * この作業場所の約束と両立しない。次に読む人が無駄に挑まないよう書いておく。
   *
   * **⑤ 反転先**: CI から保護設定を読む道 (`gh api` の結果を成果物として
   * 渡す等) が用意された日、この検査は赤くなる。そのとき消さず、
   * 「写しと実物が一致していること」へ反転させる。写しを消してはいけない。
   * 消すと、実物が変わったときに気づく手段が両方とも無くなる。
   */
  it("**写しはずれうる。**両方を書き換えれば上の検査は素通りする", () => {
    // 合成例: 保護設定も ci.yml も別名へ揃えた世界。上の検査は通ってしまう。
    const renamed = "jobs:\n  deploy-gate:\n    runs-on: x\n";
    const copiedContext = "deploy-gate";
    expect(reportedCheckName(renamed, "deploy-gate")).toBe(copiedContext);

    // 実物 (GitHub の保護設定) を読んでいないことを、ここで明示的に固定する。
    // 読む道ができた日にこの検査が赤くなり、⑤の反転を促す。
    //
    // **コメントを外してから探す。**引き方をコメントに書き残してあるので、
    // 本文ごと探すと「説明を書いたから赤くなる」になる。冒頭の `codeOf` が
    // ワークフローに対して同じ手当てをしているのと同じ理由。
    const code = read("tests/architecture/ci-config.test.ts")
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    expect(
      /execFileSync\(\s*["']gh["']|fetch\(.*api\.github\.com/.test(code),
      "保護設定を実際に読む道ができたようです。⑤に従って反転させてください",
    ).toBe(false);
  });
});
