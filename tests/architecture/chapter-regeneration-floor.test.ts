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
 * ── 【2026-08-25 追記】並びが変わったことを「痩せた」と報せていた ──────
 *
 * `compile-spec-doc.py compile --on-handwritten preserve` で 8 章を再生成したところ、
 * 節の検査 1 件が 8 章まとめて赤くなった。**中身は 1 節も失われていない。**
 * preserve は生成節を組み立て直したうえで手書き節を末尾へ引き継ぐので、
 * 「生成節 → 手書き節」の並びになる。章を書いた人が置いた位置は保たれない。
 *
 * ここで宣言の並びを実測へ書き換えると、次に本当に節が消えた日も同じ手で通せてしまう。
 * そこで検査を 2 件に割った——**欠けていないこと（これが床）**と、
 * **並びが生成器の出力どおりであること**。前者は集合で見るので並びに揺れない。
 * 後者は `GENERATED_SECTIONS` から導くので、宣言は 1 章ぶん 1 か所のままで済み、
 * 生成器の並べ方が変わった日にだけ赤くなる。
 * **失われていないものを「痩せた」と報せる床は、本当に痩せた日に信じてもらえない。**
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

/**
 * compile が**毎回作り直す報告の節**。章の中身ではなく、compile 自身の申し送りである。
 *
 * ここに書いた節は床の測定から外す。理由は 2 つある。
 *
 *   1. **章が痩せたのかどうかと関係が無い。** これらは「正本へ接続できなかった行が
 *      ある」という報告で、出るのは章が薄くなった日ではなく、正本と章がずれた日である。
 *      節の並びの検査に混ぜると、**ずれの報告が出たこと自体を「痩せた」と読む**。
 *   2. **中身が run ごとに変わる。** 行数の天井へ数え入れると、報告が 1 行増えた日に
 *      天井を上げる（＝床の意味を薄める）以外の直し方が無くなる。
 *
 * 外したぶんは `it("compile の申し送りが増えていない")` で別に数える。
 * **消したのではなく、当てる場所を変えただけである。**
 */
const RESIDUE_SECTIONS = [
  "compile が保てなかった行 (要判断)",
  "章にしか無い記述 (正本へ未接続)",
] as const;

/** 報告の節（`## …` から次の `## ` の手前まで）を落とす。 */
function withoutResidue(text: string): string {
  const out: string[] = [];
  let dropping = false;
  for (const line of text.split("\n")) {
    if (/^## /.test(line)) {
      dropping = RESIDUE_SECTIONS.includes(line.slice(3) as never);
    }
    if (!dropping) out.push(line);
  }
  return out.join("\n");
}

