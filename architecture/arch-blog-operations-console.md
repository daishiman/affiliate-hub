---
graph_node_id: "arch-blog-operations-console"
artifact_kind: "architecture"
artifact_subtypes: ["frontend","backend","data","infrastructure","security"]
project_id: "affiliate-hub"
domain: "platform-architecture"
tags: ["blog-scoped","admin-console","custom-domain","analytics","seo","aeo"]
priority: null
start_date: null
target_date: null
iteration: null
title: "ブログ単位運営コンソールのアーキテクチャ"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T00:00:00Z"
status: "active"
depends_on: []
related_nodes: ["arch-two-layer-platform","arch-system-spec-overview","spec-system-spec-index"]
resource_scope: ["src/app/admin/sites/","src/domain/domains/","src/domain/analytics/","src/domain/seo/","src/domain/aeo/","src/db/schema.ts","system-spec"]
purpose: "ブログを管理の単位に据えたときの、住所 (ドメイン)・観測 (行動と指標)・改善 (SEO/AEO)・提示 (管理コンソール) の 4 層の責務境界と依存の向きを固定する。"
goal: "住所層・観測層・改善層が互いを直接呼ばず、提示層だけが 4 層を横断して並べ替え、site_slug を唯一の結合キーとして全層が同じブログを指す状態。"
scope_in: ["site_slug を唯一の結合キーとする層間の接合","住所層 (site_custom_domains) と既定住所導出の関係","観測層 (reader_interaction_events → 日次ロールアップ) の一方向","改善層 (SEO/AEO 診断 → 下書き → 既存承認経路) の一方向","提示層 (/admin/sites/[site]/) が読むだけで書かない境界"]
scope_out: ["各層の実装詳細 (各 feature が持つ)","読者面のデザイン規約","権限モデルそのもの (既存 workspace 権限)"]
acceptance: ["観測層が改善層を直接呼ばず、改善層が観測層の集計結果だけを読む","改善層が公開面を直接書かず、必ず下書きと既存承認経路を経る","提示層が集計・診断を再実装せず、上流の結果を並べ替えるだけである","全層が site_slug を同じ意味で使い、別名のブログ識別子を持たない","住所層が非 active のときも既定住所で配信が続く"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-blog-operations-console.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"0e5aa65c5941663f8eb6fa391cc451343491e0e7cc81bde96e88c25788ceeb31","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"bfd54655ae9a9f448eca91fcd6f57a9a30520bf4632c5f709f4ca504130cff7e","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定済み system-spec 8 章 (auth/backend/database/frontend/infrastructure/maintenance-ops/security/ui-ux) の web 確定セルから、ブログ単位運営に要る 4 層の責務境界を抽出したアーキテクチャ文脈。"
classification_candidates: [{"artifact_kind":"architecture","candidate_path":"architecture/arch-blog-operations-console.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-04T00:00:00Z","evidence_refs":["system-spec/index.md"],"policy":"manual","reconciled_at":"2026-09-04T00:00:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# ブログ単位運営コンソールのアーキテクチャ

## Architecture overview

管理の単位を記事からブログへ移すとき、必要になる関心事は 4 つに分かれる。
住所 (どこで読まれるか)、観測 (何が起きたか)、改善 (どう直すか)、提示 (どの順に見せるか)。
この 4 層は一方向にだけ依存し、`site_slug` を唯一の結合キーとする。

```text
提示層  /admin/sites/[site]/            ← 読むだけ。集計も診断もしない
   ↑ 読む            ↑ 読む            ↑ 読む
住所層              観測層              改善層
site_custom_domains  reader_interaction  article_seo_assessments
既定住所導出         _events             site_aeo_profiles
                       ↓ 日次           article_answer_units
                    site_daily_metrics      ↓ 推奨
                    article_daily_metrics  下書き → 既存の承認経路 → 公開面
```

## Context and drivers

管理の単位が記事のままだと、「このブログは今どうなっているか」に答える場所がどこにもない。
売上も PV も読者行動も記事ごとに散らばり、ドメインはコードの外側で管理され、
SEO/AEO の指摘は誰かの頭の中にしか残らない。

この分割を駆動しているのは 3 つの力である。ブログごとに独自ドメインを持たせたい (住所)、
どの記事がどれだけ稼ぎ誰がどこを見ているかを一元的に知りたい (観測)、
その結果を推測ではなく検証可能な指摘としてブログへ戻したい (改善)。

## Goals and non-goals

**Goals**

- 住所層・観測層・改善層が互いを直接呼ばず、提示層だけが 4 層を横断して並べ替える。
- `site_slug` を唯一の結合キーとし、全層が同じブログを指す。
- 独自ドメインが未検証・失効していても、既定住所での配信が止まらない。

**Non-goals**

- 各層の実装詳細 (各 feature が持つ)。ここは境界と依存の向きだけを固定する。
- 読者面のデザイン規約。
- 権限モデルそのもの。既存の workspace 権限をそのまま使う。

## System context and boundaries

境界の外にあるもの: Cloudflare for SaaS (custom hostname と証明書の実体)、
読者ブラウザ (イベントの発生源)、既存の記事編集・承認経路 (公開面への唯一の書き込み口)。

境界の内にあるもの: D1 上の 4 層のテーブル群と、それらを読む `/admin/sites/[site]/` の画面群。
外部システムの状態 (証明書の発行状況など) は住所層が写し取って持つが、正本は外側にある。

## Container and component view

- **住所層**: `site_custom_domains` と既定住所導出。Cloudflare for SaaS の
  custom hostname 状態を写し取り、所有権が検証されたときだけ `active` にする。
- **観測層**: `reader_interaction_events` (生) → 日次ロールアップ →
  `site_daily_metrics` / `article_daily_metrics` (集計)。
- **改善層**: `article_seo_assessments` / `site_aeo_profiles` / `article_answer_units`。
  観測層の集計と公開面の出力を読み、指摘と下書きを出す。
- **提示層**: `/admin/sites/[site]/` 配下の画面群。3 層の結果を読むだけ。

## Cross-cutting contracts

- **結合キー**: 全層が `site_slug` を同じ意味で使う。別名のブログ識別子を層ごとに定義しない。
- **住所層**: 独自ドメインは所有権が検証されたときだけ active になり、active の間だけ
  canonical を持つ。非 active でも既定住所での配信は止まらない。
- **観測層**: 生イベントは要素相対比率で持ち、個人へ戻す列を持たない。
  日次ロールアップは冪等で、同じ日を何度集計しても同じ結果になる。
  生イベントが 90 日で消えた後も集計は残る。
- **改善層**: 検証可能な指摘だけを出す。公開面を直接書かず、必ず下書きを経て
  既存の人間承認経路へ載せる。
- **提示層**: 頻度 × 失敗コストで順位を決め、根拠件数が足りないものは出さない。
  集計や診断をこの層で再実装しない。

### 禁止依存

- 観測層 → 改善層の直接呼び出し (改善層が集計結果を読む向きだけ)
- 改善層 → 公開面の直接書き込み (下書き経由のみ)
- 提示層 → 生イベントの直接集計 (ロールアップ結果を読む)
- 各層が `site_slug` 以外のブログ識別子を独自に定義すること

## Subtype architecture

- **frontend**: 提示層のみ。`/admin/sites/[site]/` を site scope の入口とし、
  記事は必ずブログの下に位置づける。読み取り専用の集計表示と、住所・改善の操作面を分ける。
- **backend**: 住所層の検証遷移と、観測層の日次ロールアップジョブ。
  どちらも冪等な再実行が前提。
- **data**: 4 層のテーブル所有境界。書き込み主体は層ごとに 1 つに限る。
- **infrastructure**: Cloudflare for SaaS custom hostname と Workers/OpenNext 上の
  ルーティング。既定住所は常に存在し、独自ドメインは上乗せにすぎない。
- **security**: 生イベントに個人識別子を置かない。住所層は所有権検証を経ない
  ホスト名を active にしない。

## Architecture decisions

- **AD-1: 4 層を一方向依存に固定する。** 双方向にすると「観測が改善を呼び、改善が観測を書く」
  循環が生まれ、どちらの結果が正かが決まらなくなる。
- **AD-2: 提示層に計算を置かない。** 画面ごとに集計を書くと、同じ指標が画面ごとに違う値になる。
- **AD-3: 改善層に公開面の書き込み権限を与えない。** 自動反映は速いが、誤った指摘が
  そのまま読者へ出る。既存の承認経路を必ず通す。
- **AD-4: 生イベントを 90 日で捨てる。** 保持コストと個人情報の残存を抑える。
- **AD-5: `site_slug` を結合キーにする。** 数値 id ではなく人間が読める安定キーにして、
  URL・ログ・管理画面で同じ語を使えるようにする。

## Delivery, migration and rollback

- 4 層は独立に載せられる。住所層・観測層は既存の記事管理に触れずに追加でき、
  提示層だけが 3 層の存在を前提とする。
- 既存の記事単位画面は残したまま、ブログ単位の入口を先に足す。移行はリンクの張り替えで進める。
- Rollback: 提示層の画面を落としても、住所層の配信と観測層の記録は独立に動き続ける。
  住所層で独自ドメインを非 active に戻しても既定住所で配信が継続する (AD-1 の帰結)。

## Risks and verification

**Risks**

- 生イベントを 90 日で捨てるため、過去に遡って新しい切り口で再集計することはできない。
- ヒートマップを集計分布に限るため、単一読者の詳細な行動は分からない。
  これは制約ではなく、読者個人の再現ができないことを構造で保証する設計判断である。
- 外部 (Cloudflare) の証明書状態と住所層の写しがずれる可能性がある。写しは常に遅れうる前提で扱う。

**Verification**

- 観測層が改善層を直接呼ばず、改善層が観測層の集計結果だけを読む。
- 改善層が公開面を直接書かず、必ず下書きと既存承認経路を経る。
- 提示層が集計・診断を再実装せず、上流の結果を並べ替えるだけである。
- 全層が `site_slug` を同じ意味で使い、別名のブログ識別子を持たない。
- 住所層が非 active のときも既定住所で配信が続く。
