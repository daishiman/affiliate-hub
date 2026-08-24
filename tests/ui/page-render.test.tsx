/**
 * @tier 2
 * @req REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05
 * @req REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10
 * @req REQ-TH01, REQ-SEC08, REQ-TS05
 * @req REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06
 * @req REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12
 * @req REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18
 * @req REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05
 * @req REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10
 * @req REQ-FB07
 * @req REQ-IM09
 * @req REQ-TM02, REQ-TM03, REQ-TM05, REQ-TM06, REQ-TM10
 * @types screen-states, a11y
 */
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_CASES, ROUTE_STATE_CASES, renderCase } from "./route-table";
import { headingLevels, intoDom } from "../support/render";
import { describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 画面を全部描く。
 *
 * これを 1 枚ずつ手で書かないのは、書いた瞬間から
 * 「画面を足す作業」と「テストを足す作業」が別々になり、後者だけが忘れられるため。
 * 経路の表から総当たりにすると、**画面を足した時点で自動的に検査対象に入る**。
 *
 * 確かめるのは 3 つだけにしてある。
 * 文言そのものをここで固定すると、言い回しを直すたびに落ちるテストが 50 本増え、
 * やがて「文言を直したくないからテストを消す」に行き着く。
 *
 * --- 要件名が多い理由 ---
 * `route-table.ts` の表から総当たりにしているので、**読者側 20 本と運営側 33 本が
 * 全部ここで描かれている**。REQ-B01〜B18（読者側の各ページ）と REQ-S01〜S10
 * （§22 の画面仕様）は、その表の行として実際に描かれているぶんだけ名乗っている。
 * 画面を表から外せば、ここも一緒に落ちる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-4 / docs/product/coverage.md §2-3
 */

const APP_DIR = join(process.cwd(), "src/app");

function pageFilesOnDisk(): readonly string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") found.push(relative(APP_DIR, full));
    }
  };
  walk(APP_DIR);
  return found.sort();
}

/**
 * 見出しの作りを見る。
 *
 * h1 は「この画面は何か」を表す唯一の宣言で、目で見る人には
 * 大きい文字としてしか映らないが、読み上げでは現在地そのものになる。
 * 飛び級（h2 の次が h4）も同じで、**目では絶対に気づけない**。
 */
function expectHeadingStructure(html: string): void {
  const { document, cleanup } = intoDom(html);
  try {
    const levels = headingLevels(document);
    expect(
      levels.filter((l) => l === 1),
      "h1 はこの画面が何の画面かを表す。0 個でも 2 個でも読み上げが迷子になる",
    ).toHaveLength(1);
    let previous = 0;
    for (const level of levels) {
      if (previous !== 0) {
        expect(level, `見出しの階層が飛んでいます: ${levels.join(" → ")}`).toBeLessThanOrEqual(
          previous + 1,
        );
      }
      previous = level;
    }
  } finally {
    cleanup();
  }
}

