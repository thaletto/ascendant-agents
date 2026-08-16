"""Validation and serialization helpers for hosted record values."""

from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import cast

from ascendant_mcp.contracts import SqlRow
from ascendant_mcp.errors import HostedRecordError


def parse_moment(value: str) -> datetime:
    """Parse a timezone-aware ISO 8601 moment."""

    try:
        moment = datetime.fromisoformat(value)
    except ValueError as error:
        raise HostedRecordError(f"Invalid ISO 8601 moment: {value}") from error
    if moment.tzinfo is None or moment.utcoffset() is None:
        raise HostedRecordError("moment must be timezone-aware")
    return moment


def row_to_dict(value: SqlRow) -> dict[str, object]:
    return {key: value[key] for key in value}


def to_json(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def from_json(value: object) -> object:
    if not isinstance(value, str):
        raise HostedRecordError("Stored JSON value is invalid")
    return cast(object, json.loads(value))


def object_field(value: Mapping[str, object], key: str) -> dict[str, object]:
    result = value.get(key)
    if not isinstance(result, dict):
        raise HostedRecordError(f"Missing object field: {key}")
    typed_result = cast(dict[object, object], result)
    return {str(name): item for name, item in typed_result.items()}


def string_field(value: Mapping[str, object], key: str) -> str:
    result = value.get(key)
    if not isinstance(result, str):
        raise HostedRecordError(f"Missing string field: {key}")
    return result


def integer_field(value: Mapping[str, object], key: str) -> int:
    result = value.get(key)
    if not isinstance(result, int):
        raise HostedRecordError(f"Missing integer field: {key}")
    return result


def number_field(value: Mapping[str, object], key: str) -> float:
    result = value.get(key)
    if not isinstance(result, (int, float)):
        raise HostedRecordError(f"Missing numeric field: {key}")
    return float(result)


def now() -> str:
    return datetime.now(UTC).isoformat()
