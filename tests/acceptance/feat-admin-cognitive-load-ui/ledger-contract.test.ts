/** @tier 1 @req REQ-S09, REQ-SEC08, REQ-A08 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_CARD_ROUTE_IDS,
  ADMIN_DISCLOSURE_CONTRACTS,
  ADMIN_ROUTE_METADATA,
  ADMIN_SCREEN_STATES,
  ADMIN_SCREEN_STATE_CONTRACTS,
  AppShell,
} from "@/presentation/ui";

type Ledger = {
  readonly routeCount: number;
  readonly undecidedCount: number;
  readonly allowedRepresentations: readonly string[];
  readonly representationVocabulary: Readonly<Record<string, string>>;
  readonly plannedPrimaryGapCount: number;
  readonly plannedPrimaryGapRouteIds: readonly string[];
  readonly operationalStateBinding: {
    readonly runtimeSource: string;
    readonly states: readonly string[];
    readonly event: string;
    readonly safeData: string;
    readonly nextAction: string;
  };
  readonly detailDisclosureBinding: {
    readonly strategies: readonly string[];
    readonly defaultStrategy: string;
    readonly foldableRouteIds: readonly string[];
    readonly foldableComponent: string;
    readonly initialOpen: boolean;
    readonly forbiddenSummaryLabels: readonly string[];
    readonly runtimeSource: string;
  };
  readonly cardRepresentationBinding: {
    readonly runtimeSource: string;
    readonly contractSource: string;
    readonly unitRenderers: readonly string[];
    readonly routeWrapper: boolean;
    readonly singleClaim: boolean;
    readonly mainCount: number;
    readonly supportingMax: number;
    readonly primaryActionMax: number;
    readonly claimCharacterMax: number;
  };
  readonly routes: readonly {
    readonly routeId: string;
    readonly file: string;
    readonly screenName: string;
    readonly purpose: string;
    readonly primaryAction: string;
    readonly keyboardAction: {
      readonly role: string;
      readonly accessibleName: string;
      readonly occurrence: number;
      readonly completion: string;
      readonly viewportCondition: string;
    };
    readonly representation: {
      readonly primary: string;
      readonly plannedPrimary: string;
      readonly secondary: readonly string[];
    };
    readonly states: readonly string[];
    readonly decision: string;
  }[];
};

const ROOT = process.cwd();
const ledger = JSON.parse(
  readFileSync(join(ROOT, "docs/spec/feat-admin-cognitive-load-ui/screen-information-ledger.json"), "utf8"),
) as Ledger;
const ADMIN = join(ROOT, "src/app/admin");
const source = (file: string): string => readFileSync(join(ROOT, file), "utf8");
const walkPages = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkPages(full, out);
    else if (name === "page.tsx") out.push(`src/app/admin/${relative(ADMIN, full)}`);
  }
  return out;
};

/**
 * card 主表現の実装突合に使う印。
 *
 * 以前は `<Section` を含んでいたが、`<Section` は src/app/admin 配下の page.tsx
 * 86 枚すべてに現れるため判定が常に真になり、card 主表現の突合が丸ごと空振り
 * していた。判断単位を実際に分けている印は `<Card`・用途別 Form・`<FactList`
 * （1 個体の事実を項目ごとに並べる）の 3 つなので、そこまで絞る。
 */
const CARD_MARKER = /<Card\b|<[A-Z][A-Za-z]+Form\b|<FactList\b/;

/** 台帳の表現分類と、実 page で対応する共通部品の印。 */
const REPRESENTATION_MARKER = {
  summary: /<SummaryStrip\b/,
  graph: /<BarChart\b/,
  comparison: /<ComparisonTable\b/,
  table: /<DataTable\b|<RankingTable\b/,
  card: CARD_MARKER,
  board: /<WorkBoard\b/,
  list: /<ListView\b|<StepList\b|<EvidenceList\b/,
  timeline: /<ScheduleCalendar\b/,
} as const;

/**
 * 主表現の突合で読む「その画面が実際に描くもの」。
 *
 * page.tsx の字面だけを見ると、本体を共通部品へ切り出した画面が
 * 「印が 1 つも無い」と判定される。切り出しはこの改修が進めたい方向なので、
 * 字面だけで判定すると**部品化するほどテストが赤くなる**。それでは
 * 画面ごとに同じ並べ方を書き写す側が有利になり、契約が目的と逆を向く。
 *
 * そこで **1 段だけ**委譲を辿る。page が `<Name` として実際に描いている
 * `@/presentation/**` の部品について、その部品の中身も突合対象へ足す。
 *
 * 2 段以上は辿らない。辿ると `@/presentation/ui` の索引を経由して全部品へ
 * 届き、どの画面でもどの印も見つかる＝判定が常に真になる。
 * 索引そのもの（`@/presentation/ui`）も辿らないのは同じ理由。
 */
