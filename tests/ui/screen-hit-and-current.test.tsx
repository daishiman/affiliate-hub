/**
 * @tier 2
 * @req REQ-P02, REQ-S01, REQ-S08, REQ-S09, REQ-S10
 * @types a11y
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTE_CASES,
  ROUTE_CASES,
  ROUTE_STATE_CASES,
  renderCase,
} from "./route-table";
import { intoDom } from "../support/render";

/** 表示名。同じ画面が状態違いで何度も出るので、状態まで名前に入れる。 */
function labelOf(route: { readonly file: string; readonly state?: string }): string {
  return route.state === undefined ? route.file : `${route.file} — ${route.state}`;
}

/**
 * 画面の「押しどころの大きさ」と「現在地」を、名指しで見る。
 *
 * **どちらも axe には届かない。**
 * 押しどころは jsdom が全要素を 0×0 で返すため `target-size` が素通りし
 * （`tests/ui/axe-rule-coverage.test.ts` にその理由が書いてある）、
 * 現在地（`aria-current="page"`）は「書かれているものが妥当か」ではなく
 * **「書かれるべきものが書かれているか」**なので、axe の見る側に無い。
 *
 * それでも `docs/product/traceability.md` の A 節・B 節は複数の行で
 * 「44px 最小」「`aria-current`」を a11y 欄の根拠に挙げていた。
 * 2026-08-21 に測ったところ、**どちらを見ている検査も 1 つも無かった**
 * （`--hit-min` という値が在るだけ / `aria-current="step"` を見る
 * `tests/ui/patterns-render.test.tsx` は別物）。この検査はその穴を塞ぐ。
 *
 * --- 見ている範囲と、見ていない範囲 ---
 *
 * 見る: 操作部品（`button` / `input` / `select` / `textarea`）と、
 *       **すべてのリンク**（2026-08-21 に `nav` の中だけから広げた。残課題 146）。
 * 見ない: **文の中のリンク**（段落や升目の文章に埋まっているもの）。
 *       ここは WCAG 2.5.8 の行内テキスト例外に当たる。判定は `isInlineLink()`
 *       が持ち、**理由つき除外では外していない**（上限 7 に張り付いているため。
 *       残課題 143 ⑦）。
 *
 * --- 広げたときに出た赤（2026-08-21）---
 *
 * 広げる前の選択子は `nav a[href]` で、**`nav` の外に単独で置かれたリンクを
 * 1 本も見ていなかった。**広げたところ 144 本の赤が出た。同じ日に
 * `ui.module.css` へ 2 本入れて（`.headerActions > a` / `.calloutAction > a`）
 * 61 本消し、**残り 70 本 / 27 画面**だった。
 *
 * **いまは 69 本 / 29 画面**（同じ日の夕方。下の「床である」の節を先に読むこと
 * ——**この 1 本の差は、直った 14 本と新しく見えた 13 画面の差である**）。
 * 入れ物ごとの内訳:
 *   親がクラス無し 31 / `.boardLink` 14 / `.cardTitle` 8 / `.headingLevel2` 7 /
 *   `.productCardFooter` 3 / `.siteName` 2 / `.productCardName` 2 /
 *   `.defValue` 1
 * （`.note` の 5 本は役の分割で `.seeAlso` へ移り、そちらは直したので 0 本）
 *
 * **2026-08-21 夜、この一覧のうち 2 行が入れ物ごと移った。数は動いていない。**
 *
 *   - `.sectionTitle` 7 → **`.headingLevel2` 7**。UX-17 で `.sectionTitle` 179 箇所を
 *     `SectionHeading` へ通したため、赤の**入れ物の名前が変わった**。7 本は同じ 7 本で、
 *     直っても増えてもいない。**下の「見出しを包むリンクは判定できない」がそのまま効く。**
 *   - `.linkNote` 1 → **0**。`/signin` の「管理画面へ戻る」で、中身がリンク 1 本きり
 *     だったので `Note` ではなく `SeeAlso` へ通した。`.seeAlso` は既に下限を持つので消えた。
 *     **`.note` の 5 本と同じ経路の 6 本目**であり、役の分割が正しかったことの追加の証拠でもある。
 *
 * **名前が変わっただけの行を「直った」と読まないこと。**入れ物ごと移る作業は、
 * 数が動かないまま一覧の見た目を変える。ここに移った経緯を書いておかないと、
 * 次に数え直した人が `.sectionTitle` の消滅を成果と読む。
 * どれも `min-height: var(--tap-target-min)` を宣言していない。直す先は
 * 画面ではなく CSS の側で、**1 箇所ずつではなく入れ物ごとに 1 本ずつ**である。
 *
 * **「親がクラス無し」の 30 本は、どの CSS からも指せない。**親要素が
 * `class` を 1 つも持たないもので、実物は `.linkList > li` の直下、
 * `DataTable` のセル（`data-table.tsx` が数値列以外に `undefined` を渡す）、
 * `admin/content/matrix/page.tsx` の手書き `<table>` の素のセル。
 * **持ち主が決まらないのは割り当ての隙間ではなく、CSS で直らないためである。**
 *
 * **見出しを包むリンク（`.cardTitle` / `.headingLevel2` / `.productCardName`）は
 * 判定できない。**字が大きいので実際の高さは 44px を超えている見込みだが、
 * jsdom は全要素を 0×0 で返すので**確かめられない**（残課題 143 ①と同じ壁）。
 * ここは「宣言が無い」であって「小さい」ではない。**見込みを実測の側に
 * 混ぜないこと。**`.cardTitle` / `.siteName` の 11 本を残してあるのは
 * 「直せない」からではなく、**直すと測れない変更が入るので実物を見るまで
 * 直さないと決めた**からである（前者と読むと次の人が「開ければ直る」と読む）。
 *
 * --- **この 70 は上限ではなく床である**（2026-08-21 実測。残課題 141 の 3 例目） ---
 *
 * 走査している 69 件のうち **13 件が、画面ではなく権限の断り
 * （`ErrorView`「…を行う権限がありません」）を描いている。**その 13 件では
 * 画面の中身が 1 つも出ておらず（`main` の中の `h2` が 0、リンクが「ホームへ戻る」の
 * 1 本だけ）、**押しどころは 1 つも測られていない。**
 *   全部が断りになる画面: `admin/feedback/page.tsx`（+ 状態 4）/
 *   `admin/feedback/[report]/page.tsx`（+ 状態 3）/ `admin/evidence` /
 *   `admin/products` / `admin/products/[product]` / `admin/settings/integration-access`
 *   一部の欄だけ断りになる画面（残りは測れている）: `admin/content/[variant]` /
 *   `admin/distribution/calendar` / `admin/generation` / `admin/settings` /
 *   `admin/sites/new`
 * とくに `admin/feedback` の状態 4 件は「絞った状態の最も読まれる部分を描くため」に
 * 足したものだが、**4 件とも既定の 1 件と同じ断りの画面を描いている**——
 * 状態を足しても中身は 1 文字も増えていない。**登録を増やすことは、
 * 描く枝を増やすことではない。**
 *
 * --- **同じ日のうちに直した。そして数はほとんど動かなかった** ---
 *
 * `tests/support/render.tsx` に `authorized` の前提を足し、`worldOf` が
 * 運営画面へ自動で当てるようにした。断りは **18 件 → 0 件**（残る 1 件は
 * `admin/settings` の「操作の記録」の 1 節だけで、理由つきで
 * `tests/ui/route-branch-reached.test.ts` の `PARTIAL` に載せてある）。
 *
 * **押しどころの赤は 70 本 / 27 画面 → 69 本 / 29 画面。**
 *
 * **数はほぼ動いていないが、意味は入れ替わっている。**13 画面が「一度も
 * 測られていない」から「測られている」に変わり、同じ日に `.note` の 5 本が
 * 役の分割で消え、`.seeAlso` の 9 本が新しく出て直った。
 * **打ち消し合った先の 69 を「変わらなかった」と読まないこと。**
 *
 * --- **上の「N 本 / N 画面」は、どちらも単位が曖昧である**（2026-08-21 18:16 追記） ---
 *
 * `audit-EHIJ` の指摘で数え直した。**この検査の赤には、数え方が 4 つある。**
 * 素の走行の画面（vitest の端末出力）は**同じ文言の失敗をまとめて表示する**ので、
 * 目で数えると 4 つのうちどれでもない数になる。同じ日の同じ走行（18:15）で:
 *
 *   のべ本数（テストごとに、下限の無い部品を 1 つずつ数える）      **41**
 *   テスト×文言（同じ画面の中の同じ形を 1 つに畳む）              **22**
 *   失敗したテストの数（画面 × 状態）                              **18**
 *   端末に出るエラーの塊の数（文言が同じものを全部畳む）            **9**
 *   ついでに、**別々のファイルの数**（状態違いを畳む）             **15**
 *
 * 内訳（のべ / テスト×文言）: `.cardTitle` 13/5・`<input>` 9/3・
 * `.sectionTitle` 7/2・`.siteName` 6/2・`.linkNote` 4/1・`.productCardName` 2/1。
 *
 * **上に書いた「70 本 / 27 画面」「69 本 / 29 画面」は、この 4 つのどれなのかが
 * 確かめられない。**後ろの数は失敗したテストの数だが、**それは「画面」ではない**
 * ——状態違いが別に数えられるので、今日なら 18 に対して実物のファイルは 15 である。
 * 前の数も、端末の表示から拾ったのか走行の生の出力から拾ったのかが残っていない。
 * **だから上の 2 組を引き算してはいけない。**
 *
 * **これは今日 3 回出た「打ち消し合う誤差」とは別種である。**あちらは母集団や
 * 時刻の違いで、**控えを取れば見分けられた。**こちらは控えを 2 つ並べても
 * 見分けられない——**どちらの控えも同じまとめ方で表示されるから**である。
 * 見分けるには走行の**外側**（`Tests N failed` の行や JSON の出力）と
 * 突き合わせるしかない。**道具が数を畳んでいることは、道具の中からは見えない。**
 *
 * 次に数を書く人へ: **単位を名前で書くこと。**「N 本」ではなく
 * 「のべ N 本（テストごと）」、「N 画面」ではなく「失敗テスト N 件 / ファイル N 件」。
 *
 * **なぜ見本の身元（`sample-actor.ts`）に足さなかったか**は
 * `render.tsx` の `authorized` に書いてある。要点だけ言うと、`feedback.read` も
 * `product.read` も**読むためだけの役が存在せず**、足せば必ず書き込みが付いてくる。
 * 認証がまだ無いので、それは「誰でも鍵を発行できる」状態を戻すことになる。
 *
 * --- `tests/ui/tap-target-floor.test.ts` との分担（消す前に読むこと） ---
 *
 * あちらは**トークンの値そのもの**（`--hit-min` / `--tap-target-min` が 44 を
 * 割らないか）を、`src` 配下の CSS 全部から拾って見る。
 * ここは**描いた画面**を見る（値が幾つかではなく、押せる部品にその下限が
 * 当たっているか）。**どちらか片方だけ残すと、もう片方の穴が無人になる。**
 *
 * 当初ここにも「下限の値が 44px を下回らない」を置いていたが、
 * あちらの 1・2 件目と完全に重なる（しかもあちらは `rem` も px に直して測るので
 * 単位で潜られない）ため、2026-08-21 に落とした。値の見張りはあちらが正本。
 *
 * --- `@media` の中をどう扱うか（2026-08-21 の実測） ---
 *
 * ここの規則の読み取りは、`@media` の**中に書かれた規則を見ない**。
 * 安全な側に外れる: 見えない＝「下限が無い」と読むので、赤になる。
 * 実測 — `site.module.css` の `.breadcrumb a, nav.section a` の下限を
 * `@media (min-width: 30rem)` で囲うと、目次を持つ画面が **1 件赤**になる
 * （実際その形は狭い画面で下限を失うので、赤で正しい）。
 * 逆向き（`@media` の中でトークンを小さく上書きする）はここでは捕まらないが、
 * それは `tap-target-floor.test.ts` の 3 件目が全 CSS 走査で捕まえている。
 *
 * --- **「赤のまま残す」から「名指しの保留」へ変えた**（2026-08-21 夜） ---
 *
 * 見出しを包むリンクの赤を、これまでは**赤のまま**置いていた。理由は上のとおりで
 * 正しい（測れない変更を入れて緑にするより赤のほうがまし）。
 * **だが赤のまま置くと、副作用が 2 つ出る。**
 *
 *   1. CI が毎回この 15 件で止まる。**毎回同じ場所で止まる門は、やがて誰も
 *      最後まで走らせない。**止まる門は、通らない門より悪い。
 *   2. **16 件目が混ざっても見分けが付かない。**「15 件赤」としか読めないので、
 *      新しい違反が保留の陰に隠れる。押しどころの見張りは、まさにその
 *      「新しく増えた違反」を捕まえるために在るのに、そこだけ効かなくなる。
 *
 * だから `PENDING` に**入れ物を名指しで**挙げ、それ以外は赤にした。
 * **判定を甘くしたのではない**——保留の範囲を機械が知っている形にしただけで、
 * 見込みを実測の側に混ぜていないことも、直す先が CSS であることも変わらない。
 *
 * **緩む方向にしか動かない仕掛けなので、3 つ縛った**：件数の上限（増やして
 * 通さない）、直ったのに残っている行の検出（残ると**その入れ物の中の新しい
 * 違反が永久に隠れる**）、理由の禁じ手（「赤だから」は理由ではない）。
 *
 * **壊して測った**: `PENDING` から `h2.cardTitle` を 1 行外すと**赤 5 件**。
 * 保留が全部を飲み込む形にはなっていない。
 *
 * 規範: docs/product/traceability.md「a11y 欄の書き方」の `目:`
 */

