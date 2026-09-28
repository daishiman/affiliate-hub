# 門 (決定論ゲート) の変更記録

門を直したときは必ずここに残す。**門が緩んだのか、誤検出を直したのかを、後の監査が
自分で確かめられるようにするため。**「これは誤検出だから問題ない」という手の説明は
正本に残らないので、次の監査でまた同じ件が上がる。

---

## 2026-09-04 `--require-grounded-design-applications` に後継の鎖を通す

**対象**: `scripts/validate-coverage-matrix.py` の `_validate_grounded_design_applications`

**現物の宛先 (2 か所ある)**:

| # | path | git | 役割 |
|---|---|---|---|
| 1 | `.claude/plugins/system-spec-harness/scripts/validate-coverage-matrix.py` | 追跡あり | repo が抱える vendored コピー。**修正の正本はこちら。** |
| 2 | `/Users/dm/.claude/plugins/cache/harness-hub/system-spec-harness/0.1.0/scripts/validate-coverage-matrix.py` | 追跡なし | installed cache。runtime が読む実体。plugin の入れ直しで消える。 |

> **2026-09-04 訂正。**この節は当初「この修正は repo の中に無い」と書いていたが、
> **誤りだった。**当時見ていた repo 側正本は `marketplaces/local` の
> `system-spec-harness@0.1.11` (このリポジトリの外) で、たしかにそちらには
> `--require-grounded-design-applications` が無い。しかし**このリポジトリ自身が
> vendored コピー (#1) を git 追跡で抱えており**、そちらは 6 フラグをすべて持つ。
> よって修正は repo に残せるし、現に残っている。マトリクス監査 (R7) がこの
> 食い違いを指摘して判明した。
>
> #1 と #2 は**別実装**である (#1 は `_retired_into_a_cited_successor`、
> #2 は `grounded_via_successors`)。判定は等価だが説明文が違う。乖離を人の目に
> 頼らないため、`gate-tests/test-grounded-design-applications.py` は**在る実装を
> 全部**同じ 6 形にかけ、1 つでも落ちたら全体を落とす。2026-09-04 実測で
> 2 実装 × 6 形 = 12 件すべて PASS。
>
> **plugin を更新すると #2 は消える。**そのときは #1 から当て直すこと。

### 何が起きていたか

2026-09-04 時点で、`design_applications` を持つのにどの確定セルからも引かれていない
質疑が 16 件あり、この検査だけが FAIL していた (他の 5 フラグと出典系 2 検査は exit 0)。

16 件すべてが**後継を申告済みの旧版**で、後継の鎖をたどると必ずセルから引かれている
現行版に着く。例:

```
qa-decision-aio-policy-v4 -> qa-neutral-aio-policy-v6 -> qa-neutral-aio-policy-v7
                                                          (frontend×web / backend×web から引かれている)
```

これらは今回のセッションで質疑を中立な提示へ問い直した過程 (v4 -> v4b -> v5 -> v6 -> v7)
で生まれたもので、HEAD 時点では 0 件だった。

### なぜ検査の側を直したか

兄弟の検査 `_validate_declared_qa_supersession` は同じ状態について、自らの docstring で
こう書いている:

> **孤立そのものを禁じない。**質疑を作り直せば古い方は引かれなくなる。それは正しい経過である。

さらに同じ docstring は「セルだけを見る検査が、正本の記録を見落として欠陥を捏造していた」
という 2026-08-25 の実測を戒めている。ところが `_validate_grounded_design_applications` は
セルの `qa_ref` / `qa_refs` しか見ず、後継申告を一切考慮しなかった。**2 つの検査が同じ正本に
相反する判定を出していた。**

データ側で直す手は無い:

- 旧版を `qa_refs` へ足し戻す → 「置き換えたのに現行の裏付けとして引いている」という嘘を正本に書く
- 旧版から `design_applications` を剥がす → そのような writer op が存在しない
  (`supersede-qa` は `--qa-id --by` のみ)

### 何を変えたか

接地判定に後継の鎖を足した。**鎖の末端がセルから引かれている場合だけ接地済みとみなす。**

### 逃がし口になっていないことの確認

合成入力 6 形で、通す形 2 と落とす形 4 を確かめた
(`system-spec/gate-tests/test-grounded-design-applications.py`。上表の 2 実装ともに
同じ 6 形をかけ、12 件すべて期待どおり):

| 形 | 期待 | 結果 |
|---|---|---|
| 後継の鎖が引かれている版に着く | 通す | 0 件 |
| 後継の申告が無い純粋な孤立 | 落とす | 1 件 |
| 後継が qa_log に不在 (実在しない後継への逃がし) | 落とす | 1 件 |
| 鎖はつながるが末端がどのセルからも引かれない | 落とす | 2 件 |
| 後継が循環している (無限ループの口) | 落とす | 2 件 |
| `design_applications` を持たない entry | 対象外 | 0 件 |

### 変更後の門の状態

```
validate-coverage-matrix.py 6 フラグ全付け        exit 0
validate-knowledge-graph.py --profile required-info status ok (下記参照)
validate-evidence-transcription.py                  exit 0 (22 件)
validate-source-citation.py                         exit 0
```

---

## 2026-09-04 `coverage_certificate.blocking_items` の読み方 (門の変更ではない)

門は直していない。**読み違えが繰り返されるので、意味をここへ固定する。**

`run-system-spec-elicit` の完了条件は「`coverage_certificate.blocking_items` が空」と
書いている。**この字面を追ってはいけない。空にならない。**

`validate-knowledge-graph.py --profile required-info` は `--input <catalog>` しか
受け取らず、プロジェクトの正本 (`spec-state.json`) を一度も読まない。`blocking_items` は
`missing_effect == "block"` と**カタログ自身が宣言している** item を集めただけの一覧である
(`validate-knowledge-graph.py:281`)。つまり**カタログの性質**であって、収集の残りではない。
2026-09-04 実測で 6 件 (`auth-model` / `domain-model` / `product-goal` /
`screen-information-priority` / `security-posture` / `target-platforms`) が並ぶが、
これは正常な状態である。

見るべきは `status` が `ok` であることと、**充足の照合は別の門がやっている**という事実:

```
validate-coverage-matrix.py --require-counted-required-info   ← C16 充足照合の本体
```

必須情報が確定セルへ接地しているかを正本と突き合わせるのはこちらで、2026-09-04 時点で
exit 0。`blocking_items` の非空を FAIL と読むと、達成不能な条件を追い続けることになる。
