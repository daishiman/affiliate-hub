/** @tier 1 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * 保存先の**表そのもの**と、そこへ実際に飛ぶ**問い合わせ**が、
 * 作業場所（ワークスペース）で切れていることを固定する。
 *
 * --- ここが要る理由 ---
 *
 * `tenant-scoped-ports.test.ts` は入口（Repository ポート）の**宣言**だけを読む。
 * それは意図的で、あの検査の説明にもこう書いてある——
 * 「実際の SQL に workspace_id が付いているかは別の検査が見る」。
 * **その別の検査が無かった。** 設計文書（`docs/spec/feat-auth-workspace/architecture-design.md`
 * の「この設計が保証しないもの」）も同じ穴を名指しし、結合テスト頼みだと書いている。
 *
 * 結合テスト頼みには弱点がある。結合テストは**書いた経路しか通らない**。
 * 新しい読み口を 1 本足して、そこだけ `where workspace_id` を書き忘れたとき、
 * その 1 本に対応する結合テストも同時に書き忘れていれば、**全部緑のまま漏れる**。
 * だからここでは、経路ではなく**宣言と問い合わせを全部読む**。
 *
 * --- 4 つ見る ---
 *
 *   1. 表に `workspace_id` の列がある（無いものは理由つきで免除）
 *   2. 免除した「使われていない表」が、本当にどこからも触られていない
 *   3. 作業場所で絞る索引がある（索引が無いと、増えたときに全表走査になる）
 *   4. 表への問い合わせが `workspace_id` で絞っている（絞らないものは理由つきで免除）
 *
 * 4 の免除は**件数まで書く**。理由だけだと、同じファイル・同じ表に
 * 2 本目の絞らない問い合わせを足したとき、既存の免除に吸われて緑で通る。
 *
 * 規範: docs/spec/01-要求仕様書-v1.0.md §26.4 / docs/spec/feat-auth-workspace/migration-decision.md
 * @req REQ-SEC01, REQ-P01
 * @types tenant-isolation, code-boundary
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const SCHEMA_FILES = ["src/db/schema.ts", "src/db/auth-schema.ts"];

/**
 * 作業場所を持たなくてよい表。**理由を書けないものは載せられない。**
 *
 * `kind` の意味:
 *   - `legacy_unused`: 昔の設計の名残。**どこからも使われていない**ことを 2 で機械が確かめる。
 *     使い始めた瞬間に赤くなる。そうしないと「使われていないから安全」が黙って崩れる。
 *   - `not_tenant_data`: そもそも作業場所より外側にあるもの（作業場所そのもの・身元）。
 */
const TABLE_EXEMPT: Readonly<
  Record<string, { readonly kind: "legacy_unused" | "not_tenant_data"; readonly why: string }>
> = {
  // --- 昔の設計の名残（2026-08-24 実測: src/ のどこからも import されていない） ---
  asps: { kind: "legacy_unused", why: "旧・運営者ドメイン。読み書きする口が 1 つも無い" },
  programs: { kind: "legacy_unused", why: "旧・運営者ドメイン。読み書きする口が 1 つも無い" },
  conversions: {
    kind: "legacy_unused",
    why: "旧・成果。いまの成果は affiliate_conversions（作業場所つき）",
  },
  categories: {
    kind: "legacy_unused",
    why: "旧・読者ドメイン。いまの分類は site_blueprints の中",
  },
  people: { kind: "legacy_unused", why: "旧・読者ドメイン。いまの人物は published_articles の中" },
  products: {
    kind: "legacy_unused",
    why: "旧・商品。いまの商品は catalog_products（作業場所つき）",
  },
  articles: {
    kind: "legacy_unused",
    why: "旧・記事。いまの記事は content_variants / published_articles",
  },
  article_people: { kind: "legacy_unused", why: "旧・記事の関連表" },
  article_products: { kind: "legacy_unused", why: "旧・記事の関連表" },
  conversation_blocks: { kind: "legacy_unused", why: "旧・記事の構成要素" },
  faqs: { kind: "legacy_unused", why: "旧・記事の構成要素" },
  update_logs: { kind: "legacy_unused", why: "旧・記事の更新履歴" },

  // --- 作業場所より外側 ---
  workspaces: { kind: "not_tenant_data", why: "作業場所そのもの。id が作業場所である" },
  signin_denials: {
    kind: "not_tenant_data",
    why: "ログインを断った記録。断られた人はまだどの作業場所にも属していない",
  },
  user: { kind: "not_tenant_data", why: "Better Auth の身元。1 人が複数の作業場所に属しうる" },
  session: { kind: "not_tenant_data", why: "Better Auth の内部表" },
  account: { kind: "not_tenant_data", why: "Better Auth の内部表（外部提供元との紐付け）" },
  verification: { kind: "not_tenant_data", why: "Better Auth の内部表" },
  rate_limit: { kind: "not_tenant_data", why: "Better Auth の内部表" },
};

