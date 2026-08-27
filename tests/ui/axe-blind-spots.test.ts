/**
 * @tier 2
 * @req REQ-TS06
 * @types a11y, regression
 *
 * **axe では原理的に届かない領域の一覧。**
 *
 * --- なぜ一覧を文章で書かないか ---
 * 「axe はここを見ていません」と本文に書いただけの記述は、
 * **見るようになった日にも古く見えない。** 一覧を検査として書くと、
 * axe が規則を足してその形を拾い始めた日に、この検査が赤くなって知らせる。
 * 限界の記述ではなく、限界の監視である（②の形。`bd memories test-gate-directions`）。
 *
 * --- 一覧の軸（2026-08-19 の実測から出た統一的な説明） ---
 * **axe が見ているのは「書かれているものが妥当か」であって、
 * 「書かれるべきものが書かれているか」ではない。**
 * 名前の無い `group`、役割を名乗らない操作部品、向きを名乗らない見出し、
 * 焦点を受けない台紙——どれも「書かれていない」側なので、
 * 規則を足しても届かない。ここに並ぶのは全部その形である。
 *
 * --- 測った条件（2026-08-19、axe-core 4.13.0、画面 67 枚） ---
 * | | best-practice を足す前 | 足したあと（＝現行） |
 * |---|---|---|
 * | 有効な規則（件） | 70 | 100 |
 * | 実際に当たった規則（件） | 28 | 45 |
 * | 違反（件） | 0 | 2（`landmark-unique`。直した） |
 *
 * **「規則を広げても届かない」は、もう本文の申し立てではない**（2026-08-21）。
 * 下の `describe`「緑だった理由の 3 分類」が、**止めているものも基準の外のものも含めた
 * 全 105 規則**を当てて、壊した姿と直した姿で axe の答えが 1 つも変わらないことを見ている。
 * だから「まだ規則を有効にしていないだけ」ではなく「原理的に届かない」と書ける。
 *
 * --- この検査が主張していない 2 つのこと ---
 * 1. 一覧が網羅であること。**これは「見つけた分」であって「全部」ではない。**
 *    網羅を主張できる数え方をまだ持っていない。
 * 2. `whereReal` が付いている項目が十分に守られていること。
 *    ここが見ているのは「その画面を自分の目で見ている検査が実在する」ことだけで、
 *    その検査が正しいかは各ファイルの側の話である。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DISABLED_RULES,
  describeViolations,
  findA11yViolations,
  runA11y,
  runAllRulesA11y,
} from "../support/a11y";

const ROOT = resolve(import.meta.dirname, "../..");

/**
 * **緑だった理由の 3 分類。**
 *
 * 「違反が出なかった」には 3 通りの理由があり、そのままでは同じ緑に見える。
 * **設定で届くもの（`無効` と `判定不能`）と、設定では届かないもの（`規則が無い`）を混ぜない。**
 * 混ぜると「まだ規則を有効にしていないだけ」と「原理的に届かない」が同じ扱いになり、
 * 前者を放置する言い訳に後者が使われる。
 */
type WhyGreen =
  /** 拾う規則が axe に無い。**設定を変えても届かない。** */
  | "規則が無い"
  /** 拾う規則はあるが、`A11Y_TAGS` の外か `DISABLED_RULES` で止めている。**有効にすれば届く。** */
  | "無効"
  /** 拾う規則はあり有効だが、jsdom では判定不能になる。**別の作業場所なら届く。** */
  | "判定不能";

type BlindSpot = {
  /** 何が届かないか。 */
  readonly name: string;
  /** 緑だった理由。**推測ではなく、下の `describe` が壊した姿を当てて確かめる。** */
  readonly whyGreen: WhyGreen;
  /**
   * 拾うはずだった規則の名前。
   * `規則が無い` は指す先が無いので `null`。**それ以外は名指しを義務にする**
   * （名前が無いまま「規則はあるが無効」と書けると、確かめようが無い）。
   */
  readonly rule: string | null;
  /** 要件を満たしていない姿。**判定式ではなく、要件の文がそのまま禁じている行為で壊す。** */
  readonly broken: string;
  /** 満たしている姿。 */
  readonly fixed: string;
  /** 自分の目。`broken` で偽、`fixed` で真になること。 */
  readonly sees: (html: string) => boolean;
  /**
   * 本物の画面でこれを見ている検査。
   * **`null` は「合成でしか押さえていない」という申告である。** 消さない。
   */
  readonly whereReal: string | null;
};

