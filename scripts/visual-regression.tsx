/**
 * 見た目の崩れを、人の目ではなく画素で捕まえる。
 *
 * ```
 * pnpm run visual                          見本と比べる（赤くなったら崩れている）
 * pnpm run visual -- --accept --why "…"    見本を撮り直す（理由が要る）
 * ```
 *
 * ## これが塞いでいる穴
 *
 * `ah-h57`（見た目の崩れを機械が見ていない）。余白・重なり・行の折り返しは、
 * 型検査にも読み上げ検査にも引っかからない。**画面の意味は正しいのに
 * 見た目だけが壊れている**状態は、これまで人が preview を開かないと分からなかった。
 *
 * ## 撮るのは「静止した写し」
 *
 * 撮る対象は `scripts/write-static-preview.tsx` と同じ組み立て
 * （`scripts/lib/static-preview.mjs` の `buildDocument`）である。
 * サーバーを建てず、ログインも通らない。撮れるのは**部品の見た目**だけで、
 * データの流れや権限は撮っていない。ここを混同すると
 * 「画面の検査がある」と読まれるので、`SHOTS` の並びが**見ている範囲の全部**である。
 *
 * ## 3 つの安全装置
 *
 * 1. **陽性対照を毎回撮る。** 1px ずらした絵が赤くならなければ、比べる側が
 *    死んでいるということなので、**比較そのものを行わずに落ちる**。
 *    これが無いと「差分 0 件」が「差が無い」なのか「見ていない」なのか区別できない。
 * 2. **見本は環境の名札ごとに置く。** 書体が端末の既定に落ちるため、
 *    macOS で撮った見本と Linux で撮った絵は中身が同じでも全画素が違う。
 *    名札の無い環境で走らせたときは**緑にせず落ちる**（撮り直しの手順を出す）。
 * 3. **上書きに理由と枚数の上限を掛ける。** `scripts/lib/visual-baseline.mjs`。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md（3 段 = 深い門）
 */