const ROOT = process.cwd();

// 下限の**数**（44）はここに書かない。`tests/ui/tap-target-floor.test.ts` が正本。
// 2 箇所に書くと、片方だけ直した日に食い違ったまま両方緑になる。

function cssFilesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) cssFilesUnder(full, out);
    else if (full.endsWith(".css")) out.push(full);
  }
  return out;
}

/**
 * 「下限を持っている」と CSS が言っているセレクタを、実物から集める。
 *
 * **クラス名をここに書き写さない。** 書き写すと、部品を足した日に
 * この検査だけが古い一覧のまま緑で残る（`tests/ui/layout-density.test.ts`
 * が同じ理由でトークン名の書き写しをやめている）。
 */
function sizedSelectors(): readonly string[] {
  const found: string[] = [];
  /*
    **置き場所を書き写さない。** 2026-08-26 まで `src/presentation/ui` と
    `src/app` だけを見ていた。`src/presentation/prose` に本文の CSS ができた日、
    そこで下限を当てた部品は「当てていない」と読まれ、直す先を実装の側だと
    読み違えることになる（`.button` の注釈で 1 度やっている）。

    `src` 配下の `.css` を全部読む。読みすぎて困ることは無い —
    下限を書いていない規則は、そもそもここに拾われない。
  */
  for (const file of cssFilesUnder(join(ROOT, "src"))) {
    // **注釈を先に落とす。** 落とさないと、規則の直前に注釈のある部品
    // （`.button` がそうだった）はセレクタが `/* … */ .button` になり、
    // jsdom が読めずに丸ごと数えられなくなる。**下限を持っているのに
    // 「持っていない」と出る**ので、直す先を実装の側だと読み違える。
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/min-(?:height|block-size):\s*var\(--tap-target-min\)/.test(rule[2])) continue;
      for (const raw of rule[1].split(",")) {
        // 擬似クラス・擬似要素は落とす（`:hover` の付いた規則も下限を持つ側に数える）。
        const selector = raw.trim().replace(/::?[a-z-]+(\([^)]*\))?/g, "");
        if (selector === "" || selector.startsWith("@")) continue;
        found.push(selector);
      }
    }
  }
  return found;
}

