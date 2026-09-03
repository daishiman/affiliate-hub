# P04 test design

| ID | req | layer | scenario / expected |
|---|---|---|---|
| AN-001 | A1 | unit+acceptance | 14 part、1073 membership、1072 canonical、duplicate 1 |
| AN-002 | A2 | unit | screen classification/canonical/dedup fixture、unknown 0 |
| AN-003 | A3 | contract | screen inventory IDとA3 traceの集合一致 |
| NC-001 | A4 | static gate | reference body/image/logo/color/theme asset 0 |
| CR-001 | A5 | component+E2E | template→必須入力→下書きの主CTA 1、validationで入力保持 |
| SV-001 | A6 | domain+component | unsaved/saving/saved/failed/conflictの文言とlive status |
| SV-002 | A6 | DB integration | revision N だけがN+1へ書け、stale NはCONFLICTで本文無変更 |
| SV-003 | A6 | component+E2E | 600ms端末draft、reload復元告知、破棄、server保存後clear |
| IM-001 | A7 | unit+component | severity/location/before/after/rationaleをpreview→apply→undo |
| AF-001 | A8 | unit | JSON-LD→OG→metaの優先と9項目、不明はnull |
| AF-002 | A8 | security | private/loop/link-local/metadata/IPv4-mapped/mixed/DNS0/DNS failure/oversize/redirect loopをfail-closed |
| AF-003 | A8 | security | default-deny、deny priority、allowlisted provider、短縮/redirect先再判定 |
| AF-004 | A8 | component | imageDisplayAllowed+imageHosts+HTTPSの時だけremote image、他はDiagramFallback |
| AF-005 | A8 | application | same original/canonical/productをduplicateと表示し、previewは永続化しない |
| PL-001 | A9 | DB integration | workspace AからBのplacement 0、1 link:N placement、legacy null link保持 |
| PL-002 | A9 | component+E2E | state/provider/checked/count/attention filter、1操作でsite/page/block |
| PF-001 | A9/A11 | E2E performance | warm preview の成果リンク一覧で TTFB 2.5秒未満、DOMContentLoaded 6秒未満、load 8秒未満、同一document転送量2.5MB未満 |
| US-001 | A10 | moderated protocol | create/improve/save/placement特定各完了90%以上、重大誤操作0 |
| AX-001 | A11 | axe+E2E | public/admin critical/serious 0、keyboard only、200% zoom、375/768/1280/1600 |
| TR-001 | A12 | contract | A1–A12のscreen/data/evidence非空、screenはinventoryの部分集合 |

空、loading、partial、failure、permission denied、long text、mobile、double-submitを各主flowの境界に追加する。test dataは `tests/fixtures/reference-blog-admin-ux/` の決定的fixtureを使い、live外部siteをunit/E2Eの成否に使わない。
