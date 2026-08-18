/** @tier 1 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 生成 AI の API キーが、値の出てよい場所の外へ出ないことを固定する。
 *
 * --- なぜ書き方そのものを読むのか ---
 * 「鍵を出さないように気をつける」は必ず破られる。この案件では
 * 「口はあるのに呼ばれていない」形の穴が 4 回続き、4 回とも
 * 別の作業のついでに偶然見つかっている。**注意で守られている決まりは、
 * 守られていない。**
 *
 * 鍵の漏れは、漏れても画面が何も変わらないので、
 * 偶然見つかることすら起きない。だから宣言と本文を機械で読む。
 *
 * --- この検査が見ていないこと ---
 * 実行時に何が起きるかは見ていない（それは
 * `tests/infrastructure/llm-credential-vault.test.ts` が実際に呼んで確かめる）。
 * ここが緑でも「鍵が漏れない」ことにはならない。**両方要る。**
 *
 * 規範: docs/product/credential-registration.md
 * @req REQ-SEC01, REQ-SEC05
 * @types secrets, tenant-isolation
 */

const ROOT = join(process.cwd(), "src");

function readAll(dir: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAll(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
      out.push({ path: full, text: readFileSync(full, "utf8") });
  }
  return out;
}

const ALL = readAll(ROOT);
const rel = (p: string) => p.slice(process.cwd().length + 1).replaceAll("\\", "/");

/**
 * 包んだ鍵を開けてよい場所。**この 2 つだけ。**
 *
 * 増やすときは、増やした理由をここに書く。書かずに足せないようにするため、
 * 一覧そのものを検査の対象にしている（下の「一覧が増えていない」）。
 */
const MAY_OPEN_SECRETS = [
  "src/infrastructure/platform/secret-box.ts",
  "src/infrastructure/persistence/d1/llm-credential-repository.ts",
];

