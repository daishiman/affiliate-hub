---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

> **重要:** この index の `確定` / `confirmed` の意味は正本 `lifecycle.confirmed_semantics` が定める — matrix.state=確定 と frontmatter status=confirmed は要求判断の収集済みのみを表し、文書承認・実装完了・検証合格を表さない。実装や検証の判断には、下記の状態軸と各章の As-Is / To-Be / Delta / Acceptance を使う。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 発信者が、一つの信頼できる商品・サービス情報を起点に、複数のブログやSNSへ「誰が・誰に・何を・なぜ伝えるか」が一貫した高品質コンテンツを効率的に生成・公開・改善できる状態をつくり、読者の意思決定品質と発信者の継続的な収益性を同時に高める。
- **ゴール (U3)**: G1=一つのアフィリエイトURLを起点に、正しい商品情報・比較候補・根拠・書き手・読者・媒体・広告表示を統合し、目的の異なる高品質コンテンツを安全に作成・公開・改善できる, G2=どういう情報・切り口・媒体・配置がクリック率とアフィリエイト成果に有効かを計測・分析し、一元管理できる, G3=公開したブログが、読者にとって読み進めやすく、かつ検索エンジンとAI検索の双方から見つかり引用される機械可読な構造を持ち、その充足度を解析して次の記事と既存記事へ反映できる

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G1 G2 G3 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G1 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G3 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G1 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 G1 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G3 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G3 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)

## 仕様統制と状態軸

| 軸 | 値 | 本書での意味 |
|---|---|---|
| `requirement_status` | `draft / approved / superseded` | 要求・設計判断の成熟度 |
| `document_status` | `draft / approved / generated / stale` | 文書または生成ビューの鮮度 |
| `implementation_status` | `not_started / partial / implemented` | 現行コードへの反映度 |
| `verification_status` | `unverified / pass / fail / stale` | 受入証拠による検証結果 |

規範の優先順位と関心ごとの正本は [docs/spec/00-README.md](../docs/spec/00-README.md) に従う。要約すると、`docs/spec/01` は上位要求、`docs/spec/03` は Analytics 詳細の正本、`docs/spec/02` は差分・決定台帳、`spec-state.json` は収集・追跡・レビュー証跡の機械可読正本である。各 `system-spec/*.md` はこれらを実装へ投影する技術ビューであり、上流本文を上書きしない。

各章の「確定内容 (質疑録)」と `spec-state.json.qa_log` は収集時点の不変な履歴であり、現在の詳細契約ではない。履歴の旧schema・過剰な絶対表現と、章先頭の To-Be 契約または `docs/spec/03` が異なる場合は、後者と `review_runs` の変更記録を現在の規範とする。

## 実装依存順

```text
正本・状態規則
→ Auth / Workspace
→ tenant・同意・共通データ契約
→ Editorial / Commercial-Analytics 境界と projection
→ Redirect Resolver / Queue
→ Click・Behavior・Conversion取込
→ Attribution / Rollup / KPI
→ Analytics UI / Insight
→ MCP / WebMCP の正式契約
```

この順序を飛ばして後続を実装した場合、`implementation_status` は上げない。各章の Acceptance evidence が揃ったときだけ `verification_status=pass` とする。
