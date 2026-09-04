# T3 — 公開UIと公開済み記事管理の技術仕様

## 構成

`SiteFrame`が全公開ルートの設計図・外観・同意・計測を読み、`SiteShell`に共通クロームと画面固有の`sidebar`を渡す。記事は`ArticlePage`で`ArticleViewModel`を1回作り、同じsectionsからPCのサイドバー目次とSPの本文目次を生成する。

管理は`PublishedArticleAdminPort`を読者用`PublishedContentPort`から分離する。一覧・取得・訂正・非表示の全メソッドは`WorkspaceId`を必須とする。Server Actionは`"use server"`の専用ファイルに置き、`signedInActor()`をFormDataより先に確認する。権限は訂正=`content.write`、非表示=`content.publish`、参照=`content.read`である。

## データ

正本は既存D1の`published_articles.article_json`と、検索・一覧用列である。`0039_gentle_archive.sql`でNULL可の`archived_at text`だけをadd-only追加した。NULL=公開中、ISO時刻=非表示とする。物理DELETEは口に定義しない。

`replace`は`archived_at`を変更せず、公開中/非表示を保つ。既存の公開writerのupsertだけが`archived_at=null`に戻せる。これにより再公開は既存の公開ゲートを必ず通る。

公開readはアーカイブ行を一覧・検索・カテゴリー・人物から除外する。保存行のslugは公開状態にかかわらず予約済みとし、同じslugの見本記事を重ねない。直接取得は非表示行があれば`null`を返す。

## 監査とキャッシュ

訂正は`content.corrected`、非表示は`content.unpublished`とし、どちらも理由を必須で監査ログに残す。保存後に管理一覧、編集画面、記事URLまたはサイトホームを`revalidatePath`する。入力中の下書きはサーバーに保存せず、記事の`siteSlug/slug/updatedAt`を含むlocalStorageキーで7日間だけ保持する。

## Next.js 16.3対応

ルートの`params`と`searchParams`はPromiseとしてawaitする。URL絞り込みは`next/form`の文字列action、書き込みはReactのform actionと`useActionState`を使う。フレームワーク変更の正本は`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`、`05-server-and-client-components.md`、`07-mutating-data.md`、`02-guides/forms.md`、`03-api-reference/02-components/form.md`、`03-api-reference/04-functions/revalidatePath.md`である。
