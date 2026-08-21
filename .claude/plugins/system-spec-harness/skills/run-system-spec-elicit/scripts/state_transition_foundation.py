"""Foundation and decision transitions for the spec-state single writer."""
from __future__ import annotations

import datetime
import hashlib
from pathlib import Path

from foundation_provenance import (
    validate_foundation_scope_coverage,
    validate_foundation_source_indexes,
    validate_foundation_source_records,
    validate_foundation_unsourced_cap,
)
from state_transition_common import (
    DECISION_COMPARISON_AXES,
    DECISION_COST_CATEGORIES,
    DECISION_OPTION_FIELDS,
    DECISION_STATUSES,
    FOUNDATION_KEYS,
    TransitionError,
    foundation_goal_ids,
    foundation_missing_fields,
    has_entry,
    is_explicit_na,
    is_https_url,
    is_rfc3339,
    normalize_serves,
    reject_self_declared_provenance,
    require_nonempty,
    require_nonempty_string_list,
)

# set-qa-scope-notes / set-qa-written-up と同じ流儀。writer が自分の名前を打刻する。
DECISION_WRITER = "set-decision"

FOUNDATION_SEAL_WRITER = "seal-foundation-sources"
# `field_sources` の 1 件について、**呼び出し側が名乗れない欄**。
# writer が実ファイルを読んで打刻する。set-qa-written-up の
# 「sha256 は呼び出し側から受け取らない」と同じ理由 — 受け取ると、
# 読んでいない文書の指紋を名乗れる。
FOUNDATION_SEALED_FIELDS = ("sha256", "sealed_on", "sealed_with")


def _reject_sealed_claims(foundation: dict) -> None:
    """`set-foundation` の引数に、封の欄が混ざっていないか。

    黙って捨てない。捨てると「名乗ろうとした事実」まで消える
    (`reject_self_declared_provenance` と同じ流儀)。
    """
    provenance = foundation.get("provenance")
    if not isinstance(provenance, dict):
        return
    for index, record in enumerate(provenance.get("field_sources") or []):
        if not isinstance(record, dict):
            continue
        declared = [field for field in FOUNDATION_SEALED_FIELDS if field in record]
        if declared:
            raise TransitionError(
                f"set-foundation: field_sources[{index}] の {declared} は "
                f"{FOUNDATION_SEAL_WRITER} が実ファイルを読んで打刻する欄で、"
                "呼び出し側からは渡せない (指紋を自己申告させない)"
            )


