#!/usr/bin/env node
/**
 * ブログ設計図と記事の入力を、公開前に機械で検品する。
 *
 *   node .claude/plugins/affiliate-content-harness/scripts/validate-blog-content.mjs \
 *     [--site site.json] [--article a.json ...] [--campaign campaign-brief.json] [--all]
 *
 * --- なぜ検品を人の目に任せないか ---
 *
 * この製品の表示は、入力の**組み合わせ**で分岐する。とくに次の 2 つは、
 * 画面を見ても間違いに気づけない:
 *
 *   1. 買う導線を出さない理由（blockedReason）は、affiliateUrl と trackingCode が
 *      **両方とも無いとき**にしか表示されない。URL を残したまま理由を書くと、
 *      理由は黙って消える。書いた本人は「書いた」と思っている。
 *   2. `tool` 型の記事は `/tools/<名前>` へ送られるが、その道は記事ではなく
 *      読者の道具を描く。つまり記事は**どこにも出ない**。
 *
 * どちらも「保存は成功し、画面は正常に見え、内容だけが欠ける」壊れ方をする。
 * 人の目視では見つからないので、ここで落とす。
 *
 * --- 使ってよい値の正本 ---
 *
 * ブログパターン・収益モデル・固定ページ・テーマの一覧は、このファイルに
 * 書き写さず `src/domain/authoring/site-blueprint.ts` から実行時に読む。
 * 書き写すと、コード側に選択肢を足した日にここだけ古くなり、
 * 「正しい入力を弾く検品」という最も質の悪い壊れ方になる。
 *
 * --- 案件ブリーフを渡したとき ---
 *
 * `--campaign` があると、記事が案件から**主張と導線を継いでいるか**まで見る。
 * ブログはこの harness で最初に書く媒体なので、ここで案件から外れると、
 * 後続の X・Instagram はブログを見て書き、外れたまま複製される。
 */

import {
  argValue,
  argValues,
  checkClaim,
  checkFlags,
  checkOutbound,
  checkWords,
  createReport,
  isDate,
  isSlug,
  readFactKinds,
  readJson,
  readSource,
  readStringArray,
  usage,
} from "./lib/harness.mjs";

// ---------------------------------------------------------------------------
// 使ってよい値を、コード側から読む
// ---------------------------------------------------------------------------

const BLUEPRINT_SRC = readSource("src/domain/authoring/site-blueprint.ts");

const SITE_PATTERNS = readStringArray(BLUEPRINT_SRC, "SITE_PATTERNS");
const REVENUE_MODELS = readStringArray(BLUEPRINT_SRC, "REVENUE_MODELS");
const STANDARD_PAGES = readStringArray(BLUEPRINT_SRC, "STANDARD_PAGES");
const BRAND_THEMES = readStringArray(BLUEPRINT_SRC, "BRAND_THEMES");
const COLOR_MODES = readStringArray(BLUEPRINT_SRC, "COLOR_MODES");

const RADIUS = ["none", "small", "medium", "large"];
const DENSITY = ["compact", "comfortable"];
const FACT_KINDS = readFactKinds();
const SPEAKERS = ["reader", "writer", "expert", "assistant"];
/** 記事として表示される型。`tool` を含めないのは冒頭の理由による。 */
const ARTICLE_TYPES = ["ranking", "review", "comparison", "guide"];
/** 差別化の軸。1 つでも空だと、既存ブログの言い換えになる。 */
const DIFFERENTIATION_AXES = [
  "targetReader",
  "searchIntent",
  "articlePurpose",
  "evaluationAxis",
  "usageScene",
  "uniqueExperience",
  "comparisonScope",
  "conclusionStance",
  "internalLinkStrategy",
  "ctaStrategy",
];

// ---------------------------------------------------------------------------
// 記録
// ---------------------------------------------------------------------------

const report = createReport();
const fail = report.fail;
const warn = report.warn;
const oneOf = (where, label, value, allowed) => report.oneOf(where, label, value, allowed);