/**
 * 作業場所で始まる索引が無くてよい表。**理由を書けないものは載せられない。**
 *
 * 索引は速さの話に見えるが、ここでは分離の話でもある。
 * 絞る列に索引が無いと、1 つの作業場所の 1 件を読むために**全部の作業場所の行を走る**。
 * 行数が増えた日に、他所のデータの量が自分の応答時間として漏れる。
 */
const INDEX_EXEMPT: Readonly<Record<string, string>> = {
  sessions: "主キーが合言葉の潰した値。作業場所は結果として読む列で、絞る列ではない",
  integration_key_usages:
    "鍵 id で数える。鍵そのものが 1 つの作業場所に属するので、鍵 id が既に作業場所を含んでいる",
};

/**
 * 作業場所で絞らない問い合わせ。**`件数` と `理由` の両方が要る。**
 *
 * 鍵は `ファイル::表::メソッド名`。行番号で書かないのは、
 * 上に 1 行足しただけで免除が外れて赤くなるのを避けるためである。
 */
const QUERY_EXEMPT: Readonly<Record<string, { readonly count: number; readonly why: string }>> = {
  "infrastructure/identity/session-issuer.ts::memberships::issue": {
    count: 1,
    why: "招待の受諾。受諾する時点でその人はまだどこにも属していない（属させるのがこの処理）",
  },
  "infrastructure/identity/session-issuer.ts::sessions::revoke": {
    count: 1,
    why: "ログアウト。合言葉の潰した値が主キー",
  },
  "infrastructure/identity/session-repository.ts::sessions::findValid": {
    count: 1,
    why: "合言葉から作業場所を決める処理。作業場所はここの出力であって入力ではない",
  },
  "infrastructure/persistence/d1/distribution-repository.ts::publications::listDue": {
    count: 1,
    why: "予定時刻の来た配信を全作業場所から集める。呼ぶのは人ではなく時計で、身元が無い",
  },
  "infrastructure/persistence/d1/feedback-repository.ts::integrationKeys::authenticate": {
    count: 1,
    why: "鍵の値から作業場所を決める処理。作業場所はここの出力",
  },
  "infrastructure/persistence/d1/feedback-repository.ts::integrationKeys::withinRateLimit": {
    count: 1,
    why: "鍵 id で引く。鍵は authenticate が既に 1 つの作業場所へ確定させている",
  },
  "infrastructure/persistence/d1/feedback-repository.ts::integrationKeyUsages::withinRateLimit": {
    count: 1,
    why: "同上。鍵 id が既に作業場所を含んでいる",
  },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::storedSummaries":
    { count: 1, why: "読者向けの公開ページ。読者に作業場所は無く、手がかりは URL の名前だけ" },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::listByCategory":
    { count: 1, why: "同上（読者向け）" },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::findArticle": {
    count: 1,
    why: "同上（読者向け）",
  },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::search": {
    count: 1,
    why: "同上（読者向け）",
  },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::findPerson": {
    count: 1,
    why: "同上（読者向け）",
  },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::listByPerson": {
    count: 1,
    why: "同上（読者向け）",
  },
  "infrastructure/persistence/d1/redirect-repository.ts::redirectResolutions::resolve": {
    count: 1,
    why: "読者が押した転送の引き当て。手がかりは合言葉（主キー）だけ",
  },
  "infrastructure/persistence/d1/redirect-repository.ts::redirectResolutions::issue": {
    count: 1,
    why: "無効にする行は直前の findSlot(workspaceId, ...) で作業場所つきに絞って取った行。code は主キー",
  },
  "infrastructure/persistence/d1/site-draft-repository.ts::siteBlueprints::listPublishedBlueprints":
    { count: 1, why: "読者向けの公開ブログ一覧。読者に作業場所は無い" },
};