const RENDERED_SOURCE_SKIP = new Set(["@/presentation/ui", "@/presentation/composition"]);
const renderedSource = (file: string): string => {
  const page = source(file);
  const parts = [page];
  for (const match of page.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(@\/presentation\/[^"]+)"/g)) {
    const specifier = match[2];
    if (RENDERED_SOURCE_SKIP.has(specifier)) continue;
    const names = match[1]
      .split(",")
      .map((name) => name.replace(/^\s*type\s+/, "").split(/\s+as\s+/).pop()?.trim() ?? "")
      .filter((name) => /^[A-Z]/.test(name));
    // 「import してあるだけ」を通さない。実際に描いている部品だけを足す。
    if (!names.some((name) => new RegExp(`<${name}\\b`).test(page))) continue;
    for (const extension of [".tsx", ".ts"]) {
      try {
        parts.push(source(`src/presentation/${specifier.slice("@/presentation/".length)}${extension}`));
        break;
      } catch {
        // 次の拡張子を試す。どちらも無ければ page 側だけで突合する。
      }
    }
  }
  return parts.join("\n");
};

/**
 * 主表現の宣言に対して、1 段辿ってもなお印が 1 つも無い既知の例外。
 *
 * `ui-catalog` は部品の見本帳で、1 画面 1 表現に収まらない（見本そのものが
 * WorkBoard から ScheduleCalendar まで全部出てくる）。索引として使うので
 * primary/plannedPrimary は list と宣言しているが、実装は見本を Section へ
 * 直に並べており ListView / StepList を通していない。
 *
 * `settings/appearance` は「配色と文字の大きさを選ぶ」だけの画面で、
 * 並べて読むものが 1 つも無い。台帳の 8 分類は**並べ方**の語彙なので、
 * 選択肢を 2 つ出すだけの画面に当てはまる分類が無い。分類を増やすと
 * 他 85 画面の宣言をやり直すことになるため、ここは例外として明示する。
 *
 * 黙って通さないよう、実際に見逃した件数はテスト中に出力する。
 */
const REPRESENTATION_MARKER_KNOWN_EXCEPTIONS: readonly string[] = [
  "ui-catalog",
  "settings/appearance",
];

/** 見逃した route を報告する。件数が既知例外より増えたらテストを落とす。 */
const reportMarkerExceptions = (skipped: readonly string[]): void => {
  if (skipped.length > 0) {
    console.info(
      `[representation marker] 既知例外として ${skipped.length} 件の route を見逃しました: ${skipped.join(", ")}`,
    );
  }
  expect(
    skipped.length,
    "主表現の未結線が既知例外より増えています。台帳か実装のどちらかを直してください",
  ).toBeLessThanOrEqual(REPRESENTATION_MARKER_KNOWN_EXCEPTIONS.length);
};

describe("管理画面の情報台帳", () => {
  it("86 route と86 pageを一対一で監査している", () => {
    const files = walkPages(ADMIN).sort();
    const ledgerFiles = ledger.routes.map((route) => route.file).sort();
    const metadataFiles = ADMIN_ROUTE_METADATA.map((route) => `src/app/${route.file}`).sort();
    expect(ledger.routeCount).toBe(ADMIN_ROUTE_METADATA.length);
    expect(ledger.routes).toHaveLength(ADMIN_ROUTE_METADATA.length);
    // 空振り防止: metadata 参照だけにすると route が丸ごと消えても緑になるため下限も置く
    expect(ADMIN_ROUTE_METADATA.length).toBeGreaterThan(80);
    expect(files).toEqual(metadataFiles);
    expect(ledgerFiles).toEqual(metadataFiles);
  });

  it("表現方式と6状態に未決がない", () => {
    const allowed = new Set([
      "summary",
      "graph",
      "comparison",
      "table",
      "card",
      "board",
      "list",
      "timeline",
    ]);
    const states = ["ideal", "empty", "loading", "partial", "error", "slow"];
    expect(ledger.allowedRepresentations).toEqual([...allowed]);
    // 語彙は説明付きで宣言する。印の無い名前を増やすと分類が言葉だけになる。
    expect(Object.keys(ledger.representationVocabulary).sort()).toEqual([...allowed].sort());
    expect(Object.keys(REPRESENTATION_MARKER).sort()).toEqual([...allowed].sort());
    expect(ledger.undecidedCount).toBe(0);
    for (const route of ledger.routes) {
      expect(allowed.has(route.representation.primary), route.routeId).toBe(true);
      expect(allowed.has(route.representation.plannedPrimary), route.routeId).toBe(true);
      expect(route.representation.secondary.every((value) => allowed.has(value)), route.routeId).toBe(true);
      expect(route.states, route.routeId).toEqual(states);
      expect(route.decision, route.routeId).toBe("decided");
    }
  });

  it("目的と主操作は86routeで重複しない", () => {
    // 目的が同じ文なら、その画面のために表現を選ぶ余地が無くなる。実際、86 件が
    // 同一テンプレート文だったとき primary は 44/86 が table に寄っていた。
    const duplicated = (values: readonly string[]): readonly string[] => {
      const seen = new Map<string, number>();
      for (const value of values) seen.set(value, (seen.get(value) ?? 0) + 1);
      return [...seen].filter(([, count]) => count > 1).map(([value]) => value);
    };
    expect(duplicated(ledger.routes.map((route) => route.purpose))).toEqual([]);
    expect(duplicated(ledger.routes.map((route) => route.primaryAction))).toEqual([]);
    for (const route of ledger.routes) {
      expect(route.purpose, route.routeId || "home").not.toBe("");
      // 「{画面名}を確認する」の機械的な連結を禁じる。壊れた日本語の出どころだった。
      expect(route.primaryAction, route.routeId || "home").not.toBe(`${route.screenName}を確認する`);
    }
  });

  it("あるべき主表現は単一値へ偏らず、実装との乖離は台帳が数え上げる", () => {
    const share = (values: readonly string[]): readonly [string, number][] => {
      const seen = new Map<string, number>();
      for (const value of values) seen.set(value, (seen.get(value) ?? 0) + 1);
      return [...seen].sort((left, right) => right[1] - left[1]);
    };
    const plannedShare = share(ledger.routes.map((route) => route.representation.plannedPrimary));
    const actualShare = share(ledger.routes.map((route) => route.representation.primary));
    // 仕様側の偏りは落とす。目的から選び直したのに 1 つの表現が過半なら、
    // 選んだのではなく既定値を書いている。
    expect(
      plannedShare[0][1],
      `plannedPrimary が ${plannedShare[0][0]} に ${plannedShare[0][1]}/${ledger.routes.length} 件偏っています`,
    ).toBeLessThanOrEqual(ledger.routes.length / 2);
    // 実装側の偏りは警告に留める。画面実装の作り替えはこの契約の外にあり、
    // 落としても直せないため。代わりに乖離件数で回帰を止める。
    if (actualShare[0][1] > ledger.routes.length / 2) {
      console.warn(
        `[representation] 実装の primary は ${actualShare[0][0]} が ${actualShare[0][1]}/${ledger.routes.length} 件で過半です`,
      );
    }
    const gaps = ledger.routes
      .filter((route) => route.representation.primary !== route.representation.plannedPrimary)
      .map((route) => route.routeId)
      .sort();
    expect(gaps).toEqual([...ledger.plannedPrimaryGapRouteIds].sort());
    expect(ledger.plannedPrimaryGapCount).toBe(gaps.length);
    // 乖離を増やす方向（あるべき姿を実装へ合わせて下げる）を止める上限。
    expect(gaps.length, "実装が追いついていない route が増えています").toBeLessThanOrEqual(22);
  });

  it("全86routeの主要操作は200%相当で照合できるroleとaccessible nameを持つ", () => {
    const completions = new Set([
      "internal-navigation",
      "external-navigation",
      "form-submit",
      "form-entry",
      "review-complete",
      "local-activation",
    ]);
    for (const route of ledger.routes) {
      expect(route.primaryAction, route.routeId || "home").not.toBe("");
      expect(route.keyboardAction.role, route.routeId || "home").not.toBe("");
      expect(route.keyboardAction.accessibleName, route.routeId || "home").not.toBe("");
      expect(route.keyboardAction.occurrence, route.routeId || "home").toBeGreaterThanOrEqual(1);
      expect(completions.has(route.keyboardAction.completion), route.routeId || "home").toBe(true);
      // 全 route で同じ文字列になる。これは観測日時ではなく、e2e (tests/e2e/app-routes.spec.ts)
      // が 384x450 へ viewport を落として Tab 送りを実測するときの共通条件なので、
      // 1 件ずつ変わる値ではない。名前も観測済みを騙らないよう viewportCondition とする。
      expect(route.keyboardAction.viewportCondition, route.routeId || "home").toContain(
        "200% zoom equivalent",
      );
    }
  });

  it("primary表現は実pageの共通部品へ結線され、table宣言だけが残らない", () => {
    const skipped: string[] = [];
    for (const route of ledger.routes) {
      const pattern = REPRESENTATION_MARKER[
        route.representation.primary as keyof typeof REPRESENTATION_MARKER
      ];
      if (
        REPRESENTATION_MARKER_KNOWN_EXCEPTIONS.includes(route.routeId) &&
        !pattern.test(renderedSource(route.file))
      ) {
        skipped.push(route.routeId);
        continue;
      }
      expect(
        renderedSource(route.file),
        `${route.routeId || "home"} のprimary=${route.representation.primary}が実pageへ結線されていません`,
      ).toMatch(pattern);
    }
    reportMarkerExceptions(skipped);
  });

  it("6状態は全86routeでevent/safeData/nextActionと実runtime DOMへ結線される", () => {
    expect(ledger.operationalStateBinding.runtimeSource).toBe(
      "src/presentation/ui/admin-screen-state-contract.ts",
    );
    expect(ledger.operationalStateBinding.states).toEqual([...ADMIN_SCREEN_STATES]);
    expect(ADMIN_SCREEN_STATE_CONTRACTS).toHaveLength(ADMIN_ROUTE_METADATA.length);
    // 空振り防止: 走査対象が消えても緑にならないように下限を置く
    expect(ADMIN_SCREEN_STATE_CONTRACTS.length).toBeGreaterThan(80);
    expect(ADMIN_SCREEN_STATE_CONTRACTS.map((contract) => contract.routeId).sort()).toEqual(
      ADMIN_ROUTE_METADATA.map((route) => route.id).sort(),
    );
    const events: string[] = [];
    for (const contract of ADMIN_SCREEN_STATE_CONTRACTS) {
      for (const state of ledger.operationalStateBinding.states) {
        const instruction = contract.states[state as keyof typeof contract.states];
        expect(instruction.event, `${contract.routeId}:${state}:event`).not.toBe("");
        expect(instruction.safeData, `${contract.routeId}:${state}:safeData`).not.toBe("");
        expect(instruction.nextAction, `${contract.routeId}:${state}:nextAction`).not.toBe("");
        events.push(instruction.event);
      }
    }
    expect(new Set(events).size).toBe(ADMIN_ROUTE_METADATA.length * ADMIN_SCREEN_STATES.length);
    // 空振り防止: event が 1 件も集まらない走査を緑にしないための下限
    expect(new Set(events).size).toBeGreaterThan(80 * 6);
    expect(source("src/app/admin/loading.tsx")).toContain("<LoadingView");
    expect(source("src/app/admin/error.tsx")).toContain("<ErrorView");

    for (const state of ADMIN_SCREEN_STATES) {
      const shellProps: Parameters<typeof AppShell>[0] = {
        actualRoutePath: "/admin/content",
        navContextPath: "/admin/content",
        breadcrumbs: [{ label: "記事" }],
        routeId: "content",
        screenState: state,
        children: createElement("p", null, "画面本文"),
      };
      const markup = renderToStaticMarkup(
        createElement(AppShell, shellProps),
      );
      const instruction = ADMIN_SCREEN_STATE_CONTRACTS.find((entry) => entry.routeId === "content")!.states[state];
      expect(markup).toContain(`data-screen-state="${state}"`);
      expect(markup).toContain(`data-screen-state-event="${instruction.event}"`);
      expect(markup).toContain("data-screen-state-safe-data=");
      expect(markup).toContain("data-screen-state-next-action=");
      if (state === "ideal") {
        expect(markup).not.toContain("data-screen-state-summary=");
        expect(markup).not.toContain("確定している情報:");
        expect(markup).not.toContain("次にできること:");
      } else {
        expect(markup).toContain(`data-screen-state-summary="${state}"`);
        expect(markup).toContain(`確定している情報: ${instruction.safeData}`);
        expect(markup).toContain(`次にできること: ${instruction.nextAction}`);
      }
    }
  });

  it("全routeの補助情報はclosed Foldableか専用routeへ分類される", () => {
    expect(ledger.detailDisclosureBinding.strategies).toEqual(["none", "foldable", "dedicated-route"]);
    expect(ledger.detailDisclosureBinding.runtimeSource).toBe("src/presentation/ui/admin-disclosure-contract.ts");
    expect(ledger.detailDisclosureBinding.initialOpen).toBe(false);
    expect(ADMIN_DISCLOSURE_CONTRACTS).toHaveLength(ADMIN_ROUTE_METADATA.length);
    // 空振り防止: 走査対象が消えても緑にならないように下限を置く
    expect(ADMIN_DISCLOSURE_CONTRACTS.length).toBeGreaterThan(80);
    const declaredFoldable = [...ledger.detailDisclosureBinding.foldableRouteIds].sort();
    const actualFoldable = ledger.routes
      .filter((route) => /<Foldable\b/.test(source(route.file)))
      .map((route) => route.routeId)
      .sort();
    expect(actualFoldable).toEqual(declaredFoldable);

    for (const contract of ADMIN_DISCLOSURE_CONTRACTS) {
      if (contract.strategy !== "dedicated-route") continue;
      expect(contract.targetRouteId, contract.routeId).not.toBe(contract.routeId);
      const target = ADMIN_ROUTE_METADATA.find((candidate) => candidate.id === contract.targetRouteId);
      expect(target?.parent, contract.routeId).toBe(contract.routeId);
      const route = ledger.routes.find((candidate) => candidate.routeId === contract.routeId)!;
      const targetPrefix = `/admin/${contract.targetRouteId.split("/[")[0]}/`;
      expect(source(route.file), `${contract.routeId} -> ${contract.targetRouteId}`).toContain(targetPrefix);
    }

    const foldableSource = source("src/presentation/ui/templates/screen-parts.tsx");
    expect(foldableSource).toContain("<details className={styles.foldable}>");
    expect(foldableSource).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    for (const routeId of declaredFoldable) {
      const route = ledger.routes.find((candidate) => candidate.routeId === routeId);
      const summaries = [...source(route!.file).matchAll(/summary=(?:"([^"]+)"|\{`([^`]+)`\})/g)]
        .map((match) => match[1] ?? match[2] ?? "");
      expect(summaries.length, `${routeId} のFoldable種類`).toBeGreaterThan(0);
      for (const summary of summaries) {
        expect(
          ledger.detailDisclosureBinding.forbiddenSummaryLabels.some((word) => summary === word),
          `${routeId}: ${summary}`,
        ).toBe(false);
      }
    }
    expect(source("src/app/admin/personas/audiences/page.tsx")).toMatch(
      /summary=\{`[^`]*\$\{detailCount\}件[^`]*`\}/,
    );
    expect(source("src/app/admin/feedback/[report]/page.tsx")).toMatch(
      /summary=\{`[^`]*環境・エラー記録[^`]*\.length[^`]*件[^`]*`\}/,
    );
  });

  it("card主表現は主張1・主情報1・補助4以下・主操作1以下へ結線される", () => {
    const ledgerCardIds = ledger.routes
      .filter((route) => route.representation.primary === "card")
      .map((route) => route.routeId)
      .sort();
    expect([...ADMIN_CARD_ROUTE_IDS].sort()).toEqual(ledgerCardIds);
    expect(ADMIN_CARD_ROUTE_IDS.length, "card主表現の走査が空振りしていないこと").toBeGreaterThan(0);
    expect(ledger.cardRepresentationBinding).toMatchObject({
      contractSource: "src/presentation/ui/admin-card-contract.ts",
      runtimeSource: "src/app/admin/",
      unitRenderers: ["Card", "Form", "FactList"],
      routeWrapper: false,
      singleClaim: true,
      mainCount: 1,
      supportingMax: 4,
      primaryActionMax: 1,
      claimCharacterMax: 120,
    });

    for (const routeId of ADMIN_CARD_ROUTE_IDS) {
      const route = ledger.routes.find((candidate) => candidate.routeId === routeId)!;
      expect(
        source(route.file),
        `${routeId} は route 全体ではなく、個体の判断単位を Card・Form・FactList で分けます`,
      ).toMatch(CARD_MARKER);
    }

    const shell = source("src/presentation/admin/admin-shell.tsx");
    expect(shell).not.toContain("AdminRouteContent");
    expect(shell).not.toMatch(/<Card\b/);

    const actualCardSources = walkPages(ADMIN).filter((file) => /<Card\b/.test(source(file)));
    expect(actualCardSources).toEqual([
      "src/app/admin/content/published/[site]/[slug]/edit/page.tsx",
    ]);
    const actualCardSource = source(actualCardSources[0]);
    expect(actualCardSource.match(/<Card\b/g)).toHaveLength(1);
    expect(actualCardSource).not.toMatch(/<Card[\s\S]*<Card/);
  });
});
