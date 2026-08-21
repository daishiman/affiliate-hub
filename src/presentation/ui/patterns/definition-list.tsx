import type { ReactNode } from "react";
import styles from "./patterns.module.css";

/**
 * 項目と値の対を並べる。**表ではない。**
 *
 * `DataTable` と対になる部品である。どちらを使うかは、
 * **列に名前が付くかどうか**で決まる。
 *
 *   - 同じ形の行が複数あり、列に「価格」「在庫」のような名前が付く → `DataTable`
 *   - 「名前: あれ」「役割: これ」のように、1 行ごとに項目が違う → こちら
 *
 * この区別が要る理由は、2026-08-21 に間違えたからである。`src/app/signin/page.tsx`
 * の「担当者 / 役割」の 2 行を `DataTable` へ通したとき、列の名前が無いために
 * **「項目 / 値」という中身の無い見出しを発明していた**。読み上げると
 * 「項目、担当者、値、xxx」と出る。**中身の無い見出しが生えたら、
 * 器の選択が間違っているという合図である。**（残課題 142）
 *
 * ---
 *
 * **寄せは項目の性質である。**`align: "numeric"` は `dd` にだけ当たる
 * （`dt` は項目の名前で、数字ではない）。ここが `DataTable` と違う点で、
 * 向こうは見出しと値の**両方**へ同じ寄せを当てる——列の名前は数字の列の
 * 名前だからである。この非対称は意図したもので、揃えてはいけない。
 *
 * **`className` の口は開けない。**開くと、呼び出し側が `dd` へ直に
 * 寄せのクラスを当てられる裏口が復活し、`align` を項目の属性にした意味が消える。
 */
export interface DefinitionItem {
  /** 項目の名前。`dt` になる。 */
  readonly term: string;
  /** 値。`dd` になる。 */
  readonly description: ReactNode;
  /**
   * 数字として並べるか。`dd` だけが右寄せ・等幅数字になる。
   * 桁を揃えて比べたい値にだけ付けること（件数・金額・本数）。
   */
  readonly align?: "numeric";
}

export interface DefinitionListProps {
  readonly items: readonly DefinitionItem[];
}

export function DefinitionList({ items }: DefinitionListProps) {
  return (
    <dl className={styles.defList}>
      {items.map((item, index) => (
        // `dt`/`dd` を `div` で包む。包まないと、`display: grid` の
        // 直接の子が `dt` と `dd` の交互になり、対の関係が並びから読めなくなる。
        //
        // key に位置を混ぜる理由: 項目の名前は一意とは限らない
        // （`admin/content/matrix` は「媒体名: 状態」を項目にしていて、
        // 同じ状態が複数の媒体で並ぶ）。名前だけを key にすると重複する。
        // 並び替えは起きない一覧なので、位置を混ぜて構わない。
        <div key={`${index}:${item.term}`} className={styles.defRow}>
          <dt className={styles.defTerm}>{item.term}</dt>
          <dd className={item.align === "numeric" ? styles.defNumeric : styles.defValue}>
            {item.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}
