/** @tier 2 @req REQ-S09 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 折り返さない横並びの**規則の形**を固定する。
 *
 * ==========================================================================
 * **この検査は、画面が溢れるかどうかを見ていない。見ることもできない。**
 * ==========================================================================
 *
 * ここで見ているのは CSS の規則の形だけである——「`display: flex` があって
 * `flex-wrap: wrap` が無い」。これは**書かれている規則**の話であって、
 * **組んだ結果**の話ではない。狭い画面でその行が実際に器を突き破るかは、
 * 中に何がいくつ入るかで決まり、それは CSS には書かれていない。
 *
 * **なぜ測らないのか。**このリポジトリには組版する仕掛けが無い。
 * `playwright` も `puppeteer` も入っておらず、テストで使っている jsdom は
 * 組版を一切しない（幅も高さも常に 0 を返す）。だから「溢れた」を
 * 観測する手立てが 1 つも無い。UX-03 の 44px は `--tap-target-min` という
 * **値**を読めば言えるので測れるが、溢れは値ではなく**結果**なので読めない。
 * 依存を足して組版する道は 2026-08-21 に検討して見送った（残課題 143 ⑥）。
 *
 * **それでも形を見張る理由。**折り返さない横並びの min-content 幅は、
 * 子の min-content 幅の**和**になる。つまり折り返しの失敗で溢れるには、
 * 子が 2 つ以上あって、しかもそのどれかが**それ以上折れない**必要がある。
 * 日本語の文は 1 文字ずつ折れるので、実際の主犯は
 * **切れない長い英数字の並び**（URL・識別子・API キーの見本など）である。
 * 2026-08-21 に全画面を描いて数えたところ、下の一覧のどの規則の中にも
 * 20 文字以上の切れない英数字は **1 件も無かった**。
 * だから今日の時点では、形を見張るだけで足りると判断した。
 * **この判断は中身が変われば崩れる。**識別子や URL を画面に出し始めたら、
 * この doc ごと読み直すこと。
 *
 * ---
 *
 * **除外の書き方について。**下の一覧の理由は、すべて 2026-08-21 に
 * 全画面（`ROUTE_CASES` + `ROUTE_STATE_CASES`）を描いて数えた**子の数**に
 * 基づく。数は doc に残してあるが、**数え直しは自動では起きない**。
 * 一覧に載っている規則の中身が増えたとき、ここは黙って通る。
 *
 * **「走査に 1 度も現れないから安全」を理由にしてはいけない。**
 * それは「安全だ」ではなく「見えていない」である（残課題 141 / 143 ③）。
 * `.feedbackDialog` は実際に 0 回しか現れないが（押して初めて開く
 * client 側の状態のため）、除外の理由はそこではなく、
 * **直の子が 1 つで、その幅が器を超えない**という構造のほうに置いてある。
 */

const ROOT = process.cwd();

/**
 * 除外の一覧。**鍵は「ファイル + セレクタ」、値は理由。**
 *
 * `measured` は描いて数えた実測（**全行 2026-08-21 18:20 の 1 回の走行**）。
 * `reason` はそこから導いた判断。
 * 数と判断を分けてあるのは、**数が古びたことと判断が間違っていたことは
 * 別の直し方になる**ため。
 */
type Exemption = {
  /** 描いて数えた結果（出現回数と、直の子の数の分布）。 */
  readonly measured: string;
  /** なぜ折り返さなくてよいのか。**「現れないから」は理由にならない。** */
  readonly reason: string;
};