describe("生成 AI の鍵が外へ出ない", () => {
  it("要件 1: 保管庫へ平文で入る経路が無い（列にも型にも平文の欄が無い）", () => {
    const schema = ALL.find((f) => rel(f.path) === "src/db/schema.ts");
    expect(schema).toBeDefined();
    const table = schema?.text.split("export const llmCredentials")[1]?.split("export const")[0];
    expect(table, "llmCredentials の定義が見つかりません").toBeDefined();
    // 包んだ値の欄しか無いこと。`api_key` `plain` のような欄を足したら落とす。
    expect(table).toContain('text("sealed_key")');
    expect(table).not.toMatch(/text\("(api_key|plain_key|key|secret)"\)/);
  });

  it("要件 2: 保管庫への問い合わせが必ず作業場所の列で絞られている", () => {
    const repo = ALL.find((f) => rel(f.path) === MAY_OPEN_SECRETS[1]);
    expect(repo).toBeDefined();
    const text = repo?.text ?? "";

    /**
     * **引数の名前ではなく、条件式の中の列を見る。**
     * 「その文に `workspaceId` という語があるか」で判定すると、
     * 引数名がそう見えるだけで通ってしまう。実際、条件から
     * `eq(llmCredentials.workspaceId, …)` を丸ごと外しても、
     * 引数名が残っているために緑のままだった（実測）。
     */
    const whereOneBody = text.split("const whereOne")[1]?.split(";")[0] ?? "";
    expect(whereOneBody, "whereOne が見つかりません").not.toBe("");
    expect(
      whereOneBody,
      "1 件を引く条件が作業場所の列を見ていません",
    ).toContain("eq(llmCredentials.workspaceId");

    // すべての `.where(...)` が、作業場所の列を見た条件になっていること。
    const wheres = [...text.matchAll(/\.where\(([^)]*\)?[^)]*)\)/g)].map((m) => m[1]);
    expect(wheres.length).toBeGreaterThan(0);
    for (const cond of wheres) {
      const resolved = cond.includes("whereOne(") ? whereOneBody : cond;
      expect(
        resolved,
        `作業場所の列で絞っていない問い合わせがあります: .where(${cond.trim().slice(0, 120)})`,
      ).toContain("llmCredentials.workspaceId");
    }
  });

  it("要件 3: 鍵の値を返す口が無い（登録後に見せ直せない）", () => {
    const port = ALL.find((f) => rel(f.path) === "src/application/ports/llm-credential.ts");
    expect(port).toBeDefined();
    const text = port?.text ?? "";
    // 「値を返す」形のメソッド名を禁じる。`useKey` は渡した処理の中でしか見えない。
    for (const banned of ["reveal", "getApiKey", "showKey", "plainKey", "decrypt"]) {
      expect(text, `鍵を返す口 ${banned} は作らない決まりです`).not.toContain(banned);
    }
    // 要約に値の欄が無いこと。
    const domain = ALL.find((f) => rel(f.path) === "src/domain/generation/llm-credential.ts");
    const summary = domain?.text.split("LlmCredentialSummary = {")[1]?.split("};")[0] ?? "";
    expect(summary).toContain("last4");
    expect(summary).not.toContain("apiKey");
    expect(summary).not.toContain("sealed");
  });

  it("要件 4: 操作の記録へ鍵を詰める経路が無い", () => {
    const usecase = ALL.find(
      (f) => rel(f.path) === "src/application/usecases/generation/manage-llm-credentials.ts",
    );
    expect(usecase).toBeDefined();
    const text = usecase?.text ?? "";
    const recordFn = text.split("async function record(")[1]?.split("\n  }")[0] ?? "";
    expect(recordFn, "記録の関数が見つかりません").not.toBe("");
    // 記録を組み立てる関数が鍵に触れないこと。
    expect(recordFn).not.toContain("apiKey");
    // 記録するのは提供元と末尾 4 文字まで。
    expect(recordFn).toContain("last4");
  });

  it("要件 5: 鍵に触れてよいファイルが増えていない", () => {
    const openers = ALL.filter(
      (f) => f.text.includes("openSecret") || f.text.includes("sealSecret"),
    ).map((f) => rel(f.path));
    expect(
      openers.sort(),
      "包んだ鍵を開ける場所が増えています。増やすなら MAY_OPEN_SECRETS に理由つきで足してください。",
    ).toEqual([...MAY_OPEN_SECRETS].sort());
  });

  it("要件 5: 鍵に触れる場所からログへ出す文が無い", () => {
    for (const path of MAY_OPEN_SECRETS) {
      const file = ALL.find((f) => rel(f.path) === path);
      expect(file, `${path} が見つかりません`).toBeDefined();
      const text = file?.text ?? "";
      // コメントを落としてから見る（説明文の中の `console.log` で落とさない）。
      const code = text.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*$/gm, "");
      expect(code, `${path} に画面外へ書き出す文があります`).not.toMatch(
        /console\.(log|error|warn|info|debug)/,
      );
    }
  });

  it("要件 6: 鍵に触れる場所が、モデルへの入力を組み立てていない", () => {
    // 鍵を開けるファイルが `LlmRequest`（モデルへ渡す形）を知らないこと。
    // 知らなければ、鍵を指示や資料に混ぜることが構造的にできない。
    for (const path of MAY_OPEN_SECRETS) {
      const file = ALL.find((f) => rel(f.path) === path);
      const text = file?.text ?? "";
      expect(text, `${path} がモデルへの入力を組み立てています`).not.toContain("LlmRequest");
      expect(text).not.toContain("untrustedContext");
      expect(text).not.toContain("instructions");
    }
  });

  it("要件 7: 生成 AI が読む文の組み立てが、鍵の保管庫を知らない", () => {
    // 記事本文・改善要望・取り込んだ資料を組み立てる側から
    // 鍵の預かり所へ手が届かないこと。
    const assembly = ALL.filter((f) =>
      /src\/(domain\/generation|infrastructure\/llm\/prompt-assembly)/.test(rel(f.path)),
    );
    expect(assembly.length).toBeGreaterThan(0);
    for (const file of assembly) {
      if (rel(file.path) === "src/domain/generation/llm-credential.ts") continue;
      if (rel(file.path) === "src/domain/generation/index.ts") continue;
      expect(file.text, `${rel(file.path)} が鍵の預かり所を参照しています`).not.toContain(
        "LlmCredentialVaultPort",
      );
      expect(file.text, `${rel(file.path)} が鍵を使う口を参照しています`).not.toContain(
        "LlmKeyAccess",
      );
      expect(file.text).not.toContain("secret-box");
    }
  });

  /**
   * 鍵を使う口を、応用層から**型として届かない**場所に置いたことを固定する。
   *
   * 2026-08-18 に `useKey` を `src/application/ports` から
   * `src/infrastructure/llm/key-access.ts` へ移した。理由は
   * 「応用層は鍵を使わないのに、使ってよい口として並んでいた」から。
   * 移しただけでは、次に誰かが応用層から import すれば元に戻る。
   * import が 1 つでも生えたらここで落ちる。
   */
  it("要件 6: 応用層から鍵を使う口へ手が届かない", () => {
    const appFiles = ALL.filter((f) => rel(f.path).startsWith("src/application/"));
    expect(appFiles.length).toBeGreaterThan(0);
    for (const file of appFiles) {
      // 説明文は落としてから見る。**どこへ移したかを書いた注釈で落とすと、
      // 理由を書くほど検査が邪魔になり、いずれ注釈のほうが消える。**
      const code = file.text.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*$/gm, "");
      expect(code, `${rel(file.path)} が鍵を使う口を参照しています`).not.toContain("LlmKeyAccess");
      expect(code, `${rel(file.path)} が鍵を使う口を宣言しています`).not.toContain("useKey");
    }
  });
});
