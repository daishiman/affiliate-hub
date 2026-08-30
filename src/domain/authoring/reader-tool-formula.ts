import { type DomainError, type Result, domainError, err, ok, validationError } from "@/domain/shared";

/**
 * 読者向けの「診断・計算」の計算式。
 *
 * --- なぜ式を文字列で持ち、こちらで解くのか ---
 * 道具は運営者が増やすものなので、道具を 1 つ足すたびにコードを書き足す形にはできない。
 * かといって `eval` や `new Function` に渡すと、**保存先に入った文字列がそのまま
 * サーバーで実行できる命令になる。** 道具の登録欄が、そのまま乗っ取りの入口になる。
 *
 * だからここでは、四則演算と括弧と入力欄の名前**しか**書けない小さな読み取り機を持つ。
 * 書けないものは書けない。関数呼び出しも、代入も、プロパティ参照も、字句の段階で弾く。
 *
 * --- 数字をでっち上げない ---
 * 入力が足りない・数字でない・0 で割る、のどれも失敗として返す。
 * 「とりあえず 0 として計算する」をやると、読者は 0 が答えだと思って機材を買う。
 */

/** 結果の 1 行。式・単位・小数点以下の桁数まで、保存側が決める。 */
export type ReaderToolFormulaRow = {
  readonly label: string;
  /** 例: `minutes * bitrate / 8 * months`。使えるのは数と入力欄の名前と `+ - * / ( )` だけ。 */
  readonly expression: string;
  readonly unit?: string;
  /** 小数点以下の桁数。省略時は 0 桁（読者に意味の無い細かさを見せない）。 */
  readonly decimals?: number;
  /**
   * この行の結果に付ける名前。次の行の式から使える。
   * 見出し（`label`）ではなく別に持つのは、**見出しは日本語だが式に書ける名前は
   * 半角英字だけ**だから。見出しをそのまま名前にすると、書けない名前ができる。
   */
  readonly as?: string;
};

export type ReaderToolFormula = {
  readonly rows: readonly ReaderToolFormulaRow[];
  /**
   * 結果の 1 文。`{行の見出し}` を、その行の値（単位つき）で置き換える。
   * 数字だけを並べて解釈を読者任せにしないための欄。
   */
  readonly summary: string;
};

export type ReaderToolFormulaResult = {
  readonly summary: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
};

// ---------------------------------------------------------------------------
// 字句
// ---------------------------------------------------------------------------

type Token =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "name"; readonly value: string }
  | { readonly kind: "op"; readonly value: "+" | "-" | "*" | "/" | "(" | ")" };

const NAME_HEAD = /[A-Za-z_]/;
const NAME_TAIL = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

function tokenize(expression: string): Result<readonly Token[], DomainError> {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const c = expression[i] as string;
    if (c === " " || c === "\t" || c === "\n") {
      i += 1;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "(" || c === ")") {
      tokens.push({ kind: "op", value: c });
      i += 1;
      continue;
    }
    if (DIGIT.test(c)) {
      let j = i;
      while (j < expression.length && DIGIT.test(expression[j] as string)) j += 1;
      if (expression[j] === "." ) {
        j += 1;
        while (j < expression.length && DIGIT.test(expression[j] as string)) j += 1;
      }
      tokens.push({ kind: "number", value: Number(expression.slice(i, j)) });
      i = j;
      continue;
    }
    if (NAME_HEAD.test(c)) {
      let j = i;
      while (j < expression.length && NAME_TAIL.test(expression[j] as string)) j += 1;
      tokens.push({ kind: "name", value: expression.slice(i, j) });
      i = j;
      continue;
    }
    // ここに落ちる文字は、この道具では書けないものすべて。
    // 何が書けないのかを黙って捨てない。登録した人が直せるように文字を返す。
    return err(
      domainError("VALIDATION_FAILED", `計算式に使えない文字が入っています: 「${c}」`, {
        suggestedAction: "計算式に書けるのは、数字・入力欄の名前・「+ - * / ( )」だけです。",
      }),
    );
  }
  return ok(tokens);
}

// ---------------------------------------------------------------------------
// 構文と評価（再帰下降。左結合、`* /` が `+ -` より強い）
// ---------------------------------------------------------------------------

type Reader = { readonly tokens: readonly Token[]; index: number };

function peek(r: Reader): Token | undefined {
  return r.tokens[r.index];
}

function parseSum(r: Reader, values: Readonly<Record<string, number>>): Result<number, DomainError> {
  let left = parseProduct(r, values);
  if (!left.ok) return left;
  for (;;) {
    const t = peek(r);
    if (t === undefined || t.kind !== "op" || (t.value !== "+" && t.value !== "-")) return left;
    r.index += 1;
    const right = parseProduct(r, values);
    if (!right.ok) return right;
    left = ok(t.value === "+" ? left.value + right.value : left.value - right.value);
  }
}

function parseProduct(
  r: Reader,
  values: Readonly<Record<string, number>>,
): Result<number, DomainError> {
  let left = parseUnary(r, values);
  if (!left.ok) return left;
  for (;;) {
    const t = peek(r);
    if (t === undefined || t.kind !== "op" || (t.value !== "*" && t.value !== "/")) return left;
    r.index += 1;
    const right = parseUnary(r, values);
    if (!right.ok) return right;
    if (t.value === "/" && right.value === 0) {
      // 0 で割った結果は Infinity になる。**画面には「Infinity」と出る。**
      // 読者に意味の分からない語を見せるより、割れないと言うほうが正しい。
      return err(
        domainError("VALIDATION_FAILED", "0 では割れないため、結果を出せません。", {
          suggestedAction: "0 を入れた欄を、実際の値に直してからもう一度お試しください。",
        }),
      );
    }
    left = ok(t.value === "*" ? left.value * right.value : left.value / right.value);
  }
}

