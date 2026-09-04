/**
 * ブログ固有コンポーネントの雛形を作る。
 *
 * 契約: `docs/spec/feat-uiux-overhaul/blog-scaffold-contract.md`
 *
 * ## この道具が「ブログを作ったとき自動で走らない」理由
 *
 * 契約は **既定では固有部品のファイルを生成しない**と決めている。
 * ブログ 1 本ごとに 3 ファイル作ると、共通の直し 1 件が本数分の追従になる。
 * だから作成の流れ (`create_site_from_draft`) からは呼ばない。
 * 例外に当たったと**人が判断したとき**だけ、手で走らせる。
 *
 * ## 例外の 2 条件（両方を満たすときだけ使ってよい）
 *
 * 1. 共通コンポーネントの組み合わせでは表現できない構造である
 *    （節の並び替え・値の差し替え・表示の有無では届かない）
 * 2. 他のブログへ広がる見込みが無い（広がるなら共通部品に足す）
 *
 * この道具は 1 番目を判定できない。できるのは
 * **理由を書かせること**だけである。理由が書けないなら、
 * それは共通で表現できる差だ、というのが契約の考え方なので、
 * `--reason` を必須にし、短すぎるものを断る。
 *
 * ## 使い方
 *
 *   pnpm run scaffold:blog -- --slug <SiteBlueprint.id> --reason "<なぜ共通で表現できないか>"
 *   pnpm run scaffold:blog -- --slug ... --reason "..." --dry-run
 *
 * `<slug>` は `SiteBlueprint.id`。表示名を使わない（改名でパスが変わる）。
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SITES_DIR = join(ROOT, "src/presentation/sites");

/**
 * 理由の最小の長さ。
 *
 * 「独自のため」で通ると、この検査は何も見ていないのと同じになる。
 * 共通部品で表現できない構造を説明するには、どの部品で何が届かないかを
 * 書く必要があり、それは日本語で 40 字を下回らない。
 */
const REASON_MIN = 40;

/** `SiteBlueprint.id` として置ける形。パスになるので、ここで狭めておく。 */
const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

type Args = {
  readonly slug: string;
  readonly reason: string;
  readonly dryRun: boolean;
};

/**
 * 引数を読む。
 *
 * 足りないものは既定値で埋めず、**何が足りないかを言って止める**。
 * 既定値で埋めると、理由の無い雛形が黙って生まれる。
 */
function parseArgs(argv: readonly string[]): Args {
  const get = (name: string): string | null => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };

  const slug = get("slug");
  const reason = get("reason");
  const problems: string[] = [];

  if (slug === null || slug === "") {
    problems.push("--slug がありません。SiteBlueprint.id を渡してください（表示名ではありません）。");
  } else if (!SLUG_PATTERN.test(slug)) {
    problems.push(
      `--slug "${slug}" は使えません。英小文字で始まり、英小文字・数字・ハイフンだけ、2〜64 文字にしてください。`,
    );
  }

  if (reason === null || reason === "") {
    problems.push(
      "--reason がありません。なぜ共通コンポーネントで表現できないかを書いてください。書けない場合、それは共通で表現できる差です。",
    );
  } else if (reason.length < REASON_MIN) {
    problems.push(
      `--reason が短すぎます（${reason.length} 字）。${REASON_MIN} 字以上で、どの共通部品では何が届かないかを書いてください。`,
    );
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }

  return { slug: slug as string, reason: reason as string, dryRun: argv.includes("--dry-run") };
}

/** 固有部品の入口。共通側はここ経由でしか読まない。 */
function indexSource(slug: string, reason: string): string {
  return `/**
 * ${slug} だけが持つ部品の入口。
 *
 * ${reason}
 *
 * 共通で表現できるようになったら、この一式は消す。
 * 消し方は README.md に書いてある。
 */

/**
 * 固有部品の書き出し。
 *
 * 名前は共通部品と衝突させない。衝突すると、読み手は
 * どちらを見ているのか分からなくなる。
 */
export const SITE_SLUG = "${slug}";
`;
}

/** なぜ例外にしたかの記録。必須にするのは、例外が増えたときに気付くため。 */
function readmeSource(slug: string, reason: string): string {
  return `# ${slug} の固有部品

## なぜ共通コンポーネントで表現できなかったか

${reason}

## 例外の 2 条件

- [ ] 共通コンポーネントの組み合わせでは表現できない構造である
- [ ] 他のブログへ広がる見込みが無い

**2 つ目に印が付かなくなったら、共通部品へ引き上げる。**
他のブログでも欲しくなった時点で、ここに置いておく理由は無くなる。

## 消し方

1. 共通部品または \`SiteBlueprint\` の項目で表現し直す
2. \`src/presentation/sites/index.ts\` の \`OVERRIDES\` からこのブログの行を消す
3. このディレクトリごと消す

## 登録

このディレクトリは、置いただけでは読まれない。
\`src/presentation/sites/index.ts\` の \`OVERRIDES\` に足して初めて共通側から読まれる。
`;
}

function main(): void {
  const { slug, reason, dryRun } = parseArgs(process.argv.slice(2));
  const dir = join(SITES_DIR, slug);

  /*
    既にあるなら、何も書かずに止める。

    上書きすると、書いてあった理由（なぜ例外にしたか）が消える。
    理由が消えた固有部品は、共通へ引き上げてよいのか判断できなくなり、
    そのまま残り続ける。
  */
  if (existsSync(dir)) {
    console.error(`✗ ${relative(ROOT, dir)} は既にあります。上書きしません。`);
    console.error("  作り直すなら、中身を確かめてから手で消してください。");
    process.exit(1);
  }

  const files = [
    { path: join(dir, "index.ts"), body: indexSource(slug, reason) },
    { path: join(dir, "README.md"), body: readmeSource(slug, reason) },
    // 独自セクションは 0 個でもよい。置き場だけ先に決めておく。
    { path: join(dir, "sections/.gitkeep"), body: "" },
  ];

  if (dryRun) {
    console.log("— 下見（何も書きません）—");
    for (const f of files) console.log(`  作る: ${relative(ROOT, f.path)}`);
    return;
  }

  mkdirSync(join(dir, "sections"), { recursive: true });
  for (const f of files) writeFileSync(f.path, f.body, "utf8");
  for (const f of files) console.log(`✓ ${relative(ROOT, f.path)}`);

  /*
    登録簿への追記は**しない**。

    追記した瞬間に共通側がこの部品を読み始める。それは
    「例外を認める」という判断そのもので、機械が黙って進めてよい種類ではない。
    手順だけ出して、書くのは人に任せる。
  */
  console.log("");
  console.log("次にすること: src/presentation/sites/index.ts の OVERRIDES へ 1 行足してください。");
  console.log("  {");
  console.log(`    slug: "${slug}",`);
  console.log(`    reason: "${reason}",`);
  console.log(`    load: () => import("./${slug}"),`);
  console.log("  },");
  console.log("");
  console.log("足すまで、このディレクトリはどこからも読まれません。");
}

main();
