/**
 * @tier 1
 * @req REQ-TS18
 * @types regression, equivalence, boundary
 *
 * **`contract` を名乗っていたが外した**（2026-08-19）。`contract` は
 * 「API 契約（3 入口）」であり、この検査は画面・REST・WebMCP のどれも通っていない。
 * 見ているのは python のコンパイラ 1 本である。要件の側も
 * `has-known-breakage, has-input` だけで `contract` を求めていない。
 * **満たしていない種別の名前を借りない。**外して、飾りが付いていた事実をここに残す。
 *
 * 章のコード塊が本文を飲み込む壊れを、**生成物ではなく生成側**で見る。
 *
 * --- 何が起きたか（実測、2026-08-19）---
 *
 * C03（`compile-spec-doc.py`）を再生成すると、`backend.md` で
 * **見出し 28 個・192 行**が 1 つのコード塊に飲まれた。原因は正本側にある:
 * `spec-state.json` の `qa_log[].answer` に、**開きフェンスを失った閉じフェンス**が
 * 混ざっている。図（ASCII の層構造）を貼るときに開きだけが落ちた形である。
 * コンパイラはこれを本文へそのまま実体描画するので、**1 つの欄の壊れが章全体へ広がる。**
 *
 * --- なぜ ③（戻ったら赤）の形なのか ---
 *
 * 直したのは**コンパイラの側**（`seal_code_fences` で answer の境目で閉じる）で、
 * **原因である正本の欠落フェンスは残っている。**③ に名前を足す 2 条件が揃っている:
 * (a) 実際に壊れた事実を見た (b) 直したが原因が残っている。
 *
 * --- キット配布物を直したことについて ---
 *
 * `spec_docset_chapters.py` はキット配布物で、**次回のキット更新で上書きされる。**
 * 上書きされたらこの検査が赤くなる。追跡下なので `git status` にも出るが、
 * **静かに戻らないようにするのが、この検査を生成側に向けている理由**である
 * （残課題 102・㉔）。上流へ返す手立ては別途。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const LIB = join(ROOT, ".claude/plugins/system-spec-harness/lib/spec_docset_chapters.py");
const SPEC = join(ROOT, "system-spec/spec-state.json");

/** 開いたまま終わっているか。**本数の偶奇では判定しない**（REQ-TS11 と同じ理由）。 */
function fenceCount(text: string): number {
  return (text.match(/^```/gm) ?? []).length;
}

type Qa = { qa_id?: string; id?: string; answer?: string };

function qaLog(): Qa[] {
  const spec = JSON.parse(readFileSync(SPEC, "utf8")) as { qa_log?: Qa[] };
  return spec.qa_log ?? [];
}

/**
 * 正本側の壊れ。**いま残っている件数を固定し、直った日に赤くなる。**
 *
 * 2026-08-21: 2 → **1**。減ったのは直したからではなく、`split-qa-bundle` が
 * `qa-backend-web-spec-intake` へ寄せてあった**写しの節**を取り込み元へ戻したためで、
 * 同じ壊れが 2 箇所に見えていたのが 1 箇所になった。壊れそのもの
 * （`qa-backend-web-analytics` の閉じていないフェンス）は**まだ在る**。
 * 「件数が減った」を「直った」と読むと、写しを消すだけで緑にできる道が開く。
 */
const UNBALANCED_ANSWERS = 1;
/** 母集団の床。0 件は「壊れが消えた」でも「qa_log を読めていない」でも出る（残課題 78 ㉗）。 */
const QA_LOG_FLOOR = 20;

describe("章のコード塊が本文を飲み込む壊れを、生成側で見る", () => {
  it("qa_log を実際に読めている（母集団の床）", () => {
    // これが無いと、下の「2 件」は読めていないときにも 0 件として同じ形で崩れる。
    expect(qaLog().length, "qa_log が読めていません。数える対象の側を先に疑うこと").toBeGreaterThanOrEqual(
      QA_LOG_FLOOR,
    );
  });

  it(`正本の回答に、閉じていないコードフェンスが ${UNBALANCED_ANSWERS} 件残っている`, () => {
    // **向きは ② である。**固定しているのは違反している状態そのもので、
    // 正本が直った日にここが赤くなる。そのとき消さず「0 件」へ反転させて残すこと
    // （残課題 78 ⑤。塞がったものが再び開く道は、塞がる前から在る）。
    const broken = qaLog()
      .filter((qa) => fenceCount(qa.answer ?? "") % 2 === 1)
      .map((qa) => qa.qa_id ?? qa.id ?? "(id なし)");
    // 完全一致で押さえる。件数だけだと、別の entry が壊れて 1 件のまま入れ替わっても通る。
    expect(broken.sort()).toStrictEqual(["qa-backend-web-analytics"]);
    expect(broken.length).toBe(UNBALANCED_ANSWERS);
  });

  it("フェンスの数え方が両方向に効いている（通る例と止まる例）", () => {
    // 0 本・1 本・2 本の境目を両方向から見る。これが無いと上の 2 件は
    // 「壊れているから 2 件」なのか「数える側が常にそう答える」のか区別できない。
    expect(fenceCount("ふつうの文\nもう 1 行")).toBe(0);
    expect(fenceCount("図\n```")).toBe(1);
    expect(fenceCount("```text\n図\n```")).toBe(2);
    expect(fenceCount("行中の ``` は数えない")).toBe(0);
  });

  it("コンパイラに、回答の境目でフェンスを閉じる関数がある", () => {
    const py = readFileSync(LIB, "utf8");
    expect(py, "seal_code_fences が消えています（キット更新で上書きされた可能性）").toContain(
      "def seal_code_fences(",
    );
  });

  it("回答を本文へ描く経路が 2 つとも、その関数を通っている", () => {
    // **片方だけ塞ぐと、同じ壊れがもう片方から章へ漏れる。**実際に起きた:
    // `render_confirmed_qa` だけ塞いだ時点では、`本章での適用` 側から漏れて
    // 飲まれた見出しが 3 個残っていた（28 → 3 → 2）。
    const py = readFileSync(LIB, "utf8");
    // **母集団の床**（残課題 78 ㉗）。下の `raw` の 0 件は、
    // 「生埋めが無い」ときにも「ファイルが差し替わって空同然になった」ときにも出る。
    // キット更新でスタブへ置き換わった日に、0 件を緑と読まないための床である。
    expect(py.split("\n").length, "コンパイラ本体が短すぎます。読んでいる先を疑うこと").toBeGreaterThan(
      300,
    );
    const renders = [...py.matchAll(/^\s*(?:lines\.append\(f?"|\s+f")[^\n]*\{answer\}/gm)];
    expect(renders.length, "answer を本文へ描く経路が 2 つ見つかりません").toBe(2);
    // 生の `qa.get("answer"...)` を本文へ直接埋める書き方が残っていないこと。
    const raw = [...py.matchAll(/\{qa\.get\('answer'/g)];
    expect(raw.map((m) => m.index), "seal を通さずに answer を埋めている箇所があります").toStrictEqual(
      [],
    );
  });
});