def seal_foundation_sources(state: dict) -> dict:
    """**`field_sources` の書面根拠を、実ファイルへ照合してから封をする。**

    `set-foundation` は foundation を丸ごと引数で受け取るので、`path` と `quote` は
    **呼び出し側が名乗る内容**である。名乗りのままでは「その文書のその節にそう書いて
    あった」ことを誰も確かめていない。ここが確かめる側になる。

    `set-qa-written-up` は同じ形の writer だが、doc comment が自ら
    「**その節に本当にこの問答の内容が書かれているかは機械層で確かめられない**」と
    書いている。あちらは `quote` を持たないからである。**こちらは持つので、
    その穴を塞げる** — 引用が本文に literal で在ることを確かめてからでないと封をしない。

    **sha256 は引数で受け取らない。**writer が `path` のファイルを読んで計算する。
    日付も writer が付ける。

    ── 指紋が食い違ったときに取り直さない理由 ──────────────────────

    既に封が在って指紋が違うなら、**文書がその後に動いた**ということである。ここで
    黙って取り直すと、指紋は「文書が動いていないこと」を何も示さなくなる——封をする
    たびに現在値へ合わせるだけの欄になる。だから拒否して、呼び出し側に
    「引用がまだ正しいか」を見直させる。取り直す正規の道は `set-foundation` で
    provenance を書き直す (封は引数で渡せないので必ず外れる) → 封をし直す、である。

    ── 塞げていないところ ────────────────────────────────

    引用が本文に在ることは確かめられるが、**その引用がその欄の根拠として妥当か**は
    機械では決まらない。文書のどこかに在る一文を、無関係な欄の出典として貼れる。
    ここは `quote` の長さでも位置でも縛れない。

    **⑤ 反転先**: 欄と引用の対応を機械で判定できるようになった日 (例: 欄ごとに
    節番号を要求する)、この doc comment の「塞げていない」記述を消さず、
    「対応が取れていない出典は封をされない」という検査へ反転させる。
    """
    foundation = state.get("requirements_foundation")
    if not isinstance(foundation, dict) or not foundation:
        raise TransitionError(
            f"{FOUNDATION_SEAL_WRITER}: requirements_foundation が無い (先に set-foundation)"
        )
    provenance = foundation.get("provenance")
    if not isinstance(provenance, dict):
        raise TransitionError(f"{FOUNDATION_SEAL_WRITER}: provenance が object でない")
    records = provenance.get("field_sources")
    if not isinstance(records, list) or not records:
        raise TransitionError(
            f"{FOUNDATION_SEAL_WRITER}: provenance.field_sources が非空配列でない"
        )
    known_qa = {
        entry.get("id") for entry in state.get("qa_log") or [] if isinstance(entry, dict)
    }
    today = datetime.date.today().isoformat()
    sealed = 0
    dialogue = 0
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise TransitionError(
                f"{FOUNDATION_SEAL_WRITER}: field_sources[{index}] が object でない"
            )
        label = f"field_sources[{index}] ({record.get('field')!r})"
        kind = record.get("kind")
        if kind == "user-dialogue":
            # 文書ではなく対話が出所。指紋を取る相手が無いので封はしない。
            # 代わりに、指している qa entry が実在することだけを確かめる。
            qa_id = record.get("qa_id")
            if qa_id not in known_qa:
                raise TransitionError(
                    f"{FOUNDATION_SEAL_WRITER}: {label} の qa_id={qa_id!r} が qa_log に不在"
                )
            dialogue += 1
            continue
        if kind != "written-requirements":
            raise TransitionError(
                f"{FOUNDATION_SEAL_WRITER}: {label} の kind={kind!r} が許容値外"
            )
        path = record.get("path")
        quote = record.get("quote")
        if not isinstance(path, str) or not path.strip():
            raise TransitionError(f"{FOUNDATION_SEAL_WRITER}: {label} の path が非空文字列でない")
        if not isinstance(quote, str) or not quote.strip():
            raise TransitionError(f"{FOUNDATION_SEAL_WRITER}: {label} の quote が非空文字列でない")
        target = Path(path.strip())
        if not target.is_file():
            raise TransitionError(
                f"{FOUNDATION_SEAL_WRITER}: {label} の出典文書が実在しない: {path}"
            )
        text = target.read_text(encoding="utf-8")
        if quote not in text:
            raise TransitionError(
                f"{FOUNDATION_SEAL_WRITER}: {label} の引用が {path} の本文に見つからない "
                "(名乗りを封にしない)"
            )
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        previous = record.get("sha256")
        if previous == digest:
            sealed += 1  # 冪等。同じ内容の封は数え直すだけで書き換えない
            continue
        if previous is not None:
            raise TransitionError(
                f"{FOUNDATION_SEAL_WRITER}: {label} は既に別の指紋で封をされている "
                f"(封 {previous[:16]}… / 現在 {digest[:16]}…)。文書が動いています。"
                " 引用がまだ正しいかを見直し、set-foundation で provenance を"
                " 書き直してから封をし直してください"
            )
        record["sha256"] = digest
        record["sealed_on"] = today
        record["sealed_with"] = FOUNDATION_SEAL_WRITER
        sealed += 1
    return {"sealed": sealed, "dialogue": dialogue, "total": len(records)}