// ---------------------------------------------------------------------------
// ブログ設計図
// ---------------------------------------------------------------------------

function checkSite(site, where) {
  for (const k of ["slug", "name", "purpose", "genre", "pattern", "revenueModel"]) {
    if (typeof site[k] !== "string" || site[k].trim() === "") {
      fail(where, `${k} が空です。`, "設計図の必須項目です。");
    }
  }
  if (!isSlug(site.slug)) {
    fail(where, `slug「${site.slug}」が使えません。`, "半角英小文字・数字・ハイフンだけで指定してください。");
  }
  oneOf(where, "pattern", site.pattern, SITE_PATTERNS);
  oneOf(where, "revenueModel", site.revenueModel, REVENUE_MODELS);

  for (const p of site.extraPages ?? []) {
    oneOf(where, "extraPages", p, STANDARD_PAGES);
  }

  const theme = site.theme ?? {};
  if (theme.brandTheme !== undefined) oneOf(where, "theme.brandTheme", theme.brandTheme, BRAND_THEMES);
  if (theme.colorScheme !== undefined) oneOf(where, "theme.colorScheme", theme.colorScheme, COLOR_MODES);
  if (theme.radius !== undefined) oneOf(where, "theme.radius", theme.radius, RADIUS);
  if (theme.density !== undefined) oneOf(where, "theme.density", theme.density, DENSITY);

  const categories = site.categories ?? [];
  if (categories.length === 0) {
    fail(where, "カテゴリーが 1 つもありません。", "読者の入口（タブ）が作れません。1 つ以上入れてください。");
  }
  const seen = new Set();
  for (const c of categories) {
    if (!isSlug(c.slug)) {
      fail(where, `カテゴリーの slug「${c.slug}」が使えません。`, "半角英小文字・数字・ハイフンだけです。");
    }
    if (seen.has(c.slug)) fail(where, `カテゴリー「${c.slug}」が重複しています。`, "1 つにまとめてください。");
    seen.add(c.slug);
    if (typeof c.name !== "string" || c.name.trim() === "") {
      fail(where, `カテゴリー「${c.slug}」に表示名がありません。`, "タブに出す言葉です。");
    }
    if (typeof c.oneLine !== "string" || c.oneLine.trim() === "") {
      fail(
        where,
        `カテゴリー「${c.slug}」の 1 文説明がありません。`,
        "カテゴリーページの冒頭にそのまま出ます。空だと見出しだけのページになります。",
      );
    }
  }

  const diff = site.differentiation ?? {};
  const empty = DIFFERENTIATION_AXES.filter(
    (k) => typeof diff[k] !== "string" || diff[k].trim() === "",
  );
  if (empty.length > 0) {
    fail(
      where,
      `差別化の軸が空です（${empty.join(" / ")}）。`,
      "ここを埋めずに書くと、既存ブログの言い換え記事になります。",
    );
  }
  return new Set(categories.map((c) => c.slug));
}

// ---------------------------------------------------------------------------
// 記事
// ---------------------------------------------------------------------------

