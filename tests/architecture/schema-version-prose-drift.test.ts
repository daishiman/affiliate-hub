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
 * 散文と定数を突き合わせる経路が **在るか無いか**という境目を見ていること
 * （2026-08-20 は 0 本、2026-08-21 に 2 本へ。下の反転記録を参照）。
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
 * ── 2026-08-20: 穴を説明した文章が、穴が塞がった証拠として数えられた ─────────
 *
 * この検査は当初、harness の `.py` を**素のテキスト**で見て「契約 md の名前と定数名の
 * 両方に触れているファイル = 突き合わせ経路」と数えていた。ところがこの穴の理由を
 * `test_spec_transition_version_sections.py` の docstring へ丁寧に書いたところ、
 * **その説明文が「経路が 1 本できた」と判定されて検査が赤くなった。**
 * 主張（突き合わせる書き手は居ない）は真のままで、**代役の指標だけが壊れた。**
 *
 * **説明を書くほど門が緑に近づく。**これは
 * `withoutComments`（散文をコードと読んだ）、hook の inline-python 判定（読みを書きと
 * 読んだ）に続く 3 例目だが、**前 2 つより悪い形**である。前 2 つは誤検出だったが、
 * これは「穴を誠実に記録する」という**正しい行いが、そのまま穴を消す**。
 * **これは「塞げない穴を固定する検査」全部に効く。**穴の説明はその穴の近くに書かれ、
 * 穴を数える検査は語の一致でその近くを見る。だから **数えるのはコードだけ**にし、
 * 散文は**別枠で上限を張って**見る（下の (2)）。直し方は「文言を変えて逃げる」ではない。
 * 文言を変えて緑にすると、次に書いた誰かの説明でまた赤くなり、そのたびに説明が削られる。
 *
 * ── 2026-08-21: 反転を実行した（書き手ができた）────────────────────
 *
 * 上に書いてあった反転 (1)(2) を実行した。**引き金は散文が追随したことではなく、
 * 書き手が作られたこと**である。`.claude/plugins/system-spec-harness/tests/
 * test_contract_prose_version_drift.py` が契約 md を開き、定数と機械で突き合わせる。
 * 散文は直していない（上の「なぜ散文を直して済ませないか」は今も有効）。
 * 直したのは **見張る側が居なかったこと** のほうである。
 *
 *   (1) 済: 「実行経路が 0 本」→「`WRITER_FLOOR` 本以上」へ。
 *       **ただし `expect(prose).not.toContain(constant)` は反転していない。**
 *       散文は今も `1.0` / `1.1` で、定数 `1.2` は入っていない。**部分反転である。**
 *       残り半分の反転先は下の⑤に書く。
 *   (2) 済: `MENTION_ONLY_CAP` を捨て、「契約 md をコードで開いているのは
 *       (1) が数える経路だけ」へ置き換えた。
 *
 * この日、`both` が 2 本になって赤くなったのは**代役の指標が壊れた 4 例目**だが、
 * 前 3 例と性質が違う。前 3 例（`withoutComments`／hook の inline-python 判定／
 * docstring が経路と数えられた件）は**誤検出**だった。今回は**主張のほうが偽になった**
 * ——本物の読み手ができたので、0 本という記述が事実でなくなった。
 * **代役が壊れたときと、主張が真でなくなったときを見分ける。**前者は数え方を直し、
 * 後者は反転させる。見分けを間違えて数え方を直すと、書き手が居るのに
 * 「居ない」と言い続ける門が残る。
 *
 * ── ⑤ 反転先（この先、塞がった日にすること）──────────────────────
 *
 * **散文が定数へ追随した日**、`expect(prose).not.toContain(constant)` を
 * `toContain` へ反転させる。あわせて `test_contract_prose_version_drift.py` の
 * `_PINNED_PROSE` 対比も「散文は定数と一致する」へ反転させる。
 * **片方だけ反転させると、もう片方が古い前提の門として残る。**
 *
 * 2026-08-21 実測（分母は各 it() 内に併記。node v22.21.1 / vitest 4.1.10）:
 * 定数 `1.2`（正本 2 箇所とも）/ 状態 JSON `1.2` / 散文 `{1.0, 1.1}`。
 * 分母＝harness 配下の `.py` **72 本**（2026-08-20 時点は 59 本。比較の基点はその日の記録）。
 * そのうち **コードで両語を含む 2 本**（`test_contract_prose_version_drift.py` と
 * `test_spec_transition_version_sections.py`）、**コードで契約 md 名を含む 2 本**（同じ 2 本）。
 * 2026-08-20 時点はどちらも 0 本だった。
 *
 * 判定式が効いていることは合成例 4 軸で確認済み（崩す前=緑／書き手を落とす=赤／
 * 定数名をコメントへ逃がした読み手を足す=赤／無関係なファイルを足す=緑のまま）。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripPythonComments } from "./helpers/strip-comments";

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

