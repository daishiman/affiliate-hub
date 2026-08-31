# Component contract

`ファイル` 列は **export path（実在する物理位置）** を書く。ここが空だと、契約の行と
`src/` の実装を突き合わせる手がかりが無くなり、「契約に在るが実装が無い」と
「実装は在るが名乗っていない」を誰も区別できない。列の書式は
`docs/spec/feat-blog-ops-crud/component-contract.md` に合わせる。
`部品` 列の識別子が `ファイル` 列のパスから実際に export されているかは
`tests/architecture/component-contract-identity.test.ts` が機械検査する。

| 部品 | ファイル | primary purpose | desktop | mobile | states/a11y |
|---|---|---|---|---|---|
| `SiteFrame` | `src/presentation/site/page-frame.tsx` | 公開header/body/sidebar/footerの一貫 | main+sidebar | main→sidebar | landmark、skip link、focus-visible |
| `BlogArticleView` | `src/presentation/site/blog-article-view.tsx` | 開示→結論→根拠→選択 | TOC/sidebar並置 | 1列、table内scroll | 無いblockは出さない |
| `DiagramFallback` | `src/presentation/ui/patterns/diagram-fallback.tsx` | 第三者写真なしで対象識別 | 商品名+図形 | 同じ | `role=img`と説明alt、装飾のみならhidden |
| `ArticleSaveStatus` | `src/presentation/admin/publish/article-save-status.tsx` | 5状態と退避先の常時表示 | edit先頭/sticky | edit先頭 | `role=status`、文言+置き場で識別 |
| `ArticleLayoutSuggestionPanel` | `src/presentation/admin/publish/article-layout-suggestion-panel.tsx` | 版面の直しどころ1件の理解→適用→取消 | article form内details | 1案ずつ | severity/location/before/after/rationale、主button 1 |
| `AffiliatePreviewCard` | `src/presentation/admin/earn/affiliate-preview-card.tsx` | 保存前の9項目確認 | URL form直下 | 1列 | loading/partial/error/duplicate/fallback、live regionは結果だけ |
| `AffiliateLedger` | `src/presentation/admin/earn/affiliate-ledger.tsx` | 要確認linkと掲載数の走査 | table+row details | 商品/状態/掲載数のcard | filter label、空状態に次の1歩 |
| `PlacementList` | `src/presentation/admin/earn/affiliate-ledger.tsx` | site/page/block逆引き | row details | details | 行labelは`掲載中/掲載終了: サイト / 記事 / ブロック（位置N・最終表示…）`、行き先は当該記事の公開page。掲載0件はNoteで理由を出す |

`SiteFrame` は契約上 `PageFrame` と呼んでいたが、実装の export 名は `SiteFrame` である
（`docs/spec/feat-blog-ops-crud/component-contract.md` の公開面も同名を指す）。
2 つの名前を並存させると突き合わせができないので、実装側の名前に寄せた。

`ArticleLayoutSuggestionPanel` は契約上 `ArticleImprovementPanel` と呼んでいたが、
この部品が見ているのは記事内容の良し悪しではなく**版面（block の並び）の直しどころ**である。
「改善」は A/B 実験ループ（`docs/spec/feat-blog-ops-crud/`）の語でもあり、2 つの別ドメインが
同じ語を使うと読み手が取り違える。実装側の名前を狭めて、契約もそれに寄せた。

`AffiliatePreviewCard` は `ui/patterns/` ではなく `admin/` に置く。金額と商品名は
運営者が ASP 画面と突き合わせる材料であって読者に出す値ではなく、`ui/index.ts` から
export していると公開面から deep import できてしまうため、棚ごと分けた。

同一画面の visually primary は1つ。可逆なpreview/undoにconfirm dialogは出さず、削除/停止だけを通常操作から分離する。

## 部品は画面から辿り着けること（`.tsx` だけでなく `.ts` も）

`src/presentation/admin/` の置き場は `ADMIN_NAV_GROUP_LABELS` の 6 group に従う
（`src/presentation/admin/README.md`）。その上で、**この棚に置いたものは
production のどこかから import されていなければならない。**
`tests/architecture/admin-component-orphans.test.ts` が
`.tsx`（React 部品）と `.ts`（action / state / 対応表）の両方を母集団に取り、
import 指定子を実際に解決して到達性を測る。

`.ts` を母集団から外していた間、**運営者に届いていない実装が到達不能のまま
緑を通っていた。** 実測（2026-08-30）で admin 配下 72 件の `.ts` のうち 2 件が
production のどこからも import されていなかった。テストだけが呼んでいる実装は、
画面に出ていないという意味では存在しないのと同じである。

除外は 2 種に分けて宣言する。混ぜると、消えるべきものが設計の顔をして残る。

| 種別 | 意味 | 追跡先 |
|---|---|---|
| `by-design` | import されないことが正しい（例: 画面の一覧そのものを宣言する正本） | 不要 |
| `unfinished` | 機能の後半が未完成で残っている負債 | **必須**（検査が空欄を拒む） |
