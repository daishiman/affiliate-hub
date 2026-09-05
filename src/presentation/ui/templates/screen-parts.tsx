import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./screen-parts.module.css";

/**
 * 画面を組み立てるための、意味を持たない部品。
 *
 * ---
 *
 * **なぜ生タグを画面に書かせないのか。**
 *
 * `<h2 className={styles.sectionTitle}>` は 49 枚の画面に散り、
 * どの画面も「見出しは h2、説明文はその下の p」という**書かれていない約束**を
 * 守っていた。守れているうちは何も起きない。破れたときに起きるのは、
 * その 1 枚だけが読み上げで階層の飛んだ画面になることで、
 * **破れた側は自分が破れたことを言わない**（実際 `admin/settings/roles` が
 * h1 の直下に h3 を置いていた）。
 *
 * 約束を部品にすると、破りようが無くなる。ここに在るのはその置き換えで、
 * どれも仕様を知らない——知っているのは `patterns/` の側である。
 *
 * ---
 *
 * **見た目の値をここに書かない。** 余白も文字の大きさも
 * `screen-parts.module.css` がトークンから取る。画面側が `className` を
 * 渡せる作りにしないのも同じ理由で、渡せると渡した画面だけが別の見た目になる。
 */

/**
 * 節。見出し・説明文・本文をひとまとまりにする。
 *
 * 見出しは必ず `h2`。画面の見出し（`Page` の `h1`）の直下に来るので、
 * ここを `h3` にすると階層が飛ぶ。**選べないことがこの部品の仕事**である。
 */
export function Section({
  title,
  lead,
  children,
}: {
  readonly title: string;
  /** この節で何ができるかの 1 文。無い節もある（見出しだけで足りるとき）。 */
  readonly lead?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {lead === undefined ? null : <p className={styles.lead}>{lead}</p>}
      {children}
    </section>
  );
}

/**
 * 節の中の塊。`Section` の内側にだけ置く。
 *
 * 見出しは必ず `h3`。`Section` の `h2` の 1 つ下だからで、
 * ここでも段は選べない。**同じ物が並ぶとき**に使う
 * （ブランドが 3 件、広告表記が 2 件、というような並び）。
 *
 * カードを重ねない。カードの中にカードを置くと、
 * 枠が二重になって「どちらが 1 件分か」が見た目から読めなくなる。
 */
export function SubSection({
  title,
  lead,
  children,
}: {
  readonly title: ReactNode;
  readonly lead?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <div className={styles.subSection}>
      <h3 className={styles.subTitle}>{title}</h3>
      {lead === undefined ? null : <p className={styles.lead}>{lead}</p>}
      {children}
    </div>
  );
}

/**
 * 読ませる文。
 *
 * 行の長さに上限がある。上限が無いと、画面を広げたぶんだけ 1 行が伸び、
 * 読み終えた行の次がどこかを見失う。
 */
export function Prose({ children }: { readonly children: ReactNode }) {
  return <p className={styles.lead}>{children}</p>;
}

/** 箇条書き 1 行分。行き先があるなら `href` を持つ。 */
export type ListRow = {
  readonly key: string;
  /** 行の主。リンクにするなら `href` と一緒に渡す。 */
  readonly label: ReactNode;
  readonly href?: string;
  /** 行の下に付く 1 行。無くてよい。 */
  readonly note?: ReactNode;
};

/**
 * 縦に積む一覧。
 *
 * 表にしないのは、**列が 1 つしかないものを表にすると、
 * 列見出しを付ける場所が無くなる**ため。項目が増えて列が要るようになったら
 * `DataTable` へ移る。
 */