/**
 * 入れ物側。`<main>` と見出しを持たせておく。
 * 断片だけを渡すと `region` や `page-has-heading-one` の側が出て、
 * 「axe が何も言わなかった」のか「別のことを言った」のかが混ざる。
 */
function page(body: string): string {
  return `<main><h1>検査対象</h1>${body}</main>`;
}

const BLIND_SPOTS: readonly BlindSpot[] = [
  {
    name: "まとまりが名前を持たない（`role=\"group\"` に名前が無い）",
    whyGreen: "規則が無い",
    rule: null,
    broken: page(`<div role="group"><button type="button">ペン</button></div>`),
    fixed: page(`<div role="group" aria-label="道具"><button type="button">ペン</button></div>`),
    sees: (html) => /role="group"[^>]*aria-label=/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "操作部品が役割を名乗らない（押せるものが `button` ではない）",
    whyGreen: "規則が無い",
    rule: null,
    // 押せることを `onclick` で明示しても変わらない。
    // 「押せるのに役割を名乗っていない」という形そのものを見る規則が無い。
    broken: page(`<div class="tool" onclick="pick()">ペン</div>`),
    fixed: page(`<button type="button">ペン</button>`),
    sees: (html) => /<button\b/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "列の見出しが向きを名乗らない（`scope=\"col\"` が無い）",
    whyGreen: "規則が無い",
    rule: null,
    broken: page(
      `<table><caption>利用</caption><thead><tr><th>回数</th></tr></thead><tbody><tr><td>12</td></tr></tbody></table>`,
    ),
    fixed: page(
      `<table><caption>利用</caption><thead><tr><th scope="col">回数</th></tr></thead><tbody><tr><td>12</td></tr></tbody></table>`,
    ),
    sees: (html) => /scope="col"/.test(html),
    whereReal: "tests/ui/ai-usage-page.test.tsx",
  },
  {
    name: "行の見出しがただのマスになる（`<th scope=\"row\">` が `<td>`）",
    whyGreen: "規則が無い",
    rule: null,
    broken: page(
      `<table><caption>利用</caption><tbody><tr><td>ブログA</td><td>12</td></tr></tbody></table>`,
    ),
    fixed: page(
      `<table><caption>利用</caption><tbody><tr><th scope="row">ブログA</th><td>12</td></tr></tbody></table>`,
    ),
    sees: (html) => /scope="row"/.test(html),
    whereReal: "tests/ui/ai-usage-page.test.tsx",
  },
  {
    name: "描ける台紙が焦点を受けない（`canvas` に `tabindex` も役割も無い）",
    whyGreen: "規則が無い",
    rule: null,
    broken: page(`<canvas width="10" height="10"></canvas>`),
    fixed: page(
      `<canvas width="10" height="10" tabindex="0" role="application" aria-label="写しに印を置く"></canvas>`,
    ),
    sees: (html) => /<canvas[^>]*tabindex="0"/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "状態の変化が読み上げへ届かない（`aria-live` が無い）",
    whyGreen: "規則が無い",
    rule: null,
    broken: page(`<p>位置 3, 4</p>`),
    fixed: page(`<p aria-live="polite">位置 3, 4</p>`),
    sees: (html) => /aria-live=/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "代替テキストが中身を説明していない（`alt` はあるが定型語）",
    whyGreen: "規則が無い",
    rule: null,
    broken: page(`<img src="/a.png" alt="画像">`),
    fixed: page(`<img src="/a.png" alt="編集台の上のノートパソコンと外付けモニター">`),
    // 定型語だけの `alt` を弾く。**これは十分な判定ではない**
    // （「内容を説明しているか」は機械には分からない。`tests/support/a11y.ts` の冒頭）。
    // ここで押さえられるのは、最も多い手抜きの形だけである。
    sees: (html) => {
      const alt = /alt="([^"]*)"/.exec(html)?.[1] ?? "";
      return alt.length > 0 && !["画像", "写真", "図", "image", "photo"].includes(alt);
    },
    // **本物の画面で見ている検査は無い。** 合成でしか押さえていない。
    whereReal: null,
  },
];

