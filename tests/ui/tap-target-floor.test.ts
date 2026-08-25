/**
 * @tier 2
 * @req REQ-P01
 *
 * 押しどころの大きさの**下限そのもの**を見る。
 *
 * 根拠は WCAG 2.2 AA の達成基準 **2.5.8 Target Size (Minimum)**。
 * 2.5.8 の下限は 24×24 CSS px だが、この製品は `--hit-min` に
 * 2.5.5 Target Size (Enhanced) と同じ **44px** を採っている
 * （`src/presentation/ui/tokens/primitives.css` の注釈、および
 * `src/presentation/ui/README.md`「触れる的は 44px 以上」）。
 * ここで見張るのはその 44 である。
 *
 * --- なぜ別ファイルとして要るのか（2026-08-21 の実測） ---
 * `docs/product/traceability.md` の REQ-P01 は「44px 最小」を守っている根拠として
 * 挙げていたが、**44 という数を見ている検査は 1 つも無かった。**
 * `tests/ui/layout-density.test.ts` は `--tap-target-min` が
 * `/^[0-9.]+px$/` であること（＝px 単位であること）と、
 * `admin.module.css` の行にその変数が当たっていることまでは見ているが、
 * 値が幾つかは見ていない。
 *
 * 実測: `--hit-min: 44px` を **43px**（境目のすぐ下）に落として
 * `layout-density` / `design-tokens` / `patterns-render` を回すと **46 件すべて緑**。
 * 極端側（8px）にすると 1 件だけ赤になるが、落ちるのは
 * 「一覧が 1 画面に収まらないので、見出しを追従させている」という、
 * 行の高さから画面の高さを逆算している別の検査の**巻き添え**であって、
 * 押しどころの大きさを見た赤ではない。
 * 極端に壊して赤が出たことを「守られている」と読むと、ここを取り違える。
 *
 * --- `tests/ui/screen-hit-and-current.test.tsx` との重なり（2026-08-21 時点） ---
 * 同じ日に別の担当が同じ穴に気づき、あちらにも
 * 「下限の値そのものが 44px を下回らない」があった。**重複していたので
 * あちらから落とし、値の見張りはこのファイルを正本にした（2026-08-21）。**
 * いまの分担は次のとおり。**片方だけ消すと、もう片方の穴が無人になる。**
 *   ここ … トークンの**値**。`src` 配下の CSS 全部から宣言を拾って測る。
 *   あちら … 描いた**画面**。その下限が押せる部品に当たっているか。
 *
 * **実測のやり直し（2026-08-21）。**当初ここには
 * 「`@media (max-width: 480px) { :root { --tap-target-min: 32px } }` を
 * `admin.module.css` の末尾へ足すと、あちらは 51 件を
 * 『押しどころの下限が無い部品: `<a>`』で落とすが、44px にしても同じ 51 件が
 * 落ちるので巻き添えの偽陽性である」と書いてあった。**測り直したら再現しない。**
 * 32px を足しても 44px を足しても、あちらは **121 件すべて緑**である
 * （赤くなるのはここの 3 件目だけで、これは詰めたことを名指しした正しい赤）。
 * 51 件のほうは、あちらが規則の直前の注釈を落としていなかった時期の別の不具合で、
 * `@media` とは無関係。その不具合は同日に直っている。
 * **偽陽性の申し立ても、対照を取って再現するまでは事実ではない。**
 *
 * --- この検査が捕まえないもの（消さないこと） ---
 * ここが見ているのは**トークンの値だけ**である。
 *   - その値が実際に押せるものへ当たっているか（`min-height: var(--tap-target-min)` の
 *     配線）は見ていない。それは `tests/ui/layout-density.test.ts` の担当。
 *   - 画面に描いたあとの実寸（padding や transform で潰れていないか）も見ていない。
 *     jsdom は要素を 0×0 で返すため、そもそも測れない
 *     （`tests/ui/axe-rule-coverage.test.ts` に同じ理由が書いてある）。
 * したがって「44px が守られている」ではなく
 * 「**44 という下限がトークンから消えていない**」が、ここで言えることの上限。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const UI_DIR = join(ROOT, "src/presentation/ui");

/** WCAG 2.2 の 2.5.5 相当。製品として採っている下限。 */
const FLOOR_PX = 44;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * トークンの値を、意味の段から素の段までたどって生の文字列で返す。
 *
 * **値をここに書き写さない。** 書き写すと、トークン側を変えたときに
 * この検査だけが古い値のまま緑で残る（それがまさに今回の穴だった）。
 */
