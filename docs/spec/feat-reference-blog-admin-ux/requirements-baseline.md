# 参照ブログ解析と低認知負荷 UX 要求ベースライン

- feature: `feat-reference-blog-admin-ux`
- baseline: 2026-08-30
- source: root sitemap 1件（`url_digest` = `848e04bd7ef19bed3f5f205a3e81669605d267972960fbfab5ca4ff67b60019c`、実URLは `evidence/reference-site-profile.json`）
- inventory digest: `bac24ebe95f012964c6d51f7bfaec1266783e09c9505187925edcdc3c352b288`
- retention: URL、lastmod、分類、HTTP 応答、digest だけを保持し、本文・写真・ロゴ・CSS・theme/plugin asset は保持しない。
- isolation: 参照元のホスト・実URL・固有名は `evidence/` 配下だけに置く。この階層の文書と `sitemap-snapshot.json` / `reference-url-inventory.json` は抽象パスと digest だけを持つ。

## 検算済みの全体数

| 区分 | 件数 | 備考 |
|---|---:|---|
| sitemap part | 14 | 2018–2026 の年別post 9、page、category、tag、author、news |
| sitemap membership | 1,073 | news の home 1件が page と重複 |
| 重複除外 canonical URL | 1,072 | 未分類 0 |
| 記事 | 968 | 2018=45、2019=214、2020=150、2021=137、2022=111、2023=100、2024=81、2025=70、2026=60 |
| page | 17 | home 1、記事索引 2、比較/診断 6、固定/ユーティリティ 8 |
| category / tag | 32 / 32 | taxonomy 一覧型 |
| author | 23 | 著者プロフィール+投稿一覧 |

## A1–A12

| ID | 完了の判定 |
|---|---|
| A1 | 14 part の status、lastmod、content digest、所属URL数を snapshot で検算できる |
| A2 | 1,072 canonical URL が screen type/variant のいずれかに属し、未分類 0 |
| A3 | 公開/管理画面一覧に配置、状態、data、受入を定義 |
| A4 | 構成原則だけを独自 token/component へ変換し、参照元の表現とassetを転用しない |
| A5 | 新規作成は template→必須値→下書きの主導線1本 |
| A6 | 未保存/保存中/保存済み/失敗/競合と端末下書き復元 |
| A7 | 改善案を重要度とblockでまとめ、before/after→適用→取消 |
| A8 | URL貼付後の9項目preview、SSRF防御、画像無し図解fallback |
| A9 | 状態/提携先/最終確認/掲載数/要確認の一覧と site/page/block 逆引き |
| A10 | 初見タスク完了、保存判別、掲載先特定の各90%以上 |
| A11 | 主要flowの keyboard、200% zoom、axe critical/serious 0、色のみ依存 0 |
| A12 | gap ledger→test ID→実装→acceptance evidence が同じ ID で追跡可能 |

## 再生成

```bash
python3 scripts/reference-site-analysis/collect_reference_inventory.py \
  --site-profile docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json
```

収集対象のホストは script に埋め込まれていない。site profile が無ければ収集は起動せず失敗する。
1 回の実行が 2 層を書く。`evidence/*.raw.json`（実URLを持つ）と、この階層の
`sitemap-snapshot.json` / `reference-url-inventory.json`（抽象パスと digest だけ）である。

network 差分は `inventory_digest`、part単位差分は `content_sha256`で確認する。参照元の内容を保存するモードは用意しない。