describe("axe では原理的に届かない領域", () => {
  /**
   * **0 の作り方を 2 通り持つ**（⑳）。
   * 下の「違反 0」は、対象に問題が無くても、測る側が壊れていても同じ 0 になる。
   * 見つかるはずの合成を同じ経路へ通して、見つける側が動いていることを先に示す。
   */
  it("先に、見つける側が動いていることを示す（陽性対照）", async () => {
    const found = await findA11yViolations(page(`<img src="/a.png">`));
    expect(found.map((v) => v.id)).toContain("image-alt");
  });

  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — axe は要件を満たしていない姿を違反として上げない",
    async (_name, spot) => {
      const found = await findA11yViolations(spot.broken);
      // **赤くなったら、それは axe が見るようになった日である。**
      // そのときは項目を消すのではなく、`sees` を残したまま
      // 「axe も見るようになった」へ書き換えて、二重に見る。
      expect(found, `axe が見るようになった: ${describeViolations(found)}`).toStrictEqual([]);
    },
  );

  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — 満たしている姿でも axe は何も言わない（違いを見ていない）",
    async (_name, spot) => {
      const found = await findA11yViolations(spot.fixed);
      expect(found, describeViolations(found)).toStrictEqual([]);
    },
  );

  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — 自分の目のほうは効いている（壊すと落ちる／直すと通る）",
    (_name, spot) => {
      expect(spot.sees(spot.broken), "壊した姿を通してしまった").toBe(false);
      expect(spot.sees(spot.fixed), "直した姿を落としてしまった").toBe(true);
    },
  );

  it.each(
    BLIND_SPOTS.filter((s) => s.whereReal !== null).map((s) => [s.name, s.whereReal!] as const),
  )("%s — 本物の画面で見ている検査が実在する", (_name, where) => {
    expect(existsSync(resolve(ROOT, where)), `${where} が無い`).toBe(true);
  });
});

