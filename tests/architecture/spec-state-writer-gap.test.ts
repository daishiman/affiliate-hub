/** @tier 1 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 正本 `system-spec/spec-state.json` を保守できる writer が、この作業場所に**在る**。
 *
 * ── この検査は反転した（2026-08-20） ──────────────────────────────
 *
 * 元はこの逆、「**保守できる writer が無い**」を緑で固定する検査だった。
 * 塞げていない事実を本文に書くと、塞がった日にもその一文は古く見えないまま残る。
 * だから検査として置き、**書けるようになった日に赤くなる**ようにしてあった。
 *
 * その日が来たので、向きを反転させて残す。**消していない。**
 * 元の検査が「無いこと」を主張していた 2 点は、いまは「在ること」を主張する:
 *
 *   - writer が宣言する版が正本の版と**一致する**（元: 食い違っている）
 *   - 1.2 固有節を書くコードが writer に**在る**（元: 1 行も無い）
 *   - 版の定数が**読まれている**（元: 定義されるだけで 1 度も読まれない）
 *
 * 消さずに反転させる理由は、**塞がったものは戻りうる**からである。消せば、
 * 誰かが版の門を 1.1 へ戻した日も、節を書く行を削った日も、静かに通る。
 * 反転して残せば、その日にここが赤くなる。検査の値打ちは「今日直ったこと」ではなく
 * 「明日戻ったら気づけること」にある。
 *
 * ── 何が直ったか（2026-08-20 / commit 5534f4c 系列） ─────────────────
 *
 * 正本は最初のコミットからずっと `schema_version: 1.2` だったが、repo の writer は
 * 1.1 を current と宣言し、exact 一致でないものを「legacy 読み取り専用」として
 * 全 transition を拒否していた。**この writer はこの正本に対して一度も動かなかった。**
 * そのため実際の更新は、repo の外にあるキャッシュ側 install の
 * 「`schema_version` を検査しない writer」で行われていた。門を通したのではなく、
 * 門が無い writer で書いていた。
 *
 * 直し方は「版の門を 1.2 へ広げる」だけにしていない。門を広げるだけなら、
 * 中身の無い 1.2 も通ってしまう。schema 側に「1.2 を名乗るなら 4 節を required」
 * の分岐を足し、writer 側に「読んだときに在った節が書き戻しで落ちていないこと」の
 * 照合を足してある。**門を開けた分だけ、黙って壊れる余地も同時に塞いである。**
 *
 * 正本を 1.1 へ落として repo の writer に合わせる道は取らなかった。
 * 1.2 固有の 4 節を捨てることになる——器に合わせて中身を削る行為だからである。
 */

const ROOT = process.cwd();
const STATE = join(ROOT, "system-spec/spec-state.json");
const WRITER_DIR = join(
  ROOT,
  ".claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts",
);

/**
 * 収集マトリクスの gate。**版を見るようになったことを、ここで固定する。**
 *
 * この gate は正本と同じ名前の定数 `CURRENT_STATE_SCHEMA_VERSION` を持っているが、
 * かつては**同じファイルの中で 1 度も読まれていなかった。**`1.2` の正本を食わせても
 * exit 0 になり、6 つの gate が緑だったうちの 1 つは「合格した」ではなく
 * 「その軸を見ていない」だった。いまは読まれている。
 */
const MATRIX_GATE = ".claude/plugins/system-spec-harness/scripts/validate-coverage-matrix.py";

/** その名前が何回現れるか。定義だけなら 1、読んでいる場所があれば 2 以上。 */
function countMentions(text: string): number {
  return [...text.matchAll(/CURRENT_STATE_SCHEMA_VERSION/g)].length;
}