/**
 * CSS Modules の付ける `_name_hash` を元の名前へ戻す。
 *
 * 戻さないと、CSS 側のセレクタ（`.navLink`）が描いた HTML に 1 つも当たらず、
 * **全部が「下限を持たない」に見えて、逆に全部が「持っている」にも作れてしまう。**
 */
function unhashClasses(html: string): string {
  return html.replace(
    /class="([^"]*)"/g,
    (_all, value: string) =>
      `class="${value
        .split(/\s+/)
        .filter(Boolean)
        .map((name) => /^_(.+)_[a-f0-9]+$/.exec(name)?.[1] ?? name)
        .join(" ")}"`,
  );
}

/** 下限を持つ規則に当たっている要素の集合。 */
function sizedElements(document: Document, selectors: readonly string[]): Set<Element> {
  const sized = new Set<Element>();
  for (const selector of selectors) {
    let hit: NodeListOf<Element>;
    try {
      hit = document.querySelectorAll(selector);
    } catch {
      continue; // jsdom が読めない書き方（`:has()` など）は数えない
    }
    for (const el of hit) sized.add(el);
  }
  return sized;
}

/**
 * **文の中のリンクか。**
 *
 * WCAG 2.5.8 は「文や文章の塊の中にある的」を下限の対象外にしている。
 * 行送りに縛られていて、大きくすると文が崩れるためである。
 *
 * **判定は「どこに在るか」ではなく「連れがいるか」で行う。**
 * 親の文字から自分の文字を引いて、まだ文字が残っていれば文の中にいる。
 * 残らなければ、そのリンクは**単独で置かれた押しどころ**である。
 *
 * 親の要素名（`p` / `td` / `li`…）で判定しない。実測 2026-08-21——
 * `admin/distribution/page.tsx:136` は `<td>` の中に「開く」の 2 文字だけで
 * 在る。要素名で見ると `td` は文章の器なので**素通りする**が、
 * 連れで見ると引き算の残りが空になるので**捕まる**。
 */