const EXEMPT: Record<string, Exemption> = {
  // --- 中身が文字だけ（直の子が 0 個）------------------------------------
  // 折り返しの失敗では溢れない。中の文字はふつうの行の折り返しで折れる。
  // ==========================================================================
  // **数の時刻について（2026-08-21 18:20 に全 27 行を 1 回の走行で取り直した）。**
  //
  // 取り直す前、ここには**時刻の違う数が混ざっていた。**18:00 より前に数えた行は、
  // 走査が運営側 13 画面を**一度も描いていなかった**ときの数だった（権限の断り
  // 1 枚に置き換わっていた。残課題 141 / 154）。18:00 以降の行はその後の数である。
  //
  // **実例:** `.navLink` は同じ数え方で **714 → 798** になった。規則も JSX も
  // 1 文字も変えていない。**増えたのは母集団のほうである。**
  //
  // **一覧の一貫性は、行の性質ではなく、一覧が取られた瞬間の性質である。**
  // 古い行同士も新しい行同士も整合していて、**混ぜたときだけ壊れる**——だから
  // 行ごとの検算では見つからない。次に数が古びたときも、**気づいた行だけ直さず、
  // 全部を 1 回の走行で取り直すこと。**1 行だけ新しい時刻を混ぜると、混ざりの
  // 度合いが分からない一覧に戻る。
  //
  // **数え方（再現の手順）。**`ROUTE_CASES` + `ROUTE_STATE_CASES` を全部描き、
  // 鍵のセレクタで `querySelectorAll` して出現回数と直の子の数を数える。
  // **CSS Modules はクラス名を `_name_hash` に変えるので、`.foo` は
  // `[class*="_foo_"]` に読み替える必要がある**——`.foo` のまま当てると
  // **エラーにならずに 0 が返る。**「無い」と「探し方が違う」が同じ 0 に化ける。
  //
  // **この数え方で分けられないもの:** クラス名が同じで**ファイルが違う**規則
  // （`.breadcrumb a` が `ui.module.css` と `site.module.css` の両方に在る）。
  // 描いた DOM にはファイルの出どころが残らないので、**両方の行に同じ数が立つ。**
  // ==========================================================================
  "src/presentation/ui/patterns/patterns.module.css :: .channelLink": {
    measured: "配信先状態の行き先。中身は配信先名の文字だけ（2026-08-23）",
    reason: "44px の押しどころを作るための inline-flex で、横に並べる直の子を持たない",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .navCollapseToggle": {
    measured: "管理画面の案内を畳む操作 1 個（2026-08-23）",
    reason: "印と読み上げ用の名前を一つの操作として保ち、ボタンの途中では折り返さない",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .productCardName > a": {
    measured: "Chromium実DOMで修正前の高さ23px（2026-08-21）",
    reason: "商品名の文字1つを包むリンクで、44pxの的を作るためだけのinline-flex",
  },
  "src/presentation/ui/primitives/ui.module.css :: .headingLevel2 > a": {
    measured: "Chromium実DOMで修正前の高さ28px（2026-08-21）",
    reason: "見出し文字1つを包むリンクで、44pxの的を作るためだけのinline-flex",
  },
  // ブログ名・本文中の行き先・記事題の 3 つは、同じ「文字 1 つを包んで 44px の
  // 押しどころを作る」規則なので 1 本にまとめてある（2026-08-31 の統合）。
  // 3 つに分かれていたときは、下限を直すのに 3 か所を直す必要があった。
  "src/presentation/ui/templates/site.module.css :: .siteName,\n.article a,\n.cardTitle a": {
    measured: "文字 1 つを包むリンク 3 種（ブログ名・本文中の行き先・記事題）（2026-08-31）",
    reason: "44px の押しどころを作るためだけの inline-flex。中身は文字だけで折り返す先が無い",
  },
  "src/presentation/ui/templates/site.module.css :: .tableOfContents a": {
    measured: "目次 1 項目のリンク。中身は節の見出し文字だけ（2026-08-30）",
    reason: "44px の押しどころを作るためだけの inline-flex。折り返しは器の ul 側が持つ",
  },
  "src/presentation/ui/templates/site.module.css :: .articleIntroAuthorName a,\n.articleAuthorProfileName a": {
    measured: "書き手の名前を包むリンク。見出しの中に単独で在る（2026-08-30）",
    reason: "44px の押しどころを作るためだけの inline-flex。中身は名前の文字 1 つ",
  },
  "src/presentation/ui/templates/site.module.css :: .siteName": {
    measured: "Chromium実DOMで修正前の高さ32.39px（2026-08-21）",
    reason: "ブログ名の文字1つを包むリンクで、44pxの的を作るためだけのinline-flex",
  },
  "src/presentation/ui/templates/screen-parts.module.css :: .factRow dd > a": {
    measured: "項目と値の一覧で値として置かれる行き先（2026-08-23）",
    reason: "中身は文字だけで、44px の押しどころを作るための inline-flex",
  },
  "src/presentation/ui/templates/screen-parts.module.css :: .list > li > a": {
    measured: "共通一覧の主項目として置かれる行き先（2026-08-23）",
    reason: "中身は文字だけで、44px の押しどころを作るための inline-flex",
  },
  "src/presentation/ui/templates/screen-parts.module.css :: .table td > a,\n.table th > a": {
    measured: "共通表の升目に単独で置かれる行き先（2026-08-23）",
    reason: "表の升目は flex の器ではないため、44px の下限を効かせる inline-flex が要る",
  },
  "src/presentation/ui/templates/screen-parts.module.css :: .rowSelector": {
    measured: "表の行を選ぶチェック箱と説明の対（2026-08-23）",
    reason: "チェック箱と説明が別の行に分かれると対応が読めないため、一つの選択肢として保つ",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .table td > a,\n.table th > a": {
    measured: "17 回 / 子 0 のみ（18:20。`td` 側 5・`th` 側 12）",
    reason:
      "表の升目の中の行き先 1 本。中身が文字だけ。**`td` / `th` は flex の器ではない**ので、" +
      "下限を効かせるのに inline-flex が要る。折り返しは器の表側が持つ",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .boardLink > a": {
    measured: "14 回 / 子 0 のみ（18:20。器の `.boardLink` の 14 回と同数）",
    reason:
      "板の 1 枚に入る行き先 1 本。中身が文字だけ。**器の `.boardLink` が既に flex なので下限だけでも" +
      "効くが、それだと文字が箱の上端に寄る**——`align-items: center` を効かせるために自身も flex にする",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .defValue > a": {
    measured: "1 回 / 子 0 のみ（18:20。`distribution/[publication]` の 1 本）",
    reason:
      "定義の値に置かれた行き先 1 本。中身が文字だけ。**`dd` は flex の器ではない**ので、" +
      "下限を効かせるのに inline-flex が要る",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .productCardFooter > a": {
    measured: "3 回 / 子 0 のみ（18:20）",
    reason:
      "札の下端の行き先 1 本（リンクか断り文のどちらか）。中身が文字だけ。" +
      "**器が flex なので下限だけでも効くが、文字が上端に寄る**ので自身も flex にする",
  },
  "src/app/admin/admin.module.css :: .rankBadge": {
    measured: "3 回 / 子 0 のみ（18:20）",
    reason: "中身は順位の数字 1 つだけで、横に並べる相手がいない",
  },
  "src/app/admin/admin.module.css :: .densityNavRowFixed": {
    measured: "3 回 / 子 0 のみ（18:20）",
    reason: "中身が文字だけ。見本帳で行送りの直し方を見せるためのもの",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .stubLabel": {
    measured: "49 回 / 子 0 のみ（18:20。取り直す前は 38 回）",
    reason: "中身が文字だけ（まだ本物でないことを言う札）",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .consentUndo": {
    measured: "2 回 / 子 0 のみ（18:20）",
    reason: "中身が文字だけ（取り消しの操作 1 つ）",
  },
  "src/presentation/ui/primitives/ui.module.css :: .autoNote": {
    measured: "2 回 / 子 0 のみ（18:20）",
    reason: "中身が文字だけ（自動で決まったことの注記）",
  },
  "src/presentation/ui/primitives/ui.module.css :: .navLink": {
    measured: "798 回 / 子 0 のみ（18:20。取り直す前は 714 回。上の断りの実例）",
    reason: "中身が文字だけ。案内の 1 行で、横に並べる相手がいない",
  },
  "src/presentation/ui/primitives/ui.module.css :: .breadcrumb a": {
    measured:
      "77 回 / 子 0 のみ（18:20。**下の site.module.css の行と同じ物を数えている**——" +
      "クラス名が同じでファイルが違うものは、描いた DOM から分けられない）",
    reason: "中身が文字だけ。折り返しは器の .breadcrumb 側が持っている",
  },
  // **この 3 行（`.headerActions > a` / `.calloutAction > a` / `.seeAlso > a`）は、
  // 18:20 の取り直しで数が大きく動いた。**取り直す前の数は出現回数ではなく
  // **押しどころの下限が無い件数（赤の本数）**だったためである。赤は
  // `isInlineLink()` で外れるぶん少なく出ることも、直したぶん減ることもあるので、
  // **出現回数とは上にも下にもずれる:** 35→40 / **79→21** / 9→13。
  //
  // **数え方の違いは、大きさの違いとして出るとはかぎらない。**79→21 は
  // 3 分の 1 以下だが、35→40 は 1 割強しか動いていない。**動きが小さい行ほど、
  // 別の量が混ざっていても気づかれない。**
  "src/presentation/ui/primitives/ui.module.css :: .headerActions > a": {
    measured: "40 回 / 子 0 のみ（18:20。取り直す前は赤 35 本）",
    reason:
      "中身が文字だけ（画面の右上に置く行き先 1 つ）。inline-flex は 44px の的を作るためだけに" +
      "書いており、器の .headerActions が flex-wrap: wrap を持っているので折り返しはそちらが持つ",
  },
  "src/presentation/ui/primitives/ui.module.css :: .calloutAction > a": {
    measured: "21 回 / 子 0 のみ（18:20。取り直す前は赤 79 本）",
    reason:
      "中身が文字だけ（Callout の行き先 1 つ）。**ここの inline-flex は的のためだけではなく、" +
      "min-height を効かせるために要る**——親の span は flex 項目として塊になるが、" +
      "中の a は素の inline のままで、inline のままだと min-height が当たらない",
  },
  // **`.note` の行ではない。**
  // `.note` は文で、うち 2 箇所は文の中にリンクが入っているので同じ規則を当てられない。
  // 役を分けたのはそのためで、**まとめると「巻き込まれない」が失われる**
  // （`tests/ui/note-role.test.ts` が、まとめられていないことを見ている）。
  "src/presentation/ui/patterns/patterns.module.css :: .seeAlso > a": {
    measured: "13 回 / 子 0 のみ（18:20。取り直す前は赤 9 本）",
    reason:
      "中身が文字だけ（本文の後ろに置く行き先）。**inline-flex は min-height を効かせるために要る**" +
      "——親の p は塊だが中の a は素の inline のままで、inline のままだと min-height が当たらない。" +
      "行き先が 2 本以上並ぶ場合の折り返しは器の p 側が持つ",
  },
  // **`.seeAlso > a` と同じ形だが、別の規則として数える。**
  // あちらは節の末尾の行き先 1 本、こちらは並んだ選択肢で、
  // 折り返しと項目間の間合いをこちらだけが要る（`scope-switch.tsx` の doc）。
  "src/presentation/ui/patterns/patterns.module.css :: .scopeSwitch a": {
    measured: "2026-08-27 新設。子 0 のみ（中身は行き先 1 つぶんの文字）",
    reason:
      "中身が文字だけ（切り替え先 1 つ）。**inline-flex は min-height を効かせるために要る**" +
      "——親の p は塊だが中の a は素の inline のままで、inline のままだと min-height が当たらない。" +
      "行き先が並ぶときの折り返しは器の .scopeSwitch 側が `flex-wrap: wrap` で持つ",
  },
  "src/presentation/ui/templates/site.module.css :: .siteNav a": {
    measured: "105 回 / 子 0 のみ（18:20）",
    reason: "中身が文字だけ。折り返しは器の .siteNav 側が持っている",
  },
  "src/presentation/ui/templates/site.module.css :: .footerLinks a": {
    measured: "168 回 / 子 0 のみ（18:20）",
    reason: "中身が文字だけ。折り返しは器の .footerLinks 側が持っている",
  },
  // `site.module.css :: .breadcrumb a, nav.section a` はここに在ったが、
  // パンくずの押しどころが `ui.module.css` の 1 本に寄り、こちら側は色の指定だけに
  // なった（2026-08-31）。折り返さない規則ではなくなったので一覧から外す。

  // --- 直の子が 1 つまで --------------------------------------------------
  // 子が 1 つなら、折り返しても並びが変わらない（折り返す相手がいない）。
  "src/presentation/ui/patterns/patterns.module.css :: .factBadge": {
    measured: "57 回 / 子 1 のみ（18:20。取り直す前は 50 回）",
    reason: "印 1 つと文字。子が 1 つまでなので、折り返しても並びが変わらない",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .flowStep": {
    measured: "21 回 / 子 0×16・子 1×5（18:20。取り直しても同じ）",
    reason: "手順の 1 段。子が 1 つまでなので、折り返しても並びが変わらない",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .boardLink": {
    measured: "14 回 / 子 1 のみ（18:20。取り直しても同じ）",
    reason: "リンク 1 つ。子が 1 つまでなので、折り返しても並びが変わらない",
  },
  "src/presentation/ui/primitives/ui.module.css :: .button": {
    measured: "128 回 / 子 0×127・子 1×1（18:20。取り直す前は 100 回 / 子 0×99）",
    reason:
      "ボタンの中身は文字か印 1 つ。**ここが折り返すのはむしろ害**で、" +
      "ラベルが 2 行に割れると押しどころの形が読めなくなる",
  },
  "src/presentation/ui/primitives/ui.module.css :: .choiceItem": {
    measured: "65 回 / 子 1 のみ（18:20。取り直す前は 63 回）",
    reason: "選択肢 1 つ（丸と文字）。子が 1 つまでなので、折り返しても並びが変わらない",
  },

  // --- 構造で溢れない -----------------------------------------------------
  "src/presentation/ui/patterns/patterns.module.css :: .feedbackDialog": {
    measured: "0 回（18:20。押して初めて開く client 側の状態。走査に届いていない）",
    reason:
      "直の子が .feedbackPanel 1 つだけで、その幅が min(100%, var(--readable-max-width)) なので" +
      "器を超えない。折り返す余地が構造として無い",
  },

  // --- 子が 2 つ以上ありうる規則 ------------------------------------------
  "src/presentation/ui/patterns/patterns.module.css :: .productCardSpecValue": {
    measured: "20 回 / 子 1×5・子 2×15（18:20。取り直しても同じ）",
    reason:
      "値と単位の対で、どちらも短い日本語か数字。" +
      "切れない長い英数字が入り込んだら、ここが最初に溢れる",
  },
  // EHIJ が 18:17 に足した行（`admin.module.css` は EHIJ の持ち場）。
  // **足した時点では `measured` が赤の数で書かれていて、他の行と別の量だった。**
  // それを断って渡してきたので、18:20 の取り直しに含めて出現回数へ差し替えた。
  // **断りが無ければ、別の量が同じ欄に入ったまま緑で残っていた。**
  //
  // このとき EHIJ は `.productCardSpecValue` の理由から
  // 「**この一覧で唯一、子が 2 つ以上入る**」も外している——**この行を足した瞬間に
  // その文が誤りになるため。**一覧に 1 行足すことが、離れた行の**理由の文**を
  // 誤りにする形である。数と違って、こちらは走らせても赤にならない。
  //
  // `.rankTable label` と `.rankTable td > a` はここに在ったが、順位の表が
  // 共通の `RankingTable` へ移り、`admin.module.css` から規則ごと消えた（2026-08-31）。
  // 一覧から外す。**残しておくと、もう存在しない規則が理由つきで居座る。**
  "src/presentation/ui/patterns/patterns.module.css :: .decisionStatus": {
    measured: "判断状態の札。印 1 個と「まだ判定できません」等の短い文（2026-08-31）",
    reason:
      "札は状態そのもので、途中で折れると印だけが行に取り残されて別の状態に読める。" +
      "中身は短い決まり文句だけなので、折り返す先が無い",
  },
  // ── 記事本文の断片（`presentation/prose`）────────────────────────────
  // **5 件とも「折り返させない」ではなく「折り返す先が無い」。**
  // 印と短い名前、あるいは印 1 個だけを包む横並びで、途中で折り返すと
  // 印だけが行に取り残される。帯そのもの（`.proseEditorBar` /
  // `.proseEditorActions` / `.proseEditorAdd`）は折り返す側へ直した。
  "src/presentation/prose/prose.module.css :: .proseCallout": {
    measured: "記事の中の注意書き。左に印 1 個、右に題と本文の列（2026-08-26）",
    reason:
      "印を本文の上へ回さないための横並び。狭い画面で溢れるのは本文の側なので、" +
      "縮む役は内側の `.proseCallout > div` が `min-width: 0` で受け持つ",
  },
  "src/presentation/prose/prose.module.css :: .proseEditorKind": {
    measured: "編集中の断片の種類名。印 1 個と「箇条書き」程度の短い語（2026-08-26）",
    reason: "印と種類名は 1 つの名前として読まれる。途中で折り返すと印だけが前の行に残る",
  },
  "src/presentation/prose/prose.module.css :: .proseEditorIconButton": {
    measured: "断片を上下へ動かす・消す操作 1 個ぶん（2026-08-26）",
    reason: "印 1 個を 44px の押しどころの中央へ置くためだけの inline-flex で、並べる直の子を持たない",
  },
  "src/presentation/prose/prose.module.css :: .proseEditorItemRow": {
    measured: "箇条書き 1 項目ぶん。行頭の印と、1 行の入力欄（2026-08-26）",
    reason:
      "印を入力欄の上へ回さないための横並び。長い項目で溢れないよう、" +
      "入力欄の側に `min-width: 0` を置いて縮ませている",
  },
  "src/presentation/prose/prose.module.css :: .proseEditorMenuItem": {
    measured: "`/` の候補 1 つぶん。印 1 個と「比較表」程度の短い語（2026-08-26）",
    reason: "候補は 1 行で読み切れることが選びやすさそのもので、折り返すと候補の境目が消える",
  },
  "src/presentation/prose/prose.module.css :: .proseOutline a": {
    measured: "目次の 1 項目。中身は「1. 選び方の順番」のような文字だけ（2026-08-26）",
    reason:
      "横並びにしているのは中身を並べるためではなく、押しどころの下限 " +
      "(`--tap-target-min`) を素の `<a>` へ効かせるため。子は文字ひとかたまりだけで、" +
      "**折り返す先が無い**（長い項目名は文字の側が普通に折り返す）",
  },
  // ── 読者向けブログの骨格（2026-08-30 の統合で合流）──────────────────
  // **7 件とも、縮む役を別の規則が持っている。**折り返しを足すのではなく、
  // 「どこが縮むか」を辿ってから除外している。辿れないものは除外しない。
  "src/app/admin/admin.module.css :: .publishedStatus": {
    measured: "公開済み記事の一覧に付く状態の印。中身は「公開中」「非表示」程度の短い語（2026-08-30）",
    reason:
      "丸い枠の中の 1 語。`white-space: nowrap` を自分で持っていて、" +
      "**枠と語が割れないことが印の意味そのもの**である。長い語は入らない",
  },
  "src/presentation/ui/primitives/ui.module.css :: .headerActions a": {
    measured: "上端の帯に並ぶ操作 1 個ぶん。押しどころの下限を素の `<a>` へ効かせる包み（2026-08-30）",
    reason:
      "横並びにしているのは中身を並べるためではなく、`min-height: var(--tap-target-min)` の" +
      "中央へ文字を置くため。子は文字ひとかたまりだけで**折り返す先が無い**。" +
      "帯の側（`.headerActions`）が `flex-wrap: wrap` を持ち、操作と操作の間で折れる",
  },
  "src/presentation/ui/templates/site.module.css :: .categoryArticleGroupHead": {
    measured: "分類ごとの見出し帯。左に題と説明の列、右に「もっと見る」1 個（2026-08-30）",
    reason:
      "題の列と、その分類へ進むリンク。**割れると「もっと見る」がどの分類のものか読めなくなる**。" +
      "縮む役は左の `div`（`display: grid`）が持ち、題も説明も文字の側で折り返す",
  },
  "src/presentation/ui/templates/site.module.css :: .categoryArticleGroupHead > a": {
    measured: "上の帯の右端のリンク 1 個。中身は「もっと見る」程度の短い語（2026-08-30）",
    reason: "押しどころの下限へ文字を収めるための包み。子は文字ひとかたまりだけで、折り返す先が無い",
  },
  "src/presentation/ui/templates/site.module.css :: .sidebarLinks a": {
    measured: "補助列の 1 項目。中身は分類名か記事の題（2026-08-30）",
    reason:
      "押しどころの下限（`--tap-target-min`）を素の `<a>` へ効かせるための横並び。" +
      "子は文字ひとかたまりだけで、長い題は文字の側が普通に折り返す",
  },
  "src/presentation/ui/templates/site.module.css :: .siteHeaderInner": {
    measured: "読者向けブログの上端。左にブログ名、右に検索の 2 つ（2026-08-30）",
    reason:
      "**名前と検索が上下に割れると、検索が本文の始まりに見える。**" +
      "縮む役は両側が持っていて、名前は `.siteIdentity` の `min-width: 0`、" +
      "検索は `.siteSearch input` の `min-width: 0` で受ける",
  },
  "src/presentation/ui/templates/site.module.css :: .siteNav": {
    measured: "ブログの分類の並び。項目数はブログの分類の数（見本は 3〜4）（2026-08-30）",
    reason:
      "**逃げ道が折り返しではなく `overflow-x: auto` である。**分類の並びは" +
      "「全部で何本あるか」が一目で分かることに意味があり、折り返すと段数が" +
      "分類の数で変わって上端の高さが画面ごとに動く。横へ流して、" +
      "はみ出した先は指と車輪で辿れるようにしてある",
  },
};