/** 1.2 で増えた節。かつては writer 側に当てどころが 1 つも無かった。 */
const VERSIONED_SECTIONS = [
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

describe("正本を保守できる writer が在る (塞がったことの固定)", () => {
  it("正本の版と、この repo の writer が宣言する版が一致している", () => {
    const state = JSON.parse(readFileSync(STATE, "utf8")) as { schema_version: string };
    // **数える対象そのものの床。**writer のフォルダが空になっても
    // 「見つからない」は静かに通る。床が無いと、writer が消えた日に黙る。下げない。
    expect(sources.length, "writer の .py が見つかりません。走査先が変わっていないか確かめてください").toBeGreaterThanOrEqual(5);

    const declared = sources
      .flatMap((s) => [...s.text.matchAll(/CURRENT_STATE_SCHEMA_VERSION\s*=\s*"([^"]+)"/g)])
      .map((m) => m[1]);

    expect(declared, "版の宣言が writer から見つかりません").not.toStrictEqual([]);
    // 食い違った日が「書けなくなった日」。そのときここが赤くなる。
    expect(
      declared,
      `正本は ${state.schema_version}、writer の宣言は ${declared.join(" / ")}。` +
        "食い違ったなら、正本がまた writer から触れなくなっています",
    ).toContain(state.schema_version);
  });

  /**
   * **ここは半分だけ反転した。**元は「1.2 固有節を書くコードが 1 行も無い」だった。
   * いまは writer がこの 3 節を**名前として知っており、生成し、落とさない**。
   * しかし**節ごとの編集口はまだ 1 つも無い**（下の it で、その欠落は元の向きのまま固定する）。
   *
   * 両方を「書ける」の一語で束ねると、片方が済んだだけで全部済んだように見える。
   * だから分けてある。反転できたのは、通せる・保てるところまでである。
   */
  it("1.2 で増えた節を、writer が名前として知っていて生成する", () => {
    // **数える対象そのものの床。**走査対象が 0 件でも下は空になる。
    // 0 は「無い」ときと「何も見ていない」ときの両方で出る。下げない。
    expect(sources.length, "writer の .py が見つかりません。走査先が変わっていないか確かめてください").toBeGreaterThanOrEqual(5);

    const known = VERSIONED_SECTIONS.filter((section) =>
      sources.some((s) => new RegExp(`^\\s*"${section}",\\s*$`, "m").test(s.text)),
    );
    expect(
      [...known].sort(),
      "1.2 固有節の登録簿が writer から消えています。版だけ 1.2 を名乗る state を作れる形へ戻っていないか確かめてください",
    ).toStrictEqual([...VERSIONED_SECTIONS].sort());

    const created = VERSIONED_SECTIONS.filter((section) =>
      sources.some((s) => new RegExp(`"${section}":\\s*(\\{\\}|\\[\\])`).test(s.text)),
    );
    expect(
      [...created].sort(),
      "bootstrap が 1.2 固有節を生成しなくなっています。中身の無い 1.2 を作れる形へ戻っています",
    ).toStrictEqual([...VERSIONED_SECTIONS].sort());
  });

  /**
   * **ここは元の向きのまま。塞がっていないからである。**
   *
   * 節ごとの編集口（`set-lifecycle` のような transition）は 1 つも無い。
   * 2026-08-20 に実測: 4 節それぞれについて、writer 内の登場箇所は
   * 登録簿の 1 行と bootstrap の 1 行だけで、代入・`setdefault`・`pop` は 0 件。
   * つまりいまの writer は 3 節を**通せる・保てる**が、**更新はできない**。
   *
   * 編集口ができた日にここが赤くなる。そのとき、この it も反転させて残すこと。
   */
  it("節ごとの編集口は、まだ writer に無い", () => {
    expect(sources.length, "writer の .py が見つかりません。走査先が変わっていないか確かめてください").toBeGreaterThanOrEqual(5);

    const editors: string[] = [];
    for (const section of VERSIONED_SECTIONS) {
      for (const s of sources) {
        // 生成時の dict リテラルと区別する。代入・setdefault・pop なら「更新できる」。
        const writes = new RegExp(
          `(\\[\\s*"${section}"\\s*\\]\\s*=|setdefault\\(\\s*"${section}"|pop\\(\\s*"${section}")`,
        );
        if (writes.test(s.text)) editors.push(`${s.path}: ${section}`);
      }
    }
    expect(
      editors,
      `${editors.join("\n")}\n編集口ができています。この it を反転させて残してください`,
    ).toStrictEqual([]);
  });

  /**
   * --- この 2 件が赤くなったときの読み方（意味が 2 通りある） ---
   *
   *   (1) **塞がったものが戻った** — 版の門が 1.1 へ戻された、節を書く行が消えた。
   *       直すべき退行である。
   *   (2) **ファイルが消えた・場所が変わった** — キット更新で入れ替わった。
   *       退行ではない。走査先を直すか、見張れなくなった事実を書き残す。
   *
   * **どちらでも赤くなるのが正しい。**赤は「直せ」ではなく「世界が変わったから見に来い」
   * である。区別が付くように分けてある——(2) なら下の「在る」が先に落ちる。
   */
  it("版を見る gate のファイルが、まだそこに在る", () => {
    expect(
      existsSync(join(ROOT, MATRIX_GATE)),
      `${MATRIX_GATE} が見つかりません。退行ではなく、見張る先が動いた可能性があります`,
    ).toBe(true);
  });

  it("版の定数は、定義されるだけでなく実際に読まれている", () => {
    const text = readFileSync(join(ROOT, MATRIX_GATE), "utf8");
    const hits = countMentions(text);
    // 1 = 定義行だけ（誰も読んでいない）＝ 元の欠陥へ戻った形。0 は定義ごと消えた形。
    // どちらも「版を見ていない」ので落とす。
    expect(
      hits,
      `${MATRIX_GATE} に現れる回数が ${hits} です。` +
        "2 以上なら読まれています。1 なら定義だけに戻っており、版を見ない gate へ退行しています。" +
        "0 なら定義ごと消えています",
    ).toBeGreaterThanOrEqual(2);
  });

  /**
   * --- 数える側が動いていることの陽性対照 ---
   *
   * 上の「読まれている」は **2 以上を主張する検査**である。数え方が壊れて常に
   * 大きい数を返しても同じ緑が出る。だから 2 以外を作れることをここで示す。
   * 見張り先（`.claude/plugins/` 配下＝キット配布物）は測定のために書き換えないので、
   * **合成見本で数える側だけを動かす。**
   */
  it("定義だけの見本では、数が 1 になる", () => {
    const sample = 'CURRENT_STATE_SCHEMA_VERSION = "1.2"\nprint("unrelated")\n';
    expect(countMentions(sample), "読む行が無い見本で 1 にならないなら、数え方が壊れています").toBe(1);
  });

  it("読み始めた形の見本では、数が 2 になる", () => {
    const sample = 'CURRENT_STATE_SCHEMA_VERSION = "1.2"\nif v != CURRENT_STATE_SCHEMA_VERSION:\n';
    expect(countMentions(sample), "読む行を足しても数が動かないなら、数え方が壊れています").toBe(2);
  });

  it("定義ごと消えた形の見本では、数が 0 になる", () => {
    const sample = 'STATE_SCHEMA = "1.2"\nprint(STATE_SCHEMA)\n';
    expect(countMentions(sample), "定義が無い見本で 0 にならないなら、数え方が壊れています").toBe(0);
  });

  it("正本の 1.2 固有節が、実際に中身を持っている", () => {
    // 中身が消えていたら、それは誰かが器に合わせて削った跡なので赤くする。
    // writer が書けるようになったいまも、この床は下げない——書けることと
    // 削られないことは別の話である。
    const state = JSON.parse(readFileSync(STATE, "utf8")) as Record<string, unknown>;
    for (const section of VERSIONED_SECTIONS) {
      const value = state[section];
      const size = Array.isArray(value) ? value.length : Object.keys(value ?? {}).length;
      expect(size, `${section} が空です。削られていないか確かめてください`).toBeGreaterThan(0);
    }
  });
});
