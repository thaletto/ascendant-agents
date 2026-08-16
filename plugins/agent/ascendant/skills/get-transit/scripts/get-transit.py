#!/usr/bin/env python3
"""Show where the planets are now, or at a requested date (AXI/TOON)."""

import argparse
import logging
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import NoReturn, TypeAlias, cast, get_args

from typing_extensions import override

from ascendant import Ascendant
from ascendant.person_record import PersonRecordError, PersonRecordStore
from ascendant.types import ALLOWED_DIVISIONS, HOUSES, ChartType
from ascendant.types import RASHIS as RASHIS_LITERAL

logging.basicConfig(level=logging.WARNING, format="[%(levelname)s] %(message)s")
LOGGER = logging.getLogger(__name__)


def tool_version() -> str:
    try:
        return version("astro-ascendant")
    except PackageNotFoundError:
        return "dev"


RASHI: TypeAlias = RASHIS_LITERAL
RASHIS = cast(tuple[RASHI, ...], get_args(RASHIS_LITERAL))
DIVISIONS = cast(tuple[int, ...], get_args(ALLOWED_DIVISIONS))
BIN = Path(__file__).resolve()


class UsageError(Exception):
    """An invalid flag or flag value; structured on stdout, exit code 2."""


class ArgumentParser(argparse.ArgumentParser):
    @override
    def error(self, message: str) -> NoReturn:
        raise UsageError(message)


@dataclass(frozen=True)
class TransitQuery:
    name: str
    date: datetime
    division: ALLOWED_DIVISIONS


@dataclass
class Arguments:
    name: str | None = None
    date: str | None = None
    division: int | str | None = None


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


def _format_degree(longitude: float) -> str:
    return f"{longitude % 30:.2f}°"


def _natal_house_for_sign(transit_sign: RASHI, lagna_sign: RASHI) -> int:
    if transit_sign not in RASHIS or lagna_sign not in RASHIS:
        raise ValueError(f"Unknown sign: {transit_sign} or {lagna_sign}")
    return (RASHIS.index(transit_sign) - RASHIS.index(lagna_sign)) % 12 + 1


def _planet_rows(
    chart: ChartType,
    lagna_sign: RASHI,
) -> list[tuple[object, ...]]:
    rows: list[tuple[object, ...]] = []
    for number in range(1, 13):
        house = chart.get(cast(HOUSES, number))
        if not house:
            continue
        for planet in house.get("planets", []):
            rows.append(
                (
                    planet["name"],
                    number,
                    planet["sign"]["name"],
                    _format_degree(planet["longitude"]),
                    "R" if planet.get("is_retrograde") else "D",
                    planet["sign"]["nakshatra"]["name"],
                    planet["sign"]["nakshatra"]["pada"],
                    _natal_house_for_sign(planet["sign"]["name"], lagna_sign),
                )
            )
    return sorted(rows, key=lambda row: (row[1], row[0]))


def _house_rows(chart: ChartType) -> list[tuple[object, ...]]:
    rows: list[tuple[object, ...]] = []
    for number in range(1, 13):
        house = chart.get(cast(HOUSES, number))
        if not house:
            rows.append((number, "-", "-", "-"))
            continue
        sign = house["sign"]
        if house.get("planets"):
            lord = house["planets"][0]["sign"]["lord"]
        elif (lagna := house.get("lagna")) is not None:
            lord = lagna["sign"]["lord"]
        else:
            lord = "-"
        planets = "/".join(p["name"] for p in house.get("planets", [])) or "-"
        rows.append((number, sign, lord, planets))
    return rows


def _toon_blocks() -> str:
    persons = _list_persons()
    lines = [
        "get-transit:",
        f"  bin: {_display_path()}",
        (
            "  description: Show where the planets are now, or at a requested "
            + "date, compared with a person's birth chart"
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
            "  Run `get-transit.py --name <name>` for current positions",
            "  Run `get-transit.py --name <name> --date <ISO8601>` for a dated moment",
        ]
    )
    return "\n".join(lines)


