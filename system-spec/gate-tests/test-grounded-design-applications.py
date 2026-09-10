"""直した検査が、通すべきものだけ通すかを合成入力で確かめる。

門を緩めたのではないことを示すのが目的なので、**落ちてほしい形を先に並べる。**

同じ門の実装が 2 か所にある (repo が抱える vendored コピーと、runtime が読む
installed cache)。**片方だけを試すと、乖離しても誰も気づかない。**よって在る
ものは全部同じ 6 形にかけ、1 つでも落ちたら全体を落とす。
"""
import importlib.util
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]

# 正本を先に置く。repo の中に在り git が追うのはこちらで、cache は入れ直しで消える。
IMPLS = [
    (
        "repo vendored (git 追跡)",
        REPO / ".claude/plugins/system-spec-harness/scripts/validate-coverage-matrix.py",
    ),
    (
        "installed cache harness-hub@0.1.0 (runtime)",
        pathlib.Path(
            "/Users/dm/.claude/plugins/cache/harness-hub/system-spec-harness/0.1.0/"
            "scripts/validate-coverage-matrix.py"
        ),
    ),
]

DA = [{"principle": "x"}]


def state(qa_log, cited_id=None):
    cell = {"state": "確定", "qa_ref": cited_id} if cited_id else {"state": "未収集"}
    return {"matrix": {"frontend": {"web": cell}}, "qa_log": qa_log}


cases = [
    (
        "後継の鎖が引かれている版に着く (通ってほしい)",
        state(
            [
                {"id": "v4", "design_applications": DA, "superseded_by": "v5"},
                {"id": "v5", "design_applications": DA, "superseded_by": "v6"},
                {"id": "v6", "design_applications": DA},
            ],
            cited_id="v6",
        ),
        0,
    ),
    (
        "後継の申告が無い純粋な孤立 (落ちてほしい)",
        state([{"id": "orphan", "design_applications": DA}], cited_id="other"),
        1,
    ),
    (
        "後継が qa_log に不在 (落ちてほしい)",
        state(
            [{"id": "v4", "design_applications": DA, "superseded_by": "ghost"}],
            cited_id="other",
        ),
        1,
    ),
    (
        "鎖はつながるが末端がどのセルからも引かれていない (落ちてほしい)",
        state(
            [
                {"id": "v4", "design_applications": DA, "superseded_by": "v5"},
                {"id": "v5", "design_applications": DA},
            ],
            cited_id="unrelated",
        ),
        2,
    ),
    (
        "後継が循環している (落ちてほしい・無限に回らない)",
        state(
            [
                {"id": "a", "design_applications": DA, "superseded_by": "b"},
                {"id": "b", "design_applications": DA, "superseded_by": "a"},
            ],
            cited_id="other",
        ),
        2,
    ),
    (
        "design_applications を持たない entry は対象外 (通ってほしい)",
        state([{"id": "u1"}], cited_id="other"),
        0,
    ),
]


def load(path):
    spec = importlib.util.spec_from_file_location("vcm", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod._validate_grounded_design_applications


ok = True
seen = 0
for label, path in IMPLS:
    if not path.exists():
        # 在るものだけを試す。cache は plugin の入れ直しで消えるため不在は異常でない。
        print(f"== {label}: 不在のため試験対象外 ({path})")
        continue
    seen += 1
    print(f"== {label}: {path}")
    check = load(path)
    for title, data, expected in cases:
        got = check(data)
        verdict = "PASS" if len(got) == expected else "FAIL"
        ok &= verdict == "PASS"
        print(f"  [{verdict}] {title}: 期待 {expected} 件 / 実際 {len(got)} 件")
        for f in got:
            print(f"          {f}")

if seen == 0:
    print("FAIL: 門の実装が 1 つも見つからない。試験になっていない。")
    ok = False

raise SystemExit(0 if ok else 1)
