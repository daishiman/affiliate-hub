/** @tier 2 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { TERMS, UI_COPY, fill, term } from "@/presentation/ui/copy";

/**
 * 画面の言葉の機械チェック。
 *
 * 「用語を統一しましょう」も運用ルールでは守られない。
 * 辞書と画面がずれた瞬間に落ちるようにしておく。
 */

const ROOT = process.cwd();
const DICTIONARY = join(ROOT, "docs/architecture/ubiquitous-language.md");

/** 辞書の表から「日本語表示」を全部読む。 */
function readDictionaryTerms(): Set<string> {
  const md = readFileSync(DICTIONARY, "utf8");
  const terms = new Set<string>();
  for (const line of md.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | 日本語表示 | コード上の名前 | 定義 | …
    const label = cells[1];
    if (!label || label === "日本語表示" || label.startsWith("---")) continue;
    if (label === "使わない" || label === "使う") continue;
    terms.add(label);
  }
  return terms;
}

/** 「使ってはいけない言い換え」を辞書の最後の表から読む。 */
function readBannedWords(): string[] {
  const md = readFileSync(DICTIONARY, "utf8");
  const section = md.split("## 使ってはいけない言い換え")[1] ?? "";
  const banned: string[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = line.split("|")[1]?.trim();
    if (!first || first === "使わない" || first.startsWith("---")) continue;
    // 「テナント / 組織 / アカウント（組織の意味で）」→ 個々の語へ分解
    for (const raw of first.split("/")) {
      const word = raw.replace(/（.*?）/g, "").trim();
      if (word.length > 1) banned.push(word);
    }
  }
  return banned;
}

/**
 * 例外として許す複合語。
 * 同じ字面でも別概念を指すものがある（ASP アカウント、投稿先のアカウント）。
 * 正本は辞書の「機械チェックの例外」行。ここには書かない。
 */
function readAllowedCompounds(): string[] {
  const md = readFileSync(DICTIONARY, "utf8");
  const line = md.match(/- 許可する複合語:\s*(.+)/)?.[1] ?? "";
  return line
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** 画面に出る可能性のあるコード。 */
const screenFiles = walk(join(ROOT, "src")).filter(
  (f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.endsWith(".d.ts"),
);

/**
 * 利用者の目に触れる文字列だけを取り出す。
 *
 * コメントは対象外にする。「他テナントのデータは見せない」のような
 * 技術的な説明まで禁止すると、コードの説明が書けなくなる。
 * 見たいのは「画面に出る言葉」であって「実装の説明」ではない。
 */
function userFacingStrings(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  source.split("\n").forEach((raw, i) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    // 行の途中から始まるコメントも落とす
    const code = raw.replace(/\/\/.*$/, "");
    for (const m of code.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`]*)`/g)) {
      const text = m[1] ?? m[2] ?? m[3] ?? "";
      if (/[ぁ-んァ-ヶ一-龠]/.test(text)) out.push({ line: i + 1, text });
    }
    // JSX の地の文（タグに挟まれた日本語）
    for (const m of code.matchAll(/>([^<>{}]*[ぁ-んァ-ヶ一-龠][^<>{}]*)</g)) {
      out.push({ line: i + 1, text: m[1] });
    }
  });
  return out;
}

