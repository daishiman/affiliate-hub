#!/usr/bin/env python3
"""scenario ``C02-OUT1-positive-mixed-artifacts`` (skill: dev-graph:run-dev-graph-node) の形状。

fixture 契約 (live-trial-positive-scenarios.json):
  "A contained initialized repository supplies one valid issue, task, specification,
   architecture, and document artifact in a single input batch."

置くもの: fixture repo 直下の ``mixed-artifacts.json`` と、入力を安全に複製するための
空の ``inputs/`` staging directory。

入力スキーマの根拠 (推測ではなく実装から確定した事実):
  - ``scripts/upsert-node.py`` の ``_input`` は「JSON object 1 個」しか受けず (payload が
    dict でなければ ContractError)、``_request_node`` が受け付ける形は
    ``{"node": {...}}`` / ``{"graph_node_id": ..., "patch": {...}}`` / 素の canonical node の
    3 種のみである。配列も batch も受けない。
  - すなわち ``mixed-artifacts.json`` は C02 writer へ直接渡す入力ではない。SKILL.md の
    ``Classification and write`` 2 項と ``prompts/R1-classify.md`` の入力契約
    (「artifact本文、kind/domain/project hint、routing policy、template contract」) が示す
    とおり、これは **分類前の成果物素材のバッチ** であり、skill が 1 件ずつ
    ``artifact_kind``/``domain``/``project_id``/正規 path を推定してから、
    ``upsert-node.py`` の単一 node 入力へ変換して writer へ渡す。
  - したがって本 file に固有の JSON Schema は存在しない (schemas/ にも無い)。形状の正本は
    genuine PASS を出した実走証跡 eval-log/dev-graph/run-dev-graph-node/live-trial/
    20260713T090000-r3/transcript.jsonl の Write で、``[{title, body, tags}, ...]`` の
    素の配列だった。ここでもその形状を保つ。

設計判断 (なぜ「完成した node」を置かないか):
  - ``artifact_kind`` を fixture 側で宣言すると R1 の分類が自明になり、required_observation
    「all five artifacts are routed to canonical kind paths」が試験されなくなる。kind は
    本文だけから一意に決まるように書き、宣言はしない。
  - ``graph_node_id`` も置かない。SKILL.md の Layer 7 方針どおり node ID は skill 側が決める
    領域であり、fixture が与えると「正規 path の確定」まで先取りしてしまう。
  - 本文は「必須セクションの一部だけを持つ自然な原稿」にする。全セクションを埋めると R4 の
    差分追記 (不足セクションのみ追加) が空振りする。逆に見出しゼロだと分類根拠が薄くなるため、
    kind を一意に決める見出しだけを含める。必須セクションの正本は
    ``templates/template-contract.json`` の ``artifacts.<kind>.required_sections``。
  - specification は破壊的 API 変更を明記して conditional template ``api_changed``
    (api-contract overlay) を、architecture は backend と security の両観点を明記して
    subtype 複数選択を、それぞれ skill 側に要求させる。

決定論性: 全内容が literal で、時刻・乱数・生成先 path に依存しない。
"""
from __future__ import annotations

import json
from pathlib import Path

from .base_shape import finalize, scaffold

SHAPE = "node"

# 入力バッチの置き場所。scenario の task_args_template
# ``--input <contained-fixture-repo>/mixed-artifacts.json`` と 1 対 1 で対応する。
BATCH_FILENAME = "mixed-artifacts.json"

# live trial が元の素材を shell 展開で壊さず複製できる、安全な入力 staging directory。
# 空 directory は git が追跡しないため .gitkeep を含め、trial 開始前の fixture commit に
# 存在させる。これにより goal-seek evidence を記録する前の mkdir mutation が不要になる。
INPUT_STAGING_DIR = "inputs"