// ---------------------------------------------------------------------------
// 読み取り
// ---------------------------------------------------------------------------

type Table = {
  /** `export const catalogProducts = ...` の左辺。問い合わせ側はこの名前で書く。 */
  readonly symbol: string;
  /** `sqliteTable("catalog_products", ...)` の中身。免除表はこの名前で書く。 */
  readonly name: string;
  readonly hasWorkspaceId: boolean;
  /** 作業場所で始まる索引・主キーがあるか。 */
  readonly leadsWithWorkspaceId: boolean;
};

/**
 * `sqliteTable(...)` の呼び出しを構文として読む。
 *
 * 正規表現で切らないのは、説明文の中の同じ語まで拾ってしまうためである
 * （このファイル自身も含め、`workspace_id` は多くのコメントに出てくる）。
 */
function readTables(): readonly Table[] {
  const tables: Table[] = [];

  for (const rel of SCHEMA_FILES) {
    const path = join(ROOT, rel);
    const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);

    ts.forEachChild(src, (node) => {
      if (!ts.isVariableStatement(node)) return;
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (init === undefined || !ts.isCallExpression(init)) continue;
        if (init.expression.getText() !== "sqliteTable") continue;
        const nameArg = init.arguments[0];
        if (nameArg === undefined || !ts.isStringLiteral(nameArg)) continue;

        const columns = init.arguments[1];
        const hasWorkspaceId =
          columns !== undefined &&
          ts.isObjectLiteralExpression(columns) &&
          columns.properties.some(
            (p) => ts.isPropertyAssignment(p) && p.name.getText() === "workspaceId",
          );

        // 第 3 引数（索引と主キーの宣言）は `(t) => [...]` の形で書かれている。
        const extrasText = init.arguments[2]?.getText().replace(/\s+/g, " ") ?? "";
        const leadsWithWorkspaceId =
          /\.on\(\s*t\.workspaceId\b/.test(extrasText) ||
          /primaryKey\(\{\s*columns:\s*\[\s*t\.workspaceId\b/.test(extrasText);

        tables.push({
          symbol: decl.name.getText(),
          name: nameArg.text,
          hasWorkspaceId,
          leadsWithWorkspaceId,
        });
      }
    });
  }
  return tables;
}

function sourceFilesUnder(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sourceFilesUnder(join(dir, e.name))
      : /\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

/** 保存先の定義そのもの（`src/db/`）を除いた、`src/` の全ファイル。 */
function consumerFiles(): readonly string[] {
  return sourceFilesUnder(SRC).filter((f) => !relative(SRC, f).startsWith(`db${sep}`));
}

/** `@/db/schema` から名前で取り込んでいる表の一覧。 */
function importedTableSymbols(files: readonly string[]): ReadonlySet<string> {
  const found = new Set<string>();
  for (const file of files) {
    const src = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    ts.forEachChild(src, (node) => {
      if (!ts.isImportDeclaration(node)) return;
      const from = node.moduleSpecifier.getText().replace(/["']/g, "");
      if (!/db\/(auth-)?schema$/.test(from)) return;
      const bindings = node.importClause?.namedBindings;
      if (bindings === undefined || !ts.isNamedImports(bindings)) return;
      for (const el of bindings.elements) found.add((el.propertyName ?? el.name).text);
    });
  }
  return found;
}

type Query = {
  readonly key: string;
  readonly scoped: boolean;
};

/**
 * `db.select().from(表)` / `db.update(表)` / `db.delete(表)` を全部読み、
 * その 1 本が `表.workspaceId` を条件に含んでいるかを見る。
 *
 * `where` の中身が変数やヘルパーに切り出してある書き方が多いので、
 * **同じファイルの中で、その問い合わせより前に宣言された同名のもの**を 1 段だけ差し込んで読む。
 * 「その問い合わせより前」に限るのは、同じ名前（`where` など）が
 * 複数のメソッドで使い回されているためで、後ろのものを混ぜると別のメソッドの
 * 条件を読んで緑になる（実際、これを入れる前は 1 件それで見逃していた）。
 */
function readQueries(tenantSymbols: ReadonlySet<string>, files: readonly string[]): readonly Query[] {
  const queries: Query[] = [];

  for (const file of files) {
    const src = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const rel = relative(SRC, file).split(sep).join("/");

    const decls = new Map<string, { pos: number; text: string }[]>();
    const remember = (name: string, node: ts.Node): void => {
      const list = decls.get(name) ?? [];
      list.push({ pos: node.getStart(), text: node.getText() });
      decls.set(name, list);
    };
    const collect = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name !== undefined) remember(node.name.text, node);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
        remember(node.name.text, node);
      ts.forEachChild(node, collect);
    };
    collect(src);

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const call = node.expression.name.text;
        const target = node.arguments[0]?.getText() ?? "";
        // insert は行を作る側で、値に workspace_id が入っているかは別の話（列の検査が見る）。
        if (
          (call === "from" || call === "update" || call === "delete") &&
          node.arguments.length === 1 &&
          tenantSymbols.has(target)
        ) {
          let top: ts.Node = node;
          while (
            top.parent !== undefined &&
            (ts.isCallExpression(top.parent) ||
              ts.isPropertyAccessExpression(top.parent) ||
              ts.isAwaitExpression(top.parent))
          ) {
            top = top.parent;
          }
          const at = node.getStart();
          let text = top.getText();
          for (const [name, list] of decls) {
            if (!new RegExp(`\\b${name}\\b`).test(text)) continue;
            const before = list.filter((d) => d.pos < at);
            const pick = before.length > 0 ? before[before.length - 1] : list[0];
            if (pick !== undefined) text += `\n${pick.text}`;
          }

          let owner = "(無名)";
          let up: ts.Node | undefined = node.parent;
          while (up !== undefined) {
            if (
              (ts.isMethodDeclaration(up) || ts.isFunctionDeclaration(up)) &&
              up.name !== undefined
            ) {
              owner = up.name.getText();
              break;
            }
            if (ts.isPropertyAssignment(up)) {
              owner = up.name.getText();
              break;
            }
            up = up.parent;
          }

          queries.push({
            key: `${rel}::${target}::${owner}`,
            scoped: new RegExp(`${target}\\.workspaceId`).test(text),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return queries;
}

const TABLES = readTables();
const TENANT_SYMBOLS = new Set(TABLES.filter((t) => t.hasWorkspaceId).map((t) => t.symbol));
const CONSUMERS = consumerFiles();
const IMPORTED = importedTableSymbols(CONSUMERS);
const QUERIES = readQueries(TENANT_SYMBOLS, CONSUMERS);

// ---------------------------------------------------------------------------
// 検査
// ---------------------------------------------------------------------------

/**
 * 母集団の床は、**0 を主張する `it` の中に置く**（`form2-population-floor.test.ts` の族）。
 *
 * 「そもそも読み取れている」を独立した `it` に切り出すと読みやすいが、
 * **0 を主張する側と、母集団が空でないことを言う側が別々に緑になれる。**
 * 走査が壊れて 1 件も読めなくなった日、前者は「違反 0 件」で緑のまま黙る。
 */
describe("保存先の表は、作業場所で切れている", () => {
  it("すべての表に workspace_id がある（無いものは理由つきで免除）", () => {
    expect(TABLES.length).toBeGreaterThan(35);
    expect(TENANT_SYMBOLS.size).toBeGreaterThan(20);
    const missing = TABLES.filter(
      (t) => !t.hasWorkspaceId && TABLE_EXEMPT[t.name] === undefined,
    ).map((t) => t.name);
    expect(
      missing,
      "作業場所を持たない表が増えています。列を足すか、TABLE_EXEMPT へ理由を書いてください。",
    ).toEqual([]);
  });

  it("免除の一覧に、もう要らないものが残っていない", () => {
    // 列を足したのに免除が残ると、次に同じ穴が開いても検査が通ってしまう。
    expect(TABLES.length).toBeGreaterThan(35);
    expect(Object.keys(TABLE_EXEMPT).length).toBeGreaterThan(15);
    const known = new Set(TABLES.map((t) => t.name));
    const stale = Object.keys(TABLE_EXEMPT).filter((name) => {
      const t = TABLES.find((x) => x.name === name);
      return t === undefined || t.hasWorkspaceId || !known.has(name);
    });
    expect(
      stale,
      "免除が実態と合っていません。直したものは TABLE_EXEMPT から消してください。",
    ).toEqual([]);
  });

  it("免除には必ず理由が書いてある", () => {
    expect(Object.keys(TABLE_EXEMPT).length).toBeGreaterThan(15);
    const empty = Object.entries(TABLE_EXEMPT)
      .filter(([, v]) => v.why.trim() === "")
      .map(([name]) => name);
    expect(empty).toEqual([]);
  });
});

/**
 * 「使われていないから安全」を、機械が確かめ続ける。
 *
 * 昔の設計の表 12 本には `workspace_id` が無い。列を足さずに済ませているのは
 * **どこからも読み書きしていない**からで、その前提は人の記憶では保てない。
 * 誰かが `articles` を使い始めた日に、その 1 本は作業場所をまたいで読める。
 * **画面からは何も変わって見えない。**
 */
describe("作業場所を持たない古い表は、どこからも触られていない", () => {
  it("使い始めたものが 1 つも無い", () => {
    const legacy = Object.entries(TABLE_EXEMPT)
      .filter(([, v]) => v.kind === "legacy_unused")
      .map(([name]) => name);
    // 床は同じ `it` の中に置く。import を 1 つも読めていなければ、
    // 「誰も使っていない」も「誰も読めていない」も同じ空の一覧で出る。
    expect(legacy.length).toBeGreaterThan(5);
    expect(IMPORTED.size).toBeGreaterThan(10);

    const symbolOf = new Map(TABLES.map((t) => [t.name, t.symbol]));
    const used = legacy.filter((name) => {
      const symbol = symbolOf.get(name);
      return symbol !== undefined && IMPORTED.has(symbol);
    });
    expect(
      used,
      "作業場所を持たない古い表を使い始めています。使うなら先に workspace_id を足してください。",
    ).toEqual([]);
  });
});

describe("作業場所で絞る索引がある", () => {
  it("作業場所を持つ表は、作業場所で始まる索引か主キーを持つ", () => {
    expect(TENANT_SYMBOLS.size).toBeGreaterThan(20);
    const missing = TABLES.filter(
      (t) => t.hasWorkspaceId && !t.leadsWithWorkspaceId && INDEX_EXEMPT[t.name] === undefined,
    ).map((t) => t.name);
    expect(
      missing,
      "作業場所で絞る索引がありません。索引を足すか、INDEX_EXEMPT へ理由を書いてください。",
    ).toEqual([]);
  });

  it("索引の免除に、もう要らないものが残っていない", () => {
    expect(TABLES.length).toBeGreaterThan(35);
    expect(Object.keys(INDEX_EXEMPT).length).toBeGreaterThan(1);
    const stale = Object.keys(INDEX_EXEMPT).filter((name) => {
      const t = TABLES.find((x) => x.name === name);
      return t === undefined || !t.hasWorkspaceId || t.leadsWithWorkspaceId;
    });
    expect(stale).toEqual([]);
  });
});

/**
 * ここが `tenant-scoped-ports.test.ts` に無かったほうである。
 *
 * あちらは入口の**宣言**を読む。引数に `workspaceId` があっても、
 * 実装の中でそれを `where` に書き忘れれば、**型は通り、テストも緑で、データだけが混ざる**。
 */
describe("表への問い合わせは、作業場所で絞っている", () => {
  it("絞らない問い合わせは、理由つきで免除されたものだけ", () => {
    expect(QUERIES.length).toBeGreaterThan(50);
    const surprises = QUERIES.filter((q) => !q.scoped)
      .filter((q) => QUERY_EXEMPT[q.key] === undefined)
      .map((q) => q.key)
      .sort();
    expect(
      surprises,
      "作業場所で絞らない問い合わせが増えています。where に workspace_id を足すか、QUERY_EXEMPT へ理由を書いてください。",
    ).toEqual([]);
  });

  it("免除した件数と、実際に絞っていない件数が一致する", () => {
    // 理由だけの免除だと、同じメソッドに 2 本目を足したときに黙って吸われる。
    expect(QUERIES.length).toBeGreaterThan(50);
    expect(Object.keys(QUERY_EXEMPT).length).toBeGreaterThan(10);
    const actual = new Map<string, number>();
    for (const q of QUERIES.filter((x) => !x.scoped))
      actual.set(q.key, (actual.get(q.key) ?? 0) + 1);
    const drift = Object.entries(QUERY_EXEMPT)
      .map(([key, v]) => ({ key, declared: v.count, actual: actual.get(key) ?? 0 }))
      .filter((x) => x.declared !== x.actual)
      .map((x) => `${x.key}: 宣言 ${x.declared} 件 / 実際 ${x.actual} 件`);
    expect(
      drift,
      "免除の件数が実態と合っていません。直したなら減らし、増やしたなら理由を確かめてください。",
    ).toEqual([]);
  });

  it("免除には必ず理由が書いてある", () => {
    expect(Object.keys(QUERY_EXEMPT).length).toBeGreaterThan(10);
    const empty = Object.entries(QUERY_EXEMPT)
      .filter(([, v]) => v.why.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("絞っている問い合わせのほうが多い（全部免除にして緑にしていないこと）", () => {
    // 免除だけが積み上がると、この検査は「何も見ていない」に近づく。
    const unscoped = QUERIES.filter((q) => !q.scoped).length;
    expect(QUERIES.length).toBeGreaterThan(50);
    expect(QUERIES.length - unscoped).toBeGreaterThan(unscoped * 2);
  });
});

describe("広告表記を tenant 化する migration は、所有者を推測しない", () => {
  const migration = readFileSync(join(ROOT, "drizzle/0022_orange_mystique.sql"), "utf8");
  const schema = readFileSync(join(ROOT, "src/db/schema.ts"), "utf8");
  const disclosureSchema = schema.slice(
    schema.indexOf("export const disclosures"),
    schema.indexOf("export const policyRules"),
  );

  it("旧行があるときは、空の workspace_id を付けて続行せず先に停止する", () => {
    const guard = migration.indexOf("_migration_0022_disclosure_guard");
    const tenantColumn = migration.indexOf("ALTER TABLE `disclosures` ADD `workspace_id`");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(tenantColumn).toBeGreaterThan(guard);
    expect(migration).toContain("CHECK (`legacy_count` = 0)");
    expect(migration).not.toMatch(/workspace_id` text DEFAULT '' NOT NULL/);
  });

  it("repository が必ず渡す tenant と更新時刻に、危険な migration 用defaultを残さない", () => {
    expect(migration).not.toMatch(
      /ALTER TABLE `disclosures` ADD `updated_at` integer DEFAULT \(unixepoch\(\)\) NOT NULL/,
    );
    expect(disclosureSchema.length).toBeGreaterThan(500);
    expect(disclosureSchema).not.toMatch(
      /workspaceId:\s*text\("workspace_id"\)\.notNull\(\)\.default\(""\)/,
    );
    expect(disclosureSchema).not.toMatch(
      /updatedAt:\s*integer\("updated_at"[^)]*\)[\s\S]{0,80}\.default\(sql`\(unixepoch\(\)\)`\)/,
    );
  });
});