const CONSTANT_NAME = "CURRENT_STATE_SCHEMA_VERSION";
const CONTRACT_TOKEN = "spec-state-contract";

/**
 * 突き合わせ経路の床。2026-08-21 実測 2 本、遊び 1。**下げない**（下限は上げる方向にしか
 * 動かさない）。1 に置いているのは、2 本のうち
 * `test_spec_transition_version_sections.py` が**版ではなく loop_count の床**を
 * 突き合わせているからで、版そのものを見ているのは
 * `test_contract_prose_version_drift.py` の 1 本だけである。
 * 版の書き手が消された日に赤くなる位置に置く。
 */
const WRITER_FLOOR = 1;

/** 契約 md と定数を**コードで**同時に見ているファイル（＝突き合わせ経路）。 */
function codePaths(sources: { path: string; code: string }[]): string[] {
  return sources
    .filter((f) => f.code.includes(CONTRACT_TOKEN) && f.code.includes(CONSTANT_NAME))
    .map((f) => f.path)
    .sort();
}

/** harness 配下の .py を「素のテキスト」と「コメント・docstring を落としたコード」で持つ。 */
function harnessSources(): { path: string; text: string; code: string }[] {
  return pythonFiles(HARNESS).map((path) => {
    const text = readFileSync(path, "utf8");
    return { path: path.slice(ROOT.length + 1), text, code: stripPythonComments(text) };
  });
}

describe("schema 版の散文ずれ (REQ-TS16 / 見張る側を作ったあとの固定)", () => {
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

  it("散文と定数を突き合わせる**実行経路**が 1 本以上ある（2026-08-21 反転 (1)）", () => {
    const sources = harnessSources();
    expect(sources.length).toBeGreaterThanOrEqual(50); // 母集団の床

    // 陽性対照: 定数を**コードで**参照するファイルは在る（剥がしすぎていない）。
    expect(
      sources.filter((f) => f.code.includes(CONSTANT_NAME)).length,
    ).toBeGreaterThanOrEqual(1);

    // 反転後の本体: 両方を**コードで**同時に見ているファイルが在る。
    // 0 本へ戻った日＝書き手が消された日に赤くなる。
    expect(codePaths(sources).length).toBeGreaterThanOrEqual(WRITER_FLOOR);
  });

  /**
   * 反転 (2)。上限 `MENTION_ONLY_CAP` は**捨てた**。
   *
   * 真の書き手ができた以上、その周りの説明文（設計メモ・docstring）は自然に増える。
   * 上限を惰性で残すと **書き手を説明する文章が上限に当たって、書いた人が説明を削る**
   * ——2026-08-20 に起きたのと同じ壊れ方が、向きを変えて戻ってくる。
   *
   * 代わりに残すのは対で張ってあった側:
   * **契約 md をコードで名指ししているのは、上が数える経路だけであること。**
   * これが無いと、定数名をコメントへ逃がした「契約を読むだけのファイル」が
   * 門の外に生まれ、上の床は別のファイルで満たされてしまう。
   */
  it("契約 md をコードで開いているのは、突き合わせ経路だけ（2026-08-21 反転 (2)）", () => {
    const sources = harnessSources();
    expect(sources.length).toBeGreaterThanOrEqual(50); // 母集団の床

    const readers = sources
      .filter((f) => f.code.includes(CONTRACT_TOKEN))
      .map((f) => f.path)
      .sort();

    // 陽性対照: 読み手を数える側が動いていること。0 なら下の一致は
    // 「両方とも空」で成立してしまう。
    expect(readers.length).toBeGreaterThanOrEqual(WRITER_FLOOR);
    expect(readers).toEqual(codePaths(sources));
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
