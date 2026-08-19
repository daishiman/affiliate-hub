/** @tier 1 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 正本 `system-spec/spec-state.json` を保守できる writer が、この作業場所に無い。
 *
 * **これは塞ぐ課題ではなく、塞げていないことを検査として固定する課題である。**
 * 本文に「保守できません」と書くだけだと、保守できるようになった日にも
 * その一文は古く見えないまま残る。ここに置けば、**書けるようになった日に赤くなる**。
 * 赤くなったら、この検査を消して、正しい writer で書き直す作業へ移る合図である。
 *
 * いま何が起きているか:
 *   - 正本は `schema_version: 1.2`。最初のコミットからずっと 1.2 である。
 *   - この repo に入っている writer は 1.1 を current と宣言し、
 *     exact 一致でないものを「legacy 読み取り専用」として全 transition を拒否する。
 *     つまり **この writer は、この正本に対して一度も動かない**。
 *   - 1.2 固有の 3 節（`delivery_dependencies` / `implementation_snapshot` /
 *     `review_runs`）を書くコードは、この repo の writer に 1 行も無い。
 *     読み書きの当てどころが無いので、版を上げても保守はできない。
 *
 * いまはどう書いているか（2026-08-19 時点):
 *   repo の外にあるキャッシュ側 install (system-spec-harness 0.1.2) の writer で書いている。
 *   これは state の `schema_version` を検査しない。**門を通したのではなく、
 *   門が無い writer で書いている。**既存の決定 6 件を書いたのもそれである。
 *   キャッシュ側は repo の外にあるので、この検査は見ていない（見ても、
 *   環境ごとに在ったり無かったりする場所を根拠にすると、検査の意味が場所で変わる）。
 *
 * 正本を 1.1 へ落として repo の writer に合わせる道は取らない。
 * 1.2 固有の 4 節を捨てることになる——器に合わせて中身を削る行為だからである。
 */

const ROOT = process.cwd();
const STATE = join(ROOT, "system-spec/spec-state.json");
const WRITER_DIR = join(
  ROOT,
  ".claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts",
);

/**
 * 収集マトリクスの gate。**版を見ていないことを、ここで固定する。**
 *
 * この gate は正本と同じ名前の定数 `CURRENT_STATE_SCHEMA_VERSION = "1.1"` を
 * 持っているが、**同じファイルの中で 1 度も読まれていない。**
 * つまり `1.2` の正本を食わせても exit 0 になる。
 * 6 つの gate が緑だったうちの 1 つは、「合格した」ではなく「その軸を見ていない」。
 */
const MATRIX_GATE = ".claude/plugins/system-spec-harness/scripts/validate-coverage-matrix.py";

/** その名前が何回現れるか。定義だけなら 1、読んでいる場所があれば 2 以上。 */
function countMentions(text: string): number {
  return [...text.matchAll(/CURRENT_STATE_SCHEMA_VERSION/g)].length;
}

/** 1.2 で増えた節のうち、writer 側に当てどころが 1 つも無いもの。 */
const UNMAINTAINED_SECTIONS = [
  "delivery_dependencies",
  "implementation_snapshot",
  "review_runs",
] as const;

function pythonSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__pycache__") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pythonSources(full, out);
    else if (full.endsWith(".py")) out.push(full);
  }
  return out;
}

const sources = pythonSources(WRITER_DIR).map((f) => ({
  path: relative(ROOT, f),
  text: readFileSync(f, "utf8"),
}));

