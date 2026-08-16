# 境界づけられたコンテキストと関係図

同じ言葉が別の意味を持つ境目でコンテキストを切る。
コンテキストをまたぐ連絡は**ドメインイベント**か**公開インターフェース（ポート）**だけとし、
別コンテキストのリポジトリを直接呼ばない。

## 9 つのコンテキスト

| コンテキスト | 置き場所 | 責務 | 中心となる集約 |
| --- | --- | --- | --- |
| Identity & Tenancy | `src/domain/identity/` | 誰が、どのワークスペースで、何をできるか | Workspace / Brand / Membership |
| Product Intelligence | `src/domain/product/` | 商品の同定と価格 | Product / MerchantOffer / ComparisonSet |
| Evidence & Claim | `src/domain/evidence/` | 主張と、その根拠 | Claim / Evidence / TestRun |
| Ranking | `src/domain/ranking/` | 評価基準と順位 | RankingModel |
| Content Authoring | `src/domain/authoring/` | 記事の設計・生成・状態 | ContentPackage / ContentVariant / SiteBlueprint |
| Distribution | `src/domain/distribution/` | どこへ、いつ出すか | Publication / ChannelConnection |
| Affiliate & Monetization | `src/domain/monetization/` | 報酬・リンク・成果 | AffiliateProgram / AffiliateLink / Conversion |
| Compliance | `src/domain/compliance/` | 広告表示・表現規制・監査 | Disclosure / PolicyRule / AuditLog |
| Analytics | `src/domain/analytics/` | 指標と、その戻し方の規則 | MetricDefinition |

## 共有カーネル（最小限）

`src/domain/shared/` に置いてよいのは、**どのコンテキストでも同じ意味を持つもの**だけ。

- 識別子（`Tagged<string, "ProductId">` などの名前付き型）
- `Result` と `DomainError`
- `Clock`（時刻の注入）
- `Provenance`（情報の由来）
- `Money`
- テナント境界（`ActorContext` / `assertSameTenant`）
- Editorial / Commercial の印

置いてはいけないもの: 評価軸、ランキングの重み、記事構成。これらはコンテキスト固有である。
共有カーネルが太ると、1 箇所の変更が全コンテキストへ波及する。

## 関係図

```text
                      Identity & Tenancy
                    （全コンテキストの前提）
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  Product Intelligence   Evidence & Claim      Compliance
        │                     │                     │
        │  商品と価格          │  根拠つき主張        │  開示・表現規制
        └──────────┬──────────┘                     │
                   ▼                                │
                Ranking ◀────────────────────────── │（開示文の要求）
                   │  順位と評価基準の説明            │
                   ▼                                │
           Content Authoring ───────────────────────┤
                   │  ContentVariant                │  公開ゲート
                   ▼                                │
             Distribution ◀─────────────────────────┘
                   │  Publication
                   ▼
               Analytics
                   │
                   │  ※ 収益の指標は編集判断へ戻さない
                   ╳
                Ranking

  Affiliate & Monetization
        │  リンク・成果（Commercial 区分）
        ├──→ Content Authoring（CTA に置くリンクとして）
        ├──→ Distribution（掲載条件の確認）
        ├──→ Analytics（収益の指標として）
        └──╳ Ranking / Evidence / Product（禁止。機械検査で落とす）
```

## 禁止された関係（機械検査つき）

| 禁止 | 理由 | 検査 |
| --- | --- | --- |
| Ranking → Monetization | 報酬が順位に影響する | `tests/architecture/dependency-direction.test.ts` |
| Evidence → Monetization | 根拠の採否が報酬で歪む | 同上 |
| Product → Monetization | 商品情報に報酬が混ざる | 同上 |
| Analytics の収益指標 → Ranking / 推奨 | 売れた商品を上に出す汚染 | `domain/analytics/feedback-policy.ts` |
| domain → 外側の層 | 層の意味が消える | lint + テスト |

## コンテキスト間の言葉のずれ

同じ単語でも、コンテキストが違えば別物として扱う。

| 単語 | Product Intelligence での意味 | Monetization での意味 |
| --- | --- | --- |
| 価格 | 販売店が提示している金額（確認日時つき） | 成果計算のもとになる売上額 |
| リンク | 商品ページの URL | ASP 発行の改変禁止 URL |
| 商品 | 同定済みの実体 | ASP のプログラムに紐づく掲載対象 |

ずれを吸収するのは application 層のユースケースであり、domain で混ぜない。
