/** @tier 2 @req REQ-S09 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSS_ROOT, type Rule, baseSelector, cssFilesUnder, rulesOf } from "./css-rules";

/**
 * **面の地色だけで区別している規則**を、数え方ごと固定する。
 *
 * 強制配色（`forced-colors: active`）では `background` が系の色へ塗り替えられる。
 * 面の濃淡だけで「ここは別の帯です」と言っている規則は、そのとき区別を失う。
 * 輪郭（`border` / `outline`）を持っていれば残る。
 *
 * ==========================================================================
 * **この検査の本題は件数ではなく、数え方である。**
 * ==========================================================================
 *
 * 2026-08-21 の `docs/product/ui-ux-tasks.md` UX-08 は、この数を **21** と
 * 書いていた。数え直したところ **21 は、その数え方では正しかった**。
 * ところが数え方のほうが**逆向きに 2 つ間違っていて、誤差がほぼ打ち消し合って
 * いた**。片方だけの誤差なら数が動くので気づけるが、両方向の誤差は
 * **数が合うことで自分を隠す。**
 *
 * **だから「数え方を直したのに数が変わらなかった」を、正しさの証拠にしない。**
 *
 * --- 数がどう動いたか（2026-08-21 の実測。全部同じ日、同じ CSS）---
 *
 *   21  UX-08 が書いた数（うち 4 件は同日に直したので、残るはずは 17）
 *   20  規則を 1 つずつ数える（`@media` の中を別の規則として数える）
 *   17  同じセレクタを合流させる
 *   18  値まで見る（`border: none` / `border-radius` を輪郭と数えない）
 *   13  擬似クラスを基底へ合流させる（`:hover` だけを見て「無い」と言わない）
 *   10  別のセレクタが同じ要素に輪郭を与えている 3 件を手で外す
 *
 * **6 回のうち 5 回で数が動いている。**この検査は 3 番目以降を機械にした。
 * 最後の 1 段（10 へ落とす分）は**機械にできない**——理由は下の「見えない誤差」。
 *
 * --- 誤差の 3 つの向き ---
 *
 * **① 入れ子（甘い側／2 件）。**`@media (forced-colors: active)` の中に書いた
 * 対処が、外の規則と別のものとして数えられる。**直した規則が「まだ壊れている」
 * と出る。**これがいちばん高くつく——報告を受けた人が 2 度目の修正をする。
 * 実測: `.buttonPrimary` と `.buttonQuiet:hover:not(:disabled)` が、
 * まさに同じ日に `forced-colors` で直した 2 件だった。
 *
 * **② 部分一致（辛い側／4 件）。**本文に `border` の 5 文字が在れば輪郭あり、
 * と数えると `border-radius` と `border: none` を輪郭に数える。
 * 角を丸めることは輪郭を持つことではない。実測: `.densityNavRow` /
 * `.densityNavRowFixed` / `.navLink` / `.skeleton` が `border-radius` しか
 * 持っていない。**この 4 件目は、②を直した後の私が手で数え直しても落とした**
 * （下の対照検査の註を見ること）。3 件だと思っていたので、上の「21 → 10」の
 * 段も 1 つずつずれている可能性がある——**機械が数えた側を正とする。**
 *
 * **③ 擬似クラス（辛い側／5 件）。**`:hover` の規則は地色しか書かないので、
 * その規則だけを見ると「面はあるが輪郭が無い」に見える。**だが押している
 * 相手は基底のクラスも着ている。**実測: `.filterSubmit:hover` /
 * `.feedbackLauncher:hover` の基底はどちらも実線の `border` を持っている。
 *
 * ①と②③は逆を向いている。UX-08 の 21 は、その打ち消し合いの上に立っていた。
 *
 * --- **見えない誤差（機械にできない 3 件）** ---
 *
 * ここから先は CSS だけでは決まらないので、**一覧の理由に手で書いてある。**
 *
 *   - **より一般のセレクタが同じ要素に当たる。**`.table thead th` は
 *     `.table th, .table td` の `border-bottom` を受け取っている。
 *     セレクタの包含関係を機械で解くのは、この検査の範囲を超える。
 *   - **クラスの組み合わせは CSS に書かれていない。**`.inputAuto` は
 *     いつも `class="input inputAuto"` の形で使われ、`.input` が実線の
 *     `border` を持っている。**どのクラスが一緒に着せられるかは JSX 側にしか
 *     無い。**CSS をいくら読んでも出てこない。
 *
 * **だから一覧の 13 件のうち 3 件は「壊れている」ではない。**
 * 一覧に残してあるのは、外すと**次に数える人が同じ 3 件を数え直す**ため。
 * 数から外すのではなく、**理由の側に「なぜ数に出るのに壊れていないか」を置く。**
 *
 * --- 判定していないもの ---
 *
 * **実際に見分けられなくなるかは測っていない。測れない。**このリポジトリには
 * 強制配色で描く仕掛けが無く、jsdom は組版もしない（残課題 143 ①）。
 * ここが見ているのは**規則の形**だけである。「輪郭の宣言が無い」であって
 * 「区別を失う」ではない。**見込みを実測の側に混ぜないこと。**
 *
 * 規範: docs/product/ui-ux-tasks.md UX-08
 */