/** 再生成の前後で比べる、章の構造の数。文字列から測るので合成例にもかけられる。 */
function measure(source: string) {
  const text = withoutResidue(source);
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
   * 床 (`lines`) を **いつ測った値か** (`YYYY-MM-DD`)。
   *
   * **なぜ日付を持たせるか。**床は「その章がその時点で持っていた行数」であって、
   * 「その章が持つべき行数」ではない。したがって**測った日に章が何で出来ていたか**が
   * 分からないと、床が何を守っているのかも分からない。
   *
   * 実際にずれた。`CHAPTERS_BECAME_PURE_ON` の注記を参照。
   *
   * 新しい章を足すときは、**その章を実測した日**を書くこと。他章から写さない
   * （写した瞬間、その床は「別の章を別の日に測った値」になる）。
   */
  readonly floorMeasuredOn: string;
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
 * **章が「正本の純関数」になった日。**この日より前に測った床は、
 * *手書き本文が混ざっていた章*を測った値である。
 *
 * 2026-08-22 の実測で、`system-spec/*.md` は正本 (`spec-state.json`) の純関数では
 * なかったことが分かった。As-Is / To-Be / Delta ほか **8 章 662 行が章にだけ在り、
 * 正本にも生成器にも無かった**。それらは `set-chapter-narrative` で正本へ移し、
 * いま章は生成器の出力だけで出来ている。
 *
 * **つまり床を置いた当時に守ろうとしたものと、いま床が守っているものは同じではない。**
 * 当時の床は「手書き + 生成」の合計を測っており、いまの床は「生成だけ」に当たっている。
 *
 * 実害が出ていないのは、移送が**行数を減らす方向へは動かなかった**からである
 * （章から抜いた本文は正本経由で章へ戻る）。床は下限なので、上振れは通る。
 * だが**それは偶然そうだったという話で、床が正しい根拠ではない。**
 * ここに日付を置くのは、後から「この数字は何を測ったのか」を辿れるようにするためで、
 * 下の検査 1 件が「まだ測り直していない章が何章あるか」を数え上げで固定している。
 */
const CHAPTERS_BECAME_PURE_ON = "2026-08-22";

/**
 * **2026-08-19 に章ごと実測した値をそのまま置いている。**
 * 他章から写した値は 1 つも無い。上の doc comment の「写さない」はこの表のこと。
 *
 * その 8 件すべてが `CHAPTERS_BECAME_PURE_ON` より前の実測である
 * （= 手書きが混ざっていた時代の値）。`floorMeasuredOn` を参照。
 */
const CHAPTERS: readonly Chapter[] = [
  {
    name: "auth",
    // 2026-09-04: 意思決定を正本 `decisions[]` から各章へ描くようにした際、
    // 「その決定が本章にどう効くか」を正本 `chapter_notes` へ入れた。
    // 結果この節が 3 章 → 8 章へ増えた。**床を上げる方向の更新である。**
    sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 6],
      ["カテゴリ別収集状態", 7], // gaps[6] が引用
      ["上流指針 (doctrine anchor)", 3], // gaps[2] が引用
      ["最新ドキュメント出典", 2], // gaps[1] が引用。REQ-TS14 が中身を見ている
    ],
    lines: 153,
    floorMeasuredOn: "2026-08-19",
    headings: 21,
    principles: 2,
    answers: [1, 321], // qa-auth-web の回答は逐語。要約したら短くなる。
  },
  {
    name: "backend",
    // 2026-09-04: auth と同じ理由で `## 章の注記 (chapter_notes)` が増えた。
    sections: [...SHAPE_B, "章の注記 (chapter_notes)"],
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 292,
    floorMeasuredOn: "2026-08-19",
    /*
      2026-08-26: feat-blog-ops-crud の確定質疑
      (`qa-backend-web-site-blueprint`) が本章へ入り、401 → 446 行になった。
      既定の天井 442（床 292 + 150）を 4 行超える。
      **床は動かさない**（床を上げると既定の天井も一緒に上がり、
      余裕が 150 行へ広がる）。この章がその時点で持っていた余裕は
      442 - 401 = 41 行だったので、**その 41 行を位置ごと移す**（446 + 41 = 487）。
      緩めたのではなく、余裕の量を変えずに置き直した。ui-ux と同じやり方。

      2026-09-04: `## 意思決定 (decisions)` が手書きから生成へ移り、正本
      `decisions[]` の主担当分と `chapter_notes` の「本章に効く形」が載って
      実測 510 行になった。**床 292 も余裕 41 行も動かさない。**
      同じ 41 行を置き直す（510 + 41 = 551）。

      2026-09-04（同日 2 度目）: feat-seo-aeo-gap-closure P13 の書き戻しで
      確定質疑 `qa-backend-web-seo-audit-writeback-p13-v2` が正本へ入り、
      その本文と接地根拠が生成節として載って実測 575 行になった。
      同じ便で `chapter_notes` へ「本節を「転記」に留めた理由」を移している
      （章にだけ在った 4 行が、同名の `## 章にしか無い記述` が 2 つできた結果
      `##` 単位の引き継ぎで衝突して落ちたため。守るのではなく落ちようのない
      場所へ移した）。**痩せた結果ではなく、正本が増えた結果である。**
      **床 292 も余裕 41 行も動かさない。**同じ 41 行を置き直す（575 + 41 = 616）。
    */
    ceiling: 616,
    headings: 35,
    principles: 2,
    answers: [1, 111], // 2026-08-23: 0 件だったが 1 件載ったので、張れるようになった。
  },
  {
    name: "database",
    // 2026-08-30: frontend と同じ理由で `## 章の注記 (chapter_notes)` が増えた。
    // **共有の形 (SHAPE_B) には足さず、この章だけに足す。**
    sections: [...SHAPE_B, "章の注記 (chapter_notes)"],
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 219,
    floorMeasuredOn: "2026-08-19",
    /*
      2026-08-30: 初めて天井に当たった。実測 470 行、既定の天井は 369（床 219 + 150）。
      増分 116 行は feat-blog-ui-builder P13 が正本の `chapter_notes` へ入れた
      データモデルの確定内容（6 表の一意性・索引・`workspace_id` を列として持つ理由・
      未解決の欠陥 3 件）である。
      **床 219 は動かさない**（床を上げると既定の天井も一緒に上がり、
      余裕が 150 行へ広がる）。この章がその時点で持っていた余裕は
      369 - 354 = 15 行だったので、**その 15 行を位置ごと移す**（470 + 15 = 485）。
      緩めたのではなく、余裕の量を変えずに置き直した。frontend / ui-ux と同じやり方。

      2026-08-31: `dev` を取り込んで再び当たった。実測 513 行。増えた 28 行は
      `dev` 側が正本へ入れた確定（移行ガードと公開後スモーク）が生成節として
      載ったもので、痩せたのではない。**床 219 も余裕 15 行も動かさない。**
      同じ 15 行を置き直す（513 + 15 = 528）。

      2026-08-31（同日 2 度目）: §4.3 の「記録に届かない書き込み」を解消し、
      その判断を `set-chapter-note` で正本へ足したぶんが生成節として載った。
      実測 578 行。**前の §4.3 の記録は消していない**ので、増えた 50 行は
      「解消した」という追記であって、痩せた結果ではない。
      **床 219 も余裕 15 行も動かさない。**同じ 15 行を置き直す（578 + 15 = 593）。

      3 度とも同じ形で足していることには意味がある。**天井を上げた回数ではなく、
      余裕が 15 行のまま変わっていないことがこの章の床を守っている。**
      余裕そのものを広げた日が来たら、それは緩めたのであって置き直したのではない。

      2026-09-02（dev 合流）: 両側が別の増分で天井を動かしていた。
      dev は 593、こちらは既定天井 369 に public projection の SSOT 設計
      4 行を足した 373 だった。**合流後の章には両方の増分が載る**ので、
      片方の天井ではどちらも通らない。**余裕は広げない**——dev の 593 に
      こちらの実増分 4 行だけを置き直す（593 + 4 = 597）。

      2026-09-04: 4 度目。backend と同じ便（意思決定の生成化）で実測 659 行。
      **床 219 も余裕 15 行も動かさない。**同じ 15 行を置き直す（659 + 15 = 674）。

      2026-09-04（同日 2 度目）: 5 度目。feat-seo-aeo-gap-closure P13 の書き戻しで
      確定質疑 `qa-database-web-audit-history-window-p13-v2`（点検履歴の保持窓を
      件数 30 で切る根拠・刈り取りを追記と同一トランザクションに入れた理由・
      履歴に外部キーを張らない理由）が正本へ入り、その本文と接地根拠が生成節として
      載って実測 713 行になった。**床 219 も余裕 15 行も動かさない。**
      同じ 15 行を置き直す（713 + 15 = 728）。
    */
    ceiling: 728,
    headings: 21,
    principles: 2,
    answers: [2, 102],
  },
  {
    name: "frontend",
    // 2026-08-30: `## 章の注記 (chapter_notes)` が増えた。生成器が spec-state の
    // `chapter_notes` を章へ載せる節で、この章に注記が 1 件も無い間は出なかった。
    // feat-blog-ui-builder P13 の書き戻しで注記が入り、節が現れた。
    // **共有の形 (SHAPE_A_WITH_CELL_RECORD) には足さない。**足すと、注記を
    // 持たない章にも「在るはず」を宣言することになり、出ない節を待ち続ける。
    sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 5],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
      ["確定内容 (質疑録)", 9],
    ],
    lines: 172,
    floorMeasuredOn: "2026-08-19",
    // 2026-08-25: 予告どおり天井 (既定 172 + 150 = 322) に当たった。実測 356 行。
    // 質疑録 9 行と適用設計知識が生成器から載って増えた分で、痩せたのではない。
    // **床 172 は動かさない** (床を上げると既定の天井も一緒に上がり、余裕が
    // 150 行へ広がる)。ui-ux が 2026-08-23 に採った置き直し方に倣い、
    // **余裕 22 行を増えた本文の上へそのまま置き直す** (356 + 22 = 378)。
    // 緩めたのではなく、余裕の量を変えずに位置を移した。
    //
    // 2026-08-30 (dev): また天井 (378) に当たった。実測 383 行。増えた 5 行は確定質疑
    // `qa-frontend-web-capture-self-occlusion` (写しから送信 UI 自身を外す) を
    // 収集マトリクスへ入れたぶんが生成器から載ったもので、痩せたのではない。
    // **床 172 も余裕 22 行も動かさない。**同じ 22 行を増えた本文の上へ置き直す
    // (383 + 22 = 405)。緩めたのではなく、余裕の量を変えずに位置を移した。
    //
    // 2026-08-30 (feat-blog-ui-builder P13): 増分 141 行は P13 が正本
    // `spec-state.json` の `chapter_notes` へ入れた実装確定契約
    // （テーマ 3 段解決 / JSON-LD / IndexNow / guideline_references）で、
    // **章へ直接書いたのではなく正本へ入れた結果が生成節として出たものである。**
    //
    // 2026-08-31 (dev 合流後): 上の 2 つの増分が同じ章で合流した。実測 524 行。
    // 片方だけの天井 (405 / 518) はどちらも合流後の章を通さない。
    // **床 172 も余裕 22 行も動かさない。**同じ 22 行を置き直す (524 + 22 = 546)。
    //
    // 2026-09-02 (dev 合流): こちらも同じ便で当たっていた。実測 409 行で、
    // 増えた 4 行はブログの住所 (サブドメイン) と「作成したブログが読者に届くか」の
    // 確定質疑が収集マトリクスへ入って生成器から載ったもの。基準 405 に対する
    // 実増分は 26 行 (431 - 405)。**床 172 も余裕 22 行も動かさない。**
    // dev の 546 へ、こちらの実増分 26 行だけを置き直す (546 + 26 = 572)。
    //
    // 2026-09-04: backend / database と同じ便 (意思決定の生成化) で実測 621 行。
    // **床 172 も余裕 22 行も動かさない。**同じ 22 行を置き直す (621 + 22 = 643)。
    ceiling: 643,
    headings: 21,
    principles: 2,
    answers: [2, 95],
  },
  {
    name: "infrastructure",
    // 2026-09-04: auth と同じ理由で `## 章の注記 (chapter_notes)` が増えた。
    sections: [...SHAPE_B, "章の注記 (chapter_notes)"],
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 179,
    floorMeasuredOn: "2026-08-19",
    /*
      2026-08-29: docs/spec/11 の現行版が要求していて確定要件が持っていなかった
      5 件（公開手順 7 手・形の一致確認・concurrency group・ワークフロー 7 本 /
      main への PR の比較元・公開後スモーク）を R4-reopen で入れ直し、
      295 → 426 行になった。既定の天井 329（床 179 + 150）を超える。
      **床は動かさない**（床を上げると既定の天井も一緒に 150 行へ広がる）。
      この章がその時点で持っていた余裕は 329 - 295 = 34 行なので、
      **その 34 行を位置ごと移す**（426 + 34 = 460）。
      緩めたのではなく、余裕の量を変えずに置き直した。backend / frontend と同じやり方。
    */
    ceiling: 460,
    headings: 23,
    principles: 2,
    answers: [2, 154], // 再生成すると逐語が 83 字へ痩せる（実測）。合計が下がるので止まる。
  },
  {
    name: "maintenance-ops",
    // 2026-09-04: auth と同じ理由で `## 章の注記 (chapter_notes)` が増えた。
    sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
    tables: [
      ["To-Be", 8],
      ["Acceptance evidence", 8],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
      ["確定内容 (質疑録)", 5],
    ],
    lines: 167,
    floorMeasuredOn: "2026-08-19",
    /*
      2026-08-29: 同じ入れ直しで本章にも 2 件（§4-1-2 の直し方 6 手・
      wrangler rollback）が入り、262 → 324 行になった。
      既定の天井 317（床 167 + 150）を 7 行超える。**床は動かさない。**
      その時点の余裕 317 - 262 = 55 行を **位置ごと移す**（324 + 55 = 379）。
    */
    ceiling: 379,
    headings: 21,
    principles: 2,
    answers: [2, 116],
  },
  {
    name: "security",
    // 2026-09-04: auth と同じ理由で `## 章の注記 (chapter_notes)` が増えた。
    sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
    tables: [
      ["To-Be", 6],
      ["Acceptance evidence", 6],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
    ],
    lines: 173,
    floorMeasuredOn: "2026-08-19",
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
    // 2026-08-25: `## 章の注記 (chapter_notes)` が増えた。生成器が spec-state の
    // `chapter_notes` を章へ載せるようになったもので、この章だけが持つ。
    sections: [...SHAPE_A_WITH_CELL_RECORD, "履歴", "章の注記 (chapter_notes)"],
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 5],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
    ],
    lines: 223,
    floorMeasuredOn: "2026-08-19",
    // 2026-08-23: 予告どおり天井に当たったので、ここで判断した。上の説明文を参照。
    // 床 223 は動かさない（床を上げると既定の天井 = 床 + 150 が一緒に上がり、
    // 余裕が 150 行へ広がる）。代わりに天井だけを明示し、**この章が持っていた
    // 余裕 22 行を、増えた本文の上へそのまま置き直す**（381 + 22 = 403）。
    // 緩めたのではなく、余裕の量を変えずに位置を移した。
    // 2026-08-25: 2 度目の当たり。実測 590 行 (`章の注記` の 39 行と質疑録の増分)。
    // 前回と同じ置き直し方、同じ余裕 22 行 (590 + 22 = 612)。
    // **余裕の量は 2 度とも 22 行のまま。**3 度目にここへ来たら、天井を動かす前に
    // 「この章だけが何を増やし続けているのか」を先に見ること。
    //
    // 2026-08-30: 3 度目の当たり。実測 678 行。**先に上の宿題へ答える。**
    //
    // 答え: **この回に限れば「この章だけ」ではない。**同じ便で frontend
    // (355 → 496) と database (354 → 470) も天井に当たった。3 章とも増分の
    // 出どころは 1 つで、feat-blog-ui-builder P13 が正本 `spec-state.json` の
    // `chapter_notes` へ入れた実装確定契約である。**章へ直接書いた散文ではない**
    // （章への直接 Edit は `guard-confirmed-chapter-overwrite` が遮断する。
    // 章は正本の純関数なので、直接書けば次の compile で黙って消える）。
    //
    // ただし 3 度の内訳を並べると、この章に固有の傾向も見える。
    //   1 度目 (08-23) 質疑録の増分      2 度目 (08-25) `章の注記` 39 行 + 質疑録
    //   3 度目 (08-30) `章の注記` 89 行
    // **`章の注記` が 2 度続けて主因である。**この章は UI/UX の確定が集まる先で、
    // 他章より注記が積まれやすい。4 度目が来たら、天井ではなく
    // **注記の置き場そのもの**（章の注記に積み続けてよいのか）を疑うこと。
    //
    // 置き直し方は 3 度とも同じ、余裕も 3 度とも 22 行 (678 + 22 = 700)。
    //
    // 2026-09-02 (dev 合流): こちらも同じ章で当たっていた。実測 623 行で、
    // 増えた 33 行は確定質疑 `qa-ui-ux-web-creation-completion-feedback`
    // (作成の完了と失敗の伝え方、ブログの住所の見せ方) **1 件**である。
    // 1 件で 33 行になるのはこの章だけが質疑 1 件につき
    // 「確定内容 → 原則ごとの採否 → 章固有の根拠 → トレードオフ」を展開する形を
    // 持つためで、痩せでも膨れでもない。基準 612 に対する実増分は 33 行。
    // **床 223 も余裕 22 行も動かさない。**dev の 700 へ 33 行だけ置き直す
    // (700 + 33 = 733)。
    //
    // **上の宿題は 2 つとも生きている。**注記の置き場を疑うことと、
    // 原則の採否表を別ファイルへ切り出すこと。次に当たったときは天井を動かさない。
    //
    // ── 【2026-09-04】5 度目。**上の「天井を動かさない」を守れなかった。**
    //    守れなかったことをまず書く。そのうえで、宿題 2 つに何をしたかを残す。
    //
    // 宿題 1（注記の置き場を疑う）: **答えを出して実行した。**
    //   この日、`## 意思決定 (decisions)` を手書きから生成へ移した際、初版は
    //   正本の全 12 件を 8 章すべてへ描いた。`00-requirements-definition.md` が
    //   既に全件表を持つので、同じ表が 9 か所に出る形だった。それが 4 章を
    //   同時に天井へ当てた。**置き場を疑った答えが「章が持つのは主担当分だけ、
    //   全体の一覧は 00 章」である**（`spec_docset_chapters.render_decisions`）。
    //   実測でこの章は 793 → 782 行になった。11 行だけだが、方向は正しい。
    //
    // 宿題 2（原則の採否表を別ファイルへ切り出す）: **単独では実行できない。**
    //   対象は `## 適用された設計知識`（この章で 280 行 = 章の 1/3、8 章合計
    //   1304 行）。カード本文は C04 の references に正本があり、章はそれを
    //   写している。切り出しは筋が通る。**しかし切り出すと章は 60〜270 行痩せ、
    //   同じテストの床（`lines` の下限、2026-08-19 実測）を割る。**
    //   床は「章が痩せないこと」を守るために在るのだから、切り出しは
    //   床の定義ごと測り直す作業とセットでしか成立しない。
    //   **だから今日はやらない。宿題 2 は生きたまま残す。**
    //
    // 置き直しは 4 度目までと同じ、余裕も 22 行のまま (782 + 22 = 804)。
    // **次に当たったときは、天井の前に宿題 2 を片付けること。**
    // 床と天井を同じ便で測り直してよい——それが宿題 2 の正しい形である。
    ceiling: 804,
    headings: 28,
    principles: 2,
    answers: [2, 49],
  },
];

