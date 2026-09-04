# 運用手順（feat-uiux-overhaul / P12）

作成日: 2026-08-22

新しいブログ、新しい SNS を足すときの手順。**この文書だけで完了する**ことを目的に、
実際に打つコマンドと、触るファイルと、確認の仕方を書く。

手順の根拠は [`evidence/07-a4-channel-extension.txt`](./evidence/07-a4-channel-extension.txt) の実測。
推定で書いた段はない。

---

## 1. 新しい SNS を足す

### 触るファイルは 2 つ

| 段 | ファイル | 量 |
|---|---|---|
| 1 | `src/domain/distribution/channel.ts` | 1 エントリ |
| 2 | `src/infrastructure/channels/channel-registry.ts` | 1 行 |

**画面側（`src/app/admin/**`, `src/presentation/**`）は 1 行も触らない。**
実測で確認済み（型検査・UI テスト 80 ファイル 2514 件が画面側無改修で通過）。

### 手順

#### 段 1: 能力表に 1 エントリ足す

`src/domain/distribution/channel.ts` の `CHANNEL_CAPABILITIES` に足す。

```ts
mastodon: {
  kind: "mastodon",
  label: "Mastodon",
  publishMode: "api_publish",        // api_publish | api_schedule | manual_export
  maxBodyLength: 500,
  allowsBodyLinks: true,
  maxImages: 4,
  supportsVideo: true,
  allowsAffiliateLinks: true,
  disclosurePlacement: "body_top",
  basisNote: "公式ドキュメントの該当箇所と、確認した日",
  statusLabels: STATUS_LABELS.api_publish,
  accentToken: "--channel-mode-api-publish",
  iconName: "api_publish",
  basisCheckedAt: "2026-08-22",
  rendersOwnArticle: false,
},
```

注意点が 3 つある。

- **`accentToken` に配信先ごとの別名を作らない。** 投稿方式のトークン
  （`--channel-mode-api-publish` など）を直接指す。別名（`--channel-mastodon`）を作ると
  `src/presentation/ui/tokens/semantic.css` を触ることになり、
  「記述を足すだけ」が崩れる。既存の `facebook` が同じ判断をしていて、
  理由が `channel.ts` のコメント（237-250 行あたり）に書いてある。
- **`statusLabels` は投稿方式から引く。** `manual_export` の配信先に「送信中」と出すと嘘になる
  — 人が貼り付けるまで何も起きていない。方式ごとの言い方を表が持つので、
  画面は `statusLabels[state]` を引くだけで済み、`if (kind === "…")` が要らない。
- **`basisNote` / `basisCheckedAt` を空で埋めない。** 文字数上限やリンク可否は
  各サービスの規約で変わる。出どころと確認日が無いと、いつの規約かが分からなくなる。

#### 段 2: 型検査を走らせる（ここで止まるのが正しい）

```bash
npx tsc --noEmit
```

**エラーが 1 件出る。** これは失敗ではない。

```
src/infrastructure/channels/channel-registry.ts(78,7): error TS2741:
  Property 'mastodon' is missing in type … but required in type
  'Readonly<Record<ChannelKind, ConnectorFactory>>'.
```

`ChannelKind = keyof typeof CHANNEL_CAPABILITIES` なので、表に足した瞬間に
種別が増え、投稿手段の登録所が**型でそれを要求する**。
もしここが緩ければ、画面から選べるのに押した瞬間に失敗する配信先を作れてしまう。

#### 段 3: 投稿手段を 1 行足す

`src/infrastructure/channels/channel-registry.ts` の `FACTORIES` に足す。

まだ実装できないとき（API 契約待ち・審査待ちなど）は、
**理由を書いた stub を置く。** 黙って成功を返す実装は置かない。

```ts
mastodon: (ctx) => createStubConnector("mastodon", "アプリ登録とアクセストークンの取得が必要", ctx),
```

理由は利用者に出る文言なので、「未実装」ではなく**何が揃えば動くか**を書く。

#### 段 4: 確認する

```bash
npx tsc --noEmit                                   # → 0 件
npx vitest run tests/ui tests/presentation         # → 全通過
```

新しい配信先は画面の選択肢へ**自動で並ぶ**。画面側に配信先名の書き起こしが
存在しないので、並べる作業は無い。

