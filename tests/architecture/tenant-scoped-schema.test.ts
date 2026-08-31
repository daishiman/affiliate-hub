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
 *   - `unwired`: **これから使う**が、まだ表しか無いもの。`legacy_unused` と機械の扱いは同じで
 *     （2 が import を見張る）、人に対する意味だけが逆である。片付ける先が過去ではなく未来にある。
 *     `legacy_unused` に混ぜると「もう使わない」と読めてしまい、**配線する人が免除に気づかない**。
 *
 * `UNWIRED` はその名前の一覧で、**索引側の免除（`INDEX_EXEMPT`）とも共有する**。
 * 未配線を根拠にした免除は、列が無い側と索引が無い側の両方に出る。
 * 根拠が 1 つなら置き場所も 1 つにしないと、片側だけ剥がれて穴が残る。
 */
const UNWIRED: ReadonlySet<string> = new Set([
  "blog_theme",
  "page_theme_override",
  "blog_template",
]);

const TABLE_EXEMPT: Readonly<
  Record<
    string,
    { readonly kind: "legacy_unused" | "not_tenant_data" | "unwired"; readonly why: string }
  >
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
  reader_shortlist_items: {
    kind: "not_tenant_data",
    why:
      "読者が押した「気になる商品」。読者は作業場所に属さない。" +
      "切り分けは site_slug + reader_key で、作業場所の列を足すと" +
      "読者の行に運営側の所属が付き、読者と運営者を結び付けられるようになる",
  },
  user: { kind: "not_tenant_data", why: "Better Auth の身元。1 人が複数の作業場所に属しうる" },
  session: { kind: "not_tenant_data", why: "Better Auth の内部表" },
  account: { kind: "not_tenant_data", why: "Better Auth の内部表（外部提供元との紐付け）" },
  verification: { kind: "not_tenant_data", why: "Better Auth の内部表" },
  rate_limit: { kind: "not_tenant_data", why: "Better Auth の内部表" },
  channel_provider_delivery_leases: {
    kind: "not_tenant_data",
    why:
      "provider DID単位の全workspace共通短期mutex。workspaceを鍵に含めると" +
      "同じ外部アカウントへ別workspaceから並行送信できる",
  },

  /*
   * --- まだ配線していない（2026-08-24 実測: src/ のどこからも import されていない） ---
   *
   * dev が足したブログ用の表。作業場所ではなく `site_slug` を鍵にしている。
   * `site_blueprints_slug_idx` は slug 単独の一意索引なので、slug は**全作業場所を通して一意**であり、
   * いまのところ slug が分かれば作業場所も一意に決まる。**だから安全なのではない。**
   * その一意性は `site_blueprints` の索引 1 本が支えているだけで、
   * 作業場所ごとに slug を再利用したくなった日（`sites` を作業場所つきにした日）に黙って崩れる。
   *
   * それでも今ここで `workspace_id` を足す移行を書かないのは、**読み書きする口がまだ 1 つも無い**からで、
   * 列の形は最初の口を書く人が決めたほうが正しい。前提は 2 が見張る。
   */
  blog_theme: { kind: "unwired", why: "site_slug 鍵。読み書きする口がまだ無い" },
  page_theme_override: { kind: "unwired", why: "site_slug 鍵。読み書きする口がまだ無い" },
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

  /*
   * この 2 本は `workspace_id` **列は持っている**が、索引が `site_slug` で始まる。
   * 上の 2 本と根拠は同じ（未配線）なので `UNWIRED` に載っていることを機械が確かめる。
   * 最初の口を書く人が、索引を作業場所始まりに直す。
   */
  blog_template: "未配線。site_slug 始まりの索引しか無い。最初の口を書くときに直す",
};

/**
 * 作業場所で絞らない問い合わせ。**`件数` と `理由` の両方が要る。**
 *
 * 鍵は `ファイル::表::メソッド名`。行番号で書かないのは、
 * 上に 1 行足しただけで免除が外れて赤くなるのを避けるためである。
 */
