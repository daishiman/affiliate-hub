# ローカル seed / 認証証跡

## 再現コマンド

```bash
pnpm db:migrate:local
pnpm seed:local
```

seed はローカル D1 のみを対象にし、remote を更新しない。再実行可能な upsert / delete+insert 手順である。

AC08の実画面検査用に次の2件も同じseedへ含める。再seed時は対象IDだけを削除して既知状態へ戻す。

- 改善要望 `fb_sample_sort`: 扱い決定→undoの通常操作
- 成果リンク `al_seed_replace_preview`: 旧行を止めて登録し直す影響確認

## 確認値

| entity | count |
| --- | ---: |
| user | 1 |
| memberships | 2 |
| articles | 6 |
| blog_article_block | 24 |
| blog_tag | 5 |
| site_network_node | 4 |
| legal_page | 10 |
| feedback_reports（機能用seed ID） | 1 |
| affiliate_links（機能用seed ID） | 1 |

ログイン対象は `owner@local.test`、表示名は「ローカル検証用の担当者」、role は `owner`。ローカル開発ログインは password 認証ではないため password は存在しない。`.dev.vars` の `DEV_SIGNIN_ENABLED=1` と `DEV_SIGNIN_EMAIL=owner@local.test` により、signin 画面の専用ボタンで入る。
