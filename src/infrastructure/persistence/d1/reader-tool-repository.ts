import { and, eq } from "drizzle-orm";
import type {
  EditorialReaderToolPort,
  ReaderToolDefinition,
} from "@/application/ports/reader-interaction";
import { readerTools, type ReaderToolRow } from "@/db/schema";
import { runReaderToolFormula } from "@/domain/authoring/reader-tool-formula";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
import { BUILT_IN_READER_TOOLS } from "../sample/reader-interaction-sample";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 診断・計算の道具の保存先（D1）。
 *
 * **これはスタブではない。** 定義も計算式も保存側から取り、実際に計算して返す。
 *
 * --- 計算はどこでするか ---
 * ここではしない。`src/domain/authoring/reader-tool-formula.ts` がする。
 * 保存の都合（列の形・JSON の入れ物）と、計算の決まり（式の読み方・0 除算の扱い）を
 * 同じ場所に置くと、**保存先を替えたときに計算の結果まで変わりうる**。
 *
 * --- 作り付けの道具を重ねる ---
 * 保存先を繋いだ瞬間に、それまで動いていた道具が一覧から消えると、
 * 運営者から見て「登録し忘れ」なのか「壊れた」のかを画面から見分けられない。
 * **保存されたほうを先に置いてから作り付けで埋める。**
 * 同じ `slug` を登録すれば、運営者の定義が作り付けに勝つ。
 */

function toDefinition(row: ReaderToolRow): ReaderToolDefinition {
  return {
    slug: row.slug,
    name: row.name,
    purpose: row.purpose,
    inputs: row.inputs.map((i) => ({
      key: i.key,
      label: i.label,
      ...(i.hint === undefined ? {} : { hint: i.hint }),
      ...(i.unit === undefined ? {} : { unit: i.unit }),
    })),
    howToRead: row.howToRead,
  };
}

function storedJson(value: unknown, field: string): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new TypeError(`reader_tools.${field} が JSON ではありません。`);
  }
}

function recordOf(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`reader_tools.${field} の形が正しくありません。`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`reader_tools.${field} が文字ではありません。`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : stringValue(value, field);
}

function decodeInputs(value: unknown): ReaderToolRow["inputs"] {
  const decoded = storedJson(value, "inputs");
  if (!Array.isArray(decoded)) {
    throw new TypeError("reader_tools.inputs が配列ではありません。");
  }
  return decoded.map((item, index) => {
    const input = recordOf(item, `inputs[${index}]`);
    const hint = optionalString(input.hint, `inputs[${index}].hint`);
    const unit = optionalString(input.unit, `inputs[${index}].unit`);
    return {
      key: stringValue(input.key, `inputs[${index}].key`),
      label: stringValue(input.label, `inputs[${index}].label`),
      ...(hint === undefined ? {} : { hint }),
      ...(unit === undefined ? {} : { unit }),
    };
  });
}

function decodeFormula(value: unknown): ReaderToolRow["formula"] {
  const formula = recordOf(storedJson(value, "formula"), "formula");
  if (!Array.isArray(formula.rows)) {
    throw new TypeError("reader_tools.formula.rows が配列ではありません。");
  }
  return {
    rows: formula.rows.map((item, index) => {
      const row = recordOf(item, `formula.rows[${index}]`);
      const unit = optionalString(row.unit, `formula.rows[${index}].unit`);
      const as = optionalString(row.as, `formula.rows[${index}].as`);
      const decimals = row.decimals;
      if (
        decimals !== undefined &&
        (typeof decimals !== "number" ||
          !Number.isInteger(decimals) ||
          decimals < 0 ||
          decimals > 20)
      ) {
        throw new TypeError(`reader_tools.formula.rows[${index}].decimals の形が正しくありません。`);
      }
      return {
        label: stringValue(row.label, `formula.rows[${index}].label`),
        expression: stringValue(row.expression, `formula.rows[${index}].expression`),
        ...(unit === undefined ? {} : { unit }),
        ...(decimals === undefined ? {} : { decimals }),
        ...(as === undefined ? {} : { as }),
      };
    }),
    summary: stringValue(formula.summary, "formula.summary"),
  };
}

/** D1 の JSON 列は型アサーションで信頼せず、読み出し境界で形を確定する。 */
function decodeStoredRow(row: ReaderToolRow): ReaderToolRow {
  return {
    ...row,
    inputs: decodeInputs(row.inputs),
    formula: decodeFormula(row.formula),
  };
}

export function createD1ReaderToolRepository(db: DrizzleD1): EditorialReaderToolPort {
  async function findRow(siteSlug: string, slug: string): Promise<ReaderToolRow | null> {
    const rows = (await db
      .select()
      .from(readerTools)
      .where(and(eq(readerTools.siteSlug, siteSlug), eq(readerTools.slug, slug)))) as ReaderToolRow[];
    return rows[0] === undefined ? null : decodeStoredRow(rows[0]);
  }

  function builtInsFor(siteSlug: string) {
    return BUILT_IN_READER_TOOLS.filter(
      (tool) => tool.siteSlugs === undefined || tool.siteSlugs.includes(siteSlug),
    );
  }

  function builtIn(siteSlug: string, slug: string) {
    return builtInsFor(siteSlug).find((t) => t.definition.slug === slug) ?? null;
  }

  return markEditorial({
    async find(siteSlug: string, slug: string) {
      try {
        const row = await findRow(siteSlug, slug);
        if (row !== null) return ok(toDefinition(row));
        return ok(builtIn(siteSlug, slug)?.definition ?? null);
      } catch (cause) {
        return storageFailure("道具の読み出し", cause);
      }
    },

    async list(siteSlug: string) {
      try {
        const rows = (await db
          .select()
          .from(readerTools)
          .where(eq(readerTools.siteSlug, siteSlug))) as ReaderToolRow[];
        const stored = rows.map(decodeStoredRow).map(toDefinition);
        const taken = new Set(stored.map((d) => d.slug));
        const all = [
          ...stored,
          ...builtInsFor(siteSlug).filter((t) => !taken.has(t.definition.slug)).map(
            (t) => t.definition,
          ),
        ];
        // 並びは名前順。登録した順にすると、道具を直すたびに一覧の並びが動く。
        return ok([...all].sort((a, b) => a.name.localeCompare(b.name, "ja")));
      } catch (cause) {
        return storageFailure("道具の一覧", cause);
      }
    },

    async run(siteSlug: string, slug: string, values: Readonly<Record<string, string>>) {
      let row: ReaderToolRow | null;
      try {
        row = await findRow(siteSlug, slug);
      } catch (cause) {
        return storageFailure("道具の読み出し", cause);
      }
      if (row !== null) {
        // 計算の失敗（欄が空・数字でない・0 で割る）は、そのまま読者へ返す。
        // どの欄が原因かは `field` に載っているので、画面はその欄の下に出せる。
        return runReaderToolFormula(row.formula, row.inputs, values);
      }
      const fallback = builtIn(siteSlug, slug);
      if (fallback === null) {
        return err(
          domainError("NOT_FOUND", `「${slug}」という道具は登録されていません。`, {
            suggestedAction: "トップから探し直してください。",
          }),
        );
      }
      return runReaderToolFormula(fallback.formula, fallback.definition.inputs, values);
    },
  });
}