### 契約文書との差（`sns-provider-contract.md`）

[`sns-provider-contract.md`](./sns-provider-contract.md) §「追加の手順」は
**変更するファイルを `channel.ts` だけ**と書いている。これは不正確で、
上記のとおり `channel-registry.ts` が型で 1 行を要求する。

同節はまた「P09 が git diff のパス集合で機械判定する」と書いているが、
**git diff では測れなかった。** 作業ツリーがベースから 76 ファイル分の差分を持ち、
1 エントリの効果がその中に埋もれる。実測は変更量ではなく機械判定 2 問
（画面側無改修で型検査が通るか／UI テストが緑か）へ置き換えた。
経緯は `evidence/07-a4-channel-extension.txt` の冒頭にある。

**手順としては本書が正しい。** 契約側の文言修正は P13 の書き戻しで行う。

---

## 2. 新しいブログを足す

### 既定: ファイルは生成しない

ブログ作成（`create_site_from_draft`）が成功したときに増えるのは
**`SiteBlueprint` 1 件（データ）だけ**。

| 生成物 | 種別 | 本数に比例するか |
|---|---|---|
| `SiteBlueprint` 1 件 | データ | する（データなので可） |
| route の解決結果 | 導出（`routesFor()` が都度計算） | しない |
| テーマの CSS カスタムプロパティ | 導出（`ThemeTokens` から生成） | しない |
| `src/presentation/sites/<slug>/` | ファイル | **既定では生成しない** |

作成時に空の骨組み一式を作ると、使われないディレクトリが本数分たまる。
**必要になってから足す。**

### 手順（通常）

1. 管理画面からブログを作る。設計図（`SiteBlueprint`）が 1 件増える。
2. 見た目の差は**設計図の値で表現する** — 節の並び順、表示の有無、テーマトークン。
3. 何もファイルを作らない。ここで終わる。

### 例外: ブログ固有の部品が要るとき

次の**両方**を満たすときだけ、固有ファイルを作ってよい。

1. **共通部品の組み合わせで表現できない構造**である
   — 節の並び替え・値の差し替え・表示の有無では届かない
2. **他のブログへ広がる見込みが無い** — 広がるなら共通部品に足す

| 判断 | 例 |
|---|---|
| 満たす | そのブログだけが持つ独自の計算機・診断ツール・特殊な図表 |
| 満たさない | 「このブログだけカードを 3 列に」（密度で表現できる） |
| 満たさない | 「このブログだけ著者欄を上に」（設計図の項目にできる） |

満たすときに作るのは次だけ。**この一覧に無いものは作らない。**

```
src/presentation/sites/<site-slug>/
├── index.ts        … 固有部品の入口。共通からはここ経由でのみ読む
├── sections/       … 独自セクション（0 個でもよい）
└── README.md       … なぜ共通で表現できなかったかの記録（必須）
```

- `README.md` は必須。**例外が増えすぎたときに気付くため。**
  理由が書けないなら、それは共通で表現できる差である。
- `<site-slug>` は `SiteBlueprint.id` から導く。**表示名を使わない**
  — 改名したときにパスが変わる。

### 共通側に書いてはいけないこと

```ts
if (slug === "kitchen-blog") { … }   // ← 書かない
```

**共通部品にブログ名の分岐を書かない。** 書いた時点で、ブログを増やすたびに
共通側を直すことになり、「ブログ本数に比例して増えるファイルは仕様が列挙したものだけ」
という条件が崩れる。

固有部品の有無は `sites/<slug>/index.ts` が**存在するかどうか**で決める。
存在しないブログでは何も読まない。

```
SiteShell(blueprint) ─▶ routesFor(blueprint) で route を決める
                     ─▶ 固有部品があれば sites/<slug>/index.ts から読む
                     ─▶ 無ければ共通のまま描く
```

---

## 3. 画面を 1 枚足すとき

SNS でもブログでもなく、管理画面を 1 枚足すときの最小手順。
忘れると孤立ページになるものだけ挙げる。

| 段 | やること | 忘れると |
|---|---|---|
| 1 | `ADMIN_ROUTE_METADATA` にrouteを足す（ナビ項目は `icon` / `group` 必須） | route・案内・分類・パンくず・描画検査へ同時に反映されない |
| 2 | `information-priority-map.json` の `screens` に行を足す | 文章量の照合を受けない |
| 3 | `lead` を 40 字以内、`<Callout>` を 2 個以内にする | 検査が赤 |