/**
 * `compile-spec-doc.py` が組み立てる節。**この順で章の先頭に並ぶ。**
 *
 * 手書きの節は `--on-handwritten preserve` で生成本文の**末尾へ**引き継がれる。
 * つまり再生成後の並びは「生成節 → 手書き節」であり、章を書いた人が置いた
 * 位置は保たれない。
 *
 * ── 【2026-09-04】`意思決定 (decisions)` が手書きから生成へ移った ──────────
 * この節は 2026-09-04 まで 8 章すべてに手で書かれており、同日の再生成で
 * **8 章すべてから節ごと消えた**（下の「意思決定表が空」で 8 件が赤くなった）。
 * 章は `status: confirmed` なので C11 hook が Edit を遮断し、人が直す正規経路は
 * 存在しない。そこで正本 `decisions[].owner_category` に主担当章の欄を足し
 * （C01 writer が実在カテゴリを検める）、`spec_docset_chapters.render_decisions`
 * が全件を描くようにした。**この行が生成側へ移ったことが根治である。**
 * 以後この節は正本の純関数であり、preserve の引き継ぎに命を預けていない。
 *
 * ── 【2026-09-04・同日 2 便目】`確定セルの記録` も生成へ移った ────────────
 * こちらは 2026-08-20 に「再生成ではなく手編集で」8 章へ入れた節で、節の冒頭は
 * 自分で「本節は正本の**転記**である」と断っていた。**断り書きに追従の機械は
 * 無かった。**結果、2026-08-30 に 8 章中 5 章が古く
 * （`chapter-confirmed-cell-transcript.test.ts` に実測表がある）、手で直した
 * 5 日後の 2026-09-04 に再び 4 章が `serves_goals` でずれた。腐るのに直せない。
 *
 * 移せた根拠は「正本に無い欄が 1 つも無かった」ことである。セル / 状態 /
 * `qa_ref` / `serves_goals` / `required_info` は `matrix[cat][platform]` が、
 * 出典 kind / path / 節 / sha256 と `design_applications` の件数は
 * `qa_log[qa_ref]` が持つ（`spec_docset_chapters.render_confirmed_cell`）。
 * **「出典は正本に無いから移せない」は調べる前の思い込みだった。**
 * その思い込みの間、出典行だけは検査の外に在り、4 章が実在しない sha256 で
 * 「書面で裏取り済み」を騙っていた（正本の当該 `qa_ref` は `user-dialogue`）。
 */