def render_transit(query: TransitQuery) -> str:
    record = PersonRecordStore().open(query.name)
    lagna_sign = record.d1[1]["sign"]

    target = query.date
    if target.tzinfo is None:
        target = target.replace(tzinfo=UTC)
    offset = target.utcoffset()
    if offset is None:
        raise ValueError("date must be timezone-aware")
    total_minutes = int(offset.total_seconds() // 60)
    hours, minutes = divmod(abs(total_minutes), 60)
    sign = "+" if total_minutes >= 0 else "-"
    utc = f"{sign}{hours:02}:{minutes:02}"

    latitude, longitude = record.coordinates
    ascendant = Ascendant(
        year=target.year,
        month=target.month,
        day=target.day,
        hour=target.hour,
        minute=target.minute,
        second=target.second,
        latitude=latitude,
        longitude=longitude,
        utc=utc,
    )
    chart = ascendant.get_chart(query.division)

    planet_rows = _planet_rows(chart, lagna_sign)
    house_rows = _house_rows(chart)
    retrograde = sum(1 for row in planet_rows if row[4] == "R")
    moment = target.strftime("%Y-%m-%d %H:%M %Z").strip()
    sources = f"persons/{query.name}/CONTEXT.md; persons/{query.name}/charts/D1.json"

    planet_header = "{planet,house,sign,degree,dir,nakshatra,pada,natal}"
    house_header = "{house,sign,lord,planets}"
    lines = [
        "get-transit:",
        f"  name: {query.name}",
        f"  moment: {moment}",
        f"  division: D{query.division}",
        f"  natal-location: {latitude}, {longitude}",
        f"  natal-lagna: {lagna_sign}",
        f"  planets: {len(planet_rows)}",
        f"  retrograde: {retrograde}",
        f"  sources: {sources}",
        f"planets[{len(planet_rows)}]{planet_header}:",
    ]
    if planet_rows:
        lines.extend(f"  {','.join(str(cell) for cell in row)}" for row in planet_rows)
    else:
        lines.append("  (no planets in transit chart)")
    lines.append(f"houses[{len(house_rows)}]{house_header}:")
    lines.extend(f"  {','.join(str(cell) for cell in row)}" for row in house_rows)
    lines.extend(
        [
            "",
            "help[2]:",
            f"  Run `get-transit.py --name {query.name} --date <ISO8601>`",
            f"  Run `get-transit.py --name {query.name} --division <n>`",
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


def build_query(args: Arguments) -> TransitQuery:
    if args.name is None:
        raise UsageError("missing required flag --name")
    name = args.name
    if not name or name in {".", ".."} or Path(name).name != name:
        raise UsageError("name must identify one direct persons/<name> record")
    division = int(args.division) if args.division is not None else 1
    if division not in DIVISIONS:
        raise UsageError(f"division must be one of {DIVISIONS}, got {division}")
    if args.date is None:
        date = datetime.now(UTC)
    else:
        try:
            date = datetime.fromisoformat(args.date)
        except ValueError as error:
            raise UsageError(str(error)) from error
        if date.tzinfo is None:
            date = date.replace(tzinfo=UTC)
    return TransitQuery(
        name=name,
        date=date,
        division=cast(ALLOWED_DIVISIONS, division),
    )


def main(argv: list[str] | None = None) -> int:
    parser = ArgumentParser(description="Show current or dated transit positions.")
    _ = parser.add_argument("--name", help="Native's display name")
    _ = parser.add_argument("--date", help="ISO 8601 moment; defaults to now (UTC)")
    _ = parser.add_argument(
        "--division", type=int, help=f"Divisional chart number; allowed: {DIVISIONS}"
    )
    _ = parser.add_argument(
        "--version", action="version", version=f"get-transit {tool_version()}"
    )

    try:
        args = parser.parse_args(argv, namespace=Arguments())
    except SystemExit as exit_signal:
        return int(exit_signal.code or 0)
    except UsageError as error:
        print(_error(str(error), 2, ["Run `get-transit.py --help` for usage"]))
        return 2

    if args.name is None:
        print(_toon_blocks())
        return 0

    try:
        query = build_query(args)
    except UsageError as error:
        print(_error(str(error), 2, ["Run `get-transit.py --help` for usage"]))
        return 2

    try:
        print(render_transit(query))
    except PersonRecordError as error:
        print(
            _error(
                str(error),
                1,
                [
                    "Run `get-transit.py --name <name> --date <ISO8601>` for a dated moment",
                    "Run `init-person.py --help` to see how to save a person",
                ],
            )
        )
        return 1
    except (ValueError, TypeError) as error:
        print(_error(str(error), 1, ["Run `get-transit.py --help` for usage"]))
        return 1
    except Exception as error:
        LOGGER.exception("Failed to render transit")
        print(
            _error(
                f"internal error: {error}", 1, ["Run `get-transit.py --help` for usage"]
            )
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