/**
 * **「緑だった理由」を 3 分類のどれかへ実測で割り当てる。**
 *
 * ここまでの検査が示しているのは「いまの設定では違反が出ない」ことだけである。
 * **それは「原理的に届かない」の証明になっていない。**
 * 拾う規則が `A11Y_TAGS` の外に在るだけ、あるいは `DISABLED_RULES` で止めているだけなら、
 * **設定を 1 行変えれば届く**——それを「axe の限界」と書くのは嘘になる。
 *
 * だから**止めているものも基準の外のものも含めて全 105 規則を当て**、
 * 壊した姿と直した姿で axe の答えが 1 つも変わらないことを見る。
 * 変わらない＝**壊したこと自体に axe が反応する規則を 1 つも持っていない**。
 *
 * --- なぜ「壊した姿の違反が 0」ではなく「直した姿との差が 0」なのか ---
 * 全規則を当てると、この合成とは関係のない判定不能が必ず 3 件出る
 * （`color-contrast` `landmark-one-main` `page-has-heading-one`。jsdom が描画を持たないため）。
 * それは**壊す前から出ている**ので、0 で固定すると測れない。
 * 差を取ると背景が落ち、**壊したことによる変化だけ**が残る。
 *
 * --- この検査が上の一覧と違うこと ---
 * 上は「いまの設定で見ていない」、ここは「設定を最大にしても見ていない」。
 * **前者だけだと、規則を止めて緑にした日と見分けが付かない。**
 *
 * --- 分けられる強さを測ったら、思っていたより弱かった（2026-08-21） ---
 * `規則が無い` と `無効` を分ける力は、**`DISABLED_RULES` に対しては実測できた**
 * （止めている `color-contrast` は全規則版にだけ現れる。陽性対照 2）。
 * **`A11Y_TAGS` の外に対しては実測できていない。**
 * 基準の外に居る規則は 5 件しかなく、**どれもこの作業場所では鳴らせなかった**:
 * `duplicate-id` / `duplicate-id-active` は廃止済みで全規則版でも有効にならず、
 * `color-contrast-enhanced` は jsdom が描画を持たないので判定不能どまり、
 * `identical-links-same-purpose` と `meta-refresh-no-exceptions` は
 * 違反を作ろうとしても判定そのものを返さなかった（`<meta>` を `<body>` に置く渡し方のためと思われる）。
 * つまり **「タグ外に拾う規則が隠れていない」ことは、まだ実測で言えていない。**
 * 言えているのは「止めている規則の側には隠れていない」までである。
 * axe が基準の外に新しい規則を足した日に、ここは**黙って通る**。
 *
 * --- 壊して測った（2026-08-21。この 3 本が単独で鳴ることの実測） ---
 * | 壊し方 | 赤 |
 * |---|---|
 * | 全規則版を普段の版と同じ絞り方にする | **1 本**（陽性対照 2 だけ） |
 * | 分類を `無効` に書き換える（`rule` は `null` のまま） | **2 本**（分類の実測・名指しの噛み合い） |
 * | 拾う規則が**基準の外**に在る状況を作る（`best-practice` を `A11Y_TAGS` から外し、壊した姿に空の見出しを混ぜる） | **1 本**（分類の実測だけ。**上の一覧の「違反として上げない」は緑のまま**） |
 * | 壊した姿を、いまの基準内の規則が拾う姿にする（同じ空の見出しを、基準はそのままで混ぜる） | 2 本（上の一覧＋分類の実測） |
 * **3 つ目が、この `describe` を足した理由そのもの。**
 * 基準の外に拾う規則が現れたとき、上の一覧は緑のままで、ここだけが赤くなる。
 */
describe("緑だった理由の 3 分類（全規則を当てて確かめる）", () => {
  /**
   * **0 の作り方を 2 通り持つ**（⑳）。下の「差が 0」は、
   * 全規則版が 1 件も規則を回していなくても同じ 0 になる。
   *
   * 1 本目: 全規則版でも本物の違反は出る（＝走っている）。
   */
  it("全規則版でも、本物の違反はちゃんと出る（陽性対照 1）", async () => {
    const b = await runAllRulesA11y(page(`<img src="/a.png">`));
    expect(b.violations).toContain("image-alt");
  });

  /**
   * 2 本目: 全規則版が**普段の版より広い**こと。
   * 止めている `color-contrast` が全規則版の答えには出る。
   * これが無いと、全規則版が実は普段の版と同じ絞り方をしていても気づけない
   * （そのとき「全部当てても届かない」は「いまの設定で届かない」の言い換えでしかない）。
   */
  it("全規則版は、止めている規則も当てている（陽性対照 2）", async () => {
    const disabled = DISABLED_RULES[0]!.id;
    const all = await runAllRulesA11y(page(`<p>文</p>`));
    const usual = await runA11y(page(`<p>文</p>`));
    const appeared = [...all.violations, ...all.passes, ...all.incomplete, ...all.inapplicable];
    const usualAll = [...usual.violations, ...usual.passes, ...usual.incomplete, ...usual.inapplicable];
    expect(
      appeared.includes(disabled) && !usualAll.includes(disabled),
      `${disabled} が全規則版と普段の版で同じ扱いになった。全規則版が広くなっていない`,
    ).toBe(true);
  });

  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — 「規則が無い」であることが、全規則を当てても変わらない",
    async (_name, spot) => {
      if (spot.whyGreen !== "規則が無い") {
        // 分類が動いた項目は、下の「名指し」の検査が受け持つ。
        expect(spot.rule).not.toBeNull();
        return;
      }
      const broken = await runAllRulesA11y(spot.broken);
      const fixed = await runAllRulesA11y(spot.fixed);
      const changed = [
        ...broken.violations.filter((id) => !fixed.violations.includes(id)),
        ...broken.incomplete.filter((id) => !fixed.incomplete.includes(id)),
      ];
      // **赤くなったら、それは「規則はあった」と分かった日である。**
      // 項目を消すのではなく、`whyGreen` を `無効` か `判定不能` へ動かし、
      // ここに出た規則名を `rule` へ書く。設定で届くなら、設定を直すほうが先である。
      expect(
        changed,
        `壊したことに反応する規則があった: ${changed.join(", ")}。whyGreen を動かして rule に名前を書く`,
      ).toStrictEqual([]);
    },
  );

  /**
   * **分類と名指しが噛み合っているか。**
   * 「規則はあるが無効」と書きながら規則名を書かないでいられると、
   * **その分類は確かめようが無い**（確かめられない分類は、書き手の言い分でしかない）。
   */
  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — 分類と規則の名指しが噛み合っている",
    (_name, spot) => {
      expect(
        spot.rule === null,
        `whyGreen=${spot.whyGreen} と rule=${spot.rule} が噛み合っていない`,
      ).toBe(spot.whyGreen === "規則が無い");
    },
  );

  /**
   * **3 分類のどれにも入らない項目を作れないこと**を、型ではなく値で見る。
   * 型は `as` ひとつで抜けられる。
   */
  it("すべての項目が 3 分類のどれかに割り当たっている", () => {
    const known: readonly WhyGreen[] = ["規則が無い", "無効", "判定不能"];
    const unknown = BLIND_SPOTS.filter((s) => !known.includes(s.whyGreen)).map((s) => s.name);
    expect(unknown).toStrictEqual([]);
  });
});

