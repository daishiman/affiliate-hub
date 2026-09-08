import type { ReactNode } from "react";
import {
  type ProseInline,
  type ProseMark,
  parseInline,
  safeHref,
} from "@/domain/blogops";
import styles from "./prose.module.css";

/**
 * 行の中の装飾を描く (FRONT-REQ-007)。
 *
 * **文字を持つ断片は、必ずこれを通す。**段落・見出し・箇条書き・引用・
 * 注意書き・表の桝目——どこでも同じ記法が同じ見た目になるようにするため、
 * 「ここは装飾なし」という例外を作らない。作った瞬間に、運営者は
 * 「太字が効く場所と効かない場所」を覚えることになる。
 *
 * **読めなかった記法は文字として出る。**`parseInline` が記法として読めない
 * ものを素の文字として返すので、ここは受け取ったものを描くだけでよい。
 * 消す判断をこの層でしない。
 */

/**
 * 装飾の付いた 1 行を描く。
 *
 * 改行は含めない。複数行を描くときは呼ぶ側が行へ割ってから渡す
 * （どの要素で行を分けるかは断片ごとに違うため）。
 */
export function ProseText({ text }: { readonly text: string }) {
  const runs = parseInline(text);
  return (
    <>
      {runs.map((run, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 走りは行の中の順序そのものが同一性
        <ProseRun key={index} run={run} />
      ))}
    </>
  );
}

function ProseRun({ run }: { readonly run: ProseInline }) {
  /*
    印は外側から内側の順で並んでいる (`prose-inline.ts` の `MARK_ORDER`)。
    包むのは内側からなので、後ろから当てていく。
  */
  let out: ReactNode = run.text;
  for (let i = run.marks.length - 1; i >= 0; i -= 1) {
    out = wrap(run.marks[i] as ProseMark, out);
  }
  return <>{out}</>;
}

function wrap(mark: ProseMark, children: ReactNode): ReactNode {
  switch (mark.kind) {
    case "bold":
      return <strong>{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "strike":
      /*
        `<s>` であって `<del>` ではない。`<del>` は「版として消された」意味で、
        読み上げが差分として伝える。本文の打ち消しは見た目の強調である。
      */
      return <s>{children}</s>;
    case "code":
      return <code className={styles.proseCode}>{children}</code>;
    case "link":
      return <ProseLink href={mark.href}>{children}</ProseLink>;
    case "color":
      return (
        <span className={styles.proseInkColor} data-token={mark.token}>
          {children}
        </span>
      );
    case "bg":
      return (
        <span className={styles.proseInkBg} data-token={mark.token}>
          {children}
        </span>
      );
  }
}

/**
 * 本文の中のリンク。
 *
 * **通せない行き先はリンクにしない。**`javascript:` のような行き先を
 * `<a>` にすると、読者が押した先で何が起きるかを運営者が決めていない
 * ことになる (SEC-REQ-009)。ただし**文字は残す**——リンクごと消すと、
 * 運営者は自分の書いた案内が落ちたことに気づけない。
 */
function ProseLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  const safe = safeHref(href);
  if (safe === null) return <>{children}</>;
  const external = !safe.startsWith("/");
  return (
    <a
      href={safe}
      /*
        外部へ出るリンクだけ `rel` を付ける。`noreferrer` まで付けるのは、
        飛んだ先へ「どの記事から来たか」を渡さないためではなく、
        `window.opener` 経由でこちらのタブを触らせないためである。
      */
      rel={external ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}