function checkArticle(a, where, site, categorySlugs, allSlugs) {
  if (a.type === "tool") {
    fail(
      where,
      "type が「tool」の記事は、記事としてどこにも表示されません。",
      "/tools/<名前> は読者の道具（診断・計算）を描く道です。道具を作りたい場合は記事ではなく道具の定義を追加してください。",
    );
    return;
  }
  oneOf(where, "type", a.type, ARTICLE_TYPES);

  if (!isSlug(a.slug)) fail(where, `slug「${a.slug}」が使えません。`, "半角英小文字・数字・ハイフンだけです。");
  // 設計図を渡されていないなら、設計図と突き合わせる検査は**しない**。
  // 空の設計図と比べると「slug が undefined と違う」「あるのは（空）です」という、
  // 直しようのない指摘が出る。渡していないことは冒頭で △ として既に伝えてある。
  if (site !== undefined) {
    if (a.siteSlug !== site.slug) {
      fail(where, `siteSlug「${a.siteSlug}」が設計図の slug「${site.slug}」と違います。`, "同じ値にしてください。");
    }
    if (!categorySlugs.has(a.categorySlug)) {
      fail(
        where,
        `カテゴリー「${a.categorySlug}」は、このブログにありません。`,
        `あるのは ${[...categorySlugs].join(" / ")} です。カテゴリーを足すか、記事側を直してください。`,
      );
    }
  }
  for (const k of ["title", "summary"]) {
    if (typeof a[k] !== "string" || a[k].trim() === "") fail(where, `${k} が空です。`, "一覧とタブに出ます。");
  }
  if (!isDate(a.publishedAt)) fail(where, "publishedAt が YYYY-MM-DD ではありません。", "例: 2026-08-28");
  if (!isDate(a.updatedAt)) fail(where, "updatedAt が YYYY-MM-DD ではありません。", "例: 2026-08-28");

  checkPerson(a.author, `${where} の author`);
  if (a.reviewedBy !== undefined) checkPerson(a.reviewedBy, `${where} の reviewedBy`);

  checkSections(a, where);
  checkConversation(a, where);
  const hasOutbound = checkProductCards(a, where);
  checkRanking(a, where, allSlugs);
  checkComparison(a, where);
  checkGranularity(a, where, { fail, warn });

  if (hasOutbound && a.disclosureRequired !== true) {
    fail(
      where,
      "買う導線があるのに disclosureRequired が true ではありません。",
      "報酬の発生しうるリンクを置く記事には、広告表記を必ず出してください。",
    );
  }
  checkWords(report, a, where);
}

function checkPerson(p, where) {
  if (p === undefined || p === null) {
    fail(where, "書き手がいません。", "誰が書いたか分からない記事は出せません。");
    return;
  }
  if (!isSlug(p.slug)) fail(where, `slug「${p.slug}」が使えません。`, "半角英小文字・数字・ハイフンだけです。");
  if (typeof p.name !== "string" || p.name.trim() === "") fail(where, "名前が空です。", "");
  if (typeof p.bio !== "string" || p.bio.trim() === "") {
    fail(where, "bio が空です。", "何をしてきた人かを 1 段落で書いてください。");
  }
  if (!Array.isArray(p.credentials)) {
    fail(
      where,
      "credentials が配列ではありません。",
      "資格や経歴が無い場合は空配列 [] を入れてください。省略すると「無い」ことを隠したのか書き忘れたのか区別できません。",
    );
  }
}

function checkSections(a, where) {
  const sections = a.sections ?? [];
  if (sections.length === 0) {
    fail(where, "sections が空です。", "本文がありません。");
    return;
  }
  const ids = new Set();
  for (const s of sections) {
    const at = `${where} の節「${s.heading ?? s.id}」`;
    if (typeof s.id !== "string" || s.id === "") fail(at, "id が空です。", "節へのリンクに使います。");
    if (ids.has(s.id)) fail(at, `id「${s.id}」が重複しています。`, "節の id はページ内で一意にしてください。");
    ids.add(s.id);
    if (typeof s.heading !== "string" || s.heading.trim() === "") fail(at, "見出しが空です。", "");
    if (!Array.isArray(s.paragraphs) || s.paragraphs.length === 0) {
      fail(at, "本文が 1 段落もありません。", "見出しだけの節は読者にとって空です。");
    }
    for (const c of s.claims ?? []) {
      const cat = `${at} の言い切り「${(c.statement ?? "").slice(0, 20)}…」`;
      // 記事の claim id と案件の claim id が同じ形（c1, c2…）だと、
      // 番号がずれた瞬間に「投稿の claimRefs を記事側の番号で解決する」事故が起きる。
      // 機械は sourceClaimId で橋を架けているので安全だが、読む人と agent は名前で引く。
      // 形をぶつからなくして、取り違えを起こせなくする。
      if (typeof c.id === "string" && /^c\d+$/.test(c.id)) {
        fail(
          cat,
          `id「${c.id}」が案件の主張 id と同じ形です。`,
          `記事の主張には a1, a2… を使ってください。案件の主張を指すのは sourceClaimId だけです。同じ形だと、投稿の claimRefs（案件の番号）を記事側の番号で引いたときに、番号がずれていても静かに別の主張へ解決します。`,
        );
      }
      checkClaim(report, c, cat, FACT_KINDS);
    }
  }
}

