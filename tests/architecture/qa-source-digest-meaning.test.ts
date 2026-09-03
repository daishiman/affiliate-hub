/** @tier 1 @req REQ-TS20 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * @types boundary, equivalence
 *
 * **名乗りには根拠を書く**（`form2-population-floor.test.ts` の教訓——根拠の無い名乗りは飾りである）。
 *
 * `boundary` の根拠は、境目そのものを当てどころにしていること:
 * 母集団の床 23 件、文書の数の上限 9、`指紋の数 > 文書の数` という不等号、
 * および陽性対照で digest の生成と比較を探す窓 5 行。**どれも 1 動けば判定が変わる値**である。
 *
 * `equivalence` の根拠は、`source.kind` で `written-requirements` と `user-dialogue` の
 * 2 群に割り、**群ごとに欄の有無が全件揃うことを両方向から**見ていること。
 * 群分けの網羅は `written.length + dialogue.length === qaLog.length` で確かめている
 * ——3 つ目の種別が増えたら、この等式が先に赤くなる。
 *
 * ── 以下、この要件が何を固定しているか ────────────────────────────
 *
 * `qa_log[].source.sha256` は **answer 本文の指紋**であって、**出典文書の指紋ではない**。
 *
 * ── なぜ検査にするのか（塞ぐ要件ではない） ──────────────────────────
 *
 * 欄の名前は `source.sha256` である。読んだ人は素直に「出典の指紋」と受け取る。
 * 実際に入っているのは `sha256(answer)`——**その entry が自分で書いた文章の指紋**である。
 * 自分で書いた文字列から作る値なので、**書き換えれば指紋も一緒に動く**。
 * 引用が原典からずれていっても、この値は永遠に一致し続ける。
 * つまりこの欄は、名前が約束していることを**一度も果たしていない**。
 *
 * これは文章では直せない。契約の側に「出典文書の指紋」を持つ欄が無いからである。
 * だから `REQ-TS13` / `REQ-TS14` と同じ扱いにする——
 * **塞げていないことを、数で固定する。**塞がった日にここが赤くなる。
 *
 * ── 何を当てどころにするか ───────────────────────────────────
 *
 * 「answer の指紋である」ことを、一致の側からだけ示すと弱い。
 * `sha256(answer)` と一致することは、それが同時に文書の指紋でもある可能性を消さない
 * （文書＝answer という退化した場合が残る）。そこで**両側から**当てる:
 *
 *   ① `source.sha256 === sha256(answer)` が written 23 件すべてで成り立つ
 *   ② `source.sha256 !== sha256(引用先ファイルの中身)` が同じ 23 件すべてで成り立つ
 *   ③ **9 つの文書に対して 23 通りの指紋がある。**文書の指紋なら 9 通りにしかならない。
 *
 * ③ が一番強い。①② は「たまたま全部ずれている」で説明が付くが、
 * **1 つの文書が 11 通りの指紋を持つことは、文書の指紋では原理的に起こらない。**
 * 数え方の問題ではなく、この値が指しているものが違う、ということの証明になる。
 *
 * ── 「0 件である」の母集団 ────────────────────────────────────
 *
 * `REQ-TS17` のとおり、0 件の主張には母集団の床を同居させる。
 * 対象が 0 件なら「不一致 0 件」も「文書の指紋でない 23 件」も自動で真になり、
 * 壊しようのない緑になる。だから件数のほうにも床を置く。
 *
 * ── 2026-08-19 からの差分（`ah-84i` 起票時の 4 つの数） ─────────────────
 *
 * 起票時の実測は「一致 23 / 欄なし 6 / 不一致 0 / この値を読んで判定するコード 0 件」。
 * 2026-08-28 の再実測で 2 つ動いている:
 *
 *   - 欄なし 6 → **19**。qa_log が 29 件から 42 件へ増え、増えたぶんは全て
 *     `user-dialogue`（口頭の回答なので引用先の文書が無く、欄を持たない）だった。
 *   - 読んで判定するコード 0 件 → **在る**。`validate-coverage-matrix.py` と
 *     `foundation_provenance.py` が `sha256(answer)` との一致を検査している。
 *     読まれるようになったので、下の陽性対照で「読む側が居ること」を固定する。
 *
 * **欄なしの数を等号で固定していない**のはこのためである。この数は
 * 「対話で聞いた論点が増えた」というだけで動く。増えるのを止める理由が無い。
 */

const ROOT = process.cwd();

type QaSource = {
  readonly kind?: string;
  readonly path?: string;
  readonly section?: string;
  readonly sha256?: string;
};
type QaEntry = { readonly id: string; readonly answer?: string; readonly source?: QaSource };

const qaLog: readonly QaEntry[] = JSON.parse(
  readFileSync(join(ROOT, "system-spec/spec-state.json"), "utf-8"),
).qa_log;

const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