/** 除外の理由に書いてはいけない言い回し（要件 2）。 */
const NOT_A_REASON = ["現れない", "出てこない", "0 回だから", "見つからなかったから"];

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (name.endsWith(".css")) out.push(full);
  }
  return out;
}

type Rule = { readonly key: string; readonly body: string };

/**
 * CSS を規則の単位で切り出す。
 *
 * `@media` などの入れ子は、外側の `{}` を規則として拾わないように
 * セレクタが `@` で始まるものを飛ばすことで避けている
 * （中の規則は、外側を飛ばしたあとで同じ正規表現が拾う）。
 */
function rulesOf(file: string): Rule[] {
  const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith("@")) continue;
    out.push({ key: `${relative(ROOT, file)} :: ${selector}`, body: m[2] });
  }
  return out;
}

/** 折り返さない横並びか。縦積み（`column`）は横に溢れないので外す。 */
function isNoWrapRow(body: string): boolean {
  if (!/display:\s*(inline-)?flex/.test(body)) return false;
  if (/flex-wrap:\s*wrap/.test(body)) return false;
  if (/flex-direction:\s*column/.test(body)) return false;
  return true;
}

const ALL_RULES = cssFiles(join(ROOT, "src")).flatMap(rulesOf);
const NO_WRAP = ALL_RULES.filter((r) => isNoWrapRow(r.body));

