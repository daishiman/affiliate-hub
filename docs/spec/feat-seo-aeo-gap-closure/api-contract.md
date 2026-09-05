# 管理画面一覧の取得契約

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P02`
- 状態: 確定 (P02 成果物)
- 姉妹文書: [architecture.md](./architecture.md) / [data-model.md](./data-model.md)
- 対応する受入: A5「再点検で落ちた記事が管理画面の一覧に現れ、落ちた理由 (hint) が読める」

## 経路は usecase 直呼び。HTTP の口を作らない

管理画面は Next.js の Server Component / Server Action から
usecase を直接呼ぶ。既存の `publish-article-action.ts` が
`createAuditArticleDraftUseCase` をそう呼んでいるのと同じ形。

**REST/JSON の口を新設しない理由**: 読むのは管理画面だけで、
外部の利用者がいない。口を作ると認可・入力検証・版管理が
1 セット増え、それを守り続ける相手がいない。
外部から読む要求が出た時点で足せばよい。

## 入力

```ts
export type ListFailingAuditsInput = {
  /** どの作業場所の記事を見るか。actor から解決するのでこの型には無い。 */
  readonly siteSlug?: string;
  /** 既定 50。画面の 1 ページぶん。 */
  readonly limit?: number;
};
```

`workspaceId` を入力に持たない。actor（`UseCase` の第 1 引数）から解決する。
入力で受け取れる形にすると、呼び出し側が他所の作業場所の ID を
渡せてしまう — 認可を型で塞ぐ。

`siteSlug` は任意。省略時は作業場所内の全サイト。
運営者が複数サイトを持つとき、まず全体を見て次に 1 サイトへ絞る、
という順で使う。

## 出力

```ts
export type FailingAuditRow = {
  readonly siteSlug: string;
  readonly slug: string;
  /** 記事の題。一覧から記事が分かるように出す。 */
  readonly title: string;
  /** 記事の型。URL の道筋がこれで決まる（articleHref と同じ規則）。 */
  readonly type: ArticleType;
  readonly checkedAt: string;
  readonly trigger: AuditTrigger;
  readonly passedCount: number;
  readonly totalCount: number;
  /**
   * **落ちたチェックだけ**。通ったチェックは返さない。
   * 一覧の用途は「何を直せばよいか」であって「何が通ったか」ではない。
   */
  readonly failed: readonly { readonly check: string; readonly hint: string }[];
};

export type ListFailingAuditsOutput = {
  readonly rows: readonly FailingAuditRow[];
  /** 上限で切ったか。切ったなら画面に「他にもある」と出す。 */
  readonly truncated: boolean;
};
```

### `failed` に `ok` を含めない

`AiSearchCheck` は `{check, ok, hint}` だが、返すのは落ちたものだけなので
`ok` は常に `false` になる。常に同じ値の欄は、読む側に
「false 以外があり得るのか」と考えさせるだけで何も伝えない。

### `hint` をそのまま返す

`ai-search-audit.ts` が書いた日本語の hint を、画面が加工せず出す。
画面側で「このチェックにはこの説明」という対応表を持たない —
持つと、チェックを足したとき 2 か所を直すことになり、
片方を忘れた日に説明の無いチェックが画面に出る。

保存された行の hint（当時の文言）を返す。現在のコードの hint で
上書きしない — [data-model.md](./data-model.md) の `checks_json` の項に同じ理由がある。

### `truncated`

上限で切ったことを黙らない。切ったのに黙ると、
運営者は「落ちている記事は 50 本」と読む。実際は 51 本以上かもしれない。

## 並び

`checked_at` の**新しい順**。

古い順にしない理由: 一覧の先頭に出るべきは
「さっきの定期実行で落ちたと分かった記事」である。
古い順にすると、直っていない古い記事が先頭を占め、
新しく落ちた記事が下に埋もれる。

同点（同じ時刻）のときは `slug` の昇順。実行ごとに順序が変わらないようにする。

## 抽出条件

「その記事の**最新の**点検で `passed_count < total_count`」。

過去の行は見ない。3 日前に落ちて昨日直った記事は出ない。

SQL としては、記事ごとに `checked_at DESC, id DESC` で 1 件を取り、
そのうち `passed_count < total_count` のものを返す。

**`trigger` で絞らない。** A5 は「再点検で落ちた記事」と書いているが、
公開時点検で落ちた記事も同じく直すべきものである。
`trigger` は返却に含めるので、画面側で見分けはつく。
絞ってしまうと、公開直後に落ちた記事が 7 日間一覧に出ない
（次の定期再点検まで待つ）ことになる。

## 空のとき

`rows: []`、`truncated: false` を返す。エラーにしない。
画面は「落ちている記事はありません」と出す。

**空を「まだ点検していない」と混同しない。** 点検履歴が 1 件も無い状態でも
空が返るが、その状態は定期再点検が最優先で拾う
（[architecture.md](./architecture.md) の「対象の選び方」の 2）ので、
1 日以内に解消する。この区別を画面に出す要求は A5 に無い。

## 認可

既存の admin RBAC の範囲。読み取り専用で、新しい権限を足さない。
記事の公開を見られる人は、その記事の点検結果も見られてよい。

## この文書が扱わないこと

- 画面の配置・見出し・部品（P05 が実装時に既存の管理画面に合わせる）
- テストケース（P04 が所有する）
- 応答時間の基準（P09 が非機能検査として所有する）
