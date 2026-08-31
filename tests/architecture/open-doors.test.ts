/** @tier 1 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPEN_DOORS_MAX_IRREVERSIBLE,
  OPEN_DOORS_MAX_PUBLIC_BY_DECLARATION,
  OPEN_DOORS_MAX_UNGUARDED,
  OPEN_DOORS_MIN_ACTIONS,
  OPEN_DOORS_MIN_IRREVERSIBLE_MARKED,
} from "../../quality-gates.config.mjs";
import { expectLedgerFile } from "../support/ledger-file";

/**
 * **いま何が開いているか**を 1 か所に書く。
 *
 * 2026-08-18 に入口の門（`src/middleware.ts`）が入るまで、このアプリには
 * 画面を一括で守る場所が無く、未ログインの人が管理画面を開けていた。
 * `currentActor()` は身元を解決できないと**見本の身元へ落ちる**ため、
 * 画面は空にもならず、実在するデータが並んでいた。
 *
 * そういう事実を、感覚ではなく**コードから測って**書き出す。
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
 * Next.js で全ページを一括で守れる場所は 1 ファイルだけで、
 * **16 でその名前が `middleware.ts` から `proxy.ts` へ変わった**が、
 * Cloudflare 側（`@opennextjs/cloudflare`）が新しい方をまだ受け取れないので、
 * このアプリは `middleware.ts` のままである（理由はそのファイルの冒頭）。
 * **両方の名前を見るのは、置き場所が移った日に黙って「門が無い」と言わないため。**
 *
 * ここを「無ければ画面は誰でも通れる」と機械で判定しておくと、
 * 認証を入れた日にこの検査の結果が**自動で変わる**（手で直す必要がない）。
 *
 * **ただし、ファイルが在ることしか見ていない。** 中身が骨抜きでもここは緑になる。
 * 門の中身は `tests/infrastructure/entry-gate.test.ts` が見る。
 */
const GATE_FILES = ["src/proxy.ts", "proxy.ts", "src/middleware.ts", "middleware.ts"];
const gateFile = GATE_FILES.find((f) => existsSync(join(ROOT, f)));
const hasMiddleware = gateFile !== undefined;
const gateSource = gateFile === undefined ? "" : readFileSync(join(ROOT, gateFile), "utf8");

/**
 * その画面が、いまの門の**適用範囲に入っているか**。
 *
 * 門が在るだけで全画面が守られたことにしない。Next.js の門は `matcher` で
 * 範囲を絞れるので、範囲を狭めれば守りは黙って外れる。
 * だから「門がある」と「その URL が範囲に入っている」を別に測る。
 */
