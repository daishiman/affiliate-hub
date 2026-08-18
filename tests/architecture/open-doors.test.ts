/** @tier 1 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { OPEN_DOORS_MAX_UNGUARDED } from "../../quality-gates.config.mjs";

/**
 * **いま何が開いているか**を 1 か所に書く。
 *
 * このアプリにはまだ認証が無い。`middleware.ts` は存在せず、
 * `currentActor()` は身元を解決できないと**見本の身元へ落ちる**ので、
 * 未ログインの人が管理画面を開き、変更を起こす操作を実行できる。
 *
 * その事実を、感覚ではなく**コードから測って**書き出す。
 * 手で書いた一覧は必ず古くなり、古い一覧は「守られている」と誤って報告する。
 *
 * 測るのは 2 つ。
 *
 *   1. **入口**（画面・REST・転送）— 誰が通れるか
 *   2. **変更を起こす操作**（`"use server"`）— 誰が実行できるか
 *
 * 各行には**意図**（本来通れるべき人）を宣言する。宣言の無い入口・操作が
 * 現れたらこの検査は落ちる。**説明しないまま入口を足せない**ようにするため。
 *
 * 意図と実測の差が「いま開いている扉」で、その件数だけを
 * `OPEN_DOORS_MAX_UNGUARDED` で固定する。減らすのは自由、増やすのは赤。
 *
 * 更新するとき: `UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts`
 *
 * @req REQ-S10
 * @types permission-matrix, infra-config
 */

const ROOT = process.cwd();
const LEDGER_PATH = join(ROOT, "docs/product/open-doors.md");

/** 通れる人の区分。狭い順に並べてある（表示の並びもこの順）。 */
type Gate = "誰でも" | "ログイン" | "鍵";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const sourceFiles = walk(join(ROOT, "src"));
const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => relative(ROOT, file).split("\\").join("/");

/**
 * 画面全体を覆う門があるか。
 *
 * Next.js で全ページを一括で守れる場所は `middleware.ts` だけである。
 * ここを「無ければ画面は誰でも通れる」と機械で判定しておくと、
 * 認証を入れた日にこの検査の結果が**自動で変わる**（手で直す必要がない）。
 */
const hasMiddleware =
  existsSync(join(ROOT, "src/middleware.ts")) || existsSync(join(ROOT, "middleware.ts"));

/**
 * REST の入口の門を、呼んでいる関数の名前から読む。
 *
 * 実装の中身ではなく名前で見ているので、**関数の中身が骨抜きになっても
 * ここは緑のまま**である。この検査が言えるのは「門を通す形になっている」
 * までで、「守られている」ではない。中身は各入口の単体テストが見る。
 */
