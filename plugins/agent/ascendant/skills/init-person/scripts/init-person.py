#!/usr/bin/env python3
"""Save a person's birth details and prepare reusable chart data (AXI/TOON)."""

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import NoReturn, cast

from typing_extensions import override

from ascendant.person_record import (
    PersonRecordError,
    PersonRecordInput,
    PersonRecordStore,
)

BIN = Path(__file__).resolve()


def tool_version() -> str:
    try:
        return version("astro-ascendant")
    except PackageNotFoundError:
        return "dev"


class UsageError(Exception):
    """An invalid flag or flag value; structured on stdout, exit code 2."""


class ArgumentParser(argparse.ArgumentParser):
    @override
    def error(self, message: str) -> NoReturn:
        raise UsageError(message)


@dataclass
class Arguments:
    name: str | None = None
    dob: str | None = None
    latitude: float | str | None = None
    longitude: float | str | None = None


def _display_path() -> str:
    try:
        relative = BIN.relative_to(Path.home())
        return f"~/{relative}"
    except ValueError:
        return str(BIN)


def _list_persons() -> list[str]:
    root = Path("persons")
    if not root.is_dir():
        return []
    return sorted(directory.name for directory in root.iterdir() if directory.is_dir())


def _toon_blocks() -> str:
    persons = _list_persons()
    lines = [
        "init-person:",
        f"  bin: {_display_path()}",
        (
            "  description: Save a person's birth details "
            + "and prepare reusable chart, Jaimini, timing, yoga, and SAV information"
        ),
        f"  persons: {len(persons)}",
        f"persons[{len(persons)}]{{name}}:",
    ]
    if persons:
        lines.extend(f"  {name}" for name in persons)
    else:
        lines.append("  (no saved persons)")
    lines.extend(
        [
            "",
            "help[2]:",
            (
                "  Run `init-person.py --name <name> --dob <ISO8601> "
                + "--latitude <lat> --longitude <lon>`"
            ),
            "  Run `get-transit.py --name <name>` once a person is saved",
        ]
    )
    return "\n".join(lines)


def _error(message: str, exit_code: int, help_lines: list[str]) -> str:
    lines = [
        "error:",
        f"  exit: {exit_code}",
        f"  message: {message}",
    ]
    if help_lines:
        lines.append(f"help[{len(help_lines)}]:")
        lines.extend(f"  {line}" for line in help_lines)
    return "\n".join(lines)


def _signature_from_provenance(record_directory: Path) -> str:
    provenance_path = record_directory / "provenance.json"
    if not provenance_path.is_file():
        return ""
    try:
        data = json.loads(  # pyright: ignore[reportAny]
            provenance_path.read_text(encoding="utf-8")
        )
    except (json.JSONDecodeError, OSError):
        return ""
    if not isinstance(data, dict):
        return ""
    provenance = cast(dict[str, object], data)
    rule_pack = provenance.get("rule_pack", "")
    ayanamsa = provenance.get("ayanamsa", "")
    house_system = provenance.get("house_system", "")
    if not isinstance(rule_pack, str) or not rule_pack:
        return ""
    parts = [f"rule-pack: {rule_pack}"]
    if ayanamsa:
        parts.append(f"ayanamsa: {ayanamsa}")
    if house_system:
        parts.append(f"house-system: {house_system}")
    return ", ".join(parts)


def render_init(person: PersonRecordInput) -> str:
    store = PersonRecordStore()
    existed = (  # pyright: ignore[reportUnknownVariableType]
        {directory.name for directory in store.root.iterdir() if directory.is_dir()}
        if store.root.is_dir()
        else set()
    )
    record = store.initialize(person)
    status = "reused" if record.name in existed else "created"

    charts_dir = record.directory / "charts"
    chart_files = (
        sorted(charts_dir.glob("D*.json")) if charts_dir.is_dir() else []
    )
    provenance = _signature_from_provenance(record.directory)

    lines = [
        "init-person:",
        f"  name: {record.name}",
        f"  status: {status}",
        f"  directory: {record.directory.resolve()}",
        f"  charts: {len(chart_files)}",
    ]
    if provenance:
        lines.append(f"  {provenance}")
    lines.extend(
        [
            "",
            "help[2]:",
            (
                f"  Run `get-transit.py --name {record.name}` "
                + "for current positions"
            ),
            (
                f"  Run `get-transit.py --name {record.name} "
                + "--date <ISO8601>` for a dated moment"
            ),
        ]
    )
    return "\n".join(lines)


def build_person(args: Arguments) -> PersonRecordInput:
    if args.name is None:
        raise UsageError("missing required flag --name")
    name = args.name
    if not name or name in {".", ".."} or Path(name).name != name:
        raise UsageError("name must identify one direct persons/<name> record")
    if args.dob is None:
        raise UsageError("missing required flag --dob")
    if args.latitude is None:
        raise UsageError("missing required flag --latitude")
    if args.longitude is None:
        raise UsageError("missing required flag --longitude")

    try:
        dob = datetime.fromisoformat(args.dob)
    except ValueError as error:
        raise UsageError(str(error)) from error
    try:
        latitude = float(args.latitude)
        longitude = float(args.longitude)
    except (TypeError, ValueError) as error:
        raise UsageError(str(error)) from error

    return PersonRecordInput(
        name=name,
        dob=dob,
        latitude=latitude,
        longitude=longitude,
    )


def main(argv: list[str] | None = None) -> int:
    parser = ArgumentParser(
        description="Initialize a native's astrological data directory."
    )
    _ = parser.add_argument("--name", help="Native's display name")
    _ = parser.add_argument("--dob", help="ISO 8601 birth moment with timezone offset")
    _ = parser.add_argument(
        "--latitude", type=float, help="Latitude in decimal degrees"
    )
    _ = parser.add_argument(
        "--longitude", type=float, help="Longitude in decimal degrees"
    )
    _ = parser.add_argument(
        "--version", action="version", version=f"init-person {tool_version()}"
    )

    try:
        args = parser.parse_args(argv, namespace=Arguments())
    except SystemExit as exit_signal:
        return int(exit_signal.code or 0)
    except UsageError as error:
        print(_error(str(error), 2, ["Run `init-person.py --help` for usage"]))
        return 2

    if args.name is None:
        print(_toon_blocks())
        return 0

    try:
        person = build_person(args)
    except UsageError as error:
        print(_error(str(error), 2, ["Run `init-person.py --help` for usage"]))
        return 2

    try:
        print(render_init(person))
    except PersonRecordError as error:
        print(_error(str(error), 1, ["Run `init-person.py --help` for usage"]))
        return 1
    except Exception as error:  # noqa: BLE001
        print(
            _error(
                f"internal error: {error}", 1, ["Run `init-person.py --help` for usage"]
            )
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