describe("折り返さない横並びは、理由つきで数えられている", () => {
  it("走査そのものが空振りしていない（母集団の床）", () => {
    // 下の一致検査は、規則を 1 つも拾えていなくても
    // 「一覧と同じ」にはならないので落ちる——が、落ち方が
    // 「除外が全部消えた」に見える。原因を先に切り分けるための床。
    expect(ALL_RULES.length, "CSS の規則をほとんど拾えていません。切り出す側を先に疑うこと").toBeGreaterThan(
      250,
    );
    expect(
      cssFiles(join(ROOT, "src")).length,
      "CSS のファイルを歩けていません",
    ).toBeGreaterThanOrEqual(8);
  });

  it("折り返す規則と折り返さない規則を、実際に見分けている（陰性対照）", () => {
    // 「折り返さないものが 0 件」と「`flex-wrap` の判定が壊れて全部除外された」は
    // どちらも緑になりうる。両側に数が立っていることを見る。
    const wrapping = ALL_RULES.filter(
      (r) => /display:\s*(inline-)?flex/.test(r.body) && /flex-wrap:\s*wrap/.test(r.body),
    );
    expect(wrapping.length, "折り返す規則が 1 つも見つかりません").toBeGreaterThan(10);
    expect(NO_WRAP.length, "折り返さない規則が 1 つも見つかりません").toBeGreaterThan(10);
  });

  it("折り返さない規則は、一覧に載っているものだけである", () => {
    const found = NO_WRAP.map((r) => r.key).sort();
    // **両方向で見る。**足りない側（新しく増えた規則）だけを見ると、
    // 一覧に残った幽霊（もう存在しないセレクタ）が理由つきで居座る。
    expect(found).toEqual(Object.keys(EXEMPT).sort());
  });

  it("一覧のどの理由も、「走査に現れないから」ではない", () => {
    const bad = Object.entries(EXEMPT)
      .filter(([, v]) => NOT_A_REASON.some((phrase) => v.reason.includes(phrase)))
      .map(([k]) => k);
    // 「現れない」は「安全だ」ではなく「見えていない」である。
    // 見えていないものを理由に除外すると、走査の穴が除外の根拠に化ける。
    expect(bad, "除外の理由が「走査に現れない」になっています").toEqual([]);
  });

  it("一覧のどの行も、数と理由の両方を持っている", () => {
    const thin = Object.entries(EXEMPT)
      .filter(([, v]) => v.measured.trim().length < 4 || v.reason.trim().length < 12)
      .map(([k]) => k);
    expect(thin, "実測か理由が空です。理由を書かずに足さないこと").toEqual([]);
  });

  it("直したものが、一覧に戻ってきていない", () => {
    // 2026-08-21 に `flex-wrap` を足した 3 つ組（残課題 143 ⑤）。
    // **これは溢れを観測して直したのではなく、予防として足したもの**だが、
    // 足したものが誰かの手で消えたら、上の一致検査が「知らない規則」として
    // 落ちる——その落ち方だと原因が読めないので、名前で先に言う。
    const fixed = [
      "src/presentation/ui/primitives/ui.module.css :: .header",
      "src/presentation/ui/primitives/ui.module.css :: .breadcrumb",
      "src/presentation/ui/primitives/ui.module.css :: .headerActions",
    ];
    const back = NO_WRAP.map((r) => r.key).filter((k) => fixed.includes(k));
    expect(back, "予防として足した flex-wrap が消えています").toEqual([]);
  });
});

