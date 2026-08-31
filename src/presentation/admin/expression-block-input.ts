import {
  EXPRESSION_BLOCK_KINDS,
  type ExpressionBlock,
} from "@/domain/authoring/blog-template";
import { parseEnumOrFailure, type ParsedActionInput } from "./blog-action-input";
import { parseNonEmptyLines } from "./non-empty-lines";

/** 編集画面だけの種類一覧を作らず、domainの10種をそのまま入力契約にする。 */
export const INSERTABLE_EXPRESSION_BLOCK_KINDS = EXPRESSION_BLOCK_KINDS;

function invalid(field: string, message: string): ParsedActionInput<never> {
  return { ok: false, failure: { status: "failed", field, message } };
}

function safeLink(raw: string): string | null {
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseExpressionBlockInput(
  formData: FormData,
): ParsedActionInput<ExpressionBlock> {
  const kind = parseEnumOrFailure(
    String(formData.get("kind") ?? ""),
    INSERTABLE_EXPRESSION_BLOCK_KINDS,
    { field: "kind", label: "表現ブロックの種類" },
  );
  if (!kind.ok) return kind;
  const content = String(formData.get("content") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  if (content === "") return invalid("content", "内容を入力してください。");

  switch (kind.value) {
    case "answer":
      return { ok: true, value: { kind: "answer", text: content } };
    case "key_points":
      return { ok: true, value: { kind: "key_points", items: parseNonEmptyLines(content) } };
    case "faq": {
      const items = parseNonEmptyLines(content).map((line) => {
        const separator = line.indexOf("|");
        if (separator < 1) return null;
        const question = line.slice(0, separator).trim();
        const answer = line.slice(separator + 1).trim();
        return question === "" || answer === "" ? null : { question, answer };
      });
      return items.some((item) => item === null)
        ? invalid("content", "質問は1行に「質問 | 回答」の形で入力してください。")
        : { ok: true, value: { kind: "faq", items: items as { question: string; answer: string }[] } };
    }
    case "sources": {
      const items = parseNonEmptyLines(content).map((line) => {
        const [label = "", checkedAt = "", rawUrl = "", ...extra] = line
          .split("|")
          .map((part) => part.trim());
        if (label === "" || !isIsoDate(checkedAt) || extra.length > 0) return null;
        if (rawUrl === "") return { label, checkedAt };
        const url = safeLink(rawUrl);
        return url === null ? null : { label, checkedAt, url };
      });
      return items.some((item) => item === null)
        ? invalid("content", "出典は1行に「名称 | YYYY-MM-DD | URL（省略可）」の形で入力してください。")
        : {
            ok: true,
            value: {
              kind: "sources",
              items: items as { label: string; checkedAt: string; url?: string }[],
            },
          };
    }
    case "freshness":
      return !isIsoDate(content)
        ? invalid("content", "確認日は YYYY-MM-DD の形で入力してください。")
        : {
            ok: true,
            value: { kind: "freshness", asOf: content, ...(detail === "" ? {} : { note: detail }) },
          };
    case "figure":
      return detail === ""
        ? invalid("detail", "図解の代替テキストを入力してください。")
        : { ok: true, value: { kind: "figure", caption: content, alt: detail } };
    case "comparison":
      return { ok: true, value: { kind: "comparison", caption: content } };
    case "cta": {
      const href = safeLink(detail);
      return href === null
        ? invalid("detail", "移動先は / から始まる公開パスか http(s) URL を入力してください。")
        : { ok: true, value: { kind: "cta", label: content, href } };
    }
    case "summary":
      return { ok: true, value: { kind: "summary", text: content } };
    case "spec_table": {
      const rows = content.split(/\r?\n/).map((line) => {
        const separator = line.search(/[:：]/);
        return separator < 1
          ? null
          : { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
      });
      if (rows.some((row) => row === null || row.label === "" || row.value === "")) {
        return invalid("content", "スペックは 1 行に「項目: 値」の形で入力してください。");
      }
      return {
        ok: true,
        value: { kind: "spec_table", rows: rows as { label: string; value: string }[] },
      };
    }
  }
}
