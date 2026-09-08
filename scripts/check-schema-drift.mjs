#!/usr/bin/env node
/**
 * 全 migration を一時ローカル D1 へ適用し、その最終形を対象 D1 と比較する。
 * 台帳の確認は require-migrations-applied.sh、このファイルは sqlite_master の形を担当する。
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMP_PREFIX = "affiliate-hub-schema-drift-";
const QUERY =
  "SELECT type, name, tbl_name, sql FROM sqlite_master " +
  "WHERE sql IS NOT NULL ORDER BY type, name";
const ALLOWED_TYPES = new Set(["table", "index", "trigger"]);
const IGNORED_TABLES = new Set(["d1_migrations"]);

const isInternal = (name) => name.startsWith("sqlite_") || name.startsWith("_cf_");
const keyOf = (row) => `${row.type}:${row.name.toLowerCase()}`;
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * SQL の意味を保ったまま、空白・キーワードの大小・識別子の引用差だけを除く。
 * 文字列リテラルはそのまま残すため、trigger の条件や既定値の差は消えない。
 */
export function canonicalSql(sql) {
  if (typeof sql !== "string" || sql.trim() === "") {
    throw new Error("sqlite_master.sql が空です。");
  }

  const tokens = [];
  for (let i = 0; i < sql.length; ) {
    const ch = sql[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "'") {
      let token = ch;
      i += 1;
      let closed = false;
      while (i < sql.length) {
        token += sql[i];
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            token += sql[i + 1];
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      if (!closed) throw new Error("閉じていない文字列リテラルがあります。");
      tokens.push(token);
      continue;
    }

    if (ch === '"' || ch === "`" || ch === "[") {
      const close = ch === "[" ? "]" : ch;
      let value = "";
      i += 1;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === close) {
          if (close !== "]" && sql[i + 1] === close) {
            value += close;
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        value += sql[i];
        i += 1;
      }
      if (!closed) throw new Error("閉じていない識別子があります。");
      tokens.push(value.toLowerCase());
      continue;
    }

    const word = sql.slice(i).match(/^[\p{L}\p{N}_$]+/u)?.[0];
    if (word) {
      tokens.push(word.toLowerCase());
      i += word.length;
      continue;
    }

    const operator = sql.slice(i).match(/^(?:->>|->|<=|>=|<>|!=|==|\|\|)/)?.[0];
    if (operator) {
      tokens.push(operator);
      i += operator.length;
      continue;
    }

    tokens.push(ch);
    i += 1;
  }

  return tokens.join(" ");
}

function canonicalRows(rows) {
  if (!Array.isArray(rows)) throw new Error("sqlite_master の結果が配列ではありません。");
  const objects = new Map();

  for (const row of rows) {
    if (!row || !ALLOWED_TYPES.has(row.type)) continue;
    if (typeof row.name !== "string" || typeof row.tbl_name !== "string") {
      throw new Error("sqlite_master の name / tbl_name が文字列ではありません。");
    }
    if (
      isInternal(row.name) ||
      isInternal(row.tbl_name) ||
      (row.type === "table" && IGNORED_TABLES.has(row.name)) ||
      IGNORED_TABLES.has(row.tbl_name)
    ) {
      continue;
    }

    const object = {
      type: row.type,
      name: row.name.toLowerCase(),
      table: row.tbl_name.toLowerCase(),
      definition: canonicalSql(row.sql),
    };
    const key = keyOf(object);
    if (objects.has(key)) throw new Error(`sqlite_master に同じ物が複数あります: ${key}`);
    objects.set(key, object);
  }

  return objects;
}

/** 同じ名前でも、所属先または定義が違えば changed になる。 */
export function diffSchema(expectedRows, actualRows) {
  const expected = canonicalRows(expectedRows);
  const actual = canonicalRows(actualRows);
  const missing = [...expected.keys()].filter((key) => !actual.has(key)).sort();
  const extra = [...actual.keys()].filter((key) => !expected.has(key)).sort();
  const changed = [...expected.keys()]
    .filter((key) => {
      const left = expected.get(key);
      const right = actual.get(key);
      return right && (left.table !== right.table || left.definition !== right.definition);
    })
    .sort()
    .map((key) => ({ key, expected: expected.get(key), actual: actual.get(key) }));

  return { missing, extra, changed };
}

export function judge(diff, env) {
  const errors = [];
  if (diff.missing.length) errors.push(`${env}: 足りない定義: ${diff.missing.join(", ")}`);
  if (diff.extra.length) errors.push(`${env}: migration に無い定義: ${diff.extra.join(", ")}`);
  for (const item of diff.changed) {
    const parts = [];
    if (item.expected.table !== item.actual.table) {
      parts.push(`所属 ${item.expected.table} → ${item.actual.table}`);
    }
    if (item.expected.definition !== item.actual.definition) parts.push("SQL 定義が不一致");
    errors.push(`${env}: ${item.key} の形が違います（${parts.join(" / ")}）`);
  }
  return { ok: errors.length === 0, errors, warnings: [] };
}

/** Wrangler の前後メッセージを許容するが、JSON の形が不明なら fail-closed。 */
export function parseWranglerRows(output) {
  if (typeof output !== "string") throw new Error("wrangler の出力が文字列ではありません。");
  let parsed;
  let lastError;
  for (let at = output.indexOf("["); at >= 0; at = output.indexOf("[", at + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let cursor = at; cursor < output.length; cursor += 1) {
      const ch = output[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "[") depth += 1;
      else if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          end = cursor + 1;
          break;
        }
      }
    }
    if (end < 0) {
      lastError = new Error("閉じていない JSON 配列です。");
      continue;
    }
    try {
      parsed = JSON.parse(output.slice(at, end));
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!parsed) {
    throw new Error(`wrangler の JSON を読めません: ${lastError?.message ?? "配列がありません"}`);
  }
  const rows = parsed?.[0]?.results;
  if (!Array.isArray(rows)) throw new Error("wrangler の JSON に results 配列がありません。");
  return rows;
}