describe("画面の一覧", () => {
  it("経路の表と実在するファイルが 1 対 1 で対応する", () => {
    // **母集団の床**（残課題 78 ㉗）。両側とも空なら「1 対 1」は自明に成り立つ。
    expect(pageFilesOnDisk().length, "画面のファイルを歩けていません").toBeGreaterThan(20);
    expect(ROUTE_CASES.length, "経路の表が空です").toBeGreaterThan(20);
    // 片方向（表 → ファイル）だけだと、新しい画面を足しても気づけない。
    // **足りない側と余っている側の両方**を出す。
    const onDisk = pageFilesOnDisk();
    const inTable = ROUTE_CASES.map((r) => r.file).sort();

    const missing = onDisk.filter((f) => !inTable.includes(f));
    const extra = inTable.filter((f) => !onDisk.includes(f));

    expect(
      missing,
      `画面はあるのに表に無いものがあります。tests/ui/route-table.ts に追加してください:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
    expect(
      extra,
      `表にあるのに画面が無いものがあります（消したか、経路を変えたはず）:\n  ${extra.join("\n  ")}`,
    ).toEqual([]);
  });

  it("同じ画面を二重に登録していない", () => {
    const files = ROUTE_CASES.map((r) => r.file);
    expect([...new Set(files)]).toHaveLength(files.length);
  });

  /**
   * **状態違いの表にも床が要る。**
   *
   * 下の `describe.each(ROUTE_STATE_CASES)` は、表が空になると
   * **1 件も作られずに消える**。テストが減ったことは緑の中では見えないので、
   * 「4 つの状態を見ている」という判定欄の主張が、静かに 0 件へ落ちうる形だった。
   * 実測（2026-08-21）: 画面 54 枚に対し、状態違いの登録は **12 通り**。
   *
   * **ここで測っていないもの（先に書く）**: 要件が言う「4 つの状態」を
   * **全画面ぶん**そろえているかは見ていない（そろっていない。54 枚 × 4 には遠い）。
   * 見ているのは「いま在る分が、黙って消えない」ことだけである。
   * 残りは `docs/product/backlog.md` に残課題として起こした。
   */
  it("状態違いの登録が黙って消えていない", () => {
    // **母集団の床**。空になれば下の describe.each ごと消え、緑のまま件数だけが減る。
    expect(
      ROUTE_STATE_CASES.length,
      "状態違いの登録が減っています。減らすなら判定欄の主張も直すこと",
    ).toBeGreaterThanOrEqual(15);

    /*
     * **`world` を持つ行にも床が要る。**
     *
     * `world` は URL では作れない前提（ログインしている／設定が済んでいる）を指す。
     * ここが 0 件へ落ちても、残りの行は描けるので**件数の床は素通りする**。
     * 落ちた瞬間に消えるのは「その枝を測っていた」という事実だけで、
     * 消えたことは緑の中からは見えない。だから種類のほうを別に数える。
     */
    expect(
      ROUTE_STATE_CASES.filter((r) => r.world !== undefined).length,
      "URL では作れない状態の登録が消えています（残課題 141）",
    ).toBeGreaterThanOrEqual(2);

    // 登録先のファイルが実在すること。消えた画面の状態を数え続けないため。
    const missing = ROUTE_STATE_CASES.filter((r) => !existsSync(join(APP_DIR, r.file))).map(
      (r) => `${r.file}（${r.state}）`,
    );
    expect(missing, "状態違いの登録が、実在しない画面を指しています").toEqual([]);
  });
});

describe.each(ROUTE_CASES.map((r) => [r.file, r] as const))("%s", (_file, route) => {
  it("描ける", async () => {
    const html = await renderCase(route);
    // 「例外にならない」だけでは、中身が空でも通る。
    // 画面として成立する最低限の分量が出ていることまで見る。
    expect(html.length).toBeGreaterThan(200);
  });

  it("見出しが 1 つの h1 から始まり、階層を飛ばさない", async () => {
    expectHeadingStructure(await renderCase(route));
  });

  it("読み上げと操作の自動検査に違反がない", async () => {
    const html = await renderCase(route);
    const violations = await findA11yViolations(html);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  /*
   * 表の見出しが、自分がどちら向きの見出しかを名乗る。
   *
   * **axe はここを見ない。** `scope` の値が出鱈目なら落ちるが、
   * `scope` を書かないこと自体は違反にならない（`tests/ui/axe-blind-spots.test.ts`
   * の 3 件目・4 件目がその盲点を実測している）。読み上げは向きが無い `th` を
   * 前後の並びから推測するので、列見出しが行見出しとして読まれる。
   *
   * 2026-08-21 まで、これを見ていたのは `tests/ui/ai-usage-page.test.tsx` の
   * **1 枚だけ**だった。追跡表は REQ-P04（比較表）と REQ-S07（配信予定表）と
   * REQ-S10（定義表）の判定欄でも「表見出しに `scope`」を根拠にしていたが、
   * その 3 画面を見ている検査は無かった。実測した時点では全画面が満たしていたので、
   * **直すものは無く、落ちないように留める側が無かった**。ここがその留め。
   */
  it("表の見出しが、列か行かを名乗っている", async () => {
    const html = await renderCase(route);
    const { document, cleanup } = intoDom(html);
    const scopeless = [...document.querySelectorAll("th")]
      .filter((th) => th.getAttribute("scope") === null)
      .map((th) => (th.textContent ?? "").trim().slice(0, 20));
    cleanup();
    expect(scopeless, `向きの無い表見出し: ${scopeless.join(" / ")}`).toEqual([]);
  });

  /*
   * まとまった選択欄が、まとまりの名前を持つ。
   *
   * **axe はここも見ない。** `fieldset` に `legend` が無いことも、
   * `legend` が空であることも、axe の既定の規則では違反にならない。
   * 読み上げは各欄のラベルだけを読むので、
   * 「何を絞り込む欄なのか」が消えても、画面を見ている人には分からない。
   *
   * 追跡表は REQ-P10（数字の絞り込み）と REQ-TH01（画面の見た目）の判定欄で
   * 「`fieldset`/`legend`」を根拠にしていたが、それを見ている検査は無かった。
   * 実測（2026-08-21）では全画面 32 個のまとまりが満たしていた。
   * 直すものは無く、**留める側だけが無かった**。
   */
  it("まとまった選択欄が、まとまりの名前を先頭に持っている", async () => {
    const html = await renderCase(route);
    const { document, cleanup } = intoDom(html);
    const unnamed = [...document.querySelectorAll("fieldset")]
      .filter((fs) => {
        const first = fs.firstElementChild;
        return (
          first === null ||
          first.tagName.toLowerCase() !== "legend" ||
          (first.textContent ?? "").trim() === ""
        );
      })
      .map((fs) => (fs.textContent ?? "").trim().slice(0, 24));
    cleanup();
    expect(unnamed, `名前の無いまとまり: ${unnamed.join(" / ")}`).toEqual([]);
  });
});

describe.each(ROUTE_STATE_CASES.map((r) => [`${r.file} — ${r.state}`, r] as const))(
  "%s",
  (_label, route) => {
    it("落ちずに何かを表示する", async () => {
      // 空・見つからない・絞り込み後といった状態は、実際に最も多く見られる状態でありながら
      // 手で開かれる回数が最も少ない。ここが白紙のまま公開される事故を止める。
      const html = await renderCase(route);
      expect(html.length).toBeGreaterThan(200);
      // 例外の状態でも見出しは要る。見出しの無い画面は行き止まりになりやすい。
      expectHeadingStructure(html);
    });

    it("読み上げと操作の自動検査に違反がない", async () => {
      const html = await renderCase(route);
      const violations = await findA11yViolations(html);
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  },
);
