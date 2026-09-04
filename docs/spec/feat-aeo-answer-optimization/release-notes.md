# 出すときの説明 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P12 の成果物。

## 中学生にもわかる説明

### 何を作ったか

**AI に「答え」として引用してもらいやすい記事にする道具**です。

昔は、調べものといえば検索して、出てきたページを自分で読みました。
今は AI に聞くと、AI が答えを返します。

そのとき AI は、いろいろなページから
**「答えになっている部分」だけを取ってきて**使います。

だから、記事全体がよくても
「ここが答えです」とはっきり書いてある部分が無いと、
AI は取っていってくれません。

### 何ができるようになったか

**1. 記事から「問いと答えの対」を取り出す**

記事の中から、こういう形をしている部分を探します。

- 記事の最初にある一文の結論
- Q&A（よくある質問）
- 「〇〇とは？」という見出しとその答え
- 「〇〇のやり方」という見出しと手順

取り出したものを「引用単位」と呼びます。

**2. 引用されにくい形を教えてくれる**

| 言われること | どういう意味か |
|---|---|
| 答えが長すぎる | 300 文字を超えている。AI が全部は使えない |
| 答えが埋もれている | 記事の後ろすぎる。前に持ってきたほうがいい |
| 根拠が無い | 数字や事実なのに、どこから来た話か書いていない |
| 主語が曖昧 | 「これは〜」で始まっている。単体で読むと意味が分からない |

**3. AI が読みやすい形でページを配る**

`llms.txt` という、AI 向けの目次を出せるようにしました。
ふつうの検索エンジン向けの目次（sitemap）は URL しか渡せませんが、
これは**題名と要約と「このブログは何のためにあるか」**まで渡せます。

**4. 「読んでいいですよ」とはっきり伝える**

AI のクローラ（GPTBot、ClaudeBot、PerplexityBot、Google-Extended）に、
名指しで「読んでいい」と書いています。

### 大事にした約束

**約束 1: 空っぽの箱を作らない**

Q&A が 1 つも無い記事に「Q&A があります（中身は空）」とは書きません。
書くと、機械には「質問の無い質問集」という**嘘の形**に見えます。

同じ理由で、資格を持っていない人に「資格欄（空）」を付けません。

**約束 2: 壊れているときに「大丈夫」と言わない**

記事が読めなかったとき、空っぽのページを「正常です」として返しません。
AI は「このサイトには記事が無いんだな」と覚えて帰ってしまいます。

代わりに「今は調子が悪い」と返して、あとで来直してもらいます。

**約束 3: 測れないことを測ったふりをしない**

「AI に何回引用されたか」は分かりません。相手が教えてくれないからです。

だから**その数字を出しません**。
代わりに「引用されやすい形になっているか」だけを見ます。

### まだできないこと

- 記事を公開しても**自動では取り出しません**。ボタンを押す必要があります
- 「AI に読ませない」設定はありません
- 指摘の「主語が曖昧」は当たり外れがあります

## 専門的な説明

### 位置づけ

4 層アーキテクチャ（`arch-blog-operations-console.md`）の
**改善層**に属する。

`feat-seo-assessment-reflection`（SEO 診断）と同じ層で、
同じユースケース（`manage-blog-improvement` / `manage-aeo-answers`）の
権限枠組みと監査経路を共有する。

SEO との違いは**単位**である。

| | SEO | AEO |
|---|---|---|
| 単位 | 記事 1 本 | 問答 1 対 |
| 状態 | `open` → `drafted` → `dismissed` | 状態を持たない |
| 保存 | 累積（履歴が残る） | 置き換え |

AEO に状態が無いのは、引用単位が
**「その時点の記事から取れたもの」の写し**であって
運用者が管理する対象ではないからである。

### データモデル

```
article_answer_unit
  PK  id
  UQ  (workspace_id, site_slug, article_slug, question)   ← 実質の鍵
  IX  (workspace_id, site_slug, kind)

site_aeo_profile
  PK  (workspace_id, site_slug)
```

`question` が一意鍵である点が要点。
`id` は毎回新しく作られるので同一性の判定に使えない。

外部キーは張っていない。
参照整合性ではなく**置き換え**で正しさを保つ。

### 抽出

`createAnswerUnitExtractor` が 6 か所から切り出す:

| 由来 | `kind` | `positionRatio` |
|---|---|---|
| 一文の結論（タイトルを問いに） | `direct-answer` | 0 |
| FAQ | `direct-answer` | 0 |
| 問いの形の見出し（`/[?？]\s*$/`） | `direct-answer` | 節位置 |
| 語義の見出し（`/(とは\|の意味\|の定義)/`） | `definition` | 節位置 |
| 手順の見出し（`/(手順\|ステップ\|やり方\|方法\|の流れ)/`） | `step-list` | 節位置 |
| 根拠つき claim | `fact` | 節位置 |

FAQ と一文の結論に 0 を入れているのは、
**構造化データとして単体で名指しできる塊**だから。
節と同じ扱いにすると、正しく作った FAQ が
毎回「埋もれている」と指摘され、本当に埋もれた答えが埋もれる。

### 隙間の検出

```ts
export function detectGaps(unit: AnswerUnit): readonly AeoGapKind[] {
  const gaps: AeoGapKind[] = [];
  if (unit.answer.length > MAX_ANSWER_UNIT_LENGTH) gaps.push("answer-too-long");
  if (unit.positionRatio > BURIED_ANSWER_THRESHOLD) gaps.push("buried-answer");
  if (unit.kind === "fact" && unit.sourceRef === null) gaps.push("unsourced-claim");
  if (/^(これ|それ|あれ|この|その|あの|こう|そう)/.test(unit.answer.trim()))
    gaps.push("ambiguous-subject");
  return gaps;
}
```

純関数。境界は `>` なので**ちょうど 300 文字・ちょうど 0.5 は隙間にしない**。

`AEO_GAP_KINDS` は 6 種を定義するが、この関数が返すのは 4 種。
残る 2 種（`no-direct-answer` / `missing-qa-markup`）は
単位 1 つでは判定できない記事全体・ブログ全体の事実である。

### 権限

| 操作 | 権限 | 理由 |
|---|---|---|
| `read` | `content.read` | 見るだけ |
| `extract` | `content.write` | 記事の写しを作り直す |
| `save_profile` | `site.manage` | ブログ全体に効く宣言 |

抽出より構えの保存を重くしている。
構えは全記事の構造化データに波及する。

### 配り物

| 口 | 形式 | 件数 |
|---|---|---|
| `robots.txt` | text | — |
| `sitemap.xml` | XML | 全件（50,000 超で 503） |
| `llms.txt` | Markdown | 全件（50,000 超で 503） |
| `rss.xml` | XML | 新着 20 件 |

`buildLlmsTxt` だけ XML エスケープを通さない。
Markdown なので `<` `>` を逃がすと壊れる。
同じファイルに 4 つのビルダーが並ぶので、テストで固定してある。

### AD-3 の帰結

改善層は公開面へ書けない。

`article_answer_unit` の問答と `FAQPage.mainEntity` は
**同じ記事の FAQ から独立に作られる**。
片方を他方から作ると、診断用に足した値（`positionRatio` / `gaps`）が
公開面へ漏れる。

意図的な二重生成である。

### 検証

113 件（normal 99 / worker-runtime 14）。全て通過。

品質ゲートは traceability 緑・required-test-types 緑・
**port-wiring 赤**（隣の feature が理由つき除外を 5 → 6 にした。
上限は上げていない）。

受入条件 10 件中 9 件達成、1 件（隙間の指摘）が一部達成。