/**
 * **切り出しは `css-rules.ts` に移した**（2026-08-21）。`@media` の中を外と同じ高さで
 * 拾うこと、擬似クラスを基底へ落とすことは、**この検査だけの都合ではない。**
 * 同じ切り出しを別の見張りが別々に書くと、片方だけが入れ子を見落とし、
 * **見張りごとに違う母集団**ができる。そのとき数は食い違うが、どちらも自分の中では
 * 整合しているので検算では見分けられない——①の誤差が別の形で再発する。
 *
 * ここに残っているのは**何を良しとするか**だけである。
 */
const ROOT = CSS_ROOT;

/** 同じ要素に当たる規則をひとまとめにする。`strip` を切ると③の直しだけが外れる。 */
function merge(rules: readonly Rule[], strip: boolean): ReadonlyMap<string, string> {
  const byKey = new Map<string, string>();
  for (const r of rules) {
    const key = `${r.file} :: ${strip ? baseSelector(r.selector) : r.selector}`;
    if (key.endsWith(":: ")) continue;
    byKey.set(key, `${byKey.get(key) ?? ""};${r.body}`);
  }
  return byKey;
}

/** 面の地色を塗っているか。`none` / `transparent` は塗っていない。 */
function paintsSurface(body: string): boolean {
  for (const m of body.matchAll(
    /(?:^|[\s;])(?:background(?:-color|-image)?|box-shadow)\s*:\s*([^;]*)/g,
  )) {
    if (!/^(none|transparent|inherit|initial|0)$/.test((m[1] ?? "").trim())) return true;
  }
  return false;
}

/**
 * 輪郭を持っているか。**値まで見る（②の直し）。**
 *
 * `border: none` と `border: 0` は輪郭ではない。`border-radius` は角の丸みで
 * あって輪郭ではない（この関数の正規表現が `-radius` を拾わないのは意図的）。
 * `transparent` も数えない——**強制配色でも `transparent` は `transparent` の
 * まま保たれる**ので、色を明示して初めて枠が出る（UX-08 ①の実測）。
 */
function hasOutline(body: string): boolean {
  for (const m of body.matchAll(
    /(?:^|[\s;])(?:border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?(?:-(?:width|style|color))?|outline(?:-(?:width|style|color))?)\s*:\s*([^;]*)/g,
  )) {
    const value = (m[1] ?? "").trim();
    if (/^(none|0|0px)$/.test(value)) continue;
    if (/\btransparent\b/.test(value)) continue;
    return true;
  }
  return false;
}

/** UX-08 が使っていた雑な当て方。**直すためではなく、比べるために残してある。** */
function looksLikeOutline(body: string): boolean {
  return /(^|[\s;])(border|outline)/.test(body);
}

type Exemption = {
  /** 何を数えて、いつ数えたか。 */
  readonly measured: string;
  /** なぜ面の地色だけでよいのか。**「数に出るが壊れていない」もここに書く。** */
  readonly reason: string;
};

/**
 * 面の地色を持つのに輪郭の宣言が無い規則の一覧。
 *
 * **3 件は「壊れている」ではない**（上の「見えない誤差」）。数から外さず、
 * 理由の側に書いてある——外すと次に数える人が同じ 3 件を数え直すため。
 */