/** 書面由来（引用先の文書がある）。この群だけが `sha256` の欄を持つ。 */
const written = qaLog.filter((q) => q.source?.kind === "written-requirements");
/** 対話由来（引用先の文書が無い）。 */
const dialogue = qaLog.filter((q) => q.source?.kind === "user-dialogue");

describe("qa_log の source.sha256 が指しているもの (REQ-TS20 / 塞げない穴の固定)", () => {
  it("母集団の床 — 書面由来が 23 件以上ある（ここが 0 なら下の主張は全て空振り）", () => {
    expect(written.length).toBeGreaterThanOrEqual(23);
  });

  it("欄を持つのは書面由来だけ、書面由来は全て欄を持つ（両方向）", () => {
    // 「欄なし」の件数は対話の増加でいくらでも動くので、数ではなく対応関係を固定する。
    const withDigest = qaLog.filter((q) => typeof q.source?.sha256 === "string");
    expect([...withDigest].map((q) => q.id).sort()).toEqual([...written].map((q) => q.id).sort());
    expect(dialogue.every((q) => q.source?.sha256 === undefined)).toBe(true);
    // 種別は 2 つしかない。3 つ目が増えたらこの対応は張り直しが要る。
    expect(written.length + dialogue.length).toBe(qaLog.length);
  });

  it("① 全ての書面由来で source.sha256 === sha256(answer) である（不一致 0 件）", () => {
    const mismatched = written.filter((q) => sha256(q.answer ?? "") !== q.source?.sha256);
    expect(mismatched.map((q) => q.id)).toEqual([]);
  });

  it("② 引用先ファイルは 23 件とも実在する（②③ が『開けなかっただけ』にならない床）", () => {
    const missing = written.filter((q) => !q.source?.path || !existsSync(join(ROOT, q.source.path)));
    expect(missing.map((q) => q.id)).toEqual([]);
  });

  it("② source.sha256 は引用先ファイルの指紋と 1 件も一致しない（＝文書の指紋ではない）", () => {
    // 床を同じ it に置く。ファイルを開けなくなった日も「一致 0 件」は真になり、
    // 「文書の指紋ではない」という主張だけが緑のまま残る（REQ-TS17 の形）。
    const fileDigests = written.map((q) => sha256(readFileSync(join(ROOT, q.source?.path as string))));
    expect(fileDigests.length, "引用先を 1 つも読めていない — 下の 0 件は空振りである").toBeGreaterThanOrEqual(23);

    const looksLikeFileDigest = written.filter((q, i) => q.source?.sha256 === fileDigests[i]);
    expect(looksLikeFileDigest.map((q) => q.id)).toEqual([]);
  });

  it("③ 文書の数より指紋の数のほうが多い（文書の指紋では原理的に起こらない）", () => {
    const paths = new Set(written.map((q) => q.source?.path));
    const digests = new Set(written.map((q) => q.source?.sha256));
    // 1 文書 : n 指紋。ここが 1:1 に近づいた日は、欄の意味が変わった日である。
    expect(digests.size).toBeGreaterThan(paths.size);
    expect(paths.size).toBeLessThanOrEqual(9);
  });

  it("陽性対照 — この値を読んで判定するコードが在る（2026-08-19 の『0 件』から変わった）", () => {
    // 読む側が居なくなると、①②③ が全部緑のまま欄だけが腐る。
    const readers = [
      ".claude/plugins/system-spec-harness/scripts/validate-coverage-matrix.py",
      ".claude/plugins/system-spec-harness/scripts/foundation_provenance.py",
    ];
    // 当てどころは「sha256 という語が在る」ではない（それでは注釈でも通る）。
    // **answer を材料に digest を作っている 1 文**が在ることを見る。
    const hashesTheAnswer = /hashlib\.sha256\([^\n]*answer[^\n]*\.encode\("utf-8"\)\)\.hexdigest\(\)/;
    for (const reader of readers) {
      const body = readFileSync(join(ROOT, reader), "utf-8");
      expect(body, `${reader} が answer から digest を作る行を持たない`).toMatch(hashesTheAnswer);
      // 作るだけで比べていないなら、読んでいるとは言えない。
      // 判定は同じ行とは限らない（一方は変数へ束ねてから次行で比べている）ので、
      // 作った行から数行の窓で見る。窓を無制限にすると、無関係な比較を拾って緑になる。
      const lines = body.split("\n");
      const compares = lines.some(
        (line, i) =>
          hashesTheAnswer.test(line) &&
          lines.slice(i, i + 5).some((near) => /!=|==/.test(near)),
      );
      expect(compares, `${reader} は digest を作るが判定に使っていない`).toBe(true);
    }
  });

  it("この検査自身が測れていることの確認 — 1 件でも answer を書き換えれば ① は割れる", () => {
    const victim = written[0] as QaEntry;
    const tampered = { ...victim, answer: `${victim.answer ?? ""}!` };
    expect(sha256(tampered.answer ?? "")).not.toBe(victim.source?.sha256);
  });
});