# 5 種の素材。kind は宣言せず本文だけで一意に決まるようにする。
# 各 body の見出しは template-contract.json の required_sections の部分集合であり、
# 残りの必須セクションは R4-apply-template が差分追記する余地として意図的に空けてある。
ARTIFACTS: list[dict[str, object]] = [
    {
        # issue: 不具合報告。現在の挙動と期待する挙動の対比が issue を一意に決める。
        "title": "ログインセッションのタイムアウトが強制されない",
        "body": "\n".join(
            [
                "## 概要",
                "",
                "設定したセッションタイムアウトを過ぎても、ログイン済みセッションが無効化されない。",
                "",
                "## 背景と問題",
                "",
                "セッション期限の判定が発行時刻ではなく最終アクセス時刻の更新漏れに依存しており、",
                "期限切れ判定が一度も真にならない経路が残っている。",
                "",
                "## 現在の挙動",
                "",
                "タイムアウト経過後も保護リソースへアクセスでき、再認証を求められない。",
                "",
                "## 期待する挙動",
                "",
                "設定したタイムアウトを過ぎたセッションは失効し、ログイン画面へ誘導される。",
                "",
                "## 再現手順またはユースケース",
                "",
                "1. セッションタイムアウトを 30 分に設定する",
                "2. ログインしてそのまま 35 分待機する",
                "3. 保護リソースへアクセスする",
                "4. セッションが有効なままになっている",
                "",
                "## 影響と優先度",
                "",
                "失効しないセッションが残るため、端末を放置した場合に第三者が操作できる。",
                "認証境界に直結するため優先度は高い。",
            ]
        ),
        "tags": ["bug", "security", "session-management"],
    },
    {
        # task: 実装作業。目的・実行手順・受入条件の並びが task を一意に決める。
        "title": "公開 API エンドポイントへレートリミットを実装する",
        "body": "\n".join(
            [
                "## 目的",
                "",
                "公開 API にレートリミットを導入し、過剰なリクエストによる劣化を防ぐ。",
                "",
                "## 背景",
                "",
                "現在は公開エンドポイントに上限がなく、単一クライアントの連続呼び出しで",
                "他利用者のレイテンシが悪化する。",
                "",
                "## 入力と前提条件",
                "",
                "- 入力: HTTP リクエスト (送信元 IP と API key)",
                "- 前提: 共有キャッシュストアが利用できる",
                "",
                "## 出力と成果物",
                "",
                "- レートリミット middleware",
                "- 上限超過時の 429 レスポンスと Retry-After ヘッダ",
                "",
                "## 実行手順",
                "",
                "1. token bucket のカウンタ実装を追加する",
                "2. middleware として公開ルートへ組み込む",
                "3. 上限値を設定値として外部化する",
                "",
                "## 受入条件",
                "",
                "- [ ] 上限を超えた呼び出しが 429 を返す",
                "- [ ] API key ごとにカウンタが独立している",
            ]
        ),
        "tags": ["backend", "api", "rate-limiting"],
    },
    {
        # specification: 仕様書。API契約の破壊的変更を明記し、conditional template
        # ``api_changed`` (api-contract overlay) の適用条件を満たす素材にする。
        "title": "REST API v2 移行仕様",
        "body": "\n".join(
            [
                "## 目的と成功状態",
                "",
                "REST API v1 から v2 へ移行し、既存クライアントが期限内に破壊的変更へ追従できる状態にする。",
                "",
                "## スコープ",
                "",
                "- 対象: 公開 REST API の users / orders / sessions 系エンドポイント",
                "- 対象外: 内部管理用エンドポイント",
                "",
                "## 機能要件",
                "",
                "- v2 は一貫したページネーション封筒を返す",
                "- v1 と v2 は移行期間中に併存する",
                "",
                "## API契約",
                "",
                "本仕様は API の破壊的変更を含む。",
                "",
                "### 破壊的変更",
                "",
                "- `GET /api/v1/users` を `GET /api/v2/users` へ移し、ページネーション封筒を変更する",
                "- `POST /api/v2/orders` のリクエスト本文で `items` を `line_items` へ改名する",
                "- 認証ヘッダを `X-API-Key` から `Authorization: Bearer` へ変更する",
                "",
                "### 追加エンドポイント",
                "",
                "- `GET /api/v2/users/{id}/preferences`",
                "- `DELETE /api/v2/sessions/bulk`",
                "",
                "### 非推奨エンドポイント",
                "",
                "- `GET /api/v1/users/search` は `GET /api/v2/users` のクエリパラメータへ統合する",
                "",
                "## 互換性・移行・リリース",
                "",
                "v1 は v2 の一般提供開始から 6 か月維持し、その間 Sunset ヘッダを付与する。",
            ]
        ),
        "tags": ["api", "specification", "migration", "breaking-change"],
    },
    {
        # architecture: 設計文書。backend と security の両観点を明記し、
        # artifact_subtypes の複数選択 (backend + security) を skill 側に要求する。
        # 見出しは template-contract.json の architecture required_sections に合わせ英語。
        "title": "注文処理バックエンドのアーキテクチャとセキュリティ層",
        "body": "\n".join(
            [
                "## Architecture overview",
                "",
                "注文処理パイプラインのバックエンド構成と、それに組み込むセキュリティ制御を定義する。",
                "",
                "## Context and drivers",
                "",
                "決済と在庫を跨ぐ更新を単一障害で不整合にしないこと、",
                "および個人情報の保護要件を満たすことが主要な制約である。",
                "",
                "## System context and boundaries",
                "",
                "1. クライアント から API gateway (TLS 終端)",
                "2. API gateway から 認証サービス (トークン検証)",
                "3. 認証サービス から 注文サービス (認可済みリクエスト)",
                "4. 注文サービス から 決済・在庫 (saga による調停)",
                "5. 全更新を監査ログへ非同期送出",
                "",
                "## Container and component view",
                "",
                "- 注文サービス: 注文ライフサイクル (作成・更新・取消) を保持する",
                "- 決済アダプタ: 外部決済事業者との境界を 1 か所へ閉じる",
                "- 在庫サービス: 楽観ロックで在庫を更新する",
                "- 通知サービス: イベント駆動で通知を送出する",
                "",
                "## Subtype architecture",
                "",
                "### Backend",
                "",
                "サービス間は非同期メッセージで疎結合にし、注文集約のみが在庫と決済を調停する。",
                "永続化は関係データベース、冪等性キーで再送を吸収する。",
                "",
                "### Security",
                "",
                "- 認証: 公開鍵署名のトークンとリフレッシュトークンの回転",
                "- 認可: 役割ベースのポリシー評価をゲートウェイ直後で行う",
                "- データ保護: 保存時の個人情報を暗号化し、転送は TLS のみ許可する",
                "- 監査: 追記専用の監査ログで改竄を検出する",
            ]
        ),
        "tags": ["architecture", "backend", "security", "infrastructure"],
    },
    {
        # document: 手引き。対象読者と要約を持つ説明文書であることが document を一意に決める。
        "title": "開発環境セットアップの手引き",
        "body": "\n".join(
            [
                "## 目的",
                "",
                "新しく参加した開発者が、自分の端末で開発環境を立ち上げられるようにする。",
                "",
                "## 対象読者",
                "",
                "本リポジトリで初めて作業する開発者。",
                "",
                "## 要約",
                "",
                "依存関係をコンテナで起動し、環境変数を設定してから開発サーバを起動する。",
                "",
                "## 本文",
                "",
                "### 前提",
                "",
                "- コンテナランタイム",
                "- 関係データベースのクライアントツール",
                "- git",
                "",
                "### 手順",
                "",
                "1. リポジトリを clone する",
                "2. 環境変数のひな形を複製して値を設定する",
                "3. 依存サービスをコンテナで起動する",
                "4. 依存パッケージを導入し、マイグレーションを適用する",
                "5. 開発サーバを起動する",
                "",
                "### よくある問題",
                "",
                "- ポート衝突: 既存プロセスの残存を確認する",
                "- データベース接続失敗: 依存コンテナの起動状態を確認する",
                "",
                "## 関連資料",
                "",
                "- 注文処理バックエンドのアーキテクチャとセキュリティ層",
            ]
        ),
        "tags": ["documentation", "onboarding", "developer-guide"],
    },
]


def build(out: Path) -> None:
    """C02 scenario 用の隔離 fixture repository を生成する。

    graph は空 (revision 0 / nodes 0 件) にする。content root
    (issues/tasks/specs/architecture/docs) にも何も置かない。scenario は
    「skill が 5 種を分類して正規 path へ登録できるか」を観測するものなので、登録結果を
    先に置いてしまうと観測対象が消える。素材を repo 直下へ 1 本置き、trial が
    goal-seek evidence の記録後に安全な入力コピーを書ける空 staging directory も用意する。
    """
    scaffold(out, kind=SHAPE)
    (out / BATCH_FILENAME).write_text(
        json.dumps(ARTIFACTS, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    staging = out / INPUT_STAGING_DIR
    staging.mkdir(parents=True, exist_ok=True)
    (staging / ".gitkeep").write_text("", encoding="utf-8")
    finalize(out)
