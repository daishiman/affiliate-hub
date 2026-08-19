/** @tier 1 */
import { readFileSync, readdirSync, statSync } from "node:fs";
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
