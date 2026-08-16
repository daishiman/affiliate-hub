"""repo config の正本資産が dev-graph 自身の schema に適合することを固定する。

背景 (C01 live-trial r16 で検出):
  `run-dev-graph-init` は決定論 script を持たず、SKILL.md の Execution contract に従って
  `.dev-graph/config.json` を生成する。契約 5 は「config/graph/template readiness を検証する」と
  書いているが、実際に呼ばれる validate-graph-schema.py は **graph しか検証しない**。
  そのため init は自分の schema に通らない config を出力でき、実際に出力していた:

    - `templates/repo-config.example.json` の content_roots に `features` が無い
      (schema の required は 7 key。物理ディレクトリは作られるのに routing policy から参照できない)
    - 実運用 config (`.dev-graph/config.json`) は system-dev-planner が読む `plan_roots` を持つが、
      schema は additionalProperties:false でこれを許していなかった (schema 側の drift)

  どちらも「静的資産としては存在して妥当」なので、資産単体の検査では見つからない。
  *正本資産を schema にかける* 往復が無かったことが穴だった。本 test がその往復を固定する。
"""
from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

PLUGIN = Path(__file__).resolve().parents[1]
REPO = PLUGIN.parents[1]
SCHEMA_PATH = PLUGIN / "schemas" / "repo-config.schema.json"
TEMPLATE_PATH = PLUGIN / "templates" / "repo-config.example.json"
REPO_CONFIG_PATH = REPO / ".dev-graph" / "config.json"

# artifact_kind ごとの物理配置先。init が作る 6 content root + system-spec 取込先。
EXPECTED_CONTENT_ROOT_KEYS = {
    "issues",
    "tasks",
    "specifications",
    "architecture",
    "features",
    "documents",
    "system_spec",
}


@pytest.fixture(scope="module")
def schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _violations(schema: dict, document: dict) -> list[str]:
    validator = jsonschema.Draft202012Validator(schema)
    return [
        f"{'/'.join(map(str, error.path)) or '(root)'}: {error.message}"
        for error in sorted(validator.iter_errors(document), key=lambda e: list(e.path))
    ]


def test_schema_itself_is_valid(schema: dict) -> None:
    jsonschema.Draft202012Validator.check_schema(schema)


def test_config_template_conforms_to_schema(schema: dict) -> None:
    """init が導入先へ配置する正本テンプレートが schema に適合する。"""
    document = json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))
    assert _violations(schema, document) == []


def test_template_declares_every_required_content_root(schema: dict) -> None:
    """content_roots の required と template の実キーが一致する (features 欠落の回帰防止)。"""
    required = set(schema["properties"]["content_roots"]["required"])
    assert required == EXPECTED_CONTENT_ROOT_KEYS
    document = json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))
    assert set(document["content_roots"]) == EXPECTED_CONTENT_ROOT_KEYS


@pytest.mark.skipif(not REPO_CONFIG_PATH.is_file(), reason="repository is not dev-graph initialised")
def test_repository_config_conforms_to_schema(schema: dict) -> None:
    """実運用中の config も schema に適合する (schema drift の検知)。

    plan_roots のように別 plugin が足したセクションを schema が知らないと、
    additionalProperties:false のせいで「正しい運用 config が schema 不適合」になる。
    """
    document = json.loads(REPO_CONFIG_PATH.read_text(encoding="utf-8"))
    assert _violations(schema, document) == []
