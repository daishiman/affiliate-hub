#!/usr/bin/env node
/**
 * 同じ案件から出た成果物どうしが食い違っていないかを見る。
 *
 *   node .claude/plugins/affiliate-content-harness/scripts/validate-cross-media-consistency.mjs \
 *     --campaign campaign-brief.json [--article a.json ...] [--post p.json ...]
 *
 * --- 単体検品では絶対に出ない ---
 *
 * ブログ記事に「38kPa」、X 長文に「38kPa」、Instagram に「40kPa」と書いてある状態を
 * 考える。3 つとも、単体では何もおかしくない。根拠も付いているし、日付も形式も通る。
 * validate-blog-content も validate-media-post も、**1 つずつ見るかぎり全部 exit 0**。
 * 気づけるのは、2 つ以上を並べて読んだ人だけ。つまり読者だけ。
 *
 * --- 申告された分だけを確かめる ---
 *
 * 突き合わせる相手は、成果物が**自分で申告した主張**に限る。投稿は `claimRefs`、
 * 記事は各 claim の `sourceClaimId` で「案件のどの主張から来たか」を書く。
 * 記事の claim id は記事の中で採番されていて（記事の c1 が案件の c2 ということが起きる）、
 * id をそのまま突き合わせても紐づかない。だから id ではなく、案件を指す参照を持たせる。
 *
 * 申告に絞るのは、絞らないと**正しい原稿を弾く**からだ。案件が「壁から 68cm」と言い、
 * 記事が「机の奥行き 60cm」と書いたとき、単位だけを鍵に総当たりすると食い違い扱いになる。
 * cm・mm・分は文章に何度でも出る単位で、偶然の衝突が必ず起きる。正しい原稿を弾く検品は、
 * 書き手に無視されるようになり、本当の食い違いも一緒に素通りする。
 *
 * 絞った分の見落としは warn が拾う。どの成果物からも参照されていない fact は
 * 「測ったのにどこにも書いていない」として最後に出る。
 *
 * 判定は交差で見る。ある主張を参照している成果物について、その主張が持つ単位の数値が
 * 本文に 1 つも無ければ何も言わない（数字を出さずに定性的に運ぶのは許す）。同じ単位の
 * 数値があるのに案件の値が 1 つも含まれていなければ、そこで止める。
 */

import {
  argValue,
  argValues,
  checkFlags,
  createReport,
  readJson,
  readMediaProfiles,
  usage,
} from "./lib/harness.mjs";

const report = createReport();
const MEDIA = readMediaProfiles();

/**
 * 突き合わせる単位。
 *
 * 「3 年目」「2 万円台」のような、案件の主張と関係ない数値まで拾うと誤検知になるので、
 * 計測値として出てくる単位に絞る。単位を増やすときは、その単位が**案件の主張の中に
 * 現れうるか**で決める。文章の彩りとして出るだけの単位（人・回・年）は入れない。
 */
const UNITS = ["kPa", "cm", "mm", "kg", "g", "L", "W", "dB", "時間", "分", "秒", "か月", "度", "%"];
const UNIT = `(?:${UNITS.join("|")})`;
const NUMBER_WITH_UNIT = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT})`, "g");
/**
 * 「55〜60kg」のような範囲。左の数値には単位が付かないので、単純な数値＋単位の
 * 抽出だと 60 しか拾えず、55 と書いた成果物を食い違い扱いにしてしまう。
 * 幅を持たせた推測（kind: inference）は案件ブリーフに普通に出るので、ここは要る。
 */
const RANGE_WITH_UNIT = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*[〜～~–—-]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT})`, "g");

/** テキストから「単位 → 出てきた数値の集合」を作る。 */
function measurements(text) {
  const found = new Map();
  const add = (unit, value) => {
    if (!found.has(unit)) found.set(unit, new Set());
    found.get(unit).add(Number(value));
  };
  for (const [, lo, hi, unit] of text.matchAll(RANGE_WITH_UNIT)) {
    add(unit, lo);
    add(unit, hi);
  }
  for (const [, value, unit] of text.matchAll(NUMBER_WITH_UNIT)) add(unit, value);
  return found;
}

