"""Public contract tests for the bundled Ascendant agent plugin."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tomllib
from pathlib import Path
from typing import cast

from ascendant_mcp.codec import integer_field, object_field, string_field

REPOSITORY = Path(__file__).resolve().parents[1]
SKILLS = REPOSITORY / "plugins/agent/ascendant/skills"
PLUGIN_MANIFEST = REPOSITORY / "plugins/agent/.codex-plugin/plugin.json"
APP_MANIFEST = REPOSITORY / "plugins/agent/.app.json"
MARKETPLACE_MANIFEST = REPOSITORY / ".agents/plugins/marketplace.json"
MCP_REQUIREMENTS = REPOSITORY / "mcp/requirements.txt"
MCP_PROJECT = REPOSITORY / "mcp/pyproject.toml"
CORE_DEPENDENCY = (
    "astro-ascendant @ git+https://github.com/thaletto/ascendant.git@"
    "5b792182c87a9555ab785f32a235d2bf0b7676fb"
)
GET_TRANSIT = SKILLS / "get-transit/scripts/get-transit.py"
INIT_PERSON = SKILLS / "init-person/scripts/init-person.py"
TOPICS = (
    "career",
    "daily-transit",
    "education",
    "family",
    "finance",
    "health",
    "marriage",
    "property",
    "relationship-compatibility",
)


def _run_tool(
    command: list[str],
    cwd: Path,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        env=os.environ | {"PYTHONPATH": str(REPOSITORY)},
        check=False,
        capture_output=True,
        text=True,
    )


def _json_object(path: Path) -> dict[str, object]:
    decoded = cast(object, json.loads(path.read_text(encoding="utf-8")))
    assert isinstance(decoded, dict)
    return cast(dict[str, object], decoded)


def test_reading_plugin_does_not_ship_a_python_evaluator() -> None:
    assert not any(
        path.name == "evaluate_reading.py" for path in SKILLS.rglob("*")
    )


def test_public_plugin_manifest_points_to_its_skills_and_legal_pages() -> None:
    manifest = _json_object(PLUGIN_MANIFEST)
    skills_path = (
        string_field(manifest, "skills").removeprefix("./").rstrip("/")
    )
    interface = object_field(manifest, "interface")

    assert (PLUGIN_MANIFEST.parents[1] / skills_path) == SKILLS
    assert string_field(manifest, "apps") == "./.app.json"
    apps = object_field(_json_object(APP_MANIFEST), "apps")
    ascendant_app = object_field(apps, "ascendant")
    assert string_field(ascendant_app, "id") == (
        "plugin_asdk_app_6a80be4dd0a48191a4ee0fd13005942f"
    )
    assert string_field(ascendant_app, "category") == "Astrology"
    assert string_field(interface, "privacyPolicyURL") == (
        "https://ascendant-docs.vercel.app/docs/privacy"
    )
    assert string_field(interface, "termsOfServiceURL") == (
        "https://ascendant-docs.vercel.app/docs/terms"
    )
    assert not any(
        "evaluate_reading.py" in path.read_text(encoding="utf-8")
        for path in SKILLS.rglob("*.md")
    )


def test_marketplace_entry_matches_the_stable_plugin_identifier() -> None:
    manifest = _json_object(PLUGIN_MANIFEST)
    marketplace = _json_object(MARKETPLACE_MANIFEST)
    entries_value = marketplace["plugins"]
    assert isinstance(entries_value, list)
    entries = cast(list[object], entries_value)
    assert len(entries) == 1
    entry = entries[0]
    assert isinstance(entry, dict)
    typed_entry = cast(dict[str, object], entry)

    assert string_field(typed_entry, "name") == string_field(manifest, "name")
    source = object_field(typed_entry, "source")
    assert string_field(source, "path") == "./plugins/agent/"


def test_repository_metadata_targets_the_agents_repository() -> None:
    manifest = _json_object(PLUGIN_MANIFEST)

    assert string_field(manifest, "license") == "AGPL-3.0"
    assert string_field(manifest, "repository") == (
        "https://github.com/thaletto/ascendant-agents"
    )


def test_each_skill_uses_the_repository_license() -> None:
    repository_license = string_field(_json_object(PLUGIN_MANIFEST), "license")
    skill_manifests = sorted(SKILLS.glob("*/SKILL.md"))

    assert len(skill_manifests) == 11
    assert all(
        f"license: {repository_license}" in path.read_text(encoding="utf-8")
        for path in skill_manifests
    )


def test_mcp_requirements_install_the_deployment_package_only() -> None:
    requirements = MCP_REQUIREMENTS.read_text(encoding="utf-8").splitlines()

    assert requirements == ["-e ."]


def test_mcp_pins_a_compatible_core_revision() -> None:
    decoded = cast(
        object,
        tomllib.loads(MCP_PROJECT.read_text(encoding="utf-8")),
    )
    assert isinstance(decoded, dict)
    project = object_field(cast(dict[str, object], decoded), "project")
    dependencies_value = project["dependencies"]
    assert isinstance(dependencies_value, list)
    dependencies = cast(list[object], dependencies_value)

    assert CORE_DEPENDENCY in dependencies


def test_each_specialist_skill_carries_its_own_framework() -> None:
    for topic in TOPICS:
        references = SKILLS / topic / "references"
        skill = (SKILLS / topic / "SKILL.md").read_text(encoding="utf-8")
        assert "references/process.md" in skill
        assert "references/hierarchy.md" in skill
        assert "references/artifacts.md" in skill
        assert "references/sources.md" in skill
        assert "references/topic.md" in skill
        assert "../../shared/" not in skill
        assert (references / "process.md").is_file()
        assert (references / "hierarchy.md").is_file()
        assert (references / "artifacts.md").is_file()
        assert (references / "jaimini-core.md").is_file()
        assert (references / "sources.md").is_file()
        assert (references / "topic.md").is_file()
        process = (references / "process.md").read_text(encoding="utf-8")
        hierarchy = (references / "hierarchy.md").read_text(encoding="utf-8")
        jaimini_core = (references / "jaimini-core.md").read_text(
            encoding="utf-8"
        )
        artifacts = (references / "artifacts.md").read_text(encoding="utf-8")
        sources = (references / "sources.md").read_text(encoding="utf-8")
        topic_rules = (references / "topic.md").read_text(encoding="utf-8")
        assert "Direct answer" in process
        assert "Jaimini and Parashari factors are co-primary" in hierarchy
        assert "Chara Karakas" in jaimini_core
        assert "`jaimini.json`" in artifacts
        assert "Jaimini Sutras" in sources
        assert "`JM-" in topic_rules


def test_no_plugin_skill_references_a_shared_folder() -> None:
    assert not (REPOSITORY / "plugins/agent/ascendant" / "shared").exists()
    for directory in SKILLS.iterdir():
        if not directory.is_dir():
            continue
        if not (directory / "SKILL.md").is_file():
            continue
        skill = (directory / "SKILL.md").read_text(encoding="utf-8")
        assert "../../shared/" not in skill
        assert "parashari-judgement" not in skill
        for other in SKILLS.iterdir():
            if other == directory or not (other / "SKILL.md").is_file():
                continue
            assert f"../{other.name}/" not in skill


def test_relationship_skills_require_bidirectional_cross_chart_lord_overlays(
) -> None:
    compatibility = (SKILLS / "relationship-compatibility/SKILL.md").read_text(
        encoding="utf-8"
    )
    compatibility_topic = (
        SKILLS / "relationship-compatibility/references/topic.md"
    ).read_text(encoding="utf-8")
    marriage = (SKILLS / "marriage/SKILL.md").read_text(encoding="utf-8")
    marriage_topic = (SKILLS / "marriage/references/topic.md").read_text(
        encoding="utf-8"
    )

    assert "bidirectional cross-chart\nhouse-lord overlays" in compatibility
    assert "PR-REL-CROSS-D9" in compatibility_topic
    assert "H7, H5, and H8" in marriage
    assert "bidirectional cross-chart overlay" in marriage_topic


def test_init_person_backfills_v3_provenance_without_rewriting_charts(
    tmp_path: Path,
) -> None:
    command = [
        sys.executable,
        str(INIT_PERSON),
        "--name",
        "Ada",
        "--dob",
        "1990-01-01T12:00:00+05:30",
        "--latitude",
        "28.6139",
        "--longitude",
        "77.2090",
    ]

    first = _run_tool(command, tmp_path)
    assert first.returncode == 0, first.stderr
    context = tmp_path / "persons/Ada/CONTEXT.md"
    original_context = context.read_text(encoding="utf-8")
    d1 = tmp_path / "persons/Ada/charts/D1.json"
    original_d1 = d1.read_bytes()
    provenance = tmp_path / "persons/Ada/provenance.json"
    provenance_data = _json_object(provenance)
    assert integer_field(provenance_data, "schema_version") == 2
    assert string_field(provenance_data, "rule_pack") == (
        "parashari_raman_jaimini_v3"
    )
    assert string_field(provenance_data, "jaimini_method") == (
        "jaimini_srao_7_core_v1"
    )
    assert (tmp_path / "persons/Ada/jaimini.json").is_file()

    provenance_data["schema_version"] = 1
    provenance_data["rule_pack"] = "parashari_raman_v2"
    _ = provenance_data.pop("jaimini_method")
    (tmp_path / "persons/Ada/jaimini.json").unlink()
    _ = provenance.write_text(
        json.dumps(provenance_data, indent=2),
        encoding="utf-8",
    )
    second = _run_tool(command, tmp_path)

    assert second.returncode == 0, second.stderr
    assert context.read_text(encoding="utf-8") == original_context
    assert d1.read_bytes() == original_d1
    migrated = _json_object(provenance)
    assert integer_field(migrated, "schema_version") == 2
    assert string_field(migrated, "rule_pack") == (
        "parashari_raman_jaimini_v3"
    )
    assert string_field(migrated, "jaimini_method") == (
        "jaimini_srao_7_core_v1"
    )
    assert (tmp_path / "persons/Ada/jaimini.json").is_file()


def test_person_tools_reject_paths_outside_persons_directory(
    tmp_path: Path,
) -> None:
    commands = (
        [
            sys.executable,
            str(INIT_PERSON),
            "--name",
            "../Ada",
            "--dob",
            "1990-01-01T12:00:00+05:30",
            "--latitude",
            "28.6139",
            "--longitude",
            "77.2090",
        ],
        [
            sys.executable,
            str(GET_TRANSIT),
            "--name",
            "../Ada",
            "--date",
            "2026-07-28T12:00:00+05:30",
        ],
    )

    for command in commands:
        result = _run_tool(command, tmp_path)
        assert result.returncode == 2
        assert "error:" in result.stdout
        assert "one direct persons/<name> record" in result.stdout


def test_person_tools_report_unknown_flags_as_usage_errors(
    tmp_path: Path,
) -> None:
    commands = (
        [sys.executable, str(INIT_PERSON), "--bogus"],
        [sys.executable, str(GET_TRANSIT), "--bogus"],
    )

    for command in commands:
        result = _run_tool(command, tmp_path)
        assert result.returncode == 2
        assert "error:" in result.stdout
        assert "help[1]:" in result.stdout


def test_person_tools_home_views_are_content_first(tmp_path: Path) -> None:
    for tool in (INIT_PERSON, GET_TRANSIT):
        result = _run_tool([sys.executable, str(tool)], tmp_path)
        assert result.returncode == 0
        assert "persons[0]{name}:" in result.stdout
        assert "help[2]:" in result.stdout


def test_person_tools_report_versions(tmp_path: Path) -> None:
    for tool in (INIT_PERSON, GET_TRANSIT):
        result = _run_tool([sys.executable, str(tool), "--version"], tmp_path)
        assert result.returncode == 0
        assert "get-transit" in result.stdout or "init-person" in result.stdout


def test_transit_tool_reports_missing_records_as_user_errors(
    tmp_path: Path,
) -> None:
    result = _run_tool(
        [
            sys.executable,
            str(GET_TRANSIT),
            "--name",
            "Ada",
            "--date",
            "2026-07-28T12:00:00+05:30",
        ],
        tmp_path,
    )

    assert result.returncode == 1
    assert "error:" in result.stdout
    assert "persons/Ada" in result.stdout


def test_transit_tool_renders_aggregates_and_planets(tmp_path: Path) -> None:
    created = _run_tool(
        [
            sys.executable,
            str(INIT_PERSON),
            "--name",
            "Ada",
            "--dob",
            "1990-01-01T12:00:00+05:30",
            "--latitude",
            "28.6139",
            "--longitude",
            "77.2090",
        ],
        tmp_path,
    )
    assert created.returncode == 0, created.stdout
    assert "status: created" in created.stdout

    transit = _run_tool(
        [
            sys.executable,
            str(GET_TRANSIT),
            "--name",
            "Ada",
            "--date",
            "2026-07-28T12:00:00+05:30",
        ],
        tmp_path,
    )
    assert transit.returncode == 0, transit.stdout
    assert "planets: 9" in transit.stdout
    assert "retrograde:" in transit.stdout
    header = "planets[9]{planet,house,sign,degree,dir,nakshatra,pada,natal}:"
    assert header in transit.stdout
    assert "houses[12]{house,sign,lord,planets}:" in transit.stdout
    assert "help[2]:" in transit.stdout


def test_init_person_reports_reuse_on_second_identical_run(
    tmp_path: Path,
) -> None:
    command = [
        sys.executable,
        str(INIT_PERSON),
        "--name",
        "Ada",
        "--dob",
        "1990-01-01T12:00:00+05:30",
        "--latitude",
        "28.6139",
        "--longitude",
        "77.2090",
    ]
    first = _run_tool(command, tmp_path)
    assert first.returncode == 0 and "status: created" in first.stdout
    second = _run_tool(command, tmp_path)
    assert second.returncode == 0 and "status: reused" in second.stdout