describe("一覧そのものが痩せていないか", () => {
  /**
   * **②の形の検査には、数える対象そのものの件数の下限を同居させる**（㉗）。
   * 上の 4 本は `BLIND_SPOTS` を回すので、**項目を消せば全部緑になる。**
   * 下限が無ければ、この一覧は減らすだけで満たせる。
   *
   * 7 は 2026-08-19 に出た数そのものである。下限なので上げる方向にしか動かさない。
   */
  it("項目を減らして緑にできない", () => {
    expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(7);
  });

  /**
   * 合成でしか押さえていない項目の数。**上限なので下げる方向にしか動かさない。**
   *
   * 1 は「代替テキストの中身」の 1 件。**この上限は「1 件までは合成で許す」ではなく、
   * 「いま 1 件ある」という申告である。** 減らすには本物の画面で見る検査を足す。
   * 増やしたくなったら止めて聞く。
   */
  it("合成でしか押さえていない項目が増えていない", () => {
    const synthetic = BLIND_SPOTS.filter((s) => s.whereReal === null);
    expect(synthetic.map((s) => s.name)).toHaveLength(1);
  });

  it("同じ形を 2 度書いていない（名前が重複していない）", () => {
    expect(new Set(BLIND_SPOTS.map((s) => s.name)).size).toBe(BLIND_SPOTS.length);
  });

  /**
   * **要件追跡表の凡例が、この一覧の件数と食い違っていないか。**
   *
   * 凡例は「全 105 規則を当てても届かない領域が 7 件」と書いている。
   * 一覧を増やしたときに凡例だけ 7 のまま残ると、**文書のほうが少なく見せる。**
   * 数は一覧を持っているこちらが正本で、**凡例はこちらに合わせる**
   * （残りの 4 つの数は `tests/ui/axe-rule-coverage.test.ts` が同じやり方で見ている）。
   */
  it("要件追跡表の凡例が、この一覧の件数と合っている", () => {
    const doc = readFileSync(resolve(ROOT, "docs/product/traceability.md"), "utf8");
    const row = doc.split("\n").find((l) => l.includes("全 105 規則を当てても届かない領域"));
    expect(row, "凡例に届かない領域の件数の行が無い").toBeDefined();
    expect(Number(/\|\s*(\d+)\s*\|/.exec(row!)![1])).toBe(BLIND_SPOTS.length);
  });
});
