# 公開面・管理面の詳細画面一覧

| ID / route | 利用者と目的 | 主操作 | 主データ/配置 | 状態 | mobile | 受入 |
|---|---|---|---|---|---|---|
| PUB-HOME `/s/[site]` | 読者が記事を探す | 記事を開く | header→記事探索→主カード→新着→footer | empty/error/公開のみ | 1列 | 非公開記事0、固定footer |
| PUB-LIST `/s/[site]/blog` | 主題から探す | 記事を開く | breadcrumb→title→cards→sidebar→pagination | empty/search no-hit/error | 主3項目カード | canonicalと一貫 |
| PUB-ARTICLE `/s/[site]/blog/[article]` | 結論と根拠を読む | 次の選択へ進む | header→breadcrumb→title/meta→disclosure→lead/summary→TOC→blocks→diagram/table→CTA→author/related→footer、desktop右sidebar | missing blockは非表示、link unavailableはfallback | sidebarを後置 | 写真代わりの独自図解、広告開示 |
| PUB-TAXONOMY `/category`,`/tag` projection | 主題で絞る | 記事を開く | 説明→件数→カード | empty/paged | 1列 | category/tagの意味を区別 |
| PUB-AUTHOR | 書き手と方針を知る | 投稿を開く | profile→policy/credential→posts | author missing | profile先行 | 固有経歴を創作しない |
| ADM-OVERVIEW `/admin/blog` | 次の運用作業を決める | 記事を作る | 下書き/要改善/保存失敗/要確認link | empty/error/permission | 要対応3件まで | 主CTA 1 |
| ADM-CONTENT-LIST `/admin/blog/articles` | 対象記事を探す | 新規作成 | title/site/status/updated/improvement/link count | empty/filter/error | title/status/updatedだけ先行 | 検索文脈を復帰時保持 |
| ADM-ARTICLE-NEW `/admin/blog/articles/new` | 最初の下書き | 下書きを作る | template→site/title/slug | validation/pending/success/error | 1列 | 必須だけで開始 |
| ADM-ARTICLE-EDIT `/admin/blog/articles/[article]` | 入力を失わず編集 | 保存する | 常設save state→outline→blocks→advanced | unsaved/saving/saved/failed/conflict | sticky save state、1列 | revision CAS、端末下書き |
| ADM-IMPROVEMENT article edit内 | 指摘を1件ずつ反映 | この改善を適用 | severity/location/rationale/before/after | empty/preview/applied/undone | 1案ずつ | 保存前は取消可能 |
| ADM-AFFILIATE-LIST `/admin/affiliate/links` | 状態と掲載状況を把握 | linkを追加 | product/merchant/state/checked/placement count/attention | empty/filter/error/permission | product/state/countを先行 | 一操作で掲載先 |
| ADM-AFFILIATE-NEW `/admin/inbox` | URLの中身を保存前に確認 | 受信箱に入れる | URL→解析状態→9項目preview→note | idle/loading/partial/failed/duplicate/ready | preview 1列 | SSRF deny、画像fallback |
| ADM-AFFILIATE-DETAIL list内details | 商品情報と配置を精査 | 記事で確認 | snapshot→placements→audit | no-placement/error | 折り畳み | URL全体は非表示 |
| ADM-ANALYSIS docs/command | 収集差分を確認 | 差分を確認 | part/count/captured/digest/unclassified | fetch failure/stale/diff | 要約優先 | 本文・画像を保存しない |
