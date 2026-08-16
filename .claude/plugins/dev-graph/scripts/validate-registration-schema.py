#!/usr/bin/env python3
"""Validate the stdlib-only JSON Schema subset used by package registration."""
from __future__ import annotations

import json
import re
from typing import Any

from _common import ContractError


def schema_error(path: str, detail: str) -> ContractError:
    return ContractError(f"schema violation at {path}: {detail}")


def _is_type(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return True


def _matches(value: Any, schema: Any, root: dict[str, Any]) -> bool:
    try:
        validate_schema(value, schema, root, "$")
        return True
    except ContractError:
        return False


def validate_schema(
    value: Any,
    schema: Any,
    root: dict[str, Any],
    path: str,
) -> None:
    """Validate the JSON Schema subset used by local package/node schemas."""
    if schema is True:
        return
    if schema is False:
        raise schema_error(path, "value is forbidden")
    if not isinstance(schema, dict):
        raise schema_error(path, "invalid schema object")

    ref = schema.get("$ref")
    if isinstance(ref, str):
        if not ref.startswith("#/"):
            raise schema_error(path, f"external $ref is not supported here: {ref}")
        target: Any = root
        for part in ref[2:].split("/"):
            target = target[part.replace("~1", "/").replace("~0", "~")]
        validate_schema(value, target, root, path)

    for child in schema.get("allOf", []):
        validate_schema(value, child, root, path)
    if "if" in schema and _matches(value, schema["if"], root) and "then" in schema:
        validate_schema(value, schema["then"], root, path)

    expected = schema.get("type")
    if expected is not None:
        choices = expected if isinstance(expected, list) else [expected]
        if not any(_is_type(value, item) for item in choices):
            raise schema_error(
                path,
                f"expected type {choices}, got {type(value).__name__}",
            )
    if "const" in schema and value != schema["const"]:
        raise schema_error(path, f"expected const {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        raise schema_error(path, f"not in enum {schema['enum']!r}")

    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            raise schema_error(path, "string too short")
        if "pattern" in schema and re.search(schema["pattern"], value) is None:
            raise schema_error(path, f"does not match {schema['pattern']}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            raise schema_error(path, "below minimum")
        if "maximum" in schema and value > schema["maximum"]:
            raise schema_error(path, "above maximum")

    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            raise schema_error(path, "too few items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            raise schema_error(path, "too many items")
        if schema.get("uniqueItems"):
            packed = [
                json.dumps(item, sort_keys=True, separators=(",", ":"))
                for item in value
            ]
            if len(set(packed)) != len(packed):
                raise schema_error(path, "items are not unique")
        prefix = schema.get("prefixItems", [])
        for index, child in enumerate(prefix[: len(value)]):
            validate_schema(value[index], child, root, f"{path}[{index}]")
        items = schema.get("items")
        if items is False and len(value) > len(prefix):
            raise schema_error(path, "additional items forbidden")
        if isinstance(items, dict):
            for index, item in enumerate(value):
                validate_schema(item, items, root, f"{path}[{index}]")
        if "contains" in schema and not any(
            _matches(item, schema["contains"], root) for item in value
        ):
            raise schema_error(path, "contains constraint not satisfied")

    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                raise schema_error(path, f"missing required property {key}")
        properties = schema.get("properties", {})
        for key, child in properties.items():
            if key in value:
                validate_schema(value[key], child, root, f"{path}.{key}")
        additional = schema.get("additionalProperties", True)
        unknown = set(value) - set(properties)
        if additional is False and unknown:
            raise schema_error(path, f"unknown properties {sorted(unknown)}")
        if isinstance(additional, dict):
            for key in unknown:
                validate_schema(value[key], additional, root, f"{path}.{key}")
        if len(value) < schema.get("minProperties", 0):
            raise schema_error(path, "too few properties")
        if "maxProperties" in schema and len(value) > schema["maxProperties"]:
            raise schema_error(path, "too many properties")