const EXEMPT: Record<string, Exemption> = {
  // --- 数に出るが、別のセレクタが同じ要素に輪郭を与えている（4 件）-------
  "src/presentation/ui/patterns/patterns.module.css :: .table thead th": {
    measured: "2026-08-21。同じファイルの `.table th, .table td` を読んで確認",
    reason:
      "**壊れていない。**`.table th, .table td` が border-bottom を実線で持っており、" +
      "この要素はそれを受け取っている。セレクタの包含関係を機械で解くのはこの検査の外なので、" +
      "数には出る",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .table tbody th": {
    measured: "2026-08-21。同上",
    reason: "**壊れていない。**同じく `.table th, .table td` の border-bottom を受け取っている",
  },
  "src/presentation/prose/prose.module.css :: .proseTable th": {
    measured: "2026-08-26。同じファイルの `.proseTable th, .proseTable td` を読んで確認",
    reason:
      "**壊れていない。**`.proseTable th, .proseTable td` が実線の border を四辺に持っており、" +
      "この要素はそれを受け取っている。ここが足しているのは見出し行の地色と太字だけで、" +
      "地色が均されても枠と太字が残る",
  },
  "src/presentation/ui/primitives/ui.module.css :: .inputAuto": {
    measured: "2026-08-21。`textarea.tsx` / `input.tsx` の className を読んで確認",
    reason:
      "**壊れていない。**いつも `class=\"input inputAuto\"` の形で使われ、`.input` が実線の " +
      "border を持っている。**どのクラスが一緒に着せられるかは JSX 側にしか無く、CSS には " +
      "書かれていない。**だから数には出る",
  },

  // --- 面そのもの（囲む相手がいない）--------------------------------------
  "src/app/globals.css :: body": {
    measured: "2026-08-21。全画面の地",
    reason: "画面そのものの地色。強制配色では系の地色に置き換わるだけで、失う区別が無い",
  },
  "src/presentation/ui/primitives/ui.module.css :: .shell": {
    measured: "2026-08-21。管理画面の外枠",
    reason: "外枠の地色。枠の外に相手がいないので、濃淡で何かと区別してはいない",
  },
  "src/presentation/ui/templates/site.module.css :: .siteShell": {
    measured: "2026-08-21。読者向けの外枠",
    reason: "同じく外枠の地色。区別のためではなく地を敷いている",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .feedbackDialog": {
    measured: "2026-08-21。走査には 0 回（押して初めて開く client 側の状態）",
    reason:
      "後ろを暗くする覆い（`--color-scrim`）。**輪郭を持つと覆いの縁が線として出て、" +
      "かえって別の箱に見える。**中の `.feedbackPanel` が縁を持つのが正しい形",
  },

  // --- 案内の帯（地色で「いまここ」を出している）--------------------------
  "src/presentation/ui/primitives/ui.module.css :: .navLink": {
    measured: "2026-08-21。走査で 714 回。`:hover` の地色を基底へ合流させた後の姿",
    reason:
      "指している行の地色。**輪郭を足すと、指していない 18 行との間に線が増えて案内が騒がしくなる。**" +
      "強制配色でも `:focus-visible` の輪と `aria-current` は残るので、行き先は分かる",
  },
  "src/presentation/ui/primitives/ui.module.css :: .navLinkCurrent": {
    measured: "2026-08-21。1 画面につき 1 行",
    reason:
      "いまいる行。**地色に加えて字の太さと濃さも変えている**ので、面が消えても区別は残る" +
      "（`--weight-bold` と `--color-text-strong`）",
  },
  "src/presentation/ui/primitives/ui.module.css :: .navGroupLabel": {
    measured: "2026-08-21。案内の見出し。sticky で上に貼り付く",
    reason:
      "**壊れていない。**貼り付いた見出しは下の行の上に重なるが、重なりを断っている " +
      "`background` は強制配色でも**消えずに均される**だけで、不透明なまま残る" +
      "（CSS Color Adjust L1）。消えるのは `box-shadow` と `transparent` として" +
      "書かれた色だけ。**輪郭を足すと、いま普通に動いている所に線が増える**",
  },

  /*
   * ↑ **2026-08-21 に理由を書き換えた。前の理由は誤りだった。**
   *
   * 前は「**ここは輪郭が要る側。**地色が消えると文字が行に食い込んで見える。
   * 直していないのは②の 3 件の 1 つだからで、この行は『まだ直っていない』を
   * 残すために在る」と書いてあった。**「地色が消える」が誤り。**
   *
   * `docs/product/ui-ux-tasks.md` UX-08 ②は、同じ日に、まさにこの点を訂正して
   * いる——「強制配色は色を消すのではなく均す」「②は手を入れない。**入れると、
   * 強制配色で普通に動いている所を壊す**」。
   *
   * **同じ日に書かれた 2 つの記録が、この 1 クラスについて正反対を向いていた。**
   * 一方は「まだ直っていない」の目印として、他方は「直してはいけない」として
   * 同じ 1 行を持っていた。**どちらも自分の中では筋が通っているので、
   * 片方だけを読んだ人は迷わない——迷わずに反対のことをする。**
   * 現に `ui.module.css` へ `border-bottom` を足しかけて、戻した。
   *
   * 12 つ目の形（一覧が作業より遅れる）とは別。**遅れていたのではなく、
   * 2 つの一覧が同時に、逆向きに正しかった。**doc の側が理屈を書いていたので
   * そちらを採った。理屈の無い断定は、こういうとき負ける。
   */
  // --- 見本帳の中だけ ------------------------------------------------------
  "src/app/admin/admin.module.css :: .densityNavRow": {
    measured: "2026-08-21。`/admin/ui-catalog` の行送りの見本に 3 回",
    reason:
      "行送りの直し方を並べて見せるための見本で、製品の画面には出ない。" +
      "**見本の中で 2 つの行を比べる**のが役目なので、区別は隣り合わせが持っている",
  },
  "src/app/admin/admin.module.css :: .densityNavRowFixed": {
    measured: "2026-08-21。同上に 3 回",
    reason: "同じ見本の「直した後」の側。隣の行との比較が役目",
  },

  // --- 判定できていない ----------------------------------------------------
  "src/presentation/ui/primitives/ui.module.css :: .skeleton": {
    measured: "2026-08-21。読み込み中の帯",
    reason:
      "**判定できていない。**中身は `linear-gradient` で、強制配色のときに何色で塗られるかを" +
      "このリポジトリでは確かめられない。**分からないものを分かったことにしないため、" +
      "理由ではなく「分からない」を書いてある**（残課題 146）",
  },
};

