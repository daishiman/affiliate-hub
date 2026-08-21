"""確定セルへ required-info の充足状態を物質化し、未接地の block item での確定を writer で拒否する。

C16 の block ゲートは、これまで R5 の prose ゲートと C05 の事後監査だけが担っていた。
prose ゲートは読む人が読み飛ばせば素通りし、事後監査は**既に確定した後**にしか鳴らない。
確定は writer でしか起きないので、確定を止められる場所は writer だけである。

**block item の一覧をここで再導出しない。** `missing_effect == "block"` の判定は
validate-knowledge-graph.py (C14) が既に持っている。同じ判定を 2 箇所へ書くと、
片方だけが直された日に writer が黙って緩む。coverage certificate の `blocking_items`
をそのまま使う。この一覧は**未解決一覧ではなく、収集必須 item ID 一覧**である
(空であることを期待する欄ではない)。

記録する `status` は 3 値ある。`grounded` と `not_applicable` だけが確定を許し、
`ungrounded` は確定を許さない。3 値目が要るのは、**ゲートが無かった時代に確定した
セル**が現に在るからで、そこへ `grounded` を書けば嘘になり、書かなければ欠けが
記録に残らない。負債として書ける形を用意して、後から数えられるようにする。
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from state_transition_common import TransitionError, has_entry

CATALOG_PATH = Path(__file__).resolve().parent.parent / "references" / "required-info-catalog.json"
VALIDATOR_PATH = Path(__file__).resolve().parents[3] / "scripts" / "validate-knowledge-graph.py"

# grounded=利用者根拠へ接地済み / not_applicable=理由付き対象外 / ungrounded=未接地の負債
ENTRY_STATES = ("grounded", "not_applicable", "ungrounded")


def _load_validator():
    """ハイフン名の C14 を in-process で読む。読めなければ writer を止める。"""
    spec = importlib.util.spec_from_file_location("_vkg_for_spec_writer", VALIDATOR_PATH)
    if spec is None or spec.loader is None:
        raise TransitionError(f"validate-knowledge-graph.py を読み込めない: {VALIDATOR_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_blocking_catalog(catalog_path: str | Path | None = None) -> dict:
    """block item を id→item で返す。カタログが不正なら判定できないので writer を止める。"""
    path = Path(catalog_path) if catalog_path else CATALOG_PATH
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise TransitionError(f"required-info カタログを読めない: {path} ({exc})") from exc
    except json.JSONDecodeError as exc:
        raise TransitionError(f"required-info カタログが JSON として壊れている: {path} ({exc})") from exc
    findings, result = _load_validator().validate_required_info(data)
    if findings:
        raise TransitionError(
            "required-info カタログが不正で block ゲートを判定できない: " + "; ".join(findings[:3])
        )
    by_id = {item["item_id"]: item for item in data["items"]}
    blocking_ids = result["coverage_certificate"]["blocking_items"]
    na_approved = {
        entry["domain"]
        for entry in data.get("na_domains", []) or []
        if isinstance(entry, dict) and entry.get("approval_state") == "approved"
    }
    return {
        "blocking": {iid: by_id[iid] for iid in blocking_ids},
        "na_approved_domains": na_approved,
    }


def blocking_items_for_category(
    state: dict, category: str, catalog_path: str | Path | None = None
) -> list[dict]:
    """当該 category に掛かる block item を返す。"""
    catalog = load_blocking_catalog(catalog_path)
    return [item for item in catalog["blocking"].values() if item["domain"] == category]


def unhostable_blocking_domains(state: dict, catalog_path: str | Path | None = None) -> list[str]:
    """block item の domain のうち、この state の category 軸に居場所が無いものを返す。

    **これは writer の拒否条件ではない。塞げていない穴を数えられる形にしたものである。**
    domain が category 軸に無い block item は、どのセルの確定条件にもならない。
    誰にも要求されないまま仕様が完成しうる。

    writer で拒否しないのは、拒否の正しさを writer が判断できないからである。
    カタログの `in_scope_domains` は plugin 所有の固定資産で 9 domain を宣言するが、
    taxonomy は project 所有で、認証の無いシステムが `auth` を持たないのは正当である。
    「project 単位で required-info の domain を対象外と宣言する経路」が現状どこにも無く、
    それを writer の拒否として発明すると、正当な taxonomy を writer が拒むことになる。

    したがってここでは数えるだけにし、判断は C05 (完全性評価) と R5 収集ゲートへ渡す。
    **反転条件**: project 単位の required-info N/A 経路ができた日に、この関数の戻り値が
    非空であることを writer の拒否条件へ格上げすること。それまでは、非空になった事実が
    検査で見えることだけを保証する。
    """
    catalog = load_blocking_catalog(catalog_path)
    known = {item.get("id") for item in state.get("categories", []) if isinstance(item, dict)}
    return sorted(
        {
            item["domain"]
            for item in catalog["blocking"].values()
            if item["domain"] not in known and item["domain"] not in catalog["na_approved_domains"]
        }
    )


def normalize_required_info(
    state: dict,
    category: str,
    raw: object,
    *,
    allow_ungrounded: bool,
    catalog_path: str | Path | None = None,
) -> list[dict]:
    """block item の充足状態を検証して正規化する。`missing_effect` は呼び出し側から受け取らない。

    `missing_effect` を引数で受けると、呼び出し側が `block` を `warn` と名乗って
    ゲートを外せる。カタログの値だけを書き込むので、物質化された値は必ずカタログと一致する。
    """
    required = {item["item_id"]: item for item in blocking_items_for_category(state, category, catalog_path)}
    if raw is None:
        raw = []
    if not isinstance(raw, list):
        raise TransitionError(f"required_info は配列必須: {category} ({raw!r})")

    normalized: list[dict] = []
    seen: set[str] = set()
    for index, entry in enumerate(raw):
        label = f"required_info[{index}]"
        if not isinstance(entry, dict):
            raise TransitionError(f"{label} は object 必須")
        item_id = entry.get("item_id")
        if item_id not in required:
            raise TransitionError(
                f"{label}: item_id={item_id!r} は {category} の missing_effect=block item ではない "
                f"(対象: {sorted(required)})"
            )
        if item_id in seen:
            raise TransitionError(f"{label}: item_id={item_id!r} が重複")
        seen.add(item_id)
        item = required[item_id]
        status = entry.get("status")
        if status not in ENTRY_STATES:
            raise TransitionError(f"{label}: status={status!r} は {list(ENTRY_STATES)} 必須")
        record = {"item_id": item_id, "missing_effect": item["missing_effect"], "status": status}
        if status == "grounded":
            ref = entry.get("grounded_by")
            if not isinstance(ref, str) or not ref.strip():
                raise TransitionError(f"{label}: status=grounded には非空 grounded_by が必須")
            ref = ref.strip()
            if not has_entry(state.get("qa_log", []), ref):
                raise TransitionError(f"{label}: qa_log に存在しない grounded_by: {ref}")
            record["grounded_by"] = ref
        else:
            reason = entry.get("reason")
            if not isinstance(reason, str) or not reason.strip():
                raise TransitionError(f"{label}: status={status} には非空 reason が必須")
            record["reason"] = reason.strip()
            if status == "not_applicable" and item.get("required_when") == "always":
                raise TransitionError(
                    f"{label}: {item_id} は required_when=always なので理由付き N/A にできない"
                )
            if status == "ungrounded" and not allow_ungrounded:
                raise TransitionError(
                    f"{label}: {item_id} は missing_effect=block で未接地のまま確定できない。"
                    "R5 収集ゲートで利用者根拠へ接地させてから confirm すること"
                )
        normalized.append(record)

    missing = sorted(set(required) - seen)
    if missing:
        raise TransitionError(f"{category}: block item の充足状態が欠けている: {missing}")
    return sorted(normalized, key=lambda record: record["item_id"])
