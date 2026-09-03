/**
 * `drizzle/*.sql` の**読み方**を 1 か所に集める。
 *
 * ── なぜ集めるか ────────────────────────────────────────
 *
 * 2026-08-28 の実測で、この読み方が integration test **17 ファイルに写されていた**。
 * しかも 2 系統に割れていた——
 *
 *   A) `expect(files.length).toBeGreaterThan(0)` を挟む形（母数を張る）
 *   B) 挟まない形（0 件でもそのまま通る）
 *
 * B の形は、`drizzle/` が空になったとき **20 個の integration test が
 * 「空のスキーマに対して緑」になる。**表が 1 つも無いのだから、
 * どのテストも「その表に無いこと」を確かめられずに終わる。
 * 写した先で片方だけが母数を張っている状態は、**張っているつもり**である。
 *
 * ── 何を変えていないか ──────────────────────────────────
 *
 * **適用順序も分割の仕方も変えていない。**ファイル名の昇順、
 * `--> statement-breakpoint` で割って前後の空白を落とし、空文を捨てる。
 * 写されていた 2 系統のうち、**厳しいほう（A）へ揃えた**。
 * 緩いほうへ揃えると、集約を口実に検査が 1 つ減る。
 *
 * ── vitest に依存させない ────────────────────────────────
 *
 * A 系統は `expect` で母数を張っていたが、ここでは素の `throw` にしてある。
 * この module は `scripts/` からも呼べる位置に置く想定で、
 * **テストランナーが居る場所でしか守られない不変条件**にはしない。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** 移行 SQL が置いてある場所。**`process.cwd()` はリポジトリ根である前提。** */
const MIGRATIONS_DIR = () => path.resolve(process.cwd(), "drizzle");

/** 1 本の SQL を、D1 が 1 度に受け取れる単位へ割る。 */
export function splitStatements(sql: string): readonly string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

/**
 * 適用順に並んだ移行ファイルの絶対パス。
 *
 * **0 件なら投げる。**空の一覧を返すと、呼んだ側は「移行を全部流した」と信じたまま
 * 空のスキーマで走り、以降の検査が全部「何も無いこと」を確かめて緑になる。
 */
export function migrationFiles(): readonly string[] {
  const dir = MIGRATIONS_DIR();
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error(`移行ファイルが 1 本も見つかりません: ${dir}`);
  }
  return files.map((file) => path.join(dir, file));
}

/** 全移行を適用順に並べた文の列。integration test の `beforeAll` が流す。 */
export function migrationStatements(): readonly string[] {
  return migrationFiles().flatMap((file) => splitStatements(readFileSync(file, "utf8")));
}

/**
 * 1 本だけ名指しで、**割る前の全文**を読む。
 *
 * 分割前が要る場面がある——`d1-migration-0035.test.ts` は
 * 「未括弧の `SELECT CASE` を含まないこと」を SQL 全体に当てている。
 * 割ってから繋ぎ直すと、区切りの前後を跨ぐ形を見落とす。
 */
export function readMigration(fileName: string): string {
  return readFileSync(path.resolve(MIGRATIONS_DIR(), fileName), "utf8");
}

/** 1 本だけ名指しで読んで割る（手書き移行を単独で見る場合）。 */
export function statementsOf(fileName: string): readonly string[] {
  return splitStatements(readMigration(fileName));
}