/** 外部失敗だけを有限回再試行し、最後まで読めなければ必ず例外にする。 */
export function withRetry(read, options = {}) {
  const attempts = options.attempts ?? 3;
  const sleep = options.sleep ?? wait;
  const delayMs = options.delayMs ?? 3000;
  const onRetry = options.onRetry ?? (() => {});
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error("attempts は 1 以上にしてください。");

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return read();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        onRetry(error, attempt, attempts);
        sleep(delayMs * attempt);
      }
    }
  }
  throw lastError;
}

export function executeWrangler(args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const spawn = options.spawn ?? spawnSync;
  const result = spawn("pnpm", ["exec", "wrangler", ...args], {
    cwd: options.root ?? ROOT,
    encoding: "utf8",
    stdio: "pipe",
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    const timedOut = result.error.code === "ETIMEDOUT" ? `（${timeoutMs}ms で timeout）` : "";
    throw new Error(`wrangler を実行できません${timedOut}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `wrangler が失敗しました（終了状態 ${result.status ?? "不明"}）:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function createTemp() {
  return mkdtempSync(join(tmpdir(), TEMP_PREFIX));
}

function removeTemp(directory) {
  const resolved = resolve(directory);
  const tempRoot = `${resolve(tmpdir())}${sep}`;
  if (!resolved.startsWith(tempRoot) || !basename(resolved).startsWith(TEMP_PREFIX)) {
    throw new Error(`安全でない一時ディレクトリを削除しようとしました: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
}

/** 外部実行を注入できる境界。テストは Cloudflare や資格情報へ接続しない。 */
export function createSchemaClient(options = {}) {
  const execute = options.execute ?? executeWrangler;
  const makeTemp = options.makeTemp ?? createTemp;
  const cleanup = options.cleanup ?? removeTemp;
  const query = (args) => parseWranglerRows(execute(args, { timeoutMs: 60_000, root: ROOT }));

  return {
    readRemote(env) {
      return query([
        "d1",
        "execute",
        "DB",
        "--env",
        env,
        "--remote",
        "--json",
        "--command",
        QUERY,
      ]);
    },

    buildExpected(env) {
      const directory = makeTemp();
      try {
        execute(
          ["d1", "migrations", "apply", "DB", "--env", env, "--local", "--persist-to", directory],
          { timeoutMs: 240_000, root: ROOT },
        );
        return query([
          "d1",
          "execute",
          "DB",
          "--env",
          env,
          "--local",
          "--persist-to",
          directory,
          "--json",
          "--command",
          QUERY,
        ]);
      } finally {
        cleanup(directory);
      }
    },
  };
}

export function checkSchema(env, options = {}) {
  const client = options.client ?? createSchemaClient();
  const expected = client.buildExpected(env);
  const actual = withRetry(() => client.readRemote(env), {
    attempts: options.attempts,
    sleep: options.sleep,
    delayMs: options.delayMs,
    onRetry:
      options.onRetry ??
      ((_error, attempt, attempts) => {
        console.log(`::notice::${env} の形を読めませんでした（${attempt}/${attempts}）。再試行します。`);
      }),
  });
  return diffSchema(expected, actual);
}

/** @param {string[]} argv @param {{ D1_ENV?: string }} processEnv */
export function environmentFrom(argv, processEnv = process.env) {
  const inline = argv.find((arg) => arg.startsWith("--env="));
  const index = argv.indexOf("--env");
  return inline?.slice("--env=".length) || (index >= 0 ? argv[index + 1] : undefined) || processEnv.D1_ENV;
}

function main() {
  const env = environmentFrom(process.argv.slice(2));
  if (env !== "dev" && env !== "production") {
    console.error(`::error::D1_ENV / --env には dev か production を指定してください（入力値: '${env ?? ""}'）。`);
    return 1;
  }

  try {
    const diff = checkSchema(env);
    console.log("正本: 一時ローカル D1 へ drizzle/*.sql を全適用した sqlite_master");
    console.log(JSON.stringify(diff, null, 2));
    const verdict = judge(diff, env);
    for (const line of verdict.errors) console.error(`::error::${line}`);
    if (!verdict.ok) {
      console.error("migration の最終形と対象 D1 の形が違います。修復手順は CI/CD 仕様を参照してください。");
      return 1;
    }
    console.log(`OK ${env} の形は migration の最終形と一致しています。`);
    return 0;
  } catch (error) {
    console.error(`::error::${env} の形を確かめられませんでした。`);
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = main();
}
