/**
 * 検品スクリプト 5 本が共有する土台。
 *
 * --- なぜ 1 箇所にまとめるか ---
 *
 * 「日付は YYYY-MM-DD」「slug は英小文字と数字とハイフン」「fact には根拠が要る」は、
 * 記事にも案件ブリーフにも媒体投稿にも同じように要る。各スクリプトへ書き写すと、
 * 片方だけ直した日に**通る入力と落ちる入力が食い違う**。書き手から見ると
 * 「同じものを別の場所へ入れたら怒られた」という、理由の見えない壊れ方になる。
 *
 * --- 使ってよい値の正本 ---
 *
 * 列挙値はここに書き写さず `src/` から実行時に読む。書き写すと、コード側に
 * 選択肢を足した日にここだけ古くなり、「正しい入力を弾く検品」という
 * 最も質の悪い壊れ方になる。
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** `.claude/plugins/<slug>/scripts/lib/` から数えたリポジトリの根。 */
export const REPO_ROOT = resolve(HERE, "../../../../..");
/** このプラグインの根。references/ を読むときに使う。 */
export const PLUGIN_ROOT = resolve(HERE, "../..");

// ---------------------------------------------------------------------------
// コード側から読む
// ---------------------------------------------------------------------------

/**
 * `const NAME = [...];` の中身を取り出す。
 * `export` と `as const` は付いていてもいなくてもよい（コード側の書き方は
 * ファイルによって違い、外に出さない内部定数もここから読む必要があるため）。
 */