function checkConversation(a, where) {
  for (const line of a.conversation ?? []) {
    const at = `${where} の会話`;
    oneOf(at, "speaker", line.speaker, SPEAKERS);
    const len = [...(line.text ?? "")].length;
    if (len < 40 || len > 120) {
      warn(
        at,
        `発言が ${len} 字です（「${(line.text ?? "").slice(0, 16)}…」）。`,
        "会話ブロックの 1 発言は 40〜120 字を目安にしています。短すぎると中身が無く、長すぎると会話に見えません。",
      );
    }
  }
}

/** @returns 買う導線を 1 つでも持っているか */
function checkProductCards(a, where) {
  let hasOutbound = false;
  for (const card of a.productCards ?? []) {
    const at = `${where} の商品カード「${card.name}」`;
    for (const k of ["productId", "name", "brand", "oneLine"]) {
      if (typeof card[k] !== "string" || card[k].trim() === "") fail(at, `${k} が空です。`, "");
    }
    if (!Array.isArray(card.specs) || card.specs.length === 0) {
      fail(at, "specs が空です。", "何も測っていない商品でも、項目だけは並べて value を null にしてください。");
    }
    for (const s of card.specs ?? []) {
      if (typeof s.label !== "string" || s.label.trim() === "") fail(at, "項目名が空です。", "");
      if (!("value" in s)) {
        fail(
          at,
          `項目「${s.label}」に value がありません。`,
          "測っていない項目は省略せず null を入れてください。省略すると商品ごとに並びが変わり、横に見比べられなくなります。",
        );
      } else if (s.value !== null && typeof s.value !== "string") {
        fail(at, `項目「${s.label}」の value は文字列か null です。`, "数値も単位つきの文字列で入れてください。");
      }
      oneOf(at, `項目「${s.label}」の kind`, s.kind, ["fact", "inference"]);
    }
    // 導線の判定は媒体投稿・案件ブリーフ・hook と共通（lib/harness.mjs）。
    // ここへ書き写すと、片方だけ直した日に「記事では通るが投稿では落ちる」状態になる。
    if (checkOutbound(report, card, at).linked) hasOutbound = true;
  }
  return hasOutbound;
}

