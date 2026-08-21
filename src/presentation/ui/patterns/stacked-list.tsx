import type { ReactNode } from "react";
import styles from "./patterns.module.css";

/**
 * 縦に積む一覧。行き先の一覧にも、素の文章の一覧にも使う。
 *
 * **なぜ `LinkList` ではないか。** これは `admin.module.css` の `.linkList`
 * （26 ファイル・53 箇所）を部品へ上げたものだが、**名前は引き継いでいない。**
 * 残課題 156 の実測——`<li>` 61 件のうちリンクを含むのは **23 件だけ**で、
 * 残り 38 件は素の文章（書き手の資格、読者像の判断軸・困りごと、権限の一覧）。
 * **半分以上が、名前の言うものを持っていない。**
 *
 * 名前をそのまま引き継ぐと、`note.tsx` が書いた形をもう一度やることになる——
 * 「生クラスだった頃は『これは本当に注記か』を疑う余地があったのに、
 * **部品の名前が役を主張するので疑う理由が消える**」。`LinkList` を通した瞬間、
 * 38 件の文章の一覧が「リンクの一覧である」と名乗り始める。
 * **見た目は 1px も変わらないまま、嘘だけが強くなる。**
 *
 * **役を 2 つに分けてはいない。**分けたくなるが、残課題 156 の①が基準を立てている
 * ——「役の分割は、二つの役に別の扱いが要るときに初めて元が取れる」。
 * リンクの行と文章の行で、余白も並べ方も 1 つも違わない。**いま両者に別の扱いは
 * 要っていないので、分けるのは早い。**`Note` と `SeeAlso` を分けたときは基準を
 * 満たしていた（押しどころの下限が片方には当てられ片方には当てられない）。
 * こちらは満たしていない。**同じ日に、同じ人が、片方は分けて片方は分けなかった。
 * 基準が在るとはそういうことである。**
 *
 * **`className` は受け取らない。**`SectionHeading` / `Note` と同じ理由。
 * 受け取れる形にすると「この 1 箇所だけ少し空ける」が 53 箇所に散る。
 *
 * **`ordered` だけは分けた。**`.linkList` は 4 つの違う要素に付いていて、
 * うち 2 箇所が `<ol>` だった（`sites/new` の下書きの段階、`writing` の段落の並び）。
 * **順序に意味があるかどうかは、156 の①が言う「別の扱い」に当たる**——読み上げは
 * `<ol>` と `<ul>` を区別して伝えるので、揃えると意味のほうが消える。
 * どちらも番号を自分で書いている（`{s.position}.` / `{p.step}`）ので**見た目は変わらない**が、
 * 見た目が同じであることは同じ役である証拠ではない（`.note` / `.seeAlso` と同じ言い方）。
 *
 * **役の違った 2 箇所は `InlineNav` へ分けた。**`distribution/calendar` と
 * `admin/generation` は縦の一覧ではなく同格リンクの横並びだったため、旧 `.linkList` を
 * 借りるのをやめた。これで生クラスは参照 0 件になり、旧規則も削除済みである。
 *
 * 見張りは `tests/ui/stacked-list-role.test.ts`。
 */
export function StackedList({
  children,
  ordered = false,
}: {
  readonly children: ReactNode;
  /** 順序に意味があるとき。読み上げが `<ol>` として伝える。見た目は変わらない。 */
  readonly ordered?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  return <Tag className={styles.stackedList}>{children}</Tag>;
}

/**
 * 一覧の 1 行。
 *
 * **説明を `note` で受けるのは、行を割らないためである。**36 箇所が
 * 「主となるもの（リンクや語）＋その説明」の 2 段で、説明は `.linkNote` という
 * 生クラスで書かれていた。ここを `Note` 部品に任せる形も採れたが、採らなかった——
 * `note.tsx` が「一覧の 1 行を部品と生クラスの継ぎ目で割らないこと」と書いており、
 * 行の一部を別部品へ出すと、**継ぎ目が生クラスとの間から部品どうしの間へ移るだけ**で
 * ある。行は 1 つの部品が丸ごと持つ。
 *
 * **`note` を省いた行が過半である。**説明を持たない行が 61 件中 38 件で、
 * そちらが多数派なので、省略可にしてある。省略時は `<span>` ごと出さない
 * ——空の `<span>` が残ると、上の `gap` が 1 段ぶん余計に空く。
 */
export function StackedRow({
  children,
  note,
}: {
  readonly children: ReactNode;
  /** 主となるものの下へ、一段弱く出す説明。無い行のほうが多い。 */
  readonly note?: ReactNode;
}) {
  return (
    <li className={styles.stackedRow}>
      {children}
      {note === undefined ? null : <span className={styles.stackedNote}>{note}</span>}
    </li>
  );
}
