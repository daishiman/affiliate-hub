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
| Analytics | `src/domain/analytics/` | 指標・計測・同意と、その戻し方の規則 | MetricDefinition / TelemetryEvent / ConsentDecision |

計測（何を測るか・同意・保存期間・AI の利用と費用）は **Analytics の中に置く**。
別コンテキストに切ると「指標」と「計測」で同じ数字を二重に定義することになり、
`1 概念 1 定義` が崩れる。計測の記録は Analytics の中の 3 つの層に分かれる。

| 置き場所 | 持つもの |
| --- | --- |
| `analytics/telemetry-events.ts` | 測れることの全一覧（**唯一の正本**）。送信・保存・集計の型はここから導く |
| `analytics/consent.ts` | 測ってよいかの判断・保存期間・仮の目印の作り方 |
| `analytics/ai-usage.ts` | モデルの価格表と、ブログ × モデルの畳み方 |

改善ループ（測った数字をもとに直す側）も **Analytics の中に置く**。
別コンテキストに切ると、測る側と直す側で指標の定義が 2 つになる。
中は 5 つに分かれ、**上の 3 つは軸の中身を知らない**（軸が増えても変わらない）。

| 置き場所 | 持つもの | 軸の中身を知るか |
| --- | --- | --- |
| `analytics/improvement.ts` | 比べ方と次の一手の作り方 | 知らない |
| `analytics/loop-run.ts` | 1 周の状態遷移（始める・判定する・打ち切る） | 知らない |
| `analytics/loop-kinds.ts` | ループの種類と、自動で付く歯止め | 知らない |
| `analytics/optimization.ts` | **変えられるものの全一覧（唯一の正本）** | 知る |
| `analytics/variant-spec.ts` | 「軸 → 値」の設定と、その差 | 軸の登録表だけ見る |

**改善ループは Ranking へ触れない。** 触れるのは記事の書き直しと題材選びまでで、
これは `optimization.ts` の `assertRegistrable` が、既にある
`analytics/feedback-policy.ts` の判定へそのまま突き当てることで守る
（同じ決まりを 2 か所に書かない）。

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
| 計測 → domain（実装の持ち込み） | ドメインが計測の実装を知ると差し替えられない | `TelemetrySinkPort` 経由のみ。`tests/architecture/dependency-direction.test.ts` |
| 共通UI → 通信 | 部品が送信を持つと、部品ごとに測り方が分かれる | `tests/ui/ui-layers.test.ts`（UI に `fetch(` を書けない） |
| 改善ループ → Ranking / 推奨 / 合格ライン | 数字を理由に順位を動かす抜け道になる | `optimization.ts` `assertRegistrable` → `feedback-policy.ts`。`tests/domain/improvement.test.ts` |
| 改善ループ → 根拠 / 広告表示 / アクセシビリティ / 同意の見せ方 | 減らすほど数字が良くなるので、対象にすると必ず削られる | `NON_OPTIMIZABLE` 6 件。同上 |
| domain → 外側の層 | 層の意味が消える | lint + テスト |

## コンテキスト間の言葉のずれ

同じ単語でも、コンテキストが違えば別物として扱う。

| 単語 | Product Intelligence での意味 | Monetization での意味 |
| --- | --- | --- |
| 価格 | 販売店が提示している金額（確認日時つき） | 成果計算のもとになる売上額 |
| リンク | 商品ページの URL | ASP 発行の改変禁止 URL |
| 商品 | 同定済みの実体 | ASP のプログラムに紐づく掲載対象 |

ずれを吸収するのは application 層のユースケースであり、domain で混ぜない。
