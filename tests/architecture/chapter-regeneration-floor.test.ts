/**
 * @tier 1
 * @req REQ-TS15
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 章を再生成する前に、**下回ってはならない床**を数で置く。
 *
 * なぜ要るか: `completeness-report.json` gaps[0] は 8 章 + `00-requirements-definition.md`
 * の再生成を求めている。前に一度、この種の再生成が **892 行の削除**を伴い、
 * **gaps が引用している当の節を消す形**になった。走らせてからでは、
 * 消えたものが「元から無かった」と読めてしまう。**先に数を置く。**
 *
 * なぜ文書ではなくテストか: 想定を文書にも書くと、数の正本が 2 つできる。
 * 残課題 78 ⑰ の型——同じ文書の中で、書いた瞬間から自分自身と食い違う——を
 * 自分で作ることになる。**数はここ 1 箇所にだけ置く。**
 *
 * ── 2026-08-19: 1 章から 8 章へ広げた ────────────────────────────
 *
 * 最初は `auth.md` 1 章だけだった（8 章まとめて測ると、想定が外れたときに
 * どの想定が外れたのか分からないため）。**しかしそれは、守られているのが
 * 1 章だけということでもあった。**scratchpad の再生成結果を 8 章とも測ると、
 * **非規範注記は 8 章すべてで消える**（true → false、8/8）。残り 7 章は
 * 床が無いので、走らせた日に静かに消える（残課題 78 ㉔ の本体）。
 *
 * **床は章ごとに実測して置いた。auth の 153 行を他章へ写していない。**
 * 写すと 8 章のうち 7 章で床が実態とずれ、ずれた分だけ緑の意味が変わる。
 *
 * ── 行数の床は、この壊れ方を捕まえられない（実測）────────────────────
 *
 * 再生成後の行数は **backend 292 → 329・frontend 172 → 177** と**増える**。
 * 見出しの数も **backend 35 → 35・frontend 21 → 21** で変わらない。
 * それでも節と注記は失われる。**行数と見出しの床だけを置いていたら、
 * この 2 章は緑のまま中身を失う。**だから「断りが 1 つ残っていること」は
 * 行数とは別の 1 件として 8 章分持たせてある（残課題 78 ㉕）。
 *
 * ── 章の形は 2 通りある（これも実測で分かった）──────────────────
 *
 * 5 章（auth / frontend / maintenance-ops / security / ui-ux）は 11 節、
 * 3 章（backend / database / infrastructure）は 6 節で（**いずれも gap 1 の 2 節を
 * 載せる前の数。2026-08-20 現在はそれぞれ 13 節 / 8 節**。下の追記を参照）、後者は
 * `状態の意味 (State semantics)` 〜 `Acceptance evidence` の代わりに
 * `状態の意味と実装差分` 1 節を持つ。**必須節の一覧を 1 本にできない。**
 * 1 本にすると 3 章が今日から赤になるか、5 章の 5 節が床から外れるかのどちらかで、
 * どちらも「守っているつもり」を作る。
 *
 * ── 床は現在値そのもの ──────────────────────────────────
 *
 * 等号ではなく `以上` で置いてあるのは、再生成の目的が **decisions[] の追記**——
 * つまり増える方向——だからである。増えるのは通す。**減るところだけを止める。**
 * 上限は章ごとに 1 つだけ（既定は床 + 150 行）。**上限は下げる方向にしか動かさない。**
 * 例外は `ceiling` を明示した章だけで、明示は「余裕が尽きたので判断した」記録である
 * （2026-08-23 現在 ui-ux の 1 章のみ。理由はその場に書いてある）。
 *
 * ── 当てどころが無いものは宣言しない ─────────────────────────
 *
 * **【2026-08-23 追記】この節が名指ししていた状況は終わった。**以前ここには
 * 「`backend.md` には `**回答**: ` が 0 件あり、逐語の床を張る先が無い」と書いてあり、
 * 表の backend も `answer: null` だった。b83cd74 で `document.modelContext` の回答が
 * 1 件載ったので、いまは張れる（`answers: [1, 111]`）。**方針そのものは変えていない**——
 * 0 件に対して「0 件以上」を置くと壊しようのない緑が 1 件増えるだけ（残課題 78 ㉗）
 * という理由で `null` の口は残してあり、いま使っている章が 0 になっただけである。
 *
 * ── 分かったこと: gaps[0] も名指しを外している ────────────────────
 *
 * 当時の gaps[0] は「decisions[] 6 件を本文へ載せる」と言っていた。
 *
 * **【2026-08-20 訂正】ここには以前「00 には 6 件とも既に載っている（L80 の表）」と
 * 書いてあった。これは誤りである。**実測すると `00-requirements-definition.md` の
 * `## 意思決定支援 (decisions)` は**見出しと表ヘッダは在るが、行は 1 本しかなかった** —
 * `decision-auth-method` だけである。残り 5 件
 * （`decision-editorial-commercial-split` / `decision-redirect-measurement-async` /
 * `decision-llm-provider` / `decision-ui-theme-implementation` /
 * `decision-test-ci-tooling`）は id でも question 本文でも 0 回だった。
 * つまり**載っていないのは 8 章の側だけでなく、00 章の側も 5/6 が載っていなかった。**
 *
 * 誤りの形は「表の見出しが在る」ことを「中身が在る」と読んだもので、
 * **器を見て中身を数えなかった**。この説明文は検査の対象外なので、
 * 誤っていても赤くならずに残り続けた（**説明文には門が無い**）。
 *
 * **【2026-08-20 追記・同じ日のうちに】上の段落は過去形へ直してある。**
 * gap 1 の着地で残り 5 件を 00 章へ手で書き足し、当時の **6/6 が載った**。
 * 2026-08-23 に 7 件目が増えたため、現在値は下の検査で正本から動的に照合する。
 * **直した当人がこの説明文を古いまま残せば、上でわざわざ書いた誤りを自分で繰り返すことになる。**
 * 門が無い文は、直した人が同じ便で直すしかない。
 *
 * なお 00 での 1 行目の載り方が `{'category': 'free', 'amount': 0, ...}` という
 * **Python の dict をそのまま文字列にした形**である点は、実測でも変わらず正しい。
 * **手で足した 5 行はこの形に寄せていない**（寄せると読めない形が 6 行へ増える）。
 * 残課題 78 ⑫ の 3 例目（指摘の一文が名指しした場所だけが外れている）。
 */