const ALL = cssFilesUnder(join(ROOT, "src")).flatMap(rulesOf);
const MERGED = merge(ALL, true);

describe("面の地色だけで区別している規則は、理由つきで数えられている", () => {
  it("走査そのものが空振りしていない（母集団の床）", () => {
    expect(ALL.length, "CSS の規則をほとんど拾えていません。切り出す側を先に疑うこと").toBeGreaterThan(250);
    expect(cssFilesUnder(join(ROOT, "src")).length, "CSS のファイルを歩けていません").toBeGreaterThanOrEqual(8);
  });

  it("面を塗る規則と塗らない規則を、実際に見分けている（陰性対照）", () => {
    // 「面を塗る規則が 0 件」でも一致検査は緑になりうる。両側に数が立つことを見る。
    const painted = [...MERGED.values()].filter(paintsSurface);
    expect(painted.length, "面を塗る規則が 1 つも見つかりません").toBeGreaterThan(20);
    expect(MERGED.size - painted.length, "面を塗らない規則が 1 つも見つかりません").toBeGreaterThan(100);
  });

  it("**②** 部分一致で数えると、輪郭を持たない規則を持っていると読む", () => {
    // `border-radius` しか無い規則が実在することを、この検査自身が持っている。
    // 実在しなくなったら②の直しは不要になっている——そのときここが落ちて教える。
    const fooled = [...MERGED].filter(
      ([, body]) => paintsSurface(body) && looksLikeOutline(body) && !hasOutline(body),
    );
    expect(
      fooled.map(([k]) => k).sort(),
      "部分一致と値の見方が食い違う規則が消えました。②の直しがまだ要るか確かめること",
    ).toStrictEqual([
      "src/app/admin/admin.module.css :: .densityNavRow",
      "src/app/admin/admin.module.css :: .densityNavRowFixed",
      // **4 件目は手で数えたときに落としていた。**私は `.navLink` の
      // `border-radius` を 2026-08-21 に自分で読んでいて、それでもこの一覧へ
      // 書き写すときに 3 件にした。**②の誤差は、直した後でも同じ手つきで再発する。**
      "src/presentation/ui/primitives/ui.module.css :: .navLink",
      "src/presentation/ui/primitives/ui.module.css :: .skeleton",
    ]);
  });

  it("**③** 擬似クラスを基底へ合流させないと、直っているものが赤に出る", () => {
    // 合流を切ると数が増える。増えた分は「`:hover` で地色だけ変える規則」で、
    // その相手は基底の輪郭を着ている。**増えることそのものが③の証拠**である。
    const unmerged = [...merge(ALL, false)].filter(
      ([, body]) => paintsSurface(body) && !hasOutline(body),
    );
    const merged = [...MERGED].filter(([, body]) => paintsSurface(body) && !hasOutline(body));
    expect(
      unmerged.length - merged.length,
      "擬似クラスを合流させても数が変わりません。③の直しが効いていないか、不要になっています",
    ).toBeGreaterThan(0);
  });

  it("面の地色だけで区別している規則は、一覧に載っているものだけである", () => {
    const found = [...MERGED]
      .filter(([, body]) => paintsSurface(body) && !hasOutline(body))
      .map(([k]) => k)
      .sort();
    // **両方向で見る。**足りない側だけを見ると、もう存在しないセレクタが
    // 理由つきで一覧に居座る（`flex-row-shape.test.ts` と同じ形）。
    expect(found).toStrictEqual(Object.keys(EXEMPT).sort());
  });

  it("一覧のどの行も、数と理由の両方を持っている", () => {
    const thin = Object.entries(EXEMPT)
      .filter(([, v]) => v.measured.trim().length < 4 || v.reason.trim().length < 12)
      .map(([k]) => k);
    expect(thin, "実測か理由が空です。理由を書かずに足さないこと").toStrictEqual([]);
  });
});
