---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G1]
---

# 本章での適用 — 認証(ログイン) (auth)

> 本文は [`../auth.md`](../auth.md) の一部である。章の分量の見積もりから適用メモを外すために別ファイルにしてあるだけで、内容・順序・語句は章に在ったときと同じである。

#### 本章での適用

##### 確定内容 qa-auth-web (対応セル: web)

- 確定要件: A. Better Auth (Better Auth + Google OAuth) を選択。無料・OSS で、D1/Drizzle アダプタにより現行の Next.js + Cloudflare Workers + D1 スタックと同居できる。Google ログインを初期提供し、メール/パスワード・パスキーは後続拡張とする。セッションは D1 に保存し、Workspace 単位のマルチテナント分離と §25 のロール (Owner/Admin/Researcher/Writer/Reviewer/Publisher/Analyst) 権限をアプリ層で紐付ける。外部公開・予約投稿等の重要操作は認証済みユーザーの明示承認を必須とする。
- 設計解釈の記録経路: `dialogue`
- 原則: 最小権限の原則: ロールごとに操作可能範囲を限定し、公開・削除等の重要操作は承認フローを経る (`docs/spec/01-要求仕様書-v1.0.md#§25 チーム権限`)
  - 採否: `applied`
  - 章固有の根拠: Better Auth のセッション/組織機能の上にアプリ層で Workspace ロールを実装し、§25 の Researcher/Writer/Reviewer/Publisher/Analyst 分業を強制する
  - トレードオフ:
    - ロール管理UIを自作する実装コストが増えるが、IDaaS 依存とユーザー課金を回避できる
- 原則: 秘密情報 (OAuth クライアントシークレット・セッション鍵) は環境シークレットに分離し、テナントデータと混在させない (`docs/spec/01-要求仕様書-v1.0.md#§26.2 秘密情報管理`)
  - 採否: `applied`
  - 章固有の根拠: Google OAuth のシークレットは Cloudflare Workers の Secrets に保管し、D1 にはセッション/アカウント情報のみを保存する
  - トレードオフ:
    - シークレットローテーション手順を保守運用に追加する必要がある
- 資するゴール: G1