const ROOT = process.cwd();

/** 再生成の前後で比べる、章の構造の数。文字列から測るので合成例にもかけられる。 */
function measure(text: string) {
  const lines = text.split("\n");
  const headings = lines.filter((l) => /^#{2,6} /.test(l));
  /** 見出し `name` の直下から、次の `## ` までにある表の本文行を数える。 */
  const tableRows = (name: string): number => {
    const i = lines.findIndex((l) => l === `## ${name}`);
    if (i < 0) return 0;
    let n = 0;
    for (let j = i + 1; j < lines.length && !/^## /.test(lines[j]); j++) {
      if (lines[j].startsWith("|") && !/^\|\s*-+/.test(lines[j])) n += 1;
    }
    return n;
  };
  const answers = (text.match(/\*\*回答\*\*: [^\n]*/g) ?? []).map((s) => s.length - 8);
  return {
    lines: lines.length - 1,
    sections: lines.filter((l) => /^## /.test(l)).map((l) => l.slice(3)),
    headings: headings.length,
    tableRows,
    principles: (text.match(/^- 原則: /gm) ?? []).length,
    hasNonNormativeNote: text.includes("**非規範・取得証跡なし・実装根拠に使用不可**"),
    answers,
    /**
     * 全回答の合計文字数。**最短ではなく合計を測る。**
     *
     * 2026-08-23 まではここが `shortestAnswer`（最小値）だった。要約による痩せを
     * 捕まえる目的には合っているように見えて、**統計が加算単調でない**。
     * 短い回答が 1 本増えるだけで最小値は下がり、既存の逐語が 1 字も縮んでいなくても
     * 赤くなる。実際そうなった——infrastructure に 68 字・maintenance-ops に 47 字の
     * 回答が新しく載っただけで、204 字 / 165 字の逐語は無傷のまま床を割った。
     *
     * この検査の宣言は「**増えるのは通す。減るところだけを止める。**」である。
     * 合計はその宣言どおりに動く（要約すれば下がり、追記すれば上がる）。
     * **床の数を下げて緑にしたのではなく、宣言と食い違っていた統計のほうを直した。**
     *
     * 引き換えに手放したもの: 1 本を要約しつつ別の 1 本を同じ量だけ書き足すと通る。
     * それを止めるため、本数の床を対で持たせてある（回答が消える形への当て）。
     */
    answersTotal: answers.reduce((a, b) => a + b, 0),
  };
}

/**
 * ── 2026-08-20: 節が 2 つ増えた（gap 1 の着地）────────────────────
 *
 * `## 確定セルの記録 (正本 spec-state.json)` と `## 意思決定 (decisions)` を
 * `カテゴリ別収集状態` の直後へ入れた。gaps[0] が求めていた
 * 当時の「確定セル内容と decisions[] 6 件を本文へ載せる」を、**再生成ではなく手編集**で
 * 実行した結果である（理由は `system-spec/database.md` の
 * `### 本節を「転記」に留めた理由` に 1 か所だけ書いてある）。
 *
 * **節の検査は等号のままにした。**上の「増えるのは通す」は行数・見出し数・表の行数、
 * つまり**量**の床についての話である。節の一覧を「含んでいれば通る」に緩めると、
 * 削除・並べ替えは止まるが**無断の追加**が止まらなくなる。3 つの保護のうち 1 つを
 * 落とすことになるので、代わりに**実物のほうを一覧へ書き写した**。
 * 緩めていない——**当てる先を今日の形に更新しただけ**である。
 *
 * ── 2026-08-20 追記: 目印が役目を終えたので、消さずに向きを反転させた ──────
 *
 * 前の版はここに「**ui-ux だけ旧い形のまま残してある（`SHAPE_A`）**。この章の web セルは
 * `screen-information-priority` が未接地で、再確定できていないため gap 1 をまだ載せていない。
 * 載った日にこの検査は赤くなり、ui-ux も移すことを知らせる」と書いてあった。
 * その日が来た。ui-ux×web を正規の R4-reopen → confirm で利用者回答へ接地させ、
 * gap 1 の 2 節を `system-spec/ui-ux.md` へ載せ、この表の ui-ux を
 * `SHAPE_A_WITH_CELL_RECORD` へ移した。**予告どおり、移す前に検査は赤くなった**
 * （失敗は 1 件、その diff が新しい 2 節を指していた）。
 *
 * **`SHAPE_A` を消していない。**穴を見張る検査は、穴が塞がった日に役目を終えるのではなく、
 * **向きを反転させて残す**。塞がったものが再び開く道は、塞がる前から在るからである。
 * 反転先は `SHAPE_A が指す章は 0 件` + `全 8 章が gap 1 の 2 節を持つ`
 * （`gap 1 の 2 節は 8 章すべてに載っている` の it）。前者だけだと
 * **`SHAPE_A` の中身を書き換えれば 0 件を保てる**ので、母数を張る後者と対にしてある。
 * 消していたら、ui-ux が後で 11 節へ戻っても誰も気づかない状態へ帰る。
 *
 * ── ui-ux の天井の余裕が他章より狭いこと（2026-08-20 実測。数値は動かしていない）──
 *
 * 床 + 150 行の天井に対する余裕は、他 7 章が 81〜105 行あるのに対し
 * **ui-ux だけ 22 行**（床 223 / 実測 351 / 天井 373）。理由は、この章だけが
 * 「既存記録との食い違いを均さずに両方残した」記録を抱えているためで、
 * 中身が薄まったのではなく**厚い**。
 *
 * **それでも床 223 を実測 351 へ上げていない。**床を上げると天井（床 + 150）も一緒に
 * 上がる。天井は「上限は下げる方向にしか動かさない」側の道具であり、
 * 手が詰まったことを理由に上げるのは緩める向きである。**次にこの章へ 22 行を超えて
 * 追記する人は、天井に当たって赤くなる。そこで初めて「この章は分けるべきか、
 * 天井を上げるべきか」を判断すればよい。**先に上げておくと、その判断の機会が消える。
 *
 * ── 2026-08-23: 予告した日が来たので、判断した ───────────────────
 *
 * `## 履歴` を 30 行足して **381 行**になり、天井 373 を 8 行超えて赤くなった。
 * 上の段落が「そこで初めて判断すればよい」と言っていた、その場面である。
 *
 * **章を分ける道は無い。**`system-spec/` は C01/C03 の単一 writer 経由でしか
 * 変更できず、章の分割は compile 側の出力単位を変えることを意味する。
 * gap 1 の未了（compile が `qa_refs` と小節を再生成できない）を抱えたまま
 * 出力単位を触るのは、直す対象を動かしながら直すことになる。
 *
 * **そこで天井だけを明示し、余裕 22 行を増えた本文の上へ置き直した（403）。**
 * 余裕の量は 22 行のまま変えていない。**次に 22 行を超えて追記する人は、
 * また同じ場所で赤くなる**——判断の機会は失われていない。
 * 増えた 30 行が「厚くなった」のか「膨らんだ」のかは中身で判断した。
 * 差し替えた要件の**旧本文を逐語で残す**記録であり、これを削ると
 * 「いつ誰が何から何へ変えたか」が消える種類の 30 行である。
 */

/**
 * 11 節の形（As-Is / To-Be / Delta を別々に持つ章）。**gap 1 未了の章の形。**
 *
 * **2026-08-20 以降、この形を使う章は 0 件である。**それでも消していないのは、
 * 「0 件であること」自体を下の反転検査が見張っているためで、**この定数は
 * その検査が当てる先**である。消すと検査も一緒に消え、ui-ux が後で
 * 11 節へ戻っても誰も気づかない。中身も書き換えないこと——書き換えれば
 * 「一致 0 件」は保てるが、見張る対象が別物にすり替わる。
 */
const SHAPE_A = [
  "状態の意味 (State semantics)",
  "As-Is",
  "To-Be",
  "Delta",
  "Dependencies",
  "Acceptance evidence",
  "カテゴリ別収集状態",
  "確定内容 (質疑録)",
  "上流指針 (doctrine anchor)",
  "適用された設計知識",
  "最新ドキュメント出典",
] as const;

/** 11 節の形に、gap 1 の 2 節を加えたもの（13 節）。 */
const SHAPE_A_WITH_CELL_RECORD = [
  "状態の意味 (State semantics)",
  "As-Is",
  "To-Be",
  "Delta",
  "Dependencies",
  "Acceptance evidence",
  "カテゴリ別収集状態",
  "確定セルの記録 (正本 spec-state.json)",
  "意思決定 (decisions)",
  "確定内容 (質疑録)",
  "上流指針 (doctrine anchor)",
  "適用された設計知識",
  "最新ドキュメント出典",
] as const;

/** 6 節の形（`状態の意味と実装差分` 1 節にまとめてある章）に、gap 1 の 2 節を加えたもの（8 節）。 */
const SHAPE_B = [
  "状態の意味と実装差分",
  "カテゴリ別収集状態",
  "確定セルの記録 (正本 spec-state.json)",
  "意思決定 (decisions)",
  "確定内容 (質疑録)",
  "上流指針 (doctrine anchor)",
  "適用された設計知識",
  "最新ドキュメント出典",
] as const;

type Chapter = {
  /** ファイル名（`.md` を除く） */
  readonly name: string;
  readonly sections: readonly string[];
  /** 節ごとの表の本文行数の床。**その章に実在する節だけを書く。** */
  readonly tables: ReadonlyArray<readonly [string, number]>;
  readonly lines: number;
  /**
   * 行数の天井。**既定は `lines + CEILING_MARGIN`。章ごとに明示したときだけそれを使う。**
   * 明示は「余裕が尽きたので判断した」記録であり、理由を必ず添えること。
   */
  readonly ceiling?: number;
  readonly headings: number;
  readonly principles: number;
  /**
   * 確定回答の [本数, 合計文字数] の床。`null` は「`**回答**: ` が 0 件で張る先が無い」。
   * 本数は回答が消える形へ、合計は逐語が要約へ痩せる形へ当てる（`measure` の注記を参照）。
   */
  readonly answers: readonly [count: number, chars: number] | null;
};

/**
 * **2026-08-19 に章ごと実測した値をそのまま置いている。**
 * 他章から写した値は 1 つも無い。上の doc comment の「写さない」はこの表のこと。
 */
const CHAPTERS: readonly Chapter[] = [
  {
    name: "auth",
    sections: SHAPE_A_WITH_CELL_RECORD,
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 6],
      ["カテゴリ別収集状態", 7], // gaps[6] が引用
      ["上流指針 (doctrine anchor)", 3], // gaps[2] が引用
      ["最新ドキュメント出典", 2], // gaps[1] が引用。REQ-TS14 が中身を見ている
    ],
    lines: 153,
    headings: 21,
    principles: 2,
    answers: [1, 321], // qa-auth-web の回答は逐語。要約したら短くなる。
  },
  {
    name: "backend",
    sections: SHAPE_B,
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 292,
    headings: 35,
    principles: 2,
    answers: [1, 111], // 2026-08-23: 0 件だったが 1 件載ったので、張れるようになった。
  },
  {
    name: "database",
    sections: SHAPE_B,
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 219,
    headings: 21,
    principles: 2,
    answers: [2, 102],
  },
  {
    name: "frontend",
    sections: SHAPE_A_WITH_CELL_RECORD,
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 5],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
      ["確定内容 (質疑録)", 9],
    ],
    lines: 172,
    headings: 21,
    principles: 2,
    answers: [2, 95],
  },
  {
    name: "infrastructure",
    sections: SHAPE_B,
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 179,
    headings: 23,
    principles: 2,
    answers: [2, 154], // 再生成すると逐語が 83 字へ痩せる（実測）。合計が下がるので止まる。
  },
  {
    name: "maintenance-ops",
    sections: SHAPE_A_WITH_CELL_RECORD,
    tables: [
      ["To-Be", 8],
      ["Acceptance evidence", 8],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
      ["確定内容 (質疑録)", 5],
    ],
    lines: 167,
    headings: 21,
    principles: 2,
    answers: [2, 116],
  },
  {
    name: "security",
    sections: SHAPE_A_WITH_CELL_RECORD,
    tables: [
      ["To-Be", 6],
      ["Acceptance evidence", 6],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
    ],
    lines: 173,
    headings: 21,
    principles: 2,
    answers: [2, 66],
  },
  {
    name: "ui-ux",
    // 2026-08-23: `## 履歴` が末尾に増えた。R4-reopen で `UIUX-REQ-001` を利用者決定へ
    // 差し替えたとき、旧本文を逐語で残すために作った節である（差し替えの記録が
    // 差し替えと同じ便で残らないと、後から「いつ誰が変えたか」が消える）。
    // **この 1 章にしかない節なので、共有の形には足さず、この章だけに足す。**
    sections: [...SHAPE_A_WITH_CELL_RECORD, "履歴"],
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 5],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
    ],
    lines: 223,
    // 2026-08-23: 予告どおり天井に当たったので、ここで判断した。上の説明文を参照。
    // 床 223 は動かさない（床を上げると既定の天井 = 床 + 150 が一緒に上がり、
    // 余裕が 150 行へ広がる）。代わりに天井だけを明示し、**この章が持っていた
    // 余裕 22 行を、増えた本文の上へそのまま置き直す**（381 + 22 = 403）。
    // 緩めたのではなく、余裕の量を変えずに位置を移した。
    ceiling: 403,
    headings: 28,
    principles: 2,
    answers: [2, 49],
  },
];

