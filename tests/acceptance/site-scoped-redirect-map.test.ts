/** @tier 2 @req REQ-S09 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ROUTE_METADATA } from "@/presentation/ui";

/**
 * サイト所属型オーサリング IA (feat-site-scoped-authoring-ia) の受入 A2 / A3 / A8 / A9 / A10。
 *
 * --- なぜ契約 JSON と実ファイルを突き合わせるのか ---
 *
 * 転送の対応表は `redirect-map-draft.json` が正本である。
 * 表だけを検査すると「表には書いたが殻を作っていない」状態が緑になる。
 * 実ファイルだけを検査すると「殻はあるが表に無い」状態が緑になる。
 * **両方を突き合わせて初めて、片肺の状態が落ちる。**
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/redirect-contract.md
 *       docs/spec/feat-site-scoped-authoring-ia/shortcut-contract.md
 *       docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md
 */

/**
 * 本 feature 着手時点 (2026-09-08) の `drizzle/*.sql` の本数。
 *
 * 実行時に数え直すと自分自身と比べることになり、何本増えても緑になる。
 * A10 が見ているのは「増えていないこと」なので、比べる相手は固定値でなければならない。
 */
const MIGRATION_COUNT_BASELINE = 51;

const SPEC_DIR = join(process.cwd(), "docs/spec/feat-site-scoped-authoring-ia");
const APP_ADMIN = join(process.cwd(), "src/app/admin");

type RedirectRow = { readonly from: string; readonly to: string; readonly kind: string };
type NotRedirectedRow = { readonly route: string; readonly reason: string };
type RedirectMap = {
  readonly redirects: readonly RedirectRow[];
  readonly not_redirected: readonly NotRedirectedRow[];
};

type InventoryRoute = {
  readonly route_id: string;
  readonly pattern: string;
  readonly relocates_to: string | null;
  readonly redirect_only: boolean;
};
type Inventory = {
  readonly routes: readonly InventoryRoute[];
  readonly relocations: Readonly<Record<string, string>>;
};

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(SPEC_DIR, name), "utf-8")) as T;
}

const redirectMap = readJson<RedirectMap>("redirect-map-draft.json");
const inventory = readJson<Inventory>("route-inventory.json");

/** `/admin/foo/bar?x=1` -> `foo/bar` (route id と同じ形へ揃える) */
function toRouteId(adminUrl: string): string {
  return adminUrl.split("?")[0].replace(/^\/admin\/?/, "");
}

function pageFileFor(routeId: string): string {
  return join(APP_ADMIN, routeId, "page.tsx");
}

describe("A2: 旧 URL が転送の殻になっている", () => {
  it("転送表の旧 URL すべてに page.tsx がある", () => {
    /*
      殻が無いと 404 になる。ブックマークから来た人は
      「消えた」と読む。転送する約束をした以上、入口は残す。
    */
    const missing = redirectMap.redirects
      .map((row) => toRouteId(row.from))
      .filter((id) => !existsSync(pageFileFor(id)));
    expect(missing, "旧 URL の page.tsx がありません").toEqual([]);
  });

  it("旧 URL の page.tsx が転送だけを行う殻になっている", () => {
    /*
      `legacyAdminRedirect` を呼んでいるかで見る。
      各 page.tsx が自前で行き先を組み立てていると、
      5 本のうち 1 本だけ規則がずれた状態が作れる。
    */
    const read = redirectMap.redirects
      .map((row) => pageFileFor(toRouteId(row.from)))
      .filter((file) => existsSync(file));
    const notShell = read.filter((file) => !readFileSync(file, "utf-8").includes("legacyAdminRedirect"));
    /*
      **0 件の主張には、その 0 を数えた母集団の床を同居させる。**
      転送表が空になっても、旧 URL の page.tsx が全部消えても、
      床が無ければこの検査は `[]` を返して緑のまま黙る。
    */
    expect(read.length, "旧 URL の page.tsx を 1 枚も読んでいません").toBeGreaterThanOrEqual(5);
    expect(notShell, "転送の殻になっていない旧 URL があります").toEqual([]);
  });

  it("旧 URL の殻が 308 (permanentRedirect) を使っていない", () => {
    /*
      この 5 本の行き先は cookie とブログ一覧から**その都度**決まる。
      308 は恒久移動の宣言なので、ブラウザが行き先を覚えてしまう。すると
      site-a を開いた人の `/admin/personas` は、site-b へ切り替えた後も
      site-a へ飛び続け、**site-a を消した後も飛ぶ**。
      `resolveSiteSlug` が毎回 `siteSlugs` を確かめる仕掛けは、
      要求がサーバーまで届かないので効かない。

      隣に 308 の前例がある (`admin/blog/pages/page.tsx`)。あちらは行き先が
      `?site=` だけで決まり cookie を見ないので壊れない。
      **前例を読んで真似ると壊れる**形なので、機械に見張らせる。

      規範: docs/spec/feat-site-scoped-authoring-ia/redirect-contract.md §5.1
    */
    const read = redirectMap.redirects
      .map((row) => pageFileFor(toRouteId(row.from)))
      .filter((file) => existsSync(file));
    const permanent = read.filter((file) =>
      readFileSync(file, "utf-8").includes("permanentRedirect"),
    );
    expect(read.length, "旧 URL の page.tsx を 1 枚も読んでいません").toBeGreaterThanOrEqual(5);
    expect(permanent, "cookie で行き先が変わる転送に 308 を使っています").toEqual([]);
  });

  it("転送先の画面が実在する", () => {
    const missing = redirectMap.redirects
      .map((row) => toRouteId(row.to))
      .filter((id) => !existsSync(pageFileFor(id)));
    expect(missing, "転送先の page.tsx がありません").toEqual([]);
  });
});

