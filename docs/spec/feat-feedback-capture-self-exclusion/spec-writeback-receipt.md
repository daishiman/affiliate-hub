# 仕様反映の受領書 — dev 取り込み後の再確定

**phase**: P11 / SYS-FB-CAPTURE-EXCLUSION-P11
**日付**: 2026-08-30

## 判断

**仕様・設計への影響は「ある」。** よって `system-spec/` へ正規フローで反映した。
影響の中身は 2 つで、性質が違う。

1. **本変更が持ち込んだ確定質疑** — `qa-frontend-web-capture-self-occlusion`。
   「写しを撮る UI 自身を写しから外す」という判断は、実装の都合ではなく
   frontend×web セルの要求判断そのものなので、収集マトリクスに残す必要がある。
2. **dev 取り込みで起きた同一セルの二重確定** — dev 側は
   `qa-frontend-web-affiliate-link-preview-v3` で同じ `frontend.web` セルを確定させていた。
   マージ結果を手で書けば `spec-state.json` の単一 writer 契約を破るため、書かなかった。

## 反映の経路（手で書いた箇所は無い）

| 対象 | 経路 | 備考 |
|---|---|---|
| `system-spec/spec-state.json` | `apply-spec-transition.py chunk --state --turns` | `reopen`（理由付き）→ `confirm`（`qa_refs` 8 件・`serves_goals: [G1, G2]`） |
| `system-spec/frontend.md` | `compile-spec-doc.py compile --only frontend` | 3 回。1 回目は手書き節の検出で中止、2 回目 `--on-handwritten preserve`、3 回目 `--acknowledge-prior-residue` で残渣を解消 |
| `system-spec/index.md` | 同上 | 集約状態を真理値表から再導出 |
| `.dev-graph/state/graph.json` | `upsert-node.py`（feature node）／`build-merged-graph.py`（13 phase node） | 下記「graph の戻し」参照 |
| `features/feat-feedback-capture-self-exclusion.md` | `upsert-node.py` の投影 | `source_lineage.source_digest` を現行 `frontend.md` に合わせた |

`確定` セルを直接書き換える経路は writer が拒否する。動かせるのは `reopen`（要 reason）だけで、
今回もその 1 経路だけを通した。

### 残渣の中身を確認したこと

`--acknowledge-prior-residue` で消えた「compile が保てなかった行」は 5 行で、
いずれも **後続の質疑に置き換わった旧見出し**と、**版が上がった nextjs の出典行**だった。
現に意味を持つ記述は 1 行も落ちていない。消したから安全、ではなく、中身を見て安全と言っている。

### graph の戻し

dev の取り込み時に `graph.json` の行ベース衝突を dev 側優先で解いた結果、
`SYS-FB-CAPTURE-EXCLUSION-P01..P13` が graph から落ちていた。
`upsert-node.py` は 1 node ずつしか書けず、feature は P01..P13 を 1 組で持つ不変則
(`feature_package_not_exact_13`) があるため、1 個ずつ戻す道は原理的に塞がっている。
正規経路である `build-merged-graph.py`（`graph_node_id` をキーにした構造 3-way マージ）で戻し、
`.gitattributes` に `merge=devgraph-json` を宣言して同じ取り違えが再発しないようにした。

sentinel は 2 件で、どちらも根拠を明示して解いた。

| node | 衝突 | 採った側 | 理由 |
|---|---|---|---|
| `feat-improvement-feedback` | `closed_at` / `completion_evidence` / `updated_at` | theirs | `acceptance:reconcile` 後の done 状態が新しい真値 |
| `feat-feedback-capture-self-exclusion` | `source_lineage.source_digest` | ours | dev 取り込み後の現行 `frontend.md` の digest |

## 検証（MVP のため最小）

| gate | 結果 |
|---|---|
| `validate-coverage-matrix.py --require-complete --require-foundation` | exit 0 |
| `validate-graph-schema.py --require-canonical-envelope` | `valid: true` / violations 0 / readiness complete |
| `pnpm run typecheck` | 0 |
| `pnpm run lint` | 0 |
| `pnpm vitest run`（本 feature の 2 ファイル） | 37 passed |
| `pnpm run acceptance:reconcile` | PASS（10 IDs / 198 evidence files） |
| `node scripts/traceability.mjs` | 由来不明 0（上限 2） |

## 反映していないこと（意図的）

- **completeness evaluator は再実行していない。** dev 側の
  `system-spec/completeness-report.json` と `resume-receipt.json` をそのまま採った。
  再実行には監査 fork を伴い、MVP の検証範囲を超える。**再確定したセルの評価は未更新**である。
- **A1 は PARTIAL のまま。** capture 出力の実画素は観測できていない
  （ローカル実 probe は OS 境界で `NotReadableError`）。
- **P13 は open のまま。** commit / PR / CI / merge の後にだけ閉じる外部ライフサイクルで、
  ローカル検証の完了と混同しない。