function checkRanking(a, where, allSlugs) {
  if (a.type === "ranking" && a.ranking === undefined) {
    fail(where, "順位記事なのに ranking がありません。", "順位表の無い順位記事は、読者に何も答えていません。");
    return;
  }
  const r = a.ranking;
  if (r === undefined) return;
  const at = `${where} の順位表`;
  const criteria = r.criteria ?? [];
  if (criteria.length === 0) {
    fail(at, "評価基準がありません。", "何で並べたかを示さない順位は、読者から見て根拠がありません。");
  }
  const sum = criteria.reduce((acc, c) => acc + (c.weight ?? 0), 0);
  if (criteria.length > 0 && Math.abs(sum - 1) > 0.001) {
    fail(at, `評価基準の重みの合計が ${sum.toFixed(3)} です。`, "合計を 1 にしてください。");
  }
  for (const c of criteria) {
    if (typeof c.measurement !== "string" || c.measurement.trim() === "") {
      fail(at, `基準「${c.label ?? c.key}」に測り方がありません。`, "どう測ったかを書いてください。書けないなら基準にしないでください。");
    }
  }
  const entries = r.entries ?? [];
  if (entries.length === 0) fail(at, "順位に 1 件も入っていません。", "");
  entries.forEach((e, i) => {
    if (e.rank !== i + 1) fail(at, `${i + 1} 番目の rank が ${e.rank} です。`, "1 から連番で並べてください。");
    if ((e.criterionScores ?? []).length !== criteria.length) {
      fail(
        at,
        `「${e.productName}」の点数が ${(e.criterionScores ?? []).length} 個で、基準 ${criteria.length} 個と合いません。`,
        "基準と同じ数・同じ並びで入れてください。表の列とずれます。",
      );
    }
    if (e.reviewSlug !== undefined && !allSlugs.has(e.reviewSlug)) {
      // 記事を全部渡していない実行では、単に「今回渡していない記事」を指しているだけの
      // ことがある。それを止めると、1 本だけ直したいときに検品が使えなくなる。
      // 全部渡していると言い切れる（--all）ときだけ止める。
      (COMPLETE ? fail : warn)(
        at,
        `「${e.productName}」の reviewSlug「${e.reviewSlug}」に対応するレビュー記事が、今回の入力にありません。`,
        COMPLETE
          ? "存在しないページへ読者を送ります。レビューを書くか、reviewSlug を消してください（消すと商品名はリンクになりません）。"
          : "このブログの記事を全部渡して --all を付けると、実在するかどうかまで確かめます。",
      );
    }
    if ((e.oneLine ?? "").trim() === "") {
      fail(at, `「${e.productName}」に一言がありません。`, "順位だけでは、なぜその順なのかが読者に伝わりません。");
    }
  });
  for (const x of r.excluded ?? []) {
    if ((x.reason ?? "").trim() === "") {
      fail(at, `除外した「${x.productName}」に理由がありません。`, "理由の無い除外は、都合の悪い商品を隠したのと区別が付きません。");
    }
  }
}

function checkComparison(a, where) {
  if (a.type === "comparison" && a.comparison === undefined) {
    fail(where, "比較記事なのに comparison がありません。", "比較表の無い比較記事は、読者に何も答えていません。");
    return;
  }
  const c = a.comparison;
  if (c === undefined) return;
  const at = `${where} の比較表`;
  const columns = c.columns ?? [];
  if (columns.length === 0) fail(at, "列が 1 つもありません。", "");
  const keys = new Set(columns.map((x) => x.key));
  for (const row of c.rows ?? []) {
    for (const [key, cell] of Object.entries(row.cells ?? {})) {
      if (!keys.has(key)) {
        fail(at, `行「${row.label}」に、列に無い項目「${key}」があります。`, "その値はどこにも表示されません。");
        continue;
      }
      const col = columns.find((x) => x.key === key);
      if (col.numeric === true && !/^-?\d+(\.\d+)?$/.test(String(cell.value))) {
        warn(
          at,
          `行「${row.label}」の「${col.label}」が数値ではありません（${cell.value}）。`,
          "numeric の列は数だけを入れ、単位は列側の unit に書いてください。並べ替えができなくなります。",
        );
      }
      if (cell.kind !== undefined) oneOf(at, `行「${row.label}」の kind`, cell.kind, FACT_KINDS);
      if (cell.checkedAt !== undefined && !isDate(cell.checkedAt)) {
        fail(at, `行「${row.label}」の checkedAt が YYYY-MM-DD ではありません。`, "");
      }
    }
  }
}

/**
 * 記事の粒度（読みごたえ）が足りているかを見る。
 *
 * 参考にしているブログの記事は、見出しだけ揃っていて中身が薄い記事とは
 * はっきり違う。その差を機械で見分けるための規則を、ここに入れる。
 *
 * fail と warn の線引き:
 *   - warn = 書き足せば直るもの（字数・セクション数・主張の本数）。
 *     ここを fail にすると、途中まで書いて保存する使い方ができなくなり、
 *     結果として誰も検品を通さなくなる。
 *   - fail = 記事の性質そのものが違うもの（主張が 1 つも無い、
 *     測った事実が 1 つも無い、比較表なのに並べ替えられない）。
 *     書き足しでは直らず、書き直しになる。
 *
 * 基準の出どころは references/granularity.md。数を変えるときは両方直す。
 */