/** 成果物 1 件を、検査に使える形（見出し・本文・商品カードを平らにしたもの）へ均す。 */
function flatten(doc, path) {
  if (doc.medium !== undefined) {
    const label = MEDIA[doc.medium]?.label ?? doc.medium;
    return {
      path,
      label: `投稿 ${path}（${label}）`,
      medium: doc.medium,
      text: `${doc.title ?? ""}\n${doc.body ?? ""}`,
      cards: [],
      claimRefs: doc.claimRefs ?? [],
    };
  }

  const parts = [doc.title ?? "", doc.summary ?? ""];
  const refs = [...(doc.claimRefs ?? [])];
  for (const s of doc.sections ?? []) {
    parts.push(s.heading ?? "", ...(s.paragraphs ?? []));
    for (const c of s.claims ?? []) {
      parts.push(c.statement ?? "");
      if (c.sourceClaimId !== undefined) refs.push(c.sourceClaimId);
    }
  }
  // 会話部分も読者が読む本文である。ここを外すと、**会話にだけ書いた数字**が
  // 媒体間の突合をすり抜ける（記事「6dB」と投稿「9dB」が両立してしまう）。
  for (const line of doc.conversation ?? []) parts.push(line.text ?? "");
  for (const card of doc.productCards ?? []) {
    parts.push(card.oneLine ?? "");
    for (const spec of card.specs ?? []) parts.push(`${spec.label ?? ""} ${spec.value ?? ""}`);
  }
  return {
    path,
    label: `記事 ${path}`,
    medium: "blog",
    text: parts.join("\n"),
    cards: doc.productCards ?? [],
    claimRefs: refs,
  };
}

/**
 * 案件の主張 1 件を、**その主張を参照している成果物**と突き合わせる。
 *
 * 参照していない成果物は見ない。見ると、同じ単位の別の量（案件「壁から 68cm」と
 * 記事「机の奥行き 60cm」）を食い違い扱いにする。
 *
 * 単位ごとに交差を見る。交差が空のときだけ止める。「案件が言っていない数値が
 * 増えている」ことは咎めない（それは単体検品で根拠を問う話であって、横断の話ではない）。
 *
 * ただし交差だけだと、**同じ主張の中の一部だけがずれた**ときに素通りする。
 * 案件が「42dB から 36dB へ」と言い、成果物が「42dB から 34dB へ」と書いた場合、
 * 42 が合っているので交差は空にならない。前後の値を持つ主張では、売りになるのは
 * 後ろの値のほうなので、これを見逃すと一番ありそうな壊れ方が残る。
 * 運ばれなかった値は △ で出す。止めないのは、要約で片方だけ運ぶのが正当な書き方だから。
 */
function checkClaimAcross(claim, docs) {
  const expected = measurements(claim.statement ?? "");
  if (expected.size === 0) return { carried: false, referenced: false };

  const citing = docs.filter((d) => d.claimRefs.includes(claim.id));
  if (citing.length === 0) return { carried: false, referenced: false };

  let carried = false;

  for (const doc of citing) {
    const actual = measurements(doc.text);
    for (const [unit, values] of expected) {
      const seen = actual.get(unit);
      if (seen === undefined) continue;

      const shared = [...values].filter((v) => seen.has(v));
      if (shared.length > 0) {
        carried = true;
        const missing = [...values].filter((v) => !seen.has(v));
        if (missing.length > 0) {
          report.warn(
            doc.label,
            `案件では「${[...values].join(" / ")}${unit}」と言っている主張のうち、「${missing.join(" / ")}${unit}」がここにありません。`,
            `要約して片方だけ運んだのなら、このままで構いません。運んだつもりで数字を書き替えているなら、ここで気づいてください。前後の値を持つ主張（「${[...values][0]}${unit} から」）は、後ろの値のほうが読者の判断材料になります。`,
          );
        }
        continue;
      }
      report.fail(
        doc.label,
        `案件では「${[...values].join(" / ")}${unit}」と言っている主張が、ここでは「${[...seen].join(" / ")}${unit}」になっています。`,
        `どちらかが古い数字です。案件ブリーフの言い切り「${(claim.statement ?? "").slice(0, 28)}…」を直すか、この成果物を直すか、先に決めてください。片方だけ直すと、並べて読む人にだけ食い違いが見えます。`,
      );
    }
  }
  return { carried, referenced: true };
}

/**
 * 買う導線が成果物ごとにずれていないか。
 *
 * trackingCode がずれると、計測が 2 つに割れる。割れても画面は正常で、
 * どちらの数字も「少なめに出ている」ようにしか見えない。
 */