def set_foundation(state: dict, foundation: dict) -> None:
    """Merge and confirm U1--U9 only after source, value, and approval gates pass."""
    if not isinstance(foundation, dict):
        raise TransitionError(f"requirements_foundation は object でない: {foundation!r}")
    # 封の欄は seal-foundation-sources が実ファイルから打刻する。引数で持ち込ませない。
    _reject_sealed_claims(foundation)
    foundation = dict(foundation)
    approval_note = foundation.pop("approval_note", None)
    approval_ref = foundation.get("approval_ref")
    if approval_ref and approval_note is not None:
        approvals = state.setdefault("approval_log", [])
        if not has_entry(approvals, approval_ref):
            approvals.append({"id": approval_ref, "note": approval_note})
    merged = dict(state.get("requirements_foundation") or {})
    for key, value in foundation.items():
        if key not in FOUNDATION_KEYS:
            raise TransitionError(f"requirements_foundation の未知キー: {key!r}")
        merged[key] = value
    scope = merged.get("scope")
    if scope is None:
        scope = {"in": [], "out": []}
    if not isinstance(scope, dict):
        raise TransitionError("requirements_foundation.scope は object でない")
    if not is_explicit_na(scope):
        scope.setdefault("in", [])
        scope.setdefault("out", [])
    merged["scope"] = scope
    goals = merged.get("goals", [])
    goal_ids = [] if is_explicit_na(goals) else foundation_goal_ids(goals)
    intents = merged.get("concrete_intents", []) or []
    if is_explicit_na(intents):
        intents = []
    elif not isinstance(intents, list):
        raise TransitionError("requirements_foundation.concrete_intents は配列でない")
    for intent in intents:
        if not isinstance(intent, dict):
            raise TransitionError(f"concrete_intent は object でない: {intent!r}")
        for goal_id in intent.get("serves", []) or []:
            if goal_id not in goal_ids:
                raise TransitionError(f"concrete_intent {intent.get('id')!r} の serves={goal_id!r} が実在 goal を指さない")
    confirmed = bool(merged.get("confirmed"))
    if confirmed:
        missing = foundation_missing_fields(merged)
        if missing:
            raise TransitionError("確定条件不足: U1-U3 は値必須・U4-U9 は値または明示 N/A+理由が必須: " + ", ".join(missing))
        approval_ref = merged.get("approval_ref")
        if not isinstance(approval_ref, str) or not approval_ref.strip():
            raise TransitionError("確定条件不足: confirmed には approval_ref (ユーザー合意の approval_log 参照) が必須")
        if not has_entry(state.get("approval_log") or [], approval_ref):
            raise TransitionError(f"確定条件不足: approval_ref={approval_ref!r} が approval_log に不在 (承認証跡なし)")
        source_findings = validate_foundation_source_indexes(state)
        if source_findings:
            raise TransitionError("確定条件不足: " + "; ".join(source_findings))
        # 出典検査 (上) は qa_log の答えが改竄されていないかを見るだけで、
        # foundation の値には一度も触れない。名前は出典検査だが出典を見ていない。
        # 2026-08-20 の実測: この欠陥のせいで書面 §6 の 4 項目が state から消えたまま
        # 3 回のヒアリング監査 (08-16 / 08-18 / 08-19) を通過した。下の被覆検査が
        # 「foundation の値が原文を覆っているか」を見る側である。
        coverage_findings = validate_foundation_scope_coverage(state, merged)
        if coverage_findings:
            raise TransitionError("確定条件不足: " + "; ".join(coverage_findings))
        # 被覆検査は scope しか見ない。scope 以外の欄が出典なしのまま増えるのを
        # 止めるのがこの上限である。上限は下げる方向にしか動かさない。
        # 空札 (欄名だけで実物を指していない出典) を先に落とす。落とさないと
        # 下の上限が札の枚数で満たせてしまう。
        record_findings = validate_foundation_source_records(merged)
        if record_findings:
            raise TransitionError("確定条件不足: " + "; ".join(record_findings))
        cap_findings = validate_foundation_unsourced_cap(merged)
        if cap_findings:
            raise TransitionError("確定条件不足: " + "; ".join(cap_findings))
    merged["confirmed"] = confirmed
    state["requirements_foundation"] = merged


def _validate_cost_model(value, label: str) -> str:
    if not isinstance(value, dict):
        raise TransitionError(f"decision: {label} は object 必須")
    category = value.get("category")
    if category not in DECISION_COST_CATEGORIES:
        raise TransitionError(f"decision: {label}.category={category!r} が許容値外 ({sorted(DECISION_COST_CATEGORIES)})")
    amount = value.get("amount")
    if category == "unknown":
        if amount is not None and (isinstance(amount, bool) or not isinstance(amount, (int, float)) or amount < 0):
            raise TransitionError(f"decision: {label}.amount は非負数または null 必須")
    elif isinstance(amount, bool) or not isinstance(amount, (int, float)) or amount < 0:
        raise TransitionError(f"decision: {label}.amount は非負数必須")
    if category == "free" and amount != 0:
        raise TransitionError(f"decision: {label}.category=free の amount は 0 必須")
    if category in {"low-cost", "paid"} and amount == 0:
        raise TransitionError(f"decision: {label}.category={category} の amount は正数必須")
    for field in ("currency", "billing_period", "tco"):
        require_nonempty(value.get(field), f"{label}.{field}")
    return category


