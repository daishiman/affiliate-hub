import type { ReactNode } from "react";
import {
  type ProseCtaTone,
  type ProseNode,
  assertNever,
  parseProse,
  safeEmbedUrl,
  safeHref,
  safeImageSrc,
} from "@/domain/blogops";
import { Icon, SectionHeading } from "@/presentation/ui";
import { ProseTableFrame } from "./prose-table-frame";
import { ProseText } from "./prose-text";
import { CALLOUT_PRESENTATION, CTA_PRESENTATION, normalizeProseTable } from "./prose-presentation";
import styles from "./prose.module.css";

/**
 * 本文を、書かれたとおりの形で描く。
 *
 * **管理画面のエディタと公開面は、同じ断片を同じ規則で描く** (FRONT-REQ-006)。
 * 描き方が 2 か所にあると、編集中に見えていたものと読者が見るものがずれる。
 * ずれた側は誰も気づかない — 運営者は自分の画面しか見ないからである。
 * だから割り方 (`parseProse`) も描き方 (このファイル) も 1 つにしてある。
 *
 * **商品カードだけは自分で描かない。** 商品の名前・価格・リンクは
 * 本文ではなく商品の側が持つ。ここで描こうとすると、商品を直した日に
 * 記事が古い名前を出し続ける。描き方は呼ぶ側から渡してもらう。
 *
 * ## 通せないものの扱い
 *
 * 行き先・埋め込み先・色は、描く直前に許可リストへ通す (SEC-REQ-009・
 * `prose-allowlist.ts`)。**通らなかったときも文字は残す。**
 * 消すと、運営者は自分の書いたものが落ちたことに気づけない。
 */

export type ProductCardRenderer = (productId: string) => ReactNode;

export function ProseBody({
  body,
  keyPrefix,
  renderProductCard,
}: {
  /** 保存されている本文の文字列。素の文章なら段落だけとして描かれる。 */
  readonly body: string;
  /** 兄弟の間で鍵が衝突しないための前置き。節の id を渡す。 */
  readonly keyPrefix: string;
  /**
   * 商品カードの描き方。
   *
   * 渡さないと商品カードは**描かれない**。空の枠や「読み込み中」を出さないのは、
   * それが読者にとって記事の一部に見えるためである。出せないものは出さない。
   */
  readonly renderProductCard?: ProductCardRenderer;
}) {
  const nodes = parseProse(body);
  return (
    <>
      {nodes.map((node, index) => (
        <ProseNodeView
          // biome-ignore lint/suspicious/noArrayIndexKey: 断片は本文の順序そのものが同一性で、他に安定した鍵が無い
          key={`${keyPrefix}-${index}`}
          node={node}
          renderProductCard={renderProductCard}
        />
      ))}
    </>
  );
}

/** 改行を含む文章を段落へ割る。空行では割らない（断片の中は 1 かたまり）。 */
function Lines({ text }: { readonly text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 行は順序が同一性
        <p key={i}>
          <ProseText text={line} />
        </p>
      ))}
    </>
  );
}

