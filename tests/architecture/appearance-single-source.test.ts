/**
 * @tier 1
 * @req REQ-TH03, REQ-TH04
 *
 * 見た目（配色 × 明暗）の**名前**が 1 か所にそろっているか。
 *
 * --- なぜこれが要るのか ---
 * `docs/product/traceability.md` O 節は REQ-TH03 を「切り替え部品を一元化する
 * （管理画面用と読者用で二重実装しない）」、REQ-TH04 を「`src/presentation/appearance.ts`
 * （cookie を読む唯一の場所）」「`src/app/layout.tsx`（一番外側に属性を当てる唯一の場所）」
 * と書いている。**どちらの test 欄も、この主張を見ていなかった。**
 * REQ-TH03 が挙げていた `tests/ui/ui-layers.test.ts` が見るのは
 * 「見本帳に全部の部品が載っている」「部品が業務判断を持っていない」で、別のことである。
 * REQ-TH04 の欄は `pnpm run preview` での手作業の確認だった（手で 1 回見ただけで、
 * 次に壊れた日には誰も見ていない）。
 *
 * 2026-08-21 に実測して 1 件見つけた: `src/presentation/ui/templates/site-shell.tsx`
 * が `data-brand-theme` を文字列で直書きしていた。属性名は `APPEARANCE_ATTR` に
 * そろえる決まりで、`ui/appearance.ts` にもそう書いてあるのに、
 * **読者側の骨格だけがその決まりの外に居た**。名前を変えると読者側だけ配色が外れる。
 *
 * --- 見ているもの ---
 * 「唯一の場所」は、**その名前を書ける場所が 1 つ**という形にして機械で見る。
 * 部品が 1 つであることそのもの（同じ見た目の別実装が無い）は、これでは見えない。
 * ここが見るのは名前の出どころで、二重実装の検出ではない。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

/** 属性名と cookie 名の正本。ここだけが生の文字列を持ってよい。 */
const NAME_SOURCE = "src/presentation/ui/appearance.ts";
/** cookie を読む唯一の場所。 */
const COOKIE_READER = "src/presentation/appearance.ts";

/** 生で書いてはいけない名前。`ui/appearance.ts` の定数と同じ値を手で書き写す。 */
const RAW_NAMES = ["data-brand-theme", "data-color-mode", "ah_theme", "ah_mode"] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

/** `src` の下のファイルを、リポジトリからの相対パス（`/` 区切り）で返す。 */
function sourceFiles(): string[] {
  return walk(join(ROOT, "src")).map((p) => p.slice(ROOT.length + 1).split("\\").join("/"));
}

/** コメントを落とす。説明文に名前を書くのは禁じない。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("見た目の切り替えの出どころ", () => {
  it("公開read modelと管理usecaseは、互いではなくdomainのパス正本に依存する", () => {
    const consumers = [
      "src/application/read-models/public-blog-appearance.ts",
      "src/application/usecases/authoring/manage-blog-appearance.ts",
      "src/presentation/admin/publish/blog-appearance-action.ts",
    ];

    for (const file of consumers) {
      const body = stripComments(readFileSync(join(ROOT, file), "utf8"));
      expect(body, file).toContain("@/domain/authoring/page-path");
      expect(body, file).not.toContain(
        "@/application/usecases/authoring/manage-blog-appearance",
      );
    }
  });

  it("属性名と cookie 名を生で書いているのは、正本の 1 ファイルだけ", () => {
    const files = sourceFiles();
    // **母集団の床。**歩き先を外すと 0 件になり、違反 0 件で緑になる。
    expect(files.length, "src を歩けていません").toBeGreaterThan(50);

    const offenders = files
      .filter((file) => file !== NAME_SOURCE)
      .filter((file) => {
        const body = stripComments(readFileSync(join(ROOT, file), "utf8"));
        return RAW_NAMES.some((name) => body.includes(name));
      });

    expect(
      offenders,
      `見た目の名前を直書きしています。${NAME_SOURCE} の定数を使ってください: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("正本のファイルは、その名前を実際に持っている", () => {
    // **空振り防止。**上の検査は、正本から名前が消えても（＝どこにも無くても）緑になる。
    const body = readFileSync(join(ROOT, NAME_SOURCE), "utf8");
    for (const name of RAW_NAMES) {
      expect(body.includes(name), `${NAME_SOURCE} に ${name} がありません`).toBe(true);
    }
  });

  it("見た目の cookie に触るのは、決めた 4 ファイルだけ", () => {
    // 画面ごとに読み書きすると、名前を 1 つ直したときに直し漏れた画面だけ既定色に戻る。
    // 壊れて見えないので気づけない、というのがこの決まりの理由。
    //
    // 名前の直書きは上の検査が封じてあるので、ここは `APPEARANCE_COOKIE` の
    // 使い手を数えれば足りる。同意や作業場所など**別の cookie** の読み書きは数えない。
    //
    // 書く側が 1 つであること（REQ-TH03「切り替え部品を一元化する」）も、
    // ここが持つ。管理画面用と読者用で別々に cookie を書き始めたら落ちる。
    const allowed = [
      NAME_SOURCE, // 名前の正本
      COOKIE_READER, // 読む側
      "src/presentation/ui/index.ts", // 共通UIの出口（再輸出）
      "src/presentation/ui/patterns/appearance-picker.tsx", // 書く側。切り替え部品は 1 つ
    ];
    const users = sourceFiles().filter((file) =>
      stripComments(readFileSync(join(ROOT, file), "utf8")).includes("APPEARANCE_COOKIE"),
    );
    expect(users.length, "見た目の cookie に触る場所が 1 つもありません").toBeGreaterThan(0);
    expect(
      users.filter((f) => !allowed.includes(f)),
      `見た目の cookie に触ってよいのは ${allowed.join(" / ")} だけです: ${users.join(", ")}`,
    ).toEqual([]);
  });
});