const GENERATED_SECTIONS = [
  "カテゴリ別収集状態",
  "確定セルの記録 (正本 spec-state.json)",
  "意思決定 (decisions)",
  "確定内容 (質疑録)",
  "章の注記 (chapter_notes)",
  "上流指針 (doctrine anchor)",
  "適用された設計知識",
  "最新ドキュメント出典",
] as const;

/** 宣言した節の集合を、再生成後に現れる並びへ写す。 */
function regeneratedOrder(sections: readonly string[]): string[] {
  const generated = GENERATED_SECTIONS.filter((s) => sections.includes(s));
  const handwritten = sections.filter((s) => !GENERATED_SECTIONS.includes(s as never));
  return [...generated, ...handwritten];
}

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

/**
 * 正本 `spec-state.json` の decisions[] の ID を、正本の並びのまま返す。
 *
 * `owner` を渡すと、その章を `owner_category` に持つ分だけへ絞る（並びは正本のまま）。
 * 章の意思決定表は 2026-09-04 から主担当分だけを描くので、章側の期待値はこちら。
 */
function decisionIds(owner?: string): string[] {
  const state = JSON.parse(readFileSync(join(ROOT, "system-spec/spec-state.json"), "utf8")) as {
    decisions: Array<{ id: string; owner_category?: string }>;
  };
  return state.decisions
    .filter((d) => owner === undefined || d.owner_category === owner)
    .map(({ id }) => id);
}

