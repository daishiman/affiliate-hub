/**
 * @tier 1
 * @req REQ-TS18
 * @types regression, boundary, equivalence
 *
 * 「文書にこう書いてある」という封が、本当に文書を見ているかを見る。
 *
 * --- 何が起きていたか（実測、2026-08-21）---
 *
 * `qa_log[].source.sha256` は `sha256(answer)`、つまり **answer 自身の指紋**である。
 * answer から作る値なので、answer を何に書き換えても取り直せば一致する。
 * **文書を 1 度も読んでいない。**その結果、次の 2 つが同時に起きても緑のままだった:
 *
 * - 表の行から**末尾の列が落ちる**（引用が要件を狭める）
 * - 文書に無い文が**足される**（引用が要件を広げる）
 *
 * 直したのは書く側（`reseal-written-source` writer が、封をする前に回答の全行を
 * 文書へ逐語照合する）と読む側（`validate-coverage-matrix.py` の封の突き合わせ）。
 *
 * --- なぜ ② の形なのか ---
 *
 * **原因は残っている。**確定セルが引く entry のうち 9 件は、まだ引用ではなく要約で
 * 書かれていて、逐語照合を通らない。だから「全件逐語」を今日の門にはできない。
 * 代わりに**残っている件数に上限を張り、下げる方向にしか動かさない。**
 *
 * **⑤ 反転先（塞がった日にここを消さないこと）**: この上限が 0 に達したら、
 * 消さずに「`written-requirements` entry は全件、回答の非空行が文書に逐語で在る」
 * という下限へ**向きを反転させて残す。**塞がったものが再び開く道は、塞がる前から
 * 在る（要約で書き直せば、いつでも 9 件へ戻せる）。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SPEC = join(ROOT, "system-spec/spec-state.json");

type Qa = {
  id?: string;
  answer?: string;
  source?: { kind?: string; path?: string; sha256?: string };
};

function qaLog(): Qa[] {
  return (JSON.parse(readFileSync(SPEC, "utf8")) as { qa_log?: Qa[] }).qa_log ?? [];
}

/**
 * 文書を「論理行」へ畳む。**字下げの続き行を前の行へ繋ぎ直す。**
 *
 * markdown の箇条は 1 項目が複数の物理行へ折り返される。畳まずに突き合わせると
 * **項目の 1 行目しか一致せず、残りを落とした引用が「文書どおり」に見える。**
 * 日本語には語間の空白が無いので、繋ぐときに区切りを入れない。
 * （writer 側の `logical_document_lines` と同じ規則。片方だけ変えると割れる。）
 */
function logicalLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const stripped = raw.trim();
    if (!stripped) continue;
    if (out.length > 0 && /^\s/.test(raw)) {
      out[out.length - 1] += stripped;
      continue;
    }
    out.push(stripped);
  }
  return out;
}

/** 回答の非空行のうち、文書の論理行に**完全一致で**無いもの。 */
function unquotedLines(answer: string, document: string): string[] {
  const quoted = new Set(logicalLines(document));
  return logicalLines(answer).filter((line) => !quoted.has(line));
}

function writtenEntries(): Qa[] {
  return qaLog().filter((qa) => qa.source?.kind === "written-requirements" && qa.source?.path);
}

function notVerbatim(): string[] {
  const broken: string[] = [];
  for (const qa of writtenEntries()) {
    let document: string;
    try {
      document = readFileSync(join(ROOT, qa.source!.path!), "utf8");
    } catch {
      broken.push(`${qa.id}: source.path が読めない`);
      continue;
    }
    if (unquotedLines(qa.answer ?? "", document).length > 0) broken.push(qa.id ?? "(id なし)");
  }
  return broken;
}

/**
 * まだ引用になっていない entry の**上限**。2026-08-21 実測 **9**
 * （`node` / 単位は qa_log entry / 分母は `source.kind=written-requirements` かつ
 * `source.path` を持つ 23 件 / 基点は同日の修復前 14 件）。
 * **下げる方向にしか動かさない。**
 */
const NOT_VERBATIM_MAX = 9;
/**
 * 分母の**下限**。上限だけでは抜けられる——`written-requirements` を名乗る entry を
 * 減らせば、逐語でない件数も一緒に減る。向きが逆のこの床と対にして初めて門になる。
 */
const WRITTEN_ENTRY_MIN = 23;

describe("文書を根拠と名乗る回答が、本当にその文書の文であること", () => {
  it(`written-requirements entry が ${WRITTEN_ENTRY_MIN} 件以上ある（分母の床）`, () => {
    // これが無いと、下の上限は「引用が直った」ときにも
    // 「entry を対話由来へ付け替えて数から外した」ときにも同じ緑で満たせる。
    expect(
      writtenEntries().length,
      "written-requirements entry が減っています。数える対象の側を先に疑うこと",
    ).toBeGreaterThanOrEqual(WRITTEN_ENTRY_MIN);
  });

  it(`引用になっていない entry は ${NOT_VERBATIM_MAX} 件以下`, () => {
    // **向きは ② である。**固定しているのは違反している状態そのもので、
    // 0 に達した日にここが赤くなる。そのとき消さず、doc comment の⑤に書いた
    // 「全件逐語」の下限へ反転させて残すこと。
    const broken = notVerbatim();
    expect(broken.length, `逐語でない entry: ${broken.join(", ")}`).toBeLessThanOrEqual(
      NOT_VERBATIM_MAX,
    );
  });

  it("封（source.sha256）は全件、本文と一致している", () => {
    // こちらは ① ではなく**達成済みの下限**。2026-08-21 の回帰
    // （束ね解除で本文を縮めたのに封を取り直さず 6 件が不一致）が戻った日に赤くなる。
    const mismatched = writtenEntries()
      .filter((qa) => qa.source?.sha256)
      .filter((qa) => sha256(qa.answer ?? "") !== qa.source!.sha256)
      .map((qa) => qa.id);
    expect(mismatched).toStrictEqual([]);
  });

  it("逐語かどうかを見る側が、両方向に動いている", () => {
    // 上の「9 件以下」と「0 件」は、**見る側が何も見つけない**ときにも同じ形で満たせる。
    // 通る例と止まる例を並べて、検出側が動いていることを示す。
    const doc = "| 段 | 誰が | 落ちたら | 中身 |\n- **X-01**: 前半、\n  後半。\n";
    expect(unquotedLines("| 段 | 誰が | 落ちたら | 中身 |", doc)).toStrictEqual([]);
    // 折り返しを畳んだ形なら通る
    expect(unquotedLines("- **X-01**: 前半、後半。", doc)).toStrictEqual([]);
    // **末尾の列を削った行は通さない**（元の行の前方一致部分なので、部分一致で見ると通る）
    expect(unquotedLines("| 段 | 誰が | 落ちたら |", doc)).toStrictEqual(["| 段 | 誰が | 落ちたら |"]);
    // 文書に無い文を足した行も通さない
    expect(unquotedLines("- **X-01**: 前半、後半。隠さない。", doc)).toHaveLength(1);
  });
});

function sha256(text: string): string {
  // node:crypto を使う。テスト側で digest を作り直せてしまうが、それは
  // `generated-doc` と同じ塞げない穴で、鍵を AI が読めない場所へ置けない限り閉じない。
  // ここで見ているのは「writer が取り直し忘れた」回帰であって、偽造ではない。
  return createHash("sha256").update(text, "utf8").digest("hex");
}
