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
const EXPECTED_WORKFLOWS = [
  "ai-eval.yml",
  "branch-flow.yml",
  "ci.yml",
  "deploy.yml",
  "migrate.yml",
  "nightly.yml",
];

describe("ワークフローの一覧（REQ-CI04）", () => {
  it("6 本ちょうどで、名前も固定されている", () => {
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

describe("枝の順番（REQ-CI04）", () => {
  /**
   * 一覧に名前が載っているだけでは足りない。冒頭の実測表のとおり、
   * **中身を丸ごと入れ替えても緑だった**という前科がここにはある。
   * `branch-flow.yml` は「落とすこと」が仕事なので、
   * `exit 1` を消されたら存在ごと無意味になる。要点を書き写して固定する。
   */
  it("main への PR だけを見て、dev と hotfix/* 以外は落とす", () => {
    const code = codeOf("branch-flow.yml");
    // dev への PR まで見ると、作業ブランチからの通常の PR が全部落ちる。
    expect(code).toMatch(/pull_request:\s*\n\s*branches:\s*\[main\]/);
    expect(code).toMatch(/\bdev\)/);
    expect(code).toMatch(/\bhotfix\/\*\)/);
    // 逃がすだけで落とさないなら、置いていないのと同じ。
    expect(code).toMatch(/exit 1/);
  });

  it("枝の名前を run へ直接埋め込まない（任意コマンドが走る）", () => {
    // 枝の名前は PR を出す人が決める文字列。`${{ }}` はシェルより先に
    // 展開されるので、`$(...)` を含んだ名前を付けられると実行される。
    const code = codeOf("branch-flow.yml");
    const runBlock = code.slice(code.indexOf("run: |"));
    expect(runBlock).not.toMatch(/\$\{\{/);
    expect(code).toMatch(/HEAD_REF:\s*\$\{\{\s*github\.head_ref\s*\}\}/);
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
  it("6 本すべてに、閾値の数字が直接書かれていない", () => {
    let seen = 0;
    for (const name of EXPECTED_WORKFLOWS) {
      expect(workflow(name), `${name} にカバレッジの閾値が直接書かれています`).not.toMatch(
        /coverage[^\n]*\b(80|85|90)\b/i,
      );
      seen += 1;
    }
    // 一覧が空でも緑になるのを防ぐ。6 本を数えたことをここで固定する。
    expect(seen).toBe(EXPECTED_WORKFLOWS.length);
    expect(seen).toBe(6);
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

  it("管理画面は、通すことではなく /signin へ送ることを確かめる", () => {
    const body = smoke();
    /**
     * ここを 200 期待に戻すと、**門が外れて誰でも入れる状態が緑になる**。
     * 2026-08-21 の公開で実際に 307 が出て「壊れた」と読み違えた。
     * 307 は middleware（src/middleware.ts）が効いている証拠の方である。
     */
    expect(body).toContain('"/admin|307|/signin|');

    /**
     * 状態だけを見ると、送り先が外部のアドレスに差し替わっても 307 のまま緑になる。
     * 末尾一致（`*${expected_location}`）でも同じ穴が残るので、
     * **自分の入口を付けた形と丸ごと**比べていることを見る。
     */
    expect(body).toContain('"${ORIGIN}${expected_location}"');
  });

  it("deploy.yml が、公開のあとにこれを呼ぶ", () => {
    const body = workflow("deploy.yml");
    expect(body).toContain("bash .github/scripts/smoke.sh");
    // 公開の実行（deploy:prod）より後にあること。先に確認しても前の版を見るだけ。
    expect(body.indexOf("pnpm deploy:prod")).toBeGreaterThan(-1);
    expect(body.indexOf("pnpm deploy:prod")).toBeLessThan(body.indexOf("smoke.sh"));
  });
});

/**
 * Worker には **3 MiB（gzip 後）** という上限がある。2026-08-21 に 3431 KiB で
 * 当たり、公開が止まった。原因は Turbopack が同じかたまりを重ねて吐くことで、
 * `scripts/dedupe-server-chunks.mjs` がそれを 1 つに寄せている（3431 → 2196 KiB）。
 *
 * ここで見るのは**呼ぶ順番**である。順番が狂うと削減が黙って消える:
 *
 * - 寄せる前に `opennextjs-cloudflare build` を挟むと、そちらが `next build` を
 *   走らせ直し、**寄せた結果が上書きされる**。だから `--skipNextBuild` が要る。
 * - `deploy:*` が `build:worker` を通らなくなれば、寄せる処理ごと消える。
 *
 * どちらも**その場では何も起きない**。太った Worker が上限に当たるまで気づけず、
 * 当たったときに出るのは「サイズ超過」であって「寄せ忘れ」ではない。
 */
describe("公開する版のかたまりを寄せる順番", () => {
  const scripts = (): Record<string, string> =>
    JSON.parse(read("package.json")).scripts as Record<string, string>;

  const DEDUPE = "scripts/dedupe-server-chunks.mjs";

  it("build:worker が、作る → 寄せる → 束ね直す の順に並んでいる", () => {
    const chain = scripts()["build:worker"] ?? "";
    const [before, after] = chain.split(DEDUPE);

    expect(after, `${DEDUPE} を呼んでいません`).toBeDefined();
    // 寄せる前に 1 回作る。ここで `.next/standalone/` ができる。
    expect(before, "寄せる前にビルドがありません").toContain("opennextjs-cloudflare build");
    // 寄せた後にもう 1 回束ねる。ここで寄せた結果が Worker に入る。
    expect(after, "寄せた後に束ね直していません").toContain("opennextjs-cloudflare build");
  });

  it("2 回目が最初からやり直さない（やり直すと寄せた結果が上書きされる）", () => {
    const after = (scripts()["build:worker"] ?? "").split(DEDUPE)[1] ?? "";
    /**
     * `--skipNextBuild` を落としても**何も起きない**。ビルドは通り、公開も走り、
     * ただ Worker が寄せる前の大きさに戻るだけ。気づくのは上限に当たったときで、
     * そのとき出るのは「サイズ超過」であって「寄せ忘れ」ではない。
     */
    expect(after, "--skipNextBuild が無いと、寄せた結果が上書きされます").toContain(
      "opennextjs-cloudflare build --skipNextBuild",
    );
  });

  it("dev も本番も、公開の前に必ずここを通る", () => {
    for (const name of ["deploy:dev", "deploy:prod", "preview"]) {
      const body = scripts()[name] ?? "";
      expect(body, `${name} が build:worker を通っていません`).toContain("build:worker");
      /*
        手元の確認（preview）も同じ道を通す。ここだけ別の作り方にすると、
        **手元では出ない不具合が本番にだけ出る**経路ができる。
      */
      if (name === "preview") continue;
      expect(body.indexOf("build:worker")).toBeLessThan(body.indexOf("deploy"));
    }
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