function ProseNodeView({
  node,
  renderProductCard,
}: {
  readonly node: ProseNode;
  readonly renderProductCard?: ProductCardRenderer;
}) {
  switch (node.kind) {
    case "paragraph":
      return (
        <p>
          <ProseText text={node.text} />
        </p>
      );

    case "heading":
      /*
        節の見出しが h2 なので、本文の中は h3 と h4 しか取らない。
        飛び級を作らないのは、読み上げが段の深さで位置を伝えるためである。
        段の深さは骨格から導かれ、編集操作では動かない (FRONT-REQ-008)。

        **裸の `<h3>` を書かない。**見出しの見た目は `SectionHeading` が
        1 か所で決めている。ここで直に書くと、強制配色で `color` が均された
        ときに段の手掛かりが消える——`heading.tsx` が `font-weight` と
        `font-size` の両方を必ず当てているのは、その 1 件のためである。
      */
      return (
        <SectionHeading level={node.level}>
          <ProseText text={node.text} />
        </SectionHeading>
      );

    case "bullet-list":
      return (
        <ul>
          {node.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 項目は順序が同一性
            <li key={i}>
              <ProseText text={item} />
            </li>
          ))}
        </ul>
      );

    case "ordered-list":
      return (
        <ol>
          {node.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 項目は順序が同一性
            <li key={i}>
              <ProseText text={item} />
            </li>
          ))}
        </ol>
      );

    case "quote":
      return (
        <blockquote className={styles.proseQuote}>
          <Lines text={node.text} />
        </blockquote>
      );

    case "callout":
      /*
        `role` を付けない。これは**記事の中の注意書き**であって、
        画面が操作を止めた理由 (`Callout`) ではない。読み上げに割り込ませると、
        記事を読み進めている人の順序を壊す。
      */
      return (
        <aside className={[styles.proseCallout, CALLOUT_PRESENTATION[node.tone].className].join(" ")}>
          <Icon name={CALLOUT_PRESENTATION[node.tone].icon} size="md" />
          <div>
            {node.title.trim() !== "" && (
              <strong className={styles.proseCalloutTitle}>
                <ProseText text={node.title} />
              </strong>
            )}
            <Lines text={node.text} />
          </div>
        </aside>
      );

    case "product-card":
      return <>{renderProductCard?.(node.productId) ?? null}</>;

    case "comparison-table":
    case "table": {
      /*
        枠 (`div > table > thead …`) は `ProseTableFrame` が 1 か所で持っている。
        ここが決めるのは**中身が文字であること**だけ。書く側は同じ枠に入力欄を入れる。

        比較表と自由な表は、保存の書き方が違うだけで描き方は同じである。
        違う枠を持たせると、狭い画面での横流しを片方だけ直す日が来る。

        行の長さが揃っていない本文もありうる（`| a | b |` の次が `| c |` など）。
        列数は見出しの数に揃え、足りない桁は空にする。**行を落とさない。**
        落とすと、運営者から見て「保存したら表の行が消えた」ことになる。
      */
      const table = normalizeProseTable(node);
      return (
        <ProseTableFrame
          columnCount={table.headers.length}
          renderCell={(row, col) => <ProseText text={table.rows[row]?.[col] ?? ""} />}
          renderHeaderCell={(col) => <ProseText text={table.headers[col] ?? ""} />}
          rowCount={table.rows.length}
        />
      );
    }

    case "image":
      return (
        <ProseImage
          alt={node.alt}
          className={styles.proseImage}
          height={node.height}
          src={node.src}
          width={node.width}
        />
      );

    case "divider":
      return <hr className={styles.proseDivider} />;

    case "code":
      /*
        **中身を `ProseText` へ通さない。**プログラムの中の `**` は太字ではなく
        そのままの記号である。ここで装飾を効かせると、貼り付けたプログラムが
        読者の画面で書き換わる。

        `data-language` は見た目の手掛かりとして持つだけで、色分けはしない。
        色分けの規則を持ち込むと、言語ごとの正しさをこの画面が背負うことになる。
      */
      return (
        <pre className={styles.proseCodeBlock} data-language={node.language || undefined}>
          <code>{node.text}</code>
        </pre>
      );

    case "image-row":
      return (
        <div className={styles.proseImageRow} data-count={node.images.length}>
          {node.images.map((image, i) => (
            <ProseImage
              alt={image.alt}
              className={styles.proseImageRowItem}
              height={image.height}
              // biome-ignore lint/suspicious/noArrayIndexKey: 枚は順序が同一性
              key={i}
              src={image.src}
              width={image.width}
            />
          ))}
        </div>
      );

    case "toggle":
      /*
        `<details>` を使う。畳み方を自分で書くと、開閉の状態が
        読み上げへ伝わらないうえ、JavaScript が動かない環境で
        中身ごと読めなくなる。**畳んだ中身は「無い」ではない。**

        `<summary>` の中は装飾を通すが、リンクは置かないでほしい形になる
        （押すと開閉と行き先が競合する）。ここでは止めず、書き方の案内に任せる。
      */
      return (
        <details className={styles.proseToggle}>
          <summary className={styles.proseToggleSummary}>
            <ProseText text={node.title} />
          </summary>
          <div className={styles.proseToggleBody}>
            <Lines text={node.text} />
          </div>
        </details>
      );

    case "checklist":
      /*
        **読者は押せない。**記事の中のチェックは「済ませたかどうか」の
        持ち物ではなく、運営者が書いた印である。押せる `<input>` を置くと
        読者は自分の状態が残ると思うが、どこにも残らない。
        だから印は文字ではなくアイコンで描き、操作できないままにする。
      */
      return (
        <ul className={styles.proseChecklist}>
          {node.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 項目は順序が同一性
            <li key={i}>
              <span className={styles.proseCheckMark} data-checked={item.checked}>
                <Icon name={item.checked ? "proseCheckOn" : "proseCheckOff"} />
                {/* 印はアイコンなので、読み上げには文字で同じことを伝える。 */}
                <span className={styles.proseSrOnly}>
                  {item.checked ? "済み" : "未"}
                </span>
              </span>
              <span>
                <ProseText text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "embed":
      return <ProseEmbed title={node.title} url={node.url} />;

    case "cta-button":
      return <ProseCta href={node.href} label={node.label} tone={node.tone} />;

    case "link-card":
      return (
        <ProseLinkCard
          description={node.description}
          title={node.title}
          url={node.url}
        />
      );

    case "columns":
      /*
        枠は 2 つ置くが、**狭い画面では縦に落ちる** (CSS 側)。
        並びは左→右のままなので、読み上げの順序は画面幅で変わらない。
      */
      return (
        <div className={styles.proseColumns}>
          <div>
            <Lines text={node.left} />
          </div>
          <div>
            <Lines text={node.right} />
          </div>
        </div>
      );
  }
  return assertNever(node, "描画できない本文断片です");
}

