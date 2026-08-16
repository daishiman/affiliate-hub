# C16 schedule graph 契約

## 目的と責務

C16 `schedule-graph.py` は C28 が生成した Beads ready payload と canonical graph、
C27 lease snapshot を読み、実行候補と除外理由を報告する read-only（読み取り専用）
コンポーネントである。C28 の payload 投影・Beads mutation・parity manifest の生成規則は
`execution-tracker-contract.md` を正本とし、本書は C16 固有の分類と候補被覆だけを所有する。

## C16 が出す unmapped reason

| reason | source | 意味と復旧 |
|---|---|---|
| `not_an_object` / `missing_external_ref` | `schedule-graph` | ready payload item の形状が不正。C28 payload 生成元を修復して再実行する。 |
| `dependency_unsatisfied` | `schedule-graph` | selected/schedulable node の未完了依存。`blocking_depends_on` の上流を完了する。 |
| `beads_parity_stale_or_unconfirmed` | `schedule-graph` | entry はあるが edge parity、status、dependency 集合が一致しない。C03/C28 同期後に再実行する。 |
| `ready_payload_entry_absent` | `schedule-graph` | schedulable Beads node の payload entry が無い。C03/C28 の正規同期、linkage 修復、fresh parity manifest 後に再実行する。ready set へ推測追加してはならない。 |
| `graph_node_missing` | `schedule-graph` | payload が指す canonical graph 外の node。C02 で復元するか、失効済みなら C28 close を行う。 |

## 判定順序と安全境界

- selected かつ schedulable な node は、まず dependency を評価する。未充足なら
  `dependency_unsatisfied` を 1 件だけ記録し、payload entry/parity 判定へ進まない。
- 依存を満たす `tracker_binding=beads` node は、entry が無ければ
  `ready_payload_entry_absent`、entry はあるが parity が未確認なら
  `beads_parity_stale_or_unconfirmed` とする。
- `graph_depends_on` と graph の `depends_on` は集合比較であり、配列順だけで stale 判定しては
  ならない。P01 parent や dependency 形状が不正なら candidate を黙って落とさず
  fail-closed（安全側に停止）とする。
- pre-lease の候補被覆は `ready_set ∪ unmapped`、active lease/resource conflict を含む
  最終 report の被覆は `ready_set ∪ unmapped ∪ conflicts` とする。lease conflict は
  unmapped reason と混同しない。

## 仕様境界

この契約は Harness Hub 製品の API、DB schema、認証認可、UI、Cloudflare deploy unit、
および `bd ready` の選定規則を変更しない。開発管理パイプラインで、候補が理由なしに
消えないことだけを保証する。