export function ListView({ rows }: { readonly rows: readonly ListRow[] }) {
  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <li key={row.key}>
          {row.href === undefined ? row.label : <Link href={row.href}>{row.label}</Link>}
          {row.note === undefined ? null : <span className={styles.note}>{row.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * 順番に意味がある並び。
 *
 * `ListView` と分けているのは、**順番が入れ替わると意味が壊れる**ものと
 * そうでないものを、書く側が選べてしまわないようにするため。
 * 番号は読み上げにも渡る（`ol` なので「1 番目の項目」と読まれる）。
 */
export function StepList({ rows }: { readonly rows: readonly ListRow[] }) {
  return (
    <ol className={styles.list}>
      {rows.map((row) => (
        <li key={row.key}>
          {row.href === undefined ? row.label : <Link href={row.href}>{row.label}</Link>}
          {row.note === undefined ? null : <span className={styles.note}>{row.note}</span>}
        </li>
      ))}
    </ol>
  );
}

/** 表の列 1 つ。 */
export type TableColumn = {
  readonly key: string;
  readonly label: string;
  /** 数字の列。桁を揃えて右へ寄せる。並べて比べるための列なので。 */
  readonly numeric?: boolean;
};

/** 表の行 1 つ。`cells` の並びは `columns` と同じ順。 */
export type TableRow = {
  readonly key: string;
  readonly cells: readonly ReactNode[];
};

/**
 * 表。
 *
 * 1 列目を `th scope="row"` にする。読み上げで、どの行の値かが
 * セルごとに分かるようにするため。列見出しだけだと、
 * 3 列目を読んだ時点で何の行にいたか分からなくなる。
 */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  /** 表が何の一覧かの 1 文。読み上げは最初にこれを読む。 */
  readonly caption: string;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
}) {
  return (
    <div className={styles.tableWrap} role="group" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.numeric ? styles.numeric : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, i) => {
                const column = columns[i];
                const key = column?.key ?? String(i);
                return i === 0 ? (
                  <th key={key} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={key} className={column?.numeric ? styles.numeric : undefined}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 項目と値の組 1 つ。 */
export type FactRow = {
  readonly key: string;
  readonly label: string;
  readonly value: ReactNode;
};

/**
 * 項目と値の一覧。
 *
 * 2 列の表にしない。表は**行どうしを比べる**ためのもので、
 * こちらは 1 つの物の中身を並べている。読み上げも「項目、値」と対で読む。
 */
export function FactList({ rows }: { readonly rows: readonly FactRow[] }) {
  return (
    <dl className={styles.facts}>
      {rows.map((row) => (
        <div key={row.key} className={styles.factRow}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 操作できる 1 件の見出しと、その件の状態を述べる行。
 *
 * 「住所 1 件」「SEO の指摘 1 件」のように、**1 件に対する押しボタンが
 * 同じ枠に並ぶ**形で繰り返し要る。名前を強調し、添え字で今の位置づけを
 * 言い、その下に状態を数行で述べる、という並びは 2 か所で同じだった。
 *
 * 表 (`DataTable`) にしないのは、行どうしを比べる場面ではないため。
 * ここは 1 件を読んで、その 1 件に手を打つ場所である。
 */
export function RowSummary({
  heading,
  aside,
  lines,
}: {
  /** その件の名前。読者や運営者がこの件を呼ぶときの言い方。 */
  readonly heading: string;
  /** 名前に添える一言。今の位置づけ（正規の住所である、どの記事の指摘か）。 */
  readonly aside?: string | null;
  /** 状態を述べる行。空文字は渡さず、出さない行は呼ぶ側で落とす。 */
  readonly lines: readonly string[];
}) {
  return (
    <div className={styles.subSection}>
      <p className={styles.lead}>
        <strong>{heading}</strong>
        {aside === undefined || aside === null ? null : aside}
      </p>
      {lines.map((line) => (
        <p key={line} className={styles.note}>
          {line}
        </p>
      ))}
    </div>
  );
}

/**
 * 表の 1 行を選ぶための印。
 *
 * ラベルを省けない形にしてある。印だけを置くと、読み上げでは
 * 「チェックボックス」としか読まれず、**何行目のものかが分からない**。
 * 目で見ている人には行の位置で分かるが、それは目で見ている人だけの手がかりである。
 *
 * ラベルの字は見せる。`sr-only` で隠すと、狭い画面で印だけが並び、
 * どれが何の行か目でも追えなくなる。
 */
export function RowSelector({
  name,
  value,
  label,
}: {
  /** まとめて送るときの名前。同じ名前を全行に付ける。 */
  readonly name: string;
  readonly value: string;
  /** その行が何かを言う 1 行。「◯◯ を渡す」のように動詞まで書く。 */
  readonly label: string;
}) {
  return (
    <label className={styles.rowSelector}>
      <input type="checkbox" name={name} value={value} />
      <span className={styles.note}>{label}</span>
    </label>
  );
}

/**
 * 畳んでおく塊。
 *
 * **何件あるかは畳んだまま見せる**のがこの部品の決めごとで、
 * `summary` に件数を書く。0 件と「畳まれていて分からない」は違う。
 * 畳んだ中身が空かどうかを、開かないと分からない作りにしない。
 *
 * 既定で閉じている。読む人の 9 割に関係が無いものを開いたまま置くと、
 * 本文が下へ押し出され、一番読んでほしいものが読まれなくなる。
 */
export function Foldable({
  summary,
  children,
}: {
  /** 開く前に見えている 1 行。件数や範囲をここに書く。 */
  readonly summary: string;
  readonly children: ReactNode;
}) {
  return (
    <details className={styles.foldable}>
      <summary className={styles.foldableSummary}>{summary}</summary>
      <div className={styles.foldableBody}>{children}</div>
    </details>
  );
}

/**
 * 画像と、その下の 1 行。
 *
 * `alt` を省けない形にしてある。省いた画像は、読み上げでは
 * **存在しないのと同じ**になり、送られてきた画面の写しが 1 枚まるごと消える。
 *
 * `next/image` を使わない。最適化は画像を別の場所へ複製し、
 * 複製先は保存期間の外に出る。「180 日で消えます」が効かなくなる。
 */
export function Figure({
  src,
  alt,
  note,
}: {
  readonly src: string;
  readonly alt: string;
  readonly note?: ReactNode;
}) {
  return (
    <figure className={styles.figure}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={styles.figureImage} />
      {note === undefined ? null : (
        <figcaption className={styles.note}>{note}</figcaption>
      )}
    </figure>
  );
}

/**
 * 文の中に置くリンク。
 *
 * `next/link` を画面に直接書かせないのは、**行き先の書き方を 1 か所に
 * 集めるため**ではなく、リンクの見た目が画面ごとに分かれるのを防ぐため。
 */
export function TextLink({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return <Link href={href}>{children}</Link>;
}

/**
 * この仕組みの外へ出るリンク。
 *
 * 別のタブで開く。開いた先から戻ってこられないと、
 * 配信の一覧を見ていた人が、確認しに行ったきり戻れなくなる。
 *
 * `rel` を省けない形にしてある。`target="_blank"` だけを書くと、
 * 開いた先のページから**こちらのタブを別の場所へ差し替えられる**。
 * 戻ったときには、同じ見た目の別物が開いている。
 */
export function ExternalLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

/**
 * 打ち込む名前をそのまま出す。道具名・欄名・場所の書き方など。
 *
 * 等幅にするのは見た目のためではなく、**1 文字違うと別物になる**ものだと
 * 読む側へ伝えるため。`l` と `1`、`0` と `O` が同じ形に見える字では、
 * 写し間違いが写した側にも見えない。
 */
export function Code({ children }: { readonly children: ReactNode }) {
  return <code className={styles.code}>{children}</code>;
}

/**
 * そのまま写し取ってもらう塊。貼り付け用の下書きなどに使う。
 *
 * 改行と字下げを保つ。整形して出すと、貼った先で見出しの段が変わる。
 * 折り返しは許す。折り返さないと、長い 1 行があるだけで
 * 横に切れ、切れた先を読むには横へ動かす操作が要る。
 */
export function CodeBlock({ children }: { readonly children: string }) {
  return <pre className={styles.codeBlock}>{children}</pre>;
}

/**
 * 縦に積む器。カードの中で塊を分けるときに使う。
 *
 * 間隔はこの器が持つ。中身の側に外余白を付けると、
 * 2 つ並べたときにだけ余白が二重になる。
 */
export function Stack({ children }: { readonly children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

/**
 * 横に並べる器。入り切らなければ折り返す。
 *
 * 折り返しを止めないのは、狭い画面で**横に切れて読めなくなる**より、
 * 縦に伸びるほうが読めるため。
 */
export function Row({ children }: { readonly children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