function isInlineLink(el: Element): boolean {
  const parent = el.parentElement;
  if (parent === null) return false;
  const around = (parent.textContent ?? "").replace(el.textContent ?? "", "");
  // 区切りだけの残り（「 — 」「: 」「,」）は連れとして数えない。
  return around.replace(/[\s—–:：,、।·|/]+/g, "") !== "";
}

/**
 * 下限を要求する操作部品を数える。
 *
 * `input` は、囲っている `<label>` の側が下限を持っていれば押しどころは足りている
 * （名札を押しても入る）。そこまでを 1 つの押しどころとして数える。
 *
 * リンクは `nav` の中だけでなく**全部**を見る（2026-08-21 に広げた。残課題 146）。
 * 広げる前は選択子が `nav a[href]` で、`nav` の外に置かれた単独のリンク——
 * `Callout` の `action=` 枠のように**ボタンの位置に在るもの**——を 1 つも
 * 見ていなかった。**理由つき除外では外さない**（上限 7 に張り付いているため）。
 * 文の中のリンクは `isInlineLink()` の**判定条件**で分ける。
 */
function underSizedControls(document: Document, sized: Set<Element>): readonly string[] {
  const bad: string[] = [];
  const controls = document.querySelectorAll(
    "button, select, textarea, input:not([type=hidden]), a[href]",
  );
  for (const el of controls) {
    if (el.tagName === "A" && isInlineLink(el)) continue;
    if (sized.has(el)) continue;
    const label = el.closest("label");
    if (label !== null && sized.has(label)) continue;
    const own = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).join(".");
    // **入れ物まで書く。**クラスを持たない部品は名前が `<a>` だけになり、
    // 同じ画面に何本も出ると直す先が分からない（2026-08-21 に 136 本で詰まった）。
    const nest = (el.parentElement?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)[0];
    bad.push(
      `<${el.tagName.toLowerCase()}${own === "" ? "" : ` class="${own}"`}>` +
        `${nest === undefined ? "" : ` （${el.parentElement?.tagName.toLowerCase()}.${nest} の中）`}`,
    );
  }
  return bad;
}

