/**
 * @tier 2
 * @req REQ-UX01
 * @types code-boundary
 *
 * A1: 51 管理画面の primary task と、画面から実行できる全 Server Action を
 * production manifest で結ぶ。component の数や配置を task の数として扱わない。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ADMIN_SCREEN_RUNTIME_ENTRIES,
  ADMIN_SCREEN_TASK_MANIFEST,
  semanticAdminTaskSet,
} from "@/presentation/admin/admin-screen-task-manifest";
import { ADMIN_ROUTE_METADATA } from "@/presentation/ui/admin-route-metadata";

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "src/app/admin");
const PRIORITY_MAP = join(ROOT, "docs/spec/feat-uiux-overhaul/information-priority-map.json");

type SourceEdge = { readonly module: string; readonly exportName: string };
type ImportedBinding = SourceEdge & { readonly localName: string };
type ExecutionSite = { readonly uiModule: string; readonly action: SourceEdge };
type ScreenExecutionSite = ExecutionSite & {
  readonly routeId: string;
  readonly uiExportName: string;
};

function sourceFiles(dir: string, extension: ".tsx" | ".ts", out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, extension, out);
    else if (name.endsWith(extension)) out.push(full);
  }
  return out;
}

function sourceModule(file: string): string {
  return relative(ROOT, file).split(sep).join("/");
}

function pageRoute(file: string): string {
  const rel = relative(join(ROOT, "src/app"), file).split(sep).slice(0, -1).join("/");
  return `/${rel}`;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function resolveModule(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const stem = specifier.startsWith("@/")
    ? join(ROOT, "src", specifier.slice(2))
    : resolve(dirname(fromFile), specifier);
  for (const candidate of [`${stem}.ts`, `${stem}.tsx`, join(stem, "index.ts"), join(stem, "index.tsx")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function importsOf(file: string): readonly ImportedBinding[] {
  const imports: ImportedBinding[] = [];
  for (const statement of parse(file).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleFile = resolveModule(file, statement.moduleSpecifier.text);
    if (moduleFile === null) continue;
    const clause = statement.importClause;
    if (clause?.name !== undefined) {
      imports.push({ module: sourceModule(moduleFile), exportName: "default", localName: clause.name.text });
    }
    if (clause?.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements) {
      imports.push({
        module: sourceModule(moduleFile),
        exportName: element.propertyName?.text ?? element.name.text,
        localName: element.name.text,
      });
    }
  }
  return imports;
}

function runtimeNamesInNode(node: ts.Node): ReadonlySet<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useActionState" &&
      node.arguments[0] !== undefined &&
      ts.isIdentifier(node.arguments[0])
    ) names.add(node.arguments[0].text);
    if (
      ts.isJsxAttribute(node) &&
      ["action", "formAction", "onSubmit"].includes(node.name.getText()) &&
      node.initializer !== undefined &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression !== undefined &&
      ts.isIdentifier(node.initializer.expression)
    ) names.add(node.initializer.expression.text);
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText().replaceAll(/["']/g, "") === "onSubmit" &&
      ts.isIdentifier(node.initializer)
    ) names.add(node.initializer.text);
    ts.forEachChild(node, visit);
  };
  visit(node);
  return names;
}

function runtimeActionEdgesForNames(
  file: string,
  used: ReadonlySet<string>,
): readonly SourceEdge[] {
  const found = new Map<string, SourceEdge>();
  for (const imported of importsOf(file)) {
    if (!imported.module.endsWith("-action.ts") || !used.has(imported.localName)) continue;
    const edge = { module: imported.module, exportName: imported.exportName };
    found.set(`${edge.module}#${edge.exportName}`, edge);
  }
  return [...found.values()];
}

function runtimeActionEdgesOf(file: string): readonly SourceEdge[] {
  return runtimeActionEdgesForNames(file, runtimeNamesInNode(parse(file)));
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

/** ファイル内で宣言された関数を名前で引く。export の有無は問わない。 */
function declaredFunctionsOf(source: ts.SourceFile): ReadonlyMap<string, ts.FunctionDeclaration> {
  const found = new Map<string, ts.FunctionDeclaration>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      found.set(statement.name.text, statement);
    }
  }
  return found;
}