def set_decision(state: dict, decision: dict) -> None:
    if not isinstance(decision, dict):
        raise TransitionError("decision は object 必須")
    # 出所は writer が打刻する。呼び出し側が recorded_with を渡せると、
    # 「門のある writer を通した」と record 自身に書けてしまい、
    # 出所の欄が検査でなく自己申告になる。
    reject_self_declared_provenance(decision, "decision")
    decision_id = decision.get("id")
    require_nonempty(decision_id, "id")
    require_nonempty(decision.get("question"), "question")
    status = decision.get("status")
    if status not in DECISION_STATUSES:
        raise TransitionError(f"decision: status={status!r} が許容値外")
    goal_ids = set(foundation_goal_ids((state.get("requirements_foundation") or {}).get("goals", [])))
    serves = normalize_serves(decision.get("serves_goals"))
    if not serves:
        raise TransitionError("decision: serves_goals は非空必須")
    dangling = [goal_id for goal_id in serves if goal_id not in goal_ids]
    if dangling:
        raise TransitionError(f"decision: serves_goals {dangling} が実在 goal を指さない")
    options = decision.get("options")
    if not isinstance(options, list) or not 2 <= len(options) <= 3:
        raise TransitionError("decision: options は2-3件必須")
    option_ids: list[str] = []
    cost_categories: set[str] = set()
    for option in options:
        if not isinstance(option, dict):
            raise TransitionError("decision option は object 必須")
        for field in DECISION_OPTION_FIELDS:
            if field != "cost_model":
                require_nonempty(option.get(field), f"option.{field}")
        cost_categories.add(_validate_cost_model(option.get("cost_model"), "option.cost_model"))
        for field in ("pros", "cons", "risks"):
            require_nonempty_string_list(option.get(field), f"option.{field}")
        evidence_refs = option.get("evidence_refs")
        require_nonempty_string_list(evidence_refs, "option.evidence_refs")
        if any(not is_https_url(ref) for ref in evidence_refs):
            raise TransitionError("decision: option.evidence_refs は公式 https URL 必須")
        if option["id"] in option_ids:
            raise TransitionError(f"decision: option id 重複 {option['id']!r}")
        option_ids.append(option["id"])
    if not cost_categories.intersection({"free", "low-cost"}):
        raise TransitionError("decision: options には free または low-cost 候補が最低1件必須")
    recommendation = decision.get("recommendation")
    if status != "needs_guidance":
        if not isinstance(recommendation, dict):
            raise TransitionError("decision: recommendation が必須")
        for field in ("option_id", "rationale", "caveats", "confidence", "latest_checked_at"):
            require_nonempty(recommendation.get(field), f"recommendation.{field}")
        require_nonempty_string_list(recommendation.get("caveats"), "recommendation.caveats")
        basis = recommendation.get("comparison_basis")
        if not isinstance(basis, dict):
            raise TransitionError("decision: recommendation.comparison_basis は object 必須")
        for axis in DECISION_COMPARISON_AXES:
            require_nonempty(basis.get(axis), f"recommendation.comparison_basis.{axis}")
        if not is_rfc3339(recommendation.get("latest_checked_at")):
            raise TransitionError("decision: recommendation.latest_checked_at は RFC3339 必須")
        if recommendation.get("option_id") not in option_ids:
            raise TransitionError("decision: recommendation.option_id が options に不在")
    user_decision = decision.get("user_decision")
    if status == "confirmed":
        if not isinstance(user_decision, dict):
            raise TransitionError("decision: confirmed には user_decision が必須")
        if user_decision.get("option_id") not in option_ids:
            raise TransitionError("decision: user_decision.option_id が options に不在")
        require_nonempty(user_decision.get("confirmed_at"), "user_decision.confirmed_at")
        if not is_rfc3339(user_decision.get("confirmed_at")):
            raise TransitionError("decision: user_decision.confirmed_at は RFC3339 必須")
    elif user_decision:
        raise TransitionError("decision: AI推奨だけで confirmed にせずユーザー確認を待つこと")
    normalized, records = dict(decision), list(state.get("decisions") or [])
    normalized["serves_goals"] = serves
    normalized["recorded_with"] = DECISION_WRITER
    for index, current in enumerate(records):
        if isinstance(current, dict) and current.get("id") == decision_id:
            # 打刻を導入する前に書かれた出所は、上書きせず別欄へ退避する。
            # loop_count の超過値と同じ扱い: 数 (この場合は文言) を揃えると
            # 「門の無い経路で書かれた」痕跡そのものが消えるため、値は残して
            # 「writer が検めたものではない」という意味のほうを欄名で示す。
            prior = current.get("recorded_with")
            if isinstance(prior, str) and prior.strip() and prior != DECISION_WRITER:
                normalized["prior_unverified_provenance"] = prior
            records[index] = normalized
            break
    else:
        records.append(normalized)
    state["decisions"] = records