const SELECTORS = sizedSelectors();

/**
 * 実ブラウザ未計測の名指し保留。2026-08-21 に4種すべてを desktop/mobile の実DOMで測り、
 * 28px / 23px / 23px / 32.39px と44px未満だったため対象リンクを修正し、保留は0件になった。
 */
const PENDING: Readonly<Record<string, { readonly measured: string; readonly reason: string }>> = {};

/** 保留の上限。**増やして通さないこと。**増えたなら、増えた分は新しい違反である。 */
const PENDING_MAX = 0;

/** 保留の理由に混ぜてはいけない言い分。**「直っていない」は理由ではない。** */
const FORBIDDEN_REASONS = ["赤だから", "面倒", "あとで", "直っていない", "落ちるから"];

/** 入れ物の名前（`（… の中）`）で、保留と本物の違反に分ける。 */
function splitPending(bad: readonly string[]): {
  readonly held: readonly string[];
  readonly unheld: readonly string[];
} {
  const held: string[] = [];
  const unheld: string[] = [];
  for (const line of bad) {
    const nest = /（(.+?) の中）/.exec(line)?.[1];
    (nest !== undefined && nest in PENDING ? held : unheld).push(line);
  }
  return { held, unheld };
}

describe("押しどころの大きさ", () => {
  it("下限を持つ規則を、CSS の実物から読めている（母集団の床）", () => {
    // 読み取りが 0 件に落ちると、下の検査は「全部が下限を持たない」と言うか、
    // 逆に条件の書き方しだいで全部緑になる。**先に読めていることを示す。**
    expect(SELECTORS.length, "下限を持つ規則が 1 つも読めていません").toBeGreaterThan(5);
    expect(ROUTE_CASES.length, "画面の表が空です").toBeGreaterThan(20);
  });

  it("道具が、下限を持たない部品を見落とさない", () => {
    // **読み取りを増やした代わりに、読み取りが黙って全部を「合格」に見せる形が増えた。**
    // わざと下限の無い部品を渡して、拾えることを見る。
    const { document, cleanup } = intoDom(
      `<form><button class="tiny">押す</button><input class="navLink" /></form>`,
    );
    try {
      const sized = sizedElements(document, SELECTORS);
      const bad = underSizedControls(document, sized);
      expect(bad, "下限の無いボタンを見落としました").toContain('<button class="tiny">');
      expect(bad.join(" "), "下限のある入力欄まで違反にしています").not.toContain("navLink");
    } finally {
      cleanup();
    }
  });

  /**
   * **文の中のリンクを外す判定が、両方向に効いていることを見る。**
   *
   * この判定は**外す側**なので、緩むと黙って全部が緑になる。
   * リンクの走査を `nav` の外へ広げた意味が、判定の緩みで消えないよう
   * 「外れるべきものが外れる」と「外れてはいけないものが残る」を両方置く。
   */
  it("文の中のリンクだけが対象外になる（外す判定の両側）", () => {
    const { document, cleanup } = intoDom(
      [
        // 文に埋まっている → 対象外
        `<p>公開先: <a href="/x">https://example.com</a> です</p>`,
        // 升目に単独で置かれている → 対象（要素名で見ると素通りする形）
        `<table><tbody><tr><td><a href="/y">開く</a></td></tr></tbody></table>`,
        // 区切りしか連れがいない → 対象
        `<p><a href="/z">鍵を発行する</a> — </p>`,
      ].join(""),
    );
    try {
      const bad = underSizedControls(document, sizedElements(document, SELECTORS)).join("\n");
      expect(bad, "文の中のリンクまで違反にしています").not.toContain("https://example.com");
      expect(bad, "升目に単独で在るリンクを見落としました").toContain("<a>");
      expect(
        isInlineLink(document.querySelector('a[href="/z"]')!),
        "区切りだけを連れと数えています",
      ).toBe(false);
      expect(
        isInlineLink(document.querySelector('a[href="/x"]')!),
        "文の中のリンクを単独と数えています",
      ).toBe(true);
    } finally {
      cleanup();
    }
  });

  /**
   * **状態違いも走らせる。ここが 2026-08-21 まで抜けていた。**
   *
   * `ROUTE_CASES` だけを回していたので、走っていたのは画面ごとに**枝 1 本**だけだった。
   * `/signin` のログアウトボタンは押しどころの下限を持っていなかったのに、
   * 壊れた形へ戻しても **120 件すべて緑**——`signedInActor()` が `null` を返す枝しか
   * 描かれず、そのボタンが出力に現れなかったためである。
   * **ルート表に載っている＝その画面の全部が測られている、ではない**（残課題 141）。
   */
  it("ログインしている枝が、本当に描けている（測り先の床）", async () => {
    const signedIn = ROUTE_STATE_CASES.find((r) => r.world === "signed-in");
    expect(signedIn, "ログインしている状態の登録が消えています").toBeDefined();
    const html = await renderCase(signedIn!);
    // **描けたことではなく、その枝の中身が出たことを見る。**
    // 前提の置き換えが効かなくなると画面は描けたまま別の枝へ落ちるので、
    // 「描けた」だけを見ていると、下の走査が黙って空振りに戻る。
    expect(html, "ログアウトの操作が出ていません（前提の置き換えが効いていない）").toContain(
      "ログアウトする",
    );
  });

  it.each([...ROUTE_CASES, ...ROUTE_STATE_CASES].map((r) => [labelOf(r), r] as const))(
    "%s の操作部品と案内のリンクが、押しどころの下限を持っている",
    async (_label, route) => {
      const html = unhashClasses(await renderCase(route));
      const { document, cleanup } = intoDom(html);
      try {
        const { unheld } = splitPending(underSizedControls(document, sizedElements(document, SELECTORS)));
        expect(unheld, `押しどころの下限が無い部品:\n  ${unheld.join("\n  ")}`).toStrictEqual([]);
      } finally {
        cleanup();
      }
    },
  );

  /*
    **保留一覧そのものを見張る。**除外は、置いた瞬間から緩む方向にしか動かない
    ——次に赤が出た人が 1 行足せば通るからである。だから 3 つ縛る。
  */
  it("保留に挙げたものが、まだ本当に下限を持っていない", () => {
    // 直したのに一覧へ残っていると、**その入れ物の中の新しい違反が永久に隠れる。**
    const stale = Object.keys(PENDING).filter((nest) => {
      const cls = nest.split(".")[1];
      return cls !== undefined && SELECTORS.some((s) => s.includes(`.${cls}`));
    });
    expect(stale, `もう下限を持っています。保留から外してください: ${stale.join(", ")}`).toEqual(
      [],
    );
  });

  it("保留の件数が上限を超えていない", () => {
    expect(
      Object.keys(PENDING).length,
      "保留が増えています。**増やして通さないこと**——増えた分は新しい違反です",
    ).toBeLessThanOrEqual(PENDING_MAX);
  });

  it("保留の理由が、理由になっている", () => {
    for (const [nest, { measured, reason }] of Object.entries(PENDING)) {
      expect(measured, `${nest}: 実測が空です`).not.toBe("");
      expect(reason, `${nest}: 理由が空です`).not.toBe("");
      for (const banned of FORBIDDEN_REASONS) {
        // **「赤が出るから外す」は理由ではない。**実測と判断は別の欄に書く
        // ——数が古びたことと、判断が間違っていたことは直し方が違う。
        expect(reason, `${nest}: 「${banned}」は理由になりません`).not.toContain(banned);
      }
    }
  });
});