const CEILING_MARGIN = 150;

/**
 * 測定用の口。**通常の実行では開かない。**
 *
 * なぜ要るか: 床が再生成を実際に止められるかは、**再生成の結果に同じ床を当てて
 * 赤くなること**でしか示せない。ところが確定章への書き込みは hook が遮断するので、
 * 「実体を壊して測る」ができない（迂回しない）。そこで**読む先だけを差し替える**。
 *
 * **これは自分で満たせる条件＝残課題 78 の族 II そのものである。**
 * 太った別のフォルダを指せば床は通る。だから口が開いていないことを
 * 下の検査 1 件で見張り、**測定のときはその 1 件も一緒に赤くなる**ようにしてある。
 * 赤の件数を報告するとき、この 1 件は床の赤と別に数えること。
 */
const PROBE_DIR = process.env.CHAPTER_FLOOR_PROBE_DIR;
const SPEC_DIR = PROBE_DIR ?? join(ROOT, "system-spec");

function read(name: string): string {
  return readFileSync(join(SPEC_DIR, `${name}.md`), "utf8");
}

function decisionIdsInSection(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) return [];

  return lines
    .slice(start + 1, lines.findIndex((line, index) => index > start && /^## /.test(line)))
    .map((line) => line.match(/^\|\s*\*{0,2}`?(decision-[a-z0-9-]+)`?\*{0,2}\s*\|/)?.[1])
    .filter((id): id is string => id !== undefined);
}

describe("8 章を再生成しても痩せないこと (C03 の事前の床)", () => {
  it("測定用の口が開いていない（通常の実行では確定章そのものを見ている）", () => {
    // 口が開いたままだと、床は「どこかの太ったフォルダ」を見て緑になる。
    // 測定のときはここも赤くなるので、赤の件数を数えるときに床の赤と混ぜないこと。
    expect(PROBE_DIR, "CHAPTER_FLOOR_PROBE_DIR が設定されたまま走っています").toBeUndefined();
  });

  it("床を置いた章が、確定 8 章と過不足なく一致している", () => {
    // 章を 1 つ足したときに床を置き忘れる形を止める。
    // **数える対象そのものが消える形**（残課題 78 ㉗）への当てでもある——
    // CHAPTERS が空になれば下の it.each は 0 件になり、全部緑のまま黙る。
    expect([...CHAPTERS].map((c) => c.name).sort()).toEqual([
      "auth",
      "backend",
      "database",
      "frontend",
      "infrastructure",
      "maintenance-ops",
      "security",
      "ui-ux",
    ]);
  });

  it("00章と確定8章の意思決定表が正本 decisions[] と一致する", () => {
    const state = JSON.parse(readFileSync(join(ROOT, "system-spec/spec-state.json"), "utf8")) as {
      decisions: Array<{ id: string }>;
    };
    const expected = state.decisions.map(({ id }) => id);
    const documents = [
      ["00-requirements-definition", "## 意思決定支援 (decisions)"],
      ...CHAPTERS.map(({ name }) => [name, "## 意思決定 (decisions)"]),
    ] as const;

    for (const [name, heading] of documents) {
      expect(decisionIdsInSection(read(name), heading), `${name}.md`).toEqual(expected);
    }
  });

  it("gap 1 の 2 節は 8 章すべてに載っている（旧 11 節の形を指す章は 0 件）", () => {
    // ── これは反転した検査である ────────────────────────────────
    // 2026-08-20 まで、この位置には「ui-ux だけが SHAPE_A のまま」という**目印**があり、
    // 目印が消えること自体が gap 1 の完了を知らせていた。完了した今、目印を消すのではなく
    // 向きを反転させて残す。**塞がったものが再び開く道は、塞がる前から在る。**
    //
    // 2 つの主張を対にしてあるのは、片方だけでは抜けられるからである:
    //   (a)「SHAPE_A を指す章は 0 件」だけ  → SHAPE_A の中身を書き換えれば 0 件を保てる
    //   (b)「全章が 2 節を持つ」だけ        → 母数 CHAPTERS が空でも 0 件で通る
    // (b) の母数は上の「確定 8 章と過不足なく一致している」が別途 8 で固定している。
    const GAP1_SECTIONS = ["確定セルの記録 (正本 spec-state.json)", "意思決定 (decisions)"];

    // (b) 実物を読んで数える。表の宣言ではなく `system-spec` 配下の .md の中身を見る。
    //     （2026-08-20: ここに slash-star と書いたら test-honesty のコメント除去が
    //      それをブロックコメントの開始と読み、以降の expect を見失って
    //      「何も確かめていないテスト」と誤検出した。検出器側を 1 パス走査へ直したので
    //      いまは書いてよい。文言を変えて逃げると、穴のほうが残っていた。）
    const withoutGap1 = CHAPTERS.filter((c) => {
      const sections = measure(read(c.name)).sections;
      return !GAP1_SECTIONS.every((s) => sections.includes(s));
    }).map((c) => c.name);
    expect(withoutGap1).toEqual([]);
    expect(CHAPTERS.length).toBe(8); // 0 件の主張が母数 0 由来でないことを同じ it で示す

    // (a) 旧い形を指したままの宣言が残っていないこと。
    const stillShapeA = CHAPTERS.filter((c) => c.sections === SHAPE_A).map((c) => c.name);
    expect(stillShapeA).toEqual([]);

    // (a) の見張る対象がすり替わっていないこと（SHAPE_A の中身を書き換えて逃げる形への当て）。
    expect([...SHAPE_A]).toEqual([
      "状態の意味 (State semantics)",
      "As-Is",
      "To-Be",
      "Delta",
      "Dependencies",
      "Acceptance evidence",
      "カテゴリ別収集状態",
      "確定内容 (質疑録)",
      "上流指針 (doctrine anchor)",
      "適用された設計知識",
      "最新ドキュメント出典",
    ]);
  });

  describe.each(CHAPTERS)("$name.md", (ch) => {
    const m = measure(read(ch.name));

    it("必須の節が名前と順序ごと残っている", () => {
      expect(m.sections).toEqual([...ch.sections]);
    });

    it("非規範注記が残っている（実装根拠に使えない参照であることの断り）", () => {
      // **行数とは別の 1 件**として持たせてある。行数の床だけだと、
      // 注記 1 行が消えても他が 1 行増えれば通る（backend と frontend は実際に増える）。
      expect(m.hasNonNormativeNote).toBe(true);
    });

    it(`見出しが ${ch.headings} 個以上ある（節を残して中身を空にする形を止める）`, () => {
      expect(m.headings).toBeGreaterThanOrEqual(ch.headings);
    });

    it.each(ch.tables)("表「%s」の本文行が %i 行以上ある", (name, floor) => {
      expect(m.tableRows(name)).toBeGreaterThanOrEqual(floor);
    });

    it(`本章での適用の原則が ${ch.principles} 件以上ある`, () => {
      expect(m.principles).toBeGreaterThanOrEqual(ch.principles);
    });

    const ceiling = ch.ceiling ?? ch.lines + CEILING_MARGIN;
    it(`行数が ${ch.lines} 以上 ${ceiling} 以下にある`, () => {
      expect(m.lines).toBeGreaterThanOrEqual(ch.lines);
      expect(m.lines).toBeLessThanOrEqual(ceiling);
    });

    if (ch.answers !== null) {
      const [count, chars] = ch.answers;
      it(`確定回答が ${count} 本以上あり、逐語のまま残っている（合計 ${chars} 字以上）`, () => {
        expect(m.answers.length).toBeGreaterThanOrEqual(count);
        expect(m.answersTotal).toBeGreaterThanOrEqual(chars);
      });
    }
  });

  /**
   * 床は「満たしている」だけでは効いていることを示せない。
   * **痩せた章を合成して、同じ測り方が落とすことを見る。**
   * これが無いと、上の床は測る側が壊れていても同じ緑を返す。
   */
  describe("痩せた章を止められること", () => {
    describe.each(CHAPTERS)("$name.md", (ch) => {
      const full = read(ch.name);

      it("節を 1 つ落とすと、必須の節の一致が崩れる", () => {
        const last = ch.sections[ch.sections.length - 1];
        const cut = full.replace(`## ${last}\n`, "");
        expect(measure(cut).sections).not.toEqual([...ch.sections]);
      });

      it("非規範注記を消すと見つかる", () => {
        const cut = full.replace("**非規範・取得証跡なし・実装根拠に使用不可**", "参考");
        expect(measure(cut).hasNonNormativeNote).toBe(false);
      });

      it("収集状態の表から 1 行消すと床を割る", () => {
        const i = full.split("\n").findIndex((l) => l === "## カテゴリ別収集状態");
        const lines = full.split("\n");
        const at = lines.findIndex((l, j) => j > i && l.startsWith("|") && !/^\|\s*-+/.test(l));
        const cut = [...lines.slice(0, at), ...lines.slice(at + 1)].join("\n");
        expect(measure(cut).tableRows("カテゴリ別収集状態")).toBeLessThan(7);
      });
    });

    /** auth だけに置いてある壊し方（他章に同じ形の当てどころが無いもの）。 */
    describe("auth.md（この章にしかない当てどころ）", () => {
      const full = read("auth");

      it("対象外の 5 行を消すと、収集状態の表が床を割る", () => {
        const cut = full
          .split("\n")
          .filter((l) => !l.includes("approval-platform-web-only"))
          .join("\n");
        expect(measure(cut).tableRows("カテゴリ別収集状態")).toBeLessThan(7);
      });

      it("確定回答を要約に置き換えると、逐語の床を割る", () => {
        const cut = full.replace(/\*\*回答\*\*: .*/, "**回答**: Better Auth を採用。");
        expect(measure(cut).answersTotal).toBeLessThan(321);
      });

      it("回答を 1 本足しただけでは床を割らない（合計は加算単調である）", () => {
        // 最小値で測っていた頃はここが割れた。**短い回答が載っただけで、
        // 既存の逐語が無傷のまま赤くなる**という壊れ方の再発を、この 1 件で止める。
        const added = `${full}\n**回答**: 短い追記\n`;
        expect(measure(added).answersTotal).toBeGreaterThanOrEqual(321);
      });

      it("原則を 1 件に減らすと床を割る", () => {
        const cut = full
          .split("\n")
          .filter((l) => !l.startsWith("- 原則: 秘密情報"))
          .join("\n");
        expect(measure(cut).principles).toBeLessThan(2);
      });
    });
  });
});