export function readStringArray(source, name) {
  const m = source.match(new RegExp(`(?:export )?const ${name} = \\[([\\s\\S]*?)\\](?: as const)?;`));
  if (m === null) {
    throw new Error(`${name} を読み取れませんでした（コード側の書き方が変わった可能性があります）。`);
  }
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

export function readSource(relativePath) {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

/**
 * 記事の言い切りに付ける印。正本は `src/application/read-models/published-article.ts` の
 * `FactKind`。ここは union 型なので配列の書き方と違い、型宣言から拾う。
 */
export function readFactKinds() {
  const src = readSource("src/application/read-models/published-article.ts");
  const m = src.match(/export type FactKind =([^;]+);/);
  if (m === null) throw new Error("FactKind を読み取れませんでした（コード側の書き方が変わった可能性があります）。");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** 媒体ごとの規則。生成側と検品側が同じファイルを読む。 */
export function readMediaProfiles() {
  const raw = JSON.parse(readFileSync(resolve(PLUGIN_ROOT, "references/media-profiles.json"), "utf8"));
  return raw.media;
}

/**
 * 全媒体に共通の語彙（煽り語・装飾記号）。媒体ごとの profile とは別に置いてある。
 * 固定の文字列を探すだけの仕事なので、agent ではなくここで見る。
 * リストに**無い**煽り・装飾は apply-style-genome が拾う（そちらは判断が要る）。
 */
export function readSharedVocabulary() {
  const raw = JSON.parse(readFileSync(resolve(PLUGIN_ROOT, "references/media-profiles.json"), "utf8"));
  return { hypeWords: raw.hypeWords ?? [], decorationMarks: raw.decorationMarks ?? [] };
}

// ---------------------------------------------------------------------------
// 記録
// ---------------------------------------------------------------------------

/**
 * 止めるもの（problems）と気になるもの（warnings）を分けて溜める。
 *
 * 線引きは一貫させてある。**書き足せば直るものは warn、書き直しになるものは fail。**
 * 書き足しで直るものを fail にすると、途中まで書いて保存する使い方ができなくなり、
 * 結果として誰も検品を通さなくなる。
 */
export function createReport() {
  const problems = [];
  const warnings = [];

  const report = {
    problems,
    warnings,
    fail: (where, message, how) => problems.push({ where, message, how }),
    warn: (where, message, how) => warnings.push({ where, message, how }),
    oneOf(where, label, value, allowed) {
      if (!allowed.includes(value)) {
        report.fail(where, `${label} の値「${value}」は使えません。`, `使えるのは ${allowed.join(" / ")} です。`);
        return false;
      }
      return true;
    },
    required(where, object, keys, how = "") {
      for (const k of keys) {
        if (typeof object?.[k] !== "string" || object[k].trim() === "") {
          report.fail(where, `${k} が空です。`, how);
        }
      }
    },
    /** 終了コードまで面倒を見る。全スクリプトの出し方をここで揃える。 */
    finish(summary) {
      for (const w of warnings) {
        console.log(`△ ${w.where}\n  ${w.message}${w.how ? `\n  → ${w.how}` : ""}`);
      }
      for (const p of problems) {
        console.log(`× ${p.where}\n  ${p.message}${p.how ? `\n  → ${p.how}` : ""}`);
      }
      console.log(`\n${summary} 止めるもの ${problems.length} 件 / 気になるもの ${warnings.length} 件。`);
      process.exit(problems.length > 0 ? 1 : 0);
    },
  };
  return report;
}

export const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isSlug = (v) => typeof v === "string" && /^[a-z0-9-]+$/.test(v);
export const countChars = (v) => [...(typeof v === "string" ? v : "")].length;

/**
 * 本文から定型（広告表記の行・URL・ハッシュタグだけの行）を落としたもの。
 *
 * **上限と下限は違うものを守っている。**
 * 上限はプラットフォームの物理制限なので、定型も数に入るのが正しい。
 * 下限は「読者が読む中身がこれだけあるか」の担保なので、定型を数に入れると
 * **媒体をまたいだ瞬間に、同じ数字が違う量を意味する。**
 *
 * 実測（2026-08-29・全 7 成果物）:
 *
 *   Instagram  下限 300 / 定型 19 字 → 中身 281 字を要求
 *   X 短文     下限 120 / 定型 67 字 → 中身  53 字を要求
 *
 * 定型の長さは媒体の規則（リンクを置けるか・広告表記を本文に書くか）で決まるので、
 * 全体で数えるかぎりこのずれは自動的に生まれる。字数は「中身の量」の代理指標であり、
 * 代理を条件文に置いたまま正本とずれると誰も気づかない。
 *
 * **落とせるのは行として独立している定型だけ。** 広告表記が文の途中に埋まっていると
 * 落ちない。そこは検品ではなく、書き手と `run-social-post`（`disclosureStyle` の 3 値で
 * 置き方を決めている側）の仕事。
 */
export function substantiveChars(post) {
  const body = typeof post.body === "string" ? post.body : "";
  const disclosure = typeof post.disclosure === "string" ? post.disclosure.trim() : "";
  let s = body;
  if (disclosure !== "") s = s.split("\n").filter((l) => l.trim() !== disclosure).join("\n");
  s = s.replace(/https?:\/\/\S+/g, "");
  s = s.split("\n").filter((l) => !/^\s*(#\S+\s*)+$/.test(l)).join("\n");
  return countChars(s.trim());
}

/**
 * 読めなければ 2 で終わる。
 *
 * 1（検品で落ちた）と 2（そもそも読めなかった）を分けるのは、呼ぶ側が
 * 「直せば通る」のか「渡すファイルを間違えた」のかを見分けられるようにするため。
 */
export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`× ${path} を読めませんでした: ${e.message}`);
    process.exit(2);
  }
}

export function usage(line) {
  console.error(`使い方: ${line}`);
  process.exit(2);
}

/** `--article a.json --article b.json` のような繰り返し可能な引数を集める。 */
export function argValues(argv, flag) {
  const values = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1] !== undefined) values.push(argv[i + 1]);
  }
  return values;
}

export function argValue(argv, flag) {
  return argValues(argv, flag)[0];
}

/**
 * 知らないフラグが来たら止める。
 *
 * 検品スクリプトは「渡されたものを見る」形なので、フラグ名を打ち間違えると
 * **何も渡されなかった状態と区別がつかない**。`--posts` と書いた横断検品が
 * 「0 件の食い違いを見ました」と exit 0 を返したのが実例で、
 * 出力だけ見ると全通過にしか読めない。
 *
 * 件数が足りないこと自体は正当な状態（媒体が 1 つの案件）なので、
 * そこを止めるのは筋が違う。止めるのは名前のほう。
 *
 * 終了コードは 2。1（検品で落ちた）ではなく readJson と同じ「渡し方が違う」側。
 */
export function checkFlags(argv, known, usageLine) {
  const unknown = argv.filter((a) => a.startsWith("--") && !known.includes(a));
  if (unknown.length > 0) {
    console.error(`× 知らない引数です: ${unknown.join(" ")}`);
    console.error(`  使えるのは ${known.join(" / ")} です。`);
    usage(usageLine);
  }
}

// ---------------------------------------------------------------------------
// 言い切りと根拠（記事・案件ブリーフ・媒体投稿で共通）
// ---------------------------------------------------------------------------

