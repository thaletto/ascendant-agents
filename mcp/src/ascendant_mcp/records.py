"""Birth-detail validation and calculation of hosted chart evidence."""

from __future__ import annotations

import json
import tempfile
from math import isfinite
from pathlib import Path

from ascendant import Ascendant
from ascendant.person_record import PersonRecordInput, PersonRecordStore
from ascendant_mcp.codec import (
    number_field,
    object_field,
    parse_moment,
    string_field,
)
from ascendant_mcp.errors import HostedRecordError


def build_birth_input(
    dob: str,
    latitude: float,
    longitude: float,
) -> dict[str, object]:
    """Validate and normalize birth details for a hosted person record."""

    birth_moment = parse_moment(dob)
    if not isfinite(latitude) or not isfinite(longitude):
        raise HostedRecordError("latitude and longitude must be finite")
    if not -90 <= latitude <= 90:
        raise HostedRecordError("latitude must be between -90 and 90")
    if not -180 <= longitude <= 180:
        raise HostedRecordError("longitude must be between -180 and 180")
    return {
        "dob": birth_moment.isoformat(),
        "latitude": latitude,
        "longitude": longitude,
    }


def calculate_artifacts(
    birth_input: dict[str, object],
) -> tuple[dict[str, object], dict[str, object]]:
    """Produce the immutable PersonRecord evidence bundle for a chart."""

    with tempfile.TemporaryDirectory(prefix="ascendant-mcp-") as directory:
        person = PersonRecordInput(
            name="person",
            dob=parse_moment(string_field(birth_input, "dob")),
            latitude=number_field(birth_input, "latitude"),
            longitude=number_field(birth_input, "longitude"),
        )
        record_store = PersonRecordStore(Path(directory) / "persons")
        record = record_store.initialize(person)
        artifacts = {
            str(path.relative_to(record.directory)): json.loads(
                path.read_text(encoding="utf-8")
            )
            for path in sorted(record.directory.rglob("*.json"))
        }
        return artifacts, object_field(artifacts, "provenance.json")


def calculate_transit(
    birth_input: dict[str, object],
    moment: str,
) -> dict[str, object]:
    """Produce D1 transit evidence at a caller-selected moment."""

    target = parse_moment(moment)
    offset = target.utcoffset()
    if offset is None:
        raise HostedRecordError("moment must be timezone-aware")
    total_minutes = int(offset.total_seconds() // 60)
    hours, minutes = divmod(abs(total_minutes), 60)
    utc = f"{'+' if total_minutes >= 0 else '-'}{hours:02}:{minutes:02}"
    chart = Ascendant(
        year=target.year,
        month=target.month,
        day=target.day,
        hour=target.hour,
        minute=target.minute,
        second=target.second,
        latitude=number_field(birth_input, "latitude"),
        longitude=number_field(birth_input, "longitude"),
        utc=utc,
    ).get_chart(1)
    return {"moment": target.isoformat(), "chart": chart}