/*
 * ==========================================================================
 * `min-width: 0` — 折り返しとは**別の性質**
 * ==========================================================================
 *
 * flex の子の最小幅は既定で `auto`、つまり**中身より小さくならない**。
 * だから親に `flex-wrap: wrap` を書いても、子が縮めない限り帯ごと横へ広がる。
 * **2 つは対で効くが、掛かる相手が違う**——`flex-wrap` は**親**、
 * `min-width: 0` は**子**。
 *
 * `docs/product/ui-ux-tasks.md` UX-07 は当初これを「3 つ組に `flex-wrap` +
 * `min-width`」と一続きに書いていて、**そこで非対称が潰れていた**。
 * `.header` は親なので `min-width: 0` を持たないし、持つ必要もない。
 *
 * --- なぜ別の見張りが要るのか ---
 *
 * 2026-08-21 に対照実験をした。`.breadcrumb` から `min-width: 0` を消して
 * `tests/ui` + `tests/architecture` の **2016 件を走らせても、赤が 1 件も
 * 増えなかった**（`flex-wrap` のほうは消すと上の専用 it が赤くなる）。
 * **片方だけが見張られていた。**
 *
 * --- この見張りの向きは、上の `EXEMPT` と逆である ---
 *
 * 上は「折り返さない**例外**の一覧」で、載っていないものが在ると赤。
 * ここは「縮められるようにしてある規則の一覧」で、**載っているものが
 * 無くなると赤**。同じ「一覧を両方向で見る」形だが、良し悪しが反対なので、
 * 読むときに取り違えないこと。
 *
 * --- 判定していないもの（この見張りの弱さ）---
 *
 * **「`min-width: 0` を持つべきなのに持っていない子」は見ていない。見られない。**
 * どの規則が flex の子として使われるかは CSS に書かれていない——親子の関係は
 * JSX 側にしかない（`surface-outline-count.test.ts` の `.inputAuto` と同じ壁）。
 * だから**新しく作られた flex の子は、この一覧に自動では入らない。**
 * ここが守っているのは「**いま在るものが消えないこと**」だけである。
 */