const gateCoversAdmin = /matcher[\s\S]{0,200}["'`]\/admin/.test(gateSource) &&
  /decideEntry\s*\(/.test(gateSource);

/** `src/app/admin/settings/page.tsx` → `/admin/settings` */
function urlOfPage(id: string): string {
  const path = id
    .replace(/^src\/app/, "")
    .replace(/\/page\.tsx$/, "")
    // 括弧で囲んだ区切りは URL に出ない（Next.js のグループ）。
    .replace(/\/\([^/]*\)/g, "");
  return path === "" ? "/" : path;
}

function guardedByEntryGate(url: string): boolean {
  return hasMiddleware && gateCoversAdmin && (url === "/admin" || url.startsWith("/admin/"));
}

/**
 * 注釈を落として、**動くところだけ**を残す。
 *
 * --- なぜ要るのか（2026-08-19 に実際に起きたこと） ---
 * 下の 2 つは名前を正規表現で探している。探す先がファイル全文だったので、
 * **doc comment に `signedInActor()` と書いただけのファイルが「ログイン」に数えられた。**
 * 見つかった経緯そのものが厄介で、`manageLlmCredentialAction()` を直したとき、
 * 直しと一緒に「`currentActor()` ではなく `signedInActor()` を使う」という
 * **説明も足した**。門を戻して壊れることを確かめたら、緑のままだった。
 * 説明のほうが門として数えられていたのである。
 *
 * これは「守りを増やす」より先に直すものである。**数え方が説明に反応する限り、
 * 一覧の件数は守りの数ではなく、その語を書いた回数になる。**
 * しかも向きが最悪で、**ちゃんと説明を書いた人ほど数字がよくなる。**
 *
 * --- ここが見ていないもの ---
 * 文字列の中は落としていない。`"signedInActor("` と書いた文字列があれば、
 * いまでも門と数えられる。落としていない理由は、同じファイルの `matcher` の
 * 判定が文字列 `"/admin"` を見ているためで、一律に落とすと**そちらが黙って壊れる**。
 * 文字列に関数呼び出しの形を書く動機は無いので、いまは注釈だけを落とす。
 * 文字列で抜けた例を 1 件でも見たら、そのときは判定を構文解析へ移すこと。
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * REST の入口の門を、呼んでいる関数の名前から読む。
 *
 * 実装の中身ではなく名前で見ているので、**関数の中身が骨抜きになっても
 * ここは緑のまま**である。この検査が言えるのは「門を通す形になっている」
 * までで、「守られている」ではない。中身は各入口の単体テストが見る。
 */
function gateOfRoute(source: string): Gate {
  const code = codeOnly(source);
  if (/authenticate(Api)?Request\s*\(/.test(code)) return "鍵";
  if (/resolveIntegrationAccess\s*\(/.test(code)) return "鍵";
  if (/signedInActor\s*\(/.test(code)) return "ログイン";
  return "誰でも";
}

/**
 * 変更操作の門を、使っている身元の取り方から読む。
 *
 * `currentActor()` は解決できなければ見本の身元を返す＝**誰でも通る**。
 * `signedInActor()` は落ちない。`readerActor()` は読者そのもの＝誰でも。
 */
function gateOfActor(source: string): Gate {
  if (/\bsignedInActor\s*\(/.test(codeOnly(source))) return "ログイン";
  return "誰でも";
}

type Row = {
  readonly kind: "画面" | "REST" | "転送" | "操作";
  readonly id: string;
  readonly what: string;
  readonly intent: Gate;
  readonly actual: Gate;
  /** 変更操作だけに付く。入口（画面・REST）には無い。 */
  readonly reversible?: Reversible;
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
  "src/app/api/auth/[...all]/route.ts": {
    // ログインの入口そのもの。ここに門を置くと、誰もログインできない。
    // 「誰でも叩ける」のは意図どおりで、通してよい相手かの判定は
    // この先（`better-auth.ts` の名簿と担当者の登録）が行う。
    intent: "誰でも",
    what: "ログインの入口（Google との往復）",
  },
  "src/app/api/dev-signin/route.ts": {
    // 手元で画面を見るためだけの入口。**旗が 2 つ同時に立ったときしか存在しない**
    // （`DEV_SIGNIN_ENABLED=1` かつ積んだ環境でない、[[dev-signin]]）。
    // 積んだ環境では 404 を返すので、ここでの「誰でも」は
    // 「手元でだけ、誰でも」を指す。通行証は本番と同じ発行側が出すため、
    // 担当者の登録が無いアドレスはこの口を通っても入れない。
    intent: "誰でも",
    what: "手元で画面を確かめるための入口（積んだ環境には存在しない）",
  },
  "src/app/api/telemetry/route.ts": {
    intent: "誰でも",
    what: "読者の画面から届く計測（未ログインの読者が送るので、門は置けない）",
  },
  "src/app/go/[code]/route.ts": {
    intent: "誰でも",
    what: "成果リンクの転送（読者がクリックする先）",
  },
  // --- 機械向け配信（feat-blog-ui-builder §SEO/AI 検索）---
  // 検索エンジン・AI クローラーが読む配信ファイル。門を置くと
  // クローラーが読めず、置かないことが意図そのもの。
  "src/app/s/[site]/sitemap.xml/route.ts": {
    intent: "誰でも",
    what: "サイトマップ（公開記事の一覧を検索エンジン・AI へ配る）",
  },
  "src/app/s/[site]/robots.txt/route.ts": {
    intent: "誰でも",
    what: "クローラー方針（AI クローラーを明示許可し sitemap の場所を知らせる）",
  },
  "src/app/s/[site]/feed.xml/route.ts": {
    intent: "誰でも",
    what: "RSS（新着記事の配信）",
  },
  "src/app/s/[site]/llms.txt/route.ts": {
    intent: "誰でも",
    what: "llms.txt（AI 向けサイト要約。設計図の任意項目で出し分け）",
  },
  "src/app/indexnow.txt/route.ts": {
    intent: "誰でも",
    what: "IndexNow 鍵ファイル（公開配信が所有権証明の仕組みそのもの。鍵未設定なら 404）",
  },
};

/**
 * **取り返しがつくか。**
 *
 * 判定の物差しは公開・配信・失効・削除。外の世界（読者・ASP・提供元）へ
 * 出てしまうもの、または消えて元に戻せないものを「つかない」とする。
 * 記録が残っていて後から直せるもの（承認・状態の移動・数字の修正）は「つく」。
 *
 * **迷ったら「つかない」に倒す。** 取り返しがつくものを慎重に扱っても
 * 手間が増えるだけだが、逆は元に戻せない。
 */
type Reversible = "つく" | "つかない";

const ACTION_INTENT: Readonly<
  Record<string, { readonly intent: Gate; readonly what: string; readonly reversible: Reversible }>
> = {
  previewAffiliateUrlAction: {
    intent: "ログイン",
    what: "成果リンクを保存する前に、安全な接続先から取得できる情報だけを確認する（保存はしない）",
    reversible: "つく",
  },
  // --- 取り返しがつかない（公開・配信・失効・削除） ---
  publishArticleAction: { intent: "ログイン", what: "記事を公開する", reversible: "つかない" },
  saveSiteDocumentAction: {
    intent: "ログイン",
    what: "ブログの固定ページを書き換える（運営者情報・特定商取引法に基づく表記を含む）",
    // 書き換えると前の文は残らない。事業者の法的な表示がそのまま入れ替わる。
    reversible: "つかない",
  },
  schedulePublicationAction: {
    intent: "ログイン",
    what: "投稿を予定に入れる（時刻が来たら外へ出る）",
    reversible: "つかない",
  },
  registerBlueskyConnectionAction: {
    intent: "ログイン",
    what: "Blueskyへ実認証し、workspace共通の配信先DIDを固定する",
    reversible: "つかない",
  },
  reschedulePublicationAction: {
    intent: "ログイン",
    what: "投稿予定日を変える（前倒しにすれば今日出せる）",
    reversible: "つかない",
  },
  manageIntegrationAccessAction: {
    intent: "ログイン",
    what: "外部連携の鍵を作る・失効させる",
    reversible: "つかない",
  },
  manageLlmCredentialAction: {
    intent: "ログイン",
    what: "生成 AI の API キーを預ける・消す（預けた鍵で課金が発生する）",
    reversible: "つかない",
  },
  /**
   * 「つく」に見えて**つかない**。行は消えないが、外した人を画面から戻す道が無い
   * （外した行は役割を変えられず、同じアドレスへ招き直すと既にある行と当たる）。
   * 役割を変える操作も、変えた相手が持っていた承認の権限をその場で失わせる。
   */
  manageMemberAction: {
    intent: "ログイン",
    what: "担当者を招く・役割を変える・担当から外す（入ってよい人の一覧が変わる）",
    reversible: "つかない",
  },
  createSiteFromDraftAction: {
    intent: "ログイン",
    what: "下書きからサイトを作る（消す口が無い）",
    reversible: "つかない",
  },
  startLoopRunAction: {
    intent: "ログイン",
    what: "見せ方の比較を始める（2 通りが読者へ配られ始める）",
    reversible: "つかない",
  },
  advanceLoopRunAction: {
    intent: "ログイン",
    what: "比較に観測値を書く・判定する・打ち切る（判定は採用した見せ方を残す）",
    reversible: "つかない",
  },

  /*
    削除は 3 つとも取り返しがつかない。**記録の側も残らない**からである。
    段階を戻す・下書きへ落とすといった操作は、後から中身を見て直せるが、
    削除は「何が書いてあったか」を確かめる手段ごと消える。
    道具の側でも `requiresHumanApproval: true` にしてあり、
    鍵を持った外部の AI からは実行できない（画面で人が押すことでしか起きない）。
  */
  deleteManagedSiteAction: {
    intent: "ログイン",
    what: "ブログを消す（記事ごと消える）",
    reversible: "つかない",
  },
  deleteContentVariantAction: {
    intent: "ログイン",
    what: "記事を消す（本文を後から確かめる手段が残らない）",
    reversible: "つかない",
  },
  deleteProductAction: {
    intent: "ログイン",
    what: "商品を消す（順位表と比較表の入力が消える）",
    reversible: "つかない",
  },
  /*
    取りやめは削除と違い、記録そのものは残る。それでも「つかない」に入れてある。
    `src/domain/distribution/publication.ts` の遷移表で `CANCELLED: []` — **戻る先が無い**。
    予定へ戻すことも、そこから出すこともできない。もう一度出すには作り直すしかない。
    「消えない」と「戻せる」は別のことである。
  */
  cancelPublicationAction: {
    intent: "ログイン",
    what: "予定していた配信を取りやめる（取りやめた先は終点で、予定へは戻せない）",
    reversible: "つかない",
  },

  /*
    止めた日時は押し直せない。二度押しは domain（`disableAffiliateLink`）が断る。
    断らせている理由は、押すたびに日時が後ろへずれると
    「いつ読者に出なくなったか」が言えなくなるため。行は消えないが、
    **消えないことと戻せることは別**で、止めたものを読者へ戻す道は無い。
  */
  disableAffiliateLinkAction: {
    intent: "ログイン",
    what: "登録済みの成果リンクを止める（記事に貼ったままでも読者へ出なくなる。戻すには新しいリンクとして登録し直す）",
    reversible: "つかない",
  },

  // --- 取り返しがつく（記録が残り、後から直せる） ---
  archivePublishedArticleAction: {
    intent: "ログイン",
    what: "公開済み記事を非表示にする（データは残す）",
    reversible: "つく",
  },
  /*
    作成と更新は「つく」。作ったものは消せるし、直した内容は上書きで戻せる。
    ただし `updatePublicationAction` だけは別で、予定日を前倒しにすると
    今日外へ出るので、`reschedulePublicationAction` と同じ扱いにしてある。
  */
  updateManagedSiteAction: { intent: "ログイン", what: "ブログの設定を直す", reversible: "つく" },
  /*
    どちらも「つく」。見せ方と配色は選び直せば元に戻り、
    掲載台帳は運営が見る記録で、読者に出ている文を 1 文字も書き換えない。
    同じ `sites/[site]` の下でも `saveSiteDocumentAction`（法的表示）とは
    取り返しのつき方が正反対なので、並べて置いて対比が見えるようにする。
  */
  manageBlogAppearanceAction: {
    intent: "ログイン",
    what: "ブログの見せ方と配色を決める（ページ単位の例外を含む）",
    reversible: "つく",
  },
  manageBlogPlacementAction: {
    intent: "ログイン",
    what: "記事のどこに成果リンクを出しているかを台帳へ記録する・外す",
    reversible: "つく",
  },
  createContentVariantAction: { intent: "ログイン", what: "記事の枠を作る", reversible: "つく" },
  updateContentVariantAction: {
    intent: "ログイン",
    what: "記事の題名・本文・要約を直す",
    reversible: "つく",
  },
  createAuthorPersonaAction: {
    intent: "ログイン",
    what: "書き手（記事をどの立場・文体で書かせるか）を登録する",
    reversible: "つく",
  },
  createAudiencePersonaAction: {
    intent: "ログイン",
    what: "読者像（誰に向けて書くか・何を比べたいか）を登録する",
    reversible: "つく",
  },
  createContentPackageAction: {
    intent: "ログイン",
    what: "企画（どの商品を・誰が・誰に向けて・何のために書くか）を立てる",
    reversible: "つく",
  },
  createRankingModelAction: {
    intent: "ログイン",
    what: "順位づけの基準（何をどれだけ重く見るか・どう測るか）を立てる",
    reversible: "つく",
  },
  saveScoreCardAction: {
    intent: "ログイン",
    what: "決めた基準で測った商品 1 つの点と、その根拠を登録する",
    reversible: "つく",
  },
  /*
    ブランドと作業場所は、どちらも**画面の見た目を変えずに公開の可否を動かす**。
    ブランドの問い合わせ先を空にすると記事が公開できなくなり、
    作業場所の区分を下げると新しく作れなくなる。どちらも直後は何も起きないので、
    記録が無いと後から原因に辿り着けない。よって 2 つとも記録を残す。

    作業場所の区分を下げても、**上限を超えた分は消さない**。
    消す作りにすると、料金の欄を触っただけで記事の載っているブログが消える。
  */
  saveBrandAction: {
    intent: "ログイン",
    what: "読者から見た書き手（名前・問い合わせ先・文体）を 1 つ作る・直す",
    reversible: "つく",
  },
  updateWorkspaceAction: {
    intent: "ログイン",
    what: "作業場所の名前・契約の区分・時間帯・通貨を直す",
    reversible: "つく",
  },
  /*
    根拠・言えること・検証記録は 3 つとも「つく」。
    入れた直後の言えることは「確認待ち」で、確かめる人が承認するまで記事に出ない。
    つまり**間違えて入れても、外へは出ない**。
    根拠は後から下ろせるが、下ろすとそれに支えられていた言えることが
    まとめて根拠なしへ落ちる。落ちるだけで消えないので、付け直せる。
  */
  createEvidenceAction: {
    intent: "ログイン",
    what: "記事に書くことの出所になる資料を 1 つ登録する",
    reversible: "つく",
  },
  createClaimAction: {
    intent: "ログイン",
    what: "商品について記事に書ける 1 文と、その裏付けを登録する（確認待ちで入る）",
    reversible: "つく",
  },
  createTestRunAction: {
    intent: "ログイン",
    what: "いつ・誰が・どの方法で測ったかの記録を登録する",
    reversible: "つく",
  },
  createProductAction: { intent: "ログイン", what: "商品を登録する", reversible: "つく" },
  updateProductAction: { intent: "ログイン", what: "商品の内容を直す", reversible: "つく" },
  updatePublicationAction: {
    intent: "ログイン",
    what: "配信の予定を直す（前倒しにすれば今日出せる）",
    reversible: "つかない",
  },
  createConceptDraftsAction: {
    intent: "ログイン",
    what: "1 つの商品から、ブログごとの切り口で下書きをまとめて作る",
    reversible: "つく",
  },
  /*
    広告表記と表記のきまりは、どちらも「上書きで前の値へ戻せる」ので「つく」に置く。

    ただし**外へ出た後は戻らない**ことは書いておく。
    きまりを止めている間に公開した記事は、きまりを戻しても確認され直さない。
    その取り返しのつかなさは `publishArticleAction`（「つかない」）が引き受けている。
    ここで「つかない」にすると、公開の側の重さと二重に数えることになる。
  */
  editDisclosureAction: {
    intent: "ログイン",
    what: "広告であることの断り書きを登録・変更する（読者に出る文が変わる）",
    reversible: "つく",
  },
  editPolicyRuleAction: {
    intent: "ログイン",
    what: "表記のきまりを足す・止める・効かせ直す（止めている間は記事の表現が確認されない）",
    reversible: "つく",
  },
  /*
    見本帳のボタンにつなぐ、何もしない操作。

    何もしないのに門を通しているのは、**操作は画面と別に叩ける**からである。
    見本帳の画面自体はログインしないと開けないが、この操作の URL は
    画面を開かなくても呼べる。「中身が空だから素通しでよい」を一度認めると、
    次に中身が入ったときも素通しのまま残る。
  */
  sampleAction: { intent: "ログイン", what: "見本帳のボタンの見本（何もしない）", reversible: "つく" },
  adjustConversionAction: { intent: "ログイン", what: "成果の実績を手で直す", reversible: "つく" },
  /*
    提携の 2 語。**鍵そのものは通らない。** 通るのは保管先の名前だけで、
    値を入れる列も無い。止める・終了にするは行を消さないので、
    間違えても過去の成果の出どころは残る。
  */
  saveAffiliateAccountAction: {
    intent: "ログイン",
    what: "提携先（ASP のアカウント）を登録・変更する",
    reversible: "つく",
  },
  saveAffiliateProgramAction: {
    intent: "ログイン",
    what: "提携条件（広告主と報酬の決め方）を登録・変更する",
    reversible: "つく",
  },
  advanceContentStateAction: {
    intent: "ログイン",
    what: "記事の作業段階を進める",
    reversible: "つく",
  },
  approveContentAction: { intent: "ログイン", what: "記事を承認する", reversible: "つく" },
  checkFactBoundaryAction: {
    intent: "ログイン",
    what: "書ける範囲の判定を試す",
    reversible: "つく",
  },
  submitFeedbackAction: { intent: "ログイン", what: "指摘を登録する", reversible: "つく" },
  changeFeedbackStatusAction: { intent: "ログイン", what: "指摘の状態を変える", reversible: "つく" },
  // 印を付けても外せる（同じ場所に戻すボタンがある）ので「つく」。
  // 問い合わせの本文そのものは、この操作では消えない。
  markContactHandledAction: {
    intent: "ログイン",
    what: "読者からの問い合わせに対応済みの印を付ける・外す",
    reversible: "つく",
  },
  handOffFeedbackAction: { intent: "ログイン", what: "指摘を引き継ぐ", reversible: "つく" },
  submitAffiliateUrlAction: { intent: "ログイン", what: "成果リンクを登録する", reversible: "つく" },
  advanceLinkIngestionAction: {
    intent: "ログイン",
    what: "成果リンクの取り込みを進める",
    reversible: "つく",
  },
  // 試作の登録と承認は、それだけでは読者へ何も出ない（出るのは比較を始めた時点）。
  // 承認は仕様 §14.5 が人にだけ許している操作だが、**外へ出るかどうか**とは別の話なので、
  // ここでは「つく」に置く。外へ出るのは `startLoopRunAction` からである。
  draftVariantSpecAction: { intent: "ログイン", what: "見せ方の試作を登録する", reversible: "つく" },
  approveVariantSpecAction: {
    intent: "ログイン",
    what: "見せ方の試作を承認する（比較に出せる状態にする）",
    reversible: "つく",
  },
  startSiteDraftAction: { intent: "ログイン", what: "サイトの下書きを始める", reversible: "つく" },
  saveSiteDraftStepAction: {
    intent: "ログイン",
    what: "サイトの下書きを保存する",
    reversible: "つく",
  },
  submitContactAction: {
    intent: "誰でも",
    what: "読者からの問い合わせ（公開フォーム）",
    reversible: "つく",
  },
  updatePublishedArticleAction: {
    intent: "ログイン",
    what: "公開済み記事を訂正する",
    reversible: "つく",
  },
  // 読者が自分の「気になる」を出し入れするだけの 2 つ。ログインは求めない。
  // 触れるのは自分のブラウザの合言葉に紐づく行だけで、他人の一覧には届かない。
  saveToShortlistAction: {
    intent: "誰でも",
    what: "読者が自分の「気になる商品」へ 1 件保存する",
    reversible: "つく",
  },
  removeFromShortlistAction: {
    intent: "誰でも",
    what: "読者が自分の「気になる商品」から 1 件外す",
    reversible: "つく",
  },
  /*
    ブログ運用の 6 操作（feat-blog-ops-crud）。

    網・記事・固定ページは論理削除され、所有workspaceの削除済み一覧から同じID/URLまたは
    同じ種別へ元の内容で復元できるため「つく」。タグだけは旧内容を復元するUIが無い。
    版面（枠）と配信部品は並べ替えと切り替えだけで、消しても同じ枠をもう一度置ける。
  */
  manageSiteNetworkAction: {
    intent: "ログイン",
    what: "サイト網の枝を足す・直す・論理削除し、削除済み一覧から同じURLへ復元する",
    reversible: "つく",
  },
  manageBlogArticleAction: {
    intent: "ログイン",
    what: "記事を作る・直す・論理削除し、本文・タグ・評価ごと同じURLへ復元する",
    reversible: "つく",
  },
  manageBlogRatingAction: {
    intent: "ログイン",
    // **「消す」がここに無い。**票は行として残り、印だけが付け替わる。
    // だから取り消しが「つく」。消す口を作っていれば「つかない」になっていた。
    what: "読者が付けた評価を伏せる・戻す（票は消えず、平均と件数から外れるだけ）",
    reversible: "つく",
  },
  manageBlogTagAction: {
    intent: "ログイン",
    what: "タグを作る・直す・消す（消したタグの説明は残らない）",
    reversible: "つかない",
  },
  manageBlogLayoutAction: {
    intent: "ログイン",
    what: "版面の枠と帯を並べ替える・出し入れする",
    reversible: "つく",
  },
  manageBlogDeliveryAction: {
    intent: "ログイン",
    what: "配信部品を出し入れする",
    reversible: "つく",
  },
  /*
    点検は**読むだけに見えて、書く口である**（結果を履歴として積む）。
    読み取りと同じ扱いにすると、誰でも押せる口から表が伸び続ける。
  */
  checkBlogDeliveryAction: {
    intent: "ログイン",
    what: "配信物を組み立て直して、結果を履歴に積む",
    reversible: "つかない",
  },
  /*
    読者の評価。**門を置かない**のは、点を付けるのに名前も連絡先も要らないため
    （要求すると、点の分布が「登録した人の分布」に変わる）。

    「つく」なのは、同じ端末の目印で**上書き**されるからである。
    押し直せば前の点は残らず、票も増えない。記事の本文はこの口から触れない
    （`ArticleRatingPort` に記事を書く道が無い）。
  */
  submitReaderRatingAction: {
    intent: "誰でも",
    what: "記事に点を付ける（公開フォーム。押し直すと上書きされる）",
    reversible: "つく",
  },
  manageGuidelineReferenceAction: {
    intent: "ログイン",
    what: "SEO/AI 指針の出典を登録する・確認日を更新する（一覧に残り、後から直せる）",
    reversible: "つく",
  },
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
        // 門の適用範囲に入っている画面だけが「ログイン」になる。
        // 範囲の外は、門があっても誰でも通れる（そこは意図どおりのこともある）。
        actual: guardedByEntryGate(urlOfPage(id)) ? ("ログイン" as Gate) : ("誰でも" as Gate),
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

/**
 * `"use server"` のファイルを、**トップレベルの宣言ごとに切り分ける。**
 *
 * --- なぜ要るのか（2026-08-19 に実際に起きたこと） ---
 * 下の `scanActions()` は、**ファイル 1 枚につき 1 回**だけ門を読み、
 * その結果をそのファイルの全操作へ配っていた。だから
 * `feedback-action.ts` の `manageIntegrationAccessAction()` だけを直した日に、
 * 同じファイルに居るだけの `submitFeedbackAction()` /
 * `changeFeedbackStatusAction()` / `handOffFeedbackAction()` の 3 件まで
 * 「ログイン」へ変わった。実測では 16 件が 12 件になり、**直していない 3 件が
 * 黙って数から消えた。**
 *
 * 向きが最悪である。**1 つ直すと、隣の直していないものまで数から消える。**
 * 同じファイルに操作を足すほど、1 回の直しで消える件数が増える。
 *
 * --- 切り方 ---
 * 行頭の `function` / `const` を境目にする。波括弧の対応で切らないのは、
 * 引数や戻り値の型に `{` が出るためである（`Promise<{ readonly message: string }>`）。
 * そこを掴むと、本体ではなく**型注釈**を本体として読む。
 *
 * 境目から次の境目までなので、あいだに挟まる注釈は**次の宣言のものでも
 * 前の塊に入る。** 門の判定は `codeOnly()` を通してから見るので、
 * 注釈が混ざっても数には出ない。
 */
function topLevelChunks(source: string): { name: string; text: string }[] {
  const marks = [
    ...source.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const)\s+(\w+)/gm),
  ];
  return marks.map((m, i) => ({
    name: m[1] ?? "",
    text: source.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : source.length),
  }));
}

function scanActions(): Row[] {
  const rows: Row[] = [];
  for (const file of sourceFiles) {
    const source = read(file);
    if (!/^\s*["']use server["']/.test(source)) continue;
    const chunks = topLevelChunks(source);
    for (const match of source.matchAll(/^export async function (\w+)/gm)) {
      const name = match[1];
      const declared = ACTION_INTENT[name];
      // **その操作の中で**門を通しているかを見る。同じファイルに居るだけの
      // 隣の操作の門を借りない（借りると、1 つ直すたびに隣まで数から消える）。
      const chunk = chunks.find((c) => c.name === name);
      rows.push({
        kind: "操作",
        id: `${name}()`,
        what: `${declared?.what ?? "（宣言なし）"}（${rel(file)}）`,
        intent: declared?.intent ?? "ログイン",
        actual: gateOfActor(chunk?.text ?? ""),
        reversible: declared?.reversible ?? "つかない",
      });
    }
  }
  return rows.sort((a, b) => (a.id < b.id ? -1 : 1));
}

const rows = [...scanPages(), ...scanRoutes(), ...scanActions()];
const gaps = rows.filter((r) => r.intent !== r.actual);

function table(subset: readonly Row[], withReversible = false): string[] {
  const head = withReversible
    ? "| 入口・操作 | 何ができるか | 本来 | いま | 差 | 取り返し |"
    : "| 入口・操作 | 何ができるか | 本来 | いま | 差 |";
  return [
    head,
    withReversible ? "|---|---|---|---|---|---|" : "|---|---|---|---|---|",
    ...subset.map((r) => {
      const gap = r.intent === r.actual ? "—" : "**開いている**";
      const tail = withReversible
        ? ` | ${r.reversible === "つかない" ? "**つかない**" : "つく"} |`
        : " |";
      return `| \`${r.id}\` | ${r.what} | ${r.intent} | ${r.actual} | ${gap}${tail}`;
    }),
  ];
}

/**
 * **「誰でも」と宣言した行そのもの。**
 *
 * 意図は人が書くので、行を 1 つ「誰でも」にすれば、その扉は差の数から消える。
 * 今のところ正しく使われているが、**上限で詰まった人が最短路として選べる形**が
 * 残っている。だから「宣言すれば数えられなくなる」を、宣言した件数ごと数える。
 *
 * ここを増やすには上限を上げる diff が要り、上げた事実が記録に残る。
 */
const declaredPublic = rows.filter((r) => r.intent === "誰でも");

/** 走査が見つけた「変更を起こす入口」。**上限 0 を支える母集団**（下限 ④ の対象）。 */
const actionRows = rows.filter((r) => r.kind === "操作");

/** そのうち「取り返しがつかない」と印が付いているもの。守られているかは見ない。 */
const irreversibleMarked = actionRows.filter((r) => r.reversible === "つかない");

/** 誰でも実行できて、しかも取り返しがつかない操作。ここが一番危ない。 */
const irreversibleAndOpen = irreversibleMarked.filter((r) => r.intent !== r.actual);

function renderLedger(): string {
  const of = (kind: Row["kind"]) => rows.filter((r) => r.kind === kind);
  return [
    "# いま何が開いているか（入口の台帳）",
    "",
    "このファイルは `tests/architecture/open-doors.test.ts` が作る。手で書き換えない。",
    "更新は `UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts`。",
    "末尾の指紋がその見張りで、手で 1 文字でも書くと、内容が合っていてもテストが赤くなる。",
    "",
    "**「本来」は人が宣言した意図、「いま」はコードから測った実測**である。",
    "この 2 つが違う行が、いま誰でも通れてしまう扉。",
    "",
    `画面を一括で守る門: **${hasMiddleware ? `ある（\`${gateFile}\`）` : "無い"}**`,
    ...(hasMiddleware
      ? [
          "",
          `適用範囲: ${gateCoversAdmin ? "`/admin` 以下（読者のページとログインの往復は通す）" : "**測れませんでした**"}`,
        ]
      : []),
    "",
    `開いている扉: **${gaps.length} 件** / 全 ${rows.length} 件`,
    "",
    `「誰でも」と宣言してある行: **${declaredPublic.length} 件**`,
    "（宣言すればその扉は差の数から消える。だから宣言の件数そのものにも上限がある）",
    "",
    ...declaredPublic.map((r) => `- \`${r.id}\` — ${r.what}`),
    "",
    `うち、**誰でも実行できて取り返しがつかない操作: ${irreversibleAndOpen.length} 件**`,
    "（公開・配信・鍵の失効・削除。塞ぐ順を決めるときはここから読む）",
    "",
    ...irreversibleAndOpen.map((r) => `- \`${r.id}\` — ${r.what}`),
    "",
    "## この数字の読み方",
    "",
    `**この ${gaps.length} 件は「攻撃された」ではなく「守りが無い」である。**`,
    "",
    "危険の度合いは **「守りが無い」×「誰かが URL を知っている」** で決まる。",
    "いまこのアプリは本番で公開されておらず、URL を知っている人もいない。",
    "後者がまだ 0 に近いから、順番を組んで直せている。",
    "ここを読み違えると、一番大きい穴だけ慌てて塞いで、残りを忘れる。",
    "",
    "**逆に、本番へ公開する前にこの数字が 0 でなければ公開してはいけない。**",
    "公開の判断をする日にこの台帳を見る理由が、この 1 行である。",
    "その同じ回に `node scripts/llm-live-proof.mjs --stage P --check` も通す",
    "（自動の検査からは呼べないものなので、見る場面を人の手順として決めてある。",
    "決めた 2 つの場面は `docs/product/stub-ledger.md` に書いた）。",
    "",
    "**同じ回に、深い門（3 段）も 1 回打つ。** GitHub の Actions で「深い門」を選び",
    "`Run workflow`。2026-08-18 に定例（毎晩の自動実行）を廃止したので、",
    "**打たなければ一度も走らない**。公開の判断に要るものを 1 回で揃えるため、",
    "この台帳を見る回に含める。日を分けると「今日はどれを見る日か」を",
    "覚えている人が要ることになり、覚えている人が居なくなった日に静かに抜ける。",
    "打つ場面の全部は `docs/spec/11-CI-CD・品質ゲート仕様.md` §8-2。",
    "",
    `**2026-08-18 に、画面の入口へ門を置いた（\`${gateFile ?? "?"}\`）。**`,
    "見るのは「ログインしているか」だけで、役は見ない。通行証が無い・偽物・",
    "期限切れ・**保存先へ届かず確かめられない**のいずれでもログイン画面へ戻す。",
    "これで管理画面 32 枚が数から外れた。",
    "",
    "**ただし、変更を起こす操作はまだこの数に残っている。**",
    "操作は独立した URL を持たず、それを使っている画面への POST として届くので、",
    "実際には門の内側にある。しかし**どの操作がどの画面から呼ばれるか**は",
    "この検査では測れない。測れないものを「守られている」と書かない方に倒してある。",
    "操作の側が数から外れるのは、各操作が `signedInActor()` を使った日である。",
    "**2026-08-19 に、改善ループの 4 操作がそれを使った。**ここが最初の 4 件で、",
    "残りは同じ形へ直せば同じように外れる（上限は下げる方向にだけ動かす）。",
    "",
    "**2026-08-18 に、見本の身元から書き込みの役をすべて外した。**",
    "それまで「公開だけは通らない」と書いていたが、それは門が止めていたのではなく、",
    "見本に `publisher` と `owner` が無かっただけで、**役を 1 つ足した日に**",
    "**黙って通るようになる**状態だった。いま見本が持つのは `analyst`（読むだけ）で、",
    "記事の承認も、鍵の発行も、下書きの保存も通らない。",
    "**ここへ役を 1 つ足すと、その瞬間に「誰でもできること」が増える。**",
    "",
    "この検査が言えるのは「門を通す形になっている」ところまでで、",
    "「守られている」ではない。門の中身は各入口の単体テストが見る",
    "（入口の門は `tests/infrastructure/entry-gate.test.ts`）。",
    "",
    "## 画面",
    "",
    ...(hasMiddleware
      ? [
          "`/admin` 以下は門の内側にあり、通行証が無ければログイン画面へ戻る。",
          "門の外（読者のページ・ログイン画面）は誰でも開けるが、そこは意図どおりである。",
        ]
      : [
          "画面を一括で守る門が無いので、管理画面は URL を知っていれば誰でも開ける。",
          "`currentActor()` が身元を解決できないと**見本の身元**へ落ちるため、",
          "画面の中身も空にならず、実在するデータが表示される。",
        ]),
    "",
    ...table(of("画面")),
    "",
    "## REST・転送",
    "",
    ...table([...of("REST"), ...of("転送")]),
    "",
    "## 変更を起こす操作（`\"use server\"`）",
    "",
    "操作は独立した URL を持たず、それを使っている画面への POST として届く。",
    "管理画面の操作は門の内側にあるが、**その対応はこの検査では測れない**ので、",
    "ここでは守られていない側に数えてある（実際より危ない方に倒してある）。",
    "そこから先は権限で断られる。2026-08-18 に見本の身元を `analyst`（読むだけ）に",
    "したので、いまはここに並ぶ操作のうち書き込むものは通らない。",
    "**これは操作の側に門ができたということではない。** 見本へ役を 1 つ足せば元へ戻る。",
    "操作の側が数から外れるのは、各操作が `signedInActor()` を使った日である。",
    "**2026-08-19 に、改善ループの 4 操作がそれを使った。**ここが最初の 4 件で、",
    "残りは同じ形へ直せば同じように外れる（上限は下げる方向にだけ動かす）。",
    "",
    "「取り返し」の物差しは公開・配信・失効・削除。外の世界（読者・ASP・提供元）へ",
    "出てしまうもの、消えて元に戻せないものを「つかない」とする。**迷ったら「つかない」に倒す。**",
    "取り返しがつかない操作を先に頭出しにしてある。",
    "",
    ...table(
      [...of("操作")].sort((a, b) => {
        if (a.reversible !== b.reversible) return a.reversible === "つかない" ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      }),
      true,
    ),
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

  /**
   * 数える側が動いていることを、合成した見本で示す。
   *
   * 件数は「見つからなかった」でも小さくなる。測る側が壊れていても
   * 同じ小ささが出るので、**件数だけでは守りの数を主張できない**。
   * だから、見つかるはずの形と、見つかってはいけない形を 1 つずつ食わせる。
   *
   * 下の 2 件は 2026-08-19 に実際に抜けた形である（注釈に書いただけの門）。
   */
  it("門を呼んでいるファイルは「ログイン」と数えられる", () => {
    expect(gateOfActor(`const a = await signedInActor();`)).toBe("ログイン");
  });

  it("注釈に名前が出てくるだけのファイルは「ログイン」と数えない", () => {
    // ここが「ログイン」に戻ったら、説明を書き足すだけで扉が数から消える。
    expect(gateOfActor(`/** signedInActor() を使うこと。 */\nconst a = await currentActor();`)).toBe(
      "誰でも",
    );
  });

  it("行注釈に名前が出てくるだけのファイルも「ログイン」と数えない", () => {
    expect(gateOfActor(`// signedInActor() へ替える\nconst a = await currentActor();`)).toBe(
      "誰でも",
    );
  });

  /**
   * 1 枚のファイルに操作が 2 つあり、**片方だけ**が門を通している見本。
   *
   * 2026-08-19 に実際に抜けた形である。ファイル単位で門を読んでいたため、
   * 片方を直すと、直していないもう片方まで「ログイン」に数えられた。
   * 戻り値の型に波括弧を入れてあるのは、そこを本体と取り違える切り方
   * （最初の `{` から対応を取る）でも落ちるようにするため。
   */
  const TWO_ACTIONS = [
    '"use server";',
    "",
    "export async function guarded(): Promise<{ readonly message: string }> {",
    "  const a = await signedInActor();",
    "  return { message: String(a) };",
    "}",
    "",
    "export async function unguarded(): Promise<void> {",
    "  const a = await currentActor();",
    "  void a;",
    "}",
  ].join("\n");

  const chunkOf = (name: string) =>
    topLevelChunks(TWO_ACTIONS).find((c) => c.name === name)?.text ?? "";

  it("同じファイルに居るだけの操作は、隣の門を借りない", () => {
    expect(
      gateOfActor(chunkOf("unguarded")),
      "隣の操作の門を借りています。1 つ直すたびに、直していないものまで数から消えます",
    ).toBe("誰でも");
  });

  it("門を通している操作を取りこぼさない", () => {
    expect(
      gateOfActor(chunkOf("guarded")),
      "本物の門が読めていません。切り出しが本体ではなく型注釈を掴んでいないか確かめてください",
    ).toBe("ログイン");
  });

  it("REST の入口でも、注釈の名前を門と数えない", () => {
    expect(gateOfRoute(`/** signedInActor() で判定する。 */\nconst a = await currentActor();`)).toBe(
      "誰でも",
    );
  });

  it("開いている扉が増えていない", () => {
    expect(
      gaps.length,
      `開いている扉が ${gaps.length} 件（上限 ${OPEN_DOORS_MAX_UNGUARDED} 件）。` +
        "上限を上げて緑にしないでください。",
    ).toBeLessThanOrEqual(OPEN_DOORS_MAX_UNGUARDED);
  });

  it("誰でも実行できる取り返しのつかない操作が増えていない", () => {
    // 全体の件数だけを見ていると、減ったのが「下書きを保存する」でも
    // 数字は良くなる。危ないほうを別に数えないと、塞ぐ順を見誤る。
    expect(
      irreversibleAndOpen.length,
      `開いている取り返しのつかない操作: ${irreversibleAndOpen.map((r) => r.id).join(" / ")}` +
        `（上限 ${OPEN_DOORS_MAX_IRREVERSIBLE} 件）。上限を上げて緑にしないでください。`,
    ).toBeLessThanOrEqual(OPEN_DOORS_MAX_IRREVERSIBLE);
  });

  /**
   * **上限が 0 そのものであること。** 「0 以下」ではなく「0 と等しい」で見る。
   *
   * ここだけは正本の値をこの検査へ**写している**。ふだん写しは禁じているが、
   * この 1 か所は逆で、写していないと守れない。
   *
   * 上の 2 本は「数えた件数 ≤ 上限」なので、上限が 15 に戻されても
   * 実測が 0 件なら緑のままである。別のレーンの枝には 15 / 4 の頃の
   * `quality-gates.config.mjs` が居るので、統合のときに値だけが戻る道がある。
   * **戻ったことを知らせるものが、写し以外に無い。**
   *
   * 値の実測の履歴（`git log -p -- quality-gates.config.mjs` で数えた）:
   *   OPEN_DOORS_MAX_UNGUARDED     49 → 17 → 16 → 15 → 0
   *   OPEN_DOORS_MAX_IRREVERSIBLE            6 →  5 →  4 → 0
   * 途中の値はどれも予算だった（「n 件までは後回しにしてよい」と読める）。
   * 0 になって初めて規則になる。だから 0 だけは、下がったことではなく
   * **0 のままであること**を固定する。
   *
   * 減らす向き（0 のまま）にしか動かないので、この検査が正しく赤くなる変更は
   * 「上限を上げた」だけである。上げたくなったら、上げる前に止まって相談すること。
   */
  it("開いている入口の上限は、予算ではなく 0 という規則である", () => {
    expect(
      OPEN_DOORS_MAX_UNGUARDED,
      "開いている扉の上限が 0 から動きました。上の「増えていない」は上限との比較なので、" +
        "上限が戻ると実測 0 件のまま緑になります。戻した理由を確かめてください。",
    ).toBe(0);
    expect(
      OPEN_DOORS_MAX_IRREVERSIBLE,
      "取り返しのつかない操作の上限が 0 から動きました。こちらは 1 件でも外の世界へ出ます。",
    ).toBe(0);
  });

  /*
   * --- ここから 4 本で 1 組（②③④）。ばらして読まないこと ---
   *
   * 上の 2 本は上限 0 で、**悪くなる方向**を止める。以下の 2 本は下限で、
   * **母集団が痩せる方向**を止める。0 の上限に残る唯一の逃げ道は、塞ぐことではなく
   * **走査を狭めること**である（`"use server"` の判定を変える、切り出しを狭める、
   * 対象フォルダを外す。どれも「片付け」の顔をして通る）。
   * **向きが逆であることが仕掛けの本体**なので、揃えないこと。
   * 値の由来は `quality-gates.config.mjs` の doc を参照（台帳からは取っていない）。
   */
  it("変更を起こす入口の総数が減っていない", () => {
    expect(
      actionRows.length,
      `走査が見つけた変更操作が ${actionRows.length} 個です（下限 ${OPEN_DOORS_MIN_ACTIONS} 個）。` +
        "上の「開いている扉 0 件」は、扉を見つけられていないことによる 0 かもしれません。" +
        "走査（scanActions）が狭まっていないか先に見てください。",
    ).toBeGreaterThanOrEqual(OPEN_DOORS_MIN_ACTIONS);
  });

  it("「取り返しがつかない」と印が付いた操作が減っていない", () => {
    // 上限 0 のもう 1 つの逃げ道は、印そのものを外すこと。
    // 印は人が付ける（ACTION_INTENT の reversible）ので、外しても悪意の証拠が残らない。
    expect(
      irreversibleMarked.length,
      `取り返しがつかないと印が付いた操作が ${irreversibleMarked.length} 個です` +
        `（下限 ${OPEN_DOORS_MIN_IRREVERSIBLE_MARKED} 個）。` +
        "印を外して上限 0 を満たしていないか確かめてください。",
    ).toBeGreaterThanOrEqual(OPEN_DOORS_MIN_IRREVERSIBLE_MARKED);
  });

  /**
   * **件数ではなく名指しで見る。**
   *
   * 上の 2 本の上限は「何件あるか」を見ている。件数は母集団が縮んでも小さくなるので、
   * 0 件という結果だけからは「守られている」と「見つけていない」を区別できない。
   * こちらは**印が付いた操作を 1 つずつ引いて、門を通しているかを直接見る**。
   * 見つけられなかった操作は数から消えるのではなく、床（上の 2 本）で赤くなる。
   */
  it("取り返しがつかない操作は、1 つ残らず門を通している", () => {
    const naked = irreversibleMarked
      .filter((r) => r.actual !== "ログイン")
      .map((r) => `${r.id} — ${r.what}（本来 ${r.intent} / いま ${r.actual}）`);
    expect(
      naked,
      `取り返しがつかないのに門を通していない操作があります:\n${naked.join("\n")}\n` +
        "signedInActor() を通し、null のときは値を読む前に断ってください。",
    ).toEqual([]);
  });

  it("その 0 件は、名指しの側が動いた結果である", () => {
    /*
     * 上は 0 を主張する。**印が付いた操作が 1 つも無くても同じ 0 になる。**
     * 合成した行を 1 つ流して、名指しの側が実際に当てられることを見る。
     * （母集団が空でないことは、上の 2 本の床が別に見ている。）
     */
    const synthetic: Row = {
      kind: "操作",
      id: "合成例()",
      what: "門を通していない取り返しのつかない操作",
      intent: "ログイン",
      actual: "誰でも",
      reversible: "つかない",
    };
    const naked = [synthetic].filter(
      (r) => r.kind === "操作" && r.reversible === "つかない" && r.actual !== "ログイン",
    );
    expect(
      naked.length,
      "見つかるはずの合成例を名指しできませんでした。上の 0 件は信用できません。",
    ).toBe(1);
  });

  it("「誰でも」と宣言した行が増えていない", () => {
    // この一覧は人が手で書く。1 行足せば、その扉は差の数から黙って消える。
    // 上限で詰まったとき、いちばん短い道がこれになってしまうのを塞ぐ。
    expect(
      declaredPublic.length,
      `「誰でも」と宣言してある行が ${declaredPublic.length} 件` +
        `（上限 ${OPEN_DOORS_MAX_PUBLIC_BY_DECLARATION} 件）: ` +
        `${declaredPublic.map((r) => r.id).join(" / ")}。` +
        "扉を数から消すために宣言を足していないか確かめてください。",
    ).toBeLessThanOrEqual(OPEN_DOORS_MAX_PUBLIC_BY_DECLARATION);
  });

  it("門があるなら、その適用範囲も測れている", () => {
    // ファイルが在るだけで全画面が守られたことにしない。
    // `matcher` を狭めれば守りは黙って外れるので、範囲を別に測る。
    if (!hasMiddleware) return;
    expect(
      gateCoversAdmin,
      `${gateFile} に \`/admin\` を含む matcher と decideEntry() の呼び出しが見つかりません。` +
        "門はあるのに管理画面が範囲の外、という状態になっていないか確かめてください。",
    ).toBe(true);
  });

  /**
   * ログインしていないときの断り文の**出どころ**を 1 つに保つ。
   *
   * 扉を塞ぐと、塞いだ数だけ断り文が要る。そのとき最も短い道は、
   * 隣のファイルから文をコピーすることである。写した瞬間は同じ文なので
   * 何も壊れないが、次に文言を直す人は 1 か所しか直さない。
   * こうして**同じ断りなのに画面ごとに言うことが違う**状態が、静かにできる。
   *
   * 実際に 2 件そうなっていた（`llm-credential-action.ts` と
   * `manageIntegrationAccessAction`）。どちらも `notSignedInText()` を
   * 作る前に書かれたもので、悪意も手抜きも無い。だから検査で固定する。
   *
   * 向きに注意: これは**上限 0** で、悪くなる方向を止める道具である。
   * 断り文の言い回しを変えたくなったら `notSignedInText()` の中を直す。
   * ここを緩めて写しを許す方向へは動かさない。
   */
  const REFUSAL_PREFIX = "ログインしていないため、";
  const REFUSAL_SOURCE = "src/presentation/refusal-text.ts";
  const findHandWrittenRefusals = (files: readonly string[]): readonly string[] =>
    files.filter((f) => rel(f) !== REFUSAL_SOURCE && read(f).includes(`"${REFUSAL_PREFIX}`));

  /*
   * 床の値は、件数が分かってから張った（実測 2026-08-19: 走査対象 417 件 /
   * `notSignedInText()` を使っている側 11 件）。
   *
   * 350 と 8 にしたのは、通常の整理で走査対象が 67 件・出どころが 3 件も減ることは
   * まず無く、減っていたら「片付いた」より「集め方が壊れた」を先に疑うべきだからである。
   * 実測ちょうどに張ると、ファイルを 1 つ動かしただけで赤くなって
   * **床が狼少年になる**。狼少年になった床は、次に上げ下げされる。
   */
  const FLOOR_SCANNED = 350;
  const FLOOR_REFUSAL_USERS = 8;

  it("ログインしていないときの断り文を、手で写しているファイルが無い", () => {
    /*
     * expect が 3 つあるのは、**前が落ちたら後ろは意味を失う**順に並べているからである。
     * 「手で写したファイルが 0 件」は、走査対象が空でも、断り文を出す側が消えても、
     * 同じ 0 になる。0 の理由を 1 つに絞るために、母集団の床を先に置く。
     */
    expect(
      sourceFiles.length,
      `走査対象が ${sourceFiles.length} 件しかありません（床 ${FLOOR_SCANNED} 件）。` +
        "手で写したファイルの 0 件は、探していないことによる 0 かもしれません。",
    ).toBeGreaterThanOrEqual(FLOOR_SCANNED);

    const users = sourceFiles.filter((f) => read(f).includes("notSignedInText(")).length;
    expect(
      users,
      `${REFUSAL_SOURCE} の notSignedInText() を使っている側が ${users} 件しかありません` +
        `（床 ${FLOOR_REFUSAL_USERS} 件）。断り文そのものが消えていないか確かめてください。`,
    ).toBeGreaterThanOrEqual(FLOOR_REFUSAL_USERS);

    const written = findHandWrittenRefusals(sourceFiles).map(rel);
    expect(
      written.length,
      `断り文を手で書いているファイルが ${written.length} 件: ${written.join(" / ")}。` +
        `${REFUSAL_SOURCE} の notSignedInText() から取ってください。` +
        "同じ文を各所へ写すと、直すときに片方だけ古くなります。",
    ).toBe(0);
  });

  it("その 0 件は、見つける側が動いた結果である", () => {
    /*
     * 上の検査は 0 を主張する。0 は「本当に無い」ときと
     * 「探し方が壊れていて何も見つけられない」ときの**両方で出る**。
     * どちらなのかは 0 という数字からは分からない。
     *
     * そこで、見つかるはずのものを 1 つ用意して同じ探し方にかける。
     * ここが緑なら、上の 0 は「探した結果の 0」である。
     */
    const decoy = join(ROOT, "tests/architecture/open-doors.test.ts");
    expect(
      findHandWrittenRefusals([decoy]).length,
      "見つかるはずの合成例（このファイル自身）を見つけられませんでした。" +
        "探し方のほうが壊れています。上の 0 件は信用できません。",
    ).toBe(1);
  });

  it("台帳ファイルが実際の状態と一致していて、手で書かれていない", () => {
    expectLedgerFile(
      LEDGER_PATH,
      renderLedger(),
      process.env.UPDATE_OPEN_DOORS === "1",
      "入口の台帳が古くなっています。`UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts` で作り直してください。",
    );
  });
});