describe("A2/A3: 転送表そのものの健全性", () => {
  /*
    件数を見出しへ書き写さない。書き写すと、表が増減した日に
    「検査は緑だが見出しは嘘」という、直しようのない食い違いが残る。
    覆いと重複だけを見る。
  */
  it("転送する側と転送しない側で、対象ルートを重複なく覆う", () => {
    const redirected = redirectMap.redirects.map((row) => row.from);
    const kept = redirectMap.not_redirected.map((row) => row.route);
    const overlap = redirected.filter((from) => kept.includes(from));
    expect(overlap, "同じルートが転送する側と転送しない側の両方にあります").toEqual([]);
    expect(new Set(redirected).size).toBe(redirected.length);
  });

  it("転送しないものには必ず理由が付いている", () => {
    /*
      理由の無い非転送は「漏れ」と区別がつかない。
      後から誰かが再調査する羽目になる。
    */
    const noReason = redirectMap.not_redirected
      .filter((row) => row.reason.trim().length === 0)
      .map((row) => row.route);
    expect(noReason, "理由の無い非転送があります").toEqual([]);
  });

  it("転送先が site 配下か、ブログ選択のどちらかである", () => {
    const stray = redirectMap.redirects
      .filter((row) => !row.to.startsWith("/admin/sites/[site]/") && row.to !== "/admin/sites")
      .map((row) => row.to);
    expect(stray, "site 配下でもブログ選択でもない転送先があります").toEqual([]);
  });
});

describe("A1/A8: 対応表 2 か所が食い違っていない", () => {
  it("route 台帳の転送専用フラグが実行時 metadata と一致する", () => {
    const runtime = new Map<string, boolean>(
      ADMIN_ROUTE_METADATA.map((route) => [route.id, route.redirectOnly === true]),
    );
    const mismatch = inventory.routes
      .filter((route) => runtime.get(route.route_id) !== route.redirect_only)
      .map((route) => route.route_id);

    expect(mismatch, "route 台帳の redirect_only が実装と食い違っています").toEqual([]);
  });

  it("`relocations` と `routes[].relocates_to` が一致する", () => {
    /*
      同じ事実が 2 か所にある。片方だけ直された日に、
      どちらが本物か機械にも人にも分からなくなる。
      それは本 feature が無くそうとしている形そのものである。
    */
    const byId = new Map(inventory.routes.map((r) => [r.route_id, r.relocates_to]));
    const mismatch = Object.entries(inventory.relocations)
      .filter(([id, to]) => byId.get(id) !== to)
      .map(([id]) => id);
    expect(mismatch, "対応表 2 か所が食い違っています").toEqual([]);
  });

  it("移転先の route id が route 表に載っている", () => {
    /*
      `AdminRouteId` は文字列リテラルの合併型なので、`Set<AdminRouteId>` のままだと
      「表に無い id」を渡した時点で型が拒否し、テストが書けない。
      ここで見たいのは実行時に載っているかどうかなので `Set<string>` へ緩める。
    */
    const known = new Set<string>(ADMIN_ROUTE_METADATA.map((route) => route.id));
    const missing = Object.values(inventory.relocations).filter((id) => !known.has(id));
    expect(missing, "移転先が route 表にありません").toEqual([]);
  });
});