/**
 * 現在地は 2 か所で名乗る。**片方だけでは足りない。**
 *
 *   案内（`nav[aria-label="主な案内"]`）… 権限で項目が消えると印も消える
 *   パンくず（`nav[aria-label="現在の場所"]`）… どの画面にも必ず出る
 *
 * 2026-08-21 に測ったとき、案内の側は 7 画面で印が 0 個、
 * パンくずの側は **1 画面も名乗っていなかった**（太字だけ）。
 */
/**
 * その経路が、案内のこの項目に属するか。
 *
 * **`/admin`（ホーム）は前置きに数えない。**すべての経路の前置きになるので、
 * 数えると「どの画面でもホームが現在地」で緑になり、
 * **印がどこにも付いていない画面まで合格に見える**（実際に 1 度そうなった）。
 *
 * 実装（`navHrefFor`）から読み込まずに書いているのは、
 * 同じ関数で答え合わせをすると、実装が変わった日に検査も一緒に変わって
 * **ずれが 1 度も見えないため**。
 */
function belongsTo(path: string, href: string): boolean {
  return path === href || (href !== "/admin" && path.startsWith(`${href}/`));
}

describe("現在地", () => {
  it.each(ADMIN_ROUTE_CASES.map((r) => [r.file, r] as const))(
    "%s のパンくずの末尾が、いまいる画面だと名乗っている",
    async (_file, route) => {
      const html = await renderCase(route);
      const { document, cleanup } = intoDom(html);
      try {
        const trail = document.querySelector('nav[aria-label="現在の場所"]');
        expect(trail, "パンくずが描かれていません").not.toBeNull();
        const current = [...trail!.querySelectorAll('[aria-current="page"]')];
        // **0 個でも 2 個でも読み上げは現在地を失う。**
        // 目で見る人には太字が残るので、消しても気づかれない。
        expect(current.length, `現在地の印が ${current.length} 個`).toBe(1);
        // 印は末尾（＝この画面そのもの）に付く。途中の親に付いていたら現在地がずれる。
        const marks = [...trail!.querySelectorAll("a, span")].filter(
          (el) => el.querySelector("a, span") === null && (el.textContent ?? "").trim() !== "/",
        );
        expect(marks.at(-1), "現在地の印が末尾に付いていません").toBe(current[0]);
      } finally {
        cleanup();
      }
    },
  );

  it.each(ADMIN_ROUTE_CASES.map((r) => [r.file, r] as const))(
    "%s の案内の印が、いま開いている経路に付いている",
    async (_file, route) => {
      const html = await renderCase(route);
      const { document, cleanup } = intoDom(html);
      try {
        const nav = document.querySelector('nav[aria-label="主な案内"]');
        expect(nav, "主な案内が描かれていません").not.toBeNull();
        const current = [...nav!.querySelectorAll('[aria-current="page"]')];
        // 印は 1 つまで。2 つ付くと、どちらが現在地か読み上げからは決められない。
        expect(current.length, `案内の印が ${current.length} 個`).toBeLessThanOrEqual(1);
        if (current.length === 0) {
          // **0 個は「この画面の項目が権限で案内から消えている」ときだけ許す。**
          // 見せていないものに印は付けられないが、そのときも画面自体は開けている
          // ——案内に無い画面が開ける件は残課題 127 に起票してある。
          const path = `/${relative("", route.file).replace(/\/page\.tsx$/, "")}`;
          const hrefs = [...nav!.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
          expect(
            hrefs.some((h) => h !== null && belongsTo(path, h)),
            `${path} の項目は案内に出ているのに、印がどこにも付いていません`,
          ).toBe(false);
          return;
        }
        // 印は「いま開いている経路」に付いていること。
        // 個数だけ見ると、どこか 1 つに付けっぱなしでも緑になる。
        const href = current[0].getAttribute("href") ?? "";
        const path = `/${relative("", route.file).replace(/\/page\.tsx$/, "")}`;
        expect(
          belongsTo(path, href),
          `${path} を開いているのに、案内の印は ${href} に付いています`,
        ).toBe(true);
      } finally {
        cleanup();
      }
    },
  );
});
