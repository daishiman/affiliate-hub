import type { AdminActionFailure } from "./use-case-result";

export type ParsedActionInput<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: AdminActionFailure };

function accepted<T>(value: T): ParsedActionInput<T> {
  return { ok: true, value };
}

function rejected(field: string, label: string): ParsedActionInput<never> {
  return {
    ok: false,
    failure: {
      status: "failed",
      message: `${label}が正しくありません。画面を読み直してもう一度お試しください。`,
      field,
    },
  };
}

/** フォームから来た文字を、列挙された業務語だけへ絞る。 */
export function parseEnumOrFailure<const Values extends readonly string[]>(
  value: string,
  allowed: Values,
  options: { readonly field: string; readonly label: string },
): ParsedActionInput<Values[number]> {
  return allowed.includes(value as Values[number])
    ? accepted(value as Values[number])
    : rejected(options.field, options.label);
}

/** 知らない intent を、作成や保存など別の mutation へ寄せない。 */
export function parseIntentOrFailure<const Values extends readonly string[]>(
  value: string,
  allowed: Values,
): ParsedActionInput<Values[number]> {
  return parseEnumOrFailure(value, allowed, { field: "intent", label: "操作の指定" });
}

type FieldOptions = {
  readonly field: string;
  readonly label: string;
};

/** 空文字を意味のある値として許しつつ、欄そのものの欠落は断る。 */
export function parsePresentTextOrFailure(
  formData: FormData,
  options: FieldOptions,
): ParsedActionInput<string> {
  const values = formData.getAll(options.field);
  if (values.length !== 1 || typeof values[0] !== "string") {
    return rejected(options.field, options.label);
  }
  return accepted(values[0].trim());
}

/** `Number(null) === 0` や `Number("x") === NaN` を mutation へ渡さない。 */
export function parseFiniteIntegerOrFailure(
  formData: FormData,
  options: FieldOptions & { readonly min?: number; readonly max?: number },
): ParsedActionInput<number> {
  const text = parsePresentTextOrFailure(formData, options);
  if (!text.ok) return text;
  if (text.value === "") return rejected(options.field, options.label);

  const value = Number(text.value);
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    (options.min !== undefined && value < options.min) ||
    (options.max !== undefined && value > options.max)
  ) {
    return rejected(options.field, options.label);
  }
  return accepted(value);
}

/**
 * HTML checkbox の unchecked は値を送らない。
 * それとフォーム改変による欄欠落を、必須の hidden marker で見分ける。
 */
export function parseCheckboxWithMarkerOrFailure(
  formData: FormData,
  options: FieldOptions & { readonly markerField: string },
): ParsedActionInput<boolean> {
  const markers = formData.getAll(options.markerField);
  if (markers.length !== 1 || markers[0] !== "1") {
    return rejected(options.field, options.label);
  }

  const values = formData.getAll(options.field);
  if (values.length === 0) return accepted(false);
  return values.length === 1 && values[0] === "on"
    ? accepted(true)
    : rejected(options.field, options.label);
}

export type ParsedArticleBlock<Kind extends string> = {
  readonly id?: string;
  readonly kind: Kind;
  readonly heading: string;
  readonly body: string;
};

/**
 * 記事部品の連番行を読む。
 *
 * 最初に行番号を全部集める。0, 2 だけが届いたときに 0 で読み終えると、
 * 2 番の入力を黙って捨てることになるため、欠番は保存前に断る。
 */
export function parseArticleBlocksOrFailure<const Kinds extends readonly string[]>(
  formData: FormData,
  allowedKinds: Kinds,
): ParsedActionInput<readonly ParsedArticleBlock<Kinds[number]>[]> {
  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = /^blocks\[(\d+)\]\.(?:id|kind|heading|body)$/.exec(key);
    if (match !== null) indexes.add(Number(match[1]));
  }

  const ordered = [...indexes].sort((left, right) => left - right);
  for (let expected = 0; expected < ordered.length; expected += 1) {
    if (ordered[expected] !== expected) {
      return rejected(`blocks[${expected}].kind`, "記事部品の並び");
    }
  }

  const blocks: ParsedArticleBlock<Kinds[number]>[] = [];
  for (const index of ordered) {
    const field = `blocks[${index}].kind`;
    const kind = parseEnumOrFailure(String(formData.get(field) ?? ""), allowedKinds, {
      field,
      label: "記事部品の種類",
    });
    if (!kind.ok) return kind;

    const id = String(formData.get(`blocks[${index}].id`) ?? "").trim();
    blocks.push({
      ...(id === "" ? {} : { id }),
      kind: kind.value,
      heading: String(formData.get(`blocks[${index}].heading`) ?? "").trim(),
      body: String(formData.get(`blocks[${index}].body`) ?? "").trim(),
    });
  }
  return accepted(blocks);
}
