# UI 規則（feat-blog-ui-builder）

正本は実装契約。章 Markdown へ複製しない。

## 公開面

1. 画面に出る本文と、機械向け出力（JSON-LD / sitemap / RSS / robots / llms.txt）は同じ読み取りモデルから作る。別の組み立てを置かない。
2. 報酬・運営情報は読者向け読み取りポートを通さない。
3. 更新日は JSON-LD の `dateModified` と `<time dateTime>` で同じ値を出す。
4. 構造化データを HTML に埋めるときは、`<` を `\u003c` に逃がしてから埋める。
5. origin は届いたリクエストの Host から作る。環境変数に固定しない。

## 管理面

1. `/admin/settings/seo` の目的は「指針の出典を登録し、90 日超を再確認する」だけ。他の設定を混ぜない。
2. 90 日の判定はドメイン関数 `referenceReviewStatus` だけが行う。画面側で日数を数え直さない。
3. 記事公開後の AI 検索点検は公開の条件ではない。足りない項目は直し方（hint）まで出す。