/**
 * 言い切り 1 件を見る。
 *
 * `fact` に根拠を要求するのがここの中心。根拠を付けられないものを事実として
 * 書けてしまうと、読者から見て「測った」と「そう思う」の区別が消える。
 */
export function checkClaim(report, claim, at, factKinds) {
  if (typeof claim?.id !== "string" || claim.id.trim() === "") {
    report.fail(at, "言い切りに id がありません。", "媒体をまたいで同じ主張を指すための番号です。案件ブリーフの id をそのまま使ってください。");
  }
  if (typeof claim?.statement !== "string" || claim.statement.trim() === "") {
    report.fail(at, "言い切りの本文が空です。", "");
    return;
  }
  if (!report.oneOf(at, "kind", claim.kind, factKinds)) return;

  const evidence = claim.evidence ?? [];
  if (claim.kind === "fact" && evidence.length === 0) {
    report.fail(
      at,
      "事実として書いているのに、根拠がありません。",
      "出典か自社の計測記録を 1 つ以上付けてください。付けられないなら kind を inference か opinion にしてください。",
    );
  }
  for (const e of evidence) {
    if (typeof e.sourceLabel !== "string" || e.sourceLabel.trim() === "") {
      report.fail(at, "根拠に名前がありません。", "「自社検証（2026-07-12）」のように、何を見たかを書いてください。");
    }
    if (!isDate(e.checkedAt)) report.fail(at, "根拠の checkedAt が YYYY-MM-DD ではありません。", "いつ確認したかです。");
    if (e.url !== undefined && !/^https:\/\//.test(e.url)) {
      report.fail(at, `根拠の url「${e.url}」が https で始まっていません。`, "出典は https のみ受け付けます。");
    }
    if (e.expired !== undefined && typeof e.expired !== "boolean") {
      report.fail(at, "expired は true か false です。", "確認から時間が経った根拠だけ true にしてください。");
    }
  }
}

// ---------------------------------------------------------------------------
// 買う導線（記事・媒体投稿・hook で共通）
// ---------------------------------------------------------------------------

/**
 * 商品カード 1 枚の導線を見る。
 *
 * **この製品でいちばん見つけにくい壊れ方がここにある。** 買う導線を出さない理由
 * （`blockedReason`）は、`affiliateUrl` と `trackingCode` が**両方とも無いとき**に
 * しか画面に出ない。URL を残したまま理由を書くと、理由は黙って消える。
 * 書いた本人は「書いた」と思っているし、画面は正常に見える。
 *
 * @returns {{ linked: boolean }} 買う導線を持っているか
 */
export function checkOutbound(report, card, at) {
  const linked = card.affiliateUrl !== undefined || card.trackingCode !== undefined;

  if (linked && card.blockedReason !== undefined) {
    report.fail(
      at,
      "買う導線があるのに blockedReason が書かれています。この理由は画面に出ません。",
      "導線を出さないなら affiliateUrl と trackingCode を両方消してください。出すなら blockedReason を消してください。",
    );
  }
  if (!linked && (card.blockedReason ?? "").trim() === "") {
    report.warn(
      at,
      "買う導線が無く、理由も書かれていません。",
      "既定の文（提携している販売先がありません）が出ます。理由が別にあるなら blockedReason に書いてください。",
    );
  }
  if (card.affiliateUrl !== undefined && !/^https:\/\//.test(card.affiliateUrl)) {
    report.fail(at, `affiliateUrl「${card.affiliateUrl}」が https で始まっていません。`, "ASP が発行した URL をそのまま入れてください。");
  }
  return { linked };
}

/**
 * 画面で使う言葉の言い換え禁止。
 * 同じものを 2 つの言葉で呼ぶと、読者は別物だと思う。
 * 正本は `src/presentation/ui/copy.ts`（検査は tests/ui/copy-dictionary.test.ts）。
 */
export const FORBIDDEN_WORDS = [
  ["広告リンク", "広告（アフィリエイトリンク）"],
  ["アフィリエイト広告", "広告（アフィリエイトリンク）"],
  ["PR記事", "広告（アフィリエイトリンク）を含む記事"],
];

export function checkWords(report, value, where) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const [bad, good] of FORBIDDEN_WORDS) {
    if (text.includes(bad)) {
      report.fail(
        where,
        `使ってはいけない言い換え「${bad}」が入っています。`,
        `「${good}」と書いてください。同じものを 2 つの言葉で呼ぶと、読者は別物だと思います。`,
      );
    }
  }
}
