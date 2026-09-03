import type { ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * 節の見出し。
 *
 * **なぜ在るか。** `className` を持たない裸の `<h2>` / `<h3>` が 8 件あり、
 * **本文と見分けが付かない状態で出ていた**（残課題 145。うち 6 件は公開側）。
 * 原因は `globals.css` の `@import "tailwindcss"` が連れてくる Preflight で、
 * `h1..h6 { font-size: inherit; font-weight: inherit }` が入っている
 * （`node_modules/tailwindcss/preflight.css:81`）。**見出し要素は、
 * 何も当てなければ段落になる。**このリポジトリには子孫セレクタで見出しに
 * 当てている規則が 1 つも無いので、受け止める側もいない。
 *
 * **新設した。「既存のクラスへ寄せる」ほうは選ばなかった。**
 *
 * 寄せる道は 2 つあった。どちらも「借りる」形になるので採らなかった。
 *
 *   - **公開側 6 件に `site.module.css` の `.sectionHeading` を当てる。**
 *     6 件のうち 5 件は `src/app/s/**` と `src/presentation/site/` にあって、
 *     `@/presentation/ui` しか読んでいない。当てるには CSS Modules を
 *     跨いで借りることになる——**`signin` から取り除いたばかりの形**
 *     （UX-16 / UX-17）を、その日のうちに 6 箇所で作り直すことになる。
 *   - **`patterns.module.css` の `.sectionHeading` を使う。**
 *     こちらは `feedback-button.tsx` の 1 件だけなら成り立つが、
 *     残り 7 件は `patterns` の外にあるので同じ借りが要る。
 *     **1 件のために部品を作らない、は正しいが、8 件のためには作る。**
 *
 * **値そのものは寄せている。**新しく作った値は 1 つも無い:
 *   - level 2 = `site.module.css` の `.sectionHeading` と同値。
 *   - level 3 = かつて `admin.module.css` に在った `.sectionTitle` から下余白を外したもの
 *     （= `patterns.module.css` の `.sectionHeading` に `line-height` を足したもの。
 *     この 2 つは `line-height` の有無だけが違い、それ以外は同じ）。
 *
 * **つまり「見せ方の新設」ではなく「置き場の新設」である。**見た目の語彙は
 * 増えていない（4 つのまま）。増えたのは、クラスを跨いで借りずに
 * 見出しを書ける口が 1 つできたことだけ。
 *
 * **`level` は必須。** 省略できると、書く人は「いちばん近い見た目」を選び、
 * 文書の段と見た目の段がずれる。実際に管理画面はそうなっていて、
 * `.sectionTitle` を h2 / h3 / h4 の**3 段すべてに同じ見た目で**当てていた
 * （`admin/personas/page.tsx` は h2 →h3 →h4 と 3 段入れ子で、全部同じ大きさ）。
 * 文書の構造は 3 段あるのに、目に見えるのは 1 段しかない。
 * **段を宣言させれば、この形は作れない。**`DataTable` が `align` を列の
 * 属性にしたのと同じ理由——型で強制できるものを、規律で守らせない。
 *
 * **`className` は受け取らない。** 受け取ると「この 1 箇所だけ大きく」が入り、
 * 段と見た目の対応が再び崩れる。崩れても赤にならないので、口を開けない。
 *
 * ==========================================================================
 * 2026-08-21: `level` に 4 を足し、管理画面 179 箇所をここへ通した（UX-17）
 * ==========================================================================
 *
 * ここには「**`level` は 2 と 3 だけ。**4 段目は前例が無く、足すなら値を
 * 発明することになるので、必要になった人が理由と一緒に足すこと。いま黙って
 * `--text-base` を置くと、それが前例になってしまう」と書いてあった。
 * **必要になったので、理由と一緒に足す。**
 *
 * --- 4 段目の値をどう決めたか ---
 *
 * **発明していない。`--text-base` でもない。**`.headingLevel3` から
 * `font-size` だけを 1 段下ろして `--text-base` にする案は採らなかった——
 * 本文と同じ大きさになり、`font-weight` と `color` だけが見出しの手掛かりに
 * なる。強制配色ではその 2 つのうち `color` が均されるので、**手掛かりが
 * 1 つに減る**（UX-08 で `.navLinkCurrent` を「太字が残るから壊れていない」と
 * 判定したのと同じ物差しで見ると、こちらは薄い）。
 *
 * 採ったのは `--text-sm`。`.sectionLead`（節の説明文）と同じ大きさで、
 * **本文より小さい**。4 段目は「3 段目の中の小見出し」なので、本文と同じ
 * 大きさで太いより、小さくて太いほうが段として読める。
 * 大きさの階段は `--text-xl` → `--text-lg` → `--text-sm` で、
 * **3 段目と 4 段目の差が他より大きい**。これは意図的で、
 * 4 段目まで潜る画面が `admin/personas` の 1 枚しかないため、
 * 中間の値を新しく足すより既存の値で済ませるほうを選んだ。
 *
 * --- 下の余白をここで持つ（**方針を変えた**）---
 *
 * `.headingLevel2` / `.headingLevel3` は `margin: 0` だった。**`--space-2` の
 * 下余白を足した。**管理画面が使っていた `.sectionTitle` が
 * `margin: 0 0 var(--space-2)` を持っており、`Card`（`.card`）は
 * `gap` を持たない素のブロックなので、**余白を落とすと 179 箇所で見出しと
 * 本文がくっつく。**
 *
 * これで `.sectionTitle` との差は **`font-size` 1 つだけ**になった。
 * 179 箇所を通した結果として実際に変わるのは、`<h2>` だった 150 箇所が
 * `--text-lg` → `--text-xl` へ**大きくなる**ことだけである。
 * `<h3>` 20 箇所と `<h4>` 6 箇所は、それぞれ `--text-lg` のまま / `--text-lg`
 * から `--text-sm` へ。**h4 の 6 箇所だけが小さくなる側。**
 *
 * 既に通っていた 10 箇所は、下余白が付く方向に変わる。
 *
 * --- 通していない 3 箇所（**もう無い**）---
 *
 * ここには「`admin/ui-catalog/page.tsx` の h4 / h5 / h6 は `.sectionTitle` の
 * まま残す。あれは見本で、3 つとも同じ大きさで出ることを見せるために在る」と
 * 書いてあった。2026-08-31 に確かめたところ、あの画面に h4 / h5 / h6 も
 * `.sectionTitle` も残っていない。`.sectionTitle` は管理画面から参照ゼロになり、
 * 同日 `admin.module.css` から消した。**除外はもう 1 箇所も無い。**
 */
export type SectionHeadingLevel = 2 | 3 | 4;

export function SectionHeading({
  level,
  id,
  children,
}: {
  /** 文書としての段。見た目のために選ばない。 */
  readonly level: SectionHeadingLevel;
  /**
   * ページ内アンカーの飛び先。
   *
   * **`className` は拒むのに `id` を許すのは、性質が違うから。**
   * `className` は見た目を変える口で、開けると「この 1 箇所だけ大きく」が
   * 入って段と見た目の対応が崩れる。`id` は**見た目を 1px も変えない**。
   * 変えるのは「ここへ飛べる」ことだけである。
   *
   * **飛び先を見出しそのものに持たせる。**`<div id="…">` で包む形にすると、
   * 飛んだ先で読み上げが見出しを読まない。飛ぶ人はいちばん見出しを必要と
   * している（`admin/rankings/page.tsx` の「評価基準を見る」）。
   */
  readonly id?: string;
  readonly children: ReactNode;
}) {
  if (level === 2) {
    return (
      <h2 className={styles.headingLevel2} id={id}>
        {children}
      </h2>
    );
  }
  if (level === 3) {
    return (
      <h3 className={styles.headingLevel3} id={id}>
        {children}
      </h3>
    );
  }
  return (
    <h4 className={styles.headingLevel4} id={id}>
      {children}
    </h4>
  );
}