/**
 * `entry` が描いている名前を、同じファイルの中だけ推移的に追う。
 *
 * **公開入口が action を自分で持っているとは限らない。**実物 2 件がそうだった
 * （2026-08-31 実測）——`SiteWizardStepForm` は段階に応じて `StepFieldsForm`
 * (非 export) と `CreateSiteForm` へ、`PageThemeOverrideForms` は
 * `PageThemeOverrideForm` (非 export) へ、それぞれ描画を委ねている。
 * `useActionState` を呼ぶのは委ね先で、公開入口の関数本体には action が現れない。
 *
 * 委ね先だけを見て「申告が実在しない」と報せると、**正しい申告のほうを消す圧力**に
 * なる。route から見える入口は公開されている名前 1 つなので、そこへ帰属させるのが
 * 実態に合う。追うのは同一ファイル内に限る——別ファイルへ渡った時点で、それは
 * `renderedImportsOf` が別の候補モジュールとして拾う担当だからである。
 */
function reachableInFile(source: ts.SourceFile, entry: ts.FunctionDeclaration): readonly ts.FunctionDeclaration[] {
  const declared = declaredFunctionsOf(source);
  const seen = new Set<ts.FunctionDeclaration>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const target = declared.get(node.tagName.getText());
        if (target !== undefined && !seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(current);
  }
  return [...seen];
}

function exportedRuntimeEdgesOf(file: string): readonly {
  readonly uiExportName: string;
  readonly action: SourceEdge;
}[] {
  const found: { readonly uiExportName: string; readonly action: SourceEdge }[] = [];
  const exportedFunctions: ts.FunctionDeclaration[] = [];
  const source = parse(file);
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || statement.name === undefined || !hasExportModifier(statement)) {
      continue;
    }
    exportedFunctions.push(statement);
    const names = new Set<string>();
    for (const reached of reachableInFile(source, statement)) {
      for (const name of runtimeNamesInNode(reached)) names.add(name);
    }
    for (const action of runtimeActionEdgesForNames(file, names)) {
      found.push({ uiExportName: statement.name.text, action });
    }
  }

  // page moduleや単一export componentでは、local helperに分けたformも同じ公開入口の責務。
  // 複数export componentでは各function内だけを採用し、別formのactionを混ぜない。
  if (exportedFunctions.length === 1) {
    const owner = exportedFunctions[0]?.name?.text;
    const alreadyOwned = new Set(found.map((entry) => edgeKey(entry.action)));
    if (owner !== undefined) {
      for (const action of runtimeActionEdgesOf(file)) {
        if (!alreadyOwned.has(edgeKey(action))) found.push({ uiExportName: owner, action });
      }
    }
  }
  return found;
}

function renderedImportsOf(file: string): readonly ImportedBinding[] {
  const rendered = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      rendered.add(node.tagName.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return importsOf(file).filter((candidate) => rendered.has(candidate.localName));
}

function edgeKey(edge: SourceEdge): string {
  return `${edge.module}#${edge.exportName}`;
}

function siteKey(site: ExecutionSite): string {
  return `${site.uiModule}#${site.action.module}#${site.action.exportName}`;
}

function screenSiteKey(site: ScreenExecutionSite): string {
  return `${site.routeId}#${site.uiModule}#${site.uiExportName}#${site.action.module}#${site.action.exportName}`;
}

function discoveredActionSites(): readonly ExecutionSite[] {
  const found = new Map<string, ExecutionSite>();
  for (const file of [
    ...sourceFiles(ADMIN_DIR, ".tsx"),
    ...sourceFiles(join(ROOT, "src/presentation/admin"), ".tsx"),
  ]) for (const action of runtimeActionEdgesOf(file)) {
    const site = { uiModule: sourceModule(file), action };
    found.set(siteKey(site), site);
  }
  return [...found.values()].sort((a, b) => siteKey(a).localeCompare(siteKey(b)));
}

function importsAndRenders(file: string, edge: SourceEdge): boolean {
  const imported = importsOf(file).find(
    (candidate) => candidate.module === edge.module && candidate.exportName === edge.exportName,
  );
  if (imported === undefined) return false;
  let rendered = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === imported.localName
    ) rendered = true;
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return rendered;
}