/** 足りていない、と言い始める最低ライン。目安ではなく下限。 */
const MIN = {
  sections: 3,
  bodyChars: 1200,
  paragraphChars: 60,
  summaryChars: 30,
  claims: 3,
  factRatio: 1 / 3,
  criteria: 3,
  entries: 3,
  columns: 3,
  rows: 2,
};

/** 短所に触れている見出しか。無いレビューは、読者から見て広告と区別が付かない。 */
const DOWNSIDE_HEADING = /向いていない|向かない|合わない|短所|弱点|欠点|おすすめしない|注意/;
/** 読者に手を動かさせる見出しか。手引きはここが無いと読み物で終わる。 */
const ACTIONABLE_HEADING = /測る|測り方|確かめ|調べ|チェック|準備|手順/;

function checkGranularity(a, where, report) {
  const sections = Array.isArray(a.sections) ? a.sections : [];

  if (sections.length < MIN.sections) {
    report.warn(
      where,
      `セクションが ${sections.length} つしかありません（最低 ${MIN.sections} つ）。`,
      "結論・どう比べたか・選び方 は、それぞれ別の見出しに分けてください。1 つにまとめると、読者が読みたいところへ飛べません。",
    );
  }

  // 本文の量。見出しは数えない（見出しだけ並べて量を装えないようにする）。
  const paragraphs = sections.flatMap((s) => (Array.isArray(s.paragraphs) ? s.paragraphs : []));
  const bodyChars = paragraphs.reduce((n, p) => n + (typeof p === "string" ? p.trim().length : 0), 0);
  if (bodyChars < MIN.bodyChars) {
    report.warn(
      where,
      `本文が ${bodyChars} 字しかありません（最低 ${MIN.bodyChars} 字）。`,
      "この長さでは、読者が買うかどうかを決められません。測った状況・条件・外した選択肢を足してください。",
    );
  }

  const thin = paragraphs.filter((p) => typeof p === "string" && p.trim().length < MIN.paragraphChars);
  if (thin.length > 0) {
    report.warn(
      where,
      `${MIN.paragraphChars} 字に満たない段落が ${thin.length} つあります（例:「${thin[0].trim()}」）。`,
      "1 文で終わる段落は、箇条書きにするか、前後の段落に混ぜてください。",
    );
  }

  const emptySections = sections.filter((s) => !Array.isArray(s.paragraphs) || s.paragraphs.length === 0);
  if (emptySections.length > 0) {
    report.warn(
      where,
      `本文の無い見出しが ${emptySections.length} つあります（例:「${emptySections[0].heading}」）。`,
      "見出しにする理由が無いなら、見出しを消してください。",
    );
  }

  if (typeof a.summary === "string" && a.summary.trim().length < MIN.summaryChars) {
    report.warn(
      where,
      `summary が ${a.summary.trim().length} 字しかありません（最低 ${MIN.summaryChars} 字）。`,
      "一覧に出る唯一の説明です。何を測って何が分かったかを入れてください。",
    );
  }

  // 主張の本数と、そのうち「測った事実」の割合。
  const claims = sections.flatMap((s) => (Array.isArray(s.claims) ? s.claims : []));
  const facts = claims.filter((c) => c !== null && typeof c === "object" && c.kind === "fact");
  if (claims.length === 0) {
    report.fail(
      where,
      "主張（claims）が 1 つもありません。",
      "本文の中で言い切っている箇所を claims に切り出し、fact / inference / opinion のどれかを付けてください。切り出せる主張が無いなら、その記事はまだ何も言っていません。",
    );
  } else {
    if (claims.length < MIN.claims) {
      report.warn(
        where,
        `主張が ${claims.length} 件しかありません（最低 ${MIN.claims} 件）。`,
        "読者が判断に使えるのは、印の付いた主張だけです。本文から切り出してください。",
      );
    }
    if (facts.length === 0) {
      report.fail(
        where,
        "測った・確かめた主張（kind: fact）が 1 つもありません。",
        "推測と意見だけの記事は感想文です。1 つでも自分で確かめたことを、根拠付きで入れてください。",
      );
    } else if (facts.length / claims.length < MIN.factRatio) {
      report.warn(
        where,
        `主張 ${claims.length} 件のうち fact は ${facts.length} 件です（3 件に 1 件は欲しい）。`,
        "「〜と考えられます」が大半なら、その結論は測っていないということです。測れる項目を 1 つ選んで確かめてください。",
      );
    }
  }

  checkGranularityByType(a, where, report, sections);
}