/** 縮められるようにしてある規則。**消えたら赤。** */
const SHRINKABLE: Record<string, Exemption> = {
  // ── 入力欄と、それを包む器 ──────────────────────────────────────────
  // **入力欄は既定で `size` 属性ぶんの幅を主張する。**`width: 100%` だけでは
  // 器を超えるので、`min-width: 0` が要る。器の側にも要るのは、器が縮まなければ
  // 中身をいくら縮めても意味が無いため。
  "src/presentation/ui/primitives/ui.module.css :: .input": {
    measured: "共通の入力欄。管理画面のすべての form が通る（2026-08-31）",
    reason:
      "入力欄は既定の最小幅（`size` 属性ぶん）を主張する。" +
      "**これが無いと、狭い画面で入力欄だけが器の外へ突き出る**",
  },
  "src/presentation/ui/primitives/ui.module.css :: .field": {
    measured: "入力欄 1 つと、その名札・説明の縦の組（2026-08-31）",
    reason: "中に横へ伸びるもの（入力欄・長い説明）が入る器。器が縮まないと中身も縮めない",
  },
  // 字下げ 2 つは media query の中に在るという意味（狭い画面のときだけ効く）。
  "src/app/admin/admin.module.css :: .publishedFilter input,\n  .publishedFilter select,\n  .publishedFilter button": {
    measured: "公開済み記事の絞り込み。検索欄・公開状態・実行の 3 つ（2026-08-31）",
    reason:
      "3 列の grid に置く入力欄と選ぶ欄。**`minmax(0, …)` は列の下限を外すだけで、" +
      "入力欄自身の最小幅は消えない**ので、子の側にも要る。" +
      "狭い画面では 1 列へ落ちるため、そのときだけ効かせる",
  },
  // ── 共通の節と、項目・値の対 ────────────────────────────────────────
  "src/presentation/ui/templates/screen-parts.module.css :: .section": {
    measured: "管理画面 86 枚すべての節の器（2026-08-31）",
    reason: "中に表・長い URL・選択肢の長い form が入る。器が縮まないと画面ごと横へ溢れる",
  },
  "src/presentation/ui/templates/screen-parts.module.css :: .section > *": {
    measured: "節の直の子。表の包み・form・注意書き（2026-08-31）",
    reason: "grid の子の最小幅は中身の幅で決まる。**節を縮めても、子が縮まなければ溢れる**",
  },
  "src/presentation/ui/templates/screen-parts.module.css :: .factRow dd": {
    measured: "項目と値の対の、値の側（2026-08-31）",
    reason:
      "値には切れない長い文字列（URL・識別子）が入る。" +
      "`overflow-wrap: anywhere` と対で使い、途中で折って器の中に収める",
  },
  "src/presentation/ui/primitives/ui.module.css :: .main": {
    measured: "2026-08-21。管理画面 32 枚の本文の器",
    reason:
      "縦積みの器だが、**中身に横へ伸びるもの（表・長い URL）が入る。**" +
      "これが無いと本文ごと横へ広がり、`.shell` の横並びが崩れる",
  },
  "src/presentation/ui/primitives/ui.module.css :: .breadcrumb": {
    measured: "2026-08-21。帯の子。3 段のパンくずが 13 枚ある",
    reason:
      "画面名をそのまま並べるので、深い画面では帯ごと横へ溢れる。" +
      "**縮められるようにしたうえで、切り落とさずに折り返す**" +
      "（`flex-wrap: wrap` と対で効く。パンくずは末尾だけ残すと意味が消えるため）",
  },
  "src/presentation/ui/primitives/ui.module.css :: .page > *": {
    measured: "Chromium mobileで管理画面11枚が375pxを377〜775pxへ押し広げた（2026-08-21）",
    reason:
      "grid子のautomatic min-sizeを0へ下げ、表や長い値の横scrollを各包みへ閉じ込める。" +
      "親page全体を広げると案内や操作まで画面外へ出るため",
  },
  "src/presentation/ui/templates/site.module.css :: .siteMain > *": {
    measured: "Chromium mobileで読者画面1枚が375pxを422pxへ押し広げた（2026-08-21）",
    reason:
      "読者側grid子のautomatic min-sizeを0へ下げ、長い本文要素の幅をmain全体へ伝播させないため",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .tableWrap": {
    measured: "Chromium mobileでDataTable/RankingTableを持つ3画面が393〜526pxへ広がった（2026-08-21）",
    reason:
      "表の最小内容幅を画面全体へ伝えず、tableWrap自身の横scrollへ閉じ込めるため。" +
      "tabIndexを持つこの包みがキーボード操作も受け持つ",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .materialForm": {
    measured: "Chromium mobileでモデル選択を持つ2画面が526〜705pxへ広がった（2026-08-21）",
    reason: "selectの選択肢が持つintrinsic幅をform全体へ伝播させず、利用可能幅まで縮めるため",
  },
  "src/presentation/ui/patterns/patterns.module.css :: .materialForm > *": {
    measured: "同じ2画面でmaterialForm直下のformがintrinsic幅を保持していた（2026-08-21）",
    reason: "grid子であるformのautomatic min-sizeを0へ下げ、内側selectのwidth:100%を効かせるため",
  },
  "src/presentation/ui/primitives/ui.module.css :: .navLabel": {
    measured: "管理画面の案内名。畳む操作と同じ横並びの中に置かれる（2026-08-23）",
    reason: "長い案内名がボタンを押し出さないよう、利用可能幅まで縮んで文字を折り返すため",
  },
  "src/presentation/ui/templates/screen-parts.module.css :: .tableWrap": {
    measured: "共通 DataTable の横スクロールを受け持つ器（2026-08-23）",
    reason: "表の最小内容幅を画面全体へ伝えず、この器の横スクロールへ閉じ込めるため",
  },
  "src/presentation/ui/templates/site.module.css :: .article > *": {
    measured: "Chromium mobileの順位記事で327pxの記事を398pxへ広げた（2026-08-21）",
    reason: "記事grid直下のRankingTable外箱を縮め、表の横幅は内側tableWrapのscrollへ閉じ込めるため",
  },
  "src/presentation/prose/prose.module.css :: .proseCallout > div": {
    measured: "注意書きの本文側。印と横に並ぶ列で、長い行や表を含みうる（2026-08-26）",
    reason: "flex の子の最小幅は既定で `auto` なので、長い一行が注意書きごと横へ溢れるのを止めるため",
  },
  "src/presentation/prose/prose.module.css :: .proseEditorText,\n.proseEditorHeading3,\n.proseEditorHeading4,\n.proseEditorQuote": {
    measured: "本文・小見出し・引用の入力欄。箇条書きでは行頭の印と横に並ぶ（2026-08-26）",
    reason:
      "入力欄は既定で中身に応じた最小幅を持つ。下げておかないと、" +
      "`width: 100%` を書いても行ごと横へ溢れて印が画面外へ出る",
  },
  // ── 読者向けブログの骨格（2026-08-30 の統合で合流）──────────────────
  // 上の 2 本（`.siteMain > *` / `.article > *`）が「本文の中身」を閉じ込めるのに対し、
  // ここは**本文の柱そのもの**が横へ広がらないようにする側。柱が広がると、
  // 中の包みがいくら縮んでも上端の帯と補助列ごと画面外へ出る。
  "src/presentation/ui/templates/site.module.css :: .article": {
    measured: "記事 1 本の器。表・長い URL・引用を含みうる（2026-08-30）",
    reason:
      "`.siteMain` の grid の子。これが無いと記事の最小内容幅が本文の柱へ伝わり、" +
      "内側の `.article > *` で閉じ込めた横スクロールが効かなくなる",
  },
  "src/presentation/ui/templates/site.module.css :: .articleListBody": {
    measured: "一覧に並ぶ記事 1 件ぶんの題と要約（2026-08-30）",
    reason:
      "日付や印と横に並ぶ列。長い題が行ごと横へ押し出すのを止め、" +
      "**題の側で折り返させる**ため（切り落とすと、どの記事か読めなくなる）",
  },
  "src/presentation/ui/templates/site.module.css :: .categoryDirectory li": {
    measured: "分類の一覧の 1 項目。分類名と本数が横に並ぶ（2026-08-30）",
    reason: "長い分類名が本数を項目の外へ押し出さないよう、名前の側を縮めて折り返させるため",
  },
  "src/presentation/ui/templates/site.module.css :: .siteIdentity": {
    measured: "上端のブログ名と一言説明。検索と横に並ぶ（2026-08-30）",
    reason:
      "flex の子の最小幅は既定で `auto`。長いブログ名がそのまま幅になると、" +
      "**折り返さない上端（`.siteHeaderInner`）ごと検索を画面外へ押し出す**",
  },
  "src/presentation/ui/templates/site.module.css :: .siteSearch input": {
    measured: "上端の検索欄。入力欄は既定で中身に応じた最小幅を持つ（2026-08-30）",
    reason:
      "`grid-template-columns: minmax(0, 1fr) auto` の 1fr 側。下げておかないと" +
      "入力欄の既定幅が上端の幅を決めてしまい、狭い画面でブログ名が消える",
  },
};