describe("正本を保守できる writer が無い", () => {
  it("正本の版と、この repo の writer が宣言する版が食い違っている", () => {
    const state = JSON.parse(readFileSync(STATE, "utf8")) as { schema_version: string };
    // **数える対象そのものの床。**writer のフォルダが空になっても
    // 「食い違っている」は成立してしまう（見つからないので一致もしない）。
    // 床が無いと、writer が消えた日にこの検査は緑のまま黙る。下げない。
    expect(sources.length, "writer の .py が見つかりません。走査先が変わっていないか確かめてください").toBeGreaterThanOrEqual(5);

    const declared = sources
      .flatMap((s) => [...s.text.matchAll(/CURRENT_STATE_SCHEMA_VERSION\s*=\s*"([^"]+)"/g)])
      .map((m) => m[1]);

    expect(declared, "版の宣言が writer から見つかりません").not.toStrictEqual([]);
    // 一致した日が「書けるようになった日」。そのときここが赤くなる。
    expect(
      declared,
      `正本は ${state.schema_version}、writer の宣言は ${declared.join(" / ")}。` +
        "一致したなら、この検査ごと消して repo の writer で書き直してください",
    ).not.toContain(state.schema_version);
  });

  it("1.2 で増えた節を書くコードが、この repo の writer に 1 行も無い", () => {
    // 版の門だけを外しても保守にはならない。書く当てどころが無いままだからである。
    // どれか 1 つでも書けるようになったら、ここが赤くなる。
    //
    // **数える対象そのものの床。**2026-08-19 に node で実測した: 走査対象が 5 件でも
    // 0 件でも、下の `found` は同じ `[]` になる。**0 は「書く場所が無い」ときと
    // 「何も見ていない」ときの両方で出る。**床が無いと区別できない。下げない。
    expect(sources.length, "writer の .py が見つかりません。走査先が変わっていないか確かめてください").toBeGreaterThanOrEqual(5);

    const found: string[] = [];
    for (const section of UNMAINTAINED_SECTIONS) {
      for (const s of sources) {
        // 読むだけの参照と区別する。代入・setdefault・pop の対象になっていたら「書ける」。
        const writes = new RegExp(
          `(\\[\\s*"${section}"\\s*\\]\\s*=|setdefault\\(\\s*"${section}"|pop\\(\\s*"${section}")`,
        );
        if (writes.test(s.text)) found.push(`${s.path}: ${section}`);
      }
    }
    expect(
      found,
      `${found.join("\n")}\n書けるようになっています。この検査を消して、書き直しへ移ってください`,
    ).toStrictEqual([]);
  });

  /**
   * --- この 2 件が赤くなったときの読み方（意味が 2 通りある） ---
   *
   *   (1) **定数が読まれるようになった** — gate が版を見始めた。よいことである。
   *       そのときは、この 2 件を消して「gate は版を見ている」側の検査へ書き直す。
   *   (2) **ファイルが消えた・場所が変わった** — キット更新で入れ替わった。
   *       塞がったのではない。走査先を直すか、見張れなくなった事実を書き残す。
   *
   * **どちらでも赤くなるのが正しい。**赤は「直せ」ではなく「世界が変わったから見に来い」
   * である。区別が付くように、2 件を分けてある——(2) なら下の「在る」が先に落ちる。
   *
   * 見張る先がキット配布物であることは承知している。入れ替わったときに
   * 「塞がった」と読み違えないための書き分けが、上の 2 通りである。
   */
  it("版を見ない gate のファイルが、まだそこに在る", () => {
    expect(
      existsSync(join(ROOT, MATRIX_GATE)),
      `${MATRIX_GATE} が見つかりません。塞がったのではなく、見張る先が動いた可能性があります`,
    ).toBe(true);
  });

  it("版の定数は定義されるだけで、1 度も読まれていない", () => {
    const text = readFileSync(join(ROOT, MATRIX_GATE), "utf8");
    const hits = countMentions(text);
    // 1 = 定義行だけ。2 以上になったら、誰かが読み始めた＝(1) の赤である。
    // 0 は定義ごと消えた形で、これも「見張れなくなった」側なので落とす。
    expect(
      hits,
      `${MATRIX_GATE} に現れる回数が ${hits} です。` +
        "1 なら定義だけ（誰も読んでいない）。2 以上なら読まれ始めたので、この検査を書き直してください。" +
        "0 なら定義ごと消えています",
    ).toBe(1);
  });

  /**
   * --- 数える側が動いていることの陽性対照 ---
   *
   * 上の「1 度も読まれていない」は **1 を主張する検査**である。
   * 数え方が壊れて常に 1 を返しても、同じ緑が出る。だから 1 以外を作れることを
   * ここで示す。見張り先そのもの（`.claude/plugins/` 配下＝キット配布物）は
   * 測定のためにも書き換えない約束なので、**合成見本で数える側だけを動かす。**
   *
   * これは「壊して赤を見る」の代わりではない。壊せない場所を見張っているときの、
   * 数える側が生きていることの示し方である。
   */
  it("読み始めた形の見本では、数が 2 になる", () => {
    const sample = 'CURRENT_STATE_SCHEMA_VERSION = "1.1"\nif v != CURRENT_STATE_SCHEMA_VERSION:\n';
    expect(countMentions(sample), "読む行を足しても数が動かないなら、数え方が壊れています").toBe(2);
  });

  it("定義ごと消えた形の見本では、数が 0 になる", () => {
    const sample = 'STATE_SCHEMA = "1.1"\nprint(STATE_SCHEMA)\n';
    expect(countMentions(sample), "定義が無い見本で 0 にならないなら、数え方が壊れています").toBe(0);
  });

  it("正本には、いま保守できない節が実際に中身を持っている", () => {
    // 中身が空なら「保守できない」は困りごとにならない。困りごとであることを先に固定する。
    // 中身が消えていたら、それは誰かが器に合わせて削った跡なので、そのときも赤くする。
    const state = JSON.parse(readFileSync(STATE, "utf8")) as Record<string, unknown>;
    for (const section of UNMAINTAINED_SECTIONS) {
      const value = state[section];
      const size = Array.isArray(value) ? value.length : Object.keys(value ?? {}).length;
      expect(size, `${section} が空です。削られていないか確かめてください`).toBeGreaterThan(0);
    }
  });
});