/** 型ごとに、その型を名乗る以上は要るもの。 */
function checkGranularityByType(a, where, report, sections) {
  const headings = sections.map((s) => (typeof s.heading === "string" ? s.heading : "")).join("\n");

  if (a.type === "ranking") {
    const r = a.ranking ?? {};
    const criteria = Array.isArray(r.criteria) ? r.criteria : [];
    const entries = Array.isArray(r.entries) ? r.entries : [];
    if (criteria.length < MIN.criteria) {
      report.warn(
        where,
        `評価基準が ${criteria.length} 個しかありません（最低 ${MIN.criteria} 個）。`,
        "基準が 1〜2 個の順位は、その基準の測定結果を並べただけです。価格や調整範囲など、読者が実際に迷う軸を足してください。",
      );
    }
    if (entries.length < MIN.entries) {
      report.warn(
        where,
        `順位に並んでいるのが ${entries.length} 件しかありません（最低 ${MIN.entries} 件）。`,
        "2 件は順位ではなく比較です。type を comparison にするか、候補を足してください。",
      );
    }
    const noOneLine = entries.filter((e) => typeof e?.oneLine !== "string" || e.oneLine.trim() === "");
    if (noOneLine.length > 0) {
      report.warn(
        where,
        `oneLine の無い順位が ${noOneLine.length} 件あります。`,
        "点数だけ見せられても、読者はなぜその順位なのか分かりません。1 行で理由を書いてください。",
      );
    }
  }

  if (a.type === "review" && !DOWNSIDE_HEADING.test(headings)) {
    report.warn(
      where,
      "短所や向いていない人に触れた見出しがありません。",
      "良かった点しか無いレビューは、読者から見て広告と区別が付きません。「向いていない人」の見出しを足してください。",
    );
  }

  if (a.type === "comparison") {
    const c = a.comparison ?? {};
    const columns = Array.isArray(c.columns) ? c.columns : [];
    const rows = Array.isArray(c.rows) ? c.rows : [];
    if (columns.length < MIN.columns) {
      report.warn(
        where,
        `比較の列が ${columns.length} 個しかありません（最低 ${MIN.columns} 個）。`,
        "1〜2 列の表は、本文で書けば足ります。読者が迷う軸を足してください。",
      );
    }
    if (!columns.some((col) => col?.numeric === true)) {
      report.fail(
        where,
        "並べ替えられる列（numeric: true）が 1 つもありません。",
        "数で比べられない比較表は、読者が自分の優先順で並べ直せません。測った値の列を 1 つ以上 numeric にしてください。",
      );
    }
    if (rows.length < MIN.rows) {
      report.fail(
        where,
        `比較する行が ${rows.length} 件しかありません。`,
        "比べる相手がいない比較記事は成立しません。type を review にするか、相手を足してください。",
      );
    }
  }

  if (a.type === "guide" && !ACTIONABLE_HEADING.test(headings)) {
    report.warn(
      where,
      "読者が手を動かす見出し（測る・確かめる・準備する）がありません。",
      "決め方だけ読ませて終わると、読者は何も決められません。買う前に測る寸法や確かめることを 1 つの見出しにまとめてください。",
    );
  }
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

/**
 * 案件ブリーフから継いでいるかを見る。
 *
 * ブログはこの harness で最初に書く媒体で、後続の X・Instagram はブログを見て書く。
 * ここで案件から外れると、外れたまま 5 媒体へ複製される。**上流ほど強く見る。**
 *
 * 数値の食い違いは validate-cross-media-consistency、広告表記は
 * validate-affiliate-disclosure が見る。ここは「どの商品を扱っているか」だけ。
 */
function checkCampaignInheritance(brief, campaignPath, site, sitePath, articles) {
  const where = `案件ブリーフ ${campaignPath}`;

  if (site !== undefined && site.slug !== brief.siteSlug) {
    fail(
      where,
      `siteSlug「${brief.siteSlug}」が設計図 ${sitePath} の slug「${site.slug}」と違います。`,
      "別のブログの案件を当てています。どちらかを直してください。",
    );
  }
  for (const { path, data } of articles) {
    if (data.siteSlug !== brief.siteSlug) {
      fail(
        `記事 ${path}`,
        `siteSlug「${data.siteSlug}」が案件ブリーフの「${brief.siteSlug}」と違います。`,
        "この記事は案件の対象ブログに載りません。",
      );
    }
  }

  const inBrief = new Set((brief.productCards ?? []).map((c) => c.productId));
  const inArticles = new Set();
  for (const { path, data } of articles) {
    for (const card of data.productCards ?? []) {
      inArticles.add(card.productId);
      if (!inBrief.has(card.productId)) {
        warn(
          `記事 ${path}`,
          `商品「${card.name}」（${card.productId}）が案件ブリーフにありません。`,
          "案件で決めていない商品です。比較のために並べているだけなら構いませんが、買う導線を付けるなら案件へ足してください。",
        );
      }
    }
  }
  for (const id of inBrief) {
    if (!inArticles.has(id)) {
      warn(
        where,
        `案件の商品「${id}」が、渡された記事のどこにも出ていません。`,
        "まだ書いていないなら、このままで構いません。他媒体だけに出す商品なら、リンクの置けない媒体の行き先が無くなります。",
      );
    }
  }
}

const argv = process.argv.slice(2);
checkFlags(argv, ["--site", "--article", "--campaign", "--all"], "node validate-blog-content.mjs [--site site.json] [--article a.json ...] [--campaign campaign-brief.json] [--all]");
/** そのブログの記事を全部渡しているか。リンク先の実在まで確かめるかがこれで変わる。 */
const COMPLETE = argv.includes("--all");

const sitePath = argValue(argv, "--site");
const articlePaths = argValues(argv, "--article");
const campaignPath = argValue(argv, "--campaign");

if (sitePath === undefined && articlePaths.length === 0) {
  usage("node validate-blog-content.mjs [--site site.json] [--article a.json ...] [--campaign campaign-brief.json] [--all]");
}

let site;
let categorySlugs = new Set();
if (sitePath !== undefined) {
  site = readJson(sitePath);
  categorySlugs = checkSite(site, `設計図 ${sitePath}`);
} else if (articlePaths.length > 0) {
  warn(
    "記事全体",
    "--site が渡されていません。",
    "分類や固定ページとの噛み合わせは見ていません。記事単体の形だけを見ました。公開前には設計図も一緒に渡してください。",
  );
}

const articles = articlePaths.map((p) => ({ path: p, data: readJson(p) }));
const allSlugs = new Set(articles.map((x) => x.data.slug));
if (allSlugs.size !== articles.length) {
  fail("記事全体", "同じ slug の記事が 2 本以上あります。", "1 本目が 2 本目に隠れます。slug を分けてください。");
}
for (const { path, data } of articles) {
  checkArticle(data, `記事 ${path}`, site, categorySlugs, allSlugs);
}

if (campaignPath !== undefined) {
  checkCampaignInheritance(readJson(campaignPath), campaignPath, site, sitePath, articles);
}

report.finish(
  `${articles.length} 本の記事と設計図 ${sitePath === undefined ? 0 : 1} 件を見ました。`,
);
