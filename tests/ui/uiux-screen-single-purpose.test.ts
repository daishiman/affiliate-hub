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

function exportedRuntimeEdgesOf(file: string): readonly {
  readonly uiExportName: string;
  readonly action: SourceEdge;
}[] {
  const found: { readonly uiExportName: string; readonly action: SourceEdge }[] = [];
  const exportedFunctions: ts.FunctionDeclaration[] = [];
  for (const statement of parse(file).statements) {
    if (!ts.isFunctionDeclaration(statement) || statement.name === undefined || !hasExportModifier(statement)) {
      continue;
    }
    exportedFunctions.push(statement);
    for (const action of runtimeActionEdgesForNames(file, runtimeNamesInNode(statement))) {
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
  it("実在route・route metadata・task manifest・priority mapが84件で1対1になる", () => {
    const priority = JSON.parse(readFileSync(PRIORITY_MAP, "utf8")) as {
      readonly screens: readonly { readonly route: string; readonly primary_task: string }[];
    };
    const actual = [...actualRoutes].sort();
    const metadata = ADMIN_ROUTE_METADATA.map((route) => route.pattern).sort();
    const tasks = ADMIN_SCREEN_TASK_MANIFEST.map((screen) => screen.route).sort();
    const documented = priority.screens.map((screen) => screen.route).sort();

    expect(actual).toHaveLength(84);
    expect(metadata).toEqual(actual);
    expect(tasks).toEqual(actual);
    expect(documented).toEqual(actual);
    expect(new Set(ADMIN_SCREEN_TASK_MANIFEST.map((screen) => screen.routeId)).size).toBe(84);
    expect(new Set(priority.screens.map((screen) => screen.route)).size).toBe(84);
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
    expect(discovered).toHaveLength(61);
    expect(declared, "未申告または実在しないexecution siteがあります").toEqual(discovered);
    expect(new Set(
      ADMIN_SCREEN_RUNTIME_ENTRIES
        .filter((entry) => entry.classification === "business-mutation")
        .map((entry) => edgeKey(entry.action)),
    ).size).toBe(59);
  });

  it("同じactionの複数route・複数form用途を畳まず、意味entry 79件を床固定する", () => {
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
    expect(discovered).toHaveLength(79);
    expect(ADMIN_SCREEN_RUNTIME_ENTRIES).toHaveLength(80);
    expect(new Set(ADMIN_SCREEN_RUNTIME_ENTRIES.map((entry) => entry.id)).size).toBe(80);
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

    expect(new Set(declared).size).toBe(79);
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
      for (const route of ADMIN_ROUTE_METADATA) {
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
