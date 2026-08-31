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
import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? ".");
const BAN_LIST = resolve(ROOT, ".reference-ban.local");

/** 見る場所。参考ブログの構造を抽象化した実装と、その仕様だけを見る。 */
const TARGETS = [
  "src/domain/blogops/**/*.ts",
  "src/application/ports/blog-ops.ts",
  "src/application/usecases/blog-ops/**/*.ts",
  "src/infrastructure/persistence/d1/blog-ops-repository.ts",
  "src/presentation/admin/publish/blog-*.ts",
  "src/presentation/admin/publish/blog-*.tsx",
  "src/presentation/admin/publish/site-network-*.ts",
  "src/presentation/admin/publish/site-network-*.tsx",
  "src/app/admin/blog/**/*.tsx",
  "src/app/admin/site-network/**/*.tsx",
  "src/domain/monetization/affiliate-preview.ts",
  "src/application/usecases/monetization/preview-affiliate-url.ts",
  "src/infrastructure/http/affiliate-preview-fetcher.ts",
  "src/infrastructure/http/guarded-fetch.ts",
  "src/presentation/admin/earn/affiliate-preview-card.tsx",
  "src/presentation/admin/earn/affiliate-preview-card.module.css",
  "src/presentation/ui/patterns/diagram-fallback.tsx",
  "src/presentation/ui/patterns/diagram-fallback.module.css",
  "src/presentation/ui/patterns/use-draft.ts",
  "src/app/admin/affiliate/links/page.tsx",
  // 上の画面の中身（一覧・掲載の逆引き）は部品へ出してある。
  // 走査を画面だけに残すと、中身が動いたぶんだけ見る範囲が減る。
  "src/presentation/admin/earn/affiliate-ledger.tsx",
  "src/app/admin/inbox/**/*.tsx",
  "src/app/admin/ui-catalog/page.tsx",
  "scripts/seed-blog-ops.mjs",
  "docs/spec/13-*.md",
  "docs/spec/feat-blog-ops-crud/**/*.md",
  // 検査ログ等の添付。`.md` だけを見ていると、同じディレクトリの
  // 添付ファイルへ実 URL を貼る道が空いたままになる。
  "docs/spec/feat-blog-ops-crud/**/*.txt",
  "docs/spec/feat-blog-ops-crud/**/*.json",
  // 参考サイト解析 (feat-reference-blog-admin-ux) の成果物。
  // 抽象仕様側は url_digest と抽象パスだけを持つ約束なので、
  // 実ホスト・実 URL がここへ戻ってきたら落ちる必要がある。
  "docs/spec/feat-reference-blog-admin-ux/**/*.md",
  "docs/spec/feat-reference-blog-admin-ux/**/*.json",
  // 収集器そのもの。ホストを 1 文字も持たない (設定で受け取る) という
  // 設計が守られているかを、実装側でも見る。
  "scripts/reference-site-analysis/**/*.py",
];

/**
 * **走査しないと決めたもの。理由つきでしか置けない。**
 *
 * `TARGETS` の glob から黙って外すのではなく、ここへ書く。
 * 黙って外すと「検査していない」と「検査して通った」の区別が消える。
 * この一覧は下の逆向き検査 (§母集団) が読み、母集団から差し引く。
 */
const NOT_SCANNED = [
  {
    pattern: "docs/spec/feat-reference-blog-admin-ux/evidence/*.raw.json",
    why: "隔離先。実 URL・実ホスト・sitemap の実体 digest を**意図的に**持つ唯一の置き場で、"
      + "ここが実名を持つからこそ抽象側が digest だけで済んでいる。検査すれば必ず落ちるが、"
      + "落ちることに意味は無い",
  },
  {
    pattern: "docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json",
    why: "同じく隔離先。収集器へ渡す設定 (対象ホストとサイト固有パス) であり、"
      + "収集器本体がホストを持たないための受け皿。記録ではなく入力なので検査対象にしない",
  },
  {
    pattern: "**/__pycache__/**",
    why: "Python の生成物。追跡しておらず、元の .py を検査すれば足りる",
  },
];

