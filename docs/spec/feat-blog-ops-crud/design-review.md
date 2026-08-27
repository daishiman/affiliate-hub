# 設計レビュー (P03)

## BP (ブループリント整合) チェック

| ID | 観点 | 判定 | 根拠 |
|---|---|---|---|
| BP-01 | サイト網 (ハブ/サブ/ミニ) が表現できる | OK | `site_network_node.role` + `parent_slug` |
| BP-02 | ヘッダー 3 部品・サイドバー 8+2・フッター 3 層が枠として持てる | OK | `blog_layout_slot.region` + `slot_key` |
| BP-03 | トップ 4 帯が並び替え・件数指定できる | OK | `blog_layout_band` |
| BP-04 | 記事型 T1–T4 と 15 部品列が表現できる | OK | `blog_article.template` + `blog_article_block.kind` |
| BP-05 | 固定ページ 8 種が種別ごと 1 枚 | OK | `legal_page` の unique(site_slug, kind) |
| BP-06 | 配信部品 9 種の有効可否 | OK | `blog_delivery_part` |

## AT (アーキテクチャ) チェック

| ID | 観点 | 判定 | 根拠 |
|---|---|---|---|
| AT-01 | 依存方向 domain ← application ← infrastructure / presentation | OK | domain は他層を import しない |
| AT-02 | 単一定義 (同じ概念の二重定義なし) | OK | 状態語彙は既存 `articles.status` と同一、部品 id は docs/spec/13 の id をそのまま使う |
| AT-03 | テナント境界 (全問い合わせに workspace_id) | OK | 読者評価だけ article_id 経由で所属が決まる |
| AT-04 | Editorial / Commercial 遮断 | OK | 本 feature のポートはすべて `markEditorial`。報酬系の依存を受け取らない |
| AT-05 | 監査記録の発行 (書き込み操作) | OK | 作成・更新・削除の各ユースケースが同一ファイル内で `auditLog.append` を呼ぶ |

## 判断の記録

- **既存 `articles` を拡張せず新設した**理由: `articles` / `content_variants` は生成・
  校正・公開ゲートの流れを持つ。ブログ面の「配置・型・評価」をそこへ足すと、
  1 つの表が 2 つの目的を持ち、片方の都合で他方の列が増え続ける。
- **REST を置かなかった**理由: 同じ操作に入口が 2 つあると権限判定と監査が 2 か所に分かれる。
- **読者評価を別ポートにした**理由: 読み口と書き口を混ぜると、読者からの要求で
  記事を書き換える経路が型の上で作れてしまう。