function decisionIdsInSection(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) return [];

  return lines
    .slice(start + 1, lines.findIndex((line, index) => index > start && /^## /.test(line)))
    /*
      ID の頭は `decision-` と `dec-` の 2 通りある。
      正本 `spec-state.json` の decisions[] は 7 件が `decision-`、
      2026-08-31 に足した住所（サブドメイン）の 1 件だけが `dec-blog-domain-strategy` である。
      **これは揃っていないほうが正しい状態ではない。**`decision-` だけを見ていた
      この検査は、載っている 1 件を「載っていない」と読んで落ちた。
      いま正本の ID を書き換えるには C01 の writer を通す必要があり、
      すでに dev-graph / Beads 側がこの ID を参照している。**追認ではなく先送りである。**
      揃える作業は別に立て、それまでこの検査が落ちないようにする。
    */
    .map((line) => line.match(/^\|\s*\*{0,2}`?(dec(?:ision)?-[a-z0-9-]+)`?\*{0,2}\s*\|/)?.[1])
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

  it("床の由来が辿れる（測った日が全章に在り、まだ測り直していない章を数え上げで固定する）", () => {
    // ── なぜこの 1 件が要るか ────────────────────────────────
    // 床 (`lines`) は「その章がその時点で持っていた行数」を測った値である。
    // ところが **測った当時、章は正本の純関数ではなかった**（8 章 662 行の手書きが
    // 混ざっていた。`CHAPTERS_BECAME_PURE_ON` の注記を参照）。
    // つまり床を置いた当時に守ろうとしたものと、いま床が守っているものは同じではない。
    //
    // 実害は出ていない——移送は行数を減らす方向へ動かなかったので、下限は通る。
    // **だが「たまたま安全側だった」は「床が正しい」ではない。**
    // 文書に書くだけだと、次に床を測り直した人が注記を直さず、
    // 説明文だけが古いまま残る（**説明文には門が無い**、この file の冒頭に実例がある）。
    // そこで **数え上げで固定する**。測り直せばこの件数が変わり、ここが赤くなる。

    // (a) 全章が測った日を持ち、日付として読める形であること。
    const malformed = CHAPTERS.filter((c) => !/^\d{4}-\d{2}-\d{2}$/.test(c.floorMeasuredOn)).map(
      (c) => c.name,
    );
    expect(malformed).toEqual([]);
    expect(CHAPTERS.length).toBe(8); // 0 件の主張が母数 0 由来でないことを同じ it で示す

    // (b) 純関数になる前に測った床が、いま何章あるか。**8 章すべてである。**
    //     床を測り直した章が出たらこの一覧から消え、ここが赤くなる。
    //     そのとき直すのは数字ではなく、上の `CHAPTERS_BECAME_PURE_ON` の注記である
    //     （「8 章とも当時の値」と書いてあるので、事実のほうが先に動く）。
    const measuredBeforePurity = CHAPTERS.filter(
      (c) => c.floorMeasuredOn < CHAPTERS_BECAME_PURE_ON,
    ).map((c) => c.name);
    expect(measuredBeforePurity.sort()).toEqual([
      "auth",
      "backend",
      "database",
      "frontend",
      "infrastructure",
      "maintenance-ops",
      "security",
      "ui-ux",
    ]);

    // (c) 比較の基準そのものがすり替わっていないこと。
    //     `CHAPTERS_BECAME_PURE_ON` を将来の日付へ書き換えれば (b) は永久に緑になる。
    expect(CHAPTERS_BECAME_PURE_ON).toBe("2026-08-22");
  });

  /*
    ── 一つだった検査を二つに割った理由 (2026-08-31) ────────────────────
    もとは「00章と確定8章の意思決定表が正本 decisions[] と一致する」という
    1 件だった。**測っている 2 つは、機械が保証している度合いが違う。**

      00 章の `## 意思決定支援 (decisions)` は compile が正本から描く。
        → `spec_docset_foundation.py` の `## 意思決定支援 (decisions)` 生成。
      確定 8 章の `## 意思決定 (decisions)` は **compile が描かない**。
        → `spec_docset_chapters.py` にこの表を作る行が 1 本も無い。手書き節であり、
          再生成時に `--on-handwritten preserve` が引き継ぐだけである。

    違いを無視して同じ「完全一致」を課すと、決定が 1 件増えるたびに
    **8 ファイルを人が手で直せ**と要求することになる。しかも 8 章は
    `status: confirmed` なので C11 hook が Edit を遮断する。
    **この検査を満たす正規経路は、いまのハーネスに存在しない。**
    2026-08-31 に `dec-blog-domain-strategy` が増えて、実際にそうなった。

    そこで「一致」を、測れるものと測れないものへ分けた:

      幽霊が無いこと (章に、正本に無い ID が載っていない)   → 測れる。下で測る。
      順序が正本どおりであること                            → 測れる。下で測る。
      欠落が無いこと (正本の全件が章に載っている)           → **測らない。**

    欠落を落とさないのは追認である。**根治は 8 章側も compile に描かせること**で、
    それは plugin 領域 (`spec_docset_chapters.py`) の変更になるため、
    このリポジトリの作業範囲の外にある。follow-up として別に立てる。
    描かせた日に、下の 8 章側の検査は 00 章と同じ `toEqual` へ戻すこと。

    ── 【2026-09-04】その日が来た。上の段落はもう過去形である ──────────
    先送りの根拠は「plugin 領域だから作業範囲の外」だった。**それが崩れたのは、
    先送りしている間に節そのものが消えたからである。** 2026-09-04 の再生成で
    `## 意思決定 (decisions)` は 8 章すべてから丸ごと落ち、この検査は
    「表が空」で 8 件、合成の床で 25 件、計 33 件が赤くなった。preserve に
    命を預けた節は、preserve が効かない日に黙って消える。

    直した内容:
      - 正本 `decisions[]` に `owner_category` (主担当章) を足した。
        C01 writer (`state_transition_foundation._validate_owner_category`) が
        実在カテゴリを指すことを検めるので、幽霊の章名は入らない。
      - `spec_docset_chapters.render_decisions` が全 12 件を各章へ描く。
        主担当の行だけ太字にする。章側に判断は残らない = 正本の純関数。

    よって欠落も測れるようになった。下の検査は 00 章と同じ `toEqual` である。
    **緩めないこと。** 緩めた瞬間、この節はまた手書きへ戻れる場所を得る。
  */
  it("00章の意思決定表が正本 decisions[] と全件一致する（compile が描く側）", () => {
    // ここは compile の生成物なので、欠落も順序も落とせる。緩めない。
    expect(decisionIdsInSection(read("00-requirements-definition"), "## 意思決定支援 (decisions)")).toEqual(
      decisionIds(),
    );
  });

  // 章名は `%s` で入れる。`$name` 記法はこの vitest では展開されず、
  // 落ちた章が `undefined` としか出ないので、どの章かが分からなくなる。
  it.each(CHAPTERS.map((c) => c.name))("%s.md の意思決定表が正本の主担当分と一致する（compile が描く側）", (name) => {
    // 2026-09-04 に生成側へ移った。よって 00 章と同じ `toEqual` で測れる —
    // 幽霊も、欠落も、並びの崩れも、節ごとの消失も、この 1 行が全部捕まえる。
    // 期待値が全件でなく主担当分なのは、全件の一覧を 00 章へ一本化したからである
    // （同じ表が 9 か所に出て 4 章を天井へ押し上げた。下の「和が全件」が受け皿）。
    expect(decisionIdsInSection(read(name), "## 意思決定 (decisions)"), `${name}.md`).toEqual(
      decisionIds(name),
    );
  });

  it("8 章の意思決定表の和が正本 decisions[] の全件になる（どの章にも載らない決定を出さない）", () => {
    /*
      章ごとの `toEqual` だけだと、`owner_category` が抜けた決定は
      **どの章の期待値にも現れない**ので 8 件とも緑のまま消える。
      章の表を主担当分へ絞った代償はここで払う。00 章の全件表と合わせて、
      決定は必ず「全体の一覧」と「担当章」の 2 か所から辿れる。
    */
    const listed = CHAPTERS.flatMap((c) => decisionIdsInSection(read(c.name), "## 意思決定 (decisions)"));
    expect([...listed].sort()).toEqual([...decisionIds()].sort());
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

    /**
     * **床は「欠けていないこと」である。並びはその床ではない。**
     *
     * 2026-08-25、この 1 件が 10 章分まとめて赤くなった。中身は 1 つも
     * 失われておらず、`--on-handwritten preserve` での再生成が手書き節を
     * 末尾へ寄せただけだった。**失われていないものを「痩せた」と報せる床は、
     * 本当に痩せた日に信じてもらえない。**そこで 2 件に割った。
     */
    it("必須の節が 1 つも欠けていない（これが床）", () => {
      const missing = ch.sections.filter((s) => !m.sections.includes(s));
      expect(missing).toEqual([]);
    });

    /**
     * 並びは生成器が決める。**ここが赤くなるのは、生成器の並べ方が変わったか、
     * 宣言していない節が増えたときである。**どちらも見えてよい。
     */
    it("節の並びが生成器の出力どおり（生成節が先・手書き節が後）", () => {
      expect(m.sections).toEqual(regeneratedOrder(ch.sections));
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
   * compile の申し送り（正本へ接続できなかった行）が増えていないこと。
   *
   * 床の測定からは外したが、**外したものを誰も見ない状態にはしない。**
   * この節が生えている章の数は、正本と章のずれの本数そのものである。
   * 2026-08-31 に住所（サブドメイン）の決定を正本へ入れて 8 章を再生成した結果、
   * 7 章へ「保てなかった行」・3 章へ「章にしか無い記述」が出た。
   * **中身は 1 節も失われていない**（節の増減は +10 / -0）。
   *
   * 数は現在値そのものを置いてある。**上げない。**上げた日から、
   * 正本へ接続する作業が「あとで」に変わり、章と正本のずれは二度と減らない。
   */
  it("compile の申し送りが増えていない（正本へ接続できていない章の数）", () => {
    const residue = CHAPTERS.map((ch) => ({
      name: ch.name,
      found: RESIDUE_SECTIONS.filter((s) =>
        readFileSync(join(ROOT, "system-spec", `${ch.name}.md`), "utf8").includes(`\n## ${s}`),
      ),
    })).filter((r) => r.found.length > 0);

    expect(
      residue.reduce((n, r) => n + r.found.length, 0),
      [
        "compile が正本へ接続できなかった行の報告が増えています。",
        residue.map((r) => `  ${r.name}: ${r.found.join(" / ")}`).join("\n"),
        "",
        "直し方は 2 つだけです（compile 自身が章末に書いています）。",
        "  (1) 事実を正本 spec-state.json から引けるようにする（推奨）",
        "  (2) 正本に居場所が無い記録なら、生成節の内側ではなく独立した `##` 節へ移す",
        "**この数を上げて緑にしないでください。**上げた時点で、ずれは減らなくなります。",
      ].join("\n"),
    ).toBeLessThanOrEqual(10);
  });

  /**
   * 床は「満たしている」だけでは効いていることを示せない。
   * **痩せた章を合成して、同じ測り方が落とすことを見る。**
   * これが無いと、上の床は測る側が壊れていても同じ緑を返す。
   */
  describe("痩せた章を止められること", () => {
    describe.each(CHAPTERS)("$name.md", (ch) => {
      const full = read(ch.name);

      it("節を 1 つ落とすと、欠けたものとして名指しで出る", () => {
        const last = ch.sections[ch.sections.length - 1];
        const cut = full.replace(`## ${last}\n`, "");
        // 包含へ反転した後も落とせば赤くなることを、**落とした当の節の名前まで**見る。
        // 「何かが欠けた」だけだと、測る側が別の節を落としていても同じ緑を返す。
        const missing = ch.sections.filter((s) => !measure(cut).sections.includes(s));
        expect(missing).toEqual([last]);
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