function gateOfRoute(source: string): Gate {
  if (/authenticate(Api)?Request\s*\(/.test(source)) return "鍵";
  if (/resolveIntegrationAccess\s*\(/.test(source)) return "鍵";
  if (/signedInActor\s*\(/.test(source)) return "ログイン";
  return "誰でも";
}

/**
 * 変更操作の門を、使っている身元の取り方から読む。
 *
 * `currentActor()` は解決できなければ見本の身元を返す＝**誰でも通る**。
 * `signedInActor()` は落ちない。`readerActor()` は読者そのもの＝誰でも。
 */
function gateOfActor(source: string): Gate {
  if (/\bsignedInActor\s*\(/.test(source)) return "ログイン";
  return "誰でも";
}

type Row = {
  readonly kind: "画面" | "REST" | "転送" | "操作";
  readonly id: string;
  readonly what: string;
  readonly intent: Gate;
  readonly actual: Gate;
};

/**
 * 意図の宣言（本来、誰が通れるべきか）。
 *
 * ここは**人が書く**。コードから導くと、いまの実装がそのまま「正しい姿」になり、
 * 差が永久に 0 件になってしまう。
 */
const PAGE_INTENT: readonly { readonly prefix: string; readonly intent: Gate; readonly what: string }[] =
  [
    { prefix: "src/app/admin/", intent: "ログイン", what: "管理画面" },
    { prefix: "src/app/s/", intent: "誰でも", what: "読者向けの公開ページ" },
    { prefix: "src/app/signin/", intent: "誰でも", what: "サインイン画面" },
    { prefix: "src/app/page.tsx", intent: "誰でも", what: "入口の案内" },
  ];

const ROUTE_INTENT: Readonly<Record<string, { readonly intent: Gate; readonly what: string }>> = {
  "src/app/api/tools/route.ts": { intent: "鍵", what: "使える操作の一覧（REST）" },
  "src/app/api/tools/[tool]/route.ts": { intent: "鍵", what: "操作の実行（REST）" },
  "src/app/api/mcp/route.ts": { intent: "鍵", what: "操作の実行（MCP）" },
  "src/app/api/feedback/pending/route.ts": { intent: "鍵", what: "未処理の指摘の取り出し" },
  "src/app/api/feedback-captures/[capture]/route.ts": {
    intent: "ログイン",
    what: "指摘に添えた画面の写しの取り出し",
  },
  "src/app/api/telemetry/route.ts": {
    intent: "誰でも",
    what: "読者の画面から届く計測（未ログインの読者が送るので、門は置けない）",
  },
  "src/app/go/[code]/route.ts": {
    intent: "誰でも",
    what: "成果リンクの転送（読者がクリックする先）",
  },
};

const ACTION_INTENT: Readonly<Record<string, { readonly intent: Gate; readonly what: string }>> = {
  adjustConversionAction: { intent: "ログイン", what: "成果の実績を手で直す" },
  advanceContentStateAction: { intent: "ログイン", what: "記事の作業段階を進める" },
  approveContentAction: { intent: "ログイン", what: "記事を承認する" },
  checkFactBoundaryAction: { intent: "ログイン", what: "書ける範囲の判定を試す" },
  submitFeedbackAction: { intent: "ログイン", what: "指摘を登録する" },
  changeFeedbackStatusAction: { intent: "ログイン", what: "指摘の状態を変える" },
  handOffFeedbackAction: { intent: "ログイン", what: "指摘を引き継ぐ" },
  manageIntegrationAccessAction: { intent: "ログイン", what: "外部連携の鍵を作る・消す" },
  submitAffiliateUrlAction: { intent: "ログイン", what: "成果リンクを登録する" },
  advanceLinkIngestionAction: { intent: "ログイン", what: "成果リンクの取り込みを進める" },
  manageLlmCredentialAction: { intent: "ログイン", what: "生成 AI の API キーを預ける・消す" },
  publishArticleAction: { intent: "ログイン", what: "記事を公開する" },
  reschedulePublicationAction: { intent: "ログイン", what: "投稿予定日を変える" },
  schedulePublicationAction: { intent: "ログイン", what: "投稿を予定に入れる" },
  startSiteDraftAction: { intent: "ログイン", what: "サイトの下書きを始める" },
  saveSiteDraftStepAction: { intent: "ログイン", what: "サイトの下書きを保存する" },
  createSiteFromDraftAction: { intent: "ログイン", what: "下書きからサイトを作る" },
  submitContactAction: { intent: "誰でも", what: "読者からの問い合わせ（公開フォーム）" },
};

function scanPages(): Row[] {
  return sourceFiles
    // 入口になるのは `src/app/` の下だけ。`src/presentation/` にも
    // `*-page.tsx` があるが、あれは画面の部品であって URL を持たない。
    .filter((f) => f.endsWith("page.tsx") && rel(f).startsWith("src/app/"))
    .map((file) => {
      const id = rel(file);
      const declared = PAGE_INTENT.find((p) => id.startsWith(p.prefix));
      return {
        kind: "画面" as const,
        id,
        what: declared?.what ?? "（宣言なし）",
        intent: declared?.intent ?? ("ログイン" as Gate),
        // 画面を一括で守れる場所は `middleware.ts` だけ。無ければ全部通る。
        actual: hasMiddleware ? declared?.intent ?? "ログイン" : ("誰でも" as Gate),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function scanRoutes(): Row[] {
  return sourceFiles
    .filter((f) => f.endsWith("route.ts"))
    .map((file) => {
      const id = rel(file);
      const declared = ROUTE_INTENT[id];
      return {
        kind: id.includes("/go/") ? ("転送" as const) : ("REST" as const),
        id,
        what: declared?.what ?? "（宣言なし）",
        intent: declared?.intent ?? ("鍵" as Gate),
        actual: gateOfRoute(read(file)),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function scanActions(): Row[] {
  const rows: Row[] = [];
  for (const file of sourceFiles) {
    const source = read(file);
    if (!/^\s*["']use server["']/.test(source)) continue;
    const actual = gateOfActor(source);
    for (const match of source.matchAll(/^export async function (\w+)/gm)) {
      const name = match[1];
      const declared = ACTION_INTENT[name];
      rows.push({
        kind: "操作",
        id: `${name}()`,
        what: `${declared?.what ?? "（宣言なし）"}（${rel(file)}）`,
        intent: declared?.intent ?? "ログイン",
        actual,
      });
    }
  }
  return rows.sort((a, b) => (a.id < b.id ? -1 : 1));
}

const rows = [...scanPages(), ...scanRoutes(), ...scanActions()];
const gaps = rows.filter((r) => r.intent !== r.actual);

function table(subset: readonly Row[]): string[] {
  return [
    "| 入口・操作 | 何ができるか | 本来 | いま | 差 |",
    "|---|---|---|---|---|",
    ...subset.map(
      (r) =>
        `| \`${r.id}\` | ${r.what} | ${r.intent} | ${r.actual} | ${r.intent === r.actual ? "—" : "**開いている**"} |`,
    ),
  ];
}

function renderLedger(): string {
  const of = (kind: Row["kind"]) => rows.filter((r) => r.kind === kind);
  return [
    "# いま何が開いているか（入口の台帳）",
    "",
    "このファイルは `tests/architecture/open-doors.test.ts` が作る。手で書き換えない。",
    "更新は `UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts`。",
    "",
    "**「本来」は人が宣言した意図、「いま」はコードから測った実測**である。",
    "この 2 つが違う行が、いま誰でも通れてしまう扉。",
    "",
    `画面を一括で守る \`middleware.ts\`: **${hasMiddleware ? "ある" : "無い"}**`,
    "",
    `開いている扉: **${gaps.length} 件** / 全 ${rows.length} 件`,
    "",
    "この検査が言えるのは「門を通す形になっている」ところまでで、",
    "「守られている」ではない。門の中身は各入口の単体テストが見る。",
    "",
    "## 画面",
    "",
    "`middleware.ts` が無いので、管理画面は URL を知っていれば誰でも開ける。",
    "`currentActor()` が身元を解決できないと**見本の身元**へ落ちるため、",
    "画面の中身も空にならず、実在するデータが表示される。",
    "",
    ...table(of("画面")),
    "",
    "## REST・転送",
    "",
    ...table([...of("REST"), ...of("転送")]),
    "",
    "## 変更を起こす操作（`\"use server\"`）",
    "",
    "画面を開けた人は、この操作をそのまま実行できる。",
    "**公開だけは通らない**（見本の身元に `publisher` と `owner` の役が無いため）。",
    "",
    ...table(of("操作")),
    "",
  ].join("\n");
}

describe("いま開いている入口", () => {
  it("検査対象を実際に読めている", () => {
    expect(rows.filter((r) => r.kind === "画面").length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.kind === "REST").length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.kind === "操作").length).toBeGreaterThan(0);
  });

  it("すべての入口と操作に「本来、誰が通れるべきか」が宣言されている", () => {
    // 宣言せずに入口を足せると、台帳は増えないまま扉だけが増える。
    const undeclared = rows.filter((r) => r.what.includes("（宣言なし）")).map((r) => r.id);
    expect(
      undeclared,
      "意図の宣言がありません。tests/architecture/open-doors.test.ts の *_INTENT に足してください。",
    ).toEqual([]);
  });

  it("開いている扉が増えていない", () => {
    expect(
      gaps.length,
      `開いている扉が ${gaps.length} 件（上限 ${OPEN_DOORS_MAX_UNGUARDED} 件）。` +
        "上限を上げて緑にしないでください。",
    ).toBeLessThanOrEqual(OPEN_DOORS_MAX_UNGUARDED);
  });

  it("台帳ファイルが実際の状態と一致している", () => {
    const expected = renderLedger();
    if (process.env.UPDATE_OPEN_DOORS === "1") writeFileSync(LEDGER_PATH, expected, "utf8");

    let actual: string;
    try {
      actual = readFileSync(LEDGER_PATH, "utf8");
    } catch {
      actual = "";
    }
    expect(
      actual,
      "入口の台帳が古くなっています。`UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts` で作り直してください。",
    ).toBe(expected);
  });
});
