"""Read-only MCP resources compiled from the canonical agent skills."""

from __future__ import annotations

from pathlib import Path

from fastmcp import FastMCP
from fastmcp.resources.types import TextResource
from pydantic import AnyUrl


SKILLS_ROOT = (
    Path(__file__).resolve().parents[3]
    / "plugins"
    / "agent"
    / "ascendant"
    / "skills"
)


def register_skill_resources(mcp: FastMCP) -> None:
    """Publish each canonical topic skill as a self-contained resource."""

    for skill_path in sorted(SKILLS_ROOT.glob("*/SKILL.md")):
        skill_name = skill_path.parent.name
        _ = mcp.add_resource(
            TextResource(
                uri=AnyUrl(f"skill://ascendant/{skill_name}"),
                name=f"Ascendant {skill_name} skill",
                description=(
                    "Read-only self-contained Ascendant topic instruction."
                ),
                text=skill_resource_text(skill_path),
            )
        )


def skill_resource_text(skill_path: Path) -> str:
    """Include the references required by a skill's relative links."""

    skill_root = skill_path.parent
    plugin_agent = SKILLS_ROOT.parent / "AGENTS.md"
    hosted_workflow = "".join(
        (
            "# Hosted MCP data workflow\n\n",
            "The instruction files below are self-contained in this ",
            "resource. ",
            "Do not use relative filesystem paths, local `persons/` records, ",
            "or local scripts. Retrieve owned evidence with Ascendant data ",
            "tools, and use `get_relationship_context` only when both owned ",
            "records are required.\n",
        )
    )
    sections = [
        hosted_workflow,
        "# Skill\n\n" + hosted_skill_text(skill_path),
    ]
    if plugin_agent.exists():
        sections.append(
            "# Plugin instructions\n\n"
            + plugin_agent.read_text(encoding="utf-8")
        )
    for reference in sorted((skill_root / "references").glob("*.md")):
        sections.append(
            f"## Reference: {reference.name}\n\n"
            + reference.read_text(encoding="utf-8")
        )
    return "\n\n".join(sections)


def hosted_skill_text(skill_path: Path) -> str:
    """Replace local-record commands in skills with hosted-tool workflows."""

    name = skill_path.parent.name
    if name == "init-person":
        return (
            "# Save birth details\n\n"
            "Use `create_person_record` to create a consent-attested hosted "
            "record. Pass a human-readable `display_label`, timezone-aware "
            "ISO 8601 `dob`, latitude, longitude, and "
            "`consent_attested=true`. "
            "The result contains a record ID and immutable evidence revision "
            "ID. Use `get_person_context` for the resulting evidence; use "
            "`list_person_records` to select another record. All records are "
            "scoped to the authenticated account and no local `persons/` "
            "directory exists.\n"
        )
    if name == "get-transit":
        return (
            "# Current planetary positions\n\n"
            "Use `list_person_records` to select an owned record, then call "
            "`get_person_context` with its `record_id` and an optional "
            "timezone-aware `moment`. The returned `transit` is dated D1 "
            "evidence alongside the stored natal evidence. This data tool "
            "supplies positions only; apply the matching specialist skill to "
            "interpret them.\n"
        )
    return skill_path.read_text(encoding="utf-8")