const QUERY_EXEMPT: Readonly<Record<string, { readonly count: number; readonly why: string }>> = {
  "infrastructure/persistence/d1/site-document-repository.ts::legalPages::findSiteDocument": {
    count: 1,
    why: "読者向けの 1 枚引き。読者に作業場所は無い（URL 名がそのまま公開の単位）",
  },
  "infrastructure/persistence/d1/site-document-repository.ts::legalPages::save": {
    count: 1,
    why: "書き換え先の id は直前の作業場所つきの検索で得たもので、主キー 1 件を指す",
  },
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
  "infrastructure/persistence/d1/publication-delivery-audit-outbox.ts::publicationDeliveryAuditOutbox::flush":
    {
      count: 3,
      why:
        "時計が全workspaceのcommit済み・未配送intentを再送する。各行はworkspaceIdを保持し、" +
        "人のtenant文脈で読む処理ではない",
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
  "infrastructure/persistence/d1/reader-tool-repository.ts::readerTools::findRow": {
    count: 1,
    why: "読者向けの診断・計算。読者に作業場所は無く、手がかりは URL の名前だけ",
  },
  "infrastructure/persistence/d1/reader-tool-repository.ts::readerTools::list": {
    count: 1,
    why: "同上（読者向け）。1 つのサイトの道具一覧で、他サイトの行は返らない",
  },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::findPerson": {
    count: 1,
    why: "同上（読者向け）",
  },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticles::listByPerson": {
    count: 1,
    why: "同上（読者向け）",
  },
  "infrastructure/persistence/d1/published-article-repository.ts::publishedArticleTombstones::hiddenSlugs": {
    count: 1,
    why: "読者向けの公開ページ。URL名に対応する墓標を全workspace横断で確認し、見本の再露出を防ぐ",
  },
  "infrastructure/persistence/d1/redirect-repository.ts::redirectResolutions::resolve": {
    count: 1,
    why: "読者が押した転送の引き当て。手がかりは合言葉（主キー）だけ",
  },
  "infrastructure/persistence/d1/redirect-repository.ts::redirectResolutions::issue": {
    count: 1,
    why: "無効にする行は直前の findSlot(workspaceId, ...) で作業場所つきに絞って取った行。code は主キー",
  },
  "infrastructure/persistence/d1/blog-ops-repository.ts::blogArticleRatings::summarize": {
    count: 1,
    why: "読者向けの平均点。読者に作業場所は無く、手がかりは公開中の記事 id だけ",
  },
  "infrastructure/persistence/d1/site-draft-repository.ts::siteBlueprints::listPublishedBlueprints":
    { count: 1, why: "読者向けの公開ブログ一覧。読者に作業場所は無い" },
  "infrastructure/persistence/d1/site-draft-repository.ts::siteRetirements::listPublishedBlueprints":
    {
      count: 1,
      why: "読者向けの公開ブログ一覧。全体一意のURL名の墓標を重ね、取り下げた見本の再露出を防ぐ",
    },
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
describe("使われていないことを根拠にした免除は、使われていない", () => {
  it("使い始めたものが 1 つも無い", () => {
    /*
     * `legacy_unused`（過去）と `UNWIRED`（未来）は、人にとっては逆向きだが
     * **機械にとっては同じ 1 つの主張**である——「この表を読み書きする口は無い」。
     * 主張が同じなら見張りも 1 つにする。片方だけ見張ると、
     * 見張られていない側から同じ穴が開く。
     */
    const unused = [
      ...Object.entries(TABLE_EXEMPT)
        .filter(([, v]) => v.kind === "legacy_unused" || v.kind === "unwired")
        .map(([name]) => name),
      ...UNWIRED,
    ];
    // 床は同じ `it` の中に置く。import を 1 つも読めていなければ、
    // 「誰も使っていない」も「誰も読めていない」も同じ空の一覧で出る。
    expect(unused.length).toBeGreaterThan(5);
    expect(IMPORTED.size).toBeGreaterThan(10);

    const symbolOf = new Map(TABLES.map((t) => [t.name, t.symbol]));
    const used = unused.filter((name) => {
      const symbol = symbolOf.get(name);
      return symbol !== undefined && IMPORTED.has(symbol);
    });
    expect(
      used,
      "使われていないことを根拠に免除した表を、使い始めています。使うなら先に workspace_id と作業場所始まりの索引を足してください。",
    ).toEqual([]);
  });

  it("未配線の一覧は、実在する表だけを指している", () => {
    // 表を消した／名前を変えたのに一覧が残ると、次に同じ名前の表を足した日に黙って免除される。
    expect(UNWIRED.size).toBeGreaterThan(2);
    expect(TABLES.length).toBeGreaterThan(35);
    const known = new Set(TABLES.map((t) => t.name));
    expect([...UNWIRED].filter((name) => !known.has(name))).toEqual([]);
  });

  it("未配線を根拠にした免除は、両方の免除表で同じ一覧を指している", () => {
    /*
     * 根拠が 1 つで置き場所が 2 つある以上、ずれうる。
     * `INDEX_EXEMPT` にだけ足して `UNWIRED` に足し忘れると、
     * その表は**見張りの外**で免除され続ける。
     */
    expect(UNWIRED.size).toBeGreaterThan(2);
    const claimed = [
      ...Object.entries(TABLE_EXEMPT)
        .filter(([, v]) => v.kind === "unwired")
        .map(([name]) => name),
      ...Object.entries(INDEX_EXEMPT)
        .filter(([, why]) => why.startsWith("未配線"))
        .map(([name]) => name),
    ];
    expect(claimed.length).toBeGreaterThan(2);
    expect(
      claimed.filter((name) => !UNWIRED.has(name)),
      "未配線を理由に免除した表が UNWIRED に載っていません。載せないと、使い始めても赤くなりません。",
    ).toEqual([]);
    expect(
      [...UNWIRED].filter((name) => !claimed.includes(name)),
      "UNWIRED に載っているのに、どちらの免除表からも理由が消えています。",
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
  const migration = readFileSync(join(ROOT, "drizzle/0023_orange_mystique.sql"), "utf8");
  const schema = readFileSync(join(ROOT, "src/db/schema.ts"), "utf8");
  const disclosureSchema = schema.slice(
    schema.indexOf("export const disclosures"),
    schema.indexOf("export const policyRules"),
  );

  it("旧行があるときは、空の workspace_id を付けて続行せず先に停止する", () => {
    const guard = migration.indexOf("_migration_0023_disclosure_guard");
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

/**
 * 2026-08-27、dev を取り込んだときに**検査する相手が入れ替わった**。
 *
 * こちらの枝は `0034_parched_inhumans` で legal_page を作り直し、
 * 所有者を復元できない行があれば件数検査で止める形にしていた。
 * dev は同じ狙いを、表を作り直さずに 2 本へ分けて済ませていた
 * （`0031_publish_fixed_pages` が名札を、`0033_tenant_scope_blog_children` が作業場所を）。
 * 番号が重なったので dev を正本にし、こちらの 1 本は消えた。
 *
 * **検査ごと消さない。** 消すと、この先 legal_page を触る誰かが
 * 「既存行を捨てない」を守っているかどうかを見る場所が無くなる。
 * 相手のファイル名を差し替え、dev の作り方に合わせて言い直す。
 */
describe("固定文書を tenant 化する migration は、既存行を捨てない", () => {
  const kindRename = readFileSync(join(ROOT, "drizzle/0031_publish_fixed_pages.sql"), "utf8");
  const tenantScope = readFileSync(
    join(ROOT, "drizzle/0033_tenant_scope_blog_children.sql"),
    "utf8",
  );

  it("名札の言い直しに、表の作り直しを使わない", () => {
    // 作り直すと、途中で落ちた実行が「旧表は消えた・新表は空」を残せる。
    // UPDATE だけなら、何度流しても行は 1 つも減らない。
    expect(kindRename).toMatch(/UPDATE `legal_page` SET `kind` =/);
    expect(kindRename).not.toContain("DROP TABLE `legal_page`");
    expect(kindRename).not.toContain("_new_legal_page");
  });

  it("旧い名札は 1 対 1 のものだけを明示変換し、推測で寄せない", () => {
    for (const [from, to] of [
      ["operator", "profile"],
      ["all_categories", "sitemap"],
      ["tokushoho", "commercial_transaction"],
    ]) {
      expect(kindRename).toContain(`SET \`kind\` = '${to}' WHERE \`kind\` = '${from}'`);
    }
    // 綴りが同じものは触らない。触る理由が無いのに UPDATE を足すと、
    // 「何を変えたのか」が diff から読み取れなくなる。
    expect(kindRename).not.toMatch(/WHERE `kind` = 'privacy_policy'/);
    expect(kindRename).not.toMatch(/WHERE `kind` = 'contact'/);
  });

  it("作業場所の列を足したあと、必ず親から埋める", () => {
    const addColumn = tenantScope.indexOf("ALTER TABLE `legal_page` ADD `workspace_id`");
    const backfill = tenantScope.indexOf("UPDATE `legal_page`\nSET `workspace_id` = coalesce(");

    expect(addColumn).toBeGreaterThanOrEqual(0);
    // 列だけ足して既定値 '' のまま放置すると、**どの作業場所にも属さない行**が残る。
    // 列の有無しか見ない検査は緑のままなので、埋める側をここで見る。
    expect(backfill).toBeGreaterThan(addColumn);
    expect(tenantScope).toContain("from `site_blueprints` b where b.`slug` = `legal_page`.`site_slug`");
  });

  it("埋め戻しは何度流しても同じ結果になる", () => {
    // `WHERE workspace_id = ''` が無いと、あとから手で直した行を
    // 再実行のたびに親の値へ引き戻す。移行は 1 度で終わるとは限らない。
    const backfill = tenantScope.slice(tenantScope.indexOf("UPDATE `legal_page`"));
    expect(backfill).toContain("WHERE `workspace_id` = ''");
  });

  it("独立URLの墓標を、サイト表の列で代用しない", () => {
    // 取り下げた URL の記録をサイト表の列にすると、サイトを消した日に一緒に消える。
    // 消えた瞬間、その URL は「まだ誰も使っていない」に戻る。
    const schema = readFileSync(join(ROOT, "drizzle/0034_huge_echo.sql"), "utf8");
    expect(schema).toContain("CREATE TABLE `site_retirements`");
    expect(schema).not.toContain("ALTER TABLE `site_blueprints` ADD `retired_at`");
  });
});