段 1 を忘れると型検査は通るが画面へ行けない。段 2 を忘れると
**検査は緑のまま**になる（P07 で実際に 17 画面が漏れた）ので、ここが最も踏みやすい。

規則の詳細は [`ui-rules.md`](./ui-rules.md)。

### その画面がフォームを持つとき（2026-08-22 / `ah-brd`）

次の 3 つは**自前で書かない**。書くと写しになり、写しは片方だけ直った日に割れる。

| 出すもの | 使うもの | 自前で書いたときに割れたもの（実測） |
|---|---|---|
| 人に見せない送信値 | `FormValue` | 隠す指定を書き忘れた 1 箇所が、空欄として画面に出て触れてしまう |
| 送ったあとの知らせ | `FormResult` | 失敗時の見出しが 4 通り・成功の呼び名が 3 通り・成功時の色が 4 通りに割れていた |
| 説明文 | `Prose` | [`ui-rules.md` §7](./ui-rules.md) |

実測の規模: `FormValue` は **21 ファイル・50 箇所**が各々書いていた。
`FormResult` は **14 ファイル・18 か所**が同じ骨格を持っていた。

**ただし揃えないものが 1 つある。** 事実確認の画面の `passed` / `flagged`（通った／指摘あり）は
`done` と**本当に意味が違う**ので寄せていない。この 1 画面だけは自前で書く。
「見た目が同じだから揃える」で潰すと、**意味の違いを名前から消す**ことになる。

**見本**: 見本帳（`/admin/ui-catalog`）の節 26「送ったあとの知らせ」。
写しではなく実物の部品を置いてあるので、部品を直した日に見本だけ古くなることはない。

---

## 4. write_scope の切り方について

[`final-review.md`](./final-review.md) §6 から引き継いだ論点をここで扱う。

### 起きたこと

P07・P08・P09 の 3 phase 連続で、宣言した write_scope の外へ書いた。
逃げたのではなく、**書かなければ合格と言えなかった**。

| phase | 何が起きたか |
|---|---|
| P07 | 受入判定中に検査自身の穴（A2・A10）が見つかった。穴を残したまま合格とは書けない |
| P08 | 移行対象の実体が `src/presentation/admin` にあり、宣言した `src/app` の外だった |
| P09 | 層別カバレッジの床を、床を下げずに満たすには実装側の検査を足すしかなかった |

### 原因

**write_scope は「成果物の置き場所」で切られているのに、
実際に直す必要があるものは「欠陥の在り処」で決まる。**

この 2 つは事前には一致しない。一致させられるなら、それは
欠陥の場所が事前に分かっているということで、その場合は phase を切る前に直せる。

### 運用（次からこうする）

1. **write_scope を成果物の置き場所として書く**のは維持する。
   広く取ると「どこへでも書ける」になり、切る意味が消える。
2. **逸脱したら、その phase の報告に必ず書く。** 隠して通すと、
   後から見た人には「scope 内で終わった」と読める。
3. **逸脱の理由を「欠陥の在り処」で説明する。** 「都合が良かった」は理由にならない。
4. **3 phase 続けて同じ向きに逸脱したら、scope の切り方を疑う。**
   個々の判断ミスではなく、切り方が実作業と合っていない。

### やらなかったこと

write_scope を「欠陥が見つかった場所ならどこでも」と広げる案は採らない。
それは制約を外すだけで、逸脱が見えなくなる。
**見えている逸脱の方が、見えない自由より安全である。**

---

## 5. この文書が決めていないこと

| 事項 | どこにあるか |
|---|---|
| 間隔・文章量・サイドバーの規則そのもの | [`ui-rules.md`](./ui-rules.md) |
| 部品をどの段に置くか・重複の定義 | [`component-contract.md`](./component-contract.md) |
| 配信先の記述に持たせる項目の設計理由 | [`sns-provider-contract.md`](./sns-provider-contract.md) |
| ブログ固有部品の境界の考え方 | [`blog-scaffold-contract.md`](./blog-scaffold-contract.md) |
| 実際に投稿する処理（コネクタ本体）の書き方 | `feat-distribution-hub` の範囲 |