describe("A8: 到達クリック数が畳む前以下", () => {
  it("移転した画面の旧入口がサイドバーに残っている", () => {
    /*
      サイドバーに出るのは `nav` を持つ route だけ (`ADMIN_NAV` の射影条件)。
      旧入口を消すと、これまで 1 クリックで開けていた画面が
      「ブログを選ぶ → 目的の画面」の 2 クリックになる。
    */
    const shortcutEntries = ["personas", "writing", "content"];
    const dropped = shortcutEntries.filter(
      (id) => ADMIN_ROUTE_METADATA.find((route) => route.id === id)?.nav == null,
    );
    expect(dropped, "旧入口がサイドバーから消えました").toEqual([]);
  });
});

describe("A4: 知らないブログの住所が、他のブログを漏らさない", () => {
  const NEW_SITE_SCOPED = [
    "sites/[site]/authors",
    "sites/[site]/authors/new",
    "sites/[site]/audience/personas",
    "sites/[site]/audience/personas/new",
    "sites/[site]/writing",
  ];

  it("新設画面が、中身を読む前にブログを確かめている", () => {
    /*
      書き手も読者像もワークスペース単位で持っている。だから
      「ブログを確かめる」を先にやらないと、存在しないブログの住所でも
      一覧が出て、そのブログのものとして読まれる。順番が契約である。
    */
    const read = NEW_SITE_SCOPED.map(pageFileFor).filter((file) => existsSync(file));
    const notResolving = read.filter(
      (file) => !readFileSync(file, "utf-8").includes("resolveSiteOrNotFound"),
    );
    // 実際に読めた枚数へ床を張る。一覧だけに床を張ると、画面が全部消えても緑になる。
    expect(read.length, "新設画面を 1 枚も読んでいません").toBeGreaterThanOrEqual(
      NEW_SITE_SCOPED.length,
    );
    expect(notResolving, "ブログを確かめずに中身を読む画面があります").toEqual([]);
  });

  it("受け先の not-found が、サイドバーを描かない", () => {
    /*
      `AppShell` を描くと、サイドバーにこのワークスペースの全ブログ名が並ぶ。
      「そのブログは無い」と答えながら、他のブログの存在を教えることになる。
    */
    const file = join(APP_ADMIN, "sites/[site]/not-found.tsx");
    expect(existsSync(file), "site 配下の not-found がありません").toBe(true);
    /*
      **文中の言及ではなく、実際に描いているかを見る。**
      素朴に `/AppShell/` を探すと、「AppShell を描かない」と書いた
      注釈そのものに当たって落ちる。理由を書いた画面ほど赤くなるのは逆である。
      見るのは import と JSX の 2 か所だけにする。
    */
    const source = readFileSync(file, "utf-8");
    const imported = source.match(/^import .*$/gm)?.join("\n") ?? "";
    expect(imported, "not-found が AppShell を取り込んでいます").not.toMatch(
      /\b(AdminShell|AppShell)\b/,
    );
    expect(source, "not-found が AppShell を描いています").not.toMatch(/<(AdminShell|AppShell)\b/);
  });
});

describe("A9: 新設画面に危険な操作が無い", () => {
  it("新設した site 配下の画面が、削除・公開・ドメイン操作を呼ばない", () => {
    /*
      A9 は「新設画面が確認の分岐規則から外れていないか」を見る。
      外れていないと言うには、まず新設画面が実在する必要がある。
      実在しないまま緑になると、検査したことにならない。
    */
    const newRoutes = [
      "sites/[site]/authors",
      "sites/[site]/authors/new",
      "sites/[site]/audience/personas",
      "sites/[site]/audience/personas/new",
      "sites/[site]/writing",
    ];
    const missing = newRoutes.filter((id) => !existsSync(pageFileFor(id)));
    expect(missing, "新設画面がまだありません").toEqual([]);

    const dangerous = /deleteSite|publishSite|updateDomain|deleteArticle/;
    const sources = newRoutes.map((id) => readFileSync(pageFileFor(id), "utf-8"));
    // 走査した本文の枚数へ床を張る。0 枚を走査しても offenders は `[]` になる。
    expect(sources.length, "新設画面の本文を 1 枚も読んでいません").toBeGreaterThanOrEqual(5);
    const offenders = newRoutes.filter((id, index) => dangerous.test(sources[index] ?? ""));
    expect(offenders, "新設画面が危険な操作を呼んでいます").toEqual([]);
  });
});

describe("A10: 新しい集計表を追加していない", () => {
  it("`drizzle/` に migration が増えていない", () => {
    /*
      本 feature は住所を変えるだけで、データの持ち主を変えない。
      migration が 1 本でも増えたら、その前提が崩れている。
    */
    const dir = join(process.cwd(), "drizzle");
    const migrations = existsSync(dir)
      ? readdirSync(dir).filter((name) => name.endsWith(".sql"))
      : [];
    expect(migrations.length).toBe(MIGRATION_COUNT_BASELINE);
  });
});