function exportsName(file: string, exportName: string): boolean {
  const text = readFileSync(file, "utf8");
  if (exportName === "default") return /export\s+default\s+/.test(text);
  return new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${exportName}\\b`).test(text);
}

const pageFiles = sourceFiles(ADMIN_DIR, ".tsx").filter((file) => file.endsWith(`${sep}page.tsx`));
const actualRoutes = new Set(pageFiles.map(pageRoute));
const DISCOVERED_ACTION_SITES = discoveredActionSites();

function discoveredScreenExecutionSites(): readonly ScreenExecutionSite[] {
  const found = new Map<string, ScreenExecutionSite>();
  for (const page of pageFiles) {
    const route = ADMIN_ROUTE_METADATA.find((candidate) => candidate.pattern === pageRoute(page));
    if (route === undefined) continue;
    const candidateModules = [
      { file: page, expectedExportName: null as string | null },
      ...renderedImportsOf(page)
        .filter((component) => component.module !== "src/presentation/admin/admin-shell.tsx")
        .map((component) => ({
          file: join(ROOT, component.module),
          expectedExportName: component.exportName,
        })),
    ];
    for (const candidate of candidateModules) {
      for (const execution of exportedRuntimeEdgesOf(candidate.file)) {
        if (
          candidate.expectedExportName !== null &&
          candidate.expectedExportName !== execution.uiExportName
        ) continue;
        const site = {
          routeId: route.id,
          uiModule: sourceModule(candidate.file),
          uiExportName: execution.uiExportName,
          action: execution.action,
        };
        found.set(screenSiteKey(site), site);
      }
    }
  }
  return [...found.values()].sort((a, b) => screenSiteKey(a).localeCompare(screenSiteKey(b)));
}

const DISCOVERED_SCREEN_EXECUTION_SITES = discoveredScreenExecutionSites();

describe("A1 §1 全管理画面は primary task をちょうど 1 つ持つ", () => {
  /*
    2026-08-24: 50 → 51。**両側が別々に 1 枚ずつ画面を足していた。**
    どちらの枝も単独では「50」と書いたため、git は食い違いと見なさず素通りさせた。
    合流後の実物は 51 枚（`find src/app/admin -name page.tsx | wc -l`）。
    数え上げの仕掛け線であって品質の閾値ではない。

    2026-08-26: 55 → 58。順位づけの基準に**一覧・作る・点を入れる**の 3 枚を足した
    （`rankings/models`・`rankings/models/new`・`rankings/scores`）。
    それまで基準は見本の 1 件しか無く、順位の画面がそれを決め打ちで見ていたので、
    商品をいくつ登録しても順位に 1 件も現れなかった。

    2026-08-26: 58 → 61。根拠に**登録する 3 枚**を足した
    （`evidence/new`・`evidence/claims/new`・`evidence/test-runs/new`）。
    根拠の画面はそれまで見本の主張と根拠しか見ておらず、調べても中身が増えなかった。

    2026-08-26: 61 → 64。設定に**直す 3 枚**を足した
    （`settings/workspaces/edit`・`settings/brands/new`・`settings/brands/[brand]`）。
    ブランドはどこからも読めたが、どこからも書けなかった。
    そのため「問い合わせ先が未設定なので公開できません」という表示が出ても、
    埋めに行く先が 1 つも無かった。

    2026-08-26: 64 → 66。提携に**登録する 2 枚**を足した
    （`affiliate/accounts/new`・`affiliate/programs/new`）。
    提携先も提携条件も見本だけで、増やす口がどこにも無かった。
    自分の ASP アカウントを 1 件も登録できないので、
    成果の画面に出る金額は最後まで他人の見本の数字だった。

    2026-08-26: 67 → 68。ブログの固定ページを書く 1 枚を足した
    （`sites/[site]/documents`）。運営者情報・各方針・規約・特定商取引法に基づく表記は
    `legal_page` 表に置き場がありながら**書く口が 1 つも無く**、読者に出ていたのは
    見本の文だった。**読者に出る文を、書いた覚えの無いまま出さない。**

    2026-08-26: 68 → 69。登録済みの成果リンクを**止める 1 枚**を足した
    （`affiliate/links`）。商品名も URL も上書きしない決まりなので、表記が古く
    なったときの直し方は「止めて登録し直す」しかない。その 1 手目が無く、
    **ASP 側で名前が変わっても読者のカードには古い名前が出続けていた。**

    2026-08-26: 66 → 67。読者からの問い合わせを**読む 1 枚**を足した（`contact`）。
    それまで問い合わせは受け取れず、読者には別の連絡先を案内していた。
    保存できるようにするなら読む画面も同時に要る。
    **読む口が無いまま保存だけ足すと「受け付けました」が嘘になる。**
  */
  /*
    2026-08-30: 84 → 86。統合で `content/published` と、その
    `[site]/[slug]/edit` の 2 枚が合流した。読者に出ている文を**探す画面**と
    **直す画面**を割ってある。訂正は取り返しがつかないので、探している最中に
    書き換えの口が出ていない形を保つ。
  */
  it("実在route・route metadata・task manifest・priority mapが86件で1対1になる", () => {
    const priority = JSON.parse(readFileSync(PRIORITY_MAP, "utf8")) as {
      readonly screens: readonly { readonly route: string; readonly primary_task: string }[];
    };
    const actual = [...actualRoutes].sort();
    const metadata = ADMIN_ROUTE_METADATA.map((route) => route.pattern).sort();
    const tasks = ADMIN_SCREEN_TASK_MANIFEST.map((screen) => screen.route).sort();
    const documented = priority.screens.map((screen) => screen.route).sort();

    // 画面数の正本は ADMIN_ROUTE_METADATA。数字を各所へ写すと片方だけ古くなるため参照する。
    // ただし参照だけにすると route が丸ごと消えても緑になるので、空振り防止の下限を併記する。
    expect(actual).toHaveLength(ADMIN_ROUTE_METADATA.length);
    expect(actual.length).toBeGreaterThan(80);
    expect(metadata).toEqual(actual);
    expect(tasks).toEqual(actual);
    expect(documented).toEqual(actual);
    expect(new Set(ADMIN_SCREEN_TASK_MANIFEST.map((screen) => screen.routeId)).size).toBe(
      ADMIN_ROUTE_METADATA.length,
    );
    expect(new Set(priority.screens.map((screen) => screen.route)).size).toBe(ADMIN_ROUTE_METADATA.length);
    expect(ADMIN_SCREEN_TASK_MANIFEST.map((screen) => [screen.route, screen.primaryTask]).sort()).toEqual(
      priority.screens.map((screen) => [screen.route, screen.primary_task]).sort(),
    );
  });
});

describe("A1 §2 全business mutationを単一のprimary taskへ所属させる", () => {
  it("TSXから実行されるactionは全件manifestにあり、manifest外が0件", () => {
    const discovered = DISCOVERED_ACTION_SITES;
    const declared = [
      ...new Map(ADMIN_SCREEN_RUNTIME_ENTRIES.map((entry) => {
        const site = { uiModule: entry.uiEntry.module, action: entry.action };
        return [siteKey(site), site] as const;
      })).values(),
    ].sort((a, b) => siteKey(a).localeCompare(siteKey(b)));

    /*
      2026-08-27: 52 → 53。配信の画面に Bluesky の接続を登録する口を足した
      （`bluesky-connection-form.tsx` → `registerBlueskyConnectionAction`）。
      認証情報を保存する操作は業務状態の変更なので、申告しないまま動かさない。
    */
    /*
      2026-08-31: 63 → 65。**画面が増えたのではなく、機械の目が届くようになった。**
      公開入口が同じファイルの非 export component へ描画を委ねている 2 件
      （`SiteWizardStepForm` → `StepFieldsForm`、`PageThemeOverrideForms` →
      `PageThemeOverrideForm`）を `reachableInFile` が辿るようになった。
      申告は前から正しく、discovery が届いていなかった側である。
    */
    expect(discovered).toHaveLength(65);
    expect(declared, "未申告または実在しないexecution siteがあります").toEqual(discovered);
    expect(new Set(
      ADMIN_SCREEN_RUNTIME_ENTRIES
        .filter((entry) => entry.classification === "business-mutation")
        .map((entry) => edgeKey(entry.action)),
    ).size).toBe(62);
  });

  it("同じactionの複数route・複数form用途を畳まず、意味entry 81件を床固定する", () => {
    const discovered = DISCOVERED_SCREEN_EXECUTION_SITES;
    const declared = ADMIN_SCREEN_RUNTIME_ENTRIES
      .filter((entry) => entry.scope === "screen")
      .map((entry) => ({
        routeId: entry.routeId,
        uiModule: entry.uiEntry.module,
        uiExportName: entry.uiEntry.exportName,
        action: entry.action,
      }))
      .sort((a, b) => screenSiteKey(a).localeCompare(screenSiteKey(b)));

    expect(declared, "route/form単位の意味entryに欠落または余剰があります").toEqual(discovered);
    // 2026-08-28: 指針本文の変更後に仕様再評価を完了する口を追加。
    // 原典取得とは別の業務操作なので、同じactionでも畳まない。
    // 2026-08-30: 79 → 81。公開済み記事の訂正と取り下げが合流した。
    // 同じ form が 2 つの action を持つが、後戻りの仕方が違うので畳まない。
    // 2026-08-31: 81 → 83。上の 63 → 65 と同じ 2 件。画面ではなく discovery が増えた。
    expect(discovered).toHaveLength(83);
    // 2026-08-31: 82 → 84。manifest は dev の合流で先に 84 件になっていたが、
    // ここの床だけが古い数のまま残っていた（申告漏れではなく数え漏れ）。
    expect(ADMIN_SCREEN_RUNTIME_ENTRIES).toHaveLength(84);
    expect(new Set(ADMIN_SCREEN_RUNTIME_ENTRIES.map((entry) => entry.id)).size).toBe(84);
  });

  it("screen意味entryはどの1件を削ってもdiscoveryとの差分になる", () => {
    const discovered = DISCOVERED_SCREEN_EXECUTION_SITES.map(screenSiteKey);
    const declared = ADMIN_SCREEN_RUNTIME_ENTRIES
      .filter((entry) => entry.scope === "screen")
      .map((entry) => screenSiteKey({
        routeId: entry.routeId,
        uiModule: entry.uiEntry.module,
        uiExportName: entry.uiEntry.exportName,
        action: entry.action,
      }))
      .sort();

    expect(new Set(declared).size).toBe(83);
    for (let index = 0; index < declared.length; index += 1) {
      expect(declared.filter((_, candidate) => candidate !== index)).not.toEqual(discovered);
    }
  });

  it("screen mutationが所属するprimary taskはrouteごとに1種類以下", () => {
    const taskByRoute = new Map(ADMIN_SCREEN_TASK_MANIFEST.map((screen) => [screen.routeId, screen]));
    const byRoute = new Map<string, Set<string>>();
    for (const entry of ADMIN_SCREEN_RUNTIME_ENTRIES) {
      if (entry.classification !== "business-mutation" || entry.scope !== "screen") continue;
      const task = taskByRoute.get(entry.routeId);
      expect(task, `${entry.id} のprimary taskがありません`).toBeDefined();
      expect(entry.ownerTaskId, `${entry.id} がowner taskを明示していません`).toBe(task?.taskId);
      const tasks = byRoute.get(entry.routeId) ?? new Set<string>();
      tasks.add(entry.ownerTaskId ?? "");
      byRoute.set(entry.routeId, tasks);
    }
    expect([...byRoute].filter(([, tasks]) => tasks.size > 1)).toEqual([]);
  });

  it("共通Shell・read-only・UI demoも発見後に理由付きで分類する", () => {
    const global = ADMIN_SCREEN_RUNTIME_ENTRIES.filter((entry) => entry.scope === "global-shell");
    const excluded = ADMIN_SCREEN_RUNTIME_ENTRIES.filter((entry) => entry.classification !== "business-mutation");
    expect(global.map((entry) => entry.action.exportName)).toEqual(["submitFeedbackAction"]);
    expect(global.every((entry) => !entry.primaryTaskAffecting && entry.reason.length > 0)).toBe(true);
    expect(excluded.map((entry) => entry.classification).sort()).toEqual(["read-only", "ui-demo"]);
    expect(excluded.every((entry) => !entry.primaryTaskAffecting && entry.reason.length > 0)).toBe(true);
  });
});

describe("A1 §3 route → component → action edgeが実在する", () => {
  it.each(ADMIN_SCREEN_RUNTIME_ENTRIES)("$id のruntime edge", (entry) => {
    const uiFile = join(ROOT, entry.uiEntry.module);
    const actionFile = join(ROOT, entry.action.module);
    expect(existsSync(uiFile), entry.uiEntry.module).toBe(true);
    expect(existsSync(actionFile), entry.action.module).toBe(true);
    expect(exportsName(uiFile, entry.uiEntry.exportName)).toBe(true);
    expect(exportsName(actionFile, entry.action.exportName)).toBe(true);
    expect(
      runtimeActionEdgesOf(uiFile).some((edge) => edgeKey(edge) === edgeKey(entry.action)),
      `${entry.uiEntry.module} → ${entry.action.exportName} が結線されていません`,
    ).toBe(true);

    if (entry.scope === "global-shell") {
      expect(entry.uiEntry.module).toBe("src/presentation/admin/admin-shell.tsx");
      // 転送だけの route は Shell を通らない。`permanentRedirect` を呼んで終わりで、
      // 描くものが無いからである。除外の根拠は正本 `redirectOnly` に置く——ここで
      // route 名を書き並べると、転送をやめた日に緑のまま通ってしまう。
      // 「本当に転送しているか」は tests/ui/route-cases.ts が転送先込みで実測する。
      const shellRoutes = ADMIN_ROUTE_METADATA.filter((route) => !route.redirectOnly);
      // 除外を増やして緑にする逃げ道を塞ぐ床。2026-08-31 実測 1 件 (blog/pages)。
      expect(ADMIN_ROUTE_METADATA.length - shellRoutes.length).toBe(1);
      for (const route of shellRoutes) {
        const page = join(ROOT, "src/app", route.file);
        expect(importsAndRenders(page, {
          module: "src/presentation/admin/admin-shell.tsx",
          exportName: "AdminShell",
        }), `${route.pattern} が共通Shellを通っていません`).toBe(true);
      }
      return;
    }

    const route = ADMIN_ROUTE_METADATA.find((candidate) => candidate.id === entry.routeId);
    expect(route, entry.routeId).toBeDefined();
    const page = join(ROOT, "src/app", route?.file ?? "");
    if (sourceModule(page) !== entry.uiEntry.module) {
      expect(importsAndRenders(page, entry.uiEntry), `${route?.pattern ?? entry.routeId} → ${entry.uiEntry.exportName} が結線されていません`).toBe(true);
    }
  });
});

describe("A1 §4 component移動で意味task集合を変えない", () => {
  it("runtime edgeのmoduleだけを移してもscreen/mutation ID集合は同じ", () => {
    const moved = ADMIN_SCREEN_RUNTIME_ENTRIES.map((entry) => ({
      ...entry,
      uiEntry: { ...entry.uiEntry, module: `src/moved/${entry.uiEntry.module.slice(4)}` },
    }));
    expect(semanticAdminTaskSet(ADMIN_SCREEN_TASK_MANIFEST, moved)).toEqual(
      semanticAdminTaskSet(ADMIN_SCREEN_TASK_MANIFEST, ADMIN_SCREEN_RUNTIME_ENTRIES),
    );
  });
});

describe("A1 §5 削除に専用画面を与えない", () => {
  it("末尾がdeleteのrouteが無い", () => {
    expect([...actualRoutes].filter((route) => /\/delete$/.test(route))).toEqual([]);
  });
});
