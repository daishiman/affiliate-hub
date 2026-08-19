/**
 * @tier 1
 * @req REQ-TS16
 * @types equivalence, boundary
 *
 * `equivalence` を名乗る根拠: 同じ「版」という値を、**門のある経路（正本 JSON）**と
 * **門の無い経路（契約の散文）**の 2 クラスへ分け、**両方を見る**。散文側だけを見ると、
 * 判定式が何にも当たらない日にも同じ「食い違い 0 件」が出る。JSON 側が定数と
 * 一致していることを同じ検査に置いて、比べる側が動いていることを示す。
 * `boundary` の根拠: 版の境目（`1.1` と `1.2`）そのものと、
 * 散文と定数を突き合わせる経路が **ちょうど 0 本**という境目を見ていること。
 *
 * ── 何を固定するか（形 ②: 塞げていないことを検査にする）──────────────
 *
 * `CURRENT_STATE_SCHEMA_VERSION` は `validate-coverage-matrix.py` に **1 箇所**あり、
 * 正本 `system-spec/spec-state.json` の `schema_version` はこれと一致する。
 * **一致するのは、一致を要求する門があるからである**（`test_state_schema_version_gate.py`）。
 *
 * ところが同じ版を**散文でも宣言している**場所がある:
 * `run-system-spec-elicit/references/spec-state-contract.md` は
 * `"schema_version": "1.1"` と書き、「1.1 以降で marker 欠落を許さない」と述べる。
 * 定数はすでに `1.2`、正本も `1.2`。**散文だけが 1.1 に取り残されている。**
 *
 * これは値の誤りではなく **書き手の欠落**である（REQ-TS16 の ⑪「器はあるのに
 * 渡す側がいない」）。散文の版を定数に合わせて書き換える経路は 0 本で、
 * 版を上げた人が手で直さない限りずれ続ける。**直し方は「書き手を直す」ではなく
 * 「書き手を作る」側**であり、見分けを間違えると居ない書き手を探し続ける。
 *
 * ── なぜ散文を直して済ませないか ────────────────────────────
 *
 * 散文は数字だけでなく **「1.1 が何を要求するか」という段落ごと**版に結び付いている。
 * 数字を `1.2` へ置き換えると、1.1→1.2 で境界が変わっていないという**確かめていない
 * 主張**を書き込むことになる。**いま在る誤りを、より見えにくい誤りに置き換えるだけ**
 * になるので、直さずに固定する（REQ-TS14 と同じ理由）。
 *
 * ── 反転先（塞がった日にすること。先に書いておく）──────────────────
 *
 * **散文が定数へ追随するようになった日に、この検査は赤くなる。そのとき削除せず
 * 「散文の宣言版と `CURRENT_STATE_SCHEMA_VERSION` が一致すること」へ反転させる。**
 * 具体的には `expect(prose).not.toBe(constant)` を `toBe` へ、
 * 「突き合わせ経路 0 本」を「1 本以上」へ向きを変える。
 * 消すと、いったん揃えた版が次の版上げでまた離れても誰も気づかない状態へ帰る。
 *
 * 2026-08-20 実測（分母は各 it() 内に併記）: 定数 `1.2` / 正本 `1.2` /
 * 散文 `1.1`、散文と定数を同時に参照する `.py` は harness 配下 59 本中 **0 本**。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const HARNESS = join(ROOT, ".claude/plugins/system-spec-harness");
const VALIDATOR = join(HARNESS, "scripts/validate-coverage-matrix.py");
const CONTRACT_MD = join(
  HARNESS,
  "skills/run-system-spec-elicit/references/spec-state-contract.md",
);
const STATE_JSON = join(ROOT, "system-spec/spec-state.json");

/** `CURRENT_STATE_SCHEMA_VERSION = "1.2"` を 1 箇所から読む。 */
function constantVersion(): string {
  const source = readFileSync(VALIDATOR, "utf8");
  const hit = source.match(/^CURRENT_STATE_SCHEMA_VERSION\s*=\s*"([0-9]+\.[0-9]+)"/m);
  expect(hit, "定数の定義が見つからない — 以下の比較はすべて測れていない").not.toBeNull();
  return hit![1];
}

/** 契約の散文が宣言している版（複数あればすべて）。 */
function proseVersions(): string[] {
  const text = readFileSync(CONTRACT_MD, "utf8");
  return [...text.matchAll(/schema_version[`"]*\s*[:]\s*[`"]*([0-9]+\.[0-9]+)/g)].map(
    (m) => m[1],
  );
}

function pythonFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) pythonFiles(path, found);
    else if (name.endsWith(".py")) found.push(path);
  }
  return found;
}