function checkOutboundAcross(brief, docs) {
  const master = new Map((brief.productCards ?? []).map((c) => [c.productId, c]));

  for (const doc of docs) {
    for (const card of doc.cards) {
      const source = master.get(card.productId);
      if (source === undefined) {
        report.warn(
          doc.label,
          `商品カード「${card.name}」（${card.productId}）が案件ブリーフにありません。`,
          "案件で決めていない導線です。案件へ足すか、この成果物から外してください。",
        );
        continue;
      }
      for (const key of ["trackingCode", "affiliateUrl"]) {
        if (card[key] !== undefined && card[key] !== source[key]) {
          report.fail(
            doc.label,
            `商品カード「${card.name}」の ${key} が案件ブリーフと違います（案件「${source[key]}」／ここ「${card[key]}」）。`,
            "導線は案件ブリーフで一度だけ決めます。ずれたままにすると計測が 2 つに割れ、どちらの数字も少なめに見えます。",
          );
        }
      }
    }
  }
}

/** 展開先として挙げた媒体に、実際の成果物があるか。 */
function checkCoverage(brief, docs) {
  const present = new Set(docs.map((d) => d.medium));
  for (const m of brief.media ?? []) {
    if (!present.has(m)) {
      report.warn(
        `案件 ${brief.campaignId}`,
        `展開先に挙げた「${MEDIA[m]?.label ?? m}」の成果物が渡されていません。`,
        "まだ書いていないなら、このままで構いません。書いたのに渡し忘れているなら、突き合わせは効いていません。",
      );
    }
  }
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
checkFlags(argv, ["--campaign", "--article", "--post"], "node validate-cross-media-consistency.mjs --campaign campaign-brief.json [--article a.json ...] [--post p.json ...]");
const campaignPath = argValue(argv, "--campaign");
if (campaignPath === undefined) {
  usage("node validate-cross-media-consistency.mjs --campaign campaign-brief.json [--article a.json ...] [--post p.json ...]");
}
const brief = readJson(campaignPath);

const docs = [
  ...argValues(argv, "--article").map((p) => flatten(readJson(p), p)),
  ...argValues(argv, "--post").map((p) => flatten(readJson(p), p)),
];

if (docs.length < 2) {
  console.log("突き合わせる相手がありません。--article と --post を合わせて 2 件以上渡してください。");
  console.log("\n0 件の食い違いを見ました。 止めるもの 0 件 / 気になるもの 0 件。");
  process.exit(0);
}

const unreferenced = [];
for (const claim of brief.claims ?? []) {
  const { referenced } = checkClaimAcross(claim, docs);
  if (claim.kind === "fact" && !referenced) unreferenced.push(claim);
}

/**
 * 参照が 1 件も無い fact をここで出す。
 *
 * 突き合わせを申告に絞った代わりに、申告漏れはここでしか見えない。
 * 記事は claim へ sourceClaimId を、投稿は claimRefs を書く。
 */
for (const claim of unreferenced) {
  report.warn(
    `案件 ${brief.campaignId}`,
    `測った主張「${(claim.statement ?? "").slice(0, 28)}…」を、どの成果物も参照していません。`,
    `根拠を付けて測ったのに、どこにも運ばれていない状態です。書かないなら案件から外し、書いているなら記事の claim へ sourceClaimId: "${claim.id}"、投稿へ claimRefs: ["${claim.id}"] を足してください。参照が無いと、この主張は突き合わせの対象になりません。`,
  );
}

/**
 * 成果物の側から見た申告漏れ。
 *
 * 案件の側（上の unreferenced）だけを見ると、ある主張を投稿が参照していれば
 * 記事の無申告が隠れる。すると記事の数値がずれても誰も見ない。
 * 2 方向から見ないと、同じ関係の片側が必ず抜ける。
 */
const factIds = new Set((brief.claims ?? []).filter((c) => c.kind === "fact").map((c) => c.id));
for (const doc of docs) {
  if (doc.claimRefs.some((id) => factIds.has(id))) continue;
  report.warn(
    doc.label,
    "案件の測った主張を 1 つも参照していないため、この成果物は突き合わせの対象になっていません。",
    "数値がずれていても、ここでは何も出ません。記事は claim へ sourceClaimId を、投稿は claimRefs を書いてください。案件と関係のない読み物なら、渡す必要がありません。",
  );
}

checkOutboundAcross(brief, docs);
checkCoverage(brief, docs);

report.finish(`${docs.length} 件の成果物を突き合わせました。`);