/**
 * **母集団 — 「この配下は全部 `TARGETS` に入っているはず」の宣言。**
 *
 * `TARGETS` は列挙式である。列挙式の走査対象は、**痩せても緑のまま**になる。
 * ファイルが 1 つ増えたとき、拡張子が 1 つ増えたとき、ディレクトリが割れたとき、
 * 検査は「見た件数が減った」とだけ言い、誰も減ったことに気づかない。
 * 2026-08-30 時点で `docs/spec/feat-blog-ops-crud/evidence/*.txt` が実際にそうなっていた
 * (`**\/*.md` しか見ていなかった)。
 *
 * そこで向きを逆にする。ディレクトリ単位で母集団を宣言し、
 * **`TARGETS` にも `NOT_SCANNED` にも入っていないファイルを列挙して落ちる**。
 * 走査対象を痩せさせるには、`NOT_SCANNED` に理由を書くしかなくなる。
 *
 * ここに並ぶのは「参考サイトの実名が漏れうる場所」だけである。
 * repo 全体を母集団にすると、この検査は「全ファイルを走査せよ」という別の要求になる。
 */
const SCANNED_DIRECTORIES = [
  {
    pattern: "docs/spec/feat-reference-blog-admin-ux/**",
    why: "参考サイト解析の成果物一式。抽象仕様と証跡が同居しており、境目が動きやすい",
  },
  {
    pattern: "scripts/reference-site-analysis/**",
    why: "収集器と検算器。ホストを持たない設計が崩れる場所",
  },
  {
    pattern: "docs/spec/feat-blog-ops-crud/**",
    why: "参考サイトの構成を抽象化して取り込んだ feature の仕様と証跡",
  },
  {
    pattern: "src/domain/blogops/**",
    why: "同じ構成を写した実装の中核",
  },
  {
    pattern: "src/application/usecases/blog-ops/**",
    why: "同上",
  },
  {
    pattern: "src/app/admin/blog/**",
    why: "同上 (画面)",
  },
  {
    pattern: "src/app/admin/site-network/**",
    why: "同上 (画面)",
  },
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
  // sitemap XML の名前空間 URI。取得先ではなく規格の識別子で、
  // 収集器が XML を解釈するために必ず書く必要がある。
  "www.sitemaps.org",
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

/** glob を展開してファイルだけを残す。`**` はディレクトリも返すため。 */
function expand(patterns) {
  const hits = patterns.flatMap((pattern) => globSync(pattern, { cwd: ROOT }));
  const out = new Set();
  for (const hit of hits) {
    const full = resolve(ROOT, hit);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    out.add(full);
  }
  return out;
}

/**
 * 走査するファイル。`TARGETS` から `NOT_SCANNED` を必ず差し引く。
 *
 * 差し引きを glob 側 (`TARGETS` を書き分ける) でやらないのは、
 * 除外が「書かれなかった glob」として消えてしまうため。
 * 除外は必ず `NOT_SCANNED` の 1 行として、理由と一緒に残す。
 */
function files() {
  const excused = expand(NOT_SCANNED.map((e) => e.pattern));
  return [...expand(TARGETS)].filter((f) => !excused.has(f)).sort();
}

/**
 * 逆向きの検査。母集団のうち、走査もされず除外理由も無いファイルを返す。
 *
 * 返り値が空でなければ落とす。**「検査対象が痩せた」を赤にするのがこの関数の仕事**で、
 * 中身の転用を見つけるのは別 (上の 3 種) である。
 */
function uncovered(scanned) {
  const population = expand(SCANNED_DIRECTORIES.map((d) => d.pattern));
  const excused = expand(NOT_SCANNED.map((e) => e.pattern));
  return [...population].filter((f) => !scanned.has(f) && !excused.has(f)).sort();
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
const missing = uncovered(new Set(checked));
const words = bannedWords();

for (const file of checked) {
  const text = readFileSync(file, "utf8");
  const where = relative(ROOT, file);

  for (const host of hostsOf(text)) {
    if (ALLOWED_HOSTS.has(host)) continue;
    if (
      host.endsWith(".local") ||
      host.endsWith(".invalid") ||
      host.endsWith(".example") ||
      host.endsWith(".test") ||
      host.startsWith("127.")
    ) {
      continue;
    }
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
console.log(
  `被覆の検査: 実行 (母集団 ${SCANNED_DIRECTORIES.length} 群 / 理由つき除外 ${NOT_SCANNED.length} 件)`,
);

if (checked.length === 0) {
  console.error("検査対象が 1 件もありません。走査が壊れています。");
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`\n走査から漏れているファイルが ${missing.length} 件あります:`);
  for (const file of missing) console.error(`  ${relative(ROOT, file)}`);
  console.error(
    "\nTARGETS に加えるか、NOT_SCANNED へ**理由を書いて**除外してください。"
      + "\n理由の無い除外は、次に見た人には「元から検査対象ではなかった」としか見えません。",
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`\n転用の疑いが ${violations.length} 件あります:`);
  for (const line of violations) console.error(`  ${line}`);
  process.exit(1);
}

console.log("\n転用の疑いは 0 件です。");