describe("schema 版の散文ずれ (REQ-TS16 / 書き手が居ない側の固定)", () => {
  it("母集団: 契約の散文は版を 1 件以上宣言している", () => {
    // 0 件なら以下の「食い違っている」は、宣言が無いだけで同じ見え方になる。
    expect(proseVersions().length).toBeGreaterThanOrEqual(1);
  });

  it("対照: 門のある経路では正本 JSON の版が定数と一致する", () => {
    const state = JSON.parse(readFileSync(STATE_JSON, "utf8")) as { schema_version: string };
    expect(state.schema_version).toBe(constantVersion());
  });

  it("穴: 契約の散文が宣言する版は定数と一致しない（塞がった日に赤くなる）", () => {
    const constant = constantVersion();
    const prose = proseVersions();
    expect(prose.length).toBeGreaterThanOrEqual(1); // 母集団の床を同じ it() に置く
    expect(prose).not.toContain(constant);

    // 反転先: 上の 1 行を expect(prose).toContain(constant) へ書き換える。
  });

  it("穴の理由: 散文と定数を突き合わせる経路が 0 本（器はあるが渡す側が居ない）", () => {
    const files = pythonFiles(HARNESS);
    expect(files.length).toBeGreaterThanOrEqual(50); // 母集団の床

    const sources = files.map((path) => ({ path, text: readFileSync(path, "utf8") }));

    // 陽性対照: 定数を参照するファイル自体は存在する（探し方が動いている）。
    const knowsConstant = sources.filter((f) =>
      f.text.includes("CURRENT_STATE_SCHEMA_VERSION"),
    );
    expect(knowsConstant.length).toBeGreaterThanOrEqual(1);

    // 陽性対照 2: 契約 md を名指しするファイルも存在する（片側だけなら在る）。
    const knowsContract = sources.filter((f) => f.text.includes("spec-state-contract"));
    expect(knowsContract.length).toBeGreaterThanOrEqual(1);

    // 穴: 両方を同時に見ているファイルは無い。
    const both = sources
      .filter(
        (f) =>
          f.text.includes("spec-state-contract") &&
          f.text.includes("CURRENT_STATE_SCHEMA_VERSION"),
      )
      .map((f) => f.path.slice(ROOT.length + 1));
    expect(both).toEqual([]);

    // 反転先: 上の 1 行を expect(both.length).toBeGreaterThanOrEqual(1) へ。
  });

  /**
   * 2026-08-20: 「定義は 1 箇所」と想定して書いたら赤くなった。**実物は 2 箇所**——
   * `scripts/validate-coverage-matrix.py:91` と
   * `skills/run-system-spec-elicit/scripts/state_transition_matrix.py:19`。
   * 今日はどちらも `"1.2"` で偶然そろっているだけで、**一致を要求する門は無い**
   * （版を上げる人が片方だけ直せる）。散文ずれと同じ形が、コードの中にもある。
   *
   * ここは穴の固定ではなく **門を新しく張る**。向きは 2 本立て:
   *   - 上限 2（**下げる方向にしか動かさない**）: 版の正本をこれ以上増やさない。
   *   - 値の一致（下限側）: 定義が何本あっても、値は 1 種類でなければならない。
   * 上限だけだと、定義を消せば数は下がる。一致だけだと、定義を増やしても
   * そろえてさえいれば通る。**逆向きで対にしてあることが仕掛けの本体**である。
   */
  it("版の正本は 2 箇所以下で、値は 1 種類（片方だけ上げる道を塞ぐ）", () => {
    const files = pythonFiles(HARNESS);
    const definitions = files
      .map((path) => ({
        path: path.slice(ROOT.length + 1),
        hit: readFileSync(path, "utf8").match(
          /^CURRENT_STATE_SCHEMA_VERSION\s*=\s*"([0-9]+\.[0-9]+)"/m,
        ),
      }))
      .filter((d) => d.hit !== null);

    expect(definitions.length).toBeGreaterThanOrEqual(1); // 母集団の床
    expect(definitions.length).toBeLessThanOrEqual(2); // 上限。下げる方向にしか動かさない
    expect(new Set(definitions.map((d) => d.hit![1])).size).toBe(1);
  });
});