function parseUnary(
  r: Reader,
  values: Readonly<Record<string, number>>,
): Result<number, DomainError> {
  const t = peek(r);
  if (t !== undefined && t.kind === "op" && (t.value === "-" || t.value === "+")) {
    r.index += 1;
    const inner = parseUnary(r, values);
    if (!inner.ok) return inner;
    return ok(t.value === "-" ? -inner.value : inner.value);
  }
  return parsePrimary(r, values);
}

function parsePrimary(
  r: Reader,
  values: Readonly<Record<string, number>>,
): Result<number, DomainError> {
  const t = peek(r);
  if (t === undefined) {
    return err(
      domainError("VALIDATION_FAILED", "計算式が途中で終わっています。", {
        suggestedAction: "道具の計算式を登録し直してください。",
      }),
    );
  }
  if (t.kind === "number") {
    r.index += 1;
    return ok(t.value);
  }
  if (t.kind === "name") {
    r.index += 1;
    const v = values[t.value];
    if (v === undefined) {
      // 入力欄に無い名前を式が使っている。読者の入力ミスではなく、登録側の間違い。
      return err(
        domainError("VALIDATION_FAILED", `計算式が「${t.value}」を使っていますが、入力欄がありません。`, {
          field: t.value,
          suggestedAction: "道具の入力欄と計算式の名前を合わせてください。",
        }),
      );
    }
    return ok(v);
  }
  if (t.value === "(") {
    r.index += 1;
    const inner = parseSum(r, values);
    if (!inner.ok) return inner;
    const close = peek(r);
    if (close === undefined || close.kind !== "op" || close.value !== ")") {
      return err(validationError("計算式の括弧が閉じていません。"));
    }
    r.index += 1;
    return inner;
  }
  return err(validationError(`計算式の「${t.value}」の位置が正しくありません。`));
}

/** 1 つの式を解く。読者の入力は済んだ数として渡す。 */
export function evaluateExpression(
  expression: string,
  values: Readonly<Record<string, number>>,
): Result<number, DomainError> {
  const tokens = tokenize(expression);
  if (!tokens.ok) return tokens;
  const reader: Reader = { tokens: tokens.value, index: 0 };
  const result = parseSum(reader, values);
  if (!result.ok) return result;
  if (reader.index !== tokens.value.length) {
    return err(validationError("計算式に余分な部分があります。"));
  }
  if (!Number.isFinite(result.value)) {
    return err(validationError("結果が大きすぎて表示できません。"));
  }
  return ok(result.value);
}

// ---------------------------------------------------------------------------
// 入力の読み取り
// ---------------------------------------------------------------------------

/**
 * 読者が打った文字を数にする。
 *
 * 桁区切りのコンマと、全角の数字は受ける。**打ち直させない。**
 * 「1,200」と書いて弾かれる道具は、読者から見れば壊れている。
 */
export function parseReaderNumber(raw: string): number | null {
  const normalized = raw
    .trim()
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".")
    .replace(/[,、，\s]/g, "");
  if (normalized === "" || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value: number, decimals: number): string {
  // 桁区切りを入れる。7 桁の数字を読者に読ませない。
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 道具を 1 回動かす。
 *
 * `inputs` は道具の入力欄の定義、`values` は読者が打った文字。
 * 足りない欄・数字でない欄はここで止める。どの欄が原因かを `field` に載せるので、
 * 画面はその欄の下に理由を出せる（読者に一覧から探させない）。
 */
export function runReaderToolFormula(
  formula: ReaderToolFormula,
  inputs: readonly { readonly key: string; readonly label: string }[],
  values: Readonly<Record<string, string>>,
): Result<ReaderToolFormulaResult, DomainError> {
  const numbers: Record<string, number> = {};
  for (const input of inputs) {
    const raw = values[input.key];
    if (raw === undefined || raw.trim() === "") {
      return err(validationError(`「${input.label}」が入力されていません。`, input.key));
    }
    const n = parseReaderNumber(raw);
    if (n === null) {
      return err(
        domainError("VALIDATION_FAILED", `「${input.label}」は数字で入力してください。`, {
          field: input.key,
          suggestedAction: "「1200」「1,200」「12.5」のような形で入力してください。",
        }),
      );
    }
    numbers[input.key] = n;
  }

  if (formula.rows.length === 0) {
    return err(
      domainError("NOT_IMPLEMENTED", "この道具の計算式はまだ登録されていません。", {
        suggestedAction: "計算式の登録が済むと結果が出ます。",
      }),
    );
  }

  const rows: { readonly label: string; readonly value: string }[] = [];
  // 前の行の結果は、次の行から見えるようにする。
  // 「素材の大きさ」→「余裕を見た大きさ」のように、段を分けて見せられるようにするため。
  const scope: Record<string, number> = { ...numbers };
  for (const row of formula.rows) {
    const computed = evaluateExpression(row.expression, scope);
    if (!computed.ok) return computed;
    const decimals = row.decimals ?? 0;
    const text = `${formatNumber(computed.value, decimals)}${row.unit ?? ""}`;
    rows.push({ label: row.label, value: text });
    if (row.as !== undefined) scope[row.as] = computed.value;
  }

  // 見出しの長いものから順に置き換える。短い見出しが長い見出しの一部だったとき、
  // 先に短いほうが当たって、置き換え後の文が壊れるのを避ける。
  const summary = [...rows]
    .sort((a, b) => b.label.length - a.label.length)
    .reduce((text, row) => text.split(`{${row.label}}`).join(row.value), formula.summary);

  return ok({ summary, rows });
}