/**
 * 本文の画像。
 *
 * `alt` が空でも `alt=""` を必ず出す。属性ごと落とすと、読み上げは
 * ファイル名を読み始める。空の `alt` は「読み飛ばしてよい絵」の意味で、
 * 属性が無いのとは違う。
 *
 * 通せない場所を指していたら**何も描かない**。ここだけは文字を残せない
 * ——画像に代わる文字が `alt` しか無く、`alt` だけを地の文に置くと
 * 読者には意味の分からない一行になる。
 *
 * **寸法があれば属性で出す。**ブラウザは `width`/`height` の比だけを見て
 * 場所を先に空けるので、絵が遅れて届いても下の文章が動かない。
 * 表示の大きさは CSS (`max-width:100%; height:auto`) が決めるため、
 * 実寸をそのまま入れても絵が実寸で出るわけではない。
 *
 * **寸法が無い絵は、比を仮に置いて場所だけ空ける** (`proseImageUnsized`)。
 * 既存の記事には寸法が無く、あとから測る手段も無い (workerd に画像
 * デコーダは無い)。何もしなければ読者は読んでいる行を飛ばされる。
 * 仮の比では縦長の絵が小さく出るが、**それは運営者が編集画面を一度
 * 開けば実寸が入って解消する**。読者の側で毎回起きる飛びのほうが重い。
 */
function ProseImage({
  src,
  alt,
  className,
  width,
  height,
}: {
  readonly src: string;
  readonly alt: string;
  readonly className: string;
  readonly width: number | null;
  readonly height: number | null;
}) {
  const safe = safeImageSrc(src);
  if (safe === null) return null;
  const sized = width !== null && height !== null;
  // 運営者入力の URL は寸法も許可ホストも事前確定できないため、最適化 API を経由しない。
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      alt={alt}
      className={sized ? className : `${className} ${styles.proseImageUnsized}`}
      height={height ?? undefined}
      loading="lazy"
      src={safe}
      width={width ?? undefined}
    />
  );
}

/**
 * 外部の埋め込み。
 *
 * **許可したホストだけを `iframe` にする** (SEC-REQ-009)。`iframe` は
 * 宛先へ読者の画面の一区画を明け渡す操作なので、宛先が一覧に無ければ
 * 枠を作らず、代わりに**押せるリンクとして残す**。読者は行き先を選べるし、
 * 運営者は「埋め込みにならなかった」ことに気づける。
 */
function ProseEmbed({ url, title }: { readonly url: string; readonly title: string }) {
  const label = title.trim();
  const embed = safeEmbedUrl(url);
  if (embed === null) {
    const link = safeHref(url);
    if (link === null) return <p>{url}</p>;
    return (
      <p className={styles.proseEmbedFallback}>
        <a href={link} rel="noopener noreferrer">
          {label === "" ? link : label}
        </a>
      </p>
    );
  }
  return (
    <div className={styles.proseEmbed}>
      <iframe
        allowFullScreen
        loading="lazy"
        /*
          `title` は飾りではない。読み上げは `iframe` をこの名前で読む。
          空だと「フレーム」としか言われず、何の埋め込みか分からない。
        */
        title={label === "" ? "埋め込み" : label}
        src={embed}
      />
    </div>
  );
}

/**
 * 押しボタン。
 *
 * `<a>` であって `<button>` ではない。**行き先へ移動する操作は `<a>`** で、
 * ここを `<button>` にすると新しいタブで開けず、右クリックの選択肢も消える。
 */
function ProseCta({
  href,
  label,
  tone,
}: {
  readonly href: string;
  readonly label: string;
  readonly tone: ProseCtaTone;
}) {
  const safe = safeHref(href);
  const text = label.trim();
  if (safe === null) return null;
  const external = !safe.startsWith("/");
  return (
    <p className={styles.proseCtaWrap}>
      <a
        className={[styles.proseCta, CTA_PRESENTATION[tone].className].join(" ")}
        href={safe}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {text === "" ? "詳しく見る" : text}
        <Icon name="external" />
      </a>
    </p>
  );
}

/**
 * リンクカード。
 *
 * 見出しと説明を運営者が書く。**行き先のページから取ってこない。**
 * 取ってくると、記事を描くたびに外部へ問い合わせることになり、
 * 相手が落ちている日に記事が出なくなる。
 */
function ProseLinkCard({
  url,
  title,
  description,
}: {
  readonly url: string;
  readonly title: string;
  readonly description: string;
}) {
  const safe = safeHref(url);
  if (safe === null) return null;
  const label = title.trim();
  const external = !safe.startsWith("/");
  return (
    <a
      className={styles.proseLinkCard}
      href={safe}
      rel={external ? "noopener noreferrer" : undefined}
    >
      <span className={styles.proseLinkCardTitle}>{label === "" ? safe : label}</span>
      {description.trim() !== "" && (
        /*
          説明は素の文字にする。`<a>` の中に `<a>` は置けないので、
          装飾を通すとリンクの中のリンクが生まれる。**書けてしまう形を
          残さない**ほうが、描画時に黙って壊れるより良い。
        */
        <span className={styles.proseLinkCardDesc}>{description}</span>
      )}
      <span className={styles.proseLinkCardHost}>{safe}</span>
    </a>
  );
}