function resolveToken(name: string, depth = 0): string {
  expect(depth, `${name} のたどりが深すぎます（循環？）`).toBeLessThan(8);
  for (const rel of ["tokens/semantic.css", "tokens/primitives.css"]) {
    const css = readFileSync(join(UI_DIR, rel), "utf8");
    // 最初の定義を採る。`@media (prefers-contrast: more)` の中の上書きは
    // 既定値ではないため。上書き側は 3 件目の検査がまとめて見る。
    const found = new RegExp(`(?:^|\\n)\\s*${name}:\\s*([^;]+);`).exec(css);
    if (found === null) continue;
    const raw = found[1].trim();
    const alias = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
    return alias === null ? raw : resolveToken(alias[1], depth + 1);
  }
  throw new Error(`${name} がトークンの定義に見つかりません`);
}

/** `44px` も `2.75rem` も受ける。単位を書き換えて下限を潜られないため。 */
function toPx(raw: string, label: string): number {
  const rem = /^([0-9.]+)rem$/.exec(raw);
  if (rem !== null) return Number(rem[1]) * 16;
  const px = /^([0-9.]+)px$/.exec(raw);
  expect(px, `${label} が px でも rem でもありません: ${raw}`).not.toBeNull();
  return Number(px![1]);
}

describe("押しどころの大きさの下限（WCAG 2.2 / 2.5.8）", () => {
  it("素の段の `--hit-min` が 44px 以上である", () => {
    const px = toPx(resolveToken("--hit-min"), "--hit-min");
    expect(px, `--hit-min が ${px}px です。下限は ${FLOOR_PX}px`).toBeGreaterThanOrEqual(FLOOR_PX);
  });

  it("画面が使う `--tap-target-min` が、たどった先でも 44px 以上である", () => {
    // `--tap-target-min: var(--hit-min)` の別名を外して別の値に差し替えられても
    // ここが落ちる。上の 1 件目だけでは、その差し替えを素通りさせる。
    const px = toPx(resolveToken("--tap-target-min"), "--tap-target-min");
    expect(px, `--tap-target-min が ${px}px です。下限は ${FLOOR_PX}px`).toBeGreaterThanOrEqual(
      FLOOR_PX,
    );
  });

  it("どこかで上書きしていても、下限を下回らない", () => {
    // **母集団の床を兼ねる。** 上の 2 件は既定値（最初の定義）しか見ていないので、
    // `@media` の中や別のファイルで小さく上書きされても気づかない。
    // ここでは src 配下の CSS 全部から、この 2 つの名前の宣言を残らず拾う。
    const declarations: { where: string; raw: string }[] = [];
    for (const path of walk(join(ROOT, "src")).filter((p) => p.endsWith(".css"))) {
      const css = readFileSync(path, "utf8");
      for (const m of css.matchAll(/(--(?:hit-min|tap-target-min)):\s*([^;]+);/g)) {
        declarations.push({ where: `${relative(ROOT, path)} の ${m[1]}`, raw: m[2].trim() });
      }
    }
    // 拾えていないのに緑、を防ぐ。素の段と意味の段で最低 2 件はある。
    expect(declarations.length, "下限のトークンの宣言を読めていません").toBeGreaterThanOrEqual(2);

    for (const { where, raw } of declarations) {
      // 別名は上の 2 件がたどるので、ここでは実寸で書いてある宣言だけ測る。
      if (/^var\(--[a-z0-9-]+\)$/.test(raw)) continue;
      const px = toPx(raw, where);
      expect(px, `${where} が ${px}px です。下限は ${FLOOR_PX}px`).toBeGreaterThanOrEqual(FLOOR_PX);
    }
  });
});
