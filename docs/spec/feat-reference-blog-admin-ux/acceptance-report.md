# P07 feature受入レポート

- 実施日: 2026-08-30 JST
- 判定: **停止 / BLOCKED**
- 停止理由: A10の初見参加者10名によるmoderated usability testが未実施

## A1–A12

| ID | expected | actual | evidence | verdict |
|---|---|---|---|---|
| A1 | 14 sitemap、1,072 canonical URL | 14 part、membership 1,073、重複1、canonical 1,072 | `sitemap-snapshot.json`、`reference-url-inventory.json`、analysis test | PASS |
| A2 | 全URL分類、未分類0 | inventoryの1,072件をarchetypeへ分類、unknown 0 | `page-archetype-analysis.md`、analysis test | PASS |
| A3 | 公開面・管理面の詳細画面表 | desktop/mobile、位置、状態、主操作、data、acceptanceをscreen IDで対応 | `screen-inventory.md`、A3 trace test | PASS |
| A4 | 本文・写真・logo・固有色の転用0 | collectorはmetadata/digestのみ保持、構造検査83filesで違反0、独自tokenと図解fallbackを採用 | `non-copying-design-system.md`、`design-review.md`、`pnpm check:reference-reuse` | PASS |
| A5 | 必須だけで下書き開始、主導線1本 | 記事編集を1 primary actionとprogressive disclosureで実装 | component tests、feature E2E | PASS |
| A6 | 保存5状態、入力保持、競合復元 | unsaved/saving/saved/failed/conflict、600ms draft、CAS revisionを実装 | save state/draft tests、D1 integration、feature E2E | PASS |
| A7 | 改善を1件ずつpreview/apply/undo | severity/location/before/after/rationaleを表示し適用・取消可能 | improvement tests、feature E2E | PASS |
| A8 | URL preview 9項目、失敗理由、重複、図解 | default-deny SSRF、metadata優先順位、rights gate、diagram fallbackを実装 | focused security 26/26、preview component/E2E | PASS |
| A9 | filterと1操作のplacement逆引き | 状態・提携先・最終確認・掲載数を表示しsite/page/blockを展開 | D1 tests、feature E2E | PASS |
| A10 | 初見10名で各成功9名以上、重大誤操作0 | 参加者0名。自動テストで代用していない | `usability-report.md` | **BLOCKED** |
| A11 | axe重大0、keyboard、200%、色のみ依存0 | focused axe 11/11、desktop/mobile keyboard、desktop 200%相当、375px全flow、768px/1600pxのpublic/adminをPASS | P06/P09 report、feature E2E | PASS |
| A12 | gapと受入を同じIDでtrace | A1–A12のscreen/data/evidenceが非空、screen IDはinventory内 | `acceptance-traceability.json`、analysis test | PASS |

## 停止境界

A10以外の自動・画面受入はPASSした。P07の完了条件はA1–A12全件PASSかつ実参加者の成功率証明なので、総合判定をPASSへ繰り上げない。`usability-test-protocol.md` に従い10名分を実施し、匿名participant ID、操作、所要時間、助言、誤操作を記録した後に再判定する。