describe("画面の言葉", () => {
  it("辞書と検査対象を実際に読めている", () => {
    expect(readDictionaryTerms().size).toBeGreaterThan(30);
    expect(readBannedWords().length).toBeGreaterThan(5);
    expect(screenFiles.length).toBeGreaterThan(10);
  });

  it("概念の呼び名が辞書と一致している", () => {
    const dictionary = readDictionaryTerms();
    const missing: string[] = [];
    for (const [key, label] of Object.entries(TERMS)) {
      if (!dictionary.has(label)) missing.push(`${key} = 「${label}」`);
    }
    expect(
      missing,
      "辞書 (docs/architecture/ubiquitous-language.md) に無い呼び名があります。" +
        "言い換えたいときは、先に辞書を直してください。",
    ).toEqual([]);
  });

  it("使ってはいけない言い換えが画面のコードに混ざっていない", () => {
    const banned = readBannedWords();
    const allowed = readAllowedCompounds();
    expect(allowed.length, "辞書の例外行が読めていません").toBeGreaterThan(0);
    const offenders: string[] = [];

    for (const file of screenFiles) {
      // 言葉の正本そのものは対象外
      if (file.endsWith("copy.ts")) continue;
      for (const { line, text } of userFacingStrings(readFileSync(file, "utf8"))) {
        for (const word of banned) {
          if (!text.includes(word)) continue;
          if (!/[ぁ-んァ-ヶ一-龠]/.test(word)) continue;
          // 辞書が例外として認めた複合語を取り除いてから、まだ残るかを見る
          const stripped = allowed.reduce((acc, ok) => acc.split(ok).join(""), text);
          if (!stripped.includes(word)) continue;
          offenders.push(`${relative(ROOT, file)}:${line} 「${word}」  ${text}`);
        }
      }
    }

    expect(
      offenders,
      "同じものを 2 つの言葉で呼ぶと、利用者は別物だと思います。" +
        "src/presentation/ui/copy.ts の言葉を使ってください。",
    ).toEqual([]);
  });

  it("空の文言が無い", () => {
    const empty: string[] = [];
    const visit = (obj: object, path: string): void => {
      for (const [key, value] of Object.entries(obj)) {
        const here = `${path}.${key}`;
        if (typeof value === "string") {
          // placeholderNone は「あえて空」なので除く
          if (value.trim() === "" && !here.endsWith("placeholderNone")) empty.push(here);
        } else if (value && typeof value === "object") {
          visit(value, here);
        }
      }
    };
    visit(UI_COPY, "UI_COPY");
    expect(empty, "空の文言は画面で無言の空白になります。").toEqual([]);
  });

  it("広告表示の文言が 1 箇所にまとまっている", () => {
    // 法令に関わる文言を画面ごとに書くと、変更時に必ず抜けが出る。
    //
    // 業務側の正本（`domain/compliance/disclosure.ts` の `READER_DISCLOSURE_TEXT`）
    // だけは対象外にする。同じ文を読者ページの AI 向けの道具も返す必要があり、
    // 部品は業務層を読めない決まり（`ui-layers.test.ts`）のため、
    // 画面側と業務側の 2 か所に置くほかない。
    // **書き写しは自由にならない** — 2 つが 1 文字でも違えば
    // `tests/ui/disclosure-text.test.ts` が落ちる。`factSource` と同じ扱い。
    const canonical = join(ROOT, "src/domain/compliance/disclosure.ts");
    const offenders: string[] = [];
    for (const file of screenFiles) {
      if (file.endsWith("copy.ts") || file === canonical) continue;
      const text = readFileSync(file, "utf8");
      if (/アフィリエイトリンクが含まれ|広告を含みます/.test(text)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(
      offenders,
      "広告表示の文言は UI_COPY.disclosure だけに置きます。" +
        "画面ごとに書くと、法令要件が変わったときの直し漏れが必ず出ます。",
    ).toEqual([]);
  });

  it("できない理由の差し替え文が、画面につながっていない", () => {
    /*
     * **呼び出しが無いことを、書き忘れではなく決定として固定する。**
     *
     * できない理由は `requireCapability()` が作り、画面は `Callout` の
     * `reason`（省略できない型）へ渡す。ここに一般の差し替え文をつなぐと、
     * 理由が作られなかったときに**それらしい文が代わりに出る**。
     * そのとき、読み手の側にだけある文が 1 文以上あることを見ている検査
     * （`page-render-restricted`。文言に依存しない形）は**緑になる**。
     * 黙って消えるのではなく、**埋まって見える**という壊れ方をする。
     *
     * つまり、つなぐと「理由が無いこと」を隠す道具になる。
     * 決定を文章だけで残すと、次に見た人には「つなぎ忘れ」に見えて、
     * 親切心でつながれる。だから検査にする。
     */
    const users = screenFiles
      .filter((f) => !f.endsWith(join("presentation", "ui", "copy.ts")))
      .filter((f) => {
        const code = readFileSync(f, "utf8")
          .split("\n")
          .filter((l) => {
            const t = l.trim();
            return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
          })
          .join("\n");
        return /forbiddenTitle|forbiddenBodyFallback/.test(code);
      })
      .map((f) => relative(ROOT, f));

    expect(
      users,
      [
        "UI_COPY.state.forbidden* を画面から参照しています:",
        ...users.map((f) => `  ${f}`),
        "",
        "これは「つなぎ忘れ」ではなく、つながないという決定です（理由は copy.ts に書いてあります）。",
        "つなぐ必要が出たなら、先に page-render-restricted の検査を",
        "「特定の理由が出ていること」を見る形へ作り直してください。",
        "順番を逆にすると、理由が無い画面が緑のまま埋まって見えます。",
      ].join("\n"),
    ).toEqual([]);
  });

  it("差し込みが動く", () => {
    expect(fill("{done} / {total} 件", { done: 3, total: 10 })).toBe("3 / 10 件");
    // 値が無いときは壊さず、そのまま残す（画面に undefined を出さない）
    expect(fill("{a} と {b}", { a: "x" })).toBe("x と {b}");
    expect(term("workspace")).toBe("ワークスペース");
  });
});
