#!/usr/bin/env node
/**
 * 参考サイトの転用禁止ゲート。
 *
 * ブログ運用機能 (feat-blog-ops-crud) は、実在する 1 つの参考サイトの
 * **構成**（何をどの順で置くか）だけを抽象化して取り込んでいる。
 * 取り込んでよいのは構成であって、そこに載っている**中身**ではない。
 *
 * --- なぜ「禁止語の一覧」をこのファイルに書かないか ---
 *
 * 禁止語とは、参考サイトの固有名・作者名・テーマ名である。
 * 一覧をここへ書けば、**検査そのものが転用**になる。
 * 「書いてはいけない語」を守るための仕組みが、その語を repo へ持ち込む。
 *
 * だからこのゲートは 2 段に分かれる。
 *
 *   1. **構造で見る検査**（常に走る）… 固有名を知らなくても効く規則だけを見る。
 *      外部ホストへの直リンク、生の色値、他所の CMS/テーマ由来の語形。
 *   2. **名前で見る検査**（任意）… `.reference-ban.local` があるときだけ走る。
 *      このファイルは追跡しない (.gitignore)。手元と CI の secret にだけ置く。
 *
 * 1 だけでも「うっかり貼り付けた」は捕まる。2 は「意図して写した」を捕まえる。
 * 2 が無い環境で 1 を素通しにしないため、走った検査の内訳を必ず出力する。
 */
import { existsSync, globSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? ".");
const BAN_LIST = resolve(ROOT, ".reference-ban.local");

/** 見る場所。ブログ運用機能が書いた物と、その仕様だけを見る。 */
const TARGETS = [
  "src/domain/blogops/**/*.ts",
  "src/application/ports/blog-ops.ts",
  "src/application/usecases/blog-ops/**/*.ts",
  "src/infrastructure/persistence/d1/blog-ops-repository.ts",
  "src/presentation/admin/blog-*.ts",
  "src/presentation/admin/blog-*.tsx",
  "src/presentation/admin/site-network-*.ts",
  "src/presentation/admin/site-network-*.tsx",
  "src/app/admin/blog/**/*.tsx",
  "src/app/admin/site-network/**/*.tsx",
  "scripts/seed-blog-ops.mjs",
  "docs/spec/13-*.md",
  "docs/spec/feat-blog-ops-crud/**/*.md",
];

/**
 * 貼ってよい外部ホスト。
 *
 * 規格と公式文書だけ。**参考サイトはここに載らない**ので、
 * 参考サイトの URL を貼れば必ず落ちる。名前を知らなくても効く。
 */
const ALLOWED_HOSTS = new Set([
  "schema.org",
  "www.w3.org",
  "developer.mozilla.org",
  "nextjs.org",
  "developers.cloudflare.com",
  "www.rfc-editor.org",
  "example.com",
  "localhost",
]);

/**
 * 他所の CMS・テーマ由来だと分かる語形。
 *
 * 特定の製品名ではなく、**その製品が作る URL とクラス名の形**を見る。
 * 参考サイトから HTML を写すと、この形が一緒に付いてくる。
 */
const FOREIGN_PLATFORM_PATTERNS = [
  { name: "他所の CMS が作る管理用パス", re: /\/wp-(?:content|includes|admin|json)\b/ },
  { name: "他所の CMS のテーマ用クラス", re: /\b(?:widget|entry)-(?:area|title|content)\b/ },
  { name: "他所の CMS の短縮記法", re: /\[\/?(?:st-|rankinglist|blogcard|toc)\b/ },
  { name: "他所の CMS が作る問い合わせ番号", re: /\bp=\d{3,}\b/ },
];

/** 生の色値。設計トークン以外の場所に置くと、参考サイトの色をそのまま持ち込める。 */
const RAW_COLOR = /#[0-9a-fA-F]{6}\b|\brgba?\(\s*\d+\s*,/;

function files() {
  return TARGETS.flatMap((pattern) => globSync(pattern, { cwd: ROOT })).map((p) => resolve(ROOT, p));
}

function hostsOf(text) {
  return [...text.matchAll(/https?:\/\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]);
}

/** `.reference-ban.local` の 1 行 1 語。空行と `#` 始まりは読み飛ばす。 */
function bannedWords() {
  if (!existsSync(BAN_LIST)) return null;
  return readFileSync(BAN_LIST, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

const violations = [];
const checked = files();
const words = bannedWords();

for (const file of checked) {
  const text = readFileSync(file, "utf8");
  const where = relative(ROOT, file);

  for (const host of hostsOf(text)) {
    if (ALLOWED_HOSTS.has(host)) continue;
    if (host.endsWith(".local") || host.startsWith("127.")) continue;
    violations.push(`${where}: 許可していない外部ホストへの参照 (${host})`);
  }

  for (const { name, re } of FOREIGN_PLATFORM_PATTERNS) {
    const hit = text.match(re);
    if (hit) violations.push(`${where}: ${name} (${hit[0]})`);
  }

  const color = text.match(RAW_COLOR);
  if (color) {
    violations.push(
      `${where}: 生の色値 (${color[0]})。色は設計トークンだけが決める`,
    );
  }

  if (words !== null) {
    const lower = text.toLowerCase();
    for (const word of words) {
      if (lower.includes(word.toLowerCase())) {
        // 語そのものは出さない。出せばログが転用の写しになる。
        violations.push(`${where}: 禁止語の一覧に載っている語が含まれています (${word.length} 文字)`);
      }
    }
  }
}

const nameCheck = words === null
  ? "見送り (.reference-ban.local がありません)"
  : `実行 (${words.length} 語)`;

console.log(`検査したファイル: ${checked.length} 件`);
console.log(`構造で見る検査: 実行`);
console.log(`名前で見る検査: ${nameCheck}`);

if (checked.length === 0) {
  console.error("検査対象が 1 件もありません。走査が壊れています。");
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`\n転用の疑いが ${violations.length} 件あります:`);
  for (const line of violations) console.error(`  ${line}`);
  process.exit(1);
}

console.log("\n転用の疑いは 0 件です。");
