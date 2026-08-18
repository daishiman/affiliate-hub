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
import { AI_EVAL_BUDGET, CHECKS, TIERS } from "../../quality-gates.config.mjs";

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

  it("マイグレーションの作り忘れの検査が、手元でも走る検査の一覧に入っている", () => {
    const ids = CHECKS.map((c) => c.id);
    expect(ids).toContain("migration-generated");
    // 速い門に置く。遅い段に置くと、push しただけの人には届かない。
    expect(CHECKS.find((c) => c.id === "migration-generated")?.tier).toBe(1);
  });
});

describe("閾値も検査名も書き写さない（REQ-CI02）", () => {
  it("5 本すべてに、閾値の数字が直接書かれていない", () => {
    let seen = 0;
    for (const name of EXPECTED_WORKFLOWS) {
      expect(workflow(name), `${name} にカバレッジの閾値が直接書かれています`).not.toMatch(
        /coverage[^\n]*\b(80|85|90)\b/i,
      );
      seen += 1;
    }
    // 一覧が空でも緑になるのを防ぐ。5 本を数えたことをここで固定する。
    expect(seen).toBe(5);
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

  it("上限は 0 より大きく、評価セットの実件数（51）を超えない", () => {
    // 上限が実件数より大きいと、上限は 1 度も効かない飾りになる。
    expect(AI_EVAL_BUDGET.maxCases).toBeGreaterThan(0);
    expect(AI_EVAL_BUDGET.maxCases).toBeLessThanOrEqual(51);
    expect(AI_EVAL_BUDGET.maxTokens).toBeGreaterThan(0);
  });
});