import { mkdirSync, appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { DEFAULT_APPEARANCE } from "@/domain/authoring/appearance";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { Card, Page } from "@/presentation/ui";
import { AppShell } from "@/presentation/ui/templates/app-shell";
import { DensitySamples } from "@/app/admin/ui-catalog/density-samples";
import { InputSamples } from "@/app/admin/ui-catalog/input-samples";
import { FeedbackSamples } from "@/app/admin/ui-catalog/feedback-samples";
import { buildDocument, findModuleCss } from "./lib/static-preview.mjs";
import { captureAll } from "./lib/chrome-shot.mjs";
import { comparePng, decodePng } from "./lib/png.mjs";
import {
  BASELINE_DIR,
  MIN_REASON_LENGTH,
  UPDATES_LEDGER,
  auditBaselineLedger,
  readAcceptLimit,
  sha256,
} from "./lib/visual-baseline.mjs";
import { VISUAL_BASELINE_ACCEPT_MAX } from "../quality-gates.config.mjs";

const ROOT = process.cwd();
const ENTRY_CSS = "src/app/globals.css";
/** 差分の絵の置き場。git には入れない（`.gitignore`）。見るためだけのもの。 */
const DIFF_DIR = "tests/visual/__diff__";

/** 画面の広さ。2 つだけ持つ。増やすほど撮る枚数が増え、赤の読み解きが重くなる。 */
const WIDE = { width: 1280, height: 900 } as const;
const NARROW = { width: 390, height: 844 } as const;

/*
  **明暗は場面ごとに明示する。`auto`（既定）で撮らない。**

  `DEFAULT_APPEARANCE` の `colorMode` は `auto` で、意味は「端末の設定に従う」。
  撮る相手が headless Chrome だと、その「端末の設定」は Chrome の既定になる。
  2026-08-19 に実測したところ**既定は dark** だったため、
  明るいほうのつもりで撮った 1 枚が暗いほうと同じ絵になっていた。
  **5 場面あるのに見ているのは 4 場面**という状態は、絵の枚数からは見えない。

  撮る側でも `prefers-color-scheme: light` に固定してある（`chrome-shot.mjs`）が、
  ここでも明示する。片方だけだと、どちらかを直した人が他方を戻せてしまう。
*/
const LIGHT = { ...DEFAULT_APPEARANCE, colorMode: "light" } as const;
const DARK = { ...DEFAULT_APPEARANCE, colorMode: "dark" } as const;

type Shot = {
  readonly name: string;
  /** なぜこの 1 枚を撮るのか。撮る理由の書けない場面は撮らない。 */
  readonly why: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly appearance: { readonly brandTheme: string; readonly colorMode: string };
  readonly body: () => ReactNode;
};

/**
 * 撮る場面。**ここに無いものは見ていない。**
 *
 * 増やすときは `why` を書くこと。書けない場面は、崩れても何が困るのかが
 * 決まっていないということなので、赤くなったときに直しようがない。
 */
const SHOTS: readonly Shot[] = [
  {
    name: "nav-and-density",
    why: "案内の 6 分類と詰まり具合。行の高さと間隔が動くと、いちばん広い範囲に出る",
    viewport: WIDE,
    appearance: LIGHT,
    body: () => (
      <Catalog title="画面部品の見本" heading="22. 詰まり具合の見比べ">
        <DensitySamples />
      </Catalog>
    ),
  },
  {
    name: "nav-and-density-dark",
    why: "暗いほうだけ色が当たっていない崩れは、明るいほうを見ても分からない",
    viewport: WIDE,
    appearance: DARK,
    body: () => (
      <Catalog title="画面部品の見本" heading="22. 詰まり具合の見比べ">
        <DensitySamples />
      </Catalog>
    ),
  },
  {
    name: "nav-and-density-narrow",
    why: "携帯の幅。案内が畳まれる境目で重なりが出やすく、広い画面では絶対に出ない",
    viewport: NARROW,
    appearance: LIGHT,
    body: () => (
      <Catalog title="画面部品の見本" heading="22. 詰まり具合の見比べ">
        <DensitySamples />
      </Catalog>
    ),
  },
  {
    name: "input-samples",
    why: "入力欄の作法（単位・自動値・空欄）。欄の高さがそろっていないと、全画面に波及する",
    viewport: WIDE,
    appearance: LIGHT,
    body: () => (
      <Catalog title="入力の見本" heading="入力欄の作法">
        <InputSamples />
      </Catalog>
    ),
  },
  {
    name: "feedback-samples",
    why: "読み込み・空・失敗の 3 状態。ここが崩れると、うまくいかない人にだけ崩れて見える",
    viewport: WIDE,
    appearance: LIGHT,
    body: () => (
      <Catalog title="反応の見本" heading="4 つの状態">
        <FeedbackSamples />
      </Catalog>
    ),
  },
];

/** 見本の外枠。`write-static-preview.tsx` と同じ組み方にそろえてある。 */
function Catalog({
  title,
  heading,
  children,
}: {
  readonly title: string;
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <AppShell
      currentPath="/admin/ui-catalog"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: title }]}
    >
      <Page title={title} lead="実物の部品を、実物の見た目のまま並べています。">
        <Card>
          <h2>{heading}</h2>
          {children}
        </Card>
      </Page>
    </AppShell>
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const accept = argv.includes("--accept");
  const why = (argv[argv.indexOf("--why") + 1] ?? "").trim();
  /*
    上書きする見本を名前で絞る。**上限を回避する口ではなく、上限を守るための口**である。
    上限が 2 枚なのに 5 枚変わった日、絞れないと打つ手が「上限を上げる」しか無くなり、
    上限は必ず上げられる。1 枚ずつ理由を書いて通す道を開けておく。
  */
  const only = argv.includes("--only")
    ? new Set((argv[argv.indexOf("--only") + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  if (only !== null) {
    const unknown = [...only].filter((name) => !SHOTS.some((s) => s.name === name));
    if (unknown.length > 0) fail([`知らない場面です: ${unknown.join(", ")}`]);
    if (only.size === 0) fail(["--only に名前がありません。"]);
  }

  /* --- 見本の台帳は、撮る前に見る --------------------------------------
     ブラウザが無い機械でもここまでは効く。撮れないことと、
     見本が理由なく書き換わっていることは、別々に赤くなるべきである。 */
  const ledgerProblems = auditBaselineLedger(ROOT, VISUAL_BASELINE_ACCEPT_MAX);
  if (!accept && ledgerProblems.length > 0) {
    fail(["見本の台帳に問題があります。", ...ledgerProblems.map((p) => "  - " + p)]);
  }

  const css = await tailwindCss();
  const moduleCss = findModuleCss(ROOT).map((path) => ({
    path,
    text: readFileSync(join(ROOT, path), "utf8"),
  }));
  const generatedAt = "見た目の回帰用。日付は入れない（日付が変わるだけで赤くなるため）";

  const html = (shot: Shot, extraStyle = ""): string =>
    buildDocument({
      tailwindCss: css,
      moduleCss,
      bodyHtml: renderToStaticMarkup(shot.body()) + extraStyle,
      htmlAttributes: { lang: "ja", ...appearanceAttributes(shot.appearance) },
      generatedAt,
    });

  /* --- 陽性対照 ---------------------------------------------------------
     1 枚目を、そのままと 1px ずらしたものの 2 通りで撮る。
     ずらしたほうが赤くならなければ、比べる側が動いていない。 */
  const control = SHOTS[0];
  /*
    **左へ**ずらす。右へずらすと 1px はみ出して紙の幅が 1 増え、
    「大きさが違う」で赤くなる。それでも赤ではあるが、**画素を見比べる側が
    動いていることの証明にならない**（大きさだけ見て落ちても同じ赤が出る）。
    下の判定は「大きさは同じまま、画素が違う」ことまで要求する。
  */
  const SHIFT = "<style>body > * { transform: translateX(-1px); }</style>";

  const pages = [
    { name: "__control__", html: html(control), viewport: control.viewport },
    { name: "__control-shifted__", html: html(control, SHIFT), viewport: control.viewport },
    ...SHOTS.map((shot) => ({ name: shot.name, html: html(shot), viewport: shot.viewport })),
  ];

  /*
    撮る前の HTML を書き出す口。赤が出たとき、絵だけを見ても
    「CSS が当たっていないのか、当たった結果そう見えるのか」が分からない。
    ここを見れば、撮る側と作る側のどちらが原因かを切り分けられる。
  */
  if (argv.includes("--dump")) {
    const dir = argv[argv.indexOf("--dump") + 1] ?? DIFF_DIR;
    mkdirSync(dir, { recursive: true });
    for (const page of pages) writeFileSync(join(dir, `${page.name}.html`), page.html);
    console.log(`撮る前の HTML を ${pages.length} 枚 書き出しました: ${dir}`);
  }

  const { environment, chromeVersion, shots } = await captureAll(pages);
  const taken = new Map(shots.map((s) => [s.name, s.png]));

  const controlPlain = decodePng(taken.get("__control__")!);
  const controlShifted = decodePng(taken.get("__control-shifted__")!);
  const controlResult = comparePng(controlPlain, controlShifted);
  if (controlResult.same) {
    fail([
      "陽性対照が赤くなりませんでした。**比べる側が動いていません。**",
      "1px ずらした絵が同じだと判定されたので、この先の「差分 0 件」には意味がありません。",
      "見本との比較は行わずに終わります（緑を出さないため）。",
    ]);
  }
  if (controlResult.sizeMismatch !== undefined) {
    fail([
      "陽性対照が「大きさが違う」で赤くなりました: " + controlResult.sizeMismatch,
      "赤ではありますが、**画素を見比べる側が動いていることの証明になりません**",
      "（大きさだけを見ていても同じ赤が出るため）。撮り方が変わった可能性があります。",
    ]);
  }
  if (controlResult.ratio > 0.5) {
    /*
      1px 左へずらしただけで半分以上の画素が変わるのは、ずらし方が効きすぎているか、
      撮るたびに絵が違っている（動きが止まっていない）ということ。
      そのまま通すと、陽性対照は「何をしても赤い」だけの飾りになる。
    */
    fail([
      `陽性対照の違いが大きすぎます（${(controlResult.ratio * 100).toFixed(1)}%）。`,
      "1px のずれで半分以上が変わるのは、撮るたびに絵が違っている疑いがあります。",
      "その状態では、本物の赤とゆらぎの赤が区別できません。",
    ]);
  }
  console.log(
    `陽性対照 OK: 1px ずらした絵は、大きさは同じまま ${controlResult.changedPixels} 画素` +
      `（${(controlResult.ratio * 100).toFixed(2)}%）の違いとして赤くなりました`,
  );

  /* --- 場面どうしが同じ絵になっていないか ------------------------------
     2026-08-19 に実際に起きた壊れ方。明るいほうと暗いほうを撮ったつもりで、
     どちらも暗いほうだった（`auto` の意味が撮る相手の既定に落ちるため）。
     **絵は 5 枚あるのに見ているのは 4 場面**という状態は、枚数からは見えない。
     見本を撮ったあとでは気づけないので、撮った直後にここで見る。 */
  const fingerprints = new Map<string, string>();
  const twins: string[] = [];
  for (const shot of SHOTS) {
    const key = sha256(taken.get(shot.name)!);
    const twin = fingerprints.get(key);
    if (twin !== undefined) twins.push(`${twin} と ${shot.name} が同じ絵です`);
    else fingerprints.set(key, shot.name);
  }
  if (twins.length > 0) {
    fail([
      "撮った場面のうち、中身が同じものがあります:",
      ...twins.map((t) => "  - " + t),
      "枚数は揃っていますが、**見ている場面はその分だけ少ない**状態です。",
      "場面の指定（明暗・広さ・中身）が効いていない可能性があります。",
    ]);
  }
  console.log(`環境: ${environment}（${chromeVersion}）`);

  const baselineDir = join(ROOT, BASELINE_DIR, environment);

  if (accept) {
    await acceptBaselines({ environment, baselineDir, taken, why, only });
    return;
  }

  if (!existsSync(baselineDir)) {
    fail([
      `この環境（${environment}）の見本がありません: ${BASELINE_DIR}/${environment}/`,
      "書体は端末の既定に落ちるので、別の環境で撮った見本とは中身が同じでも全画素が違います。",
      "**「見本が無い」を差分 0 件にはしません。**この環境で見本を撮るなら:",
      `  pnpm run visual -- --accept --why "…（${MIN_REASON_LENGTH} 文字以上）"`,
    ]);
  }

  /* --- 比べる ---------------------------------------------------------- */
  mkdirSync(join(ROOT, DIFF_DIR), { recursive: true });
  /** @type {string[]} */
  const broken: string[] = [];
  let compared = 0;

  for (const shot of SHOTS) {
    const baselinePath = join(baselineDir, `${shot.name}.png`);
    if (!existsSync(baselinePath)) {
      broken.push(`${shot.name}: 見本がありません（${BASELINE_DIR}/${environment}/${shot.name}.png）`);
      continue;
    }
    const result = comparePng(decodePng(readFileSync(baselinePath)), decodePng(taken.get(shot.name)!));
    compared += 1;
    if (result.same) {
      console.log(`  緑 ${shot.name}`);
      continue;
    }
    const diffPath = join(ROOT, DIFF_DIR, `${shot.name}.diff.png`);
    if (result.diffPng) writeFileSync(diffPath, result.diffPng);
    writeFileSync(join(ROOT, DIFF_DIR, `${shot.name}.now.png`), taken.get(shot.name)!);
    broken.push(
      result.sizeMismatch ??
        `${shot.name}: ${result.changedPixels} 画素（${(result.ratio * 100).toFixed(2)}%）違います → ${DIFF_DIR}/${shot.name}.diff.png`,
    );
  }

  /*
    0 枚しか比べていない状態を緑にしない。
    場面の一覧が空になる書き間違い 1 つで、この検査は「常に緑」になる。
  */
  if (compared === 0) {
    fail(["1 枚も比べていません。撮る場面の一覧か、見本の置き場所が壊れています。"]);
  }

  if (broken.length > 0) {
    fail([
      `見た目が変わっています（${broken.length} / ${SHOTS.length} 枚）:`,
      ...broken.map((b) => "  - " + b),
      "",
      "変わってよい変更なら、理由を添えて見本を撮り直してください:",
      `  pnpm run visual -- --accept --why "…"`,
    ]);
  }

  console.log(`OK 見た目の回帰なし（${compared} 枚）`);
}

/**
 * 見本を撮り直す。**理由と枚数の上限を通らないと書かない。**
 */
async function acceptBaselines({
  environment,
  baselineDir,
  taken,
  why,
  only,
}: {
  environment: string;
  baselineDir: string;
  taken: Map<string, Buffer>;
  why: string;
  only: ReadonlySet<string> | null;
}): Promise<void> {
  if (why.length < MIN_REASON_LENGTH) {
    fail([
      `上書きの理由が短すぎます（${why.length} 文字 / ${MIN_REASON_LENGTH} 文字以上）。`,
      "「更新」「fix」で通ると、理由の欄はあるのに何も書いていないのと同じになります。",
      "どの画面の何が、なぜ変わってよいのかを 1 文で書いてください。",
      `  pnpm run visual -- --accept --why "…"`,
    ]);
  }

  const { limit, problems } = readAcceptLimit(ROOT);
  if (problems.length > 0) fail(["上限の記録に問題があります。", ...problems.map((p) => "  - " + p)]);

  /* 変わった見本だけを数える。変わっていないものを上書きしても中身は同じなので、
     枚数に数えると上限が意味の無いところで当たる。 */
  const changed = SHOTS.filter((shot) => {
    if (only !== null && !only.has(shot.name)) return false;
    const path = join(baselineDir, `${shot.name}.png`);
    if (!existsSync(path)) return true;
    return sha256(readFileSync(path)) !== sha256(taken.get(shot.name)!);
  });

  if (changed.length === 0) {
    console.log("見本は 1 枚も変わっていません。台帳には何も書きません。");
    return;
  }

  if (changed.length > limit) {
    fail([
      `1 回で ${changed.length} 枚を上書きしようとしています（上限 ${limit} 枚）。`,
      "まとめて上書きすると、1 枚ずつなら気づけた崩れが理由 1 行に紛れます。",
      "分けて、それぞれに理由を書いてください。",
      "対象: " + changed.map((s) => s.name).join(", "),
    ]);
  }

  mkdirSync(baselineDir, { recursive: true });
  const record = changed.map((shot) => {
    const png = taken.get(shot.name)!;
    writeFileSync(join(baselineDir, `${shot.name}.png`), png);
    return { name: shot.name, environment, sha256: sha256(png) };
  });

  const ledgerPath = join(ROOT, UPDATES_LEDGER);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  appendFileSync(
    ledgerPath,
    JSON.stringify({ at: new Date().toISOString(), why, shots: record }) + "\n",
  );

  console.log(`見本を ${record.length} 枚 撮り直しました（${environment}）。台帳に理由を書きました。`);
  for (const r of record) console.log(`  - ${r.name}`);
}

async function tailwindCss(): Promise<string> {
  const from = join(ROOT, ENTRY_CSS);
  const result = await postcss([tailwind()]).process(readFileSync(from, "utf8"), { from });
  return result.css;
}

function fail(lines: readonly string[]): never {
  console.error("\n" + lines.join("\n") + "\n");
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
