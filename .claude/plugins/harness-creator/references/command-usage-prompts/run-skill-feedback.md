/run-skill-feedback
# /run-skill-feedback 用途プロンプト（収集のみ・最小対話）

<!-- feedback_protocol_sha256: aca90c807796ddee7d71a56436281586516cfa65501438606bd89f95f5730d0d -->
<!-- required_intake_fields: 要望タイトル|要望種別|やってほしいこと -->
<!-- optional_intake_fields: 対象スキル名|背景・困っていること|優先度|重要度|関連 PR/コミット URL -->

## 目的と責務境界

利用者の「こう直してほしい」を、確定した対象プラグインと N:1 relation で紐付けて Notion 改善要望 DB へ収集する。改善の実装・修正・着手は自動実行しない。

対話と同定フローの正本は `doc/notion-schema/skill-list.schema.json#feedback_protocol`、投入先プロパティの正本は `doc/notion-schema/improvement-request.schema.json` とする。

## 起動

```text
/run-skill-feedback [plugin?] [skill-name?]
```

`plugin` と `skill-name` は任意引数。指定があっても目的と現状仕様を確認し、利用者の合意なしに対象を確定しない。

## 既定フロー

1. `feedback_protocol.identification_step` に従い、作業目的から対象プラグインとスキルを同定する。確定できなければ投入を中断し、追加ヒアリングへ戻る。
2. 必須の **要望タイトル**、**要望種別**、**やってほしいこと** を収集する。
3. **対象スキル名**、**背景・困っていること**、**優先度**、**重要度**、**関連 PR/コミット URL** は任意。利用者が既に示した値は聞き直さず、未指定の優先度・重要度は中を使う。
4. 矛盾や必須欠落がないかを短く確認し、投入する。対象プラグインがスキル一覧 DB に無ければ、投入スクリプトが POST 前に exit 2 で中断する。
5. 作成された Notion ページ URL と、起票者・担当者は Notion UI で人手追加する旨を返す。

## 投入前確認

利用者がプレビューを求めた場合、または入力整形の確認が必要な場合だけ `--dry-run` を使う。`--dry-run` は送信ペイロードを表示するだけで、スキル一覧 DB の登録有無は確認しない。

```bash
python3 scripts/notion-submit-improvement.py --plugin <plugin> --dry-run \
  --title "<title>" --type "<type>" --desire "<desire>"
```

実投入時の未登録エラーは、次の単一復旧コマンドを案内する。

```bash
python3 scripts/notion-upsert-plugin.py --plugin <plugin>
```

## 検証強度

既定は上記の最小対話と必須欠落確認だけとする。並列 Agent や30思考法の分析は通常の改善要望投入の前提にしない。利用者が exhaustive（網羅的）レビューを明示依頼した場合のみ、別の読み取り専用検証として追加する。その場合も収集フィールドの required / optional は変更しない。

## 禁則

- 対象プラグインを確定できないまま「不明」名で投入しない。
- token / DB ID を応答、log、context に出力しない。
- `--dry-run` をプラグイン登録確認として扱わない。
- 類似要望を AI 判定で重複除去しない。
- 収集の完了を改善実装の着手と扱わない。
