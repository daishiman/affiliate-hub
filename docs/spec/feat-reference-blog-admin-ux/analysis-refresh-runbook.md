# 参照サイト分析 更新runbook

## 契約

| 項目 | 内容 |
|---|---|
| owner | 編集基盤担当 |
| trigger | 月1回、またはsitemap構成の変更を検知したとき |
| command | `python3 scripts/reference-site-analysis/collect_reference_inventory.py --site-profile <profile> --output-dir <tmp> --evidence-dir <tmp>` とcollector unit test |
| evidence | `sitemap-snapshot.json`、`reference-url-inventory.json`（抽象層）、`evidence/*.raw.json`（生層）、collector unit test、差分レビュー記録 |
| escalation | 取得失敗、未分類1件以上、14 sitemap/1,072 canonicalの基準から意図不明の変動がある場合はP01を再開し、後続releaseを止める |

## 手順

1. 既存成果物を直接上書きせず、一時ディレクトリへ取得する。
   `--evidence-dir` も一時ディレクトリへ向ける。省略すると生層が本番の `evidence/` を上書きする。

   ```bash
   analysis_tmp="$(mktemp -d)"
   python3 scripts/reference-site-analysis/collect_reference_inventory.py \
     --site-profile docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json \
     --output-dir "$analysis_tmp" \
     --evidence-dir "$analysis_tmp"
   ```

2. 件数・未分類・digestとメタデータ差分を確認する。ページ本文、写真、CSS、ロゴ、テーマ資産が出力に混ざっていないことも確認する。

   ```bash
   jq '{sitemap_part_count,canonical_url_count,membership_count,unclassified_count,inventory_digest,retention_policy}' "$analysis_tmp/sitemap-snapshot.json"
   diff -u docs/spec/feat-reference-blog-admin-ux/sitemap-snapshot.json "$analysis_tmp/sitemap-snapshot.json"
   diff -u docs/spec/feat-reference-blog-admin-ux/reference-url-inventory.json "$analysis_tmp/reference-url-inventory.json"
   diff -u docs/spec/feat-reference-blog-admin-ux/evidence/sitemap-snapshot.raw.json "$analysis_tmp/sitemap-snapshot.raw.json"
   diff -u docs/spec/feat-reference-blog-admin-ux/evidence/reference-url-inventory.raw.json "$analysis_tmp/reference-url-inventory.raw.json"
   ```

   抽象層に参照元ホストが混ざっていないことも同時に確認する。

   ```bash
   grep -c "$(jq -r '.root_sitemap | split("/")[2]' docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json)" \
     "$analysis_tmp/sitemap-snapshot.json" "$analysis_tmp/reference-url-inventory.json"
   # 期待値: 両方 0（grep は 0 件のとき exit 1 を返す）
   ```

3. 変動理由をsitemap単位で説明でき、ページ種別の未分類が0件なら4ファイルを置換し、検証する。
   置換後は `evidence/index.json` の digest が古くなるので、必ず再検算する。

   ```bash
   python3 -m unittest scripts/reference-site-analysis/test_collect_reference_inventory.py -v
   python3 scripts/reference-site-analysis/verify_evidence_index.py
   python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reference-blog-admin-ux
   ```

   `verify_evidence_index.py` が `stale` を返したら、**その id を名指しで**再検算する。
   一括で更新する手段は用意していない。まとめて直せると、置換した覚えのない証跡まで
   「現在の中身で正しい」と署名され、いつ何が変わったのかが読めなくなるためである。

   ```bash
   python3 scripts/reference-site-analysis/verify_evidence_index.py --refresh <entry-id>
   ```

   stale でない id を渡すと拒まれる。中身が変わっていないのに `captured_at` だけが
   進むと、この列が「証跡を取った時刻」を意味しなくなるからである。

## 失敗時

- HTTP/XML失敗: 旧成果物を保持し、日時・URL・statusだけを運用記録へ残して再試行する。アクセス制御を回避しない。
- 未分類: `classify` とページ種別文書を同じ変更で更新し、fixtureを先にREDにする。
- 大幅な件数減: 削除と一時障害を区別できるまで採用しない。
- 著作物混入: 出力を破棄する。保存対象はURLメタデータとdigestだけである。