const SHRINK_KEYS = ALL_RULES.filter((r) => /min-width:\s*0(?![.\d])/.test(r.body))
  .map((r) => r.key)
  .sort();

describe("縮められるようにしてある規則は、理由つきで数えられている", () => {
  it("走査が `min-width` を見分けている（陰性対照）", () => {
    // 「1 件も無い」と「正規表現が壊れて何も当たらない」はどちらも
    // 「一覧と一致しない」で落ちるが、落ち方から原因が読めない。
    // `min-width` を書いた規則そのものが在ることを先に見る。
    const anyMinWidth = ALL_RULES.filter((r) => /min-width:/.test(r.body));
    expect(anyMinWidth.length, "min-width を書いた規則が 1 つも見つかりません").toBeGreaterThan(1);
    // `min-width: 0` 以外（`min-width: 44px` など）も在ることを見る。
    // ここが 0 だと「0 だけを拾う」判定が働いているか確かめられない。
    expect(
      anyMinWidth.length - SHRINK_KEYS.length,
      "min-width の値を見分けていない可能性があります",
    ).toBeGreaterThan(0);
  });

  it("`min-width: 0` を持つ規則は、一覧と過不足なく一致する", () => {
    // **両方向。**足りない側だけを見ると、消えた規則が理由つきで居座る。
    expect(
      SHRINK_KEYS,
      "縮められるようにしてあった規則が消えたか、理由の無いものが増えました。" +
        "**消えた側なら、狭い画面で帯ごと横へ溢れます**（flex の子の最小幅は既定で `auto`）",
    ).toEqual(Object.keys(SHRINKABLE).sort());
  });

  it("一覧のどの行も、数と理由の両方を持っている", () => {
    const thin = Object.entries(SHRINKABLE)
      .filter(([, v]) => v.measured.trim().length < 4 || v.reason.trim().length < 12)
      .map(([k]) => k);
    expect(thin, "実測か理由が空です。理由を書かずに足さないこと").toEqual([]);
  });
});
