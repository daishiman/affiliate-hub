import type { ExpressionBlock } from "@/domain/authoring/blog-template";
import { FactList, SectionHeading } from "@/presentation/ui";

function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ExpressionBlockView({ block }: { readonly block: ExpressionBlock }) {
  switch (block.kind) {
    case "answer":
    case "summary":
      return <p>{block.text}</p>;
    case "key_points":
      return <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
    case "faq":
      return (
        <FactList
          rows={block.items.map((item) => ({
            key: item.question,
            label: item.question,
            value: item.answer,
          }))}
        />
      );
    case "sources":
      return (
        <ul>
          {block.items.map((item) => {
            const href = item.url === undefined ? null : safeHref(item.url);
            return (
              <li key={`${item.label}:${item.checkedAt}`}>
                {href === null ? item.label : <a href={href}>{item.label}</a>}
                {`（${item.checkedAt} 確認）`}
              </li>
            );
          })}
        </ul>
      );
    case "freshness":
      return <p><time dateTime={block.asOf}>{block.asOf}</time>{block.note ? ` — ${block.note}` : ""}</p>;
    case "figure":
      return <figure aria-label={block.alt}><figcaption>{block.caption}</figcaption></figure>;
    case "comparison":
      return <p>{block.caption}</p>;
    case "cta": {
      const href = safeHref(block.href);
      return href === null ? <p>{block.label}</p> : <p><a href={href}>{block.label}</a></p>;
    }
    case "spec_table":
      return (
        <table>
          <tbody>
            {block.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}
          </tbody>
        </table>
      );
  }
}

export function ExpressionArticleSection({
  heading,
  block,
}: {
  readonly heading: string;
  readonly block: ExpressionBlock;
}) {
  return (
    <section>
      <SectionHeading level={2}>{heading}</SectionHeading>
      <ExpressionBlockView block={block} />
    </section>
  );
}
